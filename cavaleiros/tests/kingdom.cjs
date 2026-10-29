// node cavaleiros/tests/kingdom.cjs — regras do modo Reino (economia, construção, produção, ondas, fim) sem navegador.
// kingdom-world.js e kingdom.js rodam de verdade; só o three é um duplo mínimo.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '..');
const strip = (file) => fs.readFileSync(path.join(dir, file), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
}
const Dummy = class { constructor() { this.position = new Vector3(); } };
const THREE = new Proxy({ Vector3 }, { get: (o, k) => (k in o ? o[k] : Dummy) });
const context = vm.createContext({ THREE, Math, Uint8Array, Uint32Array, Int32Array, Float32Array, Map, Set, JSON, performance: { now: () => 0 } });
vm.runInContext(strip('kingdom-world.js'), context);
vm.runInContext(strip('kingdom.js'), context);
vm.runInContext('globalThis.k={ARENA,NODE_TYPES,createArena,createKingdomState,canAfford,spend,refund,popCap,popUsed,heroCount,addBuilding,canPlaceBuilding,placeBuilding,removeBuilding,constructionRate,tickConstruction,enqueue,cancelQueue,tickProduction,nearestDrop,workerStep,tickWaves,kingdomResult,waveSize,wavePhase,waveInterval,waveLeaderFor,BUILDINGS,UNITS,START,GATHER,FIRST_WAVE,HERO_LIMIT,POP_MAX};', context);
const k = context.k;

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('OK:', name); } catch (error) { failed++; console.log('FALHOU:', name, '-', error.message); }
}
const make = () => ({ pos: new Vector3(), queue: [] });
function fresh() {
  const arena = k.createArena(7);
  const K = k.createKingdomState(arena, { count: 1.1, hp: 1 });
  K.castle = k.addBuilding(K, 'castle', arena.castleCell.i0, arena.castleCell.j0, make, true);
  return K;
}
// aldeão de mentira: anda 3 m/s em linha reta até o alvo
const worker = (x, z) => ({ pos: new Vector3(x, 0, z), task: null, carry: 0, carryRes: null,
  goTo(tx, tz, dt) { const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz) || 1, s = Math.min(d, 3 * dt); this.pos.x += dx / d * s; this.pos.z += dz / d * s; } });
const run = (seconds, step) => { for (let t = 0; t < seconds; t += 0.1) step(0.1); };

test('arena aberta: castelo cabe na sua pegada, portal e recursos bloqueiam construção', () => {
  const arena = k.createArena(7);
  assert.ok(arena.canPlace(4, arena.castleCell.i0, arena.castleCell.j0), 'pegada do castelo livre');
  const nearPortal = arena.snap(2, arena.portalAt.x - 6, arena.portalAt.z);
  assert.equal(arena.canPlace(2, nearPortal.i0, nearPortal.j0), false, 'sem construir colado no portal');
  const node = arena.nodes.find((n) => n.type === 'tree');
  const onTree = arena.snap(1, node.x, node.z);
  assert.equal(arena.canPlace(1, onTree.i0, onTree.j0), false, 'árvore ocupa a célula');
  assert.equal(arena.canPlace(2, -1, 5), false, 'fora da arena');
  for (const type of ['tree', 'rock', 'mine']) assert.ok(arena.nodes.some((n) => n.type === type), `tem ${type}`);
  assert.ok(arena.nodes.some((n) => n.type === 'mine' && Math.hypot(n.x - arena.castleAt.x, n.z - arena.castleAt.z) < 20), 'mina perto do castelo');
  assert.equal(arena.groundHeight(3, 4), 0);
  assert.equal(arena.canStep({ x: 0, z: 0 }, { x: 0, z: 1 }), true);
  assert.equal(arena.canStep({ x: 0, z: 0 }, { x: k.ARENA.W, z: 0 }), false, 'borda segura as unidades');
});

test('custos: gasta só quando dá, devolve ao cancelar', () => {
  const K = fresh();
  assert.deepEqual({ ...K.res }, { wood: k.START.wood, stone: k.START.stone, gold: k.START.gold });
  assert.equal(k.canAfford(K, { wood: 999 }), false);
  assert.equal(k.spend(K, { wood: 999 }), false);
  assert.equal(K.res.wood, k.START.wood, 'falha não gasta nada');
  assert.equal(k.spend(K, { wood: 50, gold: 20 }), true);
  assert.equal(K.res.wood, k.START.wood - 50);
  k.refund(K, { wood: 50, gold: 20 });
  assert.equal(K.res.gold, k.START.gold);
});

test('economia: aldeão coleta 10, leva ao castelo, entrega e volta para a mesma árvore', () => {
  const K = fresh();
  const tree = K.arena.nearestNode('wood', K.castle.pos.x, K.castle.pos.z);
  const w = worker(K.castle.pos.x + 5, K.castle.pos.z);
  w.task = { type: 'gather', node: tree, res: 'wood' };
  const before = K.res.wood, amount = tree.amount;
  let delivered = -1;
  for (let t = 0; t < 120 && delivered < 0; t += 0.1) if (k.workerStep(K, w, 0.1) === 'drop') delivered = t;
  assert.ok(delivered > 0, 'entregou');
  assert.equal(Math.round(K.res.wood - before), k.GATHER.carry, 'entrega uma carga cheia');
  assert.equal(Math.round(amount - tree.amount), k.GATHER.carry, 'a árvore perdeu o que foi levado');
  assert.equal(w.carry, 0);
  assert.equal(w.task.node, tree, 'volta para a mesma árvore');
  assert.equal(Math.round(K.stats.gathered.wood), k.GATHER.carry);
  // ritmo: uma carga de madeira leva 10/0,8 = 12,5 s de corte mais a caminhada
  assert.ok(delivered >= 12.5 && delivered < 60, `tempo da viagem ${delivered.toFixed(1)} s`);
});

test('economia: árvore esgotada some e o aldeão procura outra perto; depósito encurta a viagem', () => {
  const K = fresh();
  const tree = K.arena.nearestNode('wood', K.castle.pos.x, K.castle.pos.z);
  tree.amount = 3;
  const w = worker(tree.x + 1.5, tree.z);
  w.task = { type: 'gather', node: tree, res: 'wood' };
  run(5, (dt) => k.workerStep(K, w, dt));
  assert.equal(K.arena.nodes.includes(tree), false, 'nó esgotado sai do mapa');
  assert.notEqual(w.task?.node, tree);
  assert.ok(w.carry > 2.9, 'continua com o que já pegou');
  const far = K.arena.nodes.find((n) => n.res === 'stone' && Math.hypot(n.x - K.castle.pos.x, n.z - K.castle.pos.z) > 25);
  const near = K.arena.snap(2, far.x + 4, far.z);
  for (let dz = 0; dz < 6 && !K.arena.canPlace(2, near.i0, near.j0 + dz); dz++) if (K.arena.canPlace(2, near.i0, near.j0 + dz + 1)) { near.j0 += dz + 1; break; }
  const store = k.addBuilding(K, 'storehouse', near.i0, near.j0, make, true);
  assert.equal(k.nearestDrop(K, { x: far.x, z: far.z }), store, 'depósito mais perto recebe a carga');
});

test('construção: posição válida gasta, inválida não; tempo com 1 e 2 aldeões; casa dá população', () => {
  const K = fresh();
  const spot = K.arena.snap(2, K.castle.pos.x + 8, K.castle.pos.z + 8);
  assert.equal(k.placeBuilding(K, 'house', K.castle.i0, K.castle.j0, make), 'blocked', 'em cima do castelo não');
  assert.equal(K.res.wood, k.START.wood, 'tentativa inválida não cobra');
  const house = k.placeBuilding(K, 'house', spot.i0, spot.j0, make);
  assert.equal(typeof house, 'object');
  assert.equal(K.res.wood, k.START.wood - k.BUILDINGS.house.cost.wood);
  assert.equal(k.placeBuilding(K, 'wall', spot.i0, spot.j0, make), 'blocked', 'célula ocupada pela obra');
  assert.equal(house.done, false);
  assert.ok(house.hp < house.maxHp * 0.2, 'obra começa frágil');
  assert.equal(k.popCap(K), 5);
  let t = 0;
  while (!house.done && t < 100) { house.builders = 1; k.tickConstruction(K, 0.1); t += 0.1; }
  assert.ok(Math.abs(t - k.BUILDINGS.house.time) < 0.25, `1 aldeão: ${t.toFixed(1)} s`);
  assert.equal(house.hp, house.maxHp);
  assert.equal(k.popCap(K), 10, 'casa pronta: +5');
  // obra parada não anda; duas mãos aceleram (1,6x)
  const spot2 = K.arena.snap(2, K.castle.pos.x + 8, K.castle.pos.z - 8);
  const house2 = k.placeBuilding(K, 'house', spot2.i0, spot2.j0, make);
  k.tickConstruction(K, 5);
  assert.equal(house2.progress, 0, 'sem aldeão a obra não anda');
  t = 0;
  while (!house2.done && t < 100) { house2.builders = 2; k.tickConstruction(K, 0.1); t += 0.1; }
  assert.ok(Math.abs(t - k.BUILDINGS.house.time / 1.6) < 0.25, `2 aldeões: ${t.toFixed(1)} s`);
  // o aldeão de verdade vai até a obra e conta como construtor
  const spot3 = K.arena.snap(2, K.castle.pos.x + 12, K.castle.pos.z);
  K.res.wood = 500;
  const site = k.placeBuilding(K, 'storehouse', spot3.i0, spot3.j0, make);
  const w = worker(K.castle.pos.x + 5, K.castle.pos.z + 3);
  w.task = { type: 'build', site };
  let built = false;
  run(40, (dt) => { k.workerStep(K, w, dt); k.tickConstruction(K, dt, () => (built = true)); });
  assert.equal(built, true);
  assert.equal(K.stats.built, 3);
});

test('construção: prédio destruído libera a grade', () => {
  const K = fresh();
  const spot = K.arena.snap(2, K.castle.pos.x + 8, K.castle.pos.z + 8);
  const house = k.placeBuilding(K, 'house', spot.i0, spot.j0, make);
  const solids = K.arena.obstacles.length;
  k.removeBuilding(K, house);
  assert.equal(K.arena.obstacles.length, solids - 1);
  assert.equal(K.arena.canPlace(2, spot.i0, spot.j0), true);
});

test('produção: fila no castelo, uma por vez, espera casa e devolve ao cancelar', () => {
  const K = fresh();
  K.res.wood = 1000; K.res.gold = 1000;
  const spawned = [];
  const spawn = (b, item) => { const u = { kind: item.kind }; spawned.push(u); return u; };
  for (let i = 0; i < 4; i++) K.units.push({ kKind: 'worker' });
  assert.equal(k.popUsed(K), 4);
  assert.equal(k.enqueue(K, K.castle, 'soldier'), 'invalid', 'castelo não treina soldado');
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'ok');
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'ok');
  assert.equal(K.res.wood, 1000 - 2 * k.UNITS.worker.cost.wood, 'paga ao entrar na fila');
  run(k.UNITS.worker.time + 0.05, (dt) => k.tickProduction(K, dt, spawn));
  assert.equal(spawned.length, 1, 'só a frente da fila anda');
  assert.equal(k.popUsed(K), 5);
  run(k.UNITS.worker.time * 2, (dt) => k.tickProduction(K, dt, spawn));
  assert.equal(spawned.length, 1, 'população cheia: espera');
  assert.equal(K.castle.queue[0].blocked, true);
  const spot = K.arena.snap(2, K.castle.pos.x + 8, K.castle.pos.z + 8);
  k.addBuilding(K, 'house', spot.i0, spot.j0, make, true);
  run(k.UNITS.worker.time + 0.2, (dt) => k.tickProduction(K, dt, spawn));
  assert.equal(spawned.length, 2, 'com casa, sai');
  for (let i = 0; i < 5; i++) k.enqueue(K, K.castle, 'worker');
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'full', 'fila de 5');
  const wood = K.res.wood;
  assert.equal(k.cancelQueue(K, K.castle, 4), true);
  assert.equal(K.res.wood, wood + k.UNITS.worker.cost.wood);
  K.res.wood = 0;
  K.castle.queue.length = 0;
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'cost');
  assert.equal(K.castle.queue.length, 0);
});

test('produção: heróis custam caro e param em 4', () => {
  const K = fresh();
  K.res.wood = 5000; K.res.gold = 5000;
  for (let i = 0; i < 3; i++) K.units.push({ kKind: 'hero' });
  assert.equal(k.enqueue(K, K.castle, 'hero', { id: 'paladin' }), 'ok');
  assert.equal(k.heroCount(K), 4, 'conta quem está na fila');
  assert.equal(k.enqueue(K, K.castle, 'hero', { id: 'pyro' }), 'limit');
  assert.ok(k.UNITS.hero.cost.gold >= 150, 'custo alto');
  assert.equal(k.HERO_LIMIT, 4);
});

test('quartel: obra pronta treina soldados e besteiros', () => {
  const K = fresh();
  K.res.wood = 1000; K.res.gold = 1000; K.res.stone = 1000;
  const spot = K.arena.snap(3, K.castle.pos.x + 10, K.castle.pos.z + 10);
  const barracks = k.placeBuilding(K, 'barracks', spot.i0, spot.j0, make);
  assert.equal(k.enqueue(K, barracks, 'soldier'), 'invalid', 'em obra não treina');
  barracks.done = true;
  assert.equal(k.enqueue(K, barracks, 'soldier'), 'ok');
  assert.equal(k.enqueue(K, barracks, 'archer'), 'ok');
  assert.equal(k.enqueue(K, barracks, 'worker'), 'invalid');
});

test('ondas: primeira aos 2 min, crescem e trazem chefes; contador e intervalo', () => {
  assert.equal(k.FIRST_WAVE, 120);
  assert.ok(k.waveSize(1) <= 4 && k.waveSize(10) > k.waveSize(5) && k.waveSize(15) > 20, 'tamanho cresce');
  assert.equal(k.wavePhase(1), 1);
  assert.equal(k.wavePhase(30), 12, 'fase limitada a 12');
  assert.equal(k.waveLeaderFor(4), 'Golem');
  assert.equal(k.waveLeaderFor(6), 'King');
  assert.equal(k.waveLeaderFor(12), 'Executioner');
  assert.equal(k.waveLeaderFor(18), 'Lich');
  assert.ok(k.waveInterval(1) > k.waveInterval(15) && k.waveInterval(40) >= 40);
  // a onda 15 chega entre 12 e 18 minutos
  let at = k.FIRST_WAVE;
  for (let n = 1; n < 15; n++) at += k.waveInterval(n);
  assert.ok(at > 12 * 60 && at < 18 * 60, `onda 15 aos ${(at / 60).toFixed(1)} min`);
  const K = fresh();
  const spawned = [], waves = [];
  K.onWave = (n) => waves.push(n);
  run(k.FIRST_WAVE - 1, (dt) => k.tickWaves(K, dt, (n, leader) => spawned.push([n, leader])));
  assert.equal(waves.length, 0, 'nada antes de 2 min');
  run(1.2 + k.waveSize(1) * 0.6, (dt) => k.tickWaves(K, dt, (n, leader) => spawned.push([n, leader])));
  assert.deepEqual(waves, [1]);
  assert.equal(spawned.length, k.waveSize(1), 'solta a onda inteira aos poucos');
  assert.ok(K.waveT > 50, 'contador da próxima onda reinicia');
  K.waveN = 5; K.waveT = 0.05;
  spawned.length = 0;
  run(k.waveSize(6) * 0.6 + 1, (dt) => k.tickWaves(K, dt, (n, leader) => spawned.push([n, leader])));
  assert.equal(spawned.at(-1)[1], 'King', 'o chefe fecha a onda 6');
  assert.equal(spawned.filter(([, leader]) => leader).length, 1);
});

test('vitória e derrota: portal caído vence, castelo caído perde', () => {
  const K = fresh();
  K.portal = { dead: false };
  assert.equal(k.kingdomResult(K), null);
  K.portal.dead = true;
  assert.equal(k.kingdomResult(K), 'won');
  K.portal.dead = false; K.castle.dead = true;
  assert.equal(k.kingdomResult(K), 'lost');
});

test('caminho: contorna uma muralha em vez de bater nela; alvo dentro de prédio aceita a borda', () => {
  const arena = k.createArena(7);
  const i = arena.colOf(-10);
  for (let j = arena.rowOf(-14); j <= arena.rowOf(14); j++) if (arena.blocked[arena.idx(i, j)] === 0) arena.occupy(1, i, j, { wall: true });
  const from = new Vector3(-16, 0, 0), to = new Vector3(-4, 0, 0);
  const way = arena.nextWaypoint(from, to);
  assert.notEqual(way, to, 'linha reta bloqueada');
  assert.ok(Math.abs(way.z) > 1, 'desvia para um lado');
  const K = fresh();
  const c = K.castle.pos;
  const w = K.arena.nextWaypoint(new Vector3(c.x + 10, 0, c.z), new Vector3(c.x, 0, c.z));
  assert.equal(w.x, c.x, 'mira o castelo direto, a parede dele não bloqueia o próprio alvo');
});

if (failed) { console.log(`${failed} teste(s) falharam`); process.exit(1); }
console.log('kingdom: tudo certo');
