// Aparência de cada variante: cores da roupa e acessórios que a diferenciam das outras da mesma classe.
// Usa o mesmo formato de receita de characters.js (paint, extras, add) e é aplicada com applyLook.

// pinta corpo, braços e pernas de um modelo de uma vez
function outfit(model, body, legs = body, amount = 0.7) {
  const p = (tint) => ({ tint, amount });
  return {
    [`${model}_Body`]: p(body), [`${model}_ArmLeft`]: p(body), [`${model}_ArmRight`]: p(body),
    [`${model}_LegLeft`]: p(legs), [`${model}_LegRight`]: p(legs),
  };
}

// ajusta o volume por classe nas malhas skinned, sem mexer em ossos usados pelas animações
function silhouette(model, { torso = 1, arms = 1, legs = 1, height = 1, depth = 1 } = {}) {
  return {
    [`${model}_Body`]: [torso, height, depth],
    [`${model}_ArmLeft`]: [arms, height, depth], [`${model}_ArmRight`]: [arms, height, depth],
    [`${model}_LegLeft`]: [legs, height, depth], [`${model}_LegRight`]: [legs, height, depth],
  };
}

export const LOOKS = {
  // ---------- Cavaleiro ----------
  // cada variante troca peças com outros modelos (chapéu, elmo, capa) para ter silhueta própria
  paladin: {   // capa branca longa, pena alta e ombreiras douradas
    shape: silhouette('Knight', { torso: 1.04, arms: 1.02, legs: 1.02, depth: 1.04 }),
    hide: ['Knight_Cape'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }],
    paint: { ...outfit('Knight', '#f4ecd8', '#e8dcc0', 0.55), Mage_Cape: { tint: '#fff8e8', amount: 0.85 }, Knight_Helmet: { tint: '#fff6e0', amount: 0.45 } },
    extras: [{ type: 'plume', bone: 'head', color: 0xffffff, tall: true, y: 1.25 }, { type: 'pauldrons', bone: 'chest', color: 0xf2c94c }, { type: 'emblem', bone: 'chest' }],
  },
  guardian: {   // capa de pele e ombreiras grandes
    shape: silhouette('Knight', { torso: 1.13, arms: 1.1, legs: 1.04, depth: 1.12 }),
    hide: ['Knight_Cape', 'Knight_Helmet'],
    add: [{ from: 'Barbarian', part: 'Barbarian_Cape' }],
    paint: { ...outfit('Knight', '#6f8fb8', '#4a6488'), Barbarian_Cape: { tint: '#3e5a8a', amount: 0.7 }, Knight_Helmet: { tint: '#8fa8c8', amount: 0.5 } },
    extras: [{ type: 'pauldrons', bone: 'chest', color: 0xb8cce8, size: 1.35 }, { type: 'greathelm', bone: 'head', color: 0x7890ad, trim: 0xc8d9ec }, { type: 'plume', bone: 'head', color: 0x3a6ad8, y: 1.22 }],
  },
  champion: {   // sem elmo: rosto à mostra, gorro de pele e capa vermelha
    shape: silhouette('Knight', { torso: 1.08, arms: 1.05, legs: 1.04, depth: 1.06 }),
    hide: ['Knight_Helmet'],
    add: [{ from: 'Barbarian', part: 'Barbarian_Hat', scale: 0.92 }],
    paint: { ...outfit('Knight', '#d98a4a', '#a8582e'), Knight_Cape: { tint: '#d13b3b', amount: 0.85 }, Barbarian_Hat: { tint: '#8a3a22', amount: 0.5 } },
  },
  // ---------- Bárbaro ----------
  berserker: {   // cabeça raspada com chifres e sem capa
    shape: silhouette('Barbarian', { torso: 1.08, arms: 1.1, legs: 1.06, depth: 1.08 }),
    hide: ['Barbarian_Hat', 'Barbarian_Cape'],
    paint: { ...outfit('Barbarian', '#b83a3a', '#5a2a2a', 0.6) },
    extras: [{ type: 'horns', bone: 'head' }, { type: 'necklace', bone: 'head' }],
  },
  crusher: {   // elmo de ferro e ombreiras com espinhos
    shape: silhouette('Barbarian', { torso: 1.15, arms: 1.12, legs: 1.1, depth: 1.14 }),
    hide: ['Barbarian_Hat'],
    add: [{ from: 'Knight', part: 'Knight_Helmet' }],
    paint: { ...outfit('Barbarian', '#8a7a5a', '#5a4a3a', 0.6), Knight_Helmet: { tint: '#6e6a66', amount: 0.55 }, Barbarian_Cape: { tint: '#6a5a4a', amount: 0.8 } },
    extras: [{ type: 'pauldrons', bone: 'chest', color: 0x8a8578, spikes: true, size: 1.2 }],
  },
  viking: {   // capa longa e ombreiras douradas
    shape: silhouette('Barbarian', { torso: 1.1, arms: 1.07, legs: 1.05, depth: 1.08 }),
    hide: ['Barbarian_Cape'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }],
    paint: { ...outfit('Barbarian', '#4a9e8a', '#3a5a4a', 0.55), Barbarian_Hat: { tint: '#c8a060', amount: 0.6 }, Mage_Cape: { tint: '#2e6e6a', amount: 0.85 } },
    extras: [{ type: 'pauldrons', bone: 'chest', color: 0xe8c060 }],
  },
  // ---------- Mago ----------
  pyro: {
    shape: silhouette('Mage', { torso: 0.95, arms: 0.94, legs: 0.97, height: 1.03, depth: 0.95 }),
    paint: { ...outfit('Mage', '#e8642e', '#8a3a1e'), Mage_Hat: { tint: '#d13b2b', amount: 0.85 }, Mage_Cape: { tint: '#ffb03a', amount: 0.8 } },
    // chamas na ponta do chapéu (inclinado para trás) e as duas mãos pegando fogo
    extras: [{ type: 'flames', bone: 'head', y: 1.42, z: -0.3 }, { type: 'handFire', bone: 'handslotl' }, { type: 'handFire', bone: 'handslotr' }],
  },
  arcane: {   // sem chapéu, capa longa e estrelas orbitando
    shape: silhouette('Mage', { torso: 0.89, arms: 0.91, legs: 0.95, height: 1.09, depth: 0.89 }),
    hide: ['Mage_Hat', 'Mage_Cape'],
    add: [{ from: 'Knight', part: 'Knight_Cape' }],
    paint: { ...outfit('Mage', '#6a4fc4', '#3a2a7a'), Knight_Cape: { tint: '#8a6ae0', amount: 0.85 } },
    extras: [{ type: 'stars', bone: 'head', color: 0xffe066 }, { type: 'runeRing', bone: 'root', color: 0xb07aff }],
  },
  cryo: {
    shape: silhouette('Mage', { torso: 1.02, arms: 1.04, legs: 1.01, height: 1.04, depth: 1.03 }),
    hide: ['Mage_Hat'],
    paint: { ...outfit('Mage', '#e8f6ff', '#8ec8e8', 0.65), Mage_Cape: { tint: '#ffffff', amount: 0.8 } },
    extras: [
      { type: 'iceCrown', bone: 'head', radius: 0.5, y: 0.84, n: 9, height: 1.7 },
      { type: 'iceMantle', bone: 'chest' },
      { type: 'iceShard', bone: 'handslotl' },
    ],
  },
  // ---------- Ladino ----------
  assassin: {   // duelista sem capuz: rosto à mostra, cachecol vermelho e capa escura
    shape: silhouette('Rogue', { torso: 0.98, arms: 0.96, legs: 1, height: 1.02, depth: 0.97 }),
    hide: ['Rogue_Cape'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }],
    paint: { ...outfit('Rogue', '#3a2e4a', '#2a2238', 0.75), Mage_Cape: { tint: '#2a2238', amount: 0.85 } },
    extras: [{ type: 'scarf', bone: 'head', color: 0xd13b4f }],
  },
  crossbow: {   // chapéu pontudo de caçador com pena (Robin Hood) e aljava
    shape: silhouette('Rogue', { torso: 1.03, arms: 1.02, legs: 1, height: 1.04, depth: 1.03 }),
    add: [
      { from: 'Skeleton_Quiver', part: 'Skeleton_Quiver', bone: 'chest', pos: [0.15, 0.25, -0.35], rot: [0.2, 0, -0.5], scale: 0.9 },
      { from: 'Mage', part: 'Mage_Hat', scale: 0.72, pos: [0, -0.08, 0] },
    ],
    paint: { ...outfit('Rogue', '#7a9a4a', '#5a4a2e', 0.5), Rogue_Cape: { tint: '#4a7a3a', amount: 0.8 }, Mage_Hat: { tint: '#4f8a3a', amount: 0.85 } },
    extras: [{ type: 'feather', bone: 'head', color: 0xff3d3d }],
  },
  ninja: {
    shape: silhouette('Rogue', { torso: 0.88, arms: 0.91, legs: 0.96, height: 1.08, depth: 0.89 }),
    paint: { ...outfit('Rogue', '#2e3a6a', '#1e2648', 0.75), Rogue_Cape: { tint: '#3a4a8a', amount: 0.8 } },
    extras: [{ type: 'scarf', bone: 'head', color: 0xffffff }, { type: 'mask', bone: 'head', color: 0x1e2648 }],
  },
  duelist: {   // espadachim de casaca bordô, ombreiras de aço e duas espadas curtas (uma em cada mão)
    shape: silhouette('Rogue', { torso: 0.95, arms: 0.97, legs: 1.02, height: 1.05, depth: 0.95 }),
    hide: ['Rogue_Cape'],
    add: [
      { from: 'Knight', part: 'Knight_Cape', scale: 0.85 },
      { from: 'Knight', part: '1H_Sword', bone: 'handslotr', pos: [0, 0.03, 0], rot: [0, Math.PI, 0], scale: 0.7 },
      { from: 'Knight', part: '1H_Sword_Offhand', bone: 'handslotl', pos: [0, 0.02, 0], scale: 0.7 },
    ],
    paint: { ...outfit('Rogue', '#c0304a', '#4a4452', 0.9), Knight_Cape: { tint: '#8a1c30', amount: 0.9 } },
    extras: [{ type: 'pauldrons', bone: 'chest', color: 0xc9d4e2, size: 0.8 }, { type: 'feather', bone: 'head', color: 0xdfe6ee, y: 0.95 }],
  },
  // ---------- heróis de campanha ----------
  king: {
    extras: [
      { type: 'pauldrons', bone: 'chest', color: 0xe8b93e, size: 1.12 },
      { type: 'plume', bone: 'head', color: 0xb93a42, tall: true, y: 1.2 },
    ],
  },
  iceviking: {
    extras: [
      { type: 'furMantle', bone: 'chest', color: 0xd9eafa },
      { type: 'iceCrown', bone: 'head', color: 0xc8f4ff, radius: 0.42, y: 0.98, n: 7 },
    ],
  },
  necro: {
    extras: [
      { type: 'pauldrons', bone: 'chest', color: 0x59436f, spikes: true, size: 0.92 },
      { type: 'runeRing', bone: 'root', color: 0x72db8b },
    ],
  },
  chronist: {
    extras: [{ type: 'runeRing', bone: 'root', color: 0x75b8ff }],
  },
};

// para a vitrine: modelo e armas visíveis de cada variante (o jogo usa a lista de VARIANTS em main.js)
export const LOOK_PREVIEW = [
  { id: 'paladin', name: 'Paladino', model: 'Knight', use: ['1H_Sword', 'Round_Shield'] },
  { id: 'guardian', name: 'Guardião', model: 'Knight', use: ['1H_Sword', 'Rectangle_Shield'] },
  { id: 'champion', name: 'Campeão', model: 'Knight', use: ['2H_Sword'] },
  { id: 'berserker', name: 'Berserker', model: 'Barbarian', use: ['1H_Axe', '1H_Axe_Offhand'] },
  { id: 'crusher', name: 'Esmagador', model: 'Barbarian', use: ['2H_Axe'] },
  { id: 'viking', name: 'Viking', model: 'Barbarian', use: ['1H_Axe', 'Barbarian_Round_Shield'] },
  { id: 'pyro', name: 'Piromante', model: 'Mage', use: ['2H_Staff'] },
  { id: 'arcane', name: 'Arcano', model: 'Mage', use: ['Spellbook_open', '1H_Wand'] },
  { id: 'cryo', name: 'Criomante', model: 'Mage', use: ['1H_Wand'] },
  { id: 'assassin', name: 'Assassino', model: 'Rogue', use: ['Knife', 'Knife_Offhand'] },
  { id: 'crossbow', name: 'Besteiro', model: 'Rogue', use: ['2H_Crossbow'] },
  { id: 'ninja', name: 'Ninja', model: 'Rogue_Hooded', use: ['Knife', 'Throwable'] },
  { id: 'duelist', name: 'Duelista', model: 'Rogue', use: [] },
];
export const WEAPONS = {
  Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'],
  Barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
  Mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
  Rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
};
WEAPONS.Rogue_Hooded = WEAPONS.Rogue;
