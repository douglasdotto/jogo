// node tests/camera-wheel-fit.cjs — depois da roda do mouse (cam.manual) o enquadramento automático
// (cam.fit) não força mais a distância; sem a roda, ele afasta a câmera para mostrar o grupo todo.
// O OrbitControls (r170) aplica a roda já dentro do evento; o teste reproduz essa ordem
// (roda -> listener -> followParty do próximo quadro) para pegar o zoom sendo desfeito.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const start = source.indexOf('function followParty(real) {');
const end = source.indexOf('\n// Mira manual', start);
assert.ok(start >= 0 && end > start, 'followParty precisa existir');
// listener da roda no canvas, registrado depois do OrbitControls
const wheelSrc = source.match(/renderer\.domElement\.addEventListener\('wheel', (\(\) => \{[\s\S]*?\n\}), \{ passive: true \}\);/);
assert.ok(wheelSrc, 'main.js registra o listener da roda no canvas');
assert.ok(source.indexOf('new OrbitControls(') < wheelSrc.index, 'o listener roda depois do OrbitControls (que já aplicou o zoom)');
assert.ok(!/cam\.wheel/.test(source), 'a distância da roda não pode esperar o fim do quadro (followParty a sobrescreve antes)');
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
    controls: { target: new Vector3(), minDistance: 8, maxDistance: 50, enabled: true, enableZoom: true },
    camera: { position: new Vector3(0, 12, 16) },   // 20 m do alvo
    cam: { zoom: 1, userDist: 0, fit: 0, manual: false },
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
    this.onWheel = ${wheelSrc[1]};
  `, context);
  // grupo bem espalhado: o enquadramento automático quer bem mais que 20 m
  const hero = (x) => ({ team: 'hero', dead: false, pos: new Vector3(x, 0, 3) });
  context.units.push(hero(-15), hero(15));
  return context;
}

const distance = (c) => c.camera.position.distanceTo(c.controls.target);
const frames = (c, n) => { for (let i = 0; i < n; i++) c.followParty(1 / 30); };
// como o OrbitControls: com controles ligados, aplica o zoom na hora e depois chegam os outros listeners
const wheel = (c, dist) => {
  if (c.controls.enabled && c.controls.enableZoom) {
    const offset = new Vector3().subVectors(c.camera.position, c.controls.target);
    offset.setLength(Math.min(c.controls.maxDistance, Math.max(c.controls.minDistance, dist)));
    c.camera.position.copy(c.controls.target).add(offset);
  }
  c.onWheel();
};

// Sem a roda: o enquadramento automático força a distância mínima que mostra todos.
const auto = harness();
frames(auto, 240);
assert.equal(auto.cam.manual, false);
assert.ok(auto.cam.fit > 30, `fit deveria crescer com o grupo espalhado (fit=${auto.cam.fit})`);
assert.ok(Math.abs(distance(auto) - auto.cam.fit) < 0.5, `sem a roda a câmera segue o fit (dist=${distance(auto)}, fit=${auto.cam.fit})`);
assert.ok(distance(auto) > auto.cam.userDist * auto.cam.zoom + 5, 'o fit vence o zoom guardado do jogador');

// Com a roda: o jogador aproxima para 12 m e nem o próximo quadro nem o fit empurram a câmera de volta.
const manual = harness();
frames(manual, 240);
wheel(manual, 12);
assert.equal(manual.cam.manual, true, 'a roda marca o zoom como manual');
assert.ok(Math.abs(manual.cam.userDist - 12) < 1e-6, `guarda a distância escolhida pelo jogador (userDist=${manual.cam.userDist})`);
frames(manual, 1);
assert.ok(Math.abs(distance(manual) - 12) < 0.01, `o quadro seguinte não desfaz a roda (dist=${distance(manual)})`);
frames(manual, 240);
assert.ok(manual.cam.fit > 30, 'o fit continua calculado');
assert.ok(Math.abs(distance(manual) - 12) < 0.01, `com a roda a distância fica a do jogador (dist=${distance(manual)})`);

// Afastar também vale, e vários giros seguidos antes do quadro acumulam.
wheel(manual, 18);
wheel(manual, 24);
frames(manual, 30);
assert.ok(Math.abs(distance(manual) - 24) < 0.01, `afastar com a roda vale (dist=${distance(manual)})`);

// O zoom manual continua limitado por minDistance/maxDistance.
wheel(manual, 5);   // < minDistance
frames(manual, 5);
assert.ok(Math.abs(distance(manual) - 8) < 0.01, `respeita controls.minDistance (dist=${distance(manual)})`);

// Com os controles desligados (mira manual), a roda não mexe no zoom guardado.
manual.controls.enabled = false;
const before = manual.cam.userDist;
wheel(manual, 30);
frames(manual, 5);
assert.equal(manual.cam.userDist, before, 'roda com controles desligados não muda o zoom');
assert.ok(Math.abs(distance(manual) - 8) < 0.01, `distância mantida com controles desligados (dist=${distance(manual)})`);

console.log('OK: câmera respeita a roda do jogador e só força o enquadramento automático sem ela');
