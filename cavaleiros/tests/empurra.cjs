// node tests/empurra.cjs [detalhe] — mede o "empurra-empurra" em lutas de grupo com o combate real.
// Usa o mesmo carregador da simulação (heróis, esqueletos, IA e separate() reais) e conta, por quadro,
// quanto a separação desloca cada unidade, quem fica andando no lugar contra o alvo e sobreposições visíveis.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const simSource = fs.readFileSync(path.join(__dirname, 'simulacao.cjs'), 'utf8');
const harnessEnd = simSource.indexOf('// Um interceptor');
assert.ok(harnessEnd > 0, 'carregador da simulação precisa existir');
// eslint-disable-next-line no-new-func
const load = new Function('require', '__dirname', 'process', `${simSource.slice(0, harnessEnd)}\nreturn { t, vm, context };`);
const { t, vm, context } = load(require, __dirname, { argv: [] });
for (const v of vm.runInContext('VARIANTS', context)) v.built = { scene: { traverse() {}, getObjectByName: () => ({ add() {} }) }, animations: [] };
const showDetail = process.argv.includes('detalhe');

function useSeed(seed) {
  let state = seed >>> 0 || 1;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
  Math.random = random;
  vm.runInContext('Math', context).random = random;
}

const Skeleton = vm.runInContext('Skeleton', context);
const SEP = vm.runInContext('UNIT_COMBAT_SEPARATION_FACTOR', context);
const ALLY = vm.runInContext('UNIT_SEPARATION_FACTOR', context);

// Mede só durante o combate; devolve médias por unidade-quadro.
function measure({ party, diffId = 'normal', seconds = 70, seed = 7, horde = null }) {
  useSeed(seed);
  const diff = t.DIFFICULTIES.find((d) => d.id === diffId);
  t.setDifficulty(diff);
  t.startGame();
  t.confirmPick(1);
  t.confirmPick(t.DIFFICULTIES.indexOf(diff));
  t.setDifficulty(diff);
  let picked = 0;
  const dt = 1 / 30;
  const m = { frames: 0, unitFrames: 0, shift: 0, shifted: 0, still: 0, stillShifted: 0, pressing: 0, shoving: 0, shovers: {}, pushed: {}, melee: 0, overlap: 0, pairs: 0, maxCrowd: 0 };
  const before = new Map();
  let time = 0;
  while (!t.game.over && time < seconds) {
    if (t.pick.open) {
      if (t.pick.mode === 'hero') {
        const want = t.pick.options.findIndex((o) => o.id === party[picked]);
        picked++;
        const free = t.pick.options.map((_, i) => i).filter((i) => !t.heroes().some((h) => h.cfg.id === t.pick.options[i].id));
        t.confirmPick(free.includes(want) ? want : free[0]);
      } else t.confirmPick(0);
      continue;
    }
    if (horde && t.game.state === 'fight') {
      // cerco: a horda inteira chega de uma vez em volta do grupo (4 heróis contra 10–20 esqueletos)
      const center = t.heroes().reduce((c, h) => ({ x: c.x + h.pos.x / 4, z: c.z + h.pos.z / 4 }), { x: 0, z: 0 });
      horde.forEach(([type, boss], i) => {
        const s = new Skeleton(type, t.game.phase, boss);
        const angle = (i / horde.length) * Math.PI * 2 - Math.PI / 2;
        s.pos.set(center.x + Math.cos(angle) * 7, 0, center.z + Math.sin(angle) * 7);
        s.busy = 0;
      });
      horde = null;
    }
    t.setFrameTargetContext();
    for (const u of [...t.units]) u.update(dt);
    t.clearFrameTargetContext();
    const fighting = t.game.state === 'fight';
    const alive = t.units.filter((u) => !u.dead && !u.phasing && !u.structure && !u.totem);
    if (fighting) for (const u of alive) before.set(u, [u.pos.x, u.pos.z, u.vel.length(), u.moving]);
    if (!t.game.over) t.separate();
    if (fighting) {
      const skeletons = alive.filter((u) => u.team === 'skeleton').length;
      m.maxCrowd = Math.max(m.maxCrowd, skeletons);
      if (skeletons >= 3) {
        m.frames++;
        for (const u of alive) {
          const [x, z, speed, steering] = before.get(u);
          const s = Math.hypot(u.pos.x - x, u.pos.z - z);
          m.unitFrames++;
          m.shift += s;
          if (s > 0.01) m.shifted++;
          const walking = speed >= 0.25;   // locomote() ligou a animação de andar neste quadro
          if (!walking) { m.still++; if (s > 0.01) { m.stillShifted++; const k = u.team === 'skeleton' ? u.enemyKind : u.cfg?.id ?? u.team; m.pushed[k] = (m.pushed[k] || 0) + 1; } }
          if (!u.ranged) {
            m.melee++;
            // anda (animação ligada) mas a separação devolve boa parte do passo: andando no lugar contra alguém
            if (walking && s > 0.5 * speed * dt) m.pressing++;
            // encostado num adversário, fora de golpe, mas ainda andando para dentro dele
            if (steering && alive.some((o) => o.team !== u.team && (o.team === 'skeleton') !== (u.team === 'skeleton')
              && Math.abs(o.pos.y - u.pos.y) < 0.85 && Math.hypot(o.pos.x - u.pos.x, o.pos.z - u.pos.z) < SEP * (o.size + u.size) + 0.05)) {
              m.shoving++;
              const k = u.team === 'skeleton' ? u.enemyKind : u.cfg.id;
              m.shovers[k] = (m.shovers[k] || 0) + 1;
            }
          }
        }
        for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
          const a = alive[i], b = alive[j];
          if (Math.abs(a.pos.y - b.pos.y) >= 0.85) continue;
          const same = (a.team === 'skeleton') === (b.team === 'skeleton');
          const min = (same ? ALLY : SEP) * (a.size + b.size);
          const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
          if (d < min * 1.2) { m.pairs++; if (d < min * 0.9) m.overlap++; }
        }
      }
    }
    t.updateBolts(dt);
    t.updateEnemyBolts(dt);
    t.updateGame(dt);
    t.showEvolution();
    time += dt;
  }
  return {
    party: party.join('+'), phase: t.game.phase, frames: m.frames, maxCrowd: m.maxCrowd,
    shiftMm: (m.shift / Math.max(1, m.unitFrames)) * 1000,          // deslocamento médio por unidade por quadro (mm)
    shiftedPct: (m.shifted / Math.max(1, m.unitFrames)) * 100,      // % unidade-quadros empurrados > 1 cm
    stillShiftedPct: (m.stillShifted / Math.max(1, m.still)) * 100, // % das paradas que foram empurradas > 1 cm
    pressingPct: (m.pressing / Math.max(1, m.melee)) * 100,         // % corpo a corpo andando no lugar
    shovingPct: (m.shoving / Math.max(1, m.melee)) * 100,           // % corpo a corpo encostado no inimigo e ainda andando
    pushed: Object.entries(m.pushed).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k}:${n}`).join(' '),
    shovers: Object.entries(m.shovers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k}:${n}`).join(' '),
    overlapPct: (m.overlap / Math.max(1, m.pairs)) * 100,           // % pares em contato visivelmente sobrepostos
  };
}

const scenarios = [
  { party: ['paladin', 'guardian', 'pyro', 'cleric'], seed: 7 },
  { party: ['champion', 'berserker', 'assassin', 'duelist'], seed: 11 },
  { party: ['paladin', 'guardian', 'viking', 'cleric'], diffId: 'pesadelo', seconds: 90, seed: 3 },
  { party: ['paladin', 'guardian', 'champion', 'cleric'], seconds: 25, seed: 5,
    horde: [...Array(14)].map((_, i) => [['Minion', 'Warrior', 'Rogue', 'Shieldbearer', 'DarkKnight'][i % 5], false]).concat([['Golem', false]]) },
  { party: ['champion', 'berserker', 'assassin', 'paladin'], seconds: 25, seed: 9,
    horde: [...Array(18)].map((_, i) => [['Minion', 'Rogue', 'Warrior'][i % 3], false]).concat([['King', true]]) },
];
const results = scenarios.map(measure);
const fmt = (r) => `${r.party.padEnd(34)} fase ${r.phase} · quadros ${r.frames} · até ${r.maxCrowd} esq. · `
  + `separação ${r.shiftMm.toFixed(1)} mm/quadro · empurrados ${r.shiftedPct.toFixed(1)}% · parados empurrados ${r.stillShiftedPct.toFixed(1)}% (${r.pushed}) · `
  + `andando no lugar ${r.pressingPct.toFixed(1)}% · empurrando o alvo ${r.shovingPct.toFixed(1)}% (${r.shovers}) · sobrepostos ${r.overlapPct.toFixed(1)}%`;
if (showDetail) for (const r of results) console.log(fmt(r));
// Antes da correção os cercos davam 9,5% e 7,2% de corpo a corpo encostado e ainda andando contra o adversário
// (lacaio, ladino, golem: alcance menor que o próprio corpo) e 14% das unidades paradas sendo empurradas.
for (const r of results) {
  assert.ok(r.frames > 100, `cenário precisa ter luta (${r.party})`);
  assert.ok(r.shovingPct < 3, `corpo a corpo não fica andando contra o alvo (${fmt(r)})`);
  assert.ok(r.stillShiftedPct < 8, `quem está parado quase não é empurrado (${fmt(r)})`);
  assert.ok(r.overlapPct < 1, `sem sobreposição visível (${fmt(r)})`);
}
console.log('OK: lutas em grupo sem empurra-empurra (corpo a corpo para no contato, plantado não é empurrado)');
