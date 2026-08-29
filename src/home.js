// home.js — homepage controller.
//
// Pulls the current family's most recent posts from the database (via data.js)
// and renders the "Recently added" section. Shows an empty state when there is
// nothing to display and an error state if the database cannot be read.
//
// Read-only: this page never creates, edits or deletes records.

(function () {
  'use strict';

  // ----- Category -> label + icon -------------------------------------------
  // Line icons mirror the visual language of design/home.html.
  var ICONS = {
    recipe: '<path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M8 12v9"/><path d="M17 3c-1.5 1.5-2 3-2 5s.5 3 2 4v9"/>',
    story: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    memory: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    tradition: '<path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 8v8l7 5 7-5V8"/>',
    music: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V5l12-2v13"/>',
    audio: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-8 5"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    photo: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    _default: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'
  };

  // Map assorted raw category strings onto a known key.
  function categoryKey(raw) {
    var c = String(raw || '').trim().toLowerCase();
    if (!c) return '_default';
    if (c.indexOf('recipe') === 0) return 'recipe';
    if (c.indexOf('stor') === 0) return 'story';
    if (c.indexOf('memor') === 0) return 'memory';
    if (c.indexOf('tradition') === 0) return 'tradition';
    if (c === 'music' || c === 'song') return 'music';
    if (c === 'audio' || c === 'recording') return 'audio';
    if (c.indexOf('histor') === 0 || c.indexOf('family history') === 0) return 'history';
    if (c.indexOf('photo') === 0 || c === 'image') return 'photo';
    return '_default';
  }

  function categoryLabel(raw) {
    var c = String(raw || '').trim();
    if (!c) return 'Memory';
    return c.charAt(0).toUpperCase() + c.slice(1);
  }

  function svg(paths, extraClass) {
    return '<svg class="' + (extraClass || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ----- Rendering ---------------------------------------------------------

  function cardHtml(post) {
    var key = categoryKey(post.category);
    var label = categoryLabel(post.category);

    var media = post.imageSrc
      ? '<img class="recent-image" src="' + escapeHtml(post.imageSrc) + '" alt="' + escapeHtml(post.title) + '">'
      : '<div class="recent-image recent-image--placeholder" role="img" aria-label="' + escapeHtml(post.title) + '">' +
          svg(ICONS[key] || ICONS._default) +
        '</div>';

    var byLine = post.authorName
      ? '<p class="by">by ' + escapeHtml(post.authorName) + '</p>'
      : '';

    return '' +
      '<article class="recent-card">' +
        '<div class="recent-image-wrap">' + media + '</div>' +
        '<div class="recent-caption">' +
          '<h3>' + escapeHtml(post.title) + '</h3>' +
          byLine +
          '<div class="type-row">' +
            '<span class="type-label">' + escapeHtml(label) + '</span>' +
            '<span class="type-icon">' + svg(ICONS[key] || ICONS._default) + '</span>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function stateHtml(iconPaths, heading, message) {
    return '<div class="state-block">' +
      svg(iconPaths) +
      '<h3>' + escapeHtml(heading) + '</h3>' +
      '<p>' + escapeHtml(message) + '</p>' +
    '</div>';
  }

  function renderRecent(container, posts) {
    if (!posts.length) {
      container.className = 'recent-empty';
      container.innerHTML = stateHtml(
        '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
        'No memories yet',
        "When your family adds stories, recipes and photos, they'll show up here."
      );
      return;
    }
    container.className = 'recent-grid';
    container.innerHTML = posts.map(cardHtml).join('');
  }

  function renderError(container) {
    container.className = 'recent-error';
    container.innerHTML = stateHtml(
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
      "Couldn't load your archive",
      'Something went wrong reading the family archive. Please refresh the page to try again.'
    );
  }

  // ----- Boot ------------------------------------------------------------

  async function init() {
    var familyNameEl = document.getElementById('familyName');
    var welcomeNameEl = document.getElementById('welcomeName');
    var avatarEl = document.getElementById('avatarMonogram');
    var recentEl = document.getElementById('recentContainer');

    try {
      var view = await window.appData.loadHomeView({ limit: 4 });

      if (view.family && view.family.name) {
        familyNameEl.textContent = view.family.name;
      }

      if (view.currentUserName) {
        welcomeNameEl.textContent = ', ' + view.currentUserName;
        avatarEl.textContent = view.currentUserName.trim().charAt(0).toUpperCase();
        avatarEl.setAttribute('aria-label', view.currentUserName + "'s profile");
      }

      renderRecent(recentEl, view.recentPosts);
    } catch (err) {
      console.error('Homepage failed to load data:', err);
      renderError(recentEl);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
