// harness.js — the tiny shared test harness used by every *.test.js file.
//
// No framework, no build step (matches the rest of the project). Load this
// BEFORE any *.test.js file in the runner HTML.
//
// Every test returns { input, expected, actual } (and optionally `graphic`,
// an HTML string rendered inline in the report). The report shows all of
// them, pass or fail. A test passes when `expected` deep-equals `actual`.

// ---------- Results collector ----------

const _results = [];

// Wipe every table so each test starts from a known-empty database.
// Safe to call even if some stores don't exist in a given page.
async function resetDb() {
  if (typeof db === 'undefined') return;
  const clears = [];
  for (const store of ['families', 'users', 'posts']) {
    if (db[store]) clears.push(db[store].clear());
  }
  await Promise.all(clears);
}

// Structural equality for plain values/arrays/objects (enough for these tests).
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual(a[k], b[k]));
}

// Each `fn` returns { input, expected, actual, graphic? }.
async function test(name, fn) {
  await resetDb();
  let input, expected, actual, error = null, pass = false, graphic;
  try {
    const r = await fn();
    input = r.input;
    expected = r.expected;
    actual = r.actual;
    graphic = r.graphic; // optional visual payload
    pass = deepEqual(expected, actual);
  } catch (err) {
    error = err && err.message ? err.message : String(err);
  }
  _results.push({ name, input, expected, actual, graphic, error, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}`, { input, expected, actual, error });
}

function fmt(v) {
  if (v === undefined) return 'undefined';
  return JSON.stringify(v, null, 2);
}

// Render the full report into the page once all tests have finished.
function renderReport() {
  const list = document.getElementById('results');
  const summary = document.getElementById('summary');
  const passed = _results.filter(r => r.pass).length;
  const failed = _results.length - passed;

  for (const r of _results) {
    const li = document.createElement('li');
    li.className = r.pass ? 'pass' : 'fail';

    const head = document.createElement('div');
    head.className = 'head';
    head.textContent = `${r.pass ? '✓' : '✗'} ${r.name}`;
    li.appendChild(head);

    const addBlock = (label, value) => {
      const wrap = document.createElement('div');
      wrap.className = 'block';
      const tag = document.createElement('span');
      tag.className = 'label';
      tag.textContent = label;
      wrap.appendChild(tag);

      // Render graphics as HTML so visual outputs appear in the report.
      if (label === 'graphic' && typeof value === 'string') {
        const container = document.createElement('div');
        container.className = 'graphic';
        container.innerHTML = value;
        wrap.appendChild(container);
      } else {
        const pre = document.createElement('pre');
        pre.textContent = value;
        wrap.appendChild(pre);
      }

      li.appendChild(wrap);
    };

    addBlock('input', fmt(r.input));
    addBlock('expected', fmt(r.expected));
    addBlock('actual', r.error ? `(threw) ${r.error}` : fmt(r.actual));
    if (r.graphic !== undefined) addBlock('graphic', r.graphic);

    list.appendChild(li);
  }

  summary.textContent = `${passed} passed, ${failed} failed (${_results.length} total)`;
  summary.style.color = failed ? '#611a15' : '#1e4620';
}
