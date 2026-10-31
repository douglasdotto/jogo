const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, [
  path.join(__dirname, 'simulacao.cjs'), 'campanha', 'coracao-do-castelo', 'normal', '1',
  'equipe=paladin,guardian,pyro,brute', '20261031', 'detalhe',
], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });

assert.equal(result.status, 0, result.stderr || result.stdout);
assert.match(result.stdout, /iniciais \(4\): paladin \+ guardian \+ pyro \+ brute/,
  'o benchmark deve usar o quarteto informado, sem substituições silenciosas');
console.log('OK: simulador aceita equipe explícita e mantém a escalação exata');
