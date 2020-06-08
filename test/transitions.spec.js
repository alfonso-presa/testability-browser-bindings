describe('transitions handling', function () {

    var oneMore;
    var oneLess;
    var element;
    var testabilityCallBack;
    var setTimeout = window.setTimeout;

    var instrumentation;

    function performTransition() {
        var id = 'id' + ('' + Math.random()).substring(2);

        var style = document.createElement('style');
        style.innerHTML = `
            #${id}{
                transition: transform 0.5s ease-in-out;
                background-color: darkseagreen;
                display:inline-block;
            }

            #${id}.transition{
                transform: translateX(100px);
            }

            #${id}.transition:after{
                background-color: yellow;
            }
        `;
        document.getElementsByTagName('head')[0].appendChild(style);

        var element = document.createElement('div');
        element.innerText='transitions!';
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
        if(element) {
            element.remove();
        }
        oneMore.restore();
        oneLess.restore();

        instrumentation.restore();
    });

    it('should wait for transitions to complete', function (done) {

        element = performTransition();

        element.addEventListener(instrumentation.animationEvents.transitionstart, function () {
            setTimeout(function () {
                expect(oneMore.calledOnce).toEqual(true);
                window.testability.when.ready(testabilityCallBack);
            });
        });

        element.addEventListener(instrumentation.animationEvents.transitionend, function () {
            setTimeout(function () {
                expect(testabilityCallBack.calledOnce).toEqual(true);
                done();
            },10);
        });

        setTimeout(function () {
            element.classList.add('transition');
        },200);
    });

});
