// node tests/bench-cleanup.cjs — o benchmark restaura os hooks mesmo se a preparação falhar.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'bench.js'), 'utf8').replace(/^export /gm, '');
const originalRAF = () => {};
const originalRender = () => {};
const context = vm.createContext({
  window: { requestAnimationFrame: originalRAF },
  location: { search: '?graficos=alta' },
  URLSearchParams,
  api: {
    renderer: { render: originalRender },
    game: { paused: false },
    isLowQuality() { throw new Error('preparação interrompida'); },
  },
});
vm.runInContext(`${source}\nthis.originalRandom = Math.random;`, context);

(async () => {
  await assert.rejects(vm.runInContext('runBench(api)', context), /preparação interrompida/);
  assert.equal(context.window.requestAnimationFrame, originalRAF);
  assert.equal(context.api.renderer.render, originalRender);
  assert.equal(vm.runInContext('Math.random === originalRandom', context), true);
  assert.equal(context.api.game.paused, true, 'o benchmark interrompido deixa a partida parada');
  console.log('OK: falha do benchmark restaura RAF, render e Math.random, e pausa a partida.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
