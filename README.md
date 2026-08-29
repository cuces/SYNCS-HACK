# Corner Stone

Entry for the team "cuces" for SYNCS Hackathon 2026 — **Corner Stone**, a warm,
editorial archive for a family's stories, recipes and traditions.

## Usage

test using 
```py
python -m http.server
``` 
or
```py
python3 -m http.server
```
enter the link
```
http://0.0.0.0:8000/
```

then open `src/pages/` and navigate to the desired page (start with `src/pages/index.html`).

## Project layout

```
src/
  db.js            data layer — Dexie/IndexedDB store + read/write helpers (also used by tests)
  seed.js          demo showcase data (seeds an empty archive)
  geo.js           map-location helpers for the Add Memory form — country → approximate lat/lng, plus parsing a pasted "lat, lng" for a specific spot
  treeToHtml.js    renders a getFullTree() result as nested HTML
  mapView.js       plots a lineage tree onto a Leaflet map
  styles.css       all frontend styling, one file (tokens → shell → components → per-page)
  pages/           every page's HTML (index, family, community, saved, add-memory, post, map, seed)
  app/
    ui.js          shared view helpers (icons, escaping, dates, state panels, topbar)
    data.js        read-only view-model layer over db.js
    bookmarks.js   the "Saved" set, stored per-browser in localStorage
    home.js        Home page controller
    family.js      My Family page controller
    community.js   Community archive controller
    saved.js       Saved page controller
    post.js        Memory detail controller
test/              browser test runner (open test/tests.html via the server)
design/            static HTML mockups — the visual source of truth
```

HTML lives in `src/pages/`; it references the shared code one level up (`../db.js`,
`../styles.css`, `../app/…`). Each page loads: `dexie` → `db.js` → `app/ui.js` →
`app/data.js` → its own `app/<page>.js`.
The pages are read-only; all data comes from whatever records exist in the browser's
`FamilyArchiveDB`. Empty DB → empty states.