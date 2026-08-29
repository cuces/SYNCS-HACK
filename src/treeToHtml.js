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
    const opts = Object.assign({ containerClass: 'post-graph', cssVars: {}, rootId: null, highlightId: null }, options);

    const cardHtml = (n) => {
      const title = n.title ?? n.name ?? `#${n.post_id}`;
      const img = n.file ? `<div class="pt-card-img"><img src="${escapeHtml(n.file)}" alt="${escapeHtml(title)}"/></div>` : '';
      const desc = n.description ? `<div class="pt-card-desc">${escapeHtml(n.description)}</div>` : '';
      const date = n.created_at ? `<div class="pt-card-date">${escapeHtml(formatDate(n.created_at))}</div>` : '';
      const highlightClass = String(n.post_id) === String(opts.highlightId) ? ' pt-card--highlight' : '';
      return `<div class="pt-card${highlightClass}" data-id="${n.post_id}">
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

    const css = buildCss(opts.containerClass, opts.cssVars);

    const visNodes = safeNodes.map(n => {
      const titleText = n.title || n.name || `#${n.post_id}`;
      const extra = [];
      if (n.description) extra.push(n.description);
      if (n.created_at) extra.push(formatDate(n.created_at));
      const node = { id: n.post_id, label: titleText, title: extra.join(' \n ') || '' };
      if (n.file) {
        node.image = n.file;
        node.shape = 'image';
        node.size = 36;
      }
      if (String(n.post_id) === String(opts.highlightId)) {
        node.size = Math.max(node.size || 36, 56);
        node.borderWidth = 3;
      }
      return node;
    });

    const visEdges = (edges || []).map(e => ({ from: e.from, to: e.to }));

    // find rootId if not explicitly provided
    let rootId = opts.rootId;
    if (!rootId) {
      const toSet = new Set((visEdges || []).map(e => e.to));
      const roots = (safeNodes || []).filter(n => !toSet.has(n.post_id));
      rootId = roots.length ? roots[0].post_id : (safeNodes[0] && safeNodes[0].post_id);
    }

    // embed raw JSON inside application/json script so enhanceGraph can parse it directly
    const dataJson = '<script type="application/json" class="pt-vis-data">' + JSON.stringify({ nodes: visNodes, edges: visEdges, rootId: rootId, highlightId: opts.highlightId }) + '</script>';

    // build card HTML as a graceful fallback when vis isn't available
    const cards = safeNodes.map(cardHtml).join('\n');
    // The vis container will be initialized by enhanceGraph when vis-network is available.
    return '<div class="' + opts.containerClass + '">' + css + dataJson + '<div class="pt-vis" style="width:100%;height:520px;"></div><div class="pt-canvas">' + cards + '</div></div>';
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
        '--pt-card-bg': '#fffdf8',
        '--pt-card-shadow': '0 6px 18px rgba(0,0,0,0.04)'
      },
      vars || {}
    );

    const varLines = Object.entries(defaults).map(([k, v]) => `${k}: ${v};`).join(' ');

    return `
      <style>
      .${containerClass} { ${varLines} font-family: var(--pt-node-font); }
      .${containerClass} .pt-canvas { display: flex; flex-wrap: wrap; gap: var(--pt-node-gap); align-items: flex-start; }
      .${containerClass} .pt-card { width: var(--pt-card-width); background: var(--pt-card-bg); border-radius: var(--pt-node-radius); box-shadow: var(--pt-card-shadow); padding: 10px; box-sizing: border-box; border: 1px solid rgba(0,0,0,0.04); position: relative; z-index: 1; }
      .${containerClass} .pt-card-heading { font-weight: 700; margin-bottom: 6px; }
      .${containerClass} .pt-card-img img { width: 100%; height: auto; border-radius: 6px; margin-bottom: 6px; display: block; }
      .${containerClass} .pt-card-desc { font-size: 0.9rem; color: #333; margin-bottom: 6px; }
      .${containerClass} .pt-card-date { font-size: 0.78rem; color: #666; }
      .${containerClass} .pt-card--highlight { box-shadow: 0 10px 26px rgba(0,0,0,0.06); border: 2px solid #d6c9b8; transform: translateZ(0); }
      .${containerClass} .pt-empty { color: #666; font-style: italic; padding: 0.5rem 0; }
      .${containerClass} .pt-vis { width: 100%; height: 100%; background: var(--pt-card-bg); }
      .${containerClass} .pt-vis .vis-network { background: transparent; }
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

  // Enhance a rendered graph. If vis-network is loaded, initialize it using
  // the embedded JSON data. Otherwise fall back to the SVG line drawer.
  global.enhanceGraph = function enhanceGraph(container) {
    try {
      if (!container) return;
      const dataScript = container.querySelector('.pt-vis-data');
      if (!dataScript) return;
      const data = JSON.parse(dataScript.textContent || '{}');

      // If vis-network is present, use it to render nodes and edges.
      const visGlobal = window.vis || window.visNetwork || null;
      const visContainer = container.querySelector('.pt-vis');
      if (visGlobal && visContainer && typeof visGlobal.Network === 'function') {
        // clear previous if any
        console.debug('enhanceGraph: vis detected, nodes=', (data.nodes || []).length, 'edges=', (data.edges || []).length);
        if (visContainer._visNetwork) {
          try { visContainer._visNetwork.destroy(); } catch (e) {}
          visContainer.innerHTML = '';
        }
        const options = {
          nodes: {
            shape: 'box',
            margin: 12,
            widthConstraint: { maximum: 240 },
            shapeProperties: { borderRadius: 8 },
            font: { color: '#2f2a24' },
            color: {
              background: '#fffdf8',
              border: '#e6dccf',
              highlight: { background: '#fffef0', border: '#d7cdbf' },
              hover: { background: '#fffef0', border: '#cfc3b6' }
            },
            borderWidth: 1
          },
          edges: {
            color: { color: 'rgba(80,70,60,0.22)' },
            width: 2,
            smooth: { enabled: true, type: 'dynamic' }
          },
          layout: { improvedLayout: true },
          interaction: { hover: true, tooltipDelay: 200, hoverConnectedEdges: true },
          physics: {
            enabled: true,
            barnesHut: {
              gravitationalConstant: -12000,
              centralGravity: 0.3,
              springLength: 200,
              springConstant: 0.04,
              avoidOverlap: 1
            },
            // Run the whole stabilization off-screen and only paint the final
            // layout, so the user never sees the graph settling/spinning.
            stabilization: { enabled: true, iterations: 400, updateInterval: 400, fit: true }
          }
        };
        try {
          // pass plain arrays for nodes/edges (vis accepts arrays or DataSet)
          const network = new visGlobal.Network(visContainer, { nodes: data.nodes || [], edges: data.edges || [] }, options);
          visContainer._visNetwork = network;
          // hide the card canvas when vis is active
          const canvas = container.querySelector('.pt-canvas');
          if (canvas) canvas.style.display = 'none';
          visContainer.style.display = 'block';
          // Physics is only used to lay the tree out once. As soon as it has
          // settled we turn it OFF completely — otherwise the force-directed
          // layout keeps drifting and rotating (it has no fixed orientation),
          // and any hover/drag/redraw nudges it again.
          const freezeLayout = () => {
            try {
              network.storePositions();               // bake settled x/y into the data
              network.setOptions({ physics: { enabled: false } });
              network.redraw();
            } catch (e) {}
          };
          try {
            network.once && network.once('stabilizationIterationsDone', freezeLayout);
          } catch (e) {}
          // Fallback in case the stabilization event never fires.
          setTimeout(freezeLayout, 1200);
          setTimeout(() => { try { network.redraw(); } catch (e) {} }, 150);
          return;
        } catch (e) {
          console.warn('vis.Network init failed, falling back to card canvas', e);
          // ensure vis container is hidden and card canvas is visible
          try { visContainer.style.display = 'none'; } catch (_) {}
          const canvas = container.querySelector('.pt-canvas');
          if (canvas) canvas.style.display = 'flex';
        }
      }

      // Fallback: draw simple SVG lines between existing .pt-card elements if any
      const canvas = container.querySelector('.pt-canvas');
      if (!canvas) return;
      canvas.style.position = canvas.style.position || 'relative';
      const cards = Array.from(canvas.querySelectorAll('.pt-card'));
      const map = new Map(cards.map(c => [String(c.getAttribute('data-id')), c]));
      const edges = data.edges || [];
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'pt-edges-svg');
      svg.style.position = 'absolute';
      svg.style.left = '0';
      svg.style.top = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '0';
      const draw = () => {
        const cr = canvas.getBoundingClientRect();
        const w = Math.max(1, canvas.clientWidth);
        const h = Math.max(1, canvas.clientHeight);
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        for (const e of edges) {
          const a = map.get(String(e.from));
          const b = map.get(String(e.to));
          if (!a || !b) continue;
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const ax = ra.left - cr.left + ra.width / 2;
          const ay = ra.top - cr.top + ra.height / 2;
          const bx = rb.left - cr.left + rb.width / 2;
          const by = rb.top - cr.top + rb.height / 2;
          const line = document.createElementNS(svgNS, 'line');
          line.setAttribute('x1', String(ax));
          line.setAttribute('y1', String(ay));
          line.setAttribute('x2', String(bx));
          line.setAttribute('y2', String(by));
          line.setAttribute('stroke', 'rgba(0,0,0,0.7)');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-linecap', 'round');
          svg.appendChild(line);
        }
      };
      const existing = canvas.querySelector('.pt-edges-svg');
      if (existing) existing.remove();
      if (canvas.firstChild) canvas.insertBefore(svg, canvas.firstChild);
      else canvas.appendChild(svg);
      draw();
      window.addEventListener('resize', draw);
      setTimeout(draw, 50);
    } catch (err) {
      console.warn('enhanceGraph failed', err);
    }
  };
})(window);
