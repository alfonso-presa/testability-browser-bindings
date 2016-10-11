/* global window, testability */
/* exported instrumentBrowser */
'use strict';

var instrumentBrowser = function (window) {
    window = window || this;
    var setImmediate = window.setImmediate || window.setTimeout;

    function patchFunction(set, clear, filterTime) {
        var setFn = window[set];
        var clearFn = window[clear];

        var sets = {};

        function endWait(reference) {
            var task = sets[reference];
            if (task) {
                setImmediate(task.end);
                delete sets[reference];
            }
        }

        window[set] = function () {
            var cb = arguments[0];
            var ref;
            var time = arguments[1] || 0;

            if (!filterTime || time < 5000 ) {
                arguments[0] = function () {
                    var rtn = cb.apply(window, arguments);
                    endWait(ref);
                    return rtn;
                };
                ref = setFn.apply(window, arguments);
                sets[ref] = window.testability.wait.start();
            }
            else {
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

    function patchPromiseFunction(set) {
        var setFn = window[set];

        window[set] = function () {
            var ref;

            function keepOn(result) {
                setImmediate(window.testability.wait.oneLess);
                return result;
            }

            ref = setFn.apply(window, arguments);
            ref.then(keepOn).catch(keepOn);
            window.testability.wait.oneMore();

            return ref;
        };
        window[set].restore = function () {
            window[set] = setFn;
        };
    }

    patchFunction('setTimeout', 'clearTimeout', true);
    patchFunction('setImmediate', 'clearImmediate', false);
    patchPromiseFunction('fetch');

    var oldOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url, async, user, pass) {
        if(window.testability) {
            var task;
            this.addEventListener('readystatechange', function () {
                if (this.readyState === 4 && task) {
                    setImmediate(task.end);
                }
                if (this.readyState === 1 && !task) {
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
        oldOpen.call(this, method, url, async, user, pass);
    };

    return {
        restore: function () {
            window.setTimeout.restore();
            window.clearTimeout.restore();
            window.setImmediate.restore();
            window.clearImmediate.restore();
            window.fetch.restore();
            window.XMLHttpRequest.prototype.open = oldOpen;
        }
    };

};

if (typeof window === 'undefined') {
    module.exports = instrumentBrowser;
}
