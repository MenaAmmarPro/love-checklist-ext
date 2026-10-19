/* Love Checklist — popup logic.
 *
 * All state lives in extension storage under `mena-checklist` as an array of
 * `{ id, text, done }`. The pure helpers are exposed on `window.MenaChecklist`
 * so they can be unit-tested without a browser.
 */
(function () {
  "use strict";

  var KEY = "mena-checklist";

  var DEFAULTS = [
    "Say good morning with a heart",
    "Send one reason I love you",
    "Plan our next call",
    "Try a new pizza place together"
  ];

  var seq = 0;
  function uid() {
    seq += 1;
    return "c" + Date.now().toString(36) + "-" + seq.toString(36);
  }

  function clean(text) {
    return String(text == null ? "" : text).trim().slice(0, 120);
  }

  /* Coerce anything we read back from storage into a well-formed list. */
  function normalize(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (item) {
      if (!item || typeof item !== "object") return;
      var text = clean(item.text);
      if (!text) return;
      out.push({
        id: typeof item.id === "string" && item.id ? item.id : uid(),
        text: text,
        done: !!item.done
      });
    });
    return out;
  }

  function addItem(list, text) {
    var t = clean(text);
    if (!t) return list;
    return list.concat([{ id: uid(), text: t, done: false }]);
  }

  function toggleItem(list, id) {
    return list.map(function (item) {
      return item.id === id ? { id: item.id, text: item.text, done: !item.done } : item;
    });
  }

  function removeItem(list, id) {
    return list.filter(function (item) {
      return item.id !== id;
    });
  }

  function clearDone(list) {
    return list.filter(function (item) {
      return !item.done;
    });
  }

  function defaultList() {
    return normalize(
      DEFAULTS.map(function (text) {
        return { text: text };
      })
    );
  }

  function counts(list) {
    var total = list.length;
    var done = list.filter(function (item) {
      return item.done;
    }).length;
    return { total: total, done: done, left: total - done, label: done + " of " + total + " done" };
  }

  var MenaChecklist = {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    uid: uid,
    normalize: normalize,
    addItem: addItem,
    toggleItem: toggleItem,
    removeItem: removeItem,
    clearDone: clearDone,
    defaultList: defaultList,
    counts: counts
  };

  if (typeof window !== "undefined") window.MenaChecklist = MenaChecklist;

  /* ------------------------------------------------------------------ */
  /* DOM wiring (skipped entirely when there is no document, e.g. tests) */
  /* ------------------------------------------------------------------ */
  function persist(list) {
    return storageSet(KEY, list);
  }

  function render(items) {
    var listEl = document.getElementById("cl-list");
    var countEl = document.getElementById("cl-count");
    var c = counts(items);
    if (countEl) countEl.textContent = c.label;
    if (!listEl) return;

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "cl-item" + (item.done ? " is-done" : "");

      var label = document.createElement("label");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.checked = item.done;
      box.setAttribute("aria-label", item.text);
      box.addEventListener("change", function () {
        state = toggleItem(state, item.id);
        persist(state);
        render(state);
      });

      var span = document.createElement("span");
      span.className = "cl-text";
      span.textContent = item.text;

      label.appendChild(box);
      label.appendChild(span);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "cl-del";
      del.textContent = "\u00d7";
      del.title = "Remove";
      del.setAttribute("aria-label", "Remove " + item.text);
      del.addEventListener("click", function () {
        state = removeItem(state, item.id);
        persist(state);
        render(state);
      });

      li.appendChild(label);
      li.appendChild(del);
      listEl.appendChild(li);
    });
  }

  var state = [];

  function init() {
    var form = document.getElementById("cl-form");
    var input = document.getElementById("cl-input");
    var clearBtn = document.getElementById("cl-clear-done");
    var resetBtn = document.getElementById("cl-reset");

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var value = input ? input.value : "";
        state = addItem(state, value);
        persist(state);
        if (input) input.value = "";
        render(state);
        if (input) input.focus();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        state = clearDone(state);
        persist(state);
        render(state);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        state = defaultList();
        persist(state);
        render(state);
      });
    }

    storageGet(KEY).then(function (saved) {
      state = Array.isArray(saved) ? normalize(saved) : defaultList();
      render(state);
    });
  }

  if (typeof document !== "undefined" && document && typeof document.getElementById === "function") {
    if (document.readyState === "loading" && typeof document.addEventListener === "function") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
