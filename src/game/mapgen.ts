import type { Tile, TerrainType, ImprovementType, UnitType } from './types';
import { EARTH_CIV_START_LAT_LON } from './constants';
import { generateEarthMapFixed } from './earthMapFixed';

/** Build playable tiles from a custom terrain matrix (editor / imported maps). */
export function createTerrainGrid(terrain: TerrainType[][], numCivs: number): Tile[][] {
  const h = terrain.length;
  const w = terrain[0]?.length ?? 0;
  const tiles: Tile[][] = [];
  for (let r = 0; r < h; r++) {
    tiles[r] = [];
    for (let c = 0; c < w; c++) {
      const ter = terrain[r]?.[c] ?? 'plains';
      tiles[r][c] = {
        q: c,
        r,
        terrain: ter,
        improvement: 'none' as ImprovementType,
        resource: null,
        owner: null,
        city: null,
        territoryCityId: null,
        unit: null,
        river: false,
        road: false,
        revealed: new Array(numCivs).fill(false),
        visible: new Array(numCivs).fill(false),
      };
    }
  }
  return tiles;
}

// ============================================================
// Seeded RNG (Mulberry32)
// ============================================================
export function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0xFFFFFFFF;
  };
}

// ============================================================
// Simplex-like noise (value noise)
// ============================================================
function valueNoise(rng: () => number, w: number, h: number): number[][] {
  const grid: number[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => rng())
  );
  // Simple smoothing pass
  const out: number[][] = Array.from({ length: h }, () => new Array(w).fill(0));
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      let sum = 0, count = 0;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < h && nc >= 0 && nc < w) {
            sum += grid[nr][nc];
            count++;
          }
        }
      }
      out[r][c] = sum / count;
    }
  }
  return out;
}

// ============================================================
// Terrain determination from elevation + moisture + latitude
// ============================================================
function getTerrain(
  elevation: number,
  moisture: number,
  latitude: number // 0=equator, 1=pole
): TerrainType {
  if (elevation < 0.28) return 'ocean';
  if (elevation < 0.35) return 'coast';
  if (elevation > 0.88) return 'mountains';
  if (elevation > 0.75) return 'hills';

  // Polar regions
  if (latitude > 0.80) return 'snow';
  if (latitude > 0.65) return 'tundra';

  // Tropical
  if (latitude < 0.30) {
    if (moisture > 0.55) return 'jungle';
    if (moisture > 0.35) return 'grassland';
    return 'desert';
  }

  // Temperate
  if (moisture > 0.60) return 'forest';
  if (moisture > 0.40) return 'grassland';
  if (moisture > 0.22) return 'plains';
  return 'desert';
}

// ============================================================
// Resource placement
// ============================================================
const TERRAIN_RESOURCES: Partial<Record<TerrainType, string[]>> = {
  grassland: ['wheat', 'cattle', 'sheep', 'horse'],
  plains:    ['wheat', 'cattle', 'sheep', 'horse', 'iron'],
  forest:    ['deer', 'iron'],
  jungle:    ['spices', 'gems'],
  hills:     ['gold_ore', 'silver', 'iron', 'coal'],
  desert:    ['gold_ore', 'silver', 'oil'],
  coast:     ['fish'],
  tundra:    ['deer', 'uranium'],
  ocean:     ['fish'],
};

const STRATEGIC_RESOURCE_IDS = ['iron', 'horse', 'coal', 'oil', 'uranium'] as const;
const STRATEGIC_ALLOWED_TERRAIN: Record<(typeof STRATEGIC_RESOURCE_IDS)[number], TerrainType[]> = {
  iron: ['plains', 'hills', 'forest'],
  horse: ['plains', 'grassland'],
  coal: ['hills', 'forest', 'tundra'],
  oil: ['desert', 'plains', 'coast'],
  uranium: ['tundra', 'desert', 'hills', 'snow'],
};

function ensureStrategicResourceDistribution(tiles: Tile[][], rng: () => number): void {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const area = w * h;
  if (area <= 0) return;

  const desired: Record<(typeof STRATEGIC_RESOURCE_IDS)[number], number> = {
    iron: Math.max(4, Math.round(area / 170)),
    horse: Math.max(4, Math.round(area / 180)),
    coal: Math.max(3, Math.round(area / 240)),
    oil: Math.max(3, Math.round(area / 260)),
    uranium: Math.max(2, Math.round(area / 360)),
  };

  const current: Record<string, number> = {};
  for (const row of tiles) {
    for (const t of row) {
      if (!t.resource) continue;
      current[t.resource] = (current[t.resource] ?? 0) + 1;
    }
  }

  for (const resId of STRATEGIC_RESOURCE_IDS) {
    const need = Math.max(0, desired[resId] - (current[resId] ?? 0));
    if (need <= 0) continue;

    const candidates: Array<{ q: number; r: number }> = [];
    for (let r = 0; r < h; r++) {
      for (let q = 0; q < w; q++) {
        const t = tiles[r][q];
        if (t.terrain === 'ocean' || t.terrain === 'mountains') continue;
        if (!STRATEGIC_ALLOWED_TERRAIN[resId].includes(t.terrain)) continue;
        candidates.push({ q, r });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    let placed = 0;
    for (const c of candidates) {
      if (placed >= need) break;
      const t = tiles[c.r][c.q];
      const existing = t.resource;
      const existingIsStrategic = !!existing && STRATEGIC_RESOURCE_IDS.includes(existing as any);
      if (existingIsStrategic) continue;
      if (existing && rng() < 0.65) continue;
      t.resource = resId;
      placed++;
    }
  }
}

// ============================================================
// MAIN MAP GENERATOR
// ============================================================
export function generateMap(
  width: number,
  height: number,
  seed: number,
  mapType: string
): Tile[][] {
  if (mapType === 'earth') {
    return generateEarthMapFixed();
  }

  const typePool = [
    'pangaea',
    'continents',
    'archipelago',
    'highlands',
    'great_lakes',
    'inland_sea',
    'wetlands',
    'drylands',
    'shattered',
    'ring_sea',
  ] as const;
  const effectiveType =
    mapType === 'random'
      ? typePool[Math.floor(createRng((seed ^ 0x9e3779b9) >>> 0)() * typePool.length)]
      : mapType;

  const rng = createRng(seed);
  const elev = valueNoise(rng, width, height);
  const moist = valueNoise(rng, width, height);

  // Second pass for larger noise features
  const elev2 = valueNoise(rng, width, height);
  const moist2 = valueNoise(rng, width, height);

  // Blend
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      elev[r][c] = elev[r][c] * 0.6 + elev2[r][c] * 0.4;
      moist[r][c] = moist[r][c] * 0.6 + moist2[r][c] * 0.4;
    }
  }

  // Pangaea: elevate center
  if (effectiveType === 'pangaea') {
    const cx = width / 2, cy = height / 2;
    const maxD = Math.sqrt(cx * cx + cy * cy) || 1;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const d = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
        elev[r][c] = elev[r][c] * 0.5 + (1 - d / maxD) * 0.5;
      }
    }
  } else if (effectiveType === 'archipelago') {
    // Lower elevation overall
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        elev[r][c] *= 0.8;
      }
    }
  } else if (effectiveType === 'continents') {
    // Two landmasses
    const cx1 = width * 0.25, cx2 = width * 0.75, cy = height / 2;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const d1 = Math.sqrt((c - cx1) ** 2 + (r - cy) ** 2);
        const d2 = Math.sqrt((c - cx2) ** 2 + (r - cy) ** 2);
        const nearD = Math.min(d1, d2);
        const maxD = Math.sqrt((cx1) ** 2 + (cy) ** 2) || 1;
        elev[r][c] = elev[r][c] * 0.4 + (1 - nearD / maxD) * 0.6;
      }
    }
  } else if (effectiveType === 'highlands') {
    const cx = width / 2, cy = height / 2, maxD = Math.hypot(cx, cy) || 1;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const d = Math.hypot(c - cx, r - cy) / maxD;
        elev[r][c] = elev[r][c] * (0.5 + 0.5 * d) + 0.06;
        elev[r][c] = Math.min(1, elev[r][c]);
      }
    }
  } else if (effectiveType === 'great_lakes') {
    const cx = width / 2, cy = height / 2, maxD = Math.hypot(cx, cy) || 1;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const d = Math.hypot(c - cx, r - cy) / maxD;
        elev[r][c] *= 0.52 + 0.48 * d * d;
        if (d < 0.42) elev[r][c] *= 0.74;
      }
    }
  } else if (effectiveType === 'inland_sea') {
    const cx = width / 2, cy = height / 2, maxD = Math.hypot(cx, cy) || 1;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const d = Math.hypot(c - cx, r - cy) / maxD;
        elev[r][c] = elev[r][c] * (0.32 + 0.68 * d) - (1 - d) * 0.24;
      }
    }
  } else if (effectiveType === 'wetlands') {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        moist[r][c] = Math.min(1, moist[r][c] * 1.2 + 0.18);
        elev[r][c] = elev[r][c] * 0.9 + 0.03;
      }
    }
  } else if (effectiveType === 'drylands') {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        moist[r][c] = Math.max(0, moist[r][c] * 0.65 - 0.12);
        elev[r][c] = elev[r][c] * 0.95 + 0.02;
      }
    }
  } else if (effectiveType === 'shattered') {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const wave = (Math.sin(c * 0.35) + Math.cos(r * 0.32) + Math.sin((c + r) * 0.21)) * 0.08;
        elev[r][c] = elev[r][c] * 0.72 + wave;
      }
    }
  } else if (effectiveType === 'ring_sea') {
    const cx = width / 2;
    const cy = height / 2;
    const maxD = Math.hypot(cx, cy) || 1;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const d = Math.hypot(c - cx, r - cy) / maxD;
        const ring = Math.abs(d - 0.48);
        const ringBoost = Math.max(0, 1 - ring / 0.18) * 0.4;
        elev[r][c] = elev[r][c] * 0.62 + ringBoost - (1 - d) * 0.12;
      }
    }
  }

  // Build tile grid
  const tiles: Tile[][] = [];
  for (let r = 0; r < height; r++) {
    tiles[r] = [];
    const latitude = Math.abs((r / height) - 0.5) * 2; // 0 equator, 1 pole
    for (let c = 0; c < width; c++) {
      const terrain = getTerrain(elev[r][c], moist[r][c], latitude);

      // Resource placement (sparse)
      let resource: string | null = null;
      const resList = TERRAIN_RESOURCES[terrain];
      if (resList && rng() < 0.18) {
        const idx = Math.floor(rng() * resList.length);
        resource = resList[idx];
      }

      tiles[r][c] = {
        q: c,
        r: r,
        terrain,
        improvement: 'none' as ImprovementType,
        resource,
        owner: null,
        city: null,
        territoryCityId: null,
        unit: null,
        river: false,
        road: false,
        revealed: [],
        visible: [],
      };
    }
  }

  ensureStrategicResourceDistribution(tiles, rng);
  carveNavigableRivers(tiles, (seed ^ 0x6b8b4567) >>> 0);

  return tiles;
}

function carveNavigableRivers(tiles: Tile[][], seed: number): void {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  if (!w || !h) return;
  const rng = createRng(seed);
  const sources: Array<{ q: number; r: number }> = [];
  for (let r = 2; r < h - 2; r++) {
    for (let q = 2; q < w - 2; q++) {
      const t = tiles[r][q];
      if (!t || t.terrain === 'ocean' || t.terrain === 'coast' || t.terrain === 'mountains') continue;
      if (t.terrain === 'hills' || t.terrain === 'forest' || t.terrain === 'jungle') sources.push({ q, r });
    }
  }
  for (let i = sources.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [sources[i], sources[j]] = [sources[j], sources[i]];
  }
  const targetRivers = Math.max(2, Math.round((w * h) / 160));
  let carved = 0;
  for (const src of sources) {
    if (carved >= targetRivers) break;
    let q = src.q;
    let r = src.r;
    let touchedWater = false;
    const len = 7 + Math.floor(rng() * 8);
    for (let step = 0; step < len; step++) {
      const t = tiles[r]?.[q];
      if (!t) break;
      if (t.terrain === 'ocean' || t.terrain === 'coast') {
        touchedWater = true;
        break;
      }
      if (t.terrain === 'mountains') break;
      t.river = true;
      const neighbors = getNeighbors(q, r, w, h);
      const coastal = neighbors.find(n => {
        const nt = tiles[n.r]?.[n.q];
        return nt && (nt.terrain === 'ocean' || nt.terrain === 'coast');
      });
      if (coastal) {
        touchedWater = true;
        break;
      }
      const next = neighbors
        .map(n => ({ n, t: tiles[n.r]?.[n.q] }))
        .filter(x => x.t && x.t.terrain !== 'mountains')
        .sort((a, b) => {
          const ta = a.t!;
          const tb = b.t!;
          const sa =
            (ta.river ? 2 : 0) +
            (ta.terrain === 'ocean' || ta.terrain === 'coast' ? -5 : 0) +
            (Math.min(a.n.q, w - 1 - a.n.q, a.n.r, h - 1 - a.n.r) * 0.08) +
            rng();
          const sb =
            (tb.river ? 2 : 0) +
            (tb.terrain === 'ocean' || tb.terrain === 'coast' ? -5 : 0) +
            (Math.min(b.n.q, w - 1 - b.n.q, b.n.r, h - 1 - b.n.r) * 0.08) +
            rng();
          return sa - sb;
        })[0];
      if (!next) break;
      q = next.n.q;
      r = next.n.r;
    }
    if (touchedWater) carved++;
  }
}

// ============================================================
// Find valid starting positions for civs
// ============================================================
export function findStartingPositions(
  tiles: Tile[][],
  numCivs: number,
  rng: () => number
): Array<{ q: number; r: number }> {
  const height = tiles.length;
  const width = tiles[0].length;
  const minDist = Math.floor(Math.min(width, height) / (numCivs * 0.6));

  const landTiles: Array<{ q: number; r: number }> = [];
  for (let r = 2; r < height - 2; r++) {
    for (let c = 2; c < width - 2; c++) {
      const t = tiles[r][c].terrain;
      if (t !== 'ocean' && t !== 'coast' && t !== 'mountains' && t !== 'snow') {
        landTiles.push({ q: c, r });
      }
    }
  }

  // Shuffle
  for (let i = landTiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [landTiles[i], landTiles[j]] = [landTiles[j], landTiles[i]];
  }

  const positions: Array<{ q: number; r: number }> = [];
  for (const candidate of landTiles) {
    if (positions.length >= numCivs) break;
    let tooClose = false;
    for (const pos of positions) {
      const d = Math.sqrt((candidate.q - pos.q) ** 2 + (candidate.r - pos.r) ** 2);
      if (d < minDist) { tooClose = true; break; }
    }
    if (!tooClose) positions.push(candidate);
  }

  // Fallback
  while (positions.length < numCivs && landTiles.length > 0) {
    positions.push(landTiles[Math.floor(rng() * landTiles.length)]);
  }

  return positions;
}

/**
 * Starting tiles for the "Earth" map: each slot uses the historical homeland of the
 * civilization template assigned to that slot (same rotation as `finishInitGame`: `(humanTpl + i) % N`).
 */
export function findEarthHistoricalStartingPositions(
  tiles: Tile[][],
  numCivs: number,
  humanTemplateIndex: number,
  rng: () => number
): Array<{ q: number; r: number }> {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  if (!w || !h) return [];
  const nTpl = EARTH_CIV_START_LAT_LON.length;
  const cap = Math.min(numCivs, nTpl);
  const used = new Set<string>();
  const out: Array<{ q: number; r: number }> = [];

  const settleable = (q: number, r: number) => {
    if (q < 2 || q >= w - 2 || r < 2 || r >= h - 2) return false;
    const ter = tiles[r][q]!.terrain;
    if (ter === 'ocean' || ter === 'coast' || ter === 'mountains' || ter === 'snow') return false;
    return true;
  };

  const offsetsForRing = (ring: number): Array<{ dq: number; dr: number }> => {
    if (ring === 0) return [{ dq: 0, dr: 0 }];
    const list: Array<{ dq: number; dr: number }> = [];
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dq = -ring; dq <= ring; dq++) {
        if (Math.max(Math.abs(dr), Math.abs(dq)) === ring) list.push({ dq, dr });
      }
    }
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list;
  };

  const spiralPick = (q0f: number, r0f: number): { q: number; r: number } => {
    const q0 = Math.max(2, Math.min(w - 3, Math.round(q0f)));
    const r0 = Math.max(2, Math.min(h - 3, Math.round(r0f)));
    const maxRing = Math.max(w, h);
    for (let ring = 0; ring <= maxRing; ring++) {
      for (const { dq, dr } of offsetsForRing(ring)) {
        const q = q0 + dq;
        const r = r0 + dr;
        if (!settleable(q, r)) continue;
        const key = `${q},${r}`;
        if (used.has(key)) continue;
        used.add(key);
        return { q, r };
      }
    }
    const fb = findStartingPositions(tiles, 1, rng)[0] ?? { q: Math.floor(w / 2), r: Math.floor(h / 2) };
    used.add(`${fb.q},${fb.r}`);
    return fb;
  };

  for (let slot = 0; slot < cap; slot++) {
    const tplIdx = (humanTemplateIndex + slot) % nTpl;
    const { lon, lat } = EARTH_CIV_START_LAT_LON[tplIdx]!;
    const qf = ((lon + 180) / 360) * Math.max(1, w - 1);
    const rf = ((90 - lat) / 180) * Math.max(1, h - 1);
    out.push(spiralPick(qf, rf));
  }
  return out;
}

// ============================================================
// Hex adjacency helpers
// ============================================================
export function getNeighbors(q: number, r: number, width: number, height: number): Array<{ q: number; r: number }> {
  const dirs = [
    { dq: 1, dr: 0 }, { dq: -1, dr: 0 },
    { dq: 0, dr: 1 }, { dq: 0, dr: -1 },
    { dq: 1, dr: -1 }, { dq: -1, dr: 1 },
  ];
  return dirs.map(d => ({ q: q + d.dq, r: r + d.dr }))
    .filter(n => n.q >= 0 && n.q < width && n.r >= 0 && n.r < height);
}

export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs((q1 - r1) - (q2 - r2)));
}

/** Count of hex tiles in a filled disk of radius R (center + rings), axial coordinates. */
export function hexDiskTileCountForRadius(radius: number): number {
  const r = Math.max(0, Math.floor(radius));
  return 1 + 3 * r * (r + 1);
}

const DEFAULT_UNIT_VISION_RADIUS = 2;

/**
 * Hex sight radius used for fog reveal around a unit stand.
 * Scouts use the smallest R where tile count >= 1.5× the default (R=2) disk.
 */
export function unitSightRevealHexRadius(unitType: UnitType): number {
  if (unitType === 'scout') {
    const baseline = hexDiskTileCountForRadius(DEFAULT_UNIT_VISION_RADIUS);
    const minTiles = Math.ceil(baseline * 1.5);
    for (let r = DEFAULT_UNIT_VISION_RADIUS; r <= 12; r++) {
      if (hexDiskTileCountForRadius(r) >= minTiles) return r;
    }
    return 12;
  }
  return DEFAULT_UNIT_VISION_RADIUS;
}

// ============================================================
// Update vision (fog of war) for a civilization
// ============================================================
export function updateVision(
  tiles: Tile[][],
  civIndex: number,
  units: Array<{ q: number; r: number; owner: number; type: UnitType }>,
  cities: Array<{ q: number; r: number; owner: number }>
): void {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  if (!height || !width) return;
  const slot = Math.floor(civIndex);
  if (!Number.isFinite(slot) || slot < 0) return;

  const ensureFogSlot = (tile: Tile) => {
    if (!Array.isArray(tile.visible)) tile.visible = [];
    if (!Array.isArray(tile.revealed)) tile.revealed = [];
    if (tile.visible.length <= slot) tile.visible.length = slot + 1;
    if (tile.revealed.length <= slot) tile.revealed.length = slot + 1;
    if (tile.visible[slot] == null) tile.visible[slot] = false;
    if (tile.revealed[slot] == null) tile.revealed[slot] = false;
  };

  // Clear current vision
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const tile = tiles[r][c];
      ensureFogSlot(tile);
      tile.visible[slot] = false;
    }
  }

  // Mark visible tiles from units
  for (const unit of units) {
    if (unit.owner !== slot) continue;
    const sight = unitSightRevealHexRadius(unit.type);
    for (let r = Math.max(0, unit.r - sight); r <= Math.min(height - 1, unit.r + sight); r++) {
      for (let c = Math.max(0, unit.q - sight); c <= Math.min(width - 1, unit.q + sight); c++) {
        if (hexDistance(c, r, unit.q, unit.r) <= sight) {
          const tile = tiles[r][c];
          ensureFogSlot(tile);
          tile.visible[slot] = true;
          tile.revealed[slot] = true;
        }
      }
    }
  }

  // Mark visible tiles from cities
  for (const city of cities) {
    if (city.owner !== slot) continue;
    for (let r = Math.max(0, city.r - 3); r <= Math.min(height - 1, city.r + 3); r++) {
      for (let c = Math.max(0, city.q - 3); c <= Math.min(width - 1, city.q + 3); c++) {
        if (hexDistance(c, r, city.q, city.r) <= 3) {
          const tile = tiles[r][c];
          ensureFogSlot(tile);
          tile.visible[slot] = true;
          tile.revealed[slot] = true;
        }
      }
    }
  }
}
