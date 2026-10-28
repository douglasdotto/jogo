// Cenário low poly: estrada sinuosa, rio com ponte, vila, natureza e castelo no topo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// pontos (x, z) por onde a estrada passa, de baixo (z positivo) para cima
const ROUTE = [[0, 14], [2, 0], [8, -18], [4, -38], [-7, -56], [-10, -76], [-3, -96], [8, -114], [10, -134], [2, -152], [-8, -170], [-7, -190], [1, -208], [6, -228], [2, -246], [0, -264]];

export function createWorld(scene, ROAD, PHASES) {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // fixo: o mapa é sempre igual
  const range = (a, b) => a + (b - a) * rand();
  const pick = (list) => list[Math.floor(rand() * list.length)];

  // ---------- estrada ----------
  const curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
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
    const d = Math.hypot(x - zone.center.x, z - zone.center.z) + shore(zone, x, z);
    return -1.1 * (1 - THREE.MathUtils.smoothstep(d, 2.4, zone.radius + 0.7));
  };
  function groundHeight(x, z) {
    for (const zone of zones.values()) {
      if (zone.type === 'plateau') {
        const p = local(zone, { x, z });
        if (inRamp(p)) return (p.z + 9) / 2;
        if (Math.hypot(p.x, p.z) < zone.radius) return 3;
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

  // o caminho não aparece: perto dele o chão é plano, longe viram morros de borda irregular;
  // o rio cava um leito
  const noise = (x, z) => ((Math.sin(x * 0.13 + z * 0.05) + Math.sin(z * 0.17 - x * 0.07) + 1.5 * Math.sin((x + z) * 0.045)) / 3.5) * 0.5 + 0.5;
  const patch = (x, z) => ((Math.sin(x * 0.31 + z * 0.17) + Math.sin(z * 0.27 - x * 0.19) + Math.sin((x - z) * 0.11)) / 3) * 0.5 + 0.5;
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
  const grassA = new THREE.Color(0x9ccc4a), grassB = new THREE.Color(0x88bd3e), sandA = new THREE.Color(0xeac48a), sandB = new THREE.Color(0xdfb478),
    cliffA = new THREE.Color(0xdba468), cliffB = new THREE.Color(0xc98d55), bed = new THREE.Color(0xc9a46a),
    dry = new THREE.Color(0xa39a5c), necro = new THREE.Color(0x5e536e);
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
  const water = ribbon(riverPts, 6.5, 0, -0.25, flatMat(0x5fb3e0, { transparent: true, opacity: 0.88 }));
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

  // faces soltas (cada uma com sua cor) para o visual facetado de pedra
  function faceted(tris, colorOf) {
    const pos = [], col = [];
    for (const [a, b, cc] of tris) {
      c.set(colorOf(a, b, cc));
      for (const v of [a, b, cc]) { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return geo;
  }
  const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

  // rochedo de pedra: anéis de contorno irregular que afinam até o topo (altura 3); a frente tem o
  // recorte da escadaria (|x| <= 1.65, z de -9 a -3, igual à rampa da lógica)
  function rockMountain(group, gloom) {
    const SEG = 26, rings = [[4.85, 0], [4.55, 0.8], [4.4, 1.6], [4.25, 2.35], [4.05, 2.95]];
    const wob = rings.map((_, k) => Array.from({ length: SEG }, (_, i) => {
      const a = (i / SEG) * Math.PI * 2;
      return Math.sin(a * 3 + k * 0.6) * 0.3 + Math.sin(a * 7 + k) * 0.14 + range(-0.14, 0.14);
    }));
    const ring = rings.map(([r, y], k) => Array.from({ length: SEG }, (_, i) => {
      const a = (i / SEG) * Math.PI * 2, rr = r + wob[k][i];
      const v = new THREE.Vector3(Math.sin(a) * rr, y + (k > 0 && k < rings.length - 1 ? range(-0.18, 0.18) : 0), Math.cos(a) * rr);
      if (Math.abs(v.x) <= 1.8 && v.z < -2.9) v.y = Math.min(v.y, Math.max(0, (v.z + 9) / 2) - 0.05);
      return v;
    }));
    const tris = [];
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG, a = ring[k][i], b = ring[k][j], d = ring[k + 1][i], e = ring[k + 1][j];
      tris.push([a, b, d], [b, e, d]);
    }
    const dark = new THREE.Color(0x4e4858);
    const wall = faceted(tris, (a) => c.set(pick(stoneGrays)).multiplyScalar(0.82 + (a.y / 3) * 0.25).lerp(dark, gloom * 0.5).getHex());
    mesh(wall, rockMat, 0, 0, 0, group);
    // topo: leque rochoso com manchas de musgo, recortado onde chega a escadaria
    const top = ring.at(-1).map((v) => {
      const t = v.clone().setY(3);
      if (Math.abs(t.x) <= 1.65 && t.z < -3) t.z = -3;
      return t;
    });
    // dois anéis internos irregulares (em vez de um leque, que fica com cara de pizza)
    const inner = (k) => top.map((v) => v.clone().multiplyScalar(k * range(0.82, 1.15)).setY(3 + range(0, 0.1)));
    const mid = inner(0.62), core = inner(0.28), center = new THREE.Vector3(range(-0.3, 0.3), 3.06, range(-0.3, 0.3)), capTris = [];
    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      capTris.push([top[i], top[j], mid[i]], [top[j], mid[j], mid[i]], [mid[i], mid[j], core[i]], [mid[j], core[j], core[i]]);
      if (i % 2 === 0) capTris.push([core[i], core[(i + 2) % SEG], center], [core[i], core[j], core[(i + 2) % SEG]]);
    }
    const moss = new THREE.Color(0x86a860);
    mesh(faceted(capTris, () => (rand() < 0.35 ? c.copy(moss) : c.set(pick(stoneGrays)).multiplyScalar(1.05)).lerp(dark, gloom * 0.45).getHex()), rockMat, 0, 0, 0, group);

    // escadaria de lajes de pedra no lugar da rampa
    for (let i = 0; i < 12; i++) {
      const zc = -9 + 0.25 + i * 0.5, h = Math.max(0.12, (zc + 0.25 + 9) / 2);
      const step = mesh(new THREE.BoxGeometry(3.1 + range(-0.1, 0.1), h, 0.52), pick(stoneGrays), range(-0.04, 0.04), h / 2, zc, group);
      step.rotation.y = range(-0.03, 0.03);
    }
    // pedras grandes margeando a escada e no pé dela
    for (const sx of [-1, 1]) {
      for (let z = -8.6; z < -3.2; z += 1.15) {
        const s = range(0.55, 0.9), h = Math.max(0, (z + 9) / 2);
        const b = mesh(boulderGeo, pick(stoneGrays), sx * (1.95 + range(0, 0.2)), h * 0.7 + s * 0.35, z, group);
        b.scale.set(s, s * range(0.8, 1.3), s);
        b.rotation.set(rand() * 3, rand() * 3, 0);
      }
      const big = mesh(boulderGeo, pick(stoneGrays), sx * 2.6, 0.45, -9.4, group);
      big.scale.setScalar(range(1.1, 1.4));
    }
    // acampamento dos esqueletos no topo: pedras, ossos e estandarte roxo
    for (const [x, z] of [[-2.4, 1.6], [2.5, 0.6], [0.6, 2.7]]) {
      const b = mesh(boulderGeo, pick(stoneGrays), x, 3.25, z, group);
      b.scale.setScalar(range(0.7, 1.1));
      b.rotation.set(rand() * 3, rand() * 3, 0);
    }
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), 0x4a3a32, -1.4, 4.3, 2.2, group);
    const flag = mesh(new THREE.BoxGeometry(0.05, 0.9, 0.7), 0x5b3a7a, -1.4, 5.1, 2.6, group);
    flag.rotation.y = 0.2;
    for (let i = 0; i < 4; i++) mesh(new THREE.CapsuleGeometry(0.05, 0.35, 2, 5), 0xeee6d4, range(-1, 1.5), 3.1, range(-0.5, 2), group).rotation.set(Math.PI / 2, 0, rand() * 3);
  }

  // lago cavado no chão: a água fica no nível -0.2 e o fundo (heightAt/lakeDepth) desenha a margem
  function lake(zone, group, gloom) {
    const R = zone.radius + 1.6;
    const geo = new THREE.CircleGeometry(R, 48);
    geo.rotateX(-Math.PI / 2);
    const deep = new THREE.Color(0x2a7fa6), shallow = new THREE.Color(0x8fdde6), murky = new THREE.Color(0x3e5a5a);
    const col = [], p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      c.copy(deep).lerp(shallow, THREE.MathUtils.smoothstep(Math.hypot(p.getX(i), p.getZ(i)), 1.5, zone.radius + 0.3)).lerp(murky, gloom * 0.6);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const water = mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false }), 0, -0.2, 0, group);
    water.castShadow = false;
    lakes.push(water);
    const leaf = new THREE.Color(0x6fae46).lerp(murky, gloom * 0.5).getHex();
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
        const reed = mesh(reedGeo, 0x6f8f3e, x, -0.2 + h / 2, z, group);
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
    if (zone.type === 'plateau') rockMountain(group, gloomAt(zone.center.z));
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
  const cstone = 0x9a9488, red = 0xa8332f;
  for (const sx of [-1, 1]) {
    const tx = sx * (ROAD + 1.4);
    mesh(new THREE.CylinderGeometry(1.8, 2, 7, 10), cstone, tx, 3.5, 0, castle);
    mesh(new THREE.ConeGeometry(2.3, 3, 10), red, tx, 8.5, 0, castle);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 4), darkWood, tx, 10.8, 0, castle);
    mesh(new THREE.BoxGeometry(0.05, 0.6, 1), red, tx, 11.4, 0.5, castle);
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
  mesh(new THREE.ConeGeometry(5.5, 4, 4), 0x7d2a27, 0, 11, -12, castle).rotation.y = Math.PI / 4;
  blocked.push({ x: castle.position.x, z: castle.position.z, r: 26 });

  // ---------- natureza instanciada (muitas cópias baratas) ----------
  const dummy = new THREE.Object3D();
  // parts: [[geometria, cores], ...] — várias peças (ex.: tronco e copa) com a mesma posição
  const gloomTint = new THREE.Color(0x4f465e);
  function instanced(parts, count, place, shadow = true, material = null) {
    if (!Array.isArray(parts[0])) parts = [parts];
    const ims = parts.map(([geo]) => new THREE.InstancedMesh(geo, material || new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), count));
    let n = 0;
    for (let tries = 0; n < count && tries < count * 6; tries++) {
      if (!place(dummy)) continue;
      dummy.updateMatrix();
      const g = material ? 0 : gloomAt(dummy.position.z) * 0.6;   // a vegetação perde a cor rumo ao castelo
      ims.forEach((im, k) => { im.setMatrixAt(n, dummy.matrix); im.setColorAt(n, c.set(pick(parts[k][1])).lerp(gloomTint, g)); });
      n++;
    }
    for (const im of ims) {
      im.count = n;
      im.castShadow = shadow;
      im.receiveShadow = true;
      scene.add(im);
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

  const trunks = [0x8a6a4a, 0x7a5c3e, 0x9b8a7a];
  const limes = [0xa5d64c, 0x95c843, 0xb5de5a, 0x86bb3c, 0x9fd04a];
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
  instanced([[pineTrunk, trunks], [pineTop, [0x6aa83f, 0x5e9e3c, 0x77b347]]], 120, treePlace(ROAD + 6, ROAD + 55));
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
  instanced([tuftGeo, [0xa8d655, 0x98c94b, 0xb7e063, 0x8cbf42]], 7000, (o) => { const p = spot(0, ROAD + 32, 1.6, false); if (!p) return false; placeAt(o, p, range(0.7, 1.4)); return true; }, false);

  const flowerGeo = new THREE.IcosahedronGeometry(0.1, 0).translate(0, 0.25, 0);
  instanced([flowerGeo, [0xe8414a, 0xf5d142, 0xffffff, 0xb46ad9, 0xff8c3a, 0xff9ec7]], 1600, (o) => { const p = spot(1, ROAD + 22, 1.8, false); if (!p || gloomAt(p.z) > rand() * 0.6) return false; placeAt(o, p, range(0.8, 1.3)); return true; }, false);

  // ---------- terras do necromante: lápides, ossos e cogumelos brilhantes ----------
  const darkSpot = (min, max, minGloom) => { const p = spot(min, max, 1.5); return p && gloomAt(p.z) > minGloom + rand() * 0.25 ? p : null; };
  const tomb = mergeGeometries([
    new THREE.BoxGeometry(0.55, 0.6, 0.14).translate(0, 0.3, 0),
    new THREE.CylinderGeometry(0.275, 0.275, 0.14, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.6, 0),
  ].map((g) => g.toNonIndexed()));
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
    water.material.color.setHSL(0.57, 0.55, 0.56 + Math.sin(time * 1.5) * 0.02);
    for (const lake of lakes) lake.material.opacity = 0.8 + Math.sin(time * 1.8) * 0.04;
    for (const cl of clouds) { cl.position.x += dt * 0.8; if (cl.position.x > 90) cl.position.x = -90; }
  }

  return { groundHeight, isShallow, zoneOf, nextWaypoint, canStep, gloomAt, L, pointAt, tangentAt, sideOf, along, anchorS, obstacles, update };
}
