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

function render(stars) {
  const data = new Map([['cavaleiros-campanha', JSON.stringify(stars)]]);
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
    localStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) },
    addEventListener() {}, removeEventListener() {},
  });
  vm.runInContext(`${source}\nthis.renderCampaign = renderCampaign;`, context);
  context.renderCampaign(root, () => {});
  return { map, info, focusState, get replayButton() { return replayButton; }, get playButton() { return playButton; } };
}

const allDone = { vila: 3, ponte: 3, fazendas: 3, lago: 3, ruinas: 3, 'lago-sombrio': 3, cemiterio: 3, castelo: 3 };
const imperfect = { ...allDone, vila: 1, 'lago-sombrio': 2 };
let view = render(imperfect);
assert.ok(view.map.children.at(-1).classList.contains('sel'), 'mantém o castelo destacado quando a campanha foi concluída');
assert.match(view.info.innerHTML, /A Vila ainda pode render estrelas/);
assert.match(view.info.innerHTML, /3 estrelas restantes/);
view.replayButton.onclick();
assert.ok(view.map.children[0].classList.contains('sel'), 'a recomendação leva à primeira missão com estrelas faltando');
assert.match(view.info.innerHTML, /A Vila/);
assert.ok(!view.info.innerHTML.includes('camp-replay-button'), 'o atalho some quando a missão recomendada já está selecionada');
assert.equal(view.focusState.current, view.playButton, 'o foco vai para Batalhar após a seleção');

view = render({ ...allDone, ponte: 2 });
assert.ok(view.map.children.at(-1).classList.contains('sel'));
assert.match(view.info.innerHTML, /A Ponte do Rio ainda pode render estrelas/);
view.replayButton.onclick();
assert.ok(view.map.children[1].classList.contains('sel'), 'a recomendação ignora arenas perfeitas e abre a próxima que pode melhorar');

view = render(allDone);
assert.ok(view.map.children[7].classList.contains('sel'), 'mantém o castelo selecionado quando a campanha está perfeita');
assert.match(view.info.innerHTML, /Campanha perfeita/);
assert.ok(!view.info.innerHTML.includes('camp-replay-button'));

console.log('OK: a campanha mantém o castelo destacado e oferece um atalho para a missão com estrelas faltando.');
