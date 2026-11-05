import type { GameState, ImprovementType, Unit } from './types';
import { NATURAL_RESOURCES } from './constants';
import { hexDistance } from './mapgen';
import type { AIEngineAPI } from './ai';
import type { AIStrategicPosture } from './aiStrategy';
import { listLegalWorkerImprovementsAt } from './workerImprovementRules';

export type WorkerObjective =
  | { action: 'build'; improvement: ImprovementType; score: number }
  | { action: 'move'; q: number; r: number; score: number }
  | { action: 'wait' };

const IMPROVEMENT_PRIORITY: ImprovementType[] = [
  'mine',
  'pasture',
  'lumber_mill',
  'fishing_boats',
  'farm',
  'trading_post',
];

function scoreImprovement(
  state: GameState,
  q: number,
  r: number,
  improvement: ImprovementType,
  api: AIEngineAPI,
  posture: AIStrategicPosture
): number {
  const tile = state.tiles[r]?.[q];
  if (!tile) return -Infinity;
  const yieldMap = api.calcTileYield(tile);
  const resource = tile.resource ? NATURAL_RESOURCES[tile.resource] : null;
  let score =
    (yieldMap.food ?? 0) * (posture.developmentPressure > 0.35 ? 2.2 : 1.4) +
    (yieldMap.production ?? 0) * (posture.threatLevel > 0.3 ? 2.6 : 1.9) +
    (yieldMap.gold ?? 0) * 1.3 +
    (yieldMap.science ?? 0) * (posture.victoryFocus === 'science' ? 2.6 : 1.5) +
    (yieldMap.culture ?? 0) * (posture.victoryFocus === 'culture' ? 2.5 : 1.3) +
    (yieldMap.faith ?? 0) * (posture.victoryFocus === 'religion' ? 2.4 : 1.2);
  if (resource?.improvement === improvement) score += resource.type === 'strategic' ? 10 : resource.type === 'luxury' ? 8 : 5;
  if (tile.river && improvement === 'farm') score += 2;
  if (improvement === 'mine' && posture.threatLevel > 0.35) score += 3;
  if (tile.improvement !== 'none') score -= 6;
  return score;
}

function chooseCurrentImprovement(
  state: GameState,
  unit: Unit,
  valid: ImprovementType[],
  api: AIEngineAPI,
  posture: AIStrategicPosture
): Extract<WorkerObjective, { action: 'build' }> | null {
  let best: Extract<WorkerObjective, { action: 'build' }> | null = null;
  for (const improvement of valid) {
    const base = scoreImprovement(state, unit.q, unit.r, improvement, api, posture);
    const priority = IMPROVEMENT_PRIORITY.indexOf(improvement);
    const score = base + (priority >= 0 ? (IMPROVEMENT_PRIORITY.length - priority) * 0.2 : 0);
    if (!best || score > best.score) best = { action: 'build', improvement, score };
  }
  return best;
}

export function chooseWorkerObjective(
  state: GameState,
  civIndex: number,
  unit: Unit,
  validHere: ImprovementType[],
  api: AIEngineAPI,
  posture: AIStrategicPosture,
  rng: () => number
): WorkerObjective {
  const current = chooseCurrentImprovement(state, unit, validHere, api, posture);
  if (current && current.score >= 4) return current;

  const radius = posture.phase === 'opening' ? 5 : 7;
  const knownCombatEnemies = state.units?.filter(enemy =>
    enemy.owner !== civIndex && (enemy.strength > 0 || enemy.rangedStrength > 0)
  ) ?? [];
  let bestTarget: { q: number; r: number; score: number } | null = null;
  for (let r = Math.max(0, unit.r - radius); r <= Math.min(state.tiles.length - 1, unit.r + radius); r++) {
    for (let q = Math.max(0, unit.q - radius); q <= Math.min((state.tiles[0]?.length ?? 1) - 1, unit.q + radius); q++) {
      if (hexDistance(unit.q, unit.r, q, r) > radius) continue;
      const tile = state.tiles[r]?.[q];
      if (!tile || tile.owner !== civIndex || !tile.revealed?.[civIndex]) continue;
      if (tile.city != null || tile.terrain === 'ocean' || tile.improvement !== 'none') continue;
      // Never send a worker to a tile where the required improvement is locked.
      const legal = listLegalWorkerImprovementsAt(state, civIndex, q, r);
      if (legal.length === 0) continue;
      if (knownCombatEnemies.some(enemy => hexDistance(enemy.q, enemy.r, q, r) <= 1)) continue;
      const improvementScore = Math.max(...legal.map(improvement =>
        scoreImprovement(state, q, r, improvement, api, posture) +
        (IMPROVEMENT_PRIORITY.includes(improvement) ? 0.2 : 0)
      ));
      const travelPenalty = hexDistance(unit.q, unit.r, q, r) * (0.9 - posture.skill * 0.25);
      const score = improvementScore - travelPenalty + rng() * 0.4;
      if (!bestTarget || score > bestTarget.score) bestTarget = { q, r, score };
    }
  }

  if (bestTarget && bestTarget.score > 2.5) {
    return { action: 'move', ...bestTarget };
  }
  return current ?? { action: 'wait' };
}
