// Destaques puros para o placar final. Valores de texto devem ser inseridos no
// DOM com textContent (ou escapados antes de entrar em um template HTML).
//
// Esquema:
// buildBattleReport({ won, heroes: [{ name, damage, received, kills }],
//   falls: [{ name, phase, time }],
//   damageSources: [{ name, damage, hits }] })
// `phase` e `time` ordenam as quedas. `time` é o tempo da partida em segundos.
// Os campos numéricos são opcionais; os valores ausentes contam como zero.

const number = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const label = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback;

function firstFall(falls) {
  const entries = Array.isArray(falls) ? falls.filter((fall) => fall && typeof fall === 'object') : [];
  if (!entries.length) return null;

  // Quando há dados de tempo, ordena cronologicamente. Sem tempo, respeita a
  // ordem em que as quedas foram registradas pelo jogo.
  return entries.map((fall, index) => ({ fall, index }))
    .sort((a, b) => {
      const aPhase = number(a.fall.phase), bPhase = number(b.fall.phase);
      if (aPhase !== bPhase) return aPhase - bPhase;
      const aHasTime = Number.isFinite(Number(a.fall.time));
      const bHasTime = Number.isFinite(Number(b.fall.time));
      if (aHasTime && bHasTime && Number(a.fall.time) !== Number(b.fall.time)) return Number(a.fall.time) - Number(b.fall.time);
      if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
      return a.index - b.index;
    })[0].fall;
}

function mostDangerous(sources) {
  const entries = Array.isArray(sources) ? sources.filter((source) => source && typeof source === 'object') : [];
  if (!entries.length) return null;
  return entries.map((source, index) => ({ source, index }))
    .sort((a, b) => number(b.source.damage) - number(a.source.damage)
      || number(b.source.hits) - number(a.source.hits)
      || a.index - b.index)[0].source;
}

function objectiveTip(mission) {
  const goal = mission?.goal;
  if (!goal) return null;
  if (goal.type === 'escort') {
    if (mission.villagerDown) return 'O aldeão caiu. Intercepte inimigos perto dele e leve cura ou provocação para mantê-lo vivo.';
    return 'O grupo caiu antes de concluir a escolta. Reforce a linha de frente e leve cura ou provocação para proteger a equipe e o aldeão.';
  }
  if (goal.type === 'nofall') {
    return 'A missão exige que ninguém caia. Guarde cura, escudo ou controle para salvar o aliado que ficar com pouca vida.';
  }
  if (goal.type === 'rescue' && mission.villagerDown) {
    return mission.rescueComplete
      ? 'A pessoa foi resgatada, mas caiu antes de chegar em segurança. Proteja-a depois de libertá-la.'
      : 'O prisioneiro caiu antes do resgate. Aproxime-se dele e mantenha os esqueletos afastados.';
  }
  if (goal.type === 'rescue' && !mission.rescueComplete) {
    return 'O prisioneiro continua preso. Aproxime-se dele para libertá-lo e mantenha os esqueletos afastados.';
  }
  if (goal.type === 'tower' && number(mission.towersDown) < number(goal.count)) {
    const remaining = Math.max(0, number(goal.count) - number(mission.towersDown));
    return `Faltou derrubar ${remaining === 1 ? 'a torre' : `${remaining} torres`} de ossos. Aproxime os heróis e concentre os ataques nela.`;
  }
  if (goal.type === 'timer' && number(mission.time) > number(goal.time)) {
    return 'O limite de tempo acabou. Use dano em área nas ondas, priorize sacerdotes e arqueiros e evite perseguições longas.';
  }
  if (goal.type === 'totems' && number(mission.totemsDown) < number(goal.count)) {
    const remaining = Math.max(0, number(goal.count) - number(mission.totemsDown));
    return `Faltaram ${remaining} ${remaining === 1 ? 'totem' : 'totens'}. Destrua cada um cedo: enquanto ficam ativos, invocam reforços.`;
  }
  if (goal.type === 'boss' && !mission.bossDown) {
    if (!mission.bossSeen) {
      const phase = Math.max(1, number(mission.phase));
      const bossPhase = Math.max(6, Math.ceil(phase / 6) * 6);
      return `O grupo caiu antes da estreia do chefe. Sobreviva às ondas até a fase ${bossPhase} e priorize os inimigos de suporte.`;
    }
    return 'O chefe ainda está ativo. Concentre o dano nele e saia das áreas marcadas antes do impacto.';
  }
  if (goal.type === 'defend' && mission.shrineDown) {
    return 'O santuário caiu. Deixe um herói de defesa perto dele e derrube primeiro os saqueadores que correm para o cristal.';
  }
  if (goal.type === 'hunt' && !mission.huntDown) {
    return mission.huntEscaped
      ? 'O alvo marcado fugiu. Encurrale-o no fim da clareira e use lentidão, raízes ou atiradores antes que o tempo acabe.'
      : 'O grupo caiu antes de abater o alvo marcado. Concentre o dano nele quando ele parar para lutar.';
  }
  if (goal.type === 'endless') {
    const seconds = Math.floor(number(mission.endlessTime));
    return `A horda venceu após ${seconds} s. A primeira estrela pede ${number(goal.marks?.[0]) || 60} s: guarde ultimates e cura para quando a onda engrossar.`;
  }
  if (goal.type === 'survive' && number(mission.surviveRemaining) > 0) {
    return `Faltavam ${Math.ceil(number(mission.surviveRemaining))} s para sobreviver. Não persiga longe da formação e guarde controle para grupos perigosos.`;
  }
  return null;
}

function tipFor({ won, heroes, dangerous, falls, mission }) {
  if (won) {
    if (mission?.stars != null) {
      const stars = number(mission.stars);
      const objective = mission.goal?.type === 'rescue' && mission.rescueComplete
        ? 'Prisioneiro resgatado! '
        : mission.goal?.type === 'tower' && number(mission.towersDown) >= number(mission.goal.count)
          ? `${number(mission.goal.count) === 1 ? 'Torre derrubada!' : 'Torres derrubadas!'} `
          : mission.goal?.type === 'defend' ? 'Santuário de pé! '
            : mission.goal?.type === 'hunt' && mission.huntDown ? 'Alvo marcado abatido! '
              : mission.goal?.type === 'endless' ? `A horda foi contida por ${Math.floor(number(mission.endlessTime))} s! `
                : '';
      if (mission.nextMission) {
        return stars < 3
          ? `${objective}Vitória com ${stars}/3 estrelas. ${label(mission.nextMission, 'A próxima arena')} está liberada; confira os critérios acima para conquistar as que faltam.`
          : `${objective}Três estrelas! ${label(mission.nextMission, 'A próxima arena')} está liberada no mapa da campanha.`;
      }
      const remaining = number(mission.remainingStars);
      return remaining > 0
        ? `${objective}Todas as arenas foram vencidas. Rejogue as missões para conquistar as ${remaining} estrelas restantes.`
        : `${objective}Campanha perfeita! Todas as arenas e as ${number(mission.maxStars) || 24} estrelas foram conquistadas.`;
    }
    return 'Na próxima jornada, experimente outra composição para descobrir novas combinações entre as classes.';
  }

  const objective = objectiveTip(mission);
  if (objective) return objective;

  const partyDamage = heroes.reduce((sum, hero) => sum + number(hero.damage), 0);
  const partyReceived = heroes.reduce((sum, hero) => sum + number(hero.received), 0);
  if (dangerous && number(dangerous.damage) > 0) {
    const name = label(dangerous.name, 'o inimigo mais perigoso');
    if (/enxame|crânio/i.test(name)) {
      return `${name} causou mais dano ao grupo. Saia dos círculos laranja dos mergulhos e use golpes em área para limpar o bando de uma vez.`;
    }
    if (/xamã/i.test(name)) {
      return `${name} causou mais dano ao grupo. Derrube o xamã primeiro: o escudo de ossos dos aliados some com ele.`;
    }
    if (/bombardeir|golem|rei esqueleto|lich|carrasco|cavaleiro sombrio|chefe/i.test(name)) {
      return `${name} causou mais dano ao grupo. Afaste-se das áreas marcadas e considere levar um Guardião para proteger os aliados.`;
    }
    if (/arqueir|besteir|crossbow|mago|sacerdote|atirador/i.test(name)) {
      return `${name} causou mais dano ao grupo. Priorize os inimigos à distância ou leve um herói que consiga alcançá-los rapidamente.`;
    }
    if (number(dangerous.hits) >= 3 && number(dangerous.damage) >= partyReceived * 0.3) {
      return `${name} acertou o grupo repetidamente. Controle seus movimentos com gelo, raízes ou atordoamento antes de atacar.`;
    }
  }

  if (partyDamage > 0 && partyReceived > partyDamage * 1.35) {
    return 'O grupo recebeu muito mais dano do que causou. Experimente combinar um Guardião na linha de frente com heróis de dano à distância.';
  }
  if (falls.length && partyReceived > 0) {
    return 'Proteja quem está com pouca vida: mantenha os heróis próximos e use cura ou provocação para aliviar a linha de frente.';
  }
  if (partyDamage === 0) {
    return 'Inclua uma classe de dano à distância ou de ataque em área para vencer as ondas com mais rapidez.';
  }
  return 'Ajuste a composição do grupo e guarde as habilidades para os inimigos que mais ameaçam seus heróis.';
}

/** Produz destaques curtos sem ler ou modificar o estado da partida. */
export function buildBattleReport({ won = false, heroes = [], falls = [], damageSources = [], mission = null } = {}) {
  const party = Array.isArray(heroes) ? heroes.filter((hero) => hero && typeof hero === 'object') : [];
  const recordedFalls = Array.isArray(falls) ? falls : [];
  const danger = mostDangerous(damageSources);
  const first = firstFall(recordedFalls);
  const topSource = danger && number(danger.damage) > 0 ? danger : null;
  const bestHero = party.reduce((best, hero) => !best
    || number(hero.damage) + number(hero.kills) * 40 > number(best.damage) + number(best.kills) * 40 ? hero : best, null);

  const highlights = [];
  if (first) {
    highlights.push({
      id: 'first-fall',
      title: 'Primeiro herói caído',
      text: label(first.name, 'Herói sem nome') + (number(first.phase) ? ` · fase ${number(first.phase)}` : ''),
    });
  } else if (!won && party.length) {
    highlights.push({ id: 'survivors', title: 'Queda dos heróis', text: 'Nenhuma queda foi registrada antes da derrota.' });
  }
  if (topSource) {
    highlights.push({
      id: 'biggest-threat',
      title: 'Maior fonte de dano',
      text: `${label(topSource.name, 'Inimigo desconhecido')} · ${Math.round(number(topSource.damage)).toLocaleString('pt-BR')} de dano${number(topSource.hits) ? ` em ${Math.round(number(topSource.hits))} golpes` : ''}`,
    });
  }
  if (bestHero) {
    highlights.push({
      id: 'top-hero',
      title: 'Herói em destaque',
      text: label(bestHero.name, 'Herói sem nome'),
    });
  }
  highlights.push({ id: 'next-try', title: won ? (mission?.stars != null ? 'Progresso da campanha' : 'Próxima jornada') : 'Dica para a próxima tentativa', text: tipFor({ won, heroes: party, dangerous: danger, falls: recordedFalls, mission }) });
  return highlights;
}
