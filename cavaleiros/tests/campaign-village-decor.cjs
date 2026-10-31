// node tests/campaign-village-decor.cjs — a vila do mapa usa peças medievais existentes no projeto.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const assets = fs.readFileSync(path.join(root, 'scenery-assets.js'), 'utf8');
const map = fs.readFileSync(path.join(root, 'campaign-map3d.js'), 'utf8');
const villageModels = ['barrel_small', 'crates_stacked', 'chair', 'torch_mounted', 'banner_patternA_red'];

assert.match(assets, /export const VILLAGE_MODELS\s*=\s*\[/, 'o kit da vila tem uma lista explícita');
assert.match(assets, /\.\.\.VILLAGE_MODELS/, 'as peças entram no carregamento do Dungeon pack');
for (const model of villageModels) {
  assert.match(assets, new RegExp(`['"]${model}['"]`), `${model} é carregado`);
  for (const ext of ['gltf', 'bin']) {
    assert.ok(fs.existsSync(path.join(root, 'assets', 'kaykit', 'dungeon', 'Assets', 'gltf', `${model}.${ext}`)), `${model}.${ext} existe`);
  }
  assert.match(map, new RegExp(`addVillageProp\\(g,\\s*['"]${model}['"]`), `${model} aparece junto às casas da vila`);
}
assert.match(map, /sceneryReady\(VILLAGE_MODELS\)/, 'o mapa usa o kit apenas quando os modelos estão prontos');
assert.match(map, /new THREE\.InstancedMesh\(model\.geometry,\s*model\.material/, 'os props preservam a textura e compartilham uma chamada de desenho por modelo');
assert.match(map, /fallbackVillageDecor/, 'a vila mantém um desenho procedural se o kit falhar');

console.log('OK: vila da campanha usa barris, caixas, cadeiras, tochas e estandarte do kit, com fallback procedural');
