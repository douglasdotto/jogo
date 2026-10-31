// Medição de desempenho reprodutível: abra com ?bench=1 (só para teste; não conta recorde).
// Parâmetros: bench=segundos por trecho (1 = 15 s), fases=10,11,12 (um trecho por fase),
// inimigos=quantidade mantida viva (padrão 40), herois=paladin,crusher,pyro,crossbow,
// auto=heróis que usam habilidades automaticamente (ou all), graficos=baixa|alta, sombra=1024|2048.
// Mantém os heróis vivos (vida cheia) e repõe os inimigos para a carga ficar constante.
// Tempo em renderer.render mede envio de comandos pela CPU, não conclusão do trabalho da GPU.
// Resultado: console "BENCH {...}", window.__benchResult e um painel no canto da tela.

// gerador determinístico: as mesmas ondas a cada rodada
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const percentile = (list, p) => {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(sorted.length * p));
  return sorted[Math.min(sorted.length - 1, rank - 1)];
};
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function recordRafSample(state, timestamp, visibilityState) {
  state.rafFrames++;
  const visibility = visibilityState || 'unknown';
  state.visibilityFrameCounts[visibility] = (state.visibilityFrameCounts[visibility] || 0) + 1;
  const now = Number.isFinite(timestamp) ? timestamp : performance.now();
  if (state.lastRafTimestamp !== null) state.rafIntervals.push(now - state.lastRafTimestamp);
  state.lastRafTimestamp = now;
}

export async function runBench(api) {
  const original = {
    requestAnimationFrame: window.requestAnimationFrame,
    render: api.renderer.render,
    worldUpdate: api.world?.update,
    updateBars: api.updateBars,
    random: Math.random,
  };
  let originalLowQuality;
  let originalShadowSize;
  try {
    originalLowQuality = api.isLowQuality?.();
    originalShadowSize = api.getShadowMapSize?.();
    return await runBenchBody(api);
  } finally {
    try {
      if (typeof originalLowQuality === 'boolean' && api.isLowQuality?.() !== originalLowQuality) {
        document.getElementById('quality')?.click();
      }
    } finally {
      try {
        if (Number.isFinite(originalShadowSize) && api.getShadowMapSize?.() !== originalShadowSize) {
          api.setShadowMapSize?.(originalShadowSize);
        }
      } finally {
        window.requestAnimationFrame = original.requestAnimationFrame;
        api.renderer.render = original.render;
        if (typeof original.worldUpdate === 'function') api.world.update = original.worldUpdate;
        if (typeof original.updateBars === 'function') api.updateBars = original.updateBars;
        Math.random = original.random;
        api.game.paused = true;
      }
    }
  }
}

async function runBenchBody(api) {
  const q = new URLSearchParams(location.search);
  const secs = +q.get('bench') > 1 ? +q.get('bench') : 15;
  const phases = (q.get('fases') || q.get('fase') || '12').split(',').map(Number).filter(Boolean);
  const target = +q.get('inimigos') || 40;
  const ids = (q.get('herois') || 'paladin,crusher,pyro,crossbow').split(',');
  const overrideAuto = q.has('auto');
  const autoHeroes = new Set((q.get('auto') || '').split(',').filter(Boolean));
  const warm = 3;
  Math.random = seeded(12345);
  const { renderer, game, units, heroes, world } = api;
  const quality = q.get('graficos');
  if (quality && api.isLowQuality() !== (quality === 'baixa')) document.getElementById('quality').click();
  const shadowSize = Number(q.get('sombra'));
  if ([1024, 2048].includes(shadowSize)) api.setShadowMapSize(shadowSize);

  // monta a partida interna (fases 1–12, sem missão) sem passar pelos menus
  api.setupRun(phases[0]);
  for (const id of ids) {
    const cfg = api.VARIANTS.find((v) => v.id === id);
    if (!cfg) throw new Error(`bench: herói ${id} não existe`);
    const hero = api.addHero(cfg);
    if (overrideAuto) hero.autoSkills.fill(autoHeroes.has('all') || autoHeroes.has(id));
  }
  await new Promise((ready) => api.withBattleAssets(ready));
  api.beginBattle();

  const state = { phase: 'warmup', frames: [], keepTimes: [], callbackTimes: [], submits: [], worldUpdates: [], barsUpdates: [], calls: [], tris: [], units: [],
    rafIntervals: [], rafFrames: 0, lastRafTimestamp: null, visibilityStart: 'unknown', visibilityFrameCounts: {} };
  window.__benchState = 'warmup';
  window.__benchInspect = { scene: api.scene, renderer, units };
  // carga constante: heróis sempre de pé e o número de inimigos reposto a cada quadro
  const keep = () => {
    if (game.over || game.state !== 'fight') return;
    for (const h of heroes()) { if (h.dead) h.revive(); h.hp = h.maxHp; }
    game.toSpawn = 1000;   // a fase não termina e não chama o chefe (ele vem quando falta 1)
    game.spawnTimer = 1;   // o surgimento normal fica parado; a reposição abaixo controla a carga
    let alive = 0;
    for (const u of units) if (u.team === 'skeleton' && !u.dead) alive++;
    // Enche no aquecimento; limitar a dois por quadro deixava a carga medida variar
    // muito quando o navegador reduz requestAnimationFrame para 1–2 FPS.
    while (alive < target) { api.spawnSkeleton(); alive++; }
  };
  const frameFn = api.frame;
  const timeSection = (fn, samplesKey) => function (...args) {
    if (state.phase !== 'measure') return fn.apply(this, args);
    const start = performance.now();
    try { return fn.apply(this, args); }
    finally { state[samplesKey].push(performance.now() - start); }
  };
  if (typeof world?.update === 'function') world.update = timeSection(world.update, 'worldUpdates');
  if (typeof api.updateBars === 'function') api.updateBars = timeSection(api.updateBars, 'barsUpdates');
  const rAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => rAF((t) => {
    if (cb !== frameFn) return cb(t);
    const measuring = state.phase === 'measure';
    const callbackStart = measuring ? performance.now() : 0;
    if (measuring) recordRafSample(state, t, document.visibilityState);
    const keepStart = measuring ? performance.now() : 0;
    keep();
    const keepMs = measuring ? performance.now() - keepStart : 0;
    const t0 = performance.now();
    cb(t);
    const cpuMs = performance.now() - t0;
    if (!measuring || state.phase !== 'measure') return;
    state.frames.push(cpuMs);
    state.keepTimes.push(keepMs);
    state.calls.push(renderer.info.render.calls);
    state.tris.push(renderer.info.render.triangles);
    let n = 0;
    for (const u of units) if (!u.dead) n++;
    state.units.push(n);
    state.callbackTimes.push(performance.now() - callbackStart);
  });
  const render = renderer.render.bind(renderer);
  renderer.render = (s, c) => {
    const t0 = performance.now();
    render(s, c);
    if (state.phase === 'measure') state.submits.push(performance.now() - t0);
  };

  const segments = [];
  for (let i = 0; i < phases.length; i++) {
    if (i > 0) api.jumpToPhase(phases[i]);
    state.phase = 'warmup';
    window.__benchState = 'warmup';
    await wait(warm * 1000);
    Object.assign(state, { frames: [], keepTimes: [], callbackTimes: [], submits: [], worldUpdates: [], barsUpdates: [], calls: [], tris: [], units: [], rafIntervals: [], rafFrames: 0,
      lastRafTimestamp: null, visibilityFrameCounts: {}, visibilityStart: document.visibilityState || 'unknown' });
    state.phase = 'measure';
    window.__benchState = 'measure';
    const programsBefore = new Set(renderer.info.programs || []);
    const t0 = performance.now();
    await wait(secs * 1000);
    state.phase = 'idle';
    const wall = (performance.now() - t0) / 1000;
    const avg = (l) => l.reduce((a, b) => a + b, 0) / Math.max(1, l.length);
    const mem = renderer.info.memory;
    segments.push({
      fase: phases[i],
      fps: round(state.frames.length / wall, 1),
      framesMeasured: state.rafFrames,
      rafIntervalP50Ms: round(percentile(state.rafIntervals, 0.5)),
      rafIntervalP95Ms: round(percentile(state.rafIntervals, 0.95)),
      visibilityStart: state.visibilityStart,
      visibilityEnd: document.visibilityState || 'unknown',
      visibilityFrameCounts: { ...state.visibilityFrameCounts },
      cpuMs: round(avg(state.frames)), cpuP95: round(percentile(state.frames, 0.95)),
      keepMs: round(avg(state.keepTimes)), keepP95Ms: round(percentile(state.keepTimes, 0.95)),
      callbackMs: round(avg(state.callbackTimes)), callbackP95Ms: round(percentile(state.callbackTimes, 0.95)),
      renderSubmitMs: round(avg(state.submits)), renderSubmitP95: round(percentile(state.submits, 0.95)),
      worldUpdateP50Ms: round(percentile(state.worldUpdates, 0.5)), worldUpdateP95Ms: round(percentile(state.worldUpdates, 0.95)),
      barsUpdateP50Ms: round(percentile(state.barsUpdates, 0.5)), barsUpdateP95Ms: round(percentile(state.barsUpdates, 0.95)),
      calls: Math.round(avg(state.calls)), callsMax: Math.max(0, ...state.calls),
      tris: Math.round(avg(state.tris)),
      units: round(avg(state.units), 1),
      geometries: mem.geometries, textures: mem.textures, programs: renderer.info.programs?.length || 0,
      heapMB: performance.memory ? round(performance.memory.usedJSHeapSize / 1048576, 1) : null,
      sceneObjects: (() => { let n = 0; api.scene.traverse(() => n++); return n; })(),
      domNodes: document.getElementsByTagName('*').length,
      newPrograms: (renderer.info.programs || []).filter((p) => !programsBefore.has(p)).map((p) => p.name),   // shaders compilados durante a medição (travadas)
    });
  }
  window.requestAnimationFrame = rAF;
  const result = { heroes: ids, enemies: target, seconds: secs, lowQuality: api.isLowQuality(), shadowMapSize: api.getShadowMapSize(), pixelRatio: renderer.getPixelRatio(),
    size: `${innerWidth}x${innerHeight}`, segments };
  window.__benchResult = result;
  window.__benchState = 'done';
  console.log('BENCH ' + JSON.stringify(result));
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:#000c;color:#9f9;font:12px monospace;padding:8px;max-width:95vw;white-space:pre-wrap';
  box.textContent = segments.map((s) => `fase ${s.fase}: ${s.fps} fps · ${s.framesMeasured} quadros · rAF p50/p95 ${s.rafIntervalP50Ms}/${s.rafIntervalP95Ms} ms · vis ${s.visibilityStart}→${s.visibilityEnd} · callback ${s.callbackMs} ms (manutenção ${s.keepMs}; jogo ${s.cpuMs}) · mundo p50/p95 ${s.worldUpdateP50Ms}/${s.worldUpdateP95Ms} ms · barras p50/p95 ${s.barsUpdateP50Ms}/${s.barsUpdateP95Ms} ms · envio CPU ${s.renderSubmitMs} ms · ${s.calls} draws · ${s.tris} tris · ${s.units} unid · geo ${s.geometries} tex ${s.textures} · heap ${s.heapMB} MB`).join('\n');
  document.body.appendChild(box);
  return result;
}
