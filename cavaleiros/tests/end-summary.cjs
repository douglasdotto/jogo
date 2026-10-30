// node tests/end-summary.cjs — linha de dica no resumo do fim da partida (stats.js).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const dir = path.join(__dirname, '..');
const strip = (file) => fs.readFileSync(path.join(dir, file), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '');
const context = vm.createContext({});
vm.runInContext(strip('battle-report.js'), context);
vm.runInContext(strip('stats.js'), context);
const { summaryHTML, buildBattleReport } = context;

const hero = { cfg: { name: 'Paladino', portrait: 'p.png' }, level: 1, stats: { dano: 120, abates: 3, recebido: 40, cura: 0 } };

// vitória: a dica de progresso aparece (antes era descartada) e sai dos detalhes
const won = buildBattleReport({ won: true, heroes: [{ name: 'Paladino', damage: 120 }], mission: { goal: { type: 'win' }, stars: 2, nextMission: 'A Ponte do Rio' } });
const winHtml = summaryHTML([hero], won, { won: true, kills: 3, falls: 0 });
assert.match(winHtml, /<p class="end-tip won">[^<]*Próxima missão liberada: A Ponte do Rio\.<\/p>/);
assert.equal(winHtml.match(/Próxima missão liberada/g).length, 1, 'a dica não se repete nos detalhes');

// derrota continua com a dica, sem o estilo de vitória
const lost = buildBattleReport({ won: false, mission: { goal: { type: 'escort' }, villagerDown: true } });
const lostHtml = summaryHTML([hero], lost, { won: false, kills: 0, falls: 1 });
assert.match(lostHtml, /<p class="end-tip">O aldeão caiu/);

console.log('end-summary: ok');
