// node tests/campaign-map-layout.cjs — posições do mapa da campanha geradas pela estrada (sem coordenadas fixas).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'campaign.js'), 'utf8').replace(/^export /gm, '');
const context = vm.createContext({ location: { search: '' }, localStorage: { getItem: () => null, setItem() {} }, console });
vm.runInContext(`${source}\nthis.layoutOf = campaignMapLayout; this.MISSIONS = MISSIONS;`, context);

function check(missions, label) {
  const layout = context.layoutOf(missions);
  assert.equal(layout.nodes.length, missions.length, `${label}: uma posição por missão`);
  for (const [i, n] of layout.nodes.entries()) {
    for (const key of ['x', 'z', 'left', 'top']) assert.ok(Number.isFinite(n[key]), `${label}: missão ${i + 1} tem ${key}`);
    assert.ok(n.left >= 0 && n.left <= 100 && n.top >= 0 && n.top <= 100, `${label}: missão ${i + 1} dentro do mapa plano`);
    if (i) assert.ok(n.z < layout.nodes[i - 1].z, `${label}: a estrada sobe a cada missão`);
  }
  for (let i = 0; i < layout.nodes.length; i++) for (let j = i + 1; j < layout.nodes.length; j++) {
    const a = layout.nodes[i], b = layout.nodes[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 4, `${label}: missões ${i + 1} e ${j + 1} não se sobrepõem no 3D`);
    assert.ok(((a.left - b.left) / 9.4) ** 2 + ((a.top - b.top) / 7.5) ** 2 > 1, `${label}: ${i + 1} e ${j + 1} separadas no mapa plano`);
  }
  // uma região por capítulo, na ordem das missões; a estrada passa da última missão (castelo no topo)
  const chapters = [...new Set(missions.map((m) => m.chapter))];
  assert.deepEqual(Array.from(layout.regions, (r) => r.name), chapters, `${label}: regiões por capítulo`);
  assert.ok(layout.road.at(-1).z < layout.nodes.at(-1).z - 5, `${label}: castelo depois da última missão`);
  return layout;
}

const base = check(context.MISSIONS, '18 missões');
assert.equal(base.regions.length, 6);
const extra = (n, chapter) => Array.from({ length: n }, (_, k) => ({ ...context.MISSIONS.at(-1), id: `extra-${k}`, chapter: chapter ?? context.MISSIONS.at(-1).chapter }));
check([...context.MISSIONS, ...extra(1)], '19 missões');
const novo = check([...context.MISSIONS, ...extra(4, 'Capítulo VII · Novo')], 'capítulo novo');
assert.equal(novo.regions.length, 7);
check([...context.MISSIONS, ...extra(12)], '30 missões');
// a mesma lista gera sempre o mesmo mapa
assert.deepEqual(JSON.parse(JSON.stringify(context.layoutOf(context.MISSIONS).nodes)), JSON.parse(JSON.stringify(base.nodes)));
console.log('OK: mapa da campanha gera posições para 18, 19, 22 e 30 missões, sem sobreposição');
