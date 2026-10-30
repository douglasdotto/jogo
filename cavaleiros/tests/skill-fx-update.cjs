// node tests/skill-fx-update.cjs — expira efeitos sem deslocamentos repetidos e preserva ticks novos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const start = source.indexOf('function updateSkillFx(dt) {');
const end = source.indexOf('\nfunction clearSkillFx()', start);
assert.ok(start >= 0 && end > start, 'updateSkillFx precisa existir');
const updateSource = source.slice(start, end);
assert.doesNotMatch(updateSource, /skillFx\.splice\(/, 'a expiração não deve deslocar a lista para cada efeito');

const dropped = [];
let vfxTicks = 0;
const context = vm.createContext({
  skillFx: [],
  ticks: [],
  tickVfx() { vfxTicks++; },
  dropFx(effect) { dropped.push(effect.name); },
});
vm.runInContext(`${updateSource}\nthis.updateSkillFx = updateSkillFx;`, context);
vm.runInContext(`
  const make = (name, t, life, tick = () => ticks.push(name)) => ({
    name, t, life, mesh: { visible: false }, tick,
  });
  const spawned = make('spawned', 0, 2);
  const first = make('first', 0, 2);
  const expired = make('expired', 0.5, 1);
  const spawner = make('spawner', 0, 2, () => { ticks.push('spawner'); skillFx.push(spawned); });
  skillFx.push(first, expired, spawner);
`, context);

context.updateSkillFx(0.6);
assert.deepEqual(Array.from(context.ticks), ['spawner', 'expired', 'first'], 'mantém a atualização reversa dos efeitos existentes');
assert.deepEqual(dropped, ['expired'], 'descarta cada efeito expirado uma única vez');
assert.deepEqual(Array.from(context.skillFx, (effect) => effect.name), ['first', 'spawner', 'spawned'], 'preserva a ordem e mantém efeitos novos para o próximo quadro');
assert.equal(context.skillFx[2].t, 0, 'efeitos criados durante o tick ainda não avançam no mesmo quadro');
assert.equal(vfxTicks, 1, 'o relógio dos shaders avança uma vez');

console.log('OK: efeitos de habilidade expiram com compactação única e preservam ticks que criam novos efeitos');
