// mapView.js — plots a lineage tree geographically on a Leaflet map.
//
// Pure rendering. Give it a Leaflet map instance and a { nodes, edges } tree
// (the exact shape getFullTree() returns) and it draws:
//   - one marker per post that has lat/lng set
//   - one line per adapted_from edge whose BOTH endpoints have a location
//
// Posts with no location are silently skipped — that's expected, not an error.
//
// Requires Leaflet (global `L`) to be loaded first. No dependency on Dexie or
// db.js: the caller fetches the tree and passes it in.

// Returns a new { nodes, edges } keeping only the nodes that match every
// provided filter:
//   - country: keep posts whose `country` equals this exactly
//   - tags:    array of tags — keep posts whose `tags` include AT LEAST ONE of
//              them (OR within the tag facet). `tag` (a single string) is also
//              accepted as shorthand for `tags: [tag]`.
// An empty / missing value for a facet means "don't filter on it".
// The country and tag facets combine with AND.
// An edge survives only if BOTH of its endpoints survived.
function filterTree(tree, filters) {
  const f = filters || {};
  const country = f.country ? f.country : null;
  const tags = (Array.isArray(f.tags) ? f.tags : (f.tag ? [f.tag] : [])).filter(Boolean);

  const nodes = ((tree && tree.nodes) || []).filter(p => {
    if (country && p.country !== country) return false;
    if (tags.length) {
      const postTags = Array.isArray(p.tags) ? p.tags : [];
      if (!tags.some(t => postTags.includes(t))) return false;
    }
    return true;
  });

  const kept = new Set(nodes.map(p => p.post_id));
  const edges = ((tree && tree.edges) || []).filter(e => kept.has(e.from) && kept.has(e.to));

  return { nodes, edges };
}

// Distinct, sorted values for building the filter dropdowns from a tree.
function distinctCountries(tree) {
  const set = new Set(((tree && tree.nodes) || []).map(p => p.country).filter(Boolean));
  return [...set].sort();
}
function distinctTags(tree) {
  const set = new Set();
  for (const p of (tree && tree.nodes) || []) {
    if (Array.isArray(p.tags)) p.tags.forEach(t => set.add(t));
  }
  return [...set].sort();
}

// True when a post has a usable map location.
function _hasLocation(p) {
  return p && p.lat != null && p.lng != null && !Number.isNaN(p.lat) && !Number.isNaN(p.lng);
}

// Draws `tree` onto `map`. Returns:
//   { layers, markers, lines, skipped }
// where `layers` is every Leaflet layer created (so the caller can remove them
// on the next redraw), and the counts summarise what was drawn.
function plotTreeOnMap(map, tree) {
  const nodes = (tree && tree.nodes) || [];
  const edges = (tree && tree.edges) || [];
  const byId = new Map(nodes.map(p => [p.post_id, p]));
  const layers = [];

  // --- Markers: one per located post ---
  const located = nodes.filter(_hasLocation);
  for (const post of located) {
    const label = post.title != null ? String(post.title) : `post ${post.post_id}`;
    const popup = post.country
      ? `<strong>${label}</strong><br>${post.country}`
      : `<strong>${label}</strong>`;
    const marker = L.marker([post.lat, post.lng]).addTo(map).bindPopup(popup);
    layers.push(marker);
  }

  // --- Edges: one line per adapted_from link where both ends are on the map ---
  let lines = 0;
  for (const edge of edges) {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (_hasLocation(a) && _hasLocation(b)) {
      const line = L.polyline(
        [[a.lat, a.lng], [b.lat, b.lng]],
        { color: '#c9a876', weight: 2, dashArray: '4 4' }
      ).addTo(map);
      layers.push(line);
      lines++;
    }
  }

  return {
    layers,
    markers: located.length,
    lines,
    skipped: nodes.length - located.length
  };
}
