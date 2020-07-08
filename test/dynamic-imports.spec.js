describe('script imports handling', function () {

    var oneMore;
    var oneLess;
    var instrumentation;
    var elements = [];

    function scriptImport(ref, cb) {
        var id = 'id' + ('' + Math.random()).substring(2);

        var element = document.createElement('script');
        cb && element.addEventListener('load', cb);
        cb && element.addEventListener('error', cb);
        element.setAttribute('src', ref);
        element.id = id;
        document.getElementsByTagName('head')[0].appendChild(element);

        elements.push(element);
        return element;
    }

    beforeEach(function () {
        oneMore = sinon.spy(window.testability.wait, 'oneMore');
        oneLess = sinon.spy(window.testability.wait, 'oneLess');

        instrumentation = instrumentBrowser(window);
    });

    afterEach(function () {
        oneMore.restore();
        oneLess.restore();

        instrumentation.restore();
        elements.forEach(e => e.remove());
        elements = [];
    });

    it('should wait for non existing imports', function (done) {
        var listened = false;

        scriptImport('./non_existing.js', () => {
            listened = true;
        });

        setTimeout(() => {
            expect(listened).toEqual(false);
            window.testability.when.ready(() => {
                expect(listened).toEqual(true);
                done();
            });
        });
    });

    it('should wait for existing imports', function (done) {
        var listened = false;

        scriptImport('/base/test/mocks/some-script.js', () => {
            listened = true;
        });

        setTimeout(() => {
            expect(listened).toEqual(false);
            window.testability.when.ready(() => {
                expect(window._someScriptLoaded).toEqual(true);
                expect(listened).toEqual(true);
                done();
            });
        });
    });

});
