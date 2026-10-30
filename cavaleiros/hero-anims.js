// Animações dos heróis: pacote KayKit Character Animations 1.1 (Rig_Medium, CC0), aplicado por nome de osso.
// Os modelos de herói (Adventurers 1.0 sem os clipes embutidos e o Ranger 2.0) usam o mesmo esqueleto do
// pacote, então um único conjunto de clipes serve a todos. Os nomes antigos do 1.0 continuam valendo como
// apelidos (LEGACY_CLIPS), assim SKILL_ANIMS, VARIANTS, Reino e monstros não precisam mudar.
// Sem import: os testes leem este arquivo direto (como looks.js).

const ANIM_DIR = 'kaykit/animations/Animations/gltf/Rig_Medium/Rig_Medium_';
// só os arquivos que os heróis usam (Special = esqueletos, Tools = ofícios ficam de fora)
const MEDIUM_ANIM_FILES = ['General', 'MovementBasic', 'MovementAdvanced', 'CombatMelee', 'CombatRanged', 'Simulation']
  .map((name) => `${ANIM_DIR}${name}.glb`);
// gigante (Brutamontes): andar, guarda e socos do Rig_Large, com peso de verdade. Arquivos enxutos (só esses clipes,
// sem o manequim) feitos com tools/strip-glb-anims.cjs; os dois rigs têm a mesma orientação de repouso nos ossos,
// então só as rotações (e a altura do quadril, na escala do Rig_Medium) passam para o modelo de herói
const LARGE_DIR = 'kaykit/animations/Animations/gltf/Rig_Large/Rig_Large_Brute_';
const LARGE_ANIM_FILES = ['Combat', 'Move'].map((name) => `${LARGE_DIR}${name}.glb`);
export const LARGE_CLIPS = {
  Brute_Idle: 'Melee_Unarmed_Idle', Brute_Walk: 'Walking_A', Brute_Run: 'Running_A',
  Brute_Punch: 'Melee_Unarmed_Punch', Brute_Smash: 'Melee_Unarmed_Smash', Brute_Kick: 'Melee_Unarmed_Kick',
};
const LARGE_HIPS = 0.4057 / 1.041;   // altura do quadril em repouso: Rig_Medium / Rig_Large
export const HERO_ANIM_FILES = [...MEDIUM_ANIM_FILES, ...LARGE_ANIM_FILES];

// modelos que recebem os clipes; o Ranger vem do Adventurers 2.0 (o 1.0 não tinha arqueiro)
export const HERO_MODELS = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded', 'Ranger'];
export const HERO_MODEL_FILES = { Ranger: 'kaykit/adventurers/Characters/gltf/Ranger.glb' };
export const heroModelFile = (model) => HERO_MODEL_FILES[model] || `${model}.glb`;

// armas prontas (Fantasy Weapons Bits, CC0) usadas nas aparências: add { from: 'kaykit/weapons/Assets/gltf/<nome>', part: '<nome>' }
export const WEAPON_DIR = 'kaykit/weapons/Assets/gltf/';
export const HERO_PROP_FILES = ['bow_A_withString'].map((name) => `${WEAPON_DIR}${name}.gltf`);

// nome antigo (Adventurers 1.0) -> nome no pacote 1.1; o que não aparece aqui manteve o nome
// (Death_A/B, Hit_A/B, Dodge_*, Jump_*, Running_*, Walking_*, Throw, Use_Item, Interact, PickUp, Lie_*, Sit_*)
export const LEGACY_CLIPS = {
  Idle: 'Idle_A',
  Cheer: 'Cheering',
  Unarmed_Idle: 'Melee_Unarmed_Idle',
  Unarmed_Melee_Attack_Punch_A: 'Melee_Unarmed_Attack_Punch_A',
  Unarmed_Melee_Attack_Punch_B: 'Melee_Dualwield_Attack_Stab',   // o 1.1 só tem um soco: o direto com as duas mãos faz o segundo golpe
  Unarmed_Melee_Attack_Kick: 'Melee_Unarmed_Attack_Kick',
  '1H_Melee_Attack_Chop': 'Melee_1H_Attack_Chop',
  '1H_Melee_Attack_Jump_Chop': 'Melee_1H_Attack_Jump_Chop',
  '1H_Melee_Attack_Slice_Diagonal': 'Melee_1H_Attack_Slice_Diagonal',
  '1H_Melee_Attack_Slice_Horizontal': 'Melee_1H_Attack_Slice_Horizontal',
  '1H_Melee_Attack_Stab': 'Melee_1H_Attack_Stab',
  '2H_Melee_Attack_Chop': 'Melee_2H_Attack_Chop',
  '2H_Melee_Attack_Slice': 'Melee_2H_Attack_Slice',
  '2H_Melee_Attack_Spin': 'Melee_2H_Attack_Spin',
  '2H_Melee_Attack_Spinning': 'Melee_2H_Attack_Spinning',
  '2H_Melee_Attack_Stab': 'Melee_2H_Attack_Stab',
  '2H_Melee_Idle': 'Melee_2H_Idle',
  Dualwield_Melee_Attack_Chop: 'Melee_Dualwield_Attack_Chop',
  Dualwield_Melee_Attack_Slice: 'Melee_Dualwield_Attack_Slice',
  Dualwield_Melee_Attack_Stab: 'Melee_Dualwield_Attack_Stab',
  Block: 'Melee_Block',
  Blocking: 'Melee_Blocking',
  Block_Attack: 'Melee_Block_Attack',
  Block_Hit: 'Melee_Block_Hit',
  '1H_Ranged_Aiming': 'Ranged_1H_Aiming',
  '1H_Ranged_Reload': 'Ranged_1H_Reload',
  '1H_Ranged_Shoot': 'Ranged_1H_Shoot',
  '1H_Ranged_Shooting': 'Ranged_1H_Shooting',
  '2H_Ranged_Aiming': 'Ranged_2H_Aiming',
  '2H_Ranged_Reload': 'Ranged_2H_Reload',
  '2H_Ranged_Shoot': 'Ranged_2H_Shoot',
  '2H_Ranged_Shooting': 'Ranged_2H_Shooting',
  Spellcast_Raise: 'Ranged_Magic_Raise',
  Spellcast_Shoot: 'Ranged_Magic_Shoot',
  Spellcasting: 'Ranged_Magic_Spellcasting',
  Spellcast_Long: 'Ranged_Magic_Spellcasting_Long',
  Spellcast_Summon: 'Ranged_Magic_Summon',
};

// variações por momento: escolhidas ao acaso para o mesmo gesto não se repetir sempre igual
export const HERO_HITS = ['Hit_A', 'Hit_B'];
export const HERO_DEATHS = ['Death_A', 'Death_B'];
export const HERO_DODGES = ['Dodge_Left', 'Dodge_Right', 'Dodge_Backward'];

// junta os clipes dos arquivos carregados (assets[caminho sem extensão]) e acrescenta os apelidos antigos;
// os apelidos dividem as mesmas trilhas (sem copiar dados)
let heroClipCache = null;
export function heroClips(assets) {
  if (heroClipCache) return heroClipCache;
  const byName = new Map();
  for (const file of MEDIUM_ANIM_FILES) {
    for (const clip of assets[file.replace(/\.glb$/, '')]?.animations || []) if (!byName.has(clip.name)) byName.set(clip.name, clip);
  }
  for (const [old, now] of Object.entries(LEGACY_CLIPS)) {
    const clip = byName.get(now);
    if (clip && !byName.has(old)) byName.set(old, new clip.constructor(old, clip.duration, clip.tracks));
  }
  const large = LARGE_ANIM_FILES.flatMap((file) => assets[file.replace(/\.glb$/, '')]?.animations || []);
  for (const [name, src] of Object.entries(LARGE_CLIPS)) {
    const clip = large.find((c) => c.name === src);
    if (!clip) continue;
    const tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'hips.position')
      .map((t) => (t.name.endsWith('.quaternion') ? t : new t.constructor(t.name, t.times, t.values.map((v) => v * LARGE_HIPS))));
    byName.set(name, new clip.constructor(name, clip.duration, tracks));
  }
  heroClipCache = [...byName.values()];
  return heroClipCache;
}

// páginas de vitrine (variantes, bonecos, retratos): carrega modelos + clipes e liga tudo
export async function loadHeroAssets(loader, assets, models) {
  const files = [...new Set([...models.map(heroModelFile), ...HERO_ANIM_FILES, ...HERO_PROP_FILES])];
  await Promise.all(files.map(async (file) => (assets[file.replace(/\.(glb|gltf)$/, '')] = await loader.loadAsync(`assets/${file}`))));
  attachHeroAnimations(assets);
}

// liga os modelos de herói ao conjunto de clipes; o Ranger também fica acessível como assets.Ranger
export function attachHeroAnimations(assets) {
  const clips = heroClips(assets);
  for (const model of HERO_MODELS) {
    const key = heroModelFile(model).replace(/\.glb$/, '');
    if (assets[key] && !assets[model]) assets[model] = assets[key];
    if (assets[model]) assets[model].animations = clips;
  }
  return clips;
}
