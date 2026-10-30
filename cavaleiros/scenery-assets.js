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
export const DUNGEON_MODELS = ['floor_tile_large', 'wall', 'pillar_decorated', 'pillar',
  'banner_patternA_red', 'banner_thin_red', 'torch_mounted', 'barrel_large', 'barrel_small_stack', 'chest_gold',
  'crates_stacked', 'candle_triple', 'sword_shield', 'rubble_large'];

// lista de arquivos (para a tela de carregamento); castle = true inclui o Dungeon pack (só a fase 13 usa)
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
const packs = {};          // 'forest' | 'dungeon' -> Promise<boolean>
let loader = null;

// Junta as malhas do gltf (com a transformação de cada nó) numa geometria só, com um material Lambert
// compartilhado por pacote (todos usam o mesmo atlas). Marcado keep: o dispose de um mapa não libera.
function extract(gltf, shared) {
  const geos = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
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
  const shared = { material: null };
  packs[key] = Promise.all(names.map((name) => loader.loadAsync(`${dir}${name}.gltf`).then((gltf) => [name, extract(gltf, shared)])))
    .then((list) => {
      if (!shared.material || list.some(([, g]) => !g)) return false;
      for (const [name, geometry] of list) cache.set(name, { geometry, material: shared.material });
      return true;
    })
    .catch((e) => { console.warn('cenário pronto não carregou; usando o procedural', e); return false; });
  return packs[key];
}

// Pré-carrega o necessário (Forest sempre; Dungeon só com castle). Resolve true quando tudo chegou.
export function preloadSceneryAssets({ castle = false } = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);   // testes em Node: fica o procedural
  const forest = loadPack('forest', FOREST_DIR, FOREST_MODELS);
  if (!castle) return forest;
  return Promise.all([forest, loadPack('dungeon', DUNGEON_DIR, DUNGEON_MODELS)]).then(([a, b]) => a && b);
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
