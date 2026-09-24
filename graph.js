/* The folder graph is kept independent of the editor so its model and layout can be tested. */
(function (root) {
  'use strict';

  function build(entries) {
    const sourceEntries = Array.from(entries);
    const nodes = sourceEntries.map((entry) => ({
      path: entry.path,
      name: entry.name,
      degree: 0
    })).sort((a, b) => a.path.localeCompare(b.path));
    const byPath = new Map(nodes.map((node) => [node.path, node]));
    const edges = [];
    const seen = new Set();
    for (const entry of sourceEntries) {
      for (const link of entry.links || []) {
        const target = link.path;
        if (!byPath.has(target) || target === entry.path) continue;
        const pair = [entry.path, target].sort();
        const key = JSON.stringify(pair);
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ source: pair[0], target: pair[1] });
        byPath.get(pair[0]).degree += 1;
        byPath.get(pair[1]).degree += 1;
      }
    }
    edges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
    const neighbors = new Map(nodes.map((node) => [node.path, new Set()]));
    for (const edge of edges) {
      neighbors.get(edge.source).add(edge.target);
      neighbors.get(edge.target).add(edge.source);
    }
    const components = [];
    const visited = new Set();
    for (const node of nodes) {
      if (visited.has(node.path)) continue;
      const component = [];
      const queue = [node.path];
      visited.add(node.path);
      for (let i = 0; i < queue.length; i += 1) {
        const path = queue[i];
        component.push(path);
        for (const neighbor of neighbors.get(path)) {
          if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        }
      }
      components.push(component);
    }
    components.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
    return { nodes, edges, neighbors, components, byPath };
  }

  function extractLinks(markdown, resolveMarkdown, resolveWiki, parser) {
    const links = [];
    parser.walkTokens(parser.lexer(markdown), (token) => {
      if (token.type === 'link') {
        const target = resolveMarkdown(token.href);
        if (target) links.push(target);
      } else if (token.type === 'text') {
        String(token.text || '').replace(/\[\[([^\]]+)\]\]/g, (_, value) => {
          const target = resolveWiki(value.split('|')[0].split('#')[0].trim());
          if (target) links.push(target);
          return _;
        });
      }
    });
    return links;
  }

  function connectedComponent(graph, path) {
    const paths = graph.components.find((component) => component.includes(path));
    if (!paths) return build([]);
    return build(paths.map((member) => ({
      path: member,
      name: graph.byPath.get(member).name,
      links: Array.from(graph.neighbors.get(member), (neighbor) => ({ path: neighbor }))
    })));
  }

  function pickLabels(candidates, width, height) {
    const visible = new Set();
    const occupied = [];
    const ordered = candidates.slice().sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));
    for (const candidate of ordered) {
      const box = {
        left: candidate.x - candidate.width / 2 - 4,
        right: candidate.x + candidate.width / 2 + 4,
        top: candidate.y - 2,
        bottom: candidate.y + candidate.height + 4
      };
      if (box.right < 0 || box.left > width || box.bottom < 0 || box.top > height) continue;
      if (occupied.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
      occupied.push(box);
      visible.add(candidate.path);
    }
    return visible;
  }

  function layout(graph) {
    const positions = new Map();
    if (!graph.nodes.length) return { positions, bounds: { x: -100, y: -100, width: 200, height: 200 } };
    // Connected groups stay together. A spiral leaves space for small components and orphans.
    const coreRadius = Math.max(36, Math.sqrt(graph.components[0].length) * 35);
    const centers = new Map();
    graph.components.forEach((component, componentIndex) => {
      const radius = Math.max(36, Math.sqrt(component.length) * 35);
      const angle = componentIndex * 2.399963229728653;
      const distance = componentIndex ? coreRadius + radius + 90 + 100 * Math.sqrt(componentIndex - 1) : 0;
      const cx = Math.cos(angle) * distance;
      const cy = Math.sin(angle) * distance;
      const ranked = component.slice().sort((a, b) => graph.byPath.get(b).degree - graph.byPath.get(a).degree || a.localeCompare(b));
      ranked.forEach((path, index) => {
        const theta = index * 2.399963229728653;
        const r = index ? Math.sqrt(index) * 35 : 0;
        positions.set(path, { x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r });
        centers.set(path, { x: cx, y: cy });
      });
    });
    // Relax links and nearby nodes. A spatial grid keeps this linear for large folders.
    const cellSize = 60;
    const iterations = graph.nodes.length > 2000 ? 25 : 65;
    for (let step = 0; step < iterations; step += 1) {
      const forces = new Map(graph.nodes.map((node) => [node.path, { x: 0, y: 0 }]));
      const cells = new Map();
      for (const node of graph.nodes) {
        const point = positions.get(node.path);
        const x = Math.floor(point.x / cellSize);
        const y = Math.floor(point.y / cellSize);
        const key = `${x},${y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(node.path);
      }
      for (const node of graph.nodes) {
        const point = positions.get(node.path);
        const fx = forces.get(node.path);
        const cx = Math.floor(point.x / cellSize);
        const cy = Math.floor(point.y / cellSize);
        for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
          for (const otherPath of cells.get(`${cx + dx},${cy + dy}`) || []) {
            if (otherPath <= node.path) continue;
            const other = positions.get(otherPath);
            let vx = point.x - other.x;
            let vy = point.y - other.y;
            let distance = Math.hypot(vx, vy);
            if (distance < 0.01) { vx = 1; vy = 0; distance = 1; }
            if (distance >= 48) continue;
            const push = (48 - distance) * .18 / distance;
            fx.x += vx * push; fx.y += vy * push;
            forces.get(otherPath).x -= vx * push;
            forces.get(otherPath).y -= vy * push;
          }
        }
      }
      for (const edge of graph.edges) {
        const a = positions.get(edge.source);
        const b = positions.get(edge.target);
        const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        const pull = (distance - 95) * .018 / distance;
        forces.get(edge.source).x += (b.x - a.x) * pull;
        forces.get(edge.source).y += (b.y - a.y) * pull;
        forces.get(edge.target).x -= (b.x - a.x) * pull;
        forces.get(edge.target).y -= (b.y - a.y) * pull;
      }
      const cooling = 1 - step / 85;
      for (const node of graph.nodes) {
        const point = positions.get(node.path);
        const home = centers.get(node.path);
        const force = forces.get(node.path);
        point.x += Math.max(-12, Math.min(12, force.x + (home.x - point.x) * .002)) * cooling;
        point.y += Math.max(-12, Math.min(12, force.y + (home.y - point.y) * .002)) * cooling;
      }
    }
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const point of positions.values()) {
      minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
    }
    const left = minX - 55; const top = minY - 55;
    return { positions, bounds: { x: left, y: top, width: Math.max(180, maxX - left + 55), height: Math.max(180, maxY - top + 55) } };
  }

  const api = { build, connectedComponent, pickLabels, layout, extractLinks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MarkdownGraph = api;
})(typeof window !== 'undefined' ? window : globalThis);
