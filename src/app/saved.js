// saved.js — "Saved" board controller.
//
// The set of saved posts lives in localStorage (see bookmarks.js). This page
// reads that set, loads the matching posts from the database via data.js and
// renders them. The source tabs (All / My Family / Community) and the search
// box filter the already-loaded list. Unsaving updates localStorage.
//
// Load order: dexie.js -> db.js -> app/ui.js -> app/data.js -> app/bookmarks.js -> app/saved.js

(function () {
  'use strict';

  var esc = ui.escapeHtml;

  var CATEGORY_ICONS = {
    Recipes: '<path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M8 12v9"/><path d="M17 3c-1.5 1.5-2 3-2 5s.5 3 2 4v9"/>',
    Stories: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    Traditions: '<path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 8v8l7 5 7-5V8"/>',
    Memories: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    Music: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V5l12-2v13"/>',
    'Family History': '<path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-8 5"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'
  };
  var BUCKET_BY_KEY = {
    recipe: 'Recipes', story: 'Stories', tradition: 'Traditions',
    memory: 'Memories', photo: 'Memories', music: 'Music',
    audio: 'Music', history: 'Family History'
  };
  function bucketFor(category) {
    return BUCKET_BY_KEY[ui.categoryKey(category)] || 'Memories';
  }
  function iconSvg(key) {
    var path = CATEGORY_ICONS[key];
    if (!path) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  var state = { source: 'All', query: '' };
  var savedItems = []; // shaped items, in saved order

  var gridEl = document.getElementById('saved-grid');
  var emptyEl = document.getElementById('empty-state');
  var metaEl = document.getElementById('saved-meta');
  var searchInput = document.getElementById('search-input');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.source-tab'));

  function toItem(post) {
    var bucket = bucketFor(post.category);
    return {
      id: post.id,
      title: post.title,
      bucket: bucket,
      typeLabel: ui.categoryLabel(post.category),
      source: post.source === 'Community' ? 'Community' : 'Family',
      contributor: post.contributor ? 'by ' + post.contributor : '',
      image: post.imageSrc || null
    };
  }

  function matchesFilters(item) {
    var sourceOk = state.source === 'All' || item.source === state.source;
    var queryOk = true;
    var q = state.query.trim().toLowerCase();
    if (q) {
      queryOk = [item.title, item.contributor, item.bucket, item.typeLabel]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    }
    return sourceOk && queryOk;
  }

  function cardHtml(item) {
    var from = item.source === 'Community' ? 'community' : 'family';
    var href = 'post.html?id=' + encodeURIComponent(item.id) + '&from=' + from;

    var media = item.image
      ? '<img class="saved-image" src="' + esc(item.image) + '" alt="' + esc(item.title) + '">'
      : '<div class="saved-image media-placeholder" role="img" aria-label="' + esc(item.title) + '">' +
          iconSvg(item.bucket) + '</div>';

    var badgeClass = item.source === 'Family' ? 'family' : 'community';
    var badgeText = item.source === 'Family' ? 'My Family' : 'Community';

    return '' +
      '<article class="saved-card" data-id="' + esc(item.id) + '">' +
        '<div class="saved-image-wrap">' +
          media +
          '<span class="source-badge ' + badgeClass + '">' + badgeText + '</span>' +
          '<button class="unsave-btn" type="button" aria-label="Remove from saved" data-unsave="' + esc(item.id) + '">' +
            '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="saved-caption">' +
          '<a class="title-link" href="' + href + '"><h3>' + esc(item.title) + '</h3></a>' +
          '<div class="caption-row">' +
            '<p class="by">' + esc(item.contributor) + '</p>' +
            '<span class="type-icon">' + iconSvg(item.bucket) + '</span>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function render() {
    var filtered = savedItems.filter(matchesFilters);
    metaEl.textContent = filtered.length + ' saved ' + (filtered.length === 1 ? 'item' : 'items');
    emptyEl.hidden = filtered.length !== 0;
    gridEl.innerHTML = filtered.map(cardHtml).join('');

    Array.prototype.forEach.call(gridEl.querySelectorAll('[data-unsave]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var id = btn.getAttribute('data-unsave');
        var card = gridEl.querySelector('[data-id="' + id + '"]');
        if (card) card.classList.add('removing');
        window.bookmarks.remove(id);
        setTimeout(function () {
          savedItems = savedItems.filter(function (it) { return String(it.id) !== String(id); });
          render();
        }, 180);
      });
    });
  }

  function renderError() {
    gridEl.innerHTML = '';
    metaEl.textContent = '';
    emptyEl.hidden = false;
    emptyEl.innerHTML =
      '<h3>Couldn’t load your saved items</h3>' +
      '<p>Something went wrong reading the archive. Please refresh to try again.</p>';
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.setAttribute('aria-pressed', String(t === tab)); });
      state.source = tab.getAttribute('data-source') || 'All';
      render();
    });
  });

  searchInput.addEventListener('input', function (e) {
    state.query = e.target.value;
    render();
  });

  async function init() {
    try {
      var entries = window.bookmarks.entries();
      var view = await window.appData.loadSavedView(entries);
      savedItems = view.items.map(toItem);
      render();
    } catch (err) {
      console.error('Saved board failed to load:', err);
      renderError();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
