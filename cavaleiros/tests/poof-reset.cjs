// node tests/poof-reset.cjs — limpeza de efeitos devolve materiais ao estoque.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const helperStart = source.indexOf('function releaseFxMaterial');
const helperEnd = source.indexOf('function updateFx', helperStart);
assert.notEqual(helperStart, -1, 'helper de ownership existe');
assert.notEqual(helperEnd, -1, 'clearFx vem antes do updateFx');
const cleanup = source.slice(helperStart, helperEnd);

let pooledReturns = 0, pooledDisposals = 0, plainDisposals = 0;
const removed = [];
const pooled = {
  userData: { pool: { give(material) { assert.equal(material, pooled); pooledReturns++; } } },
  dispose() { pooledDisposals++; },
};
const plain = { userData: {}, dispose() { plainDisposals++; } };
const fx = [{ material: pooled }, { material: plain }];
const context = vm.createContext({ fx, scene: { remove(mesh) { removed.push(mesh); } } });
vm.runInContext(cleanup, context);
vm.runInContext('clearFx()', context);

assert.equal(fx.length, 0, 'reset esvazia os efeitos ativos');
assert.equal(removed.length, 2, 'reset remove as duas malhas da cena');
assert.equal(pooledReturns, 1, 'material ativo é devolvido ao pool');
assert.equal(pooledDisposals, 0, 'material pooled não é descartado no reset');
assert.equal(plainDisposals, 1, 'material sem pool usa dispose como fallback');

assert.match(source, /function startGame\([^)]*\) \{[\s\S]*?\n  clearFx\(\);/, 'startGame usa o helper de limpeza');
assert.match(source, /function updateFx\(dt\) \{[\s\S]*?releaseFxMaterial\(m\.material\);/, 'expiração normal usa o mesmo helper de ownership');
console.log('OK: reset devolve materiais pooled e descarta os demais');
