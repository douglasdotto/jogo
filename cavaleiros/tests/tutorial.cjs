// node cavaleiros/tests/tutorial.cjs — DOM e relógio mínimos, sem navegador.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'tutorial.js'), 'utf8');

function setup(search = '', saved) {
  const timers = new Map(), frames = new Map();
  let id = 0;
  class Element {
    constructor() { this.children = []; this.style = { setProperty() {} }; this.isConnected = true; }
    append(...items) { items.forEach(item => { item.parent = this; this.children.push(item); }); }
    setAttribute() {}
    getBoundingClientRect() { return { left: 100, top: 200, right: 220, bottom: 260, width: 120, height: 60 }; }
    remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  }
  const body = new Element(), target = new Element();
  const data = { 'cavaleiros-tutorial': saved };
  const context = vm.createContext({
    document: { body, createElement: () => new Element(), querySelector: () => target },
    location: { search }, localStorage: { getItem: k => data[k], setItem: (k, v) => { data[k] = v; } },
    URLSearchParams, innerWidth: 800, innerHeight: 600,
    setTimeout: (fn, delay) => { fn.delay = delay; timers.set(++id, fn); return id; }, clearTimeout: key => timers.delete(key),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key),
  });
  vm.runInContext(source.replaceAll('export ', ''), context);
  const tutorial = vm.runInContext('createTutorial()', context);
  const pick = (missionId = 'vila') => tutorial.on('pick', { missionId, card: () => target, button: () => target });
  const bubbles = () => body.children.flatMap(x => x.children).filter(x => x.className === 'tutorial-bubble');
  const expire = () => { const current = [...timers.values()]; timers.clear(); current.forEach(fn => fn()); };
  const frame = () => { const current = [...frames.values()]; frames.clear(); current.forEach(fn => fn()); };
  return { tutorial, body, target, data, pick, bubbles, expire, timers, frames, frame };
}

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('OK:', name); }
  catch (e) { failures++; console.error('FALHOU:', name, e.message); }
}
test('primeira vez e somente vila', () => {
  const s = setup(); s.pick('bosque'); assert.equal(s.body.children.length, 0);
  s.pick(); assert.equal(s.bubbles()[0].textContent, 'Escolha seu herói');
  const done = setup('', 'feito'); done.pick(); assert.equal(done.body.children.length, 0);
});
test('Pular grava feito e remove avisos', () => {
  const s = setup(); s.pick();
  s.body.children[0].children.find(x => x.textContent === 'Pular').onclick();
  assert.equal(s.data['cavaleiros-tutorial'], 'feito');
  assert.equal(s.body.children.length, 0); assert.equal(s.timers.size, 0); assert.equal(s.frames.size, 0);
  s.pick(); assert.equal(s.body.children.length, 0);
});
test('URLs de teste desativam tutorial', () => {
  for (const query of ['?tudo=1', '?fase=', '?fase=1', '?tudo=1&fase=2']) {
    const s = setup(query); s.pick(); assert.equal(s.body.children.length, 0, query);
  }
  const s = setup('?tudo=0'); s.pick(); assert.equal(s.bubbles().length, 1);
});
test('cada passo dispara uma vez e manual é opcional', () => {
  const s = setup(); s.pick(); s.expire(); s.pick(); assert.equal(s.bubbles().length, 0);
  const steps = [
    ['battleStart', {}, 'Habilidades disparam sozinhas'],
    ['enemyNear', { target: () => s.target.getBoundingClientRect() }, 'Seu herói ataca sozinho'],
    ['skillReady', { target: s.target, auto: false }, 'Clique para usar'],
    ['phaseCleared', { phase: 1 }, '⚑ Avance pelas fases'],
    ['relic', { target: s.target }, 'Escolha uma relíquia'],
  ];
  s.tutorial.on('skillReady', { target: s.target, auto: true }); assert.equal(s.bubbles().length, 0);
  s.tutorial.on('phaseCleared', { phase: 2 }); assert.equal(s.bubbles().length, 0);
  for (const [event, ctx, text] of steps) {
    s.tutorial.on(event, ctx); assert.ok(s.bubbles().some(x => x.textContent === text), event);
    s.expire(); s.expire();
    s.tutorial.on(event, ctx); assert.equal(s.bubbles().length, 0, `${event} repetido`);
  }
  assert.equal(s.data['cavaleiros-tutorial'], 'feito');
  assert.equal(s.body.children.length, 0);
});
test('balão fecha ao clicar e ao vencer quatro segundos', () => {
  const s = setup(); s.pick(); assert.equal([...s.timers.values()][0].delay, 4000);
  s.bubbles()[0].onclick(); assert.equal(s.bubbles().length, 0);
  s.tutorial.on('battleStart'); s.expire();
  assert.equal(s.bubbles()[0].textContent, 'Desligue para controlar');
  s.expire(); assert.equal(s.bubbles().length, 0);
  assert.equal(s.frames.size, 0);
});
test('sair limpa sem concluir; relíquia conclui sem passo manual', () => {
  const s = setup(); s.pick(); s.tutorial.on('leave');
  assert.equal(s.body.children.length, 0); assert.equal(s.frames.size, 0);
  assert.notEqual(s.data['cavaleiros-tutorial'], 'feito');
  const next = setup(); next.pick(); next.tutorial.on('battleStart');
  next.tutorial.on('relic', { target: next.target }); next.expire();
  assert.equal(next.data['cavaleiros-tutorial'], 'feito');
  next.tutorial.on('battleStart'); assert.equal(next.body.children.length, 0);
});
test('seta acompanha inimigo e some quando ele cai', () => {
  const s = setup(); s.pick(); s.expire();
  const point = { x: 0, y: 0, z: 0, setY() { return this; }, project() { return this; } };
  const enemy = { size: 1, pos: { y: 0, clone: () => point } };
  s.tutorial.on('enemyNear', { enemy, camera: {}, fighting: () => true });
  s.frame();
  const bubble = s.bubbles()[0];
  assert.equal(bubble.style.visibility, '');
  assert.equal(bubble.style.left, '340px');
  point.x = 0.5; s.frame(); assert.equal(bubble.style.left, '540px');
  enemy.dead = true; s.frame();
  assert.equal(s.bubbles().length, 0); assert.equal(s.frames.size, 0);
  assert.equal(s.timers.size, 0);
});
test('inimigo fora da tela não consome passo', () => {
  const s = setup(); s.pick(); s.expire();
  const point = { x: 2, y: 0, z: 0, setY() { return this; }, project() { return this; } };
  const ctx = { enemy: { size: 1, pos: { y: 0, clone: () => point } }, camera: {}, fighting: () => true };
  s.tutorial.on('enemyNear', ctx); assert.equal(s.bubbles().length, 0);
  assert.equal(s.tutorial.wants('enemyNear'), true);
  point.x = 0; s.tutorial.on('enemyNear', ctx); s.frame();
  assert.equal(s.bubbles().length, 1);
});
test('escolher relíquia antes do prazo também salva', () => {
  const s = setup(); s.pick();
  s.tutorial.on('relic', { target: s.target });
  s.target.isConnected = false; s.frame();
  assert.equal(s.data['cavaleiros-tutorial'], 'feito');
  assert.equal(s.body.children.length, 0);
});
console.log(failures ? `${failures} falharam.` : 'Tutorial: tudo certo.');
process.exitCode = failures ? 1 : 0;
