// node cavaleiros/tests/loading-screen.cjs — tela de carregamento: espera ser pintada, progresso só sobe, fica o mínimo e não pisca.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'loading.js'), 'utf8')
  .replace(/^import .*$/m, '').replace(/^export /gm, '');
let clock = 0;
const waits = [];
const context = vm.createContext({ logoSVG: () => '<svg id="lg-gold"></svg>', setInterval: () => 1, clearInterval() {}, Math });
vm.runInContext(source, context);

const classes = new Set(['hidden']);
const vars = {};
const logo = { firstChild: null, innerHTML: '' };
const tip = { textContent: '', offsetWidth: 0, classList: { add() {}, remove() {} } };
const root = {
  classList: { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c) },
  style: { setProperty: (k, v) => { vars[k] = v; } },
  querySelector: (sel) => (sel === '.ld-logo' ? logo : tip),
};
const frames = [];
const screen = context.createLoadingScreen(root, {
  now: () => clock,
  nextFrame: (fn) => frames.push(fn),
  wait: (ms) => new Promise((resolve) => waits.push({ ms, resolve })),
});
const flush = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  assert.match(logo.innerHTML, /ld-lg-gold/, 'logo com ids próprios (o do menu pode estar escondido)');
  assert.equal(screen.visible, false);

  let painted = false;
  screen.show().then(() => { painted = true; });
  assert.equal(screen.visible, true);
  assert.ok(!classes.has('hidden'));
  assert.ok(tip.textContent.length > 0 && tip.textContent.length <= 40, 'dica curta, de uma linha');
  frames.shift()(); await flush();
  assert.equal(painted, false, 'espera dois quadros');
  frames.shift()(); await flush();
  assert.equal(painted, true, 'resolve depois que a tela foi pintada');

  screen.progress(0.5);
  screen.progress(0.2);
  assert.equal(vars['--p'], '0.500', 'progresso nunca volta');

  clock = 100;
  let hidden = false;
  screen.hide().then(() => { hidden = true; });
  await flush();
  assert.equal(waits[0].ms, 300, 'fica na tela até o mínimo de 400 ms');
  assert.equal(screen.visible, true);
  assert.equal(vars['--p'], '1.000');
  waits.shift().resolve(); await flush();
  assert.equal(hidden, true);
  assert.equal(screen.visible, false);
  assert.ok(classes.has('out'), 'some esmaecendo');

  // um novo carregamento durante a espera do mínimo não é escondido pelo anterior
  clock = 1000;
  screen.show();
  screen.hide();
  await flush();
  const pendingHide = waits.find((w) => w.ms === 400);
  screen.show();
  pendingHide.resolve(); await flush();
  assert.equal(screen.visible, true, 'o hide antigo não derruba o carregamento novo');

  screen.hide({ immediate: true });
  await flush();
  assert.equal(screen.visible, false, 'falha: sai na hora');
  console.log('OK: tela de carregamento pinta antes do trabalho, progresso só sobe, mínimo de 400 ms e sem piscar');
})().catch((error) => { console.error(error); process.exitCode = 1; });
