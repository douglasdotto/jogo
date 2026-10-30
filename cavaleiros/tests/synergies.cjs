// Sinergias: o bônus depende do estado do alvo, não de quem está no grupo; a tela de escolha mostra as duplas ativas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(dir, 'synergies.js'), 'utf8');
const main = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(`${source.replaceAll('export ', '')}
this.api = { SYNERGIES, damageSynergies, synergyDamageMultiplier, synergyDamageTakenMultiplier, synergyHealMultiplier, synergySummonHaste, activeSynergies };`, context);
const s = context.api;

const pos = (x) => ({ x, distanceTo: (o) => Math.abs(o.x - x) });
const enemy = (state = {}) => ({ dead: false, slowT: 0, rootT: 0, stunT: 0, sheepT: 0, markT: 0, ...state });
const hero = (id, state = {}) => ({ cfg: { id }, dead: false, pos: pos(0), ...state });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

// dados válidos: ids existem, ícone curto, efeito curto
const heroIds = new Set([...main.matchAll(/\{ id: '([a-z_]+)', names: \[/g)].map((m) => m[1]));
assert.ok(heroIds.size >= 27, 'lista de heróis lida do main.js');
assert.ok(s.SYNERGIES.length >= 7, 'pelo menos 4 sinergias novas além das 3 originais');
assert.equal(new Set(s.SYNERGIES.map((x) => x.id)).size, s.SYNERGIES.length, 'ids únicos');
for (const synergy of s.SYNERGIES) {
  for (const id of [...synergy.sources, ...synergy.payoff, ...(synergy.attackers || []), ...(synergy.healers || []), ...(synergy.summoners || [])])
    assert.ok(heroIds.has(id), `${synergy.id}: herói ${id} existe`);
  assert.ok(synergy.icon && [...synergy.icon].length <= 2, `${synergy.id}: ícone curto`);
  assert.ok(synergy.effect.length <= 90, `${synergy.id}: efeito curto para a dica`);
  for (const id of synergy.variants) assert.ok([...synergy.sources, ...synergy.payoff].includes(id));
}

// Fogo: vale para lentidão de qualquer fonte (Viking do Gelo incluído), sem exigir Criomante/Druida no grupo
close(s.synergyDamageMultiplier('pyro', enemy({ slowT: 2 })), 1.2);
close(s.synergyDamageMultiplier('pyro', enemy({ rootT: 1 })), 1.2);
close(s.synergyDamageMultiplier('pyro', enemy()), 1);
close(s.synergyDamageMultiplier('pyro', enemy({ slowT: 2, dead: true })), 1);
close(s.synergyDamageMultiplier('cryo', enemy({ slowT: 2 })), 1);
// Perfurante: preso por raízes ou estase, sem exigir Druida
for (const id of ['crossbow', 'ninja', 'archer']) close(s.synergyDamageMultiplier(id, enemy({ rootT: 1 })), 1.2);
close(s.synergyDamageMultiplier('crossbow', enemy({ slowT: 1 })), 1);
// novas
close(s.synergyDamageMultiplier('crusher', enemy({ slowT: 1 })), 1.2);
close(s.synergyDamageMultiplier('assassin', enemy({ sheepT: 1 })), 1.25);
close(s.synergyDamageMultiplier('assassin', enemy({ stunT: 1 })), 1.25);
close(s.synergyDamageMultiplier('assassin', enemy()), 1);
close(s.synergyDamageMultiplier('crossbow', enemy({ markT: 3 })), 1.2);
close(s.synergyDamageMultiplier('archer', enemy({ markT: 3 })), 1, 'a própria Arqueira não ganha com a marca');
close(s.synergyDamageMultiplier('crossbow', enemy({ markT: 3, rootT: 1 })), 1.44);   // bônus diferentes se multiplicam
assert.deepEqual([...s.damageSynergies('crossbow', enemy({ markT: 3, rootT: 1 }))].map((x) => x.id), ['root-pierce', 'hunter-mark']);

// Guardião: só a provocação dele (stanceT) conta; a guarda dada pela Clériga (guardT) não
const berserker = hero('berserker', { furyT: 2 });
close(s.synergyDamageTakenMultiplier(berserker, [berserker, hero('guardian', { guardT: 3, stanceT: 0 })]), 1);
close(s.synergyDamageTakenMultiplier(berserker, [berserker, hero('guardian', { guardT: 3, stanceT: 3 })]), 0.8);
close(s.synergyDamageTakenMultiplier(berserker, [berserker, hero('guardian', { stanceT: 3, pos: pos(9) })]), 1);
close(s.synergyDamageTakenMultiplier(hero('berserker', { furyT: 0 }), [hero('guardian', { stanceT: 3 })]), 1);

// Muralha sagrada: cura extra no Guardião que provoca
close(s.synergyHealMultiplier('paladin', hero('guardian', { stanceT: 2 })), 1.3);
close(s.synergyHealMultiplier('cleric', hero('guardian', { stanceT: 2 })), 1.3);
close(s.synergyHealMultiplier('cleric', hero('guardian', { guardT: 2, stanceT: 0 })), 1);
close(s.synergyHealMultiplier('angel', hero('guardian', { stanceT: 2 })), 1);
close(s.synergyHealMultiplier('cleric', hero('berserker', { stanceT: 2 })), 1);

// Ritmo das crias: invocações aceleram sob a canção
close(s.synergySummonHaste(hero('necro', { songT: 3 })), 1.3);
close(s.synergySummonHaste(hero('engineer', { songT: 3 })), 1.3);
close(s.synergySummonHaste(hero('beast_tamer', { songT: 0 })), 1);
close(s.synergySummonHaste(hero('king', { songT: 3 })), 1);
close(s.synergySummonHaste(null), 1);

// tela de escolha: precisa de quem causa o estado e de outro herói que aproveita
const active = (ids) => [...s.activeSynergies(ids)].map((x) => x.id).sort();
assert.deepEqual(active(['pyro']), []);
assert.deepEqual(active(['pyro', 'iceviking']), ['frozen-flames']);
assert.deepEqual(active(['cryo', 'crusher', 'pyro']), ['frozen-flames', 'frozen-shatter']);
assert.deepEqual(active(['archer']), [], 'a Arqueira sozinha não liga sinergia com ela mesma');
assert.deepEqual(active(['archer', 'druid']), ['root-pierce']);
assert.deepEqual(active(['archer', 'crossbow']), ['hunter-mark']);
assert.deepEqual(active(['guardian', 'cleric', 'berserker']), ['guardian-rage', 'sacred-wall']);
assert.deepEqual(active(['bard', 'necro']), ['song-summons']);
assert.deepEqual(active(['chronist', 'assassin']), ['stasis-execution']);

// combate usa o estado do alvo, sem filtrar pelo grupo, e o popup é só ícone + porcentagem
const applyBody = main.slice(main.indexOf('function applySynergy('), main.indexOf('function inMeleeArc('));
assert.match(applyBody, /damageSynergies\(owner\.cfg\.id, target\)/);
assert.doesNotMatch(applyBody, /partyNow|members|cryo|druid/);
assert.match(applyBody, /popText\(target\.pos, `\$\{active\[0\]\.icon\}\+\$\{Math\.round/);
// Guardião só marca stanceT nas próprias provocações; a Clériga dá apenas guardT
const clericAt = main.indexOf("} else if (id === 'cleric') {");
const cleric = main.slice(clericAt, main.indexOf("} else if (id === 'bard') {", clericAt));
assert.doesNotMatch(cleric, /\bstanceT/);
assert.match(cleric, /synergyHealMultiplier\(id, h\)/);
assert.match(main, /this\.guardT = this\.stanceT = scaleBranchEffect\(this, 'control', 4 \+ \(level - 1\)\) \* power;/);
assert.match(main, /sentry\.fireT -= dt \* synergySummonHaste\(sentry\.owner\);/);
// tela de escolha mostra as sinergias ativas como ícones com dica
assert.match(main, /activeSynergies\(projectedTeam\.map\(\(member\) => member\.id\)\)/);
assert.match(main, /class="party-roles party-synergies"/);

console.log('sinergias ok');
