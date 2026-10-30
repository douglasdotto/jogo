// node tests/camera-wheel-fit.cjs — depois da roda do mouse (cam.manual) o enquadramento automático
// (cam.fit) não força mais a distância; sem a roda, ele afasta a câmera para mostrar o grupo todo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const start = source.indexOf('function followParty(real) {');
const end = source.indexOf('\n// Mira manual', start);
assert.ok(start >= 0 && end > start, 'followParty precisa existir');
// A troca para zoom manual acontece no fim do quadro, dentro do loop.
const wheelLine = source.match(/^\s*if \(cam\.wheel\) \{[^\n]*cam\.manual = true;[^\n]*$/m);
assert.ok(wheelLine, 'o loop marca cam.manual quando o jogador usa a roda');
const minFit = Number(source.match(/const CAM_MIN_FIT = ([\d.]+)/)?.[1]);
assert.ok(minFit > 0, 'CAM_MIN_FIT precisa existir');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  divideScalar(k) { return this.set(this.x / k, this.y / k, this.z / k); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  setLength(l) { const n = this.length() || 1; return this.set(this.x * l / n, this.y * l / n, this.z * l / n); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  lerp(v, k) { return this.set(this.x + (v.x - this.x) * k, this.y + (v.y - this.y) * k, this.z + (v.z - this.z) * k); }
}

function harness() {
  const context = vm.createContext({
    Math, Vector3,
    units: [],
    game: { state: 'camp' },
    controls: { target: new Vector3(), minDistance: 8, maxDistance: 50 },
    camera: { position: new Vector3(0, 12, 16) },   // 20 m do alvo
    cam: { zoom: 1, userDist: 0, wheel: false, fit: 0, manual: false },
    follow: new Vector3(),
    tmp: new Vector3(),
  });
  vm.runInContext(`
    const CAM_MIN_FIT = ${minFit};
    const frameHeroes = [], frameFoes = [], frameNearFoes = [];
    const frameFoeCenter = new Vector3();
    let frameSpread = 0;
    ${source.slice(start, end)}
    this.followParty = followParty;
    this.endFrame = () => { ${wheelLine[0].replace(/\/\/.*$/, '')} };
  `, context);
  // grupo bem espalhado: o enquadramento automático quer bem mais que 20 m
  const hero = (x) => ({ team: 'hero', dead: false, pos: new Vector3(x, 0, 3) });
  context.units.push(hero(-15), hero(15));
  return context;
}

const distance = (c) => c.camera.position.distanceTo(c.controls.target);
const frames = (c, n) => { for (let i = 0; i < n; i++) { c.followParty(1 / 30); c.endFrame(); } };

// Sem a roda: o enquadramento automático força a distância mínima que mostra todos.
const auto = harness();
frames(auto, 240);
assert.equal(auto.cam.manual, false);
assert.ok(auto.cam.fit > 30, `fit deveria crescer com o grupo espalhado (fit=${auto.cam.fit})`);
assert.ok(Math.abs(distance(auto) - auto.cam.fit) < 0.5, `sem a roda a câmera segue o fit (dist=${distance(auto)}, fit=${auto.cam.fit})`);
assert.ok(distance(auto) > auto.cam.userDist * auto.cam.zoom + 5, 'o fit vence o zoom guardado do jogador');

// Com a roda: o jogador aproxima para 12 m e o fit não empurra a câmera de volta.
const manual = harness();
frames(manual, 240);
manual.camera.position.copy(manual.controls.target).add(new Vector3(0, 7.2, 9.6));   // 12 m
manual.cam.wheel = true;
manual.endFrame();
assert.equal(manual.cam.manual, true, 'a roda marca o zoom como manual');
assert.equal(manual.cam.wheel, false, 'o pedido da roda é consumido');
assert.ok(Math.abs(manual.cam.userDist - 12) < 1e-6, 'guarda a distância escolhida pelo jogador');
frames(manual, 240);
assert.ok(manual.cam.fit > 30, 'o fit continua calculado');
assert.ok(Math.abs(distance(manual) - 12) < 0.01, `com a roda a distância fica a do jogador (dist=${distance(manual)})`);

// O zoom manual continua limitado por minDistance/maxDistance.
manual.camera.position.copy(manual.controls.target).add(new Vector3(0, 3, 4));   // 5 m < minDistance
manual.cam.wheel = true;
manual.endFrame();
frames(manual, 5);
assert.ok(Math.abs(distance(manual) - 8) < 0.01, `respeita controls.minDistance (dist=${distance(manual)})`);

console.log('OK: câmera respeita a roda do jogador e só força o enquadramento automático sem ela');
