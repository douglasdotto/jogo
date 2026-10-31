// Capítulo VII: Dragão de Ossos (voo, rasantes marcados, pouso exausto), Escavador, Porta-Estandarte,
// variações de chefe por missão (Rei Espectral, Carrasco Afogado) e o painel de ameaças.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'monsters.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setY(y) { this.y = y; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this; }
  multiplyScalar(k) { this.x *= k; this.y *= k; this.z *= k; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.set(this.x / l, this.y / l, this.z / l); }
}
class Group {
  constructor() { this.position = new Vector3(); this.rotation = { x: 0, y: 0, z: 0 }; this.scale = { set() {}, setScalar() {} }; this.children = []; this.userData = {}; this.visible = true; }
  add(...o) { this.children.push(...o); }
  removeFromParent() {}
}
class Material { constructor(o = {}) { Object.assign(this, o); this.color = { set() {} }; this.userData = {}; this.dispose = () => {}; } }
class Geometry {}
const THREE = {
  Vector3, Group, Mesh: Group, MeshLambertMaterial: Material, MeshBasicMaterial: Material,
  BoxGeometry: Geometry, SphereGeometry: Geometry, ConeGeometry: Geometry, CylinderGeometry: Geometry, OctahedronGeometry: Geometry,
  CircleGeometry: Geometry, RingGeometry: Geometry, PlaneGeometry: Geometry, TorusGeometry: Geometry, DoubleSide: 2,
};

function world() {
  const context = vm.createContext({ THREE, Math });
  vm.runInContext(source, context);
  const TYPES = vm.runInContext('MONSTER_TYPES', context);
  const units = [], banners = [];
  const hero = (x, z, extra = {}) => {
    const h = { team: 'hero', pos: new Vector3(x, 0, z), size: 1, dead: false, hp: 1000, maxHp: 1000, busy: 0, damage: 0, downs: 0,
      vel: new Vector3(), takeDamage(n, from, owner) { this.damage += n; this.hitHover = owner?.hover ?? 0; }, once(name) { if (name === 'Lie_Down') this.downs++; return 1; },
      action: () => ({ getClip: () => ({ duration: 1 }) }), ...extra };
    units.push(h);
    return h;
  };
  const make = (type, extra = {}) => {
    const root = new Group();
    root.getObjectByName = () => { const g = new Group(); root.add(g); return g; };
    root.traverse = () => {};
    const s = { team: 'skeleton', enemyKind: type, kind: TYPES[type], dead: false, stunT: 0, busy: 0, spawning: false, size: TYPES[type].size || 1,
      hp: 1000, maxHp: 1000, dmg: 10, speed: 1, cooldown: 2, attackTimer: 0, pos: new Vector3(), root, mats: [], boss: true, phaseBoss: true,
      vel: new Vector3(), once() { return 1; }, loop() {}, action: () => ({ getClip: () => ({ duration: 1 }) }), ...extra };
    units.push(s);
    s.kind.dress?.(s);
    return s;
  };
  context.api = {
    allies: () => units.filter((u) => u.team === 'hero'), heroes: () => units.filter((u) => u.team === 'hero'),
    skeletonsAlive: () => units.filter((u) => u.team === 'skeleton' && !u.dead), units,
    difficulty: { count: 1 }, scene: { add() {}, remove() {} },
    world: { groundHeight: () => 0, canStep: () => true, tangentAt: () => new Vector3(0, 0, -1), anchorS: (p) => p },
    game: { phase: 11, state: 'fight', mission: null },
    ring() {}, poof() {}, beam() {}, popText() {}, showBanner(text) { banners.push(text); }, markEmissiveDirty() {},
  };
  vm.runInContext('linkMonsters(api)', context);
  const step = (unit, t, dt = 1 / 30) => { for (let k = 0; k < t / dt; k++) { unit.busy = Math.max(0, unit.busy - dt); unit.kind.tick?.(unit, dt); vm.runInContext(`updateMonsterFx(${dt})`, context); } };
  return { context, TYPES, hero, make, step, banners, units, fx: () => vm.runInContext('mFx', context) };
}

// ---------- Dragão de Ossos ----------
{
  const { context, hero, make, step, banners, fx } = world();
  const PASS = vm.runInContext('DRAGON_PASS', context);
  const h = hero(0, 0);
  const d = make('BoneDragon');
  assert.equal(d.wings.length, 2, 'o dragão ganha duas asas procedurais');
  assert.ok(banners.includes('O Dragão de Ossos desperta!'));
  step(d, 0.5);
  assert.equal(d.flight, null, 'com vida cheia, fica no chão');
  // sopro de ossos: linha marcada antes do dano
  d.cd.breath = 0; d.pos.set(0, 0, 4);
  assert.equal(d.kind.think(d, 0, h), true);
  const breath = fx().find((f) => f.line && f.announce === 'Sopro de ossos — saia da linha');
  assert.ok(breath, 'o sopro marca uma linha no chão com aviso na barra do chefe');
  assert.equal(h.damage, 0, 'nada acerta antes do fim do aviso');
  step(d, 1.3);
  assert.ok(h.damage > 0 && h.poisonT > 0, 'quem fica na linha toma dano e veneno');

  // voo: abaixo de 72% levanta, marca a faixa ao longo da estrada e só então faz o rasante
  vm.runInContext('clearAfflictions()', context); h.damage = 0; h.pos.set(0, 0, 0); d.pos.set(3, 0, 0); d.hp = 700;
  step(d, 1 / 30);
  assert.ok(d.flight, 'abaixo de 72% o dragão levanta voo');
  assert.ok(banners.includes('O Dragão levanta voo!'));
  step(d, 1.2);
  assert.ok(d.hover > 2, 'sobe alto o bastante para fugir dos golpes corpo a corpo');
  const lane = fx().find((f) => f.line && f.announce === 'Rasante — saia da faixa');
  assert.ok(lane, 'o rasante é anunciado com uma faixa no chão');
  assert.equal(lane.line.len, PASS.len);
  assert.equal(h.damage, 0, 'a faixa avisa antes do rasante');
  d.stunT = 1;   // atordoar no ar não funciona
  step(d, PASS.mark + 1.2);
  assert.ok(h.damage > 0 && h.downs > 0, 'quem fica na faixa toma dano e é derrubado');
  assert.ok(h.hitHover < 0.85, 'no rasante passa rente ao chão: o golpe alcança o herói (e os golpes corpo a corpo alcançam o dragão)');
  // segunda passada, pouso marcado e janela de exaustão
  step(d, 6);
  assert.equal(d.flight, null, 'depois das passadas o dragão pousa');
  assert.ok(d.stunT > 0, 'pousa exausto: hora de bater');
  assert.ok(d.hover < 0.2);
  assert.equal(d.flights, 1, 'cada limiar de vida dispara um voo só');

  // em fúria: cauda em volta de si e rasantes com chuva de ossos
  d.stunT = 0; d.hp = 350; step(d, 1 / 30);
  assert.ok(d.enraged && d.flight && d.flight.passes === 3, 'segundo voo em fúria faz três passadas');
  step(d, 1.2);
  assert.ok(fx().some((f) => f.announce === 'Chuva de ossos — saia do círculo'), 'em fúria, ossos caem sobre outro herói');
  d.kind.death(d);
  assert.equal(d.hover, 0, 'morto no ar, cai no chão');
}

// ---------- Escavador de Ossos ----------
{
  const { hero, make, step, fx } = world();
  const h = hero(0, 0);
  const s = make('Burrower', { boss: false, phaseBoss: false, pos: new Vector3(0, 0, 6) });
  s.cd.burrow = 0;
  assert.equal(s.kind.think(s, 0, h), true, 'mergulha quando o herói está a meia distância');
  assert.ok(s.burrowed && s.untargetable && !s.root.visible, 'debaixo da terra fica invisível e fora do alcance');
  assert.ok(fx().some((f) => f.radius === 1.6 && !f.harmless), 'o círculo sob o herói avisa a erupção');
  step(s, 1.4);
  assert.ok(!s.burrowed && !s.untargetable && s.root.visible, 'irrompe e volta a ser alvo');
  assert.equal(s.pos.z, 0, 'sai onde o círculo estava');
  assert.ok(h.damage > 0 && h.downs > 0, 'quem ficou no círculo toma dano e é derrubado');
  assert.ok(s.stunT > 0, 'depois de irromper fica zonzo (contra-jogo)');
  // atordoado debaixo da terra: o aviso some e ele volta onde estava, sem golpear
  const h2 = hero(20, 0);
  const t = make('Burrower', { boss: false, phaseBoss: false, pos: new Vector3(20, 0, 6) });
  t.cd.burrow = 0; t.kind.think(t, 0, h2); t.stunT = 1;
  step(t, 0.1);
  assert.ok(!t.burrowed && t.root.visible && t.pos.z === 6 && h2.damage === 0, 'aviso desfeito não golpeia e devolve o escavador');
}

// ---------- Porta-Estandarte ----------
{
  const { make, step } = world();
  const b = make('Bannerbearer', { boss: false, phaseBoss: false });
  const near = make('Bomber', { boss: false, phaseBoss: false, pos: new Vector3(2, 0, 0), attackTimer: 1 });
  const far = make('Bomber', { boss: false, phaseBoss: false, pos: new Vector3(9, 0, 0), attackTimer: 1 });
  near.kind = far.kind = {};   // só o estandarte age
  step(b, 1);
  assert.ok(b.aura.visible, 'o anel laranja mostra o alcance');
  assert.ok(near.attackTimer < 0.6 && far.attackTimer === 1, 'só quem está dentro do anel ataca mais rápido');
  b.stunT = 1; near.attackTimer = 1; step(b, 0.5);
  assert.ok(!b.aura.visible && near.attackTimer === 1, 'atordoado, o estandarte para de inspirar');
}

// ---------- variações de chefe, ameaças e inimigos da missão ----------
{
  const { context, TYPES, make, banners } = world();
  const M = (code) => vm.runInContext(code, context);
  const dragonMission = { from: 10, to: 11, goal: { type: 'boss' }, boss: { phase: 11, kind: 'BoneDragon' }, foes: ['Burrower', 'Bannerbearer'] };
  context.dm = dragonMission;
  assert.equal(M('waveLeader(11, missionBossPhase(11, dm.boss), dm.boss)'), 'BoneDragon', 'a missão põe o dragão na fase 11');
  assert.equal(M('missionBossPhase(10, dm.boss)'), false);
  assert.equal(M('nextBossPhase(10, dm.boss)'), 11, 'o HUD anuncia o chefe na fase certa');
  assert.equal(M('nextBossPhase(10)'), 12, 'sem missão, a ordem original continua');
  assert.equal(M("waveLeader(9, true, { phase: 9, kind: 'King' })"), 'King');
  assert.equal(M('waveLeader(9, true)'), 'Executioner', 'sem troca, o Carrasco fecha a fase 9');
  const threats = M('campaignThreats(dm.from, dm.to, dm.goal, dm)');
  const ids = threats.map((t) => t.id);
  assert.ok(ids.includes('BoneDragon') && ids.includes('Burrower') && ids.includes('Bannerbearer'), 'o painel lista o dragão e os inimigos novos');
  assert.ok(!ids.includes('Lich'), 'a fase 12 não está no trecho');
  const ruins = M("campaignThreats(8, 10, { type: 'totems' }, { boss: { phase: 9, kind: 'King', mod: 'spectral' } })");
  const king = ruins.find((t) => t.id === 'King');
  assert.equal(king.name, 'Rei Espectral', 'a variação aparece com nome próprio');
  assert.ok(!ruins.some((t) => t.id === 'Executioner'), 'Ruínas não repete o Carrasco');
  assert.ok(!M("campaignThreats(8, 10, { type: 'totems' })").some((t) => t.id === 'Burrower'), 'inimigos do capítulo VII ficam só nas missões dele');

  // estreia dos inimigos da missão
  context.api.game.mission = dragonMission;
  const first = [M("pickMonster(10, 'Minion')"), M("pickMonster(10, 'Minion')")];
  assert.deepEqual(first, ['Burrower', 'Bannerbearer'], 'os dois inimigos novos estreiam na primeira onda');
  assert.ok(banners.includes('Novo inimigo: Escavador de Ossos!'));

  // Rei Espectral chama fantasmas; Carrasco Afogado marca a maré negra
  const spectral = make('King');
  context.sk = spectral;
  M("applyBossMod(sk, 'spectral')");
  assert.equal(spectral.kind.name, 'Rei Espectral');
  assert.ok(spectral.spectral && spectral.bossMod === 'spectral');
  assert.equal(TYPES.King.name, 'Rei Esqueleto', 'o tipo base não muda');
  const drowned = make('Executioner');
  context.dx = drowned;
  M("applyBossMod(dx, 'drowned')");
  const victim = { team: 'hero', pos: new Vector3(8, 0, 0), dead: false, size: 1, ranged: true, damage: 0, takeDamage(n) { this.damage += n; } };
  context.api.units.push(victim);
  drowned.cd = { ...drowned.cd, tide: 0, hook: 99, cleave: 99, whirl: 99 };
  assert.equal(drowned.kind.think(drowned, 0, victim), true, 'o Carrasco Afogado usa a maré antes dos golpes de sempre');
  assert.ok(M('mFx').some((f) => f.announce === 'Maré negra — saia do círculo'), 'a maré é anunciada no chão');
  drowned.cd.tide = 99;
  assert.equal(drowned.kind.think(drowned, 0, victim), false, 'sem maré pronta, volta ao comportamento do Carrasco');
}

console.log('OK: capítulo VII — dragão voa com rasantes marcados e pousa exausto, escavador e estandarte têm aviso e contra-jogo, variações de chefe no painel');
