/* Shared browser API shim — loaded FIRST, as a plain (non-module) script.
 * Chrome/Edge expose `chrome` (and, on recent versions, `browser`);
 * Firefox exposes the promise-based `browser`.
 */
const api = globalThis.browser || globalThis.chrome;

/* Expose on globalThis too so sibling scripts (and tests) can grab it easily. */
globalThis.api = api;

/* Call `fn` (which accepts an optional trailing callback) and always resolve a
 * Promise, whether the API is promise-based (Firefox, new Chrome) or
 * callback-based (older Chrome). A promise that a callback-style call never
 * settles is fine: the callback fires instead.
 */
function asPromise(fn) {
  return new Promise((resolve) => {
    let maybe = null;
    try {
      maybe = fn();
    } catch (err) {
      maybe = null;
    }
    if (maybe && typeof maybe.then === "function") {
      maybe.then((value) => resolve(value), () => resolve(undefined));
      return;
    }
    try {
      fn(resolve);
    } catch (err) {
      resolve(undefined);
    }
  });
}

function storageArea() {
  return api && api.storage && api.storage.local ? api.storage.local : null;
}

function localGet(key) {
  try {
    return globalThis.localStorage ? globalThis.localStorage.getItem(key) : null;
  } catch (err) {
    return null;
  }
}

function localSet(key, value) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(key, String(value));
  } catch (err) {
    /* storage is best-effort */
  }
}

/* Read one key from extension storage; fall back to localStorage. */
function storageGet(key) {
  const area = storageArea();
  if (area && typeof area.get === "function") {
    return asPromise((cb) => area.get([key], cb)).then((res) => {
      const found = res && typeof res === "object" && key in res ? res[key] : undefined;
      return found !== undefined ? found : localGet(key);
    });
  }
  return Promise.resolve(localGet(key));
}

/* Write one key to extension storage; fall back to localStorage. */
function storageSet(key, value) {
  const area = storageArea();
  const payload = {};
  payload[key] = value;
  if (area && typeof area.set === "function") {
    return asPromise((cb) => area.set(payload, cb)).then(() => {
      localSet(key, value);
      return true;
    });
  }
  localSet(key, value);
  return Promise.resolve(true);
}

/* The active tab of the current window (or null). */
function queryActiveTab() {
  if (!(api && api.tabs && typeof api.tabs.query === "function")) return Promise.resolve(null);
  return asPromise((cb) => api.tabs.query({ active: true, currentWindow: true }, cb)).then(
    (tabs) => (Array.isArray(tabs) && tabs.length ? tabs[0] : null)
  );
}

/* Open a URL in a new tab (used by the bookmark board). */
function openTab(url) {
  if (!(api && api.tabs && typeof api.tabs.create === "function")) return Promise.resolve(null);
  return asPromise((cb) => api.tabs.create({ url }, cb)).then((tab) => tab || null);
}
