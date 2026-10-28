import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createWorld } from './world.js';

const ROAD = 5;             // metade da largura da estrada
const PHASES = 12;          // a última fase fica no topo, no castelo
const LEASH = 5;            // quanto o herói se afasta do posto para lutar
const MARCH = 2.4;          // velocidade do grupo andando pela estrada entre as fases

// cada herói usa um modelo diferente; "hide" esconde as armas que não usa.
// "post" é a posição na formação: [lado, frente(-)/trás(+)]
const HEROES = [
  { name: 'Cavaleiro', desc: 'Espada e escudo. Equilibrado.', stats: { Vida: 4, Força: 3, Rapidez: 3, Alcance: 1 }, color: ['#8ec5ff', '#4f8fd6'], model: 'Knight', post: [0, -0.8], hp: 240, dmg: 30, range: 1.5, speed: 3.2, cooldown: 0.85, idle: 'Idle',
    hide: ['1H_Sword_Offhand', '2H_Sword', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield'],
    attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'] },
  { name: 'Bárbaro', desc: 'Machado pesado. Acerta vários de uma vez.', stats: { Vida: 5, Força: 5, Rapidez: 2, Alcance: 2 }, color: ['#ffbf8a', '#e8803f'], model: 'Barbarian', post: [-1.7, -0.3], hp: 260, dmg: 34, range: 1.7, speed: 2.8, cooldown: 1.4, idle: '2H_Melee_Idle', cleave: 1.2,
    hide: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug'],
    attacks: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin'] },
  { name: 'Mago', desc: 'Bolas de magia de longe que explodem.', stats: { Vida: 2, Força: 4, Rapidez: 2, Alcance: 5 }, color: ['#d4b3ff', '#9a6be0'], model: 'Mage', post: [0, 1.4], hp: 150, dmg: 28, range: 7, speed: 2.6, cooldown: 1.3, idle: 'Idle', ranged: true, splash: 1.4,
    hide: ['Spellbook', 'Spellbook_open', '1H_Wand'],
    attacks: ['Spellcast_Shoot'] },
  { name: 'Ladino', desc: 'Duas facas. O mais rápido.', stats: { Vida: 3, Força: 3, Rapidez: 5, Alcance: 1 }, color: ['#9fe39a', '#4fb24a'], model: 'Rogue', post: [1.7, -0.3], hp: 180, dmg: 18, range: 1.4, speed: 4, cooldown: 0.55, idle: 'Idle',
    hide: ['1H_Crossbow', '2H_Crossbow', 'Throwable'],
    attacks: ['Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab'] },
];
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
const pick = { options: [], cards: [], sel: 0, open: false };

function showPick(title, sub) {
  const owned = heroes().map((h) => h.cfg);
  pick.options = HEROES.filter((h) => !owned.includes(h));
  $('pickTitle').textContent = title;
  $('pickSub').textContent = sub;
  const list = $('pickList');
  list.innerHTML = '';
  pick.cards = pick.options.map((cfg, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.style.setProperty('--d', `${i * 90}ms`);
    b.style.setProperty('--c', cfg.color[0]);
    b.style.setProperty('--cd', cfg.color[1]);
    const stats = Object.entries(cfg.stats).map(([label, n]) =>
      `<span>${label}</span><div class="pips${label === 'Vida' ? ' hearts' : ''}">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</div>`).join('');
    b.innerHTML = `<div class="num">${i + 1}</div><div class="portrait"><img src="${cfg.portrait}" alt=""></div>
      <div class="ribbon">${cfg.name}</div><p>${cfg.desc}</p><div class="stats">${stats}</div>`;
    b.onmouseenter = () => selectCard(i);
    b.onclick = () => confirmPick(i);
    list.appendChild(b);
    return b;
  });
  selectCard(0);
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

function selectCard(i) {
  pick.sel = (i + pick.cards.length) % pick.cards.length;
  pick.cards.forEach((c, k) => c.classList.toggle('sel', k === pick.sel));
}

function confirmPick(i) {
  if (!pick.open) return;
  pick.open = false;
  const cfg = pick.options[i];
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
  setTimeout(() => {
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
  for (const cfg of HEROES) {
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
  const files = [...HEROES.map((h) => `${h.model}.glb`), 'Skeleton_Minion.glb', 'Skeleton_Warrior.glb', 'Skeleton_Rogue.glb', 'Skeleton_Blade.gltf', 'Skeleton_Axe.gltf', 'Skeleton_Shield_Small_A.gltf'];
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
    this.vel.lerp(dir.multiplyScalar(this.speed * slow), Math.min(1, dt * 7));
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
    const dur = this.once(name, 1.3);
    this.busy = dur * 0.9;
    this.attackTimer = this.cooldown;
    this.pendingHit = { target, t: dur * 0.4 };
    if (!this.ranged) this.vel.add(tmp.subVectors(target.pos, this.pos).setY(0).normalize().multiplyScalar(2.2));   // passo à frente
  }

  takeDamage(n, from) {
    if (this.dead) return;
    this.hp -= n;
    this.flash = 0.14;
    this.squashT = 0.25;
    popText(this.pos, Math.round(n), this.team === 'hero' ? 'hurt' : 'dmg');
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
    if (this.team === 'skeleton') game.kills++;
  }

  remove() {
    scene.remove(this.root);
    this.bar.remove();
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
        const { target } = this.pendingHit;
        this.pendingHit = null;
        if (this.ranged) fireBolt(this, target);
        else if (this.cleave) damageArea(this.pos, this.range + this.cleave, this.dmg);
        else if (!target.dead && target.pos.distanceTo(this.pos) <= this.range + 0.6 * target.size) target.takeDamage(this.dmg, this.pos);
      }
    }
  }
}

const skeletonsAlive = () => units.filter((u) => u.team === 'skeleton' && !u.dead);
const heroes = () => units.filter((u) => u.team === 'hero');

function damageArea(center, radius, dmg) {
  for (const s of skeletonsAlive()) if (s.pos.distanceTo(center) <= radius + 0.4 * (s.size - 1)) s.takeDamage(dmg, center);
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

// bola de magia do mago: voa até o alvo e explode, acertando quem estiver perto
const bolts = [];
const boltGeo = new THREE.SphereGeometry(0.2, 10, 10);
const boltMat = new THREE.MeshBasicMaterial({ color: 0xb06cff });
const blastGeo = new THREE.SphereGeometry(1, 14, 10);

function fireBolt(from, target) {
  const mesh = new THREE.Mesh(boltGeo, boltMat);
  mesh.position.copy(from.pos).setY(1.4);
  scene.add(mesh);
  bolts.push({ mesh, target, dmg: from.dmg, splash: from.cfg.splash });
}

const blasts = [];
function updateBolts(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    tmp.copy(b.target.pos).setY(1);
    const d = tmp.distanceTo(b.mesh.position);
    if (b.target.dead || d < 0.3) {
      damageArea(b.target.pos, b.splash, b.dmg);
      const blast = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color: 0xc58cff, transparent: true, opacity: 0.6 }));
      blast.position.copy(b.mesh.position);
      blast.userData.t = 0;
      scene.add(blast);
      blasts.push(blast);
      scene.remove(b.mesh);
      bolts.splice(i, 1);
      continue;
    }
    b.mesh.position.add(tmp.sub(b.mesh.position).multiplyScalar(Math.min(1, (14 * dt) / d)));
  }
  for (let i = blasts.length - 1; i >= 0; i--) {
    const bl = blasts[i];
    bl.userData.t += dt;
    bl.scale.setScalar(0.3 + bl.userData.t * 4);
    bl.material.opacity = 0.6 - bl.userData.t * 2;
    if (bl.material.opacity <= 0) { scene.remove(bl); bl.material.dispose(); blasts.splice(i, 1); }
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

  // posição na formação em volta do ponto "s" da estrada
  setAnchor(s) {
    this.fwd.copy(world.tangentAt(s));
    const side = world.sideOf(this.fwd);
    const [px, pz] = this.cfg.post;
    this.post.copy(world.pointAt(s)).addScaledVector(side, px).addScaledVector(this.fwd, -pz);
  }

  revive() {
    this.dead = false;
    this.hp = this.maxHp * 0.4;
    this.bar.style.display = '';
    this.current = null;
    this.mixer.stopAllAction();
    this.loop(this.cfg.idle);
  }

  update(dt) {
    this.updateCommon(dt);
    if (this.dead || this.busy > 0) return;
    const target = game.state === 'fight' ? nearest(this.pos, skeletonsAlive().filter((u) => !u.spawning)) : null;
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
    this.updateCommon(dt);
    if (this.dead) {
      this.deadTime += dt;
      if (this.deadTime > 1) { poof(this.pos, this.size); this.remove(); }   // some numa nuvenzinha
      return;
    }
    if (this.busy > 0) return;
    this.spawning = false;
    const target = nearest(this.pos, heroes());
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
  while (units.length) units[0].remove();
  while (bolts.length) scene.remove(bolts.pop().mesh);
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
  const dt = game.paused ? 0 : real * speed;
  for (const u of [...units]) u.update(dt);
  separate();
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
