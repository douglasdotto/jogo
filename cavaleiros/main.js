import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWorld, biomeForSeed } from './world.js';
import { CHARACTERS, CHARACTER_ASSETS, buildCharacter, applyLook } from './characters.js';
import { LOOKS } from './looks.js';
import { CLASSES, heroInfo, teamCoverage, missionRoleNeeds } from './class-info.js';
import { cooldownForSkill, skillSetFor } from './skillbook.js';
import { aimSpec, validAim, findGroundAimHit } from './skill-targeting.js';
import { synergyDamageMultiplier, synergyDamageTakenMultiplier, SYNERGIES } from './synergies.js';
import { EVOLUTION_BRANCHES, applyEvolutionBranch, scaleBranchEffect } from './upgrade-branches.js';
import { buildBattleReport } from './battle-report.js';
import { newStats, openHeroPanel, closeHeroPanel, panelHero, tickHeroPanel, summaryHTML } from './stats.js';
import * as audio from './audio.js';
import { initTooltips, registerTooltip, hideTooltip } from './tooltip.js';
import { logoSVG } from './logo.js';
import { tutorial } from './tutorial.js';
import { MISSIONS, createCampaignMapSeedSession, goalText, starConditions, starsFor, saveStars, saveMissionRecord, saveMissionMedal, missionMedal, renderCampaign, totalStars, starsOf, unlocked, variantOpen, starsToUnlock, UNLOCKS, allOpen, campaignCosmetics, equippedCampaignCosmetic, equipCampaignCosmetic, formatMissionRecordTime, campaignStorageIsVolatile, campaignStorageWasCorrupted, campaignCorruptBackupFailed } from './campaign.js';
import { materialPool } from './fx-pool.js';
import { createPopTextPool } from './pop-text-pool.js';
import { createCampaignAura } from './campaign-aura.js';
import { disposeSkeletons, gridCellKey } from './scene-perf.js';
import { createProgression, renderCamp, rewardHTML, toastAchievements, GOLD, MASTERY_PERKS, UPGRADES } from './progression.js';
import { vfxMesh, spriteGeometry, radialSpriteGeometry, SPRITE, tickVfx, setVfxQuality } from './vfx-shaders.js';
import { startKingdom, linkKingdom } from './kingdom.js';
import { MONSTER_TYPES, linkMonsters, monsterDied, updateMonsterFx, clearMonsterFx, dangerAt, pickMonster, waveLeader, campaignThreats, isBossPhase, absorbWard } from './monsters.js';

const ROAD = 5;             // metade da largura da estrada
const PHASES = 12;          // a última fase fica no topo, no castelo
const MAX_PARTY = 4;
const LEASH = 5;            // quanto o herói se afasta do posto para lutar
const ENGAGE_SLACK = 3;     // folga extra para não largar um alvo já engajado (evita ir e voltar)
const RANGED_INTERCEPT = 20; // cobre o surgimento à frente e a largura da formação, sem perseguição pelo mapa
const RANGED_INTERCEPTORS = 2;
const TWIN_BOSS_INTERCEPT = 16; // dois heróis podem pressionar o chefe móvel sem arrastar a equipe
const TWIN_BOSS_INTERCEPTORS = 2;
const DEFENSE_CLEANUP_INTERCEPT = 22; // depois do cronômetro, a âncora pode limpar os inimigos que sobraram
const MARCH = 2.4;          // velocidade do grupo andando pela estrada entre as fases

// A classe fornece os atributos básicos; os postos são distribuídos ao entrar.
const HEROES = [
  { name: 'Cavaleiro', model: 'Knight', post: [0, -0.8], hp: 240, dmg: 30, range: 1.5, speed: 3.2, cooldown: 0.85, idle: 'Idle', attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'],
    weapons: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'] },
  { name: 'Bárbaro', model: 'Barbarian', post: [-1.7, -0.3], hp: 260, dmg: 34, range: 1.7, speed: 2.8, cooldown: 1.4, idle: '2H_Melee_Idle', cleave: 2.2, attacks: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'],
    weapons: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'] },
  { name: 'Mago', model: 'Mage', post: [0, 1.4], hp: 150, dmg: 28, range: 7, speed: 2.6, cooldown: 1.3, idle: 'Idle', ranged: true, splash: 1.4, attacks: ['Spellcast_Shoot'],
    weapons: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'] },
  { name: 'Ladino', model: 'Rogue', post: [1.7, -0.3], hp: 180, dmg: 18, range: 1.4, speed: 4, cooldown: 0.55, idle: 'Idle', attacks: ['Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab'],
    weapons: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'] },
  { name: 'Suporte', model: 'Mage', post: [-1.7, 0.1], hp: 225, dmg: 27, range: 5, speed: 3, cooldown: 1.2, idle: 'Idle', ranged: true, attacks: ['Spellcast_Shoot'],
    weapons: ['2H_Staff'] },
];
// As receitas substituem o modelo e as peças da classe.
const VARIANTS = [
  { id: 'paladin', names: ['Paladino', 'Paladino Real', 'Santo Guerreiro'], desc: 'Cura os amigos próximos.', ability: 'Círculo de cura', color: ['#a9e9bc', '#55a77b'],
    use: ['1H_Sword', 'Round_Shield'], stats: { Vida: 5, Força: 3, Rapidez: 3, Alcance: 1 }, classId: 0 },
  { id: 'guardian', names: ['Guardião', 'Guardião Real', 'Muralha Viva'], desc: 'Atrai inimigos e reduz o dano.', ability: 'Provocar', color: ['#9fcfff', '#568ccc'],
    use: ['1H_Sword', 'Rectangle_Shield'], stats: { Vida: 5, Força: 2, Rapidez: 2, Alcance: 1 }, hp: 300, dmg: 28, classId: 0 },
  { id: 'champion', names: ['Campeão', 'Campeão Real', 'Lâmina Solar'], desc: 'Gira e empurra os inimigos.', ability: 'Turbilhão', color: ['#ffe59b', '#c99a3e'],
    use: ['2H_Sword'], stats: { Vida: 4, Força: 5, Rapidez: 3, Alcance: 2 }, dmg: 32, cooldown: 1.05, idle: '2H_Melee_Idle', attacks: ['2H_Melee_Attack_Slice'], classId: 0 },
  { id: 'berserker', names: ['Berserker', 'Fera Rubra', 'Fúria Titã'], desc: 'Pouca vida, golpes mais rápidos.', ability: 'Fúria', color: ['#ffb2b2', '#ce5f63'],
    use: ['1H_Axe', '1H_Axe_Offhand'], stats: { Vida: 4, Força: 4, Rapidez: 4, Alcance: 1 }, hp: 220, dmg: 30, cooldown: 0.95, cleave: 0, attacks: ['Dualwield_Melee_Attack_Slice'], classId: 1 },
  { id: 'crusher', names: ['Esmagador', 'Quebra-rochas', 'Abala-terra'], desc: 'Pancada que deixa todos zonzos.', ability: 'Terremoto', color: ['#ffbf8a', '#d88950'],
    use: ['2H_Axe'], stats: { Vida: 5, Força: 5, Rapidez: 2, Alcance: 2 }, dmg: 31, classId: 1 },
  { id: 'viking', names: ['Viking', 'Jarl Valente', 'Rei do Norte'], desc: 'Arremessa um machado à distância.', ability: 'Machado voador', color: ['#b8dfe5', '#5b9dab'],
    use: ['1H_Axe', 'Barbarian_Round_Shield'], stats: { Vida: 5, Força: 4, Rapidez: 3, Alcance: 3 }, cleave: 0, idle: 'Idle', attacks: ['1H_Melee_Attack_Chop'], classId: 1 },
  { id: 'pyro', names: ['Piromante', 'Chama Viva', 'Fênix Solar'], desc: 'Bolas de fogo deixam chamas no chão.', ability: 'Chão em chamas', color: ['#ffc6a4', '#dc8757'],
    use: [], stats: { Vida: 2, Força: 5, Rapidez: 2, Alcance: 5 }, dmg: 22, splash: 1.1, classId: 2 },
  { id: 'arcane', names: ['Arcano', 'Sábio Astral', 'Mestre Estelar'], desc: 'Um raio salta entre os inimigos.', ability: 'Raio em cadeia', color: ['#d4b3ff', '#9a6be0'],
    use: ['Spellbook_open', '1H_Wand'], stats: { Vida: 2, Força: 4, Rapidez: 3, Alcance: 5 }, dmg: 24, splash: 0, cooldown: 1.05, classId: 2 },
  { id: 'cryo', names: ['Criomante', 'Sábio Glacial', 'Coração Polar'], desc: 'Gelo deixa os esqueletos lentinhos.', ability: 'Onda de gelo', color: ['#b9efff', '#58aaca'],
    use: ['1H_Wand'], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 5 }, hp: 170, dmg: 24, splash: 0.8, cooldown: 1.2, classId: 2 },
  { id: 'assassin', names: ['Assassino', 'Sombra Ágil', 'Sombra Real'], desc: 'Golpes críticos e esquivas ligeiras.', ability: 'Passo das sombras', color: ['#d1b7df', '#9974b5'],
    use: ['Knife', 'Knife_Offhand'], stats: { Vida: 3, Força: 5, Rapidez: 5, Alcance: 1 }, dmg: 21, classId: 3 },
  { id: 'crossbow', names: ['Besteiro', 'Mira de Águia', 'Flecha Real'], desc: 'Virotes atravessam a fila.', ability: 'Tiro perfurante', color: ['#c9eaa4', '#84ac50'],
    use: ['2H_Crossbow'], stats: { Vida: 3, Força: 4, Rapidez: 3, Alcance: 5 }, ranged: true, range: 7, cooldown: 1.05, attacks: ['2H_Ranged_Shoot'], classId: 3 },
  { id: 'ninja', names: ['Ninja', 'Vento Noturno', 'Lua Silenciosa'], desc: 'Lança três adagas em leque.', ability: 'Leque de adagas', color: ['#b6c5f4', '#768ac6'],
    use: ['Knife', 'Throwable'], stats: { Vida: 3, Força: 3, Rapidez: 5, Alcance: 4 }, model: 'Rogue_Hooded', classId: 3 },
  { id: 'duelist', names: ['Duelista', 'Lâmina Dupla', 'Mestre das Lâminas'], desc: 'Duas espadas curtas em cortes velozes.', ability: 'Rajada de lâminas', color: ['#dfe6ee', '#8394aa'],
    use: ['1H_Sword', '1H_Sword_Offhand'], stats: { Vida: 3, Força: 4, Rapidez: 5, Alcance: 1 }, dmg: 18, cooldown: 0.5, attacks: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'], classId: 3 },
  { id: 'king', names: ['Rei Dourado', 'Rei Radiante', 'Imperador Solar'], desc: 'Seu brado fortalece todo o grupo.', ability: 'Brado real', color: CHARACTERS[2].color,
    recipe: CHARACTERS[2], classId: 0, dmg: 28, idle: '2H_Melee_Idle', attacks: ['2H_Melee_Attack_Slice'], stats: { Vida: 5, Força: 3, Rapidez: 3, Alcance: 1 } },
  { id: 'iceviking', names: ['Viking do Gelo', 'Jarl Glacial', 'Rei das Geleiras'], desc: 'Seu machado congela uma área.', ability: 'Machado glacial', color: CHARACTERS[3].color,
    recipe: CHARACTERS[3], classId: 1, dmg: 29, stats: { Vida: 5, Força: 4, Rapidez: 2, Alcance: 3 } },
  { id: 'necro', names: ['Necromante', 'Senhor dos Ossos', 'Soberano Espectral'], desc: 'Invoca dois esqueletinhos amigos.', ability: 'Amigos do além', color: CHARACTERS[1].color,
    recipe: CHARACTERS[1], classId: 2, dmg: 24, splash: 0, stats: { Vida: 2, Força: 3, Rapidez: 2, Alcance: 5 } },
  { id: 'druid', names: ['Druida', 'Guardião do Bosque', 'Espírito da Floresta'], desc: 'Raízes prendem e a natureza cura.', ability: 'Abraço da floresta', color: CHARACTERS[0].color,
    recipe: CHARACTERS[0], classId: 4, pickGroup: 'druida', hp: 180, speed: 3, ranged: true, range: 6, dmg: 21, cooldown: 1, attacks: ['Spellcast_Shoot'], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 4 } },
  { id: 'cleric', names: ['Clériga', 'Sacerdotisa', 'Santa Guardiã'], desc: 'Orações curam e fortalecem quem está na linha de frente.', ability: 'Oração restauradora', color: CHARACTERS[4].color,
    recipe: CHARACTERS[4], classId: 4, pickGroup: 'cleric', hp: 225, dmg: 27, range: 5, cooldown: 1.2, ranged: true, attacks: ['Spellcast_Shoot'], stats: { Vida: 4, Força: 3, Rapidez: 3, Alcance: 4 } },
  { id: 'bard', names: ['Bardo', 'Mestre das Canções', 'Lenda Errante'], desc: 'Sua música acelera os ataques de todo o grupo.', ability: 'Acorde heroico', color: CHARACTERS[5].color,
    recipe: CHARACTERS[5], classId: 4, pickGroup: 'bard', hp: 220, dmg: 22, range: 5, speed: 3, cooldown: 1.15, ranged: true, idle: '2H_Melee_Idle', attacks: ['Spellcast_Shoot'], stats: { Vida: 4, Força: 2, Rapidez: 4, Alcance: 4 } },
  { id: 'angel', names: ['Anjo', 'Arcanjo', 'Serafim'], desc: 'Paira acima da batalha e desce com impacto de luz para amparar o grupo.', ability: 'Descida celeste', color: CHARACTERS[6].color,
    recipe: CHARACTERS[6], classId: 4, pickGroup: 'angel', hp: 180, dmg: 20, range: 6.5, cooldown: 1.2, ranged: true, idle: 'Jump_Idle', splash: 0.6, attacks: ['Spellcast_Shoot'], stats: { Vida: 3, Força: 4, Rapidez: 3, Alcance: 5 } },
  { id: 'chronist', names: ['Cronomante', 'Tecelão do Tempo', 'Mestre do Instante'], desc: 'Dobra o tempo para deter uma ameaça e abrir espaço.', ability: 'Campo temporal', color: CHARACTERS[7].color,
    recipe: CHARACTERS[7], classId: 2, splash: 0, hp: 165, dmg: 21, range: 6, speed: 3.5, cooldown: 1.05, ranged: true, attacks: ['Spellcast_Shoot'], stats: { Vida: 3, Força: 3, Rapidez: 4, Alcance: 5 } },
  { id: 'archer', names: ['Arqueira', 'Olho de Falcão', 'Caçadora Lendária'], desc: 'Flechas longas que atravessam a fila.', ability: 'Flecha longa', color: ['#a8e6d6', '#3f9e8a'],
    use: [], stats: { Vida: 3, Força: 4, Rapidez: 4, Alcance: 5 }, model: 'Rogue_Hooded', hp: 170, dmg: 16, range: 7.5, cooldown: 1, ranged: true, attacks: ['2H_Ranged_Shoot'], classId: 3 },
  { id: 'monk', names: ['Monge', 'Punho Sereno', 'Mestre do Vento'], desc: 'Punhos velozes e uma calma que cura.', ability: 'Cem punhos', color: ['#ffd9a0', '#d8902e'],
    use: [], stats: { Vida: 4, Força: 3, Rapidez: 5, Alcance: 1 }, hp: 235, dmg: 20, range: 1.4, speed: 3.4, cooldown: 0.5, cleave: 0, idle: 'Unarmed_Idle',
    attacks: ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B', 'Unarmed_Melee_Attack_Kick'], classId: 1, pickGroup: 'monk' },
  { id: 'alchemist', names: ['Alquimista', 'Mestre dos Frascos', 'Grão-Transmutador'], desc: 'Frascos de veneno e de tônico.', ability: 'Frasco', color: ['#d8f59a', '#8cb83f'],
    use: [], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 4 }, hp: 200, dmg: 14, range: 6, speed: 3, cooldown: 1.15, ranged: true, splash: 0.6, attacks: ['Spellcast_Shoot'], classId: 4, pickGroup: 'alchemist' },
].map((v) => ({ ...HEROES[v.classId], ...v, name: v.names[0],
  hide: v.recipe ? [] : HEROES[v.classId].weapons.filter((w) => !v.use.includes(w)),
}));
const variantsOf = (classId) => VARIANTS.filter((v) => v.classId === classId);
const PICK_GROUPS = [
  { id: 'class-0', name: 'Cavaleiro', icon: '♜', classId: 0 },
  { id: 'class-1', name: 'Bárbaro', icon: '⚒', classId: 1 },
  { id: 'class-2', name: 'Mago', icon: '✦', classId: 2 },
  { id: 'class-3', name: 'Ladino', icon: '☾', classId: 3 },
  { id: 'monk', name: 'Monge', icon: '☯', classId: 1 },
  { id: 'druida', name: 'Druida', icon: '❀', classId: 4 },
  { id: 'cleric', name: 'Clérigo', icon: '✚', classId: 4 },
  { id: 'bard', name: 'Bardo', icon: '♫', classId: 4 },
  { id: 'angel', name: 'Anjo', icon: '✧', classId: 4 },
  { id: 'alchemist', name: 'Alquimista', icon: '⚗', classId: 4 },
];
const pickGroupId = (cfg) => cfg.pickGroup || `class-${cfg.classId}`;
const variantsInPickGroup = (groupId) => VARIANTS.filter((cfg) => pickGroupId(cfg) === groupId);
const pickGroupIndex = (cfg) => PICK_GROUPS.findIndex((group) => group.id === pickGroupId(cfg));
const POSTS = [[0, -1.2], [-1.7, 0], [1.7, 0], [0, 1.7]];
const XP_LEVELS = [0, 90, 350];   // XP acumulado para Nv2 e Nv3

const SKELETONS = {
  Crossbow: { model: 'Rogue', hp: 34, dmg: 7, range: 10, speed: 0, cooldown: 2.3, weapon: 'Skeleton_Crossbow', ranged: true, attack: '2H_Ranged_Shoot' },
  Mage: { model: 'Mage', hp: 40, dmg: 9, range: 10, speed: 0, cooldown: 2.8, weapon: 'Skeleton_Staff', ranged: true, attack: 'Spellcast_Shoot' },
  Minion:  { hp: 36, dmg: 6,  range: 1.3, speed: 1.6, cooldown: 1.4, weapon: 'Skeleton_Blade' },
  Warrior: { hp: 80, dmg: 11, range: 1.4, speed: 1.3, cooldown: 1.6, weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Small_A' },
  Rogue:   { hp: 30, dmg: 8,  range: 1.3, speed: 2.3, cooldown: 1.1, weapon: 'Skeleton_Blade', move: 'Running_C' },
};
Object.assign(SKELETONS, MONSTER_TYPES);   // escudeiro, bombardeiro, sacerdote, fantasma, golem e chefes (monsters.js)

// Dificuldades: multiplicam vida/dano dos esqueletos, tamanho e ritmo das ondas e força do chefe;
// heal = cura ao vencer a fase, revive = vida de quem volta, reviveDelay = fases que o caído espera,
// behind/behindFrom = chance e fase mínima de virem por trás, shooters = chance de um atirador na estrada.
const DIFFICULTIES = [
  { id: 'facil', name: 'Fácil', icon: '❀', desc: 'Um passeio pelo reino.', color: ['#cdf0b4', '#6aa84f'],
    hp: 0.85, dmg: 0.8, count: 0.9, interval: 1.15, boss: 0.8, heal: 0.5, revive: 0.5, reviveDelay: 0, behind: 0.15, behindFrom: 5, shooters: 0 },
  { id: 'normal', name: 'Normal', icon: '⚔︎', desc: 'Os esqueletos vêm com tudo.', color: ['#bfe0ff', '#5a8fd0'],
    hp: 1, dmg: 1, count: 1, interval: 1, boss: 1, heal: 0.4, revive: 0.4, reviveDelay: 0, behind: 0.25, behindFrom: 4, shooters: 0.03 },
  { id: 'dificil', name: 'Difícil', icon: '♜', desc: 'Escolha bem cada herói.', color: ['#ffd29e', '#d17a2a'],
    hp: 1.18, dmg: 1.12, count: 1.12, interval: 0.92, boss: 1.1, heal: 0.28, revive: 0.32, reviveDelay: 0, behind: 0.35, behindFrom: 3, shooters: 0.08 },
  { id: 'pesadelo', name: 'Pesadelo', icon: '☠︎', desc: 'Caídos só voltam uma fase depois.', color: ['#f3b1c0', '#a3324a'],
    hp: 1.28, dmg: 1.18, count: 1.18, interval: 0.86, boss: 1.15, heal: 0.2, revive: 0.25, reviveDelay: 1, behind: 0.45, behindFrom: 2, shooters: 0.15 },
];
const DIFFICULTY_PICK_HINT = '← → · Enter · Esc';
const nightmareTeamIds = (mission) => {
  const goal = mission?.goal?.type;
  if (mission?.heroes === 1) return ['paladin'];
  if (mission?.heroes === 2) {
    if (['defend', 'breach', 'escort', 'rescue'].includes(goal)) return ['paladin', 'guardian'];
    if (goal === 'boss') return ['paladin', 'viking'];
    return ['paladin', 'pyro'];
  }
  if (mission?.heroes === 3) {
    if (goal === 'hunt') return ['paladin', 'guardian', 'viking'];
    if (goal === 'totems') return ['paladin', 'pyro', 'cleric'];
    if (goal === 'rescue') return ['paladin', 'guardian', 'angel'];
    return ['paladin', 'guardian', 'pyro'];
  }
  if (goal === 'elite') return ['paladin', 'guardian', 'pyro', 'viking'];
  if (goal === 'boss' || goal === 'twin' || goal === 'bosses') return ['paladin', 'guardian', 'viking', 'cleric'];
  return ['paladin', 'guardian', 'pyro', 'cleric'];
};
// Mantém uma sugestão para as escolhas iniciais e indica quem completar depois nas missões longas.
const nightmareTeamPlanIds = (mission) => {
  const initial = nightmareTeamIds(mission);
  if (!mission || mission.heroes === 1 || initial.length >= MAX_PARTY) return initial;
  const goal = mission.goal?.type;
  const reserves = mission.heroes === 2
    ? goal === 'boss' ? ['guardian', 'cleric'] : ['cleric', 'pyro']
    : goal === 'rescue' ? ['pyro']
      : goal === 'hunt' ? ['cleric']
        : goal === 'totems' ? ['guardian']
          : ['cleric'];
  return [...initial, ...reserves.filter((id) => !initial.includes(id))].slice(0, MAX_PARTY);
};
const nextNightmareTeamId = (mission) => {
  const selected = new Set(heroes().map((hero) => hero.cfg.id));
  return nightmareTeamPlanIds(mission).find((id) => !selected.has(id)) || null;
};
const difficultyTeamRecommendation = (option, mission) => {
  if (option.id !== 'pesadelo') return '';
  const labels = { paladin: 'Paladino (cura)', guardian: 'Guardião (proteção)', pyro: 'Piromante (dano em área)', viking: 'Viking (dano a chefe)', cleric: 'Clériga (suporte/cura)', angel: 'Anjo (dano e cura)' };
  const initial = nightmareTeamIds(mission).map((id) => labels[id]);
  const plan = nightmareTeamPlanIds(mission).map((id) => labels[id]);
  const list = (team) => team.length === 1 ? team[0]
    : team.length === 2 ? `${team[0]} e ${team[1]}`
    : team.length === 3 ? `${team[0]}, ${team[1]} e ${team[2]}`
      : `${team.slice(0, -1).join(', ')} e ${team.at(-1)}`;
  if (initial.length === 1) return mission?.goal?.type === 'duel'
    ? 'Duelo (1 herói): escolha Paladino (cura) para sustentar a luta sozinho.'
    : 'Equipe para 1 herói: Paladino (cura) para sustentar a missão sozinho.';
  const opening = mission ? `Equipe inicial para ${initial.length} heróis: ${list(initial)}.`
    : `Equipe para ${initial.length} heróis: ${list(initial)}.`;
  const reserves = plan.slice(initial.length);
  const reserveLabel = reserves.length === 1 ? 'Reforço sugerido' : 'Reforços sugeridos';
  return reserves.length ? `${opening} ${reserveLabel}: ${list(reserves)}.` : opening;
};
let difficulty = DIFFICULTIES[1];

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
controls.minDistance = 12;
controls.maxDistance = 50;
const follow = new THREE.Vector3();   // ponto que a câmera persegue
// zoom cinematográfico: multiplica a distância escolhida pelo jogador (roda do mouse) conforme a situação
const cam = { zoom: 1, userDist: 0, wheel: false, fit: 0 };
renderer.domElement.addEventListener('wheel', () => (cam.wheel = true), { passive: true });

const hemi = new THREE.HemisphereLight(0xfff4dc, 0xa89868, 1.8);   // sombras mais suaves
scene.add(hemi);
// céu, névoa e luz de dia e nas terras do necromante (misturados pela "trevas" de onde o grupo está)
const SKY = [new THREE.Color(0x7cc6ff), new THREE.Color(0x3f3552)];   // azul vivo de dia (estilo Clash)
const HEMI = [new THREE.Color(0xfff4dc), new THREE.Color(0xb8a8d8)], HEMI_GROUND = [new THREE.Color(0xa89868), new THREE.Color(0x3e3448)];
const SUN = [new THREE.Color(0xffe2b8), new THREE.Color(0xc6a8ff)];
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
  renderer.setPixelRatio(lowQuality ? 1 : Math.min(devicePixelRatio, 2));
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
  if (on && (game.paused || game.over || pick.open || (!heroes().length && !game.realm))) return;
  game.userPaused = on;
  game.paused = on;
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
  if (!game.userPaused && (game.paused || game.over || pick.open || (!heroes().length && !game.realm))) return;
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
const PICK_HERO_HINT = '← → ↑ ↓ · Enter';
// papéis da equipe como ícones (o nome fica na dica e no aria-label)
const ROLE_GLYPHS = { Defesa: '⛨', Cura: '✚', Área: '✺', Controle: '❄', 'À distância': '➶', 'Dano a chefe': '☠' };
// atributos da ficha como ícones; o número exato vai para a dica
const STAT_GLYPHS = { Vida: '♥', Força: '⚔', Rapidez: '➤', Alcance: '◎' };

function showPick(title, sub) {
  pick.mode = 'hero';
  $('banner').style.opacity = 0;   // a faixa não pode ficar embaixo do título da escolha
  pick.options = PICK_GROUPS.flatMap((group) => variantsInPickGroup(group.id));   // cada arquétipo ocupa sua própria linha
  $('pickHint').textContent = PICK_HERO_HINT;
  const previousSuggestion = game.mission && game.picksLeft > 0 && !game.test
    ? game.campaignSquadSuggestion?.[heroes().length]
    : null;
  const recommendedId = game.mission && difficulty.id === 'pesadelo'
    ? nextNightmareTeamId(game.mission)
    : null;
  pick.suggestedId = previousSuggestion;
  $('pickTitle').textContent = title;
  $('pickSub').textContent = sub;
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
    const color = variants[0]?.color?.[0] || HEROES[group.classId]?.color?.[0] || '#8bb9e7';
    const filter = document.createElement('button');
    filter.type = 'button';
    filter.className = 'pick-filter';
    filter.setAttribute('aria-label', `${group.name}: ${count} herói${count === 1 ? '' : 's'}`);
    filter.setAttribute('aria-pressed', 'false');
    filter.style.setProperty('--class-color', color);
    filter.innerHTML = `<i aria-hidden="true">${group.icon}</i><span>${group.name}</span>`;
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
    b.setAttribute('aria-label', `${cfg.name}, categoria ${categoryName}${suggested ? ' (sugestão da equipe anterior)' : owned ? ' (já está no grupo)' : open ? '' : ` (★ ${starsToUnlock(cfg.id)} para liberar)`}${recommended ? ' (recomendado para Pesadelo nesta missão)' : ''}`);
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

// recordes por dificuldade (melhor fase e abates), guardados no navegador quando der
const RECORDS_KEY = 'cavaleiros-recordes';
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch { return {}; }
}

// devolve true quando a partida que acabou virou o novo recorde do nível
function saveRecord(won) {
  if (game.start > 1 || game.mission || game.test) return false;   // atalhos de teste e campanha não gravam recordes
  const records = loadRecords(), old = records[difficulty.id];
  const now = { phase: game.phase, kills: game.kills, won };
  const better = !old || (won && !old.won) || (won === !!old.won && (now.phase > old.phase || (now.phase === old.phase && now.kills > old.kills)));
  if (!better) return false;
  records[difficulty.id] = now;
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { return false; }
  return true;
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

// menu inicial: Campanha (missões com estrelas) ou Jornada completa (as 12 fases seguidas)
const MODES = [
  { name: 'Campanha', icon: '⚑', desc: `${MISSIONS.length} missões com objetivos e estrelas.`, color: ['#ffe27a', '#c98a12'] },
  { name: 'Jornada', icon: '♛', desc: 'Jornada completa: as 12 fases seguidas até o castelo.', color: ['#bfe0ff', '#5a8fd0'] },
  { name: 'Acampamento', icon: '⚒', desc: 'Oficina, maestria dos heróis e conquistas.', color: ['#ffd29e', '#b8662a'] },
  { name: 'Reino', icon: '♜', desc: 'Construa a vila, colete recursos, treine soldados e heróis e destrua o Portal de Ossos.', color: ['#b9f0a8', '#4f9a3a'] },
];
// Menu inicial estilo Clash: barra de perfil em cima, um botão grande de batalha (Campanha) com a equipe ao lado
// e Jornada, Acampamento e Reino como botões menores embaixo. Pouco texto: os detalhes ficam na dica e no aria-label.
// A ordem de pick.cards segue MODES (atalhos 1–4 e setas ← →).
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
  $('pickSub').textContent = '';
  $('pickHint').textContent = '';   // sem rodapé: setas, Enter e 1–4 seguem valendo
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  const records = Object.values(loadRecords());
  const achievements = progress.achievements(), achieved = achievements.filter((a) => a.unlocked).length;
  const best = records.length ? Math.max(...records.map((r) => r.phase)) : 0;
  const stars = totalStars(), maxStars = MISSIONS.length * 3;
  const mastery = Math.max(1, ...VARIANTS.map((cfg) => progress.mastery(cfg.id).level));
  const next = recommendedMission();
  const shopReady = UPGRADES.some((u) => { const cost = progress.upgradeCost(u.id); return cost != null && progress.gold >= cost; });
  const newAchievements = Math.max(0, achieved - seenAchievements());
  const journey = records.some((r) => r.won) ? '♛' : best ? `Fase ${best}` : '';

  const home = document.createElement('div');
  home.className = 'menu-home';
  // barra de perfil: ícones e números; o detalhe vai na dica
  const bar = document.createElement('div');
  bar.className = 'menu-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Perfil');
  bar.innerHTML = `<div class="menu-stats">
      <span class="menu-stat gold" tabindex="0" data-tip="${GOLD.name}: ${progress.gold}" aria-label="${progress.gold} de ouro"><i aria-hidden="true">${GOLD.icon}</i>${progress.gold}</span>
      <span class="menu-stat stars" tabindex="0" data-tip="Estrelas da campanha: ${stars} de ${maxStars}" aria-label="${stars} de ${maxStars} estrelas"><i aria-hidden="true">★</i>${stars}<small>/${maxStars}</small></span>
      <span class="menu-stat feats" tabindex="0" data-tip="Conquistas: ${achieved} de ${achievements.length}" aria-label="${achieved} de ${achievements.length} conquistas"><i aria-hidden="true">✦</i>${achieved}/${achievements.length}</span>
      <span class="menu-stat mastery" tabindex="0" data-tip="Maestria mais alta: ${mastery} de ${MASTERY_PERKS.length}" aria-label="Maestria mais alta ${mastery}"><i aria-hidden="true">✪</i>${mastery}</span>
    </div>
    <div class="menu-tools">
      <button type="button" class="menu-tool menu-sound">${MENU_SPEAKER}</button>
      <button type="button" class="menu-tool menu-gfx"><span aria-hidden="true">◐</span></button>
    </div>`;
  bar.querySelector('.menu-sound').onclick = () => { $('mute').onclick?.(); paintMenuBar(bar); };
  bar.querySelector('.menu-gfx').onclick = () => { $('quality').onclick?.(); paintMenuBar(bar); };
  paintMenuBar(bar);

  // palco: equipe dos dois lados do botão de batalha
  const stage = document.createElement('div');
  stage.className = 'menu-stage';
  const squad = menuSquad();
  const crew = (side, from) => {
    const box = document.createElement('div');
    box.className = `menu-crew ${side}`;
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = squad.slice(from, from + 2).map((cfg, k) => `<span class="menu-hero" data-tip="${attrText(cfg.name)}" data-glyph="${PICK_CLASS_GLYPHS[cfg.classId] || '♜'}" style="--c:${cfg.color[0]};--cd:${cfg.color[1]};--d:${380 + (from + k) * 110}ms;--bob:${(from + k) * 0.7}s"><img src="${cfg.portrait || ''}" alt=""></span>`).join('');
    return box;
  };
  const row = document.createElement('div');
  row.className = 'menu-row';
  const label = ['Batalhar', 'Jornada', 'Acampamento', 'Reino'];
  const extra = [
    `<small class="menu-next">${next ? `⚑ ${MISSIONS.indexOf(next) + 1}. ${next.name}` : '♛'}</small><span class="menu-badge-stars">★ ${stars}/${maxStars}</span>`,
    journey ? `<small>${journey}</small>` : '',
    `<small class="menu-gold">${GOLD.icon} ${progress.gold}</small>${shopReady || newAchievements ? '<span class="menu-new" aria-hidden="true">!</span>' : ''}`,
    '',
  ];
  const spoken = [`${stars} de ${maxStars} estrelas${next ? `. Próxima: ${next.name}` : ''}`,
    records.some((r) => r.won) ? 'Jornada vencida' : best ? `Recorde: fase ${best}` : 'Sem recorde ainda',
    `${progress.gold} de ouro, ${achieved} de ${achievements.length} conquistas${shopReady ? '. Há melhoria para comprar' : ''}${newAchievements ? '. Conquista nova' : ''}`,
    'Estratégia: vila, recursos e ondas'];
  pick.cards = MODES.map((m, i) => {
    const b = document.createElement('div');
    b.className = `menu-btn ${i === 0 ? 'menu-battle' : 'menu-side'}`;
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-keyshortcuts', String(i + 1));
    b.setAttribute('aria-label', `${m.name}: ${m.desc} ${spoken[i]}.`);
    b.setAttribute('data-tip', i === 0 ? `${m.name} · ${m.desc}` : m.desc);
    b.style.setProperty('--c', m.color[0]);
    b.style.setProperty('--cd', m.color[1]);
    b.style.setProperty('--d', `${i === 0 ? 160 : 260 + i * 80}ms`);
    b.innerHTML = `<span class="menu-icon" aria-hidden="true">${i === 0 ? '⚔' : m.icon}</span><b>${label[i]}</b>${extra[i]}`;
    b.onclick = () => confirmPick(i);
    b.onfocus = () => selectCard(i);
    b.onmouseenter = () => selectCard(i);
    return b;
  });
  stage.append(crew('left', 0), pick.cards[0], crew('right', 2));
  row.append(...pick.cards.slice(1));
  home.append(bar, stage, row);
  list.appendChild(home);
  selectCard(0);
  pick.open = true;
  game.paused = true;
  $('pick').classList.remove('hidden');
}

function confirmMode(i) {
  pick.open = false;
  pick.cards.forEach((c, k) => c.classList.add(k === i ? 'chosen' : 'gone'));
  pick.timer = setTimeout(() => (i === 0 ? showCampaign() : i === 2 ? showCamp() : i === 3 ? startGame('reino') : (game.mission = null, showDifficulty())), 450);
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
function showCampaign(autoPlay = null) {
  tutorial.on('leave');
  game.mission = null;
  pick.open = false;
  game.paused = true;   // sem grupo ainda: a partida não pode correr por trás do mapa
  $('pick').classList.add('hidden');
  const root = $('campaign');
  const mapSeeds = campaignMapSession.get();
  const play = (m) => {
    game.mission = m;
    // Cada missão da campanha recebe seu próprio cenário; a jornada completa mantém o mapa-base.
    world.dispose?.();
    const castleInterior = m.id === 'coracao-do-castelo';
    world = createWorld(scene, ROAD, castleInterior ? 13 : PHASES, mapSeeds.get(m.id), { castleInterior });
    root.classList.add('hidden');
    showDifficulty();
  };
  renderCampaign(root, play, (m) => m.id === 'coracao-do-castelo' ? 'Interior do castelo' : biomeForSeed(mapSeeds.get(m.id)), (m) => campaignThreats(m.from, m.to, m.goal), progressStorageWarning());
  const back = document.createElement('button');
  back.className = 'camp-back';
  back.textContent = '← Menu';
  back.onclick = () => { campaignMapSession.reset(); showMenu(); };
  root.querySelector('.camp-head')?.prepend(back);
  root.classList.remove('hidden');
  if (autoPlay) play(autoPlay);
}

// dificuldade: na jornada mostra o recorde de cada uma; na campanha, o trecho da missão
function showDifficulty() {
  if (typeof preloadBattleAssets === 'function') preloadBattleAssets();
  pick.mode = 'difficulty';
  $('banner').style.opacity = 0;
  pick.options = DIFFICULTIES;
  const records = loadRecords(), m = game.mission;
  $('pickTitle').textContent = m ? `${MISSIONS.indexOf(m) + 1}. ${m.name}` : 'Jornada';
  $('pickSub').textContent = m ? `⚑ ${goalText(m.goal)}` : '';
  $('pickHint').textContent = DIFFICULTY_PICK_HINT;
  const list = $('pickList');
  list.innerHTML = '';
  list.classList.remove('grid');
  // cartão: ícone, nome e o recorde da jornada; a descrição da dificuldade vai para a dica
  pick.cards = DIFFICULTIES.map((d, i) => {
    const r = m ? null : records[d.id];
    const record = m ? '' : r ? (r.won ? '♛ Vitória!' : `Fase ${r.phase}`) : 'Sem recorde';
    const spoken = m ? `Fases ${m.from}–${m.to}.` : r ? `${r.won ? 'Vitória' : `Recorde: fase ${r.phase}`}, ${r.kills} abates.` : 'Sem recorde ainda.';
    const recommendation = difficultyTeamRecommendation(d, m);
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
    b.innerHTML = `<div class="num">${i + 1}</div><div class="medal">${d.icon}</div><div class="ribbon">${d.name}</div>
      ${record ? `<div class="record${r?.won ? ' won' : ''}">${record}</div>` : ''}`;
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
  const m = game.mission;
  if (m) campaignMapSession.reset();   // a próxima visita à campanha começa uma nova combinação de mapas
  if (!m && world.seed != null && world.seed !== 11) {
    world.dispose?.();
    world = createWorld(scene, ROAD, PHASES, 11);
  }
  // ?fase=N também vale na campanha, dentro do trecho da missão
  const asked = +new URLSearchParams(location.search).get('fase');
  placeParty(m ? THREE.MathUtils.clamp(asked || m.from, m.from, m.to) : THREE.MathUtils.clamp(asked || 1, 1, PHASES));
  game.campaignSquadSuggestion = m && !game.test ? loadCampaignSquad() : [];
  game.picksLeft = m ? m.heroes : 0;
  pick.timer = setTimeout(() => (m ? showPick(pickTitle(), pickSub())
    : showPick('Escolha seu herói', 'Ele vai liderar o grupo contra os esqueletos')), 550);
}

const pickTitle = () => game.mission.heroes > 1 ? `Escolha o herói ${heroes().length + 1} de ${game.mission.heroes}` : 'Escolha seu herói';
const pickSub = () => `${game.mission.name}: o grupo começa no nível ${game.mission.level}`;

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
  const teamLimit = game.mission && game.picksLeft > 0 ? Math.min(MAX_PARTY, game.mission.heroes) : MAX_PARTY;
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
  const kindName = (skill) => skill.ultimate ? 'Ultimate' : skill.slot === 1 ? 'Técnica' : 'Básica';
  pick.info.style.setProperty('--c', cfg.color[0]);
  pick.info.style.setProperty('--cd', cfg.color[1]);
  pick.info.innerHTML = `<div class="hero-profile"><div class="crest"><img src="${cfg.portrait}" alt=""></div>
      <div class="hero-profile-copy"><small>${info.name} · ${cfg.ranged ? '➶' : '⚔'}</small><div class="ribbon">${cfg.name}</div>
        <span class="hero-role-pill" tabindex="0" data-tip="${attrText(`${CLASSES[cfg.classId].summary} ${info.tip}`)}">${info.role}</span>${masteryLine}</div></div>
    <section class="ability skill-list" aria-label="Habilidades do herói">${skills.map((skill) => `<article class="skill-detail${skill.ultimate ? ' ultimate-detail' : skill.slot === 1 ? ' technique-detail' : ''}" tabindex="0" data-tip="skill" data-hero="${cfg.id}" data-slot="${skill.slot}" aria-label="${attrText(`${skill.name}, ${kindName(skill)}, recarga ${cooldownForSkill(cfg, skill.slot)} s: ${skill.description}`)}"><span class="skill-icon" aria-hidden="true">${SKILL_GLYPHS[cfg.id]?.[skill.slot] || ['✦', '⚔', '☼'][skill.slot]}</span><strong>${skill.name}</strong><span class="skill-meta" aria-hidden="true">⟳ ${cooldownForSkill(cfg, skill.slot)} s</span></article>`).join('')}</section>
    <div class="stats hero-stats" aria-label="Atributos">${stats}</div>
    ${variantOpen(cfg.id) ? '' : `<div class="lock-info" aria-label="Ganhe ${starsToUnlock(cfg.id)} estrelas na campanha para liberar">\u{1F512}︎ ★ ${starsToUnlock(cfg.id)}</div>`}`;
  // equipe fixa ao lado dos cartões: mini-retratos, contagem, papéis cobertos e os que faltam
  pick.team.innerHTML = `<section class="party-composition" aria-label="${attrText(canAddCandidate ? `Sua equipe com ${cfg.name}` : 'Sua equipe')}">
      <span class="pick-team-count" aria-label="${Math.min(projectedTeam.length, teamLimit)} de ${teamLimit} heróis">${Math.min(projectedTeam.length, teamLimit)}/${teamLimit}</span>
      <div class="party-members">${teamMembers}</div>
      <div class="party-roles" aria-label="Papéis cobertos">${coveredIcons}</div>
      ${wantedIcons ? `<div class="party-roles party-wanted" aria-label="${objective ? 'Prioridades da missão' : 'Papéis que faltam'}">${wantedIcons}</div>` : ''}
      ${objective ? `<span class="party-objective" tabindex="0" data-tip="Objetivo da missão"><i aria-hidden="true">⚑</i> ${goalText(objective)}</span>` : ''}
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

// setas na grade: ← → dentro da linha, ↑ ↓ entre linhas (coluna mais próxima), pulando quem já está no grupo
function moveGrid(dx, dy) {
  const free = (i) => isFree(pick.options[i]);
  const rows = PICK_GROUPS.map((group) => pick.options
    .map((cfg, i) => pickGroupId(cfg) === group.id ? i : -1).filter((i) => i >= 0));
  const r0 = rows.findIndex((row) => row.includes(pick.sel));
  const c0 = rows[r0]?.indexOf(pick.sel) ?? 0;
  if (r0 < 0) return;
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
    const i = candidates.sort((a, b) => Math.abs(rows[r].indexOf(a) - c0) - Math.abs(rows[r].indexOf(b) - c0))[0];
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
    const recommendation = game.mission && difficulty.id === 'pesadelo'
      ? `Sugestão Pesadelo: ${nightmareTeamPlanIds(game.mission).map((id) => VARIANTS.find((cfg) => cfg.id === id)?.name || id).join(' + ')}`
      : '';
    $('pickHint').textContent = recommendation ? `${PICK_HERO_HINT} · ${recommendation}` : PICK_HERO_HINT;
    renderInfo(pick.options[pick.sel]);
  } else if (pick.mode === 'difficulty') {
    const selected = pick.options[pick.sel];
    const recommendation = difficultyTeamRecommendation(selected, game.mission);
    $('pickHint').textContent = recommendation ? `${DIFFICULTY_PICK_HINT} · ${recommendation}` : DIFFICULTY_PICK_HINT;
  }
}

function confirmPick(i) {
  if (!pick.open) return;
  hideTooltip();   // a dica do cartão não fica sobre a batalha
  if (pick.mode === 'evolution') return confirmEvolution(i);
  if (pick.mode === 'relic') return confirmRelic(i);
  if (pick.mode === 'difficulty') return confirmDifficulty(i);
  if (pick.mode === 'mode') return confirmMode(i);
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
    const party = heroes(), first = game.picksLeft > 0;   // first: grupo inicial da missão
    const xp = first ? XP_LEVELS[game.mission.level - 1] : party.length ? party.reduce((sum, h) => sum + h.xp, 0) / party.length / 2 : 0;
    const h = new Hero(cfg);
    arrangeParty();
    h.gainXp(xp);
    h.busy = h.once('Cheer') * 0.6;
    if (first) {
      rememberCampaignSquad();
      autoUpgrade();   // a missão já começa no nível certo, sem telas de evolução
      if (--game.picksLeft > 0) return showPick(pickTitle(), pickSub());
      return startMission();
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

// Relíquias: as de bônus simples acumulam; as únicas (unique) mudam o jeito de jogar e valem uma vez por jornada.
// A raridade (comum/rara/épica) pesa no sorteio e dá a cor do cartão e do ícone no HUD.
// needs() tira da oferta o que não serve à equipe atual (ex.: bônus de mago sem mago).
const RELIC_RARITY = {
  comum: { name: 'Comum', weight: 6, c: '#e3e9f2', cd: '#67768c' },
  rara: { name: 'Rara', weight: 3, c: '#7cc4ff', cd: '#2a5aa6' },
  epica: { name: 'Épica', weight: 1.2, c: '#d99bff', cd: '#6a2fa6' },
};
const partyHas = (test) => heroes().some((h) => !h.dead && test(h));
const RELICS = [
  { id: 'keen-edge', short: '+12% de dano', name: 'Lâmina afiada', icon: '⚔', rarity: 'comum', desc: 'Heróis causam 12% mais dano pelo resto da jornada.' },
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

// ganchos das relíquias que mudam o jogo; cada um só age se a relíquia estiver na jornada
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
    for (let slot = 0; slot < 3; slot++) killer.skillTimers[slot] = Math.max(0, killer.skillTimers[slot] - 2);
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
  $('pickSub').textContent = `Fase ${game.phase}`;
  $('pickHint').textContent = `1–${pick.options.length} · Enter`;
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
    card.innerHTML = `<div class="num">${i + 1}</div><div class="relic-icon" aria-hidden="true">${relic.icon}</div><div class="ribbon">${relic.name}</div><p>${relic.short}</p>${relic.unique ? '<small aria-hidden="true">◆ Única</small>' : ''}`;
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
  return `<div class="tt-relic rarity-${relic.rarity}"><header><span class="tt-icon" aria-hidden="true">${relic.icon}</span><div><b>${relic.name}</b><span class="tt-kind">Relíquia ${RELIC_RARITY[relic.rarity].name.toLowerCase()}${n > 1 ? ` · ×${n}` : ''}</span></div></header><p class="tt-desc">${relic.desc}</p></div>`;
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
  if (heroes().length < 4) return showPick('Novo aliado!', 'Escolha quem entra no grupo');
  audio.startMusic();
}

function showEvolution() {
  if (!evolutions.length || pick.open || game.paused || game.over) return;
  if (autoEvolve || game.realm) {   // no Reino a evolução é sempre automática (sem pausar a estratégia)
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
  pick.mode = 'evolution';
  $('banner').style.opacity = 0;
  pick.open = true;
  game.paused = true;
  pick.upgrades = availableEvolutionBranches(h);
  $('pickTitle').textContent = 'Evolução!';
  $('pickSub').textContent = `${cfg.names[entry.level - 1]} · Nv${entry.level}`;
  $('pickHint').textContent = `1–${pick.upgrades.length} · Enter`;
  $('pickList').innerHTML = '';
  $('pickList').classList.remove('grid');
  pick.cards = pick.upgrades.map((option, i) => {
    const b = document.createElement('div');
    b.className = 'card relic evolution';
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.setAttribute('aria-label', `${option.name}: ${option.desc}`);
    b.setAttribute('data-tip', option.desc);
    b.style.setProperty('--c', cfg.color[0]);
    b.style.setProperty('--cd', cfg.color[1]);
    b.style.setProperty('--d', `${i * 90}ms`);
    b.innerHTML = `<div class="num">${i + 1}</div><div class="relic-icon" aria-hidden="true">${option.icon}</div><div class="ribbon">${option.name}</div><p>${option.short || option.desc}</p>`;
    b.onclick = () => confirmPick(i);
    bindCard(b, i);
    $('pickList').appendChild(b);
    return b;
  });
  selectCard(0);
  $('pick').classList.remove('hidden');
}

function chooseAutoEvolution(hero) {
  const controlEffects = new Set(['taunt', 'bastion', 'ward', 'frost-ward', 'blizzard', 'roots-heal', 'nature-storm', 'wind-palm']);
  const supportEffects = new Set(['holy-nova', 'roots-heal', 'nature-storm', 'summon', 'meditate', 'volatile']);
  const controlSignatures = new Set(['guardian', 'crusher', 'iceviking', 'pyro', 'cryo', 'druid', 'cleric', 'chronist', 'monk', 'alchemist']);
  const supportSignatures = new Set(['paladin', 'cleric', 'druid', 'angel', 'necro', 'monk', 'alchemist']);
  const skills = skillSetFor(hero.cfg);
  const control = skills.filter((skill) => skill.control || controlEffects.has(skill.effect)).length
    + Number(controlSignatures.has(hero.cfg.id));
  const support = skills.filter((skill) => supportEffects.has(skill.effect)).length
    + Number(supportSignatures.has(hero.cfg.id));
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
  return EVOLUTION_BRANCHES.filter((branch) => !(hero.evolutionBranches?.[branch.id] > 0));
}

function confirmEvolution(i) {
  const entry = evolutions[0], option = pick.upgrades[i];
  if (!entry || !option || (EVOLUTION_BRANCHES.some((branch) => branch.id === option.id) && entry.hero.evolutionBranches?.[option.id])) return;
  const h = evolutions.shift().hero;
  applyUpgrade(h, option);
  popText(h.pos, option.name + '!', 'evolve');
  pick.open = false;
  $('pick').classList.add('hidden');
  game.paused = false;
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
  // A ordem de entrada resolve os empates; os arqueiros preferem o fundo.
  const order = [...party.filter((h) => h.ranged), ...party.filter((h) => !h.ranged)];
  for (const h of order) {
    const slot = h.ranged ? slots.pop() : slots.shift();
    h.formation = POSTS[slot];
    h.setAnchor(game.guideS);
  }
}

addEventListener('keydown', (e) => {
  if (!pick.open) return;
  if (e.key === 'Escape' && pick.mode === 'difficulty') { e.stopImmediatePropagation(); return game.mission ? showCampaign() : showMenu(); }
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
  if (e.key === 'ArrowLeft') grid ? moveGrid(-1, 0) : selectCard(pick.sel - 1);
  else if (e.key === 'ArrowRight') grid ? moveGrid(1, 0) : selectCard(pick.sel + 1);
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
let skillItems = [];
const skillParty = [], skillRoster = [];
const SKILL_KEYS = [['1', '2', '3', '4'], ['Q', 'W', 'E', 'R'], ['A', 'S', 'D', 'F']];
const SKILL_GLYPHS = {
  paladin: ['✚', '⬟', '☼'], guardian: ['⛨', '⚑', '♜'], champion: ['⚔', '➶', '✦'],
  berserker: ['♨', '⚔', '✹'], crusher: ['⬟', '✹', '☄'], viking: ['⚒', '➶', '✹'],
  pyro: ['♨', '♨', '☄'], arcane: ['⚡', '✺', '✷'], cryo: ['❄', '⛨', '❆'],
  assassin: ['✦', '⚔', '☠'], crossbow: ['➶', '⇶', '✹'], ninja: ['✧', '☯', '✴'],
  duelist: ['⚔', '✕', '✺'],
  king: ['♛', '✦', '☀'], iceviking: ['❄', '➶', '❆'], necro: ['☠', '♟', '☥'],
  druid: ['❀', '❧', '☘'], cleric: ['✚', '⛨', '☼'], bard: ['♫', '♪', '♬'],
  angel: ['✧', '⛨', '☼'], chronist: ['⌛', '⚡', '◷'],
  archer: ['➹', '⇊', '◎'], monk: ['✊', '≋', '❂'], alchemist: ['⚗', '✸', '♈'],
};

function buildSkillBar(party) {
  const bar = $('skills');
  bar.innerHTML = '';
  skillItems = [];
  party.forEach((h, heroIndex) => {
    const group = document.createElement('div');
    group.className = 'skillGroup';
    group.style.setProperty('--c', h.cfg.color[0]);
    group.style.setProperty('--cd', h.cfg.color[1]);
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', h.cfg.name);
    const heroMark = SKILL_GLYPHS[h.cfg.id]?.[0] || '✦';
    group.innerHTML = `<div class="skillHero"><span class="skillHeroMark" aria-hidden="true">${heroMark}</span><span class="skillHeroName">${h.cfg.name}</span></div><div class="skillSlots"></div>`;
    const slots = group.querySelector('.skillSlots');
    for (const skill of skillSetFor(h.cfg)) {
      const slot = skill.slot, key = SKILL_KEYS[slot][heroIndex];
      const b = document.createElement('div');
      b.className = `skill slot-${slot}${skill.ultimate ? ' ultimate' : ''}`;
      b.style.setProperty('--c', h.cfg.color[0]);
      b.style.setProperty('--cd', h.cfg.color[1]);
      b.setAttribute('data-tip', 'skill');
      b.setAttribute('data-hero', h.cfg.id);
      b.setAttribute('data-slot', String(slot));
      b.setAttribute('data-key', key);
      const glyph = SKILL_GLYPHS[h.cfg.id]?.[slot] || ['✦', '⚔', '☼'][slot];
      // dois botões irmãos (usar e auto): botão dentro de botão não é acessível; nome e tipo ficam na dica
      b.innerHTML = `<span class="key" aria-hidden="true">${key}</span><button type="button" class="auto" data-tip="Uso automático: liga e desliga" aria-label="Uso automático de ${skill.name}" aria-pressed="true">↻</button>
        <button type="button" class="use" aria-label="${h.cfg.name}: ${skill.name}, ${skill.ultimate ? 'ultimate' : slot === 0 ? 'assinatura' : 'técnica'}. Tecla ${key}."><span class="face"><img alt=""><span class="glyph" aria-hidden="true">${glyph}</span><span class="cd"></span><b class="secs"></b></span></button>`;
      const it = { h, skill, slot, key, b, img: b.querySelector('img'), cd: b.querySelector('.cd'), secs: b.querySelector('.secs'), auto: b.querySelector('.auto'), level: 0, p: '', nopeT: 0, classStates: {} };
      b.querySelector('.use').onclick = () => pressSkill(it);
      it.auto.onclick = (e) => {
        e.stopPropagation();
        h.autoSkills[slot] = !h.autoSkills[slot];
        h.skillTargets[slot] = null;
        h.skillRequests[slot] = 0;
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
  const now = performance.now();
  for (const it of skillItems) {
    const { h, slot } = it;
    if (it.level !== h.level) { it.level = h.level; it.img.src = h.cfg.portraits?.[h.level - 1] || h.cfg.portrait; }
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
  const level = hero?.level || 1, maxLevel = cfg.names?.length || 3, rate = hero?.skillRate || 1;
  const [kindId, kindName] = SKILL_KIND[skill.ultimate ? 2 : slot === 1 ? 1 : 0];
  const glyph = SKILL_GLYPHS[cfg.id]?.[slot] || ['✦', '⚔', '☼'][slot];
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
  const next = level < maxLevel
    ? `<p class="tt-next"><b>Nv ${level + 1}</b> recarga ${num(cooldownForSkill(cfg, slot, level + 1, rate))} s${slot === 0 ? ' · mais forte' : ''}</p>`
    : '<p class="tt-next"><b>Nível máximo</b></p>';
  const routes = Object.keys(hero?.evolutionBranches || {}).map((id) => EVOLUTION_BRANCHES.find((b) => b.id === id)).filter(Boolean);
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
  if (pick.open || game.over || game.realm || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !/^[1-4qwerasdf]$/i.test(e.key)) return;
  const key = e.key.toUpperCase();
  const it = skillItems.find((item) => item.key === key);
  if (it) pressSkill(it);
});

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
  $('soundHint').hidden = false;
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
const BATTLE_ASSET_FILES = ['Skeleton_Minion.glb', 'Skeleton_Warrior.glb', 'Skeleton_Rogue.glb', 'Skeleton_Crossbow.gltf',
  'Skeleton_Arrow.gltf', 'Skeleton_Blade.gltf', 'Skeleton_Axe.gltf', 'Skeleton_Shield_Small_A.gltf'];
let battleAssetsPromise = null, battleAssetsReady = false, battleLoadingVisible = false, battleGateId = 0;
let battleLoadProgress = { done: 0, total: BATTLE_ASSET_FILES.length };

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
    if (battleLoadingVisible) $('overlayText').textContent = `Preparando batalha... ${done}/${total}`;
  }).then(() => { battleAssetsReady = true; });
  battleAssetsPromise = battleAssetsPromise.catch((error) => { battleAssetsPromise = null; throw error; });
  return battleAssetsPromise;
}

function preloadBattleAssets() {
  ensureBattleAssets().catch((error) => console.warn('Não foi possível antecipar os modelos da batalha:', error));
}

function withBattleAssets(ready) {
  if (battleAssetsReady) return ready();
  const request = ++battleGateId;
  battleLoadingVisible = true;
  game.paused = true;
  const pending = ensureBattleAssets();
  if (battleAssetsReady) { battleLoadingVisible = false; return ready(); }
  $('overlayBtn').hidden = true;
  $('overlayText').textContent = `Preparando batalha... ${battleLoadProgress.done}/${battleLoadProgress.total}`;
  $('overlay').classList.remove('hidden');
  return pending.then(() => {
    if (request !== battleGateId) return;
    battleLoadingVisible = false;
    $('overlay').classList.add('hidden');
    $('overlayBtn').hidden = true;
    $('overlayBtn').textContent = 'Jogar de novo';
    $('overlayBtn').onclick = () => startGame(game.mission ? 'map' : 'menu');
    ready();
  }, (error) => {
    if (request !== battleGateId) return;
    battleLoadingVisible = false;
    console.error('Falha ao preparar a batalha:', error);
    $('overlayText').textContent = 'Não foi possível preparar a batalha. Verifique sua conexão e tente novamente.';
    $('overlayBtn').textContent = 'Tentar novamente';
    $('overlayBtn').hidden = false;
    $('overlayBtn').onclick = () => withBattleAssets(ready);
  });
}

async function loadAssets() {
  const files = [...new Set([...VARIANTS.map((h) => `${h.model}.glb`), ...CHARACTER_ASSETS.map((n) => `${n}.glb`), 'Skeleton_Staff.gltf', 'Skeleton_Quiver.gltf'])];
  await loadAssetFiles(files, (done, total) => { $('overlayText').textContent = `Carregando modelos... ${done}/${total}`; });
  // Monta cada receita uma vez; retratos e unidades reaproveitam suas peças.
  // variantes comuns ganham as cores e acessórios de looks.js
  for (const cfg of VARIANTS) {
    if (cfg.recipe) { cfg.built = buildCharacter(assets, cfg.recipe); continue; }
    const scene = SkeletonUtils.clone(assets[cfg.model].scene);
    if (LOOKS[cfg.id]) applyLook(scene, assets, LOOKS[cfg.id]);
    cfg.built = { scene, animations: assets[cfg.model].animations };
  }
}

// ---------- unidades ----------
const units = [];
const tmp = new THREE.Vector3();
const moveDir = new THREE.Vector3(), stepNext = new THREE.Vector3();   // reaproveitados a cada quadro

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

class Unit {
  constructor(gltf, stats, team) {
    this.root = SkeletonUtils.clone(gltf.scene);
    this.mats = [];   // materiais próprios para piscar ao levar golpe sem afetar os outros
    const skinned = [];
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material.userData?.vfx) { o.castShadow = o.frustumCulled = false; return; }   // chama em shader: material compartilhado, sem sombra
      o.castShadow = true;
      o.frustumCulled = true;
      if (o.isSkinnedMesh) skinned.push(o);
      o.material = o.material.clone();
      this.mats.push(o.material);
      rememberUnitEmissive(o.material);
    });
    fitCullingSphere(skinned);
    this.vel = new THREE.Vector3();   // velocidade atual: acelera e freia aos poucos
    this.moving = false;
    this.flash = 0;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = gltf.animations;
    this.actions = {};
    this.current = null;
    Object.assign(this, { team, maxHp: stats.hp, hp: stats.hp, dmg: stats.dmg, range: stats.range, speed: stats.speed, cooldown: stats.cooldown });
    this.size = 1;
    this.attackTimer = Math.random() * 0.5;
    this.busy = 0;          // tempo travado em ataque/golpe/surgimento
    this.pendingHit = null;
    this.dead = false;
    this.synergyNoticeT = 0;
    this.bar = document.createElement('div');
    this.bar.className = `hp ${team === 'hero' ? 'ally' : ''}`;
    this.bar.innerHTML = '<i></i>';
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
    if (!this.actions[name]) this.actions[name] = this.mixer.clipAction(THREE.AnimationClip.findByName(this.clips, name));
    return this.actions[name];
  }

  loop(name) {
    const a = this.action(name);
    if (this.current === a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (this.current) a.crossFadeFrom(this.current, 0.2, false);
    this.current = a;
  }

  once(name, timeScale = 1, fade = 0.1) {
    const a = this.action(name);
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

  // anda até o alvo desviando dos obstáculos que estão na frente
  moveTo(target, dt) {
    target = world.nextWaypoint(this.pos, target, this, queryObstacleCandidates);
    const dir = moveDir.subVectors(target, this.pos).setY(0);
    const d = dir.length();
    if (d < 0.05) return;
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
    dir.normalize();
    const terrainSpeed = (this.slowT > 0 ? 0.5 : 1) * (world.isShallow(this.pos.x, this.pos.z) ? 0.6 : 1);
    const approachSpeed = Math.min(this.speed, d * 1.75) * terrainSpeed; // limita a frenagem para não ultrapassar o alvo
    this.vel.lerp(dir.multiplyScalar(approachSpeed), Math.min(1, dt * 7));
    this.moving = true;
    this.face(tmp.copy(this.pos).add(this.vel), dt);
  }

  // anima a locomoção no ritmo da velocidade real (sem "patinar")
  locomote(run, walk, idle) {
    const v = this.vel.length();
    if (v < 0.25) return this.loop(idle);
    const a = this.action(v > this.speed * 0.55 ? run : walk);
    this.loop(a.getClip().name);
    a.timeScale = THREE.MathUtils.clamp(0.55 + 0.55 * (v / this.speed), 0.6, 1.3);
  }

  attack(target, name) {
    const dur = this.once(name, 1.3 * (this.team === 'hero' ? this.cfg.cooldown / this.cooldown : 1));
    this.busy = dur * 0.9;
    this.attackTimer = this.cooldown;
    this.pendingHit = { target, t: dur * 0.4 };
    if (this.stats) this.stats.ataques++;
    if (!this.ranged) this.vel.add(tmp.subVectors(target.pos, this.pos).setY(0).normalize().multiplyScalar(2.2));   // passo à frente
  }

  takeDamage(n, from, owner = null, critical = false) {
    if (this.dead || game.over) return;
    // golpe corpo a corpo não alcança quem está em outro nível (os vikings arremessam o machado)
    if (owner && !owner.ranged && !['viking', 'iceviking'].includes(owner.cfg?.id) && Math.abs(owner.pos.y - this.pos.y) >= 0.85) return;
    if (this.ward) { n = absorbWard(this, n); if (!(n > 0)) return; }   // escudo de ossos do xamã
    if (this.kind?.hurt) { n = this.kind.hurt(this, n, from, owner); if (!(n > 0)) return; }   // escudos dos monstros
    if (this.team === 'hero') {
      if (this.oathUntil > game.runTime) return;   // Juramento final: invulnerável por instantes
      if (this.immuneT > 0) return;   // Meditação do Monge: imune enquanto medita
      if (this.cfg.id === 'assassin' && this.dodgeTimer <= 0) {
        this.dodgeTimer = (7 - this.level) * this.skillRate;
        this.busy = this.once(Math.random() < 0.5 ? 'Dodge_Left' : 'Dodge_Right', 1.5);
        this.pendingHit = null;
        popText(this.pos, 'Esquiva!', 'heal');
        this.stats.esquivas++;
        return;
      }
      if (this.bladeDanceT > 0 && Math.random() < 0.35) {   // girando, o Duelista desvia de parte dos golpes
        popText(this.pos, 'Esquiva!', 'heal');
        this.stats.esquivas++;
        return;
      }
      n *= this.damageTaken;
      if (this.guardT > 0) n *= 0.6;
      const protection = synergyDamageTakenMultiplier(this, partyNow());
      if (protection < 1) {
        n *= protection;
        if (this.synergyNoticeT <= 0) { popText(this.pos, SYNERGIES[2].name, 'heal'); this.synergyNoticeT = 1.2; }
      }
      if (canBlock(this) && Math.random() < 0.3) {
        n *= 0.5;
        popText(this.pos, 'Bloqueio!', 'block');
        if (this.busy <= 0 && THREE.AnimationClip.findByName(this.clips, 'Block_Hit')) this.busy = this.once('Block_Hit', 1.5);
        if (hasRelic('bulwark-banner')) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.05);
      }
      n = relicGuard(this, n);
      if (n <= 0) return;
    } else if (this.markT > 0) n *= 1 + this.markBonus;   // Flecha do caçador: o alvo marcado sofre mais de todos
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
      if (hasRelic('thorn-mail') && !owner.ranged && !owner.dead) owner.takeDamage(real * 0.35, null, this);   // Cota de espinhos
    }
    this.hp -= n;
    if (owner) this.lastHit = owner;
    const heavy = critical || !!owner?.ultHit;   // crítico e ultimate piscam branco e mostram o número grande
    this.flash = heavy ? 0.12 : 0.14;
    this.flashHeavy = heavy;
    this.squashT = 0.25;
    popText(this.pos, Math.round(n), this.team === 'hero' ? 'hurt' : heavy ? 'crit' : 'dmg');
    audio.play(this.team === 'hero' ? 'hurt' : 'hit');
    if (from) {   // recua com o impacto
      const k = (this.boss ? 0.6 : this.team === 'hero' ? 1.6 : 3.2);
      this.vel.add(tmp.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(k));
    }
    if (this.hp <= 0) return this.die();
    if (!this.pendingHit && !this.boss && this.busy <= 0) { this.busy = this.once(this.team === 'hero' ? 'Hit_A' : 'Hit_B', 1.6) * 0.8; }
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.pendingHit = null;
    this.once(this.team === 'hero' ? 'Death_A' : 'Death_C_Skeletons');
    this.deadTime = 0;
    this.bar.style.display = 'none';
    if (this.team === 'hero') {
      this.diedIn = game.phase;   // no Pesadelo, decide quando volta
      game.fallLog.push({ name: this.cfg.names?.[this.level - 1] || this.cfg.name, phase: game.phase, time: game.runTime });
    }
    if (this.team === 'skeleton' && !this.dissolved) {
      audio.play('bones');
      game.kills++;
      if (this.lastHit?.stats) this.lastHit.stats.abates++;
      if (this.lastHit?.militia && game.militia) game.militia.kills++;
      for (const h of heroes()) if (!h.dead) h.gainXp((this.boss ? 12 : 3) + (h === this.lastHit ? 2 : 0));
      monsterDied(this);
      relicOnKill(this);
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
    this.mixer.update(dt);
    this.attackTimer -= dt;
    this.busy -= dt;
    // inércia: quem não está andando vai freando; a velocidade (e o recuo) move a unidade
    if (!this.moving) this.vel.multiplyScalar(Math.max(0, 1 - dt * 9));
    this.moving = false;
    if (!this.dead && !game.over) {
      const next = stepNext.copy(this.pos).addScaledVector(this.vel, dt);
      if (this.phasing || world.canStep(this.pos, next)) this.pos.copy(next);   // fantasmas atravessam obstáculos
      else this.vel.set(0, 0, 0);
      this.pos.y = world.groundHeight(this.pos.x, this.pos.z) + (this.hover || 0) + (this.lift || 0);   // lift: salto/levitação visual das habilidades
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
        else if (this.cleave) damageCleave(this, target);
        else if (!target.dead && Math.abs(target.pos.y - this.pos.y) < 0.85 && target.pos.distanceTo(this.pos) <= this.range + 0.6 * target.size + (target.reach || 0)) this.team !== 'skeleton' ? heroHit(this, target, this.dmg) : target.takeDamage(this.dmg, this.pos, this);
      }
    }
  }
}

// som do golpe comum de cada herói (e dos esqueletinhos do necromante)
const swingSound = (u) => u.ranged ? ({ crossbow: 'arrow', archer: 'arrow', pyro: 'fire', cryo: 'ice', alchemist: 'ice' }[u.cfg.id] || 'zap') : u.cfg.id === 'monk' ? 'hit' : u.cfg.classId === 1 ? 'axe' : 'sword';

const skeletonsAlive = () => units.filter((u) => u.team === 'skeleton' && !u.dead);
const heroes = () => units.filter((u) => u.team === 'hero');
const allies = () => units.filter((u) => u.team !== 'skeleton' && !(u.captive && !u.rescued));   // o prisioneiro preso não é alvo
const enemyTargetAllies = () => {
  const list = allies();
  return game.mission?.goal?.type === 'defend' && game.shrine
    ? list.filter((unit) => unit !== game.shrine)
    : list;
};
let activeTargetContext = null;
const frameTargetContext = { party: [], rangedHeroes: [], friends: [], skeletons: [], attackableSkeletons: [], alliedUnits: [], livingAllies: [], rescueThreats: [], defenseAnchor: null, twinFocusChecked: false, twinFocus: null, twinFocusWaiting: false };

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
  context.goal = goal;
  context.party = party;
  context.rangedHeroes = rangedHeroes;
  context.friends = friends;
  context.villager = villager;
  context.plateauBonus = world.zoneOf(game.phase)?.type === 'plateau' ? 7 : 0;
  context.defenseAnchor = goal?.type === 'defend' || goal?.type === 'breach'
    ? party.find((hero) => !hero.dead) || null : null;
  context.skeletons = skeletons;
  context.attackableSkeletons = attackableSkeletons;
  const destructionGoal = goal?.type === 'totems' || goal?.type === 'tower';
  const destructionWavePending = destructionGoal && game.state === 'fight' && game.toSpawn > 0;
  context.hasNonTotemTarget = attackableSkeletons.some((enemy) => !enemy.totem)
    || (destructionGoal && skeletons.some((enemy) => enemy.spawning && !enemy.totem))
    || destructionWavePending;
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
const partyNow = () => activeTargetContext?.party || heroes();   // grupo do quadro, sem refiltrar as unidades a cada golpe

function applySynergy(attack, owner, target, damage) {
  const members = partyNow();
  if (attack === 'fire' && owner.cfg.id === 'pyro'
    && members.some((h) => ['cryo', 'druid'].includes(h.cfg.id))) {
    const multiplier = synergyDamageMultiplier('fire', target);
    if (multiplier > 1) {
      if ((target.synergyNoticeT || 0) <= 0) { popText(target.pos, 'Sinergia +20%!', 'evolve'); target.synergyNoticeT = 1.2; }
      return damage * multiplier;
    }
  }
  if (attack === 'piercing' && ['crossbow', 'ninja', 'archer'].includes(owner.cfg.id)
    && members.some((h) => h.cfg.id === 'druid')) {
    const multiplier = synergyDamageMultiplier('piercing', target);
    if (multiplier > 1) {
      if ((target.synergyNoticeT || 0) <= 0) { popText(target.pos, 'Sinergia +20%!', 'evolve'); target.synergyNoticeT = 1.2; }
      return damage * multiplier;
    }
  }
  return damage;
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

function damageCleave(owner, primary) {
  for (const s of skeletonsAlive()) {
    if (s.spawning || !inMeleeArc(owner, s)) continue;
    const secondary = s !== primary;
    const before = s.vel.clone();
    heroHit(owner, s, owner.dmg * (secondary ? 0.6 : 1));
    if (secondary) s.vel.sub(before).multiplyScalar(0.5).add(before);
  }
}

function damageArea(center, radius, dmg, owner = null) {
  for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(center) <= radius + 0.4 * (s.size - 1)) {
    if (owner) heroHit(owner, s, dmg, center);
    else s.takeDamage(dmg, center);
  }
}

function heroHit(owner, target, dmg, center = owner.pos) {
  const attack = ['crossbow', 'ninja', 'archer'].includes(owner.cfg.id) ? 'piercing' : owner.cfg.id === 'pyro' ? 'fire' : null;
  if (attack) dmg = applySynergy(attack, owner, target, dmg);
  const critical = owner.cfg.id === 'assassin' && Math.random() < Math.min(0.7, (0.35 + (owner.level - 1) * 0.05) * owner.skillPower);
  target.takeDamage(dmg * (critical ? 2 : 1) * (owner.royalT > 0 ? 1 + owner.royalBonus : 1), center, owner.summoner || owner, critical);
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

const fixedDefenseGoal = (goal) => goal?.type === 'defend' || goal?.type === 'breach';
function defenseAnchor(context) {
  if (!fixedDefenseGoal(context.goal)) return null;
  if (context.defenseAnchor && !context.defenseAnchor.dead) return context.defenseAnchor;
  context.defenseAnchor = context.party.find((hero) => !hero.dead) || null;
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

function hasTacticalInterceptSlot(hero, target, context, limit, slots) {
  const { goal, party, plateauBonus = 0 } = context;
  let first = null, second = null, firstDistance = Infinity, secondDistance = Infinity;
  for (const candidate of party) {
    if (candidate.dead || (fixedDefenseGoal(goal) && candidate === defenseAnchor(context))) continue;
    const distance = tacticalDistance(candidate.post, target.pos);
    const normalReach = distance <= LEASH + candidate.range + plateauBonus
      || tacticalDistance(candidate.pos, target.pos) <= candidate.range + 1.5;
    if (normalReach || distance > limit) continue;
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

function anotherDefenseHeroCanIntercept(hero, target, context) {
  const { party, villager, plateauBonus = 0 } = context;
  for (const ally of party) {
    if (ally === hero || ally.dead) continue;
    const fromPost = tacticalDistance(ally.post, target.pos);
    if (fromPost <= LEASH + ally.range + plateauBonus
      || tacticalDistance(ally.pos, target.pos) <= ally.range + 1.5) return true;
    if (villager && fromPost <= LEASH + ally.range + plateauBonus + 5
      && (target.pendingHit?.target === villager || tacticalDistance(villager.pos, target.pos) <= 10.5)) return true;
  }
  return false;
}

// quem já está brigando só larga o alvo quando ele se afasta bem do posto (evita ir e voltar na borda)
function stillEngaged(hero, target, context = targetContext()) {
  if (hero.engagedWith !== target) return false;
  const { villager, plateauBonus = 0 } = context;
  const fromPost = tacticalDistance(hero.post, target.pos);
  if (hero === defenseAnchor(context)) {
    const canCoverFromPost = fromPost <= hero.range + plateauBonus + 0.5;
    const objectiveAttack = villager && target.pendingHit?.target === villager
      && fromPost <= LEASH + hero.range + plateauBonus + 5
      && !anotherDefenseHeroCanIntercept(hero, target, context);
    const lastDefenderKeepsThreat = hero.engagedWith === target
      && hero.lastDefenderThreatTarget === target
      && fromPost <= LEASH + hero.range + plateauBonus + 5
      && context.party.every((ally) => ally === hero || ally.dead);
    return canCoverFromPost || !!objectiveAttack || lastDefenderKeepsThreat;
  }
  return fromPost <= LEASH + hero.range + ENGAGE_SLACK;
}

// Heróis à distância recuam alguns passos quando um inimigo corpo a corpo encosta, puxando para o
// posto (atrás da linha de frente), e voltam a atirar; a recarga evita que passem a luta fugindo.
const KITE_TRIGGER = 2.2, KITE_STEP = 2.6, KITE_TIME = 0.7, KITE_COOLDOWN = 3;
const kiteAway = new THREE.Vector3(), kiteHome = new THREE.Vector3();
function kiteFrom(h, dt) {
  h.kiteCd = Math.max(0, (h.kiteCd || 0) - dt);
  if (h.kiteT > 0) { h.kiteT -= dt; return h.kiteTo; }
  if (h.kiteCd > 0) return null;
  let threat = null, best = KITE_TRIGGER;
  for (const s of activeTargetContext?.attackableSkeletons ?? skeletonsAlive()) {
    if (s.dead || s.spawning || s.ranged || s.totem) continue;
    const d = tacticalDistance(s.pos, h.pos);
    if (d < best) { best = d; threat = s; }
  }
  if (!threat) return null;
  kiteAway.subVectors(h.pos, threat.pos).setY(0).normalize();
  kiteHome.subVectors(h.post, h.pos).setY(0);
  if (Math.hypot(kiteHome.x, kiteHome.z) > 0.1) kiteAway.add(kiteHome.normalize().multiplyScalar(0.6)).normalize();
  h.kiteTo ||= new THREE.Vector3();
  h.kiteTo.copy(h.pos).addScaledVector(kiteAway, KITE_STEP);
  if (tacticalDistance(h.kiteTo, h.post) > LEASH) h.kiteTo.copy(h.post);   // nunca sai da corda tática
  h.kiteT = KITE_TIME;
  h.kiteCd = KITE_COOLDOWN;
  return h.kiteTo;
}

const hasDestructionGoal = (goal) => goal?.type === 'totems' || goal?.type === 'tower';
// objetivos que terminam com o chefe da fase: chefe, duelo e o par Lich + Carrasco
const bossGoal = (goal) => goal?.type === 'boss' || goal?.type === 'duel' || goal?.type === 'twin' || goal?.type === 'bosses';
const groupedBossGoal = (goal) => goal?.type === 'twin' || goal?.type === 'bosses';

function canHeroReachTarget(hero, target, context = targetContext()) {
  const { goal, plateauBonus, party, villager } = context;
  const fromPost = tacticalDistance(hero.post, target.pos);
  // No resgate, o corredor precisa alcançar guardas junto ao prisioneiro mesmo fora do leash do grupo.
  if (goal?.type === 'rescue' && hero === game.rescueRunner && context.rescueThreats?.includes(target)) return true;
  if (fixedDefenseGoal(goal) && hero === defenseAnchor(context)) {
    // Depois da defesa, não entram mais ondas: a âncora pode sair do posto para
    // limpar os sobreviventes, mas continua dentro do alcance da fase.
    if (goal.type === 'defend' && game.surviveT <= 0 && fromPost <= DEFENSE_CLEANUP_INTERCEPT) return true;
    // A âncora luta do próprio posto. Só abandona a linha se o alvo já prepara
    // um golpe no objetivo e nenhum outro herói vivo consegue interceptá-lo.
    if (fromPost <= hero.range + plateauBonus + 0.5) return true;
    const objectiveAttack = villager && target.pendingHit?.target === villager
      && fromPost <= LEASH + hero.range + plateauBonus + 5
      && !anotherDefenseHeroCanIntercept(hero, target, context);
    const lastDefenderThreat = target.pendingHit?.target === hero
      && fromPost <= LEASH + hero.range + plateauBonus + 5
      && !party.some((ally) => ally !== hero && !ally.dead);
    if (lastDefenderThreat) hero.lastDefenderThreatTarget = target;
    return !!objectiveAttack || lastDefenderThreat;
  }
  const normalReach = fromPost <= LEASH + hero.range + plateauBonus || tacticalDistance(hero.pos, target.pos) <= hero.range + 1.5;
  const huntTarget = goal?.type === 'hunt' && target === game.huntMark && target.hunted;
  if (huntTarget && !normalReach) {
    if (fromPost > HUNT_PURSUIT_LIMIT) return false;
    return hasTacticalInterceptSlot(hero, target, context, HUNT_PURSUIT_LIMIT, HUNT_INTERCEPTORS);
  }
  // No Trono, o Lich móvel pode parar fora do alcance normal enquanto ataca
  // o grupo. Dois heróis o interceptam por uma distância curta e o resto guarda posição.
  if (groupedBossGoal(goal) && target.phaseBoss && !normalReach) {
    return hasTacticalInterceptSlot(hero, target, context, TWIN_BOSS_INTERCEPT, TWIN_BOSS_INTERCEPTORS);
  }
  if (normalReach) return true;

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
  const interceptLimit = LEASH + hero.range + plateauBonus + 5;
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

  // Totens ficam fora da estrada e merecem uma perseguição controlada durante essa missão;
  // sem inimigos comuns restantes, o grupo vai até o objetivo a qualquer distância.
  const hasNonTotemTarget = context.hasNonTotemTarget ?? context.attackableSkeletons.some((s) => !s.totem);
  if (hasDestructionGoal(goal) && target.totem && !hasNonTotemTarget) return true;
  return hasDestructionGoal(goal) && target.totem && fromPost <= LEASH + hero.range + 5;
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
  if (target.totem) score -= hasDestructionGoal(goal) ? 12 : 1;
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
    if (target.pendingHit?.target === villager) score -= 11;
    else if (toVillager < 12) score -= (12 - toVillager) * 0.8;
  }

  // Evita gastar golpes em um alvo quase derrotado quando outro aliado já o
  // está finalizando. Chefes, sacerdotes, bombardeiros e ameaças objetivas
  // continuam concentrando o grupo.
  const healthRatio = target.maxHp > 0 ? Math.max(0, target.hp / target.maxHp) : 1;
  const urgentTarget = (goal?.type === 'hunt' && target === game.huntMark && target.hunted) || target.boss || target.totem || target.ranged
    || target.enemyKind === 'Priest' || target.enemyKind === 'Bomber' || target.kind?.priority || target.pendingHit
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
      ? (1.1 + (hero.level - 1) * 0.2) * hero.skillPower
      : (1.3 + (hero.level - 1) * 0.25) * hero.skillPower;
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

function isUrgentTwinThreat(target, context) {
  return target.pendingHit?.target?.team === 'hero' || target.pendingHit?.target?.team === 'villager'
    || target.enemyKind === 'Priest' || !!target.kind?.priority
    || (target.enemyKind === 'Bomber' && context.friends.some((friend) => !friend.dead && tacticalDistance(friend.pos, target.pos) < 7));
}

function chooseHeroTarget(hero, candidates, dt, context = targetContext()) {
  hero.targetFocusT = Math.max(0, (hero.targetFocusT || 0) - dt);
  let best = null, bestScore = Infinity, focused = null, focusedScore = Infinity;
  let urgentTwinTarget = null, urgentTwinScore = Infinity;
  for (const target of candidates) {
    if (target.dead || target.spawning || !(canHeroReachTarget(hero, target, context) || stillEngaged(hero, target, context))) continue;
    const score = heroTargetScore(hero, target, hero.pos, context);
    if (target === hero.targetFocus) { focused = target; focusedScore = score; }
    if (score < bestScore) { best = target; bestScore = score; }
    if (groupedBossGoal(context.goal) && isUrgentTwinThreat(target, context) && score < urgentTwinScore) {
      urgentTwinTarget = target;
      urgentTwinScore = score;
    }
  }
  const { goal, villager, party, friends } = context;
  if (groupedBossGoal(goal)) {
    const focus = twinBossFocus(context);
    if (urgentTwinTarget) { best = urgentTwinTarget; bestScore = urgentTwinScore; }
    else if (focus && (canHeroReachTarget(hero, focus, context) || stillEngaged(hero, focus, context))) {
      best = focus;
      bestScore = heroTargetScore(hero, focus, hero.pos, context);
    } else if (focus) { best = null; bestScore = Infinity; }
  } else if (game.twinFocus) game.twinFocus = null;
  if (!best) {
    hero.targetFocus = null;
    hero.targetFocusT = 0;
    hero.targetEligible = null;
    return null;
  }

  // Mantém o foco por um instante, exceto quando surge uma ameaça claramente mais urgente.
  const urgentEscortTarget = villager
    && (best.pendingHit?.target === villager || tacticalDistance(villager.pos, best.pos) <= 4.5);
  let urgentNoFallTarget = goal?.type === 'nofall' && best.pendingHit?.target?.team === 'hero';
  if (goal?.type === 'nofall' && !urgentNoFallTarget) for (const ally of party) {
    if (!ally.dead && ally.hp / ally.maxHp <= 0.45 && tacticalDistance(ally.pos, best.pos) <= 4.5) { urgentNoFallTarget = true; break; }
  }
  const urgentAllyThreat = best.pendingHit?.target?.team === 'hero' || best.pendingHit?.target?.team === 'villager';
  const urgentPriest = best.enemyKind === 'Priest' || !!best.kind?.priority;
  const urgentBomber = best.enemyKind === 'Bomber'
    && friends.some((friend) => !friend.dead && tacticalDistance(friend.pos, best.pos) < 7);
  const urgentObjectiveTarget = (bossGoal(goal) && best.boss)
    || (hasDestructionGoal(goal) && best.totem)
    || (goal?.type === 'hunt' && best === game.huntMark && best.hunted)
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
const bolts = [], blasts = [], flames = [];
const boltGeo = new THREE.SphereGeometry(0.2, 10, 10);
const bladeGeo = new THREE.ConeGeometry(0.09, 0.65, 4);
const axeGeo = new THREE.BoxGeometry(0.45, 0.12, 0.3);
const handleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 5);
const flameGeo = new THREE.ConeGeometry(0.2, 0.65, 5);
const groundGeo = new THREE.CircleGeometry(1, 24);
const ringGeo = new THREE.RingGeometry(0.75, 1, 32);
const haloGeo = new THREE.TorusGeometry(0.35, 0.06, 6, 24);
const beamGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6);
const colors = { pyro: 0xff883d, cryo: 0x8be8ff, arcane: 0xc999ff, viking: 0xd6e9ef, iceviking: 0x8be8ff, necro: 0x9fffb0, druid: 0xa8e07a, crossbow: 0xffed9e, ninja: 0xc7d0ff, archer: 0xe8f6ee, alchemist: 0xb8ff6a, flask: 0x9cff3a, tonic: 0xff8ad8 };
const boltMats = Object.fromEntries(Object.entries(colors).map(([k, color]) => [k, new THREE.MeshBasicMaterial({ color })]));
const goldMat = new THREE.MeshBasicMaterial({ color: 0xffdf70 });

function ring(at, radius, color, life = 0.6) {
  const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(at).setY(at.y + 0.07);
  mesh.scale.setScalar(radius);
  scene.add(mesh);
  blasts.push({ mesh, t: life, life });
}

function beam(start, end, color) {
  const mesh = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
  const dir = new THREE.Vector3().subVectors(end, start);
  mesh.position.copy(start).add(end).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.3, 0));
  mesh.scale.y = dir.length();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  scene.add(mesh);
  blasts.push({ mesh, t: 0.25, life: 0.25 });
}

function fireBolt(from, target, kind = 'magic', angle = 0, skill = false) {
  const axe = kind === 'viking' || kind === 'iceviking';
  const arrow = kind === 'crossbow' || kind === 'ninja' || from.cfg.id === 'archer';   // a flecha comum da Arqueira também é ponta fina
  const mesh = new THREE.Mesh(axe ? axeGeo : arrow ? bladeGeo : boltGeo, boltMats[kind] || boltMats[from.cfg.id] || boltMats.arcane);
  if (axe) {
    const handle = new THREE.Mesh(handleGeo, boltMats.viking);
    handle.position.y = -0.25;
    mesh.add(handle);
  }
  mesh.position.copy(from.pos).setY(from.pos.y + 1.3);
  const dir = new THREE.Vector3().subVectors(target.pos, from.pos).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(mesh);
  const bolt = { mesh, target, owner: from, kind, dir, hit: new Set(), life: Math.max(1, from.range / 14 + 0.2), dmg: from.dmg, level: from.level, power: kind === 'magic' || !skill ? 1 : from.skillPower, skill };   // o tiro básico não escala
  FX.look(bolt, skill);   // cada atirador com seu projétil (fogo, raio, gelo, orbe, espinho, virote)
  if (skill && (kind === 'pyro' || kind === 'flask' || kind === 'tonic')) {   // a bola grande e os frascos fazem um arco no ar até o alvo
    bolt.base = mesh.position.clone();
    bolt.dist0 = Math.max(0.1, bolt.base.distanceTo(target.pos));
    bolt.arc = 1.2 + bolt.dist0 * 0.18;
  }
  bolts.push(bolt);
}

const boltGoalScratch = new THREE.Vector3();
const piercingStartScratch = new THREE.Vector3();
const piercingOffsetScratch = new THREE.Vector3();
const piercingHeightOffset = new THREE.Vector3(0, 1.3, 0);

function updateBolts(dt) {
  if (dt <= 0) return;
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
      if (d <= 14 * dt + 0.25 && (b.kind === 'flask' || b.kind === 'tonic')) { alchemyPool(b.owner, b.target.pos, b.kind === 'tonic'); b.life = 0; }
      else if (d <= 14 * dt + 0.25) {
        const radius = b.kind === 'magic' ? b.owner.cfg.splash || 0 : b.kind === 'viking' ? 0 : (b.kind === 'pyro' ? 1.1 + (b.level - 1) * 0.2 : 1.3 + (b.level - 1) * 0.25) * b.power;
        if (radius) damageArea(b.target.pos, radius, b.dmg, b.owner);
        else if (!b.target.dead) heroHit(b.owner, b.target, b.dmg * (b.kind === 'viking' ? 1.8 * b.power : 1));
        relicBounce(b);
        if (b.kind === 'pyro') {
          // chão chamuscado; as brasas e as chamas em shader vêm de FX.fireField e apagam com ele
          const mesh = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({ color: 0x3a1608, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false }));
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.copy(b.target.pos).setY(b.target.pos.y + 0.06);
          mesh.scale.setScalar(radius);
          scene.add(mesh);
          flames.push({ mesh, radius, owner: b.owner, dmg: b.dmg * 0.15, t: (1.5 + b.level * 0.5) * b.power, tick: 0 });
          FX.fireField(mesh, radius);
        }
        if (b.kind === 'cryo' || b.kind === 'iceviking') {
          if (targetSnapshot === null) targetSnapshot = frameTargetContext.skeletons.length ? frameTargetContext.skeletons : skeletonsAlive();
          for (const s of targetSnapshot) if (!s.dead && s.pos.distanceTo(b.target.pos) <= radius) s.slowT = scaleBranchEffect(b.owner, 'control', 3 + (b.level - 1) * 0.5) * b.power;
        }
        ring(b.target.pos, Math.max(0.5, radius), colors[b.kind] || 0xc999ff);
        if (b.skill || b.look) FX.impact(b.skill ? b.kind : 'basic', b.target.pos, Math.max(0.6, radius), b.look);
        b.life = 0;
      }
    }
    if (b.kind === 'viking' || b.kind === 'iceviking') b.mesh.rotateZ(dt * 18);
    if (b.life <= 0) { scene.remove(b.mesh); bolts.splice(i, 1); }
  }
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i];
    if (f.wait > 0) { f.wait -= dt; continue; }   // aviso no chão antes do golpe (chuva de flechas, frasco no ar)
    f.t -= dt; f.tick -= dt;
    f.mesh.material.opacity = Math.min(0.45, f.t * 0.45);   // o fogo de FX.fireField segue esta opacidade
    if (f.tick <= 0 && dt > 0) {
      if (f.every) poolTick(f);   // áreas novas: dano/cura por pulso já no valor do pulso
      else damageArea(f.mesh.position, f.radius, f.dmg * 0.5, f.owner);
      f.tick += f.every || 0.5;
    }
    if (f.t <= 0) { scene.remove(f.mesh); f.mesh.material.dispose(); flames.splice(i, 1); }
  }
  for (let i = blasts.length - 1; i >= 0; i--) {
    const bl = blasts[i];
    bl.t -= dt;
    if (bl.ripple) bl.mesh.scale.addScalar(dt * 1.2);
    bl.mesh.material.opacity = Math.max(0, bl.t / bl.life) * 0.65;
    if (bl.t <= 0) { scene.remove(bl.mesh); bl.mesh.material.dispose(); blasts.splice(i, 1); }
  }
}

// ---------- áreas no chão da Arqueira e da Alquimista (mesma lista das chamas do Piromante) ----------
const ARCHER_SHOT = 1.3;   // Flecha longa: dano de cada inimigo atravessado (× dano do herói)

function groundMark(at, radius, color, opacity = 0.45) {
  const mesh = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity, depthWrite: false }));
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
  const radius = (1.6 + (owner.level - 1) * 0.2) * owner.skillPower * scale;
  const mesh = groundMark(at, radius, tonic ? 0x7a2a5a : 0x1f3a0e);
  flames.push({ mesh, radius, owner, t: (3.5 + owner.level * 0.5) * owner.skillPower, tick: 0, every: 0.5,
    dmg: tonic ? 0 : owner.dmg * 0.14,
    heal: tonic ? scaleBranchEffect(owner, 'support', 5 + owner.level * 2) * owner.skillPower : 0 });
  FX.pool(mesh, radius, tonic);
}

// Arqueira: marca a área no chão e, depois do aviso, cinco salvas de flechas caem sobre ela
function arrowRain(owner, at, radius, total) {
  const mesh = groundMark(at, radius, 0xe8f6ee, 0.25);
  flames.push({ mesh, radius, owner, wait: 0.55, t: 1.4, tick: 0, every: 0.3, dmg: total / 5, onTick: (f) => FX.arrowVolley(f.mesh.position, f.radius) });
  FX.rainMark(mesh, radius);
}

// Alquimista: o frasco voa, explode empurrando o grupo e deixa uma poça de veneno menor
function volatileFlask(owner, at, radius, dmg) {
  const mesh = groundMark(at, radius, 0x9cff3a, 0.2);
  flames.push({ mesh, radius, owner, wait: 0.4, t: 0.05, tick: 0, every: 1, dmg, onTick: (f) => {
    for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(f.mesh.position) <= f.radius + 0.4 * (s.size - 1))
      s.vel.add(new THREE.Vector3().subVectors(s.pos, f.mesh.position).setY(0).normalize().multiplyScalar(s.boss ? 1.5 : 4.5));
    FX.flaskBlast(f.mesh.position, f.radius);
    alchemyPool(owner, f.mesh.position, false, 0.6);
  } });
  FX.flaskToss(owner, at, 0.4);
}

// Tiros inimigos independentes dos poderes dos heróis.
const enemyBolts = [];
const enemyOrbMat = new THREE.MeshBasicMaterial({ color: 0xc591ee });
function fireEnemyBolt(from, target) {
  const mesh = from.enemyKind === 'Crossbow' ? assets.Skeleton_Arrow.scene.clone() : new THREE.Mesh(boltGeo, from.boltMat || enemyOrbMat);
  mesh.position.copy(from.pos);
  mesh.position.y += 1.3;
  scene.add(mesh);
  enemyBolts.push({ mesh, target, from, dmg: from.dmg, life: 3 });
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
      if (d < 12 * dt + 0.2) { b.target.takeDamage(b.dmg, b.from.pos, b.from); b.life = 0; }
    }
    if (b.life <= 0 || b.target.dead) { scene.remove(b.mesh); enemyBolts.splice(i, 1); }
  }
  updateMonsterFx(dt);   // avisos no chão e golpes especiais dos monstros
}
function waterSplash(at, spawn = false) {
  ring(at.clone().setY(at.y + 0.1), spawn ? 1 : 0.45, 0xc5f2f4, spawn ? 0.7 : 0.4);
  blasts[blasts.length - 1].ripple = true;
  if (!spawn) return;
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xa3e4f3, transparent: true }));
    m.position.copy(at).add(new THREE.Vector3(0, 0.15, 0)); m.scale.setScalar(0.3);
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
  popTextPool.show(text, cls, x, y, performance.now());
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
  arcane: { geo: boltGeo, core: hiddenCore, shells: [[glow(0xc999ff, 0.35), 2.1]], orb: ['arcane', 0.42], size: [1.6, 1.6], spin: true },
  cryo: { geo: iceGeo, core: hiddenCore, shells: [[glow(0x5fd0ff, 0.45), 1.35]], ice: true, size: [1.7, 2.6], aim: true },
  necro: { geo: boltGeo, core: hiddenCore, shells: [[glow(0x0f8a30, 0.4), 2.1]], orb: ['necro', 0.44], size: [1.7, 1.7], spin: true },
  druid: { geo: thornGeo, core: basic(0x9be05a), shells: [[glow(0x5fbf2a, 0.5), 1.3]], size: [1.9, 1.9], aim: true, roll: true },
  crossbow: { size: [1.4, 2] },
  archer: { size: [1.3, 2.2] },
  alchemist: { geo: boltGeo, core: hiddenCore, shells: [], orb: ['venom', 0.4], size: [1.3, 1.3], spin: true },
};
for (const L of Object.values(BOLT_LOOKS)) for (const m of [L.core, ...(L.shells || []).map((x) => x[0])]) if (m) m.userData.keep = true;
const steelMat = new THREE.MeshLambertMaterial({ color: 0x59627a, emissive: 0x1a2240 });
const starGlowMat = glow(0x6f8cff, 0.55);
for (const m of [eyeMat, barkMat, leafMat, steelMat, starGlowMat, flaskGlassMat, woolMat, sheepFaceMat]) m.userData.keep = true;   // compartilhados: não são descartados com o efeito
const TRAIL = { arcane: [0xb07cff, 0xffffff], necro: [0x40ff70, 0x0f8a30], druid: [0x8fe05a, 0xc8f07a], pyro: [0xffa040, 0xffe070], cryo: [0xbff6ff, 0x7fdcff], crossbow: [0xfff0a0, 0xffd84a], ninja: [0xc7d0ff, 0xffffff], viking: [0xe8f4ff, 0xb8dfe5], iceviking: [0x9fefff, 0xffffff], archer: [0x3fe0b0, 0xffffff], alchemist: [0x9cff3a, 0xe8ffb0], flask: [0x9cff3a, 0xe8ffb0], tonic: [0xff8ad8, 0xfff0fb] };
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
  bard:      { color: 0xe9a7ff, accent: 0xffe27a, glyph: arcGeo, scale: 0.8 },
  angel:     { color: 0xffe27a, accent: 0xffc6ed, glyph: crystalGeo, scale: 1.55 },
  chronist:  { color: 0x8feaff, accent: 0xb6a4ff, glyph: boltGeo, scale: 1.8 },
  archer:    { color: 0x3fe0b0, accent: 0xe8f6ee, glyph: shardGeo, scale: 1.8 },
  monk:      { color: 0xffc85a, accent: 0xfff2c8, glyph: thinRingGeo, scale: 0.45 },
  alchemist: { color: 0x9cff3a, accent: 0xff8ad8, glyph: shellGeo, scale: 2.2 },
};
const TARGETED_SKILLS = new Set(['assassin', 'duelist', 'monk', 'archer', 'alchemist', 'viking', 'iceviking', 'pyro', 'arcane', 'cryo', 'crossbow', 'ninja', 'angel']);
let shakeK = 0, stopT = 0;
const jolt = new THREE.Vector3();

function glow(color, opacity = 0.85, additive = true) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
}
// as partículas (faíscas, fumaça, pedrinhas) pegam o material destes estoques e o devolvem ao sumir
const particleMats = {
  add: materialPool(() => glow(0xffffff)),
  soft: materialPool(() => glow(0xffffff, 0.85, false)),
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
  while (skillFx.length) dropFx(skillFx.pop());
  shakeK = 0;
  stopT = 0;
}

// partícula que voa, cai (gravity) e some; smoke = fumaça opaca em vez de brilho
function particle(geo, color, at, vel, life, o = {}) {
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
function meteorFall(h, life, active) {
  const rock = vfxMesh('orb', 'fire', SPRITE, { size: 2.2 });
  const from = V(4, 16, -6);
  addFx(rock, life, (e, dt, k) => {
    if (!active()) { e.done = true; return; }
    const q = k * k;
    rock.position.copy(h.pos).add(V(from.x * (1 - q), 0.6 + from.y * (1 - q), from.z * (1 - q)));
    e.tr = (e.tr ?? 0) - dt;
    if (e.tr <= 0) {   // cauda: bolas menores que ficam para trás e se desfazem
      e.tr = lowQuality ? 0.06 : 0.03;
      sprite('orb', 'fire', rock.position.clone().add(V(rnd(0.3), rnd(0.3), rnd(0.3))), V(rnd(0.5), 0.6, rnd(0.5)), 0.45, { size: 1.5, grow: -0.6 });
    }
  });
}

// Piromante (Meteoro): impacto com anel de fogo, explosão, pilar de chamas e fumaça
function meteorImpact(at, reach) {
  flameRing(at, reach * 1.05, 18, 1.0, 'fire', 1.6);
  blast(at.clone().setY(at.y + 1.2), reach * 1.1, 0.75);
  blast(at.clone().setY(at.y + 2.6), reach * 0.6, 0.6);
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
  const m = new THREE.Mesh(o.geo || thinRingGeo, glow(color, o.opacity ?? 0.9, !o.dust));
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
  const m = new THREE.Mesh(columnGeo, glow(color, o.opacity ?? 0.55));
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
    outer.material.opacity = 0.82 * Math.sin(Math.PI * k);
    inner.scale.setScalar(0.8 + Math.sin(k * Math.PI) * 0.32);
    inner.rotation.z -= dt * 2.6;
    inner.material.opacity = 0.8 * Math.sin(Math.PI * k);
    if (ultRing) {
      ultRing.scale.setScalar((0.75 + k * 1.9) * pulse);
      ultRing.rotation.z -= dt * 3.5;
      ultRing.material.opacity = 0.9 * Math.sin(Math.PI * k);
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
  if (ultimate && h.cfg.id === 'pyro' && pending.skill?.effect === 'meteor') meteorFall(h, life, active);   // o meteoro cai até o disparo
  if (ultimate) {   // ultimate avisa: coluna da cor do herói que acende e aperta até o disparo
    const glowCol = new THREE.Mesh(columnGeo, glow(art.color, 0.4));
    addFx(glowCol, life, (e, dt, k) => {
      if (!active()) { e.done = true; return; }
      glowCol.position.copy(h.pos);
      const r = 1.15 - 0.6 * k + Math.sin(e.t * 26) * 0.05 * k;
      glowCol.scale.set(r, 2.4 + k * 1.6, r);
      glowCol.rotation.y += dt * 4;
      glowCol.material.opacity = 0.12 + 0.38 * k * k;
    });
  }
  // Trajetórias curvas, em vez de faíscas retas: convergem à frente do peito.
  const sparkCount = ultimate ? 16 : 10;
  for (let i = 0; i < sparkCount; i++) {
    const spark = new THREE.Mesh(sparkGeo, glow(i % 3 ? color : 0xffffff));
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
      spark.material.opacity = Math.sin(Math.PI * k);
    });
  }
}

// Pulso breve na liberação, sem encobrir os combatentes.
function release(h, ultimate = false) {
  const art = SKILL_ART[h.cfg.id] || { color: h.cfg.color[0], accent: 0xffffff, glyph: shellGeo, scale: 0.5 };
  const color = art.color;
  const origin = h.pos.clone().setY(h.pos.y + 1.15);
  origin.addScaledVector(V(Math.sin(h.root.rotation.y), 0, Math.cos(h.root.rotation.y)), 0.45);
  const flash = new THREE.Mesh(shellGeo, glow(0xffffff, 0.85));
  flash.position.copy(origin);
  addFx(flash, 0.2, (e, dt, k) => {
    flash.scale.setScalar(0.7 + 3 * (1 - (1 - k) ** 3));
    flash.material.opacity = e.base * (1 - k) ** 2;
  });
  const crest = new THREE.Mesh(art.glyph, glow(art.accent, 0.9));
  crest.position.copy(origin);
  addFx(crest, 0.38, (e, dt, k) => {
    crest.scale.setScalar(art.scale * (0.3 + k * 1.2));
    crest.rotation.y += dt * (h.cfg.id === 'ninja' ? 13 : 4);
    crest.rotation.z += dt * (h.cfg.id === 'assassin' ? 7 : 1.5);
    crest.material.opacity = 0.9 * (1 - k) ** 1.5;
  });
  burst(origin, [art.color, art.accent, 0xffffff], 8, 5, { life: 0.42, size: 1.25 });
  wave(h.pos, color, 0.65, 1.9, 0.38, { opacity: 0.65 });
  if (ultimate) {
    wave(h.pos, art.accent, 0.35, 6.2, 0.82, { geo: ringGeo, opacity: 0.82, spin: 3.5 });
    wave(h.pos, art.color, 0.55, 4.8, 0.68, { delay: 0.08, geo: ringGeo, opacity: 0.72, spin: -2.5 });
    burst(origin, [art.color, art.accent, 0xfff2b0, 0xffffff], 18, 7, { life: 0.68, size: 1.35 });
    const blaze = new THREE.Mesh(shellGeo, glow(0xffffff, 0.9));
    blaze.position.copy(origin);
    addFx(blaze, 0.28, (e, dt, k) => { blaze.scale.setScalar(1 + 9 * (1 - (1 - k) ** 3)); blaze.material.opacity = e.base * (1 - k) ** 2; });
    shake(0.3);
    hitStop(0.07);
  }
  for (let i = 0; i < 2; i++) {
    const arc = new THREE.Mesh(arcGeo, glow(color, 0.8));
    arc.rotation.set(-Math.PI / 2 + (i ? 0.5 : -0.5), h.root.rotation.y, i * Math.PI);
    addFx(arc, 0.32, (e, dt, k) => {
      arc.position.copy(origin);
      arc.scale.setScalar(0.45 + k * 1.25);
      arc.rotation.z += dt * (i ? -7 : 7);
      arc.material.opacity = e.base * (1 - k) ** 2;
    });
  }
}

// Paladino: coluna de luz dourada, faíscas subindo e cura verde em quem foi curado
function holyLight(h, friends, reach) {
  rays(h.pos, 'holy', 1.1, 9, 1.4);   // raios de luz em shader
  column(h.pos, 0xffffff, 0.4, 9, 1.0, { opacity: 0.5 });
  wave(h.pos, 0xfff0a0, 0.5, reach, 0.9);
  wave(h.pos, 0x8af5a8, 0.3, reach * 0.8, 1.1, { geo: ringGeo, opacity: 0.6, delay: 0.15 });
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * TAU, r = Math.random() * 1.2;
    particle(sparkGeo, i % 3 ? 0xffe27a : 0xffffff, V(h.pos.x + Math.cos(a) * r, h.pos.y + 0.2, h.pos.z + Math.sin(a) * r), V(0, 2.5 + Math.random() * 3, 0), 1.3, { size: 1.4, delay: Math.random() * 0.5 });
  }
  for (const f of friends) if (f !== h) {
    rays(f.pos, 'nature', 0.55, 3.5, 0.9, { follow: f });   // cura: raios verdes
    burst(f.pos.clone().setY(f.pos.y + 1), [0x8af5a8, 0xffffff], 8, 3, { gravity: -2 });
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
  wave(h.pos, 0x6fc3ff, 0.5, radius, 0.7);
  burst(h.pos.clone().setY(h.pos.y + 1), [0x6fc3ff, 0xffffff], 14, 5);
}

// Campeão: lâminas de luz girando em volta e rastro circular no chão
function whirl(h, radius) {
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(arcGeo, glow(i ? 0xffe59b : 0xffffff, 0.95));
    m.rotation.set(-Math.PI / 2, 0, (i * TAU) / 3);
    addFx(m, 0.75, (e, dt, k) => {
      m.position.copy(h.pos).setY(h.pos.y + 0.7 + i * 0.3);
      m.rotation.z += dt * (16 + i * 3);
      m.scale.setScalar(radius * (0.45 + 0.22 * i) * (0.5 + 0.5 * Math.min(1, e.t / 0.15)));
      m.material.opacity = e.base * (1 - k);
    });
  }
  wave(h.pos, 0xffe59b, 0.5, radius, 0.55, { geo: ringGeo, opacity: 0.7, spin: 9 });
  burst(h.pos.clone().setY(h.pos.y + 1), [0xffe59b, 0xffffff], 22, 8, { up: 0.3 });
  shake(0.25);
}

// Berserker: aura vermelha pulsando e fumaça enquanto a fúria durar
function fury(h) {
  wave(h.pos, 0xff3b3b, 0.4, 3.2, 0.6);
  burst(h.pos.clone().setY(h.pos.y + 1), [0xff5a3a, 0xffd0a0], 18, 5);
  const aura = new THREE.Mesh(columnGeo, glow(0xff2a2a, 0.35));
  addFx(aura, 30, (e, dt) => {
    aura.position.copy(h.pos);
    const pulse = 1 + Math.sin(e.t * 10) * 0.12;
    aura.scale.set(0.75 * pulse, 2.4 + Math.sin(e.t * 10) * 0.2, 0.75 * pulse);
    aura.material.opacity = (0.3 + 0.12 * Math.sin(e.t * 10)) * Math.min(1, Math.max(0, h.furyT) / 0.4);
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
function quake(h, reach) {
  const c = h.pos.clone().addScaledVector(V(Math.sin(h.root.rotation.y), 0, Math.cos(h.root.rotation.y)), 1.2);
  wave(c, 0xffb060, 0.3, reach * 1.7, 0.55, { y: 0.12 });
  wave(c, 0x9a7a55, 0.3, reach * 1.3, 0.8, { geo: ringGeo, opacity: 0.55, dust: true });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(crackGeo, glow(0x2a1c10, 0.9, false));
    const lava = new THREE.Mesh(crackGeo, glow(0xff8a30, 0.9));
    lava.scale.set(1, 1.3, 0.45);
    lava.position.y = 0.01;
    m.add(lava);
    m.position.copy(c).setY(c.y + 0.05);
    m.rotation.y = (i / 9) * TAU + rnd(0.3);
    const len = reach * (0.7 + Math.random() * 0.6);
    addFx(m, 1.8, (e, dt, k) => {
      m.scale.x = len * Math.min(1, e.t / 0.15);
      m.material.opacity = e.base * (k > 0.7 ? (1 - k) / 0.3 : 1);
      lava.material.opacity = 0.9 * (1 - k) ** 2;
    });
  }
  for (let i = 0; i < 14; i++)
    particle(rockGeo, i % 2 ? 0x8a6f55 : 0x6d5a48, V(c.x + rnd(1.5), c.y + 0.2, c.z + rnd(1.5)), V(rnd(3), 5 + Math.random() * 4, rnd(3)), 1, { solid: true, gravity: 18, size: 0.8 + Math.random() });
  const dust = fewer(10);
  for (let i = 0; i < dust; i++) {   // poeira cartum em shader que rola para fora e se desfaz
    const a = (i / dust) * TAU;
    sprite('puff', 'dust', V(c.x, c.y + 0.4, c.z), V(Math.cos(a) * 4, 0.6, Math.sin(a) * 4), 0.9, { size: 1.1, grow: 1.2, drag: 3, opacity: 0.95 });
  }
  shake(0.55);
}

// impacto dos tiros de habilidade (e de cada inimigo atravessado pelos perfurantes)
function impact(kind, at, radius, lookId) {
  at = at.clone();
  const p = at.clone().setY(at.y + 1);
  if (kind === 'basic') {   // tiro comum: estalo pequeno na cor do atirador
    const [a, c] = TRAIL[lookId] || [0xffffff, 0xffffff];
    if (lookId === 'pyro' || lookId === 'arcane' || lookId === 'necro') blast(p, lookId === 'pyro' ? 1.5 : 1.1, 0.32, lookId === 'pyro' ? 'fire' : lookId);   // estouro em shader
    else {
      const m = new THREE.Mesh(shellGeo, glow(a, 0.95));
      m.position.copy(p);
      addFx(m, 0.3, (e, dt, k) => { m.scale.setScalar(1 + k * 4); m.material.opacity = e.base * (1 - k); });
    }
    burst(p, lookId === 'pyro' ? [0xff7a2a, 0xffe070, 0xff3a1a] : [a, c], lookId === 'pyro' ? 6 : 10, 4, { gravity: 6, geo: lookId === 'druid' ? leafGeo : sparkGeo });
  } else if (kind === 'pyro') {   // bola de fogo: explosão que se rasga, anel de chamas no chão e fumaça
    flameRing(at, radius * 1.6, 12, 0.75, 'fire', 1.15);
    blast(p, radius * 2.6, 0.55);
    blast(p.clone().setY(p.y + 0.5), radius * 1.3, 0.4);
    burst(p, [0xff7a2a, 0xffe070, 0xff3a1a], fewer(20), 8, { gravity: 8, size: 1.6, life: 0.9 });
    puffs(p, 6, 'smoke', { spread: 0.6, size: 1.1, rise: 1.5, life: 1.2 });
    wave(at, 0xff9a40, 0.4, radius * 1.4, 0.5);
    audio.play('fire');
    shake(0.45);
  } else if (kind === 'cryo' || kind === 'iceviking') {
    crystals(at, radius);
    burst(p, [0xbff6ff, 0xffffff], 18, 5);
    wave(at, 0x8be8ff, 0.4, radius * 1.3, 0.6);
    puffs(at.clone().setY(at.y + 0.4), 4, 'frostMist', { spread: radius * 0.6, rise: 0.3, size: 1.2, opacity: 0.7, life: 1.3 });   // névoa fria
    audio.play('ice');
    if (kind === 'iceviking') shake(0.2);
  } else if (kind === 'viking') {
    burst(p, [0xffffff, 0xd6e9ef, 0xffd84a], 16, 6);
    wave(at, 0xd6e9ef, 0.3, 1.6, 0.4);
    puffs(at.clone().setY(at.y + 0.3), 2, 'dust', { size: 0.7, rise: 0.6, life: 0.7 });
    audio.play('hit');
    shake(0.2);
  } else burst(p, TRAIL[kind] || 0xffffff, 8, 4);
}

// Criomante e Viking do Gelo: cristais de gelo brotando do chão
function crystals(at, radius) {
  const disc = new THREE.Mesh(groundGeo, glow(0x8be8ff, 0.35));
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
      const m = new THREE.Mesh(slashGeo, glow(color, 1));
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
      const m = new THREE.Mesh(slashGeo, glow(color, 1));
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
function huntMark(prey) {
  const g = new THREE.Group(), mat = glow(0x3fe0b0, 0.9);
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
    if (prey.dead || prey.markT <= 0 || !units.includes(prey)) e.done = true;
    g.position.copy(prey.pos).setY(prey.pos.y + 2.3 * prey.size + Math.sin(e.t * 4) * 0.08);
    g.rotation.y += dt * 1.6;
    g.scale.setScalar(0.42 * prey.size * Math.min(1, e.t / 0.2) * (1 + 0.08 * Math.sin(e.t * 9)));
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
  burst(p, [0x9cff3a, 0xe8ffb0, 0xffffff], fewer(16), 7, { size: 1.4 });
  wave(at, 0x9cff3a, 0.4, radius * 1.3, 0.5);
  shake(0.3);
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
  for (let i = 0; i < 3; i++) wave(h.pos, 0xffd84a, 0.5, 7, 1, { delay: i * 0.18 });
  for (const f of party) {
    rays(f.pos, 'holy', 0.55, 3.2, 0.9, { follow: f });   // luz dourada em shader sobre cada herói
    burst(f.pos.clone().setY(f.pos.y + 1.2), [0xffd84a, 0xffffff], 8, 3, { gravity: -2 });
  }
}

// Bardo: pulsos violeta e pequenas notas luminosas percorrem o grupo.
function song(h, party) {
  for (let i = 0; i < 3; i++) wave(h.pos, i === 1 ? 0xffe27a : 0xe9a7ff, 0.35, 6.2, 0.95, { delay: i * 0.16, opacity: 0.65 });
  for (const friend of party) {
    column(friend.pos, 0xe9a7ff, 0.32, 2.6, 0.95, { follow: friend });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + h.age;
      const at = friend.pos.clone().add(V(Math.cos(a) * 0.55, 1.15 + i * 0.18, Math.sin(a) * 0.55));
      particle(sparkGeo, i === 1 ? 0xffe27a : 0xf4c6ff, at, V(0, 1.6, 0), 0.8, { size: 1.2, delay: i * 0.08 });
    }
  }
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
function shake(n) { shakeK = Math.max(shakeK, n); }
// hit-stop: o jogo quase congela por um instante no disparo da ultimate (só o tempo do quadro, sem mudar números)
function hitStop(n) { stopT = Math.max(stopT, n); }
function timeScale(real) {
  if (stopT <= 0) return 1;
  stopT -= real;
  return 0.12;
}
function cameraJolt(real) {
  shakeK = Math.max(0, shakeK - real * 1.6);
  return jolt.set(rnd(), rnd() * 0.6, rnd()).multiplyScalar(shakeK);
}

// Partículas do elemento de cada herói ao soltar uma habilidade extra (fogo, gelo, arcano, luz, natureza, sombra, tempo, som).
function element(h, skill, target) {
  const id = h.cfg.id, ult = !!skill.ultimate, n = ult ? 18 : 10;
  const area = !!skill.radius || !target, at = (area ? h.pos : target.pos).clone();
  const reach = area ? (skill.radius || 4.5) * 0.7 : 1.4;
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
  } else if (id === 'druid') {   // folhas rodando
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
  } else if (id === 'chronist') {   // mostrador de relógio no chão, com os ponteiros voltando
    clockFace(at, reach + 0.6, ult ? 1.4 : 0.9);
  } else if (id === 'bard') {   // ondas sonoras em pé saindo do bardo e notinhas
    for (let i = 0; i < (ult ? 4 : 3); i++) {
      const m = new THREE.Mesh(thinRingGeo, glow(i % 2 ? 0xffe27a : 0xe9a7ff, 0.8));
      m.position.copy(h.pos).setY(h.pos.y + 1.2);
      m.rotation.y = h.root.rotation.y;
      addFx(m, 0.6, (e, dt, k) => { m.scale.setScalar(0.4 + k * 3.2); m.material.opacity = e.base * (1 - k); }, i * 0.1);
    }
    for (let i = 0; i < n; i++) particle(sparkGeo, i % 2 ? 0xf4c6ff : 0xffe27a, spot(1), V(rnd(1.2), 1.8, rnd(1.2)), 0.8, { size: 1.2, gravity: -0.5, delay: Math.random() * 0.3 });
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

const FX = { look, update: updateSkillFx, clear: clearSkillFx, jolt: cameraJolt, shake, hitStop, timeScale, element, stasis, charge, release, holyLight, dome, whirl, fury, quake, impact, iceFan, zigzag, summon, shadowStep, slashX, royal, song, roots, leaves, dress, trail, column, swing, fireField, skillColor: (h) => SKILL_ART[h.cfg.id]?.color };
Object.assign(FX, { bladeCut, steelDash, bladeDance, bladeSpin });   // Duelista
Object.assign(FX, { rainMark, arrowVolley, hunterShot, huntMark, palmHit, windPalm, meditate, calmPulse, pool: puddle, flaskToss, flaskBlast, transmuteWave, sheep });   // Arqueira, Monge e Alquimista

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
    this.songT = 0;
    this.songHaste = 1;
    this.formation = POSTS[Math.min(3, heroes().length - 1)];
    this.skillTimers = [2, 4, 8];
    this.skillMaxes = [2, 4, 8];
    this.autoSkills = [0, 1, 2].map((slot) => loadAutoSlot(cfg.id, slot));
    this.skillRequests = [0, 0, 0];
    this.skillTargets = [null, null, null];
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
    this.dodgeTimer = 2;
    this.bladeDanceT = 0;
    this.meditateT = 0;   // Monge: meditação em curso (cura o grupo)
    this.immuneT = 0;     // Monge: imune a dano
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

  gainXp(n) {
    this.xp += n;
    while (this.level < 3 && this.xp >= XP_LEVELS[this.level]) {
      const oldHp = this.maxHp;
      this.level++;
      evolutions.push({ hero: this, level: this.level });
      this.maxHp = Math.round(this.maxHp * 1.1);
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp - oldHp);
      this.dmg *= 1.1;
      this.size = 1 + (this.level - 1) * 0.08;
      this.levelLabel.textContent = 'Nv' + this.level;
      this.levelLabel.title = this.cfg.names[this.level - 1];
      this.aura.visible = !this.dead;
      this.halo.visible = !this.dead && this.level === 3;
      for (let slot = 0; slot < 3; slot++) this.skillTimers[slot] = Math.min(this.skillTimers[slot], 1);
      this.popT = 0;
      audio.play('levelup');
      poof(this.pos, 1.5);
      ring(this.pos, 2, this.cfg.color[0], 1);
      popText(this.pos, this.cfg.names[this.level - 1] + '!', 'evolve');
      showBanner(`⬆\uFE0E ${this.cfg.names[this.level - 1]}`, 2.5);
    }
  }

  useSkill(target, manual = false, force = false, slot = 0) {
    if (slot > 0) return this.useExtraSkill(slot, target, force);
    if (manual && !validAim(this, target)) return false;
    const id = this.cfg.id, level = this.level;
    const power = this.skillPower;
    const radius = (3 + (level - 1) * 0.5) * power;
    const attackables = activeTargetContext?.skeletons ?? skeletonsAlive();
    const nearby = attackables.filter((s) => !s.dead && !s.spawning && s.pos.distanceTo(this.pos) <= radius);
    let effect;
    if (id === 'paladin') {
      const reach = (5 + level) * power;
      const friends = partyNow().filter((h) => !h.dead && h.hp < h.maxHp && h.pos.distanceTo(this.pos) <= reach);
      const healAmount = scaleBranchEffect(this, 'support', 32 + level * 10) * power;
      const missing = friends.reduce((sum, h) => sum + h.maxHp - h.hp, 0);
      const urgent = friends.some((h) => h.hp / h.maxHp <= 0.55);
      if (!friends.length || (!force && !urgent && missing < healAmount * 0.75)) return false;
      effect = () => {
        const healed = [];
        for (const h of friends) if (!h.dead && h.pos.distanceTo(this.pos) <= reach) {
          const heal = Math.min(h.maxHp - h.hp, healAmount);
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
          const heal = Math.min(h.maxHp - h.hp, healAmount);
          if (heal > 0) { h.hp += heal; this.stats.cura += heal; healed.push(h); popText(h.pos, '+' + Math.round(heal), 'heal'); }
        }
        this.guardT = Math.max(this.guardT, protection);
        FX.holyLight(this, healed, reach);
        FX.dome(this, reach * 0.72);
      };
    } else if (id === 'bard') {
      const party = partyNow().filter((h) => !h.dead);
      if (!party.length || (!force && !target)) return false;
      effect = () => {
        const duration = (6 + level * 0.5) * power;
        for (const h of party) {
          h.songT = Math.max(h.songT, duration);
          h.songHaste = Math.min(h.songHaste || 1, 0.78);
          popText(h.pos, 'Ritmo!', 'evolve');
        }
        wave(this.pos, 0xe9a7ff, 0.2, 7, 0.85);
        burst(this.pos, [0xf2c6ff, 0xffe27a, 0xffffff], 24, 4.5);
        FX.song(this, party);
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
        column(center, 0xffe27a, 1.1, 8, 1.1);
        wave(center, 0xfff4bd, 0.3, radius, 0.75);
        burst(center, [0xffe27a, 0xffffff, 0xffc6ed], 26, 5);
        FX.holyLight(this, healed, reach);
      };
    } else if (id === 'chronist') {
      if (!nearby.length) return false;
      effect = () => {
        const duration = scaleBranchEffect(this, 'control', 2.3 + (level - 1) * 0.35) * power;
        for (const enemy of nearby) if (!enemy.dead) {
          enemy.rootT = Math.max(enemy.rootT || 0, duration);
          enemy.pendingHit = null;
          enemy.vel.set(0, 0, 0);
          heroHit(this, enemy, this.dmg * 0.55 * power);
          FX.stasis(enemy);   // tempo parado, não raízes
        }
        wave(this.pos, 0x8feaff, 0.2, radius, 0.8);
        burst(this.pos, [0x8feaff, 0xb6a4ff, 0xffffff], 22, 3.5);
        FX.zigzag(this.pos, target?.pos || this.pos, 0.15);
      };
    } else if (id === 'guardian') {
      if (!nearby.length) return false;
      effect = () => {
        this.guardT = scaleBranchEffect(this, 'control', 4 + (level - 1)) * power;
        for (const s of nearby) if (!s.dead) { s.taunt = this; s.tauntT = this.guardT; s.pendingHit = null; popText(s.pos, '!', 'crit'); }
        for (const s of nearby) if (!s.dead) heroHit(this, s, this.dmg * 0.6);   // pancada de escudo: dano moderado, o foco segue na provocação
        FX.dome(this, radius);
      };
    } else if (id === 'champion' || id === 'crusher') {
      if (manual && id === 'crusher') this.face(target.pos, 1);
      const skillTargets = nearby.filter((s) => id === 'champion' || inMeleeArc(this, s, 2.2 * power));
      const urgent = skillTargets.some((s) => s.boss || s.totem || ['Bomber', 'Priest'].includes(s.enemyKind) || s.kind?.priority
        || s.pendingHit?.target?.team === 'hero' || s.pendingHit?.target?.team === 'villager');
      if (!skillTargets.length || (!force && skillTargets.length < 2 && !urgent)) return false;
      if (id === 'crusher') this.vel.add(tmp.subVectors(target ? target.pos : this.pos, this.pos).setY(0).normalize().multiplyScalar(2.5));   // salta para a frente
      effect = () => {
        for (const s of skeletonsAlive()) if (!s.spawning && s.pos.distanceTo(this.pos) <= radius) {
          if (id === 'crusher' && !inMeleeArc(this, s, 2.2 * power)) continue;
          heroHit(this, s, this.dmg * 1.1);
          if (id === 'champion') s.vel.add(new THREE.Vector3().subVectors(s.pos, this.pos).setY(0).normalize().multiplyScalar(6 + level));
          else { s.stunT = scaleBranchEffect(this, 'control', 1.5 + (level - 1) * 0.25) * power; s.pendingHit = null; s.vel.set(0, 0, 0); }
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
        if (target.dead) return;
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
            target.stunT = Math.max(target.stunT || 0, scaleBranchEffect(this, 'control', 0.8) * power);
            target.pendingHit = null;
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
      const valuableControl = nearby.length >= 2 || nearby.some((s) => s.boss || s.totem || ['Bomber', 'Priest'].includes(s.enemyKind) || s.kind?.priority
        || s.pendingHit?.target?.team === 'hero' || s.pendingHit?.target?.team === 'villager');
      if (!friends.length && !nearby.length) return false;
      if (!force && !urgentHeal && !valuableControl) return false;
      effect = () => {
        for (const enemy of skeletonsAlive()) if (!enemy.spawning && enemy.pos.distanceTo(this.pos) <= radius) {
          enemy.rootT = scaleBranchEffect(this, 'control', 1.5) * power;
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
    } else return false;
    const [, pace, at, sound] = SKILL_MOVES[id];
    const run = effect;
    effect = () => { audio.play(sound); FX.release(this); run(); };
    this.face(target ? target.pos : this.pos.clone().add(this.fwd), 1);
    this.busy = this.skillBody(0, pace);
    this.pendingHit = { target, effect, t: this.busy * at };
    FX.charge(this, this.pendingHit.t);
    this.skillTimers[0] = this.skillMaxes[0] = cooldownForSkill(this.cfg, 0, level, this.skillRate);
    relicAfterCast(this, 0, false);
    this.stats.habilidades++;
    return true;
  }

  useExtraSkill(slot, target, force = false) {
    const skill = skillSetFor(this.cfg)[slot];
    if (!skill || slot < 1) return false;
    const level = this.level, power = this.skillPower;
    const color = skill.color || this.cfg.color[0];
    const radius = (skill.radius || (slot === 2 ? 6 : 4.5)) * (0.9 + 0.1 * power);
    const attackables = activeTargetContext?.skeletons ?? skeletonsAlive();
    const partySource = partyNow();
    const enemies = [], targetPool = [];
    const enemyReach = Math.max(radius, skill.range || 0), targetReach = Math.max(9, this.range);
    for (const enemy of attackables) {
      if (enemy.dead || enemy.spawning) continue;
      const distance = enemy.pos.distanceTo(this.pos);
      if (distance <= enemyReach + 0.4 * (enemy.size - 1)) enemies.push(enemy);
      if (distance <= targetReach) targetPool.push(enemy);
    }
    const party = partySource.filter((h) => !h.dead);
    const friends = party.filter((h) => h.pos.distanceTo(this.pos) <= Math.max(radius, 5.5));
    const wounded = friends.filter((h) => h.hp < h.maxHp);
    const missingHp = wounded.reduce((sum, h) => sum + h.maxHp - h.hp, 0);
    const criticalAlly = friends.some((h) => h.hp / h.maxHp <= 0.42);
    const urgentEnemy = enemies.some((s) => s.boss || s.totem || ['Bomber', 'Priest'].includes(s.enemyKind) || s.kind?.priority
      || s.pendingHit?.target?.team === 'hero' || s.pendingHit?.target?.team === 'villager');
    target ||= highestPriorityHeroTarget(this, targetPool);
    if (target && (target.dead || !units.includes(target))) target = null;

    const supportSkill = ['ward', 'holy-nova', 'taunt', 'bastion', 'rally', 'frost-ward', 'roots-heal', 'nature-storm', 'meditate'].includes(skill.effect);
    if (!force && slot === 2 && !urgentEnemy && enemies.length < (supportSkill ? 2 : 3) && !criticalAlly && missingHp < this.maxHp * 0.3) return false;
    if (!force && slot === 1 && !enemies.length && !criticalAlly && missingHp < this.maxHp * 0.35) return false;
    if (!force && skill.effect === 'summon' && units.some((u) => u.summoner === this && !u.dead)) return false;
    const needsTarget = ['charge', 'volley', 'execute', 'shadow', 'chain'].includes(skill.effect);
    if (needsTarget && !target) return false;
    const areaEffects = ['burst', 'storm', 'blizzard', 'meteor', 'volley-storm', 'arrow-rain', 'shadow-storm', 'holy-nova', 'nature-storm', 'roots-heal'];
    if (areaEffects.includes(skill.effect) && !enemies.length && !(supportSkill && (criticalAlly || missingHp > this.maxHp * 0.35))) return false;

    const damageOne = (enemy, multiplier = 1) => {
      if (enemy && !enemy.dead) heroHit(this, enemy, this.dmg * power * (skill.power || 1) * multiplier);
    };
    const control = (enemy) => {
      if (!enemy || enemy.dead) return;
      const controlType = skill.control || (['blizzard', 'roots-heal', 'nature-storm'].includes(skill.effect) ? 'root' : null);
      if (controlType === 'stun') { enemy.stunT = Math.max(enemy.stunT || 0, scaleBranchEffect(this, 'control', 1.35 + (level - 1) * 0.2) * power); enemy.pendingHit = null; }
      if (controlType === 'root') { enemy.rootT = Math.max(enemy.rootT || 0, scaleBranchEffect(this, 'control', skill.duration || 2.8) * power); enemy.pendingHit = null; }
      if (controlType === 'slow') enemy.slowT = Math.max(enemy.slowT || 0, scaleBranchEffect(this, 'control', skill.duration || 3.5) * power);
      if (controlType === 'burn') {
        enemy.burnT = Math.max(enemy.burnT || 0, scaleBranchEffect(this, 'control', skill.duration || 3.2) * power);
        enemy.burnTick = Math.min(enemy.burnTick || 0.5, 0.35);
        enemy.burnDmg = Math.max(enemy.burnDmg || 0, this.dmg * power * (skill.power || 1) * 0.08);
        enemy.burnOwner = this;
        column(enemy.pos, color, 0.35, 2.2, 0.55, { follow: enemy });
      }
      if (skill.control === 'push') enemy.vel.add(new THREE.Vector3().subVectors(enemy.pos, this.pos).setY(0).normalize().multiplyScalar(5));
      if (skill.effect === 'taunt' || skill.effect === 'bastion') { enemy.taunt = this; enemy.tauntT = skill.duration * power; enemy.pendingHit = null; }
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
    let effect;
    switch (skill.effect) {
      case 'ward': case 'frost-ward': case 'bastion': {
        const duration = scaleBranchEffect(this, 'control', skill.duration || 5) * power;
        effect = () => {
          for (const h of party) if (h.pos.distanceTo(this.pos) <= Math.max(radius, 5.5)) h.guardT = Math.max(h.guardT, duration);
          if (skill.effect === 'bastion') { this.guardT = Math.max(this.guardT, duration); for (const enemy of enemies) control(enemy); }
          if (skill.effect === 'frost-ward') for (const enemy of enemies) { enemy.slowT = Math.max(enemy.slowT, duration * 0.65); damageOne(enemy, 0.35); }
          FX.dome(this, radius);
          if (skill.effect === 'frost-ward') { FX.iceFan(this, target || this); burst(this.pos, color, 18, 4); }
        };
        break;
      }
      case 'taunt':
        if (!enemies.length) return false;
        effect = () => { this.guardT = Math.max(this.guardT, scaleBranchEffect(this, 'control', skill.duration) * power); for (const enemy of enemies) control(enemy); FX.dome(this, radius); burst(this.pos, color, 16, 3); };
        break;
      case 'holy-nova': {
        const heal = scaleBranchEffect(this, 'support', 28 + level * 5) * power;
        if (!enemies.length && !wounded.length) return false;
        effect = () => { const healed = healFriends(heal, Math.max(radius, 6.5)); damageAreaNow(0.8); FX.holyLight(this, healed, radius); wave(this.pos, color, 0.2, radius, 0.75); burst(this.pos, color, 28, 5); };
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
          if (target.dead) return;
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
          for (let i = 0; i < count; i++) {
            const enemy = skill.effect === 'volley' ? target : sorted[i];
            if (enemy.dead) continue;
            FX.zigzag(this.pos, enemy.pos, i * 0.04); damageOne(enemy, skill.effect === 'volley' ? 1 / shots : 0.75);
          }
          if (skill.effect !== 'volley') { wave(this.pos, color, 0.2, radius, 0.55); burst(this.pos, color, shots * 3, 4); }
        };
        break;
      }
      case 'chain': {
        if (!target) return false;
        effect = () => {
          let at = this.pos, next = target; const hit = new Set();
          for (let i = 0; i < (skill.jumps || 4) + (this.extraTargets || 0) && next && !next.dead; i++) {
            FX.zigzag(at, next.pos, i * 0.06); hit.add(next); damageOne(next, 1 - i * 0.08); at = next.pos;
            next = highestPriorityHeroTarget(this, enemies.filter((enemy) => !hit.has(enemy) && enemy.pos.distanceTo(at) < 5), at);
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
        } else {
          effect = () => { damageAreaNow(skill.effect === 'meteor' ? 1 : 0.8);
            if (skill.effect === 'meteor') FX.quake(this, radius * 0.35);   // pilar e explosão de fogo vêm de FX.element (shader)
            else if (skill.effect === 'blizzard' && this.cfg.id === 'chronist') for (const enemy of enemies) FX.stasis(enemy);
            else if (skill.effect === 'blizzard') FX.iceFan(this, target || this);
            else if (skill.effect === 'storm') FX.whirl(this, radius);
            else FX.quake(this, radius * 0.35);
            wave(this.pos, color, 0.2, radius, 0.7); burst(this.pos, color, skill.effect === 'meteor' ? 32 : 22, 5);
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
        if (!aim || (!force && line.length < 2 && !urgentEnemy)) return false;
        target = aim;
        effect = () => {
          const from = this.pos.clone(), dir = new THREE.Vector3().subVectors(aim.pos, from).setY(0).normalize();
          const length = Math.min(reach, aim.pos.distanceTo(from) + 1.6);
          const end = from.clone().addScaledVector(dir, length);
          const hit = lineTargets(from, end, skeletonsAlive().filter((s) => !s.spawning && Math.abs(s.pos.y - from.y) < 0.85), length);
          if (world.canStep(from, end)) { this.pos.copy(end).setY(world.groundHeight(end.x, end.z)); this.vel.set(0, 0, 0); }
          else this.vel.add(dir.clone().multiplyScalar(6));
          this.face(end.clone().add(dir), 1);
          for (const enemy of hit) { damageOne(enemy); FX.bladeCut(enemy, this, 0); }
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
        const { center, count } = densest(pool, skill.radius || 3, force ? target : null);
        if (!center || (!force && count < 2 && !urgentEnemy)) return false;
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
        if (!force && !criticalAlly && missingHp < this.maxHp * 0.3 && this.hp > this.maxHp * 0.45) return false;
        effect = () => {
          this.meditateT = this.immuneT = (skill.duration || 4) * (0.9 + 0.1 * power);
          this.meditateTick = 0;
          this.meditation = { radius, heal: scaleBranchEffect(this, 'support', 7 + level * 2) * power };
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
        if (!force && common.length < 3 && !urgentEnemy) return false;
        effect = () => {
          const duration = scaleBranchEffect(this, 'control', skill.duration || 4) * power;
          for (const enemy of enemies) {
            if (enemy.dead) continue;
            if (enemy.boss || enemy.totem) { enemy.slowT = Math.max(enemy.slowT || 0, duration); continue; }
            if (!(enemy.sheepT > 0)) FX.sheep(enemy);
            enemy.sheepT = Math.max(enemy.sheepT || 0, duration);
            enemy.pendingHit = null;
            enemy.vel.set(0, 0, 0);
          }
          FX.transmuteWave(this.pos, radius);
        };
        break;
      }
      case 'summon':
        effect = () => {
          for (const unit of units.filter((unit) => unit.summoner === this)) { poof(unit.pos); unit.remove(); }
          FX.summon(this, [-1.5, -0.5, 0.5, 1.5].map((side) => Object.assign(new Minion(this, side), { ultimate: true })));
          burst(this.pos, color, 20, 3);
        };
        break;
      default: return false;
    }

    const [, pace, at, sound] = SKILL_MOVES[this.cfg.id];
    this.face(target ? target.pos : this.pos.clone().add(this.fwd), 1);
    this.busy = this.skillBody(slot, pace * (skill.ultimate ? 0.82 : 0.92), skill.ultimate);
    const hitAt = this.busy * at;
    this.pendingHit = { target, skill, slot, effect: () => { audio.play(sound); FX.release(this, skill.ultimate); this.ultHit = !!skill.ultimate; effect(); this.ultHit = false; FX.element(this, skill, target); }, t: hitAt };
    FX.charge(this, hitAt);
    this.skillTimers[slot] = this.skillMaxes[slot] = cooldownForSkill(this.cfg, slot, level, this.skillRate);
    relicAfterCast(this, slot, !!skill.ultimate);
    this.stats.habilidades++;
    if (skill.ultimate) game.ultimates = (game.ultimates || 0) + 1;
    return true;
  }

  // Toca o corpo da habilidade (SKILL_ANIMS) no mesmo tempo de antes: duração e impacto vêm do clipe de SKILL_MOVES.
  skillBody(slot, pace, ultimate = false) {
    const [base, , at] = SKILL_MOVES[this.cfg.id];
    const busy = this.action(base).getClip().duration / pace, hit = busy * at;
    const e = SKILL_ANIMS[this.cfg.id]?.[slot] || { clip: base, f: at };
    this.endSkillBody();
    const lead = e.hold ? Math.min(0.3, hit * 0.5) : hit;   // com pose segurada, o golpe só começa perto do impacto
    if (e.hold) {
      const a = this.action(e.hold);
      a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      a.timeScale = 1;
      if (this.current && this.current !== a) a.crossFadeFrom(this.current, 0.15, false);
      this.current = a;
    } else this.fitSkillClip(e.clip, e.f ?? 0.5, lead);
    this.skillMove = { e, t: 0, busy, hit, lead, ultimate, spun: 0, released: !e.hold, fired: false, color: FX.skillColor(this) ?? 0xffffff };
    return busy;
  }

  // ajusta o timeScale para o impacto do clipe (fração f) cair no fim da janela; clipe longo pula o começo
  // em vez de correr demais (no máximo 1,6x até o impacto)
  fitSkillClip(name, f, window) {
    const a = this.action(name), impact = f * a.getClip().duration, w = Math.max(0.05, window);
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

  // pedido do jogador (botão ou tecla): vale por um instante, até o golpe atual terminar
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
    for (const s of near) { heroHit(this, s, hit); cx += s.pos.x / near.length; cz += s.pos.z / near.length; }
    const dx = cx - this.pos.x, dz = cz - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.5) { this.vel.x += dx / d * 1.6; this.vel.z += dz / d * 1.6; }
    FX.bladeSpin(this, radius);
    audio.play('sword');
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

  requestSkill(target = null, slot = 0) {
    if (this.dead || game.over || game.paused) return 'off';
    if (this.skillTimers[slot] > 0) return 'wait';
    if (game.state !== 'fight') { this.missSkill(); return 'none'; }
    this.skillTargets[slot] = target;
    this.skillRequests[slot] = 2;
    return 'ok';
  }

  missSkill() {
    this.noTarget = 0.6;
    popText(this.pos, 'Sem alvo', 'block');
  }

  // posição na formação em volta do ponto "s" da estrada
  setAnchor(s) {
    this.fwd.copy(world.tangentAt(s));
    const side = world.sideOf(this.fwd);
    const [px, pz] = this.formation;
    this.post.copy(world.pointAt(s)).addScaledVector(side, px).addScaledVector(this.fwd, -pz);
  }

  revive() {
    this.dead = false;
    this.fell = false;   // uma próxima queda após o revival deve entrar na contagem da missão
    this.aura.visible = this.level > 1;
    this.halo.visible = this.level === 3;
    this.guardT = 0;
    this.royalT = 0;
    this.songT = 0;
    this.songHaste = 1;
    this.furyT = 0;
    this.bladeDanceT = 0;
    this.meditateT = this.immuneT = 0;
    this.hp = this.maxHp * difficulty.revive;
    this.bar.style.display = '';
    this.current = null;
    this.mixer.stopAllAction();
    this.loop(this.cfg.idle);
  }

  update(dt) {
    if (dt <= 0) return;
    for (let slot = 0; slot < 3; slot++) {
      this.skillTimers[slot] -= dt;
      this.skillRequests[slot] -= dt;
      if (this.skillRequests[slot] <= 0) this.skillTargets[slot] = null;
    }
    this.dodgeTimer -= dt;
    this.guardT -= dt;
    this.royalT -= dt;
    if (this.royalT <= 0) this.royalBonus = 0;
    this.songT -= dt;
    if (this.songT <= 0) this.songHaste = 1;
    this.furyT -= dt;
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
    this.aura.visible = !this.dead && (this.level > 1 || rage || this.guardT > 0 || this.songT > 0);
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
    this.updateCommon(dt);
    this.tickSkillBody(dt);
    if (this.dead || this.busy > 0 || game.over) return;
    const escape = game.state === 'fight' && dangerAt(this);   // sai da área marcada antes do golpe forte
    const move = this.cfg.id === 'angel' ? 'Jump_Idle' : 'Running_A';
    const walk = this.cfg.id === 'angel' ? 'Jump_Idle' : 'Walking_A';
    if (escape) { this.moveTo(escape, dt); this.locomote(move, walk, this.cfg.idle); return; }
    const kite = game.state === 'fight' && this.ranged && kiteFrom(this, dt);   // à distância, recua de quem encosta
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
        this.skillRequests[requested] = 0;
        this.skillTargets[requested] = null;
        if (this.useSkill(chosen || target, !!chosen, true, requested)) return;
        this.missSkill();
      } else {
        // A IA reserva a ultimate para chefes, perigo real, grupo cercado ou aliados feridos.
        for (const slot of [2, 1, 0]) {
          if (this.skillTimers[slot] > 0 || !this.autoSkills[slot]) continue;
          if (this.useSkill(target, false, false, slot)) return;
        }
      }
    }
    // O alvo precisa continuar dentro do raio tático; ser atirador não puxa o grupo pelo mapa.
    // margem para não pipocar: quem já está brigando só larga o alvo quando ele se afasta bem do posto
    const engage = target && !movingToRescue && this.targetEligible === target;
    this.engagedWith = engage ? target : null;
    if (movingToRescue) {
      if (this.pos.distanceTo(captive.pos) > RESCUE_RADIUS - 0.8) this.moveTo(captive.pos, dt);
      else this.face(captive.pos, dt);
    } else if (engage) {
      const d = target.pos.distanceTo(this.pos) - 0.4 * (target.size - 1) - (target.reach || 0);   // reach: raio de prédios e do portal
      if (d > this.range || (!this.ranged && Math.abs(target.pos.y - this.pos.y) >= 0.85)) this.moveTo(target.pos, dt);
      else {
        const turn = this.face(target.pos, dt);   // só ataca depois de virar para o alvo
        const attacks = this.cfg.attacks;
        if (this.attackTimer <= 0 && turn < 0.5) this.attack(target, attacks[Math.floor(Math.random() * attacks.length)]);
      }
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
  bard: ['Cheer', 1.6, 0.3, 'shout'],
  angel: ['Spellcast_Raise', 1.8, 0.42, 'heal'],
  chronist: ['Spellcast_Raise', 1.6, 0.42, 'zap'],
  archer: ['2H_Ranged_Shoot', 1.2, 0.4, 'arrow'],
  monk: ['Unarmed_Melee_Attack_Punch_A', 1.6, 0.4, 'hit'],
  alchemist: ['Throw', 1.4, 0.45, 'ice'],
};

// Corpo de cada habilidade [básica, técnica, ultimate]. O tempo continua o de SKILL_MOVES (o clipe novo é
// acelerado/freado para caber nele). clip: golpe solto; hold: pose em laço segurada durante a carga;
// f: fração do clipe em que acontece o impacto; arc: rastro do golpe (slash, chop, ring, thrust);
// hop: salto que aterrissa no impacto; float: levita durante a carga; spin: voltas do corpo no impacto;
// lean: inclinação (+ para a frente, - para trás); kick: passo no impacto (+ avança, - recua).
const SKILL_ANIMS = {
  paladin: [
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, lean: -0.12, kick: -0.8 },
    { clip: 'Block_Attack', hold: 'Blocking', f: 0.45, arc: 'slash', kick: 1 },
    { clip: '1H_Melee_Attack_Chop', hold: 'Spellcasting', f: 0.5, arc: 'chop', hop: 0.45 },
  ],
  guardian: [
    { clip: 'Block_Attack', hold: 'Blocking', f: 0.45, arc: 'slash', kick: -1 },
    { clip: '1H_Melee_Attack_Stab', f: 0.45, arc: 'thrust', kick: 1.4 },
    { clip: 'Cheer', hold: 'Blocking', f: 0.35, arc: 'ring', lean: -0.15, hop: 0.25 },
  ],
  champion: [
    { clip: '2H_Melee_Attack_Spinning', f: 0.5, arc: 'ring', spin: 1 },
    { clip: '2H_Melee_Attack_Stab', f: 0.45, arc: 'thrust', lean: 0.18 },
    { clip: '2H_Melee_Attack_Spin', hold: '2H_Melee_Idle', f: 0.55, arc: 'ring', spin: 2, hop: 0.3 },
  ],
  king: [
    { clip: 'Cheer', f: 0.35, lean: -0.18 },
    { clip: 'Spellcast_Raise', f: 0.5, lean: -0.1, kick: 0.8 },
    { clip: '2H_Melee_Attack_Chop', hold: 'Spellcasting', f: 0.5, arc: 'chop', hop: 0.5 },
  ],
  berserker: [
    { clip: 'Dualwield_Melee_Attack_Stab', f: 0.38, arc: 'thrust', lean: 0.22, hop: 0.2 },
    { clip: 'Dualwield_Melee_Attack_Chop', f: 0.5, arc: 'chop', hop: 0.7, lean: 0.15 },
    { clip: '2H_Melee_Attack_Spinning', hold: 'Unarmed_Idle', f: 0.5, arc: 'ring', spin: 2 },
  ],
  crusher: [
    { clip: '2H_Melee_Attack_Chop', f: 0.55, arc: 'chop', hop: 0.55 },
    { clip: 'Jump_Full_Short', f: 0.72, arc: 'ring', kick: 1 },
    { clip: '2H_Melee_Attack_Spin', hold: '2H_Melee_Idle', f: 0.6, arc: 'ring', spin: 1, hop: 0.4 },
  ],
  viking: [
    { clip: 'Throw', f: 0.45, lean: 0.15 },
    { clip: '1H_Ranged_Shooting', hold: '1H_Ranged_Aiming', f: 0.45, lean: 0.2, kick: -0.8 },
    { clip: '2H_Melee_Attack_Spinning', f: 0.5, arc: 'ring', spin: 2 },
  ],
  iceviking: [
    { clip: 'Throw', hold: 'Block', f: 0.45, lean: 0.2, hop: 0.2 },
    { clip: '2H_Melee_Attack_Chop', f: 0.55, arc: 'chop', hop: 0.5 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.6, arc: 'ring', float: 0.35 },
  ],
  pyro: [
    { clip: 'Spellcast_Shoot', f: 0.5, lean: 0.12, kick: -1 },
    { clip: '2H_Melee_Attack_Spin', f: 0.5, arc: 'ring', spin: 1 },
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.6, lean: -0.22, float: 0.25 },
  ],
  arcane: [
    { clip: '1H_Ranged_Shoot', hold: 'Spellcasting', f: 0.3, kick: -0.8 },
    { clip: 'Spellcast_Raise', f: 0.44, arc: 'thrust', spin: 0.6, float: 0.28, lean: 0.12, kick: -0.35 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.55, float: 0.45 },
  ],
  cryo: [
    { clip: '1H_Ranged_Shooting', hold: '1H_Ranged_Aiming', f: 0.3, kick: -1 },
    { clip: 'Spellcast_Raise', f: 0.5, lean: -0.1 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.55, spin: 1, float: 0.3 },
  ],
  assassin: [
    { clip: 'Dodge_Forward', f: 0.6, lean: 0.25 },
    { clip: 'Dualwield_Melee_Attack_Slice', f: 0.55, arc: 'slash', hop: 0.3 },
    { clip: 'Dualwield_Melee_Attack_Chop', hold: 'Blocking', f: 0.5, arc: 'chop', hop: 0.45, lean: 0.2 },
  ],
  crossbow: [
    { clip: '2H_Ranged_Shoot', hold: '2H_Ranged_Aiming', f: 0.2, kick: -1.4 },
    { clip: '2H_Ranged_Shooting', f: 0.3, kick: -1 },
    { clip: '2H_Ranged_Reload', f: 0.68, lean: -0.3, hop: 0.3 },
  ],
  duelist: [
    { clip: 'Dualwield_Melee_Attack_Slice', f: 0.45, arc: 'slash', kick: 0.6 },
    { clip: 'Dualwield_Melee_Attack_Stab', hold: 'Blocking', f: 0.5, arc: 'thrust', kick: 1.4, lean: 0.25 },
    { clip: '2H_Melee_Attack_Spinning', f: 0.5, arc: 'ring', spin: 3, hop: 0.3 },
  ],
  ninja: [
    { clip: 'Throw', f: 0.45, lean: 0.15, hop: 0.25 },
    { clip: 'Dodge_Backward', f: 0.5, hop: 0.35 },
    { clip: 'Dualwield_Melee_Attack_Chop', f: 0.5, arc: 'slash', spin: 2.5, hop: 0.42, lean: 0.2, kick: 0.5 },
  ],
  necro: [
    { clip: 'Spellcast_Summon', hold: 'Spellcasting', f: 0.55, lean: -0.1 },
    { clip: 'Spellcast_Shoot', f: 0.5, kick: -0.8 },
    { clip: '2H_Melee_Attack_Chop', hold: 'Spellcasting', f: 0.55, arc: 'ring', float: 0.3 },
  ],
  druid: [
    { clip: 'PickUp', f: 0.5, lean: 0.15 },
    { clip: '2H_Melee_Attack_Chop', f: 0.55, arc: 'ring', hop: 0.3 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.55, float: 0.4, lean: -0.12 },
  ],
  cleric: [
    { clip: 'Spellcast_Long', f: 0.45, lean: -0.15 },
    { clip: 'Block', hold: 'Blocking', f: 0.5, kick: -0.6 },
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, arc: 'ring', float: 0.4 },
  ],
  bard: [
    { clip: 'Interact', f: 0.3, hop: 0.3 },
    { clip: '2H_Melee_Attack_Slice', f: 0.5, arc: 'slash', kick: 0.8 },
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, spin: 1, float: 0.3 },
  ],
  angel: [
    { clip: 'Jump_Full_Long', f: 0.6, hop: 0.6, lean: 0.15 },
    { clip: 'Block', hold: 'Blocking', f: 0.5 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.55, arc: 'ring', float: 0.6 },
  ],
  chronist: [
    { clip: 'Dodge_Right', f: 0.5, kick: -0.8 },
    { clip: '1H_Ranged_Shoot', f: 0.3, lean: 0.1, kick: -0.8 },
    { clip: 'Spellcast_Raise', hold: 'Spellcasting', f: 0.55, spin: 1, float: 0.35 },
  ],
  archer: [
    { clip: '2H_Ranged_Shooting', hold: '2H_Ranged_Aiming', f: 0.2, lean: -0.1, kick: -0.8 },
    { clip: '1H_Ranged_Shoot', hold: '2H_Ranged_Aiming', f: 0.3, lean: -0.35 },   // mira para o alto: a chuva cai lá na frente
    { clip: '2H_Ranged_Shoot', hold: '2H_Ranged_Aiming', f: 0.2, lean: 0.15, hop: 0.25, kick: -1.4 },
  ],
  monk: [
    { clip: 'Unarmed_Melee_Attack_Punch_A', f: 0.45, arc: 'thrust', kick: 0.8 },
    { clip: 'Unarmed_Melee_Attack_Punch_B', hold: 'Unarmed_Idle', f: 0.45, arc: 'thrust', lean: 0.2, kick: 1.2 },
    { clip: 'Sit_Floor_Down', hold: 'Unarmed_Idle', f: 0.6, float: 0.2 },
  ],
  alchemist: [
    { clip: 'Use_Item', f: 0.45, lean: 0.12 },
    { clip: 'Throw', hold: 'Use_Item', f: 0.45, hop: 0.2, lean: 0.2 },
    { clip: 'Spellcast_Long', hold: 'Spellcasting', f: 0.62, arc: 'ring', spin: -0.8, float: 0.22, lean: -0.12 },
  ],
};

class Minion extends Unit {
  constructor(summoner, side) {
    super(assets.Skeleton_Minion, { hp: 55 * summoner.skillPower, dmg: 9, range: 1.3, speed: 3.4, cooldown: 1.3 }, 'ally');
    this.summoner = summoner;
    this.cfg = { id: 'minion' };
    this.level = summoner.level;
    this.life = scaleBranchEffect(summoner, 'support', 8) * summoner.skillPower;
    this.pos.copy(summoner.pos).add(new THREE.Vector3(side * 0.9, 0, 0));
    this.size = 0.7;
    this.popT = 0;
    this.bar.classList.add('ally');
    for (const m of this.mats) m.color?.set(0xb5ffbc);
    Skeleton.prototype.attach.call(this, 'Skeleton_Blade', 'handslotr');
    this.loop('Idle_Combat');
    poof(this.pos, 0.7);
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    if (game.over) return;
    this.life -= dt;
    if (this.dead || this.life <= 0) { poof(this.pos, 0.7); this.remove(); return; }
    if (this.busy > 0) return;
    const targets = activeTargetContext?.attackableSkeletons ?? skeletonsAlive().filter((s) => !s.spawning);
    const target = nearest(this.pos, targets);
    if (target && game.state === 'fight') {
      if (target.pos.distanceTo(this.pos) > this.range) this.moveTo(target.pos, dt);
      else if (this.attackTimer <= 0 && this.face(target.pos, dt) < 0.5) this.attack(target, '1H_Melee_Attack_Chop');
    } else if (this.pos.distanceTo(this.summoner.pos) > 1.5) this.moveTo(this.summoner.pos, dt);
    if (this.busy <= 0) this.locomote('Walking_D_Skeletons', 'Walking_D_Skeletons', 'Idle_Combat');
  }
}

// Troca de fase do chefe: ao cair abaixo de metade da vida, ele se enfurece e recupera parte dela de uma vez.
const BOSS_RALLY_AT = 0.5, BOSS_RALLY_HEAL = 0.25;   // fração da vida que dispara · fração da vida máxima recuperada
class Skeleton extends Unit {
  constructor(type, phase, boss = false) {
    const base = SKELETONS[type];
    const D = difficulty;
    const hpScale = (1 + (phase - 1) * 0.12) * D.hp * (boss ? 9 * D.boss : 1);
    const dmgScale = (1 + (phase - 1) * 0.06) * D.dmg * (boss ? 2.5 * D.boss : 1);
    super(assets[`Skeleton_${base.model || type}`], { ...base, hp: Math.round(base.hp * hpScale), dmg: Math.round(base.dmg * dmgScale), speed: base.speed * (boss ? 0.8 : 1) }, 'skeleton');
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
    this.stunT = 0;
    this.rootT = 0;
    this.slowT = 0;
    this.burnT = 0;
    this.burnTick = 0;
    this.burnDmg = 0;
    this.burnOwner = null;
    this.tauntT = 0;
    this.markT = 0;       // Flecha do caçador: recebe +markBonus de dano
    this.markBonus = 0;
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
    this.speed *= 0.85 + Math.random() * 0.3;   // cada esqueleto num ritmo um pouco diferente
    this.size = base.size || (boss ? 1.7 : 1);
    this.root.scale.setScalar(this.size);
    if (boss) this.range += 0.6;
    if (this.boss) this.bar.classList.add('boss');
    if (base.weapon) this.attach(base.weapon, 'handslotr');   // o GLTFLoader tira o ponto de "handslot.r"
    if (base.shield) this.attach(base.shield, 'handslotl');
    this.spawning = true;
    this.busy = this.once(base.spawn || 'Spawn_Ground_Skeletons');
    base.dress?.(this);   // peças, cores e brilho dos tipos novos
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
  }

  update(dt) {
    if (dt <= 0) return;
    this.rootT = Math.max(0, this.rootT - dt);
    if (this.rootT > 0) this.vel.set(0, 0, 0);
    this.stunT = Math.max(0, this.stunT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.burnT = Math.max(0, this.burnT - dt);
    this.burnTick -= dt;
    if (this.burnT > 0 && this.burnTick <= 0 && this.burnOwner && !this.dead) {
      this.takeDamage(this.burnDmg, this.pos, this.burnOwner);
      this.burnTick = 0.65;
    }
    this.root.rotation.z = this.rootT > 0 && !this.dead ? Math.sin(this.rootT * 45) * 0.05 : 0;   // preso pelos galhos: treme tentando se soltar
    this.tauntT -= dt;
    this.markT = Math.max(0, this.markT - dt);
    if (this.markT <= 0) this.markBonus = 0;
    this.sheepT = Math.max(0, this.sheepT - dt);
    if (this.stunT > 0 || this.sheepT > 0) { this.pendingHit = null; if (this.stunT > 0) this.vel.set(0, 0, 0); }
    if (this.ranged && !this.mobile) this.vel.set(0, 0, 0);
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
    const target = this.tauntT > 0 && this.taunt && !this.taunt.dead ? this.taunt
      : this.raider && game.shrine && !game.shrine.dead ? game.shrine
        : this.raider && game.gate ? game.gate
        : nearest(this.pos, activeTargetContext?.alliedUnits ?? enemyTargetAllies());
    if (this.kind?.think?.(this, dt, target)) {   // comportamento próprio (golpes especiais, cura, bomba)
      if (this.busy <= 0) this.locomote(this.move, this.walk, this.idle);
      return;
    }
    if (target) {
      const d = target.pos.distanceTo(this.pos) - (target.reach || 0);   // prédios do Reino: golpeia a parede, não o centro
      if (this.ranged) this.vel.set(0, 0, 0);
      if (d > this.range || (!this.ranged && Math.abs(target.pos.y - this.pos.y) >= 0.85)) { if (!this.ranged && this.rootT <= 0) this.moveTo(target.pos, dt); }
      else if (this.face(target.pos, dt) < 0.5 && this.attackTimer <= 0) this.attack(target, this.attackAnim);
    }
    if (this.busy <= 0) this.locomote(this.move, this.walk, this.idle);
  }
}

// move units apart in a few small solver passes so blocked moves do not put
// them back at their original, overlapping positions.
const collisionFrom = { x: 0, z: 0 }, collisionTo = { x: 0, z: 0 };
const separationSideA = { x: 0, z: 0 }, separationSideB = { x: 0, z: 0 };
function collisionMove(unit, dx, dz) {
  const pos = unit.pos, fromX = pos.x, fromZ = pos.z;
  let fraction = 1;
  for (let attempt = 0; attempt < 5; attempt++, fraction *= 0.5) {
    const toX = fromX + dx * fraction, toZ = fromZ + dz * fraction;
    collisionFrom.x = fromX; collisionFrom.z = fromZ;
    collisionTo.x = toX; collisionTo.z = toZ;
    const wasOnPlateau = unit.team === 'skeleton' && unit.ranged && world.groundHeight(fromX, fromZ) >= 2.95;
    if (!world.canStep(collisionFrom, collisionTo) || (wasOnPlateau && world.groundHeight(toX, toZ) < 2.95)) continue;
    pos.x = toX;
    pos.z = toZ;
    return Math.hypot(dx, dz) * fraction;
  }
  return 0;
}

function separatePair(a, b, ia, ib) {
  if (Math.abs(a.pos.y - b.pos.y) >= 0.85) return false;
  const min = 0.53 * (a.size + b.size);
  let dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  let distance = Math.hypot(dx, dz);
  if (distance >= min) return false;
  if (distance < 0.001) {
    // Give perfectly coincident units a stable direction instead of skipping them.
    const angle = (ia * 0.754877666 + ib * 0.569840291) * Math.PI * 2;
    dx = Math.cos(angle); dz = Math.sin(angle); distance = 0;
  } else { dx /= distance; dz /= distance; }

  const overlap = min - distance, half = overlap * 0.5;
  let movedA = collisionMove(a, -dx * half, -dz * half);
  let movedB = collisionMove(b, dx * half, dz * half);
  let remaining = overlap - movedA - movedB;
  if (remaining > 0.002) {
    const extraA = collisionMove(a, -dx * remaining, -dz * remaining);
    remaining -= extraA;
    if (remaining > 0.002) collisionMove(b, dx * remaining, dz * remaining);
  }

  // When a wall or height boundary blocks the direct push, let the pair slide
  // around the contact instead of remaining stacked on the same point.
  let slideX = b.pos.x - a.pos.x, slideZ = b.pos.z - a.pos.z;
  const slideDistance = Math.hypot(slideX, slideZ);
  if (slideDistance < min) {
    if (slideDistance > 0.001) { slideX /= slideDistance; slideZ /= slideDistance; }
    else { slideX = dx; slideZ = dz; }
    separationSideA.x = a.pos.x; separationSideA.z = a.pos.z;
    separationSideB.x = b.pos.x; separationSideB.z = b.pos.z;
    const sideDistance = Math.sqrt(Math.max(0, min * min - slideDistance * slideDistance)) * 0.5;
    const sideDx = -slideZ, sideDz = slideX;
    collisionMove(a, -sideDx * sideDistance, -sideDz * sideDistance);
    collisionMove(b, sideDx * sideDistance, sideDz * sideDistance);
    if (Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) <= slideDistance + 0.002) {
      a.pos.x = separationSideA.x; a.pos.z = separationSideA.z;
      b.pos.x = separationSideB.x; b.pos.z = separationSideB.z;
    }
  }

  // Remove inward velocity at contact so units stop pushing through one another.
  const closing = (a.vel.x - b.vel.x) * dx + (a.vel.z - b.vel.z) * dz;
  if (closing > 0) {
    a.vel.x -= dx * closing * 0.5; a.vel.z -= dz * closing * 0.5;
    b.vel.x += dx * closing * 0.5; b.vel.z += dz * closing * 0.5;
  }
  return true;
}

const SEPARATION_CELL_SIZE = 3;
const OBSTACLE_GRID_QUERY_THRESHOLD = 512;
const separationAlive = [], separationCandidates = [], separationCellX = [], separationCellZ = [];
const separationGrid = new Map(), separationGridPool = [];
const obstacleGrid = new Map(), obstacleGridPool = [];
const obstacleQueryIndexes = [], obstacleQueryCandidates = [], obstacleQuerySeen = new Set();
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
  obstacleQueryIndexes.length = 0;
  obstacleQuerySeen.clear();
  const minCellX = Math.floor(minX / SEPARATION_CELL_SIZE), maxCellX = Math.floor(maxX / SEPARATION_CELL_SIZE);
  const minCellZ = Math.floor(minZ / SEPARATION_CELL_SIZE), maxCellZ = Math.floor(maxZ / SEPARATION_CELL_SIZE);
  for (let x = minCellX; x <= maxCellX; x++) for (let z = minCellZ; z <= maxCellZ; z++) {
    const bucket = obstacleGrid.get(gridCellKey(x, z));
    if (!bucket) continue;
    for (const obstacleIndex of bucket) if (!obstacleQuerySeen.has(obstacleIndex)) {
      obstacleQuerySeen.add(obstacleIndex);
      obstacleQueryIndexes.push(obstacleIndex);
    }
  }
  if (obstacleQueryIndexes.length > 1) obstacleQueryIndexes.sort(compareObstacleIndexes);
  obstacleQueryCandidates.length = 0;
  for (const obstacleIndex of obstacleQueryIndexes) obstacleQueryCandidates.push(world.obstacles[obstacleIndex]);
  return obstacleQueryCandidates;
}

function separate() {
  separationAlive.length = 0;
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
    recycleGrid(separationGrid, separationGridPool);
    for (let i = 0; i < separationAlive.length; i++) {
      const unit = separationAlive[i];
      const x = separationCellX[i] = Math.floor(unit.pos.x / SEPARATION_CELL_SIZE);
      const z = separationCellZ[i] = Math.floor(unit.pos.z / SEPARATION_CELL_SIZE);
      addToGrid(separationGrid, separationGridPool, x, z, i);
    }
    for (let i = 0; i < separationAlive.length; i++) {
      separationCandidates.length = 0;
      const x = separationCellX[i], z = separationCellZ[i];
      for (let dx = -pairCellRange; dx <= pairCellRange; dx++) for (let dz = -pairCellRange; dz <= pairCellRange; dz++) {
        const bucket = separationGrid.get(gridCellKey(x + dx, z + dz));
        if (bucket) for (const j of bucket) if (j > i) separationCandidates.push(j);
      }
      separationCandidates.sort((a, b) => a - b);
      for (const j of separationCandidates) {
        if (separatePair(separationAlive[i], separationAlive[j], i + 1, j + 1)) needsAnotherPass = true;
      }
    }
    for (let i = 0; i < separationAlive.length; i++) {
      const u = separationAlive[i];
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
}

// ---------- fases ----------
// state: 'fight' (onda) -> 'cleared' (comemoração + escolha de herói) -> 'advance' (sobe a estrada) -> 'fight'
const game = { phase: 1, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0, guideS: 0, over: false, paused: false };

// view: 'menu' (tela inicial) ou 'map' (mapa da campanha)
function startGame(view = 'menu') {
  game.realm?.stop();   // saindo do modo Reino: some a arena e volta a estrada
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
  pick.upgrades = [];
  while (enemyBolts.length) scene.remove(enemyBolts.pop().mesh);
  for (const list of [bolts, blasts, flames]) while (list.length) {
    const effect = list.pop();
    scene.remove(effect.mesh);
    if (list !== bolts) effect.mesh.material.dispose();
  }
  clearFx();
  FX.clear();
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
  clearMonsterFx();   // avisos, covas e barra do chefe
  // ?fase=N na URL começa direto na fase N (atalho para testar o cenário)
  placeParty(THREE.MathUtils.clamp(+new URLSearchParams(location.search).get('fase') || 1, 1, PHASES));
  $('overlay').classList.remove('results', 'lost');
  $('overlay').classList.add('hidden');
  if (view === 'map') showCampaign();
  else if (view?.goal) showCampaign(view);   // "Próxima missão" / "Tentar de novo" vão direto à dificuldade
  else if (view === 'reino') startKingdom();
  else showMenu();   // modo -> (mapa) -> dificuldade -> escolha do herói
}

// balanço da câmera no menu inicial (orbitMenu); placeParty o zera junto com a câmera
const menuOrbit = { t: 0, angle: 0 };

// põe o grupo (e a câmera) na fase inicial e zera a partida; game.mission continua
function placeParty(first) {
  const m = game.mission;
  const search = new URLSearchParams(location.search);
  Object.assign(game, { phase: first, start: first, last: m ? m.to : PHASES, kills: 0, toSpawn: 0, spawnTimer: 0, bossPending: false, state: 'advance', timer: 0,
    guideS: world.anchorS(first), over: false, picksLeft: 0, falls: 0, fallLog: [], roster: [], damageSources: {}, relics: [], runTime: 0, missionT: 0, surviveT: m?.goal.time || 0, totemsPlaced: 0, totemsDown: 0, towersDown: 0, rescueComplete: false, rescueT: 0, rescueRunner: null, objectiveCall: 0, bossSeen: false, bossDown: false, villager: null, militia: null,
    shrine: null, huntMark: null, huntDown: false, huntEscaped: false, endlessT: 0, endlessStars: 0, gate: null, leaks: 0, eliteWave: 0, eliteSize: 0, refilling: false,
    test: search.has('fase') || search.get('tudo') === '1', missionHpRatio: null, missionVillagerRatio: null, ultimates: 0, twinFocus: null });
  game.rerolls = game.test ? 0 : progress.rerolls();
  if (game.test) setTimeout(() => showBanner('Modo de teste · não salva', 3), 600);   // ?fase= ou ?tudo=1 na URL
  renderRelicTray();
  const start = world.pointAt(game.guideS);
  follow.set(start.x, 0, start.z - 3);
  controls.target.copy(follow);
  camera.position.set(follow.x, 27.6, follow.z + 25.2);   // mesmo ângulo, 20% mais longe: mais campo de visão
  menuOrbit.t = menuOrbit.angle = 0;   // o balanço do menu recomeça do ângulo de jogo
  $('goal').classList.toggle('hidden', !m);
  if (m) {
    $('goal').setAttribute('data-icon', GOAL_ICONS[m.goal.type] || '⚑');
    setGoalUI(goalText(m.goal), 0);
  }
  $('goal').classList.remove('warn', 'done');
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
    musterMilitia();
    document.body.classList.remove('no-battle');   // o HUD da batalha só aparece agora
    game.paused = false;
  };
  if (typeof withBattleAssets === 'function') return withBattleAssets(begin);
  begin();
}

function startPhase() {
  game.state = 'fight';
  tutorial.on('battleStart');
  for (const h of heroes()) h.kiteT = 0;   // recuo da fase anterior não continua
  game.toSpawn = Math.round((2 + game.phase * 2) * difficulty.count);
  game.bossPending = isBossPhase(game.phase);   // Rei (6), Carrasco (9) e Lich (12)
  game.spawnTimer = 0.5;
  const goal = game.mission?.goal;
  const waveScale = goal?.type === 'duel' ? goal.waves : (goal?.type === 'elite' || goal?.type === 'twin' || goal?.type === 'bosses') ? goal.scale : 0;   // encontros especiais reduzem a onda comum; os chefes continuam garantidos
  if (waveScale) game.toSpawn = Math.max(3, Math.round(game.toSpawn * waveScale));
  if (goal?.type === 'elite') { game.eliteWave = 1; game.eliteSize = game.toSpawn; }
  if (goal?.type === 'totems') {   // espalha o que falta dos totens pelas fases que restam
    const n = Math.ceil((goal.count - game.totemsPlaced) / (game.last - game.phase + 1));
    for (let k = 0; k < n; k++) placeTotem(k);
  }
  if (goal?.type === 'tower' && game.totemsPlaced < goal.count) {
    for (let k = 0; k < goal.count - game.totemsPlaced; k++) placeTotem(k, true);
  }
  const captive = goal?.type === 'rescue' && game.phase === game.start ? captivePrisoner() : null;
  if (captive) for (const off of [-1.8, 1.8]) {   // guardas ao lado do prisioneiro
    const s = new Skeleton(off < 0 ? 'Warrior' : 'Minion', game.phase);
    s.pos.set(captive.pos.x + off, 0, captive.pos.z + 1.2);
    s.pos.y = world.groundHeight(s.pos.x, s.pos.z);
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
    this.post.copy(world.pointAt(game.guideS)).addScaledVector(fwd, -3.2);
    return fwd;
  }

  update(dt) {
    if (dt <= 0) return;
    this.updateCommon(dt);
    if (this.dead || game.over || this.busy > 0) return;
    if (this.captive && !this.rescued) { this.vel.set(0, 0, 0); this.loop('Idle'); return; }
    const fwd = this.follow();
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
const MILITIA_RING = 1.9;       // raio do anel de guarda
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

  // posto no anel em volta do protegido; sem protegido, fica onde está
  follow() {
    const ward = guardedObjective();
    if (!ward) return this.post.copy(this.pos);
    const a = (this.slot / Math.max(1, game.militia?.size || 1)) * Math.PI * 2;
    return this.post.set(ward.pos.x + Math.cos(a) * MILITIA_RING, ward.pos.y, ward.pos.z + Math.sin(a) * MILITIA_RING);
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
      if (target.pos.distanceTo(this.pos) > this.range) this.moveTo(target.pos, dt);
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
  if (v && !v.dead && !v.captive) return v;
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
    const towerHealth = tower ? 420 : 240;
    super(totemModel(), { hp: Math.round(towerHealth * difficulty.hp * (1 + (game.phase - 1) * 0.12)), dmg: 0, range: 0, speed: 0, cooldown: 1 }, 'skeleton');
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
const ELITE_HP = 1.45, ELITE_DMG = 1.2, TWIN_HP = 0.6;
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
function spawnTwinBoss(lich) {
  const s = new Skeleton('Executioner', game.phase, true);
  s.maxHp = s.hp = Math.round(s.hp * TWIN_HP);
  s.pos.copy(lich.pos).addScaledVector(world.sideOf(world.tangentAt(world.anchorS(game.phase))), 3);
  s.pos.y = world.groundHeight(s.pos.x, s.pos.z);
  s.root.rotation.y = lich.root.rotation.y;
  return s;
}

// No coração do castelo, os três guardiões entram em posições separadas e
// com atributos reduzidos para que o perigo venha da combinação de golpes.
function prepareCastleBoss(boss, hpScale, dmgScale, title) {
  boss.maxHp = boss.hp = Math.round(boss.maxHp * hpScale);
  boss.dmg = Math.round(boss.dmg * dmgScale);
  boss.kind = { ...boss.kind, title };
  boss.emissiveDirty = true;
  return boss;
}
function spawnCastleBosses(lich) {
  const s0 = world.anchorS(game.phase), anchor = world.pointAt(s0);
  const faceCenter = (boss) => { boss.root.rotation.y = Math.atan2(anchor.x - boss.pos.x, anchor.z - boss.pos.z); };
  lich.pos.copy(world.along(s0 + 8, 0));
  lich.pos.y = world.groundHeight(lich.pos.x, lich.pos.z);
  prepareCastleBoss(lich, 0.72, 0.82, 'Coração sombrio');
  faceCenter(lich);
  const guardians = [
    { kind: 'Executioner', forward: 11, lateral: -6, hp: 0.42, dmg: 0.58, title: 'Carrasco do trono' },
    { kind: 'DarkKnight', forward: 15, lateral: 6, hp: 0.46, dmg: 0.56, title: 'Cavaleiro do Eclipse' },
  ];
  for (const entry of guardians) {
    const boss = new Skeleton(entry.kind, game.phase, true);
    boss.pos.copy(world.along(s0 + entry.forward, entry.lateral));
    boss.pos.y = world.groundHeight(boss.pos.x, boss.pos.z);
    prepareCastleBoss(boss, entry.hp, entry.dmg, entry.title);
    faceCenter(boss);
  }
}

// alvo da caçada: batedor resistente que foge de quem chega perto até ser encurralado no fim da clareira
const HUNT_FLEE = 4.5, HUNT_EDGE = 20, HUNT_PURSUIT_LIMIT = 25, HUNT_INTERCEPTORS = 2;
const huntDest = new THREE.Vector3();
function huntThink(u, dt) {
  if (u.rootT > 0 || u.tauntT > 0) return false;   // preso ou provocado: luta onde está
  const s0 = world.anchorS(game.phase), fwd = world.tangentAt(s0), anchor = world.pointAt(s0), side = world.sideOf(fwd);
  const dx = u.pos.x - anchor.x, dz = u.pos.z - anchor.z;
  const ahead = dx * fwd.x + dz * fwd.z;
  const chased = (activeTargetContext?.party ?? heroes()).some((h) => !h.dead && h.pos.distanceTo(u.pos) < HUNT_FLEE);
  if (!chased || ahead >= HUNT_EDGE - 0.5) return false;   // sem perseguidor ou encurralado: volta a atacar
  const lateral = THREE.MathUtils.clamp(dx * side.x + dz * side.z, -(ROAD - 1), ROAD - 1);
  u.moveTo(huntDest.copy(world.along(s0 + Math.min(HUNT_EDGE, ahead + 4), lateral)), dt);
  return true;
}

function spawnHuntMark() {
  const s = new Skeleton('Rogue', game.phase);
  s.maxHp = s.hp = Math.round(s.hp * 6);
  s.speed = Math.max(s.speed, 2.6);
  s.hunted = true;
  s.kind = { ...s.kind, think: huntThink };
  s.pos.copy(world.along(world.anchorS(game.phase) + 13, 0));
  s.pos.y = world.groundHeight(s.pos.x, s.pos.z);
  s.bar.classList.add('boss');
  const label = document.createElement('span');
  label.textContent = 'Alvo marcado';
  s.bar.appendChild(label);
  for (const m of s.mats) { m.userData ||= {}; m.userData.glow = 0x5c1212; }
  s.emissiveDirty = true;
  game.huntMark = s;
  return s;
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
      game.surviveT = Math.max(0, game.surviveT - dt);
      if (game.surviveT > 0 && game.toSpawn === 0 && skeletons.length < 7) game.toSpawn = Math.min(4, 7 - skeletons.length);
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
      const cap = Math.min(22, 6 + Math.floor(game.endlessT / 20) * 2);
      if (game.toSpawn === 0 && skeletons.length < cap) game.toSpawn = Math.min(cap - skeletons.length, 3 + Math.floor(game.endlessT / 30));
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
    if (!rescueThreatened) for (const hero of party) if (!hero.dead && tacticalDistance(hero.pos, captive.pos) <= RESCUE_RADIUS) { near = true; break; }
    game.rescueT = near ? game.rescueT + dt : Math.max(0, game.rescueT - dt * 0.5);
    captive.nameTag.textContent = rescueThreatened ? 'Limpe a área'
      : game.rescueT > 0 ? `Libertando ${Math.floor(Math.min(1, game.rescueT / RESCUE_TIME) * 100)}%` : 'Prisioneiro';
  }
  if (captive && game.rescueT >= RESCUE_TIME) {
    game.villager.rescued = true;
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
      showBanner('Chefe derrotado!', 2.5);
    }
  }
  if (goal.type === 'survive' && game.phase === goal.phase && game.state === 'fight') {   // ondas sem parar até o tempo acabar
    game.surviveT = Math.max(0, game.surviveT - dt);
    if (game.surviveT > 0 && game.toSpawn === 0 && skeletons.length < 6) game.toSpawn = Math.min(4, 6 - skeletons.length);
  }
  const lost = newGoalTick(goal, dt, skeletons);
  if (lost) return fail(lost);
  if (hasDestructionGoal(goal) && game.state === 'fight') {
    for (const t of skeletons) if (t.totem && (t.spawnT -= dt) <= 0) {
      t.spawnT = 6 * difficulty.interval;
      if (skeletons.length >= 12) continue;
      const s = new Skeleton(Math.random() < 0.3 ? 'Warrior' : 'Minion', game.phase);
      const a = Math.random() * Math.PI * 2;
      s.pos.set(t.pos.x + Math.cos(a) * 1.6, 0, t.pos.z + Math.sin(a) * 1.6);
      s.pos.y = world.groundHeight(s.pos.x, s.pos.z);
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
    case 'boss': text = game.bossDown ? 'Chefe derrotado!' : game.bossSeen ? 'Derrote o chefe!' : `Chefe na fase ${Math.ceil(game.phase / 6) * 6}`; break;
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
      text = `Noite ${clockText(game.endlessT)}${next ? ` · ★ em ${clockText(next - game.endlessT)}` : ` · ★★★ · amanhece em ${clockText(Math.max(0, goal.dawn - game.endlessT))}`}`;
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

// próximo passo no fim da missão: seguir para a próxima arena ou tentar de novo
function missionNextHTML(won, next, unlockedNow) {
  if (won && next) {
    const tip = `${unlockedNow ? 'Nova missão liberada' : 'Próxima missão'}: ${next.name}`;
    return `<button class="mission-next-btn" type="button" aria-label="Próxima missão: ${escAttr(next.name)}" data-tip="${escAttr(tip)}">Próxima ▸</button>`;
  }
  if (won) return '';
  return '<button class="mission-next-btn" type="button" data-tip="Ajuste o grupo e tente de novo">↻ Tentar de novo</button>';
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
  const result = { won, falls: game.falls, hpRatio, goal: game.mission.goal, shrineRatio: shrine ? Math.max(0, shrine.hp) / shrine.maxHp : 0, villagerRatio, timeLeft: game.surviveT, endlessTime: game.endlessT, leaks: game.leaks, seconds: game.missionT };
  const stars = starsFor(result);
  const conditions = starConditions(result);
  const before = totalStars();
  const cosmeticsBefore = !game.test && game.mission
    ? new Set(campaignCosmetics().filter((cosmetic) => cosmetic.unlocked).map((cosmetic) => cosmetic.id))
    : null;
  const best = !game.test && saveStars(game.mission.id, stars);
  // a medalha compara com os recordes anteriores, então grava antes do tempo
  const medal = game.test ? null : saveMissionMedal(game.mission.id, { won, stars, difficultyId: difficulty.id });
  // na horda, tempo maior é melhor: quem mede são as estrelas, não o recorde de tempo
  const bestTime = !game.test && game.mission.goal.type !== 'endless' && saveMissionRecord(game.mission.id, { won, seconds: game.missionT, difficultyId: difficulty.id });
  const fresh = allOpen() ? [] : UNLOCKS.filter((u) => u.stars > before && u.stars <= totalStars()).map((u) => VARIANTS.find((v) => v.id === u.id));
  const cosmeticUnlocks = cosmeticsBefore
    ? campaignCosmetics().filter((cosmetic) => cosmetic.unlocked && !cosmeticsBefore.has(cosmetic.id))
    : [];
  // estrelas grandes; o critério de cada uma fica na dica (e no nome acessível da fileira)
  const criterion = (c) => c ? `${c.achieved ? '✓' : '○'} ${c.label}` : '';
  const row = `<span class="stars big" role="img" aria-label="${stars} de 3 estrelas. ${escAttr(conditions.map(criterion).join('; '))}">${[1, 2, 3].map((k) =>
    `<i class="${k <= stars ? 'on' : ''}" data-tip="${escAttr(criterion(conditions[k - 1]))}">★</i>`).join('')}</span>`;
  const chips = [
    best && stars ? endChip('★', 'Melhor', 'Novo melhor resultado nesta missão!', 'star') : '',
    bestTime ? endChip('⏱', formatMissionRecordTime(game.missionT), `Novo recorde · ${difficulty.name} · ${formatMissionRecordTime(game.missionT)}`) : '',
    ...cosmeticUnlocks.map((cosmetic) => endChip('✦', 'Cosmético novo', `${cosmetic.name} desbloqueado em ${cosmetic.chapter}. Equipe no Acampamento.`, 'cosmetic')),
    ...fresh.map((cfg) => `<span class="end-chip unlock" tabindex="0" style="--c:${cfg.color[0]};--cd:${cfg.color[1]}" data-tip="Nova variante liberada: ${escAttr(cfg.name)}" aria-label="Nova variante liberada: ${escAttr(cfg.name)}"><img src="${cfg.portrait}" alt="">Nova!</span>`),
  ].join('');
  $('overlayStars').innerHTML = row + (chips ? `<div class="end-chips">${chips}</div>` : '')
    + (game.test ? '<div class="star-best">Modo de teste: estrelas e recordes não contam</div>' : '')
    + (won && medal ? missionRewardHTML(stars, totalStars() - before, medal) : '');
  return stars;
}

function spawnSkeleton() {
  const p = game.phase;
  const zone = world.zoneOf(p);
  const onTop = zone?.type === 'plateau' && game.toSpawn <= 2;
  let type = 'Minion', boss = false;
  const lead = game.toSpawn === 1 && !game.refilling ? waveLeader(p, game.bossPending) : null;   // Rei (6), Lich (12) ou golem
  if (lead) { type = lead; boss = game.bossPending; }
  else {
    const r = Math.random();
    const rogue = Math.min(0.3, 0.04 * p), warrior = Math.min(0.4, 0.06 * p);
    type = r < rogue ? 'Rogue' : r < rogue + warrior ? 'Warrior' : 'Minion';
    type = pickMonster(p, type);   // tipos novos entram aos poucos
    if (p >= 2 && ['Minion', 'Warrior', 'Rogue'].includes(type) && Math.random() < difficulty.shooters)
      type = Math.random() < 0.5 ? 'Crossbow' : 'Mage';
  }
  if (onTop && !lead && difficulty.shooters > 0) type = game.toSpawn === 2 ? 'Crossbow' : 'Mage';
  const s = new Skeleton(type, p, boss);
  const s0 = world.anchorS(p);
  const behind = p >= difficulty.behindFrom && !lead && game.mission?.goal.type !== 'breach' && Math.random() < difficulty.behind;   // nas fases mais altas, alguns vêm por trás
  for (let tries = 0; tries < 12; tries++) {
    const at = behind ? s0 - 9 - Math.random() * 3 : s0 + 11 + Math.random() * 6;
    s.pos.copy(world.along(at, (Math.random() * 2 - 1) * (ROAD - 1)));
    if (!world.obstacles.some((o) => Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < o.r + 0.8)) break;
  }
  if (zone) {
    const points = onTop ? zone.top : zone.type === 'lake' && !boss && game.toSpawn % 3 === 0 ? zone.water : zone.ground;
    s.pos.copy(points[game.toSpawn % points.length]);
    if (world.isShallow(s.pos.x, s.pos.z)) waterSplash(s.pos, true);
  }
  s.pos.y = world.groundHeight(s.pos.x, s.pos.z);
  const c = world.pointAt(s0);
  s.root.rotation.y = Math.atan2(c.x - s.pos.x, c.z - s.pos.z);   // de frente para os heróis
  if (game.mission?.goal.type === 'defend' && !lead && Math.random() < 0.45) s.raider = true;   // saqueadores correm para o santuário
  if (game.mission?.goal.type === 'breach' && !lead && !s.ranged && Math.random() < 0.3) s.raider = true;   // corredores vão direto à ponte
  if (game.mission?.goal.type === 'elite' && !lead) makeElite(s);
  if (game.mission?.goal.type === 'twin' && lead && boss) spawnTwinBoss(s);
  if (game.mission?.goal.type === 'bosses' && lead && boss) spawnCastleBosses(s);
  if (game.mission?.goal.type === 'duel' && lead && boss) {   // o Rei do duelo é feito para um herói só
    s.maxHp = s.hp = Math.round(s.hp * game.mission.goal.bossHp);
    s.dmg = Math.round(s.dmg * game.mission.goal.bossDmg);
  }
}

// monsters.js usa estas peças do jogo (ele não importa o main.js)
linkMonsters({ Skeleton, units, heroes, allies, skeletonsAlive, markEmissiveDirty: (unit) => { if (unit) unit.emissiveDirty = true; }, livingAllies: () => activeTargetContext?.livingAllies || allies().filter((unit) => !unit.dead), rangedHeroes: () => activeTargetContext?.rangedHeroes || heroes().filter((hero) => hero.ranged), scene, assets, get world() { return world; }, ring, beam, poof, popText, showBanner,
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
  if (!alive.length && game.mission?.goal.type === 'endless') {   // na horda, cair faz parte: vale o tempo aguentado
    const held = game.endlessT >= game.mission.goal.marks[0];
    return endGame(`${held ? 'A horda foi contida' : 'A horda venceu'} por ${clockText(game.endlessT)}.`, held);
  }
  if (!alive.length) return endGame(game.mission?.goal.type === 'nofall'
    ? `Todo o grupo caiu na fase ${game.phase}. A missão terminou.`
    : `Os esqueletos venceram na fase ${game.phase}.`, false);
  if (game.mission && campaignTick(dt, skeletons, party)) return;

  if (game.state === 'fight') {
    if (tutorial.wants('enemyNear')) {
      const foe = skeletons.find(s => alive.some(h => h.pos.distanceTo(s.pos) < 10));
      if (foe) tutorial.on('enemyNear', { enemy: foe, camera, fighting: () => game.state === 'fight' });
    }
    pressForward(dt, skeletons, party);
    if (game.toSpawn > 0) {
      game.spawnTimer -= dt;
      const bossWaits = game.bossPending && game.toSpawn === 1 && skeletons.length > 4;   // o chefe só entra quando a onda diminui, sem chegar junto com ela
      if (game.spawnTimer <= 0 && !bossWaits) { spawnSkeleton(); game.toSpawn--; game.spawnTimer = Math.max(0.3, 1.0 - game.phase * 0.05) * difficulty.interval; }
    } else if (!skeletons.length && !captivePrisoner()) {   // o prisioneiro preso segura a fase
      if (game.mission && game.phase >= game.last) {
        let hp = 0, maxHp = 0;
        for (const h of party) { hp += Math.max(0, h.hp); maxHp += h.maxHp; }
        game.missionHpRatio = hp / Math.max(1, maxHp);
        const villager = game.villager;
        game.missionVillagerRatio = villager && villager.maxHp > 0
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
        h.guardT = 0;
        popText(h.pos, '♥', 'heal');
        h.busy = h.once('Cheer');
      }
      const v = game.villager;
      if (v && !v.dead) v.hp = Math.min(v.maxHp, v.hp + v.maxHp * difficulty.heal);
      for (const u of units) if (u.militia && !u.dead) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * difficulty.heal);
      game.state = 'cleared';
      game.timer = 2.2;
    }
  } else if (game.state === 'cleared') {
    game.timer -= dt;
    if (game.timer <= 0) {
      if (game.phase >= game.last) return endGame(game.mission ? game.mission.ending || `Missão cumprida: ${game.mission.name}!` : 'O grupo chegou ao castelo!', true);
      game.phase++;
      game.state = 'advance';
      showRelicPick();
    }
  } else if (game.state === 'advance') {
    // o ponto da formação anda pela estrada e o grupo vai atrás
    const goal = world.anchorS(game.phase);
    game.guideS = Math.min(goal, game.guideS + MARCH * dt);
    for (const h of party) h.setAnchor(game.guideS);
    if (game.guideS >= goal && alive.every((h) => h.pos.distanceTo(h.post) < 0.6)) startPhase();
  }

  setText('wave', `${game.phase}/${game.last}`);
  setTip('wave', `Fase ${game.phase} de ${game.last}`);
  // totens, torre e prisioneiro seguram a fase: sem esqueletos comuns, o HUD diz o que falta
  const objective = game.state === 'fight' && !game.toSpawn && skeletons.every((s) => s.totem) ? objectiveHint(skeletons) : null;
  let foes = game.state === 'fight' ? game.toSpawn : 0;
  for (const s of skeletons) if (!s.totem) foes++;
  setText('left', objective || String(foes));
  $('left').classList.toggle('objective', !!objective);
  setTip('left', objective ? `Objetivo: ${objective}` : `${foes} inimigos restantes · ${game.kills} abates`);
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

// resumo da partida para a progressão entre partidas
function matchSummary(won, stars) {
  return {
    mode: game.mission ? 'mission' : 'journey', missionId: game.mission?.id || null, won, difficultyId: difficulty.id,
    kills: game.kills, start: game.start, last: game.last, phase: game.phase,
    phasesCleared: won ? game.last - game.start + 1 : Math.max(0, game.phase - game.start),
    stars: stars || 0, totalStars: totalStars(), falls: game.fallLog?.length || 0, partySize: heroes().length,
    heroes: (game.roster || []).map((h) => ({ id: h.cfg.id, kills: h.stats.abates })), ultimates: game.ultimates || 0, relics: game.relics?.length || 0,
  };
}

function endGame(text, won = false) {
  tutorial.on('leave');
  game.over = true;
  closeHeroPanel();
  audio.stopMusic();
  audio.play(won ? 'victory' : 'defeat');
  $('overlayTitle').textContent = won ? 'Vitória!' : 'Derrota';
  $('overlayText').textContent = text + (saveRecord(won) ? ' · Novo recorde!' : '');
  $('overlayNext').innerHTML = '';
  const missionIndex = MISSIONS.indexOf(game.mission);
  const followingWasOpen = missionIndex >= 0 && missionIndex + 1 < MISSIONS.length && unlocked(missionIndex + 1);
  const missionStars = game.mission ? missionEnd(won) : null;
  const nextMission = game.mission && won && !game.test
    ? MISSIONS.find((mission, index) => unlocked(index) && starsOf(mission.id) === 0)?.name || null
    : null;
  if (game.mission) {   // próximo passo: a missão recém-liberada (ou a seguinte) ou repetir a atual
    const following = missionIndex + 1 < MISSIONS.length && unlocked(missionIndex + 1) ? MISSIONS[missionIndex + 1] : null;
    const next = !won ? null : MISSIONS.find((mission) => mission.name === nextMission) || following;
    const target = won ? next : game.mission;
    $('overlayNext').innerHTML = missionNextHTML(won, next, next === following && following && !followingWasOpen);
    const nextBtn = $('overlayNext').querySelector('.mission-next-btn');
    if (nextBtn && target) nextBtn.onclick = () => startGame(target);
  }
  const party = game.roster;
  const report = buildBattleReport({
    won,
    heroes: party.map((h) => ({ name: h.cfg.names?.[h.level - 1] || h.cfg.name, damage: h.stats.dano, received: h.stats.recebido, kills: h.stats.abates })),
    falls: game.fallLog,
    damageSources: Object.values(game.damageSources),
    militia: game.militia?.size ? { size: game.militia.size, damage: game.militia.damage, kills: game.militia.kills, fallen: game.militia.fallen } : null,
    mission: game.mission ? {
      goal: game.mission.goal,
      time: game.missionT,
      bossDown: game.bossDown,
      bossSeen: game.bossSeen,
      phase: game.phase,
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
  $('overlayStats').innerHTML = summaryHTML(party, report, { won, kills: game.kills, falls: game.fallLog?.length || 0 });
  if (!game.test) {   // ouro, maestria e conquistas (atalhos de teste não contam)
    const reward = progress.recordMatch(matchSummary(won, missionStars));
    const mvp = party.length ? party.reduce((a, b) => (b.stats.dano + b.stats.abates * 40 > a.stats.dano + a.stats.abates * 40 ? b : a)) : null;
    $('overlayStars').innerHTML += rewardHTML(reward, VARIANTS, mvp?.cfg.id);
    toastAchievements(reward.unlocked);
  }
  const storageWarning = !game.test ? progressStorageWarning() : '';
  if (storageWarning) $('overlayStars').innerHTML += `<div class="storage-warning" role="status">${storageWarning}</div>`;
  $('overlayBtn').textContent = game.mission ? 'Mapa' : 'Jogar de novo';
  $('overlayBtn').setAttribute('aria-label', game.mission ? 'Voltar ao mapa' : 'Jogar de novo');
  $('overlayBtn').hidden = false;
  $('overlay').classList.add('results');
  $('overlay').classList.toggle('lost', !won);
  $('overlay').classList.remove('hidden');
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
function frame() {
  requestAnimationFrame(frame);   // agenda antes: um erro no quadro não congela o jogo
  const real = Math.min(clock.getDelta(), 0.05);
  const dt = game.paused ? 0 : real * speed * FX.timeScale(real);   // hit-stop curtinho das ultimates
  if (dt > 0 && !game.over) game.runTime += dt;
  const updateCount = units.length;
  frameUnits.length = updateCount;
  for (let i = 0; i < updateCount; i++) frameUnits[i] = units[i];
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
  frameUnits.length = 0;
  activeTargetContext = null;
  if (dt > 0 && !game.over) separate();
  updateBolts(dt);
  updateEnemyBolts(dt);
  updateFx(dt);
  popTextPool.update(performance.now());
  FX.update(dt);
  if (dt > 0) game.realm ? game.realm.tick(dt) : updateGame(dt);
  showEvolution();
  // câmera e sol acompanham o grupo, sem desfazer o giro que o jogador fez; no Reino a câmera é livre
  if (game.realm) game.realm.camera(real);
  else {
    followParty(real);
    if (pick.open && pick.mode === 'mode') orbitMenu(real);
  }
  controls.update();
  sun.position.set(follow.x + 14, 30, follow.z + 12);
  sun.target.position.copy(follow);
  world.update(real, follow.z, camera);
  const gloom = world.gloomAt(follow.z);
  scene.background.lerpColors(SKY[0], SKY[1], gloom);
  scene.fog.color.copy(scene.background);
  scene.fog.near = 45 - gloom * 22;
  scene.fog.far = 110 - gloom * 45;
  hemi.color.lerpColors(HEMI[0], HEMI[1], gloom);
  hemi.groundColor.lerpColors(HEMI_GROUND[0], HEMI_GROUND[1], gloom);
  hemi.intensity = 1.35 - gloom * 0.3;   // menos luz ambiente e sol mais forte: sombras marcadas
  sun.color.lerpColors(SUN[0], SUN[1], gloom);
  sun.intensity = 3.1 - gloom * 1.4;
  const sel = panelHero();   // anel embaixo do herói com o cartão aberto
  selectRing.visible = !!sel && !sel.dead && units.includes(sel);
  if (selectRing.visible) { selectRing.position.copy(sel.pos).setY(sel.pos.y + 0.06); selectRing.rotation.z += real * 1.5; }
  tickHeroPanel(real);
  if (cam.wheel) { cam.userDist = camera.position.distanceTo(controls.target) / cam.zoom; cam.wheel = false; }   // o jogador mudou o zoom
  const kick = FX.jolt(real);   // tremida dos golpes fortes, só no quadro desenhado
  camera.position.add(kick);
  renderer.render(scene, camera);
  camera.position.sub(kick);
  updateBars();
  updateSkillBar();
  updateAim();
  audio.setGloom(world.gloomAt(follow.z));   // música mais sombria rumo ao castelo
}

// menu inicial: a câmera balança devagar em volta da vila (vai e volta, sem sair do cenário);
// a partida reposiciona a câmera em placeParty
const MENU_ORBIT_AXIS = new THREE.Vector3(0, 1, 0);
function orbitMenu(real) {
  menuOrbit.t += real;
  const angle = Math.sin(menuOrbit.t * 0.12) * 0.32;
  tmp.subVectors(camera.position, controls.target).applyAxisAngle(MENU_ORBIT_AXIS, angle - menuOrbit.angle);
  camera.position.copy(controls.target).add(tmp);
  menuOrbit.angle = angle;
}

// enquadra o grupo e a briga por perto (Campanha e Jornada)
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
  offset.setLength(Math.min(controls.maxDistance, Math.max(cam.userDist * cam.zoom, cam.fit)));
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
// no toque não há Esc nem botão direito: um botão visível cancela a mira
const aimCancel = document.createElement('button');
aimCancel.id = 'aimCancel';
aimCancel.type = 'button';
aimCancel.textContent = 'Cancelar mira';
aimCancel.hidden = true;
aimCancel.onclick = () => { cancelAim(); audio.play('click'); };
document.body.appendChild(aimCancel);

function cancelAim() {
  if (aiming) controls.enabled = aiming.controlsEnabled;
  aiming = null;
  aimGroup.visible = false;
  aimHint.hidden = true;
  aimCancel.hidden = true;
  renderer.domElement.style.cursor = '';
}

function beginAim(hero) {
  cancelAim();
  hero.wantSkill = 0;
  hero.manualTarget = null;
  const spec = aimSpec(hero);
  const modeHint = spec.mode === 'enemy' ? 'Clique em um inimigo' : 'Clique no chão para mirar';
  const baseMessage = `${hero.cfg.ability} · ${modeHint} · Alcance ${spec.range.toLocaleString('pt-BR')} m · Esc / botão direito cancela`;
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
  aimCancel.hidden = false;
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
      const modeHint = aiming.spec.mode === 'enemy' ? 'Clique em um inimigo' : 'Clique no chão para mirar';
      aiming.baseMessage = `${h.cfg.ability} · ${modeHint} · Alcance ${aiming.spec.range.toLocaleString('pt-BR')} m · Esc / botão direito cancela`;
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
      // Procura a primeira interseção com a altura lógica do terreno, inclusive platôs.
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
    aimHint.textContent = `${aiming.baseMessage}${hintState === 'invalid' ? ' · Fora do alcance ou alvo inválido' : ''}`;
  }
}

renderer.domElement.addEventListener('pointermove', (e) => {
  if (aiming) { aiming.pointerX = e.clientX; aiming.pointerY = e.clientY; }
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!aiming || e.button !== 2) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  cancelAim();
}, true);
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

// clicar num herói abre o cartão dele (clique sem arrastar, para não brigar com o giro da câmera)
const selectRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 6), new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
selectRing.rotation.x = -Math.PI / 2;
selectRing.visible = false;
scene.add(selectRing);
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
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
  let best = null, bestD = 50;   // herói mais perto do clique na tela, até 50 px
  for (const h of heroes()) {
    tmp.copy(h.pos).setY(h.pos.y + 1).project(camera);
    const d = Math.hypot((tmp.x * 0.5 + 0.5) * innerWidth - e.clientX, (-tmp.y * 0.5 + 0.5) * innerHeight - e.clientY);
    if (d < bestD) { bestD = d; best = h; }
  }
  if (best) openHeroPanel(best, XP_LEVELS);
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

// modo Reino (kingdom.js): recebe as peças do jogo sem importar o main.js, como o monsters.js
linkKingdom({ Unit, Hero, Skeleton, units, scene, camera, controls, renderer, sun, follow, assets, HEROES, VARIANTS, variantOpen, militiaWeapon,
  fireBolt, ring, poof, popText, showBanner, FX, audio, pickMonster, skeletonsAlive, skillSetFor, startGame, withBattleAssets,
  skillGlyph: (id, slot) => SKILL_GLYPHS[id]?.[slot] || ['✦', '⚔', '☼'][slot],
  pickOpen: () => pick.open,
  replaceWorld(next) { world.dispose?.(); world = next; },
  restoreWorld() { world.dispose?.(); world = createWorld(scene, ROAD, PHASES, 11); },
  get game() { return game; }, get difficulty() { return difficulty; } });

// ?bench=1: medição de desempenho (bench.js) — monta uma jornada com 4 heróis sem passar pelos menus
const benchApi = () => ({
  renderer, scene, game, units, heroes, world, VARIANTS, frame, spawnSkeleton, withBattleAssets,
  isLowQuality: () => lowQuality,
  getShadowMapSize: () => sun.shadow.mapSize.x,
  setShadowMapSize(size) {
    sun.shadow.mapSize.set(size, size);
    sun.shadow.needsUpdate = true;
  },
  setupJourney(phase) {
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
  if (new URLSearchParams(location.search).has('bench')) (await import('./bench.js')).runBench(benchApi()).catch((e) => console.error('bench:', e));
} catch (error) {
  console.error('Falha ao iniciar o jogo:', error);
  $('overlayText').textContent = 'Não foi possível carregar o jogo. Verifique sua conexão e tente novamente.';
  $('overlay').classList.remove('hidden');
  $('overlayBtn').textContent = 'Tentar novamente';
  $('overlayBtn').hidden = false;
  $('overlayBtn').onclick = () => location.reload();
}
