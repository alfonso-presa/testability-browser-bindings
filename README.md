# testability-browser-bindings
[![Build Status](https://travis-ci.org/alfonso-presa/testability-browser-bindings.svg?branch=master)](https://travis-ci.org/alfonso-presa/testability-browser-bindings)

This library captures `setTimeout`, `setImmediate`and AJAX requests through `XMLHttpRequest` or `fetch` and
notifies them to [testability.js](https://github.com/alfonso-presa/testability.js) so that it automatically
handles applicaton state for testing frameworks.

## See

- [testability.js](https://github.com/alfonso-presa/testability.js): acts as testability broker.
- [protractor-testability-plugin](https://github.com/alfonso-presa/protractor-testability-plugin): allows
testing in sync with protractor and frameworks other than Angular.
