// treeToHtml.js
// Converts the output of `getFullTree()` (nodes + edges) into an HTML string
// that renders the adaptation tree as a nested list. The visual appearance is
// controlled via CSS variables passed through `options.cssVars`, making style
// customization straightforward without touching the renderer logic.

(function (global) {
  // Graph-style renderer: outputs a responsive grid of cards (no runtime JS),
  // where each card shows heading, optional image, description, and date.
  function renderTreeAsGraph(tree, options = {}) {
    const { nodes = [], edges = [] } = tree || {};
    const opts = Object.assign({ containerClass: 'post-graph', cssVars: {} }, options);

    const cardHtml = (n) => {
      const title = n.title ?? n.name ?? `#${n.post_id}`;
      const img = n.file ? `<div class="pt-card-img"><img src="${escapeHtml(n.file)}" alt="${escapeHtml(title)}"/></div>` : '';
      const desc = n.description ? `<div class="pt-card-desc">${escapeHtml(n.description)}</div>` : '';
      const date = n.created_at ? `<div class="pt-card-date">${escapeHtml(formatDate(n.created_at))}</div>` : '';
      return `<div class="pt-card" data-id="${n.post_id}">
                <div class="pt-card-heading">${escapeHtml(title)}</div>
                ${img}
                ${desc}
                ${date}
              </div>`;
    };

    // Defensive: ensure nodes is an array and handle empty trees with a friendly placeholder.
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    if (!safeNodes.length) {
      const css = buildCss(opts.containerClass, opts.cssVars);
      return `<div class="${opts.containerClass}">${css}<div class="pt-empty">(no nodes)</div></div>`;
    }

    const cards = safeNodes.map(cardHtml).join('\n');
    const css = buildCss(opts.containerClass, opts.cssVars);
    return `<div class="${opts.containerClass}">${css}<div class="pt-canvas">${cards}</div></div>`;
  }

  // Backwards-compatible: renderTreeAsHtml defaults to graph mode. Pass {mode:'list'} to get list output.
  function renderTreeAsHtml(tree, options = {}) {
    if (options.mode === 'list') return renderTreeAsList(tree, options);
    return renderTreeAsGraph(tree, options);
  }

  function renderTreeAsList(tree, options = {}) {
    // Keep the original nested list renderer in case it's needed later.
    const { nodes = [], edges = [] } = tree || {};
    const nodeById = new Map((nodes || []).map((n) => [n.post_id, n]));
    const children = new Map();
    for (const n of nodes) children.set(n.post_id, []);
    for (const e of edges) {
      if (!children.has(e.from)) children.set(e.from, []);
      children.get(e.from).push(e.to);
    }
    const toSet = new Set((edges || []).map((e) => e.to));
    const roots = (nodes || []).filter((n) => !toSet.has(n.post_id));
    const rootIds = roots.length ? roots.map((r) => r.post_id) : (nodes.length ? [nodes[0].post_id] : []);

    function renderNode(id) {
      const node = nodeById.get(id) || { post_id: id };
      const title = node.title ?? node.name ?? `#${id}`;
      const childIds = children.get(id) || [];
      let html = `<li class="pt-node" data-id="${id}"><div class="pt-content">${escapeHtml(title)}</div>`;
      if (childIds.length) {
        html += '<ul class="pt-children">';
        for (const c of childIds) html += renderNode(c);
        html += '</ul>';
      }
      html += '</li>';
      return html;
    }

    const listHtml = rootIds.map((r) => renderNode(r)).join('');
    const css = buildCss(options.containerClass || 'post-tree', options.cssVars || {});
    return `<div class="post-tree">${css}<ul class="pt-root">${listHtml}</ul></div>`;
  }

  function buildCss(containerClass, vars) {
    const defaults = Object.assign(
      {
        '--pt-node-bg': '#ffffff',
        '--pt-node-border': '1px solid rgba(0,0,0,0.08)',
        '--pt-node-radius': '8px',
        '--pt-node-padding': '8px',
        '--pt-node-font': 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        '--pt-node-gap': '12px',
        '--pt-card-width': '180px',
        '--pt-card-bg': '#fff',
        '--pt-card-shadow': '0 6px 18px rgba(0,0,0,0.06)'
      },
      vars || {}
    );

    const varLines = Object.entries(defaults).map(([k, v]) => `${k}: ${v};`).join(' ');

    return `
      <style>
      .${containerClass} { ${varLines} font-family: var(--pt-node-font); }
      .${containerClass} .pt-canvas { display: flex; flex-wrap: wrap; gap: var(--pt-node-gap); align-items: flex-start; }
      .${containerClass} .pt-card { width: var(--pt-card-width); background: var(--pt-card-bg); border-radius: var(--pt-node-radius); box-shadow: var(--pt-card-shadow); padding: 10px; box-sizing: border-box; border: 1px solid rgba(0,0,0,0.04); }
      .${containerClass} .pt-card-heading { font-weight: 700; margin-bottom: 6px; }
      .${containerClass} .pt-card-img img { width: 100%; height: auto; border-radius: 6px; margin-bottom: 6px; display: block; }
      .${containerClass} .pt-card-desc { font-size: 0.9rem; color: #333; margin-bottom: 6px; }
      .${containerClass} .pt-card-date { font-size: 0.78rem; color: #666; }
      .${containerClass} .pt-empty { color: #666; font-style: italic; padding: 0.5rem 0; }
      </style>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(d) {
    try {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toISOString().slice(0, 10);
    } catch (e) {
      return '' + d;
    }
  }

  // Expose both helpers
  global.renderTreeAsHtml = renderTreeAsHtml;
  global.renderTreeAsGraph = renderTreeAsGraph;
})(window);
