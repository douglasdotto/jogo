// Sinergias entre estados já existentes no combate.
// As funções são puras: não aplicam dano nem alteram os estados das unidades.
// Regra: o bônus depende do estado do alvo (ou do herói), não de quem está no grupo;
// `sources` e `payoff` só servem para a tela de escolha mostrar a dupla ativa.
const GUARDIAN_SUPPORT_RANGE = 4.5;

export const SYNERGIES = [
  { id: 'frozen-flames', icon: '♨', name: 'Combustão congelante', bonus: 0.2,
    attackers: ['pyro'], states: ['slowT', 'rootT'],
    sources: ['cryo', 'iceviking', 'druid', 'chronist'], payoff: ['pyro'],
    effect: 'Chamas do Piromante: +20% em inimigos lentos ou presos.' },
  { id: 'root-pierce', icon: '➶', name: 'Alvo imobilizado', bonus: 0.2,
    attackers: ['crossbow', 'ninja', 'archer'], states: ['rootT'],
    sources: ['druid', 'chronist', 'cryo', 'iceviking'], payoff: ['crossbow', 'ninja', 'archer'],
    effect: 'Virotes, adagas e flechas: +20% em inimigos presos.' },
  { id: 'guardian-rage', icon: '⛨', name: 'Avanço protegido', reduction: 0.2,
    sources: ['guardian'], payoff: ['berserker'],
    effect: 'Guardião provocando por perto: Berserker enfurecido recebe 20% menos dano.' },
  { id: 'frozen-shatter', icon: '❄', name: 'Gelo quebradiço', bonus: 0.2,
    attackers: ['crusher', 'champion'], states: ['slowT'],
    sources: ['cryo', 'iceviking'], payoff: ['crusher', 'champion'],
    effect: 'Esmagador e Campeão: +20% em inimigos lentos.' },
  { id: 'stasis-execution', icon: '⌛', name: 'Execução no tempo parado', bonus: 0.25,
    attackers: ['assassin'], states: ['stunT', 'rootT', 'sheepT'],
    sources: ['chronist', 'druid', 'crusher', 'engineer', 'oracle', 'alchemist'], payoff: ['assassin'],
    effect: 'Assassino: +25% em inimigos parados, atordoados ou em ovelha.' },
  { id: 'hunter-mark', icon: '⌖', name: 'Presa marcada', bonus: 0.2,
    attackers: ['crossbow', 'ninja'], states: ['markT'],
    sources: ['archer'], payoff: ['crossbow', 'ninja'],
    effect: 'Besteiro e Ninja: +20% no alvo marcado pela Arqueira.' },
  { id: 'song-summons', icon: '♫', name: 'Ritmo das crias', haste: 1.3,
    summoners: ['necro', 'engineer', 'beast_tamer'],
    sources: ['bard'], payoff: ['necro', 'engineer', 'beast_tamer'],
    effect: 'Canção do Bardo: lacaios, torreta e fera atacam 30% mais rápido.' },
  { id: 'sacred-wall', icon: '☩', name: 'Muralha sagrada', heal: 0.3,
    healers: ['paladin', 'cleric'],
    sources: ['paladin', 'cleric'], payoff: ['guardian'],
    effect: 'Paladino e Clériga curam 30% mais o Guardião que provoca.' },
].map((synergy) => ({ ...synergy, variants: [...new Set([...synergy.sources, ...synergy.payoff])] }));

const synergyById = (id) => SYNERGIES.find((synergy) => synergy.id === id);
const targetHasState = (unit, states) => states.some((state) => unit[state] > 0);
// Guardião "em guarda" é a provocação dele mesmo (stanceT), não a guarda dada pela Clériga.
const inGuardianStance = (unit) => unit.cfg?.id === 'guardian' && unit.stanceT > 0;

/** Sinergias de dano que valem para este atacante contra o alvo agora. */
export function damageSynergies(attackerId, target) {
  if (!target || target.dead) return [];
  return SYNERGIES.filter((synergy) => synergy.attackers?.includes(attackerId) && targetHasState(target, synergy.states));
}

/** Multiplicador de dano: produto dos bônus ativos. */
export function synergyDamageMultiplier(attackerId, target) {
  return damageSynergies(attackerId, target).reduce((multiplier, synergy) => multiplier * (1 + synergy.bonus), 1);
}

/** Um Guardião provocando protege o Berserker enfurecido próximo. */
export function synergyDamageTakenMultiplier(target, allies) {
  if (!target || target.dead || target.cfg?.id !== 'berserker' || target.furyT <= 0) return 1;
  for (const guardian of allies || []) {
    if (guardian === target || guardian.dead || !inGuardianStance(guardian)) continue;
    if (target.pos.distanceTo(guardian.pos) <= GUARDIAN_SUPPORT_RANGE) return 1 - synergyById('guardian-rage').reduction;
  }
  return 1;
}

/** Cura extra de Paladino e Clériga no Guardião que está provocando. */
export function synergyHealMultiplier(healerId, target) {
  const synergy = synergyById('sacred-wall');
  return synergy.healers.includes(healerId) && target && !target.dead && inGuardianStance(target) ? 1 + synergy.heal : 1;
}

/** Invocações atacam mais rápido enquanto quem as chamou está sob a canção do Bardo. */
export function synergySummonHaste(summoner) {
  const synergy = synergyById('song-summons');
  return summoner && summoner.songT > 0 && synergy.summoners.includes(summoner.cfg?.id) ? synergy.haste : 1;
}

/** Sinergias que a equipe pode ativar: alguém que causa o estado e outro herói que aproveita. */
export function activeSynergies(teamIds) {
  return SYNERGIES.filter((synergy) => teamIds.some((payoff) => synergy.payoff.includes(payoff)
    && teamIds.some((source) => source !== payoff && synergy.sources.includes(source))));
}
