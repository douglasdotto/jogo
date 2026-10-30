// node tools/strip-glb-anims.cjs entrada.glb [saida.glb] [--keep Clip1,Clip2]
// Reescreve um GLB sem as animações embutidas (ou só com as listadas em --keep) e sem os dados binários que
// só elas usavam. Os heróis 1.0 (Knight, Barbarian, Mage, Rogue, Rogue_Hooded) traziam 76 clipes cada
// (~3,2 MB por arquivo); as animações agora vêm uma vez só do pacote Character Animations (hero-anims.js).
const fs = require('node:fs');

const args = process.argv.slice(2);
const keepAt = args.indexOf('--keep');
const keep = keepAt >= 0 ? new Set(args.splice(keepAt, 2)[1].split(',')) : new Set();
const [input, output = input] = args;

const src = fs.readFileSync(input);
const jsonLen = src.readUInt32LE(12);
const g = JSON.parse(src.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;
const bin = src.subarray(binStart, binStart + src.readUInt32LE(20 + jsonLen));

g.animations = (g.animations || []).filter((a) => keep.has(a.name));
if (!g.animations.length) delete g.animations;

// acessores e bufferViews ainda usados
const usedAcc = new Set();
for (const mesh of g.meshes || []) for (const p of mesh.primitives) {
  Object.values(p.attributes).forEach((i) => usedAcc.add(i));
  if (p.indices !== undefined) usedAcc.add(p.indices);
  for (const t of p.targets || []) Object.values(t).forEach((i) => usedAcc.add(i));
}
for (const skin of g.skins || []) if (skin.inverseBindMatrices !== undefined) usedAcc.add(skin.inverseBindMatrices);
for (const a of g.animations || []) for (const s of a.samplers) { usedAcc.add(s.input); usedAcc.add(s.output); }
const accOrder = [...usedAcc].sort((a, b) => a - b), accMap = new Map(accOrder.map((old, i) => [old, i]));
const usedView = new Set(accOrder.map((i) => g.accessors[i].bufferView).filter((v) => v !== undefined));
for (const img of g.images || []) if (img.bufferView !== undefined) usedView.add(img.bufferView);
const viewOrder = [...usedView].sort((a, b) => a - b), viewMap = new Map(viewOrder.map((old, i) => [old, i]));

// binário novo, cada bufferView alinhado em 4 bytes
const chunks = [];
let offset = 0;
const views = viewOrder.map((old) => {
  const v = { ...g.bufferViews[old] };
  const data = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  v.byteOffset = offset; v.buffer = 0;
  chunks.push(data); offset += data.length;
  return v;
});
const newBin = Buffer.concat(chunks);
g.bufferViews = views;
g.buffers = [{ byteLength: newBin.length }];
g.accessors = accOrder.map((old) => ({ ...g.accessors[old], ...(g.accessors[old].bufferView !== undefined && { bufferView: viewMap.get(g.accessors[old].bufferView) }) }));
for (const img of g.images || []) if (img.bufferView !== undefined) img.bufferView = viewMap.get(img.bufferView);
for (const mesh of g.meshes || []) for (const p of mesh.primitives) {
  for (const k of Object.keys(p.attributes)) p.attributes[k] = accMap.get(p.attributes[k]);
  if (p.indices !== undefined) p.indices = accMap.get(p.indices);
  for (const t of p.targets || []) for (const k of Object.keys(t)) t[k] = accMap.get(t[k]);
}
for (const skin of g.skins || []) if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = accMap.get(skin.inverseBindMatrices);
for (const a of g.animations || []) for (const s of a.samplers) { s.input = accMap.get(s.input); s.output = accMap.get(s.output); }

const pad4 = (buf, fill) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, fill)]);
const json = pad4(Buffer.from(JSON.stringify(g)), 0x20), body = pad4(newBin, 0);
const header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
header.write('glTF', 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + body.length, 8);
jh.writeUInt32LE(json.length, 0); jh.write('JSON', 4);
bh.writeUInt32LE(body.length, 0); bh.write('BIN\0', 4);
fs.writeFileSync(output, Buffer.concat([header, jh, json, bh, body]));
console.log(`${input}: ${src.length} -> ${12 + 16 + json.length + body.length} bytes`);
