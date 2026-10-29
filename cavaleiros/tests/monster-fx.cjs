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

// ---------- escudo de ossos do xamã e avisos do Carrasco: tudo sai da cena e os materiais são descartados ----------
function freshContext() {
  let made = 0, disposed = 0;
  class CountedMaterial { constructor() { made++; this.dispose = () => { disposed++; }; } }
  class Piece extends Group { removeFromParent() { this.removed = true; } }
  const THREE = {
    Vector3, Group: Piece, Mesh: Piece,
    MeshLambertMaterial: CountedMaterial, MeshBasicMaterial: CountedMaterial,
    BoxGeometry: Geometry, SphereGeometry: Geometry, ConeGeometry: Geometry, CylinderGeometry: Geometry,
    OctahedronGeometry: Geometry, CircleGeometry: Geometry, RingGeometry: Geometry, PlaneGeometry: Geometry, TorusGeometry: Geometry,
    DoubleSide: 2,
  };
  const context = vm.createContext({ THREE, Math });
  vm.runInContext(source, context);
  const base = made;   // materiais compartilhados do módulo não contam
  const inScene = new Set();
  const hero = { pos: new Vector3(), size: 1, dead: false, damage: 0, busy: 0, takeDamage(n) { this.damage += n; } };
  const units = [], skeletons = [];
  const unit = (extra) => {
    const root = new Piece();
    const u = { dead: false, stunT: 0, busy: 0, spawning: false, size: 1, maxHp: 100, hp: 100, dmg: 10, pos: new Vector3(), root, mats: [],
      vel: { set() {} }, once() { return 1; }, action() { return { getClip: () => ({ duration: 1 }) }; }, ...extra };
    units.push(u); skeletons.push(u);
    return u;
  };
  context.api = {
    allies: () => [hero], heroes: () => [hero], skeletonsAlive: () => skeletons.filter((s) => !s.dead), units,
    difficulty: { count: 1 }, scene: { add(m) { inScene.add(m); }, remove(m) { inScene.delete(m); } }, world: { groundHeight: () => 0, canStep: () => true },
    ring() {}, poof() {}, beam() {}, popText() {}, showBanner() {},
  };
  vm.runInContext('linkMonsters(api)', context);
  return { context, hero, unit, inScene, counts: () => ({ made: made - base, disposed }) };
}

{
  const { context, hero, unit, inScene, counts } = freshContext();
  const shaman = unit({ cd: { ward: 0 } });
  shaman.pos.set(0, 0, 6);
  const ally = unit({ maxHp: 200, hp: 200 });
  ally.pos.set(1, 0, 6);
  Object.assign(context, { shaman, hero });
  vm.runInContext('MONSTER_TYPES.Shaman.think(shaman, 0, hero)', context);
  assert.equal(inScene.size, 1, 'aviso do escudo entra na cena');
  vm.runInContext('updateMonsterFx(1.2)', context);
  assert.ok(ally.ward && ally.ward.hp > 0, 'aliado recebe o escudo depois do aviso');
  assert.equal(inScene.size, 0, 'aviso sai da cena');
  const pieces = ally.root.children.slice();
  assert.equal(pieces.length, 2, 'bolha e anel presos no aliado');
  assert.equal(vm.runInContext('absorbWard', context)(ally, 30), 0, 'escudo absorve o golpe');
  shaman.dead = true;
  vm.runInContext('updateMonsterFx(0.05)', context);
  assert.equal(ally.ward, null, 'xamã morto desfaz o escudo');
  assert.ok(pieces.every((p) => p.removed), 'bolha e anel saem do aliado');
  const { made, disposed } = counts();
  assert.equal(made, disposed, 'materiais dos avisos descartados');
}

{
  const { context, hero, unit, inScene, counts } = freshContext();
  hero.pos.set(0, 0, 2.5);
  const boss = unit({ boss: true, size: 2.1, maxHp: 1000, hp: 300, enraged: true, cd: { cleave: 0, hook: 99, whirl: 99 } });
  Object.assign(context, { boss, hero });
  vm.runInContext('MONSTER_TYPES.Executioner.think(boss, 0, hero)', context);
  assert.equal(inScene.size, 3, 'em fúria, três linhas no chão');
  boss.dead = true;
  vm.runInContext('updateMonsterFx(2)', context);
  assert.equal(inScene.size, 0, 'linhas somem com o Carrasco morto');
  assert.equal(hero.damage, 0, 'machadada cancelada não acerta');
  const { made, disposed } = counts();
  assert.ok(made > 0);
  assert.equal(made, disposed, 'materiais das linhas descartados');
}
console.log('OK: escudo de ossos e avisos do Carrasco saem da cena e descartam materiais');
