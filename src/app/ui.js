// ui.js — small, framework-free view helpers shared by every page.
//
// No dependencies. Load order:
//   dexie.js -> ../db.js -> ui.js -> data.js -> <page>.js
//
// Exposes a single global: `window.ui`.

(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Line-icon path data keyed by a normalised category. Mirrors the mockups.
  var CATEGORY_ICONS = {
    recipe: '<path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M8 12v9"/><path d="M17 3c-1.5 1.5-2 3-2 5s.5 3 2 4v9"/>',
    story: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    memory: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    tradition: '<path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 8v8l7 5 7-5V8"/>',
    skill: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>',
    music: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V5l12-2v13"/>',
    audio: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-8 5"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    photo: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    _default: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'
  };

  var MISC_ICONS = {
    warning: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
    inbox: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><circle cx="18" cy="8" r="2.4"/><path d="M16 21c0-2.8 1.6-4.8 4-5.6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>',
    lock: '<rect x="3" y="11" width="18" height="10" rx="1"/><path d="M7 11V8a5 5 0 0 1 10 0v3"/>'
  };

  // Fold an assortment of raw category strings onto one of the known keys.
  function categoryKey(raw) {
    var c = String(raw || '').trim().toLowerCase();
    if (!c) return '_default';
    if (c.indexOf('recipe') === 0) return 'recipe';
    if (c.indexOf('stor') === 0) return 'story';
    if (c.indexOf('memor') === 0) return 'memory';
    if (c.indexOf('tradition') === 0 || c.indexOf('ritual') === 0 || c.indexOf('custom') === 0) return 'tradition';
    if (c.indexOf('skill') === 0 || c.indexOf('craft') === 0) return 'skill';
    if (c === 'music' || c === 'song') return 'music';
    if (c === 'audio' || c === 'recording') return 'audio';
    if (c.indexOf('histor') === 0) return 'history';
    if (c.indexOf('photo') === 0 || c === 'image') return 'photo';
    return '_default';
  }

  function titleCase(s) {
    s = String(s || '').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  // Display label for a category (falls back to "Memory").
  function categoryLabel(raw) {
    return titleCase(raw) || 'Memory';
  }

  function icon(paths, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths || '') + '</svg>';
  }

  function categoryIcon(raw, cls) {
    var k = categoryKey(raw);
    return icon(CATEGORY_ICONS[k] || CATEGORY_ICONS._default, cls);
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Date -> "12 May". Empty string when the value is not a real date.
  function dateLabel(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  // First letter of a name, for monogram avatars.
  function monogram(name) {
    var ch = String(name || '').trim().charAt(0);
    return ch ? ch.toUpperCase() : '?';
  }

  // Standard empty / error panel used across pages.
  function stateBlock(iconPaths, heading, message) {
    return '<div class="state-block">' +
      icon(iconPaths) +
      '<h3>' + escapeHtml(heading) + '</h3>' +
      '<p>' + escapeHtml(message) + '</p>' +
    '</div>';
  }

  // Fill in the shared topbar bits every page has: the family name in the
  // switcher (#familyName) and the monogram avatar (#avatarMonogram).
  // Missing values are left as the page's static fallback.
  function renderTopbar(opts) {
    opts = opts || {};
    var nameEl = document.getElementById('familyName');
    if (nameEl && opts.familyName) nameEl.textContent = opts.familyName;

    var avatarEl = document.getElementById('avatarMonogram');
    if (avatarEl && opts.userName) {
      avatarEl.textContent = monogram(opts.userName);
      avatarEl.setAttribute('aria-label', opts.userName + "'s profile");
    }
  }

  global.ui = {
    escapeHtml: escapeHtml,
    categoryKey: categoryKey,
    categoryLabel: categoryLabel,
    categoryIcon: categoryIcon,
    titleCase: titleCase,
    icon: icon,
    dateLabel: dateLabel,
    monogram: monogram,
    stateBlock: stateBlock,
    renderTopbar: renderTopbar,
    ICON: MISC_ICONS
  };
})(window);
