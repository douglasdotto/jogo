import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createWorld } from './world.js';
import { CHARACTERS, CHARACTER_ASSETS, buildCharacter, applyLook } from './characters.js';
import { LOOKS } from './looks.js';
import { newStats, openHeroPanel, closeHeroPanel, panelHero, tickHeroPanel, summaryHTML } from './stats.js';
import { MISSIONS, goalText, starsFor, saveStars, renderCampaign, totalStars, variantOpen, starsToUnlock, UNLOCKS, allOpen } from './campaign.js';

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
const SKY = [new THREE.Color(0x7cc6ff), new THREE.Color(0x3f3552)];   // azul vivo de dia (estilo Clash)
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
$('restart').onclick = () => startGame();   // volta para o menu inicial
$('overlayBtn').onclick = () => startGame(game.mission ? 'map' : 'menu');   // na campanha volta para o mapa

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
  const total = totalStars();
  pick.cards = pick.options.map((cfg, i) => {
    const owned = isOwned(cfg), open = variantOpen(cfg.id, total);
    const b = document.createElement('div');
    b.className = owned ? 'card owned' : open ? 'card' : 'card locked';
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', owned ? `${cfg.name} (já está no grupo)` : open ? `Escolher ${cfg.name}` : `${cfg.name} (★ ${starsToUnlock(cfg.id)} para liberar)`);
    b.style.setProperty('--c', cfg.color[0]);
    b.style.setProperty('--cd', cfg.color[1]);
    b.style.setProperty('--d', `${i * 30}ms`);
    b.innerHTML = `<div class="portrait"><img src="${cfg.portrait}" alt=""></div><div class="ribbon">${cfg.name}</div>
      <strong class="ability">${owned || open ? cfg.ability : `★ ${starsToUnlock(cfg.id)} para liberar`}</strong>${owned ? '<span class="seal">No grupo</span>' : ''}${open ? '' : '<span class="lock">\u{1F512}︎</span>'}`;
    if (!owned && open) b.onclick = () => confirmPick(i);
    bindCard(b, i);
    rows.children[cfg.classId].appendChild(b);
    return b;
  });
  pick.info = document.createElement('aside');
  pick.info.className = 'pick-info';
  list.append(rows, pick.info);
  selectCard(pick.options.findIndex(isFree));
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

const isOwned = (cfg) => heroes().some((h) => h.cfg.id === cfg.id);
const isFree = (cfg) => !isOwned(cfg) && variantOpen(cfg.id);   // pode entrar no grupo agora

// recordes por dificuldade (melhor fase e abates), guardados no navegador quando der
const RECORDS_KEY = 'cavaleiros-recordes';
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch { return {}; }
}

// devolve true quando a partida que acabou virou o novo recorde do nível
function saveRecord(won) {
  if (game.start > 1 || game.mission) return false;   // o atalho ?fase=N não vale recorde; a campanha usa estrelas
  const records = loadRecords(), old = records[difficulty.id];
  const now = { phase: game.phase, kills: game.kills, won };
  const better = !old || (won && !old.won) || (won === !!old.won && (now.phase > old.phase || (now.phase === old.phase && now.kills > old.kills)));
  if (!better) return false;
  records[difficulty.id] = now;
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { return false; }
  return true;
}

// menu inicial: Campanha (missões com estrelas) ou Jornada completa (as 12 fases seguidas)
const MODES = [
  { name: 'Campanha', icon: '⚑', desc: '8 missões com objetivos e estrelas.', color: ['#ffe27a', '#c98a12'] },
  { name: 'Jornada completa', icon: '♛', desc: 'As 12 fases seguidas até o castelo.', color: ['#bfe0ff', '#5a8fd0'] },
];
function showMenu() {
  pick.mode = 'mode';
  $('banner').style.opacity = 0;
  $('campaign').classList.add('hidden');
  pick.options = MODES;
  $('pickTitle').textContent = 'Cavaleiros vs Esqueletos';
  $('pickSub').textContent = 'Escolha o modo de jogo';
  $('pickHint').textContent = 'Clique para escolher · ← → movem · Enter confirma';
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  const records = Object.values(loadRecords());
  const lines = [`★ ${totalStars()} / ${MISSIONS.length * 3} estrelas`,
    records.some((r) => r.won) ? '♛ Jornada vencida!' : records.length ? `Recorde: fase ${Math.max(...records.map((r) => r.phase))}` : 'Sem recorde ainda'];
  pick.cards = MODES.map((m, i) => {
    const b = document.createElement('div');
    b.className = 'card diff mode';
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', `${m.name}: ${m.desc}`);
    b.style.setProperty('--c', m.color[0]);
    b.style.setProperty('--cd', m.color[1]);
    b.style.setProperty('--d', `${i * 90}ms`);
    b.innerHTML = `<div class="num">${i + 1}</div><div class="medal">${m.icon}</div><div class="ribbon">${m.name}</div><p>${m.desc}</p><div class="record">${lines[i]}</div>`;
    b.onclick = () => confirmPick(i);
    bindCard(b, i);
    list.appendChild(b);
    return b;
  });
  selectCard(0);
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

function confirmMode(i) {
  pick.open = false;
  pick.cards.forEach((c, k) => c.classList.add(k === i ? 'chosen' : 'gone'));
  pick.timer = setTimeout(() => (i === 0 ? showCampaign() : (game.mission = null, showDifficulty())), 450);
}

// mapa da campanha; escolher uma missão leva à dificuldade
function showCampaign() {
  game.mission = null;
  pick.open = false;
  game.paused = true;   // sem grupo ainda: a partida não pode correr por trás do mapa
  $('pick').classList.add('hidden');
  const root = $('campaign');
  renderCampaign(root, (m) => {
    game.mission = m;
    root.classList.add('hidden');
    showDifficulty();
  });
  const back = document.createElement('button');
  back.className = 'camp-back';
  back.textContent = '← Menu';
  back.onclick = () => showMenu();
  root.querySelector('.camp-head')?.prepend(back);
  root.classList.remove('hidden');
}

// dificuldade: na jornada mostra o recorde de cada uma; na campanha, o trecho da missão
function showDifficulty() {
  pick.mode = 'difficulty';
  $('banner').style.opacity = 0;
  pick.options = DIFFICULTIES;
  const records = loadRecords(), m = game.mission;
  $('pickTitle').textContent = m ? `${MISSIONS.indexOf(m) + 1}. ${m.name}` : 'Jornada completa';
  $('pickSub').textContent = m ? `Objetivo: ${goalText(m.goal)} · escolha a dificuldade` : 'Escolha a dificuldade da aventura';
  $('pickHint').textContent = 'Clique para escolher · ← → movem · Enter confirma · Esc volta';
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  pick.cards = DIFFICULTIES.map((d, i) => {
    const r = m ? null : records[d.id];
    const record = m ? `Fases ${m.from}–${m.to}` : r ? `${r.won ? '♛ Vitória!' : `Recorde: fase ${r.phase}`} · ${r.kills} abates` : 'Sem recorde ainda';
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
  const m = game.mission;
  // ?fase=N também vale na campanha, dentro do trecho da missão
  const asked = +new URLSearchParams(location.search).get('fase');
  placeParty(m ? THREE.MathUtils.clamp(asked || m.from, m.from, m.to) : THREE.MathUtils.clamp(asked || 1, 1, PHASES));
  game.picksLeft = m ? m.heroes : 0;
  pick.timer = setTimeout(() => (m ? showPick(pickTitle(), pickSub())
    : showPick('Escolha seu herói', 'Ele vai liderar o grupo contra os esqueletos')), 550);
}

const pickTitle = () => game.mission.heroes > 1 ? `Escolha o herói ${heroes().length + 1} de ${game.mission.heroes}` : 'Escolha seu herói';
const pickSub = () => `${game.mission.name}: o grupo começa no nível ${game.mission.level}`;

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
    <small>${HEROES[cfg.classId].name}</small><div class="ability"><b>✦ ${cfg.ability}</b>${cfg.desc}</div><div class="stats">${stats}</div>
    ${variantOpen(cfg.id) ? '' : `<div class="lock-info">\u{1F512}︎ Ganhe ★ ${starsToUnlock(cfg.id)} na campanha para liberar</div>`}`;
}

// setas na grade: ← → dentro da linha, ↑ ↓ entre linhas (coluna mais próxima), pulando quem já está no grupo
function moveGrid(dx, dy) {
  const free = (i) => isFree(pick.options[i]);
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
  if (pick.mode === 'mode') return confirmMode(i);
  const cfg = pick.options[i];
  if (!isFree(cfg) || heroes().length >= 4) return;
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
    const party = heroes(), first = game.picksLeft > 0;   // first: grupo inicial da missão
    const xp = first ? XP_LEVELS[game.mission.level - 1] : party.length ? party.reduce((sum, h) => sum + h.xp, 0) / party.length / 2 : 0;
    const h = new Hero(cfg);
    arrangeParty();
    h.gainXp(xp);
    h.busy = h.once('Cheer') * 0.6;
    if (first) {
      autoUpgrade();   // a missão já começa no nível certo, sem telas de evolução
      if (--game.picksLeft > 0) return showPick(pickTitle(), pickSub());
      return startMission();
    }
    if (heroes().length > 1) showBanner(`${cfg.name} entrou no grupo!`);
    game.paused = false;
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
  const pool = UPGRADES.filter((o) => (o.id !== 'range' || h.ranged) && (o.id !== 'skill' || cfg.id !== 'berserker'));
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
  applyUpgrade(h, option);
  popText(h.pos, option.name + '!', 'evolve');
  pick.open = false;
  $('pick').classList.add('hidden');
  game.paused = false;
  showEvolution();
}

// no começo da missão as evoluções já vêm com uma melhoria sorteada, sem abrir a tela
function autoUpgrade() {
  while (evolutions.length) {
    const h = evolutions.shift().hero;
    const pool = UPGRADES.filter((o) => (o.id !== 'range' || h.ranged) && (o.id !== 'skill' || h.cfg.id !== 'berserker'));
    applyUpgrade(h, pool[Math.floor(Math.random() * pool.length)]);
  }
}

function applyUpgrade(h, option) {
  if (option.id === 'hp') { h.maxHp = Math.round(h.maxHp * 1.25); h.hp = h.maxHp; }
  if (option.id === 'dmg') h.dmg *= 1.2;
  if (option.id === 'haste') h.haste *= 1.2;
  if (option.id === 'range') h.range *= 1.2;
  if (option.id === 'skill') { h.skillRate *= 0.75; h.skillPower *= 1.25; h.skillTimer *= 0.75; }
  if (option.id === 'shield') h.damageTaken *= 0.8;
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
  if (e.key === 'Escape' && pick.mode === 'difficulty') return game.mission ? showCampaign() : showMenu();
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
        if (effect) effect();
        else if (this.ranged && !target.dead) this.team === 'skeleton' ? fireEnemyBolt(this, target) : fireBolt(this, target, this.cfg.id === 'crossbow' ? 'crossbow' : 'magic');
        else if (this.cleave) damageCleave(this, target);
        else if (!target.dead && Math.abs(target.pos.y - this.pos.y) < 0.85 && target.pos.distanceTo(this.pos) <= this.range + 0.6 * target.size) this.team !== 'skeleton' ? heroHit(this, target, this.dmg) : target.takeDamage(this.dmg, this.pos);
      }
    }
  }
}

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

function fireBolt(from, target, kind = 'magic', angle = 0) {
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
  bolts.push({ mesh, target, owner: from, kind, dir, hit: new Set(), life: Math.max(1, from.range / 14 + 0.2), dmg: from.dmg, level: from.level, power: kind === 'magic' ? 1 : from.skillPower });
}

function updateBolts(dt) {
  if (dt <= 0) return;
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.life -= dt;
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
        b.hit.add(s);
        if (b.kind === 'ninja') { b.life = 0; break; }
      }
    } else {
      const goal = b.target.pos.clone().setY(b.target.pos.y + 1.1);
      const d = goal.distanceTo(b.mesh.position);
      b.mesh.position.lerp(goal, Math.min(1, 14 * dt / Math.max(d, 0.001)));
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
    let anim = 'Spellcast_Raise', effect;
    if (id === 'paladin') {
      const friends = heroes().filter((h) => !h.dead && h.hp < h.maxHp && h.pos.distanceTo(this.pos) <= (5 + level) * power);
      if (!friends.length) return false;
      effect = () => {
        for (const h of friends) if (!h.dead && h.pos.distanceTo(this.pos) <= (5 + level) * power) {
          const heal = Math.min(h.maxHp - h.hp, (32 + level * 10) * power);
          h.hp += heal;
          this.stats.cura += heal;
          popText(h.pos, '+' + Math.round(heal), 'heal');
        }
        ring(this.pos, (5 + level) * power, 0x6eea90, 1);
      };
    } else if (id === 'guardian') {
      if (!nearby.length) return false;
      anim = 'Block';
      effect = () => {
        this.guardT = (4 + (level - 1)) * power;
        for (const s of nearby) if (!s.dead) { s.taunt = this; s.tauntT = this.guardT; s.pendingHit = null; }
        ring(this.pos, radius, this.cfg.color[0], 1);
      };
    } else if (id === 'champion' || id === 'crusher') {
      if (!nearby.some((s) => id === 'champion' || inMeleeArc(this, s, 2.2 * power))) return false;
      anim = id === 'champion' ? '2H_Melee_Attack_Spin' : '2H_Melee_Attack_Chop';
      effect = () => {
        for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(this.pos) <= radius) {
          if (id === 'crusher' && !inMeleeArc(this, s, 2.2 * power)) continue;
          heroHit(this, s, this.dmg * 1.1);
          if (id === 'champion') s.vel.add(new THREE.Vector3().subVectors(s.pos, this.pos).setY(0).normalize().multiplyScalar(6 + level));
          else { s.stunT = (1.5 + (level - 1) * 0.25) * power; s.pendingHit = null; s.vel.set(0, 0, 0); }
        }
        ring(this.pos, id === 'crusher' ? 2.2 * power : radius, this.cfg.color[0]);
      };
    } else if (id === 'viking' || id === 'iceviking') {
      target = nearest(this.pos, skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) > 2 && s.pos.distanceTo(this.pos) < 9));
      if (!target) return false;
      anim = 'Throw';
      effect = () => fireBolt(this, target, id);
    } else if (id === 'arcane') {
      if (!target || target.pos.distanceTo(this.pos) > this.range) return false;
      anim = 'Spellcast_Shoot';
      effect = () => {
        let at = this.pos;
        const hit = new Set();
        let next = target;
        for (let i = 0; i < Math.round((3 + (level - 1)) * power); i++) {
          if (!next || next.dead) break;
          beam(at, next.pos, colors.arcane);
          hit.add(next);
          heroHit(this, next, this.dmg * 0.9);
          at = next.pos;
          next = nearest(at, skeletonsAlive().filter((s) => !s.spawning && !hit.has(s) && s.pos.distanceTo(at) < 4 + level));
        }
      };
    } else if (id === 'pyro' || id === 'cryo' || id === 'crossbow' || id === 'ninja') {
      if (!target || target.pos.distanceTo(this.pos) > (id === 'ninja' ? 7 : this.range)) return false;
      anim = id === 'ninja' ? 'Throw' : id === 'crossbow' ? '2H_Ranged_Shoot' : 'Spellcast_Shoot';
      effect = () => {
        if (id === 'ninja') for (const angle of [-0.22, 0, 0.22]) fireBolt(this, target, id, angle);
        else fireBolt(this, target, id);
      };
    } else if (id === 'king') {
      if (!target) return false;
      anim = 'Cheer';
      effect = () => {
        for (const h of heroes()) if (!h.dead) {
          h.royalT = 5 * power;
          h.royalBonus = 0.2;
          ring(h.pos, 1, 0xffdf70, 0.8);
        }
      };
    } else if (id === 'necro') {
      if (!target) return false;
      effect = () => {
        for (const u of units.filter((u) => u.summoner === this)) { poof(u.pos); u.remove(); }
        for (const side of [-1, 1]) new Minion(this, side);
        ring(this.pos, 2, 0x9fffb0);
      };
    } else if (id === 'druid') {
      if (!nearby.length) return false;
      effect = () => {
        for (const enemy of skeletonsAlive()) if (!enemy.spawning && enemy.pos.distanceTo(this.pos) <= radius) {
          enemy.rootT = 1.5 * power;
          enemy.vel.set(0, 0, 0);
          ring(enemy.pos, 0.65, 0x83c657, 1.5 * power);
        }
        for (const h of heroes()) if (!h.dead && h.pos.distanceTo(this.pos) <= radius) {
          const heal = Math.min(h.maxHp - h.hp, 20 * power);
          h.hp += heal;
          this.stats.cura += heal;
          if (heal > 0) popText(h.pos, '+' + Math.round(heal), 'heal');
        }
        ring(this.pos, radius, 0x83c657);
      };
    } else return false;
    this.face(target ? target.pos : this.pos.clone().add(this.fwd), 1);
    this.busy = this.once(anim, 1.4);
    this.pendingHit = { target, effect, t: this.busy * 0.4 };
    this.skillTimer = ((id === 'necro' ? 12 : id === 'king' ? 10 : id === 'paladin' ? 8 : id === 'guardian' ? 9 : 6) - (level - 1) * 0.7) * this.skillRate;
    this.stats.habilidades++;
    return true;
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
    this.age += dt;
    if (!this.dead && game.state === 'fight') this.stats.tempo += dt;   // para o dano por segundo
    for (const o of this.trinkets) {
      if (o.userData.spin) { o.rotation.y += dt * 2; o.position.y = 0.1 + Math.sin(this.age * 3) * 0.05; }
      if (o.userData.orbit) o.rotation.y += dt * 1.5;
      if (o.userData.flicker) o.scale.y = 1 + Math.sin(this.age * 14) * 0.15;
    }
    const rage = !this.dead && this.cfg.id === 'berserker' && this.hp < this.maxHp * 0.5;
    this.cooldown = this.cfg.cooldown / this.haste / (rage ? 1.5 * this.skillPower : 1);
    this.aura.visible = !this.dead && (this.level > 1 || rage || this.guardT > 0);
    this.aura.material.color.set(rage ? 0xff4242 : this.cfg.color[1]);
    this.aura.scale.setScalar(0.8 + Math.sin(this.age * 4) * 0.06);
    this.halo.position.y = 2.5 + Math.sin(this.age * 3) * 0.08;
    this.updateCommon(dt);
    if (this.dead || this.busy > 0 || game.over) return;
    const target = game.state === 'fight' ? nearest(this.pos, skeletonsAlive().filter((u) => !u.spawning)) : null;
    if (game.state === 'fight' && this.skillTimer <= 0 && this.useSkill(target)) return;
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

// view: 'menu' (tela inicial) ou 'map' (mapa da campanha)
function startGame(view = 'menu') {
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
  bars.querySelectorAll('.pop').forEach((el) => el.remove());
  closeHeroPanel();
  $('overlayStats').innerHTML = '';
  $('overlayStars').innerHTML = '';
  while (units.length) units[0].remove();
  game.mission = null;
  // ?fase=N na URL começa direto na fase N (atalho para testar o cenário)
  placeParty(THREE.MathUtils.clamp(+new URLSearchParams(location.search).get('fase') || 1, 1, PHASES));
  $('overlay').classList.add('hidden');
  if (view === 'map') showCampaign();
  else showMenu();   // modo -> (mapa) -> dificuldade -> escolha do herói
}

// põe o grupo (e a câmera) na fase inicial e zera a partida; game.mission continua
function placeParty(first) {
  const m = game.mission;
  Object.assign(game, { phase: first, start: first, last: m ? m.to : PHASES, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0,
    guideS: world.anchorS(first), over: false, picksLeft: 0, falls: 0, missionT: 0, surviveT: m?.goal.time || 0, totemsPlaced: 0, totemsDown: 0, bossSeen: false, bossDown: false, villager: null,
    test: new URLSearchParams(location.search).has('fase') });
  const start = world.pointAt(game.guideS);
  follow.set(start.x, 0, start.z - 3);
  controls.target.copy(follow);
  camera.position.set(follow.x, 23, follow.z + 21);
  $('goal').classList.toggle('hidden', !m);
  if (m) setText('goal', goalText(m.goal));
  $('goal').classList.remove('warn', 'done');
}

// grupo inicial escolhido: começa a missão (o aldeão entra junto na escolta)
function startMission() {
  const m = game.mission;
  if (m.goal.type === 'escort') game.villager = new Villager();
  showBanner(`${m.name}: ${goalText(m.goal)}`, 3);
  game.paused = false;
}

function startPhase() {
  game.state = 'fight';
  game.toSpawn = Math.round((2 + game.phase * 2) * difficulty.count);
  game.bossPending = game.phase % 6 === 0;
  game.spawnTimer = 0.5;
  const goal = game.mission?.goal;
  if (goal?.type === 'totems') {   // espalha o que falta dos totens pelas fases que restam
    const n = Math.ceil((goal.count - game.totemsPlaced) / (game.last - game.phase + 1));
    for (let k = 0; k < n; k++) placeTotem(k);
  }
  if (goal?.type === 'survive' && game.phase === goal.phase) return showBanner(`Aguente ${goal.time} s!`);
  showBanner(game.bossPending ? `Fase ${game.phase}: chefe!` : `Fase ${game.phase}`);
}

// ---------- campanha: aldeão, totens e objetivos ----------
// aldeão da escolta: o bárbaro sem armas (só a caneca), recolorido; segue atrás do grupo e os esqueletos o atacam
class Villager extends Unit {
  constructor() {
    super(assets.Barbarian, { hp: Math.round(240 / difficulty.dmg), dmg: 0, range: 0, speed: 3, cooldown: 1 }, 'villager');
    const tint = new THREE.Color(0xd8b07a);
    this.root.traverse((o) => { if (HEROES[1].weapons.includes(o.name) && o.name !== 'Mug') o.visible = false; });
    for (const m of this.mats) m.color?.lerp(tint, 0.45);
    this.bar.classList.add('ally');
    const label = document.createElement('span');
    label.textContent = 'Aldeão';
    this.bar.appendChild(label);
    this.post = new THREE.Vector3();
    this.follow();
    this.pos.copy(this.post);
    this.popT = 0;
    this.loop('Idle');
  }

  follow() {
    const fwd = world.tangentAt(game.guideS);
    this.post.copy(world.pointAt(game.guideS)).addScaledVector(fwd, -3.2);
    return fwd;
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    if (this.dead || game.over || this.busy > 0) return;
    const fwd = this.follow();
    if (this.pos.distanceTo(this.post) > 0.3) this.moveTo(this.post, dt);
    else this.face(tmp.copy(this.post).addScaledVector(fwd, 10), dt);
    this.locomote('Running_A', 'Walking_A', 'Idle');
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.pendingHit = null;
    this.once('Death_A');
    this.bar.style.display = 'none';
  }
}

// totem de ossos: pilha de ossos com caveira e brilho roxo; tem vida, não anda e faz surgir esqueletos por perto
let totemParts = null;
function totemModel() {
  totemParts ||= { bone: new THREE.MeshLambertMaterial({ color: 0xf1e8d2 }), glow: new THREE.MeshBasicMaterial({ color: 0xb36bff }),
    stick: new THREE.CylinderGeometry(0.11, 0.11, 1.3, 6), knob: new THREE.SphereGeometry(0.15, 8, 6), skull: new THREE.SphereGeometry(0.42, 12, 10),
    eye: new THREE.SphereGeometry(0.09, 6, 6), ring: new THREE.TorusGeometry(0.85, 0.07, 6, 24), base: new THREE.CylinderGeometry(0.7, 0.85, 0.35, 8) };
  const P = totemParts, g = new THREE.Group();
  const base = new THREE.Mesh(P.base, P.bone);
  base.position.y = 0.17;
  g.add(base);
  for (let k = 0; k < 3; k++) {   // ossos cruzados em pé
    const stick = new THREE.Mesh(P.stick, P.bone);
    stick.position.set(Math.cos(k * 2.1) * 0.22, 0.95, Math.sin(k * 2.1) * 0.22);
    stick.rotation.set(Math.sin(k * 2.1) * 0.35, 0, Math.cos(k * 2.1) * 0.35);
    for (const end of [-0.65, 0.65]) { const knob = new THREE.Mesh(P.knob, P.bone); knob.position.y = end; stick.add(knob); }
    g.add(stick);
  }
  const skull = new THREE.Mesh(P.skull, P.bone);
  skull.position.y = 1.95;
  skull.scale.set(1, 0.9, 1);
  for (const side of [-0.15, 0.15]) { const eye = new THREE.Mesh(P.eye, P.glow); eye.position.set(side, 0.02, 0.36); skull.add(eye); }
  g.add(skull);
  const ring = new THREE.Mesh(P.ring, P.glow);
  ring.name = 'glow';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);
  return { scene: g, animations: [] };
}

class Totem extends Unit {
  constructor(at) {
    super(totemModel(), { hp: Math.round(240 * difficulty.hp * (1 + (game.phase - 1) * 0.12)), dmg: 0, range: 0, speed: 0, cooldown: 1 }, 'skeleton');
    this.totem = true;
    this.ranged = true;      // o grupo vai até ele (e o separate não o empurra)
    this.busy = Infinity;    // sem animações de golpe
    this.spawnT = 2;
    this.glow = this.root.getObjectByName('glow');
    this.pos.copy(at);
    this.popT = 0;
    this.deadTime = 0;
  }

  update(dt) {
    if (dt <= 0) return;
    this.vel.set(0, 0, 0);
    this.updateCommon(dt);
    if (this.glow) this.glow.rotation.z += dt * 2;
    if (this.dead && (this.deadTime += dt) > 0.4) this.remove();
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.bar.style.display = 'none';
    this.root.visible = false;
    poof(this.pos, 1.6);
    ring(this.pos, 2.4, 0xb36bff, 1);
    game.totemsDown++;
    for (const h of heroes()) if (!h.dead) h.gainXp(8);
    showBanner(`Totem destruído! ${game.totemsDown}/${game.mission.goal.count}`);
  }
}

// totem num lado da estrada, à frente do grupo e longe do desafio da fase
function placeTotem(k) {
  const s0 = world.anchorS(game.phase), zone = world.zoneOf(game.phase);
  const side = zone ? (zone.type === 'lake' ? 1 : -1) : k % 2 ? 1 : -1;
  const at = new THREE.Vector3();
  for (let tries = 0; tries < 12; tries++) {
    at.copy(world.along(s0 + 5 + k * 3 + Math.random() * 2, side * (2.5 + Math.random() * 1.5)));
    if (!world.obstacles.some((o) => Math.hypot(o.x - at.x, o.z - at.z) < o.r + 1.2)) break;
  }
  at.y = world.groundHeight(at.x, at.z);
  new Totem(at);
  game.totemsPlaced++;
}

const clockText = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// regras da missão a cada quadro; devolve true se a missão acabou em derrota
function campaignTick(dt, skeletons) {
  const goal = game.mission.goal;
  for (const h of heroes()) { if (h.dead && !h.fell) game.falls++; h.fell = h.dead; }
  game.missionT += dt;
  const fail = (text) => (endGame(text, false), true);
  if (goal.type === 'nofall' && game.falls) return fail('Um herói caiu! A regra era ninguém cair.');
  if (goal.type === 'escort' && game.villager?.dead) return fail('O aldeão caiu! Proteja-o até o fim.');
  if (goal.type === 'timer' && game.missionT > goal.time) return fail(`O tempo acabou na fase ${game.phase}!`);
  if (goal.type === 'boss') {   // chefe derrotado: o exército dele se desfaz e a missão termina
    const boss = units.find((u) => u.boss);
    if (boss) game.bossSeen = true;
    if (game.bossSeen && (!boss || boss.dead) && game.state === 'fight' && !game.bossDown) {
      game.bossDown = true;
      game.last = game.phase;
      game.toSpawn = 0;
      for (const s of skeletonsAlive()) s.die();
      showBanner('Chefe derrotado!', 2.5);
    }
  }
  if (goal.type === 'survive' && game.phase === goal.phase && game.state === 'fight') {   // ondas sem parar até o tempo acabar
    game.surviveT = Math.max(0, game.surviveT - dt);
    if (game.surviveT > 0 && game.toSpawn === 0 && skeletons.length < 6) game.toSpawn = 4;
  }
  if (goal.type === 'totems' && game.state === 'fight') {
    for (const t of skeletons) if (t.totem && (t.spawnT -= dt) <= 0) {
      t.spawnT = 6 * difficulty.interval;
      if (skeletons.length >= 12) continue;
      const s = new Skeleton(Math.random() < 0.3 ? 'Warrior' : 'Minion', game.phase);
      const a = Math.random() * Math.PI * 2;
      s.pos.set(t.pos.x + Math.cos(a) * 1.6, 0, t.pos.z + Math.sin(a) * 1.6);
      s.pos.y = world.groundHeight(s.pos.x, s.pos.z);
    }
  }
  // indicador no HUD
  const v = game.villager, left = goal.time - game.missionT;
  const text = {
    win: `Vença até a fase ${game.mission.to}`,
    escort: v ? `Aldeão ${Math.ceil(Math.max(0, v.hp) / v.maxHp * 100)}%` : 'Proteja o aldeão',
    boss: game.bossDown ? 'Chefe derrotado!' : game.bossSeen ? 'Derrote o chefe!' : `Chefe na fase ${Math.ceil(game.phase / 6) * 6}`,
    survive: game.phase < goal.phase ? `Aguente ${goal.time} s na fase ${goal.phase}` : game.surviveT > 0 ? `Aguente ${clockText(game.surviveT)}` : 'Sobreviveu!',
    totems: `Totens ${game.totemsDown}/${goal.count}`,
    nofall: `Ninguém cai · ${heroes().filter((h) => !h.dead).length} de pé`,
    timer: `Tempo ${clockText(Math.max(0, left))}`,
  }[goal.type];
  setText('goal', text);
  $('goal').classList.toggle('warn', (goal.type === 'escort' && v && v.hp < v.maxHp * 0.35) || (goal.type === 'timer' && left < 30));
  $('goal').classList.toggle('done', (goal.type === 'totems' && game.totemsDown >= goal.count) || (goal.type === 'survive' && game.phase === goal.phase && game.surviveT <= 0));
  return false;
}

// fim da missão: estrelas animadas, gravação e aviso de variante nova
function missionEnd(won) {
  const party = heroes();
  const hpRatio = party.reduce((s, h) => s + Math.max(0, h.hp), 0) / Math.max(1, party.reduce((s, h) => s + h.maxHp, 0));
  const stars = starsFor({ won, falls: game.falls, hpRatio });
  const before = totalStars();
  const best = !game.test && saveStars(game.mission.id, stars);
  const fresh = allOpen() ? [] : UNLOCKS.filter((u) => u.stars > before && u.stars <= totalStars()).map((u) => VARIANTS.find((v) => v.id === u.id));
  const row = `<span class="stars big">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">★</i>`).join('')}</span>`;
  $('overlayStars').innerHTML = row + (best && stars ? '<div class="star-best">Novo melhor resultado!</div>' : '') + (game.test ? '<div class="star-best">Atalho ?fase: estrelas não contam</div>' : '')
    + fresh.map((cfg) => `<div class="unlock" style="--c:${cfg.color[0]};--cd:${cfg.color[1]}"><img src="${cfg.portrait}" alt=""><span><b>Nova variante liberada!</b>${cfg.name}</span></div>`).join('');
  return stars;
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
  if (game.mission && campaignTick(dt, skeletons)) return;

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
      const v = game.villager;
      if (v && !v.dead) v.hp = Math.min(v.maxHp, v.hp + v.maxHp * difficulty.heal);
      game.state = 'cleared';
      game.timer = 2.2;
    }
  } else if (game.state === 'cleared') {
    game.timer -= dt;
    if (game.timer <= 0) {
      if (game.phase >= game.last) return endGame(game.mission ? `Missão cumprida: ${game.mission.name}! Abates: ${game.kills}` : `Vitória! O grupo chegou ao castelo. Abates: ${game.kills}`, true);
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

  setText('wave', `Fase ${game.phase}/${game.last}`);
  setText('left', `Esqueletos: ${skeletons.filter((s) => !s.totem).length + (game.state === 'fight' ? game.toSpawn : 0)}`);
  setText('kills', `Abates: ${game.kills}`);
  setText('party', `Heróis: ${heroes().length}/${HEROES.length}`);
}

function endGame(text, won = false) {
  game.over = true;
  closeHeroPanel();
  $('overlayText').textContent = text + (saveRecord(won) ? ` · Novo recorde no ${difficulty.name}!` : '');
  if (game.mission) missionEnd(won);
  $('overlayStats').innerHTML = summaryHTML(heroes());
  $('overlayBtn').textContent = game.mission ? 'Voltar ao mapa' : 'Jogar de novo';
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
  hemi.intensity = 1.35 - gloom * 0.3;   // menos luz ambiente e sol mais forte: sombras marcadas
  sun.color.lerpColors(SUN[0], SUN[1], gloom);
  sun.intensity = 3.1 - gloom * 1.4;
  const sel = panelHero();   // anel embaixo do herói com o cartão aberto
  selectRing.visible = !!sel && !sel.dead && units.includes(sel);
  if (selectRing.visible) { selectRing.position.copy(sel.pos).setY(sel.pos.y + 0.06); selectRing.rotation.z += real * 1.5; }
  tickHeroPanel(real);
  controls.update();
  renderer.render(scene, camera);
  updateBars();
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
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeHeroPanel();
  if (!$('campaign').classList.contains('hidden')) showMenu();   // Esc no mapa volta ao menu
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await loadAssets();
renderPortraits();
startGame();
frame();
