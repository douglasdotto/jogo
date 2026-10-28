// Verificação do contrato do terreno, sem dependências novas.
export function checkTerrain(world, THREE) {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  for (const phase of [3, 7, 10]) {
    const zone = world.zoneOf(phase);
    assert(zone.type === 'plateau', 'platô na fase ' + phase);
    assert(world.groundHeight(zone.center.x, zone.center.z) === 3, 'altura do topo');
    const { bottom, top } = zone.ramp;
    for (let i = 0; i <= 20; i++) {
      const at = bottom.clone().lerp(top, i / 20);
      assert(Math.abs(world.groundHeight(at.x, at.z) - 3 * i / 20) < 0.02, 'rampa contínua');
    }
    const below = zone.center.clone().addScaledVector(zone.side, -5); below.y = 0;
    const first = world.nextWaypoint(below, zone.top[0]);
    assert(first.y === 0 && first.distanceTo(zone.top[0]) > 1, 'acesso pelo pé, com desvio da parede');
    assert(world.nextWaypoint(zone.top[0], below).distanceTo(top) < 0.01, 'saída pelo topo fase ' + phase + ': ' + JSON.stringify(world.nextWaypoint(zone.top[0], below)) + ' esperado ' + JSON.stringify(top));
    const wall = zone.center.clone().addScaledVector(zone.side, -4.2); wall.y = 0;
    const inside = zone.center.clone().addScaledVector(zone.side, -3.8); inside.y = 0;
    assert(!world.canStep(wall, inside), 'parede bloqueia subida');
    assert(!world.canStep(inside.clone().setY(3), wall), 'parede bloqueia descida');
  }
  for (const phase of [5, 9]) {
    const zone = world.zoneOf(phase), edge = zone.water[0];
    assert(world.isShallow(edge.x, edge.z), 'surgimento na água rasa');
    assert(!world.isShallow(zone.center.x, zone.center.z), 'centro não é raso');
    assert(!world.canStep(edge, zone.center), 'água funda bloqueada');
  }
  assert(world.zoneOf(1) === null, 'fase normal preservada');
  assert(world.groundHeight(0, 0) === 0, 'chão normal');
  return 'Terreno: altura, rampa, paredes, água e fases normais OK';
}
