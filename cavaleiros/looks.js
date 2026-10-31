// Aparência de cada variante: cores da roupa e acessórios que a diferenciam das outras da mesma classe.
// Usa o mesmo formato de receita de characters.js (paint, extras, add) e é aplicada com applyLook.
// Cada herói tem paleta própria (roupa + rosto: pele e cabelo/barba) além da silhueta; os olhos ficam os
// originais do KayKit e nada de peça solta no rosto (barba e bigode presos ao queixo e à boca, sim).
// Os retratos usam os mesmos modelos.

// pinta corpo, braços e pernas de um modelo de uma vez
function outfit(model, body, legs = body, amount = 0.7) {
  const p = (tint) => ({ tint, amount });
  return {
    [`${model}_Body`]: p(body), [`${model}_ArmLeft`]: p(body), [`${model}_ArmRight`]: p(body),
    [`${model}_LegLeft`]: p(legs), [`${model}_LegRight`]: p(legs),
  };
}

// Ladino: o atlas separa pano (0,1), gola e acabamento (1,1), couro (5,0 e 6,0; luvas 5,2), fivela (3,0), calça (7,1)
// e botas (3,2); pintar cada casa dá roupa de várias cores em vez de um tom só por cima do verde original
// (mesma função de characters.js: os dois arquivos são lidos à parte pelos testes)
function rogueOutfit({ cloth, trim = cloth, leather, metal, pants = leather, boots = leather, sleeves = cloth, gloves = leather }, amount = 0.92) {
  const p = (tint, cells) => ({ tint, amount, base: 0.5, cells });
  const arm = p(sleeves, { '1,1': trim, '5,0': leather, '5,2': gloves }), leg = p(pants, { '3,2': boots });
  return {
    Rogue_Body: p(cloth, { '1,1': trim, '5,0': leather, '6,0': leather, '7,1': pants, ...(metal && { '3,0': metal }) }),
    Rogue_ArmLeft: arm, Rogue_ArmRight: arm, Rogue_LegLeft: leg, Rogue_LegRight: leg,
  };
}

// Ranger (2.0): pano azul do atlas (0,1 e 1,2), acabamento claro (2,1 e 0,2), couro (7,0 / 3,2 / 7,2) e capa (1,1)
function rangerOutfit({ cloth, trim, leather, cape = cloth, sleeves = cloth, pants = leather }, amount = 0.9) {
  const p = (tint) => ({ tint, amount, base: 0.5, cells: { '0,1': tint, '1,2': tint, '2,1': trim, '0,2': trim, '7,0': leather, '3,2': leather, '7,2': leather } });
  return { Ranger_Body: p(cloth), Ranger_ArmLeft: p(sleeves), Ranger_ArmRight: p(sleeves), Ranger_LegLeft: p(pants), Ranger_LegRight: p(pants), Ranger_Cape: { tint: cape, amount: 0.85 } };
}

// cores do rosto: { skin, hair (cabelo e barba do atlas), hood }; os olhos não são pintados
function face(model, colors, head = `${model}_Head`) {
  return { [head]: { face: colors } };
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
  paladin: {   // santo guerreiro: marfim e ouro, capa branca longa, pena alta
    shape: silhouette('Knight', { torso: 1.04, arms: 1.02, legs: 1.02, depth: 1.04 }),
    hide: ['Knight_Cape'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }],
    paint: {
      ...outfit('Knight', '#f4ecd8', '#e8dcc0', 0.55), ...face('Knight', { skin: '#f6d2b0', hair: '#f2d27a' }),
      Mage_Cape: { tint: '#fff8e8', amount: 0.85 }, Knight_Helmet: { tint: '#fff6e0', amount: 0.45 },
      '1H_Sword': { tint: '#fff0b8', amount: 0.4 }, Round_Shield: { tint: '#f2d27a', amount: 0.55 },
    },
    extras: [
      { type: 'plume', bone: 'head', color: 0xffffff, tall: true, y: 1.25 },
      { type: 'pauldrons', bone: 'chest', color: 0xf2c94c, trim: 0xfff6dc },
      { type: 'emblem', bone: 'chest' },
    ],
  },
  guardian: {   // muralha: elmo fechado com viseira, crista azul, ombreiras largas e escudo torre maior
    shape: silhouette('Knight', { torso: 1.13, arms: 1.1, legs: 1.04, depth: 1.12 }),
    hide: ['Knight_Cape', 'Knight_Helmet'],
    add: [{ from: 'Barbarian', part: 'Barbarian_Cape' }],
    resize: { Rectangle_Shield: 1.3 },
    paint: {
      ...outfit('Knight', '#6f8fb8', '#4a6488'), ...face('Knight', { skin: '#e0b494', hair: '#3a2a1a' }),
      Barbarian_Cape: { tint: '#2e4a7a', amount: 0.75 }, Rectangle_Shield: { tint: '#3e5a8a', amount: 0.6 },
    },
    extras: [
      { type: 'greathelm', bone: 'head', color: 0x7890ad, trim: 0xc8d9ec },
      { type: 'plume', bone: 'head', color: 0x3a6ad8, tall: true, y: 1.08 },
      { type: 'pauldrons', bone: 'chest', color: 0xb8cce8, trim: 0x3e5a8a, size: 1.35 },
    ],
  },
  champion: {   // sem elmo: barba cheia, gorro de pele, capa vermelha, espadão dourado
    shape: silhouette('Knight', { torso: 1.08, arms: 1.05, legs: 1.04, depth: 1.06 }),
    hide: ['Knight_Helmet'],
    add: [{ from: 'Barbarian', part: 'Barbarian_Hat', scale: 0.92 }],
    paint: {
      ...outfit('Knight', '#d98a4a', '#a8582e'), ...face('Knight', { skin: '#d49a6a', hair: '#5a2a14' }),
      Knight_Cape: { tint: '#d13b3b', amount: 0.85 }, Barbarian_Hat: { tint: '#8a3a22', amount: 0.5 },
      '2H_Sword': { tint: '#ffd36a', amount: 0.45 },
    },
    extras: [
      { type: 'beard', bone: 'head', color: 0x5a2a14 },
    ],
  },
  // ---------- Bárbaro ----------
  berserker: {   // moicano ruivo, barba ruiva
    shape: silhouette('Barbarian', { torso: 1.08, arms: 1.1, legs: 1.06, depth: 1.08 }),
    hide: ['Barbarian_Hat', 'Barbarian_Cape'],
    paint: {
      ...outfit('Barbarian', '#b83a3a', '#5a2a2a', 0.6), ...face('Barbarian', { skin: '#f5d0b5', hair: '#d8481a' }),
      '1H_Axe': { tint: '#d89a8a', amount: 0.4 }, '1H_Axe_Offhand': { tint: '#d89a8a', amount: 0.4 },
    },
    extras: [
      { type: 'mohawk', bone: 'head', color: 0xd8481a }, { type: 'necklace', bone: 'head' },
    ],
  },
  crusher: {   // elmo de ferro, barba negra e ombreiras com espinhos
    shape: silhouette('Barbarian', { torso: 1.15, arms: 1.12, legs: 1.1, depth: 1.14 }),
    hide: ['Barbarian_Hat'],
    add: [{ from: 'Knight', part: 'Knight_Helmet' }],
    paint: {
      ...outfit('Barbarian', '#8a7a5a', '#5a4a3a', 0.6), ...face('Barbarian', { skin: '#a86a48', hair: '#2a2a2a' }),
      Knight_Helmet: { tint: '#6e6a66', amount: 0.55 }, Barbarian_Cape: { tint: '#6a5a4a', amount: 0.8 },
      '2H_Axe': { tint: '#7a7a80', amount: 0.5 },
    },
    extras: [
      { type: 'pauldrons', bone: 'chest', color: 0x8a8578, spikes: true, size: 1.2 },
    ],
  },
  viking: {   // capa longa, ombreiras douradas, barba loira trançada com anéis
    shape: silhouette('Barbarian', { torso: 1.1, arms: 1.07, legs: 1.05, depth: 1.08 }),
    hide: ['Barbarian_Cape'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }],
    paint: {
      ...outfit('Barbarian', '#4a9e8a', '#3a5a4a', 0.55), ...face('Barbarian', { skin: '#f2c8a8', hair: '#e8a040' }),
      Barbarian_Hat: { tint: '#c8a060', amount: 0.6 }, Mage_Cape: { tint: '#2e6e6a', amount: 0.85 },
      Barbarian_Round_Shield: { tint: '#2e6e6a', amount: 0.5 }, '1H_Axe': { tint: '#e8e0d0', amount: 0.3 },
    },
    extras: [
      { type: 'pauldrons', bone: 'chest', color: 0xe8c060 },
      { type: 'beard', bone: 'head', style: 'braids', color: 0xd89838 },
    ],
  },
  // ---------- Mago ----------
  pyro: {   // cabelo e cavanhaque de fogo, brasas girando em volta
    shape: silhouette('Mage', { torso: 0.95, arms: 0.94, legs: 0.97, height: 1.03, depth: 0.95 }),
    paint: {
      ...outfit('Mage', '#e8642e', '#8a3a1e'), ...face('Mage', { skin: '#f0b088', hair: '#ff6a1a' }),
      Mage_Hat: { tint: '#d13b2b', amount: 0.85 }, Mage_Cape: { tint: '#ffb03a', amount: 0.8 },
    },
    // chamas na ponta do chapéu (inclinado para trás) e as duas mãos pegando fogo
    extras: [
      { type: 'flames', bone: 'head', y: 1.42, z: -0.3 }, { type: 'handFire', bone: 'handslotl' }, { type: 'handFire', bone: 'handslotr' },
      { type: 'beard', bone: 'head', style: 'goatee', color: 0xff6a1a },
      { type: 'motes', bone: 'root', color: 0xff8a2a, n: 7 },
    ],
  },
  arcane: {   // sábio sem chapéu: barba longa prateada, diadema com gema, estrelas orbitando
    shape: silhouette('Mage', { torso: 0.89, arms: 0.91, legs: 0.95, height: 1.09, depth: 0.89 }),
    hide: ['Mage_Hat', 'Mage_Cape'],
    add: [{ from: 'Knight', part: 'Knight_Cape' }],
    // o livro do GLB fica de lado na mão; aqui ele abre para a frente, levemente inclinado para trás
    pose: { Spellbook_open: { rot: [-Math.PI / 2 + 0.5, 0, -Math.PI / 2] } },
    paint: {
      ...outfit('Mage', '#6a4fc4', '#3a2a7a'), ...face('Mage', { skin: '#f2d8c8', hair: '#e6e0ff' }),
      Knight_Cape: { tint: '#8a6ae0', amount: 0.85 }, Spellbook_open: { tint: '#6a4fc4', amount: 0.5 },
    },
    extras: [
      { type: 'stars', bone: 'head', color: 0xffe066 }, { type: 'runeRing', bone: 'root', color: 0xb07aff },
      { type: 'beard', bone: 'head', style: 'long', color: 0xe6e0ff },
      { type: 'circlet', bone: 'head', gem: 0xb07aff },
    ],
  },
  cryo: {   // pele pálida, cabelo de geada; flocos girando
    shape: silhouette('Mage', { torso: 1.02, arms: 1.04, legs: 1.01, height: 1.04, depth: 1.03 }),
    hide: ['Mage_Hat'],
    paint: {
      ...outfit('Mage', '#e8f6ff', '#8ec8e8', 0.65), ...face('Mage', { skin: '#eef0f8', hair: '#d8f0ff' }),
      Mage_Cape: { tint: '#ffffff', amount: 0.8 }, '1H_Wand': { tint: '#bff0ff', amount: 0.6 },
    },
    extras: [
      { type: 'iceCrown', bone: 'head', radius: 0.5, y: 0.84, n: 9, height: 1.7 },
      { type: 'iceMantle', bone: 'chest' },
      { type: 'iceShard', bone: 'handslotl' },
      { type: 'motes', bone: 'root', color: 0xe8f8ff, n: 8, size: 0.05 },
    ],
  },
  // ---------- Ladino ----------
  assassin: {   // couro escuro com carmim: capuz baixo nas costas, gola de cachecol, faixas nos antebraços
    shape: silhouette('Rogue', { torso: 0.98, arms: 0.96, legs: 1, height: 1.02, depth: 0.97 }),
    hide: ['Rogue_Cape'],
    add: [{ from: 'Mage', part: 'Mage_Cape' }],
    paint: {
      ...rogueOutfit({ cloth: '#3a2228', trim: '#d01834', leather: '#1c1216', pants: '#2a1a1e', boots: '#140c10', gloves: '#1c1216', metal: '#d01834' }),
      ...face('Rogue', { skin: '#ead2c8', hair: '#1a1420' }),
      Mage_Cape: { tint: '#6a1426', amount: 0.9 },
      Knife: { tint: '#9a7ab8', amount: 0.45 }, Knife_Offhand: { tint: '#9a7ab8', amount: 0.45 },
    },
    extras: [
      { type: 'scarf', bone: 'head', color: 0xd01834 }, { type: 'cowl', bone: 'chest' },
      { type: 'armWraps', bone: 'lowerarm.l' }, { type: 'armWraps', bone: 'lowerarm.r' },
    ],
  },
  crossbow: {   // caçador no modelo Ranger (Adventurers 2.0, bigode e aljava próprios): gibão marrom e mangas verde-floresta, chapéu com pena (Robin Hood)
    shape: silhouette('Ranger', { torso: 1.03, arms: 1.02, legs: 1, height: 1.04, depth: 1.03 }),
    add: [
      { from: 'Rogue', part: '2H_Crossbow' },
      { from: 'Mage', part: 'Mage_Hat', scale: 0.72, pos: [0, -0.08, 0] },
    ],
    paint: {
      ...rangerOutfit({ cloth: '#9a6434', trim: '#7cc860', leather: '#5a3418', cape: '#4f9a44', sleeves: '#5aa84a', pants: '#6a4a2a' }),
      ...face('Ranger', { skin: '#e8b890', hair: '#8a4a1e' }),
      Mage_Hat: { tint: '#4f9a44', amount: 0.85 }, Ranger_Quiver: { tint: '#5a3418', amount: 0.5 },
      '2H_Crossbow': { tint: '#8a5a2e', amount: 0.5 },
    },
    extras: [
      { type: 'feather', bone: 'head', color: 0xff3d3d },
    ],
  },
  ninja: {   // capuz azul-noite, máscara, faixa vermelha na testa e shurikens (na mão e no cinto)
    shape: silhouette('Rogue', { torso: 0.88, arms: 0.91, legs: 0.96, height: 1.08, depth: 0.89 }),
    hide: ['Knife', 'Throwable'],
    paint: {
      ...rogueOutfit({ cloth: '#2a46a8', trim: '#1c2e70', leather: '#121a3a', pants: '#203478', boots: '#0e142c', gloves: '#121a3a' }),
      ...face('Rogue', { skin: '#e8c8b0', hood: '#2c4cb8' }, 'Rogue_Head_Hooded'),
      Rogue_Cape: { tint: '#2c44a0', amount: 0.85 },
    },
    extras: [
      { type: 'scarf', bone: 'head', color: 0xffffff }, { type: 'mask', bone: 'head', color: 0x1e2648 },
      { type: 'headband', bone: 'head', color: 0xd8343a, y: 0.6, radius: 0.55 },
      { type: 'shuriken', bone: 'handslotr' },
      { type: 'shurikenBelt', bone: 'hips' },
    ],
  },
  duelist: {   // espadachim de casaca bordô com dourado, gola alta, cinto largo, dragonas douradas e duas espadas curtas
    shape: silhouette('Rogue', { torso: 0.95, arms: 0.97, legs: 1.02, height: 1.05, depth: 0.95 }),
    hide: ['Rogue_Cape'],
    add: [
      { from: 'Knight', part: 'Knight_Cape', scale: 0.85 },
      { from: 'Knight', part: '1H_Sword', bone: 'handslotr', pos: [0, 0.03, 0], rot: [0, Math.PI, 0], scale: 0.7 },
      { from: 'Knight', part: '1H_Sword_Offhand', bone: 'handslotl', pos: [0, 0.02, 0], scale: 0.7 },
    ],
    paint: {
      ...rogueOutfit({ cloth: '#9c1838', trim: '#f0c040', leather: '#241418', pants: '#2e2228', boots: '#160e10', gloves: '#f4ecdc', metal: '#f0c040' }),
      ...face('Rogue', { skin: '#f0cfae', hair: '#e8e2d4' }),
      Knight_Cape: { tint: '#7a1028', amount: 0.9 },
    },
    extras: [
      { type: 'pauldrons', bone: 'chest', color: 0xf0c040, trim: 0x9c1838, size: 0.8 }, { type: 'feather', bone: 'head', color: 0xdfe6ee, y: 0.95 },
      { type: 'highCollar', bone: 'chest' }, { type: 'wideBelt', bone: 'hips' },
    ],
  },
  archer: {   // caçadora encapuzada: capuz e túnica verde-água com creme, couro castanho, arco pronto (Fantasy Weapons) e aljava
    shape: silhouette('Rogue', { torso: 0.92, arms: 0.94, legs: 1.02, height: 1.06, depth: 0.92 }),
    add: [{ from: 'kaykit/weapons/Assets/gltf/bow_A_withString', part: 'bow_A_withString', bone: 'handslot.l', rot: [0, -Math.PI / 2, 0] }],   // o arco do pacote deita no eixo X: gira para ficar em pé com a corda para o corpo
    paint: {
      ...rogueOutfit({ cloth: '#2f9a86', trim: '#f2e2b0', leather: '#6a3a22', pants: '#3e5a40', boots: '#3a2214', gloves: '#8a5a2e', sleeves: '#e8dcb8' }),
      ...face('Rogue', { skin: '#f2d0b0', hood: '#1f7a6a' }, 'Rogue_Head_Hooded'),
      Rogue_Cape: { tint: '#1a5a50', amount: 0.85 }, bow_A_withString: { tint: '#8a5a2e', amount: 0.35 },
    },
    extras: [
      { type: 'quiver', bone: 'chest' },
      { type: 'armWraps', bone: 'lowerarm.l', color: 0x8a5a2e, n: 2 },
    ],
  },
  // ---------- Bárbaro (cont.) ----------
  monk: {   // monge de manto açafrão: cabeça raspada, contas de madeira, faixa vermelha, punhos enfaixados e sem armas
    shape: silhouette('Barbarian', { torso: 0.98, arms: 1.02, legs: 1, height: 1.02, depth: 0.98 }),
    hide: ['Barbarian_Hat', 'Barbarian_Cape'],
    paint: {
      ...outfit('Barbarian', '#e8862a', '#7a2a18', 0.8), ...face('Barbarian', { skin: '#f3cfab', hair: '#d8a47c' }),
      Barbarian_ArmLeft: { tint: '#f3cfab', amount: 0.35 }, Barbarian_ArmRight: { tint: '#f3cfab', amount: 0.35 },   // braços à mostra: cor de pele
    },
    extras: [
      { type: 'beads', bone: 'chest' }, { type: 'sash', bone: 'chest' },
      { type: 'armWraps', bone: 'lowerarm.l', color: 0xf4ecdc, radius: 0.14, n: 4 }, { type: 'armWraps', bone: 'lowerarm.r', color: 0xf4ecdc, radius: 0.14, n: 4 },
    ],
  },
  // ---------- Suporte ----------
  alchemist: {   // alquimista de jaleco oliva e avental de couro: óculos de latão na testa, cabelo ruivo, cinto de frascos e frasco na mão
    shape: silhouette('Mage', { torso: 1.04, arms: 1, legs: 0.98, height: 0.98, depth: 1.06 }),
    hide: ['Mage_Hat', 'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
    paint: {
      ...outfit('Mage', '#7a8a3a', '#4a3a28', 0.7), ...face('Mage', { skin: '#f0c8a4', hair: '#c8501e' }),
      Mage_Cape: { tint: '#7a4a26', amount: 0.85 },
    },
    extras: [
      { type: 'goggles', bone: 'head' }, { type: 'flaskBelt', bone: 'hips' },
      { type: 'flask', bone: 'handslotr', liquid: 0x9cff3a, size: 1.2 },
    ],
  },
  // ---------- Bárbaro (tanque) ----------
  // gigante de punhos (como o Barbarian large): ombros, braços e punhos enormes, cabeça pequena, pernas curtas e grossas,
  // costas curvadas; pele curtida, tanga de pele com cinto largo, ombreira de pedra de um lado só e corrente no peito
  brute: {
    shape: silhouette('Barbarian', { torso: 1.3, arms: 1.28, legs: 1.14, height: 1.02, depth: 1.26 }),
    // por osso (characters.js): a pose do clipe continua, com estas proporções por cima
    bones: {
      hips: { pos: [0, -0.045, 0] },   // pernas mais curtas: o quadril desce para os pés não flutuarem
      spine: { scale: [1.14, 1, 1.18], rot: [0.16, 0, 0] },   // barriga e costas curvadas para a frente
      chest: { scale: [1.3, 1.02, 1.14], rot: [0.1, 0, 0] },   // peito e ombros largos
      head: { scale: 0.44, rot: [-0.3, 0, 0] },   // cabeça pequena, erguida para olhar à frente
      'upperarm.l': { scale: 1.3 }, 'upperarm.r': { scale: 1.3 },   // braços longos e grossos
      'hand.l': { scale: 1.3 }, 'hand.r': { scale: 1.3 },   // punhos enormes
      'upperleg.l': { scale: [1.3, 0.86, 1.3] }, 'upperleg.r': { scale: [1.3, 0.86, 1.3] },   // pernas curtas e grossas
    },
    hide: ['Barbarian_Hat', 'Barbarian_Cape'],
    paint: {
      ...outfit('Barbarian', '#3c4652', '#3a2a20', 0.75), ...face('Barbarian', { skin: '#c88a5e', hair: '#5a1e0e' }),
      Barbarian_ArmLeft: { tint: '#c88a5e', amount: 0.4 }, Barbarian_ArmRight: { tint: '#c88a5e', amount: 0.4 },   // braços nus, cor de pele
    },
    extras: [
      { type: 'pauldrons', bone: 'chest', color: 0x8e887c, trim: 0x4a4440, size: 1.16, spikes: true, sides: [1] },
      { type: 'chain', bone: 'chest', side: 1 },
      { type: 'furLoincloth', bone: 'hips', fur: 0x6e5034, belt: 0x2e1c12, buckle: 0xc08a3a },
      { type: 'armWraps', bone: 'lowerarm.l', color: 0x5a3a24, radius: 0.13, n: 3 },
      { type: 'armWraps', bone: 'lowerarm.r', color: 0x5a3a24, radius: 0.13, n: 3 },
      { type: 'stoneFist', bone: 'hand.l' }, { type: 'stoneFist', bone: 'hand.r' },
      { type: 'beard', bone: 'head', color: 0x5a1e0e },
    ],
  },
  // ---------- Invocador ----------
  summoner: {   // mestre dos pactos: manto ameixa com capa rosada, cabelo verde-água, cajado de gema e sininhos
    shape: silhouette('Mage', { torso: 0.97, arms: 0.97, legs: 0.98, height: 1.03, depth: 0.97 }),
    hide: ['Spellbook', 'Spellbook_open', '1H_Wand', 'Mage_Hat'],   // sem chapéu de mago: coroa de flores (não confunde com o Piromante)
    paint: {
      ...outfit('Mage', '#8a3a6e', '#4a2a48', 0.8), ...face('Mage', { skin: '#f2c9a8', hair: '#3ab0a0' }),
      Mage_Cape: { tint: '#f0a8d0', amount: 0.8 }, '2H_Staff': { tint: '#c89a5a', amount: 0.55 },
    },
    extras: [
      { type: 'flowerCrown', bone: 'head' },
      { type: 'bellStaff', bone: 'handslotr', gem: 0xff8ad8, metal: 0xf0c040 },
      { type: 'robeSkirt', bone: 'hips', color: 0x8a3a6e, trim: 0xf0c040, height: 0.5, flare: 0.44 },
      { type: 'motes', bone: 'root', color: 0xffb8dc, n: 4, size: 0.04, y: 1.1 },
    ],
  },
};

// para a vitrine: modelo e armas visíveis de cada variante, na ordem de VARIANTS em main.js (o jogo usa aquela lista);
// as variantes montadas por receita (characters.js) apontam a receita em "recipe" e usam as armas dela
export const LOOK_PREVIEW = [
  { id: 'paladin', name: 'Paladino', model: 'Knight', use: ['1H_Sword', 'Round_Shield'] },
  { id: 'guardian', name: 'Guardião', model: 'Knight', use: ['1H_Sword', 'Rectangle_Shield'] },
  { id: 'champion', name: 'Campeão', model: 'Knight', use: ['2H_Sword'] },
  { id: 'berserker', name: 'Berserker', model: 'Barbarian', use: ['1H_Axe', '1H_Axe_Offhand'] },
  { id: 'crusher', name: 'Esmagador', model: 'Barbarian', use: ['2H_Axe'] },
  { id: 'viking', name: 'Viking', model: 'Barbarian', use: ['1H_Axe', 'Barbarian_Round_Shield'] },
  { id: 'pyro', name: 'Piromante', model: 'Mage', use: [] },   // conjura com as mãos em chamas, sem cajado
  { id: 'arcane', name: 'Arcano', model: 'Mage', use: ['Spellbook_open', '1H_Wand'] },
  { id: 'cryo', name: 'Criomante', model: 'Mage', use: ['1H_Wand'] },
  { id: 'assassin', name: 'Assassino', model: 'Rogue', use: ['Knife', 'Knife_Offhand'] },
  { id: 'crossbow', name: 'Besteiro', model: 'Ranger', use: ['2H_Crossbow'] },
  { id: 'ninja', name: 'Ninja', model: 'Rogue_Hooded', use: ['Knife', 'Throwable'] },
  { id: 'duelist', name: 'Duelista', model: 'Rogue', use: [] },
  { id: 'king', name: 'Rei Dourado', model: 'Knight', recipe: 'rei' },
  { id: 'iceviking', name: 'Viking do Gelo', model: 'Barbarian', recipe: 'viking' },
  { id: 'necro', name: 'Necromante', model: 'Skeleton_Mage', recipe: 'necromante' },
  { id: 'druid', name: 'Druida', model: 'Rogue', recipe: 'druida' },
  { id: 'cleric', name: 'Clériga', model: 'Mage', recipe: 'cleric' },
  { id: 'bard', name: 'Bardo', model: 'Rogue', recipe: 'bard' },
  { id: 'angel', name: 'Anjo', model: 'Mage', recipe: 'angel' },
  { id: 'chronist', name: 'Cronomante', model: 'Rogue', recipe: 'chronist' },
  { id: 'archer', name: 'Arqueira', model: 'Rogue_Hooded', use: [] },
  { id: 'monk', name: 'Monge', model: 'Barbarian', use: [] },
  { id: 'alchemist', name: 'Alquimista', model: 'Mage', use: [] },
  { id: 'engineer', name: 'Engenheira', model: 'Rogue', recipe: 'engineer' },
  { id: 'beast_tamer', name: 'Domador', model: 'Barbarian', recipe: 'beast_tamer' },
  { id: 'oracle', name: 'Oráculo', model: 'Mage', recipe: 'oracle' },
  { id: 'brute', name: 'Brutamontes', model: 'Barbarian', use: [], scale: 1.6, clips: { Idle: 'Brute_Idle', Running_A: 'Brute_Run' } },   // luta de punhos; anda e respira como gigante (Rig_Large)
  { id: 'summoner', name: 'Invocador', model: 'Mage', use: ['2H_Staff'] },
];
export const WEAPONS = {
  Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'],
  Barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
  Mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
  Rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
};
WEAPONS.Rogue_Hooded = WEAPONS.Rogue;
WEAPONS.Ranger = [];   // o Ranger 2.0 vem sem armas: a besta vem do Ladino (add)
WEAPONS.Knight20 = [];   // o Knight 2.0 também: as armas entram por LOOKS20

// ---------- prova: heróis no KayKit Adventurers 2.0 ----------
// Herói com entrada em LOOKS20 usa o modelo 2.0 da classe (MODEL20) no lugar do 1.0; apagar a entrada volta ao 1.0
// (e ?v10 na URL força o 1.0 para comparar). O 2.0 vem sem armas: elas entram do pacote no osso da mão, com o nome
// das armas do 1.0 (name), para use/hide, pintura e o brilho de carga continuarem valendo. Elmo, viseira e capa
// do 2.0 são de pele (seguem o corpo).
export const MODEL20 = { Knight: 'Knight20' };
const ADV = 'kaykit/adventurers/Assets/gltf/';
export const LOOKS20 = {
  paladin: {   // mesmo santo guerreiro de LOOKS.paladin, na malha do Knight 2.0
    shape: silhouette('Knight', { torso: 1.04, arms: 1.02, legs: 1.02, depth: 1.04 }),
    hide: ['Knight_Cape'],
    add: [
      { from: 'Mage', part: 'Mage_Cape' },   // capa longa do Mago 1.0: pele religada aos ossos do 2.0 pelo nome
      { from: `${ADV}sword_1handed`, part: 'sword_1handed', name: '1H_Sword', bone: 'handslot.r', pos: [0, 0.033, 0], rot: [0, Math.PI, 0] },
      { from: `${ADV}shield_round_color`, part: 'shield_round_color', name: 'Round_Shield', bone: 'handslot.l', pos: [0, 0.017, 0.156] },
    ],
    paint: {
      ...outfit('Knight', '#f4ecd8', '#e8dcc0', 0.55), ...face('Knight', { skin: '#f6d2b0', hair: '#f2d27a' }),
      Mage_Cape: { tint: '#fff8e8', amount: 0.85 }, Knight_Helmet: { tint: '#fff6e0', amount: 0.45 }, Knight_HelmetVisor: { tint: '#fff6e0', amount: 0.45 },
      '1H_Sword': { tint: '#fff0b8', amount: 0.4 }, Round_Shield: { tint: '#f2d27a', amount: 0.55 },
    },
    extras: [
      { type: 'plume', bone: 'head', color: 0xffffff, tall: true, y: 1.25 },
      { type: 'pauldrons', bone: 'chest', color: 0xf2c94c, trim: 0xfff6dc },
      { type: 'emblem', bone: 'chest' },
    ],
  },
};
// modelo e aparência que o herói usa de fato (only10: ignora LOOKS20)
export function heroLook(id, model, only10 = false) {
  const look20 = !only10 && LOOKS20[id];
  return look20 ? { model: MODEL20[model], look: look20 } : { model, look: LOOKS[id] };
}
