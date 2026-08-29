// seed.js — demo showcase data.
//
// Loads the Chen family archive so every page has something real to show:
//   - the dumpling recipe tree (7 memories, one private) — the same tree the
//     filter scenarios in test/map.test.js exercise
//   - two small standalone recipe pairs (flatbread, ragù)
//   - a spread of NON-recipe memories: rituals & customs, crafts & skills,
//     stories & beliefs, dialect words, a lullaby, a family-name history —
//     some standalone, some in their own little two-memory lineages
//
//   - Family board  : all 20 memories of The Chen Family
//   - Community      : the 18 published ones, across ~9 ethnicities
//   - Post detail    : full descriptions + the lineage graph / map embedded below
//   - Map & graph    : China, South Korea, Poland, Japan, Lebanon, Italy,
//                      Ireland, Australia as markers; Nepal is country-only;
//                      the freezer note and the dialect list have no location
//
// Recipe posts carry a bundled photo from /resource (`image`); the non-recipe
// memories have no photo and fall back to their category icon on the boards.
//
// Idempotent: ensure() seeds a full copy when the archive is empty, and when
// it's already populated it tops up — healing missing/stale photos
// (backfillImages) and inserting any showcase memories added since the archive
// was first seeded (backfillPosts). reseed() forces a fresh copy from scratch;
// clear() wipes everything.
//
// Load AFTER db.js (needs createFamily / createUser / createPost / getFamilies /
// getUsersByFamily and `db`).

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
        image: '/resource/dumpling1.jpg',
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
        image: '/resource/dumpling2.jpg',
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
        image: '/resource/dumpling3.jpg',
        country: 'China', lat: 23.1291, lng: 113.2644, // Guangzhou
        tags: ['chinese', 'dumpling', 'vegetarian'],
        title: 'Vegetarian Jiaozi for Popo',
        description:
          'My version for Popo after she gave up meat: shiitake, napa cabbage, ' +
          'glass noodle and enough white pepper to make your nose run.'
      },
      {
        key: 'mandu', from: 'potstickers', by: 0, published: true, category: 'recipe',
        image: '/resource/dumpling4.jpg',
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
        image: '/resource/dumpling5.jpg',
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
        image: '/resource/dumpling6.jpg',
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
        image: '/resource/dumpling7.jpg',
        country: 'Nepal', lat: null, lng: null, // country known, exact spot not pinned
        tags: ['nepali', 'dumpling', 'pork', 'spicy'],
        title: 'Thamel Momo with Tomato Achar',
        description:
          'From a tin-roof momo stall in Thamel: the mandu fold, steamed, with a ' +
          'fierce tomato-and-timur achar on the side. Still need to pin the exact ' +
          'stall on the map.'
      },

      // --- Two small standalone lineages, unrelated to the dumplings. They
      //     give the community graph more than one tree to show. ---
      {
        key: 'flatbread-og', from: null, by: 0, published: true, category: 'recipe',
        image: '/resource/flatbread1.jpg',
        country: 'Lebanon', lat: 33.8938, lng: 35.5018, // Beirut
        tags: ['lebanese', 'bread', 'flatbread'],
        title: "Teta's Saj Flatbread",
        description:
          "My partner's grandmother bakes these paper-thin on a domed saj over a " +
          'gas ring, slapping the dough between her hands until it is almost see-through.'
      },
      {
        key: 'flatbread-bbq', from: 'flatbread-og', by: 0, published: true, category: 'recipe',
        image: '/resource/flatbread2.jpg',
        country: 'Australia', lat: -33.8688, lng: 151.2093, // Sydney
        tags: ['australian', 'bread', 'flatbread', 'weeknight'],
        title: 'Weeknight Flatbread on the BBQ',
        description:
          "No saj, no problem — the same dough puffs beautifully straight on the " +
          'barbecue flat plate. Thirty seconds a side, brushed with za’atar oil.'
      },
      {
        key: 'ragu-og', from: null, by: 1, published: true, category: 'recipe',
        image: '/resource/ragu1.jpg',
        country: 'Italy', lat: 44.4949, lng: 11.3426, // Bologna
        tags: ['italian', 'pasta', 'ragu'],
        title: "Nonna Rosa's Sunday Ragù",
        description:
          'A neighbour in our old building gave us this: soffritto cooked down for ' +
          'an hour, milk before the tomato, and it simmers from breakfast until lunch.'
      },
      {
        key: 'ragu-slowcooker', from: 'ragu-og', by: 0, published: true, category: 'recipe',
        image: '/resource/ragu2.jpg',
        country: 'Australia', lat: -37.8136, lng: 144.9631, // Melbourne
        tags: ['australian', 'pasta', 'ragu', 'slow-cooker'],
        title: 'Slow-Cooker Ragù',
        description:
          'Same order of operations as Nonna Rosa, but everything goes into the ' +
          'slow cooker before work and is ready by the time we are home.'
      },

      // --- Not everything handed down is a recipe. Rituals, crafts, sayings,
      //     stories and beliefs — some standalone, some their own tiny lineage. ---

      // Ritual / custom, adapted for the diaspora.
      {
        key: 'qingming', from: null, by: 2, published: true, category: 'tradition',
        country: 'China', lat: 32.0603, lng: 118.7969, // Nanjing
        tags: ['chinese', 'tradition', 'ancestors', 'qingming'],
        title: "Qingming: Sweeping the Ancestors' Graves",
        description:
          'Every April we clear the weeds from the family graves, lay out oranges ' +
          'and rice wine, and burn paper money so our ancestors want for nothing. ' +
          'Popo taught us to bow three times, youngest last.'
      },
      {
        key: 'qingming-syd', from: 'qingming', by: 0, published: true, category: 'tradition',
        country: 'Australia', lat: -33.8688, lng: 151.2093, // Sydney
        tags: ['australian', 'tradition', 'ancestors', 'diaspora'],
        title: 'Qingming in a Sydney Backyard',
        description:
          "No graves to visit here, so we set a small table under the lemon tree " +
          "with a photo of Gong Gong, his favourite tea and a bowl of oranges. " +
          'Same three bows. The kids fold the paper money now.'
      },

      // Craft / skill, passed sideways between two traditions.
      {
        key: 'darning', from: null, by: 1, published: true, category: 'skill',
        country: 'Poland', lat: 52.2297, lng: 21.0122, // Warsaw
        tags: ['polish', 'skill', 'mending', 'wool'],
        title: 'Darning a Worn Wool Heel',
        description:
          'Babcia never threw out a sock. Stretch the hole over a wooden mushroom, ' +
          'lay a grid of long stitches, then weave across them one row at a time ' +
          'until the hole is a small woven patch.'
      },
      {
        key: 'sashiko-mend', from: 'darning', by: 0, published: true, category: 'skill',
        country: 'Japan', lat: 35.6762, lng: 139.6503, // Tokyo
        tags: ['japanese', 'skill', 'mending', 'sashiko'],
        title: 'Visible Mending, Sashiko-Style',
        description:
          "Took Babcia's darning idea to my jeans — rows of running stitch in white " +
          'thread over a scrap of indigo cloth behind the tear. It is meant to be ' +
          'seen. That knee is now stronger than the rest of the jeans.'
      },

      // Story / belief.
      {
        key: 'magpie-omen', from: null, by: 2, published: true, category: 'story',
        country: 'South Korea', lat: 37.5665, lng: 126.9780, // Seoul
        tags: ['korean', 'story', 'belief', 'birds'],
        title: 'The Magpie Brings News',
        description:
          "Our neighbour Jisoo's grandmother swears a magpie calling at your gate in " +
          'the morning means a welcome visitor by evening. We have started noticing. ' +
          'She is more right than she should be.'
      },

      // Sayings / small superstitions.
      {
        key: 'touch-wood', from: null, by: 1, published: true, category: 'tradition',
        country: 'Ireland', lat: 53.3498, lng: -6.2603, // Dublin
        tags: ['irish', 'tradition', 'superstition', 'sayings'],
        title: '"Touch Wood" and the Small Superstitions',
        description:
          "From Nana Brigid's side: never put new shoes on the table, don't pass " +
          "someone on the stairs, and always say 'touch wood' out loud and actually " +
          'touch some. Half of us do not believe it and all of us do it.'
      },

      // Phrases / dialect — location-agnostic, so no pin.
      {
        key: 'dialect-words', from: null, by: 0, published: true, category: 'story',
        country: null, lat: null, lng: null,
        tags: ['australian', 'story', 'dialect', 'language'],
        title: 'The Words That Only Make Sense at Home',
        description:
          "A running list of family shorthand: 'chook' for chicken, 'the good " +
          "scissors', 'having a barbie', 'doing a Gong Gong' (leaving a party " +
          'without saying goodbye). Written down so the little ones inherit them.'
      },

      // Music — private for now.
      {
        key: 'lullaby', from: null, by: 2, published: false, category: 'music',
        country: 'China', lat: 39.9042, lng: 116.4074, // Beijing
        tags: ['chinese', 'music', 'lullaby', 'popo'],
        title: 'The Lullaby Popo Hums',
        description:
          'She does not know where she learned it and cannot remember any words — ' +
          'just a slow six-note tune she hums while cooking. Recorded it on my phone ' +
          'before it is gone. Keeping this one in the family.'
      },

      // Family history — a name that changed at the docks.
      {
        key: 'name-story', from: null, by: 2, published: true, category: 'history',
        country: 'China', lat: 23.1291, lng: 113.2644, // Guangzhou
        tags: ['chinese', 'history', 'name', 'migration'],
        title: 'How Chen Became the Family Name in English',
        description:
          "The clerk at the shipping office in 1962 could not spell what Gong Gong " +
          "said, so he wrote 'Chen' and that was that. Our cousins who sailed to San " +
          "Francisco the same year are 'Chin'. Same family."
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
        // `image` is a bundled photo in /resource (served from the repo root).
        file: p.image || null,
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

  // One-off heal for archives seeded before posts carried photos (or seeded
  // with an earlier placeholder image). Matches showcase posts by title and
  // sets `file` to the DATA image when it's missing or points at a stale
  // /resource path. Never touches a user's own uploaded photo (a data: URL) and
  // never deletes anything.
  function looksLikeResourcePath(f) {
    return typeof f === 'string' && /(^|\/)resource\//.test(f);
  }
  async function backfillImages() {
    const wanted = new Map(
      DATA.posts.filter(function (p) { return p.image; }).map(function (p) { return [p.title, p.image]; })
    );
    const rows = await db.posts.toArray();
    const updates = [];
    for (const row of rows) {
      if (!wanted.has(row.title)) continue;
      const target = wanted.get(row.title);
      const current = row.file;
      const missing = !(typeof current === 'string' && current.trim());
      const staleResource = looksLikeResourcePath(current) && current !== target;
      if (missing || staleResource) updates.push(db.posts.update(row.post_id, { file: target }));
    }
    if (updates.length) await Promise.all(updates);
    return updates.length;
  }

  function titleForKey(key) {
    const p = DATA.posts.find(function (x) { return x.key === key; });
    return p ? p.title : null;
  }

  // Add any showcase memories that aren't in the archive yet — e.g. demo content
  // shipped after the archive was first seeded. Matches by title, only touches
  // the showcase family ("The Chen Family"), wires up adapted_from from the
  // parent's title, and never edits or deletes an existing post.
  async function backfillPosts() {
    const families = await getFamilies();
    const family = families.find(function (f) { return f.name === DATA.family; });
    if (!family) return 0; // no showcase family -> nothing to top up

    const rows = await db.posts.toArray();
    const idByTitle = {};
    rows.forEach(function (r) { idByTitle[r.title] = r.post_id; });

    // Only top up an archive that was genuinely showcase-seeded (its root memory
    // is present) — never dump showcase content into an unrelated archive that
    // just happens to have a same-named family.
    const ROOT_TITLE = "Popo's Lunar New Year Jiaozi";
    if (idByTitle[ROOT_TITLE] == null) return 0;

    // Resolve the three showcase authors, creating any that are missing.
    const existingUsers = await getUsersByFamily(family.family_id);
    const userIdByName = {};
    existingUsers.forEach(function (u) { userIdByName[u.name] = u.user_id; });
    for (const u of DATA.users) {
      if (userIdByName[u.name] == null) {
        userIdByName[u.name] = await createUser({
          name: u.name, family_id: family.family_id, email: '', phone: ''
        });
      }
    }
    const fallbackPoster = existingUsers[0]
      ? existingUsers[0].user_id
      : userIdByName[DATA.users[0].name];

    let added = 0;
    for (const p of DATA.posts) { // DATA is parent-first, so parents resolve here
      if (idByTitle[p.title] != null) continue;
      const parentTitle = p.from ? titleForKey(p.from) : null;
      const parentId = parentTitle != null && idByTitle[parentTitle] != null
        ? idByTitle[parentTitle] : null;
      const posterId = userIdByName[DATA.users[p.by].name] != null
        ? userIdByName[DATA.users[p.by].name] : fallbackPoster;
      const newId = await createPost({
        poster_id: posterId,
        family_id: family.family_id,
        title: p.title,
        description: p.description,
        file: p.image || null,
        category: p.category,
        tags: p.tags,
        adapted_from: parentId,
        is_published: p.published ? 1 : 0,
        country: p.country,
        lat: p.lat,
        lng: p.lng
      });
      idByTitle[p.title] = newId;
      added++;
    }
    return added;
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
        if (count > 0) {
          // Top up an archive that was seeded before newer demo content landed.
          await backfillImages(); // heal missing / stale photos
          await backfillPosts();  // add showcase memories that aren't in yet
          return { seeded: false, rootPostId: await findRoot() };
        }
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
    ensure: ensure,                 // idempotent; call from anywhere, share one run
    reseed: reseed,                 // wipe + fresh copy
    backfillImages: backfillImages, // heal photos on an already-seeded archive
    backfillPosts: backfillPosts,   // add showcase memories missing from an archive
    clear: clear
  };
})(window);
