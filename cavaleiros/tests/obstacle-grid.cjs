// node tests/obstacle-grid.cjs — cobertura e redução de candidatos da grade de obstáculos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pasta = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(pasta, 'main.js'), 'utf8');
const perf = fs.readFileSync(path.join(pasta, 'scene-perf.js'), 'utf8').replace(/^export /gm, '');
const perfContext = vm.createContext({});
vm.runInContext(`${perf}\nthis.api = { gridCellKey };`, perfContext);
const gridCellKey = perfContext.api.gridCellKey;
const start = main.indexOf('const SEPARATION_CELL_SIZE = 3;');
const end = main.indexOf('function separate() {', start);
assert.ok(start >= 0 && end > start, 'grade espacial deve estar disponível');

let seed = 0x5eed1234;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
const obstacles = Array.from({ length: 2400 }, () => ({
  x: (random() - 0.5) * 1800,
  z: (random() - 0.5) * 1800,
  r: 0.2 + random() * 5,
}));
const world = { obstacles };
const context = vm.createContext({ world, gridCellKey });
const api = vm.runInContext(`${main.slice(start, end)}\n({ queryObstacleCandidates })`, context);
const obstacleIndex = new Map(obstacles.map((obstacle, index) => [obstacle, index]));

const checkQuery = (minX, maxX, minZ, maxZ, margin) => {
  const actual = api.queryObstacleCandidates(minX, maxX, minZ, maxZ, margin);
  const indices = actual.map((obstacle) => obstacleIndex.get(obstacle));
  assert.ok(indices.every(Number.isInteger), 'consulta devolve obstáculos da lista indexada');
  assert.equal(new Set(indices).size, indices.length, 'cada índice aparece uma vez mesmo em várias células');
  assert.deepEqual([...indices], [...indices].sort((a, b) => a - b), 'ordem original dos obstáculos é preservada');
  const found = new Set(indices);
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i], radius = obstacle.r + margin;
    const overlaps = obstacle.x + radius >= minX && obstacle.x - radius <= maxX
      && obstacle.z + radius >= minZ && obstacle.z - radius <= maxZ;
    if (overlaps) assert.ok(found.has(i), `grade perdeu obstáculo ${i} no AABB ${minX},${minZ}–${maxX},${maxZ}`);
  }
  return indices.length;
};

let totalCandidates = 0, queryCount = 0;
for (const margin of [0, 0.4, 1.2, 3.7]) {
  for (let i = 0; i < 180; i++) {
    const x = (random() - 0.5) * 1800, z = (random() - 0.5) * 1800;
    const width = random() * 8, depth = random() * 8;
    totalCandidates += checkQuery(x, x + width, z, z + depth, margin);
    queryCount++;
  }
}

// Diagonais, coordenadas negativas e pontos exatamente sobre bordas de célula.
for (const [x, z] of [[-6, -6], [-3, 0], [0, 3], [6, 6], [-0.001, 0.001]]) {
  const obstacle = { x, z, r: 0.65 };
  obstacles.push(obstacle);
  obstacleIndex.set(obstacle, obstacles.length - 1);
  checkQuery(x, x, z, z, 0.35);
}

// A grade deve reconstruir depois de um push no mesmo array.
const added = { x: 0, z: 0, r: 1 };
obstacles.push(added);
obstacleIndex.set(added, obstacles.length - 1);
assert.ok(checkQuery(-0.1, 0.1, -0.1, 0.1, 0.2) > 0);
assert.ok(api.queryObstacleCandidates(-0.1, 0.1, -0.1, 0.1, 0.2).includes(added), 'push invalida índice cacheado');

const average = totalCandidates / queryCount;
assert.ok(average < obstacles.length * 0.15, `AABBs curtos devem reduzir candidatos (${average.toFixed(1)} de ${obstacles.length})`);
console.log(`obstacle-grid ok — ${average.toFixed(1)} candidatos médios de ${obstacles.length} (${(average / obstacles.length * 100).toFixed(1)}%)`);
