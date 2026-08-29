// seed.test.js — the demo showcase seed (src/seed.js).
//
// Runs in the shared browser harness (see db.test.js). tests.html loads
// db.js + seed.js before this file. Each test calls showcaseSeed.clear()
// first (which also resets the internal "already seeded" memo).

async function seedTests() {

  // ---- DATA shape (no database) ----
  await test('showcase DATA is well-formed (keys unique, parents resolve)', async () => {
    const D = window.showcaseSeed.DATA;
    const keys = D.posts.map(p => p.key);
    const roots = D.posts.filter(p => p.from === null);
    const danglingFrom = D.posts.filter(p => p.from !== null && !keys.includes(p.from));
    const published = D.posts.filter(p => p.published);

    return {
      input: { postCount: D.posts.length, userCount: D.users.length },
      expected: {
        posts: 20, users: 3,
        roots: 10,              // 3 recipe roots + 7 non-recipe memories
        uniqueKeys: true, danglingParents: 0,
        published: 18, private: 2
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
      expected: { families: 1, users: 3, posts: 20, published: 18, rootTitle: "Popo's Lunar New Year Jiaozi" },
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

  // ---- locations: most mappable, a few not ----
  await test('reseed() sets coordinates on 17 posts and countries on 18', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();
    const posts = await db.posts.toArray();

    return {
      input: {},
      expected: { withCoords: 17, withCountry: 18, chinaPosts: 6, australiaPosts: 3 },
      actual: {
        withCoords: posts.filter(p => p.lat != null && p.lng != null).length,
        withCountry: posts.filter(p => p.country).length,
        chinaPosts: posts.filter(p => p.country === 'China').length,
        australiaPosts: posts.filter(p => p.country === 'Australia').length
      }
    };
  });

  // ---- images: the food posts carry a bundled /resource photo; the non-recipe
  //      memories deliberately have none (they fall back to a category icon) ----
  await test('reseed() photographs the food posts and leaves the rest imageless', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();
    const posts = await db.posts.toArray();
    const withImage = posts.filter(p => typeof p.file === 'string' && p.file.indexOf('/resource/') === 0);
    const recipesImaged = posts
      .filter(p => p.category === 'recipe')
      .every(p => typeof p.file === 'string' && p.file.indexOf('/resource/') === 0);

    return {
      input: {},
      expected: { total: 20, withResourceImage: 11, everyRecipeImaged: true },
      actual: { total: posts.length, withResourceImage: withImage.length, everyRecipeImaged: recipesImaged }
    };
  });

  // ---- backfillImages() heals an archive seeded before posts had photos ----
  await test('backfillImages() restores missing / stale showcase photos, leaves uploads alone', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();

    const byTitle = async (t) => (await db.posts.filter(p => p.title === t).first());
    const JIAOZI = "Popo's Lunar New Year Jiaozi";
    const POT = "Mum's Pan-Fried Potstickers";
    const MANDU = 'Kimchi Mandu (from our neighbour Jisoo)';

    // Simulate an older archive: one photo wiped, one pointing at a stale
    // placeholder, one replaced by a user's own uploaded image.
    await db.posts.update((await byTitle(JIAOZI)).post_id, { file: null });
    await db.posts.update((await byTitle(POT)).post_id, { file: '/resource/test1.jpg' });
    await db.posts.update((await byTitle(MANDU)).post_id, { file: 'data:image/png;base64,AAAA' });

    const fixed = await window.showcaseSeed.backfillImages();
    const rows = await db.posts.toArray();

    return {
      input: {},
      expected: {
        fixed: 2,
        jiaozi: '/resource/dumpling1.jpg',
        potstickers: '/resource/dumpling2.jpg',
        mandu: 'data:image/png;base64,AAAA',   // user upload left untouched
        allWithImage: 11
      },
      actual: {
        fixed: fixed,
        jiaozi: rows.find(p => p.title === JIAOZI).file,
        potstickers: rows.find(p => p.title === POT).file,
        mandu: rows.find(p => p.title === MANDU).file,
        allWithImage: rows.filter(p => typeof p.file === 'string' && p.file.trim()).length
      }
    };
  });

  // ---- backfillPosts() tops up an archive missing newer showcase memories ----
  await test('backfillPosts() adds missing showcase memories and wires their lineage', async () => {
    await window.showcaseSeed.clear();
    await window.showcaseSeed.reseed();

    // Simulate an archive seeded before the non-recipe memories existed.
    const stale = await db.posts
      .filter(p => p.category !== 'recipe' && p.category !== 'note').toArray();
    await Promise.all(stale.map(p => db.posts.delete(p.post_id)));
    const before = await db.posts.count();

    const added = await window.showcaseSeed.backfillPosts();
    const after = await db.posts.count();
    const againAdded = await window.showcaseSeed.backfillPosts(); // idempotent

    const qRoot = await db.posts.filter(p => p.title === "Qingming: Sweeping the Ancestors' Graves").first();
    const qSyd = await db.posts.filter(p => p.title === 'Qingming in a Sydney Backyard').first();

    return {
      input: {},
      expected: { before: 11, added: 9, after: 20, secondRunAdded: 0, lineageWired: true },
      actual: {
        before: before,
        added: added,
        after: after,
        secondRunAdded: againAdded,
        lineageWired: !!(qRoot && qSyd && qSyd.adapted_from === qRoot.post_id)
      }
    };
  });

  // ---- ensure() only seeds an empty archive ----
  await test('ensure() seeds when empty but never on top of existing data', async () => {
    // empty -> ensure seeds it
    await window.showcaseSeed.clear();
    const onEmpty = await window.showcaseSeed.ensure();
    const countAfterEmpty = await db.posts.count();

    // populated + fresh memo -> ensure sees the data and does not re-seed
    await window.showcaseSeed.clear();       // resets the memo
    await window.showcaseSeed.reseed();      // full archive
    const onPopulated = await window.showcaseSeed.ensure();
    const countAfterPopulated = await db.posts.count();

    return {
      input: {},
      expected: { seededWhenEmpty: true, countAfterEmpty: 20, seededWhenPopulated: false, countAfterPopulated: 20 },
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
