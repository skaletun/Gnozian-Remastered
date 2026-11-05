import type { GameState, Unit } from './types';
import type { AIEngineAPI } from './ai';
import { hexDistance } from './mapgen';
import { tileMovementEnterCost } from './movementRules';

/** Choose a safe, legal step toward undiscovered hexes using only this civ's known map. */
export function chooseScoutExplorationStep(
  state: GameState,
  civIndex: number,
  scout: Unit,
  api: Pick<AIEngineAPI, 'bestNeighborToward' | 'canFriendlyStackOnTile'>
): { q: number; r: number } | null {
  if (scout.movement <= 0 || scout.hasAttacked) return null;
  const height = state.tiles.length;
  const width = state.tiles[0]?.length ?? 0;
  if (!height || !width) return null;

  const enemies = state.units.filter(
    unit => unit.owner !== civIndex && (unit.strength > 0 || unit.rangedStrength > 0)
  );
  const isKnown = (q: number, r: number): boolean => {
    const tile = state.tiles[r]?.[q];
    return Boolean(tile?.revealed?.[civIndex] || tile?.visible?.[civIndex]);
  };
  const unsafe = (q: number, r: number): boolean =>
    enemies.some(enemy => hexDistance(q, r, enemy.q, enemy.r) <= 1);

  const targets: Array<{ q: number; r: number; score: number }> = [];
  const radius = 12;
  for (let r = Math.max(0, scout.r - radius); r <= Math.min(height - 1, scout.r + radius); r++) {
    for (let q = Math.max(0, scout.q - radius); q <= Math.min(width - 1, scout.q + radius); q++) {
      const distance = hexDistance(scout.q, scout.r, q, r);
      if (distance === 0 || distance > radius || !isKnown(q, r) || unsafe(q, r)) continue;
      const tile = state.tiles[r]?.[q];
      if (!tile || (tile.city != null && tile.owner !== civIndex)) continue;
      if (tileMovementEnterCost(tile.terrain, scout.type, {
        state, civIndex, fromQ: scout.q, fromR: scout.r, toQ: q, toR: r,
      }) == null) continue;
      let gain = 0;
      for (let rr = Math.max(0, r - 2); rr <= Math.min(height - 1, r + 2); rr++) {
        for (let qq = Math.max(0, q - 2); qq <= Math.min(width - 1, q + 2); qq++) {
          if (hexDistance(q, r, qq, rr) <= 2 && !isKnown(qq, rr)) gain++;
        }
      }
      if (gain > 0) targets.push({ q, r, score: gain * 5 - distance * 1.3 });
    }
  }

  targets.sort((a, b) => b.score - a.score || a.r - b.r || a.q - b.q);
  for (const target of targets.slice(0, 16)) {
    const step = api.bestNeighborToward(state, scout, target.q, target.r);
    if (!step || hexDistance(scout.q, scout.r, step.q, step.r) !== 1) continue;
    if (!isKnown(step.q, step.r) || unsafe(step.q, step.r)) continue;
    const next = state.tiles[step.r]?.[step.q];
    if (!next || (next.city != null && next.owner !== civIndex)) continue;
    const cost = tileMovementEnterCost(next.terrain, scout.type, {
      state, civIndex, fromQ: scout.q, fromR: scout.r, toQ: step.q, toR: step.r,
    });
    if (cost == null || cost > scout.movement) continue;
    if (!api.canFriendlyStackOnTile(state, civIndex, scout.type, step.q, step.r, scout.id)) continue;
    return { q: step.q, r: step.r };
  }
  return null;
}
