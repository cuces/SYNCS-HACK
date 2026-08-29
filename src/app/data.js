// data.js — read-only data-access layer for the frontend.
//
// Wraps the helpers in db.js (Dexie / IndexedDB) and shapes their rows into
// plain view-model objects the pages can render directly. This is the single
// place the UI touches the database, so new pages can reuse it without
// re-implementing queries.
//
// Load order: dexie.js -> ../db.js -> ui.js -> data.js -> <page>.js
// (db.js exposes `getFamilies`, `getFamilyPosts`, … as globals.)
//
// This file never writes to the database.

(function (global) {
  'use strict';

  // When seed.js is present (the demo build), make sure the showcase data has
  // been written before any page reads from the database. No-op otherwise.
  async function ready() {
    if (global.showcaseSeed && typeof global.showcaseSeed.ensure === 'function') {
      try { await global.showcaseSeed.ensure(); } catch (e) { /* page shows its own empty state */ }
    }
  }

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
    const tags = Array.isArray(post.tags) ? post.tags : [];
    return {
      id: post.post_id,
      title: post.title || 'Untitled',
      description: post.description || '',
      category: post.category || '',
      // First tag, if any — used as a secondary label (e.g. a culture).
      tag: tags.length ? String(tags[0]) : null,
      // Every tag on the post, lower-cased. Drives the family board's tag filter.
      tags: tags.map(function (t) { return String(t).toLowerCase(); }),
      // `file` is a free-form media reference in the schema. Only use it as an
      // <img> source when it is a usable string; otherwise the UI shows a
      // placeholder rather than a broken image.
      imageSrc: typeof post.file === 'string' && post.file.trim() ? post.file : null,
      authorName: author ? author.name : null,
      // db.js stores is_published as 1 once published, false otherwise.
      isPublished: post.is_published === 1 || post.is_published === true,
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
    await ready();

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

  /**
   * Data for the family board page.
   * Returns:
   *   {
   *     family:          { family_id, name } | null,
   *     members:         [{ name, role, initial }],   // role is 'You' for the first member
   *     currentUserName: string | null,
   *     posts:           PostView[],                  // whole family board, newest first
   *     stats:           { members, posts, shared }
   *   }
   * Throws if the database is unreachable — the caller renders an error state.
   */
  async function loadFamilyView() {
    await ready();
    const family = await getCurrentFamily();
    if (!family) {
      return {
        family: null,
        members: [],
        currentUserName: null,
        posts: [],
        stats: { members: 0, posts: 0, shared: 0 }
      };
    }

    const [posts, users] = await Promise.all([
      getFamilyPosts(family.family_id),
      getUsersByFamily(family.family_id)
    ]);

    const usersById = new Map(users.map(function (u) { return [u.user_id, u]; }));

    const postViews = posts
      .slice()
      .sort(byNewest)
      .map(function (p) { return toPostView(p, usersById); });

    // Custom tags for the My Family filter dropdown. Only from PUBLISHED posts
    // (so "public" is respected), and only the free-text values — the built-in
    // radio options are filtered out. Convention: tags[0] is the culture (not
    // filtered on here), tags[1..] the memory type(s).
    const STANDARD_TYPES = ['recipes', 'stories', 'skills'];
    const tagSet = new Set();
    postViews.filter(function (p) { return p.isPublished; }).forEach(function (p) {
      const t = p.tags || [];
      t.slice(1).forEach(function (tag) {
        if (tag && STANDARD_TYPES.indexOf(tag) === -1) tagSet.add(tag);
      });
    });
    const customTags = Array.from(tagSet).sort();

    // No auth yet, so the first member is treated as "you".
    const members = users.map(function (u, i) {
      return {
        name: u.name || 'Member',
        role: i === 0 ? 'You' : null,
        initial: (u.name || '?').trim().charAt(0).toUpperCase() || '?'
      };
    });

    return {
      family: { family_id: family.family_id, name: family.name },
      members: members,
      currentUserName: users.length ? users[0].name : null,
      posts: postViews,
      customTags: customTags,
      stats: {
        members: users.length,
        posts: postViews.length,
        shared: postViews.filter(function (p) { return p.isPublished; }).length
      }
    };
  }

  /**
   * Data for a single post's detail page (post.html?id=<post_id>).
   * Returns a PostView (see toPostView) extended with:
   *   familyId:    number | null
   *   tags:        string[]
   *   ingredients: string[]   // not in the base schema yet — read if present
   *   steps:       string[]   // not in the base schema yet — read if present
   * Returns null when the id is missing/invalid or no such post exists.
   * Throws if the database is unreachable — the caller renders an error state.
   */
  async function loadPostView(postId) {
    const id = Number(postId);
    if (!id || Number.isNaN(id)) return null;
    await ready();

    const post = await getPostById(id);
    if (!post) return null;

    const author = post.poster_id != null ? await getUserById(post.poster_id) : null;
    const usersById = new Map(author ? [[author.user_id, author]] : []);

    const view = toPostView(post, usersById);
    view.familyId = post.family_id != null ? post.family_id : null;
    view.tags = Array.isArray(post.tags) ? post.tags.map(String) : [];
    // `ingredients` / `steps` aren't persisted by the current schema. They're
    // read opportunistically so a richer recipe post renders those sections;
    // absent, the detail page simply hides them.
    view.ingredients = Array.isArray(post.ingredients) ? post.ingredients.map(String) : [];
    view.steps = Array.isArray(post.steps) ? post.steps.map(String) : [];
    return view;
  }

  /**
   * Data for the community archive (community.html).
   * Returns { posts } where each entry is a PostView (see toPostView) extended
   * with:
   *   culture:     string | null   // first tag, title-cased (e.g. "Korean")
   *   contributor: string | null   // "The Wong Family" / author name
   *   tags:        string[]
   * Posts are newest first. Only published posts are included.
   * Throws if the database is unreachable — the caller renders an error state.
   */
  async function loadCommunityView() {
    await ready();
    const [posts, users, families] = await Promise.all([
      getPublishedPosts(),
      getAllUsers(),
      getFamilies()
    ]);

    const usersById = new Map(users.map(function (u) { return [u.user_id, u]; }));
    const familiesById = new Map(families.map(function (f) { return [f.family_id, f]; }));

    const list = posts
      .slice()
      .sort(byNewest)
      .map(function (post) {
        const view = toPostView(post, usersById);
        const tags = Array.isArray(post.tags) ? post.tags.map(String) : [];
        const family = familiesById.get(post.family_id);
        view.tags = tags;
        view.culture = tags.length
          ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1)
          : null;
        view.contributor = family && family.name
          ? family.name
          : (view.authorName || null);
        return view;
      });

    return { posts: list };
  }

  /**
   * Data for the Saved page (saved.html).
   * `entries` is the bookmark list from bookmarks.js: [{ id, source }], already
   * in the order they should display. Returns { items } where each item is:
   *   { id, title, category, source, contributor, imageSrc }
   * Bookmarks whose post no longer exists are silently dropped.
   * Throws if the database is unreachable — the caller renders an error state.
   */
  async function loadSavedView(entries) {
    await ready();
    const list = Array.isArray(entries) ? entries : [];
    const ids = list.map(function (e) { return Number(e.id); }).filter(Boolean);
    if (!ids.length) return { items: [] };

    const sourceById = new Map(list.map(function (e) { return [Number(e.id), e.source]; }));

    const [posts, users, families] = await Promise.all([
      Promise.all(ids.map(function (id) { return getPostById(id); })),
      getAllUsers(),
      getFamilies()
    ]);

    const usersById = new Map(users.map(function (u) { return [u.user_id, u]; }));
    const familiesById = new Map(families.map(function (f) { return [f.family_id, f]; }));

    const items = posts
      .map(function (post) {
        if (!post) return null; // bookmarked post was deleted
        const view = toPostView(post, usersById);
        const family = familiesById.get(post.family_id);
        return {
          id: view.id,
          title: view.title,
          category: view.category,
          source: sourceById.get(view.id) === 'Community' ? 'Community' : 'Family',
          contributor: family && family.name ? family.name : (view.authorName || null),
          imageSrc: view.imageSrc
        };
      })
      .filter(Boolean);

    return { items: items };
  }

  global.appData = {
    getCurrentFamily: getCurrentFamily,
    loadHomeView: loadHomeView,
    loadFamilyView: loadFamilyView,
    loadPostView: loadPostView,
    loadCommunityView: loadCommunityView,
    loadSavedView: loadSavedView
  };
})(window);
