// Destaques puros para o placar final. Valores de texto devem ser inseridos no
// DOM com textContent (ou escapados antes de entrar em um template HTML).
//
// Esquema:
// buildBattleReport({ won, heroes: [{ name, damage, received, kills }],
//   falls: [{ name, phase, time }],
//   damageSources: [{ name, damage, hits }],
//   militia: { size, damage, kills, fallen } | null })
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

function objectiveTip(mission, heroes = []) {
  const goal = mission?.goal;
  if (!goal) return null;
  if (goal.type === 'escort') {
    if (mission.villagerDown) return 'O aldeão caiu: fique perto dele com cura ou provocação.';
    return 'O grupo caiu antes de concluir a escolta: reforce a linha de frente.';
  }
  if (goal.type === 'nofall') {
    return 'Todo o grupo caiu: mantenha ao menos um herói de pé para seguir. Quedas individuais tiram as estrelas extras; cura e proteção ajudam a preservar o grupo.';
  }
  if (goal.type === 'rescue' && mission.villagerDown) {
    return mission.rescueComplete
      ? 'A pessoa caiu depois do resgate: proteja-a até o fim.'
      : 'O prisioneiro caiu antes do resgate: afaste os esqueletos dele.';
  }
  if (goal.type === 'rescue' && !mission.rescueComplete) {
    return 'O prisioneiro continua preso: fique perto dele para libertá-lo.';
  }
  if (goal.type === 'tower' && number(mission.towersDown) < number(goal.count)) {
    const remaining = Math.max(0, number(goal.count) - number(mission.towersDown));
    return `Faltou derrubar ${remaining === 1 ? 'a torre' : `${remaining} torres`}: concentre os ataques nela.`;
  }
  if (goal.type === 'timer' && number(mission.time) > number(goal.time)) {
    return 'O limite de tempo acabou: use dano em área e evite perseguições.';
  }
  if (goal.type === 'totems' && number(mission.totemsDown) < number(goal.count)) {
    const remaining = Math.max(0, number(goal.count) - number(mission.totemsDown));
    return `Faltaram ${remaining} ${remaining === 1 ? 'totem' : 'totens'}: destrua cada um cedo.`;
  }
  if (goal.type === 'boss' && !mission.bossDown) {
    if (!mission.bossSeen) {
      const phase = Math.max(1, number(mission.phase));
      const bossPhase = Math.max(6, Math.ceil(phase / 6) * 6);
      return `O grupo caiu antes da estreia do chefe, na fase ${bossPhase}.`;
    }
    return 'O chefe ainda está ativo: foque nele e saia das áreas marcadas.';
  }
  if (goal.type === 'defend' && mission.shrineDown) {
    return 'O santuário caiu: deixe um defensor perto do cristal.';
  }
  if (goal.type === 'hunt' && !mission.huntDown) {
    return mission.huntEscaped
      ? 'O alvo marcado fugiu: prenda ou desacelere antes do tempo.'
      : 'O grupo caiu antes de abater o alvo marcado.';
  }
  if (goal.type === 'breach') return number(mission.leaks) >= number(goal.leaks) ? 'Muitos cruzaram a ponte: derrube primeiro quem corre para ela.' : 'O grupo caiu antes de salvar a ponte: lute perto dela.';
  if (goal.type === 'duel' && !mission.bossDown) return 'O chefe venceu o duelo: saia das áreas e guarde a ultimate.';
  if (goal.type === 'elite') return `Caiu na onda de elite ${Math.max(1, number(mission.eliteWave))}/${number(goal.waves) || 3}: foque um alvo por vez.`;
  if (goal.type === 'twin' && !mission.bossDown) {
    return number(mission.bossesLeft) === 1 ? 'Faltou um chefe: guarde a ultimate para o segundo.' : 'Os dois chefes seguem de pé: derrube um de cada vez.';
  }
  if (goal.type === 'bosses' && !mission.bossDown) {
    const left = number(mission.bossesLeft);
    const ids = new Set(heroes.map((hero) => hero.id).filter((id) => typeof id === 'string'));
    const teamUsed = ['paladin', 'guardian', 'viking', 'cleric'].every((id) => ids.has(id));
    const teamTip = ids.size && !teamUsed ? ' Equipe sugerida: Paladino, Guardião, Viking e Clériga.' : '';
    const combatTip = left === 1 ? 'Falta um guardião: desvie das marcas e guarde a cura para o último.'
      : `${left || goal.bosses?.length || 3} guardiões seguem no salão: foque um por vez e interrompa as investidas.`;
    return combatTip + teamTip;
  }
  if (goal.type === 'endless') {
    const seconds = Math.floor(number(mission.endlessTime));
    return `A horda venceu após ${seconds} s; a 1ª estrela pede ${number(goal.marks?.[0]) || 60} s.`;
  }
  if (goal.type === 'survive' && number(mission.surviveRemaining) > 0) {
    return `Faltavam ${Math.ceil(number(mission.surviveRemaining))} s: fique na formação.`;
  }
  return null;
}

function tipFor({ won, heroes, dangerous, falls, mission }) {
  if (won) {
    if (mission?.stars != null) {
      const stars = number(mission.stars);
      const objective = mission.goal?.type === 'escort' ? 'Aldeão salvo! '
        : mission.goal?.type === 'rescue' && mission.rescueComplete
        ? 'Prisioneiro resgatado! '
        : mission.goal?.type === 'tower' && number(mission.towersDown) >= number(mission.goal.count)
          ? `${number(mission.goal.count) === 1 ? 'Torre derrubada!' : 'Torres derrubadas!'} `
          : mission.goal?.type === 'defend' ? 'Santuário de pé! '
            : mission.goal?.type === 'hunt' && mission.huntDown ? 'Alvo marcado abatido! '
              : mission.goal?.type === 'endless' ? `A horda foi contida por ${Math.floor(number(mission.endlessTime))} s! `
                : mission.goal?.type === 'breach' ? 'Ponte salva! '
                  : mission.goal?.type === 'duel' ? 'Duelo vencido! '
                    : mission.goal?.type === 'elite' ? 'Cripta limpa! '
                      : mission.goal?.type === 'twin' ? 'O trono caiu! '
                        : mission.goal?.type === 'bosses' ? 'Os guardiões foram vencidos! '
                        : '';
      if (mission.nextMission) {
        const nextMission = label(mission.nextMission, 'a próxima missão');
        const unlock = `Próxima missão liberada: ${nextMission}.`;
        return stars < 3
          ? `${objective}Vitória com ${stars}/3 estrelas. ${unlock}`
          : `${objective}Três estrelas! ${unlock}`;
      }
      const remaining = number(mission.remainingStars);
      return remaining > 0
        ? `${objective}Rejogue as missões pelas ${remaining} estrelas restantes.`
        : `${objective}Campanha perfeita! ${number(mission.maxStars) || 24} estrelas.`;
    }
    return 'Experimente outra composição de grupo.';
  }

  const objective = objectiveTip(mission, heroes);
  if (objective) return objective;

  const partyDamage = heroes.reduce((sum, hero) => sum + number(hero.damage), 0);
  const partyReceived = heroes.reduce((sum, hero) => sum + number(hero.received), 0);
  if (dangerous && number(dangerous.damage) > 0) {
    const name = label(dangerous.name, 'o inimigo mais perigoso');
    if (/enxame|crânio/i.test(name)) {
      return `${name} causou mais dano: saia dos círculos e use golpes em área.`;
    }
    if (/xamã/i.test(name)) {
      return `${name} causou mais dano: derrube o xamã primeiro.`;
    }
    if (/bombardeir|golem|rei esqueleto|lich|carrasco|cavaleiro sombrio|chefe/i.test(name)) {
      return `${name} causou mais dano: saia das áreas marcadas.`;
    }
    if (/arqueir|besteir|crossbow|mago|sacerdote|atirador/i.test(name)) {
      return `${name} causou mais dano: priorize os atiradores.`;
    }
    if (number(dangerous.hits) >= 3 && number(dangerous.damage) >= partyReceived * 0.3) {
      return `${name} acertou muitas vezes: use gelo, raízes ou atordoamento.`;
    }
  }

  if (partyDamage > 0 && partyReceived > partyDamage * 1.35) {
    return 'O grupo apanhou mais do que bateu: leve um Guardião na frente.';
  }
  if (falls.length && partyReceived > 0) {
    return 'Mantenha o grupo junto e cure quem estiver fraco.';
  }
  if (partyDamage === 0) {
    return 'Leve dano à distância ou em área.';
  }
  return 'Guarde as habilidades para os inimigos mais perigosos.';
}

/** Produz destaques curtos sem ler ou modificar o estado da partida. */
export function buildBattleReport({ won = false, heroes = [], falls = [], damageSources = [], mission = null, militia = null } = {}) {
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
      title: 'Primeira queda',
      text: label(first.name, 'Herói sem nome') + (number(first.phase) ? ` · fase ${number(first.phase)}` : ''),
    });
  } else if (!won && party.length) {
    highlights.push({ id: 'survivors', title: 'Quedas', text: 'Nenhum herói caiu.' });
  }
  if (topSource) {
    highlights.push({
      id: 'biggest-threat',
      title: 'Maior ameaça',
      text: `${label(topSource.name, 'Inimigo desconhecido')} · ${Math.round(number(topSource.damage)).toLocaleString('pt-BR')} de dano${number(topSource.hits) ? ` em ${Math.round(number(topSource.hits))} golpes` : ''}`,
    });
  }
  if (bestHero) {
    highlights.push({
      id: 'top-hero',
      title: 'Destaque',
      text: label(bestHero.name, 'Herói sem nome'),
    });
  }
  if (militia && number(militia.size)) {   // aldeões armados: crédito à parte, fora do destaque dos heróis
    const fallen = Math.min(number(militia.fallen), number(militia.size));
    highlights.push({
      id: 'militia',
      title: 'Milícia',
      text: `${Math.round(number(militia.damage)).toLocaleString('pt-BR')} de dano · ${Math.round(number(militia.kills))} ${number(militia.kills) === 1 ? 'abate' : 'abates'}`
        + (fallen ? ` · ${fallen} ${fallen === 1 ? 'caiu' : 'caíram'}` : ''),
    });
  }
  highlights.push({ id: 'next-try', title: won ? (mission?.stars != null ? 'Progresso da campanha' : 'Próxima jornada') : 'Dica', text: tipFor({ won, heroes: party, dangerous: danger, falls: recordedFalls, mission }) });
  return highlights;
}
