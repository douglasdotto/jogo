// node tests/skill-tooltip.cjs — toda variante de VARIANTS gera dica não vazia nos 4 slots da barra de habilidades.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n');
const strip = (code) => code.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const main = read('main.js');
const slice = (from, to, extra = 0) => {
  const s = main.indexOf(from);
  const e = main.indexOf(to, s);
  assert.ok(s >= 0 && e > s, `trecho de main.js não encontrado: ${from}`);
  return main.slice(s, e + extra);
};

const recipes = read('characters.js');
const charactersSource = recipes.slice(recipes.indexOf('export const CHARACTERS'), recipes.indexOf('// arquivos')).replace('export ', '');
const heroesSource = slice('const HEROES = [', '\nconst variantsOf');
const glyphSource = slice('const SKILL_GLYPHS = {', '\n};', 3);
const tooltipSource = slice('const SKILL_KIND = [', "\nregisterTooltip('skill'");

const context = vm.createContext({ Math, Object, Number, String, Array, onField: [] });
vm.runInContext(`
  ${strip(read('class-info.js'))}
  ${strip(read('skillbook.js'))}
  ${strip(read('skill-targeting.js'))}
  ${strip(read('upgrade-branches.js'))}
  ${charactersSource}
  ${heroesSource}
  ${glyphSource}
  const heroes = () => onField;
  ${tooltipSource}
  this.api = { VARIANTS, skillTooltip, skillSetFor };
`, context);
const { VARIANTS, skillTooltip, skillSetFor } = context.api;
assert.ok(VARIANTS.length >= 27, `esperava ao menos 27 variantes, achou ${VARIANTS.length}`);

const el = (attrs) => ({ getAttribute: (name) => attrs[name] ?? null });
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Na escolha de herói (ninguém em campo): nível 1.
for (const cfg of VARIANTS) {
  const skills = skillSetFor(cfg);
  for (const slot of [0, 1, 2, 3]) {
    const html = skillTooltip(el({ 'data-hero': cfg.id, 'data-slot': String(slot) }));
    assert.ok(typeof html === 'string' && html.trim(), `${cfg.id} slot ${slot}: dica vazia`);
    const plain = text(html);
    const skill = skills.find((item) => item.slot === slot);
    assert.ok(plain.includes(skill.name), `${cfg.id} slot ${slot}: dica sem o nome da habilidade`);
    assert.ok(skill.description && plain.includes(skill.description), `${cfg.id} slot ${slot}: dica sem descrição`);
    assert.match(plain, /Recarga \d/, `${cfg.id} slot ${slot}: dica sem recarga`);
    assert.doesNotMatch(plain, /undefined|NaN|null/, `${cfg.id} slot ${slot}: valor quebrado na dica: ${plain}`);
    assert.ok(plain.includes('Nv 1'), `${cfg.id} slot ${slot}: nível 1 fora de campo`);
  }
}

// Na batalha: herói em campo no nível máximo, com tecla e rota de evolução.
const champion = VARIANTS.find((v) => v.id === 'champion');
context.onField.push({ cfg: champion, level: 3, skillRate: 1, skillPower: 1.2, range: champion.range, evolutionBranches: { damage: 1 } });
const battle = text(skillTooltip(el({ 'data-hero': 'champion', 'data-slot': '2', 'data-key': 'E' })));
assert.ok(battle.includes('Nv 3') && battle.includes('Nível máximo'), 'nível do herói em campo aparece na dica');
assert.ok(battle.includes('Tecla E'), 'tecla do atalho aparece na dica');
assert.match(skillTooltip(el({ 'data-hero': 'champion', 'data-slot': '2' })), /class="tt-routes"/, 'rota de evolução escolhida aparece na dica');

// Atributos inválidos não quebram a dica.
assert.equal(skillTooltip(el({ 'data-hero': 'ninguem', 'data-slot': '0' })), '');
assert.equal(skillTooltip(el({ 'data-hero': 'champion', 'data-slot': '7' })), '');

console.log(`OK: dicas de habilidade completas para ${VARIANTS.length} variantes × 4 slots`);
