import { CHARACTERS } from './characters.js';
import { MONSTER_TYPES } from './monsters.js';

export const HEROES = [
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
export const VARIANTS = [
  { id: 'paladin', names: ['Paladino', 'Paladino Real', 'Santo Guerreiro'], desc: 'Cura os amigos próximos.', ability: 'Círculo de cura', color: ['#a9e9bc', '#55a77b'],
    use: ['1H_Sword', 'Round_Shield'], stats: { Vida: 5, Força: 3, Rapidez: 3, Alcance: 1 }, classId: 0 },
  { id: 'guardian', names: ['Guardião', 'Guardião Real', 'Muralha Viva'], desc: 'Atrai inimigos e reduz o dano.', ability: 'Provocar', color: ['#9fcfff', '#568ccc'],
    use: ['1H_Sword', 'Rectangle_Shield'], stats: { Vida: 5, Força: 2, Rapidez: 2, Alcance: 1 }, hp: 300, dmg: 28, attacks: ['1H_Melee_Attack_Stab', 'Block_Attack', '1H_Melee_Attack_Chop'], classId: 0 },
  { id: 'champion', names: ['Campeão', 'Campeão Real', 'Lâmina Solar'], desc: 'Gira e empurra os inimigos.', ability: 'Turbilhão', color: ['#ffe59b', '#c99a3e'],
    use: ['2H_Sword'], stats: { Vida: 4, Força: 5, Rapidez: 3, Alcance: 2 }, dmg: 32, cooldown: 1.05, idle: '2H_Melee_Idle', attacks: ['2H_Melee_Attack_Slice', '2H_Melee_Attack_Chop'], classId: 0 },
  { id: 'berserker', names: ['Berserker', 'Fera Rubra', 'Fúria Titã'], desc: 'Pouca vida, golpes mais rápidos.', ability: 'Fúria', color: ['#ffb2b2', '#ce5f63'],
    use: ['1H_Axe', '1H_Axe_Offhand'], stats: { Vida: 4, Força: 4, Rapidez: 4, Alcance: 1 }, hp: 245, dmg: 30, cooldown: 0.95, cleave: 0, attacks: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'], classId: 1 },
  { id: 'crusher', names: ['Esmagador', 'Quebra-rochas', 'Abala-terra'], desc: 'Pancada que deixa todos zonzos.', ability: 'Terremoto', color: ['#ffbf8a', '#d88950'],
    use: ['2H_Axe'], stats: { Vida: 5, Força: 5, Rapidez: 2, Alcance: 2 }, dmg: 31, attacks: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop'], classId: 1 },
  { id: 'viking', names: ['Viking', 'Jarl Valente', 'Rei do Norte'], desc: 'Arremessa um machado à distância.', ability: 'Machado voador', color: ['#b8dfe5', '#5b9dab'],
    use: ['1H_Axe', 'Barbarian_Round_Shield'], stats: { Vida: 5, Força: 4, Rapidez: 3, Alcance: 3 }, cleave: 0, idle: 'Idle', attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal'], classId: 1 },
  { id: 'pyro', names: ['Piromante', 'Chama Viva', 'Fênix Solar'], desc: 'Bolas de fogo deixam chamas no chão.', ability: 'Chão em chamas', color: ['#ffc6a4', '#dc8757'],
    use: [], stats: { Vida: 2, Força: 5, Rapidez: 2, Alcance: 5 }, dmg: 22, splash: 1.1, classId: 2 },
  { id: 'arcane', names: ['Arcano', 'Sábio Astral', 'Mestre Estelar'], desc: 'Um raio salta entre os inimigos.', ability: 'Raio em cadeia', color: ['#d4b3ff', '#9a6be0'],
    use: ['Spellbook_open', '1H_Wand'], stats: { Vida: 2, Força: 4, Rapidez: 3, Alcance: 5 }, dmg: 24, splash: 0, cooldown: 1.05, attacks: ['Spellcast_Shoot', '1H_Ranged_Shoot'], classId: 2 },
  { id: 'cryo', names: ['Criomante', 'Sábio Glacial', 'Coração Polar'], desc: 'Gelo deixa os esqueletos lentinhos.', ability: 'Onda de gelo', color: ['#b9efff', '#58aaca'],
    use: ['1H_Wand'], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 5 }, hp: 170, dmg: 24, splash: 0.8, cooldown: 1.2, classId: 2 },
  { id: 'assassin', names: ['Assassino', 'Sombra Ágil', 'Sombra Real'], desc: 'Golpes críticos e esquivas ligeiras.', ability: 'Passo das sombras', color: ['#d1b7df', '#9974b5'],
    use: ['Knife', 'Knife_Offhand'], stats: { Vida: 3, Força: 5, Rapidez: 5, Alcance: 1 }, dmg: 21, classId: 3 },
  { id: 'crossbow', names: ['Besteiro', 'Mira de Águia', 'Flecha Real'], desc: 'Virotes atravessam a fila.', ability: 'Tiro perfurante', color: ['#c9eaa4', '#84ac50'],
    use: ['2H_Crossbow'], stats: { Vida: 3, Força: 4, Rapidez: 3, Alcance: 5 }, ranged: true, range: 7, cooldown: 1.05, model: 'Ranger', run: 'Running_HoldingRifle', attacks: ['2H_Ranged_Shoot', '2H_Ranged_Shooting'], classId: 3 },
  { id: 'ninja', names: ['Ninja', 'Vento Noturno', 'Lua Silenciosa'], desc: 'Lança três adagas em leque.', ability: 'Leque de adagas', color: ['#b6c5f4', '#768ac6'],
    use: ['Knife', 'Throwable'], stats: { Vida: 3, Força: 3, Rapidez: 5, Alcance: 4 }, hp: 200, model: 'Rogue_Hooded', classId: 3 },
  { id: 'duelist', names: ['Duelista', 'Lâmina Dupla', 'Mestre das Lâminas'], desc: 'Duas espadas curtas em cortes velozes.', ability: 'Rajada de lâminas', color: ['#dfe6ee', '#8394aa'],
    use: ['1H_Sword', '1H_Sword_Offhand'], stats: { Vida: 3, Força: 4, Rapidez: 5, Alcance: 1 }, hp: 200, dmg: 19, cooldown: 0.48, attacks: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'], classId: 3 },
  { id: 'king', names: ['Rei Dourado', 'Rei Radiante', 'Imperador Solar'], desc: 'Seu brado fortalece todo o grupo.', ability: 'Brado real', color: CHARACTERS[2].color,
    recipe: CHARACTERS[2], classId: 0, dmg: 28, idle: '2H_Melee_Idle', attacks: ['2H_Melee_Attack_Slice', '2H_Melee_Attack_Stab'], stats: { Vida: 5, Força: 3, Rapidez: 3, Alcance: 1 } },
  { id: 'iceviking', names: ['Viking do Gelo', 'Jarl Glacial', 'Rei das Geleiras'], desc: 'Seu machado congela uma área.', ability: 'Machado glacial', color: CHARACTERS[3].color,
    recipe: CHARACTERS[3], classId: 1, dmg: 29, stats: { Vida: 5, Força: 4, Rapidez: 2, Alcance: 3 } },
  { id: 'necro', names: ['Necromante', 'Senhor dos Ossos', 'Soberano Espectral'], desc: 'Invoca dois esqueletinhos amigos.', ability: 'Amigos do além', color: CHARACTERS[1].color,
    recipe: CHARACTERS[1], classId: 2, dmg: 24, splash: 0, stats: { Vida: 2, Força: 3, Rapidez: 2, Alcance: 5 } },
  { id: 'druid', names: ['Druida', 'Guardião do Bosque', 'Espírito da Floresta'], desc: 'Raízes prendem e a natureza cura.', ability: 'Abraço da floresta', color: CHARACTERS[0].color,
    recipe: CHARACTERS[0], classId: 4, pickGroup: 'druida', hp: 180, speed: 3, ranged: true, range: 6, dmg: 21, cooldown: 1, attacks: ['Spellcast_Shoot'], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 4 } },
  { id: 'cleric', names: ['Clériga', 'Sacerdotisa', 'Santa Guardiã'], desc: 'Orações curam e fortalecem quem está na linha de frente.', ability: 'Oração restauradora', color: CHARACTERS[4].color,
    recipe: CHARACTERS[4], classId: 4, pickGroup: 'cleric', hp: 225, dmg: 27, range: 5, cooldown: 1.2, ranged: true, attacks: ['Spellcast_Shoot'], stats: { Vida: 4, Força: 3, Rapidez: 3, Alcance: 4 } },
  { id: 'bard', names: ['Apostador', 'Jogador de Cartas', 'Rei do Blefe'], desc: 'Lança cartas e dados: o naipe sorteado cura, fere, atrasa ou acelera.', ability: 'Carta Marcada', color: CHARACTERS[5].color,
    recipe: CHARACTERS[5], classId: 3, hp: 190, dmg: 15, range: 5, speed: 3.4, cooldown: 1.05, ranged: true, idle: 'Idle', attacks: ['Spellcast_Shoot'], stats: { Vida: 2, Força: 3, Rapidez: 4, Alcance: 4 } },
  { id: 'angel', names: ['Anjo', 'Arcanjo', 'Serafim'], desc: 'Paira acima da batalha e desce com impacto de luz para amparar o grupo.', ability: 'Descida celeste', color: CHARACTERS[6].color,
    recipe: CHARACTERS[6], classId: 4, pickGroup: 'angel', hp: 180, dmg: 20, range: 6.5, cooldown: 1.2, ranged: true, idle: 'Jump_Idle', splash: 0.6, attacks: ['Spellcast_Shoot'], stats: { Vida: 3, Força: 4, Rapidez: 3, Alcance: 5 } },
  { id: 'chronist', names: ['Cronomante', 'Tecelão do Tempo', 'Mestre do Instante'], desc: 'Dobra o tempo para deter uma ameaça e abrir espaço.', ability: 'Campo temporal', color: CHARACTERS[7].color,
    recipe: CHARACTERS[7], classId: 2, splash: 0, hp: 165, dmg: 21, range: 6, speed: 3.5, cooldown: 1.05, ranged: true, attacks: ['Spellcast_Shoot'], stats: { Vida: 3, Força: 3, Rapidez: 4, Alcance: 5 } },
  { id: 'archer', names: ['Arqueira', 'Olho de Falcão', 'Caçadora Lendária'], desc: 'Flechas longas que atravessam a fila.', ability: 'Flecha longa', color: ['#a8e6d6', '#3f9e8a'],
    use: [], stats: { Vida: 3, Força: 4, Rapidez: 4, Alcance: 5 }, model: 'Rogue_Hooded', hp: 170, dmg: 16, range: 7.5, cooldown: 1, ranged: true, idle: 'Ranged_Bow_Idle', run: 'Running_HoldingBow', attacks: ['Ranged_Bow_Release'], classId: 3 },
  { id: 'monk', names: ['Monge', 'Punho Sereno', 'Mestre do Vento'], desc: 'Punhos velozes e uma calma que cura.', ability: 'Cem punhos', color: ['#ffd9a0', '#d8902e'],
    use: [], stats: { Vida: 4, Força: 3, Rapidez: 5, Alcance: 1 }, hp: 235, dmg: 20, range: 1.4, speed: 3.4, cooldown: 0.5, cleave: 0, idle: 'Unarmed_Idle',
    attacks: ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B', 'Unarmed_Melee_Attack_Kick'], classId: 1, pickGroup: 'monk' },
  { id: 'alchemist', names: ['Alquimista', 'Mestre dos Frascos', 'Grão-Transmutador'], desc: 'Frascos de veneno e de tônico.', ability: 'Frasco', color: ['#d8f59a', '#8cb83f'],
    use: [], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 4 }, hp: 200, dmg: 14, range: 6, speed: 3, cooldown: 1.15, ranged: true, splash: 0.6, attacks: ['Spellcast_Shoot'], classId: 4, pickGroup: 'alchemist' },
  { id: 'engineer', names: ['Engenheira', 'Inventora de Batalha', 'Mestra das Engrenagens'], desc: 'Constrói uma torre automática e desmonta a formação inimiga.', ability: 'Torreta sentinela', color: ['#9be8db', '#3b9c94'],
    stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 5 }, hp: 190, dmg: 19, range: 6.5, speed: 2.8, cooldown: 1.2, ranged: true, splash: 0.6, attacks: ['1H_Ranged_Shoot'], classId: 2, pickGroup: 'engineer', recipe: CHARACTERS[8] },
  { id: 'beast_tamer', names: ['Domador', 'Guardião da Matilha', 'Lenda Selvagem'], desc: 'Chama uma fera aliada que protege o grupo e caça ameaças.', ability: 'Companheiro feral', color: ['#d2c28e', '#8c6d36'],
    stats: { Vida: 4, Força: 4, Rapidez: 3, Alcance: 2 }, hp: 225, dmg: 23, range: 1.7, speed: 3.2, cooldown: 1, attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal'], classId: 1, pickGroup: 'beast-tamer', recipe: CHARACTERS[9] },
  { id: 'oracle', names: ['Oráculo', 'Vidente do Véu', 'Profeta das Estrelas'], desc: 'Prevê ataques anunciados e interrompe os golpes dos chefes.', ability: 'Estilhaço do augúrio', color: ['#c6b4ff', '#7862c5'],
    stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 5 }, hp: 175, dmg: 22, range: 8, speed: 2.8, cooldown: 1.2, ranged: true, splash: 0, attacks: ['Spellcast_Shoot'], classId: 2, pickGroup: 'oracle', recipe: CHARACTERS[10] },
  { id: 'geomancer', names: ['Geomante', 'Mestre das Pedras', 'Senhor da Terra'], desc: 'Ergue espinhos e muralhas de pedra.', ability: 'Espinhos de pedra', color: ['#d8c8a0', '#8a7a58'],
    use: [], stats: { Vida: 3, Força: 3, Rapidez: 2, Alcance: 4 }, hp: 180, dmg: 17, range: 6.5, speed: 2.8, cooldown: 1.2, ranged: true, splash: 0.4, attacks: ['Spellcast_Shoot'], classId: 2, pickGroup: 'geomancer' },
  // tanque de punhos: mais vida e menos dano que o Guardião, lento; armor tira um pouco de cada golpe (takeDamage)
  { id: 'brute', names: ['Brutamontes', 'Rocha Viva', 'Colosso'], desc: 'Aguenta a horda na frente do grupo.', ability: 'Pancada', color: ['#c9bba2', '#7d7464'],
    use: [], stats: { Vida: 5, Força: 2, Rapidez: 1, Alcance: 1 }, hp: 340, dmg: 24, range: 1.6, speed: 2.65, cooldown: 1.35, idle: 'Brute_Idle', walk: 'Brute_Walk', run: 'Brute_Run',   // guarda, passo e corrida de gigante (Rig_Large)
    attacks: ['Brute_Punch', 'Brute_Kick'], armor: 3, scale: 1.6, frontline: true, classId: 1 },
  // curandeira agressiva: precisa bater para curar (o dano causado vira vida no aliado mais ferido)
  { id: 'vampire', names: ['Vampira', 'Condessa do Vínculo', 'Rainha da Noite'], desc: 'Cura roubando a vida dos inimigos.', ability: 'Garra de sangue', color: ['#c8465e', '#5a1626'],
    use: [], stats: { Vida: 3, Força: 3, Rapidez: 4, Alcance: 3 }, hp: 185, dmg: 15, range: 5, speed: 3.1, cooldown: 1.1, ranged: true, attacks: ['Spellcast_Shoot'], classId: 4, pickGroup: 'vampire' },
  // lança longa: alcance médio e controle de linha; a postura estende o alcance e a carga atropela comuns
  { id: 'lancer', names: ['Lanceiro', 'Lanceiro Real', 'Cavalaria Dourada'], desc: 'Fere a fila inteira com a lança.', ability: 'Estocada', color: ['#8fb0ff', '#3a5aa8'],
    use: [], stats: { Vida: 4, Força: 3, Rapidez: 3, Alcance: 3 }, hp: 290, dmg: 27, range: 2.4, speed: 3.1, cooldown: 1, idle: '2H_Melee_Idle',
    attacks: ['2H_Melee_Attack_Stab', '2H_Melee_Attack_Slice'], classId: 0 },
  { id: 'runic', names: ['Rúnica', 'Tecelã de Escudos', 'Guardiã das Runas'], desc: 'Runas de escudo que protegem antes do golpe.', ability: 'Runa-escudo', color: ['#9be0ee', '#2e7d8c'],
    use: [], stats: { Vida: 3, Força: 2, Rapidez: 3, Alcance: 4 }, hp: 185, dmg: 12, range: 6, speed: 3, cooldown: 1.2, ranged: true, attacks: ['Spellcast_Shoot'], classId: 4, pickGroup: 'runic' },
  { id: 'summoner', names: ['Invocador', 'Mestre dos Pactos', 'Senhor do Bestiário'], desc: 'Invoca fada, golem, dragãozinho e slime.', ability: 'Fada', color: ['#ffb8dc', '#b04a86'],
    use: ['2H_Staff'], stats: { Vida: 3, Força: 3, Rapidez: 3, Alcance: 4 }, hp: 175, dmg: 19, range: 6, speed: 2.9, cooldown: 1.2, ranged: true, attacks: ['Spellcast_Shoot'], classId: 4, pickGroup: 'summoner' },
  { id: 'cook', names: ['Cozinheira', 'Chef de Campanha', 'Mestra do Banquete'], desc: 'Tortas e marmitas que curam e dão ânimo.', ability: 'Torta quente', color: ['#ffd9a0', '#d9803a'],
    use: [], stats: { Vida: 3, Força: 2, Rapidez: 3, Alcance: 4 }, model: 'Barbarian', hp: 185, dmg: 11, range: 5.5, speed: 3, cooldown: 1.2, ranged: true, attacks: ['Throw'], classId: 4, pickGroup: 'cook' },
  { id: 'shaman', names: ['Xamã', 'Guardião dos Totens', 'Voz dos Ancestrais'], desc: 'Planta totens que curam e seguram a horda.', ability: 'Totem de cura', color: ['#8fe6b8', '#3f9a72'],
    model: 'Barbarian', use: [], stats: { Vida: 3, Força: 2, Rapidez: 3, Alcance: 4 }, hp: 185, dmg: 14, range: 6, speed: 3, cooldown: 1.2, ranged: true, attacks: ['Spellcast_Shoot'], classId: 4, pickGroup: 'shaman' },
  // ladino frágil que protege pelas cópias: provoca com imagens ilusórias (class Illusion) e some do golpe com a Miragem
  { id: 'illusionist', names: ['Ilusionista', 'Mestre dos Espelhos', 'Senhor das Miragens'], desc: 'Cópias ilusórias atraem os golpes.', ability: 'Cópia ilusória', color: ['#d8c4ff', '#8a5ad8'],
    use: ['Knife'], stats: { Vida: 2, Força: 2, Rapidez: 4, Alcance: 1 }, model: 'Rogue_Hooded', hp: 190, dmg: 15, range: 1.4, speed: 3.6, cooldown: 0.75, classId: 3 },
].map((v) => ({ ...HEROES[v.classId], ...v, name: v.names[0],
  // quem herda o respiro padrão alterna entre os dois idles do pacote (Idle_A/Idle_B), para o grupo parado não respirar em coro
  ...(!v.idle && HEROES[v.classId].idle === 'Idle' && v.id.length % 2 && { idle: 'Idle_B' }),
  hide: v.recipe ? [] : HEROES[v.classId].weapons.filter((w) => !v.use.includes(w)),
}));


// abas temáticas do seletor (o classId de combate não muda); a ordem dos ids é a ordem dos cartões
export const PICK_GROUPS = [
  { id: 'guerreiros', name: 'Guerreiros', icon: '♜', heroes: ['paladin', 'guardian', 'champion', 'king', 'brute', 'lancer'] },
  { id: 'barbaros', name: 'Bárbaros', icon: '⚒', heroes: ['berserker', 'crusher', 'viking', 'iceviking', 'monk', 'beast_tamer'] },
  { id: 'magos', name: 'Magos', icon: '✦', heroes: ['pyro', 'arcane', 'cryo', 'necro', 'chronist', 'oracle', 'summoner', 'geomancer'] },
  { id: 'ladinos', name: 'Ladinos', icon: '☾', heroes: ['assassin', 'duelist', 'ninja', 'crossbow', 'archer', 'engineer', 'illusionist', 'bard'] },
  { id: 'suporte', name: 'Suporte', icon: '✚', heroes: ['druid', 'cleric', 'angel', 'alchemist', 'vampire', 'cook', 'shaman', 'runic'] },
];


export const POSTS = [[0, -1.2], [-1.7, 0], [1.7, 0], [0, 1.7]];


// Na câmara final, postos compactos se sobrepõem à separação física dos heróis;
// a equipe ficava presa em `advance` antes do primeiro spawn.
export const CASTLE_POSTS = [[-4, -3], [4, -3], [-4, 3], [4, 3]];


export const SKELETONS = {
  Crossbow: { model: 'Rogue', hp: 34, dmg: 7, range: 10, speed: 0, cooldown: 2.3, weapon: 'Skeleton_Crossbow', ranged: true, attack: '2H_Ranged_Shoot' },
  Mage: { model: 'Mage', hp: 40, dmg: 9, range: 10, speed: 0, cooldown: 2.8, weapon: 'Skeleton_Staff', ranged: true, attack: 'Spellcast_Shoot' },
  Minion:  { hp: 36, dmg: 6,  range: 1.3, speed: 1.6, cooldown: 1.4, weapon: 'Skeleton_Blade',
    attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'] },
  Warrior: { hp: 80, dmg: 11, range: 1.4, speed: 1.3, cooldown: 1.6, weapon: 'Skeleton_Axe', shield: 'Skeleton_Shield_Small_A',
    attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', 'Block_Attack'] },   // às vezes bate com o escudo
  Rogue:   { hp: 30, dmg: 8,  range: 1.3, speed: 2.3, cooldown: 1.1, weapon: 'Skeleton_Blade', move: 'Running_C',
    attacks: ['1H_Melee_Attack_Stab', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'] },
};
Object.assign(SKELETONS, MONSTER_TYPES);   // escudeiro, bombardeiro, sacerdote, fantasma, golem e chefes (monsters.js)



// Dificuldades: multiplicam vida/dano dos esqueletos, tamanho e ritmo das ondas e força do chefe;
// heal = cura ao vencer a fase, revive = vida de quem volta, reviveDelay = fases que o caído espera,
// behind/behindFrom = chance e fase mínima de virem por trás, shooters = chance de um atirador na estrada.
export const DIFFICULTIES = [
  { id: 'facil', name: 'Fácil', icon: '❀', desc: 'Um passeio pelo reino.', color: ['#cdf0b4', '#6aa84f'],
    hp: 0.8, dmg: 0.77, count: 0.9, interval: 1.2, boss: 0.72, heal: 0.6, revive: 0.5, reviveDelay: 0, behind: 0.15, behindFrom: 5, shooters: 0 },
  { id: 'normal', name: 'Normal', icon: '⚔︎', desc: 'Os esqueletos vêm com tudo.', color: ['#bfe0ff', '#5a8fd0'],
    hp: 1, dmg: 1, count: 1, interval: 1, boss: 1, heal: 0.2, revive: 0.25, reviveDelay: 0, behind: 0.3, behindFrom: 4, shooters: 0.07 },
  { id: 'dificil', name: 'Difícil', icon: '♜', desc: 'Escolha bem cada herói.', color: ['#ffd29e', '#d17a2a'],
    hp: 1.1, dmg: 1.08, count: 1.15, interval: 0.92, boss: 1.1, heal: 0.15, revive: 0.25, reviveDelay: 0, behind: 0.35, behindFrom: 3, shooters: 0.08 },
  { id: 'pesadelo', name: 'Pesadelo', icon: '☠︎', desc: 'Caídos só voltam uma fase depois.', color: ['#f3b1c0', '#a3324a'],
    hp: 1.18, dmg: 1.14, count: 1.25, interval: 0.86, boss: 1.15, heal: 0.15, revive: 0.25, reviveDelay: 1, behind: 0.45, behindFrom: 2, shooters: 0.15 },
];
