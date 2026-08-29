// data.js — read-only data-access layer for the frontend.
//
// Wraps the helpers in db.js (Dexie / IndexedDB) and shapes their rows into
// plain view-model objects the pages can render directly. This is the single
// place the UI touches the database, so new pages can reuse it without
// re-implementing queries.
//
// Load order (classic scripts): dexie.js -> db.js -> data.js -> <page>.js
//
// This file never writes to the database.

(function (global) {
  'use strict';

  // No authentication exists yet, so "the current family" is simply the first
  // family record in the store. When auth is added, resolve it here instead.
  async function getCurrentFamily() {
    const families = await getFamilies();
    return families.length ? families[0] : null;
  }

  // Newest first, by created_at (falls back to post_id when a date is missing).
  function byNewest(a, b) {
    const ta = a.created_at instanceof Date ? a.created_at.getTime() : 0;
    const tb = b.created_at instanceof Date ? b.created_at.getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (b.post_id || 0) - (a.post_id || 0);
  }

  // Turn a raw post row + a poster_id -> name map into a render-ready object.
  function toPostView(post, usersById) {
    const author = usersById.get(post.poster_id);
    return {
      id: post.post_id,
      title: post.title || 'Untitled',
      description: post.description || '',
      category: post.category || '',
      // `file` is a free-form media reference in the schema. Only use it as an
      // <img> source when it is a usable string; otherwise the UI shows a
      // placeholder rather than a broken image.
      imageSrc: typeof post.file === 'string' && post.file.trim() ? post.file : null,
      authorName: author ? author.name : null,
      createdAt: post.created_at instanceof Date ? post.created_at : null
    };
  }

  /**
   * Data for the homepage.
   * Returns:
   *   {
   *     family:          { family_id, name } | null,
   *     currentUserName: string | null,
   *     recentPosts:     PostView[]   // newest first, capped
   *   }
   * Throws if the database is unreachable — the caller renders an error state.
   */
  async function loadHomeView(options) {
    const limit = (options && options.limit) || 4;

    const family = await getCurrentFamily();
    if (!family) {
      return { family: null, currentUserName: null, recentPosts: [] };
    }

    const [posts, users] = await Promise.all([
      getFamilyPosts(family.family_id),
      getUsersByFamily(family.family_id)
    ]);

    const usersById = new Map(users.map(function (u) { return [u.user_id, u]; }));

    const recentPosts = posts
      .slice()
      .sort(byNewest)
      .slice(0, limit)
      .map(function (p) { return toPostView(p, usersById); });

    return {
      family: { family_id: family.family_id, name: family.name },
      currentUserName: users.length ? users[0].name : null,
      recentPosts: recentPosts
    };
  }

  global.appData = {
    getCurrentFamily: getCurrentFamily,
    loadHomeView: loadHomeView
  };
})(window);
