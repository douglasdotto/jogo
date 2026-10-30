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

// ---------- paletas: as 29 variantes (18 de looks.js + 11 receitas de characters.js) ----------
const recipes = fs.readFileSync(path.join(__dirname, '..', 'characters.js'), 'utf8');
const slice = recipes.slice(recipes.indexOf('export const CHARACTERS'), recipes.indexOf('// arquivos')).replace('export ', '');
vm.runInNewContext(`${slice}\nglobalThis.result = CHARACTERS;`, context);
const heroes = [
  ...LOOK_PREVIEW.filter((v) => !v.recipe).map((v) => ({ id: v.id, model: v.model === 'Rogue_Hooded' ? 'Rogue' : v.model, paint: LOOKS[v.id].paint })),
  ...context.result.map((c) => ({ id: c.id, model: c.base, paint: c.paint })),
];
assert.equal(heroes.length, 29, '29 variantes com aparência própria');
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
assert.equal(signatures.size, 29, 'as 29 variantes têm paletas distintas');
// mesmo modelo base: roupa + cabelo + olhos precisam se afastar bastante (não só um tom vizinho)
for (const a of palettes) for (const b of palettes) {
  if (a.id >= b.id || a.model !== b.model) continue;
  const gap = dist(a.pal.body, b.pal.body) + dist(a.pal.hair, b.pal.hair) + dist(a.pal.eyes, b.pal.eyes);
  assert.ok(gap > 150, `${a.id} e ${b.id} têm paletas parecidas demais (${gap.toFixed(0)})`);
}

// Ladinos (9 heróis no mesmo boneco): a roupa principal sozinha precisa se afastar, e o conjunto
// (túnica + gola + mangas + calça) também; antes todos ficavam no verde-escuro/preto do atlas
const rogues = palettes.filter((h) => h.model === 'Rogue');
assert.equal(rogues.length, 8, 'oito heróis no modelo do ladino (o Besteiro passou para o Ranger)');
const outfitOf = (h) => {
  const body = h.paint.Rogue_Body, arm = h.paint.Rogue_ArmLeft, leg = h.paint.Rogue_LegLeft;
  assert.ok(body.amount >= 0.85 && body.cells?.['1,1'], `${h.id}: roupa com tinta forte e gola/acabamento próprio`);
  return [body.tint, body.cells['1,1'], arm.tint, leg.tint];
};
for (const a of rogues) for (const b of rogues) {
  if (a.id >= b.id) continue;
  const [oa, ob] = [outfitOf(a), outfitOf(b)];
  const main = dist(oa[0], ob[0]), whole = oa.reduce((s, c, i) => s + dist(c, ob[i]), 0);
  assert.ok(main > 70, `${a.id} e ${b.id}: roupa principal parecida demais (${main.toFixed(0)})`);
  assert.ok(whole > 260, `${a.id} e ${b.id}: conjunto da roupa parecido demais (${whole.toFixed(0)})`);
}
// nenhum ladino com a túnica quase preta: a roupa base do atlas não pode dominar
const lum = (c) => { const [r, g, b] = hex(c); return 0.3 * r + 0.59 * g + 0.11 * b; };
const darkest = rogues.filter((h) => lum(h.paint.Rogue_Body.tint) < 60).map((h) => h.id);
assert.deepEqual(darkest, ['assassin'], 'só o Assassino veste couro escuro');

// heróis novos: cada um com o acessório que conta a história (arco e aljava, contas e faixa, óculos e frascos)
const has = (id, type, bone) => LOOKS[id].extras.some((extra) => extra.type === type && (!bone || extra.bone === bone));
assert.ok(LOOKS.archer.add.some((piece) => /^kaykit\/weapons\//.test(piece.from) && piece.part.startsWith('bow') && piece.bone === 'handslot.l'), 'Arqueira leva o arco pronto (Fantasy Weapons) na mão esquerda');
assert.ok(LOOKS.archer.extras.some((extra) => extra.type === 'quiver' && extra.bone === 'chest'), 'Arqueira leva aljava nas costas');
assert.ok(!(LOOKS.crossbow.hide || []).includes('Ranger_Quiver') && LOOKS.crossbow.add.some((piece) => piece.part === '2H_Crossbow'), 'Besteiro: aljava do Ranger e besta do Ladino');
assert.equal(LOOK_PREVIEW.find((hero) => hero.id === 'archer')?.model, 'Rogue_Hooded', 'Arqueira usa o capuz');
assert.equal(LOOK_PREVIEW.find((hero) => hero.id === 'crossbow')?.model, 'Ranger', 'Besteiro usa o modelo Ranger (Adventurers 2.0)');
assert.ok(has('monk', 'beads') && has('monk', 'sash') && has('monk', 'armWraps', 'lowerarm.r'), 'Monge com contas, faixa e punhos enfaixados');
assert.deepEqual(Array.from(LOOK_PREVIEW.find((hero) => hero.id === 'monk').use), [], 'Monge luta sem armas');
assert.ok(has('alchemist', 'goggles', 'head') && has('alchemist', 'flaskBelt', 'hips') && has('alchemist', 'flask', 'handslotr'), 'Alquimista com óculos, cinto de frascos e frasco na mão');
assert.ok(['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'].every((w) => LOOKS.alchemist.hide.includes(w)), 'Alquimista não mostra livro, varinha nem cajado');
// Brutamontes: a maior silhueta do jogo, sem armas, ombreiras grandes e manoplas nos dois antebraços
const bodyWidth = (id) => LOOKS[id].shape.Barbarian_Body?.[0] || 0;
for (const id of Object.keys(LOOKS)) if (id !== 'brute') assert.ok(bodyWidth('brute') > (LOOKS[id].shape[Object.keys(LOOKS[id].shape)[0]]?.[0] || 0), `Brutamontes mais largo que ${id}`);
assert.deepEqual(Array.from(LOOK_PREVIEW.find((hero) => hero.id === 'brute').use), [], 'Brutamontes luta de punhos');
assert.ok(LOOKS.brute.extras.some((extra) => extra.type === 'pauldrons' && extra.size >= 1.5), 'Brutamontes com ombreiras enormes');
assert.ok(has('brute', 'armWraps', 'lowerarm.l') && has('brute', 'armWraps', 'lowerarm.r'), 'Brutamontes com manoplas nos dois braços');
for (const id of ['archer', 'monk', 'alchemist', 'brute']) for (const extra of LOOKS[id].extras) assert.ok(recipes.includes(`  ${extra.type}(`), `${id}: acessório ${extra.type} existe em characters.js`);

assert.ok(has('summoner', 'bellStaff', 'handslotr') && !LOOKS.summoner.hide.includes('2H_Staff'), 'Invocador leva cajado com gema e sininhos');
assert.deepEqual(Array.from(LOOK_PREVIEW.find((hero) => hero.id === 'summoner').use), ['2H_Staff'], 'Invocador mostra o cajado na vitrine');
for (const id of ['archer', 'monk', 'alchemist', 'summoner']) for (const extra of LOOKS[id].extras) assert.ok(recipes.includes(`  ${extra.type}(`), `${id}: acessório ${extra.type} existe em characters.js`);

// cada variante do jogo tem aparência própria (LOOKS ou receita de characters.js) e aparece na vitrine,
// na mesma ordem de VARIANTS; antes Engenheira, Domador e Oráculo entravam como Mago/Bárbaro sem pintura
const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const variantBlock = main.slice(main.indexOf('const VARIANTS = ['), main.indexOf('].map((v) => ({ ...HEROES'));
const variants = variantBlock.split(/\n  \{ id: '/).slice(1).map((body) => ({ id: body.slice(0, body.indexOf("'")), recipe: /recipe: CHARACTERS\[(\d+)\]/.exec(body)?.[1] }));
assert.equal(variants.length, 29, 'VARIANTS lido de main.js');
assert.deepEqual(Array.from(LOOK_PREVIEW, (v) => v.id), variants.map((v) => v.id), 'LOOK_PREVIEW lista todas as variantes na ordem de VARIANTS');
for (const v of variants) {
  const preview = LOOK_PREVIEW.find((p) => p.id === v.id);
  const recipe = v.recipe === undefined ? null : context.result[+v.recipe];
  if (v.recipe !== undefined) {
    assert.ok(recipe, `${v.id}: receita existe`);
    assert.equal(preview.recipe, recipe.id, `${v.id}: vitrine aponta a mesma receita do jogo`);
  } else {
    assert.ok(LOOKS[v.id], `${v.id}: sem receita, precisa de LOOKS próprio`);
    assert.ok(!preview.recipe, `${v.id}: vitrine sem receita`);
  }
  for (const extra of (recipe || LOOKS[v.id]).extras || []) {
    assert.ok(recipes.includes(`  ${extra.type}(`), `${v.id}: acessório ${extra.type} existe`);
    assert.ok(extra.bone, `${v.id}: acessório ${extra.type} preso a um osso`);
  }
}

console.log('OK: Assassino sem máscara e de silhueta robusta; Ninja encapuzado, mascarado e com shurikens; Arqueira, Monge, Alquimista, Engenheira, Domador, Oráculo, Brutamontes e Invocador com identidades próprias; 29 paletas distintas');
