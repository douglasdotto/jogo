// Cenário pronto (KayKit Forest Nature Pack e Dungeon Pack, CC0): arbustos, capim e pedras do mundo e do
// mapa da campanha, e peças do salão do trono. Cada modelo vira { geometry, material } para InstancedMesh.
// Carrega só quando pedido (preloadSceneryAssets) e nunca rejeita: se algo faltar, quem usa cai no procedural.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FOREST_DIR = 'assets/kaykit/forest/Assets/gltf/';
const DUNGEON_DIR = 'assets/kaykit/dungeon/Assets/gltf/';
// variantes leves (até ~500 triângulos), várias por tipo para não repetir a mesma silhueta. As árvores ficam
// procedurais (copas redondas); do pack vêm arbustos, capim e pedras. O primeiro é a base do atlas repintado.
export const FOREST_MODELS = ['Bush_1_C', 'Bush_1_D', 'Bush_3_B', 'Bush_4_D', 'Grass_1_B', 'Grass_2_B',
  'Rock_1_E', 'Rock_2_C', 'Rock_3_E', 'Rock_3_G', 'Rock_1_J', 'Rock_3_Q']
  .map((n) => `${n}_Color1`);
export const VILLAGE_MODELS = ['barrel_small', 'crates_stacked', 'chair', 'torch_mounted', 'banner_patternA_red'];
export const DUNGEON_MODELS = ['floor_tile_large', 'wall', 'pillar_decorated', 'pillar',
  'banner_thin_red', 'barrel_large', 'barrel_small_stack', 'chest_gold', 'candle_triple', 'sword_shield', 'rubble_large',
  ...VILLAGE_MODELS];
// enfeites da beira da estrada (acampamentos, ruínas, tochas, terras sombrias): carregam depois do mapa,
// sem segurar a tela de carregamento; viram poucas malhas fundidas por faixa (world.js, kitProps)
export const PROP_MODELS = ['torch_lit', 'candle_lit', 'candle_melted', 'table_small', 'table_medium_broken', 'stool',
  'bottle_A_green', 'bottle_B_brown', 'bottle_C_green', 'plate_food_B', 'keg', 'box_large', 'box_small', 'trunk_medium_A',
  'trunk_small_B', 'wall_half', 'wall_broken', 'column', 'rubble_half', 'sword_shield_broken', 'chest', 'coin_stack_small',
  'banner_thin_yellow', 'banner_patternB_blue'];
export const PROP_TREES = ['Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_2_A'].map((n) => `${n}_Color1`);

// lista de arquivos (para a tela de carregamento); castle = true inclui as peças do salão e da vila.
export function sceneryAssetFiles({ castle = false } = {}) {
  const files = FOREST_MODELS.flatMap((n) => [`${FOREST_DIR}${n}.gltf`, `${FOREST_DIR}${n}.bin`]);
  files.push(`${FOREST_DIR}forest_texture.png`);
  if (castle) {
    files.push(...DUNGEON_MODELS.flatMap((n) => [`${DUNGEON_DIR}${n}.gltf`, `${DUNGEON_DIR}${n}.bin`]));
    files.push(`${DUNGEON_DIR}dungeon_texture.png`);
  }
  return files;
}

const cache = new Map();   // nome -> { geometry, material }
const packs = {};          // 'forest' | 'dungeon' | 'props' | 'propTrees' -> Promise<boolean>
const sharedByDir = {};    // pacotes da mesma pasta usam o mesmo atlas: um material (e uma textura) só
let loader = null;

// Junta as malhas do gltf (com a transformação de cada nó) numa geometria só, com um material Lambert
// compartilhado por pacote (todos usam o mesmo atlas). Marcado keep: o dispose de um mapa não libera.
function extract(gltf, shared) {
  const geos = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();   // sem normal o Lambert e a fusão (mergeGeometries) quebram
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    geos.push(g);
    if (!shared.material && o.material?.map) {
      const map = o.material.map;
      map.userData.keep = true;
      shared.material = new THREE.MeshLambertMaterial({ map });
      shared.material.userData.keep = true;
    }
  });
  if (!geos.length) return null;
  const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
  geometry.computeBoundingBox();
  geometry.userData.keep = true;
  return geometry;
}

function loadPack(key, dir, names) {
  if (packs[key]) return packs[key];
  loader ??= new GLTFLoader();
  const shared = (sharedByDir[dir] ??= { material: null });
  // cada modelo carrega por conta própria: o que chegar fica no cache mesmo se outro do pacote falhar.
  // true só com o pacote inteiro (quem precisa de todos continua no procedural)
  packs[key] = Promise.all(names.map((name) => loader.loadAsync(`${dir}${name}.gltf`)
    .then((gltf) => [name, extract(gltf, shared)])
    .catch((e) => { console.warn(`cenário pronto: ${name} não carregou`, e); return [name, null]; })))
    .then((list) => {
      if (!shared.material) return false;
      for (const [name, geometry] of list) if (geometry) cache.set(name, { geometry, material: shared.material });
      return list.every(([, g]) => g);
    })
    .catch((e) => { console.warn('cenário pronto não carregou; usando o procedural', e); return false; });
  return packs[key];
}

// Pré-carrega o necessário (Forest sempre; Dungeon quando o mapa pede castelo ou decoração da vila).
export function preloadSceneryAssets({ castle = false } = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);   // testes em Node: fica o procedural
  const forest = loadPack('forest', FOREST_DIR, FOREST_MODELS);
  if (!castle) return forest;
  return Promise.all([forest, loadPack('dungeon', DUNGEON_DIR, DUNGEON_MODELS)]).then(([a, b]) => a && b);
}
// Enfeites extras (Dungeon + árvores secas do Forest): pedidos pelo mapa depois de montado. Resolve quando os
// dois pacotes terminam (true se algum veio inteiro); quem usa monta por item o que estiver no cache.
export function preloadSceneryProps() {
  if (typeof document === 'undefined') return Promise.resolve(false);
  return Promise.all([loadPack('props', DUNGEON_DIR, PROP_MODELS), loadPack('propTrees', FOREST_DIR, PROP_TREES)])
    .then(([a, b]) => a || b);
}
export const sceneryModel = (name) => cache.get(name) || null;
export const sceneryReady = (names) => names.every((n) => cache.has(n));

// Atlas da floresta com a faixa das copas (canto superior esquerdo, verde) repintada nas cores do bioma:
// mantém o degradê claro→escuro da arte original. bark = [claro, escuro] repinta também a faixa dos troncos
// (logo abaixo; as árvores secas usam só ela). Cacheado por paleta e mantido entre mapas.
const atlases = new Map();
export function forestMaterial(light, dark, bark = null) {
  const key = `${light}|${dark}|${bark}`;
  if (atlases.has(key)) return atlases.get(key);
  const base = cache.get(FOREST_MODELS[0])?.material;
  if (!base) return null;
  const src = base.map.image, size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0, size, size);
  const paint = (top, bottom, row) => {
    const grad = ctx.createLinearGradient(0, row * size / 4, 0, (row + 1) * size / 4);
    grad.addColorStop(0, `#${new THREE.Color(top).getHexString()}`);
    grad.addColorStop(1, `#${new THREE.Color(bottom).getHexString()}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, row * size / 4, size / 8, size / 4);
  };
  if (light !== null) paint(light, dark, 0);
  if (bark) paint(bark[0], bark[1], 1);
  const map = new THREE.CanvasTexture(canvas);
  Object.assign(map, { flipY: base.map.flipY, colorSpace: base.map.colorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter });
  map.userData.keep = true;
  const material = new THREE.MeshLambertMaterial({ map });
  material.userData.keep = true;
  atlases.set(key, material);
  return material;
}
