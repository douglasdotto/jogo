// Mapa do modo Reino: vale com rio e pontes entre a clareira do castelo (oeste) e o ermo do Portal de Ossos (leste),
// bordas naturais (floresta, rochedos, montanhas), lagos, estrada de terra, covas de ossos nas bordas e nós de recurso
// (árvores, frutas, rochas, minas) em bosques. Mesma interface de "world" que as unidades do main.js usam
// (groundHeight, canStep, obstacles, nextWaypoint...). A lógica não depende de malhas: os testes a usam pura.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ARENA = { W: 112, H: 80, CELL: 2 };
export const NODE_TYPES = {
  tree: { res: 'wood', amount: 120, r: 0.7 },
  berry: { res: 'food', amount: 90, r: 0.7 },
  rock: { res: 'stone', amount: 300, r: 1.0 },
  mine: { res: 'gold', amount: 700, r: 1.6 },
};
// tipo do chão em cada célula: só grama e o raso (vau) e a ponte deixam andar; ponte e vau não aceitam obra
export const TERRAIN = { GRASS: 0, WATER: 1, BRIDGE: 2, FORD: 3, CLIFF: 4, FOREST: 5 };
const T = TERRAIN;
const CASTLE_AT = { x: -40, z: 0 }, PORTAL_AT = { x: 44, z: 0 };
const PORTAL_SAFE = 16;            // ninguém constrói perto do portal
const PATH_BUDGET = 14;            // buscas A* por quadro; o resto segue reto e desvia
const WATER_Y = -0.3;              // nível da água (o leito fica abaixo)
const DECK_Y = 0.28;               // tabuado das pontes

// rio de norte a sul, meio sinuoso; pontes e vau são as passagens (pontos de estrangulamento)
const riverX = (z) => 7 + 4.5 * Math.sin(z * 0.075 + 0.6) + 1.6 * Math.sin(z * 0.21 + 1.3);
const riverHalf = (z) => 2.7 + 0.5 * Math.sin(z * 0.13 + 2);
const BRIDGES = [-12, 16];         // z do meio de cada ponte (2 células de largura)
const FORD_Z = -26;
const PONDS = [{ x: -20, z: 30, r: 4.2 }, { x: 34, z: -25, r: 3.8, murky: true }];
// covas de ossos nas bordas: as ondas também saem delas
const ENTRIES = [{ x: -20, z: -35 }, { x: -2, z: 35 }, { x: 28, z: 34 }];
// estrada de terra: castelo → ponte do norte → portal, com um ramal pela ponte do sul
const ROADS = [
  [[-35, 0], [-24, -3], [-10, -9], [riverX(-12) - 6, -12], [riverX(-12) + 6, -12], [22, -7], [34, -1], [41, 0]],
  [[-22, -3], [-8, 9], [riverX(16) - 6, 16], [riverX(16) + 6, 16], [24, 11], [35, 2]],
];

// grupos de recursos: [tipo, x, z, quantidade, espalhamento, riqueza]; os perto do castelo garantem o começo
const LAYOUT = [
  ['tree', -46, -24, 20, 6], ['tree', -32, 25, 14, 5], ['tree', -8, -28, 22, 6], ['tree', 0, 25, 22, 6],
  ['tree', 24, -22, 14, 5], ['tree', 28, 24, 12, 4], ['tree', -50, 26, 6, 3],
  ['berry', -46, 13, 6, 2.5], ['berry', -34, -17, 5, 2], ['berry', -12, 20, 5, 2.5],
  ['rock', -22, -22, 4, 2], ['rock', -20, 18, 3, 2], ['rock', -4, -16, 5, 2.5], ['rock', 20, 20, 5, 2.5], ['rock', 16, -30, 4, 2], ['rock', -51, -12, 3, 2],
  ['mine', -27, -10, 1, 0], ['mine', -26, 13, 1, 0], ['mine', -2, 4, 1, 0, 1.5], ['mine', 19, -28, 1, 0, 1.5], ['mine', 18, 30, 1, 0, 1.5], ['mine', 30, -13, 1, 0, 2],
];

const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

export function createArena(seedValue = 7) {
  const { W, H, CELL } = ARENA;
  const cols = W / CELL, rows = H / CELL;
  let seed = seedValue;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blocked = new Uint8Array(cols * rows);   // 0 livre, 1 recurso, 2 construção, 3 portal, 4 terreno (água, rochedo, mata)
  const ground = new Uint8Array(cols * rows);    // TERRAIN de cada célula
  const road = new Uint8Array(cols * rows);
  const owner = new Array(cols * rows).fill(null);
  const nodes = [];
  const arena = { cols, rows, blocked, ground, road, owner, nodes, version: 0, castleAt: { ...CASTLE_AT }, portalAt: { ...PORTAL_AT },
    entries: ENTRIES.map((e) => ({ ...e })), bridges: [], seed: -1, L: 0, waterY: WATER_Y };

  const cellX = (i) => -W / 2 + (i + 0.5) * CELL, cellZ = (j) => -H / 2 + (j + 0.5) * CELL;
  const colOf = (x) => Math.floor((x + W / 2) / CELL), rowOf = (z) => Math.floor((z + H / 2) / CELL);
  const inGrid = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows;
  const idx = (i, j) => j * cols + i;
  const idxAt = (x, z) => { const i = colOf(x), j = rowOf(z); return inGrid(i, j) ? idx(i, j) : -1; };
  Object.assign(arena, { cellX, cellZ, colOf, rowOf, idx, idxAt, inGrid });

  // ---------- relevo e regiões (funções contínuas: o cenário e a grade usam as mesmas) ----------
  const riverDist = (x, z) => Math.abs(x - riverX(z)) - riverHalf(z);              // < 0 dentro do rio
  const pondDist = (x, z) => Math.min(...PONDS.map((p) => Math.hypot(x - p.x, z - p.z) - p.r));
  const waterDist = (x, z) => Math.min(riverDist(x, z), pondDist(x, z));
  const roadDist = (x, z) => {
    let d = Infinity;
    for (const r of ROADS) for (let k = 1; k < r.length; k++) d = Math.min(d, segDist(x, z, r[k - 1][0], r[k - 1][1], r[k][0], r[k][1]));
    return d;
  };
  const entryNear = (x, z) => Math.min(...ENTRIES.map((e) => Math.hypot(x - e.x, z - e.z)));
  // faixa natural da borda: > 0 dentro do mato/rochedo; mais funda ao norte (rochedos) e a leste (montanhas do ermo)
  const edgeOf = (x, z) => {
    const d = [z + H / 2, H / 2 - z, x + W / 2, W / 2 - x];   // norte, sul, oeste, leste
    let side = 0;
    for (let k = 1; k < 4; k++) if (d[k] < d[side]) side = k;
    return { side, d: d[side] };
  };
  const band = (x, z) => {
    const { side, d } = edgeOf(x, z);
    const n = 0.5 + 0.25 * Math.sin(x * 0.21 + z * 0.17) + 0.25 * Math.sin(x * 0.07 - z * 0.13 + 1);
    let th = 2.6 + 4.2 * n + (side === 0 || side === 3 ? 1.5 : 0);
    th -= 9 * Math.max(0, 1 - entryNear(x, z) / 6.5);                               // boca das covas aberta
    th -= 9 * Math.max(0, 1 - Math.hypot(x - PORTAL_AT.x, z - PORTAL_AT.z) / 9);
    return th - d;
  };
  const sideOfEdge = (x, z) => edgeOf(x, z).side;
  // escuridão: verde perto do castelo, terra morta rumo ao portal e em volta das covas
  const gloom = (x, z) => Math.min(1, Math.max(smooth(x, 12, 42), 0.85 * (1 - smooth(entryNear(x, z), 3, 11))));
  // colinas baixas só longe da clareira do castelo e do portal (onde não atrapalham)
  const hill = (x, z) => 0.38 * (0.5 + 0.5 * Math.sin(x * 0.09 + 1) * Math.cos(z * 0.11 - 0.5))
    * smooth(Math.hypot(x - CASTLE_AT.x, z - CASTLE_AT.z), 14, 24) * smooth(Math.hypot(x - PORTAL_AT.x, z - PORTAL_AT.z), 8, 16)
    * smooth(entryNear(x, z), 4, 9);
  const SLOPE = [1.15, 0.22, 0.5, 0.95];                                           // norte, sul, oeste, leste
  const lift = (x, z) => {
    const b = band(x, z);
    if (b <= -1) return 0;
    const side = sideOfEdge(x, z);
    const rough = 0.75 + 0.25 * Math.sin(x * 0.37 + z * 0.29) * Math.cos(x * 0.17 - z * 0.41);
    return (smooth(b, -1, 3) * 1.4 + Math.max(0, b - 3) * SLOPE[side]) * rough * smooth(riverDist(x, z), 1, 6);
  };
  const carve = (x, z) => {
    const r = riverDist(x, z), p = pondDist(x, z);
    return Math.max(1.15 * smooth(-r, -1.2, 1.6), 1.0 * smooth(-p, -1, 1.5));
  };
  const heightAt = (x, z) => hill(x, z) + lift(x, z) - carve(x, z);   // relevo do cenário (sem as pontes)
  Object.assign(arena, { riverX, riverDist, pondDist, waterDist, roadDist, band, gloom, heightAt, edgeSide: sideOfEdge, ponds: PONDS });

  // ---------- grade do terreno ----------
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = cellX(i), z = cellZ(j), k = idx(i, j);
    let t = T.GRASS;
    if (band(x, z) > 0) t = sideOfEdge(x, z) === 0 || sideOfEdge(x, z) === 3 ? T.CLIFF : T.FOREST;
    if (waterDist(x, z) < 0) t = T.WATER;
    if (t === T.WATER && riverDist(x, z) < 0) {
      if (BRIDGES.some((bz) => Math.abs(z - bz) < 1.5)) t = T.BRIDGE;
      else if (Math.abs(z - FORD_Z) < 1.5) t = T.FORD;
    }
    ground[k] = t;
    if (t === T.WATER || t === T.CLIFF || t === T.FOREST) blocked[k] = 4;
    if (roadDist(x, z) < 1.8 && t === T.GRASS) road[k] = 1;
  }
  // pontes: retângulo do tabuado (um pouco além da água de cada lado)
  for (const bz of BRIDGES) {
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (ground[idx(i, j)] === T.BRIDGE && Math.abs(cellZ(j) - bz) < 1.5) { x0 = Math.min(x0, cellX(i)); x1 = Math.max(x1, cellX(i)); }
    arena.bridges.push({ x0: x0 - CELL * 1.5, x1: x1 + CELL * 1.5, z: bz, z0: bz - 2, z1: bz + 2 });
  }
  const onBridge = (x, z) => arena.bridges.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  const groundAtCell = (x, z) => { const k = idxAt(x, z); return k < 0 ? -1 : ground[k]; };
  arena.terrainAt = groundAtCell;

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
      if (i < 1 || j < 1 || i >= cols - 1 || j >= rows - 1 || blocked[idx(i, j)] || ground[idx(i, j)] !== T.GRASS) return false;
    }
    const c = arena.footprint(size, i0, j0);
    if (ENTRIES.some((e) => Math.hypot(c.x - e.x, c.z - e.z) < 5 + size)) return false;   // boca das covas livre
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
  function addNode(type, x, z, rich = 1) {
    const i = colOf(x), j = rowOf(z);
    if (!inGrid(i, j) || i < 1 || j < 1 || i >= cols - 1 || j >= rows - 1 || blocked[idx(i, j)] || ground[idx(i, j)] !== T.GRASS || road[idx(i, j)]) return null;
    const t = NODE_TYPES[type];
    const amount = Math.round(t.amount * rich);
    const node = { type, res: t.res, amount, max: amount, rich, x: cellX(i), z: cellZ(j), r: t.r, cell: idx(i, j), variant: Math.floor(rand() * 4), mesh: null };
    node.solid = arena.addSolid({ x: node.x, z: node.z, r: t.r });
    blocked[node.cell] = 1;
    owner[node.cell] = node;
    nodes.push(node);
    return node;
  }
  arena.addNode = addNode;
  // fazenda: fonte de comida sem célula própria (a obra já ocupa a grade); não esgota
  arena.addFarmNode = (b) => {
    const node = { type: 'farm', res: 'food', amount: Infinity, max: Infinity, x: b.pos.x, z: b.pos.z, r: b.reach, cell: -1, farm: b, rate: 0.75, variant: 0, mesh: null, user: null };
    nodes.push(node);
    return node;
  };
  arena.removeNode = (node) => {
    const k = nodes.indexOf(node);
    if (k < 0) return;
    nodes.splice(k, 1);
    if (node.cell >= 0) {
      blocked[node.cell] = 0;
      owner[node.cell] = null;
      arena.removeSolid(node.solid);
    }
    node.mesh?.removeFromParent?.();
  };
  arena.nodeAt = (x, z, pad = 0.6) => {
    let best = null, bd = Infinity;
    for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < n.r + pad && d < bd) { bd = d; best = n; } }
    return best;
  };
  // fazenda com outro aldeão trabalhando fica de fora (uma pessoa por fazenda)
  const taken = (n, who) => n.farm && n.user && n.user !== who && !n.user.dead && n.user.task?.node === n;
  arena.farmTaken = taken;
  // recurso do mesmo tipo mais perto de um ponto (aldeão procura outra árvore quando a dele acaba)
  arena.nearestNode = (res, x, z, maxDist = Infinity, who = null) => {
    let best = null, bd = maxDist;
    for (const n of nodes) if (n.res === res && n.amount > 0 && !taken(n, who)) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
    return best;
  };

  // portal: pegada 3x3 no centro do lado inimigo
  {
    const i0 = colOf(PORTAL_AT.x) - 1, j0 = rowOf(PORTAL_AT.z) - 1;
    for (let i = i0; i < i0 + 3; i++) for (let j = j0; j < j0 + 3; j++) { blocked[idx(i, j)] = 3; owner[idx(i, j)] = 'portal'; }
  }
  // castelo: a pegada é reservada aqui; o kingdom.js ocupa com o prédio de verdade
  arena.castleCell = arena.snap(4, CASTLE_AT.x, CASTLE_AT.z);
  for (const [type, cx, cz, count, spread, rich = 1] of LAYOUT) {
    for (let k = 0, tries = 0; k < count && tries < count * 8; tries++) {
      const a = rand() * Math.PI * 2, d = spread * Math.sqrt(rand());
      if (addNode(type, cx + Math.cos(a) * d, cz + Math.sin(a) * d, rich)) k++;
    }
  }

  // ---------- interface de mundo usada pelas unidades ----------
  const half = { x: W / 2 - 0.8, z: H / 2 - 0.8 };
  const walkable = (x, z) => { const t = groundAtCell(x, z); return t === T.GRASS || t === T.BRIDGE || t === T.FORD; };
  arena.walkable = walkable;
  arena.groundHeight = (x, z) => {
    if (onBridge(x, z)) return DECK_Y;
    const t = groundAtCell(x, z);
    const h = heightAt(x, z);
    return t === T.FORD ? Math.max(h, WATER_Y - 0.12) : t === T.GRASS || t === T.BRIDGE ? Math.max(h, WATER_Y - 0.15) : h;
  };
  arena.isShallow = (x, z) => groundAtCell(x, z) === T.FORD;
  arena.zoneOf = () => null;
  arena.gloomAt = () => 0;
  arena.anchorS = () => 0;
  // água, rochedo e mata fechada seguram as unidades; quem já está num deles (empurrão) pode sair
  arena.canStep = (from, to) => Math.abs(to.x) <= half.x && Math.abs(to.z) <= half.z && (walkable(to.x, to.z) || !walkable(from.x, from.z));
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
  arena.nearestFree = nearestFree;
  const gScore = new Float32Array(cols * rows), came = new Int32Array(cols * rows), seen = new Uint32Array(cols * rows);
  let stamp = 0;
  // Heap binário em três buffers paralelos: reusados entre buscas sem criar um array por nó.
  const heapF = [], heapK = [], heapG = [];
  let heapSize = 0;
  function astar(s, g) {
    stamp++;
    heapSize = 0;
    const gi = g % cols, gj = (g / cols) | 0;
    const h = (k) => { const dx = Math.abs(k % cols - gi), dz = Math.abs(((k / cols) | 0) - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const push = (k, f, score) => {
      let c = heapSize++;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heapF[p] <= f) break;
        heapF[c] = heapF[p]; heapK[c] = heapK[p]; heapG[c] = heapG[p];
        c = p;
      }
      heapF[c] = f; heapK[c] = k; heapG[c] = score;
    };
    let poppedG = 0;
    const pop = () => {
      const k = heapK[0];
      poppedG = heapG[0];
      const last = --heapSize;
      if (last > 0) {
        const lastF = heapF[last], lastK = heapK[last], lastG = heapG[last];
        let c = 0;
        for (;;) {
          const l = c * 2 + 1, r = l + 1;
          if (l >= heapSize) break;
          const m = r < heapSize && heapF[r] < heapF[l] ? r : l;
          if (heapF[m] >= lastF) break;
          heapF[c] = heapF[m]; heapK[c] = heapK[m]; heapG[c] = heapG[m];
          c = m;
        }
        heapF[c] = lastF; heapK[c] = lastK; heapG[c] = lastG;
      }
      return k;
    };
    seen[s] = stamp; gScore[s] = 0; came[s] = -1;
    push(s, h(s), gScore[s]);
    let expanded = 0;
    while (heapSize && expanded++ < 4000) {
      const k = pop();
      if (poppedG !== gScore[k]) continue;   // descarta a entrada antiga quando outra rota já chegou com custo menor
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
        const cost = gScore[k] + (di && dj ? 1.414 : 1) * (ground[n] === T.FORD ? 1.6 : 1);   // o vau atrasa
        if (seen[n] === stamp && gScore[n] <= cost) continue;
        seen[n] = stamp; gScore[n] = cost; came[n] = k;
        push(n, cost + h(n), gScore[n]);
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

// ---------- cenário: chão, água, pontes, bordas e decoração instanciada ----------
const lowGraphics = () => { try { return localStorage.getItem('cavaleiros-graficos') === 'baixa'; } catch { return false; } };

// junta as malhas de um grupo por material (uma draw call por material)
function mergeGroup(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const keep = new THREE.BufferGeometry();
    keep.setAttribute('position', g.attributes.position);
    keep.setAttribute('normal', g.attributes.normal);
    keep.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(keep);
  });
  const out = new THREE.Group();
  for (const [m, list] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(list), m);
    mesh.geometry.userData.kOwn = true;
    mesh.castShadow = m.isMeshLambertMaterial === true;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

export function buildArenaScene(arena, parentScene, models) {
  const { W, H } = ARENA;
  const low = lowGraphics();
  const few = (n) => (low ? Math.ceil(n * 0.45) : n);
  const root = new THREE.Group();
  root.name = 'kingdom-arena';
  parentScene.add(root);
  let s = 3;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const range = (a, b) => a + rnd() * (b - a);
  const C = (h) => new THREE.Color(h);
  const c = new THREE.Color(), c2 = new THREE.Color();

  // ---------- chão: relevo + cores por vértice (grama → terra morta, estrada, margens, rochedos) ----------
  const EXT = { w: W + 120, h: H + 100 };
  const seg = low ? 2.4 : 1.4;
  const geo = new THREE.PlaneGeometry(EXT.w, EXT.h, Math.round(EXT.w / seg), Math.round(EXT.h / seg)).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const grass = [C(0x6cbc3c), C(0x57a730), C(0x7cc84a)], meadow = C(0x8fd357), forest = C(0x3f7a2a);
  const dead = [C(0x6e6152), C(0x5c5060), C(0x7a6a58)], dirt = C(0xc9a466), darkDirt = C(0x6b5646);
  const sand = C(0xd9c58e), mud = C(0x5d5048), bed = C(0x6f8a74), rockC = C(0x8f8a82), darkRock = C(0x4c4552), snow = C(0xf2f4f7);
  const castle = arena.castleAt;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const y = arena.heightAt(x, z);
    pos.setY(k, y);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) + Math.sin((x + z) * 0.05) * 0.6 + Math.sin(x * 0.53 + z * 0.41) * 0.25;
    c.copy(grass[0]).lerp(n > 0 ? grass[2] : grass[1], Math.min(1, Math.abs(n) * 0.7));
    c.lerp(meadow, 0.35 * (1 - smooth(Math.hypot(x - castle.x, z - castle.z), 8, 22)));          // clareira clara do castelo
    const g = arena.gloom(x, z);
    c2.copy(dead[0]).lerp(n > 0 ? dead[1] : dead[2], Math.min(1, Math.abs(n)));
    c.lerp(c2, g);
    const b = arena.band(x, z), side = arena.edgeSide(x, z);
    if (b > -1.5) {
      const rocky = side === 0 || side === 3;
      c2.copy(rocky ? rockC : forest).lerp(darkRock, rocky ? g * 0.8 : g * 0.6);
      c.lerp(c2, smooth(b, -1.5, 1.5));
      if (rocky && y > 9) c.lerp(side === 0 ? snow : darkRock, smooth(y, 9, 15) * (side === 0 ? 0.9 : 0.5));
    }
    const rd = arena.roadDist(x, z);
    if (rd < 2.4) c.lerp(c2.copy(dirt).lerp(darkDirt, g), (1 - smooth(rd, 1.1, 2.4)) * 0.8);
    const wd = arena.waterDist(x, z);
    if (wd < 1.4) c.lerp(c2.copy(sand).lerp(mud, g), smooth(-wd, -1.4, 0.2) * 0.8);
    if (y < arena.waterY - 0.05) c.lerp(c2.copy(bed).lerp(mud, g), 0.8);
    colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  ground.receiveShadow = true;
  ground.geometry.userData.kOwn = ground.material.userData.kOwn = true;
  root.add(ground);

  // ---------- água: um plano só no nível do rio (o chão esconde o resto); azul → turva no ermo ----------
  {
    const wg = new THREE.PlaneGeometry(EXT.w, EXT.h, Math.round(EXT.w / 3), Math.round(EXT.h / 3)).rotateX(-Math.PI / 2);
    const wp = wg.attributes.position, wc = new Float32Array(wp.count * 3);
    const deep = C(0x2f86b8), shallow = C(0x7fd0e0), murky = C(0x3b4f5a);
    for (let k = 0; k < wp.count; k++) {
      const x = wp.getX(k), z = wp.getZ(k);
      c.copy(shallow).lerp(deep, smooth(arena.waterY - arena.heightAt(x, z), 0.1, 0.7)).lerp(murky, arena.gloom(x, z) * 0.75);
      wc[k * 3] = c.r; wc[k * 3 + 1] = c.g; wc[k * 3 + 2] = c.b;
    }
    wg.setAttribute('color', new THREE.BufferAttribute(wc, 3));
    const water = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false }));
    water.position.y = arena.waterY;
    water.renderOrder = -1;
    water.geometry.userData.kOwn = water.material.userData.kOwn = true;
    root.add(water);
  }

  // ---------- pontes e covas de ossos (malhas mescladas) ----------
  for (const b of arena.bridges) {
    const g = models.makeBridge(b.x1 - b.x0, b.z1 - b.z0);
    g.position.set((b.x0 + b.x1) / 2, 0, b.z);
    root.add(mergeGroup(g));
  }
  const entryGlows = [];
  for (const e of arena.entries) {
    const g = models.makeBurrow();
    g.position.set(e.x, arena.heightAt(e.x, e.z), e.z);
    g.rotation.y = Math.atan2(arena.castleAt.x - e.x, arena.castleAt.z - e.z);
    const glow = g.getObjectByName('glow');
    glow.removeFromParent();
    root.add(mergeGroup(g));
    glow.position.copy(g.position).setY(g.position.y + 0.06);
    glow.rotation.x = -Math.PI / 2;
    root.add(glow);
    entryGlows.push(glow);
  }
  root.userData.entryGlows = entryGlows;

  // ---------- decoração instanciada ----------
  const dummy = new THREE.Object3D();
  const inst = (geom, list, palette, { shadow = true, mat = null } = {}) => {
    if (!list.length) return null;
    const m = mat || new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const im = new THREE.InstancedMesh(geom, m, list.length);
    geom.userData.kOwn = m.userData.kOwn = true;
    list.forEach((p, k) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      dummy.scale.set(p.s * (p.sx || 1), p.s * (p.sy || 1), p.s * (p.sz || 1));
      dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
      if (!mat || palette) im.setColorAt(k, c.set(palette[p.v % palette.length]).lerp(c2.set(p.tint ?? 0x4f465e), p.g || 0));
    });
    im.castShadow = shadow && !low;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    root.add(im);
    return im;
  };
  // sorteia pontos numa área até juntar n que passam no filtro
  const scatter = (n, area, ok) => {
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 30; tries++) {
      const x = range(area[0], area[1]), z = range(area[2], area[3]);
      const p = ok(x, z);
      if (p) out.push({ x, z, y: arena.heightAt(x, z), v: Math.floor(rnd() * 8), ry: rnd() * 6.28, s: 1, g: arena.gloom(x, z), ...p });
    }
    return out;
  };
  const OUT = [-W / 2 - 40, W / 2 + 40, -H / 2 - 36, H / 2 + 30];
  const nodeClear = (x, z, r) => !arena.nodes.some((n) => Math.hypot(n.x - x, n.z - z) < r);
  const walk = (x, z) => arena.terrainAt(x, z) === TERRAIN.GRASS;

  // mata fechada nas bordas (oeste e sul) e encostas mais baixas; árvores vivas somem rumo ao ermo
  const trunkGeo = mergeGeometries([new THREE.CylinderGeometry(0.14, 0.24, 2.4, 6).translate(0, 1.2, 0), new THREE.CylinderGeometry(0.07, 0.1, 1, 5).rotateZ(0.7).translate(0.42, 1.9, 0)].map((g) => g.toNonIndexed()));
  const roundTop = mergeGeometries([
    new THREE.IcosahedronGeometry(1.35, 1).translate(0, 3, 0), new THREE.IcosahedronGeometry(0.95, 1).translate(0.9, 2.6, 0.3),
    new THREE.IcosahedronGeometry(0.85, 1).translate(-0.8, 2.7, -0.4), new THREE.IcosahedronGeometry(0.8, 1).translate(0.1, 3.9, 0.2),
  ].map((g) => g.toNonIndexed()));
  const pineTop = mergeGeometries([new THREE.ConeGeometry(1.25, 2.1, 7).translate(0, 2, 0), new THREE.ConeGeometry(0.95, 1.8, 7).translate(0, 3, 0), new THREE.ConeGeometry(0.6, 1.4, 7).translate(0, 3.9, 0)].map((g) => g.toNonIndexed()));
  const forestSpot = (x, z) => {
    const b = arena.band(x, z), y = arena.heightAt(x, z), g = arena.gloom(x, z);
    if (b < -0.3 || arena.waterDist(x, z) < 0.8 || y > 13 || g > 0.55 + rnd() * 0.3) return null;
    if (Math.abs(x) > W / 2 + 36 || z < -H / 2 - 30) return null;
    if (arena.edgeSide(x, z) === 0 && b > 0.5 && rnd() < 0.7) return null;   // ao norte, rochedo mais que mata
    return { s: range(0.85, 1.45), sy: range(0.9, 1.25) };
  };
  const leafy = scatter(few(520), OUT, forestSpot);
  const pines = scatter(few(380), OUT, (x, z) => { const p = forestSpot(x, z); return p && (arena.edgeSide(x, z) !== 1 || rnd() < 0.4) ? p : null; });
  // algumas árvores soltas pela campina (só enfeite, longe dos recursos e do caminho)
  const loose = scatter(few(26), [-50, 20, -34, 34], (x, z) => walk(x, z) && arena.gloom(x, z) < 0.3 && arena.roadDist(x, z) > 4 && arena.waterDist(x, z) > 2.5
    && nodeClear(x, z, 4) && Math.hypot(x - castle.x, z - castle.z) > 18 && rnd() < 0.5 ? { s: range(0.8, 1.1) } : null);
  inst(trunkGeo, [...leafy, ...pines, ...loose], [0x7a4a26, 0x6a3f20, 0x8a5a30]);
  inst(roundTop, [...leafy, ...loose], [0x4f9e34, 0x5aae3a, 0x3f8a2e, 0x66b83f, 0x4a9a3a, 0xf3a6c8, 0x5aae3a, 0x478f30]);
  inst(pineTop, pines, [0x2f6f3a, 0x3a7d3f, 0x2a6334, 0x357a45]);

  // ermo: árvores secas, rochas escuras, ossos e névoa roxa
  const deadGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.12, 0.26, 2.8, 5).translate(0, 1.4, 0), new THREE.CylinderGeometry(0.05, 0.09, 1.3, 4).rotateZ(0.9).translate(0.5, 2.3, 0),
    new THREE.CylinderGeometry(0.05, 0.08, 1.1, 4).rotateZ(-1).translate(-0.45, 2, 0.1), new THREE.CylinderGeometry(0.04, 0.07, 0.9, 4).rotateX(0.9).translate(0, 2.7, 0.35),
  ].map((g) => g.toNonIndexed()));
  const deadTrees = scatter(few(150), OUT, (x, z) => {
    const g = arena.gloom(x, z), b = arena.band(x, z);
    if (g < 0.35 || arena.waterDist(x, z) < 1 || arena.heightAt(x, z) > 12) return null;
    if (b < 0 && (arena.roadDist(x, z) < 3 || !nodeClear(x, z, 3) || Math.hypot(x - arena.portalAt.x, z - arena.portalAt.z) < 7 || rnd() > 0.25)) return null;
    return { s: range(0.8, 1.35), g: 0 };
  });
  inst(deadGeo, deadTrees, [0x5a4a42, 0x4a3e3a, 0x6a5a50, 0x3e3438]);

  // rochedos e montanhas: pedras grandes nas bordas norte/leste, picos ao fundo
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const boulders = scatter(few(300), OUT, (x, z) => {
    const b = arena.band(x, z), side = arena.edgeSide(x, z);
    if (b < -0.5 || arena.waterDist(x, z) < 0.5 || (side !== 0 && side !== 3 && rnd() > 0.15)) return null;
    return { s: range(0.9, 2.6), sy: range(0.55, 1.1), rx: rnd(), y: arena.heightAt(x, z) - 0.3, tint: 0x2e2836 };
  });
  const pebbles = scatter(few(160), [-W / 2, W / 2, -H / 2, H / 2], (x, z) => (walk(x, z) && arena.roadDist(x, z) > 1.2 && nodeClear(x, z, 1.5)
    ? { s: range(0.18, 0.45), sy: 0.6, rx: rnd(), tint: 0x2e2836 } : null));
  // pedras chatas marcando o vau
  const ford = [];
  for (let k = 0; k < arena.cols * arena.rows; k++) {
    if (arena.ground[k] !== TERRAIN.FORD) continue;
    const x = arena.cellX(k % arena.cols), z = arena.cellZ((k / arena.cols) | 0);
    for (let n = 0; n < 2; n++) ford.push({ x: x + range(-0.7, 0.7), z: z + range(-0.7, 0.7), y: arena.waterY - 0.08, v: n, ry: rnd() * 6, s: range(0.35, 0.55), sy: 0.35, g: arena.gloom(x, z), tint: 0x2e2836 });
  }
  inst(rockGeo, [...boulders, ...pebbles, ...ford], [0x9a958c, 0x8a857e, 0xa8a399, 0x7d7a76]);
  const peakGeo = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
  const capGeo = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
  const peaks = [];
  for (let k = 0; k < few(34); k++) {
    const north = k % 3 !== 2;
    const x = north ? range(-W / 2 - 30, W / 2 + 30) : W / 2 + range(14, 34);
    const z = north ? -H / 2 - range(14, 30) : range(-H / 2 - 20, H / 2 + 10);
    const h = range(14, 26);
    peaks.push({ x, z, y: arena.heightAt(x, z) - 2, s: 1, sx: range(9, 15), sy: h, sz: range(9, 15), ry: rnd() * 6.28, v: k, g: north ? 0 : 0.7, tint: 0x3a3244 });
  }
  inst(peakGeo, peaks, [0x8b8a86, 0x7c7b78, 0x96938c], { shadow: false });
  inst(capGeo, peaks.filter((p) => p.g === 0).map((p) => ({ ...p, y: p.y + p.sy * 0.68, sx: p.sx * 0.34, sy: p.sy * 0.33, sz: p.sz * 0.34 })), [0xf4f6f8, 0xe8ecf0], { shadow: false });

  // ossos espalhados no ermo e em volta das covas
  const boneGeo = mergeGeometries([new THREE.CylinderGeometry(0.05, 0.05, 0.7, 5).rotateZ(Math.PI / 2), new THREE.IcosahedronGeometry(0.09, 0).translate(0.36, 0, 0), new THREE.IcosahedronGeometry(0.09, 0).translate(-0.36, 0, 0)].map((g) => g.toNonIndexed()));
  const bones = scatter(few(150), [-W / 2, W / 2, -H / 2, H / 2], (x, z) => (walk(x, z) && arena.gloom(x, z) > 0.5 + rnd() * 0.4 && nodeClear(x, z, 1.5) ? { s: range(0.8, 1.4), y: arena.groundHeight(x, z) + 0.05, g: 0 } : null));
  inst(boneGeo, bones, [0xefe6d2, 0xd9cfb8], { shadow: false });
  const skulls = scatter(few(40), [-W / 2, W / 2, -H / 2, H / 2], (x, z) => (walk(x, z) && arena.gloom(x, z) > 0.6 && nodeClear(x, z, 1.5) ? { s: range(0.18, 0.26), sy: 0.9, y: arena.groundHeight(x, z) + 0.12, g: 0 } : null));
  inst(new THREE.IcosahedronGeometry(1, 0), skulls, [0xf1e8d2], { shadow: false });

  // névoa roxa rasteira em volta do portal e das covas
  const fogMat = new THREE.MeshBasicMaterial({ color: 0x9b5cff, transparent: true, opacity: 0.16, depthWrite: false });
  const fogs = [];
  for (const p of [arena.portalAt, ...arena.entries]) {
    const n = p === arena.portalAt ? few(10) : few(4);
    for (let k = 0; k < n; k++) {
      const a = rnd() * 6.28, d = range(1, p === arena.portalAt ? 11 : 5);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      fogs.push({ x, z, y: arena.heightAt(x, z) + 0.3, s: range(2.2, 4), sy: 0.12, v: 0 });
    }
  }
  inst(new THREE.IcosahedronGeometry(1, 1), fogs, null, { shadow: false, mat: fogMat });

  // capim, flores e juncos (sem sombra)
  const tuftGeo = mergeGeometries([0, 1, 2].map((i) => new THREE.ConeGeometry(0.07, 0.55, 3).rotateZ((i - 1) * 0.35).translate((i - 1) * 0.09, 0.27, 0).toNonIndexed()));
  const tufts = scatter(few(2600), [-W / 2 - 6, W / 2 + 6, -H / 2 - 6, H / 2 + 6], (x, z) => (arena.band(x, z) < 1.5 && arena.waterDist(x, z) > 0.6 && arena.roadDist(x, z) > 1.4
    && (arena.terrainAt(x, z) !== TERRAIN.BRIDGE) ? { s: range(0.7, 1.4), y: arena.heightAt(x, z) } : null));
  inst(tuftGeo, tufts, [0x5aa832, 0x6cbc3c, 0x4f9a2c, 0x7ac44a], { shadow: false });
  const flowerGeo = new THREE.IcosahedronGeometry(0.11, 0).translate(0, 0.28, 0);
  const flowers = scatter(few(800), [-W / 2, 20, -H / 2, H / 2], (x, z) => (walk(x, z) && arena.gloom(x, z) < rnd() * 0.25 && arena.roadDist(x, z) > 1.4 && arena.waterDist(x, z) > 0.8
    && (Math.hypot(x - castle.x, z - castle.z) < 24 || rnd() < 0.45) ? { s: range(0.8, 1.3), g: 0 } : null));
  inst(flowerGeo, flowers, [0xe8414a, 0xf5d142, 0xffffff, 0xb46ad9, 0xff8c3a, 0xff9ec7], { shadow: false });
  const reedGeo = mergeGeometries([0, 1, 2, 3].map((i) => new THREE.CylinderGeometry(0.025, 0.035, 1.1, 3).rotateZ((i - 1.5) * 0.18).translate((i - 1.5) * 0.1, 0.55, (i % 2) * 0.08).toNonIndexed()));
  const reeds = scatter(few(260), [-W / 2, W / 2, -H / 2, H / 2], (x, z) => {
    const wd = arena.waterDist(x, z);
    return wd > -0.6 && wd < 0.9 && arena.terrainAt(x, z) !== TERRAIN.BRIDGE && arena.terrainAt(x, z) !== TERRAIN.FORD && !arena.bridges.some((b) => Math.abs(z - b.z) < 3.5)
      ? { s: range(0.8, 1.3), y: Math.max(arena.heightAt(x, z), arena.waterY - 0.1) } : null;
  });
  inst(reedGeo, reeds, [0x6f8f3e, 0x7f9a46, 0x5f7f3a], { shadow: false });

  for (const node of arena.nodes) addNodeMesh(node, root, models, arena);
  return root;
}

export function addNodeMesh(node, root, models, arena = null) {
  if (node.type === 'farm') return;
  const mesh = node.type === 'tree' ? models.makeTree(node.variant) : node.type === 'rock' ? models.makeRock(node.variant)
    : node.type === 'berry' ? models.makeBerryBush(node.variant) : models.makeMine(node.rich);
  mesh.position.set(node.x, arena ? arena.groundHeight(node.x, node.z) : 0, node.z);
  mesh.rotation.y = node.variant * 1.7 + node.x;
  if (node.type === 'tree') mesh.scale.setScalar(0.85 + (node.variant % 3) * 0.12);
  mesh.userData.node = node;
  node.mesh = mesh;
  root.add(mesh);
}
