// Regras da mira manual. Habilidades centradas no herói continuam instantâneas.
export function aimSpec(h) {
  const id = h.cfg.id, power = h.skillPower;
  if (['assassin', 'arcane', 'viking', 'iceviking'].includes(id)) return {
    mode: 'enemy', range: id === 'arcane' ? h.range : id === 'assassin' ? 7 : 9,
    min: id.includes('viking') ? 2 : 0,
    radius: id === 'iceviking' ? (1.3 + (h.level - 1) * 0.25) * power : 0.65,
  };
  if (['pyro', 'cryo', 'crossbow', 'ninja', 'crusher', 'angel', 'archer', 'alchemist'].includes(id)) return {
    mode: 'ground', range: id === 'crusher' ? 2.2 * power : id === 'ninja' ? 7 : id === 'archer' ? 11 : id === 'alchemist' ? h.range + 1 : h.range,
    radius: id === 'pyro' ? (1.1 + (h.level - 1) * 0.2) * power
      : id === 'cryo' ? (1.3 + (h.level - 1) * 0.25) * power : id === 'angel' ? (3 + (h.level - 1) * 0.5) * power
      : id === 'alchemist' ? (1.6 + (h.level - 1) * 0.2) * power : 0,
  };
  return null;
}

export function validAim(h, target) {
  const spec = aimSpec(h);
  if (!spec || !target || target.dead || target.spawning) return false;
  if (spec.mode === 'enemy' && target.groundTarget) return false;
  const distance = h.pos.distanceTo(target.pos);
  if (distance <= spec.min || distance > spec.range) return false;
  if (h.cfg.id === 'assassin' && (distance >= 7 || Math.abs(h.pos.y - target.pos.y) >= 0.85)) return false;
  if (h.cfg.id.includes('viking') && distance >= 9) return false;
  return true;
}
