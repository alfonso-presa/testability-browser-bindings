/* global expect, describe, it, beforeEach, afterEach, sinon, instrumentBrowser */
'use strict';

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

    beforeEach(function () {
        testabilityCallBack = sinon.spy();

        oneMore = sinon.spy(window.testability.wait, 'oneMore');
        oneLess = sinon.spy(window.testability.wait, 'oneLess');

        xhr = sinon.useFakeXMLHttpRequest();
        clock = sinon.useFakeTimers();

        fetch = window.fetch ? sinon.stub(window, 'fetch') : window.fetch = sinon.stub();
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

        instrumentation = instrumentBrowser(window);
    });

    afterEach(function () {
        oneMore.restore();
        oneLess.restore();

        instrumentation.restore();

        if (fetch.restore) {
            fetch.restore();
        }
        else {
            window.fetch = undefined;
        }
        xhr.restore();
        clock.restore();
    });

    describe('timming', function () {

        describe('setTimeout', function () {

            it('should make testability wait if invoked without time', function () {
                setTimeout(sinon.spy());
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(1);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should make testability wait if invoked with time less than 5 secs', function () {
                setTimeout(sinon.spy(),50);
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(51);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should not make testability wait if invoked recursively withing same function', function () {
                function loopTimeout() {
                    setTimeout(loopTimeout,50);
                }

                loopTimeout();
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(51);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should make testability wait if invoked recursively with a diferent function', function () {
                var passed = false;
                function loopTimeout() {
                    function doLoopTimeout() {
                        if(!passed) {
                            loopTimeout();
                            passed = true;
                        }
                    }
                    setTimeout(doLoopTimeout,50);
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
                var id = setTimeout(sinon.spy(),50);
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);

                clearTimeout(id);
                clock.tick();

                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should not make testability wait if invoked with time more than 5 secs', function () {
                setTimeout(sinon.spy(),5001);
                window.testability.when.ready(testabilityCallBack);

                expect(testabilityCallBack.calledOnce).toEqual(true);
                clock.tick(1);
                expect(oneMore.notCalled).toEqual(true);
            });

            it('should wait if timeouts are chained', function () {
                setTimeout(function () {
                    setTimeout(sinon.spy());
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

        describe('setImmediate', function () {

            it('should make testability wait when invoked', function () {
                setImmediate(sinon.spy());
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);
                clock.tick(1);
                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should report testability if clear is invoked', function () {
                var id = setImmediate(sinon.spy());
                window.testability.when.ready(testabilityCallBack);

                expect(oneMore.calledOnce).toEqual(true);
                expect(testabilityCallBack.notCalled).toEqual(true);

                clearImmediate(id);
                clock.tick();

                expect(testabilityCallBack.calledOnce).toEqual(true);
            });

            it('should wait if immediates are chained', function () {
                setImmediate(function () {
                    setImmediate(sinon.spy());
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
            var req = new XMLHttpRequest();
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
            var req = new XMLHttpRequest();
            req.open('GET', 'http://does.not.exist');
            req.send();

            window.testability.when.ready(testabilityCallBack);
            expect(oneMore.calledOnce).toEqual(true);

            req.statusText = 'abort';
            req.abort();
            clock.tick();

            expect(testabilityCallBack.calledOnce).toEqual(true);
        });
    });

    describe('fetch', function () {

        it('should make testability wait when request is pending', function () {
            window.fetch('http://does.not.exist', {method: 'get'});

            window.testability.when.ready(testabilityCallBack);
            expect(oneMore.calledOnce).toEqual(true);

            fetchOkResolve();
            clock.tick();

            expect(testabilityCallBack.calledOnce).toEqual(true);
        });

        it('should make testability wait when request is pending and report when failed', function () {
            window.fetch('http://does.not.exist', {method: 'get'});

            window.testability.when.ready(testabilityCallBack);
            expect(oneMore.calledOnce).toEqual(true);

            fetchFailResolve();
            clock.tick();

            expect(testabilityCallBack.calledOnce).toEqual(true);
        });
    });

});
