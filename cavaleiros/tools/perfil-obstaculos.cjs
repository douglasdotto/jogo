// Perfil headless das consultas de obstáculos feitas por Unit.moveTo.
// Instrumenta o harness e main.js somente em memória; nenhuma lógica de produção é alterada.
// Injeta 600 obstáculos remotos para exercitar a grade sem mudar a rota dos heróis.
// Uso: node tools/perfil-obstaculos.cjs campanha ponte normal 1 recomendado 20261030
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const readConstant = (name) => {
  const match = mainSource.match(new RegExp(`const ${name} = ([\\d.]+);`));
  if (!match) throw new Error(`Constante ${name} não encontrada em main.js.`);
  return Number(match[1]);
};
const CELL_SIZE = readConstant('SEPARATION_CELL_SIZE');
const QUERY_THRESHOLD = readConstant('OBSTACLE_GRID_QUERY_THRESHOLD');
const REMOTE_OBSTACLE_COUNT = 600;

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

class ObstacleQueryProfile {
  constructor() {
    this.frame = -1;
    this.frames = [];
    this.calls = 0;
    this.outsideFrameCalls = 0;
    this.obstacleCounts = new Map();
    this.rangeCounts = new Map();
    this.exactRangeCounts = new Map();
    this.gridPathCalls = 0;
    this.queryCacheHits = 0;
    this.queryCacheMisses = 0;
    this.grid = {
      queries: 0,
      rangeCounts: new Map(),
      exactRangeCounts: new Map(),
      cellsVisited: 0,
      occupiedCells: 0,
      bucketEntriesRead: 0,
      uniqueCandidates: 0,
      duplicatesSkipped: 0,
      remoteCandidates: 0,
      candidateCounts: [],
    };
    this.activeGridQuery = null;
    this.remoteStartByWorld = new WeakMap();
  }

  nextFrame() {
    this.frame++;
    this.frames.push({ calls: 0, ranges: new Set(), gridCalls: 0, gridRanges: new Set(), obstacles: new Set() });
  }

  addRemoteObstacles(world) {
    this.remoteStartByWorld.set(world.obstacles, world.obstacles.length);
    for (let i = 0; i < REMOTE_OBSTACLE_COUNT; i++) {
      world.obstacles.push({ x: 100000 + i * 4, z: 100000, r: 0.8 });
    }
  }

  instrumentMain(source) {
    source = source.replace(/\r\n/g, '\n');
    source = replaceOnce(
      source,
      'function queryObstacleCandidates(minX, maxX, minZ, maxZ, margin = 0) {',
      'function queryObstacleCandidates(minX, maxX, minZ, maxZ, margin = 0) {\n  globalThis.__obstacleProfile?.record(minX, maxX, minZ, maxZ, margin, world.obstacles.length);',
      'entrada da consulta de obstáculos',
    );
    source = replaceOnce(
      source,
      '    obstacleQueryCache.set(cacheKey, cached); // LRU: a consulta mais recente fica por último\n    return cached;',
      '    obstacleQueryCache.set(cacheKey, cached); // LRU: a consulta mais recente fica por último\n    globalThis.__obstacleProfile?.queryCacheHit();\n    return cached;',
      'hit no cache de consultas',
    );
    source = replaceOnce(
      source,
      '  obstacleQueryIndexes.length = 0;\n  obstacleQuerySeen.clear();',
      '  globalThis.__obstacleProfile?.queryCacheMiss();\n  globalThis.__obstacleProfile?.beginGridQuery(minCellX, maxCellX, minCellZ, maxCellZ);\n  obstacleQueryIndexes.length = 0;\n  obstacleQuerySeen.clear();',
      'miss no cache de consultas',
    );
    source = replaceOnce(
      source,
      '  const minCellX = Math.floor(minX / SEPARATION_CELL_SIZE), maxCellX = Math.floor(maxX / SEPARATION_CELL_SIZE);\n  const minCellZ = Math.floor(minZ / SEPARATION_CELL_SIZE), maxCellZ = Math.floor(maxZ / SEPARATION_CELL_SIZE);',
      '  const minCellX = Math.floor(minX / SEPARATION_CELL_SIZE), maxCellX = Math.floor(maxX / SEPARATION_CELL_SIZE);\n  const minCellZ = Math.floor(minZ / SEPARATION_CELL_SIZE), maxCellZ = Math.floor(maxZ / SEPARATION_CELL_SIZE);',
      'limites de células da grade',
    );
    source = replaceOnce(
      source,
      '    const bucket = obstacleGrid.get(gridCellKey(x, z));\n    if (!bucket) continue;',
      '    const bucket = obstacleGrid.get(gridCellKey(x, z));\n    globalThis.__obstacleProfile?.visitGridBucket(bucket?.length || 0);\n    if (!bucket) continue;',
      'leitura de buckets da grade',
    );
    return replaceOnce(
      source,
      '  }\n  if (obstacleQueryIndexes.length > 1) obstacleQueryIndexes.sort(compareObstacleIndexes);',
      '  }\n  globalThis.__obstacleProfile?.endGridQuery(obstacleQueryIndexes.length, obstacleQueryIndexes, world.obstacles);\n  if (obstacleQueryIndexes.length > 1) obstacleQueryIndexes.sort(compareObstacleIndexes);',
      'deduplicação dos candidatos',
    );
  }

  beginGridQuery(minCellX, maxCellX, minCellZ, maxCellZ) {
    const key = [minCellX, maxCellX, minCellZ, maxCellZ].join(',');
    const rangeKey = `${key}|m=${this.currentMargin.toFixed(4)}`;
    this.grid.queries++;
    this.grid.rangeCounts.set(key, (this.grid.rangeCounts.get(key) || 0) + 1);
    this.grid.exactRangeCounts.set(rangeKey, (this.grid.exactRangeCounts.get(rangeKey) || 0) + 1);
    if (this.frame >= 0) {
      const frame = this.frames[this.frame];
      frame.gridCalls++;
      frame.gridRanges.add(key);
    }
    this.activeGridQuery = { cellsVisited: 0, occupiedCells: 0, bucketEntriesRead: 0 };
  }

  visitGridBucket(entries) {
    if (!this.activeGridQuery) return;
    this.activeGridQuery.cellsVisited++;
    if (entries > 0) this.activeGridQuery.occupiedCells++;
    this.activeGridQuery.bucketEntriesRead += entries;
  }

  queryCacheHit() { this.queryCacheHits++; }
  queryCacheMiss() { this.queryCacheMisses++; }

  endGridQuery(uniqueCandidates, indexes, obstacles) {
    const query = this.activeGridQuery;
    if (!query) return;
    this.grid.cellsVisited += query.cellsVisited;
    this.grid.occupiedCells += query.occupiedCells;
    this.grid.bucketEntriesRead += query.bucketEntriesRead;
    this.grid.uniqueCandidates += uniqueCandidates;
    this.grid.duplicatesSkipped += query.bucketEntriesRead - uniqueCandidates;
    const remoteStart = this.remoteStartByWorld.get(obstacles);
    if (remoteStart != null) {
      for (const index of indexes) if (index >= remoteStart) this.grid.remoteCandidates++;
    }
    this.grid.candidateCounts.push(uniqueCandidates);
    this.activeGridQuery = null;
  }

  record(minX, maxX, minZ, maxZ, margin, obstacleCount) {
    const bounds = [
      Math.floor(minX / CELL_SIZE), Math.floor(maxX / CELL_SIZE),
      Math.floor(minZ / CELL_SIZE), Math.floor(maxZ / CELL_SIZE),
    ];
    const rangeKey = bounds.join(',');
    const exactKey = `${rangeKey}|m=${Number(margin).toFixed(4)}`;
    this.calls++;
    this.currentMargin = margin;
    if (obstacleCount > QUERY_THRESHOLD) this.gridPathCalls++;
    this.obstacleCounts.set(obstacleCount, (this.obstacleCounts.get(obstacleCount) || 0) + 1);
    this.rangeCounts.set(rangeKey, (this.rangeCounts.get(rangeKey) || 0) + 1);
    this.exactRangeCounts.set(exactKey, (this.exactRangeCounts.get(exactKey) || 0) + 1);

    if (this.frame < 0) {
      this.outsideFrameCalls++;
      return;
    }
    const frame = this.frames[this.frame];
    frame.calls++;
    frame.ranges.add(rangeKey);
    frame.obstacles.add(obstacleCount);
  }

  report() {
    const counts = this.frames.map((frame) => frame.calls);
    const sortedCounts = [...counts].sort((a, b) => a - b);
    const queried = this.frames.filter((frame) => frame.calls > 0);
    const withinFrameRepeated = queried.reduce((sum, frame) => sum + frame.calls - frame.ranges.size, 0);
    const repeatedRanges = [...this.rangeCounts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key, calls]) => ({ cells: key.split(',').map(Number), calls }));
    const callHistogram = {};
    for (const count of counts) callHistogram[count] = (callHistogram[count] || 0) + 1;
    const distinctRanges = this.rangeCounts.size;
    const distinctExactRanges = this.exactRangeCounts.size;
    const distinctGridRanges = this.grid.rangeCounts.size;
    const repeatedGridFrames = this.frames.filter((frame) => frame.gridCalls > frame.gridRanges.size).length;
    const gridRepeatedCallsWithinFrame = this.frames.reduce((sum, frame) => sum + frame.gridCalls - frame.gridRanges.size, 0);
    const sortedCandidates = [...this.grid.candidateCounts].sort((a, b) => a - b);
    return {
      cellSize: CELL_SIZE,
      gridThreshold: QUERY_THRESHOLD,
      calls: this.calls,
      outsideFrameCalls: this.outsideFrameCalls,
      gridPathCalls: this.gridPathCalls,
      queryCache: {
        hits: this.queryCacheHits,
        misses: this.queryCacheMisses,
        hitPercent: this.queryCacheHits + this.queryCacheMisses
          ? Number((this.queryCacheHits / (this.queryCacheHits + this.queryCacheMisses) * 100).toFixed(1)) : 0,
      },
      obstacleCountsAtQuery: Object.fromEntries([...this.obstacleCounts.entries()].sort((a, b) => a[0] - b[0])),
      cellAabbs: {
        rangesReconstructedFromQueryBounds: this.gridPathCalls === 0,
        distinct: distinctRanges,
        repeatedCalls: this.calls - distinctRanges,
        repeatedPercent: this.calls ? Number(((this.calls - distinctRanges) / this.calls * 100).toFixed(1)) : 0,
        distinctIncludingMargin: distinctExactRanges,
        repeatedWithinFrame: withinFrameRepeated,
        framesWithSameAabbRepeated: queried.filter((frame) => frame.calls > frame.ranges.size).length,
        mostRepeated: repeatedRanges,
      },
      grid: {
        queries: this.grid.queries,
        distinctCellAabbs: distinctGridRanges,
        repeatedCellAabbQueries: this.grid.queries - distinctGridRanges,
        repeatedCellAabbPercent: this.grid.queries
          ? Number(((this.grid.queries - distinctGridRanges) / this.grid.queries * 100).toFixed(1)) : 0,
        distinctCellAabbsIncludingMargin: this.grid.exactRangeCounts.size,
        repeatedWithinFrame: gridRepeatedCallsWithinFrame,
        framesWithRepeatedAabb: repeatedGridFrames,
        cellsVisited: this.grid.cellsVisited,
        occupiedCells: this.grid.occupiedCells,
        bucketEntriesRead: this.grid.bucketEntriesRead,
        uniqueCandidatesReturned: this.grid.uniqueCandidates,
        duplicateBucketEntriesSkipped: this.grid.duplicatesSkipped,
        remoteCandidatesReturned: this.grid.remoteCandidates,
        candidatesPerQuery: {
          mean: this.grid.queries ? Number((this.grid.uniqueCandidates / this.grid.queries).toFixed(3)) : 0,
          p50: percentile(sortedCandidates, 0.5),
          p95: percentile(sortedCandidates, 0.95),
          max: sortedCandidates.reduce((max, count) => Math.max(max, count), 0),
        },
      },
      injectedRemoteObstacles: REMOTE_OBSTACLE_COUNT,
      physicsFrames: this.frames.length,
      queriedFrames: queried.length,
      zeroQueryFrames: this.frames.length - queried.length,
      callsPerFrame: {
        mean: this.frames.length ? Number((this.calls / this.frames.length).toFixed(3)) : 0,
        p50: percentile(sortedCounts, 0.5),
        p95: percentile(sortedCounts, 0.95),
        max: counts.reduce((max, count) => Math.max(max, count), 0),
        histogram: callHistogram,
      },
      avgDistinctAabbsPerQueriedFrame: queried.length
        ? Number((queried.reduce((sum, frame) => sum + frame.ranges.size, 0) / queried.length).toFixed(3)) : 0,
      avgRepeatedCallsPerPhysicsFrame: this.frames.length
        ? Number((withinFrameRepeated / this.frames.length).toFixed(3)) : 0,
    };
  }
}

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0 || source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Não foi possível instrumentar ${label}: marcador ausente ou ambíguo.`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

const simPath = path.join(__dirname, '..', 'tests', 'simulacao.cjs');
let sim = fs.readFileSync(simPath, 'utf8');
const sourceRead = "const source = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');";
const instrumentedSourceRead = 'const source = globalThis.__obstacleProfile.instrumentMain(fs.readFileSync(path.join(dir, \'main.js\'), \'utf8\'));';
sim = replaceOnce(sim, sourceRead, instrumentedSourceRead, 'consulta de obstáculos');
sim = replaceOnce(
  sim,
  'const context = vm.createContext({ THREE, document:',
  'const context = vm.createContext({ __obstacleProfile: globalThis.__obstacleProfile, THREE, document:',
  'contexto da simulação',
);
sim = replaceOnce(
  sim,
  '    t.setFrameTargetContext();',
  '    globalThis.__obstacleProfile?.nextFrame();\n    t.setFrameTargetContext();',
  'limite do passo de física',
);
sim = replaceOnce(
  sim,
  '    seedRoadObstacles(mapWorld, currentMapSeed, phases);',
  '    seedRoadObstacles(mapWorld, currentMapSeed, phases);\n    globalThis.__obstacleProfile?.addRemoteObstacles(mapWorld);',
  'injeção remota de obstáculos',
);
sim += "\nconsole.log('OBSTACLE_QUERY_PROFILE ' + JSON.stringify(globalThis.__obstacleProfile.report()));\n";

globalThis.__obstacleProfile = new ObstacleQueryProfile();
const compiled = new Module(simPath, module);
compiled.filename = simPath;
compiled.paths = Module._nodeModulePaths(path.dirname(simPath));
compiled._compile(sim, simPath);
