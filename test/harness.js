/* Love Checklist — Node harness (no browser needed).
 *
 * Mocks the `chrome.*` / `browser.*` storage API and the popup DOM, loads the
 * real extension scripts, and checks the pure checklist logic plus a storage
 * round-trip.
 *
 * Run:  node test/harness.js
 */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const store = {}; // extension storage stand-in
const mem = {}; // localStorage stand-in

const localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => {
    mem[k] = String(v);
  },
  removeItem: (k) => {
    delete mem[k];
  }
};

const chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
          if (k in store) res[k] = store[k];
        });
        if (typeof cb === "function") cb(res);
        return Promise.resolve(res);
      },
      set: (obj, cb) => {
        Object.assign(store, obj);
        if (typeof cb === "function") cb();
        return Promise.resolve();
      }
    }
  }
};

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  Math,
  JSON,
  Promise,
  localStorage,
  chrome,
  document: {
    readyState: "complete",
    getElementById: () => null,
    addEventListener() {},
    createElement: () => ({
      style: {},
      classList: { add() {}, remove() {} },
      appendChild() {},
      addEventListener() {},
      setAttribute() {}
    })
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const root = path.join(__dirname, "..");
vm.runInContext(fs.readFileSync(path.join(root, "src", "common", "api.js"), "utf8"), sandbox, { filename: "api.js" });
vm.runInContext(fs.readFileSync(path.join(root, "src", "popup", "popup.js"), "utf8"), sandbox, { filename: "popup.js" });

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("ok - " + msg);
  else {
    failures += 1;
    console.error("FAIL - " + msg);
  }
}

const M = sandbox.window.MenaChecklist;
assert(!!M, "namespace MenaChecklist is exposed");
assert(M && M.KEY === "mena-checklist", "storage key is mena-checklist");

let list = M.normalize(M.defaultList());
assert(list.length === M.DEFAULTS.length, "defaultList seeds " + M.DEFAULTS.length + " items");
assert(
  list.every((i) => i.id && typeof i.text === "string" && i.done === false),
  "default items are well formed"
);

list = M.addItem(list, "  Hold hands  ");
assert(list.length === M.DEFAULTS.length + 1, "addItem appends");
assert(list[list.length - 1].text === "Hold hands", "addItem trims whitespace");
assert(M.addItem(list, "   ").length === list.length, "addItem ignores blank text");

const target = list[0].id;
const toggled = M.toggleItem(list, target);
assert(toggled[0].done === true, "toggleItem marks done");
assert(M.toggleItem(toggled, target)[0].done === false, "toggleItem toggles back");
assert(list[0].done === false, "toggleItem does not mutate the source list");

const removed = M.removeItem(list, target);
assert(removed.length === list.length - 1, "removeItem drops one");
assert(
  removed.every((i) => i.id !== target),
  "removeItem drops the right id"
);

const withDone = M.clearDone(M.toggleItem(list, list[0].id));
assert(withDone.length === list.length - 1, "clearDone removes completed items");

const c = M.counts(M.toggleItem(list, list[0].id));
assert(c.total === list.length && c.done === 1, "counts reports done/total");
assert(c.label === "1 of " + list.length + " done", "counts label is human readable");

assert(M.normalize(null).length === 0, "normalize(null) is empty");
assert(M.normalize([null, 0, "x", { text: "" }]).length === 0, "normalize drops invalid entries");
assert(M.normalize([{ text: "hi" }])[0].id.length > 0, "normalize assigns missing ids");

(async function () {
  const payload = M.normalize([{ text: "call tonight", done: true }]);
  await sandbox.storageSet("mena-checklist", payload);
  const back = await sandbox.storageGet("mena-checklist");
  assert(Array.isArray(back) && back.length === 1, "storage round-trip keeps the list");
  assert(back[0].text === "call tonight" && back[0].done === true, "storage round-trip keeps fields");

  console.log("");
  if (failures) {
    console.error(failures + " assertion(s) failed");
    process.exitCode = 1;
  } else {
    console.log("All assertions passed.");
  }
})();
