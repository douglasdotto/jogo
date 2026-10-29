// Ajudas de desempenho da cena (sem dependência do three.js, testadas em tests/scene-perf.cjs).

// Cada SkinnedMesh clonada (SkeletonUtils.clone) ganha um Skeleton próprio, e o renderizador cria para ele
// uma textura de ossos na GPU. Sem dispose() ela fica viva depois que a unidade sai de cena: a cada
// esqueleto derrotado sobravam ~6 texturas. Libera cada esqueleto uma vez; devolve quantos liberou.
export function disposeSkeletons(root) {
  const done = new Set();
  root.traverse((o) => {
    const skeleton = o.isSkinnedMesh ? o.skeleton : null;
    if (!skeleton || done.has(skeleton)) return;
    done.add(skeleton);
    skeleton.dispose();
  });
  return done.size;
}

// Divide pontos em faixas de z (a estrada corre ao longo de z): cada faixa vira uma InstancedMesh própria,
// com esfera de culling pequena, e a câmera (e a sombra) só desenham as faixas por perto.
// Devolve listas de índices na ordem original, uma por faixa não vazia, da menor para a maior faixa.
export function bandsByZ(zs, size) {
  const bands = new Map();
  for (let i = 0; i < zs.length; i++) {
    const key = Math.floor(zs[i] / size);
    let list = bands.get(key);
    if (!list) bands.set(key, (list = []));
    list.push(i);
  }
  return [...bands.keys()].sort((a, b) => a - b).map((k) => bands.get(k));
}

// O mapa do jogo cabe muito dentro de ±32768 células: empacota x/z em uma chave
// numérica exata, sem alocação de strings nem retorno polimórfico no loop físico.
export function gridCellKey(x, z) {
  return x * 65536 + (z & 0xffff);
}

// As faixas animadas têm uma esfera ampliada para cobrir todo o movimento das instâncias.
// Sem frustum (por exemplo, em testes), mantém o comportamento seguro: atualizar a faixa.
export function isInstancedBandVisible(frustum, mesh) {
  if (!frustum || !mesh?.boundingSphere) return true;
  return frustum.intersectsSphere(mesh.boundingSphere);
}

// InstancedMesh mantém buffers próprios além da geometria e do material compartilhados.
export function disposeInstancedMeshes(roots) {
  const meshes = new Set();
  for (const root of roots) root?.traverse?.((obj) => {
    if (obj.isInstancedMesh && typeof obj.dispose === 'function') meshes.add(obj);
  });
  for (const mesh of meshes) mesh.dispose();
  return meshes.size;
}
