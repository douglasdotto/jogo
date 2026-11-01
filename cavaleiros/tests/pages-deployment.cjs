const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..');
const source = path.join(repo, 'cavaleiros');
const workflow = fs.readFileSync(path.join(repo, '.github', 'workflows', 'pages.yml'), 'utf8');
const prepareStep = workflow.match(/Preparar arquivos públicos\s+run: \|\s+([\s\S]*?)(?=\n\s{6}- name:)/)?.[1];
assert.ok(prepareStep, 'o workflow publica arquivos estáticos');

const extensions = [...prepareStep.matchAll(/cavaleiros\/\*\.([a-z]+)/g)].map((match) => match[1]);
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'age-popozitos-pages-'));
try {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isFile() && entry.name !== 'server.js' && extensions.includes(path.extname(entry.name).slice(1))) {
      fs.copyFileSync(path.join(source, entry.name), path.join(output, entry.name));
    }
  }

  const world = fs.readFileSync(path.join(output, 'world.js'), 'utf8');
  const imports = [...world.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)].map((match) => match[1]);
  for (const module of imports) {
    assert.ok(fs.existsSync(path.join(output, module)), `o artifact do Pages inclui o módulo importado por world.js: ${module}`);
  }
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}

console.log('OK: o artifact do Pages inclui os módulos importados pelo mundo');
