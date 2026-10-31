const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const worldSource = fs.readFileSync(path.join(root, 'world.js'), 'utf8');
const dungeonDir = path.join(root, 'assets', 'kaykit', 'dungeon', 'Assets', 'gltf');
const assetBounds = new Map();
function boundsFor(model) {
  if (assetBounds.has(model)) return assetBounds.get(model);
  const gltf = JSON.parse(fs.readFileSync(path.join(dungeonDir, `${model}.gltf`), 'utf8'));
  const positions = gltf.meshes.flatMap((mesh) => mesh.primitives.map((primitive) => gltf.accessors[primitive.attributes.POSITION]));
  const bounds = {
    minX: Math.min(...positions.map((position) => position.min[0])),
    maxX: Math.max(...positions.map((position) => position.max[0])),
    minY: Math.min(...positions.map((position) => position.min[1])),
    minZ: Math.min(...positions.map((position) => position.min[2])),
    maxZ: Math.max(...positions.map((position) => position.max[2])),
  };
  assetBounds.set(model, bounds);
  return bounds;
}

async function run() {
  const { villageMarketPropsForStall } = await import('../village-decor.mjs');
  const stalls = [0, 1, 2, 3].map(villageMarketPropsForStall);
  const props = stalls.flat();
  const models = new Set(props.map((prop) => prop.model));
  assert.deepEqual([...models].sort(), ['banner_patternA_red', 'barrel_small', 'chair', 'crates_stacked', 'torch_mounted'].sort(),
    'a praça distribui os cinco modelos medievais entre as barracas');
  const expectedCollider = { banner_patternA_red: null, barrel_small: 0.34, chair: 0.38, crates_stacked: 0.36, torch_mounted: null };

  for (const prop of props) {
    assert.equal(prop.collisionRadius ?? null, expectedCollider[prop.model], `${prop.model}: política de colisão explícita`);
    if (!prop.collisionRadius) continue;
    const bounds = boundsFor(prop.model);
    const visualRadius = Math.hypot(Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) * prop.scale,
      Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)) * prop.scale);
    assert.ok(prop.collisionRadius >= visualRadius, `${prop.model}: o collider cobre o footprint real do GLTF`);
    assert.ok(Math.hypot(prop.x, prop.z) <= 1.1 + prop.collisionRadius,
      `${prop.model}: o collider da peça encosta na área já bloqueada pela barraca`);
    assert.ok(Math.abs(prop.x) + prop.collisionRadius < 2 && Math.abs(prop.z) + prop.collisionRadius < 2,
      `${prop.model}: o footprint fica dentro da área reservada à barraca`);
  }
  const barrel = props.find((prop) => prop.model === 'barrel_small');
  assert.ok(Math.abs(barrel.lift + boundsFor(barrel.model).minY * barrel.scale) < 0.01,
    'o barril encosta no chão em vez de flutuar');
  const banner = props.find((prop) => prop.model === 'banner_patternA_red'), bannerBounds = boundsFor(banner.model);
  assert.ok(banner.lift + bannerBounds.minY * banner.scale > 0.9,
    'o tecido do estandarte começa acima do balcão');
  const bannerPostX = 0.9, bannerPostZ = -0.2;
  const bannerMinX = banner.x + bannerBounds.minX * banner.scale, bannerMaxX = banner.x + bannerBounds.maxX * banner.scale;
  const bannerMinZ = banner.z + bannerBounds.minZ * banner.scale, bannerMaxZ = banner.z + bannerBounds.maxZ * banner.scale;
  const bannerGapX = Math.max(bannerMinX - bannerPostX, 0, bannerPostX - bannerMaxX);
  const bannerGapZ = Math.max(bannerMinZ - bannerPostZ, 0, bannerPostZ - bannerMaxZ);
  assert.ok(Math.hypot(bannerGapX, bannerGapZ) < 0.1, 'o estandarte encosta ao poste traseiro');

  assert.match(worldSource, /addVillageKitProps\(s, i\)/, 'a feira conecta o layout às barracas');
  const builder = worldSource.match(/function buildVillageKitProps\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  const readyGate = builder.indexOf('if (disposed || !sceneryReady(VILLAGE_MODELS)) return;');
  const collision = builder.indexOf('obstacles.push(');
  assert.ok(readyGate >= 0 && collision > readyGate,
    'os colisores só são registrados depois que os modelos estão disponíveis');
  assert.match(builder, /new THREE\.InstancedMesh\(model\.geometry,\s*model\.material/,
    'os props reutilizam o modelo e material do kit em instâncias');
}

run().then(() => console.log('OK: praça da batalha usa o kit medieval sem deixar vãos nos obstáculos das barracas'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
