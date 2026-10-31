const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const monstersPath = process.env.SPAWN_DISTANCE_MONSTERS_SOURCE
  ? path.resolve(process.env.SPAWN_DISTANCE_MONSTERS_SOURCE)
  : path.join(__dirname, '..', 'monsters.js');
const source = fs.readFileSync(monstersPath, 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setY(y) { this.y = y; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this; }
}
class DisplayObject {
  constructor() {
    this.position = new Vector3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { set() {}, setScalar() {} };
    this.children = [];
  }
  add(...objects) { this.children.push(...objects); }
}
class Material { constructor(options = {}) { Object.assign(this, options); this.dispose = () => {}; } }
class Geometry {}

function runCase(kind) {
  const THREE = {
    Vector3, Group: DisplayObject, Mesh: DisplayObject,
    MeshLambertMaterial: Material, MeshBasicMaterial: Material,
    BoxGeometry: Geometry, SphereGeometry: Geometry, ConeGeometry: Geometry, CylinderGeometry: Geometry,
    OctahedronGeometry: Geometry, CircleGeometry: Geometry, RingGeometry: Geometry, PlaneGeometry: Geometry, TorusGeometry: Geometry,
    DoubleSide: 2,
  };
  const context = vm.createContext({ THREE, Math });
  vm.runInContext(source, context);

  const hero = { pos: new Vector3(30, 0, 30), size: 1, dead: false };
  const units = [];
  const game = { phase: kind === 'King' ? 6 : 12, over: false };
  const horizontalDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  class Skeleton {
    constructor(type, phase) {
      this.enemyKind = type;
      this.phase = phase;
      this.team = 'skeleton';
      this.dead = false;
      this.stunT = 0;
      this.size = 1;
      this.pos = new Vector3();
      this.root = new DisplayObject();
      this.busy = 0;
      this.once = () => 1;
      units.push(this);
    }
  }
  const safe = (point, type = 'Minion') => {
    if (!point || game.over || horizontalDistance(point, hero.pos) < 14.25) return false;
    const size = type === 'Ghost' ? 1 : 1;
    return units.every((unit) => unit.dead || unit.team !== 'skeleton'
      || horizontalDistance(unit.pos, point) >= Math.max(2.2, (size + (unit.size || 1)) * 0.85));
  };
  const findSafe = (center, type = 'Minion', reserved = []) => {
    const accepts = (point) => safe(point, type)
      && reserved.every((other) => horizontalDistance(point, other) >= 3.2);
    if (accepts(center.clone())) return center.clone();
    for (let radius = 1.5; radius <= 25; radius += 1.25) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const point = center.clone().add(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        if (accepts(point)) return point;
      }
    }
    return null;
  };
  const boss = new Skeleton(kind, game.phase);
  boss.boss = true;
  boss.phaseBoss = true;
  boss.pos.set(0, 0, 0);
  boss.size = kind === 'King' ? 2 : 1.9;
  boss.maxHp = boss.hp = 100;
  boss.dmg = 10;
  boss.range = 8;
  boss.busy = 0;
  boss.cd = kind === 'King'
    ? { slam: 99, summon: 0, charge: 99, quake: 99 }
    : { summon: 0, shield: 99, rain: 99, chain: 99 };
  boss.shieldHp = 10;
  boss.enraged = false;
  boss.vel = { set() {} };

  Object.assign(context, { Skeleton, hero, units, boss, game, safe, findSafe });
  vm.runInContext(`linkMonsters({
    Skeleton, units, heroes: () => [hero], allies: () => [hero], skeletonsAlive: () => units,
    livingAllies: () => [hero], difficulty: { count: 0.5 }, game,
    scene: { add() {}, remove() {} }, world: { groundHeight: () => 0 },
    isSafeSkeletonSummonPoint: (point, type) => safe(point, type),
    findSafeSkeletonSummonPoint: (point, type, reserved) => findSafe(point, type, reserved),
    ring() {}, poof() {}, beam() {}, popText() {}, showBanner() {},
  });
  MONSTER_TYPES.${kind}.think(boss, 0, hero);`, context);

  const initialWarning = vm.runInContext('mFx.find((fx) => fx.warning)', context);
  assert.ok(initialWarning, `${kind}: the summon starts with a visible warning`);
  assert.ok(horizontalDistance(initialWarning.at, hero.pos) >= 14.25,
    `${kind}: the original warning point is safe while the hero is far away`);

  hero.pos.copy(initialWarning.at); // o herói entra no ponto depois do telegraph começar
  vm.runInContext('updateMonsterFx(1)', context);
  const summonedAfterFirstImpact = units.filter((unit) => unit.summoned);
  assert.equal(summonedAfterFirstImpact.length, 0,
    `${kind}: entering the marked point during the warning must not cause an unsafe spawn`);

  const retryWarning = vm.runInContext('mFx.find((fx) => fx.warning)', context);
  assert.ok(retryWarning, `${kind}: a rejected point is telegraphed again at a replacement location`);
  assert.ok(horizontalDistance(retryWarning.at, hero.pos) >= 14.25,
    `${kind}: the replacement warning remains at least 14.25 m from the hero`);

  vm.runInContext('updateMonsterFx(1)', context);
  const summoned = units.filter((unit) => unit.summoned);
  assert.ok(summoned.length > 0, `${kind}: the summon proceeds after a safe replacement point is telegraphed`);
  assert.ok(summoned.every((unit) => horizontalDistance(unit.pos, hero.pos) >= 14.25),
    `${kind}: every actual spawn is at least 14.25 m from the hero`);
}

runCase('King');
runCase('Lich');
console.log('OK: invocações do Rei e do Lich são revalidadas se heróis entram na área durante o aviso');
