// node cavaleiros/tests/vfx-shaders.cjs — shaders de efeito: um material por tipo e paleta, relógio global,
// parâmetros por malha, qualidade baixa, descarte e paletas usadas pelo jogo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(dir, 'vfx-shaders.js'), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '');

// THREE mínimo: ShaderMaterial só guarda os parâmetros (sem WebGL)
let disposedMats = 0, disposedGeos = 0;
class Color { constructor(hex) { this.hex = hex; } getHex() { return this.hex; } }
class ShaderMaterial {
  constructor(p) { Object.assign(this, p); this.userData = {}; this.needsUpdate = false; this.uniformsNeedUpdate = false; }
  dispose() { disposedMats++; }
}
class Float32BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; } }
class BufferGeometry {
  constructor() { this.attributes = {}; this.userData = {}; }
  setAttribute(n, a) { this.attributes[n] = a; } setIndex(i) { this.index = i; } dispose() { disposedGeos++; }
}
class Mesh { constructor(geometry, material) { Object.assign(this, { geometry, material, userData: {}, position: { x: 0, y: 0, z: 0 }, castShadow: true, frustumCulled: true, renderOrder: 0 }); } }
const THREE = { Color, ShaderMaterial, Float32BufferAttribute, BufferGeometry, Mesh, DoubleSide: 2, AdditiveBlending: 2, NormalBlending: 1 };
const context = vm.createContext({ THREE, Math });
vm.runInContext(`${source}\nthis.api = { PALETTES, vfxMaterial, vfxMesh, spriteGeometry, radialSpriteGeometry, SPRITE, tickVfx, setVfxQuality, disposeVfx, vfxInfo };`, context);
const { PALETTES, vfxMaterial, vfxMesh, spriteGeometry, radialSpriteGeometry, SPRITE, tickVfx, setVfxQuality, disposeVfx, vfxInfo } = context.api;
const KINDS = ['flame', 'orb', 'puff', 'leaf', 'rune', 'embers', 'rays', 'ice'];

// Bounds de esfera simplificados para conferir quais posições o renderer poderia testar.
function mockBounds(geometry) {
  const p = geometry.attributes.position.array;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], p[i + axis]);
    max[axis] = Math.max(max[axis], p[i + axis]);
  }
  const center = min.map((v, axis) => (v + max[axis]) / 2);
  let radius = 0;
  for (let i = 0; i < p.length; i += 3) radius = Math.max(radius, Math.hypot(p[i] - center[0], p[i + 1] - center[1], p[i + 2] - center[2]));
  return { center, radius };
}
function mockFrustumSees(mesh, minX, maxX) {
  if (!mesh.frustumCulled) return true;
  const bounds = mesh.geometry.boundingSphere;
  const centerX = bounds.center[0] + mesh.position.x;
  return centerX + bounds.radius >= minX && centerX - bounds.radius <= maxX;
}

// um material por tipo e paleta, reaproveitado; cores da paleta nos uniforms
const fire = vfxMaterial('flame', 'fire');
assert.equal(vfxMaterial('flame', 'fire'), fire, 'mesmo tipo e paleta devolvem o mesmo material');
assert.notEqual(vfxMaterial('flame', 'necro'), fire, 'outra paleta é outro material');
assert.equal(fire.uniforms.uCore.value.getHex(), PALETTES.fire.core);
assert.equal(vfxMaterial('flame', 'necro').uniforms.uMid.value.getHex(), PALETTES.necro.mid, 'fogo verde do necromante');
assert.equal(fire.userData.keep, true, 'material compartilhado não é descartado pelos efeitos');
assert.ok(fire.userData.vfx, 'material marcado como efeito (heróis não o clonam)');
assert.equal(fire.depthWrite, false);
assert.throws(() => vfxMaterial('flame', 'xadrez'), /desconhecido/);
assert.throws(() => vfxMaterial('raio-laser', 'fire'), /desconhecido/);

// todas as combinações montam um shader com main(); sprites usam o vértice voltado à câmera
for (const kind of KINDS) for (const pal of Object.keys(PALETTES)) {
  const m = vfxMaterial(kind, pal);
  assert.match(m.fragmentShader, /void main\(\)/, `${kind}:${pal} tem fragment shader`);
  assert.equal(m.vertexShader.includes('aCenter'), ['flame', 'orb', 'puff', 'leaf'].includes(kind), `${kind}: billboard só nos sprites`);
}
assert.equal(vfxInfo().materials, KINDS.length * Object.keys(PALETTES).length, 'nenhum material extra além de um por tipo/paleta');

// relógio global: um único uniform para todos
assert.equal(fire.uniforms.uTime, vfxMaterial('ice', 'frost').uniforms.uTime, 'uTime é o mesmo objeto em todos os materiais');
const t0 = vfxInfo().time;
tickVfx(0.5);
assert.equal(fire.uniforms.uTime.value, t0 + 0.5);

// malha: material compartilhado, sem sombra; parâmetros próprios enviados antes do desenho
const a = vfxMesh('flame', 'fire', SPRITE, { size: 2, opacity: 0.4, seed: 3 });
const b = vfxMesh('flame', 'fire');
const flatPlane = new BufferGeometry();
flatPlane.setAttribute('position', new Float32BufferAttribute([11, 0, -1, 13, 0, -1, 13, 0, 1, 11, 0, 1], 3));
flatPlane.boundingSphere = mockBounds(flatPlane);
const flatIce = vfxMesh('ice', 'frost', flatPlane);
const flatRays = vfxMesh('rays', 'holy', flatPlane);
const offsetSpriteGeometry = spriteGeometry([[12, 0, 0, 1, 0]]);
offsetSpriteGeometry.boundingSphere = mockBounds(offsetSpriteGeometry);
const offsetSprite = vfxMesh('flame', 'fire', offsetSpriteGeometry, { size: 1 });
assert.equal(a.material, b.material, 'partículas do mesmo tipo dividem o material');
assert.equal(a.geometry, b.geometry, 'e a geometria');
assert.equal(a.castShadow, false);
assert.equal(a.frustumCulled, false, 'billboards continuam sem culling porque o vertex shader desloca os quadrados');
assert.equal(b.frustumCulled, false, 'todos os sprites usam a mesma regra segura de culling');
assert.equal(flatIce.frustumCulled, true, 'malhas FLAT_VERT usam o frustum culling padrão');
assert.equal(flatRays.frustumCulled, true, 'raios planos também permitem culling pela geometria');
assert.deepEqual(flatPlane.boundingSphere, { center: [12, 0, 0], radius: Math.sqrt(2) }, 'bounds planos cobrem os vértices realmente enviados ao FLAT_VERT');
assert.equal(mockFrustumSees(flatIce, 11.5, 12.5), true, 'efeito plano é visível quando os bounds da geometria cruzam o frustum');
assert.equal(mockFrustumSees(flatIce, -1, 1), false, 'efeito plano sai do frustum quando seus bounds ficam fora');
assert.deepEqual(offsetSpriteGeometry.boundingSphere, { center: [0, 0, 0], radius: Math.SQRT1_2 }, 'bounds da malha sprite não incluem o centro aplicado depois pelo vertex shader');
assert.equal(mockFrustumSees(offsetSprite, 11.5, 12.5), true, 'billboard deslocado no shader fica visível com culling desligado');
assert.equal(mockFrustumSees({ ...offsetSprite, frustumCulled: true }, 11.5, 12.5), false, 'culling geométrico comum descartaria incorretamente esse billboard');
a.material.onBeforeRender(null, null, null, a.geometry, a);
assert.equal(fire.uniforms.uSize.value, 2);
assert.equal(fire.uniforms.uOpacity.value, 0.4);
assert.equal(fire.uniforms.uSeed.value, 3);
assert.equal(fire.uniformsNeedUpdate, true, 'pede o reenvio dos uniforms a cada malha');
b.userData.fx.opacity = 0.9;
b.material.onBeforeRender(null, null, null, b.geometry, b);
assert.equal(fire.uniforms.uOpacity.value, 0.9, 'cada malha manda a própria opacidade');
const clone = { userData: JSON.parse(JSON.stringify(a.userData)) };   // clone do three copia userData por JSON
fire.onBeforeRender(null, null, null, a.geometry, clone);
assert.equal(fire.uniforms.uSize.value, 2, 'os parâmetros sobrevivem ao clone do boneco');

// geometria de vários quadrados (anel de chamas numa malha só), guardada por chave
const ring = spriteGeometry([[0, 0, 0, 1, 0], [1, 0, 0, 0.5, 1], [0, 0, 1, 0.7, 2]], 'teste');
assert.equal(spriteGeometry([], 'teste'), ring, 'mesma chave, mesma geometria');
assert.equal(ring.attributes.position.count, 12, 'quatro vértices por chama');
assert.equal(ring.attributes.aCenter.count, 12);
assert.equal(ring.index.length, 18, 'dois triângulos por chama');
assert.equal(ring.attributes.aScale.array[4], 0.5, 'cada chama tem a própria escala');
const radial = radialSpriteGeometry(12);
assert.equal(radialSpriteGeometry(12), radial, 'o anel reutiliza sua geometria em outras habilidades');
assert.equal(radial.attributes.aCenter.count, 48, 'doze sprites compartilham a geometria do anel');
assert.equal(radial.index.length, 72, 'cada sprite mantém seus dois triângulos');
for (let i = 0; i < 12; i++) {
  const j = i * 12;
  assert.ok(Math.abs(Math.hypot(radial.attributes.aCenter.array[j], radial.attributes.aCenter.array[j + 2]) - 1) < 1e-5, 'cada centro fica na circunferência unitária');
  assert.ok(radial.attributes.aScale.array[i * 4] >= 0.8 && radial.attributes.aScale.array[i * 4] <= 1.25, 'cada chama preserva variação de escala');
}
assert.throws(() => radialSpriteGeometry(0), /ao menos um sprite/);

// Gráficos: baixa troca o ruído por uma oitava e recompila os materiais existentes
setVfxQuality(true);
assert.equal(fire.defines.OCTAVES, 1);
assert.equal(fire.needsUpdate, true);
assert.equal(vfxMaterial('orb', 'fire').defines.OCTAVES, 1);
setVfxQuality(false);
assert.equal(fire.defines.OCTAVES, 3);

// descarte: libera materiais e geometrias com chave (o quadrado básico fica)
const total = vfxInfo().materials;
disposeVfx();
assert.equal(disposedMats, total, 'todos os materiais descartados');
assert.equal(disposedGeos, 2, 'geometrias com chave são descartadas; o quadrado básico continua');
assert.equal(vfxInfo().materials, 0);
assert.notEqual(vfxMaterial('flame', 'fire'), fire, 'depois do descarte um material novo é criado');

// o jogo só pede tipos e paletas que existem
const main = fs.readFileSync(path.join(dir, 'main.js'), 'utf8') + fs.readFileSync(path.join(dir, 'characters.js'), 'utf8');
const flameRing = main.slice(main.indexOf('function flameRing('), main.indexOf('// bola de fogo que incha'));
assert.match(flameRing, /radialSpriteGeometry\(n\)/);
assert.equal((flameRing.match(/vfxMesh\(/g) || []).length, 1, 'um anel inteiro usa uma única malha e chamada de desenho');
const used = [];
for (const m of main.matchAll(/(?:vfxMesh|sprite|shaderDisc)\('(\w+)', '(\w+)'/g)) used.push([m[1], m[2]]);
for (const m of main.matchAll(/\b(?:flameRing|blast|puffs|rays)\([^;]*?, '(\w+)'[,)]/g)) if (!KINDS.includes(m[1])) used.push([null, m[1]]);
for (const m of main.matchAll(/SIGIL_RUNES = \{([^}]*)\}/g)) for (const p of m[1].matchAll(/'(\w+)'/g)) used.push(['rune', p[1]]);
assert.ok(used.length > 20, 'efeitos em shader usados no jogo');
for (const [kind, pal] of used) {
  if (kind) assert.ok(KINDS.includes(kind), `tipo de efeito inexistente: ${kind}`);
  assert.ok(PALETTES[pal], `paleta inexistente: ${pal}`);
}
for (const id of ['pyro', 'cryo', 'arcane', 'necro', 'druid', 'paladin', 'chronist']) assert.ok(main.includes(`${id}:`), `${id} citado nos efeitos`);

console.log('OK: shaders de efeito compartilhados por tipo/paleta, relógio global, parâmetros por malha, qualidade baixa e descarte');
