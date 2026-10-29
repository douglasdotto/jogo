// Modo Reino ("Defesa do Reino"): estratégia simplificada numa arena aberta.
// O jogador ergue a vila, os aldeões coletam madeira, pedra e ouro, o quartel treina soldados, o castelo
// recruta heróis e ondas crescentes de esqueletos saem do Portal de Ossos. Derrubar o portal vence; perder o castelo, não.
// O main.js entrega as peças do jogo em linkKingdom (unidades, cena, efeitos) e chama game.realm.tick/camera/stop.
import * as THREE from 'three';
import { ARENA, TERRAIN, createArena, buildArenaScene } from './kingdom-world.js';
import * as models from './kingdom-models.js';

const G = {};
export function linkKingdom(api) { Object.defineProperties(G, Object.getOwnPropertyDescriptors(api)); }

// ---------- regras ----------
export const RES = ['wood', 'stone', 'gold', 'food'];
export const RES_NAME = { wood: 'Madeira', stone: 'Pedra', gold: 'Ouro', food: 'Comida' };
export const START = { wood: 200, stone: 60, gold: 100, food: 200, workers: 4 };
export const GATHER = { wood: 0.8, stone: 0.6, gold: 0.6, food: 0.8, carry: 10 };
export const POP_MAX = 60;
export const HERO_LIMIT = 4;
export const HERO_REVIVE = 30;     // segundos até o herói caído voltar no castelo
const REACH = 1.0;                 // distância da borda do alvo para coletar, construir e entregar
const QUEUE_MAX = 5;

export const BUILDINGS = {
  castle: { name: 'Castelo', glyph: '♜', size: 4, hp: 2400, cost: {}, time: 0, pop: 5, drop: true, height: 8.2, trains: ['worker', 'hero'],
    attack: { range: 10, dmg: 9, cooldown: 1.6 }, tip: 'Recruta aldeões e heróis · recebe recursos · atira flechas' },
  house: { name: 'Casa', glyph: '⌂', size: 2, hp: 450, cost: { wood: 50 }, time: 16, pop: 5, height: 4.4, tip: '+5 de população' },
  farm: { name: 'Fazenda', glyph: '❀', size: 2, hp: 300, cost: { wood: 60 }, time: 14, height: 1.6, farm: true, tip: 'Comida sem fim · 1 aldeão' },
  storehouse: { name: 'Depósito', glyph: '▥', size: 2, hp: 550, cost: { wood: 80 }, time: 18, drop: true, height: 3.6, tip: 'Recebe recursos perto da coleta' },
  barracks: { name: 'Quartel', glyph: '⚔', size: 3, hp: 1100, cost: { wood: 150, stone: 40 }, time: 32, height: 4.6, trains: ['soldier', 'archer'], tip: 'Treina soldados e besteiros' },
  tower: { name: 'Torre', glyph: '♖', size: 2, hp: 750, cost: { wood: 50, stone: 120 }, time: 30, height: 8.6, attack: { range: 11, dmg: 15, cooldown: 1.3 }, tip: 'Atira nos esqueletos por perto' },
  wall: { name: 'Muralha', glyph: '▦', size: 1, hp: 400, cost: { stone: 10 }, time: 6, height: 2.8, tip: 'Bloqueia a passagem · Shift para várias' },
};
export const BUILD_MENU = ['house', 'farm', 'storehouse', 'barracks', 'tower', 'wall'];
export const UNITS = {
  worker: { name: 'Aldeão', glyph: '⚒', cost: { food: 50 }, time: 10, pop: 1, hp: 60, dmg: 3, range: 1.2, speed: 3.2, cooldown: 1.4, tip: 'Coleta, entrega e constrói' },
  soldier: { name: 'Soldado', glyph: '⚔', cost: { food: 60, gold: 20 }, time: 13, pop: 1, hp: 120, dmg: 11, range: 1.6, speed: 3, cooldown: 1.2, tip: 'Luta corpo a corpo' },
  archer: { name: 'Besteiro', glyph: '➶', cost: { wood: 40, food: 45 }, time: 15, pop: 1, hp: 70, dmg: 9, range: 8, speed: 3, cooldown: 1.7, ranged: true, tip: 'Atira de longe' },
  hero: { name: 'Herói', glyph: '♛', cost: { gold: 200, food: 100 }, time: 22, pop: 2, tip: `Herói com habilidades · até ${HERO_LIMIT}` },
};
export const PORTAL = { hp: 3500, guardEvery: 20, guardRadius: 15 };

// ondas: a primeira em 3 min, depois cada vez maiores e um pouco mais frequentes
export const FIRST_WAVE = 180;
export const waveInterval = (n) => Math.max(75, 110 - n * 2);
// de onde vem cada onda: -1 = Portal de Ossos; 0.. = covas da borda, alternando (uma, depois duas a partir da 6ª nas pares)
export function waveSources(n, entries = 0) {
  if (n <= 1 || !entries) return [-1];
  const a = (n - 2) % entries, out = [-1, a];
  if (n >= 6 && n % 2 === 0 && entries > 1) out.push((a + 1) % entries);
  return out;
}
export const waveSize = (n, D = null) => Math.max(2, Math.round((3 + (n - 1) * 1.6) * (D?.count ?? 1.1) / 1.1));
export const wavePhase = (n) => Math.min(12, 1 + Math.floor((n - 1) * 0.7));
export const waveLeaderFor = (n) => n % 6 === 0 ? (n >= 18 ? 'Lich' : n >= 12 ? 'Executioner' : 'King') : n % 4 === 0 ? 'Golem' : null;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createKingdomState(arena, D = null) {
  const entries = arena.entries?.length || 0;
  return { arena, D, res: { wood: START.wood, stone: START.stone, gold: START.gold, food: START.food }, buildings: [], units: [],
    waveN: 0, waveT: FIRST_WAVE, pending: 0, spawnT: 0, spawnK: 0, leader: null, time: 0, castle: null, portal: null,
    sources: [-1], nextSources: waveSources(1, entries),
    stats: { gathered: { wood: 0, stone: 0, gold: 0, food: 0 }, built: 0, trained: 0, lost: 0 } };
}
export const canAfford = (K, cost) => RES.every((r) => (K.res[r] || 0) >= (cost[r] || 0));
export function spend(K, cost) {
  if (!canAfford(K, cost)) return false;
  for (const r of RES) K.res[r] -= cost[r] || 0;
  return true;
}
export function refund(K, cost) { for (const r of RES) K.res[r] += cost[r] || 0; }
export const popCap = (K) => Math.min(POP_MAX, K.buildings.reduce((n, b) => n + (b.done && !b.dead ? b.def.pop || 0 : 0), 0));
export const popUsed = (K) => K.units.reduce((n, u) => n + (UNITS[u.kKind]?.pop || 0), 0);
export const heroCount = (K) => K.units.filter((u) => u.kKind === 'hero').length
  + K.buildings.reduce((n, b) => n + (b.queue || []).filter((q) => q.kind === 'hero').length, 0);

// prédio na grade: ocupa as células e vira obstáculo redondo para a física das unidades
export function addBuilding(K, type, i0, j0, make, done = false) {
  const def = BUILDINGS[type], arena = K.arena;
  const b = make(type, i0, j0, def);
  const c = arena.footprint(def.size, i0, j0);
  Object.assign(b, { kType: type, def, i0, j0, done, progress: done ? 1 : 0, builders: 0, queue: b.queue || [], rally: b.rally || null,
    reach: def.size * ARENA.CELL / 2 * 0.92, building: true });
  b.pos.x = c.x; b.pos.z = c.z;
  b.maxHp = def.hp;
  b.hp = done ? def.hp : Math.max(1, def.hp * 0.1);
  arena.occupy(def.size, i0, j0, b);
  b.solid = arena.addSolid({ x: c.x, z: c.z, r: b.reach });
  K.buildings.push(b);
  if (done) farmReady(K, b);
  return b;
}
export function canPlaceBuilding(K, type, i0, j0) { return K.arena.canPlace(BUILDINGS[type].size, i0, j0); }
export function placeBuilding(K, type, i0, j0, make) {
  if (!canPlaceBuilding(K, type, i0, j0)) return 'blocked';
  if (!spend(K, BUILDINGS[type].cost)) return 'cost';
  return addBuilding(K, type, i0, j0, make, false);
}
// fazenda pronta vira fonte de comida (nó sem célula própria, não esgota)
function farmReady(K, b) { if (b.def.farm && !b.kNode) b.kNode = K.arena.addFarmNode(b); }
export function removeBuilding(K, b) {
  const k = K.buildings.indexOf(b);
  if (k < 0) return;
  K.buildings.splice(k, 1);
  if (b.kNode) { K.arena.removeNode(b.kNode); b.kNode = null; }
  K.arena.release(b.def.size, b.i0, b.j0);
  K.arena.removeSolid(b.solid);
}
// vários aldeões aceleram, com retorno decrescente
export const constructionRate = (n) => (n <= 0 ? 0 : 1 + (n - 1) * 0.6);
export function tickConstruction(K, dt, onDone) {
  for (const b of K.buildings) {
    if (b.done || b.dead) { b.builders = 0; continue; }
    const n = b.builders;
    b.builders = 0;
    if (!n) continue;
    const dp = Math.min(1 - b.progress, dt / b.def.time * constructionRate(n));
    b.progress += dp;
    b.hp = Math.min(b.maxHp, b.hp + dp * b.maxHp * 0.9);
    if (b.progress >= 1 - 1e-9) { b.progress = 1; b.done = true; K.stats.built++; farmReady(K, b); onDone?.(b); }
  }
}

export function enqueue(K, b, kind, cfg = null) {
  if (!b.done || b.dead || !b.def.trains?.includes(kind)) return 'invalid';
  if (b.queue.length >= QUEUE_MAX) return 'full';
  if (kind === 'hero' && heroCount(K) >= HERO_LIMIT) return 'limit';
  if (!spend(K, UNITS[kind].cost)) return 'cost';
  b.queue.push({ kind, t: 0, cfg, blocked: false });
  return 'ok';
}
export function cancelQueue(K, b, index) {
  const item = b.queue[index];
  if (!item) return false;
  b.queue.splice(index, 1);
  refund(K, UNITS[item.kind].cost);
  return true;
}
// só a frente da fila anda; sem casa sobrando, ela espera (blocked)
export function tickProduction(K, dt, spawn) {
  for (const b of K.buildings) {
    if (!b.done || b.dead || !b.queue.length) continue;
    const head = b.queue[0], def = UNITS[head.kind];
    head.blocked = popUsed(K) + def.pop > popCap(K);
    if (head.blocked) continue;
    head.t += dt;
    if (head.t < def.time) continue;
    b.queue.shift();
    const u = spawn(b, head);
    if (u) { u.kKind = head.kind; K.units.push(u); K.stats.trained++; }
  }
}

export function nearestDrop(K, pos) {
  let best = null, bd = Infinity;
  for (const b of K.buildings) if (b.done && !b.dead && b.def.drop) { const d = flat(b.pos, pos) - b.reach; if (d < bd) { bd = d; best = b; } }
  return best;
}
// aldeão: anda, coleta até encher, leva ao depósito mais perto e volta; ou ajuda a construir
export function workerStep(K, w, dt) {
  const t = w.task;
  if (!t) return 'idle';
  if (t.type === 'move') {
    if (flat(w.pos, t) < 0.6) { w.task = null; return 'idle'; }
    w.goTo(t.x, t.z, dt);
    return 'move';
  }
  if (t.type === 'build') {
    const b = t.site;
    if (!b || b.dead || b.done) { w.task = afterBuild(K, w, b); return 'idle'; }
    if (flat(w.pos, b.pos) - b.reach > REACH) { w.goTo(b.pos.x, b.pos.z, dt); return 'move'; }
    b.builders++;
    return 'build';
  }
  if (t.type !== 'gather') return 'idle';
  let node = t.node;
  if (node && (node.amount <= 0 || !K.arena.nodes.includes(node))) node = t.node = null;
  const full = w.carry >= GATHER.carry - 1e-6;
  const wrongLoad = w.carry > 0 && w.carryRes !== t.res;
  if (!node && !full && !wrongLoad) node = t.node = K.arena.nearestNode(t.res, w.pos.x, w.pos.z, 16, w);
  if (full || wrongLoad || t.drop || (!node && w.carry > 0)) {
    const drop = nearestDrop(K, w.pos);
    if (!drop) { w.task = null; return 'idle'; }
    if (flat(w.pos, drop.pos) - drop.reach > REACH) { w.goTo(drop.pos.x, drop.pos.z, dt); return 'move'; }
    if (w.carry > 0) { K.res[w.carryRes] += w.carry; K.stats.gathered[w.carryRes] += w.carry; }
    w.carry = 0;
    t.drop = false;
    return 'drop';
  }
  if (!node) { w.task = null; return 'idle'; }
  if (flat(w.pos, node) - node.r > REACH) { w.goTo(node.x, node.z, dt); return 'move'; }
  if (node.farm) node.user = w;
  const take = Math.min(GATHER[node.res] * dt * (w.rate || 1) * (node.rate || 1), node.amount, GATHER.carry - w.carry);
  node.amount -= take;
  w.carry += take;
  w.carryRes = node.res;
  if (node.amount <= 1e-6) { K.arena.removeNode(node); t.node = null; }
  return 'gather';
}
// depois de erguer um depósito ou o castelo, o aldeão já começa a coletar o recurso mais perto
function afterBuild(K, w, b) {
  if (b?.kNode && !b.dead && !K.arena.farmTaken(b.kNode, w)) return { type: 'gather', node: b.kNode, res: 'food' };
  if (!b || b.dead || !b.def?.drop) return null;
  let best = null, bd = 14;
  for (const n of K.arena.nodes) { const d = flat(n, w.pos); if (d < bd) { bd = d; best = n; } }
  return best ? { type: 'gather', node: best, res: best.res } : null;
}

export function tickWaves(K, dt, spawn) {
  K.waveT -= dt;
  if (K.waveT <= 0) {
    K.waveN++;
    K.pending += waveSize(K.waveN, K.D);
    K.leader = waveLeaderFor(K.waveN);
    K.waveT += waveInterval(K.waveN);
    const entries = K.arena.entries?.length || 0;
    K.sources = waveSources(K.waveN, entries);
    K.nextSources = waveSources(K.waveN + 1, entries);
    K.spawnK = 0;
    K.onWave?.(K.waveN);
  }
  if (K.pending > 0) {
    K.spawnT -= dt;
    if (K.spawnT <= 0) {
      const leader = K.pending === 1 ? K.leader : null;
      K.pending--;
      K.spawnT = 0.55;
      spawn(K.waveN, leader, leader ? -1 : K.sources[K.spawnK++ % K.sources.length]);
    }
  }
}
export function kingdomResult(K) {
  if (K.castle?.dead) return 'lost';
  if (K.portal?.dead) return 'won';
  return null;
}

// ---------- ícones (SVG pequeno, sem texto) ----------
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  wood: svg('<rect x="2.5" y="11" width="16" height="6" rx="3" fill="#b06d32" stroke="#3b2414" stroke-width="1.6"/><rect x="5.5" y="5.5" width="16" height="6" rx="3" fill="#c7843f" stroke="#3b2414" stroke-width="1.6"/><circle cx="18.5" cy="8.5" r="2.4" fill="#f0cf96" stroke="#3b2414" stroke-width="1.3"/>'),
  stone: svg('<path d="M3 17l3-8 6-4 6 3 3 9-6 3H8z" fill="#aeb4bd" stroke="#2e3440" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 11l4-2 3 2" fill="none" stroke="#e7ebf0" stroke-width="1.4" stroke-linecap="round"/>'),
  gold: svg('<circle cx="12" cy="12" r="8.5" fill="#ffd23a" stroke="#6a4300" stroke-width="1.7"/><circle cx="12" cy="12" r="5" fill="none" stroke="#c98a12" stroke-width="1.5"/><path d="M9 8.5a5 5 0 0 1 3-1.2" stroke="#fff6c4" stroke-width="1.5" fill="none" stroke-linecap="round"/>'),
  food: svg('<path d="M12 7.5c-1-3 1-5 3.5-5.2-.3 2.4-1.5 4-3.5 5.2z" fill="#6fc24a" stroke="#1f3d14" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 8.2c-4.5-2.6-9 .6-8 6 .8 4.6 4.6 7.6 8 6.2 3.4 1.4 7.2-1.6 8-6.2 1-5.4-3.5-8.6-8-6z" fill="#e0453a" stroke="#4a1210" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 11.5c.6-1 1.6-1.6 2.6-1.7" stroke="#ffc2b8" stroke-width="1.5" fill="none" stroke-linecap="round"/>'),
  pop: svg('<circle cx="12" cy="7.5" r="4" fill="#9fd0ff" stroke="#14284a" stroke-width="1.6"/><path d="M4.5 21c0-5 3.4-8 7.5-8s7.5 3 7.5 8z" fill="#5b9bf0" stroke="#14284a" stroke-width="1.6" stroke-linejoin="round"/>'),
  time: svg('<circle cx="12" cy="13" r="8" fill="#e8f2ff" stroke="#14284a" stroke-width="1.7"/><path d="M12 8.5V13l3 2" fill="none" stroke="#14284a" stroke-width="1.8" stroke-linecap="round"/>'),
};
const costHTML = (cost) => RES.filter((r) => cost[r]).map((r) => `<span class="k-cost" data-res="${r}">${ICONS[r]}${cost[r]}</span>`).join('');
const costText = (cost) => RES.filter((r) => cost[r]).map((r) => `${cost[r]} ${RES_NAME[r].toLowerCase()}`).join(' · ');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- estado da partida em andamento ----------
let K = null;          // estado do modo (regras + entidades)
let R = null;          // peças só de tela: cena, seleção, câmera, interface
const KEYS = ['Q', 'E', 'R', 'F', 'G', 'Z', 'X', 'C', 'V'];
const has = (u, name) => !!THREE.AnimationClip.findByName(u.clips, name);
const anyClip = (u, names) => names.find((n) => has(u, n));
const MILITIA_TINTS = [0x7fb6e8, 0x6aa3d8, 0x8cc4f0, 0x5e93c8];

let Building, Worker, Soldier, Portal;
function defineClasses() {
  if (Building) return;
  const Unit = G.Unit;

  Building = class extends Unit {
    constructor(type) {
      const def = BUILDINGS[type];
      super({ scene: models.makeBuilding(type), animations: [] }, { hp: def.hp, dmg: def.attack?.dmg || 0, range: def.attack?.range || 0, speed: 0, cooldown: def.attack?.cooldown || 1 }, 'building');
      this.phasing = true;    // fora da separação: só o obstáculo redondo segura as unidades
      this.ranged = true;
      this.busy = Infinity;   // sem animações de golpe
      this.cfg = { id: 'crossbow', splash: 0 };
      this.level = 1;
      this.barHeight = def.height;
      this.bar.classList.add('ally', 'k-building');
      this.shotFrom = { pos: new THREE.Vector3(), cfg: this.cfg, range: this.range, level: 1, skillPower: 1, summoner: this, get dmg() { return def.attack?.dmg || 0; } };
      this.attackTimer = 1;
      this.deadTime = 0;
    }
    startSite() {
      this.scaffold = models.makeScaffold(this.def.size * ARENA.CELL);
      this.scaffold.position.copy(this.pos);
      G.scene.add(this.scaffold);
    }
    update(dt) {
      if (dt <= 0) return;
      if (this.flash > 0 || this.flashOn) {
        this.flash -= dt;
        this.flashOn = this.flash > 0;
        for (const m of this.mats) if (m.emissive) m.emissive.setHex(this.flashOn ? 0xff3b2f : 0x000000);
      }
      if (this.dead) {
        this.deadTime += dt;
        this.root.position.y = -this.deadTime * 3;
        if (this.deadTime > 1.4) this.remove();
        return;
      }
      const grow = this.done ? 1 : 0.12 + 0.88 * this.progress;
      this.root.scale.set(1, grow, 1);
      if (this.scaffold && this.done) { this.scaffold.removeFromParent(); this.scaffold = null; G.poof(this.pos, 2); G.ring(this.pos, this.reach + 0.5, 0xffe066, 0.8); }
      if (!this.done || !this.def.attack || G.game.over) return;
      this.attackTimer -= dt;
      if (this.attackTimer > 0) return;
      let target = null, bd = this.def.attack.range;
      for (const s of G.skeletonsAlive()) {
        if (s.spawning || s.kPortal) continue;
        const d = flat(s.pos, this.pos) - this.reach * 0.5;
        if (d < bd) { bd = d; target = s; }
      }
      if (!target) { this.attackTimer = 0.25; return; }
      this.attackTimer = this.def.attack.cooldown;
      this.shotFrom.pos.set(this.pos.x, this.def.height * 0.72 - 1.3, this.pos.z);
      G.fireBolt(this.shotFrom, target, 'magic');
    }
    die() {
      if (this.dead) return;
      this.dead = true;
      this.hp = 0;
      this.bar.style.display = 'none';
      G.poof(this.pos, 3);
      G.ring(this.pos, this.reach + 1, 0xff7a4a, 1);
      G.audio?.play?.('bones');
      if (K) {
        removeBuilding(K, this);
        for (const q of this.queue) refund(K, UNITS[q.kind].cost);
        this.queue.length = 0;
        if (this !== K.castle) G.showBanner(`${this.def.glyph} −1`, 1.6);
      }
      this.scaffold?.removeFromParent();
      this.scaffold = null;
    }
    remove() { this.scaffold?.removeFromParent(); this.scaffold = null; super.remove(); }
  };

  // aldeão e soldado: o bárbaro sem as armas dele, pequeno e azulado (o mesmo visual da milícia)
  const dressVillager = (u, tint, weapon) => {
    u.root.traverse((o) => { if (G.HEROES[1].weapons.includes(o.name)) o.visible = false; });
    const color = new THREE.Color(tint);
    for (const m of u.mats) m.color?.lerp(color, 0.7);
    if (weapon) u.root.getObjectByName('handslotr')?.add(weapon);
    u.kGlow = 0x1b3c6e;   // brilho azul: o bárbaro escuro vira "azulzinho" visto de cima
  };
  // depois de piscar vermelho ao levar golpe, o brilho azul volta
  const keepGlow = (u) => {
    if (u.flashOn) { u.kLit = false; return; }
    if (u.kLit) return;
    for (const m of u.mats) m.emissive?.setHex(u.kGlow);
    u.kLit = true;
  };

  Worker = class extends Unit {
    constructor() {
      const def = UNITS.worker;
      super(G.assets.Barbarian, def, 'villager');
      this.kKind = 'worker';
      this.cfg = { id: 'worker' };
      this.level = 1;
      this.size = 0.62;
      dressVillager(this, 0xa9d4ff, G.militiaWeapon('machadinha'));
      this.bar.classList.add('ally', 'k-worker');
      this.task = null;
      this.carry = 0;
      this.carryRes = null;
      this.goal = new THREE.Vector3();
      this.chopT = 0;
      this.deadTime = 0;
      this.popT = 0;
      // fardo nas costas: some sem carga e muda de cor com o recurso
      this.load = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.35), new THREE.MeshLambertMaterial({ color: 0xb06d32, flatShading: true }));
      this.load.position.set(0, 1.35, -0.38);
      this.load.visible = false;
      this.root.add(this.load);
      this.loop('Idle');
    }
    goTo(x, z, dt) { this.goal.set(x, 0, z); this.moveTo(this.goal, dt); }
    update(dt) {
      if (dt <= 0) return;
      this.updateCommon(dt);
      keepGlow(this);
      if (this.dead) { if ((this.deadTime += dt) > 2.5) this.remove(); return; }
      if (G.game.over || !K) return;
      this.chopT -= dt;
      // esqueleto colado: larga o serviço por um instante e corre para o depósito mais perto
      this.scanT = (this.scanT || 0) - dt;
      if (this.scanT <= 0) {
        this.scanT = 0.3;
        this.threat = null;
        for (const s of G.skeletonsAlive()) if (!s.spawning && !s.kPortal && flat(s.pos, this.pos) < 4.5) { this.threat = s; break; }
      }
      if (this.threat && !this.threat.dead) {
        const safe = nearestDrop(K, this.pos);
        if (safe && flat(safe.pos, this.pos) - safe.reach > 1.2) {
          this.goTo(safe.pos.x, safe.pos.z, dt);
          if (this.busy <= 0) this.locomote('Running_A', 'Walking_A', 'Idle');
          this.state = 'flee';
          return;
        }
      }
      const state = workerStep(K, this, dt);
      this.state = state;
      const load = this.carry > 0.5;
      if (this.load.visible !== load) this.load.visible = load;
      if (load) this.load.material.color.setHex(this.carryRes === 'gold' ? 0xffd23a : this.carryRes === 'stone' ? 0xaeb4bd : this.carryRes === 'food' ? 0xe0453a : 0xb06d32);
      if (state === 'gather' || state === 'build') {
        const target = state === 'build' ? this.task?.site?.pos : this.task?.node;
        if (target) this.face(target, dt);
        if (this.chopT <= 0) {
          const name = state === 'build' || this.task?.res === 'food' ? 'Interact' : this.task?.res === 'wood' ? '1H_Melee_Attack_Chop' : '2H_Melee_Attack_Chop';
          if (has(this, name)) this.once(name, 1.1);
          this.chopT = 1.05;
        }
        return;
      }
      if (this.busy <= 0 && this.chopT < 0.5) this.locomote('Running_A', 'Walking_A', 'Idle');
    }
    die() {
      this.dead = true;
      this.hp = 0;
      this.pendingHit = null;
      this.deadTime = 0;
      this.once('Death_A');
      this.bar.style.display = 'none';
      lostUnit(this);
    }
    remove() { this.load.geometry.dispose(); this.load.material.dispose(); super.remove(); }
  };

  Soldier = class extends Unit {
    constructor(kind) {
      const def = UNITS[kind];
      super(G.assets.Barbarian, def, 'ally');
      this.kKind = kind;
      this.cfg = { id: kind === 'archer' ? 'crossbow' : 'soldier', splash: 0 };
      this.level = 1;
      this.size = 0.74;
      this.ranged = !!def.ranged;
      const slot = Math.floor(Math.random() * 4);
      dressVillager(this, MILITIA_TINTS[slot], this.ranged ? null : G.militiaWeapon(['forcado', 'machadinha', 'clava', 'forcado'][slot]));
      if (this.ranged && G.assets.Skeleton_Crossbow) {
        const bow = G.assets.Skeleton_Crossbow.scene.clone();
        bow.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.root.getObjectByName('handslotr')?.add(bow);
      }
      this.attackAnim = this.ranged ? anyClip(this, ['2H_Ranged_Shoot', '1H_Ranged_Shoot']) : anyClip(this, ['1H_Melee_Attack_Chop']);
      this.bar.classList.add('ally', 'k-soldier');
      this.anchor = new THREE.Vector3();
      this.order = null;
      this.goal = new THREE.Vector3();
      this.deadTime = 0;
      this.popT = 0;
      this.loop('Idle');
    }
    update(dt) {
      if (dt <= 0) return;
      this.updateCommon(dt);
      keepGlow(this);
      if (this.dead) { if ((this.deadTime += dt) > 2.5) this.remove(); return; }
      if (G.game.over || this.busy > 0) return;
      let target = null;
      const o = this.order;
      if (o?.type === 'attack') {
        if (o.target.dead || !G.units.includes(o.target)) { this.order = null; this.anchor.copy(this.pos); }
        else target = o.target;
      } else if (o?.type === 'move') {
        if (flat(this.pos, o) < 0.7) { this.order = null; this.anchor.set(o.x, 0, o.z); }
        else { this.goal.set(o.x, 0, o.z); this.moveTo(this.goal, dt); }
      }
      if (!this.order) {
        // parado: briga com quem chega perto e não se afasta demais do posto
        if (K?.arena.blocked[K.arena.idxAt(this.anchor.x, this.anchor.z)]) this.anchor.copy(this.pos);   // posto dentro de prédio: fica onde está
        let bd = this.ranged ? this.range + 3 : 10;
        for (const s of G.skeletonsAlive()) {
          if (s.spawning) continue;
          const d = flat(s.pos, this.pos) - (s.reach || 0);
          if (d < bd && flat(s.pos, this.anchor) < 16) { bd = d; target = s; }
        }
      }
      if (target) {
        const d = flat(target.pos, this.pos) - (target.reach || 0) - 0.4 * (target.size - 1);
        if (d > this.range) this.moveTo(target.pos, dt);
        else if (this.face(target.pos, dt) < 0.5 && this.attackTimer <= 0 && this.attackAnim) this.attack(target, this.attackAnim);
      } else if (!this.order && flat(this.pos, this.anchor) > 0.8) this.moveTo(this.anchor, dt);
      if (this.busy <= 0) this.locomote('Running_A', 'Walking_A', 'Idle');
    }
    die() {
      this.dead = true;
      this.hp = 0;
      this.pendingHit = null;
      this.deadTime = 0;
      this.once('Death_A');
      this.bar.style.display = 'none';
      lostUnit(this);
    }
  };

  // Portal de Ossos: alvo inimigo parado; sem cura (o sacerdote não o recupera) e derrubá-lo vence
  Portal = class extends Unit {
    constructor(at, hp) {
      super({ scene: models.makePortal(), animations: [] }, { hp, dmg: 0, range: 0, speed: 0, cooldown: 1 }, 'skeleton');
      this.kPortal = true;
      this.totem = true;
      this.ranged = true;
      this.phasing = true;
      this.busy = Infinity;
      this.spawning = false;
      this.size = 2.4;
      this.reach = 1.3;
      this.barHeight = 6;
      this.stunT = this.rootT = this.slowT = this.burnT = this.tauntT = 0;
      this.home = new THREE.Vector3(at.x, 0, at.z);
      this.pos.copy(this.home);
      this.root.rotation.y = -0.55;   // arco de frente para a câmera, virado um pouco para o castelo
      this.low = hp;
      this.swirl = this.root.getObjectByName('swirl');
      this.glow = this.root.getObjectByName('glow');
      this.bar.classList.add('boss', 'k-portal');
      this.age = 0;
    }
    update(dt) {
      if (dt <= 0) return;
      this.age += dt;
      this.vel.set(0, 0, 0);
      this.pos.copy(this.home);
      if (this.hp > this.low) this.hp = this.low;   // não recupera vida
      this.low = this.hp;
      if (this.flash > 0 || this.flashOn) {
        this.flash -= dt;
        this.flashOn = this.flash > 0;
        for (const m of this.mats) if (m.emissive) m.emissive.setHex(this.flashOn ? 0xff3b2f : 0x000000);
      }
      if (this.swirl) { this.swirl.rotation.z += dt * 1.6; this.swirl.scale.x = 1.62 * (1 + Math.sin(this.age * 3) * 0.05); }
      if (this.glow) this.glow.scale.setScalar(1 + Math.sin(this.age * 2) * 0.06);
      if (this.dead) { this.root.scale.setScalar(Math.max(0.01, 1 - (this.deadT = (this.deadT || 0) + dt))); }
    }
    die() {
      if (this.dead) return;
      this.dead = true;
      this.hp = 0;
      this.bar.style.display = 'none';
      G.poof(this.pos, 4);
      G.ring(this.pos, 5, 0xb36bff, 1.4);
      G.FX?.shake?.(0.8);
    }
  };
}

function lostUnit(u) {
  if (!K) return;
  const k = K.units.indexOf(u);
  if (k >= 0 && u.kKind !== 'hero') { K.units.splice(k, 1); K.stats.lost++; }
  if (R) { R.sel = R.sel.filter((x) => x !== u); R.selKey = ''; }
}

// ---------- início e fim ----------
export function startKingdom() { G.withBattleAssets(beginKingdom); }

function beginKingdom() {
  defineClasses();
  const game = G.game;
  document.getElementById('pick')?.classList.add('hidden');
  const arena = createArena(7);
  G.replaceWorld(arena);
  K = createKingdomState(arena, G.difficulty);
  R = { root: buildArenaScene(arena, G.scene, models), sel: [], selKey: '', groups: {}, placing: null, ghost: null, heroPick: false,
    cam: { x: arena.castleAt.x + 12, z: arena.castleAt.z + 2, dist: 36 }, keys: new Set(), mouse: { x: innerWidth / 2, y: innerHeight / 2, inside: false },
    drag: null, pan: null, rings: [], uiT: 0, mapT: 0, lastClick: { t: 0, u: null }, lastGroup: { n: 0, t: 0 }, alertT: 0, idleIdx: 0 };
  K.onWave = (n) => {
    const lead = waveLeaderFor(n);
    G.showBanner(lead && n % 6 === 0 ? `☠ Onda ${n} · Chefe!` : `☠ Onda ${n}`, 2.5);
    G.audio?.play?.('shout');
  };
  Object.assign(game, { state: 'fight', paused: false, over: false, realm, runTime: 0, kills: 0, fallLog: [], roster: [], damageSources: {}, relics: [], mission: null,
    villager: null, shrine: null, militia: null, test: false, phase: 1, guideS: 0 });
  // castelo pronto, portal no outro lado e quatro aldeões
  const make = (type) => new Building(type);
  K.castle = addBuilding(K, 'castle', arena.castleCell.i0, arena.castleCell.j0, make, true);
  K.castle.rally = new THREE.Vector3(K.castle.pos.x + 7, 0, K.castle.pos.z);
  K.portal = new Portal(arena.portalAt, Math.round(PORTAL.hp * (G.difficulty?.hp || 1)));
  K.portalGuardT = 6;
  for (let k = 0; k < START.workers; k++) {
    const w = new Worker();
    w.pos.set(K.castle.pos.x + 5.5, 0, K.castle.pos.z - 3 + k * 2);
    K.units.push(w);
  }
  // sol mais aberto para cobrir a vista de cima
  const sc = G.sun.shadow.camera;
  R.shadow = { left: sc.left, right: sc.right, top: sc.top, bottom: sc.bottom, far: sc.far };
  Object.assign(sc, { left: -44, right: 44, top: 44, bottom: -44, far: 110 });
  sc.updateProjectionMatrix();
  G.controls.enabled = false;
  document.body.classList.remove('no-battle');
  document.body.classList.add('kingdom');
  buildUI();
  bindInput();
  placeCamera();
  G.audio?.startMusic?.();
  G.showBanner('♜ Defenda o reino!', 2.6);
}

function stopKingdom() {
  if (!R) return;
  cancelPlacing();
  R.root.removeFromParent();
  R.root.traverse((o) => {   // só o que o cenário do mapa criou (as peças dos modelos são compartilhadas)
    if (!o.isMesh) return;
    if (o.geometry.userData?.kOwn) o.geometry.dispose();
    if (o.material.userData?.kOwn) o.material.dispose();
  });
  for (const r of R.rings) r.removeFromParent();
  for (const a of R.alerts || []) a.remove();
  R.flag?.removeFromParent();
  R.ui?.remove();
  R.waveChip?.remove();
  R.panel?.remove();
  R.box?.remove();
  unbindInput();
  const sc = G.sun.shadow.camera;
  Object.assign(sc, R.shadow);
  sc.updateProjectionMatrix();
  G.controls.enabled = true;
  document.body.classList.remove('kingdom');
  G.restoreWorld();
  G.game.realm = null;
  K = null;
  R = null;
}

function endKingdom(won) {
  const game = G.game;
  game.over = true;
  G.audio?.stopMusic?.();
  G.audio?.play?.(won ? 'victory' : 'defeat');
  const $ = (id) => document.getElementById(id);
  $('overlayTitle').textContent = won ? 'Vitória!' : 'Derrota';
  $('overlayText').textContent = won ? 'O Portal de Ossos caiu!' : 'O castelo caiu.';
  const g = K.stats.gathered;
  const chip = (icon, text, tip) => `<span class="end-chip" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><i aria-hidden="true">${icon}</i>${text}</span>`;
  $('overlayStars').innerHTML = '';
  $('overlayStats').innerHTML = `<div class="k-end">${chip('⏱', clock(K.time), 'Tempo de partida')}${chip('☠', K.waveN, 'Ondas enfrentadas')}${chip('⚔', game.kills, 'Esqueletos derrotados')}`
    + `${chip(ICONS.wood, Math.round(g.wood), 'Madeira coletada')}${chip(ICONS.stone, Math.round(g.stone), 'Pedra coletada')}${chip(ICONS.gold, Math.round(g.gold), 'Ouro coletado')}${chip(ICONS.food, Math.round(g.food), 'Comida coletada')}`
    + `${chip('⌂', K.stats.built, 'Construções erguidas')}${chip('⚒', K.stats.trained, 'Unidades treinadas')}</div>`;
  $('overlayNext').innerHTML = '<button type="button" class="k-menu-btn">Menu</button>';
  $('overlayNext').querySelector('button').onclick = () => G.startGame('menu');
  $('overlayBtn').textContent = 'Jogar de novo';
  $('overlayBtn').setAttribute('aria-label', 'Jogar o Reino de novo');
  $('overlayBtn').onclick = () => G.startGame('reino');
  $('overlayBtn').hidden = false;
  R.panel.hidden = true;
  $('overlay').classList.add('results');
  $('overlay').classList.toggle('lost', !won);
  $('overlay').classList.remove('hidden');
}

// ---------- laço: chamado pelo frame() do main.js no lugar de updateGame ----------
function tick(dt) {
  if (!K || G.game.over) return;
  K.time += dt;
  tickConstruction(K, dt, (b) => {
    G.showBanner(`${b.def.glyph} ${b.def.name}`, 1.5);
    G.audio?.play?.('levelup');
  });
  tickProduction(K, dt, spawnFrom);
  tickWaves(K, dt, spawnWave);
  guardPortal(dt);
  // heróis: seguem a ordem atual e voltam no castelo depois de um tempo caídos
  for (const h of K.units) {
    if (h.kKind !== 'hero') continue;
    if (h.dead) {
      h.kDeadT = (h.kDeadT || 0) + dt;
      if (h.kDeadT >= HERO_REVIVE && K.castle && !K.castle.dead) {
        h.kDeadT = 0;
        h.revive();
        h.hp = h.maxHp * 0.6;
        h.pos.copy(exitOf(K.castle));
        h.post.copy(K.castle.rally || h.pos);
        h.kOrder = null;
        G.showBanner(`♛ ${h.cfg.name}`, 1.5);
      }
      continue;
    }
    const o = h.kOrder;
    if (o?.type === 'attack') {
      if (o.target.dead || !G.units.includes(o.target)) h.kOrder = null;
      else h.post.copy(o.target.pos);
    }
  }
  const result = kingdomResult(K);
  if (result) endKingdom(result === 'won');
}

function exitOf(b) {
  const out = new THREE.Vector3(b.pos.x + b.reach + 1.4, 0, b.pos.z + (Math.random() - 0.5) * 2);
  const target = b.rally || out;
  const dir = new THREE.Vector3(target.x - b.pos.x, 0, target.z - b.pos.z);
  if (dir.lengthSq() > 0.01) out.copy(b.pos).addScaledVector(dir.normalize(), b.reach + 1.3);
  return out;
}

function spawnFrom(b, item) {
  let u;
  if (item.kind === 'worker') u = new Worker();
  else if (item.kind === 'hero') {
    u = new G.Hero(item.cfg);
    u.autoSkills = [true, true, true];
  } else u = new Soldier(item.kind);
  u.pos.copy(exitOf(b));
  G.poof(u.pos, 0.8);
  const rally = b.rally;
  if (item.kind === 'worker') {
    if (rally) {
      const node = K.arena.nodeAt(rally.x, rally.z, 0.8);
      u.task = node ? { type: 'gather', node, res: node.res } : { type: 'move', x: rally.x, z: rally.z };
    }
  } else if (item.kind === 'hero') {
    u.post.copy(rally || u.pos);
    u.fwd.set(1, 0, 0);
    G.showBanner(`♛ ${item.cfg.name}`, 1.8);
  } else {
    u.anchor.copy(u.pos);
    if (rally) u.order = { type: 'move', x: rally.x, z: rally.z };
  }
  return u;
}

function waveType(n, leader) {
  if (leader) return leader;
  const p = wavePhase(n), r = Math.random();
  const rogue = Math.min(0.3, 0.04 * p), warrior = Math.min(0.4, 0.06 * p);
  let type = r < rogue ? 'Rogue' : r < rogue + warrior ? 'Warrior' : 'Minion';
  type = G.pickMonster(p, type);
  return type === 'Crossbow' || type === 'Mage' ? 'Warrior' : type;   // atiradores parados ficam na guarda do portal
}

function spawnSkeletonAt(type, p, boss = false, src = -1) {
  const s = new G.Skeleton(type, p, boss);
  const entry = src >= 0 ? K.arena.entries[src] : null;
  if (entry) {
    // sai da cova da borda: um pouco espalhado, sempre em chão andável
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 2.4;
      s.pos.set(entry.x + Math.cos(a) * d, 0, entry.z + Math.sin(a) * d);
      if (K.arena.walkable(s.pos.x, s.pos.z)) break;
      s.pos.set(entry.x, 0, entry.z);
    }
    s.root.rotation.y = Math.atan2(K.castle.pos.x - entry.x, K.castle.pos.z - entry.z);
    G.poof?.(s.pos, 0.8);
    return s;
  }
  const a = Math.PI * (0.5 + Math.random()), at = K.portal.home;   // nasce do lado do castelo
  s.pos.set(at.x + Math.cos(a) * 3.6, 0, at.z + Math.sin(a) * 3.6);
  s.root.rotation.y = -Math.PI / 2;
  return s;
}
function spawnWave(n, leader, src = -1) {
  if (!K.portal || K.portal.dead) return;
  const type = waveType(n, leader);
  spawnSkeletonAt(type, wavePhase(n), !!leader && n % 6 === 0, src);
}

// guarda do portal: alguns esqueletos ficam perto dele e só saem atrás de quem chega
function guardPortal(dt) {
  if (!K.portal || K.portal.dead) return;
  K.portalGuardT -= dt;
  const guards = G.skeletonsAlive().filter((s) => s.kGuard);
  const want = Math.min(10, 3 + Math.floor(K.time / 150));
  if (K.portalGuardT > 0 || guards.length >= want) return;
  K.portalGuardT = PORTAL.guardEvery;
  const p = Math.min(12, 1 + Math.floor(K.time / 100));
  const pool = p >= 3 ? ['Warrior', 'Crossbow', 'Minion', 'Mage', 'Warrior'] : ['Minion', 'Warrior', 'Minion'];
  const s = spawnSkeletonAt(pool[guards.length % pool.length], p);
  s.kGuard = true;
  const home = new THREE.Vector3(K.portal.home.x - 3 - Math.random() * 3, 0, K.portal.home.z + (Math.random() - 0.5) * 9);
  if (s.ranged) s.pos.copy(home);
  const base = s.kind;
  const own = Object.create(base);
  own.think = (u, dt2, target) => {
    if (target && flat(target.pos, K.portal.home) <= PORTAL.guardRadius) return base.think ? base.think(u, dt2, target) : false;
    if (!u.ranged && flat(u.pos, home) > 1) u.moveTo(home, dt2);
    return true;
  };
  s.kind = own;
}

// ---------- câmera RTS: livre, sem seguir o grupo ----------
const camOffset = new THREE.Vector3();
function placeCamera() {
  const c = R.cam;
  const hx = ARENA.W / 2, hz = ARENA.H / 2;
  c.x = THREE.MathUtils.clamp(c.x, -hx, hx);
  c.z = THREE.MathUtils.clamp(c.z, -hz + 4, hz + 6);
  G.controls.target.set(c.x, 0, c.z);
  camOffset.set(0, c.dist * 0.82, c.dist * 0.58);
  G.camera.position.copy(G.controls.target).add(camOffset);
  G.follow.copy(G.controls.target);
}
function cameraFrame(real) {
  if (!R) return;
  const c = R.cam, k = R.keys, speed = c.dist * 1.05 * real;
  let dx = 0, dz = 0;
  if (k.has('a') || k.has('arrowleft')) dx--;
  if (k.has('d') || k.has('arrowright')) dx++;
  if (k.has('w') || k.has('arrowup')) dz--;
  if (k.has('s') || k.has('arrowdown')) dz++;
  const m = R.mouse, edge = 10;
  if (m.inside && !R.drag && !G.game.over && document.hasFocus?.() !== false) {
    if (m.x <= edge) dx--;
    else if (m.x >= innerWidth - edge) dx++;
    if (m.y <= edge) dz--;
    else if (m.y >= innerHeight - 4) dz++;
  }
  c.x += dx * speed;
  c.z += dz * speed;
  placeCamera();
  updateRings(real);
  updateGhost();
  updateAlerts();
  R.uiT -= real;
  if (R.uiT <= 0) { R.uiT = 0.12; updateUI(); }
  R.mapT -= real;
  if (R.mapT <= 0) { R.mapT = K.waveT < WARN_T ? 0.1 : 0.2; drawMinimap(); }
}

// ---------- seleção ----------
const own = (u) => u && !u.dead && (u.kKind === 'worker' || u.kKind === 'soldier' || u.kKind === 'archer' || u.kKind === 'hero');
const isBuilding = (u) => u && u.building && !u.dead;
const screenOf = (pos, lift = 1) => {
  const v = new THREE.Vector3(pos.x, pos.y + lift, pos.z).project(G.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z < 1 };
};
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, G.camera);
  const hit = new THREE.Vector3();
  return ray.ray.intersectPlane(ground, hit) ? hit : null;
}
function unitAt(x, y, list, radius = 26) {
  let best = null, bd = radius;
  for (const u of list) {
    if (u.dead) continue;
    const s = screenOf(u.pos, u.kPortal ? 2.4 : 0.9 * (u.size || 1));
    const d = Math.hypot(s.x - x, s.y - y) - (u.kPortal ? 30 : 0);
    if (s.front && d < bd) { bd = d; best = u; }
  }
  return best;
}
function select(list, add = false) {
  const next = add ? [...R.sel] : [];
  for (const u of list) {
    const i = next.indexOf(u);
    if (add && i >= 0 && list.length === 1) next.splice(i, 1);
    else if (i < 0) next.push(u);
  }
  // prédios só entram sozinhos
  const units = next.filter(own);
  R.sel = units.length ? units : next.filter(isBuilding).slice(-1);
  R.heroPick = false;
  R.selKey = '';
  if (R.sel.length) G.audio?.play?.('click');
}

function updateRings() {
  const want = [];
  for (const u of R.sel) if (!u.dead) want.push(u);
  while (R.rings.length < want.length) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 32), new THREE.MeshBasicMaterial({ color: 0x7dff8a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 5;
    G.scene.add(m);
    R.rings.push(m);
  }
  R.rings.forEach((m, i) => {
    const u = want[i];
    m.visible = !!u;
    if (!u) return;
    m.position.set(u.pos.x, 0.07, u.pos.z);
    m.scale.setScalar(u.building ? u.reach + 0.6 : u.kKind === 'hero' ? 1.15 : 0.9);
    m.material.color.setHex(u.kKind === 'hero' ? 0xffe066 : 0x7dff8a);
  });
  // bandeira do ponto de reunião do prédio selecionado
  const b = R.sel.length === 1 && isBuilding(R.sel[0]) ? R.sel[0] : null;
  if (b?.rally && b.def.trains) {
    R.flag ||= models.makeFlag();
    if (!R.flag.parent) G.scene.add(R.flag);
    R.flag.position.copy(b.rally);
  } else R.flag?.removeFromParent();
  // barras de vida: só aparecem feridas, selecionadas ou em obra
  for (const u of G.units) {
    if (!u.bar) continue;
    const quiet = u.team !== 'skeleton' && !u.kPortal && u.hp >= u.maxHp - 0.5 && !R.sel.includes(u) && !(u.building && !u.done);
    if (u.kQuiet !== quiet) { u.kQuiet = quiet; u.bar.classList.toggle('k-quiet', quiet); }
  }
}

// ---------- ordens ----------
function formation(n, center, spacing = 1.5) {
  const cols = Math.ceil(Math.sqrt(n)), out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    out.push({ x: center.x + (c - (cols - 1) / 2) * spacing, z: center.z + (r - (Math.ceil(n / cols) - 1) / 2) * spacing });
  }
  return out;
}
function command(x, y, add = false) {
  const at = groundAt(x, y);
  if (!at) return;
  const sel = R.sel.filter((u) => !u.dead);
  if (sel.length === 1 && isBuilding(sel[0])) {
    if (sel[0].def.trains) { sel[0].rally = at.clone(); G.ring(at, 0.7, 0x7db7ff, 0.6); }
    return;
  }
  const units = sel.filter(own);
  if (!units.length) return;
  const enemy = unitAt(x, y, G.skeletonsAlive(), 30) || (flat(at, K.portal.home) < 3.2 && !K.portal.dead ? K.portal : null);
  const node = K.arena.nodeAt(at.x, at.z, 0.9);
  const owner = K.arena.ownerAt(at.x, at.z);
  const site = owner && owner.building && !owner.dead ? owner : null;
  const spots = formation(units.filter((u) => u.kKind !== 'worker').length || 1, at);
  let k = 0;
  for (const u of units) {
    if (u.kKind === 'worker') {
      if (node) u.task = { type: 'gather', node, res: node.res };
      else if (site && !site.done) u.task = { type: 'build', site };
      else if (site && site.def.drop && u.carry > 0) u.task = { type: 'gather', node: null, res: u.carryRes, drop: true };
      else u.task = { type: 'move', x: at.x + (Math.random() - 0.5) * 1.6, z: at.z + (Math.random() - 0.5) * 1.6 };
      continue;
    }
    const spot = spots[k++] || at;
    if (u.kKind === 'hero') {
      u.kOrder = enemy ? { type: 'attack', target: enemy } : null;
      u.post.set(enemy ? enemy.pos.x : spot.x, 0, enemy ? enemy.pos.z : spot.z);
      u.targetFocus = enemy || null;
      u.targetFocusT = enemy ? 2 : 0;
    } else u.order = enemy ? { type: 'attack', target: enemy } : { type: 'move', x: spot.x, z: spot.z };
  }
  G.ring(enemy ? enemy.pos : node ? new THREE.Vector3(node.x, 0, node.z) : at, enemy ? 1 : 0.6, enemy ? 0xff5a4a : node ? 0xffe066 : 0x7dff8a, 0.5);
  G.audio?.play?.('click');
}

// ---------- construção: fantasma verde/vermelho na grade ----------
const ghostOk = new THREE.MeshBasicMaterial({ color: 0x6dff7a, transparent: true, opacity: 0.45, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.45, depthWrite: false });
function startPlacing(type) {
  cancelPlacing();
  R.placing = { type, ok: false, i0: 0, j0: 0 };
  const g = models.makeBuilding(type);
  const def = BUILDINGS[type];
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(def.size * ARENA.CELL, def.size * ARENA.CELL).rotateX(-Math.PI / 2), ghostOk);
  pad.position.y = 0.05;
  g.add(pad);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.ghost = true; } });
  R.ghost = g;
  G.scene.add(g);
  updateGhost();
}
function cancelPlacing() {
  if (!R?.ghost) { if (R) R.placing = null; return; }
  R.ghost.removeFromParent();
  R.ghost = null;
  R.placing = null;
}
function updateGhost() {
  const p = R.placing;
  if (!p || !R.ghost) return;
  const at = groundAt(R.mouse.x, R.mouse.y);
  if (!at) return;
  const def = BUILDINGS[p.type];
  const { i0, j0 } = K.arena.snap(def.size, at.x, at.z);
  p.i0 = i0; p.j0 = j0;
  p.ok = canPlaceBuilding(K, p.type, i0, j0) && canAfford(K, def.cost);
  const c = K.arena.footprint(def.size, i0, j0);
  R.ghost.position.set(c.x, 0, c.z);
  R.ghost.traverse((o) => { if (o.isMesh) o.material = p.ok ? ghostOk : ghostBad; });
}
function tryPlace(shift) {
  const p = R.placing;
  updateGhost();
  if (!p) return;
  const def = BUILDINGS[p.type];
  if (!canAfford(K, def.cost)) { flashCost(def.cost); return; }
  const b = placeBuilding(K, p.type, p.i0, p.j0, (type) => new Building(type));
  if (typeof b === 'string') { G.audio?.play?.('click'); return; }
  b.startSite();
  for (const u of R.sel) if (u.kKind === 'worker' && !u.dead) u.task = { type: 'build', site: b };
  G.ring(b.pos, b.reach + 0.4, 0x7dff8a, 0.6);
  G.audio?.play?.('click');
  if (!shift) cancelPlacing();
}

// ---------- interface ----------
function el(tag, cls, html = '') { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; }
function buildUI() {
  const hudLeft = document.querySelector('#hud .hud-left');
  R.ui = el('div', 'k-top');
  R.ui.innerHTML = RES.map((r) => `<span class="k-chip" data-res="${r}" data-tip="${RES_NAME[r]}" aria-label="${RES_NAME[r]}">${ICONS[r]}<b>0</b></span>`).join('')
    + `<span class="k-chip k-pop" data-tip="População · casas aumentam" aria-label="População">${ICONS.pop}<b>0/5</b></span>`
    + `<button type="button" class="k-chip k-idle" data-tip="Aldeão parado · tecla ." aria-label="Selecionar aldeão parado">⚒<b>0</b></button>`;
  hudLeft.prepend(R.ui);
  R.ui.querySelector('.k-idle').onclick = selectIdleWorker;
  R.waveChip = el('div', 'k-wave');
  R.waveChip.innerHTML = `<span class="k-wave-n" data-tip="Próxima onda de esqueletos">☠<b>1</b></span><span class="k-wave-t">${ICONS.time}<b>2:00</b></span>`
    + `<span class="k-portal-hp" data-tip="Portal de Ossos · destrua para vencer"><i></i></span>`;
  hudLeft.after(R.waveChip);
  R.panel = el('div', 'k-panel');
  R.panel.innerHTML = '<canvas class="k-map" width="224" height="160" aria-label="Mapa"></canvas><div class="k-sel"></div><div class="k-cmds"></div>';
  document.body.appendChild(R.panel);
  R.map = R.panel.querySelector('.k-map');
  R.mapBg = mapBackground();
  // aviso de onda: um ícone por origem (portal e covas) na borda da tela, apontando para ela
  R.alerts = [-1, ...K.arena.entries.map((_, i) => i)].map((src) => {
    const a = el('div', 'k-alert', '<i></i><span>☠</span>');
    a.hidden = true;
    a.dataset.src = src;
    a.setAttribute('aria-hidden', 'true');
    document.body.appendChild(a);
    return a;
  });
  R.selBox = R.panel.querySelector('.k-sel');
  R.cmds = R.panel.querySelector('.k-cmds');
  R.box = el('div', 'k-box');
  R.box.hidden = true;
  document.body.appendChild(R.box);
  R.map.addEventListener('pointerdown', mapPointer);
  R.map.addEventListener('pointermove', (e) => { if (e.buttons & 1) mapPointer(e); });
  R.map.addEventListener('contextmenu', (e) => e.preventDefault());
}

function selectionKey() {
  return R.sel.map((u) => u.id ||= Math.random().toString(36).slice(2)).join() + `|${R.heroPick}|${R.sel[0]?.done}|${R.sel[0]?.queue?.length}`;
}
function updateUI() {
  if (!K) return;
  R.sel = R.sel.filter((u) => !u.dead && G.units.includes(u));
  for (const r of RES) {
    const b = R.ui.querySelector(`[data-res="${r}"] b`);
    const v = String(Math.floor(K.res[r]));
    if (b.textContent !== v) b.textContent = v;
  }
  const cap = popCap(K), used = popUsed(K);
  const pop = R.ui.querySelector('.k-pop');
  pop.querySelector('b').textContent = `${used}/${cap}`;
  pop.classList.toggle('full', used >= cap);
  const idle = K.units.filter((u) => u.kKind === 'worker' && !u.dead && !u.task).length;
  const idleBtn = R.ui.querySelector('.k-idle');
  idleBtn.querySelector('b').textContent = idle;
  idleBtn.classList.toggle('none', !idle);
  R.waveChip.querySelector('.k-wave-n b').textContent = K.waveN + 1;
  R.waveChip.querySelector('.k-wave-t b').textContent = clock(Math.max(0, K.waveT));
  R.waveChip.classList.toggle('soon', K.waveT < 15);
  const portalFill = K.portal ? Math.max(0, K.portal.hp / K.portal.maxHp) : 0;
  R.waveChip.querySelector('.k-portal-hp i').style.width = `${(portalFill * 100).toFixed(1)}%`;
  const key = selectionKey();
  if (key !== R.selKey) { R.selKey = key; renderSelection(); renderCommands(); }
  refreshPanel();
}

function unitIcon(u) {
  if (u.kKind === 'hero') return `<img src="${u.cfg.portrait}" alt="">`;
  if (u.building) return `<span class="k-glyph">${u.def.glyph}</span>`;
  return `<span class="k-glyph">${UNITS[u.kKind]?.glyph || '?'}</span>`;
}
const unitName = (u) => u.kKind === 'hero' ? (u.cfg.names?.[u.level - 1] || u.cfg.name) : u.building ? u.def.name : UNITS[u.kKind]?.name;
function renderSelection() {
  const box = R.selBox, sel = R.sel;
  if (!sel.length) { box.innerHTML = '<div class="k-empty" aria-hidden="true">♜</div>'; return; }
  if (sel.length === 1) {
    const u = sel[0];
    let extra = '';
    if (u.building && !u.done) extra = '<div class="k-progress" data-tip="Construção"><i></i></div>';
    else if (u.building && u.def.trains) extra = '<div class="k-queue"></div>';
    else if (u.kKind === 'worker') extra = '<div class="k-carry"></div>';
    else if (!u.building) extra = `<div class="k-stats"><span data-tip="Ataque">⚔ ${Math.round(u.dmg)}</span><span data-tip="Alcance">◎ ${(+u.range).toFixed(1)}</span>${u.kKind === 'hero' ? `<span data-tip="Nível">★ ${u.level}</span>` : ''}</div>`;
    if (u.building && u.def.attack && u.done) extra += `<div class="k-stats"><span data-tip="Dano por flecha">⚔ ${u.def.attack.dmg}</span><span data-tip="Alcance">◎ ${u.def.attack.range}</span></div>`;
    if (u.building && u.def.pop && u.done) extra += `<div class="k-stats"><span data-tip="População">${ICONS.pop} +${u.def.pop}</span></div>`;
    box.innerHTML = `<div class="k-one"><div class="k-portrait" data-tip="${esc(unitName(u))}">${unitIcon(u)}</div>`
      + `<div class="k-info"><div class="k-hp"><i></i><b></b></div>${extra}</div></div>`;
    return;
  }
  box.innerHTML = `<div class="k-many">${sel.slice(0, 24).map((u, i) => `<button type="button" class="k-mini" data-i="${i}" data-tip="${esc(unitName(u))}">${unitIcon(u)}<i></i></button>`).join('')}</div>`;
  box.querySelectorAll('.k-mini').forEach((b) => { b.onclick = (e) => { const u = R.sel[+b.dataset.i]; select([u], e.shiftKey); }; });
}

function refreshPanel() {
  const sel = R.sel;
  if (sel.length === 1) {
    const u = sel[0];
    const hp = R.selBox.querySelector('.k-hp');
    if (hp) { hp.querySelector('i').style.width = `${Math.max(0, u.hp / u.maxHp) * 100}%`; hp.querySelector('b').textContent = `${Math.ceil(u.hp)}/${Math.round(u.maxHp)}`; }
    const prog = R.selBox.querySelector('.k-progress i');
    if (prog) prog.style.width = `${u.progress * 100}%`;
    const q = R.selBox.querySelector('.k-queue');
    if (q) {
      const html = u.queue.map((item, i) => `<button type="button" class="k-qi${item.blocked ? ' blocked' : ''}" data-i="${i}" data-tip="${item.blocked ? 'Falta casa (população)' : 'Clique para cancelar'}">`
        + `${item.kind === 'hero' ? `<img src="${item.cfg.portrait}" alt="">` : `<span class="k-glyph">${UNITS[item.kind].glyph}</span>`}${i === 0 ? `<i style="width:${(item.t / UNITS[item.kind].time * 100).toFixed(0)}%"></i>` : ''}</button>`).join('');
      if (q.dataset.html !== html) {
        q.dataset.html = html;
        q.innerHTML = html;
        q.querySelectorAll('.k-qi').forEach((b) => { b.onclick = () => { cancelQueue(K, u, +b.dataset.i); G.audio?.play?.('click'); }; });
      }
    }
    const carry = R.selBox.querySelector('.k-carry');
    if (carry) {
      const html = u.carry > 0.5 ? `${ICONS[u.carryRes]}<b>${Math.floor(u.carry)}</b>` : '';
      if (carry.dataset.html !== html) { carry.dataset.html = html; carry.innerHTML = html; }
    }
  } else if (sel.length > 1) {
    R.selBox.querySelectorAll('.k-mini').forEach((b) => { const u = sel[+b.dataset.i]; if (u) b.querySelector('i').style.width = `${Math.max(0, u.hp / u.maxHp) * 100}%`; });
  }
  // botões: custo que falta fica apagado; recargas das habilidades do herói
  for (const b of R.cmds.querySelectorAll('[data-cost]')) {
    const cost = JSON.parse(b.dataset.cost);
    b.classList.toggle('poor', !canAfford(K, cost));
  }
  for (const b of R.cmds.querySelectorAll('.k-skill')) {
    const h = sel[0], slot = +b.dataset.slot;
    if (!h?.skillTimers) continue;
    const t = h.skillTimers[slot];
    b.classList.toggle('ready', t <= 0 && !h.dead);
    b.querySelector('.k-cd').textContent = t > 0 ? Math.ceil(t) : '';
    b.querySelector('.k-auto').classList.toggle('on', !!h.autoSkills[slot]);
  }
  const heroBtn = R.cmds.querySelector('[data-kind="hero"]');
  if (heroBtn) heroBtn.classList.toggle('limit', heroCount(K) >= HERO_LIMIT);
}

function cmdButton(key, glyph, tip, cost, onClick, extra = '') {
  const b = el('button', 'k-cmd', `<span class="k-glyph">${glyph}</span>${cost ? `<span class="k-costs">${costHTML(cost)}</span>` : ''}<kbd>${key}</kbd>${extra}`);
  b.type = 'button';
  b.dataset.key = key;
  b.setAttribute('data-tip', tip);
  b.setAttribute('aria-label', tip);
  if (cost) b.dataset.cost = JSON.stringify(cost);
  b.onclick = onClick;
  return b;
}
function renderCommands() {
  const box = R.cmds;
  box.innerHTML = '';
  box.classList.remove('heroes');
  const sel = R.sel;
  let k = 0;
  const add = (...args) => box.appendChild(cmdButton(KEYS[k++] || '', ...args));
  if (R.heroPick) {
    box.classList.add('heroes');
    const owned = new Set(K.units.filter((u) => u.kKind === 'hero').map((u) => u.cfg.id));
    for (const b of K.buildings) for (const q of b.queue) if (q.cfg) owned.add(q.cfg.id);
    const free = G.VARIANTS.filter((v) => G.variantOpen(v.id) && !owned.has(v.id));
    for (const cfg of free) {
      const b = el('button', 'k-hero', `<span aria-hidden="true">${G.skillGlyph(cfg.id, 0)}</span><img src="${cfg.portrait}" alt="">`);
      b.type = 'button';
      b.setAttribute('data-tip', `${cfg.name} · ${cfg.desc}`);
      b.setAttribute('aria-label', cfg.name);
      b.style.setProperty('--c', cfg.color[0]);
      b.onclick = () => { train(sel[0], 'hero', cfg); R.heroPick = false; R.selKey = ''; };
      box.appendChild(b);
    }
    const back = el('button', 'k-hero k-back', '↩');
    back.type = 'button';
    back.setAttribute('data-tip', 'Voltar · Esc');
    back.onclick = () => { R.heroPick = false; R.selKey = ''; };
    box.appendChild(back);
    return;
  }
  if (sel.length === 1 && isBuilding(sel[0])) {
    const b = sel[0];
    if (!b.done) return;
    for (const kind of b.def.trains || []) {
      const def = UNITS[kind];
      const btn = add(def.glyph, `${def.name} · ${def.tip} · ${costText(def.cost)}`, def.cost,
        () => kind === 'hero' ? (heroCount(K) < HERO_LIMIT ? (R.heroPick = true, R.selKey = '') : G.popText(b.pos, `♛ ${HERO_LIMIT}/${HERO_LIMIT}`, 'block')) : train(b, kind));
      btn.dataset.kind = kind;
    }
    return;
  }
  if (sel.some((u) => u.kKind === 'worker')) {
    for (const type of BUILD_MENU) {
      const def = BUILDINGS[type];
      add(def.glyph, `${def.name} · ${def.tip} · ${costText(def.cost)}`, def.cost, () => startPlacing(type));
    }
    return;
  }
  if (sel.length === 1 && sel[0].kKind === 'hero') {
    const h = sel[0];
    const skills = G.skillSetFor(h.cfg);
    for (const skill of skills) {
      const slot = skill.slot;
      const btn = add(G.skillGlyph(h.cfg.id, slot), '', null, () => { const r = h.requestSkill(null, slot); if (r !== 'ok') G.audio?.play?.('click'); },
        '<b class="k-cd"></b><span class="k-auto" role="button" aria-label="Uso automático">↻</span>');
      btn.classList.add('k-skill');
      btn.dataset.slot = slot;
      btn.setAttribute('data-tip', 'skill');
      btn.setAttribute('data-hero', h.cfg.id);
      btn.setAttribute('data-slot', String(slot));
      btn.setAttribute('aria-label', skill.name);
      btn.querySelector('.k-auto').onclick = (e) => { e.stopPropagation(); h.autoSkills[slot] = !h.autoSkills[slot]; };
    }
  }
  if (sel.length && sel.every((u) => !u.building)) {
    add('■', 'Parar', null, () => {
      for (const u of R.sel) {
        if (u.kKind === 'hero') { u.kOrder = null; u.post.copy(u.pos); }
        else if (u.order !== undefined) { u.order = null; u.anchor.copy(u.pos); }
      }
    });
  }
}

function flashCost(cost) {
  for (const r of RES) if ((cost[r] || 0) > K.res[r]) {
    const chip = R.ui.querySelector(`[data-res="${r}"]`);
    chip.classList.remove('short');
    void chip.offsetWidth;
    chip.classList.add('short');
  }
  G.audio?.play?.('click');
}
function train(b, kind, cfg = null) {
  const r = enqueue(K, b, kind, cfg);
  if (r === 'cost') flashCost(UNITS[kind].cost);
  else if (r === 'limit') G.popText(b.pos, `♛ ${HERO_LIMIT}/${HERO_LIMIT}`, 'block');
  else if (r === 'full') G.popText(b.pos, '5/5', 'block');
  else G.audio?.play?.('click');
  R.selKey = '';
}

function selectIdleWorker() {
  const idle = K.units.filter((u) => u.kKind === 'worker' && !u.dead && !u.task);
  if (!idle.length) return;
  const w = idle[R.idleIdx++ % idle.length];
  select([w]);
  R.cam.x = w.pos.x; R.cam.z = w.pos.z + 2;
}

// ---------- aviso de onda: ícone na borda da tela apontando para a origem; cova brilha ----------
function updateAlerts() {
  const warn = warnedSources(), t = performance.now() / 1000;
  const glows = R.root.userData.entryGlows || [];
  glows.forEach((g, i) => g.scale.setScalar(warn.includes(i) ? 1 + 0.25 * Math.sin(t * 7) : 1));
  const m = 46, top = 96, bottom = innerHeight - 200;
  for (const a of R.alerts || []) {
    const src = Number(a.dataset.src);
    if (!warn.includes(src)) { if (!a.hidden) a.hidden = true; continue; }
    const p = sourceAt(src), sp = screenOf({ x: p.x, y: 0, z: p.z }, 2);
    let x = sp.x, y = sp.y;
    if (!sp.front) { x = innerWidth - x; y = bottom; }
    const inside = sp.front && x > m && x < innerWidth - m && y > top && y < bottom;
    const cx = innerWidth / 2, cy = (top + bottom) / 2;
    const ang = Math.atan2(y - cy, x - cx);
    if (!inside) {   // empurra para a borda na direção da origem
      const k = Math.min((innerWidth / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), ((bottom - top) / 2) / Math.abs(Math.sin(ang) || 1e-6));
      x = cx + Math.cos(ang) * k; y = cy + Math.sin(ang) * k;
    }
    a.hidden = false;
    a.classList.toggle('edge', !inside);
    a.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    a.firstChild.style.transform = `rotate(${inside ? 90 : (ang * 180 / Math.PI).toFixed(0)}deg)`;
  }
}

// ---------- minimapa ----------
const WARN_T = 25;   // segundos de aviso antes da onda: setas na borda da tela, covas e minimapa pulsando
const warnedSources = () => (K && !G.game.over && K.waveT < WARN_T ? K.nextSources : []);
const sourceAt = (src) => (src < 0 ? K.portal?.home || K.arena.portalAt : K.arena.entries[src]);
// fundo do minimapa desenhado uma vez: grama → ermo, estrada, água, pontes, mata e rochedos
function mapBackground() {
  const a = K.arena, cv = document.createElement('canvas');
  cv.width = R.map.width; cv.height = R.map.height;
  const ctx = cv.getContext('2d'), cw = cv.width / a.cols, ch = cv.height / a.rows;
  const mix = (p, q, t) => `rgb(${p.map((v, k) => Math.round(v + (q[k] - v) * t)).join()})`;
  const COL = { grass: [90, 165, 47], dead: [110, 97, 82], road: [201, 164, 102], water: [63, 143, 208], murky: [59, 79, 90], bridge: [160, 112, 58],
    ford: [127, 196, 224], forest: [46, 95, 34], cliff: [138, 133, 126], darkCliff: [76, 69, 82] };
  for (let j = 0; j < a.rows; j++) for (let i = 0; i < a.cols; i++) {
    const k = a.idx(i, j), x = a.cellX(i), z = a.cellZ(j), g = a.gloom(x, z), t = a.ground[k];
    ctx.fillStyle = t === TERRAIN.WATER ? mix(COL.water, COL.murky, g * 0.7) : t === TERRAIN.BRIDGE ? mix(COL.bridge, COL.bridge, 0)
      : t === TERRAIN.FORD ? mix(COL.ford, COL.ford, 0) : t === TERRAIN.FOREST ? mix(COL.forest, COL.darkCliff, g * 0.6)
      : t === TERRAIN.CLIFF ? mix(COL.cliff, COL.darkCliff, g) : a.road[k] ? mix(COL.road, COL.dead, g * 0.6) : mix(COL.grass, COL.dead, g);
    ctx.fillRect(Math.floor(i * cw), Math.floor(j * ch), Math.ceil(cw), Math.ceil(ch));
  }
  return cv;
}
function drawMinimap() {
  const cv = R.map, ctx = cv.getContext('2d');
  const sx = cv.width / ARENA.W, sz = cv.height / ARENA.H;
  const X = (x) => (x + ARENA.W / 2) * sx, Z = (z) => (z + ARENA.H / 2) * sz;
  ctx.drawImage(R.mapBg, 0, 0);
  for (const n of K.arena.nodes) {
    if (n.farm) continue;
    ctx.fillStyle = n.res === 'wood' ? '#1f5a17' : n.res === 'stone' ? '#c4c9d0' : n.res === 'food' ? '#ff5a6a' : '#ffd23a';
    const s = n.res === 'wood' ? 2.4 : 3.6;
    ctx.fillRect(X(n.x) - s / 2, Z(n.z) - s / 2, s, s);
  }
  // covas de ossos; a origem da próxima onda pulsa em vermelho
  const warn = warnedSources(), pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
  K.arena.entries.forEach((e, i) => {
    ctx.fillStyle = '#7a3fd1';
    ctx.beginPath(); ctx.arc(X(e.x), Z(e.z), 3, 0, 7); ctx.fill();
  });
  for (const src of warn) {
    const p = sourceAt(src);
    ctx.strokeStyle = `rgba(255, 80, 60, ${0.5 + 0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 6 + pulse * 4, 0, 7); ctx.stroke();
  }
  for (const b of K.buildings) {
    const w = b.def.size * ARENA.CELL * sx;
    ctx.fillStyle = b.def.farm ? (b.done ? '#d9b44a' : '#efd98f') : b.done ? '#3d7be0' : '#9cc2ff';
    ctx.fillRect(X(b.pos.x) - w / 2, Z(b.pos.z) - w / 2, w, w);
  }
  for (const u of G.units) {
    if (u.dead || u.building) continue;
    if (u.kPortal) { ctx.fillStyle = '#b36bff'; ctx.beginPath(); ctx.arc(X(u.pos.x), Z(u.pos.z), 5, 0, 7); ctx.fill(); continue; }
    ctx.fillStyle = u.team === 'skeleton' ? '#ff4a3a' : u.team === 'hero' ? '#ffe066' : '#bfe3ff';
    const s = u.team === 'hero' ? 4 : 2.6;
    ctx.fillRect(X(u.pos.x) - s / 2, Z(u.pos.z) - s / 2, s, s);
  }
  // área vista pela câmera
  const corners = [[0, 0], [innerWidth, 0], [innerWidth, innerHeight - 170], [0, innerHeight - 170]].map(([x, y]) => groundAt(x, y));
  if (corners.every(Boolean)) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    corners.forEach((c, i) => (i ? ctx.lineTo(X(c.x), Z(c.z)) : ctx.moveTo(X(c.x), Z(c.z))));
    ctx.closePath();
    ctx.stroke();
  }
}
function mapPointer(e) {
  e.preventDefault();
  const r = R.map.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * ARENA.W - ARENA.W / 2, z = (e.clientY - r.top) / r.height * ARENA.H - ARENA.H / 2;
  if (e.button === 2) {
    const s = screenOf({ x, y: 0, z }, 0);
    command(s.x, s.y);
    return;
  }
  R.cam.x = x;
  R.cam.z = z + R.cam.dist * 0.25;
}

// ---------- entrada ----------
let listeners = [];
function on(target, type, fn, opts) { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); }
function unbindInput() { for (const [t, type, fn, opts] of listeners) t.removeEventListener(type, fn, opts); listeners = []; }
const blocked = () => !K || !R || G.game.over || G.game.paused || G.pickOpen();
function bindInput() {
  const canvas = G.renderer.domElement;
  on(canvas, 'pointerdown', (e) => {
    if (!K) return;
    e.stopImmediatePropagation();
    if (blocked()) return;
    if (e.button === 1) { e.preventDefault(); R.pan = { x: e.clientX, y: e.clientY, cx: R.cam.x, cz: R.cam.z }; return; }
    if (e.button === 2) { e.preventDefault(); if (R.placing) cancelPlacing(); else command(e.clientX, e.clientY, e.shiftKey); return; }
    if (e.button !== 0) return;
    if (R.placing) { tryPlace(e.shiftKey); return; }
    R.drag = { x: e.clientX, y: e.clientY, shift: e.shiftKey, ctrl: e.ctrlKey };
  }, true);
  on(canvas, 'pointerup', (e) => { if (K) e.stopImmediatePropagation(); }, true);
  on(canvas, 'wheel', (e) => {
    if (!K) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    R.cam.dist = THREE.MathUtils.clamp(R.cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 18, 50);
  }, { capture: true, passive: false });
  on(window, 'pointermove', (e) => {
    if (!R) return;
    R.mouse.x = e.clientX; R.mouse.y = e.clientY; R.mouse.inside = true;
    if (R.pan) { const k = R.cam.dist / innerHeight * 1.6; R.cam.x = R.pan.cx - (e.clientX - R.pan.x) * k; R.cam.z = R.pan.cz - (e.clientY - R.pan.y) * k; }
    if (R.drag) {
      const x0 = Math.min(R.drag.x, e.clientX), y0 = Math.min(R.drag.y, e.clientY);
      const w = Math.abs(e.clientX - R.drag.x), h = Math.abs(e.clientY - R.drag.y);
      R.box.hidden = w + h < 8;
      Object.assign(R.box.style, { left: `${x0}px`, top: `${y0}px`, width: `${w}px`, height: `${h}px` });
    }
  });
  on(document, 'pointerleave', () => { if (R) R.mouse.inside = false; });
  on(window, 'blur', () => { if (R) { R.keys.clear(); R.mouse.inside = false; } });
  on(window, 'pointerup', (e) => {   // captura: o canvas corta a propagação para o resto do jogo
    if (!R) return;
    if (e.button === 1) R.pan = null;
    if (e.button !== 0 || !R.drag) return;
    const d = R.drag;
    R.drag = null;
    R.box.hidden = true;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) >= 8) {
      const x0 = Math.min(d.x, e.clientX), x1 = Math.max(d.x, e.clientX), y0 = Math.min(d.y, e.clientY), y1 = Math.max(d.y, e.clientY);
      const inside = K.units.filter((u) => {
        if (u.dead) return false;
        const s = screenOf(u.pos, 0.8);
        return s.front && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
      });
      // soldados e heróis têm preferência sobre aldeões no retângulo, como nos RTS clássicos
      const army = inside.filter((u) => u.kKind !== 'worker');
      select(army.length ? army : inside, d.shift);
      return;
    }
    clickSelect(e.clientX, e.clientY, d.shift);
  }, true);
  on(window, 'keydown', onKey, true);
  on(window, 'keyup', (e) => { if (R) R.keys.delete(e.key.toLowerCase()); });
}

function clickSelect(x, y, shift) {
  const u = unitAt(x, y, K.units, 24);
  const now = performance.now();
  if (u) {
    // duplo clique: todos do mesmo tipo na tela
    if (R.lastClick.u === u && now - R.lastClick.t < 380) {
      const same = K.units.filter((o) => !o.dead && o.kKind === u.kKind && screenOf(o.pos).front
        && (() => { const s = screenOf(o.pos); return s.x >= 0 && s.x <= innerWidth && s.y >= 0 && s.y <= innerHeight; })());
      select(same, shift);
    } else select([u], shift);
    R.lastClick = { t: now, u };
    return;
  }
  const at = groundAt(x, y);
  const b = at && K.arena.ownerAt(at.x, at.z);
  if (b && b.building && !b.dead) { select([b]); return; }
  if (!shift) select([]);
}

function onKey(e) {
  if (!K || !R) return;
  if (e.target.closest?.('input, textarea, select')) return;
  const key = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && !e.ctrlKey && !e.altKey) {
    R.keys.add(key);
    if (key.startsWith('arrow')) e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (blocked()) return;
  if (e.key === 'Escape') {
    if (R.placing) cancelPlacing();
    else if (R.heroPick) { R.heroPick = false; R.selKey = ''; }
    else select([]);
    return;
  }
  // grupos: Ctrl (ou Alt) + 1..4 guarda; 1..4 chama; dois toques centralizam
  if (/^[1-4]$/.test(e.key)) {
    const n = +e.key;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.ctrlKey || e.altKey || e.metaKey) {
      R.groups[n] = R.sel.filter(own);
      G.showBanner(`${n} · ${R.groups[n].length}`, 0.9);
      return;
    }
    const group = (R.groups[n] || []).filter((u) => !u.dead && G.units.includes(u));
    if (!group.length) return;
    select(group);
    const now = performance.now();
    if (R.lastGroup.n === n && now - R.lastGroup.t < 400) { R.cam.x = group[0].pos.x; R.cam.z = group[0].pos.z + 2; }
    R.lastGroup = { n, t: now };
    return;
  }
  if (e.key === '.') { selectIdleWorker(); e.preventDefault(); return; }
  if (key === 'h' && !e.ctrlKey) { if (K.castle && !K.castle.dead) { select([K.castle]); R.cam.x = K.castle.pos.x + 4; R.cam.z = K.castle.pos.z + 4; } return; }
  if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
  const btn = R.cmds.querySelector(`[data-key="${e.key.toUpperCase()}"]`);
  if (btn) { btn.click(); e.preventDefault(); e.stopImmediatePropagation(); }
}

// main.js chama estes três enquanto o modo está ativo (game.realm)
const realm = { tick, camera: cameraFrame, stop: stopKingdom, get state() { return K; } };
// atalhos para inspeção no console e nas capturas automáticas (não fazem parte da interface)
export const kingdomDebug = { get K() { return K; }, get R() { return R; }, get game() { return G.game; }, get controls() { return G.controls; }, get renderer() { return G.renderer; },
  build(type, x, z, done = true) { const { i0, j0 } = K.arena.snap(BUILDINGS[type].size, x, z); const b = addBuilding(K, type, i0, j0, (t) => new Building(t), done); if (!done) b.startSite(); return b; },
  unit(kind, x, z) { const u = kind === 'worker' ? new Worker() : new Soldier(kind); u.pos.set(x, 0, z); if (u.anchor) u.anchor.copy(u.pos); u.kKind = kind; K.units.push(u); return u; } };
