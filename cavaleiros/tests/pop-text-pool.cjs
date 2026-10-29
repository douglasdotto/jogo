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

console.log('pop-text-pool ok');
