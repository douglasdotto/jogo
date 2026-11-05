// node tests/skill-glyphs.cjs — toda variante de VARIANTS tem os quatro glifos da barra de habilidades.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const skillUi = fs.readFileSync(path.join(__dirname, '..', 'skill-ui.js'), 'utf8');
const roster = fs.readFileSync(path.join(__dirname, '..', 'hero-roster.js'), 'utf8');
const variantsStart = roster.indexOf('export const VARIANTS = [');
assert.ok(variantsStart >= 0, 'hero-roster.js declara VARIANTS');
const variantsBlock = roster.slice(variantsStart, roster.indexOf('\n].map', variantsStart));
const ids = [...variantsBlock.matchAll(/^\s*\{ id: '([a-z_]+)'/gm)].map((match) => match[1]);
assert.ok(ids.length >= 27, `esperava ao menos 27 variantes, achou ${ids.length}`);

const glyphStart = skillUi.indexOf('export const SKILL_GLYPHS = {');
assert.ok(glyphStart >= 0, 'skill-ui.js declara SKILL_GLYPHS');
const glyphSource = skillUi.slice(glyphStart, skillUi.indexOf('\n};', glyphStart) + 3).replace('export ', '');
const context = {};
vm.runInNewContext(`${glyphSource}\nglobalThis.result = SKILL_GLYPHS;`, context);
const glyphs = context.result;

for (const id of ids) {
  const set = glyphs[id];
  assert.ok(Array.isArray(set), `variante ${id} sem glifo em SKILL_GLYPHS`);
  assert.equal(set.length, 4, `variante ${id} precisa de 4 glifos`);
  for (const glyph of set) assert.ok(typeof glyph === 'string' && glyph.trim(), `variante ${id} com glifo vazio`);
}

console.log(`skill-glyphs ok (${ids.length} variantes)`);
