// node cavaleiros/tests/asset-loading.cjs — verifica o carregamento tardio dos assets de combate.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const main = fs.readFileSync(path.resolve(__dirname, '..', 'main.js'), 'utf8');
const start = main.indexOf('const assetKey =');
const end = main.indexOf('async function loadAssets()', start);
assert.ok(start >= 0 && end > start, 'bloco de carregamento deve existir');
const heroLoadStart = end;
const heroLoadEnd = main.indexOf('// ---------- unidades ----------', heroLoadStart);
const heroLoadSource = main.slice(heroLoadStart, heroLoadEnd);

const classes = new Set();
const elements = {
  overlayText: { textContent: '' },
  overlayBtn: { hidden: false, textContent: '', onclick: null },
  overlay: { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } },
};
let failFirstAttempt = true;
const loaded = [];
const context = vm.createContext({
  assets: {},
  game: { paused: false, mission: null },
  load(file) {
    loaded.push(file);
    if (file === 'Skeleton_Arrow.gltf' && failFirstAttempt) {
      failFirstAttempt = false;
      return Promise.reject(new Error('simulated network failure'));
    }
    return Promise.resolve({ file });
  },
  $(id) { return elements[id]; },
  startGame() {},
  console: { error() {}, warn() {} },
});
vm.runInContext(main.slice(start, end), context);

async function run() {
  const required = ['Skeleton_Minion.glb', 'Skeleton_Warrior.glb', 'Skeleton_Rogue.glb', 'Skeleton_Crossbow.gltf',
    'Skeleton_Arrow.gltf', 'Skeleton_Blade.gltf', 'Skeleton_Axe.gltf', 'Skeleton_Shield_Small_A.gltf'];
  assert.deepEqual(Array.from(vm.runInContext('BATTLE_ASSET_FILES', context)), required);
  for (const file of required) assert.ok(!heroLoadSource.includes(file), `${file} não deve atrasar o menu`);
  assert.ok(heroLoadSource.includes('Skeleton_Staff.gltf') && heroLoadSource.includes('Skeleton_Quiver.gltf'),
    'peças necessárias às prévias dos heróis são carregadas antes do menu');

  let started = false;
  const firstAttempt = context.withBattleAssets(() => { started = true; context.game.paused = false; });
  assert.equal(context.game.paused, true, 'combate fica pausado enquanto os assets carregam');
  assert.equal(started, false, 'a partida não começa antes dos modelos');
  await firstAttempt;
  assert.equal(started, false, 'falha de rede não inicia a partida');
  assert.equal(elements.overlayBtn.hidden, false, 'falha oferece ação de retry');
  assert.match(elements.overlayText.textContent, /Verifique sua conexão/);

  await elements.overlayBtn.onclick();
  assert.equal(started, true, 'retry inicia a partida depois de carregar os modelos');
  assert.equal(context.game.paused, false);
  assert.ok(classes.has('hidden'), 'overlay some após o carregamento');
  assert.equal(elements.overlayBtn.hidden, true);

  const count = loaded.length;
  await context.ensureBattleAssets();
  assert.equal(loaded.length, count, 'assets já carregados não são pedidos de novo');
  for (const file of required) assert.ok(context.assets[file.replace(/\.(glb|gltf)$/, '')], file);
  console.log('OK: assets de combate carregam sob demanda, pausam o início, recuperam falha e ficam em cache');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
