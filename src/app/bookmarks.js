// bookmarks.js — the "Saved" set, stored per-browser in localStorage.
//
// There is no saved/bookmark column in the database schema, so the list of
// posts a person has saved lives in localStorage instead. Every page that shows
// a save button (post.html) or the saved list (saved.html) loads this file.
//
// No dependencies. Exposes a single global: `window.bookmarks`.
//
// Shape in storage (key "cornerstone.bookmarks"):
//   { "<post_id>": { source: "Family" | "Community", savedAt: <ms epoch> }, ... }

(function (global) {
  'use strict';

  var KEY = 'cornerstone.bookmarks';

  function readAll() {
    try {
      var raw = global.localStorage.getItem(KEY);
      var obj = raw ? JSON.parse(raw) : null;
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(map) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(map));
    } catch (e) {
      /* storage unavailable / full — saving is best-effort only */
    }
  }

  function normSource(source) {
    return source === 'Community' ? 'Community' : 'Family';
  }

  var bookmarks = {
    // Whole map, as stored.
    all: function () { return readAll(); },

    // Post ids (numbers), most recently saved first.
    ids: function () {
      var map = readAll();
      return Object.keys(map)
        .sort(function (a, b) { return (map[b].savedAt || 0) - (map[a].savedAt || 0); })
        .map(Number);
    },

    // [{ id, source, savedAt }], most recently saved first.
    entries: function () {
      var map = readAll();
      return bookmarks.ids().map(function (id) {
        return { id: id, source: map[String(id)].source, savedAt: map[String(id)].savedAt };
      });
    },

    has: function (id) { return Object.prototype.hasOwnProperty.call(readAll(), String(id)); },

    get: function (id) { return readAll()[String(id)] || null; },

    // Add or update a bookmark. Keeps the original savedAt if already present.
    set: function (id, source) {
      var map = readAll();
      var key = String(id);
      var existing = map[key];
      map[key] = {
        source: normSource(source),
        savedAt: existing && existing.savedAt ? existing.savedAt : Date.now()
      };
      writeAll(map);
    },

    remove: function (id) {
      var map = readAll();
      delete map[String(id)];
      writeAll(map);
    },

    // Flip saved state. Returns true if the post is now saved.
    toggle: function (id, source) {
      if (bookmarks.has(id)) { bookmarks.remove(id); return false; }
      bookmarks.set(id, source);
      return true;
    }
  };

  global.bookmarks = bookmarks;
})(window);
