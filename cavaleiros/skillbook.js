import { heroInfo, skillCooldown, skillLevel } from './class-info.js';

// Técnica (slot 1), ultimate (slot 2) e uma segunda técnica (slot 3) complementam a assinatura de cada variante.
// Os efeitos compartilham regras de combate, mas mantêm nomes e identidade próprios.
const EXTRA_SKILLS = {
  paladin: [
    { name: 'Escudo da Luz', description: 'Protege os heróis próximos por alguns segundos.', effect: 'ward', cooldown: 20, duration: 4.5 },
    { name: 'Renovação', description: 'Cura o grupo e explode em luz contra os inimigos ao redor.', effect: 'holy-nova', cooldown: 64, radius: 6.5, power: 2.2 },
    { name: 'Juramento', description: 'Jura proteger o aliado mais ferido: assume parte do dano que ele recebe e o cura um pouco.', effect: 'oath-link', cooldown: 18, range: 9, duration: 6, share: 0.4, color: 0xfff0a8 },
  ],
  guardian: [
    { name: 'Escudo Ricochete', description: 'Arremessa o escudo: quica por até 3 inimigos, fere de leve e deixa cada um 2 s com −25% de dano contra aliados.', effect: 'shield-ricochet', cooldown: 19, range: 8, power: 0.6, duration: 2, hops: 3, color: 0x9fcfff },
    { name: 'Fortaleza', description: 'Cria uma proteção reforçada e chama os inimigos para si.', effect: 'bastion', cooldown: 66, radius: 7, duration: 7 },
    { name: 'Investida de Escudo', description: 'Avança de escudo erguido até um inimigo, atordoa e empurra quem estiver perto do impacto.', effect: 'shield-rush', targeting: 'enemy', cooldown: 17, range: 7, radius: 2.2, power: 1.2, control: 'stun', color: 0x9fcfff },
  ],
  champion: [
    { name: 'Investida', description: 'Avança contra um alvo e o golpeia com força.', effect: 'charge', cooldown: 18, power: 1.6 },
    { name: 'Lâmina Solar', description: 'Gira em uma tempestade de cortes que empurra a horda.', effect: 'storm', cooldown: 60, radius: 6, power: 2.5, control: 'push' },
    { name: 'Desafio do Campeão', description: 'Desafia o inimigo mais forte: ele só ataca o Campeão, que ganha dano e defesa durante o duelo.', effect: 'duel-challenge', targeting: 'enemy', cooldown: 18, range: 8, duration: 5, bonus: 0.3, color: 0xffe59b },
  ],
  king: [
    { name: 'Decreto de Marcha', description: 'O grupo anda 20% mais rápido e as recargas das habilidades correm 30% mais depressa por 6 s.', effect: 'march-decree', cooldown: 22, duration: 6, color: 0xffd84a },
    { name: 'Julgamento Dourado', description: 'Uma onda dourada atinge todos os inimigos próximos.', effect: 'storm', cooldown: 64, radius: 7, power: 2.7, color: 0xffd84a },
    { name: 'Édito Real', description: 'Ordena que os inimigos próximos se ajoelhem: comuns ficam atordoados e chefes, lentos.', effect: 'royal-edict', cooldown: 18, radius: 6.5, power: 0.6, duration: 3, color: 0xffd84a },
  ],
  berserker: [
    { name: 'Corte Sangrento', description: 'Salta sobre um inimigo e desfere um golpe devastador.', effect: 'charge', cooldown: 18, power: 1.9 },
    { name: 'Fúria Titânica', description: 'Explode em uma onda de força ao redor do Berserker.', effect: 'storm', cooldown: 62, radius: 6, power: 2.8, control: 'push', color: 0xff4a42 },
    { name: 'Sede de Sangue', description: 'Por alguns segundos, cada golpe do Berserker recupera parte do dano causado.', effect: 'bloodthirst', cooldown: 18, radius: 3.5, duration: 6, leech: 0.3, color: 0xff4a42 },
  ],
  crusher: [
    { name: 'Onda Sísmica', description: 'Abala o chão e atordoa os inimigos próximos.', effect: 'burst', cooldown: 22, radius: 4.8, power: 1.5, control: 'stun', color: 0xffb060 },
    { name: 'Cataclismo', description: 'Uma ruptura sísmica atinge a área inteira e interrompe ataques.', effect: 'storm', cooldown: 66, radius: 7, power: 2.7, control: 'stun', color: 0xff8a30 },
    { name: 'Rocha Arremessada', description: 'Arranca uma rocha do chão e a lança num inimigo distante; o impacto fere e atordoa ao redor.', effect: 'boulder', targeting: 'ground', cooldown: 18, range: 10, minRange: 2.5, radius: 2.2, power: 1.5, control: 'stun', color: 0xb08a5a },
  ],
  viking: [
    { name: 'Lançamento Duplo', description: 'Arremessa uma sequência de machados contra o alvo.', effect: 'volley', cooldown: 20, power: 1.25, shots: 3 },
    { name: 'Tempestade de Machados', description: 'Uma saraivada de machados busca vários inimigos.', effect: 'volley-storm', cooldown: 62, radius: 8, power: 1.7, shots: 7 },
    { name: 'Brado Nórdico', description: 'Um grito de guerra assusta os inimigos próximos: eles recuam, ficam lentos e perdem o golpe preparado.', effect: 'war-cry', cooldown: 18, radius: 5.5, duration: 2.5, control: 'slow', color: 0xb8dfe5 },
  ],
  iceviking: [
    { name: 'Avalanche', description: 'Um impacto glacial fere e desacelera um grupo.', effect: 'burst', cooldown: 23, radius: 4.5, power: 1.6, control: 'slow', color: 0x91eaff },
    { name: 'Era Glacial', description: 'Congela uma grande área e causa dano a todos nela.', effect: 'blizzard', cooldown: 68, radius: 6.5, power: 2.2, control: 'root', color: 0x9cecff },
    { name: 'Pele de Gelo', description: 'Cobre-se de gelo: recebe menos dano e quem o golpeia de perto fica lento e se fere.', effect: 'ice-skin', cooldown: 18, radius: 3.5, duration: 6, power: 0.4, color: 0x9cecff },
  ],
  pyro: [
    { name: 'Combustão', description: 'Detona na hora toda queimadura do campo (dano restante +25%) e incendeia os 3 inimigos mais próximos do alvo.', effect: 'combustion', targeting: 'enemy', cooldown: 20, range: 9, radius: 6, control: 'burn', color: 0xff7738 },
    { name: 'Meteoro', description: 'Invoca um meteoro que incendeia uma grande área.', effect: 'meteor', cooldown: 66, radius: 6.5, power: 3, color: 0xff542e },
    { name: 'Muralha de Fogo', description: 'Ergue uma linha de chamas na frente dos inimigos que queima quem a atravessa.', effect: 'fire-wall', targeting: 'ground', cooldown: 18, range: 8, radius: 1.1, pulse: 0.22, duration: 4, color: 0xff7738 },
  ],
  arcane: [
    { name: 'Descarga Astral', description: 'Um raio salta entre vários inimigos.', effect: 'chain', cooldown: 20, power: 1.5, jumps: 4, color: 0xb68aff },
    { name: 'Colapso Gravitacional', description: 'Puxa para um ponto os inimigos em volta do alvo, atordoa por 0,8 s e fere em área. Chefe só fica lento.', effect: 'gravity-collapse', targeting: 'enemy', cooldown: 64, range: 9, radius: 7, power: 2, duration: 0.8, control: 'stun', color: 0xa46cff },
    { name: 'Eco Arcano', description: 'Deixa um eco que repete o próximo feitiço do mago, com 60% do dano, no inimigo mais distante.', effect: 'arcane-echo', cooldown: 16, range: 10, power: 0.6, duration: 8, color: 0xb68aff },
  ],
  cryo: [
    { name: 'Geada Cortante', description: 'Por 8 s, os 4 próximos golpes corpo a corpo recebidos por cada aliado próximo congelam o agressor por 1 s (um por aliado a cada 6 s). Chefe só fica lento.', effect: 'frost-guard', cooldown: 20, radius: 8, duration: 8, hits: 4, freeze: 1, color: 0x9deaff },
    { name: 'Tormenta Móvel', description: 'Uma nevasca segue o inimigo mais forte por 5 s: deixa lento, prende por instantes e fere quem a acompanha.', effect: 'storm-cloud', targeting: 'enemy', cooldown: 66, range: 10, radius: 4.5, duration: 5, pulse: 0.24, control: 'root', color: 0x9deaff },
    { name: 'Lança de Gelo', description: 'Uma lança atravessa a fila; inimigos já lentos ou presos se estilhaçam e sofrem o dobro.', effect: 'ice-lance', targeting: 'enemy', cooldown: 17, range: 9, power: 1, color: 0x9deaff },
  ],
  assassin: [
    { name: 'Dança Sombria', description: 'Desaparece e ataca o inimigo prioritário pelas costas.', effect: 'shadow', cooldown: 18, power: 2.8 },
    { name: 'Execução', description: 'Surge atrás do alvo mais forte e o executa num golpe devastador; abaixo de 45% de vida o dano é quase o dobro.', effect: 'execute', cooldown: 62, power: 7.5 },
    { name: 'Lâmina Envenenada', description: 'Arremessa uma adaga envenenada: o veneno corrói o alvo por vários segundos.', effect: 'poison-blade', targeting: 'enemy', cooldown: 17, range: 7, power: 0.8, duration: 6, color: 0x9cff5a },
  ],
  crossbow: [
    { name: 'Rajada Perfurante', description: 'Dispara uma sequência rápida de virotes.', effect: 'volley', range: 9, cooldown: 20, power: 1.2, shots: 4 },
    { name: 'Chuva de Virotes', description: 'Uma salva pesada atinge até 9 inimigos espalhados pela área, ferindo muito e pregando-os no chão: ficam lentos por 2,5 s.', effect: 'arrow-rain', cooldown: 64, radius: 8, power: 3.2, shots: 9 },
    { name: 'Virote Arpão', description: 'Fisga um inimigo distante, puxa-o para perto da linha de frente e o prende no lugar.', effect: 'harpoon', targeting: 'enemy', cooldown: 17, range: 9, minRange: 3, power: 1.2, duration: 1.6, control: 'root', color: 0xc9eaa4 },
  ],
  ninja: [
    { name: 'Bomba de Fumaça', description: 'Some em fumaça e atinge um alvo próximo.', effect: 'shadow', cooldown: 21, power: 1.7, color: 0x9daaff },
    { name: 'Dança dos Fantasmas', description: 'Cortes velozes atingem todos os inimigos ao redor.', effect: 'shadow-storm', cooldown: 62, radius: 5, power: 2.3, color: 0x9daaff },
    { name: 'Shuriken Gigante', description: 'Uma shuriken enorme corta a fila na ida e na volta; contra um inimigo isolado, causa 25% mais dano.', effect: 'giant-shuriken', targeting: 'enemy', cooldown: 17, range: 8, power: 0.9, color: 0x9daaff },
  ],
  duelist: [
    { name: 'Corte em X', description: 'Avança em linha reta e corta em X todos os inimigos no caminho; contra um inimigo isolado, causa 25% mais dano.', effect: 'cross-dash', cooldown: 19, radius: 6.5, range: 6.5, power: 1.6, color: 0xc9d4e2 },
    { name: 'Dança de Lâminas', description: 'Gira por 3 s num redemoinho de aço: corta todos num raio de 5 m, desvia de metade dos golpes e deixa os cortados lentos.', effect: 'blade-dance', cooldown: 62, radius: 5, power: 6.5, duration: 3, color: 0xc9d4e2 },
    { name: 'Desarmar', description: 'Golpeia um inimigo: por 4 s os ataques dele causam 50% menos dano (chefe, 25%).', effect: 'disarm', targeting: 'enemy', control: 'Enfraquece', cooldown: 17, range: 5, power: 1, duration: 4, color: 0xc9d4e2 },
  ],
  necro: [
    { name: 'Pacto de Ossos', description: 'Por 6 s, 30% do dano recebido pelos aliados próximos vira escudo, e cada herói ferido ganha um esqueleto temporário.', effect: 'bone-pact', cooldown: 22, radius: 7, duration: 6, share: 0.3, color: 0x73d97e },
    { name: 'Exército dos Mortos', description: 'Seis esqueletos brotam da terra em círculo; a onda de ossos empurra e atordoa de leve quem está perto.', effect: 'summon', cooldown: 70, count: 6, radius: 3.6, power: 0.5, color: 0x73d97e },
    { name: 'Ceifa', description: 'Marca por 6 s o inimigo mais ferido: se ele morrer, o grupo se cura em 25% da vida máxima dele e o Pacto de Ossos recarrega 3 s mais rápido.', effect: 'reap-mark', targeting: 'enemy', cooldown: 16, range: 9, duration: 6, heal: 0.25, rebate: 3, color: 0x73d97e },
  ],
  druid: [
    { name: 'Crescimento Selvagem', description: 'Raízes prendem inimigos e curam os heróis próximos.', effect: 'roots-heal', cooldown: 23, radius: 5, power: 1.2, color: 0x80d78a },
    { name: 'Espírito Ancestral', description: 'Uma força da floresta cura o grupo e prende os inimigos.', effect: 'nature-storm', cooldown: 68, radius: 7, power: 2, duration: 5, color: 0x80d78a },
    { name: 'Vinhas Espinhosas', description: 'Espinhos brotam sob os inimigos: ferem e deixam lento quem continuar na área.', effect: 'thorn-vines', targeting: 'ground', cooldown: 18, range: 8, radius: 2.6, pulse: 0.18, duration: 5, control: 'slow', color: 0x80d78a },
  ],
  cleric: [
    { name: 'Manto de Misericórdia', description: 'Protege os aliados próximos contra parte do dano recebido.', effect: 'ward', cooldown: 20, duration: 5.5, color: 0xffd676 },
    { name: 'Milagre Radiante', description: 'Uma onda de luz cura o grupo e fere os inimigos próximos.', effect: 'holy-nova', cooldown: 70, radius: 7.5, power: 2.25, color: 0xffe8a3 },
    { name: 'Voto de Proteção', description: 'Por 8 s, o próximo golpe que mataria um aliado próximo (até 8 m) o deixa com 1 de vida. Uma vez por aliado, sem curar.', effect: 'protection-vow', cooldown: 24, range: 8, duration: 8, color: 0xffe8a3 },
  ],
  bard: [
    { name: 'Refrão de Impacto', description: 'Uma batida sonora empurra os inimigos ao redor.', effect: 'burst', cooldown: 21, radius: 5, power: 1.45, control: 'push', color: 0xe9a7ff },
    { name: 'Hino dos Campeões', description: 'Aumenta o dano de todo o grupo por vários segundos.', effect: 'rally', cooldown: 60, duration: 12, bonus: 0.35, color: 0xf2c6ff },
    { name: 'Balada da Coragem', description: 'Uma balada encurta a recarga das habilidades dos aliados próximos e os cura um pouco.', effect: 'ballad', cooldown: 16, radius: 8, color: 0xe9a7ff },
  ],
  angel: [
    { name: 'Asas Guardiãs', description: 'Uma barreira celeste protege os aliados próximos.', effect: 'ward', cooldown: 22, duration: 5, color: 0xffe27a },
    { name: 'Julgamento Celeste', description: 'Uma grande tempestade de luz atinge a área ao redor.', effect: 'storm', cooldown: 74, radius: 7.5, power: 2.9, color: 0xffe27a },
    { name: 'Lança Celestial', description: 'Uma lança de luz cai sobre o inimigo mais forte e ampara o aliado mais perto dele.', effect: 'sky-lance', targeting: 'enemy', cooldown: 18, range: 9, power: 1.6, color: 0xffe27a },
  ],
  chronist: [
    { name: 'Eco Temporal', description: 'O inimigo mais próximo de um herói recebe de volta, 1,5 s depois, o dano que acabou de causar.', effect: 'time-echo', targeting: 'enemy', cooldown: 18, range: 9, duration: 1.5, power: 1.2, color: 0x8feaff },
    { name: 'Parada do Tempo', description: 'O tempo pára numa ampla área: inimigos presos por 3,5 s e feridos, e as recargas das habilidades dos aliados correm 4 s.', effect: 'blizzard', cooldown: 74, radius: 8, power: 3, duration: 3.5, control: 'root', color: 0x8feaff },
    { name: 'Rebobinar', description: 'Volta no tempo a vida dos aliados próximos para como estava três segundos atrás.', effect: 'rewind', cooldown: 18, radius: 9, color: 0x8feaff },
  ],
  archer: [
    { name: 'Chuva de Flechas', description: 'Marca uma área no grupo de inimigos e faz chover flechas sobre ela.', effect: 'arrow-storm', cooldown: 18, radius: 3, range: 9, power: 1.5, color: 0x3fe0b0 },
    { name: 'Flecha do Caçador', description: 'Fere e marca o inimigo mais forte: ele recebe mais dano de todos por alguns segundos.', effect: 'hunter-mark', cooldown: 60, range: 11, power: 3.6, duration: 8, bonus: 0.3, control: 'mark', color: 0x3fe0b0 },
    { name: 'Armadilha', description: 'Arma uma armadilha no caminho dos inimigos: o primeiro que pisar fica preso e ferido.', effect: 'snare-trap', targeting: 'ground', cooldown: 17, range: 9, radius: 1.4, power: 1.4, duration: 2.5, control: 'root', color: 0x3fe0b0 },
  ],
  monk: [
    { name: 'Palma do Vento', description: 'Uma rajada em cone fere, interrompe e empurra os inimigos à frente.', effect: 'wind-palm', cooldown: 17, radius: 5, range: 5, power: 1.8, control: 'push', color: 0xfff2c8 },
    { name: 'Meditação', description: 'Medita imune a dano e cura o grupo próximo por alguns segundos.', effect: 'meditate', cooldown: 64, radius: 6.5, duration: 4, color: 0xffd27a },
    { name: 'Chi Compartilhado', description: 'Transfere parte da própria vida ao aliado mais ferido, que recebe o dobro.', effect: 'chi-transfer', cooldown: 17, range: 8, color: 0xfff2c8 },
  ],
  alchemist: [
    { name: 'Frasco Volátil', description: 'Um frasco explode no grupo de inimigos, empurra e deixa uma poça de veneno.', effect: 'volatile', cooldown: 19, radius: 2.6, range: 7.5, power: 1.4, color: 0x9cff3a },
    { name: 'Grande Transmutação', description: 'Inimigos comuns próximos viram ovelhas por alguns segundos; chefes ficam lentos.', effect: 'transmute', cooldown: 70, radius: 6, duration: 4, control: 'sheep', color: 0xff8ad8 },
    { name: 'Elixir do Gigante', description: 'Lança um elixir no aliado da linha de frente: ele bate mais forte, aguenta mais e se cura.', effect: 'giant-elixir', cooldown: 18, range: 8, duration: 7, bonus: 0.3, color: 0xff8ad8 },
  ],
  engineer: [
    { name: 'Pulso Eletromagnético', description: 'Descarrega energia no alvo e interrompe inimigos próximos.', effect: 'emp-pulse', targeting: 'enemy', cooldown: 20, radius: 3.8, range: 8, power: 1.15, control: 'stun', color: 0x6df4df },
    { name: 'Sobrecarga', description: 'Acelera e fortalece uma torre ativa; se não houver nenhuma, instala uma nova.', effect: 'sentry-overcharge', cooldown: 68, duration: 8, radius: 6, power: 1.7, color: 0x8affeb },
    { name: 'Ímã Magnético', description: 'Um pulso magnético puxa os inimigos próximos para junto da torre (ou à frente) e os deixa lentos.', effect: 'magnet-pull', cooldown: 18, radius: 7, power: 0.5, duration: 1.5, control: 'slow', color: 0x6df4df },
  ],
  beast_tamer: [
    { name: 'Rugido da Matilha', description: 'A fera provoca inimigos próximos e protege os aliados ao redor.', effect: 'pack-roar', cooldown: 21, radius: 6, duration: 4, color: 0xcbb36f },
    { name: 'Caçada em Matilha', description: 'Por 8 s a fera persegue o inimigo mais perigoso com +50% de velocidade e dano; cada mordida o faz sangrar.', effect: 'pack-hunt', cooldown: 70, range: 10, duration: 8, bonus: 0.5, color: 0xe5ca75 },
    { name: 'Comando de Ataque', description: 'A fera salta no inimigo prioritário, morde e o faz sangrar; sem fera, o Domador lança uma rede.', effect: 'sic-em', targeting: 'enemy', cooldown: 17, range: 10, power: 1.4, duration: 4, color: 0xcbb36f },
  ],
  runic: [
    { name: 'Runas de Grupo', description: 'Cada aliado próximo ganha uma runa fraca: absorve pouco dano, mas dura mais.', effect: 'rune-ward', cooldown: 20, radius: 6, duration: 12, color: 0x6fd8e0 },
    { name: 'Cúpula Rúnica', description: 'Uma cúpula de runas por alguns segundos: quem está dentro não cai abaixo de 1 de vida e os inimigos que a tocam são afastados.', effect: 'rune-dome', cooldown: 72, radius: 4.5, duration: 5, control: 'push', color: 0x6fd8e0 },
    { name: 'Pulso Rúnico', description: 'Um pulso afasta e atrasa os inimigos colados e deixa uma runa pequena em quem o lançou.', effect: 'rune-pulse', cooldown: 16, radius: 3.4, duration: 1.5, control: 'push', color: 0x6fd8e0 },
  ],
  summoner: [
    { name: 'Golem', description: 'Um golem de pedra provoca os inimigos próximos e dá pancadas que atordoam.', effect: 'stone-golem', cooldown: 22, radius: 4.5, duration: 15, control: 'stun', color: 0xd8c29a },
    { name: 'Dragãozinho', description: 'Um dragãozinho voa até os inimigos e cospe fogo em cone, deixando-os queimando.', effect: 'little-dragon', cooldown: 68, radius: 4.5, duration: 18, control: 'burn', color: 0xff7a3a },
    { name: 'Slime Saltitante', description: 'Um slime salta sobre o grupo de inimigos mais denso a cada 1,5 s por 9 s: o impacto fere e deixa todos lentos. No fim divide-se em dois slimes pequenos que dão um último pulo.', effect: 'slime-hop', cooldown: 18, radius: 2.2, range: 9, power: 0.5, duration: 9, control: 'slow', color: 0x7be08c },
  ],
  vampire: [
    { name: 'Vínculo de Sangue', description: 'Liga o aliado mais ferido ao mais próximo por alguns segundos: os dois dividem o dano que receberem.', effect: 'blood-bond', cooldown: 18, range: 9, duration: 6, share: 0.5, color: 0xa81c34 },
    { name: 'Eclipse Rubro', description: 'Por 6 s, inimigos comuns abaixo de 30% de vida explodem em sangue ao redor da Vampira e curam os aliados por perto. Chefes resistem.', effect: 'blood-eclipse', cooldown: 65, radius: 10, duration: 6, color: 0x8a1a2e },
    { name: 'Beijo Sombrio', description: 'Morde o inimigo mais perigoso à frente e devolve todo o dano como cura ao aliado mais ferido.', effect: 'blood-kiss', cooldown: 17, range: 6, power: 1.5, color: 0xc8465e },
  ],
  cook: [
    { name: 'Prato do Dia', description: 'Serve um prato a um aliado que está lutando: ataque 25% mais rápido e um escudo curto por alguns segundos.', effect: 'daily-plate', cooldown: 16, range: 8, duration: 6, haste: 0.25, color: 0xffb347 },
    { name: 'Banquete', description: 'Uma mesa farta surge no chão: cura os aliados próximos aos poucos e agiliza as recargas das habilidades.', effect: 'feast', cooldown: 70, radius: 5.5, duration: 6, haste: 0.25, color: 0xffd27a },
    { name: 'Tempero Forte', description: 'Uma pitada de pimenta: aliados próximos batem mais forte por alguns segundos.', effect: 'spice', cooldown: 18, radius: 6, duration: 6, bonus: 0.15, color: 0xff6a3a },
  ],
  shaman: [
    { name: 'Totem de Raízes', description: 'Finca um totem que deixa os inimigos da área lentos e prende os comuns por um instante.', effect: 'root-totem', targeting: 'ground', cooldown: 18, range: 9, radius: 4, duration: 7, control: 'slow', color: 0xc8a050 },
    { name: 'Totem Ancestral', description: 'Traz de volta um herói caído; se ninguém caiu, cura bastante o grupo e dá um escudo.', effect: 'ancestral-totem', cooldown: 72, radius: 7, duration: 6, color: 0xffd866 },
    { name: 'Espírito Acompanhante', description: 'Um espírito segue o aliado mais ferido por 6 s e o cura um pouco a cada segundo.', effect: 'follow-spirit', cooldown: 16, range: 10, duration: 6, color: 0x6fe0a0 },
  ],
  oracle: [
    { name: 'Visão do Alvo', description: 'Por 5 s, aliados próximos ganham +25% de chance de crítico e o inimigo mais frágil fica marcado: recebe +10% de dano de todos.', effect: 'vision-mark', cooldown: 20, radius: 10, duration: 5, bonus: 0.25, mark: 0.1, color: 0xc6b4ff },
    { name: 'Destino Reescrito', description: 'Reescreve os próximos segundos: os golpes dos inimigos próximos são anulados e eles ficam atordoados por 2 s (chefes 1,1 s e lentos), marcados (+15% de dano de todos); os aliados recebem 40% menos dano por 3 s.', effect: 'rewrite-fate', cooldown: 72, radius: 9, duration: 2, control: 'stun', color: 0xe3d7ff },
    { name: 'Presságio', description: 'Mostra aos aliados próximos o próximo golpe: cada um esquiva o próximo dano em alguns segundos.', effect: 'omen', cooldown: 18, radius: 9, duration: 5, color: 0xc6b4ff },
  ],
  geomancer: [
    { name: 'Muralha de Pedra', description: 'Ergue uma muralha curta que barra inimigos comuns por alguns segundos e depois desmorona. Chefes não são detidos.', effect: 'geo-wall', targeting: 'ground', cooldown: 18, range: 8, radius: 3, duration: 5, color: 0xb8a888 },
    { name: 'Fúria da Terra', description: 'O chão treme: inimigos comuns caem atordoados, todos levam dano e as rachaduras deixam o terreno lento.', effect: 'geo-quake', cooldown: 66, radius: 6.5, power: 1.5, duration: 4, control: 'stun', color: 0xb8a888 },
    { name: 'Pilar de Pedra', description: 'Um pilar brota sob o inimigo mais forte: fere e prende comuns por instantes; chefes só ficam lentos.', effect: 'rock-pillar', targeting: 'enemy', cooldown: 17, range: 8, power: 1.5, duration: 1.4, control: 'stun', color: 0xb8a888 },
  ],
  illusionist: [
    { name: 'Troca de Lugar', description: 'Troca de lugar com o aliado ameaçado e deixa uma imagem que atrai os inimigos; sem aliado em perigo, salta para trás deixando a imagem.', effect: 'mirror-swap', cooldown: 17, radius: 4.5, range: 9, duration: 3.5, color: 0xb8a8ff },
    { name: 'Pânico', description: 'Inimigos comuns perto do alvo passam 3 s atacando o vizinho em vez dos heróis; chefe só desacelera.', effect: 'panic', control: 'Confunde', cooldown: 62, radius: 6.5, range: 9, duration: 3, color: 0xc8b8ff },
    { name: 'Ofuscar', description: 'Inimigos próximos erram 50% dos golpes por 4 s (chefe, 25%).', effect: 'dazzle', control: 'Cega', cooldown: 17, radius: 6, duration: 4, color: 0xa8b8ff },
  ],
  brute: [
    { name: 'Arremesso', description: 'Agarra o inimigo comum mais perto e o arremessa no grupo mais denso; a queda fere todos em volta.', effect: 'grab-throw', cooldown: 16, radius: 2.4, range: 8, splash: 2.6, power: 1, color: 0xc9bba2 },
    { name: 'Pele de Pedra', description: 'Cresce por 8 s: recebe 60% menos dano, devolve 30% dos golpes corpo a corpo e provoca quem está em volta.', effect: 'stone-skin', cooldown: 64, radius: 6, duration: 8, color: 0xb8a88a },
    { name: 'Berro de Guerra', description: 'Por 5 s, o golpe do Brutamontes atordoa 1 s os inimigos colados (até 3 por golpe, cada um 1 vez a cada 3 s). Chefes só desaceleram.', effect: 'war-roar', cooldown: 18, radius: 3.5, duration: 5, color: 0xe0b070 },
  ],
  lancer: [
    { name: 'Postura de Lança', description: 'Por 5 s a lança alcança mais longe; quem chega perto leva dano e fica lento.', effect: 'spear-stance', cooldown: 18, radius: 5, duration: 5, power: 0.3, color: 0xbcd0ff },
    { name: 'Carga da Cavalaria', description: 'Avança em linha pela fila: comuns levam dano e ficam atordoados, chefes só levam dano. Depois volta ao posto.', effect: 'cavalry-charge', cooldown: 62, radius: 2.2, range: 9, power: 1.4, control: 'stun', color: 0x7fa0ff },
    { name: 'Lança Cravada', description: 'Crava a lança num inimigo: fere e prende no chão (chefe só fica lento).', effect: 'pin-spear', targeting: 'enemy', cooldown: 16, radius: 1.2, range: 7, power: 1.3, duration: 2.5, color: 0xffe27a },
  ],
};

export function cooldownForSkill(cfg, slot = 0, level = 1, rate = 1) {
  if (slot === 0) return skillCooldown(cfg.id, level, rate);
  const skill = EXTRA_SKILLS[cfg.id]?.[slot - 1];
  if (!skill) return skillCooldown(cfg.id, level, rate);
  const ultimate = slot === 2;
  const reduction = ultimate ? 2 : 0.8;
  return Math.max(ultimate ? 35 : 9, skill.cooldown - (skillLevel(level) - 1) * reduction) * rate;
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
