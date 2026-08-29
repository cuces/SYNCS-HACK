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
      const rootClass = String(n.post_id) === String(rootId) ? ' pt-card--root' : '';
      return `<div class="pt-card${highlightClass}${rootClass}" data-id="${n.post_id}">
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

    // Give the root a slightly thicker border so it reads as the origin of the lineage.
    const rootVisNode = visNodes.find(n => String(n.id) === String(rootId));
    if (rootVisNode) {
      rootVisNode.borderWidth = Math.max(rootVisNode.borderWidth || 1, 3);
      rootVisNode.borderWidthSelected = Math.max(rootVisNode.borderWidthSelected || 0, 4);
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
      .${containerClass} .pt-card--root { border: 2px solid #b8a894; }
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

  // Breaks a tree (vis-format nodes `{id}` + edges `{from,to}`) into the
  // "generations" to reveal one after another when animating the graph:
  //   waves[0] = the root(s)
  //   waves[n] = every node whose parent first appeared in waves[n-1]
  // Each wave also carries the edges that connect its nodes to the previous one.
  // Disconnected nodes (if any) come last, in a single trailing wave.
  function computeRevealWaves(nodes, edges) {
    const list = Array.isArray(nodes) ? nodes : [];
    const es = Array.isArray(edges) ? edges : [];
    const ids = list.map((n) => n.id);
    const idSet = new Set(ids);

    const childEdges = new Map(); // parentId -> [{from,to}, ...]
    const hasParent = new Set();
    for (const e of es) {
      if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
      if (!childEdges.has(e.from)) childEdges.set(e.from, []);
      childEdges.get(e.from).push({ from: e.from, to: e.to });
      hasParent.add(e.to);
    }

    let roots = ids.filter((id) => !hasParent.has(id));
    if (!roots.length && ids.length) roots = [ids[0]];

    const waves = [{ nodeIds: roots.slice(), edges: [] }];
    const seen = new Set(roots);
    let frontier = roots.slice();
    while (frontier.length) {
      const nextIds = [];
      const waveEdges = [];
      for (const pid of frontier) {
        for (const e of childEdges.get(pid) || []) {
          if (seen.has(e.to)) continue;
          seen.add(e.to);
          nextIds.push(e.to);
          waveEdges.push(e);
        }
      }
      if (!nextIds.length) break;
      waves.push({ nodeIds: nextIds, edges: waveEdges });
      frontier = nextIds;
    }

    const unreached = ids.filter((id) => !seen.has(id));
    if (unreached.length) waves.push({ nodeIds: unreached, edges: [] });
    return waves;
  }

  // Expose both helpers
  global.renderTreeAsHtml = renderTreeAsHtml;
  global.renderTreeAsGraph = renderTreeAsGraph;
  global.computeRevealWaves = computeRevealWaves;

  // Enhance a rendered graph. If vis-network is loaded, initialize it using
  // the embedded JSON data. Otherwise fall back to the SVG line drawer.
  //
  // opts:
  //   animate  — set false to skip the grow-from-root reveal (default true;
  //              also skipped when the user prefers reduced motion, or when
  //              vis has no DataSet, or there's only one node)
  //   waveMs   — ms between each generation appearing (default 800)
  global.enhanceGraph = function enhanceGraph(container, opts) {
    opts = opts || {};
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
          // hide the card canvas when vis is active
          const canvas = container.querySelector('.pt-canvas');
          if (canvas) canvas.style.display = 'none';
          visContainer.style.display = 'block';

          const allNodes = data.nodes || [];
          const allEdges = (data.edges || []).map((e) => ({ from: e.from, to: e.to }));
          const nodeById = new Map(allNodes.map((n) => [n.id, n]));

          const DataSet = visGlobal.DataSet;
          const reduceMotion = (() => {
            try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
            catch (e) { return false; }
          })();
          const animate = !!DataSet && opts.animate !== false && !reduceMotion && allNodes.length > 1;

          // Physics is only used to lay the tree out. Once it settles we turn it
          // OFF completely — otherwise the force-directed layout keeps drifting
          // and rotating (it has no fixed orientation) and every hover/drag
          // nudges it again.
          let network;
          const freezeLayout = () => {
            try {
              network.storePositions();               // bake settled x/y into the data
              network.setOptions({ physics: { enabled: false } });
              network.redraw();
            } catch (e) {}
          };

          if (!animate) {
            network = new visGlobal.Network(visContainer, { nodes: allNodes, edges: allEdges }, options);
            visContainer._visNetwork = network;
            try {
              network.once && network.once('stabilizationIterationsDone', freezeLayout);
            } catch (e) {}
            setTimeout(freezeLayout, 1200);
            setTimeout(() => { try { network.redraw(); } catch (e) {} }, 150);
            return;
          }

          // Animated reveal: the tree crystallises outward from the root, one
          // BFS generation at a time.
          //   - the root is PINNED at the origin and never moves
          //   - before a node's children appear, that node is PINNED where it
          //     currently sits, so the already-grown part of the tree stops
          //     moving and only the new leaves push out
          //   - physics is gentle (weak forces, heavy damping, capped velocity)
          //   - the camera stays centred on the root and only ever zooms OUT,
          //     so the whole lineage keeps to frame as it grows
          const animatedOptions = Object.assign({}, options, {
            physics: {
              enabled: true,
              barnesHut: {
                gravitationalConstant: -3000,
                centralGravity: 0.05,
                springLength: 150,
                springConstant: 0.03,
                avoidOverlap: 0.3,
                damping: 0.6
              },
              maxVelocity: 10,
              minVelocity: 0.6,
              timestep: 0.3,
              stabilization: false
            }
          });
          const nodesDS = new DataSet([]);
          const edgesDS = new DataSet([]);
          network = new visGlobal.Network(visContainer, { nodes: nodesDS, edges: edgesDS }, animatedOptions);
          visContainer._visNetwork = network;

          const fitAnim = { duration: 650, easingFunction: 'easeInOutQuad' };

          // Keep the root (at 0,0) dead centre and zoom out just enough to hold
          // every node currently on screen. Never zooms past 1:1.
          const frameOnRoot = () => {
            try {
              const pos = network.getPositions();
              let maxX = 1, maxY = 1;
              for (const id in pos) {
                maxX = Math.max(maxX, Math.abs(pos[id].x));
                maxY = Math.max(maxY, Math.abs(pos[id].y));
              }
              const pad = 140; // room for node boxes + labels
              const w = visContainer.clientWidth || 600;
              const h = visContainer.clientHeight || 500;
              const scale = Math.max(0.2, Math.min(1, (w / 2) / (maxX + pad), (h / 2) / (maxY + pad)));
              network.moveTo({ position: { x: 0, y: 0 }, scale: scale, animation: fitAnim });
            } catch (e) {}
          };

          // Pin the given nodes at their current position so physics leaves them alone.
          const pinNodes = (ids) => {
            if (!ids.length) return;
            let pos = {};
            try { pos = network.getPositions(ids); } catch (e) { pos = {}; }
            nodesDS.update(ids.map((id) => {
              const p = pos[id];
              const upd = { id: id, fixed: { x: true, y: true } };
              if (p) { upd.x = p.x; upd.y = p.y; }
              return upd;
            }));
          };

          const waves = computeRevealWaves(allNodes, allEdges);
          const waveMs = Math.max(32, opts.waveMs || 800);
          const endSettleMs = Math.max(400, Math.min(900, waveMs));
          let wi = 0;
          const revealNextWave = () => {
            if (wi >= waves.length) {
              setTimeout(() => {
                frameOnRoot();
                setTimeout(() => {
                  // Release every pin so the user can still rearrange nodes,
                  // then kill physics for good.
                  try {
                    const ids = nodesDS.getIds();
                    nodesDS.update(ids.map((id) => ({ id: id, fixed: false })));
                  } catch (e) {}
                  freezeLayout();
                }, endSettleMs);
              }, waveMs);
              return;
            }
            const w = waves[wi++];
            try {
              const parentOf = new Map(w.edges.map((e) => [e.to, e.from]));

              // Pin this generation's parents in place before their children grow.
              pinNodes([...new Set(w.edges.map((e) => e.from))]);

              let positions = {};
              try { positions = network.getPositions ? network.getPositions() : {}; } catch (e) { positions = {}; }
              const newNodes = w.nodeIds.map((id) => {
                const node = Object.assign({}, nodeById.get(id));
                const parentId = parentOf.get(id);
                const p = parentId != null ? positions[parentId] : null;
                if (p) {
                  // seed the child right next to its (now fixed) parent, free to move
                  node.x = p.x + (Math.random() * 40 - 20);
                  node.y = p.y + (Math.random() * 40 - 20);
                  node.fixed = false;
                } else {
                  // no parent = the root: pin it at the origin for the whole animation
                  node.x = 0;
                  node.y = 0;
                  node.fixed = { x: true, y: true };
                }
                return node;
              }).filter((n) => n && n.id != null);
              nodesDS.add(newNodes);
              edgesDS.add(w.edges);
              // Re-frame once physics has had a moment to place the new leaves.
              setTimeout(frameOnRoot, Math.min(waveMs * 0.6, 350));
            } catch (e) {}
            setTimeout(revealNextWave, waveMs);
          };
          setTimeout(revealNextWave, Math.min(250, waveMs)); // a beat before the root appears
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
