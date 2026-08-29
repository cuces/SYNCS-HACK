// map.test.js — proves the map view can actually render markers.
//
// Three checks, matching the "prove it renders before wiring the real thing" plan:
//   1. Markers render at all      — hand-built tree → plotTreeOnMap → markers appear
//   2. Full path form → db → map  — createPost(country) → getFullTree → marker appears
//   3. A post with no location    — createPost(no lat/lng) → no marker, no crash
//
// Runs in the same tiny harness as the other *.test.js files (see harness.js).
// Needs Leaflet, Dexie, geo.js, db.js and mapView.js loaded first — map.test.html
// wires all of that up.

// Fresh Leaflet map per test, so markers from one test never leak into the next.
let _testMap = null;
function freshTestMap() {
  if (_testMap) { _testMap.remove(); _testMap = null; }
  const div = document.getElementById('test-map');
  div.innerHTML = '';
  _testMap = L.map(div, { attributionControl: false }).setView([20, 0], 2);
  return _testMap;
}

async function mapViewTests() {

  // ---- 1. Markers render at all ----
  await test('plotTreeOnMap renders one marker per located post (hardcoded tree)', async () => {
    const map = freshTestMap();
    const tree = {
      nodes: [
        { post_id: 1, title: 'Vietnam',  country: 'Vietnam', lat: 14.058, lng: 108.277 },
        { post_id: 2, title: 'Mexico',   country: 'Mexico',  lat: 23.635, lng: -102.553 },
        { post_id: 3, title: 'France',   country: 'France',  lat: 46.228, lng: 2.214 }
      ],
      edges: []
    };
    const input = { tree };

    const result = plotTreeOnMap(map, tree);
    const positions = result.layers
      .filter(l => typeof l.getLatLng === 'function')
      .map(l => [Math.round(l.getLatLng().lat), Math.round(l.getLatLng().lng)]);

    return {
      input,
      expected: { markers: 3, skipped: 0, positions: [[14, 108], [24, -103], [46, 2]] },
      actual: { markers: result.markers, skipped: result.skipped, positions }
    };
  });

  // ---- 2. Full path: create a real post with a country, confirm it maps ----
  await test('a post created with a picked country shows up as a marker (form → db → map)', async () => {
    const familyId = await createFamily('Nguyen');
    const picked = 'Vietnam';
    const coords = countryToLatLng(picked); // this is exactly what the form will do
    const input = { pickedCountry: picked, derivedCoords: coords };

    const postId = await createPost({
      poster_id: 1, family_id: familyId,
      title: 'Phở', description: '', file: null, category: 'recipe',
      is_published: true,
      country: picked, lat: coords.lat, lng: coords.lng
    });

    const tree = await getFullTree(postId);          // real read path
    const map = freshTestMap();
    const result = plotTreeOnMap(map, tree);
    const markerPos = result.layers[0] && result.layers[0].getLatLng();

    return {
      input,
      expected: { treeNodes: 1, markers: 1, markerLat: coords.lat, markerLng: coords.lng },
      actual: {
        treeNodes: tree.nodes.length,
        markers: result.markers,
        markerLat: markerPos ? markerPos.lat : null,
        markerLng: markerPos ? markerPos.lng : null
      }
    };
  });

  // ---- 3. A post with NO location: nothing drawn, nothing thrown ----
  await test('a post created without a location produces no marker and no error', async () => {
    const familyId = await createFamily('Nguyen');
    const input = { country: null, lat: null, lng: null };

    const postId = await createPost({
      poster_id: 1, family_id: familyId,
      title: 'Handwritten note', description: '', file: null, category: 'story',
      is_published: true
      // no country / lat / lng
    });

    const tree = await getFullTree(postId);
    const map = freshTestMap();
    const result = plotTreeOnMap(map, tree); // must not throw

    return {
      input,
      expected: { treeNodes: 1, markers: 0, lines: 0, skipped: 1 },
      actual: {
        treeNodes: tree.nodes.length,
        markers: result.markers,
        lines: result.lines,
        skipped: result.skipped
      }
    };
  });

  // ---- 4. Mixed lineage: located + unlocated together (the demo scenario) ----
  await test('a lineage with a mix of located and unlocated posts plots the located ones only', async () => {
    const familyId = await createFamily('Nguyen');
    const mk = (title, country, adapted_from = null) => {
      const c = countryToLatLng(country);
      return createPost({
        poster_id: 1, family_id: familyId, title, description: '', file: null,
        category: 'recipe', adapted_from, is_published: true,
        country: country || null, lat: c ? c.lat : null, lng: c ? c.lng : null
      });
    };
    const vn = await mk('Phở', 'Vietnam');
    const mx = await mk('Caldo', 'Mexico', vn);
    await mk('Pot-au-phở', 'France', mx);
    await mk('Note', null, vn); // no location
    const input = { lineage: 'Vietnam → Mexico → France (+ 1 unlocated child of Vietnam)' };

    const tree = await getFullTree(vn);
    const map = freshTestMap();
    const result = plotTreeOnMap(map, tree);

    return {
      input,
      expected: { treeNodes: 4, markers: 3, lines: 2, skipped: 1 },
      actual: {
        treeNodes: tree.nodes.length,
        markers: result.markers,
        lines: result.lines,
        skipped: result.skipped
      }
    };
  });
}

// ---------- geo.js (country → coords) ----------

async function geoTests() {
  await test('countryToLatLng returns coords for a known country', async () => {
    const input = { country: 'Vietnam' };
    const c = countryToLatLng('Vietnam');
    return {
      input,
      expected: { lat: 14.058, lng: 108.277 },
      actual: { lat: c ? c.lat : null, lng: c ? c.lng : null }
    };
  });

  await test('countryToLatLng is case- and whitespace-insensitive', async () => {
    const input = { country: '  vietNAM ' };
    const c = countryToLatLng('  vietNAM ');
    return {
      input,
      expected: { lat: 14.058, lng: 108.277 },
      actual: { lat: c ? c.lat : null, lng: c ? c.lng : null }
    };
  });

  await test('countryToLatLng returns null for an unknown or empty country', async () => {
    const input = { cases: ['Atlantis', '', null] };
    return {
      input,
      expected: { atlantis: null, empty: null, nullish: null },
      actual: {
        atlantis: countryToLatLng('Atlantis'),
        empty: countryToLatLng(''),
        nullish: countryToLatLng(null)
      }
    };
  });

  await test('supportedCountries is a sorted, de-duped list including the demo countries', async () => {
    const list = supportedCountries();
    const sorted = [...list].sort();
    return {
      input: {},
      expected: { isSorted: true, hasDupes: false, hasVietnam: true, hasMexico: true, hasFrance: true },
      actual: {
        isSorted: JSON.stringify(list) === JSON.stringify(sorted),
        hasDupes: list.length !== new Set(list).size,
        hasVietnam: list.includes('Vietnam'),
        hasMexico: list.includes('Mexico'),
        hasFrance: list.includes('France')
      }
    };
  });

  await test('parseLatLng reads a pasted "lat, lng" string', async () => {
    const input = { text: '-33.883, 151.157' };
    const c = parseLatLng('-33.883, 151.157');
    return {
      input,
      expected: { lat: -33.883, lng: 151.157 },
      actual: { lat: c ? c.lat : null, lng: c ? c.lng : null }
    };
  });

  await test('parseLatLng tolerates spaces, brackets and no comma', async () => {
    const input = { cases: ['(48.8584 2.2945)', '  40.7128   -74.0060  '] };
    const a = parseLatLng('(48.8584 2.2945)');
    const b = parseLatLng('  40.7128   -74.0060  ');
    return {
      input,
      expected: { a: '48.8584,2.2945', b: '40.7128,-74.006' },
      actual: {
        a: a ? a.lat + ',' + a.lng : null,
        b: b ? b.lat + ',' + b.lng : null
      }
    };
  });

  await test('parseLatLng returns null for junk or out-of-range values', async () => {
    const input = { cases: ['somewhere nice', '200, 5', '', null] };
    return {
      input,
      expected: { words: null, outOfRange: null, empty: null, nullish: null },
      actual: {
        words: parseLatLng('somewhere nice'),
        outOfRange: parseLatLng('200, 5'),
        empty: parseLatLng(''),
        nullish: parseLatLng(null)
      }
    };
  });
}

// ---------- Map filters (filterTree + distinct* + re-render) ----------

async function filterTests() {
  // Demo-shaped tree: Vietnam → Mexico → France, plus an unlocated Vietnamese note.
  const demoTree = () => ({
    nodes: [
      { post_id: 1, title: 'Phở',        country: 'Vietnam', tags: ['vietnamese', 'soup'], lat: 14.058, lng: 108.277 },
      { post_id: 2, title: 'Caldo',      country: 'Mexico',  tags: ['mexican', 'soup'],    lat: 23.635, lng: -102.553 },
      { post_id: 3, title: 'Pot-au-phở', country: 'France',  tags: ['french', 'stew'],     lat: 46.228, lng: 2.214 },
      { post_id: 4, title: 'Note',       country: null,      tags: ['vietnamese', 'note'], lat: null,   lng: null }
    ],
    edges: [ { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 4 } ]
  });

  await test('distinctCountries / distinctTags return sorted, de-duped values for the dropdowns', async () => {
    const tree = demoTree();
    return {
      input: { nodeCount: tree.nodes.length },
      expected: {
        countries: ['France', 'Mexico', 'Vietnam'],
        tags: ['french', 'mexican', 'note', 'soup', 'stew', 'vietnamese']
      },
      actual: { countries: distinctCountries(tree), tags: distinctTags(tree) }
    };
  });

  await test('filterTree by country keeps only that country and prunes now-dangling edges', async () => {
    const tree = demoTree();
    const input = { filter: { country: 'Mexico' } };
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeIds: [2], edges: [] },
      actual: { nodeIds: out.nodes.map(n => n.post_id), edges: out.edges }
    };
  });

  await test('filterTree by tag keeps every post carrying that tag, and edges between survivors', async () => {
    const tree = demoTree();
    const input = { filter: { tag: 'soup' } };
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeIds: [1, 2], edges: [{ from: 1, to: 2 }] },
      actual: { nodeIds: out.nodes.map(n => n.post_id), edges: out.edges }
    };
  });

  await test('filterTree applies country AND tag together', async () => {
    const tree = demoTree();
    const input = { filter: { country: 'Vietnam', tag: 'soup' } };
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeIds: [1] },
      actual: { nodeIds: out.nodes.map(n => n.post_id) }
    };
  });

  await test('filterTree with multiple tags keeps only posts carrying EVERY one (AND)', async () => {
    const tree = demoTree();
    const input = { filter: { tags: ['vietnamese', 'soup'] } }; // only post 1 has both
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeIds: [1], edges: [] },
      actual: { nodeIds: out.nodes.map(n => n.post_id), edges: out.edges }
    };
  });

  await test('filterTree with a tag combination no post satisfies returns nothing', async () => {
    const tree = demoTree();
    const input = { filter: { tags: ['soup', 'stew'] } }; // no post has both
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeIds: [] },
      actual: { nodeIds: out.nodes.map(n => n.post_id) }
    };
  });

  await test('filterTree with an empty tags array does not filter on tags', async () => {
    const tree = demoTree();
    const input = { filter: { tags: [] } };
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeCount: 4 },
      actual: { nodeCount: out.nodes.length }
    };
  });

  await test('filterTree combines country AND a multi-tag (AND) selection', async () => {
    const tree = demoTree();
    const input = { filter: { country: 'Vietnam', tags: ['vietnamese', 'soup'] } };
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeIds: [1] },
      actual: { nodeIds: out.nodes.map(n => n.post_id) }
    };
  });

  await test('multi-tag (AND) filter renders only the fully-matching markers on the map', async () => {
    const tree = demoTree();
    const input = { filter: { tags: ['vietnamese', 'soup'] } };
    const map = freshTestMap();
    const result = plotTreeOnMap(map, filterTree(tree, input.filter));
    return {
      input,
      expected: { markers: 1, lines: 0 },
      actual: { markers: result.markers, lines: result.lines }
    };
  });

  await test('filterTree with no filters returns the tree unchanged', async () => {
    const tree = demoTree();
    const out = filterTree(tree, {});
    return {
      input: { filter: {} },
      expected: { nodes: 4, edges: 3 },
      actual: { nodes: out.nodes.length, edges: out.edges.length }
    };
  });

  await test('filtered tree renders only the matching markers on the map', async () => {
    const tree = demoTree();
    const input = { filter: { tag: 'soup' } };
    const map = freshTestMap();
    const result = plotTreeOnMap(map, filterTree(tree, input.filter));
    return {
      input,
      expected: { markers: 2, lines: 1, skipped: 0 },
      actual: { markers: result.markers, lines: result.lines, skipped: result.skipped }
    };
  });

  await test('a filter that matches nothing renders an empty map without error', async () => {
    const tree = demoTree();
    const input = { filter: { country: 'Japan' } };
    const map = freshTestMap();
    const result = plotTreeOnMap(map, filterTree(tree, input.filter));
    return {
      input,
      expected: { markers: 0, lines: 0 },
      actual: { markers: result.markers, lines: result.lines }
    };
  });
}

// ---------- Bigger scenario: related vs unrelated tags & countries ----------
//
// A dumpling recipe that spread across families and borders:
//
//        1 Grandma's jiaozi ........... China   [dumpling, pork, festive]
//        ├── 2 Mum's potstickers ...... China   [dumpling, pork, pan-fried]
//        │   ├── 4 Seoul mandu ........ S.Korea [dumpling, pork, kimchi]
//        │   │   └── 7 Kathmandu momo .. Nepal  [dumpling, pork, spicy]   (no coords)
//        │   └── 6 Freezer notes ...... (none)  [dumpling, make-ahead]    (unlocated)
//        └── 3 Aunt's veg jiaozi ...... China   [dumpling, vegetarian]
//            └── 5 Warsaw pierogi ..... Poland  [dumpling, vegetarian, potato]
//
// "Related"   = shares a country or a tag with the rest of the lineage
//               (China x3; `dumpling` on all; `pork` down one whole branch).
// "Unrelated" = appears once, connected to nothing else by that facet
//               (`make-ahead` only on 6; `kimchi` only on 4; Nepal only on 7).

function archiveTree() {
  const CN = [35.86, 104.19];   // China
  const KR = [35.90, 127.77];   // South Korea
  const PL = [51.90, 19.14];    // Poland
  return {
    nodes: [
      { post_id: 1, title: "Grandma's jiaozi",  country: 'China',       tags: ['dumpling', 'pork', 'festive'],           lat: CN[0], lng: CN[1] },
      { post_id: 2, title: "Mum's potstickers", country: 'China',       tags: ['dumpling', 'pork', 'pan-fried'],         lat: CN[0], lng: CN[1] },
      { post_id: 3, title: "Aunt's veg jiaozi", country: 'China',       tags: ['dumpling', 'vegetarian'],                lat: CN[0], lng: CN[1] },
      { post_id: 4, title: 'Seoul mandu',       country: 'South Korea', tags: ['dumpling', 'pork', 'kimchi'],            lat: KR[0], lng: KR[1] },
      { post_id: 5, title: 'Warsaw pierogi',    country: 'Poland',      tags: ['dumpling', 'vegetarian', 'potato'],      lat: PL[0], lng: PL[1] },
      { post_id: 6, title: 'Freezer notes',     country: null,          tags: ['dumpling', 'make-ahead'],                lat: null,  lng: null },  // unlocated
      { post_id: 7, title: 'Kathmandu momo',    country: 'Nepal',       tags: ['dumpling', 'pork', 'spicy'],             lat: null,  lng: null }   // country set, but not geocodable
    ],
    edges: [
      { from: 1, to: 2 }, { from: 1, to: 3 },
      { from: 2, to: 4 }, { from: 3, to: 5 },
      { from: 2, to: 6 }, { from: 4, to: 7 }
    ]
  };
}

async function scenarioTests() {
  const ids = (t) => t.nodes.map((n) => n.post_id);
  const edgeKeys = (t) => t.edges.map((e) => `${e.from}-${e.to}`);
  const plot = (filter) => {
    const shown = filterTree(archiveTree(), filter);
    const map = freshTestMap();
    const r = plotTreeOnMap(map, shown);
    return { shown, r };
  };

  await test('scenario: the whole archive at a glance (facets available to filter on)', async () => {
    const tree = archiveTree();
    return {
      input: { posts: 7, note: 'China repeats x3; every post is tagged "dumpling"' },
      expected: {
        countries: ['China', 'Nepal', 'Poland', 'South Korea'],
        tags: ['dumpling', 'festive', 'kimchi', 'make-ahead', 'pan-fried', 'pork', 'potato', 'spicy', 'vegetarian'],
        locatedPosts: 5, unlocatedPosts: 2
      },
      actual: {
        countries: distinctCountries(tree),
        tags: distinctTags(tree),
        locatedPosts: tree.nodes.filter((n) => n.lat != null).length,
        unlocatedPosts: tree.nodes.filter((n) => n.lat == null).length
      }
    };
  });

  await test('RELATED country: "China" is shared by 3 posts across 2 branches', async () => {
    const { shown, r } = plot({ country: 'China' });
    return {
      input: { filter: { country: 'China' } },
      // 1,2,3 kept; edges 1->2 and 1->3 survive; 2->4, 3->5, 2->6 are pruned
      expected: { nodeIds: [1, 2, 3], edges: ['1-2', '1-3'], markers: 3, lines: 2, skipped: 0 },
      actual: { nodeIds: ids(shown), edges: edgeKeys(shown), markers: r.markers, lines: r.lines, skipped: r.skipped }
    };
  });

  await test('UNRELATED country: "Nepal" belongs to one post, which has no coords → no marker', async () => {
    const { shown, r } = plot({ country: 'Nepal' });
    return {
      input: { filter: { country: 'Nepal' }, note: 'post 7 has a country but no lat/lng' },
      expected: { nodeIds: [7], edges: [], markers: 0, lines: 0, skipped: 1 },
      actual: { nodeIds: ids(shown), edges: edgeKeys(shown), markers: r.markers, lines: r.lines, skipped: r.skipped }
    };
  });

  await test('RELATED tag: "dumpling" spans the entire lineage — nothing is dropped', async () => {
    const { shown, r } = plot({ tags: ['dumpling'] });
    return {
      input: { filter: { tags: ['dumpling'] } },
      // all 7 nodes + all 6 edges; 5 markers, 2 unlocated posts skipped,
      // 4 lines (the 2 edges into unlocated posts 6 & 7 can't be drawn)
      expected: { nodeCount: 7, edgeCount: 6, markers: 5, lines: 4, skipped: 2 },
      actual: { nodeCount: shown.nodes.length, edgeCount: shown.edges.length, markers: r.markers, lines: r.lines, skipped: r.skipped }
    };
  });

  await test('RELATED tag down one branch: "pork" keeps a fully-connected chain 1→2→4→7', async () => {
    const { shown, r } = plot({ tags: ['pork'] });
    return {
      input: { filter: { tags: ['pork'] } },
      expected: { nodeIds: [1, 2, 4, 7], edges: ['1-2', '2-4', '4-7'], markers: 3, lines: 2, skipped: 1 },
      actual: { nodeIds: ids(shown), edges: edgeKeys(shown), markers: r.markers, lines: r.lines, skipped: r.skipped }
    };
  });

  await test('UNRELATED tag: "make-ahead" is on one unlocated post → single node, no edges, empty map', async () => {
    const { shown, r } = plot({ tags: ['make-ahead'] });
    return {
      input: { filter: { tags: ['make-ahead'] } },
      expected: { nodeIds: [6], edges: [], markers: 0, lines: 0, skipped: 1 },
      actual: { nodeIds: ids(shown), edges: edgeKeys(shown), markers: r.markers, lines: r.lines, skipped: r.skipped }
    };
  });

  await test('UNRELATED tags together (AND): "pork" + "vegetarian" never co-occur → nothing', async () => {
    const { shown, r } = plot({ tags: ['pork', 'vegetarian'] });
    return {
      input: { filter: { tags: ['pork', 'vegetarian'] } },
      expected: { nodeIds: [], markers: 0 },
      actual: { nodeIds: ids(shown), markers: r.markers }
    };
  });

  await test('RELATED tags together (AND): "dumpling" + "pork" co-occur on the pork branch', async () => {
    const { shown } = plot({ tags: ['dumpling', 'pork'] });
    return {
      input: { filter: { tags: ['dumpling', 'pork'] }, note: '"dumpling" is on every post, so this narrows to "pork"' },
      expected: { nodeIds: [1, 2, 4, 7] },
      actual: { nodeIds: ids(shown) }
    };
  });

  await test('RELATED country + tag: China ∩ vegetarian is exactly post 3', async () => {
    const { shown, r } = plot({ country: 'China', tags: ['vegetarian'] });
    return {
      input: { filter: { country: 'China', tags: ['vegetarian'] } },
      expected: { nodeIds: [3], markers: 1 },
      actual: { nodeIds: ids(shown), markers: r.markers }
    };
  });

  await test('UNRELATED country + tag: China ∩ kimchi is empty (kimchi is only in South Korea)', async () => {
    const { shown, r } = plot({ country: 'China', tags: ['kimchi'] });
    return {
      input: { filter: { country: 'China', tags: ['kimchi'] } },
      expected: { nodeIds: [], markers: 0 },
      actual: { nodeIds: ids(shown), markers: r.markers }
    };
  });

  await test('scenario via the real DB path: seed the archive, walk it, filter it', async () => {
    const familyId = await createFamily('Chen');
    const src = archiveTree();
    const idMap = {};
    // create posts parent-first so adapted_from always resolves
    for (const n of src.nodes) {
      const parentEdge = src.edges.find((e) => e.to === n.post_id);
      idMap[n.post_id] = await createPost({
        poster_id: 1, family_id: familyId, title: n.title, description: '', file: null,
        category: 'recipe', tags: n.tags, is_published: true,
        adapted_from: parentEdge ? idMap[parentEdge.from] : null,
        country: n.country, lat: n.lat, lng: n.lng
      });
    }

    const tree = await getFullTree(idMap[7]); // start from a leaf — full tree still comes back
    const porkOnly = filterTree(tree, { tags: ['pork'] });
    const map = freshTestMap();
    const r = plotTreeOnMap(map, porkOnly);

    return {
      input: { seededPosts: src.nodes.length, startedFrom: 'Kathmandu momo (leaf)', filter: { tags: ['pork'] } },
      expected: { fullTreeNodes: 7, porkTitles: ["Grandma's jiaozi", "Mum's potstickers", 'Seoul mandu', 'Kathmandu momo'], markers: 3, lines: 2 },
      actual: {
        fullTreeNodes: tree.nodes.length,
        porkTitles: porkOnly.nodes.map((n) => n.title),
        markers: r.markers,
        lines: r.lines
      }
    };
  });
}

// ---------- Standalone: tiny 2-entry lineages (unrelated to the big scenario) ----------
//
// A memory and one adaptation of it — the smallest lineage there is. These are
// the shape of the "flatbread" and "ragù" pairs in the demo seed.

async function standaloneTests() {
  const ids = (t) => t.nodes.map((n) => n.post_id);

  // original + one adaptation, both on the map, in different countries
  const pair = () => ({
    nodes: [
      { post_id: 1, title: "Nonna's ragù",   country: 'Italy',     tags: ['italian', 'ragu'],                 lat: 44.4949, lng: 11.3426 },
      { post_id: 2, title: 'Slow-cooker ragù', country: 'Australia', tags: ['australian', 'ragu', 'slow-cooker'], lat: -37.8136, lng: 144.9631 }
    ],
    edges: [{ from: 1, to: 2 }]
  });

  await test('standalone pair: both located → 2 markers joined by 1 line', async () => {
    const map = freshTestMap();
    const r = plotTreeOnMap(map, pair());
    return {
      input: { nodes: 2, edges: 1 },
      expected: { markers: 2, lines: 1, skipped: 0 },
      actual: { markers: r.markers, lines: r.lines, skipped: r.skipped }
    };
  });

  await test('standalone pair: filter by the original\'s country keeps just the original', async () => {
    const out = filterTree(pair(), { country: 'Italy' });
    return {
      input: { filter: { country: 'Italy' } },
      expected: { nodeIds: [1], edges: [] },
      actual: { nodeIds: ids(out), edges: out.edges }
    };
  });

  await test('standalone pair: a tag only the adaptation carries keeps just the adaptation', async () => {
    const out = filterTree(pair(), { tags: ['slow-cooker'] });
    return {
      input: { filter: { tags: ['slow-cooker'] } },
      expected: { nodeIds: [2] },
      actual: { nodeIds: ids(out) }
    };
  });

  await test('standalone pair: the shared tag keeps both, connected', async () => {
    const out = filterTree(pair(), { tags: ['ragu'] });
    return {
      input: { filter: { tags: ['ragu'] } },
      expected: { nodeIds: [1, 2], edges: [{ from: 1, to: 2 }] },
      actual: { nodeIds: ids(out), edges: out.edges }
    };
  });

  await test('standalone pair: dropdowns list exactly the 2 countries and their tags', async () => {
    const t = pair();
    return {
      input: {},
      expected: {
        countries: ['Australia', 'Italy'],
        tags: ['australian', 'italian', 'ragu', 'slow-cooker']
      },
      actual: { countries: distinctCountries(t), tags: distinctTags(t) }
    };
  });

  await test('standalone pair: adaptation has no location → 1 marker, no line', async () => {
    const tree = {
      nodes: [
        { post_id: 1, title: 'Original',   country: 'Italy', tags: ['x'], lat: 44.49, lng: 11.34 },
        { post_id: 2, title: 'Adaptation', country: null,    tags: ['y'], lat: null,  lng: null }
      ],
      edges: [{ from: 1, to: 2 }]
    };
    const map = freshTestMap();
    const r = plotTreeOnMap(map, tree);
    return {
      input: { note: 'child never got a location' },
      expected: { markers: 1, lines: 0, skipped: 1 },
      actual: { markers: r.markers, lines: r.lines, skipped: r.skipped }
    };
  });

  await test('standalone pair: original has no location → 1 marker, no line', async () => {
    const tree = {
      nodes: [
        { post_id: 1, title: 'Original',   country: null,        tags: ['x'], lat: null,     lng: null },
        { post_id: 2, title: 'Adaptation', country: 'Australia', tags: ['y'], lat: -37.81, lng: 144.96 }
      ],
      edges: [{ from: 1, to: 2 }]
    };
    const map = freshTestMap();
    const r = plotTreeOnMap(map, tree);
    return {
      input: { note: 'root never got a location' },
      expected: { markers: 1, lines: 0, skipped: 1 },
      actual: { markers: r.markers, lines: r.lines, skipped: r.skipped }
    };
  });

  await test('standalone pair: computeRevealWaves reveals it in exactly two steps', async () => {
    const waves = computeRevealWaves(
      [{ id: 1 }, { id: 2 }],
      [{ from: 1, to: 2 }]
    );
    return {
      input: {},
      expected: { waveNodeIds: [[1], [2]] },
      actual: { waveNodeIds: waves.map((w) => w.nodeIds) }
    };
  });

  await test('standalone pair via the DB: create original + adaptation, walk it from the child', async () => {
    const familyId = await createFamily('Rossi');
    const originalId = await createPost({
      poster_id: 1, family_id: familyId, title: "Nonna's ragù", description: '', file: null,
      category: 'recipe', tags: ['italian', 'ragu'], is_published: true,
      country: 'Italy', lat: 44.4949, lng: 11.3426
    });
    const adaptationId = await createPost({
      poster_id: 1, family_id: familyId, title: 'Slow-cooker ragù', description: '', file: null,
      category: 'recipe', tags: ['australian', 'ragu', 'slow-cooker'], is_published: true,
      adapted_from: originalId,
      country: 'Australia', lat: -37.8136, lng: 144.9631
    });

    const tree = await getFullTree(adaptationId); // start from the child
    const map = freshTestMap();
    const r = plotTreeOnMap(map, tree);

    return {
      input: { startedFrom: 'Slow-cooker ragù (the adaptation)' },
      expected: { nodes: 2, edges: 1, rootTitle: "Nonna's ragù", markers: 2, lines: 1 },
      actual: {
        nodes: tree.nodes.length,
        edges: tree.edges.length,
        rootTitle: tree.nodes[0] ? tree.nodes[0].title : null,
        markers: r.markers,
        lines: r.lines
      }
    };
  });

  // Mirrors what the "Extend memory" button does: from a post, a child is
  // created with adapted_from = that post. The lineage graph + map are read
  // straight from the DB, so the new branch just appears.
  await test('"Extend memory": a child with adapted_from shows up in the parent\'s tree and on the map', async () => {
    const familyId = await createFamily('Kaur');
    const parentId = await createPost({
      poster_id: 1, family_id: familyId, title: 'Amma\'s chai', description: '', file: null,
      category: 'recipe', tags: ['indian', 'drink'], is_published: 1,
      country: 'India', lat: 20.5937, lng: 78.9629
    });
    const beforeNodes = (await getFullTree(parentId)).nodes.length; // just the parent

    // --- the "Extend memory" action ---
    const childId = await createPost({
      poster_id: 1, family_id: familyId, title: 'Oat-milk chai', description: '', file: null,
      category: 'recipe', tags: ['australian', 'drink'], is_published: 0,
      adapted_from: parentId,
      country: 'Australia', lat: -33.8688, lng: 151.2093
    });

    const parentTree = await getFullTree(parentId); // post.html?id=<parent> iframe reads this
    const childTree = await getFullTree(childId);   // where the redirect lands
    const map = freshTestMap();
    const r = plotTreeOnMap(map, childTree);

    return {
      input: { note: 'parent then extend' },
      expected: {
        beforeExtend: 1,
        parentTreeNodes: 2, parentTreeEdges: 1,
        childIsLeafOfSameTree: true,
        markers: 2, lines: 1
      },
      actual: {
        beforeExtend: beforeNodes,
        parentTreeNodes: parentTree.nodes.length,
        parentTreeEdges: parentTree.edges.length,
        childIsLeafOfSameTree: childTree.nodes.length === 2 &&
          childTree.nodes[0].post_id === parentId &&
          childTree.edges.some((e) => e.from === parentId && e.to === childId),
        markers: r.markers, lines: r.lines
      }
    };
  });
}

// ---------- Run ----------

(async function run() {
  await geoTests();
  await mapViewTests();
  await filterTests();
  await scenarioTests();
  await standaloneTests();
  renderReport();
})();
