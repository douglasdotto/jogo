// Regras da mira manual. Habilidades centradas no herói continuam instantâneas.
export function aimSpec(h) {
  const id = h.cfg.id, power = h.skillPower;
  if (['assassin', 'arcane', 'viking', 'iceviking', 'oracle'].includes(id)) return {
    mode: 'enemy', range: id === 'arcane' || id === 'oracle' ? h.range : id === 'assassin' ? 7 : 9,
    min: id.includes('viking') ? 2 : 0,
    radius: id === 'iceviking' ? (1.3 + (h.level - 1) * 0.25) * power : 0.65,
  };
  if (['pyro', 'cryo', 'crossbow', 'ninja', 'crusher', 'angel', 'archer', 'alchemist', 'engineer'].includes(id)) return {
    mode: 'ground', range: id === 'crusher' ? 2.2 * power : id === 'ninja' ? 7 : id === 'archer' ? 11 : id === 'alchemist' ? h.range + 1 : id === 'engineer' ? 8 : h.range,
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

// Marcha em passos de 2 m e refina o primeiro cruzamento; a faixa da rampa
// do platô tem 3 m de largura, então pelo menos uma amostra cai dentro dela.
export function findGroundAimHit(ray, groundHeight, target, maxDistance = 250, step = 2, refinementSteps = 8) {
  const stride = Math.max(0.5, step);
  let previousDistance = 0;
  let previous = ray.origin.y - groundHeight(ray.origin.x, ray.origin.z);
  for (let distance = Math.min(stride, maxDistance); distance <= maxDistance; distance = Math.min(maxDistance, distance + stride)) {
    ray.at(distance, target);
    const above = target.y - groundHeight(target.x, target.z);
    if (above <= 0 && previous > 0) {
      let low = previousDistance, high = distance;
      for (let i = 0; i < refinementSteps; i++) {
        const mid = (low + high) / 2;
        ray.at(mid, target);
        if (target.y > groundHeight(target.x, target.z)) low = mid;
        else high = mid;
      }
      ray.at(high, target);
      target.y = groundHeight(target.x, target.z);
      return true;
    }
    previousDistance = distance;
    previous = above;
    if (distance === maxDistance) break;
  }
  return false;
}
