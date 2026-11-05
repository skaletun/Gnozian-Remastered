import type { GameSystems, WonderId } from './types';

/** Wonders built in the given city (for map / UI). */
export function wonderIdsForCity(wonderOwners: GameSystems['wonderOwners'], cityId: number): WonderId[] {
  const out: WonderId[] = [];
  for (const [key, meta] of Object.entries(wonderOwners)) {
    if (meta && meta.cityId === cityId) {
      out.push(key as WonderId);
    }
  }
  return out;
}
