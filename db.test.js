// db.test.js — tests for the CRUD helpers in db.js
//
// Runs in the browser. Open tests.html via a local server
// (npx serve  /  python3 -m http.server) — not file://.
//
// Uses a tiny home-grown harness so there is no framework/build step,
// matching the rest of the project.

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

async function test(name, fn) {
  try {
    await resetDb();
    await fn();
    _results.push({ name, pass: true });
    console.log('PASS —', name);
  } catch (err) {
    _results.push({ name, pass: false, error: err && err.message ? err.message : String(err) });
    console.error('FAIL —', name, err);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'values differ'} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Render the report into the page once all tests have finished.
function renderReport() {
  const list = document.getElementById('results');
  const summary = document.getElementById('summary');
  const passed = _results.filter(r => r.pass).length;
  const failed = _results.length - passed;

  for (const r of _results) {
    const li = document.createElement('li');
    li.className = r.pass ? 'pass' : 'fail';
    li.textContent = `${r.pass ? '✓' : '✗'} ${r.name}`;
    if (!r.pass) {
      const err = document.createElement('span');
      err.className = 'err';
      err.textContent = r.error;
      li.appendChild(err);
    }
    list.appendChild(li);
  }

  summary.textContent = `${passed} passed, ${failed} failed (${_results.length} total)`;
  summary.style.color = failed ? '#611a15' : '#1e4620';
}

// ---------- Families ----------

async function familyTests() {
  await test('createFamily returns a numeric id and persists the row', async () => {
    const id = await createFamily('Nguyen');
    assert(typeof id === 'number', 'id should be a number');
    const row = await db.families.get(id);
    assertEqual(row.name, 'Nguyen', 'stored family name');
  });

  await test('getFamilies returns every family created', async () => {
    await createFamily('Nguyen');
    await createFamily('Okafor');
    const families = await getFamilies();
    assertEqual(families.length, 2, 'family count');
    const names = families.map(f => f.name).sort();
    assertEqual(names.join(','), 'Nguyen,Okafor', 'family names');
  });

  await test('getFamilies returns an empty array when there are none', async () => {
    const families = await getFamilies();
    assert(Array.isArray(families) && families.length === 0, 'should be empty array');
  });
}

// ---------- Users ----------

async function userTests() {
  await test('createUser persists all provided fields', async () => {
    const familyId = await createFamily('Nguyen');
    const userId = await createUser({
      name: 'Mai',
      family_id: familyId,
      email: 'mai@example.com',
      phone: '0400000000'
    });
    const row = await db.users.get(userId);
    assertEqual(row.name, 'Mai', 'name');
    assertEqual(row.family_id, familyId, 'family_id');
    assertEqual(row.email, 'mai@example.com', 'email');
    assertEqual(row.phone, '0400000000', 'phone');
  });

  await test('getUsersByFamily only returns members of that family', async () => {
    const a = await createFamily('Nguyen');
    const b = await createFamily('Okafor');
    await createUser({ name: 'Mai', family_id: a, email: 'mai@example.com', phone: '1' });
    await createUser({ name: 'Linh', family_id: a, email: 'linh@example.com', phone: '2' });
    await createUser({ name: 'Chidi', family_id: b, email: 'chidi@example.com', phone: '3' });

    const familyA = await getUsersByFamily(a);
    assertEqual(familyA.length, 2, 'family A user count');
    assert(familyA.every(u => u.family_id === a), 'all belong to family A');
  });
}

// ---------- Posts ----------

async function postTests() {
  await test('createPost sets defaults (tags, arrays, created_at, unpublished)', async () => {
    const familyId = await createFamily('Nguyen');
    const postId = await createPost({
      poster_id: 1,
      family_id: familyId,
      title: 'Pho broth',
      description: 'Simmer bones 6 hours',
      file: null,
      category: 'recipe'
    });
    const row = await db.posts.get(postId);
    assertEqual(row.title, 'Pho broth', 'title');
    assertEqual(row.category, 'recipe', 'category');
    assert(Array.isArray(row.tags) && row.tags.length === 0, 'tags defaults to []');
    assert(Array.isArray(row.mentioned) && row.mentioned.length === 0, 'mentioned defaults to []');
    assert(Array.isArray(row.liked_by) && row.liked_by.length === 0, 'liked_by defaults to []');
    assertEqual(row.adapted_from, null, 'adapted_from defaults to null');
    assertEqual(row.is_published, false, 'is_published defaults to false');
    assert(row.created_at instanceof Date, 'created_at is a Date');
  });

  await test('getFamilyPosts returns only that family\'s posts', async () => {
    const a = await createFamily('Nguyen');
    const b = await createFamily('Okafor');
    await createPost({ poster_id: 1, family_id: a, title: 'A1', description: '', file: null, category: 'recipe' });
    await createPost({ poster_id: 1, family_id: a, title: 'A2', description: '', file: null, category: 'story' });
    await createPost({ poster_id: 2, family_id: b, title: 'B1', description: '', file: null, category: 'remedy' });

    const posts = await getFamilyPosts(a);
    assertEqual(posts.length, 2, 'family A post count');
    assert(posts.every(p => p.family_id === a), 'all belong to family A');
  });

  await test('publishPost flips is_published and getPublishedPosts picks it up', async () => {
    const familyId = await createFamily('Nguyen');
    const draftId = await createPost({ poster_id: 1, family_id: familyId, title: 'Draft', description: '', file: null, category: 'recipe' });
    const publishedId = await createPost({ poster_id: 1, family_id: familyId, title: 'Live', description: '', file: null, category: 'recipe' });

    await publishPost(publishedId);

    const published = await getPublishedPosts();
    assertEqual(published.length, 1, 'exactly one published post');
    assertEqual(published[0].post_id, publishedId, 'the published one is returned');
    assert(!published.some(p => p.post_id === draftId), 'draft is not returned');
  });

  await test('getLineage walks adapted_from back to the original', async () => {
    const familyId = await createFamily('Nguyen');
    const gen1 = await createPost({ poster_id: 1, family_id: familyId, title: 'Grandma pho', description: '', file: null, category: 'recipe' });
    const gen2 = await createPost({ poster_id: 2, family_id: familyId, title: 'Mum pho', description: '', file: null, category: 'recipe', adapted_from: gen1 });
    const gen3 = await createPost({ poster_id: 3, family_id: familyId, title: 'My pho', description: '', file: null, category: 'recipe', adapted_from: gen2 });

    const chain = await getLineage(gen3);
    assertEqual(chain.length, 3, 'three posts in the chain');
    assertEqual(chain[0].post_id, gen3, 'starts at the requested post');
    assertEqual(chain[chain.length - 1].post_id, gen1, 'ends at the original');
  });

  await test('getLineage returns a single-item chain for an original post', async () => {
    const familyId = await createFamily('Nguyen');
    const gen1 = await createPost({ poster_id: 1, family_id: familyId, title: 'Original', description: '', file: null, category: 'recipe' });
    const chain = await getLineage(gen1);
    assertEqual(chain.length, 1, 'chain length');
    assertEqual(chain[0].post_id, gen1, 'the post itself');
  });

  await test('getRelatedPosts returns posts sharing a tag, excluding itself', async () => {
    const familyId = await createFamily('Nguyen');
    const base = await createPost({ poster_id: 1, family_id: familyId, title: 'Base', description: '', file: null, category: 'recipe', tags: ['soup', 'vietnamese'] });
    const shares = await createPost({ poster_id: 2, family_id: familyId, title: 'Shares soup', description: '', file: null, category: 'recipe', tags: ['soup', 'korean'] });
    await createPost({ poster_id: 3, family_id: familyId, title: 'Unrelated', description: '', file: null, category: 'story', tags: ['music'] });

    const related = await getRelatedPosts(base);
    assertEqual(related.length, 1, 'one related post');
    assertEqual(related[0].post_id, shares, 'the tag-sharing post');
    assert(!related.some(p => p.post_id === base), 'excludes the post itself');
  });

  await test('getRelatedPosts returns [] for a post with no tags', async () => {
    const familyId = await createFamily('Nguyen');
    const post = await createPost({ poster_id: 1, family_id: familyId, title: 'No tags', description: '', file: null, category: 'recipe' });
    const related = await getRelatedPosts(post);
    assert(Array.isArray(related) && related.length === 0, 'should be empty array');
  });
}

// ---------- Run everything ----------

(async function run() {
  await familyTests();
  await userTests();
  await postTests();
  renderReport();
})();
