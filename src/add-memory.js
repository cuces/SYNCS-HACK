/**
 * add-memory.js — create a new family memory.
 *
 * Rich-text editor controls for bold, italic, underline, bullet list, and
 * inline image uploads. Keeps the page functional without depending on any
 * additional libraries beyond the app's existing Dexie/IndexedDB layer.
 */

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
const customMemoryTypeInput = document.getElementById('customMemoryType');
const cuisineRadios = document.querySelectorAll('input[name="cuisine"]');
const memoryTypeRadios = document.querySelectorAll('input[name="memoryType"]');
const countrySelect = document.getElementById('country');

// Fill the Country of Origin dropdown from geo.js's hand-picked table. When a
// country is chosen we also store its rough lat/lng so the post shows up on the
// map view (map.html plots any post that has coordinates).
function populateCountries() {
  if (!countrySelect || typeof supportedCountries !== 'function') return;
  for (const name of supportedCountries()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    countrySelect.appendChild(opt);
  }
}

const activeFormats = { bold: false, italic: false, underline: false };
let uploadedImages = [];

function showFlash(message, kind = 'error') {
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

function showError(message) {
  showFlash(message, 'error');
  return false;
}

function showSuccess(message) {
  showFlash(message, 'success');
}

function handleCuisineChange() {
  const customCuisineRadio = document.querySelector('input[name="cuisine"][value="custom-cuisine"]');
  if (customCuisineRadio && customCuisineRadio.checked) {
    customCuisineInput.classList.remove('hidden');
    customCuisineInput.focus();
  } else {
    customCuisineInput.classList.add('hidden');
  }
}

function handleMemoryTypeChange() {
  const customMemoryTypeRadio = document.querySelector('input[name="memoryType"][value="custom"]');
  if (customMemoryTypeRadio && customMemoryTypeRadio.checked) {
    customMemoryTypeInput.classList.remove('hidden');
    customMemoryTypeInput.focus();
  } else {
    customMemoryTypeInput.classList.add('hidden');
  }
}

cuisineRadios.forEach((radio) => radio.addEventListener('change', handleCuisineChange));
memoryTypeRadios.forEach((radio) => radio.addEventListener('change', handleMemoryTypeChange));

function renderImageGallery() {
  imageGallery.innerHTML = uploadedImages
    .map((img) => `
      <div class="image-item" title="${img.name}">
        <img src="${img.src}" alt="${img.name}">
        <button type="button" class="image-remove-btn" data-id="${img.id}" title="Remove image">×</button>
      </div>
    `)
    .join('');

  imageGallery.querySelectorAll('.image-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = Number(btn.getAttribute('data-id'));
      uploadedImages = uploadedImages.filter((img) => img.id !== id);
      renderImageGallery();
    });
  });
}

function applyFormat(command, value = null) {
  document.execCommand(command, false, value);
  editor.focus();
  updateToolbarState();
}

function updateToolbarState() {
  activeFormats.bold = document.queryCommandState('bold');
  activeFormats.italic = document.queryCommandState('italic');
  activeFormats.underline = document.queryCommandState('underline');

  boldBtn.classList.toggle('active', activeFormats.bold);
  italicBtn.classList.toggle('active', activeFormats.italic);
  underlineBtn.classList.toggle('active', activeFormats.underline);
}

boldBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyFormat('bold');
});

italicBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyFormat('italic');
});

underlineBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyFormat('underline');
});

bulletBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyFormat('insertUnorderedList');
});

imageBtn.addEventListener('click', (e) => {
  e.preventDefault();
  imageInput.click();
});

imageInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  files.forEach((file) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      uploadedImages.push({
        id: Date.now() + Math.random(),
        src: event.target.result,
        name: file.name
      });
      renderImageGallery();
    };
    reader.readAsDataURL(file);
  });

  imageInput.value = '';
});

editor.addEventListener('mouseup', updateToolbarState);
editor.addEventListener('keyup', updateToolbarState);
editor.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;

  if (e.key === 'b') {
    e.preventDefault();
    applyFormat('bold');
  } else if (e.key === 'i') {
    e.preventDefault();
    applyFormat('italic');
  } else if (e.key === 'u') {
    e.preventDefault();
    applyFormat('underline');
  }
});

function resetForm() {
  form.reset();
  editor.innerHTML = '';
  uploadedImages = [];
  imageGallery.innerHTML = '';
  customCuisineInput.classList.add('hidden');
  customMemoryTypeInput.classList.add('hidden');
  updateToolbarState();
}

cancelBtn.addEventListener('click', () => {
  if (confirm('Discard this memory?')) {
    window.location.href = 'index.html';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('memoryTitle').value.trim();
  const description = (editor.innerText || '').trim();
  const content = editor.innerHTML.trim();
  const memoryTypeEl = document.querySelector('input[name="memoryType"]:checked');
  const cuisineEl = document.querySelector('input[name="cuisine"]:checked');
  const visibility = document.getElementById('visibility').value;

  const memoryType = memoryTypeEl ? memoryTypeEl.value : '';
  const customMemoryType = memoryType === 'custom' ? customMemoryTypeInput.value.trim() : '';
  const cuisine = cuisineEl ? cuisineEl.value : '';
  const customCuisine = cuisine === 'custom-cuisine' ? customCuisineInput.value.trim() : '';
  const country = countrySelect ? (countrySelect.value || null) : null;
  const coords = country && typeof countryToLatLng === 'function' ? countryToLatLng(country) : null;

  if (!title) return showError('Please enter a title for your memory.');
  if (!memoryType) return showError('Please choose a memory type.');
  if (memoryType === 'custom' && !customMemoryType) return showError('Please enter a custom memory type.');
  if (!cuisine) return showError('Please choose a cuisine or culture.');
  if (cuisine === 'custom-cuisine' && !customCuisine) return showError('Please enter a custom culture.');
  if (!description || !content || content === '<br>' || content === '<div><br></div>') {
    return showError('Please write something in the description.');
  }
  if (!visibility) return showError('Please choose a visibility option.');

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    const families = await getFamilies();
    const familyId = families.length ? families[0].family_id : await createFamily('Your family');
    const members = await getUsersByFamily(familyId);
    const posterId = members.length
      ? members[0].user_id
      : await createUser({ name: 'You', family_id: familyId, email: null, phone: null });

    const cultureTag = (cuisine === 'custom-cuisine' ? customCuisine : cuisine).toLowerCase();
    const tagList = [cultureTag];
    if (memoryType === 'custom') tagList.push(customMemoryType.toLowerCase());
    else tagList.push(memoryType.toLowerCase());

    await createPost({
      poster_id: posterId,
      family_id: familyId,
      title,
      // Stored as plain text: the board cards and the detail page both render
      // `description` as text, so keep the editor's text content, not its HTML.
      description: description,
      file: uploadedImages.length ? uploadedImages[0].src : null,
      tags: tagList,
      category: memoryType === 'custom' ? 'memory' : memoryType,
      is_published: visibility === 'community-wide' ? 1 : 0,
      country: country,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null
    });

    showSuccess('Memory saved.');
    resetForm();
    setTimeout(() => {
      window.location.href = visibility === 'community-wide' ? 'community.html' : 'family.html';
    }, 900);
  } catch (error) {
    console.error('Error saving memory:', error);
    showError('Failed to save memory. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

function initAddMemoryPage() {
  populateCountries();
  handleCuisineChange();
  handleMemoryTypeChange();
  updateToolbarState();
  setTimeout(() => editor.focus(), 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAddMemoryPage);
} else {
  initAddMemoryPage();
}

