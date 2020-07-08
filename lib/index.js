/* global window, testability */
/* exported instrumentBrowser */
'use strict';

var instrumentBrowser = function (window, config) {
    window = window || this;
    config = config || {};
    var verbose = config.verbose;

    function shouldBeSkipped(url, method) {
        var matcher = function (cfg) {
            return 'method' in cfg ? method === cfg.method && url.match(cfg.url) :
                url.match(cfg.url);
        };
        var res = false;
        if ('blacklist' in config) {
            res = config.blacklist.some(matcher);
        }
        return res;
    }

    var setImmediate = window.setImmediate || window.setTimeout;

    function patchFunction(set, clear, filterTime) {
        var setFn = window[set];

        if (!setFn) {
            return;
        }

        var clearFn = window[clear];
        var sets = {};

        function endWait(reference) {
            var task = sets[reference];
            if (task) {
                if (verbose) {
                    console.log('[END]', set, reference);
                }
                setImmediate(task.end);
                delete sets[reference];
            }
        }

        window[set] = function () {
            var maxTimeout = 'maxTimeout' in config ? config.maxTimeout : 5000;
            var stack = [].concat(window.__testabilityStack || []);
            var cb = arguments[0];
            var time = arguments[1] || 0;
            var ref;
            var recursive = stack.indexOf(cb) >= 0;
            var waitForIt = (!filterTime || time < maxTimeout) && !recursive;

            if(verbose && recursive) {
                console.log("Function contains recursive call, skipping testability.", cb);
            }

            arguments[0] = function () {
                window.__testabilityStack = stack;
                var rtn;
                try {
                    rtn = cb.apply(window, arguments);
                } finally {
                    delete window.__testabilityStack;
                    if (waitForIt) {
                        stack.pop();
                        endWait(ref);
                    }
                }
                return rtn;
            };

            if (waitForIt) {
                stack.push(cb);
                if (verbose) {
                    console.log('[START]', set, ref, cb, time);
                }
                ref = setFn.apply(window, arguments);
                sets[ref] = window.testability.wait.start();
            } else {
                ref = setFn.apply(window, arguments);
            }

            return ref;
        };
        window[clear] = function () {
            var rtn = clearFn.apply(window, arguments);
            endWait(arguments[0]);
            return rtn;
        };

        window[set].restore = function () {
            window[set] = setFn;
        };
        window[clear].restore = function () {
            window[clear] = clearFn;
        };
    }

    function patchCreateElement(document) {
        var createElement = document.createElement.bind(document);

        function newCreateElement(name) {
            var element = createElement.apply(this, arguments);
            element['__testabilityIntercepted'] = true;
            var handler = function () {
                element['__testabilityLoaded'] = true;
                element.removeEventListener('load', handler);
                element.removeEventListener('error', handler);
                if (element['__testabilityLoadHandler']) {
                    element['__testabilityLoadHandler']();
                }
            };
            if (name === 'script' || name === 'style') {
                element.addEventListener('load', handler);
                element.addEventListener('error', handler);
            }
            return element;
        }

        document.createElement = newCreateElement.bind(document);
        document.createElement.restore = function () {
            document.createElement = createElement;
        };
    }

    function patchFetchPromise(set) {
        var setFn = window[set];

        if (!setFn) {
            return;
        }

        window[set] = function () {
            var ref;
            var url = null;
            var method = null;
            var arg0 = arguments[0];

            function keepOn(result) {
                if (verbose) {
                    console.log('[END] Fetch to ', url, 'with method', method);
                }
                setImmediate(window.testability.wait.oneLess);
                return result;
            }

            if ('Request' in window && arg0 instanceof window.Request) {
                url = arg0.url;
                method = arg0.method;
            } else if (typeof arg0 === 'string' || arg0 instanceof String) {
                url = arg0;
                method = 'GET';
            }
            if (shouldBeSkipped(url, method)) {
                return setFn.apply(window, arguments);
            }
            ref = setFn.apply(window, arguments);
            ref.then(keepOn).catch(keepOn);
            if (verbose) {
                console.log('[START] Fetch to ', url, 'with method', method);
            }
            window.testability.wait.oneMore();

            return ref;
        };
        window[set].restore = function () {
            window[set] = setFn;
        };
    }

    patchFunction('setTimeout', 'clearTimeout', true);
    patchFunction('setImmediate', 'clearImmediate', false);
    patchFetchPromise('fetch');
    patchCreateElement(document);

    var oldOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function () {
        var url = arguments[1];
        var method = arguments[0];
        if (window.testability && !shouldBeSkipped(url, method)) {
            var task;
            this.addEventListener('readystatechange', function () {
                if (this.readyState === 4 && task) {
                    if (verbose) {
                        console.log(
                            '[END] XMLHttpRequest to ', url, 'with method', method);
                    }
                    setImmediate(task.end);
                }
                if (this.readyState === 1 && !task) {
                    if (verbose) {
                        console.log(
                            '[START] XMLHttpRequest to ', url, 'with method', method);
                    }
                    task = testability.wait.start();
                }
            }, false);
            var abort = this.abort;
            this.abort = function () {
                if (task) {
                    setImmediate(task.end);
                }
                abort.apply(this, arguments);
            };
        }
        oldOpen.apply(this, arguments);
    };


    function whichEvents() {
        var t;
        var el = document.createElement('fakeelement');
        var transitions = {
            'MozTransition': {
                transitionend: 'transitionend',
                transitionstart: 'transitionstart',
                transitionrun: 'transitionrun',
                transitioncancel: 'transitioncancel',
                animationend: 'animationend',
                animationstart: 'animationstart'
            },
            'OTransition': {
                transitionend: 'oTransitionEnd',
                transitionstart: 'oTransitionStart',
                transitionrun: 'oTransitionRun',
                transitioncancel: 'oTransitionCancel',
                animationend: 'oAnimationEnd',
                animationstart: 'oAnimationStart'
            },
            'WebkitTransition': {
                transitionend: 'webkitTransitionEnd',
                transitionstart: 'webkitTransitionStart',
                transitionrun: 'webkitTransitionRun',
                transitioncancel: 'webkitTransitionCancel',
                animationend: 'webkitAnimationEnd',
                animationstart: 'webkitAnimationStart'
            }
        };

        for (t in transitions) {
            if (el[t] !== undefined) {
                return transitions[t];
            }
        }

        return {
            transitionend: 'transitionend',
            transitionstart: 'transitionstart',
            transitionrun: 'transitionrun',
            transitioncancel: 'transitioncancel',
            animationend: 'animationend',
            animationstart: 'animationstart'
        };
    }


    var events = whichEvents();
    var observer;
    var animate = Element.prototype.animate;

    function detectMutations() {
        function startHandler(event) {
            if (event.target && !event.target._testabilityAnimating) {
                var style = window.getComputedStyle(event.target);
                var animationIterationCount = style['animation-iteration-count'] ||
                    style['-webkit-animation-iteration-count'];
                if (animationIterationCount &&
                    animationIterationCount.indexOf('infinite') >= 0) {
                    return;
                }
                event.target._testabilityAnimating = true;
                if (verbose) {
                    console.log('[START] Animation on element', event.target);
                }
                window.testability.wait.oneMore();
            }
        }

        function endHandler(event) {
            if (event.target && event.target._testabilityAnimating) {
                if (verbose) {
                    console.log('[END] Animation on element', event.target);
                }
                setImmediate(window.testability.wait.oneLess);
                delete event.target._testabilityAnimating;
            }
        }

        function listen(element) {
            element.addEventListener(events.transitionstart, startHandler);
            element.addEventListener(events.transitionend, endHandler);
            element.addEventListener(events.transitionrun, startHandler);
            element.addEventListener(events.transitioncancel, endHandler);

            element.addEventListener(events.animationstart, startHandler);
            element.addEventListener(events.animationend, endHandler);

            if ((element.localName === 'script' || element.localName === 'style') &&
                element['__testabilityIntercepted']) {
                if (element['__testabilityLoaded'] ||
                    (element.localName === 'script' && !element.src) ||
                    (element.localName === 'style' && !element.firstChild)) {
                    window.testability.wait.oneMore();
                    setImmediate(window.testability.wait.oneLess);
                } else {
                    if (verbose) {
                        console.log('[START] Script loading', element);
                    }
                    if (!element['__testabilityLoadHandler']) {
                        window.testability.wait.oneMore();
                        element['__testabilityLoadHandler'] = function () {
                            if (verbose) {
                                console.log('[END] Script loading', element);
                            }
                            setImmediate(window.testability.wait.oneLess);
                            delete element['__testabilityLoadHandler'];
                        };
                    }
                }
            }
        }

        function registerListeners(elements) {
            if (!elements) {
                return;
            }
            Array.from(elements).forEach(function (element) {
                if (element === document || element.shadowRoot) {
                    observer.observe(element, {
                        childList: true,
                        subtree: true
                    });
                    if (element.shadowRoot) {
                        listen(element.shadowRoot);
                        registerListeners(element.shadowRoot.children);
                    }
                }
                listen(element);
                registerListeners(element.children);
            });
        }

        if (window.MutationObserver) {
            // Crea una instancia de observer
            observer = new MutationObserver(function (records) {
                records.forEach(function (record) {
                    registerListeners(record.addedNodes);
                });
            });
            registerListeners([document]);
        }

        if (animate) {
            Element.prototype.animate = function (_keyframes, options) {
                function end() {
                    if (verbose) {
                        console.log('[END] Animation on element', this);
                    }
                    testability.wait.oneLess();
                }

                var animation = animate.apply(this, arguments);

                if ((animation.effect && animation.effect.activeDuration !== Infinity) && (!options || options.iterations !== Infinity)) {
                    if (verbose) {
                        console.log('[START] Animation on element', this, animation);
                    }
                    animation.addEventListener('finish', end);
                    animation.addEventListener('cancel', end);
                    testability.wait.oneMore();
                }

                return animation;
            };
        }
    }

    detectMutations();

    return {
        animationEvents: events,
        restore: function () {
            document.createElement.restore();
            window.setTimeout.restore();
            window.clearTimeout.restore();
            if (window.setImmediate) {
                window.setImmediate.restore();
                window.clearImmediate.restore();
            }
            if (window.fetch) {
                window.fetch.restore();
            }
            window.XMLHttpRequest.prototype.open = oldOpen;

            if (observer) {
                observer.disconnect();
            }

            if (animate) {
                Element.prototype.animate = animate;
            }

        }
    };

};

if (typeof window === 'undefined') {
    module.exports = instrumentBrowser;
}