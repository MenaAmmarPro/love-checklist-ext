/* Love Checklist — background script.
 *
 * MV3 service worker (Chrome/Edge) / event page (Firefox). It only makes sure
 * the storage key exists so the popup always has a valid list to read.
 */
(function () {
  "use strict";

  var api = globalThis.browser || globalThis.chrome;
  var KEY = "mena-checklist";

  function ensureSeed() {
    if (!(api && api.storage && api.storage.local)) return;
    try {
      var maybe = api.storage.local.get([KEY], function (res) {
        if (!res || !(KEY in res)) {
          var payload = {};
          payload[KEY] = [];
          api.storage.local.set(payload);
        }
      });
      if (maybe && typeof maybe.then === "function") {
        maybe.then(function (res) {
          if (!res || !(KEY in res)) {
            var payload = {};
            payload[KEY] = [];
            api.storage.local.set(payload);
          }
        });
      }
    } catch (err) {
      /* storage is best-effort */
    }
  }

  if (api && api.runtime && api.runtime.onInstalled) {
    api.runtime.onInstalled.addListener(ensureSeed);
  }
})();
