// Bonecos novos montados com peças dos modelos KayKit: todos usam o mesmo esqueleto de animação,
// então dá para trocar cabeça, chapéu, capa e arma entre eles, mudar as cores e pôr acessórios.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vfxMesh, spriteGeometry } from './vfx-shaders.js';

// receitas: base = modelo de partida; hide = peças da base que somem; add = peças de outros modelos;
// paint = mudança de cor por peça (hue gira o tom, tint pinta por cima mantendo a sombra);
// shape = proporções das malhas; extras = roupas e acessórios presos a um osso
export const CHARACTERS = [
  {
    id: 'druida', name: 'Druida', desc: 'Guardião da floresta com cajado de galhos.', color: ['#a8e07a', '#5a9e3a'],
    base: 'Rogue',
    shape: silhouette('Rogue', { torso: 0.96, arms: 0.94, legs: 0.97, height: 1.03, depth: 0.94 }),
    hide: ['Knife', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable', 'Rogue_Cape'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }, { from: 'Mage', part: '2H_Staff' }],
    paint: {   // túnica de musgo com gola de folha nova, mangas, cinto e botas de casca
      ...rogueOutfit({ cloth: '#5a9a34', trim: '#d8f070', sleeves: '#7a5230', leather: '#7a5230', pants: '#46702a', boots: '#5a3a1e', gloves: '#7a5230' }),
      Mage_Cape: { tint: '#4a9a40', amount: 0.85, base: 0.6 }, '2H_Staff': { tint: '#8a5a2e', amount: 0.6 },
      Rogue_Head: { face: { skin: '#c8946a', hair: '#6a9a2a', eyes: '#8ff060' } },   // cabelo de musgo e olhos de folha
    },
    extras: [
      { type: 'antlers', bone: 'head' }, { type: 'wreath', bone: 'head' }, { type: 'leafMantle', bone: 'chest' }, { type: 'leafSkirt', bone: 'hips' },
      { type: 'facePaint', bone: 'head', style: 'dots', color: 0x7fd040 }, { type: 'motes', bone: 'root', color: 0xd8ff6a, n: 5, size: 0.045 },
    ],
  },
  {
    id: 'necromante', name: 'Necromante', desc: 'Mago esqueleto que brinca com magia verde.', color: ['#c9a3ff', '#6b3fa0'],
    base: 'Skeleton_Mage',
    shape: silhouette('Skeleton_Mage', { torso: 0.91, arms: 0.93, legs: 0.95, height: 1.05, depth: 0.91 }),
    hide: [],
    add: [
      { from: 'Mage', part: 'Mage_Cape' },
      { from: 'Skeleton_Staff', part: 'Skeleton_Staff', bone: 'handslotr', rot: [0, Math.PI, 0] },   // cajado de osso
    ],
    paint: {
      Mage_Cape: { tint: '#39254e', amount: 0.86 }, Skeleton_Mage_Hat: { tint: '#6d43a6', amount: 0.72 },
      Skeleton_Mage_Body: { tint: '#4a2e6a', amount: 0.55 }, Skeleton_Mage_ArmLeft: { tint: '#4a2e6a', amount: 0.4 }, Skeleton_Mage_ArmRight: { tint: '#4a2e6a', amount: 0.4 },
    },
    extras: [
      { type: 'orb', bone: 'handslotl' }, { type: 'skull', bone: 'handslotr', y: 1.38 },   // caveira na ponta do cajado
      { type: 'pauldrons', bone: 'chest', color: 0x59436f, spikes: true, size: 0.92 },
      { type: 'runeRing', bone: 'root', color: 0x72db8b }, { type: 'motes', bone: 'root', color: 0x7dffa0, n: 5, size: 0.045 },
    ],
  },
  {
    id: 'rei', name: 'Rei Dourado', desc: 'Armadura de ouro, coroa e espadão.', color: ['#ffe07a', '#d19a1c'],
    base: 'Knight',
    shape: silhouette('Knight', { torso: 1.12, arms: 1.08, legs: 1.06, height: 1, depth: 1.1 }),
    hide: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield'],
    add: [{ from: 'Barbarian', part: 'Barbarian_Cape' }],
    paint: {
      Knight_Body: { tint: '#ffc93c', amount: 0.75 }, Knight_ArmLeft: { tint: '#ffc93c', amount: 0.75 }, Knight_ArmRight: { tint: '#ffc93c', amount: 0.75 },
      Knight_LegLeft: { tint: '#ffc93c', amount: 0.75 }, Knight_LegRight: { tint: '#ffc93c', amount: 0.75 },
      Barbarian_Cape: { tint: '#8a3fd1', amount: 0.85 }, '2H_Sword': { tint: '#fff2b0', amount: 0.35 },
      Knight_Head: { face: { skin: '#f2c8a0', hair: '#e8b830', eyes: '#9a5ae0' } },
    },
    extras: [
      { type: 'crown', bone: 'head' },
      { type: 'beard', bone: 'head', color: 0xd8a828 }, { type: 'mustache', bone: 'head', color: 0xd8a828, curl: 0.45 },
      { type: 'pauldrons', bone: 'chest', color: 0xe8b93e, trim: 0x8a3fd1, size: 1.12 },
    ],
  },
  {
    id: 'viking', name: 'Viking do Gelo', desc: 'Bárbaro do norte com elmo de chifres.', color: ['#a8e4ff', '#3f8fc4'],
    base: 'Barbarian',
    shape: silhouette('Barbarian', { torso: 1.08, arms: 1.08, legs: 1.05, height: 1, depth: 1.08 }),
    hide: ['Barbarian_Hat', 'Barbarian_Cape', '1H_Axe', '1H_Axe_Offhand', 'Barbarian_Round_Shield', 'Mug'],
    add: [{ from: 'Knight', part: 'Knight_Helmet' }, { from: 'Knight', part: 'Knight_Cape' }],
    paint: {
      Barbarian_Body: { tint: '#7fc4ff', amount: 0.6 }, Barbarian_ArmLeft: { tint: '#7fc4ff', amount: 0.35 }, Barbarian_ArmRight: { tint: '#7fc4ff', amount: 0.35 },
      Barbarian_LegLeft: { tint: '#3f6fa0', amount: 0.7 }, Barbarian_LegRight: { tint: '#3f6fa0', amount: 0.7 },
      Knight_Helmet: { tint: '#d8ecff', amount: 0.4 }, Knight_Cape: { tint: '#ffffff', amount: 0.8 }, '2H_Axe': { tint: '#a8e4ff', amount: 0.5 },
      Barbarian_Head: { face: { skin: '#dfe8f2', hair: '#eef6ff', eyes: '#9ff4ff' } },   // barba de geada e olhos claros
    },
    extras: [{ type: 'horns', bone: 'head' }, { type: 'furMantle', bone: 'chest', color: 0xd9eafa }],
  },
  {
    id: 'cleric', name: 'Clériga', desc: 'Clériga de túnica leve e cajado sagrado.', color: ['#fff0dc', '#d89b61'],
    base: 'Mage',
    shape: silhouette('Mage', { torso: 0.97, arms: 0.96, legs: 0.98, height: 1.02, depth: 0.96 }),
    hide: ['Mage_Hat', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
    add: [{ from: 'Mage', part: '2H_Staff', bone: 'handslotr', rot: [0, Math.PI, 0] }],
    paint: {
      Mage_Body: { tint: '#f4edda', amount: 0.8 }, Mage_ArmLeft: { tint: '#f4edda', amount: 0.76 }, Mage_ArmRight: { tint: '#f4edda', amount: 0.76 },
      Mage_LegLeft: { tint: '#e4d8bb', amount: 0.74 }, Mage_LegRight: { tint: '#e4d8bb', amount: 0.74 },
      Mage_Cape: { tint: '#fff0dc', amount: 0.68 }, '2H_Staff': { tint: '#d3a64a', amount: 0.58 },
      Mage_Head: { face: { skin: '#a8724e', hair: '#2a1a12', eyes: '#d8a040' } },
    },
    extras: [
      { type: 'robeSkirt', bone: 'hips' }, { type: 'clericStole', bone: 'chest' }, { type: 'crossBadge', bone: 'chest' },
      { type: 'circlet', bone: 'head', gem: 0x9fe0ff }, { type: 'brows', bone: 'head', color: 0x2a1a12, angle: -0.15 },
    ],
  },
  {
    id: 'bard', name: 'Bardo', desc: 'Cantor de guerra que inspira os aliados.', color: ['#f4c6ff', '#875ac7'],
    base: 'Rogue',
    shape: silhouette('Rogue', { torso: 0.92, arms: 0.93, legs: 0.98, height: 1.05, depth: 0.91 }),
    hide: ['Rogue_Cape', 'Knife', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable'],
    add: [{ from: 'Barbarian', part: 'Barbarian_Cape' }],
    paint: {   // roupa de trovador em blocos: gibão amarelo, mangas vermelhas, gola e calça roxas
      ...rogueOutfit({ cloth: '#f0c028', trim: '#8a3ac8', sleeves: '#e0303c', leather: '#7a4a24', pants: '#7a34b0', boots: '#b02a2a', gloves: '#f0c028', metal: '#ffd84a' }),
      Barbarian_Cape: { tint: '#d8283a', amount: 0.85 },
      Rogue_Head: { face: { skin: '#f0c8a8', hair: '#f0b040', eyes: '#b070e0' } },   // cachos loiros e olhos violeta
    },
    extras: [
      { type: 'lute', bone: 'chest', back: true }, { type: 'travelHat', bone: 'head', color: 0x7a34b0, band: 0xf0c028 }, { type: 'feather', bone: 'head', color: 0xff3a3a, y: 1.2 }, { type: 'luteStrap', bone: 'chest', color: 0x8a3ac8 },
      { type: 'mustache', bone: 'head', color: 0xc8902a, curl: 0.65 }, { type: 'brows', bone: 'head', color: 0xc8902a, angle: -0.1 },
    ],
  },
  {
    id: 'angel', name: 'Anjo', desc: 'Mensageiro celeste que paira com asas de luz.', color: ['#fff4b5', '#d8a632'],
    base: 'Mage',
    shape: silhouette('Mage', { torso: 0.98, arms: 0.96, legs: 0.97, height: 1.06, depth: 0.96 }),
    hide: ['Mage_Hat', 'Mage_Cape', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }, { from: 'Mage', part: '1H_Wand' }],
    paint: {
      Mage_Body: { tint: '#fff0c2', amount: 0.88 }, Mage_ArmLeft: { tint: '#fff0c2', amount: 0.82 }, Mage_ArmRight: { tint: '#fff0c2', amount: 0.82 },
      Mage_LegLeft: { tint: '#d8d2bd', amount: 0.75 }, Mage_LegRight: { tint: '#d8d2bd', amount: 0.75 }, Mage_Cape: { tint: '#ffe27a', amount: 0.7 },
      Mage_Head: { face: { skin: '#ffe6d6', hair: '#fff2b8', eyes: '#ffc830' } },   // cabelo platinado e olhos dourados
    },
    extras: [{ type: 'halo', bone: 'head' }, { type: 'wings', bone: 'chest' }, { type: 'motes', bone: 'root', color: 0xffe8a0, n: 5, size: 0.045, y: 1.3 }],
  },
  {
    id: 'chronist', name: 'Cronomante', desc: 'Ladino arcano que dobra o tempo ao redor.', color: ['#a8d9ff', '#4968c7'],
    base: 'Rogue',
    shape: silhouette('Rogue', { torso: 0.93, arms: 0.93, legs: 0.97, height: 1.06, depth: 0.93 }),
    hide: ['Rogue_Cape', 'Knife', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }, { from: 'Mage', part: '2H_Staff', bone: 'handslotr', rot: [0, Math.PI, 0] }],
    paint: {   // robe azul-celeste com acabamento dourado
      ...rogueOutfit({ cloth: '#90d0ff', trim: '#f0c040', leather: '#f0c040', pants: '#4a80c8', boots: '#24407a', gloves: '#f0c040', metal: '#fff0a0' }),
      Mage_Cape: { tint: '#6ab0f0', amount: 0.9, base: 0.85 },
      '2H_Staff': { tint: '#9ddcff', amount: 0.6 },
      Rogue_Head: { face: { skin: '#e8c8b0', hair: '#9cb8ff', eyes: '#5ad8ff' } },   // cabelo prateado-azul
    },
    extras: [
      { type: 'stars', bone: 'head', color: 0xa8d9ff }, { type: 'orb', bone: 'handslotl', color: 0xb9e8ff, glow: 0x5075ff },
      { type: 'monocle', bone: 'head' }, { type: 'runeRing', bone: 'root', color: 0x75b8ff },
      { type: 'robeSkirt', bone: 'hips', color: 0x78c0f8, trim: 0xf0c040, height: 0.44, flare: 0.42 }, { type: 'gearPauldrons', bone: 'chest' },
    ],
  },
];

// proporções leves nas malhas de corpo, braços e pernas; mantém os ossos livres para as animações
function silhouette(model, { torso = 1, arms = 1, legs = 1, height = 1, depth = 1 } = {}) {
  return {
    [`${model}_Body`]: [torso, height, depth],
    [`${model}_ArmLeft`]: [arms, height, depth], [`${model}_ArmRight`]: [arms, height, depth],
    [`${model}_LegLeft`]: [legs, height, depth], [`${model}_LegRight`]: [legs, height, depth],
  };
}

// Ladino: o atlas separa pano (0,1), gola e acabamento (1,1), couro (5,0 e 6,0; luvas 5,2), fivela (3,0), calça (7,1)
// e botas (3,2); pintar cada casa dá roupa de várias cores em vez de um tom só por cima do verde original
function rogueOutfit({ cloth, trim = cloth, leather, metal, pants = leather, boots = leather, sleeves = cloth, gloves = leather }, amount = 0.92) {
  const p = (tint, cells) => ({ tint, amount, base: 0.5, cells });
  const arm = p(sleeves, { '1,1': trim, '5,0': leather, '5,2': gloves }), leg = p(pants, { '3,2': boots });
  return {
    Rogue_Body: p(cloth, { '1,1': trim, '5,0': leather, '6,0': leather, '7,1': pants, ...(metal && { '3,0': metal }) }),
    Rogue_ArmLeft: arm, Rogue_ArmRight: arm, Rogue_LegLeft: leg, Rogue_LegRight: leg,
  };
}

// arquivos que as receitas usam
export const CHARACTER_ASSETS = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Skeleton_Mage'];   // .glb; o cajado de osso (Skeleton_Staff.gltf) vem à parte

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
    const src = assets[from]?.scene.getObjectByName(part);
    if (!src) continue;   // modelo não carregado nesta página (ex.: vitrine)
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

  // proporções aplicadas às malhas, não aos ossos: os clipes GLB também animam a escala dos ossos
  for (const [part, factors] of Object.entries(r.shape || {})) {
    const mesh = root.getObjectByName(part);
    if (!mesh?.isSkinnedMesh || !mesh.scale) continue;
    const [x = 1, y = 1, z = 1] = factors;
    mesh.scale.set(mesh.scale.x * x, mesh.scale.y * y, mesh.scale.z * z);
  }
  // peças rígidas (escudo, arma) maiores ou menores sem mexer nas proporções do corpo
  for (const [part, factor] of Object.entries(r.resize || {})) root.getObjectByName(part)?.scale.multiplyScalar(factor);
  // nova orientação de uma peça rígida no seu osso (ex.: livro aberto virado para a frente)
  for (const [part, { rot, pos }] of Object.entries(r.pose || {})) {
    const obj = root.getObjectByName(part);
    if (rot) obj?.rotation.fromArray(rot);
    if (pos) obj?.position.fromArray(pos);
  }

  for (const [part, op] of Object.entries(r.paint || {})) {
    root.getObjectByName(part)?.traverse((o) => {
      if (!o.isMesh || !o.material.map) return;
      o.material = o.material.clone();
      o.material.map = recolor(o.material.map, op);
    });
  }

  for (const extra of r.extras || []) root.getObjectByName(clean(extra.bone))?.add(ACCESSORIES[extra.type](extra));

  root.traverse((o) => { if (o.isMesh) { o.castShadow = !o.material.userData?.vfx; o.frustumCulled = false; } });   // chama em shader não faz sombra
  return root;
}

// ---------- cores: recolore o atlas de cores do modelo ----------
const recolored = new Map();

// casas do atlas KayKit (grade 8x4) usadas pelo rosto: pele, cabelo/barba, olhos e capuz
const FACE_CELLS = { skin: [0, 0], hair: [1, 0], eyes: [2, 0], hood: [1, 1] };
// quanto cada casa do rosto puxa para a cor nova; os olhos clareiam para a íris aparecer
const FACE_MIX = { skin: [0.35, 0.62], hair: [0.6, 0.88], eyes: [0.95, 0.9], hood: [0.35, 0.85] };

// pinta mantendo a luz e a sombra do desenho original
function tintPixel(r, g, b, tint, a, base = 0.35) {
  const lum = 0.3 * r + 0.59 * g + 0.11 * b, k = base + 0.95 * lum;
  return [r + (Math.min(1, tint.r * k * 1.25) - r) * a, g + (Math.min(1, tint.g * k * 1.25) - g) * a, b + (Math.min(1, tint.b * k * 1.25) - b) * a];
}

export function recolor(tex, op) {
  const key = `${tex.uuid}|${JSON.stringify(op)}`;
  if (recolored.has(key)) return recolored.get(key);
  // o atlas é feito de faixas lisas: metade da resolução basta e gasta 4x menos memória por variante
  const scale = Math.min(1, 512 / tex.image.width);
  const w = Math.round(tex.image.width * scale), h = Math.round(tex.image.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(tex.image, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), px = img.data;
  const tint = op.tint ? new THREE.Color(op.tint) : null;
  // face: { skin, hair, eyes, hood } troca só as casas do rosto, sem tingir o resto da cabeça
  const cells = Object.entries(op.face || {}).map(([part, color]) => [FACE_CELLS[part], new THREE.Color(color), FACE_MIX[part]]);
  // cells: { 'x,y': cor } pinta casas inteiras do atlas (gola, couro, botas) com cor própria no lugar do tint geral;
  // base (padrão 0.35) clareia o resultado: pano escuro do atlas tingido de cor clara não fica apagado
  for (const [cell, color] of Object.entries(op.cells || {})) cells.push([cell.split(',').map(Number), new THREE.Color(color), [op.base ?? 0.35, op.amount ?? 0.9]]);
  const cw = w / 8, ch = h / 4;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const p = i / 4, cx = Math.floor((p % w) / cw), cy = Math.floor(Math.floor(p / w) / ch);
    const own = op.cells?.[`${cx},${cy}`];
    if (op.hue) [r, g, b] = rotateHue(r, g, b, op.hue);
    if (tint && !own) [r, g, b] = tintPixel(r, g, b, tint, op.amount ?? 0.7, op.base);
    if (cells.length) {
      for (const [[x, y], color, [base, a]] of cells) if (cx === x && cy === y) [r, g, b] = tintPixel(r, g, b, color, a, base);
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

// peça de geometria já posicionada, para juntar várias numa malha só (uma chamada de desenho por material)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function piece(geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const sc = Array.isArray(scale) ? scale : [scale, scale, scale];
  return g.applyMatrix4(_m.compose(_p.fromArray(pos), _q.setFromEuler(_e.set(...rot)), _s.fromArray(sc)));
}
const merged = (pieces) => mergeGeometries(pieces.map((g) => {
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
  return g;
}));

// aro (torus) que acompanha a borda de um cilindro aberto com thetaStart = start e thetaLength = span
const rim = (radius, tube, start, span) => new THREE.TorusGeometry(radius, tube, 4, 14, span).rotateX(Math.PI / 2).rotateY(start + span - Math.PI / 2);

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
  // halo dourado suspenso acima da cabeça: silhueta própria para o anjo
  halo({ color = 0xffdf82, y = 1.22 } = {}) {
    const g = new THREE.Group();
    const mat = lambert(color, { emissive: 0xa66b16, emissiveIntensity: 0.38 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.045, 7, 24), mat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), mat);
      spark.position.set(Math.cos(a) * 0.43, 0.02, Math.sin(a) * 0.43);
      g.add(spark);
    }
    g.position.set(0, y, 0);
    g.userData.orbit = true;
    return g;
  },
  // chapéu de viajante com aba larga; usado pelo bardo para não repetir a silhueta do mago
  travelHat({ color = 0x7c482e, band = 0xd9ae56 } = {}) {
    const g = new THREE.Group();
    const felt = lambert(color), trim = lambert(band);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.47, 0.075, 12), felt);
    brim.position.y = 0.9;
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.32, 0.38, 10), felt);
    crown.position.set(0, 1.11, -0.015);
    g.add(crown);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.325, 0.325, 0.07, 10), trim);
    ribbon.position.y = 0.99;
    g.add(ribbon);
    g.rotation.z = -0.08;
    return g;
  },
  // elmo fechado de fortaleza: perfil largo e pesado para o guardião, diferente do elmo emplumado do paladino
  // (a cabeça KayKit vai de y≈0 a 1.07 no osso; olhos em y≈0.37, rosto em z≈0.5)
  greathelm({ color = 0x7890ad, trim = 0xc8d9ec, slit = 0x101826, eyes = 0x7fd4ff } = {}) {
    const g = new THREE.Group();
    const steel = [
      piece(new THREE.CylinderGeometry(0.6, 0.62, 0.78, 12), [0, 0.42, 0]),   // balde do elmo
      piece(new THREE.SphereGeometry(0.6, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.8, 0], [0, 0, 0], [1, 0.42, 1]),   // topo arredondado
    ];
    const edge = [
      piece(new THREE.BoxGeometry(0.1, 0.62, 0.08), [0, 0.6, 0.6]),   // aresta vertical na frente
      piece(new THREE.TorusGeometry(0.615, 0.035, 4, 16), [0, 0.03, 0], [Math.PI / 2, 0, 0]),   // aro de baixo
      piece(new THREE.BoxGeometry(1.0, 0.07, 0.06), [0, 0.47, 0.6]),   // sobrancelha da viseira
    ];
    for (let i = 0; i < 3; i++) edge.push(piece(new THREE.BoxGeometry(0.05, 0.05, 0.03), [0.12 + i * 0.1, 0.18, 0.61]));   // respiros
    const dark = [piece(new THREE.BoxGeometry(0.86, 0.09, 0.05), [0, 0.38, 0.6])];   // fenda da viseira
    g.add(new THREE.Mesh(merged(steel), lambert(color)));
    g.add(new THREE.Mesh(merged(edge), lambert(trim)));
    g.add(new THREE.Mesh(merged(dark), lambert(slit)));
    // olhos acesos dentro da fenda: dá rosto ao guardião sem mostrar o rosto
    const glow = [-1, 1].map((s) => piece(new THREE.BoxGeometry(0.1, 0.045, 0.02), [s * 0.17, 0.38, 0.625]));
    g.add(new THREE.Mesh(merged(glow), new THREE.MeshBasicMaterial({ color: eyes })));
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
  // folhas grandes sobre os ombros dão ao druida uma silhueta natural além da coroa de galhos
  leafMantle() {
    const g = new THREE.Group();
    const mats = [lambert(0x3d8738), lambert(0x71b64a), lambert(0x9cc85c)];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 5), mats[(i + (side > 0 ? 1 : 0)) % mats.length]);
        leaf.scale.set(0.7, 1.55 - i * 0.1, 0.38);
        leaf.position.set(side * (0.27 + i * 0.11), 0.34 - i * 0.055, -0.04 - i * 0.025);
        leaf.rotation.z = -side * (0.36 + i * 0.085);
        leaf.rotation.x = -0.18;
        g.add(leaf);
      }
    }
    const seed = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), lambert(0xf1d47a, { emissive: 0x805515, emissiveIntensity: 0.18 }));
    seed.position.set(0, 0.28, 0.31);
    g.add(seed);
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
  // moicano espetado: fileira de mechas da testa à nuca, mais altas no meio
  mohawk({ color = 0xd8481a, y = 0.9, n = 6 } = {}) {
    const g = new THREE.Group();
    const mat = lambert(color);
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), tall = 0.22 + Math.sin(k * Math.PI) * 0.16;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.075, tall, 4), mat);
      m.scale.set(0.55, 1, 1.4);
      m.position.set(0, y + tall / 2 - Math.abs(k - 0.5) * 0.12, 0.3 - k * 0.65);
      m.rotation.x = -0.5 + k * 0.9;   // inclina para trás acompanhando o crânio
      g.add(m);
    }
    return g;
  },
  // ombreiras redondas (no osso do peito): o tamanho cresce a peça, não a altura,
  // para não subirem até a cabeça e virarem "orelhas" no retrato
  pauldrons({ color = 0xb0b8c4, spikes = false, size = 1, trim } = {}) {
    const plates = [], studs = [], rims = [];
    for (const s of [-1, 1]) {
      const x = s * (0.4 + (size - 1) * 0.12), tilt = [0, 0, -s * 0.42];
      plates.push(piece(new THREE.SphereGeometry(0.21, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), [x, 0.2, 0], tilt, [size * 1.05, size * 0.8, size]));
      rims.push(piece(new THREE.TorusGeometry(0.2, 0.03, 4, 12), [x, 0.2, 0], [Math.PI / 2, 0, tilt[2]], [size * 1.05, size, size]));
      if (spikes) studs.push(piece(new THREE.ConeGeometry(0.06, 0.24, 5), [x + s * 0.06 * size, 0.2 + 0.17 * size, 0], [0, 0, -s * 0.5], 1));
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(merged(plates), lambert(color)));
    if (trim) g.add(new THREE.Mesh(merged(rims), lambert(trim)));   // friso em outro tom
    if (studs.length) g.add(new THREE.Mesh(merged(studs), lambert(0xe8e0c8)));
    return g;
  },
  // pele grossa em volta dos ombros, usada para deixar o viking do gelo mais robusto
  furMantle({ color = 0xd9e4ed } = {}) {
    const g = new THREE.Group(), fur = lambert(color), shadow = lambert(0x8196a8);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5), i % 3 === 0 ? shadow : fur);
      tuft.scale.set(1.18, 0.82, 0.9);
      tuft.position.set(Math.cos(a) * 0.38, 0.28 + Math.sin(a) * 0.07, Math.sin(a) * 0.22);
      tuft.rotation.z = Math.sin(a) * 0.28;
      g.add(tuft);
    }
    return g;
  },
  // ombreiras de cristal em leque; dão ao criomante um contorno largo sem repetir a capa do piromante
  iceMantle({ color = 0xb9efff, shadow = 0x69b8d8 } = {}) {
    const g = new THREE.Group(), crystal = lambert(color, { emissive: 0x317fa5, emissiveIntensity: 0.3 }), dark = lambert(shadow);
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.OctahedronGeometry(0.31, 0), dark);
      pad.scale.set(1.5, 0.78, 1.08);
      pad.position.set(s * 0.42, 0.28, 0.02);
      pad.rotation.z = -s * 0.22;
      g.add(pad);
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.17 + (i === 1 ? 0.04 : 0), 0), crystal);
        shard.scale.set(0.78, 1.95 - i * 0.18, 0.9);
        shard.position.set(s * (0.29 + i * 0.14), 0.44 - i * 0.035, -0.02);
        shard.rotation.z = -s * (0.42 + i * 0.16);
        shard.rotation.x = 0.18;
        g.add(shard);
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
  iceCrown({ radius = 0.36, y = 0.95, n = 6, height = 1 } = {}) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xc8f4ff, emissive: 0x3aa8d8, emissiveIntensity: 0.5, flatShading: true });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), mat);
      c.scale.set(0.7, (2 + (i % 2)) * height, 0.7);
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
  feather({ color = 0xff8a3d, y = 0.75 } = {}) {
    const g = new THREE.Group();
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), lambert(color));
    f.scale.set(0.5, 2.6, 0.9);
    f.position.set(0.42, y, -0.1);
    f.rotation.z = -0.6;
    g.add(f);
    return g;
  },
  // pequena lira feita de formas simples, presa à mão do bardo
  lute({ back = false } = {}) {
    const g = new THREE.Group(), wood = lambert(0x9a5738), goldMat = lambert(0xffd676), string = lambert(0xfff0c2);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), wood);
    body.scale.set(0.95, 1.05, 0.46); body.position.y = -0.02; g.add(body);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.075), wood); neck.position.set(0, 0.27, 0); neck.rotation.z = -0.2; g.add(neck);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.035), goldMat); bridge.position.set(0, 0.01, 0.09); g.add(bridge);
    const soundHole = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 12), goldMat);
    soundHole.position.set(0, -0.11, 0.09); g.add(soundHole);
    for (let i = -2; i <= 2; i++) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.37, 4), string);
      wire.position.set(i * 0.025, 0.14, 0.075); g.add(wire);
      const peg = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), goldMat);
      peg.position.set(i % 2 ? -0.07 : 0.07, 0.44 + Math.floor(i / 2) * 0.025, 0);
      g.add(peg);
    }
    g.position.set(0.05, 0.05, 0.06); g.rotation.z = -0.15;
    if (back) { g.scale.setScalar(1.35); g.position.set(0.06, 0.02, -0.4); g.rotation.set(0, Math.PI, 0.65); }   // nas costas, cordas para fora
    return g;
  },
  // asas em três camadas de penas (rêmiges longas atrás, secundárias e coberteiras na frente),
  // abertas em leque a partir de uma borda curva; branco perolado com pontas douradas.
  // Cada asa é uma malha só (penas juntadas), e o grupo de cada lado bate com userData.wingFlap
  wings({ color = 0xffffff, tip = 0xf0b840 } = {}) {
    const g = new THREE.Group();
    const pearl = new THREE.Color(color), goldTip = new THREE.Color(tip), cream = new THREE.Color(0xeee8f8);   // base levemente lilás: brilho perolado
    // pena: folha alongada de 0 a 1 no eixo Y, com leve volume no meio para pegar luz
    const featherShape = new THREE.Shape();
    featherShape.moveTo(0, 0);
    featherShape.quadraticCurveTo(0.13, 0.35, 0.07, 0.86);
    featherShape.quadraticCurveTo(0.03, 1.0, 0, 1.0);
    featherShape.quadraticCurveTo(-0.05, 0.9, -0.09, 0.62);
    featherShape.quadraticCurveTo(-0.1, 0.25, 0, 0);
    const feather = (len, width, tipped, shade) => {
      const geo = new THREE.ExtrudeGeometry(featherShape, { depth: 0.02, bevelEnabled: false, curveSegments: 4 });
      const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        c.copy(shade).lerp(pearl, Math.min(1, y * 1.6));
        if (tipped && y > 0.72) c.lerp(goldTip, (y - 0.72) / 0.28);
        colors.set([c.r, c.g, c.b], i * 3);
        pos.setZ(i, pos.getZ(i) - Math.sin(y * Math.PI) * 0.06);   // curvatura: a pena arqueia para trás
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.scale(width, len, 1);
      return geo;
    };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0xc8c0d8, emissiveIntensity: 0.32 });
    for (const side of [-1, 1]) {
      const pieces = [];
      // borda de ataque: sobe do ombro para fora, como um braço da asa
      const edge = (t) => [side * (0.05 + 0.7 * t), 0.05 + 0.5 * Math.sin(t * Math.PI * 0.55)];
      const layers = [
        { n: 9, len: [0.62, 1.1], ang: [160, 48], z: -0.05, tipped: true, width: 1.25 },   // rêmiges
        { n: 7, len: [0.45, 0.7], ang: [150, 62], z: 0, tipped: false, width: 1.15, span: 0.85 },   // secundárias
        { n: 6, len: [0.26, 0.36], ang: [140, 75], z: 0.05, tipped: false, width: 1.05, span: 0.8 },   // coberteiras
      ];
      for (const L of layers) {
        for (let i = 0; i < L.n; i++) {
          const t = (i / (L.n - 1)) * (L.span || 1), [x, y] = edge(t);
          const len = L.len[0] + (L.len[1] - L.len[0]) * (i / (L.n - 1));
          const ang = THREE.MathUtils.degToRad(L.ang[0] + (L.ang[1] - L.ang[0]) * (i / (L.n - 1)));
          pieces.push(piece(feather(len, L.width, L.tipped, L.tipped ? cream : pearl), [x, y, L.z - i * 0.004], [0, side * 0.25, -side * ang], 1));
        }
      }
      const wing = new THREE.Group();
      wing.add(new THREE.Mesh(merged(pieces), mat));
      wing.position.set(side * 0.18, 0.18, -0.32);
      wing.rotation.y = side * -0.3;
      wing.userData.wingFlap = side;
      g.add(wing);
    }
    g.scale.set(1.25, 1.2, 1.1);
    return g;
  },
  // chaminhas saindo do chapéu
  // chamas em shader (vfx-shaders.js): três línguas numa malha só, sempre voltadas à câmera
  flames({ y = 1.55, z = -0.05 } = {}) {
    const g = new THREE.Group();
    const f = vfxMesh('flame', 'fire', spriteGeometry([[-0.12, 0, 0, 0.7, 1], [0.12, 0, 0, 0.62, 2], [0, 0.02, 0.01, 1, 3]], 'hatFlames'), { size: 0.42, seed: 1 });
    f.position.set(0, y, z);
    g.add(f);
    g.userData.flicker = true;
    return g;
  },
  // mão pegando fogo (no osso da mão): chamas em volta do punho
  handFire({ y = 0.05 } = {}) {
    const g = new THREE.Group();
    const f = vfxMesh('flame', 'fire', spriteGeometry([[-0.08, 0, 0, 0.72, 4], [0.08, 0, 0, 0.66, 5], [0, 0.03, 0.02, 1, 6]], 'handFlames'), { size: 0.62, seed: 4 });
    f.position.y = y;
    g.add(f);
    g.userData.flicker = true;
    return g;
  },
  // caveira com olhos verdes brilhando (na ponta do cajado do necromante)
  skull({ y = 1.35 } = {}) {
    const g = new THREE.Group();
    const bone = lambert(0xeee6d4);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), bone);
    head.scale.set(1, 1.05, 1.1);
    g.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.16), bone);
    jaw.position.set(0, -0.15, 0.03);
    g.add(jaw);
    const eye = new THREE.MeshLambertMaterial({ color: 0x7dffa0, emissive: 0x2fff6a, emissiveIntensity: 1.2 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), eye);
      e.position.set(s * 0.065, 0.01, 0.15);
      g.add(e);
    }
    g.position.y = y;
    g.rotation.y = Math.PI;   // o osso da mão está virado: a caveira olha para a frente
    return g;
  },
  // emblema redondo no peito (sol/brasão)
  emblem({ color = 0xf2c94c, y = 0.15, z = 0.36 } = {}) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10).rotateX(Math.PI / 2), lambert(color, { emissive: color, emissiveIntensity: 0.25 }));
    g.add(disc);
    for (let i = 0; i < 8; i++) {
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), lambert(color));
      const a = (i / 8) * Math.PI * 2;
      ray.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0);
      ray.rotation.z = a - Math.PI / 2;
      g.add(ray);
    }
    g.position.set(0, y, z);
    return g;
  },
  // estola clara cruzando o peito, com borda dourada; distingue a clériga do mago de túnica
  clericStole({ color = 0xf9f2df, trim = 0xd6ae56 } = {}) {
    const g = new THREE.Group(), cloth = lambert(color), goldMat = lambert(trim);
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.68, 0.04), cloth);
      panel.position.set(side * 0.11, 0.01, 0.29);
      panel.rotation.z = side * -0.16;
      g.add(panel);
      const piping = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.62, 0.02), goldMat);
      piping.position.set(side * 0.11, 0.01, 0.315);
      piping.rotation.z = side * -0.16;
      g.add(piping);
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 14), cloth);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.34, 0.04);
    g.add(collar);
    return g;
  },
  // túnica longa e aberta na barra: altera o contorno do corpo, não só os detalhes da roupa
  robeSkirt({ color = 0xf3ecda, trim = 0xd6ae56, height = 0.9, flare = 0.48 } = {}) {
    const g = new THREE.Group(), cloth = lambert(color), goldMat = lambert(trim);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, flare, height, 10, 1), cloth);
    skirt.position.y = -height * 0.43;
    g.add(skirt);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(flare * 0.98, 0.025, 5, 14), goldMat);
    hem.rotation.x = Math.PI / 2;
    hem.position.y = -height * 0.88;
    g.add(hem);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.19, height * 0.74, 0.035), goldMat);
    front.position.set(0, -height * 0.42, flare * 0.47);
    g.add(front);
    return g;
  },
  // cruz pequena no alto do peito em vez de um medalhão genérico
  crossBadge({ color = 0xd6ae56 } = {}) {
    const g = new THREE.Group(), mat = lambert(color, { emissive: 0x765018, emissiveIntensity: 0.18 });
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.045), mat);
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.07, 0.045), mat);
    vertical.position.set(0, 0.13, 0.365);
    horizontal.position.set(0, 0.16, 0.365);
    g.add(vertical, horizontal);
    return g;
  },
  // bandoleira e bolsa de instrumento, para dar ao bardo um perfil de viajante
  luteStrap({ color = 0x633a2a, buckle = 0xe2bd63 } = {}) {
    const g = new THREE.Group(), leather = lambert(color), metal = lambert(buckle);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.82, 0.035), leather);
    strap.position.set(0.03, 0.02, 0.29);
    strap.rotation.z = -0.45;
    g.add(strap);
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.13), leather);
    pouch.position.set(-0.31, -0.23, 0.2);
    pouch.rotation.z = -0.1;
    g.add(pouch);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.025), metal);
    clasp.position.set(-0.31, -0.2, 0.275);
    g.add(clasp);
    return g;
  },
  // colar de dentes em volta do pescoço
  necklace({ color = 0xf2ead8 } = {}) {
    const g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), lambert(color));
      tooth.position.set(Math.cos(a) * 0.3, -0.02, Math.sin(a) * 0.3);
      tooth.rotation.x = Math.PI;
      g.add(tooth);
    }
    return g;
  },
  // círculo de runas girando aos pés (no osso raiz)
  runeRing({ color = 0xb07aff } = {}) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.85, 32).rotateX(-Math.PI / 2), mat);
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.2).rotateX(-Math.PI / 2), mat);
      rune.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
      rune.rotation.y = -a;
      g.add(rune);
    }
    g.position.y = 0.04;
    g.userData.orbit = true;
    return g;
  },
  // máscara cobrindo a parte de baixo do rosto
  mask({ color = 0x2a2238 } = {}) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.5, 0.3, 12, 1, true, -Math.PI * 0.42, Math.PI * 0.84), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true }));
    m.position.set(0, 0.19, -0.02);
    g.add(m);
    return g;
  },
  // ---------- rosto (osso da cabeça: olhos em y≈0.37, testa em y≈0.5, boca em y≈0.15, frente em z≈0.5) ----------
  // sobrancelhas: angle > 0 = cara fechada (pontas de dentro descem), < 0 = expressão gentil
  brows({ color = 0x3a2416, angle = 0.25, y = 0.5, size = 1 } = {}) {
    const parts = [-1, 1].map((s) => piece(new THREE.BoxGeometry(0.2 * size, 0.055 * size, 0.04), [s * 0.19, y, 0.47], [0, 0, s * angle]));
    return new THREE.Mesh(merged(parts), lambert(color));
  },
  // barba: full = cheia no queixo, long = de mago até o peito, goatee = cavanhaque, braids = duas tranças com anéis
  beard({ color = 0x5a3a22, style = 'full', ring = 0xe8c060 } = {}) {
    const g = new THREE.Group(), hair = [];
    if (style === 'full' || style === 'long' || style === 'braids') {
      hair.push(piece(new THREE.SphereGeometry(0.36, 10, 6, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), [0, 0.2, 0.2], [0.25, 0, 0], [1.05, 0.75, 0.95]));
      for (const s of [-1, 1]) hair.push(piece(new THREE.BoxGeometry(0.08, 0.24, 0.16), [s * 0.43, 0.25, 0.3], [0, 0, s * 0.1]));   // costeletas
    }
    if (style === 'long') hair.push(piece(new THREE.ConeGeometry(0.24, 0.62, 7), [0, -0.18, 0.38], [Math.PI + 0.35, 0, 0]));
    if (style === 'goatee') hair.push(piece(new THREE.ConeGeometry(0.09, 0.22, 6), [0, 0.02, 0.45], [Math.PI + 0.3, 0, 0]));
    const rings = [];
    if (style === 'braids') {
      for (const s of [-1, 1]) {
        hair.push(piece(new THREE.CylinderGeometry(0.05, 0.075, 0.38, 6), [s * 0.12, -0.12, 0.44], [0.3, 0, s * 0.1]));
        rings.push(piece(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 7), [s * 0.125, -0.22, 0.475], [0.3, 0, s * 0.1]));
      }
    }
    g.add(new THREE.Mesh(merged(hair), lambert(color)));
    if (rings.length) g.add(new THREE.Mesh(merged(rings), lambert(ring)));
    return g;
  },
  // bigode: curl > 0 levanta as pontas
  mustache({ color = 0x5a3a22, curl = 0.3, y = 0.17 } = {}) {
    const parts = [-1, 1].map((s) => piece(new THREE.CapsuleGeometry(0.045, 0.16, 3, 6), [s * 0.11, y, 0.52], [0, 0, s * (Math.PI / 2 - curl)]));
    return new THREE.Mesh(merged(parts), lambert(color));
  },
  // cicatriz atravessando um olho
  scar({ color = 0xc0605a, side = 1 } = {}) {
    const parts = [piece(new THREE.BoxGeometry(0.035, 0.32, 0.03), [side * 0.2, 0.38, 0.5], [-0.1, 0, side * 0.35])];
    for (const k of [-1, 0, 1]) parts.push(piece(new THREE.BoxGeometry(0.09, 0.022, 0.03), [side * (0.2 + k * 0.035), 0.38 - k * 0.09, 0.505], [0, 0, side * 0.35]));
    return new THREE.Mesh(merged(parts), lambert(color));
  },
  // pintura de guerra: stripes = três riscos em cada bochecha, dots = pontinhos de folha/gelo
  facePaint({ color = 0x2a1010, style = 'stripes', y = 0.27, x = 0.3 } = {}) {
    const parts = [];
    for (const s of [-1, 1]) {
      if (style === 'stripes') for (let i = 0; i < 3; i++) parts.push(piece(new THREE.BoxGeometry(0.15, 0.032, 0.03), [s * (x + i * 0.012), y - i * 0.065, 0.49 - i * 0.02], [0, s * 0.45, s * 0.12]));
      if (style === 'dots') for (let i = 0; i < 3; i++) parts.push(piece(new THREE.OctahedronGeometry(0.035 - i * 0.006), [s * (0.24 + i * 0.07), 0.24 - i * 0.03, 0.5 - i * 0.04], [0, 0, 0], [1, 1.4, 0.6]));
    }
    if (style === 'stripes') parts.push(piece(new THREE.BoxGeometry(0.05, 0.22, 0.03), [0, 0.62, 0.47], [0.1, 0, 0]));   // risco na testa
    return new THREE.Mesh(merged(parts), lambert(color, style === 'dots' ? { emissive: color, emissiveIntensity: 0.35 } : {}));
  },
  // diadema fino com uma pedra na testa
  circlet({ color = 0xe8c060, gem = 0xb07aff, y = 0.62 } = {}) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(merged([piece(new THREE.TorusGeometry(0.51, 0.03, 4, 18), [0, y, 0.02], [Math.PI / 2 + 0.12, 0, 0], [1, 1.04, 1])]), lambert(color)));
    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), lambert(gem, { emissive: gem, emissiveIntensity: 0.55 }));
    stone.position.set(0, y + 0.02, 0.53);
    stone.scale.set(0.8, 1.2, 0.6);
    g.add(stone);
    return g;
  },
  // monóculo dourado com corrente: o cronomante "lê o tempo"
  monocle({ color = 0xe8c060, lens = 0x9fe6ff, side = 1 } = {}) {
    const g = new THREE.Group();
    const frame = [piece(new THREE.TorusGeometry(0.11, 0.022, 5, 14), [side * 0.2, 0.37, 0.52]), piece(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 3), [side * 0.33, 0.2, 0.47], [0, 0, side * 0.5])];
    g.add(new THREE.Mesh(merged(frame), lambert(color, { emissive: 0x5a3a00, emissiveIntensity: 0.3 })));
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: lens, transparent: true, opacity: 0.45, depthWrite: false }));
    glass.position.set(side * 0.2, 0.37, 0.53);
    g.add(glass);
    return g;
  },
  // faixa amarrada na testa com duas pontas soltas atrás
  headband({ color = 0xd13b3b, y = 0.62, radius = 0.55, depth = 1.1 } = {}) {
    const parts = [piece(new THREE.CylinderGeometry(radius, radius, 0.11, 16, 1, true), [0, y, 0], [0.1, 0, 0], [1, 1, depth])];
    for (const s of [-1, 1]) parts.push(piece(new THREE.BoxGeometry(0.09, 0.36, 0.03), [s * 0.1, y - 0.2, -radius * depth + 0.02], [0.35, 0, s * 0.35]));
    return new THREE.Mesh(merged(parts), lambert(color, { side: THREE.DoubleSide }));
  },
  // partículas leves girando em volta do corpo (no osso raiz): brasas, vaga-lumes, flocos
  motes({ color = 0xffb03a, n = 6, radius = 0.85, y = 1.0, size = 0.06 } = {}) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      parts.push(piece(new THREE.OctahedronGeometry(size * (0.7 + (i % 3) * 0.25)), [Math.cos(a) * radius, y + Math.sin(a * 3) * 0.35, Math.sin(a) * radius]));
    }
    const m = new THREE.Mesh(merged(parts), new THREE.MeshBasicMaterial({ color }));
    m.userData.orbit = true;
    return m;
  },
  // estrela de arremesso de 4 pontas, metal com miolo escuro
  shuriken({ y = 0.12, z = 0.1, size = 1, rot = [0, 0, 0], pos } = {}) {
    const g = new THREE.Group();
    const blades = [];
    for (let i = 0; i < 4; i++) blades.push(piece(new THREE.ConeGeometry(0.075, 0.24, 4), [0, 0.13, 0], [0, Math.PI / 4, 0], [1, 1, 0.3]).rotateZ((i * Math.PI) / 2));
    blades.push(piece(new THREE.OctahedronGeometry(0.075), [0, 0, 0], [0, 0, Math.PI / 4], [1, 1, 0.35]));
    g.add(new THREE.Mesh(merged(blades), lambert(0xc8d2dc, { emissive: 0x303a44, emissiveIntensity: 0.3 })));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6).rotateX(Math.PI / 2), lambert(0x1e2638));
    g.add(hub);
    g.scale.setScalar(size);
    g.position.fromArray(pos || [0, y, z]);
    g.rotation.fromArray(rot);
    return g;
  },
  // cinturão com shurikens presas (osso do quadril)
  shurikenBelt({ color = 0x1e2648 } = {}) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(merged([piece(new THREE.TorusGeometry(0.37, 0.045, 4, 16), [0, 0.12, 0.02], [Math.PI / 2, 0, 0], [1.05, 1, 1])]), lambert(color)));
    for (const [x, z, ry] of [[-0.24, 0.3, -0.6], [0, 0.39, 0], [0.24, 0.3, 0.6]]) g.add(ACCESSORIES.shuriken({ pos: [x, 0.12, z], rot: [0, ry, 0.3], size: 0.75 }));
    return g;
  },
  // saia de folhas pendendo do quadril, abrindo para fora na ponta (druida)
  leafSkirt({ colors = [0x3d8738, 0x71b64a, 0x9cc85c], n = 12, radius = 0.33, length = 0.36, tilt = 0.32, y = 0.1 } = {}) {
    const groups = colors.map(() => []);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const geo = new THREE.SphereGeometry(0.1, 6, 4).scale(0.95, length / 0.2, 0.3).translate(0, -length / 2, 0).rotateX(-tilt).rotateY(a);
      groups[i % colors.length].push(piece(geo, [Math.sin(a) * radius * 1.4, y, Math.cos(a) * radius * 1.1]));   // quadril oval
    }
    const g = new THREE.Group();
    groups.forEach((parts, i) => g.add(new THREE.Mesh(merged(parts), lambert(colors[i]))));
    return g;
  },
  // ombreiras douradas com engrenagens de lado e um mostrador de relógio no ombro esquerdo (cronomante)
  gearPauldrons({ color = 0xf0c040, trim = 0x78c0f8, gear = 0xd8a830, face = 0xfdf6e0 } = {}) {
    const g = ACCESSORIES.pauldrons({ color, trim, size: 0.95 });
    const cogs = [];
    for (const s of [-1, 1]) {
      const at = [s * 0.56, 0.24, 0], spin = [0, 0, Math.PI / 2 - s * 0.35];   // de pé, virada para fora
      cogs.push(piece(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), at, spin));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        cogs.push(piece(new THREE.BoxGeometry(0.06, 0.05, 0.06).translate(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14).rotateY(a), at, spin));
      }
    }
    g.add(new THREE.Mesh(merged(cogs), lambert(gear, { emissive: 0x5a3a00, emissiveIntensity: 0.3 })));
    // mostrador: disco claro com dois ponteiros, preso à frente da engrenagem esquerda
    const dial = new THREE.Group();
    dial.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 14).rotateZ(Math.PI / 2), lambert(face)));
    const hands = [piece(new THREE.BoxGeometry(0.012, 0.016, 0.075), [0.014, 0.012, 0.03]), piece(new THREE.BoxGeometry(0.012, 0.055, 0.014), [0.014, 0.03, 0])];
    dial.add(new THREE.Mesh(merged(hands), lambert(0x1e2a50)));
    dial.position.set(-0.6, 0.24, 0);
    dial.rotation.y = Math.PI;
    dial.rotation.z = 0.35;
    g.add(dial);
    return g;
  },
  // capuz baixo caído nas costas, abaixo do cabelo, com borda carmim (assassino)
  cowl({ color = 0x2a1c22, lining = 0xc8102e } = {}) {
    const g = new THREE.Group();
    const hood = new THREE.SphereGeometry(0.27, 10, 6).scale(1.05, 0.62, 0.42);
    g.add(new THREE.Mesh(merged([piece(hood, [0, -0.06, -0.4], [-0.2, 0, 0])]), lambert(color)));
    g.add(new THREE.Mesh(merged([piece(new THREE.TorusGeometry(0.27, 0.035, 4, 14, Math.PI), [0, -0.05, -0.41], [-0.2, 0, 0], [1.05, 0.62, 1])]), lambert(lining)));
    return g;
  },
  // faixas enroladas no antebraço (osso do antebraço: o eixo Y corre ao longo do braço)
  armWraps({ color = 0xc8102e, radius = 0.13, n = 3 } = {}) {
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(piece(new THREE.CylinderGeometry(radius, radius, 0.035, 8, 1, true), [0, 0.05 + i * 0.06, 0], [0.18 * (i % 2 ? 1 : -1), 0, 0]));
    return new THREE.Mesh(merged(parts), lambert(color, { side: THREE.DoubleSide }));
  },
  // manto curto só nas costas e ombros: deixa a frente livre para os braços (besteiro)
  capelet({ color = 0x4f9a44, trim = 0x6a4a2a, height = 0.42, y = 0.15 } = {}) {
    const g = new THREE.Group();
    const span = Math.PI * 0.95, start = Math.PI - span / 2;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.5, height, 12, 1, true, start, span), lambert(color, { side: THREE.DoubleSide })));
    g.add(new THREE.Mesh(rim(0.5, 0.035, start, span).translate(0, -height / 2, 0), lambert(trim)));
    g.position.y = y;
    return g;
  },
  // gola alta em pé, abrindo para fora atrás da cabeça, borda dourada e botões na frente (duelista)
  highCollar({ color = 0x8a1830, trim = 0xf0c040 } = {}) {
    const g = new THREE.Group(), span = Math.PI * 1.4, start = Math.PI - span / 2;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.2, 14, 1, true, start, span).translate(0, 0.09, 0), lambert(color, { side: THREE.DoubleSide })));
    const gold = [piece(rim(0.4, 0.025, start, span), [0, 0.19, 0])];
    for (const [y, z] of [[0.03, 0.335], [-0.07, 0.35], [-0.17, 0.36], [-0.27, 0.385]]) gold.push(piece(new THREE.OctahedronGeometry(0.035), [0, y, z], [0, 0, 0], [1, 1, 0.6]));
    g.add(new THREE.Mesh(merged(gold), lambert(trim, { emissive: 0x6a4a00, emissiveIntensity: 0.3 })));
    return g;
  },
  // cinto largo de couro com fivela grande (osso do quadril: a barriga é oval, mais larga que funda)
  wideBelt({ color = 0x2a1a14, buckle = 0xf0c040, y = 0.15 } = {}) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.13, 16, 1, true).scale(1.32, 1, 1.02).translate(0, y, 0), lambert(color, { side: THREE.DoubleSide })));
    const metal = [piece(new THREE.BoxGeometry(0.16, 0.14, 0.03), [0, y, 0.395]), piece(new THREE.BoxGeometry(0.035, 0.09, 0.03), [0, y, 0.41])];
    g.add(new THREE.Mesh(merged(metal), lambert(buckle, { emissive: 0x6a4a00, emissiveIntensity: 0.3 })));
    return g;
  },
  // arco longo de madeira com pontas claras e corda esticada (mão esquerda da arqueira; o eixo Y do osso aponta para cima)
  bow({ wood = 0x7a4a26, tip = 0xe8f6ee, string = 0xf4ecd8 } = {}) {
    const g = new THREE.Group();
    // arco no plano YZ: a empunhadura fica na mão (origem), as pontas curvam para trás (-z) onde passa a corda
    const limb = piece(new THREE.TorusGeometry(0.62, 0.035, 5, 18, Math.PI * 0.8).rotateZ(Math.PI * 0.6).rotateY(Math.PI / 2).translate(0, 0, -0.62));
    g.add(new THREE.Mesh(merged([limb, piece(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6))]), lambert(wood)));
    const ends = [-1, 1].map((s) => piece(new THREE.ConeGeometry(0.04, 0.14, 4), [0, s * 0.62, -0.31], [s > 0 ? 0 : Math.PI, 0, 0]));
    g.add(new THREE.Mesh(merged(ends), lambert(tip, { emissive: 0x1f6a5a, emissiveIntensity: 0.3 })));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.18, 3).translate(0, 0, -0.31), lambert(string)));
    return g;
  },
  // aljava de couro nas costas com flechas de penas coloridas (osso do peito)
  quiver({ color = 0x6a3a22, band = 0xe8c060, fletch = 0x3fe0b0 } = {}) {
    const g = new THREE.Group(), tilt = [0.25, 0, -0.45];
    g.add(new THREE.Mesh(merged([piece(new THREE.CylinderGeometry(0.13, 0.1, 0.62, 8), [0.12, 0.25, -0.45], tilt)]), lambert(color)));
    g.add(new THREE.Mesh(merged([0.5, 0.05].map((y) => piece(new THREE.TorusGeometry(0.125, 0.02, 4, 10), [0.12 - y * 0.2, y, -0.45 + y * 0.12], [Math.PI / 2 + 0.25, 0, -0.45]))), lambert(band)));
    const shafts = [], feathers = [];
    for (let i = 0; i < 4; i++) {
      const x = 0.27 + (i % 2) * 0.05 - i * 0.03, z = -0.49 + (i % 2) * 0.05;
      shafts.push(piece(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 3), [x, 0.65, z], tilt));
      feathers.push(piece(new THREE.ConeGeometry(0.045, 0.14, 3), [x + 0.06, 0.8, z + 0.03], tilt));
    }
    g.add(new THREE.Mesh(merged(shafts), lambert(0xd8c0a0)));
    g.add(new THREE.Mesh(merged(feathers), lambert(fletch)));
    return g;
  },
  // colar de contas grandes de madeira com uma conta vermelha no meio (monge)
  beads({ color = 0x7a3a1a, gem = 0xd8343a } = {}) {
    const wood = [], red = [];
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * 0.1 + (i / 12) * Math.PI * 0.8, at = [Math.cos(a) * 0.36, -0.08 - Math.sin(a) * 0.06, Math.sin(a) * 0.34];
      (i === 6 ? red : wood).push(piece(new THREE.IcosahedronGeometry(i === 6 ? 0.07 : 0.05, 0), at));
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(merged(wood), lambert(color)), new THREE.Mesh(merged(red), lambert(gem, { emissive: 0x4a0a0a, emissiveIntensity: 0.4 })));
    return g;
  },
  // faixa de pano cruzando o peito em diagonal e nó com pontas no quadril (monge)
  sash({ color = 0xc8401a } = {}) {
    const parts = [piece(new THREE.TorusGeometry(0.42, 0.06, 4, 18), [0, 0.12, 0], [Math.PI / 2, 0.75, 0], [1.05, 0.85, 1])];
    for (const s of [-1, 1]) parts.push(piece(new THREE.BoxGeometry(0.1, 0.34, 0.035), [0.24 + s * 0.05, -0.32, 0.3], [0.1, 0, s * 0.18]));
    return new THREE.Mesh(merged(parts), lambert(color, { side: THREE.DoubleSide }));
  },
  // óculos de proteção de latão erguidos na testa, lentes verdes e tira de couro (alquimista)
  goggles({ color = 0xc89a3a, lens = 0x9cff3a, strap = 0x4a2e18, y = 0.62 } = {}) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16, 1, true).translate(0, y, 0), lambert(strap, { side: THREE.DoubleSide })));
    g.add(new THREE.Mesh(merged([-1, 1].map((s) => piece(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 10), [s * 0.17, y + 0.03, 0.52], [Math.PI / 2 - 0.3, 0, 0]))), lambert(color, { emissive: 0x4a3000, emissiveIntensity: 0.3 })));
    const glass = merged([-1, 1].map((s) => piece(new THREE.CircleGeometry(0.09, 10), [s * 0.17, y + 0.045, 0.575], [-0.3, 0, 0])));
    g.add(new THREE.Mesh(glass, new THREE.MeshLambertMaterial({ color: lens, emissive: lens, emissiveIntensity: 0.5 })));
    return g;
  },
  // frasco redondo com gargalo, rolha e líquido que brilha (na mão ou no cinto)
  flask({ liquid = 0x9cff3a, size = 1, pos = [0, 0.12, 0.08] } = {}) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lambert(liquid, { emissive: liquid, emissiveIntensity: 0.45 })));
    g.add(new THREE.Mesh(merged([piece(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 6), [0, 0.13, 0]), piece(new THREE.CylinderGeometry(0.045, 0.04, 0.05, 6), [0, 0.2, 0])]), lambert(0xd8f0e8)));
    g.scale.setScalar(size);
    g.position.fromArray(pos);
    return g;
  },
  // cinto com três frascos coloridos pendurados na frente (alquimista)
  flaskBelt({ color = 0x4a2e18, buckle = 0xc89a3a } = {}) {
    const g = ACCESSORIES.wideBelt({ color, buckle, y: 0.12 });
    [[-0.3, 0x9cff3a], [0.3, 0xff8ad8], [0.05, 0x5fd0ff]].forEach(([x, liquid], i) => g.add(ACCESSORIES.flask({ liquid, size: 0.85, pos: [x + (i === 2 ? 0.2 : 0), -0.02, 0.42 - Math.abs(x) * 0.2] })));
    return g;
  },
  // cristal de gelo flutuando na mão
  iceShard() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshLambertMaterial({ color: 0xc8f4ff, emissive: 0x3aa8d8, emissiveIntensity: 0.6, flatShading: true }));
    c.scale.set(0.8, 1.8, 0.8);
    c.position.set(0, 0.2, 0.12);
    c.userData.spin = true;
    g.add(c);
    return g;
  },
};
