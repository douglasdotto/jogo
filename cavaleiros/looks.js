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

export const LOOKS = {
  // ---------- Cavaleiro ----------
  paladin: {
    paint: { ...outfit('Knight', '#f4ecd8', '#e8dcc0', 0.55), Knight_Cape: { tint: '#ffd75e', amount: 0.85 }, Knight_Helmet: { tint: '#fff6e0', amount: 0.45 } },
    extras: [{ type: 'plume', bone: 'head', color: 0xffffff, y: 1.25 }],
  },
  guardian: {
    paint: { ...outfit('Knight', '#6f8fb8', '#4a6488'), Knight_Cape: { tint: '#2e4a7a', amount: 0.85 }, Knight_Helmet: { tint: '#8fa8c8', amount: 0.5 } },
    extras: [{ type: 'pauldrons', bone: 'chest', color: 0xb8cce8 }],
  },
  champion: {
    paint: { ...outfit('Knight', '#d98a4a', '#a8582e'), Knight_Cape: { tint: '#d13b3b', amount: 0.85 }, Knight_Helmet: { tint: '#e8a060', amount: 0.5 } },
    extras: [{ type: 'plume', bone: 'head', color: 0xe83b3b, tall: true, y: 1.2 }],
  },
  // ---------- Bárbaro ----------
  berserker: {
    paint: { ...outfit('Barbarian', '#b83a3a', '#5a2a2a', 0.6), Barbarian_Hat: { tint: '#3a2a2a', amount: 0.7 }, Barbarian_Cape: { tint: '#8a1f1f', amount: 0.8 } },
    extras: [{ type: 'horns', bone: 'head' }],
  },
  crusher: {
    paint: { ...outfit('Barbarian', '#8a7a5a', '#5a4a3a', 0.6), Barbarian_Hat: { tint: '#7a7a7a', amount: 0.6 }, Barbarian_Cape: { tint: '#6a5a4a', amount: 0.8 } },
    extras: [{ type: 'pauldrons', bone: 'chest', color: 0x8a8578, spikes: true }],
  },
  viking: {
    paint: { ...outfit('Barbarian', '#4a9e8a', '#3a5a4a', 0.55), Barbarian_Hat: { tint: '#c8a060', amount: 0.6 }, Barbarian_Cape: { tint: '#2e6e6a', amount: 0.8 } },
    extras: [{ type: 'pauldrons', bone: 'chest', color: 0xe8c060 }],
  },
  // ---------- Mago ----------
  pyro: {
    paint: { ...outfit('Mage', '#e8642e', '#8a3a1e'), Mage_Hat: { tint: '#d13b2b', amount: 0.85 }, Mage_Cape: { tint: '#ffb03a', amount: 0.8 } },
    extras: [{ type: 'flames', bone: 'head', y: 1.2 }, { type: 'orb', bone: 'handslotl', color: 0xffa040, glow: 0xff5a1a }],
  },
  arcane: {
    paint: { ...outfit('Mage', '#6a4fc4', '#3a2a7a'), Mage_Hat: { tint: '#4a3aa8', amount: 0.85 }, Mage_Cape: { tint: '#c8a8ff', amount: 0.8 } },
    extras: [{ type: 'stars', bone: 'head', color: 0xffe066 }],
  },
  cryo: {
    paint: { ...outfit('Mage', '#e8f6ff', '#8ec8e8', 0.65), Mage_Hat: { tint: '#a8e4ff', amount: 0.85 }, Mage_Cape: { tint: '#ffffff', amount: 0.8 } },
    extras: [{ type: 'iceCrown', bone: 'head', radius: 0.95, y: 0.78, n: 8 }, { type: 'orb', bone: 'handslotl', color: 0xc8f4ff, glow: 0x3aa8d8 }],
  },
  // ---------- Ladino ----------
  assassin: {
    paint: { ...outfit('Rogue', '#3a2e4a', '#2a2238', 0.75), Rogue_Cape: { tint: '#5a3a7a', amount: 0.8 } },
    extras: [{ type: 'scarf', bone: 'head', color: 0xd13b4f }],
  },
  crossbow: {
    paint: { ...outfit('Rogue', '#7a9a4a', '#5a4a2e', 0.5), Rogue_Cape: { tint: '#4a7a3a', amount: 0.8 } },
    add: [{ from: 'Skeleton_Quiver', part: 'Skeleton_Quiver', bone: 'chest', pos: [0.15, 0.25, -0.35], rot: [0.2, 0, -0.5], scale: 0.9 }],
    extras: [{ type: 'feather', bone: 'head', color: 0xff8a3d }],
  },
  ninja: {
    paint: { ...outfit('Rogue', '#2e3a6a', '#1e2648', 0.75), Rogue_Cape: { tint: '#3a4a8a', amount: 0.8 } },
    extras: [{ type: 'scarf', bone: 'head', color: 0xffffff }],
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
];
export const WEAPONS = {
  Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'],
  Barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
  Mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
  Rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
};
WEAPONS.Rogue_Hooded = WEAPONS.Rogue;
