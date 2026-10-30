const auraGeometryCaches = new WeakMap();

const auraGeometryFactories = {
  ring: (THREE) => new THREE.TorusGeometry(1.25, 0.065, 6, 28),
  bannerPole: (THREE) => new THREE.CylinderGeometry(0.025, 0.025, 0.36, 4),
  bannerCloth: (THREE) => new THREE.BoxGeometry(0.25, 0.18, 0.035),
  boneBar: (THREE) => new THREE.BoxGeometry(0.72, 0.09, 0.1),
  boneTip: (THREE) => new THREE.SphereGeometry(0.12, 8, 6),
  knot: (THREE) => new THREE.TorusKnotGeometry(1.04, 0.055, 56, 6, 2, 3),
  crescent: (THREE) => new THREE.TorusGeometry(1.2, 0.07, 6, 36, Math.PI * 1.55),
  crest: (THREE) => new THREE.TorusGeometry(1.16, 0.075, 5, 6),
  crownPoint: (THREE) => new THREE.ConeGeometry(0.11, 0.28, 4),
};

const auraSpin = { banner: 0.11, bones: 0.34, crescent: 0.24, crest: 0.08, crown: 0.18, vanguard: 0.16, nightmare: 0.27 };

function sharedAuraGeometry(THREE, name) {
  let cache = auraGeometryCaches.get(THREE);
  if (!cache) auraGeometryCaches.set(THREE, cache = new Map());
  if (!cache.has(name)) {
    const create = auraGeometryFactories[name];
    if (!create) throw new Error(`geometria de cosmético desconhecida: ${name}`);
    cache.set(name, create(THREE));
  }
  return cache.get(name);
}

// Cada herói recebe um grupo e material próprios; as geometrias pequenas ficam compartilhadas.
// Assim o efeito pode pulsar, sumir com a queda e ser descartado sem deixar recursos por herói.
export function createCampaignAura(THREE, cosmetic) {
  const style = Object.prototype.hasOwnProperty.call(auraSpin, cosmetic?.auraStyle) ? cosmetic.auraStyle : 'banner';
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: cosmetic?.color ?? 0x72d5ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });

  const add = (geometryName, position, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(sharedAuraGeometry(THREE, geometryName), material);
    mesh.position.set(...position);
    mesh.rotation.x = rotation[0];
    mesh.rotation.y = rotation[1];
    mesh.rotation.z = rotation[2];
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };

  if (style === 'banner') {
    add('ring', [0, 0.08, 0], [Math.PI / 2, 0, 0]);
    add('bannerPole', [0, 0.22, 1.1]);
    add('bannerCloth', [0.12, 0.31, 1.1]);
  } else if (style === 'bones') {
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      add('boneBar', [0, 0.12, 0], [0, angle, 0]);
      for (const direction of [-1, 1]) {
        add('boneTip', [Math.cos(angle) * 0.36 * direction, 0.12, -Math.sin(angle) * 0.36 * direction]);
      }
    }
  } else if (style === 'crescent') {
    add('crescent', [0, 1.72, 0], [0, 0, -Math.PI * 0.12]);
  } else if (style === 'crest') {
    add('crest', [0, 0.09, 0], [Math.PI / 2, Math.PI / 6, 0]);
  } else if (style === 'vanguard') {
    add('ring', [0, 0.08, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      add('crownPoint', [Math.cos(angle) * 1.08, 0.16, Math.sin(angle) * 1.08], [0, -angle, 0]);
    }
  } else if (style === 'nightmare') {
    add('knot', [0, 0.92, 0], [Math.PI / 2, 0, 0]);
    add('crescent', [0, 1.62, 0], [0, 0, Math.PI * 0.12]);
    add('crescent', [0, 1.62, 0], [0, Math.PI, -Math.PI * 0.12]);
  } else {
    add('ring', [0, 0.08, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      add('crownPoint', [Math.cos(angle) * 1.08, 0.16, Math.sin(angle) * 1.08]);
    }
  }

  group.userData ||= {};
  group.userData.auraStyle = style;
  return { group, material, spin: auraSpin[style] };
}
