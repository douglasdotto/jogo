// node cavaleiros/tests/scene-perf.cjs — ajudas de desempenho: faixas da natureza instanciada e
// liberação das texturas de ossos das unidades removidas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'scene-perf.js'), 'utf8').replace(/^export /gm, '');
const context = vm.createContext({});
vm.runInContext(`${source}\nthis.api = { disposeSkeletons, bandsByZ };`, context);
const { disposeSkeletons, bandsByZ } = context.api;

// faixas: cada ponto entra uma única vez, na faixa certa, mantendo a ordem original dentro dela
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const zs = Array.from({ length: 5000 }, () => 14 - rand() * 290);
const size = 32;
const bands = bandsByZ(zs, size);
const seen = new Array(zs.length).fill(0);
let lastKey = -Infinity;
for (const band of bands) {
  assert.ok(band.length > 0, 'sem faixas vazias');
  const key = Math.floor(zs[band[0]] / size);
  assert.ok(key > lastKey, 'faixas em ordem crescente de z');
  lastKey = key;
  for (let j = 0; j < band.length; j++) {
    const i = band[j];
    seen[i]++;
    assert.equal(Math.floor(zs[i] / size), key, 'cada ponto fica na sua faixa');
    if (j) assert.ok(band[j - 1] < i, 'ordem original preservada');
  }
}
assert.ok(seen.every((n) => n === 1), 'todo ponto aparece exatamente uma vez');
assert.ok(bands.length >= 9 && bands.length <= 11, `estrada de ~290 m vira ~10 faixas (${bands.length})`);
assert.deepEqual(JSON.parse(JSON.stringify(bandsByZ([], size))), []);
// a busca por faixa dá os mesmos pontos que a busca linear
for (const z of [-200, -31.9, 0, 13]) {
  const key = Math.floor(z / size);
  const linear = zs.map((v, i) => [v, i]).filter(([v]) => Math.floor(v / size) === key).map(([, i]) => i);
  const band = bands.find((b) => Math.floor(zs[b[0]] / size) === key) || [];
  assert.deepEqual([...band], linear);
}

// esqueletos: cada um liberado uma vez, mesmo quando duas malhas dividem o mesmo
const disposed = [];
const skeleton = (name) => ({ name, dispose() { disposed.push(name); } });
const shared = skeleton('compartilhado');
const nodes = [
  { isSkinnedMesh: true, skeleton: skeleton('corpo') },
  { isSkinnedMesh: true, skeleton: shared },
  { isSkinnedMesh: true, skeleton: shared },
  { isMesh: true },   // arma: malha comum, sem esqueleto
  { isBone: true },
];
const root = { traverse(fn) { nodes.forEach(fn); } };
assert.equal(disposeSkeletons(root), 2);
assert.deepEqual(disposed, ['corpo', 'compartilhado']);

console.log('scene-perf ok');
