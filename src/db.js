// db.js — Dexie (IndexedDB) setup, mirrors schema.sql
//
// Include Dexie before this file in your HTML:
// <script src="https://unpkg.com/dexie@3/dist/dexie.js"></script>
// <script src="db.js"></script>
 
// Main IndexedDB database for the family archive app.
const db = new Dexie('FamilyArchiveDB');

// Database schema version 1. Each store defines the primary key and any indexes used for lookups.
db.version(1).stores({
  // Family records, keyed by automatically incrementing family_id.
  families: '++family_id, name',

  // User records, tied to a family and searchable by name/email/family.
  users: '++user_id, name, family_id, email',

  // Post records for private/family boards and public community publishing.
  posts: '++post_id, poster_id, family_id, category, is_published, adapted_from, *tags, created_at'
  // *tags = multi-entry index, lets you query posts by a single tag inside the array
});
 
// ---------- Families ----------

// Creates a new family record in the families store.
async function createFamily(name) {
  return db.families.add({ name });
}

// Returns every family record in the database.
async function getFamilies() {
  return db.families.toArray();
}

// ---------- Users ----------

// Adds a user to a specific family and stores their contact info.
async function createUser({ name, family_id, email, phone }) {
  return db.users.add({ name, family_id, email, phone });
}

// Fetches all users belonging to a single family.
async function getUsersByFamily(family_id) {
  return db.users.where({ family_id }).toArray();
}

// Fetches a single user by primary key. Returns undefined when not found.
async function getUserById(user_id) {
  return db.users.get(user_id);
}

// Returns every user record. Used by the community board, which shows posts
// from many families at once.
async function getAllUsers() {
  return db.users.toArray();
}

// ---------- Posts ----------

// Creates a new post for a family board or community feed.
async function createPost({
  poster_id, // User who authored the post
  family_id, // Family the post belongs to
  title, // Post headline or title
  description, // Optional body text for the post
  file, // Uploaded media/file reference
  tags = [], // Searchable labels attached to this post
  category, // Content category such as photo, note, memory, etc.
  adapted_from = null, // Parent post if this is derived from an existing one
  is_published = false, // True when the item should appear on the public board
  country = null, // Country the knowledge comes from, e.g. "Vietnam" — optional
  lat = null, // Latitude for the map view — optional, usually derived from `country`
  lng = null // Longitude for the map view — optional
}) {
  return db.posts.add({
    poster_id,
    family_id,
    title,
    description,
    file,
    tags,
    category,
    adapted_from,
    is_published,
    // Location is optional. The create-post form fills lat/lng from the picked
    // country (see geo.js). Posts with no location simply don't appear on the map.
    country,
    lat,
    lng,
    mentioned: [],
    liked_by: [],
    created_at: new Date()
  });
}

// Returns all posts for one family's private board.
async function getFamilyPosts(family_id) {
  return db.posts.where({ family_id }).toArray();
}

// Fetches a single post by primary key. Returns undefined when not found.
async function getPostById(post_id) {
  return db.posts.get(post_id);
}

// Returns posts that are visible on the public community board.
async function getPublishedPosts() {
  return db.posts.where('is_published').equals(1).toArray();
}

// Marks a post as published so it becomes visible to the wider community.
async function publishPost(post_id) {
  return db.posts.update(post_id, { is_published: 1 });
}

// Walks the adapted_from chain back to the original post so its ancestry can be displayed.
async function getLineage(post_id) {
  const chain = []; // Ordered from newest post to original source post
  let current = await db.posts.get(post_id);
  while (current) {
    chain.push(current);
    if (!current.adapted_from) break;
    current = await db.posts.get(current.adapted_from);
  }
  return chain; // [most recent, ..., original]
}

// Returns the WHOLE adaptation tree a post belongs to — not just its straight
// line back to the root (that's getLineage), but every sibling and descendant
// branch too. Use this to render the full lineage graph for a post.
//
// Strategy:
//   1. Walk adapted_from upward to find the root of the tree.
//   2. From the root, walk back down breadth-first: at each level, query every
//      post whose adapted_from points at a node in the current level.
//   3. Derive edges from adapted_from (edges are never stored, only computed).
//
// Returns { nodes, edges } where:
//   nodes = flat array of every post in the tree (root + all branches)
//   edges = [{ from: parentPostId, to: childPostId }] for every non-root node
async function getFullTree(post_id) {
  let root = await db.posts.get(post_id);
  if (!root) return { nodes: [], edges: [] };

  // 1. Climb to the root. `seen` guards against a broken adapted_from cycle.
  const seen = new Set([root.post_id]);
  while (root.adapted_from != null && !seen.has(root.adapted_from)) {
    const parent = await db.posts.get(root.adapted_from);
    if (!parent) break; // dangling parent ref — treat current post as the root
    seen.add(parent.post_id);
    root = parent;
  }

  // 2. Breadth-first walk down from the root, collecting every descendant.
  const nodes = [root];
  const visited = new Set([root.post_id]);
  let level = [root.post_id];
  while (level.length) {
    const children = await db.posts.where('adapted_from').anyOf(level).toArray();
    const fresh = children.filter(c => !visited.has(c.post_id));
    if (!fresh.length) break;
    for (const c of fresh) {
      visited.add(c.post_id);
      nodes.push(c);
    }
    level = fresh.map(c => c.post_id);
  }

  // 3. Derive render edges from each non-root node's adapted_from.
  const edges = nodes
    .filter(p => p.post_id !== root.post_id)
    .map(p => ({ from: p.adapted_from, to: p.post_id }));

  return { nodes, edges };
}

// Finds posts that share at least one tag with the provided post for relationship graphing.
async function getRelatedPosts(post_id) {
  const post = await db.posts.get(post_id);
  if (!post || !post.tags.length) return [];
  const matches = await db.posts.where('tags').anyOf(post.tags).toArray();
  return matches.filter(p => p.post_id !== post_id);
}
