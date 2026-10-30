// node tests/campaign-keys.cjs — navegação do mapa da campanha: ←/→ e A/D trocam de missão, Enter joga, faixa de capítulos pula.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'campaign.js'), 'utf8').replace(/^export /gm, '');
function element() {
  const classes = new Set();
  const el = {
    className: '', style: {}, children: [], attributes: {},
    classList: {
      add: (...n) => n.forEach((c) => classes.add(c)), remove: (...n) => n.forEach((c) => classes.delete(c)),
      toggle: (c, on = !classes.has(c)) => (on ? classes.add(c) : classes.delete(c), on), contains: (c) => classes.has(c) || el.className.split(' ').includes(c),
    },
    setAttribute(k, v) { this.attributes[k] = v; },
    appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); },
    focus() { document.activeElement = this; },
    querySelector: () => element(),
  };
  return el;
}
const document = { createElement: element, body: element(), activeElement: null };
document.activeElement = document.body;
let keyHandler = null;
const store = new Map([['cavaleiros-campanha', JSON.stringify({ vila: 3, ponte: 2, santuario: 1 })]]);
const context = vm.createContext({
  document, location: { search: '' }, URLSearchParams, console,
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
  addEventListener: (type, fn) => { if (type === 'keydown') keyHandler = fn; }, removeEventListener() {},
});
vm.runInContext(`${source}\nthis.renderCampaign = renderCampaign; this.MISSIONS = MISSIONS;`, context);

const map = element(), info = element(), root = element();
const chapters = Array.from({ length: 6 }, () => element());
root.isConnected = true;
root.closest = () => null;
root.querySelector = (s) => (s === '.camp-map' ? map : info);
root.querySelectorAll = (s) => (s === '.camp-chap' ? chapters : []);
const started = [];
let mounted = null;
context.renderCampaign(root, (m) => started.push(m.id), null, null, '', null, (_, data) => { mounted = data; return { select() {} }; });
const M = context.MISSIONS;
const selected = () => map.children.findIndex((b) => b.classList.contains('sel'));
const press = (key, extra = {}) => { let prevented = false; keyHandler({ key, preventDefault: () => (prevented = true), ...extra }); return prevented; };

assert.equal(selected(), 3, 'abre na próxima missão disponível (Ponte em Chamas)');
assert.deepEqual(map.children.flatMap((b, i) => (b.className.split(' ').includes('next') ? [i] : [])), [3], 'só a próxima missão pulsa');
assert.equal(mounted.states.filter((s) => s.next).length, 1, 'o mapa 3D recebe qual missão é a próxima');
assert.ok(chapters[0].classList.contains('sel'), 'a faixa marca o capítulo da missão');

assert.ok(press('d')); assert.equal(selected(), 4, 'D avança');
assert.equal(document.activeElement, map.children[4], 'o foco acompanha a missão');
assert.ok(press('ArrowRight')); assert.equal(selected(), 5, '→ avança');
assert.ok(press('A')); assert.equal(selected(), 4, 'A (maiúsculo) volta');
assert.ok(press('ArrowLeft')); assert.equal(selected(), 3, '← volta');
assert.ok(!press('d', { ctrlKey: true })); assert.equal(selected(), 3, 'atalhos com Ctrl ficam com o navegador');
for (let k = 0; k < 5; k++) press('a');
assert.equal(selected(), 0, 'não passa da primeira missão');

assert.ok(press('Enter')); assert.deepEqual(started, ['vila'], 'Enter joga a missão selecionada');
document.activeElement = element();
assert.ok(!press('Enter')); assert.ok(!press('d')); assert.equal(started.length, 1, 'fora do mapa, Enter e D não agem');

chapters[3].onclick();
assert.equal(M[selected()].chapter, M.find((m) => m.chapter.includes('IV')).chapter, 'o capítulo IV leva a uma missão dele');
assert.ok(chapters[3].classList.contains('sel') && !chapters[0].classList.contains('sel'));
chapters[0].onclick();
assert.equal(selected(), 3, 'no capítulo I vai para a primeira missão ainda sem estrelas');
document.activeElement = document.body;
press('Enter');
assert.deepEqual(started, ['vila', 'chamas']);
console.log('OK: mapa da campanha navega por ←/→, A/D e capítulos; Enter joga a missão');
