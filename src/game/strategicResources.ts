import { NATURAL_RESOURCES, UNITS } from './constants';
import type { GameState, UnitType } from './types';

const ERA_RANK: Record<string, number> = {
  ancient: 0,
  classical: 1,
  medieval: 2,
  renaissance: 3,
  industrial: 4,
  modern: 5,
  atomic: 6,
  information: 7,
};

const STRATEGIC_UNLOCK_ERA: Record<string, keyof typeof ERA_RANK> = {
  horse: 'ancient',
};

/** Improved tiles with strategic resources in this civ's territory (counts per resource id). */
export function getEmpireStrategicResourceAccess(state: GameState, civIndex: number): Record<string, number> {
  const civEra = state.civilizations[civIndex]?.era ?? 'ancient';
  const civEraRank = ERA_RANK[civEra] ?? 0;

  const counts: Record<string, number> = {};
  const h = state.tiles.length;
  const w = state.tiles[0]?.length ?? 0;
  for (let r = 0; r < h; r++) {
    for (let q = 0; q < w; q++) {
      const t = state.tiles[r][q];
      if (t.owner !== civIndex || !t.resource || t.improvement === 'none') continue;
      const nr = NATURAL_RESOURCES[t.resource];
      if (!nr || nr.type !== 'strategic') continue;
      const needEra = STRATEGIC_UNLOCK_ERA[t.resource] ?? 'medieval';
      if (civEraRank < (ERA_RANK[needEra] ?? ERA_RANK.medieval)) continue;
      if (!nr.improvement || t.improvement !== nr.improvement) continue;
      counts[t.resource] = (counts[t.resource] ?? 0) + 1;
    }
  }
  return counts;
}

export function empireMeetsUnitStrategicRequirements(
  state: GameState,
  civIndex: number,
  unitType: UnitType
): boolean {
  const req = UNITS[unitType]?.requiredStrategicResources;
  if (!req || Object.keys(req).length === 0) return true;
  const have = getEmpireStrategicResourceAccess(state, civIndex);
  for (const [resId, need] of Object.entries(req)) {
    if ((have[resId] ?? 0) < (need ?? 0)) return false;
  }
  return true;
}
