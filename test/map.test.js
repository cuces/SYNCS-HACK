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

  await test('filterTree with multiple tags keeps posts matching ANY of them (OR)', async () => {
    const tree = demoTree();
    const input = { filter: { tags: ['soup', 'stew'] } };
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeIds: [1, 2, 3], edges: [{ from: 1, to: 2 }, { from: 2, to: 3 }] },
      actual: { nodeIds: out.nodes.map(n => n.post_id), edges: out.edges }
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

  await test('filterTree combines country AND a multi-tag selection', async () => {
    const tree = demoTree();
    const input = { filter: { country: 'Mexico', tags: ['soup', 'stew'] } };
    const out = filterTree(tree, input.filter);
    return {
      input,
      expected: { nodeIds: [2] },
      actual: { nodeIds: out.nodes.map(n => n.post_id) }
    };
  });

  await test('multi-tag filter renders every matching marker on the map', async () => {
    const tree = demoTree();
    const input = { filter: { tags: ['soup', 'stew'] } };
    const map = freshTestMap();
    const result = plotTreeOnMap(map, filterTree(tree, input.filter));
    return {
      input,
      expected: { markers: 3, lines: 2 },
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

// ---------- Run ----------

(async function run() {
  await geoTests();
  await mapViewTests();
  await filterTests();
  renderReport();
})();
