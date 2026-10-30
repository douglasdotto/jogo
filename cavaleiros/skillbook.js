import { heroInfo, skillCooldown } from './class-info.js';

// Duas técnicas complementam a habilidade assinatura de cada variante.
// Os efeitos compartilham regras de combate, mas mantêm nomes e identidade próprios.
const EXTRA_SKILLS = {
  paladin: [
    { name: 'Escudo da Luz', description: 'Protege os heróis próximos por alguns segundos.', effect: 'ward', cooldown: 18, duration: 4.5 },
    { name: 'Renovação', description: 'Cura o grupo e explode em luz contra os inimigos ao redor.', effect: 'holy-nova', cooldown: 64, radius: 6.5, power: 2.2 },
  ],
  guardian: [
    { name: 'Marca de Provocação', description: 'Atrai inimigos próximos e interrompe seus golpes.', effect: 'taunt', cooldown: 19, radius: 6, duration: 5 },
    { name: 'Fortaleza', description: 'Cria uma proteção reforçada e chama os inimigos para si.', effect: 'bastion', cooldown: 66, radius: 7, duration: 7 },
  ],
  champion: [
    { name: 'Investida', description: 'Avança contra um alvo e o golpeia com força.', effect: 'charge', cooldown: 18, power: 1.6 },
    { name: 'Lâmina Solar', description: 'Gira em uma tempestade de cortes que empurra a horda.', effect: 'storm', cooldown: 60, radius: 6, power: 2.5, control: 'push' },
  ],
  king: [
    { name: 'Ordem Real', description: 'Aumenta o dano dos heróis por vários segundos.', effect: 'rally', cooldown: 22, duration: 8, bonus: 0.25 },
    { name: 'Julgamento Dourado', description: 'Uma onda dourada atinge todos os inimigos próximos.', effect: 'storm', cooldown: 64, radius: 7, power: 2.7, color: 0xffd84a },
  ],
  berserker: [
    { name: 'Corte Sangrento', description: 'Salta sobre um inimigo e desfere um golpe devastador.', effect: 'charge', cooldown: 18, power: 1.9 },
    { name: 'Fúria Titânica', description: 'Explode em uma onda de força ao redor do Berserker.', effect: 'storm', cooldown: 62, radius: 6, power: 2.8, control: 'push', color: 0xff4a42 },
  ],
  crusher: [
    { name: 'Onda Sísmica', description: 'Abala o chão e atordoa os inimigos próximos.', effect: 'burst', cooldown: 22, radius: 4.8, power: 1.5, control: 'stun', color: 0xffb060 },
    { name: 'Cataclismo', description: 'Uma ruptura sísmica atinge a área inteira e interrompe ataques.', effect: 'storm', cooldown: 66, radius: 7, power: 2.7, control: 'stun', color: 0xff8a30 },
  ],
  viking: [
    { name: 'Lançamento Duplo', description: 'Arremessa uma sequência de machados contra o alvo.', effect: 'volley', cooldown: 20, power: 1.25, shots: 3 },
    { name: 'Tempestade de Machados', description: 'Uma saraivada de machados busca vários inimigos.', effect: 'volley-storm', cooldown: 62, radius: 8, power: 1.7, shots: 7 },
  ],
  iceviking: [
    { name: 'Avalanche', description: 'Um impacto glacial fere e desacelera um grupo.', effect: 'burst', cooldown: 23, radius: 4.5, power: 1.6, control: 'slow', color: 0x91eaff },
    { name: 'Era Glacial', description: 'Congela uma grande área e causa dano a todos nela.', effect: 'blizzard', cooldown: 68, radius: 6.5, power: 2.2, control: 'root', color: 0x9cecff },
  ],
  pyro: [
    { name: 'Onda de Brasas', description: 'Uma explosão de fogo atinge vários inimigos próximos.', effect: 'burst', cooldown: 23, radius: 5, power: 1.7, control: 'burn', color: 0xff7738 },
    { name: 'Meteoro', description: 'Invoca um meteoro que incendeia uma grande área.', effect: 'meteor', cooldown: 66, radius: 6.5, power: 3, color: 0xff542e },
  ],
  arcane: [
    { name: 'Descarga Astral', description: 'Um raio salta entre vários inimigos.', effect: 'chain', cooldown: 20, power: 1.5, jumps: 4, color: 0xb68aff },
    { name: 'Convergência', description: 'Uma tempestade arcana atinge toda a área próxima.', effect: 'storm', cooldown: 64, radius: 7, power: 2.6, color: 0xa46cff },
  ],
  cryo: [
    { name: 'Armadura de Gelo', description: 'Protege o grupo e congela quem se aproxima.', effect: 'frost-ward', cooldown: 21, radius: 4.5, duration: 5, color: 0x9deaff },
    { name: 'Nevasca', description: 'Uma nevasca prende e fere os inimigos em grande área.', effect: 'blizzard', cooldown: 68, radius: 6.5, power: 2.1, control: 'root', color: 0x9deaff },
  ],
  assassin: [
    { name: 'Dança Sombria', description: 'Desaparece e ataca o inimigo prioritário pelas costas.', effect: 'shadow', cooldown: 18, power: 2.8 },
    { name: 'Execução', description: 'Um golpe crítico concentra todo o dano em um alvo.', effect: 'execute', cooldown: 62, power: 4.8 },
  ],
  crossbow: [
    { name: 'Rajada Perfurante', description: 'Dispara uma sequência rápida de virotes.', effect: 'volley', cooldown: 20, power: 1.2, shots: 4 },
    { name: 'Chuva de Virotes', description: 'Uma salva atinge os inimigos espalhados pela área.', effect: 'arrow-rain', cooldown: 64, radius: 8, power: 1.9, shots: 6 },
  ],
  ninja: [
    { name: 'Bomba de Fumaça', description: 'Some em fumaça e atinge um alvo próximo.', effect: 'shadow', cooldown: 21, power: 1.7, color: 0x9daaff },
    { name: 'Dança dos Fantasmas', description: 'Cortes velozes atingem todos os inimigos ao redor.', effect: 'shadow-storm', cooldown: 62, radius: 5, power: 2.3, color: 0x9daaff },
  ],
  duelist: [
    { name: 'Corte em X', description: 'Avança em linha reta e corta em X todos os inimigos no caminho.', effect: 'cross-dash', cooldown: 19, radius: 6.5, range: 6.5, power: 1.6, color: 0xc9d4e2 },
    { name: 'Dança de Lâminas', description: 'Gira por alguns segundos cortando todos ao redor e desviando de parte dos golpes.', effect: 'blade-dance', cooldown: 62, radius: 3.5, power: 2.6, duration: 3, color: 0xc9d4e2 },
  ],
  necro: [
    { name: 'Escudo Ósseo', description: 'Reveste o grupo com uma barreira de ossos.', effect: 'ward', cooldown: 24, duration: 6, color: 0x73d97e },
    { name: 'Exército dos Mortos', description: 'Invoca quatro esqueletos para lutar ao lado do grupo.', effect: 'summon', cooldown: 70, count: 4, color: 0x73d97e },
  ],
  druid: [
    { name: 'Crescimento Selvagem', description: 'Raízes prendem inimigos e curam os heróis próximos.', effect: 'roots-heal', cooldown: 23, radius: 5, power: 1.2, color: 0x80d78a },
    { name: 'Espírito Ancestral', description: 'Uma força da floresta cura o grupo e prende os inimigos.', effect: 'nature-storm', cooldown: 68, radius: 7, power: 2, duration: 5, color: 0x80d78a },
  ],
  cleric: [
    { name: 'Manto de Misericórdia', description: 'Protege os aliados próximos contra parte do dano recebido.', effect: 'ward', cooldown: 20, duration: 5.5, color: 0xffd676 },
    { name: 'Milagre Radiante', description: 'Uma onda de luz cura o grupo e fere os inimigos próximos.', effect: 'holy-nova', cooldown: 70, radius: 7.5, power: 2.25, color: 0xffe8a3 },
  ],
  bard: [
    { name: 'Refrão de Impacto', description: 'Uma batida sonora empurra os inimigos ao redor.', effect: 'burst', cooldown: 21, radius: 5, power: 1.45, control: 'push', color: 0xe9a7ff },
    { name: 'Hino dos Campeões', description: 'Aumenta o dano de todo o grupo por vários segundos.', effect: 'rally', cooldown: 72, duration: 11, bonus: 0.3, color: 0xf2c6ff },
  ],
  angel: [
    { name: 'Asas Guardiãs', description: 'Uma barreira celeste protege os aliados próximos.', effect: 'ward', cooldown: 22, duration: 5, color: 0xffe27a },
    { name: 'Julgamento Celeste', description: 'Uma grande tempestade de luz atinge a área ao redor.', effect: 'storm', cooldown: 74, radius: 7.5, power: 2.9, color: 0xffe27a },
  ],
  chronist: [
    { name: 'Fagulha do Instante', description: 'Um raio temporal salta entre vários inimigos.', effect: 'chain', cooldown: 21, power: 1.3, jumps: 4, color: 0x8feaff },
    { name: 'Parada do Tempo', description: 'Prende e fere os inimigos em uma ampla área.', effect: 'blizzard', cooldown: 74, radius: 7, power: 1.9, duration: 3.5, control: 'root', color: 0x8feaff },
  ],
  archer: [
    { name: 'Chuva de Flechas', description: 'Marca uma área no grupo de inimigos e faz chover flechas sobre ela.', effect: 'arrow-storm', cooldown: 18, radius: 3, range: 9, power: 1.5, color: 0x3fe0b0 },
    { name: 'Flecha do Caçador', description: 'Fere e marca o inimigo mais forte: ele recebe mais dano de todos por alguns segundos.', effect: 'hunter-mark', cooldown: 60, range: 11, power: 2.6, duration: 8, bonus: 0.3, control: 'mark', color: 0x3fe0b0 },
  ],
  monk: [
    { name: 'Palma do Vento', description: 'Uma rajada em cone fere, interrompe e empurra os inimigos à frente.', effect: 'wind-palm', cooldown: 17, radius: 5, range: 5, power: 1.8, control: 'push', color: 0xfff2c8 },
    { name: 'Meditação', description: 'Medita imune a dano e cura o grupo próximo por alguns segundos.', effect: 'meditate', cooldown: 64, radius: 6.5, duration: 4, color: 0xffd27a },
  ],
  alchemist: [
    { name: 'Frasco Volátil', description: 'Um frasco explode no grupo de inimigos, empurra e deixa uma poça de veneno.', effect: 'volatile', cooldown: 19, radius: 2.6, range: 7.5, power: 1.4, color: 0x9cff3a },
    { name: 'Grande Transmutação', description: 'Inimigos comuns próximos viram ovelhas por alguns segundos; chefes ficam lentos.', effect: 'transmute', cooldown: 70, radius: 6, duration: 4, control: 'sheep', color: 0xff8ad8 },
  ],
  engineer: [
    { name: 'Pulso Eletromagnético', description: 'Descarrega energia no alvo e interrompe inimigos próximos.', effect: 'emp-pulse', targeting: 'enemy', cooldown: 20, radius: 3.8, range: 8, power: 1.15, control: 'stun', color: 0x6df4df },
    { name: 'Sobrecarga', description: 'Acelera e fortalece uma torre ativa; se não houver nenhuma, instala uma nova.', effect: 'sentry-overcharge', cooldown: 68, duration: 8, radius: 6, power: 1.7, color: 0x8affeb },
  ],
  beast_tamer: [
    { name: 'Rugido da Matilha', description: 'A fera provoca inimigos próximos e protege os aliados ao redor.', effect: 'pack-roar', cooldown: 21, radius: 6, duration: 4, color: 0xcbb36f },
    { name: 'Alfa Ancestral', description: 'Fortalece a fera, recupera parte de sua vida e a faz golpear em uma onda de impacto.', effect: 'alpha-beast', cooldown: 70, radius: 5.5, duration: 8, power: 2.1, color: 0xe5ca75 },
  ],
  summoner: [
    { name: 'Golem', description: 'Um golem de pedra provoca os inimigos próximos e dá pancadas que atordoam.', effect: 'stone-golem', cooldown: 22, radius: 4.5, duration: 15, control: 'stun', color: 0xd8c29a },
    { name: 'Dragãozinho', description: 'Um dragãozinho voa até os inimigos e cospe fogo em cone, deixando-os queimando.', effect: 'little-dragon', cooldown: 68, radius: 4.5, duration: 18, control: 'burn', color: 0xff7a3a },
  ],
  oracle: [
    { name: 'Passo Previsto', description: 'Durante os avisos de chefes, garante que os aliados tentem escapar das áreas anunciadas.', effect: 'oracle-dodge', cooldown: 22, radius: 12, color: 0xc6b4ff },
    { name: 'Destino Reescrito', description: 'Cancela os golpes anunciados por chefes próximos e os atordoa por um breve instante.', effect: 'rewrite-fate', cooldown: 72, radius: 9, duration: 1.1, control: 'stun', color: 0xe3d7ff },
  ],
};

export function cooldownForSkill(cfg, slot = 0, level = 1, rate = 1) {
  if (slot === 0) return skillCooldown(cfg.id, level, rate);
  const skill = EXTRA_SKILLS[cfg.id]?.[slot - 1];
  if (!skill) return skillCooldown(cfg.id, level, rate);
  const ultimate = slot === 2;
  const reduction = ultimate ? 2 : 0.8;
  return Math.max(ultimate ? 35 : 9, skill.cooldown - (level - 1) * reduction) * rate;
}

// a lista é a mesma durante todo o jogo: monta uma vez por herói (é lida a cada quadro)
const skillSets = new WeakMap();
export function skillSetFor(cfg) {
  if (skillSets.has(cfg)) return skillSets.get(cfg);
  const info = heroInfo(cfg);
  const extras = EXTRA_SKILLS[cfg.id] || [];
  const skills = [
    { slot: 0, name: cfg.ability, description: info.skill, effect: 'primary', ultimate: false },
    ...extras.map((skill, index) => ({ ...skill, slot: index + 1, ultimate: index === 1 })),
  ];
  skillSets.set(cfg, skills);
  return skills;
}
