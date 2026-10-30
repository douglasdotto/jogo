// node tests/aim-manual.cjs — mira manual: beginAim trava a câmera e mostra o alcance, updateAim pinta
// o alvo de verde/vermelho conforme o alcance e cancelAim devolve controls.enabled como estava.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(dir, 'main.js'), 'utf8').replace(/\r\n/g, '\n');
const targeting = fs.readFileSync(path.join(dir, 'skill-targeting.js'), 'utf8').replace(/^export /gm, '');
const start = main.indexOf('// Mira manual:');
const end = main.indexOf("\nrenderer.domElement.addEventListener('pointermove'", start);
assert.ok(start >= 0 && end > start, 'seção da mira manual precisa existir');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setY(y) { this.y = y; return this; }
  setScalar(k) { return this.set(k, k, k); }
  copy(v) { return this.set(v.x, v.y, v.z); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  // Câmera de teste vista de cima: 1 m = 10 px, centro da tela (500, 500) = origem.
  project() { return this.set(this.x / 50, -this.z / 50, 0); }
}
class Vector2 { set(x, y) { this.x = x; this.y = y; return this; } }
class Color {
  constructor(hex = 0) { this.hex = hex; }
  setHex(hex) { this.hex = hex; return this; }
  copy(c) { this.hex = c.hex; return this; }
}
class Material {
  constructor(opts = {}) { this.color = new Color(opts.color); }
  clone() { return new Material({ color: this.color.hex }); }
}
class Object3D {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material;
    this.position = new Vector3(); this.scale = new Vector3(1, 1, 1); this.rotation = { x: 0 };
    this.visible = true; this.children = [];
  }
  add(...items) { this.children.push(...items); }
}
const THREE = {
  Vector2, Vector3,
  Raycaster: class {
    constructor() { this.ray = { origin: new Vector3(), direction: new Vector3(0, -1, 0) }; }
    setFromCamera(pointer) {
      this.ray.origin.set(pointer.x * 50, 50, -pointer.y * 50);
      this.ray.at = (t, target) => target.set(this.ray.origin.x, this.ray.origin.y - t, this.ray.origin.z);
    }
  },
  Group: Object3D, Mesh: Object3D, Line: Object3D,
  MeshBasicMaterial: Material, LineBasicMaterial: Material,
  RingGeometry: class {},
  BufferGeometry: class {
    setFromPoints() {
      this.attributes = { position: { points: [], setXYZ(i, x, y, z) { this.points[i] = [x, y, z]; } } };
      return this;
    }
    computeBoundingSphere() {}
  },
  DoubleSide: 2,
};
const element = () => ({ id: '', hidden: false, textContent: '', style: {}, setAttribute() {} });

const GREEN = 0x75ffad, RED = 0xff6666;
const context = vm.createContext({
  Math, Number, THREE,
  innerWidth: 1000, innerHeight: 1000,
  camera: {},
  controls: { enabled: true },
  renderer: { domElement: { style: { cursor: '' } } },
  scene: { add() {} },
  document: { createElement: element, body: { appendChild() {} } },
  world: { groundHeight: () => 0 },
  game: { paused: false, over: false, state: 'fight' },
  units: [],
});
vm.runInContext(`
  ${targeting}
  ${main.slice(start, end)}
  this.api = { beginAim, updateAim, cancelAim, aimGroup, aimRange, aimArea, aimLine, aimHint, get aiming() { return aiming; } };
`, context);
const { api, units, controls, renderer } = context;
// alvo na tela: posição (x, z) em metros → pixel
const point = (x, z) => { api.aiming.pointerX = 500 + x * 10; api.aiming.pointerY = 500 + z * 10; };

const hero = (id, extra = {}) => ({
  cfg: { id, ability: 'Golpe' }, team: 'hero', level: 1, skillPower: 1, range: 6, skillTimer: 0,
  auto: false, dead: false, wantSkill: 2, manualTarget: {}, pos: new Vector3(), ...extra,
});
const foe = (x, z) => ({ team: 'skeleton', dead: false, spawning: false, size: 1, pos: new Vector3(x, 0, z) });

// ---------- inimigo (viking: alcance 9, mínimo 2) ----------
const viking = hero('viking');
const near = foe(5, 0), far = foe(-20, 0);
units.push(viking, near, far);

api.beginAim(viking);
assert.equal(api.aiming.hero, viking, 'beginAim começa a mirar com o herói');
assert.equal(api.aiming.controlsEnabled, true, 'guarda o estado da câmera');
assert.equal(controls.enabled, false, 'câmera travada durante a mira');
assert.equal(renderer.domElement.style.cursor, 'crosshair');
assert.equal(api.aimHint.hidden, false, 'dica visível');
assert.equal(viking.wantSkill, 0, 'pedido automático pendente é limpo');
assert.equal(viking.manualTarget, null, 'alvo manual antigo é limpo');
assert.equal(api.aimGroup.visible, true, 'círculo de alcance aparece');
assert.equal(api.aimRange.scale.x, 9, 'círculo com o alcance da habilidade');
assert.equal(api.aiming.target, null, 'sem ponteiro ainda não há alvo');
assert.equal(api.aimArea.visible, false);
assert.doesNotMatch(api.aimHint.textContent, /Fora/);

point(5, 0);
api.updateAim();
assert.equal(api.aiming.target, near, 'ponteiro sobre o inimigo seleciona o alvo');
assert.equal(api.aimArea.visible, true);
assert.equal(api.aimArea.material.color.hex, GREEN, 'alvo no alcance fica verde');
assert.equal(api.aimLine.material.color.hex, GREEN, 'linha acompanha a cor');
assert.doesNotMatch(api.aimHint.textContent, /Fora/);

point(-20, 0);
api.updateAim();
assert.equal(api.aiming.target, far);
assert.equal(api.aimArea.material.color.hex, RED, 'alvo fora do alcance fica vermelho');
assert.match(api.aimHint.textContent, /✕ Fora/, 'dica avisa que está fora do alcance');

near.pos.set(1.5, 0, 0);   // dentro do mínimo de 2 m do viking
point(1.5, 0);
api.updateAim();
assert.equal(api.aiming.target, near);
assert.equal(api.aimArea.material.color.hex, RED, 'abaixo do alcance mínimo também é inválido');
near.pos.set(5, 0, 0);

point(30, 30);   // longe de qualquer inimigo
api.updateAim();
assert.equal(api.aiming.target, null, 'ponteiro no vazio não escolhe alvo');
assert.equal(api.aimArea.visible, false);

api.cancelAim();
assert.equal(api.aiming, null);
assert.equal(controls.enabled, true, 'cancelAim devolve a câmera');
assert.equal(api.aimGroup.visible, false);
assert.equal(api.aimHint.hidden, true);
assert.equal(renderer.domElement.style.cursor, '');

// ---------- chão (arqueiro: alcance 11) ----------
const archer = hero('archer');
units.push(archer);
api.beginAim(archer);
point(6, 3);
api.updateAim();
assert.equal(api.aiming.target?.groundTarget, true, 'mira no chão usa alvo de terreno');
assert.ok(Math.abs(api.aiming.target.pos.x - 6) < 0.01 && Math.abs(api.aiming.target.pos.z - 3) < 0.01, 'ponto do chão sob o ponteiro');
assert.equal(api.aimArea.material.color.hex, GREEN, 'ponto no alcance fica verde');
point(15, 0);
api.updateAim();
assert.equal(api.aimArea.material.color.hex, RED, 'ponto além do alcance fica vermelho');

// trocar de herói no meio da mira não perde o estado original da câmera
api.beginAim(viking);
assert.equal(api.aiming.hero, viking);
assert.equal(api.aiming.controlsEnabled, true, 'nova mira guarda o estado de antes da primeira');
api.cancelAim();
assert.equal(controls.enabled, true);

// câmera já desligada continua desligada ao cancelar
controls.enabled = false;
api.beginAim(viking);
api.cancelAim();
assert.equal(controls.enabled, false, 'restaura exatamente o valor anterior');
controls.enabled = true;

// cancelamentos automáticos devolvem a câmera
for (const [why, breakIt, fix] of [
  ['herói caiu', () => { viking.dead = true; }, () => { viking.dead = false; }],
  ['habilidade em recarga', () => { viking.skillTimer = 3; }, () => { viking.skillTimer = 0; }],
  ['jogo pausado', () => { context.game.paused = true; }, () => { context.game.paused = false; }],
  ['fim da luta', () => { context.game.state = 'advance'; }, () => { context.game.state = 'fight'; }],
  ['herói ficou automático', () => { viking.auto = true; }, () => { viking.auto = false; }],
]) {
  api.beginAim(viking);
  assert.equal(controls.enabled, false);
  breakIt();
  api.updateAim();
  assert.equal(api.aiming, null, `${why}: mira cancela`);
  assert.equal(controls.enabled, true, `${why}: câmera volta`);
  assert.equal(api.aimGroup.visible, false, `${why}: círculo some`);
  fix();
}

// beginAim pressupõe herói com mira manual (aimSpec); habilidades instantâneas não podem chegar aqui.
const callers = [...main.matchAll(/^.*beginAim\(h[^)]*\);.*$/gm)];
assert.ok(callers.length >= 1, 'beginAim tem chamador na barra de habilidades');
for (const call of callers) {
  const guard = main.slice(Math.max(0, call.index - 400), call.index);
  assert.match(guard, /aimSpec\(h\)/, 'quem chama beginAim confere aimSpec antes');
}

// cancelAim sem mira ativa não mexe na câmera
controls.enabled = false;
api.cancelAim();
assert.equal(controls.enabled, false, 'cancelAim ocioso não liga a câmera');

console.log('OK: mira manual começa, valida alcance e devolve a câmera ao cancelar');
