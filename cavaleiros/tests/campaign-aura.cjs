const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Transform {
  constructor() { this.x = 0; this.y = 0; this.z = 0; }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  setScalar(value) { return this.set(value, value, value); }
}
class Node {
  constructor() {
    this.children = [];
    this.position = new Transform();
    this.rotation = new Transform();
    this.scale = new Transform();
    this.userData = {};
    this.visible = true;
  }
  add(...children) { this.children.push(...children); }
}
class Geometry {
  constructor(type, args) { this.type = type; this.args = args; }
}
const geometryType = (type) => class extends Geometry {
  constructor(...args) { super(type, args); }
};
class Mesh extends Node {
  constructor(geometry, material) { super(); Object.assign(this, { geometry, material }); }
}
class Material {
  constructor(options) { Object.assign(this, options); }
}
const THREE = {
  DoubleSide: 2,
  Group: Node,
  Mesh,
  MeshBasicMaterial: Material,
  TorusGeometry: geometryType('torus'),
  TorusKnotGeometry: geometryType('knot'),
  CylinderGeometry: geometryType('cylinder'),
  BoxGeometry: geometryType('box'),
  SphereGeometry: geometryType('sphere'),
  ConeGeometry: geometryType('cone'),
};

const dir = path.resolve(__dirname, '..');
const auraSource = fs.readFileSync(path.join(dir, 'campaign-aura.js'), 'utf8');
const auraContext = vm.createContext({ THREE, Math, WeakMap, Map, Object, Error });
vm.runInContext(`${auraSource.replaceAll('export ', '')}\nthis.buildAura = createCampaignAura;`, auraContext);

const campaignSource = fs.readFileSync(path.join(dir, 'campaign.js'), 'utf8').replaceAll('export ', '');
const campaignContext = vm.createContext({
  URLSearchParams,
  location: { search: '' },
  localStorage: { getItem: () => null, setItem() {} },
});
vm.runInContext(`${campaignSource}\nthis.getChapterCosmetics = campaignCosmetics;`, campaignContext);
const cosmetics = JSON.parse(vm.runInContext('JSON.stringify(getChapterCosmetics().map(({id, auraStyle}) => [id, auraStyle]))', campaignContext));
assert.deepEqual(cosmetics, [
  ['vila', 'banner'], ['ossos', 'bones'], ['veu', 'crescent'], ['marcha', 'crest'], ['trono', 'crown'],
  ['vanguarda', 'vanguard'], ['pesadelo', 'nightmare'],
], 'capítulos e desafios de domínio anunciam motivos visuais próprios');

const make = (id, auraStyle, color = 0x72d5ff) => auraContext.buildAura(THREE, { id, auraStyle, color });
const auras = cosmetics.map(([id, auraStyle]) => make(id, auraStyle));
assert.deepEqual(auras.map(({ group }) => group.userData.auraStyle), cosmetics.map(([, style]) => style));
assert.deepEqual(auras.map(({ group }) => group.children.length), [3, 6, 1, 1, 6, 9, 3]);
assert.equal(auras[0].group.children[0].geometry.type, 'torus');
assert.equal(auras[0].group.children[1].geometry.type, 'cylinder');
assert.equal(auras[0].group.children[2].geometry.type, 'box');
assert.equal(auras[1].group.children.filter(({ geometry }) => geometry.type === 'box').length, 2);
assert.equal(auras[1].group.children.filter(({ geometry }) => geometry.type === 'sphere').length, 4);
assert.equal(auras[2].group.children[0].position.y, 1.72, 'o crescente flutua acima do herói');
assert.ok(auras[2].group.children[0].geometry.args[4] < Math.PI * 2, 'o halo do véu é um arco aberto');
assert.equal(auras[3].group.children[0].geometry.args[3], 6, 'o brasão usa uma borda hexagonal');
assert.equal(auras[4].group.children.filter(({ geometry }) => geometry.type === 'cone').length, 5);
assert.equal(auras[5].group.children.filter(({ geometry }) => geometry.type === 'cone').length, 8, 'Vanguarda forma um halo de oito pontas');
assert.equal(auras[6].group.children.filter(({ geometry }) => geometry.type === 'torus').length, 2, 'Pesadelo envolve o nó espectral com dois arcos');
assert.equal(auras[6].group.children[0].geometry.type, 'knot');
assert.ok(auras.every(({ group, material }) => group.children.every((mesh) => mesh.material === material)), 'peças de um efeito compartilham um material');
assert.notEqual(auras[0].material, make('vila', 'banner').material, 'heróis podem liberar o material sem afetar outros efeitos');
assert.equal(auras[0].group.children[0].geometry, make('vila', 'banner').group.children[0].geometry, 'a geometria do estandarte é compartilhada');
assert.equal(make('legado', 'estilo-inválido').group.userData.auraStyle, 'banner', 'estilo ausente cai no efeito conhecido');

console.log('OK: sete cosméticos têm formas próprias, animação configurada e geometrias compartilhadas');
