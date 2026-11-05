import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWorld, biomeForSeed, preloadSceneryAssets } from './world.js';
import { CHARACTERS, CHARACTER_ASSETS, buildCharacter, applyLook, buildBeast, animateBeast } from './characters.js';
import { LOOKS } from './looks.js';
import { HERO_ANIM_FILES, HERO_PROP_FILES, heroModelFile, attachHeroAnimations, HERO_HITS, HERO_DEATHS, HERO_DODGES } from './hero-anims.js';
import { CLASSES, heroInfo, teamCoverage, missionRoleNeeds, skillLevel, SKILL_LEVEL_CAP } from './class-info.js';
import { cooldownForSkill, skillSetFor } from './skillbook.js';
import { SKILL_KEYS, SKILL_GLYPHS } from './skill-ui.js';
import { aimSpec, validAim, findGroundAimHit } from './skill-targeting.js';
import { activeSynergies, damageSynergies, synergyDamageMultiplier, synergyDamageTakenMultiplier, synergyHealMultiplier, synergySummonHaste } from './synergies.js';
import { EVOLUTION_BRANCHES, applyEvolutionBranch, branchRankLimit, scaleBranchEffect } from './upgrade-branches.js';
import { buildBattleReport } from './battle-report.js';
import { PASSIVES, passiveReady, passiveHTML } from './passives.js';
import { newStats, openHeroPanel, closeHeroPanel, panelHero, tickHeroPanel, summaryHTML } from './stats.js';
import * as audio from './audio.js';
import { initTooltips, registerTooltip, hideTooltip } from './tooltip.js';
import { logoSVG } from './logo.js';
import { tutorial } from './tutorial.js';
import { MISSIONS, createCampaignMapSeedSession, goalText, starConditions, starsFor, saveStars, saveMissionRecord, saveMissionMedal, missionMedal, renderCampaign, totalStars, starsOf, unlocked, variantOpen, starsToUnlock, UNLOCKS, allOpen, campaignCosmetics, equippedCampaignCosmetic, equipCampaignCosmetic, formatMissionRecordTime, campaignStorageIsVolatile, campaignStorageWasCorrupted, campaignCorruptBackupFailed } from './campaign.js';
import { materialPool } from './fx-pool.js';
import { buildSummon } from './summon-models.js';
import { createPopTextPool } from './pop-text-pool.js';
import { createCampaignAura } from './campaign-aura.js';
import { mountCampaignMap3D } from './campaign-map3d.js';
import { disposeSkeletons, gridCellKey } from './scene-perf.js';
import { createProgression, renderCamp, rewardHTML, achievementChipsHTML, toastAchievements, GOLD, MASTERY_PERKS, UPGRADES } from './progression.js';
import { vfxMesh, spriteGeometry, radialSpriteGeometry, SPRITE, tickVfx, setVfxQuality, VFX_KINDS } from './vfx-shaders.js';
import { createLoadingScreen } from './loading.js';
import { createLowFpsMonitor } from './performance-warning.js';
import { MONSTER_TYPES, MONSTER_MATERIALS, linkMonsters, monsterDied, updateMonsterFx, clearMonsterFx, dangerAt, pickMonster, waveLeader, campaignThreats, missionBossPhase, nextBossPhase, applyBossMod, absorbWard, cleanseAround, pendingMonsterSummons } from './monsters.js';
import { HEROES, VARIANTS, PICK_GROUPS, POSTS, CASTLE_POSTS, SKELETONS, DIFFICULTIES } from './hero-roster.js';

const ROAD = 5;             // metade da largura da estrada
const PHASES = 12;          // a última fase fica no topo, no castelo
const MAX_PARTY = 4;
const LEASH = 5;            // quanto o herói se afasta do posto para lutar
const BREACH_INTERCEPT_RADIUS = 12; // ameaças comuns permanecem na zona próxima à ponte
const BREACH_RUNNER_INTERCEPT_RADIUS = 16; // corredores marcados ganham tempo extra para serem interceptados
const BREACH_SELF_DEFENSE_RADIUS = 4.5; // reação local sem puxar a formação para fora da ponte
const DEFEND_INTERCEPT_RADIUS = 12; // mantém os defensores perto do objetivo
const ENGAGE_SLACK = 3;     // folga extra para não largar um alvo já engajado (evita ir e voltar)
const ESCORT_GUARD_REACH = 10;   // escolta/resgate: o guarda ataca quem chega a esta distância do protegido
const ESCORT_HUNT_LIMIT = 16;    // escolta/resgate: os demais heróis não caçam além desta distância do protegido
const HERO_HUNT_RADIUS = 12; // arena visível em volta do grupo: caça curta sem arrastar a equipe
const RANGED_INTERCEPT = 26; // alcança atiradores estáticos no extremo do surgimento, sem perseguição pelo mapa
const RANGED_INTERCEPTORS = 2;
const PHASE_CLEANUP_INTERCEPT = 30; // até dois heróis limpam os últimos inimigos da onda antes da próxima fase
const PHASE_CLEANUP_INTERCEPTORS = 2;
const TWIN_BOSS_INTERCEPT = 16; // a equipe pressiona o chefe móvel dentro do alcance sem persegui-lo pelo mapa
const CASTLE_BOSS_INTERCEPT = 31; // diagonal do salão: todos perseguem dentro da arena, sem sair pelo mapa
const SHRINE_CLOSE = 8;   // santuário: inimigo a esta distância do cristal ganha prioridade extra
const DEFENSE_CLEANUP_INTERCEPT = 27; // depois do cronômetro, a equipe limpa fugitivos ainda no alcance da arena
const SHRINE_ENEMY_CAP = 5; // limita a pressão contínua contra uma equipe inicial de dois heróis
const MARCH = 2.4;          // velocidade do grupo andando pela estrada entre as fases
const HERO_HIT_ACTION_LOCK = 0.32; // reação ao golpe continua visível sem congelar a IA por toda a animação

// A classe fornece os atributos básicos; os postos são distribuídos ao entrar.
const variantsOf = (classId) => VARIANTS.filter((v) => v.classId === classId);
const pickGroupId = (cfg) => PICK_GROUPS.find((group) => group.heroes.includes(cfg.id))?.id;
const variantsInPickGroup = (groupId) => (PICK_GROUPS.find((group) => group.id === groupId)?.heroes || [])
  .map((id) => VARIANTS.find((cfg) => cfg.id === id)).filter(Boolean);
const pickGroupIndex = (cfg) => PICK_GROUPS.findIndex((group) => group.id === pickGroupId(cfg));
// XP acumulado para Nv2…Nv5; os degraus crescem (90, 260, 450, 600) porque a equipe da campanha leva o XP entre missões
// Menor distância entre dois POSTS (frente ↔ lado). Com corpos grandes (Brutamontes, nível 3) os postos abrem
// para que vizinhos parados não fiquem dentro da separação e se empurrem sem parar.
const POST_GAP = Math.hypot(1.7, 1.2);
function formationSpread() {
  let a = 1, b = 1;   // os dois maiores corpos vivos do grupo
  for (const h of heroes()) if (!h.dead) { const s = h.size || 1; if (s > a) { b = a; a = s; } else if (s > b) b = s; }
  return Math.max(1, (UNIT_SEPARATION_FACTOR * (a + b) + 0.15) / POST_GAP);
}
const XP_LEVELS = [0, 90, 600, 1600, 2700];
const MAX_HERO_LEVEL = XP_LEVELS.length;
const levelGain = (level) => level >= 4 ? 1.15 : 1.1;   // vida e dano por nível: +10% até o Nv3, +15% no Nv4 e Nv5
// só há 3 retratos/nomes por herói: Nv4 e Nv5 usam os do Nv3 com selo próprio (prata no 4, ouro no 5)
const artLevel = (level) => Math.min(level, 3);
const heroLevelName = (cfg, level) => cfg.names?.[artLevel(level) - 1] || cfg.name;
const heroLevelPortrait = (cfg, level) => cfg.portraits?.[artLevel(level) - 1] || cfg.portrait || '';
const levelTierClass = (level) => level > 3 ? `tier-${Math.min(level, MAX_HERO_LEVEL)}` : '';

const DIFFICULTY_PICK_HINT = '';   // ← → · Enter · Esc seguem valendo, sem rodapé fixo
const nightmareTeamIds = (mission, partySize = mission?.heroes) => {
  const goal = mission?.goal?.type;
  if (partySize === 1) return ['paladin'];
  if (partySize === 2) {
    if (goal === 'breach') return ['paladin', 'viking'];
    if (['defend', 'escort', 'rescue'].includes(goal)) return ['paladin', 'guardian'];
    if (goal === 'boss') return ['paladin', 'viking'];
    return ['paladin', 'pyro'];
  }
  if (partySize === 3) {
    if (goal === 'hunt') return ['paladin', 'guardian', 'viking'];
    if (goal === 'totems') return ['paladin', 'pyro', 'cleric'];
    if (goal === 'rescue') return ['paladin', 'guardian', 'angel'];
    return ['paladin', 'guardian', 'pyro'];
  }
  if (goal === 'breach') return ['paladin', 'guardian', 'viking', 'cleric'];
  if (goal === 'rescue') return ['paladin', 'guardian', 'angel', 'pyro'];
  if (goal === 'totems') return ['paladin', 'pyro', 'cleric', 'guardian'];
  if (['defend', 'escort'].includes(goal)) return ['paladin', 'guardian', 'pyro', 'cleric'];
  if (goal === 'elite') return ['paladin', 'guardian', 'pyro', 'viking'];
  if (goal === 'twin' || mission?.id === 'castelo' || mission?.boss?.kind === 'BoneDragon') return ['paladin', 'guardian', 'archer', 'cleric'];   // o dragão voa: só ataque à distância o alcança
  if (goal === 'hunt') return ['paladin', 'guardian', 'viking', 'cleric'];
  if (goal === 'boss' || goal === 'bosses') return ['paladin', 'guardian', 'viking', 'cleric'];
  return ['paladin', 'guardian', 'pyro', 'cleric'];
};
// Mantém uma sugestão para as escolhas iniciais e indica quem completar depois nas missões longas.
const nightmareTeamPlanIds = (mission, partySize = mission?.heroes) => {
  const initial = nightmareTeamIds(mission, partySize);
  if (!mission || partySize === 1 || initial.length >= MAX_PARTY
    || (mission.from != null && mission.to != null && mission.from === mission.to)) return initial;
  const goal = mission.goal?.type;
  const reserves = partySize === 2
    ? goal === 'boss' ? ['guardian', 'cleric'] : ['cleric', 'pyro']
    : partySize === 3 && goal === 'rescue' ? ['pyro']
      : goal === 'hunt' ? ['cleric']
        : goal === 'totems' ? ['guardian']
          : ['cleric'];
  return [...initial, ...reserves.filter((id) => !initial.includes(id))].slice(0, MAX_PARTY);
};
const nextNightmareTeamId = (mission) => {
  const selected = new Set(heroes().map((hero) => hero.cfg.id));
  return nightmareTeamPlanIds(mission, missionPartySize(mission)).find((id) => !selected.has(id)) || null;
};
const TEAM_RECOMMENDATION_GOALS = new Set(['boss', 'duel', 'twin', 'bosses', 'totems', 'defend', 'breach', 'nofall', 'endless']);
const shouldRecommendMissionTeam = (mission, difficultyId = difficulty.id) => difficultyId === 'pesadelo'
  || Boolean(mission && TEAM_RECOMMENDATION_GOALS.has(mission.goal?.type));
const difficultyTeamRecommendation = (option, mission, partySize = mission?.heroes) => {
  if (!shouldRecommendMissionTeam(mission, option.id)) return '';
  const nightmare = option.id === 'pesadelo';
  const labels = { paladin: 'Paladino (cura)', guardian: 'Guardião (proteção)', pyro: 'Piromante (dano em área)', viking: 'Viking (dano a chefe)', archer: 'Arqueira (dano à distância)', cleric: 'Clériga (suporte/cura)', angel: 'Anjo (dano e cura)' };
  if (mission?.goal?.type === 'breach') labels.viking = 'Viking (machado à distância)';
  const initial = nightmareTeamIds(mission, partySize).map((id) => labels[id]);
  const plan = nightmareTeamPlanIds(mission, partySize).map((id) => labels[id]);
  const list = (team) => team.length === 1 ? team[0]
    : team.length === 2 ? `${team[0]} e ${team[1]}`
    : team.length === 3 ? `${team[0]}, ${team[1]} e ${team[2]}`
      : `${team.slice(0, -1).join(', ')} e ${team.at(-1)}`;
  if (initial.length === 1) return mission?.goal?.type === 'duel'
    ? 'Duelo (1 herói): escolha Paladino (cura) para sustentar a luta sozinho.'
    : 'Equipe para 1 herói: Paladino (cura) para sustentar a missão sozinho.';
  const reserves = plan.slice(initial.length);
  const opening = mission ? `${nightmare && reserves.length ? 'Equipe inicial' : 'Equipe recomendada'} para ${initial.length} heróis: ${list(initial)}.`
    : `Equipe para ${initial.length} heróis: ${list(initial)}.`;
  const reserveLabel = nightmare
    ? reserves.length === 1 ? 'Reforço sugerido' : 'Reforços sugeridos'
    : reserves.length === 1 ? 'Reforço recomendado' : 'Reforços recomendados';
  return reserves.length ? `${opening} ${reserveLabel}: ${list(reserves)}.` : opening;
};
let difficulty = DIFFICULTIES[1];

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // acima de 1,5 o custo de pixel cresce sem ganho visível
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9d6f0);
scene.fog = new THREE.Fog(0xa9d6f0, 45, 110);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI * 0.45;
controls.minDistance = 8;
controls.maxDistance = 50;
const follow = new THREE.Vector3();   // ponto que a câmera persegue
// zoom cinematográfico: multiplica a distância escolhida pelo jogador (roda do mouse) conforme a situação
const cam = { zoom: 1, userDist: 0, fit: 0, manual: false };
// o OrbitControls aplica a roda já no evento (registrado antes deste): guarda a distância aqui mesmo,
// antes que o followParty do próximo quadro a sobrescreva com o userDist antigo
renderer.domElement.addEventListener('wheel', () => {
  if (!controls.enabled || !controls.enableZoom) return;
  cam.userDist = camera.position.distanceTo(controls.target) / cam.zoom;
  cam.manual = true;
}, { passive: true });

const hemi = new THREE.HemisphereLight(0xfff4dc, 0xa89868, 1.8);   // sombras mais suaves
scene.add(hemi);
// céu, névoa e luz de dia e nas terras do necromante (misturados pela "trevas" de onde o grupo está)
const SKY = [new THREE.Color(0x7cc6ff), new THREE.Color(0x3f3552)];   // azul vivo de dia (estilo Clash)
const HEMI = [new THREE.Color(0xfff4dc), new THREE.Color(0xb8a8d8)], HEMI_GROUND = [new THREE.Color(0xa89868), new THREE.Color(0x3e3448)];
const SUN = [new THREE.Color(0xffe2b8), new THREE.Color(0xc6a8ff)];
const daySky = new THREE.Color(), daySun = new THREE.Color();   // céu e sol de dia do bioma do mapa (world.sky/sunTint)
const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0005;
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
scene.add(sun, sun.target);

// qualidade gráfica (botão do HUD, salva no navegador): Baixa desliga as sombras; Alta usa mapa 1024².
const QUALITY_KEY = 'cavaleiros-graficos';
let lowQuality = false;
try { lowQuality = localStorage.getItem(QUALITY_KEY) === 'baixa'; } catch {}
function applyQuality() {
  renderer.setPixelRatio(lowQuality ? 1 : Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  sun.castShadow = !lowQuality;
  setVfxQuality(lowQuality);   // ruído mais simples nos shaders de efeito
  const button = document.getElementById('quality');
  button.textContent = `Gráficos: ${lowQuality ? 'baixa' : 'alta'}`;
  button.setAttribute('aria-pressed', String(lowQuality));
  button.setAttribute('data-tip', lowQuality ? 'Leves: sem sombras, resolução 1x' : 'Altos · sombras 1024 px; troque para leves se o jogo travar');
}
document.getElementById('quality').onclick = () => {
  lowQuality = !lowQuality;
  try { localStorage.setItem(QUALITY_KEY, lowQuality ? 'baixa' : 'alta'); } catch {}
  applyQuality();
};
applyQuality();

const lowFpsMonitor = createLowFpsMonitor();
const fpsHint = document.getElementById('fpsHint');
let fpsHintDismissed = false;
try { fpsHintDismissed = sessionStorage.getItem('cavaleiros-fps-hint-dismissed') === '1'; } catch {}
function dismissFpsHint() {
  fpsHint.hidden = true;
  fpsHintDismissed = true;
  try { sessionStorage.setItem('cavaleiros-fps-hint-dismissed', '1'); } catch {}
}
document.getElementById('fpsHintClose').onclick = dismissFpsHint;
document.getElementById('fpsHintLow').onclick = () => {
  if (!lowQuality) document.getElementById('quality').click();
  dismissFpsHint();
};

let world = createWorld(scene, ROAD, PHASES);

// ---------- interface ----------
const $ = (id) => document.getElementById(id);
const campaignMapSession = createCampaignMapSeedSession(MISSIONS);
const bars = $('bars');
let speed = 1;
// HUD: botões de ícone; o texto completo fica no aria-label e na dica
function paintSpeed() {
  $('speed').innerHTML = `⏩&#xFE0E;<small>${speed}x</small>`;
  $('speed').setAttribute('aria-label', `Velocidade ${speed}x`);
}
$('speed').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; paintSpeed(); };
$('autoEvolve').onclick = () => { setAutoEvolve(!autoEvolve); audio.play('click'); };
// Reiniciar no meio da partida pede confirmação; no menu ou no fim volta direto
$('restart').onclick = () => {
  closeHudMenu();
  if (!heroes().length || game.over || pick.open) return startGame();   // volta para o menu inicial
  confirmRestart.wasPaused = game.paused;
  game.paused = true;
  $('restartConfirm').hidden = false;
  $('restartNo').focus();
};
function confirmRestart(yes) {
  $('restartConfirm').hidden = true;
  if (yes) return startGame();
  game.paused = confirmRestart.wasPaused;
  $('restart').focus();
}
$('restartYes').onclick = () => confirmRestart(true);
$('restartNo').onclick = () => confirmRestart(false);

// pausa do jogador (botão, P ou Espaço); as pausas dos menus não passam por aqui
function setUserPause(on) {
  if (on === !!game.userPaused) return;
  if (on && (game.paused || game.over || pick.open || !heroes().length)) return;
  game.userPaused = on;
  game.paused = on;
  if (on && typeof directControl !== 'undefined') {
    clearDirectControlOrders();
  }
  $('pauseOverlay').hidden = !on;
  $('pause').setAttribute('aria-pressed', String(on));
  $('pause').textContent = on ? '▶\uFE0E' : '⏸\uFE0E';
  $('pause').setAttribute('aria-label', on ? 'Continuar (P ou Espaço)' : 'Pausar (P ou Espaço)');
  if (on) $('resume').focus();
  else if (document.activeElement === $('resume')) $('pause').focus();
}
$('pause').onclick = () => setUserPause(!game.userPaused);
$('resume').onclick = () => setUserPause(false);
addEventListener('keydown', (e) => {
  if (!$('restartConfirm').hidden) {
    if (e.key === 'Escape') { confirmRestart(false); e.stopImmediatePropagation(); }
    return;
  }
  const typing = e.target.closest?.('button, input, select, textarea, summary, [role="button"]');
  if (e.repeat || !(e.key === 'p' || e.key === 'P' || (e.key === ' ' && !typing))) return;
  if (!game.userPaused && (game.paused || game.over || pick.open || !heroes().length)) return;
  e.preventDefault();
  setUserPause(!game.userPaused);
});
// opções do HUD (evolução, gráficos, reiniciar) ficam no menu da engrenagem
function closeHudMenu() {
  $('hud').classList.remove('open');
  $('hudMenu').setAttribute('aria-expanded', 'false');
}
$('hudMenu').onclick = () => {
  const open = $('hud').classList.toggle('open');
  $('hudMenu').setAttribute('aria-expanded', String(open));
};
addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.hud-right')) closeHudMenu(); });
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !$('hud').classList.contains('open')) return;
  closeHudMenu();
  $('hudMenu').focus();
});
$('overlayBtn').onclick = () => startGame(game.mission ? 'map' : 'menu');   // na campanha volta para o mapa

function showBanner(text, seconds = 2) {
  const b = $('banner');
  b.textContent = text;
  b.style.opacity = 1;
  b.classList.remove('show');
  void b.offsetWidth;   // reinicia a animação de "pulo"
  b.classList.add('show');
  clearTimeout(showBanner.t);
  showBanner.t = setTimeout(() => (b.style.opacity = 0), seconds * 1000);
}

function setText(id, text) { const el = $(id); if (el.textContent !== text) el.textContent = text; }
// dica e nome acessível de um item do HUD, só quando mudam
const hudTips = new Map();
function setTip(id, text) {
  if (hudTips.get(id) === text) return;
  hudTips.set(id, text);
  $(id).setAttribute('data-tip', text);
  $(id).setAttribute('aria-label', text);
}
function paintDifficulty() {
  const el = $('level');
  el.textContent = difficulty.icon;
  el.style.setProperty('--c', difficulty.color[0]);
  el.style.setProperty('--cd', difficulty.color[1]);
  setTip('level', `Dificuldade: ${difficulty.name}`);
}
// objetivo compacto: ícone por tipo + barra + valor curto (o texto inteiro vai na dica)
const GOAL_ICONS = { escort: '⛨', rescue: '⚿', boss: '♛', bosses: '☼', survive: '⌛', totems: '♜', tower: '♜', nofall: '♥', timer: '⏱', defend: '✧', hunt: '◎', endless: '☾', win: '⚑', breach: '♨', duel: '⚔', elite: '✠', twin: '♛' };
function goalShort(text, percent) {
  if (/!$/.test(text) && !/\d/.test(text)) return '✓';
  const nofall = text.match(/^De pé\s+(\d+)\/(\d+)\s+·\s+quedas\s+(\d+)$/i);
  if (nofall) return `${nofall[1]}/${nofall[2]} · ${nofall[3]} ${nofall[3] === '1' ? 'queda' : 'quedas'}`;
  const standing = text.match(/(\d+)\s+de pé/);
  if (standing) return `${standing[1]} de pé`;
  const shrine = text.match(/^Santuário\s+(\d+%)\s+·\s+(.+)$/);
  if (shrine) return `${shrine[1]} · ${/^\d+:\d{2}$/.test(shrine[2]) ? shrine[2] : /limpe a onda/i.test(shrine[2]) ? 'limpe a onda' : 'final'}`;
  const breach = text.match(/^Passaram\s+(\d+\/\d+)\s+·\s+(\d+:\d{2})$/);
  if (breach) return `${breach[1]} · ${breach[2]}`;
  if (/limpe a onda/i.test(text)) return 'limpe a onda';
  return text.match(/\d+\s?%|\d+\/\d+|\d+:\d{2}|\d+ s/g)?.at(-1) || `${percent}%`;
}
let goalUiRoot = null, goalUiLabel = null, goalUiFill = null, goalUiPercent = -1, goalUiText = '';
function setGoalUI(text, progress) {
  const root = $('goal');
  if (root !== goalUiRoot) {
    root.innerHTML = '<span class="goal-label"></span><span class="goal-meter" aria-hidden="true"><i></i></span>';
    goalUiRoot = root;
    goalUiLabel = root.querySelector('.goal-label');
    goalUiFill = root.querySelector('.goal-meter i');
    goalUiPercent = -1; goalUiText = '';
    root.setAttribute('role', 'progressbar');
    root.setAttribute('aria-valuemin', '0');
    root.setAttribute('aria-valuemax', '100');
  }
  const percent = Math.round(THREE.MathUtils.clamp(progress, 0, 1) * 100);
  if (goalUiText !== text || percent !== goalUiPercent) {
    goalUiText = text;
    goalUiLabel.textContent = goalShort(text, percent);
    root.setAttribute('aria-label', `Objetivo da missão: ${text}`);
    root.setAttribute('aria-valuetext', text);
    root.setAttribute('data-tip', `Objetivo: ${text}`);
  }
  if (percent !== goalUiPercent) {
    goalUiPercent = percent;
    goalUiFill.style.width = `${percent}%`;
    root.setAttribute('aria-valuenow', String(percent));
  }
}

// tela de escolha estilo arcade: grade com uma linha por classe, todas as variantes à mostra
const pick = { options: [], cards: [], classFilters: [], classRows: [], activeClass: -1, suggestedId: null, sel: 0, open: false, timer: null };
const PICK_CLASS_GLYPHS = ['♜', '⚒', '✦', '☾', '⚕'];
const PICK_HERO_HINT = '';   // setas e Enter seguem valendo; o rodapé só mostra a recomendação
// papéis da equipe como ícones (o nome fica na dica e no aria-label)
const ROLE_GLYPHS = { Defesa: '⛨', Cura: '✚', Área: '✺', Controle: '❄', 'À distância': '➶', 'Dano a chefe': '☠' };
// atributos da ficha como ícones; o número exato vai para a dica
const STAT_GLYPHS = { Vida: '♥', Força: '⚔', Rapidez: '➤', Alcance: '◎' };

// subtítulo das escolhas: fora da tela, só na dica e no nome acessível do título
function setPickSub(sub) {
  $('pickSub').textContent = '';
  const title = $('pickTitle');
  if (sub) { title.setAttribute('data-tip', sub); title.setAttribute('aria-description', sub); }
  else { title.removeAttribute?.('data-tip'); title.removeAttribute?.('aria-description'); }
}

function showPick(title, sub) {
  pick.mode = 'hero';
  $('banner').style.opacity = 0;   // a faixa não pode ficar embaixo do título da escolha
  pick.options = PICK_GROUPS.flatMap((group) => variantsInPickGroup(group.id));   // cada aba temática ocupa sua própria grade
  $('pickHint').textContent = PICK_HERO_HINT;
  const previousSuggestion = game.mission && game.picksLeft > 0 && !game.test
    ? game.campaignSquadSuggestion?.[heroes().length]
    : null;
  const recommendedId = game.mission && shouldRecommendMissionTeam(game.mission)
    ? nextNightmareTeamId(game.mission)
    : null;
  pick.suggestedId = previousSuggestion;
  $('pickTitle').textContent = title;
  setPickSub(sub);
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.add('grid');
  const filters = document.createElement('div');
  filters.className = 'pick-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Filtrar heróis por classe');
  const rows = document.createElement('div');
  rows.className = 'pick-rows';
  pick.classFilters = [];
  pick.classRows = [];
  for (const [groupIndex, group] of PICK_GROUPS.entries()) {
    const variants = variantsInPickGroup(group.id);
    const count = variants.length;
    const color = variants[0]?.color?.[0] || '#8bb9e7';
    const inParty = variants.filter(isOwned).length;   // contador de quem já está no grupo nesta aba
    const filter = document.createElement('button');
    filter.type = 'button';
    filter.className = 'pick-filter';
    filter.setAttribute('aria-label', `${group.name}: ${count} herói${count === 1 ? '' : 's'}${inParty ? `, ${inParty} no grupo` : ''}`);
    filter.setAttribute('aria-pressed', 'false');
    filter.style.setProperty('--class-color', color);
    filter.innerHTML = `<i aria-hidden="true">${group.icon}</i><span>${group.name}</span>${inParty ? `<b class="pick-filter-count" aria-hidden="true">${inParty}</b>` : ''}`;
    filter.onclick = () => focusClass(groupIndex);
    filter.onfocus = () => focusClass(groupIndex);
    filters.appendChild(filter);
    pick.classFilters.push(filter);

    const row = document.createElement('div');
    row.className = 'pick-row';
    row.id = `pick-class-${group.id}`;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Heróis da categoria ${group.name}`);
    row.hidden = true;
    row.style.setProperty('--class-color', color);
    row.style.setProperty('--pick-cols', String(pickGridColumns(count)));
    rows.appendChild(row);
    pick.classRows.push(row);
  }
  const total = totalStars();
  pick.cards = pick.options.map((cfg, i) => {
    const owned = isOwned(cfg), open = variantOpen(cfg.id, total);
    const categoryName = PICK_GROUPS[pickGroupIndex(cfg)]?.name || HEROES[cfg.classId]?.name || 'Herói';
    const suggested = cfg.id === previousSuggestion && !owned && open;
    const recommended = cfg.id === recommendedId && !owned && open;
    const b = document.createElement('div');
    b.className = `${owned ? 'card owned' : open ? 'card' : 'card locked'}${suggested ? ' suggested' : ''}${recommended ? ' recommended' : ''}`;
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.setAttribute('aria-pressed', 'false');
    const recommendationLabel = difficulty.id === 'pesadelo' ? 'recomendado para Pesadelo nesta missão' : 'recomendado para esta missão';
    b.setAttribute('aria-label', `${cfg.name}, categoria ${categoryName}${suggested ? ' (sugestão da equipe anterior)' : owned ? ' (já está no grupo)' : open ? '' : ` (★ ${starsToUnlock(cfg.id)} para liberar)`}${recommended ? ` (${recommendationLabel})` : ''}`);
    b.setAttribute('aria-disabled', String(owned || !open));
    b.setAttribute('data-hero-id', cfg.id);
    b.style.setProperty('--c', cfg.color[0]);
    b.style.setProperty('--cd', cfg.color[1]);
    b.style.setProperty('--d', `${i * 30}ms`);
    const mastery = progress.mastery(cfg.id).level;
    if (mastery > 1) b.classList.add(`mastery-${mastery}`);
    b.innerHTML = `<div class="portrait"><img src="${cfg.portrait}" alt=""></div><div class="pick-card-copy"><div class="ribbon">${cfg.name}</div><small class="pick-card-role">${heroInfo(cfg).role}</small></div>${mastery > 1 ? `<span class="mastery-badge" aria-hidden="true">✦${mastery}</span>` : ''}${suggested ? '<span class="pick-suggestion">Equipe anterior</span>' : ''}${recommended ? '<span class="pick-recommendation">Recomendado</span>' : ''}${owned ? '<span class="seal">No grupo</span>' : ''}${open ? '' : `<span class="lock" aria-hidden="true">🔒 ★ ${starsToUnlock(cfg.id)}</span>`}`;
    b.onclick = () => selectCard(i);
    b.onfocus = () => selectCard(i);
    bindCard(b, i, false);   // herói só muda com clique: o mouse passando não troca a ficha
    pick.classRows[pickGroupIndex(cfg)].appendChild(b);
    return b;
  });
  pick.info = document.createElement('aside');
  pick.info.className = 'pick-info';
  pick.team = document.createElement('section');
  pick.team.className = 'pick-team-bar';
  pick.team.setAttribute('aria-label', 'Equipe e cobertura de papéis');
  list.append(filters, rows, pick.team, pick.info);
  const suggestedIndex = previousSuggestion ? pick.options.findIndex((cfg) => cfg.id === previousSuggestion && isFree(cfg)) : -1;
  const recommendedIndex = recommendedId ? pick.options.findIndex((cfg) => cfg.id === recommendedId && isFree(cfg)) : -1;
  selectCard(recommendedIndex >= 0 ? recommendedIndex : suggestedIndex >= 0 ? suggestedIndex : pick.options.findIndex(isFree));
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
  tutorial.on('pick', { missionId: game.mission?.id, card: () => pick.cards[pick.sel], button: () => document.querySelector('.hero-select-btn') });
}

const isOwned = (cfg) => heroes().some((h) => h.cfg.id === cfg.id);
const isFree = (cfg) => !isOwned(cfg) && variantOpen(cfg.id);   // pode entrar no grupo agora

const CAMPAIGN_SQUAD_KEY = 'cavaleiros-equipe-campanha';
function loadCampaignSquad() {
  try {
    const saved = JSON.parse(localStorage.getItem(CAMPAIGN_SQUAD_KEY));
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string' && VARIANTS.some((cfg) => cfg.id === id)).slice(0, MAX_PARTY) : [];
  } catch { return []; }
}
function rememberCampaignSquad() {
  if (!game.mission || game.test) return;
  const saved = loadCampaignSquad();
  heroes().slice(0, MAX_PARTY).forEach((hero, i) => { saved[i] = hero.cfg.id; });
  try { localStorage.setItem(CAMPAIGN_SQUAD_KEY, JSON.stringify(saved.slice(0, MAX_PARTY))); } catch {}
}

// Equipe contínua da campanha: cada herói leva XP e evoluções de uma missão para a outra.
// A composição grava ao começar a missão; XP e evoluções, só na vitória. Herói novo entra no nível de quem saiu (as evoluções ele escolhe).
const CAMPAIGN_TEAM_KEY = 'cavaleiros-time-campanha';
let campaignTeamRun = false;   // ligado pelo mapa e pela "Próxima"; simulações e atalhos seguem o grupo de cada missão
const campaignTeamMode = () => campaignTeamRun && !!game.mission && !game.test;
const missionPartySize = (m) => campaignTeamMode() ? (m.goal.type === 'duel' ? 1 : MAX_PARTY) : m.heroes;   // Duelo segue com um herói
const DUEL_PICK_PRIORITY = ['paladin', 'angel', 'cleric'];   // cura/sustento primeiro; opções validadas para o Rei
function duelPickIndex(team) {
  for (const id of DUEL_PICK_PRIORITY) {
    const index = team.findIndex((entry) => entry.id === id);
    if (index >= 0) return index;
  }
  return 0;
}
function loadCampaignTeam() {
  try {
    const saved = JSON.parse(localStorage.getItem(CAMPAIGN_TEAM_KEY));
    if (!Array.isArray(saved)) return [];
    const seen = new Set();
    return saved.filter((entry) => VARIANTS.some((cfg) => cfg.id === entry?.id) && !seen.has(entry.id) && seen.add(entry.id))
      .slice(0, MAX_PARTY)
      .map((entry) => ({ id: entry.id, xp: Math.max(0, Number(entry.xp) || 0), branches: Array.isArray(entry.branches) ? entry.branches.filter((id) => typeof id === 'string') : [] }));
  } catch { return []; }
}
// grava quem jogou (com XP e evoluções atuais) e mantém quem ficou de fora, como no Duelo
function storeCampaignTeam(party) {
  // rotas na ordem de reaplicar: primeiro cada uma, depois os 2º graus (o grau 2 só abre da 3ª evolução)
  const branchOrder = (ranks = {}) => [...Object.keys(ranks), ...Object.keys(ranks).filter((id) => ranks[id] > 1)];
  const played = party.map((h) => ({ id: h.cfg.id, xp: h.xp, branches: branchOrder(h.evolutionBranches) }));
  const saved = loadCampaignTeam();
  const team = played.length < MAX_PARTY && played.every((p) => saved.some((entry) => entry.id === p.id))
    ? saved.map((entry) => played.find((p) => p.id === entry.id) || entry)   // Duelo: só o campeão muda e a ordem fica
    : [...played, ...saved.filter((entry) => !played.some((p) => p.id === entry.id))].slice(0, MAX_PARTY);
  try { localStorage.setItem(CAMPAIGN_TEAM_KEY, JSON.stringify(team)); } catch {}
}
// herói da equipe volta com o XP e as mesmas evoluções escolhidas antes
function restoreCampaignHero(entry) {
  const h = new Hero(VARIANTS.find((cfg) => cfg.id === entry.id));
  arrangeParty();
  h.gainXp(entry.xp);
  const branches = [...entry.branches];
  while (evolutions.length) {
    const hero = evolutions.shift().hero;
    const id = branches.shift();   // ramo que não existe mais cai na escolha automática
    const option = EVOLUTION_BRANCHES.some((branch) => branch.id === id) ? { id } : chooseAutoEvolution(hero);
    if (option) applyUpgrade(hero, option);
  }
  return h;
}
const teamLevel = (xp) => XP_LEVELS.filter((need) => xp >= need).length;

// antes da missão: a equipe salva entra direto; clicar marca quem sai (no Duelo, escolhe quem luta)
function showTeam() {
  const m = game.mission, team = loadCampaignTeam(), duel = missionPartySize(m) === 1;
  if (!team.length) return showPick(pickTitle(), pickSub());   // primeira vez: monta a equipe
  pick.mode = 'team';
  pick.options = team;
  pick.swap = new Set();
  $('banner').style.opacity = 0;
  $('pickTitle').textContent = `${MISSIONS.indexOf(m) + 1}. ${m.name}`;
  // papéis que a missão pede e a equipe não cobre: aviso curto na dica do título
  const cfgs = team.map((entry) => VARIANTS.find((v) => v.id === entry.id));
  const covered = new Set(teamCoverage(cfgs).roles.filter((role) => role.count > 0).map((role) => role.name));
  const lacking = [...new Set([...missionRoleNeeds(m.goal), ...teamCoverage(cfgs).missing])].filter((role) => !covered.has(role));
  setPickSub(`${duel ? 'Escolha quem entra no duelo' : 'Clique em quem sai da equipe; quem entra herda o nível dele'}${lacking.length ? ` · Falta: ${lacking.join(', ')}` : ''}`);
  $('pickHint').textContent = '';
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  pick.cards = team.map((entry, i) => {
    const cfg = VARIANTS.find((v) => v.id === entry.id), level = teamLevel(entry.xp);
    const name = cfg.names?.[level - 1] || cfg.name;
    const b = document.createElement('div');
    b.className = 'card team-card';
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', teamCardLabel(entry));
    b.setAttribute('data-tip', duel ? 'Entra no duelo' : 'Trocar este herói');
    b.style.setProperty('--c', cfg.color[0]);
    b.style.setProperty('--cd', cfg.color[1]);
    b.style.setProperty('--d', `${i * 90}ms`);
    b.innerHTML = `<div class="portrait"><img src="${cfg.portraits?.[level - 1] || cfg.portrait}" alt=""></div><div class="ribbon">${name}</div><small class="pick-card-role">${heroInfo(cfg).role}</small><span class="team-level" aria-hidden="true">Nv${level}</span><span class="seal team-out" aria-hidden="true">Sai</span>`;
    b.onclick = () => confirmPick(i);
    b.onfocus = () => selectCard(i);
    bindCard(b, i);
    list.appendChild(b);
    return b;
  });
  if (!duel) {
    pick.teamGo = document.createElement('button');
    pick.teamGo.type = 'button';
    pick.teamGo.className = 'team-go';
    pick.teamGo.onclick = () => pick.open && startTeam();
    list.appendChild(pick.teamGo);
    paintTeamGo();
  }
  selectCard(duel ? duelPickIndex(team) : 0);
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}
function paintTeamGo() {
  const out = pick.swap.size;
  pick.teamGo.textContent = out ? `Trocar ${out} ▸` : 'Seguir ▸';
  pick.teamGo.setAttribute('aria-label', out ? `Trocar ${out} herói${out > 1 ? 's' : ''}` : 'Seguir com a equipe');
}
function confirmTeam(i) {
  const entry = pick.options[i];
  if (!entry) return;
  if (missionPartySize(game.mission) === 1) return startTeam([entry]);
  if (pick.swap.has(entry.id)) pick.swap.delete(entry.id);
  else pick.swap.add(entry.id);
  pick.cards[i].classList.toggle('out', pick.swap.has(entry.id));
  pick.cards[i].setAttribute('aria-label', teamCardLabel(entry));
  paintTeamGo();
}
function teamCardLabel(entry) {
  const cfg = VARIANTS.find((v) => v.id === entry.id), level = teamLevel(entry.xp);
  return `${cfg.names?.[level - 1] || cfg.name}, nível ${level}${pick.swap?.has(entry.id) ? ', sai da equipe' : ''}`;
}
function startTeam(members = pick.options.filter((entry) => !pick.swap.has(entry.id))) {
  pick.open = false;
  $('pick').classList.add('hidden');
  pick.leaving = missionPartySize(game.mission) === 1 ? [] : pick.options.filter((entry) => !members.includes(entry));   // quem sai: o nível dele passa a quem entra
  for (const entry of members) restoreCampaignHero(entry);
  game.picksLeft = missionPartySize(game.mission) - heroes().length;
  if (game.picksLeft > 0) return showPick(pickTitle(), pickSub());
  storeCampaignTeam(heroes());
  rememberCampaignSquad();
  startMission();
}

function setPickClass(groupIndex) {
  pick.activeClass = groupIndex;
  pick.classRows.forEach((row, i) => { row.hidden = i !== groupIndex; });
  pick.classFilters.forEach((button, i) => {
    const active = i === groupIndex;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function focusClass(groupIndex) {
  const groupId = PICK_GROUPS[groupIndex]?.id;
  const row = pick.options.map((cfg, i) => pickGroupId(cfg) === groupId ? i : -1).filter((i) => i >= 0);
  if (!row.length) return;
  const sameClass = pickGroupId(pick.options[pick.sel]) === groupId;
  const preferred = sameClass ? Math.max(0, row.indexOf(pick.sel)) : 0;
  const available = row.filter((i) => isFree(pick.options[i]));
  const choices = available.length ? available : row;
  const selected = choices.sort((a, b) => Math.abs(row.indexOf(a) - preferred) - Math.abs(row.indexOf(b) - preferred))[0];
  selectCard(selected);
}

// progressão entre partidas (ouro, maestria, oficina, conquistas); sem localStorage fica só na memória, zerada
const progress = createProgression(typeof localStorage === 'undefined' ? null : localStorage);

// habilidade automática ou manual, lembrada por variante quando der
const AUTO_KEY = 'cavaleiros-auto';
const AUTO_EVOLVE_KEY = 'cavaleiros-auto-evoluir';
let autoEvolve = loadAutoEvolve();
function loadAutoEvolve() {
  try { return localStorage.getItem(AUTO_EVOLVE_KEY) === 'true'; } catch { return false; }
}
function saveAutoEvolve() {
  try { localStorage.setItem(AUTO_EVOLVE_KEY, String(autoEvolve)); } catch {}
}
function paintAutoEvolve() {
  const button = $('autoEvolve');
  button.textContent = autoEvolve ? 'Evolução: automática' : 'Evolução: você escolhe';
  button.setAttribute('aria-pressed', String(autoEvolve));
  button.setAttribute('aria-label', autoEvolve
    ? 'Evolução automática ligada. Clique para escolher as melhorias você mesmo.'
    : 'Você escolhe as evoluções. Clique para o jogo escolher sozinho.');
  button.setAttribute('data-tip', autoEvolve
    ? 'Quando um herói sobe de nível, o jogo escolhe a melhoria que combina com ele e segue sem pausar. Clique para escolher você mesmo.'
    : 'Quando um herói sobe de nível, o jogo pausa e você escolhe a melhoria (dano, controle ou suporte). Clique para o jogo escolher sozinho.');
}
function setAutoEvolve(enabled) {
  autoEvolve = !!enabled;
  saveAutoEvolve();
  paintAutoEvolve();
}
paintAutoEvolve();

function loadAuto(id) {
  try {
    const value = JSON.parse(localStorage.getItem(AUTO_KEY))?.[id];
    return typeof value === 'boolean' ? value : value?.[0] ?? true;
  } catch { return true; }
}
function loadAutoSlot(id, slot = 0) {
  try {
    const value = JSON.parse(localStorage.getItem(AUTO_KEY))?.[id];
    return Array.isArray(value) ? value[slot] ?? true : value ?? true;
  } catch { return true; }
}
function saveAuto(id, on, slot = null) {
  try {
    const all = JSON.parse(localStorage.getItem(AUTO_KEY)) || {};
    if (slot == null) all[id] = on; // compatibilidade com preferências antigas e chamadas existentes
    else {
      const current = all[id];
      const slots = Array.isArray(current) ? [...current] : [typeof current === 'boolean' ? current : true, true, true];
      slots[slot] = on;
      all[id] = slots;
    }
    localStorage.setItem(AUTO_KEY, JSON.stringify(all));
  } catch {}
}

// menu inicial: Campanha (missões com estrelas) ou Acampamento
const MODES = [
  { name: 'Campanha', icon: '⚑', desc: `${MISSIONS.length} missões com objetivos e estrelas.`, color: ['#ffe27a', '#c98a12'] },
  { name: 'Acampamento', icon: '⚒', desc: 'Oficina, maestria dos heróis e conquistas.', color: ['#ffd29e', '#b8662a'] },
  { name: 'Teste', icon: '⚗', desc: 'Arena sem fim para testar equipes. Não salva nada.', color: ['#b6f0d4', '#2f9f78'] },
];
// Menu inicial estilo Clash: barra de perfil em cima, logo, a equipe em 3D no meio do cenário (menuStage)
// e uma doca embaixo: o botão grande de batalha (Campanha) no centro, o Teste à esquerda e o Acampamento à direita. Pouco texto: os detalhes ficam na dica e no aria-label.
// A ordem de pick.cards segue MODES (atalhos 1–3); as setas ← → seguem a ordem da doca (MENU_DOCK_ORDER).
const MENU_DOCK_ORDER = [2, 0, 1];
const SEEN_ACHIEVEMENTS_KEY = 'cavaleiros-conquistas-vistas';
const seenAchievements = () => { try { return +localStorage.getItem(SEEN_ACHIEVEMENTS_KEY) || 0; } catch { return 0; } };
// missão sugerida: a primeira ainda sem estrelas; com todas jogadas, a primeira que ainda rende estrela
function recommendedMission() {
  return MISSIONS.find((m) => !starsOf(m.id)) || MISSIONS.find((m) => starsOf(m.id) < 3) || null;
}
// equipe do menu: a última da campanha, completada com o primeiro herói de cada classe
function menuSquad() {
  const ids = [...loadCampaignSquad()];
  for (const [classId] of HEROES.entries()) if (ids.length < 4) { const cfg = variantsOf(classId)[0]; if (cfg && !ids.includes(cfg.id)) ids.push(cfg.id); }
  return ids.slice(0, 4).map((id) => VARIANTS.find((cfg) => cfg.id === id)).filter(Boolean);
}
const MENU_SPEAKER = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="spk" d="M3 9h4l5-4v14l-5-4H3z"/><path class="on" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/><path class="off" d="M16 9l6 6M22 9l-6 6"/></svg>';
function paintMenuBar(bar) {
  const muted = $('mute').classList.contains('off'), low = $('quality').textContent.includes('baixa');
  const sound = bar.querySelector('.menu-sound'), gfx = bar.querySelector('.menu-gfx');
  sound.classList.toggle('off', muted);
  sound.setAttribute('aria-label', muted ? 'Ligar o som' : 'Desligar o som');
  sound.setAttribute('data-tip', muted ? 'Som desligado' : 'Som ligado');
  gfx.classList.toggle('low', low);
  gfx.setAttribute('aria-pressed', String(low));
  gfx.setAttribute('aria-label', low ? 'Gráficos leves. Clique para altos' : 'Gráficos altos. Clique para leves');
  gfx.setAttribute('data-tip', low ? 'Gráficos leves' : 'Gráficos altos');
}
function showMenu() {
  tutorial.on('leave');
  pick.mode = 'mode';
  $('banner').style.opacity = 0;
  $('campaign').classList.add('hidden');
  $('camp').classList.add('hidden');
  pick.options = MODES;
  $('pickTitle').innerHTML = logoSVG();
  setPickSub('');
  $('pickHint').textContent = '';   // sem rodapé: setas, Enter e 1–2 seguem valendo
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  const achievements = progress.achievements(), achieved = achievements.filter((a) => a.unlocked).length;
  const stars = totalStars(), maxStars = MISSIONS.length * 3;
  const mastery = Math.max(1, ...VARIANTS.map((cfg) => progress.mastery(cfg.id).level));
  const next = recommendedMission();
  const shopReady = UPGRADES.some((u) => { const cost = progress.upgradeCost(u.id); return cost != null && progress.gold >= cost; });
  const newAchievements = Math.max(0, achieved - seenAchievements());

  const home = document.createElement('div');
  home.className = 'menu-home';
  // barra de perfil: ícones e números; o detalhe vai na dica
  const bar = document.createElement('div');
  bar.className = 'menu-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Perfil');
  bar.innerHTML = `<div class="menu-stats">
      <span class="menu-stat gold" tabindex="0" data-tip="${GOLD.name}: ${progress.gold}" aria-label="${progress.gold} de ouro"><i aria-hidden="true">${GOLD.icon}</i>${progress.gold}</span>
      <span class="menu-stat stars" tabindex="0" data-tip="Estrelas da campanha: ${stars} de ${maxStars}" aria-label="${stars} de ${maxStars} estrelas"><i aria-hidden="true">★</i>${stars}</span>
    </div>
    <div class="menu-tools">
      <button type="button" class="menu-tool menu-sound">${MENU_SPEAKER}</button>
      <button type="button" class="menu-tool menu-gfx"><span aria-hidden="true">◐</span></button>
    </div>`;
  bar.querySelector('.menu-sound').onclick = () => { $('mute').onclick?.(); paintMenuBar(bar); };
  bar.querySelector('.menu-gfx').onclick = () => { $('quality').onclick?.(); paintMenuBar(bar); };
  paintMenuBar(bar);

  // doca embaixo: Teste · Batalhar no centro · Acampamento (a equipe 3D no meio também leva ao Acampamento)
  const dock = document.createElement('div');
  dock.className = 'menu-dock';
  const label = ['Batalhar', 'Acampamento', 'Teste'];
  const extra = [
    '',
    `${shopReady || newAchievements ? '<span class="menu-new" aria-hidden="true">!</span>' : ''}`,
    '',
  ];
  const spoken = [`${stars} de ${maxStars} estrelas${next ? `. Próxima: ${next.name}` : ''}`,
    `${progress.gold} de ouro, ${achieved} de ${achievements.length} conquistas${shopReady ? '. Há melhoria para comprar' : ''}${newAchievements ? '. Conquista nova' : ''}`,
    'Sem estrelas, recordes nem ouro'];
  pick.cards = MODES.map((m, i) => {
    const b = document.createElement('div');
    b.className = `menu-btn ${i === 0 ? 'menu-battle' : 'menu-side'}`;
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-keyshortcuts', String(i + 1));
    b.setAttribute('aria-label', `${m.name}: ${m.desc} ${spoken[i]}.`);
    b.setAttribute('data-tip', i === 0 ? (next ? `⚑ ${MISSIONS.indexOf(next) + 1}. ${next.name}` : m.desc) : i === 2 ? m.desc : `${m.desc} · ✦ ${achieved}/${achievements.length} · ✪ ${mastery}`);
    b.style.setProperty('--c', m.color[0]);
    b.style.setProperty('--cd', m.color[1]);
    b.style.setProperty('--d', `${i === 0 ? 220 : 300 + i * 70}ms`);
    b.innerHTML = `<span class="menu-icon" aria-hidden="true">${i === 0 ? '⚔' : m.icon}</span><b>${label[i]}</b>${extra[i]}`;
    b.onclick = () => confirmPick(i);
    b.onfocus = () => selectCard(i);
    b.onmouseenter = () => selectCard(i);
    return b;
  });
  dock.append(pick.cards[2], pick.cards[0], pick.cards[1]);   // Teste e Acampamento têm o mesmo tamanho: Batalhar fica no centro da tela
  home.append(bar, dock);
  list.appendChild(home);
  selectCard(0);
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

function confirmMode(i) {
  pick.open = false;
  pick.cards.forEach((c, k) => c.classList.add(k === i ? 'chosen' : 'gone'));
  // primeira vez na campanha: direto para a missão 1
  pick.timer = setTimeout(() => (i === 0 ? showCampaign(!totalStars() && !loadCampaignTeam().length && !allOpen() ? MISSIONS[0] : null) : i === 1 ? showCamp() : startArenaSetup()), 450);
}

// ---------- modo Teste: arena fixa com ondas infinitas, para testar composições de equipe ----------
// Sem missão, estrelas, recordes, ouro nem maestria (game.test). A luta acontece no início da estrada (fase 1:
// sem rio, lago nem ponte) e o grupo nunca avança. A cada ARENA_WAVE s a onda sobe de nível; quem cai volta
// após ARENA_REVIVE s (a luta continua enquanto restar alguém de pé); se todos caem, aparece o resumo por herói.
const ARENA_PHASE = 1, ARENA_WAVE = 30, ARENA_REVIVE = 12, ARENA_MAX_TIER = 20, ARENA_BOSS_TIERS = [6, 9, 12];
const arenaTier = (seconds) => Math.min(ARENA_MAX_TIER, 3 + Math.floor(seconds / ARENA_WAVE));

function arenaBuildWorld() {
  world.dispose?.();
  world = createWorld(scene, ROAD, PHASES);
  aimCamera(world.anchorS(ARENA_PHASE));
}
// carrega cenário e modelos com a tela de carregamento e então chama ready
function arenaWithAssets(ready) {
  $('pick').classList.add('hidden');
  if (typeof withBattleAssets === 'function') return withBattleAssets(ready, arenaBuildWorld);
  arenaBuildWorld();
  ready();
}
// grupo vazio na arena; a equipe e o nível entram depois
function arenaPrepare(level) {
  game.mission = null;
  placeParty(ARENA_PHASE);
  Object.assign(game, { test: true, rerolls: 0, last: PHASES,
    arena: { level, t: 0, tier: arenaTier(0), wave: 1, leaderTier: ARENA_BOSS_TIERS[0], bossQueued: 0, bossOn: false, bossCalls: 0, summary: false } });
  $('goal').classList.add('hidden');
}
function startArenaSetup(level = 3) {   // botão Teste do menu: equipe -> dificuldade -> luta
  arenaWithAssets(() => { arenaPrepare(level); showArenaPick(); });
}
function startArenaRun({ team, level }) {   // ↻ Reiniciar: mesma equipe e dificuldade, sem escolhas
  arenaWithAssets(() => {
    arenaPrepare(level);
    for (const cfg of team.slice(0, MAX_PARTY)) { new Hero(cfg); arrangeParty(); }
    arenaBegin();
  });
}

function showArenaPick() {
  showPick('Equipe de teste', 'Monte até 4 heróis de qualquer classe e escolha o nível');
  arenaPickBar();
}
function arenaPickBar() {
  document.querySelector('.arena-pickbar')?.remove();
  const a = game.arena, n = heroes().length;
  const bar = document.createElement('div');
  bar.className = 'arena-pickbar';
  const button = (cls, text, tip, onclick, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.setAttribute('data-tip', tip);
    b.setAttribute('aria-label', tip);
    b.disabled = disabled;
    b.onclick = onclick;
    return b;
  };
  bar.append(
    button('arena-btn', '⌂', 'Voltar ao menu', () => startGame()),
    ...[1, 2, 3].map((lv) => {
      const b = button(`arena-btn${lv === a.level ? ' on' : ''}`, `Nv${lv}`, `Todos os heróis no nível ${lv}`, () => { a.level = lv; arenaPickBar(); });
      b.setAttribute('aria-pressed', String(lv === a.level));
      return b;
    }),
    button('arena-btn', '✕', 'Limpar a equipe', () => { for (const h of [...heroes()]) h.remove(); game.roster.length = 0; arrangeParty(); showArenaPick(); }, !n),
    button('arena-btn go', `▶ ${n}/${MAX_PARTY}`, 'Lutar com esta equipe', () => arenaChooseDifficulty(), !n),
  );
  $('pick').appendChild(bar);
}
function arenaHeroPicked(cfg) {
  const h = new Hero(cfg);
  arrangeParty();
  h.busy = h.once('Cheer') * 0.6;
  if (heroes().length >= MAX_PARTY) return arenaChooseDifficulty();
  showArenaPick();
}
function arenaChooseDifficulty() {
  document.querySelector('.arena-pickbar')?.remove();
  showDifficulty();
  $('pickTitle').textContent = 'Arena de teste';
}

// equipe e dificuldade prontas: aplica o nível, abre o HUD da arena e solta a primeira onda
function arenaBegin() {
  const a = game.arena;
  if (!a) return;
  document.querySelector('.arena-pickbar')?.remove();
  $('pick').classList.add('hidden');
  for (const h of heroes()) {
    h.gainXp(XP_LEVELS[a.level - 1]);
    autoUpgrade();   // já começa evoluído, sem telas de escolha
    h.pos.copy(h.post);
    h.vel.set(0, 0, 0);
  }
  arenaHud();
  document.body.classList.remove('no-battle');
  game.paused = false;
  audio.startMusic();
}

// botões extras no HUD da batalha: horda, chefe, resumo, reiniciar e sair
function arenaHud() {
  arenaCleanup(false);
  const right = document.querySelector('.hud-right');
  const make = (cls, text, tip, onclick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `hud-icon arena-hud ${cls}`;
    b.textContent = text;
    b.setAttribute('data-tip', tip);
    b.setAttribute('aria-label', tip);
    b.onclick = onclick;
    return b;
  };
  const buttons = [
    make('horde', '✹', 'Chamar horda extra', () => { game.toSpawn = Math.min(game.toSpawn + 10, 40); }),
    make('boss', '♛', 'Chamar chefe', () => { game.arena.bossQueued++; }),
    make('summary', '▤', 'Resumo por herói', () => arenaSummary(false)),
    make('again', '↻', 'Reiniciar com a mesma equipe', () => arenaRestart()),
    make('exit', '⌂', 'Sair para o menu', () => startGame()),
  ];
  right?.prepend(...buttons);
  $('goal').setAttribute('data-icon', '⚔');
  $('goal').classList.remove('hidden', 'warn', 'done');
}
// tira botões e barras do modo Teste (startGame chama sem argumento; arenaHud mantém o restante)
function arenaCleanup(full = true) {
  document.querySelectorAll?.('.arena-hud').forEach((b) => b.remove());
  if (full) document.querySelector?.('.arena-pickbar')?.remove();
}
function arenaRestart() {
  const a = game.arena;
  if (!a) return;
  startGame({ arena: { team: game.roster.map((h) => h.cfg), level: a.level } });
}

// a cada quadro: sobe a onda, revive caídos, repõe inimigos e atende horda e chefe chamados
function arenaTick(dt, skeletons, party) {
  const a = game.arena;
  if (game.state !== 'fight') return;
  a.t += dt;
  a.tier = arenaTier(a.t);
  const wave = 1 + Math.floor(a.t / ARENA_WAVE);
  if (wave > a.wave) { a.wave = wave; showBanner(`Onda ${wave}`, 2); }
  for (const h of party) {
    if (!h.dead) { h.arenaDown = 0; continue; }
    h.arenaDown = (h.arenaDown || 0) + dt;
    if (h.arenaDown >= ARENA_REVIVE) {
      h.arenaDown = 0;
      h.revive();
      h.hp = h.maxHp * 0.5;
      popText(h.pos, '♥', 'heal');
    }
  }
  if (a.bossOn && game.toSpawn === 0) { a.bossOn = false; game.bossPending = false; game.refilling = true; }   // o chefe já entrou
  else if (a.bossQueued > 0 && game.toSpawn === 0) {
    a.bossQueued--;
    a.leaderTier = ARENA_BOSS_TIERS[a.bossCalls++ % ARENA_BOSS_TIERS.length];
    a.bossOn = true;
    game.bossPending = true;
    game.refilling = false;
    game.toSpawn = 1;   // com toSpawn 1 e sem "refilling", spawnSkeleton solta o líder
  }
  const cap = Math.min(24, 6 + (wave - 1) * 2);
  if (game.toSpawn === 0 && skeletons.length < cap) game.toSpawn = Math.min(cap - skeletons.length, 2 + wave);
  setGoalUI(`${clockText(a.t)} · onda ${a.wave} · ${game.kills} abates`, (a.t % ARENA_WAVE) / ARENA_WAVE);
}

// resumo por herói (dano, cura, recebido, abates e quedas): ao fim da luta ou pelo botão ▤ (pausa a luta)
function arenaSummary(final) {
  const a = game.arena;
  if (!a) return;
  if (final) {
    setDirectControlMode(false, null, false);
    game.over = true;
    syncDirectControlUI();
    audio.stopMusic();
    audio.play('defeat');
  } else {
    if (a.summary || game.over || pick.open) return;
    a.summary = true;
    a.wasPaused = game.paused;
    game.paused = true;
  }
  closeHeroPanel();
  const party = game.roster;
  const report = buildBattleReport({
    won: false,
    heroes: party.map((h) => ({ id: h.cfg.id, name: h.cfg.names?.[h.level - 1] || h.cfg.name, damage: h.stats.dano, received: h.stats.recebido, kills: h.stats.abates })),
    falls: game.fallLog,
    damageSources: Object.values(game.damageSources),
    militia: null,
    mission: null,
  });
  const info = `Onda ${a.wave} · ${clockText(a.t)} · ${game.kills} abates`;
  $('overlayTitle').textContent = final ? 'A equipe caiu' : 'Resumo';
  $('overlayTitle').setAttribute('data-tip', info);
  $('overlayText').textContent = info;
  $('overlayStars').innerHTML = '';
  $('overlayStats').innerHTML = summaryHTML(party, report, { won: false, kills: game.kills, falls: game.fallLog?.length || 0 })
    .replace('<details class="end-details">', '<details class="end-details" open>');
  const next = $('overlayNext');
  next.innerHTML = '<button class="mission-next-btn" type="button" data-act="replay" data-tip="Mesma equipe e dificuldade">↻ Reiniciar</button>'
    + '<button class="mission-replay-btn" type="button" data-act="menu" aria-label="Sair para o menu" data-tip="Sair para o menu">⌂</button>';
  next.querySelector('[data-act="replay"]').onclick = arenaRestart;
  next.querySelector('[data-act="menu"]').onclick = () => startGame();
  const resume = $('overlayBtn');
  resume.hidden = final;
  resume.textContent = 'Continuar';
  resume.setAttribute('aria-label', 'Continuar a luta');
  resume.onclick = () => {
    a.summary = false;
    game.paused = a.wasPaused || false;
    $('overlay').classList.add('hidden');
    next.innerHTML = '';
    resume.hidden = true;
    resume.onclick = () => startGame(game.mission ? 'map' : 'menu');
  };
  const overlay = $('overlay');
  overlay.classList.add('results', 'test-run');
  overlay.classList.toggle('lost', final);
  overlay.classList.remove('won');
  overlay.classList.remove('hidden');
}

// acampamento: gasta o ouro na oficina e mostra maestria e conquistas
function progressStorageWarning() {
  const messages = [];
  if (campaignStorageWasCorrupted()) messages.push(campaignCorruptBackupFailed()
    ? 'Um save da campanha estava corrompido e não foi possível preservar uma cópia; o progresso anterior pode ter sido perdido.'
    : 'Um save da campanha estava corrompido. Uma cópia foi preservada no navegador e a campanha continuará com os dados restantes.');
  if (progress.corrupted) messages.push(progress.corruptBackupFailed
    ? 'O save da meta-progressão (ouro, melhorias e maestria) estava corrompido e não foi possível preservar uma cópia; esses dados foram reiniciados.'
    : 'O save da meta-progressão (ouro, melhorias e maestria) estava corrompido. Uma cópia foi preservada no navegador e esses dados foram reiniciados.');
  if (progress.persistenceUnavailable || campaignStorageIsVolatile()) messages.push('Não foi possível salvar o progresso desta sessão. Ele pode se perder ao recarregar a página.');
  return messages.join(' ');
}

function showCamp() {
  pick.open = false;
  game.paused = true;
  $('pick').classList.add('hidden');
  toastAchievements(progress.refresh(totalStars()));   // estrelas de antes da progressão também contam
  // as conquistas foram vistas: o selo de novidade do menu some
  try { localStorage.setItem(SEEN_ACHIEVEMENTS_KEY, String(progress.achievements().filter((a) => a.unlocked).length)); } catch {}
  const cosmetics = campaignCosmetics();
  renderCamp($('camp'), progress, { variants: VARIANTS, onBack: showMenu, cosmetics, equippedCosmetic: equippedCampaignCosmetic(cosmetics), onEquipCosmetic: equipCampaignCosmetic,
    storageWarning: progressStorageWarning });
  $('camp').classList.remove('hidden');
  $('camp').querySelector('.camp-back')?.focus?.();
}

// mapa da campanha; escolher uma missão leva à dificuldade
// keepDifficulty: "Próxima missão" segue na dificuldade da última, sem perguntar de novo
function showCampaign(autoPlay = null, keepDifficulty = false) {
  tutorial.on('leave');
  game.mission = null;
  campaignTeamRun = false;
  pick.open = false;
  game.paused = true;   // sem grupo ainda: a partida não pode correr por trás do mapa
  $('pick').classList.add('hidden');
  const root = $('campaign');
  const mapSeeds = campaignMapSession.get();
  const play = (m) => {
    game.mission = m;
    campaignTeamRun = true;
    root.classList.add('hidden');
    const build = () => useMissionWorld(m, mapSeeds.get(m.id));
    const next = keepDifficulty ? beginRun : showDifficulty;
    if (typeof withBattleAssets === 'function') return withBattleAssets(next, build);   // cenário, modelos e shaders com a tela de carregamento
    build();
    next();
  };
  renderCampaign(root, play, (m) => m.id === 'coracao-do-castelo' ? 'Interior do castelo' : m.biome || biomeForSeed(mapSeeds.get(m.id)), (m) => campaignThreats(m.from, m.to, m.goal, m), progressStorageWarning(), (m) =>
    difficultyTeamRecommendation(DIFFICULTIES.find((option) => option.id === 'normal'), m, m.goal.type === 'duel' ? 1 : MAX_PARTY), mountCampaignMap3D,
    (m) => m.goal.type === 'duel' ? 1 : MAX_PARTY);
  const back = document.createElement('button');
  back.className = 'camp-back';
  back.textContent = '← Menu';
  back.onclick = () => { campaignMapSession.reset(); showMenu(); };
  root.querySelector('.camp-head')?.prepend(back);
  root.classList.remove('hidden');
  if (autoPlay) play(autoPlay);
}

// Cada missão da campanha recebe seu próprio cenário.
function useMissionWorld(m, seed) {
  world.dispose?.();
  const castleInterior = m.id === 'coracao-do-castelo';
  world = createWorld(scene, ROAD, castleInterior ? 13 : Math.max(PHASES, m.to), seed, { castleInterior, biome: m.biome });
  aimCamera(world.anchorS(m.from));
}

// "Repetir" da campanha: mesma missão, cenário e dificuldade; na equipe contínua abre a tela da equipe (Seguir / trocar)
function replayMission({ replay: m, team, seed }) {
  game.mission = m;
  if (typeof withBattleAssets === 'function') return withBattleAssets(() => replayTeam(m, team), () => useMissionWorld(m, seed));
  useMissionWorld(m, seed);
  replayTeam(m, team);
}
function replayTeam(m, team) {
  if (campaignTeamMode()) return beginRun();   // o estado salvo é o de antes da missão (derrota não gravou XP; vitória gravou)
  prepareRun();
  game.picksLeft = 0;
  for (const cfg of team.slice(0, missionPartySize(m))) {
    const h = new Hero(cfg);
    arrangeParty();
    h.gainXp(XP_LEVELS[m.level - 1]);
    autoUpgrade();   // a missão já começa no nível certo, como na escolha normal
  }
  startMission();
}

// dificuldade da missão (sem missão só nos atalhos internos de simulação/bench, fases 1–12)
function showDifficulty() {
  if (typeof preloadBattleAssets === 'function') preloadBattleAssets();
  pick.mode = 'difficulty';
  $('banner').style.opacity = 0;
  pick.options = DIFFICULTIES;
  const m = game.mission;
  $('pickTitle').textContent = m ? `${MISSIONS.indexOf(m) + 1}. ${m.name}` : `Fases 1–${PHASES}`;
  setPickSub(m ? `⚑ ${goalText(m.goal)}` : '');
  $('pickHint').textContent = DIFFICULTY_PICK_HINT;
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  // cartão: ícone e nome; a descrição da dificuldade vai para a dica
  pick.cards = DIFFICULTIES.map((d, i) => {
    const spoken = m ? `Fases ${m.from}–${m.to}.` : `Fases 1–${PHASES}.`;
    const recommendation = difficultyTeamRecommendation(d, m, m ? missionPartySize(m) : undefined);
    const tip = [d.desc, recommendation].filter(Boolean).join(' ');
    const b = document.createElement('div');
    b.className = 'card diff';
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', `${d.name}: ${tip} ${spoken}`);
    b.setAttribute('data-tip', tip);
    b.style.setProperty('--c', d.color[0]);
    b.style.setProperty('--cd', d.color[1]);
    b.style.setProperty('--d', `${i * 90}ms`);
    b.innerHTML = `<div class="num">${i + 1}</div><div class="medal">${d.icon}</div><div class="ribbon">${d.name}</div>`;
    b.onclick = () => confirmPick(i);
    b.onfocus = () => selectCard(i);
    bindCard(b, i);
    list.appendChild(b);
    return b;
  });
  selectCard(DIFFICULTIES.indexOf(difficulty));
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

function confirmDifficulty(i) {
  difficulty = DIFFICULTIES[i];
  paintDifficulty();
  pick.open = false;
  pick.cards.forEach((c, k) => c.classList.add(k === i ? 'chosen' : 'gone'));
  beginRun();
}

function beginRun() {
  if (game.arena) { pick.timer = setTimeout(arenaBegin, 450); return; }   // modo Teste: equipe e dificuldade prontas
  const m = prepareRun();
  pick.timer = setTimeout(() => (m ? (campaignTeamMode() ? showTeam() : showPick(pickTitle(), pickSub()))
    : showPick('Escolha seu herói', 'Ele vai liderar o grupo contra os esqueletos')), 550);
}

// dificuldade já escolhida: prepara o cenário e o grupo vazio da missão
function prepareRun() {
  const m = game.mission;
  if (m) campaignMapSession.reset();   // a próxima visita à campanha começa uma nova combinação de mapas
  // ?fase=N também vale na campanha, dentro do trecho da missão
  const asked = +new URLSearchParams(location.search).get('fase');
  placeParty(m ? THREE.MathUtils.clamp(asked || m.from, m.from, m.to) : THREE.MathUtils.clamp(asked || 1, 1, PHASES));
  game.campaignSquadSuggestion = m && !game.test ? loadCampaignSquad() : [];
  game.picksLeft = m ? missionPartySize(m) : 0;
  pick.leaving = [];
  pick.evoThen = null;
  return m;
}

const pickTitle = () => missionPartySize(game.mission) > 1 ? `Escolha o herói ${heroes().length + 1} de ${missionPartySize(game.mission)}` : 'Escolha seu herói';
const pickSub = () => `${game.mission.name}: ${campaignTeamMode() ? 'quem entra herda o nível de quem sai' : `o grupo começa no nível ${game.mission.level}`}`;

function bindCard(b, i, hoverSelects = true) {
  if (hoverSelects) b.onmouseenter = () => { if (!b.classList.contains('owned')) selectCard(i); };
  b.onpointermove = (e) => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / r.height) * 9) + 'deg');
    b.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 12) + 'deg');
  };
  b.onpointerleave = () => { b.style.setProperty('--rx', '0deg'); b.style.setProperty('--ry', '0deg'); };
  b.addEventListener('animationend', (e) => { if (e.animationName === 'rise') b.classList.add('arrived'); });
}

// ficha do herói em foco: retrato, nome, papel, maestria, habilidades (detalhes na dica) e atributos em ícones
const attrText = (text) => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
function renderInfo(cfg) {
  const info = heroInfo(cfg);
  const skills = skillSetFor(cfg);
  const currentTeam = heroes().map((hero) => hero.cfg);
  const alreadySelected = currentTeam.some((member) => member.id === cfg.id);
  const teamLimit = game.mission && game.picksLeft > 0 ? Math.min(MAX_PARTY, missionPartySize(game.mission)) : MAX_PARTY;
  const canAddCandidate = !alreadySelected && currentTeam.length < teamLimit && variantOpen(cfg.id);
  const projectedTeam = canAddCandidate ? [...currentTeam, cfg] : currentTeam;
  const team = teamCoverage(projectedTeam);
  const objective = game.mission?.goal;
  const priorityRoles = missionRoleNeeds(objective);
  const uncoveredPriorities = priorityRoles.filter((name) => !team.roles.find((role) => role.name === name)?.count);
  // papéis que faltam só aparecem enquanto há vaga; na missão valem os prioritários do objetivo
  const slotsLeft = projectedTeam.length < teamLimit;
  const wanted = slotsLeft ? (objective ? uncoveredPriorities : team.missing) : [];
  const roleIcon = (name, cls, tip) => `<span class="${cls}" data-role="${name}" tabindex="0" data-tip="${attrText(tip)}" aria-label="${attrText(tip)}">${ROLE_GLYPHS[name] || '✦'}</span>`;
  const coveredIcons = team.roles.filter((role) => role.count)
    .map((role) => roleIcon(role.name, `covered${priorityRoles.includes(role.name) ? ' priority' : ''}`, role.name)).join('');
  const wantedIcons = wanted.map((name) => roleIcon(name, `wanted${objective ? ' priority' : ''}`, objective ? `Missão pede: ${name}` : `Falta: ${name}`)).join('');
  // sinergias que a equipe (com o candidato) liga: só o ícone; nome e efeito ficam na dica
  const synergyIcons = activeSynergies(projectedTeam.map((member) => member.id))
    .map((synergy) => `<span class="covered synergy" data-synergy="${synergy.id}" tabindex="0" data-tip="${attrText(`${synergy.name} · ${synergy.effect}`)}" aria-label="${attrText(synergy.name)}">${synergy.icon}</span>`).join('');
  const teamMembers = projectedTeam.map((member) => {
    const candidate = canAddCandidate && member.id === cfg.id;
    return `<span class="${candidate ? 'candidate' : ''}" style="--c:${member.color[0]};--cd:${member.color[1]}" data-tip="${attrText(member.name)}" aria-label="${attrText(member.name + (candidate ? ' (novo)' : ''))}"><img src="${member.portrait}" alt=""></span>`;
  }).join('')
    + Array.from({ length: Math.max(0, teamLimit - projectedTeam.length) }, () => '<span class="empty" aria-label="Vaga livre"><i aria-hidden="true">+</i></span>').join('');
  const numbers = { Vida: `${cfg.hp} de vida`, Força: `${cfg.dmg} de dano por golpe`, Rapidez: `golpe a cada ${cfg.cooldown.toLocaleString('pt-BR')} s`, Alcance: `${cfg.range.toLocaleString('pt-BR')} m` };
  const stats = Object.entries(cfg.stats).map(([label, n]) => {
    const tip = `${label} ${n}/5 · ${numbers[label] || ''}`;
    return `<span class="hero-stat" tabindex="0" data-tip="${attrText(tip)}" aria-label="${attrText(tip)}"><i aria-hidden="true">${STAT_GLYPHS[label] || '✦'}</i><span class="pips${label === 'Vida' ? ' hearts' : ''}" aria-hidden="true">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</span></span>`;
  }).join('');
  const mastery = progress.mastery(cfg.id);
  const masteryPerks = MASTERY_PERKS.slice(1, mastery.level).map((perk) => perk.text).join(' · ') || 'Jogue com este herói para ganhar maestria.';
  const masteryXp = mastery.next ? `${mastery.xp}/${mastery.next} XP` : 'máxima';
  const masteryLine = `<div class="hero-mastery mastery-${mastery.level}" tabindex="0" data-tip="${attrText(`Maestria ${mastery.level} · ${masteryXp} · ${masteryPerks}`)}" aria-label="${attrText(`Maestria ${mastery.level}, ${masteryXp}`)}"><b aria-hidden="true">✦${mastery.level}</b><span class="mastery-track" aria-hidden="true"><i style="width:${mastery.next ? Math.round((mastery.xp - mastery.from) / (mastery.next - mastery.from) * 100) : 100}%"></i></span></div>`;
  const kindName = (skill) => skill.ultimate ? 'Ultimate' : skill.slot > 0 ? 'Técnica' : 'Básica';
  pick.info.style.setProperty('--c', cfg.color[0]);
  pick.info.style.setProperty('--cd', cfg.color[1]);
  pick.info.innerHTML = `<div class="hero-profile"><div class="crest"><img src="${cfg.portrait}" alt=""></div>
      <div class="hero-profile-copy"><div class="ribbon" data-tip="${attrText(`${info.name} · ${cfg.ranged ? 'à distância' : 'corpo a corpo'}`)}">${cfg.name}</div>
        <span class="hero-role-pill" tabindex="0" data-tip="${attrText(`${CLASSES[cfg.classId].summary} ${info.tip}`)}">${info.role}</span>${masteryLine}</div></div>
    <section class="ability skill-list" aria-label="Habilidades do herói">${skills.map((skill) => `<article class="skill-detail${skill.ultimate ? ' ultimate-detail' : skill.slot > 0 ? ' technique-detail' : ''}" tabindex="0" data-tip="skill" data-hero="${cfg.id}" data-slot="${skill.slot}" aria-label="${attrText(`${skill.name}, ${kindName(skill)}, recarga ${cooldownForSkill(cfg, skill.slot)} s: ${skill.description}`)}"><span class="skill-icon" aria-hidden="true">${SKILL_GLYPHS[cfg.id]?.[skill.slot] || ['✦', '⚔', '☼', '✧'][skill.slot]}</span><strong>${skill.name}</strong><span class="skill-meta" aria-hidden="true">⟳ ${cooldownForSkill(cfg, skill.slot)} s</span></article>`).join('')}</section>
    ${passiveHTML(cfg.id)}
    <div class="stats hero-stats" aria-label="Atributos">${stats}</div>
    ${variantOpen(cfg.id) ? '' : `<div class="lock-info" aria-label="Ganhe ${starsToUnlock(cfg.id)} estrelas na campanha para liberar">\u{1F512}︎ ★ ${starsToUnlock(cfg.id)}</div>`}`;
  // equipe fixa ao lado dos cartões: mini-retratos, contagem, papéis cobertos e os que faltam
  pick.team.innerHTML = `<section class="party-composition" aria-label="${attrText(canAddCandidate ? `Sua equipe com ${cfg.name}` : 'Sua equipe')}">
      <span class="pick-team-count" aria-label="${Math.min(projectedTeam.length, teamLimit)} de ${teamLimit} heróis"${objective ? ` data-tip="${attrText(`Objetivo: ${goalText(objective)}`)}"` : ''}>${Math.min(projectedTeam.length, teamLimit)}/${teamLimit}</span>
      <div class="party-members">${teamMembers}</div>
      <div class="party-roles" aria-label="Papéis cobertos">${coveredIcons}</div>
      ${synergyIcons ? `<div class="party-roles party-synergies" aria-label="Sinergias ativas">${synergyIcons}</div>` : ''}
      ${wantedIcons ? `<div class="party-roles party-wanted" aria-label="${objective ? 'Prioridades da missão' : 'Papéis que faltam'}">${wantedIcons}</div>` : ''}
    </section>`;
  const selectButton = document.createElement('button');
  selectButton.type = 'button';
  selectButton.className = 'hero-select-btn';
  selectButton.disabled = !canAddCandidate;
  selectButton.textContent = alreadySelected ? 'Já está na equipe' : !variantOpen(cfg.id) ? 'Herói bloqueado' : `Escolher ${cfg.name}`;
  selectButton.setAttribute('aria-label', canAddCandidate ? `Escolher ${cfg.name}` : selectButton.textContent);
  selectButton.onclick = () => confirmPick(pick.sel);
  pick.info.appendChild(selectButton);
}

// colunas da grade de cada aba (o CSS usa o mesmo número via --pick-cols): 5–6 heróis em 3, 7–8 em 4
const pickGridColumns = (count) => count > 6 ? 4 : 3;

// setas na grade: ← → dentro da aba, ↑ ↓ entre as linhas da aba e depois para a aba vizinha, pulando quem já está no grupo
function moveGrid(dx, dy) {
  const free = (i) => isFree(pick.options[i]);
  const rows = PICK_GROUPS.map((group) => pick.options
    .map((cfg, i) => pickGroupId(cfg) === group.id ? i : -1).filter((i) => i >= 0));
  const r0 = rows.findIndex((row) => row.includes(pick.sel));
  const c0 = rows[r0]?.indexOf(pick.sel) ?? 0;
  if (r0 < 0) return;
  const cols = pickGridColumns(rows[r0].length);
  if (dy) {
    for (let line = Math.floor(c0 / cols) + dy; line >= 0 && line * cols < rows[r0].length; line += dy) {
      const candidates = rows[r0].slice(line * cols, (line + 1) * cols).filter(free);
      const i = candidates.sort((a, b) => Math.abs(rows[r0].indexOf(a) % cols - c0 % cols) - Math.abs(rows[r0].indexOf(b) % cols - c0 % cols))[0];
      if (i !== undefined) return selectCard(i);
    }
  }
  if (dx) {
    const row = rows[r0];
    for (let n = 1; n < row.length; n++) {
      const i = row[(c0 + dx * n + row.length) % row.length];
      if (free(i)) return selectCard(i);
    }
    return;
  }
  for (let n = 1; n < rows.length; n++) {
    const r = (r0 + dy * n + rows.length) % rows.length;
    const candidates = rows[r].filter(free);
    // subindo, entra pela última linha da aba; descendo, pela primeira
    const cr = pickGridColumns(rows[r].length);
    const i = candidates.sort((a, b) => Math.abs(rows[r].indexOf(a) % cr - c0 % cols) - Math.abs(rows[r].indexOf(b) % cr - c0 % cols)
      || (dy < 0 ? b - a : a - b))[0];
    if (i !== undefined) return selectCard(i);
  }
}

function selectCard(i) {
  pick.sel = (i + pick.cards.length) % pick.cards.length;
  pick.cards.forEach((c, k) => {
    const selected = k === pick.sel;
    c.classList.toggle('sel', selected);
    c.setAttribute('aria-pressed', String(selected));
  });
  if (pick.mode === 'hero') {
    setPickClass(pickGroupIndex(pick.options[pick.sel]));
    const recommendation = game.mission && shouldRecommendMissionTeam(game.mission)
      ? `${difficulty.id === 'pesadelo' ? 'Sugestão Pesadelo' : 'Equipe recomendada'}: ${nightmareTeamPlanIds(game.mission, missionPartySize(game.mission)).map((id) => VARIANTS.find((cfg) => cfg.id === id)?.name || id).join(' + ')}`
      : '';
    $('pickHint').textContent = recommendation || PICK_HERO_HINT;
    renderInfo(pick.options[pick.sel]);
  } else if (pick.mode === 'difficulty') {
    const selected = pick.options[pick.sel];
    const recommendation = difficultyTeamRecommendation(selected, game.mission, game.mission ? missionPartySize(game.mission) : undefined);
    $('pickHint').textContent = recommendation || DIFFICULTY_PICK_HINT;
  }
}

function confirmPick(i) {
  if (!pick.open) return;
  hideTooltip();   // a dica do cartão não fica sobre a batalha
  if (pick.mode === 'evolution') return confirmEvolution(i);
  if (pick.mode === 'relic') return confirmRelic(i);
  if (pick.mode === 'difficulty') return confirmDifficulty(i);
  if (pick.mode === 'mode') return confirmMode(i);
  if (pick.mode === 'team') return confirmTeam(i);
  const cfg = pick.options[i];
  if (!isFree(cfg) || heroes().length >= MAX_PARTY) return;
  pick.open = false;
  pick.cards.forEach((c, k) => c.classList.add(k === i ? 'chosen' : 'gone'));
  for (let k = 0; k < 10; k++) {   // corações saindo do cartão escolhido
    const h = document.createElement('span');
    h.className = 'burst';
    h.textContent = '♥';
    const a = (k / 10) * Math.PI * 2;
    h.style.setProperty('--x', `${Math.cos(a) * 130}px`);
    h.style.setProperty('--y', `${Math.sin(a) * 130}px`);
    pick.cards[i].appendChild(h);
  }
  pick.timer = setTimeout(() => {
    $('pick').classList.add('hidden');
    if (game.arena) return arenaHeroPicked(cfg);   // modo Teste: monta a equipe sem missão
    const party = heroes(), first = game.picksLeft > 0;   // first: grupo inicial da missão
    // quem sai e volta na mesma troca não perde o progresso
    const kept = first && campaignTeamMode() ? loadCampaignTeam().find((entry) => entry.id === cfg.id) : null;
    if (kept) pick.leaving = (pick.leaving || []).filter((entry) => entry.id !== kept.id);
    // equipe contínua: quem entra herda o XP de quem saiu (vaga livre: nível 1); só a primeira montagem (sem equipe salva) entra no nível da missão
    const teamFill = first && !kept && campaignTeamMode() && loadCampaignTeam().length > 0;
    const xp = first ? (teamFill ? (pick.leaving?.shift()?.xp ?? 0) : XP_LEVELS[game.mission.level - 1]) : party.length ? party.reduce((sum, h) => sum + h.xp, 0) / party.length / 2 : 0;
    const h = kept ? restoreCampaignHero(kept) : new Hero(cfg);
    if (!kept) { arrangeParty(); h.gainXp(xp); }
    h.busy = h.once('Cheer') * 0.6;
    if (first) {
      rememberCampaignSquad();
      const next = () => {
        if (--game.picksLeft > 0) return showPick(pickTitle(), pickSub());
        if (campaignTeamMode()) storeCampaignTeam(heroes());
        startMission();
      };
      // troca na equipe contínua: o jogador distribui os pontos de quem entrou (a menos que a evolução seja automática)
      if (teamFill && evolutions.length && !autoEvolve) { pick.evoThen = next; return showEvolution(); }
      autoUpgrade();   // a missão já começa no nível certo, sem telas de evolução
      return next();
    }
    const begin = () => {
      if (heroes().length > 1) showBanner(`+ ${cfg.name}`);
      document.body.classList.remove('no-battle');
      game.paused = false;
      audio.startMusic();   // a partida começa com o primeiro herói (não faz nada se já estiver tocando)
    };
    if (typeof withBattleAssets === 'function') return withBattleAssets(begin);
    begin();
  }, 550);
}

// Uma escolha por vez, inclusive quando vários heróis ganham XP no mesmo golpe.
const evolutions = [];

// Relíquias: as de bônus simples acumulam; as únicas (unique) mudam o jeito de jogar e valem uma vez por partida.
// A raridade (comum/rara/épica) pesa no sorteio e dá a cor do cartão e do ícone no HUD.
// needs() tira da oferta o que não serve à equipe atual (ex.: bônus de mago sem mago).
const RELIC_RARITY = {
  comum: { name: 'Comum', weight: 6, c: '#e3e9f2', cd: '#67768c' },
  rara: { name: 'Rara', weight: 3, c: '#7cc4ff', cd: '#2a5aa6' },
  epica: { name: 'Épica', weight: 1.2, c: '#d99bff', cd: '#6a2fa6' },
};
const partyHas = (test) => heroes().some((h) => !h.dead && test(h));
const RELICS = [
  { id: 'keen-edge', short: '+12% de dano', name: 'Lâmina afiada', icon: '⚔', rarity: 'comum', desc: 'Heróis causam 12% mais dano pelo resto da partida.' },
  { id: 'vital-medallion', short: '+15% de vida máxima', name: 'Medalhão vital', icon: '♥', rarity: 'comum', desc: 'Aumenta a vida máxima em 15% e recupera essa quantidade para cada herói.' },
  { id: 'ember-heart', short: 'Abates podem explodir', name: 'Coração de brasa', icon: '✺', rarity: 'comum', unique: true, desc: 'Ao abater um inimigo, 25% de chance de ele explodir e ferir quem estiver por perto.' },
  { id: 'dawn-ward', short: 'Escudo a cada fase', name: 'Égide da aurora', icon: '◈', rarity: 'comum', unique: true, desc: 'No início de cada fase, cada herói ganha um escudo de 20% da vida máxima.' },
  { id: 'thorn-mail', short: 'Espinhos devolvem dano', name: 'Cota de espinhos', icon: '✶', rarity: 'comum', unique: true, desc: 'Inimigos corpo a corpo levam de volta 35% do dano que causam aos heróis.' },
  { id: 'bulwark-banner', short: 'Bloquear cura 5%', name: 'Estandarte do bastião', icon: '⛨', rarity: 'comum', unique: true, desc: 'Cada bloqueio recupera 5% da vida de quem bloqueou.', needs: () => partyHas(canBlock) },
  { id: 'first-spark', short: '1ª habilidade da fase grátis', name: 'Centelha inicial', icon: '⚡', rarity: 'rara', unique: true, desc: 'A primeira habilidade de cada herói em cada fase não entra em recarga.' },
  { id: 'phoenix-feather', short: 'Ultimate cura o grupo', name: 'Pena da fênix', icon: '❦', rarity: 'rara', unique: true, desc: 'Usar a ultimate cura 20% da vida de quem usou e dos aliados próximos.' },
  { id: 'ricochet-sling', short: 'Tiros ricocheteiam', name: 'Funda ricocheteante', icon: '↯', rarity: 'rara', unique: true, desc: 'Tiros comuns à distância ricocheteiam em mais um inimigo próximo (60% do dano).', needs: () => partyHas((h) => h.ranged && h.cfg.id !== 'crossbow') },
  { id: 'shadow-mark', short: 'Abates de Ladino aceleram recargas', name: 'Marca das sombras', icon: '☾', rarity: 'rara', unique: true, desc: 'Cada abate de um Ladino tira 2 s das recargas das habilidades dele.', needs: () => partyHas((h) => h.cfg.classId === 3) },
  { id: 'archmage-prism', short: 'Magos acertam +1 alvo', name: 'Prisma do arquimago', icon: '✧', rarity: 'epica', unique: true, desc: 'Magos acertam +1 alvo: o tiro comum se divide e os raios em cadeia saltam mais uma vez.', needs: () => partyHas((h) => h.cfg.classId === 2) },
  { id: 'last-oath', short: 'Escapa da morte por fase', name: 'Juramento final', icon: '✠', rarity: 'epica', unique: true, desc: 'Uma vez por fase, o herói que cairia fica com 1 de vida e invulnerável por 2 s.' },
];
const hasRelic = (id) => !!game.relics?.includes(id);
// quem bloqueia golpes (cavaleiros e vikings), usado no dano recebido e na oferta do estandarte
const canBlock = (h) => h.cfg.classId === 0 || h.cfg.id === 'viking' || h.cfg.id === 'iceviking';

function applyRelicToHero(hero, id) {
  if (id === 'keen-edge') hero.dmg *= 1.12;
  else if (id === 'vital-medallion') {
    const extra = Math.round(hero.maxHp * 0.15);
    hero.maxHp += extra;
    hero.hp = Math.min(hero.maxHp, hero.hp + extra);
  } else if (id === 'archmage-prism' && hero.cfg.classId === 2) hero.extraTargets = (hero.extraTargets || 0) + 1;
}

// ganchos das relíquias que mudam o jogo; cada um só age se a relíquia estiver na partida
function relicPhaseStart() {
  for (const h of heroes()) {
    if (h.dead) continue;
    h.freeCast = hasRelic('first-spark');
    h.oathUsed = false;
    h.relicShield = hasRelic('dawn-ward') ? Math.round(h.maxHp * 0.2) : 0;
    if (h.relicShield) popText(h.pos, 'Escudo!', 'block');
  }
}

function relicAfterCast(hero, slot, ultimate) {
  if (hero.freeCast) {
    hero.freeCast = false;
    hero.skillTimers[slot] = 0.5;
    popText(hero.pos, 'Centelha!', 'evolve');
  }
  if (ultimate && hasRelic('phoenix-feather')) for (const h of heroes()) {
    if (h.dead || h.pos.distanceTo(hero.pos) > 7) continue;
    const heal = Math.min(h.maxHp - h.hp, h.maxHp * 0.2);
    if (heal <= 0) continue;
    h.hp += heal;
    hero.stats.cura += heal;
    popText(h.pos, '+' + Math.round(heal), 'heal');
  }
}

// dano que chega a um herói: escudo da aurora absorve e juramento segura a queda; devolve o que sobra
function relicGuard(hero, n) {
  if (hero.relicShield > 0) {
    const soak = Math.min(n, hero.relicShield);
    hero.relicShield -= soak;
    n -= soak;
    if (n <= 0) { popText(hero.pos, 'Escudo', 'block'); return 0; }
  }
  if (hasRelic('last-oath') && !hero.oathUsed && n >= hero.hp && hero.hp > 1) {
    n = hero.hp - 1;
    hero.oathUsed = true;
    hero.oathUntil = game.runTime + 2;
    popText(hero.pos, 'Juramento!', 'evolve');
  }
  return n;
}

function relicOnKill(foe) {
  const killer = foe.lastHit?.team === 'hero' ? foe.lastHit : null;
  if (hasRelic('ember-heart') && !foe.totem && Math.random() < 0.25) {
    ring(foe.pos, 2.6, 0xff7a2e, 0.5);
    poof(foe.pos, 1.2);
    damageArea(foe.pos, 2.6, Math.max(14, (killer?.dmg || 18) * 0.8), killer);
  }
  if (hasRelic('shadow-mark') && killer?.cfg.classId === 3) {
    for (let slot = 0; slot < killer.skillTimers.length; slot++) killer.skillTimers[slot] = Math.max(0, killer.skillTimers[slot] - 2);
  }
}

// tiro comum de mago com o prisma: um segundo projétil vai para outro inimigo ao alcance
const relicExtraCandidates = [];
function relicExtraShot(hero, target) {
  if (!hero.extraTargets) return;
  const others = relicExtraCandidates;
  others.length = 0;
  const reach = hero.range + 1, reachSq = reach * reach;
  for (const enemy of units) {
    if (enemy.team === 'skeleton' && !enemy.dead && !enemy.spawning && enemy !== target
      && enemy.pos.distanceToSquared(hero.pos) <= reachSq) others.push(enemy);
  }
  for (let k = 0; k < hero.extraTargets && others.length; k++) {
    let nearestIndex = -1, nearestDistance = Infinity;
    for (let i = 0; i < others.length; i++) {
      const distance = others[i].pos.distanceToSquared(target.pos);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = i; }
    }
    if (nearestIndex < 0) break;
    const other = others[nearestIndex];
    others[nearestIndex] = others[others.length - 1];
    others.pop();
    fireBolt(hero, other, 'magic');
    const bolt = bolts.at(-1);
    if (bolt?.owner === hero) bolt.dmg *= 0.7;
  }
}

// funda ricocheteante: o tiro comum que acertou salta uma vez para o inimigo mais perto
function relicBounce(b) {
  if (!hasRelic('ricochet-sling') || b.skill || b.bounced || b.owner?.team !== 'hero') return;
  const from = b.target;
  let next = null, nearestDistance = Infinity;
  for (const enemy of units) {
    if (enemy.team !== 'skeleton' || enemy.dead || enemy.spawning || enemy === from) continue;
    const distance = enemy.pos.distanceToSquared(from.pos);
    if (distance <= 36 && distance < nearestDistance) { next = enemy; nearestDistance = distance; }
  }
  if (!next) return;
  fireBolt(b.owner, next, b.kind);
  const bolt = bolts.at(-1);
  if (bolt?.owner !== b.owner) return;
  bolt.mesh?.position.copy(from.pos).setY(from.pos.y + 1.1);
  bolt.dmg = b.dmg * 0.6;
  bolt.bounced = true;
}

// oferta contextual: tira únicas já pegas e o que não serve à equipe; a raridade pesa no sorteio
function relicPool() {
  return RELICS.filter((relic) => !(relic.unique && hasRelic(relic.id)) && (!relic.needs || relic.needs()));
}

function drawRelics(pool, n = 3, random = Math.random) {
  pool = [...pool];
  const options = [];
  while (options.length < n && pool.length) {
    let roll = random() * pool.reduce((sum, relic) => sum + RELIC_RARITY[relic.rarity].weight, 0);
    let i = pool.findIndex((relic) => (roll -= RELIC_RARITY[relic.rarity].weight) < 0);
    if (i < 0) i = pool.length - 1;
    options.push(pool.splice(i, 1)[0]);
  }
  return options;
}

function showRelicPick() {
  pick.mode = 'relic';
  pick.options = drawRelics(relicPool(), game.test ? 3 : progress.relicChoices());
  $('banner').style.opacity = 0;
  pick.open = true;
  game.paused = true;
  $('pickTitle').textContent = 'Relíquia encontrada!';
  setPickSub(`Fase ${game.phase}`);
  $('pickHint').textContent = '';   // 1–3 e Enter seguem valendo
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  pick.cards = pick.options.map((relic, i) => {
    const rarity = RELIC_RARITY[relic.rarity];
    const card = document.createElement('div');
    card.className = `card relic rarity-${relic.rarity}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${relic.name}, relíquia ${rarity.name.toLowerCase()}${relic.unique ? ', única' : ''}: ${relic.desc}`);
    card.setAttribute('data-tip', 'relic');
    card.setAttribute('data-relic', relic.id);
    card.style.setProperty('--c', rarity.c);
    card.style.setProperty('--cd', rarity.cd);
    card.style.setProperty('--d', `${i * 90}ms`);
    card.innerHTML = `<div class="num">${i + 1}</div><div class="relic-icon" aria-hidden="true">${relic.icon}</div><div class="ribbon">${relic.name}</div><p>${relic.short}</p>`;
    card.onclick = () => confirmPick(i);
    bindCard(card, i);
    list.appendChild(card);
    return card;
  });
  if (game.rerolls > 0) {   // Dados do mascate (oficina): sorteia outras relíquias
    const reroll = document.createElement('button');
    reroll.type = 'button';
    reroll.className = 'relic-reroll';
    reroll.textContent = `↻ ${game.rerolls}`;
    reroll.setAttribute('aria-label', `Trocar relíquias (${game.rerolls} restantes)`);
    reroll.setAttribute('data-tip', 'Trocar relíquias');
    reroll.onclick = () => { game.rerolls--; showRelicPick(); };
    list.appendChild(reroll);
  }
  selectCard(0);
  $('pick').classList.remove('hidden');
  tutorial.on('relic', { target: pick.cards[0] });
}

// relíquias ativas no HUD: um ícone por relíquia (com contagem); os detalhes ficam na dica
function renderRelicTray() {
  const tray = $('relics');
  const counts = new Map();
  for (const id of game.relics || []) counts.set(id, (counts.get(id) || 0) + 1);
  tray.innerHTML = [...counts].map(([id, n]) => {
    const relic = RELICS.find((r) => r.id === id);
    return relic ? `<span class="relic-slot rarity-${relic.rarity}" tabindex="0" data-tip="relic" data-relic="${id}" aria-label="${relic.name}${n > 1 ? ` ×${n}` : ''}: ${relic.desc}">${relic.icon}${n > 1 ? `<b>${n}</b>` : ''}</span>` : '';
  }).join('');
  tray.classList.toggle('hidden', !counts.size);
}

function relicTooltip(el) {
  const relic = RELICS.find((r) => r.id === el.getAttribute('data-relic'));
  if (!relic) return '';
  const n = (game.relics || []).filter((id) => id === relic.id).length;
  return `<div class="tt-relic rarity-${relic.rarity}"><header><span class="tt-icon" aria-hidden="true">${relic.icon}</span><div><b>${relic.name}</b><span class="tt-kind">Relíquia ${RELIC_RARITY[relic.rarity].name.toLowerCase()}${relic.unique ? ' · única' : ''}${n > 1 ? ` · ×${n}` : ''}</span></div></header><p class="tt-desc">${relic.desc}</p></div>`;
}

function confirmRelic(i) {
  const relic = pick.options[i];
  if (!relic) return;
  game.relics.push(relic.id);
  for (const hero of heroes()) applyRelicToHero(hero, relic.id);
  renderRelicTray();
  if (heroes()[0]) popText(heroes()[0].pos, `${relic.name}!`, 'evolve');
  pick.open = false;
  $('pick').classList.add('hidden');
  game.paused = false;
  if (heroes().length < 4 && !campaignTeamMode()) return showPick('Novo aliado!', 'Escolha quem entra no grupo');
  audio.startMusic();
}

function showEvolution() {
  if (!evolutions.length || pick.open || (game.paused && !pick.evoThen) || game.over) return;   // evoThen: evolução antes da missão, com o jogo parado
  if (autoEvolve) {
    while (evolutions.length && !game.over) {
      const entry = evolutions.shift();
      const option = chooseAutoEvolution(entry.hero);
      if (!option) continue;
      applyUpgrade(entry.hero, option);
      popText(entry.hero.pos, option.name + '!', 'evolve');
      showBanner(`${option.icon} ${option.name}`, 2);   // escolha automática visível
    }
    return;
  }
  const entry = evolutions[0], h = entry.hero, cfg = h.cfg;
  const done = pick.evoDone?.length || 0, total = done + evolutions.length;
  pick.mode = 'evolution';
  $('banner').style.opacity = 0;
  pick.open = true;
  game.paused = true;
  pick.upgrades = availableEvolutionBranches(h);
  const recommended = chooseAutoEvolution(h)?.id;
  $('pickTitle').textContent = 'Evolução!';
  setPickSub('');   // tudo vai num cartão só, dentro da lista
  $('pickHint').textContent = '';   // 1–3 e Enter seguem valendo
  $('pickList').innerHTML = '';
  $('pickList').classList.remove('grid');
  const card = document.createElement('div');
  card.className = 'evo-card';
  card.style.setProperty('--c', cfg.color[0]);
  card.style.setProperty('--cd', cfg.color[1]);
  card.innerHTML = `<header class="evo-top"><b class="evo-title">⬆︎ Evolução</b>${total > 1 ? evolutionQueueHTML(done + 1, total) : ''}</header>${evolutionHeroHTML(entry)}`;
  const routes = document.createElement('div');
  routes.className = 'evo-routes';
  card.appendChild(routes);
  $('pickList').appendChild(card);
  pick.cards = pick.upgrades.map((option, i) => {
    const gain = evolutionGain(h, option.id);
    const rec = option.id === recommended, name = option.name + (h.evolutionBranches?.[option.id] ? ' II' : '');   // 2º grau da rota (Nv4+)
    const tip = `${name}:${option.desc}${gain.weak ? ' Pouco efeito neste herói.' : ''}${rec ? ' ★ Sugerida para este herói e esta equipe.' : ''}`;
    const b = document.createElement('div');
    b.className = `evo-route${gain.weak ? ' weak' : ''}${rec ? ' recommended' : ''}`;
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.setAttribute('aria-label', `${name}: ${gain.label} ${gain.from ? `${gain.from} para ${gain.to}` : gain.to}. ${tip}`);
    b.setAttribute('data-tip', tip);
    b.innerHTML = `<kbd aria-hidden="true">${i + 1}</kbd><span class="evo-route-icon" aria-hidden="true">${option.icon}</span>`
      + `<span class="evo-route-name" aria-hidden="true">${name}<small>${gain.label}</small></span>`
      + `<span class="evo-gain" aria-hidden="true">${gain.from ? `<s>${gain.from}</s><em>→</em>` : ''}<b>${gain.to}</b></span>`
      + (rec ? '<span class="evo-rec" aria-hidden="true">★</span>' : '');
    b.onclick = () => confirmPick(i);
    b.onmouseenter = () => selectCard(i);
    routes.appendChild(b);
    return b;
  });
  selectCard(Math.max(0, pick.upgrades.findIndex((option) => option.id === recommended)));
  $('pick').classList.remove('hidden');
}

// destaque de quem evolui: retrato com raios, nome e nível antes → depois e o ganho de vida/dano do nível
function evolutionHeroHTML(entry) {
  const h = entry.hero, cfg = h.cfg, level = entry.level;
  const gain = levelGain(level), pct = Math.round((gain - 1) * 100);
  const hp = entry.hp || [Math.round(h.maxHp / gain), h.maxHp], dmg = entry.dmg || [h.dmg / gain, h.dmg];
  const img = heroLevelPortrait(cfg, level);
  const oldName = heroLevelName(cfg, level - 1), newName = heroLevelName(cfg, level);
  const stat = (glyph, tip, [a, b]) => `<span class="evo-stat" data-tip="${tip} +${pct}%"><i aria-hidden="true">${glyph}</i>${Math.round(a)}<em>→</em><b>${Math.round(b)}</b></span>`;
  return `<span class="evo-hero ${levelTierClass(level)}" style="--c:${cfg.color[0]};--cd:${cfg.color[1]}" aria-label="${attrText(`${oldName} evolui para ${newName}, nível ${level}`)}">
    <span class="evo-portrait"><span class="evo-rays" aria-hidden="true"></span><img src="${img}" alt=""><span class="evo-class" aria-hidden="true">${PICK_CLASS_GLYPHS[cfg.classId] || '♜'}</span></span>
    <span class="evo-info">
      <span class="evo-names">${oldName === newName ? '' : `<s>${attrText(oldName)}</s><em>→</em>`}<b>${attrText(newName)}</b></span>
      <span class="evo-level"><s>Nv${level - 1}</s><em>→</em><b>Nv${level}</b></span>
      <span class="evo-stats">${stat('♥', 'Vida máxima', hp)}${stat('⚔', 'Dano', dmg)}</span>
    </span></span>`;
}

// vários heróis subindo juntos: posição na fila e o retrato de cada um (feitos ✓, o atual em destaque, os que esperam)
function evolutionQueueHTML(position, total) {
  const faces = [...(pick.evoDone || []), ...evolutions].map((entry, k) => {
    const cfg = entry.hero.cfg, state = k < position - 1 ? ' done' : k === position - 1 ? ' now' : '';
    const tier = levelTierClass(entry.level);
    return `<span class="evo-face${state}${tier ? ` ${tier}` : ''}" style="--c:${cfg.color[0]};--cd:${cfg.color[1]}" data-tip="${attrText(`${heroLevelName(cfg, entry.level)} · Nv${entry.level}`)}"><img src="${heroLevelPortrait(cfg, entry.level)}" alt=""></span>`;
  }).join('');
  return `<span class="evo-queue"><b>${position}/${total}</b>${faces}</span>`;
}

// o que cada rota faz por ESTE herói, em número (antes → depois); weak = quase nada a ganhar
const SIGNATURE_HEAL = { paladin: (level) => 32 + level * 10, cleric: (level) => 24 + level * 8, angel: (level) => 18 + level * 5 };
function evolutionGain(hero, id) {
  const branch = EVOLUTION_BRANCHES.find((b) => b.id === id), bonus = branch?.bonus || {};
  const power = hero.skillPower || 1, { controlSkills, supportSkills, control, support } = evolutionAffinity(hero);
  if (id === 'damage') {
    const dps = hero.dmg * (hero.haste || 1) / (hero.cfg.cooldown || 1);
    return { label: 'DPS', from: Math.round(dps), to: Math.round(dps * (1 + (bonus.damage || 0)) * (1 + (bonus.haste || 0))) };
  }
  const k = 1 + (bonus[id] || 0), percent = `+${Math.round((k - 1) * 100)}%`;
  if (id === 'support' && SIGNATURE_HEAL[hero.cfg.id]) {
    const heal = scaleBranchEffect(hero, 'support', SIGNATURE_HEAL[hero.cfg.id](skillLevel(hero.level))) * power;
    return { label: 'Cura', from: Math.round(heal), to: Math.round(heal * k) };
  }
  const skills = id === 'control' ? controlSkills : supportSkills;
  if (!(id === 'control' ? control : support)) return { label: '—', to: percent, weak: true };   // quase nada no kit: apagado
  const timed = skills.find((skill) => skill.duration);
  if (timed) {
    const seconds = scaleBranchEffect(hero, id, timed.duration);
    const sec = (n) => `${(Math.round(n * 10) / 10).toLocaleString('pt-BR')}s`;
    return { label: timed.name, from: sec(seconds), to: sec(seconds * k) };
  }
  return { label: skills[0]?.name || (id === 'control' ? 'Controle' : 'Apoio'), to: percent };
}

// quanto o kit do herói aproveita controle e apoio (mesma conta da escolha automática)
function evolutionAffinity(hero) {
  const controlEffects = new Set(['shield-ricochet', 'march-decree', 'bastion', 'ward', 'frost-ward', 'frost-guard', 'storm-cloud', 'gravity-collapse', 'blizzard', 'roots-heal', 'nature-storm', 'wind-palm',
    'shield-rush', 'royal-edict', 'war-cry', 'snare-trap', 'thorn-vines', 'magnet-pull', 'harpoon', 'boulder', 'seismic-grab', 'omen', 'root-totem', 'geo-wall', 'mirror-swap', 'mirror-hall', 'mirage']);
  const supportEffects = new Set(['holy-nova', 'light-legion', 'roots-heal', 'nature-storm', 'summon', 'meditate', 'volatile',
    'oath-link', 'protection-vow', 'loaded-dice', 'bluff', 'rewind', 'giant-elixir', 'life-drain', 'bone-pact', 'reap-mark', 'blood-bond', 'blood-eclipse', 'blood-kiss', 'daily-plate', 'feast', 'ancestral-totem', 'follow-spirit']);
  const controlSignatures = new Set(['guardian', 'crusher', 'iceviking', 'pyro', 'cryo', 'druid', 'cleric', 'chronist', 'monk', 'alchemist', 'geomancer', 'illusionist']);
  const supportSignatures = new Set(['paladin', 'cleric', 'druid', 'angel', 'necro', 'monk', 'alchemist', 'summoner', 'vampire', 'cook', 'shaman']);
  const skills = skillSetFor(hero.cfg);
  const controlSkills = skills.filter((skill) => skill.control || controlEffects.has(skill.effect));
  const supportSkills = skills.filter((skill) => supportEffects.has(skill.effect));
  return {
    controlSkills, supportSkills,
    control: controlSkills.length + Number(controlSignatures.has(hero.cfg.id)),
    support: supportSkills.length + Number(supportSignatures.has(hero.cfg.id)),
  };
}

function chooseAutoEvolution(hero) {
  const { control, support } = evolutionAffinity(hero);
  const available = availableEvolutionBranches(hero);
  if (!available.length) return null;
  const ranks = hero.evolutionBranches || {};
  const teammates = heroes().filter((member) => member !== hero).map((member) => member.cfg);
  const teamRoles = teamCoverage(teammates).roles;
  const ownRoles = new Set(teamCoverage([hero.cfg]).roles.filter((role) => role.count > 0).map((role) => role.name));
  const roleCount = (role) => teamRoles.find((entry) => entry.name === role)?.count || 0;
  const missionNeeds = new Set(missionRoleNeeds(game.mission?.goal));
  const gapBonus = (role, capable) => {
    if (!capable || roleCount(role) > 0) return 0;
    return missionNeeds.has(role) ? 0.85 : 0.2;
  };
  const damageGap = ['Área', 'Dano a chefe'].some((role) => ownRoles.has(role) && missionNeeds.has(role) && roleCount(role) === 0);
  const scores = {
    damage: 1.2 + Number(damageGap) * 0.45 - (ranks.damage || 0) * 0.12,
    control: (control ? 0.7 + control * 0.75 + gapBonus('Controle', true) : 0.1) - (ranks.control || 0) * 0.12,
    support: (support ? 0.7 + support * 0.75 + gapBonus('Cura', ownRoles.has('Cura')) : 0.1) - (ranks.support || 0) * 0.12,
  };
  return available.reduce((best, branch) => scores[branch.id] > scores[best.id] ? branch : best, available[0]);
}

function availableEvolutionBranches(hero) {
  const limit = branchRankLimit(hero);
  return EVOLUTION_BRANCHES.filter((branch) => (hero.evolutionBranches?.[branch.id] || 0) < limit);
}

function confirmEvolution(i) {
  const entry = evolutions[0], option = pick.upgrades[i];
  if (!entry || !option || (EVOLUTION_BRANCHES.some((branch) => branch.id === option.id) && !availableEvolutionBranches(entry.hero).some((branch) => branch.id === option.id))) return;
  const h = evolutions.shift().hero;
  applyUpgrade(h, option);
  popText(h.pos, option.name + '!', 'evolve');
  pick.open = false;
  $('pick').classList.add('hidden');
  const then = pick.evoThen;
  if (!then) game.paused = false;
  pick.evoDone = evolutions.length ? [...(pick.evoDone || []), entry] : [];   // quem já evoluiu nesta fila ("1/2")
  if (then && !evolutions.length) { pick.evoThen = null; return then(); }   // antes da missão: terminou a fila, segue a montagem
  showEvolution();
}

// no começo da missão as evoluções seguem as mesmas rotas da partida (escolha automática pelo perfil), sem abrir a tela
function autoUpgrade() {
  while (evolutions.length) {
    const h = evolutions.shift().hero;
    const option = chooseAutoEvolution(h);
    if (option) applyUpgrade(h, option);
  }
}

function applyUpgrade(h, option) {
  const branch = applyEvolutionBranch(h, option.id);
  if (!branch) return;
  if (branch.damage) h.dmg *= 1 + branch.damage;
  if (branch.haste) h.haste *= 1 + branch.haste;
  if (branch.control) h.controlPower *= 1 + branch.control;
  if (branch.support) h.supportPower *= 1 + branch.support;
}

function arrangeParty() {
  const party = heroes(), slots = [0, 1, 2, 3];
  // A posição não depende da ordem em que o jogador escolheu a mesma equipe:
  // os corpos frágeis ficam atrás, os mais resistentes cobrem a frente.
  const stableId = (hero) => String(hero.cfg?.id || '');
  const durability = (hero) => (hero.maxHp || 0) + (hero.armor || 0) * 30;
  const backline = party.filter((h) => h.ranged).sort((a, b) => durability(a) - durability(b) || stableId(a).localeCompare(stableId(b)));
  const melee = party.filter((h) => !h.ranged).sort((a, b) => Number(!!b.cfg.frontline) - Number(!!a.cfg.frontline)
    || durability(b) - durability(a) || stableId(a).localeCompare(stableId(b)));
  // escolta/resgate: o guarda do protegido fica no posto de trás, colado no aldeão
  const goal = game.mission?.goal.type;
  const guard = goal === 'escort' || goal === 'rescue' || goal === 'defend' ? escortGuardOf(party) : null;
  const order = [...backline, ...melee];
  if (guard) { guard.formation = POSTS[3]; guard.setAnchor(game.guideS); slots.pop(); }
  for (const h of order) {
    if (h === guard) continue;
    const slot = h.ranged ? slots.pop() : slots.shift();
    h.formation = POSTS[slot];
    h.setAnchor(game.guideS);
  }
}

addEventListener('keydown', (e) => {
  if (!pick.open) return;
  if (e.key === 'Escape' && (pick.mode === 'difficulty' || pick.mode === 'team')) { e.stopImmediatePropagation(); return game.arena ? startGame() : game.mission ? showCampaign() : showMenu(); }
  if (e.key === 'Escape' && pick.mode === 'evolution' && pick.evoThen) { e.stopImmediatePropagation(); return startGame('map'); }   // desiste da montagem: limpa fila e grupo
  if (e.target.closest?.('.team-go') && (e.key === 'Enter' || e.key === ' ')) return;   // Enter no botão segue com a equipe
  if (pick.mode === 'team' && missionPartySize(game.mission) > 1 && e.key === 'Enter') return startTeam();   // Enter segue; Espaço e 1–4 marcam quem sai
  const grid = pick.mode === 'hero';
  const classFilter = grid ? e.target.closest?.('.pick-filter') : null;
  if (classFilter) {
    if (e.key === 'Enter' || e.key === ' ') return; // o botão de classe não confirma a escolha do herói
    const filterIndex = pick.classFilters.indexOf(classFilter);
    const direction = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (direction) {
      pick.classFilters[(filterIndex + direction + pick.classFilters.length) % pick.classFilters.length]?.focus();
      e.preventDefault();
    } else if (e.key.startsWith('Arrow')) e.preventDefault();
    return;
  }
  if (grid && e.target.closest?.('.hero-select-btn') && (e.key === 'Enter' || e.key === ' ')) return;
  if (e.target.closest?.('.relic-reroll') && (e.key === 'Enter' || e.key === ' ')) return;   // Enter no ↻ troca as relíquias
  const dockStep = (d) => { const at = MENU_DOCK_ORDER.indexOf(pick.sel); selectCard(MENU_DOCK_ORDER[(at + d + MENU_DOCK_ORDER.length) % MENU_DOCK_ORDER.length]); };
  if (e.key === 'ArrowLeft') grid ? moveGrid(-1, 0) : pick.mode === 'mode' ? dockStep(-1) : selectCard(pick.sel - 1);
  else if (e.key === 'ArrowRight') grid ? moveGrid(1, 0) : pick.mode === 'mode' ? dockStep(1) : selectCard(pick.sel + 1);
  else if (e.key === 'ArrowUp' && grid) moveGrid(0, -1);
  else if (e.key === 'ArrowDown' && grid) moveGrid(0, 1);
  else if (e.key === 'Enter' || e.key === ' ') confirmPick(pick.sel);
  else if (!grid && /^[1-4]$/.test(e.key) && +e.key <= pick.cards.length) confirmPick(+e.key - 1);
  else return;
  // o foco do teclado acompanha a seleção (nos cartões de modo/dificuldade, se já estiver num deles)
  if (e.key.startsWith('Arrow') && (grid || document.activeElement?.classList?.contains('card') || document.activeElement?.classList?.contains('menu-btn'))) {
    pick.cards[pick.sel].scrollIntoView({ block: 'nearest' });
    pick.cards[pick.sel].focus({ preventScroll: true });
  }
  e.preventDefault();
});

// retrato de cada herói: o próprio modelo 3D renderizado numa imagem
function canvasImageURL(canvas) {
  if (!canvas.toBlob || !URL.createObjectURL) return Promise.resolve(canvas.toDataURL());
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Não foi possível preparar o retrato do herói.'));
      try { resolve(URL.createObjectURL(blob)); } catch (error) { reject(error); }
    }, 'image/png');
  });
}

// Os retratos saem sob demanda: o menu abre na hora, quem aparece na tela fura a fila
// e o resto é desenhado em segundo plano. Ficam em memória (blob URLs) pela sessão.
const portraitQueue = [], portraitUrgent = [];
let portraitStudio = null, portraitPumping = false;

// imagem transparente própria de cada herói/nível; trocada pelo retrato quando ele fica pronto
const portraitPlaceholder = (cfg, level) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' data-p='${cfg.id}-${level}'/%3E`;

function portraitURL(cfg, level) {
  const url = cfg.portraitURLs[level - 1];
  if (url) return url;
  if (!cfg.portraitFailed && !portraitUrgent.includes(cfg)) { portraitUrgent.push(cfg); setTimeout(pumpPortraits, 0); }
  return portraitPlaceholder(cfg, level);
}

// cfg.portrait e cfg.portraits seguem valendo nos templates; sem retrato ainda, devolvem o marcador
function preparePortraits() {
  for (const cfg of VARIANTS) {
    cfg.portraitURLs = [];
    Object.defineProperty(cfg, 'portrait', { configurable: true, get: () => portraitURL(cfg, 1) });
    Object.defineProperty(cfg, 'portraits', { configurable: true, get: () => [1, 2, 3].map((level) => portraitURL(cfg, level)) });
    portraitQueue.push(cfg);
  }
  setTimeout(pumpPortraits, 0);   // o resto começa depois que o menu aparece
}

function portraitStudioFor() {
  if (portraitStudio) return portraitStudio;
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(336, 336);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff4dc, 0x553322, 2.2));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.6);
  key.position.set(2, 4, 3);
  sc.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(1.72, 2.3, 5.15);   // afastada o bastante para chapéus altos e a auréola do nível 3
  cam.lookAt(0, 1.38, 0);
  return (portraitStudio = { r, sc, cam });
}

async function renderPortrait(cfg) {
  const { r, sc, cam } = portraitStudioFor();
  const built = cfg.built;
  const model = SkeletonUtils.clone(built.scene);
  model.traverse((o) => { if (cfg.hide.includes(o.name)) o.visible = false; });
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(THREE.AnimationClip.findByName(built.animations, cfg.idle)).play();
  mixer.update(0.4);
  sc.add(model);
  const halo = new THREE.Mesh(haloGeo, goldMat);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 2.5;
  model.add(halo);
  try {
    for (let level = 1; level <= 3; level++) {
      model.scale.setScalar(1 + (level - 1) * 0.08);
      halo.visible = level === 3;
      r.render(sc, cam);
      const url = await canvasImageURL(r.domElement);
      cfg.portraitURLs[level - 1] = url;
      // troca o marcador nas imagens que já estão na tela
      const placeholder = portraitPlaceholder(cfg, level);
      for (const img of document.images) if (img.getAttribute('src') === placeholder) img.src = url;
    }
  } finally {
    sc.remove(model);
  }
}

async function pumpPortraits() {
  if (portraitPumping) return;
  portraitPumping = true;
  try {
    for (;;) {
      let cfg = portraitUrgent.shift();
      // a fila de fundo espera a batalha pausar: cada retrato lê a imagem da GPU (trava o quadro);
      // os pedidos urgentes (retratos que já estão na tela) seguem na hora
      while (!cfg && portraitQueue.length && !game.paused && !document.body.classList.contains('no-battle')) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        cfg = portraitUrgent.shift();
      }
      cfg ||= portraitQueue.shift();
      if (!cfg) break;
      if (cfg.portraitURLs.length === 3 || cfg.portraitFailed) continue;
      try { await renderPortrait(cfg); } catch (error) {
        cfg.portraitFailed = true;
        console.warn(`Não foi possível preparar o retrato de ${cfg.name}:`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));   // um herói por vez, sem travar o menu
    }
  } finally { portraitPumping = false; }
  // todos prontos: o renderizador dos retratos pode sair
  if (portraitStudio && VARIANTS.every((cfg) => cfg.portraitURLs.length === 3 || cfg.portraitFailed)) {
    portraitStudio.r.dispose();
    portraitStudio = null;
  }
}

// ---------- barra de habilidades: três botões por herói, incluindo ultimate ----------
let skillItems = [], skillHeroes = [];
const skillParty = [], skillRoster = [];
const LADINO_ULTS = new Map([['blade-dance', 'area'], ['shadow-storm', 'area'], ['arrow-rain', 'area'], ['sentry-overcharge', 'area'], ['panic', 'area'], ['all-in', 'area'], ['execute', 'single'], ['hunter-mark', 'single']]);
const SKILL_AI_ORDER = [2, 1, 3, 0];   // a IA tenta ultimate, técnica, segunda técnica e por fim a assinatura
const hasPriorityEnemyRole = (s) => !!(s.boss || s.totem || ['Bomber', 'Priest'].includes(s.enemyKind) || s.kind?.priority);
const isPriorityEnemy = (s) => !s.dead && !s.spawning && hasPriorityEnemyRole(s);   // alvo prioritário da Caçada em Matilha
const enemyThreatensAlly = (s) => ['hero', 'villager'].includes(s.pendingHit?.target?.team);
const isUrgentEnemy = (s, includeInterruptible = false) => hasPriorityEnemyRole(s) || enemyThreatensAlly(s)
  || (includeInterruptible && s.telegraph?.interruptible && s.telegraph.t > 0);
const SHIELD_WEAK = 0.25;   // Escudo Ricochete: −25% de dano do inimigo contra aliados
const MARCH_SPEED = 0.2, MARCH_HASTE = 0.3;   // Decreto de Marcha: +20% de velocidade e recargas 30% mais rápidas
const SKILLS_USEFUL_WITHOUT_ENEMIES = new Set(['holy-nova', 'roots-heal', 'nature-storm', 'meditate', 'rewind', 'chi-transfer', 'oath-link', 'feast', 'ancestral-totem']);

function buildSkillBar(party) {
  const bar = $('skills');
  bar.innerHTML = '';
  skillItems = [];
  skillHeroes = [];
  party.forEach((h, heroIndex) => {
    const group = document.createElement('div');
    group.className = 'skillGroup';
    group.style.setProperty('--c', h.cfg.color[0]);
    group.style.setProperty('--cd', h.cfg.color[1]);
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', h.cfg.name);
    // retrato com anel de vida, ícone da classe e nível; o nome fica só na dica
    group.innerHTML = `<div class="skillHero" data-tip="${h.cfg.name}"><span class="skillHeroRing"><span><img alt=""></span></span><span class="skillHeroClass" aria-hidden="true">${PICK_CLASS_GLYPHS[h.cfg.classId] || '♜'}</span><b class="skillHeroLevel"></b></div><div class="skillSlots"></div>`;
    skillHeroes.push({ h, box: group.querySelector('.skillHero'), ring: group.querySelector('.skillHeroRing'), img: group.querySelector('.skillHeroRing img'), lvl: group.querySelector('.skillHeroLevel'), hp: '', level: 0 });
    const slots = group.querySelector('.skillSlots');
    for (const skill of skillSetFor(h.cfg)) {
      const slot = skill.slot, key = SKILL_KEYS[slot]?.[heroIndex] || '';   // slot sem tecla definida fica só no clique
      const b = document.createElement('div');
      b.className = `skill slot-${slot}${skill.ultimate ? ' ultimate' : ''}`;
      b.style.setProperty('--c', h.cfg.color[0]);
      b.style.setProperty('--cd', h.cfg.color[1]);
      b.setAttribute('data-tip', 'skill');
      b.setAttribute('data-hero', h.cfg.id);
      b.setAttribute('data-slot', String(slot));
      b.setAttribute('data-key', key);
      const glyph = SKILL_GLYPHS[h.cfg.id]?.[slot] || ['✦', '⚔', '☼', '✧'][slot];
      // dois botões irmãos (usar e auto): botão dentro de botão não é acessível; nome e tipo ficam na dica
      b.innerHTML = `<span class="key" aria-hidden="true">${key}</span><button type="button" class="auto" data-tip="Uso automático: liga e desliga" aria-label="Uso automático de ${skill.name}" aria-pressed="true">↻</button>
        <button type="button" class="use" aria-label="${h.cfg.name}: ${skill.name}, ${skill.ultimate ? 'ultimate' : slot === 0 ? 'assinatura' : 'técnica'}.${key ? ` Tecla ${key}.` : ''}"><span class="face"><img alt=""><span class="glyph" aria-hidden="true">${glyph}</span><span class="cd"></span><b class="secs"></b></span></button>`;
      const it = { h, skill, slot, key, b, keyEl: b.querySelector('.key'), use: b.querySelector('.use'), img: b.querySelector('img'), cd: b.querySelector('.cd'), secs: b.querySelector('.secs'), auto: b.querySelector('.auto'), level: 0, p: '', nopeT: 0, controlKey: null, classStates: {} };
      b.querySelector('.use').onclick = () => pressSkill(it);
      it.auto.onclick = (e) => {
        e.stopPropagation();
        h.autoSkills[slot] = !h.autoSkills[slot];
        h.skillTargets[slot] = null;
        h.skillRequests[slot] = 0;
        h.skillManuals[slot] = false;
        if (aiming?.hero === h && slot === 0) cancelAim();
        saveAuto(h.cfg.id, h.autoSkills[slot], slot);
        audio.play('click');
      };
      slots.appendChild(b);
      skillItems.push(it);
    }
    bar.appendChild(group);
  });
}

function syncSkillClass(it, name, active) {
  if (it.classStates[name] === active) return;
  it.b.classList.toggle(name, active);
  it.classStates[name] = active;
}

function pressSkill(it) {
  const { h, slot } = it;
  if (!h.autoSkills[slot] && slot === 0 && aimSpec(h) && !h.dead && !game.over && !game.paused && h.skillTimers[slot] <= 0 && game.state === 'fight') {
    if (aiming?.hero === h) cancelAim();
    else beginAim(h, slot);
    audio.play('click');
    return;
  }
  cancelAim();
  const r = h.requestSkill(null, slot);
  audio.play('click');
  if (r !== 'ok') it.nopeT = performance.now() + 400;   // caído ou recarregando: o botão balança
}

function updateSkillBar() {
  skillParty.length = 0;
  for (const unit of units) if (unit.team === 'hero') skillParty.push(unit);
  let rosterChanged = skillParty.length !== skillRoster.length;
  if (!rosterChanged) for (let i = 0; i < skillParty.length; i++) {
    if (skillParty[i] !== skillRoster[i]) { rosterChanged = true; break; }
  }
  if (rosterChanged) {
    buildSkillBar(skillParty);
    skillRoster.length = skillParty.length;
    for (let i = 0; i < skillParty.length; i++) skillRoster[i] = skillParty[i];
  }
  syncSkillControlKeys();
  const now = performance.now();
  for (const sh of skillHeroes) {
    const { h } = sh;
    if (sh.level !== h.level) {
      sh.level = h.level; sh.img.src = heroLevelPortrait(h.cfg, h.level); sh.lvl.textContent = String(h.level);
      sh.box.className = `skillHero ${levelTierClass(h.level)}`.trim();   // Nv4 prata, Nv5 ouro: moldura e selo
    }
    const hp = (h.dead ? 0 : THREE.MathUtils.clamp(h.hp / h.maxHp, 0, 1)).toFixed(2);
    if (hp !== sh.hp) { sh.hp = hp; sh.ring.style.setProperty('--hp', hp); }
  }
  for (const it of skillItems) {
    const { h, slot } = it;
    if (it.level !== h.level) { it.level = h.level; it.img.src = heroLevelPortrait(h.cfg, h.level); }
    const timer = h.skillTimers[slot], max = h.skillMaxes[slot];
    const ready = !h.dead && timer <= 0;
    if (ready && !h.autoSkills[slot] && !game.paused && !game.over && game.state === 'fight') tutorial.on('skillReady', { target: it.b, auto: false });
    const p = (h.dead ? 1 : THREE.MathUtils.clamp(timer / max, 0, 1)).toFixed(3);
    if (p !== it.p) { it.p = p; it.cd.style.setProperty('--p', p); }
    const secs = h.dead ? '✖' : ready ? '' : String(Math.ceil(timer));
    if (it.secs.textContent !== secs) it.secs.textContent = secs;
    const auto = h.autoSkills[slot] ? '↻' : '☝\uFE0E';
    if (it.auto.textContent !== auto) { it.auto.textContent = auto; it.auto.setAttribute('aria-pressed', String(!!h.autoSkills[slot])); }
    syncSkillClass(it, 'ready', ready);
    syncSkillClass(it, 'cooling', !ready && !h.dead);
    syncSkillClass(it, 'down', h.dead);
    syncSkillClass(it, 'manual', !h.autoSkills[slot]);
    syncSkillClass(it, 'aiming', aiming?.hero === h && slot === 0);
    syncSkillClass(it, 'nope', h.noTarget > 0 || now < it.nopeT);
  }
}

// dica rica das habilidades (escolha de herói e barra de batalha): nível atual, próximo nível e alvo
const SKILL_KIND = [['basic', 'Básica'], ['technique', 'Técnica'], ['ultimate', 'Ultimate']];
const CONTROL_TEXT = { stun: 'Atordoa', slow: 'Desacelera', root: 'Prende no lugar', push: 'Empurra', burn: 'Queima', mark: 'Marca o alvo', sheep: 'Vira ovelha' };
const num = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
function skillTooltip(el) {
  const cfg = VARIANTS.find((v) => v.id === el.getAttribute('data-hero'));
  const slot = Number(el.getAttribute('data-slot'));
  const skill = cfg && skillSetFor(cfg).find((item) => item.slot === slot);
  if (!skill) return '';
  const hero = heroes().find((h) => h.cfg.id === cfg.id);
  const level = hero?.level || 1, maxLevel = MAX_HERO_LEVEL, rate = hero?.skillRate || 1;
  const [kindId, kindName] = SKILL_KIND[skill.ultimate ? 2 : slot > 0 ? 1 : 0];
  const glyph = SKILL_GLYPHS[cfg.id]?.[slot] || ['✦', '⚔', '☼', '✧'][slot];
  const facts = [['Recarga', `${num(cooldownForSkill(cfg, slot, level, rate))} s`]];
  if (slot === 0) {
    const aim = aimSpec(hero || { cfg, level, skillPower: 1, range: cfg.range });
    facts.push(['Alvo', aim ? `${aim.mode === 'enemy' ? 'Inimigo' : 'Ponto no chão'} · alcance ${num(aim.range)} m` : 'Automático']);
    if (aim?.radius > 0.7) facts.push(['Área', `raio ${num(aim.radius)} m`]);
  } else {
    if (skill.radius) facts.push(['Área', `raio ${num(skill.radius * (hero?.skillPower || 1))} m`]);
    if (skill.shots) facts.push(['Projéteis', skill.shots]);
    if (skill.jumps) facts.push(['Saltos', skill.jumps]);
    if (skill.count) facts.push(['Invocações', skill.count]);
    if (skill.duration) facts.push(['Duração', `${num(skill.duration)} s`]);
    if (skill.bonus) facts.push(['Bônus de dano', `+${Math.round(skill.bonus * 100)}%`]);
    if (skill.power) facts.push(['Força', `×${num(skill.power * (hero?.skillPower || 1))}`]);
  }
  if (skill.control) facts.push(['Efeito', CONTROL_TEXT[skill.control] || skill.control]);
  const key = el.getAttribute('data-key');
  if (key) facts.push(['Tecla', key]);
  const next = level < SKILL_LEVEL_CAP
    ? `<p class="tt-next"><b>Nv ${level + 1}</b> recarga ${num(cooldownForSkill(cfg, slot, level + 1, rate))} s${slot === 0 ? ' · mais forte' : ''}</p>`
    : `<p class="tt-next"><b>${level < maxLevel ? 'Habilidade no máximo' : 'Nível máximo'}</b></p>`;
  const routes = Object.entries(hero?.evolutionBranches || {}).map(([id, rank]) => {
    const branch = EVOLUTION_BRANCHES.find((b) => b.id === id);
    return branch && { ...branch, name: branch.name + (rank > 1 ? ' II' : '') };
  }).filter(Boolean);
  return `<div class="tt-skill tt-${kindId}">
    <header><span class="tt-icon" aria-hidden="true">${glyph}</span><div><b>${skill.name}</b><span class="tt-kind">${kindName} · Nv ${level}</span></div></header>
    <p class="tt-desc">${skill.description}</p>
    <dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${next}
    ${routes.length ? `<p class="tt-routes">${routes.map((r) => `${r.icon} ${r.name}: ${r.desc}`).join('<br>')}</p>` : ''}
  </div>`;
}
registerTooltip('skill', skillTooltip);
registerTooltip('relic', relicTooltip);
initTooltips();

addEventListener('keydown', (e) => {
  if (e.key === 'Shift') document.body.classList.add('show-keys');   // segurar Shift mostra as teclas das habilidades
  if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')
    || pick.open || game.over || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !/^[1-4qwerasdfzxvb]$/i.test(e.key)) return;
  const key = e.key.toUpperCase();
  const it = skillItems.find((item) => item.key === key);
  if (it) pressSkill(it);
});
// teclas das habilidades ficam escondidas; aparecem ao segurar Shift (ou ao passar o mouse na barra)
addEventListener('keyup', (e) => { if (e.key === 'Shift') document.body.classList.remove('show-keys'); });
addEventListener('blur', () => document.body.classList.remove('show-keys'));

// o navegador só libera o som depois de um clique ou tecla
addEventListener('pointerdown', () => audio.unlock(), true);
addEventListener('keydown', () => audio.unlock(), true);
function paintMute() {
  $('mute').classList.toggle('off', audio.isMuted());
  $('mute').setAttribute('aria-label', audio.isMuted() ? 'Ligar o som' : 'Desligar o som');
}
$('mute').onclick = () => { audio.setMuted(!audio.isMuted()); paintMute(); hideSoundHint(); audio.play('click'); };
paintMute();
// o som começa desligado: no primeiro clique ou tecla, uma dica discreta aponta o alto-falante (sem ligar sozinho)
let soundHintShown = false;
function hideSoundHint() { $('soundHint').hidden = true; $('mute').classList.remove('hint'); }
function showSoundHint(e) {
  if (soundHintShown || !audio.isMuted() || e.target.closest?.('#mute')) return;
  soundHintShown = true;
  $('soundHint').hidden = false;   // a frase fica só para leitores de tela; na tela o alto-falante pulsa
  $('mute').classList.add('hint');
  setTimeout(hideSoundHint, 5000);
}
addEventListener('pointerdown', showSoundHint, true);
addEventListener('keydown', showSoundHint, true);

// ---------- carregamento ----------
const loader = new GLTFLoader();
const load = (file) => loader.loadAsync(`assets/${file}`);
const assets = {};
const assetKey = (file) => file.replace(/\.(glb|gltf)$/, '');
// esqueletos KayKit 1.1: modelos sem animação + clipes do Rig_Medium (ver skeletonModel)
const BATTLE_ASSET_FILES = ['kaykit/skeletons/Characters/gltf/Skeleton_Minion.glb', 'kaykit/skeletons/Characters/gltf/Skeleton_Warrior.glb',
  'kaykit/skeletons/Characters/gltf/Skeleton_Rogue.glb', 'kaykit/skeletons/Characters/gltf/Skeleton_Mage.glb',
  'kaykit/animations/Animations/gltf/Rig_Medium/Rig_Medium_General.glb', 'kaykit/animations/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb',
  'kaykit/animations/Animations/gltf/Rig_Medium/Rig_Medium_CombatMelee.glb', 'kaykit/animations/Animations/gltf/Rig_Medium/Rig_Medium_CombatRanged.glb',
  'kaykit/animations/Animations/gltf/Rig_Medium/Rig_Medium_Special.glb', 'kaykit/skeletons/Assets/gltf/Skeleton_Arrow_Broken.gltf',
  'Skeleton_Crossbow.gltf', 'Skeleton_Arrow.gltf', 'Skeleton_Blade.gltf', 'Skeleton_Axe.gltf', 'Skeleton_Shield_Small_A.gltf'];
let battleAssetsPromise = null, battleAssetsReady = false, battleLoadingVisible = false, battleGateId = 0;
let battleLoadProgress = { done: 0, total: BATTLE_ASSET_FILES.length };
const loading = createLoadingScreen($('loading'));

async function loadAssetFiles(files, onProgress = null) {
  const missing = [...new Set(files)].filter((file) => !assets[assetKey(file)]);
  let done = 0;
  const results = await Promise.all(missing.map((file) => load(file).then((gltf) => {
    onProgress?.(++done, missing.length);
    return gltf;
  })));
  missing.forEach((file, i) => { assets[assetKey(file)] = results[i]; });
  return missing.length;
}

function ensureBattleAssets() {
  if (battleAssetsReady) return Promise.resolve();
  if (battleAssetsPromise) return battleAssetsPromise;
  const missing = BATTLE_ASSET_FILES.filter((file) => !assets[assetKey(file)]);
  if (!missing.length) { battleAssetsReady = true; return Promise.resolve(); }
  battleLoadProgress = { done: 0, total: missing.length };
  battleAssetsPromise = loadAssetFiles(missing, (done, total) => {
    battleLoadProgress = { done, total };
    if (battleLoadingVisible) loading.progress(STAGE_BUILT + (STAGE_LOADED - STAGE_BUILT) * done / total);
  }).then(() => { battleAssetsReady = true; });
  battleAssetsPromise = battleAssetsPromise.catch((error) => { battleAssetsPromise = null; throw error; });
  return battleAssetsPromise;
}

function preloadBattleAssets() {
  ensureBattleAssets().catch((error) => console.warn('Não foi possível antecipar os modelos da batalha:', error));
}

// Entrada de fase: com a tela de carregamento na frente, monta o cenário (build), baixa os modelos de batalha
// e aquece a GPU (warmStage). Já pronto e sem cenário novo, começa na hora.
const STAGE_BUILT = 0.25, STAGE_LOADED = 0.6;
function withBattleAssets(ready, build = null) {
  const warm = typeof isStageWarm !== 'function' || isStageWarm();
  if (battleAssetsReady && warm && !build) return ready();
  const request = ++battleGateId;
  battleLoadingVisible = true;
  game.paused = true;
  $('overlay').classList.add('hidden');
  // startGame (menu, Esc) cancela o pedido: a tela sai se ninguém mais a estiver usando
  const stale = () => {
    if (request === battleGateId) return false;
    if (!battleLoadingVisible) loading.hide({ immediate: true });
    return true;
  };
  const pending = loading.show().then(() => {
    if (stale()) return;
    if (build) { build(); build = null; }   // só uma vez, mesmo se os modelos falharem e o jogador tentar de novo
    loading.progress(STAGE_BUILT);
    return ensureBattleAssets();
  }).then(() => {
    if (stale()) return;
    loading.progress(STAGE_LOADED);
    if (typeof warmStage === 'function') return warmStage((f) => loading.progress(STAGE_LOADED + (1 - STAGE_LOADED) * f));
  });
  return pending.then(async () => {
    if (stale()) return;
    await loading.hide();
    if (stale()) return;
    battleLoadingVisible = false;
    $('overlay').classList.add('hidden');
    $('overlayBtn').hidden = true;
    $('overlayBtn').textContent = 'Jogar de novo';
    $('overlayBtn').onclick = () => startGame(game.mission ? 'map' : 'menu');
    ready();
  }, (error) => {
    if (stale()) return;
    battleLoadingVisible = false;
    console.error('Falha ao preparar a batalha:', error);
    loading.hide({ immediate: true });
    $('overlayText').textContent = 'Não foi possível carregar os modelos da batalha. Recarregue a página (F5) e tente de novo.';
    $('overlayBtn').textContent = 'Tentar novamente';
    $('overlayBtn').hidden = false;
    $('overlay').classList.remove('hidden');
    $('overlayBtn').onclick = () => withBattleAssets(ready, build);
  });
}

async function loadAssets() {
  const files = [...new Set([...VARIANTS.map((h) => heroModelFile(h.model)), ...CHARACTER_ASSETS.map((n) => `${n}.glb`), ...HERO_ANIM_FILES, ...HERO_PROP_FILES, 'Skeleton_Staff.gltf', 'Skeleton_Quiver.gltf'])];
  await loadAssetFiles(files, (done, total) => loading.progress(0.8 * done / total));
  attachHeroAnimations(assets);   // clipes do pacote de animações nos modelos de herói (mesmo esqueleto)
  await preloadSceneryAssets({ castle: true });   // árvores/pedras, salão e props da vila prontos antes de aparecerem
  // Monta cada receita uma vez; retratos e unidades reaproveitam suas peças.
  // variantes comuns ganham as cores e acessórios de looks.js
  for (const cfg of VARIANTS) {
    if (cfg.recipe) { cfg.built = buildCharacter(assets, cfg.recipe); continue; }
    const scene = SkeletonUtils.clone(assets[cfg.model].scene);
    if (LOOKS[cfg.id]) applyLook(scene, assets, LOOKS[cfg.id]);
    cfg.built = { scene, animations: assets[cfg.model].animations };
  }
}

// Aquecimento da GPU: na primeira vez que um material aparece, o navegador compila o shader e sobe malhas e
// texturas — um engasgo no primeiro esqueleto, golpe ou habilidade. Com a tela de carregamento na frente,
// uma amostra de cada modelo de batalha e de cada efeito comum entra na cena junto do cenário novo;
// compileAsync compila tudo em paralelo e um quadro desenhado (com sombra) termina o envio para a GPU.
let warmedWorld = null;
const isStageWarm = () => warmedWorld === world;
const warmGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3), warmGhostMats = new Map();
async function warmStage(onProgress = () => {}, battle = true) {
  const group = new THREE.Group(), pooled = [];
  const add = (o, shadow) => {
    const i = group.children.length;
    o.position.set((i % 10) * 0.5 - 2.25, 0.5, Math.floor(i / 10) * 0.5 - 1);
    if (shadow) o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    group.add(o);
  };
  if (battle) {
    for (const file of BATTLE_ASSET_FILES) {
      if (file.includes('/Animations/')) continue;   // só clipes: não há malha para aquecer
      const skel = /Skeleton_(w+).glb$/.exec(file);
      const gltf = skel ? skeletonModel(skel[1]) : assets[assetKey(file)];
      if (!gltf.animations?.length) { add(gltf.scene.clone(), true); continue; }
      mergeSkeletonLimbs(gltf.scene);   // o mesmo corte que Unit faz: já sobe a malha final
      add(SkeletonUtils.clone(gltf.scene), true);
    }
    // fantasma: o mesmo esqueleto com material transparente é outro shader (as cópias ficam vivas para ele não sair do cache)
    const ghost = SkeletonUtils.clone(skeletonModel('Minion').scene);
    ghost.traverse((m) => {
      if (!m.isMesh) return;
      if (!warmGhostMats.has(m.material)) warmGhostMats.set(m.material, Object.assign(m.material.clone(), { transparent: true, opacity: 0.5, depthWrite: false }));
      m.material = warmGhostMats.get(m.material);
    });
    add(ghost, true);
    for (const material of MONSTER_MATERIALS) add(new THREE.Mesh(warmGeo, material), true);
    for (const pool of [ringMaterials, beamMaterials, groundMarkMaterials, poofPuffMaterials, poofStarMaterials, particleMats.add, particleMats.soft, particleMats.solid]) {
      const material = pool.take(0xffffff, 0.5);
      pooled.push([pool, material]);
      add(new THREE.Mesh(warmGeo, material));
    }
    for (const material of [...Object.values(boltMats), goldMat]) add(new THREE.Mesh(warmGeo, material));
    for (const kind of VFX_KINDS) add(vfxMesh(kind, 'fire', SPRITE, { opacity: 0.01 }));   // uma paleta basta: o programa é o mesmo
    sparkBatch(sparkGeo).mesh.visible = true;   // lote de faíscas (instâncias com cor): outro programa; o próximo quadro o esconde se vazio
  }
  group.position.copy(controls.target);
  scene.add(group);
  onProgress(0.1);
  try {
    await renderer.compileAsync(scene, camera);
    onProgress(0.8);
    renderer.render(scene, camera);   // a tela de carregamento cobre este quadro
    onProgress(1);
  } finally {
    scene.remove(group);
    disposeSkeletons(group);
    for (const [pool, material] of pooled) pool.give(material);
  }
  if (battle) warmedWorld = world;
}

// ---------- unidades ----------
const units = [];
const tmp = new THREE.Vector3();
const moveDir = new THREE.Vector3(), stepNext = new THREE.Vector3();   // reaproveitados a cada quadro

// Animação só de quem pode aparecer: fora da câmera e da área da sombra o mixer guarda o tempo e aplica
// tudo de uma vez quando a unidade volta a ser vista ou troca de animação (a pose final é a mesma).
let animationCulling = false;
const animationFrustum = new THREE.Frustum(), animationView = new THREE.Matrix4(), animationSphere = new THREE.Sphere();
const ANIMATION_CULL_MARGIN = 2.5;   // folga: a câmera ainda anda um pouco depois das unidades no quadro
function prepareAnimationCulling() {
  animationCulling = !!camera.isCamera;   // dublês de teste sem câmera real animam todo mundo
  if (!animationCulling) return;
  camera.updateMatrixWorld();
  animationView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  animationFrustum.setFromProjectionMatrix(animationView);
}
function unitMayBeSeen(unit) {
  const pos = unit.pos, size = unit.size || 1, radius = 2.5 * size + ANIMATION_CULL_MARGIN;
  animationSphere.center.set(pos.x, pos.y + size, pos.z);
  animationSphere.radius = radius;
  if (animationFrustum.intersectsSphere(animationSphere)) return true;
  if (!sun.castShadow) return false;
  // a sombra dela pode cair na tela: confere a caixa da câmera de sombra, no plano da luz
  const dx = pos.x - sunAt.x, dy = pos.y - sunAt.y, dz = pos.z - sunAt.z, box = sun.shadow.camera;
  const x = dx * sunRight.x + dy * sunRight.y + dz * sunRight.z, y = dx * sunUp.x + dy * sunUp.y + dz * sunUp.z;
  return x >= box.left - radius && x <= box.right + radius && y >= box.bottom - radius && y <= box.top + radius;
}

// culling das malhas com esqueleto: a esfera de repouso de cada peça não acompanha a animação (a cabeça
// cai longe na morte), então todas usam uma esfera única da unidade, com folga para golpes e quedas
const cullBox = new THREE.Box3(), cullPart = new THREE.Box3(), cullSphere = new THREE.Sphere(), cullInverse = new THREE.Matrix4();
function fitCullingSphere(meshes) {
  if (!meshes.length) return;
  cullBox.makeEmpty();
  for (const o of meshes) {
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    cullBox.union(cullSphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld).getBoundingBox(cullPart));
  }
  cullBox.getBoundingSphere(cullSphere);
  cullSphere.radius = cullSphere.radius * 1.5 + 0.5;
  for (const o of meshes) o.boundingSphere = cullSphere.clone().applyMatrix4(cullInverse.copy(o.matrixWorld).invert());
}

const lastUnitEmissive = new WeakMap();
const baseUnitEmissive = new WeakMap();
function rememberUnitEmissive(material) {
  if (material?.emissive && !baseUnitEmissive.has(material)) {
    baseUnitEmissive.set(material, material.emissive.getHex?.() ?? 0);
  }
}
function setUnitEmissive(material, hex) {
  if (!material?.emissive || lastUnitEmissive.get(material) === hex) return;
  material.emissive.setHex(hex);
  lastUnitEmissive.set(material, hex);
}

// Esqueletos KayKit 1.1: mesmos nós, ossos e malhas da versão antiga, mas sem animações embutidas (~0,3 MB
// cada, contra ~4,8 MB). Os clipes vêm dos arquivos Rig_Medium e ganham também os nomes antigos, que o resto
// do código (monsters.js) continua usando. Lie_Down/Lie_StandUp viram desmontar e se remontar.
const SKELETON_CLIP_ALIASES = {
  '1H_Melee_Attack_Chop': 'Melee_1H_Attack_Chop', '1H_Melee_Attack_Jump_Chop': 'Melee_1H_Attack_Jump_Chop',
  '1H_Melee_Attack_Slice_Diagonal': 'Melee_1H_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal': 'Melee_1H_Attack_Slice_Horizontal',
  '1H_Melee_Attack_Stab': 'Melee_1H_Attack_Stab', '2H_Melee_Attack_Chop': 'Melee_2H_Attack_Chop', '2H_Melee_Attack_Slice': 'Melee_2H_Attack_Slice',
  '2H_Melee_Attack_Spin': 'Melee_2H_Attack_Spin', '2H_Melee_Attack_Stab': 'Melee_2H_Attack_Stab', '2H_Melee_Idle': 'Melee_2H_Idle',
  Block: 'Melee_Block', Block_Attack: 'Melee_Block_Attack', Block_Hit: 'Melee_Block_Hit', Blocking: 'Melee_Blocking', Unarmed_Idle: 'Melee_Unarmed_Idle',
  '1H_Ranged_Shoot': 'Ranged_1H_Shoot', '2H_Ranged_Shoot': 'Ranged_2H_Shoot',
  Spellcast_Shoot: 'Ranged_Magic_Shoot', Spellcast_Raise: 'Ranged_Magic_Raise', Spellcast_Summon: 'Ranged_Magic_Summon',
  Spellcasting: 'Ranged_Magic_Spellcasting', Spellcast_Long: 'Ranged_Magic_Spellcasting_Long',
  Idle: 'Idle_A', Idle_Combat: 'Skeletons_Idle', Walking_D_Skeletons: 'Skeletons_Walking', Running_C: 'Running_B',
  Spawn_Ground_Skeletons: 'Skeletons_Spawn_Ground', Death_C_Skeletons: 'Skeletons_Death', Death_C_Skeletons_Resurrect: 'Skeletons_Death_Resurrect',
  Taunt: 'Skeletons_Taunt', Taunt_Longer: 'Skeletons_Taunt_Longer', Cheer: 'Skeletons_Taunt',
  Lie_Down: 'Skeletons_Death', Lie_StandUp: 'Skeletons_Death_Resurrect',
};
const SKELETON_RIG_PARTS = ['General', 'MovementBasic', 'CombatMelee', 'CombatRanged', 'Special'];
let skeletonClips = null;
const skeletonModels = new Map();
function skeletonModel(model) {
  const cached = skeletonModels.get(model);
  if (cached) return cached;
  const src = assets[`kaykit/skeletons/Characters/gltf/Skeleton_${model}`];
  if (!src) return assets[`Skeleton_${model}`];   // modelo antigo (testes)
  if (!skeletonClips) {
    const byName = new Map();
    for (const part of SKELETON_RIG_PARTS) {
      for (const clip of assets[`kaykit/animations/Animations/gltf/Rig_Medium/Rig_Medium_${part}`]?.animations || []) byName.set(clip.name, clip);
    }
    for (const [old, now] of Object.entries(SKELETON_CLIP_ALIASES)) {
      const clip = byName.get(now);
      if (clip && !byName.has(old)) byName.set(old, new THREE.AnimationClip(old, clip.duration, clip.tracks));   // trilhas compartilhadas
    }
    skeletonClips = [...byName.values()];
  }
  const gltf = { scene: src.scene, animations: skeletonClips };
  skeletonModels.set(model, gltf);
  return gltf;
}

// Esqueletos inimigos: corpo, braços e pernas usam o mesmo material e o mesmo esqueleto, então viram uma
// malha só no modelo-base (uma vez por modelo). A sombra usa a maior malha do boneco; armas e detalhes ficam
// visíveis no modelo, mas não abrem chamadas extras de sombra a cada inimigo. A capa entra no corpo e a
// mandíbula na cabeça (ou crânio): a cabeça continua separada porque voa sozinha (Enxame de Crânios);
// userData.merged guarda os nomes para quem procura a peça pelo nome (ex.: capa recolorida pinta o material
// compartilhado, o mesmo do corpo).
const mergedSkeletonModels = new WeakSet();
const SKELETON_MERGE_GROUPS = [[/_(Body|ArmLeft|ArmRight|LegLeft|LegRight|Cloak)$/, /_Body$/], [/_(Head|Skull|Jaw)$/, /_(Head|Skull)$/]];
function mergeSkeletonLimbs(model) {
  if (!model?.traverse || mergedSkeletonModels.has(model)) return;
  mergedSkeletonModels.add(model);
  const groups = new Map();
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.name.startsWith('Skeleton_')) return;
    const role = SKELETON_MERGE_GROUPS.findIndex(([part]) => part.test(o.name));
    if (role < 0) return;
    const key = `${role}|${o.parent.uuid}|${o.material.uuid}|${o.skeleton.bones.map((b) => b.uuid).join()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  for (const [key, parts] of groups) {
    const base = parts.find((o) => SKELETON_MERGE_GROUPS[+key.split('|')[0]][1].test(o.name)) || parts[0];
    const same = parts.filter((o) => o.matrix.equals(base.matrix) && o.bindMatrix.equals(base.bindMatrix));
    if (same.length < 2) continue;
    const geometry = mergeGeometries(same.map((o) => o.geometry));
    if (!geometry) continue;
    const merged = new THREE.SkinnedMesh(geometry, base.material);
    merged.name = base.name;
    merged.userData.merged = same.map((o) => o.name);
    merged.position.copy(base.position); merged.quaternion.copy(base.quaternion); merged.scale.copy(base.scale);
    base.parent.add(merged);
    merged.bind(base.skeleton, base.bindMatrix);
    for (const o of same) o.removeFromParent();
  }
}

class Unit {
  constructor(gltf, stats, team) {
    mergeSkeletonLimbs(gltf.scene);
    this.root = SkeletonUtils.clone(gltf.scene);
    this.mats = [];   // materiais próprios para piscar ao levar golpe sem afetar os outros
    const skinned = [], enemyShadowCandidates = [];
    const materialCopies = new Map();
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material.userData?.vfx) { o.castShadow = o.frustumCulled = false; return; }   // chama em shader: material compartilhado, sem sombra
      o.castShadow = !/_Eyes$/.test(o.name);   // olhos ficam dentro da cabeça: a sombra seria a mesma, com uma chamada a mais
      if (team === 'skeleton' && o.castShadow) enemyShadowCandidates.push(o);
      o.frustumCulled = true;
      if (o.isSkinnedMesh) {
        skinned.push(o);
      }
      const sourceMaterial = o.material;
      let unitMaterial = materialCopies.get(sourceMaterial);
      if (!unitMaterial) {
        unitMaterial = sourceMaterial.clone();
        materialCopies.set(sourceMaterial, unitMaterial);
        this.mats.push(unitMaterial);
        rememberUnitEmissive(unitMaterial);
      }
      o.material = unitMaterial;
    });
    // Modelos animados têm várias peças com o mesmo contorno; uma sombra da malha
    // principal basta e evita centenas de chamadas extras quando a horda se agrupa.
    if (enemyShadowCandidates.length > 1) {
      let shadowCaster = enemyShadowCandidates[0];
      for (const mesh of enemyShadowCandidates) {
        const size = mesh.geometry?.attributes?.position?.count || 0;
        const currentSize = shadowCaster.geometry?.attributes?.position?.count || 0;
        if (size > currentSize) shadowCaster = mesh;
      }
      for (const mesh of enemyShadowCandidates) mesh.castShadow = mesh === shadowCaster;
    }
    fitCullingSphere(skinned);
    this.vel = new THREE.Vector3();   // velocidade atual: acelera e freia aos poucos
    this.moving = false;
    this.flash = 0;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.animLag = 0;   // tempo de animação guardado enquanto a unidade não pode ser vista
    this.clips = gltf.animations;
    this.actions = {};
    this.current = null;
    Object.assign(this, { team, maxHp: stats.hp, hp: stats.hp, dmg: stats.dmg, range: stats.range, speed: stats.speed, cooldown: stats.cooldown });
    this.size = 1;
    this.attackTimer = Math.random() * 0.5;
    this.busy = 0;          // tempo travado em ataque/golpe/surgimento
    this.pendingHit = null;
    this.knockupT = 0;
    this.knockupDuration = 0;
    this.knockupHeight = 0;
    this.dead = false;
    this.synergyNoticeT = 0;
    this.bar = document.createElement('div');
    this.bar.className = `hp ${team === 'hero' ? 'ally' : ''}`;
    this.bar.innerHTML = '<i></i><b></b>';   // <b>: rastro claro do dano, desce com atraso por transição CSS
    this.barTrail = this.bar.querySelector('b');
    this.barVisible = null;
    this.barScreenX = null;
    this.barScreenY = null;
    this.barHealthWidth = null;
    bars.appendChild(this.bar);
    scene.add(this.root);
    units.push(this);
  }

  get pos() { return this.root.position; }

  action(name) {
    if (!this.actions[name]) {
      const clip = THREE.AnimationClip.findByName(this.clips, name);
      if (!clip) return null;
      this.actions[name] = this.mixer.clipAction(clip);
    }
    return this.actions[name];
  }

  // aplica o tempo guardado antes de trocar de animação, para a troca partir da pose certa
  flushAnimation() {
    if (this.animLag > 0) { this.mixer.update(this.animLag); this.animLag = 0; }
  }

  loop(name) {
    const a = this.action(name);
    if (!a) return;
    if (this.current === a) return;
    this.flushAnimation();
    a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (this.current) a.crossFadeFrom(this.current, 0.2, false);
    this.current = a;
  }

  once(name, timeScale = 1, fade = 0.1) {
    const a = this.action(name);
    if (!a) return 0;
    this.flushAnimation();
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = timeScale;
    a.play();
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    this.current = a;
    return a.getClip().duration / timeScale;
  }

  // gira aos poucos para o alvo; devolve quanto ainda falta girar (radianos)
  face(target, dt) {
    const want = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    let diff = want - this.root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.root.rotation.y += diff * Math.min(1, dt * 8);
    return Math.abs(diff);
  }

  // d: distância já ajustada pelo chamador. Corpo a corpo também alcança quem está encostado: a separação
  // segura adversários a UNIT_COMBAT_SEPARATION_FACTOR × (tamanhos), e sem isto quem tem alcance menor que
  // o próprio corpo (lacaio, ladino, golem, chefes) anda contra o alvo para sempre e os dois se empurram.
  inReach(target, d) {
    if (d <= this.range) return true;
    if (this.ranged) return false;
    return Math.hypot(target.pos.x - this.pos.x, target.pos.z - this.pos.z)
      <= UNIT_COMBAT_SEPARATION_FACTOR * (this.size + (target.size || 1)) + MELEE_CONTACT_SLACK;
  }

  stopApproach(target) {
    const dx = target.pos.x - this.pos.x, dz = target.pos.z - this.pos.z, distance = Math.hypot(dx, dz);
    if (distance < 0.001) return;
    const nx = dx / distance, nz = dz / distance, closing = this.vel.x * nx + this.vel.z * nz;
    if (closing > 0) { this.vel.x -= nx * closing; this.vel.z -= nz * closing; }
  }

  // corpo a corpo: vai para a vaga reservada em volta do alvo (claimEngageSlot); na vaga de espera, para e encara
  approach(target, dt) {
    const slot = this.ranged || this.phasing || Math.abs(target.pos.y - this.pos.y) >= 0.85 ? null : claimEngageSlot(this, target);
    if (!slot) return this.moveTo(target.pos, dt);
    if (this.engage.waiting && Math.hypot(slot.x - this.pos.x, slot.z - this.pos.z) < 0.35) {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 10));   // freia sem tranco
      this.face(target.pos, dt);
      return;
    }
    this.moveTo(slot, dt);
  }

  // anda até o alvo desviando dos obstáculos que estão na frente
  moveTo(target, dt, moveSpeed = this.speed) {
    if (this.marchT > 0 && moveSpeed === this.speed) moveSpeed *= 1 + MARCH_SPEED;   // Decreto de Marcha
    const goal = target;   // posição de uma unidade (alvo, protegido, invocador): essa não se contorna
    const watch = this.moveProgress || (this.moveProgress = {
      goalX: target.x, goalZ: target.z, lastDistance: Infinity, lastX: null, lastZ: null, targetX: null, targetZ: null, stalled: 0, side: 1,
      recovering: false, recoveryX: 0, recoveryZ: 0, waypoint: new THREE.Vector3(), winT: 0, winX: this.pos.x, winZ: this.pos.z, stuckWindows: 0,
    });
    if (Math.hypot(target.x - watch.goalX, target.z - watch.goalZ) > 2) {
      watch.stalled = 0; watch.lastDistance = Infinity; watch.recovering = false; this.pathing = null;
    }
    watch.goalX = target.x; watch.goalZ = target.z;
    // Destrave genérico: quem pede movimento e quase não sai do lugar por 2 s (cercado por aliados parados, quina, ponte estreita)
    // ganha 1,5 s de "empurrão": segue reto ao destino e os vizinhos cedem lugar (pushT em separatePair).
    if ((watch.winT += dt) >= 1) {
      const moved = Math.hypot(this.pos.x - watch.winX, this.pos.z - watch.winZ);
      if (moved < 0.3 && moveSpeed > 0.05 && Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) > 1.2) {
        if (++watch.stuckWindows >= 2) { this.pushT = 1.5; watch.stuckWindows = 0; watch.stalled = 0; this.pathing = null; }
      } else watch.stuckWindows = 0;
      watch.winT = 0; watch.winX = this.pos.x; watch.winZ = this.pos.z;
    }
    if (watch.stalled >= 0.55) {
      const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z, distance = Math.hypot(dx, dz);
      if (distance > 0.05 && moveSpeed > 0.05) {
        watch.side *= -1;
        watch.recoveryX = this.pos.x - dz / distance * watch.side * 1.8;
        watch.recoveryZ = this.pos.z + dx / distance * watch.side * 1.8;
        watch.recovering = true; watch.stalled = 0; watch.lastDistance = Infinity; this.pathing = null;
      }
    }
    if (watch.recovering && Math.hypot(this.pos.x - watch.recoveryX, this.pos.z - watch.recoveryZ) < 0.5) {
      watch.recovering = false; watch.stalled = 0; watch.lastDistance = Infinity; this.pathing = null;
    }
    if (watch.recovering) target = watch.waypoint.set(watch.recoveryX, this.pos.y, watch.recoveryZ);
    target = world.nextWaypoint(this.pos, target, this, queryObstacleCandidates);
    const dir = moveDir.subVectors(target, this.pos).setY(0);
    const d = dir.length();
    if (d < 0.05) { watch.stalled = 0; watch.lastDistance = Infinity; return; }
    if (Number.isFinite(watch.lastDistance)) {
      const progress = watch.lastDistance - d;
      const threshold = Math.max(0.0002, moveSpeed * dt * 0.005);
      const movedX = this.pos.x - watch.lastX, movedZ = this.pos.z - watch.lastZ;
      const towardX = watch.targetX - watch.lastX, towardZ = watch.targetZ - watch.lastZ;
      const towardLength = Math.hypot(towardX, towardZ);
      const advance = towardLength > 0.001 ? (movedX * towardX + movedZ * towardZ) / towardLength : 0;
      if (progress < threshold && advance < threshold) watch.stalled += dt;
      else watch.stalled = 0;
    } else watch.stalled = 0;
    watch.lastDistance = d; watch.lastX = this.pos.x; watch.lastZ = this.pos.z;
    watch.targetX = target.x; watch.targetZ = target.z;
    dir.divideScalar(d);
    const reach = Math.min(2.6, d);
    // O desvio acumulado pode girar a direção antes dos próximos obstáculos; cobre qualquer orientação até esse alcance.
    for (const o of queryObstacleCandidates(
      this.pos.x - reach, this.pos.x + reach,
      this.pos.z - reach, this.pos.z + reach, 0.5 * this.size,
    )) {
      const ox = o.x - this.pos.x, oz = o.z - this.pos.z;
      const ahead = ox * dir.x + oz * dir.z;                 // quão à frente está
      if (ahead <= 0 || ahead > 2.6 || ahead > d) continue;
      const side = ox * -dir.z + oz * dir.x;                // de que lado está
      const clear = o.r + 0.5 * this.size;
      if (Math.abs(side) > clear) continue;
      const push = (1 - Math.abs(side) / clear) * (1.6 - ahead / 2.6);
      const s = side >= 0 ? -1 : 1;                         // vira para o lado livre
      const px = -dir.z, pz = dir.x;
      dir.x += px * s * push; dir.z += pz * s * push;
    }
    const preferredLength = Math.hypot(dir.x, dir.z) || 1;
    const preferredX = dir.x / preferredLength, preferredZ = dir.z / preferredLength;
    // Contorna quem está parado e aliados em rota de colisão antes que a separação os empurre.
    // A partir de 24 unidades, só olha as da grade do último separate() em volta (antes era O(n²) por quadro).
    const nearby = !this.phasing && units.length >= 24 ? gatherUnitGrid(this.pos.x, this.pos.z, MOVE_AVOID_RADIUS, moveAvoidNear) : null;
    const avoidCount = this.phasing ? 0 : nearby ? nearby.length : units.length;
    for (let n = 0; n < avoidCount; n++) {
      const u = nearby ? separationAlive[nearby[n]] : units[n];
      if (u === this || u.dead || u.phasing || u.pos === goal) continue;
      const sameFaction = (u.team === 'skeleton') === (this.team === 'skeleton');
      const heroPair = this.team === 'hero' && u.team === 'hero' && !u.structure && !u.totem;
      const clear = (heroPair ? UNIT_HERO_SEPARATION_FACTOR : UNIT_SEPARATION_FACTOR) * (this.size + u.size);
      const ox = u.pos.x - this.pos.x, oz = u.pos.z - this.pos.z;
      let movingThreat = false, closestX = ox, closestZ = oz;
      if (!isPlanted(u)) {
        if (!sameFaction) continue;
        const rvx = u.vel.x - this.vel.x, rvz = u.vel.z - this.vel.z;
        const distance = Math.hypot(ox, oz);
        const relativeSpeedSq = rvx * rvx + rvz * rvz;
        if (relativeSpeedSq < 0.01) {
          if (distance > clear) continue;
          movingThreat = true;
        } else {
          const radial = ox * rvx + oz * rvz;
          if (distance <= clear && radial >= 0) continue;
          const eta = THREE.MathUtils.clamp(-radial / relativeSpeedSq, 0, 0.85);
          closestX += rvx * eta;
          closestZ += rvz * eta;
          if (Math.hypot(closestX, closestZ) >= clear) continue;
          movingThreat = true;
        }
      }
      const currentAhead = ox * dir.x + oz * dir.z;
      const ahead = movingThreat ? Math.max(0.1, currentAhead) : currentAhead;
      const maxAhead = Math.max(2.6, clear + 0.5);
      if ((!movingThreat && ahead <= 0) || ahead > maxAhead || ahead > d || Math.abs(u.pos.y - this.pos.y) >= 0.85) continue;
      const side = ox * -dir.z + oz * dir.x;
      const riskSide = movingThreat ? closestX * -dir.z + closestZ * dir.x : side;
      if (Math.abs(riskSide) > clear) continue;
      const push = (1 - Math.abs(riskSide) / clear) * (1.6 - ahead / maxAhead) * (this.pushT > 0 ? 0.35 : 1);
      const turnSide = movingThreat ? riskSide : side;
      const opposing = movingThreat && this.vel.x * u.vel.x + this.vel.z * u.vel.z < 0;
      const tieTurn = (this.root.id < u.root.id || opposing) ? -1 : 1;   // de frente, o mesmo lado local abre lados opostos no mundo
      const s = Math.abs(turnSide) > 0.05 ? turnSide >= 0 ? -1 : 1 : tieTurn;
      const px = -dir.z, pz = dir.x;
      dir.x += px * s * push; dir.z += pz * s * push;
    }
    dir.normalize();
    const forward = dir.x * preferredX + dir.z * preferredZ;
    if (forward < 0.25) {
      const lateral = dir.x * -preferredZ + dir.z * preferredX;
      const side = lateral < 0 ? -1 : 1, advance = 0.25, strafe = Math.sqrt(1 - advance * advance);
      dir.set(preferredX * advance - preferredZ * side * strafe, 0, preferredZ * advance + preferredX * side * strafe);
    }
    const terrainSpeed = (this.slowT > 0 ? 0.5 : 1) * (world.isShallow(this.pos.x, this.pos.z) ? 0.6 : 1);
    const approachSpeed = Math.min(moveSpeed, d * 1.75) * terrainSpeed; // limita a frenagem para não ultrapassar o alvo
    this.vel.lerp(dir.multiplyScalar(approachSpeed), Math.min(1, dt * 7));
    this.moving = true;
    this.face(tmp.copy(this.pos).add(this.vel), dt);
  }

  // anima a locomoção no ritmo da velocidade real (sem "patinar")
  locomote(run, walk, idle) {
    const v = this.vel.length();
    if (v < 0.25) return this.loop(idle);
    const a = this.action(v > this.speed * 0.55 ? run : walk);
    if (!a) return this.loop(idle);
    this.loop(a.getClip().name);
    a.timeScale = THREE.MathUtils.clamp(0.55 + 0.55 * (v / this.speed), 0.6, 1.3);
  }

  attack(target, name) {
    const dur = this.once(name, 1.3 * (this.team === 'hero' ? this.cfg.cooldown / this.cooldown : 1));
    this.busy = dur * 0.9;
    this.attackTimer = this.cooldown;
    this.pendingHit = { target, t: dur * 0.4 };
    if (this.stats) this.stats.ataques++;
    if (!this.ranged) {
      const dir = tmp.subVectors(target.pos, this.pos).setY(0), distance = dir.length();
      const room = distance - UNIT_COMBAT_SEPARATION_FACTOR * (this.size + (target.size || 1));
      if (distance > 0.001 && room > 0) this.vel.add(dir.multiplyScalar(Math.min(2.2, room * 10) / distance));
    }
  }

  takeDamage(n, from, owner = null, critical = false, dot = false) {   // dot: veneno e afins, sem esquiva, bloqueio nem tropeço
    if (this.dead || game.over || this.untargetable) return;   // dragãozinho voando: fora do alcance de golpes e áreas
    if (owner?.team === 'skeleton') {   // estados nos inimigos: Desarmar (dano menor), Ofuscar (erra o golpe) e Pânico (fere o vizinho com metade da força)
      if (owner.disarmT > 0) n *= 1 - owner.disarmCut;
      if (!dot && owner.blindT > 0 && Math.random() < owner.blindMiss) { popText(this.pos, 'Errou!', 'dodge'); return; }
      if (owner.panicT > 0 && this.team === 'skeleton') n *= 0.5;
    }
    // golpe corpo a corpo não alcança quem está em outro nível (os vikings arremessam o machado)
    if (owner && !owner.ranged && !['viking', 'iceviking'].includes(owner.cfg?.id) && Math.abs(owner.pos.y - this.pos.y) >= 0.85) return;
    if (owner?.weakT > 0 && this.team !== 'skeleton') n *= 1 - SHIELD_WEAK;   // Escudo Ricochete: o inimigo marcado bate mais fraco contra aliados
    if (this.ward) { n = absorbWard(this, n); if (!(n > 0)) return; }   // escudo de ossos do xamã
    if (this.kind?.hurt) { n = this.kind.hurt(this, n, from, owner); if (!(n > 0)) return; }   // escudos dos monstros
    if (this.team === 'hero') {
      if (this.oathUntil > game.runTime) return;   // Juramento final: invulnerável por instantes
      if (this.immuneT > 0) return;   // Meditação do Monge: imune enquanto medita
      if (!dot && this.cfg.id === 'assassin' && this.dodgeTimer <= 0) {
        this.dodgeTimer = (7 - skillLevel(this.level)) * this.skillRate;
        this.busy = this.once(HERO_DODGES[Math.floor(Math.random() * HERO_DODGES.length)], 1.5);   // esquerda, direita ou rolamento para trás
        if (!this.pendingHit?.effect) this.pendingHit = null;   // só o golpe comum é cancelado: a habilidade em preparo continua
        popText(this.pos, 'Esquiva!', 'dodge');
        this.stats.esquivas++;
        return;
      }
      if (!dot && this.cfg.id === 'illusionist' && Math.random() < 0.2) {   // passo de ilusionista: desvia de um golpe em cada cinco
        popText(this.pos, 'Esquiva!', 'dodge');
        this.stats.esquivas++;
        return;
      }
      if (!dot && this.bladeDanceT > 0 && Math.random() < 0.5) {   // girando, o Duelista desvia de metade dos golpes
        popText(this.pos, 'Esquiva!', 'dodge');
        this.stats.esquivas++;
        return;
      }
      n *= this.damageTaken;
      if (this.guardT > 0) n *= 0.6;
      if (this.stoneT > 0) {   // Pele de pedra: devolve parte do golpe corpo a corpo e segura quase todo o resto
        if (owner?.team === 'skeleton' && !owner.ranged && !owner.dead) owner.takeDamage(n * STONE_SKIN.reflect, null, this);
        n *= STONE_SKIN.taken;
      }
      if (this.cfg.armor && n > 1) n = Math.max(1, n - this.cfg.armor);   // couro grosso: golpe pequeno quase não fere
      const protection = synergyDamageTakenMultiplier(this, partyNow());
      if (protection < 1) {
        n *= protection;
        if (this.synergyNoticeT <= 0) { popText(this.pos, `⛨−${Math.round((1 - protection) * 100)}%`, 'block'); this.synergyNoticeT = 1.2; }
      }
      if (!dot && canBlock(this) && Math.random() < 0.3) {
        n *= 0.5;
        popText(this.pos, 'Bloqueio!', 'block');
        if (this.busy <= 0 && THREE.AnimationClip.findByName(this.clips, 'Block_Hit')) this.busy = this.once('Block_Hit', 1.5);
        if (hasRelic('bulwark-banner')) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.05);
      }
      n = relicGuard(this, n);
      if (n <= 0) return;
      n = this.skillGuard(n, owner);
      if (n <= 0) return;
    } else if (this.sheepT > 0) n *= 1.35;   // ovelha da Grande transmutação: indefesa, sofre mais
    else if (this.markT > 0) n *= 1 + this.markBonus;   // Flecha do caçador: o alvo marcado sofre mais de todos
    const real = Math.min(n, this.hp);   // conta só a vida que de fato saiu
    if (this.stats) this.stats.recebido += real;
    if (owner?.stats) { owner.stats.dano += real; if (critical) owner.stats.criticos++; }
    if (owner?.militia && game.militia) game.militia.damage += real;   // relatório: dano da milícia
    if (this.team === 'hero' && owner?.team === 'skeleton' && real > 0) {
      const name = owner.kind?.name || owner.enemyKind || 'Esqueleto';
      game.damageSources ||= {};
      game.damageSources[name] ||= { name, damage: 0, hits: 0 };
      game.damageSources[name].damage += real;
      game.damageSources[name].hits++;
      owner.echoDmg = (game.runTime - (owner.echoAt ?? -9) < 3 ? owner.echoDmg : 0) + real;   // Eco Temporal: dano que este inimigo causou nos últimos 3 s
      owner.echoAt = game.runTime;
      if (hasRelic('thorn-mail') && !owner.ranged && !owner.dead) owner.takeDamage(real * 0.35, null, this);   // Cota de espinhos
    }
    this.hp -= n;
    if (owner) this.lastHit = owner;
    if (real > 0 && this.team === 'hero') passiveHook(this, 'onHurt', owner, real);
    const heavy = critical || !!owner?.ultHit;   // crítico e ultimate piscam branco e mostram o número grande
    this.flash = heavy ? 0.12 : 0.14;
    this.flashHeavy = heavy;
    this.squashT = 0.25;
    popText(this.pos, n, this.team === 'hero' ? 'hurt' : heavy ? 'crit' : 'dmg');   // o pool arredonda e soma golpes seguidos no mesmo alvo
    audio.play(this.team === 'hero' ? 'hurt' : 'hit');
    if (from) {   // recua com o impacto
      const k = (this.boss ? 0.6 : this.team === 'hero' ? 1.6 : 3.2);
      this.vel.add(tmp.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(k));
    }
    if (this.hp <= 0) return this.die();
    if (!dot && !this.pendingHit && !this.boss && this.busy <= 0) {
      const reactionLock = this.once(this.team === 'hero' ? HERO_HITS[(this.hitCount = (this.hitCount || 0) + 1) % HERO_HITS.length] : 'Hit_B', 1.6) * 0.8;
      this.busy = this.team === 'hero' ? Math.min(reactionLock, HERO_HIT_ACTION_LOCK) : reactionLock;
    }
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.pendingHit = null;
    const preferredDeath = this.team === 'hero'
      ? HERO_DEATHS[(this.deathCount = (this.deathCount || 0) + 1) % HERO_DEATHS.length]
      : 'Death_C_Skeletons';
    const deathClip = [preferredDeath, ...(this.team === 'hero' ? [] : HERO_DEATHS)]
      .find((name) => THREE.AnimationClip.findByName(this.clips, name));
    if (deathClip) this.once(deathClip);   // aliados invocados usam modelos de herói; nem todos têm o clipe dos esqueletos
    this.deadTime = 0;
    this.bar.style.display = 'none';
    if (this.team === 'hero') {
      this.diedIn = game.phase;   // no Pesadelo, decide quando volta
      game.fallLog.push({ name: heroLevelName(this.cfg, this.level), phase: game.phase, time: game.runTime });
      FX.heroFall(this);
      if (this instanceof Hero) for (const h of heroes()) if (h !== this && !h.dead) passiveHook(h, 'onAllyDown', this);
      if (directControl?.hero === this) {
        clearDirectControlOrders();
        syncDirectControlUI();
      }
    }
    if (this.team === 'skeleton' && !this.dissolved) {
      audio.play('bones');
      game.kills++;
      if (this.lastHit?.stats) this.lastHit.stats.abates++;
      if (this.lastHit?.militia && game.militia) game.militia.kills++;
      for (const h of heroes()) if (!h.dead) { h.gainXp((this.boss ? 12 : 3) + (h === this.lastHit ? 2 : 0)); passiveEnemyDeath(h, this); }
      monsterDied(this);
      relicOnKill(this);
      if (this.reapT > 0) reapPayoff(this);   // Ceifa
    }
    if (this.aura) this.aura.visible = false;
    if (this.halo) this.halo.visible = false;
    if (this.campaignAura) this.campaignAura.visible = false;
  }

  remove() {
    scene.remove(this.root);
    this.bar.remove();
    for (const m of this.mats) m.dispose();
    if (this.aura) this.aura.material.dispose();
    this.campaignAuraMaterial?.dispose();
    this.masteryAura?.material.dispose();
    disposeSkeletons(this.root);   // texturas de ossos da GPU (uma por malha animada)
    units.splice(units.indexOf(this), 1);
  }

  updateCommon(dt) {
    this.synergyNoticeT = Math.max(0, this.synergyNoticeT - dt);
    this.animLag += dt;
    if (!animationCulling || unitMayBeSeen(this)) { this.mixer.update(this.animLag); this.animLag = 0; }
    this.attackTimer -= dt * (this.summoner ? synergySummonHaste(this.summoner) : 1);   // canção do Bardo acelera as invocações
    this.busy -= dt;
    if (this.pushT > 0) this.pushT -= dt;
    let knockupLift = 0;
    if (this.knockupT > 0) {
      this.knockupT = Math.max(0, this.knockupT - dt);
      const progress = 1 - this.knockupT / Math.max(0.01, this.knockupDuration || 0.55);
      knockupLift = Math.sin(Math.PI * progress) * this.knockupHeight;
      if (this.knockupT <= 0) this.knockupHeight = this.knockupDuration = 0;
    }
    // inércia: quem não está andando vai freando; a velocidade (e o recuo) move a unidade
    if (!this.moving) this.vel.multiplyScalar(Math.max(0, 1 - dt * 9));
    this.moving = false;
    if (!this.dead && !game.over) {
      const next = stepNext.copy(this.pos).addScaledVector(this.vel, dt);
      if (this.phasing || world.canStep(this.pos, next)) this.pos.copy(next);   // fantasmas atravessam obstáculos
      else this.vel.set(0, 0, 0);
      this.pos.y = world.groundHeight(this.pos.x, this.pos.z) + (this.hover || 0) + (this.lift || 0) + knockupLift;   // lift: salto/levitação visual das habilidades
      if (world.isShallow(this.pos.x, this.pos.z) && this.vel.lengthSq() > 0.1) {
        this.rippleT = (this.rippleT || 0) - dt;
        if (this.rippleT <= 0) { waterSplash(this.pos); this.rippleT = 0.45; }
      }
      if (this.stats) this.stats.distancia += this.vel.length() * dt;
    }
    // "amassa" ao levar golpe e aparece com um pop (escala elástica)
    let sx = 1, sy = 1;
    if (this.squashT > 0) {
      this.squashT -= dt;
      const w = Math.sin(Math.PI * (1 - Math.max(0, this.squashT) / 0.25));
      sy = 1 - 0.2 * w; sx = 1 + 0.14 * w;
    }
    if (this.popT !== undefined && this.popT < 0.45) {
      this.popT += dt;
      const t = Math.min(1, this.popT / 0.45) - 1;
      const e = 1 + 2.70158 * t ** 3 + 1.70158 * t ** 2;
      sx *= e; sy *= e;
    }
    this.root.scale.set(this.size * sx, this.size * sy, this.size * sx);
    if (this.flash > 0 || this.flashOn) {
      this.flash -= dt;
      this.flashOn = this.flash > 0;
      // Skeleton.update restaura o brilho base depois; os demais Unit fazem o próprio restore.
      if (this.flashOn) {
        const flashHex = this.flashHeavy ? 0xffffff : 0xff3b2f;
        for (const m of this.mats) {
          if (!m.emissive) continue;
          if (this.restoresBaseEmissive) setUnitEmissive(m, flashHex);
          else m.emissive.setHex(flashHex);
        }
      } else if (!this.restoresBaseEmissive) {
        for (const m of this.mats) if (m.emissive) m.emissive.setHex(baseUnitEmissive.get(m) ?? 0);
      }
    }
    if (this.pendingHit && !game.over) {
      this.pendingHit.t -= dt;
      if (this.pendingHit.t <= 0) {
        const { target, effect } = this.pendingHit;
        this.pendingHit = null;
        if (!effect && this.team !== 'skeleton') audio.play(swingSound(this));
        if (effect) effect();
        else if (this.ranged && !target.dead) {
          if (this.team === 'skeleton') fireEnemyBolt(this, target);
          else { fireBolt(this, target, this.cfg.id === 'crossbow' ? 'crossbow' : 'magic'); relicExtraShot(this, target); }
        }
        else if (this.cleave) {
          const hit = !target.dead && inMeleeArc(this, target);
          damageCleave(this, target);
          if (hit) FX.meleeHit(target, false);
          if (hit && this.roarT > 0 && this.team !== 'skeleton') roarStun(this, target);   // Berro de Guerra do Brutamontes (o golpe dele é em arco)
        }
        else if (!target.dead && Math.abs(target.pos.y - this.pos.y) < 0.85 && target.pos.distanceTo(this.pos) <= this.range + 0.6 * target.size) {
          if (this.team !== 'skeleton') FX.meleeHit(target, heroHit(this, target, this.dmg));
          else target.takeDamage(this.dmg, this.pos, this);
        }
      }
    }
  }
}

// som do golpe comum de cada herói (e dos esqueletinhos do necromante)
const swingSound = (u) => u.ranged ? ({ crossbow: 'arrow', archer: 'arrow', pyro: 'fire', cryo: 'ice', alchemist: 'ice', cook: 'ice' }[u.cfg.id] || 'zap') : u.cfg.id === 'monk' ? 'hit' : u.cfg.classId === 1 ? 'axe' : 'sword';

const skeletonsAlive = () => units.filter((u) => u.team === 'skeleton' && !u.dead);
const heroes = () => units.filter((u) => u.team === 'hero');
const allies = () => units.filter((u) => u.team !== 'skeleton' && !(u.captive && !u.rescued) && !u.untargetable);   // o prisioneiro preso e o dragãozinho voando não são alvo
const enemyTargetAllies = () => {
  const list = allies();
  return game.mission?.goal?.type === 'defend' && game.shrine
    ? list.filter((unit) => unit !== game.shrine)
    : list;
};
let activeTargetContext = null;
const frameTargetContext = { party: [], rangedHeroes: [], friends: [], skeletons: [], attackableSkeletons: [], alliedUnits: [], livingAllies: [], rescueThreats: [], defenseAnchor: null, objectiveTarget: null, objectiveRunners: [], phaseBossAlive: false, twinFocusChecked: false, twinFocus: null, twinFocusWaiting: false, bossUrgentChecked: false, bossUrgentTarget: null, bossUrgentHero: null, castleUrgentChecked: false, castleUrgentTarget: null, castleUrgentHero: null };

function makeTargetContext(reuse = null) {
  const goal = game.mission?.goal;
  const protectedShrine = goal?.type === 'defend' ? game.shrine : null;
  let party, rangedHeroes, skeletons, attackableSkeletons, alliedUnits, livingAllies, rescueThreats;
  if (reuse) {
    party = reuse.party;
    rangedHeroes = reuse.rangedHeroes;
    skeletons = reuse.skeletons;
    attackableSkeletons = reuse.attackableSkeletons;
    alliedUnits = reuse.alliedUnits;
    livingAllies = reuse.livingAllies;
    rescueThreats = reuse.rescueThreats;
    party.length = 0;
    rangedHeroes.length = 0;
    skeletons.length = attackableSkeletons.length = alliedUnits.length = livingAllies.length = 0;
    rescueThreats.length = 0;
    for (const unit of units) {
      if (unit.team === 'hero') { party.push(unit); if (unit.ranged) rangedHeroes.push(unit); }
      if (unit.team === 'skeleton') {
        if (!unit.dead) { skeletons.push(unit); if (!unit.spawning) attackableSkeletons.push(unit); }
      } else if (!(unit.captive && !unit.rescued)) {
        if (unit !== protectedShrine) alliedUnits.push(unit);   // só saqueadores escolhem o santuário como alvo direto
        if (!unit.dead) livingAllies.push(unit);
      }
    }
  } else {
    party = heroes();
    rangedHeroes = party.filter((hero) => hero.ranged);
    skeletons = skeletonsAlive();
    attackableSkeletons = skeletons.filter((unit) => !unit.spawning);
    const allAllies = allies();
    alliedUnits = protectedShrine ? allAllies.filter((unit) => unit !== protectedShrine) : allAllies;
    livingAllies = allAllies.filter((unit) => !unit.dead);
    rescueThreats = [];
  }
  // o santuário entra como "aldeão": os heróis interceptam quem chega perto dele
  const villager = (goal?.type === 'escort' || goal?.type === 'rescue' && game.villager?.rescued) && !game.villager?.dead ? game.villager
    : goal?.type === 'defend' && game.shrine && !game.shrine.dead ? game.shrine
      : goal?.type === 'breach' && game.gate ? game.gate : null;   // a ponte: interceptar quem corre para ela
  const friends = reuse ? reuse.friends : villager ? [...party, villager] : party;
  if (reuse) {
    friends.length = 0;
    for (const hero of party) friends.push(hero);
    if (villager) friends.push(villager);
  }
  const context = reuse || {};
  context.twinFocusChecked = false;
  context.twinFocus = null;
  context.twinFocusWaiting = false;
  context.bossUrgentChecked = false;
  context.bossUrgentTarget = null;
  context.bossUrgentHero = null;
  context.castleUrgentChecked = false;
  context.castleUrgentTarget = null;
  context.castleUrgentHero = null;
  context.objectiveTarget = null;
  context.objectiveRunners = reuse ? reuse.objectiveRunners : [];
  context.objectiveRunners.length = 0;
  context.goal = goal;
  context.party = party;
  context.rangedHeroes = rangedHeroes;
  context.friends = friends;
  context.villager = villager;
  // Defesas fixas deixam o herói mais resistente/de suporte como âncora; sozinho, o último vivo assume.
  const shrineGuard = (goal?.type === 'defend' || goal?.type === 'breach') && villager ? escortGuardOf(party) : null;
  context.defenseAnchor = goal?.type === 'defend' || goal?.type === 'breach'
    ? shrineGuard || party.find((hero) => !hero.dead) || null : null;
  // escolta/resgate/santuário: um herói fica de guarda junto ao protegido; os demais caçam livremente
  context.escortGuard = villager?.team === 'villager' && (!villager.structure && (goal?.type === 'escort' || goal?.type === 'rescue') || goal?.type === 'defend')
    ? escortGuardOf(party) : null;
  context.arenaCenter = world.pointAt(game.guideS);
  // com protegido, a caça fica a ESCORT_HUNT_LIMIT dele; se não resta inimigo dentro do limite, a trava abre para não emperrar a fase.
  // santuário com <35% de vida: todos ficam na defesa mesmo sem inimigo por perto
  context.guardThreat = !!context.escortGuard && attackableSkeletons.some((enemy) => tacticalDistance(villager.pos, enemy.pos) <= ESCORT_HUNT_LIMIT);
  context.huntLimited = (goal?.type === 'defend' && game.surviveT > 0)
    || (goal?.type === 'defend' && villager && villager.hp < villager.maxHp * 0.35)
    || (goal?.type === 'breach' && game.surviveT > 0) || context.guardThreat;
  context.skeletons = skeletons;
  context.attackableSkeletons = attackableSkeletons;
  context.phaseBossAlive = false;
  for (const enemy of attackableSkeletons) if (enemy.phaseBoss) { context.phaseBossAlive = true; break; }
  const destructionGoal = goal?.type === 'totems' || goal?.type === 'tower';
  const destructionWavePending = destructionGoal && game.state === 'fight' && game.toSpawn > 0;
  let nonTotemCount = 0;
  for (const enemy of attackableSkeletons) if (!enemy.totem) nonTotemCount++;
  if (destructionGoal) {
    for (const enemy of skeletons) if (enemy.spawning && !enemy.totem) nonTotemCount++;
    if (destructionWavePending) nonTotemCount += game.toSpawn;
  }
  context.nonTotemCount = nonTotemCount;
  context.hasNonTotemTarget = nonTotemCount > 0;
  planDestructionObjective(context);
  if (goal?.type === 'rescue' && game.villager && !game.villager.dead && !game.villager.rescued) {
    for (const enemy of skeletons) if (tacticalDistance(enemy.pos, game.villager.pos) <= RESCUE_CLEAR_RADIUS) rescueThreats.push(enemy);
  }
  context.rescueThreats = rescueThreats;
  context.captive = goal?.type === 'rescue' && game.villager && !game.villager.dead && !game.villager.rescued ? game.villager : null;
  context.rescueThreatened = rescueThreats.length > 0;
  context.rescueRunner = rescueRunnerFor(context.captive, party);
  context.alliedUnits = alliedUnits;
  context.livingAllies = livingAllies;
  return context;
}

const targetContext = () => activeTargetContext || makeTargetContext();

// guarda do protegido: o curandeiro do grupo, senão o mais resistente; o último vivo mantém a vaga; empates usam id estável
const isSupportHero = (hero) => pickGroupId(hero.cfg) === 'suporte';
const guardDurability = (hero) => (hero.maxHp || 0) + (hero.armor || 0) * 30;
const stableHeroId = (hero) => String(hero.cfg?.id || '');
function escortGuardOf(party) {
  let best = null;
  for (const hero of party) {
    if (hero.dead) continue;
    if (!best) { best = hero; continue; }
    const supportRank = Number(isSupportHero(hero)) - Number(isSupportHero(best));
    const durabilityRank = guardDurability(hero) - guardDurability(best);
    if (supportRank > 0 || (supportRank === 0
      && (durabilityRank > 0 || (durabilityRank === 0 && stableHeroId(hero).localeCompare(stableHeroId(best)) < 0)))) best = hero;
  }
  return best;
}

// regra 1: herói que não é guarda caça quem está na arena visível em volta do grupo, longe ou perto do posto
function inHuntArena(hero, target, context, slack = 0) {
  if (game.state !== 'fight' || hero === context.escortGuard || !context.arenaCenter) return false;
  if (fixedDefenseGoal(context.goal) && hero === defenseAnchor(context)) return false;
  // com protegido, a caça não larga o objetivo: o alvo precisa estar perto dele
  if (context.huntLimited && tacticalDistance(context.villager.pos, target.pos) > ESCORT_HUNT_LIMIT + slack) return false;
  return tacticalDistance(context.arenaCenter, target.pos) <= HERO_HUNT_RADIUS + slack;
}

// o guarda do protegido ataca quem chega perto do protegido ou dele, mesmo fora do leash do posto
function escortGuardReach(hero, target, context) {
  if (hero !== context.escortGuard || !context.villager) return false;
  if (tacticalDistance(hero.post, target.pos) > LEASH + hero.range + 5) return false;
  return tacticalDistance(context.villager.pos, target.pos) <= ESCORT_GUARD_REACH
    || tacticalDistance(hero.pos, target.pos) <= hero.range + 1.5;
}
const partyNow = () => activeTargetContext?.party || heroes();   // grupo do quadro, sem refiltrar as unidades a cada golpe

// sinergia vale pelo estado do alvo (lento, preso, marcado…), não por quem está no grupo
function applySynergy(owner, target, damage) {
  const active = damageSynergies(owner.cfg.id, target);
  if (!active.length) return damage;
  if ((target.synergyNoticeT || 0) <= 0) { popText(target.pos, `${active[0].icon}+${Math.round(active[0].bonus * 100)}%`, 'evolve'); target.synergyNoticeT = 1.2; }
  return damage * synergyDamageMultiplier(owner.cfg.id, target);
}

function inMeleeArc(owner, target, radius = 2.2) {
  const dx = target.pos.x - owner.pos.x, dz = target.pos.z - owner.pos.z;
  const distanceSq = dx * dx + dz * dz;
  if (!distanceSq || distanceSq > radius * radius) return false;
  const facing = dx * Math.sin(owner.root.rotation.y) + dz * Math.cos(owner.root.rotation.y);
  return facing >= 0.5 * Math.sqrt(distanceSq);
}

// inimigos numa faixa reta de "from" na direção de "to" (investida do Duelista que atravessa a fila)
function lineTargets(from, to, candidates, length, halfWidth = 0.7) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  return candidates.filter((s) => {
    const ox = s.pos.x - from.x, oz = s.pos.z - from.z, along = ox * ux + oz * uz;
    return along >= -0.3 && along <= length + 0.3 * s.size && Math.abs(ox * uz - oz * ux) <= halfWidth + 0.3 * (s.size - 1);
  });
}
// inimigos num cone de "from" na direção de "to" (Palma do vento do Monge); minDot = cosseno da meia abertura
function coneTargets(from, to, candidates, length, minDot = 0.6) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  return candidates.filter((s) => {
    const ox = s.pos.x - from.x, oz = s.pos.z - from.z, r = Math.hypot(ox, oz);
    return r <= length + 0.4 * (s.size - 1) && (r < 0.6 || (ox * ux + oz * uz) / r >= minDot);
  });
}
// o inimigo com mais vizinhos num raio (centro da Chuva de flechas e do Frasco volátil); prefer desempata
function densest(candidates, radius, prefer = null) {
  let center = null, most = 0;
  for (const s of candidates) {
    let n = 0;
    for (const o of candidates) if (o.pos.distanceTo(s.pos) <= radius) n++;
    if (n > most || (n === most && s === prefer)) { most = n; center = s; }
  }
  return { center, count: most };
}
const BLADE_DANCE_TICK = 0.3;   // intervalo entre as voltas da Dança de lâminas
const MEDITATE_TICK = 0.5;      // intervalo entre as curas da Meditação
const SPEAR_REACH = 1.4;   // Postura de lança do Lanceiro: multiplica o alcance do herói
const STONE_SKIN = { taken: 0.4, reflect: 0.3, grow: 1.22 };   // Pele de pedra do Brutamontes: dano recebido, reflexo e escala

// Apostador: o sorteio é a identidade, mas a sorte nunca fere o grupo (o azar só reduz o bônus)
const BARD_SUITS = [
  { mark: '♥', name: 'Copas', color: 0xff5a6e, face: 1 }, { mark: '♠', name: 'Espadas', color: 0xc9c2e8, face: 2 },
  { mark: '♦', name: 'Ouros', color: 0xffb040, face: 1 }, { mark: '♣', name: 'Paus', color: 0x7fe08a, face: 2 },
];
const ROYAL_FLUSH_CHANCE = 0.2;
// efeito de um naipe: 0 ♥ cura o aliado mais ferido (all: todos), 1 ♠ dano extra no alvo, 2 ♦ lentidão no alvo, 3 ♣ velocidade de ataque nos aliados próximos
function bardSuit(hero, enemy, index, mult = 1, all = false) {
  const level = skillLevel(hero.level), power = hero.skillPower * mult, suit = BARD_SUITS[index];
  const party = partyNow().filter((h) => !h.dead);
  if (index === 0) {
    const hurt = party.filter((h) => h.hp < h.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    for (const h of all ? hurt : hurt.slice(0, 1)) {
      const heal = Math.min(h.maxHp - h.hp, (all ? 10 + 5 * level : 14 + 4 * level) * power);
      h.hp += heal; hero.stats.cura += heal; popText(h.pos, '+' + Math.round(heal), 'heal'); FX.suitMark(h.pos, suit.color, suit.face);
    }
    if (!hurt.length) runeShieldOn(party.reduce((a, h) => (h.hp < a.hp ? h : a), party[0] || hero), hero, 8 * power, 6);   // sem ferido, vira um escudo pequeno
  } else if (index === 1) {
    if (enemy && !enemy.dead) heroHit(hero, enemy, hero.dmg * 1.1 * power);
  } else if (index === 2) {
    if (enemy && !enemy.dead) controlEnemy(enemy, 'slowT', (2.5 + 0.3 * level) * power);
  } else {
    for (const h of party) if (h.pos.distanceTo(hero.pos) <= (all ? 14 : 8)) {
      h.songT = Math.max(h.songT, 4 * power);
      h.songHaste = Math.min(h.songHaste || 1, 1 - 0.22 * Math.min(1.5, mult));
    }
  }
  if (index === 3) FX.suitMark(hero.pos, suit.color, suit.face);
  else if (index !== 0 && enemy) FX.suitMark(enemy.pos, suit.color, suit.face);
}
// All-in: a chuva de cartas fere a área durante ~1,4 s (o dano total já inclui o Royal Flush)
function cardStorm(owner, at, radius, total) {
  const mesh = groundMark(at, radius, 0xd8404a, 0.25);
  flames.push({ mesh, radius, owner, wait: 0.55, t: 1.4, tick: 0, every: 0.3, dmg: total / 5, onTick: (f) => FX.cardRain(f.mesh.position, f.radius) });
  wave(at, 0xff6a7a, radius * 1.4, radius, 0.45, { geo: ringGeo, opacity: 0.7 });
}

function damageCleave(owner, primary) {
  const count = units.length;
  for (let i = 0; i < count; i++) {
    const s = units[i];
    if (s.team !== 'skeleton' || s.dead || s.spawning || !inMeleeArc(owner, s)) continue;
    const secondary = s !== primary;
    const beforeX = s.vel.x, beforeZ = s.vel.z;
    heroHit(owner, s, owner.dmg * (secondary ? 0.6 : 1));
    if (secondary) {
      s.vel.x = beforeX + (s.vel.x - beforeX) * 0.5;
      s.vel.z = beforeZ + (s.vel.z - beforeZ) * 0.5;
    }
  }
}

// Controle num inimigo (stunT, rootT, slowT): nunca encurta o que já está valendo.
// Chefes têm retorno decrescente em atordoar/prender: dentro de 8 s do último controle, o 2º dura 50%,
// o 3º 25% e depois ficam imunes até a janela fechar. Devolve a duração aplicada (0 = resistiu).
const BOSS_CONTROL_WINDOW = 8, BOSS_CONTROL_SCALE = [1, 0.5, 0.25];
function controlEnemy(enemy, key, duration) {
  if (enemy.boss && key !== 'slowT') {
    if (!(enemy.controlWindowT > 0)) enemy.controlCount = 0;
    duration *= BOSS_CONTROL_SCALE[enemy.controlCount] ?? 0;
    if (duration <= 0) return 0;
    enemy.controlCount++;
    enemy.controlWindowT = BOSS_CONTROL_WINDOW;
  }
  enemy[key] = Math.max(enemy[key] || 0, duration);
  return duration;
}

// Berro de Guerra: o golpe do Brutamontes atordoa até 3 inimigos colados nele (o alvo primeiro), cada um no máximo 1 vez por 3 s; chefe só desacelera
const ROAR = { reach: 3.5, max: 3, stun: 1, icd: 3 };
function roarStun(hero, target) {
  const near = skeletonsAlive().filter((s) => !s.spawning && !s.totem && s.pos.distanceTo(hero.pos) <= ROAR.reach + 0.4 * (s.size - 1) && !(game.runTime - (s.roarAt ?? -99) < ROAR.icd));
  near.sort((a, b) => (a === target ? -1 : b === target ? 1 : a.pos.distanceTo(hero.pos) - b.pos.distanceTo(hero.pos)));
  let n = 0;
  for (const s of near) {
    if (n++ >= ROAR.max) break;
    s.roarAt = game.runTime;
    if (s.boss) controlEnemy(s, 'slowT', ROAR.stun);
    else if (controlEnemy(s, 'stunT', ROAR.stun)) s.pendingHit = null;
  }
  if (n) FX.roarPulse(hero, ROAR.reach);
}

function damageArea(center, radius, dmg, owner = null) {
  const count = units.length;
  for (let i = 0; i < count; i++) {
    const s = units[i];
    if (s.team !== 'skeleton' || s.dead || s.spawning
      || s.pos.distanceTo(center) > radius + 0.4 * (s.size - 1)) continue;
    if (owner) heroHit(owner, s, dmg, center);
    else s.takeDamage(dmg, center);
  }
}

function heroHit(owner, target, dmg, center = owner.pos) {
  dmg = applySynergy(owner, target, dmg);
  const critChance = (owner.cfg.id === 'assassin' ? Math.min(0.7, (0.35 + (skillLevel(owner.level) - 1) * 0.05) * owner.skillPower) : 0) + (owner.critT > 0 ? owner.critBonus : 0);   // Visão do Alvo soma ao crítico
  const critical = critChance > 0 && Math.random() < critChance;
  const dealt = dmg * (critical ? 2 : 1) * (owner.royalT > 0 ? 1 + owner.royalBonus : 1);
  const hpBefore = target.hp;
  target.takeDamage(dealt, center, owner.summoner || owner, critical);
  passiveHook(owner, 'onHit', target, dealt);
  if (owner.cfg?.id === 'vampire' && !owner.dead) vampireLeech(owner, hpBefore - Math.max(0, target.hp));
  if (owner.leechT > 0 && !owner.dead) {   // Sede de Sangue: o golpe devolve vida ao Berserker
    const heal = Math.min(owner.maxHp - owner.hp, dealt * owner.leech);
    if (heal > 0) { owner.hp += heal; owner.stats.cura += heal; }
  }
  return critical;
}

// Vampira: parte do dano causado vira vida no aliado mais ferido (ela mesma inclusive); as técnicas sobem a fração em vampFrac
function vampireLeech(owner, dealt) {
  if (!(dealt > 0)) return;
  let ally = null;
  for (const h of partyNow()) if (!h.dead && h.hp < h.maxHp && (!ally || h.hp / h.maxHp < ally.hp / ally.maxHp)) ally = h;
  if (!ally) return;
  const heal = Math.min(ally.maxHp - ally.hp, scaleBranchEffect(owner, 'support', dealt * (owner.vampFrac || 0.2)));
  if (heal <= 0) return;
  ally.hp += heal; owner.stats.cura += heal;
  popText(ally.pos, '+' + Math.round(heal), 'heal');
  if (ally !== owner) beam(owner.pos, ally.pos, 0x8a1a2e);   // fio escuro de um à outra
}


function nearest(from, list) {
  let best = null, bd = Infinity;
  for (const u of list) {
    if (u.dead) continue;
    const d = u.pos.distanceToSquared(from);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function tacticalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
const isBreachRunner = (target, objective) => !!target && (target.raider || target.target === objective || target.pendingHit?.target === objective);
const breachTargetRadius = (target, objective) => isBreachRunner(target, objective)
  ? BREACH_RUNNER_INTERCEPT_RADIUS : BREACH_INTERCEPT_RADIUS;
const isDefenseThreat = (target, objective) => {
  if (!objective || !target) return false;
  if (target.target === objective || target.pendingHit?.target === objective) return true;
  const targetsHero = target.target?.team === 'hero' || target.pendingHit?.target?.team === 'hero';
  // Na defesa, qualquer inimigo que já escolheu um herói como alvo é uma ameaça
  // ativa. Os interceptores ainda respeitam RANGED_INTERCEPT e seus slots; isso
  // evita que perseguidores móveis batam no grupo enquanto a formação os ignora.
  return targetsHero;
};

const fixedDefenseGoal = (goal) => goal?.type === 'defend' || goal?.type === 'breach';
function defenseAnchor(context) {
  if (!fixedDefenseGoal(context.goal)) return null;
  if (context.defenseAnchor && !context.defenseAnchor.dead) return context.defenseAnchor;
  context.defenseAnchor = (context.goal.type === 'defend' && context.villager ? escortGuardOf(context.party) : null) || context.party.find((hero) => !hero.dead) || null;
  return context.defenseAnchor;
}

function interceptorRanksBefore(hero, distance, other, otherDistance) {
  if (!other) return true;
  const ranged = Boolean(hero.ranged), otherRanged = Boolean(other.ranged);
  if (ranged !== otherRanged) return ranged;
  if (hero.range !== other.range) return hero.range > other.range;
  if (hero.speed !== other.speed) return hero.speed > other.speed;
  if (distance !== otherDistance) return distance < otherDistance;
  return String(hero.cfg?.id || '') < String(other.cfg?.id || '');
}

function hasTacticalInterceptSlot(hero, target, context, limit, slots, includeNormalReach = false) {
  const { goal, party } = context;
  let first = null, second = null, firstDistance = Infinity, secondDistance = Infinity;
  for (const candidate of party) {
    if (candidate.dead || (fixedDefenseGoal(goal) && candidate === defenseAnchor(context))) continue;
    const distance = tacticalDistance(candidate.post, target.pos);
    const normalReach = distance <= LEASH + candidate.range;
    if ((!includeNormalReach && normalReach) || distance > limit) continue;
    if (interceptorRanksBefore(candidate, distance, first, firstDistance)) {
      second = first; secondDistance = firstDistance;
      first = candidate; firstDistance = distance;
    } else if (slots > 1 && interceptorRanksBefore(candidate, distance, second, secondDistance)) {
      second = candidate; secondDistance = distance;
    }
  }
  // Mantém os melhores em espaço constante: sem array, objetos temporários ou sort
  // em cada consulta de alvo, com desempate estável que não depende da seleção.
  return hero === first || (slots > 1 && hero === second);
}

function hasBreachInterceptSlot(hero, target, context) {
  const { party, villager } = context;
  if (!villager) return false;
  const distanceToObjective = tacticalDistance(villager.pos, target.pos);
  const radius = breachTargetRadius(target, villager);
  if (distanceToObjective > radius) return false;
  const anchor = defenseAnchor(context);
  const fromPost = tacticalDistance(hero.post, target.pos);
  // Um defensor protege o portão; um aliado intercepta, e em dupla ambos
  // respondem aos corredores marcados como ameaça direta à ponte.
  if (hero === anchor) {
    let living = 0, anotherInterceptor = false;
    for (const ally of party) {
      if (ally.dead) continue;
      living++;
      if (ally !== anchor && ally.busy <= 0 && ally.kiteT <= 0
        && tacticalDistance(ally.post, target.pos) <= Math.max(radius, LEASH + ally.range)) anotherInterceptor = true;
    }
    return fromPost <= hero.range + 0.5 || distanceToObjective <= LEASH + hero.range
      || living <= 2 && distanceToObjective <= BREACH_INTERCEPT_RADIUS
      || living === 2 && isBreachRunner(target, villager) && distanceToObjective <= BREACH_RUNNER_INTERCEPT_RADIUS
      || !anotherInterceptor && isBreachRunner(target, villager);
  }
  if (fromPost <= LEASH + hero.range || tacticalDistance(hero.pos, target.pos) <= hero.range + 1.5) return true;
  let first = null, second = null, firstDistance = Infinity, secondDistance = Infinity;
  for (const candidate of party) {
    if (candidate.dead || candidate === anchor || candidate.busy > 0 || candidate.kiteT > 0) continue;
    const distance = tacticalDistance(candidate.post, target.pos);
    if (distance <= LEASH + candidate.range || distance > radius) continue;
    if (interceptorRanksBefore(candidate, distance, first, firstDistance)) {
      second = first; secondDistance = firstDistance;
      first = candidate; firstDistance = distance;
    } else if (interceptorRanksBefore(candidate, distance, second, secondDistance)) {
      second = candidate; secondDistance = distance;
    }
  }
  return hero === first || hero === second;
}

function anotherDefenseHeroCanIntercept(hero, target, context) {
  const { party, villager } = context;
  for (const ally of party) {
    // Busy e recuo ativo impedem o Hero.update de chegar à seleção de alvo neste quadro.
    if (ally === hero || ally.dead || ally.busy > 0 || ally.kiteT > 0) continue;
    const fromPost = tacticalDistance(ally.post, target.pos);
    if (fromPost <= LEASH + ally.range
      || tacticalDistance(ally.pos, target.pos) <= ally.range + 1.5) return true;
    if (villager && fromPost <= LEASH + ally.range + 5
      && (isDefenseThreat(target, villager) || tacticalDistance(villager.pos, target.pos) <= 10.5)) return true;
  }
  return false;
}

// quem já está brigando só larga o alvo quando ele se afasta bem do posto (evita ir e voltar na borda)
function stillEngaged(hero, target, context = targetContext()) {
  if (context.goal?.type === 'bosses' && target.phaseBoss && !castleBossInsideRoom(target)) return false;
  if (hero.engagedWith !== target) return false;
  const { villager } = context;
  const fromPost = tacticalDistance(hero.post, target.pos);
  if (context.goal?.type === 'hunt' && target === game.huntMark && target.hunted)
    return fromPost <= HUNT_PURSUIT_LIMIT && hasTacticalInterceptSlot(hero, target, context, HUNT_PURSUIT_LIMIT, HUNT_INTERCEPTORS, true);
  if (context.goal?.type === 'defend' && villager) {
    if (game.surviveT <= 0 && fromPost <= DEFENSE_CLEANUP_INTERCEPT) return true;
    if (hero === defenseAnchor(context)) {
      const onlyDefender = context.party.every((ally) => ally === hero || ally.dead);
      const objectiveAttack = isDefenseThreat(target, villager)
        && fromPost <= LEASH + hero.range + 5
        && !anotherDefenseHeroCanIntercept(hero, target, context);
      return fromPost <= hero.range + ENGAGE_SLACK || objectiveAttack
        || onlyDefender && tacticalDistance(villager.pos, target.pos) <= DEFEND_INTERCEPT_RADIUS;
    }
    const nearShrine = tacticalDistance(villager.pos, target.pos) <= DEFEND_INTERCEPT_RADIUS;
    const objectiveIntercept = isDefenseThreat(target, villager)
      && (fromPost <= LEASH + hero.range || hasTacticalInterceptSlot(hero, target, context, RANGED_INTERCEPT, RANGED_INTERCEPTORS));
    return nearShrine || objectiveIntercept;
  }
  const shrineCleanup = context.goal?.type === 'defend' && hero === defenseAnchor(context)
    && game.surviveT <= 0 && fromPost <= DEFENSE_CLEANUP_INTERCEPT;
  if (context.goal?.type === 'defend' && villager
    && tacticalDistance(villager.pos, target.pos) > DEFEND_INTERCEPT_RADIUS
    && !isDefenseThreat(target, villager) && !shrineCleanup) return false;
  if (hero === defenseAnchor(context)) {
    const canCoverFromPost = fromPost <= hero.range + 0.5;
    const objectiveAttack = villager && isDefenseThreat(target, villager)
      && fromPost <= LEASH + hero.range + 5
      && !anotherDefenseHeroCanIntercept(hero, target, context);
    const lastDefenderKeepsThreat = hero.engagedWith === target
      && hero.lastDefenderThreatTarget === target
      && fromPost <= LEASH + hero.range + 5
      && context.party.every((ally) => ally === hero || ally.dead);
    return canCoverFromPost || escortGuardReach(hero, target, context) || !!objectiveAttack || lastDefenderKeepsThreat;
  }
  return fromPost <= LEASH + hero.range + ENGAGE_SLACK || escortGuardReach(hero, target, context) || inHuntArena(hero, target, context, ENGAGE_SLACK);
}

// Heróis à distância recuam alguns passos quando um inimigo corpo a corpo encosta, puxando para o
// posto (atrás da linha de frente), e voltam a atirar; a recarga evita que passem a luta fugindo.
const KITE_TRIGGER = 4.3, KITE_EMERGENCY_TRIGGER = 2.2, KITE_STEP = 3, KITE_TIME = 0.7, KITE_COOLDOWN = 2.2;
const kiteAway = new THREE.Vector3(), kiteHome = new THREE.Vector3();
function kiteFrom(h, dt) {
  h.kiteCd = Math.max(0, (h.kiteCd || 0) - dt);
  if (h.kiteT > 0) { h.kiteT -= dt; return h.kiteTo; }
  if (h.kiteCd > 0) return null;
  let threat = null, best = Infinity;
  for (const s of activeTargetContext?.attackableSkeletons ?? skeletonsAlive()) {
    if (s.dead || s.spawning || s.totem) continue;
    const attacking = s.pendingHit?.target === h || s.target === h || s.engagedWith === h;
    if (s.ranged && !attacking) continue;
    const d = tacticalDistance(s.pos, h.pos);
    if (d < (attacking ? KITE_TRIGGER : KITE_EMERGENCY_TRIGGER) && d < best) { best = d; threat = s; }
  }
  if (!threat) return null;
  kiteAway.subVectors(h.pos, threat.pos).setY(0).normalize();
  kiteHome.subVectors(h.post, h.pos).setY(0);
  if (Math.hypot(kiteHome.x, kiteHome.z) > 0.1) kiteAway.add(kiteHome.normalize().multiplyScalar(0.6)).normalize();
  h.kiteTo ||= new THREE.Vector3();
  h.kiteTo.copy(h.pos).addScaledVector(kiteAway, KITE_STEP);
  // perto do posto, o recuo não tira o atirador da formação; caçando longe dele, só se afasta do inimigo
  if (tacticalDistance(h.pos, h.post) <= LEASH && tacticalDistance(h.kiteTo, h.post) > LEASH) h.kiteTo.copy(h.post);
  h.kiteT = KITE_TIME;
  h.kiteCd = KITE_COOLDOWN;
  return h.kiteTo;
}

const SHOOTER_RETREAT_TRIGGER = 3.2, SHOOTER_RETREAT_STEP = 0.6;
const SHOOTER_RETREAT_WINDOW = 0.4, SHOOTER_RETREAT_COOLDOWN = 9;
function kiteSkeletonFrom(shooter, target, dt) {
  shooter.retreatCooldown = Math.max(0, (shooter.retreatCooldown || 0) - dt);
  if (shooter.retreatMoveT > 0) {
    shooter.retreatMoveT = Math.max(0, shooter.retreatMoveT - dt);
    if (target && shooter.retreatMoveT > 0 && shooter.retreatTarget
        && tacticalDistance(shooter.pos, shooter.retreatTarget) > 0.25) return shooter.retreatTarget;
    shooter.retreatMoveT = 0;
  }
  if (!target || target.ranged || target.structure || target.team === 'villager') return null;
  let dx = shooter.pos.x - target.pos.x, dz = shooter.pos.z - target.pos.z;
  let distance = Math.hypot(dx, dz);
  if (distance >= SHOOTER_RETREAT_TRIGGER || shooter.retreatCooldown > 0) return null;
  if (distance < 0.001) { dx = Math.sin(shooter.root.rotation.y); dz = Math.cos(shooter.root.rotation.y); distance = 1; }
  shooter.retreatTarget ||= new THREE.Vector3();
  shooter.retreatTarget.set(
    shooter.pos.x + dx / distance * SHOOTER_RETREAT_STEP,
    shooter.pos.y,
    shooter.pos.z + dz / distance * SHOOTER_RETREAT_STEP,
  );
  shooter.retreatMoveT = SHOOTER_RETREAT_WINDOW;
  shooter.retreatCooldown = SHOOTER_RETREAT_COOLDOWN;
  return shooter.retreatTarget;
}

const hasDestructionGoal = (goal) => goal?.type === 'totems' || goal?.type === 'tower';
const DESTRUCTION_OBJECTIVE_FOCUS = 60;
function planDestructionObjective(context) {
  if (!hasDestructionGoal(context.goal)) return;
  const { party, attackableSkeletons, objectiveRunners } = context;
  let target = null, targetDistance = Infinity;
  for (const objective of attackableSkeletons) {
    if (!objective.totem) continue;
    let nearestPost = Infinity;
    for (const hero of party) if (!hero.dead) nearestPost = Math.min(nearestPost, tacticalDistance(hero.post, objective.pos));
    if (nearestPost < targetDistance) { target = objective; targetDistance = nearestPost; }
  }
  context.objectiveTarget = target;
  if (!target || !context.hasNonTotemTarget) return;

  // Mantém o grupo dividido entre o objetivo e a onda; quando surge um chefe,
  // só um herói fica livre para enfrentá-lo enquanto os demais quebram o totem.
  let alive = 0;
  for (const hero of party) if (!hero.dead) alive++;
  const focusedObjective = context.goal?.type === 'totems' || context.phaseBossAlive;
  const maxRunners = Math.min(alive, focusedObjective ? Math.max(1, alive - 1) : Math.floor(alive / 2));
  const slots = context.hasNonTotemTarget ? maxRunners : 0;
  for (let slot = 0; slot < slots; slot++) {
    let runner = null, runnerDistance = Infinity;
    for (const hero of party) {
      if (hero.dead || objectiveRunners.includes(hero)) continue;
      const distance = tacticalDistance(hero.post, target.pos);
      if (interceptorRanksBefore(hero, distance, runner, runnerDistance)) {
        runner = hero;
        runnerDistance = distance;
      }
    }
    if (runner) objectiveRunners.push(runner);
  }
}
// objetivos que terminam com o chefe da fase: chefe, duelo e o par Lich + Carrasco
const bossGoal = (goal) => goal?.type === 'boss' || goal?.type === 'duel' || goal?.type === 'twin' || goal?.type === 'bosses';
const groupedBossGoal = (goal) => goal?.type === 'twin' || goal?.type === 'bosses';
function castleBossInsideRoom(target) {
  const zone = world.zoneOf(game.phase);
  if (zone?.type !== 'castle') return true;
  const dx = target.pos.x - zone.center.x, dz = target.pos.z - zone.center.z;
  const lateral = dx * zone.side.x + dz * zone.side.z;
  const forward = dx * zone.fwd.x + dz * zone.fwd.z;
  const margin = Math.max(0.8, (target.size || 1) * 0.55);
  return Math.abs(lateral) <= zone.halfWidth - margin
    && Math.abs(forward) <= zone.halfLength - margin;
}

function canHeroReachTarget(hero, target, context = targetContext()) {
  const { goal, party, villager } = context;
  if (goal?.type === 'bosses' && target.phaseBoss && !castleBossInsideRoom(target)) return false;
  const fromPost = tacticalDistance(hero.post, target.pos);
  const breachThreat = goal?.type === 'breach' && villager
    && tacticalDistance(villager.pos, target.pos) <= breachTargetRadius(target, villager);
  // Um defensor se protege se o inimigo já o escolheu e está em contato local,
  // mesmo um pouco além do perímetro do portão. Isso não libera os outros heróis.
  if (goal?.type === 'breach'
    && (target.target === hero || target.pendingHit?.target === hero)
    && tacticalDistance(hero.pos, target.pos) <= BREACH_SELF_DEFENSE_RADIUS) return true;
  // Na ponte, corredores são interceptados dentro de um raio limitado do portão.
  if (breachThreat) return hasBreachInterceptSlot(hero, target, context);
  if (goal?.type === 'defend' && villager) {
    // Depois do cronômetro, todo o grupo limpa sobreviventes próximos sem voltar à caça pelo mapa.
    if (game.surviveT <= 0 && fromPost <= DEFENSE_CLEANUP_INTERCEPT) return true;
    const nearShrine = tacticalDistance(villager.pos, target.pos) <= DEFEND_INTERCEPT_RADIUS;
    const objectiveThreat = isDefenseThreat(target, villager);
    if (hero === defenseAnchor(context)) {
      if (fromPost <= hero.range + 0.5) return true;
      if (nearShrine && context.party.every((ally) => ally === hero || ally.dead)) return true;
      return objectiveThreat
        && fromPost <= LEASH + hero.range + 5
        && !anotherDefenseHeroCanIntercept(hero, target, context);
    }
    if (nearShrine) return true;
    if (!objectiveThreat) return false;
    if (fromPost <= LEASH + hero.range) return true;
    return hasTacticalInterceptSlot(hero, target, context, RANGED_INTERCEPT, RANGED_INTERCEPTORS);
  }
  // No resgate, o corredor precisa alcançar guardas junto ao prisioneiro mesmo fora do leash do grupo.
  if (goal?.type === 'rescue' && hero === game.rescueRunner && context.rescueThreats?.includes(target)) return true;
  if (fixedDefenseGoal(goal) && hero === defenseAnchor(context)) {
    // Depois da defesa, não entram mais ondas: a âncora pode sair do posto para
    // limpar os sobreviventes, mas continua dentro do alcance da fase.
    if (goal.type === 'defend' && game.surviveT <= 0 && fromPost <= DEFENSE_CLEANUP_INTERCEPT) return true;
    // A âncora luta do próprio posto. Só abandona a linha se o alvo já prepara
    // um golpe no objetivo e nenhum outro herói vivo consegue interceptá-lo.
    if (fromPost <= hero.range + 0.5 || escortGuardReach(hero, target, context)) return true;
    const objectiveAttack = villager && target.pendingHit?.target === villager
      && fromPost <= LEASH + hero.range + 5
      && !anotherDefenseHeroCanIntercept(hero, target, context);
    const lastDefenderThreat = target.pendingHit?.target === hero
      && fromPost <= LEASH + hero.range + 5
      && !party.some((ally) => ally !== hero && !ally.dead);
    if (lastDefenderThreat) hero.lastDefenderThreatTarget = target;
    return !!objectiveAttack || lastDefenderThreat;
  }
  if (hasDestructionGoal(goal) && target.totem) {
    if (!context.hasNonTotemTarget) return true;
    return target === context.objectiveTarget && context.objectiveRunners?.includes(hero);
  }
  // Um Golem pode ser empurrado para trás da formação. Nas missões de chefe,
  // o grupo tem autorização para fechar a distância e não deixar a fase presa.
  if (goal?.type === 'boss' && target.boss && fromPost <= PHASE_CLEANUP_INTERCEPT) return true;
  const huntTarget = goal?.type === 'hunt' && target === game.huntMark && target.hunted;
  if (huntTarget) {
    if (fromPost > HUNT_PURSUIT_LIMIT) return false;
    return hasTacticalInterceptSlot(hero, target, context, HUNT_PURSUIT_LIMIT, HUNT_INTERCEPTORS, true);
  }
  const postReach = fromPost <= LEASH + hero.range;
  const nearTarget = tacticalDistance(hero.pos, target.pos) <= hero.range + 1.5;
  // No Trono, o grupo inteiro pode pressionar o chefe móvel dentro do alcance curto.
  // No Coração, o salão fechado também permite que toda a equipe avance.
  if (groupedBossGoal(goal) && target.phaseBoss && !postReach) {
    if (goal.type === 'bosses') return fromPost <= CASTLE_BOSS_INTERCEPT;
    return fromPost <= TWIN_BOSS_INTERCEPT;
  }
  if (postReach || nearTarget || escortGuardReach(hero, target, context) || inHuntArena(hero, target, context)) return true;

  // Evita que os últimos inimigos móveis, já além da formação, travem a fase.
  // Só dois heróis avançam, e apenas quando a onda acabou e restam até dois alvos comuns.
  if (hasDestructionGoal(goal) && !context.objectiveTarget && game.state === 'fight' && game.toSpawn <= 0
    && context.nonTotemCount > 0 && context.nonTotemCount <= PHASE_CLEANUP_INTERCEPTORS
    && !target.totem && !target.phaseBoss && target.team === 'skeleton' && fromPost <= PHASE_CLEANUP_INTERCEPT) {
    if (!context.phaseBossAlive
      && hasTacticalInterceptSlot(hero, target, context, PHASE_CLEANUP_INTERCEPT, PHASE_CLEANUP_INTERCEPTORS)) return true;
  }

  // Besteiros e magos imóveis podem surgir até 17 m à frente; a equipe precisa
  // interceptá-los para não deixar um atirador inalcançável travar a próxima fase.
  // Em defesas fixas, a âncora fica no posto; até dois outros heróis podem
  // interceptar atiradores imóveis dentro deste raio limitado.
  // Inimigos móveis e totens seguem as regras próprias abaixo.
  if (target.team === 'skeleton' && target.ranged && !target.mobile && !target.totem
    && fromPost <= RANGED_INTERCEPT) {
    if (hasTacticalInterceptSlot(hero, target, context, RANGED_INTERCEPT, RANGED_INTERCEPTORS)) return true;
  }

  // Na escolta, o grupo pode sair um pouco da formação para tirar um inimigo do aldeão.
  const interceptLimit = LEASH + hero.range + 5;
  if (villager && fromPost <= interceptLimit
    && (target.pendingHit?.target === villager || tacticalDistance(villager.pos, target.pos) <= 10.5)) return true;

  // Na missão sem quedas, permite uma interceptação curta para salvar um herói
  // crítico ou interromper um golpe já preparado contra qualquer aliado.
  const threatenedHero = target.pendingHit?.target?.team === 'hero';
  let nearCriticalHero = false;
  if (goal?.type === 'nofall') for (const ally of party) {
    if (!ally.dead && ally.hp / ally.maxHp <= 0.45 && tacticalDistance(ally.pos, target.pos) <= 4.5) { nearCriticalHero = true; break; }
  }
  if (goal?.type === 'nofall' && fromPost <= interceptLimit && (threatenedHero || nearCriticalHero)) return true;

  return false;
}

function heroTargetScore(hero, target, from = hero.pos, context = targetContext()) {
  const { goal, friends, party, villager } = context;
  const distance = tacticalDistance(from, target.pos);
  let score = distance;
  let distanceToVulnerable = Infinity;

  // O resgatista elimina primeiro quem está encostando no prisioneiro,
  // mesmo que outra ameaça esteja mais perto do próprio herói.
  if (goal?.type === 'rescue' && hero === game.rescueRunner && game.villager && !game.villager.rescued) {
    const captiveThreatDistance = tacticalDistance(game.villager.pos, target.pos);
    if (captiveThreatDistance <= RESCUE_CLEAR_RADIUS) score -= (RESCUE_CLEAR_RADIUS - captiveThreatDistance) * 1.6;
  }

  if (target.boss) score -= bossGoal(goal) ? 12 : 3.5;
  if (goal?.type === 'hunt' && target === game.huntMark && target.hunted) score -= 32;
  if (target.totem) {
    const assignedObjective = hasDestructionGoal(goal) && target === context.objectiveTarget && context.objectiveRunners?.includes(hero);
    score -= assignedObjective ? DESTRUCTION_OBJECTIVE_FOCUS : hasDestructionGoal(goal) ? 24 : 1;
  }
  if (target.enemyKind === 'Priest') score -= 5; // interrompe cura e ressurreição
  if (target.kind?.priority) score -= target.kind.priority; // xamã: derrubá-lo desfaz o escudo de ossos
  if (target.ward) score += 1.5; // protegido pelo escudo: melhor atacar quem o sustenta

  if (target.enemyKind === 'Bomber') {
    let nearby = Infinity;
    for (const ally of friends) if (!ally.dead) nearby = Math.min(nearby, tacticalDistance(ally.pos, target.pos));
    score -= nearby < 7 ? 4 + (7 - nearby) * 0.45 : 1;
  }

  if (target.ranged) score -= hero.ranged ? 2.5 : 1.25;
  const threatenedAlly = target.pendingHit?.target;
  if (threatenedAlly?.team === 'hero') {
    const missingHealth = 1 - Math.max(0, threatenedAlly.hp) / threatenedAlly.maxHp;
    score -= 3 + missingHealth * 2 + (goal?.type === 'nofall' ? 4 : 0);
  }
  // Se o inimigo já escolheu este herói, interrompe o foco antigo antes de o golpe acertar.
  if (target.target === hero || target.engagedWith === hero) score -= 4.5;
  if (goal?.type === 'nofall') {
    for (const ally of party) if (!ally.dead && ally.hp / ally.maxHp <= 0.45) {
      distanceToVulnerable = Math.min(distanceToVulnerable, tacticalDistance(ally.pos, target.pos));
    }
    if (distanceToVulnerable < 6) score -= 1.5 + (6 - distanceToVulnerable) * 0.75;
  }
  let distanceToVillager = Infinity;
  if (villager) {
    distanceToVillager = tacticalDistance(villager.pos, target.pos);
    const toVillager = distanceToVillager;
    if (isDefenseThreat(target, villager)) score -= 11;
    else if (toVillager < 12) score -= (12 - toVillager) * 0.8;
    if (goal?.type === 'breach' && distanceToVillager <= breachTargetRadius(target, villager)) {
      const runnerBonus = isBreachRunner(target, villager) ? 12 : 0;
      score -= 20 + runnerBonus + (breachTargetRadius(target, villager) - distanceToVillager) * 0.8;
      if (target.raider || target.target === villager || target.pendingHit?.target === villager) score -= 12;
    }
    // santuário: saqueador a caminho do cristal (ou já nele) e quem chega a SHRINE_CLOSE m dele vêm antes de tudo
    if (goal?.type === 'defend') {
      if (target.ranged && !target.mobile && isDefenseThreat(target, villager)) score -= 12;
      if (target.raider || target.target === villager) score -= 14;
      if (toVillager < SHRINE_CLOSE) score -= 4;
    }
  }

  // Evita gastar golpes em um alvo quase derrotado quando outro aliado já o
  // está finalizando. Chefes, sacerdotes, bombardeiros e ameaças objetivas
  // continuam concentrando o grupo.
  const healthRatio = target.maxHp > 0 ? Math.max(0, target.hp / target.maxHp) : 1;
  const urgentTarget = (goal?.type === 'hunt' && target === game.huntMark && target.hunted) || target.boss || target.totem || target.ranged
    || target.enemyKind === 'Priest' || target.enemyKind === 'Bomber' || target.kind?.priority || target.pendingHit
    || (goal?.type === 'defend' && isDefenseThreat(target, villager))
    || (goal?.type === 'breach' && (isBreachRunner(target, villager) || distanceToVillager <= BREACH_INTERCEPT_RADIUS))
    || (villager && distanceToVillager < 12)
    || (goal?.type === 'nofall' && distanceToVulnerable < 6);
  if (!urgentTarget && healthRatio < 0.55) {
    let commitment = 0;
    for (const ally of party) {
      if (ally === hero || ally.dead) continue;
      if (ally.pendingHit?.target === target) commitment += 1.5;
      else if (ally.targetFocus === target && tacticalDistance(ally.pos, target.pos) <= ally.range + 2) commitment += 0.55;
    }
    if (commitment > 0) {
      const finishPressure = (0.55 - healthRatio) / 0.55;
      score += Math.min(3.4, commitment * 1.35) * finishPressure;
    }
  }

  return score;
}

function prioritizedHeroTargets(hero, candidates, context = targetContext()) {
  return candidates.map((target, index) => ({ target, index, score: heroTargetScore(hero, target, hero.pos, context) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.target);
}

function highestPriorityHeroTarget(hero, candidates, from = hero.pos, context = targetContext()) {
  let best = null, bestScore = Infinity;
  for (const target of candidates) {
    const score = heroTargetScore(hero, target, from, context);
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}

function skillTargetScore(hero, target, candidates, context = targetContext()) {
  let score = heroTargetScore(hero, target, hero.pos, context);
  const id = hero.cfg.id;

  if (['pyro', 'cryo', 'iceviking'].includes(id)) {
    const radius = id === 'pyro'
      ? (1.1 + (skillLevel(hero.level) - 1) * 0.2) * hero.skillPower
      : (1.3 + (skillLevel(hero.level) - 1) * 0.25) * hero.skillPower;
    let group = 0;
    for (const other of candidates) {
      if (other !== target && tacticalDistance(other.pos, target.pos) <= radius + 0.4 * (other.size - 1)) group++;
    }
    score -= Math.min(5, group * 1.7);
  } else if (id === 'crossbow' || id === 'ninja') {
    const dx = target.pos.x - hero.pos.x, dz = target.pos.z - hero.pos.z;
    const length = Math.hypot(dx, dz) || 1;
    const ux = dx / length, uz = dz / length;
    const maxTravel = id === 'ninja' ? 9 : hero.range + 3.6;
    let hits = 1;
    for (const other of candidates) {
      if (other === target) continue;
      const ox = other.pos.x - hero.pos.x, oz = other.pos.z - hero.pos.z;
      const along = ox * ux + oz * uz;
      const side = Math.abs(ox * uz - oz * ux);
      if (id === 'crossbow') {
        if (along > 0 && along <= maxTravel && side <= 0.45 * other.size) hits++;
      } else {
        for (const angle of [-0.22, 0, 0.22]) {
          const ca = Math.cos(angle), sa = Math.sin(angle);
          const fx = ux * ca + uz * sa, fz = uz * ca - ux * sa;
          const hitAlong = ox * fx + oz * fz;
          const hitSide = Math.abs(ox * fz - oz * fx);
          if (hitAlong > 0 && hitAlong <= maxTravel && hitSide <= 0.45 * other.size) { hits++; break; }
        }
      }
    }
    score -= Math.min(5, (hits - 1) * 1.7);
  }
  return score;
}

function bestSkillTarget(hero, candidates, context = targetContext()) {
  let best = null, bestScore = Infinity;
  for (const target of candidates) {
    const score = skillTargetScore(hero, target, candidates, context);
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}

function partyCanReachBoss(boss, context) {
  for (const member of context.party) if (!member.dead
    && (canHeroReachTarget(member, boss, context) || stillEngaged(member, boss, context))) return true;
  return false;
}

// No trono, todo o grupo concentra o mesmo chefe. Só troca quando o foco morre
// ou nenhum herói vivo consegue mais alcançá-lo; ameaças imediatas ainda furam a fila.
function twinBossFocus(context) {
  if (!groupedBossGoal(context.goal)) { game.twinFocus = null; return null; }
  if (context.twinFocusChecked) {
    if (context.twinFocusWaiting) return null;
    const focus = context.twinFocus;
    if (focus && !focus.dead && !focus.spawning && partyCanReachBoss(focus, context)) return focus;
  }
  let selected = null, selectedHp = Infinity, selectedKey = '', selectedIndex = Infinity;
  let currentFocus = null, spawningBoss = false;
  for (let i = 0; i < context.skeletons.length; i++) {
    const boss = context.skeletons[i];
    if (!boss.phaseBoss || boss.dead) continue;
    if (boss.spawning) { spawningBoss = true; continue; }
    if (!partyCanReachBoss(boss, context)) continue;
    if (boss === game.twinFocus) { currentFocus = boss; break; }
    const hp = boss.maxHp > 0 ? Math.max(0, boss.hp) / boss.maxHp : 1;
    const key = String(boss.enemyKind || boss.kind?.name || '');
    if (hp < selectedHp || (hp === selectedHp
      && (key < selectedKey || (key === selectedKey && i < selectedIndex)))) {
      selected = boss;
      selectedHp = hp;
      selectedKey = key;
      selectedIndex = i;
    }
  }
  if (currentFocus) {
    context.twinFocusChecked = true;
    context.twinFocus = currentFocus;
    context.twinFocusWaiting = false;
    return currentFocus;
  }
  // Chefes usam animações de surgimento diferentes; espere o grupo inteiro aparecer
  // para que os heróis não mudem de alvo no meio da entrada.
  if (spawningBoss) {
    context.twinFocusChecked = true;
    context.twinFocus = null;
    context.twinFocusWaiting = true;
    return null;
  }
  game.twinFocus = context.twinFocus = selected;
  context.twinFocusChecked = true;
  context.twinFocusWaiting = false;
  return game.twinFocus;
}

function isUrgentBossThreat(target, context) {
  // Missões de chefe mantêm o dano no objetivo. Um inimigo prioritário só tira
  // o grupo do chefe quando já está prestes a acertar alguém.
  return target.pendingHit?.target?.team === 'hero' || target.pendingHit?.target?.team === 'villager'
    || (target.phaseBoss && target.telegraph?.alive && target.telegraph.interruptible && target.telegraph.t > 0.2);
}

function prepareCastleBossUrgentPlan(context) {
  if (context.castleUrgentChecked) return;
  context.castleUrgentChecked = true;
  let target = null, bestUrgency = Infinity, bestKind = '';
  for (const boss of context.attackableSkeletons) {
    if (!boss.phaseBoss || !castleBossInsideRoom(boss)) continue;
    const telegraph = boss.telegraph;
    const warningTime = telegraph?.alive && telegraph.interruptible && telegraph.t > 0.2 ? telegraph.t : Infinity;
    const pending = boss.pendingHit?.target?.team === 'hero' ? boss.pendingHit : null;
    const impactTime = pending ? Number.isFinite(pending.t) ? pending.t : 0 : Infinity;
    const urgency = Math.min(warningTime, impactTime);
    const kind = String(boss.enemyKind || boss.kind?.name || '');
    if (urgency < bestUrgency || (urgency === bestUrgency && kind < bestKind)) {
      target = boss;
      bestUrgency = urgency;
      bestKind = kind;
    }
  }
  if (!target || !Number.isFinite(bestUrgency)) return;
  const victim = target.pendingHit?.target;
  let hero = victim?.team === 'hero' && !victim.dead && victim.busy <= 0 && !(victim.kiteT > 0)
    && (canHeroReachTarget(victim, target, context) || stillEngaged(victim, target, context)) ? victim : null;
  let nearestDistance = Infinity;
  if (!hero) for (const candidate of context.party) {
    if (candidate.dead || candidate.busy > 0 || candidate.kiteT > 0
      || !(canHeroReachTarget(candidate, target, context) || stillEngaged(candidate, target, context))) continue;
    const distance = tacticalDistance(candidate.post, target.pos);
    if (distance < nearestDistance || (distance === nearestDistance && String(candidate.cfg?.id || '') < String(hero?.cfg?.id || ''))) {
      hero = candidate;
      nearestDistance = distance;
    }
  }
  context.castleUrgentTarget = target;
  context.castleUrgentHero = hero;
}

function prepareBossUrgentPlan(context, target) {
  if (context.bossUrgentChecked) return;
  context.bossUrgentChecked = true;
  context.bossUrgentTarget = target;
  if (!target) return;
  const victim = target.pendingHit?.target;
  let hero = victim?.team === 'hero' && !victim.dead && victim.busy <= 0 && !(victim.kiteT > 0)
    && (canHeroReachTarget(victim, target, context) || stillEngaged(victim, target, context)) ? victim : null;
  let nearestDistance = Infinity;
  if (!hero) for (const candidate of context.party) {
    if (candidate.dead || candidate.busy > 0 || candidate.kiteT > 0
      || !(canHeroReachTarget(candidate, target, context) || stillEngaged(candidate, target, context))) continue;
    const distance = tacticalDistance(candidate.post, target.pos);
    if (distance < nearestDistance || (distance === nearestDistance && String(candidate.cfg?.id || '') < String(hero?.cfg?.id || ''))) {
      hero = candidate;
      nearestDistance = distance;
    }
  }
  context.bossUrgentHero = hero;
}

// Herói ocioso há FREE_HERO_HUNT_WAIT s com inimigo vivo fora do alcance tático (atirador móvel fora da arena, sobrevivente
// atrás do grupo…) passa a caçá-lo por FREE_HERO_HUNT_HOLD s, em qualquer distância; o grupo não espera para sempre.
// Desiste de quem foge sem ser alcançado por HERO_CHASE_GIVEUP s (HERO_CHASE_SKIP s sem escolhê-lo): outro alvo ou volta à formação.
const FREE_HERO_HUNT_RADIUS = 24;
const FREE_HERO_HUNT_WAIT = 2.5, FREE_HERO_HUNT_HOLD = 4, HERO_CHASE_GIVEUP = 3.5, HERO_CHASE_SKIP = 5;
function heroFreeHunt(hero, target, context) {
  if (!(hero.freeHuntT > 0) || game.state !== 'fight' || hero === context.escortGuard || context.huntLimited || target.team !== 'skeleton' || target.totem) return false;   // defesa de objetivo não abre caça livre pelo mapa
  if (context.goal?.type === 'hunt' && target === game.huntMark) return false;   // o alvo segue os dois slots próprios da missão
  if (context.goal?.type === 'bosses' && target.phaseBoss && !castleBossInsideRoom(target)) return false;
  return !target.untargetable && tacticalDistance(hero.post, target.pos) <= FREE_HERO_HUNT_RADIUS;
}
const heroCanTarget = (hero, target, context) => canHeroReachTarget(hero, target, context) || stillEngaged(hero, target, context);

function chooseHeroTarget(hero, candidates, dt, context = targetContext()) {
  hero.targetFocusT = Math.max(0, (hero.targetFocusT || 0) - dt);
  hero.freeHuntT = Math.max(0, (hero.freeHuntT || 0) - dt);
  hero.chaseSkipT = Math.max(0, (hero.chaseSkipT || 0) - dt);
  let best = null, bestScore = Infinity, focused = null, focusedScore = Infinity;
  let urgentBossTarget = null, urgentBossScore = Infinity;
  let anyEnemy = false;
  for (const target of candidates) {
    if (target.dead || target.spawning) continue;
    if (!target.totem) anyEnemy = true;
    if (target === hero.chaseSkip && hero.chaseSkipT > 0) continue;
    if (!(heroCanTarget(hero, target, context) || heroFreeHunt(hero, target, context))) continue;
    const score = heroTargetScore(hero, target, hero.pos, context);
    if (target === hero.targetFocus) { focused = target; focusedScore = score; }
    if (score < bestScore) { best = target; bestScore = score; }
    if (bossGoal(context.goal) && isUrgentBossThreat(target, context) && score < urgentBossScore) {
      urgentBossTarget = target;
      urgentBossScore = score;
    }
  }
  const { goal, villager, party, friends } = context;
  if (groupedBossGoal(goal)) {
    const focus = twinBossFocus(context);
    if (focus) {
      if (canHeroReachTarget(hero, focus, context) || stillEngaged(hero, focus, context)) {
        best = focus;
        bestScore = heroTargetScore(hero, focus, hero.pos, context);
      } else if (best?.phaseBoss) {
        // Sem acesso ao foco, não troca para outro chefe distante; mantém só uma ameaça local comum.
        best = null;
        bestScore = Infinity;
      }
    }
  } else if (game.twinFocus) game.twinFocus = null;
  if (goal?.type === 'bosses') {
    let directThreat = null, directThreatScore = Infinity;
    for (const target of candidates) {
      if (!target.phaseBoss || target.dead || target.spawning || target.pendingHit?.target !== hero
        || !(canHeroReachTarget(hero, target, context) || stillEngaged(hero, target, context))) continue;
      const score = heroTargetScore(hero, target, hero.pos, context);
      if (score < directThreatScore) { directThreat = target; directThreatScore = score; }
    }
    if (directThreat) {
      best = directThreat;
      bestScore = directThreatScore;
    } else if (urgentBossTarget && !urgentBossTarget.phaseBoss) {
      prepareBossUrgentPlan(context, urgentBossTarget);
      if (context.bossUrgentHero === hero) {
        best = urgentBossTarget;
        bestScore = urgentBossScore;
      }
    } else {
      prepareCastleBossUrgentPlan(context);
      if (context.castleUrgentTarget && context.castleUrgentHero === hero
        && context.castleUrgentTarget !== game.twinFocus) {
        best = context.castleUrgentTarget;
        bestScore = heroTargetScore(hero, best, hero.pos, context);
      }
    }
  } else if (bossGoal(goal) && urgentBossTarget) {
    prepareBossUrgentPlan(context, urgentBossTarget);
    if (context.bossUrgentHero === hero) {
      best = urgentBossTarget;
      bestScore = urgentBossScore;
    }
  }
  // Na Ponte em Chamas, a âncora atende a ameaça mais perto de cruzar e os
  // demais defensores distribuem o foco por corredores ainda sem marcação.
  // Se só houver um alvo acessível, a equipe continua podendo concentrar dano.
  if (goal?.type === 'breach' && villager) {
    const anchor = defenseAnchor(context);
    let primary = null, primaryDistance = Infinity, primaryScore = Infinity;
    for (const target of candidates) {
      if (target.dead || target.spawning || !canHeroReachTarget(anchor, target, context)) continue;
      const distance = tacticalDistance(villager.pos, target.pos);
      if (distance > breachTargetRadius(target, villager)) continue;
      const score = heroTargetScore(anchor, target, anchor.pos, context);
      if (distance < primaryDistance || (distance === primaryDistance && score < primaryScore)) {
        primary = target; primaryDistance = distance; primaryScore = score;
      }
    }
    if (primary && hero === anchor) {
      best = primary;
      bestScore = heroTargetScore(hero, best, hero.pos, context);
    } else if (primary && hero !== anchor) {
      let secondary = null, secondaryDistance = Infinity, secondaryScore = Infinity;
      for (const target of candidates) {
        if (target === primary || target.dead || target.spawning || !canHeroReachTarget(hero, target, context)) continue;
        const distance = tacticalDistance(villager.pos, target.pos);
        if (distance > breachTargetRadius(target, villager)) continue;
        let claimed = false;
        for (const ally of party) {
          if (ally !== hero && !ally.dead && ally.targetFocus === target) { claimed = true; break; }
        }
        if (claimed) continue;
        const score = heroTargetScore(hero, target, hero.pos, context);
        if (distance < secondaryDistance || (distance === secondaryDistance && score < secondaryScore)) {
          secondary = target; secondaryDistance = distance; secondaryScore = score;
        }
      }
      if (secondary) {
        best = secondary;
        bestScore = heroTargetScore(hero, best, hero.pos, context);
      }
    }
  }
  if (!best) {
    hero.targetFocus = null;
    hero.targetFocusT = 0;
    hero.targetEligible = null;
    if (anyEnemy && game.state === 'fight' && hero.busy <= 0 && (hero.idleHuntT = (hero.idleHuntT || 0) + dt) >= FREE_HERO_HUNT_WAIT) {
      hero.idleHuntT = 0;
      hero.freeHuntT = FREE_HERO_HUNT_HOLD;
    }
    return null;
  }
  hero.idleHuntT = 0;
  if (hero.freeHuntT > 0 && !heroCanTarget(hero, best, context)) hero.freeHuntT = FREE_HERO_HUNT_HOLD;   // segue caçando enquanto só assim alcança o alvo

  // Mantém o foco por um instante, exceto quando surge uma ameaça claramente mais urgente.
  const urgentEscortTarget = villager
    && (best.pendingHit?.target === villager || tacticalDistance(villager.pos, best.pos) <= 4.5);
  let urgentNoFallTarget = goal?.type === 'nofall' && best.pendingHit?.target?.team === 'hero';
  if (goal?.type === 'nofall' && !urgentNoFallTarget) for (const ally of party) {
    if (!ally.dead && ally.hp / ally.maxHp <= 0.45 && tacticalDistance(ally.pos, best.pos) <= 4.5) { urgentNoFallTarget = true; break; }
  }
  const urgentAllyThreat = best.pendingHit?.target?.team === 'hero' || best.pendingHit?.target?.team === 'villager'
    || best.target === hero || best.engagedWith === hero;
  const urgentPriest = best.enemyKind === 'Priest' || !!best.kind?.priority;
  const urgentBomber = best.enemyKind === 'Bomber'
    && friends.some((friend) => !friend.dead && tacticalDistance(friend.pos, best.pos) < 7);
  const urgentObjectiveTarget = (bossGoal(goal) && best.boss)
    || (hasDestructionGoal(goal) && best.totem)
    || (goal?.type === 'hunt' && best === game.huntMark && best.hunted)
    || (goal?.type === 'defend' && isDefenseThreat(best, villager))
    || (goal?.type === 'breach' && (isBreachRunner(best, villager)
      || villager && tacticalDistance(villager.pos, best.pos) <= BREACH_INTERCEPT_RADIUS))
    || urgentEscortTarget || urgentNoFallTarget || urgentAllyThreat || urgentPriest || urgentBomber;
  let criticalAllyNearFocus = false;
  if (focused && goal?.type === 'nofall') for (const ally of party) {
    if (!ally.dead && ally.hp / ally.maxHp <= 0.45 && tacticalDistance(ally.pos, focused.pos) <= 6) { criticalAllyNearFocus = true; break; }
  }
  let finishingHit = false, allyEngagedOnFocus = false;
  if (focused && focused.maxHp > 0 && focused.hp / focused.maxHp < 0.45) for (const ally of party) {
    if (ally === hero || ally.dead) continue;
    if (ally.pendingHit?.target === focused) { finishingHit = true; break; }
    if (ally.targetFocus === focused && tacticalDistance(ally.pos, focused.pos) <= ally.range + 2) allyEngagedOnFocus = true;
  }
  const focusHealthRatio = focused?.maxHp > 0 ? focused.hp / focused.maxHp : 1;
  const supportedFocus = focused && (finishingHit && focusHealthRatio < 0.45
    || allyEngagedOnFocus && focusHealthRatio < 0.22)
    && !focused.boss && !focused.totem && !focused.ranged
    && focused.enemyKind !== 'Priest' && focused.enemyKind !== 'Bomber' && !focused.kind?.priority && !focused.pendingHit
    && !(villager && tacticalDistance(villager.pos, focused.pos) < 12) && !criticalAllyNearFocus
    && party.some((ally) => ally !== hero && !ally.dead
      && (ally.pendingHit?.target === focused || ally.targetFocus === focused));
  if (focused && hero.targetFocusT > 0 && best !== focused && !urgentObjectiveTarget && !supportedFocus
    && bestScore > focusedScore - 3.5) best = focused;
  if (hero.targetFocus !== best) {
    hero.targetFocus = best;
    hero.targetFocusT = 1.1;
  }
  hero.targetEligible = best;
  return best;
}

// projéteis e áreas usam geometrias compartilhadas, sem luzes extras.
const bolts = [], blasts = [], flames = [], sentries = [];
const boltGeo = new THREE.SphereGeometry(0.2, 10, 10);
const bladeGeo = new THREE.ConeGeometry(0.09, 0.65, 4);
const axeGeo = new THREE.BoxGeometry(0.45, 0.12, 0.3);
const handleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 5);
const flameGeo = new THREE.ConeGeometry(0.2, 0.65, 5);
const groundGeo = new THREE.CircleGeometry(1, 24);
const ringGeo = new THREE.RingGeometry(0.75, 1, 32);
const haloGeo = new THREE.TorusGeometry(0.35, 0.06, 6, 24);
const beamGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6);
const ringMaterials = materialPool(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false }), 128);
const beamMaterials = materialPool(() => new THREE.MeshBasicMaterial({ transparent: true }), 32);
const groundMarkMaterials = materialPool(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false }), 128);
const groundMarkMeshes = [], deferredGroundMarkMeshes = [], GROUND_MARK_MESH_POOL_LIMIT = 128;
function releaseGroundMark(mesh, defer = false) {
  if (!mesh?.groundMarkPool) return false;
  scene.remove(mesh);
  releaseFxMaterial(mesh.material);
  mesh.material = null;
  mesh.visible = false;
  if (groundMarkMeshes.length + deferredGroundMarkMeshes.length < GROUND_MARK_MESH_POOL_LIMIT) {
    (defer ? deferredGroundMarkMeshes : groundMarkMeshes).push(mesh);
  }
  return true;
}
function flushGroundMarkReturns() {
  while (deferredGroundMarkMeshes.length && groundMarkMeshes.length < GROUND_MARK_MESH_POOL_LIMIT)
    groundMarkMeshes.push(deferredGroundMarkMeshes.pop());
  deferredGroundMarkMeshes.length = 0;
}
function releaseFlameMesh(mesh) {
  if (mesh?.groundMarkPool) { releaseGroundMark(mesh, true); return; }
  scene.remove(mesh);
  releaseFxMaterial(mesh.material);
}
const beamDirection = new THREE.Vector3(), beamUp = new THREE.Vector3(0, 1, 0), beamLift = new THREE.Vector3(0, 1.3, 0);
const colors = { cook: 0xe0603a, pyro: 0xff883d, cryo: 0x8be8ff, arcane: 0xc999ff, oracle: 0xc6b4ff, viking: 0xd6e9ef, iceviking: 0x8be8ff, necro: 0x9fffb0, druid: 0xa8e07a, crossbow: 0xffed9e, ninja: 0xc7d0ff, archer: 0xe8f6ee, alchemist: 0xb8ff6a, vampire: 0xb0243c, flask: 0x9cff3a, tonic: 0xff8ad8 };
const boltMats = Object.fromEntries(Object.entries(colors).map(([k, color]) => [k, new THREE.MeshBasicMaterial({ color })]));
const goldMat = new THREE.MeshBasicMaterial({ color: 0xffdf70 });

const boltMeshPools = new Map(), BOLT_MESH_POOL_PER_LOOK = 8, BOLT_MESH_POOL_TOTAL = 96;
let pooledBoltMeshCount = 0;
function takeBoltMesh(from, kind, skill) {
  const key = `${from.cfg.id}/${kind}/${skill ? 1 : 0}`;
  let pool = boltMeshPools.get(key);
  if (!pool) boltMeshPools.set(key, pool = []);
  if (pool.length) {
    pooledBoltMeshCount--;
    const mesh = pool.pop();
    mesh.visible = true;
    return mesh;
  }
  const axe = kind === 'viking' || kind === 'iceviking';
  const arrow = kind === 'crossbow' || kind === 'ninja' || from.cfg.id === 'archer';
  const mesh = new THREE.Mesh(axe ? axeGeo : arrow ? bladeGeo : boltGeo, boltMats[kind] || boltMats[from.cfg.id] || boltMats.arcane);
  if (axe) {
    const handle = new THREE.Mesh(handleGeo, boltMats.viking);
    handle.position.y = -0.25;
    mesh.add(handle);
  }
  mesh.boltPoolKey = key;
  return mesh;
}

function releaseBoltMesh(mesh) {
  scene.remove(mesh);
  mesh.visible = false;
  const pool = boltMeshPools.get(mesh.boltPoolKey);
  if (pool && pool.length < BOLT_MESH_POOL_PER_LOOK && pooledBoltMeshCount < BOLT_MESH_POOL_TOTAL) {
    pool.push(mesh);
    pooledBoltMeshCount++;
  }
}

function ring(at, radius, color, life = 0.6) {
  const material = ringMaterials.take(color, 0.65);
  const mesh = ringMeshes.pop() || new THREE.Mesh(ringGeo, material);
  mesh.material = material;
  mesh.visible = true;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(at).setY(at.y + 0.07);
  mesh.scale.setScalar(radius);
  scene.add(mesh);
  blasts.push({ mesh, t: life, life, poolType: 'ring' });
}

function beam(start, end, color) {
  const material = beamMaterials.take(color);
  const mesh = beamMeshes.pop() || new THREE.Mesh(beamGeo, material);
  mesh.material = material;
  mesh.visible = true;
  beamDirection.subVectors(end, start);
  mesh.position.copy(start).add(end).multiplyScalar(0.5).add(beamLift);
  mesh.scale.y = beamDirection.length();
  mesh.quaternion.setFromUnitVectors(beamUp, beamDirection.normalize());
  scene.add(mesh);
  blasts.push({ mesh, t: 0.25, life: 0.25, poolType: 'beam' });
}

const ringMeshes = [], beamMeshes = [], RING_MESH_POOL_LIMIT = 128, BEAM_MESH_POOL_LIMIT = 32;
function releaseBlast(blast) {
  const { mesh } = blast;
  scene.remove(mesh);
  releaseFxMaterial(mesh.material);
  mesh.visible = false;
  const pool = blast.poolType === 'ring' ? ringMeshes : blast.poolType === 'beam' ? beamMeshes : null;
  const limit = blast.poolType === 'ring' ? RING_MESH_POOL_LIMIT : BEAM_MESH_POOL_LIMIT;
  if (pool && pool.length < limit) pool.push(mesh);
}

function fireBolt(from, target, kind = 'magic', angle = 0, skill = false) {
  const mesh = takeBoltMesh(from, kind, skill);
  mesh.position.copy(from.pos).setY(from.pos.y + 1.3);
  mesh.rotation.set(0, 0, 0);
  const dir = fireBoltDirectionScratch.subVectors(target.pos, from.pos).normalize().applyAxisAngle(fireBoltAxis, angle);
  mesh.quaternion.setFromUnitVectors(fireBoltAxis, dir);
  if (kind === 'ninja' && skill) mesh.quaternion.identity();
  scene.add(mesh);
  const piercing = kind === 'crossbow' || kind === 'ninja' || kind === 'archer';
  const bolt = { mesh, target, owner: from, kind, dir: piercing ? dir.clone() : null, hit: piercing ? new Set() : null, life: Math.max(1, from.range / 14 + 0.2), dmg: from.dmg, level: skillLevel(from.level), power: kind === 'magic' || !skill ? 1 : from.skillPower, skill };   // o tiro básico não escala
  if (mesh.boltVisual) {
    bolt.look = mesh.boltVisual.look;
    bolt.style = mesh.boltVisual.style;
    bolt.age = 0;
  } else {
    FX.look(bolt, skill);   // cada atirador com seu projétil (fogo, raio, gelo, orbe, espinho, virote)
    mesh.boltVisual = { look: bolt.look, style: bolt.style };
  }
  if (skill && (kind === 'pyro' || kind === 'flask' || kind === 'tonic')) {   // a bola grande e os frascos fazem um arco no ar até o alvo
    bolt.base = mesh.position.clone();
    bolt.dist0 = Math.max(0.1, bolt.base.distanceTo(target.pos));
    bolt.arc = 1.2 + bolt.dist0 * 0.18;
  }
  bolts.push(bolt);
}

const boltGoalScratch = new THREE.Vector3();
const fireBoltDirectionScratch = new THREE.Vector3(), fireBoltAxis = new THREE.Vector3(0, 1, 0);
const piercingStartScratch = new THREE.Vector3();
const piercingOffsetScratch = new THREE.Vector3();
const piercingHeightOffset = new THREE.Vector3(0, 1.3, 0);

function updateBolts(dt) {
  if (dt <= 0) return;
  flushGroundMarkReturns();   // a FX vinculado à marca antiga teve um quadro para encerrar antes de reutilizarmos sua base
  let targetSnapshot = null;
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.life -= dt;
    FX.trail(b, dt);   // rastro leve em todo projétil; habilidades deixam um rastro mais denso
    const piercing = b.kind === 'crossbow' || b.kind === 'ninja' || b.kind === 'archer';
    if (piercing) {
      const step = 18 * dt, start = piercingStartScratch.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.dir, step);
      if (targetSnapshot === null) targetSnapshot = frameTargetContext.skeletons.length ? frameTargetContext.skeletons : skeletonsAlive();
      for (const s of targetSnapshot) {
        if (s.dead || s.spawning || b.hit.has(s)) continue;
        const offset = piercingOffsetScratch.copy(s.pos).add(piercingHeightOffset).sub(start);
        const along = THREE.MathUtils.clamp(offset.dot(b.dir), 0, step);
        if (offset.addScaledVector(b.dir, -along).length() > 0.45 * s.size) continue;
        heroHit(b.owner, s, b.dmg * (b.kind === 'ninja' ? 0.8 : b.kind === 'archer' ? ARCHER_SHOT : 1) * b.power);
        if (b.skill || b.look) FX.impact(b.skill ? b.kind : 'basic', s.pos, 0.5, b.look);
        b.hit.add(s);
        if (b.kind === 'ninja') { b.life = 0; break; }
      }
    } else {
      const goal = boltGoalScratch.copy(b.target.pos);
      goal.y += 1.1;
      const at = b.base || b.mesh.position;   // com arco, anda pela linha reta e sobe por cima dela
      const d = goal.distanceTo(at);
      at.lerp(goal, Math.min(1, 14 * dt / Math.max(d, 0.001)));
      if (b.base) b.mesh.position.copy(at).setY(at.y + Math.sin(Math.PI * THREE.MathUtils.clamp(1 - d / b.dist0, 0, 1)) * b.arc);
      if (d <= 14 * dt + 0.25 && (b.kind === 'flask' || b.kind === 'tonic')) { if (b.kind === 'tonic') alchemyPool(b.owner, b.target.pos, true); else venomStick(b.owner, b.target); b.life = 0; }
      else if (d <= 14 * dt + 0.25) {
        const radius = b.kind === 'magic' ? b.owner.cfg.splash || 0
          : b.kind === 'pyro' ? (1.1 + (b.level - 1) * 0.2) * b.power
            : b.kind === 'cryo' || b.kind === 'iceviking' ? (1.3 + (b.level - 1) * 0.25) * b.power : 0;
        if (radius) damageArea(b.target.pos, radius, b.dmg, b.owner);
        else if (!b.target.dead) heroHit(b.owner, b.target, b.dmg * (b.kind === 'viking' ? 1.8 * b.power : 1));
        relicBounce(b);
        if (b.kind === 'pyro') {
          // chão chamuscado; as brasas e as chamas em shader vêm de FX.fireField e apagam com ele
          const mesh = groundMark(b.target.pos, radius, 0x3a1608, 0.45);
          flames.push({ mesh, radius, owner: b.owner, dmg: b.dmg * 0.3, t: (1.5 + b.level * 0.5) * b.power, tick: 0, follow: b.target });   // as chamas acompanham o alvo em movimento
          FX.fireField(mesh, radius);
        }
        if (b.kind === 'cryo' || b.kind === 'iceviking') {
          if (targetSnapshot === null) targetSnapshot = frameTargetContext.skeletons.length ? frameTargetContext.skeletons : skeletonsAlive();
          for (const s of targetSnapshot) if (!s.dead && s.pos.distanceTo(b.target.pos) <= radius) controlEnemy(s, 'slowT', scaleBranchEffect(b.owner, 'control', 3 + (b.level - 1) * 0.5) * b.power);
        }
        if (b.kind === 'oracle' && !b.target.dead && b.target.telegraph?.interruptible && b.target.telegraph.t > 0
          && controlEnemy(b.target, 'stunT', scaleBranchEffect(b.owner, 'control', 1.15 + (b.level - 1) * 0.15) * b.power)) {
          b.target.pendingHit = null;
          popText(b.target.pos, 'Previsto!', 'crit');
          FX.stasis(b.target);
        }
        ring(b.target.pos, Math.max(0.5, radius), colors[b.kind] || 0xc999ff);
        if (b.skill || b.look) FX.impact(b.skill ? b.kind : 'basic', b.target.pos, Math.max(0.6, radius), b.look);
        b.life = 0;
      }
    }
    if (b.kind === 'viking' || b.kind === 'iceviking') b.mesh.rotateZ(dt * 18);
    if (b.life <= 0) { releaseBoltMesh(b.mesh); bolts.splice(i, 1); }
  }
  if (geoWalls.length) updateGeoWalls(dt);
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i];
    if (f.wait > 0) { f.wait -= dt; continue; }   // aviso no chão antes do golpe (chuva de flechas, frasco no ar)
    f.t -= dt; f.tick -= dt;
    if (f.follow && !f.follow.dead) f.mesh.position.set(f.follow.pos.x, f.follow.pos.y + 0.06, f.follow.pos.z);
    f.mesh.material.opacity = Math.min(0.45, f.t * 0.45);   // o fogo de FX.fireField segue esta opacidade
    if (f.tick <= 0 && dt > 0) {
      if (f.every) poolTick(f);   // áreas novas: dano/cura por pulso já no valor do pulso
      else damageArea(f.mesh.position, f.radius, f.dmg * 0.5, f.owner);
      f.tick += f.every || 0.5;
    }
    if (f.t <= 0) { releaseFlameMesh(f.mesh); flames.splice(i, 1); }
  }
  for (let i = blasts.length - 1; i >= 0; i--) {
    const bl = blasts[i];
    bl.t -= dt;
    if (bl.ripple) bl.mesh.scale.addScalar(dt * 1.2);
    bl.mesh.material.opacity = Math.max(0, bl.t / bl.life) * 0.65;
    if (bl.t <= 0) { releaseBlast(bl); blasts.splice(i, 1); }
  }
  for (let i = skillTasks.length - 1; i >= 0; i--) {
    const task = skillTasks[i];
    if ((task.t -= dt) <= 0) { skillTasks.splice(i, 1); task.fn(); }
  }
  updateSentries(dt);
  updateSpiritTotems(dt);
  updateFollowSpirits(dt);
  updateRuneDomes(dt);
}

// ---------- Magos: marcas, ecos e nuvem móvel das técnicas novas ----------
const skillTasks = [];   // efeitos de habilidade agendados (Eco Arcano, Eco Temporal)
const after = (seconds, fn) => skillTasks.push({ t: seconds, fn });
const REAP_HEAL = 0.25, REAP_REBATE = 3, REAP_CAP = 0.35;   // Ceifa: fração da vida máxima do morto · segundos tirados do slot 1 · teto por aliado (fração da vida dele)
const NECRO_MINION_MAX = 4;   // esqueletos comuns do Necromante vivos ao mesmo tempo (a assinatura cria 2; o Pacto de Ossos completa)

// Ceifa: o inimigo marcado morreu; o grupo se cura e o Pacto de Ossos recarrega mais rápido
function reapPayoff(enemy) {
  const owner = enemy.reapBy;
  enemy.reapT = 0;
  enemy.reapBy = null;
  if (!owner || owner.dead || !units.includes(owner)) return;
  const pool = enemy.maxHp * REAP_HEAL;
  for (const h of partyNow()) if (!h.dead) {
    const heal = Math.min(h.maxHp - h.hp, scaleBranchEffect(owner, 'support', Math.min(pool, h.maxHp * REAP_CAP)));
    if (heal > 0) { h.hp += heal; owner.stats.cura += heal; popText(h.pos, '+' + Math.round(heal), 'heal'); }
    FX.reapSoul(enemy, h);
  }
  owner.skillTimers[1] = Math.max(0, owner.skillTimers[1] - REAP_REBATE);
  popText(enemy.pos, 'Ceifa!', 'crit');
}

// Eco Arcano: raio em cadeia que parte do inimigo mais distante, com parte do dano do feitiço repetido
function arcaneEchoChain(hero, first, mult, jumps = 2) {
  const hit = new Set();
  let at = hero.pos, next = first;
  for (let i = 0; i < jumps && next && !next.dead; i++) {
    FX.zigzag(at, next.pos, i * 0.055);
    hit.add(next);
    heroHit(hero, next, hero.dmg * hero.skillPower * mult);
    at = next.pos;
    next = highestPriorityHeroTarget(hero, skeletonsAlive().filter((s) => !s.spawning && !hit.has(s) && s.pos.distanceTo(at) < 4.5), at);
  }
}

// Tormenta Móvel: nuvem de neve que segue o inimigo; a cada pulso fere, deixa lento e, de tempos em tempos, prende por um instante
function stormCloud(owner, prey, radius, duration, pulse, color) {
  const mesh = groundMark(prey.pos, radius, 0x9fd8ee, 0.3);
  let n = 0;
  flames.push({ mesh, radius, owner, t: duration, tick: 0.15, every: 0.5, dmg: pulse, follow: prey,
    onTick: (f) => {
      const at = f.mesh.position, boost = ++n % 3 === 1;
      for (const s of skeletonsAlive()) {
        if (s.dead || s.spawning || s.pos.distanceTo(at) > radius + 0.4 * (s.size - 1)) continue;
        controlEnemy(s, 'slowT', 1.1);
        if (boost && !s.totem && controlEnemy(s, 'rootT', 0.7)) s.pendingHit = null;
      }
      if (f.follow.dead) {   // o alvo caiu: a nuvem passa para o inimigo mais próximo
        const heir = nearest(at, skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(at) <= radius + 3));
        if (heir) f.follow = heir;
      }
    } });
  FX.stormCloud(mesh, radius);
  return mesh;
}

function removeSentry(sentry) {
  scene.remove(sentry.root);
  sentry.root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
  const index = sentries.indexOf(sentry);
  if (index >= 0) sentries.splice(index, 1);
}

function deploySentry(owner, at, duration = 10, power = owner.skillPower || 1) {
  let sentry = sentries.find((item) => item.owner === owner);
  if (sentry) {
    sentry.root.position.copy(at);
    sentry.root.position.y = world.groundHeight(at.x, at.z) + 0.06;
    sentry.life = Math.max(sentry.life, duration);
    sentry.power = Math.max(sentry.power, power);
    ring(sentry.root.position, 1.3, 0x6df4df, 0.5);
    return sentry;
  }
  const root = new THREE.Group();
  root.position.copy(at);
  root.position.y = world.groundHeight(at.x, at.z) + 0.06;
  const metal = new THREE.MeshStandardMaterial({ color: 0x3d5662, metalness: 0.72, roughness: 0.34 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x65e6d2, emissive: 0x1c998a, metalness: 0.35, roughness: 0.25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.25, 8), metal);
  base.position.y = 0.2;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.72, 7), accent);
  mast.position.y = 0.66;
  const head = new THREE.Group();
  head.position.y = 1.08;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.54), metal);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), accent);
  eye.position.set(0, 0.02, 0.3);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 0.7, 6), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.08, 0.55);
  head.add(housing, eye, barrel);
  const footRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.045, 5, 20), accent);
  footRing.rotation.x = -Math.PI / 2;
  footRing.position.y = 0.08;
  root.add(base, mast, head, footRing);
  root.traverse((object) => { object.castShadow = false; object.receiveShadow = false; });
  scene.add(root);
  sentry = { owner, root, head, life: duration, power, fireT: 0.3, rate: 0.82, boostT: 0 };
  sentries.push(sentry);
  wave(root.position, 0x6df4df, 0.2, 1.35, 0.5);
  return sentry;
}

const sentryShotFrom = new THREE.Vector3(), sentryShotTo = new THREE.Vector3();
function updateSentries(dt) {
  for (let i = sentries.length - 1; i >= 0; i--) {
    const sentry = sentries[i], owner = sentry.owner;
    sentry.life -= dt;
    sentry.boostT = Math.max(0, sentry.boostT - dt);
    if (owner.dead || !units.includes(owner) || sentry.life <= 0) { removeSentry(sentry); continue; }
    sentry.head.rotation.y += dt * 0.8;
    sentry.fireT -= dt * synergySummonHaste(sentry.owner);
    if (sentry.fireT > 0 || game.state !== 'fight') continue;
    const context = activeTargetContext || frameTargetContext;
    const enemies = context.skeletons || skeletonsAlive();
    let target = null, bestScore = Infinity;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.spawning || enemy.pos.distanceTo(sentry.root.position) > 8 + 0.4 * (enemy.size - 1)) continue;
      const score = heroTargetScore(owner, enemy, sentry.root.position, context);
      if (score < bestScore) { target = enemy; bestScore = score; }
    }
    if (!target) continue;
    sentry.head.rotation.y = Math.atan2(target.pos.x - sentry.root.position.x, target.pos.z - sentry.root.position.z) - sentry.root.rotation.y;
    const boosted = sentry.boostT > 0;
    sentry.fireT = sentry.rate * (boosted ? 0.58 : 1);
    heroHit(owner, target, owner.dmg * 0.46 * sentry.power * (boosted ? 1.45 : 1));
    FX.zigzag(sentryShotFrom.copy(sentry.root.position).setY(sentry.root.position.y + 1.08), sentryShotTo.copy(target.pos).setY(target.pos.y + 0.95));   // zigzag e particle copiam os pontos
    if (typeof particle === 'function') particle(sparkGeo, boosted ? 0xe6fffb : 0x6df4df, sentryShotTo.copy(target.pos).setY(target.pos.y + 0.9), V(rnd(0.35), 0.5, rnd(0.35)), 0.25, { size: 1.2 });
  }
}

// ---------- Totens do Xamã: aliados fixos no chão (no máximo 2 por Xamã; o mais antigo some) ----------
const spiritTotems = [], SPIRIT_TOTEM_MAX = 2;
const followSpirits = [], SPIRIT_PULSE = 1;   // Espírito Acompanhante do Xamã
const ECLIPSE_BLAST = 4;   // Eclipse Rubro: raio da explosão que cura os aliados (o anel desenhado tem o mesmo tamanho)
const TOTEM_PLANT_RANGE = 8, HEAL_TOTEM_RADIUS = 4.5;   // alcance de plantio e raio do totem de cura (cobre a formação em movimento)
const TOTEM_LOOKS = {   // madeira, faixa, cor da marca no chão, intervalo do pulso (s)
  heal: { wood: 0x8a5a34, band: 0x3fe0b0, mark: 0x7ad8a0, every: 1 },
  root: { wood: 0x6a4a2a, band: 0xc8a050, mark: 0x8a6a34, every: 0.5 },
  ancestral: { wood: 0xb08a4a, band: 0xffd866, mark: 0xffd866, every: 1 },
};
let spiritParts = null;
function spiritTotemModel(kind) {
  const look = TOTEM_LOOKS[kind];
  spiritParts ||= { base: new THREE.CylinderGeometry(0.34, 0.44, 0.16, 7), low: new THREE.BoxGeometry(0.46, 0.5, 0.46), high: new THREE.BoxGeometry(0.4, 0.42, 0.4),
    band: new THREE.TorusGeometry(0.27, 0.04, 5, 12), eye: new THREE.BoxGeometry(0.08, 0.06, 0.04), beak: new THREE.ConeGeometry(0.07, 0.16, 4),
    crest: new THREE.ConeGeometry(0.1, 0.4, 4), stone: new THREE.MeshLambertMaterial({ color: 0x8a8678 }), dark: new THREE.MeshLambertMaterial({ color: 0x2a1a10 }) };
  const P = spiritParts, mats = look.mats ||= { wood: new THREE.MeshLambertMaterial({ color: look.wood }), band: new THREE.MeshLambertMaterial({ color: look.band }) };
  const g = new THREE.Group(), part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  part(P.base, P.stone, 0, 0.08, 0);
  part(P.low, mats.wood, 0, 0.41, 0);
  part(P.high, mats.wood, 0, 0.87, 0);
  const band = part(P.band, mats.band, 0, 0.66, 0);
  band.rotation.x = Math.PI / 2;
  for (const side of [-0.1, 0.1]) part(P.eye, P.dark, side, 0.92, 0.21);
  part(P.beak, P.dark, 0, 0.84, 0.24).rotation.x = Math.PI / 2;
  part(P.crest, mats.band, 0, 1.28, 0);
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return g;
}

function removeSpiritTotem(t) {
  scene.remove(t.root);
  releaseGroundMark(t.mark);
  const index = spiritTotems.indexOf(t);
  if (index >= 0) spiritTotems.splice(index, 1);
}

function plantSpiritTotem(owner, at, kind, duration, radius) {
  if (kind !== 'ancestral') {
    const own = spiritTotems.filter((t) => t.owner === owner && t.kind !== 'ancestral');
    if (own.length >= SPIRIT_TOTEM_MAX) removeSpiritTotem(own[0]);
  }
  const look = TOTEM_LOOKS[kind], root = spiritTotemModel(kind), pos = at.clone().setY(world.groundHeight(at.x, at.z));
  root.position.copy(pos);
  root.scale.setScalar(0.01);
  scene.add(root);
  const big = kind === 'ancestral' ? 1.5 : 1;
  const t = { owner, kind, root, mark: groundMark(pos, radius, look.mark, 0.22), radius, life: duration, age: 0, tickT: 0.3, every: look.every, pulses: 0, big };
  spiritTotems.push(t);
  wave(pos, look.band, 0.3, radius, 0.5, { opacity: 0.5 });
  burst(pos.clone().setY(pos.y + 0.4), [look.band, 0xffffff], fewer(10), 3);
  return t;
}

// um pulso: o totem de cura e o ancestral curam os heróis da área; o de raízes deixa os inimigos lentos
function spiritTotemPulse(t) {
  const at = t.root.position, owner = t.owner, look = TOTEM_LOOKS[t.kind];
  t.pulses++;
  if (t.kind === 'root') {
    const context = activeTargetContext || frameTargetContext;
    for (const s of context.skeletons?.length ? context.skeletons : skeletonsAlive()) if (!s.dead && !s.spawning && s.pos.distanceTo(at) <= t.radius + 0.4 * (s.size - 1))
      controlEnemy(s, 'slowT', 0.9 * owner.skillPower);
  } else {
    const amount = scaleBranchEffect(owner, 'support', (5 + owner.level * 2) * (t.kind === 'ancestral' ? 1.6 : 0.85)) * owner.skillPower;   // totem de cura 15% mais fraco por pulso: o raio maior cobre mais heróis
    for (const h of heroes()) if (!h.dead && h.pos.distanceTo(at) <= t.radius + 0.3) {
      const heal = Math.min(h.maxHp - h.hp, amount);
      if (heal < 1) continue;
      h.hp += heal;
      owner.stats.cura += heal;
      popText(h.pos, '+' + Math.round(heal), 'heal');
      burst(h.pos.clone().setY(h.pos.y + 0.6), 0xbfffa8, fewer(3), 2, { gravity: -1 });
    }
  }
  if (!lowQuality || t.pulses % 2) wave(at, look.band, 0.4, t.radius, t.kind === 'root' ? 0.5 : 0.7, { opacity: 0.3 });
}

function updateSpiritTotems(dt) {
  for (let i = spiritTotems.length - 1; i >= 0; i--) {
    const t = spiritTotems[i];
    t.life -= dt;
    t.age += dt;
    if (t.life <= 0) { removeSpiritTotem(t); continue; }
    const grow = 1 - (1 - Math.min(1, t.age / 0.3)) ** 3, fade = Math.min(1, t.life / 0.4);
    t.root.scale.setScalar(Math.max(0.01, t.big * Math.min(grow, fade)));
    t.tickT -= dt;
    if (t.tickT <= 0) { t.tickT += t.every; spiritTotemPulse(t); }
  }
}

// Espírito Acompanhante do Xamã: um espírito por Xamã segue o aliado e o cura um pouco a cada segundo
function callFollowSpirit(owner, ally, seconds) {
  for (const old of followSpirits) if (old.owner === owner) old.life = 0;   // o novo substitui o antigo
  const spirit = { owner, ally, life: seconds, tickT: SPIRIT_PULSE, pulses: 0 };
  followSpirits.push(spirit);
  FX.followSpirit(spirit);
  popText(ally.pos, 'Espírito!', 'evolve');
  return spirit;
}
function updateFollowSpirits(dt) {
  for (let i = followSpirits.length - 1; i >= 0; i--) {
    const sp = followSpirits[i];
    sp.life -= dt;
    if (sp.life <= 0 || sp.ally.dead || sp.owner.dead) { followSpirits.splice(i, 1); continue; }
    sp.tickT -= dt;
    if (sp.tickT > 0) continue;
    sp.tickT += SPIRIT_PULSE;
    sp.pulses++;
    const heal = Math.min(sp.ally.maxHp - sp.ally.hp, scaleBranchEffect(sp.owner, 'support', 3 + sp.owner.level * 1.5) * sp.owner.skillPower);
    if (heal < 1) continue;
    sp.ally.hp += heal;
    sp.owner.stats.cura += heal;
    popText(sp.ally.pos, '+' + Math.round(heal), 'heal');
    FX.spiritPulse(sp);
  }
}

// ---------- áreas no chão da Arqueira e da Alquimista (mesma lista das chamas do Piromante) ----------
const ARCHER_SHOT = 1.3;   // Flecha longa: dano de cada inimigo atravessado (× dano do herói)

function groundMark(at, radius, color, opacity = 0.45) {
  const material = groundMarkMaterials.take(color, opacity);
  const mesh = groundMarkMeshes.pop() || new THREE.Mesh(groundGeo, material);
  mesh.material = material;
  mesh.groundMarkPool = true;
  mesh.visible = true;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(at).setY(at.y + 0.06);
  mesh.scale.setScalar(radius);
  scene.add(mesh);
  return mesh;
}

// um pulso da área: fere os inimigos, cura os heróis e chama o efeito do pulso (flechas caindo, explosão)
function poolTick(f) {
  const at = f.mesh.position;
  if (f.dmg) damageArea(at, f.radius, f.dmg, f.owner);
  if (f.heal) for (const h of heroes()) if (!h.dead && h.pos.distanceTo(at) <= f.radius + 0.3) {
    const heal = Math.min(h.maxHp - h.hp, f.heal);
    if (heal < 1) continue;
    h.hp += heal;
    f.owner.stats.cura += heal;
    popText(h.pos, '+' + Math.round(heal), 'heal');
  }
  f.onTick?.(f);
}

// Alquimista: o frasco quebra e deixa uma poça; veneno fere quem pisa, tônico cura os heróis
function alchemyPool(owner, at, tonic, scale = 1) {
  const radius = (1.6 + (skillLevel(owner.level) - 1) * 0.2) * owner.skillPower * scale;
  const mesh = groundMark(at, radius, tonic ? 0x7a2a5a : 0x1f3a0e);
  flames.push({ mesh, radius, owner, t: (3.5 + skillLevel(owner.level) * 0.5) * owner.skillPower, tick: 0, every: 0.5,
    dmg: tonic ? 0 : owner.dmg * 0.14,
    heal: tonic ? scaleBranchEffect(owner, 'support', 5 + skillLevel(owner.level) * 2) * owner.skillPower : 0 });
  FX.pool(mesh, radius, tonic);
}

// Alquimista (Veneno Aderente): o frasco estoura no inimigo e o envenena no corpo; o mesmo total da antiga poça, concentrado no alvo
const VENOM_EVERY = 0.5;
function venomStick(owner, enemy) {
  if (!enemy || enemy.dead) return;
  enemy.poisonT = Math.max(enemy.poisonT || 0, (3.5 + skillLevel(owner.level) * 0.5) * owner.skillPower);
  enemy.poisonTick = Math.min(enemy.poisonTick || VENOM_EVERY, VENOM_EVERY);
  enemy.poisonDmg = Math.max(enemy.poisonDmg || 0, owner.dmg * 0.14);
  enemy.poisonOwner = owner;
  FX.venomHit(enemy);
}

// Cozinheira: a torta voa em arco e deixa um ensopado que cura e dá um bônus pequeno de dano a quem está nele
function cookPool(owner, at) {
  const radius = (2.4 + (owner.level - 1) * 0.2) * owner.skillPower;
  const mesh = groundMark(at, radius, 0xd98a3a, 0.3);
  flames.push({ mesh, radius, owner, wait: 0.45, t: (3.5 + owner.level * 0.5) * owner.skillPower, tick: 0, every: 0.5, dmg: 0,
    heal: scaleBranchEffect(owner, 'support', 3 + owner.level * 1.5) * owner.skillPower,
    onTick: (f) => { for (const h of heroes()) if (!h.dead && h.pos.distanceTo(f.mesh.position) <= f.radius + 0.3) {
      h.royalT = Math.max(h.royalT, 5);   // o bônus dura depois de sair da poça: o grupo está sempre se movendo
      h.royalBonus = Math.max(h.royalBonus, 0.12);
    } } });
  FX.foodToss(owner, at, 0.45);
  FX.stewPool(mesh, radius);
}

// Cozinheira (ultimate): a mesa do banquete cura o grupo em pulsos e acelera as recargas em 25% enquanto durar
function cookFeast(owner, at, radius, duration, haste) {
  const mesh = groundMark(at, radius, 0xd98a3a, 0.22);
  flames.push({ mesh, radius, owner, wait: 0.5, t: duration, tick: 0, every: 0.5, dmg: 0,
    heal: scaleBranchEffect(owner, 'support', 5 + owner.level * 2) * owner.skillPower,
    onTick: (f) => { for (const h of heroes()) if (!h.dead && h.pos.distanceTo(f.mesh.position) <= f.radius + 0.3)
      for (let s = 0; s < h.skillTimers.length; s++) if (h.skillTimers[s] > 0) h.skillTimers[s] = Math.max(0, h.skillTimers[s] - haste * f.every); } });
  FX.feastTable(mesh, radius, duration);
}

// Arqueira: marca a área no chão e, depois do aviso, cinco salvas de flechas caem sobre ela
function arrowRain(owner, at, radius, total) {
  const mesh = groundMark(at, radius, 0xe8f6ee, 0.25);
  flames.push({ mesh, radius, owner, wait: 0.55, t: 1.4, tick: 0, every: 0.3, dmg: total / 5, onTick: (f) => FX.arrowVolley(f.mesh.position, f.radius) });
  FX.rainMark(mesh, radius);
}

// Geomante: pedras low-poly que brotam da terra (geometria e material compartilhados, sem brilho; os efeitos somem sozinhos)
const rockMat = new THREE.MeshLambertMaterial({ color: 0x9a8e78, flatShading: true });
const rockDarkMat = new THREE.MeshLambertMaterial({ color: 0x4a3f33, flatShading: true });
rockMat.userData.keep = rockDarkMat.userData.keep = true;   // dropFx não descarta materiais compartilhados
const stoneSpikeGeo = new THREE.ConeGeometry(0.3, 1, 5), chunkGeo = new THREE.DodecahedronGeometry(0.55, 0);   // altura 1 e 1,1 centradas na origem: stoneRise ergue pela metade da altura
const geoWalls = [];   // pedras da muralha enquanto bloqueiam: { x, z, r, t, nx, nz }
const GEO_WALL_STONE = 0.75;

function stoneRise(at, geo, mat, w, h, life, { delay = 0, rise = 0.16, sink = 0.35 } = {}) {
  const m = new THREE.Mesh(geo, mat), y0 = world.groundHeight(at.x, at.z) - 0.02, half = geo === chunkGeo ? 0.55 : 0.5;
  m.position.set(at.x, y0, at.z);
  m.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
  m.scale.set(w, 0.01, w);
  return addFx(m, life, (e) => {
    const sy = h * Math.max(0.01, Math.min(1, e.t / rise, (life - e.t) / sink));
    m.scale.set(w, sy, w);
    m.position.y = y0 + half * sy;
  }, delay);
}

// Espinhos de pedra: fileira à frente do Geomante; ferem e atordoam de leve quem está no caminho (chefes só ficam lentos)
function geoSpikes(owner, aim, reach, dmg) {
  const from = owner.pos.clone(), dir = new THREE.Vector3().subVectors(aim, from).setY(0);
  if (dir.lengthSq() < 0.01) dir.copy(owner.fwd).setY(0);
  dir.normalize();
  const end = from.clone().addScaledVector(dir, reach);
  for (const s of lineTargets(from, end, skeletonsAlive().filter((u) => !u.spawning && Math.abs(u.pos.y - from.y) < 0.85), reach, 0.8)) {
    heroHit(owner, s, dmg);
    if (s.dead) continue;
    if (s.boss || s.totem) controlEnemy(s, 'slowT', 1.5);
    else if (controlEnemy(s, 'stunT', scaleBranchEffect(owner, 'control', 0.7) * owner.skillPower)) s.pendingHit = null;
  }
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 0, d = 1.1; d <= reach; i++, d += 0.9) {
    for (const o of lowQuality ? [0] : [-0.4, 0.4]) {
      const p = from.clone().addScaledVector(dir, d).addScaledVector(side, o + rnd(0.1));
      stoneRise(p, stoneSpikeGeo, rockMat, 0.9 + Math.random() * 0.4, 0.9 + Math.random() * 0.5, 1.1, { delay: i * 0.045 });
    }
    if (i % 2 === 0) puffs(from.clone().addScaledVector(dir, d), 1, 'dust', { size: 0.6, rise: 0.6, life: 0.7, delay: i * 0.045 });
  }
}

// Muralha de pedra: pedras que só seguram inimigos comuns (separate() as empurra); os heróis passam livres e ela some sozinha
function geoWall(owner, at, dir, halfLength, life) {
  const side = new THREE.Vector3(-dir.z, 0, dir.x), n = Math.max(2, Math.round(halfLength * 2 / 1.1) + 1);
  for (let i = 0; i < n; i++) {
    const p = at.clone().addScaledVector(side, (i - (n - 1) / 2) * 1.1);
    if (!world.isInsideGround(p.x, p.z, 0.5)) continue;
    geoWalls.push({ x: p.x, z: p.z, r: GEO_WALL_STONE, t: life - 0.4, nx: dir.x, nz: dir.z });
    stoneRise(p, chunkGeo, rockMat, 1.25 + Math.random() * 0.3, 1.5 + Math.random() * 0.6, life, { rise: 0.22, sink: 0.5 });
    if (i % 2 === 0) puffs(p, 2, 'dust', { size: 0.7, rise: 0.7, life: 0.8 });
  }
  shake(0.25);
}
function updateGeoWalls(dt) {
  for (let i = geoWalls.length - 1; i >= 0; i--) if ((geoWalls[i].t -= dt) <= 0) geoWalls.splice(i, 1);
}
function pushFromGeoWalls(u) {
  if (u.team !== 'skeleton' || u.boss || u.phasing || u.structure || u.totem) return false;
  let pushed = false;
  for (const w of geoWalls) {
    const min = w.r + 0.53 * u.size;
    let dx = u.pos.x - w.x, dz = u.pos.z - w.z;
    if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
    const distance = Math.hypot(dx, dz);
    if (distance >= min) continue;
    if (distance < 0.001) { dx = w.nx; dz = w.nz; } else { dx /= distance; dz /= distance; }
    collisionMove(u, dx * (min - distance), dz * (min - distance));
    pushed = true;
  }
  return pushed;
}

// Terremoto: rachaduras escuras no chão (duram a duração da lentidão), pedras que brotam e poeira; o raio dos efeitos é o raio real
function geoCracks(at, radius, life) {
  wave(at, 0x9a7a55, 0.3, radius, 0.7, { geo: ringGeo, opacity: 0.5, dust: true });
  for (let i = 0; i < (lowQuality ? 5 : 9); i++) {
    const m = new THREE.Mesh(crackGeo, rockDarkMat);
    m.position.set(at.x, world.groundHeight(at.x, at.z) + 0.07, at.z);
    m.rotation.y = (i / 9) * Math.PI * 2 + rnd(0.3);
    const len = radius * (0.65 + Math.random() * 0.35);
    addFx(m, life, (e) => m.scale.set(len * Math.min(1, e.t / 0.25), 1, 1.8 * Math.max(0.01, Math.min(1, (life - e.t) / 0.6))));
  }
  for (let i = 0; i < fewer(9); i++) {
    const a = Math.random() * Math.PI * 2, d = radius * Math.sqrt(Math.random()) * 0.9;
    stoneRise(V(at.x + Math.cos(a) * d, at.y, at.z + Math.sin(a) * d), chunkGeo, rockMat, 0.5 + Math.random() * 0.4, 0.5 + Math.random() * 0.6, 1.2, { delay: Math.random() * 0.3 });
  }
  puffs(at.clone().setY(at.y + 0.3), 8, 'dust', { spread: radius * 0.8, size: 1, rise: 0.8, life: 1 });
  shake(0.5);
}

// Alquimista: o frasco voa, explode empurrando o grupo e deixa uma poça de veneno menor
const flaskPush = new THREE.Vector3();
function volatileFlask(owner, at, radius, dmg) {
  const mesh = groundMark(at, radius, 0x9cff3a, 0.2);
  flames.push({ mesh, radius, owner, wait: 0.4, t: 0.05, tick: 0, every: 1, dmg, onTick: (f) => {
    const targets = activeTargetContext?.skeletons || (frameTargetContext.skeletons.length ? frameTargetContext.skeletons : skeletonsAlive());
    for (const s of targets) if (!s.spawning && s.pos.distanceTo(f.mesh.position) <= f.radius + 0.4 * (s.size - 1))
      s.vel.add(flaskPush.subVectors(s.pos, f.mesh.position).setY(0).normalize().multiplyScalar(s.boss ? 1.5 : 4.5));
    FX.flaskBlast(f.mesh.position, f.radius);
    alchemyPool(owner, f.mesh.position, false, 0.6);
  } });
  FX.flaskToss(owner, at, 0.4);
}

// Tiros inimigos independentes dos poderes dos heróis.
const enemyBolts = [];
const enemyOrbMat = new THREE.MeshBasicMaterial({ color: 0xc591ee });
const enemyBoltMeshPool = { orb: [], arrow: [] }, ENEMY_BOLT_POOL_LIMIT = 32;
function fireEnemyBolt(from, target) {
  const poolType = from.enemyKind === 'Crossbow' ? 'arrow' : 'orb', pool = enemyBoltMeshPool[poolType];
  const mesh = pool.pop() || (poolType === 'arrow' ? assets.Skeleton_Arrow.scene.clone() : new THREE.Mesh(boltGeo, enemyOrbMat));
  if (poolType === 'orb') mesh.material = from.boltMat || enemyOrbMat;
  mesh.visible = true;
  mesh.position.copy(from.pos);
  mesh.position.y += 1.3;
  scene.add(mesh);
  enemyBolts.push({ mesh, target, from, dmg: from.dmg, life: 3, poolType });
}
const enemyBoltGoal = new THREE.Vector3(), enemyBoltDir = new THREE.Vector3(), enemyBoltUp = new THREE.Vector3(0, 1, 0);
function updateEnemyBolts(dt) {
  if (dt <= 0) return;
  for (let i = enemyBolts.length - 1; i >= 0; i--) {
    const b = enemyBolts[i], goal = enemyBoltGoal.copy(b.target.pos);
    goal.y += 1.1;
    b.life -= dt;
    const d = b.mesh.position.distanceTo(goal);
    if (!b.target.dead) {
      b.mesh.quaternion.setFromUnitVectors(enemyBoltUp, enemyBoltDir.subVectors(goal, b.mesh.position).normalize());
      b.mesh.position.lerp(goal, Math.min(1, 12 * dt / Math.max(d, 0.001)));
      if (d < 12 * dt + 0.2) {
        const hp = b.target.hp;
        b.target.takeDamage(b.dmg, b.from.pos, b.from); b.life = 0;
        if (b.from.enemyKind === 'Crossbow' && b.target.hp >= hp) FX.brokenArrow(b.mesh.position, b.target.pos);   // esquiva, escudo ou imune: a seta quebra e cai
      }
    }
    if (b.life <= 0 || b.target.dead) {
      scene.remove(b.mesh);
      b.mesh.visible = false;
      const pool = enemyBoltMeshPool[b.poolType];
      if (pool.length < ENEMY_BOLT_POOL_LIMIT) pool.push(b.mesh);
      enemyBolts.splice(i, 1);
    }
  }
  updateMonsterFx(dt);   // avisos no chão e golpes especiais dos monstros
}
const splashAt = new THREE.Vector3();
function waterSplash(at, spawn = false) {
  ring(splashAt.copy(at).setY(at.y + 0.1), spawn ? 1 : 0.45, 0xc5f2f4, spawn ? 0.7 : 0.4);   // ring copia a posição
  blasts[blasts.length - 1].ripple = true;
  if (!spawn) return;
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(puffGeo, poofStarMaterials.take(0xa3e4f3));   // mesmo MeshBasicMaterial transparente, do estoque; updateFx o devolve
    m.position.copy(at).setY(at.y + 0.15); m.scale.setScalar(0.3);
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random(), (Math.random() - 0.5) * 3), t: 0, life: 0.6, grow: 0.3 };
    scene.add(m); fx.push(m);
  }
}

// ---------- efeitos fofos: nuvenzinha com estrelas, números e corações ----------
const fx = [];
const puffGeo = new THREE.IcosahedronGeometry(0.35, 1);
const starGeo = new THREE.OctahedronGeometry(0.17, 0);
const poofPuffMaterials = materialPool(() => new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true }), 512);
const poofStarMaterials = materialPool(() => new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true }), 256);

function poof(at, size = 1) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = new THREE.Mesh(puffGeo, poofPuffMaterials.take(0xffffff));
    m.position.set(at.x + Math.cos(a) * 0.3, at.y + 0.4 + Math.random() * 0.5, at.z + Math.sin(a) * 0.3);
    m.userData = { v: new THREE.Vector3(Math.cos(a) * 1.8, 0.8 + Math.random(), Math.sin(a) * 1.8), t: 0, life: 0.6, grow: size };
    scene.add(m);
    fx.push(m);
  }
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(starGeo, poofStarMaterials.take(0xffe066));
    m.position.set(at.x, at.y + 1, at.z);
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3, 3.5 + Math.random() * 1.5, (Math.random() - 0.5) * 3), t: 0, life: 0.85, star: true };
    scene.add(m);
    fx.push(m);
  }
}

function releaseFxMaterial(material) {
  const pool = material?.userData?.pool;
  if (pool) pool.give(material);
  else material?.dispose();
}

function clearFx() {
  geoWalls.length = 0;   // as pedras da Muralha somem junto com os efeitos
  while (fx.length) {
    const m = fx.pop();
    scene.remove(m);
    releaseFxMaterial(m.material);
  }
}

function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const m = fx[i], u = m.userData;
    u.t += dt;
    const k = u.t / u.life;
    if (k >= 1) {
      scene.remove(m);
      releaseFxMaterial(m.material);
      // A ordem dos efeitos é irrelevante. Como percorremos de trás para frente,
      // o último item já foi atualizado neste quadro e pode ocupar este índice.
      const last = fx.length - 1;
      if (i !== last) fx[i] = fx[last];
      fx.pop();
      continue;
    }
    if (u.star) { u.v.y -= 9 * dt; m.rotation.y += dt * 12; }
    else { u.v.multiplyScalar(Math.max(0, 1 - dt * 4)); m.scale.setScalar((0.6 + k * 1.3) * u.grow); }
    m.position.addScaledVector(u.v, dt);
    m.material.opacity = 1 - k * k;
  }
}

// texto que salta acima de uma unidade (dano, cura)
const popTextPool = createPopTextPool(bars);
function popText(at, text, cls) {
  tmp.copy(at).setY(at.y + 2.5).project(camera);
  if (tmp.z > 1) return;
  const x = (tmp.x * 0.5 + 0.5) * innerWidth + (Math.random() * 24 - 12);
  const y = (-tmp.y * 0.5 + 0.5) * innerHeight;
  popTextPool.show(text, cls, x, y, performance.now(), typeof text === 'number' ? at : null);   // números somam por alvo
}

// ---------- visuais das habilidades: malhas brilhantes (aditivas), sem luzes extras ----------
const skillFx = [];
const TAU = Math.PI * 2;
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const columnGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0);
const domeGeo = new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2);
const thinRingGeo = new THREE.RingGeometry(0.9, 1, 40);
const hexGeo = new THREE.RingGeometry(0.86, 1, 6);
const sparkGeo = new THREE.OctahedronGeometry(0.09, 0);
const shardGeo = new THREE.ConeGeometry(0.08, 0.6, 4).rotateX(Math.PI / 2);   // ponta para +z
const crystalGeo = new THREE.ConeGeometry(0.2, 1, 5).translate(0, 0.5, 0);
const rockGeo = new THREE.DodecahedronGeometry(0.14, 0);
const crackGeo = new THREE.BoxGeometry(1, 0.03, 0.1).translate(0.5, 0, 0);
const slashGeo = new THREE.PlaneGeometry(2.4, 0.2);
const arcGeo = new THREE.TorusGeometry(1, 0.07, 4, 20, Math.PI * 0.7);
const cardGeo = new THREE.BoxGeometry(0.2, 0.3, 0.015);   // carta de baralho (Apostador)
const CARD_MATS = [0xf6efdc, 0xd8404a, 0x22232e].map((color) => { const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }); m.userData.keep = true; return m; });
const rootGeo = new THREE.ConeGeometry(0.1, 1.4, 5).translate(0, 0.7, 0);
const leafGeo = new THREE.CircleGeometry(0.13, 3);
const skullGeo = new THREE.IcosahedronGeometry(0.22, 0);
const shurikenGeo = new THREE.OctahedronGeometry(0.32, 0).scale(1, 0.14, 1);
const spikeGeo = new THREE.ConeGeometry(0.08, 0.26, 4).translate(0, 0.13, 0);
const crownGeo = new THREE.CylinderGeometry(0.36, 0.32, 0.2, 10, 1, true);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b2010 });
const barkMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
const leafMat = new THREE.MeshLambertMaterial({ color: 0x6cc24a, side: THREE.DoubleSide });
const branchGeos = [0.09, 0.07, 0.05].map((r) => new THREE.CylinderGeometry(r * 0.75, r, 1, 5).translate(0, 0.5, 0));   // galhos afinando
const shellGeo = new THREE.IcosahedronGeometry(0.2, 0);
const foodGeo = new THREE.SphereGeometry(0.1, 6, 5), foodBoxGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15), pieGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.1, 8);   // comidas pequenas da Cozinheira
const iceGeo = new THREE.OctahedronGeometry(0.15, 0).scale(0.7, 0.7, 2.4);   // cristal comprido apontando em +z
const thornGeo = new THREE.OctahedronGeometry(0.16, 0).scale(0.55, 0.18, 1.6);   // folha/espinho do druida
// Alquimista: frasco (bojo e gargalo numa geometria só) e ovelha da transmutação, compartilhados
const flaskGeo = mergeGeometries([new THREE.SphereGeometry(0.17, 8, 6), new THREE.CylinderGeometry(0.06, 0.07, 0.18, 6).translate(0, 0.2, 0)].map((g) => g.toNonIndexed()));
const flaskGlassMat = new THREE.MeshLambertMaterial({ color: 0xe8fff4, transparent: true, opacity: 0.55, emissive: 0x2a4a3a });
const woolGeo = mergeGeometries([[0, 0.55, 0, 0.42], [0.22, 0.62, 0.12, 0.3], [-0.22, 0.62, 0.1, 0.3], [0, 0.7, -0.25, 0.3], [0, 0.6, 0.28, 0.28]]
  .map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z).toNonIndexed()));
const sheepFaceGeo = mergeGeometries([new THREE.BoxGeometry(0.26, 0.28, 0.3).translate(0, 0.72, 0.5), new THREE.BoxGeometry(0.46, 0.07, 0.1).translate(0, 0.8, 0.46),
  ...[[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.18], [0.18, 0.18]].map(([x, z]) => new THREE.CylinderGeometry(0.05, 0.05, 0.3, 5).translate(x, 0.15, z))].map((g) => g.toNonIndexed()));
const woolMat = new THREE.MeshLambertMaterial({ color: 0xfaf6ee, flatShading: true });
const sheepFaceMat = new THREE.MeshLambertMaterial({ color: 0x3a3236, flatShading: true });
const basic = (color) => new THREE.MeshBasicMaterial({ color });
const hiddenCore = new THREE.MeshBasicMaterial({ visible: false });
// projétil de cada atirador: núcleo, cascas brilhantes, tamanho (comum, habilidade) e jeito de voar
const BOLT_LOOKS = {
  // orb = bola de energia em shader (paleta, tamanho); ice = cristal facetado em shader; o corpo do tiro fica invisível
  pyro: { geo: boltGeo, core: hiddenCore, shells: [], orb: ['fire', 0.5], size: [2, 3.2], spin: true },
  arcane: { geo: boltGeo, core: hiddenCore, shells: [[glowMaterial(0xc999ff, 0.35), 2.1]], orb: ['arcane', 0.42], size: [1.6, 1.6], spin: true },
  cryo: { geo: iceGeo, core: hiddenCore, shells: [[glowMaterial(0x5fd0ff, 0.45), 1.35]], ice: true, size: [1.7, 2.6], aim: true },
  necro: { geo: boltGeo, core: hiddenCore, shells: [[glowMaterial(0x0f8a30, 0.4), 2.1]], orb: ['necro', 0.44], size: [1.7, 1.7], spin: true },
  druid: { geo: thornGeo, core: basic(0x9be05a), shells: [[glowMaterial(0x5fbf2a, 0.5), 1.3]], size: [1.9, 1.9], aim: true, roll: true },
  crossbow: { size: [1.4, 2] },
  bard: { geo: cardGeo, core: CARD_MATS[0], shells: [], size: [2, 2.6], spin: true },
  archer: { size: [1.3, 2.2] },
  alchemist: { geo: boltGeo, core: hiddenCore, shells: [], orb: ['venom', 0.4], size: [1.3, 1.3], spin: true },
  oracle: { geo: boltGeo, core: hiddenCore, shells: [[glowMaterial(0xc6b4ff, 0.52), 1.8]], orb: ['arcane', 0.34], size: [1.35, 2], spin: true },
  summoner: { geo: boltGeo, core: hiddenCore, shells: [[glowMaterial(0xff8ad8, 0.45), 1.8]], orb: ['tonic', 0.36], size: [1.4, 1.4], spin: true },
  vampire: { geo: boltGeo, core: basic(0xa81c34), shells: [[glowMaterial(0x5a0f20, 0.3), 1.4]], size: [1.1, 1.1], spin: true },
  cook: { geo: foodGeo, core: basic(0xe0603a), shells: [], size: [1.2, 1.5], spin: true },   // comida de verdade voando, sem brilho
  shaman: { geo: boltGeo, core: hiddenCore, shells: [], orb: ['venom', 0.34], size: [1.3, 1.3], spin: true },
};
for (const L of Object.values(BOLT_LOOKS)) for (const m of [L.core, ...(L.shells || []).map((x) => x[0])]) if (m) m.userData.keep = true;
const steelMat = new THREE.MeshLambertMaterial({ color: 0x59627a, emissive: 0x1a2240 });
const starGlowMat = glowMaterial(0x6f8cff, 0.55);
for (const m of [eyeMat, barkMat, leafMat, steelMat, starGlowMat, flaskGlassMat, woolMat, sheepFaceMat]) m.userData.keep = true;   // compartilhados: não são descartados com o efeito
const TRAIL = { cook: [0xffd27a, 0xe0603a], arcane: [0xb07cff, 0xffffff], necro: [0x40ff70, 0x0f8a30], druid: [0x8fe05a, 0xc8f07a], pyro: [0xffa040, 0xffe070], cryo: [0xbff6ff, 0x7fdcff], crossbow: [0xfff0a0, 0xffd84a], ninja: [0xc7d0ff, 0xffffff], viking: [0xe8f4ff, 0xb8dfe5], iceviking: [0x9fefff, 0xffffff], archer: [0x3fe0b0, 0xffffff], alchemist: [0x9cff3a, 0xe8ffb0], flask: [0x9cff3a, 0xe8ffb0], tonic: [0xff8ad8, 0xfff0fb], shaman: [0x6fe0a0, 0xe8ffd0], bard: [0xff6a7a, 0xf6efdc] };
// Símbolo e paleta próprios aparecem enquanto cada habilidade é preparada.
const SKILL_ART = {
  paladin:   { color: 0xffe27a, accent: 0x8af5a8, glyph: crystalGeo, scale: 1.2 },
  guardian:  { color: 0x3f9bff, accent: 0xc8efff, glyph: domeGeo, scale: 0.48 },
  champion:  { color: 0xffe59b, accent: 0xffffff, glyph: arcGeo, scale: 0.65 },
  berserker: { color: 0xff3b3b, accent: 0xffa040, glyph: boltGeo, scale: 2.2 },
  crusher:   { color: 0xffb060, accent: 0xffe59b, glyph: crystalGeo, scale: 1.2 },
  viking:    { color: 0xd6e9ef, accent: 0xffd84a, glyph: crystalGeo, scale: 1.2 },
  pyro:      { color: 0xff6a1a, accent: 0xffe070, glyph: flameGeo, scale: 1.5 },
  arcane:    { color: 0x8a3cff, accent: 0xe0c8ff, glyph: boltGeo, scale: 2.2 },
  cryo:      { color: 0x5fd0ff, accent: 0xffffff, glyph: iceGeo, scale: 2 },
  assassin:  { color: 0x9974b5, accent: 0xe0c8ff, glyph: slashGeo, scale: 0.6 },
  crossbow:  { color: 0xc9eaa4, accent: 0xfff0a0, glyph: shardGeo, scale: 1.8 },
  ninja:     { color: 0x768ac6, accent: 0xffffff, glyph: shurikenGeo, scale: 1.45 },
  duelist:   { color: 0xc9d4e2, accent: 0xff5a7a, glyph: slashGeo, scale: 0.6 },
  king:      { color: 0xffc61a, accent: 0xffffff, glyph: crownGeo, scale: 1.5 },
  iceviking: { color: 0x58aaca, accent: 0xffffff, glyph: iceGeo, scale: 2 },
  necro:     { color: 0x22e050, accent: 0xd8ffe0, glyph: skullGeo, scale: 2.2 },
  druid:     { color: 0x5fbf2a, accent: 0xc8f07a, glyph: leafGeo, scale: 3.5 },
  cleric:    { color: 0xffe8a3, accent: 0xfffbeb, glyph: crystalGeo, scale: 1.3 },
  bard:      { color: 0xff6a7a, accent: 0xf6efdc, glyph: cardGeo, scale: 1.4 },
  angel:     { color: 0xffe27a, accent: 0xffc6ed, glyph: crystalGeo, scale: 1.55 },
  chronist:  { color: 0x8feaff, accent: 0xb6a4ff, glyph: boltGeo, scale: 1.8 },
  archer:    { color: 0x3fe0b0, accent: 0xe8f6ee, glyph: shardGeo, scale: 1.8 },
  monk:      { color: 0xffc85a, accent: 0xfff2c8, glyph: thinRingGeo, scale: 0.45 },
  alchemist: { color: 0x9cff3a, accent: 0xff8ad8, glyph: shellGeo, scale: 2.2 },
  engineer: { color: 0x6df4df, accent: 0xe6fffb, glyph: shellGeo, scale: 1.25 },
  beast_tamer: { color: 0xcbb36f, accent: 0xffe6a1, glyph: crystalGeo, scale: 1.15 },
  oracle: { color: 0xc6b4ff, accent: 0xffffff, glyph: crystalGeo, scale: 1.3 },
  brute: { color: 0xb8a88a, accent: 0xfff2d8, glyph: rockGeo, scale: 3.2 },
  lancer: { color: 0x7fa0ff, accent: 0xffe27a, glyph: shardGeo, scale: 1.8 },
  summoner: { color: 0xff8ad8, accent: 0xfff0fb, glyph: leafGeo, scale: 3 },
  vampire: { color: 0xa81c34, accent: 0xff9aaa, glyph: slashGeo, scale: 0.6 },
  cook: { color: 0xffb347, accent: 0xfff0d0, glyph: shellGeo, scale: 1.6 },
  shaman: { color: 0x6fe0a0, accent: 0xffe6a1, glyph: leafGeo, scale: 3 },
  geomancer: { color: 0xb8a888, accent: 0xe8dcc0, glyph: rockGeo, scale: 2.4 },
  illusionist: { color: 0xa88af0, accent: 0xf0e0ff, glyph: thinRingGeo, scale: 0.45 },
};
const TARGETED_SKILLS = new Set(['assassin', 'duelist', 'monk', 'archer', 'alchemist', 'viking', 'iceviking', 'pyro', 'arcane', 'cryo', 'crossbow', 'ninja', 'angel', 'oracle', 'bard']);
let shakeK = 0, stopT = 0, slowT = 0;
const jolt = new THREE.Vector3();
const calmMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');   // sistema pede menos movimento: sem tremida nem hit-stop

function glowMaterial(color, opacity = 0.85, additive = true) {   // material próprio: compartilhado (keep) ou com outras propriedades mudadas
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
}
// brilho de efeito: material exclusivo enquanto vive (pode animar a opacidade), devolvido ao estoque por dropFx
function glow(color, opacity = 0.85, additive = true) {
  return (additive ? particleMats.add : particleMats.soft).take(color, opacity);
}
// as partículas (faíscas, fumaça, pedrinhas) pegam o material destes estoques e o devolvem ao sumir
const particleMats = {
  add: materialPool(() => glowMaterial(0xffffff)),
  soft: materialPool(() => glowMaterial(0xffffff, 0.85, false)),
  solid: materialPool(() => new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true })),
};

// registra um efeito com vida própria; tick(e, dt, k) anima (k vai de 0 a 1)
function addFx(mesh, life, tick, delay = 0) {
  mesh.visible = !delay;
  scene.add(mesh);
  skillFx.push({ mesh, t: -delay, life, tick, base: mesh.material?.opacity ?? 1 });
  return mesh;
}

function dropFx(e) {
  scene.remove(e.mesh);
  e.mesh.traverse((o) => {
    const m = o.material;
    if (!m || m.userData.keep) return;
    if (m.userData.pool) m.userData.pool.give(m);   // material de partícula volta ao estoque
    else m.dispose();
  });
}

function updateSkillFx(dt) {
  tickVfx(dt);   // relógio único de todos os shaders de efeito
  const initialLength = skillFx.length;
  let removed = false;
  for (let i = initialLength - 1; i >= 0; i--) {
    const e = skillFx[i];
    const previous = e.t;
    e.t += dt;
    if (e.t < 0) continue;
    e.mesh.visible = true;
    const k = Math.min(1, e.t / e.life);
    // Um efeito que começou neste quadro recebe apenas o tempo em que esteve ativo.
    e.tick?.(e, Math.max(0, Math.min(e.t, e.life) - Math.max(0, previous)), k);
    if (k >= 1 || e.done) { skillFx[i] = null; dropFx(e); removed = true; }
  }
  if (removed) {
    // Compacta uma vez por quadro com expirações, em vez de deslocar a lista por efeito.
    // Entradas criadas pelos ticks ficam no fim e só começam a atualizar no quadro seguinte.
    let write = 0;
    for (let read = 0; read < initialLength; read++) {
      const e = skillFx[read];
      if (e) skillFx[write++] = e;
    }
    for (let read = initialLength; read < skillFx.length; read++) skillFx[write++] = skillFx[read];
    skillFx.length = write;
  }
}

function clearSkillFx() {
  skillTasks.length = 0;   // ecos agendados (Eco Arcano, Eco Temporal) não sobrevivem ao reinício
  while (skillFx.length) dropFx(skillFx.pop());
  for (const b of sparkBatches.values()) { b.list.length = 0; b.mesh.count = 0; }
  shakeK = 0;
  stopT = slowT = 0;
}

// Faíscas aditivas (o caso comum de particle) desenham em lote: uma InstancedMesh por geometria, uma chamada só.
// Na mistura aditiva, cor×opacidade soma o mesmo que cor com opacidade: a cor da instância já leva o desbotar.
const SPARK_CAP = 768;
const sparkBatches = new Map();
const sparkE = new THREE.Euler(), sparkQ = new THREE.Quaternion(), sparkS = new THREE.Vector3(), sparkM = new THREE.Matrix4(), sparkC = new THREE.Color();
function sparkBatch(geo) {
  let b = sparkBatches.get(geo);
  if (!b) {
    const mesh = new THREE.InstancedMesh(geo, glowMaterial(0xffffff, 1), SPARK_CAP);
    mesh.material.userData.keep = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SPARK_CAP * 3), 3);
    mesh.count = 0;
    mesh.frustumCulled = false;   // instâncias espalhadas: a esfera da geometria não as cobre
    mesh.renderOrder = 1;         // depois da água e das outras transparências comuns, antes dos efeitos em shader
    b = { mesh, list: [] };
    sparkBatches.set(geo, b);
  }
  if (!b.mesh.parent) scene.add(b.mesh);
  return b;
}
function updateSparks(dt) {
  for (const b of sparkBatches.values()) {
    const { list, mesh } = b;
    let keep = 0, draw = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const previous = s.t;
      s.t += dt;
      if (s.t >= s.life) continue;
      list[keep++] = s;
      if (s.t < 0) continue;   // atraso: ainda não apareceu
      const step = s.t - Math.max(0, previous), k = s.t / s.life, o = s.o;
      s.v.y -= (o.gravity ?? 0) * step;
      if (o.drag) s.v.multiplyScalar(Math.max(0, 1 - o.drag * step));
      s.p.addScaledVector(s.v, step);
      if (o.spin !== 0) { s.rx += step * 6; s.ry += step * 4; }
      sparkQ.setFromEuler(sparkE.set(s.rx, s.ry, 0));
      mesh.setMatrixAt(draw, sparkM.compose(s.p, sparkQ, sparkS.setScalar(s.s0 * (1 + (o.grow ?? 0) * k))));
      mesh.setColorAt(draw, sparkC.copy(s.color).multiplyScalar(s.base * (1 - k * k)));
      draw++;
    }
    list.length = keep;
    mesh.count = draw;
    mesh.visible = draw > 0;   // vazio não gasta chamada de desenho
    if (draw) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  }
}

// partícula que voa, cai (gravity) e some; smoke = fumaça opaca em vez de brilho
function particle(geo, color, at, vel, life, o = {}) {
  if (!o.solid && !o.smoke) {
    const b = sparkBatch(geo);
    if (b.list.length < SPARK_CAP) {
      b.list.push({ p: at.clone(), v: vel, rx: Math.random() * 6, ry: Math.random() * 6, s0: o.size ?? 1, life, t: -(o.delay || 0),
        base: o.opacity ?? 0.95, color: new THREE.Color(color), o });
      return;
    }
  }
  const m = new THREE.Mesh(geo, (o.solid ? particleMats.solid : o.smoke ? particleMats.soft : particleMats.add).take(color, o.solid ? 1 : o.opacity ?? 0.95));
  const s0 = o.size ?? 1;
  m.position.copy(at);
  m.scale.setScalar(s0);
  m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
  return addFx(m, life, (e, dt, k) => {
    vel.y -= (o.gravity ?? 0) * dt;
    if (o.drag) vel.multiplyScalar(Math.max(0, 1 - o.drag * dt));
    m.position.addScaledVector(vel, dt);
    if (o.spin !== 0) { m.rotation.x += dt * 6; m.rotation.y += dt * 4; }
    m.scale.setScalar(s0 * (1 + (o.grow ?? 0) * k));
    m.material.opacity = e.base * (1 - k * k);
  }, o.delay);
}

// ---------- efeitos em shader (vfx-shaders.js): chama, bola de fogo, fumaça, folha, runas, raios e gelo ----------
// material e geometria compartilhados; cada malha só guarda userData.fx (opacity, size, seed, progress)
const fewer = (n) => (lowQuality ? Math.ceil(n / 2) : n);   // Gráficos: baixa corta pela metade

// partícula em shader que voa e se dissolve (progress come a borda com ruído)
function sprite(kind, palette, at, vel, life, o = {}) {
  const m = vfxMesh(kind, palette, SPRITE, { size: o.size ?? 1, opacity: o.opacity ?? 1 });
  const p = m.userData.fx, s0 = p.size, o0 = p.opacity;
  m.position.copy(at);
  return addFx(m, life, (e, dt, k) => {
    vel.y -= (o.gravity ?? 0) * dt;
    if (o.drag) vel.multiplyScalar(Math.max(0, 1 - o.drag * dt));
    m.position.addScaledVector(vel, dt);
    p.size = s0 * Math.max(0.05, 1 + (o.grow ?? 0) * k);
    p.progress = (o.dissolve ?? 1) * k;
    p.opacity = o0 * (1 - k ** 3);
  }, o.delay);
}

// nuvens de fumaça cartum que sobem, crescem e se desfazem
function puffs(at, n, palette = 'smoke', o = {}) {
  n = lowQuality ? Math.floor(n / 2) : n;
  const spread = o.spread ?? 0.5, speed = o.speed ?? 0.8;
  for (let i = 0; i < n; i++)
    sprite('puff', palette, V(at.x + rnd(spread), at.y + rnd(0.2), at.z + rnd(spread)), V(rnd(speed), (o.rise ?? 1.2) * (0.6 + Math.random() * 0.6), rnd(speed)),
      (o.life ?? 1.1) * (0.8 + Math.random() * 0.4), { size: (o.size ?? 0.9) * (0.7 + Math.random() * 0.6), grow: o.grow ?? 1, drag: o.drag ?? 1.2, opacity: o.opacity ?? 0.95, delay: (o.delay ?? 0) * Math.random() });
}

// anel de chamas correndo pelo chão a partir do centro
function flameRing(at, radius, n = 12, life = 0.75, palette = 'fire', size = 1.1) {
  n = fewer(n);
  const m = vfxMesh('flame', palette, radialSpriteGeometry(n), { size });
  const p = m.userData.fx;
  m.position.copy(at).setY(at.y + 0.05);
  m.rotation.y = Math.random() * TAU;
  addFx(m, life, (e, dt, k) => {
    const r = radius * (1 - (1 - k) ** 2);
    m.scale.set(r, 1, r);   // o eixo Y preserva o tamanho do billboard enquanto o anel se expande
    p.size = size * (0.45 + 0.75 * Math.sin(Math.PI * Math.min(1, 0.2 + k * 1.2)));
    p.progress = k * k * 0.7;
    p.opacity = 1 - k ** 4;
  });
}

// bola de fogo que incha e se rasga (explosões)
function blast(at, size, life = 0.5, palette = 'fire', delay = 0) {
  const m = vfxMesh('orb', palette, SPRITE, { size });
  const p = m.userData.fx;
  m.position.copy(at);
  return addFx(m, life, (e, dt, k) => { p.size = size * (0.35 + 0.9 * (1 - (1 - k) ** 3)); p.progress = k * 1.15; }, delay);
}

// disco plano em shader no chão (runas, brasas); follow = acompanha a unidade
function shaderDisc(kind, palette, at, radius, life, o = {}) {
  const m = vfxMesh(kind, palette, groundGeo, { opacity: o.opacity ?? 1, seed: o.seed ?? Math.floor(Math.random() * 6) });
  const p = m.userData.fx;
  m.rotation.x = -Math.PI / 2;
  m.position.copy(at).setY(at.y + (o.y ?? 0.07));
  return addFx(m, life, (e, dt, k) => {
    if (o.follow) m.position.copy(o.follow.pos).setY(o.follow.pos.y + (o.y ?? 0.07));
    if (o.active && !o.active()) { e.done = true; return; }
    m.scale.setScalar(radius * (1 - (1 - Math.min(1, e.t / 0.25)) ** 3));
    p.progress = k > 0.7 ? (k - 0.7) / 0.3 : 0;
  }, o.delay);
}

// raios de luz subindo do chão (substitui a coluna lisa nos poderes de luz)
function rays(at, palette, radius, height, life, o = {}) {
  const m = vfxMesh('rays', palette, columnGeo, { opacity: o.opacity ?? 1 });
  const p = m.userData.fx, o0 = p.opacity;
  m.position.copy(at);
  return addFx(m, life, (e, dt, k) => {
    const pop = Math.min(1, e.t / 0.15);
    const r = radius * (0.4 + 0.6 * pop) * (1 + k * 0.25);
    m.scale.set(r, height * pop, r);
    p.opacity = o0 * (1 - k) ** 1.3;
    if (o.follow) m.position.copy(o.follow.pos);
  }, o.delay);
}

// Piromante: chão em chamas — brasas no chão e línguas de fogo (uma malha só) enquanto a área queimar.
// base = disco chamuscado de updateBolts; quando ele sai da cena, o fogo apaga junto.
function fireField(base, radius) {
  const n = lowQuality ? 6 : 11;
  const points = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU * 2.618, r = i === 0 ? 0 : 0.35 + 0.55 * Math.sqrt(i / n);   // espiral: cobre o disco sem fila
    return [Math.cos(a) * r, 0, Math.sin(a) * r, i === 0 ? 1.25 : 0.7 + (i % 3) * 0.18, i];
  });
  const g = new THREE.Group();
  const coals = vfxMesh('embers', 'fire', groundGeo, { seed: Math.random() * 9 });
  const tongues = vfxMesh('flame', 'fire', spriteGeometry(points, `fireField${n}`), { size: 1 });
  coals.rotation.x = -Math.PI / 2;
  g.add(coals, tongues);
  addFx(g, 99, (e) => {
    if (!base.parent) { e.done = true; return; }
    const fade = Math.min(1, base.material.opacity / 0.45), pop = 1 - (1 - Math.min(1, e.t / 0.25)) ** 3;
    g.position.copy(base.position).setY(base.position.y + 0.01);
    g.scale.setScalar(radius * (0.4 + 0.6 * pop));
    coals.userData.fx.opacity = fade;
    tongues.userData.fx.size = 0.85 / (radius * (0.4 + 0.6 * pop));   // chamas do mesmo tamanho em qualquer raio
    tongues.userData.fx.opacity = fade;
    tongues.userData.fx.progress = (1 - fade) * 0.9;
  });
}

// Piromante (Meteoro): rocha em chamas caindo do céu durante a preparação
function meteorFall(h, target, impactAt, life, active) {
  const rock = vfxMesh('orb', 'fire', SPRITE, { size: 2.2 });
  const anchor = impactAt || target?.pos?.clone() || h.pos.clone(), from = V(1.2, 16, -0.8);
  addFx(rock, life, (e, dt, k) => {
    if (!active()) { rock.position.copy(anchor).setY(anchor.y + 0.6); e.done = true; return; }
    if (target && units.includes(target)) anchor.copy(target.pos);
    const q = k * k;
    rock.position.copy(anchor).add(V(from.x * (1 - q), 0.6 + from.y * (1 - q), from.z * (1 - q)));
    e.tr = (e.tr ?? 0) - dt;
    if (e.tr <= 0) {   // cauda: bolas menores que ficam para trás e se desfazem
      e.tr = lowQuality ? 0.06 : 0.03;
      sprite('orb', 'fire', rock.position.clone().add(V(rnd(0.3), rnd(0.3), rnd(0.3))), V(rnd(0.5), 0.6, rnd(0.5)), 0.45, { size: 1.5, grow: -0.6 });
    }
  });
}

// Piromante (Meteoro): impacto com anel de fogo, explosão, pilar de chamas e fumaça
function meteorImpact(at, reach) {
  flameRing(at, reach, 16, 0.9, 'fire', 1.4);
  blast(at.clone().setY(at.y + 1.2), reach, 0.65);
  blast(at.clone().setY(at.y + 2.4), reach * 0.45, 0.5, 'fire', 0.08);
  const pillar = vfxMesh('flame', 'fire', SPRITE, { size: 5 });
  const p = pillar.userData.fx;
  pillar.position.copy(at);
  addFx(pillar, 0.9, (e, dt, k) => { p.size = 5.5 * Math.sin(Math.PI * Math.min(1, 0.25 + k)); p.progress = k * 0.9; });
  puffs(at.clone().setY(at.y + 0.6), 8, 'smoke', { spread: reach * 0.5, size: 1.6, rise: 1.6, life: 1.6, speed: 1.5 });
}

// estouro de faíscas em todas as direções
function burst(at, color, n = 12, speed = 4, o = {}) {
  for (let i = 0; i < n; i++) {
    const v = V(rnd(), Math.random() * (o.up ?? 1), rnd()).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
    particle(o.geo || sparkGeo, Array.isArray(color) ? color[i % color.length] : color, at, v, (o.life ?? 0.6) * (0.7 + Math.random() * 0.6),
      { gravity: o.gravity ?? 6, size: o.size ?? 1.2, drag: 1.5, delay: o.delay });
  }
}

// anel no chão que cresce de "from" até "to" e some
function wave(at, color, from, to, life = 0.6, o = {}) {
  const m = new THREE.Mesh(o.geo || thinRingGeo, glow(color, o.opacity ?? 0.6, !o.dust));   // anel fino e translúcido: o movimento (abrir e sumir) é que chama a atenção
  m.rotation.x = -Math.PI / 2;
  m.position.copy(at).setY(at.y + (o.y ?? 0.1));
  m.scale.setScalar(from);
  return addFx(m, life, (e, dt, k) => {
    m.scale.setScalar(from + (to - from) * (1 - (1 - k) ** 3));
    m.material.opacity = e.base * (1 - k);
    if (o.spin) m.rotation.z += o.spin * dt;
  }, o.delay);
}

// coluna de luz que sobe do chão (follow = acompanha a unidade)
function column(at, color, radius, height, life, o = {}) {
  const m = new THREE.Mesh(columnGeo, glow(color, o.opacity ?? 0.38));
  m.position.copy(at);
  return addFx(m, life, (e, dt, k) => {
    const pop = Math.min(1, e.t / 0.15);
    const r = radius * (0.4 + 0.6 * pop) * (1 + k * 0.3);
    m.scale.set(r, height * pop, r);
    m.rotation.y += dt * 3;
    m.material.opacity = e.base * (1 - k) ** 1.5;
    if (o.follow) m.position.copy(o.follow.pos);
  }, o.delay);
}

// conjuradores ganham um círculo de runas em shader sob o selo enquanto preparam a habilidade
const SIGIL_RUNES = { pyro: 'fire', arcane: 'arcane', chronist: 'chrono', necro: 'necro', druid: 'nature', paladin: 'holy', cleric: 'holy', angel: 'holy', cryo: 'frost', alchemist: 'venom' };

// Um selo flutuante mostra qual energia está sendo reunida para cada herói.
function skillSigil(h, life, art, active, ultimate = false) {
  const runes = SIGIL_RUNES[h.cfg.id];
  if (runes) shaderDisc('rune', runes, h.pos, ultimate ? 2.6 : 1.9, life, { follow: h, active, seed: Object.keys(SIGIL_RUNES).indexOf(h.cfg.id) });
  const seal = new THREE.Group();
  const ground = new THREE.Mesh(groundGeo, glow(art.color, 0.12, false));
  const outer = new THREE.Mesh(thinRingGeo, glow(art.color, 0.9));
  const inner = new THREE.Mesh(hexGeo, glow(art.accent, 0.8, false));
  const crest = new THREE.Mesh(art.glyph, glow(art.accent, 0.95));
  const ultRing = ultimate ? new THREE.Mesh(thinRingGeo, glow(0xffe27a, 0.9)) : null;
  ground.rotation.x = outer.rotation.x = inner.rotation.x = -Math.PI / 2;
  ground.position.y = 0.03;
  outer.position.y = 0.06;
  inner.position.y = 0.08;
  crest.position.y = 1.75;
  crest.rotation.x = h.cfg.id === 'cryo' || h.cfg.id === 'iceviking' ? 0.25 : 0;
  seal.add(ground, outer, inner, crest);
  if (ultRing) { ultRing.rotation.x = -Math.PI / 2; ultRing.position.y = 0.1; seal.add(ultRing); }
  const motes = [];
  for (let i = 0; i < 3; i++) {
    const mote = new THREE.Mesh(sparkGeo, glow(i === 1 ? art.accent : art.color));
    seal.add(mote);
    motes.push(mote);
  }
  addFx(seal, life, (e, dt, k) => {
    if (!active()) { e.done = true; return; }
    seal.position.copy(h.pos);
    const pulse = 0.9 + Math.sin(e.t * 12) * 0.1;
    ground.scale.setScalar((0.6 + k * 1.45) * pulse);
    ground.material.opacity = 0.12 * Math.sin(Math.PI * k);
    outer.scale.setScalar(0.7 + k * 1.15);
    outer.rotation.z += dt * 1.8;
    outer.material.opacity = 0.55 * Math.sin(Math.PI * k);
    inner.scale.setScalar(0.8 + Math.sin(k * Math.PI) * 0.32);
    inner.rotation.z -= dt * 2.6;
    inner.material.opacity = 0.8 * Math.sin(Math.PI * k);
    if (ultRing) {
      ultRing.scale.setScalar((0.75 + k * 1.9) * pulse);
      ultRing.rotation.z -= dt * 3.5;
      ultRing.material.opacity = 0.55 * Math.sin(Math.PI * k);
    }
    crest.position.set(Math.sin(h.root.rotation.y) * 0.35, 1.7 + Math.sin(e.t * 7) * 0.12, Math.cos(h.root.rotation.y) * 0.35);
    crest.rotation.y += dt * (h.cfg.id === 'ninja' ? 8 : 2.5);
    crest.rotation.z = Math.sin(e.t * 5) * 0.15;
    crest.scale.setScalar(art.scale * (0.55 + 0.65 * Math.sin(Math.PI * k)) * pulse);
    crest.material.opacity = 0.95 * Math.sin(Math.PI * k);
    for (let i = 0; i < motes.length; i++) {
      const a = e.t * (2.5 + i * 0.35) + (i / motes.length) * TAU;
      const r = 0.7 + Math.sin(k * Math.PI) * 0.35;
      motes[i].position.set(Math.cos(a) * r, 1.35 + Math.sin(a * 1.4) * 0.28, Math.sin(a) * r);
      motes[i].scale.setScalar(0.65 + Math.sin(e.t * 10 + i) * 0.25);
      motes[i].material.opacity = Math.sin(Math.PI * k);
    }
  });
}

// A mira se fecha sobre o alvo enquanto o conjurador prepara o golpe.
function targetLock(target, life, art, active) {
  const lock = new THREE.Group();
  const ring = new THREE.Mesh(thinRingGeo, glow(art.color, 0.9));
  ring.rotation.x = -Math.PI / 2;
  lock.add(ring);
  for (let i = 0; i < 4; i++) {
    const corner = new THREE.Mesh(shardGeo, glow(art.accent, 0.9));
    corner.rotation.y = i * Math.PI / 2;
    corner.position.set(Math.cos(i * Math.PI / 2) * 0.7, 0.08, Math.sin(i * Math.PI / 2) * 0.7);
    lock.add(corner);
  }
  addFx(lock, life, (e, dt, k) => {
    if (!active() || target.dead || !units.includes(target)) { e.done = true; return; }
    lock.position.copy(target.pos).setY(target.pos.y + 0.07);
    const pulse = 0.78 + Math.sin(e.t * 17) * 0.12;
    ring.scale.setScalar((0.55 + 0.4 * k) * pulse);
    lock.rotation.y += dt * 2.5;
    ring.material.opacity = 0.35 + 0.55 * Math.sin(Math.PI * k);
    lock.scale.setScalar(0.75 + Math.sin(k * Math.PI) * 0.25);
  });
}

// Um fio de energia anuncia disparos direcionados e deixa claro quem será atingido.
function castLink(h, target, life, art, active) {
  const link = new THREE.Group();
  const outer = new THREE.Mesh(beamGeo, glow(art.color, 0.78));
  const core = new THREE.Mesh(beamGeo, glow(art.accent, 0.95));
  link.add(outer, core);
  addFx(link, life, (e, dt, k) => {
    if (!active() || target.dead || !units.includes(target)) { e.done = true; return; }
    const start = h.pos.clone().setY(h.pos.y + 1.35)
      .addScaledVector(V(Math.sin(h.root.rotation.y), 0, Math.cos(h.root.rotation.y)), 0.42);
    const end = target.pos.clone().setY(target.pos.y + 1.05);
    const dir = end.sub(start), distance = dir.length();
    if (distance < 0.05) { e.done = true; return; }
    const reveal = 0.15 + 0.85 * k;
    dir.normalize();
    link.position.copy(start).addScaledVector(dir, distance * reveal * 0.5);
    link.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    outer.scale.set(2.2, distance * reveal, 2.2);
    core.scale.set(0.65, distance * reveal, 0.65);
    const pulse = 0.75 + Math.sin(e.t * 22) * 0.2;
    outer.material.opacity = 0.65 * pulse * (1 - k * 0.45);
    core.material.opacity = 0.85 * pulse * (1 - k * 0.45);
  });
}

// faíscas da cor do herói girando para a mão no começo da habilidade
function charge(h, duration) {
  const art = SKILL_ART[h.cfg.id] || { color: h.cfg.color[0], accent: 0xffffff, glyph: shellGeo, scale: 0.5 };
  const color = art.color;
  const life = Math.max(0.08, duration);
  const pending = h.pendingHit;
  const ultimate = !!pending.skill?.ultimate;
  const active = () => !h.dead && units.includes(h) && h.pendingHit === pending;
  skillSigil(h, life, art, active, ultimate);
  if (pending.target && TARGETED_SKILLS.has(h.cfg.id)) {
    targetLock(pending.target, life, art, active);
    castLink(h, pending.target, life, art, active);
  }
  if (ultimate && h.cfg.id === 'pyro' && pending.skill?.effect === 'meteor') meteorFall(h, pending.target, pending.meteorImpact, life, active);   // o meteoro acompanha o alvo até o disparo
  if (ultimate) {   // ultimate avisa: coluna da cor do herói que acende e aperta até o disparo
    const glowCol = new THREE.Mesh(columnGeo, glow(art.color, 0.25));
    addFx(glowCol, life, (e, dt, k) => {
      if (!active()) { e.done = true; return; }
      glowCol.position.copy(h.pos);
      const r = 1.15 - 0.6 * k + Math.sin(e.t * 26) * 0.05 * k;
      glowCol.scale.set(r, 2.4 + k * 1.6, r);
      glowCol.rotation.y += dt * 4;
      glowCol.material.opacity = 0.06 + 0.2 * k * k;
    });
  }
  // Trajetórias curvas, em vez de faíscas retas: convergem à frente do peito.
  const sparkCount = ultimate ? 16 : 10;
  for (let i = 0; i < sparkCount; i++) {
    const spark = new THREE.Mesh(sparkGeo, glow(i % 3 ? color : art.accent, 0.8));
    const angle = i / sparkCount * TAU;
    addFx(spark, life, (e, dt, k) => {
      if (!active()) { e.done = true; return; }
      const radius = (ultimate ? 2.15 : 1.7) * (1 - k) ** 1.4;
      const a = angle + k * Math.PI * 1.3;
      const forward = 0.45 * k;
      spark.position.set(h.pos.x + Math.cos(a) * radius + Math.sin(h.root.rotation.y) * forward,
        h.pos.y + 0.25 + k * 1.1 + Math.sin(k * Math.PI) * 0.4,
        h.pos.z + Math.sin(a) * radius + Math.cos(h.root.rotation.y) * forward);
      spark.scale.setScalar(0.5 + Math.sin(Math.PI * k) * 1.1);
      spark.material.opacity = 0.8 * Math.sin(Math.PI * k);
    });
  }
}

// Pulso breve na liberação, sem encobrir os combatentes: o brilho é pequeno e curto; o resto é movimento
// (selo que salta com ease-out, anel que abre e some, fagulhas que sobem).
const easeOutBack = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;   // passa um pouco do ponto e volta: "pop" de desenho
function release(h, ultimate = false, radius = 0) {
  const art = SKILL_ART[h.cfg.id] || { color: h.cfg.color[0], accent: 0xffffff, glyph: shellGeo, scale: 0.5 };
  const color = art.color, calm = calmMotion?.matches;
  const origin = h.pos.clone().setY(h.pos.y + 1.15);
  origin.addScaledVector(V(Math.sin(h.root.rotation.y), 0, Math.cos(h.root.rotation.y)), 0.45);
  const flash = new THREE.Mesh(shellGeo, glow(art.accent, 0.4));   // estalo pequeno na cor do herói (antes: branco a 0,85)
  flash.position.copy(origin);
  addFx(flash, 0.16, (e, dt, k) => {
    flash.scale.setScalar(0.6 + 1.5 * (1 - (1 - k) ** 3));
    flash.material.opacity = e.base * (1 - k) ** 2;
  });
  const crest = new THREE.Mesh(art.glyph, glow(art.accent, 0.8));
  crest.position.copy(origin);
  addFx(crest, 0.42, (e, dt, k) => {
    crest.scale.setScalar(art.scale * (0.25 + 1.0 * easeOutBack(Math.min(1, k * 1.6))));
    crest.position.y = origin.y + k * 0.35;
    crest.rotation.y += dt * (h.cfg.id === 'ninja' ? 13 : 4);
    crest.rotation.z += dt * (h.cfg.id === 'assassin' ? 7 : 1.5);
    crest.material.opacity = 0.8 * (1 - k) ** 1.5;
  });
  burst(origin, [art.color, art.accent], fewer(7), 4.5, { life: 0.4, size: 1.1 });
  wave(h.pos, color, 0.55, 1.6, 0.36, { opacity: 0.45 });
  if (ultimate) {
    // anéis do tamanho da área real (antes: 6,2 e 4,8 fixos); a esfera branca de raio 2 saiu
    const reach = radius ? Math.min(Math.max(radius, 2), 6) : 2;   // área em volta do herói; habilidade em alvo distante: pulso curto
    wave(h.pos, art.accent, 0.35, reach, 0.7, { geo: ringGeo, opacity: 0.45, spin: calm ? 0 : 3 });
    wave(h.pos, art.color, 0.3, reach * 0.7, 0.6, { delay: 0.1, opacity: 0.4, spin: calm ? 0 : -2 });
    burst(origin, [art.color, art.accent, 0xfff2b0], fewer(12), 6, { life: 0.6, size: 1.2 });
    for (let i = 0; i < fewer(12); i++) {   // fagulhas que sobem em volta do herói, no lugar do clarão
      const a = (i / 12) * TAU + rnd(0.2), r = 0.5 + Math.random() * 0.6;
      particle(sparkGeo, i % 2 ? art.accent : art.color, V(h.pos.x + Math.cos(a) * r, h.pos.y + 0.2, h.pos.z + Math.sin(a) * r),
        V(Math.cos(a) * 0.4, 2.2 + Math.random() * 1.4, Math.sin(a) * 0.4), 0.8, { size: 1, gravity: -0.8, drag: 0.8, opacity: 0.8, delay: Math.random() * 0.15 });
    }
    shake(0.3);
    hitStop(0.07);
  }
  for (let i = 0; i < 2; i++) {
    const arc = new THREE.Mesh(arcGeo, glow(color, 0.6));
    arc.rotation.set(-Math.PI / 2 + (i ? 0.5 : -0.5), h.root.rotation.y, i * Math.PI);
    addFx(arc, 0.32, (e, dt, k) => {
      arc.position.copy(origin);
      arc.scale.setScalar(0.45 + 1.1 * (1 - (1 - k) ** 2));
      arc.rotation.z += dt * (i ? -7 : 7);
      arc.material.opacity = e.base * (1 - k) ** 2;
    });
  }
}

// Paladino: coluna de luz dourada, faíscas subindo e cura verde em quem foi curado
function holyLight(h, friends, reach) {
  rays(h.pos, 'holy', 0.9, 6, 1.1, { opacity: 0.7 });   // raios de luz em shader (a coluna branca por cima saiu)
  wave(h.pos, 0xffe27a, 0.5, reach, 0.8, { opacity: 0.5 });
  wave(h.pos, 0x8af5a8, 0.3, reach * 0.8, 1, { geo: ringGeo, opacity: 0.35, delay: 0.15 });
  for (let i = 0; i < fewer(18); i++) {   // fagulhas que sobem devagar
    const a = Math.random() * TAU, r = Math.random() * 1.2;
    particle(sparkGeo, i % 3 ? 0xffe27a : 0xfff2c8, V(h.pos.x + Math.cos(a) * r, h.pos.y + 0.2, h.pos.z + Math.sin(a) * r), V(rnd(0.3), 2 + Math.random() * 2, rnd(0.3)), 1.2, { size: 1.1, opacity: 0.8, gravity: -0.4, delay: Math.random() * 0.5 });
  }
  for (const f of friends) if (f !== h) {
    rays(f.pos, 'nature', 0.5, 3, 0.8, { follow: f, opacity: 0.7 });   // cura: raios verdes
    burst(f.pos.clone().setY(f.pos.y + 1), [0x8af5a8, 0xd8ffe0], 6, 2.5, { gravity: -2 });
  }
}

// Campo de força: brilho só na borda (fresnel) e faixas de energia subindo; o centro fica limpo para ver o herói
function shieldMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 1 }, time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; uniform float time; varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float band = 1.0 - smoothstep(0.0, 0.06, abs(fract(vY * 2.5 - time * 0.5) - 0.5));
        float a = (rim * 0.9 + 0.05 + band * 0.22 * (1.0 - vY)) * opacity;
        gl_FragColor = vec4(color + rim * 0.55, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

// Guardião: cúpula de energia azul enquanto a proteção durar
function dome(h, radius) {
  const d = new THREE.Mesh(domeGeo, shieldMaterial(0x4aa8ff));
  const base = new THREE.Mesh(thinRingGeo, glow(0x8fd4ff, 0.7));   // borda da cúpula marcada no chão
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.04;
  d.add(base);
  addFx(d, h.guardT + 1, (e, dt) => {
    d.position.copy(h.pos);
    const pop = Math.min(1, e.t / 0.3);
    d.scale.setScalar(1.7 * (1 - (1 - pop) ** 3) + Math.sin(pop * Math.PI) * 0.35);
    const fade = Math.min(1, Math.max(0, h.guardT) / 0.4);
    d.material.uniforms.time.value = e.t;
    d.material.uniforms.opacity.value = (0.85 + 0.15 * Math.sin(e.t * 6)) * fade;
    base.material.opacity = (0.55 + 0.15 * Math.sin(e.t * 6)) * fade;
    if (h.dead || h.guardT <= 0 || !units.includes(h)) e.done = true;
  });
  wave(h.pos, 0x6fc3ff, 0.5, radius, 0.7, { opacity: 0.55 });
  burst(h.pos.clone().setY(h.pos.y + 1), [0x6fc3ff, 0xcdeaff], fewer(12), 5);
}

// Campeão: lâminas de luz girando em volta e rastro circular no chão
// efeitos temporizados das ultimates dos guerreiros: executa fn quando o tempo passa (limpo junto com os demais efeitos)
function later(seconds, fn) {
  addFx(new THREE.Object3D(), seconds, (e, dt, k) => { if (k >= 1 && !e.fired) { e.fired = true; fn(); } });
}
// Julgamento Dourado: anel de aviso dourado sob cada marcado, que fecha até a coluna cair
function judgmentMark(enemy, seconds) {
  const m = new THREE.Mesh(ringGeo, glow(0xffd84a, 0.5));
  m.rotation.x = -Math.PI / 2;
  addFx(m, seconds, (e, dt, k) => {
    m.position.copy(enemy.pos).setY(enemy.pos.y + 0.1);
    m.scale.setScalar((1.9 - 1.1 * k) * enemy.size);
    m.rotation.z += dt * 4;
    m.material.opacity = e.base * (0.5 + 0.5 * k);
  });
}
function judgmentStrike(at, size = 1) {
  column(at, 0xffe9a0, 0.9 * size, 9, 0.5, { opacity: 0.4 });
  column(at, 0xffffff, 0.35 * size, 9, 0.3, { opacity: 0.55 });
  wave(at, 0xffd84a, 0.2, 2 * size, 0.4, { opacity: 0.5 });
  burst(at.clone().setY(at.y + 0.6), [0xffd84a, 0xffffff], fewer(8), 5, { up: 0.4 });
}
// Fúria Titânica: pulso vermelho curto a cada giro do furacão
function furyPulse(h, radius) {
  wave(h.pos, 0xff3b3b, 0.3, radius, 0.35, { opacity: 0.35, geo: ringGeo, spin: 12 });
  burst(h.pos.clone().setY(h.pos.y + 1), [0xff5a3a, 0xffd0a0], fewer(6), 6, { up: 0.2 });
}
function whirl(h, radius) {
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(arcGeo, glow(i ? 0xffe59b : 0xfff6d8, 0.75));
    m.rotation.set(-Math.PI / 2, 0, (i * TAU) / 3);
    addFx(m, 0.75, (e, dt, k) => {
      m.position.copy(h.pos).setY(h.pos.y + 0.7 + i * 0.3);
      m.rotation.z += dt * (16 + i * 3);
      m.scale.setScalar(radius * (0.45 + 0.22 * i) * (0.5 + 0.5 * Math.min(1, e.t / 0.15)));
      m.material.opacity = e.base * (1 - k);
    });
  }
  wave(h.pos, 0xffe59b, 0.5, radius, 0.55, { geo: ringGeo, opacity: 0.45, spin: 9 });
  burst(h.pos.clone().setY(h.pos.y + 1), [0xffe59b, 0xfff6d8], fewer(16), 8, { up: 0.3 });
  shake(0.25);
}

// Berserker: aura vermelha pulsando e fumaça enquanto a fúria durar
function fury(h) {
  wave(h.pos, 0xff3b3b, 0.4, 3.2, 0.6);
  burst(h.pos.clone().setY(h.pos.y + 1), [0xff5a3a, 0xffd0a0], 18, 5);
  const aura = new THREE.Mesh(columnGeo, glow(0xff2a2a, 0.22));
  addFx(aura, 30, (e, dt) => {
    aura.position.copy(h.pos);
    const pulse = 1 + Math.sin(e.t * 10) * 0.12;
    aura.scale.set(0.75 * pulse, 2.4 + Math.sin(e.t * 10) * 0.2, 0.75 * pulse);
    aura.material.opacity = (0.16 + 0.07 * Math.sin(e.t * 10)) * Math.min(1, Math.max(0, h.furyT) / 0.4);
    e.smoke = (e.smoke ?? 0) - dt;
    if (e.smoke <= 0) {   // labaredas rubras nos pés (shader) e faíscas
      e.smoke = lowQuality ? 0.2 : 0.1;
      sprite('flame', 'rage', V(h.pos.x + rnd(0.45), h.pos.y, h.pos.z + rnd(0.45)), V(rnd(0.2), 0.8, rnd(0.2)), 0.55, { size: 0.9, grow: -0.3, dissolve: 0.8 });
      particle(sparkGeo, 0xff6a3a, V(h.pos.x + rnd(0.5), h.pos.y + 0.5, h.pos.z + rnd(0.5)), V(0, 2.5, 0), 0.6);
    }
    if (h.dead || h.furyT <= 0 || !units.includes(h)) e.done = true;
  });
}

// Esmagador: onda de choque, rachaduras com brilho de lava e pedrinhas voando
function quake(h, reach, tremor = 0.55) {
  const c = h.pos.clone().addScaledVector(V(Math.sin(h.root.rotation.y), 0, Math.cos(h.root.rotation.y)), 1.2);
  quakeAt(c, reach, tremor);
}
function quakeAt(at, reach, tremor = 0.55) {
  const c = at.clone();
  wave(c, 0xffb060, 0.3, reach, 0.5, { y: 0.12, opacity: 0.55 });
  wave(c, 0x9a7a55, 0.3, reach * 1.3, 0.8, { geo: ringGeo, opacity: 0.55, dust: true });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(crackGeo, glow(0x2a1c10, 0.9, false));
    const lava = new THREE.Mesh(crackGeo, glow(0xff8a30, 0.65));
    lava.scale.set(1, 1.3, 0.45);
    lava.position.y = 0.01;
    m.add(lava);
    m.position.copy(c).setY(c.y + 0.05);
    m.rotation.y = (i / 9) * TAU + rnd(0.3);
    const len = reach * (0.7 + Math.random() * 0.6);
    addFx(m, 1.8, (e, dt, k) => {
      m.scale.x = len * Math.min(1, e.t / 0.15);
      m.material.opacity = e.base * (k > 0.7 ? (1 - k) / 0.3 : 1);
      lava.material.opacity = 0.65 * (1 - k) ** 2;
    });
  }
  for (let i = 0; i < 14; i++)
    particle(rockGeo, i % 2 ? 0x8a6f55 : 0x6d5a48, V(c.x + rnd(1.5), c.y + 0.2, c.z + rnd(1.5)), V(rnd(3), 5 + Math.random() * 4, rnd(3)), 1, { solid: true, gravity: 18, size: 0.8 + Math.random() });
  const dust = fewer(10);
  for (let i = 0; i < dust; i++) {   // poeira cartum em shader que rola para fora e se desfaz
    const a = (i / dust) * TAU;
    sprite('puff', 'dust', V(c.x, c.y + 0.4, c.z), V(Math.cos(a) * 4, 0.6, Math.sin(a) * 4), 0.9, { size: 1.1, grow: 1.2, drag: 3, opacity: 0.95 });
  }
  shake(tremor);
}

// Brutamontes (Agarrão Sísmico): puxa a poeira e as pedras para o centro,
// depois solta uma onda curta que marca o levantamento dos inimigos.
function seismicPull(at, radius, color = 0xc9bba2) {
  const center = at.clone();
  wave(center, color, radius, 0.22, 0.38, { opacity: 0.62, dust: true, spin: 1.4 });
  wave(center, 0xfff0d0, 0.2, radius * 0.72, 0.42, { opacity: 0.48, delay: 0.18 });
  const count = fewer(8);
  for (let i = 0; i < count; i++) {
    const angle = i / count * TAU;
    const shard = new THREE.Mesh(rockGeo, glow(i % 2 ? color : 0xffe5bd, 0.82));
    addFx(shard, 0.42, (e, dt, k) => {
      const pull = 1 - (1 - k) ** 2;
      const a = angle + k * 1.8;
      const r = radius * (1 - pull);
      shard.position.set(center.x + Math.cos(a) * r, center.y + 0.18 + Math.sin(Math.PI * k) * 0.62, center.z + Math.sin(a) * r);
      shard.rotation.set(e.t * 8, e.t * 11 + angle, e.t * 6);
      shard.scale.setScalar(2.8 * (0.75 + Math.sin(Math.PI * k) * 0.45) * (1 - k * 0.45));
      shard.material.opacity = 0.82 * (1 - k);
    });
  }
  burst(center.clone().setY(center.y + 0.45), [color, 0xffe5bd, 0xffffff], fewer(12), 5, { up: 0.7, life: 0.55 });
}

// impacto dos tiros de habilidade (e de cada inimigo atravessado pelos perfurantes)
function impact(kind, at, radius, lookId) {
  at = at.clone();
  const p = at.clone().setY(at.y + 1);
  if (kind === 'basic') {   // tiro comum: estalo pequeno na cor do atirador
    const [a, c] = TRAIL[lookId] || [0xffffff, 0xffffff];
    if (lookId === 'pyro' || lookId === 'arcane' || lookId === 'necro') blast(p, lookId === 'pyro' ? 1.5 : 1.1, 0.32, lookId === 'pyro' ? 'fire' : lookId);   // estouro em shader
    else {
      const m = new THREE.Mesh(shellGeo, glow(a, 0.5));
      m.position.copy(p);
      addFx(m, 0.22, (e, dt, k) => { m.scale.setScalar(1 + 2.2 * (1 - (1 - k) ** 3)); m.material.opacity = e.base * (1 - k) ** 2; });
    }
    burst(p, lookId === 'pyro' ? [0xff7a2a, 0xffe070, 0xff3a1a] : [a, c], lookId === 'pyro' ? 6 : 10, 4, { gravity: 6, geo: lookId === 'druid' ? leafGeo : sparkGeo });
  } else if (kind === 'pyro') {   // bola de fogo: explosão que se rasga, anel de chamas no chão e fumaça
    flameRing(at, radius, 12, 0.7, 'fire', 1);
    blast(p, radius * 2.2, 0.5);
    blast(p.clone().setY(p.y + 0.5), radius * 1.3, 0.4);
    burst(p, [0xff7a2a, 0xffe070, 0xff3a1a], fewer(20), 8, { gravity: 8, size: 1.6, life: 0.9 });
    puffs(p, 6, 'smoke', { spread: 0.6, size: 1.1, rise: 1.5, life: 1.2 });
    wave(at, 0xff9a40, 0.4, radius, 0.45, { opacity: 0.55 });
    audio.play('fire');
    shake(0.45);
  } else if (kind === 'cryo' || kind === 'iceviking') {
    crystals(at, radius);
    burst(p, [0xbff6ff, 0x8be8ff], fewer(14), 5);
    wave(at, 0x8be8ff, 0.4, radius, 0.55, { opacity: 0.55 });
    puffs(at.clone().setY(at.y + 0.4), 4, 'frostMist', { spread: radius * 0.6, rise: 0.3, size: 1.2, opacity: 0.7, life: 1.3 });   // névoa fria
    audio.play('ice');
    if (kind === 'iceviking') shake(0.2);
  } else if (kind === 'viking') {
    burst(p, [0xd6e9ef, 0xffd84a], fewer(12), 6);
    wave(at, 0xd6e9ef, 0.3, 1.6, 0.4, { opacity: 0.55 });
    puffs(at.clone().setY(at.y + 0.3), 2, 'dust', { size: 0.7, rise: 0.6, life: 0.7 });
    audio.play('hit');
    shake(0.2);
  } else burst(p, TRAIL[kind] || 0xffffff, 8, 4);
}

// Criomante e Viking do Gelo: cristais de gelo brotando do chão
function crystals(at, radius) {
  const disc = new THREE.Mesh(groundGeo, glow(0x8be8ff, 0.22, false));
  disc.rotation.x = -Math.PI / 2;
  disc.position.copy(at).setY(at.y + 0.08);
  disc.scale.setScalar(radius);
  addFx(disc, 1.8, (e, dt, k) => (disc.material.opacity = e.base * (1 - k)));
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius * 0.85, tall = 0.5 + Math.random() * 0.8;
    const m = vfxMesh('ice', 'frost', crystalGeo, { seed: i });   // cristal facetado com borda clara (shader)
    m.position.set(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r);
    m.rotation.set(rnd(0.4), Math.random() * TAU, rnd(0.4));
    addFx(m, 1.8, (e, dt, k) => {
      const s = Math.min(1, e.t / 0.12) * (k > 0.75 ? (1 - k) / 0.25 : 1);
      m.scale.set(1.2, tall * s, 1.2);
      m.userData.fx.opacity = k > 0.75 ? (1 - k) / 0.25 : 1;
    }, Math.random() * 0.15);
  }
}

// Criomante: leque de estilhaços de gelo saindo da mão rumo ao alvo
function iceFan(h, target) {
  const base = Math.atan2(target.pos.x - h.pos.x, target.pos.z - h.pos.z);
  for (let i = -4; i <= 4; i++) {
    const a = base + i * 0.13, dir = V(Math.sin(a), 0, Math.cos(a));
    const m = vfxMesh('ice', 'frost', shardGeo, { seed: i });
    m.position.copy(h.pos).setY(h.pos.y + 1.2).addScaledVector(dir, 0.5);
    m.rotation.y = a;
    m.scale.setScalar(1.6);
    addFx(m, 0.45, (e, dt, k) => { m.position.addScaledVector(dir, dt * 13); m.userData.fx.opacity = 1 - k * k; });
  }
}

// Arcano: raio em zigue-zague com brilho roxo e núcleo branco
function zigzag(a, b, delay = 0) {
  const A = a.clone().setY(a.y + 1.3), B = b.clone().setY(b.y + 1.1), pts = [A];
  for (let i = 1; i < 6; i++) pts.push(A.clone().lerp(B, i / 6).add(V(rnd(0.45), rnd(0.45), rnd(0.45))));
  pts.push(B);
  for (let i = 0; i < pts.length - 1; i++) {
    const dir = pts[i + 1].clone().sub(pts[i]), len = dir.length();
    for (const [color, width] of [[0x8a3cff, 4.5], [0xe0c8ff, 1]]) {
      const m = new THREE.Mesh(beamGeo, glow(color, 0.95));
      m.position.copy(pts[i]).addScaledVector(dir, 0.5);
      m.scale.set(width, len, width);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      addFx(m, 0.35, (e, dt, k) => {
        const flicker = 0.7 + 0.3 * Math.sin(e.t * 85 + i * 1.7) ** 2;
        m.material.opacity = e.base * (1 - k) * flicker;
      }, delay);
    }
  }
  blast(B, 1.3, 0.32, 'arcane', delay);   // estalo de energia arcana em shader
  burst(B, [0xc999ff, 0xffffff], 10, 4, { delay });
}

// Necromante: círculo de invocação verde girando e caveiras subindo
function summon(h, minions) {
  const p = h.pos;
  const shade = new THREE.Mesh(groundGeo, glow(0x0f5a24, 0.45, false));   // sombra verde sob o círculo
  shade.rotation.x = -Math.PI / 2;
  shade.position.copy(p).setY(p.y + 0.05);
  addFx(shade, 1.9, (e, dt, k) => { shade.scale.setScalar(2.4 * Math.min(1, e.t / 0.2)); shade.material.opacity = e.base * (k > 0.7 ? (1 - k) / 0.3 : 1); });
  shaderDisc('rune', 'necro', p, 2.5, 1.9, { y: 0.08 });   // círculo de runas girando
  flameRing(p, 2.3, 10, 1.2, 'necro', 0.9);                // fogo-fátuo verde abrindo o círculo
  puffs(p.clone().setY(p.y + 0.3), 4, 'gloom', { spread: 1.4, rise: 0.8, size: 1, life: 1.3 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const skull = new THREE.Mesh(skullGeo, glow(0xc8ffd0, 0.95, false));
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(sparkGeo, eyeMat);
      eye.position.set(side * 0.08, 0.03, 0.18);
      skull.add(eye);
    }
    addFx(skull, 1.4, (e, dt, k) => {
      skull.position.set(p.x + Math.cos(a) * 1.5, p.y + 0.3 + k * 2.6, p.z + Math.sin(a) * 1.5);
      skull.rotation.y = -a + Math.PI / 2 + Math.sin(e.t * 8) * 0.3;
      skull.material.opacity = e.base * (1 - k);
      skull.children.forEach((c) => (c.visible = k < 0.8));
    }, i * 0.12);
  }
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * TAU, r = Math.random() * 2.2;
    particle(sparkGeo, i % 2 ? 0x6dff8a : 0xd8ffe0, V(p.x + Math.cos(a) * r, p.y + 0.1, p.z + Math.sin(a) * r), V(0, 2 + Math.random() * 2, 0), 1.1, { delay: Math.random() * 0.6 });
  }
  for (const u of minions) column(u.pos, 0x6dff8a, 0.5, 3, 0.8);
}

// Exército dos Mortos: terra rachando, esqueletos emergindo, anel de ossos que expande até o raio real e some
function legion(h, army, radius) {
  const p = h.pos;
  const dirt = 0x6b5a45, bone = 0xd9d2b8, green = 0x5cc46e;
  shaderDisc('rune', 'necro', p, radius, 1.6, { y: 0.08, opacity: 0.8 });
  wave(p, green, 0.5, radius, 0.5, { opacity: 0.7 });
  wave(p, bone, 0.3, radius * 0.8, 0.65, { opacity: 0.5, delay: 0.12 });
  puffs(p.clone().setY(p.y + 0.3), 4, 'gloom', { spread: radius * 0.4, rise: 0.5, size: 0.9, life: 1.1, opacity: 0.6 });
  burst(p.clone().setY(p.y + 0.4), [bone, green], fewer(10), 4, { up: 0.6, life: 0.5, size: 0.9 });
  for (const u of army) {
    const at = u.pos.clone(), delay = Math.max(0, (u.riseT || 0) - LEGION_RISE);
    ring(at, 0.55, dirt, 0.7);   // terra rachando sob cada um
    for (let i = 0; i < fewer(6); i++) {   // torrões saltando
      const a = (i / 6) * TAU;
      particle(puffGeo, dirt, V(at.x + Math.cos(a) * 0.3, at.y + 0.15, at.z + Math.sin(a) * 0.3),
        V(Math.cos(a) * 1.6, 2.2 + Math.random(), Math.sin(a) * 1.6), 0.6, { solid: true, size: 0.35, gravity: 9, delay: delay + 0.1 });
    }
    for (let i = 0; i < fewer(4); i++) {   // fagulhas verdes pequenas subindo
      particle(sparkGeo, green, V(at.x + rnd(0.3), at.y + 0.1, at.z + rnd(0.3)), V(rnd(0.2), 1.2 + Math.random(), rnd(0.2)), 0.9, { size: 0.7, delay: delay + 0.2 + Math.random() * 0.4, opacity: 0.8 });
    }
  }
}

// Legião de Luz: círculo sagrado no raio real e brilho dourado discreto sob cada mini-paladino que brota
function knights(h, army, radius) {
  const p = h.pos, gold = 0xffe27a;
  shaderDisc('rune', 'holy', p, radius, 1.4, { y: 0.08, opacity: 0.7 });
  wave(p, gold, 0.4, radius, 0.55, { opacity: 0.55 });
  for (const u of army) {
    column(u.pos, gold, 0.35, 2.2, 0.7, { opacity: 0.5 });
    burst(u.pos.clone().setY(u.pos.y + 0.3), [gold, 0xffffff], fewer(5), 2.5, { up: 0.5, life: 0.5, size: 0.8 });
  }
}

function beastCall(h, beast) {
  const at = beast.pos.clone();
  wave(at, 0xcbb36f, 0.25, 2.1, 0.6);
  column(at, 0xffe6a1, 0.3, 2.3, 0.75);
  for (let i = 0; i < fewer(14); i++) {
    const angle = Math.random() * TAU, radius = Math.random() * 1.7;
    particle(sparkGeo, i % 2 ? 0xcbb36f : 0xffe6a1,
      V(at.x + Math.cos(angle) * radius, at.y + 0.2, at.z + Math.sin(angle) * radius),
      V(rnd(0.6), 1.5 + Math.random() * 1.3, rnd(0.6)), 0.65, { size: 1.15, gravity: -0.5 });
  }
  // tufos de pelo (mesmas cores da fera) saltando do chão em volta de onde ela surge
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU;
    particle(puffGeo, i % 2 ? 0x8f7b66 : 0xeadcc4, V(at.x + Math.cos(angle) * 0.4, at.y + 0.3, at.z + Math.sin(angle) * 0.4),
      V(Math.cos(angle) * 2.2, 2.4, Math.sin(angle) * 2.2), 0.55, { solid: true, size: 0.7, gravity: 7 });
  }
  beast.howl?.();   // a fera chega uivando
  popText(at, h.cfg.id === 'beast_tamer' ? 'Matilha!' : 'Alfa!', 'evolve');
}

// Invocador: círculo de pacto, coluna de luz e brilhos na cor da criatura que chega
function pactCall(h, creature, color) {
  const at = creature.pos.clone();
  shaderDisc('rune', 'tonic', at, 1.5, 1.1, { y: 0.08 });
  wave(at, color, 0.2, 1.9, 0.55);
  column(at, color, 0.35, 2.6, 0.8);
  for (let i = 0; i < fewer(14); i++) {
    const angle = Math.random() * TAU, radius = Math.random() * 1.4;
    particle(sparkGeo, i % 2 ? color : 0xffffff, V(at.x + Math.cos(angle) * radius, at.y + 0.2, at.z + Math.sin(angle) * radius),
      V(rnd(0.5), 1.6 + Math.random() * 1.4, rnd(0.5)), 0.7, { size: 1.1, gravity: -0.4 });
  }
}
const petalGeo = new THREE.IcosahedronGeometry(0.11, 0).scale(1, 0.22, 0.7);   // pétala achatada que gira ao cair
const FAIRY_SPARKS = [0xffb8dc, 0xb8fff0, 0xfff6a0];
// fada: rastro de brilhos que caem devagar e piscam, com bolinhas de luz rosa (em fúria, faíscas rosa-choque)
function fairyTrail(at, fury) {
  if (lowQuality && Math.random() < 0.5) return;   // Gráficos: baixa corta metade
  particle(sparkGeo, fury ? 0xff5ab0 : FAIRY_SPARKS[Math.floor(Math.random() * 3)], V(at.x + rnd(0.2), at.y + rnd(0.15), at.z + rnd(0.2)),
    V(rnd(0.3), -0.3, rnd(0.3)), 0.9, { size: 0.7 + Math.random() * 0.5, grow: -0.6 });
  if (Math.random() < 0.4) sprite('orb', 'tonic', V(at.x + rnd(0.1), at.y + rnd(0.1), at.z + rnd(0.1)), V(rnd(0.15), -0.15, rnd(0.15)), 0.55, { size: 0.32, grow: -0.7 });
}
// fada: fio de brilho até o aliado, anel duplo, raios rosados e pétalas caindo sobre ele
function fairyPulse(fairy, target) {
  const at = target.pos, from = fairy.visual.getWorldPosition(V(0, 0, 0));
  for (let i = 0; i < 6; i++) {
    const p = from.clone().lerp(V(at.x, at.y + 1, at.z), i / 5);
    particle(sparkGeo, i % 2 ? 0xffb8dc : 0xffffff, p, V(rnd(0.2), 0.3, rnd(0.2)), 0.45, { size: 1, delay: i * 0.03 });
  }
  wave(at, 0xffb8dc, 0.2, 1.4, 0.55);
  wave(at, 0xb8fff0, 0.1, 0.9, 0.5, { delay: 0.1 });
  rays(at, 'tonic', 0.45, 1.8, 0.6, { opacity: 0.8 });
  for (let i = 0; i < fewer(8); i++)
    particle(petalGeo, i % 2 ? 0xff8ad8 : 0xffd0e8, V(at.x + rnd(0.6), at.y + 1.6 + Math.random() * 0.6, at.z + rnd(0.6)), V(rnd(0.4), -0.9, rnd(0.4)), 1.1,
      { solid: true, size: 0.8 + Math.random() * 0.5, delay: 0.1 + Math.random() * 0.2 });
  for (let i = 0; i < fewer(6); i++)
    particle(sparkGeo, i % 2 ? 0xffb8dc : 0xfff6c8, V(at.x + rnd(0.4), at.y + 0.4 + Math.random(), at.z + rnd(0.4)), V(rnd(0.3), 1.2, rnd(0.3)), 0.6, { size: 0.9 });
}
// golem: poeirinha a cada passo pesado
function golemStep(at) {
  puffs(at, 2, 'dust', { spread: 0.35, rise: 0.25, size: 0.5, life: 0.6, speed: 0.6 });
}
// golem: brota do chão em pedaços (pedras saltando, poeira e um tremorzinho)
function golemRise(at) {
  wave(at, 0x9a8a78, 0.3, 1.8, 0.7, { dust: true, opacity: 0.6 });
  for (let i = 0; i < fewer(12); i++)
    particle(rockGeo, i % 3 ? 0x8a8070 : 0x6aae7a, V(at.x + rnd(0.7), at.y + 0.1, at.z + rnd(0.7)), V(rnd(2), 4 + Math.random() * 3, rnd(2)), 0.9,
      { solid: true, gravity: 16, size: 1 + Math.random() * 1.2, delay: Math.random() * 0.3 });
  puffs(at.clone().setY(at.y + 0.2), 5, 'dust', { spread: 0.8, rise: 0.6, size: 1, life: 1 });
  shake(0.15);
}
// golem: pancada em área: o tremor do Esmagador centrado no golem (tremida mais leve), mais faíscas dos cristais
function golemSlam(golem, radius) {
  const yaw = golem.root.rotation.y;
  quake({ pos: golem.pos.clone().addScaledVector(V(Math.sin(yaw), 0, Math.cos(yaw)), -0.6), root: { rotation: { y: yaw } } }, radius * 0.75, 0.22);
  burst(golem.pos.clone().setY(golem.pos.y + 0.4), [0xff8ad8, 0x7ff0e0, 0xffffff], fewer(10), 4, { up: 1.5 });
}
// dragãozinho: baforada em cone saindo da boca: brasa na boca, chamas que crescem, faíscas e fumaça no fim
function dragonBreath(from, dir, reach) {
  blast(from.clone(), 0.45, 0.35, 'fire', 0.06);
  const gy = world.groundHeight(from.x, from.z), drop = Math.max(0.8, from.y - gy);   // a boca está alto: o cone desce até o chão
  const n = fewer(14);
  for (let i = 0; i < n; i++) {
    const side = rnd(0.45), c = Math.cos(side), s = Math.sin(side);
    const d = V(dir.x * c + dir.z * s, 0, dir.z * c - dir.x * s).multiplyScalar(reach * (1.8 + Math.random() * 0.8));
    sprite(i % 3 ? 'puff' : 'orb', 'fire', from.clone(), d.setY(-drop * 2.6 * (0.8 + Math.random() * 0.35)), 0.5 + Math.random() * 0.2,
      { size: 0.35 + Math.random() * 0.2, grow: 2.2, drag: 1.6, delay: 0.1 + i * 0.022 });
  }
  for (let i = 0; i < fewer(8); i++) {
    const side = rnd(0.5), c = Math.cos(side), s = Math.sin(side);
    particle(sparkGeo, i % 2 ? 0xe8b060 : 0xd8642e, from.clone(), V(dir.x * c + dir.z * s, 0, dir.z * c - dir.x * s).multiplyScalar(reach * 1.6).setY(-drop * 1.1), 0.55,
      { gravity: 3, size: 0.65, delay: 0.1 + i * 0.03 });
  }
  puffs(from.clone().addScaledVector(dir, reach * 0.8).setY(gy + 0.4), 3, 'smoke', { spread: 0.6, size: 0.7, life: 0.8, delay: 0.5 });
}
// criatura que some: o golem desmorona em pedaços que caem e afundam; fada e dragãozinho encolhem num brilho
function summonFade(creature) {
  const kind = creature.summonKind, at = creature.pos, pieces = [];
  creature.root.updateMatrixWorld(true);
  creature.visual.traverse((o) => { if (o.isMesh && o.visible && !o.userData.aura) pieces.push(o); });
  for (const m of pieces) {
    scene.attach(m);   // mantém a pose do mundo; geometria e material são do kit (keep), dropFx não os descarta
    const s0 = m.scale.clone(), vel = kind === 'golem' ? V(rnd(1.4), 1.5 + Math.random() * 1.5, rnd(1.4)) : V(rnd(0.5), 1.4, rnd(0.5));
    const spin = V(rnd(4), rnd(3), rnd(4)), floor = at.y + 0.1;
    addFx(m, kind === 'golem' ? 1.2 : 0.4, (e, dt, k) => {
      if (kind === 'golem') {
        vel.y -= 14 * dt;
        m.position.addScaledVector(vel, dt);
        if (m.position.y < floor) { m.position.y = floor; vel.multiplyScalar(0.3); vel.y = 0; }
        m.rotation.x += spin.x * dt * (1 - k); m.rotation.z += spin.z * dt * (1 - k);
        m.scale.copy(s0).multiplyScalar(k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45);
      } else {
        m.position.addScaledVector(vel, dt);
        m.scale.copy(s0).multiplyScalar(1 - k);
      }
    });
  }
  if (kind === 'golem') {
    for (let i = 0; i < fewer(10); i++)
      particle(rockGeo, i % 3 ? 0x8a8070 : 0x6aae7a, V(at.x + rnd(0.5), at.y + 0.6 + Math.random() * 1.2, at.z + rnd(0.5)), V(rnd(2.5), 2 + Math.random() * 2, rnd(2.5)), 0.9,
        { solid: true, gravity: 14, size: 1 + Math.random() });
    puffs(at.clone().setY(at.y + 0.3), 6, 'dust', { spread: 0.9, rise: 0.5, size: 1.1, life: 1.1 });
  } else burst(at.clone().setY(at.y + 1.3), kind === 'fairy' ? FAIRY_SPARKS : [0x46b8a8, 0xff9ccf, 0xffd27a], fewer(12), 3, { gravity: 1, size: 1 });
}

// Slime: pouso. Anel verde com o raio real do impacto e respingos de gosma (o mini estoura em rosa); sem brilho aditivo forte
const SLIME_GOO = [0x7be08c, 0xff9ccf, 0xb8f5a8];
function slimeLand(at, radius, mini) {
  wave(at, mini ? 0xff9ccf : 0x7be08c, 0.3, radius, 0.45, { opacity: 0.45 });
  burst(at.clone().setY(at.y + 0.2), SLIME_GOO, fewer(mini ? 8 : 10), 3.2, { gravity: 10, size: 1, life: 0.5 });
  puffs(at.clone().setY(at.y + 0.2), mini ? 2 : 3, 'dust', { spread: radius * 0.4, rise: 0.4, size: 0.6, life: 0.6 });
}

// Assassino: rastro de sombra entre a saída e a chegada
function shadowStep(from, to) {
  for (let i = 0; i <= 8; i++) {
    const p = from.clone().lerp(to, i / 8).setY(from.y + 0.6 + (to.y - from.y) * (i / 8));
    if (!lowQuality || i % 2 === 0) sprite('puff', 'shadow', p, V(0, 0.4, 0), 0.7, { size: 0.95, grow: 0.5, opacity: 0.9, delay: i * 0.02 });   // fumaça de sombra em shader
    particle(sparkGeo, 0xb48cff, p.clone().setY(p.y + 0.5), V(rnd(0.5), 1, rnd(0.5)), 0.5, { delay: i * 0.02 });
  }
  wave(from, 0x9974b5, 0.3, 1.4, 0.4);
}

// Assassino: corte em X brilhando sobre o alvo
function slashX(target, h) {
  const p = target.pos.clone().setY(target.pos.y + 1.1);
  [-1, 1].forEach((s, i) => {
    for (const [color, thick] of [[0xb48cff, 1], [0xffffff, 0.4]]) {
      const m = new THREE.Mesh(slashGeo, glowMaterial(color, 1));
      m.material.depthTest = false;   // o corte aparece por cima do próprio assassino
      m.renderOrder = 5;
      m.position.copy(p);
      m.rotation.set(0, h.root.rotation.y, s * 0.8);
      addFx(m, 0.45, (e, dt, k) => {
        m.scale.set(1.4 * Math.min(1, e.t / 0.08), thick * 1.6 * (1 - k), 1);
        m.material.opacity = e.base * (1 - k);
      }, i * 0.08);
    }
  });
  burst(p, [0xb48cff, 0xffffff], 14, 5);
  shake(0.15);
}

// Rastro do golpe das habilidades corpo a corpo (SKILL_ANIMS.arc): meia-lua horizontal, corte de cima, anel giratório ou estocada.
const swingGeo = new THREE.RingGeometry(0.85, 1.6, 28, 1, -1.2, 2.4);   // arco centrado em +x
const thrustGeo = new THREE.ConeGeometry(0.16, 2.4, 6).rotateX(Math.PI / 2).translate(0, 0, 1.5);
function swing(h, kind, color, ultimate = false) {
  const yaw = h.root.rotation.y, size = (ultimate ? 1.3 : 1) * h.size;
  const holder = new THREE.Group(), pivot = new THREE.Group();
  holder.position.copy(h.pos).setY(h.pos.y + (kind === 'ring' ? 0.75 : 1.05));
  holder.rotation.y = yaw;
  holder.add(pivot);
  for (const [c, scale, opacity] of [[color, 1, 0.75], [0xffffff, 0.94, 0.9]]) {
    const m = new THREE.Mesh(kind === 'thrust' ? thrustGeo : kind === 'ring' ? ringGeo : swingGeo, glow(c, opacity));
    if (kind === 'slash') m.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);   // deitado, centrado à frente
    else if (kind === 'chop') m.rotation.y = -Math.PI / 2;                 // em pé, no plano do golpe
    else if (kind === 'ring') m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(scale * (kind === 'ring' ? 1.7 : 1));
    if (kind === 'thrust') m.scale.set(scale * 0.8, scale * 0.8, scale);
    m.userData.op = opacity;
    pivot.add(m);
  }
  const life = kind === 'ring' ? 0.42 : 0.3;
  addFx(holder, life, (e, dt, k) => {
    const ease = 1 - (1 - k) ** 3;
    if (kind === 'slash') pivot.rotation.y = 1.1 - 2.2 * ease;          // varre da direita para a esquerda
    else if (kind === 'chop') pivot.rotation.x = -1.1 + 1.8 * ease;     // desce de cima para a frente
    else if (kind === 'ring') pivot.rotation.y -= dt * 14;
    holder.scale.setScalar(size * (kind === 'thrust' ? 0.6 + 0.6 * ease : 0.85 + 0.3 * ease));
    for (const m of pivot.children) m.material.opacity = m.userData.op * (1 - k) ** 1.5;
  });
}

// Duelista: corte de aço de uma lâmina (side -1 ou 1) ou das duas em X (side 0)
function bladeCut(target, h, side = 0) {
  const p = target.pos.clone().setY(target.pos.y + 1);
  (side ? [side] : [-1, 1]).forEach((s, i) => {
    for (const [color, thick] of [[0xc9d4e2, 1], [0xffffff, 0.35]]) {
      const m = new THREE.Mesh(slashGeo, glowMaterial(color, 1));
      m.material.depthTest = false;
      m.renderOrder = 5;
      m.position.copy(p);
      m.rotation.set(0, h.root.rotation.y, s * 0.7);
      addFx(m, 0.3, (e, dt, k) => {
        m.scale.set(1.1 * Math.min(1, e.t / 0.06), thick * 1.3 * (1 - k), 1);
        m.material.opacity = e.base * (1 - k);
      }, i * 0.06);
    }
  });
  burst(p, [0xe8eef6, 0xff5a7a], side ? 6 : 10, 4);
}

// Duelista: rastro prateado da investida em X
function steelDash(from, to) {
  for (let i = 0; i <= 8; i++) {
    const p = from.clone().lerp(to, i / 8).setY(from.y + 0.9 + (to.y - from.y) * (i / 8));
    particle(sparkGeo, i % 2 ? 0xffffff : 0xc9d4e2, p, V(rnd(0.6), 0.8, rnd(0.6)), 0.45, { size: 1.2, delay: i * 0.015 });
  }
  wave(from, 0xc9d4e2, 0.25, 1.3, 0.35);
  shake(0.12);
}

// Duelista: dois arcos de lâmina girando em volta dele enquanto a dança durar
function bladeDance(h, radius) {
  wave(h.pos, 0xc9d4e2, 0.3, radius, 0.5);
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(arcGeo, glow(i ? 0xff5a7a : 0xe8eef6, 0.85));
    addFx(m, 30, (e, dt) => {
      m.position.copy(h.pos).setY(h.pos.y + 0.8 + i * 0.25);
      m.rotation.set(-Math.PI / 2, 0, m.rotation.z + dt * (i ? -14 : 18));
      m.scale.setScalar(radius * (0.55 + 0.2 * i) * Math.min(1, e.t / 0.15));
      m.material.opacity = e.base * Math.min(1, Math.max(0, h.bladeDanceT) / 0.3);
      if (h.dead || h.bladeDanceT <= 0 || !units.includes(h)) e.done = true;
    });
  }
}

// Duelista: faíscas de aço a cada volta da dança
function bladeSpin(h, radius) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * TAU, r = radius * (0.5 + Math.random() * 0.5);
    particle(sparkGeo, i % 2 ? 0xffffff : 0xc9d4e2, V(h.pos.x + Math.cos(a) * r, h.pos.y + 0.9, h.pos.z + Math.sin(a) * r), V(-Math.sin(a) * 3, 0.6, Math.cos(a) * 3), 0.35, { size: 1.1 });
  }
}

// Arqueira (Chuva de flechas): círculo marcado no chão e runas de caça girando até a chuva acabar
function rainMark(base, radius) {
  shaderDisc('rune', 'hunt', base.position, radius, 2, { seed: 2, active: () => !!base.parent });
  wave(base.position, 0x3fe0b0, radius * 1.4, radius, 0.45, { geo: ringGeo, opacity: 0.7 });
}

// Arqueira: uma salva de flechas cai do céu na área; cada uma levanta poeira ao cravar
function arrowVolley(at, radius) {
  for (let i = 0; i < fewer(7); i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius;
    const land = V(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r), from = V(land.x - 1.2, land.y + 7, land.z - 0.6);
    const m = new THREE.Mesh(shardGeo, particleMats.add.take(i % 2 ? 0xffffff : 0x9ff5dc, 0.95));
    m.lookAt(V(1.2, -7, 0.6));
    m.scale.set(1.3, 1.3, 2.2);
    addFx(m, 0.32, (e, dt, k) => {
      m.position.lerpVectors(from, land, Math.min(1, k * 1.25));
      if (k >= 0.8 && !e.hit) { e.hit = true; puffs(land, 1, 'dust', { size: 0.5, rise: 0.5, life: 0.5, speed: 0.4 }); }
      m.material.opacity = k < 0.8 ? 0.95 : 0.95 * (1 - (k - 0.8) / 0.2);
    }, i * 0.035);
  }
}

// Arqueira (Flecha do caçador): rastro verde-água do disparo e raios de luz no alvo
function hunterShot(h, prey) {
  const from = h.pos.clone().setY(h.pos.y + 1.3), to = prey.pos.clone().setY(prey.pos.y + 1);
  for (let i = 0; i <= 10; i++) particle(sparkGeo, i % 2 ? 0xffffff : 0x3fe0b0, from.clone().lerp(to, i / 10), V(rnd(0.4), 0.5, rnd(0.4)), 0.4, { size: 1.3, delay: i * 0.012 });
  rays(prey.pos, 'hunt', 0.6, 5, 0.7);
  burst(to, [0x3fe0b0, 0xffffff], 14, 5);
  shake(0.2);
}

// Arqueira: mira de caça girando sobre o alvo marcado enquanto a marca durar
function huntMark(prey, key = 'markT', color = 0x3fe0b0) {   // key: campo de tempo da marca (Flecha do caçador, Ceifa, Visão do Alvo)
  const g = new THREE.Group(), mat = glow(color, 0.9);
  const rim = new THREE.Mesh(thinRingGeo, mat);
  rim.rotation.x = -Math.PI / 2;
  g.add(rim);
  for (let i = 0; i < 4; i++) {
    const tip = new THREE.Mesh(shardGeo, mat), a = i * Math.PI / 2;
    tip.position.set(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25);
    tip.lookAt(0, 0, 0);
    g.add(tip);
  }
  addFx(g, 99, (e, dt) => {
    if (prey.dead || !(prey[key] > 0) || !units.includes(prey)) e.done = true;
    g.position.copy(prey.pos).setY(prey.pos.y + 2.3 * prey.size + Math.sin(e.t * 4) * 0.08);
    g.rotation.y += dt * 1.6;
    g.scale.setScalar(0.42 * prey.size * Math.min(1, e.t / 0.2) * (1 + 0.08 * Math.sin(e.t * 9)));
  });
}

// ---------- Magos: visuais das técnicas novas (simples, sem brilho aditivo; o tamanho é o alcance real) ----------
// anel fino no chão acompanhando uma unidade enquanto active() valer (buffs de aliados)
function followRing(unit, active, color, size = 1.1, opacity = 0.45) {
  const m = new THREE.Mesh(thinRingGeo, glow(color, opacity, false));
  m.rotation.x = -Math.PI / 2;
  addFx(m, 99, (e) => {
    if (unit.dead || !active() || !units.includes(unit)) { e.done = true; return; }
    m.position.set(unit.pos.x, unit.pos.y + 0.1, unit.pos.z);
    m.scale.setScalar(size * Math.min(1, e.t / 0.2) * (1 + 0.05 * Math.sin(e.t * 5)));
  });
}

// Piromante (Combustão): estouro curto no inimigo que queimava
function combust(enemy, color = 0xff7738) {
  wave(enemy.pos, color, 0.2, Math.max(0.9, enemy.size), 0.4, { opacity: 0.4, dust: true });
  burst(enemy.pos.clone().setY(enemy.pos.y + 0.9 * enemy.size), [color, 0xffe070], fewer(8), 3.5);
}

// Arcano (Colapso Gravitacional): runas no raio inteiro e faíscas puxadas para o centro
function collapse(center, radius) {
  shaderDisc('rune', 'arcane', center, radius, 0.9, { seed: 2 });
  wave(center, 0xa46cff, radius, 0.4, 0.6, { opacity: 0.4, dust: true });
  const n = fewer(16);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, p = V(center.x + Math.cos(a) * radius, center.y + 0.8, center.z + Math.sin(a) * radius);
    particle(sparkGeo, i % 2 ? 0x8a3cff : 0xe0c8ff, p, V(-Math.cos(a) * radius * 2.2, 0.4, -Math.sin(a) * radius * 2.2), 0.45, { size: 1.2 });
  }
  blast(center.clone().setY(center.y + 0.8), 1.8, 0.45, 'arcane', 0.15);
}

// Arcano (Eco Arcano): esfera pequena girando em volta do mago até o eco disparar
function echoOrb(h, color = 0xb68aff) {
  const orb = vfxMesh('orb', 'arcane', SPRITE, { size: 0.7 });
  addFx(orb, 99, (e) => {
    if (h.dead || !(h.echoT > 0) || !units.includes(h)) { e.done = true; return; }
    const a = e.t * 2.6;
    orb.position.set(h.pos.x + Math.cos(a) * 0.95, h.pos.y + 1.5 + Math.sin(e.t * 3) * 0.12, h.pos.z + Math.sin(a) * 0.95);
  });
}

// Criomante (Geada Cortante): anel de gelo no aliado enquanto a proteção valer
function frostSkin(h) {
  followRing(h, () => h.frostT > 0 && h.frostHits > 0, 0x9deaff, 1.2);
  burst(h.pos.clone().setY(h.pos.y + 1), [0xe6fbff, 0x8be8ff], fewer(6), 2.5, { gravity: -1 });
}

// Criomante: o agressor congela em cristais
function frostFreeze(enemy) {
  crystals(enemy.pos, Math.max(0.9, enemy.size * 0.9));
  burst(enemy.pos.clone().setY(enemy.pos.y + 1), [0xe6fbff, 0x8be8ff], fewer(8), 3);
}

// Criomante (Tormenta Móvel): flocos caindo e névoa fria sobre a nuvem, que acompanha o disco no chão
function snowCloud(base, radius) {
  addFx(new THREE.Group(), 99, (e, dt) => {
    if (!base.parent) { e.done = true; return; }
    e.next = (e.next ?? 0) - dt;
    if (e.next > 0) return;
    e.next = lowQuality ? 0.35 : 0.16;
    const at = base.position, a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius * 0.9;
    particle(sparkGeo, e.alt ? 0xe6fbff : 0x8be8ff, V(at.x + Math.cos(a) * r, at.y + 3.2, at.z + Math.sin(a) * r), V(rnd(0.6), -2.2, rnd(0.6)), 1.4, { size: 1 });
    if (e.alt = !e.alt) puffs(V(at.x + Math.cos(a) * r, at.y + 0.3, at.z + Math.sin(a) * r), 1, 'frostMist', { spread: 0.2, size: 1.5, opacity: 0.5, rise: 0.3, life: 1.4 });
  });
}

// Necromante (Pacto de Ossos): anel verde no aliado e coluna fraca ao ativar
function pactAura(h) {
  followRing(h, () => h.pactT > 0, 0x73d97e, 1.3);
  column(h.pos, 0x73d97e, 0.45, 2, 0.6, { follow: h, opacity: 0.2 });
}

// Necromante (Ceifa): alma verde que sobe do morto até cada aliado
function reapSoul(enemy, hero) {
  const orb = vfxMesh('orb', 'necro', SPRITE, { size: 0.6 }), from = enemy.pos.clone().setY(enemy.pos.y + 1);
  addFx(orb, 0.7, (e, dt, k) => {
    orb.position.lerpVectors(from, V(hero.pos.x, hero.pos.y + 1.2, hero.pos.z), 1 - (1 - k) ** 2);
    orb.position.y += Math.sin(Math.PI * k) * 0.8;
  });
}

// Oráculo (Visão do Alvo): anel lilás no aliado com a mira aguçada
function visionRing(h) {
  followRing(h, () => h.critT > 0, 0xc6b4ff, 1.15);
  rays(h.pos, 'arcane', 0.35, 2.4, 0.55, { follow: h });
}

// Cronomante (Eco Temporal): relógio no agressor, ponteiro voltando, até o dano ser devolvido
function timeEcho(enemy, delay) {
  const g = new THREE.Group(), mat = glow(0x8feaff, 0.7, false), rim = new THREE.Mesh(thinRingGeo, mat), hand = new THREE.Mesh(crackGeo, glow(0xffffff, 0.8, false));
  rim.rotation.x = -Math.PI / 2;
  hand.scale.set(0.8, 1, 1.2);
  g.add(rim, hand);
  addFx(g, delay, (e, dt, k) => {
    g.position.set(enemy.pos.x, enemy.pos.y + 0.12, enemy.pos.z);
    g.scale.setScalar(Math.max(0.8, enemy.size) * Math.min(1, e.t / 0.15));
    hand.rotation.y -= dt * 9;
    mat.opacity = 0.7 * (1 - k * k);
  });
}

// Monge: soco com estalo de ar quente; o chute final levanta poeira
function palmHit(target, h, kick = false) {
  const p = target.pos.clone().setY(target.pos.y + 1);
  burst(p, [0xffd27a, 0xffffff], kick ? 12 : 5, kick ? 5 : 3);
  const m = new THREE.Mesh(thinRingGeo, glow(0xfff2c8, 0.9));
  m.position.copy(p);
  m.rotation.y = h.root.rotation.y;
  addFx(m, 0.22, (e, dt, k) => { m.scale.setScalar(0.3 + k * (kick ? 1.6 : 0.9)); m.material.opacity = e.base * (1 - k); });
  if (kick) { puffs(target.pos, 3, 'dust', { size: 0.7, rise: 0.6, life: 0.7 }); shake(0.15); }
}

// Monge (Palma do vento): arcos de vento que voam no cone e poeira arrastada
function windPalm(h, dir, reach) {
  const yaw = Math.atan2(dir.x, dir.z);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(arcGeo, glow(i % 2 ? 0xffffff : 0xfff2c8, 0.85));
    addFx(m, 0.45, (e, dt, k) => {
      m.position.copy(h.pos).addScaledVector(dir, 0.6 + reach * k).setY(h.pos.y + 0.6 + i * 0.35);
      m.rotation.set(-Math.PI / 2, 0, -yaw - Math.PI * 0.35);
      m.scale.setScalar(0.8 + k * reach * 0.45);
      m.material.opacity = e.base * (1 - k);
    }, i * 0.06);
  }
  for (let i = 0; i < fewer(8); i++) {
    const side = rnd(0.55), d = V(dir.x * Math.cos(side) + dir.z * Math.sin(side), 0, dir.z * Math.cos(side) - dir.x * Math.sin(side));
    sprite('puff', 'dust', h.pos.clone().addScaledVector(d, 0.8).setY(h.pos.y + 0.3), d.multiplyScalar(6 + Math.random() * 3), 0.6, { size: 0.8, grow: 1.2, drag: 2.5, opacity: 0.85 });
  }
  shake(0.18);
}

// Lanceiro: ponta de lança de luz que corre em linha reta até o fim do alcance real (reach) e some
function lanceThrust(h, dir, reach, color = 0xbcd0ff) {
  const m = new THREE.Mesh(thrustGeo, glow(color, 0.7));
  m.rotation.y = Math.atan2(dir.x, dir.z);
  addFx(m, 0.3, (e, dt, k) => {
    m.position.copy(h.pos).setY(h.pos.y + 0.95);
    m.scale.set(1 - k * 0.6, 1 - k * 0.6, reach / 2.7);
    m.material.opacity = e.base * (1 - k);
  });
  for (let i = 1; i <= fewer(4); i++) particle(sparkGeo, i % 2 ? 0xffffff : 0xffe27a, h.pos.clone().addScaledVector(dir, reach * i / 4).setY(h.pos.y + 0.95), V(rnd(0.5), 0.4, rnd(0.5)), 0.4, { size: 1.1, delay: i * 0.02 });
  shake(0.1);
}
// Lanceiro: anel no chão com o raio real da postura, acompanhando o herói enquanto durar
function lanceStance(h, reach) {
  wave(h.pos, 0xbcd0ff, reach * 0.5, reach, 0.5);
  const m = new THREE.Mesh(thinRingGeo, glow(0xbcd0ff, 0.3));
  m.rotation.x = -Math.PI / 2;
  addFx(m, h.spearT + 0.2, (e, dt, k) => {
    m.position.copy(h.pos).setY(h.pos.y + 0.08);
    m.scale.setScalar(reach);
    m.material.opacity = e.base * Math.min(1, h.spearT / 0.4);
    if (h.dead || h.spearT <= 0 || !units.includes(h)) e.done = true;
  });
}

// Monge (Meditação): círculo dourado sob o corpo, raios suaves e brilho que sobe enquanto medita
function meditate(h, radius) {
  const active = () => h.meditateT > 0 && !h.dead && units.includes(h);
  shaderDisc('rune', 'holy', h.pos, radius * 0.45, 30, { follow: h, active, seed: 5 });
  rays(h.pos, 'holy', 0.7, 4, 1.2, { follow: h });
  wave(h.pos, 0xffd27a, 0.3, radius, 0.8);
}
function calmPulse(h, radius, healed) {
  wave(h.pos, 0xffe6a8, 0.4, radius, 0.6, { opacity: 0.5 });
  for (const ally of healed) particle(sparkGeo, 0xbfffa8, ally.pos.clone().setY(ally.pos.y + 0.6), V(rnd(0.3), 1.8, rnd(0.3)), 0.7, { size: 1.2 });
}

// Alquimista: poça com o líquido em shader (brasas verdes no veneno, runas rosadas no tônico) e bolhas
// subindo; base = disco de updateBolts e o efeito apaga quando ele sai da cena
function puddle(base, radius, tonic) {
  const pal = tonic ? 'tonic' : 'venom';
  const liquid = vfxMesh(tonic ? 'rune' : 'embers', pal, groundGeo, { seed: Math.random() * 9 });
  liquid.rotation.x = -Math.PI / 2;
  addFx(liquid, 99, (e, dt) => {
    if (!base.parent) { e.done = true; return; }
    liquid.position.copy(base.position).setY(base.position.y + 0.01);
    liquid.scale.setScalar(radius * (1 - (1 - Math.min(1, e.t / 0.25)) ** 3));
    liquid.userData.fx.opacity = Math.min(1, base.material.opacity / 0.45);
    e.bub = (e.bub ?? 0) - dt;
    if (e.bub > 0) return;
    e.bub = lowQuality ? 0.5 : 0.25;
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius * 0.8;
    sprite('puff', pal, V(base.position.x + Math.cos(a) * r, base.position.y + 0.1, base.position.z + Math.sin(a) * r), V(0, 0.9, 0), 0.8, { size: 0.35, grow: 0.8, opacity: 0.8 });
  });
  burst(base.position.clone().setY(base.position.y + 0.4), tonic ? [0xff8ad8, 0xffffff] : [0x9cff3a, 0xe8ffb0], 10, 3);
}

// Alquimista (Frasco volátil): frasco girando em arco até o ponto da explosão
function flaskToss(h, to, life) {
  const m = new THREE.Mesh(flaskGeo, flaskGlassMat), from = h.pos.clone().setY(h.pos.y + 1.4), end = to.clone().setY(to.y + 0.2);
  m.add(vfxMesh('orb', 'venom', SPRITE, { size: 0.42 }));
  m.scale.setScalar(1.6);
  addFx(m, life, (e, dt, k) => {
    m.position.lerpVectors(from, end, k).setY(from.y + (end.y - from.y) * k + Math.sin(Math.PI * k) * 2.2);
    m.rotation.x += dt * 12;
  });
}
function flaskBlast(at, radius) {
  const p = at.clone().setY(at.y + 0.8);
  blast(p, radius * 1.6, 0.5, 'venom');
  puffs(at.clone().setY(at.y + 0.3), 6, 'venom', { spread: radius * 0.5, size: 1.1, rise: 1.2, life: 1.1 });
  burst(p, [0x9cff3a, 0xe8ffb0], fewer(14), 7, { size: 1.3 });
  wave(at, 0x9cff3a, 0.4, radius, 0.45, { opacity: 0.55 });
  shake(0.3);
}

// Cozinheira: comidas pequenas e coloridas (torta, tomate, queijo, folha) voam em arco; confete de ingredientes e vapor suave
const FOOD_COLORS = [0xe0432f, 0xf2c94c, 0x6fbf4a, 0xf08a3c, 0xc86ad0];
const tableTopGeo = new THREE.BoxGeometry(1.9, 0.1, 1.05), clothGeo = new THREE.BoxGeometry(2, 0.04, 1.15), tableLegGeo = new THREE.BoxGeometry(0.12, 0.62, 0.12);
function foodToss(h, to, life) {
  const from = h.pos.clone().setY(h.pos.y + 1.4), end = to.clone().setY(to.y + 0.3);
  const side = V(end.z - from.z, 0, from.x - end.x).normalize();
  const items = [[pieGeo, 0xd9a05a, 1.3, 0, 2.4], [foodGeo, 0xe0432f, 1, 0.35, 1.8], [foodBoxGeo, 0xf2c94c, 1, -0.35, 2.9], [foodGeo, 0x6fbf4a, 0.9, 0.18, 2.1]];
  for (const [geo, color, size, spread, peak] of items.slice(0, lowQuality ? 2 : 4)) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    m.scale.setScalar(size);
    addFx(m, life, (e, dt, k) => {
      m.position.lerpVectors(from, end, k).setY(from.y + (end.y - from.y) * k + Math.sin(Math.PI * k) * peak).addScaledVector(side, spread * Math.sin(Math.PI * k));
      m.rotation.x += dt * 9; m.rotation.z += dt * 6;
    });
  }
}
// confete de ingredientes e um sopro de vapor; radius = até onde os pedaços chegam
function foodPop(at, radius = 1) {
  const p = at.clone().setY(at.y + 0.9);
  for (let i = 0; i < fewer(14); i++) {
    const a = Math.random() * TAU, v = (radius / 0.72) * (0.4 + 0.6 * Math.random());
    particle(i % 2 ? foodBoxGeo : foodGeo, FOOD_COLORS[i % FOOD_COLORS.length], p, V(Math.cos(a) * v, 2.5 + Math.random() * 2, Math.sin(a) * v), 0.9, { solid: true, gravity: 9, size: 0.6, drag: 0.5 });
  }
  puffs(p, 3, 'smoke', { spread: radius * 0.4, size: 0.9, opacity: 0.45, rise: 1.2, life: 1.2 });
}
// ensopado no chão: aterrissa com confete e anel, depois solta vapor e pedacinhos enquanto a poça durar
function stewPool(base, radius) {
  const p = new THREE.Group();
  addFx(p, 99, (e, dt) => {
    if (!base.parent) { e.done = true; return; }
    const at = base.position;
    if (!e.landed) { e.landed = true; foodPop(at, radius); wave(at, 0xffd27a, 0.2, radius, 0.5, { opacity: 0.4 }); }
    e.next = (e.next ?? 0) - dt;
    if (e.next > 0) return;
    e.next = lowQuality ? 0.7 : 0.35;
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius * 0.85, spot = V(at.x + Math.cos(a) * r, at.y + 0.15, at.z + Math.sin(a) * r);
    puffs(spot, 1, 'smoke', { spread: 0.1, size: 0.65, opacity: 0.4, rise: 0.9, life: 1.2 });
    if (e.alt = !e.alt) particle(foodGeo, FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)], spot, V(rnd(0.3), 1.6, rnd(0.3)), 0.7, { solid: true, gravity: 5, size: 0.5 });
  }, 0.45);
}
// banquete: mesa com toalha e pratos que brota do chão, solta vapor e confete e afunda ao fim
function feastTable(base, radius, duration) {
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: 0x9a6a3a }), cloth = new THREE.MeshLambertMaterial({ color: 0xe8554a });
  const top = new THREE.Mesh(tableTopGeo, wood), sheet = new THREE.Mesh(clothGeo, cloth);
  top.position.y = 0.66; sheet.position.y = 0.72;
  g.add(top, sheet);
  for (const [x, z] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) g.add(new THREE.Mesh(tableLegGeo, wood).translateX(x).translateY(0.31).translateZ(z));
  for (const [geo, color, x, z] of [[pieGeo, 0xd9a05a, -0.5, 0], [foodGeo, 0xe0432f, 0.1, 0.25], [foodBoxGeo, 0xf2c94c, 0.1, -0.25], [foodGeo, 0x6fbf4a, 0.55, 0.1]]) {
    const dish = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    dish.position.set(x, 0.86, z);
    dish.scale.setScalar(1.4);
    g.add(dish);
  }
  g.position.copy(base.position);
  g.rotation.y = Math.random() * TAU;
  addFx(g, duration, (e, dt) => {
    if (!base.parent) { e.done = true; return; }
    const grow = Math.min(1, e.t / 0.3), sink = Math.min(1, (duration - e.t) / 0.4);
    g.scale.setScalar(Math.max(0.01, (1 - (1 - grow) ** 3) * Math.min(1, sink)));
    if (!e.started) { e.started = true; foodPop(g.position, 1.6); wave(g.position, 0xffd27a, 0.2, radius, 0.5, { opacity: 0.4 }); }
    e.next = (e.next ?? 0) - dt;
    if (e.next > 0) return;
    e.next = lowQuality ? 0.7 : 0.35;
    const spot = V(g.position.x + rnd(0.7), g.position.y + 1, g.position.z + rnd(0.4));
    puffs(spot, 1, 'smoke', { spread: 0.1, size: 0.7, opacity: 0.4, rise: 1, life: 1.3 });
    if (e.alt = !e.alt) particle(foodBoxGeo, FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)], spot, V(rnd(0.6), 2.2, rnd(0.6)), 0.8, { solid: true, gravity: 6, size: 0.55 });
    if ((e.pulse = (e.pulse ?? 0) + 1) % 3 === 0) wave(g.position, 0xffd27a, radius * 0.7, radius, 0.5, { opacity: 0.2 });
  }, 0.5);
}

// Alquimista (Veneno Aderente): o frasco estoura no alvo; depois, uma bolha sobe do corpo a cada tique
function venomHit(enemy) {
  const at = enemy.pos.clone().setY(enemy.pos.y + 0.8);
  puffs(at, 4, 'venom', { spread: 0.5, size: 0.9, rise: 1.2, life: 0.9 });
  burst(at, [0x9cff3a, 0xe8ffb0], fewer(8), 4, { size: 1.1 });
}
function venomDrip(enemy) {
  puffs(enemy.pos.clone().setY(enemy.pos.y + 0.9 * (enemy.size || 1)), 1, 'venom', { spread: 0.2, size: 0.45, rise: 1, life: 0.8, opacity: 0.8 });
}

// Vampira (Eclipse Rubro): explosão de sangue; o anel mostra até onde a cura alcança
function bloodBurst(at, radius) {
  const p = at.clone().setY(at.y + 0.7);
  burst(p, [0xb0243c, 0x3a0a14], fewer(10), 4, { size: 1.1 });
  wave(at, 0xb0243c, 0.3, radius, 0.4, { opacity: 0.4 });
}

// Xamã (Espírito Acompanhante): esfera verde translúcida (sem aditivo) que gira em volta do aliado, deixando um rastro curto; o anel do pulso tem o raio da cura
function followSpirit(sp) {
  const m = new THREE.Mesh(shellGeo, glow(0x6fe0a0, 0.6, false));
  m.scale.setScalar(1);
  addFx(m, sp.life + 0.4, (e, dt) => {
    if (!followSpirits.includes(sp)) { e.done = true; return; }
    const a = e.t * 2.8, at = sp.ally.pos;
    m.position.set(at.x + Math.cos(a) * 0.9, at.y + 1.5 + Math.sin(e.t * 4) * 0.12, at.z + Math.sin(a) * 0.9);
    e.trail = (e.trail ?? 0) - dt;
    if (e.trail <= 0) { e.trail = lowQuality ? 0.35 : 0.18; puffs(m.position, 1, 'nature', { spread: 0.05, size: 0.4, rise: 0.2, life: 0.5, opacity: 0.7 }); }
  });
}
function spiritPulse(sp) {
  const at = sp.ally.pos;
  wave(at, 0x6fe0a0, 0.2, 1.2, 0.4, { opacity: 0.35 });
  burst(at.clone().setY(at.y + 1.2), [0x6fe0a0, 0xe8ffd0], fewer(4), 2, { gravity: -1 });
}

// Alquimista (Grande transmutação): onda e runas rosadas; cada inimigo comum vira uma ovelha até a magia acabar
function transmuteWave(at, radius) {
  shaderDisc('rune', 'tonic', at, radius, 1.2, { seed: 7 });
  wave(at, 0xff8ad8, 0.3, radius, 0.8, { geo: ringGeo, opacity: 0.8, spin: 2 });
  puffs(at.clone().setY(at.y + 0.4), 6, 'tonic', { spread: radius * 0.6, size: 1, life: 1 });
}
function sheep(enemy) {
  const hidden = [];
  enemy.root.traverse((o) => { if (o.isMesh && o.visible) { o.visible = false; hidden.push(o); } });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(woolGeo, woolMat), new THREE.Mesh(sheepFaceGeo, sheepFaceMat));
  enemy.root.add(g);
  puffs(enemy.pos.clone().setY(enemy.pos.y + 0.6), 4, 'tonic', { size: 0.9, spread: 0.4, life: 0.7 });
  addFx(new THREE.Group(), 99, (e) => {
    g.position.y = Math.abs(Math.sin(e.t * 9)) * 0.06 * (enemy.vel.lengthSq() > 0.05 ? 1 : 0);   // saltitando quando anda
    if (!(enemy.sheepT <= 0 || enemy.dead || !units.includes(enemy))) return;
    e.done = true;
    enemy.root.remove(g);
    for (const o of hidden) o.visible = true;
    if (!enemy.dead) puffs(enemy.pos.clone().setY(enemy.pos.y + 0.6), 4, 'smoke', { size: 0.9, spread: 0.4, life: 0.7 });
  });
}

// Rei: coroa dourada girando acima dele e ondas douradas pelo grupo
function royal(h, party) {
  const crown = new THREE.Group();
  const mat = glow(0xffc61a, 0.95, false);
  crown.add(new THREE.Mesh(crownGeo, mat));
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(spikeGeo, mat);
    spike.position.set(Math.cos((i / 6) * TAU) * 0.34, 0.1, Math.sin((i / 6) * TAU) * 0.34);
    crown.add(spike);
  }
  addFx(crown, 1.8, (e, dt, k) => {
    crown.position.copy(h.pos).setY(h.pos.y + 3.4 + k * 0.8);   // acima da barra de vida
    crown.rotation.y += dt * 3;
    const pop = Math.min(1, e.t / 0.3);
    crown.scale.setScalar(1.9 * (1 - (1 - pop) ** 3) + Math.sin(pop * Math.PI) * 0.5);
    mat.opacity = 0.95 * (k > 0.7 ? (1 - k) / 0.3 : 1);
  });
  for (let i = 0; i < 2; i++) wave(h.pos, 0xffd84a, 0.5, 6, 0.9, { delay: i * 0.2, opacity: 0.45 });
  for (const f of party) {
    rays(f.pos, 'holy', 0.5, 3, 0.8, { follow: f, opacity: 0.7 });   // luz dourada em shader sobre cada herói
    burst(f.pos.clone().setY(f.pos.y + 1.2), [0xffd84a, 0xfff2c8], 6, 2.5, { gravity: -2 });
  }
}

// Apostador: cartas voando e caindo (materiais opacos compartilhados, sem brilho aditivo)
// cartas sobem em arco e giram em volta de um ponto; face 1 = vermelha (copas, ouros), 2 = escura (espadas, paus)
function cardFlutter(at, n = 6, spread = 1, face = 0) {
  for (let i = 0; i < fewer(n); i++) {
    const m = new THREE.Mesh(cardGeo, CARD_MATS[face || i % 2]);
    const a = Math.random() * TAU, r = Math.random() * spread;
    const base = V(at.x + Math.cos(a) * r, at.y + 0.8, at.z + Math.sin(a) * r), v = V(rnd(1.4), 3 + Math.random() * 1.5, rnd(1.4));
    m.scale.setScalar(2.2);
    addFx(m, 0.9, (e, dt, k) => {
      m.position.set(base.x + v.x * e.t, base.y + v.y * e.t - 4.5 * e.t * e.t, base.z + v.z * e.t);
      m.rotation.x += dt * 9; m.rotation.y += dt * 7;
      m.scale.setScalar(2.2 * (1 - Math.max(0, (k - 0.75) / 0.25)));
    }, i * 0.03);
  }
}
// carta lançada do herói ao alvo (o dano é aplicado pela habilidade)
function cardThrow(h, to, face = 0) {
  const m = new THREE.Mesh(cardGeo, CARD_MATS[face || 0]), from = h.pos.clone().setY(h.pos.y + 1.3), end = to.clone().setY(to.y + 1);
  m.scale.setScalar(2.4);
  addFx(m, 0.22, (e, dt, k) => { m.position.lerpVectors(from, end, k); m.rotation.z += dt * 30; });
}
// chuva de cartas na área; cada carta vira e some ao cravar (All-in)
function cardRain(at, radius) {
  for (let i = 0; i < fewer(9); i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * radius;
    const land = V(at.x + Math.cos(a) * r, at.y + 0.1, at.z + Math.sin(a) * r), from = V(land.x - 1, land.y + 8, land.z - 0.5);
    const m = new THREE.Mesh(cardGeo, CARD_MATS[i % 3]);
    m.scale.setScalar(2.6);
    addFx(m, 0.4, (e, dt, k) => {
      m.position.lerpVectors(from, land, Math.min(1, k * 1.2));
      m.rotation.x += dt * 14; m.rotation.y += dt * 9;
      if (k >= 0.85 && !e.hit) { e.hit = true; puffs(land, 1, 'dust', { size: 0.5, rise: 0.5, life: 0.5, speed: 0.4 }); }
      if (k > 0.85) m.scale.setScalar(2.6 * (1 - (k - 0.85) / 0.15));
    }, i * 0.04);
  }
}
// naipe sorteado: coluna de cor sobre o alvo e cartas ao redor
function suitMark(at, color, face) {
  column(at, color, 0.35, 2.4, 0.7);
  cardFlutter(at, 4, 0.6, face);
}

// Druida: raízes saindo do chão em volta do inimigo preso
function roots(enemy) {
  const n = 3 + Math.floor(Math.random() * 3), g = new THREE.Group();
  for (let b = 0; b < n; b++) {
    // cada galho sobe em espiral em volta do esqueleto até a cintura
    const a = (b / n) * TAU + rnd(0.3), turn = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.3);
    const pts = [0, 1, 2, 3].map((j) => V(Math.cos(a + j * turn) * (0.5 - j * 0.07), j * 0.32, Math.sin(a + j * turn) * (0.5 - j * 0.07)));
    for (let j = 0; j < 3; j++) {
      const dir = pts[j + 1].clone().sub(pts[j]), seg = new THREE.Mesh(branchGeos[j], barkMat);
      seg.position.copy(pts[j]);
      seg.scale.y = dir.length() + 0.04;
      seg.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      seg.castShadow = true;
      g.add(seg);
    }
    for (const side of [-1, 1]) {   // folhinhas na ponta
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.copy(pts[3]).add(V(side * 0.06, 0.04, 0));
      leaf.rotation.set(rnd(1), a, side * 0.8);
      g.add(leaf);
    }
  }
  addFx(g, 99, (e, dt) => {
    // cresce do chão, segue o esqueleto e afunda quando ele se solta ou morre
    if (enemy.dead || enemy.rootT <= 0 || !units.includes(enemy)) e.sink = (e.sink ?? 0) + dt / 0.3;
    const grow = (1 - (1 - Math.min(1, e.t / 0.3)) ** 3) * (1 - Math.min(1, e.sink ?? 0));
    g.position.copy(enemy.pos).setY(enemy.pos.y - (1 - grow) * 0.35);
    g.scale.set(enemy.size, Math.max(0.001, grow) * enemy.size, enemy.size);
    if ((e.sink ?? 0) >= 1) e.done = true;
  });
  for (let i = 0; i < fewer(6); i++)   // folhas em shader soltando das raízes
    sprite('leaf', 'nature', enemy.pos.clone().setY(enemy.pos.y + 0.4), V(rnd(2), 1 + Math.random() * 2, rnd(2)), 0.8, { size: 0.38, gravity: 1.5, drag: 1, dissolve: 0 });
  for (let i = 0; i < 5; i++) particle(rockGeo, 0x6d5a48, V(enemy.pos.x + rnd(0.5), enemy.pos.y + 0.1, enemy.pos.z + rnd(0.5)), V(rnd(1.5), 2.5 + Math.random() * 2, rnd(1.5)), 0.6, { solid: true, gravity: 14, size: 0.6 });
}

// Druida: folhas subindo em espiral e onda verde
function leaves(h, radius) {
  for (let i = 0; i < fewer(22); i++) {   // folhas em shader (giram, nervura e borda acesa)
    const a = Math.random() * TAU, r = 0.6 + Math.random() * 1.2;
    const at = V(h.pos.x + Math.cos(a) * r, h.pos.y + 0.2, h.pos.z + Math.sin(a) * r);
    sprite('leaf', 'nature', at, V(-Math.sin(a) * 2.5, 1.5 + Math.random() * 1.5, Math.cos(a) * 2.5), 1.4, { size: 0.42, gravity: 0.5, delay: Math.random() * 0.4, dissolve: 0 });
  }
  shaderDisc('rune', 'nature', h.pos, radius * 0.75, 1.2, { y: 0.06 });   // círculo da floresta no chão
  wave(h.pos, 0x8fe05a, 0.4, radius, 0.8);
  wave(h.pos, 0x3f8a2a, 0.3, radius * 0.9, 1, { geo: ringGeo, opacity: 0.5, delay: 0.1 });
}

// projétil próprio de cada atirador; vikings e ninja só mudam na habilidade
function look(b, skill) {
  const id = b.owner.cfg.id, L = BOLT_LOOKS[id];
  if (!L || (b.kind !== 'magic' && b.kind !== id)) { if (skill) dress(b); return; }
  const m = b.mesh;
  if (L.geo) {
    m.geometry = L.geo;
    m.material = L.core;
    for (const [mat, size] of L.shells) {
      const shell = new THREE.Mesh(id === 'cryo' || id === 'druid' ? L.geo : shellGeo, mat);
      shell.scale.setScalar(size);
      m.add(shell);
    }
    if (L.orb) m.add(vfxMesh('orb', L.orb[0], SPRITE, { size: L.orb[1] }));
    if (L.ice) m.add(vfxMesh('ice', 'frost', L.geo));
  }
  m.scale.setScalar(L.size[skill ? 1 : 0]);
  b.look = id;
  b.style = L;
  b.age = 0;
}

// tiros de habilidade ficam maiores; o do ninja vira estrela girando
function dress(b) {
  b.mesh.scale.setScalar({ pyro: 2.2, cryo: 1.6, viking: 1.5, iceviking: 1.5, crossbow: 1.8, ninja: 1.8 }[b.kind] || 1.4);
  if (b.kind === 'flask' || b.kind === 'tonic') {   // frasco de vidro com o líquido borbulhando em shader
    b.mesh.geometry = flaskGeo;
    b.mesh.material = flaskGlassMat;
    b.mesh.add(vfxMesh('orb', b.kind === 'tonic' ? 'tonic' : 'venom', SPRITE, { size: 0.42 }));
    b.style = { spin: true };
  }
  if (b.kind === 'ninja') {   // estrela de 8 pontas: duas lâminas cruzadas e um brilho azul
    b.mesh.geometry = shurikenGeo;
    b.mesh.material = steelMat;
    b.mesh.quaternion.identity();
    const cross = new THREE.Mesh(shurikenGeo, steelMat), halo = new THREE.Mesh(shurikenGeo, starGlowMat);
    cross.rotation.y = Math.PI / 4;
    halo.scale.set(1.5, 2, 1.5);
    b.mesh.add(cross, halo);
  }
}

function trail(b, dt) {
  const m = b.mesh, L = b.style || {};
  if (b.kind === 'ninja' && b.skill) m.rotation.y += dt * 32;   // shuriken gira rápido no plano horizontal
  b.age = (b.age ?? 0) + dt;
  if (L.spin) { m.rotation.x += dt * 8; m.rotation.y += dt * 11; }
  if (L.aim) {   // cristal e espinho apontam para o alvo; o espinho gira no próprio eixo
    m.lookAt(b.target.pos.x, b.target.pos.y + 1.1, b.target.pos.z);
    if (L.roll) m.rotateZ(b.age * 18);
  }
  b.trailT = (b.trailT ?? 0) - dt;
  if (b.trailT > 0) return;
  b.trailT = (b.skill ? 0.025 : b.look ? 0.035 : 0.07) * (lowQuality ? 2 : 1);
  const [a, c] = TRAIL[b.look || b.kind] || [0xffffff, 0xffffff];
  const fire = b.look === 'pyro', size = fire ? (b.skill ? 2.6 : 1.5) : b.skill ? 1.5 : 1.1;
  const at = m.position.clone().add(V(rnd(0.1), rnd(0.1), rnd(0.1)).multiplyScalar(size));
  if (fire) {   // cauda de fogo: bolinhas em shader que sobem, encolhem e se rasgam
    sprite('orb', 'fire', at, V(rnd(0.5), 0.9 + Math.random() * 0.6, rnd(0.5)), b.skill ? 0.45 : 0.32, { size: b.skill ? 1.05 : 0.6, grow: -0.55 });
    particle(sparkGeo, 0xff3a1a, m.position.clone(), V(rnd(1), 0.5, rnd(1)), 0.6, { size: size * 0.5, gravity: 5 });   // brasas que caem
    if (b.skill && Math.random() < 0.2) puffs(m.position, 1, 'smoke', { size: 0.6, rise: 0.8, life: 0.8, speed: 0.3, spread: 0.1 });
  } else if (b.look === 'druid') sprite('leaf', 'nature', at, V(rnd(0.6), rnd(0.6), rnd(0.6)), 0.45, { size: b.skill ? 0.42 : 0.32, grow: -0.4, dissolve: 0 });
  else particle(sparkGeo, Math.random() < 0.5 ? a : c, at, V(rnd(0.6), rnd(0.6), rnd(0.6)), 0.35, { size, grow: -0.6 });
  if (b.look === 'necro' && Math.random() < 0.4) sprite('puff', 'gloom', m.position.clone(), V(0, 0.4, 0), 0.55, { size: 0.45, grow: 0.8, opacity: 0.85 });
  if (b.kind === 'ninja' && b.skill) {   // faíscas nas pontas da shuriken desenham o giro no rastro
    const r = 0.32 * m.scale.x, ang = m.rotation.y;
    for (const s of [1, -1]) particle(sparkGeo, s > 0 ? 0xffffff : c, m.position.clone().add(V(Math.cos(ang) * r * s, 0, -Math.sin(ang) * r * s)), V(0, 0, 0), 0.22, { size: 0.8, grow: -0.8 });
  }
}

// tremida de câmera curta nos golpes fortes
function shake(n) { if (!calmMotion?.matches) shakeK = Math.max(shakeK, n); }
// hit-stop: o jogo quase congela por um instante no disparo da ultimate (só o tempo do quadro, sem mudar números)
function hitStop(n) { if (!calmMotion?.matches) stopT = Math.max(stopT, n); }
// câmera lenta curta (queda de chefe)
function slowMo(n) { slowT = Math.max(slowT, n); }
function timeScale(real) {
  if (stopT > 0) { stopT -= real; return 0.12; }
  if (slowT > 0) { slowT -= real; return 0.3; }
  return 1;
}
function cameraJolt(real) {
  shakeK = Math.max(0, shakeK - real * 1.6);
  return jolt.set(rnd(), rnd() * 0.6, rnd()).multiplyScalar(shakeK);
}

// golpe corpo a corpo: faíscas curtas no alvo (materiais do estoque, sem material novo); crítico ganha mini hit-stop
function meleeHit(target, critical) {
  const p = V(target.pos.x, target.pos.y + 0.9 * (target.size || 1), target.pos.z);
  burst(p, critical ? [0xffffff, 0xff5a3a, 0xffd04a] : [0xffffff, 0xffe9a8], fewer(critical ? 9 : 5), critical ? 5 : 3.5, { life: 0.3, size: critical ? 1.2 : 0.85, gravity: 4 });
  if (critical) hitStop(0.03);
}

// herói caído: anel vermelho no chão, poeira e faíscas que caem
function heroFall(h) {
  wave(h.pos, 0xff5a4a, 0.4, 2.2, 0.7, { opacity: 0.7 });
  puffs(h.pos, 4, 'dust', { size: 0.8, rise: 0.5, life: 0.8 });
  burst(h.pos.clone().setY(h.pos.y + 1), [0xff6a5a, 0xffc0b0], 10, 3, { gravity: 5 });
}

// herói de volta: raios de luz dourada, anel e faíscas subindo
function heroRise(h) {
  rays(h.pos, 'holy', 0.7, 5, 1.1, { follow: h });
  wave(h.pos, 0xfff0a0, 0.4, 2.4, 0.7);
  burst(h.pos.clone().setY(h.pos.y + 0.6), [0xffe27a, 0xfff2c8], 12, 3, { gravity: -2 });
}

// chefe derrotado: câmera lenta, tremida e explosão de luz
function bossDown(boss) {
  slowMo(0.6);
  shake(0.6);
  if (!boss) return;
  const p = boss.pos.clone().setY(boss.pos.y + 1.2);
  rays(boss.pos, 'holy', 1.4, 10, 1.4);
  wave(boss.pos, 0xfff2b0, 0.5, 6, 0.9, { geo: ringGeo, opacity: 0.5, spin: 3 });
  wave(boss.pos, 0xffd04a, 0.4, 4, 0.6, { delay: 0.08, opacity: 0.5 });
  burst(p, [0xfff2b0, 0xffd04a], fewer(22), 8, { life: 0.8, size: 1.3 });
  puffs(boss.pos.clone().setY(boss.pos.y + 0.4), 6, 'dust', { spread: 1, size: 1.2, rise: 0.8, life: 1.1 });
}

// Partículas do elemento de cada herói ao soltar uma habilidade extra (fogo, gelo, arcano, luz, natureza, sombra, tempo, som).
const OWN_FX_SKILLS = new Set(['combustion', 'gravity-collapse', 'arcane-echo', 'frost-guard', 'storm-cloud', 'bone-pact', 'reap-mark', 'vision-mark', 'time-echo']);
function element(h, skill, target, impactPoint = null) {
  if (OWN_FX_SKILLS.has(skill.effect)) return;   // Magos: técnicas com efeito próprio (no tamanho do alcance real)
  const id = h.cfg.id, ult = !!skill.ultimate, n = ult ? 18 : 10;
  const meteor = skill.effect === 'meteor';
  const area = !!skill.radius || !target;
  const at = (meteor ? impactPoint || target?.pos || h.pos : area ? h.pos : target.pos).clone();
  const reach = area ? (skill.radius || 4.5) * (meteor ? 1 : 0.7) : 1.4;
  const spot = (y = 0.2) => { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * reach; return V(at.x + Math.cos(a) * r, at.y + y, at.z + Math.sin(a) * r); };
  if (id === 'pyro') {   // brasas subindo, anel de chamas (ou o meteoro) e fumaça em shader
    for (let i = 0; i < fewer(n); i++) particle(sparkGeo, i % 3 ? 0xff7a1a : 0xffe070, spot(), V(rnd(0.6), 2.5 + Math.random() * 2.5, rnd(0.6)), 0.9, { size: 1.3, gravity: -1, delay: Math.random() * 0.25 });
    if (ult) meteorImpact(at, reach);
    else if (area) { flameRing(at, reach, 14, 0.8, 'fire', 1.3); puffs(at.clone().setY(at.y + 0.4), 4, 'smoke', { spread: reach * 0.5, size: 1.1 }); }
  } else if (id === 'cryo' || id === 'iceviking') {   // flocos caindo devagar, cristais e névoa fria
    for (let i = 0; i < fewer(n); i++) particle(sparkGeo, i % 2 ? 0xe6fbff : 0x8be8ff, spot(2.6 + Math.random()), V(rnd(0.4), -1.2, rnd(0.4)), 1.2, { size: 1.1, delay: Math.random() * 0.4 });
    if (area) crystals(at, Math.min(reach, 3.5));
    puffs(at.clone().setY(at.y + 0.4), ult ? 8 : 4, 'frostMist', { spread: reach * 0.6, rise: 0.25, size: 1.4, opacity: 0.65, life: 1.5 });
  } else if (id === 'arcane') {   // círculo de runas e faíscas girando para dentro
    shaderDisc('rune', 'arcane', at, reach + 0.5, ult ? 1.3 : 0.9, { seed: 1 });
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, p = V(at.x + Math.cos(a) * reach, at.y + 1, at.z + Math.sin(a) * reach);
      particle(sparkGeo, i % 2 ? 0x8a3cff : 0xe0c8ff, p, V(-Math.cos(a) * reach * 2.2 - Math.sin(a) * 2, 0.6, -Math.sin(a) * reach * 2.2 + Math.cos(a) * 2), 0.45, { size: 1.3 });
    }
  } else if (id === 'paladin' || id === 'cleric' || id === 'angel') {   // raios de luz e fagulhas douradas
    for (let i = 0; i < (ult ? 5 : 3); i++) rays(spot(0), 'holy', 0.3, 6, 0.7, { delay: i * 0.06 });   // raios de luz em shader
    if (ult) shaderDisc('rune', 'holy', at, reach + 0.4, 1.1, { seed: 3 });
    for (let i = 0; i < n; i++) particle(sparkGeo, i % 3 ? 0xffe27a : 0xffffff, spot(), V(rnd(0.3), 3 + Math.random() * 2, rnd(0.3)), 1, { size: 1.2, delay: Math.random() * 0.3 });
  } else if (id === 'druid' || id === 'shaman') {   // folhas rodando
    for (let i = 0; i < fewer(n); i++) sprite('leaf', 'nature', spot(), V(rnd(1.5), 1.5 + Math.random() * 1.5, rnd(1.5)), 1.2, { size: 0.4, gravity: 0.6, delay: Math.random() * 0.3, dissolve: 0 });
  } else if (id === 'necro' || id === 'assassin' || id === 'ninja') {   // sombra: fumaça em shader (verde no necro, roxa no assassino, cinza no ninja) e fagulhas frias
    const tint = id === 'necro' ? 0x6dff8a : 0xb48cff;
    for (let i = 0; i < fewer(n / 2); i++) sprite('puff', id === 'necro' ? 'gloom' : id === 'assassin' ? 'shadow' : 'smoke', spot(0.4), V(rnd(0.6), 0.8, rnd(0.6)), 0.9, { size: 0.95, grow: 1, opacity: 0.9 });
    for (let i = 0; i < n / 2; i++) particle(sparkGeo, tint, spot(0.6), V(rnd(1), 1.6, rnd(1)), 0.6, { size: 1.1 });  } else if (id === 'duelist') {   // aço: faíscas prateadas e rubras cortando o ar
    for (let i = 0; i < n; i++) particle(sparkGeo, i % 3 ? 0xdfe6ee : 0xff5a7a, spot(0.9), V(rnd(2.5), 1 + Math.random(), rnd(2.5)), 0.5, { size: 1.1, delay: Math.random() * 0.2 });
  } else if (id === 'archer') {   // penas verde-água rodopiando no ar
    for (let i = 0; i < fewer(n); i++) particle(shardGeo, i % 2 ? 0xe8f6ee : 0x3fe0b0, spot(1.2), V(rnd(1.5), 1.5 + Math.random(), rnd(1.5)), 0.7, { size: 0.8, gravity: 2, delay: Math.random() * 0.2 });
  } else if (id === 'monk') {   // poeira levantada e fagulhas douradas de energia interior
    puffs(at.clone().setY(at.y + 0.2), ult ? 6 : 3, 'dust', { spread: reach * 0.4, size: 0.9, rise: 0.8, life: 0.9 });
    for (let i = 0; i < n; i++) particle(sparkGeo, i % 3 ? 0xffd27a : 0xffffff, spot(0.6), V(rnd(0.8), 2 + Math.random() * 1.5, rnd(0.8)), 0.8, { size: 1.1, delay: Math.random() * 0.25 });
  } else if (id === 'alchemist') {   // bolhas de veneno (e rosadas na transmutação) subindo e estourando
    for (let i = 0; i < fewer(n / 2); i++) sprite('puff', ult ? 'tonic' : 'venom', spot(0.3), V(rnd(0.4), 1 + Math.random(), rnd(0.4)), 0.9, { size: 0.5, grow: 0.8, opacity: 0.9, delay: Math.random() * 0.3 });
  } else if (id === 'illusionist') {   // fumaça violeta e fagulhas pálidas subindo, sem brilho grande
    puffs(at.clone().setY(at.y + 0.4), ult ? 6 : 3, 'shadow', { spread: reach * 0.5, size: 0.9, rise: 0.8, life: 1, opacity: 0.6 });
    for (let i = 0; i < fewer(n); i++) particle(sparkGeo, i % 2 ? 0xc8b8ff : 0xf0e8ff, spot(0.8), V(rnd(0.8), 1.2 + Math.random(), rnd(0.8)), 0.6, { size: 1, delay: Math.random() * 0.2 });
  } else if (id === 'chronist') {   // mostrador de relógio no chão, com os ponteiros voltando
    clockFace(at, reach + 0.6, ult ? 1.4 : 0.9);
  } else if (id === 'bard') {   // cartas voando em volta do apostador
    cardFlutter(h.pos, ult ? 10 : 5, 1.2);
    wave(h.pos, 0xff6a7a, 0.2, ult ? 4 : 2.5, 0.5, { opacity: 0.35 });
  }
}

// Cronomante: relógio no chão com doze marcas e ponteiros girando ao contrário
function clockFace(at, radius, life) {
  shaderDisc('rune', 'chrono', at, radius * 1.05, life, { y: 0.06, seed: 4 });   // runas do tempo girando sob o mostrador
  const g = new THREE.Group(), mat = glow(0x8feaff, 0.85);
  const rim = new THREE.Mesh(thinRingGeo, mat);
  rim.rotation.x = -Math.PI / 2;
  g.add(rim);
  for (let i = 0; i < 12; i++) {
    const tick = new THREE.Mesh(crackGeo, mat), a = i / 12 * TAU;
    tick.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
    tick.rotation.y = -a;
    tick.scale.set(0.14, 1, i % 3 ? 0.6 : 1.4);
    g.add(tick);
  }
  const hands = [[0.7, 0xffffff, -9], [0.45, 0xb6a4ff, -2.5]].map(([len, color, speed]) => {
    const hand = new THREE.Mesh(crackGeo, glow(color, 0.95));
    hand.scale.set(len, 1, 1.2);
    hand.userData.speed = speed;
    g.add(hand);
    return hand;
  });
  g.position.copy(at).setY(at.y + 0.1);
  addFx(g, life, (e, dt, k) => {
    g.scale.setScalar(radius * (1 - (1 - Math.min(1, e.t / 0.2)) ** 3));
    for (const hand of hands) { hand.rotation.y += hand.userData.speed * dt; hand.material.opacity = 0.95 * (1 - k); }
    mat.opacity = 0.85 * (1 - k * k);
  });
}

// Cronomante: anel de tempo parado em volta do inimigo preso, até ele se soltar
function stasis(enemy) {
  const g = new THREE.Group();
  const band = new THREE.Mesh(thinRingGeo, glow(0x8feaff, 0.8)), inner = new THREE.Mesh(hexGeo, glow(0xb6a4ff, 0.6));
  band.rotation.x = inner.rotation.x = -Math.PI / 2;
  g.add(band, inner);
  addFx(g, 99, (e, dt) => {
    if (enemy.dead || enemy.rootT <= 0 || !units.includes(enemy)) e.done = true;
    g.position.copy(enemy.pos).setY(enemy.pos.y + 0.9 * enemy.size + Math.sin(e.t * 3) * 0.15);
    const pop = Math.min(1, e.t / 0.2);
    band.scale.setScalar(0.75 * enemy.size * pop);
    inner.scale.setScalar(0.55 * enemy.size * pop);
    band.rotation.z -= dt * 0.8;
    inner.rotation.z += dt * 0.5;
    band.material.opacity = 0.55 + 0.25 * Math.sin(e.t * 5);
  });
  burst(enemy.pos.clone().setY(enemy.pos.y + 1), [0x8feaff, 0xb6a4ff], 6, 2.5, { gravity: 0 });
}

// seta de besta que não entrou: quebra, quica para trás e fica cravada no chão um instante
function brokenArrow(at, from) {
  const src = assets['kaykit/skeletons/Assets/gltf/Skeleton_Arrow_Broken'];
  if (!src) return;
  const g = src.scene.clone();
  g.traverse((o) => { if (o.material) o.material.userData.keep = true; });   // material do GLTF, compartilhado
  g.position.copy(at);
  const away = new THREE.Vector3(at.x - from.x, 0, at.z - from.z).normalize().multiplyScalar(-1.2 - Math.random());
  const vel = new THREE.Vector3(away.x + rnd(0.8), 3 + Math.random(), away.z + rnd(0.8));
  const ground = world.groundHeight(at.x + vel.x * 0.6, at.z + vel.z * 0.6);
  g.rotation.set(rnd(1), Math.random() * TAU, rnd(1));
  const tilt = new THREE.Euler(Math.PI - 0.5 + rnd(0.35), Math.random() * TAU, 0);   // ponta para baixo, inclinada
  addFx(g, 2.6, (e, dt, k) => {
    if (g.position.y > ground + 0.12 || vel.y > 0) {
      vel.y -= 14 * dt;
      g.position.addScaledVector(vel, dt);
      g.rotation.x += dt * 9; g.rotation.z += dt * 5;
      if (g.position.y <= ground + 0.12 && vel.y < 0) { g.position.y = ground + 0.12; vel.set(0, 0, 0); g.rotation.copy(tilt); }
    } else if (k > 0.75) g.position.y = ground + 0.12 - (k - 0.75) * 1.4;   // afunda e some
  });
}

const FX = { look, update(dt) { updateSkillFx(dt); updateSparks(dt); }, clear: clearSkillFx, jolt: cameraJolt, shake, hitStop, slowMo, timeScale, meleeHit, heroFall, heroRise, bossDown,element, stasis, charge, release, dome,
  holyLight: (h, friends, reach) => { cleanseAround(h.pos, reach); holyLight(h, friends, reach); },   // cura em área também tira o veneno
  leaves: (h, reach) => { cleanseAround(h.pos, reach); leaves(h, reach); },   // Druida
  venomHit, venomDrip, bloodBurst, followSpirit, spiritPulse, whirl, fury, later, judgmentMark, judgmentStrike, furyPulse, quake, quakeAt, seismicPull, impact, iceFan, zigzag, summon, legion, knights, shadowStep, slashX, royal, roots, cardFlutter, cardThrow, cardRain, suitMark, dress, trail, column, swing, fireField, skillColor: (h) => SKILL_ART[h.cfg.id]?.color };

// Rúnica: projétil, selo e visuais (lógica em runeShieldOn, runicSoak e raiseRuneDome)
BOLT_LOOKS.runic = { geo: boltGeo, core: hiddenCore, shells: [[glowMaterial(0x6fd8e0, 0.35), 1.7]], orb: ['runic', 0.38], size: [1.3, 1.3], spin: true };
BOLT_LOOKS.runic.shells[0][0].userData.keep = true;
TRAIL.runic = [0x6fd8e0, 0xffffff];
SIGIL_RUNES.runic = 'runic';
SKILL_ART.runic = { color: 0x6fd8e0, accent: 0xffffff, glyph: domeGeo, scale: 0.4 };
const runeBubbleGeo = new THREE.SphereGeometry(1, 16, 10);
// bolha translúcida (brilho só na borda, sem aditivo) e runas girando em anel no chão enquanto a runa-escudo durar
FX.runeShield = (h) => {
  const m = new THREE.Mesh(runeBubbleGeo, shieldMaterial(0x6fd8e0));
  addFx(m, 60, (e) => {
    m.position.copy(h.pos).setY(h.pos.y + 1);
    m.scale.setScalar(0.95 + Math.sin(e.t * 3) * 0.02);
    m.material.uniforms.time.value = e.t;
    m.material.uniforms.opacity.value = 0.5 * Math.min(1, 0.4 + h.runeHp / Math.max(1, h.runeMax)) * Math.min(1, Math.max(0, h.runeT) / 0.5);
    if (h.dead || !(h.runeHp > 0) || !units.includes(h)) e.done = true;
  });
  shaderDisc('rune', 'runic', h.pos, 1.15, 60, { follow: h, opacity: 0.6, active: () => h.runeHp > 0 && !h.dead });
};
FX.runeBreak = (h, radius) => {   // o anel cresce até o raio real do empurrão
  wave(h.pos, 0x6fd8e0, 0.3, radius, 0.45, { dust: true, opacity: 0.7 });
  burst(h.pos.clone().setY(h.pos.y + 1), [0x6fd8e0, 0xffffff], fewer(8), 4);
};
FX.runeDome = (dome) => {   // raio da cúpula = raio real da proteção
  const m = new THREE.Mesh(domeGeo, shieldMaterial(0x6fd8e0));
  addFx(m, dome.t + 1, (e) => {
    m.position.copy(dome.pos);
    m.scale.setScalar(dome.r * (1 - (1 - Math.min(1, e.t / 0.3)) ** 3));
    m.material.uniforms.time.value = e.t;
    m.material.uniforms.opacity.value = 0.5 * Math.min(1, Math.max(0, dome.t) / 0.5);
    if (dome.t <= 0) e.done = true;
  });
  shaderDisc('rune', 'runic', dome.pos, dome.r, dome.t, { opacity: 0.7, active: () => dome.t > 0 });
  wave(dome.pos, 0x6fd8e0, dome.r * 0.2, dome.r, 0.5, { dust: true, opacity: 0.7 });
  burst(dome.pos.clone().setY(dome.pos.y + 1), [0x6fd8e0, 0xffffff], fewer(12), 5);
};
Object.assign(FX, { bladeCut, steelDash, bladeDance, bladeSpin });   // Duelista
Object.assign(FX, { combust, collapse, echoOrb, frostSkin, frostFreeze, stormCloud: snowCloud, pactAura, reapSoul, visionRing, timeEcho });   // Magos: técnicas novas
Object.assign(FX, { rays, rainMark, arrowVolley, hunterShot, huntMark, palmHit, windPalm, meditate, calmPulse, pool: puddle, flaskToss, flaskBlast, transmuteWave, sheep, beastCall, foodToss, foodPop, stewPool, feastTable });   // Arqueira, Monge, Alquimista e Domador
// Ilusionista: fumaça violeta translúcida (sombra em shader, sem brilho aditivo)
FX.illusionSmoke = (at, n = 3) => puffs(new THREE.Vector3(at.x, at.y + 0.5, at.z), n, 'shadow', { spread: 0.45, size: 0.8, rise: 0.8, life: 0.9, opacity: 0.55 });
// marca que acompanha o inimigo enquanto o estado `field` (disarmT, blindT, panicT) durar: anel fino e translúcido (material do estoque, sem aditivo)
let statusMarks = 0;
FX.statusMark = (enemy, field, color) => {
  if (enemy.statusMarks?.[field] || (lowQuality && statusMarks >= 6)) return;
  (enemy.statusMarks ||= {})[field] = true; statusMarks++;
  const m = new THREE.Mesh(thinRingGeo, glow(color, 0.75, false));
  m.rotation.x = -Math.PI / 2;
  addFx(m, 99, (e, dt) => {
    if (enemy.dead || !(enemy[field] > 0) || !units.includes(enemy)) { e.done = true; enemy.statusMarks[field] = false; statusMarks--; return; }
    m.position.set(enemy.pos.x, enemy.pos.y + 2.2 * enemy.size, enemy.pos.z);
    m.rotation.z += dt * 2.5;
    m.scale.setScalar(0.4 * enemy.size * (1 + 0.1 * Math.sin(e.t * 8)));
  });
};
Object.assign(FX, { pactCall, fairyPulse, fairyTrail, golemStep, golemRise, golemSlam, dragonBreath, summonFade, slimeLand });   // Invocador
FX.brokenArrow = brokenArrow;   // besteiro esqueleto
// Rei: um anel dourado fino sobe do chão de cada herói e o segue enquanto a marcha dura (sem brilho aditivo)
FX.marchDecree = (king, party, duration) => {
  wave(king.pos, 0xffd84a, 0.3, 3, 0.5, { dust: true, opacity: 0.6 });
  for (const h of party) if (!h.dead) column(h.pos, 0xffd84a, 0.55, 1.6, Math.min(1.2, duration), { follow: h, opacity: 0.2 });
};
// Brutamontes: anel de poeira no chão com o raio real do atordoamento a cada golpe que o dispara (só desenha; sem brilho aditivo)
FX.roarPulse = (hero, reach) => {
  wave(hero.pos, 0xe0b070, 0.4, reach, 0.35, { dust: true, opacity: 0.4 });
  burst(hero.pos.clone().setY(hero.pos.y + 0.3), [0xe0b070, 0xc9bba2], fewer(6), 3, { up: 0.4 });
};
FX.roarStart = (hero, seconds) => {
  wave(hero.pos, 0xe0b070, 0.3, ROAR.reach, 0.6, { dust: true, opacity: 0.55 });
  column(hero.pos, 0xe0b070, 0.9, 2.4, seconds, { follow: hero, opacity: 0.14 });
};
// Guardião: o escudo (disco achatado de 0,9 m, sem brilho aditivo) voa de inimigo em inimigo e um anel marca cada acerto
const shieldDiscGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.09, 14);
FX.shieldRicochet = (hero, path) => {
  const HOP = 0.12, disc = new THREE.Mesh(shieldDiscGeo, glow(0x9fcfff, 0.95, false));
  addFx(disc, HOP * path.length, (e, dt) => {
    const leg = Math.min(path.length - 1, Math.floor(e.t / HOP)), k = Math.min(1, e.t / HOP - leg);
    const a = leg ? path[leg - 1].pos : hero.pos, b = path[leg].pos;
    disc.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + 1.1 + Math.sin(k * Math.PI) * 0.3, a.z + (b.z - a.z) * k);
    disc.rotation.y += dt * 30;
    disc.rotation.x = 0.4;
  });
  path.forEach((s, i) => {
    wave(s.pos, 0x9fcfff, 0.2, 0.9, 0.35, { delay: i * HOP, opacity: 0.55 });
    burst(s.pos.clone().setY(s.pos.y + 1), [0x9fcfff, 0xffffff], fewer(5), 3, { delay: i * HOP });
  });
};
Object.assign(FX, { lanceThrust, lanceStance });   // Lanceiro

class Hero extends Unit {
  constructor(cfg) {
    super(cfg.built, cfg, 'hero');
    this.cfg = cfg;
    this.level = 1;
    this.xp = 0;
    this.haste = 1;
    this.skillRate = 1;
    this.skillPower = 1;
    this.controlPower = 1;
    this.supportPower = 1;
    this.damageTaken = 1;
    this.royalT = 0;
    this.royalBonus = 0;
    this.marchT = 0;   // Decreto de Marcha: mais veloz e com recargas mais rápidas
    this.songT = 0;
    this.songHaste = 1;
    this.formation = POSTS[Math.min(3, heroes().length - 1)];
    this.skillTimers = [2, 4, 8, 6];
    this.skillMaxes = [2, 4, 8, 6];
    this.autoSkills = [0, 1, 2, 3].map((slot) => loadAutoSlot(cfg.id, slot));
    this.skillRequests = [0, 0, 0, 0];
    this.skillTargets = [null, null, null, null];
    this.skillManuals = [false, false, false, false];
    // aliases preservam compatibilidade com código e salvamentos da habilidade original.
    Object.defineProperties(this, {
      skillTimer: { get: () => this.skillTimers[0], set: (value) => { this.skillTimers[0] = value; } },
      skillMax: { get: () => this.skillMaxes[0], set: (value) => { this.skillMaxes[0] = value; } },
      auto: { get: () => this.autoSkills[0], set: (value) => { this.autoSkills[0] = value; } },
      wantSkill: { get: () => this.skillRequests[0], set: (value) => { this.skillRequests[0] = value; } },
      manualTarget: { get: () => this.skillTargets[0], set: (value) => { this.skillTargets[0] = value; } },
    });
    this.noTarget = 0;
    this.targetFocus = null;
    this.targetFocusT = 0;
    this.furyT = 0;
    this.guardT = 0;
    this.stanceT = 0;   // provocação do próprio Guardião (a guarda da Clériga não conta)
    this.dodgeTimer = 2;
    this.bladeDanceT = 0;
    this.meditateT = 0;   // Monge: meditação em curso (cura o grupo)
    this.immuneT = 0;     // Monge: imune a dano
    this.stoneT = 0;      // Brutamontes: Pele de pedra ativa
    this.size = this.heroSize();
    this.resetSkillStates();
    this.hpHistory = [];  // Rebobinar do Cronomante: vida a cada 0,5 s
    this.hpSampleT = 0;
    this.age = 0;
    this.hover = cfg.id === 'angel' ? 0.52 : 0;
    for (const relic of game.relics || []) applyRelicToHero(this, relic);
    if (!game.test) this.applyProgress(progress.heroBonus(cfg.id));
    this.aura = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: cfg.color[1], side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthWrite: false }));
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.05;
    this.aura.visible = false;
    this.halo = new THREE.Mesh(haloGeo, goldMat);
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = 2.5;
    this.halo.visible = false;
    this.root.add(this.aura, this.halo);
    const chapterCosmetic = equippedCampaignCosmetic();
    if (chapterCosmetic) {
      const aura = createCampaignAura(THREE, chapterCosmetic);
      this.campaignAura = aura.group;
      this.campaignAuraMaterial = aura.material;
      this.campaignAuraSpin = aura.spin;
      this.root.add(this.campaignAura);
    }
    this.stats = newStats();
    game.roster ||= [];
    game.roster.push(this);
    this.trinkets = [];   // acessórios animados (orbe, estrelinhas, chamas)
    this.root.traverse((o) => { if (o.userData.spin || o.userData.orbit || o.userData.flicker || o.userData.wingFlap) this.trinkets.push(o); });
    this.levelLabel = document.createElement('span');
    this.levelLabel.textContent = 'Nv1';
    this.bar.appendChild(this.levelLabel);
    this.ranged = !!cfg.ranged;
    this.cleave = cfg.cleave || 0;
    this.root.traverse((o) => { if (cfg.hide.includes(o.name)) o.visible = false; });
    this.weaponMaterials();   // guarda o brilho original das armas antes de qualquer piscada
    this.post = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.setAnchor(game.guideS);
    this.pos.copy(this.post);
    this.root.rotation.y = Math.atan2(this.fwd.x, this.fwd.z);
    this.root.rotation.order = 'YXZ';   // a inclinação das habilidades (x) segue a direção do herói
    this.popT = 0;
    this.loop(cfg.idle);
  }

  // maestria e oficina: bônus pequenos de vida/dano e, na maestria máxima, uma aura dourada no chão
  applyProgress(bonus) {
    this.maxHp = this.hp = Math.round(this.maxHp * (1 + bonus.hp));
    this.dmg *= 1 + bonus.dmg;
    if (!bonus.aura) return;
    this.masteryAura = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd44a, side: THREE.DoubleSide, transparent: true, opacity: 0.32, depthWrite: false }));
    this.masteryAura.rotation.x = -Math.PI / 2;
    this.masteryAura.position.y = 0.03;
    this.masteryAura.scale.setScalar(1.35);
    this.root.add(this.masteryAura);
  }

  // escala do corpo: nível (+8% até o Nv3, depois só +3% por nível: Nv5 ≈ 1,22), porte da variante (cfg.scale) e a Pele de pedra
  heroSize() {
    const level = 1 + Math.min(this.level - 1, 2) * 0.08 + Math.max(0, this.level - 3) * 0.03;
    return (this.cfg.scale || 1) * level * (this.stoneT > 0 ? STONE_SKIN.grow : 1);
  }

  gainXp(n) {
    this.xp += n;
    while (this.level < MAX_HERO_LEVEL && this.xp >= XP_LEVELS[this.level]) {
      const oldHp = this.maxHp, oldDmg = this.dmg;
      this.level++;
      const gain = levelGain(this.level);
      this.maxHp = Math.round(this.maxHp * gain);
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp - oldHp);
      this.dmg *= gain;
      evolutions.push({ hero: this, level: this.level, hp: [oldHp, this.maxHp], dmg: [oldDmg, this.dmg] });   // antes → depois, para a tela de evolução
      this.size = this.heroSize();
      this.levelLabel.textContent = 'Nv' + this.level;
      this.levelLabel.title = heroLevelName(this.cfg, this.level);
      this.levelLabel.className = levelTierClass(this.level);
      this.aura.visible = !this.dead;
      this.halo.visible = !this.dead && this.level >= 3;
      for (let slot = 0; slot < this.skillTimers.length; slot++) this.skillTimers[slot] = Math.min(this.skillTimers[slot], 1);
      this.popT = 0;
      audio.play('levelup');
      poof(this.pos, 1.5);
      ring(this.pos, 2, this.cfg.color[0], 1);
      const name = heroLevelName(this.cfg, this.level), tierText = this.level > 3 ? ` · Nv${this.level}` : '';
      popText(this.pos, this.level > 3 ? `Nv${this.level}!` : name + '!', 'evolve');
      showBanner(`⬆\uFE0E ${name}${tierText}`, 2.5);
    }
  }

  useSkill(target, manual = false, force = false, slot = 0) {
    if (slot > 0) return this.useExtraSkill(slot, target, force);
    if (manual && !(slot === 0 && validAim(this, target) || validDirectControlTarget(this, target, slot))) return false;
    const id = this.cfg.id, level = skillLevel(this.level);
    const power = this.skillPower;
    const radius = (3 + (level - 1) * 0.5) * power;
    const attackables = activeTargetContext?.skeletons ?? skeletonsAlive();
    const nearby = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= radius);
    let effect;
    if (id === 'engineer') {
      if (!manual) target ||= bestSkillTarget(this, attackables.filter((enemy) => !enemy.dead && !enemy.spawning && enemy.pos.distanceTo(this.pos) <= 8));
      if (!force && (game.state !== 'fight' || !target)) return false;
      const placement = (manual && target?.groundTarget ? target.pos : target?.pos || this.pos).clone();
      const offset = placement.clone().sub(this.pos).setY(0);
      if (offset.length() > 8) placement.copy(this.pos).add(offset.setLength(8));
      placement.y = world.groundHeight(placement.x, placement.z);
      effect = () => {
        deploySentry(this, placement, 9 + level * 1.5, power);
        popText(placement, 'Torreta!', 'evolve');
        burst(placement, [0x6df4df, 0xe6fffb], 14, 3.5);
      };
    } else if (id === 'beast_tamer') {
      if (!force && (game.state !== 'fight' || !target)) return false;
      effect = () => {
        let companion = units.find((unit) => unit.beastCompanion && unit.summoner === this && !unit.dead);
        if (companion) {
          companion.life = Math.max(companion.life, 13 + level);
          companion.hp = Math.min(companion.maxHp, companion.hp + companion.maxHp * 0.25);
          popText(companion.pos, 'De volta!', 'heal');
        } else companion = new BeastCompanion(this);
        FX.beastCall(this, companion);
      };
    } else if (id === 'illusionist') {
      // cópia ilusória: surge na frente, atrai os golpes dos inimigos próximos (chefes resistem) e some ao levar um golpe
      const near = attackables.filter((s) => !s.dead && !s.spawning && !s.totem && s.pos.distanceTo(this.pos) <= ILLUSION_REACH);
      if (!near.length) return false;
      const threat = near.some((s) => s.pendingHit?.target?.team === 'hero');
      if (!force && (game.state !== 'fight' || (!threat && near.length < 2) || units.some((u) => u.illusion && u.owner === this && u.kind === 'copy' && !u.dead))) return false;
      target = nearest(this.pos, near);
      const aimAt = target.pos.clone();
      effect = () => {
        const image = new Illusion(this, illusionSpot(this, aimAt, 2.4), { kind: 'copy', life: scaleBranchEffect(this, 'control', 5) * power, hits: 1 });
        illusionProvoke(near, image, scaleBranchEffect(this, 'control', 4) * power);
        popText(image.pos, 'Cópia!', 'evolve');
      };
    } else if (id === 'summoner') {
      if (!force && (game.state !== 'fight' || !target)) return false;
      effect = () => callSummon(this, 'fairy');
    } else if (id === 'shaman') {
      // totem de cura: no meio do grupo ferido (ou onde o jogador mirou)
      if (!force && game.state !== 'fight') return false;
      const reach = TOTEM_PLANT_RANGE, party = partyNow().filter((h) => !h.dead);
      let placement;
      if (manual && target?.groundTarget) placement = target.pos.clone();
      else {
        const hurt = party.filter((h) => h.hp / h.maxHp <= 0.85 && h.pos.distanceTo(this.pos) <= reach + 2);
        const crowd = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= 9).length >= 3;
        if (!force && !hurt.length && !crowd) return false;
        const group = hurt.length ? hurt : party.filter((h) => h.pos.distanceTo(this.pos) <= 6);
        placement = new THREE.Vector3();
        for (const h of group) placement.add(h.pos);
        placement.divideScalar(Math.max(1, group.length));
        const offset = placement.clone().sub(this.pos).setY(0);
        if (offset.length() > reach) placement.copy(this.pos).add(offset.setLength(reach));
        if (!force && spiritTotems.some((t) => t.owner === this && t.kind === 'heal' && t.life > 3 && t.root.position.distanceTo(placement) < 2.2)) return false;
      }
      const duration = (7 + level) * power, area = HEAL_TOTEM_RADIUS * power;
      effect = () => {
        plantSpiritTotem(this, placement, 'heal', duration, area);
        popText(placement, 'Totem!', 'evolve');
      };
    } else if (id === 'oracle') {
      const candidates = attackables.filter((enemy) => !enemy.dead && !enemy.spawning && enemy.pos.distanceTo(this.pos) <= this.range);
      if (!manual) target = candidates.find((enemy) => enemy.telegraph?.interruptible && enemy.telegraph.t > 0)
        || highestPriorityHeroTarget(this, candidates);
      if (!target || target.pos.distanceTo(this.pos) > this.range) return false;
      effect = () => fireBolt(this, target, 'oracle', 0, true);
    } else if (id === 'paladin') {
      const reach = (5 + level) * power;
      const friends = partyNow().filter((h) => !h.dead && h.hp < h.maxHp && h.pos.distanceTo(this.pos) <= reach);
      const healAmount = scaleBranchEffect(this, 'support', 32 + level * 10) * power;
      const missing = friends.reduce((sum, h) => sum + h.maxHp - h.hp, 0);
      const urgent = friends.some((h) => h.hp / h.maxHp <= 0.55);
      if (!friends.length || (!force && !urgent && missing < healAmount * 0.75)) return false;
      effect = () => {
        const healed = [];
        for (const h of friends) if (!h.dead && h.pos.distanceTo(this.pos) <= reach) {
          const heal = Math.min(h.maxHp - h.hp, healAmount * synergyHealMultiplier(id, h));
          h.hp += heal;
          this.stats.cura += heal;
          healed.push(h);
          popText(h.pos, '+' + Math.round(heal), 'heal');
        }
        for (const s of nearby) if (!s.dead) heroHit(this, s, this.dmg * 0.45);   // a luz sagrada também fere quem está colado no paladino
        FX.holyLight(this, healed, reach);
      };
    } else if (id === 'cleric') {
      const reach = (5.5 + level * 0.35) * power;
      const friends = partyNow().filter((h) => !h.dead && h.pos.distanceTo(this.pos) <= reach);
      const wounded = friends.filter((h) => h.hp < h.maxHp);
      const healAmount = scaleBranchEffect(this, 'support', 24 + level * 8) * power;
      const missing = wounded.reduce((sum, h) => sum + h.maxHp - h.hp, 0);
      const urgent = wounded.some((h) => h.hp / h.maxHp <= 0.6);
      if (!friends.length || (!force && !urgent && missing < healAmount * 0.75)) return false;
      effect = () => {
        const healed = [];
        const protection = scaleBranchEffect(this, 'control', 2.5 + (level - 1) * 0.4) * power;
        for (const h of friends) {
          h.guardT = Math.max(h.guardT, protection);
          const heal = Math.min(h.maxHp - h.hp, healAmount * synergyHealMultiplier(id, h));
          if (heal > 0) { h.hp += heal; this.stats.cura += heal; healed.push(h); popText(h.pos, '+' + Math.round(heal), 'heal'); }
        }
        this.guardT = Math.max(this.guardT, protection);
        FX.holyLight(this, healed, reach);
        FX.dome(this, reach * 0.72);
      };
    } else if (id === 'bard') {
      // Carta Marcada: a carta fere o alvo e o naipe sorteado dá um efeito (♥ cura, ♠ dano extra, ♦ lentidão, ♣ velocidade de ataque)
      if (!target || target.dead || target.groundTarget) return false;
      if (!manual && !force && !this.inReach(target, target.pos.distanceTo(this.pos) - 0.4 * ((target.size || 1) - 1))) return false;
      effect = () => {
        if (target.dead) return;
        const index = Math.floor(Math.random() * 4), suit = BARD_SUITS[index];
        FX.cardThrow(this, target.pos, suit.face);
        heroHit(this, target, this.dmg * 1.3 * power);
        bardSuit(this, target, index);
        popText(target.pos, `${suit.mark} ${suit.name}`, 'crit');
      };
    } else if (id === 'angel') {
      if (!target) return false;
      const reach = 5.5;
      effect = () => {
        const center = target.pos.clone();
        const healed = [];
        for (const h of partyNow()) if (!h.dead && h.pos.distanceTo(this.pos) <= reach) {
          const heal = Math.min(h.maxHp - h.hp, scaleBranchEffect(this, 'support', 18 + level * 5) * power);
          if (heal > 0) { h.hp += heal; this.stats.cura += heal; healed.push(h); popText(h.pos, '+' + Math.round(heal), 'heal'); }
        }
        for (const enemy of skeletonsAlive()) if (!enemy.spawning && enemy.pos.distanceTo(center) <= radius + 1.6 * (enemy.size - 1)) {
          heroHit(this, enemy, this.dmg * (0.9 + level * 0.08) * power, center);
          enemy.vel.add(new THREE.Vector3(0, 0.7, 0));
        }
        FX.rays(center, 'holy', 0.8, 6, 0.9, { opacity: 0.75 });
        wave(center, 0xfff4bd, 0.3, radius, 0.7, { opacity: 0.55 });
        burst(center, [0xffe27a, 0xffc6ed], 18, 5);
        FX.holyLight(this, healed, reach);
      };
    } else if (id === 'chronist') {
      // o campo abre sobre o alvo dentro do alcance (o Cronomante é atirador e quase nunca tem inimigo colado)
      if (!manual || !target) target = bestSkillTarget(this, attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= this.range));
      if (!target || target.pos.distanceTo(this.pos) > this.range) return false;
      const fieldAt = target.pos.clone();
      const caught = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(fieldAt) <= radius + 0.4 * (s.size - 1));
      const urgent = caught.some((s) => isUrgentEnemy(s));
      if (!force && caught.length < 2 && !urgent) return false;
      effect = () => {
        const duration = scaleBranchEffect(this, 'control', 2.3 + (level - 1) * 0.35) * power;
        for (const enemy of caught) if (!enemy.dead) {
          if (controlEnemy(enemy, 'rootT', duration)) enemy.pendingHit = null;
          enemy.vel.set(0, 0, 0);
          heroHit(this, enemy, this.dmg * 0.55 * power);
          FX.stasis(enemy);   // tempo parado, não raízes
        }
        wave(fieldAt, 0x8feaff, 0.2, radius, 0.8);
        burst(fieldAt, [0x8feaff, 0xb6a4ff, 0xffffff], 22, 3.5);
        FX.zigzag(this.pos, fieldAt, 0.15);
      };
    } else if (id === 'brute') {
      // Pancada: onda curta em volta que atordoa por instantes e provoca quem foi atingido (chefe fica zonzo pela metade)
      const reach = (2.6 + (level - 1) * 0.3) * power;
      const inReach = (s) => s.pos.distanceTo(this.pos) <= reach + 0.4 * (s.size - 1) && Math.abs(s.pos.y - this.pos.y) < 0.85;
      const caught = nearby.filter(inReach);
      const urgent = caught.some((s) => isUrgentEnemy(s));
      if (!caught.length || (!force && caught.length < 2 && !urgent)) return false;
      target = nearest(this.pos, caught);
      effect = () => {
        const stun = scaleBranchEffect(this, 'control', 0.7 + (level - 1) * 0.1) * power;
        for (const s of skeletonsAlive()) if (!s.spawning && inReach(s)) {
          heroHit(this, s, this.dmg * 0.5);
          s.stunT = Math.max(s.stunT || 0, s.boss ? stun * 0.5 : stun);
          s.pendingHit = null;
          s.taunt = this;
          s.tauntT = Math.max(s.tauntT || 0, stun + 2.5 * power);
        }
        FX.quake(this, reach * 0.8);
        wave(this.pos, 0xc9bba2, 0.3, reach, 0.5);
      };
    } else if (id === 'lancer') {
      // Estocada: golpe reto à frente; fere toda a fila e empurra os dois da frente (chefe quase não sai do lugar)
      const reach = (4.2 + (level - 1) * 0.3) * (0.9 + 0.1 * power);
      const flat = (s) => !s.dead && !s.spawning && Math.abs(s.pos.y - this.pos.y) < 0.85;
      const pool = attackables.filter((s) => flat(s) && s.pos.distanceTo(this.pos) <= reach);
      let line = [];
      if (manual && target && pool.includes(target)) line = lineTargets(this.pos, target.pos, pool, reach, 0.8);
      else {
        let most = 0;
        target = null;
        for (const s of pool) {
          const hits = lineTargets(this.pos, s.pos, pool, reach, 0.8), score = hits.length + (s.boss ? 0.5 : 0);
          if (score > most) { most = score; line = hits; target = s; }
        }
      }
      const urgent = line.some((s) => isUrgentEnemy(s));
      if (!target || (!force && line.length < 2 && !urgent)) return false;
      effect = () => {
        const from = this.pos.clone(), dir = new THREE.Vector3().subVectors(target.pos, from).setY(0);
        if (dir.lengthSq() < 0.01) dir.copy(this.fwd);
        dir.normalize();
        const end = from.clone().addScaledVector(dir, reach);
        const hits = lineTargets(from, end, skeletonsAlive().filter((s) => flat(s)), reach, 0.8)
          .sort((a, b) => a.pos.distanceToSquared(from) - b.pos.distanceToSquared(from));
        hits.forEach((s, i) => {
          heroHit(this, s, this.dmg * 1.15 * power);
          if (i < 2) s.vel.addScaledVector(dir, s.boss ? 1.5 : 7);
        });
        FX.lanceThrust(this, dir, reach);
      };
    } else if (id === 'guardian') {
      if (!nearby.length) return false;
      effect = () => {
        this.guardT = this.stanceT = scaleBranchEffect(this, 'control', 4 + (level - 1)) * power;
        for (const s of nearby) if (!s.dead) { s.taunt = this; s.tauntT = this.guardT; s.pendingHit = null; popText(s.pos, '!', 'crit'); }
        for (const s of nearby) if (!s.dead) heroHit(this, s, this.dmg * 0.6);   // pancada de escudo: dano moderado, o foco segue na provocação
        FX.dome(this, radius);
      };
    } else if (id === 'champion' || id === 'crusher') {
      if (manual && id === 'crusher') this.face(target.pos, 1);
      const skillTargets = nearby.filter((s) => id === 'champion' || inMeleeArc(this, s, 2.2 * power));
      const urgent = skillTargets.some((s) => isUrgentEnemy(s));
      if (!skillTargets.length || (!force && skillTargets.length < 2 && !urgent)) return false;
      if (id === 'crusher') this.vel.add(tmp.subVectors(target ? target.pos : this.pos, this.pos).setY(0).normalize().multiplyScalar(2.5));   // salta para a frente
      effect = () => {
        for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(this.pos) <= radius) {
          if (id === 'crusher' && !inMeleeArc(this, s, 2.2 * power)) continue;
          heroHit(this, s, this.dmg * 1.1);
          if (id === 'champion') s.vel.add(new THREE.Vector3().subVectors(s.pos, this.pos).setY(0).normalize().multiplyScalar(6 + level));
          else { if (controlEnemy(s, 'stunT', scaleBranchEffect(this, 'control', 1.5 + (level - 1) * 0.25) * power)) s.pendingHit = null; s.vel.set(0, 0, 0); }
        }
        if (id === 'champion') FX.whirl(this, radius);
        else FX.quake(this, 2.2 * power);
      };
    } else if (id === 'berserker') {
      if (!nearby.length) return false;
      effect = () => {
        this.furyT = (5 + (level - 1)) * power;
        popText(this.pos, 'Fúria!', 'crit');
        FX.fury(this);
      };
    } else if (id === 'assassin') {
      // salta pelas sombras até as costas do alvo e crava as adagas
      if (!manual) target = highestPriorityHeroTarget(this, attackables.filter((s) => !s.dead && !s.spawning
        && s.pos.distanceTo(this.pos) < 7 && Math.abs(s.pos.y - this.pos.y) < 0.85));
      if (!target) return false;
      effect = () => {
        if (target.dead) target = nearest(this.pos, attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) < 7 && Math.abs(s.pos.y - this.pos.y) < 0.85));   // o alvo caiu durante o preparo: salta no mais próximo
        if (!target) return;
        const from = this.pos.clone(), dir = tmp.subVectors(target.pos, this.pos).setY(0).normalize();
        const behind = target.pos.clone().addScaledVector(dir, 0.6 + 0.4 * target.size);
        const dest = world.canStep(target.pos, behind) ? behind : target.pos.clone().addScaledVector(dir, -(0.6 + 0.4 * target.size));
        this.pos.copy(dest).setY(world.groundHeight(dest.x, dest.z));
        this.vel.set(0, 0, 0);
        FX.shadowStep(from, this.pos);
        this.face(target.pos, 1);
        this.busy = this.once('Dualwield_Melee_Attack_Stab', 1.6);
        this.pendingHit = { target, t: this.busy * 0.35, effect: () => {
          if (!target.dead) heroHit(this, target, this.dmg * 2.2 * power);
          FX.slashX(target, this);
          audio.play('sword');
        } };
      };
    } else if (id === 'duelist') {
      // rajada: quatro cortes seguidos no alvo à frente, alternando a lâmina de cada mão
      const reach = (s) => this.range + 0.9 + 0.4 * (s.size - 1);
      if (!manual) target = highestPriorityHeroTarget(this, attackables.filter((s) => !s.dead && !s.spawning
        && s.pos.distanceTo(this.pos) <= reach(s) && Math.abs(s.pos.y - this.pos.y) < 0.85));
      if (!target || target.pos.distanceTo(this.pos) > reach(target)) return false;
      effect = () => {
        const cut = (i) => {
          if (target.dead) return;
          this.face(target.pos, 1);
          heroHit(this, target, this.dmg * (0.6 + 0.05 * (level - 1)) * power);
          FX.bladeCut(target, this, i % 2 ? 1 : -1);
          if (i > 0) audio.play('sword');
          if (i >= 3) return;
          this.busy = this.once(i % 2 ? 'Dualwield_Melee_Attack_Slice' : 'Dualwield_Melee_Attack_Chop', 2.8);
          this.pendingHit = { target, t: this.busy * 0.35, effect: () => cut(i + 1) };
        };
        cut(0);
      };
    } else if (id === 'monk') {
      // cem punhos: quatro socos rápidos alternando as mãos e um chute que atordoa e empurra
      const reach = (s) => this.range + 0.9 + 0.4 * (s.size - 1);
      if (!manual) target = highestPriorityHeroTarget(this, attackables.filter((s) => !s.dead && !s.spawning
        && s.pos.distanceTo(this.pos) <= reach(s) && Math.abs(s.pos.y - this.pos.y) < 0.85));
      if (!target || target.pos.distanceTo(this.pos) > reach(target)) return false;
      effect = () => {
        const blow = (i) => {
          if (target.dead) return;
          this.face(target.pos, 1);
          const kick = i >= 4;
          heroHit(this, target, this.dmg * (kick ? 1.3 : 0.6) * power);
          FX.palmHit(target, this, kick);
          if (i > 0) audio.play('hit');
          if (kick) {
            if (controlEnemy(target, 'stunT', scaleBranchEffect(this, 'control', 0.8) * power)) target.pendingHit = null;
            target.vel.add(tmp.subVectors(target.pos, this.pos).setY(0).normalize().multiplyScalar(target.boss ? 1 : 4));
            return;
          }
          this.busy = this.once(i === 3 ? 'Unarmed_Melee_Attack_Kick' : i % 2 ? 'Unarmed_Melee_Attack_Punch_A' : 'Unarmed_Melee_Attack_Punch_B', i === 3 ? 2 : 3.2);
          this.pendingHit = { target, t: this.busy * 0.4, effect: () => blow(i + 1) };
        };
        blow(0);
      };
    } else if (id === 'archer') {
      // flecha longa: mira a linha com mais inimigos e atravessa todos, bem além do alcance comum
      const reach = 11;
      if (!manual) {
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= reach);
        let most = 0;
        target = null;
        for (const s of pool) {
          const n = lineTargets(this.pos, s.pos, pool, reach + 4, 0.55).length + (s.boss ? 0.5 : 0);
          if (n > most) { most = n; target = s; }
        }
      }
      if (!target || target.pos.distanceTo(this.pos) > reach) return false;
      effect = () => fireBolt(this, target, 'archer', 0, true);
    } else if (id === 'geomancer') {
      // espinhos de pedra: mira a linha com mais inimigos à frente; ferem e atordoam de leve quem está no caminho
      const reach = 7;
      if (!manual) {
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= reach);
        let most = 0;
        target = null;
        for (const s of pool) {
          const n = lineTargets(this.pos, s.pos, pool, reach, 0.8).length + (s.boss ? 0.5 : 0);
          if (n > most) { most = n; target = s; }
        }
      }
      if (!target || target.pos.distanceTo(this.pos) > reach) return false;
      effect = () => geoSpikes(this, target.dead ? this.pos.clone().addScaledVector(this.fwd, 2) : target.pos, reach, this.dmg * power);
    } else if (id === 'alchemist') {
      // frasco: tônico na poça de quem está ferido; sem ferido, veneno no grupo de inimigos
      const reach = this.range + 1;
      let kind = 'flask';
      if (!manual) {
        const hurt = partyNow().filter((h) => !h.dead && h.pos.distanceTo(this.pos) <= reach && h.hp / h.maxHp <= 0.7)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        if (hurt.length) { target = hurt[0]; kind = 'tonic'; }
        else target = bestSkillTarget(this, attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= reach));
      }
      if (!target || target.pos.distanceTo(this.pos) > reach) return false;
      effect = () => fireBolt(this, target, kind, 0, true);
    } else if (id === 'cook') {
      // torta quente: cai onde o grupo precisa (ferido ou brigando) e deixa um ensopado que cura e anima
      const reach = this.range + 1;
      if (!manual) {
        const near = partyNow().filter((h) => !h.dead && h.pos.distanceTo(this.pos) <= reach);
        target = near.filter((h) => h.hp / h.maxHp <= 0.8).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
          || near.find((h) => h.engagedWith && !h.engagedWith.dead);
      }
      if (!target || target.pos.distanceTo(this.pos) > reach) return false;
      effect = () => cookPool(this, target.pos.clone());
    } else if (id === 'runic') {
      // runa-escudo no aliado mais ferido que ainda não tem uma; ao quebrar, cura um pouco e empurra quem está colado
      if (!force && game.state !== 'fight') return false;
      const ally = partyNow().filter((h) => !h.dead && !(h.runeHp > 0) && h.pos.distanceTo(this.pos) <= this.range + 2)
        .reduce((best, h) => (!best || h.hp / h.maxHp < best.hp / best.maxHp ? h : best), null);
      if (!ally) return false;
      if (!force && !attackables.some((s) => !s.dead && !s.spawning && s.pos.distanceTo(ally.pos) <= 9)) return false;
      target = ally;
      effect = () => {
        if (ally.dead) return;
        runeShieldOn(ally, this, scaleBranchEffect(this, 'support', 22 + level * 6) * power, 8, scaleBranchEffect(this, 'support', 6 + level * 2) * power, true);
        popText(ally.pos, 'Runa!', 'heal');
      };
    } else if (id === 'viking' || id === 'iceviking') {
      if (!manual) target = highestPriorityHeroTarget(this, attackables.filter((s) => !s.dead && !s.spawning
        && s.pos.distanceTo(this.pos) > 2 && s.pos.distanceTo(this.pos) < 9));
      if (!target) return false;
      effect = () => fireBolt(this, target, id, 0, true);
    } else if (id === 'arcane') {
      if (!target || target.pos.distanceTo(this.pos) > this.range) return false;
      effect = () => {
        let at = this.pos;
        const hit = new Set();
        let next = target;
        for (let i = 0; i < Math.round((3 + (level - 1)) * power); i++) {
          if (!next || next.dead) break;
          FX.zigzag(at, next.pos, i * 0.055);
          hit.add(next);
          heroHit(this, next, this.dmg * 0.9);
          at = next.pos;
          next = highestPriorityHeroTarget(this, skeletonsAlive().filter((s) => !s.spawning && !hit.has(s) && s.pos.distanceTo(at) < 4 + level), at);
        }
      };
    } else if (id === 'pyro' || id === 'cryo' || id === 'crossbow' || id === 'ninja') {
      if (!manual) {
        const reach = id === 'ninja' ? 7 : this.range;
        target = bestSkillTarget(this, skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) <= reach));
      }
      if (!target || target.pos.distanceTo(this.pos) > (id === 'ninja' ? 7 : this.range)) return false;
      effect = () => {
        if (id === 'ninja') for (const angle of [-0.22, 0, 0.22]) fireBolt(this, target, id, angle, true);
        else fireBolt(this, target, id, 0, true);
        if (id === 'cryo') FX.iceFan(this, target);
      };
    } else if (id === 'king') {
      if (!target) return false;
      if (!manual && !force && !this.inReach(target, target.pos.distanceTo(this.pos) - 0.4 * ((target.size || 1) - 1))) return false;
      effect = () => {
        const party = partyNow().filter((h) => !h.dead);
        for (const h of party) {
          h.royalT = Math.max(h.royalT, 5 * power);   // não encurta nem enfraquece um hino mais forte
          h.royalBonus = Math.max(h.royalBonus, 0.2);
        }
        popText(this.pos, 'Brado!', 'evolve');
        FX.royal(this, party);
      };
    } else if (id === 'necro') {
      if (!target) return false;
      effect = () => {
        for (const u of units.filter((u) => u.summoner === this && !u.ultimate)) { poof(u.pos); u.remove(); }   // o exército da ultimate fica
        FX.summon(this, [-1, 1].map((side) => new Minion(this, side)));
      };
    } else if (id === 'druid') {
      const friends = partyNow().filter((h) => !h.dead && h.hp < h.maxHp && h.pos.distanceTo(this.pos) <= radius);
      const missing = friends.reduce((sum, h) => sum + h.maxHp - h.hp, 0);
      const healAmount = scaleBranchEffect(this, 'support', 20) * power;
      const urgentHeal = friends.some((h) => h.hp / h.maxHp <= 0.6) || missing >= healAmount * 0.75;
      const valuableControl = nearby.length >= 2 || nearby.some((s) => isUrgentEnemy(s));
      if (!friends.length && !nearby.length) return false;
      if (!force && !urgentHeal && !valuableControl) return false;
      effect = () => {
        for (const enemy of skeletonsAlive()) if (!enemy.spawning && enemy.pos.distanceTo(this.pos) <= radius) {
          controlEnemy(enemy, 'rootT', scaleBranchEffect(this, 'control', 1.5) * power);
          enemy.vel.set(0, 0, 0);
          FX.roots(enemy);
        }
        for (const h of partyNow()) if (!h.dead && h.pos.distanceTo(this.pos) <= radius) {
          const heal = Math.min(h.maxHp - h.hp, healAmount);
          h.hp += heal;
          this.stats.cura += heal;
          if (heal > 0) popText(h.pos, '+' + Math.round(heal), 'heal');
        }
        FX.leaves(this, radius);
      };
    } else if (id === 'vampire') {
      // garra de sangue: rasga o cone à frente; 60% do dano causado vira vida no aliado mais ferido
      const reach = 4 * (0.9 + 0.1 * power);
      const inClaw = (s) => !s.dead && !s.spawning && Math.abs(s.pos.y - this.pos.y) < 0.85 && s.pos.distanceTo(this.pos) <= reach + 0.4 * (s.size - 1);
      if (!manual) target = highestPriorityHeroTarget(this, attackables.filter(inClaw));
      if (!target || !inClaw(target)) return false;
      effect = () => {
        this.vampFrac = 0.6;
        let first = null;
        for (const s of skeletonsAlive()) if (inClaw(s) && inMeleeArc(this, s, reach + 0.4 * (s.size - 1))) {
          heroHit(this, s, this.dmg * 1.1 * power);
          FX.bladeCut(s, this, first ? 1 : -1);
          first ||= s;
        }
        this.vampFrac = 0;
        if (!first && !target.dead) { this.vampFrac = 0.6; heroHit(this, target, this.dmg * 1.1 * power); this.vampFrac = 0; FX.bladeCut(target, this, 0); }
        burst(this.pos, [0xa81c34, 0x3a0a14], 8, 2.5);
      };
    } else return false;
    const [, pace, at, sound] = SKILL_MOVES[id];
    const run = effect;
    effect = () => { audio.play(sound); FX.release(this); run(); this.fireEcho(null); };
    if (id === 'brute' && target && target.pos.distanceTo(this.pos) > this.range + 0.4 * (target.size || 1)) this.skillAdvanceTarget = target;
    this.face(target ? target.pos : this.pos.clone().add(this.fwd), 1);
    this.busy = this.skillBody(0, pace);
    this.pendingHit = { target, effect, t: this.busy * at };
    FX.charge(this, this.pendingHit.t);
    this.skillTimers[0] = this.skillMaxes[0] = cooldownForSkill(this.cfg, 0, level, this.skillRate);
    relicAfterCast(this, 0, false);
    passiveHook(this, 'onCast', 0);
    this.stats.habilidades++;
    return true;
  }

  useExtraSkill(slot, target, force = false) {
    const skill = skillSetFor(this.cfg)[slot];
    if (!skill || slot < 1) return false;
    const level = skillLevel(this.level), power = this.skillPower;
    const color = skill.color || this.cfg.color[0];
    const radius = (skill.radius || (slot === 2 ? 6 : 4.5)) * (0.9 + 0.1 * power);
    const attackables = activeTargetContext?.skeletons ?? skeletonsAlive();
    const partySource = partyNow();
    const enemies = [], targetPool = [];
    const targetReach = Math.max(9, this.range);
    const enemyReach = skill.effect === 'meteor' ? targetReach : Math.max(radius, skill.range || 0);
    for (const enemy of attackables) {
      if (enemy.dead || enemy.spawning) continue;
      const distance = enemy.pos.distanceTo(this.pos);
      if (distance <= enemyReach + 0.4 * (enemy.size - 1)) enemies.push(enemy);
      if (distance <= targetReach + (skill.effect === 'meteor' ? 0.4 * (enemy.size - 1) : 0)) targetPool.push(enemy);
    }
    const party = partySource.filter((h) => !h.dead);
    const friends = party.filter((h) => h.pos.distanceTo(this.pos) <= Math.max(radius, 5.5));
    const wounded = friends.filter((h) => h.hp < h.maxHp);
    const missingHp = wounded.reduce((sum, h) => sum + h.maxHp - h.hp, 0);
    const criticalAlly = friends.some((h) => h.hp / h.maxHp <= 0.42);
    const urgentEnemy = enemies.some((s) => isUrgentEnemy(s, true));
    target ||= highestPriorityHeroTarget(this, targetPool);
    if (target && !target.groundTarget && (target.dead || !units.includes(target))) target = null;
    if (skill.effect === 'meteor' && !target) target = highestPriorityHeroTarget(this, targetPool);
    const meteorImpactAt = skill.effect === 'meteor' ? target?.pos?.clone() || this.pos.clone() : null;

    // Decreto de Marcha: vale no começo da onda ou quando alguém está longe do posto, com ou sem inimigos por perto
    const marchWanted = skill.effect === 'march-decree' && game.state === 'fight' && !(this.marchT > 1)
      && (game.runTime - (game.phaseAt ?? -99) < 8 || party.some((h) => h.pos.distanceTo(h.post) > 8));
    const fallenAlly = skill.effect === 'ancestral-totem' && partySource.some((h) => h.dead && h !== this);
    const supportSkill = ['ward', 'holy-nova', 'light-legion', 'loaded-dice', 'bluff', 'bastion', 'rally', 'frost-ward', 'roots-heal', 'nature-storm', 'meditate',
      'sentry-overcharge', 'pack-roar', 'stone-skin', 'stone-golem', 'little-dragon', 'feast', 'ancestral-totem', 'mirror-hall', 'mirror-swap', 'mirage'].includes(skill.effect);
    if (!force && slot === 2 && LADINO_ULTS.has(skill.effect)) {   // ultimates dos Ladinos: área exige 3 inimigos juntos ou chefe/elite; alvo único, chefe/elite (ou 4 por perto)
      const big = enemies.some((s) => s.boss || s.elite || s.kind?.priority);
      if (!big && (LADINO_ULTS.get(skill.effect) === 'area' ? densest(enemies, radius).count < 3 : enemies.length < 4)) return false;
    }
    if (!force && slot === 2 && !urgentEnemy && enemies.length < (supportSkill ? 2 : 3) && !criticalAlly && !fallenAlly && missingHp < this.maxHp * 0.3) return false;
    const ownSentry = sentries.find((item) => item.owner === this);
    const ownBeast = units.find((unit) => unit.beastCompanion && unit.summoner === this && !unit.dead);
    if (!force && slot !== 2 && !enemies.length && !criticalAlly && missingHp < this.maxHp * 0.35
      && !(skill.effect === 'sentry-overcharge' && ownSentry) && !marchWanted) return false;
    if (!force && skill.effect === 'summon' && !urgentEnemy && units.filter((u) => u.summoner === this && !u.dead).length >= 4) return false;
    if (!force && skill.effect === 'light-legion' && (units.some((u) => u.lightKnight && u.summoner === this && !u.dead) || enemies.length < 3 && !friends.some((h) => h.hp < h.maxHp * 0.5))) return false;
    const needsTarget = ['charge', 'volley', 'execute', 'shadow', 'chain', 'emp-pulse'].includes(skill.effect);
    if (needsTarget && !target) return false;
    const areaEffects = ['burst', 'storm', 'blizzard', 'meteor', 'volley-storm', 'arrow-rain', 'shadow-storm', 'holy-nova', 'nature-storm', 'roots-heal'];
    const canRestoreAllies = SKILLS_USEFUL_WITHOUT_ENEMIES.has(skill.effect)
      && (missingHp > 0 || this.hp < this.maxHp || fallenAlly);
    if (!force && !enemies.length && !canRestoreAllies && !marchWanted) return false;
    if (areaEffects.includes(skill.effect) && !enemies.length && !(supportSkill && (criticalAlly || missingHp > this.maxHp * 0.35))) return false;

    const damageOne = (enemy, multiplier = 1) => {
      if (enemy && !enemy.dead) heroHit(this, enemy, this.dmg * power * (skill.power || 1) * multiplier);
    };
    const control = (enemy) => {
      if (!enemy || enemy.dead) return;
      const controlType = skill.control || (['blizzard', 'roots-heal', 'nature-storm'].includes(skill.effect) ? 'root' : null);
      if (controlType === 'stun' && controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', 1.35 + (level - 1) * 0.2) * power)) enemy.pendingHit = null;
      if (controlType === 'root' && controlEnemy(enemy, 'rootT', scaleBranchEffect(this, 'control', skill.duration || 2.8) * power)) enemy.pendingHit = null;
      if (controlType === 'slow') controlEnemy(enemy, 'slowT', scaleBranchEffect(this, 'control', skill.duration || 3.5) * power);
      if (controlType === 'burn') {
        enemy.burnT = Math.max(enemy.burnT || 0, scaleBranchEffect(this, 'control', skill.duration || 3.2) * power);
        enemy.burnTick = Math.min(enemy.burnTick || 0.5, 0.35);
        enemy.burnDmg = Math.max(enemy.burnDmg || 0, this.dmg * power * (skill.power || 1) * 0.08);
        enemy.burnOwner = this;
        column(enemy.pos, color, 0.35, 2.2, 0.55, { follow: enemy });
      }
      if (skill.control === 'push') enemy.vel.add(new THREE.Vector3().subVectors(enemy.pos, this.pos).setY(0).normalize().multiplyScalar(5));
      if (skill.effect === 'bastion') { enemy.taunt = this; enemy.tauntT = skill.duration * power; enemy.pendingHit = null; }
    };
    const healFriends = (amount, reach = radius) => {
      const healed = [];
      for (const h of party) if (h.pos.distanceTo(this.pos) <= reach) {
        const heal = Math.min(h.maxHp - h.hp, amount);
        if (heal > 0) { h.hp += heal; this.stats.cura += heal; healed.push(h); popText(h.pos, '+' + Math.round(heal), 'heal'); }
      }
      return healed;
    };
    const damageAreaNow = (multiplier = 1) => {
      for (const enemy of enemies) { damageOne(enemy, multiplier); control(enemy); }
    };
    const damageAreaAt = (center, reach, multiplier = 1) => {
      for (const enemy of skeletonsAlive()) {
        if (!enemy.dead && !enemy.spawning && enemy.pos.distanceTo(center) <= reach + 0.4 * (enemy.size - 1)) {
          damageOne(enemy, multiplier);
          control(enemy);
        }
      }
    };
    let effect;
    switch (skill.effect) {
      case 'emp-pulse': {
        if (!target || target.team !== 'skeleton') return false;
        const center = target.pos.clone();
        const caught = attackables.filter((enemy) => !enemy.dead && !enemy.spawning && enemy.pos.distanceTo(center) <= radius + 0.35 * (enemy.size - 1));
        if (!caught.length) return false;
        effect = () => {
          for (const enemy of caught) {
            damageOne(enemy);
            if (controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', 1.1 + (level - 1) * 0.15) * power)) enemy.pendingHit = null;
          }
          FX.zigzag(this.pos.clone().setY(this.pos.y + 1.2), center.clone().setY(center.y + 0.7));
          wave(center, color, 0.25, radius, 0.65);
          burst(center, [color, 0xe6fffb, 0xffffff], 22, 5);
        };
        break;
      }
      case 'sentry-overcharge': {
        effect = () => {
          const sentry = ownSentry || deploySentry(this, this.pos, 9 + level, power);
          sentry.life = Math.max(sentry.life, skill.duration || 8);
          sentry.boostT = Math.max(sentry.boostT, skill.duration || 8);
          const center = sentry.root.position.clone();
          for (const enemy of attackables) if (!enemy.dead && !enemy.spawning && enemy.pos.distanceTo(center) <= radius) {
            damageOne(enemy, 0.75);
            if (controlEnemy(enemy, 'stunT', 0.45 * power)) enemy.pendingHit = null;
          }
          wave(center, color, 0.25, radius, 0.8);
          burst(center.clone().setY(center.y + 0.8), [color, 0xe6fffb, 0xffffff], 28, 5);
        };
        break;
      }
      case 'golden-judgment': {
        // Julgamento Dourado: marca todos em volta e, após um instante, uma coluna de luz cai sobre cada um (atordoa comuns; chefe só fica lento)
        const marked = enemies.filter((e) => !e.dead);
        if (!marked.length) return false;
        const wait = skill.duration || 0.9;
        effect = () => {
          for (const enemy of marked) FX.judgmentMark(enemy, wait);
          wave(this.pos, color, 0.3, radius, 0.6, { opacity: 0.4 });
          popText(this.pos, 'Julgamento!', 'evolve');
          FX.later(wait, () => {
            if (game.over) return;
            for (const enemy of marked) {
              if (enemy.dead) continue;
              damageOne(enemy);
              if (enemy.boss || enemy.totem) controlEnemy(enemy, 'slowT', scaleBranchEffect(this, 'control', 2.5) * power);
              else if (controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', 1.4 + (level - 1) * 0.2) * power)) enemy.pendingHit = null;
              FX.judgmentStrike(enemy.pos.clone(), Math.min(1.6, enemy.size));
            }
            FX.shake(0.35);
          });
        };
        break;
      }
      case 'titan-fury': {
        // Fúria Titânica: furacão de golpes ao redor do Berserker; cura pelos golpes e ninguém o empurra
        if (!force && !enemies.length) return false;
        effect = () => {
          const seconds = (skill.duration || 6) * (0.9 + 0.1 * power);
          this.titanT = seconds; this.titanTick = 0; this.titanReach = radius; this.titanPower = skill.power || 0.4;
          this.leechT = Math.max(this.leechT, seconds); this.leech = skill.leech || 0.25;
          this.furyT = Math.max(this.furyT, seconds);
          popText(this.pos, 'Fúria!', 'crit');
          FX.fury(this);
        };
        break;
      }
      case 'cataclysm': {
        // Cataclismo: ruptura que atordoa a área e, 1 s depois, um tremor secundário que fere e atordoa de novo
        if (!enemies.length) return false;
        effect = () => {
          const strike = (stun) => {
            for (const enemy of skeletonsAlive()) {
              if (enemy.dead || enemy.spawning || enemy.pos.distanceTo(this.pos) > radius + 0.4 * (enemy.size - 1)) continue;
              damageOne(enemy);
              if (enemy.boss || enemy.totem) controlEnemy(enemy, 'slowT', scaleBranchEffect(this, 'control', 2) * power);
              else if (controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', stun) * power)) enemy.pendingHit = null;
            }
            FX.quake(this, radius * 0.5);
            wave(this.pos, color, 0.3, radius, 0.6, { opacity: 0.45 });
          };
          strike(1.2 + (level - 1) * 0.15);
          FX.later(skill.duration || 1, () => { if (!game.over) { strike(0.9); FX.shake(0.4); } });
        };
        break;
      }
      case 'pack-roar': {
        const companion = ownBeast;
        const center = (companion || this).pos;
        const caught = attackables.filter((enemy) => !enemy.dead && !enemy.spawning && enemy.pos.distanceTo(center) <= radius);
        effect = () => {
          const protector = companion || this;
          companion?.howl();   // o rugido sai da fera
          for (const enemy of caught) { enemy.taunt = protector; enemy.tauntT = (skill.duration || 4) * power; enemy.pendingHit = null; }
          for (const ally of party) if (ally.pos.distanceTo(center) <= radius) ally.guardT = Math.max(ally.guardT, 2.5 * power);
          wave(center, color, 0.25, radius, 0.75);
          burst(center.clone().setY(center.y + 0.8), [color, 0xffe6a1, 0xffffff], 24, 4.5);
          popText(center, 'Matilha!', 'evolve');
        };
        break;
      }
      case 'pack-hunt': {
        // Caçada em Matilha: por 8 s a fera persegue o inimigo mais perigoso com +50% de velocidade e dano, e cada mordida faz o alvo sangrar (ver BeastCompanion.update); sem fera, ela é chamada
        if (!enemies.length || (!force && !enemies.some(isPriorityEnemy) && enemies.length < 3)) return false;
        effect = () => {
          const fresh = !ownBeast;
          const companion = ownBeast || new BeastCompanion(this);
          const seconds = scaleBranchEffect(this, 'support', skill.duration || 8) * power;
          companion.life = Math.max(companion.life, seconds);
          companion.empowerT = Math.max(companion.empowerT || 0, seconds);
          companion.huntBonus = 1 + (skill.bonus || 0.5);
          companion.huntTarget = null;   // escolhe de novo o mais perigoso no próximo quadro
          if (fresh) FX.beastCall(this, companion);
          else { companion.howl(); burst(companion.pos.clone().setY(companion.pos.y + 0.8), [color, 0xffe6a1], fewer(10), 4); }
          popText(companion.pos, 'Estouro!', 'evolve');
          // estouro: a matilha pisoteia quem está em volta da fera
          const center = companion.pos.clone();
          for (const enemy of skeletonsAlive()) {
            if (enemy.dead || enemy.spawning || enemy.pos.distanceTo(center) > radius + 0.4 * (enemy.size - 1)) continue;
            damageOne(enemy);
            if (enemy.boss || enemy.totem) controlEnemy(enemy, 'slowT', scaleBranchEffect(this, 'control', 2.5) * power);
            else if (controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', 1.1 + (level - 1) * 0.15) * power)) enemy.pendingHit = null;
            enemy.vel.add(new THREE.Vector3().subVectors(enemy.pos, center).setY(0).normalize().multiplyScalar(enemy.boss ? 1 : 4));
          }
          wave(center, color, 0.3, radius, 0.6, { opacity: 0.45 });
          FX.quakeAt(center, radius * 0.45, 0.3);
        };
        break;
      }
      case 'root-totem': {
        // Totem de raízes: no maior grupo de inimigos (ou onde o jogador mirou); prende os comuns ao fincar
        const ground = force && target?.groundTarget ? target : null;
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 8));
        let best = null, most = 0;
        if (!ground) for (const s of pool) {
          const n = pool.filter((o) => o.pos.distanceTo(s.pos) <= radius).length + (s.boss ? 2 : 0);
          if (n > most) { most = n; best = s; }
        }
        if (!ground && (!best || (!force && most < 2))) return false;
        const at = (ground ? ground.pos : best.pos).clone();
        if (!force && spiritTotems.some((t) => t.owner === this && t.kind === 'root' && t.life > 2 && t.root.position.distanceTo(at) < 2.5)) return false;
        target = ground || best;
        effect = () => {
          plantSpiritTotem(this, at, 'root', scaleBranchEffect(this, 'control', skill.duration || 7) * power, radius);
          let held = 0;
          for (const s of skeletonsAlive()) if (!s.dead && !s.spawning && !s.boss && held < 6 && s.pos.distanceTo(at) <= radius + 0.4 * (s.size - 1)) {
            held++;
            if (controlEnemy(s, 'rootT', scaleBranchEffect(this, 'control', 0.9) * power)) { s.pendingHit = null; FX.roots(s); }
          }
          popText(at, 'Raízes!', 'evolve');
        };
        break;
      }
      case 'ancestral-totem': {
        // Totem ancestral: traz de volta um herói caído; sem caídos, cura bastante o grupo e dá escudo
        effect = () => {
          const at = this.pos.clone().add(this.fwd.clone().setY(0).multiplyScalar(1.6));
          const lost = partyNow().find((h) => h.dead && h !== this);
          plantSpiritTotem(this, at, 'ancestral', skill.duration * power, 4.5);
          if (lost) {
            lost.revive();
            lost.hp = Math.max(lost.hp, lost.maxHp * 0.6);
            lost.pos.copy(at).add(tmp.set(1.4, 0, 0.5)).setY(world.groundHeight(at.x + 1.4, at.z + 0.5));
            popText(lost.pos, 'De volta!', 'heal');
          } else {
            for (const h of partyNow()) if (!h.dead && h.pos.distanceTo(this.pos) <= radius) {
              const heal = Math.min(h.maxHp - h.hp, scaleBranchEffect(this, 'support', h.maxHp * 0.4) * power);
              if (heal > 0) { h.hp += heal; this.stats.cura += heal; popText(h.pos, '+' + Math.round(heal), 'heal'); }
              h.guardT = Math.max(h.guardT, 6 * power);
            }
          }
        };
        break;
      }
      case 'follow-spirit': {
        // Espírito Acompanhante: segue o aliado mais ferido e pulsa uma cura pequena (nada fica parado no chão)
        const ally = party.filter((h) => h.pos.distanceTo(this.pos) <= (skill.range || 10))
          .reduce((best, h) => (!best || h.hp / h.maxHp < best.hp / best.maxHp ? h : best), null);
        if (!ally || (!force && ally.hp / ally.maxHp >= 0.7)) return false;
        target = ally;
        effect = () => { if (!ally.dead) callFollowSpirit(this, ally, scaleBranchEffect(this, 'support', skill.duration || 6) * (0.9 + 0.1 * power)); };
        break;
      }
      case 'stone-golem': case 'little-dragon':
        effect = () => callSummon(this, skill.effect === 'stone-golem' ? 'golem' : 'dragon');
        break;
      case 'rewrite-fate': {
        // Destino Reescrito: cancela os golpes de todos ao redor e os atordoa (chefe: pouco e lento), marca os inimigos e protege o grupo
        if (!enemies.length && !force) return false;
        effect = () => {
          for (const enemy of enemies) {
            if (enemy.dead) continue;
            enemy.pendingHit = null;
            if (enemy.telegraph?.interruptible) enemy.telegraph.t = 0;
            if (enemy.boss || enemy.totem) controlEnemy(enemy, 'slowT', 3);
            controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', skill.duration || 2) * power * (enemy.boss || enemy.totem ? 0.55 : 1));
            enemy.markT = Math.max(enemy.markT || 0, 6);
            enemy.markBonus = Math.max(enemy.markBonus || 0, 0.15);
            popText(enemy.pos, 'Destino reescrito!', 'crit');
            FX.stasis(enemy);
          }
          for (const ally of party) if (ally.pos.distanceTo(this.pos) <= radius) ally.guardT = Math.max(ally.guardT, 3 * power);
          wave(this.pos, color, 0.25, radius, 0.8);
          burst(this.pos, [color, 0xffffff, 0x8feaff], 34, 5);
        };
        break;
      }
      case 'ward': case 'frost-ward': case 'bastion': {
        const duration = scaleBranchEffect(this, 'control', skill.duration || 5) * power;
        effect = () => {
          for (const h of party) if (h.pos.distanceTo(this.pos) <= Math.max(radius, 5.5)) h.guardT = Math.max(h.guardT, duration);
          if (skill.effect === 'bastion') { this.guardT = Math.max(this.guardT, duration); this.stanceT = Math.max(this.stanceT, duration); for (const enemy of enemies) control(enemy); }
          if (skill.effect === 'frost-ward') for (const enemy of enemies) { controlEnemy(enemy, 'slowT', duration * 0.65); damageOne(enemy, 0.35); }
          FX.dome(this, radius);
          if (skill.effect === 'frost-ward') { FX.iceFan(this, target || this); burst(this.pos, color, 18, 4); }
        };
        break;
      }
      case 'shield-ricochet': {
        // Escudo Ricochete: quica por até 3 inimigos (o mais perigoso primeiro, depois o mais perto do anterior); cada um leva dano leve e fica 2 s com −25% de dano contra aliados
        const first = target && enemies.includes(target) ? target : highestPriorityHeroTarget(this, enemies);
        if (!first || (!force && enemies.length < 2)) return false;
        target = first;
        effect = () => {
          const path = [], hit = new Set();
          let from = first;
          while (from && path.length < (skill.hops || 3)) {
            path.push(from); hit.add(from);
            let next = null, best = 5.5;
            for (const s of enemies) if (!hit.has(s) && !s.dead) { const d = s.pos.distanceTo(from.pos); if (d < best) { best = d; next = s; } }
            from = next;
          }
          FX.shieldRicochet(this, path);
          for (const enemy of path) {
            if (enemy.dead) continue;
            damageOne(enemy);
            enemy.weakT = Math.max(enemy.weakT || 0, scaleBranchEffect(this, 'control', skill.duration || 2) * power);
          }
        };
        break;
      }
      case 'holy-nova': {
        const heal = scaleBranchEffect(this, 'support', 28 + level * 5) * power;
        if (!enemies.length && !wounded.length) return false;
        effect = () => { const healed = healFriends(heal, Math.max(radius, 6.5)); damageAreaNow(0.8); FX.holyLight(this, healed, radius); wave(this.pos, color, 0.2, radius, 0.75); burst(this.pos, color, 28, 5); };
        break;
      }
      case 'march-decree': {
        // Decreto de Marcha: o grupo todo anda mais depressa e as recargas correm mais rápido por alguns segundos
        if (!force && !marchWanted) return false;
        effect = () => {
          const duration = scaleBranchEffect(this, 'support', skill.duration || 6) * power;
          for (const h of party) if (!h.dead) h.marchT = Math.max(h.marchT, duration);
          popText(this.pos, 'Marcha!', 'evolve');
          FX.marchDecree(this, party, duration);
        };
        break;
      }
      case 'rally': {
        const duration = (skill.duration || 8) * power;
        effect = () => { for (const h of party) { h.royalT = Math.max(h.royalT, duration); h.royalBonus = Math.max(h.royalBonus, skill.bonus || 0.25); }
          popText(this.pos, 'Ordem real!', 'evolve'); FX.royal(this, party); FX.dome(this, 4.5); };
        break;
      }
      case 'charge': case 'shadow': case 'execute': {
        if (!target) return false;
        effect = () => {
          if (target.dead && skill.effect !== 'charge') target = nearest(this.pos, targetPool.filter((s) => !s.dead && !s.spawning));   // alvo caiu durante o preparo: o mais próximo
          if (!target || target.dead) return;
          const from = this.pos.clone();
          if (skill.effect === 'shadow' || skill.effect === 'execute') {
            const dir = tmp.subVectors(target.pos, this.pos).setY(0).normalize();
            const behind = target.pos.clone().addScaledVector(dir, 0.65 + 0.35 * target.size);
            const dest = world.canStep(target.pos, behind) ? behind : target.pos.clone().addScaledVector(dir, -(0.65 + 0.35 * target.size));
            this.pos.copy(dest).setY(world.groundHeight(dest.x, dest.z));
            FX.shadowStep(from, this.pos);
          } else this.vel.add(tmp.subVectors(target.pos, this.pos).setY(0).normalize().multiplyScalar(6));
          this.face(target.pos, 1);
          const finisher = skill.effect === 'execute' && target.hp / target.maxHp <= 0.45 ? 1.8 : 1;
          damageOne(target, finisher);
          FX.slashX(target, this); burst(target.pos, color, 14, 3.5);
        };
        break;
      }
      case 'volley': case 'volley-storm': case 'arrow-rain': {
        const shots = skill.shots || 4;
        const sorted = prioritizedHeroTargets(this, [...(skill.effect === 'volley' ? [target] : enemies)].filter(Boolean));
        if (!sorted.length) return false;
        effect = () => {
          const count = skill.effect === 'volley' ? shots : Math.min(shots, sorted.length);
          const volleys = skill.effect === 'volley-storm' ? (skill.waves || 1) : 1;
          for (let w = 0; w < volleys; w++) {
            const fire = () => {
              if (game.over) return;
              for (let i = 0; i < count; i++) {
                const enemy = skill.effect === 'volley' ? target : sorted[i];
                if (enemy.dead) continue;
                FX.zigzag(this.pos, enemy.pos, i * 0.04); damageOne(enemy, skill.effect === 'volley' ? 1 / shots : 0.75);
                if (skill.effect === 'arrow-rain' && !enemy.dead) controlEnemy(enemy, 'slowT', 2.5 * power);
              }
              if (skill.effect !== 'volley') { wave(this.pos, color, 0.2, radius, 0.55); burst(this.pos, color, shots * 3, 4); }
            };
            if (w) FX.later(w * 0.45, fire); else fire();
          }
        };
        break;
      }
      case 'chain': {
        if (!target) return false;
        effect = () => {
          let at = this.pos, next = target; const hit = new Set();
          for (let i = 0; i < (skill.jumps || 4) + (this.extraTargets || 0) && next && !next.dead; i++) {
            FX.zigzag(at, next.pos, i * 0.06); hit.add(next); damageOne(next, 1 - i * 0.08); at = next.pos;
            next = highestPriorityHeroTarget(this, targetPool.filter((enemy) => !hit.has(enemy) && enemy.pos.distanceTo(at) < 5), at);   // os saltos partem do alvo: o pool é o alcance de mira, não o raio curto em volta do mago
          }
          burst(target.pos, color, 12, 3);
        };
        break;
      }
      case 'burst': case 'storm': case 'blizzard': case 'meteor': case 'shadow-storm': case 'roots-heal': case 'nature-storm': {
        if (skill.effect === 'roots-heal' || skill.effect === 'nature-storm') {
          const heal = scaleBranchEffect(this, 'support', skill.effect === 'roots-heal' ? 16 : 26) * power;
          effect = () => { const healed = healFriends(heal, radius); damageAreaNow(skill.effect === 'roots-heal' ? 0.55 : 1);
            for (const enemy of enemies) FX.roots(enemy); FX.leaves(this, radius); FX.holyLight(this, healed, radius); wave(this.pos, color, 0.2, radius, 0.7); };
        } else if (skill.effect === 'shadow-storm') {
          effect = () => { for (const enemy of enemies) { damageOne(enemy); FX.slashX(enemy, this); } FX.whirl(this, radius); burst(this.pos, color, 22, 4); };
        } else if (skill.effect === 'meteor') {
          const meteorTarget = target;
          effect = () => {
            if (meteorTarget && units.includes(meteorTarget)) meteorImpactAt.copy(meteorTarget.pos);
            const at = meteorImpactAt.clone();
            damageAreaAt(at, radius);
            FX.quakeAt(at, radius * 0.35);
            wave(at, color, 0.2, radius, 0.7);
            burst(at, color, 32, 5);
          };
        } else {
          effect = () => { damageAreaNow(0.8);
            if (skill.effect === 'blizzard' && this.cfg.id === 'chronist') {
              for (const enemy of enemies) FX.stasis(enemy);
              for (const ally of party) for (let k = 0; k < ally.skillTimers.length; k++) if (k !== 2) ally.skillTimers[k] = Math.max(0, ally.skillTimers[k] - 4);   // o tempo pára: as recargas dos aliados correm
            }
            else if (skill.effect === 'blizzard') FX.iceFan(this, target || this);
            else if (skill.effect === 'storm') FX.whirl(this, radius);
            else FX.quake(this, radius * 0.35);
            wave(this.pos, color, 0.2, radius, 0.7); burst(this.pos, color, 22, 5);
          };
        }
        break;
      }
      case 'cross-dash': {
        // corte em X: avança em linha reta pela fila e corta todos no caminho
        const reach = skill.range || 6.5;
        const pool = skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) <= reach && Math.abs(s.pos.y - this.pos.y) < 0.85);
        let aim = force && pool.includes(target) ? target : null;
        let line = aim ? lineTargets(this.pos, aim.pos, pool, reach) : [];
        if (!aim) for (const s of pool) {
          const hits = lineTargets(this.pos, s.pos, pool, Math.min(reach, s.pos.distanceTo(this.pos) + 1.6));
          if (hits.length > line.length || (hits.length === line.length && s === target)) { line = hits; aim = s; }
        }
        const loneTarget = line.length === 1 && !line[0].boss && !line[0].totem;
        if (!aim || (!force && line.length < 2 && !urgentEnemy && !loneTarget)) return false;
        target = aim;
        effect = () => {
          const from = this.pos.clone(), dir = new THREE.Vector3().subVectors(aim.pos, from).setY(0).normalize();
          const length = Math.min(reach, aim.pos.distanceTo(from) + 1.6);
          const end = from.clone().addScaledVector(dir, length);
          const hit = lineTargets(from, end, skeletonsAlive().filter((s) => !s.spawning && Math.abs(s.pos.y - from.y) < 0.85), length);
          if (world.canStep(from, end)) { this.pos.copy(end).setY(world.groundHeight(end.x, end.z)); this.vel.set(0, 0, 0); }
          else this.vel.add(dir.clone().multiplyScalar(6));
          this.face(end.clone().add(dir), 1);
          const singleTargetBonus = hit.length === 1 && !hit[0].boss && !hit[0].totem ? 1.25 : 1;
          for (const enemy of hit) { damageOne(enemy, singleTargetBonus); FX.bladeCut(enemy, this, 0); }
          FX.steelDash(from, this.pos);
        };
        break;
      }
      case 'blade-dance': {
        // dança de lâminas: gira por alguns segundos cortando todos ao redor (ticks em updateBladeDance)
        if (!enemies.length && !force) return false;
        effect = () => {
          this.bladeDanceT = (skill.duration || 3) * (0.9 + 0.1 * power);
          this.bladeDanceTick = 0;
          this.bladeDance = { radius, hit: this.dmg * power * (skill.power || 1) * BLADE_DANCE_TICK / (skill.duration || 3) };
          this.busy = this.bladeDanceT;
          this.loop('2H_Melee_Attack_Spinning');
          FX.bladeDance(this, radius);
        };
        break;
      }
      case 'arrow-storm': case 'volatile': {
        // Arqueira e Alquimista: área no grupo mais denso ao alcance; a IA espera juntar dois inimigos
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 9));
        const directGround = force && target?.groundTarget ? target : null;
        const { center: denseCenter, count } = densest(pool, skill.radius || 3, force && !directGround ? target : null);
        const center = directGround || denseCenter;
        const hasTargetsAtGroundPoint = !directGround || pool.some((enemy) => enemy.pos.distanceTo(directGround.pos) <= (skill.radius || 3));
        if (!center || !hasTargetsAtGroundPoint || (!directGround && !force && count < 2 && !urgentEnemy)) return false;
        target = center;
        const at = center.pos.clone(), area = (skill.radius || 3) * (0.9 + 0.1 * power), total = this.dmg * power * (skill.power || 1);
        effect = () => (skill.effect === 'arrow-storm' ? arrowRain(this, at, area, total) : volatileFlask(this, at, area, total));
        break;
      }
      case 'hunter-mark': {
        // Flecha do caçador: fere e marca o inimigo mais forte (chefe primeiro); todos batem mais nele
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 11));
        const worth = (s) => (s.boss || s.totem ? 1e6 : 0) + s.hp;
        const prey = force && pool.includes(target) ? target : pool.reduce((best, s) => (!best || worth(s) > worth(best) ? s : best), null);
        if (!prey) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          damageOne(prey);
          prey.markT = Math.max(prey.markT || 0, scaleBranchEffect(this, 'control', skill.duration || 8) * power);
          prey.markBonus = Math.max(prey.markBonus || 0, skill.bonus || 0.3);
          popText(prey.pos, 'Marcado!', 'crit');
          FX.hunterShot(this, prey);
          FX.huntMark(prey);
        };
        break;
      }
      case 'wind-palm': {
        // Palma do vento: rajada em cone que fere, interrompe e empurra para longe
        const reach = skill.range || 5;
        const pool = skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) <= reach + 0.4 * (s.size - 1) && Math.abs(s.pos.y - this.pos.y) < 0.85);
        let aim = force && pool.includes(target) ? target : null, hits = aim ? coneTargets(this.pos, aim.pos, pool, reach) : [];
        if (!aim) for (const s of pool) {
          const cone = coneTargets(this.pos, s.pos, pool, reach);
          if (cone.length > hits.length || (cone.length === hits.length && s === target)) { hits = cone; aim = s; }
        }
        if (!aim || (!force && hits.length < 2 && !urgentEnemy)) return false;
        target = aim;
        effect = () => {
          const from = this.pos.clone(), dir = new THREE.Vector3().subVectors(aim.pos, from).setY(0).normalize();
          const end = from.clone().addScaledVector(dir, reach);
          for (const enemy of coneTargets(from, end, skeletonsAlive().filter((s) => !s.spawning && Math.abs(s.pos.y - from.y) < 0.85), reach)) {
            damageOne(enemy);
            enemy.pendingHit = null;
            enemy.vel.add(new THREE.Vector3().subVectors(enemy.pos, from).setY(0).normalize().multiplyScalar(enemy.boss ? 2 : 9));
          }
          FX.windPalm(this, dir, reach);
        };
        break;
      }
      case 'meditate': {
        // Meditação: só quando o grupo precisa de cura ou o Monge está acuado
        if (!force && !criticalAlly && missingHp < this.maxHp * 0.3 && this.hp > this.maxHp * 0.45 && !(enemies.length >= 3 && missingHp >= this.maxHp * 0.12)) return false;
        effect = () => {
          this.meditateT = this.immuneT = (skill.duration || 4) * (0.9 + 0.1 * power);
          this.meditateTick = 0;
          this.meditation = { radius, heal: scaleBranchEffect(this, 'support', 7 + level * 2) * power };
          for (const enemy of enemies) {   // onda de paz: afasta e atrasa quem está colado
            if (enemy.dead || enemy.pos.distanceTo(this.pos) > radius) continue;
            controlEnemy(enemy, 'slowT', scaleBranchEffect(this, 'control', 2.5) * power);
            enemy.vel.add(new THREE.Vector3().subVectors(enemy.pos, this.pos).setY(0).normalize().multiplyScalar(enemy.boss ? 1.5 : 5));
          }
          this.busy = this.meditateT;
          this.pendingHit = null;
          this.loop('Sit_Floor_Idle');
          FX.meditate(this, radius);
        };
        break;
      }
      case 'transmute': {
        // Grande transmutação: inimigos comuns viram ovelhas (não atacam, andam à toa); chefes e totens só ficam lentos
        const common = enemies.filter((s) => !s.boss && !s.totem);
        if (!force && common.length < 4 && !urgentEnemy) return false;
        effect = () => {
          const duration = scaleBranchEffect(this, 'control', skill.duration || 6) * power;
          for (const enemy of enemies) {
            if (enemy.dead) continue;
            if (enemy.boss || enemy.totem) { controlEnemy(enemy, 'slowT', duration); continue; }
            if (!(enemy.sheepT > 0)) FX.sheep(enemy);
            enemy.sheepT = Math.max(enemy.sheepT || 0, duration);
            enemy.pendingHit = null;
            enemy.vel.set(0, 0, 0);
          }
          FX.transmuteWave(this.pos, radius);
        };
        break;
      }
      case 'seismic-grab': {
        // Agarrão Sísmico: reúne os inimigos em volta do Brutamontes e os lança para cima.
        const caught = enemies.filter((s) => !s.totem);
        if (!force && caught.length < 2 && !urgentEnemy) return false;
        effect = () => {
          const center = this.pos.clone();
          const normalAir = scaleBranchEffect(this, 'control', skill.duration || 0.58) * (0.9 + 0.1 * power);
          for (let i = 0; i < caught.length; i++) {
            const enemy = caught[i];
            if (enemy.dead || enemy.spawning) continue;
            damageOne(enemy);
            if (enemy.dead) continue;
            const boss = !!enemy.boss;
            const angle = this.root.rotation.y + (i / Math.max(1, caught.length)) * Math.PI * 2;
            const landingRadius = boss ? 3.1 : 1.6 + (i % 3) * 0.32;
            const x = center.x + Math.sin(angle) * landingRadius;
            const z = center.z + Math.cos(angle) * landingRadius;
            const dest = new THREE.Vector3(x, world.groundHeight(x, z), z);
            if (world.canStep(enemy.pos, dest)) {
              enemy.pos.copy(dest);
              enemy.vel.set(0, 0, 0);
            } else {
              const pull = new THREE.Vector3().subVectors(center, enemy.pos).setY(0).normalize();
              enemy.vel.addScaledVector(pull, boss ? 2 : 6);
            }
            enemy.knockupT = Math.max(enemy.knockupT || 0, normalAir);
            enemy.knockupDuration = Math.max(enemy.knockupDuration || 0, normalAir);
            enemy.knockupHeight = Math.max(enemy.knockupHeight || 0, boss ? 0.45 : 1.05);
            if (boss) controlEnemy(enemy, 'slowT', scaleBranchEffect(this, 'control', 1.1) * power);
            else if (controlEnemy(enemy, 'stunT', normalAir) > 0) enemy.pendingHit = null;
            FX.zigzag(center, enemy.pos);
          }
          FX.quake(this, radius * 0.45);
          FX.seismicPull(center, radius, color);
          popText(center, 'Agarrão sísmico!', 'crit');
        };
        break;
      }
      case 'stone-skin': {
        // Pele de pedra: cresce, segura quase todo o dano, devolve parte dos golpes e chama todos em volta para si
        if (!force && !enemies.length) return false;
        effect = () => {
          this.stoneT = (skill.duration || 8) * (0.9 + 0.1 * power);
          for (const enemy of enemies) if (!enemy.dead) {
            enemy.taunt = this;
            enemy.tauntT = Math.max(enemy.tauntT || 0, scaleBranchEffect(this, 'control', 4) * power);
            if (!enemy.boss) enemy.pendingHit = null;   // chefe só muda de alvo; o golpe anunciado segue
          }
          popText(this.pos, 'Pedra!', 'evolve');
          FX.quake(this, radius * 0.4);
          wave(this.pos, color, 0.3, radius, 0.7);
          column(this.pos, 0xb8a88a, 0.8, 2.6, this.stoneT, { follow: this, opacity: 0.16 });
        };
        break;
      }
      // ---------- Geomante ----------
      case 'geo-wall': {
        // Muralha de pedra: atravessada entre o grupo inimigo e os heróis; só segura inimigos comuns
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 8));
        const ground = force && target?.groundTarget ? target : null;
        const { center, count } = densest(pool, 2.5, force && !ground ? target : null);
        const spot = ground || center;
        if (!spot || (!ground && !force && count < 2 && !urgentEnemy)) return false;
        target = spot;
        const dir = new THREE.Vector3().subVectors(spot.pos, this.pos).setY(0);
        if (dir.lengthSq() < 0.01) dir.copy(this.fwd).setY(0);
        dir.normalize();
        const at = spot.pos.clone().addScaledVector(dir, -1.6);   // um pouco antes do grupo: quem está em cima é empurrado para fora, ninguém fica preso
        effect = () => geoWall(this, at, dir, radius, scaleBranchEffect(this, 'control', skill.duration || 5) * (0.9 + 0.1 * power));
        break;
      }
      case 'geo-quake': {
        // Terremoto: inimigos comuns caem atordoados, todos levam dano, e as rachaduras deixam o chão lento
        if (!force && enemies.length < 3 && !urgentEnemy) return false;
        effect = () => {
          const at = this.pos.clone(), life = scaleBranchEffect(this, 'control', skill.duration || 4) * power;
          for (const enemy of enemies) {
            if (enemy.dead) continue;
            damageOne(enemy);
            if (enemy.dead) continue;
            if (enemy.boss || enemy.totem) { controlEnemy(enemy, 'slowT', 2.5); continue; }
            if (controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', 1.6) * power)) enemy.pendingHit = null;
          }
          const mesh = groundMark(at, radius, 0x4a3a28, 0.3);
          flames.push({ mesh, radius, owner: this, t: life, tick: 0, every: 0.5, dmg: this.dmg * power * 0.08,
            onTick: (f) => { for (const s of skeletonsAlive()) if (!s.dead && !s.spawning && s.pos.distanceTo(f.mesh.position) <= f.radius + 0.4 * (s.size - 1)) s.slowT = Math.max(s.slowT || 0, 0.8); } });
          geoCracks(at, radius, life);
          popText(this.pos, 'Fúria da Terra!', 'evolve');
        };
        break;
      }
      case 'rock-pillar': {
        // Pilar de pedra: brota sob o inimigo mais forte ao alcance; prende comuns por instantes, chefe só fica lento
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 8));
        const worth = (s) => (s.boss || s.totem ? 1e6 : 0) + s.hp;
        const prey = force && pool.includes(target) ? target : pool.reduce((best, s) => (!best || worth(s) > worth(best) ? s : best), null);
        if (!prey) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          const at = prey.pos.clone();
          damageOne(prey);
          if (!prey.dead) {
            if (prey.boss || prey.totem) controlEnemy(prey, 'slowT', 2.5);
            else if (controlEnemy(prey, 'stunT', scaleBranchEffect(this, 'control', skill.duration || 1.4) * power)) prey.pendingHit = null;
          }
          stoneRise(at, stoneSpikeGeo, rockMat, 1.3, 2.4, 1.2, { rise: 0.12, sink: 0.4 });
          puffs(at.clone().setY(at.y + 0.2), 3, 'dust', { size: 0.8, rise: 0.8, life: 0.8 });
          shake(0.2);
        };
        break;
      }
      // ---------- segundas técnicas (slot 3): um comportamento próprio por herói ----------
      case 'war-roar': {
        // Berro de Guerra: por 5 s o golpe comum do Brutamontes atordoa quem está colado (ver roarStun); ele segue andando e batendo
        const close = enemies.filter((s) => s.pos.distanceTo(this.pos) <= ROAR.reach + 0.4 * (s.size - 1)).length;
        if (!force && (close < 2 || this.roarT > 1)) return false;
        effect = () => {
          this.roarT = scaleBranchEffect(this, 'control', skill.duration || 5) * (0.9 + 0.1 * power);
          popText(this.pos, 'Berro!', 'evolve');
          FX.roarStart(this, this.roarT);
        };
        break;
      }
      case 'slime-hop': {
        // Slime Saltitante: invoca um slime que salta sobre o grupo mais denso (SummonedCreature.thinkSlime); a IA pede 2+ inimigos perto
        if (!force && enemies.length < 2) return false;
        effect = () => callSummon(this, 'slime');
        break;
      }
      case 'blood-bond': {
        // Vínculo de sangue: o aliado mais ferido e o mais próximo dele dividem o dano que receberem
        const near = party.filter((h) => h.pos.distanceTo(this.pos) <= (skill.range || 9));
        const hurt = near.reduce((best, h) => (!best || h.hp / h.maxHp < best.hp / best.maxHp ? h : best), null);
        const mate = hurt && party.filter((h) => h !== hurt).reduce((best, h) => (!best || h.pos.distanceTo(hurt.pos) < best.pos.distanceTo(hurt.pos) ? h : best), null);
        if (!hurt || (!mate && !force) || (!force && hurt.hp / hurt.maxHp > 0.75)) return false;
        target = hurt;
        effect = () => {
          if (hurt.dead || !mate || mate.dead) return;
          const seconds = scaleBranchEffect(this, 'support', skill.duration || 6) * (0.9 + 0.1 * power);
          for (const [a, b] of [[hurt, mate], [mate, hurt]]) { a.bondT = seconds; a.bondWith = b; a.bondShare = skill.share || 0.5; a.bondLead = a === hurt; a.bondDrawT = 0; }
          popText(hurt.pos, 'Vínculo!', 'evolve');
          beam(hurt.pos, mate.pos, color);
          burst(hurt.pos, [color, 0x3a0a14], 8, 2.5);
          burst(mate.pos, [color, 0x3a0a14], 8, 2.5);
        };
        break;
      }
      case 'blood-eclipse': {
        // Eclipse Rubro: por alguns segundos, comuns abaixo de 30% de vida explodem em sangue ao redor da Vampira e curam os aliados (teto por uso)
        if (!force && enemies.length < 3) return false;
        effect = () => {
          this.eclipseT = scaleBranchEffect(this, 'support', skill.duration || 6) * (0.9 + 0.1 * power);
          this.eclipseR = radius;
          this.eclipseHeal = scaleBranchEffect(this, 'support', 40 + level * 12) * power;   // teto de cura por uso
          this.eclipseTick = 0;
          popText(this.pos, 'Eclipse!', 'crit');
          wave(this.pos, color, 0.3, radius, 0.7, { opacity: 0.45 });
          FX.rays(this.pos, 'rage', 0.5, 3.2, this.eclipseT, { follow: this, opacity: 0.45 });
        };
        break;
      }
      case 'blood-kiss': {
        // Beijo sombrio: mordida forte no inimigo prioritário à frente; todo o dano volta como cura
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 6) && Math.abs(s.pos.y - this.pos.y) < 0.85);
        const prey = force && pool.includes(target) ? target : highestPriorityHeroTarget(this, pool);
        if (!prey) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          this.vampFrac = 1;
          damageOne(prey);
          this.vampFrac = 0;
          FX.bladeCut(prey, this, 0);
          burst(prey.pos, [color, 0x3a0a14], 12, 3.5);
        };
        break;
      }
      case 'oath-link': {
        // Juramento: o Paladino assume parte do dano do aliado mais ferido
        const allies = party.filter((h) => h !== this && h.pos.distanceTo(this.pos) <= (skill.range || 9));
        const ward = allies.reduce((best, h) => (!best || h.hp / h.maxHp < best.hp / best.maxHp ? h : best), null);
        if (!force && (!ward || ward.hp / ward.maxHp > 0.9)) return false;
        const ally = ward || this;
        target = ally;
        effect = () => {
          if (ally !== this) {
            ally.oathT = scaleBranchEffect(this, 'support', skill.duration || 6) * (0.9 + 0.1 * power);
            ally.oathBy = this;
            ally.oathShare = skill.share || 0.4;
          } else this.guardT = Math.max(this.guardT, 2 * power);
          const heal = Math.min(ally.maxHp - ally.hp, scaleBranchEffect(this, 'support', 10 + level * 4) * power);
          if (heal > 0) { ally.hp += heal; this.stats.cura += heal; popText(ally.pos, '+' + Math.round(heal), 'heal'); }
          popText(ally.pos, 'Juramento!', 'evolve');
          if (ally !== this) FX.zigzag(this.pos, ally.pos);
          FX.rays(ally.pos, 'holy', 0.4, 4, 0.7, { follow: ally });
        };
        break;
      }
      case 'shield-rush': {
        // Investida de escudo: avança até o alvo, atordoa e empurra quem estiver perto do impacto
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 7) && Math.abs(s.pos.y - this.pos.y) < 0.85);
        const aim = force && pool.includes(target) ? target : highestPriorityHeroTarget(this, pool);
        if (!aim) return false;
        if (!force && !urgentEnemy && attackables.filter((s) => !s.dead && s.pos.distanceTo(aim.pos) <= (skill.radius || 2.2)).length < 2) return false;
        target = aim;
        effect = () => {
          if (aim.dead) return;
          const from = this.pos.clone(), dir = new THREE.Vector3().subVectors(aim.pos, from).setY(0).normalize();
          const stop = aim.pos.clone().addScaledVector(dir, -(0.9 + 0.35 * aim.size));
          if (stop.distanceTo(from) > 0.5 && world.canStep(from, stop)) { this.pos.copy(stop).setY(world.groundHeight(stop.x, stop.z)); this.vel.set(0, 0, 0); }
          this.face(aim.pos, 1);
          const hit = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(aim.pos) <= (skill.radius || 2.2) + 0.4 * (s.size - 1));
          for (const enemy of hit) {
            damageOne(enemy);
            enemy.stunT = Math.max(enemy.stunT || 0, scaleBranchEffect(this, 'control', 1 + (level - 1) * 0.15) * power);
            enemy.pendingHit = null;
            enemy.vel.add(new THREE.Vector3().subVectors(enemy.pos, this.pos).setY(0).normalize().multiplyScalar(enemy.boss ? 1.5 : 5));
          }
          this.guardT = Math.max(this.guardT, 1.5);
          FX.steelDash(from, this.pos);
          wave(aim.pos, color, 0.2, skill.radius || 2.2, 0.5);
          burst(aim.pos, [color, 0xffffff], 16, 4);
        };
        break;
      }
      case 'spear-stance': {
        // Postura de lança: alcance maior e, a cada pulso, quem chega perto leva dano e fica lento (ticks em updateSkillStates)
        const close = enemies.filter((s) => s.pos.distanceTo(this.pos) <= this.cfg.range * SPEAR_REACH + 1.5);
        if (!force && close.length < 2 && !urgentEnemy) return false;
        effect = () => {
          this.spearT = scaleBranchEffect(this, 'control', skill.duration || 5) * (0.9 + 0.1 * power);
          this.spearTick = 0;
          this.spearInfo = { dmg: this.dmg * power * (skill.power || 0.3), slow: 1.2 * power };
          popText(this.pos, 'Postura!', 'evolve');
          FX.lanceStance(this, this.cfg.range * SPEAR_REACH + 0.5);
        };
        break;
      }
      case 'cavalry-charge': {
        // Carga da cavalaria: atropela a linha com mais inimigos (comuns levam dano e ficam atordoados; chefe só leva dano) e volta ao posto
        const reach = skill.range || 9;
        const flat = (s) => !s.dead && !s.spawning && Math.abs(s.pos.y - this.pos.y) < 0.85;
        const pool = attackables.filter((s) => flat(s) && s.pos.distanceTo(this.pos) <= reach);
        let aim = force && pool.includes(target) ? target : null, line = aim ? lineTargets(this.pos, aim.pos, pool, reach, 1.2) : [];
        if (!aim) for (const s of pool) {
          const hits = lineTargets(this.pos, s.pos, pool, reach, 1.2);
          if (hits.length > line.length) { line = hits; aim = s; }
        }
        if (!aim || (!force && line.length < 2 && !urgentEnemy)) return false;
        target = aim;
        effect = () => {
          const from = this.pos.clone(), dir = new THREE.Vector3().subVectors(aim.pos, from).setY(0);
          if (dir.lengthSq() < 0.01) dir.copy(this.fwd);
          dir.normalize();
          let length = Math.min(reach, Math.max(aim.pos.distanceTo(from) + 2, 5)), end = from.clone().addScaledVector(dir, length);
          while (length > 1.5 && !world.canStep(from, end)) { length -= 1; end = from.clone().addScaledVector(dir, length); }   // o chão não deixa: para antes do obstáculo
          const hit = lineTargets(from, from.clone().addScaledVector(dir, length), attackables.filter(flat), length, 1.2);
          if (length > 1.5) {
            this.pos.copy(end).setY(world.groundHeight(end.x, end.z));
            this.vel.set(0, 0, 0);
            this.chargeBack = { t: 0.7, to: from };
            this.busy = Math.max(this.busy, 0.7);
          }
          this.face(end.clone().add(dir), 1);
          for (const enemy of hit) {
            heroHit(this, enemy, this.dmg * power * (skill.power || 1.4) * (enemy.boss || enemy.totem ? 0.6 : 1));
            if (!enemy.boss && !enemy.totem && controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', 0.8 + (level - 1) * 0.1) * power)) enemy.pendingHit = null;
            enemy.vel.addScaledVector(dir, enemy.boss ? 0.5 : 3);
            burst(enemy.pos, [color, 0xffffff], 8, 3);
          }
          FX.steelDash(from, this.pos);
          wave(this.pos, color, 0.3, 2.2, 0.4);
          popText(this.pos, 'Carga!', 'evolve');
        };
        break;
      }
      case 'pin-spear': {
        // Lança cravada: fere um alvo e o prende no chão (chefe só fica lento)
        const reach = skill.range || 7;
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= reach && Math.abs(s.pos.y - this.pos.y) < 0.85);
        const aim = force && pool.includes(target) ? target : highestPriorityHeroTarget(this, pool);
        if (!aim) return false;
        target = aim;
        effect = () => {
          if (aim.dead) return;
          const dir = new THREE.Vector3().subVectors(aim.pos, this.pos).setY(0);
          const distance = dir.length();
          dir.normalize();
          damageOne(aim);
          if (aim.boss || aim.totem) controlEnemy(aim, 'slowT', scaleBranchEffect(this, 'control', 3) * power);
          else if (controlEnemy(aim, 'rootT', scaleBranchEffect(this, 'control', skill.duration || 2.5) * power)) aim.pendingHit = null;
          aim.vel.set(0, 0, 0);
          popText(aim.pos, 'Cravado!', 'crit');
          FX.lanceThrust(this, dir, distance, color);
          FX.roots(aim);
        };
        break;
      }
      case 'duel-challenge': {
        // Desafio do Campeão: o inimigo mais forte por perto só ataca o Campeão, que bate mais e aguenta mais
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 8));
        const worth = (s) => (s.boss ? 1e6 : 0) + s.hp;
        const rival = force && pool.includes(target) ? target : pool.reduce((best, s) => (!best || worth(s) > worth(best) ? s : best), null);
        if (!rival || (!force && !rival.boss && !urgentEnemy && pool.length < 3)) return false;
        target = rival;
        effect = () => {
          if (rival.dead) return;
          const duration = scaleBranchEffect(this, 'control', skill.duration || 5) * (0.9 + 0.1 * power);
          rival.taunt = this; rival.tauntT = duration;
          this.royalT = Math.max(this.royalT, duration);
          this.royalBonus = Math.max(this.royalBonus, skill.bonus || 0.3);
          this.guardT = Math.max(this.guardT, duration * 0.6);
          popText(rival.pos, 'Desafiado!', 'crit');
          FX.huntMark(rival);
          FX.slashX(rival, this);
        };
        break;
      }
      case 'royal-edict': {
        // Édito real: inimigos comuns se ajoelham (atordoados); chefes só ficam lentos
        if (!force && enemies.length < 3 && !urgentEnemy) return false;
        effect = () => {
          for (const enemy of enemies) {
            if (enemy.dead) continue;
            damageOne(enemy);
            enemy.pendingHit = null;
            if (enemy.boss || enemy.totem) enemy.slowT = Math.max(enemy.slowT || 0, scaleBranchEffect(this, 'control', skill.duration || 3) * power);
            else enemy.stunT = Math.max(enemy.stunT || 0, scaleBranchEffect(this, 'control', 0.9 + (level - 1) * 0.15) * power);
          }
          popText(this.pos, 'Ajoelhem-se!', 'evolve');
          FX.royal(this, []);
          wave(this.pos, color, 0.25, radius, 0.7);
        };
        break;
      }
      case 'bloodthirst': {
        // Sede de sangue: por alguns segundos os golpes devolvem vida
        const close = enemies.filter((s) => s.pos.distanceTo(this.pos) <= 3.5);
        if (!force && (!close.length || this.hp > this.maxHp * 0.97)) return false;
        effect = () => {
          this.leechT = scaleBranchEffect(this, 'support', skill.duration || 6) * (0.9 + 0.1 * power);
          this.leech = skill.leech || 0.3;
          this.furyT = Math.max(this.furyT, 1.5);
          popText(this.pos, 'Sede de sangue!', 'crit');
          column(this.pos, color, 0.6, 2.6, 0.7, { follow: this });
          burst(this.pos, [color, 0x7a0d12], 18, 3.5);
        };
        break;
      }
      case 'boulder': {
        // Rocha arremessada: impacto em área num grupo afastado (ou no ponto mirado)
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 10) && (s.pos.distanceTo(this.pos) >= (skill.minRange || 2.5) || (force && s === target)));
        const ground = force && target?.groundTarget ? target : null;
        const { center, count } = densest(pool, skill.radius || 2.2, force && !ground ? target : null);
        const spot = ground || center;
        if (!spot || (!ground && !force && count < 2 && !urgentEnemy)) return false;
        target = spot;
        const at = spot.pos.clone(), area = (skill.radius || 2.2) * (0.9 + 0.1 * power);
        effect = () => {
          if (!ground) {   // a rocha cai onde o grupo está agora, não onde estava ao começar o arremesso (os inimigos andam)
            const near = skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(at) <= area + 3);
            const moved = densest(near, area).center;
            if (moved) at.copy(moved.pos);
          }
          const mesh = groundMark(at, area, 0x6b4a2a, 0.3);
          flames.push({ mesh, radius: area, owner: this, wait: 0.3, t: 0.05, tick: 0, every: 1, dmg: this.dmg * power * (skill.power || 1.5), onTick: (f) => {
            for (const s of skeletonsAlive()) if (!s.dead && !s.spawning && s.pos.distanceTo(f.mesh.position) <= f.radius + 0.4 * (s.size - 1)) {
              s.stunT = Math.max(s.stunT || 0, scaleBranchEffect(this, 'control', 1) * power);
              s.pendingHit = null;
            }
            wave(f.mesh.position, color, 0.3, f.radius, 0.6);
            burst(f.mesh.position, [color, 0x5a4026, 0xd9c7a0], 22, 5);
            poof(f.mesh.position, 1.2);
          } });
          burst(this.pos.clone().setY(this.pos.y + 0.3), [color, 0x5a4026], 10, 3);
        };
        break;
      }
      case 'war-cry': {
        // Brado nórdico: os inimigos próximos recuam assustados, lentos e sem o golpe preparado
        if (!force && enemies.length < 2 && !urgentEnemy) return false;
        effect = () => {
          for (const enemy of enemies) {
            if (enemy.dead) continue;
            enemy.pendingHit = null;
            enemy.slowT = Math.max(enemy.slowT || 0, scaleBranchEffect(this, 'control', skill.duration || 2.5) * power);
            enemy.vel.add(new THREE.Vector3().subVectors(enemy.pos, this.pos).setY(0).normalize().multiplyScalar(enemy.boss ? 1.5 : 7));
          }
          this.guardT = Math.max(this.guardT, 2.5);
          popText(this.pos, 'Brado!', 'evolve');
          wave(this.pos, color, 0.3, radius, 0.6);
          wave(this.pos, 0xfff2c8, 0.2, radius * 0.7, 0.45, { opacity: 0.45 });
        };
        break;
      }
      case 'ice-skin': {
        // Pele de gelo: menos dano recebido e quem bate de perto fica lento e se fere
        const close = enemies.filter((s) => s.pos.distanceTo(this.pos) <= (skill.radius || 3.5));
        if (!force && (!close.length || (close.length < 2 && this.hp > this.maxHp * 0.8))) return false;
        effect = () => {
          this.iceSkinT = scaleBranchEffect(this, 'control', skill.duration || 6) * (0.9 + 0.1 * power);
          this.iceSkinBy = skill.power || 0.4;
          popText(this.pos, 'Pele de gelo!', 'block');
          FX.iceFan(this, this);
          burst(this.pos, [color, 0xffffff], 18, 3);
        };
        break;
      }
      case 'fire-wall': {
        // Muralha de fogo: uma fileira de chamas atravessada na frente dos inimigos
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 8));
        const ground = force && target?.groundTarget ? target : null;
        const { center, count } = densest(pool, 2.5, force && !ground ? target : null);
        const spot = ground || center;
        if (!spot || (!ground && !force && count < 2 && !urgentEnemy)) return false;
        target = spot;
        const at = spot.pos.clone(), dir = new THREE.Vector3().subVectors(at, this.pos).setY(0).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x), patch = skill.radius || 1.1;
        const pulse = this.dmg * power * (skill.pulse || 0.22);
        effect = () => {
          for (let i = -2; i <= 2; i++) {
            const p = at.clone().addScaledVector(side, i * patch * 1.6).addScaledVector(dir, -0.6);
            p.y = world.groundHeight(p.x, p.z);
            const mesh = groundMark(p, patch, 0x3a1608, 0.45);
            flames.push({ mesh, radius: patch, owner: this, t: scaleBranchEffect(this, 'control', skill.duration || 4) * power, tick: 0, every: 0.5, dmg: pulse });
            FX.fireField(mesh, patch);
          }
          burst(at, [color, 0xffe070], 16, 4);
        };
        break;
      }
      case 'combustion': {
        // Combustão: detona toda queimadura ativa (dano restante +25%) e incendeia os 3 inimigos mais próximos do alvo, até 6 m do mago
        if (target?.groundTarget) target = nearest(target.pos, targetPool);
        if (!target || (!force && targetPool.length < 3)) return false;
        const burning = (list) => list.filter((s) => !s.dead && s.burnT > 0 && s.burnOwner);
        if (!force && !enemies.length && !burning(attackables).length) return false;
        const aim = target.pos.clone();
        effect = () => {
          const foes = skeletonsAlive().filter((s) => !s.spawning);
          for (const s of burning(foes)) {   // primeiro detona o que já queimava; os novos focos só acendem depois
            const rest = s.burnDmg * Math.ceil(s.burnT / 0.65) * 1.25;
            s.burnT = 0; s.burnTick = 0.65;
            s.takeDamage(rest, null, this);
            FX.combust(s);
          }
          const center = target.dead ? aim : target.pos;
          const reach = skill.radius || 6;
          const picks = foes.filter((s) => !s.dead && s.pos.distanceTo(this.pos) <= reach + 0.4 * (s.size - 1))
            .sort((a, b) => a.pos.distanceTo(center) - b.pos.distanceTo(center)).slice(0, 3);
          for (const s of picks) {
            s.burnT = Math.max(s.burnT || 0, scaleBranchEffect(this, 'control', 4) * power);
            s.burnTick = Math.min(s.burnTick || 0.5, 0.35);
            s.burnDmg = Math.max(s.burnDmg || 0, this.dmg * power * 0.17);
            s.burnOwner = this;
            beam(this.pos.clone().setY(this.pos.y + 1.2), s.pos.clone().setY(s.pos.y + 0.8), color);
            column(s.pos, color, 0.35, 2.2, 0.7, { follow: s });
          }
        };
        break;
      }
      case 'gravity-collapse': {
        // Colapso Gravitacional: puxa para um ponto os inimigos num raio de 7 m do alvo, atordoa e fere; chefe só desacelera
        if (target?.groundTarget) target = nearest(target.pos, targetPool);
        if (!target) return false;
        const aim = target.pos.clone();
        const caught = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(aim) <= radius + 0.4 * (s.size - 1));
        if (!force && caught.length < 3) return false;
        effect = () => {
          const center = (target.dead || !units.includes(target) ? aim : target.pos).clone();
          for (const s of skeletonsAlive()) {
            if (s.dead || s.spawning || s.pos.distanceTo(center) > radius + 0.4 * (s.size - 1)) continue;
            damageOne(s);
            if (s.boss || s.totem) { controlEnemy(s, 'slowT', 3 * power); continue; }
            const dest = s.pos.clone().lerp(center, 0.85);
            dest.y = world.groundHeight(dest.x, dest.z);
            if (world.canStep(s.pos, dest)) s.pos.copy(dest);
            s.vel.set(0, 0, 0);
            if (controlEnemy(s, 'stunT', scaleBranchEffect(this, 'control', skill.duration || 0.8) * power)) s.pendingHit = null;
          }
          FX.collapse(center, radius);
        };
        break;
      }
      case 'arcane-echo': {
        // Eco Arcano: o próximo feitiço do Arcano é repetido com 60% do dano; a IA arma o eco quando a assinatura está pronta
        if (!force && (this.echoT > 0 || this.skillTimers[0] > 0 || !target)) return false;
        effect = () => {
          this.echoT = scaleBranchEffect(this, 'control', skill.duration || 8) * (0.9 + 0.1 * power);
          this.echoMult = skill.power || 0.6;
          FX.echoOrb(this, color);
          popText(this.pos, 'Eco armado', 'evolve');
        };
        break;
      }
      case 'frost-guard': {
        // Geada Cortante: os golpes corpo a corpo que os aliados recebem congelam o agressor (ver skillGuard)
        const guarded = party.filter((h) => h.pos.distanceTo(this.pos) <= radius);
        const melee = attackables.filter((s) => !s.dead && !s.spawning && !s.ranged && s.target?.team === 'hero' && s.pos.distanceTo(s.target.pos) < 3.6 && s.target.pos.distanceTo(this.pos) <= radius);
        if (!force && (melee.length < 2 || guarded.every((h) => h.frostT > 2 && h.frostHits > 0))) return false;
        effect = () => {
          const seconds = scaleBranchEffect(this, 'control', skill.duration || 8) * (0.9 + 0.1 * power);
          for (const h of party) if (!h.dead && h.pos.distanceTo(this.pos) <= radius) {
            h.frostT = seconds; h.frostHits = skill.hits || 4; h.frostGapT = 0; h.frostFreeze = skill.freeze || 1;
            FX.frostSkin(h);
          }
          wave(this.pos, color, 0.4, radius, 0.8, { opacity: 0.35, dust: true });
          popText(this.pos, 'Geada!', 'evolve');
        };
        break;
      }
      case 'storm-cloud': {
        // Tormenta Móvel: nuvem de neve que segue o inimigo mais forte (chefe primeiro)
        const worth = (s) => (s.boss ? 1e6 : 0) + s.hp;
        const pool = targetPool.filter((s) => !s.totem && s.pos.distanceTo(this.pos) <= (skill.range || 10));
        const prey = pool.reduce((best, s) => (!best || worth(s) > worth(best) ? s : best), null);
        if (!prey) return false;
        if (!force && !prey.boss && pool.filter((s) => s.pos.distanceTo(prey.pos) <= radius).length < 3) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          stormCloud(this, prey, radius, scaleBranchEffect(this, 'control', skill.duration || 5), this.dmg * power * (skill.pulse || 0.24), color);
          popText(prey.pos, 'Tormenta!', 'evolve');
        };
        break;
      }
      case 'bone-pact': {
        // Pacto de Ossos: parte do dano que os aliados recebem vira escudo (ver skillGuard) e cada ferido ganha um esqueleto
        const allies = party.filter((h) => h.pos.distanceTo(this.pos) <= radius);
        if (!force && !allies.some((h) => h.hp / h.maxHp < 0.6)) return false;
        effect = () => {
          const seconds = scaleBranchEffect(this, 'support', skill.duration || 6) * (0.9 + 0.1 * power);
          let alive = units.filter((u) => u.summoner === this && !u.dead && !u.ultimate).length;
          for (const h of allies) {
            if (h.dead) continue;
            h.pactT = seconds; h.pactShare = skill.share || 0.3;
            FX.pactAura(h);
            if (h.hp < h.maxHp * 0.85 && alive < NECRO_MINION_MAX) {
              const side = h.pos.x >= this.pos.x ? 1 : -1;
              const bone = new Minion(this, side, { at: new THREE.Vector3(h.pos.x + side * 0.9, h.pos.y, h.pos.z + 0.7) });
              bone.life = seconds;
              alive++;
            }
          }
          wave(this.pos, color, 0.4, radius, 0.8, { opacity: 0.35, dust: true });
          popText(this.pos, 'Pacto!', 'evolve');
        };
        break;
      }
      case 'reap-mark': {
        // Ceifa: marca o inimigo mais ferido; se ele morrer, cura o grupo e encurta a recarga do slot 1
        const pool = targetPool.filter((s) => !s.totem && !(s.reapT > 0));
        const prey = pool.reduce((best, s) => (!best || s.hp / s.maxHp < best.hp / best.maxHp ? s : best), null);
        if (!prey || (!force && prey.hp / prey.maxHp >= 0.4)) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          prey.reapT = scaleBranchEffect(this, 'control', skill.duration || 6) * (0.9 + 0.1 * power);
          prey.reapBy = this;
          popText(prey.pos, 'Marcado!', 'crit');
          beam(this.pos.clone().setY(this.pos.y + 1.2), prey.pos.clone().setY(prey.pos.y + 1), color);
          FX.huntMark(prey, 'reapT', color);
        };
        break;
      }
      case 'vision-mark': {
        // Visão do Alvo: aliados próximos ganham chance de crítico e o inimigo mais frágil fica marcado (+10% de dano de todos)
        if (!force && enemies.length < 3) return false;
        effect = () => {
          const seconds = scaleBranchEffect(this, 'control', skill.duration || 5) * (0.9 + 0.1 * power);
          for (const h of party) if (!h.dead && h.pos.distanceTo(this.pos) <= radius) {
            h.critT = seconds; h.critBonus = skill.bonus || 0.25;
            FX.visionRing(h);
          }
          const weakest = skeletonsAlive().filter((s) => !s.spawning && !s.totem && s.pos.distanceTo(this.pos) <= radius + 0.4 * (s.size - 1))
            .reduce((best, s) => (!best || (s.boss ? 1e9 : 0) + s.hp < (best.boss ? 1e9 : 0) + best.hp ? s : best), null);
          if (weakest) {
            weakest.markT = Math.max(weakest.markT || 0, seconds);
            weakest.markBonus = Math.max(weakest.markBonus || 0, skill.mark || 0.1);
            FX.huntMark(weakest, 'markT', color);
          }
          wave(this.pos, color, 0.4, radius, 0.8, { opacity: 0.35, dust: true });
          popText(this.pos, 'Visão!', 'evolve');
        };
        break;
      }
      case 'time-echo': {
        // Eco Temporal: o agressor prioritário de um herói recebe de volta, 1,5 s depois, o dano recente que causou
        const now = game.runTime;
        const recent = targetPool.filter((s) => !s.totem && s.echoDmg > 0 && now - s.echoAt < 4 && party.some((h) => h.pos.distanceTo(s.pos) < 6));
        const prey = force && target && !target.groundTarget && targetPool.includes(target) ? target
          : highestPriorityHeroTarget(this, recent) || (force ? nearest(this.pos, targetPool) : null);
        if (!prey) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          const owed = prey.echoDmg > 0 && game.runTime - prey.echoAt < 4 ? prey.echoDmg : 0;
          prey.echoDmg = 0;
          const delay = skill.duration || 1.5;
          FX.timeEcho(prey, delay);
          after(delay, () => {
            if (prey.dead) return;
            prey.takeDamage(Math.max(owed, this.dmg * power * (skill.power || 1.2)), null, this);   // o piso mantém o eco útil contra golpes fracos
            popText(prey.pos, 'Eco!', 'crit');
            FX.combust(prey, 0x8feaff);
          });
        };
        break;
      }
      case 'ice-lance': {
        // Lança de gelo: atravessa a fila; quem já estava lento ou preso se estilhaça (dano dobrado)
        const reach = skill.range || 9;
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= reach);
        const chilled = (s) => s.slowT > 0 || s.rootT > 0;
        let aim = force && pool.includes(target) ? target : null, line = aim ? lineTargets(this.pos, aim.pos, pool, reach) : [];
        if (!aim) for (const s of pool) {
          const hits = lineTargets(this.pos, s.pos, pool, reach);
          const score = hits.length + hits.filter(chilled).length;
          if (score > line.length + line.filter(chilled).length) { line = hits; aim = s; }
        }
        if (!aim || (!force && line.length < 2 && !line.some(chilled) && !urgentEnemy)) return false;
        target = aim;
        effect = () => {
          const from = this.pos.clone(), end = from.clone().addScaledVector(new THREE.Vector3().subVectors(aim.pos, from).setY(0).normalize(), reach);
          for (const enemy of lineTargets(from, end, attackables.filter((s) => !s.dead && !s.spawning), reach)) {
            const shatter = chilled(enemy);
            damageOne(enemy, shatter ? 2 : 1);
            if (shatter) popText(enemy.pos, 'Estilhaço!', 'crit');
            enemy.slowT = Math.max(enemy.slowT || 0, scaleBranchEffect(this, 'control', 2) * power);
          }
          FX.zigzag(from, end);
          burst(aim.pos, [color, 0xffffff], 16, 4);
        };
        break;
      }
      case 'poison-blade': {
        // Lâmina envenenada: adaga arremessada que deixa veneno corroendo o alvo
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 7));
        const prey = force && pool.includes(target) ? target : highestPriorityHeroTarget(this, pool.filter((s) => !(s.burnT > 0)).length ? pool.filter((s) => !(s.burnT > 0)) : pool);
        if (!prey || (!force && !(prey.maxHp > this.dmg * 4) && !urgentEnemy)) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          damageOne(prey);
          prey.burnT = Math.max(prey.burnT || 0, scaleBranchEffect(this, 'control', skill.duration || 6));
          prey.burnTick = Math.min(prey.burnTick || 0.5, 0.35);
          prey.burnDmg = Math.max(prey.burnDmg || 0, this.dmg * power * 0.24);
          prey.burnOwner = this;
          popText(prey.pos, 'Envenenado!', 'crit');
          FX.zigzag(this.pos, prey.pos);
          column(prey.pos, color, 0.35, 2.2, 0.8, { follow: prey });
        };
        break;
      }
      case 'harpoon': {
        // Virote arpão: fisga um inimigo afastado (atiradores primeiro), puxa para a frente e prende
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 9) && (s.pos.distanceTo(this.pos) >= (skill.minRange || 3) || (force && s === target)));
        const preferred = pool.filter((s) => s.ranged || s.kind?.priority || ['Priest', 'Bomber'].includes(s.enemyKind));
        const prey = force && pool.includes(target) ? target : highestPriorityHeroTarget(this, preferred.length ? preferred : pool);
        if (!prey || (!force && !preferred.length && !urgentEnemy)) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          damageOne(prey);
          if (!prey.boss && !prey.totem) {
            const dest = prey.pos.clone().lerp(this.pos, 0.5);
            dest.y = world.groundHeight(dest.x, dest.z);
            if (world.canStep(prey.pos, dest)) prey.pos.copy(dest);
          }
          prey.rootT = Math.max(prey.rootT || 0, scaleBranchEffect(this, 'control', skill.duration || 1.6) * power);
          prey.pendingHit = null;
          FX.zigzag(this.pos, prey.pos);
          burst(prey.pos, [color, 0xffffff], 12, 3);
        };
        break;
      }
      case 'giant-shuriken': {
        // Shuriken gigante: corta a fila na ida e, meio segundo depois, na volta
        const reach = skill.range || 8;
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= reach);
        let aim = force && pool.includes(target) ? target : null, line = aim ? lineTargets(this.pos, aim.pos, pool, reach, 0.9) : [];
        if (!aim) for (const s of pool) {
          const hits = lineTargets(this.pos, s.pos, pool, reach, 0.9);
          if (hits.length > line.length) { line = hits; aim = s; }
        }
        const loneTarget = line.length === 1 && !line[0].boss && !line[0].totem;
        if (!aim || (!force && line.length < 2 && !urgentEnemy && !loneTarget)) return false;
        target = aim;
        effect = () => {
          const from = this.pos.clone(), end = from.clone().addScaledVector(new THREE.Vector3().subVectors(aim.pos, from).setY(0).normalize(), reach);
          const pass = () => {
            const hit = lineTargets(from, end, skeletonsAlive().filter((s) => !s.dead && !s.spawning), reach, 0.9);
            const singleTargetBonus = hit.length === 1 && !hit[0].boss && !hit[0].totem ? 1.25 : 1;
            for (const enemy of hit) { damageOne(enemy, singleTargetBonus); FX.bladeCut(enemy, this, 0); }
          };
          pass();
          const mesh = groundMark(end, 0.6, color, 0.2);
          flames.push({ mesh, radius: 0.1, owner: this, wait: 0.5, t: 0.05, tick: 0, every: 1, dmg: 0, onTick: () => { pass(); FX.steelDash(end, from); } });
          FX.steelDash(from, end);
        };
        break;
      }
      case 'disarm': {
        // Desarmar: um golpe no inimigo que está batendo (ou no mais forte ao alcance) e, por alguns segundos, os ataques dele causam menos dano
        const reach = skill.range || 5;
        const pool = attackables.filter((s) => !s.dead && !s.spawning && !s.totem && s.pos.distanceTo(this.pos) <= reach + 0.4 * (s.size - 1) && Math.abs(s.pos.y - this.pos.y) < 0.85);
        const fresh = pool.filter((s) => !(s.disarmT > 1));
        const striking = fresh.filter((s) => s.pendingHit?.target?.team === 'hero');
        const strongest = (list) => list.reduce((best, s) => (!best || s.dmg > best.dmg ? s : best), null);
        const aim = force && pool.includes(target) ? target : strongest(striking) || strongest(fresh);
        if (!aim) return false;
        target = aim;
        effect = () => {
          if (aim.dead) return;
          const from = this.pos.clone(), dir = new THREE.Vector3().subVectors(aim.pos, this.pos).setY(0);
          if (dir.length() > this.range + 0.5 * aim.size) {   // entra no alcance do golpe com um passo rápido
            dir.normalize();
            const dest = aim.pos.clone().addScaledVector(dir, -(this.range * 0.7 + 0.3 * aim.size));
            if (world.canStep(this.pos, dest)) { this.pos.copy(dest).setY(world.groundHeight(dest.x, dest.z)); this.vel.set(0, 0, 0); FX.steelDash(from, this.pos); }
          }
          this.face(aim.pos, 1);
          damageOne(aim);
          aim.disarmT = Math.max(aim.disarmT || 0, scaleBranchEffect(this, 'control', skill.duration || 4) * (0.9 + 0.1 * power));
          aim.disarmCut = aim.boss ? 0.25 : 0.5;   // chefe só perde 25% do dano
          FX.slashX(aim, this);
          FX.statusMark(aim, 'disarmT', color);
          popText(aim.pos, 'Desarmado!', 'crit');
        };
        break;
      }
      case 'thorn-vines': {
        // Vinhas espinhosas: área de espinhos que fere e deixa lento quem continuar nela
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 8));
        const ground = force && target?.groundTarget ? target : null;
        const { center, count } = densest(pool, skill.radius || 2.6, force && !ground ? target : null);
        const spot = ground || center;
        if (!spot || (!ground && !force && count < 2 && !urgentEnemy)) return false;
        target = spot;
        const at = spot.pos.clone(), area = (skill.radius || 2.6) * (0.9 + 0.1 * power);
        effect = () => {
          const mesh = groundMark(at, area, 0x2f5a1c, 0.4);
          flames.push({ mesh, radius: area, owner: this, t: scaleBranchEffect(this, 'control', skill.duration || 5) * power, tick: 0, every: 0.5,
            dmg: this.dmg * power * (skill.pulse || 0.18), onTick: (f) => {
              for (const s of skeletonsAlive()) if (!s.dead && !s.spawning && s.pos.distanceTo(f.mesh.position) <= f.radius + 0.4 * (s.size - 1)) s.slowT = Math.max(s.slowT || 0, 0.8);
            } });
          for (const s of attackables) if (!s.dead && !s.spawning && s.pos.distanceTo(at) <= area) FX.roots(s);
          burst(at, [color, 0x2f5a1c], 16, 3);
        };
        break;
      }
      case 'protection-vow': {
        // Voto de Proteção: por alguns segundos, o próximo golpe que mataria cada aliado próximo o deixa com 1 de vida (uma vez por aliado, sem curar)
        const reach = skill.range || 8;
        const allies = party.filter((h) => h.pos.distanceTo(this.pos) <= reach);
        const needy = allies.filter((h) => !(h.vowT > 0));
        const danger = enemies.some((s) => s.boss || s.kind?.priority || ['Bomber', 'Priest'].includes(s.enemyKind) || s.telegraph?.interruptible && s.telegraph.t > 0);
        if (!force && (!needy.length || !(danger || needy.some((h) => h.hp / h.maxHp < 0.5)))) return false;
        effect = () => {
          const seconds = scaleBranchEffect(this, 'support', skill.duration || 8);
          for (const h of party) if (!h.dead && h.pos.distanceTo(this.pos) <= reach) {
            h.vowT = seconds;
            column(h.pos, color, 0.4, 2, 0.5, { follow: h, opacity: 0.25 });
          }
          popText(this.pos, 'Voto!', 'evolve');
          wave(this.pos, color, 0.3, reach, 0.7, { opacity: 0.4 });
        };
        break;
      }
      case 'sky-lance': {
        // Lança celestial: luz concentrada no inimigo mais forte; ampara o aliado mais perto dele
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 9));
        const worth = (s) => (s.boss || s.totem ? 1e6 : 0) + s.hp;
        const prey = force && pool.includes(target) ? target : pool.reduce((best, s) => (!best || worth(s) > worth(best) ? s : best), null);
        if (!prey || (!force && !prey.boss && !urgentEnemy && prey.hp < this.dmg * 3)) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          damageOne(prey);
          const ally = nearest(prey.pos, party);
          if (ally) {
            const heal = Math.min(ally.maxHp - ally.hp, scaleBranchEffect(this, 'support', 8 + level * 3) * power);
            if (heal > 0) { ally.hp += heal; this.stats.cura += heal; popText(ally.pos, '+' + Math.round(heal), 'heal'); }
          }
          FX.rays(prey.pos, 'holy', 0.5, 8, 0.7);
          column(prey.pos, color, 0.45, 6, 0.5);
          burst(prey.pos, [color, 0xffffff], 18, 4);
        };
        break;
      }
      case 'rewind': {
        // Rebobinar: a vida dos aliados próximos volta a como estava 3 s atrás (só se for maior)
        const back = (h) => (h.hpHistory.length ? Math.min(h.maxHp, h.hpHistory[0]) : h.hp);
        const allies = party.filter((h) => h.pos.distanceTo(this.pos) <= radius);
        const lost = allies.filter((h) => back(h) - h.hp > h.maxHp * 0.15);
        if (!force && !lost.length) return false;
        effect = () => {
          for (const h of allies) {
            const heal = back(h) - h.hp;
            if (heal <= 0) continue;
            h.hp += heal; this.stats.cura += heal;
            popText(h.pos, '+' + Math.round(heal), 'heal');
            FX.rays(h.pos, 'arcane', 0.4, 3, 0.6, { follow: h });
          }
          popText(this.pos, 'Rebobinar!', 'evolve');
          wave(this.pos, color, 0.3, radius * 0.6, 0.7);
        };
        break;
      }
      case 'snare-trap': {
        // Armadilha: armada no caminho do inimigo mais próximo; prende e fere quem pisar
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 9));
        const ground = force && target?.groundTarget ? target : null;
        const prey = ground ? null : force && pool.includes(target) ? target : nearest(this.pos, pool);
        if (!ground && !prey) return false;
        const at = ground ? ground.pos.clone() : prey.pos.clone().addScaledVector(new THREE.Vector3().subVectors(this.pos, prey.pos).setY(0).normalize(), Math.min(1.2, prey.pos.distanceTo(this.pos) * 0.3));
        at.y = world.groundHeight(at.x, at.z);
        target = ground || prey;
        const trigger = skill.radius || 1.4;
        effect = () => {
          const mesh = groundMark(at, trigger, 0x5a4026, 0.5);
          flames.push({ mesh, radius: trigger, owner: this, wait: 0.3, t: 12, tick: 0, every: 0.1, dmg: 0, onTick: (f) => {
            const caught = skeletonsAlive().filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(f.mesh.position) <= f.radius + 0.4 * (s.size - 1));
            if (!caught.length) return;
            for (const s of caught) {
              heroHit(this, s, this.dmg * power * (skill.power || 1.4), f.mesh.position);
              s.rootT = Math.max(s.rootT || 0, scaleBranchEffect(this, 'control', (s.boss ? 0.5 : 1) * (skill.duration || 2.5)) * power);
              s.pendingHit = null;
              FX.roots(s);
            }
            popText(f.mesh.position, 'Presa!', 'crit');
            f.t = 0;
          } });
          burst(at, [color, 0x5a4026], 10, 2.5);
        };
        break;
      }
      case 'chi-transfer': {
        // Chi compartilhado: o Monge doa vida ao aliado mais ferido, que recebe o dobro
        const allies = party.filter((h) => h !== this && h.pos.distanceTo(this.pos) <= (skill.range || 8));
        const ally = allies.reduce((best, h) => (!best || h.hp / h.maxHp < best.hp / best.maxHp ? h : best), null);
        if (!force && (!ally || ally.hp / ally.maxHp > 0.8 || this.hp < this.maxHp * 0.5)) return false;
        const receiver = ally || this;
        target = receiver;
        effect = () => {
          const cost = receiver === this ? 0 : Math.min(this.hp - 1, this.maxHp * 0.15);
          const heal = Math.min(receiver.maxHp - receiver.hp, scaleBranchEffect(this, 'support', receiver === this ? this.maxHp * 0.1 : cost * 2));
          this.hp -= cost;
          if (heal > 0) { receiver.hp += heal; this.stats.cura += heal; popText(receiver.pos, '+' + Math.round(heal), 'heal'); }
          if (receiver !== this) FX.zigzag(this.pos, receiver.pos);
          FX.calmPulse(this, 2, [receiver]);
        };
        break;
      }
      case 'daily-plate': {
        // Prato do Dia: o aliado que está em combate ganha ataque mais rápido e um escudo curto
        const ally = party.filter((h) => h.pos.distanceTo(this.pos) <= (skill.range || 8) && h.engagedWith && !h.engagedWith.dead && !(h.songT > 1.5))
          .reduce((best, h) => (!best || h.hp / h.maxHp < best.hp / best.maxHp ? h : best), null);
        if (!ally && !force) return false;
        const served = ally || party.find((h) => h.pos.distanceTo(this.pos) <= (skill.range || 8)) || this;
        target = served;
        effect = () => {
          if (served.dead) return;
          served.songT = Math.max(served.songT, (skill.duration || 6) * (0.9 + 0.1 * power));
          served.songHaste = Math.min(served.songHaste || 1, 1 / (1 + (skill.haste || 0.25)));
          served.guardT = Math.max(served.guardT, 3 * power);
          popText(served.pos, 'Prato do dia!', 'evolve');
          FX.foodToss(this, served.pos, 0.35);
          FX.foodPop(served.pos);
        };
        break;
      }
      case 'feast': {
        // Banquete: mesa no chão em volta da Cozinheira; cura em pulsos e encurta as recargas (nunca zera)
        effect = () => cookFeast(this, this.pos.clone().addScaledVector(this.fwd, 1.2), radius, (skill.duration || 6) * (0.9 + 0.1 * power), skill.haste || 0.25);
        break;
      }
      case 'spice': {
        // Tempero forte: os aliados próximos batem mais forte por alguns segundos
        effect = () => {
          const duration = scaleBranchEffect(this, 'support', skill.duration || 6) * (0.9 + 0.1 * power);
          for (const h of party) if (h.pos.distanceTo(this.pos) <= radius) {
            h.royalT = Math.max(h.royalT, duration);
            h.royalBonus = Math.max(h.royalBonus, skill.bonus || 0.15);
            popText(h.pos, 'Tempero!', 'evolve');
          }
          FX.foodPop(this.pos, radius);
        };
        break;
      }
      case 'giant-elixir': {
        // Elixir do gigante: o aliado na linha de frente bate mais forte, aguenta mais e se cura
        const allies = party.filter((h) => h !== this && h.pos.distanceTo(this.pos) <= (skill.range || 8));
        const front = allies.filter((h) => h.engagedWith && !h.engagedWith.dead && !h.ranged);
        const pickFrom = front.length ? front : allies;
        const ally = pickFrom.reduce((best, h) => (!best || h.maxHp > best.maxHp ? h : best), null);
        if (!force && !front.length) return false;
        const drinker = ally || this;
        target = drinker;
        effect = () => {
          const duration = scaleBranchEffect(this, 'support', skill.duration || 7) * (0.9 + 0.1 * power);
          drinker.royalT = Math.max(drinker.royalT, duration);
          drinker.royalBonus = Math.max(drinker.royalBonus, skill.bonus || 0.3);
          drinker.guardT = Math.max(drinker.guardT, duration * 0.6);
          const heal = Math.min(drinker.maxHp - drinker.hp, drinker.maxHp * 0.1 * power);
          if (heal > 0) { drinker.hp += heal; this.stats.cura += heal; popText(drinker.pos, '+' + Math.round(heal), 'heal'); }
          popText(drinker.pos, 'Gigante!', 'evolve');
          FX.flaskToss(this, drinker.pos, 0.35);
          column(drinker.pos, color, 0.6, 3, 0.8, { follow: drinker });
        };
        break;
      }
      case 'magnet-pull': {
        // Ímã magnético: junta os inimigos ao redor da torre (ou à frente) e os deixa lentos
        const center = (ownSentry ? ownSentry.root.position : this.pos.clone().addScaledVector(this.fwd, 3)).clone();
        const caught = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(center) <= radius);
        if (!force && caught.length < 3) return false;
        effect = () => {
          for (const s of caught) {
            if (s.dead) continue;
            const pull = new THREE.Vector3().subVectors(center, s.pos).setY(0);
            s.vel.add(pull.multiplyScalar(s.boss ? 0.3 : 1.6));
            s.slowT = Math.max(s.slowT || 0, scaleBranchEffect(this, 'control', skill.duration || 1.5) * power);
            damageOne(s);
            FX.zigzag(center, s.pos);
          }
          wave(center, color, radius, 0.3, 0.7);
          burst(center.clone().setY(center.y + 0.8), [color, 0xffffff], 20, 4);
        };
        break;
      }
      case 'sic-em': {
        // Comando de ataque: a fera salta no alvo prioritário e o faz sangrar; sem fera, uma rede o prende
        const pool = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= (skill.range || 10));
        const prey = force && pool.includes(target) ? target : highestPriorityHeroTarget(this, pool);
        if (!prey || (!force && !ownBeast)) return false;
        target = prey;
        effect = () => {
          if (prey.dead) return;
          const beast = units.find((unit) => unit.beastCompanion && unit.summoner === this && !unit.dead);
          if (beast) {
            const from = beast.pos.clone(), dir = new THREE.Vector3().subVectors(prey.pos, from).setY(0).normalize();
            const dest = prey.pos.clone().addScaledVector(dir, -(0.8 + 0.3 * prey.size));
            if (world.canStep(prey.pos, dest)) beast.pos.copy(dest).setY(world.groundHeight(dest.x, dest.z));
            heroHit(this, prey, this.dmg * power * (skill.power || 1.4));
            prey.burnT = Math.max(prey.burnT || 0, scaleBranchEffect(this, 'control', skill.duration || 4));
            prey.burnTick = Math.min(prey.burnTick || 0.5, 0.35);
            prey.burnDmg = Math.max(prey.burnDmg || 0, this.dmg * power * 0.2);
            prey.burnOwner = this;
            FX.shadowStep(from, beast.pos);
            popText(prey.pos, 'Mordida!', 'crit');
          } else {
            damageOne(prey, 0.5);
            prey.rootT = Math.max(prey.rootT || 0, scaleBranchEffect(this, 'control', 2) * power);
            prey.pendingHit = null;
            FX.roots(prey);
            popText(prey.pos, 'Rede!', 'crit');
          }
          burst(prey.pos, [color, 0xffffff], 14, 3.5);
        };
        break;
      }
      case 'mirror-swap': {
        // Troca de Lugar: o aliado ameaçado vai para trás e o Ilusionista assume o lugar, com uma imagem ao lado; sem aliado em perigo, salta para trás
        const hunted = (h) => attackables.some((s) => !s.dead && !s.spawning && (s.pendingHit?.target === h || (s.target === h && s.pos.distanceTo(h.pos) <= 3)));
        const ally = party.filter((h) => h !== this && h.pos.distanceTo(this.pos) <= (skill.range || 9) && h.hp / h.maxHp <= 0.75 && hunted(h))
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || null;
        const threats = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= 2.8);
        if (!force && !ally && !threats.length) return false;
        let dest = null;
        if (!ally) {
          const away = new THREE.Vector3();
          for (const s of threats) away.add(tmp.subVectors(this.pos, s.pos).setY(0).normalize());
          if (away.lengthSq() < 0.01) away.copy(this.fwd).multiplyScalar(-1);
          away.setY(0).normalize();
          for (const step of [5, 3.5, 2.2]) {
            const p = this.pos.clone().addScaledVector(away, step);
            if (world.canStep(this.pos, p)) { dest = p; break; }
          }
          if (!dest && !force) return false;
        }
        target = ally;
        effect = () => {
          const here = this.pos.clone(), life = scaleBranchEffect(this, 'control', skill.duration + 1.5) * power;
          let center = here, image;
          if (ally && !ally.dead) {
            const there = ally.pos.clone();
            this.pos.copy(there).setY(world.groundHeight(there.x, there.z));
            ally.pos.copy(here).setY(world.groundHeight(here.x, here.z));
            this.vel.set(0, 0, 0); ally.vel.set(0, 0, 0);
            center = there;
            FX.shadowStep(here, there);
          } else if (dest) {
            this.pos.copy(dest).setY(world.groundHeight(dest.x, dest.z));
            this.vel.set(0, 0, 0);
            FX.shadowStep(here, this.pos);
          }
          const caught = skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(center) <= radius + 0.4 * (s.size - 1));
          const foe = nearest(center, caught);
          image = new Illusion(this, illusionSpot(ally ? this : { pos: center, fwd: this.fwd }, foe ? foe.pos : center.clone().add(this.fwd), ally ? 1.6 : 0.01), { kind: 'swap', life, hits: 1 });
          illusionProvoke(caught, image, scaleBranchEffect(this, 'control', skill.duration) * power);
          popText(image.pos, ally ? 'Troca!' : 'Imagem!', 'evolve');
        };
        break;
      }
      case 'panic': {
        // Pânico: os inimigos comuns em volta do alvo atacam o vizinho mais próximo (com metade do dano) em vez dos heróis; chefe só desacelera
        const commons = enemies.filter((s) => !s.boss && !s.totem);
        const { center: anchor, count } = densest(commons, radius, force && commons.includes(target) ? target : null);
        if (!anchor) return false;
        if (!force && count < 3 && !(count >= 2 && (criticalAlly || missingHp > this.maxHp * 0.3))) return false;
        target = anchor;
        effect = () => {
          const center = anchor.dead ? this.pos.clone() : anchor.pos.clone();
          const seconds = scaleBranchEffect(this, 'control', skill.duration || 3) * (0.9 + 0.1 * power);
          for (const s of skeletonsAlive()) {
            if (s.spawning || s.totem || s.pos.distanceTo(center) > radius + 0.4 * (s.size - 1)) continue;
            if (s.boss) { controlEnemy(s, 'slowT', seconds); continue; }
            s.panicT = Math.max(s.panicT, seconds); s.panicVictim = null; s.panicLook = 0; s.pendingHit = null;
            FX.statusMark(s, 'panicT', color);
          }
          wave(center, color, 0.3, radius, 0.8, { opacity: 0.5 });
          FX.illusionSmoke(center, 4);
          popText(center, 'Pânico!', 'evolve');
        };
        break;
      }
      case 'dazzle': {
        // Ofuscar: névoa de luz nos olhos dos inimigos próximos: erram parte dos golpes por alguns segundos (chefe, menos)
        const hitsHero = (s) => s.pendingHit?.target?.team === 'hero' || (s.target?.team === 'hero' && s.pos.distanceTo(s.target.pos) <= (s.range || 1.5) + 1.5);
        const attacking = enemies.filter((s) => !s.totem && !(s.blindT > 1) && hitsHero(s));
        if (!force && attacking.length < 2) return false;
        effect = () => {
          const seconds = scaleBranchEffect(this, 'control', skill.duration || 4) * (0.9 + 0.1 * power);
          for (const s of skeletonsAlive()) {
            if (s.spawning || s.totem || s.pos.distanceTo(this.pos) > radius + 0.4 * (s.size - 1)) continue;
            s.blindT = Math.max(s.blindT, seconds);
            s.blindMiss = s.boss ? 0.25 : 0.5;
            FX.statusMark(s, 'blindT', color);
          }
          wave(this.pos, color, 0.3, radius, 0.7, { opacity: 0.5 });
          FX.illusionSmoke(this.pos, 3);
          popText(this.pos, 'Ofuscar!', 'evolve');
        };
        break;
      }
      case 'rune-ward': {
        // Runas de grupo: runa fraca (absorve pouco, dura mais) em todos os aliados próximos
        const allies = party.filter((h) => h.pos.distanceTo(this.pos) <= radius);
        const amount = scaleBranchEffect(this, 'support', 10 + level * 3) * power;
        if (!force && (!enemies.length || allies.every((h) => h.runeHp >= amount))) return false;
        effect = () => {
          for (const h of allies) if (!h.dead) runeShieldOn(h, this, amount, skill.duration || 12);
          wave(this.pos, RUNE_COLOR, 0.3, radius, 0.6, { dust: true, opacity: 0.6 });
          popText(this.pos, 'Runas!', 'heal');
        };
        break;
      }
      case 'rune-dome': {
        // Cúpula rúnica: ninguém dentro cai abaixo de 1 de vida e a cúpula afasta os inimigos que a tocam
        if (!force && !criticalAlly && enemies.length < 3 && !urgentEnemy) return false;
        effect = () => {
          raiseRuneDome(this, this.pos, radius, scaleBranchEffect(this, 'support', skill.duration || 6) * (0.9 + 0.1 * power));
          // ao erguer: aliados dentro ganham uma runa e os inimigos dentro são lançados para fora e atrasados
          for (const h of party) if (!h.dead && h.pos.distanceTo(this.pos) <= radius) runeShieldOn(h, this, scaleBranchEffect(this, 'support', 14 + level * 3) * power, skill.duration || 6);
          for (const enemy of enemies) if (!enemy.dead && enemy.pos.distanceTo(this.pos) <= radius + 0.4 * (enemy.size - 1)) {
            runePushAway(enemy, this.pos, enemy.boss ? 3 : 14);
            controlEnemy(enemy, 'slowT', 2 * power);
          }
        };
        break;
      }
      case 'rune-pulse': {
        // Pulso rúnico: afasta e atrasa quem está colado e deixa uma runa pequena em quem lançou
        if (!force && !enemies.some((s) => s.pos.distanceTo(this.pos) <= radius)) return false;
        effect = () => {
          for (const enemy of enemies) if (!enemy.dead && enemy.pos.distanceTo(this.pos) <= radius + 0.4 * (enemy.size - 1)) {
            runePushAway(enemy, this.pos, enemy.boss ? 2 : 9);
            controlEnemy(enemy, 'slowT', scaleBranchEffect(this, 'control', skill.duration || 1.5) * power);
          }
          if (!(this.runeHp > 0)) runeShieldOn(this, this, scaleBranchEffect(this, 'support', 10 + level * 2) * power, 6);
          wave(this.pos, RUNE_COLOR, 0.3, radius, 0.5, { dust: true, opacity: 0.7 });
          burst(this.pos.clone().setY(this.pos.y + 1), [RUNE_COLOR, 0xffffff], 8, 5);
        };
        break;
      }
      case 'omen': {
        // Presságio: cada aliado próximo esquiva o próximo dano nos próximos segundos
        const allies = party.filter((h) => h.pos.distanceTo(this.pos) <= radius);
        const warned = attackables.some((s) => s.telegraph?.t > 0);
        if (!force && !warned && !criticalAlly && enemies.length < 4) return false;
        effect = () => {
          const duration = scaleBranchEffect(this, 'control', skill.duration || 5);
          for (const h of allies) { h.omenT = duration; FX.rays(h.pos, 'arcane', 0.35, 3, 0.6, { follow: h }); }
          popText(this.pos, 'Presságio!', 'evolve');
          wave(this.pos, color, 0.2, radius * 0.6, 0.7);
        };
        break;
      }
      case 'summon':
        effect = () => {
          // Exército dos Mortos: seis esqueletos brotam da terra em círculo; a onda de ossos empurra e atordoa de leve quem está perto
          for (const unit of units.filter((unit) => unit.summoner === this)) { poof(unit.pos); unit.remove(); }
          const army = [];
          for (let i = 0; i < LEGION_SIZE; i++) {
            const a = (i / LEGION_SIZE) * Math.PI * 2 + 0.35;
            let r = radius * 0.7;
            const at = new THREE.Vector3();
            for (; r > 0.8; r -= 0.5) {   // sem obstáculo no caminho; se não couber, fecha o círculo
              at.set(this.pos.x + Math.cos(a) * r, this.pos.y, this.pos.z + Math.sin(a) * r);
              if (world.canStep(this.pos, at)) break;
            }
            if (r <= 0.8) at.set(this.pos.x + Math.cos(a) * 0.9, this.pos.y, this.pos.z + Math.sin(a) * 0.9);
            army.push(new Minion(this, 0, { ultimate: true, at, riseDelay: 0.08 * i }));
          }
          for (const enemy of skeletonsAlive()) {
            if (enemy.spawning || enemy.pos.distanceTo(this.pos) > radius + 0.4 * (enemy.size - 1)) continue;
            heroHit(this, enemy, this.dmg * power * (skill.power || 1));
            controlEnemy(enemy, 'stunT', scaleBranchEffect(this, 'control', 0.7));
            enemy.vel.add(tmp.subVectors(enemy.pos, this.pos).setY(0).normalize().multiplyScalar(enemy.boss ? 1.5 : 5));
          }
          FX.legion(this, army, radius);
        };
        break;
      case 'light-legion':
        effect = () => {
          // Legião de Luz: mini-paladinos brotam em círculo em volta do grupo, seguram a linha e provocam de leve
          for (const unit of units.filter((unit) => unit.lightKnight && unit.summoner === this)) { poof(unit.pos); unit.remove(); }
          const army = [];
          for (let i = 0; i < LIGHT_KNIGHTS; i++) {
            const a = (i / LIGHT_KNIGHTS) * Math.PI * 2 + 0.3;
            let r = radius * 0.7;
            const at = new THREE.Vector3();
            for (; r > 0.8; r -= 0.5) {
              at.set(this.pos.x + Math.cos(a) * r, this.pos.y, this.pos.z + Math.sin(a) * r);
              if (world.canStep(this.pos, at)) break;
            }
            if (r <= 0.8) at.set(this.pos.x + Math.cos(a) * 0.9, this.pos.y, this.pos.z + Math.sin(a) * 0.9);
            army.push(new LightKnight(this, at, i, scaleBranchEffect(this, 'support', skill.duration || 12)));
          }
          FX.knights(this, army, radius);
          popText(this.pos, 'Legião!', 'evolve');
        };
        break;
      case 'loaded-dice': {
        // Dados Viciados: o dado (1–6) define o bônus de dano e o escudo do grupo; o 1 ainda ajuda
        if (!force && !party.some((h) => !(h.royalT > 2))) return false;
        effect = () => {
          const roll = 1 + Math.floor(Math.random() * 6), seconds = (skill.duration || 6) * (0.9 + 0.1 * power);
          const bonus = 0.1 + 0.04 * roll, shield = scaleBranchEffect(this, 'support', 4 + 3 * roll) * power;
          for (const h of party) {
            h.royalT = Math.max(h.royalT, seconds);
            h.royalBonus = Math.max(h.royalBonus, bonus);
            runeShieldOn(h, this, shield, seconds);
          }
          popText(this.pos, roll === 6 ? 'Dados: 6!' : `Dados: ${roll}`, 'evolve');
          FX.cardFlutter(this.pos, 6, 1.4);
          wave(this.pos, color, 0.2, 4, 0.5, { opacity: 0.4 });
        };
        break;
      }
      case 'all-in': {
        // All-in: chuva de cartas na área; os 4 naipes valem ao mesmo tempo e o Royal Flush (20%) dobra tudo
        const { center } = densest(enemies, radius, force && enemies.includes(target) ? target : null);
        if (!center) return false;
        target = center;
        const at = center.pos.clone(), base = this.dmg * power * (skill.power || 1);
        effect = () => {
          const flush = Math.random() < ROYAL_FLUSH_CHANCE, mult = flush ? 2 : 1;
          bardSuit(this, null, 0, mult, true);
          bardSuit(this, null, 3, mult, true);
          for (const enemy of skeletonsAlive()) if (!enemy.spawning && enemy.pos.distanceTo(at) <= radius + 0.4 * (enemy.size - 1)) bardSuit(this, enemy, 2, mult);
          cardStorm(this, at, radius, base * mult);
          popText(at, flush ? 'ROYAL FLUSH!' : 'All-in! ♥♠♦♣', 'crit');
          if (flush) { shake(0.25); burst(at.clone().setY(at.y + 1), [0xffd84a, 0xff6a7a], 16, 5); }
        };
        break;
      }
      case 'bluff': {
        // Blefe: embaralha as recargas das técnicas dos aliados (nunca piora) e deixa pronta a que estava mais perto
        const slots = party.filter((h) => h !== this && h.pos.distanceTo(this.pos) <= radius)
          .flatMap((h) => h.skillTimers.map((t, i) => ({ h, i, t })).filter((x) => x.i !== 2 && x.t > 0.5));
        if (!force && slots.reduce((sum, x) => sum + Math.min(x.t, 12), 0) < 12) return false;
        effect = () => {
          const live = slots.filter((x) => x.h.skillTimers[x.i] > 0);
          const times = live.map((x) => x.h.skillTimers[x.i]);
          for (let i = times.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [times[i], times[j]] = [times[j], times[i]]; }
          live.forEach((x, i) => { x.h.skillTimers[x.i] = Math.min(x.h.skillTimers[x.i], times[i]); });
          const soon = live.reduce((best, x) => (!best || x.h.skillTimers[x.i] < best.h.skillTimers[best.i] ? x : best), null);
          if (soon) { soon.h.skillTimers[soon.i] = 0; popText(soon.h.pos, 'Pronto!', 'heal'); }
          for (const x of live) FX.cardThrow(this, x.h.pos, 1);
          popText(this.pos, 'Blefe!', 'evolve');
          FX.cardFlutter(this.pos, 6, 1.4);
        };
        break;
      }
      default: return false;
    }

    const [, pace, at, sound] = SKILL_MOVES[this.cfg.id];
    this.face(target ? target.pos : this.pos.clone().add(this.fwd), 1);
    this.busy = this.skillBody(slot, pace * (skill.ultimate ? 0.82 : 0.92), skill.ultimate);
    const hitAt = this.busy * at;
    const pending = { target, skill, slot, meteorImpact: meteorImpactAt, effect: null, t: hitAt };
    pending.effect = () => { audio.play(sound); FX.release(this, skill.ultimate, skill.effect === 'meteor' ? 0 : radius); this.ultHit = !!skill.ultimate; effect(); this.ultHit = false; FX.element(this, skill, target, pending.meteorImpact); if (skill.effect !== 'arcane-echo') this.fireEcho(skill); };
    this.pendingHit = pending;
    FX.charge(this, hitAt);
    this.skillTimers[slot] = this.skillMaxes[slot] = cooldownForSkill(this.cfg, slot, level, this.skillRate);
    relicAfterCast(this, slot, !!skill.ultimate);
    passiveHook(this, 'onCast', slot);
    this.stats.habilidades++;
    if (skill.ultimate) game.ultimates = (game.ultimates || 0) + 1;
    return true;
  }

  // Toca o corpo da habilidade (SKILL_ANIMS) no mesmo tempo de antes: duração e impacto vêm do clipe de SKILL_MOVES.
  skillBody(slot, pace, ultimate = false) {
    const [base, , at] = SKILL_MOVES[this.cfg.id];
    const busy = (this.action(base)?.getClip().duration || 1) / pace, hit = busy * at;
    const e = SKILL_ANIMS[this.cfg.id]?.[slot] || { clip: base, f: at };
    this.endSkillBody();
    const lead = e.hold ? Math.min(0.3, hit * 0.5) : hit;   // com pose segurada, o golpe só começa perto do impacto
    if (e.hold) {
      const a = this.action(e.hold);
      if (a) {
        this.flushAnimation();
        a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        a.timeScale = 1;
        if (this.current && this.current !== a) a.crossFadeFrom(this.current, 0.15, false);
        this.current = a;
      } else this.fitSkillClip(e.clip, e.f ?? at, lead);
    } else this.fitSkillClip(e.clip, e.f ?? 0.5, lead);
    this.skillMove = { e, t: 0, busy, hit, lead, ultimate, spun: 0, released: !e.hold, fired: false, color: FX.skillColor(this) ?? 0xffffff };
    return busy;
  }

  // ajusta o timeScale para o impacto do clipe (fração f) cair no fim da janela; clipe longo pula o começo
  // em vez de correr demais (no máximo 1,6x até o impacto)
  fitSkillClip(name, f, window) {
    const a = this.action(name);
    if (!a) return;
    const impact = f * a.getClip().duration, w = Math.max(0.05, window);
    const start = Math.max(0, impact - w * 1.6);
    this.once(name, THREE.MathUtils.clamp((impact - start) / w, 0.35, 3), 0.15);
    a.time = start;
  }

  // armas nas mãos (handslots) brilham durante a carga
  weaponMaterials() {
    if (this.weaponMats) return this.weaponMats;
    this.weaponMats = [];
    this.root.traverse((slot) => {
      if (!/^handslot[lr]$/i.test(slot.name)) return;
      slot.traverse((o) => {
        let shown = true;
        for (let p = o; p && p !== slot; p = p.parent) shown &&= p.visible;
        if (o.isMesh && shown && o.material?.emissive && !this.weaponMats.some((w) => w.mat === o.material)) this.weaponMats.push({ mat: o.material, base: o.material.emissive.clone() });
      });
    });
    return this.weaponMats;
  }

  endSkillBody() {
    if (!this.skillMove) return;
    this.skillMove = null;
    this.lift = 0;
    this.root.rotation.x = 0;
    for (const w of this.weaponMaterials()) w.mat.emissive.copy(w.base);
  }

  // detalhes procedurais da habilidade: pose segurada, salto/levitação, giro, inclinação, brilho, rastro e passo
  tickSkillBody(dt) {
    const m = this.skillMove;
    if (!m) return;
    if (this.dead || game.over) { this.endSkillBody(); return; }
    const { e } = m;
    m.t += dt;
    if (!m.released && m.t >= m.hit - m.lead) {
      m.released = true;
      if (this.current === this.action(e.hold)) this.fitSkillClip(e.clip, e.f ?? 0.5, m.lead);
    }
    const fwd = tmp.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    if (!m.fired && m.t >= m.hit) {
      m.fired = true;
      if (e.arc) FX.swing(this, e.arc, m.color, m.ultimate);
      if (e.kick) this.vel.addScaledVector(fwd, e.kick);
    }
    const toHit = Math.min(1, m.t / Math.max(0.05, m.hit));
    this.lift = (e.hop ? e.hop * Math.sin(Math.PI * toHit) : 0)
      + (e.float ? e.float * Math.sin(Math.PI * Math.min(1, m.t / m.busy)) : 0);
    if (e.lean) this.root.rotation.x = e.lean * Math.sin(Math.PI * Math.min(1, m.t / (m.hit + 0.3)));
    if (e.spin) {   // as voltas completas terminam na mesma direção em que começaram
      const s = THREE.MathUtils.clamp((m.t - m.hit + 0.3) / 0.55, 0, 1), p = s * s * (3 - 2 * s) * e.spin * Math.PI * 2;
      this.root.rotation.y += p - m.spun;
      m.spun = p;
    }
    const k = m.t < m.hit ? (m.ultimate ? 1.1 : 0.8) * toHit ** 1.5 : Math.max(0, 1 - (m.t - m.hit) / 0.3);
    for (const w of this.weaponMaterials()) w.mat.emissive.setHex(m.color).multiplyScalar(k * (0.75 + 0.25 * Math.sin(m.t * 30))).add(w.base);
    if (m.t >= Math.max(m.busy, m.hit + 0.35)) this.endSkillBody();
  }

  // Dança de lâminas: a cada volta corta todos ao redor e desliza devagar para o meio dos inimigos
  updateBladeDance(dt) {
    this.bladeDanceT -= dt;
    if (this.dead || game.over) { this.bladeDanceT = 0; return; }
    this.bladeDanceTick -= dt;
    if (this.bladeDanceTick > 0) return;
    this.bladeDanceTick += BLADE_DANCE_TICK;
    const { radius, hit } = this.bladeDance;
    const near = skeletonsAlive().filter((s) => !s.spawning && s.pos.distanceTo(this.pos) <= radius + 0.4 * (s.size - 1)
      && Math.abs(s.pos.y - this.pos.y) < 0.85);
    if (!near.length) return;
    let cx = 0, cz = 0;
    for (const s of near) { heroHit(this, s, hit); if (!s.dead) controlEnemy(s, 'slowT', 1); cx += s.pos.x / near.length; cz += s.pos.z / near.length; }
    const dx = cx - this.pos.x, dz = cz - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.5) { this.vel.x += dx / d * 1.6; this.vel.z += dz / d * 1.6; }
    FX.bladeSpin(this, radius);
    audio.play('sword');
  }

  // Fúria Titânica: a cada 0,5 s fere todos ao redor; vale só enquanto o Berserker está de pé
  updateTitanFury(dt) {
    this.titanT -= dt;
    if (this.dead || game.over) { this.titanT = 0; return; }
    this.titanTick -= dt;
    if (this.titanTick > 0) return;
    this.titanTick += 0.5;
    for (const enemy of skeletonsAlive()) {
      if (enemy.dead || enemy.spawning || enemy.pos.distanceTo(this.pos) > this.titanReach + 0.4 * (enemy.size - 1)) continue;
      heroHit(this, enemy, this.dmg * this.skillPower * this.titanPower);
    }
    FX.furyPulse(this, this.titanReach);
  }

  // Meditação: sentado e imune, cura a cada pulso os heróis ao redor
  updateMeditation(dt) {
    this.meditateT -= dt;
    if (this.dead || game.over) { this.meditateT = this.immuneT = 0; return; }
    this.vel.set(0, 0, 0);
    this.meditateTick -= dt;
    if (this.meditateTick > 0) return;
    this.meditateTick += MEDITATE_TICK;
    const { radius, heal } = this.meditation, healed = [];
    for (const h of heroes()) if (!h.dead && h.pos.distanceTo(this.pos) <= radius) {
      const amount = Math.min(h.maxHp - h.hp, heal);
      if (amount < 1) continue;
      h.hp += amount;
      this.stats.cura += amount;
      healed.push(h);
      popText(h.pos, '+' + Math.round(amount), 'heal');
    }
    FX.calmPulse(this, radius, healed);
  }

  // estados das segundas técnicas (slot 3) que mudam como o herói recebe ou causa dano
  resetSkillStates() {
    this.oathT = 0; this.oathBy = null; this.oathShare = 0;   // Juramento do Paladino
    this.bondT = 0; this.bondWith = null; this.bondShare = 0; this.bondLead = false; this.bondDrawT = 0;   // Vínculo de sangue da Vampira
    this.vampFrac = 0;      // Vampira: fração do dano que vira cura durante uma técnica
    this.iceSkinT = 0;      // Pele de Gelo do Viking do Gelo
    this.omenT = 0;         // Presságio da Oráculo: esquiva o próximo dano
    this.vowT = 0;          // Voto de Proteção da Clériga: o próximo golpe fatal deixa 1 de vida
    this.leechT = 0; this.leech = 0;   // Sede de Sangue do Berserker
    this.titanT = 0; this.titanTick = 0;   // Fúria Titânica do Berserker
    this.roarT = 0;         // Berro de Guerra do Brutamontes: o golpe atordoa quem está colado
    this.eclipseT = 0; this.eclipseR = 0; this.eclipseHeal = 0; this.eclipseTick = 0;   // Eclipse Rubro da Vampira
    if (this.spearOn) this.range /= SPEAR_REACH;
    this.spearOn = false; this.spearT = 0; this.chargeBack = null;   // Lanceiro: postura de lança (alcance maior) e volta da carga
    this.runeHp = 0; this.runeMax = 0; this.runeT = 0; this.runeHeal = 0; this.runePush = false; this.runeBy = null;   // runa-escudo da Rúnica
    this.echoT = 0; this.echoMult = 0.6;                     // Eco Arcano do Arcano: repete o próximo feitiço
    this.frostT = 0; this.frostHits = 0; this.frostGapT = 0; this.frostFreeze = 1;   // Geada Cortante do Criomante
    this.pactT = 0; this.pactShield = 0; this.pactShare = 0.3;   // Pacto de Ossos do Necromante
    this.critT = 0; this.critBonus = 0;                      // Visão do Alvo do Oráculo: chance extra de crítico
  }

  // Eco Arcano: o próximo feitiço do Arcano é repetido, depois de um instante, no inimigo mais distante do alcance
  fireEcho(skill) {
    if (!(this.echoT > 0)) return;
    this.echoT = 0;
    const reach = Math.max(10, this.range + 2);
    let far = null, farD = -1;
    for (const s of activeTargetContext?.skeletons ?? skeletonsAlive()) {
      if (s.dead || s.spawning) continue;
      const d = s.pos.distanceTo(this.pos);
      if (d <= reach + 0.4 * (s.size - 1) && d > farD) { far = s; farD = d; }
    }
    if (!far) return;
    const mult = Math.min(skill?.power || 0.9, 1.5) * this.echoMult;   // a ultimate repetida não passa do teto de uma técnica
    after(0.45, () => { if (!this.dead && !game.over) arcaneEchoChain(this, far.dead ? nearest(far.pos, skeletonsAlive().filter((s) => !s.spawning)) : far, mult); });
    popText(this.pos, 'Eco!', 'evolve');
  }

  // Lanceiro: a postura estende o alcance e, a cada pulso, fere e freia quem está ao alcance da lança
  updateSpear(dt) {
    this.spearT -= dt;
    if (this.spearT > 0 && !this.dead && !game.over) {
      if (!this.spearOn) { this.range *= SPEAR_REACH; this.spearOn = true; }
      this.spearTick -= dt;
      if (this.spearTick <= 0) {
        this.spearTick += 0.4;
        const reach = this.range + 0.5;
        for (const s of skeletonsAlive()) if (!s.spawning && Math.abs(s.pos.y - this.pos.y) < 0.85 && s.pos.distanceTo(this.pos) <= reach + 0.4 * (s.size - 1)) {
          heroHit(this, s, this.spearInfo.dmg);
          controlEnemy(s, 'slowT', this.spearInfo.slow * (s.boss ? 0.5 : 1));
        }
      }
    } else if (this.spearOn) { this.range /= SPEAR_REACH; this.spearOn = false; this.spearT = 0; }
    if (this.chargeBack) {   // depois da carga o Lanceiro volta ao ponto de partida (se o chão deixar)
      this.chargeBack.t -= dt;
      if (this.dead || game.over) this.chargeBack = null;
      else if (this.chargeBack.t <= 0) {
        const { to } = this.chargeBack, at = this.pos.clone();
        this.chargeBack = null;
        if (world.canStep(at, to)) { this.pos.copy(to).setY(world.groundHeight(to.x, to.z)); this.vel.set(0, 0, 0); FX.steelDash(at, this.pos); }
      }
    }
  }

  // Eclipse Rubro: a cada 0,25 s, comuns abaixo de 30% de vida perto da Vampira explodem e curam os aliados em volta da explosão
  updateEclipse(dt) {
    this.eclipseT -= dt;
    this.eclipseTick -= dt;
    if (this.dead || game.over || this.eclipseT <= 0) { if (this.dead || game.over) this.eclipseT = 0; return; }
    if (this.eclipseTick > 0) return;
    this.eclipseTick = 0.25;
    const reach = this.eclipseR || 10, healRadius = ECLIPSE_BLAST;
    for (const s of skeletonsAlive()) {
      if (s.dead || s.spawning || s.boss || s.hp >= s.maxHp * 0.3 || s.pos.distanceTo(this.pos) > reach) continue;
      this.stats.dano += s.hp;
      s.lastHit = this;
      s.hp = 0;
      s.die();
      const per = scaleBranchEffect(this, 'support', 4 + skillLevel(this.level) * 1.5) * this.skillPower;
      for (const h of partyNow()) if (!h.dead && this.eclipseHeal > 0 && h.pos.distanceTo(s.pos) <= healRadius) {
        const heal = Math.min(h.maxHp - h.hp, per, this.eclipseHeal);
        if (heal < 1) continue;
        h.hp += heal; this.eclipseHeal -= heal; this.stats.cura += heal;
        popText(h.pos, '+' + Math.round(heal), 'heal');
      }
      FX.bloodBurst(s.pos, healRadius);
    }
  }

  updateSkillStates(dt) {
    if (this.eclipseT > 0) this.updateEclipse(dt);
    if (this.spearT > 0 || this.spearOn || this.chargeBack) this.updateSpear(dt);
    if (this.runeT > 0 && (this.runeT -= dt) <= 0) this.runeHp = 0;
    this.oathT -= dt; this.iceSkinT -= dt; this.omenT -= dt; this.leechT -= dt; this.roarT -= dt; this.vowT -= dt;
    this.echoT -= dt; this.frostT -= dt; this.frostGapT -= dt; this.critT -= dt;
    if (this.pactT > 0 && (this.pactT -= dt) <= 0) this.pactShield = 0;
    if (this.bondT > 0) {   // fio escuro entre os dois ligados (desenhado só por quem lidera o vínculo)
      this.bondT -= dt;
      const mate = this.bondWith;
      if (this.bondLead && mate && !mate.dead && !this.dead) {
        this.bondDrawT -= dt;
        if (this.bondDrawT <= 0) {
          this.bondDrawT = 0.22;
          beam(this.pos, mate.pos, 0x8a1a2e);
          burst(tmp.copy(this.pos).add(mate.pos).multiplyScalar(0.5), [0x8a1a2e, 0x3a0a14], 2, 0.8);
        }
      }
    }
    this.hpSampleT -= dt;
    if (this.hpSampleT <= 0) {
      this.hpSampleT = 0.5;
      this.hpHistory.push(this.dead ? 0 : this.hp);
      if (this.hpHistory.length > 7) this.hpHistory.shift();   // 7 amostras = 3 s atrás
    }
  }

  // dano já reduzido chegando ao herói: segundas técnicas podem esquivar, aparar, refletir, dividir ou segurar a queda
  skillGuard(n, owner) {
    if (this.omenT > 0) { this.omenT = 0; popText(this.pos, 'Previsto!', 'dodge'); this.stats.esquivas++; return 0; }
    if (this.runeHp > 0) { n = runicSoak(this, n); if (n <= 0) return 0; }   // runa-escudo da Rúnica
    if (this.pactShield > 0) {   // Pacto de Ossos: o escudo comido de golpes anteriores absorve primeiro
      const soak = Math.min(n, this.pactShield);
      this.pactShield -= soak; n -= soak;
      if (this.synergyNoticeT <= 0) { popText(this.pos, '⛨' + Math.round(soak), 'block'); this.synergyNoticeT = 0.6; }
      if (n <= 0) return 0;
    }
    if (this.pactT > 0) this.pactShield = Math.min(this.maxHp * 0.5, this.pactShield + n * this.pactShare);   // 30% do dano que passa vira escudo
    const melee = owner?.team === 'skeleton' && !owner.dead && !owner.ranged && owner.pos.distanceTo(this.pos) < 3.5;
    if (melee && this.frostT > 0 && this.frostHits > 0) {   // Geada Cortante: congela o agressor (um por aliado a cada 6 s)
      this.frostHits--;
      if (this.frostGapT <= 0) {
        this.frostGapT = 6;
        if (owner.boss || owner.totem) controlEnemy(owner, 'slowT', 2.5);
        else if (controlEnemy(owner, 'stunT', this.frostFreeze)) owner.pendingHit = null;
        owner.slowT = Math.max(owner.slowT || 0, 1.5);
        popText(owner.pos, 'Congelado!', 'crit');
        FX.frostFreeze(owner);
      }
    }
    if (this.iceSkinT > 0) {
      n *= 0.7;
      if (melee) { owner.slowT = Math.max(owner.slowT || 0, scaleBranchEffect(this, 'control', 2)); owner.takeDamage(this.dmg * this.skillPower * (this.iceSkinBy || 0.4), null, this); }
    }
    if (this.oathT > 0 && this.oathBy && this.oathBy !== this && !this.oathBy.dead) {
      const share = n * this.oathShare;
      n -= share;
      const taken = Math.min(share * 0.75, this.oathBy.hp - 1);   // o Paladino aguenta melhor e nunca cai pelo juramento
      if (taken > 0) { this.oathBy.hp -= taken; this.oathBy.stats.recebido += taken; popText(this.oathBy.pos, taken, 'hurt'); }
    }
    if (this.bondT > 0 && this.bondWith && this.bondWith !== this && !this.bondWith.dead) {
      const share = n * this.bondShare;   // o par divide o golpe; ninguém cai pelo vínculo
      const taken = Math.min(share, this.bondWith.hp - 1);
      if (taken > 0) {
        n -= taken;
        this.bondWith.hp -= taken; this.bondWith.stats.recebido += taken; popText(this.bondWith.pos, taken, 'hurt');
      }
    }
    if (this.vowT > 0 && n >= this.hp) {   // Voto de Proteção: uma vez por aliado, o golpe fatal deixa 1 de vida
      n = Math.max(0, this.hp - 1);
      this.vowT = 0;
      popText(this.pos, 'Salvo!', 'evolve');
      FX.rays(this.pos, 'holy', 0.45, 4, 0.8, { follow: this });
    }
    if (n >= this.hp && runeDomeCovers(this)) {   // cúpula rúnica: ninguém dentro cai
      n = Math.max(0, this.hp - 1);
      if (this.synergyNoticeT <= 0) { popText(this.pos, 'Cúpula!', 'block'); this.synergyNoticeT = 0.8; }
    }
    return n;
  }

  requestSkill(target = null, slot = 0, manual = false) {
    if (this.dead || game.over || game.paused) return 'off';
    if (slot < 0 || slot >= this.skillTimers.length) return 'none';
    if (this.skillTimers[slot] > 0) return 'wait';
    if (game.state !== 'fight') { this.missSkill(); return 'none'; }
    this.skillTargets[slot] = target;
    this.skillManuals[slot] = !!manual;
    this.skillRequests[slot] = 2;
    return 'ok';
  }

  missSkill() {
    this.noTarget = 0.6;
    popText(this.pos, 'Sem alvo', 'block');
  }

  // ocioso na luta: quem não é guarda nem âncora da defesa fica parado onde está (não cruza o mapa até o posto).
  // Longe demais da arena do grupo, volta ao posto.
  holdsGround(context) {
    if (!context || game.state !== 'fight' || this === context.escortGuard) return false;
    if (fixedDefenseGoal(context.goal) && this === defenseAnchor(context)) return false;
    if (context.huntLimited && tacticalDistance(context.villager.pos, this.pos) > ESCORT_HUNT_LIMIT) return false;   // longe do protegido: volta
    return !context.arenaCenter || tacticalDistance(context.arenaCenter, this.pos) <= HERO_HUNT_RADIUS;
  }

  // posição na formação em volta do ponto "s" da estrada
  setAnchor(s) {
    this.fwd.copy(world.tangentAt(s));
    const side = world.sideOf(this.fwd);
    const slot = POSTS.indexOf(this.formation);
    const formation = game.mission?.goal.type === 'bosses' ? CASTLE_POSTS[slot] || this.formation : this.formation;
    const [px, pz] = formation, spread = formationSpread();
    this.post.copy(world.pointAt(s)).addScaledVector(side, px * spread).addScaledVector(this.fwd, -pz * spread);
  }

  revive() {
    this.dead = false;
    this.fell = false;   // uma próxima queda após o revival deve entrar na contagem da missão
    this.aura.visible = this.level > 1;
    this.halo.visible = this.level >= 3;
    this.guardT = this.stanceT = 0;
    this.royalT = 0;
    this.songT = 0;
    this.songHaste = 1;
    this.furyT = 0;
    this.bladeDanceT = 0;
    this.meditateT = this.immuneT = 0;
    this.stoneT = 0;
    this.resetSkillStates();
    this.hp = this.maxHp * difficulty.revive;
    this.hpHistory.length = 0;
    this.bar.style.display = '';
    this.current = null;
    this.mixer.stopAllAction();
    this.loop(this.cfg.idle);
    FX.heroRise(this);
  }

  update(dt) {
    if (dt <= 0) return;
    passiveTick(this, dt);
    for (let slot = 0; slot < this.skillTimers.length; slot++) {
      this.skillTimers[slot] -= dt * (this.marchT > 0 ? 1 + MARCH_HASTE : 1);
      this.skillRequests[slot] -= dt;
      if (this.skillRequests[slot] <= 0) { this.skillTargets[slot] = null; this.skillManuals[slot] = false; }
    }
    this.dodgeTimer -= dt;
    this.guardT -= dt;
    this.stanceT -= dt;
    this.royalT -= dt;
    this.marchT -= dt;
    if (this.royalT <= 0) this.royalBonus = 0;
    this.songT -= dt;
    if (this.songT <= 0) this.songHaste = 1;
    this.furyT -= dt;
    if (this.titanT > 0) this.updateTitanFury(dt);
    if (this.stoneT > 0) { this.stoneT -= dt; this.size += (this.heroSize() - this.size) * Math.min(1, dt * 6); }
    else if (this.cfg.scale && this.size !== this.heroSize()) this.size += (this.heroSize() - this.size) * Math.min(1, dt * 6);
    this.noTarget -= dt;
    this.age += dt;
    if (this.cfg.id === 'angel') this.hover = 0.52 + Math.sin(this.age * 2.2) * 0.06;
    if (!this.dead && game.state === 'fight') this.stats.tempo += dt;   // para o dano por segundo
    for (const o of this.trinkets) {
      if (o.userData.spin) { o.rotation.y += dt * 2; o.position.y = 0.1 + Math.sin(this.age * 3) * 0.05; }
      if (o.userData.orbit) o.rotation.y += dt * 1.5;
      if (o.userData.flicker) o.scale.y = 1 + Math.sin(this.age * 14) * 0.15;
      if (o.userData.wingFlap) o.rotation.z = o.userData.wingFlap * (0.12 + Math.sin(this.age * 5.5) * 0.16);
    }
    const rage = !this.dead && this.cfg.id === 'berserker' && (this.hp < this.maxHp * 0.5 || this.furyT > 0);
    this.cooldown = this.cfg.cooldown / this.haste / (this.songT > 0 ? this.songHaste : 1) / (rage ? 1.5 * this.skillPower : 1);
    this.aura.visible = !this.dead && (this.level > 1 || rage || this.guardT > 0 || this.songT > 0 || this.stoneT > 0);
    this.aura.material.color.set(rage ? 0xff4242 : this.cfg.color[1]);
    this.aura.scale.setScalar(0.8 + Math.sin(this.age * 4) * 0.06);
    if (this.campaignAura) {
      this.campaignAura.visible = !this.dead;
      this.campaignAuraMaterial.opacity = 0.44 + Math.sin(this.age * 2.2) * 0.08;
      this.campaignAura.rotation.y += dt * this.campaignAuraSpin;
      this.campaignAura.scale.setScalar(0.985 + Math.sin(this.age * 2.2) * 0.025);
    }
    this.halo.position.y = 2.5 + Math.sin(this.age * 3) * 0.08;
    if (this.bladeDanceT > 0) this.updateBladeDance(dt);
    this.immuneT -= dt;
    if (this.meditateT > 0) this.updateMeditation(dt);
    this.updateSkillStates(dt);
    this.updateCommon(dt);
    this.tickSkillBody(dt);
  if (this.dead || game.over) return;
  const directControlled = isDirectControlActive(this);
  if (this.busy > 0) {
    if (directControlled) moveDirectControlled(this, dt);
    else if (this.skillAdvanceTarget) {
      const target = this.skillAdvanceTarget;
      if (target.dead || !units.includes(target)) this.skillAdvanceTarget = null;
      else if (Math.hypot(target.pos.x - this.pos.x, target.pos.z - this.pos.z) <= this.range + 0.4 * (target.size || 1)) {
        this.stopApproach(target);
        this.skillAdvanceTarget = null;
      } else this.moveTo(target.pos, dt);
    }
    return;
  }
  this.skillAdvanceTarget = null;
    const escape = !directControlled && game.state === 'fight' && dangerAt(this);   // sai da área marcada antes do golpe forte
    const move = this.cfg.id === 'angel' ? 'Jump_Idle' : this.cfg.run || 'Running_A';   // arqueira e besteiro correm com a arma em punho
    const walk = this.cfg.id === 'angel' ? 'Jump_Idle' : this.cfg.walk || 'Walking_A';
    if (escape) { this.moveTo(escape, dt); this.locomote(move, walk, this.cfg.idle); return; }
    const pendingManual = this.skillRequests.some((request, slot) => request > 0 && this.skillTimers[slot] <= 0);
    const kite = !directControlled && !pendingManual && game.state === 'fight' && this.ranged && kiteFrom(this, dt);   // à distância, recua de quem encosta
    if (kite) { this.moveTo(kite, dt); this.locomote(move, walk, this.cfg.idle); return; }
    const targeting = game.state === 'fight' ? targetContext() : null;
    const captive = targeting?.captive || null;
    const rescuer = targeting?.rescueRunner || null;
    const rescueThreatened = targeting?.rescueThreatened || false;
    const movingToRescue = !!captive && this === rescuer && !rescueThreatened;
    const targetCandidates = rescueThreatened && this === rescuer ? targeting.rescueThreats : targeting?.skeletons;
    const target = targeting
      ? chooseHeroTarget(this, targetCandidates, dt, targeting) : null;
    // no manual a habilidade fica carregada esperando o jogador pedir
    if (game.state === 'fight') {
      let requested = -1;
      for (let slot = 0; slot < this.skillRequests.length; slot++) {
        if (this.skillRequests[slot] > 0 && this.skillTimers[slot] <= 0) { requested = slot; break; }
      }
      if (requested >= 0) {
        const chosen = this.skillTargets[requested];
        const manual = this.skillManuals[requested] || !!chosen;
        this.skillRequests[requested] = 0;
        this.skillTargets[requested] = null;
        this.skillManuals[requested] = false;
        if (this.useSkill(chosen || target, manual, true, requested)) return;
        this.missSkill();
      } else {
        // A IA reserva a ultimate para chefes, perigo real, grupo cercado ou aliados feridos.
        for (const slot of SKILL_AI_ORDER) {
          if (this.skillTimers[slot] > 0 || !this.autoSkills[slot]) continue;
          if (this.useSkill(target, false, false, slot)) return;
        }
      }
    }
    if (directControlled) {
      const command = moveDirectControlled(this, dt);
      const attackTarget = command.target;
      this.engagedWith = attackTarget || null;
      if (attackTarget) {
        const d = attackTarget.pos.distanceTo(this.pos) - 0.4 * ((attackTarget.size || 1) - 1);
        if (this.inReach(attackTarget, d) && (this.ranged || Math.abs(attackTarget.pos.y - this.pos.y) < 0.85)) {
          this.stopApproach(attackTarget);
          const turn = this.face(attackTarget.pos, dt);
          if (this.attackTimer <= 0 && turn < 0.5) {
            const attacks = this.cfg.attacks;
            this.attack(attackTarget, attacks[Math.floor(Math.random() * attacks.length)]);
          }
        }
      } else if (!command.moving && directControl.aimDirection.lengthSq() > 0.001) {
        this.face(tmp.copy(this.pos).add(directControl.aimDirection), dt);
      }
      if (this.busy <= 0) this.locomote(move, walk, this.cfg.idle);
      return;
    }
    // O alvo precisa continuar dentro do raio tático; ser atirador não puxa o grupo pelo mapa.
    // margem para não pipocar: quem já está brigando só larga o alvo quando ele se afasta bem do posto
    const engage = target && !movingToRescue && this.targetEligible === target;
    this.engagedWith = engage ? target : null;
    if (movingToRescue) {
      if (this.pos.distanceTo(captive.pos) > RESCUE_RADIUS - 0.8) this.moveTo(captive.pos, dt);
      else this.face(captive.pos, dt);
    } else if (engage) {
      const d = target.pos.distanceTo(this.pos) - 0.4 * (target.size - 1);
      if (!this.inReach(target, d) || (!this.ranged && Math.abs(target.pos.y - this.pos.y) >= 0.85)) {
        // perseguição sem alcançar: depois de HERO_CHASE_GIVEUP s larga o fugitivo (outro alvo ou volta à formação)
        if (this.chaseFor !== target || d < this.chaseBest - 1) { this.chaseFor = target; this.chaseBest = d; this.chaseT = 0; }   // só conta quem não se aproxima
        if ((this.chaseT += dt) > HERO_CHASE_GIVEUP && !target.hunted && !target.phaseBoss && target.team === 'skeleton') {
          this.chaseT = 0; this.chaseSkip = target; this.chaseSkipT = HERO_CHASE_SKIP; this.engagedWith = null;
        } else if (this.ranged) this.moveTo(target.pos, dt);   // atirador anda só até o alcance e atira dali
        else this.approach(target, dt);                 // corpo a corpo vai para uma vaga livre em volta do alvo
      } else {
        this.chaseFor = null;
        this.stopApproach(target);
        const turn = this.face(target.pos, dt);   // só ataca depois de virar para o alvo
        const attacks = this.cfg.attacks;
        if (this.attackTimer <= 0 && turn < 0.5) this.attack(target, attacks[Math.floor(Math.random() * attacks.length)]);
      }
    } else if (this.holdsGround(targeting)) {
      // regra 4: sem inimigo ao alcance na luta, fica onde lutou; a formação só volta quando o grupo avança de fase
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 10));
      this.face(target ? target.pos : tmp.copy(this.pos).addScaledVector(this.fwd, 10), dt);
    } else if (this.pos.distanceTo(this.post) > 0.25) {
      this.moveTo(this.post, dt);
    } else {
      this.face(target ? target.pos : tmp.copy(this.post).addScaledVector(this.fwd, 10), dt);
    }
    if (this.busy <= 0) this.locomote(move, walk, this.cfg.idle);
  }
}

// animação, ritmo, momento do efeito (fração da animação) e som de cada habilidade
const SKILL_MOVES = {
  paladin: ['Spellcast_Long', 1.8, 0.45, 'heal'],
  guardian: ['Block_Attack', 1.1, 0.4, 'shout'],
  champion: ['2H_Melee_Attack_Spinning', 0.8, 0.45, 'sword'],
  berserker: ['Cheer', 1.6, 0.3, 'shout'],
  crusher: ['Jump_Full_Short', 1, 0.72, 'slam'],
  viking: ['Throw', 1.4, 0.45, 'axe'],
  pyro: ['Spellcast_Shoot', 1.2, 0.4, 'fire'],
  arcane: ['Spellcasting', 0.9, 0.5, 'zap'],
  cryo: ['Spellcast_Raise', 1.8, 0.45, 'ice'],
  assassin: ['Dodge_Forward', 0.8, 0.6, 'arrow'],
  crossbow: ['2H_Ranged_Shoot', 1.2, 0.4, 'arrow'],
  ninja: ['Throw', 1.5, 0.45, 'arrow'],
  duelist: ['Dualwield_Melee_Attack_Slice', 1.6, 0.4, 'sword'],
  king: ['Cheer', 1.4, 0.35, 'shout'],
  iceviking: ['Throw', 1.4, 0.45, 'axe'],
  necro: ['Spellcast_Long', 1.8, 0.5, 'summon'],
  druid: ['Spellcast_Raise', 1.6, 0.45, 'heal'],
  cleric: ['Spellcast_Long', 1.8, 0.45, 'heal'],
  bard: ['Throw', 1.5, 0.4, 'arrow'],
  angel: ['Spellcast_Raise', 1.8, 0.42, 'heal'],
  chronist: ['Spellcast_Raise', 1.6, 0.42, 'zap'],
  archer: ['Ranged_Bow_Release', 1.2, 0.3, 'arrow'],
  monk: ['Unarmed_Melee_Attack_Punch_A', 1.6, 0.4, 'hit'],
  alchemist: ['Throw', 1.4, 0.45, 'ice'],
  engineer: ['Use_Item', 1.35, 0.42, 'zap'],
  beast_tamer: ['Unarmed_Melee_Attack_Kick', 1.45, 0.34, 'hit'],
  oracle: ['1H_Ranged_Shoot', 1.3, 0.35, 'zap'],
  brute: ['Jump_Full_Short', 0.9, 0.7, 'slam'],
  lancer: ['1H_Melee_Attack_Stab', 1.3, 0.45, 'sword'],
  runic: ['Spellcast_Raise', 1.6, 0.42, 'heal'],
  summoner: ['2H_Melee_Attack_Stab', 1.5, 0.45, 'summon'],
  vampire: ['2H_Melee_Attack_Slice', 1.3, 0.4, 'hit'],
  cook: ['Throw', 1.4, 0.45, 'ice'],
  shaman: ['1H_Melee_Attack_Stab', 1.4, 0.5, 'heal'],
  geomancer: ['Spellcast_Raise', 1.5, 0.42, 'slam'],
  illusionist: ['Dodge_Left', 1.3, 0.5, 'summon'],
};

// Corpo de cada habilidade [básica, técnica, ultimate, segunda técnica]. O tempo continua o de SKILL_MOVES (o clipe novo é
// acelerado/freado para caber nele). clip: golpe solto; hold: pose em laço segurada durante a carga;
// f: fração do clipe em que acontece o impacto; arc: rastro do golpe (slash, chop, ring, thrust);
// hop: salto que aterrissa no impacto; float: levita durante a carga; spin: voltas do corpo no impacto;
// lean: inclinação (+ para a frente, - para trás); kick: passo no impacto (+ avança, - recua).
const SKILL_ANIMS = {
  paladin: [
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, lean: -0.12, kick: -0.8 },
    { clip: 'Block_Attack', hold: 'Blocking', f: 0.45, arc: 'slash', kick: 1 },
    { clip: '1H_Melee_Attack_Jump_Chop', hold: 'Blocking', f: 0.62, arc: 'ring', hop: 0.2 },   // salta e crava a espada: a legião brota do impacto
    { clip: 'Cheer', hold: 'Blocking', f: 0.4, lean: -0.08 },
  ],
  guardian: [
    { clip: 'Block_Attack', hold: 'Blocking', f: 0.45, arc: 'slash', kick: -1 },
    { clip: 'Throw', f: 0.45, lean: 0.2, kick: -0.3 },   // arremessa o escudo
    { clip: 'Cheer', hold: 'Blocking', f: 0.35, arc: 'ring', lean: -0.15, hop: 0.25 },
    { clip: 'Dodge_Forward', hold: 'Blocking', f: 0.55, arc: 'slash', kick: 1.8 },
  ],
  champion: [
    { clip: '2H_Melee_Attack_Spinning', f: 0.5, arc: 'ring', spin: 1 },
    { clip: '2H_Melee_Attack_Stab', f: 0.45, arc: 'thrust', lean: 0.18 },
    { clip: '2H_Melee_Attack_Spin', hold: '2H_Melee_Idle', f: 0.55, arc: 'ring', spin: 2, hop: 0.3 },
    { clip: 'Cheer', hold: '2H_Melee_Idle', f: 0.38, lean: -0.2, hop: 0.15 },
  ],
  king: [
    { clip: 'Cheer', f: 0.35, lean: -0.18 },
    { clip: 'Spellcast_Raise', f: 0.5, lean: -0.1, kick: 0.8 },
    { clip: '2H_Melee_Attack_Chop', hold: 'Spellcasting', f: 0.5, arc: 'chop', hop: 0.5 },
    { clip: '2H_Melee_Attack_Stab', hold: '2H_Melee_Idle', f: 0.5, arc: 'thrust', lean: -0.05, kick: 0.4 },
  ],
  berserker: [
    { clip: 'Dualwield_Melee_Attack_Stab', f: 0.38, arc: 'thrust', lean: 0.22, hop: 0.2 },
    { clip: 'Dualwield_Melee_Attack_Chop', f: 0.5, arc: 'chop', hop: 0.7, lean: 0.15 },
    { clip: '2H_Melee_Attack_Spinning', hold: 'Unarmed_Idle', f: 0.5, arc: 'ring', spin: 2 },
    { clip: 'Cheer', hold: 'Unarmed_Idle', f: 0.4, lean: -0.25, hop: 0.1 },
  ],
  crusher: [
    { clip: '2H_Melee_Attack_Chop', f: 0.55, arc: 'chop', hop: 0.55 },
    { clip: 'Jump_Full_Short', f: 0.72, arc: 'ring', kick: 1 },
    { clip: '2H_Melee_Attack_Spin', hold: '2H_Melee_Idle', f: 0.6, arc: 'ring', spin: 1, hop: 0.4 },
    { clip: 'Throw', f: 0.5, lean: 0.25, kick: 0.3 },
  ],
  viking: [
    { clip: 'Throw', f: 0.45, lean: 0.15 },
    { clip: '1H_Ranged_Shooting', hold: '1H_Ranged_Aiming', f: 0.45, lean: 0.2, kick: -0.8 },
    { clip: '2H_Melee_Attack_Spinning', f: 0.5, arc: 'ring', spin: 2 },
    { clip: 'Cheer', hold: 'Block', f: 0.36, lean: -0.18, kick: -0.3 },
  ],
  iceviking: [
    { clip: 'Throw', hold: 'Block', f: 0.45, lean: 0.2, hop: 0.2 },
    { clip: '2H_Melee_Attack_Chop', f: 0.55, arc: 'chop', hop: 0.5 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.6, arc: 'ring', float: 0.35 },
    { clip: 'Block', hold: 'Blocking', f: 0.45, lean: 0.08 },
  ],
  pyro: [
    { clip: 'Spellcast_Shoot', f: 0.5, lean: 0.12, kick: -1 },
    { clip: 'Spellcast_Summon', hold: 'Spellcasting', f: 0.55, lean: 0.14, kick: -0.5 },   // Combustão: pose firme e estalo à distância
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.6, lean: -0.22, float: 0.25 },
    { clip: 'Spellcast_Long', f: 0.5, lean: 0.15, kick: -0.4 },
  ],
  arcane: [
    { clip: '1H_Ranged_Shoot', hold: 'Spellcasting', f: 0.3, kick: -0.8 },
    { clip: 'Spellcast_Raise', f: 0.44, arc: 'thrust', spin: 0.6, float: 0.28, lean: 0.12, kick: -0.35 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.55, float: 0.45 },
    { clip: 'Spellcast_Summon', hold: 'Spellcasting', f: 0.5, float: 0.2, lean: -0.15 },   // Eco Arcano: invoca o eco ao lado
  ],
  cryo: [
    { clip: '1H_Ranged_Shooting', hold: '1H_Ranged_Aiming', f: 0.3, kick: -1 },
    { clip: 'Spellcast_Raise', f: 0.5, lean: -0.1 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.55, spin: 1, float: 0.3 },
    { clip: 'Spellcast_Shoot', hold: 'Spellcasting', f: 0.42, lean: 0.2, kick: -0.5 },
  ],
  assassin: [
    { clip: 'Dodge_Forward', f: 0.6, lean: 0.25 },
    { clip: 'Dualwield_Melee_Attack_Slice', f: 0.55, arc: 'slash', hop: 0.3 },
    { clip: 'Dualwield_Melee_Attack_Chop', hold: 'Blocking', f: 0.5, arc: 'chop', hop: 0.45, lean: 0.2 },
    { clip: 'Throw', f: 0.45, lean: 0.3, kick: -0.4 },
  ],
  crossbow: [
    { clip: '2H_Ranged_Shoot', hold: '2H_Ranged_Aiming', f: 0.2, kick: -1.4 },
    { clip: '2H_Ranged_Shooting', f: 0.3, kick: -1 },
    { clip: '2H_Ranged_Reload', f: 0.68, lean: -0.3, hop: 0.3 },
    { clip: '1H_Ranged_Shoot', hold: '2H_Ranged_Aiming', f: 0.3, lean: -0.2, kick: -0.9 },
  ],
  duelist: [
    { clip: 'Dualwield_Melee_Attack_Slice', f: 0.45, arc: 'slash', kick: 0.6 },
    { clip: 'Dualwield_Melee_Attack_Stab', hold: 'Blocking', f: 0.5, arc: 'thrust', kick: 1.4, lean: 0.25 },
    { clip: '2H_Melee_Attack_Spinning', f: 0.5, arc: 'ring', spin: 3, hop: 0.3 },
    { clip: 'Dualwield_Melee_Attack_Chop', f: 0.5, arc: 'chop', kick: 0.9, lean: 0.2 },   // golpe seco que desarma o inimigo
  ],
  ninja: [
    { clip: 'Throw', f: 0.45, lean: 0.15, hop: 0.25 },
    { clip: 'Dodge_Backward', f: 0.5, hop: 0.35 },
    { clip: 'Dualwield_Melee_Attack_Chop', f: 0.5, arc: 'slash', spin: 2.5, hop: 0.42, lean: 0.2, kick: 0.5 },
    { clip: '1H_Melee_Attack_Slice_Horizontal', f: 0.45, arc: 'slash', spin: 1, lean: 0.1 },
  ],
  necro: [
    { clip: 'Spellcast_Summon', hold: 'Spellcasting', f: 0.55, lean: -0.1 },
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.5, lean: -0.1, kick: -0.4 },   // Pacto de Ossos
    { clip: '2H_Melee_Attack_Chop', hold: 'Spellcasting', f: 0.55, arc: 'ring', float: 0.3 },
    { clip: '1H_Ranged_Shoot', f: 0.3, lean: 0.12, kick: -0.5 },   // Ceifa: aponta a marca
  ],
  druid: [
    { clip: 'PickUp', f: 0.5, lean: 0.15 },
    { clip: '2H_Melee_Attack_Chop', f: 0.55, arc: 'ring', hop: 0.3 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.55, float: 0.4, lean: -0.12 },
    { clip: 'Spellcast_Shoot', hold: 'Spellcasting', f: 0.48, lean: 0.18 },
  ],
  cleric: [
    { clip: 'Spellcast_Long', f: 0.45, lean: -0.15 },
    { clip: 'Block', hold: 'Blocking', f: 0.5, kick: -0.6 },
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, arc: 'ring', float: 0.4 },
    { clip: 'Cheer', f: 0.4, lean: -0.2, float: 0.15 },
  ],
  bard: [
    { clip: 'Throw', f: 0.4, lean: 0.15, kick: -0.5 },                                           // lança a carta com o pulso
    { clip: 'Interact', f: 0.35, hop: 0.3, spin: 1 },                                            // sacode e rola os dados
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, spin: 1.5, float: 0.5 },           // joga o monte inteiro para o alto
    { clip: 'Cheer', f: 0.42, spin: 0.5, hop: 0.2 },                                             // floreio de blefe
  ],
  angel: [
    { clip: 'Jump_Full_Long', f: 0.6, hop: 0.6, lean: 0.15 },
    { clip: 'Block', hold: 'Blocking', f: 0.5 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.55, arc: 'ring', float: 0.6 },
    { clip: 'Spellcast_Shoot', hold: 'Spellcasting', f: 0.45, float: 0.5, lean: 0.15 },
  ],
  chronist: [
    { clip: 'Dodge_Right', f: 0.5, kick: -0.8 },
    { clip: '1H_Ranged_Shoot', f: 0.3, lean: 0.1, kick: -0.8 },
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, spin: 1, float: 0.35 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.5, spin: -1, float: 0.25 },
  ],
  archer: [   // arco de verdade: puxa a corda (hold) e solta
    { clip: 'Ranged_Bow_Release', hold: 'Ranged_Bow_Aiming_Idle', f: 0.2, lean: -0.1, kick: -0.8 },
    { clip: 'Ranged_Bow_Release_Up', hold: 'Ranged_Bow_Draw_Up', f: 0.25, lean: -0.2 },   // mira para o alto: a chuva cai lá na frente
    { clip: 'Ranged_Bow_Draw', hold: 'Ranged_Bow_Aiming_Idle', f: 0.85, lean: 0.15, hop: 0.25, kick: -1.4 },
    { clip: 'PickUp', f: 0.55, lean: 0.25 },
  ],
  monk: [
    { clip: 'Unarmed_Melee_Attack_Punch_A', f: 0.45, arc: 'thrust', kick: 0.8 },
    { clip: 'Unarmed_Melee_Attack_Punch_B', hold: 'Unarmed_Idle', f: 0.45, arc: 'thrust', lean: 0.2, kick: 1.2 },
    { clip: 'Sit_Floor_Down', hold: 'Unarmed_Idle', f: 0.6, float: 0.2 },
    { clip: 'Spellcast_Raise', hold: 'Unarmed_Idle', f: 0.5, lean: -0.1, float: 0.1 },
  ],
  alchemist: [
    { clip: 'Use_Item', f: 0.45, lean: 0.12 },
    { clip: 'Throw', hold: 'Use_Item', f: 0.45, hop: 0.2, lean: 0.2 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.62, arc: 'ring', spin: -0.8, float: 0.22, lean: -0.12 },
    { clip: 'Spellcast_Shoot', hold: 'Use_Item', f: 0.45, lean: 0.15, kick: 0.2 },
  ],
  engineer: [
    { clip: '1H_Ranged_Reload', hold: '1H_Ranged_Aiming', f: 0.38, lean: 0.22, kick: 0.25 },
    { clip: 'Throw', hold: 'Use_Item', f: 0.48, hop: 0.15, lean: 0.3 },
    { clip: '2H_Ranged_Reload', hold: '2H_Ranged_Aiming', f: 0.62, spin: -0.5, kick: -0.6 },
    { clip: 'Use_Item', hold: '1H_Ranged_Aiming', f: 0.5, lean: -0.15 },
  ],
  beast_tamer: [
    { clip: 'Unarmed_Melee_Attack_Kick', hold: 'Unarmed_Idle', f: 0.32, lean: -0.2, hop: 0.2 },
    { clip: '2H_Melee_Attack_Chop', f: 0.64, arc: 'chop', hop: 0.55, lean: 0.24 },
    { clip: 'Jump_Full_Long', hold: 'Unarmed_Idle', f: 0.58, arc: 'ring', spin: 0.7, hop: 0.72 },
    { clip: 'Unarmed_Melee_Attack_Punch_A', hold: 'Unarmed_Idle', f: 0.4, arc: 'thrust', lean: 0.25 },
  ],
  oracle: [
    { clip: 'Spellcasting', hold: 'Spellcast_Raise', f: 0.28, lean: 0.18, kick: -0.7 },
    { clip: 'Spellcast_Long', hold: 'Spellcast_Raise', f: 0.53, spin: -0.6, float: 0.3, lean: -0.16 },
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.62, spin: 0.9, float: 0.42, kick: -0.2 },
    { clip: 'Cheer', hold: 'Spellcasting', f: 0.45, float: 0.3, lean: -0.12 },
  ],
  brute: [
    { clip: 'Brute_Smash', f: 0.3, arc: 'ring', hop: 0.2, lean: 0.1 },   // ergue os dois punhos e esmaga o chão
    { clip: 'Throw', hold: 'Brute_Idle', f: 0.5, lean: 0.25, kick: 0.6 },
    { clip: 'Cheer', hold: 'Block', f: 0.4, lean: -0.2, hop: 0.25 },
    { clip: 'Spellcast_Raise', hold: 'Brute_Idle', f: 0.5, lean: -0.28, hop: 0.15 },   // ergue os braços e ruge
  ],
  lancer: [
    { clip: '1H_Melee_Attack_Stab', hold: '2H_Melee_Idle', f: 0.45, arc: 'thrust', lean: 0.15, kick: 1 },   // estocada reta
    { clip: 'Block', hold: '2H_Melee_Idle', f: 0.4, lean: 0.2, kick: -0.3 },                                 // firma a lança em postura
    { clip: 'Dodge_Forward', hold: '2H_Melee_Idle', f: 0.5, arc: 'thrust', lean: 0.25, kick: 0.6 },          // arranca para a carga
    { clip: '2H_Melee_Attack_Stab', hold: '2H_Melee_Idle', f: 0.5, arc: 'thrust', lean: 0.3, kick: 0.5 },    // crava a lança no alvo
  ],
  runic: [
    { clip: 'Waving', hold: 'Spellcasting', f: 0.5, lean: 0.1, float: 0.12 },   // acena e a runa pousa no aliado
    { clip: 'Cheer', hold: 'Spellcasting', f: 0.45, float: 0.2, lean: -0.1 },   // sela o grupo todo
    { clip: 'Spellcast_Long', hold: 'Spellcast_Raise', f: 0.6, spin: 0.8, float: 0.4, lean: -0.14 },   // fecha a cúpula
    { clip: 'Spellcast_Shoot', hold: 'Spellcasting', f: 0.45, lean: 0.12, kick: -0.6 },   // pulso curto
  ],
  summoner: [
    { clip: '2H_Melee_Attack_Stab', hold: 'Spellcasting', f: 0.5, lean: 0.12, float: 0.18 },   // finca o cajado e a fada sai da gema
    { clip: '1H_Melee_Attack_Stab', f: 0.55, arc: 'thrust', lean: 0.22, kick: 0.35 },          // bate no chão e o golem brota
    { clip: 'Spellcast_Summon', hold: 'Spellcast_Raise', f: 0.6, spin: 1.1, float: 0.5, lean: -0.14 },   // ergue o cajado e invoca o dragãozinho
    { clip: 'Throw', hold: 'Spellcasting', f: 0.5, hop: 0.14, lean: 0.22, spin: -0.4 },   // arremessa o slime à frente
  ],
  vampire: [
    { clip: '2H_Melee_Attack_Slice', f: 0.45, arc: 'slash', lean: 0.18, kick: 0.4 },   // garra em meia-lua
    { clip: 'Spellcast_Long', hold: 'Spellcast_Raise', f: 0.5, lean: -0.1, float: 0.15 },   // estende a mão e liga os dois aliados
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.6, spin: 0.8, float: 0.45, kick: -0.3 },   // ergue os braços: noite de sangue
    { clip: '1H_Melee_Attack_Stab', hold: 'Spellcasting', f: 0.5, arc: 'thrust', lean: 0.22, kick: 0.3 },   // avança e morde
  ],
  cook: [
    { clip: 'Throw', hold: 'Use_Item', f: 0.45, hop: 0.12, lean: 0.2 },    // lança a torta
    { clip: 'Interact', f: 0.5, lean: 0.25, kick: 0.2 },                   // entrega a marmita
    { clip: 'Cheer', hold: 'Use_Item', f: 0.5, hop: 0.3, lean: -0.12 },    // grita "à mesa!"
    { clip: 'Use_Item', f: 0.5, lean: 0.12, kick: 0.15 },                  // polvilha o tempero
  ],
  shaman: [
    { clip: '1H_Melee_Attack_Chop', f: 0.55, lean: 0.3, kick: 0.3 },   // finca o totem de cura no chão
    { clip: 'PickUp', f: 0.55, lean: 0.2, hop: 0.1 },   // abaixa e planta o totem de raízes
    { clip: 'Cheer', hold: 'Spellcasting', f: 0.5, spin: 0.6, float: 0.3, lean: -0.12 },   // ergue os braços e chama os ancestrais
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, lean: -0.1, float: 0.12 },
  ],
  geomancer: [
    { clip: '1H_Melee_Attack_Jump_Chop', hold: 'Spellcasting', f: 0.5, arc: 'thrust', lean: 0.22, kick: 0.3 },   // crava o cajado no chão e os espinhos correm
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.58, float: 0.12, lean: -0.1 },   // ergue a muralha
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.62, arc: 'ring', hop: 0.35, lean: 0.12 },   // pisa forte e o chão racha
    { clip: 'Spellcasting', hold: 'Spellcast_Raise', f: 0.5, lean: 0.2, kick: 0.2 },   // pilar sob o alvo
  ],
  illusionist: [
    { clip: 'Dodge_Left', f: 0.5, lean: 0.1, kick: -0.5 },                                      // gira de lado e a cópia fica no lugar
    { clip: 'Dodge_Backward', f: 0.5, hop: 0.25, spin: 0.5 },                                    // troca de lugar com um salto
    { clip: 'Spellcast_Summon', hold: 'Spellcasting', f: 0.55, spin: 1.5, float: 0.4 },          // o medo gira em volta dos inimigos
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.5, float: 0.2, lean: -0.1 },           // a mão se ergue e um clarão ofusca
  ],
};

const LEGION_SIZE = 6;   // esqueletos da ultimate do Necromante
const LEGION_RISE = 0.8;   // tempo que cada um leva para sair da terra
// ---------- Rúnica: runa-escudo, runas de grupo, pulso e cúpula rúnica (os visuais ficam em FX.rune*) ----------
const RUNE_COLOR = 0x6fd8e0, RUNE_PUSH_R = 2.2;
const runeDomes = [];   // cúpulas ativas: { pos, r, t, owner }

function runePushAway(enemy, from, k) {
  enemy.vel.add(new THREE.Vector3().subVectors(enemy.pos, from).setY(0).normalize().multiplyScalar(k));
}

// escudo de runa: absorve dano até acabar (ou o tempo passar); heal/push valem só ao quebrar
function runeShieldOn(h, owner, amount, duration, heal = 0, push = false) {
  const fresh = !(h.runeHp > 0);
  h.runeHp = Math.max(fresh ? 0 : h.runeHp, amount);
  h.runeMax = Math.max(fresh ? 0 : h.runeMax, h.runeHp);
  h.runeT = Math.max(fresh ? 0 : h.runeT, duration);
  h.runeHeal = Math.max(fresh ? 0 : h.runeHeal, heal);
  h.runePush = (fresh ? false : h.runePush) || push;
  h.runeBy = owner;
  if (fresh) FX.runeShield(h);
}

// dano chegando ao herói com runa: a runa come primeiro; ao quebrar cura um pouco e afasta quem está colado
function runicSoak(h, n) {
  const soak = Math.min(n, h.runeHp);
  h.runeHp -= soak;
  if (h.synergyNoticeT <= 0) { popText(h.pos, '⛨' + Math.round(soak), 'block'); h.synergyNoticeT = 0.6; }
  if (h.runeHp > 0.01) return n - soak;
  h.runeHp = 0;
  const heal = Math.min(h.maxHp - h.hp, h.runeHeal);
  if (heal > 0) { h.hp += heal; if (h.runeBy?.stats) h.runeBy.stats.cura += heal; popText(h.pos, '+' + Math.round(heal), 'heal'); }
  if (h.runePush) for (const enemy of skeletonsAlive()) {
    if (!enemy.dead && !enemy.spawning && enemy.pos.distanceTo(h.pos) <= RUNE_PUSH_R + 0.4 * (enemy.size - 1)) runePushAway(enemy, h.pos, enemy.boss ? 2 : 8);
  }
  FX.runeBreak(h, RUNE_PUSH_R);
  return n - soak;
}

const runeDomeCovers = (h) => runeDomes.some((d) => (h.pos.x - d.pos.x) ** 2 + (h.pos.z - d.pos.z) ** 2 <= d.r * d.r);

function raiseRuneDome(owner, at, radius, duration) {
  const dome = { pos: at.clone(), r: radius, t: duration, owner };
  runeDomes.push(dome);
  FX.runeDome(dome);
}

// a cúpula empurra para fora quem encosta (chefes cedem menos)
function updateRuneDomes(dt) {
  for (let i = runeDomes.length - 1; i >= 0; i--) {
    const d = runeDomes[i];
    d.t -= dt;
    if (d.t <= 0 || !units.includes(d.owner)) { runeDomes.splice(i, 1); continue; }
    for (const enemy of skeletonsAlive()) {
      if (enemy.dead || enemy.spawning) continue;
      const reach = d.r + 0.4 * (enemy.size - 1);
      let dx = enemy.pos.x - d.pos.x, dz = enemy.pos.z - d.pos.z;
      let dist = Math.hypot(dx, dz);
      if (dist >= reach) continue;
      if (dist < 0.01) { dx = 1; dz = 0; dist = 1; }
      const step = Math.min(reach - dist + 0.05, (enemy.boss ? 3 : 9) * dt);
      enemy.pos.x += dx / dist * step;
      enemy.pos.z += dz / dist * step;
    }
  }
}

// ---------- passivas dos heróis (registro e documentação em passives.js) ----------
const PASSIVE_CTX = {
  units, popText, THREE, passiveReady, killedByHero: false, dist: 0,
  get game() { return game; },
  proc(hero, text) { if (passiveReady(hero, '_proc', 0.6)) popText(hero.pos, text, 'evolve'); },   // texto flutuante, no máx. 1 a cada 0,6 s
  canSummonSkull: (hero) => units.filter((u) => u.summoner === hero && !u.dead && !u.ultimate).length < NECRO_MINION_MAX,
  summonSkull(hero, at) { const skull = new Minion(hero, 1, { at: at.clone() }); skull.skull = true; skull.life = 6; skull.dmg *= 0.7; return skull; },   // caveira: mini-esqueleto curto e fraco
};
const passiveOf = (u) => (u instanceof Hero ? PASSIVES[u.cfg.id] : undefined);   // só heróis jogáveis: nunca ilusões, invocações ou inimigos
function passiveHook(u, name, a, b) {
  const fn = passiveOf(u)?.[name];
  if (!fn || u.dead) return;
  if (name === 'onHit' || name === 'onHurt') fn(u, a, b, PASSIVE_CTX); else fn(u, a, PASSIVE_CTX);
}
function passiveEnemyDeath(h, enemy) {
  const fn = passiveOf(h)?.onEnemyDeath;
  if (!fn) return;
  PASSIVE_CTX.killedByHero = h === enemy.lastHit;
  PASSIVE_CTX.dist = h.pos.distanceTo(enemy.pos);
  fn(h, enemy, PASSIVE_CTX);
}
function passiveTick(h, dt) {
  const cd = h.passiveCd;
  if (cd) for (const k in cd) if (cd[k] > 0) cd[k] -= dt;
  passiveOf(h)?.tick?.(h, dt, PASSIVE_CTX);
}

class Minion extends Unit {
  constructor(summoner, side, o = {}) {
    super(skeletonModel('Minion'), { hp: (o.ultimate ? 42 : 55) * summoner.skillPower, dmg: 9, range: 1.3, speed: 3.4, cooldown: 1.3 }, 'ally');
    this.summoner = summoner;
    this.cfg = { id: 'minion' };
    this.level = summoner.level;
    this.life = scaleBranchEffect(summoner, 'support', 8) * summoner.skillPower;
    if (o.at) this.pos.copy(o.at); else this.pos.copy(summoner.pos).add(new THREE.Vector3(side * 0.9, 0, 0));
    this.size = 0.7;
    this.popT = 0;
    if (o.ultimate) {
      this.ultimate = true;
      this.life += 3;   // a legião dura um pouco mais que os esqueletinhos comuns
      this.riseT = LEGION_RISE + (o.riseDelay || 0);   // começa sob a terra e se levanta
      this.lift = -1.5;
      this.root.visible = false;
    }
    this.bar.classList.add('ally');
    for (const m of this.mats) m.color?.set(0xb5ffbc);
    Skeleton.prototype.attach.call(this, 'Skeleton_Blade', 'handslotr');
    this.loop('Idle_Combat');
    if (!o.ultimate) poof(this.pos, 0.7);
  }

  update(dt) {
    if (dt <= 0) return;
    if (this.riseT > 0) {   // levantando da terra: sobe do chão, sem agir ainda
      this.riseT -= dt;
      const k = Math.min(1, Math.max(0, this.riseT) / LEGION_RISE);   // 1 = sob a terra, 0 = de pé
      if (!this.root.visible && k < 1) this.root.visible = true;
      this.lift = -1.5 * k * k;
      this.updateCommon(dt);
      if (this.riseT <= 0) this.lift = 0;
      return;
    }
    this.updateCommon(dt);
    if (game.over) return;
    this.life -= dt;
    if (this.dead || this.life <= 0) { poof(this.pos, 0.7); this.remove(); return; }
    if (this.busy > 0) return;
    const targets = activeTargetContext?.attackableSkeletons ?? skeletonsAlive().filter((s) => !s.spawning);
    const target = nearest(this.pos, targets);
    if (target && game.state === 'fight') {
      if (!this.inReach(target, target.pos.distanceTo(this.pos))) this.moveTo(target.pos, dt);
      else if (this.attackTimer <= 0 && this.face(target.pos, dt) < 0.5) this.attack(target, '1H_Melee_Attack_Chop');
    } else if (this.pos.distanceTo(this.summoner.pos) > 1.5) this.moveTo(this.summoner.pos, dt);
    if (this.busy <= 0) this.locomote('Walking_D_Skeletons', 'Walking_D_Skeletons', 'Idle_Combat');
  }
}

// Legião de Luz do Paladino: o corpo do herói em escala menor, armadura clara e dourada. Seguram a linha perto dos aliados
// mais feridos, provocam de leve quem está perto e batem fraco; somem em fumaça ao morrer ou no fim.
const LIGHT_KNIGHTS = 5, LIGHT_RISE = 0.5, LIGHT_SCALE = 0.55, LIGHT_TINT = new THREE.Color(0xf6e7b0);
class LightKnight extends Unit {
  constructor(summoner, at, index, life) {
    super(summoner.cfg.built, { hp: summoner.maxHp * 0.4, dmg: summoner.dmg * 0.25, range: 1.4, speed: 3.8, cooldown: 1.4 }, 'ally');
    this.summoner = summoner;
    this.cfg = { id: 'light_knight' };
    this.lightKnight = true;
    this.index = index;
    this.level = summoner.level;
    this.life = life;
    this.size = LIGHT_SCALE;
    this.root.scale.setScalar(LIGHT_SCALE);
    this.pos.copy(at);
    this.riseT = LIGHT_RISE + 0.07 * index;
    this.lift = -1.2;
    this.root.visible = false;
    this.tauntAt = 0;
    this.bar.classList.add('ally');
    for (const m of this.mats) m.color?.multiply(LIGHT_TINT);
    this.loop(summoner.cfg.idle);
  }

  update(dt) {
    if (dt <= 0) return;
    if (this.riseT > 0) {
      this.riseT -= dt;
      const k = Math.min(1, Math.max(0, this.riseT) / LIGHT_RISE);
      if (!this.root.visible && k < 1) this.root.visible = true;
      this.lift = -1.2 * k * k;
      this.updateCommon(dt);
      if (this.riseT <= 0) this.lift = 0;
      return;
    }
    this.updateCommon(dt);
    if (game.over) return;
    this.life -= dt;
    if (this.dead || this.life <= 0 || this.summoner.dead) { poof(this.pos, 0.7); this.remove(); return; }
    if (this.busy > 0) return;
    const foes = activeTargetContext?.attackableSkeletons ?? skeletonsAlive().filter((s) => !s.spawning);
    this.tauntAt -= dt;
    if (this.tauntAt <= 0 && game.state === 'fight') {   // provocação leve: só quem está solto e perto; chefe pela resistência de controle
      this.tauntAt = 0.4;
      for (const enemy of foes) if (!enemy.dead && enemy.tauntT <= 0.35 && enemy.pos.distanceTo(this.pos) <= 3.5) illusionTaunt(enemy, this, 0.7, false);
    }
    // âncora: o aliado mais ferido; cada mini ocupa um ponto diferente ao redor dele
    let anchor = this.summoner;
    for (const h of heroes()) if (!h.dead && h.hp / h.maxHp < anchor.hp / anchor.maxHp) anchor = h;
    const target = nearest(this.pos, foes);
    if (target && game.state === 'fight' && target.pos.distanceTo(anchor.pos) < 7) {
      if (!this.inReach(target, target.pos.distanceTo(this.pos))) this.moveTo(target.pos, dt);
      else if (this.attackTimer <= 0 && this.face(target.pos, dt) < 0.5) this.attack(target, this.summoner.cfg.attacks[0]);
    } else {
      const a = this.index / LIGHT_KNIGHTS * Math.PI * 2;
      const spot = new THREE.Vector3(anchor.pos.x + Math.cos(a) * 1.7, anchor.pos.y, anchor.pos.z + Math.sin(a) * 1.7);
      if (spot.distanceTo(this.pos) > 0.6) this.moveTo(spot, dt);
    }
    if (this.busy <= 0) this.locomote(this.summoner.cfg.run || 'Running_A', this.summoner.cfg.run || 'Running_A', this.summoner.cfg.idle);
  }
}

class BeastCompanion extends Unit {
  constructor(summoner) {
    super(summoner.cfg.built, { hp: 125 * summoner.skillPower, dmg: 18 * summoner.skillPower, range: 1.5, speed: 3.5, cooldown: 0.95 }, 'ally');
    this.summoner = summoner;
    this.cfg = { id: 'beast_companion' };
    this.level = summoner.level;
    this.life = scaleBranchEffect(summoner, 'support', 13 + skillLevel(summoner.level)) * summoner.skillPower;
    this.empowerT = 0;   // Caçada em Matilha: tempo restante (também acende o brilho dourado da fera)
    this.huntBonus = 1.5;
    this.huntTarget = null;
    this.beastCompanion = true;
    this.threatScratch = [];
    this.size = 1.12;
    this.root.scale.setScalar(this.size);
    this.pos.copy(summoner.pos).add(new THREE.Vector3(-0.9, 0, 0.6));
    this.pos.y = world.groundHeight(this.pos.x, this.pos.z);
    this.bar.classList.add('ally');
    this.root.traverse((object) => { if (object.isMesh) object.visible = false; });

    // lobo montado em peças (characters.js): geometrias compartilhadas, materiais próprios para piscar e brilhar
    this.beast = buildBeast();
    this.root.add(this.beast.root);
    this.mats.push(...this.beast.flash);
    this.age = 0;
    this.biteT = 0;
    this.biteDur = 1;
    this.howlT = 0.9;   // entra uivando, com o pop elástico de quem acabou de surgir
    this.popT = 0;
    poof(this.pos, 0.9);
    wave(this.pos, 0xcbb36f, 0.2, 1.7, 0.55);
  }

  remove() {
    super.remove();
    for (const material of this.beast.materials) material.dispose();   // geometrias são compartilhadas entre as feras
  }

  howl() { this.howlT = 0.9; }

  pose(dt) {
    this.biteT = Math.max(0, this.biteT - dt);
    this.howlT = Math.max(0, this.howlT - dt);
    animateBeast(this.beast, this.age, dt, {
      speed: this.vel.length() / this.speed,
      bite: this.biteT > 0 ? 1 - this.biteT / this.biteDur : -1,
      howl: this.howlT > 0 ? 1 - this.howlT / 0.9 : -1,
      empower: this.empowerT > 0,
    });
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    this.life -= dt;
    this.empowerT = Math.max(0, this.empowerT - dt);
    this.age += dt;
    if (this.dead || this.life <= 0 || this.summoner.dead || !units.includes(this.summoner)) {
      poof(this.pos, 0.9); this.remove(); return;
    }
    this.pose(dt);
    if (game.over || game.state !== 'fight' || this.busy > 0) return;
    const targets = activeTargetContext?.attackableSkeletons ?? skeletonsAlive().filter((enemy) => !enemy.spawning);
    const threats = this.threatScratch;
    threats.length = 0;
    for (const enemy of targets) {
      if (!enemy.dead && enemy.pendingHit?.target?.team === 'hero' && enemy.pendingHit.target.pos.distanceTo(this.pos) < 10) threats.push(enemy);
    }
    const hunting = this.empowerT > 0;
    if (hunting && (!this.huntTarget || this.huntTarget.dead || !units.includes(this.huntTarget))) {
      const urgent = targets.filter(isPriorityEnemy);   // o mais perigoso: chefe, totem, sacerdote, bombardeiro ou prioritário
      this.huntTarget = highestPriorityHeroTarget(this.summoner, urgent.length ? urgent : targets, this.pos);
    } else if (!hunting) this.huntTarget = null;
    const target = hunting && this.huntTarget ? this.huntTarget : threats.length ? highestPriorityHeroTarget(this.summoner, threats, this.pos) : nearest(this.pos, targets);
    if (target) {
      const distance = target.pos.distanceTo(this.pos);
      if (!this.inReach(target, distance) || Math.abs(target.pos.y - this.pos.y) >= 0.85) this.moveTo(target.pos, dt, this.speed * (hunting ? this.huntBonus : 1));
      else if (this.attackTimer <= 0 && this.face(target.pos, dt) < 0.5) {
        const duration = this.once('1H_Melee_Attack_Chop', 1.25);
        this.busy = duration * 0.9;
        this.attackTimer = this.cooldown;
        this.biteT = this.biteDur = duration * 0.9;   // bote: agacha, salta e fecha a mordida no golpe (36%)
        const enemy = target;
        this.pendingHit = { target: enemy, t: duration * 0.36, effect: () => {
          if (enemy.dead || !units.includes(enemy)) return;
          const hunt = this.empowerT > 0;   // Caçada em Matilha: mais dano e cada mordida faz sangrar
          heroHit(this.summoner, enemy, this.dmg * (hunt ? this.huntBonus : 1), this.pos);
          burst(enemy.pos.clone().setY(enemy.pos.y + 0.6), hunt ? [0xb0202a, 0xe5ca75] : [0xcbb36f, 0xffe6a1], 7, 2.4);
          if (hunt) {
            const owner = this.summoner;
            if (!(enemy.burnT > 0)) popText(enemy.pos, 'Sangrando!', 'crit');
            enemy.burnT = Math.max(enemy.burnT || 0, scaleBranchEffect(owner, 'control', 3));
            enemy.burnTick = Math.min(enemy.burnTick || 0.5, 0.35);
            enemy.burnDmg = Math.max(enemy.burnDmg || 0, owner.dmg * owner.skillPower * 0.2);
            enemy.burnOwner = owner;
          }
        } };
      }
      for (const enemy of threats) if (enemy.pos.distanceTo(this.pos) <= 2.8 && enemy.tauntT <= 0.35) {
        enemy.taunt = this; enemy.tauntT = 0.65; enemy.pendingHit = null;
      }
    } else if (this.pos.distanceTo(this.summoner.pos) > 2) this.moveTo(this.summoner.pos, dt);
  }
}

// ---------- Invocador: fada, golem e dragãozinho ----------
// Criaturas leves, sem GLB: o corpo vem de summon-models.js (poucas malhas, geometrias e materiais compartilhados);
// os gestos são feitos no update. Uma de cada tipo por Invocador; somem ao fim da fase.
// vida e dano base (crescem 10% por nível e com o poder de habilidade); life = duração em segundos;
// every = recarga da habilidade própria (cura, pancada, baforada); bar = altura da barra de vida
const SUMMON_RULES = {
  fairy: { hp: 60, dmg: 0, range: 3.5, speed: 4.6, cooldown: 2, every: 2, life: 12, size: 0.8, bar: 2.15, color: 0xffb8dc },
  golem: { hp: 240, dmg: 14, range: 1.6, speed: 2.7, cooldown: 1.5, every: 6, life: 15, size: 1.05, bar: 2.95, color: 0xd8c29a },
  dragon: { hp: 120, dmg: 0, range: 4.5, speed: 3.8, cooldown: 3, every: 3, life: 18, size: 0.95, bar: 6.6, color: 0xff7a3a, flying: true },   // voa alto: inimigos não o miram nem acertam
  // Slime Saltitante: pula de grupo em grupo (every = intervalo entre saltos) e, ao fim, vira dois pequenos (slimemini, um salto e estouram).
  // Gelatina saltitante: inimigos não a miram. O dano vem dos saltos, não de hp/dmg.
  slime: { hp: 60, dmg: 0, range: 1, speed: 3, cooldown: 1, every: 1.5, life: 9, size: 0.9, bar: 1.7, color: 0x7be08c, untargetable: true },
  slimemini: { hp: 30, dmg: 0, range: 1, speed: 3, cooldown: 1, every: 1.5, life: 3, size: 0.55, bar: 1.2, color: 0xff9ccf, untargetable: true },
};
// salto do slime: raio do impacto, dano (fração do dano do Invocador), lentidão (s), duração do voo e altura
const SLIME_HOP = {
  slime: { radius: 2.2, dmg: 0.5, slow: 2.5, dur: 0.6, height: 2.2, scan: 14 },
  slimemini: { radius: 1.4, dmg: 0.22, slow: 1.2, dur: 0.5, height: 1.5, scan: 14 },
};
const SUMMON_DRAGON_SCALE = 1.9;   // só o visual do dragãozinho cresce; tamanho de colisão (rule.size) e alcance não mudam
const SUMMON_TAUNT = 3, SUMMON_SLAM_RADIUS = 2.4, SUMMON_STUN = 0.9, SUMMON_BOSS_CONTROL = 0.35;   // chefes: controle mais curto
const EMPTY_GLTF = { scene: new THREE.Group(), animations: [] };
const summonAt = new THREE.Vector3();

class SummonedCreature extends Unit {
  constructor(summoner, kind, at = null, index = 0) {
    const rule = SUMMON_RULES[kind], grow = summoner.skillPower * (1 + (skillLevel(summoner.level) - 1) * 0.1);
    super(EMPTY_GLTF, { hp: Math.round(rule.hp * grow), dmg: rule.dmg * grow, range: rule.range, speed: rule.speed, cooldown: rule.cooldown }, 'ally');
    this.summoner = summoner;
    this.summonKind = kind;
    this.rule = rule;
    this.cfg = { id: `summon_${kind}` };
    this.level = summoner.level;
    this.phase = game.phase;
    this.life = this.maxLife = scaleBranchEffect(summoner, 'support', rule.life);
    this.abilityT = kind === 'fairy' ? 0.3 : kind === 'golem' ? 2 : kind === 'slimemini' ? 0.25 : 0.6;
    this.age = 0;
    this.size = rule.size;
    this.barHeight = rule.bar;
    this.untargetable = !!(rule.flying || rule.untargetable);
    this.goal = new THREE.Vector3();
    this.popT = 0;
    this.bar.classList.add('ally');
    const side = kind === 'fairy' ? 0.8 : kind === 'golem' ? -0.9 : kind === 'slime' ? 0.9 : 0;
    if (at) this.pos.copy(at);
    else this.pos.copy(summoner.pos).add(tmp.set(side, 0, kind === 'dragon' ? -1 : 0.6));
    this.jump = null;   // slime: salto em curso { from, to, t, dur, h }
    this.landT = 9;     // slime: segundos desde o último pouso (amassa ao pousar)
    this.miniIndex = index;
    this.pos.y = world.groundHeight(this.pos.x, this.pos.z);
    this.root.rotation.y = summoner.root.rotation.y;
    this.visual = new THREE.Group();
    this.root.add(this.visual);
    this.parts = buildSummon(kind, this.root, this.visual);   // summon-models.js; inclui o anel e o brilho da Fúria do Bestiário
    this.spawnT = 0;   // entrada: o golem brota do chão, o dragãozinho desce rodopiando
    this.actT = this.actDur = 0;   // gesto em curso (actKind): cura, soco, pancada, baforada
    this.trailT = 0;
    this.animate(0);
    if (kind === 'golem') { this.popT = 0.45; FX.golemRise(this.pos); } else poof(this.pos, rule.size);
    if (kind === 'golem') this.provoke();
  }

  act(kind, duration) {
    this.actKind = kind;
    this.actT = this.actDur = duration;
  }

  // o corpo não tem clipes: os gestos são feitos no update
  once() { return 0.4; }
  loop() {}

  renew() {
    this.life = this.maxLife;
    this.hp = this.maxHp;
    this.phase = game.phase;
    this.popT = 0;
    if (this.summonKind === 'golem') this.provoke();
  }

  vanish() {
    this.dead = true;   // quem estava provocado ou mirando nela larga o alvo
    if (this.summonKind !== 'golem') poof(this.pos, this.size);
    FX.summonFade(this);   // as peças saem do corpo para desmoronar/encolher; o kit compartilhado não é descartado
    this.remove();
  }

  enemies() {
    return activeTargetContext?.attackableSkeletons ?? skeletonsAlive().filter((enemy) => !enemy.spawning);
  }

  // golem: ao surgir (ou renovar), atrai os inimigos próximos
  provoke() {
    const power = this.summoner.skillPower;
    for (const enemy of this.enemies()) if (!enemy.dead && !enemy.spawning && enemy.pos.distanceTo(this.pos) <= 4.5) {
      enemy.taunt = this;
      enemy.tauntT = (enemy.boss ? SUMMON_TAUNT / 2 : SUMMON_TAUNT) * power;
      if (!enemy.boss) enemy.pendingHit = null;
    }
    wave(this.pos, this.rule.color, 0.3, 4.5, 0.6);
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    this.age += dt;
    this.life -= dt;
    this.frenzyT = (this.frenzyT || 0) - dt;
    const fury = this.frenzyT > 0 ? this.frenzyHaste : 0;   // Fúria do Bestiário: ataques e poderes mais rápidos
    this.abilityT -= dt * (1 + fury);
    if (fury) this.attackTimer -= dt * fury;
    const summoner = this.summoner;
    const gone = this.dead || summoner.dead || !units.includes(summoner) || game.state === 'cleared' || game.phase !== this.phase;
    if (!gone && this.life <= 0 && this.summonKind === 'slime' && !this.jump) this.splitSlime();   // o grande se divide ao fim
    if (gone || (this.life <= 0 && !this.jump)) { this.vanish(); return; }   // salto em curso termina antes de sumir
    this.animate(dt);
    if (this.summonKind === 'slime' || this.summonKind === 'slimemini') { if (!game.over && game.state === 'fight') this.thinkSlime(dt); return; }
    if (game.over || game.state !== 'fight' || this.busy > 0) return;
    if (this.summonKind === 'fairy') this.thinkFairy(dt);
    else if (this.summonKind === 'golem') this.thinkGolem(dt);
    else this.thinkDragon(dt);
  }

  // gestos em código: flutuar, bater asas, andar, golpes; act = progresso do gesto atual (0→1) ou −1 sem gesto
  animate(dt) {
    const p = this.parts, t = this.age, fury = this.frenzyT > 0, speed = this.vel.length();
    this.spawnT += dt;
    if (this.actT > 0) this.actT -= dt;
    const act = this.actT > 0 ? 1 - this.actT / this.actDur : -1;
    if (this.summonKind === 'fairy') this.poseFairy(p, t, act, speed, fury, dt);
    else if (this.summonKind === 'golem') this.poseGolem(p, t, act, speed, dt);
    else if (this.summonKind === 'slime' || this.summonKind === 'slimemini') this.poseSlime(p, t, dt);
    else this.poseDragon(p, t, act, speed, fury);
    p.aura.visible = p.shell.visible = fury;
    if (fury) {
      p.aura.scale.setScalar(p.auraR * (1 + Math.sin(t * 10) * 0.08));
      p.aura.rotation.y = t * 2;
      p.shell.scale.setScalar(p.shellR * (1 + Math.sin(t * 12) * 0.05));
    }
    this.trailT -= dt;
    if (this.trailT <= 0 && (this.summonKind === 'fairy' || fury)) {   // rastro da fada; em fúria, faíscas em todas
      this.trailT = (this.summonKind === 'fairy' ? 0.07 : 0.14);
      FX.fairyTrail(p.core.getWorldPosition(summonAt), fury);
    }
  }

  // fada: voa em oito, inclina nas curvas e gira ao curar; asas de borboleta batendo (sobe um pouco a cada batida)
  poseFairy(p, t, act, speed, fury) {
    const v = this.visual, beat = t * (fury ? 22 : 15), flap = Math.sin(beat), lift = Math.sin(beat - 0.9);
    v.position.set(Math.sin(t * 1.7) * 0.22, p.hover + Math.sin(t * 3.4) * 0.08 + lift * 0.035, 0);
    v.rotation.set(Math.min(0.35, speed * 0.08), act >= 0 ? (1 - (1 - act) ** 3) * Math.PI * 2 : 0, -Math.cos(t * 1.7) * 0.18);
    for (const w of p.wings) w.rotation.set(-0.3, w.userData.side * (0.62 + flap * 0.5), 0);
    if (p.glow) p.glow.scale.setScalar(p.glow.userData.size * (1 + Math.sin(t * 4) * 0.08 + (act >= 0 ? Math.sin(act * Math.PI) * 0.5 : 0)));
    if (p.groundGlow) p.groundGlow.scale.setScalar(1.5 + Math.sin(t * 3.4) * 0.1);
  }

  // golem: passos pesados com balanço, soco alternado, pulo antes da pancada e queda com braços no chão; brota da terra
  poseGolem(p, t, act, speed, dt) {
    const { core, legs, arms } = p;
    const breath = Math.sin(t * 2.2);
    let lift = 0, bob = breath * 0.015, roll = 0, lean = 0.06, twist = 0, squash = breath * 0.012;
    const legX = [0, 0], armX = [breath * 0.05, -breath * 0.05];
    if (speed > 0.3) {   // passo pesado: o tronco balança para o lado do pé que pisa e afunda (amassa) na pisada
      const w = this.walkPhase = (this.walkPhase || 0) + dt * (2.4 + speed * 1.4), sw = Math.sin(w), plant = 1 - Math.abs(Math.sin(w));
      legX[0] = sw * 0.55; legX[1] = -sw * 0.55;
      armX[0] = -sw * 0.4; armX[1] = sw * 0.4;
      bob = -plant * 0.09;
      squash = -plant * 0.05;
      roll = sw * 0.11;
      twist = sw * 0.14;
      lean = 0.16;
      if (Math.sign(sw) !== this.stepSign) { this.stepSign = Math.sign(sw); if (dt > 0) FX.golemStep(this.pos); }
    }
    if (this.actKind === 'punch' && act >= 0) {   // recua o braço, soca à frente (o golpe acerta em ~55%) e volta
      const i = this.punchSide > 0 ? 1 : 0, side = i ? 1 : -1;
      const a = act < 0.4 ? 0.7 * (act / 0.4) : act < 0.6 ? 0.7 - 2.3 * ((act - 0.4) / 0.2) : -1.6 * (1 - (act - 0.6) / 0.4);
      armX[i] = a;
      twist = -side * a * 0.2;
      lean += Math.max(0, -a) * 0.12;
    } else if (this.actKind === 'slam' && act >= 0) {   // aterrissa: punhos no chão e volta devagar
      const k = Math.min(1, act / 0.15), back = act < 0.4 ? 0 : (act - 0.4) / 0.6;
      lift = 0.14 * (1 - k);
      squash = -0.14 * Math.sin(Math.min(1, act / 0.35) * Math.PI);
      armX[0] = armX[1] = -2.7 + 1.8 * k + 0.9 * back;
      lean = 0.35 * (1 - back);
    } else if (this.slamReady && this.abilityT < 0.45 && this.busy <= 0 && game.state === 'fight') {   // pula erguendo os braços
      const k = 1 - Math.max(0, this.abilityT) / 0.45;
      lift = 0.55 * Math.sin(k * Math.PI * 0.92);
      armX[0] = armX[1] = -2.7 * k;
      legX[0] = legX[1] = -0.3 * k;
      lean = -0.15 * k;
      squash = 0.06 * k;
    }
    if (this.spawnT < 0.8) {   // brota do chão chacoalhando
      const e = this.spawnT / 0.8;
      lift -= 2.8 * (1 - e) ** 2;
      roll += Math.sin(this.spawnT * 30) * 0.12 * (1 - e);
    }
    this.visual.position.y = lift;
    core.position.y = (p.hip ?? 0.5) + bob;
    core.rotation.set(lean, twist, roll);
    core.scale.set(1 - squash * 0.6, 1 + squash, 1 - squash * 0.6);
    if (p.glow) p.glow.scale.setScalar(p.glow.userData.size * (1 + Math.sin(t * 3) * 0.12));
    for (let i = 0; i < 2; i++) {
      legs[i].rotation.x = legX[i];
      arms[i].rotation.set(armX[i], 0, (i ? 1 : -1) * 0.08);
    }
  }

  // dragãozinho: voo ondulado com asas batendo, cauda balançando, cabeça que empina e avança na baforada; entra rodopiando
  poseDragon(p, t, act, speed, fury) {
    const v = this.visual, { head, jaw, tail, wings } = p, flap = Math.sin(t * (fury ? 13 : 9));
    let y = p.hover + Math.sin(t * 1.7) * 0.3 + flap * 0.1, spin = 0, recoil = 0;   // paira alto, subindo e descendo devagar a cada batida
    if (this.spawnT < 0.9) { const e = this.spawnT / 0.9; spin = (1 - e) ** 2 * Math.PI * 2 * 2; y += (1 - e) ** 2 * 3; }
    v.scale.setScalar(SUMMON_DRAGON_SCALE);
    for (const w of wings) w.rotation.set(0, w.userData.side * -0.15, w.userData.side * (0.15 + flap * 0.95));
    tail.rotation.set(Math.sin(t * 2.1) * 0.12, Math.sin(t * 3) * 0.4, 0);
    let headX = Math.sin(t * 2.1 + 0.6) * 0.08, jawX = 0.05 + Math.sin(t * 2) * 0.03;
    if (this.actKind === 'breath' && act >= 0) {   // empina, depois avança com a boca aberta
      const up = act < 0.18 ? act / 0.18 : 0, out = act >= 0.18 ? Math.sin(Math.PI * Math.min(1, (act - 0.18) / 0.82)) : 0;
      headX = -0.5 * up + 0.35 * out;
      jawX = 0.25 * up + 0.6 * out;
      recoil = -0.12 * out;
    }
    head.rotation.set(headX, Math.sin(t * 0.9) * 0.15, 0);
    jaw.rotation.x = jawX;
    v.position.set(0, y, recoil);
    v.rotation.set(Math.min(0.25, speed * 0.06) + Math.sin(t * 1.7 + 1) * 0.08, spin, Math.sin(t * 1.3) * 0.12);   // balanço leve ao pairar
  }

  // segue o herói mais ferido e cura em pulsos
  thinkFairy(dt) {
    let ward = null, worst = 1;
    for (const hero of partyNow()) if (!hero.dead && hero.hp / hero.maxHp < worst) { worst = hero.hp / hero.maxHp; ward = hero; }
    const follow = ward || this.summoner;
    this.goal.copy(follow.pos).add(tmp.set(0.7, 0, -0.5));
    if (this.pos.distanceTo(this.goal) > 0.4) this.moveTo(this.goal, dt);
    else this.face(follow.pos, dt);
    if (this.abilityT > 0 || !ward || ward.pos.distanceTo(this.pos) > this.range) return;
    this.abilityT = this.rule.every;
    const summoner = this.summoner, amount = scaleBranchEffect(summoner, 'support', 9 + skillLevel(summoner.level) * 4) * summoner.skillPower;
    for (const hero of partyNow()) {
      if (hero.dead || (hero !== ward && hero.pos.distanceTo(ward.pos) > 2.5)) continue;
      const heal = Math.min(hero.maxHp - hero.hp, hero === ward ? amount : amount * 0.4);
      if (heal <= 0) continue;
      hero.hp += heal;
      summoner.stats.cura += heal;
      popText(hero.pos, '+' + Math.round(heal), 'heal');
    }
    FX.fairyPulse(this, ward);
    this.act('cast', 0.5);
  }

  // provoca, bate e, de tempos em tempos, dá uma pancada que atordoa ao redor
  thinkGolem(dt) {
    let target = null, best = Infinity;
    for (const enemy of this.enemies()) {
      if (enemy.dead || enemy.spawning) continue;
      const d = enemy.pos.distanceTo(this.pos) - (enemy.pendingHit?.target?.team === 'hero' ? 3 : 0);   // quem ameaça um herói vem primeiro
      if (d < best) { best = d; target = enemy; }
    }
    this.slamReady = false;
    if (!target) { if (this.pos.distanceTo(this.summoner.pos) > 2.2) this.moveTo(this.summoner.pos, dt); return; }
    const distance = target.pos.distanceTo(this.pos);
    this.slamReady = distance <= SUMMON_SLAM_RADIUS + 0.6;   // só para o pulo de preparação da pancada
    if (this.abilityT <= 0 && distance <= SUMMON_SLAM_RADIUS) return this.slam();
    if (distance > this.range + 0.4 * (target.size - 1) || Math.abs(target.pos.y - this.pos.y) >= 0.85) { this.moveTo(target.pos, dt); return; }
    if (this.attackTimer > 0 || this.face(target.pos, dt) >= 0.5) return;
    this.busy = 0.55;
    this.attackTimer = this.cooldown;
    this.punchSide = -(this.punchSide || 1);   // alterna os braços
    this.act('punch', 0.55);
    this.pendingHit = { target, t: 0.3, effect: () => {
      if (target.dead || !units.includes(target)) return;
      heroHit(this.summoner, target, this.dmg, this.pos);
      burst(target.pos.clone().setY(target.pos.y + 0.6), [0xd8c29a, 0xffffff], 6, 2.2);
    } };
  }

  slam() {
    const power = this.summoner.skillPower;
    this.abilityT = this.rule.every;
    this.busy = 0.7;
    this.squashT = 0.25;
    for (const enemy of this.enemies()) if (!enemy.dead && !enemy.spawning && enemy.pos.distanceTo(this.pos) <= SUMMON_SLAM_RADIUS + 0.4 * (enemy.size - 1)) {
      heroHit(this.summoner, enemy, this.dmg * 1.6, this.pos);
      enemy.stunT = Math.max(enemy.stunT || 0, (enemy.boss ? SUMMON_BOSS_CONTROL : SUMMON_STUN) * power);
      if (!enemy.boss) enemy.pendingHit = null;
    }
    this.act('slam', 0.7);
    FX.golemSlam(this, SUMMON_SLAM_RADIUS);
  }

  // voa a meia distância do alvo e cospe fogo em cone, deixando os inimigos queimando
  thinkDragon(dt) {
    const near = [];
    for (const enemy of this.enemies()) if (!enemy.dead && !enemy.spawning && enemy.pos.distanceTo(this.pos) <= 10) near.push(enemy);
    const target = near.length ? highestPriorityHeroTarget(this.summoner, near, this.pos) || nearest(this.pos, near) : null;
    if (!target) { if (this.pos.distanceTo(this.summoner.pos) > 2.5) this.moveTo(this.summoner.pos, dt); return; }
    const distance = target.pos.distanceTo(this.pos);
    if (distance > 3.2) this.moveTo(target.pos, dt);
    else this.face(target.pos, dt);
    if (this.abilityT > 0 || distance > this.range) return;
    this.abilityT = this.rule.every;
    const summoner = this.summoner, power = summoner.skillPower, hit = summoner.dmg * 0.75 * power;
    for (const enemy of coneTargets(this.pos, target.pos, near, this.range, 0.55)) {
      heroHit(summoner, enemy, hit, this.pos);
      enemy.burnT = Math.max(enemy.burnT || 0, 3 * power);
      enemy.burnTick = Math.min(enemy.burnTick || 0.5, 0.35);
      enemy.burnDmg = Math.max(enemy.burnDmg || 0, summoner.dmg * 0.1 * power);
      enemy.burnOwner = summoner;
    }
    const dir = tmp.subVectors(target.pos, this.pos).setY(0).normalize();
    this.act('breath', 0.6);
    FX.dragonBreath(this.parts.mouth.getWorldPosition(new THREE.Vector3()), dir.clone(), this.range);
  }
}

// ---------- Slime Saltitante (métodos de SummonedCreature, definidos aqui para ficarem juntos) ----------
// gosma que amassa, estica no ar e achata ao pousar; o mini é a mesma gosma em escala menor
SummonedCreature.prototype.poseSlime = function poseSlime(p, t, dt) {
  const v = this.visual, base = this.summonKind === 'slimemini' ? 0.6 : 1, j = this.jump;
  this.landT += dt;
  let y = 0, sy = 1, sx = 1;
  if (j) {
    const k = Math.min(1, j.t / j.dur);
    y = 4 * j.h * k * (1 - k);
    sy = 1 + Math.sin(k * Math.PI) * 0.22;   // estica subindo e descendo
    sx = 1 / Math.sqrt(sy);
  } else if (this.landT < 0.4) {   // pousa achatando e balança até assentar
    const e = this.landT / 0.4, squash = Math.cos(e * Math.PI * 2.5) * (1 - e) * 0.32;
    sy = 1 - squash; sx = 1 + squash * 0.6;
  } else {
    const crouch = this.abilityT < 0.25 && this.hasPrey ? 0.22 * (1 - Math.max(0, this.abilityT) / 0.25) : 0;   // agacha antes de saltar
    const b = Math.sin(t * 4);
    sy = 1 + b * 0.05 - crouch; sx = 1 - b * 0.03 + crouch * 0.5;
  }
  v.position.y = y;
  v.scale.set(sx * base, sy * base, sx * base);
  v.rotation.z = j ? 0 : Math.sin(t * 2) * 0.04;
};

// grupo inimigo mais denso (raio do impacto) perto do Invocador; devolve o centro dos que cabem no impacto
SummonedCreature.prototype.slimeSpot = function slimeSpot() {
  const hop = SLIME_HOP[this.summonKind], pool = [];
  for (const enemy of this.enemies()) if (!enemy.dead && !enemy.spawning && enemy.pos.distanceTo(this.summoner.pos) <= hop.scan) pool.push(enemy);
  if (!pool.length) return null;
  if (this.summonKind === 'slimemini') {   // cada mini escolhe um alvo diferente: o mais próximo, depois o seguinte
    pool.sort((a, b) => a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos));
    return pool[this.miniIndex % pool.length].pos.clone();
  }
  const { center } = densest(pool, hop.radius, null), spot = new THREE.Vector3();
  let n = 0;
  for (const enemy of pool) if (enemy.pos.distanceTo(center.pos) <= hop.radius) { spot.add(enemy.pos); n++; }
  return spot.multiplyScalar(1 / n);
};

SummonedCreature.prototype.thinkSlime = function thinkSlime(dt) {
  const mini = this.summonKind === 'slimemini', hop = SLIME_HOP[this.summonKind];
  if (this.jump) { this.hopStep(dt); return; }
  if (mini && this.landT < 9) { this.life = 0; return; }   // o mini estoura depois do único pulo
  const spot = this.slimeSpot();
  this.hasPrey = !!spot;
  if (!spot) {
    if (mini) { this.life = 0; return; }
    if (this.pos.distanceTo(this.summoner.pos) > 3) this.moveTo(this.summoner.pos, dt);   // sem inimigos, volta para perto do mago
    return;
  }
  if (this.abilityT > 0) { this.face(spot, dt); return; }
  this.abilityT = this.rule.every;
  spot.y = world.groundHeight(spot.x, spot.z);
  this.face(spot, 1);
  this.jump = { from: this.pos.clone(), to: spot, t: 0, dur: hop.dur, h: hop.height };
  burst(this.pos.clone().setY(this.pos.y + 0.2), [this.rule.color, 0xff9ccf], fewer(4), 2, { gravity: 8, size: 0.9 });
};

SummonedCreature.prototype.hopStep = function hopStep(dt) {
  const j = this.jump;
  j.t += dt;
  const k = Math.min(1, j.t / j.dur);
  const x = j.from.x + (j.to.x - j.from.x) * k, z = j.from.z + (j.to.z - j.from.z) * k;
  this.pos.set(x, world.groundHeight(x, z), z);
  if (k < 1) return;
  this.jump = null;
  this.landT = 0;
  this.slimeLand();
};

// pouso: dano de impacto e lentidão em quem está no raio; chefe só fica lento (controlEnemy já não encurta o que vale)
SummonedCreature.prototype.slimeLand = function slimeLand() {
  const hop = SLIME_HOP[this.summonKind], summoner = this.summoner, power = summoner.skillPower;
  let hits = 0;
  for (const enemy of this.enemies()) {
    if (enemy.dead || enemy.spawning || enemy.pos.distanceTo(this.pos) > hop.radius + 0.4 * (enemy.size - 1)) continue;
    hits++;
    heroHit(summoner, enemy, summoner.dmg * hop.dmg * power, this.pos);
    if (!enemy.dead) controlEnemy(enemy, 'slowT', scaleBranchEffect(summoner, 'control', hop.slow) * power);
  }
  this.lastHits = hits;
  FX.slimeLand(this.pos, hop.radius, this.summonKind === 'slimemini');
};

// fim do slime grande: dois pequenos nascem onde ele está (cada um dá um salto e estoura)
SummonedCreature.prototype.splitSlime = function splitSlime() {
  if (this.split) return;
  this.split = true;
  for (let i = 0; i < 2; i++) {
    const at = this.pos.clone().add(tmp.set(i ? 0.5 : -0.5, 0, 0));
    const mini = new SummonedCreature(this.summoner, 'slimemini', at, i);
    mini.phase = this.phase;
  }
  popText(this.pos, 'Plop!', 'evolve');
};

// Uma criatura de cada tipo por Invocador: chamar de novo renova a duração e a vida.
function callSummon(summoner, kind) {
  let creature = units.find((unit) => unit.summonKind === kind && unit.summoner === summoner && !unit.dead);
  if (creature) creature.renew();
  else creature = new SummonedCreature(summoner, kind);
  FX.pactCall(summoner, creature, SUMMON_RULES[kind].color);
  popText(creature.pos, { fairy: 'Fada!', golem: 'Golem!', dragon: 'Dragão!', slime: 'Slime!' }[kind], 'evolve');
  return creature;
}

// ---------- Ilusionista: imagens ilusórias ----------
// Aliados temporários e procedurais: o corpo do próprio herói, translúcido e violeta, parado no lugar. Provocam os
// inimigos próximos e se desfazem em fumaça ao levar `hits` golpes ou ao fim do tempo; quem quebra uma imagem perde o golpe.
// São team 'ally' sem stats e sem `summoner` (não são heróis nem criaturas): não contam para o fim da partida
// nem para o limite de invocações do Necromante e do Invocador.
const ILLUSION_REACH = 6.5, ILLUSION_MAX = 4, ILLUSION_OPACITY = 0.5, ILLUSION_STUN = 0.5;
const ILLUSION_TINT = new THREE.Color(0x9a86ff);

// chefes só cedem pela resistência de controle de sempre (controlEnemy); totens nunca
function illusionTaunt(enemy, image, seconds, cut = true) {
  if (enemy.dead || enemy.spawning || enemy.totem || image.dead) return;
  if (enemy.boss) { if (!controlEnemy(enemy, 'tauntT', seconds * 0.5)) return; }   // chefe: metade do tempo e a resistência de controle de sempre
  else enemy.tauntT = Math.max(enemy.tauntT || 0, seconds);
  enemy.taunt = image;
  if (cut && !enemy.boss) enemy.pendingHit = null;
}
function illusionProvoke(enemies, image, seconds) {
  for (const enemy of enemies) illusionTaunt(enemy, image, seconds, true);
}
// ponto a `dist` do herói na direção de `toward` (se o chão não deixar, mais perto; se ainda assim não, ao lado)
function illusionSpot(hero, toward, dist) {
  const dir = new THREE.Vector3().subVectors(toward, hero.pos).setY(0);
  if (dir.lengthSq() < 0.01) dir.copy(hero.fwd);
  dir.normalize();
  for (const d of [dist, dist * 0.5]) {
    const p = hero.pos.clone().addScaledVector(dir, d);
    if (world.canStep(hero.pos, p)) return p;
  }
  return hero.pos.clone().add(new THREE.Vector3(dir.z, 0, -dir.x));
}

class Illusion extends Unit {
  constructor(owner, at, { kind = 'copy', life = 5, hits = 1 } = {}) {
    // no máximo ILLUSION_MAX imagens do mesmo herói: a mais antiga se desfaz
    const mine = units.filter((u) => u.illusion && u.owner === owner && !u.dead);
    while (mine.length >= ILLUSION_MAX) mine.shift().shatter();
    super(owner.cfg.built, { hp: 1, dmg: 0, range: 0, speed: 0, cooldown: 99 }, 'ally');
    this.owner = owner;
    this.illusion = true;
    this.kind = kind;
    this.cfg = { id: 'illusion', idle: owner.cfg.idle };
    this.level = owner.level;
    this.life = life;
    this.hits = hits;
    this.age = 0;
    this.fade = 0;
    this.refreshT = 0.5;
    this.phase = game.phase;
    this.size = owner.size;
    this.pos.copy(at).setY(world.groundHeight(at.x, at.z));
    this.root.rotation.y = owner.root.rotation.y;
    this.bar.remove();   // sem barra de vida: some ao primeiro golpe
    this.popT = 0;
    this.root.traverse((o) => {
      if (owner.cfg.hide.includes(o.name)) o.visible = false;
      if (o.isMesh) o.castShadow = false;
    });
    for (const m of this.mats) {
      m.transparent = true;
      m.depthWrite = false;
      m.opacity = ILLUSION_OPACITY;
      m.color?.lerp(ILLUSION_TINT, 0.55);
      m.needsUpdate = true;
    }
    this.loop(this.cfg.idle);
    FX.illusionSmoke(this.pos, 3);
    wave(this.pos, 0xb8a8ff, 0.2, 1.3, 0.5, { opacity: 0.5 });
  }

  // quebra: uma nuvem de fumaça violeta e a imagem esmaece depressa (dead: quem a provocava larga o alvo)
  shatter() {
    if (this.dead) return;
    this.dead = true;
    this.pendingHit = null;
    this.fade = 0.25;
    FX.illusionSmoke(this.pos, 4);
    burst(this.pos.clone().setY(this.pos.y + 1), [0xc8b8ff, 0xf0e8ff], 6, 3, { life: 0.5, size: 1 });
  }

  // qualquer golpe conta: o atacante erra o alvo e perde o tempo do golpe; veneno e afins não a quebram
  takeDamage(n, from, owner = null, critical = false, dot = false) {
    if (this.dead || game.over || dot) return;
    popText(this.pos, 'Errou!', 'dodge');
    if (owner?.team === 'skeleton' && !owner.dead) {
      if (owner.boss) controlEnemy(owner, 'stunT', ILLUSION_STUN);
      else owner.stunT = Math.max(owner.stunT || 0, ILLUSION_STUN);
      owner.pendingHit = null;
    }
    this.squashT = 0.25;
    if (--this.hits <= 0) this.shatter();
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    if (this.dead) {
      this.fade -= dt;
      for (const m of this.mats) m.opacity = ILLUSION_OPACITY * Math.max(0, this.fade / 0.25);
      if (this.fade <= 0) this.remove();
      return;
    }
    this.age += dt;
    this.life -= dt;
    const owner = this.owner;
    if (this.life <= 0 || owner.dead || !units.includes(owner) || game.over || game.state === 'cleared' || game.phase !== this.phase) { this.shatter(); return; }
    // pisca de leve e, no fim, depressa
    const alpha = this.life < 1.2 ? (Math.sin(this.age * 26) > 0 ? ILLUSION_OPACITY : 0.2) : ILLUSION_OPACITY + Math.sin(this.age * 5) * 0.07;
    for (const m of this.mats) m.opacity = alpha;
    if (game.state !== 'fight') return;
    const foes = activeTargetContext?.attackableSkeletons ?? skeletonsAlive().filter((s) => !s.spawning);
    // reforça a provocação em quem está solto (nunca por cima de outra provocação em curso); no salão, cada um escolhe uma imagem ao acaso
    this.refreshT -= dt;
    if (this.refreshT <= 0) {
      this.refreshT = 0.5;
      const pool = this.kind === 'mirror' ? units.filter((u) => u.illusion && u.owner === owner && u.kind === 'mirror' && !u.dead) : null;
      for (const enemy of foes) if (!enemy.dead && !enemy.boss && enemy.tauntT <= 0.35 && enemy.pos.distanceTo(this.pos) <= ILLUSION_REACH) {
        illusionTaunt(enemy, pool ? pool[Math.floor(Math.random() * pool.length)] : this, 0.9, false);
      }
    }
    const foe = nearest(this.pos, foes);
    if (foe) this.face(foe.pos, dt);
  }
}

// Troca de fase do chefe: ao cair abaixo de metade da vida, ele se enfurece e recupera parte dela de uma vez.
const BOSS_RALLY_AT = 0.5, BOSS_RALLY_HEAL = 0.25;   // fração da vida que dispara · fração da vida máxima recuperada
class Skeleton extends Unit {
  constructor(type, phase, boss = false) {
    const base = SKELETONS[type];
    const D = difficulty;
    const F = game.mission?.foeScale;   // ajuste fino da missão (fases altas da campanha): vida e dano de todos os inimigos
    const hpScale = (1 + (phase - 1) * 0.19) * D.hp * (boss ? 9 * D.boss : 1) * (game.partyScale?.hp || 1) * (F?.hp ?? 1);   // equipe maior que a da missão: inimigos mais resistentes
    const dmgScale = (1 + (phase - 1) * 0.14) * D.dmg * (boss ? 2.5 * D.boss : 1) * (F?.dmg ?? 1);
    super(skeletonModel(base.model || type), { ...base, hp: Math.round(base.hp * hpScale), dmg: Math.round(base.dmg * dmgScale), speed: base.speed * (boss ? 0.8 : 1) }, 'skeleton');
    this.boss = boss || !!base.heavy;   // o golem é pesado como um chefe, mas sem a vida de chefe
    this.phaseBoss = !!boss;             // só o chefe da fase encerra objetivos de chefe na campanha
    this.ranged = !!base.ranged;
    this.mobile = !!base.mobile;       // atiradores que andam (sacerdote, lich)
    this.phasing = !!base.phasing;     // atravessa obstáculos e o grupo
    this.kind = base;
    this.restoresBaseEmissive = true; // o update aplica flash, slow e glow por material
    this.emissiveMode = null;
    this.emissiveDirty = true;
    this.enemyKind = type;
    this.attackAnim = base.attack || '1H_Melee_Attack_Chop';
    this.attackAnims = base.attacks || null;   // golpe comum sorteado entre estes
    this.stunT = 0;
    this.rootT = 0;
    this.slowT = 0;
    this.burnT = 0;
    this.burnTick = 0;
    this.burnDmg = 0;
    this.burnOwner = null;
    this.weakT = 0;       // Escudo Ricochete: causa −25% de dano em aliados enquanto durar
    this.poisonT = 0;     // Veneno Aderente da Alquimista: dano ao longo do tempo no corpo
    this.poisonTick = 0;
    this.poisonDmg = 0;
    this.poisonOwner = null;
    this.tauntT = 0;
    this.markT = 0;       // Flecha do caçador: recebe +markBonus de dano
    this.markBonus = 0;
    this.reapT = 0; this.reapBy = null;   // Ceifa do Necromante: marca que cura o grupo se o inimigo morrer
    this.disarmT = 0; this.disarmCut = 0;   // Desarmar do Duelista: dano menor
    this.blindT = 0; this.blindMiss = 0;    // Ofuscar do Ilusionista: erra golpes
    this.panicT = 0; this.panicVictim = null; this.panicLook = 0;   // Pânico do Ilusionista: ataca o vizinho
    this.sheepT = 0;      // Grande transmutação: ovelha que não ataca
    this.stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(starGeo, goldMat);
      star.position.set(Math.cos(i * Math.PI * 2 / 3) * 0.45, 2.1, Math.sin(i * Math.PI * 2 / 3) * 0.45);
      this.stars.add(star);
    }
    this.stars.visible = false;
    this.root.add(this.stars);
    this.move = base.move || 'Walking_D_Skeletons';
    this.walk = base.walk || 'Walking_D_Skeletons';
    this.idle = base.idle || 'Idle_Combat';
    if (this.ranged && !this.mobile && this.speed <= 0) this.speed = 1.1;   // atiradores fixos só avançam para adquirir um alvo no alcance
    this.speed *= 0.85 + Math.random() * 0.3;   // cada esqueleto num ritmo um pouco diferente
    this.size = base.size || (boss ? 1.7 : 1);
    this.root.scale.setScalar(this.size);
    if (boss) this.range += 0.6;
    if (this.boss) this.bar.classList.add('boss');
    if (base.weapon) this.attach(base.weapon, 'handslotr');   // o GLTFLoader tira o ponto de "handslot.r"
    if (base.shield) this.attach(base.shield, 'handslotl');
    this.spawning = true;
    // sai da cova; às vezes levanta do chão. Chefes acordam devagar. Mesma duração do surgimento comum.
    const rise = base.spawn ? null : this.boss ? 'Skeletons_Awaken_Floor_Long' : Math.random() < 0.3 ? 'Skeletons_Awaken_Floor' : null;
    const riseClip = rise && THREE.AnimationClip.findByName(this.clips, rise), spawnClip = THREE.AnimationClip.findByName(this.clips, 'Spawn_Ground_Skeletons');
    this.busy = riseClip && spawnClip ? this.once(rise, riseClip.duration / spawnClip.duration) : this.once(base.spawn || 'Spawn_Ground_Skeletons');
    base.dress?.(this);   // peças, cores e brilho dos tipos novos
  }

  // morte variada: quase sempre desmonta numa pilha de ossos (a cabeça rola longe); às vezes tomba inteiro
  die() {
    super.die();
    const r = this.boss ? 0 : Math.random();
    if (r > 0.65) this.once(r > 0.85 ? 'Death_A' : 'Death_B', 1.3);
  }

  // golpe recebido alterna entre os dois trancos
  takeDamage(...args) {
    const before = this.current;
    super.takeDamage(...args);
    if (!this.dead && this.current !== before && this.current === this.actions.Hit_B && Math.random() < 0.5) this.busy = this.once('Hit_A', 1.6) * 0.8;
  }

  attach(asset, bone) {
    const slot = this.root.getObjectByName(bone);
    const item = assets[asset].scene.clone();
    item.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    slot.add(item);
  }

  graze(dt) {
    this.spawning = false;
    this.grazeT = (this.grazeT || 0) - dt;
    if (this.grazeT <= 0) {   // troca de rumo de vez em quando; às vezes para e pasta
      this.grazeT = 0.8 + Math.random();
      const a = Math.random() * Math.PI * 2, v = Math.random() < 0.35 ? 0 : 0.8;
      this.grazeDir = [Math.cos(a) * v, Math.sin(a) * v];
    }
    if (this.rootT > 0) return;
    this.vel.set(this.grazeDir[0], 0, this.grazeDir[1]);
    this.moving = true;
    if (this.grazeDir[0] || this.grazeDir[1]) this.face(tmp.copy(this.pos).add(this.vel), dt);
  }

  rally() {
    if (this.rallied || this.dead || this.spawning || this.hp > this.maxHp * BOSS_RALLY_AT) return;
    this.rallied = true;
    const heal = Math.min(this.maxHp - this.hp, this.maxHp * BOSS_RALLY_HEAL);
    this.hp += heal;
    popText(this.pos, `+${Math.round(heal)}`, 'heal');
    showBanner('Chefe furioso!', 1.6);
    ring(this.pos, 2 * this.size, 0xff5a3a);
    if (this.busy <= 0 && !this.pendingHit) this.busy = this.once('Taunt', 1.1);   // urra antes de voltar à luta
  }

  update(dt) {
    if (dt <= 0) return;
    this.rootT = Math.max(0, this.rootT - dt);
    if (this.rootT > 0) this.vel.set(0, 0, 0);
    this.stunT = Math.max(0, this.stunT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.controlWindowT = Math.max(0, (this.controlWindowT || 0) - dt);
    this.burnT = Math.max(0, this.burnT - dt);
    this.weakT = Math.max(0, this.weakT - dt);
    this.burnTick -= dt;
    if (this.burnT > 0 && this.burnTick <= 0 && this.burnOwner && !this.dead) {
      this.takeDamage(this.burnDmg, this.pos, this.burnOwner);
      this.burnTick = 0.65;
    }
    if (this.poisonT > 0) {
      this.poisonT = Math.max(0, this.poisonT - dt);
      this.poisonTick -= dt;
      if (this.poisonTick <= 0 && this.poisonOwner && !this.dead) {
        this.poisonTick += VENOM_EVERY;
        this.takeDamage(this.poisonDmg, null, this.poisonOwner, false, true);
        FX.venomDrip(this);
      }
    }
    this.root.rotation.z = this.rootT > 0 && !this.dead ? Math.sin(this.rootT * 45) * 0.05 : 0;   // preso pelos galhos: treme tentando se soltar
    this.tauntT -= dt;
    this.markT = Math.max(0, this.markT - dt);
    if (this.markT <= 0) this.markBonus = 0;
    this.reapT = Math.max(0, this.reapT - dt);
    this.sheepT = Math.max(0, this.sheepT - dt);
    this.disarmT -= dt; this.blindT -= dt; this.panicT -= dt;
    if (this.stunT > 0 || this.sheepT > 0) { this.pendingHit = null; if (this.stunT > 0) this.vel.set(0, 0, 0); }
    this.updateCommon(dt);
    this.stars.visible = !this.dead && this.stunT > 0;
    this.stars.rotation.y += dt * 5;
    const emissiveMode = this.flashOn ? 'flash' : this.slowT > 0 ? 'slow' : 'normal';
    if (emissiveMode !== this.emissiveMode || this.emissiveDirty) {
      if (!this.flashOn) for (const m of this.mats) setUnitEmissive(m, this.slowT > 0 ? 0x246d99 : m.userData?.glow ?? 0);
      this.emissiveMode = emissiveMode;
      this.emissiveDirty = false;
    }

    if (this.dead) {
      this.deadTime += dt;
      if (this.deadTime > 1) { poof(this.pos, this.size); this.remove(); }   // some numa nuvenzinha
      return;
    }
    if (game.over) return;
    if (this.sheepT > 0) { this.graze(dt); return; }   // ovelha: só pasta e anda à toa até a magia acabar
    this.kind?.tick?.(this, dt);   // recargas, flutuar e investida dos tipos novos
    if (this.phaseBoss) this.rally();   // depois do tick: o chefe entra na fase 2 e então se recupera
    if (this.stunT > 0 || this.busy > 0) return;
    this.spawning = false;
    const taunted = this.tauntT > 0 && this.taunt && !this.taunt.dead;
    let target = taunted ? this.taunt
      : this.raider && game.shrine && !game.shrine.dead ? game.shrine
        : this.raider && game.gate ? game.gate
        : nearest(this.pos, activeTargetContext?.alliedUnits ?? enemyTargetAllies());
    // na fila de espera em volta de um alvo cheio: troca por outro alvo próximo que ainda tenha vaga no contato
    if (!taunted && !this.raider && !this.ranged && target && this.engage?.waiting && this.engage.target === target) {
      const limit = target.pos.distanceTo(this.pos) + 4;
      let best = null, bestDistance = Infinity;
      for (const u of activeTargetContext?.alliedUnits ?? enemyTargetAllies()) {
        if (u === target || u.dead || u.engageFull === engageGeneration - 1) continue;
        const d = u.pos.distanceTo(this.pos);
        if (d < limit && d < bestDistance) { best = u; bestDistance = d; }
      }
      if (best) { target = best; this.engageSwitched = best; }
    } else if (this.engageSwitched && !taunted && !this.raider && target) {
      // quem trocou para um alvo com vaga não volta para a fila do mais próximo enquanto ele seguir cheio e perto
      const held = this.engageSwitched;
      if (held !== target && !held.dead && !held.untargetable && target.engageFull === engageGeneration - 1
        && held.pos.distanceTo(this.pos) < target.pos.distanceTo(this.pos) + 4) target = held;
      else this.engageSwitched = null;
    }
    if (this.panicT > 0 && !this.boss) {   // Pânico: ataca o inimigo mais próximo em vez dos heróis
      this.panicLook -= dt;
      if (!this.panicVictim || this.panicVictim.dead || this.panicLook <= 0) {
        this.panicLook = 0.5;
        this.panicVictim = nearest(this.pos, (activeTargetContext?.skeletons ?? skeletonsAlive()).filter((o) => o !== this && !o.dead && !o.spawning && !o.totem && !(o.sheepT > 0)));
      }
      target = this.panicVictim;
    }
    this.target = target;
    if (this.kind?.think?.(this, dt, target)) {   // comportamento próprio (golpes especiais, cura, bomba)
      if (this.busy <= 0) this.locomote(this.move, this.walk, this.idle);
      return;
    }
    const kite = this.ranged && !this.phasing && this.rootT <= 0 ? kiteSkeletonFrom(this, target, dt) : null;
    if (kite) {
      this.moveTo(kite, dt, Math.max(this.speed, 2.4));
      if (this.busy <= 0) this.locomote(this.move, this.walk, this.idle);
      return;
    }
    if (target) {
      const d = target.pos.distanceTo(this.pos);
      const inAttackRange = this.inReach(target, d);
      if (this.ranged) {
        if (!this.mobile && !inAttackRange && this.rootT <= 0) this.moveTo(target.pos, dt);
        else this.vel.set(0, 0, 0);
      }
      if (!inAttackRange || (!this.ranged && Math.abs(target.pos.y - this.pos.y) >= 0.85)) { if (!this.ranged && this.rootT <= 0) this.approach(target, dt); }
      else {
        this.stopApproach(target);
        if (this.face(target.pos, dt) < 0.5 && this.attackTimer <= 0) {
          const pool = this.attackAnims;
          this.attack(target, pool ? pool[Math.floor(Math.random() * pool.length)] : this.attackAnim);
        }
      }
    }
    if (this.busy <= 0) this.locomote(this.move, this.walk, this.idle);
  }
}

// move units apart in a few small solver passes so blocked moves do not put
// them back at their original, overlapping positions.
const collisionFrom = { x: 0, z: 0 }, collisionTo = { x: 0, z: 0 };
const separationSideA = { x: 0, z: 0 }, separationSideB = { x: 0, z: 0 };
// Mantém espaço entre aliados da mesma facção, mas deixa os adversários entrar no alcance de combate.
const UNIT_SEPARATION_FACTOR = 0.86;
const UNIT_COMBAT_SEPARATION_FACTOR = 0.68;
// Heróis se cruzam em corredores; a folga da formação ociosa continua maior.
const UNIT_HERO_SEPARATION_FACTOR = UNIT_COMBAT_SEPARATION_FACTOR;
const MELEE_CONTACT_SLACK = 0.12;   // folga para o contato contar como "no alcance" mesmo com a separação resolvendo no limite
function collisionMove(unit, dx, dz) {
  const pos = unit.pos, fromX = pos.x, fromZ = pos.z;
  let fraction = 1;
  for (let attempt = 0; attempt < 5; attempt++, fraction *= 0.5) {
    const toX = fromX + dx * fraction, toZ = fromZ + dz * fraction;
    collisionFrom.x = fromX; collisionFrom.z = fromZ;
    collisionTo.x = toX; collisionTo.z = toZ;
    if (!world.canStep(collisionFrom, collisionTo)) continue;
    pos.x = toX;
    pos.z = toZ;
    return Math.hypot(dx, dz) * fraction;
  }
  return 0;
}

const PLANTED_SEPARATION_WEIGHT = 0.15;
const PUSHING_SEPARATION_WEIGHT = 0.4;    // destrava sem transferir quase todo o empurrão para os aliados ao redor
// mesmo limiar de locomote(): abaixo dele a unidade está parada (idle) ou golpeando
const isPlanted = (u) => u.busy > 0 || u.vel.x * u.vel.x + u.vel.z * u.vel.z < 0.0625;

function separatePair(a, b, ia, ib) {
  if (Math.abs(a.pos.y - b.pos.y) >= 0.85) return false;
  const movableA = !(a.structure || a.totem), movableB = !(b.structure || b.totem);
  if (!movableA && !movableB) return false;
  const sameFaction = (a.team === 'skeleton') === (b.team === 'skeleton');
  const heroPair = a.team === 'hero' && b.team === 'hero'
    && !(a.structure || a.totem || b.structure || b.totem);
  const factor = heroPair ? UNIT_HERO_SEPARATION_FACTOR
    : sameFaction ? UNIT_SEPARATION_FACTOR : UNIT_COMBAT_SEPARATION_FACTOR;
  const min = factor * (a.size + b.size);
  let dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq >= min * min) return false;
  let distance = Math.sqrt(distanceSq);
  if (distance < 0.001) {
    // Give perfectly coincident units a stable direction instead of skipping them.
    const angle = (ia * 0.754877666 + ib * 0.569840291) * Math.PI * 2;
    dx = Math.cos(angle); dz = Math.sin(angle); distance = 0;
  } else { dx /= distance; dz /= distance; }

  // Quem está plantado (parado ou no meio do golpe) quase não cede: quem chega é que contorna.
  // Sem isso a fila que anda empurra o da frente para dentro do alvo, e o grupo inteiro treme.
  const weightA = a.pushT > 0 ? PUSHING_SEPARATION_WEIGHT : isPlanted(a) ? PLANTED_SEPARATION_WEIGHT : 1;
  const weightB = b.pushT > 0 ? PUSHING_SEPARATION_WEIGHT : isPlanted(b) ? PLANTED_SEPARATION_WEIGHT : 1;
  const overlap = min - distance, shareA = overlap * weightA / (weightA + weightB), shareB = overlap - shareA;
  let movedA = movableA ? collisionMove(a, -dx * shareA, -dz * shareA) : 0;
  let movedB = movableB ? collisionMove(b, dx * shareB, dz * shareB) : 0;
  let remaining = overlap - movedA - movedB;
  if (remaining > 0.002) {
    if (movableA && movableB) {
      const extraA = collisionMove(a, -dx * remaining, -dz * remaining);
      remaining -= extraA;
      if (remaining > 0.002) collisionMove(b, dx * remaining, dz * remaining);
    } else if (movableA) collisionMove(a, -dx * remaining, -dz * remaining);
    else collisionMove(b, dx * remaining, dz * remaining);
  }

  // When a wall or height boundary blocks the direct push, let the pair slide
  // around the contact instead of remaining stacked on the same point.
  let slideX = b.pos.x - a.pos.x, slideZ = b.pos.z - a.pos.z;
  const slideDistance = Math.hypot(slideX, slideZ);
  if (slideDistance < min) {
    if (slideDistance > 0.001) { slideX /= slideDistance; slideZ /= slideDistance; }
    else { slideX = dx; slideZ = dz; }
    const sideDistance = Math.sqrt(Math.max(0, min * min - slideDistance * slideDistance))
      * (movableA && movableB ? 0.5 : 1);
    const sideDx = -slideZ, sideDz = slideX;
    if (movableA && movableB) {
      separationSideA.x = a.pos.x; separationSideA.z = a.pos.z;
      separationSideB.x = b.pos.x; separationSideB.z = b.pos.z;
      collisionMove(a, -sideDx * sideDistance, -sideDz * sideDistance);
      collisionMove(b, sideDx * sideDistance, sideDz * sideDistance);
      if (Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) <= slideDistance + 0.002) {
        a.pos.x = separationSideA.x; a.pos.z = separationSideA.z;
        b.pos.x = separationSideB.x; b.pos.z = separationSideB.z;
      }
    } else {
      const moving = movableA ? a : b;
      separationSideA.x = moving.pos.x; separationSideA.z = moving.pos.z;
      for (const direction of [1, -1]) {
        collisionMove(moving, sideDx * sideDistance * direction, sideDz * sideDistance * direction);
        if (Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > slideDistance + 0.002) break;
        moving.pos.x = separationSideA.x; moving.pos.z = separationSideA.z;
      }
    }
  }

  // Remove inward velocity at contact so units stop pushing through one another.
  const closing = (a.vel.x - b.vel.x) * dx + (a.vel.z - b.vel.z) * dz;
  if (closing > 0) {
    if (movableA && movableB) {   // o plantado não herda o embalo de quem chega (não "anda" por ser empurrado)
      const cancelA = closing * weightA / (weightA + weightB), cancelB = closing - cancelA;
      a.vel.x -= dx * cancelA; a.vel.z -= dz * cancelA;
      b.vel.x += dx * cancelB; b.vel.z += dz * cancelB;
    } else if (movableA) { a.vel.x -= dx * closing; a.vel.z -= dz * closing; }
    else { b.vel.x += dx * closing; b.vel.z += dz * closing; }
  }
  return true;
}

const SEPARATION_CELL_SIZE = 3;
const MOVE_AVOID_RADIUS = 5;      // cobre a frente (2,6 m + folga) e quem vem de lado em rota de colisão
const moveAvoidNear = [];
const OBSTACLE_GRID_QUERY_THRESHOLD = 512;
const OBSTACLE_QUERY_CACHE_LIMIT = 1024;
const separationAlive = [], separationCandidates = [], separationCellX = [], separationCellZ = [];
// grade de unidades densa e reaproveitada: tabela fixa de baldes (hash da célula) preenchida por contagem,
// sem Map nem arrays por célula. Itens de um balde ficam em ordem de índice; quem lê confere a célula exata.
const UNIT_GRID_BUCKETS = 4096;
const unitGridStart = new Int32Array(UNIT_GRID_BUCKETS + 1), unitGridCursor = new Int32Array(UNIT_GRID_BUCKETS);
let unitGridItems = new Int32Array(256), unitGridBucketOf = new Int32Array(256), unitGridSize = 0;
const compareIndexes = (a, b) => a - b;
function buildUnitGrid() {
  const n = separationAlive.length;
  if (unitGridItems.length < n) { unitGridItems = new Int32Array(n * 2); unitGridBucketOf = new Int32Array(n * 2); }
  unitGridStart.fill(0);
  for (let i = 0; i < n; i++) {
    const unit = separationAlive[i];
    const x = separationCellX[i] = Math.floor(unit.pos.x / SEPARATION_CELL_SIZE);
    const z = separationCellZ[i] = Math.floor(unit.pos.z / SEPARATION_CELL_SIZE);
    const b = unitGridBucketOf[i] = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) & (UNIT_GRID_BUCKETS - 1);
    unitGridStart[b + 1]++;
  }
  for (let b = 0; b < UNIT_GRID_BUCKETS; b++) { unitGridStart[b + 1] += unitGridStart[b]; unitGridCursor[b] = unitGridStart[b]; }
  for (let i = 0; i < n; i++) unitGridItems[unitGridCursor[unitGridBucketOf[i]]++] = i;
  unitGridSize = n;
}
// índices (em separationAlive) das unidades nas células em volta de (x, z), do último separate()
const unitGridNear = [];
function gatherUnitGrid(x, z, radius, out = unitGridNear) {
  out.length = 0;
  if (!unitGridSize) return out;
  const minX = Math.floor((x - radius) / SEPARATION_CELL_SIZE), maxX = Math.floor((x + radius) / SEPARATION_CELL_SIZE);
  const minZ = Math.floor((z - radius) / SEPARATION_CELL_SIZE), maxZ = Math.floor((z + radius) / SEPARATION_CELL_SIZE);
  for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++) {
    const b = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) & (UNIT_GRID_BUCKETS - 1);
    for (let k = unitGridStart[b], end = unitGridStart[b + 1]; k < end; k++) {
      const j = unitGridItems[k];
      if (separationCellX[j] === cx && separationCellZ[j] === cz) out.push(j);
    }
  }
  return out;
}
const obstacleGrid = new Map(), obstacleGridPool = [];
const obstacleQueryIndexes = [], obstacleQuerySeen = new Set();
const obstacleQueryCache = new Map();
const obstacleOrder = new Map(), compareObstacleIndexes = (a, b) => a - b;
let obstacleGridWorld = null, obstacleGridSource = null, obstacleGridLength = -1, obstacleGridMargin = -1;

function recycleGrid(grid, pool) {
  for (const bucket of grid.values()) { bucket.length = 0; pool.push(bucket); }
  grid.clear();
}

function addToGrid(grid, pool, x, z, value) {
  const key = gridCellKey(x, z);
  let bucket = grid.get(key);
  if (!bucket) { bucket = pool.pop() || []; grid.set(key, bucket); }
  bucket.push(value);
}

function indexObstacles(margin) {
  if (obstacleGridWorld === world && obstacleGridSource === world.obstacles
      && obstacleGridLength === world.obstacles.length && obstacleGridMargin >= margin) return;
  obstacleQueryCache.clear();
  recycleGrid(obstacleGrid, obstacleGridPool);
  obstacleOrder.clear();
  obstacleGridWorld = world;
  obstacleGridSource = world.obstacles;
  obstacleGridLength = world.obstacles.length;
  obstacleGridMargin = margin;
  for (let i = 0; i < world.obstacles.length; i++) {
    const obstacle = world.obstacles[i];
    obstacleOrder.set(obstacle, i);
    const radius = obstacle.r + margin;
    const minX = Math.floor((obstacle.x - radius) / SEPARATION_CELL_SIZE);
    const maxX = Math.floor((obstacle.x + radius) / SEPARATION_CELL_SIZE);
    const minZ = Math.floor((obstacle.z - radius) / SEPARATION_CELL_SIZE);
    const maxZ = Math.floor((obstacle.z + radius) / SEPARATION_CELL_SIZE);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) addToGrid(obstacleGrid, obstacleGridPool, x, z, i);
  }
}

function queryObstacleCandidates(minX, maxX, minZ, maxZ, margin = 0) {
  if (world.obstacles.length <= OBSTACLE_GRID_QUERY_THRESHOLD) return world.obstacles;
  indexObstacles(Math.max(0, margin));
  const minCellX = Math.floor(minX / SEPARATION_CELL_SIZE), maxCellX = Math.floor(maxX / SEPARATION_CELL_SIZE);
  const minCellZ = Math.floor(minZ / SEPARATION_CELL_SIZE), maxCellZ = Math.floor(maxZ / SEPARATION_CELL_SIZE);
  const cacheKey = `${minCellX},${maxCellX},${minCellZ},${maxCellZ}`;
  const cached = obstacleQueryCache.get(cacheKey);
  if (cached !== undefined) {
    obstacleQueryCache.delete(cacheKey);
    obstacleQueryCache.set(cacheKey, cached); // LRU: a consulta mais recente fica por último
    return cached;
  }
  obstacleQueryIndexes.length = 0;
  obstacleQuerySeen.clear();
  for (let x = minCellX; x <= maxCellX; x++) for (let z = minCellZ; z <= maxCellZ; z++) {
    const bucket = obstacleGrid.get(gridCellKey(x, z));
    if (!bucket) continue;
    for (const obstacleIndex of bucket) if (!obstacleQuerySeen.has(obstacleIndex)) {
      obstacleQuerySeen.add(obstacleIndex);
      obstacleQueryIndexes.push(obstacleIndex);
    }
  }
  if (obstacleQueryIndexes.length > 1) obstacleQueryIndexes.sort(compareObstacleIndexes);
  // O array fica imutável e nunca volta ao pool de scratch; consumidores podem terminar a iteração sem sobrescrita.
  const candidates = Object.freeze(obstacleQueryIndexes.map((obstacleIndex) => world.obstacles[obstacleIndex]));
  if (obstacleQueryCache.size >= OBSTACLE_QUERY_CACHE_LIMIT) {
    obstacleQueryCache.delete(obstacleQueryCache.keys().next().value);
  }
  obstacleQueryCache.set(cacheKey, candidates);
  return candidates;
}

function separate() {
  separationAlive.length = 0;
  unitGridSize = 0;
  let obstacleMargin = 0, pairCellRange = 1;
  for (const unit of units) if (!unit.dead && !unit.phasing) {
    separationAlive.push(unit);   // fantasmas passam pelo grupo
    obstacleMargin = Math.max(obstacleMargin, 0.53 * unit.size);
  }
  if (!separationAlive.length) return;
  pairCellRange = Math.max(1, Math.ceil(obstacleMargin * 2 / SEPARATION_CELL_SIZE));
  indexObstacles(obstacleMargin);
  // Alternate unit and world collisions: a push off a rock must not create a
  // fresh overlap with a nearby unit, and vice versa. Rebuild the unit grid on
  // every pass because the previous pass may have moved units into new cells.
  for (let pass = 0; pass < 4; pass++) {
    let needsAnotherPass = false;
    buildUnitGrid();
    for (let i = 0; i < separationAlive.length; i++) {
      separationCandidates.length = 0;
      const x = separationCellX[i], z = separationCellZ[i];
      for (let dx = -pairCellRange; dx <= pairCellRange; dx++) for (let dz = -pairCellRange; dz <= pairCellRange; dz++) {
        const cx = x + dx, cz = z + dz, b = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) & (UNIT_GRID_BUCKETS - 1);
        for (let k = unitGridStart[b], end = unitGridStart[b + 1]; k < end; k++) {
          const j = unitGridItems[k];
          if (j > i && separationCellX[j] === cx && separationCellZ[j] === cz) separationCandidates.push(j);
        }
      }
      if (separationCandidates.length > 1) separationCandidates.sort(compareIndexes);
      for (const j of separationCandidates) {
        if (separatePair(separationAlive[i], separationAlive[j], i + 1, j + 1)) needsAnotherPass = true;
      }
    }
    for (let i = 0; i < separationAlive.length; i++) {
      const u = separationAlive[i];
      if (u.structure || u.totem) continue; // objetivos imóveis só afastam unidades móveis
      const candidates = obstacleGrid.get(gridCellKey(
        Math.floor(u.pos.x / SEPARATION_CELL_SIZE),
        Math.floor(u.pos.z / SEPARATION_CELL_SIZE),
      ));
      if (candidates) for (const obstacleIndex of candidates) {
        const o = world.obstacles[obstacleIndex];
        const min = o.r + 0.53 * u.size;
        let dx = u.pos.x - o.x, dz = u.pos.z - o.z;
        if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
        let distance = Math.hypot(dx, dz);
        if (distance >= min) continue;
        needsAnotherPass = true;
        if (distance < 0.001) {
          const oi = obstacleOrder.get(o) ?? 0;
          const angle = ((i + 1) * 0.754877666 + (oi + 1) * 0.569840291) * Math.PI * 2;
          dx = Math.cos(angle); dz = Math.sin(angle); distance = 0;
        } else { dx /= distance; dz /= distance; }
        collisionMove(u, dx * (min - distance), dz * (min - distance));
      }
    }
    for (const u of separationAlive) {
      const groundY = world.groundHeight(u.pos.x, u.pos.z) + (u.hover || 0);
      if (Math.abs(u.pos.y - groundY) > 0.001) needsAnotherPass = true;
      u.pos.y = groundY;
    }
    if (!needsAnotherPass) break;
  }
  resolveEngageSlots();
}

// ---------- vagas em volta do alvo ----------
// Quem luta corpo a corpo reserva uma vaga livre no anel em volta do alvo, em vez de todos andarem para o mesmo
// ponto e a separação ficar empurrando (tremedeira, deslizes). Quem não cabe no anel de contato espera num anel
// de fora e o esqueleto pode trocar por outro alvo com vaga. Os pedidos de um quadro são resolvidos no fim do
// separate() (a grade de unidades já está pronta) e valem no quadro seguinte. Ordem fixa: determinístico.
const ENGAGE_GAP = 0.05;            // anel de contato: dentro do inReach (MELEE_CONTACT_SLACK)
const ENGAGE_WAIT_GAP = 0.3;        // folga do anel de espera para quem já está no contato
const ENGAGE_CLAIM_RANGE = 12;      // mais longe que isso, só anda na direção do alvo
const ENGAGE_MAX_PER_TARGET = 32;   // os demais vão direto (cobre hordas sem custo crescente)
const ENGAGE_WAIT_RINGS = 2;   // anéis de espera atrás do contato
const engageClaims = [], engageAssigned = [], engageBlocks = [], engageReserved = [], engageReservedBy = [];
const compareEngageSort = (a, b) => a.engageSort - b.engageSort;
const engageByTarget = new Map(), engageListPool = [];
let engageGeneration = 0;

// devolve o ponto da vaga (segue o alvo) ou null para ir direto ao alvo
function claimEngageSlot(unit, target) {
  if (unit.engageClaimed !== engageGeneration) {
    unit.engageClaimed = engageGeneration;
    unit.engageClaimTarget = target;
    engageClaims.push(unit);
  }
  const slot = unit.engage;
  if (!slot || slot.target !== target || unit.engageClaimTarget !== target) return null;
  return slot.point.set(target.pos.x + Math.cos(slot.angle) * slot.radius, unit.pos.y,
    target.pos.z + Math.sin(slot.angle) * slot.radius);
}

const angleGap = (a, b) => { const d = a - b, turn = Math.PI * 2; return Math.abs(d - turn * Math.round(d / turn)); };   // sem TAU: trecho também é carregado sozinho pelos testes

// ângulo livre mais perto do desejado num anel de raio r; NaN se o anel está cheio
const engageBand = [];   // blocos que encostam no anel testado: [x, z, folga, raio, ângulo]
function ringPointFree(tx, tz, r, a) {
  const x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r;
  for (let k = 0; k < engageBand.length; k += 5) {
    const dx = x - engageBand[k], dz = z - engageBand[k + 1], c = engageBand[k + 2];
    if (dx * dx + dz * dz < c * c) return false;
  }
  return true;
}

// ângulo livre mais perto do desejado num anel de raio r; NaN se o anel está cheio
function freeRingAngle(unit, tx, tz, r, desired) {
  engageBand.length = 0;
  for (let k = 0; k < engageBlocks.length; k += 4) {
    const c = engageBlocks[k + 3] < 0 ? -engageBlocks[k + 3] + 0.53 * unit.size   // rocha
      : engageBlocks[k + 3] * (unit.size + engageBlocks[k + 2]);
    const bx = engageBlocks[k] - tx, bz = engageBlocks[k + 1] - tz, rj = Math.hypot(bx, bz);
    if (Math.abs(rj - r) >= c) continue;   // não encosta neste anel
    engageBand.push(engageBlocks[k], engageBlocks[k + 1], c, rj, Math.atan2(bz, bx));
  }
  if (ringPointFree(tx, tz, r, desired)) return desired;
  let best = NaN, bestGap = Infinity;
  for (let k = 0; k < engageBand.length; k += 5) {
    const c = engageBand[k + 2], rj = engageBand[k + 3];
    let spread = Math.PI;
    if (rj > 0.001) {
      const cosD = (r * r + rj * rj - c * c) / (2 * r * rj);
      if (cosD > -1) spread = Math.acos(Math.min(1, cosD));
    }
    spread += 0.02;
    for (let side = -1; side <= 1; side += 2) {
      const a = engageBand[k + 4] + side * spread, gap = angleGap(a, desired);
      if (gap < bestGap && ringPointFree(tx, tz, r, a)) { best = a; bestGap = gap; }
    }
  }
  return best;
}

function keptSlotFree(unit, tx, tz, r, angle) {
  const x = tx + Math.cos(angle) * r, z = tz + Math.sin(angle) * r;
  for (let k = 0; k < engageBlocks.length; k += 4) {
    const c = engageBlocks[k + 3] < 0 ? -engageBlocks[k + 3] + 0.53 * unit.size : engageBlocks[k + 3] * (unit.size + engageBlocks[k + 2]);
    const dx = x - engageBlocks[k], dz = z - engageBlocks[k + 1];
    if (dx * dx + dz * dz < c * c) return false;
  }
  return true;
}

function pushEngageBlock(x, z, size, factor) { engageBlocks.push(x, z, size, factor); }

function assignEngageRing(target, list) {
  const tx = target.pos.x, tz = target.pos.z, targetSize = target.size || 1;
  const enemyTeam = target.team === 'skeleton';
  // quem já tinha vaga neste alvo fica com ela; depois, o mais perto escolhe primeiro
  for (const u of list) u.engageSort = (u.engage?.target === target && !u.engage.waiting ? 0 : 1e6)
    + Math.hypot(u.pos.x - tx, u.pos.z - tz);
  list.sort(compareEngageSort);
  engageBlocks.length = 0;
  // vagas já reservadas em volta de outros alvos (anéis vizinhos não se sobrepõem)
  for (let k = 0; k < engageReserved.length; k += 4) {
    if (engageReservedBy[k >> 2] === target) continue;   // onde o próprio alvo vai ficar (duelo: um vai até o outro)
    if (Math.hypot(engageReserved[k] - tx, engageReserved[k + 1] - tz) > 12) continue;
    pushEngageBlock(engageReserved[k], engageReserved[k + 1], engageReserved[k + 2],
      (engageReserved[k + 3] === 1) === enemyTeam ? UNIT_SEPARATION_FACTOR : UNIT_COMBAT_SEPARATION_FACTOR);
  }
  // vizinhos que não pedem vaga neste alvo (quem já está golpeando, aliados do alvo, outros) ocupam onde estão
  const reach = 2 * UNIT_COMBAT_SEPARATION_FACTOR * (targetSize + 2) + 4;
  for (const j of gatherUnitGrid(tx, tz, reach)) {
    {
      const b = separationAlive[j];
      if (b === target || b.engageClaimTarget === target && b.engageClaimed === engageGeneration) continue;
      if (Math.abs(b.pos.y - target.pos.y) >= 0.85 || Math.hypot(b.pos.x - tx, b.pos.z - tz) > reach) continue;
      pushEngageBlock(b.pos.x, b.pos.z, b.size, (b.team === 'skeleton') === enemyTeam ? UNIT_COMBAT_SEPARATION_FACTOR : UNIT_SEPARATION_FACTOR);
    }
  }
  for (const o of queryObstacleCandidates(tx - reach, tx + reach, tz - reach, tz + reach, 1)) {
    if (Math.hypot(o.x - tx, o.z - tz) <= reach + o.r) pushEngageBlock(o.x, o.z, 0, -o.r);
  }
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    const slot = u.engage || (u.engage = { target: null, angle: 0, radius: 0, waiting: false, point: new THREE.Vector3() });
    const contact = UNIT_COMBAT_SEPARATION_FACTOR * (targetSize + u.size) + ENGAGE_GAP;
    const inner = Math.max(contact, Math.min(contact + 1, (u.range || 0) - 0.25));
    const here = Math.atan2(u.pos.z - tz, u.pos.x - tx);
    // sempre o ângulo de onde a unidade está: ângulo guardado no mundo faz dois que se enfrentam orbitarem um ao outro
    const desired = here;
    // quem já tem vaga de contato perto de onde está fica com ela enquanto estiver livre (sem nova busca)
    const keep = slot.target === target && !slot.waiting && slot.radius === inner && angleGap(slot.angle, here) < 0.5
      && keptSlotFree(u, tx, tz, inner, slot.angle);
    let radius = inner, angle = keep ? slot.angle : i < ENGAGE_MAX_PER_TARGET ? freeRingAngle(u, tx, tz, inner, desired) : NaN, waiting = false;
    // anéis de espera, um atrás do outro: ficam parados ali até abrir vaga no contato
    for (let ring = 1; Number.isNaN(angle) && u.team === 'skeleton' && ring <= ENGAGE_WAIT_RINGS && i < ENGAGE_MAX_PER_TARGET; ring++) {
      radius = inner + ring * (UNIT_SEPARATION_FACTOR * 2 * u.size + ENGAGE_WAIT_GAP);
      angle = freeRingAngle(u, tx, tz, radius, here);
      waiting = true;
      target.engageFull = engageGeneration;
    }
    if (Number.isNaN(angle)) { u.engage = null; continue; }
    Object.assign(slot, { target, angle, radius, waiting });
    engageAssigned.push(u);
    engageReserved.push(tx + Math.cos(angle) * radius, tz + Math.sin(angle) * radius, u.size, u.team === 'skeleton' ? 1 : 0);
    engageReservedBy.push(u);
    // a vaga reservada passa a ocupar o anel para os próximos (com a folga entre aliados)
    pushEngageBlock(tx + Math.cos(angle) * radius, tz + Math.sin(angle) * radius, u.size,
      (u.team === 'skeleton') === enemyTeam ? UNIT_SEPARATION_FACTOR : UNIT_COMBAT_SEPARATION_FACTOR);
  }
}

function resolveEngageSlots() {
  // quem não pediu vaga neste quadro (golpeando, parado, morto) solta a que tinha
  for (const u of engageAssigned) if (u.engageClaimed !== engageGeneration || u.dead) u.engage = null;
  engageAssigned.length = 0;
  engageReserved.length = 0;
  engageReservedBy.length = 0;
  for (const list of engageByTarget.values()) { list.length = 0; engageListPool.push(list); }
  engageByTarget.clear();
  for (const u of engageClaims) {
    const target = u.engageClaimTarget;
    if (u.dead || !target || target.dead || u.phasing) { u.engage = null; continue; }
    if (Math.hypot(target.pos.x - u.pos.x, target.pos.z - u.pos.z) > ENGAGE_CLAIM_RANGE) { u.engage = null; continue; }
    let list = engageByTarget.get(target);
    if (!list) { list = engageListPool.pop() || []; engageByTarget.set(target, list); }
    list.push(u);
  }
  for (const [target, list] of engageByTarget) assignEngageRing(target, list);
  engageClaims.length = 0;
  engageGeneration++;
}

// Controle direto opcional no estilo MOBA: o herói escolhido responde ao mouse; a IA cuida do resto do grupo.
const directControl = {
  enabled: false, hero: null, pointerX: null, pointerY: null, commandDownAt: null,
  moveTarget: null, attackTarget: null, moveKeys: new Set(), aimDirection: new THREE.Vector3(),
};
const DIRECT_SKILL_SLOTS = { q: 0, w: 1, e: 2, r: 3 };
const DIRECT_BLOCKED_LEGACY_KEYS = new Set('1234qwerasdfzxvb'.split(''));
const DIRECT_MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const DIRECT_AIM_EFFECTS = new Set(['charge', 'volley', 'execute', 'shadow', 'chain', 'cross-dash', 'arrow-storm', 'volatile', 'hunter-mark', 'wind-palm', 'emp-pulse', 'cavalry-charge', 'pin-spear']);
const DIRECT_GROUND_AIM_EFFECTS = new Set(['arrow-storm', 'volatile']);
const directAimScreen = new THREE.Vector3(), directMoveForward = new THREE.Vector3(), directMoveRight = new THREE.Vector3();
const directMoveVector = new THREE.Vector3(), directMoveDestination = new THREE.Vector3();

function clearDirectControlOrders() {
  directControl.moveTarget = directControl.attackTarget = null;
  directControl.commandDownAt = null;
  directControl.moveKeys.clear();
  if (directControl.hero) {
    directControl.hero.moving = false;
    directControl.hero.vel.set(0, 0, 0);
  }
}

function isDirectControlActive(hero) {
  return directControl.enabled && directControl.hero === hero && !hero.dead
    && !game.paused && !game.over && !pick.open && game.state === 'fight';
}

function syncSkillControlKeys() {
  for (const item of skillItems) {
    if (!item.b) continue;
    const key = directControl.enabled
      ? item.h === directControl.hero ? ['Q', 'W', 'E'][item.slot] : ''
      : item.key;
    if (item.controlKey === key) continue;
    item.controlKey = key;
    if (item.keyEl) { item.keyEl.textContent = key; item.keyEl.hidden = !key; }
    if (key) item.b.setAttribute('data-key', key);
    else item.b.removeAttribute?.('data-key');
    if (item.use) item.use.setAttribute('aria-label', `${item.h.cfg.name}: ${item.skill.name}, ${item.skill.ultimate ? 'ultimate' : item.slot === 0 ? 'assinatura' : 'técnica'}${key ? `. Tecla ${key}.` : '.'}`);
  }
}

function syncDirectControlUI() {
  const toggle = $('directControlToggle'), hint = $('directControlHint');
  if (!toggle || !hint) return;
  const party = heroes(), hero = directControl.hero;
  toggle.hidden = !party.length || game.over;
  toggle.disabled = !directControl.enabled && game.state !== 'fight';
  const selected = hero || panelHero() || party.find((unit) => !unit.dead);
  const label = directControl.enabled
    ? `Devolver ${hero?.cfg.name || 'herói'} à IA (C)`
    : `Assumir ${selected?.cfg.name || 'controle'} (C)`;
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('aria-pressed', String(directControl.enabled));
  toggle.setAttribute('data-tip', `${label} · setas ou botão direito movem · esquerdo ataca · Q/W/E/R habilidades manuais`);
  if (toggle.textContent !== '🎮') toggle.textContent = '🎮';
  hint.classList.toggle('is-hidden', !directControl.enabled);
  const title = $('directControlHero');
  const status = game.paused ? 'Pausado' : game.state !== 'fight' ? 'Aguarde' : hero?.dead ? 'Caído' : hero?.cfg.name;
  if (title) title.textContent = hero ? status : 'Herói';
  syncSkillControlKeys();
}

function setDirectControlMode(on, hero = null, announce = true) {
  if (!on) {
    if (!directControl.enabled) return false;
    if (aiming) cancelAim();
    const oldHero = directControl.hero;
    if (oldHero) { oldHero.moving = false; oldHero.vel.set(0, 0, 0); }
    directControl.enabled = false;
    directControl.hero = null;
    clearDirectControlOrders();
    directControl.aimDirection.set(0, 0, 0);
    directControl.pointerX = directControl.pointerY = null;
    syncDirectControlUI();
    if (announce) showBanner('🎮 IA', 1.5);
    return !!oldHero;
  }
  if (game.over || game.paused || pick.open || game.state !== 'fight') return false;
  const party = heroes();
  const selected = hero && party.includes(hero) ? hero : directControl.hero || panelHero() || party.find((unit) => !unit.dead);
  if (!selected || selected.dead) return false;
  const changed = !directControl.enabled || directControl.hero !== selected;
  if (changed && aiming) cancelAim();
  if (changed) clearDirectControlOrders();
  directControl.enabled = true;
  directControl.hero = selected;
  directControl.commandDownAt = null;
  syncDirectControlUI();
  if (announce && changed) showBanner(`🎮 ${selected.cfg.name}`, 1.5);   // os comandos ficam no tooltip do chip
  return true;
}

function directControlAimSpec(hero, slot = 0) {
  if (!hero) return null;
  if (slot === 0) return aimSpec(hero);
  const skill = skillSetFor(hero.cfg).find((item) => item.slot === slot);
  if (!skill) return null;
  const mode = skill.targeting || (DIRECT_GROUND_AIM_EFFECTS.has(skill.effect) ? 'ground'
    : DIRECT_AIM_EFFECTS.has(skill.effect) ? 'enemy' : null);
  return mode ? { mode, range: skill.range || Math.max(hero.range, 7), min: skill.minRange || 0, radius: skill.radius || 0 } : null;
}

function validDirectControlTarget(hero, target, slot = 0) {
  if (!isDirectControlActive(hero) || !target || target.dead || target.spawning || target.phasing) return false;
  const skill = skillSetFor(hero.cfg).find((item) => item.slot === slot);
  const spec = directControlAimSpec(hero, slot);
  const reach = spec?.range ?? Math.max(hero.range, skill?.range || 0, skill?.radius || 0, slot === 0 ? 7 : 9);
  const distance = hero.pos.distanceTo(target.pos);
  if (target.groundTarget) return spec?.mode === 'ground' && distance <= reach && distance > (spec.min || 0);
  if (target.team !== 'skeleton' || spec?.mode === 'ground') return false;
  return distance > (spec?.min || 0) && distance <= reach + 0.4 * Math.max(0, (target.size || 1) - 1)
    && (hero.ranged || Math.abs(target.pos.y - hero.pos.y) < 1.5);
}

function directControlPointerTarget(hero, slot = 0) {
  if (!hero || directControl.pointerX == null || directControl.pointerY == null) return null;
  const spec = directControlAimSpec(hero, slot);
  if (slot > 0 && !spec) return null;
  const setRayFromPointer = () => {
    aimPointer.set(directControl.pointerX / innerWidth * 2 - 1, -(directControl.pointerY / innerHeight) * 2 + 1);
    aimRay.setFromCamera(aimPointer, camera);
  };
  if (spec?.mode === 'ground') {
    setRayFromPointer();
    if (!findGroundAimHit(aimRay.ray, world.groundHeight, aimGroundHit)) return null;
    aimGroundTarget.pos.copy(aimGroundHit);
    directControl.aimDirection.subVectors(aimGroundTarget.pos, hero.pos).setY(0);
    if (directControl.aimDirection.lengthSq() > 0.001) directControl.aimDirection.normalize();
    return slot === 0 ? validAim(hero, aimGroundTarget) ? aimGroundTarget : null
      : validDirectControlTarget(hero, aimGroundTarget, slot) ? aimGroundTarget : null;
  }
  let best = null, bestDistance = Infinity;
  for (const enemy of units) {
    if (enemy.team !== 'skeleton' || enemy.dead || enemy.spawning || enemy.phasing) continue;
    directAimScreen.copy(enemy.pos);
    directAimScreen.y += enemy.size || 1;
    directAimScreen.project(camera);
    if (directAimScreen.z < -1 || directAimScreen.z > 1) continue;
    const distance = Math.hypot((directAimScreen.x + 1) * innerWidth / 2 - directControl.pointerX,
      (1 - directAimScreen.y) * innerHeight / 2 - directControl.pointerY);
    const radius = Math.max(42, Math.min(110, 42 + (enemy.size || 1) * 5));
    if (distance < radius && distance < bestDistance) { best = enemy; bestDistance = distance; }
  }
  if (best) {
    directControl.aimDirection.subVectors(best.pos, hero.pos).setY(0);
    if (directControl.aimDirection.lengthSq() > 0.001) directControl.aimDirection.normalize();
    if (spec?.mode === 'enemy' && slot === 0 ? validAim(hero, best) : validDirectControlTarget(hero, best, slot)) return best;
    return null;
  }
  if (spec?.mode === 'enemy') return null;
  setRayFromPointer();
  if (findGroundAimHit(aimRay.ray, world.groundHeight, aimGroundHit)) {
    directControl.aimDirection.subVectors(aimGroundHit, hero.pos).setY(0);
    if (directControl.aimDirection.lengthSq() > 0.001) directControl.aimDirection.normalize();
  }
  return null;
}

function directControlEnemyUnderPointer() {
  if (directControl.pointerX == null || directControl.pointerY == null) return null;
  let best = null, bestDistance = Infinity;
  for (const enemy of units) {
    if (enemy.team !== 'skeleton' || enemy.dead || enemy.spawning || enemy.phasing) continue;
    directAimScreen.copy(enemy.pos);
    directAimScreen.y += enemy.size || 1;
    directAimScreen.project(camera);
    if (directAimScreen.z < -1 || directAimScreen.z > 1) continue;
    const distance = Math.hypot((directAimScreen.x + 1) * innerWidth / 2 - directControl.pointerX,
      (1 - directAimScreen.y) * innerHeight / 2 - directControl.pointerY);
    const radius = Math.max(42, Math.min(110, 42 + (enemy.size || 1) * 5));
    if (distance < radius && distance < bestDistance) { best = enemy; bestDistance = distance; }
  }
  return best;
}

function directControlGroundUnderPointer() {
  if (directControl.pointerX == null || directControl.pointerY == null) return null;
  aimPointer.set(directControl.pointerX / innerWidth * 2 - 1, -(directControl.pointerY / innerHeight) * 2 + 1);
  aimRay.setFromCamera(aimPointer, camera);
  if (!findGroundAimHit(aimRay.ray, world.groundHeight, aimGroundHit)) return null;
  return aimGroundHit.clone();
}

function issueDirectAttackCommand(hero, target) {
  if (!isDirectControlActive(hero) || !target || target.team !== 'skeleton'
    || target.dead || target.spawning || target.phasing || !units.includes(target)) return false;
  directControl.attackTarget = target;
  directControl.moveTarget = null;
  directControl.aimDirection.subVectors(target.pos, hero.pos).setY(0);
  if (directControl.aimDirection.lengthSq() > 0.001) directControl.aimDirection.normalize();
  return true;
}

function issueDirectMoveCommand(hero, destination) {
  if (!isDirectControlActive(hero) || !destination) return false;
  directControl.moveTarget = destination.clone();
  directControl.attackTarget = null;
  directControl.aimDirection.subVectors(destination, hero.pos).setY(0);
  if (directControl.aimDirection.lengthSq() > 0.001) directControl.aimDirection.normalize();
  return true;
}

function moveDirectControlled(hero, dt) {
  const vertical = (directControl.moveKeys.has('ArrowUp') ? 1 : 0) - (directControl.moveKeys.has('ArrowDown') ? 1 : 0);
  const horizontal = (directControl.moveKeys.has('ArrowRight') ? 1 : 0) - (directControl.moveKeys.has('ArrowLeft') ? 1 : 0);
  if (vertical || horizontal) {
    directControl.attackTarget = directControl.moveTarget = null;
    directMoveForward.set(0, 0, -1);
    camera.getWorldDirection?.(directMoveForward);
    directMoveForward.y = 0;
    if (directMoveForward.lengthSq() < 0.0001) directMoveForward.set(0, 0, -1);
    directMoveForward.normalize();
    directMoveRight.set(-directMoveForward.z, 0, directMoveForward.x);
    directMoveVector.copy(directMoveForward).multiplyScalar(vertical).addScaledVector(directMoveRight, horizontal);
    if (directMoveVector.lengthSq() > 1) directMoveVector.normalize();
    directControl.aimDirection.copy(directMoveVector);
    directMoveDestination.copy(hero.pos).addScaledVector(directMoveVector, Math.max(2.5, hero.speed * 1.5));
    directMoveDestination.y = world.groundHeight(directMoveDestination.x, directMoveDestination.z);
    hero.moveTo(directMoveDestination, dt);
    return { target: null, moving: true };
  }
  let target = directControl.attackTarget;
  if (target && (target.dead || target.spawning || target.phasing || !units.includes(target))) {
    directControl.attackTarget = target = null;
    directControl.moveTarget = null;
  }
  if (target) {
    const d = target.pos.distanceTo(hero.pos) - 0.4 * ((target.size || 1) - 1);
    if (d > hero.range || (!hero.ranged && Math.abs(target.pos.y - hero.pos.y) >= 0.85)) {
      hero.moveTo(target.pos, dt);
      return { target, moving: true };
    }
    hero.moving = false;
    hero.vel.multiplyScalar(Math.max(0, 1 - dt * 9));
    return { target, moving: false };
  }
  const destination = directControl.moveTarget;
  if (destination && destination.distanceTo(hero.pos) > 0.45) {
    hero.moveTo(destination, dt);
    return { target: null, moving: true };
  }
  directControl.moveTarget = null;
  hero.moving = false;
  hero.vel.multiplyScalar(Math.max(0, 1 - dt * 9));
  return { target: null, moving: false };
}

const directControlToggle = $('directControlToggle');
directControlToggle.onclick = () => {
  const selected = panelHero();
  if (directControl.enabled) setDirectControlMode(false);
  else setDirectControlMode(true, selected);
  audio.play('click');
};
addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  const editing = e.target?.closest?.('input, textarea, select, [contenteditable="true"]');
  if (directControl.enabled && editing && DIRECT_SKILL_SLOTS[key] !== undefined) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (editing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (pick.open || game.over) return;
  if (DIRECT_MOVE_KEYS.has(e.key)) {
    if (!directControl.enabled) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (isDirectControlActive(directControl.hero)) directControl.moveKeys.add(e.key);
    return;
  }
  if (key === 'c') {
    if (e.repeat || (!directControl.enabled && !heroes().length)) return;
    if (!directControl.enabled && game.state !== 'fight') return;
    if (directControl.enabled) setDirectControlMode(false);
    else setDirectControlMode(true);
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (!directControl.enabled) return;
  const slot = DIRECT_SKILL_SLOTS[key];
  if (slot === undefined) {
    if (DIRECT_BLOCKED_LEGACY_KEYS.has(key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.repeat || !isDirectControlActive(directControl.hero)) return;
  const hero = directControl.hero;
  if (hero.skillTimers[slot] > 0) {
    const item = skillItems.find((entry) => entry.h === hero && entry.slot === slot);
    if (item) item.nopeT = performance.now() + 400;
    return;
  }
  const aimed = directControlPointerTarget(hero, slot);
  const skill = skillSetFor(hero.cfg).find((entry) => entry.slot === slot);
  const hasPointer = directControl.pointerX != null && directControl.pointerY != null;
  const requiresAim = !!directControlAimSpec(hero, slot);
  if (hasPointer && requiresAim && !aimed) {
    hero.missSkill();
    const item = skillItems.find((entry) => entry.h === hero && entry.slot === slot);
    if (item) item.nopeT = performance.now() + 400;
    showBanner(`Aponte um alvo válido para ${skill?.name || 'a habilidade'}`, 1.3);
    return;
  }
  const target = aimed?.groundTarget ? { pos: aimed.pos.clone(), dead: false, size: 1, groundTarget: true } : aimed;
  const manual = !!target && (slot > 0 || validAim(hero, target) || validDirectControlTarget(hero, target, slot));
  const result = hero.requestSkill(manual ? target : null, slot, manual);
  if (result !== 'ok') {
    const item = skillItems.find((entry) => entry.h === hero && entry.slot === slot);
    if (item) item.nopeT = performance.now() + 400;
  }
  audio.play('click');
}, true);
addEventListener('keyup', (e) => {
  if (!DIRECT_MOVE_KEYS.has(e.key) || !directControl.moveKeys.has(e.key)) return;
  directControl.moveKeys.delete(e.key);
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);
addEventListener('blur', () => { directControl.commandDownAt = null; directControl.moveKeys.clear(); });
addEventListener('pointermove', (e) => {
  directControl.pointerX = e.clientX;
  directControl.pointerY = e.clientY;
});

// ---------- fases ----------
// state: 'fight' (onda) -> 'cleared' (comemoração + escolha de herói) -> 'advance' (sobe a estrada) -> 'fight'
const game = { phase: 1, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0, guideS: 0, over: false, paused: false };

const SKELETON_SPAWN_MIN_HERO_DISTANCE = 14.25;
function skeletonSpawnSize(type, boss = false) {
  return SKELETONS[type]?.size || (boss ? 1.7 : 1);
}
function isSafeSkeletonSpawn(point, { size = 1, zone = null, minHeroDistance = SKELETON_SPAWN_MIN_HERO_DISTANCE } = {}) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
  const clearance = Math.max(0.8, size * 0.55);
  if (!world.isInsideGround(point.x, point.z, clearance) || !world.canStep(point, point)) return false;
  const ground = world.groundHeight(point.x, point.z);
  if (!Number.isFinite(ground)) return false;
  if (zone?.type === 'castle') {
    const dx = point.x - zone.center.x, dz = point.z - zone.center.z;
    const lateral = dx * zone.side.x + dz * zone.side.z;
    const forward = dx * zone.fwd.x + dz * zone.fwd.z;
    // As colunas e a decoração do salão não entram no índice de obstáculos.
    // O corredor central conservador mantém unidades fora delas.
    if (Math.abs(lateral) > 9 - clearance || Math.abs(forward) > 17 - clearance) return false;
  }
  const obstacles = queryObstacleCandidates(point.x - clearance, point.x + clearance, point.z - clearance, point.z + clearance, clearance);
  if (obstacles.some((obstacle) => Math.hypot(obstacle.x - point.x, obstacle.z - point.z) < obstacle.r + clearance)) return false;
  for (const hero of heroes()) {
    if (!hero.dead && Math.hypot(hero.pos.x - point.x, hero.pos.z - point.z) < minHeroDistance) return false;
  }
  for (const unit of units) if (unit.team === 'skeleton' && !unit.dead) {
    if (Math.hypot(unit.pos.x - point.x, unit.pos.z - point.z) < Math.max(2.2, (size + (unit.size || 1)) * 0.85)) return false;
  }
  return true;
}
function isSafeSkeletonSummonPoint(point, type = 'Minion') {
  if (game.over) return false;
  return isSafeSkeletonSpawn(point, { size: skeletonSpawnSize(type), zone: world.zoneOf(game.phase) });
}
function findSafeSkeletonSummonPoint(center, type = 'Minion', reserved = []) {
  if (game.over || !center) return null;
  const size = skeletonSpawnSize(type), zone = world.zoneOf(game.phase);
  const accepts = (point) => {
    point.y = world.groundHeight(point.x, point.z);
    return isSafeSkeletonSpawn(point, { size, zone })
      && reserved.every((other) => Math.hypot(point.x - other.x, point.z - other.z) >= Math.max(3.2, size + 1.4));
  };
  if (accepts(center.clone())) return center.clone().setY(world.groundHeight(center.x, center.z));
  for (let radius = 1.5; radius <= 25; radius += 1.25) {
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const point = center.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      if (accepts(point)) return point;
    }
  }
  return null;
}
function skeletonFormationIsSafe(points, types, bossFlags, zone = null, minHeroDistance = SKELETON_SPAWN_MIN_HERO_DISTANCE) {
  const sizes = types.map((type, i) => skeletonSpawnSize(type, bossFlags[i]));
  for (let i = 0; i < points.length; i++) {
    points[i].y = world.groundHeight(points[i].x, points[i].z);
    if (!isSafeSkeletonSpawn(points[i], { size: sizes[i], zone, minHeroDistance })) return false;
    for (let j = 0; j < i; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z) < Math.max(2.8, (sizes[i] + sizes[j]) * 0.85)) return false;
    }
  }
  return true;
}
function findSafeSkeletonRouteSpawn(s0, { type = 'Minion', boss = false, preferredSign = 1, zone = null, preferredPoints = [] } = {}) {
  const size = skeletonSpawnSize(type, boss);
  const accept = (point) => {
    point.y = world.groundHeight(point.x, point.z);
    return isSafeSkeletonSpawn(point, { size, zone });
  };
  for (const point of preferredPoints) if (accept(point)) return point.clone();
  const lateralOffsets = [0, -2, 2, -4, 4, -6, 6, -8, 8];
  for (let distance = 14.5; distance <= 32; distance += 1.5) {
    for (const sign of [preferredSign, -preferredSign]) {
      const s = s0 + sign * distance;
      if (s < 0 || s > world.L) continue;
      for (const lateral of lateralOffsets) {
        const point = world.along(s, lateral);
        if (accept(point)) return point;
      }
    }
  }
  return null;
}
function findTwinBossFormation(s0, preferredSign, firstType) {
  const types = [firstType, 'Executioner'], bossFlags = [true, true];
  const zone = world.zoneOf(game.phase);
  for (let distance = 14.5; distance <= 32; distance += 1.5) {
    for (const sign of [preferredSign, -preferredSign]) {
      const s = s0 + sign * distance;
      if (s < 0 || s > world.L) continue;
      const forward = world.tangentAt(s), side = world.sideOf(forward);
      for (const lateral of [0, -2, 2, -4, 4]) {
        const center = world.along(s, lateral);
        for (const axis of [side, forward]) {
          const points = [center.clone().addScaledVector(axis, -2.5), center.clone().addScaledVector(axis, 2.5)];
          if (skeletonFormationIsSafe(points, types, bossFlags, zone)) return points;
        }
      }
    }
  }
  return null;
}
function findCastleBossFormation() {
  const zone = world.zoneOf(game.phase);
  if (zone?.type !== 'castle') return null;
  const types = ['Lich', 'Executioner', 'DarkKnight'], bossFlags = [true, true, true];
  let best = null, bestScore = -Infinity;
  for (const lateral of [-2, 0, 2]) for (const forward of [-15.5, -12, -8, -4, 0, 4, 8, 12, 15.5]) {
    const center = zone.center.clone().addScaledVector(zone.side, lateral).addScaledVector(zone.fwd, forward);
    const points = [-5, 0, 5].map((offset) => center.clone().addScaledVector(zone.side, offset));
    // O salão comporta os chefes nas extremidades; 14 m de cada herói é impossível
    // dentro da arena e fazia a única entrada da missão falhar para sempre.
    if (!skeletonFormationIsSafe(points, types, bossFlags, zone, 8.5)) continue;
    const minHeroDistance = Math.min(...points.flatMap((point) => heroes().filter((hero) => !hero.dead)
      .map((hero) => Math.hypot(hero.pos.x - point.x, hero.pos.z - point.z))));
    const score = minHeroDistance - (Math.abs(lateral) + Math.abs(forward - 16.2)) * 0.015;
    if (score > bestScore) { best = points; bestScore = score; }
  }
  return best;
}
function findRescueGuardFormation(captive) {
  let captiveS = game.guideS + 14, closest = Infinity;
  for (let s = game.guideS + 14; s <= game.guideS + 20 && s <= world.L; s += 0.25) {
    const point = world.along(s, -1.5), distance = Math.hypot(point.x - captive.pos.x, point.z - captive.pos.z);
    if (distance < closest) { closest = distance; captiveS = s; }
  }
  const lateralOffsets = [-1.5, -0.5, -2.5, 0.5, -3.5, 1.5, -4.5, 2.5, -5.5, 3.5];
  for (const advance of [2.3, 3, 4, 5.5, -2.3, -3, -4, -5.5]) {
    const s = captiveS + advance;
    if (s < 0 || s > world.L) continue;
    const forward = world.tangentAt(s), side = world.sideOf(forward);
    const axes = [side, forward, side.clone().add(forward).normalize(), side.clone().sub(forward).normalize()];
    for (const centerLateral of lateralOffsets) {
      const center = world.along(s, centerLateral);
      for (const axis of axes) {
        const points = [center.clone().addScaledVector(axis, -1.8), center.clone().addScaledVector(axis, 1.8)];
        if (points.every((point) => Math.hypot(point.x - captive.pos.x, point.z - captive.pos.z) <= RESCUE_CLEAR_RADIUS
          && world.canStep(captive.pos, point)) && skeletonFormationIsSafe(points, ['Warrior', 'Minion'], [false, false])) return points;
      }
    }
  }
  return null;
}
function spawnRescueGuards(captive) {
  const points = findRescueGuardFormation(captive);
  if (!points) {
    game.rescueGuardRetries++;
    game.rescueSpawnTimer = 0.8;
    if (game.rescueGuardRetries >= 12) {
      game.rescueGuardsPending = 0;
      showBanner('O prisioneiro está sem guardas!', 2.5);
    }
    return false;
  }
  for (const [i, type] of ['Warrior', 'Minion'].entries()) {
    const guard = new Skeleton(type, game.phase);
    guard.pos.copy(points[i]);
    guard.root.rotation.y = Math.atan2(captive.pos.x - guard.pos.x, captive.pos.z - guard.pos.z);
  }
  game.rescueGuardsPending = 0;
  game.rescueSpawnTimer = 0;
  return true;
}
function findTotemSummonPoint(totem, type) {
  const base = totem.pos;
  for (let radius = 2.5; radius <= 20; radius += 1.5) for (let step = 0; step < 20; step++) {
    const angle = step * Math.PI * 2 / 20;
    const point = new THREE.Vector3(base.x + Math.cos(angle) * radius, 0, base.z + Math.sin(angle) * radius);
    point.y = world.groundHeight(point.x, point.z);
    if (isSafeSkeletonSpawn(point, { size: skeletonSpawnSize(type), zone: world.zoneOf(game.phase) })) return point;
  }
  return null;
}

// view: 'menu' (tela inicial), 'map' (mapa da campanha), uma missão (vai à dificuldade),
// ou { replay, team, seed } (repete a missão)
function startGame(view = 'menu') {
  setDirectControlMode(false, null, false);
  battleGateId++;
  battleLoadingVisible = false;
  document.body.classList.add('no-battle');   // menu e mapa sem o HUD da batalha por trás
  if (aiming) cancelAim();
  setUserPause(false);
  clearTimeout(pick.timer);
  clearTimeout(showBanner.t);
  $('banner').style.opacity = 0;
  pick.open = false;
  evolutions.length = 0;
  pick.evoDone = [];
  pick.evoThen = null;
  pick.leaving = [];
  pick.upgrades = [];
  while (enemyBolts.length) scene.remove(enemyBolts.pop().mesh);
  for (const list of [bolts, blasts, flames]) while (list.length) {
    const effect = list.pop();
    if (list === blasts) releaseBlast(effect);
    else if (list === flames) releaseFlameMesh(effect.mesh);
    else {
      scene.remove(effect.mesh);
    }
  }
  while (sentries.length) removeSentry(sentries[0]);
  while (spiritTotems.length) removeSpiritTotem(spiritTotems[0]);
  followSpirits.length = 0;
  clearFx();
  FX.clear();
  flushGroundMarkReturns();
  audio.stopMusic();
  popTextPool.clear();
  closeHeroPanel();
  $('overlayStats').innerHTML = '';
  $('overlayStars').innerHTML = '';
  $('overlayNext').innerHTML = '';
  $('overlayTitle').textContent = '';
  $('overlayBtn').hidden = true;
  $('overlayBtn').textContent = 'Jogar de novo';
  $('overlayBtn').onclick = () => startGame(game.mission ? 'map' : 'menu');
  while (units.length) units[0].remove();
  game.mission = null;
  campaignTeamRun = !!view?.teamRun;   // "Repetir" mantém a equipe contínua
  clearMonsterFx();   // avisos, covas e barra do chefe
  if (game.arena) arenaCleanup();   // botões e barras do modo Teste
  // ?fase=N na URL começa direto na fase N (atalho para testar o cenário)
  placeParty(THREE.MathUtils.clamp(+new URLSearchParams(location.search).get('fase') || 1, 1, PHASES));
  $('overlay').classList.remove('results', 'lost', 'won', 'test-run');
  $('overlay').classList.add('hidden');
  if (view === 'map') showCampaign();
  else if (view?.replay) replayMission(view);   // "Repetir": mesma missão, dificuldade e equipe
  else if (view?.goal) showCampaign(view, true);   // "Próxima missão": mesma dificuldade, direto para a equipe
  else if (view?.arena) startArenaRun(view.arena);   // modo Teste: reinicia com a mesma equipe
  else showMenu();   // modo -> (mapa) -> dificuldade -> escolha do herói
  syncDirectControlUI();
}

// põe o grupo (e a câmera) na fase inicial e zera a partida; game.mission continua
function placeParty(first) {
  const m = game.mission;
  const search = new URLSearchParams(location.search);
  Object.assign(game, { phase: first, start: first, last: m ? m.to : PHASES, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0,
    guideS: world.anchorS(first), over: false, picksLeft: 0, falls: 0, fallLog: [], roster: [], damageSources: {}, relics: [], runTime: 0, missionT: 0, surviveT: m?.goal.time || 0, totemsPlaced: 0, totemsDown: 0, towersDown: 0, rescueComplete: false, rescueT: 0, rescueRunner: null, objectiveCall: 0, bossSeen: false, bossDown: false, villager: null, militia: null,
    shrine: null, huntMark: null, huntSpawnTimer: 0, huntDown: false, huntEscaped: false, endlessT: 0, endlessStars: 0, gate: null, leaks: 0, eliteWave: 0, eliteSize: 0, refilling: false,
    rescueGuardsPending: 0, rescueGuardRetries: 0, rescueSpawnTimer: 0,
    test: search.has('fase') || search.get('tudo') === '1', arena: null, missionHpRatio: null, missionVillagerRatio: null, ultimates: 0, twinFocus: null, partyScale: null, startLevels: null, resultExtras: '' });
  game.rerolls = game.test ? 0 : progress.rerolls();
  if (game.test) setTimeout(() => showBanner('Modo de teste · não salva', 3), 600);   // ?fase= ou ?tudo=1 na URL
  renderRelicTray();
  aimCamera(game.guideS);
  $('goal').classList.toggle('hidden', !m);
  if (m) {
    $('goal').setAttribute('data-icon', GOAL_ICONS[m.goal.type] || '⚑');
    setGoalUI(goalText(m.goal), 0);
  }
  $('goal').classList.remove('warn', 'done');
}

// câmera no ponto s da estrada (também usada antes da fase, para o aquecimento desenhar o lugar certo)
function aimCamera(s) {
  const start = world.pointAt(s);
  follow.set(start.x, 0, start.z - 3);
  controls.target.copy(follow);
  camera.position.set(follow.x, 27.6, follow.z + 25.2);   // mesmo ângulo, 20% mais longe: mais campo de visão
}

// grupo inicial escolhido: começa a missão (o aldeão entra junto na escolta)
function startMission() {
  const begin = () => {
    const m = game.mission;
    if (!m) return;
    if (m.goal.type === 'escort') game.villager = new Villager();
    if (m.goal.type === 'rescue') game.villager = new Villager(true);
    if (m.goal.type === 'defend') game.shrine = new Shrine(world.along(world.anchorS(m.from) - 5, 0));
    if (m.goal.type === 'breach') game.gate = new Gate(world.along(world.anchorS(m.from) - GATE_BACK, 0));
    if (m.goal.type === 'duel') for (const h of heroes()) h.maxHp = h.hp = Math.round(h.maxHp * m.goal.heroHp);   // o campeão do duelo aguenta por dois
    for (const h of heroes()) { h.pos.copy(h.post); h.vel.set(0, 0, 0); }   // a seleção rearranja os postos; começa já alinhado para não travar na montagem da formação
    game.startLevels = Object.fromEntries(heroes().map((h) => [h.cfg.id, { level: h.level, xp: h.xp }]));   // a tela de resultado compara para animar quem subiu de nível
    musterMilitia();
    document.body.classList.remove('no-battle');   // o HUD da batalha só aparece agora
    game.paused = false;
  };
  if (typeof withBattleAssets === 'function') return withBattleAssets(begin);
  begin();
}

// Equipe contínua: cada missão foi calibrada para m.heroes heróis no nível m.level, com um aliado
// a mais a cada fase vencida (até 4). Um grupo maior que esse, ou mais evoluído que m.level,
// engrossa a onda e a vida dos inimigos daquela fase, de forma suave e com teto.
const PARTY_SCALE = { count: 0.6, countMax: 1.6, hp: 0.45, hpMax: 1.6, level: 0.08, levelMax: 1.15, cap: 1.4 };
function partyScale(m, party, phase) {
  // o Duelo é sempre um herói só; na ponte em chamas grupo maior não deixa a defesa mais fácil (mais corpos não interceptam melhor)
  if (!m || m.goal.type === 'duel' || m.goal.type === 'breach' || !party.length) return { count: 1, hp: 1 };
  const planned = Math.min(MAX_PARTY, m.heroes + Math.max(0, phase - m.from));
  const extra = Math.max(0, party.length - planned) / planned;
  const level = party.reduce((sum, h) => sum + h.level, 0) / party.length - m.level;
  const P = PARTY_SCALE;
  return {
    count: Math.min(P.countMax, 1 + P.count * extra),
    hp: Math.min(P.hpMax, 1 + P.hp * extra) * THREE.MathUtils.clamp(1 + P.level * level, 1, P.levelMax),
  };
}
const partyCount = () => game.partyScale?.count || 1;
// teto de inimigos ativos das ondas contínuas (santuário, sobrevivência), um pouco mais alto para grupos maiores
const partyCap = (cap) => Math.round(cap * Math.min(PARTY_SCALE.cap, partyCount()));

function startPhase() {
  if (game.mission) game.partyScale = partyScale(game.mission, heroes(), game.phase);
  game.state = 'fight';
  game.phaseAt = game.runTime;   // Decreto de Marcha: a IA usa no começo da onda
  for (const h of heroes()) passiveHook(h, 'onPhaseStart');
  syncDirectControlUI();
  if (game.arena) {   // modo Teste: primeira onda; as seguintes vêm de arenaTick
    for (const h of heroes()) h.kiteT = 0;
    game.toSpawn = Math.round(4 * difficulty.count);
    game.bossPending = false;
    game.refilling = true;   // sem líder de onda (golem/chefe): o chefe só entra quando chamado
    game.spawnTimer = 0.5;
    return showBanner('Arena!', 2);
  }
  tutorial.on('battleStart');
  for (const h of heroes()) h.kiteT = 0;   // recuo da fase anterior não continua
  game.toSpawn = Math.round((2 + game.phase * 2) * difficulty.count * partyCount());
  const goal = game.mission?.goal;
  game.bossPending = missionBossPhase(game.phase, game.mission?.boss)
    && (!game.mission?.boss?.afterTotems || goal?.type === 'totems' && game.totemsDown >= goal.count);   // missões podem adiar o chefe até concluir um objetivo
  game.spawnTimer = 0.5;
  const waveScale = ['duel', 'rescue', 'totems', 'tower', 'boss', 'hunt', 'nofall', 'timer'].includes(goal?.type)
    ? goal.waves : (goal?.type === 'elite' || goal?.type === 'twin' || goal?.type === 'bosses') ? goal.scale : 0;   // a escala reduz apenas a onda comum; chefes e guardas permanecem garantidos
  if (goal?.type === 'bosses') game.toSpawn = 1;   // na câmara final, a primeira e única entrada já é o trio de chefes
  else if (goal?.type === 'endless') game.toSpawn = Math.min(4, Math.max(3, Math.round(3 * difficulty.count)));   // a horda escala com o relógio, não começa com a onda enorme da fase 10
  else if (waveScale) game.toSpawn = Math.max(3, Math.round(game.toSpawn * waveScale));
  if (goal?.type === 'elite') { game.eliteWave = 1; game.eliteSize = game.toSpawn; }
  if (goal?.type === 'totems') {   // espalha o que falta dos totens pelas fases que restam
    const n = Math.ceil((goal.count - game.totemsPlaced) / (game.last - game.phase + 1));
    for (let k = 0; k < n; k++) placeTotem(k);
  }
  if (goal?.type === 'tower' && game.totemsPlaced < goal.count) {
    for (let k = 0; k < goal.count - game.totemsPlaced; k++) placeTotem(k, true);
  }
  const captive = goal?.type === 'rescue' && game.phase === game.start ? captivePrisoner() : null;
  if (captive) {
    game.rescueGuardsPending = 2;
    game.rescueGuardRetries = 0;
    spawnRescueGuards(captive);
  }
  if (goal?.type === 'hunt' && !game.huntMark) spawnHuntMark();
  relicPhaseStart();
  const text = goal?.type === 'survive' && game.phase === goal.phase ? `Aguente ${goal.time} s!`
    : goal?.type === 'defend' ? `Defenda ${goal.time} s!`
      : goal?.type === 'hunt' ? 'Abata o alvo!'
        : goal?.type === 'endless' ? 'Horda!'
          : goal?.type === 'breach' ? 'Segure a ponte!'
            : goal?.type === 'duel' ? '1 contra 1!'
              : goal?.type === 'elite' ? `Elite 1/${goal.waves}`
                : goal?.type === 'twin' ? 'Dois chefes!'
                  : goal?.type === 'bosses' ? 'Três chefes!'
                  : game.bossPending ? 'Chefe!' : `Fase ${game.phase}`;
  // faixa curta; na primeira fase da missão leva só o nome dela (a história fica no mapa)
  if (!game.mission || game.phase !== game.start) return showBanner(text);
  showBanner(`${game.mission.name} · ${text}`, 3);
}

// ---------- campanha: aldeão, totens e objetivos ----------
const RESCUE_RADIUS = 2.4, RESCUE_TIME = 2.5, RESCUE_CLEAR_RADIUS = 8;   // um herói liberta após limpar a área próxima
// a separação segura heróis grandes (brutamontes, 1,86) a 0,86 × soma dos tamanhos: sem isto o raio fixo nunca fecha e o resgate trava
const rescueReach = (hero, captive) => Math.max(RESCUE_RADIUS, UNIT_SEPARATION_FACTOR * (hero.size + (captive.size || 1)) + 0.15);
const captivePrisoner = () => game.mission?.goal.type === 'rescue' && game.villager && !game.villager.dead && !game.villager.rescued ? game.villager : null;
const rescueAreaThreatened = (captive, enemies) => !!captive
  && enemies.some((enemy) => !enemy.dead && tacticalDistance(enemy.pos, captive.pos) <= RESCUE_CLEAR_RADIUS);
function rescueRunnerFor(captive, party = heroes()) {
  if (!captive) { game.rescueRunner = null; return null; }
  if (game.rescueRunner && !game.rescueRunner.dead && party.includes(game.rescueRunner)) return game.rescueRunner;
  let runner = null, nearest = Infinity;
  for (const hero of party) if (!hero.dead) {
    const distance = tacticalDistance(hero.pos, captive.pos);
    if (distance < nearest) { nearest = distance; runner = hero; }
  }
  game.rescueRunner = runner;
  return runner;
}
// aldeão da escolta: o bárbaro sem armas (só a caneca), recolorido; segue atrás do grupo e os esqueletos o atacam
const VILLAGER_GAP = 2.3;   // do posto de trás do grupo até o aldeão
const VILLAGER_FLEE = 7, RESCUE_EXIT_TIME = 4;   // o resgatado recua de inimigos a menos de 7 m e sai de cena 4 s após a libertação
class Villager extends Unit {
  constructor(captive = false) {
    super(assets.Barbarian, { hp: Math.round(240 / difficulty.dmg), dmg: 0, range: 0, speed: 3, cooldown: 1 }, 'villager');
    const tint = new THREE.Color(0xd8b07a);
    this.root.traverse((o) => { if (HEROES[1].weapons.includes(o.name) && o.name !== 'Mug') o.visible = false; });
    for (const m of this.mats) m.color?.lerp(tint, 0.45);
    this.bar.classList.add('ally');
    const label = document.createElement('span');
    label.textContent = captive ? 'Prisioneiro' : 'Aldeão';
    this.bar.appendChild(label);
    this.nameTag = label;
    this.captive = captive;
    this.rescued = !captive;
    this.post = new THREE.Vector3();
    if (captive) {   // atrás da primeira onda, longe do grupo
      for (let tries = 0; tries < 12; tries++) {
        this.pos.copy(world.along(game.guideS + 14 + tries * 0.5, -1.5));
        if (!world.obstacles.some((o) => Math.hypot(o.x - this.pos.x, o.z - this.pos.z) < o.r + 1)) break;
      }
      this.pos.y = world.groundHeight(this.pos.x, this.pos.z);
      this.post.copy(this.pos);
    } else {
      this.follow();
      this.pos.copy(this.post);
    }
    this.popT = 0;
    this.loop('Idle');
  }

  follow() {
    const fwd = world.tangentAt(game.guideS);
    // atrás do posto de trás do grupo, com folga para o herói de lá e para o anel da milícia em volta
    this.post.copy(world.pointAt(game.guideS)).addScaledVector(fwd, -(POSTS[3][1] * formationSpread() + VILLAGER_GAP));
    return fwd;
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    if (this.dead || game.over || this.busy > 0) return;
    if (this.captive && !this.rescued) { this.vel.set(0, 0, 0); this.loop('Idle'); return; }
    const fwd = this.follow();
    if (this.captive) {   // resgatado: foge de inimigos próximos (para trás do grupo) e, passados alguns segundos, sai de cena
      if (this.exitT > 0 && (this.exitT -= dt) <= 0) {
        popText(this.pos, 'Obrigado!', 'heal');
        this.left = this.untargetable = true;
        this.root.visible = false;
        this.bar.style.display = 'none';
        return;
      }
      const threat = nearest(this.pos, skeletonsAlive().filter((s) => !s.dead && !s.spawning));
      if (threat && tacticalDistance(threat.pos, this.pos) < VILLAGER_FLEE) {
        tmp.copy(this.pos).sub(threat.pos).setY(0);
        if (tmp.dot(fwd) > 0) tmp.addScaledVector(fwd, -tmp.dot(fwd));   // nunca para a frente: só de lado
        if (tmp.lengthSq() < 0.04) {   // inimigo colado por trás: vai para o herói mais perto
          const guard = nearest(this.pos, heroes().filter((h) => !h.dead));
          tmp.copy(guard ? guard.pos : this.pos).sub(this.pos).setY(0);
        }
        const spot = tmp.normalize().multiplyScalar(3).add(this.pos);
        if (world.canStep(this.pos, spot)) { this.moveTo(spot, dt); this.locomote('Running_A', 'Walking_A', 'Idle'); return; }
      }
    }
    if (this.pos.distanceTo(this.post) > 0.3) this.moveTo(this.post, dt);
    else this.face(tmp.copy(this.post).addScaledVector(fwd, 10), dt);
    this.locomote('Running_A', 'Walking_A', 'Idle');
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.pendingHit = null;
    this.once('Death_A');
    this.bar.style.display = 'none';
  }
}

// milícia: aldeões armados pequenos (o bárbaro sem as armas dele, em azul) que guardam quem a missão manda defender
// (o aldeão da escolta, o santuário). Ficam num anel em volta do protegido e só brigam com quem chega perto dele.
// Fracos de propósito, sem XP nem evolução; quem cai não volta na partida e não conta como queda de herói.
const MILITIA_REACH = 4;        // quão perto do protegido o inimigo precisa estar para a guarda atacar
const MILITIA_RING = 2.3;       // raio do anel de guarda (fora da separação do protegido e dos vizinhos)
const MILITIA_ARC = Math.PI * 1.5;   // o anel cobre as costas e os lados; a frente fica para os heróis
const MILITIA_WEAPONS = ['forcado', 'tocha', 'machadinha', 'clava'];
const MILITIA_TINTS = [0x7fb6e8, 0x6aa3d8, 0x8cc4f0, 0x5e93c8];   // azuis claros: ajudantes, não heróis
let militiaParts = null;
function militiaWeapon(kind) {
  militiaParts ||= { wood: new THREE.MeshLambertMaterial({ color: 0x7a5230 }), iron: new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xffa23a }), pole: new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6),
    haft: new THREE.CylinderGeometry(0.04, 0.045, 0.7, 6), tine: new THREE.CylinderGeometry(0.018, 0.018, 0.3, 4),
    bar: new THREE.BoxGeometry(0.28, 0.04, 0.04), blade: new THREE.BoxGeometry(0.05, 0.2, 0.24),
    knob: new THREE.CylinderGeometry(0.1, 0.06, 0.3, 6), flame: new THREE.ConeGeometry(0.1, 0.28, 6) };
  const P = militiaParts, g = new THREE.Group();
  const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (kind === 'forcado') {   // cabo comprido, travessa e três dentes
    part(P.pole, P.wood, 0, 0.45, 0);
    part(P.bar, P.iron, 0, 1.2, 0);
    for (const x of [-0.12, 0, 0.12]) part(P.tine, P.iron, x, 1.36, 0);
  } else {
    part(P.haft, P.wood, 0, 0.2, 0);
    if (kind === 'tocha') part(P.flame, P.fire, 0, 0.66, 0);
    else if (kind === 'machadinha') part(P.blade, P.iron, 0, 0.46, 0.13);
    else part(P.knob, P.wood, 0, 0.6, 0);
  }
  return g;
}

class Militia extends Unit {
  constructor(slot) {
    super(assets.Barbarian, { hp: 50, dmg: 4, range: 1.5, speed: 3.1, cooldown: 1.3 }, 'ally');
    this.militia = true;
    this.slot = slot;
    this.cfg = { id: 'militia' };
    this.level = 1;
    this.size = 0.7;
    this.weapon = MILITIA_WEAPONS[slot % MILITIA_WEAPONS.length];
    this.attackAnim = this.weapon === 'forcado' ? '2H_Melee_Attack_Stab' : '1H_Melee_Attack_Chop';
    if (this.weapon === 'forcado') this.range = 1.9;
    const tint = new THREE.Color(MILITIA_TINTS[slot % MILITIA_TINTS.length]);
    this.root.traverse((o) => { if (HEROES[1].weapons.includes(o.name)) o.visible = false; });
    for (const m of this.mats) m.color?.lerp(tint, 0.7);
    this.root.getObjectByName('handslotr')?.add(militiaWeapon(this.weapon));
    this.bar.classList.add('ally', 'militia');
    this.post = new THREE.Vector3();
    this.follow();
    this.pos.copy(this.post);
    this.popT = 0;
    this.deadTime = 0;
    this.loop('Idle');
  }

  // posto no anel em volta do protegido, no sentido da estrada: vagas espalhadas pelas costas e lados, longe
  // do posto de trás dos heróis (que fica à frente do protegido). Sem protegido, fica onde está.
  follow() {
    const ward = guardedObjective();
    if (!ward) return this.post.copy(this.pos);
    const n = Math.max(1, game.militia?.size || 1);
    const a = -MILITIA_ARC / 2 + MILITIA_ARC * (this.slot % n + 0.5) / n;   // 0 = bem atrás do protegido
    const r = Math.max(MILITIA_RING, UNIT_SEPARATION_FACTOR * ((ward.size || 1) + this.size) + 0.45);
    const fwd = world.tangentAt(game.guideS), side = world.sideOf(fwd);
    const back = -Math.cos(a) * r, lateral = Math.sin(a) * r;
    return this.post.set(ward.pos.x + fwd.x * back + side.x * lateral, ward.pos.y, ward.pos.z + fwd.z * back + side.z * lateral);
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    if (this.dead) { if ((this.deadTime += dt) > 2.5) this.remove(); return; }
    if (game.over || this.busy > 0) return;
    this.follow();
    const ward = guardedObjective();
    const foes = activeTargetContext?.attackableSkeletons ?? skeletonsAlive().filter((s) => !s.spawning);
    const target = ward && game.state === 'fight' ? nearest(ward.pos, foes) : null;
    if (target && tacticalDistance(target.pos, ward.pos) <= MILITIA_REACH) {
      if (!this.inReach(target, target.pos.distanceTo(this.pos))) this.moveTo(target.pos, dt);
      else if (this.face(target.pos, dt) < 0.5 && this.attackTimer <= 0) this.attack(target, this.attackAnim);
    } else if (this.pos.distanceTo(this.post) > 0.3) this.moveTo(this.post, dt);
    else if (ward) this.face(tmp.copy(this.post).multiplyScalar(2).sub(ward.pos), dt);   // de costas para o protegido
    if (this.busy <= 0) this.locomote('Running_A', 'Walking_A', 'Idle');
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.pendingHit = null;
    this.deadTime = 0;
    this.once('Death_A');
    this.bar.style.display = 'none';
    if (game.militia) game.militia.fallen++;
  }
}

const militiaAlive = () => units.reduce((n, u) => n + (u.militia && !u.dead ? 1 : 0), 0);

// quem a guarda protege: o aldeão da escolta ou o santuário
function guardedObjective() {
  const v = game.villager;
  if (v && !v.dead && !v.captive && !v.left) return v;
  return game.shrine && !game.shrine.dead ? game.shrine : null;
}

// a guarda só existe nas missões em que há alguém para defender (mission.militia)
function musterMilitia() {
  const size = game.mission && guardedObjective() ? game.mission.militia || 0 : 0;
  game.militia = { size, damage: 0, kills: 0, fallen: 0 };
  if (!size) return 0;
  for (let k = 0; k < size; k++) {
    const m = new Militia(k);
    m.pos.copy(m.follow());
  }
  showBanner(`⚔︎ Guarda +${size}`, 2);
  return size;
}

// totem de ossos: pilha de ossos com caveira e brilho roxo; tem vida, não anda e faz surgir esqueletos por perto
let totemParts = null;
function totemModel() {
  totemParts ||= { bone: new THREE.MeshLambertMaterial({ color: 0xf1e8d2 }), glow: new THREE.MeshBasicMaterial({ color: 0xb36bff }),
    stick: new THREE.CylinderGeometry(0.11, 0.11, 1.3, 6), knob: new THREE.SphereGeometry(0.15, 8, 6), skull: new THREE.SphereGeometry(0.42, 12, 10),
    eye: new THREE.SphereGeometry(0.09, 6, 6), ring: new THREE.TorusGeometry(0.85, 0.07, 6, 24), base: new THREE.CylinderGeometry(0.7, 0.85, 0.35, 8) };
  const P = totemParts, g = new THREE.Group();
  const base = new THREE.Mesh(P.base, P.bone);
  base.position.y = 0.17;
  g.add(base);
  for (let k = 0; k < 3; k++) {   // ossos cruzados em pé
    const stick = new THREE.Mesh(P.stick, P.bone);
    stick.position.set(Math.cos(k * 2.1) * 0.22, 0.95, Math.sin(k * 2.1) * 0.22);
    stick.rotation.set(Math.sin(k * 2.1) * 0.35, 0, Math.cos(k * 2.1) * 0.35);
    for (const end of [-0.65, 0.65]) { const knob = new THREE.Mesh(P.knob, P.bone); knob.position.y = end; stick.add(knob); }
    g.add(stick);
  }
  const skull = new THREE.Mesh(P.skull, P.bone);
  skull.position.y = 1.95;
  skull.scale.set(1, 0.9, 1);
  for (const side of [-0.15, 0.15]) { const eye = new THREE.Mesh(P.eye, P.glow); eye.position.set(side, 0.02, 0.36); skull.add(eye); }
  g.add(skull);
  const ring = new THREE.Mesh(P.ring, P.glow);
  ring.name = 'glow';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);
  return { scene: g, animations: [] };
}

class Totem extends Unit {
  constructor(at, tower = false) {
    const towerHealth = tower ? 300 : 240;
    super(totemModel(), { hp: Math.round(towerHealth * difficulty.hp * (1 + (game.phase - 1) * 0.1)), dmg: 0, range: 0, speed: 0, cooldown: 1 }, 'skeleton');
    this.totem = true;
    this.tower = tower;
    if (tower) this.size = 1.65;
    this.ranged = true;      // o grupo vai até ele (e o separate não o empurra)
    this.busy = Infinity;    // sem animações de golpe
    this.spawnT = 2;
    this.glow = this.root.getObjectByName('glow');
    this.pos.copy(at);
    this.popT = 0;
    this.deadTime = 0;
    if (tower) {
      const label = document.createElement('span');
      label.textContent = 'Torre de ossos';
      this.bar.appendChild(label);
    }
  }

  update(dt) {
    if (dt <= 0) return;
    this.vel.set(0, 0, 0);
    this.updateCommon(dt);
    if (this.glow) this.glow.rotation.z += dt * 2;
    if (this.dead && (this.deadTime += dt) > 0.4) this.remove();
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.bar.style.display = 'none';
    this.root.visible = false;
    poof(this.pos, 1.6);
    ring(this.pos, 2.4, 0xb36bff, 1);
    game.totemsDown++;
    if (this.tower) game.towersDown++;
    for (const h of heroes()) if (!h.dead) h.gainXp(8);
    const destroyed = this.tower ? game.towersDown : game.totemsDown;
    showBanner(`♜ ${destroyed}/${game.mission.goal.count}`);
  }
}

// totem num lado da estrada, à frente do grupo e longe do desafio da fase
function placeTotem(k, tower = false) {
  const s0 = world.anchorS(game.phase), zone = world.zoneOf(game.phase);
  const side = zone ? (zone.type === 'lake' ? 1 : -1) : k % 2 ? 1 : -1;
  const at = new THREE.Vector3();
  for (let tries = 0; tries < 12; tries++) {
    at.copy(world.along(s0 + 5 + k * 3 + Math.random() * 2, side * (2.5 + Math.random() * 1.5)));
    if (!world.obstacles.some((o) => Math.hypot(o.x - at.x, o.z - at.z) < o.r + 1.2)) break;
  }
  at.y = world.groundHeight(at.x, at.z);
  new Totem(at, tower);
  game.totemsPlaced++;
}

// santuário da missão de defesa: pedestal de pedra com cristal azul; aliado parado que os saqueadores atacam
let shrineParts = null;
function shrineModel() {
  shrineParts ||= { stone: new THREE.MeshLambertMaterial({ color: 0xb9b2a4 }), crystal: new THREE.MeshLambertMaterial({ color: 0x7fd6ff, emissive: 0x1d6fa8 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x8fe3ff }), base: new THREE.CylinderGeometry(1.05, 1.25, 0.45, 8), pillar: new THREE.CylinderGeometry(0.42, 0.55, 1.2, 8),
    gem: new THREE.OctahedronGeometry(0.55, 0), ring: new THREE.TorusGeometry(1.15, 0.06, 6, 28) };
  const P = shrineParts, g = new THREE.Group();
  const base = new THREE.Mesh(P.base, P.stone);
  base.position.y = 0.22;
  const pillar = new THREE.Mesh(P.pillar, P.stone);
  pillar.position.y = 1.05;
  const gem = new THREE.Mesh(P.gem, P.crystal);
  gem.name = 'gem';
  gem.position.y = 2.25;
  gem.scale.set(0.8, 1.3, 0.8);
  const ring = new THREE.Mesh(P.ring, P.glow);
  ring.name = 'glow';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.5;
  g.add(base, pillar, gem, ring);
  return { scene: g, animations: [] };
}

class Shrine extends Unit {
  constructor(at) {
    super(shrineModel(), { hp: Math.round(520 / difficulty.dmg), dmg: 0, range: 0, speed: 0, cooldown: 1 }, 'villager');
    this.structure = true;
    this.ranged = true;      // o separate e os recuos não o tiram do lugar
    this.busy = Infinity;
    this.size = 1.4;
    this.home = at.clone();
    this.home.y = world.groundHeight(at.x, at.z);
    this.pos.copy(this.home);
    this.gem = this.root.getObjectByName('gem');
    this.glow = this.root.getObjectByName('glow');
    this.bar.classList.add('ally');
    const label = document.createElement('span');
    label.textContent = 'Santuário';
    this.bar.appendChild(label);
    this.popT = 0;
  }

  update(dt) {
    if (dt <= 0) return;
    this.vel.set(0, 0, 0);
    this.updateCommon(dt);
    this.pos.copy(this.home);
    if (this.gem?.position) { this.gem.rotation.y += dt * 1.4; this.gem.position.y = 2.25 + Math.sin(game.runTime * 2) * 0.12; }
    if (this.glow?.rotation) this.glow.rotation.z -= dt;
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.bar.style.display = 'none';
    this.root.visible = false;
    poof(this.pos, 1.8);
    ring(this.pos, 2.6, 0x8fe3ff, 1);
  }
}

// Ponte em Chamas: marco da ponte atrás do grupo; quem chega perto dele cruza (conta como passagem).
// Não recebe dano nem cura: a vida da missão é o limite de passagens, mostrado na etiqueta.
const GATE_BACK = 7, GATE_RADIUS = 2.6;
let gateParts = null;
function gateModel() {
  gateParts ||= { wood: new THREE.MeshLambertMaterial({ color: 0x6b4426 }), fire: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
    post: new THREE.CylinderGeometry(0.18, 0.22, 2.2, 6), beam: new THREE.BoxGeometry(3.4, 0.3, 0.3), flame: new THREE.OctahedronGeometry(0.32, 0) };
  const P = gateParts, g = new THREE.Group();
  for (const x of [-1.5, 1.5]) {
    const post = new THREE.Mesh(P.post, P.wood);
    post.position.set(x, 1.1, 0);
    const flame = new THREE.Mesh(P.flame, P.fire);
    flame.name = 'flame';
    flame.position.set(x, 2.45, 0);
    flame.scale.set(1, 1.6, 1);
    g.add(post, flame);
  }
  const beam = new THREE.Mesh(P.beam, P.wood);
  beam.position.y = 1.9;
  g.add(beam);
  return { scene: g, animations: [] };
}

class Gate extends Unit {
  constructor(at) {
    super(gateModel(), { hp: 100, dmg: 0, range: 0, speed: 0, cooldown: 1 }, 'villager');
    this.structure = true;
    this.ranged = true;      // o separate e os recuos não o tiram do lugar
    this.busy = Infinity;
    this.size = 1.4;
    this.home = at.clone();
    this.home.y = world.groundHeight(at.x, at.z);
    this.pos.copy(this.home);
    const fwd = world.tangentAt(world.anchorS(game.phase));
    this.root.rotation.y = Math.atan2(fwd.x, fwd.z);
    this.bar.classList.add('ally');
    this.nameTag = document.createElement('span');
    this.bar.appendChild(this.nameTag);
    this.label();
  }

  label() { this.nameTag.textContent = `Ponte ♨ ${Math.max(0, (game.mission?.goal.leaks || 0) - game.leaks)}`; }

  takeDamage() {}

  update(dt) {
    if (dt <= 0) return;
    this.vel.set(0, 0, 0);
    this.updateCommon(dt);
    this.hp = this.maxHp;
    this.pos.copy(this.home);
  }
}

// a cada quadro: quem alcança a ponte cruza e some; devolve true se passou do limite
function gateTick() {
  const gate = game.gate, limit = game.mission.goal.leaks;
  if (!gate) return false;
  for (const s of skeletonsAlive()) {
    if (s.dead || s.totem || s.spawning || tacticalDistance(s.pos, gate.pos) > GATE_RADIUS) continue;
    game.leaks++;
    s.exploded = s.dissolved = true;
    s.die();
    popText(gate.pos, 'Cruzou!', 'dmg');
    gate.label();
    if (game.leaks < limit) showBanner(`♨ ${game.leaks}/${limit}`, 1.5);
  }
  return game.leaks >= limit;
}

// cripta: elite tem mais vida, bate mais forte, é um pouco maior e brilha dourado
const ELITE_HP = 1.45, ELITE_DMG = 1.2, TWIN_HP = 0.45;
const TWIN_BOSS_HP = 0.58, TWIN_BOSS_DMG = 0.65;
function makeElite(s) {
  s.elite = true;
  s.maxHp = s.hp = Math.round(s.hp * ELITE_HP);
  s.dmg = Math.round(s.dmg * ELITE_DMG);
  s.size *= 1.08;
  s.root.scale.setScalar(s.size);
  for (const m of s.mats) if (m.emissive) { m.userData ||= {}; m.userData.glow ||= 0x4a3400; }
  s.emissiveDirty = true;
  s.bar.classList.add('elite');
}

// trono: o Carrasco surge ao lado do Lich, com menos vida que sozinho na fase 9
function spawnTwinBoss(lich, position) {
  const s = new Skeleton('Executioner', game.phase, true);
  s.maxHp = s.hp = Math.round(s.hp * TWIN_HP);
  s.pos.copy(position);
  s.root.rotation.y = lich.root.rotation.y;
  return s;
}
function tuneTwinBoss(boss) {
  boss.maxHp = boss.hp = Math.round(boss.maxHp * TWIN_BOSS_HP);
  boss.dmg = Math.round(boss.dmg * TWIN_BOSS_DMG);
  boss.emissiveDirty = true;
}

// Os guardiões mantêm atributos menores no Normal; Difícil e Pesadelo aumentam
// a resistência e o perigo do trio sem alterar as outras fases da campanha.
const CASTLE_BOSS_DIFFICULTY = {
  dificil: { lichHp: 1.25, lichDmg: 1.15, guardHp: 1.5, guardDmg: 1.25 },
  pesadelo: { lichHp: 1.5, lichDmg: 1.3, guardHp: 1.8, guardDmg: 1.5 },
};
function prepareCastleBoss(boss, hpScale, dmgScale, title, hpDifficultyScale = 1, dmgDifficultyScale = 1) {
  boss.maxHp = boss.hp = Math.round(boss.maxHp * hpScale * hpDifficultyScale);
  boss.dmg = Math.round(boss.dmg * dmgScale * dmgDifficultyScale);
  boss.kind = { ...boss.kind, title };
  boss.emissiveDirty = true;
  return boss;
}
function spawnCastleBosses(lich, formation) {
  const s0 = world.anchorS(game.phase), anchor = world.pointAt(s0);
  const tuning = CASTLE_BOSS_DIFFICULTY[difficulty.id] || { lichHp: 1, lichDmg: 1, guardHp: 1, guardDmg: 1 };
  const faceCenter = (boss) => { boss.root.rotation.y = Math.atan2(anchor.x - boss.pos.x, anchor.z - boss.pos.z); };
  lich.pos.copy(formation[0]);
  prepareCastleBoss(lich, 0.42, 0.65, 'Coração sombrio', tuning.lichHp, tuning.lichDmg);
  faceCenter(lich);
  const guardians = [
    { kind: 'Executioner', position: formation[1], hp: 0.22, dmg: 0.38, title: 'Carrasco do trono' },
    { kind: 'DarkKnight', position: formation[2], hp: 0.24, dmg: 0.38, title: 'Cavaleiro do Eclipse' },
  ];
  for (const entry of guardians) {
    const boss = new Skeleton(entry.kind, game.phase, true);
    boss.pos.copy(entry.position);
    prepareCastleBoss(boss, entry.hp, entry.dmg, entry.title, tuning.guardHp, tuning.guardDmg);
    faceCenter(boss);
  }
}

// alvo da caçada: batedor resistente que foge de quem chega perto até ser encurralado no fim da clareira
const HUNT_FLEE = 3.8, HUNT_EDGE = 5, HUNT_PURSUIT_LIMIT = 13, HUNT_INTERCEPTORS = 2;
const huntDest = new THREE.Vector3();
function huntThink(u, dt) {
  if (u.rootT > 0 || u.tauntT > 0) return false;   // preso ou provocado: luta onde está
  const s0 = world.anchorS(game.phase), fwd = world.tangentAt(s0), anchor = world.pointAt(s0), side = world.sideOf(fwd);
  const dx = u.pos.x - anchor.x, dz = u.pos.z - anchor.z;
  const ahead = dx * fwd.x + dz * fwd.z;
  const chased = (activeTargetContext?.party ?? heroes()).some((h) => !h.dead && h.pos.distanceTo(u.pos) < HUNT_FLEE);
  if (!chased || ahead >= HUNT_EDGE - 0.5) return false;   // sem perseguidor ou encurralado: volta a atacar
  const lateral = THREE.MathUtils.clamp(dx * side.x + dz * side.z, -(ROAD - 1), ROAD - 1);
  u.moveTo(huntDest.copy(world.along(s0 + Math.min(HUNT_EDGE, ahead + 2.2), lateral)), dt);
  return true;
}

function spawnHuntMark() {
  if (game.huntMark && !game.huntMark.dead) return true;
  const point = findSafeSkeletonRouteSpawn(world.anchorS(game.phase), { type: 'Rogue', preferredSign: 1 });
  if (!point) { game.huntSpawnTimer = 1; return false; }
  const s = new Skeleton('Rogue', game.phase);
  s.maxHp = s.hp = Math.round(s.hp * 6);
  s.speed = Math.max(s.speed, 2.6);
  s.hunted = true;
  s.kind = { ...s.kind, think: huntThink };
  s.pos.copy(point);
  s.bar.classList.add('boss');
  const label = document.createElement('span');
  label.textContent = 'Alvo marcado';
  s.bar.appendChild(label);
  for (const m of s.mats) { m.userData ||= {}; m.userData.glow = 0x5c1212; }
  s.emissiveDirty = true;
  game.huntMark = s;
  game.huntSpawnTimer = 0;
  return true;
}

const clockText = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function missionProgress(goal, villager = game.villager, skeletons = skeletonsAlive()) {
  const mission = game.mission;
  if (!mission) return 0;
  const phaseCount = Math.max(1, mission.to - mission.from + 1);
  const phaseProgress = THREE.MathUtils.clamp((game.phase - mission.from + Number(game.state === 'cleared')) / phaseCount, 0, 1);
  const finalPhaseCleared = game.state === 'cleared' && game.phase >= mission.to;
  const objectiveThenMission = (progress) => progress >= 1
    ? finalPhaseCleared ? 1 : 0.85 + phaseProgress * 0.15
    : THREE.MathUtils.clamp(progress, 0, 1) * 0.85;
  const timedWaveProgress = (timeLeft, duration) => {
    if (timeLeft > 0) return THREE.MathUtils.clamp(1 - timeLeft / duration, 0, 1) * 0.85;
    const remaining = Math.max(0, game.toSpawn) + skeletons.length;
    return remaining === 0 ? 1 : 0.85 + 0.15 * (1 - THREE.MathUtils.clamp(remaining / 7, 0, 1));
  };
  if (goal.type === 'escort') return villager ? THREE.MathUtils.clamp(villager.hp / villager.maxHp, 0, 1) : 0;
  if (goal.type === 'rescue') return objectiveThenMission(game.rescueComplete ? 1 : game.rescueT / RESCUE_TIME);
  if (goal.type === 'boss') return game.bossDown ? 1 : phaseProgress;
  if (goal.type === 'survive') {
    if (game.phase < goal.phase) return 0;
    if (game.phase > goal.phase) return 1;
    return timedWaveProgress(game.surviveT, goal.time);
  }
  if (goal.type === 'tower') return objectiveThenMission(game.towersDown / goal.count);
  if (goal.type === 'totems') return objectiveThenMission(game.totemsDown / goal.count);
  if (goal.type === 'timer') return THREE.MathUtils.clamp(game.missionT / goal.time, 0, 1);
  if (goal.type === 'defend') return timedWaveProgress(game.surviveT, goal.time);
  if (goal.type === 'hunt') {
    const mark = game.huntMark;
    return game.huntDown ? 1 : mark ? THREE.MathUtils.clamp(1 - mark.hp / mark.maxHp, 0, 1) : 0;
  }
  if (goal.type === 'endless') return THREE.MathUtils.clamp(game.endlessT / goal.dawn, 0, 1);
  if (goal.type === 'breach') return THREE.MathUtils.clamp(1 - game.surviveT / goal.time, 0, 1);
  if (goal.type === 'elite') return game.state === 'cleared' ? 1 : THREE.MathUtils.clamp((game.eliteWave - 1) / goal.waves, 0, 1);
  if (goal.type === 'duel' || goal.type === 'twin' || goal.type === 'bosses') {   // vida que falta tirar dos chefes à vista
    if (game.bossDown) return 1;
    let hp = 0, max = 0;
    for (const u of units) if (u.phaseBoss) { hp += u.dead ? 0 : Math.max(0, u.hp); max += u.maxHp; }
    return max ? THREE.MathUtils.clamp(1 - hp / max, 0, 1) : 0;
  }
  return phaseProgress;
}

// fim de missão sem derrota: dissolve o que restou da onda e encerra na fase atual
function closeMission() {
  game.last = game.phase;
  game.toSpawn = 0;
  for (const s of skeletonsAlive()) if (!s.dead) { s.exploded = s.dissolved = true; s.die(); }   // desfaz sem explodir nem contar abate
}

// regras dos objetivos novos (santuário, caçada e horda); devolve um texto de derrota ou null
function newGoalTick(goal, dt, skeletons) {
  if (goal.type === 'defend') {
    if (game.shrine?.dead) return 'O santuário caiu! Ele não pode ser destruído.';
    if (game.state === 'fight') {   // ondas sem parar até o tempo acabar
      if ((game.surviveT = Math.max(0, game.surviveT - dt)) <= 0) {
        closeMission();
        showBanner('Santuário protegido!', 2.5);
      } else {
        const cap = partyCap(SHRINE_ENEMY_CAP);
        if (game.toSpawn === 0 && skeletons.length < cap) game.toSpawn = Math.min(3, cap - skeletons.length);
      }
    }
  } else if (goal.type === 'hunt' && game.state === 'fight' && !game.huntDown) {
    const mark = game.huntMark;
    if (mark?.dead) {
      game.huntDown = true;
      closeMission();
      showBanner('Alvo abatido!', 2.5);
    } else if (mark && (game.surviveT = Math.max(0, game.surviveT - dt)) <= 0) {
      game.huntEscaped = true;
      poof(mark.pos, 1.4);
      return 'O alvo marcado fugiu na névoa!';
    }
  } else if (goal.type === 'breach' && game.state === 'fight') {
    if (game.surviveT > 0) {
      if (gateTick()) return 'Os esqueletos cruzaram a ponte!';
      if ((game.surviveT = Math.max(0, game.surviveT - dt)) <= 0) { closeMission(); showBanner('Ponte salva!', 2.5); }
      else if (game.toSpawn === 0 && skeletons.length < 7) { game.toSpawn = Math.min(4, 7 - skeletons.length); game.refilling = true; }   // reforços sem novo golem, limitados à pressão de 7 inimigos
    }
  } else if (goal.type === 'elite' && game.state === 'fight' && game.toSpawn === 0 && !skeletons.length && game.eliteWave < goal.waves) {
    game.eliteWave++;
    game.toSpawn = game.eliteSize;
    game.spawnTimer = 3;
    for (const hero of heroes()) if (!hero.dead) {
      hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.18);
      popText(hero.pos, '♥', 'heal');
    }
    showBanner(`Elite ${game.eliteWave}/${goal.waves}`, 2);
  } else if (goal.type === 'endless' && game.state === 'fight' && game.endlessT < goal.dawn) {
    game.endlessT = Math.min(goal.dawn, game.endlessT + dt);
    let reached = 0;
    for (const mark of goal.marks) if (game.endlessT >= mark) reached++;
    if (reached > game.endlessStars) { game.endlessStars = reached; showBanner(`${'★'.repeat(reached)} ${goal.marks[reached - 1]} s`, 2.5); }
    if (game.endlessT >= goal.dawn) { closeMission(); showBanner('Amanheceu!', 3); }
    else {   // a horda engrossa com o tempo: mais esqueletos ao mesmo tempo e reforços maiores
      const cap = Math.min(12, 4 + Math.floor(game.endlessT / 60) * 2);
      if (game.toSpawn === 0 && skeletons.length < cap) game.toSpawn = Math.min(cap - skeletons.length, 1 + Math.floor(game.endlessT / 60));
    }
  }
  return null;
}

function trackMissionFalls(party) {
  let standingHeroes = 0;
  for (const h of party) { if (h.dead && !h.fell) game.falls++; h.fell = h.dead; if (!h.dead) standingHeroes++; }
  return standingHeroes;
}

// regras da missão a cada quadro; devolve true se a missão acabou em derrota
function campaignTick(dt, skeletons, party = heroes()) {
  const goal = game.mission.goal;
  const standingHeroes = trackMissionFalls(party);
  const finalPhaseCleared = game.state === 'cleared' && game.phase >= game.last;
  if (!finalPhaseCleared) game.missionT += dt;
  const fail = (text) => (endGame(text, false), true);
  if (goal.type === 'escort' && game.villager?.dead) return fail('O aldeão caiu! Proteja-o até o fim.');
  if (goal.type === 'rescue' && game.villager?.dead) return fail(game.rescueComplete
    ? 'A pessoa resgatada caiu antes de chegar em segurança.'
    : 'A pessoa presa caiu antes do resgate.');
  const captive = captivePrisoner();
  if (captive && game.state === 'fight') {   // libertar leva tempo; longe dele o progresso cai devagar
    const rescueThreatened = rescueAreaThreatened(captive, skeletons);
    let near = false;
    if (!rescueThreatened && game.rescueGuardsPending <= 0) for (const hero of party) if (!hero.dead && tacticalDistance(hero.pos, captive.pos) <= rescueReach(hero, captive)) { near = true; break; }
    game.rescueT = near ? game.rescueT + dt : Math.max(0, game.rescueT - dt * 0.5);
    captive.nameTag.textContent = game.rescueGuardsPending > 0 ? 'Guardas se aproximando' : rescueThreatened ? 'Limpe a área'
      : game.rescueT > 0 ? `Libertando ${Math.floor(Math.min(1, game.rescueT / RESCUE_TIME) * 100)}%` : 'Prisioneiro';
  }
  if (captive && game.rescueT >= RESCUE_TIME) {
    game.villager.rescued = true;
    game.villager.exitT = RESCUE_EXIT_TIME;
    game.missionVillagerRatio = Math.max(0, Math.min(1, game.villager.hp / Math.max(1, game.villager.maxHp)));   // estrelas: a vida na libertação
    game.rescueComplete = true;
    game.villager.nameTag.textContent = 'Resgatado';
    popText(game.villager.pos, 'Resgatado!', 'heal');
    showBanner('Resgatada!', 2.5);
  }
  if (goal.type === 'timer' && !finalPhaseCleared && game.missionT > goal.time) return fail(`O tempo acabou na fase ${game.phase}!`);
  if (bossGoal(goal)) {   // chefe derrotado: o exército dele se desfaz e a missão termina
    let liveBoss = null, anyBoss = null;
    for (const unit of units) if (unit.phaseBoss) {
      anyBoss ||= unit;
      if (!unit.dead) { liveBoss = unit; break; }
    }
    const boss = liveBoss || anyBoss;   // no trono há dois: só termina quando os dois caem
    if (boss) game.bossSeen = true;
    if (game.bossSeen && (!boss || boss.dead) && game.state === 'fight' && !game.bossDown) {
      game.bossDown = true;
      game.last = game.phase;
      game.toSpawn = 0;
      for (const s of skeletonsAlive()) if (!s.dead) { s.exploded = s.dissolved = true; s.die(); }   // desfaz sem explodir nem contar abate
      FX.bossDown(boss);
      showBanner('Chefe derrotado!', 2.5);
    }
  }
  if (goal.type === 'survive' && game.phase === goal.phase && game.state === 'fight') {   // ondas sem parar até o tempo acabar
    game.surviveT = Math.max(0, game.surviveT - dt);
    if (game.surviveT > 0 && game.toSpawn === 0 && skeletons.length < partyCap(6)) game.toSpawn = Math.min(4, partyCap(6) - skeletons.length);
  }
  const lost = newGoalTick(goal, dt, skeletons);
  if (lost) return fail(lost);
  if (hasDestructionGoal(goal) && game.state === 'fight') {
    let summonCount = skeletons.length + pendingMonsterSummons();
    for (const t of skeletons) if (t.totem && (t.spawnT -= dt) <= 0) {
      if (summonCount >= 12) { t.spawnT = 6 * difficulty.interval; continue; }
      const type = Math.random() < 0.3 ? 'Warrior' : 'Minion';
      const point = findTotemSummonPoint(t, type);
      if (!point) { t.spawnT = 0.8 * difficulty.interval; continue; }
      t.spawnT = 6 * difficulty.interval;
      const s = new Skeleton(type, game.phase);
      s.pos.copy(point);
      summonCount++;
    }
  }
  // indicador no HUD
  const v = game.villager;
  let text, left = Infinity;
  switch (goal.type) {
    case 'win': text = `Vença até a fase ${game.mission.to}`; break;
    case 'escort': text = v ? `Aldeão ${Math.ceil(Math.max(0, v.hp) / v.maxHp * 100)}%` : 'Proteja o aldeão'; break;
    case 'rescue': text = v?.rescued ? `Pessoa resgatada · ${game.state === 'cleared' && game.phase >= game.mission.to ? 'missão concluída' : game.phase < game.mission.to ? `avance até a fase ${game.mission.to}` : 'limpe a onda'}`
      : game.rescueT > 0 ? 'Libertando o prisioneiro' : 'Encontre e resgate a pessoa'; break;
    case 'boss': text = game.bossDown ? 'Chefe derrotado!' : game.bossSeen ? 'Derrote o chefe!' : `Chefe na fase ${nextBossPhase(game.phase, game.mission.boss) ?? game.mission.to}`; break;
    case 'survive': text = game.phase < goal.phase ? `Aguente ${goal.time} s na fase ${goal.phase}` : game.surviveT > 0 ? `Aguente ${clockText(game.surviveT)}` : game.toSpawn > 0 || skeletons.length ? 'Sobreviveu · limpe a onda' : 'Sobreviveu!'; break;
    case 'totems': text = `Totens ${game.totemsDown}/${goal.count}${game.totemsDown >= goal.count ? ` · ${game.state === 'cleared' && game.phase >= game.mission.to ? 'missão concluída' : game.phase < game.mission.to ? `avance até a fase ${game.mission.to}` : 'limpe a onda'}` : ''}`; break;
    case 'tower': text = game.towersDown >= goal.count
      ? `Torre derrubada · ${game.state === 'cleared' && game.phase >= game.mission.to ? 'missão concluída' : game.phase < game.mission.to ? `avance até a fase ${game.mission.to}` : 'limpe a onda'}`
      : 'Derrube a torre de ossos'; break;
    case 'breach': text = game.surviveT > 0 ? `Passaram ${game.leaks}/${goal.leaks} · ${clockText(game.surviveT)}` : 'Ponte salva!'; break;
    case 'duel': text = game.bossDown ? 'Duelo vencido!' : `Duelo ${clockText(game.missionT)}`; break;
    case 'elite': text = `Elite ${game.eliteWave}/${goal.waves}`; break;
    case 'twin': {
      let standing = 0;
      for (const unit of units) if (unit.phaseBoss && !unit.dead) standing++;
      text = game.bossDown ? 'Trono derrubado!' : `Chefes ${game.bossSeen ? 2 - standing : 0}/2`;
      break;
    }
    case 'bosses': {
      let standing = 0;
      for (const unit of units) if (unit.phaseBoss && !unit.dead) standing++;
      const total = goal.bosses?.length || 3;
      text = game.bossDown ? 'Coração destruído!' : `Chefes ${game.bossSeen ? total - standing : 0}/${total}`;
      break;
    }
    case 'nofall': text = `De pé ${standingHeroes}/${party.length} · quedas ${game.falls}`; break;
    case 'timer': left = goal.time - game.missionT; text = `Tempo ${clockText(Math.max(0, left))}`; break;
    case 'defend': {
      const shrine = game.shrine;
      const cleanupPending = game.toSpawn > 0 || skeletons.length > 0;
      const status = game.surviveT > 0 ? clockText(game.surviveT) : cleanupPending ? 'limpe a onda' : 'salvo';
      text = `Santuário ${shrine ? Math.ceil(Math.max(0, shrine.hp) / shrine.maxHp * 100) : 100}% · ${status}`;
      break;
    }
    case 'hunt': left = game.surviveT; text = game.huntDown ? 'Alvo abatido!' : `Alvo marcado · foge em ${clockText(left)}`; break;
    case 'endless': {
      const next = goal.marks.find((mark) => game.endlessT < mark);
      text = `Noite ${clockText(game.endlessT)}${next ? ` · ★ em ${clockText(next - game.endlessT)}` : ` · 3ª ★: mantenha alguém de pé · amanhece em ${clockText(Math.max(0, goal.dawn - game.endlessT))}`}`;
      break;
    }
    default: text = goalText(goal);
  }
  setGoalUI(text, missionProgress(goal, v, skeletons));
  const shrineLow = goal.type === 'defend' && game.shrine && game.shrine.hp < game.shrine.maxHp * 0.35;
  $('goal').classList.toggle('warn', ((goal.type === 'escort' || goal.type === 'rescue' && !v?.rescued) && v && v.hp < v.maxHp * 0.35) || (goal.type === 'timer' && left < 30) || (goal.type === 'hunt' && !game.huntDown && left < 15) || shrineLow || (goal.type === 'breach' && game.leaks >= goal.leaks - 2));
  const waveCleared = game.toSpawn <= 0 && skeletons.length === 0;
  const missionObjectiveComplete = game.state === 'cleared' && game.phase >= game.mission.to;
  $('goal').classList.toggle('done', (goal.type === 'totems' && game.totemsDown >= goal.count && missionObjectiveComplete)
    || (goal.type === 'tower' && game.towersDown >= goal.count && missionObjectiveComplete)
    || (goal.type === 'rescue' && game.rescueComplete && missionObjectiveComplete)
    || (goal.type === 'survive' && game.phase === goal.phase && game.surviveT <= 0 && waveCleared)
    || (goal.type === 'defend' && game.surviveT <= 0 && waveCleared) || (goal.type === 'breach' && game.surviveT <= 0)
    || (bossGoal(goal) && game.bossDown) || (goal.type === 'hunt' && game.huntDown) || (goal.type === 'endless' && game.endlessT >= goal.dawn));
  return false;
}

// recompensa da vitória: chips curtos (estrelas novas, medalha, desafio); o texto inteiro fica na dica
const escAttr = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const endChip = (icon, text, tip, cls = '') => `<span class="end-chip${cls ? ` ${cls}` : ''}" tabindex="0" data-tip="${escAttr(tip)}" aria-label="${escAttr(tip)}"><i aria-hidden="true">${icon}</i>${text}</span>`;
function missionRewardHTML(stars, gained, medal) {
  const max = MISSIONS.length * 3;
  const chips = [];
  if (gained > 0) chips.push(endChip('★', `+${gained}`, `+${gained} ★ na campanha · ${totalStars()}/${max}`, 'star'));
  if (medal.newBest) chips.push(endChip('⚜', '', `Medalha ${difficulty.name} conquistada!`, 'medal'));
  if (medal.newChallenge) chips.push(endChip('✓', '', `Desafio cumprido: ${medal.newChallenge.label}!`, 'medal'));
  else {
    const open = missionMedal(game.mission.id).challenges.find((c) => c.difficultyId === difficulty.id && !c.done);
    if (open && stars < 3) chips.push(endChip('◎', '', `Desafio opcional: ${open.label}`));
  }
  return chips.length ? `<div class="mission-reward end-chips" aria-label="Recompensa da missão">${chips.join('')}</div>` : '';
}

// próximo passo no fim da missão: seguir para a próxima arena e/ou repetir com a mesma equipe
const REPLAY_TIP = 'Mesma missão, dificuldade e equipe';
function missionNextHTML(won, next, unlockedNow) {
  if (won && next) {
    const tip = `${unlockedNow ? 'Nova missão liberada' : 'Próxima missão'}: ${next.name}`;
    return `<button class="mission-replay-btn" type="button" data-act="replay" aria-label="Repetir" data-tip="${REPLAY_TIP}">↻</button>`
      + `<button class="mission-next-btn" type="button" data-act="next" aria-label="Próxima missão: ${escAttr(next.name)}" data-tip="${escAttr(tip)}">Próxima ▸</button>`;
  }
  return `<button class="mission-next-btn" type="button" data-act="replay" data-tip="${REPLAY_TIP}">↻ Repetir</button>`;
}

// fim da missão: estrelas animadas, gravação e aviso de variante nova
function missionEnd(won) {
  const party = heroes();
  const hpRatio = game.missionHpRatio ?? party.reduce((s, h) => s + Math.max(0, h.hp), 0) / Math.max(1, party.reduce((s, h) => s + h.maxHp, 0));
  const shrine = game.shrine;
  const villager = game.villager;
  const currentVillagerRatio = villager && villager.maxHp > 0 ? Math.max(0, Math.min(1, villager.hp / villager.maxHp)) : 0;
  const villagerRatio = ['escort', 'rescue'].includes(game.mission.goal.type)
    ? (game.missionVillagerRatio ?? currentVillagerRatio)
    : currentVillagerRatio;
  const aliveHeroes = party.reduce((count, hero) => count + Number(!hero.dead), 0);
  const result = { won, falls: game.falls, aliveHeroes, hpRatio, goal: game.mission.goal, shrineRatio: shrine ? Math.max(0, shrine.hp) / shrine.maxHp : 0, villagerRatio, timeLeft: game.surviveT, endlessTime: game.endlessT, leaks: game.leaks, seconds: game.missionT };
  const stars = starsFor(result);
  const conditions = starConditions(result);
  const before = totalStars();
  const cosmeticsBefore = !game.test && game.mission
    ? new Set(campaignCosmetics().filter((cosmetic) => cosmetic.unlocked).map((cosmetic) => cosmetic.id))
    : null;
  const best = !game.test && saveStars(game.mission.id, stars);
  // a medalha compara com os recordes anteriores, então grava antes do tempo
  const medal = game.test ? null : saveMissionMedal(game.mission.id, { won, stars, difficultyId: difficulty.id });
  // só grava recorde de tempo onde terminar rápido importa (saveMissionRecord filtra o objetivo)
  const bestTime = !game.test && saveMissionRecord(game.mission.id, { won, seconds: game.missionT, difficultyId: difficulty.id });
  const fresh = allOpen() ? [] : UNLOCKS.filter((u) => u.stars > before && u.stars <= totalStars()).map((u) => VARIANTS.find((v) => v.id === u.id));
  const cosmeticUnlocks = cosmeticsBefore
    ? campaignCosmetics().filter((cosmetic) => cosmetic.unlocked && !cosmeticsBefore.has(cosmetic.id))
    : [];
  // estrelas grandes; o critério de cada uma fica na dica (e no nome acessível da fileira)
  const criterion = (c) => c ? `${c.achieved ? '✓' : '○'} ${c.label}` : '';
  const row = `<span class="stars big" role="img" aria-label="${stars} de 3 estrelas. ${escAttr(conditions.map(criterion).join('; '))}">${[1, 2, 3].map((k) =>
    `<i class="${k <= stars ? 'on' : ''}" data-tip="${escAttr(criterion(conditions[k - 1]))}">★</i>`).join('')}</span>`;
  // à vista só o que é prêmio novo (cosmético, variante); recordes, medalha e desafio vão para "Detalhes" (game.resultExtras)
  const chips = [
    ...cosmeticUnlocks.map((cosmetic) => endChip('✦', 'Cosmético novo', `${cosmetic.name} desbloqueado em ${cosmetic.chapter}. Equipe no Acampamento.`, 'cosmetic')),
    ...fresh.map((cfg) => `<span class="end-chip unlock" tabindex="0" style="--c:${cfg.color[0]};--cd:${cfg.color[1]}" data-tip="Nova variante liberada: ${escAttr(cfg.name)}" aria-label="Nova variante liberada: ${escAttr(cfg.name)}"><img src="${cfg.portrait}" alt="">Nova!</span>`),
  ].join('');
  const extras = [
    best && stars ? endChip('★', 'Melhor', 'Novo melhor resultado nesta missão!', 'star') : '',
    bestTime ? endChip('⏱', formatMissionRecordTime(game.missionT), `Novo recorde · ${difficulty.name} · ${formatMissionRecordTime(game.missionT)}`) : '',
  ].join('');
  game.resultExtras = (extras ? `<div class="end-chips">${extras}</div>` : '')
    + (won && medal ? missionRewardHTML(stars, totalStars() - before, medal) : '');
  $('overlayStars').innerHTML = row + (chips ? `<div class="end-chips">${chips}</div>` : '')
    + (game.test ? '<div class="star-best">Modo de teste: estrelas e recordes não contam</div>' : '');
  return stars;
}

// Inimigo comum trancado ou fugindo sem fim (preso no terreno, do outro lado do rio ou correndo em círculos): sem apanhar,
// sem se aproximar e fora do alcance de ataque por STUCK_ENEMY_TIME s volta à fila de spawn.
const STUCK_ENEMY_TIME = 15, STUCK_ENEMY_PROGRESS = 3, STUCK_ENEMY_ATTACK_MARGIN = 0.8;
const ADVANCE_WAIT = 4;   // espera máxima pela formação ao chegar numa fase
function reapStuckEnemies(dt, skeletons, party) {
  for (const s of skeletons) {
    // nascendo há mais de 8 s (ponto de spawn inválido, fora do mapa) também conta como trancado
    const stuckSpawn = s.spawning && (s.spawnAge = (s.spawnAge || 0) + dt) > 8;
    if (s.dead || (s.spawning && !stuckSpawn) || s.boss || s.totem || s === game.huntMark || !party.length) { s.stuckT = 0; continue; }
    // sem progresso: não perdeu vida e não chegou mais perto de nenhum herói (parado, preso ou fugindo sem fim)
    let gap = Infinity, canBeAttacked = false;
    for (const hero of party) {
      if (hero.dead) continue;
      const distance = hero.pos.distanceTo(s.pos);
      gap = Math.min(gap, distance);
      if (distance <= (hero.range || 1.5) + STUCK_ENEMY_ATTACK_MARGIN + 0.4 * ((s.size || 1) - 1)) canBeAttacked = true;
    }
    if (s.stuckRef === undefined) { s.stuckRef = gap; s.stuckHp = s.hp; s.stuckT = 0; continue; }
    const hurt = s.hp < s.stuckHp, closing = gap < s.stuckRef - STUCK_ENEMY_PROGRESS;
    s.stuckHp = s.hp;
    if (hurt || closing || canBeAttacked) { s.stuckRef = gap; s.stuckT = 0; continue; }
    if ((s.stuckT += dt) < STUCK_ENEMY_TIME) continue;
    s.dead = true;   // sai sem contar abate nem dar XP
    s.hp = 0;
    poof(s.pos, 1.2);
    s.remove();
    game.toSpawn++;
  }
}

function spawnSkeleton() {
  const p = game.phase;
  const tier = game.arena?.tier ?? p;   // na arena de teste a força sobe com o tempo; a posição segue a fase fixa
  const zone = world.zoneOf(p);
  let type = 'Minion', boss = false;
  const lead = game.toSpawn === 1 && !game.refilling ? waveLeader(game.arena?.leaderTier ?? p, game.bossPending, game.mission?.boss) : null;   // Rei (6), Lich (12), golem ou o chefe da missão
  if (lead) { type = lead; boss = game.bossPending; }
  else {
    const r = Math.random();
    const rogue = Math.min(0.3, 0.04 * tier), warrior = Math.min(0.4, 0.06 * tier);
    type = r < rogue ? 'Rogue' : r < rogue + warrior ? 'Warrior' : 'Minion';
    type = pickMonster(tier, type);   // tipos novos entram aos poucos
    if (tier >= 2 && ['Minion', 'Warrior', 'Rogue'].includes(type) && Math.random() < difficulty.shooters)
      type = Math.random() < 0.5 ? 'Crossbow' : 'Mage';
  }
  // fases 3, 7 e 10 fecham a onda com uma dupla de atiradores no chão, atrás do grupo
  if ((p === 3 || p === 7 || p === 10) && game.toSpawn <= 2 && !lead && difficulty.shooters > 0) type = game.toSpawn === 2 ? 'Crossbow' : 'Mage';
  const s0 = world.anchorS(p);
  const behind = tier >= difficulty.behindFrom && !lead && game.mission?.goal.type !== 'breach' && Math.random() < difficulty.behind;   // nas fases mais altas, alguns vêm por trás
  const preferredSign = behind ? -1 : 1;
  const twinMission = game.mission?.goal.type === 'twin' && lead && boss;
  const castleBossMission = game.mission?.goal.type === 'bosses' && lead && boss;
  let formation;
  if (twinMission) formation = findTwinBossFormation(s0, preferredSign, type);
  else if (castleBossMission) formation = findCastleBossFormation();
  else {
    const preferredPoints = [];
    for (let tries = 0; tries < 12; tries++) {
      const at = s0 + preferredSign * (behind ? 9 + Math.random() * 3 : 11 + Math.random() * 6);
      preferredPoints.push(world.along(at, (Math.random() * 2 - 1) * (ROAD - 1)));
    }
    const point = findSafeSkeletonRouteSpawn(s0, { type, boss, preferredSign, zone, preferredPoints });
    if (!point) return false;
    formation = [point];
  }
  if (!formation) return false;
  if (!twinMission && !castleBossMission && zone) {
    const points = zone.type === 'lake' && !boss && game.toSpawn % 3 === 0 ? zone.water : zone.ground;
    for (let i = 0; i < points.length; i++) {
      const point = points[(game.toSpawn + i) % points.length].clone();
      point.y = world.groundHeight(point.x, point.z);
      if (!isSafeSkeletonSpawn(point, { size: skeletonSpawnSize(type, boss), zone })) continue;
      formation[0] = point;
      if (world.isShallow(point.x, point.z)) waterSplash(point, true);
      break;
    }
  }
  const s = new Skeleton(type, tier, boss);
  s.pos.copy(formation[0]);
  const c = world.pointAt(s0);
  s.root.rotation.y = Math.atan2(c.x - s.pos.x, c.z - s.pos.z);   // de frente para os heróis
  if (game.mission?.goal.type === 'defend' && !lead && Math.random() < 0.45) s.raider = true;   // saqueadores correm para o santuário
  if (game.mission?.goal.type === 'breach' && !lead && !s.ranged && Math.random() < 0.2) s.raider = true;   // corredores vão direto à ponte
  if (game.mission?.goal.type === 'elite' && !lead) makeElite(s);
  if (lead && boss && game.mission?.boss?.phase === p && game.mission.boss.mod) applyBossMod(s, game.mission.boss.mod);   // Rei Espectral, Carrasco Afogado
  if (twinMission) {
    tuneTwinBoss(s);
    tuneTwinBoss(spawnTwinBoss(s, formation[1]));
  }
  if (castleBossMission) spawnCastleBosses(s, formation);
  if (game.mission?.goal.type === 'duel' && lead && boss) {   // o Rei do duelo é feito para um herói só
    s.maxHp = s.hp = Math.round(s.hp * game.mission.goal.bossHp);
    s.dmg = Math.round(s.dmg * game.mission.goal.bossDmg);
  }
  if (boss) game.bossPending = false;   // qualquer reforço que repita a contagem não pode criar outro chefe
  return true;
}

// monsters.js usa estas peças do jogo (ele não importa o main.js)
linkMonsters({ Skeleton, units, heroes, allies, skeletonsAlive, isSafeSkeletonSummonPoint, findSafeSkeletonSummonPoint, markEmissiveDirty: (unit) => { if (unit) unit.emissiveDirty = true; }, livingAllies: () => activeTargetContext?.livingAllies || allies().filter((unit) => !unit.dead), rangedHeroes: () => activeTargetContext?.rangedHeroes || heroes().filter((hero) => hero.ranged), scene, assets, get world() { return world; }, ring, beam, poof, popText, showBanner,
  get game() { return game; }, get difficulty() { return difficulty; } });

// Com a onda ainda longe, a formação anda ao encontro dela em vez de esperar parada no posto;
// o avanço tem teto para o grupo não atravessar o terreno da fase seguinte.
const PRESS_LIMIT = 7;
function pressForward(dt, skeletons, party = heroes()) {
  if (game.mission?.goal.type === 'defend' || game.mission?.goal.type === 'breach') return;   // na defesa o grupo fica perto do santuário (ou da ponte)
  const anchor = world.pointAt(game.guideS), fwd = world.tangentAt(game.guideS);
  let nearest = Infinity;
  for (const s of skeletons) {
    if (s.spawning || s.totem || s.dead) continue;
    const ahead = (s.pos.x - anchor.x) * fwd.x + (s.pos.z - anchor.z) * fwd.z;
    if (ahead < 0) return;   // inimigo atrás: o grupo segura a posição
    nearest = Math.min(nearest, ahead);
  }
  const room = Math.min(world.anchorS(game.phase) + PRESS_LIMIT, game.guideS + nearest - (LEASH + 1)) - game.guideS;
  if (nearest === Infinity || room <= 0) return;
  game.guideS += Math.min(room, MARCH * dt);
  for (const h of party) h.setAnchor(game.guideS);
}

function updateGame(dt) {
  if (game.over || game.paused) return;
  // Buffers anexados à função para reaproveitar listas sem depender do escopo externo.
  const buffers = updateGame.buffers || (updateGame.buffers = { party: [], alive: [], skeletons: [] });
  const { party, alive, skeletons } = buffers;
  party.length = alive.length = skeletons.length = 0;
  if (units.length) {
    for (const unit of units) {
      if (unit.team === 'hero') { party.push(unit); if (!unit.dead) alive.push(unit); }
      else if (unit.team === 'skeleton' && !unit.dead) skeletons.push(unit);
    }
  } else {   // mantém os doubles enxutos usados pelos testes isolados de fase
    for (const hero of heroes()) { party.push(hero); if (!hero.dead) alive.push(hero); }
    for (const enemy of skeletonsAlive()) if (!enemy.dead) skeletons.push(enemy);
  }

  // Mesmo quando cair depois de uma marca conta como vitória, essas quedas
  // ainda bloqueiam conquistas que exigem concluir uma missão sem baixas.
  if (!alive.length && game.mission) trackMissionFalls(party);
  if (!alive.length && game.arena) return arenaSummary(true);   // modo Teste: a equipe toda caiu
  if (!alive.length && game.mission?.goal.type === 'endless') {   // na horda, cair faz parte: vale o tempo aguentado
    const held = game.endlessT >= game.mission.goal.marks[0];
    return endGame(`${held ? 'A horda foi contida' : 'A horda venceu'} por ${clockText(game.endlessT)}.`, held);
  }
  if (!alive.length) return endGame(game.mission?.goal.type === 'nofall'
    ? `Todo o grupo caiu na fase ${game.phase}. A missão terminou.`
    : `Os esqueletos venceram na fase ${game.phase}.`, false);
  if (game.state === 'fight' && game.mission?.goal.type === 'rescue' && game.rescueGuardsPending > 0 && game.villager && !game.villager.dead) {
    game.rescueSpawnTimer -= dt;
    if (game.rescueSpawnTimer <= 0) spawnRescueGuards(game.villager);
  }
  if (game.state === 'fight' && game.mission?.goal.type === 'hunt' && !game.huntMark && !game.huntDown) {
    game.huntSpawnTimer -= dt;
    if (game.huntSpawnTimer <= 0) spawnHuntMark();
  }
  if (game.mission && campaignTick(dt, skeletons, party)) return;
  if (game.arena) arenaTick(dt, skeletons, party);

  if (game.state === 'fight') {
    if (tutorial.wants('enemyNear')) {
      const foe = skeletons.find(s => alive.some(h => h.pos.distanceTo(s.pos) < 10));
      if (foe) tutorial.on('enemyNear', { enemy: foe, camera, fighting: () => game.state === 'fight' });
    }
    pressForward(dt, skeletons, party);
    reapStuckEnemies(dt, skeletons, alive);
    if (game.toSpawn > 0) {
      game.spawnTimer -= dt;
      const bossWaits = game.bossPending && game.toSpawn === 1 && skeletons.length > 4;   // o chefe só entra quando a onda diminui, sem chegar junto com ela
      if (game.spawnTimer <= 0 && !bossWaits) {
        if (spawnSkeleton()) {
          game.toSpawn--;
          game.spawnTimer = Math.max(0.3, 1.0 - game.phase * 0.05) * difficulty.interval;
        } else game.spawnTimer = 0.8 * difficulty.interval;
      }
    } else if (!skeletons.length && !captivePrisoner()) {   // o prisioneiro preso segura a fase
      if (game.mission && game.phase >= game.last) {
        let hp = 0, maxHp = 0;
        for (const h of party) { hp += Math.max(0, h.hp); maxHp += h.maxHp; }
        game.missionHpRatio = hp / Math.max(1, maxHp);
        const villager = game.villager;
        if (!game.rescueComplete) game.missionVillagerRatio = villager && villager.maxHp > 0
          ? Math.max(0, Math.min(1, villager.hp / villager.maxHp))
          : null;
      }
      showBanner(`✓ Fase ${game.phase}`, 2);
      tutorial.on('phaseCleared', { phase: game.phase });
      for (const h of party) {
        if (h.dead) {
          if (difficulty.reviveDelay && game.phase - h.diedIn < difficulty.reviveDelay) continue;   // ainda espera a fase seguinte
          h.revive();
        } else h.hp = Math.min(h.maxHp, h.hp + h.maxHp * difficulty.heal);
        h.gainXp(12);
        h.guardT = h.stanceT = 0;
        popText(h.pos, '♥', 'heal');
        h.busy = h.once('Cheer');
      }
      const v = game.villager;
      if (v && !v.dead) v.hp = Math.min(v.maxHp, v.hp + v.maxHp * difficulty.heal);
      for (const u of units) if (u.militia && !u.dead) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * difficulty.heal);
      game.state = 'cleared';
      clearDirectControlOrders();
      syncDirectControlUI();
      game.timer = 2.2;
    }
  } else if (game.state === 'cleared') {
    game.timer -= dt;
    if (game.timer <= 0) {
      if (game.phase >= game.last) return endGame(game.mission ? game.mission.ending || `Missão cumprida: ${game.mission.name}!` : 'Fases vencidas!', true);
      game.phase++;
      game.state = 'advance';
      clearDirectControlOrders();
      syncDirectControlUI();
      showRelicPick();
    }
  } else if (game.state === 'advance') {
    // o ponto da formação anda pela estrada e o grupo vai atrás
    const goal = world.anchorS(game.phase);
    game.guideS = Math.min(goal, game.guideS + MARCH * dt);
    for (const h of party) h.setAnchor(game.guideS);
    const formationReady = alive.every((h) => h.pos.distanceTo(h.post) < 0.6);
    // posto atrás de obstáculo ou espremido pelos vizinhos: depois de ADVANCE_WAIT s a fase começa mesmo assim
    game.advanceWaitT = game.guideS >= goal ? (game.advanceWaitT || 0) + dt : 0;
    if (game.guideS >= goal && (formationReady || game.mission?.goal.type === 'bosses' || game.advanceWaitT > ADVANCE_WAIT)) { game.advanceWaitT = 0; startPhase(); }
  }

  const missionNumber = game.mission ? MISSIONS.indexOf(game.mission) + 1 : 0;
  setText('wave', game.arena ? `Onda ${game.arena.wave}` : game.mission ? `M${missionNumber} · ${game.phase}/${game.last}` : `${game.phase}/${game.last}`);
  setTip('wave', game.arena ? `Onda ${game.arena.wave} · inimigos nível ${game.arena.tier}` : `${game.mission ? `Missão ${missionNumber} · ` : ''}Fase ${game.phase} de ${game.last}`);
  // totens, torre e prisioneiro seguram a fase: sem esqueletos comuns, o HUD diz o que falta
  const objective = game.state === 'fight' && !game.toSpawn && skeletons.every((s) => s.totem) ? objectiveHint(skeletons) : null;
  let foes = game.state === 'fight' ? game.toSpawn : 0;
  for (const s of skeletons) if (!s.totem) foes++;
  setText('left', objective || String(foes));
  $('left').classList.toggle('objective', !!objective);
  setTip('left', objective ? `Objetivo: ${objective}` : `${foes} inimigos restantes · ${game.kills} abates`);
  if (game.arena) { setText('left', String(game.kills)); setTip('left', `${game.kills} abates · ${foes} inimigos em campo`); }
  if (objective && game.objectiveCall !== game.phase) { game.objectiveCall = game.phase; showBanner(`${objective}!`, 2.5); }
  const militia = militiaAlive();
  if ($('militia').hidden !== !militia) $('militia').hidden = !militia;   // contador discreto: some sem milícia de pé
  if (militia) { setText('militia', String(militia)); setTip('militia', `Milícia: ${militia} ${militia === 1 ? 'aldeão armado' : 'aldeões armados'}`); }
}

function objectiveHint(skeletons) {
  if (skeletons.some((s) => s.tower)) return 'Derrube a torre';
  if (skeletons.length) return skeletons.length > 1 ? `Destrua os ${skeletons.length} totens` : 'Destrua o totem';
  return captivePrisoner() ? 'Liberte o prisioneiro' : null;
}

// nível e barra de XP de cada herói no fim (na equipe contínua, é o XP que segue para a próxima missão);
// `from`/`fromPct` vêm do começo da missão (game.startLevels) para a tela animar quem subiu de nível
function endTeamLevels(party, start = game.startLevels) {
  const pctOf = (level, xp) => {
    const from = XP_LEVELS[level - 1] ?? 0, to = XP_LEVELS[level];
    return to == null ? 100 : Math.max(0, Math.min(100, Math.round((xp - from) / Math.max(1, to - from) * 100)));
  };
  const levels = {};
  for (const h of party || []) {
    const before = start?.[h.cfg.id];
    levels[h.cfg.id] = { level: h.level, pct: pctOf(h.level, h.xp), name: heroLevelName(h.cfg, h.level),
      from: before ? before.level : h.level, fromPct: before ? pctOf(before.level, before.xp) : pctOf(h.level, h.xp) };
  }
  return levels;
}

// resumo da partida para a progressão entre partidas
function matchSummary(won, stars) {
  return {
    mode: game.mission ? 'mission' : 'interna', missionId: game.mission?.id || null, won, difficultyId: difficulty.id,
    kills: game.kills, start: game.start, last: game.last, phase: game.phase,
    phasesCleared: won ? game.last - game.start + 1 : Math.max(0, game.phase - game.start),
    stars: stars || 0, totalStars: totalStars(), falls: game.fallLog?.length || 0, partySize: heroes().length,
    heroes: (game.roster || []).map((h) => ({ id: h.cfg.id, kills: h.stats.abates })), ultimates: game.ultimates || 0, relics: game.relics?.length || 0,
  };
}

function endGame(text, won = false) {
  setDirectControlMode(false, null, false);
  tutorial.on('leave');
  game.over = true;
  syncDirectControlUI();
  closeHeroPanel();
  audio.stopMusic();
  audio.play(won ? 'victory' : 'defeat');
  $('overlayTitle').textContent = won ? 'Vitória!' : 'Derrota';
  $('overlayTitle').setAttribute('data-tip', text);
  $('overlayText').textContent = text;
  $('overlayNext').innerHTML = '';
  game.resultExtras = '';
  const missionIndex = MISSIONS.indexOf(game.mission);
  const followingWasOpen = missionIndex >= 0 && missionIndex + 1 < MISSIONS.length && unlocked(missionIndex + 1);
  const missionStars = game.mission ? missionEnd(won) : null;
  if (won && campaignTeamMode()) storeCampaignTeam(game.roster || heroes());   // a equipe leva o XP e as evoluções da vitória
  const following = missionIndex >= 0 && missionIndex + 1 < MISSIONS.length && unlocked(missionIndex + 1) ? MISSIONS[missionIndex + 1] : null;
  const nextUnstarredAfter = game.mission && won && !game.test
    ? MISSIONS.find((mission, index) => index > missionIndex && unlocked(index) && starsOf(mission.id) === 0) || null
    : null;
  // "Próxima": a primeira ainda sem estrelas; se todas à frente já têm, a seguinte (rejogar não tira o botão)
  const next = !won || game.test ? null : nextUnstarredAfter || following;
  const nextMission = won && nextUnstarredAfter?.name || null;   // o relatório fala do avanço, não de rejogar
  if (game.mission) {   // próximo passo: a missão recém-liberada (ou a seguinte) ou repetir a atual
    const replay = { replay: game.mission, team: (game.roster || []).map((h) => h.cfg), seed: world.seed, teamRun: campaignTeamMode() };
    $('overlayNext').innerHTML = missionNextHTML(won, next, next === following && following && !followingWasOpen);
    const nextBtn = $('overlayNext').querySelector('[data-act="next"]');
    if (nextBtn) nextBtn.onclick = () => startGame(next);
    const replayBtn = $('overlayNext').querySelector('[data-act="replay"]');
    if (replayBtn) replayBtn.onclick = () => startGame(replay);
  }
  const party = game.roster;
  const report = buildBattleReport({
    won,
    heroes: party.map((h) => ({ id: h.cfg.id, name: heroLevelName(h.cfg, h.level), damage: h.stats.dano, received: h.stats.recebido, kills: h.stats.abates })),
    falls: game.fallLog,
    damageSources: Object.values(game.damageSources),
    militia: game.militia?.size ? { size: game.militia.size, damage: game.militia.damage, kills: game.militia.kills, fallen: game.militia.fallen } : null,
    mission: game.mission ? {
      goal: game.mission.goal,
      time: game.missionT,
      bossDown: game.bossDown,
      bossSeen: game.bossSeen,
      phase: game.phase,
      bossPhase: nextBossPhase(game.phase, game.mission.boss) ?? game.mission.to,
      villagerDown: !!game.villager?.dead,
      totemsDown: game.totemsDown,
      surviveRemaining: game.surviveT,
      stars: won && !game.test ? missionStars : null,
      nextMission,
      remainingStars: won && !game.test && game.mission ? MISSIONS.length * 3 - totalStars() : null,
      maxStars: MISSIONS.length * 3,
      rescueComplete: game.rescueComplete,
      towersDown: game.towersDown,
      shrineDown: !!game.shrine?.dead,
      huntDown: game.huntDown,
      huntEscaped: game.huntEscaped,
      endlessTime: game.endlessT,
      leaks: game.leaks,
      eliteWave: game.eliteWave,
      bossesLeft: units.filter((u) => u.phaseBoss && !u.dead).length,
    } : null,
  });
  // ouro, maestria e conquistas (atalhos de teste não contam)
  const reward = game.test ? null : progress.recordMatch(matchSummary(won, missionStars));
  // à vista: estrelas, ouro, equipe e botões; motivo, recordes, medalha, conquistas e números ficam em "Detalhes"
  const achievements = reward ? achievementChipsHTML(reward.unlocked) : '';
  const detailsBody = `<p class="end-reason">${escAttr(text)}</p>`
    + (game.resultExtras || '') + (achievements ? `<div class="end-chips">${achievements}</div>` : '')
    + summaryHTML(party, report, { won, kills: game.kills, falls: game.fallLog?.length || 0 });
  $('overlayStats').innerHTML = `<details class="end-details"><summary>Detalhes</summary><div class="end-details-body">${detailsBody}</div></details>`;
  if (reward) {
    const mvp = party.length ? party.reduce((a, b) => (b.stats.dano + b.stats.abates * 40 > a.stats.dano + a.stats.abates * 40 ? b : a)) : null;
    $('overlayStars').innerHTML += rewardHTML(reward, VARIANTS, mvp?.cfg.id, endTeamLevels(party));
    toastAchievements(reward.unlocked);
  }
  const storageWarning = !game.test ? progressStorageWarning() : '';
  if (storageWarning) $('overlayStars').innerHTML += `<div class="storage-warning" role="status">${storageWarning}</div>`;
  $('overlayBtn').textContent = game.mission ? 'Mapa' : 'Menu';
  $('overlayBtn').setAttribute('aria-label', game.mission ? 'Voltar ao mapa' : 'Voltar ao menu');
  $('overlayBtn').hidden = false;
  const resultOverlay = $('overlay');
  resultOverlay.classList.add('results');
  resultOverlay.classList.toggle('won', Boolean(won));
  resultOverlay.classList.toggle('lost', !won);
  resultOverlay.classList.toggle('test-run', Boolean(game.test));
  resultOverlay.classList.remove('hidden');
}

function updateBars() {
  // These overlays sit behind menus and reports, so don't keep projecting units
  // or writing layout styles while the player is choosing or reading results.
  if (game.paused || game.over) return;
  const w = innerWidth / 2, h = innerHeight / 2;
  const marginX = 160 / innerWidth, marginY = 36 / innerHeight;
  for (const u of units) {
    if (u.dead) continue;
    tmp.copy(u.pos).setY(u.pos.y + (u.barHeight ?? 2.6 * u.size)).project(camera);
    const visible = tmp.z < 1 && Math.abs(tmp.x) <= 1 + marginX && Math.abs(tmp.y) <= 1 + marginY;
    const wasVisible = u.barVisible;
    if (wasVisible !== visible) {
      u.bar.style.display = visible ? '' : 'none';
      u.barVisible = visible;
    }
    if (!visible) continue;
    const x = tmp.x * w + w, y = -tmp.y * h + h;
    if (wasVisible !== true || u.barScreenX == null || Math.abs(x - u.barScreenX) >= 0.5 || Math.abs(y - u.barScreenY) >= 0.5) {
      u.bar.style.transform = `translate(${x}px, ${y}px)`;
      u.barScreenX = x;
      u.barScreenY = y;
    }
    const healthWidth = (u.hp / u.maxHp) * 100;
    if (u.barHealthWidth !== healthWidth) {
      u.bar.firstChild.style.width = `${healthWidth}%`;
      if (u.barTrail) u.barTrail.style.width = `${healthWidth}%`;
      u.barHealthWidth = healthWidth;
    }
  }
}

// ---------- laço principal ----------
const clock = new THREE.Clock();
// Buffers reutilizáveis do quadro: evita alocar arrays de unidades/alvos a 60 Hz.
const frameUnits = [], frameHeroes = [], frameFoes = [], frameNearFoes = [];
const frameFoeCenter = new THREE.Vector3();
const CAM_MIN_FIT = 17;   // mais perto que isso a briga sai da tela
let frameSpread = 0;
// o sol acompanha o grupo em passos de um texel do mapa de sombra (no plano da luz), senão as bordas das sombras tremem
const SUN_OFFSET = new THREE.Vector3(14, 30, 12);
// eixos da câmera de sombra (lookAt com "para cima" = y): direita = y × deslocamento, cima = deslocamento × direita
const sunRight = new THREE.Vector3(SUN_OFFSET.z, 0, -SUN_OFFSET.x).normalize();
const sunUp = new THREE.Vector3(-SUN_OFFSET.x * SUN_OFFSET.y, SUN_OFFSET.x ** 2 + SUN_OFFSET.z ** 2, -SUN_OFFSET.y * SUN_OFFSET.z).normalize();
const sunAt = new THREE.Vector3();
function placeSun(at) {
  const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  const x = at.dot(sunRight), y = at.dot(sunUp);
  sunAt.copy(at).addScaledVector(sunRight, Math.round(x / texel) * texel - x).addScaledVector(sunUp, Math.round(y / texel) * texel - y);
  sun.target.position.copy(sunAt);
  sun.position.copy(sunAt).add(SUN_OFFSET);
}
function frame() {
  requestAnimationFrame(frame);   // agenda antes: um erro no quadro não congela o jogo
  const frameMs = clock.getDelta() * 1000;
  const real = Math.min(frameMs / 1000, 0.05);
  if (typeof lowFpsMonitor !== 'undefined' && typeof fpsHintDismissed !== 'undefined' && !fpsHintDismissed) {
    const performanceActive = document.visibilityState === 'visible' && !game.paused && !game.over
      && !lowQuality && !loading.visible && !battleLoadingVisible;
    if (lowFpsMonitor.sample(frameMs, performanceActive)) fpsHint.hidden = false;
  }
  const dt = game.paused ? 0 : real * speed * FX.timeScale(real);   // hit-stop curtinho das ultimates
  if (dt > 0 && !game.over) game.runTime += dt;
  const updateCount = units.length;
  frameUnits.length = updateCount;
  for (let i = 0; i < updateCount; i++) frameUnits[i] = units[i];
  prepareAnimationCulling();
  if (game.state === 'fight' && !game.paused && !game.over) activeTargetContext = makeTargetContext(frameTargetContext);
  else {
    activeTargetContext = null;
    frameTargetContext.party.length = 0;
    frameTargetContext.rangedHeroes.length = 0;
    frameTargetContext.friends.length = 0;
    frameTargetContext.skeletons.length = 0;
    frameTargetContext.attackableSkeletons.length = 0;
    frameTargetContext.alliedUnits.length = 0;
    frameTargetContext.livingAllies.length = 0;
  }
  for (let i = 0; i < updateCount; i++) frameUnits[i].update(dt);
  animationCulling = false;   // fora do laço das unidades (testes, menu) o mixer volta a andar sempre
  frameUnits.length = 0;
  activeTargetContext = null;
  if (dt > 0 && !game.over) { separate(); if (geoWalls.length) for (const unit of units) pushFromGeoWalls(unit); }   // Muralha de pedra do Geomante
  updateBolts(dt);
  updateEnemyBolts(dt);
  updateFx(dt);
  popTextPool.update(performance.now());
  FX.update(dt);
  if (dt > 0) updateGame(dt);
  showEvolution();
  // câmera e sol acompanham o grupo, sem desfazer o giro que o jogador fez
  if (typeof menuStage === 'undefined' || !menuStage.tick(real)) followParty(real);   // no menu inicial: câmera de cinema e equipe em 3D
  controls.update();
  placeSun(follow);
  world.update(real, follow.z, camera);
  const gloom = world.gloomAt(follow.z);
  scene.background.lerpColors(world.sky != null ? daySky.setHex(world.sky) : SKY[0], SKY[1], gloom);
  scene.fog.color.copy(scene.background);
  scene.fog.near = 45 - gloom * 22;
  scene.fog.far = 110 - gloom * 45;
  hemi.color.lerpColors(HEMI[0], HEMI[1], gloom);
  hemi.groundColor.lerpColors(HEMI_GROUND[0], HEMI_GROUND[1], gloom);
  hemi.intensity = 1.35 - gloom * 0.3;   // menos luz ambiente e sol mais forte: sombras marcadas
  sun.color.lerpColors(world.sunTint != null ? daySun.setHex(world.sunTint) : SUN[0], SUN[1], gloom);
  sun.intensity = 3.1 - gloom * 1.4;
  const moveMarker = directControl.enabled ? directControl.moveTarget : null;
  const attackMarker = directControl.enabled ? directControl.attackTarget : null;
  const sel = attackMarker || (moveMarker ? null : panelHero() || directControl.hero);
  selectRing.visible = !!moveMarker || !!sel && !sel.dead && units.includes(sel);
  if (selectRing.visible) {
    if (moveMarker) selectRing.position.copy(moveMarker).setY(world.groundHeight(moveMarker.x, moveMarker.z) + 0.06);
    else selectRing.position.copy(sel.pos).setY(sel.pos.y + 0.06);
    selectRing.material.color.setHex(attackMarker ? 0xff655e : moveMarker ? 0x71e6ff : 0xffe066);
    selectRing.scale.setScalar(attackMarker ? Math.max(1, attackMarker.size || 1) : 1);
    selectRing.rotation.z += real * 1.5;
  }
  tickHeroPanel(real);
  const kick = FX.jolt(real);   // tremida dos golpes fortes, só no quadro desenhado
  camera.position.add(kick);
  if (!loading.visible) renderer.render(scene, camera);   // atrás da tela de carregamento não desenha: compileAsync compila sem travar
  camera.position.sub(kick);
  updateBars();
  updateSkillBar();
  updateAim();
  audio.setGloom(world.gloomAt(follow.z));   // música mais sombria rumo ao castelo
}

// enquadra o grupo e a briga por perto
function followParty(real) {
  frameHeroes.length = 0;
  frameFoes.length = 0;
  let bossVisible = false;
  for (const unit of units) {
    if (unit.dead) continue;
    if (unit.team === 'hero') frameHeroes.push(unit);
    else if (game.state === 'fight' && unit.team === 'skeleton' && !unit.spawning) {
      frameFoes.push(unit);
      if (unit.boss) bossVisible = true;
    }
  }
  frameNearFoes.length = 0;
  frameSpread = 0;   // sem heróis vivos, a câmera não guarda o enquadramento da última briga
  if (frameHeroes.length) {
    tmp.set(0, 0, 0);
    for (const h of frameHeroes) tmp.add(h.pos);
    tmp.divideScalar(frameHeroes.length);
    tmp.z -= 3;
    // na luta o enquadramento puxa um pouco para os inimigos próximos, para mostrar os dois lados
    for (const foe of frameFoes) if (foe.pos.distanceTo(tmp) < 14) frameNearFoes.push(foe);
    if (frameNearFoes.length) {
      frameFoeCenter.set(0, 0, 0);
      for (const foe of frameNearFoes) frameFoeCenter.add(foe.pos);
      frameFoeCenter.divideScalar(frameNearFoes.length);
      tmp.lerp(frameFoeCenter, 0.3);
    }
    // quanto o grupo e a briga se espalham: a câmera nunca fica perto demais para mostrar todos
    for (const u of frameHeroes) frameSpread = Math.max(frameSpread, u.pos.distanceTo(tmp));
    for (const u of frameNearFoes) frameSpread = Math.max(frameSpread, u.pos.distanceTo(tmp));
    follow.lerp(tmp, Math.min(1, real * 2));
  }
  tmp.subVectors(follow, controls.target);
  controls.target.add(tmp);
  camera.position.add(tmp);
  // zoom cinematográfico em cima do zoom do jogador: perto na luta, longe andando, aberto com chefe
  const wantZoom = bossVisible ? 1.05 : frameFoes.length ? 0.92 : game.state === 'advance' ? 1.05 : 1;
  cam.zoom += (wantZoom - cam.zoom) * Math.min(1, real * 1.5);
  const offset = tmp.subVectors(camera.position, controls.target);
  if (cam.userDist === 0) cam.userDist = offset.length();
  const fit = Math.max(CAM_MIN_FIT, frameSpread * 2.6);   // distância que ainda mostra todo mundo
  cam.fit = (cam.fit || fit) + (fit - (cam.fit || fit)) * Math.min(1, real * 2);
  // depois que o jogador usa a roda, o zoom dele vale mesmo que alguém fique fora do quadro
  const want = cam.manual ? cam.userDist * cam.zoom : Math.max(cam.userDist * cam.zoom, cam.fit);
  offset.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, want)));
  camera.position.copy(controls.target).add(offset);
}

// Mira manual: alcance azul, alvo válido verde e alvo inválido vermelho.
let aiming = null;
const aimRay = new THREE.Raycaster();
const aimPointer = new THREE.Vector2();
const aimScreen = new THREE.Vector3();
const aimGroundHit = new THREE.Vector3();
// Reused while the cursor moves over terrain. It is safe to hand this to a
// skill because a successful cast closes the aim before the next frame.
const aimGroundTarget = { pos: new THREE.Vector3(), dead: false, size: 1, groundTarget: true };
const aimGroup = new THREE.Group();
const aimMaterial = new THREE.MeshBasicMaterial({ color: 0x73d4ff, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
const aimRange = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 80), aimMaterial);
const aimArea = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), aimMaterial.clone());
aimRange.rotation.x = aimArea.rotation.x = -Math.PI / 2;
const aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x75ffad, depthTest: false, transparent: true, opacity: 0.9 }));
aimGroup.add(aimRange, aimArea, aimLine);
aimGroup.visible = false;
aimGroup.renderOrder = 10;
scene.add(aimGroup);
const aimHint = document.createElement('div');
aimHint.id = 'aimHint';
aimHint.setAttribute('role', 'status');
aimHint.hidden = true;
document.body.appendChild(aimHint);
// dica curta: alvo e alcance; Esc ou botão direito cancelam (só desktop)
const aimMessage = (hero, spec) => `${hero.cfg.ability} · ${spec.mode === 'enemy' ? 'Inimigo' : 'Chão'} · ${spec.range.toLocaleString('pt-BR')} m · Esc`;

function cancelAim() {
  if (aiming) controls.enabled = aiming.controlsEnabled;
  aiming = null;
  aimGroup.visible = false;
  aimHint.hidden = true;
  renderer.domElement.style.cursor = '';
}

function beginAim(hero) {
  cancelAim();
  hero.wantSkill = 0;
  hero.manualTarget = null;
  const spec = aimSpec(hero);
  const baseMessage = aimMessage(hero, spec);
  aiming = {
    hero,
    controlsEnabled: controls.enabled,
    pointerX: null,
    pointerY: null,
    target: null,
    spec,
    specLevel: hero.level,
    specPower: hero.skillPower,
    baseMessage,
    hintState: null,
  };
  controls.enabled = false;
  renderer.domElement.style.cursor = 'crosshair';
  aimHint.hidden = false;
  updateAim();
}

function updateAim() {
  if (!aiming) return;
  const h = aiming.hero;
  if (h.auto || h.dead || !units.includes(h) || game.paused || game.over || game.state !== 'fight' || h.skillTimer > 0) return cancelAim();
  if (aiming.specLevel !== h.level || aiming.specPower !== h.skillPower) {
    aiming.spec = aimSpec(h);
    aiming.specLevel = h.level;
    aiming.specPower = h.skillPower;
    if (aiming.spec) {
      aiming.baseMessage = aimMessage(h, aiming.spec);
      aiming.hintState = null;
    }
  }
  const spec = aiming.spec;
  if (!spec) return cancelAim();
  aimGroup.visible = true;
  aimRange.position.copy(h.pos).setY(h.pos.y + 0.12);
  aimRange.scale.setScalar(spec.range);
  let target = null;
  if (aiming.pointerX != null && aiming.pointerY != null) {
    const pointerX = aiming.pointerX, pointerY = aiming.pointerY;
    aimPointer.set(pointerX / innerWidth * 2 - 1, -(pointerY / innerHeight) * 2 + 1);
    aimRay.setFromCamera(aimPointer, camera);
    if (spec.mode === 'enemy') {
      let best = 45;
      for (const enemy of units) {
        if (enemy.team !== 'skeleton' || enemy.dead || enemy.spawning) continue;
        aimScreen.copy(enemy.pos);
        aimScreen.y += enemy.size;
        aimScreen.project(camera);
        if (aimScreen.z < -1 || aimScreen.z > 1) continue;
        const distance = Math.hypot((aimScreen.x + 1) * innerWidth / 2 - pointerX,
          (1 - aimScreen.y) * innerHeight / 2 - pointerY);
        if (distance < best) { best = distance; target = enemy; }
      }
    } else {
      // Procura a primeira interseção com a altura lógica do terreno (margem dos lagos).
      if (findGroundAimHit(aimRay.ray, world.groundHeight, aimGroundHit)) {
        aimGroundTarget.pos.copy(aimGroundHit);
        target = aimGroundTarget;
      }
    }
  }
  aiming.target = target;
  const valid = validAim(h, target);
  aimArea.visible = aimLine.visible = !!target;
  if (target) {
    aimArea.position.copy(target.pos).setY(target.pos.y + 0.13);
    aimArea.scale.setScalar(spec.radius || 0.4);
    aimArea.material.color.setHex(valid ? 0x75ffad : 0xff6666);
    const positions = aimLine.geometry.attributes.position;
    positions.setXYZ(0, h.pos.x, h.pos.y + 0.15, h.pos.z);
    positions.setXYZ(1, target.pos.x, target.pos.y + 0.15, target.pos.z);
    positions.needsUpdate = true;
    aimLine.geometry.computeBoundingSphere();
    aimLine.material.color.copy(aimArea.material.color);
  }
  const hintState = target && !valid ? 'invalid' : target ? 'valid' : 'empty';
  if (aiming.hintState !== hintState) {
    aiming.hintState = hintState;
    aimHint.textContent = `${aiming.baseMessage}${hintState === 'invalid' ? ' · ✕ Fora' : ''}`;
  }
}

renderer.domElement.addEventListener('pointermove', (e) => {
  directControl.pointerX = e.clientX;
  directControl.pointerY = e.clientY;
  if (aiming) { aiming.pointerX = e.clientX; aiming.pointerY = e.clientY; }
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 2) return;
  if (aiming) {
    e.preventDefault();
    e.stopImmediatePropagation();
    cancelAim();
    return;
  }
  if (!isDirectControlActive(directControl.hero)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  directControl.commandDownAt = [e.clientX, e.clientY];
  renderer.domElement.setPointerCapture?.(e.pointerId);
}, true);
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointercancel', () => { directControl.commandDownAt = null; });

// clicar num herói abre o cartão dele (clique sem arrastar, para não brigar com o giro da câmera)
const selectRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 6), new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
selectRing.rotation.x = -Math.PI / 2;
selectRing.visible = false;
scene.add(selectRing);
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  const hero = directControl.hero;
  if (e.button === 2 && directControl.commandDownAt) {
    const start = directControl.commandDownAt;
    directControl.commandDownAt = null;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!isDirectControlActive(hero) || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) return;
    directControl.pointerX = e.clientX;
    directControl.pointerY = e.clientY;
    const destination = directControlGroundUnderPointer();
    if (destination) issueDirectMoveCommand(hero, destination);
    return;
  }
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  directControl.pointerX = e.clientX;
  directControl.pointerY = e.clientY;
  if (aiming) {
    aiming.pointerX = e.clientX;
    aiming.pointerY = e.clientY;
    updateAim();
    if (!aiming) return;
    const { hero, target } = aiming;
    if (!validAim(hero, target)) { audio.play('click'); return; }
    // Ground preview is shared scratch state; snapshot it for the delayed cast.
    const committedTarget = target?.groundTarget
      ? { pos: target.pos.clone(), dead: false, size: 1, groundTarget: true }
      : target;
    const result = hero.requestSkill(committedTarget);
    if (result === 'ok') cancelAim();
    return;
  }
  if (isDirectControlActive(directControl.hero)) {
    const enemy = directControlEnemyUnderPointer();
    if (enemy && issueDirectAttackCommand(directControl.hero, enemy)) return;
  }
  let best = null, bestD = 50;   // herói mais perto do clique na tela, até 50 px
  for (const h of heroes()) {
    tmp.copy(h.pos).setY(h.pos.y + 1).project(camera);
    const d = Math.hypot((tmp.x * 0.5 + 0.5) * innerWidth - e.clientX, (-tmp.y * 0.5 + 0.5) * innerHeight - e.clientY);
    if (d < bestD) { bestD = d; best = h; }
  }
  if (best) {
    openHeroPanel(best, XP_LEVELS);
    if (directControl.enabled && best !== directControl.hero) setDirectControlMode(true, best, false);
  }
  else if (panelHero()) closeHeroPanel();
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (aiming) { cancelAim(); return; }
  closeHeroPanel();
  if (!$('campaign').classList.contains('hidden')) { campaignMapSession.reset(); showMenu(); }   // Esc no mapa volta ao menu
  if (!$('camp').classList.contains('hidden')) showMenu();   // e no acampamento também
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  frameView();
});
// a barra de habilidades cobre o pé da tela: o centro da câmera sobe para o meio da área livre,
// assim os heróis não ficam escondidos atrás dela
function frameView() {
  const bar = $('skills'), cover = bar.offsetHeight ? Math.max(0, innerHeight - bar.getBoundingClientRect().top) : 0;
  camera.aspect = innerWidth / (innerHeight + cover);
  if (cover) camera.setViewOffset(innerWidth, innerHeight + cover, 0, cover, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(frameView).observe($('skills'));

// ---------- palco 3D do menu inicial ----------
// Câmera baixa na estrada olhando a vila ao longe, com a equipe da campanha parada na frente (modelos reais em idle).
// Só existe enquanto o menu de modos está aberto; ao sair, a câmera volta ao ângulo de jogo (aimCamera).
// Clicar num herói abre o Acampamento (maestria e oficina dos heróis). Custo: 4 modelos e 4 mixers, sem física.
const menuStage = (() => {
  const pickEl = $('pick');
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const ringGeo = new THREE.RingGeometry(0.62, 0.8, 40);
  let actors = [], squadKey = '', active = false, t = 0, hover = -1;
  const camBase = new THREE.Vector3(), lookBase = new THREE.Vector3(), side = new THREE.Vector3();
  const pointer = { x: 0, y: 0, on: false };
  const tag = document.createElement('div');
  tag.className = 'menu-hero-tag';
  tag.hidden = true;
  pickEl.appendChild(tag);
  const p1 = new THREE.Vector3(), p2 = new THREE.Vector3();

  const free = (e) => !e.target.closest?.('.menu-btn, .menu-bar, button, [role="button"]');
  pickEl.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = active && free(e); });
  pickEl.addEventListener('pointerleave', () => { pointer.on = false; });
  pickEl.addEventListener('click', (e) => {
    if (!active || hover < 0 || !free(e) || !pick.open || pick.mode !== 'mode') return;
    audio.play('click');
    confirmPick(2);   // Acampamento: maestria e melhorias da equipe
  });

  function build(squad) {
    for (const a of actors) { group.remove(a.root); disposeSkeletons(a.root); }
    actors = squad.map((cfg) => {
      const model = SkeletonUtils.clone(cfg.built.scene);
      model.traverse((o) => {
        if (cfg.hide.includes(o.name)) o.visible = false;
        if (o.isMesh) { o.castShadow = !/_Eyes$/.test(o.name); o.frustumCulled = false; }
      });
      const root = new THREE.Group();
      model.scale.setScalar(cfg.scale || 1);
      model.position.y = cfg.id === 'angel' ? 0.52 : 0;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: cfg.color[0], transparent: true, opacity: 0, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      root.add(model, ring);
      const mixer = new THREE.AnimationMixer(model);
      const clip = THREE.AnimationClip.findByName(cfg.built.animations, cfg.idle);
      if (clip) mixer.clipAction(clip).play();
      mixer.update(Math.random() * 2);   // cada um num ponto do idle
      group.add(root);
      return { cfg, root, model, ring, mixer, lift: 0, height: 2.1 * (cfg.scale || 1) };
    });
  }

  // posições a partir da estrada do mundo atual: heróis em leque, câmera atrás deles na altura do peito
  function place() {
    const s0 = game.guideS + 2;
    const base = world.pointAt(s0), fwd = world.tangentAt(s0);
    side.copy(world.sideOf(fwd));
    const lat = [-2.9, -0.95, 0.95, 2.9].slice(0, actors.length);
    if (actors.length < 4) lat.forEach((_, i) => { lat[i] = (i - (actors.length - 1) / 2) * 1.9; });
    actors.forEach((a, i) => {
      const p = world.along(s0 + Math.abs(lat[i]) * 0.28, lat[i]);
      p.y = world.groundHeight(p.x, p.z);
      a.root.position.copy(p);
      a.baseY = p.y;
      // de frente para a câmera, um pouco virados para o meio
      a.root.rotation.y = Math.atan2(-fwd.x, -fwd.z) - lat[i] * 0.07;
    });
    camBase.copy(base).addScaledVector(fwd, -11.5);
    camBase.y = world.groundHeight(camBase.x, camBase.z) + 3.4;
    lookBase.copy(base).addScaledVector(fwd, 5);
    lookBase.y = base.y + 1.15;
  }

  function enter() {
    active = true;
    t = 0;
    const squad = menuSquad();
    const key = squad.map((cfg) => cfg.id).join();
    if (key !== squadKey) { squadKey = key; build(squad); }
    place();
    group.visible = true;
    camera.position.copy(camBase);
    controls.target.copy(lookBase);
  }

  function leave() {
    active = false;
    hover = -1;
    pointer.on = false;
    group.visible = false;
    tag.hidden = true;
    pickEl.style.cursor = '';
    aimCamera(game.guideS);   // volta ao ângulo de jogo
  }

  // quem está sob o cursor: caixa do herói projetada na tela (sem raycast em malha com esqueleto)
  function pickHover() {
    if (!pointer.on) return -1;
    let best = -1, bestDist = Infinity;
    actors.forEach((a, i) => {
      p1.copy(a.root.position).project(camera);
      p2.copy(a.root.position).setY(a.root.position.y + a.height).project(camera);
      const x = (p1.x + 1) / 2 * innerWidth, yFoot = (1 - p1.y) / 2 * innerHeight, yHead = (1 - p2.y) / 2 * innerHeight;
      const half = (yFoot - yHead) * 0.3;
      const dx = Math.abs(pointer.x - x);
      if (dx < half && pointer.y > yHead && pointer.y < yFoot && dx < bestDist) { best = i; bestDist = dx; }
    });
    return best;
  }

  return {
    tick(real) {
      const on = pick.mode === 'mode' && !pickEl.classList.contains('hidden') && !game.mission;
      if (!on) { if (active) leave(); return false; }
      if (!active) enter();
      t += real;
      const calm = calmMotion?.matches;
      // câmera: deslize lento de um lado ao outro e respiração de aproximação
      const sway = calm ? 0 : Math.sin(t * 0.11) * 1.6, breathe = calm ? 0 : Math.sin(t * 0.07) * 0.6;
      camera.position.copy(camBase).addScaledVector(side, sway).addScaledVector(tmp.subVectors(lookBase, camBase).setY(0).normalize(), breathe);
      controls.target.copy(lookBase).addScaledVector(side, sway * 0.35);
      hover = pick.open ? pickHover() : -1;
      pickEl.style.cursor = hover >= 0 ? 'pointer' : '';
      actors.forEach((a, i) => {
        a.mixer.update(real);
        const want = i === hover ? 1 : 0;
        a.lift += (want - a.lift) * Math.min(1, real * 10);
        a.root.position.y = a.baseY + a.lift * 0.18;
        a.root.scale.setScalar(1 + a.lift * 0.06);
        a.ring.material.opacity = a.lift * 0.85;
      });
      if (hover >= 0) {
        const a = actors[hover];
        p1.copy(a.root.position).setY(a.root.position.y + a.height + 0.35).project(camera);
        tag.textContent = a.cfg.name;
        tag.style.left = `${(p1.x + 1) / 2 * innerWidth}px`;
        tag.style.top = `${(1 - p1.y) / 2 * innerHeight}px`;
      }
      tag.hidden = hover < 0;
      return true;
    },
  };
})();

// ?bench=1: medição de desempenho (bench.js) — monta uma partida interna (fases 1–12, sem missão) com 4 heróis sem passar pelos menus
const benchApi = () => ({
  renderer, scene, game, units, heroes, world, VARIANTS, frame, spawnSkeleton, withBattleAssets,
  // O adaptador só é criado quando ?bench está ativo. O setter troca a função
  // lexical chamada pelo frame para permitir medi-la sem ramificação no jogo.
  get updateBars() { return updateBars; },
  set updateBars(fn) { updateBars = fn; },
  isLowQuality: () => lowQuality,
  getShadowMapSize: () => sun.shadow.mapSize.x,
  setShadowMapSize(size) {
    sun.shadow.mapSize.set(size, size);
    sun.shadow.needsUpdate = true;
  },
  setupRun(phase) {
    clearTimeout(pick.timer);
    pick.open = false;
    $('pick').classList.add('hidden');
    game.mission = null;
    difficulty = DIFFICULTIES[1];
    placeParty(phase);
  },
  addHero(cfg) {
    const h = new Hero(cfg);
    arrangeParty();
    h.gainXp(XP_LEVELS[2]);
    autoUpgrade();
    h.pos.copy(h.post);
    return h;
  },
  beginBattle() {
    $('overlay').classList.add('hidden');
    document.body.classList.remove('no-battle');
    game.paused = false;
    startPhase();
  },
  jumpToPhase(phase) {
    while (skeletonsAlive().length) skeletonsAlive()[0].remove();
    game.phase = phase;
    game.guideS = world.anchorS(phase);
    for (const h of heroes()) { h.setAnchor(game.guideS); h.pos.copy(h.post); }
    startPhase();
  },
});

try {
  await loadAssets();
  preparePortraits();
  startGame();
  frame();
  await warmStage((f) => loading.progress(0.8 + 0.2 * f), false);   // shaders do cenário do menu
  loading.hide();
  if (new URLSearchParams(location.search).has('bench')) (await import('./bench.js')).runBench(benchApi()).catch((e) => console.error('bench:', e));
} catch (error) {
  console.error('Falha ao iniciar o jogo:', error);
  loading.hide({ immediate: true });
  $('overlayText').textContent = 'Não foi possível carregar o jogo. Verifique sua conexão e tente novamente.';
  $('overlay').classList.remove('hidden');
  $('overlayBtn').textContent = 'Tentar novamente';
  $('overlayBtn').hidden = false;
  $('overlayBtn').onclick = () => location.reload();
}
