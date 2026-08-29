// db.js — Dexie (IndexedDB) setup, mirrors schema.sql
//
// Include Dexie before this file in your HTML:
// <script src="https://unpkg.com/dexie@3/dist/dexie.js"></script>
// <script src="db.js"></script>
 
const db = new Dexie('FamilyArchiveDB');
 
db.version(1).stores({
  families: '++family_id, name',
 
  users: '++user_id, name, family_id, email',
 
  posts: '++post_id, poster_id, family_id, category, is_published, adapted_from, *tags, created_at'
  // *tags = multi-entry index, lets you query posts by a single tag inside the array
});
 
// ---------- Families ----------
 
async function createFamily(name) {
  return db.families.add({ name });
}
 
async function getFamilies() {
  return db.families.toArray();
}
 
// ---------- Users ----------
 
async function createUser({ name, family_id, email, phone }) {
  return db.users.add({ name, family_id, email, phone });
}
 
async function getUsersByFamily(family_id) {
  return db.users.where({ family_id }).toArray();
}
 
// ---------- Posts ----------
 
async function createPost({
  poster_id,
  family_id,
  title,
  description,
  file,
  tags = [],
  category,
  adapted_from = null,
  is_published = false
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
 
// All posts for one family's private board
async function getFamilyPosts(family_id) {
  return db.posts.where({ family_id }).toArray();
}
 
// All posts visible on the public community board
async function getPublishedPosts() {
  return db.posts.where('is_published').equals(1).toArray();
}
 
// Flip a post from family-only to published
async function publishPost(post_id) {
  return db.posts.update(post_id, { is_published: true });
}
 
// Walk the adapted_from chain back to the original post
async function getLineage(post_id) {
  const chain = [];
  let current = await db.posts.get(post_id);
  while (current) {
    chain.push(current);
    if (!current.adapted_from) break;
    current = await db.posts.get(current.adapted_from);
  }
  return chain; // [most recent, ..., original]
}
 
// Posts sharing at least one tag with the given post (for graph edges)
async function getRelatedPosts(post_id) {
  const post = await db.posts.get(post_id);
  if (!post || !post.tags.length) return [];
  const matches = await db.posts.where('tags').anyOf(post.tags).toArray();
  return matches.filter(p => p.post_id !== post_id);
}