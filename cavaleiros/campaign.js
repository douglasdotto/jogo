// Campanha: missões ao longo do caminho (trechos de fases), estrelas por desempenho e o mapa para escolher.

// goal: objetivo de cada missão (o HUD mostra e a missão falha se a regra quebrar)
// win = vencer · escort = proteger o aldeão · boss = derrotar o chefe · survive = aguentar `time` s na fase `phase`
// totems = destruir `count` totens · nofall = ninguém cai · timer = vencer em até `time` s
export const MISSIONS = [
  { id: 'vila', name: 'A Vila', desc: 'Os primeiros esqueletos chegaram à praça.', tip: 'Aprenda o ritmo de ataque dos inimigos e preserve a vida do herói para buscar as três estrelas.', icon: '⌂', from: 1, to: 3, heroes: 1, level: 1, goal: { type: 'win' } },
  { id: 'ponte', name: 'A Ponte do Rio', desc: 'Atiradores no rochedo vigiam a ponte.', tip: 'Inimigos perto do aldeão são uma ameaça imediata. Cura, provocação e empurrões ajudam a mantê-lo protegido.', icon: '≈', from: 3, to: 5, heroes: 2, level: 1, goal: { type: 'escort' } },
  { id: 'fazendas', name: 'Fazendas', desc: 'O primeiro chefe ronda os campos.', tip: 'Guarde habilidades de alto impacto para o chefe e use efeitos de controle para reduzir a pressão dos reforços.', icon: '☘', from: 4, to: 6, heroes: 2, level: 2, goal: { type: 'boss' } },
  { id: 'lago', name: 'O Lago', desc: 'Eles saem da água rasa.', tip: 'Na fase 5, sobreviva aos 90 segundos. Evite perseguições longas e fique atento aos avisos de ataques no chão.', icon: '≋', from: 5, to: 7, heroes: 3, level: 2, goal: { type: 'survive', time: 90, phase: 5 } },
  { id: 'ruinas', name: 'Ruínas Antigas', desc: 'Entre colunas caídas, o mundo começa a morrer.', tip: 'Totens invocam reforços com o tempo. Destruí-los cedo reduz a quantidade de inimigos na estrada.', icon: '☗', from: 7, to: 9, heroes: 3, level: 2, goal: { type: 'totems', count: 3 } },
  { id: 'lago-sombrio', name: 'Lago Sombrio', desc: 'Água escura e névoa roxa.', tip: 'A missão termina se qualquer herói cair. Priorize cura, controle de grupo e esquiva dos ataques marcados.', icon: '☽', from: 9, to: 10, heroes: 4, level: 3, goal: { type: 'nofall' } },
  { id: 'cemiterio', name: 'Cemitério', desc: 'Os mortos não descansam.', tip: 'O limite é de quatro minutos. Elimine rapidamente inimigos que curam ou trazem esqueletos de volta.', icon: '✝', from: 10, to: 11, heroes: 4, level: 3, goal: { type: 'timer', time: 240 } },
  { id: 'castelo', name: 'Castelo do Necromante', desc: 'A batalha final contra o chefe.', tip: 'Observe os círculos de perigo, saia deles antes do impacto e concentre o dano no chefe quando houver abertura.', icon: '♜', from: 11, to: 12, heroes: 4, level: 3, goal: { type: 'boss' } },
];

// Mantém as arenas estáveis enquanto o jogador navega entre mapa e dificuldade;
// uma nova tentativa pode limpar a sessão e sortear outro conjunto.
export function createCampaignMapSeedSession(missions, random = Math.random) {
  let seeds = null;
  return {
    get() {
      if (!seeds) {
        const used = new Set();
        seeds = new Map();
        for (const mission of missions) {
          let seed = Math.floor(random() * 2147483646) + 1;
          while (used.has(seed)) seed = seed % 2147483646 + 1;
          used.add(seed);
          seeds.set(mission.id, seed);
        }
      }
      return seeds;
    },
    reset() { seeds = null; },
  };
}

// texto curto do objetivo (mapa e HUD)
export function goalText(goal) {
  return {
    win: 'Vença todas as fases',
    escort: 'Proteja o aldeão',
    boss: 'Derrote o chefe',
    survive: `Aguente ${goal.time} s no lago`,
    totems: `Destrua ${goal.count} totens de ossos`,
    nofall: 'Nenhum herói pode cair',
    timer: `Vença em até ${Math.floor(goal.time / 60)} min`,
  }[goal.type];
}

const KEY = 'cavaleiros-campanha';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const MISSION_RECORDS_KEY = 'cavaleiros-recordes-missao';
const RECORD_DIFFICULTIES = [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil'], ['pesadelo', 'Pesadelo']];
const readMissionRecords = () => {
  try {
    const data = JSON.parse(localStorage.getItem(MISSION_RECORDS_KEY));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
};
const formatMissionTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

// Recordes separados por dificuldade deixam a comparação justa ao rejogar uma missão.
export function missionRecords(id) {
  const records = readMissionRecords()[id];
  if (!records || typeof records !== 'object' || Array.isArray(records)) return [];
  return RECORD_DIFFICULTIES.flatMap(([difficultyId, difficultyName]) => {
    const seconds = Number(records[difficultyId]?.seconds);
    return Number.isFinite(seconds) && seconds > 0
      ? [{ difficultyId, difficultyName, seconds, time: formatMissionTime(seconds) }]
      : [];
  });
}

// Só uma vitória válida atualiza o recorde; tempos de teste e derrotas são descartados.
export function saveMissionRecord(id, result) {
  if (!MISSIONS.some((mission) => mission.id === id) || result?.won !== true) return false;
  const difficultyId = result.difficultyId;
  if (!RECORD_DIFFICULTIES.some(([known]) => known === difficultyId)) return false;
  const seconds = Number(result.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  const all = readMissionRecords();
  const records = all[id] && typeof all[id] === 'object' && !Array.isArray(all[id]) ? { ...all[id] } : {};
  const previous = Number(records[difficultyId]?.seconds);
  if (Number.isFinite(previous) && previous > 0 && seconds >= previous) return false;
  records[difficultyId] = { seconds: Math.round(seconds * 10) / 10 };
  all[id] = records;
  try { localStorage.setItem(MISSION_RECORDS_KEY, JSON.stringify(all)); } catch { return false; }
  return true;
}

// ?tudo=1 na URL libera todas as missões e variantes (para testar)
export const allOpen = () => { try { return new URLSearchParams(location.search).get('tudo') === '1'; } catch { return false; } };
export const starsOf = (id) => read()[id] || 0;
export const unlocked = (i) => i === 0 || allOpen() || starsOf(MISSIONS[i - 1].id) > 0 || starsOf(MISSIONS[i].id) > 0;   // saves antigos: missão nova no meio não bloqueia quem já tem estrelas
export const totalStars = () => MISSIONS.reduce((s, m) => s + starsOf(m.id), 0);

// Uma variante por classe começa liberada. As demais entram no fluxo de estrelas até 23.
export const STARTERS = ['paladin', 'berserker', 'pyro', 'assassin'];
const UNLOCK_NAMES = {
  guardian: 'Guardião', viking: 'Viking', cryo: 'Criomante', crossbow: 'Besteiro',
  champion: 'Campeão', crusher: 'Esmagador', arcane: 'Arcano', ninja: 'Ninja',
  king: 'Rei Dourado', iceviking: 'Viking do Gelo', necro: 'Necromante', druid: 'Druida',
  cleric: 'Clériga', bard: 'Bardo', angel: 'Anjo', chronist: 'Cronomante',
};
const NEW_UNLOCK_STARS = { cleric: 2, bard: 8, angel: 14, chronist: 20 };
export const UNLOCKS = Object.entries(UNLOCK_NAMES)
  .map(([id, name], i) => ({ id, name, stars: NEW_UNLOCK_STARS[id] ?? 1 + i * 2 }))
  .sort((a, b) => a.stars - b.stars || a.id.localeCompare(b.id));
export const starsToUnlock = (id) => UNLOCKS.find((u) => u.id === id)?.stars || 0;
export const variantOpen = (id, total = totalStars()) => STARTERS.includes(id) || allOpen() || total >= starsToUnlock(id);

// Critérios cumulativos servem tanto para calcular estrelas quanto para
// explicar o resultado no fim da missão.
export function starConditions({ won, falls, hpRatio, goal }) {
  const completed = Boolean(won);
  const hpPercent = Math.round(Math.max(0, Math.min(1, Number(hpRatio) || 0)) * 100);
  const fallCount = Math.max(0, Number(falls) || 0);
  const noFalls = completed && fallCount === 0;
  if (goal?.type === 'nofall') return [
    { label: `Concluir sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'})`, achieved: noFalls },
    { label: `Terminar com 75%+ de vida (atual ${hpPercent}%)`, achieved: noFalls && hpRatio >= 0.75 },
    { label: `Terminar com 90%+ de vida (atual ${hpPercent}%)`, achieved: noFalls && hpRatio >= 0.9 },
  ];
  return [
    { label: 'Concluir a missão', achieved: completed },
    { label: `Terminar sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'})`, achieved: noFalls },
    { label: `Sem quedas e com 50%+ de vida (atual ${hpPercent}%)`, achieved: noFalls && hpRatio >= 0.5 },
  ];
}

// As estrelas são cumulativas: para cada faixa, todas as anteriores precisam ser cumpridas.
export function starsFor(result) {
  let stars = 0;
  for (const condition of starConditions(result)) {
    if (!condition.achieved) break;
    stars++;
  }
  return stars;
}

// guarda o melhor resultado; devolve true se melhorou
export function saveStars(id, stars) {
  const all = read();
  if (stars <= (all[id] || 0)) return false;
  all[id] = stars;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  return true;
}

const starRow = (n, size = '') => `<span class="stars ${size}">${[1, 2, 3].map((k) => `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

// desenha o mapa dentro de `root`; onPlay(missão) quando o jogador confirma
export function renderCampaign(root, onPlay, mapBiome = null, getThreats = null) {
  const total = totalStars();
  const cleared = MISSIONS.every((m) => starsOf(m.id) > 0);
  let sel = MISSIONS.findIndex((_, i) => unlocked(i) && starsOf(MISSIONS[i].id) === 0);
  if (sel < 0) sel = cleared ? MISSIONS.length - 1 : 0;
  const remainingStars = MISSIONS.length * 3 - total;
  const replayTargetIndex = cleared ? MISSIONS.findIndex((m) => starsOf(m.id) < 3) : -1;
  const remainingText = `${remainingStars} estrela${remainingStars === 1 ? '' : 's'}`;
  const remainingLabel = `${remainingText} ${remainingStars === 1 ? 'restante' : 'restantes'}`;
  const reward = allOpen() ? null : UNLOCKS.find((item) => item.stars > total);
  const starsLeft = reward ? reward.stars - total : 0;
  root.innerHTML = `
    <div class="camp-head">
      <span class="camp-title"><span class="camp-crown" aria-hidden="true">♛</span><span class="camp-title-copy"><small>TRILHA DE ARENAS</small>Campanha</span></span>
      <div class="camp-progress" role="progressbar" aria-label="Estrelas da campanha" aria-valuemin="0" aria-valuemax="${MISSIONS.length * 3}" aria-valuenow="${total}">
        <span class="camp-progress-label">ESTRELAS</span>
        <span class="camp-progress-track" aria-hidden="true"><i style="width:${Math.round(total / (MISSIONS.length * 3) * 100)}%"></i></span>
        <span class="camp-progress-score"><b>${total}</b><span>/${MISSIONS.length * 3}</span><i aria-hidden="true">★</i></span>
      </div>
      <div class="camp-reward" aria-label="${reward ? `Próximo desbloqueio: ${reward.name}, faltam ${starsLeft} estrela${starsLeft === 1 ? '' : 's'}` : 'Todas as classes disponíveis no modo livre'}">
        <span class="camp-reward-chest" aria-hidden="true">${reward ? '✦' : '♜'}</span>
        <span class="camp-reward-copy"><small>${reward ? 'PRÓXIMO DESBLOQUEIO' : 'MODO LIVRE'}</small><b>${reward ? reward.name : 'Todas as arenas'}</b><em>${reward ? `${starsLeft} estrela${starsLeft === 1 ? '' : 's'} para liberar` : 'Conteúdo aberto'}</em></span>
      </div>
    </div>
    <div class="camp-body">
      <div class="camp-map"><svg class="camp-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M 50 94 C 70 87, 78 82, 69 78 S 25 72, 33 67 S 58 61, 51 57 S 25 51, 31 45 S 31 37, 31 33 S 56 25, 52 21 S 67 14, 68 7" /></svg></div>
      <aside class="camp-info" role="region" aria-label="Detalhes da missão selecionada"></aside>
    </div>`;
  const map = root.querySelector('.camp-map'), info = root.querySelector('.camp-info');
  const announcement = document.createElement('span');
  announcement.className = 'camp-announcement';
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  root.appendChild(announcement);
  // posições dos medalhões ao longo da trilha (de baixo para cima, em zigue-zague)
  const spots = [[50, 92], [69, 79], [33, 68], [51, 57], [31, 45], [31, 33], [52, 21], [68, 8]];
  const nodes = MISSIONS.map((m, i) => {
    const b = document.createElement('button');
    const open = unlocked(i), stars = starsOf(m.id);
    b.className = `camp-node${open ? '' : ' locked'}${stars ? ' done' : ''}`;
    b.style.left = spots[i][0] + '%';
    b.style.top = spots[i][1] + '%';
    b.setAttribute('aria-label', `${i + 1}. ${m.name}. ${goalText(m.goal)}. ${open ? `${stars} de 3 estrelas.` : `Bloqueada. Conclua ${MISSIONS[i - 1].name} com pelo menos uma estrela para liberar.`}`);
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="medal">${open ? m.icon : '\u{1F512}︎'}</span><span class="num">${i + 1}</span>${open ? starRow(stars, 'small') : ''}`;
    b.onclick = () => { if (sel !== i) select(i); };
    b.onfocus = () => { if (sel !== i) select(i); };
    b.ondblclick = () => play();
    map.appendChild(b);
    return b;
  });
  function select(i, moveFocus = false, focusPlay = false) {
    sel = i;
    nodes.forEach((n, k) => {
      n.classList.toggle('sel', k === i);
      n.setAttribute('aria-pressed', String(k === i));
    });
    const m = MISSIONS[i], open = unlocked(i);
    const stars = starsOf(m.id);
    const biome = typeof mapBiome === 'function' ? mapBiome(m) : '';
    const threats = typeof getThreats === 'function' ? getThreats(m) : [];
    const records = missionRecords(m.id);
    const mapLabel = typeof biome === 'string' && biome.trim() ? biome.trim().toUpperCase() : 'MAPA ALEATÓRIO';
    announcement.textContent = `${i + 1}. ${m.name}. Objetivo: ${goalText(m.goal)}. ${open ? `${stars} de 3 estrelas.` : `Bloqueada. Conclua ${MISSIONS[i - 1].name} com pelo menos uma estrela para liberar.`}`;
    const starTargets = m.goal.type === 'nofall'
      ? ['1★ Concluir sem quedas', '2★ Terminar com 75%+ de vida', '3★ Terminar com 90%+ de vida']
      : ['1★ Concluir a missão', '2★ Sem quedas', '3★ Sem quedas e 50%+ de vida'];
    const showReplayButton = remainingStars && replayTargetIndex >= 0 && i !== replayTargetIndex;
    info.innerHTML = `
      <div class="camp-info-head">
        <div class="camp-info-title">
          <div class="medal big">${open ? m.icon : '\u{1F512}︎'}</div>
          <div class="camp-ident"><div class="camp-arena-tag">ARENA ${String(i + 1).padStart(2, '0')} · ${mapLabel}</div><div class="camp-name">${m.name}</div></div>
        </div>
        ${starRow(starsOf(m.id), 'big')}
      </div>
      <p>${m.desc}</p>
      ${cleared ? `<div class="camp-complete"><b>${remainingStars ? 'Campanha concluída' : 'Campanha perfeita'}</b><span>${remainingStars ? 'Todas as arenas foram vencidas. Ainda há estrelas para buscar.' : 'Todas as 24 estrelas foram conquistadas e todas as variantes estão liberadas.'}</span>${remainingStars && replayTargetIndex >= 0 ? `<span class="camp-replay-target">${MISSIONS[replayTargetIndex].name} ainda pode render estrelas. ${remainingLabel} para buscar.</span>${showReplayButton ? '<button class="camp-replay-button" type="button">Ver missão recomendada</button>' : ''}` : ''}</div>` : ''}
      <div class="camp-goal"><b>Objetivo</b>${goalText(m.goal)}</div>
      ${records.length ? `<div class="camp-records" aria-label="Melhores tempos desta missão"><b>Seus melhores tempos</b><div class="camp-record-list">${records.map((record) => `<span>${record.difficultyName}<strong>${record.time}</strong></span>`).join('')}</div></div>` : ''}
      ${threats.length ? `<div class="camp-threats" aria-label="Ameaças previstas"><b>Inimigos especiais</b><div class="camp-threat-grid">${threats.map((threat) => `<div class="camp-threat${threat.optional ? ' optional' : ''}${['King', 'Lich', 'Golem'].includes(threat.id) ? ' boss' : ''}" title="${threat.detail}"><i aria-hidden="true">${threat.icon}</i><span><strong>${threat.name}</strong><small>${threat.optional ? 'Possível · dificuldade alta' : threat.possible ? `Pode surgir · fase ${threat.phase}` : `Fase ${threat.phase}`} · ${threat.detail}</small></span></div>`).join('')}</div></div>` : ''}
      <div class="camp-tip"><b>Plano de batalha</b><span>${m.tip}</span></div>
      ${open ? '' : `<div class="camp-unlock"><b>Como desbloquear</b><span>Conclua “${MISSIONS[i - 1].name}” com pelo menos uma estrela.</span></div>`}
      <ul><li>Fases ${m.from}–${m.to}</li><li>Começa com ${m.heroes} herói${m.heroes > 1 ? 's' : ''} no nível ${m.level}</li></ul>
      <div class="camp-goals"><b>Estrelas acumulativas</b>${starTargets.map((target) => `<span>${target}</span>`).join('')}</div>
      <button class="camp-play" ${open ? '' : 'disabled'}>${open ? 'Batalhar' : 'Bloqueada'}</button>`;
    info.querySelector('.camp-play').onclick = play;
    const replayButton = info.querySelector('.camp-replay-button');
    if (replayButton && showReplayButton) replayButton.onclick = () => select(replayTargetIndex, false, true);
    if (moveFocus) nodes[i].focus();
    else if (focusPlay) info.querySelector('.camp-play')?.focus();
  }
  function play() { if (unlocked(sel)) onPlay(MISSIONS[sel]); }
  function key(e) {
    if (!root.isConnected || root.closest('.hidden')) return;
    const active = document.activeElement;
    const onNode = active?.classList?.contains('camp-node');
    if ((e.key === 'ArrowUp' || e.key === 'ArrowRight') && (onNode || active === document.body)) select(Math.min(MISSIONS.length - 1, sel + 1), true);
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowLeft') && (onNode || active === document.body)) select(Math.max(0, sel - 1), true);
    else if (e.key === 'Enter' && onNode) play();
    else return;
    e.preventDefault();
  }
  removeEventListener('keydown', renderCampaign.key || (() => {}));
  renderCampaign.key = key;
  addEventListener('keydown', key);
  select(sel);
}
