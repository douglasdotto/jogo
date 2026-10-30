// Invocador: corpos low-poly da fada, do golem e do dragãozinho (sem GLB).
// As peças paradas de cada parte são mescladas numa geometria só, com cor por vértice; geometrias e materiais são
// criados uma vez e compartilhados por todas as criaturas (userData.keep: os efeitos não os descartam).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let summonParts = null;

// peças [geometria, cor, posição, escala (número ou [x, y, z]), rotação [x, y, z] (ordem YXZ)] → uma geometria com cor por vértice
function summonMerge(pieces) {
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler();
  const parts = pieces.map(([geo, color, pos = [0, 0, 0], scale = 1, rot = [0, 0, 0]]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    g.applyMatrix4(matrix.compose(V(...pos), quat.setFromEuler(euler.set(rot[0], rot[1], rot[2], 'YXZ')), V(...s)));
    const c = new THREE.Color(color), n = g.attributes.position.count, rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { rgb[i * 3] = c.r; rgb[i * 3 + 1] = c.g; rgb[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    return g;
  });
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  merged.computeBoundingSphere();
  return merged;
}
// cilindro afinando de a até b (ossos das asas)
function summonRod(a, b, r0, r1 = r0) {
  const from = V(...a), dir = V(...b).sub(from), len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 5).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize()));
  return g.translate(from.x, from.y, from.z);
}
// asa de luz da fada: forma plana com degradê da raiz (inner) até a ponta (outer)
function summonLightWing(shape, inner, outer, reach) {
  const g = new THREE.ShapeGeometry(shape, 6), p = g.attributes.position, a = new THREE.Color(inner), b = new THREE.Color(outer), c = new THREE.Color(), rgb = [];
  for (let i = 0; i < p.count; i++) { c.lerpColors(a, b, Math.min(1, Math.hypot(p.getX(i), p.getY(i)) / reach)); rgb.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  return g;
}
const SIDES = [-1, 1];

function summonKit() {
  if (summonParts) return summonParts;
  const ball = new THREE.IcosahedronGeometry(0.5, 1), round = new THREE.IcosahedronGeometry(0.5, 2), gem = new THREE.IcosahedronGeometry(0.5, 0);
  const rock = new THREE.DodecahedronGeometry(0.5, 0), block = new THREE.BoxGeometry(1, 1, 1), dot = new THREE.SphereGeometry(0.5, 8, 6);
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 6), cone4 = new THREE.ConeGeometry(0.5, 1, 4), cone5 = new THREE.ConeGeometry(0.5, 1, 5);
  const ink = 0x2a1830, white = 0xffffff, blush = 0xff9cbc;

  // fada: vestido de pétalas, cabeça grande com coque verde-água e flor, varinha de estrela
  const skin = 0xf6d2b8, petal = 0xff8ad8, petalLight = 0xffc4e2, hair = 0x5fd6c0;
  const fairy = [
    [ball, 0xfff0f6, [0, 0.06, 0], [0.2, 0.24, 0.17]],
    [round, skin, [0, 0.42, 0], [0.44, 0.42, 0.42]],
    [round, hair, [0, 0.49, -0.05], [0.48, 0.4, 0.44]],
    [ball, hair, [0, 0.58, 0.14], [0.16, 0.09, 0.12]],
    [ball, hair, [0, 0.7, -0.12], 0.2],
    [ball, 0xfff6a0, [0.16, 0.62, 0.08], 0.06],
    [dot, blush, [0, 0.325, 0.19], [0.035, 0.018, 0.02]],
    [cyl, 0xf0c040, [0.2, 0.0, 0.1], [0.022, 0.3, 0.022], [0.5, 0, -0.25]],
    [gem, 0xfff6a0, [0.24, 0.14, 0.17], 0.09],
  ];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU, b = a + TAU / 10;
    fairy.push([ball, petal, [Math.sin(a) * 0.12, -0.14, Math.cos(a) * 0.12], [0.17, 0.32, 0.08], [-0.55, a, 0]]);
    fairy.push([ball, petalLight, [Math.sin(b) * 0.08, -0.06, Math.cos(b) * 0.08], [0.14, 0.26, 0.07], [-0.4, b, 0]]);
  }
  for (let i = 0; i < 4; i++) fairy.push([ball, white, [0.16 + Math.cos(i * 1.57) * 0.05, 0.62 + Math.sin(i * 1.57) * 0.05, 0.07], [0.05, 0.05, 0.03]]);
  for (const s of SIDES) fairy.push(
    [cyl, skin, [s * 0.05, -0.36, 0], [0.05, 0.16, 0.05]],
    [ball, petal, [s * 0.05, -0.45, 0.02], [0.07, 0.05, 0.09]],
    [ball, skin, [s * 0.13, 0.04, 0.03], [0.06, 0.17, 0.06], [0, 0, s * 0.5]],
    [ball, hair, [s * 0.1, 0.56, 0.12], [0.18, 0.1, 0.14], [0.3, 0, s * 0.3]],
    [dot, ink, [s * 0.085, 0.41, 0.188], [0.075, 0.1, 0.05]],
    [dot, white, [s * 0.085 - 0.018, 0.44, 0.212], [0.03, 0.03, 0.02]],
    [dot, blush, [s * 0.13, 0.36, 0.16], [0.06, 0.035, 0.03]],
  );
  const upper = new THREE.Shape().moveTo(0, 0).quadraticCurveTo(0.12, 0.5, 0.42, 0.6).quadraticCurveTo(0.68, 0.62, 0.6, 0.36).quadraticCurveTo(0.42, 0.08, 0, 0);
  const lower = new THREE.Shape().moveTo(0, 0).quadraticCurveTo(0.3, -0.04, 0.4, -0.28).quadraticCurveTo(0.36, -0.44, 0.2, -0.34).quadraticCurveTo(0.05, -0.15, 0, 0);

  // golem: rocha arredondada com musgo, cristais e olhos acesos; pernas e braços à parte para andar e socar
  const stone = 0xa89c8c, stoneLight = 0xbcb2a2, stoneDark = 0x7a7068, moss = 0x6aae7a, pink = 0xff8ad8, aqua = 0x7ff0e0;
  const golemTorso = [
    [block, stoneDark, [0, 0.1, 0], [0.72, 0.3, 0.5]],
    [ball, stone, [0, 0.66, 0], [1.25, 0.95, 0.86]],
    [rock, stoneLight, [0, 1.26, 0.16], [0.8, 0.7, 0.66]],
    [block, stoneDark, [0, 1.42, 0.44], [0.6, 0.11, 0.14]],
    [ball, moss, [0, 1.58, 0.1], [0.52, 0.14, 0.46]],
    [ball, moss, [0.2, 0.36, 0.36], [0.22, 0.08, 0.12]],
    [rock, stoneDark, [-0.3, 0.42, 0.36], [0.2, 0.16, 0.12]],
    [rock, stoneDark, [0.34, 0.86, 0.3], [0.16, 0.14, 0.1]],
  ];
  for (const s of SIDES) golemTorso.push([ball, moss, [s * 0.44, 1.08, -0.02], [0.46, 0.16, 0.44]]);
  const golemGlow = [
    [gem, pink, [0, 0.76, 0.42], [0.16, 0.22, 0.08]],
    [cone5, pink, [0.28, 1.12, -0.3], [0.14, 0.38, 0.14], [-0.5, 0, -0.3]],
    [cone5, aqua, [-0.18, 1.08, -0.34], [0.12, 0.3, 0.12], [-0.6, 0, 0.35]],
    [cone5, pink, [0.02, 1.0, -0.42], [0.1, 0.24, 0.1], [-0.9, 0, 0]],
    [cone5, aqua, [0.5, 1.2, -0.08], [0.09, 0.22, 0.09], [0, 0, -0.4]],
    [cone5, pink, [-0.52, 1.18, -0.06], [0.08, 0.2, 0.08], [0, 0, 0.5]],
  ];
  for (const s of SIDES) golemGlow.push([block, 0x8ff4ff, [s * 0.15, 1.31, 0.46], [0.14, 0.1, 0.06]]);

  // dragãozinho: verde-água de barriga creme, cabeça grande, olhões, chifrinhos dourados, asas de membrana rosa
  const teal = 0x46b8a8, tealLight = 0x6cd0c0, cream = 0xffe6b0, plum = 0x8a3a6e, gold = 0xf0c040, membrane = 0xff9ccf;
  const dragonBody = [
    [round, teal, [0, 0, 0], [0.66, 0.6, 0.74]],
    [round, cream, [0, -0.06, 0.15], [0.48, 0.46, 0.5]],
    [cone4, plum, [0, 0.3, -0.08], [0.1, 0.16, 0.1], [-0.3, 0, 0]],
    [cone4, plum, [0, 0.22, -0.28], [0.09, 0.14, 0.09], [-0.8, 0, 0]],
    [ball, teal, [0, 0.26, 0.26], [0.3, 0.34, 0.3], [0.4, 0, 0]],
  ];
  for (const s of SIDES) dragonBody.push(
    [ball, teal, [s * 0.2, -0.26, 0.18], [0.18, 0.22, 0.2]],
    [ball, cream, [s * 0.2, -0.36, 0.24], [0.14, 0.07, 0.12]],
    [ball, teal, [s * 0.24, -0.22, -0.14], [0.24, 0.26, 0.28]],
    [ball, cream, [s * 0.25, -0.34, -0.08], [0.16, 0.08, 0.14]],
  );
  const dragonHead = [
    [round, teal, [0, 0.18, 0.06], [0.62, 0.54, 0.56]],
    [round, tealLight, [0, 0.08, 0.32], [0.4, 0.26, 0.32]],
    [cone4, plum, [0, 0.46, -0.06], [0.07, 0.12, 0.07], [-0.4, 0, 0]],
  ];
  for (const s of SIDES) dragonHead.push(
    [dot, ink, [s * 0.07, 0.15, 0.44], [0.04, 0.03, 0.03]],
    [dot, white, [s * 0.15, 0.27, 0.3], [0.15, 0.18, 0.08], [0, s * 0.35, 0]],
    [dot, ink, [s * 0.158, 0.26, 0.33], [0.1, 0.13, 0.05], [0, s * 0.35, 0]],
    [dot, white, [s * 0.135, 0.31, 0.355], [0.04, 0.04, 0.02]],
    [dot, blush, [s * 0.22, 0.1, 0.24], [0.08, 0.05, 0.04], [0, s * 0.6, 0]],
    [cone5, gold, [s * 0.13, 0.44, -0.02], [0.09, 0.24, 0.09], [-0.5, 0, s * -0.35]],
    [cone4, plum, [s * 0.29, 0.24, -0.02], [0.07, 0.2, 0.05], [0, 0, s * -1.1]],
  );
  const dragonTail = [
    [ball, teal, [0, 0, -0.12], [0.28, 0.26, 0.34]],
    [ball, teal, [0, 0.03, -0.34], [0.2, 0.18, 0.28]],
    [ball, teal, [0, 0.07, -0.52], [0.13, 0.12, 0.22]],
    [cone4, plum, [0, 0.16, -0.3], [0.06, 0.1, 0.06], [-0.6, 0, 0]],
    [cone4, plum, [0, 0.1, -0.7], [0.2, 0.22, 0.06], [-Math.PI / 2, 0, 0]],
  ];
  // asa: membrana (no plano XZ, para trás é −z) com ossos ameixa na borda da frente e dois dedos
  const wingShape = new THREE.Shape().moveTo(0, -0.08).lineTo(0.42, -0.12).lineTo(0.88, 0.02)
    .quadraticCurveTo(0.74, 0.12, 0.66, 0.26).quadraticCurveTo(0.52, 0.16, 0.4, 0.3).quadraticCurveTo(0.26, 0.18, 0.04, 0.22).lineTo(0, -0.08);
  const dragonWing = [
    [new THREE.ShapeGeometry(wingShape, 4).rotateX(-Math.PI / 2), membrane],
    [summonRod([0, 0, 0.08], [0.42, 0, 0.12], 0.04, 0.03), plum],
    [summonRod([0.42, 0, 0.12], [0.9, 0, -0.02], 0.03, 0.012), plum],
    [summonRod([0.42, 0, 0.12], [0.66, 0, -0.26], 0.018, 0.008), plum],
    [summonRod([0.42, 0, 0.12], [0.4, 0, -0.3], 0.018, 0.008), plum],
    [cone4, gold, [0.44, 0.02, 0.16], [0.05, 0.1, 0.05], [0.6, 0, 0]],
  ];

  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  summonParts = {
    solid: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    membrane: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
    lit: new THREE.MeshBasicMaterial({ vertexColors: true }),   // olhos e cristais acesos
    lightWing: new THREE.MeshBasicMaterial({ vertexColors: true, opacity: 0.6, side: THREE.DoubleSide, ...additive }),
    halo: new THREE.MeshBasicMaterial({ color: 0xff9ce0, opacity: 0.15, ...additive }),
    furyRing: new THREE.MeshBasicMaterial({ color: 0xff5ab0, opacity: 0.6, side: THREE.DoubleSide, ...additive }),
    furyShell: new THREE.MeshBasicMaterial({ color: 0xff7ac8, opacity: 0.16, ...additive }),
    ball, ring: new THREE.RingGeometry(0.72, 1, 32).rotateX(-Math.PI / 2),
    fairyBody: summonMerge(fairy),
    fairyUpper: summonLightWing(upper, 0xffb8dc, 0xb8fff0, 0.7), fairyLower: summonLightWing(lower, 0xffb8dc, 0xb8fff0, 0.45),
    golemTorso: summonMerge(golemTorso), golemGlow: summonMerge(golemGlow),
    golemLeg: summonMerge([[block, stoneDark, [0, -0.2, 0], [0.4, 0.36, 0.42]], [block, 0x6a6058, [0, -0.41, 0.06], [0.48, 0.18, 0.54]]]),
    golemArm: summonMerge([
      [rock, stone, [0, 0, 0], 0.5], [ball, moss, [0, 0.2, 0], [0.36, 0.12, 0.36]],
      [block, stoneDark, [0, -0.34, 0], [0.3, 0.42, 0.32]], [rock, stoneLight, [0, -0.74, 0.04], [0.54, 0.5, 0.54]],
    ]),
    dragonBody: summonMerge(dragonBody), dragonHead: summonMerge(dragonHead), dragonTail: summonMerge(dragonTail),
    dragonJaw: summonMerge([[ball, cream, [0, -0.02, 0.14], [0.3, 0.1, 0.26]]]),
    dragonWing: summonMerge(dragonWing),
  };
  for (const value of Object.values(summonParts)) if (value?.isMaterial) value.userData.keep = true;
  for (const g of [round, gem, rock, block, dot, cyl, cone4, cone5]) g.dispose();   // só serviram de molde
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
// core: grupo que leva a aura da Fúria; legs/arms/wings: pivôs animados (userData.side = −1 esquerda, 1 direita)
const SUMMON_BODIES = {
  fairy(g, k) {
    const core = summonMesh(g, null);
    summonMesh(core, k.fairyBody, k.solid);
    summonMesh(core, k.ball, k.halo, [0, 0.2, 0]).scale.setScalar(0.95);
    const wings = SIDES.map((side) => {
      const pivot = summonMesh(core, null, null, [side * 0.04, 0.16, -0.12]);
      pivot.scale.x = side;   // a esquerda é o espelho da direita
      pivot.userData.side = side;
      summonMesh(pivot, k.fairyUpper, k.lightWing, [0, 0, 0], [0, 0, 0.15]);
      summonMesh(pivot, k.fairyLower, k.lightWing, [0, -0.02, 0], [0, 0, -0.1]);
      return pivot;
    });
    return { core, wings, hover: 1.15, shellY: 0.2, shellR: 0.65, auraR: 0.7 };
  },
  golem(g, k) {
    const core = summonMesh(g, null, null, [0, 0.5, 0]);
    summonMesh(core, k.golemTorso, k.solid);
    summonMesh(core, k.golemGlow, k.lit).castShadow = false;
    const legs = SIDES.map((side) => summonMesh(g, k.golemLeg, k.solid, [side * 0.26, 0.5, 0]));
    const arms = SIDES.map((side) => summonMesh(core, k.golemArm, k.solid, [side * 0.66, 1.0, 0]));
    return { core, legs, arms, hover: 0, shellY: 0.7, shellR: 1.25, auraR: 1.2 };
  },
  dragon(g, k) {
    const core = summonMesh(g, null);
    summonMesh(core, k.dragonBody, k.solid);
    const head = summonMesh(core, null, null, [0, 0.4, 0.34]);
    summonMesh(head, k.dragonHead, k.solid);
    const jaw = summonMesh(head, k.dragonJaw, k.solid, [0, 0.02, 0.18]);
    const mouth = summonMesh(head, null, null, [0, 0.06, 0.5]);
    const tail = summonMesh(core, k.dragonTail, k.solid, [0, -0.04, -0.34]);
    const wings = SIDES.map((side) => {
      const pivot = summonMesh(core, k.dragonWing, k.membrane, [side * 0.24, 0.24, -0.02]);
      pivot.scale.x = side;
      pivot.userData.side = side;
      return pivot;
    });
    return { core, head, jaw, mouth, tail, wings, hover: 1.2, shellY: 0.15, shellR: 1.05, auraR: 0.9 };
  },
};

// monta a criatura: corpo em visual (grupo que flutua/pula), anel da Fúria em root (fica no chão) e brilho da Fúria no core
export function buildSummon(kind, root, visual) {
  const kit = summonKit(), parts = SUMMON_BODIES[kind](visual, kit);
  parts.aura = summonMesh(root, kit.ring, kit.furyRing, [0, 0.06, 0]);
  parts.shell = summonMesh(parts.core, kit.ball, kit.furyShell, [0, parts.shellY, 0]);
  parts.aura.visible = parts.shell.visible = false;
  parts.shell.userData.aura = true;
  return parts;
}
