// Fixture leve da estrada, do relevo e da navegação de world.js para testes sem WebGL.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'world.js'), 'utf8');
const zoneStart = source.indexOf('  const zones = new Map();');
const zoneEnd = source.indexOf('  // ---------- rio,', zoneStart);
const routeStart = source.indexOf('const ROUTE = [');
const routeEnd = source.indexOf('];', routeStart) + 2;
if (zoneStart < 0 || zoneEnd < 0 || routeStart < 0 || routeEnd < 2) throw new Error('A estrada ou a navegação do mundo não foi encontrada');
const routeControls = vm.runInNewContext(source.slice(routeStart, routeEnd) + ';ROUTE');

function createNavigationWorld({ THREE, Vector3, seed = 11, phases = 12, castleInterior = false } = {}) {
  if (!THREE?.MathUtils || !Vector3 || !Number.isFinite(phases) || phases < 2) throw new TypeError('Parâmetros inválidos para criar o mundo de navegação');
  let mapSeed = (seed >>> 0) || 1;
  const rand = () => ((mapSeed = (mapSeed * 16807) % 2147483647) / 2147483647);
  rand(); rand(); // createWorld escolhe os offsets do terreno antes de perturbar os pontos da estrada
  const controls = routeControls.map(([x, z], i) => new Vector3(
    x + (i === 0 || i === routeControls.length - 1 ? 0 : rand() * 5.2 - 2.6),
    0,
    z + (i === 0 || i === routeControls.length - 1 ? 0 : rand() * 2.8 - 1.4),
  ));

  const curveFor = (points) => {
    const samplePoints = [];
    const interpolate = (p0, p1, p2, p3, t) => {
      const dt0 = Math.sqrt(Math.hypot(p0.x - p1.x, p0.z - p1.z));
      const dt1 = Math.sqrt(Math.hypot(p1.x - p2.x, p1.z - p2.z));
      const dt2 = Math.sqrt(Math.hypot(p2.x - p3.x, p2.z - p3.z));
      const d0 = dt0 || 1, d1 = dt1 || 1, d2 = dt2 || 1;
      const component = (a, b, c, d) => {
        const m1 = ((b - a) / d0 - (c - a) / (d0 + d1) + (c - b) / d1) * d1;
        const m2 = ((c - b) / d1 - (d - b) / (d1 + d2) + (d - c) / d2) * d1;
        const t2 = t * t, t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * b + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * c + (t3 - t2) * m2;
      };
      return new Vector3(component(p0.x, p1.x, p2.x, p3.x), 0, component(p0.z, p1.z, p2.z, p3.z));
    };

    for (let segment = 0; segment < points.length - 1; segment++) {
      const p1 = points[segment], p2 = points[segment + 1];
      const p0 = points[segment - 1] || new Vector3(2 * p1.x - p2.x, 0, 2 * p1.z - p2.z);
      const p3 = points[segment + 2] || new Vector3(2 * p2.x - p1.x, 0, 2 * p2.z - p1.z);
      for (let step = segment === 0 ? 0 : 1; step <= 32; step++) samplePoints.push(interpolate(p0, p1, p2, p3, step / 32));
    }

    const samples = [{ p: samplePoints[0], s: 0 }];
    let length = 0;
    for (let i = 1; i < samplePoints.length; i++) {
      length += samplePoints[i].distanceTo(samplePoints[i - 1]);
      samples.push({ p: samplePoints[i], s: length });
    }
    const pointAt = (s) => {
      const wanted = Math.max(0, Math.min(length, s));
      let lo = 1, hi = samples.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].s < wanted) lo = mid + 1;
        else hi = mid;
      }
      const a = samples[lo - 1], b = samples[lo];
      return a.p.clone().lerp(b.p, (wanted - a.s) / Math.max(1e-8, b.s - a.s));
    };
    return { length, pointAt };
  };

  const baseCurve = curveFor(controls);
  const baseRouteLength = baseCurve.length;
  const interiorArenaS = baseRouteLength + 12;
  if (castleInterior) controls.push(...[[-1.5, -278], [-1, -292], [0, -306], [0, -320]].map(([x, z]) => new Vector3(x, 0, z)));
  const curve = castleInterior ? curveFor(controls) : baseCurve;
  const L = curve.length;
  const pointAt = curve.pointAt;
  const tangentAt = (s) => pointAt(Math.min(L, s + 0.5)).sub(pointAt(Math.max(0, s - 0.5))).normalize();
  const sideOf = (t) => new Vector3(-t.z, 0, t.x);
  const along = (s, lateral) => pointAt(s).addScaledVector(sideOf(tangentAt(s)), lateral);
  const firstS = 12, lastS = castleInterior ? baseRouteLength - 30 : L - 30;
  const anchorS = (phase) => castleInterior && phase === 13
    ? interiorArenaS
    : firstS + ((phase - 1) * (lastS - firstS)) / (castleInterior ? 11 : phases - 1);
  const obstacles = [];
  const world = vm.runInNewContext(source.slice(zoneStart, zoneEnd) + ';({zoneOf,groundHeight,isShallow,nextWaypoint,canStep,obstacles})', {
    THREE, pointAt, tangentAt, sideOf, along, anchorS, interiorArenaS, castleInterior, obstacles,
  });
  return { ...world, pointAt, tangentAt, sideOf, along, anchorS, L, obstacles };
}

function seedRoadObstacles(world, seed, phases = 12) {
  let obstacleSeed = (Math.imul(seed >>> 0, 0x9e3779b1) >>> 0) || 1;
  const random = () => ((obstacleSeed = (Math.imul(obstacleSeed, 1664525) + 1013904223) >>> 0) / 0x100000000);
  for (let phase = 1; phase < phases; phase++) {
    const count = 2 + Math.floor(random() * 3);
    for (let i = 0; i < count; i++) {
      const s = world.anchorS(phase) + 7 + random() * 9;
      const lateral = (random() < 0.5 ? -1 : 1) * (2.3 + random() * 4.2);
      const at = world.along(s, lateral);
      const zones = [5, 9].map((p) => world.zoneOf(p));
      const blocked = zones.some((zone) => Math.hypot(at.x - zone.center.x, at.z - zone.center.z) < zone.radius + 3.5
        || zone.ground.some((ground) => Math.hypot(at.x - ground.x, at.z - ground.z) < 3));
      if (blocked) continue; // createWorld mantém pedras e troncos fora dos lagos
      const kind = random();
      const radius = kind < 0.4 ? 0.7 + random() * 0.4 : kind < 0.7 ? 1.1 : 0.6;
      world.obstacles.push({ x: at.x, z: at.z, r: radius });
    }
  }
  return world;
}

module.exports = { createNavigationWorld, seedRoadObstacles };
