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
vm.runInContext('globalThis.k={ARENA,NODE_TYPES,TERRAIN,waveSources,createArena,createKingdomState,canAfford,spend,refund,popCap,popUsed,heroCount,addBuilding,canPlaceBuilding,placeBuilding,removeBuilding,constructionRate,tickConstruction,enqueue,cancelQueue,tickProduction,nearestDrop,workerStep,tickWaves,kingdomResult,waveSize,wavePhase,waveInterval,waveLeaderFor,portalGuard,salvage,demolish,loseBuilding,canRepair,SALVAGE,REPAIR,MARKET,TRADE_RES,trade,tickMarket,buyPrice,sellPrice,hasMarket,orderLeg,nearestFoe,mergeKingdomRecord,saveKingdomRecord,loadKingdomRecords,kingdomRecordText,GUIDE,GUIDE_KEY,createGuide,guideStep,finishGuide,advanceGuide,BUILD_MENU,BUILDINGS,UNITS,START,GATHER,FIRST_WAVE,HERO_LIMIT,POP_MAX};', context);
const k = context.k;

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('OK:', name); } catch (error) { failed++; console.log('FALHOU:', name, '-', error.message); }
}
const make = () => ({ pos: new Vector3(), queue: [] });
function fresh() {
  const arena = k.createArena(7);
  const K = k.createKingdomState(arena, { count: 1, interval: 1, hp: 1 });
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
  assert.equal(arena.groundHeight(arena.castleAt.x + 6, arena.castleAt.z), 0, 'clareira do castelo plana');
  assert.equal(arena.canStep({ x: 0, z: 0 }, { x: 0, z: 1 }), true);
  assert.equal(arena.canStep({ x: 0, z: 0 }, { x: k.ARENA.W, z: 0 }), false, 'borda segura as unidades');
});

test('custos: gasta só quando dá, devolve ao cancelar', () => {
  const K = fresh();
  assert.deepEqual({ ...K.res }, { wood: k.START.wood, stone: k.START.stone, gold: k.START.gold, food: k.START.food });
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
  K.res.food = 1000; K.res.gold = 1000;
  const spawned = [];
  const spawn = (b, item) => { const u = { kind: item.kind }; spawned.push(u); return u; };
  for (let i = 0; i < 4; i++) K.units.push({ kKind: 'worker' });
  assert.equal(k.popUsed(K), 4);
  assert.equal(k.enqueue(K, K.castle, 'soldier'), 'invalid', 'castelo não treina soldado');
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'ok');
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'ok');
  assert.equal(K.res.food, 1000 - 2 * k.UNITS.worker.cost.food, 'paga ao entrar na fila');
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
  const food = K.res.food;
  assert.equal(k.cancelQueue(K, K.castle, 4), true);
  assert.equal(K.res.food, food + k.UNITS.worker.cost.food);
  K.res.food = 0;
  K.castle.queue.length = 0;
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'cost');
  assert.equal(K.castle.queue.length, 0);
});

test('produção: heróis custam caro e param em 4', () => {
  const K = fresh();
  K.res.wood = 5000; K.res.gold = 5000; K.res.food = 5000;
  for (let i = 0; i < 3; i++) K.units.push({ kKind: 'hero' });
  assert.equal(k.enqueue(K, K.castle, 'hero', { id: 'paladin' }), 'ok');
  assert.equal(k.heroCount(K), 4, 'conta quem está na fila');
  assert.equal(k.enqueue(K, K.castle, 'hero', { id: 'pyro' }), 'limit');
  assert.ok(k.UNITS.hero.cost.gold >= 150, 'custo alto');
  assert.equal(k.HERO_LIMIT, 4);
});

test('quartel: obra pronta treina soldados e besteiros', () => {
  const K = fresh();
  K.res.wood = 1000; K.res.gold = 1000; K.res.stone = 1000; K.res.food = 1000;
  const spot = K.arena.snap(3, K.castle.pos.x + 10, K.castle.pos.z + 10);
  const barracks = k.placeBuilding(K, 'barracks', spot.i0, spot.j0, make);
  assert.equal(k.enqueue(K, barracks, 'soldier'), 'invalid', 'em obra não treina');
  barracks.done = true;
  assert.equal(k.enqueue(K, barracks, 'soldier'), 'ok');
  assert.equal(k.enqueue(K, barracks, 'archer'), 'ok');
  assert.equal(k.enqueue(K, barracks, 'worker'), 'invalid');
});

test('ondas: primeira aos 3 min, crescem e trazem chefes; contador e intervalo', () => {
  assert.equal(k.FIRST_WAVE, 180);
  assert.ok(k.waveSize(1) <= 4 && k.waveSize(10) > k.waveSize(5) && k.waveSize(15) > 20, 'tamanho cresce');
  assert.equal(k.wavePhase(1), 1);
  assert.equal(k.wavePhase(30), 12, 'fase limitada a 12');
  assert.equal(k.waveLeaderFor(4), 'Golem');
  assert.equal(k.waveLeaderFor(6), 'King');
  assert.equal(k.waveLeaderFor(12), 'Executioner');
  assert.equal(k.waveLeaderFor(18), 'Lich');
  assert.ok(k.waveInterval(1) > k.waveInterval(15) && k.waveInterval(40) >= 75, 'ondas espaçadas');
  // a onda 15 chega entre 20 e 30 minutos
  let at = k.FIRST_WAVE;
  for (let n = 1; n < 15; n++) at += k.waveInterval(n);
  assert.ok(at > 20 * 60 && at < 30 * 60, `onda 15 aos ${(at / 60).toFixed(1)} min`);
  const K = fresh();
  const spawned = [], waves = [];
  K.onWave = (n) => waves.push(n);
  run(k.FIRST_WAVE - 1, (dt) => k.tickWaves(K, dt, (n, leader) => spawned.push([n, leader])));
  assert.equal(waves.length, 0, 'nada antes de 3 min');
  run(1.2 + k.waveSize(1) * 0.6, (dt) => k.tickWaves(K, dt, (n, leader) => spawned.push([n, leader])));
  assert.deepEqual(waves, [1]);
  assert.equal(spawned.length, k.waveSize(1), 'solta a onda inteira aos poucos');
  assert.ok(K.waveT > 90, 'contador da próxima onda reinicia');
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

// ---------- mapa: rio, pontes, covas e recursos ----------
const cellOf = (arena, p) => arena.nearestFree(arena.idxAt(p.x, p.z), p.x, p.z);
const pathBetween = (arena, a, b) => arena.findPath(arena.blocked[arena.idxAt(a.x, a.z)] ? cellOf(arena, a) : arena.idxAt(a.x, a.z), cellOf(arena, b));

test('mapa: há caminho do portal e de cada cova até o castelo, passando por ponte ou vau', () => {
  const K = fresh(), arena = K.arena, castle = K.castle.pos;
  const path = pathBetween(arena, arena.portalAt, castle);
  assert.ok(path && path.length > 10, 'portal → castelo');
  assert.ok(path.some((c) => arena.ground[c] === k.TERRAIN.BRIDGE || arena.ground[c] === k.TERRAIN.FORD), 'atravessa o rio por uma passagem');
  assert.equal(path.some((c) => arena.ground[c] === k.TERRAIN.WATER), false, 'nunca pela água');
  assert.ok(arena.entries.length >= 2, 'covas nas bordas');
  for (const e of arena.entries) {
    assert.ok(Math.hypot(e.x - castle.x, e.z - castle.z) > 30, 'cova longe da base');
    assert.ok(arena.walkable(e.x, e.z), 'boca da cova andável');
    assert.ok(pathBetween(arena, e, castle), `cova (${e.x}, ${e.z}) → castelo`);
  }
});

test('mapa: ponte atravessável, água segura e as passagens são os únicos caminhos pelo rio', () => {
  const arena = k.createArena(7);
  const b = arena.bridges[0];
  assert.ok(arena.bridges.length >= 2, 'duas pontes');
  const mid = { x: arena.riverX(b.z), z: b.z };
  assert.equal(arena.terrainAt(mid.x, mid.z), k.TERRAIN.BRIDGE);
  assert.equal(arena.blocked[arena.idxAt(mid.x, mid.z)], 0, 'ponte livre para o A*');
  assert.ok(arena.groundHeight(mid.x, mid.z) > 0.1, 'anda por cima do tabuado');
  assert.equal(arena.canStep({ x: mid.x - 3, z: mid.z }, { x: mid.x, z: mid.z }), true, 'entra na ponte');
  const river = { x: arena.riverX(b.z + 8), z: b.z + 8 };
  assert.equal(arena.terrainAt(river.x, river.z), k.TERRAIN.WATER);
  assert.equal(arena.canStep({ x: river.x - 4, z: river.z }, river), false, 'água segura a unidade');
  assert.ok(arena.groundHeight(river.x, river.z) < arena.waterY, 'leito abaixo da água');
  // fechando pontes e vau, o portal fica sem caminho
  const west = { x: -30, z: 0 };
  for (let i = 0; i < arena.cols * arena.rows; i++) if (arena.ground[i] === k.TERRAIN.BRIDGE || arena.ground[i] === k.TERRAIN.FORD) arena.blocked[i] = 2;
  assert.equal(pathBetween(arena, arena.portalAt, west), null, 'rio sem passagem separa os lados');
});

test('mapa: água, ponte, vau e borda não aceitam obra', () => {
  const arena = k.createArena(7);
  const find = (t) => { for (let i = 0; i < arena.cols * arena.rows; i++) if (arena.ground[i] === t) return [i % arena.cols, (i / arena.cols) | 0]; return null; };
  for (const t of [k.TERRAIN.WATER, k.TERRAIN.BRIDGE, k.TERRAIN.FORD, k.TERRAIN.CLIFF, k.TERRAIN.FOREST]) {
    const at = find(t);
    assert.ok(at, `tem terreno ${t}`);
    assert.equal(arena.canPlace(1, at[0], at[1]), false, `sem obra no terreno ${t}`);
  }
  assert.equal(arena.isShallow(arena.riverX(-26), -26), true, 'vau é raso (atrasa)');
  const e = arena.entries[0], at = arena.snap(2, e.x, e.z);
  assert.equal(arena.canPlace(2, at.i0, at.j0), false, 'boca da cova livre');
});

test('mapa: recursos alcançáveis da base; mais ricos no meio', () => {
  const arena = k.createArena(7);
  const seen = new Uint8Array(arena.cols * arena.rows), queue = [arena.idxAt(-30, 0)];
  seen[queue[0]] = 1;
  while (queue.length) {
    const c = queue.pop(), i = c % arena.cols, j = (c / arena.cols) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!arena.inGrid(i + di, j + dj)) continue;
      const n = arena.idx(i + di, j + dj);
      if (!seen[n] && arena.blocked[n] <= 1) { seen[n] = 1; queue.push(n); }   // árvore cortada abre passagem
    }
  }
  for (const n of arena.nodes) assert.ok(seen[n.cell], `${n.type} em (${n.x}, ${n.z}) alcançável`);
  for (const n of arena.nodes.filter((x) => x.type !== 'tree')) {
    const i = n.cell % arena.cols, j = (n.cell / arena.cols) | 0;
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([di, dj]) => arena.inGrid(i + di, j + dj) && arena.blocked[arena.idx(i + di, j + dj)] === 0 && seen[arena.idx(i + di, j + dj)]);
    assert.ok(open, `${n.type} em (${n.x}, ${n.z}) tem lado livre`);
  }
  for (const type of ['tree', 'berry', 'rock', 'mine']) assert.ok(arena.nodes.filter((n) => n.type === type).length >= 3, `vários ${type}`);
  assert.ok(arena.nodes.some((n) => n.type === 'berry' && Math.hypot(n.x - arena.castleAt.x, n.z - arena.castleAt.z) < 20), 'frutas perto da base');
  const rich = arena.nodes.filter((n) => n.type === 'mine' && n.rich > 1);
  assert.ok(rich.length >= 2 && rich.every((n) => n.x > -10), 'minas ricas longe da base');
});

test('ondas: vêm do portal e de covas alternadas; aviso sabe a origem da próxima', () => {
  assert.equal(JSON.stringify(k.waveSources(1, 3)), '[-1]');
  const a = k.waveSources(2, 3), b = k.waveSources(3, 3);
  assert.ok(a.includes(-1) && a.length === 2 && b.length === 2 && a[1] !== b[1], 'alterna a cova');
  assert.equal(k.waveSources(8, 3).length, 3, 'ondas grandes vêm de duas covas');
  const K = fresh();
  assert.equal(JSON.stringify(K.nextSources), '[-1]');
  K.waveN = 1; K.waveT = 0.05;
  const from = [];
  run(k.waveSize(2) * 0.6 + 1, (dt) => k.tickWaves(K, dt, (n, leader, src) => from.push(src)));
  assert.equal(from.length, k.waveSize(2));
  assert.ok(from.includes(-1) && from.some((s) => s >= 0), 'divide entre portal e cova');
  assert.equal(JSON.stringify(K.nextSources), JSON.stringify(k.waveSources(3, K.arena.entries.length)));
});

test('comida: frutas coletadas e entregues; fazenda produz sem fim, um aldeão por vez', () => {
  const K = fresh();
  const bush = K.arena.nearestNode('food', K.castle.pos.x, K.castle.pos.z);
  assert.equal(bush.type, 'berry');
  const w = worker(bush.x + 1.5, bush.z);
  w.task = { type: 'gather', node: bush, res: 'food' };
  const before = K.res.food;
  let dropped = false;
  for (let t = 0; t < 120 && !dropped; t += 0.1) dropped = k.workerStep(K, w, 0.1) === 'drop';
  assert.ok(dropped && Math.round(K.res.food - before) === k.GATHER.carry, 'entregou comida no castelo');
  assert.equal(K.stats.gathered.food, k.GATHER.carry);
  // fazenda
  K.res.wood = 500;
  const spot = K.arena.snap(2, K.castle.pos.x + 8, K.castle.pos.z - 8);
  const farm = k.placeBuilding(K, 'farm', spot.i0, spot.j0, make);
  assert.equal(K.res.wood, 500 - k.BUILDINGS.farm.cost.wood);
  assert.equal(farm.kNode, undefined, 'em obra não produz');
  farm.builders = 1;
  k.tickConstruction(K, k.BUILDINGS.farm.time + 1);
  assert.ok(farm.done && farm.kNode && K.arena.nodes.includes(farm.kNode), 'pronta vira fonte de comida');
  const f = worker(farm.pos.x + 3, farm.pos.z);
  f.task = { type: 'gather', node: farm.kNode, res: 'food' };
  const food = K.res.food;
  run(120, (dt) => k.workerStep(K, f, dt));
  assert.ok(K.res.food - food >= 3 * k.GATHER.carry, 'várias cargas da mesma fazenda');
  assert.equal(f.task.node, farm.kNode, 'continua na fazenda');
  assert.equal(farm.kNode.amount, Infinity, 'não esgota');
  const other = worker(farm.pos.x - 3, farm.pos.z);
  assert.notEqual(K.arena.nearestNode('food', farm.pos.x, farm.pos.z, 3, other), farm.kNode, 'fazenda ocupada fica para quem está nela');
  const node = farm.kNode;
  k.removeBuilding(K, farm);
  assert.equal(K.arena.nodes.includes(node), false, 'fazenda destruída some do mapa');
});

test('custos: aldeão pede comida, soldados comida e ouro; sem comida não treina', () => {
  assert.ok(k.UNITS.worker.cost.food > 0 && !k.UNITS.worker.cost.wood);
  assert.ok(k.UNITS.soldier.cost.food > 0 && k.UNITS.soldier.cost.gold > 0);
  assert.ok(k.UNITS.archer.cost.food > 0 && k.UNITS.archer.cost.wood > 0);
  assert.ok(k.UNITS.hero.cost.food > 0 && k.UNITS.hero.cost.gold >= 150);
  assert.ok(k.START.food >= 3 * k.UNITS.worker.cost.food, 'começo com comida para alguns aldeões');
  const K = fresh();
  K.res.food = 0;
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'cost');
  K.res.food = k.UNITS.worker.cost.food;
  assert.equal(k.enqueue(K, K.castle, 'worker'), 'ok');
  assert.equal(K.res.food, 0);
});

test('ondas: dificuldade muda intervalo e tamanho; Normal sem encolher; guarda do portal segue as ondas', () => {
  assert.equal(k.waveInterval(1, { interval: 1.15 }), k.waveInterval(1) * 1.15, 'Fácil espaça mais');
  assert.ok(k.waveInterval(5, { interval: 0.86 }) < k.waveInterval(5), 'Pesadelo encurta');
  assert.equal(k.waveSize(10, { count: 1 }), k.waveSize(10), 'Normal = base');
  assert.equal(k.waveSize(10), Math.round(3 + 9 * 1.6), 'sem o /1.1 que encolhia');
  assert.ok(k.waveSize(10, { count: 1.18 }) > k.waveSize(10));
  const K = fresh();
  K.D = { count: 1, interval: 1.15 };
  K.waveT = 0.01;
  k.tickWaves(K, 0.1, () => {});
  assert.ok(Math.abs(K.waveT - (k.waveInterval(1) * 1.15 - 0.09)) < 1e-6, 'tickWaves usa D.interval');
  assert.deepEqual({ ...k.portalGuard(0) }, { want: 3, phase: 1 });
  assert.ok(k.portalGuard(6).want > k.portalGuard(1).want && k.portalGuard(6).phase > k.portalGuard(1).phase, 'cresce com a onda');
  assert.equal(k.portalGuard(40).want, 10);
  assert.equal(k.portalGuard(40).phase, 12);
});

test('população: herói caído não ocupa vaga; obra derrubada devolve metade', () => {
  const K = fresh();
  K.units.push({ kKind: 'hero', dead: false }, { kKind: 'worker' });
  assert.equal(k.popUsed(K), 3);
  K.units[0].dead = true;
  assert.equal(k.popUsed(K), 1, 'herói caído libera 2');
  assert.equal(k.heroCount(K), 1, 'mas segue contando no limite');
  K.res.wood = 500; K.res.stone = 500;
  const spot = K.arena.snap(2, K.castle.pos.x + 8, K.castle.pos.z + 8);
  const tower = k.placeBuilding(K, 'tower', spot.i0, spot.j0, make);
  const wood = K.res.wood, stone = K.res.stone;
  k.loseBuilding(K, tower);
  assert.equal(K.res.wood, wood + Math.floor(k.BUILDINGS.tower.cost.wood * k.SALVAGE));
  assert.equal(K.res.stone, stone + Math.floor(k.BUILDINGS.tower.cost.stone * k.SALVAGE));
  assert.equal(K.arena.canPlace(2, spot.i0, spot.j0), true, 'grade livre');
  const house = k.addBuilding(K, 'house', spot.i0, spot.j0, make, true);
  const w2 = K.res.wood;
  k.loseBuilding(K, house);
  assert.equal(K.res.wood, w2, 'prédio pronto destruído não devolve');
});

test('reparo: aldeão conserta prédio pronto ferido gastando pouco; para cheio ou sem recurso', () => {
  const K = fresh();
  const spot = K.arena.snap(2, K.castle.pos.x + 9, K.castle.pos.z);
  const tower = k.addBuilding(K, 'tower', spot.i0, spot.j0, make, true);
  tower.hp = tower.maxHp / 2;
  K.res.wood = 1000; K.res.stone = 1000;
  const w = worker(K.castle.pos.x + 4, K.castle.pos.z);
  w.task = { type: 'build', site: tower };
  run(120, (dt) => { k.workerStep(K, w, dt); k.tickConstruction(K, dt); });
  assert.equal(tower.hp, tower.maxHp, 'cheio');
  assert.ok(Math.abs(K.res.stone - (1000 - k.BUILDINGS.tower.cost.stone * k.REPAIR.share / 2)) < 1e-6, 'custo proporcional à vida');
  assert.ok(Math.abs(K.res.wood - (1000 - k.BUILDINGS.tower.cost.wood * k.REPAIR.share / 2)) < 1e-6);
  assert.notEqual(w.task?.type, 'build', 'larga a tarefa quando cheio');
  // castelo também, com custo próprio; sem pedra para
  K.castle.hp = 1000;
  K.res.stone = 3;
  w.task = { type: 'build', site: K.castle };
  run(60, (dt) => { k.workerStep(K, w, dt); k.tickConstruction(K, dt); });
  assert.ok(K.castle.hp > 1000 && K.castle.hp < K.castle.maxHp, 'reparou só o que deu');
  assert.ok(K.res.stone >= 0 && K.res.stone < 0.02);
  assert.equal(k.canRepair(K, K.castle), false);
  assert.equal(w.task, null, 'sem recurso: para');
});

test('demolir: devolve metade, libera a grade e o castelo não sai', () => {
  const K = fresh();
  const spot = K.arena.snap(3, K.castle.pos.x + 10, K.castle.pos.z + 10);
  const barracks = k.addBuilding(K, 'barracks', spot.i0, spot.j0, make, true);
  K.res.food = 1000; K.res.gold = 1000;
  k.enqueue(K, barracks, 'soldier');
  const before = { ...K.res };
  assert.equal(k.demolish(K, barracks), true);
  assert.equal(K.res.wood, before.wood + k.BUILDINGS.barracks.cost.wood / 2);
  assert.equal(K.res.stone, before.stone + k.BUILDINGS.barracks.cost.stone / 2);
  assert.equal(K.res.gold, before.gold + k.UNITS.soldier.cost.gold, 'fila devolvida');
  assert.equal(K.buildings.includes(barracks), false);
  assert.equal(K.arena.canPlace(3, spot.i0, spot.j0), true);
  const wood = K.res.wood;
  k.loseBuilding(K, barracks);
  assert.equal(K.res.wood, wood, 'não devolve duas vezes');
  assert.equal(k.demolish(K, K.castle), false);
  assert.ok(K.buildings.includes(K.castle));
});

test('mercado: só com o prédio pronto; preço piora a cada troca e volta com o tempo', () => {
  const K = fresh();
  K.res.wood = 1000; K.res.gold = 1000;
  assert.ok(k.BUILD_MENU.includes('market'));
  assert.equal(k.BUILDINGS.market.cost.gold || 0, 0, 'não custa ouro (o ouro é o que falta)');
  assert.equal(k.trade(K, 'wood', false), false, 'sem mercado não troca');
  const spot = K.arena.snap(3, K.castle.pos.x + 10, K.castle.pos.z + 10);
  const site = k.addBuilding(K, 'market', spot.i0, spot.j0, make, false);
  assert.equal(k.trade(K, 'wood', false), false, 'obra não troca');
  site.done = true;
  const sell1 = k.sellPrice(K, 'wood');
  assert.equal(k.trade(K, 'wood', false), true);
  assert.equal(K.res.wood, 1000 - k.MARKET.lot);
  assert.equal(K.res.gold, 1000 + sell1);
  assert.ok(k.sellPrice(K, 'wood') < sell1, 'vender de novo rende menos');
  const buy1 = k.buyPrice(K, 'stone');
  assert.equal(k.trade(K, 'stone', true), true);
  assert.equal(K.res.stone, k.START.stone + k.MARKET.lot);
  assert.ok(k.buyPrice(K, 'stone') > buy1, 'comprar de novo custa mais');
  assert.ok(k.buyPrice(K, 'wood') > k.sellPrice(K, 'wood'), 'comprar e vender de volta dá prejuízo');
  K.res.gold = 0;
  assert.equal(k.trade(K, 'food', true), false, 'sem ouro não compra');
  assert.equal(k.trade(K, 'gold', false), false, 'ouro não é mercadoria');
  for (let i = 0; i < 60; i++) k.trade(K, 'wood', false), (K.res.wood = 1000);
  assert.equal(K.market.wood, k.MARKET.min, 'preço tem piso');
  run(400, (dt) => k.tickMarket(K, dt));
  for (const r of k.TRADE_RES) assert.ok(Math.abs(K.market[r] - k.MARKET.base) < 1e-9, `${r} volta ao normal`);
});

test('ordens: ataque-movendo termina no destino; patrulha troca de ponta; inimigo mais perto', () => {
  const o = { type: 'amove', x: 10, z: 0, bx: 0, bz: 0 };
  assert.equal(k.orderLeg(o, new Vector3(0, 0, 0)), 'go');
  assert.equal(k.orderLeg(o, new Vector3(10, 0, 0.3)), 'done');
  const p = { type: 'patrol', x: 10, z: 0, bx: 0, bz: 0 };
  assert.equal(k.orderLeg(p, new Vector3(10, 0, 0)), 'turn');
  assert.deepEqual([p.x, p.z, p.bx, p.bz], [0, 0, 10, 0], 'volta para o começo');
  assert.equal(k.orderLeg(p, new Vector3(10, 0, 0)), 'go');
  const foes = [{ pos: new Vector3(5, 0, 0) }, { pos: new Vector3(2, 0, 0), spawning: true }, { pos: new Vector3(3, 0, 0), dead: true }, { pos: new Vector3(4, 0, 0) }];
  assert.equal(k.nearestFoe(foes, new Vector3(0, 0, 0), 8), foes[3]);
  assert.equal(k.nearestFoe(foes, new Vector3(0, 0, 0), 3), null, 'fora do raio');
});

test('recordes do Reino: por dificuldade, melhor vitória e onda máxima', () => {
  const recs = {};
  assert.deepEqual({ ...k.mergeKingdomRecord(recs, 'normal', { won: false, time: 500, wave: 4 }) }, { time: false, wave: true });
  assert.equal(recs.normal.bestTime, null, 'derrota não marca tempo');
  assert.equal(k.kingdomRecordText(recs.normal), '☠ 4');
  assert.deepEqual({ ...k.mergeKingdomRecord(recs, 'normal', { won: true, time: 900.4, wave: 7 }) }, { time: true, wave: true });
  assert.deepEqual({ ...k.mergeKingdomRecord(recs, 'normal', { won: true, time: 1000, wave: 5 }) }, { time: false, wave: false });
  assert.deepEqual({ ...recs.normal }, { bestTime: 900, maxWave: 7 });
  assert.equal(k.kingdomRecordText(recs.normal), '♛ 15:00');
  assert.equal(recs.facil, undefined, 'cada dificuldade separada');
  const mem = { data: {}, getItem(key) { return this.data[key] ?? null; }, setItem(key, v) { this.data[key] = v; } };
  k.saveKingdomRecord('dificil', { won: true, time: 600, wave: 9 }, mem);
  assert.ok(mem.data['cavaleiros-reino-recordes']);
  assert.deepEqual({ ...k.loadKingdomRecords(mem).dificil }, { bestTime: 600, maxWave: 9 });
  assert.deepEqual({ ...k.loadKingdomRecords(undefined) }, {}, 'sem localStorage não quebra');
});

test('objetivos guiados: cada passo marca pelo que o jogador fez e a conclusão fica salva', () => {
  const mem = { data: {}, getItem(key) { return this.data[key] ?? null; }, setItem(key, v) { this.data[key] = v; } };
  const K = fresh();
  const g = k.createGuide(mem);
  assert.equal(g.open, true, 'primeira partida: lista aberta');
  assert.deepEqual([...k.GUIDE.map((s) => s.id)], ['select', 'wood', 'house', 'farm', 'barracks', 'soldier', 'tower', 'wave', 'portal']);
  assert.deepEqual([...k.advanceGuide(g, K, {}, mem)], [], 'nada feito ainda');
  assert.equal(k.guideStep(g).id, 'select');
  const w = worker(K.castle.pos.x + 5, K.castle.pos.z);
  w.kKind = 'worker';
  K.units.push(w);
  assert.deepEqual([...k.advanceGuide(g, K, { sel: [w] }, mem)], ['select']);
  assert.deepEqual([...k.advanceGuide(g, K, { sel: [] }, mem)], [], 'tirar a seleção não desmarca');
  w.task = { type: 'gather', node: null, res: 'stone' };
  k.advanceGuide(g, K, {}, mem);
  assert.equal(k.guideStep(g).id, 'wood', 'pedra não conta como madeira');
  w.task = { type: 'gather', node: null, res: 'wood' };
  assert.deepEqual([...k.advanceGuide(g, K, {}, mem)], ['wood']);
  // torre antes da casa: marca a torre, mas o passo atual continua a casa
  const at = (type, dx, dz) => { const s = K.arena.snap(k.BUILDINGS[type].size, K.castle.pos.x + dx, K.castle.pos.z + dz); return k.placeBuilding(K, type, s.i0, s.j0, make); };
  K.res.wood += 800; K.res.stone += 400;
  assert.equal(typeof at('tower', 8, 8), 'object');
  assert.deepEqual([...k.advanceGuide(g, K, {}, mem)], ['tower'], 'obra recém-posta já conta');
  assert.equal(k.guideStep(g).id, 'house');
  at('house', 8, -8); at('farm', 12, 0);
  assert.equal(typeof at('barracks', 14, 8), 'object');
  assert.deepEqual([...k.advanceGuide(g, K, {}, mem)], ['house', 'farm', 'barracks']);
  const barracks = K.buildings.find((b) => b.kType === 'barracks');
  barracks.done = true;
  K.res.food += 100; K.res.gold += 100;
  assert.equal(k.enqueue(K, barracks, 'soldier'), 'ok');
  assert.deepEqual([...k.advanceGuide(g, K, {}, mem)], ['soldier'], 'soldado na fila conta');
  // onda: só marca depois que a 1ª chegou e os esqueletos dela caíram (a guarda do portal não conta)
  K.waveN = 1; K.pending = 2;
  assert.deepEqual([...k.advanceGuide(g, K, { foes: 0 }, mem)], []);
  K.pending = 0;
  assert.deepEqual([...k.advanceGuide(g, K, { foes: 3 }, mem)], []);
  assert.deepEqual([...k.advanceGuide(g, K, { foes: 0 }, mem)], ['wave']);
  assert.equal(mem.data['cavaleiros-reino-tutorial'], undefined, 'ainda não terminou');
  K.portal = { dead: true };
  assert.deepEqual([...k.advanceGuide(g, K, {}, mem)], ['portal']);
  assert.equal(k.guideStep(g), null);
  assert.equal(mem.data['cavaleiros-reino-tutorial'], 'feito', 'conclusão salva');
  const next = k.createGuide(mem);
  assert.equal(next.open, false, 'próxima partida: só o botão ?');
  assert.equal(next.done.size, 0, 'progresso da partida começa do zero');
});

test('objetivos guiados: fechar a lista conta como visto; sem localStorage não quebra', () => {
  const mem = { data: {}, getItem(key) { return this.data[key] ?? null; }, setItem(key, v) { this.data[key] = v; } };
  const g = k.createGuide(mem);
  k.finishGuide(g, mem);
  assert.equal(k.createGuide(mem).open, false);
  const bad = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.equal(k.createGuide(bad).open, true);
  assert.doesNotThrow(() => k.finishGuide(k.createGuide(bad), bad));
  assert.equal(k.createGuide(undefined).open, true);
});

if (failed) { console.log(`${failed} teste(s) falharam`); process.exit(1); }
console.log('kingdom: tudo certo');
