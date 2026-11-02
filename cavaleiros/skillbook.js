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
    { name: 'Marca de Provocação', description: 'Atrai inimigos próximos e interrompe seus golpes.', effect: 'taunt', cooldown: 19, radius: 6, duration: 5 },
    { name: 'Fortaleza', description: 'Cria uma proteção reforçada e chama os inimigos para si.', effect: 'bastion', cooldown: 66, radius: 7, duration: 7 },
    { name: 'Investida de Escudo', description: 'Avança de escudo erguido até um inimigo, atordoa e empurra quem estiver perto do impacto.', effect: 'shield-rush', targeting: 'enemy', cooldown: 17, range: 7, radius: 2.2, power: 1.2, control: 'stun', color: 0x9fcfff },
  ],
  champion: [
    { name: 'Investida', description: 'Avança contra um alvo e o golpeia com força.', effect: 'charge', cooldown: 18, power: 1.6 },
    { name: 'Lâmina Solar', description: 'Gira em uma tempestade de cortes que empurra a horda.', effect: 'storm', cooldown: 60, radius: 6, power: 2.5, control: 'push' },
    { name: 'Desafio do Campeão', description: 'Desafia o inimigo mais forte: ele só ataca o Campeão, que ganha dano e defesa durante o duelo.', effect: 'duel-challenge', targeting: 'enemy', cooldown: 18, range: 8, duration: 5, bonus: 0.3, color: 0xffe59b },
  ],
  king: [
    { name: 'Ordem Real', description: 'Aumenta o dano dos heróis por vários segundos.', effect: 'rally', cooldown: 22, duration: 8, bonus: 0.25 },
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
    { name: 'Onda de Brasas', description: 'Uma explosão de fogo atinge vários inimigos próximos.', effect: 'burst', cooldown: 23, radius: 5, power: 1.7, control: 'burn', color: 0xff7738 },
    { name: 'Meteoro', description: 'Invoca um meteoro que incendeia uma grande área.', effect: 'meteor', cooldown: 66, radius: 6.5, power: 3, color: 0xff542e },
    { name: 'Muralha de Fogo', description: 'Ergue uma linha de chamas na frente dos inimigos que queima quem a atravessa.', effect: 'fire-wall', targeting: 'ground', cooldown: 18, range: 8, radius: 1.1, pulse: 0.22, duration: 4, color: 0xff7738 },
  ],
  arcane: [
    { name: 'Descarga Astral', description: 'Um raio salta entre vários inimigos.', effect: 'chain', cooldown: 20, power: 1.5, jumps: 4, color: 0xb68aff },
    { name: 'Convergência', description: 'Uma tempestade arcana atinge toda a área próxima.', effect: 'storm', cooldown: 64, radius: 7, power: 2.6, color: 0xa46cff },
    { name: 'Translocação', description: 'Teleporta-se para longe de quem o encurrala e deixa uma explosão arcana no lugar de onde saiu.', effect: 'blink', cooldown: 17, range: 6, radius: 2.6, power: 1.3, control: 'slow', color: 0xb68aff },
  ],
  cryo: [
    { name: 'Armadura de Gelo', description: 'Protege o grupo e congela quem se aproxima.', effect: 'frost-ward', cooldown: 21, radius: 4.5, duration: 5, color: 0x9deaff },
    { name: 'Nevasca', description: 'Uma nevasca prende e fere os inimigos em grande área.', effect: 'blizzard', cooldown: 68, radius: 6.5, power: 2.1, control: 'root', color: 0x9deaff },
    { name: 'Lança de Gelo', description: 'Uma lança atravessa a fila; inimigos já lentos ou presos se estilhaçam e sofrem o dobro.', effect: 'ice-lance', targeting: 'enemy', cooldown: 17, range: 9, power: 1, color: 0x9deaff },
  ],
  assassin: [
    { name: 'Dança Sombria', description: 'Desaparece e ataca o inimigo prioritário pelas costas.', effect: 'shadow', cooldown: 18, power: 2.8 },
    { name: 'Execução', description: 'Um golpe crítico concentra todo o dano em um alvo.', effect: 'execute', cooldown: 62, power: 4.8 },
    { name: 'Lâmina Envenenada', description: 'Arremessa uma adaga envenenada: o veneno corrói o alvo por vários segundos.', effect: 'poison-blade', targeting: 'enemy', cooldown: 17, range: 7, power: 0.8, duration: 6, color: 0x9cff5a },
  ],
  crossbow: [
    { name: 'Rajada Perfurante', description: 'Dispara uma sequência rápida de virotes.', effect: 'volley', cooldown: 20, power: 1.2, shots: 4 },
    { name: 'Chuva de Virotes', description: 'Uma salva atinge os inimigos espalhados pela área.', effect: 'arrow-rain', cooldown: 64, radius: 8, power: 1.9, shots: 6 },
    { name: 'Virote Arpão', description: 'Fisga um inimigo distante, puxa-o para perto da linha de frente e o prende no lugar.', effect: 'harpoon', targeting: 'enemy', cooldown: 17, range: 9, minRange: 3, power: 1.2, duration: 1.6, control: 'root', color: 0xc9eaa4 },
  ],
  ninja: [
    { name: 'Bomba de Fumaça', description: 'Some em fumaça e atinge um alvo próximo.', effect: 'shadow', cooldown: 21, power: 1.7, color: 0x9daaff },
    { name: 'Dança dos Fantasmas', description: 'Cortes velozes atingem todos os inimigos ao redor.', effect: 'shadow-storm', cooldown: 62, radius: 5, power: 2.3, color: 0x9daaff },
    { name: 'Shuriken Gigante', description: 'Uma shuriken enorme corta a fila na ida e na volta; contra um inimigo isolado, causa 25% mais dano.', effect: 'giant-shuriken', targeting: 'enemy', cooldown: 17, range: 8, power: 0.9, color: 0x9daaff },
  ],
  duelist: [
    { name: 'Corte em X', description: 'Avança em linha reta e corta em X todos os inimigos no caminho; contra um inimigo isolado, causa 25% mais dano.', effect: 'cross-dash', cooldown: 19, radius: 6.5, range: 6.5, power: 1.6, color: 0xc9d4e2 },
    { name: 'Dança de Lâminas', description: 'Gira por alguns segundos cortando todos ao redor e desviando de parte dos golpes.', effect: 'blade-dance', cooldown: 62, radius: 3.5, power: 2.6, duration: 3, color: 0xc9d4e2 },
    { name: 'Contra-ataque', description: 'Assume a guarda: apara todos os golpes por instantes e devolve um corte a cada ataque corpo a corpo.', effect: 'riposte', cooldown: 18, radius: 3, duration: 2.5, power: 1.4, color: 0xc9d4e2 },
  ],
  necro: [
    { name: 'Escudo Ósseo', description: 'Reveste o grupo com uma barreira de ossos.', effect: 'ward', cooldown: 24, duration: 6, color: 0x73d97e },
    { name: 'Exército dos Mortos', description: 'Seis esqueletos brotam da terra em círculo; a onda de ossos empurra e atordoa de leve quem está perto.', effect: 'summon', cooldown: 70, count: 6, radius: 3.6, power: 0.5, color: 0x73d97e },
    { name: 'Drenar Vida', description: 'Suga a vida de até três inimigos e a transfere aos aliados mais feridos.', effect: 'life-drain', cooldown: 18, radius: 7, power: 0.9, leech: 0.6, color: 0x73d97e },
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
    { name: 'Hino dos Campeões', description: 'Aumenta o dano de todo o grupo por vários segundos.', effect: 'rally', cooldown: 72, duration: 11, bonus: 0.3, color: 0xf2c6ff },
    { name: 'Balada da Coragem', description: 'Uma balada encurta a recarga das habilidades dos aliados próximos e os cura um pouco.', effect: 'ballad', cooldown: 18, radius: 8, color: 0xe9a7ff },
  ],
  angel: [
    { name: 'Asas Guardiãs', description: 'Uma barreira celeste protege os aliados próximos.', effect: 'ward', cooldown: 22, duration: 5, color: 0xffe27a },
    { name: 'Julgamento Celeste', description: 'Uma grande tempestade de luz atinge a área ao redor.', effect: 'storm', cooldown: 74, radius: 7.5, power: 2.9, color: 0xffe27a },
    { name: 'Lança Celestial', description: 'Uma lança de luz cai sobre o inimigo mais forte e ampara o aliado mais perto dele.', effect: 'sky-lance', targeting: 'enemy', cooldown: 18, range: 9, power: 1.6, color: 0xffe27a },
  ],
  chronist: [
    { name: 'Fagulha do Instante', description: 'Um raio temporal salta entre vários inimigos.', effect: 'chain', cooldown: 21, power: 1.3, jumps: 4, color: 0x8feaff },
    { name: 'Parada do Tempo', description: 'Prende e fere os inimigos em uma ampla área.', effect: 'blizzard', cooldown: 74, radius: 7, power: 1.9, duration: 3.5, control: 'root', color: 0x8feaff },
    { name: 'Rebobinar', description: 'Volta no tempo a vida dos aliados próximos para como estava três segundos atrás.', effect: 'rewind', cooldown: 18, radius: 9, color: 0x8feaff },
  ],
  archer: [
    { name: 'Chuva de Flechas', description: 'Marca uma área no grupo de inimigos e faz chover flechas sobre ela.', effect: 'arrow-storm', cooldown: 18, radius: 3, range: 9, power: 1.5, color: 0x3fe0b0 },
    { name: 'Flecha do Caçador', description: 'Fere e marca o inimigo mais forte: ele recebe mais dano de todos por alguns segundos.', effect: 'hunter-mark', cooldown: 60, range: 11, power: 2.6, duration: 8, bonus: 0.3, control: 'mark', color: 0x3fe0b0 },
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
    { name: 'Alfa Ancestral', description: 'Fortalece a fera, recupera parte de sua vida e a faz golpear em uma onda de impacto.', effect: 'alpha-beast', cooldown: 70, radius: 5.5, duration: 8, power: 2.1, color: 0xe5ca75 },
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
    { name: 'Fúria do Bestiário', description: 'As criaturas ativas atacam e usam seus poderes 50% mais rápido por 5 s; sem nenhuma, chama uma fada por 6 s.', effect: 'bestiary-fury', cooldown: 18, duration: 5, haste: 0.5, color: 0xff8ad8 },
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
    { name: 'Passo Previsto', description: 'Durante os avisos de chefes, garante que os aliados tentem escapar das áreas anunciadas.', effect: 'oracle-dodge', cooldown: 22, radius: 12, color: 0xc6b4ff },
    { name: 'Destino Reescrito', description: 'Cancela os golpes anunciados por chefes próximos e os atordoa por um breve instante.', effect: 'rewrite-fate', cooldown: 72, radius: 9, duration: 1.1, control: 'stun', color: 0xe3d7ff },
    { name: 'Presságio', description: 'Mostra aos aliados próximos o próximo golpe: cada um esquiva o próximo dano em alguns segundos.', effect: 'omen', cooldown: 18, radius: 9, duration: 5, color: 0xc6b4ff },
  ],
  geomancer: [
    { name: 'Muralha de Pedra', description: 'Ergue uma muralha curta que barra inimigos comuns por alguns segundos e depois desmorona. Chefes não são detidos.', effect: 'geo-wall', targeting: 'ground', cooldown: 18, range: 8, radius: 3, duration: 5, color: 0xb8a888 },
    { name: 'Fúria da Terra', description: 'O chão treme: inimigos comuns caem atordoados, todos levam dano e as rachaduras deixam o terreno lento.', effect: 'geo-quake', cooldown: 66, radius: 6.5, power: 1.5, duration: 4, control: 'stun', color: 0xb8a888 },
    { name: 'Pilar de Pedra', description: 'Um pilar brota sob o inimigo mais forte: fere e prende comuns por instantes; chefes só ficam lentos.', effect: 'rock-pillar', targeting: 'enemy', cooldown: 17, range: 8, power: 1.5, duration: 1.4, control: 'stun', color: 0xb8a888 },
  ],
  illusionist: [
    { name: 'Troca de Lugar', description: 'Troca de lugar com o aliado ameaçado e deixa uma imagem que atrai os inimigos; sem aliado em perigo, salta para trás deixando a imagem.', effect: 'mirror-swap', cooldown: 17, radius: 4.5, range: 9, duration: 3.5, color: 0xb8a8ff },
    { name: 'Salão de Espelhos', description: 'Três imagens cercam o grupo: provocam e confundem os inimigos, que atacam o alvo errado e perdem o golpe.', effect: 'mirror-hall', cooldown: 66, radius: 7, duration: 5, color: 0xc8b8ff },
    { name: 'Miragem', description: 'Uma névoa de miragem cobre os aliados próximos: cada um desvia do próximo golpe nos próximos segundos.', effect: 'mirage', cooldown: 17, radius: 6, duration: 4, color: 0xa8b8ff },
  ],
  brute: [
    { name: 'Arremesso', description: 'Agarra o inimigo comum mais perto e o arremessa no grupo mais denso; a queda fere todos em volta.', effect: 'grab-throw', cooldown: 16, radius: 2.4, range: 8, splash: 2.6, power: 1, color: 0xc9bba2 },
    { name: 'Pele de Pedra', description: 'Cresce por 8 s: recebe 60% menos dano, devolve 30% dos golpes corpo a corpo e provoca quem está em volta.', effect: 'stone-skin', cooldown: 64, radius: 6, duration: 8, color: 0xb8a88a },
    { name: 'Muralha', description: 'Finca-se no chão por 3 s: fica imóvel, recebe metade do dano e bloqueia os projéteis que passam por ele.', effect: 'stone-wall', cooldown: 18, radius: 1.4, range: 9, duration: 3, color: 0xc9bba2 },
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
