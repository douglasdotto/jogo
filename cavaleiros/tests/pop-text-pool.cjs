// node tests/pop-text-pool.cjs — expiração, reuso, limite e limpeza dos textos de combate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'pop-text-pool.js'), 'utf8').replace(/^export /gm, '');
const context = vm.createContext({});
vm.runInContext(`${source}\nthis.createPopTextPool = createPopTextPool;`, context);
const createPopTextPool = context.createPopTextPool;

let created = 0;
const container = {
  children: [],
  appendChild(element) {
    element.remove();
    element.parentNode = this;
    this.children.push(element);
  },
  removeChild(element) {
    const index = this.children.indexOf(element);
    if (index >= 0) this.children.splice(index, 1);
    element.parentNode = null;
  },
};
const createElement = () => {
  created++;
  return {
    className: '', textContent: '', style: {}, parentNode: null,
    remove() { this.parentNode?.removeChild(this); },
  };
};

const pool = createPopTextPool(container, { createElement, maxRetained: 2, lifetime: 900 });
const first = pool.show(12, 'dmg', 20, 30, 100);
pool.show('+8', 'heal', 40, 50, 200);
assert.equal(created, 2);
assert.equal(pool.activeCount, 2);
assert.equal(container.children.length, 2);
pool.update(1000);
assert.equal(pool.activeCount, 1, 'expira somente o rótulo que completou 900 ms');
assert.equal(container.children.length, 1);
assert.equal(pool.pooledCount, 1);

const reused = pool.show('Crítico!', 'crit', 60, 70, 1000);
assert.equal(reused, first, 'usa o nó expirado sem criar outro');
assert.equal(created, 2);
assert.equal(reused.className, 'pop crit');
assert.equal(reused.textContent, 'Crítico!');
assert.equal(reused.style.left, '60px');
assert.equal(reused.style.top, '70px');

pool.clear();
assert.equal(pool.activeCount, 0);
assert.equal(container.children.length, 0);
assert.equal(pool.pooledCount, 2);
const third = pool.show('Novo!', 'evolve', 1, 2, 2000);
pool.clear();
assert.equal(third.className, '', 'limpeza também reseta o estilo do nó retido');
assert.equal(third.textContent, '');

const capped = createPopTextPool(container, { createElement, maxRetained: 1, lifetime: 10 });
capped.show('A', 'dmg', 0, 0, 0);
capped.show('B', 'dmg', 0, 0, 0);
capped.update(10);
assert.equal(capped.pooledCount, 1, 'não retém mais nós do que o limite');
assert.equal(container.children.length, 0);

// ticks seguidos no mesmo alvo somam num só número; outro alvo, outra classe ou fora da janela não somam
const merging = createPopTextPool(container, { createElement, lifetime: 900, mergeWindow: 700 });
const target = {}, other = {};
const tick = merging.show(4.4, 'dmg', 0, 0, 0, target);
assert.equal(tick.textContent, '4');
assert.equal(merging.show(4.4, 'dmg', 5, 5, 650, target), tick, 'tick dentro da janela reaproveita o rótulo');
assert.equal(tick.textContent, '9', 'soma o valor real e arredonda só na tela');
assert.equal(tick.style.left, '5px');
assert.equal(merging.activeCount, 1);
merging.show(7, 'dmg', 0, 0, 700, other);
merging.show(7, 'crit', 0, 0, 700, target);
merging.show('+3', 'heal', 0, 0, 700, target);
assert.equal(merging.activeCount, 4, 'alvo, classe ou texto diferentes ficam separados');
merging.update(1549);
assert.equal(merging.activeCount, 4, 'a soma renova a vida do rótulo');
merging.show(2, 'dmg', 0, 0, 1300, target);
assert.equal(merging.activeCount, 4);
assert.equal(tick.textContent, '11');
merging.show(2, 'dmg', 0, 0, 2001, target);
assert.equal(tick.textContent, '11', 'fora da janela abre um rótulo novo');
merging.clear();

// limite de rótulos ativos: o mais antigo sai para o novo entrar
const limited = createPopTextPool(container, { createElement, maxActive: 3, lifetime: 900 });
const oldest = limited.show(1, 'dmg', 0, 0, 0);
limited.show(2, 'dmg', 0, 0, 10);
limited.show(3, 'dmg', 0, 0, 20);
limited.show(4, 'dmg', 0, 0, 30);
assert.equal(limited.activeCount, 3, 'nunca passa de maxActive');
assert.equal(oldest.textContent, '4', 'reaproveita o nó do rótulo mais antigo');
limited.clear();

console.log('pop-text-pool ok');
