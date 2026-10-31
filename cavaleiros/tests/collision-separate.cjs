// node tests/collision-separate.cjs — collisionMove não atravessa paredes/água funda, separate()
// afasta unidades sobrepostas e rochas, e fantasmas (phasing) passam por tudo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
const worldSource = fs.readFileSync(path.join(dir, 'world.js'), 'utf8').replace(/\r\n/g, '\n');
const perf = fs.readFileSync(path.join(dir, 'scene-perf.js'), 'utf8').replace(/^export /gm, '');
const perfContext = vm.createContext({});
vm.runInContext(`${perf}\nthis.api = { gridCellKey };`, perfContext);

const start = main.indexOf('const collisionFrom = { x: 0, z: 0 }');
const end = main.indexOf('\n// Controle direto opcional', start);
assert.ok(start >= 0 && end > start, 'física de colisão precisa existir');
// canStep real do mundo, com relevo e água de teste.
const stepStart = worldSource.indexOf('  function canStep(from, to) {');
const stepEnd = worldSource.indexOf('\n  }\n', stepStart) + 4;
assert.ok(stepStart >= 0 && stepEnd > stepStart, 'world.canStep precisa existir');

function harness({ obstacles = [] } = {}) {
  // degrau sintético (o mapa não tem mais platôs, mas o canStep segue barrando desnível):
  // x >= 5 fica 3 m acima; lago fundo em volta de (0, 20)
  const groundHeight = (x) => (x >= 5 ? 3 : 0);
  const deepAt = (p) => Math.hypot(p.x, p.z - 20) < 3.2;
  const context = vm.createContext({ Math, Map, Set, Object, units: [], gridCellKey: perfContext.api.gridCellKey });
  vm.runInContext(`
    const groundHeight = ${groundHeight.toString()};
    const deepAt = ${deepAt.toString()};
    ${worldSource.slice(stepStart, stepEnd)}
    this.groundHeight = groundHeight; this.canStep = canStep;
  `, context);
  context.world = { groundHeight: context.groundHeight, canStep: context.canStep, obstacles };
  vm.runInContext(`${main.slice(start, end)}\nthis.api = { collisionMove, separate };`, context);
  return context;
}

let next = 0;
const unit = (x, z, extra = {}) => ({
  id: next++, team: 'hero', size: 1, dead: false, pos: { x, y: 0, z }, vel: { x: 0, z: 0 }, ...extra,
});
const gap = (a, b) => Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);

// ---------- collisionMove ----------
{
  const c = harness();
  const u = unit(0, 0);
  assert.equal(c.api.collisionMove(u, 1, 0), 1, 'passo livre anda tudo');
  assert.deepEqual([u.pos.x, u.pos.z], [1, 0]);

  // contra o penhasco: encurta o passo pela metade até caber, nunca sobe a parede
  const w = unit(4, 0);
  const moved = c.api.collisionMove(w, 2, 0);
  assert.ok(Math.abs(moved - 0.5) < 1e-9, `anda só até antes do penhasco (andou ${moved})`);
  assert.ok(w.pos.x < 5, `não atravessa a parede (x=${w.pos.x})`);
  for (let i = 0; i < 20; i++) c.api.collisionMove(w, 1.5, 0);
  assert.ok(w.pos.x < 5, `insistir não atravessa a parede (x=${w.pos.x})`);

  // água funda: nenhuma fração do passo entra no lago
  const s = unit(0, 16.9);
  assert.equal(c.api.collisionMove(s, 0, 0.2), 0, 'não entra na água funda');
  assert.equal(s.pos.z, 16.9, 'fica parado na margem');
}

// ---------- separate: unidades ----------
{
  const c = harness();
  const a = unit(0, 0), b = unit(0, 0);   // empilhados no mesmo ponto
  const foe = unit(-10, -10, { team: 'skeleton' }), hero = unit(-10, -10.2);
  c.units.push(a, b, foe, hero);
  c.api.separate();
  assert.ok(gap(a, b) >= 0.86 * 2 - 0.01, `aliados empilhados se afastam (dist=${gap(a, b)})`);
  assert.ok(gap(foe, hero) >= 0.68 * 2 - 0.01, `adversários se afastam até a distância de combate (dist=${gap(foe, hero)})`);
  assert.ok(gap(foe, hero) < 0.86 * 2 - 0.01, 'adversários podem ficar mais perto que aliados');
}

// velocidade de aproximação é cancelada no contato
{
  const c = harness();
  const a = unit(0, 0, { vel: { x: 2, z: 0 } }), b = unit(1, 0, { vel: { x: -2, z: 0 } });
  c.units.push(a, b);
  c.api.separate();
  assert.ok(a.vel.x - b.vel.x <= 1e-9, `não continuam se empurrando (va=${a.vel.x}, vb=${b.vel.x})`);
}

// estrutura/totem não se move; a unidade móvel é que sai
{
  const c = harness();
  const totem = unit(0, 0, { totem: true }), a = unit(0.3, 0);
  c.units.push(totem, a);
  c.api.separate();
  assert.deepEqual([totem.pos.x, totem.pos.z], [0, 0], 'totem fica parado');
  assert.ok(gap(totem, a) >= 0.86 * 2 - 0.01, 'a unidade sai de cima do totem');
}

// separação nunca empurra ninguém para cima do penhasco
{
  const c = harness();
  const a = unit(4.9, 0), b = unit(4.9, 0);
  c.units.push(a, b);
  c.api.separate();
  assert.ok(a.pos.x < 5 && b.pos.x < 5, `ninguém atravessa a parede ao se separar (${a.pos.x}, ${b.pos.x})`);
  assert.ok(gap(a, b) >= 0.86 * 2 - 0.01, `escorregam ao longo da parede (dist=${gap(a, b)})`);
}

// ---------- separate: obstáculos e fantasmas ----------
{
  const rock = { x: 0, z: 0, r: 1 };
  const c = harness({ obstacles: [rock] });
  const a = unit(0.2, 0.1);
  const ghost = unit(0.1, 0, { phasing: true });
  const ghostPal = unit(-20, 0);   // empilhado com outro fantasma, longe da rocha
  const ghost2 = unit(-20, 0, { phasing: true });
  c.units.push(a, ghost, ghostPal, ghost2);
  c.api.separate();
  const out = Math.hypot(a.pos.x - rock.x, a.pos.z - rock.z);
  assert.ok(out >= rock.r + 0.53 - 0.01, `a unidade sai da rocha (dist=${out})`);
  assert.deepEqual([ghost.pos.x, ghost.pos.z], [0.1, 0], 'fantasma atravessa a rocha');
  assert.deepEqual([ghost2.pos.x, ghost2.pos.z], [-20, 0], 'fantasma atravessa outras unidades');
  assert.deepEqual([ghostPal.pos.x, ghostPal.pos.z], [-20, 0], 'quem está sob o fantasma não é empurrado');
}

// altura acompanha o chão (+ flutuação)
{
  const c = harness();
  const flyer = unit(-30, 0, { hover: 0.7 });
  flyer.pos.y = 4;
  c.units.push(flyer);
  c.api.separate();
  assert.equal(flyer.pos.y, 0.7, 'pos.y volta ao chão mais o hover');
}

console.log('OK: colisão respeita paredes e água, separação afasta unidades e rochas, fantasmas atravessam');
