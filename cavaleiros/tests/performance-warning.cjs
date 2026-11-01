const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'performance-warning.js'), 'utf8').replace(/^export /gm, '');
const context = vm.createContext({ Math, Number });
vm.runInContext(source, context);

const monitor = (options = {}) => context.createLowFpsMonitor(options);
const steady = monitor();
for (let i = 0; i < 300; i++) assert.equal(steady.sample(16, true), false, '60 FPS não deve gerar aviso');

const slow = monitor();
for (let i = 0; i < 124; i++) assert.equal(slow.sample(40, true), false, 'o aviso espera lentidão persistente');
assert.equal(slow.sample(40, true), true, 'cerca de 25 FPS por cinco segundos mostra o aviso');
assert.equal(slow.sample(40, true), false, 'o aviso aparece no máximo uma vez por sessão');

const interrupted = monitor();
for (let i = 0; i < 90; i++) interrupted.sample(40, true);
for (let i = 0; i < 20; i++) interrupted.sample(16, true);
for (let i = 0; i < 30; i++) interrupted.sample(40, true);
assert.equal(interrupted.sample(40, false), false, 'aba escondida limpa o período lento acumulado');
for (let i = 0; i < 124; i++) assert.equal(interrupted.sample(40, true), false, 'lentidão intermitente não avisa cedo');
assert.equal(interrupted.sample(40, true), true, 'o período lento só conta enquanto a página está ativa');

const resumed = monitor();
for (let i = 0; i < 90; i++) resumed.sample(40, true);
assert.equal(resumed.sample(1200, true), false, 'um retorno após longa suspensão não vira aviso falso');
for (let i = 0; i < 124; i++) assert.equal(resumed.sample(40, true), false, 'a medição recomeça após longa suspensão');
assert.equal(resumed.sample(40, true), true, 'FPS persistentemente baixo continua detectável');

console.log('OK: o aviso só aparece após FPS baixo persistente em aba visível e não se repete');
