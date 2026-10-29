// node cavaleiros/tests/scene-perf.cjs — ajudas de desempenho: faixas instanciadas,
// liberação de buffers de InstancedMesh e texturas de ossos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'scene-perf.js'), 'utf8').replace(/^export /gm, '');
const context = vm.createContext({});
vm.runInContext(`${source}\nthis.api = { disposeSkeletons, bandsByZ, gridCellKey, disposeInstancedMeshes, isInstancedBandVisible };`, context);
const { disposeSkeletons, bandsByZ, gridCellKey, disposeInstancedMeshes, isInstancedBandVisible } = context.api;

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
const packedKeys = new Set();
for (let x = -80; x <= 80; x++) for (let z = -300; z <= 40; z++) {
  const key = gridCellKey(x, z);
  assert.equal(typeof key, 'number', 'coordenadas do mapa usam chaves numéricas');
  packedKeys.add(key);
}
assert.equal(packedKeys.size, 161 * 341, 'chaves numéricas não colidem em coordenadas negativas nem positivas');
assert.equal(gridCellKey(-32768, 32767), -2147450881, 'fronteiras assinadas continuam exatas');
// Faixas fora do frustum não precisam enviar suas matrizes animadas à GPU.
const visibleSpheres = new Set(['perto']);
const observedSpheres = [];
const frustum = { intersectsSphere(sphere) { observedSpheres.push(sphere.id); return visibleSpheres.has(sphere.id); } };
const animatedBands = [{ boundingSphere: { id: 'perto' } }, { boundingSphere: { id: 'longe' } }];
const updatedBands = animatedBands.filter((band) => isInstancedBandVisible(frustum, band));
assert.deepEqual(updatedBands.map((band) => band.boundingSphere.id), ['perto']);
assert.deepEqual(observedSpheres, ['perto', 'longe']);
assert.equal(isInstancedBandVisible(null, animatedBands[1]), true, 'sem frustum, o helper preserva atualização segura');
assert.match(fs.readFileSync(path.join(__dirname, '..', 'world.js'), 'utf8'), /isInstancedBandVisible\(camera && animationFrustum, mesh\)/);
assert.match(fs.readFileSync(path.join(__dirname, '..', 'world.js'), 'utf8'), /isInstancedBandVisible\(camera && animationFrustum, left\)/);
// a busca por faixa dá os mesmos pontos que a busca linear
for (const z of [-200, -31.9, 0, 13]) {
  const key = Math.floor(z / size);
  const linear = zs.map((v, i) => [v, i]).filter(([v]) => Math.floor(v / size) === key).map(([, i]) => i);
  const band = bands.find((b) => Math.floor(zs[b[0]] / size) === key) || [];
  assert.deepEqual([...band], linear);
}

// InstancedMesh: ao trocar de mundo, buffers de GPU são liberados uma vez mesmo com raízes repetidas
let instanceDisposals = 0;
const instance = { isInstancedMesh: true, dispose() { instanceDisposals++; } };
const ordinary = { isInstancedMesh: false, dispose() { throw new Error('malha comum não deve ser descartada aqui'); } };
const instanceRoot = { traverse(fn) { [instance, ordinary].forEach(fn); } };
assert.equal(disposeInstancedMeshes([instanceRoot, instanceRoot]), 1);
assert.equal(instanceDisposals, 1);

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

// As borboletas são instanciadas em faixas, com cores, voo e asas espelhadas.
const worldSource = fs.readFileSync(path.join(__dirname, '..', 'world.js'), 'utf8');
const butterflySource = worldSource.split('// ---------- borboletas ----------')[1].split('// ---------- fogos-fátuos')[0];
assert.match(butterflySource, /new THREE\.InstancedMesh\(wingGeo/);
assert.match(butterflySource, /new THREE\.InstancedMesh\(mirroredWingGeo/);
assert.match(butterflySource, /mesh\.boundingSphere\.radius \+= 3\.5/);
assert.doesNotMatch(butterflySource, /new THREE\.Mesh\(/);

console.log('scene-perf ok');
