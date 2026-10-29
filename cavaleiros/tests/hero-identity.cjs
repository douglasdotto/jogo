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

console.log('OK: Assassino sem máscara e de silhueta robusta; Ninja encapuzado e mascarado');
