import type { City, GameState, Unit } from './types';
import { hexDistance } from './mapgen';
import { canAttackAtHexDistance } from './movementRules';
import {
  nearestEnemyCombatUnit,
  warOpponentIds,
} from './aiMetrics';
import type { AIPersonality, AIStrategicPosture } from './aiStrategy';

export type CombatObjective =
  | { kind: 'attack-unit'; unitId: number; targetQ: number; targetR: number }
  | { kind: 'attack-city'; cityId: number; targetQ: number; targetR: number }
  | { kind: 'move'; targetQ: number; targetR: number; reason: 'front' | 'retreat' | 'defend' };

function nearestOwnCity(state: GameState, civIndex: number, q: number, r: number): City | null {
  const cities = state.cities.filter(city => city.owner === civIndex);
  if (cities.length === 0) return null;
  return cities.reduce((best, city) => (hexDistance(q, r, best.q, best.r) <= hexDistance(q, r, city.q, city.r) ? best : city));
}

function scoreAttackTarget(attacker: Unit, target: Unit, distance: number, atWar: boolean): number {
  const projectedDamage = attacker.rangedStrength > 0 ? attacker.rangedStrength : attacker.strength;
  const killBonus = target.hp <= projectedDamage * 1.15 ? 40 : 0;
  const threat = target.strength + target.rangedStrength * 1.15;
  const wounded = Math.max(0, 1 - target.hp / Math.max(1, target.maxHp)) * 14;
  const safeRangeBonus = attacker.rangedStrength > 0 && distance > 1 ? 8 : 0;
  return threat * 0.7 + wounded + killBonus + safeRangeBonus + (atWar ? 8 : -30);
}

function bestAttackableEnemyUnit(state: GameState, civIndex: number, unit: Unit, wars: number[]): Unit | null {
  let best: Unit | null = null;
  let bestScore = -Infinity;
  for (const enemy of state.units) {
    if (enemy.owner === civIndex || (enemy.strength <= 0 && enemy.rangedStrength <= 0)) continue;
    const atWar = wars.includes(enemy.owner);
    if (!atWar) continue;
    const distance = hexDistance(unit.q, unit.r, enemy.q, enemy.r);
    if (!canAttackAtHexDistance(unit, distance, 'unit')) continue;
    const score = scoreAttackTarget(unit, enemy, distance, atWar);
    if (score > bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  return best;
}

function bestWarTargetCity(state: GameState, civIndex: number, unit: Unit, posture: AIStrategicPosture): City | null {
  const wars = new Set(warOpponentIds(state, civIndex));
  let best: City | null = null;
  let bestScore = -Infinity;
  for (const city of state.cities) {
    if (!wars.has(city.owner)) continue;
    const distance = hexDistance(unit.q, unit.r, city.q, city.r);
    const cityHealth = city.hp / Math.max(1, city.maxHp);
    const targetBias = posture.targetCiv === city.owner ? 18 : 0;
    const capitalBias = city.isCapital ? 12 : 0;
    const weakBias = Math.max(0, 1 - cityHealth) * 22;
    const score = targetBias + capitalBias + weakBias + city.population * 1.2 - distance * 1.4;
    if (score > bestScore) {
      bestScore = score;
      best = city;
    }
  }
  return best;
}

function nearestDefensiveStation(state: GameState, civIndex: number, unit: Unit, posture: AIStrategicPosture): City | null {
  const threatened =
    posture.defensiveCityId != null
      ? state.cities.find(city => city.id === posture.defensiveCityId && city.owner === civIndex) ?? null
      : null;
  if (threatened) return threatened;
  return nearestOwnCity(state, civIndex, unit.q, unit.r);
}

export function chooseCombatObjective(
  state: GameState,
  civIndex: number,
  unit: Unit,
  personality: AIPersonality,
  posture: AIStrategicPosture,
  rng: () => number
): CombatObjective | null {
  const wars = warOpponentIds(state, civIndex);
  const healthRatio = unit.hp / Math.max(1, unit.maxHp);
  if (healthRatio < 0.34 && rng() < 0.7 + posture.skill * 0.2) {
    const safeCity = nearestOwnCity(state, civIndex, unit.q, unit.r);
    if (safeCity && (safeCity.q !== unit.q || safeCity.r !== unit.r)) {
      return { kind: 'move', targetQ: safeCity.q, targetR: safeCity.r, reason: 'retreat' };
    }
  }

  if (posture.threatLevel > 0.48 && posture.defensiveCityId != null && healthRatio > 0.42) {
    const station = nearestDefensiveStation(state, civIndex, unit, posture);
    if (station && hexDistance(unit.q, unit.r, station.q, station.r) > 2) {
      return { kind: 'move', targetQ: station.q, targetR: station.r, reason: 'defend' };
    }
  }

  const attackUnit = bestAttackableEnemyUnit(state, civIndex, unit, wars);
  if (attackUnit) {
    return { kind: 'attack-unit', unitId: attackUnit.id, targetQ: attackUnit.q, targetR: attackUnit.r };
  }

  const targetCity = bestWarTargetCity(state, civIndex, unit, posture);
  if (targetCity) {
    const distance = hexDistance(unit.q, unit.r, targetCity.q, targetCity.r);
    if (canAttackAtHexDistance(unit, distance, 'city')) {
      return { kind: 'attack-city', cityId: targetCity.id, targetQ: targetCity.q, targetR: targetCity.r };
    }
  }

  const knownEnemy = nearestEnemyCombatUnit(state, civIndex, unit.q, unit.r);
  if (knownEnemy && wars.includes(knownEnemy.owner)) {
    return { kind: 'move', targetQ: knownEnemy.q, targetR: knownEnemy.r, reason: 'front' };
  }

  if (targetCity) {
    return { kind: 'move', targetQ: targetCity.q, targetR: targetCity.r, reason: 'front' };
  }

  if (posture.atWar) {
    const defensiveCity = nearestDefensiveStation(state, civIndex, unit, posture);
    if (defensiveCity && hexDistance(unit.q, unit.r, defensiveCity.q, defensiveCity.r) > 2) {
      return { kind: 'move', targetQ: defensiveCity.q, targetR: defensiveCity.r, reason: 'defend' };
    }
  }

  if (personality.aggressiveness > 65 && posture.victoryFocus === 'military' && rng() < 0.12 + posture.skill * 0.08) {
    const knownForeign = state.cities.filter(city => city.owner !== civIndex);
    if (knownForeign.length > 0) {
      const target = knownForeign.reduce((best, city) =>
        hexDistance(unit.q, unit.r, best.q, best.r) <= hexDistance(unit.q, unit.r, city.q, city.r) ? best : city
      );
      return { kind: 'move', targetQ: target.q, targetR: target.r, reason: 'front' };
    }
  }

  return null;
}
