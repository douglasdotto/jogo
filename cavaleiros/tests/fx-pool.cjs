// node cavaleiros/tests/fx-pool.cjs — estoque de materiais das partículas: reaproveita, não duplica e descarta o excesso.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'fx-pool.js'), 'utf8').replace(/^export /gm, '');
const context = vm.createContext({});
vm.runInContext(source, context);

let made = 0, disposed = 0;
const create = () => { made++; return { userData: {}, opacity: 1, color: { hex: 0, setHex(h) { this.hex = h; } }, dispose() { disposed++; } }; };
const pool = context.materialPool(create, 2);

const a = pool.take(0xff0000, 0.5);
assert.equal(a.color.hex, 0xff0000);
assert.equal(a.opacity, 0.5);
assert.equal(a.userData.pool, pool, 'o material sabe para qual estoque voltar');
pool.give(a);
pool.give(a);
assert.equal(pool.free, 1, 'devolver duas vezes não duplica o material no estoque');
const b = pool.take(0x00ff00, 0.9);
assert.equal(b, a, 'o material devolvido é reaproveitado');
assert.equal(b.color.hex, 0x00ff00, 'cor e opacidade são renovadas ao reaproveitar');
assert.equal(b.opacity, 0.9);
assert.equal(made, 1);

const extra = [pool.take(1), pool.take(2), pool.take(3)];
for (const m of [b, ...extra]) pool.give(m);
assert.equal(pool.free, 2, 'o estoque não passa do limite');
assert.equal(disposed, 2, 'o excesso é descartado de verdade');
console.log('OK: estoque de materiais das partículas reaproveita, ignora devolução dupla e descarta o excesso');
