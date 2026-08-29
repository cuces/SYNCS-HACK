// seed.test.js — the demo showcase seed (src/seed.js).
//
// Runs in the shared browser harness (see db.test.js). tests.html loads
// db.js + seed.js before this file. Each test calls showcaseSeed.clear()
// first (which also resets the internal "already seeded" memo).

async function seedTests() {

  // ---- DATA shape (no database) ----
  await test('showcase DATA describes one well-formed lineage', async () => {
    const D = window.showcaseSeed.DATA;
    const keys = D.posts.map(p => p.key);
    const roots = D.posts.filter(p => p.from === null);
    const danglingFrom = D.posts.filter(p => p.from !== null && !keys.includes(p.from));
    const published = D.posts.filter(p => p.published);

    return {
      input: { postCount: D.posts.length, userCount: D.users.length },
      expected: {
        posts: 7, users: 3, roots: 1,
        uniqueKeys: true, danglingParents: 0,
        published: 6, private: 1
      },
      actual: {
        posts: D.posts.length,
        users: D.users.length,
        roots: roots.length,
        uniqueKeys: new Set(keys).size === keys.length,
        danglingParents: danglingFrom.length,
        published: published.length,
        private: D.posts.length - published.length
      }
    };
  });

  // ---- reseed() writes the whole tree ----
  await test('reseed() populates families, users and posts', async () => {
    await window.showcaseSeed.clear();
    const { rootPostId } = await window.showcaseSeed.reseed();

    const [families, users, posts, published, root] = await Promise.all([
      db.families.count(), db.users.count(), db.posts.count(),
      getPublishedPosts(), db.posts.get(rootPostId)
    ]);

    return {
      input: {},
      expected: { families: 1, users: 3, posts: 7, published: 6, rootTitle: "Popo's Lunar New Year Jiaozi" },
      actual: {
        families, users, posts,
        published: published.length,
        rootTitle: root ? root.title : null
      }
    };
  });

  // ---- adapted_from is wired up so lineage walks work ----
  await test('reseed() links adapted_from — momo traces back through mandu, potstickers, jiaozi', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();

    const momo = await db.posts.filter(p => p.title.indexOf('Momo') !== -1).first();
    const chain = await getLineage(momo.post_id);

    return {
      input: { from: momo.title },
      expected: {
        chainTitles: ['Thamel Momo with Tomato Achar', 'Kimchi Mandu (from our neighbour Jisoo)',
                      "Mum's Pan-Fried Potstickers", "Popo's Lunar New Year Jiaozi"]
      },
      actual: { chainTitles: chain.map(p => p.title) }
    };
  });

  // ---- getFullTree over the seeded data ----
  await test('reseed() produces a 7-node / 6-edge tree from the root', async () => {
    await window.showcaseSeed.clear();
    const { rootPostId } = await window.showcaseSeed.reseed();
    const tree = await getFullTree(rootPostId);

    return {
      input: { rootPostId },
      expected: { nodes: 7, edges: 6 },
      actual: { nodes: tree.nodes.length, edges: tree.edges.length }
    };
  });

  // ---- locations: 5 mappable, 2 not ----
  await test('reseed() sets coordinates on 5 posts and countries on 6', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();
    const posts = await db.posts.toArray();

    return {
      input: {},
      expected: { withCoords: 5, withCountry: 6, chinaPosts: 3 },
      actual: {
        withCoords: posts.filter(p => p.lat != null && p.lng != null).length,
        withCountry: posts.filter(p => p.country).length,
        chinaPosts: posts.filter(p => p.country === 'China').length
      }
    };
  });

  // ---- ensure() only seeds an empty archive ----
  await test('ensure() seeds when empty but never on top of existing data', async () => {
    // empty -> ensure seeds it
    await window.showcaseSeed.clear();
    const onEmpty = await window.showcaseSeed.ensure();
    const countAfterEmpty = await db.posts.count();

    // populated + fresh memo -> ensure sees the data and does nothing
    await window.showcaseSeed.clear();       // resets the memo
    await window.showcaseSeed.reseed();      // 7 posts
    const onPopulated = await window.showcaseSeed.ensure();
    const countAfterPopulated = await db.posts.count();

    return {
      input: {},
      expected: { seededWhenEmpty: true, countAfterEmpty: 7, seededWhenPopulated: false, countAfterPopulated: 7 },
      actual: {
        seededWhenEmpty: onEmpty.seeded,
        countAfterEmpty,
        seededWhenPopulated: onPopulated.seeded,
        countAfterPopulated
      }
    };
  });

  // ---- clear() empties everything ----
  await test('clear() removes all seeded records', async () => {
    await window.showcaseSeed.reseed();
    await window.showcaseSeed.clear();
    const [families, users, posts] = await Promise.all([
      db.families.count(), db.users.count(), db.posts.count()
    ]);
    return {
      input: {},
      expected: { families: 0, users: 0, posts: 0 },
      actual: { families, users, posts }
    };
  });
}
