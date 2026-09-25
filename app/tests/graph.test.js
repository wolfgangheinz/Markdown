const test = require('node:test');
const assert = require('node:assert/strict');
const { build, connectedComponent, pickLabels, layout, extractLinks } = require('../graph.js');
const marked = require('../vendor/marked.min.js');

test('link extraction handles reference links and wiki links without indexing code', () => {
  const markdown = [
    '[standard](folder/a%20note.md) [reference][ref] [[c note|alias]]',
    '', '[ref]: b.md', '',
    '```md', '[[hidden]] [hidden](hidden.md)', '```',
    'Inline `[[also hidden]]`'
  ].join('\n');
  const links = extractLinks(markdown, (href) => ({ path: decodeURIComponent(href) }), (title) => ({ path: `${title}.md` }), marked);
  assert.deepEqual(links.map((link) => link.path), ['folder/a note.md', 'b.md', 'c note.md']);
});

test('folder graph includes every note, every relation, and disconnected notes', () => {
  const entries = new Map([
    ['a.md', { path: 'a.md', name: 'a.md', links: [{ path: 'b.md' }, { path: 'b.md' }] }],
    ['b.md', { path: 'b.md', name: 'b.md', links: [{ path: 'a.md' }, { path: 'nested/c.md' }] }],
    ['nested/c.md', { path: 'nested/c.md', name: 'c.md', links: [] }],
    ['orphan.md', { path: 'orphan.md', name: 'orphan.md', links: [] }]
  ]);
  const graph = build(entries.values());
  assert.equal(graph.nodes.length, 4);
  assert.deepEqual(graph.edges, [
    { source: 'a.md', target: 'b.md' },
    { source: 'b.md', target: 'nested/c.md' }
  ]);
  assert.equal(graph.byPath.get('orphan.md').degree, 0);
  assert.equal(graph.components.length, 2);
  assert.deepEqual([...graph.neighbors.get('b.md')].sort(), ['a.md', 'nested/c.md']);
  const connected = connectedComponent(graph, 'nested/c.md');
  assert.deepEqual(connected.nodes.map((node) => node.path), ['a.md', 'b.md', 'nested/c.md']);
  assert.equal(connected.edges.length, 2);
  assert.deepEqual(connectedComponent(graph, 'orphan.md').nodes.map((node) => node.path), ['orphan.md']);
});

test('label placement favors the selected note and hides overlapping labels', () => {
  const visible = pickLabels([
    { path: 'nearby.md', x: 100, y: 100, width: 100, height: 18, priority: 1 },
    { path: 'selected.md', x: 110, y: 102, width: 100, height: 18, priority: 100 },
    { path: 'other.md', x: 300, y: 100, width: 80, height: 18, priority: 1 }
  ], 400, 200);
  assert.deepEqual([...visible].sort(), ['other.md', 'selected.md']);
});

test('component selection follows the active note even outside the largest island', () => {
  const graph = build([
    { path: 'a.md', name: 'A', links: [{ path: 'b.md' }] },
    { path: 'b.md', name: 'B', links: [{ path: 'c.md' }] },
    { path: 'c.md', name: 'C', links: [] },
    { path: 'x.md', name: 'X', links: [{ path: 'y.md' }] },
    { path: 'y.md', name: 'Y', links: [] }
  ]);
  const selected = connectedComponent(graph, 'x.md');
  assert.deepEqual(selected.nodes.map((node) => node.path), ['x.md', 'y.md']);
  assert.deepEqual(selected.edges, [{ source: 'x.md', target: 'y.md' }]);
});

test('graph has no one-hop or node-count cap and produces stable finite positions', () => {
  const entries = Array.from({ length: 90 }, (_, index) => ({
    path: `note-${index}.md`, name: `Note ${index}`,
    links: index < 89 ? [{ path: `note-${index + 1}.md` }] : []
  }));
  const graph = build(entries);
  const first = layout(graph);
  const second = layout(graph);
  assert.equal(graph.nodes.length, 90);
  assert.equal(graph.edges.length, 89);
  assert.equal(graph.components.length, 1);
  assert.equal(connectedComponent(graph, 'note-0.md').nodes.length, 90);
  assert.deepEqual([...first.positions], [...second.positions]);
  assert.ok(first.bounds.width > 0 && first.bounds.height > 0);
  for (const point of first.positions.values()) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
});
