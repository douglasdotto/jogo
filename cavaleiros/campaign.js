// Campanha: missões ao longo do caminho (trechos de fases), estrelas por desempenho e o mapa para escolher.

// goal: objetivo de cada missão (o HUD mostra e a missão falha se a regra quebrar)
// win = vencer · escort = proteger o aldeão · rescue = salvar um prisioneiro · tower = derrubar torres
// boss = derrotar o chefe · survive = aguentar `time` s na fase `phase` · totems = destruir `count` totens
// nofall = ninguém cai · timer = vencer em até `time` s
// defend = o santuário não pode cair enquanto as ondas chegam por `time` s
// hunt = abater o alvo marcado antes que ele fuja (`time` s) · endless = aguentar a noite; estrelas nos `marks` (s), amanhece em `dawn` s
// Trechos: o início avança pelas 12 fases; missões de chefe passam pelas fases 6 (Rei) e 12 (Lich) e o Carrasco fecha a fase 9;
// o lago precisa da fase 5 e o lago sombrio da fase 9, onde o mundo tem água.
// militia = aldeões armados da vila que lutam com o grupo nas missões da vila e dos campos
export const MISSIONS = [
  { id: 'vila', name: 'A Vila', desc: 'Os primeiros esqueletos chegaram à praça.', chapter: 'Capítulo I · Sinais na estrada', story: 'A patrulha cai na praça. No estandarte inimigo, uma marca de ossos aponta para a ponte ao norte.', tip: 'Aprenda o ritmo de ataque dos inimigos e preserve a vida do herói para buscar as três estrelas.', icon: '⌂', from: 1, to: 2, heroes: 1, level: 1, militia: 3, goal: { type: 'win' } },
  { id: 'ponte', name: 'A Ponte do Rio', desc: 'Atiradores no rochedo vigiam a ponte.', chapter: 'Capítulo I · Sinais na estrada', story: 'Os arqueiros fecharam a travessia. Do outro lado, tochas acendem rumo às fazendas.', tip: 'Inimigos perto do aldeão são uma ameaça imediata. Cura, provocação e empurrões ajudam a mantê-lo protegido.', icon: '≈', from: 2, to: 4, heroes: 2, level: 1, militia: 2, goal: { type: 'escort' } },
  { id: 'santuario', name: 'O Santuário', desc: 'Saqueadores querem quebrar o cristal da vila.', chapter: 'Capítulo I · Sinais na estrada', story: 'O cristal do santuário guarda a estrada. Se ele cair, as fazendas ficam sem proteção para o que vem do sul.', tip: 'Alguns esqueletos ignoram os heróis e correm para o santuário. Mantenha alguém perto dele e derrube os saqueadores primeiro.', icon: '✪', from: 3, to: 3, heroes: 2, level: 1, militia: 2, goal: { type: 'defend', time: 75 } },
  { id: 'fazendas', name: 'Fazendas', desc: 'O primeiro chefe ronda os campos.', chapter: 'Capítulo II · A marca de ossos', story: 'O chefe carrega um fragmento de totem. As pegadas dele terminam perto do lago.', tip: 'Guarde habilidades de alto impacto para o chefe e use efeitos de controle para reduzir a pressão dos reforços.', icon: '☘', from: 4, to: 6, heroes: 2, level: 2, militia: 2, goal: { type: 'boss' } },
  { id: 'lago', name: 'O Lago', desc: 'Eles saem da água rasa.', chapter: 'Capítulo II · A marca de ossos', story: 'Cada onda traz mais esqueletos. Segure a margem até a água revelar o caminho às ruínas.', tip: 'Na fase 5, sobreviva aos 90 segundos. Evite perseguições longas e fique atento aos avisos de ataques no chão.', icon: '≋', from: 4, to: 5, heroes: 3, level: 2, goal: { type: 'survive', time: 90, phase: 5 } },
  { id: 'caca', name: 'A Caçada', desc: 'Um batedor do necromante leva o mapa das ruínas.', chapter: 'Capítulo III · O véu da morte', story: 'O batedor marcado carrega o mapa das ruínas. Abata-o antes que ele desapareça na névoa do bosque.', tip: 'O alvo marcado foge de quem chega perto. Encurrale-o no fim da clareira e use atiradores, lentidão e raízes para segurá-lo.', icon: '➹', from: 7, to: 7, heroes: 3, level: 2, goal: { type: 'hunt', time: 60 } },
  { id: 'resgate', name: 'Resgate no Bosque', desc: 'Uma pessoa desaparecida foi vista entre as árvores.', chapter: 'Capítulo III · O véu da morte', story: 'Um prisioneiro conhece a origem da névoa. Encontre-o antes que os esqueletos o levem para as ruínas.', tip: 'Aproxime-se do prisioneiro para libertá-lo. Limpe o caminho ao redor antes de avançar.', icon: '⚑', from: 7, to: 8, heroes: 3, level: 2, goal: { type: 'rescue' } },
  { id: 'ruinas', name: 'Ruínas Antigas', desc: 'Entre colunas caídas, o mundo começa a morrer.', chapter: 'Capítulo III · O véu da morte', story: 'Os totens alimentam uma névoa que cobre as ruínas. Quebre os focos para abrir a passagem ao lago sombrio.', tip: 'Totens invocam reforços com o tempo. Destruí-los cedo reduz a quantidade de inimigos na estrada.', icon: '☗', from: 8, to: 10, heroes: 3, level: 3, goal: { type: 'totems', count: 3 } },
  { id: 'torre', name: 'Torre de Ossos', desc: 'Um farol sombrio reúne o exército do necromante.', chapter: 'Capítulo IV · A marcha final', story: 'A torre marca o caminho até o castelo. Derrube sua estrutura antes que mais reforços cheguem.', tip: 'Concentre os ataques na torre e elimine os guardiões que tentarem afastar o grupo.', icon: '☠', from: 9, to: 10, heroes: 4, level: 3, goal: { type: 'tower', count: 1 } },
  { id: 'lago-sombrio', name: 'Lago Sombrio', desc: 'Água escura e névoa roxa.', chapter: 'Capítulo IV · A marcha final', story: 'A torre caiu, mas o lago escuro guarda o último caminho. Atravesse sem perder ninguém; a névoa vem do cemitério.', tip: 'A missão termina se qualquer herói cair. Priorize cura, controle de grupo e esquiva dos ataques marcados.', icon: '☽', from: 9, to: 11, heroes: 4, level: 3, goal: { type: 'nofall' } },
  { id: 'cemiterio', name: 'Cemitério', desc: 'Os mortos não descansam.', chapter: 'Capítulo IV · A marcha final', story: 'O cemitério inteiro se ergue em resposta ao chamado. Atravesse antes que os mortos cheguem ao castelo.', tip: 'O limite é de quatro minutos. Elimine rapidamente inimigos que curam ou trazem esqueletos de volta.', icon: '✝', from: 10, to: 11, heroes: 4, level: 3, goal: { type: 'timer', time: 240 } },
  { id: 'horda', name: 'Noite sem Fim', desc: 'A horda não para de chegar.', chapter: 'Capítulo IV · A marcha final', story: 'Antes do castelo, o necromante solta a horda inteira. Segure a estrada o máximo que puder até o amanhecer.', tip: 'Não há cura entre fases: cada minuto vale uma estrela. Guarde as ultimates para quando a horda engrossar.', icon: '❂', from: 10, to: 10, heroes: 4, level: 3, goal: { type: 'endless', marks: [60, 120, 180], dawn: 300 } },
  { id: 'castelo', name: 'Castelo do Necromante', desc: 'A batalha final contra o chefe.', chapter: 'Capítulo IV · A marcha final', story: 'A fonte da invasão espera atrás dos portões. Derrote o necromante e encerre a marcha dos ossos.', tip: 'Observe os círculos de perigo, saia deles antes do impacto e concentre o dano no chefe quando houver abertura.', icon: '♜', from: 11, to: 12, heroes: 4, level: 3, goal: { type: 'boss' } },
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
    rescue: 'Resgate o prisioneiro',
    tower: `Derrube ${goal.count === 1 ? 'a torre' : `${goal.count} torres`} de ossos`,
    boss: 'Derrote o chefe',
    survive: `Aguente ${goal.time} s no lago`,
    totems: `Destrua ${goal.count} totens de ossos`,
    nofall: 'Nenhum herói pode cair',
    timer: `Vença em até ${Math.floor(goal.time / 60)} min`,
    defend: `Defenda o santuário por ${goal.time} s`,
    hunt: 'Abata o alvo marcado antes que fuja',
    endless: 'Aguente a horda o máximo possível',
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

// Medalha = dificuldade mais alta já vencida; desafio = 3 estrelas no Difícil e no Pesadelo.
// Fica à parte das estrelas: 3★ no Fácil continuam valendo 3★, a medalha só mostra o feito.
const MISSION_MEDALS_KEY = 'cavaleiros-medalhas-missao';
const CHALLENGE_DIFFICULTIES = ['dificil', 'pesadelo'];
const difficultyRank = (id) => RECORD_DIFFICULTIES.findIndex(([known]) => known === id);
const readMissionMedals = () => {
  try {
    const data = JSON.parse(localStorage.getItem(MISSION_MEDALS_KEY));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
};

export function missionMedal(id) {
  const saved = readMissionMedals()[id] || {};
  // vitórias antigas já deixaram recordes de tempo por dificuldade
  const rank = Math.max(difficultyRank(saved.best), ...missionRecords(id).map((record) => difficultyRank(record.difficultyId)));
  const best = rank >= 0 ? { difficultyId: RECORD_DIFFICULTIES[rank][0], difficultyName: RECORD_DIFFICULTIES[rank][1] } : null;
  const challenges = CHALLENGE_DIFFICULTIES.map((difficultyId) => ({
    difficultyId,
    difficultyName: RECORD_DIFFICULTIES[difficultyRank(difficultyId)][1],
    label: `3★ no ${RECORD_DIFFICULTIES[difficultyRank(difficultyId)][1]}`,
    done: saved.challenges?.[difficultyId] === true,
  }));
  return { best, challenges };
}

// Grava a vitória; devolve o que é novo para a tela de fim de missão.
export function saveMissionMedal(id, { won, stars, difficultyId } = {}) {
  const none = { newBest: false, newChallenge: null };
  const rank = difficultyRank(difficultyId);
  if (!MISSIONS.some((mission) => mission.id === id) || won !== true || rank < 0) return none;
  const before = missionMedal(id);
  const all = readMissionMedals();
  const saved = all[id] && typeof all[id] === 'object' && !Array.isArray(all[id]) ? { ...all[id] } : {};
  const newBest = rank > difficultyRank(before.best?.difficultyId);
  if (newBest || difficultyRank(saved.best) < rank) saved.best = difficultyId;
  const challenge = before.challenges.find((item) => item.difficultyId === difficultyId);
  const newChallenge = challenge && !challenge.done && stars >= 3 ? challenge : null;
  if (newChallenge) saved.challenges = { ...saved.challenges, [difficultyId]: true };
  all[id] = saved;
  try { localStorage.setItem(MISSION_MEDALS_KEY, JSON.stringify(all)); } catch { return none; }
  return { newBest, newChallenge };
}

// ?tudo=1 na URL libera todas as missões (para testar)
export const allOpen = () => { try { return new URLSearchParams(location.search).get('tudo') === '1'; } catch { return false; } };
export const starsOf = (id) => read()[id] || 0;
export const unlocked = (i) => i === 0 || allOpen() || starsOf(MISSIONS[i - 1].id) > 0 || starsOf(MISSIONS[i].id) > 0;   // saves antigos: missão nova no meio não bloqueia quem já tem estrelas
export const totalStars = () => MISSIONS.reduce((s, m) => s + starsOf(m.id), 0);

// Todo o elenco fica disponível desde o início; estrelas continuam servindo para avaliar a campanha.
export const STARTERS = ['paladin', 'berserker', 'pyro', 'assassin'];
export const UNLOCKS = [];
export const starsToUnlock = () => 0;
export const variantOpen = () => true;

// Critérios cumulativos servem tanto para calcular estrelas quanto para
// explicar o resultado no fim da missão.
export function starConditions({ won, falls, hpRatio, goal, shrineRatio, timeLeft, endlessTime }) {
  const completed = Boolean(won);
  const hpPercent = Math.round(Math.max(0, Math.min(1, Number(hpRatio) || 0)) * 100);
  const fallCount = Math.max(0, Number(falls) || 0);
  const noFalls = completed && fallCount === 0;
  if (goal?.type === 'endless') {
    const seconds = Math.floor(Math.max(0, Number(endlessTime) || 0));
    return goal.marks.map((mark) => ({ label: `Aguentar ${mark} s (atual ${seconds} s)`, achieved: seconds >= mark }));
  }
  if (goal?.type === 'defend') {
    const shrinePercent = Math.round(Math.max(0, Math.min(1, Number(shrineRatio) || 0)) * 100);
    const shrineSafe = completed && shrinePercent >= 50;
    return [
      { label: 'Defender o santuário até o fim', achieved: completed },
      { label: `Santuário com 50%+ de vida (atual ${shrinePercent}%)`, achieved: shrineSafe },
      { label: `Santuário 50%+ e sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'})`, achieved: shrineSafe && fallCount === 0 },
    ];
  }
  if (goal?.type === 'hunt') {
    const left = Math.max(0, Number(timeLeft) || 0);
    return [
      { label: 'Abater o alvo marcado', achieved: completed },
      { label: `Sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'})`, achieved: noFalls },
      { label: `Sem quedas e com metade do tempo sobrando (${Math.ceil(left)} s de ${goal.time} s)`, achieved: noFalls && left >= goal.time / 2 },
    ];
  }
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

// metas de estrela mostradas no mapa, conforme o objetivo
export function starTargetsFor(goal) {
  if (goal.type === 'nofall') return ['1★ Concluir sem quedas', '2★ Terminar com 75%+ de vida', '3★ Terminar com 90%+ de vida'];
  if (goal.type === 'endless') return goal.marks.map((mark, i) => `${i + 1}★ Aguentar ${mark} s`);
  if (goal.type === 'defend') return ['1★ Defender o santuário', '2★ Santuário com 50%+ de vida', '3★ Santuário 50%+ e sem quedas'];
  if (goal.type === 'hunt') return ['1★ Abater o alvo', '2★ Sem quedas', '3★ Sem quedas e metade do tempo sobrando'];
  return ['1★ Concluir a missão', '2★ Sem quedas', '3★ Sem quedas e 50%+ de vida'];
}

const attr = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// `tips`: critério de cada estrela, mostrado como dica sob demanda
const starRow = (n, size = '', tips = null) => `<span class="stars ${size}"${tips ? ` role="img" aria-label="${n} de 3 estrelas. ${attr(tips.join('. '))}"` : ''}>${[1, 2, 3].map((k) => `<i class="${k <= n ? 'on' : ''}"${tips ? ` data-tip="${attr(tips[k - 1])}"` : ''}>★</i>`).join('')}</span>`;
// selo da melhor dificuldade vencida (inicial da dificuldade); brilha com algum desafio cumprido
const medalSeal = (medal, tip = '') => medal.best
  ? `<span class="camp-seal seal-${medal.best.difficultyId}${medal.challenges.some((c) => c.done) ? ' challenge' : ''}"${tip ? ` data-tip="${attr(tip)}" tabindex="0" aria-label="${attr(tip)}"` : ' aria-hidden="true"'}>${medal.best.difficultyName[0]}</span>`
  : '';
const BOSSES = ['King', 'Executioner', 'Lich', 'Golem'];

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
  root.innerHTML = `
    <div class="camp-head">
      <span class="camp-title"><span class="camp-crown" aria-hidden="true">♛</span>Campanha</span>
      <span class="camp-progress" role="progressbar" aria-label="Estrelas da campanha" aria-valuemin="0" aria-valuemax="${MISSIONS.length * 3}" aria-valuenow="${total}">
        <i aria-hidden="true">★</i><b>${total}</b><span>/${MISSIONS.length * 3}</span>
      </span>
    </div>
    <div class="camp-body">
      <div class="camp-map"><svg class="camp-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M 50 91 C 43 89, 40 86, 44 82 C 48 78, 54 75, 56 72 C 53 68, 45 65, 36 65 C 42 64, 50 59, 55 56 C 61 53, 67 45, 72 40 C 68 43, 62 45, 58 44 C 50 42, 39 39, 30 39 C 36 35, 48 29, 62 31 C 72 33, 81 44, 86 57 C 82 45, 70 36, 60 31 C 55 27, 50 22, 47 20 C 54 15, 62 10, 67 9" /></svg></div>
      <aside class="camp-info" role="region" aria-label="Detalhes da missão selecionada"></aside>
    </div>`;
  const map = root.querySelector('.camp-map'), info = root.querySelector('.camp-info');
  const announcement = document.createElement('span');
  announcement.className = 'camp-announcement';
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  root.appendChild(announcement);
  // Marcos seguem a estrada e as referências visuais da ilustração.
  const spots = [[50, 91], [56, 72], [46, 68], [36, 65], [55, 56], [64, 48], [72, 40], [30, 39], [62, 31], [86, 57], [47, 20], [58, 13], [67, 9]];
  const nodes = MISSIONS.map((m, i) => {
    const b = document.createElement('button');
    const open = unlocked(i), stars = starsOf(m.id), medal = missionMedal(m.id);
    b.className = `camp-node${open ? '' : ' locked'}${stars ? ' done' : ''}`;
    b.style.left = spots[i][0] + '%';
    b.style.top = spots[i][1] + '%';
    b.setAttribute('aria-label', `${i + 1}. ${m.name}. ${goalText(m.goal)}. ${open ? `${stars} de 3 estrelas.${medal.best ? ` Melhor vitória: ${medal.best.difficultyName}.` : ''}` : `Bloqueada. Conclua ${MISSIONS[i - 1].name} com pelo menos uma estrela para liberar.`}`);
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="medal">${open ? m.icon : '\u{1F512}︎'}</span><span class="num">${i + 1}</span>${open ? starRow(stars, 'small') + medalSeal(medal) : ''}`;
    b.onclick = () => { if (sel !== i) select(i); };
    b.onfocus = () => { if (sel !== i) select(i); };
    b.ondblclick = () => play();
    map.appendChild(b);
    return b;
  });
  // Painel enxuto: nome, objetivo, estrelas e ameaças à vista; história, plano, trecho, medalha e recordes ficam nas dicas.
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
    const medal = missionMedal(m.id);
    const mapLabel = typeof biome === 'string' && biome.trim() ? biome.trim().toUpperCase() : 'MAPA ALEATÓRIO';
    announcement.textContent = `${i + 1}. ${m.name}. Objetivo: ${goalText(m.goal)}. ${open ? `${stars} de 3 estrelas.` : `Bloqueada. Conclua ${MISSIONS[i - 1].name} com pelo menos uma estrela para liberar.`}`;
    const showReplayButton = remainingStars && replayTargetIndex >= 0 && i !== replayTargetIndex;
    const squad = `Fases ${m.from}–${m.to} · ${m.heroes} herói${m.heroes > 1 ? 's' : ''} no nível ${m.level}`;
    const medalTip = medal.best ? `Vencida no ${medal.best.difficultyName}. Desafios opcionais: ${medal.challenges.map((c) => `${c.done ? '✓' : '○'} ${c.label}`).join(', ')}` : '';
    const best = records.reduce((a, r) => (!a || r.seconds < a.seconds ? r : a), null);
    const recordTip = `Seus melhores tempos: ${records.map((r) => `${r.difficultyName} ${r.time}`).join(' · ')}`;
    const threatPhase = (t) => t.optional ? 'Possível · dificuldade alta' : t.possible ? `Pode surgir · fase ${t.phase}` : `Fase ${t.phase}`;
    const completeTip = remainingStars
      ? `Todas as arenas foram vencidas. ${replayTargetIndex >= 0 ? `${MISSIONS[replayTargetIndex].name} ainda pode render estrelas. ` : ''}${remainingLabel} para buscar.`
      : `Todas as ${MISSIONS.length * 3} estrelas foram conquistadas.`;
    info.innerHTML = `
      <div class="camp-info-head">
        <div class="medal big" aria-hidden="true">${open ? m.icon : '\u{1F512}︎'}</div>
        <div class="camp-ident">
          <div class="camp-arena-tag" data-tip="${attr(squad)}" tabindex="0" aria-label="Arena ${i + 1}, ${attr(mapLabel.toLowerCase())}. ${attr(squad)}">ARENA ${String(i + 1).padStart(2, '0')} · ${mapLabel}</div>
          <div class="camp-name">${m.name}</div>
          <p class="camp-desc" data-tip="${attr(`${m.chapter}. ${m.story}`)}" tabindex="0">${m.desc}</p>
        </div>
      </div>
      <div class="camp-score">${starRow(stars, 'big', starTargetsFor(m.goal))}${medalSeal(medal, medalTip)}${best ? `<span class="camp-record" data-tip="${attr(recordTip)}" tabindex="0" aria-label="${attr(recordTip)}"><i aria-hidden="true">⏱</i>${best.time}</span>` : ''}</div>
      <div class="camp-goal" data-tip="${attr(m.tip)}" tabindex="0" aria-label="Objetivo: ${attr(goalText(m.goal))}. Plano de batalha: ${attr(m.tip)}"><i aria-hidden="true">⚑</i>${goalText(m.goal)}</div>
      ${threats.length ? `<div class="camp-threats" role="list" aria-label="Inimigos especiais">${threats.map((threat) => {
        const tip = `${threat.name} · ${threatPhase(threat)} · ${threat.detail}`;
        return `<span role="listitem" class="camp-threat${threat.optional ? ' optional' : ''}${BOSSES.includes(threat.id) ? ' boss' : ''}" data-tip="${attr(tip)}" tabindex="0" aria-label="${attr(tip)}">${threat.icon}</span>`;
      }).join('')}</div>` : ''}
      ${cleared ? `<div class="camp-complete" data-tip="${attr(completeTip)}" tabindex="0" aria-label="${attr(`${remainingStars ? 'Campanha concluída' : 'Campanha perfeita'}. ${completeTip}`)}"><b>${remainingStars ? 'Campanha concluída' : '♛ Campanha perfeita'}</b>${remainingStars ? `<span>★ ${remainingStars}</span>` : ''}</div>${showReplayButton ? `<button class="camp-replay-button" type="button" aria-label="Ver missão recomendada: ${attr(MISSIONS[replayTargetIndex].name)}">★ ${MISSIONS[replayTargetIndex].name}</button>` : ''}` : ''}
      ${open ? '' : `<div class="camp-unlock" aria-label="Como desbloquear: conclua ${attr(MISSIONS[i - 1].name)} com pelo menos uma estrela"><i aria-hidden="true">\u{1F512}︎</i>${MISSIONS[i - 1].name}</div>`}
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
