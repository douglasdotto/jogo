// Progressão entre partidas: ouro, maestria por herói, oficina do acampamento e conquistas.
// Tudo fica num único save versionado no localStorage; sem storage (simulações), vive só na memória e começa zerado.
// Os bônus são pequenos de propósito: maestria soma no máximo +4% de vida e +4% de dano, a oficina +6% de vida e até 2 milicianos fracos.

export const PROGRESS_KEY = 'cavaleiros-progresso';
export const PROGRESS_VERSION = 2;
export const GOLD = { name: 'Ouro', icon: '◆' };

// XP de maestria acumulado para chegar a cada nível (Nv1 começa em 0)
export const MASTERY_XP = [0, 60, 180, 400, 800];
export const MASTERY_MAX = MASTERY_XP.length;
// o que cada nível acrescenta; o nível 1 não dá nada
export const MASTERY_PERKS = [
  null,
  { hp: 0.02, text: '+2% de vida' },
  { dmg: 0.02, frame: 'prata', text: '+2% de dano · moldura de prata' },
  { hp: 0.02, text: '+2% de vida' },
  { dmg: 0.02, frame: 'ouro', aura: true, text: '+2% de dano · moldura e aura douradas' },
];
export const DIFFICULTY_REWARD = { facil: 0.8, normal: 1, dificil: 1.25, pesadelo: 1.5 };

// melhorias globais do acampamento: custos crescentes e teto em `costs.length`
export const UPGRADES = [
  { id: 'vigor', name: 'Treino de vigor', icon: '♥', per: 0.02, costs: [80, 170, 300],
    desc: (n) => `Heróis entram em campo com +${n * 2}% de vida máxima.` },
  { id: 'reroll', name: 'Dados do mascate', icon: '↻', per: 1, costs: [150, 320],
    desc: (n) => `Troque as relíquias oferecidas ${n} ${n === 1 ? 'vez' : 'vezes'} por partida.` },
  { id: 'relic-choice', name: 'Mapa do tesouro', icon: '✦', per: 1, costs: [400],
    desc: (n) => `Cada baú de relíquias mostra ${3 + n} opções.` },
  { id: 'bounty', name: 'Bolsa de saque', icon: '◆', per: 0.08, costs: [100, 220, 380],
    desc: (n) => `+${n * 8}% de ouro ao fim de cada partida.` },
  { id: 'mentor', name: 'Mentor do acampamento', icon: '✎', per: 0.15, costs: [120, 260],
    desc: (n) => `+${n * 15}% de XP de maestria por partida.` },
];
const findUpgrade = (id) => UPGRADES.find((u) => u.id === id);

const clearedPhase = (run, p) => run.start <= p && (run.phase > p || (run.won && run.last >= p));
// test(state, run): run é a partida recém-terminada ou null (compra na oficina, abertura do acampamento)
export const ACHIEVEMENTS = [
  { id: 'primeira-vitoria', icon: '⚑', name: 'Primeira vitória', desc: 'Vença uma missão ou a Jornada.', test: (s) => s.counters.wins >= 1 },
  { id: 'cacador', icon: '⚔', name: 'Caçador de ossos', desc: 'Derrote 500 esqueletos no total.', goal: 500, count: (s) => s.counters.kills },
  { id: 'ossario', icon: '☠', name: 'Ossário', desc: 'Derrote 2000 esqueletos no total.', goal: 2000, count: (s) => s.counters.kills },
  { id: 'ultimates', icon: '☼', name: 'Poder supremo', desc: 'Use 50 ultimates.', goal: 50, count: (s) => s.counters.ultimates },
  { id: 'regicida', icon: '♚', name: 'Regicida', desc: 'Derrote o Rei Esqueleto da fase 6.', test: (s, r) => !!r && clearedPhase(r, 6) },
  { id: 'lich', icon: '♛', name: 'Fim do Lich', desc: 'Derrote o Lich da fase 12.', test: (s, r) => !!r && r.won && r.last === 12 },
  { id: 'lich-pesadelo', icon: '☠', name: 'Pesadelo do Lich', desc: 'Derrote o Lich no Pesadelo.', test: (s, r) => !!r && r.won && r.last === 12 && r.difficultyId === 'pesadelo' },
  { id: 'muralha', icon: '⛨', name: 'Muralha intacta', desc: 'Vença uma missão com 4 heróis sem nenhuma queda.', test: (s, r) => !!r && r.won && r.mode === 'mission' && r.partySize >= 4 && r.falls === 0 },
  { id: 'perfeito', icon: '★', name: 'Perfeccionista', desc: 'Ganhe 3 estrelas numa missão.', test: (s, r) => !!r && r.stars >= 3 },
  { id: 'constelacao', icon: '✶', name: 'Constelação', desc: 'Junte 30 estrelas na campanha.', goal: 30, count: (s) => s.counters.bestStars },
  { id: 'alem-do-castelo', icon: '♔', name: 'Além do Castelo', desc: 'Vença o Trono de Ossos.', test: (s, r) => !!r && r.won && r.mode === 'mission' && r.missionId === 'trono' },
  { id: 'coracao-sombrio', icon: '☼', name: 'Fim da maldição', desc: 'Vença os três guardiões no Coração do Castelo.', test: (s, r) => !!r && r.won && r.mode === 'mission' && r.missionId === 'coracao-do-castelo' },
  { id: 'duelista', icon: '⚔', name: 'Duelista', desc: 'Vença o Duelo contra o Rei.', test: (s, r) => !!r && r.won && r.mode === 'mission' && r.missionId === 'duelo' },
  { id: 'jornada', icon: '♜', name: 'Até o castelo', desc: 'Vença a Jornada completa.', test: (s, r) => !!r && r.won && r.mode === 'journey' },
  { id: 'veterano', icon: '⚒', name: 'Veterano', desc: 'Vença a Jornada no Difícil ou no Pesadelo.', test: (s, r) => !!r && r.won && r.mode === 'journey' && (r.difficultyId === 'dificil' || r.difficultyId === 'pesadelo') },
  { id: 'elenco', icon: '♣', name: 'Elenco variado', desc: 'Jogue partidas com 10 heróis diferentes.', goal: 10, count: (s) => Object.values(s.heroes).filter((h) => h.games > 0).length },
  { id: 'mestre', icon: '✦', name: 'Mestre de armas', desc: `Leve um herói à maestria ${MASTERY_MAX}.`, test: (s) => Object.values(s.heroes).some((h) => h.xp >= MASTERY_XP[MASTERY_MAX - 1]) },
  { id: 'colecionador', icon: '⚱', name: 'Colecionador', desc: 'Escolha 30 relíquias.', goal: 30, count: (s) => s.counters.relics },
  { id: 'oficina', icon: '⚙', name: 'Mão na massa', desc: 'Compre 5 melhorias na oficina.', goal: 5, count: (s) => Object.values(s.upgrades).reduce((a, b) => a + b, 0) },
  { id: 'cofre', icon: '◆', name: 'Cofre cheio', desc: 'Ganhe 1000 de ouro no total.', goal: 1000, count: (s) => s.earned },
];
const achievementReached = (a, s, r) => (a.count ? a.count(s) >= a.goal : a.test(s, r));

const PROGRESS_COUNTERS = ['kills', 'ultimates', 'wins', 'matches', 'relics', 'bestStars'];
const toCount = (v, max = 1e9) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
const asObject = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};

export function freshProgress() {
  return { version: PROGRESS_VERSION, gold: 0, earned: 0, upgrades: {}, heroes: {}, achievements: {},
    counters: Object.fromEntries(PROGRESS_COUNTERS.map((k) => [k, 0])) };
}

// Saves antigos sobem de versão um passo por vez.
// v1 (sem campo version ou version 1): nomes em português e XP de herói como número solto.
export const MIGRATIONS = {
  1: (old) => ({
    version: 2,
    gold: old.ouro ?? old.gold,
    earned: old.ganho ?? old.ouro ?? 0,
    upgrades: old.oficina ?? old.upgrades,
    heroes: Object.fromEntries(Object.entries(asObject(old.maestria)).map(([id, xp]) => [id, { xp, games: xp > 0 ? 1 : 0 }])),
    achievements: Object.fromEntries((Array.isArray(old.conquistas) ? old.conquistas : []).map((id) => [id, 1])),
    counters: asObject(old.contadores),
  }),
};

export function migrateProgress(raw) {
  let data = asObject(raw);
  let version = Number.isInteger(data.version) ? data.version : 1;
  while (version < PROGRESS_VERSION && MIGRATIONS[version]) { data = asObject(MIGRATIONS[version](data)); version = data.version; }
  return sanitizeProgress(data);
}

// cada campo é conferido: lixo vira zero, ids desconhecidos somem, níveis respeitam o teto
function sanitizeProgress(data) {
  const clean = freshProgress();
  clean.gold = toCount(data.gold);
  clean.earned = Math.max(toCount(data.earned), clean.gold);
  for (const [id, lvl] of Object.entries(asObject(data.upgrades))) {
    const u = findUpgrade(id);
    if (u && toCount(lvl)) clean.upgrades[id] = Math.min(toCount(lvl), u.costs.length);
  }
  for (const [id, h] of Object.entries(asObject(data.heroes))) {
    const xp = toCount(asObject(h).xp), games = toCount(asObject(h).games);
    if (/^[a-z0-9-]{1,40}$/.test(id) && (xp || games)) clean.heroes[id] = { xp, games };
  }
  for (const [id, at] of Object.entries(asObject(data.achievements))) if (ACHIEVEMENTS.some((a) => a.id === id)) clean.achievements[id] = toCount(at) || 1;
  const counters = asObject(data.counters);
  for (const k of PROGRESS_COUNTERS) clean.counters[k] = toCount(counters[k]);
  return clean;
}

export function masteryLevel(xp) {
  let level = 1;
  while (level < MASTERY_MAX && xp >= MASTERY_XP[level]) level++;
  return level;
}

// Ouro: abates, fases vencidas, estrelas e vitória, multiplicados por dificuldade e pela Bolsa de saque.
export function goldFor(run, bountyLevel = 0) {
  const lines = [
    ['Abates', toCount(run.kills)],
    ['Fases vencidas', toCount(run.phasesCleared) * 6],
    ['Estrelas', toCount(run.stars) * 10],
    ['Vitória', run.won ? (run.mode === 'journey' ? 60 : 20) : 0],
  ].filter(([, v]) => v > 0);
  const base = lines.reduce((s, [, v]) => s + v, 0);
  const mult = (DIFFICULTY_REWARD[run.difficultyId] ?? 1) * (1 + bountyLevel * findUpgrade('bounty').per);
  return { total: Math.round(base * mult), base, mult, lines };
}

// XP de maestria de um herói na partida: presença, fases, abates (com teto) e vitória
export function masteryXpFor(run, hero, mentorLevel = 0) {
  const base = 10 + toCount(run.phasesCleared) * 4 + Math.min(30, Math.floor(toCount(hero?.kills) / 2)) + (run.won ? 15 : 0);
  return Math.round(base * (DIFFICULTY_REWARD[run.difficultyId] ?? 1) * (1 + mentorLevel * findUpgrade('mentor').per));
}

// storage: localStorage ou null (memória). Nada aqui lança erro por causa do storage.
export function createProgression(storage = null) {
  let state = freshProgress();
  let corrupted = false;
  let corruptBackupFailed = false;
  let persistenceUnavailable = !storage;
  let baseKnown = !storage;
  let corruptRaw = null;
  const pendingOperations = [];
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const preserveCorruptBackup = (raw) => {
    const backup = String(raw).slice(0, 20000), base = `${PROGRESS_KEY}-corrompido`;
    for (let suffix = 0; suffix <= 999; suffix++) {
      const key = suffix ? `${base}-${suffix}` : base;
      const existing = storage.getItem(key);
      if (existing === backup) return true;
      if (existing == null) { storage.setItem(key, backup); return true; }
    }
    throw new Error('muitos backups de meta-progressão');
  };
  const loadRaw = (raw) => {
    if (raw == null) return freshProgress();
    try { return migrateProgress(JSON.parse(raw)); }
    catch {
      corrupted = true;
      corruptRaw = String(raw);
      try { preserveCorruptBackup(corruptRaw); corruptBackupFailed = false; }
      catch { corruptBackupFailed = true; }
      return freshProgress();
    }
  };
  if (storage) {
    try {
      state = loadRaw(storage.getItem(PROGRESS_KEY));
      baseKnown = true;
      persistenceUnavailable = false;
    } catch {
      baseKnown = false;
      persistenceUnavailable = true; // não grave até confirmar o save que não conseguiu ler
    }
  }

  const level = (id) => state.upgrades[id] || 0;
  const unlockNewIn = (target, run) => {
    const fresh = ACHIEVEMENTS.filter((a) => !target.achievements[a.id] && achievementReached(a, target, run));
    for (const a of fresh) target.achievements[a.id] = Date.now();
    return fresh.map(({ id, icon, name, desc }) => ({ id, icon, name, desc }));
  };
  const unlockNew = (run) => unlockNewIn(state, run);
  const applyRecordMatch = (target, run) => {
    const gold = goldFor(run, target.upgrades.bounty || 0);
    target.gold += gold.total;
    target.earned += gold.total;
    const c = target.counters;
    c.matches++;
    c.kills += toCount(run.kills);
    c.ultimates += toCount(run.ultimates);
    c.relics += toCount(run.relics);
    if (run.won) c.wins++;
    c.bestStars = Math.max(c.bestStars, toCount(run.totalStars));
    const seen = new Set();
    const heroes = (run.heroes || []).filter((h) => h?.id && !seen.has(h.id) && seen.add(h.id)).map((h) => {
      const entry = target.heroes[h.id] ||= { xp: 0, games: 0 };
      const before = masteryLevel(entry.xp), gained = masteryXpFor(run, h, target.upgrades.mentor || 0);
      entry.xp += gained;
      entry.games++;
      return { id: h.id, gained, before, after: masteryLevel(entry.xp), xp: entry.xp };
    });
    const unlocked = unlockNewIn(target, run);
    return { gold, heroes, unlocked, total: target.gold };
  };
  const replayOperation = (target, operation) => {
    if (operation.type === 'match') return applyRecordMatch(target, operation.run);
    if (operation.type === 'buy') {
      const upgrade = findUpgrade(operation.id), current = target.upgrades[operation.id] || 0;
      if (!upgrade || current >= upgrade.costs.length) return false;
      const cost = upgrade.costs[current];
      if (target.gold < cost) return false;
      target.gold -= cost;
      target.upgrades[operation.id] = current + 1;
      unlockNewIn(target, null);
      return true;
    }
    if (operation.type === 'refresh') {
      target.counters.bestStars = Math.max(target.counters.bestStars, toCount(operation.totalStars));
      unlockNewIn(target, null);
      return true;
    }
    return false;
  };
  const recoverUnreadBase = () => {
    let raw;
    try { raw = storage.getItem(PROGRESS_KEY); }
    catch { persistenceUnavailable = true; return false; }
    let recovered = loadRaw(raw);
    for (const operation of pendingOperations) {
      if (replayOperation(recovered, operation) === false) {
        persistenceUnavailable = true;
        return false; // não aplique um diário incompatível ao save original
      }
    }
    state = recovered;
    pendingOperations.length = 0;
    baseKnown = true;
    return true;
  };
  const prepareForMutation = () => baseKnown || recoverUnreadBase();
  const save = () => {
    if (!storage) { persistenceUnavailable = true; pendingOperations.length = 0; return false; }
    if (!baseKnown) { persistenceUnavailable = true; return false; }
    if (corruptBackupFailed) {
      try { preserveCorruptBackup(corruptRaw); corruptBackupFailed = false; }
      catch { persistenceUnavailable = true; return false; }
    }
    try {
      storage.setItem(PROGRESS_KEY, JSON.stringify(state));
      persistenceUnavailable = false;
      pendingOperations.length = 0;
      baseKnown = true;
      return true;
    } catch { persistenceUnavailable = true; return false; }
  };

  const api = {
    get corrupted() { return corrupted; },
    get corruptBackupFailed() { return corruptBackupFailed; },
    get persistenceUnavailable() { return persistenceUnavailable; },
    get gold() { return state.gold; },
    snapshot: () => JSON.parse(JSON.stringify(state)),
    upgradeLevel: level,
    upgradeCost(id) { const u = findUpgrade(id); return u && level(id) < u.costs.length ? u.costs[level(id)] : null; },
    buy(id) {
      prepareForMutation();
      const cost = api.upgradeCost(id);
      if (cost == null) return { ok: false, reason: 'max' };
      if (state.gold < cost) return { ok: false, reason: 'gold' };
      state.gold -= cost;
      state.upgrades[id] = level(id) + 1;
      const unlocked = unlockNew(null);
      pendingOperations.push({ type: 'buy', id });
      save();
      return { ok: true, level: state.upgrades[id], unlocked };
    },
    relicChoices: () => 3 + level('relic-choice'),
    rerolls: () => level('reroll'),
    mastery(id) {
      const xp = state.heroes[id]?.xp || 0, lvl = masteryLevel(xp);
      return { level: lvl, xp, from: MASTERY_XP[lvl - 1], next: lvl < MASTERY_MAX ? MASTERY_XP[lvl] : null, games: state.heroes[id]?.games || 0 };
    },
    // bônus que o herói leva para a batalha: maestria dele + vigor da oficina
    heroBonus(id) {
      const lvl = api.mastery(id).level, bonus = { hp: level('vigor') * findUpgrade('vigor').per, dmg: 0, aura: false, frame: null, level: lvl };
      for (const perk of MASTERY_PERKS.slice(1, lvl)) {
        bonus.hp += perk.hp || 0;
        bonus.dmg += perk.dmg || 0;
        bonus.aura ||= !!perk.aura;
        bonus.frame = perk.frame || bonus.frame;
      }
      return bonus;
    },
    achievements: () => ACHIEVEMENTS.map((a) => ({ id: a.id, icon: a.icon, name: a.name, desc: a.desc, unlocked: !!state.achievements[a.id],
      progress: a.count ? Math.min(a.goal, a.count(state)) : null, goal: a.goal ?? null })),
    // fim de partida: credita ouro, XP de maestria, contadores e devolve o que mudou
    recordMatch(run) {
      prepareForMutation();
      const savedRun = copy(run);
      const result = applyRecordMatch(state, savedRun);
      pendingOperations.push({ type: 'match', run: savedRun });
      save();
      result.total = state.gold;
      return result;
    },
    // conquistas que dependem só do estado (ex.: estrelas antigas) ao abrir o acampamento
    refresh(totalStars = 0) {
      prepareForMutation();
      const previousStars = state.counters.bestStars;
      state.counters.bestStars = Math.max(state.counters.bestStars, toCount(totalStars));
      const unlocked = unlockNew(null);
      if (unlocked.length || state.counters.bestStars > previousStars) {
        pendingOperations.push({ type: 'refresh', totalStars });
        save();
      }
      return unlocked;
    },
  };
  return api;
}

// ---------- interface: acampamento, recompensa no fim e avisos ----------
const escapeProgressText = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Aviso flutuante de conquista; vários aparecem em fila.
export function toastAchievements(list, doc = globalThis.document) {
  if (!list?.length || !doc?.body) return;
  let box = doc.getElementById('achToasts');
  if (!box) {
    box = doc.createElement('div');
    box.id = 'achToasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    doc.body.appendChild(box);
  }
  list.forEach((a, i) => {
    const el = doc.createElement('div');
    el.className = 'ach-toast';
    el.style.setProperty('--d', `${i * 0.6}s`);
    el.innerHTML = `<span class="ach-medal" aria-hidden="true">${a.icon}</span><span><small>Conquista desbloqueada!</small><b>${escapeProgressText(a.name)}</b><em>${escapeProgressText(a.desc)}</em></span>`;
    box.appendChild(el);
    el.addEventListener('animationend', (e) => { if (e.animationName === 'ach-out') el.remove(); });
  });
}

// bloco do fim da partida: chip de ouro (a conta fica na dica) e mini-retratos com o XP de maestria
export function rewardHTML(reward, variants = [], mvpId = null) {
  if (!reward) return '';
  const { gold, heroes, unlocked } = reward;
  const lines = gold.lines.map(([label, v]) => `${label} +${v}`);
  if (gold.mult !== 1) lines.push(`Bônus ×${gold.mult.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`);
  const goldTip = escapeProgressText(`+${gold.total} ${GOLD.name}: ${lines.join(' · ')} · Total ${reward.total}`);
  const heroRows = heroes.map((h) => {
    const cfg = variants.find((v) => v.id === h.id);
    const up = h.after > h.before;
    const tip = escapeProgressText(`${cfg?.name || h.id}${h.id === mvpId ? ' · MVP' : ''} · +${h.gained} XP · Maestria ${h.after}${up ? '!' : ''}`);
    return `<span class="prog-hero${up ? ' up' : ''}${h.id === mvpId ? ' mvp' : ''}" tabindex="0" data-tip="${tip}" aria-label="${tip}"${cfg ? ` style="--c:${cfg.color[0]};--cd:${cfg.color[1]}"` : ''}>${h.id === mvpId ? '<i class="crown" aria-hidden="true">♛</i>' : ''}${cfg ? `<img src="${cfg.portrait}" alt="">` : ''}<small>+${h.gained}</small>${up ? '<b aria-hidden="true">⬆</b>' : ''}</span>`;
  }).join('');
  const ach = unlocked.map((a) => `<span class="end-chip ach" tabindex="0" data-tip="Conquista: ${escapeProgressText(a.name)}" aria-label="Conquista: ${escapeProgressText(a.name)}"><i aria-hidden="true">${a.icon}</i></span>`).join('');
  return `<div class="progress-reward" aria-label="Ouro e maestria ganhos"><span class="end-chip gold" tabindex="0" data-tip="${goldTip}" aria-label="${goldTip}">+${gold.total} <i aria-hidden="true">${GOLD.icon}</i></span>${ach}${heroRows ? `<div class="prog-heroes">${heroRows}</div>` : ''}</div>`;
}

// Tela do acampamento: oficina, maestria dos heróis e conquistas.
export function renderCamp(root, progress, { variants = [], onBack = () => {}, tab = 'oficina', cosmetics = [], equippedCosmetic = null, onEquipCosmetic = () => {}, storageWarning = () => false } = {}) {
  const doc = root.ownerDocument || globalThis.document;
  const draw = (current) => {
    const achievements = progress.achievements();
    const done = achievements.filter((a) => a.unlocked).length;
    const tabs = [['oficina', 'Oficina', ''], ['maestria', 'Maestria', 'Cada herói ganha XP de maestria ao jogar. Bônus pequenos: no máximo +4% de vida e +4% de dano.'],
      ['conquistas', `Conquistas ${done}/${achievements.length}`, ''],
      ...(cosmetics.length ? [['cosmeticos', 'Cosméticos', 'Aparências por capítulo e por domínio 3★. Sem bônus de combate.']] : [])];
    let body = '';
    // Cartões curtos: ícone, nome, nível e custo; o efeito de cada melhoria aparece na dica.
    if (current === 'oficina') {
      body = `<div class="camp-shop">${UPGRADES.map((u) => {
        const lvl = progress.upgradeLevel(u.id), cost = progress.upgradeCost(u.id), max = u.costs.length;
        const pips = Array.from({ length: max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('');
        const label = cost == null ? 'Máx' : `${GOLD.icon} ${cost}`;
        const effect = cost != null && lvl ? `Agora: ${u.desc(lvl)} Próximo nível: ${u.desc(lvl + 1)}` : u.desc(Math.max(1, lvl));
        return `<article class="shop-item${cost == null ? ' maxed' : ''}" data-tip="${escapeProgressText(effect)}"><span class="shop-icon" aria-hidden="true">${u.icon}</span>
          <div class="shop-copy"><b>${u.name}</b><span class="shop-pips" role="img" aria-label="Nível ${lvl} de ${max}">${pips}</span></div>
          <button type="button" class="shop-buy" data-buy="${u.id}"${cost == null || progress.gold < cost ? ' disabled' : ''} aria-label="${escapeProgressText(`${cost == null ? `${u.name}: no máximo` : `Comprar ${u.name} por ${cost} de ouro`}. ${effect}`)}">${label}</button></article>`;
      }).join('')}</div>`;
    } else if (current === 'maestria') {
      body = `<div class="camp-mastery">${variants.map((cfg) => {
        const m = progress.mastery(cfg.id), pct = m.next ? Math.round((m.xp - m.from) / (m.next - m.from) * 100) : 100;
        const perks = MASTERY_PERKS.slice(1, m.level).map((p) => p.text).join(' · ') || 'Sem bônus ainda';
        const tip = `Maestria ${m.level}${m.next ? ` · ${m.xp}/${m.next} XP` : ' · máxima'} · ${perks}`;
        return `<div class="mastery-row mastery-${m.level}" style="--c:${cfg.color[0]};--cd:${cfg.color[1]}" data-tip="${escapeProgressText(tip)}" tabindex="0" aria-label="${escapeProgressText(`${cfg.name}: ${tip}`)}">
          <img src="${cfg.portrait}" alt=""><span><b>${escapeProgressText(cfg.name)}</b><small>Nv ${m.level}</small>
          <span class="mastery-track" aria-hidden="true"><i style="width:${pct}%"></i></span></span></div>`;
      }).join('')}</div>`;
    } else if (current === 'cosmeticos') {
      const equipped = equippedCosmetic?.id || null;
      body = `<div class="camp-cosmetics">${cosmetics.map((cosmetic) => {
        const selected = equipped === cosmetic.id;
        const challenge = cosmetic.track === 'challenge';
        const requiredArenas = Math.max(1, Number(cosmetic.requiredArenas) || 1);
        const completedArenas = Math.min(requiredArenas, Math.max(0, Number(cosmetic.completedArenas) || 0));
        const pendingMissions = challenge && Array.isArray(cosmetic.pendingMissions)
          ? cosmetic.pendingMissions.filter((mission) => mission && typeof mission.name === 'string').slice(0, requiredArenas)
          : [];
        const stars = Math.max(0, Number(cosmetic.stars) || 0);
        const maxStars = Math.max(requiredArenas, Number(cosmetic.maxStars) || requiredArenas * 3);
        const pct = Math.round(completedArenas / requiredArenas * 100);
        const arenaProgress = `${completedArenas} de ${requiredArenas} arenas concluídas`;
        const challengeProgress = `${completedArenas} de ${requiredArenas} missões com 3★ no ${cosmetic.difficultyName}`;
        const starProgress = `${stars}/${maxStars} estrelas do capítulo`;
        const requirement = challenge
          ? cosmetic.unlocked ? `Desafio completo · ${challengeProgress}` : challengeProgress
          : cosmetic.unlocked ? starProgress : arenaProgress;
        const tip = cosmetic.unlocked
          ? `${cosmetic.chapter} · visual desbloqueado · ${challenge ? challengeProgress : `${starProgress} · ${arenaProgress}`}`
          : `${cosmetic.chapter} · ${challenge ? challengeProgress : `${arenaProgress} · faltam ${requiredArenas - completedArenas} arena${requiredArenas - completedArenas === 1 ? '' : 's'} para desbloquear`}`;
        const progressLabel = cosmetic.unlocked
          ? `${cosmetic.name}: visual desbloqueado. ${challenge ? challengeProgress : `${starProgress}; ${arenaProgress}`}.`
          : `${cosmetic.name}: ${challenge ? challengeProgress : `${arenaProgress}; faltam ${requiredArenas - completedArenas} arena${requiredArenas - completedArenas === 1 ? '' : 's'} para desbloquear`}.`;
        const pendingMissionList = !cosmetic.unlocked && pendingMissions.length
          ? `<details class="cosmetic-missions"><summary>Ver missões pendentes (${pendingMissions.length})</summary><ul>${pendingMissions.map((mission) => `<li>${escapeProgressText(mission.name)}</li>`).join('')}</ul></details>`
          : '';
        return `<article class="cosmetic-item${cosmetic.unlocked ? ' unlocked' : ''}${selected ? ' equipped' : ''}${challenge ? ' challenge-cosmetic' : ''}" data-track="${challenge ? 'challenge' : 'chapter'}" style="--cosmetic-color:#${cosmetic.color.toString(16).padStart(6, '0')}" data-tip="${escapeProgressText(tip)}">
          <span class="cosmetic-icon" aria-hidden="true">${cosmetic.icon}</span><div class="cosmetic-copy"><small>${escapeProgressText(cosmetic.chapter)}</small><b>${escapeProgressText(cosmetic.name)}</b>
          <span class="cosmetic-progress" role="progressbar" aria-label="${escapeProgressText(progressLabel)}" aria-valuemin="0" aria-valuemax="${requiredArenas}" aria-valuenow="${completedArenas}"><i style="width:${pct}%"></i></span><em>${escapeProgressText(requirement)}</em>${pendingMissionList}</div>
          <button type="button" class="cosmetic-equip" data-cosmetic="${escapeProgressText(cosmetic.id)}"${!cosmetic.unlocked || selected ? ' disabled' : ''}>${selected ? 'Equipado' : cosmetic.unlocked ? 'Equipar' : 'Bloqueado'}</button></article>`;
      }).join('')}${equipped ? '<button type="button" class="cosmetic-clear">Remover visual</button>' : ''}</div>`;
    } else {
      // grade de medalhas: nome, requisito e progresso só na dica
      body = `<div class="camp-achievements">${achievements.map((a) => {
        const progressText = a.goal && !a.unlocked ? ` (${a.progress}/${a.goal})` : '';
        const tip = `${a.name}: ${a.desc}${progressText}`;
        return `<div class="ach-item${a.unlocked ? ' done' : ''}" data-tip="${escapeProgressText(tip)}" tabindex="0" role="img" aria-label="${escapeProgressText(`${tip}. ${a.unlocked ? 'Desbloqueada' : 'Bloqueada'}`)}">
        <span class="ach-medal" aria-hidden="true">${a.icon}</span>${a.goal && !a.unlocked ? `<span class="mastery-track" aria-hidden="true"><i style="width:${Math.round(a.progress / a.goal * 100)}%"></i></span>` : ''}</div>`;
      }).join('')}</div>`;
    }
    const warningText = storageWarning();
    const warning = warningText ? `<div class="storage-warning" role="status">${escapeProgressText(warningText)}</div>` : '';
    root.innerHTML = `<div class="camp-head">
        <button type="button" class="camp-back">← Menu</button>
        <span class="camp-title"><span class="camp-crown" aria-hidden="true">⚒</span>Acampamento</span>
        <span class="camp-gold" aria-label="${progress.gold} de ouro"><i aria-hidden="true">${GOLD.icon}</i><b>${progress.gold}</b></span>
      </div>
      ${warning}
      <div class="camp-tabs" role="tablist">${tabs.map(([id, label, tip]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === current}"${tip ? ` data-tip="${tip}"` : ''}>${label}</button>`).join('')}</div>
      <section class="camp-panel" role="tabpanel">${body}</section>`;
    root.querySelector('.camp-back').onclick = onBack;
    for (const b of root.querySelectorAll('[data-tab]')) b.onclick = () => draw(b.dataset.tab);
    for (const b of root.querySelectorAll('[data-buy]')) b.onclick = () => {
      const res = progress.buy(b.dataset.buy);
      if (!res.ok) return;
      toastAchievements(res.unlocked, doc);
      draw('oficina');
      root.querySelector(`[data-buy="${b.dataset.buy}"]`)?.focus();
    };
    for (const b of root.querySelectorAll('[data-cosmetic]')) b.onclick = () => {
      if (!onEquipCosmetic(b.dataset.cosmetic)) return;
      equippedCosmetic = cosmetics.find((cosmetic) => cosmetic.id === b.dataset.cosmetic) || null;
      draw('cosmeticos');
      root.querySelector(`[data-cosmetic="${b.dataset.cosmetic}"]`)?.focus();
    };
    const clearCosmetic = root.querySelector('.cosmetic-clear');
    if (clearCosmetic) clearCosmetic.onclick = () => { onEquipCosmetic(null); equippedCosmetic = null; draw('cosmeticos'); };
  };
  draw(tab);
}
