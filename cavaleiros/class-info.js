// Informações compartilhadas pela seleção e pelo painel de combate.
export const CLASSES = [
  { name: 'Cavaleiro', role: 'Proteção e combate próximo', summary: 'Segura a linha de frente, protege aliados e interrompe avanços.' },
  { name: 'Bárbaro', role: 'Pressão e impacto', summary: 'Combina muita vida com golpes fortes, atordoamentos e machados.' },
  { name: 'Mago', role: 'Magia à distância', summary: 'Ataca de longe com fogo, raios, gelo, invocações e magia do tempo.' },
  { name: 'Ladino', role: 'Agilidade e precisão', summary: 'Elimina alvos, perfura filas e ataca de ângulos diferentes.' },
  { name: 'Suporte', role: 'Cura e reforço do grupo', summary: 'Mantém os aliados na luta com cura, proteção, inspiração e a força da natureza.' },
];

const VARIANT_INFO = {
  paladin: ['Cura em área', 'Cura a si e aos heróis feridos próximos e fere de leve os inimigos colados nele. Só usa a habilidade quando alguém ao alcance precisa de vida.', 'Mantenha o grupo próximo para aproveitar a cura. Combine com um aliado que receba os golpes.'],
  guardian: ['Tanque e provocação', 'Provoca inimigos próximos com uma pancada de escudo, interrompe seus golpes preparados e reduz o dano recebido enquanto a guarda está ativa.', 'Use quando vários inimigos cercarem o grupo; protege os aliados mais frágeis atraindo a atenção.'],
  champion: ['Dano e afastamento', 'Gira a espada, causa dano aos inimigos próximos e os empurra para longe.', 'Funciona melhor cercado por vários inimigos. O empurrão abre espaço para os atiradores.'],
  king: ['Apoio ofensivo', 'Fortalece todos os heróis vivos, aumentando o dano do grupo por alguns segundos.', 'Ganha valor com um grupo completo. Ative antes de uma sequência de ataques ou contra chefes.'],
  berserker: ['Ataques rápidos', 'Entra em fúria e acelera seus ataques por alguns segundos.', 'Use contra inimigos resistentes para aproveitar toda a duração. Cura e proteção ajudam a mantê-lo lutando.'],
  crusher: ['Atordoamento em área', 'Salta para a frente e golpeia os inimigos próximos no arco à sua frente, causando dano e atordoamento.', 'Encare um grupo antes de usar. O atordoamento interrompe golpes preparados e dá tempo para os aliados atacarem.'],
  viking: ['Golpe à distância', 'Lança um machado que causa dano aumentado a um alvo entre 2 e 9 metros.', 'Luta de perto com ataques comuns; o machado alcança inimigos afastados. Não dispara contra alvos colados nele.'],
  iceviking: ['Dano e lentidão', 'Lança um machado glacial contra um alvo entre 2 e 9 metros. O impacto causa dano em área e deixa os inimigos lentos.', 'Prefira grupos afastados. A lentidão ajuda o grupo a enfrentar menos inimigos de cada vez.'],
  pyro: ['Dano em área', 'Lança uma bola de fogo que explode e deixa chamas no chão, causando dano contínuo aos inimigos na área.', 'Combine com lentidão, raízes ou atordoamento para manter inimigos sobre as chamas.'],
  arcane: ['Dano em cadeia', 'Dispara um raio que salta entre inimigos próximos, sem atingir o mesmo alvo duas vezes na mesma cadeia.', 'Prefira grupos compactos. Inimigos muito separados interrompem a sequência de saltos.'],
  cryo: ['Controle à distância', 'Dispara gelo que causa dano em área e aplica lentidão aos inimigos atingidos.', 'Use antes de os inimigos alcançarem os atiradores. Combina com fogo e outros ataques em área.'],
  necro: ['Invocação de aliados', 'Invoca dois esqueletos temporários que lutam pelo grupo. Uma nova invocação substitui os anteriores.', 'Invoque no começo do confronto para aproveitar o tempo dos aliados. Eles não ocupam vagas de herói.'],
  assassin: ['Explosão de dano', 'Avança pelas sombras até um alvo próximo e desfere uma estocada de dano elevado. Também pode causar críticos e esquivar.', 'Escolha para eliminar alvos importantes. Precisa de um inimigo próximo e em altura semelhante para saltar.'],
  crossbow: ['Tiro perfurante', 'Dispara um virote que atravessa os inimigos em linha, atingindo cada um uma vez.', 'Aproveite inimigos enfileirados na estrada. O tiro segue reto e não acompanha mudanças de direção.'],
  duelist: ['Cortes rápidos', 'Desfere quatro cortes seguidos no inimigo à frente, alternando as duas espadas curtas.', 'Fique colado nos inimigos. A técnica atravessa filas e a ultimate brilha quando o Duelista está cercado.'],
  ninja: ['Ataque em leque', 'Lança três adagas em direções diferentes. Cada adaga acerta o primeiro inimigo que encontrar.', 'Prefira grupos espalhados à frente. O leque cobre mais espaço, mas pode deixar passar alvos isolados.'],
  druid: ['Raízes e cura', 'Prende inimigos próximos com raízes e cura a si e aos heróis na área. Precisa de inimigos próximos para ativar.', 'Combine com ataques em área. As raízes impedem movimento, mas os inimigos ainda podem atacar ao alcance.'],
  cleric: ['Cura e proteção', 'Uma oração recupera a vida dos aliados próximos e deixa os feridos com uma breve proteção.', 'Fique perto do grupo. A técnica e a ultimate da clériga também ajudam contra grandes ondas.'],
  bard: ['Apoio e ritmo', 'Toca um acorde que aumenta a velocidade de ataque do grupo por alguns segundos.', 'Acelere os aliados antes de uma onda ou chefe. O efeito também ajuda personagens de ataque lento.'],
  angel: ['Dano e amparo', 'Desce em uma explosão de luz, fere inimigos ao redor e cura aliados próximos.', 'Aproxime-se de um grupo cercando os heróis para aproveitar o impacto e o auxílio.'],
  chronist: ['Controle temporal', 'Cria um campo que prende inimigos próximos e interrompe o avanço deles.', 'Use quando vários inimigos se aproximarem; a ultimate amplia o controle para uma grande área.'],
  archer: ['Tiro longo', 'Dispara uma flecha longa que atravessa todos os inimigos da linha, bem além do alcance comum.', 'Fique atrás da linha de frente. Marque o chefe com a ultimate para o grupo inteiro bater mais forte.'],
  monk: ['Combos e cura', 'Desfere quatro socos rápidos no inimigo à frente e termina com um chute que atordoa.', 'Fique colado nos inimigos. A palma abre espaço e a meditação salva o grupo quando a vida aperta.'],
  alchemist: ['Poções e controle', 'Arremessa um frasco: o tônico cura quem pisa na poça; sem feridos, o veneno fere os inimigos aos poucos.', 'Deixe as poças onde a briga acontece. A transmutação desarma hordas de inimigos comuns.'],
  engineer: ['Construção e controle', 'Monta uma torre por alguns segundos. Ela escolhe ameaças próximas e dispara automaticamente; o pulso eletromagnético interrompe inimigos agrupados.', 'Posicione a torre perto da frente sem deixá-la exposta. A ultimate acelera e fortalece uma torre ativa; sem uma, ergue outra.'],
  beast_tamer: ['Invocação e proteção', 'Chama uma fera temporária que luta perto do grupo e prioriza inimigos que ameaçam os aliados.', 'O rugido da fera atrai a atenção dos inimigos; a ultimate a fortalece e ampara aliados ao redor. A fera não ocupa uma vaga de herói.'],
  summoner: ['Invocação e cura', 'Invoca uma fada que segue o aliado mais ferido e o cura em pulsos por alguns segundos.', 'O golem provoca e atordoa quem chega perto; o dragãozinho cospe fogo em cone. Uma criatura de cada tipo; chamar de novo renova.'],
  oracle: ['Previsão e interrupção', 'Dispara um estilhaço que causa dano extra e cancela o aviso de um golpe de chefe.', 'Use Passo Previsto durante um aviso para garantir que os heróis tentem escapar. Destino Reescrito interrompe ameaças próximas.'],
  brute: ['Tanque pesado', 'Soca o chão: atordoa por instantes e provoca quem está em volta. Golpes fracos quase não o ferem (−3 por golpe).', 'Deixe-o na frente contra hordas. Mais lento e com menos dano que o Guardião, mas aguenta mais.'],
};

const TEAM_ROLE_RULES = {
  paladin: ['Defesa', 'Cura'], guardian: ['Defesa', 'Controle'], champion: ['Defesa', 'Área', 'Dano a chefe'], king: ['Defesa', 'Dano a chefe'],
  berserker: ['Defesa', 'Área', 'Dano a chefe'], crusher: ['Defesa', 'Controle', 'Área', 'Dano a chefe'],
  viking: ['Defesa', 'Dano a chefe'], iceviking: ['Defesa', 'Controle', 'Área'],
  pyro: ['À distância', 'Área'], arcane: ['À distância', 'Área'], cryo: ['À distância', 'Controle', 'Área'],
  assassin: ['Dano a chefe'], crossbow: ['À distância', 'Dano a chefe'], ninja: ['Área'], duelist: ['Área', 'Dano a chefe'], necro: ['À distância'],
  druid: ['À distância', 'Controle', 'Cura'], cleric: ['À distância', 'Cura'], bard: ['À distância', 'Dano a chefe'],
  angel: ['À distância', 'Cura', 'Área'], chronist: ['À distância', 'Controle'],
  archer: ['À distância', 'Área', 'Dano a chefe'], monk: ['Defesa', 'Controle', 'Cura'], alchemist: ['À distância', 'Cura', 'Controle'],
  engineer: ['À distância', 'Área', 'Controle'], beast_tamer: ['Defesa', 'Controle', 'Dano a chefe'], oracle: ['À distância', 'Controle', 'Dano a chefe'],
  brute: ['Defesa', 'Controle'],
  summoner: ['À distância', 'Cura', 'Controle'],
};
const TEAM_ROLE_ORDER = ['Defesa', 'Cura', 'Área', 'Controle', 'À distância', 'Dano a chefe'];
const TEAM_CORE_ROLES = TEAM_ROLE_ORDER.filter((name) => name !== 'Dano a chefe');
const MISSION_ROLE_NEEDS = {
  win: ['Defesa', 'Cura'],
  escort: ['Defesa', 'Cura', 'Controle'],
  defend: ['Defesa', 'Cura', 'Controle'],
  breach: ['Defesa', 'Cura', 'Dano a chefe'], // dano focado elimina corredores antes que cruzem a ponte
  boss: ['Defesa', 'Cura', 'Dano a chefe'],
  survive: ['Defesa', 'Cura', 'Área', 'Controle'],
  duel: ['Defesa', 'Cura'],
  hunt: ['Defesa', 'Controle', 'Dano a chefe'],
  rescue: ['Defesa', 'Cura', 'Área'],
  totems: ['À distância', 'Área', 'Cura'], // quebrar os totens cedo e sustentar o cerco; controle é útil, mas não essencial
  tower: ['À distância', 'Controle', 'Área'],
  nofall: ['Defesa', 'Cura', 'Controle'],
  timer: ['À distância', 'Área', 'Cura'],
  endless: ['Defesa', 'Cura', 'Área', 'Controle'],
  elite: ['Defesa', 'Cura', 'Área', 'Dano a chefe'],
  twin: ['Defesa', 'Cura', 'Dano a chefe'],
  bosses: ['Defesa', 'Cura', 'Dano a chefe', 'Controle'],
};

export function missionRoleNeeds(goal) {
  return [...(MISSION_ROLE_NEEDS[goal?.type] || [])];
}

// Resume o que a equipe cobre para orientar escolhas sem bloquear composições livres.
export function teamCoverage(configs) {
  const members = Array.from(configs || []).filter((cfg) => cfg && cfg.id);
  const roles = TEAM_ROLE_ORDER.map((name) => ({
    name,
    count: members.filter((cfg) => TEAM_ROLE_RULES[cfg.id]?.includes(name)).length,
  }));
  return {
    members: members.map((cfg) => cfg.name),
    roles,
    missing: roles.filter((role) => TEAM_CORE_ROLES.includes(role.name) && role.count === 0).map((role) => role.name),
  };
}

export function heroInfo(cfg) {
  const [role, skill, tip] = VARIANT_INFO[cfg.id];
  return { ...CLASSES[cfg.classId], role, skill, tip };
}

export function skillCooldown(id, level = 1, rate = 1) {
  return (({ necro: 12, beast_tamer: 12, engineer: 10, oracle: 8, king: 10, berserker: 10, guardian: 9, paladin: 8, assassin: 7, cleric: 9, bard: 10, angel: 10, chronist: 8, brute: 8, summoner: 14 }[id] ?? 6) - (level - 1) * 0.7) * rate;
}
