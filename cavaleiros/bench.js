// Medição de desempenho reprodutível: abra com ?bench=1 (só para teste; não conta recorde).
// Parâmetros: bench=segundos por trecho (1 = 15 s), fases=10,11,12 (um trecho por fase),
// inimigos=quantidade mantida viva (padrão 40), herois=paladin,crusher,pyro,crossbow, graficos=baixa|alta.
// Mantém os heróis vivos (vida cheia) e repõe os inimigos para a carga ficar constante.
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
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runBench(api) {
  const q = new URLSearchParams(location.search);
  const secs = +q.get('bench') > 1 ? +q.get('bench') : 15;
  const phases = (q.get('fases') || q.get('fase') || '12').split(',').map(Number).filter(Boolean);
  const target = +q.get('inimigos') || 40;
  const ids = (q.get('herois') || 'paladin,crusher,pyro,crossbow').split(',');
  const warm = 3;
  Math.random = seeded(12345);
  const { renderer, game, units, heroes, world } = api;
  const quality = q.get('graficos');
  if (quality && api.isLowQuality() !== (quality === 'baixa')) document.getElementById('quality').click();

  // monta a jornada sem passar pelos menus
  api.setupJourney(phases[0]);
  for (const id of ids) {
    const cfg = api.VARIANTS.find((v) => v.id === id);
    if (!cfg) throw new Error(`bench: herói ${id} não existe`);
    api.addHero(cfg);
  }
  await new Promise((ready) => api.withBattleAssets(ready));
  api.beginBattle();

  const state = { phase: 'warmup', frames: [], renders: [], calls: [], tris: [], units: [] };
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
    for (let k = 0; alive < target && k < 2; k++, alive++) api.spawnSkeleton();
  };
  const frameFn = api.frame;
  const rAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => rAF((t) => {
    if (cb !== frameFn) return cb(t);
    keep();
    const t0 = performance.now();
    cb(t);
    if (state.phase !== 'measure') return;
    state.frames.push(performance.now() - t0);
    state.calls.push(renderer.info.render.calls);
    state.tris.push(renderer.info.render.triangles);
    let n = 0;
    for (const u of units) if (!u.dead) n++;
    state.units.push(n);
  });
  const render = renderer.render.bind(renderer);
  renderer.render = (s, c) => {
    const t0 = performance.now();
    render(s, c);
    if (state.phase === 'measure') state.renders.push(performance.now() - t0);
  };

  const segments = [];
  for (let i = 0; i < phases.length; i++) {
    if (i > 0) api.jumpToPhase(phases[i]);
    state.phase = 'warmup';
    window.__benchState = 'warmup';
    await wait(warm * 1000);
    Object.assign(state, { frames: [], renders: [], calls: [], tris: [], units: [] });
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
      cpuMs: round(avg(state.frames)), cpuP95: round(percentile(state.frames, 0.95)),
      renderMs: round(avg(state.renders)), renderP95: round(percentile(state.renders, 0.95)),
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
  const result = { heroes: ids, enemies: target, seconds: secs, lowQuality: api.isLowQuality(), pixelRatio: renderer.getPixelRatio(),
    size: `${innerWidth}x${innerHeight}`, segments };
  window.__benchResult = result;
  window.__benchState = 'done';
  console.log('BENCH ' + JSON.stringify(result));
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:#000c;color:#9f9;font:12px monospace;padding:8px;max-width:95vw;white-space:pre-wrap';
  box.textContent = segments.map((s) => `fase ${s.fase}: ${s.fps} fps · CPU ${s.cpuMs} ms (p95 ${s.cpuP95}) · render ${s.renderMs} ms · ${s.calls} draws · ${s.tris} tris · ${s.units} unid · geo ${s.geometries} tex ${s.textures} · heap ${s.heapMB} MB`).join('\n');
  document.body.appendChild(box);
  return result;
}
