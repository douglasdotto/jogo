// Mapa da campanha em 3D: um diorama low poly do mundo do jogo, com a estrada das missões subindo até o castelo.
// Cenário estático assado numa só malha (cores por vértice); árvores e pedras instanciadas; marcos instanciados.
// Renderer próprio, desenhado só enquanto o mapa está na tela; libera tudo quando o mapa some.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP_STYLES } from './world.js';
import { makeBuilding, makeBridge, makeTree } from './kingdom-models.js';
import { CAMPAIGN_ROAD, CHAPTER_COSMETICS, campaignRoadX } from './campaign.js';

// Uma linha por capítulo, na ordem em que aparecem: paleta do mundo (world.js), quanto "morreu" e o que cresce.
// Capítulos além da tabela usam a última linha.
const THEMES = [
  { style: 'Pradaria', gloom: 0, round: 0.75, pine: 0.15, rock: 0.15, density: 0.9 },    // I: vila, rio e santuário
  { style: 'Outono', gloom: 0.05, round: 0.65, pine: 0.2, rock: 0.2, density: 0.75 },    // II: fazendas e lago
  { style: 'Pântano', gloom: 0.2, round: 0.2, pine: 0.75, rock: 0.15, density: 1.35 },   // III: bosque e ruínas
  { style: 'Crepúsculo', gloom: 0.45, round: 0.05, pine: 0.55, rock: 0.4, density: 0.75, dead: true },   // IV: torre, cemitério
  { style: 'Crepúsculo', gloom: 0.75, round: 0, pine: 0.25, rock: 0.7, density: 0.45, dead: true },      // V: além do castelo
  { style: 'Crepúsculo', gloom: 0.9, round: 0, pine: 0.15, rock: 0.85, density: 0.35, dead: true },      // VI: coração sombrio
];
const GLOOM = new THREE.Color(0x4a4058);
const CASTLE_TINT = new THREE.Color(0x3b2f52);
const SKY = [new THREE.Color(0xa9d6f0), new THREE.Color(0x6d6488)];
// Marco ao lado de cada missão conhecida; missões novas ficam só com o estandarte.
const LANDMARKS = { vila: 'village', santuario: 'shrine', chamas: 'fire', fazendas: 'farm', lago: 'lake', duelo: 'arena',
  caca: 'grove', resgate: 'cage', ruinas: 'ruins', torre: 'boneTower', 'lago-sombrio': 'darkLake', cemiterio: 'graves',
  horda: 'bonfire', castelo: 'gatehouse', cripta: 'crypt', trono: 'throne' };
const STATE_COLORS = { locked: 0x7c7f89, open: 0xf3c24f, done: 0xe9dfc6, lockedBanner: 0x5f636d, starOn: 0xffd84a, starOff: 0x3b3f4b, pole: 0x8a5a2e };

const CAMERA_DIST = 38;
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

export function mountCampaignMap3D(map, { layout, nodes: buttons, missions, states, selected = 0 }) {
  const road = layout.road, A = CAMPAIGN_ROAD.amplitude;
  const themeOf = (chapter) => THEMES[Math.min(chapter, THEMES.length - 1)];
  const styleOf = (theme) => MAP_STYLES.find((s) => s.name === theme.style) || MAP_STYLES[0];
  const chapterColor = (chapter) => CHAPTER_COSMETICS.find((c) => c.chapter === layout.regions[chapter]?.name)?.color ?? 0xf8c95b;

  // ---------- consultas no terreno ----------
  const sampleIndex = (z) => THREE.MathUtils.clamp(Math.round(-z / 0.2), 0, road.length - 1);   // amostras a cada 0,2 em z
  function roadDist(x, z) {
    const i0 = sampleIndex(z);
    let best = Infinity;
    for (let i = Math.max(0, i0 - 60); i <= Math.min(road.length - 1, i0 + 60); i += 2) {
      const d = (road[i].x - x) ** 2 + (road[i].z - z) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  // fronteira entre capítulos no meio do vão entre as missões, com um serrilhado natural
  const bounds = layout.regions.map((r, k) => (k === 0 ? -Infinity : (layout.regions[k - 1].to + r.from) / 2));
  function chapterAt(x, z) {
    const s = road[sampleIndex(z)].s + Math.sin(x * 0.7 + z * 0.3) * 1.4;
    let chapter = 0;
    for (let k = 0; k < bounds.length; k++) if (s >= bounds[k]) chapter = k;
    return chapter;
  }

  // água: o rio cruza a estrada entre as duas primeiras missões; lagos ficam ao lado das missões do lago
  const n0 = layout.nodes[0], n1 = layout.nodes[1];
  const river = n1 && n1.chapter === n0.chapter ? { z: (n0.z + n1.z) / 2, half: 1.3 } : null;
  const riverZ = (x) => river.z + Math.sin(x * 0.35) * 0.7;
  const lakes = [];
  function waterDepth(x, z) {
    let depth = 0;
    if (river) depth = Math.max(depth, 1.1 * (1 - smooth(Math.abs(z - riverZ(x)), river.half - 0.3, river.half + 1)));
    for (const l of lakes) depth = Math.max(depth, 1.1 * (1 - smooth(Math.hypot(x - l.x, z - l.z), l.r - 0.6, l.r + 0.8)));
    return depth;
  }
  function heightAt(x, z) {
    const d = roadDist(x, z);
    let h = (Math.sin(x * 0.45 + z * 0.23) * 0.35 + Math.sin(x * 0.17 - z * 0.41) * 0.3 + Math.sin(z * 0.9 + x * 0.3) * 0.12) * smooth(d, 1.6, 5);
    const edge = Math.max(0, Math.abs(x) - (A + 8));
    h += edge * edge * 0.1;
    return h - waterDepth(x, z);
  }
  // lado livre de um ponto da estrada (o mais longe das outras voltas)
  function besideRoad(n, dist) {
    const i = sampleIndex(n.z), a = road[Math.max(0, i - 2)], b = road[Math.min(road.length - 1, i + 2)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
    const p1 = { x: n.x + nx * dist, z: n.z + nz * dist }, p2 = { x: n.x - nx * dist, z: n.z - nz * dist };
    const score = (p) => roadDist(p.x, p.z) - Math.max(0, Math.abs(p.x) - (A + 6));
    return score(p1) >= score(p2) ? p1 : p2;
  }

  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const color = new THREE.Color();

  // ---------- peças simples (só existem até serem assadas na malha estática) ----------
  const tmpGeos = new Map();
  const unit = (kind) => {
    if (!tmpGeos.has(kind)) tmpGeos.set(kind, {
      box: () => new THREE.BoxGeometry(1, 1, 1), cyl: () => new THREE.CylinderGeometry(1, 1, 1, 8), hex: () => new THREE.CylinderGeometry(1, 1, 1, 6),
      cone: () => new THREE.ConeGeometry(1, 1, 7), crystal: () => new THREE.ConeGeometry(1, 1, 4), ico: () => new THREE.IcosahedronGeometry(1, 0),
      dodeca: () => new THREE.DodecahedronGeometry(1, 0),
    }[kind]());
    return tmpGeos.get(kind);
  };
  const tmpMats = new Map();
  const solid = (hex) => tmpMats.get(hex) || tmpMats.set(hex, new THREE.MeshLambertMaterial({ color: hex })).get(hex);
  function P(g, kind, hex, [x, y, z], [sx, sy, sz], [rx, ry, rz] = [0, 0, 0]) {
    const m = new THREE.Mesh(unit(kind), solid(hex));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  }
  const bone = 0xefe6d2, stone = 0xcfc6b4, darkStone = 0x5a5266, wood = 0x8a5a2e, flameA = 0xff8a2a, flameB = 0xffd04a;
  function flames(g, x, z, s = 1) {
    P(g, 'cone', flameA, [x, 0.45 * s, z], [0.35 * s, 0.9 * s, 0.35 * s]);
    P(g, 'cone', flameB, [x + 0.08, 0.4 * s, z + 0.1], [0.2 * s, 0.65 * s, 0.2 * s]);
  }
  function addKingdom(g, type, x, z, s, ry = 0) {
    const b = type === 'tree' ? makeTree(2) : makeBuilding(type);
    b.position.set(x, 0, z); b.scale.setScalar(s); b.rotation.y = ry;
    g.add(b);
  }
  const extraTrees = [];
  const BUILD = {
    village(g) {
      addKingdom(g, 'house', -1.3, 0.5, 0.42, 0.4);
      addKingdom(g, 'house', 1.5, -0.6, 0.38, -0.5);
      addKingdom(g, 'house', 0.1, -2, 0.36, 0.1);
      P(g, 'hex', stone, [0.3, 0.25, 1.2], [0.4, 0.5, 0.4]);
      P(g, 'hex', 0x3e6f9a, [0.3, 0.52, 1.2], [0.3, 0.05, 0.3]);
    },
    shrine(g) {
      P(g, 'hex', stone, [0, 0.18, 0], [1, 0.36, 1]);
      P(g, 'hex', 0xe9e1cf, [0, 0.45, 0], [0.7, 0.2, 0.7]);
      P(g, 'crystal', 0x7fe3ff, [0, 1.35, 0], [0.38, 1.6, 0.38]);
      P(g, 'crystal', 0xc9f6ff, [0, 1.35, 0], [0.22, 1.3, 0.22], [0, 0.8, 0]);
    },
    fire(g) {
      for (let k = 0; k < 3; k++) P(g, 'box', 0x3a2a22, [-0.8 + k * 0.8, 0.5, (k % 2) * 0.5], [0.18, 1, 0.18], [0, 0, (k - 1) * 0.3]);
      flames(g, -0.5, 0.2, 1.2); flames(g, 0.5, -0.2, 0.9); flames(g, 0.1, 0.7, 0.7);
    },
    farm(g) {
      addKingdom(g, 'farm', -0.9, 0, 0.6, 0.2);
      addKingdom(g, 'farm', 1.4, 0.8, 0.5, -0.1);
      P(g, 'ico', 0xe2c04a, [1.2, 0.45, -1.4], [0.6, 0.55, 0.6]);
    },
    lake(g, at) { lakes.push({ x: at.x, z: at.z, r: 2.4, color: 0x5fb3e0 }); reeds(g); },
    darkLake(g, at) {
      lakes.push({ x: at.x, z: at.z, r: 2.4, color: 0x3e3a5c });
      for (const [x, z] of [[2.4, 0.8], [-2.2, -1.2]]) P(g, 'cyl', 0x4b3d3a, [x, 0.3, z], [0.18, 0.6, 0.18]);
    },
    arena(g) {
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * Math.PI * 2;
        P(g, 'dodeca', 0x9a958c, [Math.cos(a) * 1.7, 0.2, Math.sin(a) * 1.7], [0.32, 0.35, 0.32], [0, k, 0]);
      }
      P(g, 'box', 0xd8dce2, [0, 0.9, 0], [0.1, 1.6, 0.05], [0, 0, 0.6]);
      P(g, 'box', 0xd8dce2, [0, 0.9, 0], [0.1, 1.6, 0.05], [0, 0, -0.6]);
    },
    grove(g, at) { for (let k = 0; k < 7; k++) { const a = k * 2.4; extraTrees.push({ x: at.x + Math.cos(a) * (1 + k * 0.3), z: at.z + Math.sin(a) * (1 + k * 0.3) }); } },
    cage(g) {
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6], [0, -0.6], [0, 0.6]]) P(g, 'box', wood, [x, 0.6, z], [0.1, 1.2, 0.1]);
      P(g, 'box', wood, [0, 1.25, 0], [1.4, 0.12, 1.4]);
      P(g, 'ico', 0xf2c9a0, [0, 0.45, 0], [0.25, 0.3, 0.25]);
    },
    ruins(g) {
      [[-1.2, -0.6, 2], [-0.2, -1, 1.2], [0.9, -0.5, 1.7], [1.3, 0.7, 0.8]].forEach(([x, z, h]) => P(g, 'cyl', stone, [x, h / 2, z], [0.28, h, 0.28]));
      P(g, 'box', stone, [-0.7, 2.1, -0.8], [1.6, 0.3, 0.45], [0, 0.4, 0]);
      P(g, 'cyl', stone, [0, 0.25, 1], [0.25, 1.6, 0.25], [0, 0, Math.PI / 2]);
    },
    boneTower(g) {
      P(g, 'hex', darkStone, [0, 0.3, 0], [1.2, 0.6, 1.2]);
      P(g, 'cyl', bone, [0, 1.8, 0], [0.75, 2.6, 0.75]);
      P(g, 'cyl', bone, [0, 3.5, 0], [0.5, 1, 0.5]);
      P(g, 'ico', 0xb36bff, [0, 4.3, 0], [0.45, 0.5, 0.45]);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; P(g, 'cone', bone, [Math.cos(a) * 0.9, 1.2, Math.sin(a) * 0.9], [0.15, 1, 0.15], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]); }
    },
    graves(g) {
      for (let k = 0; k < 6; k++) P(g, 'box', 0x8e8a99, [-1.5 + (k % 3) * 1.4, 0.35, -0.6 + Math.floor(k / 3) * 1.3], [0.45, 0.7, 0.15], [0, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.3]);
      P(g, 'box', 0x8e8a99, [1.6, 0.6, 1.4], [0.12, 1.2, 0.12]);
      P(g, 'box', 0x8e8a99, [1.6, 0.85, 1.4], [0.6, 0.12, 0.12]);
    },
    bonfire(g) {
      P(g, 'box', 0x4a3328, [0, 0.12, 0], [1.4, 0.2, 0.25], [0, 0.5, 0]);
      P(g, 'box', 0x4a3328, [0, 0.12, 0], [1.4, 0.2, 0.25], [0, -0.6, 0]);
      flames(g, 0, 0, 1.4);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P(g, 'cone', bone, [Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6], [0.14, 1, 0.14]); }
    },
    gatehouse(g) {
      for (const x of [-1.4, 1.4]) {
        P(g, 'cyl', darkStone, [x, 1.4, 0], [0.7, 2.8, 0.7]);
        P(g, 'cone', 0x6b4f8f, [x, 3.3, 0], [0.85, 1.1, 0.85]);
      }
      P(g, 'box', darkStone, [0, 2.3, 0], [2.2, 0.8, 0.8]);
    },
    crypt(g) {
      P(g, 'box', darkStone, [0, 0.7, 0], [2.2, 1.4, 1.6]);
      P(g, 'roof', 0x3f3848, [0, 1.4, 0], [2.4, 0.8, 1.8]);
      P(g, 'box', 0x1c1824, [0, 0.55, 0.81], [0.7, 1, 0.05]);
    },
    throne(g) {
      P(g, 'box', darkStone, [0, 0.2, 0], [1.6, 0.4, 1.4]);
      P(g, 'box', bone, [0, 0.7, 0.1], [0.9, 0.6, 0.8]);
      P(g, 'box', bone, [0, 1.6, -0.3], [0.9, 1.8, 0.2]);
      for (const x of [-0.45, 0, 0.45]) P(g, 'cone', bone, [x, 2.75, -0.3], [0.12, 0.6, 0.12]);
    },
  };
  // 'roof' (prisma) só existe no kingdom-models; aqui uma pirâmide de 4 lados serve
  tmpGeos.set('roof', new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0));
  function reeds(g) { for (let k = 0; k < 7; k++) { const a = k * 0.9 + 0.3; P(g, 'cone', 0x6f8f3e, [Math.cos(a) * 2.7, 0.35, Math.sin(a) * 2.7], [0.08, 0.7, 0.08]); } }

  // ---------- cenário estático ----------
  const statics = new THREE.Group();
  const exclusions = layout.nodes.map((n) => ({ x: n.x, z: n.z, r: 2.2 }));
  missions.forEach((m, i) => {
    const kind = LANDMARKS[m.id];
    if (!kind) return;
    const at = besideRoad(layout.nodes[i], kind === 'lake' || kind === 'darkLake' ? 4.6 : 3.6);
    const g = new THREE.Group();
    g.position.set(at.x, 0, at.z);
    g.rotation.y = Math.atan2(layout.nodes[i].x - at.x, layout.nodes[i].z - at.z);   // de frente para a estrada
    BUILD[kind](g, at);
    statics.add(g);
    exclusions.push({ x: at.x, z: at.z, r: kind === 'grove' ? 0.6 : 2.6 });
  });
  // o castelo do necromante fecha a estrada, no topo
  const end = road.at(-1), before = road[Math.max(0, road.length - 15)];
  const dirLen = Math.hypot(end.x - before.x, end.z - before.z) || 1, dx = (end.x - before.x) / dirLen, dz = (end.z - before.z) / dirLen;
  const castleAt = { x: end.x + dx * 4.5, z: end.z + dz * 4.5 };
  const castle = makeBuilding('castle');
  castle.position.set(castleAt.x, 0, castleAt.z);
  castle.rotation.y = Math.atan2(-dx, -dz);   // portão virado para a estrada
  castle.scale.setScalar(1.45);
  statics.add(castle);
  exclusions.push({ x: castleAt.x, z: castleAt.z, r: 8 });
  for (const x of [-1, 1]) P(statics, 'cone', 0x6b4f8f, [castleAt.x + x * 7.5, 2.5, castleAt.z - 4.5], [0.6, 5, 0.6]);
  if (river) {
    const i = sampleIndex(river.z), a = road[i - 3], b = road[i + 3];
    const bridge = makeBridge(2 * river.half + 2.6, 1.9);
    bridge.position.set(campaignRoadX(river.z), 0.05, river.z);
    bridge.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    bridge.scale.setScalar(0.85);
    statics.add(bridge);
  }

  // terreno: grade de triângulos com cor chapada por face, altura suave e morros nas bordas
  const W = A + 18, zBottom = 14, zTop = end.z - 18, cell = 1.4;
  const terrain = [], terrainColors = [];
  const cols = Math.ceil((2 * W) / cell), rows = Math.ceil((zBottom - zTop) / cell);
  const heights = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const jitter = (r % 2) * cell * 0.5;
    const x = -W + c * cell + (c > 0 && c < cols ? jitter : 0), z = zBottom - r * cell;
    heights.push([x, heightAt(x, z), z]);
  }
  const vert = (r, c) => heights[r * (cols + 1) + c];
  const faceColor = (cx, cz, cy) => {
    const theme = themeOf(chapterAt(cx, cz)), style = styleOf(theme);
    const wet = cy < -0.15;
    const patch = Math.sin(cx * 0.31 + cz * 0.17) + Math.sin(cz * 0.23 - cx * 0.11) > 0.4 ? 1 : 0;   // manchas, não xadrez
    color.setHex(wet ? style.bed : style.grass[patch]);
    if (!wet && cy > 1.2) color.setHex(style.cliffs[patch]);   // morros da borda
    return color.lerp(GLOOM, theme.gloom).multiplyScalar(0.97 + rand() * 0.05);
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = vert(r, c), b = vert(r, c + 1), d = vert(r + 1, c), e = vert(r + 1, c + 1);
    for (const tri of [[a, d, b], [b, d, e]]) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3, cz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
      const col = faceColor(cx, cz, cy);
      for (const p of tri) { terrain.push(...p); terrainColors.push(col.r, col.g, col.b); }
    }
  }
  // estrada: duas fitas (borda e miolo) na cor de areia do bioma; some sob a ponte
  const ribbon = (width, y, shade) => {
    const pos = [], cols3 = [];
    for (let i = 0; i + 3 < road.length; i += 3) {
      const p = road[i], q = road[i + 3];
      if (river && Math.abs(((p.z + q.z) / 2) - river.z) < river.half + 1.2) continue;
      const len = Math.hypot(q.x - p.x, q.z - p.z) || 1, nx = -(q.z - p.z) / len * width, nz = (q.x - p.x) / len * width;
      const theme = themeOf(chapterAt(p.x, p.z)), style = styleOf(theme);
      color.setHex(style.sand[shade]).lerp(GLOOM, theme.gloom * 0.8);
      const quad = [[p.x + nx, y, p.z + nz], [p.x - nx, y, p.z - nz], [q.x + nx, y, q.z + nz], [p.x - nx, y, p.z - nz], [q.x - nx, y, q.z - nz], [q.x + nx, y, q.z + nz]];
      for (const v of quad) { pos.push(...v); cols3.push(color.r, color.g, color.b); }
    }
    return [pos, cols3];
  };
  const roadParts = [ribbon(1.15, 0.04, 1), ribbon(0.85, 0.07, 0)];

  // assa terreno, estrada e todas as peças numa malha só, com a cor de cada material virando cor de vértice
  const baked = [];
  const pushRaw = (pos, cols3) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols3, 3));
    baked.push(g);
  };
  pushRaw(terrain, terrainColors);
  for (const [pos, cols3] of roadParts) pushRaw(pos, cols3);
  statics.updateMatrixWorld(true);
  const castleParts = new Set();
  castle.traverse((o) => castleParts.add(o));
  statics.traverse((o) => {
    if (!o.isMesh || o.material?.transparent) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.morphAttributes = {};
    g.applyMatrix4(o.matrixWorld);
    // peças dos capítulos sombrios perdem cor como o mundo do jogo
    const theme = themeOf(chapterAt(o.matrixWorld.elements[12], o.matrixWorld.elements[14]));
    color.copy(o.material.color);
    if (castleParts.has(o)) color.lerp(CASTLE_TINT, 0.8);
    else color.lerp(GLOOM, theme.gloom * 0.5);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) arr.set([color.r, color.g, color.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    baked.push(g);
  });
  const staticGeo = mergeGeometries(baked);
  baked.forEach((g) => g.dispose());
  staticGeo.computeVertexNormals();
  for (const g of tmpGeos.values()) g.dispose();
  for (const m of tmpMats.values()) m.dispose();
  const own = { geos: [staticGeo], mats: [], instanced: [] };
  const staticMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  own.mats.push(staticMat);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(staticGeo, staticMat));

  // água: rio e lagos numa malha translúcida
  {
    const pos = [], cols3 = [];
    const quadStrip = (pts, hex) => { color.setHex(hex); for (const p of pts) { pos.push(...p); cols3.push(color.r, color.g, color.b); } };
    if (river) {
      const style = styleOf(themeOf(0));
      for (let x = -W; x < W; x += 1) {
        const z0 = riverZ(x), z1 = riverZ(x + 1), h = river.half + 0.9, y = -0.22;
        quadStrip([[x, y, z0 - h], [x, y, z0 + h], [x + 1, y, z1 - h], [x, y, z0 + h], [x + 1, y, z1 + h], [x + 1, y, z1 - h]], style.river);
      }
    }
    for (const l of lakes) for (let k = 0; k < 12; k++) {
      const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2, r = l.r + 0.7;
      quadStrip([[l.x, -0.22, l.z], [l.x + Math.cos(a0) * r, -0.22, l.z + Math.sin(a0) * r], [l.x + Math.cos(a1) * r, -0.22, l.z + Math.sin(a1) * r]], l.color);
    }
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols3, 3));
      g.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      own.geos.push(g); own.mats.push(mat);
      scene.add(new THREE.Mesh(g, mat));
    }
  }

  // ---------- natureza instanciada: árvores do Reino (pinheiro e copa redonda) e pedras ----------
  const plants = { pine: [], round: [], rock: [] };
  const free = (x, z, r = 0) => exclusions.every((e) => Math.hypot(x - e.x, z - e.z) > e.r + r);
  for (let k = 0; k < 1500; k++) {
    const x = -W + 1 + rand() * (2 * W - 2), z = zTop + 4 + rand() * (zBottom - zTop - 6);
    const theme = themeOf(chapterAt(x, z));
    const hills = Math.abs(x) > A + 7 ? 1.6 : 1;
    if (rand() > theme.density * 0.32 * hills) continue;
    if (roadDist(x, z) < 2.3 || !free(x, z, 0.8) || waterDepth(x, z) > 0.02) continue;
    const roll = rand();
    const kind = roll < theme.round ? 'round' : roll < theme.round + theme.pine ? 'pine' : rand() < theme.rock ? 'rock' : null;
    if (kind) plants[kind].push({ x, z, theme });
  }
  for (const t of extraTrees) if (roadDist(t.x, t.z) > 1.8) plants.pine.push({ ...t, theme: themeOf(chapterAt(t.x, t.z)) });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  function instancedFrom(template, items, tint) {
    template.updateMatrixWorld(true);
    template.traverse((o) => {
      if (!o.isMesh || !items.length) return;
      const mat = new THREE.MeshLambertMaterial({ flatShading: true });
      const im = new THREE.InstancedMesh(o.geometry, mat, items.length);   // geometria compartilhada do Reino: não é liberada aqui
      items.forEach((it, k) => {
        q.setFromAxisAngle(up, it.ry ?? (it.ry = rand() * Math.PI * 2));
        it.s ??= 0.42 + rand() * 0.25;
        m4.compose(v3.set(it.x, heightAt(it.x, it.z) - 0.05, it.z), q, s3.setScalar(it.s)).multiply(o.matrixWorld);
        im.setMatrixAt(k, m4);
        im.setColorAt(k, tint(o, it, k));
      });
      im.computeBoundingSphere();
      own.mats.push(mat); own.instanced.push(im);
      scene.add(im);
    });
  }
  const trunk = (it) => color.setHex(it.theme.dead ? 0x4f4450 : STATE_COLORS.pole);
  const canopy = (it, list, k) => {
    const style = styleOf(it.theme);
    color.setHex(list[Math.abs(k * 7 + Math.floor(it.x * 3)) % list.length]);
    return it.theme.dead ? color.lerp(GLOOM, 0.65) : color.lerp(GLOOM, it.theme.gloom * 0.6);
  };
  const isTrunk = (o) => o.material.color.getHex() === STATE_COLORS.pole;
  instancedFrom(makeTree(0), plants.pine, (o, it, k) => (isTrunk(o) ? trunk(it) : canopy(it, styleOf(it.theme).pine, k)));
  instancedFrom(makeTree(2), plants.round, (o, it, k) => (isTrunk(o) ? trunk(it) : canopy(it, styleOf(it.theme).canopy, k)));
  {
    const rock = new THREE.Group();
    const geo = new THREE.DodecahedronGeometry(0.7, 0);
    own.geos.push(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }));
    mesh.scale.set(1, 0.6, 1); mesh.position.y = 0.25;
    rock.add(mesh);
    plants.rock.forEach((it) => (it.s = 0.5 + rand() * 0.7));
    instancedFrom(rock, plants.rock, (o, it) => color.setHex(styleOf(it.theme).cliffs[1]).lerp(GLOOM, it.theme.gloom * 0.7));
    mesh.material.dispose();
  }

  // ---------- marcos das missões: pedestal, mastro, estandarte e estrelas ----------
  const N = layout.nodes.length;
  const pedestalGeo = new THREE.CylinderGeometry(0.8, 0.95, 0.4, 6).translate(0, 0.2, 0);
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.3, 5).translate(0, 1.55, 0);
  const bannerGeo = new THREE.BoxGeometry(0.9, 0.6, 0.06).translate(0.48, 0, 0);
  const starShape = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 0.11 : 0.26, a = Math.PI / 2 + k * Math.PI / 5;
    k ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.07, bevelEnabled: false }).translate(0, 0, -0.035);
  const ringGeo = new THREE.RingGeometry(1.05, 1.32, 6).rotateX(-Math.PI / 2);
  own.geos.push(pedestalGeo, poleGeo, bannerGeo, starGeo, ringGeo);
  const markMat = () => { const m = new THREE.MeshLambertMaterial({ flatShading: true }); own.mats.push(m); return m; };
  const pedestals = new THREE.InstancedMesh(pedestalGeo, markMat(), N);
  const poles = new THREE.InstancedMesh(poleGeo, markMat(), N);
  const banners = new THREE.InstancedMesh(bannerGeo, markMat(), N);
  const stars = new THREE.InstancedMesh(starGeo, markMat(), N * 3);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false });
  own.mats.push(ringMat);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  for (const im of [pedestals, poles, banners, stars]) { im.frustumCulled = false; own.instanced.push(im); scene.add(im); }
  scene.add(ring);
  const kindOf = (st) => (!st.open ? 'locked' : st.stars > 0 ? 'done' : 'open');
  layout.nodes.forEach((n, i) => {
    const st = states[i], kind = kindOf(st);
    n.y = Math.max(0, heightAt(n.x, n.z));
    pedestals.setColorAt(i, color.setHex(STATE_COLORS[kind]));
    poles.setColorAt(i, color.setHex(kind === 'locked' ? STATE_COLORS.locked : STATE_COLORS.pole));
    banners.setColorAt(i, color.setHex(kind === 'locked' ? STATE_COLORS.lockedBanner : chapterColor(n.chapter)));
    for (let k = 0; k < 3; k++) stars.setColorAt(i * 3 + k, color.setHex(k < st.stars ? STATE_COLORS.starOn : STATE_COLORS.starOff));
  });
  let sel = selected, hover = -1;
  const e = new THREE.Euler();
  function placeMarkers(t) {
    layout.nodes.forEach((n, i) => {
      const kind = kindOf(states[i]);
      const pulse = kind === 'open' && !still ? Math.sin(t * 4 + i) * 0.07 : 0;
      const grow = (i === hover ? 1.18 : i === sel ? 1.1 : 1) + pulse;
      m4.compose(v3.set(n.x, n.y, n.z), q.identity(), s3.setScalar(grow));
      pedestals.setMatrixAt(i, m4);
      poles.setMatrixAt(i, m4);
      const lift = kind === 'locked' ? 1.35 : 2.25 + (kind === 'open' && !still ? Math.sin(t * 4 + i) * 0.08 : 0);
      e.set(0, -0.35 + (still ? 0 : Math.sin(t * 2.2 + i) * 0.18), kind === 'locked' ? -0.5 : 0);
      m4.compose(v3.set(n.x, n.y + lift * grow, n.z), q.setFromEuler(e), s3.setScalar(grow));
      banners.setMatrixAt(i, m4);
      for (let k = 0; k < 3; k++) {
        const show = kind === 'done' ? grow : 0;
        e.set(-0.55, 0, (1 - k) * 0.25);
        m4.compose(v3.set(n.x + (k - 1) * 0.5 * grow, n.y + (3.15 + (k === 1 ? 0.12 : 0)) * grow, n.z), q.setFromEuler(e), s3.setScalar(show));
        stars.setMatrixAt(i * 3 + k, m4);
      }
    });
    for (const im of [pedestals, poles, banners, stars]) im.instanceMatrix.needsUpdate = true;
    const at = layout.nodes[sel];
    if (at) {
      ring.position.set(at.x, at.y + 0.06, at.z);
      ring.rotation.y = still ? 0 : t * 0.6;
      ring.scale.setScalar(1.15 + (still ? 0 : Math.sin(t * 3) * 0.06));
    }
  }

  // ---------- câmera, luz e renderer ----------
  const still = matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const canvas = renderer.domElement;
  canvas.className = 'camp-map3d';
  canvas.setAttribute('aria-hidden', 'true');
  map.prepend(canvas);
  map.classList.add('is-3d');
  scene.background = SKY[0].clone();
  scene.fog = new THREE.Fog(SKY[0].clone(), 50, 105);
  scene.add(new THREE.HemisphereLight(0xfff4dc, 0xa89868, 1.8));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
  sun.position.set(-10, 25, 12);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 160);
  const focusOf = (i) => ({ x: THREE.MathUtils.clamp(layout.nodes[i].x * 0.6, -A, A), z: layout.nodes[i].z - 1.5 });
  const limits = { minZ: castleAt.z - 1, maxZ: n0.z - 1 };
  const view = { ...focusOf(Math.min(sel, N - 1)), zoom: 1 };
  const goal = { ...view };
  function clampGoal() {
    goal.x = THREE.MathUtils.clamp(goal.x, -A - 2, A + 2);
    goal.z = THREE.MathUtils.clamp(goal.z, limits.minZ, limits.maxZ);
    goal.zoom = THREE.MathUtils.clamp(goal.zoom, 0.6, 1.35);
  }
  clampGoal();
  Object.assign(view, goal);
  let dirty = true;
  function placeCamera() {
    const d = CAMERA_DIST * view.zoom;
    camera.position.set(view.x, d * 0.78, view.z + d * 0.62);
    camera.lookAt(view.x, 0, view.z);
    const gloom = themeOf(chapterAt(view.x, view.z)).gloom;
    scene.background.lerpColors(SKY[0], SKY[1], gloom);
    scene.fog.color.copy(scene.background);
  }
  function resize() {
    const w = Math.max(1, map.clientWidth), h = Math.max(1, map.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  ro?.observe(map);
  resize();

  // botões das missões (foco, teclado, dica e clique) acompanham o marco projetado na tela
  const proj = new THREE.Vector3();
  function placeButtons() {
    layout.nodes.forEach((n, i) => {
      const b = buttons[i];
      if (!b) return;
      proj.set(n.x, n.y + 1.5, n.z).project(camera);
      b.style.left = `${((proj.x + 1) * 50).toFixed(2)}%`;
      b.style.top = `${((1 - proj.y) * 50).toFixed(2)}%`;
    });
  }
  const offHover = [];
  buttons.forEach((b, i) => {
    const enter = () => (hover = i), leave = () => { if (hover === i) hover = -1; };
    b.addEventListener('pointerenter', enter);
    b.addEventListener('pointerleave', leave);
    offHover.push(() => { b.removeEventListener('pointerenter', enter); b.removeEventListener('pointerleave', leave); });
  });

  // arrastar move a câmera; a roda aproxima (com limites); um arrasto não vira clique
  let drag = null, dragged = false;
  const onDown = (ev) => {
    if (ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY, gx: goal.x, gz: goal.z, id: ev.pointerId, moving: false };
    dragged = false;
  };
  const onMove = (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moving && Math.hypot(dx, dy) < 6) return;
    if (!drag.moving) { drag.moving = true; map.setPointerCapture?.(drag.id); map.classList.add('dragging'); }
    const perPx = (2 * CAMERA_DIST * view.zoom * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.max(1, map.clientHeight);
    goal.x = drag.gx - dx * perPx;
    goal.z = drag.gz - dy * perPx * 1.3;
    clampGoal();
  };
  const onUp = () => {
    if (drag?.moving) dragged = true;
    if (drag?.moving) map.releasePointerCapture?.(drag.id);
    drag = null;
    map.classList.remove('dragging');
  };
  const onClick = (ev) => { if (dragged) { ev.stopPropagation(); ev.preventDefault(); dragged = false; } };
  const onWheel = (ev) => { ev.preventDefault(); goal.zoom *= Math.exp(ev.deltaY * 0.0012); clampGoal(); };
  map.addEventListener('pointerdown', onDown);
  map.addEventListener('pointermove', onMove);
  map.addEventListener('pointerup', onUp);
  map.addEventListener('pointercancel', onUp);
  map.addEventListener('click', onClick, true);
  map.addEventListener('wheel', onWheel, { passive: false });

  // ---------- laço: desenha só enquanto o mapa está visível; fora da tela, libera tudo ----------
  let raf = 0, last = performance.now(), disposed = false;
  function frame(now) {
    if (disposed) return;
    if (!map.isConnected || map.closest('.hidden')) { dispose(); return; }
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = still ? 1 : 1 - Math.exp(-dt * 7);
    for (const key of ['x', 'z', 'zoom']) {
      const delta = goal[key] - view[key];
      if (Math.abs(delta) > 1e-4) { view[key] += delta * k; dirty = true; } else view[key] = goal[key];
    }
    if (dirty) { placeCamera(); placeButtons(); dirty = false; }
    placeMarkers(now / 1000);
    renderer.render(scene, camera);
  }
  placeCamera();
  placeButtons();
  raf = requestAnimationFrame(frame);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    offHover.forEach((off) => off());
    map.removeEventListener('pointerdown', onDown);
    map.removeEventListener('pointermove', onMove);
    map.removeEventListener('pointerup', onUp);
    map.removeEventListener('pointercancel', onUp);
    map.removeEventListener('click', onClick, true);
    map.removeEventListener('wheel', onWheel);
    own.instanced.forEach((im) => im.dispose());
    own.geos.forEach((g) => g.dispose());
    own.mats.forEach((m) => m.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    map.classList.remove('is-3d', 'dragging');
  }

  return {
    select(i) {
      if (i < 0 || i >= N) return;
      sel = i;
      Object.assign(goal, focusOf(i));
      clampGoal();
    },
    dispose,
  };
}
