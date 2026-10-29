// Efeitos procedurais em shader (fogo, gelo, runas, luz, fumaça, folhas) no estilo cartum do jogo.
// Um material compartilhado por tipo e paleta; o relógio é um uniform global; cada malha guarda os
// próprios parâmetros (opacidade, tamanho, semente, progresso) e os envia logo antes de ser desenhada.
import * as THREE from 'three';

// paletas: núcleo (claro), meio e borda; o fogo vai do branco-amarelo ao vermelho
export const PALETTES = {
  fire:   { core: 0xfff6c8, mid: 0xffb12e, edge: 0xe8401a },
  rage:   { core: 0xffd0a0, mid: 0xff5a2a, edge: 0x9a1010 },
  holy:   { core: 0xfffbe8, mid: 0xffe27a, edge: 0xf0a83a },
  necro:  { core: 0xd8ffe0, mid: 0x3cff6a, edge: 0x0f7a2a },
  arcane: { core: 0xf3e6ff, mid: 0xb07cff, edge: 0x6a2ad8 },
  chrono: { core: 0xeafcff, mid: 0x8feaff, edge: 0x8a74ff },
  frost:  { core: 0xffffff, mid: 0xaef4ff, edge: 0x4aa8e0 },
  nature: { core: 0xe8ff9a, mid: 0x8fe05a, edge: 0x3f8a2a },
  smoke:  { core: 0xd2cbc4, mid: 0x8a817a, edge: 0xeee8e2 },   // fumaça: luz, sombra e borda
  dust:   { core: 0xf2e4c6, mid: 0xc4aa82, edge: 0xfaf0dc },
  gloom:  { core: 0x3a5a40, mid: 0x16281a, edge: 0x4dff7a },   // necro: fumaça escura de borda verde
  shadow: { core: 0x5e4282, mid: 0x2a1a42, edge: 0xb48cff },   // assassino: sombra roxa
  frostMist: { core: 0xf4fdff, mid: 0xbfe9f7, edge: 0xffffff },
  hunt:   { core: 0xeafff8, mid: 0x5ff0c8, edge: 0x1f9a7a },   // Arqueira: verde-água da marca de caça
  venom:  { core: 0xf0ffb0, mid: 0x9cff3a, edge: 0x3f9a1a },   // Alquimista: veneno borbulhando
  tonic:  { core: 0xfff0fb, mid: 0xff8ad8, edge: 0xc23a9a },   // Alquimista: tônico e transmutação
};

const vfxTime = { value: 0 };
export function tickVfx(dt) { vfxTime.value = (vfxTime.value + dt) % 1000; }   // volta antes de perder precisão

const COMMON = `
  uniform float uTime, uOpacity, uSeed, uProgress;
  uniform vec3 uCore, uMid, uEdge;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5, s = 0.0;
    for (int i = 0; i < OCTAVES; i++) { v += a * noise(p); s += a; p = p * 2.03 + 17.1; a *= 0.5; }
    return v / s;
  }
  // três faixas chapadas (borda, meio, núcleo): visual de desenho animado
  vec3 toon(float e, float a, float b) { return mix(mix(uEdge, uMid, smoothstep(a, a + 0.03, e)), uCore, smoothstep(b, b + 0.03, e)); }
`;

// quadrado voltado à câmera: cada vértice sabe o centro da sua chama (aCenter), o tamanho e a semente
const SPRITE_VERT = `
  attribute vec3 aCenter; attribute float aScale; attribute float aSeed;
  uniform float uSize;
  varying vec2 vUv; varying float vSeed;
  void main() {
    vUv = uv; vSeed = aSeed;
    vec4 c = modelViewMatrix * vec4(aCenter, 1.0);
    float s = length(modelMatrix[1].xyz) * uSize * aScale;
    c.xy += (position.xy + vec2(0.0, LIFT)) * s;
    gl_Position = projectionMatrix * c;
  }`;

const FLAT_VERT = `
  varying vec2 vUv; varying vec3 vView; varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vec4 mv = viewMatrix * w;
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = {
  // chama em gota: o ruído sobe, a ponta balança e come a borda
  flame: `
    void main() {
      float seed = uSeed + vSeed * 7.13, t = uTime;
      vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y);
      float n = fbm(vec2(p.x * 1.7 + seed, p.y * 2.3 - t * 3.4 + seed * 1.7));
      p.x += (n - 0.5) * 0.7 * p.y + sin(t * 6.0 + seed * 3.0 + p.y * 5.0) * 0.07 * p.y;
      float w = 0.68 * pow(max(1.0 - p.y, 0.0), 0.9) * smoothstep(-0.12, 0.3, p.y);
      float e = (1.0 - abs(p.x) / max(w, 0.001)) * (1.05 - p.y * 0.55);
      e += (fbm(vec2(p.x * 4.0 - seed, p.y * 4.5 - t * 5.0)) - 0.5) * 0.55 - uProgress * 0.8;
      if (e < 0.06) discard;
      gl_FragColor = vec4(toon(e, 0.3, 0.62), smoothstep(0.06, 0.1, e) * uOpacity);
    }`,
  // bola de energia: núcleo claro, línguas subindo pelas bordas
  orb: `
    void main() {
      float seed = uSeed + vSeed * 7.13, t = uTime;
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p);
      float n = fbm(p * 2.2 + vec2(seed, seed - t * 2.6));
      float e = 1.0 - r * 1.35 + (n - 0.5) * 0.75 + max(p.y, 0.0) * (n - 0.35) * 0.6 - uProgress * 0.9;
      if (e < 0.05) discard;
      gl_FragColor = vec4(toon(e, 0.22, 0.48), smoothstep(0.05, 0.09, e) * uOpacity);
    }`,
  // fumaça cartum: bolinho de duas cores com luz de cima, dissolve com o ruído (uProgress)
  puff: `
    void main() {
      float seed = uSeed + vSeed * 7.13, t = uTime;
      vec2 p = vUv * 2.0 - 1.0;
      float n = fbm(p * 2.0 + vec2(seed, seed * 0.7 - t * 0.5));
      float e = 1.0 - length(p) * 1.25 + (n - 0.5) * 0.7 - uProgress * 0.75;
      if (e < 0.02) discard;
      float light = p.y * 0.6 + p.x * 0.25 + n * 0.5;
      vec3 c = mix(uMid, uCore, step(0.22, light));
      c = mix(uEdge, c, smoothstep(0.08, 0.11, e));
      // miolo quase opaco, borda translúcida: lê como fumaça, não como pedra
      gl_FragColor = vec4(c, (0.35 + 0.45 * smoothstep(0.05, 0.3, e)) * smoothstep(0.02, 0.05, e) * uOpacity);
    }`,
  // folha girando com nervura e borda brilhante
  leaf: `
    void main() {
      float seed = uSeed + vSeed * 7.13, a = seed * 6.28 + uTime * (1.5 + fract(seed) * 2.0);
      vec2 p = vUv * 2.0 - 1.0;
      p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
      float w = 0.5 * (1.0 - p.y * p.y);
      float e = 1.0 - abs(p.x) / max(w, 0.001);
      if (e < 0.0 || abs(p.y) > 0.98) discard;
      vec3 c = mix(uEdge, uMid, step(0.0, p.x));
      c = mix(c, uEdge * 0.7, 1.0 - smoothstep(0.0, 0.06, abs(p.x)));   // nervura
      c = mix(uCore, c, smoothstep(0.12, 0.2, e));                      // borda acesa
      gl_FragColor = vec4(c, uOpacity);
    }`,
  // círculo de runas no chão: dois anéis, marcas sorteadas por setor e brilho de ruído; gira com o tempo
  rune: `
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p);
      if (r > 1.0) discard;
      float spin = uTime * (0.6 + uSeed * 0.2) * (mod(uSeed, 2.0) < 1.0 ? 1.0 : -1.0);
      float a = atan(p.y, p.x) + spin;
      float ring = smoothstep(0.035, 0.0, abs(r - 0.95)) + smoothstep(0.025, 0.0, abs(r - 0.7));
      float seg = a / 6.2832 * 14.0, cell = floor(seg), u = fract(seg), v = (r - 0.74) / 0.18;
      float g = 0.0;
      if (v > 0.0 && v < 1.0 && u > 0.18 && u < 0.82) {
        float h = hash(vec2(cell, uSeed));
        g += step(0.5, h) * smoothstep(0.08, 0.0, abs(u - 0.5));
        g += step(0.3, fract(h * 7.0)) * smoothstep(0.08, 0.0, abs(v - 0.25)) ;
        g += step(0.6, fract(h * 13.0)) * smoothstep(0.08, 0.0, abs(v - 0.75));
        g += step(0.4, fract(h * 29.0)) * smoothstep(0.07, 0.0, abs(u - v));
      }
      float b = -a * 1.0 + spin * 2.0;   // estrela interna girando ao contrário
      vec2 q = vec2(cos(b), sin(b)) * r;
      float star = 0.0;
      for (int i = 0; i < 3; i++) { float k = float(i) * 2.094; star += smoothstep(0.03, 0.0, abs(dot(q, vec2(cos(k), sin(k))) - 0.34)); }
      star *= step(r, 0.7);
      float shimmer = fbm(p * 3.0 + vec2(uTime * 0.4, -uTime * 0.3));
      float e = clamp(ring + min(g, 1.0) + star * 0.8, 0.0, 1.0);
      vec3 c = mix(uMid, uCore, step(0.7, shimmer + e * 0.3));
      float glow = 0.12 * smoothstep(1.0, 0.2, r) * shimmer;
      gl_FragColor = vec4(c, (e * (0.6 + 0.4 * shimmer) + glow) * uOpacity * (1.0 - uProgress));
    }`,
  // chão em brasa: carvão escuro com rachaduras de lava pulsando
  embers: `
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p);
      float n = fbm(p * 2.5 + uSeed);
      float edge = 1.0 - r + (n - 0.5) * 0.5;
      if (edge < 0.0) discard;
      float crack = 1.0 - abs(noise(p * 4.5 + uSeed * 3.0) - 0.5) * 2.0;
      float pulse = 0.75 + 0.25 * sin(uTime * 4.0 + n * 9.0);
      float hot = smoothstep(0.82, 0.9, crack) * pulse + smoothstep(0.35, 0.0, r) * 0.3;
      vec3 c = mix(vec3(0.16, 0.06, 0.03), uEdge, smoothstep(0.1, 0.5, hot));
      c = mix(c, uMid, step(0.55, hot));
      c = mix(c, uCore, step(0.85, hot));
      gl_FragColor = vec4(c, smoothstep(0.0, 0.12, edge) * (0.6 + 0.4 * step(0.1, hot)) * uOpacity);
    }`,
  // raios de luz (cilindro aberto): faixas suaves que sobem e somem no alto
  rays: `
    void main() {
      float x = vUv.x * 18.0;
      float n = noise(vec2(x, uTime * 0.9 + uSeed)) * 0.7 + noise(vec2(x * 2.3, -uTime * 1.3)) * 0.3;
      float ray = smoothstep(0.35, 0.85, n);
      float fade = pow(1.0 - vUv.y, 1.4) * smoothstep(0.0, 0.08, vUv.y);
      vec3 c = mix(uMid, uCore, ray);
      gl_FragColor = vec4(c, (0.18 + ray * 0.82) * fade * uOpacity);
    }`,
  // gelo facetado: normal de cada face, borda clara (fresnel) e brilho que corre pelas faces
  ice: `
    void main() {
      vec3 fn = normalize(cross(dFdx(vView), dFdy(vView)));
      vec3 eye = normalize(-vView);
      float rim = pow(1.0 - abs(dot(fn, eye)), 1.6);
      float facet = hash(floor(fn.xy * 4.0 + 10.0));
      float glint = smoothstep(0.92, 1.0, sin(dot(vWorld, vec3(2.0, 3.0, 1.5)) * 1.7 - uTime * 3.5 + uSeed));
      vec3 c = mix(uEdge, uMid, step(0.35, facet * 0.6 + rim));
      c = mix(c, uCore, step(0.62, rim + facet * 0.15) + glint);
      gl_FragColor = vec4(c, (0.72 + rim * 0.28) * uOpacity);
    }`,
};

const SPRITES = new Set(['flame', 'orb', 'puff', 'leaf']);
const ADDITIVE = new Set(['rays']);   // raio de luz soma; fogo, runas, fumaça e gelo cobrem o fundo com a própria cor
let octaves = 3;
const materials = new Map();
const DEFAULTS = { opacity: 1, size: 1, seed: 0, progress: 0 };

// envia os parâmetros da malha (userData.fx, que sobrevive a clones) ao material compartilhado logo antes do desenho
function upload(renderer, scene, camera, geometry, object) {
  const u = this.uniforms, p = object.userData.fx || DEFAULTS;
  u.uOpacity.value = p.opacity; u.uSize.value = p.size; u.uSeed.value = p.seed; u.uProgress.value = p.progress;
  this.uniformsNeedUpdate = true;
}

// material compartilhado de um tipo com uma paleta (criado uma vez só)
export function vfxMaterial(kind, palette = 'fire') {
  const key = `${kind}:${palette}`;
  let m = materials.get(key);
  if (m) return m;
  const pal = PALETTES[palette];
  if (!FRAG[kind] || !pal) throw new Error(`efeito desconhecido: ${key}`);
  const sprite = SPRITES.has(kind);
  m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: vfxTime, uOpacity: { value: 1 }, uSize: { value: 1 }, uSeed: { value: 0 }, uProgress: { value: 0 },
      uCore: { value: new THREE.Color(pal.core) }, uMid: { value: new THREE.Color(pal.mid) }, uEdge: { value: new THREE.Color(pal.edge) },
    },
    defines: { OCTAVES: octaves, LIFT: kind === 'flame' ? '0.42' : '0.0' },
    vertexShader: sprite ? SPRITE_VERT : FLAT_VERT,
    fragmentShader: `${sprite ? 'varying vec2 vUv; varying float vSeed;' : 'varying vec2 vUv; varying vec3 vView; varying vec3 vWorld; const float vSeed = 0.0;'}\n${COMMON}\n${FRAG[kind]}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: ADDITIVE.has(kind) ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  m.userData.keep = true;   // compartilhado: os efeitos não o descartam
  m.userData.vfx = key;
  m.onBeforeRender = upload;
  materials.set(key, m);
  return m;
}

// Gráficos baixos: ruído de uma oitava só (o resto da economia fica em quem cria as partículas)
export function setVfxQuality(low) {
  const next = low ? 1 : 3;
  if (next === octaves) return;
  octaves = next;
  for (const m of materials.values()) { m.defines.OCTAVES = octaves; m.needsUpdate = true; }
}

// Geometria de vários quadrados voltados à câmera numa malha só (uma chamada de desenho para um anel de chamas).
// points: [x, y, z, escala, semente]
const geometries = new Map();
export function spriteGeometry(points = [[0, 0, 0, 1, 0]], key = null) {
  if (key && geometries.has(key)) return geometries.get(key);
  const n = points.length, pos = [], uv = [], center = [], scale = [], seed = [], index = [];
  points.forEach(([x, y, z, s = 1, sd = 0], i) => {
    for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      pos.push(cx, cy, 0); uv.push(cx + 0.5, cy + 0.5); center.push(x, y, z); scale.push(s); seed.push(sd);
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(center, 3));
  g.setAttribute('aScale', new THREE.Float32BufferAttribute(scale, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  g.setIndex(index);
  g.userData.sprites = n;
  if (key) geometries.set(key, g);
  return g;
}
export const SPRITE = spriteGeometry(undefined, 'sprite');

// malha de efeito com material compartilhado; mexa em mesh.userData.fx (opacity, size, seed, progress)
export function vfxMesh(kind, palette, geo = SPRITE, o = {}) {
  const m = new THREE.Mesh(geo, vfxMaterial(kind, palette));
  m.userData.fx = { opacity: o.opacity ?? 1, size: o.size ?? 1, seed: o.seed ?? Math.random() * 10, progress: o.progress ?? 0 };
  m.castShadow = false;
  m.frustumCulled = false;   // os quadrados saem da caixa da geometria ao virar para a câmera
  m.renderOrder = o.renderOrder ?? 2;
  return m;
}

// libera tudo (troca de cena ou testes)
export function disposeVfx() {
  for (const m of materials.values()) m.dispose();
  materials.clear();
  for (const [key, g] of geometries) if (key !== 'sprite') { g.dispose(); geometries.delete(key); }
}

export const vfxInfo = () => ({ materials: materials.size, geometries: geometries.size, time: vfxTime.value, octaves });
