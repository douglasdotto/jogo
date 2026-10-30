// node tests/skill-slot4.cjs — toda variante de VARIANTS tem 4 habilidades; a 4ª (slot 3) é própria do herói,
// não repete as outras três nem cai nos efeitos genéricos, e tem recarga de técnica intermediária.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n');
const strip = (code) => code.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const main = read('main.js');
const slice = (from, to) => {
  const s = main.indexOf(from), e = main.indexOf(to, s);
  assert.ok(s >= 0 && e > s, `trecho de main.js não encontrado: ${from}`);
  return main.slice(s, e);
};
const recipes = read('characters.js');
const context = vm.createContext({ Math, Object, Number, String, Array });
vm.runInContext(`
  ${strip(read('class-info.js'))}
  ${strip(read('skillbook.js'))}
  ${recipes.slice(recipes.indexOf('export const CHARACTERS'), recipes.indexOf('// arquivos')).replace('export ', '')}
  ${slice('const HEROES = [', '\nconst variantsOf')}
  this.api = { VARIANTS, skillSetFor, cooldownForSkill };
`, context);
const { VARIANTS, skillSetFor, cooldownForSkill } = context.api;
assert.ok(VARIANTS.length >= 27, `esperava ao menos 27 variantes, achou ${VARIANTS.length}`);

// a IA percorre os quatro slots e as teclas cobrem o 4º
assert.match(main, /const SKILL_AI_ORDER = \[2, 1, 3, 0\];/, 'a IA tenta ultimate, técnica, segunda técnica e assinatura');
assert.match(main, /\['Z', 'X', 'V', 'B'\]/, 'teclas do slot 3: Z X V B');
assert.match(main, /const DIRECT_SKILL_SLOTS = \{ q: 0, w: 1, e: 2, r: 3 \};/, 'controle direto usa R no slot 3');

const generic = new Set(['storm', 'ward', 'burst', 'primary']);
const fourthEffects = new Set(), fourthNames = new Set();
for (const cfg of VARIANTS) {
  const skills = skillSetFor(cfg);
  assert.equal(skills.length, 4, `${cfg.id}: precisa de 4 habilidades`);
  const fourth = skills[3];
  assert.equal(fourth.slot, 3, `${cfg.id}: 4ª habilidade no slot 3`);
  assert.equal(fourth.ultimate, false, `${cfg.id}: a 4ª não é ultimate`);
  assert.ok(fourth.name && fourth.description, `${cfg.id}: nome e descrição`);
  assert.ok(!generic.has(fourth.effect), `${cfg.id}: efeito genérico ${fourth.effect}`);
  assert.ok(!skills.slice(0, 3).some((s) => s.effect === fourth.effect || s.name === fourth.name), `${cfg.id}: repete uma habilidade`);
  assert.ok(main.includes(`case '${fourth.effect}'`), `${cfg.id}: efeito ${fourth.effect} sem implementação em useExtraSkill`);
  fourthEffects.add(fourth.effect);
  fourthNames.add(fourth.name);
  const cd = cooldownForSkill(cfg, 3);
  assert.ok(cd >= 14 && cd <= 18, `${cfg.id}: recarga ${cd} fora de 14–18 s`);
  assert.ok(cooldownForSkill(cfg, 3, 3) < cd, `${cfg.id}: recarga cai com o nível`);
}
assert.equal(fourthEffects.size, VARIANTS.length, 'cada herói tem um efeito próprio no slot 3');
assert.equal(fourthNames.size, VARIANTS.length, 'nomes do slot 3 não se repetem');

console.log(`OK: ${VARIANTS.length} variantes com 4 habilidades e segunda técnica própria`);
