import type { GameState, Unit } from './types';
import { getNeighbors, hexDistance } from './mapgen';
import type { AIEngineAPI } from './ai';
import type { AIPersonality, AIStrategicPosture } from './aiStrategy';

export type SettlerObjective =
  | { action: 'settle'; score: number }
  | { action: 'move'; q: number; r: number; score: number }
  | { action: 'wait' };

function nearestOwnCityDistance(state: GameState, civIndex: number, q: number, r: number): number {
  const cities = state.cities.filter(city => city.owner === civIndex);
  if (cities.length === 0) return 99;
  return Math.min(...cities.map(city => hexDistance(q, r, city.q, city.r)));
}

function nearestForeignCityDistance(state: GameState, civIndex: number, q: number, r: number): number {
  const cities = state.cities.filter(city => city.owner !== civIndex);
  if (cities.length === 0) return 99;
  return Math.min(...cities.map(city => hexDistance(q, r, city.q, city.r)));
}

function scoreSettlementTile(
  state: GameState,
  civIndex: number,
  q: number,
  r: number,
  api: AIEngineAPI,
  personality: AIPersonality,
  posture: AIStrategicPosture,
  rng: () => number
): number | null {
  const tile = state.tiles[r]?.[q];
  if (!tile || !tile.revealed?.[civIndex]) return null;
  if (tile.terrain === 'ocean' || tile.terrain === 'mountains' || tile.city) return null;
  if (tile.owner != null && tile.owner !== civIndex) return null;

  const ownDistance = nearestOwnCityDistance(state, civIndex, q, r);
  const foreignDistance = nearestForeignCityDistance(state, civIndex, q, r);
  if (ownDistance < 3) return null;
  if (foreignDistance < 2 && posture.threatLevel > 0.35) return null;

  const centerYield = api.calcTileYield(tile);
  let ringScore = 0;
  for (const n of getNeighbors(q, r, state.tiles[0]?.length ?? 0, state.tiles.length)) {
    const neighbor = state.tiles[n.r]?.[n.q];
    if (!neighbor || neighbor.terrain === 'ocean' || neighbor.terrain === 'mountains') continue;
    const y = api.calcTileYield(neighbor);
    ringScore += (y.food ?? 0) * 1.5 + (y.production ?? 0) * 1.25 + (y.gold ?? 0) * 0.55;
    if (neighbor.resource) ringScore += 2.4;
    if (neighbor.river) ringScore += 0.8;
  }

  const yieldScore =
    (centerYield.food ?? 0) * 4.2 +
    (centerYield.production ?? 0) * 3.1 +
    (centerYield.gold ?? 0) * 1.2 +
    (centerYield.science ?? 0) * 2.2 +
    (centerYield.culture ?? 0) * 1.8;
  const spacingScore = Math.min(14, ownDistance) * (personality.expansionist ? 1.1 : 0.65);
  const frontierScore = foreignDistance <= 6 ? (posture.threatLevel > 0.4 ? -8 : 3) : 0;
  const ownedBonus = tile.owner === civIndex ? 2.5 : 0;
  const developmentBias = posture.developmentPressure * 2.5;

  return yieldScore + ringScore + spacingScore + frontierScore + ownedBonus + developmentBias + rng() * 1.2;
}

export function chooseSettlerObjective(
  state: GameState,
  civIndex: number,
  unit: Unit,
  api: AIEngineAPI,
  personality: AIPersonality,
  posture: AIStrategicPosture,
  rng: () => number
): SettlerObjective {
  const hereScore = scoreSettlementTile(state, civIndex, unit.q, unit.r, api, personality, posture, rng);
  const searchRadius = posture.phase === 'opening' ? 7 : 9;
  let best: { q: number; r: number; score: number } | null = null;
  for (let r = Math.max(0, unit.r - searchRadius); r <= Math.min(state.tiles.length - 1, unit.r + searchRadius); r++) {
    for (let q = Math.max(0, unit.q - searchRadius); q <= Math.min((state.tiles[0]?.length ?? 1) - 1, unit.q + searchRadius); q++) {
      if (hexDistance(unit.q, unit.r, q, r) > searchRadius) continue;
      const score = scoreSettlementTile(state, civIndex, q, r, api, personality, posture, rng);
      if (score == null) continue;
      const travelPenalty = hexDistance(unit.q, unit.r, q, r) * (0.85 - posture.skill * 0.25);
      const net = score - travelPenalty;
      if (!best || net > best.score) best = { q, r, score: net };
    }
  }

  const settleThreshold = 18 + (posture.phase === 'opening' ? 2 : 5) - posture.expansionPressure * 5;
  if (hereScore != null && hereScore >= settleThreshold && (!best || hereScore >= best.score - 2)) {
    return { action: 'settle', score: hereScore };
  }
  if (best) return { action: 'move', q: best.q, r: best.r, score: best.score };
  return { action: 'wait' };
}
