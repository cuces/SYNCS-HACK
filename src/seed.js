// seed.js — demo showcase data.
//
// Loads one rich, cross-border recipe lineage into the archive so every page
// has something real to show during the demo:
//   - Family board  : all 7 memories of The Chen Family (one is private)
//   - Community      : the 6 published ones, across 4 cultures
//   - Post detail    : full descriptions + the lineage graph / map embedded below
//   - Map & graph    : China (x3 cities), South Korea, Poland as markers; Nepal
//                      has a country but no pin yet; the freezer note has neither
//
// This is the same tree the filter scenarios in test/map.test.js exercise.
//
// Idempotent: ensure() seeds only when the archive is empty. reseed() forces a
// fresh copy; clear() wipes everything.
//
// Load AFTER db.js (needs createFamily / createUser / createPost and `db`).

(function (global) {
  'use strict';

  // ---- The showcase dataset -------------------------------------------------

  const DATA = {
    family: 'The Chen Family',
    // index 0 is treated as "you" by the family board
    users: [
      { name: 'Mei Chen' },
      { name: 'Lifen Chen' },
      { name: 'Popo Chen' }
    ],
    // `from` = key of the memory this one was adapted from (null = the root).
    // `by`   = index into users above.
    posts: [
      {
        key: 'jiaozi', from: null, by: 2, published: true, category: 'recipe',
        country: 'China', lat: 39.9042, lng: 116.4074, // Beijing
        tags: ['chinese', 'dumpling', 'pork', 'festive'],
        title: "Popo's Lunar New Year Jiaozi",
        description:
          'Every new year begins here. Popo folds these pork-and-Chinese-chive ' +
          'dumplings by the hundred, and whoever bites the one with a coin ' +
          'hidden inside is promised a lucky year.'
      },
      {
        key: 'potstickers', from: 'jiaozi', by: 1, published: true, category: 'recipe',
        country: 'China', lat: 34.2655, lng: 108.9541, // Xi'an
        tags: ['chinese', 'dumpling', 'pork', 'pan-fried'],
        title: "Mum's Pan-Fried Potstickers",
        description:
          'Mum got tired of standing over a pot of boiling water, so she started ' +
          'searing the bottoms flat and steaming them in the pan. Same filling as ' +
          "Popo's, crackly golden base — guo tie."
      },
      {
        key: 'veg-jiaozi', from: 'jiaozi', by: 0, published: true, category: 'recipe',
        country: 'China', lat: 23.1291, lng: 113.2644, // Guangzhou
        tags: ['chinese', 'dumpling', 'vegetarian'],
        title: 'Vegetarian Jiaozi for Popo',
        description:
          'My version for Popo after she gave up meat: shiitake, napa cabbage, ' +
          'glass noodle and enough white pepper to make your nose run.'
      },
      {
        key: 'mandu', from: 'potstickers', by: 0, published: true, category: 'recipe',
        country: 'South Korea', lat: 37.5665, lng: 126.9780, // Seoul
        tags: ['korean', 'dumpling', 'pork', 'kimchi'],
        title: 'Kimchi Mandu (from our neighbour Jisoo)',
        description:
          "Jisoo next door showed us how to fold Mum's potstickers Korean-style, " +
          'working chopped kimchi and crumbled tofu into the pork. We just call ' +
          'them mandu now.'
      },
      {
        key: 'pierogi', from: 'veg-jiaozi', by: 0, published: true, category: 'recipe',
        country: 'Poland', lat: 50.0647, lng: 19.9450, // Kraków
        tags: ['polish', 'dumpling', 'vegetarian', 'potato'],
        title: 'Pierogi Ruskie, the Kraków Detour',
        description:
          'On exchange in Kraków I realised pierogi ruskie are the same idea from ' +
          "the other side of the continent — so I brought the veg-jiaozi fold to a " +
          "potato-and-farmer's-cheese filling."
      },
      {
        key: 'freezer-notes', from: 'potstickers', by: 1, published: false, category: 'note',
        country: null, lat: null, lng: null,
        tags: ['dumpling', 'make-ahead'],
        title: 'Freezing Notes (keep in the family)',
        description:
          "Freeze them in a single layer on a tray first so they don't stick, then " +
          'bag them up. Cook straight from frozen — 2 minutes rolling boil, or 8 ' +
          "minutes steamed. Never thaw first, they turn to paste."
      },
      {
        key: 'momo', from: 'mandu', by: 0, published: true, category: 'recipe',
        country: 'Nepal', lat: null, lng: null, // country known, exact spot not pinned
        tags: ['nepali', 'dumpling', 'pork', 'spicy'],
        title: 'Thamel Momo with Tomato Achar',
        description:
          'From a tin-roof momo stall in Thamel: the mandu fold, steamed, with a ' +
          'fierce tomato-and-timur achar on the side. Still need to pin the exact ' +
          'stall on the map.'
      }
    ]
  };

  // ---- Seeding -------------------------------------------------------------

  async function writeShowcase() {
    const familyId = await createFamily(DATA.family);

    const userIds = [];
    for (const u of DATA.users) {
      userIds.push(await createUser({
        name: u.name, family_id: familyId, email: '', phone: ''
      }));
    }

    // Insert parent-first so `adapted_from` always resolves to a real id.
    const idByKey = {};
    for (const p of DATA.posts) {
      idByKey[p.key] = await createPost({
        poster_id: userIds[p.by],
        family_id: familyId,
        title: p.title,
        description: p.description,
        file: null,
        category: p.category,
        tags: p.tags,
        adapted_from: p.from ? idByKey[p.from] : null,
        is_published: p.published ? 1 : 0,
        country: p.country,
        lat: p.lat,
        lng: p.lng
      });
    }

    return idByKey.jiaozi; // the root of the lineage
  }

  async function clear() {
    await Promise.all([db.posts.clear(), db.users.clear(), db.families.clear()]);
    ensurePromise = null; // a later ensure() may seed again
  }

  // Wipe and write a fresh copy. Returns { seeded, rootPostId }.
  // Leaves the ensure() memo alone — clear() already reset it, and a later
  // ensure() will correctly see a populated archive and do nothing.
  async function reseed() {
    await clear();
    const rootPostId = await writeShowcase();
    return { seeded: true, rootPostId: rootPostId };
  }

  // Find a good root for the lineage graph in an archive that already has data.
  async function findRoot() {
    const match = await db.posts.filter(function (p) {
      return p.title === "Popo's Lunar New Year Jiaozi";
    }).first();
    if (match) return match.post_id;
    const any = await db.posts.toCollection().first();
    return any ? any.post_id : null;
  }

  // Seed only when the archive is empty. Memoised so concurrent callers (every
  // page loads this) share one run. Returns { seeded, rootPostId }.
  let ensurePromise = null;
  function ensure() {
    if (!ensurePromise) {
      ensurePromise = (async function () {
        const count = await db.posts.count();
        if (count > 0) return { seeded: false, rootPostId: await findRoot() };
        return reseed();
      })().catch(function (err) {
        console.error('showcase seed failed:', err);
        ensurePromise = null; // let a later call retry
        return { seeded: false, rootPostId: null };
      });
    }
    return ensurePromise;
  }

  global.showcaseSeed = {
    DATA: DATA,
    ensure: ensure,   // idempotent; call from anywhere, share one run
    reseed: reseed,   // wipe + fresh copy
    clear: clear
  };
})(window);
