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
  function groundHeight(x, z) {
    for (const zone of zones.values()) if (zone.type === 'plateau') {
      const p = local(zone, { x, z });
      if (inRamp(p)) return (p.z + 9) / 2;
      if (Math.hypot(p.x, p.z) < zone.radius) return 3;
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
    if ([...zones.values()].some((zone) => Math.hypot(x - zone.center.x, z - zone.center.z) < 12)) h = 0;
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
    cliffA = new THREE.Color(0xdba468), cliffB = new THREE.Color(0xc98d55), bed = new THREE.Color(0xc9a46a);
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


  // ---------- mesas de arenito e lagos ----------
  const shrubGeo = new THREE.IcosahedronGeometry(0.65, 0), trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.4, 5);
  const crownGeo = new THREE.IcosahedronGeometry(1, 0), pebbleGeo = new THREE.DodecahedronGeometry(0.6, 0);
  const reedGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.9, 4), headGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.28, 5);
  const padGeo = new THREE.CircleGeometry(0.4, 9, 0.25, Math.PI * 2 - 0.5), plankGeo = new THREE.BoxGeometry(2, 0.16, 0.45);
  const lakes = [];
  for (const zone of zones.values()) {
    const group = new THREE.Group();
    group.position.copy(zone.center);
    group.rotation.y = Math.atan2(zone.fwd.x, zone.fwd.z);
    scene.add(group);
    if (zone.type === 'plateau') {
      // camadas facetadas; a abertura acompanha a rampa na borda do topo
      for (let layer = 0; layer < 4; layer++) {
        const positions = [], indices = [], r0 = 4.25 - layer * 0.06, r1 = layer === 3 ? 4 : r0 - 0.04;
        for (let i = 0; i <= 32; i++) {
          const a = i / 32 * Math.PI * 2;
          for (const [r, y] of [[r0, layer * 0.74], [r1, (layer + 1) * 0.74]]) {
            const edge = r + (y < 2.9 ? Math.sin(a * 5) * 0.08 + Math.sin(a * 9) * 0.04 : 0);
            const x = Math.sin(a) * edge, z = Math.cos(a) * edge;
            const rampY = Math.abs(x) <= 1.65 && z < -3 ? (z + 9) / 2 : 3;
            positions.push(x, Math.min(y, rampY), z);
          }
          if (i < 32) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals();
        mesh(geo, [0xc58a51, 0xe2b179, 0xce985d, 0xe9ba80][layer], 0, 0, 0, group);
      }
      const top = new THREE.CircleGeometry(4, 32); top.rotateX(-Math.PI / 2);
      const tp = top.attributes.position;
      for (let i = 0; i < tp.count; i++) if (Math.abs(tp.getX(i)) <= 1.65 && tp.getZ(i) < -3) tp.setZ(i, -3);
      top.computeVertexNormals(); mesh(top, 0x9ccc4a, 0, 3, 0, group);
      const ramp = new THREE.BufferGeometry();
      ramp.setAttribute('position', new THREE.Float32BufferAttribute([-1.5,0,-9, 1.5,0,-9, -1.5,3,-3, 1.5,3,-3, -1.5,0,-3, 1.5,0,-3],3));
      ramp.setIndex([0,2,1,1,2,3,0,4,2,1,3,5,4,5,3,4,3,2]); ramp.computeVertexNormals();
      mesh(ramp, 0xdfa164, 0, 0.015, 0, group);
      for (const [x,z] of [[-2,1.8],[2,1.8]]) {
        mesh(trunkGeo, 0x8a6a4a, x, 3.7, z, group);
        mesh(crownGeo, 0xa5d64c, x, 4.7, z, group);
        mesh(shrubGeo, 0x86bb3c, x * 0.7, 3.4, z + 0.6, group);
      }
    } else {
      mesh(new THREE.CylinderGeometry(6.1,6.3,0.12,24), 0xe4bd80, 0, 0, 0, group);
      const lake = mesh(new THREE.CircleGeometry(zone.radius,32), mat(0x74cddd,{transparent:true,opacity:0.8,side:THREE.DoubleSide}), 0,0.14,0,group);
      lake.rotation.x = -Math.PI / 2; lake.castShadow = false; lakes.push(lake);
      const deep = mesh(new THREE.CircleGeometry(3.2,24), mat(0x368faa,{side:THREE.DoubleSide}),0,0.15,0,group);
      deep.rotation.x = -Math.PI / 2; deep.castShadow = false;
      obstacles.push({x:zone.center.x,z:zone.center.z,r:3.2});
      for (let i=0;i<7;i++) {
        const a=i*0.83, x=Math.cos(a)*4.5,z=Math.sin(a)*4.5;
        const rock=mesh(pebbleGeo,0xc4ae8a,x,0.04,z,group); rock.scale.set(1,0.35,0.8);
        if (i%2===0) { const pad=mesh(padGeo,0x71ae46,x*0.8,0.18,z*0.8,group); pad.rotation.x=-Math.PI/2; pad.rotation.z=a; }
      }
      for (let i=0;i<18;i++) {
        const a=1.4+i*0.16,x=Math.cos(a)*5.6,z=Math.sin(a)*5.6;
        mesh(reedGeo,0x789844,x,0.5,z,group).rotation.z=range(-0.2,0.2);
        mesh(headGeo,0x8a623b,x,0.95,z,group);
      }
      for (let z=3.8;z<7;z+=0.48) mesh(plankGeo,0x9a6a36,0,0.18,z,group);
      for (const x of [-0.85,0.85]) for (const z of [4,6.7]) mesh(trunkGeo,0x6b4423,x,-0.15,z,group);
    }
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
    mesh(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), stone, 0, 0.17, 0, g);
    mesh(new THREE.BoxGeometry(w, hh, d), pick(walls), 0, hh / 2 + 0.3, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.BoxGeometry(0.16, hh, 0.16), darkWood, sx * w / 2, hh / 2 + 0.3, sz * d / 2, g);
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.35, 0), new THREE.Vector2(w / 2 + 0.35, 0), new THREE.Vector2(0, 1.5)]);
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
    roofGeo.translate(0, 0, -(d + 0.6) / 2);
    mesh(roofGeo, pick(roofs), 0, hh + 0.3, 0, g);
    mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), stone, w * 0.25, hh + 1.1, -d * 0.2, g);
    mesh(new THREE.BoxGeometry(0.65, 1.15, 0.08), darkWood, 0, 0.87, d / 2 + 0.03, g);
    for (const sx of [-1, 1]) {
      const win = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), glow, sx * w * 0.3, 0.3 + h * 0.6, d / 2 + 0.03, g);
      win.castShadow = false;
      mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), glow, sx * (w / 2 + 0.03), 0.3 + h * 0.6, 0, g).castShadow = false;
      if (two) mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), glow, sx * w * 0.3, 0.3 + h + 0.8, d / 2 + 0.03, g).castShadow = false;
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
    if (rand() < 0.3) { const [x, z] = around(p, 4.5); if (isFree(x, z, 1)) lamp(x, z); }
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
  function instanced(parts, count, place, shadow = true) {
    if (!Array.isArray(parts[0])) parts = [parts];
    const ims = parts.map(([geo]) => new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), count));
    let n = 0;
    for (let tries = 0; n < count && tries < count * 6; tries++) {
      if (!place(dummy)) continue;
      dummy.updateMatrix();
      ims.forEach((im, k) => { im.setMatrixAt(n, dummy.matrix); im.setColorAt(n, c.set(pick(parts[k][1]))); });
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
  const treePlace = (min, max) => (o) => { const p = spot(min, max); if (!p) return false; placeAt(o, p, range(0.75, 1.5)); blocked.push({ x: p.x, z: p.z, r: 1.4 }); return true; };
  instanced([[roundTrunk, trunks], [roundTop, limes]], 380, treePlace(ROAD + 3, ROAD + 50));
  instanced([[roundTrunk, trunks], [roundTop, [0xffb7d5, 0xf9a3c8, 0xffc9e0, 0xffd6e8]]], 70, treePlace(ROAD + 3, ROAD + 40));   // cerejeiras
  instanced([[pineTrunk, trunks], [pineTop, [0x6aa83f, 0x5e9e3c, 0x77b347]]], 120, treePlace(ROAD + 6, ROAD + 55));

  const bushGeo = new THREE.IcosahedronGeometry(0.55, 1);
  instanced([bushGeo, limes], 340, (o) => { const p = spot(ROAD + 1.3, ROAD + 14, 2); if (!p) return false; placeAt(o, p, range(0.6, 1.3), 0.3); o.scale.y *= 0.75; return true; });

  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  instanced([rockGeo, [0xd1a06a, 0xc08c5a, 0xb9a48c]], 200, (o) => { const p = spot(ROAD + 1, ROAD + 45); if (!p) return false; placeAt(o, p, range(0.4, 1.8), 0.15); o.scale.y *= 0.6; o.rotation.x = rand(); return true; });
  instanced([rockGeo, [0xb9a48c, 0xc9b49a]], 280, (o) => { const p = spot(0, ROAD + 12, 1.5); if (!p) return false; placeAt(o, p, range(0.15, 0.4)); o.scale.y *= 0.5; return true; }, false);

  const tuftGeo = mergeGeometries([0, 1, 2].map((i) => new THREE.ConeGeometry(0.06, 0.5, 3).rotateZ((i - 1) * 0.35).translate((i - 1) * 0.08, 0.25, 0).toNonIndexed()));
  instanced([tuftGeo, [0xa8d655, 0x98c94b, 0xb7e063, 0x8cbf42]], 7000, (o) => { const p = spot(0, ROAD + 32, 1.6, false); if (!p) return false; placeAt(o, p, range(0.7, 1.4)); return true; }, false);

  const flowerGeo = new THREE.IcosahedronGeometry(0.1, 0).translate(0, 0.25, 0);
  instanced([flowerGeo, [0xe8414a, 0xf5d142, 0xffffff, 0xb46ad9, 0xff8c3a, 0xff9ec7]], 1600, (o) => { const p = spot(1, ROAD + 22, 1.8, false); if (!p) return false; placeAt(o, p, range(0.8, 1.3)); return true; }, false);

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
    if (!home) continue;
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

  let time = 0;
  function update(dt) {
    time += dt;
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

  return { groundHeight, isShallow, zoneOf, nextWaypoint, canStep, L, pointAt, tangentAt, sideOf, along, anchorS, obstacles, update };
}
