const CRATES = Object.freeze({
  model: 'crates_stacked', x: 1.28, z: -0.65, scale: 0.2, ry: 0.2, lift: 0, collisionRadius: 0.36,
});
const BARREL = Object.freeze({
  model: 'barrel_small', x: -1.28, z: -0.62, scale: 0.3, ry: 0, lift: 0, collisionRadius: 0.34,
});
const CHAIR = Object.freeze({
  model: 'chair', x: -1.35, z: -0.18, scale: 0.42, ry: 0, lift: 0, collisionRadius: 0.38,
});
const TORCH = Object.freeze({ model: 'torch_mounted', x: 0.9, z: -0.2, scale: 0.55, ry: Math.PI, lift: 1.2 });
const BANNER = Object.freeze({ model: 'banner_patternA_red', x: 0.9, z: -0.29, scale: 0.35, ry: 0, lift: 1 });

export function villageMarketPropsForStall(index) {
  const props = [CRATES, index % 2 === 0 ? BARREL : CHAIR];
  if (index % 2 === 0) props.push(TORCH);
  if (index === 1) props.push(BANNER);
  return props;
}
