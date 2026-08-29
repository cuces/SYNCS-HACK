// family.js — "My Family" board controller.
//
// Loads the current family, its members and its full board of posts from the
// database (via data.js) and renders them. The category chips and the searchable
// "Tags" dropdown filter the posts already on screen; nothing here writes to
// the database.

(function () {
  'use strict';

  var esc = ui.escapeHtml;

  // Active filters — the grid shows a card only when it matches ALL of them.
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
    '<button type="button" class="member member-invite" data-invite-open>' +
      '<div class="avatar-lg">' +
        ui.icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>') +
      '</div>' +
      '<span>Invite</span>' +
    '</button>';

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

  // Re-apply the category chip + the custom tags dropdown to every card.
  function applyFilters() {
    var cards = document.querySelectorAll('#familyGrid .post-card');
    Array.prototype.forEach.call(cards, function (card) {
      var cardTags = (card.dataset.tags || '').split('|');
      var catOk = activeCategory === 'all' || card.dataset.category === activeCategory;
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

  // A searchable single-select dropdown filter. `cfg`:
  //   prefix       — element id prefix (<prefix>Filter, <prefix>FilterToggle, …)
  //   values       — the list of options (strings)
  //   anyLabel     — text for the "clear" row
  //   defaultLabel — button text when nothing is selected
  //   onPick(value) — called with the chosen value (or null to clear)
  //   isSelected()  — returns the currently-selected value, for highlighting
  function wireDropdownFilter(cfg) {
    var wrap = document.getElementById(cfg.prefix + 'Filter');
    var toggle = document.getElementById(cfg.prefix + 'FilterToggle');
    var panel = document.getElementById(cfg.prefix + 'FilterPanel');
    var search = document.getElementById(cfg.prefix + 'FilterSearch');
    var list = document.getElementById(cfg.prefix + 'FilterList');
    var label = document.getElementById(cfg.prefix + 'FilterLabel');
    if (!wrap || !toggle || !panel || !search || !list || !label) return;
    if (!cfg.values.length) { wrap.hidden = true; return; }
    wrap.hidden = false;

    var options = [{ value: null, text: cfg.anyLabel }].concat(
      cfg.values.map(function (v) { return { value: v, text: ui.titleCase(v) }; }));

    function renderList(query) {
      var q = (query || '').trim().toLowerCase();
      var shown = options.filter(function (o) {
        return o.value === null ||
          o.text.toLowerCase().indexOf(q) !== -1 ||
          o.value.indexOf(q) !== -1;
      });
      if (!shown.length) {
        list.innerHTML = '<p class="tag-filter-empty">Nothing matches “' + esc(query) + '”.</p>';
        return;
      }
      var current = cfg.isSelected();
      list.innerHTML = shown.map(function (o) {
        var selected = o.value === current;
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
      var v = value || null;
      label.textContent = v ? ui.titleCase(v) : cfg.defaultLabel;
      toggle.classList.toggle('has-active', !!v);
      cfg.onPick(v);
      applyFilters();
      setOpen(false);
    }

    toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(panel.hidden); });
    search.addEventListener('input', function () { renderList(search.value); });
    list.addEventListener('click', function (e) {
      var item = e.target && e.target.closest ? e.target.closest('.tag-filter-item') : null;
      if (item) pick(item.dataset.value);
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
  }

  // ----- Invite family dialog -----------------------------------------------

  // Wires every [data-invite-open] control to the <dialog id="inviteDialog">.
  // No real email is sent — this is a static demo — so submitting just swaps to
  // an "Invitation sent" confirmation. Openers are matched by event delegation,
  // so the dynamically-rendered "Invite" member tile works too.
  function wireInviteDialog() {
    var dialog = document.getElementById('inviteDialog');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    var form = document.getElementById('inviteForm');
    var emailInput = document.getElementById('inviteEmail');
    var errorEl = document.getElementById('inviteError');
    var sentView = document.getElementById('inviteSentView');
    var sentEmailEl = document.getElementById('inviteSentEmail');

    function reset() {
      form.reset();
      errorEl.hidden = true;
      sentView.hidden = true;
      form.hidden = false;
    }
    function open() {
      if (dialog.open) return;
      reset();
      dialog.showModal();
      setTimeout(function () { emailInput.focus(); }, 0);
    }
    function close() { if (dialog.open) dialog.close(); }

    document.addEventListener('click', function (e) {
      var opener = e.target.closest ? e.target.closest('[data-invite-open]') : null;
      if (opener) { e.preventDefault(); open(); }
    });

    document.getElementById('inviteCancel').addEventListener('click', close);
    document.getElementById('inviteDialogClose').addEventListener('click', close);
    document.getElementById('inviteDone').addEventListener('click', close);

    // Click on the backdrop (the <dialog> itself, outside its content) closes it.
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorEl.hidden = false;
        emailInput.focus();
        return;
      }
      errorEl.hidden = true;
      sentEmailEl.textContent = email;
      form.hidden = true;
      sentView.hidden = false;
      document.getElementById('inviteDone').focus();
    });

    // Deep link: family.html#invite (e.g. from the Home page) opens it straight away.
    if (window.location.hash === '#invite') open();
  }

  // ----- Boot ----------------------------------------------------------

  async function init() {
    var headingName = document.getElementById('familyHeading');
    var statsEl = document.getElementById('familyStats');
    var membersEl = document.getElementById('membersRow');
    var gridEl = document.getElementById('familyGrid');

    wireCategoryChips();
    wireInviteDialog();

    try {
      var view = await window.appData.loadFamilyView();

      var name = view.family && view.family.name ? view.family.name : 'Your family';
      ui.renderTopbar({ familyName: name, userName: view.currentUserName });
      headingName.textContent = name;
      statsEl.textContent = statsLine(view.stats);

      var inviteNameEl = document.getElementById('inviteFamilyName');
      if (inviteNameEl) inviteNameEl.textContent = view.family && view.family.name ? name : 'your family';

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

      // Searchable dropdown, built from the free-text tag values on PUBLISHED
      // posts (see data.js). Hides itself when it has nothing to show.
      wireDropdownFilter({
        prefix: 'tag',
        values: view.customTags || [],
        anyLabel: 'Any tag',
        defaultLabel: 'Custom tags',
        isSelected: function () { return activeTag; },
        onPick: function (v) { activeTag = v; }
      });
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
