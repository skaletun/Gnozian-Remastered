import type { BuildingType, City, GameState, Tile } from './types';
import { hexDistance } from './mapgen';

export type TerritoryHex = { q: number; r: number };

export type PlannedHexVisual = TerritoryHex & {
  /** Buildings from city production assigned to this hex for 3D/2D spread */
  productionBuildings: BuildingType[];
};

const MAX_PRODUCTION_SLOTS_PER_HEX = 3;

/** Collect territory hexes for a city within the given inclusive map bounds. */
export function listTerritoryHexesInBounds(
  state: GameState,
  cityId: number,
  startQ: number,
  startR: number,
  endQ: number,
  endR: number
): TerritoryHex[] {
  const tiles = state.tiles;
  const out: TerritoryHex[] = [];
  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      const t = tiles[r]?.[q];
      if (!t) continue;
      if (t.terrain === 'ocean') continue;
      if (t.territoryCityId !== cityId) continue;
      out.push({ q, r });
    }
  }
  return out;
}

function sortHexesAroundCity(city: City, hexes: TerritoryHex[]): TerritoryHex[] {
  const copy = [...hexes];
  copy.sort((a, b) => {
    const da = hexDistance(city.q, city.r, a.q, a.r);
    const db = hexDistance(city.q, city.r, b.q, b.r);
    if (da !== db) return da - db;
    if (a.r !== b.r) return a.r - b.r;
    return a.q - b.q;
  });
  return copy;
}

/**
 * Distribute production buildings across cultural tiles (palace skipped — shown at city center separately).
 */
export function planProductionBuildingsOnTerritory(
  city: City,
  hexes: TerritoryHex[],
  tiles: Tile[][]
): Map<string, PlannedHexVisual> {
  const map = new Map<string, PlannedHexVisual>();
  for (const h of hexes) {
    const k = `${h.q},${h.r}`;
    map.set(k, { q: h.q, r: h.r, productionBuildings: [] });
  }

  const sorted = sortHexesAroundCity(city, hexes);
  const productionList = city.buildings.filter(b => b !== 'palace').sort((a, b) => a.localeCompare(b));
  if (sorted.length === 0 || productionList.length === 0) return map;

  productionList.forEach((bid, i) => {
    let placed = false;
    for (let rot = 0; rot < sorted.length; rot++) {
      const h = sorted[(i + rot) % sorted.length]!;
      const imp = tiles[h.r]?.[h.q]?.improvement;
      if (bid === 'granary' && imp === 'farm') continue;

      const k = `${h.q},${h.r}`;
      const cell = map.get(k);
      if (!cell || cell.productionBuildings.length >= MAX_PRODUCTION_SLOTS_PER_HEX) continue;
      cell.productionBuildings.push(bid);
      placed = true;
      break;
    }
    if (!placed) {
      for (const h of sorted) {
        const cell = map.get(`${h.q},${h.r}`);
        if (cell && cell.productionBuildings.length < MAX_PRODUCTION_SLOTS_PER_HEX) {
          cell.productionBuildings.push(bid);
          break;
        }
      }
    }
  });

  return map;
}
