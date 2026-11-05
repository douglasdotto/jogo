// Geometria e posicionamento do mapa da campanha, sem estado de interface ou persistência.
export const CAMPAIGN_ROAD = { amplitude: 6, wavelength: 30, step: 6.5, chapterGap: 3.5, start: 3, end: 10 };
export const campaignRoadX = (z, road = CAMPAIGN_ROAD) => road.amplitude * Math.sin(-z / road.wavelength * Math.PI * 2);

export function layoutCampaign(missions, road = CAMPAIGN_ROAD) {
  const chapters = [];
  const marks = [];
  let s = road.start, last = -1;
  missions.forEach((m, i) => {
    let chapter = chapters.indexOf(m.chapter);
    if (chapter < 0) chapter = chapters.push(m.chapter) - 1;
    if (i > 0) s += road.step + (chapter !== last ? road.chapterGap : 0);
    last = chapter;
    marks.push({ s, chapter });
  });
  const length = s + road.end;
  // Amostras regulares por comprimento de arco; z sempre diminui rumo ao castelo.
  const samples = [{ x: campaignRoadX(0, road), z: 0, s: 0 }];
  while (samples.at(-1).s < length) {
    const a = samples.at(-1), z = a.z - 0.2, x = campaignRoadX(z, road);
    samples.push({ x, z, s: a.s + Math.hypot(x - a.x, z - a.z) });
  }
  let k = 0;
  const nodes = marks.map(({ s: at, chapter }) => {
    while (samples[k + 1].s < at) k++;
    const a = samples[k], b = samples[k + 1], t = (at - a.s) / (b.s - a.s || 1);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, s: at, chapter };
  });
  const regions = chapters.map((name, index) => {
    const own = nodes.filter((n) => n.chapter === index);
    return { name, index, from: Math.min(...own.map((n) => n.s)), to: Math.max(...own.map((n) => n.s)) };
  });
  // Mapa plano: três posições por linha, zigue-zague da base ao topo.
  const rows = Math.max(1, Math.ceil(nodes.length / 3) - 1);
  nodes.forEach((n, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    n.left = row % 2 ? 80 - 30 * col : 20 + 30 * col;
    n.top = +(94 - 88 * row / rows).toFixed(2);
  });
  return { nodes, road: samples, regions, length };
}
