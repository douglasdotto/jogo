// Cenário low poly: estrada sinuosa, rio com ponte, vila, natureza e castelo no topo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { recolor } from './characters.js';
import { bandsByZ } from './scene-perf.js';

// muitas peças já vêm sem índice; o three avisa a cada "desindexação" repetida. Mesma saída (uma cópia), sem o aviso
const toNonIndexed = THREE.BufferGeometry.prototype.toNonIndexed;
THREE.BufferGeometry.prototype.toNonIndexed = function () { return this.index ? toNonIndexed.call(this) : this.clone(); };

// pontos (x, z) por onde a estrada passa, de baixo (z positivo) para cima
const ROUTE = [[0, 14], [2, 0], [8, -18], [4, -38], [-7, -56], [-10, -76], [-3, -96], [8, -114], [10, -134], [2, -152], [-8, -170], [-7, -190], [1, -208], [6, -228], [2, -246], [0, -264]];
const MAP_STYLES = [
  { name: 'Pradaria', grass: [0x76cc32, 0x5db426], sand: [0xf0b860, 0xe0a24c], cliffs: [0xdba468, 0xc98d55], bed: 0xc9a46a, dry: 0xa39a5c, gloom: 0x5e536e,
    river: 0x5fb3e0, deep: 0x2a7fa6, shallow: 0x8fdde6, murky: 0x3e5a5a, pondLeaf: 0x6fae46, reeds: 0x6f8f3e,
    canopy: [0x4fb82a, 0x3fa424, 0x62c834, 0x37941e, 0x58bf2c], pine: [0x6aa83f, 0x5e9e3c, 0x77b347], tuft: [0x82d63e, 0x6cc432, 0x94e04a, 0x5cb22a], modelHue: 38 },
  { name: 'Outono', grass: [0xa5bd55, 0x829643], sand: [0xe6b96b, 0xd39b50], cliffs: [0xc99a69, 0xa97951], bed: 0xb99a6b, dry: 0xa59859, gloom: 0x6f5668,
    river: 0x68afd0, deep: 0x2e718e, shallow: 0x98d4d6, murky: 0x566263, pondLeaf: 0x8b9c46, reeds: 0x8a8845,
    canopy: [0x9e982f, 0xbb7c2c, 0xcc5b35, 0xc58a39, 0x7c9140], pine: [0x667f35, 0x738c3a, 0x849343], tuft: [0xa8b947, 0x8fa73e, 0xc6b44a, 0x819d3c], modelHue: 24 },
  { name: 'Pântano', grass: [0x6aa974, 0x4e806a], sand: [0xc8ae79, 0xa48d67], cliffs: [0xa79b83, 0x837d70], bed: 0x698f86, dry: 0x8e8d65, gloom: 0x4f5660,
    river: 0x4e9ca0, deep: 0x285f65, shallow: 0x74b9aa, murky: 0x384d4e, pondLeaf: 0x567d68, reeds: 0x71804d,
    canopy: [0x3f7858, 0x4b8a5e, 0x68945b, 0x567d68, 0x71834f], pine: [0x3f6959, 0x517b62, 0x617e5d], tuft: [0x79a34c, 0x648a49, 0x93aa5a, 0x5e8551], modelHue: 76 },
  { name: 'Crepúsculo', grass: [0x738da8, 0x556f90], sand: [0xd1ad88, 0xb58d79], cliffs: [0x978a9e, 0x746d88], bed: 0x677e9c, dry: 0x888b83, gloom: 0x50415f,
    river: 0x609cc8, deep: 0x365f9a, shallow: 0x9ec4e8, murky: 0x494c68, pondLeaf: 0x5f7f8a, reeds: 0x758c91,
    canopy: [0x4e708e, 0x5a789d, 0x7c78a5, 0x586f8a, 0x6c8ca2], pine: [0x435b7a, 0x4e6888, 0x5c7691], tuft: [0x82a6a9, 0x70958e, 0x93aaa2, 0x6c8789], modelHue: 205 },
];

function mapStyleForSeed(seedValue = 11) {
  return MAP_STYLES[seedValue === 11 ? 0 : Math.abs(Math.trunc(seedValue)) % MAP_STYLES.length];
}
export function biomeForSeed(seedValue = 11) { return mapStyleForSeed(seedValue).name; }

export function createWorld(parentScene, ROAD, PHASES, seedValue = 11) {
  const scene = new THREE.Group();
  parentScene.add(scene);
  let disposed = false, modelScenes = [];
  let seed = seedValue;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // reprodutível para cada semente
  const range = (a, b) => a + (b - a) * rand();
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const biome = mapStyleForSeed(seedValue);
  const terrainWarp = [rand() * 100, rand() * 100];

  function releaseTrees(roots) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    for (const root of roots) root?.traverse?.((obj) => {
      if (obj.geometry) geometries.add(obj.geometry);
      for (const material of (Array.isArray(obj.material) ? obj.material : [obj.material])) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    parentScene.remove(scene);
    releaseTrees([scene, ...modelScenes]);
    modelScenes = [];
  }

  // ---------- estrada ----------
  // Cada missão sorteia uma estrada própria; as pontas ficam fixas para preservar entrada e castelo.
  const route = ROUTE.map(([x, z], i) => {
    const end = i === 0 || i === ROUTE.length - 1;
    return [x + (end ? 0 : range(-2.6, 2.6)), z + (end ? 0 : range(-1.4, 1.4))];
  });
  const curve = new THREE.CatmullRomCurve3(route.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const L = curve.getLength();
  const clampU = (s) => THREE.MathUtils.clamp(s / L, 0, 1);
  const pointAt = (s) => curve.getPointAt(clampU(s));
  const tangentAt = (s) => curve.getTangentAt(clampU(s));
  const sideOf = (t) => new THREE.Vector3(-t.z, 0, t.x);   // lado direito de quem anda para a frente
  const along = (s, lateral) => pointAt(s).addScaledVector(sideOf(tangentAt(s)), lateral);
  const firstS = 12, lastS = L - 30;
  const anchorS = (p) => firstS + ((p - 1) * (lastS - firstS)) / (PHASES - 1);
  const roadPts = curve.getSpacedPoints(600);
  // "trevas" (0 a 1): o mundo vai morrendo conforme o caminho sobe para o castelo do necromante
  const zStart = pointAt(anchorS(3)).z, zEnd = pointAt(L - 10).z;
  const gloomAt = (z) => THREE.MathUtils.smoothstep((zStart - z) / (zStart - zEnd), 0, 0.85);


  // ---------- desafios por fase ----------
  const zones = new Map();
  for (const phase of [3, 5, 7, 9, 10]) {
    const type = phase === 5 || phase === 9 ? 'lake' : 'plateau';
    const fwd = tangentAt(anchorS(phase)), side = sideOf(fwd);
    const center = along(anchorS(phase) - 1, type === 'lake' ? -7 : 6.5);
    const zone = { type, center, fwd, side, radius: type === 'lake' ? 5.8 : 4,
      ground: [-2, 0, 2].map((off) => along(anchorS(phase) + 7, off)) };
    if (type === 'plateau') {
      zone.ramp = { bottom: center.clone().addScaledVector(fwd, -9), top: center.clone().addScaledVector(fwd, -3).setY(3) };
      zone.top = [-1.2, 1.2].map((off) => center.clone().addScaledVector(side, off).setY(3));
    } else zone.water = [-1, 0, 1].map((a) => center.clone().addScaledVector(side, 4.8 * Math.cos(a)).addScaledVector(fwd, 4.8 * Math.sin(a)));
    zones.set(phase, zone);
  }
  const zoneOf = (phase) => zones.get(phase) || null;
  const local = (zone, p) => {
    const dx = p.x - zone.center.x, dz = p.z - zone.center.z;
    return { x: dx * zone.side.x + dz * zone.side.z, z: dx * zone.fwd.x + dz * zone.fwd.z };
  };
  const inRamp = (p) => Math.abs(p.x) <= 1.5 && p.z >= -9 && p.z <= -3;
  // fundo do lago: margem irregular, rasa na borda e funda no meio
  const shore = (zone, x, z) => {
    const a = Math.atan2(z - zone.center.z, x - zone.center.x);
    return Math.sin(a * 3 + zone.center.x) * 0.55 + Math.sin(a * 5 - zone.center.z) * 0.3;
  };
  const lakeDepth = (zone, x, z) => {
    const radius = Math.hypot(x - zone.center.x, z - zone.center.z);
    const d = radius + shore(zone, x, z);
    const bowl = -1.1 * (1 - THREE.MathUtils.smoothstep(d, 2.4, zone.radius + 0.7));
    // A margem variável precisa terminar em altura zero exatamente no limite do lago;
    // sem a transição, a borda pode ter um degrau que bloqueia o movimento para fora.
    const shoreline = 1 - THREE.MathUtils.smoothstep(radius, zone.radius - 0.85, zone.radius);
    return bowl * shoreline;
  };
  function groundHeight(x, z) {
    for (const zone of zones.values()) {
      if (zone.type === 'plateau') {
        // Keep this hot query allocation-free; manual ground aiming can sample it
        // hundreds of times per frame while the player moves the pointer.
        const dx = x - zone.center.x, dz = z - zone.center.z;
        const px = dx * zone.side.x + dz * zone.side.z;
        const pz = dx * zone.fwd.x + dz * zone.fwd.z;
        if (Math.abs(px) <= 1.5 && pz >= -9 && pz <= -3) return (pz + 9) / 2;
        if (Math.hypot(px, pz) < zone.radius) return 3;
      } else if (Math.hypot(x - zone.center.x, z - zone.center.z) < zone.radius) {
        return Math.max(-0.38, lakeDepth(zone, x, z));   // na parte rasa afunda até a canela
      }
    }
    return 0;
  }
  const lakesZones = [...zones.values()].filter((zone) => zone.type === 'lake');
  const isShallow = (x, z) => lakesZones.some((zone) => zone.type === 'lake' && Math.hypot(x - zone.center.x, z - zone.center.z) < zone.radius && Math.hypot(x - zone.center.x, z - zone.center.z) >= 3.2);
  const deepAt = (p) => lakesZones.some((zone) => zone.type === 'lake' && Math.hypot(p.x - zone.center.x, p.z - zone.center.z) < 3.2);
  function canStep(from, to) {
    if (deepAt(to)) return false;
    const h = groundHeight(to.x, to.z), prev = groundHeight(from.x, from.z);
    return Math.abs(h - prev) <= Math.max(0.18, Math.hypot(to.x - from.x, to.z - from.z) * 0.65);
  }
  function aroundZone(from, to, zone, radius) {
    const edge = zone.type === 'lake' ? 3.2 : zone.radius;
    radius = Math.min(radius, Math.max(edge, to.clone().setY(0).distanceTo(zone.center) - 0.05));
    const delta = new THREE.Vector3().subVectors(to, from).setY(0), len = delta.lengthSq();
    const off = new THREE.Vector3().subVectors(zone.center, from).setY(0);
    const t = len ? THREE.MathUtils.clamp(off.dot(delta) / len, 0, 1) : 0;
    if (from.clone().addScaledVector(delta, t).setY(0).distanceTo(zone.center) >= radius) return to;
    const a = local(zone, from), b = local(zone, to), angle = Math.atan2(a.z, a.x);
    const turn = Math.atan2(Math.sin(Math.atan2(b.z, b.x) - angle), Math.cos(Math.atan2(b.z, b.x) - angle));
    const next = angle + THREE.MathUtils.clamp(turn, -0.55, 0.55);
    return zone.center.clone().addScaledVector(zone.side, Math.cos(next) * (radius + 0.65)).addScaledVector(zone.fwd, Math.sin(next) * (radius + 0.65));
  }
  function nextWaypoint(from, to) {
    for (const zone of zones.values()) {
      if (zone.type === 'plateau') {
        const a = local(zone, from), b = local(zone, to);
        const ah = Math.hypot(a.x, a.z) < 4 || inRamp(a) ? groundHeight(from.x, from.z) : 0;
        const bh = Math.hypot(b.x, b.z) < 4 || inRamp(b) ? groundHeight(to.x, to.z) : 0;
        if (ah < 0.1 && bh < 0.1 && !inRamp(a)) {
          // Contorna também as laterais da rampa, sem cortar a encosta.
          let lo = 0, hi = 1;
          for (const [v, d, min, max] of [[a.x,b.x-a.x,-1.5,1.5],[a.z,b.z-a.z,-9,-3]]) {
            if (Math.abs(d) < 0.0001) { if (v < min || v > max) hi = -1; }
            else { const t0=(min-v)/d,t1=(max-v)/d; lo=Math.max(lo,Math.min(t0,t1)); hi=Math.min(hi,Math.max(t0,t1)); }
          }
          if (lo <= hi) {
            const sign = (a.z > -9.3 ? a.x : b.x) < 0 ? -1 : 1;
            if (b.z > -3 && Math.abs(a.x) > 1.8) {
              const side = zone.center.clone().addScaledVector(zone.side, sign * 5.3).addScaledVector(zone.fwd, -2);
              return aroundZone(from, side, zone, 4.5);
            }
            const entry = zone.ramp.bottom.clone().addScaledVector(zone.side, sign * 2.3).addScaledVector(zone.fwd,-1);
            return aroundZone(from, entry, zone, 4.5);
          }
          const around = aroundZone(from, to, zone, 4.5);
          if (around !== to) return around;
          continue;
        }
        if (Math.abs(ah - bh) < 0.1 && !inRamp(a)) continue;
        const up = bh > ah || (inRamp(a) && bh >= 3);
        if (up && (Math.hypot(b.x, b.z) < 4 || inRamp(b))) {
          if (ah < 0.1 && !inRamp(a)) {
            if (from.distanceTo(zone.ramp.bottom) < 0.45) return zone.ramp.top;
            if (a.z > -9.2 && (Math.abs(a.x) > 1.6 || a.z > -8.5)) {
              const entry = zone.ramp.bottom.clone().addScaledVector(zone.side, a.x < 0 ? -2.3 : 2.3).addScaledVector(zone.fwd, -1);
              return aroundZone(from, entry, zone, 4.5);
            }
            return zone.ramp.bottom;
          }
          if (ah < 2.95) return inRamp(b) ? to : zone.ramp.top;
        } else if ((ah > 0 || inRamp(a)) && bh < 3) {
          if (!inRamp(a) && from.distanceTo(zone.ramp.top) > 0.45) return zone.ramp.top;
          return inRamp(b) ? to : zone.ramp.bottom.clone().addScaledVector(zone.fwd, -0.7);
        }
      } else {
        const around = aroundZone(from, to, zone, 3.9);
        if (around !== to) return around;
      }
    }
    return to;
  }

  // ---------- rio, cruzando a estrada entre as fases 3 e 4 ----------
  const crossS = (anchorS(3) + anchorS(4)) / 2;
  const cp = pointAt(crossS), ct = tangentAt(crossS), cn = sideOf(ct);
  const riverCtl = [];
  for (let k = -90; k <= 90; k += 10) {
    const wiggle = Math.abs(k) < 12 ? 0 : Math.sin(k * 0.09) * 7;
    riverCtl.push(cp.clone().addScaledVector(cn, k).addScaledVector(ct, wiggle));
  }
  const riverPts = new THREE.CatmullRomCurve3(riverCtl).getSpacedPoints(300);

  const distTo = (pts, x, z) => {
    let m = Infinity;
    for (const p of pts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < m) m = d; }
    return Math.sqrt(m);
  };
  const roadDist = (x, z) => distTo(roadPts, x, z);
  const riverDist = (x, z) => distTo(riverPts, x, z);

  // ---------- locais dos marcos de cada região (fixos, longe da área de luta) ----------
  const castleAt = pointAt(L - 10);
  const sites = {};
  const siteList = [];
  // procura perto da fase um ponto a ≥ gap m do caminho, fora do rio, das zonas e de outros marcos
  function site(name, phase, ds, side, r, gap = 9) {
    for (const k of [0, 5, -5, 10, -10, 15, -15, 20]) {
      const s = anchorS(phase) + ds + k;
      for (let lat = gap + r; lat < gap + r + 12; lat += 1.5) {
        const p = along(s, side * lat);
        if (roadDist(p.x, p.z) < gap + r - 0.3) continue;
        if (riverDist(p.x, p.z) < r + 5 || p.distanceTo(castleAt) < 24 + r) break;
        if ([...zones.values()].some((zn) => Math.hypot(p.x - zn.center.x, p.z - zn.center.z) < zn.radius + 8 + r)) break;
        if (siteList.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + r + 2)) continue;
        const st = { x: p.x, z: p.z, r, look: pointAt(s) };
        sites[name] = st;
        siteList.push(st);
        return;
      }
    }
  }
  site('praca', 2, 0, -1, 6);
  site('moinho', 4, 2, -1, 4);
  site('campos', 5, 0, 1, 8);
  site('carroca', 6, -4, -1, 3);
  site('arcos', 7, 0, -1, 6);
  site('muro', 8, 0, 1, 7);
  site('estatua', 9, 0, 1, 4);
  site('cemiterio', 10, 0, -1, 8);
  site('obelisco1', 11, -6, 1, 3);
  site('obelisco2', 11, 6, -1, 3);
  site('caldeirao', 12, -10, 1, 3);

  // o caminho não aparece: perto dele o chão é plano, longe viram morros de borda irregular;
  // o rio cava um leito
  const noise = (x, z) => ((Math.sin(x * 0.13 + z * 0.05 + terrainWarp[0]) + Math.sin(z * 0.17 - x * 0.07 + terrainWarp[1]) + 1.5 * Math.sin((x + z) * 0.045 + terrainWarp[0] - terrainWarp[1])) / 3.5) * 0.5 + 0.5;
  const patch = (x, z) => ((Math.sin(x * 0.31 + z * 0.17 + terrainWarp[1]) + Math.sin(z * 0.27 - x * 0.19 + terrainWarp[0]) + Math.sin((x - z) * 0.11 + terrainWarp[0] + terrainWarp[1])) / 3) * 0.5 + 0.5;
  // quanto o chão é terra (e não grama): manchas soltas, mais comuns perto do caminho
  const sandAt = (x, z, d) => (1 - THREE.MathUtils.smoothstep(d, 1, ROAD + 6)) * 0.7 + (patch(x, z) - 0.5) * 1.1 + (noise(z, x) > 0.82 ? 0.4 : 0);
  const isSand = (x, z, d) => sandAt(x, z, d) > 0.42;
  function heightAt(x, z, d = roadDist(x, z)) {
    const wobble = (patch(z * 0.6, x * 0.6) - 0.5) * 14;
    const hill = THREE.MathUtils.smoothstep(d + wobble, ROAD + 9, ROAD + 30);
    let h = hill * (1.5 + 9 * noise(x, z) ** 1.5);
    for (const zone of zones.values()) {
      const dz = Math.hypot(x - zone.center.x, z - zone.center.z);
      if (dz < 12) h = 0;
      if (zone.type === 'lake' && dz < zone.radius + 2) h = Math.min(h, lakeDepth(zone, x, z));
    }
    for (const st of siteList) {   // chão plano embaixo dos marcos
      const ds = Math.hypot(x - st.x, z - st.z);
      if (ds < st.r + 7) h *= THREE.MathUtils.smoothstep(ds, st.r + 1, st.r + 7);
    }
    const dr = riverDist(x, z);
    if (dr < 4) h = THREE.MathUtils.lerp(-0.8, h, (dr / 4) ** 2);
    return h;
  }

  // ---------- materiais e utilidades ----------
  const mats = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra }));
    return mats.get(key);
  };
  const mesh = (geo, color, x = 0, y = 0, z = 0, parent = scene) => {
    const m = new THREE.Mesh(geo, typeof color === 'number' ? mat(color) : color);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const faceTo = (obj, x, z) => { obj.rotation.y = Math.atan2(x - obj.position.x, z - obj.position.z); };

  const obstacles = [];   // { x, z, r } para colisão das unidades
  const blocked = [];     // áreas onde não nasce árvore nem grama alta
  for (const zone of zones.values()) {
    blocked.push({ x: zone.center.x, z: zone.center.z, r: zone.radius + 2 });
    for (const p of zone.ground) blocked.push({ x: p.x, z: p.z, r: 1.5 });
    if (zone.ramp) blocked.push({ x: zone.ramp.bottom.x, z: zone.ramp.bottom.z, r: 3 });
  }
  for (const st of siteList) blocked.push({ x: st.x, z: st.z, r: st.r + 1.5 });
  const isFree = (x, z, r = 0) => !blocked.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r);

  // ---------- chão ----------
  const zTop = ROUTE.at(-1)[1] - 45, zBot = ROUTE[0][1] + 35;
  const ground = new THREE.PlaneGeometry(180, zBot - zTop, 160, Math.round((zBot - zTop) / 1.1));
  ground.rotateX(-Math.PI / 2);
  ground.translate(0, 0, (zTop + zBot) / 2);
  const gp = ground.attributes.position;
  const vDist = new Float32Array(gp.count);   // distância de cada vértice até o caminho
  for (let i = 0; i < gp.count; i++) {
    vDist[i] = roadDist(gp.getX(i), gp.getZ(i));
    gp.setY(i, heightAt(gp.getX(i), gp.getZ(i), vDist[i]));
  }
  // cor por vértice (não por triângulo): a borda entre grama e terra fica suave, sem serrilhado
  ground.computeVertexNormals();
  const gn = ground.attributes.normal;
  const colors = new Float32Array(gp.count * 3);
  // paleta da referência: grama verde-limão, terra alaranjada, encostas de pedra arenosa
  // estilo Clash: grama verde forte e saturada, terra quente
  const grassA = new THREE.Color(biome.grass[0]), grassB = new THREE.Color(biome.grass[1]), sandA = new THREE.Color(biome.sand[0]), sandB = new THREE.Color(biome.sand[1]),
    cliffA = new THREE.Color(biome.cliffs[0]), cliffB = new THREE.Color(biome.cliffs[1]), bed = new THREE.Color(biome.bed),
    dry = new THREE.Color(biome.dry), necro = new THREE.Color(biome.gloom);
  const c = new THREE.Color(), grass = new THREE.Color(), sand = new THREE.Color(), cliff = new THREE.Color();
  const smooth = THREE.MathUtils.smoothstep;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i);
    grass.copy(grassA).lerp(grassB, rand());
    sand.copy(sandA).lerp(sandB, rand());
    cliff.copy(cliffA).lerp(cliffB, rand());
    c.copy(grass).lerp(sand, smooth(sandAt(x, z, vDist[i]), 0.36, 0.48));
    c.lerp(cliff, Math.max(smooth(1 - gn.getY(i), 0.12, 0.3), smooth(y, 6.5, 8.5)));   // encostas e topos
    c.lerp(bed, smooth(-y, 0.05, 0.3));                                                  // leito do rio
    const g = gloomAt(z);   // grama secando e depois virando terra morta arroxeada
    if (g > 0) c.lerp(dry, Math.min(1, g * 1.6) * 0.6).lerp(necro, Math.max(0, g - 0.4) * 1.3);
    c.toArray(colors, i * 3);
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrainMesh = new THREE.Mesh(ground, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // faixa que acompanha uma curva (estrada, bordas, rio)
  function ribbon(pts, width, offset, y, material) {
    const v = [], idx = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
      const side = sideOf(t);
      v.push(p.x + side.x * (offset - width / 2), y, p.z + side.z * (offset - width / 2));
      v.push(p.x + side.x * (offset + width / 2), y, p.z + side.z * (offset + width / 2));
      if (i < pts.length - 1) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  const flatMat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, ...extra });
  const riverTint = new THREE.Color(biome.river);
  const water = ribbon(riverPts, 6.5, 0, -0.25, flatMat(biome.river, { transparent: true, opacity: 0.88 }));
  for (const p of riverPts) blocked.push({ x: p.x, z: p.z, r: 3.4 });

  // ---------- ponte ----------
  const bridge = new THREE.Group();
  bridge.position.copy(cp);
  bridge.rotation.y = Math.atan2(ct.x, ct.z);
  scene.add(bridge);
  const wood = 0x8a5a2e, darkWood = 0x5e3b1d, stone = 0x8b8578;
  const BW = 3.6;   // metade da largura da ponte
  mesh(new THREE.BoxGeometry(BW * 2, 0.3, 11), wood, 0, -0.13, 0, bridge);
  for (let z = -5; z <= 5; z += 0.9) mesh(new THREE.BoxGeometry(BW * 2, 0.05, 0.12), darkWood, 0, 0.03, z, bridge);
  for (const sx of [-1, 1]) {
    for (let z = -5; z <= 5; z += 2.5) mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), darkWood, sx * (BW - 0.15), 0.5, z, bridge);
    mesh(new THREE.BoxGeometry(0.15, 0.15, 10.2), wood, sx * (BW - 0.15), 0.95, 0, bridge);
    for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), stone, sx * BW, 0.2, sz * 5.6, bridge);
  }
  // o rio só se atravessa pela ponte: as margens fora dela bloqueiam a passagem
  for (const p of riverPts) {
    const off = new THREE.Vector3(p.x - cp.x, 0, p.z - cp.z);
    if (Math.abs(off.dot(cn)) > BW + 0.8) obstacles.push({ x: p.x, z: p.z, r: 2.6 });
  }


  // ---------- rochedos com escadaria e lagos ----------
  const stoneGrays = [0x8f8b86, 0x9d988f, 0x827f7b, 0xa9a399, 0x8a8f96];
  const boulderGeo = new THREE.DodecahedronGeometry(0.6, 0);
  const reedGeo = new THREE.CylinderGeometry(0.035, 0.05, 1, 4), headGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.3, 5);
  const padGeo = new THREE.CircleGeometry(0.42, 9, 0.3, Math.PI * 2 - 0.6), plankGeo = new THREE.BoxGeometry(1.6, 0.14, 0.42);
  const lakes = [];

  const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

  // O sorteio do mapa é uma sequência só: o rochedo antigo consumia uma quantidade certa de números e tudo
  // que vem depois (árvores, casas, obstáculos) depende disso. Gasta exatamente a mesma conta para o mapa
  // de cada semente continuar igual; o rochedo novo sorteia com um gerador próprio.
  function skipLegacyRockRolls() {
    const seedA = rand() * 10, seedB = rand() * 10;
    const radiusAt = (a, t) => {
      const base = THREE.MathUtils.lerp(4.75, 4.1, Math.pow(t, 0.7));
      const bulge = Math.sin(a * 3 + seedA) * 0.4 + Math.sin(a * 5 - seedB + t * 2) * 0.25 + Math.sin(a * 11 + t * 4) * 0.14;
      return base + bulge * (0.55 + 0.45 * Math.sin(t * Math.PI)) - Math.abs(Math.sin(a * 9 + seedB)) * 0.28 * t;
    };
    for (let n = 0; n < 476 + 544 + 136 + 2 + 170; n++) rand();   // paredes, cores, topo e cores do topo
    for (let n = 0; n < 9; n++) {   // pontas na borda
      const a = rand() * Math.PI * 2, r = radiusAt(a, 1) - range(0.1, 0.4);
      if (!(Math.abs(Math.sin(a) * r) < 2.6 && Math.cos(a) * r < 0)) for (let k = 0; k < 7; k++) rand();
    }
    for (let n = 0; n < 22; n++) {   // pedregulhos da base
      const a = rand() * Math.PI * 2, r = radiusAt(a, 0) + range(-0.2, 1.4);
      if (!(Math.abs(Math.sin(a) * r) < 2.4 && Math.cos(a) * r < -2.5)) for (let k = 0; k < 5; k++) rand();
    }
    for (let n = 0; n < 27 + 120; n++) rand();   // trilha e cores da trilha
    for (const sx of [-1, 1]) for (let z = -9.2; z < -3.2; z += range(0.7, 1.1)) for (let k = 0; k < 6; k++) rand();
    for (let n = 0; n < 18; n++) rand();   // ossos do acampamento
  }

  // Rochedo de pedra: penhasco facetado com matacões grandes encostados (alturas diferentes, estratos e musgo
  // raro nas fendas), topo de lajes de pedra, escadaria de lajes entre muretas de blocos e 1 a 3 pináculos
  // atrás, longe da estrada. Tudo numa malha só (cor por face, sem textura).
  // A lógica não muda: topo andável na altura 3 com raio 4 e rampa em |x| <= 1.5, z de -9 a -3.
  function rockMountain(group, gloom, zone) {
    skipLegacyRockRolls();
    let ls = (Math.abs(Math.round(zone.center.x * 977 + zone.center.z * 131 + seedValue * 7919)) % 2147483646) + 1;
    const lr = () => (ls = (ls * 16807) % 2147483647) / 2147483647;
    const lrange = (a, b) => a + (b - a) * lr();
    const lpick = (list) => list[Math.floor(lr() * list.length)];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const smooth = THREE.MathUtils.smoothstep;
    const TAU = Math.PI * 2;
    const pos = [], col = [];
    const tri = (a, b, d, color) => { for (const v of [a, b, d]) { pos.push(v.x, v.y, v.z); col.push(color.r, color.g, color.b); } };
    const quad = (a, b, d, e, color) => { tri(a, b, d, color); tri(b, e, d, color); };
    const addGeo = (geo, m, colorOf) => {   // peça pronta (pedra, osso...) vira triângulos da malha única
      const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m), p = g.attributes.position;
      for (let i = 0; i < p.count; i += 3) {
        const a = V().fromBufferAttribute(p, i), b = V().fromBufferAttribute(p, i + 1), d = V().fromBufferAttribute(p, i + 2);
        tri(a, b, d, colorOf(a, b, d));
      }
      g.dispose();
    };
    const mtx = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(V(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));

    // paleta: cinzas de pedra (os mesmos tons das pedras do mapa) e musgo escuro que seca nas trevas
    const rockTones = [0x8f8b86, 0x9d988f, 0x827f7b, 0xa9a399, 0x8a8f96].map((h) => new THREE.Color(h));
    const dark = new THREE.Color(0x4a4456), dry = new THREE.Color(biome.dry), necro = new THREE.Color(biome.gloom);
    const mossA = new THREE.Color(biome.grass[1]).multiplyScalar(0.72), mossB = new THREE.Color(0x5d7a3c);
    const out = new THREE.Color(), nrm = V(), e1 = V(), e2 = V();
    const wither = (c) => (gloom > 0 ? c.lerp(dry, Math.min(1, gloom * 1.6) * 0.6).lerp(necro, Math.max(0, gloom - 0.4) * 1.3) : c);
    const stone = (k = 1) => out.copy(lpick(rockTones)).multiplyScalar(lrange(0.95, 1.05) * k).lerp(dark, gloom * 0.5);
    const moss = (mix = lr()) => wither(out.copy(mossA).lerp(mossB, mix));
    const s1 = lrange(0, 6.3), s2 = lrange(0, 6.3), s3 = lrange(0, 6.3);
    // face de rocha: pé mais escuro, faces de cima mais claras, faixas de estrato nas faces de pé
    // e, se pedir, musgo raro só nas faces viradas para cima
    const faceColor = (a, b, d, mossChance = 0) => {
      nrm.crossVectors(e1.subVectors(b, a), e2.subVectors(d, a)).normalize();
      const y = (a.y + b.y + d.y) / 3, up = Math.abs(nrm.y);
      if (up > 0.75 && lr() < mossChance) return moss();
      let k = (0.84 + 0.14 * smooth(y, -0.2, 2.8)) * (0.95 + 0.1 * up);
      const band = (((y * 1.6 + s1) % 1) + 1) % 1;
      if (up < 0.55 && band < 0.17) k *= 0.83;   // estrato
      return stone(k);
    };

    // rocha amassada: cada vértice é empurrado conforme a sua posição (vértices repetidos andam juntos,
    // a pedra não racha) e o que passa de `cap` vira uma face plana, como pedra lascada
    const hash = (x, y, z, s) => { const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s) * 43758.5453; return h - Math.floor(h); };
    const icoGeo = new THREE.IcosahedronGeometry(1, 1), dodecaGeo = new THREE.DodecahedronGeometry(1, 0);
    const blockGeo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2), spireGeo = new THREE.CylinderGeometry(0.32, 1, 1, 6, 3).translate(0, 0.5, 0);
    const rock = (base, m, rough, cap = 9, mossChance = 0) => {
      const g = base.clone(), p = g.attributes.position, sd = lr() * 100;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 1 + (hash(Math.round(x * 97), Math.round(y * 97), Math.round(z * 97), sd) - 0.5) * 2 * rough;
        p.setXYZ(i, x * k, Math.min(y * k, cap), z * k);
      }
      addGeo(g, m, (a, b, d) => faceColor(a, b, d, mossChance));
      g.dispose();
    };

    // a estrada fica do lado +x da malha (o grupo gira com zone.fwd e o centro está 6,5 m para zone.side)
    // contorno: raio que varia suave com o ângulo; no topo nunca menos que 4 (cobre a área andável)
    const lobe = (a) => Math.sin(a * 2 + s1) * 0.16 + Math.sin(a * 3 + s2) * 0.12 + Math.sin(a * 5 + s3) * 0.07;
    const rimAt = (a) => 4.1 + 0.5 * (lobe(a) + 0.35) / 0.7;
    const rampH = (z) => THREE.MathUtils.clamp((z + 9) / 2, 0, 3);
    const nearRamp = (x, z, w = 3.3) => z < -2 && Math.abs(x) < w;
    // corte do penhasco na frente: a largura da rampa desce até a altura dela e os lados viram ombros de pedra
    const cut = (v) => {
      if (v.z > -2.6) return;
      const ax = Math.abs(v.x);
      if (ax < 1.75) v.y = Math.min(v.y, Math.max(-0.3, rampH(v.z) - 0.1));
      else if (ax < 2.6) v.y = Math.min(v.y, rampH(v.z) + 0.2 + (ax - 1.75) * 1.4);
    };

    // penhasco: fileiras desencontradas com contrafortes fortes, como uma parede de pedra lascada
    const SEG = 30;
    const angles = Array.from({ length: SEG }, (_, i) => ((i + lrange(-0.3, 0.3)) / SEG) * TAU);
    const rows = [[-0.3, 0.2], [0.45, 0.12], [1.0, 0.22], [1.6, 0.06], [2.15, 0.16], [2.6, 0.04], [2.88, 0.02]];
    const R0 = angles.map(rimAt);
    const column = angles.map(() => lrange(-0.3, 0.45));
    const grid = rows.map(([y, flare], k) => angles.map((a, i) => {
      const inner = k > 0 && k < rows.length - 1, buttress = k > 0 && k < rows.length - 2 ? column[i] * Math.sin((k / (rows.length - 1)) * Math.PI) : 0;
      const r = R0[i] + flare + buttress + (inner ? lrange(-0.16, 0.16) : lrange(-0.04, 0.04));
      const v = V(Math.sin(a) * r, y + (inner ? lrange(-0.14, 0.14) : 0), Math.cos(a) * r);
      cut(v);
      return v;
    }));
    for (let k = 0; k < rows.length - 1; k++) for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG, a = grid[k][i], b = grid[k][j], d = grid[k + 1][i], e = grid[k + 1][j];
      tri(a, b, d, faceColor(a, b, d));
      tri(b, e, d, faceColor(b, e, d));
    }

    // topo de lajes: anéis com vértices compartilhados (sem frestas), cada laje junta alguns segmentos
    // de um anel e ganha um tom próprio; algumas com musgo perto da borda, poucas mais escuras (fenda)
    const ring = (k, y, jit) => angles.map((a, i) => {
      const r = R0[i] * k + lrange(-jit, jit);
      const v = V(Math.sin(a) * r, y + lrange(-0.02, 0.02), Math.cos(a) * r);
      if (Math.abs(v.x) <= 1.6 && v.z < -3) v.z = -3;   // a escadaria chega no topo pela frente
      return v;
    });
    const top = grid[rows.length - 1];
    const rings = [ring(0.955, 2.99, 0.03), ring(0.77, 3.02, 0.12), ring(0.54, 3.02, 0.14), ring(0.28, 3.02, 0.1)];
    const center = V(lrange(-0.3, 0.3), 3.03, lrange(-0.3, 0.3));
    for (let i = 0; i < SEG; i++) {   // quina da borda, um pouco mais clara
      const j = (i + 1) % SEG;
      quad(top[i], top[j], rings[0][i], rings[0][j], stone(1.04));
    }
    const plateSize = [[2, 3], [3, 4], [3, 5], [5, 8]];
    for (let k = 0; k < rings.length; k++) {
      const outer = rings[k], inner = rings[k + 1];
      for (let s = Math.floor(lr() * 3), done = 0; done < SEG;) {
        const n = Math.min(SEG - done, Math.round(lrange(...plateSize[k]))), roll = lr();
        const tone = (roll < 0.08 && k === 0 ? moss(0.25 + lr() * 0.3) : stone(lrange(1.0, 1.14) * (roll > 0.9 ? 0.84 : 1))).clone();
        for (let m = 0; m < n; m++, s++) {
          const i = s % SEG, j = (s + 1) % SEG;
          if (inner) quad(outer[i], outer[j], inner[i], inner[j], tone);
          else tri(outer[i], outer[j], center, tone);
        }
        done += n;
      }
    }

    // escadaria: leito de cascalho e, por cima, lajes que seguem a rampa (degrau de 0,1 sem sair
    // mais de 0,06 da altura onde os pés pisam), com espelho e laterais escuras
    const gx = [-1.62, -0.8, 0, 0.8, 1.62];
    const bedY = (z) => (z < -9 ? 0.02 : rampH(z) - 0.06);
    for (let z = -10.1; z < -2.95; z += 0.5) {
      const z1 = Math.min(z + 0.5, -2.95);
      for (let i = 0; i < gx.length - 1; i++) {
        quad(V(gx[i], bedY(z), z), V(gx[i + 1], bedY(z), z), V(gx[i], bedY(z1), z1), V(gx[i + 1], bedY(z1), z1), stone(0.72 * lrange(0.9, 1.05)));
      }
    }
    for (let z0 = -9.05; z0 < -3.05;) {
      const z1 = Math.min(z0 + lrange(0.55, 0.72), -2.98);
      const cutsX = lr() < 0.5 ? [-1.5, lrange(-0.4, 0.4), 1.5] : [-1.5, lrange(-0.75, -0.35), lrange(0.35, 0.75), 1.5];
      for (let i = 0; i < cutsX.length - 1; i++) {
        const g = 0.045, j = () => lrange(-0.025, 0.025);
        const xa = cutsX[i] + g, xb = cutsX[i + 1] - g, za = z0 + g, zb = z1 - g * 0.5;
        const yF = rampH(z0) + 0.06, yB = rampH(z1) - 0.04, foot = rampH(z0) - 0.06;
        const fl = V(xa + j(), yF + j() * 0.5, za + j()), fr = V(xb + j(), yF + j() * 0.5, za + j());
        const bl = V(xa + j(), yB, zb), br = V(xb + j(), yB, zb);
        const fl0 = V(fl.x, foot, fl.z), fr0 = V(fr.x, foot, fr.z), bl0 = V(bl.x, rampH(z1) - 0.08, bl.z), br0 = V(br.x, rampH(z1) - 0.08, br.z);
        quad(fl, fr, bl, br, stone(lrange(1.0, 1.12)).clone());
        const side = stone(0.78).clone();
        quad(fl0, fr0, fl, fr, side);
        quad(bl0, fl0, bl, fl, side);
        quad(fr0, br0, fr, br, side);
      }
      z0 = z1;
    }

    // muretas da escadaria: blocos lascados de cada lado, subindo junto com os degraus (param antes do topo)
    for (const sx of [-1, 1]) {
      for (let z = -9.8; z < -4.2;) {
        const len = lrange(1.0, 1.45), z1 = Math.min(z + len, -3.75), zc = (z + z1) / 2, w = lrange(0.85, 1.15);
        const h = rampH(z1) + lrange(0.18, 0.42);
        rock(blockGeo, mtx(sx * (1.66 + w / 2), (h - 0.35) / 2, zc, w, h + 0.35, z1 - z, lrange(-0.05, 0.05)), 0.08, 9, 0.12);
        z += (z1 - z) * lrange(0.72, 0.88);
      }
    }

    // matacões grandes encostados no penhasco, de alturas diferentes (o topo fica abaixo da borda,
    // então nada sobe na área andável); do lado da estrada não passam do pé antigo do rochedo
    for (let n = 0, tries = 0; n < 14 && tries < 90; tries++) {
      const a = lr() * TAU, w = lrange(0.85, 1.5);
      let r = rimAt(a) + lrange(-0.1, 0.5);
      if (Math.sin(a) > 0.3) r = Math.min(r, 5.3 - w * 1.15);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (nearRamp(x, z, 2.9 + w)) continue;
      const sy = lrange(0.9, 1.5), topY = lrange(1.2, 2.75);
      rock(icoGeo, mtx(x, topY - sy * 0.82, z, w, sy, w * lrange(0.75, 1.15), lr() * TAU, lrange(-0.15, 0.15), lrange(-0.15, 0.15)), 0.17, 0.72, 0.3);
      n++;
    }
    // rochas que despontam na borda (fora do raio 4 e longe da estrada e da escadaria)
    for (let n = 0, tries = 0; n < 6 && tries < 50; tries++) {
      const a = lr() * TAU, w = lrange(0.45, 0.85), r = Math.max(rimAt(a) + 0.1, 4.25 + w * 1.3);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (x > 1 || z < -1.2) continue;
      const sy = lrange(0.8, 1.2), topY = lrange(3.35, 4.2);
      rock(dodecaGeo, mtx(x, topY - sy * 0.75, z, w, sy, w * lrange(0.8, 1.1), lr() * TAU), 0.15, 0.7, 0.35);
      n++;
    }
    // pináculos: 1 a 3 agulhas de pedra atrás, no lado oposto à estrada, dão a silhueta de montanha
    const spires = 1 + Math.floor(lr() * 3);
    for (let n = 0; n < spires; n++) {
      const a = -0.25 - (n + lrange(0.15, 0.85)) * (1.45 / spires), base = lrange(0.85, 1.25) * (n === 0 ? 1.1 : 0.9);
      const r = 4.35 + base * 1.2 + lrange(0, 0.5), x = Math.sin(a) * r, z = Math.cos(a) * r;
      const H = n === 0 ? lrange(5.6, 6.8) : lrange(3.9, 5.2);
      rock(spireGeo, mtx(x, -0.4, z, base, H, base * lrange(0.8, 1.05), lr() * TAU), 0.13, 9, 0.08);
      // lasca encostada do lado de fora
      const ox = Math.sin(a) * (r + base * 0.75), oz = Math.cos(a) * (r + base * 0.75);
      rock(spireGeo, mtx(ox, -0.3, oz, base * 0.6, H * lrange(0.45, 0.6), base * 0.55, lr() * TAU), 0.15, 9, 0.1);
    }

    // cascalho e pedras soltas na base e ao pé da escadaria
    const pebble = (x, y, z, s, flat = 0.6) => rock(dodecaGeo, mtx(x, y, z, s * lrange(0.85, 1.2), s * flat, s * lrange(0.85, 1.1), lr() * TAU, lrange(-0.3, 0.3)), 0.15);
    for (let n = 0, tries = 0; n < 12 && tries < 60; tries++) {
      const a = lr() * TAU, r = Math.min(rimAt(a) + lrange(0.6, 1.4), Math.sin(a) > 0.3 ? 5.3 : 9);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (nearRamp(x, z)) continue;
      const s = lrange(0.18, 0.45);
      pebble(x, s * 0.12, z, s);
      n++;
    }
    for (const sx of [-1, 1]) for (let n = 0; n < 2; n++) pebble(sx * lrange(1.9, 2.6), 0.04, lrange(-10.3, -9.6), lrange(0.2, 0.36));
    for (let n = 0; n < 6; n++) { const a = lr() * TAU, r = Math.sqrt(lr()) * 3.3; pebble(Math.sin(a) * r, 3.03, Math.cos(a) * r, lrange(0.07, 0.13)); }

    // tufos só no chão em volta (o rochedo em si é pedra) e almofadas de musgo em poucas fendas do topo
    const tuftGeo = mergeGeometries([0, 1, 2].map((i) => new THREE.ConeGeometry(0.06, 0.5, 3).rotateZ((i - 1) * 0.35).translate((i - 1) * 0.08, 0.25, 0).toNonIndexed()));
    const tuftTones = biome.tuft.map((h) => new THREE.Color(h));
    const tuft = (x, y, z) => { const t = lpick(tuftTones); addGeo(tuftGeo, mtx(x, y, z, 1, lrange(0.7, 1.3), 1, lr() * 6), () => wither(out.copy(t))); };
    for (let n = 0; n < 12; n++) {
      const a = lr() * TAU, r = Math.min(rimAt(a) + lrange(0.5, 1.0), Math.sin(a) > 0.3 ? 5.3 : 9), x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!nearRamp(x, z, 2.7)) tuft(x, 0, z);
    }
    for (const sx of [-1, 1]) for (let n = 0; n < 2; n++) tuft(sx * lrange(2.8, 3.2), 0, lrange(-9.8, -6.5));
    for (let n = 0; n < 4; n++) {
      const a = lr() * TAU, r = lrange(2.6, 3.6);
      addGeo(icoGeo, mtx(Math.sin(a) * r, 2.99, Math.cos(a) * r, lrange(0.22, 0.38), 0.05, lrange(0.18, 0.3), lr() * TAU), () => moss());
    }

    // acampamento dos esqueletos no topo: ossos, fogueira apagada e estandarte roxo
    const fixed = (hex) => () => out.set(hex);
    addGeo(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), mtx(-1.6, 4.3, 2, 1, 1, 1), fixed(0x4a3a32));
    addGeo(new THREE.BoxGeometry(0.05, 0.9, 0.7), mtx(-1.6, 5.1, 2.4, 1, 1, 1, 0.2), fixed(0x5b3a7a));
    const bone = new THREE.CapsuleGeometry(0.05, 0.35, 2, 5);
    for (let i = 0; i < 6; i++) addGeo(bone, mtx(lrange(-1.2, 1.6), 3.1, lrange(-0.5, 2.2), 1, 1, 1, 0, Math.PI / 2, lr() * 3), fixed(0xeee6d4));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      addGeo(dodecaGeo, mtx(1.4 + Math.cos(a) * 0.45, 3.08, 1.2 + Math.sin(a) * 0.45, 0.16, 0.12, 0.16, a), fixed(0x6e6a66));
    }
    addGeo(new THREE.ConeGeometry(0.22, 0.12, 5), mtx(1.4, 3.08, 1.2, 1, 1, 1), fixed(0x3a3330));   // cinzas

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    mesh(geo, rockMat, 0, 0, 0, group);
    for (const g of [icoGeo, dodecaGeo, blockGeo, spireGeo, tuftGeo, bone]) g.dispose();
  }

  // lago cavado no chão: a água fica no nível -0.2 e o fundo (heightAt/lakeDepth) desenha a margem
  function lake(zone, group, gloom) {
    const R = zone.radius + 1.6;
    const geo = new THREE.CircleGeometry(R, 48);
    geo.rotateX(-Math.PI / 2);
    const deep = new THREE.Color(biome.deep), shallow = new THREE.Color(biome.shallow), murky = new THREE.Color(biome.murky);
    const col = [], p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      c.copy(deep).lerp(shallow, THREE.MathUtils.smoothstep(Math.hypot(p.getX(i), p.getZ(i)), 1.5, zone.radius + 0.3)).lerp(murky, gloom * 0.6);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const water = mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false }), 0, -0.2, 0, group);
    water.castShadow = false;
    lakes.push(water);
    const leaf = new THREE.Color(biome.pondLeaf).lerp(murky, gloom * 0.5).getHex();
    // vitórias-régias, algumas com flor
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2, r = range(3.3, zone.radius - 0.4);
      const pad = mesh(padGeo, leaf, Math.cos(a) * r, -0.17, Math.sin(a) * r, group);
      pad.rotation.set(-Math.PI / 2, 0, rand() * 6);
      pad.castShadow = false;
      if (rand() < 0.45) mesh(new THREE.IcosahedronGeometry(0.11, 0), gloom > 0.5 ? 0xb07ad9 : 0xff9ec7, Math.cos(a) * r, -0.08, Math.sin(a) * r, group);
    }
    // juncos em touceiras na margem e pedras meio afundadas
    for (let k = 0; k < 7; k++) {
      const a = rand() * Math.PI * 2, r = zone.radius + range(-0.2, 0.7);
      for (let n = 0; n < 5; n++) {
        const x = Math.cos(a) * r + range(-0.35, 0.35), z = Math.sin(a) * r + range(-0.35, 0.35), h = range(0.7, 1.2);
        const reed = mesh(reedGeo, biome.reeds, x, -0.2 + h / 2, z, group);
        reed.scale.y = h;
        reed.rotation.z = range(-0.2, 0.2);
        if (rand() < 0.6) mesh(headGeo, 0x7a5232, x, -0.2 + h + 0.1, z, group);
      }
    }
    for (let k = 0; k < 8; k++) {
      const a = rand() * Math.PI * 2, r = zone.radius + range(-0.6, 0.9);
      const b = mesh(boulderGeo, pick(stoneGrays), Math.cos(a) * r, -0.25, Math.sin(a) * r, group);
      b.scale.set(range(0.5, 0.9), range(0.35, 0.55), range(0.5, 0.9));
      b.rotation.y = rand() * 3;
    }
    // pierzinho de madeira saindo da margem
    for (let z = zone.radius + 1.2; z > zone.radius - 2; z -= 0.46) mesh(plankGeo, 0x9a6a36, 0, 0.02, z, group).rotation.y = range(-0.04, 0.04);
    for (const x of [-0.7, 0.7]) for (const z of [zone.radius - 1.8, zone.radius + 0.4]) mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.1, 5), 0x6b4423, x, -0.35, z, group);
    obstacles.push({ x: zone.center.x, z: zone.center.z, r: 3.2 });
  }

  for (const zone of zones.values()) {
    const group = new THREE.Group();
    group.position.copy(zone.center).setY(0);
    group.rotation.y = Math.atan2(zone.fwd.x, zone.fwd.z);
    scene.add(group);
    zone.group = group;
    if (zone.type === 'plateau') rockMountain(group, gloomAt(zone.center.z), zone);
    else lake(zone, group, gloomAt(zone.center.z));
  }

  // ---------- casas e vila ----------
  const walls = [0xf1e3c6, 0xe8d2b0, 0xf5efe6, 0xdcc6a3, 0xe9dccb];
  const roofs = [0xa8432f, 0x8c3b2a, 0x4f6d8f, 0x9c5a2c, 0x6d7f3a];
  const glow = mat(0xffd27a, { emissive: 0xffb340, emissiveIntensity: 0.6 });

  function house(x, z, lookX, lookZ) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    faceTo(g, lookX, lookZ);
    scene.add(g);
    const w = range(2.8, 3.6), d = range(2.6, 3.2), h = range(1.9, 2.8), two = rand() < 0.3;
    const hh = two ? h + 1.4 : h;
    // perto do castelo as casas estão abandonadas: cores apagadas e janelas escuras
    const gl = gloomAt(z), abandoned = gl > 0.55;
    const fade = (hex, to) => new THREE.Color(hex).lerp(new THREE.Color(to), Math.min(1, gl * 1.1)).getHex();
    const windowMat = abandoned ? mat(0x2a2433) : glow;
    mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), stone, 0, 0.17, 0, g);
    mesh(new THREE.BoxGeometry(w, hh, d), fade(pick(walls), 0x6e6878), 0, hh / 2 + 0.3, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(0.16, hh, 0.16), darkWood, sx * w / 2, hh / 2 + 0.3, sz * d / 2, g);
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.35, 0), new THREE.Vector2(w / 2 + 0.35, 0), new THREE.Vector2(0, 1.5)]);
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
    roofGeo.translate(0, 0, -(d + 0.6) / 2);
    mesh(roofGeo, fade(pick(roofs), 0x403a48), 0, hh + 0.3, 0, g);
    mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), stone, w * 0.25, hh + 1.1, -d * 0.2, g);
    mesh(new THREE.BoxGeometry(0.65, 1.15, 0.08), darkWood, 0, 0.87, d / 2 + 0.03, g);
    for (const sx of [-1, 1]) {
      const win = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), windowMat, sx * w * 0.3, 0.3 + h * 0.6, d / 2 + 0.03, g);
      win.castShadow = false;
      mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), windowMat, sx * (w / 2 + 0.03), 0.3 + h * 0.6, 0, g).castShadow = false;
      if (two) mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), windowMat, sx * w * 0.3, 0.3 + h + 0.8, d / 2 + 0.03, g).castShadow = false;
    }
    obstacles.push({ x, z, r: Math.max(w, d) / 2 + 0.4 });
    blocked.push({ x, z, r: 3.6 });
  }

  const barrel = (x, z) => { mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 8), 0x7a4e26, x, 0.4, z); mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 8), 0x3a3a3a, x, 0.6, z); };
  const hay = (x, z) => { const m = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 10), 0xe0c060, x, 0.55, z); m.rotation.z = Math.PI / 2; m.rotation.y = rand() * 3; };
  const crate = (x, z, s = 1) => { mesh(new THREE.BoxGeometry(s, s, s), 0x9a6a36, x, s / 2, z).rotation.y = rand() * 3; };
  function well(x, z) {
    mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.8, 10), stone, x, 0.4, z);
    mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 10), 0x3c6f9c, x, 0.78, z);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), darkWood, x + sx * 0.7, 1.2, z);
    mesh(new THREE.ConeGeometry(1.1, 0.7, 4), 0xa8432f, x, 2.3, z).rotation.y = Math.PI / 4;
    obstacles.push({ x, z, r: 1 });
    blocked.push({ x, z, r: 1.8 });
  }
  // cerca torta: de um ponto a outro, com postes levemente fora do lugar
  function fence(x0, z0, x1, z1) {
    let prev = null;
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.2));
    for (let i = 0; i <= n; i++) {
      if (rand() < 0.12 && i > 0 && i < n) { prev = null; continue; }   // pedaço quebrado
      const p = new THREE.Vector3(x0 + ((x1 - x0) * i) / n + range(-0.1, 0.1), 0, z0 + ((z1 - z0) * i) / n + range(-0.1, 0.1));
      mesh(new THREE.BoxGeometry(0.14, range(0.8, 1), 0.14), darkWood, p.x, 0.45, p.z).rotation.z = range(-0.08, 0.08);
      if (prev) {
        const len = prev.distanceTo(p);
        for (const y of [0.35, 0.7]) {
          const rail = mesh(new THREE.BoxGeometry(0.07, 0.09, len), wood, (p.x + prev.x) / 2, y, (p.z + prev.z) / 2);
          faceTo(rail, p.x, p.z);
        }
      }
      prev = p;
    }
  }

  // postes de lanterna só perto de algumas casas
  const lantern = mat(0xffe08a, { emissive: 0xffa53a, emissiveIntensity: 1 });
  function lamp(x, z) {
    mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), darkWood, x, 1.3, z).rotation.z = range(-0.05, 0.05);
    mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), darkWood, x + 0.3, 2.5, z);
    mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), lantern, x + 0.55, 2.25, z).castShadow = false;
  }

  // casas espalhadas sem ordem: distância, lado e direção sorteados
  const around = (p, r) => { const a = rand() * Math.PI * 2, k = range(r * 0.7, r); return [p.x + Math.cos(a) * k, p.z + Math.sin(a) * k]; };
  for (let i = 0; i < 70; i++) {
    const s = range(15, L - 40);
    const p = along(s, (rand() < 0.5 ? -1 : 1) * (ROAD + range(4, 18)));
    if (riverDist(p.x, p.z) < 8 || roadDist(p.x, p.z) < ROAD + 3.5 || !isFree(p.x, p.z, 2.5)) continue;
    const r = pointAt(s + range(-10, 10));
    house(p.x, p.z, r.x + range(-8, 8), r.z + range(-8, 8));
    const props = [barrel, barrel, hay, (x, z) => crate(x, z, range(0.6, 0.9))];
    for (let k = Math.floor(range(1, 4)); k > 0; k--) {
      const [x, z] = around(p, 3.6);
      if (isFree(x, z, 0.3)) pick(props)(x, z);
    }
    if (rand() < 0.3 && gloomAt(p.z) < 0.55) { const [x, z] = around(p, 4.5); if (isFree(x, z, 1)) lamp(x, z); }
    if (rand() < 0.15) { const [x, z] = around(p, 5); if (isFree(x, z, 1.2)) well(x, z); }
    if (rand() < 0.45) {
      const [x0, z0] = around(p, 4.4), ang = rand() * Math.PI, len = range(3, 7);
      fence(x0, z0, x0 + Math.cos(ang) * len, z0 + Math.sin(ang) * len);
    }
  }

  // ---------- obstáculos na estrada, entre as paradas ----------
  for (let p = 1; p < PHASES; p++) {
    const from = anchorS(p) + 7, to = anchorS(p + 1) - 7;
    const count = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const s = range(from, to);
      if (Math.abs(s - crossS) < 8) continue;   // não em cima da ponte
      const side = rand() < 0.5 ? -1 : 1;
      const at = along(s, side * range(2.3, ROAD - 0.9));
      const kind = rand();
      if (!isFree(at.x, at.z, 1.5)) continue;
      if (kind < 0.4) {
        const r = range(0.7, 1.1);
        mesh(new THREE.DodecahedronGeometry(r, 0), 0x7a7468, at.x, r * 0.5, at.z).rotation.set(rand() * 3, rand() * 3, 0);
        obstacles.push({ x: at.x, z: at.z, r: r * 0.95 });
      } else if (kind < 0.7) {
        barrel(at.x, at.z); barrel(at.x + 0.7, at.z + 0.3); crate(at.x - 0.3, at.z + 0.8, 0.8);
        obstacles.push({ x: at.x + 0.2, z: at.z + 0.3, r: 1.1 });
      } else {
        const log = mesh(new THREE.CylinderGeometry(0.35, 0.4, 3, 8), 0x6b4423, at.x, 0.35, at.z);
        const ang = rand() * Math.PI;
        log.rotation.set(Math.PI / 2, 0, ang);
        const dx = Math.cos(ang) * 1, dz = Math.sin(ang) * 1;
        obstacles.push({ x: at.x, z: at.z, r: 0.6 }, { x: at.x + dx, z: at.z - dz, r: 0.55 }, { x: at.x - dx, z: at.z + dz, r: 0.55 });
      }
    }
  }

  // ---------- castelo no topo ----------
  const endS = L - 10;
  const castle = new THREE.Group();
  castle.position.copy(pointAt(endS));
  const et = tangentAt(endS);
  castle.rotation.y = Math.atan2(-et.x, -et.z);   // +z local aponta para quem chega pela estrada
  scene.add(castle);
  const cstone = 0x8a8590, red = 0x6a2d55;   // pedra fria e telhados cor de ameixa
  for (const sx of [-1, 1]) {
    const tx = sx * (ROAD + 1.4);
    mesh(new THREE.CylinderGeometry(1.8, 2, 7, 10), cstone, tx, 3.5, 0, castle);
    mesh(new THREE.ConeGeometry(2.3, 3, 10), red, tx, 8.5, 0, castle);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 4), darkWood, tx, 10.8, 0, castle);
    mesh(new THREE.BoxGeometry(0.05, 0.6, 1), 0x6b3fa0, tx, 11.4, 0.5, castle);
    mesh(new THREE.BoxGeometry(16, 5, 1.6), cstone, sx * (ROAD + 10.5), 2.5, 0, castle);
    for (let x = ROAD + 3.5; x < ROAD + 18; x += 1.6) mesh(new THREE.BoxGeometry(0.9, 0.7, 1.6), cstone, sx * x, 5.3, 0, castle);
    mesh(new THREE.CylinderGeometry(1.6, 1.8, 6, 10), cstone, sx * (ROAD + 19), 3, 0, castle);
    mesh(new THREE.ConeGeometry(2, 2.6, 10), red, sx * (ROAD + 19), 7.3, 0, castle);
  }
  mesh(new THREE.BoxGeometry(ROAD * 2 + 0.8, 1.8, 1.6), cstone, 0, 6.1, 0, castle);
  mesh(new THREE.BoxGeometry(10, 9, 8), cstone, 0, 4.5, -12, castle);
  for (const sx of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(1.5, 1.6, 12, 10), cstone, sx * 5, 6, -12, castle);
    mesh(new THREE.ConeGeometry(1.9, 3.2, 10), red, sx * 5, 13.6, -12, castle);
  }
  mesh(new THREE.ConeGeometry(5.5, 4, 4), 0x4a2342, 0, 11, -12, castle).rotation.y = Math.PI / 4;
  // castelo do necromante: janelas com brilho roxo, estandartes e cristais
  const crystalMat = mat(0xc89cff, { emissive: 0x8a3ff0, emissiveIntensity: 0.9 });
  const winGlow = mat(0x9b6bff, { emissive: 0x7a3fd1, emissiveIntensity: 1 });
  const crystalGeo = new THREE.OctahedronGeometry(0.5, 0);
  const floaters = [];   // cristais que flutuam e giram
  const win = (x, y, z, parent = castle) => { mesh(new THREE.BoxGeometry(0.45, 0.8, 0.12), winGlow, x, y, z, parent).castShadow = false; };
  for (const sx of [-1, 1]) {
    win(sx * (ROAD + 1.4), 4.8, 1.85); win(sx * (ROAD + 1.4), 2.6, 1.95);
    win(sx * (ROAD + 19), 4, 1.7);
    win(sx * 5, 9, -10.45); win(sx * 5, 6, -10.45);
    for (const x of [1.5, 3]) win(sx * x, 6.5, -7.95);
    for (const x of [ROAD + 6, ROAD + 14]) {   // estandartes roxos pendurados no muro
      mesh(new THREE.BoxGeometry(1.1, 2.6, 0.06), 0x4b2470, sx * x, 3.4, 0.83, castle);
      mesh(new THREE.BoxGeometry(0.4, 0.4, 0.04), crystalMat, sx * x, 3.6, 0.88, castle).rotation.z = Math.PI / 4;
      mesh(new THREE.BoxGeometry(1.3, 0.12, 0.12), darkWood, sx * x, 4.75, 0.85, castle);
    }
    for (const [x, z, s] of [[ROAD + 5, 4, 1.6], [ROAD + 13, 3, 1.2], [ROAD + 21, 2.5, 1]]) {   // tufos de cristais
      for (let k = 0; k < 3; k++) {
        const cr = mesh(crystalGeo, crystalMat, sx * x + range(-0.7, 0.7), 0, z + range(-0.6, 0.6), castle);
        cr.scale.set(s * 0.7, s * range(1.6, 2.6), s * 0.7);
        cr.position.y = cr.scale.y * 0.35;
        cr.rotation.set(range(-0.3, 0.3), rand() * 3, range(-0.3, 0.3));
        cr.castShadow = false;
      }
    }
  }
  const bigCrystal = mesh(crystalGeo, crystalMat, 0, 15, -12, castle);
  bigCrystal.scale.set(1.6, 3, 1.6);
  bigCrystal.castShadow = false;
  floaters.push({ m: bigCrystal, y: 15, ph: 0 });
  blocked.push({ x: castle.position.x, z: castle.position.z, r: 26 });

  // ---------- natureza instanciada (muitas cópias baratas) ----------
  const dummy = new THREE.Object3D();
  const INSTANCE_BAND = 32;   // comprimento (em z) de cada pedaço da natureza instanciada
  // parts: [[geometria, cores], ...] — várias peças (ex.: tronco e copa) com a mesma posição
  const gloomTint = new THREE.Color(0x4f465e);
  function instanced(parts, count, place, shadow = true, material = null) {
    if (!Array.isArray(parts[0])) parts = [parts];
    const mats = parts.map(() => material || new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    const matrices = [], colors = parts.map(() => []), zs = [];
    let n = 0;
    for (let tries = 0; n < count && tries < count * 6; tries++) {
      if (!place(dummy)) continue;
      dummy.updateMatrix();
      const g = material ? 0 : gloomAt(dummy.position.z) * 0.6;   // a vegetação perde a cor rumo ao castelo
      matrices.push(dummy.matrix.clone());
      zs.push(dummy.position.z);
      parts.forEach((part, k) => colors[k].push(c.set(pick(part[1])).lerp(gloomTint, g).clone()));
      n++;
    }
    // uma InstancedMesh por faixa de z: a câmera e a sombra só desenham as faixas por perto
    for (const band of bandsByZ(zs, INSTANCE_BAND)) {
      parts.forEach(([geo], k) => {
        const im = new THREE.InstancedMesh(geo, mats[k], band.length);
        band.forEach((i, j) => { im.setMatrixAt(j, matrices[i]); im.setColorAt(j, colors[k][i]); });
        im.computeBoundingSphere();
        im.castShadow = shadow;
        im.receiveShadow = true;
        scene.add(im);
      });
    }
  }
  // sorteia um ponto perto do caminho (mais denso perto, mais raro longe); a distância
  // mínima varia a cada sorteio para não formar um corredor certinho
  function spot(minLat, maxLat, power = 1.4, onSand = true) {
    const s = range(-10, L + 10);
    const min = Math.max(0.5, minLat + range(-1.5, 2.5));
    const p = along(s, (rand() < 0.5 ? -1 : 1) * (min + rand() ** power * (maxLat - min)));
    const d = roadDist(p.x, p.z);
    if (d < min - 0.5 || riverDist(p.x, p.z) < 3.6 || !isFree(p.x, p.z)) return null;
    if (!onSand && isSand(p.x, p.z, d)) return null;
    p.y = heightAt(p.x, p.z, d);
    return p;
  }
  const placeAt = (o, p, scale, yOff = 0) => { o.position.set(p.x, p.y + yOff * scale, p.z); o.rotation.set(0, rand() * 6.3, 0); o.scale.setScalar(scale); };

  // ---------- regiões com marcos ----------
  // peças a partir de geometrias unitárias reaproveitadas (só a escala muda)
  const ub = new THREE.BoxGeometry(1, 1, 1), uc = new THREE.CylinderGeometry(0.5, 0.5, 1, 8), uc12 = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const blk = (parent, color, w, h, d, x, y, z, geo = ub) => { const m = mesh(geo, color, x, y, z, parent); m.scale.set(w, h, d); return m; };
  const deadTone = new THREE.Color(0x6e6878);
  const tone = (hex, g) => new THREE.Color(hex).lerp(deadTone, Math.min(1, g)).getHex();   // cor apagada pelas trevas
  function siteGroup(st) {
    const g = new THREE.Group();
    g.position.set(st.x, 0, st.z);
    faceTo(g, st.look.x, st.look.z);   // +z local olha para o caminho
    scene.add(g);
    g.updateMatrixWorld(true);
    return g;
  }
  const toWorld = (g, x, z, y = 0) => g.localToWorld(new THREE.Vector3(x, y, z));
  const solid = (g, x, z, r) => { const p = toWorld(g, x, z); obstacles.push({ x: p.x, z: p.z, r }); };
  // cópias instanciadas a partir de uma lista { p, ry, rx, rz, s }
  const inst = (parts, list, material = null, shadow = true) => {
    if (!list.length) return;
    let i = 0;
    instanced(parts, list.length, (o) => {
      const t = list[i++];
      if (!t) return false;
      o.position.copy(t.p);
      o.rotation.set(t.rx || 0, t.ry ?? rand() * 6.3, t.rz || 0);
      if (Array.isArray(t.s)) o.scale.set(...t.s); else o.scale.setScalar(t.s || 1);
      return true;
    }, shadow, material);
  };
  const whiteMat = (extra = {}) => new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, ...extra });

  // plaquinha de madeira com texto pintado (CanvasTexture pequena)
  function signTex(text, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.fillStyle = '#d2a465'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#7a4e26'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    x.fillStyle = '#4a2c14'; x.font = `bold ${Math.round(h * 0.62)}px sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const boardGeo = new THREE.PlaneGeometry(1, 1);
  function signPost(x, z, lookX, lookZ, text, width = 0.6) {
    const g = new THREE.Group();
    g.position.set(x, heightAt(x, z), z);
    faceTo(g, lookX, lookZ);
    scene.add(g);
    blk(g, darkWood, 0.14, 1.7, 0.14, 0, 0.85, 0);
    blk(g, wood, width + 0.12, 0.6, 0.1, 0, 1.45, 0.12);   // placa presa na frente do poste
    const face = new THREE.Mesh(boardGeo, new THREE.MeshLambertMaterial({ map: signTex(text, Math.round(64 * width / 0.48), 64) }));
    face.scale.set(width, 0.48, 1);
    face.position.set(0, 1.45, 0.176);
    g.add(face);
    obstacles.push({ x, z, r: 0.3 });
    blocked.push({ x, z, r: 0.9 });
  }

  // ----- 1. Vila: praça com fonte, feira e bandeirolas -----
  if (sites.praca) {
    const st = sites.praca, g = siteGroup(st);
    blk(g, 0xd8ccb4, 11, 0.1, 11, 0, 0.05, 0, uc12);   // chão de pedrinhas
    blk(g, 0xc4b79d, 11.6, 0.06, 11.6, 0, 0.03, 0, uc12);
    // fonte de pedra com duas bacias
    blk(g, 0x9d988f, 3, 0.6, 3, 0, 0.3, 0, uc12);
    blk(g, 0x5fb3e0, 2.6, 0.05, 2.6, 0, 0.6, 0, uc12);
    blk(g, 0x9d988f, 0.45, 1.5, 0.45, 0, 1.1, 0, uc);
    blk(g, 0xa9a399, 1.4, 0.25, 1.4, 0, 1.8, 0, uc12);
    blk(g, 0x7fc4ea, 1.15, 0.05, 1.15, 0, 1.93, 0, uc12);
    blk(g, 0xa9a399, 0.3, 0.4, 0.3, 0, 2.1, 0, uc);
    for (let k = 0; k < 4; k++) {   // biquinhas de água caindo
      const a = k * Math.PI / 2 + 0.4;
      blk(g, mat(0x9fd8ff, { transparent: true, opacity: 0.75 }), 0.08, 1.2, 0.08, Math.cos(a) * 0.62, 1.2, Math.sin(a) * 0.62, uc).castShadow = false;
    }
    solid(g, 0, 0, 1.7);
    // barraquinhas de feira com toldo listrado
    const awnings = [0xe8414a, 0x4f8fd6, 0xf5b942, 0x8bc34a];
    const goods = [0xe8414a, 0xff8c3a, 0xf5d142, 0x9fd04a, 0xb46ad9];
    [-2.3, -0.9, 0.9, 2.3].forEach((a, i) => {
      const s = new THREE.Group();
      s.position.set(Math.sin(a) * 4, 0, -Math.cos(a) * 4 * 0.95);
      g.add(s);
      faceTo(s, 0, 0);
      blk(s, wood, 1.9, 0.8, 0.8, 0, 0.5, 0.2);
      blk(s, darkWood, 2, 0.08, 0.9, 0, 0.92, 0.2);
      for (const sx of [-0.9, 0.9]) { blk(s, darkWood, 0.1, 2.2, 0.1, sx, 1.1, 0.55); blk(s, darkWood, 0.1, 2.5, 0.1, sx, 1.25, -0.2); }
      for (let k = 0; k < 5; k++) {   // listras do toldo
        const strip = blk(s, k % 2 ? 0xfff6e6 : awnings[i], 0.44, 0.06, 1.3, -0.88 + k * 0.44, 2.35, 0.3);
        strip.rotation.x = -0.28;
      }
      for (let k = 0; k < 4; k++) mesh(boulderGeo, goods[(i + k) % goods.length], -0.6 + k * 0.4, 1.05, 0.25 + (k % 2) * 0.15, s).scale.setScalar(0.28);
      blk(s, 0xb08850, 0.5, 0.35, 0.4, 0.95, 0.18, 0.9);   // caixote de frutas
      const w = toWorld(g, s.position.x, s.position.z);
      obstacles.push({ x: w.x, z: w.z, r: 1.1 });
    });
    // bandeirolas entre postes em volta da praça
    const posts = [0.8, 2.35, 3.95, 5.5].map((a) => [Math.cos(a) * 5.4, Math.sin(a) * 5.4]);
    const flags = [];
    posts.forEach(([x, z], k) => {
      blk(g, darkWood, 0.14, 3, 0.14, x, 1.5, z);
      blk(g, 0xe8414a, 0.3, 0.2, 0.3, x, 3.05, z, uc);
      const [x2, z2] = posts[(k + 1) % posts.length];
      const len = Math.hypot(x2 - x, z2 - z), ry = g.rotation.y + Math.atan2(x2 - x, z2 - z);
      for (let t = 0.06; t < 0.97; t += 0.075) {
        const p = toWorld(g, x + (x2 - x) * t, z + (z2 - z) * t, 2.85 - Math.sin(t * Math.PI) * 0.55);
        flags.push({ p, ry: ry + Math.PI / 2 });
      }
      const rope = blk(g, 0x5e3b1d, 0.03, 0.03, len, (x + x2) / 2, 2.6, (z + z2) / 2);
      rope.rotation.y = Math.atan2(x2 - x, z2 - z);
      rope.castShadow = false;
    });
    const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.17, 0, 0), new THREE.Vector3(0.17, 0, 0), new THREE.Vector3(0, -0.36, 0)]);
    flagGeo.computeVertexNormals();
    inst([flagGeo, [0xe8414a, 0xf5d142, 0x4f8fd6, 0x8bc34a, 0xff9ec7, 0xffffff]], flags, whiteMat({ side: THREE.DoubleSide }), false);
  }
  // plaquinha na entrada da vila
  { const p = along(5, -(ROAD + 1.8)), look = pointAt(0); signPost(p.x, p.z, look.x, look.z, 'Vila', 0.9); }

  // ----- 2. Fazendas: moinho, plantações, espantalho e carroça -----
  let millBlades = null;
  if (sites.moinho) {
    const g = siteGroup(sites.moinho);
    blk(g, stone, 3.9, 0.7, 3.9, 0, 0.35, 0, uc);
    mesh(new THREE.CylinderGeometry(1.3, 1.8, 5, 8), 0xf1e3c6, 0, 3, 0, g);
    mesh(new THREE.ConeGeometry(1.75, 1.9, 8), 0xa8432f, 0, 6.45, 0, g);
    blk(g, darkWood, 0.8, 1.3, 0.2, 0, 1.25, 1.75);
    blk(g, glow, 0.4, 0.45, 0.1, 0, 3.4, 1.53).castShadow = false;
    blk(g, darkWood, 0.35, 0.35, 0.9, 0, 4.9, 1.55, uc).rotation.x = Math.PI / 2;   // eixo
    millBlades = new THREE.Group();
    millBlades.position.set(0, 4.9, 2.05);
    g.add(millBlades);
    for (let k = 0; k < 4; k++) {   // pás de madeira com vela de pano
      const arm = new THREE.Group();
      arm.rotation.z = k * Math.PI / 2;
      millBlades.add(arm);
      blk(arm, darkWood, 0.14, 3.4, 0.1, 0, 1.75, 0);
      blk(arm, 0xf6eedc, 0.75, 2.5, 0.04, 0.45, 2.05, 0.04);
      for (const y of [1.1, 2, 2.9]) blk(arm, wood, 0.8, 0.06, 0.06, 0.45, y, 0.08);
    }
    blk(g, 0xd9c79e, 0.6, 0.5, 0.45, 1.1, 0.95, 1.6);   // sacos de farinha
    blk(g, 0xe3d3ab, 0.5, 0.45, 0.4, -1.05, 0.92, 1.65);
    solid(g, 0, 0, 2.1);
  }
  if (sites.campos) {
    const g = siteGroup(sites.campos);
    const wheat = [], cabbage = [];
    blk(g, 0x9a6a3a, 12.4, 0.06, 9.4, 0, 0.03, -0.3);   // terra arada
    for (let row = 0; row < 6; row++) {
      const z = -4.3 + row * 1.6, isWheat = row % 3 !== 1;
      blk(g, 0x86592e, 12, 0.14, 0.9, 0, 0.07, z);   // leira
      for (let x = -5.7; x <= 5.7; x += isWheat ? 0.3 : 0.75) {
        if (Math.abs(x - 1.5) < 0.6 && row === 2) continue;   // lugar do espantalho
        if (!isWheat) { cabbage.push({ p: toWorld(g, x + range(-0.06, 0.06), z, 0.12), s: range(0.8, 1.2), rx: range(-0.2, 0.2) }); continue; }
        for (const dz of [-0.22, 0.22]) wheat.push({ p: toWorld(g, x + range(-0.08, 0.08), z + dz, 0.12), s: range(0.85, 1.2) });
      }
    }
    const wheatGeo = mergeGeometries([-2, -1, 0, 1, 2].map((i) => mergeGeometries([
      new THREE.CylinderGeometry(0.025, 0.03, 0.75, 3).translate(0, 0.37, 0).toNonIndexed(),
      new THREE.CylinderGeometry(0.07, 0.04, 0.3, 4).translate(0, 0.86, 0).toNonIndexed(),   // espiga
    ]).rotateZ(i * 0.18).rotateX((i % 2) * 0.2).translate(i * 0.06, 0, (i % 2) * 0.05)));
    inst([wheatGeo, [0xe8c35a, 0xdcb44a, 0xf0d070, 0xe0bc52]], wheat, null, false);
    inst([new THREE.IcosahedronGeometry(0.28, 0).translate(0, 0.18, 0), [0x7fbf4a, 0x93cf5a, 0x6aa83f, 0xa5d64c]], cabbage);
    // espantalho
    const sc = new THREE.Group();
    sc.position.set(1.5, 0, -1.1);
    g.add(sc);
    blk(sc, darkWood, 0.12, 2.4, 0.12, 0, 1.2, 0);
    blk(sc, darkWood, 1.8, 0.1, 0.1, 0, 1.7, 0);
    blk(sc, 0x4f8fd6, 0.7, 0.8, 0.35, 0, 1.55, 0);   // camisa
    for (const sx of [-1, 1]) blk(sc, 0xe0c060, 0.25, 0.25, 0.25, sx * 0.95, 1.7, 0, uc);   // palha nas mangas
    mesh(new THREE.IcosahedronGeometry(0.3, 1), 0xe8d2a0, 0, 2.25, 0, sc);
    mesh(new THREE.ConeGeometry(0.45, 0.5, 8), 0x8a5a2e, 0, 2.6, 0, sc);
    blk(sc, 0x8a5a2e, 0.9, 0.05, 0.9, 0, 2.38, 0, uc12);
    // cerca nos três lados longe do caminho
    const corners = [[-6.4, 4.4], [-6.4, -5], [6.4, -5], [6.4, 4.4]].map(([x, z]) => toWorld(g, x, z));
    for (let k = 0; k < 3; k++) fence(corners[k].x, corners[k].z, corners[k + 1].x, corners[k + 1].z);
  }
  if (sites.carroca) {
    const st = sites.carroca, g = siteGroup(st);
    blk(g, wood, 2.4, 0.2, 1.4, 0, 0.75, 0);
    for (const sz of [-1, 1]) blk(g, darkWood, 2.4, 0.35, 0.08, 0, 0.98, sz * 0.68);
    for (const sz of [-1, 1]) {
      const wh = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 10), darkWood, -0.3, 0.55, sz * 0.8, g);
      wh.rotation.x = Math.PI / 2;
      blk(g, 0x3a3a3a, 0.2, 0.2, 0.16, -0.3, 0.55, sz * 0.8, uc).rotation.x = Math.PI / 2;
      const shaft = blk(g, wood, 1.6, 0.08, 0.08, 1.9, 0.5, sz * 0.4);
      shaft.rotation.z = -0.25;
    }
    blk(g, 0xe0c060, 2.1, 0.7, 1.25, 0, 1.2, 0);   // feno
    blk(g, 0xe8cc6a, 1.4, 0.45, 0.9, -0.1, 1.75, 0).rotation.y = 0.1;
    solid(g, 0, 0, 1.6);
    for (const [x, z] of [[-1.8, 1.4], [1.2, -1.6]]) { const p = toWorld(g, x, z); hay(p.x, p.z); }
  }

  // ----- 3. Ruínas antigas: arcos, colunas, muro com hera, torre caída e estátua -----
  const rubble = [], ivy = [];
  const ruinStone = (z) => tone(0xb5ad9e, gloomAt(z) * 0.6);
  function column(g, color, x, z, h, broken = false) {
    blk(g, color, 1, 0.3, 1, x, 0.15, z);
    blk(g, color, 0.75, h, 0.75, x, 0.3 + h / 2, z, uc);
    if (!broken) blk(g, color, 1, 0.3, 1, x, 0.45 + h, z);
    else blk(g, color, 0.7, 0.3, 0.7, x, 0.4 + h, z, uc).rotation.set(0.3, 0, 0.25);   // topo lascado
    solid(g, x, z, 0.6);
  }
  if (sites.arcos) {
    const st = sites.arcos, g = siteGroup(st), col = ruinStone(st.z);
    column(g, col, -3.2, 0, 3.2); column(g, col, -0.8, 0, 3.2);
    blk(g, col, 3.4, 0.6, 1, -2, 3.95, 0);   // arco inteiro
    column(g, col, 1.4, -0.3, 3.2); column(g, col, 3.8, -0.3, 1.1, true);
    const fallen = blk(g, col, 3.2, 0.55, 0.95, 2.9, 0.3, 1.6);   // verga caída
    fallen.rotation.set(0, 0.5, 0.12);
    column(g, col, -2.5, -3.2, 1.6, true); column(g, col, 0.3, -3.4, 0.8, true); column(g, col, 3, -3, 2.3, true);
    for (const [x, z, ry] of [[-1, -2, 0.4], [1.8, -4.2, 1.9]]) {   // tambores de coluna caídos
      const d = blk(g, col, 0.72, 1.1, 0.72, x, 0.36, z, uc);
      d.rotation.set(0, ry, Math.PI / 2);
    }
    for (let k = 0; k < 14; k++) rubble.push({ p: toWorld(g, range(-5, 5), range(-5, 4)), s: range(0.3, 0.8), rx: rand() * 3 });
    for (const [x, z, y] of [[-2, 0, 4.3], [-3.2, 0, 3.7], [1.4, -0.3, 3.7]]) ivy.push({ p: toWorld(g, x, z, y), s: [1.3, 0.5, 1.1] });
  }
  if (sites.muro) {
    const st = sites.muro, g = siteGroup(st), col = ruinStone(st.z);
    // muro com o topo irregular e buracos
    for (let x = -5.5; x <= 5.5; x += 1) {
      if (rand() < 0.15) continue;
      const h = range(0.6, 2.8);
      const b = blk(g, rand() < 0.5 ? col : tone(0xa39c8e, gloomAt(st.z) * 0.6), 1.02, h, 0.9, x, h / 2, -2.5);
      b.rotation.y = range(-0.04, 0.04);
      if (rand() < 0.6) ivy.push({ p: toWorld(g, x + range(-0.3, 0.3), -2.02, range(0.4, h)), s: [range(0.9, 1.4), range(1, 1.8), 0.35], ry: g.rotation.y });
      solid(g, x, -2.5, 0.6);
    }
    // torre de vigia caída: toco de pé, corpo deitado e telhado tombado
    mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.8, 8), col, -4, 0.9, 2.2, g);
    for (let k = 0; k < 4; k++) blk(g, col, 0.5, 0.45, 0.5, -4 + Math.cos(k * 1.6) * 1.1, 2, 2.2 + Math.sin(k * 1.6) * 1.1);
    const body = mesh(new THREE.CylinderGeometry(1.25, 1.35, 5, 8), col, -0.1, 1.25, 2.4, g);
    body.rotation.set(0, 0, Math.PI / 2 - 0.04);
    for (let k = 0; k < 3; k++) blk(g, 0x2a2433, 0.5, 0.16, 0.1, -1.6 + k * 1.4, 1.3, 3.68);   // seteiras
    for (const x of [-1.8, 1.6]) blk(g, tone(0x8f8778, gloomAt(st.z) * 0.6), 2.75, 0.3, 2.75, x, 1.25, 2.4, uc).rotation.z = Math.PI / 2 - 0.04;   // anéis de pedra
    const roof = mesh(new THREE.ConeGeometry(1.7, 2, 8), tone(0xa8432f, gloomAt(st.z) * 0.8), 3.6, 1.1, 3.4, g);
    roof.rotation.set(0.3, 0, -Math.PI / 2 - 0.35);
    for (const x of [-2.3, -0.1, 2.1]) solid(g, x, 2.4, 1.3);
    solid(g, -4, 2.2, 1.7); solid(g, 3.6, 3.4, 1.2);
    for (let k = 0; k < 16; k++) rubble.push({ p: toWorld(g, range(-6, 6), range(-1.5, 5.5)), s: range(0.3, 0.9), rx: rand() * 3 });
  }
  if (sites.estatua) {
    const st = sites.estatua, g = siteGroup(st), col = tone(0xcfc8ba, gloomAt(st.z) * 0.6);
    blk(g, ruinStone(st.z), 1.7, 1.1, 1.7, -1, 0.55, -0.6);
    blk(g, ruinStone(st.z), 1.9, 0.2, 1.9, -1, 1.15, -0.6);
    for (const sx of [-0.25, 0.25]) blk(g, col, 0.3, 0.4, 0.4, -1 + sx, 1.45, -0.6);   // só os pés ficaram
    // cavaleiro de pedra tombado no chão
    const kn = new THREE.Group();
    kn.position.set(1, 0.4, 0.7);
    kn.rotation.set(0, 0.6, Math.PI / 2);
    g.add(kn);
    blk(kn, col, 0.9, 1.5, 0.6, 0, 0, 0);
    for (const sx of [-0.22, 0.22]) blk(kn, col, 0.32, 0.9, 0.36, sx, -1.1, 0);
    blk(kn, col, 0.12, 1.8, 0.08, 0.6, 0.4, 0.35);   // espada
    blk(kn, col, 0.7, 0.8, 0.12, -0.2, 0.1, 0.36);    // escudo
    mesh(new THREE.IcosahedronGeometry(0.38, 1), col, 2.5, 0.35, 1.9, g);   // cabeça rolou para longe
    ivy.push({ p: toWorld(g, 1, 0.7, 0.8), s: [1.2, 0.4, 0.9] }, { p: toWorld(g, -1, -0.6, 1.25), s: [0.9, 0.35, 0.9] });
    solid(g, -1, -0.6, 1.3); solid(g, 1, 0.7, 1.1);
  }
  inst([boulderGeo, stoneGrays], rubble);
  inst([new THREE.IcosahedronGeometry(0.4, 0), [0x6f9a3c, 0x5e8a34, 0x7fa848]], ivy, null, false);

  // ----- 4. Terras do necromante: cemitério, obeliscos, espinhos de osso e caldeirão -----
  const iron = mat(0x2e2a36);
  const tomb = mergeGeometries([
    new THREE.BoxGeometry(0.55, 0.6, 0.14).translate(0, 0.3, 0),
    new THREE.CylinderGeometry(0.275, 0.275, 0.14, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.6, 0),
  ].map((g) => g.toNonIndexed()));
  if (sites.cemiterio) {
    const st = sites.cemiterio, g = siteGroup(st), gl = gloomAt(st.z);
    const W = 6, back = -5.5, front = 4.5, bars = [], stones = [];
    const barGeo = mergeGeometries([
      new THREE.BoxGeometry(0.07, 1.4, 0.07).translate(0, 0.7, 0).toNonIndexed(),
      new THREE.ConeGeometry(0.07, 0.22, 4).translate(0, 1.5, 0).toNonIndexed(),
    ]);
    const side = (x0, z0, x1, z1, gate = false) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ry = g.rotation.y + Math.atan2(x1 - x0, z1 - z0);
      for (let t = 0; t <= len; t += 0.45) {
        const x = x0 + (x1 - x0) * t / len, z = z0 + (z1 - z0) * t / len;
        if (gate && Math.abs(x) < 1.3) continue;
        bars.push({ p: toWorld(g, x, z), ry, rz: range(-0.05, 0.05) });
        if (Math.round(t / 0.45) % 4 === 0) solid(g, x, z, 0.4);
      }
      for (const y of [0.25, 1.2]) {
        if (gate) for (const sx of [-1, 1]) blk(g, iron, W - 1.3, 0.07, 0.07, sx * (W + 1.3) / 2, y, z0);
        else { const r = blk(g, iron, 0.07, 0.07, len, (x0 + x1) / 2, y, (z0 + z1) / 2); r.rotation.y = Math.atan2(x1 - x0, z1 - z0); }
      }
    };
    side(-W, back, W, back); side(-W, back, -W, front); side(W, back, W, front); side(-W, front, W, front, true);
    // portão de ferro entreaberto entre pilares de pedra
    const dark = tone(0x7a7784, gl * 0.5);
    for (const sx of [-1, 1]) {
      blk(g, dark, 0.6, 2.1, 0.6, sx * 1.6, 1.05, front);
      mesh(new THREE.ConeGeometry(0.45, 0.5, 4), dark, sx * 1.6, 2.35, front, g).rotation.y = Math.PI / 4;
      const leaf = new THREE.Group();
      leaf.position.set(sx * 1.3, 0, front);
      leaf.rotation.y = sx * 0.55;
      g.add(leaf);
      for (let k = 0; k < 4; k++) blk(leaf, iron, 0.06, 1.7, 0.06, -sx * (0.15 + k * 0.3), 0.9, 0);
      for (const y of [0.3, 1.5]) blk(leaf, iron, 1.2, 0.07, 0.07, -sx * 0.6, y, 0);
    }
    const arch = blk(g, iron, 3.2, 0.1, 0.1, 0, 2.3, front);
    arch.castShadow = false;
    mesh(new THREE.IcosahedronGeometry(0.2, 1), 0xeee6d4, 0, 2.5, front, g);   // caveira no alto do portão
    // mausoléu no fundo
    blk(g, dark, 4.2, 0.4, 3.6, 0, 0.2, -3.2);
    blk(g, tone(0x8a8794, gl * 0.4), 3.4, 2.6, 2.8, 0, 1.7, -3.4);
    const shape = new THREE.Shape([new THREE.Vector2(-2.1, 0), new THREE.Vector2(2.1, 0), new THREE.Vector2(0, 1.2)]);
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: false });
    roofGeo.translate(0, 0, -1.7);
    mesh(roofGeo, 0x4a4555, 0, 3, -3.2, g);
    for (const sx of [-1, 1]) column(g, dark, sx * 1.35, -1.75, 2.2);
    blk(g, 0x1e1a24, 1, 1.8, 0.1, 0, 1.3, -1.97);
    blk(g, crystalMat, 0.12, 1.6, 0.11, 0, 1.3, -1.95).castShadow = false;   // fresta de luz roxa na porta
    blk(g, crystalMat, 0.4, 0.4, 0.1, 0, 3.5, -1.5).rotation.z = Math.PI / 4;
    solid(g, 0, -3.2, 2.4);
    // lápides em fileiras tortas
    for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) {
      const x = -4.6 + k * 1.85;
      if (Math.abs(x) < 1 || rand() < 0.15) continue;
      stones.push({ p: toWorld(g, x + range(-0.2, 0.2), 2.6 - row * 1.7 + range(-0.2, 0.2)), ry: g.rotation.y + range(-0.25, 0.25), rz: range(-0.18, 0.18), s: range(0.9, 1.3) });
    }
    inst([barGeo, [0xffffff]], bars, new THREE.MeshLambertMaterial({ color: 0x2e2a36, flatShading: true }), false);
    inst([tomb, [0x8a8794, 0x9a97a4, 0x7a7784]], stones);
  }
  for (const name of ['obelisco1', 'obelisco2']) {
    const st = sites[name];
    if (!st) continue;
    const g = siteGroup(st);
    blk(g, 0x4a4555, 1.8, 0.5, 1.8, 0, 0.25, 0);
    blk(g, 0x55505f, 1.4, 0.3, 1.4, 0, 0.65, 0);
    const shaft = mesh(new THREE.CylinderGeometry(0.32, 0.6, 4.6, 4), 0x3d3848, 0, 3.1, 0, g);
    shaft.rotation.y = Math.PI / 4;
    mesh(new THREE.ConeGeometry(0.32, 0.7, 4), 0x3d3848, 0, 5.75, 0, g).rotation.y = Math.PI / 4;
    for (let k = 0; k < 4; k++) {   // runas brilhando nas faces
      const a = k * Math.PI / 2;
      const y = 1.8 + (k % 2) * 0.8, d = (0.6 - (y - 0.8) / 4.6 * 0.28) * 0.707 + 0.02;   // encostada na face afunilada
      const r = blk(g, crystalMat, 0.12, 0.5, 0.04, Math.sin(a) * d, y, Math.cos(a) * d);
      r.rotation.y = a; r.castShadow = false;
    }
    const top = mesh(crystalGeo, crystalMat, 0, 6.9, 0, g);
    top.scale.set(0.8, 1.4, 0.8);
    top.castShadow = false;
    floaters.push({ m: top, y: 6.9, ph: st.x });
    for (let k = 0; k < 6; k++) {   // cristais brotando na base
      const a = k * 1.05 + rand() * 0.5, cr = mesh(crystalGeo, crystalMat, Math.cos(a) * range(1.1, 1.6), 0, Math.sin(a) * range(1.1, 1.6), g);
      cr.scale.set(range(0.35, 0.6), range(0.9, 1.8), range(0.35, 0.6));
      cr.position.y = cr.scale.y * 0.3;
      cr.rotation.set(range(-0.4, 0.4), rand() * 3, range(-0.4, 0.4));
      cr.castShadow = false;
    }
    solid(g, 0, 0, 1.2);
  }
  // espinhos de osso saindo do chão, em touceiras
  const spikes = [];
  for (let tries = 0; tries < 400 && spikes.length < 110; tries++) {
    const p = spot(ROAD + 6, ROAD + 24, 1.2);
    if (!p || gloomAt(p.z) < 0.6 + rand() * 0.2) continue;
    for (let k = 3 + Math.floor(rand() * 3); k > 0; k--) {
      const q = p.clone().add(new THREE.Vector3(range(-1, 1), -0.1, range(-1, 1)));
      spikes.push({ p: q, s: [range(0.7, 1.1), range(0.6, 1.5), range(0.7, 1.1)], rx: range(-0.45, 0.45), rz: range(-0.45, 0.45) });
    }
    blocked.push({ x: p.x, z: p.z, r: 1.8 });
  }
  const spikeGeo = mergeGeometries([
    new THREE.ConeGeometry(0.22, 1.7, 5).translate(0, 0.85, 0).toNonIndexed(),
    new THREE.CylinderGeometry(0.3, 0.32, 0.18, 5).translate(0, 0.08, 0).toNonIndexed(),
  ]);
  inst([spikeGeo, [0xeee6d4, 0xdcd3bf, 0xcfc6b0]], spikes, whiteMat());
  // caldeirão borbulhando sobre o fogo
  const bubbles = [];
  if (sites.caldeirao) {
    const g = siteGroup(sites.caldeirao);
    const pot = mesh(new THREE.SphereGeometry(0.9, 10, 7, 0, Math.PI * 2, 0.9, Math.PI - 0.9), mat(0x2a2830, { side: THREE.DoubleSide }), 0, 1.25, 0, g);
    pot.castShadow = true;
    const rim = mesh(new THREE.TorusGeometry(0.71, 0.08, 5, 12), 0x3a3842, 0, 1.81, 0, g);
    rim.rotation.x = Math.PI / 2;
    const brew = mat(0x9dff6a, { emissive: 0x3fd13f, emissiveIntensity: 0.9 });
    const liquid = mesh(new THREE.CircleGeometry(0.7, 12), brew, 0, 1.73, 0, g);
    liquid.rotation.x = -Math.PI / 2;
    liquid.castShadow = false;
    for (let k = 0; k < 3; k++) { const a = k * 2.1; const leg = blk(g, 0x2a2830, 0.12, 0.9, 0.12, Math.cos(a) * 0.62, 0.4, Math.sin(a) * 0.62); leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); }
    for (const ry of [0.3, 1.9]) blk(g, 0x5a3a20, 0.18, 1.2, 0.18, 0, 0.1, 0, uc).rotation.set(Math.PI / 2, 0, ry);   // lenha
    for (let k = 0; k < 4; k++) {
      const f = mesh(new THREE.ConeGeometry(0.16, 0.5, 5), lantern, Math.cos(k * 1.6) * 0.25, 0.35, Math.sin(k * 1.6) * 0.25, g);
      f.castShadow = false;
    }
    const bubbleGeo = new THREE.IcosahedronGeometry(0.09, 0);
    for (let k = 0; k < 9; k++) {
      const b = mesh(bubbleGeo, brew, 0, 1.75, 0, g);
      b.castShadow = false;
      b.userData = { ph: k / 9, a: rand() * 6.3, r: range(0.1, 0.5) };
      bubbles.push(b);
    }
    for (const [x, z] of [[1.3, 0.6], [-1.2, 0.9]]) {   // caveiras
      mesh(new THREE.IcosahedronGeometry(0.2, 1), 0xeee6d4, x, 0.18, z, g);
      for (const ex of [-0.07, 0.07]) blk(g, 0x1e1a24, 0.06, 0.06, 0.04, x + ex, 0.22, z + 0.18).castShadow = false;
    }
    solid(g, 0, 0, 1.3);
  }

  // ----- 5. Caminho: placa com o número de cada fase e tochas nas regiões claras -----
  for (let ph = 1; ph <= PHASES; ph++) {
    const zn = zones.get(ph), side = zn ? (zn.type === 'plateau' ? -1 : 1) : (ph % 2 ? 1 : -1);
    const s = anchorS(ph) - 4, p = along(s, side * (ROAD + 1.4)), look = pointAt(s - 8);
    signPost(p.x, p.z, look.x, look.z, String(ph), ph > 9 ? 0.7 : 0.5);
  }
  const torches = [];
  for (let s = 18, k = 0; s < L - 40; s += 13, k++) {
    if (Math.abs(s - crossS) < 9) continue;
    const p = along(s, (k % 2 ? 1 : -1) * (ROAD + 1.7));
    if (gloomAt(p.z) > 0.3 || roadDist(p.x, p.z) < ROAD + 1.2 || !isFree(p.x, p.z, 0.6)) continue;
    p.y = heightAt(p.x, p.z);
    torches.push({ p, s: 1, ry: 0 });
    obstacles.push({ x: p.x, z: p.z, r: 0.3 });
    blocked.push({ x: p.x, z: p.z, r: 0.9 });
  }
  const torchGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.09, 1.7, 6).translate(0, 0.85, 0).toNonIndexed(),
    new THREE.CylinderGeometry(0.17, 0.1, 0.25, 6).translate(0, 1.8, 0).toNonIndexed(),
  ]);
  inst([torchGeo, [0x5e3b1d, 0x6b4423]], torches);
  inst([new THREE.ConeGeometry(0.13, 0.4, 5).translate(0, 2.1, 0), [0xffffff]], torches, lantern, false);

  const trunks = [0x7a4a26, 0x6a3f20, 0x8a5a30];
  const limes = biome.canopy;   // copas variam conforme o bioma sorteado
  // árvore redonda da referência: tronco fino e alto, copa de vários blocos facetados
  const roundTrunk = mergeGeometries([
    new THREE.CylinderGeometry(0.14, 0.24, 2.6, 6).translate(0, 1.3, 0),
    new THREE.CylinderGeometry(0.07, 0.1, 1.1, 5).rotateZ(0.7).translate(0.45, 2.1, 0),
  ].map((g) => g.toNonIndexed()));
  const roundTop = mergeGeometries([   // copas redondinhas (detalhe 1 = bolinhas facetadas)
    new THREE.IcosahedronGeometry(1.35, 1).translate(0, 3.2, 0),
    new THREE.IcosahedronGeometry(0.95, 1).translate(0.9, 2.8, 0.3),
    new THREE.IcosahedronGeometry(0.85, 1).translate(-0.8, 2.9, -0.4),
    new THREE.IcosahedronGeometry(0.8, 1).translate(0.1, 4.1, 0.2),
  ].map((g) => g.toNonIndexed()));
  const pineTrunk = new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6).translate(0, 0.6, 0);
  const pineTop = mergeGeometries([
    new THREE.ConeGeometry(1.15, 1.9, 7).translate(0, 1.7, 0),
    new THREE.ConeGeometry(0.85, 1.6, 7).translate(0, 2.6, 0),
  ].map((g) => g.toNonIndexed()));
  // dark: até onde a trevas permite (árvores vivas somem aos poucos; secas aparecem)
  const treePlace = (min, max, maxGloom = 1, minGloom = 0) => (o) => {
    const p = spot(min, max);
    if (!p) return false;
    const g = gloomAt(p.z);
    if (g > maxGloom || g < minGloom || (maxGloom === 1 && minGloom === 0 && rand() < g * 0.8)) return false;
    placeAt(o, p, range(0.75, 1.5));
    blocked.push({ x: p.x, z: p.z, r: 1.4 });
    return true;
  };
  instanced([[roundTrunk, trunks], [roundTop, limes]], 380, treePlace(ROAD + 3, ROAD + 50));
  instanced([[roundTrunk, trunks], [roundTop, [0xffb7d5, 0xf9a3c8, 0xffc9e0, 0xffd6e8]]], 70, treePlace(ROAD + 3, ROAD + 40, 0.3));   // cerejeiras
  instanced([[pineTrunk, trunks], [pineTop, biome.pine]], 120, treePlace(ROAD + 6, ROAD + 55));
  // árvores secas: tronco torto com galhos, sem folhas
  const deadTree = mergeGeometries([
    new THREE.CylinderGeometry(0.12, 0.26, 2.8, 5).translate(0, 1.4, 0),
    new THREE.CylinderGeometry(0.05, 0.09, 1.3, 4).rotateZ(0.9).translate(0.5, 2.3, 0),
    new THREE.CylinderGeometry(0.05, 0.08, 1.1, 4).rotateZ(-1).translate(-0.45, 2, 0.1),
    new THREE.CylinderGeometry(0.04, 0.07, 0.9, 4).rotateX(0.9).translate(0, 2.7, 0.35),
    new THREE.CylinderGeometry(0.03, 0.05, 0.6, 4).rotateZ(0.4).translate(0.95, 2.85, 0),
  ].map((g) => g.toNonIndexed()));
  instanced([deadTree, [0x5a4a42, 0x4a3e3a, 0x6a5a50]], 260, treePlace(ROAD + 2.5, ROAD + 45, 1, 0.3));

  const bushGeo = new THREE.IcosahedronGeometry(0.55, 1);
  instanced([bushGeo, limes], 340, (o) => { const p = spot(ROAD + 1.3, ROAD + 14, 2); if (!p) return false; placeAt(o, p, range(0.6, 1.3), 0.3); o.scale.y *= 0.75; return true; });

  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  instanced([rockGeo, [0xd1a06a, 0xc08c5a, 0xb9a48c]], 200, (o) => { const p = spot(ROAD + 1, ROAD + 45); if (!p) return false; placeAt(o, p, range(0.4, 1.8), 0.15); o.scale.y *= 0.6; o.rotation.x = rand(); return true; });
  instanced([rockGeo, [0xb9a48c, 0xc9b49a]], 280, (o) => { const p = spot(0, ROAD + 12, 1.5); if (!p) return false; placeAt(o, p, range(0.15, 0.4)); o.scale.y *= 0.5; return true; }, false);

  const tuftGeo = mergeGeometries([0, 1, 2].map((i) => new THREE.ConeGeometry(0.06, 0.5, 3).rotateZ((i - 1) * 0.35).translate((i - 1) * 0.08, 0.25, 0).toNonIndexed()));
  instanced([tuftGeo, biome.tuft], 7000, (o) => { const p = spot(0, ROAD + 32, 1.6, false); if (!p) return false; placeAt(o, p, range(0.7, 1.4)); return true; }, false);

  const flowerGeo = new THREE.IcosahedronGeometry(0.1, 0).translate(0, 0.25, 0);
  instanced([flowerGeo, [0xe8414a, 0xf5d142, 0xffffff, 0xb46ad9, 0xff8c3a, 0xff9ec7]], 1600, (o) => { const p = spot(1, ROAD + 22, 1.8, false); if (!p || gloomAt(p.z) > rand() * 0.6) return false; placeAt(o, p, range(0.8, 1.3)); return true; }, false);

  // ---------- terras do necromante: lápides, ossos e cogumelos brilhantes ----------
  const darkSpot = (min, max, minGloom) => { const p = spot(min, max, 1.5); return p && gloomAt(p.z) > minGloom + rand() * 0.25 ? p : null; };
  const cross = mergeGeometries([new THREE.BoxGeometry(0.12, 0.85, 0.1).translate(0, 0.42, 0), new THREE.BoxGeometry(0.5, 0.1, 0.1).translate(0, 0.6, 0)]);
  const tombPlace = (o) => { const p = darkSpot(ROAD + 1.5, ROAD + 16, 0.45); if (!p) return false; placeAt(o, p, range(0.8, 1.2)); o.rotation.z = range(-0.15, 0.15); return true; };
  instanced([tomb, [0x8a8794, 0x9a97a4, 0x7a7784]], 70, tombPlace);
  instanced([cross, [0x6a5a50, 0x7a7784]], 40, tombPlace);
  const bone = new THREE.CapsuleGeometry(0.05, 0.4, 2, 5).rotateZ(Math.PI / 2);
  instanced([bone, [0xeee6d4, 0xdcd3bf]], 220, (o) => { const p = darkSpot(0, ROAD + 12, 0.35); if (!p) return false; placeAt(o, p, range(0.8, 1.3), 0.05); return true; }, false);
  const shroom = mergeGeometries([
    new THREE.CylinderGeometry(0.04, 0.06, 0.25, 5).translate(0, 0.12, 0),
    new THREE.SphereGeometry(0.14, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.24, 0),
  ].map((g) => g.toNonIndexed()));
  const shroomMat = new THREE.MeshLambertMaterial({ color: 0xc89cff, emissive: 0x7a3fd1, emissiveIntensity: 0.9, flatShading: true });
  // em touceiras: alguns cogumelos juntos em volta de um ponto (e não espalhados como confete)
  let patchAt = null, patchLeft = 0;
  instanced([shroom, [0xffffff]], 150, (o) => {
    if (patchLeft <= 0) { patchAt = darkSpot(ROAD + 1, ROAD + 16, 0.5); patchLeft = 3 + Math.floor(rand() * 4); }
    if (!patchAt) { patchLeft = 0; return false; }
    patchLeft--;
    const p = patchAt.clone().add(new THREE.Vector3(range(-0.7, 0.7), 0, range(-0.7, 0.7)));
    placeAt(o, p, range(1, 2.2));
    return true;
  }, false, shroomMat);

  // ---------- nuvens ----------
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const parts = [];
    for (let k = 0; k < 5; k++) parts.push(new THREE.IcosahedronGeometry(range(1.5, 2.8), 0).translate(k * 2 - 4 + range(-0.5, 0.5), range(-0.4, 0.8), range(-1, 1)).toNonIndexed());
    const cloud = new THREE.Mesh(mergeGeometries(parts), cloudMat);
    cloud.position.set(range(-80, 80), range(22, 30), range(zTop, zBot));
    cloud.scale.y = 0.6;
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ---------- borboletas ----------
  const butterflies = [];
  const wingGeo = new THREE.CircleGeometry(0.16, 6).translate(0.15, 0, 0);
  for (let i = 0; i < 45; i++) {
    const home = spot(0, ROAD + 14, 1.6);
    if (!home || gloomAt(home.z) > 0.3) continue;
    const wingMat = new THREE.MeshLambertMaterial({ color: pick([0xffe066, 0xffffff, 0xffa3c8, 0x9fd8ff, 0xffb35c]), side: THREE.DoubleSide });
    const b = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, wingMat), right = new THREE.Mesh(wingGeo, wingMat);
    left.rotation.x = right.rotation.x = -Math.PI / 2;
    right.scale.x = -1;
    b.add(left, right);
    b.userData = { home, left, right, phase: rand() * 10, speed: range(0.6, 1.2) };
    scene.add(b);
    butterflies.push(b);
  }

  // ---------- fogos-fátuos: luzinhas que flutuam nas terras escuras ----------
  const wisps = [];
  const wispGeo = new THREE.IcosahedronGeometry(0.09, 0);
  const wispMats = [0x9fffb0, 0xc89cff].map((color) => new THREE.MeshBasicMaterial({ color }));
  for (let i = 0; i < 120; i++) {
    const home = darkSpot(0, ROAD + 16, 0.45);
    if (!home) continue;
    const w = new THREE.Mesh(wispGeo, pick(wispMats));
    w.userData = { home, phase: rand() * 10, speed: range(0.3, 0.8) };
    scene.add(w);
    wisps.push(w);
  }
  const cloudDay = new THREE.Color(0xffffff), cloudGloom = new THREE.Color(0x6e667e);

  // ---------- montanhas, colinas e pedras prontas (KayKit Medieval Hexagon, CC0) ----------
  // carregam sozinhas depois do resto do mapa; a grama da textura vem amarelada e é girada para verde
  const HEX = ['mountain_A', 'mountain_B', 'mountain_C', 'mountain_A_grass_trees',
    'mountain_B_grass_trees', 'mountain_C_grass_trees', 'hills_A_trees', 'hills_B_trees', 'hills_C_trees', 'rock_single_A', 'rock_single_C', 'rock_single_E'];
  const hexLoader = new GLTFLoader();
  Promise.all(HEX.map((n) => hexLoader.loadAsync(`assets/hex/${n}.gltf`).then((g) => [n, g.scene]))).then((list) => {
    const hex = Object.fromEntries(list);
    modelScenes = list.map(([, gltfScene]) => gltfScene);
    if (disposed) { releaseTrees(modelScenes); modelScenes = []; return; }
    const size = {};
    for (const [n, obj] of Object.entries(hex)) {
      obj.traverse((o) => { if (o.isMesh && o.material.map) o.material.map = recolor(o.material.map, { hue: biome.modelHue }); });
      size[n] = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    }
    // cópia com sombra; nas terras escuras perde a cor como o resto do mundo
    const place = (name, parent, x, y, z, sx, sy, rotY, gz) => {
      const m = hex[name].clone(true), g = gloomAt(gz);
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = true;
        if (g > 0.05) { o.material = o.material.clone(); o.material.color.lerp(gloomTint, g * 0.65); }
      });
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sx);
      m.rotation.y = rotY;
      parent.add(m);
      return m;
    };
    // longe do caminho: cordilheira de montanhas grandes e colinas com árvores enquadrando o mapa
    const farOk = (p, min) => roadDist(p.x, p.z) > min && riverDist(p.x, p.z) > 8 && p.distanceTo(castle.position) > 30
      && ![...zones.values()].some((z) => Math.hypot(z.center.x - p.x, z.center.z - p.z) < 16);
    const bigs = ['mountain_A', 'mountain_B', 'mountain_C', 'mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees'];
    for (let n = 0, tries = 0; n < 26 && tries < 400; tries++) {
      const p = along(range(-5, L + 5), (rand() < 0.5 ? -1 : 1) * range(ROAD + 26, ROAD + 52));
      if (!farOk(p, ROAD + 24)) continue;
      const s = range(6, 10);
      place(pick(bigs), scene, p.x, heightAt(p.x, p.z) - 0.4, p.z, s, s * range(0.9, 1.3), rand() * 6.3, p.z);
      n++;
    }
    const hills = ['hills_A_trees', 'hills_B_trees', 'hills_C_trees'];
    for (let n = 0, tries = 0; n < 22 && tries < 400; tries++) {
      const p = along(range(-5, L + 5), (rand() < 0.5 ? -1 : 1) * range(ROAD + 14, ROAD + 26));
      if (!farOk(p, ROAD + 12)) continue;
      const s = range(3.5, 5);
      place(pick(hills), scene, p.x, heightAt(p.x, p.z) - 0.3, p.z, s, s * 0.7, rand() * 6.3, p.z);
      n++;
    }
    // pedras grandes soltas perto do caminho (só visual, fora da área de luta)
    const rocks = ['rock_single_A', 'rock_single_C', 'rock_single_E'];
    for (let n = 0, tries = 0; n < 40 && tries < 300; tries++) {
      const p = along(range(0, L), (rand() < 0.5 ? -1 : 1) * range(ROAD + 6, ROAD + 14));
      if (!farOk(p, ROAD + 5.5)) continue;
      place(pick(rocks), scene, p.x, heightAt(p.x, p.z) - 0.05, p.z, range(4, 7), range(4, 8), rand() * 6.3, p.z);
      n++;
    }
  }).catch((e) => { if (!disposed) console.warn('modelos de montanha não carregaram', e); });

  let time = 0;
  function update(dt, viewZ = 0) {
    time += dt;
    for (const w of wisps) {
      const u = w.userData, t = time * u.speed + u.phase;
      w.position.set(u.home.x + Math.sin(t) * 1.4, u.home.y + 0.9 + Math.sin(t * 1.7) * 0.5, u.home.z + Math.cos(t * 0.8) * 1.4);
      w.scale.setScalar(0.8 + Math.sin(time * 5 + u.phase) * 0.35);
    }
    cloudMat.color.lerpColors(cloudDay, cloudGloom, gloomAt(viewZ));
    for (const b of butterflies) {   // voo em laço em volta de um ponto, batendo as asas
      const u = b.userData, t = time * u.speed + u.phase;
      b.position.set(u.home.x + Math.sin(t) * 2.2, u.home.y + 1 + Math.sin(t * 2.3) * 0.4, u.home.z + Math.sin(t * 0.7) * 2.2);
      b.rotation.y = Math.atan2(Math.cos(t) * 2.2, Math.cos(t * 0.7) * 1.5);
      const flap = Math.sin(time * 22 + u.phase) * 1.1;
      u.left.rotation.y = flap; u.right.rotation.y = -flap;
    }
    lantern.emissiveIntensity = 0.9 + Math.sin(time * 9) * 0.1 + Math.sin(time * 23) * 0.05;
    water.material.color.copy(riverTint).offsetHSL(0, 0, Math.sin(time * 1.5) * 0.02);
    for (const lake of lakes) lake.material.opacity = 0.8 + Math.sin(time * 1.8) * 0.04;
    for (const cl of clouds) { cl.position.x += dt * 0.8; if (cl.position.x > 90) cl.position.x = -90; }
    if (millBlades) millBlades.rotation.z -= dt * 0.9;
    for (const f of floaters) { f.m.position.y = f.y + Math.sin(time * 1.6 + f.ph) * 0.25; f.m.rotation.y += dt * 0.8; }
    for (const b of bubbles) {   // bolhas sobem, crescem e estouram
      const u = b.userData, t = (time * 0.7 + u.ph) % 1;
      b.position.set(Math.cos(u.a + t) * u.r, 1.75 + t * 0.9, Math.sin(u.a + t) * u.r);
      b.scale.setScalar(t < 0.85 ? 0.6 + t * 1.2 : 0.01);
    }
  }

  return { groundHeight, isShallow, zoneOf, nextWaypoint, canStep, gloomAt, L, pointAt, tangentAt, sideOf, along, anchorS, obstacles, update, seed: seedValue, biome: biome.name, dispose };
}
