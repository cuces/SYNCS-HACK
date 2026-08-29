// family.js — "My Family" board controller.
//
// Loads the current family, its members and its full board of posts from the
// database (via data.js) and renders them. The category chips and the searchable
// "Tags" dropdown filter the posts already on screen; nothing here writes to
// the database.

(function () {
  'use strict';

  var esc = ui.escapeHtml;

  // Active filters — the grid shows a card only when it matches BOTH.
  var activeCategory = 'all';
  var activeTag = null;

  // ----- Rendering -------------------------------------------------------

  function statsLine(stats) {
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
    return [
      plural(stats.members, 'member', 'members'),
      plural(stats.posts, 'memory preserved', 'memories preserved'),
      stats.shared + ' shared with the community'
    ].join(' · ');
  }

  function memberHtml(member) {
    var roleLine = member.role ? '<span class="role">' + esc(member.role) + '</span>' : '';
    return '' +
      '<div class="member">' +
        '<div class="avatar-lg" aria-hidden="true">' + esc(member.initial) + '</div>' +
        '<span>' + esc(member.name) + roleLine + '</span>' +
      '</div>';
  }

  var INVITE_MEMBER_HTML = '' +
    '<div class="member member-invite">' +
      '<div class="avatar-lg">' +
        ui.icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>') +
      '</div>' +
      '<span>Invite</span>' +
    '</div>';

  function typeLabel(post) {
    var main = ui.categoryLabel(post.category);
    return post.tag ? main + ' · ' + ui.titleCase(post.tag) : main;
  }

  function cardHtml(post) {
    var key = ui.categoryKey(post.category);

    var media = post.imageSrc
      ? '<img class="post-image" src="' + esc(post.imageSrc) + '" alt="' + esc(post.title) + '">'
      : '<div class="post-image media-placeholder" role="img" aria-label="' + esc(post.title) + '">' +
          ui.categoryIcon(post.category) +
        '</div>';

    var badge = post.isPublished
      ? '<span class="privacy-badge is-public">' + ui.icon(ui.ICON.globe) + 'Public</span>'
      : '<span class="privacy-badge">' + ui.icon(ui.ICON.lock) + 'Private</span>';

    var foot = [
      post.authorName ? '<span>by ' + esc(post.authorName) + '</span>' : '<span></span>',
      '<span>' + esc(ui.dateLabel(post.createdAt)) + '</span>'
    ].join('');

    var tagAttr = esc((post.tags || []).join('|'));

    return '' +
      '<a class="post-card" href="post.html?id=' + encodeURIComponent(post.id) + '&from=family" data-category="' + esc(key) + '" data-tags="' + tagAttr + '">' +
        '<div class="post-image-wrap">' + media + badge + '</div>' +
        '<div class="post-body">' +
          '<p class="post-type">' + esc(typeLabel(post)) + '</p>' +
          '<h3 class="post-title">' + esc(post.title) + '</h3>' +
          (post.description ? '<p class="post-desc">' + esc(post.description) + '</p>' : '') +
          '<p class="post-foot">' + foot + '</p>' +
        '</div>' +
      '</a>';
  }

  function renderGrid(container, posts) {
    if (!posts.length) {
      container.className = 'family-empty';
      container.innerHTML = ui.stateBlock(
        ui.ICON.inbox,
        'No memories preserved yet',
        "Add your family's first story, recipe or photo and it will appear on the board here."
      );
      return;
    }
    container.className = 'family-post-grid';
    container.innerHTML = posts.map(cardHtml).join('');
  }

  function renderError(container) {
    container.className = 'family-error';
    container.innerHTML = ui.stateBlock(
      ui.ICON.warning,
      "Couldn't load your family board",
      'Something went wrong reading the archive. Please refresh the page to try again.'
    );
  }

  // ----- Filters (operate on already-rendered cards) ------------------------

  // Re-apply both the category chip and the tag dropdown to every card.
  function applyFilters() {
    var cards = document.querySelectorAll('#familyGrid .post-card');
    Array.prototype.forEach.call(cards, function (card) {
      var catOk = activeCategory === 'all' || card.dataset.category === activeCategory;
      var cardTags = (card.dataset.tags || '').split('|');
      var tagOk = !activeTag || cardTags.indexOf(activeTag) !== -1;
      card.hidden = !(catOk && tagOk);
    });
  }

  function wireCategoryChips() {
    var chips = Array.prototype.slice.call(
      document.querySelectorAll('.filter-chip[data-filter]'));
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        activeCategory = chip.dataset.filter || 'all';
        applyFilters();
      });
    });
  }

  // The searchable "Tags" dropdown. `tags` is the distinct tag list.
  function wireTagFilter(tags) {
    var wrap = document.getElementById('tagFilter');
    var toggle = document.getElementById('tagFilterToggle');
    var panel = document.getElementById('tagFilterPanel');
    var search = document.getElementById('tagFilterSearch');
    var list = document.getElementById('tagFilterList');
    var label = document.getElementById('tagFilterLabel');
    if (!wrap || !toggle || !panel || !list || !search || !label) return;

    // "Any tag" resets, then one row per tag.
    var options = [{ value: null, text: 'Any tag' }].concat(
      tags.map(function (t) { return { value: t, text: ui.titleCase(t) }; }));

    function renderList(query) {
      var q = (query || '').trim().toLowerCase();
      var shown = options.filter(function (o) {
        return o.value === null || o.text.toLowerCase().indexOf(q) !== -1 || o.value.indexOf(q) !== -1;
      });
      if (!shown.length) {
        list.innerHTML = '<p class="tag-filter-empty">No tags match “' + esc(query) + '”.</p>';
        return;
      }
      list.innerHTML = shown.map(function (o) {
        var selected = (o.value === activeTag) || (o.value === null && activeTag === null);
        return '<button type="button" class="tag-filter-item" role="option" ' +
          'data-value="' + esc(o.value == null ? '' : o.value) + '" ' +
          'aria-selected="' + selected + '">' + esc(o.text) + '</button>';
      }).join('');
    }

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) { renderList(search.value); setTimeout(function () { search.focus(); }, 0); }
    }

    function pick(value) {
      activeTag = value || null;
      label.textContent = activeTag ? ui.titleCase(activeTag) : 'Tags';
      toggle.classList.toggle('has-active', !!activeTag);
      applyFilters();
      setOpen(false);
    }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(panel.hidden);
    });
    search.addEventListener('input', function () { renderList(search.value); });
    list.addEventListener('click', function (e) {
      var item = e.target.closest('.tag-filter-item');
      if (item) pick(item.dataset.value);
    });
    // Click outside / Esc closes the panel.
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) setOpen(false);
    });
  }

  // ----- Boot ----------------------------------------------------------

  async function init() {
    var headingName = document.getElementById('familyHeading');
    var statsEl = document.getElementById('familyStats');
    var membersEl = document.getElementById('membersRow');
    var gridEl = document.getElementById('familyGrid');

    wireCategoryChips();

    try {
      var view = await window.appData.loadFamilyView();

      var name = view.family && view.family.name ? view.family.name : 'Your family';
      ui.renderTopbar({ familyName: name, userName: view.currentUserName });
      headingName.textContent = name;
      statsEl.textContent = statsLine(view.stats);

      membersEl.innerHTML = view.members.map(memberHtml).join('') + INVITE_MEMBER_HTML;

      if (!view.family) {
        gridEl.className = 'family-empty';
        gridEl.innerHTML = ui.stateBlock(
          ui.ICON.users,
          'No family yet',
          "You're not part of a family archive yet. Once a family is created, its memories show up here."
        );
        return;
      }

      renderGrid(gridEl, view.posts);

      // Tag dropdown: everything on the board, plus any custom values typed in
      // the "Add Memory" form (add-memory.js keeps a de-duped list).
      var stored = [];
      try { stored = JSON.parse(localStorage.getItem('cornerstone:customTags') || '[]'); }
      catch (e) { stored = []; }
      var merged = Array.from(new Set((view.allTags || []).concat(stored))).sort();
      var tagFilterWrap = document.getElementById('tagFilter');
      if (merged.length) {
        wireTagFilter(merged);
      } else if (tagFilterWrap) {
        tagFilterWrap.hidden = true;
      }
    } catch (err) {
      console.error('Family board failed to load data:', err);
      renderError(gridEl);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
