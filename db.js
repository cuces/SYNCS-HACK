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
  is_published = false // True when the item should appear on the public board
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
    mentioned: [],
    liked_by: [],
    created_at: new Date()
  });
}

// Returns all posts for one family's private board.
async function getFamilyPosts(family_id) {
  return db.posts.where({ family_id }).toArray();
}

// Returns posts that are visible on the public community board.
async function getPublishedPosts() {
  return db.posts.where('is_published').equals(1).toArray();
}

// Marks a post as published so it becomes visible to the wider community.
async function publishPost(post_id) {
  return db.posts.update(post_id, { is_published: true });
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

// Finds posts that share at least one tag with the provided post for relationship graphing.
async function getRelatedPosts(post_id) {
  const post = await db.posts.get(post_id);
  if (!post || !post.tags.length) return [];
  const matches = await db.posts.where('tags').anyOf(post.tags).toArray();
  return matches.filter(p => p.post_id !== post_id);
}