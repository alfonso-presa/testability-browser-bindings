describe('testability bindings', function () {

    var oneMore;
    var oneLess;
    var testabilityCallBack;

    var clock;
    var instrumentation;
    var xhr;
    var fetch;
    var fetchOkResolve;
    var fetchFailResolve;
    var fakeWindow;

    beforeEach(function () {
        function fakeBuilder(method) {
            return function () {
                return method.apply(window, arguments);
            };
        }

        clock = sinon.useFakeTimers();
        xhr = sinon.useFakeXMLHttpRequest();

        testabilityCallBack = sinon.spy();

        fetch = sinon.stub();
        fetch.returns({
            then: function (callback) {
                fetchOkResolve = callback;
                return this;
            },
            catch: function (callback) {
                fetchFailResolve = callback;
                return this;
            }
        });

        fakeWindow = {
            testability: window.testability,
            fetch: fetch,
            XMLHttpRequest: window.XMLHttpRequest,
            setTimeout: fakeBuilder(window.setTimeout),
            setImmediate: fakeBuilder(window.setImmediate || window.setTimeout),
            setInterval: fakeBuilder(window.setInterval),
            clearTimeout: fakeBuilder(window.clearTimeout),
            clearImmediate: fakeBuilder(window.clearImmediate || window.clearTimeout),
            clearInterval: fakeBuilder(window.clearInterval)
        };

        oneMore = sinon.spy(window.testability.wait, 'oneMore');
        oneLess = sinon.spy(window.testability.wait, 'oneLess');

        var configs = { maxTimeout: 5000, blacklist: [{url: '.*black\.listed.*', method: 'GET'}] };

        instrumentation = instrumentBrowser(fakeWindow, configs);
    });

    afterEach(function () {
        instrumentation.restore();

        oneMore.restore();
        oneLess.restore();

        if (fetch.restore) {
            fetch.restore();
        }
        else {
            window.fetch = undefined;
        }
        xhr.restore();
        clock.restore();
        fetchOkResolve = undefined;
        fetchFailResolve = undefined;
    });

    describe('timing', function () {

        describe('setTimeout', function () {

            it('should make testability wait if invoked without time', function () {
                fakeWindow.setTimeout(sinon.spy());
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(1);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should make testability wait until timeout function fails and should raise the exception', function () {
                var exception;

                fakeWindow.setTimeout(function () {
                    throw 'errored on purpose';
                });
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);

                try {
                    clock.tick(1);
                }
                catch(e) {
                    exception = e;
                }

                expect(exception).not.toBeUndefined();
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should make testability wait if invoked with time less than 5 secs', function () {
                fakeWindow.setTimeout(sinon.spy(),50);
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(51);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should not make testability wait if invoked recursively withing same function', function () {
                function loopTimeout() {
                    fakeWindow.setTimeout(loopTimeout,50);
                }

                loopTimeout();
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(51);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should make testability wait if invoked recursively with a different function', function () {
                var passed = false;
                function loopTimeout() {
                    function doLoopTimeout() {
                        if(!passed) {
                            loopTimeout();
                            passed = true;
                        }
                    }
                    fakeWindow.setTimeout(doLoopTimeout,50);
                }

                loopTimeout();
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(51);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(51);
                expect(testabilityCallBack.calledOnce).toEqual(true);
                expect(passed).toEqual(true);
            });

            it('should report testability if clear is invoked', function () {
                var id = fakeWindow.setTimeout(sinon.spy(),50);
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);

                fakeWindow.clearTimeout(id);
                clock.tick();

                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should not make testability wait if invoked with time more than 5 secs', function () {
                fakeWindow.setTimeout(sinon.spy(),5001);
                window.testability.when.ready(testabilityCallBack);

                expect(testabilityCallBack.calledOnce).toEqual(true);
                clock.tick(1);
                expect(oneMore.notCalled).toEqual(true);
            });

            it('should wait if timeouts are chained', function () {
                fakeWindow.setTimeout(function () {
                    fakeWindow.setTimeout(sinon.spy());
                });
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(1);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(1);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should make testability wait when invoked', function () {
                fakeWindow.setImmediate(sinon.spy());
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(1);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should report testability if clear is invoked', function () {
                var id = fakeWindow.setImmediate(sinon.spy());
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);

                fakeWindow.clearImmediate(id);
                clock.tick();

                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should wait if immediate is chained', function () {
                fakeWindow.setImmediate(function () {
                    fakeWindow.setImmediate(sinon.spy());
                });
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(1);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(1);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

        });

    });

    describe('XMLHttpRequest', function () {


        it('should make testability wait when request is pending', function () {
            var req = new fakeWindow.XMLHttpRequest();
            req.open('GET', 'http://does.not.exist');
            req.send();

            window.testability.when.ready(testabilityCallBack);
            expect(testabilityCallBack.calledOnce).toEqual(false);

            req.autoRespondAfter = 10;
            req.respond(200, {},'');

            expect(oneMore.calledOnce).toEqual(true);

            clock.tick();

            expect(testabilityCallBack.calledOnce).toEqual(true);
        });

        it('should make testability wait when request is pending and resolve when error', function () {
            var req = new fakeWindow.XMLHttpRequest();
            req.open('GET', 'http://does.not.exist');
            req.send();

            window.testability.when.ready(testabilityCallBack);
            expect(oneMore.calledOnce).toEqual(true);

            req.statusText = 'abort';
            req.abort();
            clock.tick();

            expect(testabilityCallBack.calledOnce).toEqual(true);
        });

        it('should not make testability wait when request is done against blacklisted url', function () {
            var req = new fakeWindow.XMLHttpRequest();
            req.open('GET', 'http://black.listed.url/shouldnttrigger');
            req.send();

            window.testability.when.ready(testabilityCallBack);
            expect(testabilityCallBack.calledOnce).toEqual(true);

            req.autoRespondAfter = 10;
            req.respond(200, {},'');

            expect(oneMore.calledOnce).toEqual(false);

            clock.tick();

            expect(testabilityCallBack.calledOnce).toEqual(true);
        });
    });

    describe('fetch', function () {

        it('should make testability wait when request is pending', function () {
            fakeWindow.fetch('http://does.not.exist', {method: 'get'});

            window.testability.when.ready(testabilityCallBack);
            expect(oneMore.calledOnce).toEqual(true);

            clock.tick();
            fetchOkResolve();
            clock.tick();

            expect(testabilityCallBack.calledOnce).toEqual(true);
        });

        it('should make testability wait when request is pending and report when failed', function () {
            fakeWindow.fetch('http://does.not.exist', {method: 'get'});

            window.testability.when.ready(testabilityCallBack);
            expect(oneMore.calledOnce).toEqual(true);

            clock.tick();
            fetchFailResolve();
            clock.tick();

            expect(testabilityCallBack.calledOnce).toEqual(true);
        });

        it('should not make testability wait when request in blacklist', function () {
            fakeWindow.fetch('http://black.listed.url/blacklisted', {method: 'get'});
            window.testability.when.ready(testabilityCallBack);
            expect(testabilityCallBack.calledOnce).toEqual(true);
        });
    });

});
