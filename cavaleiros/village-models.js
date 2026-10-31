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
      case 'ico': g = new THREE.IcosahedronGeometry(1, 0); break;
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

function material(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true }));
  }
  return materials.get(color);
}

function part(group, kind, color, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry(kind), material(color));
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

function roundTower(g, x, z, radius, height, roofHeight) {
  part(g, 'cylinder', C.stone, [x, height / 2, z], [radius, height, radius]);
  part(g, 'cylinder', 0xb6ad9c, [x, 0.15, z], [radius + 0.08, 0.3, radius + 0.08]);
  part(g, 'cone', C.blue, [x, height + roofHeight / 2, z],
    [radius + 0.15, roofHeight, radius + 0.15]);
}

// casas, fazendas e castelo do mapa da campanha (modelos de primitivas, sem GLB)
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
    case 'farm': {
      // canteiro arado com fileiras de trigo e uma cerquinha (pegada 2x2 = 4 m)
      box(g, 0x7a5232, 0, 0.06, 0, 3.7, 0.12, 3.7);
      for (let i = 0; i < 5; i++) {
        const x = -1.4 + i * 0.7;
        box(g, 0x5e3c22, x, 0.15, 0, 0.32, 0.1, 3.3);
        for (let k = 0; k < 5; k++) part(g, 'cone', k % 2 ? 0xe2c04a : 0x9ccc4a, [x, 0.48, -1.3 + k * 0.65], [0.16, 0.6, 0.16]);
      }
      for (const z of [-1.9, 1.9]) box(g, C.beam, 0, 0.45, z, 3.9, 0.08, 0.08);
      for (const x of [-1.9, 1.9]) box(g, C.beam, x, 0.45, 0, 0.08, 0.08, 3.9);
      for (const x of [-1.9, 0, 1.9]) for (const z of [-1.9, 1.9]) box(g, C.beam, x, 0.35, z, 0.12, 0.7, 0.12);
      part(g, 'ico', 0xe2c04a, [1.45, 0.45, 1.45], [0.42, 0.45, 0.42]);
      break;
    }
    default: throw new RangeError(`Construção desconhecida: ${type}`);
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

// ponte de madeira ao longo de x: tabuado, guarda-corpo e pilares de pedra nas pontas
export function makeBridge(length, width) {
  const g = new THREE.Group();
  const n = Math.max(4, Math.round(length / 0.55));
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + (i + 0.5) * length / n;
    box(g, i % 2 ? C.wood : 0xd6b07e, x, 0.2, 0, length / n - 0.06, 0.16, width);
  }
  for (const z of [-width / 2 + 0.15, width / 2 - 0.15]) {
    box(g, C.beam, 0, -0.05, z, length, 0.3, 0.22);
    box(g, C.beam, 0, 1.0, z, length, 0.12, 0.12);
    for (let x = -length / 2 + 0.2; x <= length / 2 - 0.1; x += 1.6) box(g, C.beam, x, 0.6, z, 0.16, 0.9, 0.16);
  }
  for (const x of [-length / 2 + 2.2, length / 2 - 2.2]) for (const z of [-width / 2 + 0.3, width / 2 - 0.3]) {
    part(g, 'cylinder', 0x8f8a82, [x, -0.6, z], [0.32, 1.4, 0.32]);
  }
  for (const x of [-length / 2 + 0.6, length / 2 - 0.6]) box(g, 0xa8a399, x, 0.02, 0, 1.4, 0.32, width + 0.5);
  return g;
}
