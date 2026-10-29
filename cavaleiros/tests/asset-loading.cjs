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
  await portraits();
}

// retratos: o menu não espera por eles; quem a tela pede fura a fila e o marcador é trocado no lugar
async function portraits() {
  assert.ok(!main.includes('await renderPortraits'), 'o menu não espera os retratos');
  assert.match(main, /preparePortraits\(\);\s*startGame\(\);/);
  const source = main.slice(main.indexOf('// retrato de cada'), main.indexOf('// ---------- barra de habilidades'));
  const renders = [];
  const node = () => ({ position: { set() {}, y: 0 }, rotation: {}, scale: { setScalar() {} }, add() {}, traverse() {}, lookAt() {} });
  const images = [];
  let blobs = 0, disposed = 0;
  const VARIANTS = ['a', 'b', 'c'].map((id) => ({ id, name: id, hide: [], idle: 'Idle', built: { scene: { id }, animations: [] } }));
  const ctx = vm.createContext({
    VARIANTS, haloGeo: {}, goldMat: {}, setTimeout, console: { warn() {} },
    document: { images },
    URL: { createObjectURL: () => `blob:${++blobs}` },
    SkeletonUtils: { clone: (scene) => ({ ...node(), id: scene.id }) },
    THREE: {
      WebGLRenderer: class {
        constructor() { this.domElement = { toBlob: (done) => setTimeout(() => done({}), 0) }; }
        setSize() {} dispose() { disposed++; }
        render(sc) { renders.push(sc.model.id); }
      },
      Scene: class { add(o) { if (o.id) this.model = o; } remove() { this.model = null; } },
      HemisphereLight: class {}, DirectionalLight: class { constructor() { Object.assign(this, node()); } },
      PerspectiveCamera: class { constructor() { Object.assign(this, node()); } },
      AnimationMixer: class { clipAction() { return { play() {} }; } update() {} },
      AnimationClip: { findByName: () => ({}) },
      Mesh: class { constructor() { Object.assign(this, node()); } },
    },
  });
  vm.runInContext(source, ctx);
  vm.runInContext('preparePortraits()', ctx);
  const [a, , c] = VARIANTS;
  const marker = c.portrait;
  assert.match(marker, /^data:image\/svg\+xml/, 'sem retrato ainda, devolve um marcador');
  assert.notEqual(marker, a.portrait, 'cada herói tem seu marcador');
  images.push({ getAttribute: () => marker, set src(url) { this.url = url; } });
  const wait = () => new Promise((resolve) => setTimeout(resolve, 5));
  for (let k = 0; k < 40 && blobs < 9; k++) await wait();
  assert.equal(renders[0], 'c', 'o retrato pedido pela tela vem antes da fila');
  assert.deepEqual([...renders].sort(), ['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c']);
  assert.match(images[0].url, /^blob:/, 'o marcador na tela vira o retrato');
  assert.equal(c.portrait, images[0].url);
  assert.deepEqual(Array.from(a.portraits, (url) => url.startsWith('blob:')), [true, true, true]);
  await wait();
  assert.equal(disposed, 1, 'o renderizador dos retratos sai quando todos ficam prontos');
  console.log('OK: retratos sob demanda não seguram o menu e ficam em cache');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
