// node cavaleiros/tests/simulacao.cjs [dificuldade|todas] [partidas] [grupo] [semente] [detalhe]
// Partidas inteiras sem navegador (estrada reta, sem platôs/lagos), heróis e melhorias aleatórios.
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
const root = () => ({ position: new Vector3(), rotation: { x: 0, y: 0, z: 0 }, scale: new Vector3(1, 1, 1), quaternion: { setFromUnitVectors: noop },
  traverse: noop, add: noop, removeFromParent: noop, getObjectByName: () => ({ add: noop }), material: material(), children: [], rotateZ: noop, clone: root });
const action = () => ({ reset() { return this; }, setLoop() { return this; }, play() { return this; }, crossFadeFrom: noop, getClip: () => ({ duration: 1, name: 'Idle' }) });
const THREE = new Proxy({ Vector3, Mesh: class { constructor() { Object.assign(this, root()); } }, Group: class { constructor() { Object.assign(this, root()); } },
  MeshBasicMaterial: class { constructor() { Object.assign(this, material()); } }, MeshLambertMaterial: class { constructor() { Object.assign(this, material()); } },
  AnimationMixer: class { update() {} clipAction() { return action(); } stopAllAction() {} },
  AnimationClip: { findByName: (_, name) => ({ name, duration: 1 }) }, Clock: class { getDelta() { return 0.016; } },
  MathUtils: { clamp: (v, a, b) => Math.max(a, Math.min(v, b)) }, LoopOnce: 1, LoopRepeat: 2, RingGeometry: class {}, DoubleSide: 2 }, { get: (o, k) => k in o ? o[k] : class { constructor() { Object.assign(this, root()); } } });   // geometrias novas viram objetos simples
const asset = () => ({ scene: root(), animations: [] });
const assets = {};
for (const n of ['Minion', 'Warrior', 'Rogue', 'Mage', 'Blade', 'Axe', 'Shield_Small_A', 'Crossbow', 'Staff', 'Arrow']) assets['Skeleton_' + n] = asset();
const stats = () => ({ dano: 0, recebido: 0, cura: 0, abates: 0, ataques: 0, habilidades: 0, criticos: 0, esquivas: 0, distancia: 0, tempo: 0 });
const context = vm.createContext({ THREE, document: { createElement: el, body: el(), getElementById: el }, URLSearchParams, location: { search: '?tudo=1' },   // todas as variantes liberadas
  addEventListener: noop, requestAnimationFrame: noop, setTimeout: (fn) => fn(), clearTimeout: noop, innerWidth: 1440, innerHeight: 1000, aiming: null, battleGateId: 0, battleLoadingVisible: false,
  SkeletonUtils: { clone: root }, scene: { add: noop, remove: noop }, assets, ringGeo: {}, haloGeo: {}, goldMat: {}, starGeo: {}, puffGeo: {},
  boltGeo: {}, axeGeo: {}, bladeGeo: {}, handleGeo: {}, flameGeo: {}, groundGeo: {}, beamGeo: {}, boltMats: { viking: {}, iceviking: {}, arcane: {}, pyro: {} },
  newStats: stats, openHeroPanel: noop, closeHeroPanel: noop, panelHero: () => null, tickHeroPanel: noop, summaryHTML: () => '', LOOKS: {}, applyLook: noop,
  renderer: { render: noop, domElement: { addEventListener: noop } }, camera: { position: new Vector3() }, follow: new Vector3(), controls: { target: new Vector3(), update: noop },
  world: { obstacles: [], pointAt: (s) => new Vector3(0, 0, -s), tangentAt: () => new Vector3(0, 0, -1), sideOf: () => new Vector3(1, 0, 0), anchorS: (p) => p * 23,
    along: (s, x) => new Vector3(x, 0, -s), canStep: () => true, groundHeight: () => 0, isShallow: () => false, nextWaypoint: (a, b) => b, zoneOf: () => null },
  poof: noop, ring: noop, beam: noop, popText: noop, colors: {}, fx: [], bolts: [], blasts: [], flames: [], wave: noop, burst: noop, column: noop,
  FX: new Proxy({}, { get: () => noop }), audio: new Proxy({}, { get: () => noop }) });
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
vm.runInContext(part(source, 'const ROAD', '// ---------- cena'), context);
vm.runInContext(part(source, 'const $', '// retrato de cada'), context);
vm.runInContext(part(source, 'let skillKey', 'function pressSkill'), context);   // glifos das habilidades usados na ficha da escolha
vm.runInContext(part(source, 'const units =', '// projéteis e áreas'), context);
vm.runInContext(part(source, 'function fireBolt', '// ---------- efeitos'), context);
vm.runInContext(part(source, 'class Hero', '// ---------- fases'), context);
vm.runInContext(part(source, '// ---------- fases', '// ---------- laço principal'), context);
const t = vm.runInContext(`({ units, heroes, game, pick, startGame, confirmPick, updateGame, showEvolution, separate, updateBolts, updateEnemyBolts,
  DIFFICULTIES, Unit, setDifficulty: (d) => { difficulty = d; } })`, context);
for (const v of vm.runInContext('VARIANTS', context)) v.built = asset(), v.portraits = ['', '', ''];

function play(diff, profile) {
  t.setDifficulty(diff);
  let nextProfileHero = 0;
  t.startGame();
  t.confirmPick(1);   // menu: Jornada completa
  t.confirmPick(Math.max(0, t.DIFFICULTIES.indexOf(diff)));
  t.setDifficulty(diff);
  let time = 0, deaths = 0;
  const dt = 1 / 30;
  const die = t.Unit.prototype.die;
  t.Unit.prototype.die = function () { if (this.team === 'hero') deaths++; return die.call(this); };
  while (!t.game.over && time < 3600) {
    if (t.pick.open) {
      if (t.pick.mode === 'hero') {
        const free = t.pick.options.map((_, i) => i).filter((i) => !t.heroes().some((h) => h.cfg.id === t.pick.options[i].id));
        const wantedId = profile?.[nextProfileHero++];
        const wanted = wantedId ? t.pick.options.findIndex((option) => option.id === wantedId) : -1;
        t.confirmPick(free.includes(wanted) ? wanted : free[Math.floor(Math.random() * free.length)]);
      } else t.confirmPick(Math.floor(Math.random() * t.pick.cards.length));
      continue;
    }
    for (const u of [...t.units]) u.update(dt);
    if (!t.game.over) t.separate();
    t.updateBolts(dt);
    t.updateEnemyBolts(dt);
    t.updateGame(dt);
    t.showEvolution();
    time += dt;
  }
  t.Unit.prototype.die = die;
  const won = t.game.over && t.heroes().some((h) => !h.dead) && t.game.phase === 12;
  return { won, phase: t.game.phase, deaths, kills: t.game.kills, time, party: t.heroes().map((h) => h.cfg.id), damage: t.heroes().map((h) => [h.cfg.id, h.stats.dano, h.stats.dano / Math.max(1, h.stats.tempo)]) };
}

const which = process.argv[2] || 'todas', runs = +process.argv[3] || 10;
const profiles = {
  inicial: ['paladin', 'berserker', 'pyro', 'assassin'],
  equilibrado: ['paladin', 'guardian', 'pyro', 'cleric'],
  sustentacao: ['guardian', 'cleric', 'druid', 'pyro'],
};
const profileName = process.argv[4] || 'aleatorio';
const profile = profiles[profileName];
if (profileName !== 'aleatorio' && !profile) throw new Error(`Grupo desconhecido: ${profileName}. Use: ${Object.keys(profiles).join(', ')}`);
const baseSeed = Number.isInteger(Number(process.argv[5])) ? Number(process.argv[5]) >>> 0 : 20261028;
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
for (const diff of [original, ...t.DIFFICULTIES].filter((d) => which === 'todas' || d.id === which)) {
  const res = [];
  for (let i = 0; i < runs; i++) {
    useSeed(baseSeed + i * 2654435761);
    res.push(play(diff, profile));
  }
  for (const r of res) for (const [id, dmg, dps] of r.damage) (damage[id] ||= []).push([dmg, dps]);
  const avg = (f) => (res.reduce((s, r) => s + f(r), 0) / res.length).toFixed(1);
  console.log(`${diff.name.padEnd(9)} vitórias ${res.filter((r) => r.won).length}/${runs} · fase média ${avg((r) => r.phase)} · quedas ${avg((r) => r.deaths)} · abates ${avg((r) => r.kills)} · derrotas nas fases ${res.filter((r) => !r.won).map((r) => r.phase).sort((x, y) => x - y).join(',') || '-'}`);
  if (process.argv[6] === 'detalhe') for (const [i, r] of res.entries())
    console.log(`  ${i + 1}: ${r.won ? 'vitória' : `fase ${r.phase}`} · ${r.deaths} quedas · ${r.party.join(' + ')}`);
}
console.log(`Grupo: ${profileName} · semente: ${baseSeed}`);
console.log('Por herói (partidas em que estava no grupo): dano médio · dano por segundo em combate');
const mean = (list, k) => list.reduce((s, x) => s + x[k], 0) / list.length;
for (const [id, list] of Object.entries(damage).sort((a, b) => mean(b[1], 1) - mean(a[1], 1)))
  console.log(`  ${id.padEnd(10)} ${String(Math.round(mean(list, 0))).padStart(6)} · ${mean(list, 1).toFixed(1).padStart(5)}/s (${list.length})`);
