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
class Mesh { constructor(geometry, material) { Object.assign(this, { geometry, material, userData: {}, position: {}, castShadow: true, frustumCulled: true, renderOrder: 0 }); } }
const THREE = { Color, ShaderMaterial, Float32BufferAttribute, BufferGeometry, Mesh, DoubleSide: 2, AdditiveBlending: 2, NormalBlending: 1 };
const context = vm.createContext({ THREE, Math });
vm.runInContext(`${source}\nthis.api = { PALETTES, vfxMaterial, vfxMesh, spriteGeometry, SPRITE, tickVfx, setVfxQuality, disposeVfx, vfxInfo };`, context);
const { PALETTES, vfxMaterial, vfxMesh, spriteGeometry, SPRITE, tickVfx, setVfxQuality, disposeVfx, vfxInfo } = context.api;
const KINDS = ['flame', 'orb', 'puff', 'leaf', 'rune', 'embers', 'rays', 'ice'];

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
assert.equal(a.material, b.material, 'partículas do mesmo tipo dividem o material');
assert.equal(a.geometry, b.geometry, 'e a geometria');
assert.equal(a.castShadow, false);
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
assert.equal(disposedGeos, 1, 'geometria do anel descartada; o quadrado básico continua');
assert.equal(vfxInfo().materials, 0);
assert.notEqual(vfxMaterial('flame', 'fire'), fire, 'depois do descarte um material novo é criado');

// o jogo só pede tipos e paletas que existem
const main = fs.readFileSync(path.join(dir, 'main.js'), 'utf8') + fs.readFileSync(path.join(dir, 'characters.js'), 'utf8');
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
