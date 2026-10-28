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

function tipFor({ won, heroes, dangerous, falls }) {
  if (won) return 'Na próxima jornada, experimente outra composição para descobrir novas combinações entre as classes.';

  const partyDamage = heroes.reduce((sum, hero) => sum + number(hero.damage), 0);
  const partyReceived = heroes.reduce((sum, hero) => sum + number(hero.received), 0);
  if (dangerous && number(dangerous.damage) > 0) {
    const name = label(dangerous.name, 'o inimigo mais perigoso');
    if (/bombardeir|golem|rei esqueleto|lich|chefe/i.test(name)) {
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
export function buildBattleReport({ won = false, heroes = [], falls = [], damageSources = [] } = {}) {
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
  highlights.push({ id: 'next-try', title: won ? 'Próxima jornada' : 'Dica para a próxima tentativa', text: tipFor({ won, heroes: party, dangerous: danger, falls: recordedFalls }) });
  return highlights;
}
