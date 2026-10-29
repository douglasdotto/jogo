// Arena aberta do modo Reino: chão plano retangular em grade, nós de recurso (árvores, rochas, minas),
// posições do castelo e do portal e a mesma interface de "world" que as unidades do main.js usam
// (groundHeight, canStep, obstacles, nextWaypoint...). A lógica não depende de malhas: os testes a usam pura.
import * as THREE from 'three';

export const ARENA = { W: 112, H: 80, CELL: 2 };
export const NODE_TYPES = {
  tree: { res: 'wood', amount: 120, r: 0.7 },
  rock: { res: 'stone', amount: 300, r: 1.0 },
  mine: { res: 'gold', amount: 700, r: 1.6 },
};
const CASTLE_AT = { x: -40, z: 0 }, PORTAL_AT = { x: 44, z: 0 };
const PORTAL_SAFE = 16;            // ninguém constrói perto do portal
const PATH_BUDGET = 14;            // buscas A* por quadro; o resto segue reto e desvia

// grupos de recursos (centro, quantidade, espalhamento); os perto do castelo garantem o começo
const LAYOUT = [
  ['tree', -42, -26, 22, 6], ['tree', -30, 27, 16, 5], ['tree', -8, -31, 18, 6], ['tree', 6, 30, 18, 6], ['tree', 22, -18, 12, 4],
  ['tree', -52, 30, 8, 3], ['tree', -52, -34, 8, 3], ['tree', 30, 31, 10, 4], ['tree', 36, -33, 10, 4],
  ['rock', -50, 14, 3, 2], ['rock', -22, 20, 3, 2], ['rock', -4, -14, 4, 2.5], ['rock', 26, 20, 3, 2], ['rock', 16, -30, 3, 2],
  ['mine', -27, -12, 1, 0], ['mine', -26, 13, 1, 0], ['mine', 2, 6, 1, 0], ['mine', 12, -28, 1, 0], ['mine', 14, 26, 1, 0],
];

export function createArena(seedValue = 7) {
  const { W, H, CELL } = ARENA;
  const cols = W / CELL, rows = H / CELL;
  let seed = seedValue;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blocked = new Uint8Array(cols * rows);   // 0 livre, 1 recurso, 2 construção, 3 portal
  const owner = new Array(cols * rows).fill(null);
  const nodes = [];
  const arena = { cols, rows, blocked, owner, nodes, version: 0, castleAt: { ...CASTLE_AT }, portalAt: { ...PORTAL_AT }, seed: -1, L: 0 };

  const cellX = (i) => -W / 2 + (i + 0.5) * CELL, cellZ = (j) => -H / 2 + (j + 0.5) * CELL;
  const colOf = (x) => Math.floor((x + W / 2) / CELL), rowOf = (z) => Math.floor((z + H / 2) / CELL);
  const inGrid = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows;
  const idx = (i, j) => j * cols + i;
  const idxAt = (x, z) => { const i = colOf(x), j = rowOf(z); return inGrid(i, j) ? idx(i, j) : -1; };
  Object.assign(arena, { cellX, cellZ, colOf, rowOf, idx, idxAt, inGrid });

  // ---------- obstáculos: o array é trocado a cada mudança (o main.js reindexa pela identidade) ----------
  const solid = new Set();
  const pathCache = new Map();
  arena.obstacles = [];
  const refresh = () => { arena.obstacles = [...solid]; arena.version++; pathCache.clear(); };
  arena.addSolid = (o) => { solid.add(o); refresh(); return o; };
  arena.removeSolid = (o) => { if (solid.delete(o)) refresh(); };

  // ---------- grade de ocupação ----------
  // pegada de size x size células a partir do canto (i0, j0); centro em metros
  arena.footprint = (size, i0, j0) => ({ x: cellX(i0) - CELL / 2 + size * CELL / 2, z: cellZ(j0) - CELL / 2 + size * CELL / 2 });
  // canto da pegada que deixa o centro mais perto do ponto (x, z)
  arena.snap = (size, x, z) => ({ i0: Math.round((x + W / 2) / CELL - size / 2), j0: Math.round((z + H / 2) / CELL - size / 2) });
  arena.canPlace = (size, i0, j0) => {
    for (let i = i0; i < i0 + size; i++) for (let j = j0; j < j0 + size; j++) {
      if (i < 1 || j < 1 || i >= cols - 1 || j >= rows - 1 || blocked[idx(i, j)]) return false;
    }
    const c = arena.footprint(size, i0, j0);
    return Math.hypot(c.x - PORTAL_AT.x, c.z - PORTAL_AT.z) > PORTAL_SAFE + size;
  };
  arena.occupy = (size, i0, j0, ref, kind = 2) => {
    for (let i = i0; i < i0 + size; i++) for (let j = j0; j < j0 + size; j++) { blocked[idx(i, j)] = kind; owner[idx(i, j)] = ref; }
    arena.version++; pathCache.clear();
  };
  arena.release = (size, i0, j0) => {
    for (let i = i0; i < i0 + size; i++) for (let j = j0; j < j0 + size; j++) { blocked[idx(i, j)] = 0; owner[idx(i, j)] = null; }
    arena.version++; pathCache.clear();
  };
  arena.ownerAt = (x, z) => { const k = idxAt(x, z); return k < 0 ? null : owner[k]; };

  // ---------- recursos ----------
  function addNode(type, x, z) {
    const i = colOf(x), j = rowOf(z);
    if (!inGrid(i, j) || i < 1 || j < 1 || i >= cols - 1 || j >= rows - 1 || blocked[idx(i, j)]) return null;
    const t = NODE_TYPES[type];
    const node = { type, res: t.res, amount: t.amount, max: t.amount, x: cellX(i), z: cellZ(j), r: t.r, cell: idx(i, j), variant: Math.floor(rand() * 4), mesh: null };
    node.solid = arena.addSolid({ x: node.x, z: node.z, r: t.r });
    blocked[node.cell] = 1;
    owner[node.cell] = node;
    nodes.push(node);
    return node;
  }
  arena.addNode = addNode;
  arena.removeNode = (node) => {
    const k = nodes.indexOf(node);
    if (k < 0) return;
    nodes.splice(k, 1);
    blocked[node.cell] = 0;
    owner[node.cell] = null;
    arena.removeSolid(node.solid);
    node.mesh?.removeFromParent?.();
  };
  arena.nodeAt = (x, z, pad = 0.6) => {
    let best = null, bd = Infinity;
    for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < n.r + pad && d < bd) { bd = d; best = n; } }
    return best;
  };
  // recurso do mesmo tipo mais perto de um ponto (aldeão procura outra árvore quando a dele acaba)
  arena.nearestNode = (res, x, z, maxDist = Infinity) => {
    let best = null, bd = maxDist;
    for (const n of nodes) if (n.res === res && n.amount > 0) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
    return best;
  };

  // portal: pegada 3x3 no centro do lado inimigo
  {
    const i0 = colOf(PORTAL_AT.x) - 1, j0 = rowOf(PORTAL_AT.z) - 1;
    for (let i = i0; i < i0 + 3; i++) for (let j = j0; j < j0 + 3; j++) { blocked[idx(i, j)] = 3; owner[idx(i, j)] = 'portal'; }
  }
  // castelo: a pegada é reservada aqui; o kingdom.js ocupa com o prédio de verdade
  arena.castleCell = arena.snap(4, CASTLE_AT.x, CASTLE_AT.z);
  for (const [type, cx, cz, count, spread] of LAYOUT) {
    for (let k = 0, tries = 0; k < count && tries < count * 8; tries++) {
      const a = rand() * Math.PI * 2, d = spread * Math.sqrt(rand());
      if (addNode(type, cx + Math.cos(a) * d, cz + Math.sin(a) * d)) k++;
    }
  }

  // ---------- interface de mundo usada pelas unidades ----------
  const half = { x: W / 2 - 0.8, z: H / 2 - 0.8 };
  arena.groundHeight = () => 0;
  arena.isShallow = () => false;
  arena.zoneOf = () => null;
  arena.gloomAt = () => 0;
  arena.anchorS = () => 0;
  arena.canStep = (from, to) => Math.abs(to.x) <= half.x && Math.abs(to.z) <= half.z;
  arena.pointAt = () => new THREE.Vector3(CASTLE_AT.x + 7, 0, CASTLE_AT.z);
  arena.tangentAt = () => new THREE.Vector3(1, 0, 0);
  arena.sideOf = (fwd) => new THREE.Vector3(-fwd.z, 0, fwd.x);
  arena.along = (s, x = 0) => new THREE.Vector3(CASTLE_AT.x + 7 + s, 0, x);

  // ---------- caminhos: linha reta quando livre, senão A* na grade ----------
  let budget = PATH_BUDGET;
  arena.update = () => { budget = PATH_BUDGET; };
  const passable = (k) => blocked[k] === 0;
  // linha livre de a até b; as células do próprio alvo (prédio, árvore) não bloqueiam
  function clear(ax, az, bx, bz, goalOwner = null) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.6);
    const startCell = idxAt(ax, az);
    for (let s = 1; s <= n; s++) {
      const t = s / n, k = idxAt(ax + (bx - ax) * t, az + (bz - az) * t);
      if (k < 0) return false;
      if (k !== startCell && !passable(k) && !(goalOwner && owner[k] === goalOwner)) return false;
    }
    return true;
  }
  arena.clearLine = clear;
  // célula livre mais perto do alvo, puxando para o lado de quem vem
  function nearestFree(g, fromX, fromZ) {
    const gi = g % cols, gj = (g / cols) | 0;
    let best = -1, bd = Infinity;
    for (let r = 1; r <= 6 && best < 0; r++) {
      for (let i = gi - r; i <= gi + r; i++) for (let j = gj - r; j <= gj + r; j++) {
        if (Math.max(Math.abs(i - gi), Math.abs(j - gj)) !== r || !inGrid(i, j) || !passable(idx(i, j))) continue;
        const score = Math.hypot(i - gi, j - gj) * CELL + 0.3 * Math.hypot(cellX(i) - fromX, cellZ(j) - fromZ);
        if (score < bd) { bd = score; best = idx(i, j); }
      }
    }
    return best;
  }
  const gScore = new Float32Array(cols * rows), came = new Int32Array(cols * rows), seen = new Uint32Array(cols * rows);
  let stamp = 0;
  const heap = [];
  function astar(s, g) {
    stamp++;
    heap.length = 0;
    const gi = g % cols, gj = (g / cols) | 0;
    const h = (k) => { const dx = Math.abs(k % cols - gi), dz = Math.abs(((k / cols) | 0) - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const push = (k, f) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    seen[s] = stamp; gScore[s] = 0; came[s] = -1;
    push(s, h(s));
    let expanded = 0;
    while (heap.length && expanded++ < 4000) {
      const [, k] = pop();
      if (k === g) {
        const path = [];
        for (let c = g; c !== -1; c = came[c]) path.push(c);
        return path.reverse();
      }
      const ki = k % cols, kj = (k / cols) | 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = ki + di, nj = kj + dj;
        if (!inGrid(ni, nj)) continue;
        const n = idx(ni, nj);
        if (!passable(n) && n !== g) continue;
        if (di && dj && (!passable(idx(ki + di, kj)) || !passable(idx(ki, kj + dj)))) continue;   // sem cortar quina
        const cost = gScore[k] + (di && dj ? 1.414 : 1);
        if (seen[n] === stamp && gScore[n] <= cost) continue;
        seen[n] = stamp; gScore[n] = cost; came[n] = k;
        push(n, cost + h(n));
      }
    }
    return null;
  }
  arena.findPath = astar;
  const way = new THREE.Vector3();
  arena.nextWaypoint = (from, to) => {
    const g0 = idxAt(to.x, to.z), s = idxAt(from.x, from.z);
    if (s < 0 || g0 < 0) return to;
    const goalOwner = !passable(g0) ? owner[g0] || 'portal' : null;
    if (clear(from.x, from.z, to.x, to.z, goalOwner)) return to;
    const g = passable(g0) ? g0 : nearestFree(g0, from.x, from.z);
    if (g < 0 || g === s) return to;
    const key = s * 100000 + g;
    let path = pathCache.get(key);
    if (path === undefined) {
      if (budget <= 0) return to;
      budget--;
      path = astar(s, g);
      if (pathCache.size > 600) pathCache.clear();
      pathCache.set(key, path);
    }
    if (!path || path.length < 2) return to;
    let pick = 1;
    for (let k = Math.min(path.length - 1, 10); k > 1; k--) {
      if (clear(from.x, from.z, cellX(path[k] % cols), cellZ((path[k] / cols) | 0))) { pick = k; break; }
    }
    if (pick === path.length - 1 && g === g0) return to;
    return way.set(cellX(path[pick] % cols), 0, cellZ((path[pick] / cols) | 0));
  };
  return arena;
}

// ---------- cenário: chão, bordas e malhas dos recursos ----------
export function buildArenaScene(arena, parentScene, models) {
  const { W, H } = ARENA;
  const root = new THREE.Group();
  root.name = 'kingdom-arena';
  parentScene.add(root);
  // gramado com manchas suaves (cores por vértice) e uma faixa de terra entre o castelo e o portal
  const geo = new THREE.PlaneGeometry(W + 60, H + 60, 86, 70).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = [];
  const grass = [new THREE.Color(0x5fae35), new THREE.Color(0x4d9a2c), new THREE.Color(0x6dba40)], dirt = new THREE.Color(0xc9a466), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) + Math.sin((x + z) * 0.05) * 0.6;
    c.copy(grass[0]).lerp(n > 0 ? grass[2] : grass[1], Math.min(1, Math.abs(n) * 0.7));
    const lane = Math.max(0, 1 - Math.abs(z + Math.sin(x * 0.08) * 4) / 3.2) * (Math.abs(x) < 46 ? 1 : 0);
    c.lerp(dirt, lane * 0.55);
    const outside = Math.max(0, Math.abs(x) - W / 2, Math.abs(z) - H / 2);
    if (outside > 0) { c.multiplyScalar(Math.max(0.75, 1 - outside * 0.02)); pos.setY(k, Math.min(4, outside * 0.25) * (0.6 + 0.4 * Math.sin(x * 0.3 + z * 0.2))); }
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  ground.receiveShadow = true;
  root.add(ground);
  // moldura de árvores fora da arena (só enfeite)
  let s = 3;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 90; k++) {
    const side = k % 4, t = rnd() * 2 - 1, out = 2 + rnd() * 9;
    const x = side < 2 ? t * (W / 2 + 6) : (side === 2 ? -1 : 1) * (W / 2 + out);
    const z = side < 2 ? (side === 0 ? -1 : 1) * (H / 2 + out) : t * (H / 2 + 6);
    const tree = models.makeTree(k % 4);
    tree.position.set(x, 0, z);
    tree.rotation.y = rnd() * 6.28;
    tree.scale.setScalar(0.9 + rnd() * 0.5);
    root.add(tree);
  }
  for (const node of arena.nodes) addNodeMesh(node, root, models);
  return root;
}

export function addNodeMesh(node, root, models) {
  const mesh = node.type === 'tree' ? models.makeTree(node.variant) : node.type === 'rock' ? models.makeRock(node.variant) : models.makeMine();
  mesh.position.set(node.x, 0, node.z);
  mesh.rotation.y = node.variant * 1.7 + node.x;
  if (node.type === 'tree') mesh.scale.setScalar(0.85 + (node.variant % 3) * 0.12);
  mesh.userData.node = node;
  node.mesh = mesh;
  root.add(mesh);
}
