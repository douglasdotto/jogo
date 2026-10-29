// node cavaleiros/tests/progression.cjs — progressão entre partidas: ouro, oficina, maestria, conquistas e save.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'progression.js'), 'utf8');
const context = vm.createContext({});
// objetos do contexto têm outros protótipos: compara pelo conteúdo
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
vm.runInContext(source.replaceAll('export ', ''), context);
const P = vm.runInContext(`({ createProgression, goldFor, masteryXpFor, masteryLevel, migrateProgress, freshProgress, rewardHTML, renderCamp,
  UPGRADES, ACHIEVEMENTS, MASTERY_XP, MASTERY_PERKS, PROGRESS_KEY, PROGRESS_VERSION })`, context);

const storage = (data = {}) => ({ data, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); } });
const run = (over = {}) => ({ mode: 'mission', missionId: 'vila', won: true, difficultyId: 'normal', kills: 20, start: 1, last: 2, phase: 2,
  phasesCleared: 2, stars: 3, totalStars: 3, falls: 0, partySize: 1, heroes: [{ id: 'paladin', kills: 20 }], ultimates: 0, relics: 1, ...over });

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('OK:', name); } catch (e) { failures++; console.log('FALHOU:', name, '-', e.message.split('\n')[0]); }
}

test('ouro: abates, fases, estrelas, vitória e dificuldade', () => {
  const g = P.goldFor(run());
  assert.equal(g.base, 20 + 12 + 30 + 20);
  assert.equal(g.total, 82);
  assert.equal(P.goldFor(run({ difficultyId: 'pesadelo' })).total, Math.round(82 * 1.5));
  assert.equal(P.goldFor(run({ difficultyId: 'facil' })).total, Math.round(82 * 0.8));
  assert.equal(P.goldFor(run({ won: false, stars: 0, phasesCleared: 0, kills: 7 })).total, 7, 'derrota ainda paga os abates');
  assert.equal(P.goldFor(run({ mode: 'journey', stars: 0, phasesCleared: 12, last: 12, kills: 200 })).base, 200 + 72 + 60, 'jornada vencida paga mais');
  assert.equal(P.goldFor(run(), 2).total, Math.round(82 * 1.16), 'Bolsa de saque soma 8% por nível');
  assert.equal(P.goldFor({ kills: 'x', phasesCleared: -3 }).total, 0, 'valores estranhos não geram ouro');
});

test('fim de partida credita ouro e grava no storage', () => {
  const s = storage(), p = P.createProgression(s);
  assert.equal(p.gold, 0);
  const r = p.recordMatch(run());
  assert.equal(r.gold.total, 82);
  assert.equal(p.gold, 82);
  const saved = JSON.parse(s.data[P.PROGRESS_KEY]);
  assert.equal(saved.version, P.PROGRESS_VERSION);
  assert.equal(saved.gold, 82);
  assert.equal(P.createProgression(s).gold, 82, 'outra sessão lê o mesmo save');
});

test('oficina: custo crescente, teto e ouro insuficiente', () => {
  const p = P.createProgression(storage({ [P.PROGRESS_KEY]: JSON.stringify({ version: 2, gold: 1150 }) }));
  const vigor = P.UPGRADES.find((u) => u.id === 'vigor');
  same(vigor.costs, [80, 170, 300]);
  for (let k = 0; k < vigor.costs.length; k++) {
    assert.equal(p.upgradeCost('vigor'), vigor.costs[k]);
    assert.equal(p.buy('vigor').ok, true);
  }
  assert.equal(p.gold, 1150 - 550);
  assert.equal(p.upgradeCost('vigor'), null);
  same(p.buy('vigor'), { ok: false, reason: 'max' });
  assert.equal(p.gold, 600, 'compra no teto não cobra');
  assert.equal(p.buy('relic-choice').ok, true);
  assert.equal(p.relicChoices(), 4);
  assert.equal(p.buy('reroll').ok, true);
  assert.equal(p.rerolls(), 1);
  assert.equal(p.buy('reroll').reason, 'gold', 'sem ouro, nada muda');
  assert.equal(p.rerolls(), 1);
  assert.equal(p.buy('nao-existe').ok, false);
  for (const u of P.UPGRADES) for (let k = 1; k < u.costs.length; k++) assert.ok(u.costs[k] > u.costs[k - 1], `${u.id}: custo cresce`);
});

test('maestria: níveis 1–5, XP por partida e bônus pequenos', () => {
  assert.deepEqual([0, 59, 60, 179, 180, 400, 799, 800, 99999].map(P.masteryLevel), [1, 1, 2, 2, 3, 4, 4, 5, 5]);
  const p = P.createProgression(null);
  assert.equal(p.mastery('pyro').level, 1);
  assert.equal(p.heroBonus('pyro').hp, 0);
  const xp = P.masteryXpFor(run(), { kills: 20 });
  assert.equal(xp, 10 + 8 + 10 + 15);
  assert.equal(P.masteryXpFor(run(), { kills: 1000 }), 10 + 8 + 30 + 15, 'abates têm teto');
  const r = p.recordMatch(run({ heroes: [{ id: 'pyro', kills: 20 }, { id: 'pyro', kills: 5 }, { id: 'cleric', kills: 0 }] }));
  assert.equal(r.heroes.length, 2, 'herói repetido conta uma vez');
  assert.equal(p.mastery('pyro').xp, xp);
  assert.equal(p.mastery('pyro').games, 1);
  for (let k = 0; k < 30; k++) p.recordMatch(run({ heroes: [{ id: 'pyro', kills: 20 }] }));
  assert.equal(p.mastery('pyro').level, 5);
  const top = p.heroBonus('pyro');
  assert.ok(top.hp + top.dmg <= 0.1 + 1e-9, 'maestria máxima soma no máximo ~10%');
  assert.ok(Math.abs(top.hp - 0.04) < 1e-9 && Math.abs(top.dmg - 0.04) < 1e-9);
  assert.equal(top.aura, true);
  assert.equal(top.frame, 'ouro');
  assert.equal(p.heroBonus('cleric').aura, false);
  const sum = P.MASTERY_PERKS.slice(1).reduce((s, perk) => s + (perk.hp || 0) + (perk.dmg || 0), 0);
  assert.ok(sum <= 0.1 + 1e-9);
});

test('vigor da oficina entra no bônus do herói com teto de 6%', () => {
  const p = P.createProgression(storage({ [P.PROGRESS_KEY]: JSON.stringify({ version: 2, gold: 5000, upgrades: { vigor: 99 } }) }));
  assert.equal(p.upgradeLevel('vigor'), 3, 'nível acima do teto é cortado');
  assert.ok(Math.abs(p.heroBonus('king').hp - 0.06) < 1e-9);
});

test('conquistas: lista, desbloqueio único e progresso', () => {
  assert.ok(P.ACHIEVEMENTS.length >= 15);
  assert.equal(new Set(P.ACHIEVEMENTS.map((a) => a.id)).size, P.ACHIEVEMENTS.length);
  const p = P.createProgression(null);
  let r = p.recordMatch(run({ won: false, stars: 0, kills: 3 }));
  same(r.unlocked, []);
  r = p.recordMatch(run());
  assert.ok(r.unlocked.some((a) => a.id === 'primeira-vitoria'));
  assert.ok(r.unlocked.some((a) => a.id === 'perfeito'));
  r = p.recordMatch(run());
  assert.ok(!r.unlocked.some((a) => a.id === 'primeira-vitoria'), 'não repete o aviso');
  r = p.recordMatch(run({ mode: 'mission', missionId: 'castelo', start: 11, last: 12, phase: 12, difficultyId: 'pesadelo', partySize: 4, falls: 0 }));
  same(r.unlocked.map((a) => a.id).sort(), ['lich', 'lich-pesadelo', 'muralha']);
  r = p.recordMatch(run({ mode: 'journey', won: false, start: 1, last: 12, phase: 7, stars: 0, ultimates: 50, kills: 600 }));
  same(r.unlocked.map((a) => a.id).sort(), ['cacador', 'regicida', 'ultimates']);
  r = p.recordMatch(run({ mode: 'journey', won: true, start: 1, last: 12, phase: 12, difficultyId: 'dificil', stars: 0 }));
  assert.ok(r.unlocked.some((a) => a.id === 'jornada') && r.unlocked.some((a) => a.id === 'veterano'));
  const list = p.achievements();
  const kills = list.find((a) => a.id === 'ossario');
  assert.equal(kills.unlocked, false);
  assert.equal(kills.goal, 2000);
  assert.ok(kills.progress > 600);
  const elenco = list.find((a) => a.id === 'elenco');
  assert.equal(elenco.progress, 1);
  same(p.refresh(30).map((a) => a.id), ['constelacao'], 'estrelas antigas contam ao abrir o acampamento');
});

test('compras na oficina desbloqueiam "Mão na massa"', () => {
  const p = P.createProgression(storage({ [P.PROGRESS_KEY]: JSON.stringify({ version: 2, gold: 3000 }) }));
  const got = [];
  for (const id of ['vigor', 'vigor', 'bounty', 'mentor', 'reroll']) got.push(...p.buy(id).unlocked.map((a) => a.id));
  same(got, ['cofre', 'oficina'], 'save antigo sem "earned" conta o ouro atual como ganho');
});

test('migração de save v1 (sem versão) para v2', () => {
  const v1 = { ouro: 120, maestria: { paladin: 200, pyro: 'lixo' }, oficina: { vigor: 1, inventada: 3 }, conquistas: ['primeira-vitoria', 'nao-existe'], contadores: { kills: 40 } };
  const s = storage({ [P.PROGRESS_KEY]: JSON.stringify(v1) });
  const p = P.createProgression(s);
  const snap = p.snapshot();
  assert.equal(snap.version, 2);
  assert.equal(snap.gold, 120);
  assert.equal(snap.earned, 120);
  assert.equal(p.mastery('paladin').level, 3);
  assert.equal(snap.heroes.pyro, undefined, 'XP inválido é descartado');
  same(snap.upgrades, { vigor: 1 });
  same(Object.keys(snap.achievements), ['primeira-vitoria']);
  assert.equal(snap.counters.kills, 40);
  p.recordMatch(run());
  assert.equal(JSON.parse(s.data[P.PROGRESS_KEY]).version, 2, 'o próximo save já sai na versão nova');
});

test('save corrompido ou ausente não quebra o jogo', () => {
  const broken = storage({ [P.PROGRESS_KEY]: '{"gold": 50, ' });
  const p = P.createProgression(broken);
  assert.equal(p.corrupted, true);
  assert.equal(p.gold, 0);
  assert.equal(broken.data[`${P.PROGRESS_KEY}-corrompido`], '{"gold": 50, ', 'o texto estragado fica guardado à parte');
  p.recordMatch(run());
  assert.equal(JSON.parse(broken.data[P.PROGRESS_KEY]).gold, 82);
  for (const raw of ['null', '[]', '42', '"texto"', '{"version":2,"gold":-5,"heroes":[],"counters":"x","upgrades":{"vigor":"2"}}', '{"version":99,"gold":1e400}']) {
    const q = P.createProgression(storage({ [P.PROGRESS_KEY]: raw }));
    assert.ok(Number.isFinite(q.gold) && q.gold >= 0, raw);
    assert.equal(q.mastery('king').level, 1, raw);
  }
  assert.equal(P.createProgression(storage({ [P.PROGRESS_KEY]: '{"version":2,"upgrades":{"vigor":"2"}}' })).upgradeLevel('vigor'), 2);
  const throwing = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('cheio'); } };
  const q = P.createProgression(throwing);
  assert.equal(q.recordMatch(run()).gold.total, 82, 'storage bloqueado: segue na memória');
  assert.equal(P.createProgression(null).gold, 0);
  same(P.createProgression(storage()).snapshot(), P.freshProgress(), 'sem save, começa zerado');
});

test('recompensa do fim de partida mostra ouro, conta e maestria', () => {
  const p = P.createProgression(null);
  const html = P.rewardHTML(p.recordMatch(run({ heroes: [{ id: 'paladin', kills: 200 }] })), [{ id: 'paladin', name: 'Paladino', portrait: 'p.png', color: ['#fff', '#000'] }]);
  assert.match(html, /\+82 Ouro/);
  assert.match(html, /Abates <b>\+20<\/b>/);
  assert.match(html, /Paladino/);
  assert.match(html, /Maestria 2!/, '63 XP sobem o Paladino para a maestria 2');
  assert.equal(P.rewardHTML(null), '');
});

console.log(failures ? `${failures} falharam.` : 'Progressão: tudo certo.');
process.exitCode = failures ? 1 : 0;
