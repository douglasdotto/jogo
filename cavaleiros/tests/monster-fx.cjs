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
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this; }
}

class Group {
  constructor() {
    this.position = new Vector3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { set() {}, setScalar() {} };
    this.children = [];
    this.userData = {};
  }
  add(...objects) { this.children.push(...objects); }
}
class Mesh extends Group {}
class Material { constructor() { this.dispose = () => {}; } }
class Geometry {}

function scenario(ownerState) {
  const THREE = {
    Vector3, Group, Mesh,
    MeshLambertMaterial: Material, MeshBasicMaterial: Material,
    BoxGeometry: Geometry, SphereGeometry: Geometry, ConeGeometry: Geometry, CylinderGeometry: Geometry,
    OctahedronGeometry: Geometry, CircleGeometry: Geometry, RingGeometry: Geometry, PlaneGeometry: Geometry, TorusGeometry: Geometry,
    DoubleSide: 2,
  };
  const context = vm.createContext({ THREE, Math });
  vm.runInContext(source, context);

  const hero = { pos: new Vector3(), size: 1, dead: false, damage: 0,
    takeDamage(n) { this.damage += n; } };
  const units = [];
  const boss = { boss: true, dead: false, stunT: 0, pos: new Vector3(),
    cd: { rain: 0, summon: 99, shield: 99, chain: 99 },
    dmg: 10, range: 8, maxHp: 100, shieldHp: 100, enraged: false, busy: 0,
    once() { return 1; } };
  units.push(boss);
  Object.assign(context, { hero, units, boss });

  vm.runInContext(`linkMonsters({
    allies: () => [hero], heroes: () => [hero], skeletonsAlive: () => [], units,
    difficulty: { count: 1 }, scene: { add() {}, remove() {} }, world: { groundHeight: () => 0 },
    ring() {}, poof() {}, beam() {}, popText() {}, showBanner() {},
  });
  MONSTER_TYPES.Lich.think(boss, 0, hero);`, context);
  vm.runInContext('updateMonsterFx(1.51)', context);
  boss.dead = ownerState === 'dead';
  boss.stunT = ownerState === 'stunned' ? 1 : 0;
  vm.runInContext('updateMonsterFx(0.4)', context);
  return hero.damage;
}

assert.equal(scenario('dead'), 0, 'crânios ainda caindo somem quando o Lich morre');
assert.equal(scenario('stunned'), 0, 'crânios ainda caindo somem quando o Lich é atordoado');
assert.ok(scenario('alive') > 0, 'crânios ainda acertam se o Lich continua vivo');
console.log('OK: crânios atrasados cancelam com a morte/atordoamento do Lich e atingem enquanto ele vive');
