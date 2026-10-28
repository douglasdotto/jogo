import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createWorld } from './world.js';

const ROAD = 5;             // metade da largura da estrada
const PHASES = 12;          // a última fase fica no topo, no castelo
const LEASH = 5;            // quanto o herói se afasta do posto para lutar
const MARCH = 2.4;          // velocidade do grupo andando pela estrada entre as fases

// cada classe tem seu posto: [lado, frente(-)/trás(+)].
const HEROES = [
  { name: 'Cavaleiro', model: 'Knight', post: [0, -0.8], hp: 240, dmg: 30, range: 1.5, speed: 3.2, cooldown: 0.85, idle: 'Idle', attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'],
    weapons: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'] },
  { name: 'Bárbaro', model: 'Barbarian', post: [-1.7, -0.3], hp: 260, dmg: 34, range: 1.7, speed: 2.8, cooldown: 1.4, idle: '2H_Melee_Idle', cleave: 1.2, attacks: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin'],
    weapons: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'] },
  { name: 'Mago', model: 'Mage', post: [0, 1.4], hp: 150, dmg: 28, range: 7, speed: 2.6, cooldown: 1.3, idle: 'Idle', ranged: true, splash: 1.4, attacks: ['Spellcast_Shoot'],
    weapons: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'] },
  { name: 'Ladino', model: 'Rogue', post: [1.7, -0.3], hp: 180, dmg: 18, range: 1.4, speed: 4, cooldown: 0.55, idle: 'Idle', attacks: ['Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab'],
    weapons: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'] },
];
// variantes compartilham o posto e o modelo da classe.
const VARIANTS = [
  { id: 'paladin', names: ['Paladino', 'Paladino Real', 'Santo Guerreiro'], desc: 'Cura os amigos próximos.', ability: 'Círculo de cura', color: ['#a9e9bc', '#55a77b'],
    use: ['1H_Sword', 'Round_Shield'], stats: { Vida: 5, Força: 3, Rapidez: 3, Alcance: 1 }, classId: 0 },
  { id: 'guardian', names: ['Guardião', 'Guardião Real', 'Muralha Viva'], desc: 'Atrai inimigos e reduz o dano.', ability: 'Provocar', color: ['#9fcfff', '#568ccc'],
    use: ['1H_Sword', 'Rectangle_Shield'], stats: { Vida: 5, Força: 2, Rapidez: 2, Alcance: 1 }, hp: 300, dmg: 24, classId: 0 },
  { id: 'champion', names: ['Campeão', 'Campeão Real', 'Lâmina Solar'], desc: 'Gira e empurra os inimigos.', ability: 'Turbilhão', color: ['#ffe59b', '#c99a3e'],
    use: ['2H_Sword'], stats: { Vida: 4, Força: 5, Rapidez: 3, Alcance: 2 }, dmg: 36, idle: '2H_Melee_Idle', attacks: ['2H_Melee_Attack_Slice'], classId: 0 },
  { id: 'berserker', names: ['Berserker', 'Fera Rubra', 'Fúria Titã'], desc: 'Pouca vida, golpes mais rápidos.', ability: 'Fúria', color: ['#ffb2b2', '#ce5f63'],
    use: ['1H_Axe', '1H_Axe_Offhand'], stats: { Vida: 5, Força: 4, Rapidez: 4, Alcance: 1 }, cooldown: 0.9, cleave: 0, attacks: ['Dualwield_Melee_Attack_Slice'], classId: 1 },
  { id: 'crusher', names: ['Esmagador', 'Quebra-rochas', 'Abala-terra'], desc: 'Pancada que deixa todos zonzos.', ability: 'Terremoto', color: ['#ffbf8a', '#d88950'],
    use: ['2H_Axe'], stats: { Vida: 5, Força: 5, Rapidez: 2, Alcance: 2 }, classId: 1 },
  { id: 'viking', names: ['Viking', 'Jarl Valente', 'Rei do Norte'], desc: 'Arremessa um machado à distância.', ability: 'Machado voador', color: ['#b8dfe5', '#5b9dab'],
    use: ['1H_Axe', 'Barbarian_Round_Shield'], stats: { Vida: 5, Força: 4, Rapidez: 3, Alcance: 3 }, cleave: 0, idle: 'Idle', attacks: ['1H_Melee_Attack_Chop'], classId: 1 },
  { id: 'pyro', names: ['Piromante', 'Chama Viva', 'Fênix Solar'], desc: 'Bolas de fogo deixam chamas no chão.', ability: 'Chão em chamas', color: ['#ffc6a4', '#dc8757'],
    use: ['2H_Staff'], stats: { Vida: 2, Força: 5, Rapidez: 2, Alcance: 5 }, classId: 2 },
  { id: 'arcane', names: ['Arcano', 'Sábio Astral', 'Mestre Estelar'], desc: 'Um raio salta entre os inimigos.', ability: 'Raio em cadeia', color: ['#d4b3ff', '#9a6be0'],
    use: ['Spellbook_open', '1H_Wand'], stats: { Vida: 2, Força: 4, Rapidez: 3, Alcance: 5 }, classId: 2 },
  { id: 'cryo', names: ['Criomante', 'Sábio Glacial', 'Coração Polar'], desc: 'Gelo deixa os esqueletos lentinhos.', ability: 'Onda de gelo', color: ['#b9efff', '#58aaca'],
    use: ['1H_Wand'], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 5 }, classId: 2 },
  { id: 'assassin', names: ['Assassino', 'Sombra Ágil', 'Sombra Real'], desc: 'Golpes críticos e esquivas ligeiras.', ability: 'Passo das sombras', color: ['#d1b7df', '#9974b5'],
    use: ['Knife', 'Knife_Offhand'], stats: { Vida: 3, Força: 4, Rapidez: 5, Alcance: 1 }, classId: 3 },
  { id: 'crossbow', names: ['Besteiro', 'Mira de Águia', 'Flecha Real'], desc: 'Virotes atravessam a fila.', ability: 'Tiro perfurante', color: ['#c9eaa4', '#84ac50'],
    use: ['2H_Crossbow'], stats: { Vida: 3, Força: 4, Rapidez: 3, Alcance: 5 }, ranged: true, range: 7, cooldown: 1.05, attacks: ['2H_Ranged_Shoot'], classId: 3 },
  { id: 'ninja', names: ['Ninja', 'Vento Noturno', 'Lua Silenciosa'], desc: 'Lança três adagas em leque.', ability: 'Leque de adagas', color: ['#b6c5f4', '#768ac6'],
    use: ['Knife', 'Throwable'], stats: { Vida: 3, Força: 3, Rapidez: 5, Alcance: 4 }, model: 'Rogue_Hooded', classId: 3 },
].map((v) => ({ ...HEROES[v.classId], ...v, name: v.names[0],
  hide: HEROES[v.classId].weapons.filter((w) => !v.use.includes(w)),
}));
const XP_LEVELS = [0, 90, 350];   // XP acumulado para Nv2 e Nv3

const SKELETONS = {
  Minion:  { hp: 36, dmg: 6,  range: 1.3, speed: 1.6, cooldown: 1.4, weapon: 'Skeleton_Blade' },
  Warrior: { hp: 80, dmg: 11, range: 1.4, speed: 1.3, cooldown: 1.6, weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Small_A' },
  Rogue:   { hp: 30, dmg: 8,  range: 1.3, speed: 2.3, cooldown: 1.1, weapon: 'Skeleton_Blade', move: 'Running_C' },
};

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

scene.add(new THREE.HemisphereLight(0xfff4dc, 0xa89868, 1.8));   // sombras mais suaves
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
$('restart').onclick = () => startGame();
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

// tela de escolha estilo arcade: cartões com retrato, atributos e navegação pelo teclado
const pick = { options: [], cards: [], variants: [0, 0, 0, 0], sel: 0, open: false, timer: null };

function showPick(title, sub) {
  const owned = heroes().map((h) => h.cfg.classId);
  pick.options = HEROES.map((_, i) => i).filter((i) => !owned.includes(i));
  $('pickTitle').textContent = title;
  $('pickSub').textContent = sub;
  const list = $('pickList');
  list.innerHTML = '';
  pick.cards = pick.options.map((classId, i) => {
    const b = document.createElement('div');
    b.className = 'card';
    b.style.setProperty('--d', `${i * 90}ms`);
    b.onmouseenter = () => selectCard(i);
    list.appendChild(b);
    return b;
  });
  pick.cards.forEach((_, i) => renderCard(i));
  selectCard(0);
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

function pickConfig(i) {
  const classId = pick.options[i];
  return VARIANTS[classId * 3 + pick.variants[classId]];
}

function renderCard(i) {
  const cfg = pickConfig(i), b = pick.cards[i];
  b.style.setProperty('--c', cfg.color[0]);
  b.style.setProperty('--cd', cfg.color[1]);
  const stats = Object.entries(cfg.stats).map(([label, n]) =>
    `<span>${label}</span><div class="pips${label === 'Vida' ? ' hearts' : ''}">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</div>`).join('');
  b.innerHTML = `<div class="num">${i + 1}</div><span>${HEROES[cfg.classId].name}</span>
    <button class="pick-hero" aria-label="Escolher ${cfg.name}"><div class="portrait"><img src="${cfg.portrait}" alt=""></div><div class="ribbon">${cfg.name}</div></button>
    <div class="variant-nav"><button aria-label="Variante anterior">‹</button><span>${pick.variants[cfg.classId] + 1} / 3</span><button aria-label="Próxima variante">›</button></div>
    <p>${cfg.desc}</p><strong class="ability">${cfg.ability}</strong><div class="stats">${stats}</div>`;
  b.querySelector('.pick-hero').onclick = () => confirmPick(i);
  const arrows = b.querySelectorAll('.variant-nav button');
  arrows[0].onclick = () => changeVariant(i, -1);
  arrows[1].onclick = () => changeVariant(i, 1);
}

function changeVariant(i, step) {
  if (!pick.open) return;
  const classId = pick.options[i];
  pick.variants[classId] = (pick.variants[classId] + step + 3) % 3;
  renderCard(i);
  selectCard(i);
}

function selectCard(i) {
  pick.sel = (i + pick.cards.length) % pick.cards.length;
  pick.cards.forEach((c, k) => c.classList.toggle('sel', k === pick.sel));
}

function confirmPick(i) {
  if (!pick.open) return;
  pick.open = false;
  const cfg = pickConfig(i);
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
    const h = new Hero(cfg);
    h.busy = h.once('Cheer') * 0.6;
    if (heroes().length > 1) showBanner(`${cfg.name} entrou no grupo!`);
    game.paused = false;
  }, 550);
}

addEventListener('keydown', (e) => {
  if (!pick.open) return;
  if (e.key === 'ArrowLeft') selectCard(pick.sel - 1);
  else if (e.key === 'ArrowRight') selectCard(pick.sel + 1);
  else if (e.key === 'ArrowUp') changeVariant(pick.sel, -1);
  else if (e.key === 'ArrowDown') changeVariant(pick.sel, 1);
  else if (e.key === 'Enter' || e.key === ' ') confirmPick(pick.sel);
  else if (/^[1-4]$/.test(e.key) && +e.key <= pick.cards.length) confirmPick(+e.key - 1);
  else return;
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
    const model = SkeletonUtils.clone(assets[cfg.model].scene);
    model.traverse((o) => { if (cfg.hide.includes(o.name)) o.visible = false; });
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(THREE.AnimationClip.findByName(assets[cfg.model].animations, cfg.idle)).play();
    mixer.update(0.4);
    sc.add(model);
    r.render(sc, cam);
    cfg.portrait = r.domElement.toDataURL();
    sc.remove(model);
  }
  r.dispose();
}

// ---------- carregamento ----------
const loader = new GLTFLoader();
const load = (file) => loader.loadAsync(`assets/${file}`);
const assets = {};

async function loadAssets() {
  const files = [...new Set(VARIANTS.map((h) => `${h.model}.glb`)), 'Skeleton_Minion.glb', 'Skeleton_Warrior.glb', 'Skeleton_Rogue.glb', 'Skeleton_Blade.gltf', 'Skeleton_Axe.gltf', 'Skeleton_Shield_Small_A.gltf'];
  let done = 0;
  const results = await Promise.all(files.map((f) => load(f).then((g) => {
    $('overlayText').textContent = `Carregando modelos... ${++done}/${files.length}`;
    return g;
  })));
  files.forEach((f, i) => (assets[f.replace(/\.(glb|gltf)$/, '')] = results[i]));
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
    this.vel.lerp(dir.multiplyScalar(this.speed * slow * (this.slowT > 0 ? 0.5 : 1)), Math.min(1, dt * 7));
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
    if (!this.ranged) this.vel.add(tmp.subVectors(target.pos, this.pos).setY(0).normalize().multiplyScalar(2.2));   // passo à frente
  }

  takeDamage(n, from, owner = null, critical = false) {
    if (this.dead) return;
    if (this.team === 'hero') {
      if (this.cfg.id === 'assassin' && this.dodgeTimer <= 0) {
        this.dodgeTimer = 7 - this.level;
        this.busy = this.once(Math.random() < 0.5 ? 'Dodge_Left' : 'Dodge_Right', 1.5);
        this.pendingHit = null;
        popText(this.pos, 'Esquiva!', 'heal');
        return;
      }
      if (this.guardT > 0) n *= 0.6;
    }
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
    if (!this.pendingHit && !this.boss) { this.busy = this.once(this.team === 'hero' ? 'Hit_A' : 'Hit_B', 1.6) * 0.8; }
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.pendingHit = null;
    this.once(this.team === 'hero' ? 'Death_A' : 'Death_C_Skeletons');
    this.deadTime = 0;
    this.bar.style.display = 'none';
    if (this.team === 'skeleton') {
      game.kills++;
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
    if (!this.dead) this.pos.addScaledVector(this.vel, dt);
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
    if (this.pendingHit) {
      this.pendingHit.t -= dt;
      if (this.pendingHit.t <= 0) {
        const { target, effect } = this.pendingHit;
        this.pendingHit = null;
        if (effect) effect();
        else if (this.ranged && !target.dead) fireBolt(this, target, this.cfg.id === 'crossbow' ? 'crossbow' : 'magic');
        else if (this.cleave) damageArea(this.pos, this.range + this.cleave, this.dmg, this);
        else if (!target.dead && target.pos.distanceTo(this.pos) <= this.range + 0.6 * target.size) this.team === 'hero' ? heroHit(this, target, this.dmg) : target.takeDamage(this.dmg, this.pos);
      }
    }
  }
}

const skeletonsAlive = () => units.filter((u) => u.team === 'skeleton' && !u.dead);
const heroes = () => units.filter((u) => u.team === 'hero');

function damageArea(center, radius, dmg, owner = null) {
  for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(center) <= radius + 0.4 * (s.size - 1)) {
    if (owner) heroHit(owner, s, dmg, center);
    else s.takeDamage(dmg, center);
  }
}

function heroHit(owner, target, dmg, center = owner.pos) {
  const critical = owner.cfg.id === 'assassin' && Math.random() < 0.25 + (owner.level - 1) * 0.05;
  target.takeDamage(dmg * (critical ? 2 : 1), center, owner, critical);
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
const colors = { pyro: 0xff883d, cryo: 0x8be8ff, arcane: 0xc999ff, viking: 0xd6e9ef, crossbow: 0xffed9e, ninja: 0xc7d0ff };
const boltMats = Object.fromEntries(Object.entries(colors).map(([k, color]) => [k, new THREE.MeshBasicMaterial({ color })]));
const goldMat = new THREE.MeshBasicMaterial({ color: 0xffdf70 });

function ring(at, radius, color, life = 0.6) {
  const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(at).setY(0.07);
  mesh.scale.setScalar(radius);
  scene.add(mesh);
  blasts.push({ mesh, t: life, life });
}

function beam(start, end, color) {
  const mesh = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
  const dir = new THREE.Vector3().subVectors(end, start);
  mesh.position.copy(start).add(end).multiplyScalar(0.5).setY(1.3);
  mesh.scale.y = dir.length();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  scene.add(mesh);
  blasts.push({ mesh, t: 0.25, life: 0.25 });
}

function fireBolt(from, target, kind = 'magic', angle = 0) {
  const mesh = new THREE.Mesh(kind === 'viking' ? axeGeo : kind === 'crossbow' || kind === 'ninja' ? bladeGeo : boltGeo, boltMats[kind] || boltMats[from.cfg.id] || boltMats.arcane);
  if (kind === 'viking') {
    const handle = new THREE.Mesh(handleGeo, boltMats.viking);
    handle.position.y = -0.25;
    mesh.add(handle);
  }
  mesh.position.copy(from.pos).setY(1.3);
  const dir = new THREE.Vector3().subVectors(target.pos, from.pos).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(mesh);
  bolts.push({ mesh, target, owner: from, kind, dir, hit: new Set(), life: 1, dmg: from.dmg, level: from.level });
}

function updateBolts(dt) {
  if (dt <= 0) return;
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.life -= dt;
    const piercing = b.kind === 'crossbow' || b.kind === 'ninja';
    if (piercing) {
      const step = 18 * dt, start = b.mesh.position.clone().setY(0);
      b.mesh.position.addScaledVector(b.dir, step);
      for (const s of skeletonsAlive()) {
        if (s.spawning || b.hit.has(s)) continue;
        const offset = new THREE.Vector3().subVectors(s.pos, start);
        const along = THREE.MathUtils.clamp(offset.dot(b.dir), 0, step);
        if (offset.addScaledVector(b.dir, -along).length() > 0.45 * s.size) continue;
        heroHit(b.owner, s, b.dmg);
        b.hit.add(s);
        if (b.kind === 'ninja') { b.life = 0; break; }
      }
    } else {
      const goal = b.target.pos.clone().setY(1.1);
      const d = goal.distanceTo(b.mesh.position);
      b.mesh.position.lerp(goal, Math.min(1, 14 * dt / Math.max(d, 0.001)));
      if (d <= 14 * dt + 0.25) {
        const radius = b.kind === 'magic' ? b.owner.cfg.splash || 0 : b.kind === 'viking' ? 0 : 1.5 + (b.level - 1) * 0.3;
        if (radius) damageArea(b.target.pos, radius, b.dmg, b.owner);
        else if (!b.target.dead) heroHit(b.owner, b.target, b.dmg * (b.kind === 'viking' ? 1.8 : 1));
        if (b.kind === 'pyro') {
          const mesh = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({ color: 0xff702e, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false }));
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.copy(b.target.pos).setY(0.06);
          mesh.scale.setScalar(radius);
          for (let k = 0; k < 5; k++) {
            const flame = new THREE.Mesh(flameGeo, boltMats.pyro);
            const a = k * Math.PI * 2 / 5;
            flame.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.18);
            flame.rotation.x = Math.PI / 2;
            mesh.add(flame);
          }
          scene.add(mesh);
          flames.push({ mesh, radius, owner: b.owner, dmg: b.dmg * 0.35, t: 3 + b.level, tick: 0 });
        }
        if (b.kind === 'cryo') for (const s of skeletonsAlive()) if (s.pos.distanceTo(b.target.pos) <= radius) s.slowT = 3 + (b.level - 1) * 0.5;
        ring(b.target.pos, Math.max(0.5, radius), colors[b.kind] || 0xc999ff);
        b.life = 0;
      }
    }
    if (b.kind === 'viking') b.mesh.rotateZ(dt * 18);
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
    bl.mesh.material.opacity = Math.max(0, bl.t / bl.life) * 0.65;
    if (bl.t <= 0) { scene.remove(bl.mesh); bl.mesh.material.dispose(); blasts.splice(i, 1); }
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
    m.position.set(at.x + Math.cos(a) * 0.3, 0.4 + Math.random() * 0.5, at.z + Math.sin(a) * 0.3);
    m.userData = { v: new THREE.Vector3(Math.cos(a) * 1.8, 0.8 + Math.random(), Math.sin(a) * 1.8), t: 0, life: 0.6, grow: size };
    scene.add(m);
    fx.push(m);
  }
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true }));
    m.position.set(at.x, 1, at.z);
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
  tmp.copy(at).setY(2.5).project(camera);
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
    super(assets[cfg.model], cfg, 'hero');
    this.cfg = cfg;
    this.level = 1;
    this.xp = 0;
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
      this.maxHp = Math.round(this.cfg.hp * (1 + (this.level - 1) * 0.25));
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp - oldHp);
      this.dmg = this.cfg.dmg * (1 + (this.level - 1) * 0.22);
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
    const radius = 3 + (level - 1) * 0.5;
    const nearby = skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) <= radius);
    let anim = 'Spellcast_Raise', effect;
    if (id === 'paladin') {
      const friends = heroes().filter((h) => !h.dead && h.hp < h.maxHp && h.pos.distanceTo(this.pos) <= 5 + level);
      if (!friends.length) return false;
      effect = () => {
        for (const h of friends) if (!h.dead && h.pos.distanceTo(this.pos) <= 5 + level) {
          const heal = Math.min(h.maxHp - h.hp, 32 + level * 10);
          h.hp += heal;
          popText(h.pos, '+' + Math.round(heal), 'heal');
        }
        ring(this.pos, 5 + level, 0x6eea90, 1);
      };
    } else if (id === 'guardian') {
      if (!nearby.length) return false;
      anim = 'Block';
      effect = () => {
        this.guardT = 4 + (level - 1);
        for (const s of nearby) if (!s.dead) { s.taunt = this; s.tauntT = this.guardT; s.pendingHit = null; }
        ring(this.pos, radius, this.cfg.color[0], 1);
      };
    } else if (id === 'champion' || id === 'crusher') {
      if (!nearby.length) return false;
      anim = id === 'champion' ? '2H_Melee_Attack_Spin' : '2H_Melee_Attack_Chop';
      effect = () => {
        for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(this.pos) <= radius) {
          heroHit(this, s, this.dmg * 1.3);
          if (id === 'champion') s.vel.add(new THREE.Vector3().subVectors(s.pos, this.pos).setY(0).normalize().multiplyScalar(6 + level));
          else { s.stunT = 1.5 + (level - 1) * 0.25; s.pendingHit = null; s.vel.set(0, 0, 0); }
        }
        ring(this.pos, radius, this.cfg.color[0]);
      };
    } else if (id === 'viking') {
      target = nearest(this.pos, skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) > 2 && s.pos.distanceTo(this.pos) < 9));
      if (!target) return false;
      anim = 'Throw';
      effect = () => fireBolt(this, target, 'viking');
    } else if (id === 'arcane') {
      if (!target || target.pos.distanceTo(this.pos) > this.range) return false;
      anim = 'Spellcast_Shoot';
      effect = () => {
        let at = this.pos;
        const hit = new Set();
        let next = target;
        for (let i = 0; i < 3 + (level - 1); i++) {
          if (!next || next.dead) break;
          beam(at, next.pos, colors.arcane);
          hit.add(next);
          heroHit(this, next, this.dmg * 1.15);
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
    } else return false;
    this.face(target ? target.pos : this.pos.clone().add(this.fwd), 1);
    this.busy = this.once(anim, 1.4);
    this.pendingHit = { target, effect, t: this.busy * 0.4 };
    this.skillTimer = (id === 'paladin' ? 8 : id === 'guardian' ? 9 : 6) - (level - 1) * 0.7;
    return true;
  }

  // posição na formação em volta do ponto "s" da estrada
  setAnchor(s) {
    this.fwd.copy(world.tangentAt(s));
    const side = world.sideOf(this.fwd);
    const [px, pz] = this.cfg.post;
    this.post.copy(world.pointAt(s)).addScaledVector(side, px).addScaledVector(this.fwd, -pz);
  }

  revive() {
    this.dead = false;
    this.aura.visible = this.level > 1;
    this.halo.visible = this.level === 3;
    this.guardT = 0;
    this.hp = this.maxHp * 0.4;
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
    this.age += dt;
    const rage = !this.dead && this.cfg.id === 'berserker' && this.hp < this.maxHp * 0.5;
    this.cooldown = this.cfg.cooldown / (1 + (this.level - 1) * 0.15) / (rage ? 1.6 + (this.level - 1) * 0.15 : 1);
    this.aura.visible = !this.dead && (this.level > 1 || rage || this.guardT > 0);
    this.aura.material.color.set(rage ? 0xff4242 : this.cfg.color[1]);
    this.aura.scale.setScalar(0.8 + Math.sin(this.age * 4) * 0.06);
    this.halo.position.y = 2.5 + Math.sin(this.age * 3) * 0.08;
    this.updateCommon(dt);
    if (this.dead || this.busy > 0 || game.over) return;
    const target = game.state === 'fight' ? nearest(this.pos, skeletonsAlive().filter((u) => !u.spawning)) : null;
    if (game.state === 'fight' && this.skillTimer <= 0 && this.useSkill(target)) return;
    const engage = target && target.pos.distanceTo(this.post) < LEASH + this.range;
    if (engage) {
      const d = target.pos.distanceTo(this.pos) - 0.4 * (target.size - 1);
      if (d > this.range) this.moveTo(target.pos, dt);
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

class Skeleton extends Unit {
  constructor(type, phase, boss = false) {
    const base = SKELETONS[type];
    const hpScale = (1 + (phase - 1) * 0.12) * (boss ? 9 : 1);
    const dmgScale = (1 + (phase - 1) * 0.06) * (boss ? 2.5 : 1);
    super(assets[`Skeleton_${type}`], { ...base, hp: Math.round(base.hp * hpScale), dmg: Math.round(base.dmg * dmgScale), speed: base.speed * (boss ? 0.8 : 1) }, 'skeleton');
    this.boss = boss;
    this.stunT = 0;
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
    this.stunT = Math.max(0, this.stunT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.tauntT -= dt;
    if (this.stunT > 0) { this.pendingHit = null; this.vel.set(0, 0, 0); }
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
    const target = this.tauntT > 0 && this.taunt && !this.taunt.dead ? this.taunt : nearest(this.pos, heroes());
    if (target) {
      const d = target.pos.distanceTo(this.pos);
      if (d > this.range) this.moveTo(target.pos, dt);
      else if (this.face(target.pos, dt) < 0.5 && this.attackTimer <= 0) this.attack(target, '1H_Melee_Attack_Chop');
    }
    if (this.busy <= 0) this.locomote(this.move, 'Walking_D_Skeletons', 'Idle_Combat');
  }
}

// empurra unidades sobrepostas e desvia dos obstáculos
function separate() {
  const alive = units.filter((u) => !u.dead);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i].pos, b = alive[j].pos;
      const min = 0.45 * (alive[i].size + alive[j].size);
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 0 && d < min) {
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
}

// ---------- fases ----------
// state: 'fight' (onda) -> 'cleared' (comemoração + escolha de herói) -> 'advance' (sobe a estrada) -> 'fight'
const game = { phase: 1, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0, guideS: 0, over: false, paused: false };

function startGame() {
  clearTimeout(pick.timer);
  clearTimeout(showBanner.t);
  $('banner').style.opacity = 0;
  pick.open = false;
  pick.variants.fill(0);
  for (const list of [bolts, blasts, flames]) while (list.length) {
    const effect = list.pop();
    scene.remove(effect.mesh);
    if (list !== bolts) effect.mesh.material.dispose();
  }
  while (fx.length) { const m = fx.pop(); scene.remove(m); m.material.dispose(); }
  bars.querySelectorAll('.pop').forEach((el) => el.remove());
  while (units.length) units[0].remove();
  Object.assign(game, { phase: 1, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0, guideS: world.anchorS(1), over: false });
  const start = world.pointAt(game.guideS);
  follow.set(start.x, 0, start.z - 3);
  controls.target.copy(follow);
  camera.position.set(follow.x, 23, follow.z + 21);
  $('overlay').classList.add('hidden');
  showPick('Escolha seu herói', 'Ele vai liderar o grupo contra os esqueletos');
}

function startPhase() {
  game.state = 'fight';
  game.toSpawn = 2 + game.phase * 2;
  game.bossPending = game.phase % 6 === 0;
  game.spawnTimer = 0.5;
  showBanner(game.bossPending ? `Fase ${game.phase}: chefe!` : `Fase ${game.phase}`);
}

function spawnSkeleton() {
  const p = game.phase;
  let type = 'Minion', boss = false;
  if (game.bossPending && game.toSpawn === 1) { type = 'Warrior'; boss = true; }
  else {
    const r = Math.random();
    const rogue = Math.min(0.3, 0.04 * p), warrior = Math.min(0.4, 0.06 * p);
    type = r < rogue ? 'Rogue' : r < rogue + warrior ? 'Warrior' : 'Minion';
  }
  const s = new Skeleton(type, p, boss);
  const s0 = world.anchorS(p);
  const behind = p >= 4 && !boss && Math.random() < 0.25;   // nas fases mais altas, alguns vêm por trás
  for (let tries = 0; tries < 12; tries++) {
    const at = behind ? s0 - 9 - Math.random() * 3 : s0 + 11 + Math.random() * 6;
    s.pos.copy(world.along(at, (Math.random() * 2 - 1) * (ROAD - 1)));
    if (!world.obstacles.some((o) => Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < o.r + 0.8)) break;
  }
  const c = world.pointAt(s0);
  s.root.rotation.y = Math.atan2(c.x - s.pos.x, c.z - s.pos.z);   // de frente para os heróis
}

function updateGame(dt) {
  if (game.over || game.paused) return;
  const alive = heroes().filter((h) => !h.dead);
  const skeletons = skeletonsAlive();

  if (!alive.length) return endGame(`Os esqueletos venceram na fase ${game.phase}. Abates: ${game.kills}`);

  if (game.state === 'fight') {
    if (game.toSpawn > 0) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) { spawnSkeleton(); game.toSpawn--; game.spawnTimer = Math.max(0.3, 1.0 - game.phase * 0.05); }
    } else if (!skeletons.length) {
      showBanner(`Fase ${game.phase} vencida!`, 2.5);
      for (const h of heroes()) {
        if (h.dead) h.revive();
        else h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.35);
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
      if (game.phase >= PHASES) return endGame(`Vitória! O grupo chegou ao castelo. Abates: ${game.kills}`);
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

function endGame(text) {
  game.over = true;
  $('overlayText').textContent = text;
  $('overlayBtn').hidden = false;
  $('overlay').classList.remove('hidden');
}

function updateBars() {
  const w = innerWidth / 2, h = innerHeight / 2;
  for (const u of units) {
    if (u.dead) continue;
    tmp.copy(u.pos).setY(2.6 * u.size).project(camera);
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
  const dt = game.paused || game.over ? 0 : real * speed;
  for (const u of [...units]) u.update(dt);
  if (dt > 0) separate();
  updateBolts(dt);
  updateFx(dt);
  updateGame(dt);
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
  world.update(real);
  controls.update();
  renderer.render(scene, camera);
  updateBars();
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await loadAssets();
renderPortraits();
startGame();
frame();
