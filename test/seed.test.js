// seed.test.js — the demo showcase seed (src/seed.js).
//
// Runs in the shared browser harness (see db.test.js). tests.html loads
// db.js + seed.js before this file. Each test calls showcaseSeed.clear()
// first (which also resets the internal "already seeded" memo).

async function seedTests() {

  // ---- DATA shape (no database) ----
  await test('showcase DATA describes three well-formed lineages', async () => {
    const D = window.showcaseSeed.DATA;
    const keys = D.posts.map(p => p.key);
    const roots = D.posts.filter(p => p.from === null);
    const danglingFrom = D.posts.filter(p => p.from !== null && !keys.includes(p.from));
    const published = D.posts.filter(p => p.published);

    return {
      input: { postCount: D.posts.length, userCount: D.users.length },
      expected: {
        posts: 11, users: 3,
        roots: 3,               // dumplings + flatbread + ragù
        uniqueKeys: true, danglingParents: 0,
        published: 10, private: 1
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

  // ---- reseed() writes every lineage ----
  await test('reseed() populates families, users and posts', async () => {
    await window.showcaseSeed.clear();
    const { rootPostId } = await window.showcaseSeed.reseed();

    const [families, users, posts, published, root] = await Promise.all([
      db.families.count(), db.users.count(), db.posts.count(),
      getPublishedPosts(), db.posts.get(rootPostId)
    ]);

    return {
      input: {},
      expected: { families: 1, users: 3, posts: 11, published: 10, rootTitle: "Popo's Lunar New Year Jiaozi" },
      actual: {
        families, users, posts,
        published: published.length,
        rootTitle: root ? root.title : null
      }
    };
  });

  // ---- the standalone pairs are their own 2-node trees ----
  await test('reseed() keeps the standalone pairs separate from the dumpling tree', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();

    const flatOg = await db.posts.filter(p => p.title.indexOf('Saj Flatbread') !== -1).first();
    const raguNew = await db.posts.filter(p => p.title === 'Slow-Cooker Ragù').first();
    const flatTree = await getFullTree(flatOg.post_id);
    const raguTree = await getFullTree(raguNew.post_id); // start from the child

    return {
      input: {},
      expected: {
        flatbreadNodes: 2, flatbreadEdges: 1,
        raguNodes: 2, raguEdges: 1,
        raguRootTitle: "Nonna Rosa's Sunday Ragù"
      },
      actual: {
        flatbreadNodes: flatTree.nodes.length,
        flatbreadEdges: flatTree.edges.length,
        raguNodes: raguTree.nodes.length,
        raguEdges: raguTree.edges.length,
        raguRootTitle: raguTree.nodes[0] ? raguTree.nodes[0].title : null
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

  // ---- locations: most mappable, a couple not ----
  await test('reseed() sets coordinates on 9 posts and countries on 10', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();
    const posts = await db.posts.toArray();

    return {
      input: {},
      expected: { withCoords: 9, withCountry: 10, chinaPosts: 3, australiaPosts: 2 },
      actual: {
        withCoords: posts.filter(p => p.lat != null && p.lng != null).length,
        withCountry: posts.filter(p => p.country).length,
        chinaPosts: posts.filter(p => p.country === 'China').length,
        australiaPosts: posts.filter(p => p.country === 'Australia').length
      }
    };
  });

  // ---- images: every seeded post carries a bundled /resource photo ----
  await test('reseed() gives every post a bundled /resource image', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();
    const posts = await db.posts.toArray();
    const withImage = posts.filter(p => typeof p.file === 'string' && p.file.indexOf('/resource/') === 0);

    return {
      input: {},
      expected: { total: 11, withResourceImage: 11 },
      actual: { total: posts.length, withResourceImage: withImage.length }
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
      expected: { seededWhenEmpty: true, countAfterEmpty: 11, seededWhenPopulated: false, countAfterPopulated: 11 },
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
