// Invocador: corpos low-poly da fada, do golem e do dragãozinho (sem GLB), no estilo dos bonecos KayKit:
// formas arredondadas/chanfradas, sombreado suave, cores sólidas e saturadas e silhueta legível de longe.
// As peças paradas de cada parte são mescladas numa geometria só, com cor por vértice (mais escura embaixo, como
// oclusão suave); geometrias e materiais são criados uma vez e compartilhados por todas as criaturas
// (userData.keep: os efeitos não os descartam).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SIDES = [-1, 1];
let summonParts = null;

// peças [geometria, cor, posição, escala (número ou [x, y, z]), rotação [x, y, z] (ordem YXZ)] → uma geometria com cor por vértice.
// cor null mantém a cor por vértice da própria peça (degradês). shade escurece a base de cada peça (0 = cor chapada).
function summonMerge(pieces, shade = 0.26) {
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(), c = new THREE.Color();
  const parts = pieces.map(([geo, color, pos = [0, 0, 0], scale = 1, rot = [0, 0, 0]]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    g.applyMatrix4(matrix.compose(V(...pos), quat.setFromEuler(euler.set(rot[0], rot[1], rot[2], 'YXZ')), V(...s)));
    const p = g.attributes.position, n = p.count, rgb = new Float32Array(n * 3), own = color === null ? g.attributes.color : null;
    g.computeBoundingBox();
    const y0 = g.boundingBox.min.y, dy = Math.max(1e-4, g.boundingBox.max.y - y0);
    if (!own) c.set(color);
    for (let i = 0; i < n; i++) {
      if (own) c.fromBufferAttribute(own, i);
      const f = 1 - shade + shade * 1.25 * ((p.getY(i) - y0) / dy);
      rgb[i * 3] = Math.min(1, c.r * f); rgb[i * 3 + 1] = Math.min(1, c.g * f); rgb[i * 3 + 2] = Math.min(1, c.b * f);
    }
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    return g;
  });
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}
// cilindro afinando de a até b (ossos das asas, antenas)
function summonRod(a, b, r0, r1 = r0) {
  const from = V(...a), dir = V(...b).sub(from), len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 6).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize()));
  return g.translate(from.x, from.y, from.z);
}
// forma plana com degradê de três cores pela distância à raiz (asas)
function summonGradientShape(shape, stops, reach) {
  const g = new THREE.ShapeGeometry(shape, 10), p = g.attributes.position, cs = stops.map((s) => new THREE.Color(s)), c = new THREE.Color(), rgb = [];
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.hypot(p.getX(i), p.getY(i)) / reach);
    if (t < 0.5) c.lerpColors(cs[0], cs[1], t / 0.5); else c.lerpColors(cs[1], cs[2], (t - 0.5) / 0.5);
    rgb.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  return g;
}
// brilho radial (aura da fada, coração do golem)
function summonGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function summonKit() {
  if (summonParts) return summonParts;
  const round = new THREE.IcosahedronGeometry(0.5, 3), dot = new THREE.SphereGeometry(0.5, 12, 8), gem = new THREE.OctahedronGeometry(0.5, 0);
  const box = new RoundedBoxGeometry(1, 1, 1, 2, 0.16), boxSoft = new RoundedBoxGeometry(1, 1, 1, 3, 0.3), block = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8), cone4 = new THREE.ConeGeometry(0.5, 1, 4), cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  const ink = 0x2a1830, white = 0xffffff, blush = 0xff8fb4;

  // ---------- fada: cabeçona, coque dourado, vestido em sino magenta, antenas de luz e asas de borboleta ----------
  const skin = 0xffd6bd, dress = 0xff3d9e, dressLight = 0xffa3d4, hair = 0xffc43a, hairLight = 0xffdc6e, light = 0xfff27a;
  const bell = new THREE.LatheGeometry([V(0, 0.17, 0), V(0.11, 0.16, 0), V(0.13, 0.07, 0), V(0.19, -0.06, 0), V(0.28, -0.18, 0), V(0.32, -0.25, 0), V(0.29, -0.28, 0), V(0, -0.28, 0)].map((v) => new THREE.Vector2(v.x, v.y)), 14);
  const fairy = [
    [round, skin, [0, 0.44, 0], [0.5, 0.47, 0.46]],
    [round, hair, [0, 0.5, -0.05], [0.55, 0.5, 0.48]],
    [round, hairLight, [0, 0.62, 0.1], [0.44, 0.17, 0.3], [-0.2, 0, 0]],
    [round, hair, [0, 0.78, -0.07], [0.26, 0.24, 0.26]],
    [dot, ink, [0, 0.335, 0.235], [0.05, 0.02, 0.02]],
    [round, dress, [0, 0.13, 0], [0.22, 0.24, 0.2]],
    [bell, dress, [0, 0, 0], 1],
    [cyl, 0xf0c040, [0.22, 0.02, 0.13], [0.025, 0.32, 0.025], [0.45, 0, -0.25]],
    [gem, light, [0.27, 0.18, 0.2], [0.13, 0.13, 0.08]],
  ];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    fairy.push([round, dressLight, [Math.sin(a) * 0.29, -0.25, Math.cos(a) * 0.29], [0.13, 0.07, 0.13]]);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    fairy.push([round, 0x8af0ff, [-0.18 + Math.cos(a) * 0.055, 0.66 + Math.sin(a) * 0.055, 0.13], [0.07, 0.07, 0.04]]);
  }
  fairy.push([round, light, [-0.18, 0.66, 0.15], 0.05]);
  for (const s of SIDES) fairy.push(
    [round, hair, [s * 0.23, 0.42, -0.03], [0.14, 0.32, 0.2]],
    [summonRod([s * 0.07, 0.7, 0], [s * 0.17, 0.95, -0.03], 0.016, 0.012), 0x8a5a2a],
    [round, light, [s * 0.17, 0.97, -0.03], 0.09],
    [dot, ink, [s * 0.095, 0.41, 0.215], [0.085, 0.12, 0.05]],
    [dot, white, [s * 0.095 - 0.02, 0.44, 0.24], [0.035, 0.04, 0.02]],
    [dot, blush, [s * 0.155, 0.35, 0.195], [0.075, 0.04, 0.03]],
    [round, skin, [s * 0.16, 0.08, 0.04], [0.075, 0.18, 0.075], [0, 0, s * 0.45]],
    [cyl, skin, [s * 0.06, -0.37, 0], [0.06, 0.2, 0.06]],
    [round, dress, [s * 0.06, -0.47, 0.03], [0.09, 0.07, 0.12]],
  );
  // asa de borboleta: parte de cima grande e de baixo menor, degradê branco → rosa → azul-claro
  const upper = new THREE.Shape().moveTo(0, 0).bezierCurveTo(0.08, 0.45, 0.42, 0.85, 0.76, 0.8).bezierCurveTo(0.98, 0.76, 0.96, 0.44, 0.72, 0.3).bezierCurveTo(0.46, 0.14, 0.2, 0.03, 0, 0);
  const lower = new THREE.Shape().moveTo(0, 0).bezierCurveTo(0.3, -0.02, 0.6, -0.2, 0.56, -0.44).bezierCurveTo(0.52, -0.62, 0.28, -0.6, 0.17, -0.4).bezierCurveTo(0.08, -0.24, 0.02, -0.1, 0, 0);
  const wingStops = [0xfff6fc, 0xff6cc8, 0x6fe6ff];
  const fairyWing = mergeGeometries([summonGradientShape(upper, wingStops, 1.05).rotateZ(0.12), summonGradientShape(lower, wingStops, 0.72).rotateZ(-0.08)]).scale(0.82, 0.82, 0.82);
  fairyWing.deleteAttribute('uv');

  // ---------- golem: ombros e punhos enormes, pernas curtas e grossas, cabeça afundada, pedra quente com musgo ----------
  const stone = 0x9e8c84, stoneLight = 0xc6b6a6, stoneDark = 0x5f514c, moss = 0x56b844, mossLight = 0x8fdc52, pink = 0xff4fc0, aqua = 0x4ff0ff;
  const golemTorso = [
    [box, stoneDark, [0, 0.12, -0.02], [0.86, 0.36, 0.6]],
    [boxSoft, stone, [0, 0.44, 0.04], [1.0, 0.52, 0.72]],
    [boxSoft, stone, [0, 0.94, 0], [1.5, 0.82, 0.96], [0.12, 0, 0]],
    [box, stoneLight, [0, 0.96, 0.43], [0.86, 0.5, 0.2], [0.12, 0, 0]],
    [boxSoft, stone, [0, 1.14, -0.3], [1.1, 0.56, 0.62], [-0.15, 0, 0]],
    [round, moss, [0.08, 1.4, -0.34], [0.86, 0.18, 0.52]],
    [box, stoneLight, [0, 1.33, 0.32], [0.5, 0.42, 0.44]],
    [box, stoneDark, [0, 1.48, 0.52], [0.58, 0.12, 0.13]],
    [box, stone, [0, 1.16, 0.42], [0.44, 0.14, 0.28]],
    [round, moss, [0, 1.56, 0.26], [0.46, 0.12, 0.4]],
    [round, moss, [-0.3, 0.32, 0.4], [0.34, 0.14, 0.06]],
  ];
  for (const s of SIDES) golemTorso.push(
    [box, stoneLight, [s * 0.8, 1.18, 0], [0.72, 0.62, 0.78], [0, 0, s * -0.15]],
    [round, moss, [s * 0.82, 1.5, 0], [0.72, 0.2, 0.78], [0, 0, s * -0.15]],
    [round, mossLight, [s * 0.74, 1.6, 0.1], [0.32, 0.12, 0.32]],
  );
  const golemGlow = [
    [gem, pink, [0, 0.98, 0.55], [0.32, 0.42, 0.2]],
    [gem, aqua, [-0.98, 1.78, -0.12], [0.26, 0.78, 0.26], [-0.15, 0, 0.35]],
    [gem, pink, [0.32, 1.66, -0.46], [0.22, 0.62, 0.22], [-0.55, 0, -0.25]],
  ];
  for (const s of SIDES) golemGlow.push([block, 0xd6ffff, [s * 0.12, 1.37, 0.545], [0.14, 0.1, 0.04]]);

  // ---------- dragãozinho: violeta de barriga creme, cabeçona, olhões, chifres creme e asas de membrana cor de fogo ----------
  const body = 0x8a5cf0, bodyLight = 0xae8cff, belly = 0xffe08a, bone = 0x55309e, horn = 0xfff0c4, spine = 0xff8a3d;
  const dragonBody = [
    [round, body, [0, 0, 0], [0.7, 0.72, 0.66]],
    [round, body, [0, -0.12, 0.02], [0.74, 0.56, 0.66]],
    [round, belly, [0, -0.06, 0.17], [0.5, 0.62, 0.42]],
    [round, body, [0, 0.28, 0.12], [0.36, 0.36, 0.34]],
    [cone4, spine, [0, 0.38, -0.12], [0.12, 0.2, 0.12], [-0.5, 0, 0]],
    [cone4, spine, [0, 0.22, -0.3], [0.13, 0.2, 0.13], [-0.9, 0, 0]],
    [cone4, spine, [0, 0.0, -0.37], [0.11, 0.18, 0.11], [-1.3, 0, 0]],
  ];
  for (const s of SIDES) dragonBody.push(
    [round, body, [s * 0.25, 0.02, 0.24], [0.15, 0.24, 0.15], [0.6, 0, s * 0.3]],
    [round, belly, [s * 0.28, -0.09, 0.33], [0.11, 0.08, 0.11]],
    [round, body, [s * 0.27, -0.24, 0.06], [0.3, 0.3, 0.32]],
    [round, belly, [s * 0.29, -0.4, 0.16], [0.19, 0.1, 0.23]],
  );
  const dragonHead = [
    [round, body, [0, 0.16, 0], [0.7, 0.62, 0.62]],
    [round, bodyLight, [0, 0.04, 0.27], [0.46, 0.3, 0.36]],
    [cone4, spine, [0, 0.46, -0.16], [0.09, 0.16, 0.09], [-0.6, 0, 0]],
  ];
  for (const s of SIDES) dragonHead.push(
    [dot, ink, [s * 0.08, 0.1, 0.44], [0.04, 0.03, 0.03]],
    [dot, white, [s * 0.16, 0.22, 0.24], [0.2, 0.24, 0.1], [0, s * 0.4, 0]],
    [dot, ink, [s * 0.17, 0.21, 0.28], [0.14, 0.18, 0.06], [0, s * 0.4, 0]],
    [dot, white, [s * 0.15, 0.27, 0.31], [0.05, 0.05, 0.02]],
    [dot, white, [s * 0.2, 0.16, 0.3], [0.025, 0.025, 0.015]],
    [dot, blush, [s * 0.24, 0.07, 0.2], [0.09, 0.05, 0.04], [0, s * 0.7, 0]],
    [cone6, horn, [s * 0.15, 0.48, -0.12], [0.1, 0.32, 0.1], [-0.6, 0, s * -0.3]],
    [cone4, spine, [s * 0.32, 0.22, -0.08], [0.08, 0.26, 0.05], [0, 0, s * -1.2]],
  );
  const dragonTail = [
    [round, body, [0, 0, -0.08], [0.38, 0.34, 0.42]],
    [round, body, [0, 0.04, -0.32], [0.27, 0.24, 0.34]],
    [round, body, [0, 0.1, -0.52], [0.18, 0.17, 0.28]],
    [cone4, spine, [0, 0.2, -0.28], [0.08, 0.14, 0.08], [-0.8, 0, 0]],
    [cone4, spine, [0, 0.13, -0.74], [0.32, 0.28, 0.07], [-Math.PI / 2, 0, 0]],
  ];
  // asa: membrana (no plano XZ, para trás é −z) com braço grosso na borda da frente e três dedos; borda recortada
  const wingShape = new THREE.Shape().moveTo(0, -0.05).lineTo(0.5, -0.14).lineTo(1.2, 0)
    .quadraticCurveTo(0.98, 0.14, 0.92, 0.42).quadraticCurveTo(0.68, 0.3, 0.55, 0.5).quadraticCurveTo(0.34, 0.3, 0.18, 0.42).quadraticCurveTo(0.06, 0.3, 0, 0.18).lineTo(0, -0.05);
  const dragonWing = [
    [summonGradientShape(wingShape, [0xff5a4a, 0xff8a3d, 0xffd25a], 1.2).rotateX(-Math.PI / 2), null],
    [summonRod([0, 0, 0.05], [0.5, 0, 0.14], 0.07, 0.055), bone],
    [summonRod([0.5, 0, 0.14], [1.22, 0, 0], 0.05, 0.016), bone],
    [summonRod([0.5, 0, 0.14], [0.92, 0, -0.42], 0.028, 0.012), bone],
    [summonRod([0.5, 0, 0.14], [0.55, 0, -0.5], 0.028, 0.012), bone],
    [summonRod([0.5, 0, 0.14], [0.18, 0, -0.42], 0.028, 0.012), bone],
    [cone4, horn, [0.52, 0.03, 0.2], [0.07, 0.14, 0.07], [0.6, 0, 0]],
  ];

  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  const glowMap = summonGlowTexture();
  summonParts = {
    solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
    membrane: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    lit: new THREE.MeshBasicMaterial({ vertexColors: true }),   // olhos e cristais acesos
    lightWing: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.86, depthWrite: false, side: THREE.DoubleSide }),
    fairyGlow: new THREE.SpriteMaterial({ map: glowMap, color: 0xff7ad0, opacity: 0.85, ...additive }),
    golemGlow: new THREE.SpriteMaterial({ map: glowMap, color: 0xff5ac8, opacity: 0.7, ...additive }),
    groundGlow: new THREE.MeshBasicMaterial({ map: glowMap, color: 0xff8ad8, opacity: 0.55, ...additive }),
    furyRing: new THREE.MeshBasicMaterial({ color: 0xff5ab0, opacity: 0.6, side: THREE.DoubleSide, ...additive }),
    furyShell: new THREE.MeshBasicMaterial({ color: 0xff7ac8, opacity: 0.16, ...additive }),
    ball: new THREE.IcosahedronGeometry(0.5, 1), ring: new THREE.RingGeometry(0.72, 1, 32).rotateX(-Math.PI / 2),
    plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    fairyBody: summonMerge(fairy), fairyWing,
    golemTorso: summonMerge(golemTorso), golemGlow: summonMerge(golemGlow, 0.35),
    golemLeg: summonMerge([[box, stoneDark, [0, -0.18, 0], [0.46, 0.42, 0.5]], [boxSoft, stone, [0, -0.46, 0.06], [0.62, 0.32, 0.74]]]),
    golemArm: summonMerge([
      [boxSoft, stone, [0, -0.22, 0], [0.5, 0.52, 0.52]],
      [boxSoft, stone, [0, -0.62, 0.04], [0.6, 0.5, 0.62]],
      [box, stoneDark, [0, -0.82, 0.06], [0.68, 0.14, 0.68]],
      [boxSoft, stoneLight, [0, -1.04, 0.06], [0.8, 0.56, 0.8]],
    ]),
    dragonBody: summonMerge(dragonBody), dragonHead: summonMerge(dragonHead), dragonTail: summonMerge(dragonTail),
    dragonJaw: summonMerge([[round, belly, [0, -0.04, 0.14], [0.34, 0.12, 0.28]]]),
    dragonWing: summonMerge(dragonWing, 0.12),
  };
  for (const value of Object.values(summonParts)) if (value?.isMaterial) value.userData.keep = true;
  for (const g of [round, dot, gem, box, boxSoft, block, cyl, cone4, cone6, bell]) g.dispose();   // só serviram de molde
  return summonParts;
}
// malha (ou grupo vazio, sem geometria) dentro de um grupo: posição e rotação [x, y, z]
function summonMesh(parent, geometry, material, pos = [0, 0, 0], rot) {
  const o = geometry ? new THREE.Mesh(geometry, material) : new THREE.Group();
  o.position.set(...pos);
  if (rot) o.rotation.set(...rot);
  if (geometry) o.castShadow = !material.transparent;
  parent.add(o);
  return o;
}
// brilho aditivo que sempre olha para a câmera
function summonSprite(parent, material, pos, size) {
  const s = new THREE.Sprite(material);
  s.position.set(...pos);
  s.scale.setScalar(size);
  s.userData.size = size;
  parent.add(s);
  return s;
}
// core: grupo que leva a aura da Fúria; legs/arms/wings: pivôs animados (userData.side = −1 esquerda, 1 direita)
const SUMMON_BODIES = {
  fairy(g, k, root) {
    const core = summonMesh(g, null);
    summonMesh(core, k.fairyBody, k.solid);
    const glow = summonSprite(core, k.fairyGlow, [0, 0.25, -0.05], 1.9);
    const groundGlow = summonMesh(root, k.plane, k.groundGlow, [0, 0.05, 0]);
    groundGlow.scale.setScalar(1.5);
    const wings = SIDES.map((side) => {
      const pivot = summonMesh(core, null, null, [side * 0.05, 0.2, -0.14]);
      pivot.scale.x = side;   // a esquerda é o espelho da direita
      pivot.userData.side = side;
      summonMesh(pivot, k.fairyWing, k.lightWing);
      return pivot;
    });
    return { core, wings, glow, groundGlow, hover: 1.1, shellY: 0.2, shellR: 0.75, auraR: 0.8 };
  },
  golem(g, k) {
    const hip = 0.62;
    g.scale.setScalar(1.1);
    const core = summonMesh(g, null, null, [0, hip, 0]);
    summonMesh(core, k.golemTorso, k.solid);
    summonMesh(core, k.golemGlow, k.lit).castShadow = false;
    const glow = summonSprite(core, k.golemGlow, [0, 0.98, 0.62], 0.9);
    const legs = SIDES.map((side) => summonMesh(g, k.golemLeg, k.solid, [side * 0.34, hip, 0]));
    const arms = SIDES.map((side) => summonMesh(core, k.golemArm, k.solid, [side * 1.02, 1.12, 0]));
    return { core, legs, arms, glow, hip, hover: 0, shellY: 0.9, shellR: 1.45, auraR: 1.4 };
  },
  dragon(g, k) {
    const core = summonMesh(g, null);
    summonMesh(core, k.dragonBody, k.solid);
    const head = summonMesh(core, null, null, [0, 0.42, 0.2]);
    summonMesh(head, k.dragonHead, k.solid);
    const jaw = summonMesh(head, k.dragonJaw, k.solid, [0, 0, 0.14]);
    const mouth = summonMesh(head, null, null, [0, 0.02, 0.48]);
    const tail = summonMesh(core, k.dragonTail, k.solid, [0, -0.18, -0.3]);
    const wings = SIDES.map((side) => {
      const pivot = summonMesh(core, k.dragonWing, k.membrane, [side * 0.24, 0.26, -0.1]);
      pivot.scale.x = side;
      pivot.userData.side = side;
      return pivot;
    });
    return { core, head, jaw, mouth, tail, wings, hover: 1.2, shellY: 0.15, shellR: 1.1, auraR: 1.0 };
  },
};

// monta a criatura: corpo em visual (grupo que flutua/pula), anel da Fúria em root (fica no chão) e brilho da Fúria no core
export function buildSummon(kind, root, visual) {
  const kit = summonKit(), parts = SUMMON_BODIES[kind](visual, kit, root);
  parts.aura = summonMesh(root, kit.ring, kit.furyRing, [0, 0.06, 0]);
  parts.shell = summonMesh(parts.core, kit.ball, kit.furyShell, [0, parts.shellY, 0]);
  parts.aura.visible = parts.shell.visible = false;
  parts.shell.userData.aura = true;
  return parts;
}
