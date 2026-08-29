/**
 * CORNERSTONE — Frontend Application
 * Fetches published posts from IndexedDB and renders them dynamically
 * READ-ONLY operations only
 */

// ============================================
// STATE & CONFIGURATION
// ============================================

const appState = {
  allPosts: [],
  filteredPosts: [],
  selectedCulture: null,
  selectedCategory: null,
  searchQuery: '',
  cultures: new Set(),
  categories: new Set()
};

// Sample categories (will also be derived from posts)
const DEFAULT_CATEGORIES = ['All', 'Recipes', 'Stories', 'Traditions', 'Memories', 'Music', 'Family History'];

// ============================================
// INITIALIZATION
// ============================================

/**
 * Main app initialization
 */
async function initApp() {
  try {
    console.log('Initializing Cornerstone...');
    
    // Seed database with sample data (only if empty)
    await ensureSampleData();
    
    // Fetch all published posts
    const posts = await getPublishedPosts();
    appState.allPosts = posts;
    
    // Extract unique cultures and categories
    extractMetadata(posts);
    
    // Render UI
    renderCultureButtons();
    renderCategoryFilters();
    applyFilters();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log(`✓ Cornerstone loaded with ${posts.length} published posts`);
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

/**
 * Ensure database has sample data for demonstration
 */
async function ensureSampleData() {
  const existingPosts = await getPublishedPosts();
  if (existingPosts.length > 0) {
    console.log('Database already populated');
    return;
  }

  console.log('Seeding database with sample posts...');

  // Create families
  const chineseFamilyId = await createFamily('Chon Family');
  const greekFamilyId = await createFamily('Papadopoulos Family');
  const koreanFamilyId = await createFamily('Kim Family');
  const indianFamilyId = await createFamily('Sharma Family');

  // Create sample posts
  const samplePosts = [
    {
      title: "Grandma's Dumplings",
      description: "A recipe passed down through three generations of our family. These dumplings are made with a special pork and chive filling.',",
      family_id: chineseFamilyId,
      category: 'Recipes',
      culture: 'Chinese',
      is_published: true
    },
    {
      title: 'Soy Sauce Chicken',
      description: 'Classic Cantonese braised chicken with soy, star anise, and ginger. Perfect for family dinners.',
      family_id: chineseFamilyId,
      category: 'Recipes',
      culture: 'Chinese',
      is_published: true
    },
    {
      title: "Grandma's Radish Cake",
      description: 'A beloved dim sum favourite made with shredded daikon and Chinese sausage. Crispy on the outside, soft inside.',
      family_id: chineseFamilyId,
      category: 'Recipes',
      culture: 'Chinese',
      is_published: true
    },
    {
      title: 'Sweet Red Bean Soup',
      description: 'A traditional dessert soup served warm. Made with dried red beans, dates, and a hint of rock sugar.',
      family_id: chineseFamilyId,
      category: 'Recipes',
      culture: 'Chinese',
      is_published: true
    },
    {
      title: 'My Grandfather\'s Childhood Story',
      description: 'Growing up in Seoul in the 1950s, my grandfather would walk five miles to school each day through the mountains.',
      family_id: koreanFamilyId,
      category: 'Stories',
      culture: 'Korean',
      is_published: true
    },
    {
      title: 'Our Lunar New Year Traditions',
      description: 'Every year, the whole extended family gathers for a week-long celebration. We start with a ceremonial breakfast of special foods for good fortune.',
      family_id: chineseFamilyId,
      category: 'Traditions',
      culture: 'Chinese',
      is_published: true
    },
    {
      title: 'The Song My Mother Taught Me',
      description: 'A traditional Greek folk song from the Peloponnese. My mother learned it from her grandmother, and now I\'m learning it too.',
      family_id: greekFamilyId,
      category: 'Music',
      culture: 'Greek',
      is_published: true
    },
    {
      title: 'How We Celebrate Easter',
      description: 'Our Greek Orthodox Easter traditions have been part of our family for generations. We roast a whole lamb and gather in the village square.',
      family_id: greekFamilyId,
      category: 'Traditions',
      culture: 'Greek',
      is_published: true
    },
    {
      title: 'Saag Paneer',
      description: 'Creamed spinach with homemade paneer cheese. A restaurant-quality curry made the traditional way.',
      family_id: indianFamilyId,
      category: 'Recipes',
      culture: 'Indian',
      is_published: true
    },
    {
      title: 'Diwali Memories',
      description: 'Stories of Diwali celebrations from my childhood in Delhi, including decorating the house with oil lamps and fireworks.',
      family_id: indianFamilyId,
      category: 'Memories',
      culture: 'Indian',
      is_published: true
    }
  ];

  for (const post of samplePosts) {
    const { culture, ...postData } = post;
    await createPost({
      poster_id: 1,
      ...postData,
      tags: [culture, postData.category.toLowerCase()],
      file: null,
      adapted_from: null
    });
  }

  console.log(`✓ Created ${samplePosts.length} sample posts`);
}

/**
 * Extract unique cultures and categories from posts
 */
function extractMetadata(posts) {
  const cultures = new Set();
  const categories = new Set(['All']);

  for (const post of posts) {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => {
        const formatted = capitalizeWords(tag);
        if (DEFAULT_CATEGORIES.includes(formatted)) {
          categories.add(formatted);
        } else {
          cultures.add(formatted);
        }
      });
    }
    if (post.category) {
      categories.add(post.category);
    }
  }

  appState.cultures = cultures;
  appState.categories = categories;
}

/**
 * Capitalize words for display
 */
function capitalizeWords(str) {
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

// ============================================
// RENDERING
// ============================================

/**
 * Render culture filter buttons
 */
function renderCultureButtons() {
  const container = document.getElementById('cultureButtons');
  container.innerHTML = '';

  // Add "All" button
  const allBtn = createCultureButton('All', true);
  container.appendChild(allBtn);

  // Sort and add culture buttons
  const cultures = Array.from(appState.cultures).sort();
  for (const culture of cultures) {
    const btn = createCultureButton(culture);
    container.appendChild(btn);
  }
}

/**
 * Create a culture button element
 */
function createCultureButton(culture, isAll = false) {
  const btn = document.createElement('button');
  btn.className = 'culture-btn';
  btn.textContent = culture;
  btn.dataset.culture = culture;

  if (isAll || culture === appState.selectedCulture) {
    btn.classList.add('active');
  }

  btn.addEventListener('click', () => {
    const newCulture = isAll ? null : culture;
    if (appState.selectedCulture === newCulture) return;

    appState.selectedCulture = newCulture;
    updateCultureButtons();
    applyFilters();
  });

  return btn;
}

/**
 * Update active state of culture buttons
 */
function updateCultureButtons() {
  const buttons = document.querySelectorAll('.culture-btn');
  buttons.forEach(btn => {
    const culture = btn.dataset.culture;
    const isActive =
      (culture === 'All' && appState.selectedCulture === null) ||
      culture === appState.selectedCulture;
    btn.classList.toggle('active', isActive);
  });
}

/**
 * Render category filters in sidebar
 */
function renderCategoryFilters() {
  const container = document.getElementById('categoryList');
  container.innerHTML = '';

  const categories = Array.from(appState.categories).sort((a, b) => {
    if (a === 'All') return -1;
    if (b === 'All') return 1;
    return a.localeCompare(b);
  });

  for (const category of categories) {
    const btn = document.createElement('button');
    btn.className = 'category-item';
    btn.textContent = category;
    btn.dataset.category = category;

    if (
      (category === 'All' && appState.selectedCategory === null) ||
      category === appState.selectedCategory
    ) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      const newCategory = category === 'All' ? null : category;
      if (appState.selectedCategory === newCategory) return;

      appState.selectedCategory = newCategory;
      updateCategoryButtons();
      applyFilters();
    });

    container.appendChild(btn);
  }
}

/**
 * Update active state of category buttons
 */
function updateCategoryButtons() {
  const buttons = document.querySelectorAll('.category-item');
  buttons.forEach(btn => {
    const category = btn.dataset.category;
    const isActive =
      (category === 'All' && appState.selectedCategory === null) ||
      category === appState.selectedCategory;
    btn.classList.toggle('active', isActive);
  });
}

/**
 * Apply all active filters and render posts
 */
function applyFilters() {
  let filtered = [...appState.allPosts];

  // Filter by culture
  if (appState.selectedCulture) {
    filtered = filtered.filter(post => {
      const tags = post.tags || [];
      return tags.some(tag => capitalizeWords(tag) === appState.selectedCulture);
    });
  }

  // Filter by category
  if (appState.selectedCategory) {
    filtered = filtered.filter(post => {
      return post.category === appState.selectedCategory ||
             (post.tags && post.tags.some(tag => capitalizeWords(tag) === appState.selectedCategory));
    });
  }

  // Filter by search query
  if (appState.searchQuery.trim()) {
    const query = appState.searchQuery.toLowerCase();
    filtered = filtered.filter(post =>
      post.title.toLowerCase().includes(query) ||
      (post.description && post.description.toLowerCase().includes(query)) ||
      (post.tags && post.tags.some(tag => tag.toLowerCase().includes(query))) ||
      (post.category && post.category.toLowerCase().includes(query))
    );
  }

  appState.filteredPosts = filtered;
  updateSectionHeader();
  renderPosts();
}

/**
 * Update section header with filter info
 */
function updateSectionHeader() {
  const header = document.getElementById('sectionHeader');
  let title = 'Community Archive';
  let meta = `${appState.filteredPosts.length} contributions`;

  if (appState.selectedCategory && appState.selectedCulture) {
    title = `${appState.selectedCategory} from ${appState.selectedCulture} Families`;
  } else if (appState.selectedCategory) {
    title = `${appState.selectedCategory}`;
  } else if (appState.selectedCulture) {
    title = `${appState.selectedCulture} Contributions`;
  }

  header.innerHTML = `
    <h2 class="section-title">${title}</h2>
    <p class="section-meta">${meta}</p>
  `;
}

/**
 * Render post grid and featured memory
 */
function renderPosts() {
  const grid = document.getElementById('postGrid');
  const featuredContainer = document.getElementById('featuredMemory');

  // Clear containers
  grid.innerHTML = '';
  featuredContainer.innerHTML = '';

  if (appState.filteredPosts.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">No posts found.</p>';
    return;
  }

  // Render featured post (first one)
  const featured = appState.filteredPosts[0];
  if (featured) {
    featuredContainer.innerHTML = renderFeaturedCard(featured);
  }

  // Render grid of remaining posts
  for (let i = 1; i < appState.filteredPosts.length; i++) {
    const post = appState.filteredPosts[i];
    const card = createPostCard(post);
    grid.appendChild(card);
  }

  // If we only have one post, still populate the grid with it
  if (appState.filteredPosts.length === 1) {
    const card = createPostCard(featured);
    grid.appendChild(card);
  }
}

/**
 * Render featured memory card (large editorial card)
 */
function renderFeaturedCard(post) {
  const culture = post.tags ? post.tags[0] : 'Archive';
  const typeLabel = `${post.category} · ${capitalizeWords(culture)}`;

  return `
    <img src="https://via.placeholder.com/420x240?text=${encodeURIComponent(post.title)}" alt="${post.title}" class="featured-image" />
    <div class="featured-content">
      <div class="featured-type">${typeLabel}</div>
      <h2 class="featured-title">${escapeHtml(post.title)}</h2>
      <p class="featured-meta">Shared by the Cornerstone Community</p>
      <p class="featured-description">${escapeHtml(post.description || 'Explore this contribution to our community archive.')}</p>
    </div>
  `;
}

/**
 * Create a post card element
 */
function createPostCard(post) {
  const card = document.createElement('article');
  card.className = 'post-card';

  const culture = post.tags ? post.tags[0] : 'Archive';
  const typeLabel = `${post.category} · ${capitalizeWords(culture)}`;

  card.innerHTML = `
    <img src="https://via.placeholder.com/283x190?text=${encodeURIComponent(post.title)}" alt="${post.title}" class="post-image" />
    <div class="post-body">
      <span class="post-type">${typeLabel}</span>
      <h3 class="post-title">${escapeHtml(post.title)}</h3>
      <p class="post-description">${escapeHtml(post.description || 'An archive entry.')}</p>
      <p class="post-contributor">Shared by the Cornerstone Community</p>
    </div>
  `;

  card.addEventListener('click', () => {
    console.log('Post clicked:', post);
    // Post detail view would be implemented here
  });

  return card;
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value;
      applyFilters();
    });
  }

  // Navigation links
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      console.log('Navigate to section:', section);
      // Navigation would be implemented here
    });
  });
}

// ============================================
// UTILITIES
// ============================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// BOOTSTRAP
// ============================================

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
