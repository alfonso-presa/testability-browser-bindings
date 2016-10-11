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

        window[set] = function () {
            var cb = arguments[0];
            var ref;
            var time = arguments[1] || 0;
            arguments[0] = function () {
                sets[ref] = undefined;
                cb.apply(window, arguments);
                if (!filterTime || time < 5000) {
                    setImmediate(window.testability.wait.oneLess);
                }
            };
            ref = setFn.apply(window, arguments);
            if (!filterTime || time < 5000 ) {
                window.testability.wait.oneMore();
                sets[ref] = true;
            }
            return ref;
        };
        window[set].restore = function () {
            window[set] = setFn;
        };

        window[clear] = function () {
            if (sets[arguments[0]]) {
                setImmediate(window.testability.wait.oneLess);
                sets[arguments[0]] = undefined;
            }
            return clearFn.apply(window, arguments);
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
