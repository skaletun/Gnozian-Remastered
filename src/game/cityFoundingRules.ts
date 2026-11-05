import type { GameState } from './types';
import { hexDistance } from './mapgen';

/**
 * Three hexes between city centers, irrespective of ownership.
 * Shared by human, AI and command-driven city founding.
 */
export const MIN_CITY_SPACING = 3;

type SiteState = Pick<GameState, 'tiles' | 'cities' | 'units'>;

export function cityFoundingSiteError(
  state: SiteState,
  civIndex: number,
  q: number,
  r: number
): string | null {
  if (!Number.isInteger(q) || !Number.isInteger(r)) return 'invalid map coordinates';
  const tile = state.tiles[r]?.[q];
  if (!tile) return 'site is outside the map';
  if (tile.terrain === 'ocean' || tile.terrain === 'coast' || tile.terrain === 'mountains') {
    return 'cannot settle on water or mountains';
  }
  if (tile.city != null || state.cities.some(city => city.q === q && city.r === r)) {
    return 'a city already occupies this tile';
  }
  if (tile.owner != null && tile.owner !== civIndex) return 'site belongs to another civilization';
  if (state.cities.some(city => hexDistance(city.q, city.r, q, r) < MIN_CITY_SPACING)) {
    return 'another city is too close';
  }
  if (state.units.some(unit => unit.q === q && unit.r === r && unit.owner !== civIndex)) {
    return 'an opposing unit occupies this tile';
  }
  return null;
}

export function cityFoundingValidationError(
  state: GameState,
  civIndex: number,
  q: number,
  r: number,
  settlerUnitId: number
): string | null {
  const civ = state.civilizations[civIndex];
  if (!civ || !civ.isAlive) return 'civilization is not active';
  const settler = state.units.find(unit => unit.id === settlerUnitId);
  if (!settler || settler.type !== 'settler' || settler.owner !== civIndex) {
    return 'requires a settler belonging to this civilization';
  }
  if (settler.q !== q || settler.r !== r) return 'settler must stand on the founding tile';
  if (settler.movement <= 0) return 'settler has no movement points left';
  return cityFoundingSiteError(state, civIndex, q, r);
}
