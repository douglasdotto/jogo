// node tests/campaign-guidance.cjs — regressões da missão recomendada no mapa.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'campaign.js'), 'utf8').replace(/^export /gm, '');
function element(focusState) {
  const classes = new Set();
  return {
    className: '', classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force = !classes.has(name)) => (force ? classes.add(name) : classes.delete(name), force),
      contains: (name) => classes.has(name),
    },
    attributes: {}, style: {}, children: [],
    setAttribute(name, value) { this.attributes[name] = value; },
    appendChild(child) { this.children.push(child); },
    append(...children) { this.children.push(...children); },
    focus() { if (focusState) focusState.current = this; },
    querySelector: () => element(focusState),
  };
}

function render(stars, visuals = null) {
  const data = new Map([['cavaleiros-campanha', JSON.stringify(stars)]]);
  if (visuals) data.set('cavaleiros-campanha-visual', JSON.stringify(visuals));
  const writes = new Map();
  const focusState = { current: null };
  const map = element(focusState), info = element(focusState), root = element(focusState);
  let replayButton = null, playButton = null, infoMarkup = '';
  Object.defineProperty(info, 'innerHTML', {
    get: () => infoMarkup,
    set(value) {
      infoMarkup = value;
      playButton = element(focusState);
      playButton.className = 'camp-play';
      replayButton = infoMarkup.includes('class="camp-replay-button"') ? element(focusState) : null;
      if (replayButton) replayButton.className = 'camp-replay-button';
    },
  });
  root.isConnected = true;
  root.closest = () => null;
  root.querySelector = (selector) => selector === '.camp-map' ? map : info;
  info.querySelector = (selector) => selector === '.camp-replay-button' ? replayButton : selector === '.camp-play' ? playButton : element(focusState);
  const document = { createElement: () => element(focusState), body: element(focusState) };
  const context = vm.createContext({
    document,
    location: { search: '' },
    URLSearchParams,
    localStorage: {
      getItem: (key) => data.get(key) ?? null,
      setItem(key, value) {
        writes.set(key, (writes.get(key) || 0) + 1);
        data.set(key, String(value));
      },
    },
    addEventListener() {}, removeEventListener() {},
  });
  vm.runInContext(`${source}\nthis.renderCampaign = renderCampaign; this.campaignCosmetics = campaignCosmetics; this.equippedCampaignCosmetic = equippedCampaignCosmetic;`, context);
  context.renderCampaign(root, () => {}, null, null, '', (mission) => mission.id === 'coracao-do-castelo'
    ? 'Equipe recomendada para 4 heróis: Paladino (cura), Guardião (proteção), Viking (dano a chefe) e Clériga (suporte/cura).'
    : mission.id === 'ruinas'
      ? 'Equipe recomendada para 3 heróis: Paladino (cura), Piromante (dano em área) e Clériga (suporte/cura). Reforço recomendado: Guardião (proteção).'
      : mission.id === 'santuario'
        ? 'Equipe recomendada para 2 heróis: Paladino (cura) e Guardião (proteção).'
      : mission.id === 'chamas'
        ? 'Equipe recomendada para 2 heróis: Paladino (cura) e Viking (machado à distância).'
        : mission.id === 'lago-sombrio'
          ? 'Equipe recomendada para 4 heróis: Paladino (cura), Guardião (proteção), Piromante (dano em área) e Clériga (suporte/cura).'
      : '');
  return {
    map, info, focusState, data,
    campaignCosmetics: () => context.campaignCosmetics(),
    equippedCampaignCosmetic: () => context.equippedCampaignCosmetic(),
    visualWriteCount: () => writes.get('cavaleiros-campanha-visual') || 0,
    get replayButton() { return replayButton; }, get playButton() { return playButton; },
  };
}

const allDone = { vila: 3, ponte: 3, santuario: 3, chamas: 3, fazendas: 3, lago: 3, duelo: 3, caca: 3, resgate: 3, ruinas: 3, torre: 3, 'lago-sombrio': 3, cemiterio: 3, horda: 3, castelo: 3, cripta: 3, trono: 3, 'coracao-do-castelo': 3 };
const imperfect = { ...allDone, vila: 1, 'lago-sombrio': 2 };
let view = render(imperfect);
assert.match(view.info.innerHTML, /Espiral do Eclipse/);
assert.match(view.info.innerHTML, /aria-valuemax="1" aria-valuenow="1"/);
assert.match(view.info.innerHTML, /Desbloqueado · 3\/3 estrelas do capítulo/);
assert.match(view.info.innerHTML, /class="camp-team-tip"[^>]*>.*Equipe recomendada para 4 heróis: Paladino \(cura\), Guardião \(proteção\), Viking \(dano a chefe\) e Clériga \(suporte\/cura\)\./, 'a composição sugerida aparece no resumo antes de iniciar a missão final');
assert.match(view.info.innerHTML, /class="camp-chapter-label">Capítulo VI · O coração sombrio<\/div>/);
assert.ok(view.info.innerHTML.indexOf('camp-chapter-label') < view.info.innerHTML.indexOf('camp-name'), 'o capítulo aparece antes do nome da missão');
assert.ok(view.map.children.at(-1).classList.contains('sel'), 'mantém a missão final do Coração do Castelo destacada quando a campanha foi concluída');
assert.match(view.info.innerHTML, /A Vila ainda pode render estrelas/);
assert.match(view.info.innerHTML, /3 estrelas restantes/);
view.replayButton.onclick();
assert.ok(view.map.children[0].classList.contains('sel'), 'a recomendação leva à primeira missão com estrelas faltando');
assert.match(view.info.innerHTML, /A Vila/);
assert.match(view.info.innerHTML, /class="camp-chapter-label">Capítulo I · Sinais na estrada<\/div>/, 'o capítulo acompanha a missão selecionada');
assert.ok(!view.info.innerHTML.includes('camp-team-tip'), 'a sugestão específica da fase final não aparece em outras missões');
assert.ok(!view.info.innerHTML.includes('camp-replay-button'), 'o atalho some quando a missão recomendada já está selecionada');
assert.equal(view.focusState.current, view.playButton, 'o foco vai para Batalhar após a seleção');

view = render({ ...allDone, ponte: 2 });
assert.ok(view.map.children.at(-1).classList.contains('sel'));
assert.match(view.info.innerHTML, /A Ponte do Rio ainda pode render estrelas/);
view.replayButton.onclick();
assert.ok(view.map.children[1].classList.contains('sel'), 'a recomendação ignora arenas perfeitas e abre a próxima que pode melhorar');

view = render(allDone);
assert.ok(view.map.children.at(-1).classList.contains('sel'), 'mantém a última missão selecionada quando a campanha está perfeita');
assert.match(view.info.innerHTML, /Campanha perfeita/);
assert.match(view.info.innerHTML, /Espiral do Eclipse/);
assert.match(view.info.innerHTML, /aria-valuemax="1" aria-valuenow="1"/, 'a barra continua cheia após o desbloqueio');
assert.match(view.info.innerHTML, /Desbloqueado · 3\/3 estrelas do capítulo/, 'as estrelas de domínio continuam visíveis separadamente');
assert.ok(!view.info.innerHTML.includes('camp-replay-button'));
view.map.children[9].onclick();
assert.ok(view.map.children[9].classList.contains('sel'), 'Ruínas Antigas continua selecionável após concluir a campanha');
assert.ok(view.info.innerHTML.includes('Equipe recomendada para 3 heróis: Paladino (cura), Piromante (dano em área) e Clériga (suporte/cura). Reforço recomendado: Guardião (proteção).'),
  'o resumo de Ruínas explica a composição de área e o reforço recomendado');
view.map.children[2].onclick();
assert.ok(view.map.children[2].classList.contains('sel'), 'O Santuário continua selecionável após concluir a campanha');
assert.ok(view.info.innerHTML.includes('Equipe recomendada para 2 heróis: Paladino (cura) e Guardião (proteção).'),
  'o resumo do Santuário não promete reforços numa missão de uma fase');
view.map.children[3].onclick();
assert.ok(view.map.children[3].classList.contains('sel'), 'Ponte em Chamas continua selecionável após concluir a campanha');
assert.ok(view.info.innerHTML.includes('Equipe recomendada para 2 heróis: Paladino (cura) e Viking (machado à distância).'),
  'o resumo da Ponte em Chamas mostra a dupla com melhor taxa de três estrelas');
view.map.children[11].onclick();
assert.ok(view.map.children[11].classList.contains('sel'), 'Lago Sombrio continua selecionável após concluir a campanha');
assert.ok(view.info.innerHTML.includes('Equipe recomendada para 4 heróis: Paladino (cura), Guardião (proteção), Piromante (dano em área) e Clériga (suporte/cura).'),
  'o resumo de Lago Sombrio orienta a composição que preserva a vida e busca três estrelas');

view = render({ vila: 2, fazendas: 3 });
assert.ok(view.map.children[1].classList.contains('sel'), 'a missão liberada seguinte é selecionada');
assert.match(view.info.innerHTML, /class="camp-chapter-label">Capítulo I · Sinais na estrada<\/div>/);
assert.match(view.info.innerHTML, /ARENA 02 · MAPA ALEATÓRIO/, 'o capítulo não substitui a arena e o bioma');
assert.match(view.info.innerHTML, /Estandarte da Vila/);
assert.match(view.info.innerHTML, /aria-valuemax="4" aria-valuenow="1"/, 'antes do desbloqueio, o progresso conta arenas com vitória');
assert.match(view.info.innerHTML, /1 de 4 arenas concluídas; faltam 3 arenas para desbloquear/, 'estrelas de outras arenas não compensam arenas sem vitória');

view = render({}, { equipped: 'vila' });
assert.equal(view.campaignCosmetics()[0].unlocked, false, 'equipamento legado sem estrelas não concede o visual');
assert.equal(view.equippedCampaignCosmetic(), null, 'um equipamento sem entitlement não fica ativo');
assert.deepEqual(JSON.parse(view.data.get('cavaleiros-campanha-visual')).legacyUnlocked, [], 'a migração não concede recompensas a saves sem estrelas');

view = render({ vila: 3, ponte: 3 }, { equipped: 'vila' });
assert.equal(view.campaignCosmetics()[0].unlocked, true, 'a migração preserva um visual já conquistado pela regra antiga');
assert.match(view.info.innerHTML, /aria-valuemax="4" aria-valuenow="2"/, 'o save legado mostra as arenas realmente concluídas mesmo com o visual já liberado');
assert.match(view.info.innerHTML, /desbloqueado, 2 de 4 arenas concluídas/, 'o rótulo acessível distingue desbloqueio e progresso incompleto legado');
const visualWritesAfterMigration = view.visualWriteCount();
view.campaignCosmetics();
view.campaignCosmetics();
view.equippedCampaignCosmetic();
assert.equal(view.visualWriteCount(), visualWritesAfterMigration, 'a migração v2 não grava de novo em chamadas seguintes');
assert.equal(view.equippedCampaignCosmetic().id, 'vila', 'o visual legado equipado continua ativo após chamadas repetidas');

console.log('OK: a campanha mantém a última missão destacada, exibe o progresso de capítulo e preserva a migração de visuais legados.');
