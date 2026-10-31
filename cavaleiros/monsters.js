// Novos esqueletos e chefes: visual montado com peças simples sobre os modelos KayKit e comportamento próprio.
// O main.js entrega o que precisa em linkMonsters (unidades, cena, efeitos), sem import circular.
import * as THREE from 'three';

const G = {};   // dependências vindas do main.js (game e difficulty são getters)
export function linkMonsters(api) { Object.defineProperties(G, Object.getOwnPropertyDescriptors(api)); }

// ---------- peças e materiais compartilhados (sem luzes extras) ----------
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
const MAT = {
  iron: lam(0x7d8ba3), ironDark: lam(0x3b4458), bone: lam(0xefe7d0), boneDark: lam(0xa89f8c), dark: lam(0x1d1a24),
  gold: lam(0xffcc33, { emissive: 0x6a4a00, emissiveIntensity: 0.45 }), ruby: lam(0xff3b4f, { emissive: 0x550010 }),
  robe: lam(0x3a1f5c, { side: THREE.DoubleSide, transparent: true, opacity: 0.88 }), bomb: lam(0x2b2833), fuse: lam(0x8a6a3c),
  spark: glowMat(0xffd23a), green: glowMat(0x7dff9a), purple: glowMat(0xc77dff), wisp: glowMat(0x9fe8ff, 0.35),
  hood: lam(0x2a0d12), blood: lam(0x8a1020), lance: lam(0x2e2a36), plume: lam(0xb0142c),
  teal: glowMat(0x5ff2ff), ward: glowMat(0x5ff2ff, 0.22), ember: glowMat(0xff8a2a, 0.45),
  // capítulo VII: dragão de ossos, escavador e porta-estandarte
  wyrm: glowMat(0x7dffd0), membrane: lam(0x2f4a46, { side: THREE.DoubleSide, transparent: true, opacity: 0.82 }),
  dirt: lam(0x7a5434), banner: lam(0x9a2230, { side: THREE.DoubleSide }), aura: glowMat(0xff8a3a, 0.5),
};
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), ball: new THREE.SphereGeometry(1, 14, 10), cone: new THREE.ConeGeometry(1, 1, 6),
  skirt: new THREE.ConeGeometry(1, 1, 12, 1, true), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), gem: new THREE.OctahedronGeometry(1, 0),
  disc: new THREE.CircleGeometry(1, 36), edge: new THREE.RingGeometry(0.92, 1, 48), strip: new THREE.PlaneGeometry(1, 1), torus: new THREE.TorusGeometry(1, 0.12, 6, 24),
};
const greenBolt = glowMat(0x6dff8c), purpleBolt = glowMat(0xb35cff), tealBolt = glowMat(0x5ff2ff);
// materiais compartilhados dos inimigos: a tela de carregamento compila os shaders antes da fase
export const MONSTER_MATERIALS = [...Object.values(MAT), greenBolt, purpleBolt, tealBolt];
const mV = new THREE.Vector3();
const hookPullTo = new THREE.Vector3(), hookPullNext = new THREE.Vector3();
const dangerRel = new THREE.Vector3(), dangerPerp = new THREE.Vector3(), dangerDestination = new THREE.Vector3();
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function piece(geo, mat, at = [0, 0, 0], size = 1, rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(at[0], at[1], at[2]);
  if (typeof size === 'number') m.scale.setScalar(size); else m.scale.set(size[0], size[1], size[2]);
  m.rotation.x = rot[0]; m.rotation.y = rot[1]; m.rotation.z = rot[2];
  m.castShadow = true;
  return m;
}
const boneOf = (s, name) => s.root.getObjectByName(name) || s.root;
const meshNamed = (s, end, fn) => s.root.traverse((o) => { if (o.isMesh && o.name.endsWith(end)) fn(o.material); });

// cor do corpo e brilho próprio (o main.js reaplica userData.glow quando o esqueleto não pisca)
function paint(s, color, eyes, glow = 0) {
  for (const m of s.mats) { m.color?.set(color); (m.userData ||= {}).glow = glow; }
  if (eyes) meshNamed(s, '_Eyes', (m) => { m.color.set(eyes); m.userData.glow = eyes; });
  G.markEmissiveDirty?.(s);
}
function nearestOf(from, list) {
  let best = null, bd = Infinity;
  for (const u of list) { if (u.dead) continue; const d = flat(u.pos, from); if (d < bd) { bd = d; best = u; } }
  return best;
}
const liveAllies = () => G.livingAllies?.() ?? G.allies().filter((u) => !u.dead);
function countAliveSkeletons(kind = null) {
  let count = 0;
  const units = G.units;
  if (Array.isArray(units)) {
    for (const unit of units) if (unit.team === 'skeleton' && !unit.dead && (!kind || unit.enemyKind === kind)) count++;
    return count;
  }
  for (const unit of G.skeletonsAlive()) if (!unit.dead && (!kind || unit.enemyKind === kind)) count++;
  return count;
}
const countOf = (kind) => countAliveSkeletons(kind);

// ---------- efeitos com tempo: avisos no chão, crânios caindo, derrubadas ----------
const mFx = [];
const mGraves = [];   // esqueletos caídos que o sacerdote pode reerguer
const mSeen = new Set();   // tipos já apresentados nesta partida
const mFxUnits = new Set();   // snapshot reutilizável para checar donos removidos sem varrer units por efeito
const mBossWarnings = new Set();   // avisos anunciados, sem rever todos os efeitos ao atualizar a barra
let ownedFxCount = 0;

function refreshFxUnits() {
  mFxUnits.clear();
  for (const unit of G.units || []) mFxUnits.add(unit);
}
function track(item) {
  item.alive = true;
  mFx.push(item);
  if (item.owner) {
    if (!ownedFxCount) refreshFxUnits();
    ownedFxCount++;
  }
  if (item.owner && item.warning && item.announce) mBossWarnings.add(item);
  return item;
}
function releaseFx(item) {
  item.alive = false;
  if (item.owner) ownedFxCount = Math.max(0, ownedFxCount - 1);
  if (item.owner?.telegraph === item) item.owner.telegraph = null;
  mBossWarnings.delete(item);
  disposeFx(item);
}
function disposeFx(f) {
  f.cleanup?.(f);   // peças presas em unidades (escudo de ossos) saem junto com o efeito
  for (const m of f.meshes || []) G.scene.remove(m);
  for (const m of f.mats || []) m.dispose();
}

// aviso que enche até o golpe; some sem golpear se o dono morrer ou ficar zonzo
// hole: anel (só machuca entre hole e radius; o centro fica seguro)
function warn(owner, at, radius, time, end, { color = 0xff3b30, line = null, harmless = false, follow = null, announce = '', notice = 0.6, hole = 0 } = {}) {
  const group = new THREE.Group();
  const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide });
  const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: line ? 0.22 : 0.9, depthWrite: false, side: THREE.DoubleSide });
  const flatRot = [-Math.PI / 2, 0, 0];
  const holeGeo = hole > 0 ? new THREE.RingGeometry(hole / radius, 1, 48) : null;
  const fill = piece(line ? GEO.strip : holeGeo || GEO.disc, fillMat, [0, 0.01, 0], holeGeo ? radius : 0.01, flatRot);
  const edge = line ? piece(GEO.strip, edgeMat, [0, 0, line.len / 2], [radius * 2, line.len, 1], flatRot) : piece(GEO.edge, edgeMat, [0, 0, 0], radius, flatRot);
  fill.castShadow = edge.castShadow = false;
  group.add(fill, edge);
  if (holeGeo) { const inner = piece(GEO.edge, edgeMat, [0, 0, 0], hole, flatRot); inner.castShadow = false; group.add(inner); }
  group.position.copy(at);
  group.position.y += 0.07;
  if (line) group.rotation.y = Math.atan2(line.dir.x, line.dir.z);
  G.scene.add(group);
  const effect = track({ owner, at: at.clone(), radius, line, announce: owner?.boss && !harmless ? announce : '', harmless: harmless || !!follow, interruptible: !harmless, warning: true, t: time, life: time, meshes: [group], mats: [fillMat, edgeMat], dodge: new Map(), notice, end, hole,
    cleanup: holeGeo ? () => holeGeo.dispose?.() : undefined,
    step(f) {
      const k = 1 - Math.max(0, f.t) / f.life;
      if (follow && !follow.dead) { f.at.copy(follow.pos); group.position.copy(follow.pos); group.position.y += 0.07; }
      if (line) { fill.scale.set(radius * 2, Math.max(0.01, line.len * k), 1); fill.position.z = (line.len * k) / 2; }
      else if (!holeGeo) fill.scale.setScalar(Math.max(0.01, radius * k));
      fillMat.opacity = 0.25 + 0.25 * k;
    } });
  if (owner?.boss && effect.interruptible) owner.telegraph = effect;
  return effect;
}

// herói dentro de um aviso: devolve para onde correr (cada herói percebe ou não, uma vez por aviso)
export function dangerAt(u) {
  for (const f of mFx) {
    if (!f.warning || f.harmless || f.t < 0.2) continue;
    if (!f.dodge.has(u)) f.dodge.set(u, Math.random() < f.notice);
    if (!f.dodge.get(u)) continue;
    const rel = dangerRel.subVectors(u.pos, f.at).setY(0);
    if (f.line) {
      const along = rel.dot(f.line.dir), side = rel.x * f.line.dir.z - rel.z * f.line.dir.x;
      if (along < -0.5 || along > f.line.len + 0.5 || Math.abs(side) > f.radius + 0.4) continue;
      const perp = dangerPerp.set(f.line.dir.z, 0, -f.line.dir.x).multiplyScalar(side >= 0 ? 1 : -1);
      return dangerDestination.copy(u.pos).addScaledVector(perp, f.radius + 1.3 - Math.abs(side));
    }
    const d = rel.length();
    if (d > f.radius + 0.4 || f.hole && d < f.hole - 0.4) continue;
    if (d < 0.05) rel.set(1, 0, 0);
    if (f.hole && d - (f.hole - 1) < f.radius + 1.3 - d) return dangerDestination.copy(f.at).addScaledVector(rel.normalize(), Math.max(0.3, f.hole - 1));   // anel: o centro é mais perto
    return dangerDestination.copy(f.at).addScaledVector(rel.normalize(), f.radius + 1.3);
  }
  return null;
}

// explosão/pancada: dano em heróis e invocados (e meio dano em esqueletos comuns, se pedir)
function blast(at, radius, dmg, color, { skeletons = false, skip = null, owner = null } = {}) {
  for (const u of liveAllies()) if (!u.dead && flat(u.pos, at) <= radius + 0.3 * u.size) u.takeDamage(dmg, at, owner);
  if (skeletons) for (const s of G.skeletonsAlive()) if (s !== skip && !s.boss && !s.spawning && flat(s.pos, at) <= radius) s.takeDamage(dmg * 0.5, at);
  G.ring(at, radius, color, 0.7);
  G.poof(at, Math.min(1.6, radius * 0.6));
}

// derruba: deita, espera um pouco e levanta (só animações que heróis e invocados têm)
function knockDown(u, from, push) {
  if (u.dead) return;
  u.vel.add(mV.subVectors(u.pos, from).setY(0).normalize().multiplyScalar(push));
  u.pendingHit = null;
  const lie = u.once('Lie_Down', 2.8), stand = u.action('Lie_StandUp').getClip().duration / 2.8;
  u.busy = Math.max(u.busy, lie + 0.25 + stand);
  G.popText(u.pos, 'Derrubado!', 'block');
  track({ t: lie + 0.25, end: () => { if (!u.dead && G.units.includes(u)) u.once('Lie_StandUp', 2.8); } });
}

// ---------- estados nos heróis: veneno (dano por tempo) e lentidão (moveTo já lê slowT) ----------
// Fonte única: aplica, conta o tempo, mostra a marca e limpa (fim da luta, morte ou cura em área).
const mAfflicted = new Set();
const poisonMat = glowMat(0x7dff3a), slowMat = glowMat(0x9a6bff, 0.55);
function afflictMark(u, key, make) {
  if (!u.root?.add) return null;
  if (!u[key]) { u[key] = make(); u[key].castShadow = false; u.root.add(u[key]); }
  u[key].visible = true;
  return u[key];
}
export function poisonHero(u, time, tick, owner = null) {
  if (u.dead || u.team === 'skeleton' || !(time > 0)) return;
  const fresh = !(u.poisonT > 0);
  if (fresh) { u.poisonTick = 1; u.poisonDmg = 0; G.popText(u.pos, 'Veneno!', 'hurt'); }
  u.poisonT = Math.max(u.poisonT || 0, time);
  u.poisonDmg = Math.max(u.poisonDmg, tick);   // reaplicar renova o tempo, não acumula
  u.poisonBy = owner;
  afflictMark(u, 'poisonMark', () => piece(GEO.gem, poisonMat, [0, 2.35, 0], [0.11, 0.17, 0.11]));
  mAfflicted.add(u);
}
export function slowHero(u, time) {
  if (u.dead || u.team === 'skeleton' || !(time > 0)) return;
  u.slowT = Math.max(u.slowT || 0, time);
  afflictMark(u, 'slowMark', () => piece(GEO.torus, slowMat, [0, 0.12, 0], 0.55, [Math.PI / 2, 0, 0]));
  mAfflicted.add(u);
}
function cureHero(u, poison = true, slow = true) {
  if (poison) { u.poisonT = 0; if (u.poisonMark) u.poisonMark.visible = false; }
  if (slow) { u.slowT = 0; if (u.slowMark) u.slowMark.visible = false; }
  if (!(u.poisonT > 0) && !(u.slowT > 0)) mAfflicted.delete(u);
}
// cura em área (Paladino, Clériga, Druida, Anjo): tira o veneno de quem está no raio
export function cleanseAround(at, reach) {
  for (const u of mAfflicted) if (u.poisonT > 0 && !u.dead && flat(u.pos, at) <= reach) {
    cureHero(u, true, false);
    G.popText(u.pos, 'Purificado', 'heal');
  }
}
export function clearAfflictions() { for (const u of [...mAfflicted]) cureHero(u); }
function tickAfflictions(dt) {
  if (!mAfflicted.size) return;
  if (G.game && G.game.state !== 'fight') return clearAfflictions();   // fase vencida: ninguém sai envenenado
  for (const u of [...mAfflicted]) {
    if (u.dead || !G.units?.includes?.(u)) { cureHero(u); continue; }
    if (u.slowT > 0 && (u.slowT -= dt) <= 0) cureHero(u, false, true);
    if (!(u.poisonT > 0)) continue;
    u.poisonT -= dt;
    u.poisonTick -= dt;
    if (u.poisonTick <= 0) {
      u.poisonTick += 1;
      u.takeDamage(u.poisonDmg, null, u.poisonBy?.dead === false ? u.poisonBy : null, false, true);   // dot: sem recuo, esquiva ou bloqueio
      if (u.dead) { cureHero(u); continue; }
    }
    if (u.poisonT <= 0) cureHero(u, true, false);
    else if (u.poisonMark) u.poisonMark.rotation.y += dt * 3;
  }
}

function summon(type, at, anim) {
  const s = new G.Skeleton(type, G.game.phase);
  s.pos.copy(at);
  s.pos.y = G.world.groundHeight(at.x, at.z);
  const prey = nearestOf(s.pos, liveAllies());
  if (prey) s.root.rotation.y = Math.atan2(prey.pos.x - s.pos.x, prey.pos.z - s.pos.z);
  if (anim) s.busy = s.once(anim);
  s.summoned = true;
  return s;
}

const around = (center, n, radius, turn = 0) => Array.from({ length: n }, (_, i) => {
  const a = turn + (i / n) * Math.PI * 2;
  const p = center.clone().add(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  p.y = G.world.groundHeight(p.x, p.z);
  return p;
});

function faceNow(s, target) { s.root.rotation.y = Math.atan2(target.x - s.pos.x, target.z - s.pos.z); }
const forward = (s) => new THREE.Vector3(Math.sin(s.root.rotation.y), 0, Math.cos(s.root.rotation.y));

// pancada em área com aviso vermelho; o golpe do pulo cai no fim do aviso
function slam(s, target, radius, time, mult, { offset = 0.8, down = true } = {}) {
  faceNow(s, target.pos);
  const center = s.pos.clone().addScaledVector(forward(s), offset);
  const clip = s.action('1H_Melee_Attack_Jump_Chop').getClip().duration;
  s.once('1H_Melee_Attack_Jump_Chop', clip / (time + 0.25));
  s.busy = time + 0.45;
  s.pendingHit = null;
  warn(s, center, radius, time, () => {
    blast(center, radius, s.dmg * mult, 0xff6a3d, { owner: s });
    for (const u of liveAllies()) if (!u.dead && flat(u.pos, center) <= radius + 0.3) {
      if (down) knockDown(u, center, 4);
      else u.vel.add(mV.subVectors(u.pos, center).setY(0).normalize().multiplyScalar(5));   // só empurra
    }
  }, { announce: 'Pancada no chão — saia do círculo' });
}

// investida em linha já marcada no chão (Rei e Cavaleiro sombrio): atropela e joga para o lado quem ficou no caminho
function dashStep(s, dt) {
  const dash = s.dash;
  if (!dash) return;
  if (s.stunT > 0) { s.dash = null; return; }
  const step = Math.min(dash.left, dash.speed * dt);
  const next = s.pos.clone().addScaledVector(dash.dir, step);
  if (!G.world.canStep(s.pos, next)) dash.left = 0;
  else { s.pos.copy(next); s.pos.y = G.world.groundHeight(s.pos.x, s.pos.z); dash.left -= step; }
  for (const u of liveAllies()) if (!u.dead && !dash.hit.has(u) && flat(u.pos, s.pos) < 1.6) {
    dash.hit.add(u);
    u.takeDamage(s.dmg * dash.mult, s.pos, s);
    const side = new THREE.Vector3(dash.dir.z, 0, -dash.dir.x);
    if (side.dot(mV.subVectors(u.pos, s.pos)) < 0) side.multiplyScalar(-1);
    u.vel.add(side.multiplyScalar(dash.push));
  }
  if (dash.left <= 0) { s.dash = null; s.busy = Math.min(s.busy, 0.3); G.ring(s.pos, 1.6, dash.color); G.poof(s.pos, 1); dash.after?.(); }
}

// herói (ou invocado) dentro de uma faixa que sai de `at` na direção `dir`
function inLine(u, at, dir, len, half) {
  const rx = u.pos.x - at.x, rz = u.pos.z - at.z;
  const along = rx * dir.x + rz * dir.z, side = Math.abs(rx * dir.z - rz * dir.x);
  return along >= -0.4 && along <= len + 0.4 && side <= half + 0.3 * (u.size || 1);
}
const turned = (dir, a) => new THREE.Vector3(dir.x * Math.cos(a) + dir.z * Math.sin(a), 0, dir.z * Math.cos(a) - dir.x * Math.sin(a));

// escudo de ossos do xamã: absorve dano enquanto o xamã vive (main.js chama antes do dano entrar)
export function absorbWard(s, n) {
  const w = s.ward;
  if (!w || !(n > 0)) return n;
  const taken = Math.min(w.hp, n);
  w.hp -= taken;
  if (Math.random() < 0.35) G.popText(s.pos, 'Escudo de ossos', 'block');
  if (w.hp <= 0) {
    w.fx.t = 0;   // sai no próximo quadro pelo caminho normal de descarte
    s.ward = null;
    G.ring(s.pos, 1.2 * s.size, 0x5ff2ff, 0.7);
  }
  return n - taken;
}
function giveWard(shaman, o) {
  if (o.dead || o.ward) return;
  const bubble = piece(GEO.ball, MAT.ward, [0, 0.95, 0], [0.75, 1.05, 0.75]);
  const band = piece(GEO.torus, MAT.teal, [0, 0.12, 0], 0.62, [Math.PI / 2, 0, 0]);
  bubble.castShadow = band.castShadow = false;
  o.root.add(bubble, band);
  const ward = { hp: o.maxHp * (o.boss ? 0.12 : 0.45), by: shaman };
  ward.fx = track({ owner: shaman, t: 9, ward: o, step() { band.rotation.z += 0.05; if (o.dead) ward.fx.t = 0; },
    cleanup() { bubble.removeFromParent?.(); band.removeFromParent?.(); if (o.ward === ward) o.ward = null; } });
  o.ward = ward;
  G.beam(shaman.pos, o.pos, 0x5ff2ff);
  G.ring(o.pos, 1.1 * o.size, 0x5ff2ff, 0.8);
  G.popText(o.pos, 'Escudo de ossos!', 'evolve');
}

// atirador que fica a meia distância: aproxima, recua de quem encosta e atira
function keepRange(s, dt, target) {
  const d = flat(s.pos, target.pos);
  if (d > 7) s.moveTo(target.pos, dt);
  else if (d < 4.5) s.moveTo(s.pos.clone().add(mV.subVectors(s.pos, target.pos).setY(0).normalize().multiplyScalar(2)), dt);
  else if (s.face(target.pos, dt) < 0.5 && s.attackTimer <= 0) s.attack(target, s.attackAnim);
  return true;
}

// lamaçal da bruxa: área marcada que deixa lento quem pisa; some se a bruxa morrer ou ficar zonza
function bog(owner, at, radius, time, [fillColor, edgeColor] = [0x4a2f6e, 0xa77bff]) {
  const group = new THREE.Group();
  const fillMat = new THREE.MeshBasicMaterial({ color: fillColor, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const edgeMat = new THREE.MeshBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const flatRot = [-Math.PI / 2, 0, 0];
  const fill = piece(GEO.disc, fillMat, [0, 0.01, 0], radius, flatRot), edge = piece(GEO.edge, edgeMat, [0, 0, 0], radius, flatRot);
  fill.castShadow = edge.castShadow = false;
  group.add(fill, edge);
  group.position.copy(at);
  group.position.y += 0.06;
  G.scene.add(group);
  G.ring(at, radius, edgeColor, 0.7);
  // conta como aviso: a IA dos heróis tenta sair (dangerAt), mas sem barra de chefe
  return track({ owner, at: at.clone(), radius, line: null, warning: true, harmless: false, t: time, life: time, meshes: [group], mats: [fillMat, edgeMat],
    dodge: new Map(), notice: 0.5, bog: true,
    step(f, dt) {
      edge.rotation.z += dt * 0.6;
      fillMat.opacity = 0.35 + Math.sin(f.t * 4) * 0.08;
      for (const u of liveAllies()) if (!u.dead && flat(u.pos, f.at) <= radius + 0.3 * (u.size || 1)) slowHero(u, 0.6);
    } });
}

let mPacking = false;   // crânios do enxame criados pelo líder não criam outro enxame
const HARD_COUNT = 1.12;   // Difícil e Pesadelo: bando de 3 crânios, golem avulso e 2 sacerdotes/xamãs

// ---------- capítulo VII ----------
// escavador: some na terra, marca um círculo sob o herói e irrompe; depois fica zonzo (janela para revidar)
const BURROW = { radius: 1.6, time: 1.3, stun: 1.8, cooldown: 9 };
function surface(s) {
  s.burrowed = false;
  s.untargetable = false;
  s.root.visible = true;
  s.burrowFx = null;
}
function burrowDive(s, target) {
  const at = target.pos.clone();
  at.y = G.world.groundHeight(at.x, at.z);
  s.cd.burrow = BURROW.cooldown;
  s.vel.set(0, 0, 0);
  s.pendingHit = null;
  s.busy = BURROW.time + 0.2;
  s.burrowed = true;
  s.untargetable = true;   // debaixo da terra: golpes e áreas não o alcançam
  s.root.visible = false;
  G.poof(s.pos, 0.8);
  G.ring(s.pos, 1, 0xd08a3a, 0.6);
  s.burrowFx = warn(s, at, BURROW.radius, BURROW.time, () => {
    s.pos.x = at.x; s.pos.z = at.z;
    surface(s);
    blast(at, BURROW.radius, s.dmg * 1.4, 0xd08a3a, { owner: s });
    for (const u of liveAllies()) if (!u.dead && flat(u.pos, at) <= BURROW.radius + 0.3) knockDown(u, at, 3);
    s.stunT = Math.max(s.stunT, BURROW.stun);
    G.popText(s.pos, 'Atordoado!', 'block');
  }, { color: 0xd08a3a });
}

// porta-estandarte: anel laranja no chão; esqueletos dentro dele atacam mais rápido enquanto o estandarte está de pé
export const BANNER_AURA = { radius: 4.5, haste: 0.5 };

// dragão de ossos: rasantes em faixas ao longo da estrada (marcadas no chão) e pouso que derruba
const DRAGON_FLIGHTS = [0.72, 0.38];   // levanta voo ao cair abaixo destas frações de vida
export const DRAGON_PASS = { len: 18, half: 1.4, mark: 1.5, speed: 19, high: 3.2, low: 0.4, landR: 3, land: 1.2, rest: 2.6 };
const DRAGON_COLOR = 0x7dffd0;
function dragonTakeOff(s) {
  s.flights++;
  s.flight = { state: 'rise', t: 1.1, passes: s.enraged ? 3 : 2, sign: Math.random() < 0.5 ? 1 : -1, pass: null };
  s.pendingHit = null;
  s.stunT = 0;
  s.vel.set(0, 0, 0);
  s.busy = 99;
  s.loop?.('Jump_Idle');
  G.showBanner('O Dragão levanta voo!', 2.2);
  G.ring(s.pos, 3, DRAGON_COLOR, 0.9);
}
function dragonPass(s) {
  const f = s.flight, foes = liveAllies().filter((u) => !u.dead);
  if (!foes.length) return dragonLand(s);
  const prey = foes[Math.floor(Math.random() * foes.length)];
  const road = G.world.tangentAt(G.world.anchorS(G.game.phase));
  const dir = new THREE.Vector3(road.x, 0, road.z).normalize().multiplyScalar(f.sign);
  f.sign = -f.sign;   // vai e volta pela estrada
  const from = prey.pos.clone().addScaledVector(dir, -DRAGON_PASS.len / 2);
  from.y = G.world.groundHeight(from.x, from.z);
  const mark = s.enraged ? DRAGON_PASS.mark - 0.25 : DRAGON_PASS.mark;
  f.pass = { from, dir, left: DRAGON_PASS.len, hit: new Set(),
    fx: warn(s, from, DRAGON_PASS.half, mark, null, { line: { dir, len: DRAGON_PASS.len }, color: DRAGON_COLOR, announce: 'Rasante — saia da faixa' }) };
  f.state = 'mark';
  f.t = mark;
  if (s.enraged) {   // em fúria, ossos caem das asas sobre outro herói
    const other = foes.find((u) => u !== prey) || prey;
    const at = other.pos.clone();
    at.y = G.world.groundHeight(at.x, at.z);
    warn(s, at, 1.5, mark + 0.2, () => dropSkull(at, s.dmg * 0.6, null), { color: 0xb050ff, announce: 'Chuva de ossos — saia do círculo' });
  }
}
function dragonLand(s) {
  const f = s.flight, at = s.pos.clone();
  at.y = G.world.groundHeight(at.x, at.z);
  f.state = 'land';
  f.t = DRAGON_PASS.land;
  f.at = at;
  warn(s, at, DRAGON_PASS.landR, DRAGON_PASS.land, null, { color: DRAGON_COLOR, announce: 'Pouso — saia do círculo' });
}
function dragonFly(s, dt) {
  const f = s.flight;
  s.stunT = 0;   // no ar não fica zonzo
  s.vel.set(0, 0, 0);
  s.busy = Math.max(s.busy, 1);
  f.t -= dt;
  if (f.state === 'rise' || f.state === 'turn') { if (f.t <= 0) dragonPass(s); return; }
  if (f.state === 'mark') {
    const p = f.pass, to = mV.subVectors(p.from, s.pos).setY(0), d = to.length();
    if (d > 0.05) s.pos.addScaledVector(to.normalize(), Math.min(d, 16 * dt));   // voa até o começo da faixa
    faceNow(s, s.pos.clone().add(p.dir));
    if (!p.fx.alive && f.t > 0.05) { f.state = 'turn'; f.t = 0.6; return; }   // aviso desfeito: não ataca sem marca
    if (f.t <= 0) { s.pos.x = p.from.x; s.pos.z = p.from.z; f.state = 'dash'; s.loop?.('Running_C'); }
    return;
  }
  if (f.state === 'dash') {
    const p = f.pass, step = Math.min(p.left, DRAGON_PASS.speed * dt);
    s.pos.addScaledVector(p.dir, step);
    p.left -= step;
    for (const u of liveAllies()) if (!u.dead && !p.hit.has(u) && flat(u.pos, s.pos) <= DRAGON_PASS.half + 0.3 * (u.size || 1)) {
      p.hit.add(u);
      u.takeDamage(s.dmg * 1.2, s.pos, s);
      knockDown(u, s.pos, 4);
    }
    if (p.left <= 0) {
      G.poof(s.pos, 1.2);
      if (--f.passes > 0) { f.state = 'turn'; f.t = 0.7; s.loop?.('Jump_Idle'); }
      else dragonLand(s);
    }
    return;
  }
  if (f.state === 'land' && f.t <= 0) {
    blast(f.at, DRAGON_PASS.landR, s.dmg, DRAGON_COLOR, { owner: s });
    for (const u of liveAllies()) if (!u.dead && flat(u.pos, f.at) <= DRAGON_PASS.landR + 0.3) knockDown(u, f.at, 4);
    s.flight = null;
    s.busy = 0;
    s.stunT = DRAGON_PASS.rest;   // exausto no chão: hora de bater
    G.popText(s.pos, 'Exausto!', 'block');
  }
}
// altura do voo: alto enquanto marca, rente ao chão no rasante (aí os golpes corpo a corpo voltam a alcançar)
function dragonHeight(s) {
  const f = s.flight;
  if (!f || f.state === 'land' || f.state === 'dash') return f?.state === 'dash' ? DRAGON_PASS.low : 0;
  return f.state === 'mark' && f.t < 0.6 ? DRAGON_PASS.low : DRAGON_PASS.high;
}

// variações de chefe por missão: mesmo golpe-base, outro visual e um golpe a mais
export const BOSS_MODS = {
  spectral: { name: 'Rei Espectral', icon: '♜', detail: 'Rei translúcido: chama fantasmas no lugar de soldados. Fúria abaixo de 50% com onda de choque em anel.',
    apply(s) {
      paint(s, 0xa8dcff, 0xcff6ff, 0x1d4f8f);
      for (const m of s.mats) Object.assign(m, { transparent: true, opacity: 0.62, depthWrite: false });
      boneOf(s, 'hips').add(piece(GEO.cone, MAT.wisp, [0, -0.45, -0.05], [0.4, 1.0, 0.4], [Math.PI, 0, 0]));
      s.spectral = true;
      G.showBanner('O Rei Espectral surge da névoa!', 2.5);
    } },
  drowned: { name: 'Carrasco Afogado', icon: '⚒', detail: 'Carrasco do lago: além da machadada e da corrente, marca um círculo de maré negra que deixa lento.',
    apply(s) {
      paint(s, 0x9fc9bd, 0x5ff2ff, 0x062a2a);
      meshNamed(s, '_Cloak', (m) => m.color.set(0x1f4f5a));
      s.cd.tide = 5;
      G.showBanner('O Carrasco Afogado sobe do lago!', 2.5);
    },
    think(s, dt, target) {
      if (!target || !(s.cd.tide <= 0)) return false;
      const far = liveAllies().filter((u) => !u.dead && flat(u.pos, s.pos) < 12)
        .sort((a, b) => (!!b.ranged - !!a.ranged) || flat(b.pos, s.pos) - flat(a.pos, s.pos))[0];
      if (!far) return false;
      const at = far.pos.clone();
      at.y = G.world.groundHeight(at.x, at.z);
      faceNow(s, at);
      s.vel.set(0, 0, 0);
      s.busy = s.once('Taunt', 1.2) * 0.7;
      s.cd.tide = s.enraged ? 9 : 12;
      s.pendingHit = null;
      warn(s, at, 2.4, 1.3, () => {
        blast(at, 2.4, s.dmg * 0.6, 0x3fd0c0, { owner: s });
        bog(s, at, 2.4, 6, [0x1f4f5a, 0x5ff2ff]);
      }, { color: 0x3fd0c0, announce: 'Maré negra — saia do círculo' });
      return true;
    } },
};
export function applyBossMod(s, id) {
  const mod = BOSS_MODS[id];
  if (!mod || !s) return s;
  const base = s.kind;
  s.kind = { ...base, name: mod.name,
    think: mod.think ? (u, dt, target) => mod.think(u, dt, target) || !!base.think?.(u, dt, target) : base.think };
  s.bossMod = id;
  mod.apply?.(s);
  G.markEmissiveDirty?.(s);
  return s;
}

// ---------- tipos novos (atributos base; fase e dificuldade escalam no Skeleton) ----------
export const MONSTER_TYPES = {
  // escudo de torre: bloqueia boa parte do dano que vem pela frente
  Shieldbearer: { name: 'Escudeiro', model: 'Warrior', hp: 48, dmg: 9, range: 1.4, speed: 1.0, cooldown: 1.8, weapon: 'Skeleton_Blade', idle: 'Blocking', size: 1.1,
    attacks: ['1H_Melee_Attack_Chop', 'Block_Attack'],
    dress(s) {
      paint(s, 0xc4cfdf, 0x7fc8ff);
      const g = new THREE.Group();
      g.add(piece(GEO.box, MAT.iron, [0, -0.08, -0.02], [0.95, 1.5, 0.07]));
      for (const [x, y, w, h] of [[0, 0.68, 1.02, 0.1], [0, -0.84, 1.02, 0.1], [0.48, -0.08, 0.08, 1.6], [-0.48, -0.08, 0.08, 1.6]]) g.add(piece(GEO.box, MAT.ironDark, [x, y, 0.02], [w, h, 0.1]));
      const emblem = G.assets.Skeleton_Shield_Small_A.scene.clone();
      emblem.scale.setScalar(0.62);
      emblem.position.set(0, 0.05, 0.03);
      g.add(emblem, piece(GEO.cone, MAT.ironDark, [0, -0.5, 0.07], [0.08, 0.22, 0.08], [Math.PI / 2, 0, 0]));
      boneOf(s, 'handslotl').add(g);
    },
    hurt(s, n, from) {
      if (!from || s.stunT > 0 || s.spawning) return n;
      const dx = from.x - s.pos.x, dz = from.z - s.pos.z, len = Math.hypot(dx, dz);
      if (len < 0.2 || (dx * Math.sin(s.root.rotation.y) + dz * Math.cos(s.root.rotation.y)) / len < 0.35) return n;   // pelos lados e pelas costas entra tudo
      if (s.busy <= 0 && !s.pendingHit) s.busy = s.once('Block_Hit', 1.5) * 0.7;
      if (Math.random() < 0.4) G.popText(s.pos, 'Bloqueio!', 'block');
      return n * 0.55;
    } },

  // corre com a bomba acesa e explode perto do herói (ou quando morre perto)
  Bomber: { name: 'Bombardeiro', model: 'Rogue', hp: 22, dmg: 16, range: 1.5, speed: 2.6, cooldown: 9, move: 'Running_C', size: 0.95,
    dress(s) {
      paint(s, 0xffbea0, 0xff7a1a);
      const g = new THREE.Group();
      g.add(piece(GEO.ball, MAT.bomb, [0, 0.12, 0.05], 0.27), piece(GEO.cyl, MAT.fuse, [0, 0.42, 0.05], [0.03, 0.16, 0.03]));
      s.spark = piece(GEO.gem, MAT.spark, [0, 0.53, 0.05], 0.07);
      g.add(s.spark);
      boneOf(s, 'handslotr').add(g);
      s.bomb = g;
      for (const x of [-0.2, 0.2]) boneOf(s, 'hips').add(piece(GEO.ball, MAT.bomb, [x, 0.05, 0.2], 0.1));
    },
    tick(s) { if (s.spark) s.spark.scale.setScalar((s.cast?.alive ? 0.1 : 0.06) + Math.random() * 0.05); },
    think(s, dt, target) {
      if (s.cast?.alive) return true;   // pavio aceso: espera a explosão
      if (!target) return true;
      if (flat(s.pos, target.pos) > 1.6) { s.moveTo(target.pos, dt); return true; }
      s.vel.set(0, 0, 0);
      s.busy = 0.95;
      s.once('Use_Item', 1.2);
      s.cast = warn(s, s.pos, 2.2, 0.95, () => {
        if (s.dead) return;
        s.exploded = true;
        blast(s.pos, 2.2, s.dmg, 0xff8a2a, { skeletons: true, skip: s, owner: s });
        if (!s.dead) s.die();
      }, { color: 0xff7a1a });
      return true;
    },
    death(s) {
      if (s.bomb) s.bomb.visible = false;
      if (s.exploded || !liveAllies().some((u) => !u.dead && flat(u.pos, s.pos) < 3.2)) return;
      s.exploded = true;
      const at = s.pos.clone();
      warn(null, at, 2.2, 0.45, () => blast(at, 2.2, s.dmg * 0.6, 0xff8a2a, { skeletons: true, owner: s }), { color: 0xff7a1a });
    } },

  // fica atrás: cura os esqueletos próximos e reergue os caídos
  Priest: { name: 'Necro-sacerdote', model: 'Mage', hp: 42, dmg: 5, range: 7.5, speed: 1.3, cooldown: 2.6, weapon: 'Skeleton_Staff', ranged: true, mobile: true, attack: 'Spellcast_Shoot',
    dress(s) {
      paint(s, 0xd2f5d6, 0x3dff7a, 0x0a2412);
      meshNamed(s, '_Hat', (m) => m.color.set(0x3f8f55));
      boneOf(s, 'handslotr').add(piece(GEO.gem, MAT.green, [-0.15, 1.42, 0], 0.13));
      s.halo = piece(GEO.torus, MAT.green, [0, 1.1, 0], 0.28, [Math.PI / 2, 0, 0]);
      boneOf(s, 'head').add(s.halo);
      s.boltMat = greenBolt;
      s.cd = { heal: 2.5, revive: 5 };
    },
    tick(s, dt) { s.cd.heal -= dt; s.cd.revive -= dt; s.halo.rotation.z += dt * 2; },
    think(s, dt, target) {
      if (!target) return true;
      if (s.cd.revive <= 0 && countAliveSkeletons() < 12) {
        const grave = nearestOf(s.pos, mGraves.filter((g) => flat(g.pos, s.pos) < 9));
        if (grave) {
          mGraves.splice(mGraves.indexOf(grave), 1);
          faceNow(s, grave.pos);
          s.busy = s.once('Spellcast_Summon', 1.2);
          s.cd.revive = 13;
          G.beam(s.pos, grave.pos, 0x6dff8c);
          warn(s, grave.pos, 0.9, 1.2, () => { summon(grave.type, grave.pos, 'Death_C_Skeletons_Resurrect'); G.ring(grave.pos, 1.2, 0x6dff8c, 0.9); }, { color: 0x4dff7a, harmless: true });
          G.popText(s.pos, 'Levante-se!', 'heal');
          return true;
        }
      }
      if (s.cd.heal <= 0) {
        const hurt = [];
        const units = Array.isArray(G.units) ? G.units : G.skeletonsAlive();
        for (const o of units) if (o.team === 'skeleton' && o !== s && !o.dead && !o.spawning
          && o.hp < o.maxHp * 0.95 && flat(o.pos, s.pos) < 6) hurt.push(o);
        if (hurt.length) {
          s.busy = s.once('Spellcast_Raise', 1.3);
          s.cd.heal = 4.5;
          track({ t: 0.5, owner: s, end: () => {
            for (const o of hurt) if (!o.dead) {
              const heal = Math.min(o.maxHp - o.hp, o.maxHp * (o.boss ? 0.03 : 0.18));
              o.hp += heal;
              G.popText(o.pos, '+' + Math.round(heal), 'heal');
              G.ring(o.pos, 0.8, 0x6dff8c, 0.8);
            }
            G.ring(s.pos, 6, 0x6dff8c, 0.9);
          } });
          return true;
        }
      }
      const d = flat(s.pos, target.pos);
      if (d > 7) s.moveTo(target.pos, dt);
      else if (d < 4.5) s.moveTo(s.pos.clone().add(mV.subVectors(s.pos, target.pos).setY(0).normalize().multiplyScalar(2)), dt);
      else if (s.face(target.pos, dt) < 0.5 && s.attackTimer <= 0) s.attack(target, s.attackAnim);
      return true;
    } },

  // translúcido, flutua, atravessa pedras e o grupo para pegar quem está atrás
  Ghost: { name: 'Fantasma', model: 'Minion', hp: 19, dmg: 7, range: 1.3, speed: 3.1, cooldown: 1.0, weapon: 'Skeleton_Blade', phasing: true,
    move: 'Jump_Idle', walk: 'Jump_Idle', idle: 'Jump_Idle', spawn: 'Spawn_Air', attack: '1H_Melee_Attack_Stab',
    dress(s) {
      paint(s, 0xa8dcff, 0xcff6ff, 0x1d4f8f);
      for (const m of s.mats) Object.assign(m, { transparent: true, opacity: 0.5, depthWrite: false });
      s.root.traverse((o) => { o.castShadow = false; });
      boneOf(s, 'hips').add(piece(GEO.cone, MAT.wisp, [0, -0.45, -0.05], [0.32, 0.9, 0.32], [Math.PI, 0, 0]));
      s.bob = Math.random() * 6;
    },
    tick(s, dt) { s.bob += dt; s.hover = 0.35 + Math.sin(s.bob * 3) * 0.1; },
    think(s, dt, target) {
      let prey = target;
      if (!(s.tauntT > 0)) {
        const back = nearestOf(s.pos, G.rangedHeroes?.() ?? G.heroes().filter((h) => h.ranged));
        if (back && flat(back.pos, s.pos) < 16) prey = back;
      }
      if (!prey) return true;
      if (flat(s.pos, prey.pos) > s.range) {
        const dir = new THREE.Vector3(prey.pos.x - s.pos.x, 0, prey.pos.z - s.pos.z).normalize();   // em linha reta, sem desviar
        s.vel.lerp(dir.multiplyScalar(s.speed * (s.slowT > 0 ? 0.5 : 1)), Math.min(1, dt * 6));
        s.moving = true;
        s.face(prey.pos, dt);
      } else if (s.face(prey.pos, dt) < 0.5 && s.attackTimer <= 0) s.attack(prey, s.attackAnim);
      return true;
    } },

  // enxame: chega em bando de crânios voadores; cada um marca um círculo pequeno e mergulha nele
  Skull: { name: 'Enxame de Crânios', model: 'Minion', hp: 10, dmg: 4, range: 1.2, speed: 3.3, cooldown: 2.4, phasing: true, size: 0.8,
    move: 'Jump_Idle', walk: 'Jump_Idle', idle: 'Jump_Idle', spawn: 'Spawn_Air',
    dress(s) {
      paint(s, 0xf3e6c8, 0xff9a2a, 0x2a1000);
      s.root.traverse((o) => { if (o.isMesh && !/_(Head|Jaw|Eyes)$/.test(o.name)) o.visible = false; });   // só a cabeça voa
      s.trail = piece(GEO.cone, MAT.ember, [0, 0.05, -0.32], [0.18, 0.55, 0.18], [-Math.PI / 2, 0, 0]);
      s.trail.castShadow = false;
      boneOf(s, 'head').add(s.trail);
      s.bob = Math.random() * 6;
      s.pack = mPacking ? 0 : G.difficulty.count >= HARD_COUNT ? 3 : 2;   // o primeiro traz o bando
      s.attackTimer = 0.6 + Math.random() * 1.2;   // não mergulham todos juntos
    },
    tick(s, dt) {
      s.bob += dt;
      s.hover = (s.diving ? 0.25 : 0.1) + Math.sin(s.bob * 5) * 0.08;
      s.trail.scale.y = 0.45 + Math.random() * 0.2 + (s.diving ? 0.4 : 0);
      if (!s.pack) return;
      const n = s.pack;
      s.pack = 0;
      mPacking = true;
      try { for (const p of around(s.pos, n, 1.1, Math.random() * 6)) summon('Skull', p); } finally { mPacking = false; }
    },
    think(s, dt, target) {
      s.diving = false;
      if (!target) return true;
      const d = flat(s.pos, target.pos);
      if (d > 2.6 || s.attackTimer > 0) {   // voa em linha reta; recarregando, rodeia o alvo
        const dir = new THREE.Vector3(target.pos.x - s.pos.x, 0, target.pos.z - s.pos.z).normalize();
        if (d <= 2.6) dir.set(dir.z, 0, -dir.x).addScaledVector(dir, d < 1.6 ? -0.6 : 0.2).normalize();
        s.vel.lerp(dir.multiplyScalar(s.speed * (s.slowT > 0 ? 0.5 : 1) * (d > 2.6 ? 1 : 0.5)), Math.min(1, dt * 5));
        s.moving = true;
        s.face(target.pos, dt);
        return true;
      }
      const at = target.pos.clone();   // marca onde o herói estava: quem sai do círculo escapa
      s.vel.set(0, 0, 0);
      s.diving = true;
      s.busy = 0.75;
      s.attackTimer = s.cooldown;
      faceNow(s, at);
      warn(s, at, 0.85, 0.7, () => {
        s.diving = false;
        const to = mV.subVectors(at, s.pos).setY(0);
        if (to.length() > 0.4) s.pos.addScaledVector(to, 1 - 0.4 / to.length());
        blast(at, 0.85, s.dmg, 0xff9a2a, { owner: s });
      }, { color: 0xff9a2a, notice: 0.35 });
      return true;
    } },

  // xamã de ossos: fica atrás e cobre um aliado com escudo de ossos (aviso azul antes); morto ou zonzo, o escudo some
  Shaman: { name: 'Xamã de Ossos', model: 'Mage', hp: 38, dmg: 5, range: 7.5, speed: 1.25, cooldown: 2.6, weapon: 'Skeleton_Staff', ranged: true, mobile: true,
    attack: 'Spellcast_Shoot', priority: 5,
    dress(s) {
      paint(s, 0xbfe9e4, 0x40f0ff, 0x062a2a);
      meshNamed(s, '_Hat', (m) => m.color.set(0x1f5f6a));
      const top = boneOf(s, 'handslotr');
      top.add(piece(GEO.ball, MAT.bone, [-0.15, 1.42, 0], 0.13));
      for (const x of [-0.05, 0.05]) top.add(piece(GEO.ball, MAT.teal, [-0.15 + x, 1.44, 0.1], 0.035));
      s.orbit = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        s.orbit.add(piece(GEO.cone, MAT.bone, [Math.cos(a) * 0.55, 1.25, Math.sin(a) * 0.55], [0.05, 0.22, 0.05], [0, 0, Math.PI / 2]));
      }
      s.root.add(s.orbit);
      s.boltMat = tealBolt;
      s.cd = { ward: 2 };
    },
    tick(s, dt) { s.cd.ward -= dt; s.orbit.rotation.y += dt * 2.4; },
    think(s, dt, target) {
      if (!target) return true;
      if (s.cd.ward <= 0) {
        const pick = G.skeletonsAlive().filter((o) => o !== s && !o.spawning && !o.ward && o.enemyKind !== 'Skull' && flat(o.pos, s.pos) < 8)
          .sort((a, b) => (b.boss - a.boss) || b.maxHp - a.maxHp)[0];
        if (pick) {
          faceNow(s, pick.pos);
          s.busy = s.once('Spellcast_Long', 1.2);
          s.cd.ward = 8;
          warn(s, pick.pos, 1.0 * pick.size, 1.1, () => giveWard(s, pick), { color: 0x5ff2ff, follow: pick });
          G.popText(s.pos, 'Ossos, protejam!', 'evolve');
          return true;
        }
        s.cd.ward = 1;
      }
      const d = flat(s.pos, target.pos);
      if (d > 7) s.moveTo(target.pos, dt);
      else if (d < 4.5) s.moveTo(s.pos.clone().add(mV.subVectors(s.pos, target.pos).setY(0).normalize().multiplyScalar(2)), dt);
      else if (s.face(target.pos, dt) < 0.5 && s.attackTimer <= 0) s.attack(target, s.attackAnim);
      return true;
    } },

  // cavaleiro sombrio: marca uma linha no chão, investe com a lança e fica exausto alguns instantes
  DarkKnight: { name: 'Cavaleiro Sombrio', model: 'Warrior', hp: 62, dmg: 11, range: 1.6, speed: 1.2, cooldown: 1.9, attack: '1H_Melee_Attack_Stab', size: 1.3,
    dress(s) {
      paint(s, 0x6a6478, 0xff3040, 0x14000a);
      meshNamed(s, '_Cloak', (m) => m.color.set(0x5a0f1e));
      const head = boneOf(s, 'head');
      for (const x of [-1, 1]) head.add(piece(GEO.cone, MAT.dark, [x * 0.3, 0.62, 0], [0.06, 0.32, 0.06], [0, 0, -x * 0.6]));
      head.add(piece(GEO.box, MAT.plume, [0, 0.78, -0.08], [0.06, 0.16, 0.42]));
      const lance = new THREE.Group();
      lance.add(piece(GEO.cyl, MAT.lance, [0, 0.35, 0], [0.04, 1.3, 0.04]), piece(GEO.cone, MAT.iron, [0, 1.2, 0], [0.07, 0.5, 0.07]),
        piece(GEO.cone, MAT.ironDark, [0, 0.0, 0], [0.13, 0.22, 0.13], [Math.PI, 0, 0]), piece(GEO.box, MAT.plume, [0.1, 0.95, 0], [0.16, 0.12, 0.015]));
      boneOf(s, 'handslotr').add(lance);
      s.cd = { charge: 2.5 };
    },
    tick(s, dt) { s.cd.charge -= dt; dashStep(s, dt); },
    think(s, dt, target) {
      if (s.dash) return true;
      if (!target || s.cd.charge > 0) return false;
      const d = flat(s.pos, target.pos);
      if (d < 3.5 || d > 11) return false;
      const dir = new THREE.Vector3(target.pos.x - s.pos.x, 0, target.pos.z - s.pos.z).normalize(), len = Math.min(11, d + 2);
      faceNow(s, target.pos);
      s.vel.set(0, 0, 0);
      s.once('Block', 1);
      s.busy = 1.0 + len / 13 + 0.2;
      s.cd.charge = 8;
      s.pendingHit = null;
      warn(s, s.pos, 0.8, 1.0, () => {
        s.dash = { dir, left: len, hit: new Set(), speed: 13, mult: 1.0, push: 5, color: 0xff3355,
          after: () => { s.busy = 1.1; s.once('Taunt', 1.4); G.popText(s.pos, 'Exausto!', 'block'); } };   // janela para revidar
        s.loop('Running_C');
      }, { line: { dir, len }, color: 0xff3355 });
      return true;
    } },

  // besteiro venenoso: marca uma linha verde e dispara um virote que envenena quem ficou nela
  Venomer: { name: 'Besteiro Venenoso', model: 'Rogue', hp: 30, dmg: 7, range: 8, speed: 1.15, cooldown: 2.6, weapon: 'Skeleton_Crossbow', ranged: true, mobile: true,
    attack: '2H_Ranged_Shoot', priority: 4,
    dress(s) {
      paint(s, 0xc9efb4, 0x7dff3a, 0x0c2a04);
      const hips = boneOf(s, 'hips');
      for (const x of [-0.18, 0.18]) hips.add(piece(GEO.cyl, MAT.green, [x, 0.02, 0.22], [0.06, 0.16, 0.06]));
      boneOf(s, 'handslotr').add(piece(GEO.gem, MAT.green, [0, 0.25, 0.25], 0.07));
      s.boltMat = greenBolt;
      s.cd = { venom: 2 };
    },
    tick(s, dt) { s.cd.venom -= dt; },
    think(s, dt, target) {
      if (!target) return true;
      const d = flat(s.pos, target.pos);
      if (s.cd.venom <= 0 && d < 9.5) {
        const dir = new THREE.Vector3(target.pos.x - s.pos.x, 0, target.pos.z - s.pos.z).normalize(), len = d + 1.5;
        faceNow(s, target.pos);
        s.vel.set(0, 0, 0);
        s.once('2H_Ranged_Shoot', 0.9);
        s.busy = 1.0;
        s.cd.venom = 7;
        s.pendingHit = null;
        const from = s.pos.clone();
        warn(s, from, 0.55, 0.9, () => {
          G.beam(from, from.clone().addScaledVector(dir, len), 0x7dff3a);
          for (const u of liveAllies()) if (!u.dead && inLine(u, from, dir, len, 0.55)) {
            u.takeDamage(s.dmg * 0.6, from, s);
            poisonHero(u, 5, s.dmg * 0.4, s);
          }
        }, { line: { dir, len }, color: 0x5fe03a });
        return true;
      }
      return keepRange(s, dt, target);
    } },

  // bruxa de ossos: fica atrás e marca um lamaçal que deixa os heróis lentos
  Witch: { name: 'Bruxa de Ossos', model: 'Mage', hp: 36, dmg: 5, range: 7.5, speed: 1.2, cooldown: 2.6, weapon: 'Skeleton_Staff', ranged: true, mobile: true,
    attack: 'Spellcast_Shoot', priority: 4,
    dress(s) {
      paint(s, 0xe0d0f0, 0xb07bff, 0x1a0a2a);
      meshNamed(s, '_Hat', (m) => m.color.set(0x3a2450));
      const top = boneOf(s, 'handslotr');
      top.add(piece(GEO.ball, MAT.bone, [-0.15, 1.42, 0], 0.11), piece(GEO.gem, MAT.purple, [-0.15, 1.6, 0], 0.07));
      s.boltMat = purpleBolt;
      s.cd = { bog: 2.5 };
    },
    tick(s, dt) { s.cd.bog -= dt; },
    think(s, dt, target) {
      if (!target) return true;
      if (s.cd.bog <= 0 && flat(s.pos, target.pos) < 10) {
        const at = target.pos.clone();
        faceNow(s, at);
        s.vel.set(0, 0, 0);
        s.busy = s.once('Spellcast_Long', 1.2);
        s.cd.bog = 9;
        warn(s, at, 2.6, 1.2, () => bog(s, at, 2.6, 6), { color: 0x9a6bff, harmless: true });
        G.popText(s.pos, 'Lamaçal!', 'evolve');
        return true;
      }
      return keepRange(s, dt, target);
    } },

  // escavador de ossos: mergulha na terra, marca um círculo sob o herói e irrompe; sair do círculo e revidar enquanto ele está zonzo
  Burrower: { name: 'Escavador de Ossos', model: 'Rogue', hp: 34, dmg: 9, range: 1.3, speed: 1.7, cooldown: 1.3, weapon: 'Skeleton_Blade', move: 'Running_C',
    attacks: ['1H_Melee_Attack_Stab', '1H_Melee_Attack_Slice_Horizontal'],
    dress(s) {
      paint(s, 0xd2b48a, 0xffb347, 0x2a1400);
      const chest = boneOf(s, 'chest');
      for (let k = 0; k < 3; k++) chest.add(piece(GEO.box, MAT.dirt, [0, 0.12 + k * 0.15, -0.2 - k * 0.02], [0.42 - k * 0.06, 0.08, 0.2], [0.35, 0, 0]));   // carapaça de terra
      for (const x of [-1, 1]) for (let k = 0; k < 3; k++) boneOf(s, x < 0 ? 'handslotl' : 'handslotr')
        .add(piece(GEO.cone, MAT.boneDark, [(k - 1) * 0.06, 0.12, 0.08], [0.03, 0.2, 0.03], [0.9, 0, 0]));   // garras
      s.cd = { burrow: 2.5 + Math.random() * 2 };
    },
    tick(s, dt) {
      s.cd.burrow -= dt;
      if (s.burrowed && !s.burrowFx?.alive) surface(s);   // aviso desfeito (zonzo debaixo da terra): volta onde estava
    },
    think(s, dt, target) {
      if (s.burrowed) return true;
      if (!target || s.cd.burrow > 0) return false;
      const d = flat(s.pos, target.pos);
      if (d < 2.5 || d > 12) return false;
      burrowDive(s, target);
      return true;
    },
    death(s) { if (s.burrowed) surface(s); } },

  // porta-estandarte: anel laranja no chão acelera os golpes dos esqueletos dentro dele; derrube-o primeiro ou leve a luta para fora do anel
  Bannerbearer: { name: 'Porta-Estandarte', model: 'Warrior', hp: 54, dmg: 8, range: 1.4, speed: 1.05, cooldown: 1.9, weapon: 'Skeleton_Blade', size: 1.1, priority: 4,
    dress(s) {
      paint(s, 0xdccaa8, 0xff7a3a, 0x2a0c00);
      const chest = boneOf(s, 'chest'), flag = new THREE.Group();
      flag.add(piece(GEO.cyl, MAT.lance, [0, 0.75, 0], [0.03, 1.9, 0.03]), piece(GEO.cone, MAT.gold, [0, 1.78, 0], [0.06, 0.2, 0.06]),
        piece(GEO.box, MAT.banner, [0.24, 1.35, 0], [0.46, 0.62, 0.02]), piece(GEO.ball, MAT.bone, [0.24, 1.4, 0.02], [0.1, 0.11, 0.04]));
      flag.position.set(0.12, 0, -0.28);
      chest.add(flag);
      s.aura = piece(GEO.edge, MAT.aura, [0, 0.08, 0], BANNER_AURA.radius / s.size, [-Math.PI / 2, 0, 0]);
      s.aura.castShadow = false;
      s.root.add(s.aura);
    },
    tick(s, dt) {
      const on = !(s.stunT > 0) && !s.spawning;   // atordoado, o estandarte para de inspirar
      s.aura.visible = on;
      s.aura.rotation.z += dt * 0.8;
      if (!on) return;
      for (const o of G.units || []) if (o !== s && o.team === 'skeleton' && !o.dead && flat(o.pos, s.pos) <= BANNER_AURA.radius) o.attackTimer -= dt * BANNER_AURA.haste;
    } },

  // mini-chefe: enorme, espinhos nas costas, pancada em área que derruba
  Golem: { name: 'Golem de Ossos', title: 'Mini-chefe', model: 'Warrior', hp: 250, dmg: 15, range: 2.0, speed: 0.85, cooldown: 2.4, weapon: 'Skeleton_Axe', attack: '2H_Melee_Attack_Chop',
    attacks: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Stab'], size: 2.2, heavy: true,
    dress(s) {
      paint(s, 0xb9ad96, 0xff3b1f, 0x140a04);
      s.root.getObjectByName('Skeleton_Warrior_Helmet')?.removeFromParent?.();
      const chest = boneOf(s, 'chest');
      for (let k = 0; k < 4; k++) for (const x of [-0.17, 0.17]) chest.add(piece(GEO.cone, MAT.bone, [x, 0.05 + k * 0.17, -0.3], [0.06, 0.34 - k * 0.04, 0.06], [-1.15, 0, x * 1.5]));
      for (let k = 0; k < 3; k++) chest.add(piece(GEO.cone, MAT.boneDark, [0, 0.12 + k * 0.2, -0.33], [0.08, 0.5, 0.08], [-1.0, 0, 0]));
      for (const x of [-1, 1]) {
        chest.add(piece(GEO.ball, MAT.boneDark, [x * 0.36, 0.42, 0], [0.17, 0.13, 0.17]));
        chest.add(piece(GEO.cone, MAT.bone, [x * 0.46, 0.55, 0], [0.06, 0.32, 0.06], [0, 0, -x * 0.7]));
        for (let r = 0; r < 3; r++) chest.add(piece(GEO.torus, MAT.bone, [x * 0.1, 0.1 + r * 0.11, 0.12], [0.16, 0.16, 0.5], [0, Math.PI / 2, 0]));
      }
      s.cd = { slam: 3 };
      G.showBanner('Mini-chefe: Golem de Ossos!', 2.5);
    },
    tick(s, dt) { s.cd.slam -= dt; },
    think(s, dt, target) {
      if (!target || s.cd.slam > 0 || flat(s.pos, target.pos) > 3.4) return false;
      slam(s, target, 2.9, 1.25, 1.3, { offset: 1 });
      s.cd.slam = 6;
      return true;
    } },

  // chefe da fase 6
  King: { name: 'Rei Esqueleto', title: 'Chefe', model: 'Warrior', hp: 54, dmg: 11, range: 1.5, speed: 1.45, cooldown: 1.7, weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Small_A',
    attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', 'Block_Attack'], size: 2.0,
    dress(s) {
      paint(s, 0xfff0cf, 0xffb020, 0x1a1000);
      meshNamed(s, '_Cloak', (m) => m.color.set(0xd02a3c));
      s.root.getObjectByName('Skeleton_Warrior_Helmet')?.removeFromParent?.();
      const crown = new THREE.Group();
      crown.add(piece(GEO.cyl, MAT.gold, [0, 0, 0], [0.3, 0.13, 0.3]));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        crown.add(piece(GEO.cone, MAT.gold, [Math.cos(a) * 0.27, 0.15, Math.sin(a) * 0.27], [0.06, 0.2, 0.06]));
        if (i % 2 === 0) crown.add(piece(GEO.gem, MAT.ruby, [Math.cos(a) * 0.31, 0.01, Math.sin(a) * 0.31], 0.05));
      }
      crown.position.set(0, 0.62, 0);
      boneOf(s, 'head').add(crown);
      for (const x of [-1, 1]) boneOf(s, 'chest').add(piece(GEO.ball, MAT.gold, [x * 0.36, 0.4, 0], [0.17, 0.12, 0.17]));
      s.cd = { slam: 3, summon: 6, charge: 4.5, quake: 99 };
      G.showBanner('O Rei Esqueleto chegou!', 2.5);
    },
    tick(s, dt) {
      for (const k in s.cd) s.cd[k] -= dt;
      dashStep(s, dt);
      if (!s.enraged && s.hp < s.maxHp * 0.5) {   // fase 2: mais rápido e ondas de choque em anel
        s.enraged = true;
        s.speed *= 1.2;
        s.cooldown *= 0.8;
        s.cd.quake = 1;
        for (const m of s.mats) if (m.userData) m.userData.glow = 0x4a2a00;
        G.markEmissiveDirty?.(s);
        G.showBanner('Fúria do Rei!', 2.5);
        G.ring(s.pos, 4, 0xffb020, 1);
      }
    },
    think(s, dt, target) {
      if (!target) return false;
      const d = flat(s.pos, target.pos);
      if (s.enraged && s.cd.quake <= 0 && d < 7) {   // anel de choque (cole no Rei ou fuja) e depois pisão no centro
        const at = s.pos.clone(), hole = 2.2, outer = 6.5;
        s.vel.set(0, 0, 0);
        s.once('Taunt', 1.1);
        s.busy = 1.6 + 1.1 + 0.3;
        s.cd.quake = 12;
        s.pendingHit = null;
        warn(s, at, outer, 1.6, () => {
          s.once('1H_Melee_Attack_Jump_Chop', 1.4);
          for (const u of liveAllies()) {
            const k = flat(u.pos, at), pad = 0.3 * (u.size || 1);
            if (u.dead || k < hole - pad || k > outer + pad) continue;
            u.takeDamage(s.dmg * 1.1, at, s);
            u.vel?.add(mV.subVectors(u.pos, at).setY(0).normalize().multiplyScalar(5));
          }
          G.ring(at, outer, 0xffb020, 0.8);
          G.ring(at, hole, 0xffb020, 0.6);
          warn(s, at, hole + 0.3, 1.1, () => blast(at, hole + 0.3, s.dmg * 1.2, 0xffb020, { owner: s }),
            { color: 0xff3b30, announce: 'Pisão real — saia do centro' });
        }, { color: 0xffb020, hole, announce: 'Onda de choque — cole no Rei ou afaste-se' });
        return true;
      }
      if (s.cd.summon <= 0 && countAliveSkeletons() < 9) {   // invoca uma onda de lacaios
        s.busy = s.once('Taunt', 1.2);
        s.cd.summon = 18;
        G.popText(s.pos, 'Às armas!', 'evolve');
        around(s.pos, Math.round(1.7 * G.difficulty.count), 2.6, Math.random() * 6).forEach((p, i) =>
          warn(s, p, 0.6, 0.9, () => summon(s.spectral ? 'Ghost' : i % 3 === 2 ? 'Rogue' : 'Minion', p), { color: 0x9b59ff, harmless: true }));   // o Rei Espectral chama fantasmas
        return true;
      }
      if (s.cd.slam <= 0 && d < 3.6) { slam(s, target, 3.2, 1.3, 1, { down: false }); s.cd.slam = 9; return true; }
      if (s.cd.charge <= 0 && d > 3.5 && d < 13) {   // investida em linha
        const dir = new THREE.Vector3(target.pos.x - s.pos.x, 0, target.pos.z - s.pos.z).normalize(), len = Math.min(13, d + 2.5);
        faceNow(s, target.pos);
        s.once('Block', 1);
        s.busy = 1.1 + len / 14 + 0.2;
        s.cd.charge = 12;
        s.pendingHit = null;
        warn(s, s.pos, 0.95, 1.1, () => { s.dash = { dir, left: len, hit: new Set(), speed: 14, mult: 0.8, push: 6, color: 0xffd34d }; s.loop('Running_C'); }, { line: { dir, len }, color: 0xff3b30, announce: 'Investida — saia da linha' });
        return true;
      }
      return false;
    } },

  // chefe da fase 9: machadada em linha, corrente que puxa quem está longe e, em fúria (<50%), giro sangrento
  Executioner: { name: 'Carrasco', title: 'Chefe', model: 'Warrior', hp: 46, dmg: 8, range: 1.7, speed: 1.3, cooldown: 2.0, weapon: 'Skeleton_Axe', attack: '2H_Melee_Attack_Chop',
    attacks: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'], size: 2.1,
    dress(s) {
      paint(s, 0xd8c8b8, 0xff2020, 0x200000);
      meshNamed(s, '_Cloak', (m) => m.color.set(0x3a0c12));
      s.root.getObjectByName('Skeleton_Warrior_Helmet')?.removeFromParent?.();
      const head = boneOf(s, 'head'), chest = boneOf(s, 'chest');
      head.add(piece(GEO.cone, MAT.hood, [0, 0.72, -0.03], [0.34, 0.62, 0.34]), piece(GEO.cyl, MAT.hood, [0, 0.42, -0.02], [0.33, 0.12, 0.33]));
      for (const x of [-1, 1]) chest.add(piece(GEO.box, MAT.ironDark, [x * 0.36, 0.42, 0], [0.26, 0.1, 0.3], [0, 0, -x * 0.3]));
      chest.add(piece(GEO.box, MAT.blood, [0, 0.15, 0.17], [0.5, 0.12, 0.05], [0, 0, 0.5]));
      for (let k = 0; k < 4; k++) boneOf(s, 'hips').add(piece(GEO.torus, MAT.iron, [-0.25 + k * 0.17, 0.1, 0.22], 0.08, [0, Math.PI / 2, 0]));
      boneOf(s, 'handslotr').children?.at(-1)?.scale?.setScalar(1.5);   // machado de carrasco
      s.cd = { cleave: 2.5, hook: 6, whirl: 99 };
      G.showBanner('O Carrasco ergue o machado!', 2.5);
    },
    tick(s, dt) {
      for (const k in s.cd) s.cd[k] -= dt;
      if (!s.enraged && s.hp < s.maxHp * 0.5) {   // fúria: mais rápido, machadadas em leque e giro
        s.enraged = true;
        s.speed *= 1.25;
        s.cooldown *= 0.75;
        s.cd.whirl = 0.5;
        s.cd.cleave = Math.min(s.cd.cleave, 2);
        for (const m of s.mats) if (m.userData) m.userData.glow = 0x4a0000;
        G.markEmissiveDirty?.(s);
        G.showBanner('Fúria do Carrasco!', 2.5);
        G.ring(s.pos, 4, 0xff2020, 1);
      }
    },
    think(s, dt, target) {
      if (!target) return false;
      const d = flat(s.pos, target.pos), fury = s.enraged;
      if (fury && s.cd.whirl <= 0 && liveAllies().some((u) => !u.dead && flat(u.pos, s.pos) < 3.8)) {   // giro sangrento em volta de si
        s.vel.set(0, 0, 0);
        s.once('Taunt', 1.1);
        s.busy = 1.5 + 0.7;
        s.cd.whirl = 9;
        s.pendingHit = null;
        warn(s, s.pos, 3.4, 1.5, () => {
          s.once('2H_Melee_Attack_Spin', 1.4);
          blast(s.pos, 3.4, s.dmg * 1.1, 0xff2020, { owner: s });
          for (const u of liveAllies()) if (!u.dead && flat(u.pos, s.pos) <= 3.7) u.vel.add(mV.subVectors(u.pos, s.pos).setY(0).normalize().multiplyScalar(6));
        }, { color: 0xff2020, announce: 'Giro sangrento — afaste-se do Carrasco' });
        return true;
      }
      if (s.cd.hook <= 0) {   // corrente: puxa o herói mais distante (quase sempre um atirador)
        const far = liveAllies().filter((u) => { const k = flat(u.pos, s.pos); return !u.dead && k > 4.5 && k < 12; })
          .sort((a, b) => (!!b.ranged - !!a.ranged) || flat(b.pos, s.pos) - flat(a.pos, s.pos))[0];
        if (far) {
          const dir = new THREE.Vector3(far.pos.x - s.pos.x, 0, far.pos.z - s.pos.z).normalize(), len = flat(far.pos, s.pos) + 1;
          faceNow(s, far.pos);
          s.vel.set(0, 0, 0);
          s.once('Throw', 1);
          s.busy = 1.1 + 0.4;
          s.cd.hook = fury ? 9 : 12;
          s.pendingHit = null;
          const from = s.pos.clone();
          warn(s, from, 0.65, 1.1, () => {
            G.beam(from, from.clone().addScaledVector(dir, len), 0xb8c0d0);
            for (const u of liveAllies()) if (!u.dead && inLine(u, from, dir, len, 0.65)) {
              u.takeDamage(s.dmg * 0.5, s.pos, s);
              u.pendingHit = null;   // a corrente interrompe o golpe ou feitiço
              u.busy = Math.max(u.busy, 0.45);
              const stop = 1.1 + 0.6 * s.size;
              track({ t: 0.4, step(f, dt) {   // arrasta até a frente do Carrasco
                if (u.dead) return;
                const to = hookPullTo.set(s.pos.x - u.pos.x, 0, s.pos.z - u.pos.z), left = to.length() - stop;
                if (left <= 0) return;
                const next = hookPullNext.copy(u.pos).addScaledVector(to.normalize(), Math.min(left, 22 * dt));
                if (G.world.canStep(u.pos, next)) { u.pos.x = next.x; u.pos.z = next.z; }
              } });
              G.popText(u.pos, 'Puxado!', 'block');
            }
          }, { line: { dir, len }, color: 0x9aa4ff, announce: 'Corrente — saia da linha' });
          return true;
        }
      }
      if (s.cd.cleave <= 0 && d < 5) {   // machadada em linha (em fúria, três em leque)
        faceNow(s, target.pos);
        const dir = forward(s), len = 5.5, time = fury ? 1.05 : 1.25, hit = new Set();
        const clip = s.action('2H_Melee_Attack_Chop').getClip().duration;
        s.vel.set(0, 0, 0);
        s.once('2H_Melee_Attack_Chop', clip / (time + 0.25));
        s.busy = time + 0.45;
        s.cd.cleave = fury ? 4.5 : 6;
        s.pendingHit = null;
        const from = s.pos.clone();
        for (const a of fury ? [-0.55, 0, 0.55] : [0]) {
          const lane = turned(dir, a);
          warn(s, from, 0.95, time, () => {
            for (const u of liveAllies()) if (!u.dead && !hit.has(u) && inLine(u, from, lane, len, 0.95)) {
              hit.add(u);
              u.takeDamage(s.dmg * 1.4, from, s);
              knockDown(u, from, 3);
            }
            G.poof(from.clone().addScaledVector(lane, len * 0.6), 1.2);
          }, { line: { dir: lane, len }, color: 0xff2020, announce: fury ? 'Machadas em leque — saia das linhas' : 'Machadada — saia da linha' });
        }
        return true;
      }
      return false;
    } },

  // chefe final: flutua, raio em cadeia, chuva de crânios, escudo roxo, invoca fantasmas; fase 2 abaixo de 50%
  Lich: { name: 'Lich Supremo', title: 'Chefe final', model: 'Mage', hp: 50, dmg: 5.5, range: 8.5, speed: 1.2, cooldown: 2.2, weapon: 'Skeleton_Staff', ranged: true, mobile: true,
    attack: 'Spellcast_Shoot', move: 'Jump_Idle', walk: 'Jump_Idle', idle: 'Spellcasting', spawn: 'Spawn_Air', size: 1.9,
    dress(s) {
      paint(s, 0xd9c9ff, 0xd070ff, 0x1c0838);
      meshNamed(s, '_Hat', (m) => m.color.set(0x7a3fe0));
      boneOf(s, 'hips').add(piece(GEO.skirt, MAT.robe, [0, -0.15, 0], [0.42, 0.95, 0.42]));
      boneOf(s, 'handslotr').add(piece(GEO.gem, MAT.purple, [-0.15, 1.45, 0], 0.16));
      s.orbit = new THREE.Group();
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; s.orbit.add(piece(GEO.gem, MAT.purple, [Math.cos(a) * 0.75, 1.9, Math.sin(a) * 0.75], 0.1)); }
      s.shieldMat = new THREE.MeshBasicMaterial({ color: 0xb36bff, transparent: true, opacity: 0.25, depthWrite: false });
      s.bubble = piece(GEO.ball, s.shieldMat, [0, 1.05, 0], [0.85, 1.1, 0.85]);
      s.bubble.castShadow = false;
      s.root.add(s.orbit, s.bubble);
      s.boltMat = purpleBolt;
      s.shieldMax = s.maxHp * 0.18;
      s.shieldHp = s.shieldMax;
      s.cd = { chain: 4, rain: 7, summon: 9, shield: 0 };
      s.bob = 0;
      G.showBanner('O Lich Supremo desperta!', 2.5);
    },
    tick(s, dt) {
      for (const k in s.cd) s.cd[k] -= dt;
      s.bob += dt;
      s.hover = 0.45 + Math.sin(s.bob * 2) * 0.1;
      s.orbit.rotation.y += dt * (s.enraged ? 3 : 1.5);
      s.bubble.visible = s.shieldHp > 0;
      s.shieldMat.opacity = 0.2 + Math.sin(s.bob * 5) * 0.06;
      if (!s.enraged && s.hp < s.maxHp * 0.5) {   // fase 2: mais rápido e mais invocações
        s.enraged = true;
        s.speed *= 1.3;
        s.cooldown *= 0.7;
        s.cd.summon = 0;
        s.cd.shield = Math.min(s.cd.shield, 3);
        for (const m of s.mats) if (m.userData) m.userData.glow = 0x4a0a3a;
        G.markEmissiveDirty?.(s);
        G.showBanner('Fase 2: o Lich se enfurece!', 2.5);
        G.ring(s.pos, 4, 0xff4fd8, 1);
      }
    },
    hurt(s, n) {
      if (!(s.shieldHp > 0)) return n;
      s.shieldHp -= n;
      G.popText(s.pos, Math.round(n), 'block');
      if (s.shieldHp <= 0) {   // escudo quebrado: fica zonzo e vulnerável
        s.shieldHp = 0;
        s.cd.shield = s.enraged ? 14 : 20;
        s.stunT = 2.5;
        s.pendingHit = null;
        G.showBanner('Escudo quebrado!', 1.8);
        G.ring(s.pos, 3, 0xb36bff, 0.8);
      }
      return 0;
    },
    think(s, dt, target) {
      if (!target) return true;
      const d = flat(s.pos, target.pos), fury = s.enraged;
      if (s.shieldHp <= 0 && s.cd.shield <= 0) {
        s.busy = s.once('Spellcast_Raise', 1.3);
        s.shieldHp = s.shieldMax * (fury ? 0.8 : 1);
        s.cd.shield = 99;
        G.popText(s.pos, 'Escudo!', 'evolve');
        G.ring(s.pos, 2.5, 0xb36bff, 0.9);
        return true;
      }
      if (s.cd.summon <= 0 && countAliveSkeletons() < 10) {
        s.busy = s.once('Spellcast_Summon', 1.2);
        s.cd.summon = fury ? 10 : 15;
        around(s.pos, Math.round((fury ? 2.6 : 1.8) * G.difficulty.count), 2.8, Math.random() * 6).forEach((p) =>
          warn(s, p, 0.6, 0.9, () => summon('Ghost', p), { color: 0x9b59ff, harmless: true }));
        return true;
      }
      if (s.cd.rain <= 0) {   // chuva de crânios nas áreas marcadas
        s.busy = s.once('Spellcast_Raise', 1.1);
        s.cd.rain = fury ? 6.5 : 9;
        const foes = liveAllies();
        const nextLiving = (start) => {
          for (let n = 0; n < foes.length; n++) { const index = (start + n) % foes.length; if (!foes[index].dead) return index; }
          return -1;
        };
        if (!foes.length) return true;
        let start = 0;
        for (let i = 0; i < (fury ? 4 : 2); i++) {
          const index = nextLiving(start);
          if (index < 0) break;
          const f = foes[index]; start = (index + 1) % foes.length;
          const at = f.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6));
          at.y = G.world.groundHeight(at.x, at.z);
          warn(s, at, 1.5, 1.5 + i * 0.15, () => dropSkull(at, s.dmg * 0.8, s), { color: 0xb050ff, announce: 'Chuva de crânios — saia do círculo' });
        }
        return true;
      }
      if (s.cd.chain <= 0 && d <= s.range + 1) {   // raio em cadeia: marca o primeiro alvo e salta entre os heróis
        faceNow(s, target.pos);
        s.busy = s.once('Spellcast_Shoot', 0.8);
        s.cd.chain = fury ? 5 : 7;
        warn(s, target.pos, 0.9, 0.8, () => {
          let at = s.pos, next = target;
          const hit = new Set();
          for (let i = 0; i < (fury ? 4 : 3) && next; i++) {
            G.beam(at, next.pos, 0xc77dff);
            next.takeDamage(s.dmg * 0.75, at, s);
            hit.add(next);
            at = next.pos;
            next = nearestOf(at, liveAllies().filter((u) => !u.dead && !hit.has(u) && flat(u.pos, at) < 5));
          }
        }, { color: 0xb36bff, follow: target, announce: 'Raio marcado — prepare-se para sair' });
        return true;
      }
      if (d > s.range) s.moveTo(target.pos, dt);
      else if (s.face(target.pos, dt) < 0.5 && s.attackTimer <= 0) s.attack(target, s.attackAnim);
      return true;
    } },

  // chefe do capítulo VII: esqueleto de dragão. No chão: sopro de ossos em linha (veneno) e, em fúria, cauda em volta.
  // Abaixo de 72% e de 38% levanta voo (só ataques à distância o alcançam), faz rasantes em faixas marcadas e pousa exausto.
  BoneDragon: { name: 'Dragão de Ossos', title: 'Chefe', model: 'Warrior', hp: 50, dmg: 7, range: 1.9, speed: 1.35, cooldown: 2.0, attack: '2H_Melee_Attack_Chop',
    attacks: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'], size: 2.3,
    dress(s) {
      paint(s, 0xe9e1c9, DRAGON_COLOR, 0x062a20);
      s.root.getObjectByName('Skeleton_Warrior_Helmet')?.removeFromParent?.();
      meshNamed(s, '_Cloak', (m) => m.color.set(0x24413c));
      const head = boneOf(s, 'head'), chest = boneOf(s, 'chest'), hips = boneOf(s, 'hips');
      // crânio de dragão: focinho, mandíbula, dentes, chifres e crista
      head.add(piece(GEO.box, MAT.bone, [0, 0.3, 0.42], [0.32, 0.2, 0.52]), piece(GEO.box, MAT.boneDark, [0, 0.14, 0.38], [0.26, 0.07, 0.46]));
      for (const x of [-1, 1]) {
        head.add(piece(GEO.cone, MAT.boneDark, [x * 0.2, 0.62, -0.2], [0.07, 0.55, 0.07], [-0.95, 0, -x * 0.3]));
        head.add(piece(GEO.gem, MAT.wyrm, [x * 0.08, 0.36, 0.69], 0.035));
        for (let k = 0; k < 3; k++) head.add(piece(GEO.cone, MAT.bone, [x * 0.12, 0.17, 0.3 + k * 0.14], [0.025, 0.09, 0.025], [Math.PI, 0, 0]));
      }
      for (let k = 0; k < 3; k++) head.add(piece(GEO.cone, MAT.bone, [0, 0.62 - k * 0.04, -0.05 - k * 0.14], [0.05, 0.2, 0.05], [-0.6, 0, 0]));
      for (let k = 0; k < 4; k++) chest.add(piece(GEO.cone, MAT.bone, [0, 0.1 + k * 0.15, -0.3], [0.05, 0.28, 0.05], [-1.1, 0, 0]));   // espinhos do dorso
      // asas: braço de osso, três dedos e membrana escura entre eles
      s.wings = [-1, 1].map((x) => {
        const wing = new THREE.Group();
        wing.position.set(x * 0.2, 0.45, -0.22);
        wing.add(piece(GEO.cyl, MAT.bone, [x * 0.4, 0.26, 0], [0.05, 0.95, 0.05], [0, 0, -x * 1.0]));
        const tip = [x * 0.8, 0.51];
        for (const t of [0.35, 0.85, 1.35]) {
          const dx = x * Math.sin(t), dy = -Math.cos(t), len = 1.05 - t * 0.25;
          wing.add(piece(GEO.cyl, MAT.boneDark, [tip[0] + dx * len / 2, tip[1] + dy * len / 2, 0], [0.025, len, 0.025], [0, 0, Math.PI + x * t]));
          wing.add(piece(GEO.cone, MAT.membrane, [tip[0] + dx * len * 0.45 - x * 0.18, tip[1] + dy * len * 0.45 + 0.05, -0.01], [0.32, len * 0.95, 0.02], [0, 0, x * t]));
        }
        wing.add(piece(GEO.cone, MAT.boneDark, [tip[0], tip[1] + 0.08, 0], [0.05, 0.16, 0.05], [0, 0, -x * 0.5]));
        wing.userData = { ...wing.userData, side: x };
        chest.add(wing);
        return wing;
      });
      s.tail = new THREE.Group();
      for (let k = 0; k < 6; k++) s.tail.add(piece(GEO.cone, k === 5 ? MAT.boneDark : MAT.bone, [0, -0.04 - k * 0.05, -0.28 - k * 0.24], [0.13 - k * 0.018, 0.32, 0.13 - k * 0.018], [-Math.PI / 2 - 0.15, 0, 0]));
      hips.add(s.tail);
      s.cd = { breath: 3, tail: 4 };
      s.flights = 0;
      s.flight = null;
      s.flap = 0;
      G.showBanner('O Dragão de Ossos desperta!', 2.5);
    },
    tick(s, dt) {
      for (const k in s.cd) s.cd[k] -= dt;
      s.flap += dt * (s.flight ? 9 : 2.2);
      for (const w of s.wings || []) w.rotation.z = w.userData.side * (s.flight ? 0.15 + Math.sin(s.flap) * 0.55 : 0.35 + Math.sin(s.flap) * 0.08);
      if (s.tail) s.tail.rotation.y = Math.sin(s.flap * 0.7) * 0.25;
      s.hover = (s.hover || 0) + (dragonHeight(s) - (s.hover || 0)) * Math.min(1, dt * 5);
      if (!s.enraged && s.hp < s.maxHp * 0.5) {   // fúria: mais rápido, cauda e rasantes com chuva de ossos
        s.enraged = true;
        s.speed *= 1.15;
        s.cooldown *= 0.85;
        for (const m of s.mats) if (m.userData) m.userData.glow = 0x0a4a38;
        G.markEmissiveDirty?.(s);
        G.showBanner('Fúria do Dragão!', 2.5);
        G.ring(s.pos, 4, DRAGON_COLOR, 1);
      }
      if (s.flight) return dragonFly(s, dt);
      if (!s.spawning && s.flights < DRAGON_FLIGHTS.length && s.hp < s.maxHp * DRAGON_FLIGHTS[s.flights]) dragonTakeOff(s);
    },
    think(s, dt, target) {
      if (s.flight) return true;
      if (!target) return false;
      const d = flat(s.pos, target.pos);
      if (s.enraged && s.cd.tail <= 0 && liveAllies().some((u) => !u.dead && flat(u.pos, s.pos) < 3.6)) {   // cauda em volta de si
        s.vel.set(0, 0, 0);
        s.once('Taunt', 1.1);
        s.busy = 1.3 + 0.5;
        s.cd.tail = 10;
        s.pendingHit = null;
        const at = s.pos.clone();
        warn(s, at, 3.4, 1.3, () => {
          blast(at, 3.4, s.dmg, DRAGON_COLOR, { owner: s });
          for (const u of liveAllies()) if (!u.dead && flat(u.pos, at) <= 3.7) u.vel.add(mV.subVectors(u.pos, at).setY(0).normalize().multiplyScalar(6));
        }, { color: DRAGON_COLOR, announce: 'Cauda — afaste-se do dragão' });
        return true;
      }
      if (s.cd.breath <= 0 && d < 8.5) {   // sopro de ossos: linha verde que envenena
        faceNow(s, target.pos);
        const dir = new THREE.Vector3(target.pos.x - s.pos.x, 0, target.pos.z - s.pos.z).normalize(), len = 8, time = s.enraged ? 1.0 : 1.2;
        const from = s.pos.clone();
        s.vel.set(0, 0, 0);
        s.once('Taunt', 1.2);
        s.busy = time + 0.4;
        s.cd.breath = s.enraged ? 6.5 : 8;
        s.pendingHit = null;
        warn(s, from, 1.0, time, () => {
          G.beam(from, from.clone().addScaledVector(dir, len), DRAGON_COLOR);
          for (const u of liveAllies()) if (!u.dead && inLine(u, from, dir, len, 1.0)) {
            u.takeDamage(s.dmg * 0.9, from, s);
            poisonHero(u, 4, s.dmg * 0.2, s);
          }
        }, { line: { dir, len }, color: DRAGON_COLOR, announce: 'Sopro de ossos — saia da linha' });
        return true;
      }
      return false;
    },
    death(s) { s.flight = null; s.hover = 0; } },
};

function dropSkull(at, dmg, owner) {
  const skull = new THREE.Group();
  skull.add(piece(GEO.ball, MAT.bone, [0, 0, 0], 0.32), piece(GEO.box, MAT.bone, [0, -0.24, 0.05], [0.3, 0.14, 0.26]));
  for (const x of [-0.11, 0.11]) skull.add(piece(GEO.ball, MAT.dark, [x, 0.03, 0.26], 0.08));
  skull.position.copy(at);
  G.scene.add(skull);
  track({ owner, t: 0.35, life: 0.35, meshes: [skull], step(f) { skull.position.y = at.y + 0.4 + 6.6 * Math.max(0, f.t / f.life); skull.rotation.x += 0.3; },
    end: () => blast(at, 1.5, dmg, 0xb050ff, { owner }) });
}

// ---------- ganchos chamados pelo main.js ----------
// todo esqueleto que cai vira cova por alguns segundos (o sacerdote pode reerguer)
export function monsterDied(s) {
  s.kind?.death?.(s);
  if (s.boss || s.enemyKind === 'Skull' || s.summoned && s.enemyKind === 'Ghost') return;   // crânios do enxame não viram cova
  mGraves.push({ type: s.enemyKind, pos: s.pos.clone(), t: 8 });
  if (mGraves.length > 12) mGraves.shift();
}

export function updateMonsterFx(dt) {
  if (ownedFxCount) refreshFxUnits();
  else mFxUnits.clear();
  for (let i = mFx.length - 1; i >= 0; i--) {
    const f = mFx[i];
    f.t -= dt;
    const broken = f.owner && (f.owner.dead || f.owner.stunT > 0 || !mFxUnits.has(f.owner));
    if (!broken) f.step?.(f, dt);
    if (broken || f.t <= 0) {
      mFx.splice(i, 1);
      releaseFx(f);
      if (!broken) f.end?.(f);
    }
  }
  if (!ownedFxCount) mFxUnits.clear();
  for (let i = mGraves.length - 1; i >= 0; i--) if ((mGraves[i].t -= dt) <= 0) mGraves.splice(i, 1);
  tickAfflictions(dt);   // depois dos efeitos: o lamaçal renova a lentidão antes de contar
  updateBossBar();
}

export function clearMonsterFx() {
  clearAfflictions();
  while (mFx.length) releaseFx(mFx.pop());
  ownedFxCount = 0;
  mFxUnits.clear();
  mBossWarnings.clear();
  mGraves.length = 0;
  mSeen.clear();
  bossCacheValid = false;
  bossCacheUnit = null;
  bossCacheUnits = null;
  bossCacheLength = -1;
  bossCacheFirstUnit = bossCacheLastUnit = null;
  updateBossBar();
}

// estreia gradual: cada tipo entra numa fase e fica mais comum depois; dificuldades maiores trazem mais variedade
const ROSTER = [['Shieldbearer', 2, 0.11, 0.025], ['Bomber', 3, 0.1, 0.025], ['Ghost', 4, 0.12, 0.03], ['Priest', 5, 0.07, 0.07],
  ['Venomer', 5, 0.06, 0.025], ['Skull', 7, 0.05, 0.02], ['Shaman', 8, 0.05, 0.03], ['Witch', 9, 0.05, 0.025], ['DarkKnight', 10, 0.05, 0.025]];   // o enxame já traz 3 crânios por sorteio
const BOSS_PHASES = [6, 9, 12, 13];
export const isBossPhase = (p) => BOSS_PHASES.includes(p);
// próxima fase de chefe a partir de `p` (inclusive): fonte única para HUD e dica de derrota
// `override` (mission.boss) pode pôr um chefe numa fase fora da lista (o dragão na fase 11)
export const nextBossPhase = (p, override = null) => [...BOSS_PHASES, override?.phase].filter((phase) => phase >= p).sort((a, b) => a - b)[0] ?? null;
export const missionBossPhase = (p, override = null) => isBossPhase(p) || override?.phase === p;
const GOLEM_PHASES = [4, 8];
// inimigos próprios de uma missão (mission.foes): estreiam na primeira onda e entram no sorteio só ali
const MISSION_FOES = { Burrower: { rate: 0.08, cap: 2 }, Bannerbearer: { rate: 0.06, cap: 1 } };
export function pickMonster(p, type) {
  const D = G.difficulty, variety = D.count / 1.1;
  const foes = (G.game?.mission?.foes || []).filter((kind) => MISSION_FOES[kind]);
  for (const kind of foes) if (!mSeen.has(kind)) {
    mSeen.add(kind);
    G.showBanner(`Novo inimigo: ${MONSTER_TYPES[kind].name}!`, 2.5);
    return kind;
  }
  // Campanhas e atalhos podem começar no meio da jornada: estreias anteriores
  // já são conhecidas e não devem ser forçadas todas na primeira onda.
  for (const [kind, from] of ROSTER) if (p > from) mSeen.add(kind);
  for (const [kind, from] of ROSTER) if (p >= from && !mSeen.has(kind)) {
    mSeen.add(kind);
    if (p <= from + 1) G.showBanner(`Novo inimigo: ${MONSTER_TYPES[kind].name}!`, 2.5);
    return kind;
  }
  let r = Math.random();
  for (const kind of foes) {
    const w = countOf(kind) >= MISSION_FOES[kind].cap ? 0 : MISSION_FOES[kind].rate * variety;
    if (r < w) return kind;
    r -= w;
  }
  for (const [kind, from, max, grow] of ROSTER) {
    if (p < from) continue;
    let w = Math.min(max, grow * (p - from + 1)) * variety;
    if (kind === 'Priest' && countOf('Priest') >= (p >= 9 && D.count >= HARD_COUNT ? 2 : 1)) w = 0;
    if (kind === 'Shaman' && countOf('Shaman') >= (p >= 11 && D.count >= HARD_COUNT ? 2 : 1)) w = 0;
    if (kind === 'DarkKnight' && countOf('DarkKnight') >= 2) w = 0;
    if ((kind === 'Venomer' || kind === 'Witch') && countOf(kind) >= 2) w = 0;
    if (r < w) return kind;
    r -= w;
  }
  if (p >= 9 && D.count >= HARD_COUNT && !countOf('Golem') && Math.random() < 0.015) return 'Golem';
  return type;
}
// quem fecha a onda: Rei (6), Carrasco (9), Lich (12); golem nas fases 4 e 8
// `override` (mission.boss = { phase, kind, mod }) troca o chefe daquela fase numa missão
export const waveLeader = (p, bossPending, override = null) => bossPending
  ? (override?.phase === p && MONSTER_TYPES[override.kind] ? override.kind : p >= 12 ? 'Lich' : p >= 9 ? 'Executioner' : 'King')
  : GOLEM_PHASES.includes(p) ? 'Golem' : null;

const CAMPAIGN_TACTICS = {
  Shieldbearer: ['◈', 'Bloqueia golpes frontais; flanqueie o escudo.'],
  Bomber: ['✹', 'Corre para explodir; elimine-o à distância ou afaste o grupo.'],
  Ghost: ['☽', 'Atravessa a formação e persegue quem ataca de longe.'],
  Priest: ['✚', 'Cura e revive esqueletos; tente eliminá-lo primeiro.'],
  Golem: ['♟', 'Mini-chefe pesado; saia do círculo antes da pancada.'],
  King: ['♜', 'Chefe de combate próximo; esquive da pancada anunciada. Em fúria (<50%), onda de choque em anel: cole nele ou afaste-se.'],
  Venomer: ['☣', 'Marca uma linha verde e dispara virote venenoso; saia da linha. Cura em área limpa o veneno.'],
  Witch: ['☄', 'Marca um lamaçal roxo que deixa lento; saia da área ou derrube a bruxa.'],
  Lich: ['☠', 'Chefe final com escudo, invocações e ataques marcados no chão.'],
  Skull: ['❂', 'Bando de crânios voadores e frágeis; cada mergulho marca um círculo laranja. Golpes em área limpam o enxame.'],
  Shaman: ['❖', 'Cobre aliados com escudo de ossos; derrube ou atordoe o xamã e o escudo some.'],
  DarkKnight: ['⚔', 'Marca uma linha vermelha e investe com a lança; saia da linha e revide enquanto ele fica exausto. Na câmara do coração, ele guarda a fonte da maldição.'],
  Executioner: ['⚒', 'Chefe da fase 9: machadada em linha, corrente que puxa quem está longe e giro em fúria abaixo de 50%.'],
  Burrower: ['⛏', 'Some na terra e marca um círculo marrom sob um herói; saia do círculo e bata enquanto ele fica zonzo.'],
  Bannerbearer: ['⚑', 'Anel laranja acelera os esqueletos dentro dele; derrube o estandarte primeiro ou atordoe-o.'],
  BoneDragon: ['☬', 'Chefe: sopro de ossos em linha. Abaixo de 72% e 38% voa (só ataques à distância alcançam), faz rasantes em faixas marcadas e pousa exausto.'],
};

/** Lista ameaças possíveis num trecho usando as mesmas fases de estreia e chefes do combate. */
export function campaignThreats(from, to, goal = null, mission = null) {
  const first = Math.max(1, Math.trunc(Number(from) || 1));
  const last = Math.max(first, Math.trunc(Number(to) || first));
  const found = new Map();
  const override = mission?.boss || null;
  const add = (id, phase, optional = false, possible = false, mod = null) => {
    const type = MONSTER_TYPES[id];
    const [icon, detail] = mod ? [mod.icon, mod.detail] : CAMPAIGN_TACTICS[id] || ['✦', 'Ameaça especial do trecho.'];
    found.set(id, { id, name: mod?.name || type?.name || id, icon, detail, phase: Math.max(first, phase), optional, possible });
  };

  for (const [kind, debut] of ROSTER) if (last >= debut) add(kind, debut, false, first > debut);
  for (const phase of GOLEM_PHASES) if (phase >= first && phase <= last) add('Golem', phase);
  if (last >= 9 && !found.has('Golem')) add('Golem', 9, true); // só pode surgir aleatoriamente nas dificuldades altas
  for (const phase of new Set([...BOSS_PHASES, override?.phase])) if (phase >= first && phase <= last && missionBossPhase(phase, override)) {
    add(waveLeader(phase, true, override), phase, false, false, override?.phase === phase ? BOSS_MODS[override.mod] : null);
  }
  for (const kind of mission?.foes || []) if (MISSION_FOES[kind]) add(kind, first);
  if (goal?.type === 'twin') add('Executioner', last);   // trono: o Carrasco volta ao lado do Lich
  if (goal?.type === 'bosses') for (const id of goal.bosses || []) add(id, last);

  return [...found.values()].sort((a, b) => a.phase - b.phase || a.name.localeCompare(b.name, 'pt-BR'));
}

// barra grande do chefe no topo da tela
let mBar = null, mBarElement = null, mBarDocument = null;
let bossCacheValid = false, bossCacheUnit = null, bossCacheUnits = null, bossCacheLength = -1;
let bossCacheFirstUnit = null, bossCacheLastUnit = null;
function updateBossBar() {
  if (typeof document === 'undefined') return;
  if (document !== mBarDocument) {
    mBarDocument = document;
    mBarElement = document.getElementById('bossBar');
  }
  const el = mBarElement;
  if (!el) return;
  const units = G.units;
  const groupedGoal = G.game?.mission?.goal?.type === 'bosses';
  const unitCount = units?.length ?? 0;
  const firstUnit = unitCount ? units[0] : null, lastUnit = unitCount ? units[unitCount - 1] : null;
  if (!bossCacheValid || units !== bossCacheUnits || bossCacheUnit?.dead || bossCacheUnit?.root?.parent === null
    || !bossCacheUnit && (unitCount !== bossCacheLength || firstUnit !== bossCacheFirstUnit || lastUnit !== bossCacheLastUnit)) {
    bossCacheUnit = units?.find((u) => u.team === 'skeleton' && !u.dead && (groupedGoal ? u.phaseBoss : u.kind?.title)) || null;
    bossCacheUnits = units;
    bossCacheLength = unitCount;
    bossCacheFirstUnit = firstUnit;
    bossCacheLastUnit = lastUnit;
    bossCacheValid = true;
  }
  const b = bossCacheUnit;
  if (!b) { if (!el.hidden) el.hidden = true; mBar = null; return; }
  const rosterKey = groupedGoal ? (G.game?.mission?.goal?.bosses || []).join('|') : '';
  const rebuildBar = !mBar || mBar.grouped !== groupedGoal || (groupedGoal ? mBar.rosterKey !== rosterKey : mBar.unit !== b);
  if (rebuildBar) {
    const bossTitle = (unit) => unit?.kind?.title || unit?.kind?.name || unit?.enemyKind || 'Guardião';
    const roster = groupedGoal ? (G.game?.mission?.goal?.bosses || []).map((id) => {
      const unit = units?.find((candidate) => candidate.phaseBoss && candidate.enemyKind === id);
      const title = bossTitle(unit || { enemyKind: id });
      const kindClass = String(id).toLowerCase().replace(/[^a-z0-9-]/g, '');
      return `<div class="boss-member ${kindClass}" data-boss="${id}"><div class="boss-member-label"><span class="boss-member-name">${title}</span><b class="boss-member-hp">100%</b></div><div class="boss-member-track" role="meter" aria-label="Vida: ${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i class="boss-member-fill"></i></div><span class="boss-member-focus" hidden></span></div>`;
    }).join('') : '';
    el.innerHTML = `<span class="boss-name">${groupedGoal ? 'Guardiões do coração' : b.kind.name} <small>${groupedGoal ? '' : b.kind.title}</small></span><div class="boss-track"><i class="boss-fill"></i><i class="boss-shield"></i></div>${groupedGoal ? `<div class="boss-roster" aria-label="Vida individual dos guardiões">${roster}</div>` : ''}<div class="boss-telegraph" role="status" aria-live="polite" hidden><span class="boss-warning-owner"></span><span class="boss-warning-text"></span><span class="warning-countdown"></span><i class="warning-progress"></i></div>`;
    mBar = { unit: b, fill: el.querySelector('.boss-fill'), shield: el.querySelector('.boss-shield'), hp: -1, sh: -1,
      roster: groupedGoal && typeof el.querySelectorAll === 'function' ? Array.from(el.querySelectorAll('.boss-member'), (row) => ({
        id: row.dataset?.boss || row.getAttribute?.('data-boss') || '', row, fill: row.querySelector?.('.boss-member-fill'), hpLabel: row.querySelector?.('.boss-member-hp'),
        track: row.querySelector?.('.boss-member-track'), focusLabel: row.querySelector?.('.boss-member-focus'), hp: -1, defeated: null, labelDefeated: null, focus: 0, nextFocus: 0,
      })) : [],
      telegraph: el.querySelector('.boss-telegraph'), warningOwner: el.querySelector('.boss-warning-owner'), warningText: el.querySelector('.boss-warning-text'), countdown: el.querySelector('.warning-countdown'), progress: el.querySelector('.warning-progress'), second: -1,
      name: el.querySelector('.boss-name'), subtitle: el.querySelector('.boss-name small'), grouped: groupedGoal, rosterKey, enraged: null, warningVisible: null };
    el.hidden = false;
  }
  let currentHp = Math.max(0, b.hp), maxHp = b.maxHp, shieldHp = (b.shieldHp || 0) + (b.ward?.hp || 0), standing = b.dead ? 0 : 1;
  if (groupedGoal) {
    currentHp = maxHp = shieldHp = standing = 0;
    for (const row of mBar.roster) row.nextFocus = 0;
    for (const unit of units || []) {
      if (unit.team === 'hero' && !unit.dead && unit.targetFocus?.phaseBoss && !unit.targetFocus.dead) {
        for (const row of mBar.roster) if (row.id === unit.targetFocus.enemyKind) row.nextFocus++;
      }
      if (unit.phaseBoss) {
        maxHp += unit.maxHp;
        if (!unit.dead) { standing++; currentHp += Math.max(0, unit.hp); shieldHp += (unit.shieldHp || 0) + (unit.ward?.hp || 0); }
        for (const row of mBar.roster) if (row.id === unit.enemyKind) {
          const defeated = unit.dead;
          const percent = defeated ? 0 : Math.round(Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp))) * 100);
          if (percent !== row.hp || defeated !== row.labelDefeated) {
            row.fill.style.width = percent + '%';
            row.hpLabel.textContent = defeated ? 'Derrotado' : percent + '%';
            row.track.setAttribute('aria-valuenow', String(percent));
            row.hp = percent;
            row.labelDefeated = defeated;
          }
          if (row.defeated !== defeated) { row.row.classList.toggle('defeated', defeated); row.defeated = defeated; }
        }
      }
    }
    for (const row of mBar.roster) if (row.focus !== row.nextFocus) {
      row.focus = row.nextFocus;
      row.focusLabel.textContent = row.focus ? `Foco · ${row.focus}` : '';
      row.focusLabel.hidden = row.focus === 0;
      row.row.classList.toggle('focused', row.focus > 0);
    }
    const total = G.game?.mission?.goal?.bosses?.length || 3;
    mBar.name.firstChild.textContent = 'Guardiões do coração ';
    mBar.subtitle.textContent = `${standing}/${total} chefes`;
  }
  const hp = maxHp ? Math.round((currentHp / maxHp) * 1000) / 10 : 0, sh = maxHp ? Math.round((shieldHp / maxHp) * 1000) / 10 : 0;
  if (hp !== mBar.hp) { mBar.fill.style.width = hp + '%'; mBar.hp = hp; }
  if (sh !== mBar.sh) { mBar.shield.style.width = sh + '%'; mBar.sh = sh; }
  let enraged = !!b.enraged;
  if (groupedGoal) for (const unit of units || []) if (unit.phaseBoss && !unit.dead && unit.enraged) { enraged = true; break; }
  if (mBar.enraged !== enraged) { el.classList.toggle('enraged', enraged); mBar.enraged = enraged; }
  let warning = null;
  for (const fx of mBossWarnings) {
    if (fx.alive && fx.warning && (fx.owner === b || groupedGoal && fx.owner?.phaseBoss && !fx.owner.dead) && fx.announce && fx.t > 0 && (!warning || fx.t < warning.t)) warning = fx;
  }
  const warningVisible = !!warning;
  if (mBar.warningVisible !== warningVisible) { mBar.telegraph.hidden = !warningVisible; mBar.warningVisible = warningVisible; }
  if (warning) {
    const ownerName = groupedGoal ? (warning.owner?.kind?.title || warning.owner?.kind?.name || warning.owner?.enemyKind || 'Guardião') : '';
    if (mBar.warningOwner.textContent !== ownerName) mBar.warningOwner.textContent = ownerName;
    if (mBar.warningText.textContent !== warning.announce) mBar.warningText.textContent = warning.announce;
    const second = Math.ceil(warning.t);
    if (mBar.second !== second) { mBar.countdown.textContent = `${second} s`; mBar.second = second; }
    const progress = Math.max(0, Math.min(1, 1 - warning.t / warning.life));
    mBar.progress.style.transform = `scaleX(${progress})`;
  } else {
    if (mBar.warningOwner.textContent) mBar.warningOwner.textContent = '';
    if (mBar.second !== -1) mBar.second = -1;
  }
}
