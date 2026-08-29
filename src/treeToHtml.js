// treeToHtml.js
// Converts the output of `getFullTree()` (nodes + edges) into an HTML string
// that renders the adaptation tree as a nested list. The visual appearance is
// controlled via CSS variables passed through `options.cssVars`, making style
// customization straightforward without touching the renderer logic.

(function (global) {
  /**
   * renderTreeAsHtml(tree, options)
   * - tree: { nodes: [{ post_id, title, ... }], edges: [{ from, to }] }
   * - options: { containerClass: string, cssVars: { '--var': 'value' } }
   *
   * Returns an HTML string containing a <style> block plus a nested <ul>/<li>
   * structure. Consumers can change colors, spacing, and other visual aspects
   * by passing `options.cssVars` with CSS variables (see defaults below).
   */
  function renderTreeAsHtml(tree, options = {}) {
    const { nodes = [], edges = [] } = tree || {};
    const opts = Object.assign({ containerClass: 'post-tree', cssVars: {} }, options);

    // Map nodes by id for quick lookup
    const nodeById = new Map((nodes || []).map((n) => [n.post_id, n]));

    // Build children map from edges
    const children = new Map();
    for (const n of nodes) children.set(n.post_id, []);
    for (const e of edges) {
      if (!children.has(e.from)) children.set(e.from, []);
      children.get(e.from).push(e.to);
    }

    // Determine root nodes: those that are not referenced as a `to` in any edge
    const toSet = new Set((edges || []).map((e) => e.to));
    const roots = (nodes || []).filter((n) => !toSet.has(n.post_id));
    const rootIds = roots.length ? roots.map((r) => r.post_id) : (nodes.length ? [nodes[0].post_id] : []);

    // Recursive renderer for a node id
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
    const css = buildCss(opts.containerClass, opts.cssVars);
    return `<div class="${opts.containerClass}">${css}<ul class="pt-root">${listHtml}</ul></div>`;
  }

  // Build a <style> block using CSS variables. Consumers can override variables
  // by passing values in `options.cssVars`. This keeps visual tweaks centralized.
  function buildCss(containerClass, vars) {
    const defaults = Object.assign(
      {
        '--pt-node-bg': '#ffffff',
        '--pt-node-border': '1px solid rgba(0,0,0,0.08)',
        '--pt-node-radius': '6px',
        '--pt-node-padding': '6px 10px',
        '--pt-node-font': 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        '--pt-node-gap': '10px',
        '--pt-children-indent': '18px'
      },
      vars || {}
    );

    // serialize vars into a rule body for the container
    const varLines = Object.entries(defaults).map(([k, v]) => `${k}: ${v};`).join(' ');

    return `
      <style>
      .${containerClass} { ${varLines} font-family: var(--pt-node-font); }
      .${containerClass} .pt-root, .${containerClass} .pt-children { list-style: none; margin: 0; padding: 0; }
      .${containerClass} .pt-children { margin-left: var(--pt-children-indent); }
      .${containerClass} .pt-node { margin-bottom: var(--pt-node-gap); }
      .${containerClass} .pt-content { display: inline-block; background: var(--pt-node-bg); border: var(--pt-node-border); border-radius: var(--pt-node-radius); padding: var(--pt-node-padding); }
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

  // Expose for browser usage (tests / pages can call `renderTreeAsHtml`)
  global.renderTreeAsHtml = renderTreeAsHtml;
})(window);
