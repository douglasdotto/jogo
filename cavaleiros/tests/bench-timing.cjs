// node tests/bench-timing.cjs — testa a coleta integrada e a restauração do benchmark.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'bench.js'), 'utf8').replace(/^export /gm, '');

function makeHarness(search, { failOnJump = false } = {}) {
  const rafQueue = [];
  let rafTimestamp = 0;
  let elapsedMs = 0;
  let perfCalls = 0;
  let lowQuality = false;
  let shadowSize = 1024;
  let renderCalls = 0;
  const originalRaf = (callback) => { rafQueue.push(callback); return rafQueue.length; };
  const originalRender = function () { renderCalls++; this.info.render.calls++; };
  const game = { paused: true, state: 'menu', over: false };
  const units = [];
  const document = {
    visibilityState: 'visible',
    getElementById(id) { return id === 'quality' ? { click() { lowQuality = !lowQuality; } } : null; },
    createElement() { return { style: {}, textContent: '' }; },
    getElementsByTagName() { return { length: 1 }; },
    body: { appendChild() {} },
  };
  const window = { requestAnimationFrame: originalRaf };
  const renderer = {
    render: originalRender,
    info: { render: { calls: 0, triangles: 12 }, memory: { geometries: 4, textures: 2 }, programs: [] },
    getPixelRatio() { return 1; },
  };
  const api = {
    renderer, game, units, world: {}, scene: { traverse(callback) { callback({}); } },
    VARIANTS: [{ id: 'paladin' }],
    heroes() { return []; },
    setupJourney() {},
    addHero() { return { autoSkills: [false, false, false] }; },
    withBattleAssets(ready) { ready(); },
    beginBattle() { game.paused = false; game.state = 'fight'; },
    jumpToPhase() { if (failOnJump) throw new Error('falha ao avançar fase'); },
    spawnSkeleton() { units.push({ team: 'skeleton', dead: false }); },
    isLowQuality() { return lowQuality; },
    getShadowMapSize() { return shadowSize; },
    setShadowMapSize(size) { shadowSize = size; },
    frame() {
      renderer.render({}, {});
      window.requestAnimationFrame(api.frame);
    },
  };

  const context = vm.createContext({
    window, document, api, location: { search }, URLSearchParams,
    performance: {
      now() { return elapsedMs + (++perfCalls * 0.01); },
    },
    setTimeout(resolve, ms) {
      elapsedMs += ms;
      if (!rafQueue.length) window.requestAnimationFrame(api.frame);
      for (let i = 0; i < 3 && rafQueue.length; i++) {
        rafTimestamp += 16;
        document.visibilityState = rafTimestamp >= 80 ? 'hidden' : 'visible';
        rafQueue.shift()(rafTimestamp);
      }
      resolve();
      return 1;
    },
    innerWidth: 1280, innerHeight: 720,
    console: { log() {} },
  });
  vm.runInContext(source, context);
  return {
    context, api, renderer, window, document, game, originalRaf, originalRender,
    get lowQuality() { return lowQuality; },
    get shadowSize() { return shadowSize; },
    get renderCalls() { return renderCalls; },
  };
}

async function main() {
  const success = makeHarness('?bench=2&herois=paladin&graficos=baixa&sombra=2048');
  vm.runInContext('this.originalRandom = Math.random', success.context);
  const result = await vm.runInContext('runBench(api)', success.context);
  const segment = result.segments[0];

  assert.equal(segment.framesMeasured, 3, 'conta os callbacks rAF realmente medidos');
  assert.equal(segment.rafIntervalP50Ms, 16, 'calcula p50 dos timestamps reais do rAF');
  assert.equal(segment.rafIntervalP95Ms, 16, 'calcula p95 dos timestamps reais do rAF');
  assert.deepEqual({ ...segment.visibilityFrameCounts }, { visible: 1, hidden: 2 }, 'registra a visibilidade vista em cada callback');
  assert.equal(segment.visibilityStart, 'visible');
  assert.equal(segment.visibilityEnd, 'hidden');
  assert.ok(segment.renderSubmitMs > 0, 'mede o tempo de renderer.render');
  assert.ok(segment.keepMs > 0, 'mede separadamente a manutenção da carga do benchmark');
  assert.ok(segment.cpuMs > 0, 'mede o callback do jogo sem a manutenção');
  assert.ok(segment.callbackMs >= segment.keepMs + segment.cpuMs, 'tempo total inclui manutenção e callback do jogo');
  assert.equal(success.renderCalls, 6, 'o mock renderiza nos quadros de aquecimento e medição');
  assert.equal(result.lowQuality, true, 'resultado informa a qualidade usada na medição');
  assert.equal(result.shadowMapSize, 2048, 'resultado informa o mapa de sombras usado na medição');
  assert.equal(success.lowQuality, false, 'restaura a qualidade original após sucesso');
  assert.equal(success.shadowSize, 1024, 'restaura o tamanho original das sombras após sucesso');
  assert.equal(success.window.requestAnimationFrame, success.originalRaf, 'restaura requestAnimationFrame após sucesso');
  assert.equal(success.renderer.render, success.originalRender, 'restaura renderer.render após sucesso');
  assert.equal(vm.runInContext('Math.random === originalRandom', success.context), true, 'restaura Math.random após sucesso');
  assert.equal(success.game.paused, true, 'encerra o benchmark com a partida pausada');

  const failure = makeHarness('?bench=2&herois=paladin&fases=12,11&graficos=baixa&sombra=2048', { failOnJump: true });
  vm.runInContext('this.originalRandom = Math.random', failure.context);
  await assert.rejects(vm.runInContext('runBench(api)', failure.context), /falha ao avançar fase/);
  assert.equal(failure.lowQuality, false, 'restaura qualidade original após erro depois da medição');
  assert.equal(failure.shadowSize, 1024, 'restaura sombras originais após erro depois da medição');
  assert.equal(failure.window.requestAnimationFrame, failure.originalRaf, 'restaura RAF após erro depois da instrumentação');
  assert.equal(failure.renderer.render, failure.originalRender, 'restaura render após erro depois da instrumentação');
  assert.equal(vm.runInContext('Math.random === originalRandom', failure.context), true, 'restaura Math.random após erro');
  assert.equal(failure.game.paused, true, 'pausa a partida após erro');

  console.log('OK: métricas integradas do benchmark e restauração de configurações/hooks em sucesso e erro.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
