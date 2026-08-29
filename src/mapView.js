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
