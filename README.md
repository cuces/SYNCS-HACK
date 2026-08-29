# SYNCS HACK

Entry for the team "cuces" for SYNCS Hackathon 2026

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

then navigate to desired page

## Project layout

```
src/
  db.js            data layer — Dexie/IndexedDB store + read/write helpers (also used by tests)
  treeToHtml.js    renders a getFullTree() result as nested HTML
  styles.css       all frontend styling, one file (tokens → shell → components → per-page)
  index.html       Home page
  family.html      My Family board
  app/
    ui.js          shared view helpers (icons, escaping, dates, state panels, topbar)
    data.js        read-only view-model layer over db.js (loadHomeView, loadFamilyView)
    home.js        Home page controller
    family.js      My Family page controller
test/              browser test runner (open test/tests.html via the server)
design/            static HTML mockups — the visual source of truth
```

Each page loads: `dexie` → `db.js` → `app/ui.js` → `app/data.js` → its own `app/<page>.js`.
The pages are read-only; all data comes from whatever records exist in the browser's
`FamilyArchiveDB`. Empty DB → empty states.