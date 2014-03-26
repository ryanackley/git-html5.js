/*global chrome*/
chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('/tests/tests.html', {
    id: "jsgitdiff"
  });
});
