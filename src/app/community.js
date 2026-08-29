// community.js — "Community Archive" controller.
//
// Loads every published post (across all families) from the database via
// data.js and renders the archive: a culture filter rail, a category rail, a
// featured memory and a paged grid of cards. Filtering and search run over the
// already-loaded set; nothing here writes to the database.
//
// Load order: dexie.js -> db.js -> app/ui.js -> app/data.js -> app/community.js

(function () {
  'use strict';

  var esc = ui.escapeHtml;

  // Culture chips shown up front, plus an overflow set behind "More". These are
  // presentational — a post whose culture isn't listed still shows under "All".
  var CULTURES = ['All', 'Korean', 'Chinese', 'Vietnamese', 'Greek', 'Indian', 'Filipino', 'Lebanese'];
  var MORE_CULTURES = ['Japanese', 'Mexican', 'Ethiopian', 'Polish', 'Italian', 'Irish'];

  // Category rail. `key` is matched against each post's bucket (see bucketFor).
  var CATEGORY_ICONS = {
    All: '<line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="4" y1="20" x2="14" y2="20"/>',
    Recipes: '<path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M8 12v9"/><path d="M17 3c-1.5 1.5-2 3-2 5s.5 3 2 4v9"/>',
    Stories: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    Traditions: '<path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 8v8l7 5 7-5V8"/>',
    Memories: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    Music: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V5l12-2v13"/>',
    'Family History': '<path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-8 5"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'
  };
  var CATEGORIES = [
    { key: 'All', label: 'All' },
    { key: 'Recipes', label: 'Recipes' },
    { key: 'Stories', label: 'Stories' },
    { key: 'Traditions', label: 'Traditions' },
    { key: 'Memories', label: 'Memories' },
    { key: 'Music', label: 'Music' },
    { key: 'Family History', label: 'History' }
  ];

  // Fold a raw post category onto one of the rail buckets above.
  var BUCKET_BY_KEY = {
    recipe: 'Recipes', story: 'Stories', tradition: 'Traditions',
    memory: 'Memories', photo: 'Memories', music: 'Music',
    audio: 'Music', history: 'Family History'
  };
  function bucketFor(category) {
    return BUCKET_BY_KEY[ui.categoryKey(category)] || 'Memories';
  }

  var PAGE_SIZE = 8;
  var state = { culture: 'All', category: 'All', query: '', visible: PAGE_SIZE };
  var ITEMS = []; // shaped community posts, newest first

  var cultureListEl = document.getElementById('culture-list');
  var categoryListEl = document.getElementById('category-list');
  var featuredEl = document.getElementById('featured-memory');
  var gridEl = document.getElementById('post-grid');
  var emptyEl = document.getElementById('empty-state');
  var sectionTitleEl = document.getElementById('section-title');
  var sectionMetaEl = document.getElementById('section-meta');
  var searchInput = document.getElementById('search-input');
  var loadMoreRow = document.getElementById('load-more-row');
  var loadMoreBtn = document.getElementById('load-more-btn');

  function iconSvg(key) {
    var path = CATEGORY_ICONS[key];
    if (!path) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  // ----- Shape a PostView from data.js into what this page renders ----------

  function toItem(post, index) {
    return {
      id: post.id,
      title: post.title,
      type: ui.categoryLabel(post.category),
      culture: post.culture || '',
      bucket: bucketFor(post.category),
      desc: post.description || '',
      contributor: post.contributor ? 'by ' + post.contributor : '',
      image: post.imageSrc || null,
      category: post.category,
      featured: index === 0 // newest published post is the featured one
    };
  }

  // ----- Filter rails ----------------------------------------------------

  function renderCultureList() {
    cultureListEl.innerHTML = '';
    CULTURES.forEach(function (culture) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.className = 'culture-chip';
      btn.type = 'button';
      btn.textContent = culture;
      btn.setAttribute('aria-pressed', String(state.culture === culture));
      btn.addEventListener('click', function () {
        state.culture = culture; state.visible = PAGE_SIZE;
        renderCultureList(); renderAll();
      });
      li.appendChild(btn);
      cultureListEl.appendChild(li);
    });

    var moreLi = document.createElement('li');
    moreLi.style.position = 'relative';
    var moreBtn = document.createElement('button');
    moreBtn.className = 'culture-chip more-chip';
    moreBtn.type = 'button';
    moreBtn.innerHTML = 'More <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    var dropdown = document.createElement('div');
    dropdown.className = 'more-dropdown';
    MORE_CULTURES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = c;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        state.culture = c; state.visible = PAGE_SIZE;
        dropdown.classList.remove('open');
        renderCultureList(); renderAll();
      });
      dropdown.appendChild(b);
    });
    moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    moreLi.appendChild(moreBtn);
    moreLi.appendChild(dropdown);
    cultureListEl.appendChild(moreLi);
  }
  document.addEventListener('click', function () {
    var open = document.querySelectorAll('.more-dropdown.open');
    Array.prototype.forEach.call(open, function (d) { d.classList.remove('open'); });
  });

  function renderCategoryList() {
    categoryListEl.innerHTML = '';
    CATEGORIES.forEach(function (cat) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.className = 'category-item';
      btn.type = 'button';
      btn.setAttribute('aria-current', String(state.category === cat.key));
      btn.innerHTML = iconSvg(cat.key) + '<span>' + esc(cat.label) + '</span>';
      btn.addEventListener('click', function () {
        state.category = cat.key; state.visible = PAGE_SIZE;
        renderCategoryList(); renderAll();
      });
      li.appendChild(btn);
      categoryListEl.appendChild(li);
    });
  }

  // ----- Filtering -----------------------------------------------------

  function matchesFilters(item) {
    var cultureOk = state.culture === 'All' || item.culture === state.culture;
    var categoryOk = state.category === 'All' || item.bucket === state.category;
    var queryOk = true;
    var q = state.query.trim().toLowerCase();
    if (q) {
      queryOk = [item.title, item.desc, item.culture, item.type].join(' ').toLowerCase().indexOf(q) !== -1;
    }
    return cultureOk && categoryOk && queryOk;
  }

  function sectionTitleFor() {
    if (state.query.trim()) return 'Results for "' + state.query.trim() + '"';
    var hasCulture = state.culture !== 'All';
    var hasCategory = state.category !== 'All';
    if (hasCulture && hasCategory) return state.category + ' from ' + state.culture + ' families';
    if (hasCulture) return 'Contributions from ' + state.culture + ' families';
    if (hasCategory) return state.category;
    return 'All Contributions';
  }

  // ----- Rendering ----------------------------------------------------

  function renderFeatured(items) {
    var featured = items.filter(function (p) { return p.featured; })[0];
    if (!featured) { featuredEl.hidden = true; featuredEl.innerHTML = ''; return; }

    var media = featured.image
      ? '<img class="featured-image" src="' + esc(featured.image) + '" alt="' + esc(featured.title) + '">'
      : '<div class="featured-image media-placeholder" role="img" aria-label="' + esc(featured.title) + '">' +
          iconSvg(featured.bucket) + '</div>';

    featuredEl.hidden = false;
    featuredEl.innerHTML =
      media +
      '<div class="featured-body">' +
        '<p class="featured-eyebrow">Featured Memory</p>' +
        '<h3>' + esc(featured.title) + '</h3>' +
        '<p class="featured-tags">' + esc([featured.culture, featured.type].filter(Boolean).join(' · ')) + '</p>' +
        '<p class="excerpt">' + esc(featured.desc) + '</p>' +
        '<a class="featured-link" href="post.html?id=' + encodeURIComponent(featured.id) + '&from=community">Read the full story ' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' +
        '</a>' +
      '</div>';
  }

  function renderGrid(items) {
    var rest = items.filter(function (p) { return !p.featured; });
    var shown = rest.slice(0, state.visible);
    gridEl.innerHTML = '';
    emptyEl.hidden = items.length !== 0;

    shown.forEach(function (item) {
      var card = document.createElement('a');
      card.className = 'archive-card';
      card.href = 'post.html?id=' + encodeURIComponent(item.id) + '&from=community';

      var media = item.image
        ? '<img class="archive-image" src="' + esc(item.image) + '" alt="' + esc(item.title) + '">'
        : '<div class="archive-image media-placeholder" role="img" aria-label="' + esc(item.title) + '">' +
            iconSvg(item.bucket) + '</div>';

      card.innerHTML =
        '<div class="archive-image-wrap">' + media + '</div>' +
        '<div class="archive-caption">' +
          '<h3>' + esc(item.title) + '</h3>' +
          '<div class="caption-row">' +
            '<p class="by">' + esc(item.contributor) + '</p>' +
            '<span class="type-icon">' + iconSvg(item.bucket) + '</span>' +
          '</div>' +
        '</div>';
      gridEl.appendChild(card);
    });

    loadMoreRow.hidden = rest.length <= state.visible;
  }

  function renderAll() {
    var filtered = ITEMS.filter(matchesFilters);
    sectionTitleEl.textContent = sectionTitleFor();

    var cultureLabel = state.culture === 'All' ? 'All cultures' : state.culture;
    var categoryLabel = state.category === 'All' ? 'All categories' : state.category;
    sectionMetaEl.textContent = cultureLabel + ' · ' + categoryLabel + ' · ' +
      filtered.length + ' contribution' + (filtered.length === 1 ? '' : 's');

    var showFeatured = !state.query.trim() && filtered.some(function (p) { return p.featured; });
    renderFeatured(showFeatured ? filtered : []);
    renderGrid(filtered);
  }

  function renderErrorState() {
    featuredEl.hidden = true;
    loadMoreRow.hidden = true;
    gridEl.innerHTML = '';
    sectionMetaEl.textContent = '';
    emptyEl.hidden = false;
    emptyEl.innerHTML =
      '<h3>Couldn’t load the archive</h3>' +
      '<p>Something went wrong reading the community archive. Please refresh to try again.</p>';
  }

  // ----- Boot --------------------------------------------------------

  searchInput.addEventListener('input', function (e) {
    state.query = e.target.value; state.visible = PAGE_SIZE;
    renderAll();
  });
  loadMoreBtn.addEventListener('click', function () {
    state.visible += PAGE_SIZE;
    renderAll();
  });

  async function init() {
    renderCultureList();
    renderCategoryList();

    try {
      var view = await window.appData.loadCommunityView();
      ITEMS = view.posts.map(toItem);
      renderAll();
    } catch (err) {
      console.error('Community archive failed to load:', err);
      renderErrorState();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
