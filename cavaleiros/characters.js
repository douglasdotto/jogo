// Bonecos novos montados com peças dos modelos KayKit: todos usam o mesmo esqueleto de animação,
// então dá para trocar cabeça, chapéu, capa e arma entre eles, mudar as cores e pôr acessórios.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// receitas: base = modelo de partida; hide = peças da base que somem; add = peças de outros modelos;
// paint = mudança de cor por peça (hue gira o tom, tint pinta por cima mantendo a sombra);
// extras = acessórios feitos aqui, presos a um osso
export const CHARACTERS = [
  {
    id: 'druida', name: 'Druida', desc: 'Guardião da floresta com cajado de galhos.', color: ['#a8e07a', '#5a9e3a'],
    base: 'Rogue',
    hide: ['Knife', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable', 'Rogue_Cape'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }, { from: 'Mage', part: '2H_Staff' }],
    paint: {
      Rogue_Body: { tint: '#9b7a4a', amount: 0.55 }, Rogue_ArmLeft: { tint: '#9b7a4a', amount: 0.55 }, Rogue_ArmRight: { tint: '#9b7a4a', amount: 0.55 },
      Rogue_LegLeft: { hue: -40 }, Rogue_LegRight: { hue: -40 },
      Mage_Cape: { tint: '#5fae3e', amount: 0.85 }, '2H_Staff': { tint: '#8a5a2e', amount: 0.6 },
    },
    extras: [{ type: 'antlers', bone: 'head' }, { type: 'wreath', bone: 'head' }],
  },
  {
    id: 'necromante', name: 'Necromante', desc: 'Mago esqueleto que brinca com magia verde.', color: ['#c9a3ff', '#6b3fa0'],
    base: 'Mage',
    hide: ['Mage_Head', 'Mage_Hat', 'Spellbook', 'Spellbook_open', '1H_Wand'],
    add: [
      { from: 'Skeleton_Mage', part: 'Skeleton_Mage_Skull' }, { from: 'Skeleton_Mage', part: 'Skeleton_Mage_Jaw' },
      { from: 'Skeleton_Mage', part: 'Skeleton_Mage_Eyes' }, { from: 'Skeleton_Mage', part: 'Skeleton_Mage_Hat' },
    ],
    paint: {
      Mage_Body: { tint: '#4a3366', amount: 0.8 }, Mage_ArmLeft: { tint: '#4a3366', amount: 0.8 }, Mage_ArmRight: { tint: '#4a3366', amount: 0.8 },
      Mage_LegLeft: { tint: '#2e2240', amount: 0.8 }, Mage_LegRight: { tint: '#2e2240', amount: 0.8 },
      Mage_Cape: { tint: '#6fe08a', amount: 0.75 }, '2H_Staff': { tint: '#e8e0c8', amount: 0.7 },
      Skeleton_Mage_Hat: { tint: '#7a4fc4', amount: 0.8 },
    },
    extras: [{ type: 'orb', bone: 'handslotl' }],
  },
  {
    id: 'rei', name: 'Rei Dourado', desc: 'Armadura de ouro, coroa e espadão.', color: ['#ffe07a', '#d19a1c'],
    base: 'Knight',
    hide: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield'],
    add: [{ from: 'Barbarian', part: 'Barbarian_Cape' }],
    paint: {
      Knight_Body: { tint: '#ffc93c', amount: 0.75 }, Knight_ArmLeft: { tint: '#ffc93c', amount: 0.75 }, Knight_ArmRight: { tint: '#ffc93c', amount: 0.75 },
      Knight_LegLeft: { tint: '#ffc93c', amount: 0.75 }, Knight_LegRight: { tint: '#ffc93c', amount: 0.75 },
      Barbarian_Cape: { tint: '#8a3fd1', amount: 0.85 }, '2H_Sword': { tint: '#fff2b0', amount: 0.35 },
    },
    extras: [{ type: 'crown', bone: 'head' }],
  },
  {
    id: 'viking', name: 'Viking do Gelo', desc: 'Bárbaro do norte com elmo de chifres.', color: ['#a8e4ff', '#3f8fc4'],
    base: 'Barbarian',
    hide: ['Barbarian_Hat', 'Barbarian_Cape', '1H_Axe', '1H_Axe_Offhand', 'Barbarian_Round_Shield', 'Mug'],
    add: [{ from: 'Knight', part: 'Knight_Helmet' }, { from: 'Knight', part: 'Knight_Cape' }],
    paint: {
      Barbarian_Body: { tint: '#7fc4ff', amount: 0.6 }, Barbarian_ArmLeft: { tint: '#7fc4ff', amount: 0.35 }, Barbarian_ArmRight: { tint: '#7fc4ff', amount: 0.35 },
      Barbarian_LegLeft: { tint: '#3f6fa0', amount: 0.7 }, Barbarian_LegRight: { tint: '#3f6fa0', amount: 0.7 },
      Knight_Helmet: { tint: '#d8ecff', amount: 0.4 }, Knight_Cape: { tint: '#ffffff', amount: 0.8 }, '2H_Axe': { tint: '#a8e4ff', amount: 0.5 },
    },
    extras: [{ type: 'horns', bone: 'head' }],
  },
];

// arquivos que as receitas usam
export const CHARACTER_ASSETS = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Skeleton_Mage'];

// o GLTFLoader tira os pontos dos nomes ("handslot.r" vira "handslotr")
const clean = (name) => name.replace(/\./g, '');

export function buildCharacter(assets, r) {
  const root = SkeletonUtils.clone(assets[r.base].scene);
  applyLook(root, assets, r);
  return { scene: root, animations: assets[r.base].animations };
}

// aplica uma receita (sem "base") num modelo já clonado: usado pelos bonecos e pelas aparências das variantes
export function applyLook(root, assets, r) {
  let skeleton = null, rig = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !skeleton) { skeleton = o.skeleton; rig = o.parent; } });

  for (const name of r.hide || []) root.getObjectByName(name)?.removeFromParent();

  for (const { from, part, bone, pos, rot, scale } of r.add || []) {
    const src = assets[from].scene.getObjectByName(part);
    const copy = src.clone(true);
    let skinned = false;
    copy.traverse((o) => { if (o.isSkinnedMesh) { o.bind(skeleton, o.bindMatrix); skinned = true; } });
    if (bone) {   // peça avulsa (ex.: aljava) num osso escolhido, com posição própria
      copy.position.fromArray(pos || [0, 0, 0]);
      copy.rotation.fromArray(rot || [0, 0, 0]);
      copy.scale.setScalar(scale || 1);
      root.getObjectByName(clean(bone)).add(copy);
      continue;
    }
    // peça de pele vai junto do corpo; peça rígida vai no osso de mesmo nome (cabeça, peito, mão)
    if (!skinned && scale) copy.scale.multiplyScalar(scale);
    if (!skinned && pos) copy.position.add(new THREE.Vector3(...pos));
    (skinned ? rig : root.getObjectByName(clean(src.parent.name))).add(copy);
  }

  for (const [part, op] of Object.entries(r.paint || {})) {
    root.getObjectByName(part)?.traverse((o) => {
      if (!o.isMesh || !o.material.map) return;
      o.material = o.material.clone();
      o.material.map = recolor(o.material.map, op);
    });
  }

  for (const extra of r.extras || []) root.getObjectByName(clean(extra.bone))?.add(ACCESSORIES[extra.type](extra));

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return root;
}

// ---------- cores: recolore o atlas de cores do modelo ----------
const recolored = new Map();

function recolor(tex, op) {
  const key = `${tex.uuid}|${JSON.stringify(op)}`;
  if (recolored.has(key)) return recolored.get(key);
  const { width: w, height: h } = tex.image;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(tex.image, 0, 0);
  const img = ctx.getImageData(0, 0, w, h), px = img.data;
  const tint = op.tint ? new THREE.Color(op.tint) : null;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    if (op.hue) [r, g, b] = rotateHue(r, g, b, op.hue);
    if (tint) {   // pinta mantendo a luz e a sombra do desenho original
      const lum = 0.3 * r + 0.59 * g + 0.11 * b, k = 0.35 + 0.95 * lum, a = op.amount ?? 0.7;
      r += (Math.min(1, tint.r * k * 1.25) - r) * a;
      g += (Math.min(1, tint.g * k * 1.25) - g) * a;
      b += (Math.min(1, tint.b * k * 1.25) - b) * a;
    }
    px[i] = r * 255; px[i + 1] = g * 255; px[i + 2] = b * 255;
  }
  ctx.putImageData(img, 0, 0);
  const out = new THREE.CanvasTexture(canvas);
  out.flipY = tex.flipY;
  out.colorSpace = tex.colorSpace;
  out.magFilter = tex.magFilter;
  out.minFilter = tex.minFilter;
  out.wrapS = tex.wrapS; out.wrapT = tex.wrapT;
  recolored.set(key, out);
  return out;
}

// gira o tom (graus) só das cores saturadas; cinza e branco ficam como estão
function rotateHue(r, g, b, deg) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d < 0.08) return [r, g, b];
  const s = d / (1 - Math.abs(2 * l - 1));
  let hh = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hh = (((hh * 60 + deg) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = l - c / 2;
  const [r1, g1, b1] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return [r1 + m, g1 + m, b1 + m];
}

// ---------- acessórios (posições em relação ao osso, em unidades do modelo) ----------
const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const gold = lambert(0xffcc33, { emissive: 0x6a4a00, emissiveIntensity: 0.4 });

const ACCESSORIES = {
  crown() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.16, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xffcc33, side: THREE.DoubleSide, emissive: 0x6a4a00, emissiveIntensity: 0.4 })));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), gold);
      spike.position.set(Math.cos(a) * 0.33, 0.16, Math.sin(a) * 0.33);
      g.add(spike);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), lambert(i % 2 ? 0xff4d6d : 0x4dd2ff, { emissive: 0x330011 }));
      gem.position.set(Math.cos(a + 0.6) * 0.36, 0, Math.sin(a + 0.6) * 0.36);
      g.add(gem);
    }
    g.position.set(0, 0.95, 0);
    return g;
  },
  horns() {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const horn = new THREE.Group();
      const parts = [[0.1, 0.22], [0.075, 0.2], [0.05, 0.18]];
      let y = 0;
      parts.forEach(([r, len], i) => {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, len, 6), lambert(0xfff3d6));
        seg.position.set(0, y + len / 2, 0);
        seg.rotation.z = -s * 0.15 * i;
        horn.add(seg);
        y += len * 0.9;
      });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), lambert(0xfff3d6));
      tip.position.set(0, y + 0.05, 0);
      horn.add(tip);
      horn.position.set(s * 0.42, 0.55, 0);
      horn.rotation.z = -s * 0.9;
      g.add(horn);
    }
    return g;
  },
  antlers() {
    const g = new THREE.Group();
    const wood = lambert(0x8a5a2e);
    for (const s of [-1, 1]) {
      const a = new THREE.Group();
      const main = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.45, 5), wood);
      main.position.y = 0.22;
      a.add(main);
      for (const [y, ang] of [[0.18, 0.9], [0.32, -0.8]]) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 5), wood);
        tine.position.set(Math.sin(ang) * 0.08, y + 0.06, 0);
        tine.rotation.z = -ang;
        a.add(tine);
      }
      a.position.set(s * 0.25, 0.75, 0);
      a.rotation.z = -s * 0.45;
      g.add(a);
    }
    return g;
  },
  wreath() {
    const g = new THREE.Group();
    const leaf = new THREE.IcosahedronGeometry(0.07, 0);
    const leafMat = [lambert(0x5fae3e), lambert(0x86c95a)];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const m = new THREE.Mesh(leaf, leafMat[i % 2]);
      m.position.set(Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52);
      m.scale.set(1.3, 0.7, 1);
      g.add(m);
    }
    for (const [a, c] of [[0.3, 0xff8fb5], [2.2, 0xfff07a], [4.1, 0xffffff]]) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), lambert(c));
      f.position.set(Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55);
      g.add(f);
    }
    g.position.set(0, 0.78, 0);
    g.rotation.x = -0.15;
    return g;
  },
  orb({ color = 0x7dffa0, glow = 0x2fbf5a } = {}) {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshLambertMaterial({ color, emissive: glow, emissiveIntensity: 1 }));
    orb.position.set(0, 0.1, 0.15);
    orb.userData.spin = true;
    g.add(orb);
    return g;
  },
  // pena/crista em cima do elmo
  plume({ color = 0xffffff, tall = false, y = 0.95 } = {}) {
    const g = new THREE.Group();
    const mat = lambert(color);
    const n = tall ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat);
      f.scale.set(0.6, 1.6, 1.3);
      f.position.set(0, y + Math.sin((i / (n - 1 || 1)) * Math.PI) * 0.15, -0.15 + i * (tall ? 0.12 : 0.1));
      f.rotation.x = -0.4 + i * 0.25;
      g.add(f);
    }
    return g;
  },
  // ombreiras redondas (no osso do peito)
  pauldrons({ color = 0xb0b8c4, spikes = false, size = 1 } = {}) {
    const g = new THREE.Group();
    g.scale.setScalar(size);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), lambert(color));
      p.position.set(s * 0.42, 0.38, 0);
      p.rotation.z = -s * 0.5;
      g.add(p);
      if (spikes) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), lambert(0xe8e0c8));
        sp.position.set(s * 0.5, 0.55, 0);
        sp.rotation.z = -s * 0.6;
        g.add(sp);
      }
    }
    return g;
  },
  // cachecol no pescoço (osso da cabeça, embaixo)
  scarf({ color = 0xd94f4f } = {}) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 6, 14), lambert(color));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.05), lambert(color));
    tail.position.set(0.12, -0.12, -0.26);
    tail.rotation.set(0.3, 0, 0.25);
    g.add(tail);
    return g;
  },
  // coroa de cristais de gelo
  iceCrown({ radius = 0.36, y = 0.95, n = 6 } = {}) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xc8f4ff, emissive: 0x3aa8d8, emissiveIntensity: 0.5, flatShading: true });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), mat);
      c.scale.set(0.7, 2 + (i % 2), 0.7);
      c.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      c.rotation.z = Math.cos(a) * 0.3;
      c.rotation.x = -Math.sin(a) * 0.3;
      g.add(c);
    }
    return g;
  },
  // estrelinhas girando em volta da cabeça
  stars({ color = 0xffe066 } = {}) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.6, flatShading: true });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), mat);
      const a = (i / 3) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.6, 1.25, Math.sin(a) * 0.6);
      g.add(s);
    }
    g.userData.orbit = true;
    return g;
  },
  // pena atrás da orelha
  feather({ color = 0xff8a3d } = {}) {
    const g = new THREE.Group();
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), lambert(color));
    f.scale.set(0.5, 2.6, 0.9);
    f.position.set(0.42, 0.75, -0.1);
    f.rotation.z = -0.6;
    g.add(f);
    return g;
  },
  // chaminhas saindo do chapéu
  flames({ y = 1.55 } = {}) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffb03a, emissive: 0xff5a1a, emissiveIntensity: 0.8, flatShading: true });
    for (const [x, h] of [[-0.12, 0.25], [0, 0.35], [0.12, 0.22]]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, h, 5), mat);
      f.position.set(x, y + h / 2, -0.05);
      g.add(f);
    }
    g.userData.flicker = true;
    return g;
  },
};
