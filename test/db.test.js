// db.test.js — tests for the CRUD helpers in db.js
// (moved to test/ to match new layout)
//
// Runs in the browser. Open tests.html via a local server
// (npx serve  /  python3 -m http.server) — not file://.

// Uses a tiny home-grown harness so there is no framework/build step,
// matching the rest of the project.

// Every test reports three things and the report shows all of them,
// pass or fail:
//   - input:    what was fed into the function(s) under test
//   - expected: what the function(s) should produce
//   - actual:   what they actually produced this run
// A test passes when `expected` deep-equals `actual`.

// ---------- Minimal test harness ----------

const _results = [];

// Wipe every table so each test starts from a known-empty database.
async function resetDb() {
  await Promise.all([
    db.families.clear(),
    db.users.clear(),
    db.posts.clear()
  ]);
}

// Structural equality for plain values/arrays/objects (enough for these tests).
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual(a[k], b[k]));
}

// Each `fn` returns { input, expected, actual }.
async function test(name, fn) {
  await resetDb();
  let input, expected, actual, error = null, pass = false, graphic;
  try {
    const r = await fn();
    input = r.input;
    expected = r.expected;
    actual = r.actual;
    // optional graphic payload produced by tests that render visuals
    graphic = r.graphic;
    pass = deepEqual(expected, actual);
  } catch (err) {
    error = err && err.message ? err.message : String(err);
  }
  _results.push({ name, input, expected, actual, graphic, error, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}`, { input, expected, actual, error });
}

function fmt(v) {
  if (v === undefined) return 'undefined';
  return JSON.stringify(v, null, 2);
}

// Render the full report into the page once all tests have finished.
function renderReport() {
  const list = document.getElementById('results');
  const summary = document.getElementById('summary');
  const passed = _results.filter(r => r.pass).length;
  const failed = _results.length - passed;

  for (const r of _results) {
    const li = document.createElement('li');
    li.className = r.pass ? 'pass' : 'fail';

    const head = document.createElement('div');
    head.className = 'head';
    head.textContent = `${r.pass ? '✓' : '✗'} ${r.name}`;
    li.appendChild(head);

    const addBlock = (label, value) => {
      const wrap = document.createElement('div');
      wrap.className = 'block';
      const tag = document.createElement('span');
      tag.className = 'label';
      tag.textContent = label;
      wrap.appendChild(tag);

      // Render graphics as HTML so visual outputs appear in the report.
      if (label === 'graphic' && typeof value === 'string') {
        const container = document.createElement('div');
        container.className = 'graphic';
        container.innerHTML = value;
        wrap.appendChild(container);
        // After insertion, attempt to enhance the graph (draw edges) if available.
        if (typeof window.enhanceGraph === 'function') {
          try { window.enhanceGraph(container); } catch (e) { console.warn('enhanceGraph error', e); }
        }
      } else {
        const pre = document.createElement('pre');
        pre.textContent = value;
        wrap.appendChild(pre);
      }

      li.appendChild(wrap);
    };

    addBlock('input', fmt(r.input));
    addBlock('expected', fmt(r.expected));
    addBlock('actual', r.error ? `(threw) ${r.error}` : fmt(r.actual));
    if (r.graphic !== undefined) addBlock('graphic', r.graphic);

    list.appendChild(li);
  }

  summary.textContent = `${passed} passed, ${failed} failed (${_results.length} total)`;
  summary.style.color = failed ? '#611a15' : '#1e4620';
}

// ---------- Families ----------

async function familyTests() {
  await test('createFamily returns a numeric id and persists the row', async () => {
    const input = { name: 'Nguyen' };
    const id = await createFamily(input.name);
    const row = await db.families.get(id);
    return {
      input,
      expected: { idIsNumber: true, storedName: 'Nguyen' },
      actual: { idIsNumber: typeof id === 'number', storedName: row ? row.name : null }
    };
  });

  await test('getFamilies returns every family created', async () => {
    const input = { create: ['Nguyen', 'Okafor'] };
    for (const n of input.create) await createFamily(n);
    const families = await getFamilies();
    return {
      input,
      expected: { count: 2, names: ['Nguyen', 'Okafor'] },
      actual: { count: families.length, names: families.map(f => f.name).sort() }
    };
  });

  await test('getFamilies returns an empty array when there are none', async () => {
    const input = { create: [] };
    const families = await getFamilies();
    return {
      input,
      expected: { isArray: true, count: 0 },
      actual: { isArray: Array.isArray(families), count: families.length }
    };
  });
}

// ---------- Users ----------

async function userTests() {
  await test('createUser persists all provided fields', async () => {
    const familyId = await createFamily('Nguyen');
    const input = { name: 'Mai', family_id: familyId, email: 'mai@example.com', phone: '0400000000' };
    const userId = await createUser(input);
    const row = await db.users.get(userId);
    return {
      input,
      expected: { name: 'Mai', family_id: familyId, email: 'mai@example.com', phone: '0400000000' },
      actual: { name: row.name, family_id: row.family_id, email: row.email, phone: row.phone }
    };
  });

  await test('getUsersByFamily only returns members of that family', async () => {
    const a = await createFamily('Nguyen');
    const b = await createFamily('Okafor');
    const input = {
      familyA_id: a,
      familyB_id: b,
      users: [
        { name: 'Mai', family_id: a },
        { name: 'Linh', family_id: a },
        { name: 'Chidi', family_id: b }
      ],
      query: { family_id: a }
    };
    for (const u of input.users) {
      await createUser({ name: u.name, family_id: u.family_id, email: `${u.name}@example.com`, phone: '0' });
    }
    const familyA = await getUsersByFamily(a);
    return {
      input,
      expected: { count: 2, allInFamilyA: true },
      actual: { count: familyA.length, allInFamilyA: familyA.every(u => u.family_id === a) }
    };
  });
}

// ---------- Posts ----------

async function postTests() {
  await test('createPost sets defaults (tags, arrays, created_at, unpublished)', async () => {
    const familyId = await createFamily('Nguyen');
    const input = {
      poster_id: 1,
      family_id: familyId,
      title: 'Pho broth',
      description: 'Simmer bones 6 hours',
      file: null,
      category: 'recipe'
    };
    const postId = await createPost(input);
    const row = await db.posts.get(postId);
    return {
      input,
      expected: {
        title: 'Pho broth', category: 'recipe',
        tags: [], mentioned: [], liked_by: [],
        adapted_from: null, is_published: false, createdAtIsDate: true,
        country: null, lat: null, lng: null
      },
      actual: {
        title: row.title, category: row.category,
        tags: row.tags, mentioned: row.mentioned, liked_by: row.liked_by,
        adapted_from: row.adapted_from, is_published: row.is_published,
        createdAtIsDate: row.created_at instanceof Date,
        country: row.country, lat: row.lat, lng: row.lng
      }
    };
  });

  await test('createPost stores country/lat/lng when the form provides them', async () => {
    const familyId = await createFamily('Nguyen');
    const input = {
      poster_id: 1, family_id: familyId, title: 'Phở', description: '', file: null,
      category: 'recipe', country: 'Vietnam', lat: 14.058, lng: 108.277
    };
    const postId = await createPost(input);
    const row = await db.posts.get(postId);
    return {
      input,
      expected: { country: 'Vietnam', lat: 14.058, lng: 108.277 },
      actual: { country: row.country, lat: row.lat, lng: row.lng }
    };
  });

  await test('createPost stores a specific location (place + exact lat/lng)', async () => {
    const familyId = await createFamily('Nguyen');
    const input = {
      poster_id: 1, family_id: familyId, title: 'Nonna’s ragù', description: '', file: null,
      category: 'recipe', country: 'Italy',
      place: "Nonna's kitchen, Leichhardt NSW", lat: -33.883, lng: 151.157
    };
    const postId = await createPost(input);
    const row = await db.posts.get(postId);
    return {
      input,
      expected: { place: "Nonna's kitchen, Leichhardt NSW", lat: -33.883, lng: 151.157 },
      actual: { place: row.place, lat: row.lat, lng: row.lng }
    };
  });

  await test('createPost defaults place to null when the form omits it', async () => {
    const familyId = await createFamily('Nguyen');
    const postId = await createPost({
      poster_id: 1, family_id: familyId, title: 'No place', description: '', file: null, category: 'recipe'
    });
    const row = await db.posts.get(postId);
    return {
      input: { note: 'no place field passed' },
      expected: { place: null },
      actual: { place: row.place }
    };
  });

  await test('getFamilyPosts returns only that family\'s posts', async () => {
    const a = await createFamily('Nguyen');
    const b = await createFamily('Okafor');
    const input = {
      familyA_id: a,
      familyB_id: b,
      posts: [
        { title: 'A1', family_id: a, category: 'recipe' },
        { title: 'A2', family_id: a, category: 'story' },
        { title: 'B1', family_id: b, category: 'remedy' }
      ],
      query: { family_id: a }
    };
    for (const p of input.posts) {
      await createPost({ poster_id: 1, family_id: p.family_id, title: p.title, description: '', file: null, category: p.category });
    }
    const posts = await getFamilyPosts(a);
    return {
      input,
      expected: { count: 2, allInFamilyA: true },
      actual: { count: posts.length, allInFamilyA: posts.every(p => p.family_id === a) }
    };
  });

  await test('publishPost flips is_published and getPublishedPosts picks it up', async () => {
    const familyId = await createFamily('Nguyen');
    const draftId = await createPost({ poster_id: 1, family_id: familyId, title: 'Draft', description: '', file: null, category: 'recipe' });
    const publishedId = await createPost({ poster_id: 1, family_id: familyId, title: 'Live', description: '', file: null, category: 'recipe' });
    const input = { posts: { draftId, publishedId }, action: `publishPost(${publishedId})` };

    await publishPost(publishedId);
    const published = await getPublishedPosts();
    return {
      input,
      expected: { publishedCount: 1, returnedId: publishedId, draftExcluded: true },
      actual: {
        publishedCount: published.length,
        returnedId: published[0] ? published[0].post_id : null,
        draftExcluded: !published.some(p => p.post_id === draftId)
      }
    };
  });

  await test('setPostPublished(id, bool) toggles community visibility both ways', async () => {
    const familyId = await createFamily('Nguyen');
    const postId = await createPost({ poster_id: 1, family_id: familyId, title: 'Chai', description: '', file: null, category: 'recipe' });
    const input = { action: 'setPostPublished(id, true) then setPostPublished(id, false)' };

    await setPostPublished(postId, true);
    const afterPublish = await getPublishedPosts();
    const rowAfterPublish = await db.posts.get(postId);

    await setPostPublished(postId, false);
    const afterUnpublish = await getPublishedPosts();
    const rowAfterUnpublish = await db.posts.get(postId);

    return {
      input,
      expected: { publishedShows: true, storedWhenPublic: 1, publishedHides: true, storedWhenPrivate: 0 },
      actual: {
        publishedShows: afterPublish.some(p => p.post_id === postId),
        storedWhenPublic: rowAfterPublish.is_published,
        publishedHides: !afterUnpublish.some(p => p.post_id === postId),
        storedWhenPrivate: rowAfterUnpublish.is_published
      }
    };
  });

  await test('getLineage walks adapted_from back to the original', async () => {
    const familyId = await createFamily('Nguyen');
    const gen1 = await createPost({ poster_id: 1, family_id: familyId, title: 'Grandma pho', description: '', file: null, category: 'recipe' });
    const gen2 = await createPost({ poster_id: 2, family_id: familyId, title: 'Mum pho', description: '', file: null, category: 'recipe', adapted_from: gen1 });
    const gen3 = await createPost({ poster_id: 3, family_id: familyId, title: 'My pho', description: '', file: null, category: 'recipe', adapted_from: gen2 });
    const input = { chain: { gen1, gen2, gen3 }, query: `getLineage(${gen3})` };

    const result = await getLineage(gen3);
    return {
      input,
      expected: { length: 3, firstId: gen3, lastId: gen1 },
      actual: {
        length: result.length,
        firstId: result[0] ? result[0].post_id : null,
        lastId: result.length ? result[result.length - 1].post_id : null
      }
    };
  });

  await test('getLineage returns a single-item chain for an original post', async () => {
    const familyId = await createFamily('Nguyen');
    const gen1 = await createPost({ poster_id: 1, family_id: familyId, title: 'Original', description: '', file: null, category: 'recipe' });
    const input = { post: { gen1 }, query: `getLineage(${gen1})` };

    const result = await getLineage(gen1);
    return {
      input,
      expected: { length: 1, firstId: gen1 },
      actual: { length: result.length, firstId: result[0] ? result[0].post_id : null }
    };
  });

  await test('getRelatedPosts returns posts sharing a tag, excluding itself', async () => {
    const familyId = await createFamily('Nguyen');
    const base = await createPost({ poster_id: 1, family_id: familyId, title: 'Base', description: '', file: null, category: 'recipe', tags: ['soup', 'vietnamese'] });
    const shares = await createPost({ poster_id: 2, family_id: familyId, title: 'Shares soup', description: '', file: null, category: 'recipe', tags: ['soup', 'korean'] });
    const unrelated = await createPost({ poster_id: 3, family_id: familyId, title: 'Unrelated', description: '', file: null, category: 'story', tags: ['music'] });
    const input = {
      posts: {
        base: { id: base, tags: ['soup', 'vietnamese'] },
        shares: { id: shares, tags: ['soup', 'korean'] },
        unrelated: { id: unrelated, tags: ['music'] }
      },
      query: `getRelatedPosts(${base})`
    };

    const related = await getRelatedPosts(base);
    return {
      input,
      expected: { count: 1, relatedId: shares, excludesSelf: true },
      actual: {
        count: related.length,
        relatedId: related[0] ? related[0].post_id : null,
        excludesSelf: !related.some(p => p.post_id === base)
      }
    };
  });

  await test('getRelatedPosts returns [] for a post with no tags', async () => {
    const familyId = await createFamily('Nguyen');
    const post = await createPost({ poster_id: 1, family_id: familyId, title: 'No tags', description: '', file: null, category: 'recipe' });
    const input = { post: { id: post, tags: [] }, query: `getRelatedPosts(${post})` };

    const related = await getRelatedPosts(post);
    return {
      input,
      expected: { isArray: true, count: 0 },
      actual: { isArray: Array.isArray(related), count: related.length }
    };
  });
}

// ---------- Full adaptation tree (getFullTree) ----------
//
// Tree shape used by these tests:
//
//        root
//        /  \
//     childA  childB
//       |
//   grandchild
//
async function fullTreeTests() {
  // Helper: build the tree above and return the ids.
  async function buildTree() {
    const familyId = await createFamily('Nguyen');
    const mk = (title, adapted_from = null) =>
      createPost({ poster_id: 1, family_id: familyId, title, description: '', file: null, category: 'recipe', adapted_from });
    const root = await mk('root');
    const childA = await mk('childA', root);
    const childB = await mk('childB', root);
    const grandchild = await mk('grandchild', childA);
    return { root, childA, childB, grandchild };
  }

  await test('getFullTree from the root returns every node in the tree', async () => {
    const t = await buildTree();
    const input = { tree: t, query: `getFullTree(${t.root})` };

    const result = await getFullTree(t.root);
    const html = (typeof renderTreeAsHtml === 'function') ? renderTreeAsHtml(result) : null;
    return {
      input,
      expected: { count: 4, ids: [t.root, t.childA, t.childB, t.grandchild].sort((a, b) => a - b) },
      actual: { count: result.nodes.length, ids: result.nodes.map(n => n.post_id).sort((a, b) => a - b) },
      graphic: html
    };
  });

  await test('getFullTree from a leaf still returns the whole tree (siblings + cousins visible)', async () => {
    const t = await buildTree();
    const input = { tree: t, query: `getFullTree(${t.grandchild})  // deepest leaf` };

    const result = await getFullTree(t.grandchild);
    const ids = result.nodes.map(n => n.post_id).sort((a, b) => a - b);
    const html = (typeof renderTreeAsHtml === 'function') ? renderTreeAsHtml(result) : null;
    return {
      input,
      expected: { count: 4, includesSiblingBranch: true, ids: [t.root, t.childA, t.childB, t.grandchild].sort((a, b) => a - b) },
      actual: { count: result.nodes.length, includesSiblingBranch: ids.includes(t.childB), ids },
      graphic: html
    };
  });

  await test('getFullTree derives one edge per non-root node (from adapted_from)', async () => {
    const t = await buildTree();
    const input = { tree: t, query: `getFullTree(${t.childB})` };

    const result = await getFullTree(t.childB);
    const edges = result.edges;
    const norm = edges.map(e => `${e.from}->${e.to}`).sort();
    const html = (typeof renderTreeAsHtml === 'function') ? renderTreeAsHtml(result) : null;
    return {
      input,
      expected: {
        count: 3,
        edges: [`${t.root}->${t.childA}`, `${t.root}->${t.childB}`, `${t.childA}->${t.grandchild}`].sort()
      },
      actual: { count: edges.length, edges: norm },
      graphic: html
    };
  });

  await test('getFullTree on a lone post returns just that node and no edges', async () => {
    const familyId = await createFamily('Nguyen');
    const lone = await createPost({ poster_id: 1, family_id: familyId, title: 'Lone', description: '', file: null, category: 'recipe' });
    const input = { post: { id: lone }, query: `getFullTree(${lone})` };

    const result = await getFullTree(lone);
    const html = (typeof renderTreeAsHtml === 'function') ? renderTreeAsHtml(result) : null;
    return {
      input,
      expected: { nodeCount: 1, nodeId: lone, edgeCount: 0 },
      actual: { nodeCount: result.nodes.length, nodeId: result.nodes[0] ? result.nodes[0].post_id : null, edgeCount: result.edges.length },
      graphic: html
    };
  });

  await test('getFullTree on a missing post id returns empty nodes and edges', async () => {
    const input = { post_id: 999999, query: 'getFullTree(999999)' };
    const result = await getFullTree(999999);
    const html = (typeof renderTreeAsHtml === 'function') ? renderTreeAsHtml(result) : null;
    return {
      input,
      expected: { nodeCount: 0, edgeCount: 0 },
      actual: { nodeCount: result.nodes.length, edgeCount: result.edges.length },
      graphic: html
    };
  });
}

// ---------- Run everything ----------

(async function run() {
  await familyTests();
  await userTests();
  await postTests();
  await fullTreeTests();
  if (typeof treeRendererTests === 'function') await treeRendererTests();
  if (typeof seedTests === 'function') await seedTests();
  renderReport();
})();
