// Campanha: missões ao longo do caminho (trechos de fases), estrelas por desempenho e o mapa para escolher.

// goal: objetivo de cada missão (o HUD mostra e a missão falha se a regra quebrar)
// win = vencer · escort = proteger o aldeão · rescue = salvar um prisioneiro · tower = derrubar torres
// boss = derrotar o chefe · survive = aguentar `time` s na fase `phase` · totems = destruir `count` totens
// nofall = manter alguém de pé (quedas afetam estrelas) · timer = vencer em até `time` s
// defend = o santuário não pode cair enquanto as ondas chegam por `time` s
// hunt = abater o alvo marcado antes que ele fuja (`time` s) · endless = aguentar a noite; estrelas nos `marks` (s), amanhece em `dawn` s
// Trechos: o início avança pelas 12 fases; missões de chefe passam pelas fases 6 (Rei) e 12 (Lich) e o Carrasco fecha a fase 9;
// o lago precisa da fase 5 e o lago sombrio da fase 9, onde o mundo tem água.
// militia = aldeões de guarda em volta de quem a missão manda defender
// breach = segurar a ponte por `time` s; a missão cai se `leaks` esqueletos passarem
// duel = um herói só contra o chefe da fase (o herói tem vida × `heroHp`; ondas × `waves`; chefe com vida × `bossHp` e dano × `bossDmg`); 3★ pede vencer em até `time` s
// elite = `waves` ondas de elite seguidas (mais vida e dano; cada onda × `scale`)
// twin = Lich e Carrasco juntos na fase 12 · bosses = grupo de chefes da arena final · ending = frase de encerramento na vitória
// boss = { phase, kind, mod }: troca o chefe de uma fase só nesta missão (mod: variação visual + golpe extra, ver BOSS_MODS em monsters.js)
// foes = inimigos próprios da missão (estreiam na primeira onda e só aparecem ali)
export const MISSIONS = [
  { id: 'vila', name: 'A Vila', desc: 'Os primeiros esqueletos chegaram à praça.', chapter: 'Capítulo I · Sinais na estrada', story: 'A patrulha cai na praça. No estandarte inimigo, uma marca de ossos aponta para a ponte ao norte.', tip: 'Aprenda o ritmo de ataque dos inimigos e preserve a vida do herói para buscar as três estrelas.', icon: '⌂', from: 1, to: 2, heroes: 1, level: 1, goal: { type: 'win' } },
  { id: 'ponte', name: 'A Ponte do Rio', desc: 'Atiradores vigiam a ponte.', chapter: 'Capítulo I · Sinais na estrada', story: 'Os arqueiros fecharam a travessia. Do outro lado, tochas acendem rumo às fazendas.', tip: 'Inimigos perto do aldeão são uma ameaça imediata. Cura, provocação e empurrões ajudam a mantê-lo protegido.', icon: '≈', from: 2, to: 4, heroes: 2, level: 1, militia: 4, goal: { type: 'escort' } },
  { id: 'santuario', name: 'O Santuário', desc: 'Saqueadores querem quebrar o cristal da vila.', chapter: 'Capítulo I · Sinais na estrada', story: 'O cristal do santuário guarda a estrada. Se ele cair, as fazendas ficam sem proteção para o que vem do sul.', tip: 'Alguns esqueletos ignoram os heróis e correm para o santuário. Mantenha alguém perto dele e derrube os saqueadores primeiro.', icon: '✪', from: 3, to: 3, heroes: 2, level: 1, militia: 4, goal: { type: 'defend', time: 60 } },
  { id: 'chamas', name: 'Ponte em Chamas', desc: '6 cruzamentos rompem a defesa.', chapter: 'Capítulo I · Sinais na estrada', story: 'A ponte arde. Cada fuga abre caminho às fazendas; a sexta rompe a defesa.', tip: 'Intercepte quem corre para a ponte: sem vazamentos, 3★; até dois, 2★; três a cinco permitem vencer com 1★.', icon: '♨', from: 4, to: 4, heroes: 2, level: 2, goal: { type: 'breach', time: 70, leaks: 6 } },
  { id: 'fazendas', name: 'Fazendas', desc: 'O primeiro chefe ronda os campos.', chapter: 'Capítulo II · A marca de ossos', story: 'O chefe carrega um fragmento de totem. As pegadas dele terminam perto do lago.', tip: 'Guarde habilidades de alto impacto para o chefe e use efeitos de controle para reduzir a pressão dos reforços.', icon: '☘', from: 4, to: 6, heroes: 2, level: 2, goal: { type: 'boss' } },
  { id: 'lago', name: 'O Lago', desc: 'Eles saem da água rasa.', chapter: 'Capítulo II · A marca de ossos', story: 'Cada onda traz mais esqueletos. Segure a margem até a água revelar o caminho às ruínas.', tip: 'Na fase 5, sobreviva aos 90 segundos. Evite perseguições longas e fique atento aos avisos de ataques no chão.', icon: '≋', from: 4, to: 5, heroes: 3, level: 2, goal: { type: 'survive', time: 90, phase: 5 } },
  { id: 'duelo', name: 'Duelo', desc: 'Um herói. Um rei.', chapter: 'Capítulo II · A marca de ossos', story: 'O Rei Esqueleto exige um campeão: só um herói entra na arena.', tip: 'Sozinho, cada golpe conta. Leve um herói resistente e guarde a ultimate para a fúria do Rei.', icon: '⚔', from: 6, to: 6, heroes: 1, level: 3, goal: { type: 'duel', time: 75, waves: 0.25, heroHp: 2.5, bossHp: 0.45, bossDmg: 0.5 } },
  { id: 'caca', name: 'A Caçada', desc: 'Um batedor do necromante leva o mapa das ruínas.', chapter: 'Capítulo III · O véu da morte', story: 'O batedor marcado carrega o mapa das ruínas. Abata-o antes que ele desapareça na névoa do bosque.', tip: 'Até dois heróis podem sair da formação para interceptar o alvo dentro do alcance tático. Os demais protegem o grupo; atiradores, lentidão e raízes ajudam a segurá-lo.', icon: '➹', from: 7, to: 7, heroes: 3, level: 2, goal: { type: 'hunt', time: 60 } },
  { id: 'resgate', name: 'Resgate no Bosque', desc: 'Uma pessoa desaparecida foi vista entre as árvores.', chapter: 'Capítulo III · O véu da morte', story: 'Um prisioneiro conhece a origem da névoa. Encontre-o antes que os esqueletos o levem para as ruínas.', tip: 'Aproxime-se do prisioneiro para libertá-lo. Limpe o caminho ao redor antes de avançar.', icon: '⚑', from: 7, to: 8, heroes: 3, level: 2, goal: { type: 'rescue' } },
  { id: 'ruinas', name: 'Ruínas Antigas', desc: 'Entre colunas caídas, o mundo começa a morrer.', chapter: 'Capítulo III · O véu da morte', story: 'Os totens alimentam uma névoa que cobre as ruínas. Quebre os focos para abrir a passagem ao lago sombrio.', tip: 'Totens invocam reforços com o tempo. Destruí-los cedo reduz a quantidade de inimigos na estrada.', icon: '☗', from: 8, to: 10, heroes: 3, level: 3, goal: { type: 'totems', count: 3 }, boss: { phase: 9, kind: 'King', mod: 'spectral' } },
  { id: 'torre', name: 'Torre de Ossos', desc: 'Um farol sombrio reúne o exército do necromante.', chapter: 'Capítulo IV · A marcha final', story: 'A torre marca o caminho até o castelo. Derrube sua estrutura antes que mais reforços cheguem.', tip: 'Concentre os ataques na torre e elimine os guardiões que tentarem afastar o grupo.', icon: '☠', from: 9, to: 10, heroes: 4, level: 3, goal: { type: 'tower', count: 1 } },
  { id: 'lago-sombrio', name: 'Lago Sombrio', desc: 'Atravesse; a missão só termina se todo o grupo cair.', chapter: 'Capítulo IV · A marcha final', story: 'A torre caiu, mas o lago escuro guarda o último caminho. Atravesse mantendo ao menos um herói de pé; a névoa vem do cemitério.', tip: 'Uma queda não encerra a missão; heróis caídos podem voltar conforme a dificuldade. Para 2★, termine sem quedas e com 75%+ de vida; para 3★, sem quedas e com 90%+.', icon: '☽', from: 9, to: 11, heroes: 4, level: 3, goal: { type: 'nofall' }, boss: { phase: 9, kind: 'Executioner', mod: 'drowned' } },
  { id: 'cemiterio', name: 'Cemitério', desc: 'Os mortos não descansam.', chapter: 'Capítulo IV · A marcha final', story: 'O cemitério inteiro se ergue em resposta ao chamado. Atravesse antes que os mortos cheguem ao castelo.', tip: 'O limite é de quatro minutos. Elimine rapidamente inimigos que curam ou trazem esqueletos de volta.', icon: '✝', from: 10, to: 11, heroes: 4, level: 3, goal: { type: 'timer', time: 240 } },
  { id: 'horda', name: 'Noite sem Fim', desc: 'A horda não para de chegar.', chapter: 'Capítulo IV · A marcha final', story: 'Antes do castelo, o necromante solta a horda inteira. Segure a estrada o máximo que puder até o amanhecer.', tip: 'Não há cura entre fases: cada minuto vale uma estrela. Guarde as ultimates para quando a horda engrossar.', icon: '❂', from: 10, to: 10, heroes: 4, level: 3, goal: { type: 'endless', marks: [60, 120, 180], dawn: 300 } },
  { id: 'castelo', name: 'Castelo do Necromante', desc: 'Os portões guardam o necromante.', chapter: 'Capítulo IV · A marcha final', story: 'O necromante é ferido e recua para dentro do castelo. A Cripta guarda o caminho até o trono.', tip: 'Observe os círculos de perigo, saia deles antes do impacto e concentre o dano no chefe quando houver abertura.', icon: '♜', from: 11, to: 12, heroes: 4, level: 3, goal: { type: 'boss' }, ending: 'Ferido, o necromante recua para o salão do trono. A maldição continua viva.' },
  { id: 'cripta', name: 'Cripta Sombria', desc: 'A guarda de elite desperta.', chapter: 'Capítulo V · Além do Castelo', story: 'Sob o castelo, a guarda de elite do necromante ainda marcha.', tip: 'Três ondas de elite com uma breve pausa para se recuperar. Concentre o dano num alvo por vez e aproveite a cura entre as ondas.', icon: '⚰', from: 11, to: 11, heroes: 4, level: 3, goal: { type: 'elite', waves: 3, scale: 0.4 } },
  { id: 'trono', name: 'Trono de Ossos', desc: 'O Lich guarda o trono.', chapter: 'Capítulo V · Além do Castelo', story: 'O Lich ergue o Carrasco. Atrás do trono, uma porta revela o coração da maldição.', tip: 'O Lich e o Carrasco chegam juntos. Derrube um de cada vez e fuja das áreas marcadas.', icon: '♔', from: 12, to: 12, heroes: 4, level: 3, goal: { type: 'twin', scale: 0.8 }, ending: 'O Lich cai, mas sua sombra escapa para uma câmara sem luz.' },
  { id: 'coracao-do-castelo', name: 'Coração do Castelo', desc: 'Três guardiões protegem o coração sombrio.', chapter: 'Capítulo VI · O coração sombrio', story: 'No coração da maldição, a sombra do Lich se refaz. O Carrasco e o Cavaleiro do Eclipse protegem a fonte.', tip: 'Os três chefes atacam juntos. Concentre o grupo em um por vez, interrompa os golpes marcados e guarde a cura para a investida final.', icon: '☼', from: 13, to: 13, heroes: 4, level: 3, goal: { type: 'bosses', bosses: ['Lich', 'Executioner', 'DarkKnight'], scale: 0.18 }, ending: 'O coração sombrio se parte. A maldição enfim termina.' },
  { id: 'arauto', name: 'O Arauto das Asas', desc: 'Um arauto corre para acordar o dragão.', chapter: 'Capítulo VII · Asas de osso', story: 'Com o coração partido, a terra treme sob as ameias. Um arauto leva o chamado a algo enorme que dorme nos ossos da montanha.', tip: 'Abata o alvo antes que fuja. Círculos marrons mostram onde o Escavador vai irromper: saia e bata enquanto ele fica zonzo.', icon: '⚐', from: 10, to: 10, heroes: 4, level: 3, goal: { type: 'hunt', time: 70 }, foes: ['Burrower', 'Bannerbearer'] },
  { id: 'ninho', name: 'Ninho de Ossos', desc: 'Totens chocam o ninho do dragão.', chapter: 'Capítulo VII · Asas de osso', story: 'O arauto caiu, mas o chamado ecoou. No ninho, totens de ossos aquecem o que está para nascer.', tip: 'Quebre os totens cedo. O anel laranja do Porta-Estandarte acelera os esqueletos: derrube-o primeiro.', icon: '❍', from: 11, to: 11, heroes: 4, level: 3, goal: { type: 'totems', count: 2 }, foes: ['Burrower', 'Bannerbearer'] },
  { id: 'asas-de-osso', name: 'Asas de Osso', desc: 'O Dragão de Ossos levanta voo.', chapter: 'Capítulo VII · Asas de osso', story: 'Das ameias, o Dragão de Ossos abre as asas. É a última sombra da maldição.', tip: 'No ar, só ataques à distância o alcançam. Saia das faixas verdes dos rasantes e bata quando ele pousar exausto.', icon: '☬', from: 10, to: 11, heroes: 4, level: 3, goal: { type: 'boss' }, boss: { phase: 11, kind: 'BoneDragon' }, foes: ['Burrower', 'Bannerbearer'], ending: 'O Dragão de Ossos se desfaz em pó. O céu sobre o castelo enfim clareia.' },
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
    nofall: 'Mantenha ao menos um herói de pé',
    timer: `Vença em até ${Math.floor(goal.time / 60)} min`,
    defend: `Defenda o santuário por ${goal.time} s`,
    hunt: 'Abata o alvo marcado antes que fuja',
    endless: 'Aguente a horda o máximo possível',
    breach: `Segure a ponte por ${goal.time} s`,
    duel: 'Vença o duelo contra o chefe',
    elite: `Vença ${goal.waves} ondas de elite`,
    twin: 'Derrote o Lich e o Carrasco',
    bosses: `Derrote os ${goal.bosses?.length || 3} guardiões do castelo`,
  }[goal.type];
}

const KEY = 'cavaleiros-campanha';
const MISSION_RECORDS_KEY = 'cavaleiros-recordes-missao';
const MISSION_MEDALS_KEY = 'cavaleiros-medalhas-missao';
const CAMPAIGN_COSMETIC_KEY = 'cavaleiros-campanha-visual';
const RECORD_DIFFICULTIES = [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil'], ['pesadelo', 'Pesadelo']];
const CHALLENGE_DIFFICULTIES = ['dificil', 'pesadelo'];
const campaignMemory = new Map();
const campaignMemoryOnly = new Set();
const campaignCorruptKeys = new Set();
const campaignBackupFailures = new Set();
const campaignCorruptRaw = new Map();
const campaignReadFailures = new Set();
const campaignReadPendingWrites = new Set();
export function campaignStorageIsVolatile() {
  for (const key of new Set([...campaignReadFailures, ...campaignReadPendingWrites])) readCampaignObject(key);
  return campaignMemoryOnly.size > 0 || campaignBackupFailures.size > 0;
}
export function campaignStorageWasCorrupted() {
  // A interface do mapa calcula o aviso antes de renderizar estrelas, recordes e medalhas.
  // Inspecione todas as chaves aqui para detectar saves corrompidos já na primeira abertura.
  for (const key of [KEY, MISSION_RECORDS_KEY, MISSION_MEDALS_KEY, CAMPAIGN_COSMETIC_KEY]) readCampaignObject(key);
  return campaignCorruptKeys.size > 0;
}
export const campaignCorruptBackupFailed = () => campaignBackupFailures.size > 0;
function preserveCampaignBackup(key, raw) {
  const base = `${key}-corrompido`;
  for (let suffix = 0; suffix <= 999; suffix++) {
    const backupKey = suffix ? `${base}-${suffix}` : base;
    const existing = localStorage.getItem(backupKey);
    if (existing === raw) return;   // a tentativa anterior pode ter gravado antes de lançar
    if (existing == null) {
      localStorage.setItem(backupKey, raw);
      return;
    }
  }
  throw new Error('muitos backups de campanha');
}
const difficultyRank = (id) => RECORD_DIFFICULTIES.findIndex(([known]) => known === id);
function mergeCampaignObjects(key, stored, pending) {
  if (key === KEY) {
    const merged = { ...stored };
    for (const mission of MISSIONS) {
      const id = mission.id;
      if (!(id in pending)) continue;
      merged[id] = Math.max(Number(stored[id]) || 0, Number(pending[id]) || 0);
    }
    return merged;
  }
  if (key === MISSION_RECORDS_KEY) {
    const merged = { ...stored };
    for (const mission of MISSIONS) {
      const id = mission.id, old = stored[id], added = pending[id];
      if (!added || typeof added !== 'object' || Array.isArray(added)) continue;
      const records = { ...(old && typeof old === 'object' && !Array.isArray(old) ? old : {}) };
      for (const [difficultyId] of RECORD_DIFFICULTIES) {
        const incoming = added[difficultyId];
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) continue;
        const nextSeconds = Number(incoming.seconds), previousSeconds = Number(records[difficultyId]?.seconds);
        if (!Number.isFinite(nextSeconds) || nextSeconds <= 0) return null;
        const seconds = Number.isFinite(previousSeconds) && previousSeconds > 0
          ? Math.min(previousSeconds, nextSeconds) : nextSeconds;
        records[difficultyId] = { ...incoming, seconds };
      }
      merged[id] = records;
    }
    return merged;
  }
  if (key === MISSION_MEDALS_KEY) {
    const merged = { ...stored };
    for (const mission of MISSIONS) {
      const id = mission.id, old = stored[id], added = pending[id];
      if (!added || typeof added !== 'object' || Array.isArray(added)) continue;
      const medal = { ...(old && typeof old === 'object' && !Array.isArray(old) ? old : {}) };
      const oldRank = difficultyRank(medal.best), newRank = difficultyRank(added.best);
      if (newRank > oldRank) medal.best = added.best;
      const challenges = { ...(medal.challenges && typeof medal.challenges === 'object' && !Array.isArray(medal.challenges) ? medal.challenges : {}) };
      const incoming = added.challenges && typeof added.challenges === 'object' && !Array.isArray(added.challenges) ? added.challenges : {};
      for (const difficultyId of CHALLENGE_DIFFICULTIES) if (incoming[difficultyId] === true) challenges[difficultyId] = true;
      if (Object.keys(challenges).length) medal.challenges = challenges;
      merged[id] = medal;
    }
    return merged;
  }
  if (key === CAMPAIGN_COSMETIC_KEY) {
    const merged = { ...stored };
    if (Object.prototype.hasOwnProperty.call(pending, 'equipped')) merged.equipped = pending.equipped;
    return merged;
  }
  return null;
}
function retryPendingCampaignWrite(key) {
  let raw;
  try { raw = localStorage.getItem(key); }
  catch {
    campaignReadFailures.add(key);
    campaignMemoryOnly.add(key);
    return campaignMemory.get(key) || {};
  }
  campaignReadFailures.delete(key);
  let stored = {};
  if (raw != null) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('formato inválido');
      const normalized = sanitizeCampaignObject(key, parsed);
      if (normalized.corrupted) rememberCampaignCorruption(key, raw);
      stored = normalized.data;
    } catch { rememberCampaignCorruption(key, raw); }
  }
  const pending = campaignMemory.get(key) || {};
  const merged = mergeCampaignObjects(key, stored, pending);
  if (!merged || campaignBackupFailures.has(key)) {
    campaignMemoryOnly.add(key);
    return pending;
  }
  campaignMemory.set(key, merged);
  try {
    localStorage.setItem(key, JSON.stringify(merged));
    campaignReadPendingWrites.delete(key);
    campaignMemoryOnly.delete(key);
    return merged;
  } catch {
    campaignMemoryOnly.add(key);
    return merged;
  }
}
const readCampaignObject = (key) => {
  // Após uma leitura falha, releia a base e combine apenas as ações monotônicas pendentes.
  if (campaignReadPendingWrites.has(key)) return retryPendingCampaignWrite(key);
  if (campaignCorruptKeys.has(key)) return campaignMemory.get(key) || {};
  if (campaignMemoryOnly.has(key) && !campaignReadFailures.has(key)) return campaignMemory.get(key) || {};
  let raw;
  try { raw = localStorage.getItem(key); }
  catch {
    campaignReadFailures.add(key);
    campaignMemoryOnly.add(key);
    return campaignMemory.get(key) || {};
  }
  // Uma leitura que falhou pode ser transitória. Tente novamente antes de
  // formar um save parcial; se já houve gravação pendente, o ramo acima mantém
  // o conteúdo original intacto em vez de sobrescrevê-lo.
  campaignReadFailures.delete(key);
  campaignMemoryOnly.delete(key);
  if (raw == null) { campaignMemory.set(key, {}); campaignMemoryOnly.delete(key); return {}; }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('formato inválido');
    const normalized = sanitizeCampaignObject(key, data);
    if (normalized.corrupted) rememberCampaignCorruption(key, raw);
    campaignMemory.set(key, normalized.data);
    return normalized.data;
  } catch {
    rememberCampaignCorruption(key, raw);
  }
  return campaignMemory.get(key) || {};
};
function rememberCampaignCorruption(key, raw) {
  campaignCorruptKeys.add(key);
  campaignCorruptRaw.set(key, raw);
  try { preserveCampaignBackup(key, raw); campaignBackupFailures.delete(key); }
  catch { campaignBackupFailures.add(key); }
  if (!campaignBackupFailures.has(key)) campaignCorruptRaw.delete(key);
}
const writeCampaignObject = (key, data) => {
  campaignMemory.set(key, data);
  if (campaignReadFailures.has(key)) {
    campaignReadPendingWrites.add(key);
    campaignMemoryOnly.add(key);   // não sobrescreve um save que não conseguiu ler
    return;
  }
  if (campaignReadPendingWrites.has(key)) {
    retryPendingCampaignWrite(key);
    return;
  }
  if (campaignBackupFailures.has(key)) {
    try {
      const raw = campaignCorruptRaw.get(key);
      if (typeof raw !== 'string') throw new Error('save corrompido sem cópia bruta');
      preserveCampaignBackup(key, raw);
      campaignCorruptRaw.delete(key);
      campaignBackupFailures.delete(key);
    } catch {
      campaignMemoryOnly.add(key);   // mantém o save original corrompido intacto enquanto o backup falhar
      return;
    }
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
    campaignMemoryOnly.delete(key);
  } catch {
    campaignMemoryOnly.add(key);
  }
};
const read = () => readCampaignObject(KEY);
function sanitizeCampaignObject(key, data) {
  const missionIds = new Set(MISSIONS.map((mission) => mission.id));
  // Recupera cada missão válida mesmo se um único campo estiver corrompido.
  // Campos desconhecidos ficam intactos para compatibilidade com versões futuras.
  const clean = { ...data };
  let corrupted = false;
  if (key === KEY) {
    for (const [id, stars] of Object.entries(data)) {
      if (missionIds.has(id) && (!Number.isInteger(stars) || stars < 0 || stars > 3)) {
        delete clean[id];
        corrupted = true;
      }
    }
  } else if (key === MISSION_RECORDS_KEY) {
    for (const [id, records] of Object.entries(data)) {
      if (!missionIds.has(id)) continue;
      if (!records || typeof records !== 'object' || Array.isArray(records)) { delete clean[id]; corrupted = true; continue; }
      const valid = { ...records };
      for (const [difficultyId] of RECORD_DIFFICULTIES) {
        if (!(difficultyId in records)) continue;
        const entry = records[difficultyId], seconds = Number(entry?.seconds);
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Number.isFinite(seconds) || seconds <= 0) {
          delete valid[difficultyId]; corrupted = true;
        } else valid[difficultyId] = { ...entry, seconds };
      }
      clean[id] = valid;
    }
  } else if (key === MISSION_MEDALS_KEY) {
    for (const [id, medal] of Object.entries(data)) {
      if (!missionIds.has(id)) continue;
      if (!medal || typeof medal !== 'object' || Array.isArray(medal)) { delete clean[id]; corrupted = true; continue; }
      const valid = { ...medal };
      if ('best' in medal && difficultyRank(medal.best) < 0) { delete valid.best; corrupted = true; }
      if ('challenges' in medal) {
        if (!medal.challenges || typeof medal.challenges !== 'object' || Array.isArray(medal.challenges)) {
          delete valid.challenges; corrupted = true;
        } else {
          const challenges = { ...medal.challenges };
          for (const difficultyId of CHALLENGE_DIFFICULTIES) {
            if (difficultyId in challenges && typeof challenges[difficultyId] !== 'boolean') { delete challenges[difficultyId]; corrupted = true; }
          }
          valid.challenges = challenges;
        }
      }
      clean[id] = valid;
    }
  } else if (key === CAMPAIGN_COSMETIC_KEY && 'equipped' in data && data.equipped !== null && typeof data.equipped !== 'string') {
    delete clean.equipped;
    corrupted = true;
  } else if (![KEY, MISSION_RECORDS_KEY, MISSION_MEDALS_KEY, CAMPAIGN_COSMETIC_KEY].includes(key)) {
    return { data, corrupted: false };
  }
  return { data: clean, corrupted };
}
const readMissionRecords = () => readCampaignObject(MISSION_RECORDS_KEY);
const formatMissionTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function formatMissionRecordTime(seconds) {
  const tenths = Math.max(0, Math.round(Number(seconds) * 10));
  const minutes = Math.floor(tenths / 600);
  const remainder = tenths % 600;
  return `${minutes}:${String(Math.floor(remainder / 10)).padStart(2, '0')}.${remainder % 10}`;
}

// Recordes separados por dificuldade deixam a comparação justa ao rejogar uma missão.
export function missionRecords(id) {
  const records = readMissionRecords()[id];
  if (!records || typeof records !== 'object' || Array.isArray(records)) return [];
  return RECORD_DIFFICULTIES.flatMap(([difficultyId, difficultyName]) => {
    const seconds = Number(records[difficultyId]?.seconds);
    return Number.isFinite(seconds) && seconds > 0
      ? [{ difficultyId, difficultyName, seconds, time: formatMissionRecordTime(seconds) }]
      : [];
  });
}

// Objetivos de duração fixa (ou, na horda, em que durar mais é melhor) não têm recorde de tempo.
const FIXED_TIME_GOALS = ['defend', 'breach', 'survive', 'hunt', 'endless'];
export const missionHasTimeRecord = (mission) => !!mission?.goal && !FIXED_TIME_GOALS.includes(mission.goal.type);

// Só uma vitória válida atualiza o recorde; tempos de teste e derrotas são descartados.
export function saveMissionRecord(id, result) {
  if (!missionHasTimeRecord(MISSIONS.find((mission) => mission.id === id)) || result?.won !== true) return false;
  const difficultyId = result.difficultyId;
  if (!RECORD_DIFFICULTIES.some(([known]) => known === difficultyId)) return false;
  const rawSeconds = Number(result.seconds);
  if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) return false;
  const seconds = Math.round(rawSeconds * 10) / 10;
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  const all = readMissionRecords();
  const records = all[id] && typeof all[id] === 'object' && !Array.isArray(all[id]) ? { ...all[id] } : {};
  const rawPrevious = Number(records[difficultyId]?.seconds);
  const previous = Number.isFinite(rawPrevious) ? Math.round(rawPrevious * 10) / 10 : rawPrevious;
  if (Number.isFinite(previous) && previous > 0 && seconds >= previous) return false;
  records[difficultyId] = { seconds };
  all[id] = records;
  writeCampaignObject(MISSION_RECORDS_KEY, all);
  return true;
}

// Medalha = dificuldade mais alta já vencida; desafio = 3 estrelas no Difícil e no Pesadelo.
// Fica à parte das estrelas: 3★ no Fácil continuam valendo 3★, a medalha só mostra o feito.
const readMissionMedals = () => readCampaignObject(MISSION_MEDALS_KEY);

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
  writeCampaignObject(MISSION_MEDALS_KEY, all);
  return { newBest, newChallenge };
}

// ?tudo=1 na URL libera todas as missões (para testar)
export const allOpen = () => { try { return new URLSearchParams(location.search).get('tudo') === '1'; } catch { return false; } };
export const starsOf = (id) => read()[id] || 0;
export const unlocked = (i) => i === 0 || allOpen() || starsOf(MISSIONS[i - 1].id) > 0 || starsOf(MISSIONS[i].id) > 0;   // saves antigos: missão nova no meio não bloqueia quem já tem estrelas
export const totalStars = () => MISSIONS.reduce((s, m) => s + starsOf(m.id), 0);

// Visuais novos pedem 1 estrela em cada arena; a migração preserva recompensas já conquistadas em saves antigos.
// É só aparência: o elenco continua inteiro disponível desde o começo.
export const CHAPTER_COSMETICS = [
  { id: 'vila', chapter: 'Capítulo I · Sinais na estrada', name: 'Estandarte da Vila', icon: '⚑', auraStyle: 'banner', color: 0x72d5ff },
  { id: 'ossos', chapter: 'Capítulo II · A marca de ossos', name: 'Marca de Ossos', icon: '☠', auraStyle: 'bones', color: 0xd9b27d },
  { id: 'veu', chapter: 'Capítulo III · O véu da morte', name: 'Halo do Véu', icon: '☽', auraStyle: 'crescent', color: 0xc798ff },
  { id: 'marcha', chapter: 'Capítulo IV · A marcha final', name: 'Brasão da Marcha', icon: '♜', auraStyle: 'crest', color: 0x65e1b0 },
  { id: 'trono', chapter: 'Capítulo V · Além do Castelo', name: 'Auréola do Trono', icon: '♛', auraStyle: 'crown', color: 0xffd66e },
  { id: 'coracao', chapter: 'Capítulo VI · O coração sombrio', name: 'Espiral do Eclipse', icon: '☼', auraStyle: 'nightmare', color: 0xb451d6 },
  { id: 'asas', chapter: 'Capítulo VII · Asas de osso', name: 'Asas do Dragão', icon: '☬', auraStyle: 'wings', color: 0x7dffd0 },
];
export const CHALLENGE_COSMETICS = [
  { id: 'vanguarda', chapter: 'Desafio 3★ · Difícil', name: 'Halo da Vanguarda', icon: '✹', auraStyle: 'vanguard', color: 0xffd36b, difficultyId: 'dificil', difficultyName: 'Difícil', track: 'challenge' },
  { id: 'pesadelo', chapter: 'Desafio 3★ · Pesadelo', name: 'Espiral do Pesadelo', icon: '☾', auraStyle: 'nightmare', color: 0xb882ff, difficultyId: 'pesadelo', difficultyName: 'Pesadelo', track: 'challenge' },
];
const CHAPTER_COSMETIC_RULE_VERSION = 2;
const CHAPTER_STICKY_RULE_VERSION = 1;
const CHALLENGE_MISSION_RULE_VERSION = 2;
const LEGACY_CHALLENGE_MISSIONS = ['vila', 'ponte', 'santuario', 'chamas', 'fazendas', 'lago', 'duelo', 'caca', 'resgate', 'ruinas', 'torre', 'lago-sombrio', 'cemiterio', 'horda', 'castelo', 'cripta', 'trono'];
// arenas exigidas pelos desafios em cada versão da regra (índice = versão gravada no save)
const CHALLENGE_SNAPSHOTS = [LEGACY_CHALLENGE_MISSIONS, [...LEGACY_CHALLENGE_MISSIONS, 'coracao-do-castelo']];
// Snapshot dos IDs exigidos quando o desbloqueio de capítulo ainda não era sticky.
// Permite reconhecer um save que só volta após novas arenas serem adicionadas.
const CHAPTER_STICKY_MIGRATION_MISSIONS = {
  vila: ['vila', 'ponte', 'santuario', 'chamas'],
  ossos: ['fazendas', 'lago', 'duelo'],
  veu: ['caca', 'resgate', 'ruinas'],
  marcha: ['torre', 'lago-sombrio', 'cemiterio', 'horda', 'castelo'],
  trono: ['cripta', 'trono'],
  coracao: ['coracao-do-castelo'],
};
export function campaignCosmetics() {
  const starsByMission = new Map(MISSIONS.map((mission) => [mission.id, starsOf(mission.id)]));
  const boundedStarsOf = (mission) => Math.max(0, Math.min(3, Number(starsByMission.get(mission.id)) || 0));
  const storedVisuals = readCampaignObject(CAMPAIGN_COSMETIC_KEY);
  const cosmeticIds = new Set([...CHAPTER_COSMETICS, ...CHALLENGE_COSMETICS].map((cosmetic) => cosmetic.id));
  let legacyUnlocked = Array.isArray(storedVisuals.legacyUnlocked) ? storedVisuals.legacyUnlocked.filter((id) => cosmeticIds.has(id)) : [];
  if (!(Number(storedVisuals.rulesVersion) >= CHAPTER_COSMETIC_RULE_VERSION)) {
    const previouslyUnlocked = CHAPTER_COSMETICS.filter((cosmetic) => {
      const missions = MISSIONS.filter((mission) => mission.chapter === cosmetic.chapter);
      const formerRequirement = Math.ceil(missions.length * 3 / 2);
      const formerStars = missions.reduce((sum, mission) => sum + boundedStarsOf(mission), 0);
      return missions.length > 0 && formerStars >= formerRequirement;
    }).map((cosmetic) => cosmetic.id);
    legacyUnlocked = [...new Set([...legacyUnlocked, ...previouslyUnlocked])];
    writeCampaignObject(CAMPAIGN_COSMETIC_KEY, { ...storedVisuals, rulesVersion: CHAPTER_COSMETIC_RULE_VERSION, legacyUnlocked });
  }
  if (!(Number(storedVisuals.chapterStickyRulesVersion) >= CHAPTER_STICKY_RULE_VERSION)) {
    const previouslyCompleted = CHAPTER_COSMETICS.filter((cosmetic) => {
      const missionIds = CHAPTER_STICKY_MIGRATION_MISSIONS[cosmetic.id] || [];
      return missionIds.length > 0 && missionIds.every((id) => Number(starsByMission.get(id)) > 0);
    }).map((cosmetic) => cosmetic.id);
    legacyUnlocked = [...new Set([...legacyUnlocked, ...previouslyCompleted])];
    writeCampaignObject(CAMPAIGN_COSMETIC_KEY, {
      ...readCampaignObject(CAMPAIGN_COSMETIC_KEY), chapterStickyRulesVersion: CHAPTER_STICKY_RULE_VERSION, legacyUnlocked,
    });
  }
  const savedMedals = readMissionMedals();
  if (!(Number(storedVisuals.challengeRulesVersion) >= CHALLENGE_MISSION_RULE_VERSION)) {
    const savedVersion = Math.max(0, Math.min(CHALLENGE_SNAPSHOTS.length - 1, Math.floor(Number(storedVisuals.challengeRulesVersion)) || 0));
    const previousChallengeMissions = CHALLENGE_SNAPSHOTS[savedVersion].map((id) => MISSIONS.find((mission) => mission.id === id)).filter(Boolean);
    const previousChallengeRewards = CHALLENGE_COSMETICS.filter((cosmetic) => {
      return previousChallengeMissions.length > 0
        && previousChallengeMissions.every((mission) => savedMedals[mission.id]?.challenges?.[cosmetic.difficultyId] === true);
    }).map((cosmetic) => cosmetic.id);
    legacyUnlocked = [...new Set([...legacyUnlocked, ...previousChallengeRewards])];
    writeCampaignObject(CAMPAIGN_COSMETIC_KEY, {
      ...readCampaignObject(CAMPAIGN_COSMETIC_KEY), challengeRulesVersion: CHALLENGE_MISSION_RULE_VERSION, legacyUnlocked,
    });
  }
  const chapters = CHAPTER_COSMETICS.map((cosmetic) => {
    const missions = MISSIONS.filter((mission) => mission.chapter === cosmetic.chapter);
    const maxStars = missions.length * 3;
    const stars = missions.reduce((sum, mission) => sum + boundedStarsOf(mission), 0);
    const completedArenas = missions.filter((mission) => Number(starsByMission.get(mission.id)) > 0).length;
    const pendingMissions = missions.filter((mission) => !(Number(starsByMission.get(mission.id)) > 0))
      .map(({ id, name }) => ({ id, name }));
    const requiredArenas = missions.length;
    const requiredStars = requiredArenas; // compatibilidade: uma estrela mínima por arena
    const currentChapterComplete = requiredArenas > 0 && completedArenas === requiredArenas;
    if (currentChapterComplete && !legacyUnlocked.includes(cosmetic.id)) {
      legacyUnlocked.push(cosmetic.id);
      writeCampaignObject(CAMPAIGN_COSMETIC_KEY, { ...readCampaignObject(CAMPAIGN_COSMETIC_KEY), rulesVersion: CHAPTER_COSMETIC_RULE_VERSION, legacyUnlocked });
    }
    const stickyUnlock = legacyUnlocked.includes(cosmetic.id);
    return { ...cosmetic, stars, maxStars, completedArenas, requiredArenas, requiredStars, pendingMissions,
      legacyEntitlement: stickyUnlock && !currentChapterComplete, unlocked: stickyUnlock || currentChapterComplete };
  });
  const challenges = CHALLENGE_COSMETICS.map((cosmetic) => {
    // As missões atuais entram no domínio 3★; a migração acima preserva quem já
    // havia concluído todas as arenas antes da chegada do Coração do Castelo.
    const challengeMissions = MISSIONS;
    const completedMissions = challengeMissions.filter((mission) => savedMedals[mission.id]?.challenges?.[cosmetic.difficultyId] === true);
    const completedArenas = completedMissions.length;
    const completedIds = new Set(completedMissions.map((mission) => mission.id));
    const pendingMissions = challengeMissions.filter((mission) => !completedIds.has(mission.id)).map(({ id, name }) => ({ id, name }));
    const requiredArenas = challengeMissions.length;
    const currentChallengeComplete = requiredArenas > 0 && completedArenas === requiredArenas;
    if (currentChallengeComplete && !legacyUnlocked.includes(cosmetic.id)) {
      legacyUnlocked.push(cosmetic.id);
      writeCampaignObject(CAMPAIGN_COSMETIC_KEY, { ...readCampaignObject(CAMPAIGN_COSMETIC_KEY), rulesVersion: CHAPTER_COSMETIC_RULE_VERSION, legacyUnlocked });
    }
    const stickyUnlock = legacyUnlocked.includes(cosmetic.id);
    return { ...cosmetic, stars: completedArenas, maxStars: requiredArenas, completedArenas, requiredArenas,
      requiredStars: requiredArenas, pendingMissions, legacyEntitlement: stickyUnlock && !currentChallengeComplete,
      unlocked: stickyUnlock || currentChallengeComplete };
  });
  return [...chapters, ...challenges];
}
export function equippedCampaignCosmetic(cosmetics = campaignCosmetics()) {
  const id = readCampaignObject(CAMPAIGN_COSMETIC_KEY).equipped;
  return cosmetics.find((cosmetic) => cosmetic.id === id && cosmetic.unlocked) || null;
}
export function equipCampaignCosmetic(id) {
  if (id == null) {
    writeCampaignObject(CAMPAIGN_COSMETIC_KEY, { ...readCampaignObject(CAMPAIGN_COSMETIC_KEY), equipped: null });
    return true;
  }
  if (!campaignCosmetics().some((cosmetic) => cosmetic.id === id && cosmetic.unlocked)) return false;
  writeCampaignObject(CAMPAIGN_COSMETIC_KEY, { ...readCampaignObject(CAMPAIGN_COSMETIC_KEY), equipped: id });
  return true;
}

// Todo o elenco fica disponível desde o início; estrelas continuam servindo para avaliar a campanha.
export const STARTERS = ['paladin', 'berserker', 'pyro', 'assassin'];
export const UNLOCKS = [];
export const starsToUnlock = () => 0;
export const variantOpen = () => true;

// Critérios cumulativos servem tanto para calcular estrelas quanto para
// explicar o resultado no fim da missão.
export function starConditions({ won, falls, hpRatio, goal, shrineRatio, villagerRatio, timeLeft, endlessTime, leaks, seconds }) {
  const completed = Boolean(won);
  const hpPercent = Math.floor(Math.max(0, Math.min(1, Number(hpRatio) || 0)) * 100);
  const fallCount = Math.max(0, Number(falls) || 0);
  const noFalls = completed && fallCount === 0;
  if (goal?.type === 'endless') {
    const seconds = Math.floor(Math.max(0, Number(endlessTime) || 0));
    return goal.marks.map((mark) => ({ label: `Aguentar ${mark} s (atual ${seconds} s)`, achieved: seconds >= mark }));
  }
  if (goal?.type === 'defend') {
    const shrineHp = Math.max(0, Math.min(1, Number(shrineRatio) || 0));
    const shrinePercent = Math.floor(shrineHp * 100);
    const shrineSafe = completed && shrineHp >= 0.5;
    return [
      { label: 'Defender o santuário até o fim', achieved: completed },
      { label: `Santuário com 50%+ de vida (atual ${shrinePercent}%)`, achieved: shrineSafe },
      { label: `Santuário 50%+ e sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'})`, achieved: shrineSafe && fallCount === 0 },
    ];
  }
  if (goal?.type === 'escort') {
    const escortHp = Math.max(0, Math.min(1, Number(villagerRatio) || 0));
    const escortPercent = Math.floor(escortHp * 100);
    return [
      { label: 'Concluir a escolta', achieved: completed },
      { label: `Aldeão com 50%+ de vida (atual ${escortPercent}%)`, achieved: completed && escortHp >= 0.5 },
      { label: `Aldeão com 75%+ de vida e sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'}; atual ${escortPercent}%)`, achieved: completed && escortHp >= 0.75 && fallCount === 0 },
    ];
  }
  if (goal?.type === 'rescue') {
    const rescuedHp = Math.max(0, Math.min(1, Number(villagerRatio) || 0));
    const rescuedPercent = Math.floor(rescuedHp * 100);
    return [
      { label: 'Concluir o resgate', achieved: completed },
      { label: `Pessoa resgatada com 50%+ de vida (atual ${rescuedPercent}%)`, achieved: completed && rescuedHp >= 0.5 },
      { label: `Pessoa resgatada com 75%+ de vida e sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'}; atual ${rescuedPercent}%)`, achieved: completed && rescuedHp >= 0.75 && fallCount === 0 },
    ];
  }
  if (goal?.type === 'hunt') {
    const left = Math.max(0, Number(timeLeft) || 0);
    return [
      { label: 'Abater o alvo marcado', achieved: completed },
      { label: `Sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'})`, achieved: noFalls },
      { label: `Sem quedas e com metade do tempo sobrando (${Math.floor(left)} s de ${goal.time} s)`, achieved: noFalls && left >= goal.time / 2 },
    ];
  }
  if (goal?.type === 'breach') {
    const passed = Math.max(0, Math.floor(Number(leaks) || 0));
    return [
      { label: 'Segurar a ponte', achieved: completed },
      { label: `No máximo 2 passaram (passaram ${passed})`, achieved: completed && passed <= 2 },
      { label: `Ninguém passou (passaram ${passed})`, achieved: completed && passed === 0 },
    ];
  }
  if (goal?.type === 'duel') {
    const time = Math.max(0, Number(seconds) || 0);
    const healthy = completed && hpRatio >= 0.4;
    return [
      { label: 'Vencer o duelo', achieved: completed },
      { label: `Terminar com 40%+ de vida (atual ${hpPercent}%)`, achieved: healthy },
      { label: `40%+ de vida e em até ${formatMissionTime(goal.time)} (${formatMissionTime(Math.ceil(time))})`, achieved: healthy && time <= goal.time },
    ];
  }
  if (goal?.type === 'twin' || goal?.type === 'bosses') {
    const bossCount = Math.max(1, Math.floor(Number(goal.bosses?.length) || 3));
    const objective = goal.type === 'twin' ? 'Derrotar o Lich e o Carrasco' : `Derrotar os ${bossCount} chefes`;
    return [
      { label: objective, achieved: completed },
      { label: `Terminar sem quedas (${fallCount} ${fallCount === 1 ? 'queda' : 'quedas'})`, achieved: noFalls },
      { label: `Sem quedas e com 50%+ de vida (atual ${hpPercent}%)`, achieved: noFalls && hpRatio >= 0.5 },
    ];
  }
  if (goal?.type === 'nofall') return [
    { label: 'Concluir a missão', achieved: completed },
    { label: `Sem quedas e com 75%+ de vida (atual ${hpPercent}%)`, achieved: noFalls && hpRatio >= 0.75 },
    { label: `Sem quedas e com 90%+ de vida (atual ${hpPercent}%)`, achieved: noFalls && hpRatio >= 0.9 },
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
  writeCampaignObject(KEY, all);
  return true;
}

// metas de estrela mostradas no mapa, conforme o objetivo
export function starTargetsFor(goal) {
  if (goal.type === 'nofall') return ['1★ Concluir a missão', '2★ Sem quedas e 75%+ de vida', '3★ Sem quedas e 90%+ de vida'];
  if (goal.type === 'escort') return ['1★ Concluir a escolta', '2★ Aldeão com 50%+ de vida', '3★ Aldeão com 75%+ de vida e sem quedas'];
  if (goal.type === 'rescue') return ['1★ Concluir o resgate', '2★ Pessoa resgatada com 50%+ de vida', '3★ Pessoa resgatada com 75%+ de vida e sem quedas'];
  if (goal.type === 'endless') return goal.marks.map((mark, i) => `${i + 1}★ Aguentar ${mark} s`);
  if (goal.type === 'defend') return ['1★ Defender o santuário', '2★ Santuário com 50%+ de vida', '3★ Santuário 50%+ e sem quedas'];
  if (goal.type === 'hunt') return ['1★ Abater o alvo', '2★ Sem quedas', '3★ Sem quedas e metade do tempo sobrando'];
  if (goal.type === 'breach') return ['1★ Segurar a ponte', '2★ No máximo 2 passam', '3★ Ninguém passa'];
  if (goal.type === 'duel') return ['1★ Vencer o duelo', '2★ 40%+ de vida', `3★ 40%+ de vida em até ${formatMissionTime(goal.time)}`];
  if (goal.type === 'twin') return ['1★ Derrotar o Lich e o Carrasco', '2★ Terminar sem quedas', '3★ Sem quedas e com 50%+ de vida'];
  if (goal.type === 'bosses') {
    const bossCount = Math.max(1, Math.floor(Number(goal.bosses?.length) || 3));
    return [`1★ Derrotar os ${bossCount} chefes`, '2★ Terminar sem quedas', '3★ Sem quedas e com 50%+ de vida'];
  }
  return ['1★ Concluir a missão', '2★ Sem quedas', '3★ Sem quedas e 50%+ de vida'];
}

const attr = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// `tips`: critério de cada estrela, mostrado como dica sob demanda
const starRow = (n, size = '', tips = null) => `<span class="stars ${size}"${tips ? ` role="img" aria-label="${n} de 3 estrelas. ${attr(tips.join('. '))}"` : ''}>${[1, 2, 3].map((k) => `<i class="${k <= n ? 'on' : ''}"${tips ? ` data-tip="${attr(tips[k - 1])}"` : ''}>★</i>`).join('')}</span>`;
// selo da melhor dificuldade vencida (inicial da dificuldade); brilha com algum desafio cumprido
const medalSeal = (medal, tip = '') => medal.best
  ? `<span class="camp-seal seal-${medal.best.difficultyId}${medal.challenges.some((c) => c.done) ? ' challenge' : ''}"${tip ? ` data-tip="${attr(tip)}" tabindex="0" aria-label="${attr(tip)}"` : ' aria-hidden="true"'}>${medal.best.difficultyName[0]}</span>`
  : '';
// DarkKnight só é chefe no Coração do Castelo (goal.bosses); nas outras arenas é inimigo comum
const BOSSES = ['King', 'Executioner', 'Lich', 'Golem', 'BoneDragon'];

// Mapa da campanha: a estrada serpenteia de baixo (z = 0) para cima (z negativo, rumo ao castelo).
// As posições saem da ordem das missões e dos capítulos; uma missão nova só alonga a estrada.
export const CAMPAIGN_ROAD = { amplitude: 6, wavelength: 30, step: 6.5, chapterGap: 3.5, start: 3, end: 10 };
export const campaignRoadX = (z, road = CAMPAIGN_ROAD) => road.amplitude * Math.sin(-z / road.wavelength * Math.PI * 2);
export function campaignMapLayout(missions = MISSIONS, road = CAMPAIGN_ROAD) {
  const chapters = [];
  const marks = [];
  let s = road.start, last = -1;
  missions.forEach((m, i) => {
    let chapter = chapters.indexOf(m.chapter);
    if (chapter < 0) chapter = chapters.push(m.chapter) - 1;
    if (i > 0) s += road.step + (chapter !== last ? road.chapterGap : 0);
    last = chapter;
    marks.push({ s, chapter });
  });
  const length = s + road.end;
  // amostras da estrada por comprimento de arco (z sempre diminui)
  const samples = [{ x: campaignRoadX(0, road), z: 0, s: 0 }];
  while (samples.at(-1).s < length) {
    const a = samples.at(-1), z = a.z - 0.2, x = campaignRoadX(z, road);
    samples.push({ x, z, s: a.s + Math.hypot(x - a.x, z - a.z) });
  }
  let k = 0;
  const nodes = marks.map(({ s: at, chapter }) => {
    while (samples[k + 1].s < at) k++;
    const a = samples[k], b = samples[k + 1], t = (at - a.s) / (b.s - a.s || 1);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, s: at, chapter };
  });
  const regions = chapters.map((name, index) => {
    const own = nodes.filter((n) => n.chapter === index);
    return { name, index, from: Math.min(...own.map((n) => n.s)), to: Math.max(...own.map((n) => n.s)) };
  });
  // mapa plano (sem WebGL): zigue-zague de três por linha, da base (94%) ao topo (6%)
  const rows = Math.max(1, Math.ceil(nodes.length / 3) - 1);
  nodes.forEach((n, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    n.left = row % 2 ? 80 - 30 * col : 20 + 30 * col;
    n.top = +(94 - 88 * row / rows).toFixed(2);
  });
  return { nodes, road: samples, regions, length };
}

// "Capítulo IV · ..." → "IV"; sem algarismo romano no nome, usa a posição
const chapterNumeral = (name, index) => /Cap[ií]tulo\s+([IVXLC]+)\b/.exec(name)?.[1] || String(index + 1);

// desenha o mapa dentro de `root`; onPlay(missão) quando o jogador confirma
// mountMap(mapa, dados), opcional, desenha o mapa 3D e devolve { select(i) }; sem ele fica o mapa plano
export function renderCampaign(root, onPlay, mapBiome = null, getThreats = null, storageWarning = '', getTeamRecommendation = null, mountMap = null) {
  const total = totalStars();
  const cosmetics = campaignCosmetics();
  const cleared = MISSIONS.every((m) => starsOf(m.id) > 0);
  let sel = MISSIONS.findIndex((_, i) => unlocked(i) && starsOf(MISSIONS[i].id) === 0);
  if (sel < 0) sel = cleared ? MISSIONS.length - 1 : 0;
  const remainingStars = MISSIONS.length * 3 - total;
  const replayTargetIndex = cleared ? MISSIONS.findIndex((m) => starsOf(m.id) < 3) : -1;
  const layout = campaignMapLayout(MISSIONS);
  const remainingText = `${remainingStars} estrela${remainingStars === 1 ? '' : 's'}`;
  const remainingLabel = `${remainingText} ${remainingStars === 1 ? 'restante' : 'restantes'}`;
  root.innerHTML = `
    <div class="camp-head">
      <span class="camp-title"><span class="camp-crown" aria-hidden="true">♛</span>Campanha</span>
      <nav class="camp-chapters" aria-label="Capítulos">${layout.regions.map((r, k) => {
        const first = MISSIONS.findIndex((m) => m.chapter === r.name);
        return `<button type="button" class="camp-chap${unlocked(first) ? '' : ' locked'}" data-tip="${attr(r.name)}" aria-label="${attr(r.name)}">${chapterNumeral(r.name, k)}</button>`;
      }).join('')}</nav>
      <span class="camp-progress" role="progressbar" aria-label="Estrelas da campanha" aria-valuemin="0" aria-valuemax="${MISSIONS.length * 3}" aria-valuenow="${total}">
        <i aria-hidden="true">★</i><b>${total}</b><span>/${MISSIONS.length * 3}</span>
      </span>
    </div>
    ${storageWarning ? `<div class="storage-warning" role="status">${attr(storageWarning)}</div>` : ''}
    <div class="camp-body">
      <div class="camp-map"><svg class="camp-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M ${layout.nodes.map((n) => `${n.left} ${n.top}`).join(' L ')}" /></svg></div>
      <aside class="camp-info" role="region" aria-label="Detalhes da missão selecionada"></aside>
    </div>`;
  const map = root.querySelector('.camp-map'), info = root.querySelector('.camp-info');
  const announcement = document.createElement('span');
  announcement.className = 'camp-announcement';
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  root.appendChild(announcement);
  const next = MISSIONS.findIndex((m, i) => unlocked(i) && starsOf(m.id) === 0);   // próxima disponível: pulsa no mapa
  const nodes = MISSIONS.map((m, i) => {
    const b = document.createElement('button');
    const open = unlocked(i), stars = starsOf(m.id), medal = missionMedal(m.id);
    b.className = `camp-node${open ? '' : ' locked'}${stars ? ' done' : ''}${i === next ? ' next' : ''}`;
    b.style.left = layout.nodes[i].left + '%';
    b.style.top = layout.nodes[i].top + '%';
    b.setAttribute('data-tip', `${i + 1}. ${m.name}`);
    b.setAttribute('aria-label', `${i + 1}. ${m.name}. ${goalText(m.goal)}. ${open ? `${stars} de 3 estrelas.${medal.best ? ` Melhor vitória: ${medal.best.difficultyName}.` : ''}` : `Bloqueada. Conclua ${MISSIONS[i - 1].name} com pelo menos uma estrela para liberar.`}`);
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="medal">${open ? m.icon : '\u{1F512}︎'}</span><span class="num">${i + 1}</span>${open ? starRow(stars, 'small') + medalSeal(medal) : ''}`;
    b.onclick = () => { if (sel !== i) select(i); };
    b.onfocus = () => { if (sel !== i) select(i); };
    b.ondblclick = () => play();
    map.appendChild(b);
    return b;
  });
  let mapView = null;
  try {
    mapView = typeof mountMap === 'function'
      ? mountMap(map, { layout, nodes, missions: MISSIONS, states: MISSIONS.map((m, i) => ({ open: unlocked(i), stars: starsOf(m.id), next: i === next })), selected: sel })
      : null;
  } catch (err) { console.warn('Mapa 3D indisponível', err); mapView = null; }   // sem WebGL: fica o mapa plano
  // faixa de capítulos: um clique pula para a primeira missão ainda sem estrelas do capítulo (ou a primeira dele)
  const chapterButtons = Array.from(root.querySelectorAll?.('.camp-chap') || []);
  chapterButtons.forEach((b, k) => {
    const name = layout.regions[k]?.name;
    b.onclick = () => {
      const own = MISSIONS.map((m, i) => i).filter((i) => MISSIONS[i].chapter === name);
      const target = own.find((i) => unlocked(i) && starsOf(MISSIONS[i].id) === 0) ?? own[0];
      if (target !== undefined) select(target, true);
    };
  });
  // Painel enxuto: nome, objetivo, estrelas e ameaças à vista; história, plano, trecho, medalha e recordes ficam nas dicas.
  function select(i, moveFocus = false, focusPlay = false) {
    sel = i;
    nodes.forEach((n, k) => {
      n.classList.toggle('sel', k === i);
      n.setAttribute('aria-pressed', String(k === i));
    });
    mapView?.select?.(i);
    chapterButtons.forEach((b, k) => b.classList?.toggle('sel', layout.regions[k]?.name === MISSIONS[i].chapter));
    const m = MISSIONS[i], open = unlocked(i);
    const stars = starsOf(m.id);
    const biome = typeof mapBiome === 'function' ? mapBiome(m) : '';
    const threats = typeof getThreats === 'function' ? getThreats(m) : [];
    const teamRecommendation = typeof getTeamRecommendation === 'function' ? getTeamRecommendation(m) : '';
    const records = missionHasTimeRecord(m) ? missionRecords(m.id) : [];
    const medal = missionMedal(m.id);
    const chapterReward = cosmetics.find((cosmetic) => cosmetic.chapter === m.chapter);
    const rewardTarget = Math.max(1, Number(chapterReward?.requiredArenas) || 1);
    const rewardProgress = chapterReward?.completedArenas;
    const rewardValue = Math.min(rewardTarget, Number(rewardProgress) || 0);
    const rewardPercent = Math.round(rewardValue / rewardTarget * 100);
    const rewardRemaining = Math.max(0, Number(chapterReward?.requiredArenas) - Number(chapterReward?.completedArenas));
    const rewardLabel = chapterReward
      ? `${chapterReward.name}: ${chapterReward.unlocked ? `desbloqueado, ${chapterReward.completedArenas} de ${chapterReward.requiredArenas} arenas concluídas, ${chapterReward.stars} de ${chapterReward.maxStars} estrelas do capítulo${chapterReward.legacyEntitlement ? '; desbloqueio anterior preservado apesar das arenas novas' : ''}` : `${chapterReward.completedArenas} de ${chapterReward.requiredArenas} arenas concluídas; faltam ${rewardRemaining} arena${rewardRemaining === 1 ? '' : 's'} para desbloquear`}`
      : '';
    const mapLabel = typeof biome === 'string' && biome.trim() ? biome.trim().toUpperCase() : 'MAPA ALEATÓRIO';
    announcement.textContent = `${i + 1}. ${m.name}. ${m.chapter}. Objetivo: ${goalText(m.goal)}. ${open ? `${stars} de 3 estrelas.` : `Bloqueada. Conclua ${MISSIONS[i - 1].name} com pelo menos uma estrela para liberar.`}`;
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
          <div class="camp-chapter-label">${attr(m.chapter)}</div>
          <div class="camp-name" data-tip="${attr(`Arena ${i + 1} · ${mapLabel[0]}${mapLabel.slice(1).toLowerCase()} · ${squad} · ${m.desc}`)}" tabindex="0" aria-label="${attr(`${m.name}. Arena ${i + 1}, ${mapLabel.toLowerCase()}. ${squad}. ${m.desc} ${m.story}`)}">${m.name}</div>
        </div>
      </div>
      <div class="camp-score">${starRow(stars, 'big', starTargetsFor(m.goal))}${medalSeal(medal, medalTip)}${best ? `<span class="camp-record" data-tip="${attr(recordTip)}" tabindex="0" aria-label="${attr(recordTip)}"><i aria-hidden="true">⏱</i>${best.time}</span>` : ''}</div>
      ${chapterReward ? `<div class="camp-chapter-reward" data-tip="${attr(`Visual do capítulo · ${chapterReward.legacyEntitlement ? 'Desbloqueado anteriormente · recompensa preservada' : chapterReward.unlocked ? `Desbloqueado · ${chapterReward.stars}/${chapterReward.maxStars} estrelas do capítulo` : `${chapterReward.completedArenas} de ${chapterReward.requiredArenas} arenas concluídas · faltam ${rewardRemaining} arena${rewardRemaining === 1 ? '' : 's'}`}`)}" style="--chapter-color:#${chapterReward.color.toString(16).padStart(6, '0')}">
        <div class="camp-chapter-reward-head">
          <span class="camp-chapter-reward-icon" aria-hidden="true">${chapterReward.icon}</span>
          <span class="camp-chapter-reward-copy"><b>${attr(chapterReward.name)}</b></span>
          <strong>${chapterReward.unlocked ? `${chapterReward.stars}/${chapterReward.maxStars} ★` : `${chapterReward.completedArenas}/${chapterReward.requiredArenas} arenas`}</strong>
        </div>
        <div class="camp-chapter-track" role="progressbar" aria-label="${attr(rewardLabel)}" aria-valuemin="0" aria-valuemax="${rewardTarget}" aria-valuenow="${rewardValue}"><i style="width:${rewardPercent}%"></i></div>
      </div>` : ''}
      <div class="camp-goal" data-tip="${attr(m.tip)}" tabindex="0" aria-label="Objetivo: ${attr(goalText(m.goal))}. Plano de batalha: ${attr(m.tip)}"><i aria-hidden="true">⚑</i>${goalText(m.goal)}</div>
      ${teamRecommendation ? `<div class="camp-team-tip" role="note" aria-label="${attr(teamRecommendation)}"><i aria-hidden="true">✦</i><span>${attr(teamRecommendation)}</span></div>` : ''}
      ${threats.length ? `<div class="camp-threats" role="list" aria-label="Inimigos especiais">${threats.map((threat) => {
        const tip = `${threat.name} · ${threatPhase(threat)} · ${threat.detail}`;
        return `<span role="listitem" class="camp-threat${threat.optional ? ' optional' : ''}${BOSSES.includes(threat.id) || m.goal.bosses?.includes(threat.id) ? ' boss' : ''}" data-tip="${attr(tip)}" tabindex="0" aria-label="${attr(tip)}">${threat.icon}</span>`;
      }).join('')}</div>` : ''}
      ${cleared ? `<div class="camp-complete" data-tip="${attr(completeTip)}" tabindex="0" aria-label="${attr(`${remainingStars ? 'Campanha concluída' : 'Campanha perfeita'}. ${completeTip}`)}"><b>${remainingStars ? 'Campanha concluída' : '♛ Campanha perfeita'}</b>${remainingStars ? `<span>★ ${remainingStars}</span>` : ''}</div>${showReplayButton ? `<button class="camp-replay-button" type="button" aria-label="Ver missão recomendada: ${attr(MISSIONS[replayTargetIndex].name)}">★ ${MISSIONS[replayTargetIndex].name}</button>` : ''}` : ''}
      ${open ? '' : `<div class="camp-unlock" aria-label="Como desbloquear: conclua ${attr(MISSIONS[i - 1].name)} com pelo menos uma estrela"><i aria-hidden="true">\u{1F512}︎</i>${MISSIONS[i - 1].name}</div>`}
      <button class="camp-play" ${open ? '' : 'disabled'}>${open ? 'Batalhar' : 'Bloqueada'}</button>`;
    info.querySelector('.camp-play').onclick = play;
    const replayButton = info.querySelector('.camp-replay-button');
    if (replayButton && showReplayButton) replayButton.onclick = () => select(replayTargetIndex, false, true);
    if (moveFocus) nodes[i].focus({ preventScroll: true });   // o mapa 3D desliza a câmera; o navegador não rola o recorte
    else if (focusPlay) info.querySelector('.camp-play')?.focus();
  }
  function play() { if (unlocked(sel)) onPlay(MISSIONS[sel]); }
  function key(e) {
    if (!root.isConnected || root.closest('.hidden')) return;
    const active = document.activeElement;
    const onNode = active?.classList?.contains('camp-node');
    const onMap = onNode || active === document.body || active === map || active?.classList?.contains('camp-chap');
    const k = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if ((k === 'ArrowUp' || k === 'ArrowRight' || k === 'd') && onMap) select(Math.min(MISSIONS.length - 1, sel + 1), true);
    else if ((k === 'ArrowDown' || k === 'ArrowLeft' || k === 'a') && onMap) select(Math.max(0, sel - 1), true);
    else if (e.key === 'Enter' && (onNode || active === document.body || active === map)) play();
    else return;
    e.preventDefault();
  }
  removeEventListener('keydown', renderCampaign.key || (() => {}));
  renderCampaign.key = key;
  addEventListener('keydown', key);
  select(sel);
}
