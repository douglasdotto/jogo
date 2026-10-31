// Verificação do contrato do terreno, sem dependências novas.
export function checkTerrain(world, THREE) {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  for (const phase of [3, 7, 10]) {   // sem platôs: fase de combate em chão plano
    assert(world.zoneOf(phase) === null, 'sem platô na fase ' + phase);
  }
  for (const phase of [5, 9]) {
    const zone = world.zoneOf(phase), edge = zone.water[0];
    assert(world.isShallow(edge.x, edge.z), 'surgimento na água rasa');
    assert(!world.isShallow(zone.center.x, zone.center.z), 'centro não é raso');
    assert(!world.canStep(edge, zone.center), 'água funda bloqueada');
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const radial = zone.side.clone().multiplyScalar(Math.cos(angle)).addScaledVector(zone.fwd, Math.sin(angle));
      const shore = zone.center.clone().addScaledVector(radial, zone.radius - 0.01);
      const land = zone.center.clone().addScaledVector(radial, zone.radius + 0.01);
      assert(Math.abs(world.groundHeight(shore.x, shore.z)) < 0.03, 'margem termina no nível do terreno');
      assert(world.canStep(shore, land), 'saída do lago sem degrau na fase ' + phase);
    }
  }
  assert(world.zoneOf(1) === null, 'fase normal preservada');
  assert(world.groundHeight(0, 0) === 0, 'chão normal');
  return 'Terreno: chão plano, água e fases normais OK';
}
