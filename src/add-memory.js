/**
 * add-memory.js — Rich text editor for creating new family memories
 * Handles text formatting (bold, italic, underline), bullet lists,
 * image uploads, and memory persistence to IndexedDB
 */

// Get DOM elements
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

// Track active formatting states
const activeFormats = {
  bold: false,
  italic: false,
  underline: false
};

// Image storage
let uploadedImages = [];

// ============================================
// CUSTOM CUISINE HANDLING
// ============================================

/**
 * Toggle custom cuisine input visibility
 */
function handleCuisineChange() {
  const customCuisineRadio = document.querySelector('input[name="cuisine"][value="custom-cuisine"]');
  if (customCuisineRadio.checked) {
    customCuisineInput.classList.remove('hidden');
    customCuisineInput.focus();
  } else {
    customCuisineInput.classList.add('hidden');
  }
}

cuisineRadios.forEach(radio => {
  radio.addEventListener('change', handleCuisineChange);
});

// ============================================
// IMAGE HANDLING
// ============================================

/**
 * Handle image file selection
 */
imageInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  
  for (let file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const imageData = {
          id: Date.now() + Math.random(),
          src: event.target.result,
          name: file.name
        };
        
        uploadedImages.push(imageData);
        renderImageGallery();
      };
      
      reader.readAsDataURL(file);
    }
  }
  
  // Reset input
  imageInput.value = '';
});

/**
 * Render image gallery
 */
function renderImageGallery() {
  imageGallery.innerHTML = uploadedImages.map(img => `
    <div class="image-item" title="${img.name}">
      <img src="${img.src}" alt="${img.name}">
      <button type="button" class="image-remove-btn" data-id="${img.id}" title="Remove image">×</button>
    </div>
  `).join('');
  
  // Add remove event listeners
  imageGallery.querySelectorAll('.image-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = parseFloat(btn.getAttribute('data-id'));
      uploadedImages = uploadedImages.filter(img => img.id !== id);
      renderImageGallery();
    });
  });
}

/**
 * Open image picker on button click
 */
imageBtn.addEventListener('click', (e) => {
  e.preventDefault();
  imageInput.click();
});

// ============================================
// FORMATTING TOOLBAR HANDLERS
// ============================================

/**
 * Apply text formatting command
 */
function applyFormat(command, value = null) {
  document.execCommand(command, false, value);
  editor.focus();
}

/**
 * Toggle button active state
 */
function updateToolbarState() {
  activeFormats.bold = document.queryCommandState('bold');
  activeFormats.italic = document.queryCommandState('italic');
  activeFormats.underline = document.queryCommandState('underline');

  boldBtn.classList.toggle('active', activeFormats.bold);
  italicBtn.classList.toggle('active', activeFormats.italic);
  underlineBtn.classList.toggle('active', activeFormats.underline);
}

// Toolbar button event listeners
boldBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyFormat('bold');
  updateToolbarState();
});

italicBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyFormat('italic');
  updateToolbarState();
});

underlineBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyFormat('underline');
  updateToolbarState();
});

bulletBtn.addEventListener('click', (e) => {
  e.preventDefault();
  applyFormat('insertUnorderedList');
  updateToolbarState();
});

// Update toolbar state when selection changes
editor.addEventListener('mouseup', updateToolbarState);
editor.addEventListener('keyup', updateToolbarState);

// Keyboard shortcuts for formatting
editor.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b') {
      e.preventDefault();
      applyFormat('bold');
      updateToolbarState();
    } else if (e.key === 'i') {
      e.preventDefault();
      applyFormat('italic');
      updateToolbarState();
    } else if (e.key === 'u') {
      e.preventDefault();
      applyFormat('underline');
      updateToolbarState();
    }
  }
});

// ============================================
// FORM SUBMISSION
// ============================================

/**
 * Save memory to IndexedDB
 */
async function saveMemory(data) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['posts'], 'readwrite');
    const store = tx.objectStore('posts');

    const memory = {
      id: Date.now(),
      title: data.title,
      content: data.content,
      memoryType: data.memoryType,
      cuisine: data.cuisine,
      customCuisine: data.customCuisine || null,
      visibility: data.visibility,
      images: data.images,
      createdAt: new Date().toISOString(),
      published: true,
      familyId: 'default' // TODO: Get from family context
    };

    await store.add(memory);
    await tx.done;

    console.log('Memory saved:', memory);
    showSuccessMessage('Memory saved successfully!');
    resetForm();
    
    // Redirect to home after 1.5 seconds
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
  } catch (error) {
    console.error('Error saving memory:', error);
    showErrorMessage('Failed to save memory. Please try again.');
  }
}

/**
 * Open IndexedDB connection
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RootedDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('posts')) {
        db.createObjectStore('posts', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Handle form submission
 */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('memoryTitle').value.trim();
  const content = editor.innerHTML;
  const memoryType = document.querySelector('input[name="memoryType"]:checked').value;
  const cuisine = document.querySelector('input[name="cuisine"]:checked').value;
  const customCuisine = cuisine === 'custom-cuisine' ? customCuisineInput.value.trim() : null;
  const visibility = document.getElementById('visibility').value;

  // Validate inputs
  if (!title) {
    showErrorMessage('Please enter a title for your memory.');
    return;
  }

  if (!content || content === '<br>') {
    showErrorMessage('Please write something in the description.');
    return;
  }

  if (!memoryType) {
    showErrorMessage('Please select a memory type.');
    return;
  }

  if (!cuisine) {
    showErrorMessage('Please select a cuisine/culture.');
    return;
  }

  if (cuisine === 'custom-cuisine' && !customCuisine) {
    showErrorMessage('Please enter a custom cuisine name.');
    return;
  }

  if (!visibility) {
    showErrorMessage('Please select visibility.');
    return;
  }

  // Show loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  // Save to database
  await saveMemory({
    title,
    content,
    memoryType,
    cuisine,
    customCuisine,
    visibility,
    images: uploadedImages
  });

  // Restore button state
  submitBtn.disabled = false;
  submitBtn.textContent = originalText;
});

/**
 * Cancel and return to home
 */
cancelBtn.addEventListener('click', () => {
  if (confirm('Discard this memory?')) {
    window.location.href = 'index.html';
  }
});

/**
 * Reset form fields
 */
function resetForm() {
  form.reset();
  editor.innerHTML = '';
  uploadedImages = [];
  imageGallery.innerHTML = '';
  customCuisineInput.classList.add('hidden');
  updateToolbarState();
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Show success message
 */
function showSuccessMessage(message) {
  console.log('✓', message);
  // TODO: Add a toast notification UI if needed
}

/**
 * Show error message
 */
function showErrorMessage(message) {
  console.error('✗', message);
  alert(message); // TODO: Add a toast notification UI
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the page
 */
async function initAddMemoryPage() {
  try {
    // Focus editor on load
    setTimeout(() => {
      editor.focus();
    }, 100);

    // Initialize toolbar state
    updateToolbarState();

    console.log('Add Memory page initialized');
  } catch (error) {
    console.error('Error initializing Add Memory page:', error);
  }
}

// Start initialization when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAddMemoryPage);
} else {
  initAddMemoryPage();
}
