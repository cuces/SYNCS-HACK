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
const specificPlaceInput = document.getElementById('specificPlace');
const specificCoordsInput = document.getElementById('specificCoords');

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

// Custom culture / memory-type values entered here land in the post's `tags`.
// The My Family board derives its "Custom cultures" / "Custom tags" dropdowns
// from the tags on PUBLISHED posts, so anything shared to the community shows
// up there automatically — no separate registry needed.

// When the page is opened as add-memory.html?adaptedFrom=<post_id>, the new
// memory is created as a child of that post: `adapted_from` is set on save, so
// it appears as a branch in the lineage graph + map. `adaptedFromPost` is the
// parent row once loaded (or null).
const adaptedFromId = Number(new URLSearchParams(window.location.search).get('adaptedFrom')) || null;
let adaptedFromPost = null;

// Show the "you are extending X" banner and retarget the page copy.
function showAdaptingBanner(parent) {
  const banner = document.getElementById('adaptingBanner');
  if (!banner) return;
  banner.hidden = false;
  banner.innerHTML =
    '<strong>Extending a memory</strong>' +
    'This will branch from <span class="parent-name">' +
    parent.title.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) +
    '</span> in the family lineage.';

  const heading = document.getElementById('editorHeading');
  const subtitle = document.getElementById('editorSubtitle');
  if (heading) heading.textContent = 'Extend a Memory';
  if (subtitle) subtitle.textContent = 'Add your own take — it keeps a link back to the original.';
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save adaptation';
}

// Best-effort: copy the parent's country / culture / type so the branch starts
// from the same place. The user can still change anything.
function prefillFromParent(parent) {
  if (countrySelect && parent.country) {
    const hasOption = Array.from(countrySelect.options).some((o) => o.value === parent.country);
    if (hasOption) countrySelect.value = parent.country;
  }

  // Carry over the parent's specific location so the branch starts from the same
  // spot on the map. Only when the parent had a real specific location (a
  // `place` label) — not when its pin was just the country centroid, which the
  // child re-derives from its own country pick. The author can still change it.
  if (parent.place && parent.lat != null && parent.lng != null) {
    if (specificPlaceInput) specificPlaceInput.value = parent.place;
    if (specificCoordsInput) specificCoordsInput.value = parent.lat + ', ' + parent.lng;
  }

  const tags = Array.isArray(parent.tags) ? parent.tags.map((t) => String(t).toLowerCase()) : [];

  // Culture: match a radio, else fall back to the custom field.
  const cultureTag = tags[0];
  if (cultureTag) {
    const match = document.querySelector('input[name="cuisine"][value="' + cultureTag + '"]');
    if (match) {
      match.checked = true;
    } else {
      const custom = document.querySelector('input[name="cuisine"][value="custom-cuisine"]');
      if (custom) { custom.checked = true; customCuisineInput.classList.remove('hidden'); customCuisineInput.value = cultureTag; }
    }
    handleCuisineChange();
  }

  // Memory type: fuzzy-match the parent category against the radio options.
  const cat = String(parent.category || '').toLowerCase();
  const typeMap = { recipe: 'recipes', recipes: 'recipes', story: 'stories', stories: 'stories', skill: 'skills', skills: 'skills' };
  const typeValue = typeMap[cat];
  if (typeValue) {
    const typeRadio = document.querySelector('input[name="memoryType"][value="' + typeValue + '"]');
    if (typeRadio) { typeRadio.checked = true; handleMemoryTypeChange(); }
  }
}

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

// Work out which family this memory belongs to and who is authoring it.
// When someone is signed in (auth.js), it MUST be their own family + user
// record — otherwise the memory lands on another family's board and the author
// never sees it again (their My Family board and the private view are both
// scoped to their family). With no session we fall back to the first family so
// the offline demo build still works.
async function resolvePostOwner() {
  const session = window.cornerStoneAuth && typeof window.cornerStoneAuth.getCurrentUser === 'function'
    ? window.cornerStoneAuth.getCurrentUser()
    : null;
  const email = session && session.email ? String(session.email).trim().toLowerCase() : '';

  if (email) {
    const users = await getAllUsers();
    const me = users.find((u) => String(u.email || '').trim().toLowerCase() === email);
    if (me && me.family_id != null) {
      return { familyId: me.family_id, posterId: me.user_id };
    }

    // Session exists but there's no matching user row yet — create one against
    // the family the session already points at.
    if (session.family_id != null) {
      return {
        familyId: session.family_id,
        posterId: await createUser({
          name: session.name || 'You', family_id: session.family_id, email: session.email, phone: null
        })
      };
    }
  }

  // Not logged in: original behaviour — attribute to the first family.
  const families = await getFamilies();
  const familyId = families.length ? families[0].family_id : await createFamily('Your family');
  const members = await getUsersByFamily(familyId);
  const posterId = members.length
    ? members[0].user_id
    : await createUser({ name: 'You', family_id: familyId, email: null, phone: null });
  return { familyId, posterId };
}

cancelBtn.addEventListener('click', () => {
  if (confirm('Discard this memory?')) {
    window.location.href = adaptedFromId
      ? 'post.html?id=' + adaptedFromId + '&from=family'
      : 'index.html';
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
  const countryCoords = country && typeof countryToLatLng === 'function' ? countryToLatLng(country) : null;

  // Optional "specific location" — a free-text label + pasted coordinates. When
  // the author gives coordinates they override the country centroid, so the
  // memory pins to the exact spot on the map.
  const place = specificPlaceInput ? specificPlaceInput.value.trim() : '';
  const specificCoordsRaw = specificCoordsInput ? specificCoordsInput.value.trim() : '';
  const specificCoords = specificCoordsRaw && typeof parseLatLng === 'function'
    ? parseLatLng(specificCoordsRaw)
    : null;

  // A specific location, when supplied, wins over the picked country.
  const coords = specificCoords || countryCoords;

  if (!title) return showError('Please enter a title for your memory.');
  if (!memoryType) return showError('Please choose a memory type.');
  if (memoryType === 'custom' && !customMemoryType) return showError('Please enter a custom memory type.');
  if (!cuisine) return showError('Please choose a cuisine or culture.');
  if (cuisine === 'custom-cuisine' && !customCuisine) return showError('Please enter a custom culture.');
  if (!description || !content || content === '<br>' || content === '<div><br></div>') {
    return showError('Please write something in the description.');
  }
  if (!visibility) return showError('Please choose a visibility option.');
  if (specificCoordsRaw && !specificCoords) {
    return showError('Couldn’t read those coordinates. Use "latitude, longitude", e.g. -33.883, 151.157.');
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    const { familyId, posterId } = await resolvePostOwner();

    // tags[0] is always the culture; tags[1] the memory type. The My Family
    // board reads these positions to build its custom-culture / custom-tag lists.
    const cultureTag = (cuisine === 'custom-cuisine' ? customCuisine : cuisine).toLowerCase();
    const tagList = [cultureTag];
    if (memoryType === 'custom') tagList.push(customMemoryType.toLowerCase());
    else tagList.push(memoryType.toLowerCase());

    const newId = await createPost({
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
      // The lineage link. null for a brand-new root memory.
      adapted_from: adaptedFromPost ? adaptedFromPost.post_id : null,
      country: country,
      place: place || null,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null
    });

    showSuccess(adaptedFromPost ? 'Adaptation saved.' : 'Memory saved.');
    resetForm();
    setTimeout(() => {
      if (adaptedFromPost) {
        // Land on the new memory's page — its embedded graph + map now show it
        // branching off the original.
        window.location.href = 'post.html?id=' + newId + '&from=family';
      } else {
        window.location.href = visibility === 'community-wide' ? 'community.html' : 'family.html';
      }
    }, 900);
  } catch (error) {
    console.error('Error saving memory:', error);
    showError('Failed to save memory. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

async function initAddMemoryPage() {
  populateCountries();
  handleCuisineChange();
  handleMemoryTypeChange();
  updateToolbarState();

  // If this is an adaptation, load the parent memory and set the page up for it.
  if (adaptedFromId) {
    try {
      if (window.showcaseSeed) await window.showcaseSeed.ensure();
      adaptedFromPost = await getPostById(adaptedFromId);
      if (adaptedFromPost) {
        showAdaptingBanner(adaptedFromPost);
        prefillFromParent(adaptedFromPost);
      }
    } catch (err) {
      console.error('Could not load the memory being extended:', err);
    }
  }

  setTimeout(() => editor.focus(), 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAddMemoryPage);
} else {
  initAddMemoryPage();
}

