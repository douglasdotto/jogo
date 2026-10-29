import * as THREE from 'three';

const geometries = new Map();
const materials = new Map();
const C = {
  stone: 0xd9d2c3, wood: 0xe8c99a, beam: 0x8a5a2e, dark: 0x553622,
  blue: 0x3d7be0, red: 0xd2553a, gold: 0xffd23a, gray: 0x9aa0a8,
};

function geometry(kind) {
  if (!geometries.has(kind)) {
    let g;
    switch (kind) {
      case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
      case 'cylinder': g = new THREE.CylinderGeometry(1, 1, 1, 12); break;
      case 'cone': g = new THREE.ConeGeometry(1, 1, 8); break;
      case 'crystal': g = new THREE.ConeGeometry(1, 1, 4); break;
      case 'ico': g = new THREE.IcosahedronGeometry(1, 0); break;
      case 'dodeca': g = new THREE.DodecahedronGeometry(1, 0); break;
      case 'circle': g = new THREE.CircleGeometry(1, 32); break;
      case 'ring': g = new THREE.RingGeometry(2.18, 2.6, 48); break;
      case 'triangle':
        g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([
          0, 0, 0, 0.7, -0.22, 0, 0, -0.45, 0,
        ], 3));
        g.computeVertexNormals();
        break;
      case 'roof': {
        // Prisma de duas águas, com base em y=0.
        const vertices = [
          [-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 1, -0.5],
          [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5],
        ];
        const faces = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2,
          1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
        g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(
          faces.flatMap(i => vertices[i]), 3));
        g.computeVertexNormals();
        break;
      }
      default: throw new RangeError(`Geometria desconhecida: ${kind}`);
    }
    geometries.set(kind, g);
  }
  return geometries.get(kind);
}

function material(color, emissive = 0, basic = false, opacity = 1) {
  const key = `${color}:${emissive}:${basic}:${opacity}`;
  if (!materials.has(key)) {
    const options = { color, side: THREE.DoubleSide };
    materials.set(key, basic
      ? new THREE.MeshBasicMaterial({ ...options, transparent: opacity < 1,
        opacity, depthWrite: false })
      : new THREE.MeshLambertMaterial({ ...options, emissive, flatShading: true }));
  }
  return materials.get(key);
}

function part(group, kind, color, position, scale, rotation = [0, 0, 0], mat) {
  const mesh = new THREE.Mesh(geometry(kind), mat || material(color));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = mesh.material.isMeshLambertMaterial === true;
  mesh.receiveShadow = mesh.castShadow;
  group.add(mesh);
  return mesh;
}

function box(g, color, x, y, z, w, h, d) {
  return part(g, 'box', color, [x, y, z], [w, h, d]);
}

function rod(g, color, a, b, radius = 0.08) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const mesh = part(g, 'cylinder', color,
    start.add(end).multiplyScalar(0.5).toArray(), [radius, delta.length(), radius]);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function flag(g, x, y, z, height = 1.6, color = C.blue) {
  rod(g, C.beam, [x, y, z], [x, y + height, z], 0.035);
  part(g, 'triangle', color, [x + 0.035, y + height - 0.06, z], [1, 1, 1]);
}

function battlements(g, radius, y, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count;
    part(g, 'box', C.stone, [Math.sin(angle) * radius, y, Math.cos(angle) * radius],
      [0.43, 0.5, 0.43], [0, angle, 0]);
  }
}

function roundTower(g, x, z, radius, height, roofHeight) {
  part(g, 'cylinder', C.stone, [x, height / 2, z], [radius, height, radius]);
  part(g, 'cylinder', 0xb6ad9c, [x, 0.15, z], [radius + 0.08, 0.3, radius + 0.08]);
  part(g, 'cone', C.blue, [x, height + roofHeight / 2, z],
    [radius + 0.15, roofHeight, radius + 0.15]);
}

function crate(g, x, y, z, size = 0.7) {
  box(g, C.wood, x, y + size / 2, z, size, size, size);
  for (const dx of [-0.36, 0.36]) {
    box(g, C.beam, x + dx * size, y + size / 2, z + size / 2 + 0.015,
      size * 0.12, size, 0.04);
  }
  box(g, C.beam, x, y + size * 0.5, z + size / 2 + 0.02, size, 0.09, 0.04);
}

export function makeBuilding(type) {
  const g = new THREE.Group();
  g.name = type;
  switch (type) {
    case 'castle':
      box(g, C.stone, 0, 0.2, 0, 8, 0.4, 8);
      box(g, C.stone, 0, 1.65, -3.15, 6.5, 2.8, 0.6);
      for (const x of [-3.15, 3.15]) {
        box(g, C.stone, x, 1.65, 0, 0.6, 2.8, 6.5);
        for (const z of [-3, 3]) roundTower(g, x, z, 0.65, 4.1, 1.25);
      }
      box(g, C.stone, 0, 1.65, 3.15, 5.2, 2.8, 0.6);
      box(g, C.dark, 0, 1.18, 3.49, 1.55, 2.1, 0.14);
      for (const x of [-0.5, 0, 0.5]) box(g, C.beam, x, 1.18, 3.58, 0.06, 2, 0.04);
      for (const y of [0.65, 1.6]) box(g, C.beam, 0, y, 3.61, 1.55, 0.12, 0.05);
      for (const p of [-2, -1, 0, 1, 2]) {
        box(g, C.stone, p, 3.23, -3.15, 0.5, 0.45, 0.6);
        box(g, C.stone, p, 3.23, 3.15, 0.5, 0.45, 0.6);
      }
      roundTower(g, 0, -0.4, 1.35, 4.9, 1.45);
      box(g, C.dark, 0, 3.75, 0.96, 0.42, 0.8, 0.08);
      flag(g, 0, 6.3, -0.4, 0.85, C.gold);
      break;
    case 'house':
      box(g, C.wood, 0, 1.1, 0, 3.65, 2.2, 3.65);
      for (const x of [-1.72, 1.72]) for (const z of [-1.72, 1.72]) {
        box(g, C.beam, x, 1.1, z, 0.19, 2.2, 0.19);
      }
      box(g, C.beam, 0, 1.9, 1.84, 3.65, 0.16, 0.12);
      part(g, 'roof', C.red, [0, 2.2, 0], [4, 1.3, 4]);
      box(g, 0xad9b8a, 1.05, 3, -0.7, 0.48, 1.5, 0.48);
      box(g, C.stone, 1.05, 3.76, -0.7, 0.62, 0.16, 0.62);
      box(g, C.dark, 0, 0.75, 1.86, 0.8, 1.5, 0.1);
      part(g, 'ico', C.gold, [0.24, 0.75, 1.94], [0.06, 0.06, 0.04]);
      box(g, C.blue, -1.12, 1.25, 1.86, 0.55, 0.6, 0.06);
      break;
    case 'storehouse':
      for (const x of [-1.65, 1.65]) for (const z of [-1.65, 1.65]) {
        box(g, C.beam, x, 1.15, z, 0.2, 2.3, 0.2);
      }
      box(g, C.wood, 0, 1, -1.7, 3.4, 2, 0.12);
      part(g, 'roof', C.beam, [0, 2.3, 0], [4, 0.95, 4]);
      for (let i = 0; i < 5; i++) {
        const row = i < 3 ? 0 : 1;
        const x = -1.1 + (i < 3 ? i : i - 2.5) * 0.45;
        rod(g, C.beam, [x, 0.24 + row * 0.41, -1.35],
          [x, 0.24 + row * 0.41, 0.6], 0.23);
        part(g, 'cylinder', C.wood, [x, 0.24 + row * 0.41, 0.61],
          [0.19, 0.025, 0.19], [Math.PI / 2, 0, 0]);
      }
      crate(g, 1, 0, -1);
      crate(g, 1, 0, 0, 0.8);
      part(g, 'ico', 0xc79c5b, [0.85, 0.4, 1.15], [0.5, 0.48, 0.43]);
      part(g, 'cylinder', C.dark, [0.85, 0.77, 1.15], [0.15, 0.12, 0.15]);
      part(g, 'ico', C.gold, [0.85, 0.86, 1.15], [0.17, 0.12, 0.17]);
      break;
    case 'barracks':
      box(g, C.stone, 0, 1.3, -0.35, 5.4, 2.6, 4.5);
      for (const x of [-2.55, 2.55]) box(g, C.beam, x, 1.3, 1.93, 0.22, 2.6, 0.2);
      box(g, C.beam, 0, 2.4, 1.93, 5.4, 0.2, 0.2);
      part(g, 'roof', 0xa8323a, [0, 2.6, -0.35], [6, 1.45, 5.3]);
      box(g, C.dark, 0, 1.05, 1.95, 1.2, 2.1, 0.15);
      for (const x of [-1.8, 1.8]) {
        box(g, C.blue, x, 1.75, 2.05, 0.55, 1.25, 0.05);
        box(g, C.gold, x, 1.75, 2.09, 0.13, 0.45, 0.03);
      }
      for (const x of [-1.2, 1.2]) box(g, C.beam, x, 0.55, 2.6, 0.15, 1.1, 0.18);
      box(g, C.beam, 0, 0.85, 2.6, 2.6, 0.16, 0.18);
      for (const x of [-0.9, -0.3, 0.3, 0.9]) {
        rod(g, C.beam, [x, 0.05, 2.6], [x, 1.85, 2.6], 0.035);
        part(g, 'cone', 0xb4b8bd, [x, 2, 2.6], [0.11, 0.3, 0.11]);
      }
      break;
    case 'tower':
      part(g, 'cylinder', C.stone, [0, 2.8, 0], [1.55, 5.6, 1.55]);
      part(g, 'cylinder', 0xb6ad9c, [0, 0.2, 0], [1.8, 0.4, 1.8]);
      part(g, 'cylinder', C.stone, [0, 5.55, 0], [1.75, 0.3, 1.75]);
      battlements(g, 1.65, 5.95, 12);
      part(g, 'cone', C.blue, [0, 6.9, 0], [1.55, 1.8, 1.55]);
      box(g, C.dark, 0, 4.25, 1.55, 0.42, 0.8, 0.08);
      break;
    case 'wall':
      box(g, C.stone, 0, 0.925, 0, 2, 1.85, 2);
      for (const x of [-0.75, 0, 0.75]) for (const z of [-0.75, 0.75]) {
        box(g, C.stone, x, 2.025, z, 0.5, 0.35, 0.5);
      }
      break;
    default: throw new RangeError(`Construção desconhecida: ${type}`);
  }
  return g;
}

export function makeScaffold(size) {
  if (![2, 4, 6, 8].includes(size)) throw new RangeError('Pegada inválida');
  const g = new THREE.Group();
  const half = size / 2 - 0.12;
  for (const x of [-half, half]) for (const z of [-half, half]) {
    box(g, C.beam, x, 1.25, z, 0.2, 2.5, 0.2);
  }
  for (const y of [0.65, 2.2]) for (const side of [-half, half]) {
    box(g, C.wood, 0, y, side, size - 0.2, 0.13, 0.13);
    box(g, C.wood, side, y, 0, 0.13, 0.13, size - 0.2);
  }
  for (const z of [-half, half]) {
    rod(g, C.beam, [-half, 0.2, z], [half, 2.35, z], 0.055);
  }
  for (let i = 0; i < size; i++) {
    box(g, C.wood, -size / 2 + 0.5 + i, 0.06, 0, 0.8, 0.12, size - 0.1);
  }
  return g;
}

export function makeTree(variant) {
  const g = new THREE.Group();
  const v = ((Math.trunc(variant) % 4) + 4) % 4;
  part(g, 'cylinder', C.beam, [0, 0.8, 0], [0.22, 1.6, 0.22]);
  if (v < 2) {
    for (let i = 0; i < 3; i++) {
      const radius = 1.25 - i * 0.3;
      part(g, 'cone', v === 0 ? 0x3f9a3a : 0x4fae3c,
        [0, 1.65 + i * 0.85 + v * 0.1, 0], [radius, 1.6, radius]);
    }
  } else {
    part(g, 'ico', v === 2 ? 0x5cbf3a : 0x4fae3c,
      [0, v === 2 ? 2.25 : 2.65, 0], [1.3, v === 2 ? 1.25 : 1.6, 1.3]);
  }
  return g;
}

export function makeRock(variant) {
  const g = new THREE.Group();
  const v = ((Math.trunc(variant) % 4) + 4) % 4;
  for (let i = 0; i < 2 + v % 2; i++) {
    const radius = i === 0 ? 0.72 : 0.46;
    const x = i === 0 ? -0.25 : 0.4;
    part(g, (i + v) % 2 ? 'ico' : 'dodeca', v % 2 ? 0xb4b8bd : C.gray,
      [x, 0.36, (i - 1) * 0.25], [radius, 0.36, radius], [0, v + i, 0]);
  }
  return g;
}

export function makeMine() {
  const g = new THREE.Group();
  part(g, 'dodeca', C.gray, [0, 0.85, 0], [1.65, 0.85, 1.65]);
  const gold = material(C.gold, 0x6a4a00);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    part(g, 'crystal', C.gold, [Math.sin(angle), 1.3 + (i % 2) * 0.15,
      Math.cos(angle)], [0.27, 0.9, 0.27],
    [Math.cos(angle) * 0.35, angle, -Math.sin(angle) * 0.35], gold);
  }
  return g;
}

export function makePortal() {
  const g = new THREE.Group();
  const bone = 0xf1e8d2;
  part(g, 'cylinder', 0x3b3346, [0, 0.16, 0], [2.5, 0.32, 2.5]);
  for (const x of [-1.85, 1.85]) {
    rod(g, bone, [x, 0.32, 0], [x, 2.4, 0], 0.18);
    part(g, 'ico', bone, [x, 2.4, 0], [0.27, 0.25, 0.27]);
  }
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 10;
    const b = (i + 1) * Math.PI / 10;
    rod(g, bone, [Math.cos(a) * 1.85, 2.4 + Math.sin(a) * 2.3, 0],
      [Math.cos(b) * 1.85, 2.4 + Math.sin(b) * 2.3, 0], 0.16);
  }
  for (const x of [-1.65, 1.65]) {
    part(g, 'ico', bone, [x, 3.5, 0.12], [0.43, 0.5, 0.36]);
    box(g, bone, x, 3.12, 0.22, 0.4, 0.27, 0.3);
    for (const dx of [-0.17, 0.17]) {
      part(g, 'ico', 0x3b3346, [x + dx, 3.55, 0.43], [0.12, 0.15, 0.06]);
    }
    box(g, 0x3b3346, x, 3.08, 0.38, 0.28, 0.045, 0.035);
  }
  part(g, 'circle', 0x9b5cff, [0, 2.35, 0], [1.62, 2.15, 1],
    [0, 0, 0], material(0x9b5cff, 0, true, 0.75)).name = 'swirl';
  part(g, 'ring', 0xb36bff, [0, 0.325, 0], [1, 1, 1],
    [-Math.PI / 2, 0, 0], material(0xb36bff, 0, true)).name = 'glow';
  return g;
}

export function makeFlag() {
  const g = new THREE.Group();
  flag(g, 0, 0, 0);
  return g;
}
