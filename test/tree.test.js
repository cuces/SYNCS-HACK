// tree.test.js — tests for the tree-to-HTML renderer (moved to test/)
// These tests run in the same browser harness used by db.test.js and rely on
// the global `test()` function and `renderReport()` behavior.

async function treeRendererTests() {
  await test('renderTreeAsHtml produces nested lists and includes titles', async () => {
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
    const liCount = (html.match(/<li/g) || []).length;

    return {
      input,
      expected: { containsRoot: true, liCount: 4 },
      actual: { containsRoot: html.includes('root'), liCount },
      graphic: html
    };
  });

  await test('renderTreeAsHtml handles empty tree gracefully', async () => {
    const input = { tree: { nodes: [], edges: [] } };
    const html = renderTreeAsHtml(input.tree);
    return {
      input,
      expected: { isEmpty: true },
      actual: { isEmpty: !html.includes('<li') },
      graphic: html
    };
  });
}
