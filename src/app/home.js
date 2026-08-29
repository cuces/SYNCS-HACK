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

  function setupProfileImageUpload(userRecord) {
    var profileImageBtn = document.getElementById('profileImageBtn');
    var profileImageInput = document.getElementById('profileImageInput');
    var polaroidFill = document.getElementById('polaroidFill');

    if (!profileImageBtn || !profileImageInput || !userRecord) return;

    // Display existing profile image if available
    if (userRecord.profileImage) {
      var existingImg = new Image();
      existingImg.src = userRecord.profileImage;
      polaroidFill.innerHTML = '';
      polaroidFill.appendChild(existingImg);
      polaroidFill.classList.add('has-image');
    }

    // Handle button click to trigger file input
    profileImageBtn.addEventListener('click', function () {
      profileImageInput.click();
    });

    // Handle file selection
    profileImageInput.addEventListener('change', function (event) {
      var file = event.target.files[0];
      if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
      }

      var reader = new FileReader();
      reader.onload = async function (e) {
        var dataUrl = e.target.result;

        // Display the image immediately
        polaroidFill.innerHTML = '<img src="' + esc(dataUrl) + '" alt="Profile">';
        polaroidFill.classList.add('has-image');

        // Save to database
        try {
          if (userRecord.user_id) {
            await updateUserProfileImage(userRecord.user_id, dataUrl);
          }
        } catch (err) {
          console.error('Failed to save profile image:', err);
          alert('Failed to save your image. Please try again.');
        }
      };
      reader.onerror = function () {
        alert('Failed to read the image file.');
      };
      reader.readAsDataURL(file);
    });
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

      // Setup profile image upload
      setupProfileImageUpload(view.currentUser);

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
