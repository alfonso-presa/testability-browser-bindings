/* global expect, describe, it, beforeEach, afterEach, sinon, instrumentBrowser */
'use strict';

describe('animation handling', function () {

    var oneMore;
    var oneLess;
    var testabilityCallBack;
    var setTimeout = window.setTimeout;

    var instrumentation;

    function performAnimation() {
        var id = 'id' + ('' + Math.random()).substring(2);

        var style = document.createElement('style');
        style.innerHTML = ''+
        '    div#'+id+'  '+
        '    {  '+
        '        -webkit-animation: flash'+id+' 10ms ease 3;    '+
        '        -moz-animation: flash'+id+' 10ms ease 3;   '+
        '        -ms-animation: flash'+id+' 10ms ease 3;    '+
        '        -o-animation: flash'+id+' 10ms ease 3; '+
        '        animation: flash'+id+' 10ms ease 3;    '+
        '    }  '+

        '    @-webkit-keyframes flash'+id+' {    '+
        '        50% { opacity: 0; }    '+
        '    }  '+

        '    @keyframes flash'+id+' {    '+
        '        50% { opacity: 0; }    '+
        '    }  '+
        '';
        document.getElementsByTagName('head')[0].appendChild(style);

        var element = document.createElement('div');
        element.innerText='hi!';
        element.id = id;
        document.getElementsByTagName('body')[0].appendChild(element);

        return element;
    }

    function performWebAnimation(iterations) {
        var id = 'id' + ('' + Math.random()).substring(2);

        var element = document.createElement('div');
        element.innerText='hi!';
        element.id = id;
        document.getElementsByTagName('body')[0].appendChild(element);

        element.animate({
            opacity: [0.5, 1],
            transform: ['scale(0.5)', 'scale(1)'],
        }, {
            direction: 'alternate',
            duration: 500,
            iterations: iterations,
        });

        return element;
    }

    function performInfiniteAnimation() {
        var id = 'id' + ('' + Math.random()).substring(2);

        var style = document.createElement('style');
        style.innerHTML = ''+
        '    div#'+id+'  '+
        '    {  '+
        '        -webkit-animation: flash'+id+' 10ms ease infinite;    '+
        '        -moz-animation: flash'+id+' 10ms ease infinite;   '+
        '        -ms-animation: flash'+id+' 10ms ease infinite;    '+
        '        -o-animation: flash'+id+' 10ms ease infinite; '+
        '        animation: flash'+id+' 10ms ease infinite;    '+
        '    }  '+

        '    @-webkit-keyframes flash'+id+' {    '+
        '        50% { opacity: 0; }    '+
        '    }  '+

        '    @keyframes flash'+id+' {    '+
        '        50% { opacity: 0; }    '+
        '    }  '+
        '';
        document.getElementsByTagName('head')[0].appendChild(style);

        var element = document.createElement('div');
        element.innerText='hi!';
        element.id = id;
        document.getElementsByTagName('body')[0].appendChild(element);

        return element;
    }

    beforeEach(function () {
        testabilityCallBack = sinon.spy();

        oneMore = sinon.spy(window.testability.wait, 'oneMore');
        oneLess = sinon.spy(window.testability.wait, 'oneLess');

        instrumentation = instrumentBrowser(window);
    });

    afterEach(function () {
        oneMore.restore();
        oneLess.restore();

        instrumentation.restore();
    });

    it('should wait for animations to complete', function (done) {

        var element = performAnimation();

        element.addEventListener(instrumentation.animationEvents.animationstart, function () {
            setTimeout(function () {
                expect(oneMore.calledOnce).toEqual(true);
                window.testability.when.ready(testabilityCallBack);
            });
        });

        element.addEventListener(instrumentation.animationEvents.animationend, function () {
            setTimeout(function () {
                expect(testabilityCallBack.calledOnce).toEqual(true);
                done();
            },10);
        });

    });

    it('should not wait for infinite animations', function (done) {

        var element = performInfiniteAnimation();

        element.addEventListener(instrumentation.animationEvents.animationstart, function () {
            setTimeout(function () {
                expect(oneMore.calledOnce).toEqual(false);
                window.testability.when.ready(done);
            });
        });

    });

    it('should wait for animaton api', function (done) {

        expect(oneMore.notCalled).toEqual(true);
        performWebAnimation(1);

        expect(oneMore.notCalled).toEqual(false);
        window.testability.when.ready(done);

    });

    it('should not wait for infinite animaton api', function (done) {

        performWebAnimation(Infinity);
        window.testability.when.ready(done);

    });


});
