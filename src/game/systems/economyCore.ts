import { BUILDINGS, IMPROVEMENT_YIELDS, NATURAL_RESOURCES, TERRAIN_YIELDS } from '../constants';
import { hexDistance } from '../mapgen';
import type { City, Tile, YieldMap } from '../types';
import { applySettlementYieldModel, normalizeSettlement } from './settlementCore';

const EMPTY_YIELDS = (): YieldMap => ({
  food: 0,
  production: 0,
  gold: 0,
  science: 0,
  culture: 0,
  faith: 0,
  happiness: 0,
});

function mergeYields(a: Partial<YieldMap>, b: Partial<YieldMap>): YieldMap {
  const base = EMPTY_YIELDS();
  const keys: Array<keyof YieldMap> = ['food', 'production', 'gold', 'science', 'culture', 'faith', 'happiness'];
  for (const k of keys) {
    base[k] = (a[k] ?? 0) + (b[k] ?? 0);
  }
  return base;
}

export function calcTileYield(tile: Tile): Partial<YieldMap> {
  let y: Partial<YieldMap> = { ...TERRAIN_YIELDS[tile.terrain] };
  const impYield = IMPROVEMENT_YIELDS[tile.improvement];
  y = mergeYields(y, impYield);
  if (tile.resource && NATURAL_RESOURCES[tile.resource]) {
    const res = NATURAL_RESOURCES[tile.resource];
    const unlockedByImprovement = tile.city != null || !res.improvement || tile.improvement === res.improvement;
    if (unlockedByImprovement) y = mergeYields(y, res.yields);
  }
  return y;
}

export function calcCityYields(city: City, tiles: Tile[][]): YieldMap {
  const settlement = normalizeSettlement(city);
  const base = EMPTY_YIELDS();
  const centerTile = tiles[settlement.r]?.[settlement.q];
  if (centerTile) {
    const ty = calcTileYield(centerTile);
    for (const k of Object.keys(base) as Array<keyof YieldMap>) {
      base[k] += ty[k] ?? 0;
    }
  }
  for (const wt of settlement.workedTiles) {
    const t = tiles[wt.r]?.[wt.q];
    if (!t) continue;
    const ty = calcTileYield(t);
    for (const k of Object.keys(base) as Array<keyof YieldMap>) {
      base[k] += ty[k] ?? 0;
    }
  }
  for (const bId of settlement.buildings) {
    const b = BUILDINGS[bId];
    if (!b) continue;
    for (const [k, v] of Object.entries(b.yields)) {
      base[k as keyof YieldMap] = (base[k as keyof YieldMap] || 0) + (v || 0);
    }
  }
  base.production += Math.floor(settlement.population * 0.5);
  return applySettlementYieldModel(settlement, base);
}

export function assignWorkedTiles(city: City, tiles: Tile[][], allCities: City[]): void {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  const worked: Array<{ q: number; r: number }> = [];
  const numWorkers = city.population + 1;
  const candidates: Array<{ q: number; r: number; score: number }> = [];
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      const nq = city.q + dc;
      const nr = city.r + dr;
      if (nq < 0 || nq >= width || nr < 0 || nr >= height) continue;
      if (dc === 0 && dr === 0) continue;
      if (hexDistance(city.q, city.r, nq, nr) > 3) continue;
      const t = tiles[nr][nq];
      if (t.terrain === 'ocean' || t.terrain === 'mountains') continue;
      if (t.owner != null && t.owner !== city.owner) continue;
      const taken = allCities.some(
        c => c.id !== city.id && c.workedTiles.some(w => w.q === nq && w.r === nr)
      );
      if (taken) continue;
      const y = calcTileYield(t);
      const score = (y.food ?? 0) * 2 + (y.production ?? 0) * 1.5 + (y.gold ?? 0);
      candidates.push({ q: nq, r: nr, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  for (let i = 0; i < Math.min(numWorkers, candidates.length); i++) {
    worked.push({ q: candidates[i].q, r: candidates[i].r });
  }
  city.workedTiles = worked;
}

