// Sinergias entre estados já existentes no combate.
// As funções são puras: não aplicam dano nem alteram os estados das unidades.
const FIRE_DAMAGE_BONUS = 1.2;
const PIERCING_DAMAGE_BONUS = 1.2;
const GUARDED_RAGE_DAMAGE = 0.8;
const GUARDIAN_SUPPORT_RANGE = 4.5;

/** Fogo causa 20% a mais em inimigos lentos ou presos pelas raízes. */
export function synergyDamageMultiplier(attack, target) {
  if (!target || target.dead) return 1;
  if (attack === 'fire' && (target.slowT > 0 || target.rootT > 0)) return FIRE_DAMAGE_BONUS;
  if (attack === 'piercing' && target.rootT > 0) return PIERCING_DAMAGE_BONUS;
  return 1;
}

/** Um Guardião em guarda protege o Berserker enfurecido próximo em 20%. */
export function synergyDamageTakenMultiplier(target, allies) {
  if (!target || target.dead || target.cfg?.id !== 'berserker' || target.furyT <= 0) return 1;
  for (const guardian of allies || []) {
    if (guardian === target || guardian.dead || guardian.cfg?.id !== 'guardian' || guardian.guardT <= 0) continue;
    if (target.pos.distanceTo(guardian.pos) <= GUARDIAN_SUPPORT_RANGE) return GUARDED_RAGE_DAMAGE;
  }
  return 1;
}

export const SYNERGIES = [
  { id: 'frozen-flames', variants: ['pyro', 'cryo', 'druid'], classes: ['Piromante', 'Criomante ou Druida'], name: 'Combustão congelante', effect: 'Com Criomante ou Druida no grupo, as chamas causam 20% a mais de dano a inimigos lentos ou presos.' },
  { id: 'root-pierce', variants: ['druid', 'crossbow', 'ninja', 'archer'], classes: ['Druida', 'Besteiro, Ninja ou Arqueira'], name: 'Alvo imobilizado', effect: 'Com Druida no grupo, virotes, adagas e flechas perfuram 20% mais forte contra inimigos presos pelas raízes.' },
  { id: 'guardian-rage', variants: ['guardian', 'berserker'], classes: ['Guardião', 'Berserker'], name: 'Avanço protegido', effect: 'Com Guardião próximo em guarda, Berserkers enfurecidos recebem 20% menos dano.' },
];
