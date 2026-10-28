import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createWorld } from './world.js';
import { CHARACTERS, CHARACTER_ASSETS, buildCharacter, applyLook } from './characters.js';
import { LOOKS } from './looks.js';
import { newStats, openHeroPanel, closeHeroPanel, panelHero, tickHeroPanel, summaryHTML } from './stats.js';
import * as audio from './audio.js';

const ROAD = 5;             // metade da largura da estrada
const PHASES = 12;          // a última fase fica no topo, no castelo
const LEASH = 5;            // quanto o herói se afasta do posto para lutar
const MARCH = 2.4;          // velocidade do grupo andando pela estrada entre as fases

// A classe fornece os atributos básicos; os postos são distribuídos ao entrar.
const HEROES = [
  { name: 'Cavaleiro', model: 'Knight', post: [0, -0.8], hp: 240, dmg: 30, range: 1.5, speed: 3.2, cooldown: 0.85, idle: 'Idle', attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'],
    weapons: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'] },
  { name: 'Bárbaro', model: 'Barbarian', post: [-1.7, -0.3], hp: 260, dmg: 34, range: 1.7, speed: 2.8, cooldown: 1.4, idle: '2H_Melee_Idle', cleave: 2.2, attacks: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'],
    weapons: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'] },
  { name: 'Mago', model: 'Mage', post: [0, 1.4], hp: 150, dmg: 28, range: 7, speed: 2.6, cooldown: 1.3, idle: 'Idle', ranged: true, splash: 1.4, attacks: ['Spellcast_Shoot'],
    weapons: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'] },
  { name: 'Ladino', model: 'Rogue', post: [1.7, -0.3], hp: 180, dmg: 18, range: 1.4, speed: 4, cooldown: 0.55, idle: 'Idle', attacks: ['Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab'],
    weapons: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'] },
];
// As receitas substituem o modelo e as peças da classe.
const VARIANTS = [
  { id: 'paladin', names: ['Paladino', 'Paladino Real', 'Santo Guerreiro'], desc: 'Cura os amigos próximos.', ability: 'Círculo de cura', color: ['#a9e9bc', '#55a77b'],
    use: ['1H_Sword', 'Round_Shield'], stats: { Vida: 5, Força: 3, Rapidez: 3, Alcance: 1 }, classId: 0 },
  { id: 'guardian', names: ['Guardião', 'Guardião Real', 'Muralha Viva'], desc: 'Atrai inimigos e reduz o dano.', ability: 'Provocar', color: ['#9fcfff', '#568ccc'],
    use: ['1H_Sword', 'Rectangle_Shield'], stats: { Vida: 5, Força: 2, Rapidez: 2, Alcance: 1 }, hp: 300, dmg: 24, classId: 0 },
  { id: 'champion', names: ['Campeão', 'Campeão Real', 'Lâmina Solar'], desc: 'Gira e empurra os inimigos.', ability: 'Turbilhão', color: ['#ffe59b', '#c99a3e'],
    use: ['2H_Sword'], stats: { Vida: 4, Força: 5, Rapidez: 3, Alcance: 2 }, dmg: 32, cooldown: 1.05, idle: '2H_Melee_Idle', attacks: ['2H_Melee_Attack_Slice'], classId: 0 },
  { id: 'berserker', names: ['Berserker', 'Fera Rubra', 'Fúria Titã'], desc: 'Pouca vida, golpes mais rápidos.', ability: 'Fúria', color: ['#ffb2b2', '#ce5f63'],
    use: ['1H_Axe', '1H_Axe_Offhand'], stats: { Vida: 4, Força: 4, Rapidez: 4, Alcance: 1 }, hp: 220, dmg: 30, cooldown: 0.95, cleave: 0, attacks: ['Dualwield_Melee_Attack_Slice'], classId: 1 },
  { id: 'crusher', names: ['Esmagador', 'Quebra-rochas', 'Abala-terra'], desc: 'Pancada que deixa todos zonzos.', ability: 'Terremoto', color: ['#ffbf8a', '#d88950'],
    use: ['2H_Axe'], stats: { Vida: 5, Força: 5, Rapidez: 2, Alcance: 2 }, dmg: 31, classId: 1 },
  { id: 'viking', names: ['Viking', 'Jarl Valente', 'Rei do Norte'], desc: 'Arremessa um machado à distância.', ability: 'Machado voador', color: ['#b8dfe5', '#5b9dab'],
    use: ['1H_Axe', 'Barbarian_Round_Shield'], stats: { Vida: 5, Força: 4, Rapidez: 3, Alcance: 3 }, cleave: 0, idle: 'Idle', attacks: ['1H_Melee_Attack_Chop'], classId: 1 },
  { id: 'pyro', names: ['Piromante', 'Chama Viva', 'Fênix Solar'], desc: 'Bolas de fogo deixam chamas no chão.', ability: 'Chão em chamas', color: ['#ffc6a4', '#dc8757'],
    use: ['2H_Staff'], stats: { Vida: 2, Força: 5, Rapidez: 2, Alcance: 5 }, dmg: 24, splash: 1.1, classId: 2 },
  { id: 'arcane', names: ['Arcano', 'Sábio Astral', 'Mestre Estelar'], desc: 'Um raio salta entre os inimigos.', ability: 'Raio em cadeia', color: ['#d4b3ff', '#9a6be0'],
    use: ['Spellbook_open', '1H_Wand'], stats: { Vida: 2, Força: 4, Rapidez: 3, Alcance: 5 }, dmg: 24, splash: 0, cooldown: 1.05, classId: 2 },
  { id: 'cryo', names: ['Criomante', 'Sábio Glacial', 'Coração Polar'], desc: 'Gelo deixa os esqueletos lentinhos.', ability: 'Onda de gelo', color: ['#b9efff', '#58aaca'],
    use: ['1H_Wand'], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 5 }, hp: 170, dmg: 24, splash: 0.8, cooldown: 1.2, classId: 2 },
  { id: 'assassin', names: ['Assassino', 'Sombra Ágil', 'Sombra Real'], desc: 'Golpes críticos e esquivas ligeiras.', ability: 'Passo das sombras', color: ['#d1b7df', '#9974b5'],
    use: ['Knife', 'Knife_Offhand'], stats: { Vida: 3, Força: 4, Rapidez: 5, Alcance: 1 }, classId: 3 },
  { id: 'crossbow', names: ['Besteiro', 'Mira de Águia', 'Flecha Real'], desc: 'Virotes atravessam a fila.', ability: 'Tiro perfurante', color: ['#c9eaa4', '#84ac50'],
    use: ['2H_Crossbow'], stats: { Vida: 3, Força: 4, Rapidez: 3, Alcance: 5 }, ranged: true, range: 7, cooldown: 1.05, attacks: ['2H_Ranged_Shoot'], classId: 3 },
  { id: 'ninja', names: ['Ninja', 'Vento Noturno', 'Lua Silenciosa'], desc: 'Lança três adagas em leque.', ability: 'Leque de adagas', color: ['#b6c5f4', '#768ac6'],
    use: ['Knife', 'Throwable'], stats: { Vida: 3, Força: 3, Rapidez: 5, Alcance: 4 }, model: 'Rogue_Hooded', classId: 3 },
  { id: 'king', names: ['Rei Dourado', 'Rei Radiante', 'Imperador Solar'], desc: 'Seu brado fortalece todo o grupo.', ability: 'Brado real', color: CHARACTERS[2].color,
    recipe: CHARACTERS[2], classId: 0, dmg: 28, idle: '2H_Melee_Idle', attacks: ['2H_Melee_Attack_Slice'], stats: { Vida: 5, Força: 3, Rapidez: 3, Alcance: 1 } },
  { id: 'iceviking', names: ['Viking do Gelo', 'Jarl Glacial', 'Rei das Geleiras'], desc: 'Seu machado congela uma área.', ability: 'Machado glacial', color: CHARACTERS[3].color,
    recipe: CHARACTERS[3], classId: 1, dmg: 29, stats: { Vida: 5, Força: 4, Rapidez: 2, Alcance: 3 } },
  { id: 'necro', names: ['Necromante', 'Senhor dos Ossos', 'Soberano Espectral'], desc: 'Invoca dois esqueletinhos amigos.', ability: 'Amigos do além', color: CHARACTERS[1].color,
    recipe: CHARACTERS[1], classId: 2, dmg: 24, splash: 0, stats: { Vida: 2, Força: 3, Rapidez: 2, Alcance: 5 } },
  { id: 'druid', names: ['Druida', 'Guardião do Bosque', 'Espírito da Floresta'], desc: 'Raízes prendem e a natureza cura.', ability: 'Abraço da floresta', color: CHARACTERS[0].color,
    recipe: CHARACTERS[0], classId: 3, ranged: true, range: 6, dmg: 21, cooldown: 1, attacks: ['Spellcast_Shoot'], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 4 } },
].map((v) => ({ ...HEROES[v.classId], ...v, name: v.names[0],
  hide: v.recipe ? [] : HEROES[v.classId].weapons.filter((w) => !v.use.includes(w)),
}));
const variantsOf = (classId) => VARIANTS.filter((v) => v.classId === classId);
const POSTS = [[0, -1.2], [-1.7, 0], [1.7, 0], [0, 1.7]];
const XP_LEVELS = [0, 90, 350];   // XP acumulado para Nv2 e Nv3

const SKELETONS = {
  Crossbow: { model: 'Rogue', hp: 34, dmg: 7, range: 10, speed: 0, cooldown: 2.3, weapon: 'Skeleton_Crossbow', ranged: true, attack: '2H_Ranged_Shoot' },
  Mage: { model: 'Mage', hp: 40, dmg: 9, range: 10, speed: 0, cooldown: 2.8, weapon: 'Skeleton_Staff', ranged: true, attack: 'Spellcast_Shoot' },
  Minion:  { hp: 36, dmg: 6,  range: 1.3, speed: 1.6, cooldown: 1.4, weapon: 'Skeleton_Blade' },
  Warrior: { hp: 80, dmg: 11, range: 1.4, speed: 1.3, cooldown: 1.6, weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Small_A' },
  Rogue:   { hp: 30, dmg: 8,  range: 1.3, speed: 2.3, cooldown: 1.1, weapon: 'Skeleton_Blade', move: 'Running_C' },
};

// Dificuldades: multiplicam vida/dano dos esqueletos, tamanho e ritmo das ondas e força do chefe;
// heal = cura ao vencer a fase, revive = vida de quem volta, reviveDelay = fases que o caído espera,
// behind/behindFrom = chance e fase mínima de virem por trás, shooters = chance de um atirador na estrada.
const DIFFICULTIES = [
  { id: 'facil', name: 'Fácil', icon: '❀', desc: 'Um passeio pelo reino.', color: ['#cdf0b4', '#6aa84f'],
    hp: 0.85, dmg: 0.8, count: 0.9, interval: 1.15, boss: 0.8, heal: 0.5, revive: 0.5, reviveDelay: 0, behind: 0.15, behindFrom: 5, shooters: 0 },
  { id: 'normal', name: 'Normal', icon: '⚔︎', desc: 'Os esqueletos vêm com tudo.', color: ['#bfe0ff', '#5a8fd0'],
    hp: 1.08, dmg: 1.05, count: 1.1, interval: 0.95, boss: 1, heal: 0.3, revive: 0.35, reviveDelay: 0, behind: 0.3, behindFrom: 4, shooters: 0.06 },
  { id: 'dificil', name: 'Difícil', icon: '♜', desc: 'Escolha bem cada herói.', color: ['#ffd29e', '#d17a2a'],
    hp: 1.25, dmg: 1.2, count: 1.25, interval: 0.9, boss: 1.15, heal: 0.25, revive: 0.3, reviveDelay: 0, behind: 0.35, behindFrom: 3, shooters: 0.1 },
  { id: 'pesadelo', name: 'Pesadelo', icon: '☠︎', desc: 'Caídos só voltam uma fase depois.', color: ['#f3b1c0', '#a3324a'],
    hp: 1.5, dmg: 1.4, count: 1.45, interval: 0.75, boss: 1.35, heal: 0.15, revive: 0.25, reviveDelay: 1, behind: 0.45, behindFrom: 2, shooters: 0.15 },
];
let difficulty = DIFFICULTIES[1];

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9d6f0);
scene.fog = new THREE.Fog(0xa9d6f0, 45, 110);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI * 0.45;
controls.minDistance = 8;
controls.maxDistance = 50;
const follow = new THREE.Vector3();   // ponto que a câmera persegue

const hemi = new THREE.HemisphereLight(0xfff4dc, 0xa89868, 1.8);   // sombras mais suaves
scene.add(hemi);
// céu, névoa e luz de dia e nas terras do necromante (misturados pela "trevas" de onde o grupo está)
const SKY = [new THREE.Color(0xa9d6f0), new THREE.Color(0x3f3552)];
const HEMI = [new THREE.Color(0xfff4dc), new THREE.Color(0xb8a8d8)], HEMI_GROUND = [new THREE.Color(0xa89868), new THREE.Color(0x3e3448)];
const SUN = [new THREE.Color(0xffe2b8), new THREE.Color(0xc6a8ff)];
const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
scene.add(sun, sun.target);

const world = createWorld(scene, ROAD, PHASES);

// ---------- interface ----------
const $ = (id) => document.getElementById(id);
const bars = $('bars');
let speed = 1;
$('speed').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; $('speed').textContent = `Velocidade ${speed}x`; };
$('restart').onclick = () => startGame();   // volta para a tela de dificuldade
$('overlayBtn').onclick = () => startGame();

function showBanner(text, seconds = 2) {
  const b = $('banner');
  b.textContent = text;
  b.style.opacity = 1;
  b.classList.remove('show');
  void b.offsetWidth;   // reinicia a animação de "pulo"
  b.classList.add('show');
  clearTimeout(showBanner.t);
  showBanner.t = setTimeout(() => (b.style.opacity = 0), seconds * 1000);
}

function setText(id, text) { const el = $(id); if (el.textContent !== text) el.textContent = text; }

// tela de escolha estilo arcade: grade com uma linha por classe, todas as variantes à mostra
const pick = { options: [], cards: [], sel: 0, open: false, timer: null };

function showPick(title, sub) {
  pick.mode = 'hero';
  $('banner').style.opacity = 0;   // a faixa não pode ficar embaixo do título da escolha
  pick.options = HEROES.flatMap((_, classId) => variantsOf(classId));   // índice = classe * 4 + coluna
  $('pickHint').textContent = 'Clique para escolher · setas movem · Enter confirma';
  $('pickTitle').textContent = title;
  $('pickSub').textContent = sub;
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.add('grid');
  const rows = document.createElement('div');
  rows.className = 'pick-rows';
  for (const hero of HEROES) {
    const row = document.createElement('div');
    row.className = 'pick-row';
    row.innerHTML = `<span class="class-tag">${hero.name}</span>`;
    rows.appendChild(row);
  }
  pick.cards = pick.options.map((cfg, i) => {
    const owned = isOwned(cfg);
    const b = document.createElement('div');
    b.className = owned ? 'card owned' : 'card';
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', owned ? `${cfg.name} (já está no grupo)` : `Escolher ${cfg.name}`);
    b.style.setProperty('--c', cfg.color[0]);
    b.style.setProperty('--cd', cfg.color[1]);
    b.style.setProperty('--d', `${i * 30}ms`);
    b.innerHTML = `<div class="portrait"><img src="${cfg.portrait}" alt=""></div><div class="ribbon">${cfg.name}</div>
      <strong class="ability">${cfg.ability}</strong>${owned ? '<span class="seal">No grupo</span>' : ''}`;
    if (!owned) b.onclick = () => confirmPick(i);
    bindCard(b, i);
    rows.children[cfg.classId].appendChild(b);
    return b;
  });
  pick.info = document.createElement('aside');
  pick.info.className = 'pick-info';
  list.append(rows, pick.info);
  selectCard(pick.options.findIndex((cfg) => !isOwned(cfg)));
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

const isOwned = (cfg) => heroes().some((h) => h.cfg.id === cfg.id);

// recordes por dificuldade (melhor fase e abates), guardados no navegador quando der
const RECORDS_KEY = 'cavaleiros-recordes';
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch { return {}; }
}

// devolve true quando a partida que acabou virou o novo recorde do nível
function saveRecord(won) {
  if (game.start > 1) return false;   // o atalho ?fase=N não vale recorde
  const records = loadRecords(), old = records[difficulty.id];
  const now = { phase: game.phase, kills: game.kills, won };
  const better = !old || (won && !old.won) || (won === !!old.won && (now.phase > old.phase || (now.phase === old.phase && now.kills > old.kills)));
  if (!better) return false;
  records[difficulty.id] = now;
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { return false; }
  return true;
}

// habilidade automática ou manual, lembrada por variante quando der
const AUTO_KEY = 'cavaleiros-auto';
function loadAuto(id) {
  try { return JSON.parse(localStorage.getItem(AUTO_KEY))?.[id] ?? true; } catch { return true; }
}
function saveAuto(id, on) {
  try {
    const all = JSON.parse(localStorage.getItem(AUTO_KEY)) || {};
    all[id] = on;
    localStorage.setItem(AUTO_KEY, JSON.stringify(all));
  } catch {}
}

// tela inicial: título e as quatro dificuldades com o recorde de cada uma
function showDifficulty() {
  pick.mode = 'difficulty';
  $('banner').style.opacity = 0;
  pick.options = DIFFICULTIES;
  const records = loadRecords();
  $('pickTitle').textContent = 'Cavaleiros vs Esqueletos';
  $('pickSub').textContent = 'Escolha a dificuldade da aventura';
  $('pickHint').textContent = 'Clique para escolher · ← → movem · Enter confirma';
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  pick.cards = DIFFICULTIES.map((d, i) => {
    const r = records[d.id];
    const record = r ? `${r.won ? '♛ Vitória!' : `Recorde: fase ${r.phase}`} · ${r.kills} abates` : 'Sem recorde ainda';
    const b = document.createElement('div');
    b.className = 'card diff';
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', `${d.name}: ${d.desc} ${record}`);
    b.style.setProperty('--c', d.color[0]);
    b.style.setProperty('--cd', d.color[1]);
    b.style.setProperty('--d', `${i * 90}ms`);
    b.innerHTML = `<div class="num">${i + 1}</div><div class="medal">${d.icon}</div><div class="ribbon">${d.name}</div>
      <p>${d.desc}</p><div class="record${r?.won ? ' won' : ''}">${record}</div>`;
    b.onclick = () => confirmPick(i);
    bindCard(b, i);
    list.appendChild(b);
    return b;
  });
  selectCard(DIFFICULTIES.indexOf(difficulty));
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

function confirmDifficulty(i) {
  difficulty = DIFFICULTIES[i];
  setText('level', difficulty.name);
  pick.open = false;
  pick.cards.forEach((c, k) => c.classList.add(k === i ? 'chosen' : 'gone'));
  pick.timer = setTimeout(() => showPick('Escolha seu herói', 'Ele vai liderar o grupo contra os esqueletos'), 550);
}

function bindCard(b, i) {
  b.onmouseenter = () => { if (!b.classList.contains('owned')) selectCard(i); };
  b.onpointermove = (e) => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / r.height) * 9) + 'deg');
    b.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 12) + 'deg');
  };
  b.onpointerleave = () => { b.style.setProperty('--rx', '0deg'); b.style.setProperty('--ry', '0deg'); };
  b.addEventListener('animationend', (e) => { if (e.animationName === 'rise') b.classList.add('arrived'); });
}

// painel de detalhes do cartão em foco: descrição, habilidade e atributos
function renderInfo(cfg) {
  const stats = Object.entries(cfg.stats).map(([label, n]) =>
    `<span>${label}</span><div class="pips${label === 'Vida' ? ' hearts' : ''}">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</div>`).join('');
  pick.info.style.setProperty('--c', cfg.color[0]);
  pick.info.style.setProperty('--cd', cfg.color[1]);
  pick.info.innerHTML = `<div class="crest"><img src="${cfg.portrait}" alt=""></div><div class="ribbon">${cfg.name}</div>
    <small>${HEROES[cfg.classId].name}</small><div class="ability"><b>✦ ${cfg.ability}</b>${cfg.desc}</div><div class="stats">${stats}</div>`;
}

// setas na grade: ← → dentro da linha, ↑ ↓ entre linhas (coluna mais próxima), pulando quem já está no grupo
function moveGrid(dx, dy) {
  const free = (i) => !isOwned(pick.options[i]);
  const r0 = Math.floor(pick.sel / 4), c0 = pick.sel % 4;
  for (let n = 1; n < 4; n++) {
    if (dx) {
      const i = r0 * 4 + (c0 + dx * n + 4) % 4;
      if (free(i)) return selectCard(i);
    } else {
      const r = (r0 + dy * n + 4) % 4;
      const c = [0, 1, 2, 3].sort((a, b) => Math.abs(a - c0) - Math.abs(b - c0)).find((k) => free(r * 4 + k));
      if (c !== undefined) return selectCard(r * 4 + c);
    }
  }
}

function selectCard(i) {
  pick.sel = (i + pick.cards.length) % pick.cards.length;
  pick.cards.forEach((c, k) => c.classList.toggle('sel', k === pick.sel));
  if (pick.mode === 'hero') renderInfo(pick.options[pick.sel]);
}

function confirmPick(i) {
  if (!pick.open) return;
  if (pick.mode === 'evolution') return confirmEvolution(i);
  if (pick.mode === 'difficulty') return confirmDifficulty(i);
  const cfg = pick.options[i];
  if (isOwned(cfg) || heroes().length >= 4) return;
  pick.open = false;
  pick.cards.forEach((c, k) => c.classList.add(k === i ? 'chosen' : 'gone'));
  for (let k = 0; k < 10; k++) {   // corações saindo do cartão escolhido
    const h = document.createElement('span');
    h.className = 'burst';
    h.textContent = '♥';
    const a = (k / 10) * Math.PI * 2;
    h.style.setProperty('--x', `${Math.cos(a) * 130}px`);
    h.style.setProperty('--y', `${Math.sin(a) * 130}px`);
    pick.cards[i].appendChild(h);
  }
  pick.timer = setTimeout(() => {
    $('pick').classList.add('hidden');
    const party = heroes();
    const xp = party.length ? party.reduce((sum, h) => sum + h.xp, 0) / party.length / 2 : 0;
    const h = new Hero(cfg);
    arrangeParty();
    h.gainXp(xp);
    h.busy = h.once('Cheer') * 0.6;
    if (heroes().length > 1) showBanner(`${cfg.name} entrou no grupo!`);
    game.paused = false;
    audio.startMusic();   // a partida começa com o primeiro herói (não faz nada se já estiver tocando)
  }, 550);
}

// Uma escolha por vez, inclusive quando vários heróis ganham XP no mesmo golpe.
const evolutions = [];
const UPGRADES = [
  { id: 'hp', name: 'Vida', desc: '+25% de vida máxima e cura completa', icon: '♥' },
  { id: 'dmg', name: 'Força', desc: '+20% de dano', icon: '◆' },
  { id: 'haste', name: 'Rapidez', desc: '+20% de velocidade de ataque', icon: '◆' },
  { id: 'range', name: 'Alcance', desc: '+20% de alcance', icon: '◆' },
  { id: 'skill', name: 'Habilidade', desc: 'Recarga 25% menor e efeito 25% maior', icon: '✦' },
  { id: 'shield', name: 'Escudo', desc: '20% de redução de dano', icon: '⬟' },
];

function showEvolution() {
  if (!evolutions.length || pick.open || game.paused || game.over) return;
  const entry = evolutions[0], h = entry.hero, cfg = h.cfg;
  pick.mode = 'evolution';
  $('banner').style.opacity = 0;
  pick.open = true;
  game.paused = true;
  const pool = UPGRADES.filter((o) => o.id !== 'range' || h.ranged);
  pick.upgrades = [];
  while (pick.upgrades.length < 3) pick.upgrades.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  $('pickTitle').textContent = 'Evolução!';
  $('pickSub').textContent = `${cfg.names[entry.level - 1]} · Nv${entry.level} · Escolha uma melhoria`;
  $('pickHint').textContent = '← → melhoria · Enter confirmar · 1–3 escolher';
  $('pickList').innerHTML = '';
  $('pickList').classList.remove('grid');
  pick.cards = pick.upgrades.map((option, i) => {
    const b = document.createElement('div');
    b.className = 'card evolution';
    b.style.setProperty('--c', cfg.color[0]);
    b.style.setProperty('--cd', cfg.color[1]);
    b.style.setProperty('--d', `${i * 90}ms`);
    b.innerHTML = `<div class="num">${i + 1}</div><div class="portrait"><img src="${cfg.portraits[entry.level - 1]}" alt="${cfg.names[entry.level - 1]}"></div>
      <div class="ribbon">${cfg.names[entry.level - 1]}</div><button class="upgrade"><b>${option.icon} ${option.name}</b><span>${option.desc}</span></button>`;
    b.querySelector('button').onclick = () => confirmPick(i);
    bindCard(b, i);
    $('pickList').appendChild(b);
    return b;
  });
  selectCard(0);
  $('pick').classList.remove('hidden');
}

function confirmEvolution(i) {
  const h = evolutions.shift().hero, option = pick.upgrades[i];
  if (option.id === 'hp') { h.maxHp = Math.round(h.maxHp * 1.25); h.hp = h.maxHp; }
  if (option.id === 'dmg') h.dmg *= 1.2;
  if (option.id === 'haste') h.haste *= 1.2;
  if (option.id === 'range') h.range *= 1.2;
  if (option.id === 'skill') { h.skillRate *= 0.75; h.skillPower *= 1.25; h.skillTimer *= 0.75; }
  if (option.id === 'shield') h.damageTaken *= 0.8;
  popText(h.pos, option.name + '!', 'evolve');
  pick.open = false;
  $('pick').classList.add('hidden');
  game.paused = false;
  showEvolution();
}

function arrangeParty() {
  const party = heroes(), slots = [0, 1, 2, 3];
  // A ordem de entrada resolve os empates; os arqueiros preferem o fundo.
  const order = [...party.filter((h) => h.ranged), ...party.filter((h) => !h.ranged)];
  for (const h of order) {
    const slot = h.ranged ? slots.pop() : slots.shift();
    h.formation = POSTS[slot];
    h.setAnchor(game.guideS);
  }
}

addEventListener('keydown', (e) => {
  if (!pick.open) return;
  const grid = pick.mode === 'hero';
  if (e.key === 'ArrowLeft') grid ? moveGrid(-1, 0) : selectCard(pick.sel - 1);
  else if (e.key === 'ArrowRight') grid ? moveGrid(1, 0) : selectCard(pick.sel + 1);
  else if (e.key === 'ArrowUp' && grid) moveGrid(0, -1);
  else if (e.key === 'ArrowDown' && grid) moveGrid(0, 1);
  else if (e.key === 'Enter' || e.key === ' ') confirmPick(pick.sel);
  else if (!grid && /^[1-4]$/.test(e.key) && +e.key <= pick.cards.length) confirmPick(+e.key - 1);
  else return;
  if (grid && e.key.startsWith('Arrow')) pick.cards[pick.sel].scrollIntoView({ block: 'nearest' });   // janelas baixas rolam a grade
  e.preventDefault();
});

// retrato de cada herói: o próprio modelo 3D renderizado numa imagem
function renderPortraits() {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(336, 336);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff4dc, 0x553322, 2.2));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.6);
  key.position.set(2, 4, 3);
  sc.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(1.4, 1.9, 4.2);
  cam.lookAt(0, 1.15, 0);
  for (const cfg of VARIANTS) {
    const built = cfg.built;
    const model = SkeletonUtils.clone(built.scene);
    model.traverse((o) => { if (cfg.hide.includes(o.name)) o.visible = false; });
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(THREE.AnimationClip.findByName(built.animations, cfg.idle)).play();
    mixer.update(0.4);
    sc.add(model);
    cfg.portraits = [];
    const halo = new THREE.Mesh(haloGeo, goldMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 2.5;
    model.add(halo);
    for (let level = 1; level <= 3; level++) {
      model.scale.setScalar(1 + (level - 1) * 0.08);
      halo.visible = level === 3;
      r.render(sc, cam);
      cfg.portraits.push(r.domElement.toDataURL());
    }
    cfg.portrait = cfg.portraits[0];
    sc.remove(model);
  }
  r.dispose();
}

// ---------- barra de habilidades: um botão por herói (clique ou teclas 1–4) ----------
let skillKey = '', skillItems = [];

function buildSkillBar(party) {
  const bar = $('skills');
  bar.innerHTML = '';
  skillItems = party.map((h, i) => {
    const b = document.createElement('div');
    b.className = 'skill';
    b.setAttribute('role', 'button');
    b.style.setProperty('--c', h.cfg.color[0]);
    b.style.setProperty('--cd', h.cfg.color[1]);
    b.title = `${h.cfg.name}: ${h.cfg.desc} (tecla ${i + 1})`;
    b.innerHTML = `<span class="key">${i + 1}</span><button class="auto" title="Automático: a habilidade sai sozinha. Manual: espera você.">AUTO</button>
      <div class="face"><img alt=""><div class="cd"></div><b class="secs"></b></div><div class="name">${h.cfg.ability}</div>`;
    const it = { h, b, img: b.querySelector('img'), cd: b.querySelector('.cd'), secs: b.querySelector('.secs'), auto: b.querySelector('.auto'), level: 0, p: '', nopeT: 0 };
    b.onclick = () => pressSkill(it);
    it.auto.onclick = (e) => {
      e.stopPropagation();
      h.auto = !h.auto;
      saveAuto(h.cfg.id, h.auto);
      audio.play('click');
    };
    bar.appendChild(b);
    return it;
  });
}

function pressSkill(it) {
  const r = it.h.requestSkill();
  audio.play('click');
  if (r !== 'ok') it.nopeT = performance.now() + 400;   // caído ou recarregando: o botão balança
}

function updateSkillBar() {
  const party = heroes(), key = party.map((h) => h.cfg.id).join();
  if (key !== skillKey) { skillKey = key; buildSkillBar(party); }
  const now = performance.now();
  for (const it of skillItems) {
    const h = it.h;
    if (it.level !== h.level) { it.level = h.level; it.img.src = h.cfg.portraits?.[h.level - 1] || h.cfg.portrait; }
    const ready = !h.dead && h.skillTimer <= 0;
    const p = (h.dead ? 1 : THREE.MathUtils.clamp(h.skillTimer / h.skillMax, 0, 1)).toFixed(3);
    if (p !== it.p) { it.p = p; it.cd.style.setProperty('--p', p); }
    const secs = h.dead ? 'Caído' : ready ? '' : String(Math.ceil(h.skillTimer));
    if (it.secs.textContent !== secs) it.secs.textContent = secs;
    const auto = h.auto ? 'AUTO' : 'MANUAL';
    if (it.auto.textContent !== auto) it.auto.textContent = auto;
    it.b.classList.toggle('ready', ready);
    it.b.classList.toggle('down', h.dead);
    it.b.classList.toggle('manual', !h.auto);
    it.b.classList.toggle('nope', h.noTarget > 0 || now < it.nopeT);
  }
}

addEventListener('keydown', (e) => {
  if (pick.open || game.over || e.repeat || !/^[1-4]$/.test(e.key)) return;
  const it = skillItems[+e.key - 1];
  if (it) pressSkill(it);
});

// o navegador só libera o som depois de um clique ou tecla
addEventListener('pointerdown', () => audio.unlock(), true);
addEventListener('keydown', () => audio.unlock(), true);
function paintMute() {
  $('mute').classList.toggle('off', audio.isMuted());
  $('mute').setAttribute('aria-label', audio.isMuted() ? 'Ligar o som' : 'Desligar o som');
}
$('mute').onclick = () => { audio.setMuted(!audio.isMuted()); paintMute(); audio.play('click'); };
paintMute();

// ---------- carregamento ----------
const loader = new GLTFLoader();
const load = (file) => loader.loadAsync(`assets/${file}`);
const assets = {};

async function loadAssets() {
  const files = [...new Set([...VARIANTS.map((h) => `${h.model}.glb`), ...CHARACTER_ASSETS.map((n) => `${n}.glb`), 'Skeleton_Mage.glb']), 'Skeleton_Minion.glb', 'Skeleton_Warrior.glb', 'Skeleton_Rogue.glb', 'Skeleton_Crossbow.gltf', 'Skeleton_Arrow.gltf', 'Skeleton_Staff.gltf', 'Skeleton_Quiver.gltf', 'Skeleton_Blade.gltf', 'Skeleton_Axe.gltf', 'Skeleton_Shield_Small_A.gltf'];
  let done = 0;
  const results = await Promise.all(files.map((f) => load(f).then((g) => {
    $('overlayText').textContent = `Carregando modelos... ${++done}/${files.length}`;
    return g;
  })));
  files.forEach((f, i) => (assets[f.replace(/\.(glb|gltf)$/, '')] = results[i]));
  // Monta cada receita uma vez; retratos e unidades reaproveitam suas peças.
  // variantes comuns ganham as cores e acessórios de looks.js
  for (const cfg of VARIANTS) {
    if (cfg.recipe) { cfg.built = buildCharacter(assets, cfg.recipe); continue; }
    const scene = SkeletonUtils.clone(assets[cfg.model].scene);
    if (LOOKS[cfg.id]) applyLook(scene, assets, LOOKS[cfg.id]);
    cfg.built = { scene, animations: assets[cfg.model].animations };
  }
}

// ---------- unidades ----------
const units = [];
const tmp = new THREE.Vector3();

class Unit {
  constructor(gltf, stats, team) {
    this.root = SkeletonUtils.clone(gltf.scene);
    this.mats = [];   // materiais próprios para piscar ao levar golpe sem afetar os outros
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      o.material = o.material.clone();
      this.mats.push(o.material);
    });
    this.vel = new THREE.Vector3();   // velocidade atual: acelera e freia aos poucos
    this.moving = false;
    this.flash = 0;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = gltf.animations;
    this.actions = {};
    this.current = null;
    Object.assign(this, { team, maxHp: stats.hp, hp: stats.hp, dmg: stats.dmg, range: stats.range, speed: stats.speed, cooldown: stats.cooldown });
    this.size = 1;
    this.attackTimer = Math.random() * 0.5;
    this.busy = 0;          // tempo travado em ataque/golpe/surgimento
    this.pendingHit = null;
    this.dead = false;
    this.bar = document.createElement('div');
    this.bar.className = `hp ${team === 'hero' ? 'ally' : ''}`;
    this.bar.innerHTML = '<i></i>';
    bars.appendChild(this.bar);
    scene.add(this.root);
    units.push(this);
  }

  get pos() { return this.root.position; }

  action(name) {
    if (!this.actions[name]) this.actions[name] = this.mixer.clipAction(THREE.AnimationClip.findByName(this.clips, name));
    return this.actions[name];
  }

  loop(name) {
    const a = this.action(name);
    if (this.current === a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (this.current) a.crossFadeFrom(this.current, 0.2, false);
    this.current = a;
  }

  once(name, timeScale = 1) {
    const a = this.action(name);
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = timeScale;
    a.play();
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, 0.1, false);
    this.current = a;
    return a.getClip().duration / timeScale;
  }

  // gira aos poucos para o alvo; devolve quanto ainda falta girar (radianos)
  face(target, dt) {
    const want = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    let diff = want - this.root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.root.rotation.y += diff * Math.min(1, dt * 8);
    return Math.abs(diff);
  }

  // anda até o alvo desviando dos obstáculos que estão na frente
  moveTo(target, dt) {
    target = world.nextWaypoint(this.pos, target);
    const dir = new THREE.Vector3().subVectors(target, this.pos).setY(0);
    const d = dir.length();
    if (d < 0.05) return;
    dir.divideScalar(d);
    for (const o of world.obstacles) {
      const ox = o.x - this.pos.x, oz = o.z - this.pos.z;
      const ahead = ox * dir.x + oz * dir.z;                 // quão à frente está
      if (ahead <= 0 || ahead > 2.6 || ahead > d) continue;
      const side = ox * -dir.z + oz * dir.x;                // de que lado está
      const clear = o.r + 0.5 * this.size;
      if (Math.abs(side) > clear) continue;
      const push = (1 - Math.abs(side) / clear) * (1.6 - ahead / 2.6);
      const s = side >= 0 ? -1 : 1;                         // vira para o lado livre
      const px = -dir.z, pz = dir.x;
      dir.x += px * s * push; dir.z += pz * s * push;
    }
    dir.normalize();
    const slow = Math.min(1, d / 0.8);                        // freia chegando no ponto
    this.vel.lerp(dir.multiplyScalar(this.speed * slow * (this.slowT > 0 ? 0.5 : 1) * (world.isShallow(this.pos.x, this.pos.z) ? 0.6 : 1)), Math.min(1, dt * 7));
    this.moving = true;
    this.face(tmp.copy(this.pos).add(this.vel), dt);
  }

  // anima a locomoção no ritmo da velocidade real (sem "patinar")
  locomote(run, walk, idle) {
    const v = this.vel.length();
    if (v < 0.25) return this.loop(idle);
    const a = this.action(v > this.speed * 0.55 ? run : walk);
    this.loop(a.getClip().name);
    a.timeScale = THREE.MathUtils.clamp(0.55 + 0.55 * (v / this.speed), 0.6, 1.3);
  }

  attack(target, name) {
    const dur = this.once(name, 1.3 * (this.team === 'hero' ? this.cfg.cooldown / this.cooldown : 1));
    this.busy = dur * 0.9;
    this.attackTimer = this.cooldown;
    this.pendingHit = { target, t: dur * 0.4 };
    if (this.stats) this.stats.ataques++;
    if (!this.ranged) this.vel.add(tmp.subVectors(target.pos, this.pos).setY(0).normalize().multiplyScalar(2.2));   // passo à frente
  }

  takeDamage(n, from, owner = null, critical = false) {
    if (this.dead || game.over) return;
    // golpe corpo a corpo não alcança quem está em outro nível (os vikings arremessam o machado)
    if (owner && !owner.ranged && owner.cfg.id !== 'viking' && owner.cfg.id !== 'iceviking' && Math.abs(owner.pos.y - this.pos.y) >= 0.85) return;
    if (this.team === 'hero') {
      if (this.cfg.id === 'assassin' && this.dodgeTimer <= 0) {
        this.dodgeTimer = (7 - this.level) * this.skillRate;
        this.busy = this.once(Math.random() < 0.5 ? 'Dodge_Left' : 'Dodge_Right', 1.5);
        this.pendingHit = null;
        popText(this.pos, 'Esquiva!', 'heal');
        this.stats.esquivas++;
        return;
      }
      n *= this.damageTaken;
      if (this.guardT > 0) n *= 0.6;
      if ((this.cfg.classId === 0 || this.cfg.id === 'viking' || this.cfg.id === 'iceviking') && Math.random() < 0.3) {
        n *= 0.5;
        popText(this.pos, 'Bloqueio!', 'block');
        if (this.busy <= 0 && THREE.AnimationClip.findByName(this.clips, 'Block_Hit')) this.busy = this.once('Block_Hit', 1.5);
      }
    }
    const real = Math.min(n, this.hp);   // conta só a vida que de fato saiu
    if (this.stats) this.stats.recebido += real;
    if (owner?.stats) { owner.stats.dano += real; if (critical) owner.stats.criticos++; }
    this.hp -= n;
    if (owner) this.lastHit = owner;
    this.flash = 0.14;
    this.squashT = 0.25;
    popText(this.pos, Math.round(n), this.team === 'hero' ? 'hurt' : critical ? 'crit' : 'dmg');
    audio.play(this.team === 'hero' ? 'hurt' : 'hit');
    if (from) {   // recua com o impacto
      const k = (this.boss ? 0.6 : this.team === 'hero' ? 1.6 : 3.2);
      this.vel.add(tmp.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(k));
    }
    if (this.hp <= 0) return this.die();
    if (!this.pendingHit && !this.boss && this.busy <= 0) { this.busy = this.once(this.team === 'hero' ? 'Hit_A' : 'Hit_B', 1.6) * 0.8; }
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.pendingHit = null;
    this.once(this.team === 'hero' ? 'Death_A' : 'Death_C_Skeletons');
    this.deadTime = 0;
    this.bar.style.display = 'none';
    if (this.team === 'hero') this.diedIn = game.phase;   // no Pesadelo, decide quando volta
    if (this.team === 'skeleton') {
      audio.play('bones');
      game.kills++;
      if (this.lastHit?.stats) this.lastHit.stats.abates++;
      for (const h of heroes()) if (!h.dead) h.gainXp((this.boss ? 12 : 3) + (h === this.lastHit ? 2 : 0));
    }
    if (this.aura) this.aura.visible = false;
    if (this.halo) this.halo.visible = false;
  }

  remove() {
    scene.remove(this.root);
    this.bar.remove();
    for (const m of this.mats) m.dispose();
    if (this.aura) this.aura.material.dispose();
    units.splice(units.indexOf(this), 1);
  }

  updateCommon(dt) {
    this.mixer.update(dt);
    this.attackTimer -= dt;
    this.busy -= dt;
    // inércia: quem não está andando vai freando; a velocidade (e o recuo) move a unidade
    if (!this.moving) this.vel.multiplyScalar(Math.max(0, 1 - dt * 9));
    this.moving = false;
    if (!this.dead && !game.over) {
      const next = this.pos.clone().addScaledVector(this.vel, dt);
      if (world.canStep(this.pos, next)) this.pos.copy(next);
      else this.vel.set(0, 0, 0);
      this.pos.y = world.groundHeight(this.pos.x, this.pos.z);
      if (world.isShallow(this.pos.x, this.pos.z) && this.vel.lengthSq() > 0.1) {
        this.rippleT = (this.rippleT || 0) - dt;
        if (this.rippleT <= 0) { waterSplash(this.pos); this.rippleT = 0.45; }
      }
      if (this.stats) this.stats.distancia += this.vel.length() * dt;
    }
    // "amassa" ao levar golpe e aparece com um pop (escala elástica)
    let sx = 1, sy = 1;
    if (this.squashT > 0) {
      this.squashT -= dt;
      const w = Math.sin(Math.PI * (1 - Math.max(0, this.squashT) / 0.25));
      sy = 1 - 0.2 * w; sx = 1 + 0.14 * w;
    }
    if (this.popT !== undefined && this.popT < 0.45) {
      this.popT += dt;
      const t = Math.min(1, this.popT / 0.45) - 1;
      const e = 1 + 2.70158 * t ** 3 + 1.70158 * t ** 2;
      sx *= e; sy *= e;
    }
    this.root.scale.set(this.size * sx, this.size * sy, this.size * sx);
    if (this.flash > 0 || this.flashOn) {
      this.flash -= dt;
      this.flashOn = this.flash > 0;
      for (const m of this.mats) if (m.emissive) m.emissive.setHex(this.flashOn ? 0xff3b2f : 0x000000);
    }
    if (this.pendingHit && !game.over) {
      this.pendingHit.t -= dt;
      if (this.pendingHit.t <= 0) {
        const { target, effect } = this.pendingHit;
        this.pendingHit = null;
        if (!effect && this.team !== 'skeleton') audio.play(swingSound(this));
        if (effect) effect();
        else if (this.ranged && !target.dead) this.team === 'skeleton' ? fireEnemyBolt(this, target) : fireBolt(this, target, this.cfg.id === 'crossbow' ? 'crossbow' : 'magic');
        else if (this.cleave) damageCleave(this, target);
        else if (!target.dead && Math.abs(target.pos.y - this.pos.y) < 0.85 && target.pos.distanceTo(this.pos) <= this.range + 0.6 * target.size) this.team !== 'skeleton' ? heroHit(this, target, this.dmg) : target.takeDamage(this.dmg, this.pos);
      }
    }
  }
}

// som do golpe comum de cada herói (e dos esqueletinhos do necromante)
const swingSound = (u) => u.ranged ? ({ crossbow: 'arrow', pyro: 'fire', cryo: 'ice' }[u.cfg.id] || 'zap') : u.cfg.classId === 1 ? 'axe' : 'sword';

const skeletonsAlive = () => units.filter((u) => u.team === 'skeleton' && !u.dead);
const heroes = () => units.filter((u) => u.team === 'hero');
const allies = () => units.filter((u) => u.team !== 'skeleton');

function inMeleeArc(owner, target, radius = 2.2) {
  const forward = new THREE.Vector3(Math.sin(owner.root.rotation.y), 0, Math.cos(owner.root.rotation.y));
  const offset = new THREE.Vector3().subVectors(target.pos, owner.pos).setY(0);
  return offset.length() <= radius && offset.normalize().dot(forward) >= 0.5;
}

function damageCleave(owner, primary) {
  for (const s of skeletonsAlive()) {
    if (s.spawning || !inMeleeArc(owner, s)) continue;
    const secondary = s !== primary;
    const before = s.vel.clone();
    heroHit(owner, s, owner.dmg * (secondary ? 0.6 : 1));
    if (secondary) s.vel.sub(before).multiplyScalar(0.5).add(before);
  }
}

function damageArea(center, radius, dmg, owner = null) {
  for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(center) <= radius + 0.4 * (s.size - 1)) {
    if (owner) heroHit(owner, s, dmg, center);
    else s.takeDamage(dmg, center);
  }
}

function heroHit(owner, target, dmg, center = owner.pos) {
  const critical = owner.cfg.id === 'assassin' && Math.random() < Math.min(0.65, (0.25 + (owner.level - 1) * 0.05) * owner.skillPower);
  target.takeDamage(dmg * (critical ? 2 : 1) * (owner.royalT > 0 ? 1 + owner.royalBonus : 1), center, owner.summoner || owner, critical);
}


function nearest(from, list) {
  let best = null, bd = Infinity;
  for (const u of list) {
    if (u.dead) continue;
    const d = u.pos.distanceToSquared(from);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

// projéteis e áreas usam geometrias compartilhadas, sem luzes extras.
const bolts = [], blasts = [], flames = [];
const boltGeo = new THREE.SphereGeometry(0.2, 10, 10);
const bladeGeo = new THREE.ConeGeometry(0.09, 0.65, 4);
const axeGeo = new THREE.BoxGeometry(0.45, 0.12, 0.3);
const handleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 5);
const flameGeo = new THREE.ConeGeometry(0.2, 0.65, 5);
const groundGeo = new THREE.CircleGeometry(1, 24);
const ringGeo = new THREE.RingGeometry(0.75, 1, 32);
const haloGeo = new THREE.TorusGeometry(0.35, 0.06, 6, 24);
const beamGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6);
const colors = { pyro: 0xff883d, cryo: 0x8be8ff, arcane: 0xc999ff, viking: 0xd6e9ef, iceviking: 0x8be8ff, necro: 0x9fffb0, druid: 0xa8e07a, crossbow: 0xffed9e, ninja: 0xc7d0ff };
const boltMats = Object.fromEntries(Object.entries(colors).map(([k, color]) => [k, new THREE.MeshBasicMaterial({ color })]));
const goldMat = new THREE.MeshBasicMaterial({ color: 0xffdf70 });

function ring(at, radius, color, life = 0.6) {
  const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(at).setY(at.y + 0.07);
  mesh.scale.setScalar(radius);
  scene.add(mesh);
  blasts.push({ mesh, t: life, life });
}

function beam(start, end, color) {
  const mesh = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
  const dir = new THREE.Vector3().subVectors(end, start);
  mesh.position.copy(start).add(end).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.3, 0));
  mesh.scale.y = dir.length();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  scene.add(mesh);
  blasts.push({ mesh, t: 0.25, life: 0.25 });
}

function fireBolt(from, target, kind = 'magic', angle = 0, skill = false) {
  const axe = kind === 'viking' || kind === 'iceviking';
  const mesh = new THREE.Mesh(axe ? axeGeo : kind === 'crossbow' || kind === 'ninja' ? bladeGeo : boltGeo, boltMats[kind] || boltMats[from.cfg.id] || boltMats.arcane);
  if (axe) {
    const handle = new THREE.Mesh(handleGeo, boltMats.viking);
    handle.position.y = -0.25;
    mesh.add(handle);
  }
  mesh.position.copy(from.pos).setY(from.pos.y + 1.3);
  const dir = new THREE.Vector3().subVectors(target.pos, from.pos).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(mesh);
  const bolt = { mesh, target, owner: from, kind, dir, hit: new Set(), life: Math.max(1, from.range / 14 + 0.2), dmg: from.dmg, level: from.level, power: kind === 'magic' ? 1 : from.skillPower, skill };
  FX.look(bolt, skill);   // cada atirador com seu projétil (fogo, raio, gelo, orbe, espinho, virote)
  if (skill && kind === 'pyro') {   // a bola grande faz um arco no ar até o alvo
    bolt.base = mesh.position.clone();
    bolt.dist0 = Math.max(0.1, bolt.base.distanceTo(target.pos));
    bolt.arc = 1.2 + bolt.dist0 * 0.18;
  }
  bolts.push(bolt);
}

function updateBolts(dt) {
  if (dt <= 0) return;
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.life -= dt;
    if (b.skill || b.look) FX.trail(b, dt);
    const piercing = b.kind === 'crossbow' || b.kind === 'ninja';
    if (piercing) {
      const step = 18 * dt, start = b.mesh.position.clone();
      b.mesh.position.addScaledVector(b.dir, step);
      for (const s of skeletonsAlive()) {
        if (s.spawning || b.hit.has(s)) continue;
        const offset = new THREE.Vector3().copy(s.pos).add(new THREE.Vector3(0, 1.3, 0)).sub(start);
        const along = THREE.MathUtils.clamp(offset.dot(b.dir), 0, step);
        if (offset.addScaledVector(b.dir, -along).length() > 0.45 * s.size) continue;
        heroHit(b.owner, s, b.dmg * (b.kind === 'ninja' ? 0.8 : 1) * b.power);
        if (b.skill || b.look) FX.impact(b.skill ? b.kind : 'basic', s.pos, 0.5, b.look);
        b.hit.add(s);
        if (b.kind === 'ninja') { b.life = 0; break; }
      }
    } else {
      const goal = b.target.pos.clone().setY(b.target.pos.y + 1.1);
      const at = b.base || b.mesh.position;   // com arco, anda pela linha reta e sobe por cima dela
      const d = goal.distanceTo(at);
      at.lerp(goal, Math.min(1, 14 * dt / Math.max(d, 0.001)));
      if (b.base) b.mesh.position.copy(at).setY(at.y + Math.sin(Math.PI * THREE.MathUtils.clamp(1 - d / b.dist0, 0, 1)) * b.arc);
      if (d <= 14 * dt + 0.25) {
        const radius = b.kind === 'magic' ? b.owner.cfg.splash || 0 : b.kind === 'viking' ? 0 : (b.kind === 'pyro' ? 1.1 + (b.level - 1) * 0.2 : 1.3 + (b.level - 1) * 0.25) * b.power;
        if (radius) damageArea(b.target.pos, radius, b.dmg, b.owner);
        else if (!b.target.dead) heroHit(b.owner, b.target, b.dmg * (b.kind === 'viking' ? 1.8 * b.power : 1));
        if (b.kind === 'pyro') {
          const mesh = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({ color: 0xff702e, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false }));
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.copy(b.target.pos).setY(b.target.pos.y + 0.06);
          mesh.scale.setScalar(radius);
          for (let k = 0; k < 5; k++) {
            const flame = new THREE.Mesh(flameGeo, boltMats.pyro);
            const a = k * Math.PI * 2 / 5;
            flame.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.18);
            flame.rotation.x = Math.PI / 2;
            mesh.add(flame);
          }
          scene.add(mesh);
          flames.push({ mesh, radius, owner: b.owner, dmg: b.dmg * 0.15, t: (1.5 + b.level * 0.5) * b.power, tick: 0 });
        }
        if (b.kind === 'cryo' || b.kind === 'iceviking') for (const s of skeletonsAlive()) if (s.pos.distanceTo(b.target.pos) <= radius) s.slowT = (3 + (b.level - 1) * 0.5) * b.power;
        ring(b.target.pos, Math.max(0.5, radius), colors[b.kind] || 0xc999ff);
        if (b.skill || b.look) FX.impact(b.skill ? b.kind : 'basic', b.target.pos, Math.max(0.6, radius), b.look);
        b.life = 0;
      }
    }
    if (b.kind === 'viking' || b.kind === 'iceviking') b.mesh.rotateZ(dt * 18);
    if (b.life <= 0) { scene.remove(b.mesh); bolts.splice(i, 1); }
  }
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i];
    f.t -= dt; f.tick -= dt;
    f.mesh.rotation.z += dt;
    f.mesh.children.forEach((m, k) => m.scale.setScalar(0.8 + Math.sin(f.t * 9 + k) * 0.2));
    f.mesh.material.opacity = Math.min(0.7, f.t * 0.7);
    if (f.tick <= 0 && dt > 0) {
      damageArea(f.mesh.position, f.radius, f.dmg * 0.5, f.owner);
      f.tick += 0.5;
    }
    if (f.t <= 0) { scene.remove(f.mesh); f.mesh.material.dispose(); flames.splice(i, 1); }
  }
  for (let i = blasts.length - 1; i >= 0; i--) {
    const bl = blasts[i];
    bl.t -= dt;
    if (bl.ripple) bl.mesh.scale.addScalar(dt * 1.2);
    bl.mesh.material.opacity = Math.max(0, bl.t / bl.life) * 0.65;
    if (bl.t <= 0) { scene.remove(bl.mesh); bl.mesh.material.dispose(); blasts.splice(i, 1); }
  }
}

// Tiros inimigos independentes dos poderes dos heróis.
const enemyBolts = [];
const enemyOrbMat = new THREE.MeshBasicMaterial({ color: 0xc591ee });
function fireEnemyBolt(from, target) {
  const mesh = from.enemyKind === 'Crossbow' ? assets.Skeleton_Arrow.scene.clone() : new THREE.Mesh(boltGeo, enemyOrbMat);
  mesh.position.copy(from.pos).add(new THREE.Vector3(0, 1.3, 0));
  scene.add(mesh);
  enemyBolts.push({ mesh, target, from, dmg: from.dmg, life: 3 });
}
function updateEnemyBolts(dt) {
  if (dt <= 0) return;
  for (let i = enemyBolts.length - 1; i >= 0; i--) {
    const b = enemyBolts[i], goal = b.target.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
    b.life -= dt;
    const d = b.mesh.position.distanceTo(goal);
    if (!b.target.dead) {
      b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), goal.clone().sub(b.mesh.position).normalize());
      b.mesh.position.lerp(goal, Math.min(1, 12 * dt / Math.max(d, 0.001)));
      if (d < 12 * dt + 0.2) { b.target.takeDamage(b.dmg, b.from.pos); b.life = 0; }
    }
    if (b.life <= 0 || b.target.dead) { scene.remove(b.mesh); enemyBolts.splice(i, 1); }
  }
}
function waterSplash(at, spawn = false) {
  ring(at.clone().setY(at.y + 0.1), spawn ? 1 : 0.45, 0xc5f2f4, spawn ? 0.7 : 0.4);
  blasts[blasts.length - 1].ripple = true;
  if (!spawn) return;
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xa3e4f3, transparent: true }));
    m.position.copy(at).add(new THREE.Vector3(0, 0.15, 0)); m.scale.setScalar(0.3);
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random(), (Math.random() - 0.5) * 3), t: 0, life: 0.6, grow: 0.3 };
    scene.add(m); fx.push(m);
  }
}

// ---------- efeitos fofos: nuvenzinha com estrelas, números e corações ----------
const fx = [];
const puffGeo = new THREE.IcosahedronGeometry(0.35, 1);
const starGeo = new THREE.OctahedronGeometry(0.17, 0);

function poof(at, size = 1) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = new THREE.Mesh(puffGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true }));
    m.position.set(at.x + Math.cos(a) * 0.3, at.y + 0.4 + Math.random() * 0.5, at.z + Math.sin(a) * 0.3);
    m.userData = { v: new THREE.Vector3(Math.cos(a) * 1.8, 0.8 + Math.random(), Math.sin(a) * 1.8), t: 0, life: 0.6, grow: size };
    scene.add(m);
    fx.push(m);
  }
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true }));
    m.position.set(at.x, at.y + 1, at.z);
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3, 3.5 + Math.random() * 1.5, (Math.random() - 0.5) * 3), t: 0, life: 0.85, star: true };
    scene.add(m);
    fx.push(m);
  }
}

function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const m = fx[i], u = m.userData;
    u.t += dt;
    const k = u.t / u.life;
    if (k >= 1) { scene.remove(m); m.material.dispose(); fx.splice(i, 1); continue; }
    if (u.star) { u.v.y -= 9 * dt; m.rotation.y += dt * 12; }
    else { u.v.multiplyScalar(Math.max(0, 1 - dt * 4)); m.scale.setScalar((0.6 + k * 1.3) * u.grow); }
    m.position.addScaledVector(u.v, dt);
    m.material.opacity = 1 - k * k;
  }
}

// texto que salta acima de uma unidade (dano, cura)
function popText(at, text, cls) {
  tmp.copy(at).setY(at.y + 2.5).project(camera);
  if (tmp.z > 1) return;
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.textContent = text;
  el.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth + (Math.random() * 24 - 12)}px`;
  el.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight}px`;
  bars.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ---------- visuais das habilidades: malhas brilhantes (aditivas), sem luzes extras ----------
const skillFx = [];
const TAU = Math.PI * 2;
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const columnGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0);
const domeGeo = new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2);
const thinRingGeo = new THREE.RingGeometry(0.9, 1, 40);
const hexGeo = new THREE.RingGeometry(0.86, 1, 6);
const sparkGeo = new THREE.OctahedronGeometry(0.09, 0);
const shardGeo = new THREE.ConeGeometry(0.08, 0.6, 4).rotateX(Math.PI / 2);   // ponta para +z
const crystalGeo = new THREE.ConeGeometry(0.2, 1, 5).translate(0, 0.5, 0);
const rockGeo = new THREE.DodecahedronGeometry(0.14, 0);
const crackGeo = new THREE.BoxGeometry(1, 0.03, 0.1).translate(0.5, 0, 0);
const slashGeo = new THREE.PlaneGeometry(2.4, 0.2);
const arcGeo = new THREE.TorusGeometry(1, 0.07, 4, 20, Math.PI * 0.7);
const rootGeo = new THREE.ConeGeometry(0.1, 1.4, 5).translate(0, 0.7, 0);
const leafGeo = new THREE.CircleGeometry(0.13, 3);
const skullGeo = new THREE.IcosahedronGeometry(0.22, 0);
const shurikenGeo = new THREE.OctahedronGeometry(0.32, 0).scale(1, 0.14, 1);
const spikeGeo = new THREE.ConeGeometry(0.08, 0.26, 4).translate(0, 0.13, 0);
const crownGeo = new THREE.CylinderGeometry(0.36, 0.32, 0.2, 10, 1, true);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b2010 });
const barkMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
const leafMat = new THREE.MeshLambertMaterial({ color: 0x6cc24a, side: THREE.DoubleSide });
const branchGeos = [0.09, 0.07, 0.05].map((r) => new THREE.CylinderGeometry(r * 0.75, r, 1, 5).translate(0, 0.5, 0));   // galhos afinando
const shellGeo = new THREE.IcosahedronGeometry(0.2, 0);
const iceGeo = new THREE.OctahedronGeometry(0.15, 0).scale(0.7, 0.7, 2.4);   // cristal comprido apontando em +z
const thornGeo = new THREE.OctahedronGeometry(0.16, 0).scale(0.55, 0.18, 1.6);   // folha/espinho do druida
const basic = (color) => new THREE.MeshBasicMaterial({ color });
// projétil de cada atirador: núcleo, cascas brilhantes, tamanho (comum, habilidade) e jeito de voar
const BOLT_LOOKS = {
  pyro: { geo: boltGeo, core: basic(0xfff3b0), shells: [[glow(0xff7a1a, 0.85), 1.35], [glow(0xff2a0a, 0.45), 1.85]], size: [2, 3.2], spin: true },
  arcane: { geo: boltGeo, core: basic(0xf3e6ff), shells: [[glow(0x8a3cff, 0.8), 1.5], [glow(0xc999ff, 0.35), 2.1]], size: [1.6, 1.6], spin: true },
  cryo: { geo: iceGeo, core: basic(0xe6fbff), shells: [[glow(0x5fd0ff, 0.6), 1.35]], size: [1.7, 2.6], aim: true },
  necro: { geo: boltGeo, core: basic(0xd8ffe0), shells: [[glow(0x22e050, 0.8), 1.5], [glow(0x0f8a30, 0.4), 2.1]], size: [1.7, 1.7], spin: true },
  druid: { geo: thornGeo, core: basic(0x9be05a), shells: [[glow(0x5fbf2a, 0.5), 1.3]], size: [1.9, 1.9], aim: true, roll: true },
  crossbow: { size: [1.4, 2] },
};
for (const L of Object.values(BOLT_LOOKS)) for (const m of [L.core, ...(L.shells || []).map((x) => x[0])]) if (m) m.userData.keep = true;
const steelMat = new THREE.MeshLambertMaterial({ color: 0x59627a, emissive: 0x1a2240 });
const starGlowMat = glow(0x6f8cff, 0.55);
for (const m of [eyeMat, barkMat, leafMat, steelMat, starGlowMat]) m.userData.keep = true;   // compartilhados: não são descartados com o efeito
const TRAIL = { arcane: [0xb07cff, 0xffffff], necro: [0x40ff70, 0x0f8a30], druid: [0x8fe05a, 0xc8f07a], pyro: [0xffa040, 0xffe070], cryo: [0xbff6ff, 0x7fdcff], crossbow: [0xfff0a0, 0xffd84a], ninja: [0xc7d0ff, 0xffffff], viking: [0xe8f4ff, 0xb8dfe5], iceviking: [0x9fefff, 0xffffff] };
let shakeK = 0;
const jolt = new THREE.Vector3();

function glow(color, opacity = 0.85, additive = true) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
}

// registra um efeito com vida própria; tick(e, dt, k) anima (k vai de 0 a 1)
function addFx(mesh, life, tick, delay = 0) {
  mesh.visible = !delay;
  scene.add(mesh);
  skillFx.push({ mesh, t: -delay, life, tick, base: mesh.material?.opacity ?? 1 });
  return mesh;
}

function dropFx(e) {
  scene.remove(e.mesh);
  e.mesh.traverse((o) => { if (o.material && !o.material.userData.keep) o.material.dispose(); });
}

function updateSkillFx(dt) {
  for (let i = skillFx.length - 1; i >= 0; i--) {
    const e = skillFx[i];
    e.t += dt;
    if (e.t < 0) continue;
    e.mesh.visible = true;
    const k = Math.min(1, e.t / e.life);
    e.tick?.(e, dt, k);
    if (k >= 1 || e.done) { dropFx(e); skillFx.splice(i, 1); }
  }
}

function clearSkillFx() {
  while (skillFx.length) dropFx(skillFx.pop());
  shakeK = 0;
}

// partícula que voa, cai (gravity) e some; smoke = fumaça opaca em vez de brilho
function particle(geo, color, at, vel, life, o = {}) {
  const m = new THREE.Mesh(geo, o.solid ? new THREE.MeshLambertMaterial({ color, transparent: true }) : glow(color, o.opacity ?? 0.95, !o.smoke));
  const s0 = o.size ?? 1;
  m.position.copy(at);
  m.scale.setScalar(s0);
  m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
  return addFx(m, life, (e, dt, k) => {
    vel.y -= (o.gravity ?? 0) * dt;
    if (o.drag) vel.multiplyScalar(Math.max(0, 1 - o.drag * dt));
    m.position.addScaledVector(vel, dt);
    if (o.spin !== 0) { m.rotation.x += dt * 6; m.rotation.y += dt * 4; }
    m.scale.setScalar(s0 * (1 + (o.grow ?? 0) * k));
    m.material.opacity = e.base * (1 - k * k);
  }, o.delay);
}

// estouro de faíscas em todas as direções
function burst(at, color, n = 12, speed = 4, o = {}) {
  for (let i = 0; i < n; i++) {
    const v = V(rnd(), Math.random() * (o.up ?? 1), rnd()).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
    particle(o.geo || sparkGeo, Array.isArray(color) ? color[i % color.length] : color, at, v, (o.life ?? 0.6) * (0.7 + Math.random() * 0.6),
      { gravity: o.gravity ?? 6, size: o.size ?? 1.2, drag: 1.5, delay: o.delay });
  }
}

// anel no chão que cresce de "from" até "to" e some
function wave(at, color, from, to, life = 0.6, o = {}) {
  const m = new THREE.Mesh(o.geo || thinRingGeo, glow(color, o.opacity ?? 0.9, !o.dust));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(at).setY(at.y + (o.y ?? 0.1));
  m.scale.setScalar(from);
  return addFx(m, life, (e, dt, k) => {
    m.scale.setScalar(from + (to - from) * (1 - (1 - k) ** 3));
    m.material.opacity = e.base * (1 - k);
    if (o.spin) m.rotation.z += o.spin * dt;
  }, o.delay);
}

// coluna de luz que sobe do chão (follow = acompanha a unidade)
function column(at, color, radius, height, life, o = {}) {
  const m = new THREE.Mesh(columnGeo, glow(color, o.opacity ?? 0.55));
  m.position.copy(at);
  return addFx(m, life, (e, dt, k) => {
    const pop = Math.min(1, e.t / 0.15);
    const r = radius * (0.4 + 0.6 * pop) * (1 + k * 0.3);
    m.scale.set(r, height * pop, r);
    m.rotation.y += dt * 3;
    m.material.opacity = e.base * (1 - k) ** 1.5;
    if (o.follow) m.position.copy(o.follow.pos);
  }, o.delay);
}

// faíscas da cor do herói girando para a mão no começo da habilidade
function charge(h) {
  const c = h.cfg.color[1], center = h.pos.clone().setY(h.pos.y + 1.2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, from = V(h.pos.x + Math.cos(a) * 1.6, h.pos.y + 0.4 + Math.random() * 1.4, h.pos.z + Math.sin(a) * 1.6);
    particle(sparkGeo, i % 2 ? c : 0xffffff, from, center.clone().sub(from).divideScalar(0.35), 0.35, { size: 1.4 });
  }
  wave(h.pos, c, 1.6, 0.4, 0.4);
}

// Paladino: coluna de luz dourada, faíscas subindo e cura verde em quem foi curado
function holyLight(h, friends, reach) {
  column(h.pos, 0xffe27a, 1.1, 9, 1.4);
  column(h.pos, 0xffffff, 0.45, 9, 1.0, { opacity: 0.8 });
  wave(h.pos, 0xfff0a0, 0.5, reach, 0.9);
  wave(h.pos, 0x8af5a8, 0.3, reach * 0.8, 1.1, { geo: ringGeo, opacity: 0.6, delay: 0.15 });
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * TAU, r = Math.random() * 1.2;
    particle(sparkGeo, i % 3 ? 0xffe27a : 0xffffff, V(h.pos.x + Math.cos(a) * r, h.pos.y + 0.2, h.pos.z + Math.sin(a) * r), V(0, 2.5 + Math.random() * 3, 0), 1.3, { size: 1.4, delay: Math.random() * 0.5 });
  }
  for (const f of friends) if (f !== h) {
    column(f.pos, 0x8af5a8, 0.55, 3.5, 0.9, { follow: f });
    burst(f.pos.clone().setY(f.pos.y + 1), [0x8af5a8, 0xffffff], 8, 3, { gravity: -2 });
  }
}

// Guardião: cúpula azul translúcida (com malha de escudo) enquanto a proteção durar
function dome(h, radius) {
  const d = new THREE.Mesh(domeGeo, glow(0x3f9bff, 0.3, false));   // azul de verdade: o brilho aditivo some no chão claro
  const net = new THREE.Mesh(domeGeo, glow(0x1f6fe0, 0.6, false));
  net.material.wireframe = true;
  net.scale.setScalar(1.01);
  d.add(net);
  addFx(d, h.guardT + 1, (e, dt) => {
    d.position.copy(h.pos);
    const pop = Math.min(1, e.t / 0.3);
    d.scale.setScalar(1.7 * (1 - (1 - pop) ** 3) + Math.sin(pop * Math.PI) * 0.35);
    net.rotation.y += dt * 0.6;
    const fade = Math.min(1, Math.max(0, h.guardT) / 0.4);
    d.material.opacity = (0.24 + 0.06 * Math.sin(e.t * 6)) * fade;
    net.material.opacity = (0.5 + 0.15 * Math.sin(e.t * 6)) * fade;
    if (h.dead || h.guardT <= 0 || !units.includes(h)) e.done = true;
  });
  wave(h.pos, 0x6fc3ff, 0.5, radius, 0.7);
  burst(h.pos.clone().setY(h.pos.y + 1), [0x6fc3ff, 0xffffff], 14, 5);
}

// Campeão: lâminas de luz girando em volta e rastro circular no chão
function whirl(h, radius) {
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(arcGeo, glow(i ? 0xffe59b : 0xffffff, 0.95));
    m.rotation.set(-Math.PI / 2, 0, (i * TAU) / 3);
    addFx(m, 0.75, (e, dt, k) => {
      m.position.copy(h.pos).setY(h.pos.y + 0.7 + i * 0.3);
      m.rotation.z += dt * (16 + i * 3);
      m.scale.setScalar(radius * (0.45 + 0.22 * i) * (0.5 + 0.5 * Math.min(1, e.t / 0.15)));
      m.material.opacity = e.base * (1 - k);
    });
  }
  wave(h.pos, 0xffe59b, 0.5, radius, 0.55, { geo: ringGeo, opacity: 0.7, spin: 9 });
  burst(h.pos.clone().setY(h.pos.y + 1), [0xffe59b, 0xffffff], 22, 8, { up: 0.3 });
  shake(0.25);
}

// Berserker: aura vermelha pulsando e fumaça enquanto a fúria durar
function fury(h) {
  wave(h.pos, 0xff3b3b, 0.4, 3.2, 0.6);
  burst(h.pos.clone().setY(h.pos.y + 1), [0xff5a3a, 0xffd0a0], 18, 5);
  const aura = new THREE.Mesh(columnGeo, glow(0xff2a2a, 0.35));
  addFx(aura, 30, (e, dt) => {
    aura.position.copy(h.pos);
    const pulse = 1 + Math.sin(e.t * 10) * 0.12;
    aura.scale.set(0.75 * pulse, 2.4 + Math.sin(e.t * 10) * 0.2, 0.75 * pulse);
    aura.material.opacity = (0.3 + 0.12 * Math.sin(e.t * 10)) * Math.min(1, Math.max(0, h.furyT) / 0.4);
    e.smoke = (e.smoke ?? 0) - dt;
    if (e.smoke <= 0) {
      e.smoke = 0.1;
      particle(puffGeo, 0x5a1a1a, V(h.pos.x + rnd(0.4), h.pos.y + 0.3, h.pos.z + rnd(0.4)), V(rnd(0.4), 1.4, rnd(0.4)), 0.9, { smoke: true, opacity: 0.45, size: 0.5, grow: 1.2, spin: 0 });
      particle(sparkGeo, 0xff6a3a, V(h.pos.x + rnd(0.5), h.pos.y + 0.5, h.pos.z + rnd(0.5)), V(0, 2.5, 0), 0.6);
    }
    if (h.dead || h.furyT <= 0 || !units.includes(h)) e.done = true;
  });
}

// Esmagador: onda de choque, rachaduras com brilho de lava e pedrinhas voando
function quake(h, reach) {
  const c = h.pos.clone().addScaledVector(V(Math.sin(h.root.rotation.y), 0, Math.cos(h.root.rotation.y)), 1.2);
  wave(c, 0xffb060, 0.3, reach * 1.7, 0.55, { y: 0.12 });
  wave(c, 0x9a7a55, 0.3, reach * 1.3, 0.8, { geo: ringGeo, opacity: 0.55, dust: true });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(crackGeo, glow(0x2a1c10, 0.9, false));
    const lava = new THREE.Mesh(crackGeo, glow(0xff8a30, 0.9));
    lava.scale.set(1, 1.3, 0.45);
    lava.position.y = 0.01;
    m.add(lava);
    m.position.copy(c).setY(c.y + 0.05);
    m.rotation.y = (i / 9) * TAU + rnd(0.3);
    const len = reach * (0.7 + Math.random() * 0.6);
    addFx(m, 1.8, (e, dt, k) => {
      m.scale.x = len * Math.min(1, e.t / 0.15);
      m.material.opacity = e.base * (k > 0.7 ? (1 - k) / 0.3 : 1);
      lava.material.opacity = 0.9 * (1 - k) ** 2;
    });
  }
  for (let i = 0; i < 14; i++)
    particle(rockGeo, i % 2 ? 0x8a6f55 : 0x6d5a48, V(c.x + rnd(1.5), c.y + 0.2, c.z + rnd(1.5)), V(rnd(3), 5 + Math.random() * 4, rnd(3)), 1, { solid: true, gravity: 18, size: 0.8 + Math.random() });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    particle(puffGeo, 0xc8b08a, V(c.x, c.y + 0.3, c.z), V(Math.cos(a) * 4, 0.6, Math.sin(a) * 4), 0.9, { smoke: true, opacity: 0.55, size: 0.6, grow: 1.5, drag: 3, spin: 0 });
  }
  shake(0.55);
}

// impacto dos tiros de habilidade (e de cada inimigo atravessado pelos perfurantes)
function impact(kind, at, radius, lookId) {
  at = at.clone();
  const p = at.clone().setY(at.y + 1);
  if (kind === 'basic') {   // tiro comum: estalo pequeno na cor do atirador
    const [a, c] = TRAIL[lookId] || [0xffffff, 0xffffff];
    const m = new THREE.Mesh(shellGeo, glow(a, 0.95));
    m.position.copy(p);
    addFx(m, 0.3, (e, dt, k) => { m.scale.setScalar(1 + k * (lookId === 'pyro' ? 6 : 4)); m.material.opacity = e.base * (1 - k); });
    burst(p, lookId === 'pyro' ? [0xff7a2a, 0xffe070, 0xff3a1a] : [a, c], 10, 4, { gravity: 6, geo: lookId === 'druid' ? leafGeo : sparkGeo });
  } else if (kind === 'pyro') {
    for (let i = 0; i < 12; i++) {   // anel de fogo correndo pelo chão
      const a = (i / 12) * TAU, f = new THREE.Mesh(flameGeo, glow(i % 2 ? 0xff6a1a : 0xffc040, 0.95));
      addFx(f, 0.75, (e, dt, k) => {
        const r = radius * 1.6 * (1 - (1 - k) ** 2);
        f.position.set(at.x + Math.cos(a) * r, at.y + 0.3, at.z + Math.sin(a) * r);
        f.scale.set(1.4, 0.3 + 1.8 * (1 - k), 1.4);
        f.material.opacity = e.base * (1 - k);
      });
    }
    for (const [color, size, life] of [[0xff5a1a, 7, 0.5], [0xffa040, 5, 0.4], [0xfff0b0, 3, 0.3]]) {
      const m = new THREE.Mesh(boltGeo, glow(color, 0.95));
      m.position.copy(p);
      addFx(m, life, (e, dt, k) => { m.scale.setScalar(1 + size * radius * (1 - (1 - k) ** 2)); m.material.opacity = e.base * (1 - k); });
    }
    burst(p, [0xff7a2a, 0xffe070, 0xff3a1a], 34, 8, { gravity: 8, size: 1.6, life: 0.9 });
    for (let i = 0; i < 6; i++) particle(puffGeo, 0x3a2a24, p, V(rnd(1.2), 1.5, rnd(1.2)), 1.1, { smoke: true, opacity: 0.5, size: 0.6, grow: 1.6, spin: 0 });
    wave(at, 0xff9a40, 0.4, radius * 1.4, 0.5);
    audio.play('fire');
    shake(0.45);
  } else if (kind === 'cryo' || kind === 'iceviking') {
    crystals(at, radius);
    burst(p, [0xbff6ff, 0xffffff], 18, 5);
    wave(at, 0x8be8ff, 0.4, radius * 1.3, 0.6);
    audio.play('ice');
    if (kind === 'iceviking') shake(0.2);
  } else if (kind === 'viking') {
    burst(p, [0xffffff, 0xd6e9ef, 0xffd84a], 16, 6);
    wave(at, 0xd6e9ef, 0.3, 1.6, 0.4);
    audio.play('hit');
    shake(0.2);
  } else burst(p, TRAIL[kind] || 0xffffff, 8, 4);
}

// Criomante e Viking do Gelo: cristais de gelo brotando do chão
function crystals(at, radius) {
  const disc = new THREE.Mesh(groundGeo, glow(0x8be8ff, 0.35));
  disc.rotation.x = -Math.PI / 2;
  disc.position.copy(at).setY(at.y + 0.08);
  disc.scale.setScalar(radius);
  addFx(disc, 1.8, (e, dt, k) => (disc.material.opacity = e.base * (1 - k)));
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius * 0.85, tall = 0.5 + Math.random() * 0.8;
    const m = new THREE.Mesh(crystalGeo, glow(i % 3 ? 0xaef4ff : 0xffffff, 0.8));
    m.position.set(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r);
    m.rotation.set(rnd(0.4), Math.random() * TAU, rnd(0.4));
    addFx(m, 1.8, (e, dt, k) => {
      const s = Math.min(1, e.t / 0.12) * (k > 0.75 ? (1 - k) / 0.25 : 1);
      m.scale.set(1, tall * s, 1);
      m.material.opacity = e.base * (k > 0.75 ? (1 - k) / 0.25 : 1);
    }, Math.random() * 0.15);
  }
}

// Criomante: leque de estilhaços de gelo saindo da mão rumo ao alvo
function iceFan(h, target) {
  const base = Math.atan2(target.pos.x - h.pos.x, target.pos.z - h.pos.z);
  for (let i = -4; i <= 4; i++) {
    const a = base + i * 0.13, dir = V(Math.sin(a), 0, Math.cos(a));
    const m = new THREE.Mesh(shardGeo, glow(i % 2 ? 0xbff6ff : 0xffffff, 0.95));
    m.position.copy(h.pos).setY(h.pos.y + 1.2).addScaledVector(dir, 0.5);
    m.rotation.y = a;
    m.scale.setScalar(1.4);
    addFx(m, 0.45, (e, dt, k) => { m.position.addScaledVector(dir, dt * 13); m.material.opacity = e.base * (1 - k * k); });
  }
}

// Arcano: raio em zigue-zague com brilho roxo e núcleo branco
function zigzag(a, b) {
  const A = a.clone().setY(a.y + 1.3), B = b.clone().setY(b.y + 1.1), pts = [A];
  for (let i = 1; i < 6; i++) pts.push(A.clone().lerp(B, i / 6).add(V(rnd(0.45), rnd(0.45), rnd(0.45))));
  pts.push(B);
  for (let i = 0; i < pts.length - 1; i++) {
    const dir = pts[i + 1].clone().sub(pts[i]), len = dir.length();
    for (const [color, width] of [[0x8a3cff, 4.5], [0xe0c8ff, 1]]) {
      const m = new THREE.Mesh(beamGeo, glow(color, 0.95));
      m.position.copy(pts[i]).addScaledVector(dir, 0.5);
      m.scale.set(width, len, width);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      addFx(m, 0.35, (e, dt, k) => (m.material.opacity = e.base * (1 - k) * (0.55 + Math.random() * 0.45)));
    }
  }
  const orb = new THREE.Mesh(boltGeo, glow(0xe6d0ff, 0.95));
  orb.position.copy(B);
  addFx(orb, 0.3, (e, dt, k) => { orb.scale.setScalar(1 + k * 3); orb.material.opacity = e.base * (1 - k); });
  burst(B, [0xc999ff, 0xffffff], 10, 4);
}

// Necromante: círculo de invocação verde girando e caveiras subindo
function summon(h, minions) {
  const p = h.pos;
  for (const [geo, color, size, spin] of [[thinRingGeo, 0x22e050, 2.4, 1.5], [hexGeo, 0x30c060, 1.9, -2], [hexGeo, 0x30c060, 1.9, 2], [groundGeo, 0x0f5a24, 2.4, 0]]) {
    const m = new THREE.Mesh(geo, glow(color, geo === groundGeo ? 0.45 : 0.9, false));
    m.rotation.set(-Math.PI / 2, 0, spin > 0 && geo === hexGeo ? Math.PI / 6 : 0);
    m.position.copy(p).setY(p.y + 0.08);
    addFx(m, 1.9, (e, dt, k) => {
      m.scale.setScalar(size * Math.min(1, e.t / 0.2));
      m.rotation.z += spin * dt;
      m.material.opacity = e.base * (k > 0.7 ? (1 - k) / 0.3 : 1);
    });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const skull = new THREE.Mesh(skullGeo, glow(0xc8ffd0, 0.95, false));
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(sparkGeo, eyeMat);
      eye.position.set(side * 0.08, 0.03, 0.18);
      skull.add(eye);
    }
    addFx(skull, 1.4, (e, dt, k) => {
      skull.position.set(p.x + Math.cos(a) * 1.5, p.y + 0.3 + k * 2.6, p.z + Math.sin(a) * 1.5);
      skull.rotation.y = -a + Math.PI / 2 + Math.sin(e.t * 8) * 0.3;
      skull.material.opacity = e.base * (1 - k);
      skull.children.forEach((c) => (c.visible = k < 0.8));
    }, i * 0.12);
  }
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * TAU, r = Math.random() * 2.2;
    particle(sparkGeo, i % 2 ? 0x6dff8a : 0xd8ffe0, V(p.x + Math.cos(a) * r, p.y + 0.1, p.z + Math.sin(a) * r), V(0, 2 + Math.random() * 2, 0), 1.1, { delay: Math.random() * 0.6 });
  }
  for (const u of minions) column(u.pos, 0x6dff8a, 0.5, 3, 0.8);
}

// Assassino: rastro de sombra entre a saída e a chegada
function shadowStep(from, to) {
  for (let i = 0; i <= 8; i++) {
    const p = from.clone().lerp(to, i / 8).setY(from.y + 0.6 + (to.y - from.y) * (i / 8));
    particle(puffGeo, 0x2a1640, p, V(0, 0.4, 0), 0.7, { smoke: true, opacity: 0.6, size: 0.55, grow: 0.6, spin: 0, delay: i * 0.02 });
    particle(sparkGeo, 0xb48cff, p.clone().setY(p.y + 0.5), V(rnd(0.5), 1, rnd(0.5)), 0.5, { delay: i * 0.02 });
  }
  wave(from, 0x9974b5, 0.3, 1.4, 0.4);
}

// Assassino: corte em X brilhando sobre o alvo
function slashX(target, h) {
  const p = target.pos.clone().setY(target.pos.y + 1.1);
  [-1, 1].forEach((s, i) => {
    for (const [color, thick] of [[0xb48cff, 1], [0xffffff, 0.4]]) {
      const m = new THREE.Mesh(slashGeo, glow(color, 1));
      m.material.depthTest = false;   // o corte aparece por cima do próprio assassino
      m.renderOrder = 5;
      m.position.copy(p);
      m.rotation.set(0, h.root.rotation.y, s * 0.8);
      addFx(m, 0.45, (e, dt, k) => {
        m.scale.set(1.4 * Math.min(1, e.t / 0.08), thick * 1.6 * (1 - k), 1);
        m.material.opacity = e.base * (1 - k);
      }, i * 0.08);
    }
  });
  burst(p, [0xb48cff, 0xffffff], 14, 5);
  shake(0.15);
}

// Rei: coroa dourada girando acima dele e ondas douradas pelo grupo
function royal(h, party) {
  const crown = new THREE.Group();
  const mat = glow(0xffc61a, 0.95, false);
  crown.add(new THREE.Mesh(crownGeo, mat));
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(spikeGeo, mat);
    spike.position.set(Math.cos((i / 6) * TAU) * 0.34, 0.1, Math.sin((i / 6) * TAU) * 0.34);
    crown.add(spike);
  }
  addFx(crown, 1.8, (e, dt, k) => {
    crown.position.copy(h.pos).setY(h.pos.y + 3.4 + k * 0.8);   // acima da barra de vida
    crown.rotation.y += dt * 3;
    const pop = Math.min(1, e.t / 0.3);
    crown.scale.setScalar(1.9 * (1 - (1 - pop) ** 3) + Math.sin(pop * Math.PI) * 0.5);
    mat.opacity = 0.95 * (k > 0.7 ? (1 - k) / 0.3 : 1);
  });
  for (let i = 0; i < 3; i++) wave(h.pos, 0xffd84a, 0.5, 7, 1, { delay: i * 0.18 });
  for (const f of party) {
    column(f.pos, 0xffe27a, 0.5, 3, 0.8, { follow: f });
    burst(f.pos.clone().setY(f.pos.y + 1.2), [0xffd84a, 0xffffff], 8, 3, { gravity: -2 });
  }
}

// Druida: raízes saindo do chão em volta do inimigo preso
function roots(enemy) {
  const n = 3 + Math.floor(Math.random() * 3), g = new THREE.Group();
  for (let b = 0; b < n; b++) {
    // cada galho sobe em espiral em volta do esqueleto até a cintura
    const a = (b / n) * TAU + rnd(0.3), turn = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.3);
    const pts = [0, 1, 2, 3].map((j) => V(Math.cos(a + j * turn) * (0.5 - j * 0.07), j * 0.32, Math.sin(a + j * turn) * (0.5 - j * 0.07)));
    for (let j = 0; j < 3; j++) {
      const dir = pts[j + 1].clone().sub(pts[j]), seg = new THREE.Mesh(branchGeos[j], barkMat);
      seg.position.copy(pts[j]);
      seg.scale.y = dir.length() + 0.04;
      seg.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      seg.castShadow = true;
      g.add(seg);
    }
    for (const side of [-1, 1]) {   // folhinhas na ponta
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.copy(pts[3]).add(V(side * 0.06, 0.04, 0));
      leaf.rotation.set(rnd(1), a, side * 0.8);
      g.add(leaf);
    }
  }
  addFx(g, 99, (e, dt) => {
    // cresce do chão, segue o esqueleto e afunda quando ele se solta ou morre
    if (enemy.dead || enemy.rootT <= 0 || !units.includes(enemy)) e.sink = (e.sink ?? 0) + dt / 0.3;
    const grow = (1 - (1 - Math.min(1, e.t / 0.3)) ** 3) * (1 - Math.min(1, e.sink ?? 0));
    g.position.copy(enemy.pos).setY(enemy.pos.y - (1 - grow) * 0.35);
    g.scale.set(enemy.size, Math.max(0.001, grow) * enemy.size, enemy.size);
    if ((e.sink ?? 0) >= 1) e.done = true;
  });
  burst(enemy.pos.clone().setY(enemy.pos.y + 0.4), [0x8fe05a, 0xc8f07a], 6, 2.5, { geo: leafGeo, gravity: 1 });
  for (let i = 0; i < 5; i++) particle(rockGeo, 0x6d5a48, V(enemy.pos.x + rnd(0.5), enemy.pos.y + 0.1, enemy.pos.z + rnd(0.5)), V(rnd(1.5), 2.5 + Math.random() * 2, rnd(1.5)), 0.6, { solid: true, gravity: 14, size: 0.6 });
}

// Druida: folhas subindo em espiral e onda verde
function leaves(h, radius) {
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * TAU, r = 0.6 + Math.random() * 1.2;
    const at = V(h.pos.x + Math.cos(a) * r, h.pos.y + 0.2, h.pos.z + Math.sin(a) * r);
    particle(leafGeo, i % 2 ? 0x8fe05a : 0xc8f07a, at, V(-Math.sin(a) * 2.5, 1.5 + Math.random() * 1.5, Math.cos(a) * 2.5), 1.4, { size: 1.5, gravity: 0.5, delay: Math.random() * 0.4 });
  }
  wave(h.pos, 0x8fe05a, 0.4, radius, 0.8);
  wave(h.pos, 0x3f8a2a, 0.3, radius * 0.9, 1, { geo: ringGeo, opacity: 0.5, delay: 0.1 });
}

// projétil próprio de cada atirador; vikings e ninja só mudam na habilidade
function look(b, skill) {
  const id = b.owner.cfg.id, L = BOLT_LOOKS[id];
  if (!L || (b.kind !== 'magic' && b.kind !== id)) { if (skill) dress(b); return; }
  const m = b.mesh;
  if (L.geo) {
    m.geometry = L.geo;
    m.material = L.core;
    for (const [mat, size] of L.shells) {
      const shell = new THREE.Mesh(id === 'cryo' || id === 'druid' ? L.geo : shellGeo, mat);
      shell.scale.setScalar(size);
      m.add(shell);
    }
  }
  m.scale.setScalar(L.size[skill ? 1 : 0]);
  b.look = id;
  b.style = L;
  b.age = 0;
}

// tiros de habilidade ficam maiores; o do ninja vira estrela girando
function dress(b) {
  b.mesh.scale.setScalar({ pyro: 2.2, cryo: 1.6, viking: 1.5, iceviking: 1.5, crossbow: 1.8, ninja: 1.8 }[b.kind] || 1.4);
  if (b.kind === 'ninja') {   // estrela de 8 pontas: duas lâminas cruzadas e um brilho azul
    b.mesh.geometry = shurikenGeo;
    b.mesh.material = steelMat;
    b.mesh.quaternion.identity();
    const cross = new THREE.Mesh(shurikenGeo, steelMat), halo = new THREE.Mesh(shurikenGeo, starGlowMat);
    cross.rotation.y = Math.PI / 4;
    halo.scale.set(1.5, 2, 1.5);
    b.mesh.add(cross, halo);
  }
}

function trail(b, dt) {
  const m = b.mesh, L = b.style || {};
  if (b.kind === 'ninja') m.rotation.y += dt * 25;
  b.age = (b.age ?? 0) + dt;
  if (L.spin) { m.rotation.x += dt * 8; m.rotation.y += dt * 11; }
  if (L.aim) {   // cristal e espinho apontam para o alvo; o espinho gira no próprio eixo
    m.lookAt(b.target.pos.x, b.target.pos.y + 1.1, b.target.pos.z);
    if (L.roll) m.rotateZ(b.age * 18);
  }
  b.trailT = (b.trailT ?? 0) - dt;
  if (b.trailT > 0) return;
  b.trailT = b.skill ? 0.025 : 0.035;
  const [a, c] = TRAIL[b.look || b.kind] || [0xffffff, 0xffffff];
  const fire = b.look === 'pyro', size = fire ? (b.skill ? 2.6 : 1.5) : b.skill ? 1.5 : 1.1;
  particle(b.look === 'druid' ? leafGeo : sparkGeo, Math.random() < 0.5 ? a : c, m.position.clone().add(V(rnd(0.1), rnd(0.1), rnd(0.1)).multiplyScalar(size)),
    V(rnd(0.6), rnd(0.6) + (fire ? 0.8 : 0), rnd(0.6)), fire ? 0.5 : 0.35, { size, grow: -0.6 });
  if (fire) particle(sparkGeo, 0xff3a1a, m.position.clone(), V(rnd(1), 0.5, rnd(1)), 0.6, { size: size * 0.5, gravity: 5 });   // brasas que caem
  if (b.look === 'necro' && Math.random() < 0.4) particle(puffGeo, 0x14301c, m.position.clone(), V(0, 0.4, 0), 0.5, { smoke: true, opacity: 0.4, size: 0.3, grow: 1, spin: 0 });
}

// tremida de câmera curta nos golpes fortes
function shake(n) { shakeK = Math.max(shakeK, n); }
function cameraJolt(real) {
  shakeK = Math.max(0, shakeK - real * 1.6);
  return jolt.set(rnd(), rnd() * 0.6, rnd()).multiplyScalar(shakeK);
}

const FX = { look, update: updateSkillFx, clear: clearSkillFx, jolt: cameraJolt, shake, charge, holyLight, dome, whirl, fury, quake, impact, iceFan, zigzag, summon, shadowStep, slashX, royal, roots, leaves, dress, trail, column };

class Hero extends Unit {
  constructor(cfg) {
    super(cfg.built, cfg, 'hero');
    this.cfg = cfg;
    this.level = 1;
    this.xp = 0;
    this.haste = 1;
    this.skillRate = 1;
    this.skillPower = 1;
    this.damageTaken = 1;
    this.royalT = 0;
    this.royalBonus = 0;
    this.formation = POSTS[Math.min(3, heroes().length - 1)];
    this.skillTimer = 2;
    this.skillMax = 2;      // recarga cheia, para o arco da barra de habilidades
    this.auto = loadAuto(cfg.id);
    this.wantSkill = 0;     // tempo em que o pedido do jogador ainda vale
    this.noTarget = 0;
    this.furyT = 0;
    this.guardT = 0;
    this.dodgeTimer = 2;
    this.age = 0;
    this.aura = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: cfg.color[1], side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthWrite: false }));
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.05;
    this.aura.visible = false;
    this.halo = new THREE.Mesh(haloGeo, goldMat);
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = 2.5;
    this.halo.visible = false;
    this.root.add(this.aura, this.halo);
    this.stats = newStats();
    this.trinkets = [];   // acessórios animados (orbe, estrelinhas, chamas)
    this.root.traverse((o) => { if (o.userData.spin || o.userData.orbit || o.userData.flicker) this.trinkets.push(o); });
    this.levelLabel = document.createElement('span');
    this.levelLabel.textContent = 'Nv1';
    this.bar.appendChild(this.levelLabel);
    this.ranged = !!cfg.ranged;
    this.cleave = cfg.cleave || 0;
    this.root.traverse((o) => { if (cfg.hide.includes(o.name)) o.visible = false; });
    this.post = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.setAnchor(game.guideS);
    this.pos.copy(this.post);
    this.root.rotation.y = Math.atan2(this.fwd.x, this.fwd.z);
    this.popT = 0;
    this.loop(cfg.idle);
  }

  gainXp(n) {
    this.xp += n;
    while (this.level < 3 && this.xp >= XP_LEVELS[this.level]) {
      const oldName = this.cfg.names[this.level - 1], oldHp = this.maxHp;
      this.level++;
      evolutions.push({ hero: this, level: this.level });
      this.maxHp = Math.round(this.maxHp * 1.1);
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp - oldHp);
      this.dmg *= 1.1;
      this.size = 1 + (this.level - 1) * 0.08;
      this.levelLabel.textContent = 'Nv' + this.level;
      this.levelLabel.title = this.cfg.names[this.level - 1];
      this.aura.visible = !this.dead;
      this.halo.visible = !this.dead && this.level === 3;
      this.skillTimer = Math.min(this.skillTimer, 1);
      this.popT = 0;
      audio.play('levelup');
      poof(this.pos, 1.5);
      ring(this.pos, 2, this.cfg.color[0], 1);
      popText(this.pos, this.cfg.names[this.level - 1] + '!', 'evolve');
      showBanner(oldName + ' evoluiu para ' + this.cfg.names[this.level - 1] + '!', 3);
    }
  }

  useSkill(target) {
    const id = this.cfg.id, level = this.level;
    const power = this.skillPower;
    const radius = (3 + (level - 1) * 0.5) * power;
    const nearby = skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) <= radius);
    let effect;
    if (id === 'paladin') {
      const reach = (5 + level) * power;
      const friends = heroes().filter((h) => !h.dead && h.hp < h.maxHp && h.pos.distanceTo(this.pos) <= reach);
      if (!friends.length) return false;
      effect = () => {
        const healed = [];
        for (const h of friends) if (!h.dead && h.pos.distanceTo(this.pos) <= reach) {
          const heal = Math.min(h.maxHp - h.hp, (32 + level * 10) * power);
          h.hp += heal;
          this.stats.cura += heal;
          healed.push(h);
          popText(h.pos, '+' + Math.round(heal), 'heal');
        }
        FX.holyLight(this, healed, reach);
      };
    } else if (id === 'guardian') {
      if (!nearby.length) return false;
      effect = () => {
        this.guardT = (4 + (level - 1)) * power;
        for (const s of nearby) if (!s.dead) { s.taunt = this; s.tauntT = this.guardT; s.pendingHit = null; popText(s.pos, '!', 'crit'); }
        FX.dome(this, radius);
      };
    } else if (id === 'champion' || id === 'crusher') {
      if (!nearby.some((s) => id === 'champion' || inMeleeArc(this, s, 2.2 * power))) return false;
      if (id === 'crusher') this.vel.add(tmp.subVectors(target ? target.pos : this.pos, this.pos).setY(0).normalize().multiplyScalar(2.5));   // salta para a frente
      effect = () => {
        for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(this.pos) <= radius) {
          if (id === 'crusher' && !inMeleeArc(this, s, 2.2 * power)) continue;
          heroHit(this, s, this.dmg * 1.1);
          if (id === 'champion') s.vel.add(new THREE.Vector3().subVectors(s.pos, this.pos).setY(0).normalize().multiplyScalar(6 + level));
          else { s.stunT = (1.5 + (level - 1) * 0.25) * power; s.pendingHit = null; s.vel.set(0, 0, 0); }
        }
        if (id === 'champion') FX.whirl(this, radius);
        else FX.quake(this, 2.2 * power);
      };
    } else if (id === 'berserker') {
      if (!nearby.length) return false;
      effect = () => {
        this.furyT = (5 + (level - 1)) * power;
        popText(this.pos, 'Fúria!', 'crit');
        FX.fury(this);
      };
    } else if (id === 'assassin') {
      // salta pelas sombras até as costas do alvo e crava as adagas
      target = nearest(this.pos, skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) < 7 && Math.abs(s.pos.y - this.pos.y) < 0.85));
      if (!target) return false;
      effect = () => {
        if (target.dead) return;
        const from = this.pos.clone(), dir = tmp.subVectors(target.pos, this.pos).setY(0).normalize();
        const behind = target.pos.clone().addScaledVector(dir, 0.6 + 0.4 * target.size);
        const dest = world.canStep(target.pos, behind) ? behind : target.pos.clone().addScaledVector(dir, -(0.6 + 0.4 * target.size));
        this.pos.copy(dest).setY(world.groundHeight(dest.x, dest.z));
        this.vel.set(0, 0, 0);
        FX.shadowStep(from, this.pos);
        this.face(target.pos, 1);
        this.busy = this.once('Dualwield_Melee_Attack_Stab', 1.6);
        this.pendingHit = { target, t: this.busy * 0.35, effect: () => {
          if (!target.dead) heroHit(this, target, this.dmg * 2.2 * power);
          FX.slashX(target, this);
          audio.play('sword');
        } };
      };
    } else if (id === 'viking' || id === 'iceviking') {
      target = nearest(this.pos, skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) > 2 && s.pos.distanceTo(this.pos) < 9));
      if (!target) return false;
      effect = () => fireBolt(this, target, id, 0, true);
    } else if (id === 'arcane') {
      if (!target || target.pos.distanceTo(this.pos) > this.range) return false;
      effect = () => {
        let at = this.pos;
        const hit = new Set();
        let next = target;
        for (let i = 0; i < Math.round((3 + (level - 1)) * power); i++) {
          if (!next || next.dead) break;
          FX.zigzag(at, next.pos);
          hit.add(next);
          heroHit(this, next, this.dmg * 0.9);
          at = next.pos;
          next = nearest(at, skeletonsAlive().filter((s) => !s.spawning && !hit.has(s) && s.pos.distanceTo(at) < 4 + level));
        }
      };
    } else if (id === 'pyro' || id === 'cryo' || id === 'crossbow' || id === 'ninja') {
      if (!target || target.pos.distanceTo(this.pos) > (id === 'ninja' ? 7 : this.range)) return false;
      effect = () => {
        if (id === 'ninja') for (const angle of [-0.22, 0, 0.22]) fireBolt(this, target, id, angle, true);
        else fireBolt(this, target, id, 0, true);
        if (id === 'cryo') FX.iceFan(this, target);
      };
    } else if (id === 'king') {
      if (!target) return false;
      effect = () => {
        const party = heroes().filter((h) => !h.dead);
        for (const h of party) {
          h.royalT = 5 * power;
          h.royalBonus = 0.2;
        }
        popText(this.pos, 'Brado!', 'evolve');
        FX.royal(this, party);
      };
    } else if (id === 'necro') {
      if (!target) return false;
      effect = () => {
        for (const u of units.filter((u) => u.summoner === this)) { poof(u.pos); u.remove(); }
        FX.summon(this, [-1, 1].map((side) => new Minion(this, side)));
      };
    } else if (id === 'druid') {
      if (!nearby.length) return false;
      effect = () => {
        for (const enemy of skeletonsAlive()) if (!enemy.spawning && enemy.pos.distanceTo(this.pos) <= radius) {
          enemy.rootT = 1.5 * power;
          enemy.vel.set(0, 0, 0);
          FX.roots(enemy);
        }
        for (const h of heroes()) if (!h.dead && h.pos.distanceTo(this.pos) <= radius) {
          const heal = Math.min(h.maxHp - h.hp, 20 * power);
          h.hp += heal;
          this.stats.cura += heal;
          if (heal > 0) popText(h.pos, '+' + Math.round(heal), 'heal');
        }
        FX.leaves(this, radius);
      };
    } else return false;
    const [anim, pace, at, sound] = SKILL_MOVES[id];
    const run = effect;
    effect = () => { audio.play(sound); run(); };
    this.face(target ? target.pos : this.pos.clone().add(this.fwd), 1);
    this.busy = this.once(anim, pace);
    this.pendingHit = { target, effect, t: this.busy * at };
    FX.charge(this);
    this.skillTimer = this.skillMax = (({ necro: 12, king: 10, berserker: 10, guardian: 9, paladin: 8, assassin: 7 }[id] ?? 6) - (level - 1) * 0.7) * this.skillRate;
    this.stats.habilidades++;
    return true;
  }

  // pedido do jogador (botão ou tecla): vale por um instante, até o golpe atual terminar
  requestSkill() {
    if (this.dead || game.over || game.paused) return 'off';
    if (this.skillTimer > 0) return 'wait';
    if (game.state !== 'fight') { this.missSkill(); return 'none'; }
    this.wantSkill = 2;
    return 'ok';
  }

  missSkill() {
    this.noTarget = 0.6;
    popText(this.pos, 'Sem alvo', 'block');
  }

  // posição na formação em volta do ponto "s" da estrada
  setAnchor(s) {
    this.fwd.copy(world.tangentAt(s));
    const side = world.sideOf(this.fwd);
    const [px, pz] = this.formation;
    this.post.copy(world.pointAt(s)).addScaledVector(side, px).addScaledVector(this.fwd, -pz);
  }

  revive() {
    this.dead = false;
    this.aura.visible = this.level > 1;
    this.halo.visible = this.level === 3;
    this.guardT = 0;
    this.royalT = 0;
    this.furyT = 0;
    this.hp = this.maxHp * difficulty.revive;
    this.bar.style.display = '';
    this.current = null;
    this.mixer.stopAllAction();
    this.loop(this.cfg.idle);
  }

  update(dt) {
    if (dt <= 0) return;
    this.skillTimer -= dt;
    this.dodgeTimer -= dt;
    this.guardT -= dt;
    this.royalT -= dt;
    this.furyT -= dt;
    this.wantSkill -= dt;
    this.noTarget -= dt;
    this.age += dt;
    if (!this.dead && game.state === 'fight') this.stats.tempo += dt;   // para o dano por segundo
    for (const o of this.trinkets) {
      if (o.userData.spin) { o.rotation.y += dt * 2; o.position.y = 0.1 + Math.sin(this.age * 3) * 0.05; }
      if (o.userData.orbit) o.rotation.y += dt * 1.5;
      if (o.userData.flicker) o.scale.y = 1 + Math.sin(this.age * 14) * 0.15;
    }
    const rage = !this.dead && this.cfg.id === 'berserker' && (this.hp < this.maxHp * 0.5 || this.furyT > 0);
    this.cooldown = this.cfg.cooldown / this.haste / (rage ? 1.5 * this.skillPower : 1);
    this.aura.visible = !this.dead && (this.level > 1 || rage || this.guardT > 0);
    this.aura.material.color.set(rage ? 0xff4242 : this.cfg.color[1]);
    this.aura.scale.setScalar(0.8 + Math.sin(this.age * 4) * 0.06);
    this.halo.position.y = 2.5 + Math.sin(this.age * 3) * 0.08;
    this.updateCommon(dt);
    if (this.dead || this.busy > 0 || game.over) return;
    const target = game.state === 'fight' ? nearest(this.pos, skeletonsAlive().filter((u) => !u.spawning)) : null;
    // no manual a habilidade fica carregada esperando o jogador pedir
    if (game.state === 'fight' && this.skillTimer <= 0 && (this.auto || this.wantSkill > 0)) {
      const asked = this.wantSkill > 0;
      this.wantSkill = 0;
      if (this.useSkill(target)) return;
      if (asked) this.missSkill();
    }
    // atiradores não saem do lugar: o grupo vai até eles
    const engage = target && (target.ranged || target.pos.distanceTo(this.post) < LEASH + this.range + (world.zoneOf(game.phase)?.type === 'plateau' ? 7 : 0));
    if (engage) {
      const d = target.pos.distanceTo(this.pos) - 0.4 * (target.size - 1);
      if (d > this.range || (!this.ranged && Math.abs(target.pos.y - this.pos.y) >= 0.85)) this.moveTo(target.pos, dt);
      else {
        const turn = this.face(target.pos, dt);   // só ataca depois de virar para o alvo
        const attacks = this.cfg.attacks;
        if (this.attackTimer <= 0 && turn < 0.5) this.attack(target, attacks[Math.floor(Math.random() * attacks.length)]);
      }
    } else if (this.pos.distanceTo(this.post) > 0.25) {
      this.moveTo(this.post, dt);
    } else {
      this.face(target ? target.pos : tmp.copy(this.post).addScaledVector(this.fwd, 10), dt);
    }
    if (this.busy <= 0) this.locomote('Running_A', 'Walking_A', this.cfg.idle);
  }
}

// animação, ritmo, momento do efeito (fração da animação) e som de cada habilidade
const SKILL_MOVES = {
  paladin: ['Spellcast_Long', 1.8, 0.45, 'heal'],
  guardian: ['Block_Attack', 1.1, 0.4, 'shout'],
  champion: ['2H_Melee_Attack_Spinning', 0.8, 0.45, 'sword'],
  berserker: ['Cheer', 1.6, 0.3, 'shout'],
  crusher: ['Jump_Full_Short', 1, 0.72, 'slam'],
  viking: ['Throw', 1.4, 0.45, 'axe'],
  pyro: ['Spellcast_Shoot', 1.2, 0.4, 'fire'],
  arcane: ['Spellcasting', 0.9, 0.5, 'zap'],
  cryo: ['Spellcast_Raise', 1.8, 0.45, 'ice'],
  assassin: ['Dodge_Forward', 0.8, 0.6, 'arrow'],
  crossbow: ['2H_Ranged_Shoot', 1.2, 0.4, 'arrow'],
  ninja: ['Throw', 1.5, 0.45, 'arrow'],
  king: ['Cheer', 1.4, 0.35, 'shout'],
  iceviking: ['Throw', 1.4, 0.45, 'axe'],
  necro: ['Spellcast_Long', 1.8, 0.5, 'summon'],
  druid: ['Spellcast_Raise', 1.6, 0.45, 'heal'],
};

class Minion extends Unit {
  constructor(summoner, side) {
    super(assets.Skeleton_Minion, { hp: 55 * summoner.skillPower, dmg: 9, range: 1.3, speed: 3.4, cooldown: 1.3 }, 'ally');
    this.summoner = summoner;
    this.cfg = { id: 'minion' };
    this.level = summoner.level;
    this.life = 8 * summoner.skillPower;
    this.pos.copy(summoner.pos).add(new THREE.Vector3(side * 0.9, 0, 0));
    this.size = 0.7;
    this.popT = 0;
    this.bar.classList.add('ally');
    for (const m of this.mats) m.color?.set(0xb5ffbc);
    Skeleton.prototype.attach.call(this, 'Skeleton_Blade', 'handslotr');
    this.loop('Idle_Combat');
    poof(this.pos, 0.7);
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    if (game.over) return;
    this.life -= dt;
    if (this.dead || this.life <= 0) { poof(this.pos, 0.7); this.remove(); return; }
    if (this.busy > 0) return;
    const target = nearest(this.pos, skeletonsAlive().filter((s) => !s.spawning));
    if (target && game.state === 'fight') {
      if (target.pos.distanceTo(this.pos) > this.range) this.moveTo(target.pos, dt);
      else if (this.attackTimer <= 0 && this.face(target.pos, dt) < 0.5) this.attack(target, '1H_Melee_Attack_Chop');
    } else if (this.pos.distanceTo(this.summoner.pos) > 1.5) this.moveTo(this.summoner.pos, dt);
    if (this.busy <= 0) this.locomote('Walking_D_Skeletons', 'Walking_D_Skeletons', 'Idle_Combat');
  }
}

class Skeleton extends Unit {
  constructor(type, phase, boss = false) {
    const base = SKELETONS[type];
    const D = difficulty;
    const hpScale = (1 + (phase - 1) * 0.12) * D.hp * (boss ? 9 * D.boss : 1);
    const dmgScale = (1 + (phase - 1) * 0.06) * D.dmg * (boss ? 2.5 * D.boss : 1);
    super(assets[`Skeleton_${base.model || type}`], { ...base, hp: Math.round(base.hp * hpScale), dmg: Math.round(base.dmg * dmgScale), speed: base.speed * (boss ? 0.8 : 1) }, 'skeleton');
    this.boss = boss;
    this.ranged = !!base.ranged;
    this.enemyKind = type;
    this.attackAnim = base.attack || '1H_Melee_Attack_Chop';
    this.stunT = 0;
    this.rootT = 0;
    this.slowT = 0;
    this.tauntT = 0;
    this.stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(starGeo, goldMat);
      star.position.set(Math.cos(i * Math.PI * 2 / 3) * 0.45, 2.1, Math.sin(i * Math.PI * 2 / 3) * 0.45);
      this.stars.add(star);
    }
    this.stars.visible = false;
    this.root.add(this.stars);
    this.move = base.move || 'Walking_D_Skeletons';
    this.speed *= 0.85 + Math.random() * 0.3;   // cada esqueleto num ritmo um pouco diferente
    if (boss) { this.size = 1.7; this.root.scale.setScalar(this.size); this.range += 0.6; this.bar.classList.add('boss'); }
    this.attach(base.weapon, 'handslotr');   // o GLTFLoader tira o ponto de "handslot.r"
    if (base.shield) this.attach(base.shield, 'handslotl');
    this.spawning = true;
    this.busy = this.once('Spawn_Ground_Skeletons');
  }

  attach(asset, bone) {
    const slot = this.root.getObjectByName(bone);
    const item = assets[asset].scene.clone();
    item.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    slot.add(item);
  }

  update(dt) {
    if (dt <= 0) return;
    this.rootT = Math.max(0, this.rootT - dt);
    if (this.rootT > 0) this.vel.set(0, 0, 0);
    this.stunT = Math.max(0, this.stunT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.root.rotation.z = this.rootT > 0 && !this.dead ? Math.sin(this.rootT * 45) * 0.05 : 0;   // preso pelos galhos: treme tentando se soltar
    this.tauntT -= dt;
    if (this.stunT > 0) { this.pendingHit = null; this.vel.set(0, 0, 0); }
    if (this.ranged) this.vel.set(0, 0, 0);
    this.updateCommon(dt);
    this.stars.visible = !this.dead && this.stunT > 0;
    this.stars.rotation.y += dt * 5;
    for (const m of this.mats) if (m.emissive && !this.flashOn) m.emissive.setHex(this.slowT > 0 ? 0x246d99 : 0);

    if (this.dead) {
      this.deadTime += dt;
      if (this.deadTime > 1) { poof(this.pos, this.size); this.remove(); }   // some numa nuvenzinha
      return;
    }
    if (game.over || this.stunT > 0) return;
    if (this.busy > 0) return;
    this.spawning = false;
    const target = this.tauntT > 0 && this.taunt && !this.taunt.dead ? this.taunt : nearest(this.pos, allies());
    if (target) {
      const d = target.pos.distanceTo(this.pos);
      if (this.ranged) this.vel.set(0, 0, 0);
      if (d > this.range || (!this.ranged && Math.abs(target.pos.y - this.pos.y) >= 0.85)) { if (!this.ranged && this.rootT <= 0) this.moveTo(target.pos, dt); }
      else if (this.face(target.pos, dt) < 0.5 && this.attackTimer <= 0) this.attack(target, this.attackAnim);
    }
    if (this.busy <= 0) this.locomote(this.move, 'Walking_D_Skeletons', 'Idle_Combat');
  }
}

// empurra unidades sobrepostas e desvia dos obstáculos
function separate() {
  const alive = units.filter((u) => !u.dead);
  const before = alive.map((u) => u.pos.clone());
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i].pos, b = alive[j].pos;
      const min = 0.45 * (alive[i].size + alive[j].size);
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (Math.abs(a.y - b.y) < 0.85 && d > 0 && d < min) {
        const push = (min - d) / 2 / d;
        a.x -= dx * push; a.z -= dz * push;
        b.x += dx * push; b.z += dz * push;
      }
    }
  }
  for (const u of alive) {
    for (const o of world.obstacles) {
      const min = o.r + 0.4 * u.size;
      const dx = u.pos.x - o.x, dz = u.pos.z - o.z;
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d = Math.hypot(dx, dz) || 0.01;
      if (d < min) { u.pos.x = o.x + (dx / d) * min; u.pos.z = o.z + (dz / d) * min; }
    }
  }
  alive.forEach((u, i) => {
    if (!world.canStep(before[i], u.pos) || (u.team === 'skeleton' && u.ranged && world.groundHeight(u.pos.x, u.pos.z) < 2.95)) u.pos.copy(before[i]);
    u.pos.y = world.groundHeight(u.pos.x, u.pos.z);
  });
}

// ---------- fases ----------
// state: 'fight' (onda) -> 'cleared' (comemoração + escolha de herói) -> 'advance' (sobe a estrada) -> 'fight'
const game = { phase: 1, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0, guideS: 0, over: false, paused: false };

function startGame() {
  clearTimeout(pick.timer);
  clearTimeout(showBanner.t);
  $('banner').style.opacity = 0;
  pick.open = false;
  evolutions.length = 0;
  pick.upgrades = [];
  while (enemyBolts.length) scene.remove(enemyBolts.pop().mesh);
  for (const list of [bolts, blasts, flames]) while (list.length) {
    const effect = list.pop();
    scene.remove(effect.mesh);
    if (list !== bolts) effect.mesh.material.dispose();
  }
  while (fx.length) { const m = fx.pop(); scene.remove(m); m.material.dispose(); }
  FX.clear();
  audio.stopMusic();
  bars.querySelectorAll('.pop').forEach((el) => el.remove());
  closeHeroPanel();
  $('overlayStats').innerHTML = '';
  while (units.length) units[0].remove();
  // ?fase=N na URL começa direto na fase N (atalho para testar o cenário)
  const first = THREE.MathUtils.clamp(+new URLSearchParams(location.search).get('fase') || 1, 1, PHASES);
  Object.assign(game, { phase: first, start: first, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0, guideS: world.anchorS(first), over: false });
  const start = world.pointAt(game.guideS);
  follow.set(start.x, 0, start.z - 3);
  controls.target.copy(follow);
  camera.position.set(follow.x, 23, follow.z + 21);
  $('overlay').classList.add('hidden');
  showDifficulty();   // depois da dificuldade vem a escolha do herói
}

function startPhase() {
  game.state = 'fight';
  game.toSpawn = Math.round((2 + game.phase * 2) * difficulty.count);
  game.bossPending = game.phase % 6 === 0;
  game.spawnTimer = 0.5;
  showBanner(game.bossPending ? `Fase ${game.phase}: chefe!` : `Fase ${game.phase}`);
}

function spawnSkeleton() {
  const p = game.phase;
  const zone = world.zoneOf(p);
  const onTop = zone?.type === 'plateau' && game.toSpawn <= 2;
  let type = 'Minion', boss = false;
  if (game.bossPending && game.toSpawn === 1) { type = 'Warrior'; boss = true; }
  else {
    const r = Math.random();
    const rogue = Math.min(0.3, 0.04 * p), warrior = Math.min(0.4, 0.06 * p);
    type = r < rogue ? 'Rogue' : r < rogue + warrior ? 'Warrior' : 'Minion';
    if (p >= 2 && Math.random() < difficulty.shooters) type = Math.random() < 0.5 ? 'Crossbow' : 'Mage';
  }
  if (onTop) type = game.toSpawn === 2 ? 'Crossbow' : 'Mage';
  const s = new Skeleton(type, p, boss);
  const s0 = world.anchorS(p);
  const behind = p >= difficulty.behindFrom && !boss && Math.random() < difficulty.behind;   // nas fases mais altas, alguns vêm por trás
  for (let tries = 0; tries < 12; tries++) {
    const at = behind ? s0 - 9 - Math.random() * 3 : s0 + 11 + Math.random() * 6;
    s.pos.copy(world.along(at, (Math.random() * 2 - 1) * (ROAD - 1)));
    if (!world.obstacles.some((o) => Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < o.r + 0.8)) break;
  }
  if (zone) {
    const points = onTop ? zone.top : zone.type === 'lake' && !boss && game.toSpawn % 3 === 0 ? zone.water : zone.ground;
    s.pos.copy(points[game.toSpawn % points.length]);
    if (world.isShallow(s.pos.x, s.pos.z)) waterSplash(s.pos, true);
  }
  s.pos.y = world.groundHeight(s.pos.x, s.pos.z);
  const c = world.pointAt(s0);
  s.root.rotation.y = Math.atan2(c.x - s.pos.x, c.z - s.pos.z);   // de frente para os heróis
}

function updateGame(dt) {
  if (game.over || game.paused) return;
  const alive = heroes().filter((h) => !h.dead);
  const skeletons = skeletonsAlive();

  if (!alive.length) return endGame(`Os esqueletos venceram na fase ${game.phase}. Abates: ${game.kills}`, false);

  if (game.state === 'fight') {
    if (game.toSpawn > 0) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) { spawnSkeleton(); game.toSpawn--; game.spawnTimer = Math.max(0.3, 1.0 - game.phase * 0.05) * difficulty.interval; }
    } else if (!skeletons.length) {
      showBanner(`Fase ${game.phase} vencida!`, 2.5);
      for (const h of heroes()) {
        if (h.dead) {
          if (difficulty.reviveDelay && game.phase - h.diedIn < difficulty.reviveDelay) continue;   // ainda espera a fase seguinte
          h.revive();
        } else h.hp = Math.min(h.maxHp, h.hp + h.maxHp * difficulty.heal);
        h.gainXp(12);
        h.guardT = 0;
        popText(h.pos, '♥', 'heal');
        h.busy = h.once('Cheer');
      }
      game.state = 'cleared';
      game.timer = 2.2;
    }
  } else if (game.state === 'cleared') {
    game.timer -= dt;
    if (game.timer <= 0) {
      if (game.phase >= PHASES) return endGame(`Vitória! O grupo chegou ao castelo. Abates: ${game.kills}`, true);
      game.phase++;
      game.state = 'advance';
      if (heroes().length < HEROES.length) showPick('Novo aliado!', 'Escolha quem entra no grupo');
    }
  } else if (game.state === 'advance') {
    // o ponto da formação anda pela estrada e o grupo vai atrás
    const goal = world.anchorS(game.phase);
    game.guideS = Math.min(goal, game.guideS + MARCH * dt);
    for (const h of heroes()) h.setAnchor(game.guideS);
    if (game.guideS >= goal && alive.every((h) => h.pos.distanceTo(h.post) < 0.6)) startPhase();
  }

  setText('wave', `Fase ${game.phase}/${PHASES}`);
  setText('left', `Esqueletos: ${skeletons.length + (game.state === 'fight' ? game.toSpawn : 0)}`);
  setText('kills', `Abates: ${game.kills}`);
  setText('party', `Heróis: ${heroes().length}/${HEROES.length}`);
}

function endGame(text, won = false) {
  game.over = true;
  closeHeroPanel();
  audio.stopMusic();
  audio.play(won ? 'victory' : 'defeat');
  $('overlayText').textContent = text + (saveRecord(won) ? ` · Novo recorde no ${difficulty.name}!` : '');
  $('overlayStats').innerHTML = summaryHTML(heroes());
  $('overlayBtn').hidden = false;
  $('overlay').classList.remove('hidden');
}

function updateBars() {
  const w = innerWidth / 2, h = innerHeight / 2;
  for (const u of units) {
    if (u.dead) continue;
    tmp.copy(u.pos).setY(u.pos.y + 2.6 * u.size).project(camera);
    const visible = tmp.z < 1;
    u.bar.style.display = visible ? '' : 'none';
    if (!visible) continue;
    u.bar.style.transform = `translate(${tmp.x * w + w}px, ${-tmp.y * h + h}px)`;
    u.bar.firstChild.style.width = `${(u.hp / u.maxHp) * 100}%`;
  }
}

// ---------- laço principal ----------
const clock = new THREE.Clock();
function frame() {
  const real = Math.min(clock.getDelta(), 0.05);
  const dt = game.paused ? 0 : real * speed;
  for (const u of [...units]) u.update(dt);
  if (dt > 0 && !game.over) separate();
  updateBolts(dt);
  updateEnemyBolts(dt);
  updateFx(dt);
  FX.update(dt);
  if (dt > 0) updateGame(dt);
  showEvolution();
  // câmera e sol acompanham o grupo, sem desfazer o giro que o jogador fez
  const alive = heroes().filter((h) => !h.dead);
  if (alive.length) {
    tmp.set(0, 0, 0);
    for (const h of alive) tmp.add(h.pos);
    tmp.divideScalar(alive.length).add(new THREE.Vector3(0, 0, -3));
    follow.lerp(tmp, Math.min(1, real * 2));
  }
  tmp.subVectors(follow, controls.target);
  controls.target.add(tmp);
  camera.position.add(tmp);
  sun.position.set(follow.x + 14, 30, follow.z + 12);
  sun.target.position.copy(follow);
  world.update(real, follow.z);
  const gloom = world.gloomAt(follow.z);
  scene.background.lerpColors(SKY[0], SKY[1], gloom);
  scene.fog.color.copy(scene.background);
  scene.fog.near = 45 - gloom * 22;
  scene.fog.far = 110 - gloom * 45;
  hemi.color.lerpColors(HEMI[0], HEMI[1], gloom);
  hemi.groundColor.lerpColors(HEMI_GROUND[0], HEMI_GROUND[1], gloom);
  hemi.intensity = 1.8 - gloom * 0.5;
  sun.color.lerpColors(SUN[0], SUN[1], gloom);
  sun.intensity = 2.4 - gloom * 1;
  const sel = panelHero();   // anel embaixo do herói com o cartão aberto
  selectRing.visible = !!sel && !sel.dead && units.includes(sel);
  if (selectRing.visible) { selectRing.position.copy(sel.pos).setY(sel.pos.y + 0.06); selectRing.rotation.z += real * 1.5; }
  tickHeroPanel(real);
  controls.update();
  const kick = FX.jolt(real);   // tremida dos golpes fortes, só no quadro desenhado
  camera.position.add(kick);
  renderer.render(scene, camera);
  camera.position.sub(kick);
  updateBars();
  updateSkillBar();
  audio.setGloom(world.gloomAt(follow.z));   // música mais sombria rumo ao castelo
  requestAnimationFrame(frame);
}

// clicar num herói abre o cartão dele (clique sem arrastar, para não brigar com o giro da câmera)
const selectRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 6), new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
selectRing.rotation.x = -Math.PI / 2;
selectRing.visible = false;
scene.add(selectRing);
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  let best = null, bestD = 50;   // herói mais perto do clique na tela, até 50 px
  for (const h of heroes()) {
    tmp.copy(h.pos).setY(h.pos.y + 1).project(camera);
    const d = Math.hypot((tmp.x * 0.5 + 0.5) * innerWidth - e.clientX, (-tmp.y * 0.5 + 0.5) * innerHeight - e.clientY);
    if (d < bestD) { bestD = d; best = h; }
  }
  if (best) openHeroPanel(best, XP_LEVELS);
  else if (panelHero()) closeHeroPanel();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHeroPanel(); });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await loadAssets();
renderPortraits();
startGame();
frame();
