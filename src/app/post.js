// post.js — memory detail page controller (post.html?id=<post_id>).
//
// Reads one post from the database (via data.js) and fills in the detail card.
// The privacy switch writes `is_published` back to the database (setPostPublished
// in db.js); the "..." menu actions are still appearance-only for now.
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
    document.title = 'Corner Stone — ' + post.title;

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
    document.title = 'Corner Stone — Memory not found';
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

  // ----- Toggles -----------------------------------------------------------

  function setPrivacy(isPublic) {
    var priv = document.getElementById('privacy-private');
    var pub = document.getElementById('privacy-public');
    if (!priv || !pub) return;
    priv.setAttribute('aria-pressed', String(!isPublic));
    pub.setAttribute('aria-pressed', String(!!isPublic));
  }

  function toast(message) {
    var el = document.getElementById('postToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'postToast';
      el.className = 'post-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  var savingPrivacy = false;

  // Persist the community-visibility choice to the database so it sticks after
  // you leave the page (and shows up on the family / community boards). Reads
  // the row back afterwards so the buttons reflect what's actually stored.
  async function savePrivacy(isPublic) {
    var id = Number(postIdFromUrl());
    if (!id || savingPrivacy) return;
    if (typeof setPostPublished !== 'function') {
      console.error('setPostPublished missing — is db.js loaded?');
      return;
    }
    savingPrivacy = true;
    setPrivacy(isPublic); // optimistic
    try {
      await setPostPublished(id, isPublic);
      var row = typeof getPostById === 'function' ? await getPostById(id) : null;
      var storedPublic = row ? (row.is_published === 1 || row.is_published === true) : isPublic;
      setPrivacy(storedPublic);
      toast(storedPublic ? 'Shared to the community' : 'Set to private');
    } catch (err) {
      console.error('Could not update visibility:', err);
      setPrivacy(!isPublic); // revert
      toast("Couldn't update — try again");
    } finally {
      savingPrivacy = false;
    }
  }

  function wireToggles() {
    // "Extend memory" — start a new memory that branches from this one. The
    // form (add-memory) reads ?adaptedFrom and sets `adapted_from` on save, so
    // the new memory shows up as a child in the lineage graph + map.
    var extendBtn = document.getElementById('extend-btn');
    var id = postIdFromUrl();
    if (extendBtn && id) {
      extendBtn.href = 'add-memory.html?adaptedFrom=' + encodeURIComponent(id);
    }

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

    // Privacy switch — persisted to the database. Delegated off the footer so
    // it keeps working regardless of how the buttons get re-rendered.
    var footer = document.querySelector('.privacy-footer');
    if (footer) {
      footer.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.privacy-btn') : null;
        if (!btn) return;
        savePrivacy(btn.id === 'privacy-public');
      });
    }

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
