// family.js — "My Family" board controller.
//
// Loads the current family, its members and its full board of posts from the
// database (via data.js) and renders them. The category chips filter the posts
// that are already on screen; nothing here writes to the database.

(function () {
  'use strict';

  var esc = ui.escapeHtml;

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
      : '<div class="post-image post-image--placeholder" role="img" aria-label="' + esc(post.title) + '">' +
          ui.categoryIcon(post.category) +
        '</div>';

    var badge = post.isPublished
      ? '<span class="privacy-badge is-public">' + ui.icon(ui.ICON.globe) + 'Public</span>'
      : '<span class="privacy-badge">' + ui.icon(ui.ICON.lock) + 'Private</span>';

    var foot = [
      post.authorName ? '<span>by ' + esc(post.authorName) + '</span>' : '<span></span>',
      '<span>' + esc(ui.dateLabel(post.createdAt)) + '</span>'
    ].join('');

    return '' +
      '<article class="post-card" data-category="' + esc(key) + '">' +
        '<div class="post-image-wrap">' + media + badge + '</div>' +
        '<div class="post-body">' +
          '<p class="post-type">' + esc(typeLabel(post)) + '</p>' +
          '<h3 class="post-title">' + esc(post.title) + '</h3>' +
          (post.description ? '<p class="post-desc">' + esc(post.description) + '</p>' : '') +
          '<p class="post-foot">' + foot + '</p>' +
        '</div>' +
      '</article>';
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

  // ----- Category filter (operates on already-rendered cards) -----------

  function wireFilters() {
    var chips = Array.prototype.slice.call(document.querySelectorAll('.filter-chip'));
    var grid = document.getElementById('familyGrid');

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        var filter = chip.dataset.filter || 'all';
        var cards = grid.querySelectorAll('.post-card');
        Array.prototype.forEach.call(cards, function (card) {
          var match = filter === 'all' || card.dataset.category === filter;
          card.hidden = !match;
        });
      });
    });
  }

  // ----- Boot ----------------------------------------------------------

  async function init() {
    var topbarName = document.getElementById('familyName');
    var headingName = document.getElementById('familyHeading');
    var statsEl = document.getElementById('familyStats');
    var membersEl = document.getElementById('membersRow');
    var avatarEl = document.getElementById('avatarMonogram');
    var gridEl = document.getElementById('familyGrid');

    wireFilters();

    try {
      var view = await window.appData.loadFamilyView();

      var name = view.family && view.family.name ? view.family.name : 'Your family';
      topbarName.textContent = name;
      headingName.textContent = name;
      statsEl.textContent = statsLine(view.stats);

      if (view.currentUserName) {
        avatarEl.textContent = ui.monogram(view.currentUserName);
        avatarEl.setAttribute('aria-label', view.currentUserName + "'s profile");
      }

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
