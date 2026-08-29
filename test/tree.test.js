// tree.test.js — tests for the tree-to-HTML renderer (moved to test/)
// These tests run in the same browser harness used by db.test.js and rely on
// the global `test()` function and `renderReport()` behavior.

async function treeRendererTests() {
  await test('renderTreeAsHtml produces graph cards and includes titles', async () => {
    const tree = {
      nodes: [
        { post_id: 1, title: 'root' },
        { post_id: 2, title: 'childA' },
        { post_id: 3, title: 'childB' },
        { post_id: 4, title: 'grandchild' }
      ],
      edges: [
        { from: 1, to: 2 },
        { from: 1, to: 3 },
        { from: 2, to: 4 }
      ]
    };
    const input = { tree };

    // Provide a custom CSS var to ensure options are accepted.
    const html = renderTreeAsHtml(tree, { cssVars: { '--pt-node-bg': '#ffeeee' } });
    const hasVisContainer = html.includes('class="pt-vis"');
    const dataPresent = html.includes('class="pt-vis-data"');

    return {
      input,
      expected: { containsRoot: true, hasVis: true },
      actual: { containsRoot: html.includes('root'), hasVis: hasVisContainer && dataPresent },
      graphic: html
    };
  });

  await test('renderTreeAsHtml handles empty tree gracefully', async () => {
    const input = { tree: { nodes: [], edges: [] } };
    const html = renderTreeAsHtml(input.tree);
    return {
      input,
      expected: { isEmpty: true },
      // check that it renders the empty placeholder
      actual: { isEmpty: html.includes('(no nodes)') },
      graphic: html
    };
  });

    await test('renderTreeAsHtml includes images, description and date in cards', async () => {
      // Uses images from /resource/ to ensure the renderer emits valid <img> tags
      const tree = {
        nodes: [
          { post_id: 10, title: 'WithImage', description: 'An item with an image', file: '/resource/test1.jpg', created_at: '2020-01-02T00:00:00Z' },
          { post_id: 11, title: 'WithImage2', description: 'Second image', file: '/resource/test2.jpg', created_at: new Date('2021-03-04') }
        ],
        edges: []
      };
      const input = { tree };

      const html = renderTreeAsHtml(tree);
      const dataPresent = html.includes('class="pt-vis-data"');
      const hasImg1 = html.indexOf('/resource/test1.jpg') !== -1;
      const hasImg2 = html.indexOf('/resource/test2.jpg') !== -1;
      const hasDate1 = html.indexOf('2020-01-02') !== -1;
      const hasDate2 = html.indexOf('2021-03-04') !== -1;

      return {
        input,
        expected: { hasData: true, hasImages: true, hasDates: true },
        actual: { hasData: dataPresent, hasImages: hasImg1 && hasImg2, hasDates: hasDate1 && hasDate2 },
        graphic: html
      };
    });


    await test('sample recipe graph renders with images and vis data', async () => {
      const tree = {
        nodes: [
          { post_id: 1, title: "Mum's apple pie", description: 'Original recipe, 1954', created_at: '1954-01-01', file: '/resource/test1.jpg' },
          { post_id: 2, title: 'Sarah', description: 'Added a lattice crust', created_at: '1981-01-01', file: '/resource/test2.jpg' },
          { post_id: 3, title: 'Aunty Rosa', description: 'Swapped in a shortcrust base', created_at: '1998-01-01', file: '/resource/test1.jpg' },
          { post_id: 4, title: 'Little Mia', description: "Rosa's granddaughter", created_at: '2024-01-01', file: '/resource/test2.jpg' },
          { post_id: 5, title: 'Grandad Tom', description: "Says it's better with less sugar", created_at: '2005-01-01', file: '/resource/test1.jpg' },
          { post_id: 6, title: 'Uncle Dave', description: 'Used a splash of brandy', created_at: '2012-01-01', file: '/resource/test2.jpg' },
          { post_id: 7, title: 'Emily', description: 'First attempt, filling turned out too runny', created_at: '2026-01-01', file: '/resource/test1.jpg' },
          { post_id: 8, title: 'Cousin Ben', description: 'Tried a gluten-free version', created_at: '2019-01-01', file: '/resource/test2.jpg' }
        ],
        edges: [
          { from: 1, to: 2 },
          { from: 1, to: 3 },
          { from: 3, to: 4 },
          { from: 1, to: 5 },
          { from: 5, to: 6 },
          { from: 1, to: 7 },
          { from: 1, to: 8 }
        ]
      };

      const input = { tree };
      const html = renderTreeAsHtml(tree);
      const hasVisContainer = html.includes('class="pt-vis"');
      const hasData = html.includes('class="pt-vis-data"');
      const hasRoot = html.indexOf("Mum's apple pie") !== -1;
      const hasImages = html.indexOf('/resource/test1.jpg') !== -1 && html.indexOf('/resource/test2.jpg') !== -1;

      return {
        input,
        expected: { hasVis: true, hasRoot: true, hasImages: true },
        actual: { hasVis: hasVisContainer && hasData, hasRoot, hasImages },
        graphic: html
      };
    });

    await test('renderTreeAsHtml list-mode fallback produces nested list HTML', async () => {
      const tree = {
        nodes: [
          { post_id: 101, title: 'Root item' },
          { post_id: 102, title: 'Child A' },
          { post_id: 103, title: 'Child B' }
        ],
        edges: [ { from: 101, to: 102 }, { from: 101, to: 103 } ]
      };
      const html = renderTreeAsHtml(tree, { mode: 'list' });
      const hasUl = html.indexOf('<ul') !== -1;
      const hasRoot = html.indexOf('Root item') !== -1;
      const hasChild = html.indexOf('Child A') !== -1 && html.indexOf('Child B') !== -1;
      return {
        input: { tree },
        expected: { hasUl: true, hasRoot: true, hasChild: true },
        actual: { hasUl, hasRoot, hasChild },
        graphic: html
      };
    });

    await test('renderTreeAsHtml list-mode preserves parent-child structure', async () => {
      const tree = {
        nodes: [
          { post_id: 201, title: 'P' },
          { post_id: 202, title: 'C1' },
          { post_id: 203, title: 'C2' }
        ],
        edges: [ { from: 201, to: 202 }, { from: 202, to: 203 } ]
      };
      const html = renderTreeAsHtml(tree, { mode: 'list' });
      // Expect nested <ul> with sequential parent->child substrings
      const parentIndex = html.indexOf('P');
      const childIndex = html.indexOf('C1');
      const grandchildIndex = html.indexOf('C2');
      const nested = parentIndex !== -1 && childIndex > parentIndex && grandchildIndex > childIndex;
      return {
        input: { tree },
        expected: { nested: true },
        actual: { nested },
        graphic: html
      };
    });

    // enhanceGraph should use physics ONLY to lay the tree out, then switch it
    // off — otherwise the force-directed graph keeps drifting/rotating on the page.
    await test('enhanceGraph turns physics off once the layout has stabilised', async () => {
      // Minimal fake vis-network that records setOptions calls and fires the
      // stabilization event on the next tick.
      const setOptionsCalls = [];
      let storePositionsCalled = false;
      const realVis = window.vis;
      window.vis = {
        Network: function (el, data, options) {
          this._handlers = {};
          this.once = (ev, fn) => { this._handlers[ev] = fn; };
          this.setOptions = (o) => { setOptionsCalls.push(o); };
          this.storePositions = () => { storePositionsCalled = true; };
          this.redraw = () => {};
          setTimeout(() => {
            if (this._handlers['stabilizationIterationsDone']) this._handlers['stabilizationIterationsDone']();
          }, 0);
        }
      };

      try {
        const container = document.createElement('div');
        container.innerHTML = renderTreeAsHtml({
          nodes: [{ post_id: 1, title: 'root' }, { post_id: 2, title: 'child' }],
          edges: [{ from: 1, to: 2 }]
        });
        document.body.appendChild(container);

        // No fake vis.DataSet => enhanceGraph takes the non-animated path.
        enhanceGraph(container);
        // let the fake stabilization event fire
        await new Promise((r) => setTimeout(r, 20));

        const physicsDisabled = setOptionsCalls.some(
          (o) => o && o.physics && o.physics.enabled === false
        );
        const physicsReEnabled = setOptionsCalls.some(
          (o) => o && o.physics && o.physics.enabled === true
        );

        container.remove();
        return {
          input: { fakeVis: true },
          expected: { physicsDisabled: true, physicsReEnabled: false, positionsStored: true },
          actual: { physicsDisabled, physicsReEnabled, positionsStored: storePositionsCalled }
        };
      } finally {
        window.vis = realVis;
      }
    });

    // ----- Grow-from-root reveal animation -----

    await test('computeRevealWaves reveals the tree generation by generation from the root', async () => {
      //        1
      //       / \
      //      2   3
      //      |
      //      4
      const nodes = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const edges = [{ from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 4 }];
      const waves = computeRevealWaves(nodes, edges);
      return {
        input: { nodes: nodes.map((n) => n.id), edges },
        expected: {
          waveCount: 3,
          nodeIdsPerWave: [[1], [2, 3], [4]],
          edgesPerWave: [0, 2, 1] // root wave has no incoming edges
        },
        actual: {
          waveCount: waves.length,
          nodeIdsPerWave: waves.map((w) => w.nodeIds),
          edgesPerWave: waves.map((w) => w.edges.length)
        }
      };
    });

    await test('computeRevealWaves puts disconnected nodes in a trailing wave', async () => {
      // node 9 has no path from the forced root (1)
      const waves = computeRevealWaves(
        [{ id: 1 }, { id: 2 }, { id: 9 }],
        [{ from: 1, to: 2 }, { from: 2, to: 1 }] // cycle => root falls back to first id
      );
      return {
        input: { note: 'cycle between 1 and 2, plus orphan 9' },
        expected: { lastWave: [9] },
        actual: { lastWave: waves[waves.length - 1].nodeIds }
      };
    });

    await test('enhanceGraph reveals nodes in waves and freezes physics at the end', async () => {
      let addCalls = 0;
      const setOptionsCalls = [];
      const realVis = window.vis;

      let unpinnedAtEnd = false;
      let rootEverPinned = false;
      let moveToCalls = 0;
      const noteItem = (it) => {
        if (!it || it.id !== 1) return;
        if (it.fixed && it.fixed !== undefined && it.fixed !== false) rootEverPinned = true;
        if (it.fixed === false) unpinnedAtEnd = true;
      };

      function FakeDataSet(init) {
        this._byId = new Map();
        if (init && init.length) this.add(init);
      }
      FakeDataSet.prototype.add = function (x) {
        addCalls++;
        const arr = Array.isArray(x) ? x : [x];
        for (const item of arr) { if (item && item.id != null) this._byId.set(item.id, item); noteItem(item); }
        return arr.map((i) => i && i.id);
      };
      FakeDataSet.prototype.update = function (x) {
        const arr = Array.isArray(x) ? x : [x];
        for (const u of arr) {
          const cur = this._byId.get(u.id) || { id: u.id };
          this._byId.set(u.id, Object.assign(cur, u));
          noteItem(u);
        }
      };
      FakeDataSet.prototype.get = function () { return [...this._byId.values()]; };
      FakeDataSet.prototype.getIds = function () { return [...this._byId.keys()]; };

      const nodeDataSets = [];
      window.vis = {
        DataSet: function (init) {
          const ds = new FakeDataSet(init);
          nodeDataSets.push(ds);
          return ds;
        },
        Network: function (el, data, options) {
          this.setOptions = (o) => setOptionsCalls.push(o);
          this.storePositions = () => {};
          this.redraw = () => {};
          this.fit = () => {};
          this.moveTo = () => { moveToCalls++; };
          this.getPositions = () => ({});
          this.once = () => {};
        }
      };

      try {
        const container = document.createElement('div');
        container.innerHTML = renderTreeAsHtml({
          nodes: [
            { post_id: 1, title: 'root' },
            { post_id: 2, title: 'a' },
            { post_id: 3, title: 'b' },
            { post_id: 4, title: 'c' }
          ],
          edges: [{ from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 4 }]
        });
        document.body.appendChild(container);

        enhanceGraph(container, { waveMs: 40 }); // fast waves for the test
        // 3 waves * 40ms + per-wave refit + endSettle (~400ms) + margin
        await new Promise((r) => setTimeout(r, 1200));

        const firstDS = nodeDataSets[0];
        const nodesRevealed = firstDS ? firstDS.get().length : 0;
        const physicsFrozen = setOptionsCalls.some(
          (o) => o && o.physics && o.physics.enabled === false
        );
        const root = firstDS && firstDS.get().find((n) => n.id === 1);
        const rootHeldAtOrigin = !!(root && root.x === 0 && root.y === 0);

        container.remove();
        return {
          input: { waveMs: 40, tree: '1 -> (2,3), 2 -> 4' },
          expected: {
            allNodesRevealed: 4,
            revealedInMultipleBatches: true,   // 3 node-adds + 3 edge-adds, not one dump
            rootPinnedDuringGrowth: true,
            rootHeldAtOrigin: true,
            cameraReframedEachWave: true,       // moveTo per wave keeps root centred
            pinsReleasedAtEnd: true,
            physicsFrozen: true
          },
          actual: {
            allNodesRevealed: nodesRevealed,
            revealedInMultipleBatches: addCalls >= 4,
            rootPinnedDuringGrowth: rootEverPinned,
            rootHeldAtOrigin,
            cameraReframedEachWave: moveToCalls >= 3,
            pinsReleasedAtEnd: unpinnedAtEnd,
            physicsFrozen
          }
        };
      } finally {
        window.vis = realVis;
      }
    });
}