/**
 * add-memory.js — create a new family memory.
 *
 * Rich-text-ish editor (bold / italic / underline / bullets), inline image
 * uploads, and persistence straight into the shared archive database via the
 * helpers in db.js (Dexie / IndexedDB — the same store every other page reads).
 *
 * Load order: dexie.js -> db.js -> geo.js -> add-memory.js
 */

// ============================================
// DOM ELEMENTS
// ============================================
const form = document.getElementById('memoryForm');
const editor = document.getElementById('editor');
const boldBtn = document.getElementById('boldBtn');
const italicBtn = document.getElementById('italicBtn');
const underlineBtn = document.getElementById('underlineBtn');
const bulletBtn = document.getElementById('bulletBtn');
const imageBtn = document.getElementById('imageBtn');
const imageInput = document.getElementById('imageInput');
const imageGallery = document.getElementById('imageGallery');
const cancelBtn = document.getElementById('cancelBtn');
const customCuisineInput = document.getElementById('customCuisine');
const cuisineRadios = document.querySelectorAll('input[name="cuisine"]');
const countrySelect = document.getElementById('country');

// Track active formatting states
const activeFormats = { bold: false, italic: false, underline: false };

// Image storage — data URLs, first one becomes the post's `file` (cover image).
let uploadedImages = [];

// Maps the form's radio values onto the category vocabulary db.js / ui.js use.
const CATEGORY_BY_TYPE = {
  recipes: 'recipe',
  stories: 'story',
  skills: 'skill',
  custom: 'memory'
};

// ============================================
// CUSTOM CUISINE HANDLING
// ============================================
function handleCuisineChange() {
  const customCuisineRadio = document.querySelector('input[name="cuisine"][value="custom-cuisine"]');
  if (customCuisineRadio.checked) {
    customCuisineInput.classList.remove('hidden');
    customCuisineInput.focus();
  } else {
    customCuisineInput.classList.add('hidden');
  }
}
cuisineRadios.forEach((radio) => radio.addEventListener('change', handleCuisineChange));

// ============================================
// IMAGE HANDLING
// ============================================
imageInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  for (let file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        uploadedImages.push({ id: Date.now() + Math.random(), src: event.target.result, name: file.name });
        renderImageGallery();
      };
      reader.readAsDataURL(file);
    }
  }
  imageInput.value = '';
});

function renderImageGallery() {
  imageGallery.innerHTML = uploadedImages.map((img) => `
    <div class="image-item" title="${img.name}">
      <img src="${img.src}" alt="${img.name}">
      <button type="button" class="image-remove-btn" data-id="${img.id}" title="Remove image">×</button>
    </div>
  `).join('');

  imageGallery.querySelectorAll('.image-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = parseFloat(btn.getAttribute('data-id'));
      uploadedImages = uploadedImages.filter((img) => img.id !== id);
      renderImageGallery();
    });
  });
}

imageBtn.addEventListener('click', (e) => {
  e.preventDefault();
  imageInput.click();
});

// ============================================
// FORMATTING TOOLBAR
// ============================================
function applyFormat(command, value = null) {
  document.execCommand(command, false, value);
  editor.focus();
}

function updateToolbarState() {
  activeFormats.bold = document.queryCommandState('bold');
  activeFormats.italic = document.queryCommandState('italic');
  activeFormats.underline = document.queryCommandState('underline');
  boldBtn.classList.toggle('active', activeFormats.bold);
  italicBtn.classList.toggle('active', activeFormats.italic);
  underlineBtn.classList.toggle('active', activeFormats.underline);
}

boldBtn.addEventListener('click', (e) => { e.preventDefault(); applyFormat('bold'); updateToolbarState(); });
italicBtn.addEventListener('click', (e) => { e.preventDefault(); applyFormat('italic'); updateToolbarState(); });
underlineBtn.addEventListener('click', (e) => { e.preventDefault(); applyFormat('underline'); updateToolbarState(); });
bulletBtn.addEventListener('click', (e) => { e.preventDefault(); applyFormat('insertUnorderedList'); updateToolbarState(); });

editor.addEventListener('mouseup', updateToolbarState);
editor.addEventListener('keyup', updateToolbarState);
editor.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b') { e.preventDefault(); applyFormat('bold'); updateToolbarState(); }
    else if (e.key === 'i') { e.preventDefault(); applyFormat('italic'); updateToolbarState(); }
    else if (e.key === 'u') { e.preventDefault(); applyFormat('underline'); updateToolbarState(); }
  }
});

// ============================================
// DATABASE CONTEXT
// ============================================

/**
 * There is no auth yet, so "the current family" is the first family row and the
 * author is that family's first member. Both are created on first use so a fresh
 * browser can still save a memory.
 */
async function resolveContext() {
  const families = await getFamilies();
  const familyId = families.length ? families[0].family_id : await createFamily('Your family');

  const members = await getUsersByFamily(familyId);
  const posterId = members.length
    ? members[0].user_id
    : await createUser({ name: 'You', family_id: familyId, email: null, phone: null });

  return { familyId, posterId };
}

// ============================================
// FORM SUBMISSION
// ============================================
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('memoryTitle').value.trim();
  // Store the description as plain text — the board and detail pages render it
  // as text, so keeping HTML out avoids escaping surprises.
  const description = (editor.innerText || '').trim();
  const memoryTypeEl = document.querySelector('input[name="memoryType"]:checked');
  const cuisineEl = document.querySelector('input[name="cuisine"]:checked');
  const memoryType = memoryTypeEl ? memoryTypeEl.value : '';
  const cuisine = cuisineEl ? cuisineEl.value : '';
  const customCuisine = cuisine === 'custom-cuisine' ? customCuisineInput.value.trim() : '';
  const visibility = document.getElementById('visibility').value;
  const country = countrySelect ? countrySelect.value : '';

  if (!title) return showError('Please enter a title for your memory.');
  if (!memoryType) return showError('Please choose a memory type.');
  if (!cuisine) return showError('Please choose a cuisine / culture.');
  if (cuisine === 'custom-cuisine' && !customCuisine) return showError('Please name the custom culture.');
  if (!description) return showError('Please write something in the description.');

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    const { familyId, posterId } = await resolveContext();

    // Culture tag: the picked chip, or the free-text value for "Custom".
    const cultureTag = (cuisine === 'custom-cuisine' ? customCuisine : cuisine).toLowerCase();
    // Country → coordinates, exactly the way the map view expects them.
    const coords = country && typeof countryToLatLng === 'function' ? countryToLatLng(country) : null;

    await createPost({
      poster_id: posterId,
      family_id: familyId,
      title: title,
      description: description,
      file: uploadedImages.length ? uploadedImages[0].src : null,
      tags: cultureTag ? [cultureTag] : [],
      category: CATEGORY_BY_TYPE[memoryType] || 'memory',
      // getPublishedPosts() queries is_published === 1, so use 1 / 0 here.
      is_published: visibility === 'community-wide' ? 1 : 0,
      country: country || null,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null
    });

    showSuccess('Memory saved.');
    const destination = visibility === 'community-wide' ? 'community.html' : 'family.html';
    setTimeout(() => { window.location.href = destination; }, 900);
  } catch (error) {
    console.error('Error saving memory:', error);
    showError('Failed to save memory. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

cancelBtn.addEventListener('click', () => {
  if (confirm('Discard this memory?')) window.location.href = 'family.html';
});

// ============================================
// NOTIFICATIONS
// ============================================
function flash(message, kind) {
  let el = document.getElementById('formFlash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'formFlash';
    el.className = 'form-flash';
    form.prepend(el);
  }
  el.textContent = message;
  el.dataset.kind = kind;
  el.hidden = false;
}
function showError(message) { flash(message, 'error'); return false; }
function showSuccess(message) { flash(message, 'success'); }

// ============================================
// INITIALIZATION
// ============================================
function populateCountries() {
  if (!countrySelect || typeof supportedCountries !== 'function') return;
  supportedCountries().forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    countrySelect.appendChild(opt);
  });
}

function initAddMemoryPage() {
  populateCountries();
  updateToolbarState();
  setTimeout(() => editor.focus(), 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAddMemoryPage);
} else {
  initAddMemoryPage();
}
