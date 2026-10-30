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
world.obstacles = obstacles.slice(0, 300);
assert.strictEqual(api.queryObstacleCandidates(-2, 2, -2, 2, 1), world.obstacles, 'listas pequenas usam a busca linear, mais rápida');

const steer = (x, z, targetX, targetZ, size, candidates) => {
  let dx = targetX - x, dz = targetZ - z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.05) return [0, 0];
  dx /= distance; dz /= distance;
  for (const obstacle of candidates) {
    const ox = obstacle.x - x, oz = obstacle.z - z;
    const ahead = ox * dx + oz * dz;
    if (ahead <= 0 || ahead > 2.6 || ahead > distance) continue;
    const side = ox * -dz + oz * dx;
    const clear = obstacle.r + 0.5 * size;
    if (Math.abs(side) > clear) continue;
    const push = (1 - Math.abs(side) / clear) * (1.6 - ahead / 2.6);
    const direction = side >= 0 ? -1 : 1;
    const px = -dz, pz = dx;
    dx += px * direction * push;
    dz += pz * direction * push;
  }
  const length = Math.hypot(dx, dz) || 1;
  return [dx / length, dz / length];
};
let narrowDivergences = 0;
const compareSteering = (x, z, targetX, targetZ, size) => {
  const full = steer(x, z, targetX, targetZ, size, world.obstacles);
  const distance = Math.hypot(targetX - x, targetZ - z);
  const reach = Math.min(2.6, distance), margin = 0.5 * size;
  const initialX = (targetX - x) / distance, initialZ = (targetZ - z) / distance;
  const endX = x + initialX * reach, endZ = z + initialZ * reach;
  const narrow = api.queryObstacleCandidates(Math.min(x, endX), Math.max(x, endX), Math.min(z, endZ), Math.max(z, endZ), margin);
  const narrowVector = steer(x, z, targetX, targetZ, size, narrow);
  if (Math.hypot(full[0] - narrowVector[0], full[1] - narrowVector[1]) > 1e-8) narrowDivergences++;
  const nearby = api.queryObstacleCandidates(x - reach, x + reach, z - reach, z + reach, margin);
  const indexed = steer(x, z, targetX, targetZ, size, nearby);
  assert.ok(Math.hypot(full[0] - indexed[0], full[1] - indexed[1]) < 1e-12,
    `steering indexado divergiu em pos=${x.toFixed(2)},${z.toFixed(2)} alvo=${targetX.toFixed(2)},${targetZ.toFixed(2)}`);
  return nearby.length;
};

// Reproduz a sequência de 4 empurrões onde a caixa da direção inicial perdia o obstáculo 2918.
const repro = Array.from({ length: 3000 }, (_, i) => ({ x: 1000 + i * 2, z: 1000, r: 0.2 }));
repro[197] = { x: -2.80962345, z: -181.82991212, r: 0.71190950 };
repro[864] = { x: -0.66298941, z: -181.69784469, r: 3.31338259 };
repro[1895] = { x: -3.42413433, z: -185.79093539, r: 2.72632789 };
repro[2918] = { x: -2.27543890, z: -184.37515462, r: 0.48781402 };
world.obstacles = repro;
const reproX = -3.1980227946, reproZ = -182.6674408931, reproD = 4.7579021079;
const reproAngleX = 0.9775900087, reproAngleZ = 0.2105178730, reproSize = 1.2098387402;
compareSteering(reproX, reproZ, reproX + reproAngleX * reproD, reproZ + reproAngleZ * reproD, reproSize);
assert.ok(narrowDivergences > 0, 'o caso de regressão deve falhar com a caixa estreita antiga');

// Movimento sequencial com muitas sobreposições, raios variados e alvos curtos/longos.
world.obstacles = Array.from({ length: 3000 }, (_, i) => {
  const spread = i < 850 ? 24 : 360;
  return { x: (random() - 0.5) * spread, z: (random() - 0.5) * spread, r: 0.2 + random() * 3.6 };
});
let steeringCandidates = 0;
for (let i = 0; i < 1200; i++) {
  const x = (random() - 0.5) * 24, z = (random() - 0.5) * 24;
  const angle = random() * Math.PI * 2, distance = 0.08 + random() * 9;
  const size = 0.6 + random() * 2;
  steeringCandidates += compareSteering(x, z, x + Math.cos(angle) * distance, z + Math.sin(angle) * distance, size);
}

const average = totalCandidates / queryCount;
assert.ok(average < obstacles.length * 0.15, `AABBs curtos devem reduzir candidatos (${average.toFixed(1)} de ${obstacles.length})`);
assert.ok(steeringCandidates / 1200 < world.obstacles.length * 0.4,
  `steering deve manter vantagem da grade (${(steeringCandidates / 1200).toFixed(1)} de ${world.obstacles.length})`);
console.log(`obstacle-grid ok — ${average.toFixed(1)}/${obstacles.length} candidatos em consultas curtas; ${(steeringCandidates / 1200).toFixed(1)}/${world.obstacles.length} no steering, 1201 vetores equivalentes; ${narrowDivergences} divergências estreitas capturadas`);
