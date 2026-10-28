// Informações compartilhadas pela seleção e pelo painel de combate.
export const CLASSES = [
  { name: 'Cavaleiro', role: 'Proteção e combate próximo', summary: 'Luta na linha de frente. As variantes oferecem cura, proteção, controle ou apoio ao grupo.' },
  { name: 'Bárbaro', role: 'Pressão e impacto', summary: 'Combina muita vida com golpes fortes. Pode acelerar ataques, atordoar ou lançar machados.' },
  { name: 'Mago', role: 'Magia à distância', summary: 'Ataca de longe. Escolha entre dano em área, raios em cadeia, lentidão e invocações.' },
  { name: 'Ladino', role: 'Agilidade e especialização', summary: 'Reúne estilos distintos: eliminar alvos, perfurar filas, atacar em leque ou controlar o terreno.' },
];

const VARIANT_INFO = {
  paladin: ['Cura em área', 'Cura a si e aos heróis feridos próximos. Só usa a habilidade quando alguém ao alcance precisa de vida.', 'Mantenha o grupo próximo para aproveitar a cura. Combine com um aliado que receba os golpes.'],
  guardian: ['Tanque e provocação', 'Provoca inimigos próximos, interrompe seus golpes preparados e reduz o dano recebido enquanto a guarda está ativa.', 'Use quando vários inimigos cercarem o grupo; protege os aliados mais frágeis atraindo a atenção.'],
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
  ninja: ['Ataque em leque', 'Lança três adagas em direções diferentes. Cada adaga acerta o primeiro inimigo que encontrar.', 'Prefira grupos espalhados à frente. O leque cobre mais espaço, mas pode deixar passar alvos isolados.'],
  druid: ['Raízes e cura', 'Prende inimigos próximos com raízes e cura a si e aos heróis na área. Precisa de inimigos próximos para ativar.', 'Combine com ataques em área. As raízes impedem movimento, mas os inimigos ainda podem atacar ao alcance.'],
};

export function heroInfo(cfg) {
  const [role, skill, tip] = VARIANT_INFO[cfg.id];
  return { ...CLASSES[cfg.classId], role, skill, tip };
}

export function skillCooldown(id, level = 1, rate = 1) {
  return (({ necro: 12, king: 10, berserker: 10, guardian: 9, paladin: 8, assassin: 7 }[id] ?? 6) - (level - 1) * 0.7) * rate;
}
