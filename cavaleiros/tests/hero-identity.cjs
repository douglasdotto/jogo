const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'looks.js'), 'utf8')
  .replace(/^export /gm, '');
const context = {};
vm.runInNewContext(`${source}\nglobalThis.result = { LOOKS, LOOK_PREVIEW };`, context);
const { LOOKS, LOOK_PREVIEW } = context.result;

assert.ok(LOOKS.assassin.extras.some((extra) => extra.type === 'scarf'), 'Assassino mantém o cachecol vermelho');
assert.ok(!LOOKS.assassin.extras.some((extra) => extra.type === 'mask'), 'Assassino deve deixar o rosto à mostra');
assert.ok(LOOKS.ninja.extras.some((extra) => extra.type === 'scarf'), 'Ninja mantém o cachecol');
assert.ok(LOOKS.ninja.extras.some((extra) => extra.type === 'mask'), 'Ninja reserva a máscara');
assert.equal(LOOK_PREVIEW.find((hero) => hero.id === 'ninja')?.model, 'Rogue_Hooded', 'Ninja mantém o capuz do modelo');

const duelistBlades = LOOKS.duelist.add.filter((piece) => piece.from === 'Knight' && piece.part.startsWith('1H_Sword')).map((piece) => piece.bone);
assert.deepEqual(Array.from(duelistBlades).sort(), ['handslotl', 'handslotr'], 'Duelista leva uma espada curta em cada mão');
assert.ok(!LOOKS.duelist.extras.some((extra) => extra.type === 'scarf' || extra.type === 'mask'), 'Duelista não repete cachecol nem máscara dos outros ladinos');

const assassinShape = LOOKS.assassin.shape.Rogue_Body;
const ninjaShape = LOOKS.ninja.shape.Rogue_Body;
assert.ok(assassinShape[0] > ninjaShape[0] + 0.05, 'Assassino tem tronco mais largo');
assert.ok(assassinShape[1] < ninjaShape[1] - 0.03, 'Assassino tem silhueta mais baixa');

// Ninja troca a faca por shurikens (na mão e no cinto)
assert.ok(LOOKS.ninja.hide.includes('Knife') && LOOKS.ninja.hide.includes('Throwable'), 'Ninja não mostra a faca');
assert.ok(LOOKS.ninja.extras.some((extra) => extra.type === 'shuriken' && extra.bone === 'handslotr'), 'Ninja segura uma shuriken');
assert.ok(LOOKS.ninja.extras.some((extra) => extra.type === 'shurikenBelt'), 'Ninja leva shurikens no cinto');

// ---------- paletas: as 20 variantes (12 de looks.js + 8 receitas de characters.js) ----------
const recipes = fs.readFileSync(path.join(__dirname, '..', 'characters.js'), 'utf8');
const slice = recipes.slice(recipes.indexOf('export const CHARACTERS'), recipes.indexOf('// arquivos')).replace('export ', '');
vm.runInNewContext(`${slice}\nglobalThis.result = CHARACTERS;`, context);
const heroes = [
  ...LOOK_PREVIEW.map((v) => ({ id: v.id, model: v.model === 'Rogue_Hooded' ? 'Rogue' : v.model, paint: LOOKS[v.id].paint })),
  ...context.result.map((c) => ({ id: c.id, model: c.base, paint: c.paint })),
];
assert.equal(heroes.length, 20, '20 variantes com aparência própria');
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(...hex(a).map((v, i) => v - hex(b)[i]));
const palette = (h) => {
  const body = h.paint[`${h.model}_Body`]?.tint;
  const face = Object.entries(h.paint).find(([part]) => /_Head/.test(part))?.[1].face || {};
  assert.ok(body, `${h.id}: roupa com tinta própria`);
  if (h.model !== 'Skeleton_Mage') assert.ok(face.eyes && (face.hair || face.hood), `${h.id}: rosto com cor de olhos e cabelo/capuz`);
  return { body, hair: face.hair || face.hood || '#000000', eyes: face.eyes || '#000000' };
};
const palettes = heroes.map((h) => ({ ...h, pal: palette(h) }));
const signatures = new Set(palettes.map((h) => JSON.stringify(h.pal)));
assert.equal(signatures.size, 20, 'as 20 variantes têm paletas distintas');
// mesmo modelo base: roupa + cabelo + olhos precisam se afastar bastante (não só um tom vizinho)
for (const a of palettes) for (const b of palettes) {
  if (a.id >= b.id || a.model !== b.model) continue;
  const gap = dist(a.pal.body, b.pal.body) + dist(a.pal.hair, b.pal.hair) + dist(a.pal.eyes, b.pal.eyes);
  assert.ok(gap > 150, `${a.id} e ${b.id} têm paletas parecidas demais (${gap.toFixed(0)})`);
}

console.log('OK: Assassino sem máscara e de silhueta robusta; Ninja encapuzado, mascarado e com shurikens; 20 paletas distintas');
