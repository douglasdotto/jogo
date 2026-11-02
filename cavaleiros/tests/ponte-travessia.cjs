// node tests/ponte-travessia.cjs — o grupo (com Brutamontes, aldeão e milícia) atravessa a ponte do rio sem ninguém ficar preso.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createNavigationWorld } = require('./navigation-world.cjs');
const simSource = fs.readFileSync(path.join(__dirname, 'simulacao.cjs'), 'utf8');
const harnessEnd = simSource.indexOf('// Um interceptor');
const load = new Function('require', '__dirname', 'process', `${simSource.slice(0, harnessEnd)}\nreturn { t, vm, context };`);
const { t, vm, context } = load(require('node:module').createRequire(path.join(__dirname, 'x.cjs')), __dirname, { argv: [] });
for (const v of vm.runInContext('VARIANTS', context)) v.built = { scene: { traverse() {}, getObjectByName: () => ({ add() {} }) }, animations: [] };
const Hero = vm.runInContext('Hero', context);

// Obstáculos do rio: a ponte inteira (corrimão a corrimão) precisa ficar livre para heróis grandes.
const probe = createNavigationWorld({ THREE: vm.runInContext('THREE', context), Vector3: vm.runInContext('THREE.Vector3', context), seed: 11 });
const { cp, ct, cn, half } = probe.bridge;
for (const o of probe.obstacles) {
  const lateral = Math.abs((o.x - cp.x) * cn.x + (o.z - cp.z) * cn.z), along = Math.abs((o.x - cp.x) * ct.x + (o.z - cp.z) * ct.z);
  if (along < 6) assert.ok(lateral - o.r >= half, `obstáculo do rio invade a ponte (${lateral.toFixed(2)} - ${o.r.toFixed(2)})`);
}

function atravessa(party, seed) {
  const world = createNavigationWorld({ THREE: vm.runInContext('THREE', context), Vector3: vm.runInContext('THREE.Vector3', context), seed });
  t.setWorld(world);
  t.setDifficulty(t.DIFFICULTIES.find((d) => d.id === 'normal'));
  t.startGame(); t.setMission(t.MISSIONS.find((x) => x.id === 'ponte')); t.showDifficulty(); t.confirmPick(1);
  let picked = 0;
  while (t.pick.open && picked < 10) { const want = t.pick.options.findIndex((o) => o.id === party[picked]); picked++; t.confirmPick(want >= 0 ? want : 0); }
  for (const id of party) if (!t.heroes().some((h) => h.cfg.id === id)) new Hero(t.VARIANTS.find((v) => v.id === id));
  for (const h of t.heroes()) { while (h.level < 3) h.gainXp(400); h.size = h.heroSize(); }
  const s0 = world.bridge.s - 26, s1 = world.bridge.s + 26;
  t.game.guideS = s0;
  vm.runInContext('arrangeParty()', context);
  for (const h of t.heroes()) h.pos.copy(h.post);
  const dt = 1 / 30, heroes = t.heroes();
  const win = new Map(heroes.map((h) => [h, { x: h.pos.x, z: h.pos.z }]));
  let stalls = 0, time = 0;
  for (let f = 0; f < 150 * 30; f++, time += dt) {
    if (t.game.guideS < s1) t.game.guideS = Math.min(s1, t.game.guideS + 2.4 * dt);
    for (const h of heroes) h.setAnchor(t.game.guideS);
    for (const u of [...t.units]) u.update(dt);
    t.separate();
    if (f % 90 === 89) for (const h of heroes) {
      const w = win.get(h);
      if (Math.hypot(h.pos.x - w.x, h.pos.z - w.z) < 0.3 && h.pos.distanceTo(h.post) > 1.5) stalls++;
      w.x = h.pos.x; w.z = h.pos.z;
    }
    if (t.game.guideS >= s1 && heroes.every((h) => h.pos.distanceTo(h.post) < 0.8)) break;
  }
  return { stalls, time, longe: heroes.filter((h) => h.pos.distanceTo(h.post) >= 0.8).map((h) => h.cfg.id) };
}

for (const party of [['brute', 'paladin', 'cleric', 'archer'], ['brute', 'crusher', 'monk', 'engineer']]) for (const seed of [11, 5, 7]) {
  const r = atravessa(party, seed);
  assert.equal(r.longe.length, 0, `${party} sem. ${seed}: sem chegar ao posto: ${r.longe.join(",")} (${r.time.toFixed(0)} s)`);
  assert.equal(r.stalls, 0, `${party} sem. ${seed}: ${r.stalls} janelas de 3 s com herói parado longe do posto`);
  assert.ok(r.time < 60, `${party} sem. ${seed}: travessia lenta (${r.time.toFixed(0)} s)`);
}
console.log('ponte-travessia ok');
