const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rapido = process.argv.includes('--rapido');
const pasta = path.resolve(__dirname, '..');
const arquivos = fs.readdirSync(__dirname, { withFileTypes: true })
  .filter((item) => item.isFile() && /\.(cjs|mjs)$/.test(item.name))
  .map((item) => item.name)
  .filter((nome) => nome !== path.basename(__filename) && nome !== 'terrain.js')
  .filter((nome) => !rapido || nome !== 'simulacao.cjs')
  .sort();

let passaram = 0;
let falharam = 0;

for (const nome of arquivos) {
  const inicio = Date.now();
  const resultado = spawnSync(process.execPath, [path.join(__dirname, nome)], {
    cwd: pasta,
    encoding: 'utf8',
  });
  const segundos = ((Date.now() - inicio) / 1000).toFixed(2);
  const passou = resultado.status === 0 && !resultado.error;

  console.log(`${passou ? '✓' : '✗'} ${nome} (${segundos}s)`);
  if (passou) {
    passaram++;
  } else {
    falharam++;
    // Mostra só o fim da saída para facilitar a leitura.
    const saida = (resultado.stdout || '') + (resultado.stderr || '');
    if (saida.trim()) console.log(saida.trimEnd().split(/\r?\n/).slice(-15).join('\n'));
    if (resultado.error) console.log(resultado.error.message);
  }
}

console.log(`${passaram} passaram, ${falharam} falharam`);
if (falharam > 0) process.exitCode = 1;
