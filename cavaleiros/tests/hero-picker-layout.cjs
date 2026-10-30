// CSS estrutural dos cards de herói no seletor desktop.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const marker = '/* Seletor desktop: cards de herói quadrados';
const start = html.indexOf(marker);
const end = html.indexOf('</style>', start);
assert.ok(start >= 0 && end > start, 'regras de cards desktop precisam estar no estilo de index.html');
const css = html.slice(start, end);

assert.match(css, /@media\s*\(min-width:\s*1001px\)\s*and\s*\(min-height:\s*821px\)/,
  'a regra vale somente para o layout desktop com altura suficiente');
assert.doesNotMatch(css, /\.card\.(?:relic|diff)/, 'reliquias e dificuldade não recebem a regra de card quadrado');

const card = css.match(/#pick:has\(#pickList\.grid\) #pickList\.grid \.pick-rows \.pick-row > \.card\s*\{([^}]*)\}/);
assert.ok(card, 'o alvo é somente um card de herói dentro da linha do seletor');
assert.match(card[1], /--hero-card-size:\s*clamp\(/);
assert.match(card[1], /width:\s*min\(var\(--hero-card-size\),\s*100%\)/);
assert.match(card[1], /aspect-ratio:\s*1\s*\/\s*1/);

const portrait = css.match(/#pick:has\(#pickList\.grid\) #pickList\.grid \.pick-rows \.pick-row > \.card \.portrait\s*\{([^}]*)\}/);
assert.ok(portrait, 'o retrato tem regra explícita de tamanho quadrado');
assert.match(portrait[1], /width:\s*min\(100%,\s*clamp\(80px,\s*calc\(var\(--hero-card-size\) - 96px\),\s*120px\)\)/);
assert.match(portrait[1], /height:\s*auto/);
assert.match(portrait[1], /aspect-ratio:\s*1\s*\/\s*1/);
assert.match(portrait[1], /flex:\s*0\s+0\s+auto/);

const name = css.match(/#pick:has\(#pickList\.grid\) #pickList\.grid \.pick-rows \.pick-row > \.card \.pick-card-copy \.ribbon\s*\{([^}]*)\}/);
assert.ok(name, 'nome do herói mantém uma regra de leitura própria');
assert.match(name[1], /-webkit-line-clamp:\s*2/);
assert.match(name[1], /white-space:\s*normal/);

const role = css.match(/#pick:has\(#pickList\.grid\) #pickList\.grid \.pick-rows \.pick-card-copy \.pick-card-role\s*\{([^}]*)\}/);
assert.ok(role, 'função do herói tem espaço reservado');
assert.match(role[1], /white-space:\s*nowrap/);
assert.match(role[1], /text-overflow:\s*ellipsis/);

const copy = css.match(/#pick:has\(#pickList\.grid\) #pickList\.grid \.pick-rows \.pick-card-copy\s*\{([^}]*)\}/);
assert.ok(copy, 'o texto tem um contêiner próprio abaixo do retrato');
assert.match(copy[1], /flex:\s*1\s+1\s+auto/);
assert.match(copy[1], /align-content:\s*center/);

// abas temáticas: uma linha só e grade de 3–4 colunas definida pelo main.js
const campaignCss = fs.readFileSync(path.join(__dirname, '..', 'campaign.css'), 'utf8');
const tabs = campaignCss.match(/#pick:has\(#pickList\.grid\) \.pick-filters\s*\{([^}]*)\}/);
assert.ok(tabs, 'barra de abas tem regra própria');
assert.match(tabs[1], /flex-wrap:\s*nowrap/, 'as abas ficam numa linha só');
assert.match(campaignCss, /grid-template-columns:\s*repeat\(var\(--pick-cols, 4\), minmax\(0, 1fr\)\)/, 'a grade da aba usa as colunas do main.js');
const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert.match(mainJs, /setProperty\('--pick-cols'/, 'main.js informa as colunas que a navegação por setas usa');

console.log('hero-picker-layout ok — card e retrato quadrados, texto reservado, seletor desktop isolado, abas numa linha');
