// Jornada: node cavaleiros/tests/simulacao.cjs [dificuldade|todas] [partidas] [grupo] [semente] [detalhe]
// Campanha: node cavaleiros/tests/simulacao.cjs campanha <missao> <dificuldade|todas> [partidas] [grupo|recomendado|aleatorio] [semente] [detalhe]
// Exemplo rápido (2 por dificuldade): node cavaleiros/tests/simulacao.cjs campanha ponte todas 2 equilibrado 20261030 detalhe
// Sem navegador. O modo campanha roda combate/objetivos, mas ainda usa estrada reta,
// sem obstáculos, platôs ou lagos: não valida dificuldade de navegação/mapas sorteados.
// Um grupo opcional troca a seleção aleatória; a semente deixa o resultado reproduzível.
// Serve para calibrar dificuldades e heróis: mostra vitórias, fase média, quedas e dano por herói.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
const recipes = fs.readFileSync(path.join(dir, 'characters.js'), 'utf8');
const campaign = fs.readFileSync(path.join(dir, 'campaign.js'), 'utf8');
const classInfo = fs.readFileSync(path.join(dir, 'class-info.js'), 'utf8');
const skillbook = fs.readFileSync(path.join(dir, 'skillbook.js'), 'utf8');
const skillTargeting = fs.readFileSync(path.join(dir, 'skill-targeting.js'), 'utf8');
const synergies = fs.readFileSync(path.join(dir, 'synergies.js'), 'utf8');
const upgradeBranches = fs.readFileSync(path.join(dir, 'upgrade-branches.js'), 'utf8');
const battleReport = fs.readFileSync(path.join(dir, 'battle-report.js'), 'utf8');
const monsters = fs.readFileSync(path.join(dir, 'monsters.js'), 'utf8');
const progression = fs.readFileSync(path.join(dir, 'progression.js'), 'utf8');
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setY(y) { this.y = y; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this; }
  multiplyScalar(k) { this.x *= k; this.y *= k; this.z *= k; return this; }
  divideScalar(k) { return this.multiplyScalar(1 / k); }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { return this.divideScalar(this.length() || 1); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  distanceToSquared(v) { const x = this.x - v.x, y = this.y - v.y, z = this.z - v.z; return x * x + y * y + z * z; }
  distanceTo(v) { return Math.sqrt(this.distanceToSquared(v)); }
  lerp(v, k) { this.x += (v.x - this.x) * k; this.y += (v.y - this.y) * k; this.z += (v.z - this.z) * k; return this; }
  applyAxisAngle(_, a) { const x = this.x, z = this.z; this.x = x * Math.cos(a) + z * Math.sin(a); this.z = z * Math.cos(a) - x * Math.sin(a); return this; }
  project() { return this; }
  setScalar(k) { return this.set(k, k, k); }
}
const noop = () => {};
const el = () => ({ style: { setProperty: noop }, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, children: [], setAttribute: noop,
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); }, addEventListener: noop, querySelector: () => el(),
  querySelectorAll: () => [], remove: noop, firstChild: { style: {} }, innerHTML: '', textContent: '', scrollIntoView: noop });
const color = () => ({ set: noop, setHex: noop, lerpColors: noop, copy: noop });
const material = () => ({ color: color(), emissive: color(), dispose: noop });
const euler = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
const root = () => ({ position: new Vector3(), rotation: euler(), scale: new Vector3(1, 1, 1), quaternion: { setFromUnitVectors: noop },
  traverse: noop, add: noop, removeFromParent: noop, getObjectByName: () => ({ rotation: euler(), add: noop }), material: material(), children: [], rotateZ: noop, clone: root });
const action = () => ({ reset() { return this; }, setLoop() { return this; }, play() { return this; }, crossFadeFrom: noop, getClip: () => ({ duration: 1, name: 'Idle' }) });
const THREE = new Proxy({ Vector3, Mesh: class { constructor() { Object.assign(this, root()); } }, Group: class { constructor() { Object.assign(this, root()); } },
  MeshBasicMaterial: class { constructor() { Object.assign(this, material()); } }, MeshLambertMaterial: class { constructor() { Object.assign(this, material()); } },
  AnimationMixer: class { update() {} clipAction() { return action(); } stopAllAction() {} },
  AnimationClip: { findByName: (_, name) => ({ name, duration: 1 }) }, Clock: class { getDelta() { return 0.016; } },
  MathUtils: { clamp: (v, a, b) => Math.max(a, Math.min(v, b)) }, LoopOnce: 1, LoopRepeat: 2, RingGeometry: class {}, DoubleSide: 2 }, { get: (o, k) => k in o ? o[k] : class { constructor() { Object.assign(this, root()); } } });   // geometrias novas viram objetos simples
const asset = () => ({ scene: root(), animations: [] });
const assets = {};
for (const n of ['Minion', 'Warrior', 'Rogue', 'Mage', 'Blade', 'Axe', 'Shield_Small_A', 'Crossbow', 'Staff', 'Arrow']) assets['Skeleton_' + n] = asset();
assets.Barbarian = asset();   // aldeões da milícia
const stats = () => ({ dano: 0, recebido: 0, cura: 0, abates: 0, ataques: 0, habilidades: 0, criticos: 0, esquivas: 0, distancia: 0, tempo: 0 });
const context = vm.createContext({ THREE, document: { createElement: el, body: el(), getElementById: el }, URLSearchParams, location: { search: '?tudo=1' },   // todas as variantes liberadas
  addEventListener: noop, requestAnimationFrame: noop, hideTooltip: noop, logoSVG: () => "", tutorial: { on: noop, wants: () => false }, setTimeout: (fn) => fn(), clearTimeout: noop, innerWidth: 1440, innerHeight: 1000, aiming: null, battleGateId: 0, battleLoadingVisible: false,
  SkeletonUtils: { clone: root }, scene: { add: noop, remove: noop }, assets, ringGeo: {}, haloGeo: {}, goldMat: {}, starGeo: {}, puffGeo: {},
  boltGeo: {}, axeGeo: {}, bladeGeo: {}, handleGeo: {}, flameGeo: {}, groundGeo: {}, beamGeo: {}, boltMats: { viking: {}, iceviking: {}, arcane: {}, pyro: {} },
  newStats: stats, openHeroPanel: noop, closeHeroPanel: noop, panelHero: () => null, tickHeroPanel: noop, summaryHTML: () => '', LOOKS: {}, applyLook: noop,
  renderer: { render: noop, domElement: { addEventListener: noop } }, camera: { position: new Vector3() }, follow: new Vector3(), controls: { target: new Vector3(), update: noop },
  world: { obstacles: [], pointAt: (s) => new Vector3(0, 0, -s), tangentAt: () => new Vector3(0, 0, -1), sideOf: () => new Vector3(1, 0, 0), anchorS: (p) => p * 23,
    along: (s, x) => new Vector3(x, 0, -s), canStep: () => true, groundHeight: () => 0, isShallow: () => false, nextWaypoint: (a, b) => b, zoneOf: () => null },
  poof: noop, ring: noop, beam: noop, popText: noop, colors: {}, fx: [], bolts: [], blasts: [], flames: [], wave: noop, burst: noop, column: noop,
  FX: new Proxy({}, { get: () => noop }), clearFx: noop, popTextPool: { clear: noop }, audio: new Proxy({}, { get: () => noop }) });
const part = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b));
vm.runInContext(part(recipes, 'export const CHARACTERS', '// arquivos').replace('export ', ''), context);
vm.runInContext(campaign.replaceAll('export ', ''), context);
vm.runInContext(classInfo.replaceAll('export ', ''), context);
vm.runInContext(skillbook.replace(/^import .*$/gm, '').replaceAll('export ', ''), context);
vm.runInContext(skillTargeting.replaceAll('export ', ''), context);
vm.runInContext(synergies.replaceAll('export ', ''), context);
vm.runInContext(upgradeBranches.replaceAll('export ', ''), context);
vm.runInContext(battleReport.replaceAll('export ', ''), context);
vm.runInContext(monsters.replace(/^import .*$/gm, '').replace(/^export /gm, ''), context);
vm.runInContext(progression.replaceAll('export ', ''), context);   // sem localStorage: progressão só na memória, zerada
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'scene-perf.js'), 'utf8').replaceAll('export ', ''), context);   // disposeSkeletons
vm.runInContext(part(source, 'const ROAD', '// ---------- cena'), context);
vm.runInContext(part(source, 'const $', '// retrato de cada'), context);
vm.runInContext(part(source, 'let skillItems', 'function pressSkill'), context);   // glifos das habilidades usados na ficha da escolha
vm.runInContext(part(source, 'const units =', '// projéteis e áreas'), context);
vm.runInContext(part(source, 'function fireBolt', '// ---------- efeitos'), context);
vm.runInContext(part(source, 'function releaseFxMaterial(material) {', 'function clearFx()'), context);
vm.runInContext(part(source, 'class Hero', '// ---------- fases'), context);
vm.runInContext(part(source, '// ---------- fases', '// ---------- laço principal'), context);
const t = vm.runInContext(`({ units, heroes, game, pick, startGame, confirmPick, updateGame, showEvolution, separate, updateBolts, updateEnemyBolts,
  DIFFICULTIES, MISSIONS, Unit, progress, nightmareTeamIds, nightmareTeamPlanIds, showDifficulty, setMission: (m) => { game.mission = m; },
  setDifficulty: (d) => { difficulty = d; },
  setFrameTargetContext: () => { activeTargetContext = game.state === 'fight' && !game.paused && !game.over ? makeTargetContext(frameTargetContext) : null; },
  clearFrameTargetContext: () => { activeTargetContext = null; } })`, context);
// Captura o resultado calculado pelo runtime no encerramento, sem duplicar as regras de estrelas.
vm.runInContext(`
  globalThis.__campaignOutcome = null;
  const __missionEndOriginal = missionEnd;
  missionEnd = (won) => {
    // Espelha o valor usado pelas estrelas antes do encerramento poder alterar o estado.
    const villager = game.villager;
    const currentVillagerRatio = villager && villager.maxHp > 0
      ? Math.max(0, Math.min(1, villager.hp / villager.maxHp)) : null;
    const villagerRatio = ['escort', 'rescue'].includes(game.mission?.goal?.type)
      ? (game.missionVillagerRatio ?? currentVillagerRatio)
      : currentVillagerRatio;
    const stars = __missionEndOriginal(won);
    const party = heroes();
    globalThis.__campaignOutcome = {
      won: Boolean(won), stars, falls: game.falls,
      hpRatio: game.missionHpRatio ?? party.reduce((sum, h) => sum + Math.max(0, h.hp), 0) / Math.max(1, party.reduce((sum, h) => sum + h.maxHp, 0)),
      villagerRatio,
    };
    return stars;
  };
`, context);
// calibração sem meta-progressão: nada salvo antes, nada ganho durante (bônus de maestria/oficina mudariam os números)
const progressAtStart = JSON.stringify(t.progress.snapshot());
if (progressAtStart !== JSON.stringify(vm.runInContext('freshProgress()', context))) throw new Error('A simulação precisa começar com a progressão zerada');
for (const v of vm.runInContext('VARIANTS', context)) v.built = asset(), v.portraits = ['', '', ''];

function play(diff, profile, mission = null) {
  t.setDifficulty(diff);
  let nextProfileHero = 0;
  let initialHeroes = null;
  let initialParty = null;
  t.startGame();
  if (mission) {
    // Ignora somente a interface do mapa; dificuldade, seleção, startMission e combate são reais.
    t.setMission(mission);
    t.showDifficulty();
    t.confirmPick(Math.max(0, t.DIFFICULTIES.indexOf(diff)));
    vm.runInContext('globalThis.__campaignOutcome = null', context);
  } else {
    t.confirmPick(1);   // menu: Jornada completa
    t.confirmPick(Math.max(0, t.DIFFICULTIES.indexOf(diff)));
  }
  t.setDifficulty(diff);
  let time = 0, deaths = 0;
  const timeCap = mission ? 900 : 3600; // a campanha acaba em poucas fases; o timeout detecta stalls sem fingir vitória
  const dt = 1 / 30;
  const die = t.Unit.prototype.die;
  t.Unit.prototype.die = function () { if (this.team === 'hero') deaths++; return die.call(this); };
  while (!t.game.over && time < timeCap) {
    if (t.pick.open) {
      if (t.pick.mode === 'hero') {
        const free = t.pick.options.map((_, i) => i).filter((i) => !t.heroes().some((h) => h.cfg.id === t.pick.options[i].id));
        const wantedId = profile?.[nextProfileHero++];
        const wanted = wantedId ? t.pick.options.findIndex((option) => option.id === wantedId) : -1;
        t.confirmPick(free.includes(wanted) ? wanted : free[Math.floor(Math.random() * free.length)]);
        if (mission && initialHeroes == null && t.game.picksLeft === 0 && !t.pick.open) {
          initialParty = t.heroes().map((h) => h.cfg.id);
          initialHeroes = initialParty.length;
        }
      } else t.confirmPick(Math.floor(Math.random() * t.pick.cards.length));
      continue;
    }
    // O jogo captura um contexto tático por quadro antes de atualizar os heróis.
    // Compartilhá-lo aqui evita que a simulação tome decisões com listas diferentes por unidade.
    t.setFrameTargetContext();
    for (const u of [...t.units]) u.update(dt);
    t.clearFrameTargetContext();
    if (!t.game.over) t.separate();
    t.updateBolts(dt);
    t.updateEnemyBolts(dt);
    t.updateGame(dt);
    t.showEvolution();
    time += dt;
  }
  t.Unit.prototype.die = die;
  const won = mission
    ? Boolean(vm.runInContext('globalThis.__campaignOutcome?.won', context))
    : t.game.over && t.heroes().some((h) => !h.dead) && t.game.phase === 12;
  const outcome = mission ? vm.runInContext('globalThis.__campaignOutcome', context) : null;
  const villager = t.game.villager;
  const villagerRatio = Number.isFinite(outcome?.villagerRatio) ? outcome.villagerRatio
    : villager && villager.maxHp > 0 ? Math.max(0, Math.min(1, villager.hp / villager.maxHp)) : null;
  const describeUnit = (unit) => {
    if (!unit) return null;
    const pos = unit.pos || { x: 0, z: 0 };
    const kind = unit.enemyKind || unit.kind?.name || unit.nameTag?.textContent || (unit.totem ? 'Totem' : unit.team);
    return `${kind}@${pos.x.toFixed(1)},${pos.z.toFixed(1)}`;
  };
  const diagnostic = mission ? {
    simulatedSeconds: Number(time.toFixed(1)), timeCap, phase: t.game.phase, state: t.game.state, timer: t.game.timer, missionT: t.game.missionT,
    surviveT: t.game.surviveT, toSpawn: t.game.toSpawn, spawnTimer: t.game.spawnTimer,
    shrine: t.game.shrine ? { hp: Math.round(t.game.shrine.hp), maxHp: t.game.shrine.maxHp, dead: t.game.shrine.dead,
      pos: `${t.game.shrine.pos.x.toFixed(1)},${t.game.shrine.pos.z.toFixed(1)}` } : null,
    villager: t.game.villager ? { hp: Math.round(t.game.villager.hp), maxHp: t.game.villager.maxHp, dead: t.game.villager.dead,
      rescued: t.game.villager.rescued, captive: t.game.villager.captive } : null,
    skeletonCount: t.units.filter((u) => u.team === 'skeleton' && !u.dead).length,
    skeletons: t.units.filter((u) => u.team === 'skeleton' && !u.dead).slice(0, 40).map((u) => ({ kind: u.enemyKind || u.kind?.name || (u.totem ? 'Totem' : '?'),
      pos: `${u.pos.x.toFixed(1)},${u.pos.z.toFixed(1)}`, raider: Boolean(u.raider), spawning: Boolean(u.spawning),
      ranged: Boolean(u.ranged), mobile: Boolean(u.mobile), totem: Boolean(u.totem) })),
    heroes: t.heroes().map((h) => ({ id: h.cfg.id, dead: h.dead, hp: Math.round(h.hp),
      pos: `${h.pos.x.toFixed(1)},${h.pos.z.toFixed(1)}`, post: `${h.post.x.toFixed(1)},${h.post.z.toFixed(1)}`,
      range: h.range, ranged: Boolean(h.ranged), targetFocus: describeUnit(h.targetFocus), engagedWith: describeUnit(h.engagedWith) })),
  } : null;
  return { won, timedOut: mission ? !t.game.over : false, initialHeroes, initialParty, falls: outcome?.falls ?? t.game.falls,
    villagerRatio, phase: t.game.phase, deaths, kills: t.game.kills, time,
    party: t.heroes().map((h) => h.cfg.id), diagnostic,
    damage: t.heroes().map((h) => [h.cfg.id, h.stats.dano, h.stats.dano / Math.max(1, h.stats.tempo)]), ...(outcome || {}) };
}

const campaignMode = process.argv[2] === 'campanha';
const missionId = campaignMode ? process.argv[3] : null;
const which = campaignMode ? (process.argv[4] || 'todas') : (process.argv[2] || 'todas');
const runs = +(campaignMode ? process.argv[5] : process.argv[3]) || 10;
const profileName = campaignMode ? (process.argv[6] || 'aleatorio') : (process.argv[4] || 'aleatorio');
const seedArg = campaignMode ? process.argv[7] : process.argv[5];
const details = campaignMode ? process.argv[8] === 'detalhe' : process.argv[6] === 'detalhe';
const profiles = {
  inicial: ['paladin', 'berserker', 'pyro', 'assassin'],
  equilibrado: ['paladin', 'guardian', 'pyro', 'cleric'],
  sustentacao: ['guardian', 'cleric', 'druid', 'pyro'],
  laminas: ['champion', 'berserker', 'assassin', 'duelist'],
  novos: ['archer', 'monk', 'alchemist', 'paladin'],
  fazendas: ['paladin', 'viking', 'guardian', 'cleric'],
  cacada: ['paladin', 'guardian', 'viking', 'cleric'],
  chefes: ['paladin', 'guardian', 'viking', 'cleric'],
  elite: ['paladin', 'guardian', 'pyro', 'viking'],
  resgate: ['paladin', 'pyro', 'cleric', 'guardian'],
  resgate_anjo: ['paladin', 'guardian', 'angel', 'pyro'],
  resgate_suporte: ['paladin', 'guardian', 'angel', 'cleric'],
  trono_piro_arqueira: ['paladin', 'guardian', 'pyro', 'archer'],
  trono_arqueira_cleric: ['paladin', 'guardian', 'archer', 'cleric'],
  ruinas: ['paladin', 'pyro', 'cleric', 'guardian'],
};
const baseSeed = Number.isInteger(Number(seedArg)) ? Number(seedArg) >>> 0 : 20261028;
const campaignMission = campaignMode ? t.MISSIONS.find((m) => m.id === missionId) : null;
if (campaignMode && !campaignMission) throw new Error(`Missão desconhecida: ${missionId}. Use: ${t.MISSIONS.map((m) => m.id).join(', ')}`);
if (campaignMode && !['todas', ...t.DIFFICULTIES.map((d) => d.id)].includes(which)) throw new Error(`Dificuldade desconhecida: ${which}. Use: todas, ${t.DIFFICULTIES.map((d) => d.id).join(', ')}`);
const profile = campaignMode && profileName === 'recomendado'
  ? t.nightmareTeamPlanIds(campaignMission)
  : profiles[profileName];
if (profileName !== 'aleatorio' && !profile) throw new Error(`Grupo desconhecido: ${profileName}. Use: recomendado (campanha), ${Object.keys(profiles).join(', ')}`);
const vmMath = vm.runInContext('Math', context);
function useSeed(seed) {
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  Math.random = random;
  vmMath.random = random;
}
const damage = {};
// "original" = o jogo antes das dificuldades, para comparar
const original = { id: 'original', name: 'Original', hp: 1, dmg: 1, count: 1, interval: 1, boss: 1, heal: 0.35, revive: 0.4, reviveDelay: 0, behind: 0.25, behindFrom: 4, shooters: 0 };
const difficulties = campaignMode ? t.DIFFICULTIES : [original, ...t.DIFFICULTIES];
for (const diff of difficulties.filter((d) => which === 'todas' || d.id === which)) {
  const res = [];
  for (let i = 0; i < runs; i++) {
    useSeed(baseSeed + i * 2654435761);
    res.push(play(diff, profile, campaignMission));
  }
  for (const r of res) for (const [id, dmg, dps] of r.damage) (damage[id] ||= []).push([dmg, dps]);
  const avg = (f) => (res.reduce((s, r) => s + f(r), 0) / res.length).toFixed(1);
  if (campaignMode) {
    const stars = [0, 1, 2, 3].map((n) => res.filter((r) => r.stars === n).length);
    const withVillager = res.filter((r) => Number.isFinite(r.villagerRatio));
    const villager = withVillager.length ? `${Math.round(withVillager.reduce((sum, r) => sum + r.villagerRatio, 0) / withVillager.length * 100)}%` : '—';
    const incomplete = res.filter((r) => r.timedOut).length;
    console.log(`${diff.name.padEnd(9)} vitórias ${res.filter((r) => r.won).length}/${runs} · estrelas 0★:${stars[0]} 1★:${stars[1]} 2★:${stars[2]} 3★:${stars[3]} · quedas ${avg((r) => r.falls)} · aldeão médio ${villager}${incomplete ? ` · incompletas ${incomplete}` : ''}`);
    if (details) for (const [i, r] of res.entries()) {
      console.log(`  ${i + 1}: ${r.won ? 'vitória' : r.timedOut ? `incompleta na fase ${r.phase}` : `derrota na fase ${r.phase}`} · ${r.stars}★ · ${r.falls} quedas · aldeão ${Number.isFinite(r.villagerRatio) ? `${Math.round(r.villagerRatio * 100)}%` : '—'} · iniciais (${r.initialHeroes ?? '?'}): ${r.initialParty?.join(' + ') || '—'} · final: ${r.party.join(' + ')}`);
      if (!r.won && r.diagnostic) console.log(`    diagnóstico: ${JSON.stringify(r.diagnostic)}`);
    }
  } else {
    console.log(`${diff.name.padEnd(9)} vitórias ${res.filter((r) => r.won).length}/${runs} · fase média ${avg((r) => r.phase)} · quedas ${avg((r) => r.deaths)} · abates ${avg((r) => r.kills)} · derrotas nas fases ${res.filter((r) => !r.won).map((r) => r.phase).sort((x, y) => x - y).join(',') || '-'}`);
    if (details) for (const [i, r] of res.entries())
      console.log(`  ${i + 1}: ${r.won ? 'vitória' : `fase ${r.phase}`} · ${r.deaths} quedas · ${r.party.join(' + ')}`);
  }
}
console.log(`${campaignMode ? `Missão: ${campaignMission.name} · vagas iniciais: ${campaignMission.heroes} · grupo: ${profileName}` : `Grupo: ${profileName}`} · semente: ${baseSeed}`);
if (!campaignMode) console.log('Por herói (partidas em que estava no grupo): dano médio · dano por segundo em combate');
const mean = (list, k) => list.reduce((s, x) => s + x[k], 0) / list.length;
if (!campaignMode) for (const [id, list] of Object.entries(damage).sort((a, b) => mean(b[1], 1) - mean(a[1], 1)))
  console.log(`  ${id.padEnd(10)} ${String(Math.round(mean(list, 0))).padStart(6)} · ${mean(list, 1).toFixed(1).padStart(5)}/s (${list.length})`);
if (JSON.stringify(t.progress.snapshot()) !== progressAtStart) throw new Error('A simulação não pode acumular progressão entre partidas');
