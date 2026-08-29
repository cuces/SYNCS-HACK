// post.js — memory detail page controller (post.html?id=<post_id>).
//
// Reads one post from the database (via data.js) and fills in the detail card.
// The card markup mirrors the design mockup in /design/post.html; this file
// only swaps in real data and wires the visual toggles. Nothing here writes to
// the database yet — the menu actions and the save / privacy buttons are
// appearance-only for now.
//
// Load order: dexie.js -> db.js -> app/ui.js -> app/data.js -> app/post.js

(function () {
  'use strict';

  var esc = ui.escapeHtml;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  var params = new URLSearchParams(window.location.search);
  // `from` (family | community) is carried on the link so the Saved page can
  // show where a bookmark came from.
  var currentFrom = params.get('from') === 'community' ? 'Community' : 'Family';

  // Date -> "12 May 2024". Empty string when the value is not a real date.
  function fullDate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function postIdFromUrl() {
    return params.get('id');
  }

  // ----- Rendering ----------------------------------------------------------

  function renderPost(post) {
    document.title = 'ROOTED — ' + post.title;

    // Hero image (or a category placeholder, matching the board cards).
    var img = document.getElementById('detailImage');
    if (post.imageSrc) {
      img.src = post.imageSrc;
      img.alt = post.title;
    } else {
      img.outerHTML = '<div class="detail-image media-placeholder" id="detailImage" ' +
        'role="img" aria-label="' + esc(post.title) + '">' +
        ui.categoryIcon(post.category) + '</div>';
    }

    // Title + category badge / label.
    document.getElementById('titleText').textContent = post.title;
    document.getElementById('typeBadge').innerHTML = ui.categoryIcon(post.category);
    document.getElementById('typeLabel').textContent =
      ui.categoryLabel(post.category) +
      (post.tag ? ' · ' + ui.titleCase(post.tag) : '');

    // Byline — no author photos in the schema, so use a monogram avatar.
    var name = post.authorName || 'Someone';
    document.getElementById('bylineAvatar').textContent = ui.monogram(name);
    document.getElementById('byName').textContent = 'By ' + name;
    var dl = fullDate(post.createdAt);
    document.getElementById('byDate').textContent = dl ? 'Added ' + dl : 'Added recently';

    // Description.
    document.getElementById('description').textContent = post.description || 'No description yet.';

    // Ingredients (only shown when the post carries them).
    if (post.ingredients && post.ingredients.length) {
      document.getElementById('ingredientsList').innerHTML =
        post.ingredients.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('');
      document.getElementById('ingredientsBlock').hidden = false;
    }

    // Steps (preview line + expandable full list).
    if (post.steps && post.steps.length) {
      var first = String(post.steps[0]);
      document.getElementById('stepsPreviewText').textContent =
        '1. ' + (first.length > 90 ? first.slice(0, 90).trim() + '…' : first);
      document.getElementById('steps-full').innerHTML = post.steps.map(function (s, n) {
        return '<li><span class="num">' + (n + 1) + '</span><span>' + esc(s) + '</span></li>';
      }).join('');
      document.getElementById('view-all-btn').hidden = post.steps.length < 2;
      document.getElementById('stepsBlock').hidden = false;
    }

    // Privacy footer reflects the stored publish state.
    setPrivacy(post.isPublished);

    // Save button reflects whether this post is already bookmarked.
    document.getElementById('save-btn').setAttribute(
      'aria-pressed', String(window.bookmarks.has(post.id)));
  }

  function renderMissing() {
    document.title = 'ROOTED — Memory not found';
    document.getElementById('postContent').hidden = true;
    var box = document.getElementById('postState');
    box.hidden = false;
    box.className = 'card-note';
    box.innerHTML =
      '<h2>Memory not found</h2>' +
      '<p>This memory may have been removed, or the link is missing its id.</p>' +
      '<a href="family.html">Back to memories</a>';
  }

  function renderError() {
    document.getElementById('postContent').hidden = true;
    var box = document.getElementById('postState');
    box.hidden = false;
    box.className = 'card-note';
    box.innerHTML =
      '<h2>Couldn’t load this memory</h2>' +
      '<p>Something went wrong reading the archive. Please refresh to try again.</p>' +
      '<a href="family.html">Back to memories</a>';
  }

  // ----- Visual toggles (appearance only, no persistence yet) --------------

  function setPrivacy(isPublic) {
    var priv = document.getElementById('privacy-private');
    var pub = document.getElementById('privacy-public');
    priv.setAttribute('aria-pressed', String(!isPublic));
    pub.setAttribute('aria-pressed', String(!!isPublic));
  }

  function wireToggles() {
    // Save / bookmark — persisted per-browser via bookmarks.js.
    var saveBtn = document.getElementById('save-btn');
    saveBtn.addEventListener('click', function () {
      var id = postIdFromUrl();
      if (!id) return;
      var nowSaved = window.bookmarks.toggle(id, currentFrom);
      saveBtn.setAttribute('aria-pressed', String(nowSaved));
    });

    // Expand the full step list.
    var viewAllBtn = document.getElementById('view-all-btn');
    var stepsPreview = document.getElementById('steps-preview');
    var stepsFull = document.getElementById('steps-full');
    viewAllBtn.addEventListener('click', function () {
      stepsFull.classList.add('open');
      stepsPreview.style.display = 'none';
    });

    // Privacy switch.
    document.getElementById('privacy-private').addEventListener('click', function () {
      setPrivacy(false);
    });
    document.getElementById('privacy-public').addEventListener('click', function () {
      setPrivacy(true);
    });

    // "..." menu.
    var menuBtn = document.getElementById('menu-btn');
    var menuDropdown = document.getElementById('menu-dropdown');
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = menuDropdown.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', function () {
      menuDropdown.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // ----- Boot ------------------------------------------------------------

  async function init() {
    wireToggles();

    try {
      var post = await window.appData.loadPostView(postIdFromUrl());
      if (!post) {
        renderMissing();
        return;
      }
      renderPost(post);
    } catch (err) {
      console.error('Memory detail failed to load:', err);
      renderError();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
