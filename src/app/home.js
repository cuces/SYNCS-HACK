// home.js — homepage controller.
//
// Pulls the current family's most recent posts from the database (via data.js)
// and renders the "Recently added" section. Shows an empty state when there is
// nothing to display and an error state if the database cannot be read.
//
// Read-only: this page never creates, edits or deletes records.

(function () {
  'use strict';

  var esc = ui.escapeHtml;

  function cardHtml(post) {
    var media = post.imageSrc
      ? '<img class="recent-image" src="' + esc(post.imageSrc) + '" alt="' + esc(post.title) + '">'
      : '<div class="recent-image media-placeholder" role="img" aria-label="' + esc(post.title) + '">' +
          ui.categoryIcon(post.category) +
        '</div>';

    var byLine = post.authorName ? '<p class="by">by ' + esc(post.authorName) + '</p>' : '';

    return '' +
      '<a class="recent-card" href="post.html?id=' + encodeURIComponent(post.id) + '&from=family">' +
        '<div class="recent-image-wrap">' + media + '</div>' +
        '<div class="recent-caption">' +
          '<h3>' + esc(post.title) + '</h3>' +
          byLine +
          '<div class="type-row">' +
            '<span class="type-label">' + esc(ui.categoryLabel(post.category)) + '</span>' +
            '<span class="type-icon">' + ui.categoryIcon(post.category) + '</span>' +
          '</div>' +
        '</div>' +
      '</a>';
  }

  function renderRecent(container, posts) {
    if (!posts.length) {
      container.className = 'recent-empty';
      container.innerHTML = ui.stateBlock(
        ui.ICON.inbox,
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
    container.innerHTML = ui.stateBlock(
      ui.ICON.warning,
      "Couldn't load your archive",
      'Something went wrong reading the family archive. Please refresh the page to try again.'
    );
  }

  async function init() {
    if (!window.cornerStoneAuth || !window.cornerStoneAuth.getCurrentUser()) {
      window.location.href = 'login.html';
      return;
    }

    var welcomeNameEl = document.getElementById('welcomeName');
    var recentEl = document.getElementById('recentContainer');

    try {
      var view = await window.appData.loadHomeView({ limit: 4 });

      ui.renderTopbar({
        familyName: view.family && view.family.name,
        userName: view.currentUserName
      });
      if (view.currentUserName) {
        welcomeNameEl.textContent = ', ' + view.currentUserName;
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
