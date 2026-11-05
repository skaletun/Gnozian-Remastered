import type { City, GameState, Unit } from './types';
import { hexDistance } from './mapgen';

function isCombatUnit(unit: Unit): boolean {
  return unit.strength > 0 || unit.rangedStrength > 0;
}

export function computeMilitaryPower(state: GameState, civIndex: number): number {
  let sum = 0;
  for (const unit of state.units) {
    if (unit.owner !== civIndex || !isCombatUnit(unit)) continue;
    const healthRatio = Math.max(0.15, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
    sum += (unit.strength + unit.rangedStrength * 1.1) * healthRatio + Math.min(40, unit.hp) * 0.08;
  }
  for (const city of state.cities) {
    if (city.owner !== civIndex) continue;
    const cityHealth = Math.max(0.2, city.hp / Math.max(1, city.maxHp));
    sum += 14 + city.defense * 0.35 + cityHealth * 8;
  }
  return sum;
}

export function relationForPair(state: GameState, civA: number, civB: number) {
  return state.relations.find(
    r => (r.civA === civA && r.civB === civB) || (r.civA === civB && r.civB === civA)
  );
}

export function areCivsAtWar(state: GameState, civA: number, civB: number): boolean {
  return relationForPair(state, civA, civB)?.status === 'war';
}

export function warOpponentIds(state: GameState, civIndex: number): number[] {
  const opponents: number[] = [];
  for (let i = 0; i < state.civilizations.length; i++) {
    if (i === civIndex || !state.civilizations[i]?.isAlive) continue;
    if (areCivsAtWar(state, civIndex, i)) opponents.push(i);
  }
  return opponents;
}

export function atWarWithAnyone(state: GameState, civIndex: number): boolean {
  return warOpponentIds(state, civIndex).length > 0;
}

export function nearestWarEnemyCity(state: GameState, civIndex: number, fromQ: number, fromR: number): City | null {
  const opponents = new Set(warOpponentIds(state, civIndex));
  if (opponents.size === 0) return null;
  let best: City | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const city of state.cities) {
    if (!opponents.has(city.owner)) continue;
    const d = hexDistance(fromQ, fromR, city.q, city.r);
    if (d < bestD) {
      bestD = d;
      best = city;
    }
  }
  return best;
}

export function nearestEnemyCombatUnit(state: GameState, civIndex: number, fromQ: number, fromR: number): Unit | null {
  let best: Unit | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const unit of state.units) {
    if (unit.owner === civIndex || !isCombatUnit(unit)) continue;
    const d = hexDistance(fromQ, fromR, unit.q, unit.r);
    if (d < bestD) {
      bestD = d;
      best = unit;
    }
  }
  return best;
}

export function minCityDistance(state: GameState, civA: number, civB: number): number {
  const aCities = state.cities.filter(city => city.owner === civA);
  const bCities = state.cities.filter(city => city.owner === civB);
  if (aCities.length === 0 || bCities.length === 0) return 999;
  let best = 999;
  for (const a of aCities) {
    for (const b of bCities) {
      best = Math.min(best, hexDistance(a.q, a.r, b.q, b.r));
    }
  }
  return best;
}

export function minDistanceEnemyUnitToOurCities(state: GameState, civIndex: number): number {
  const myCities = state.cities.filter(city => city.owner === civIndex);
  if (myCities.length === 0) return 999;
  let best = 999;
  for (const unit of state.units) {
    if (unit.owner === civIndex || !isCombatUnit(unit)) continue;
    for (const city of myCities) {
      best = Math.min(best, hexDistance(unit.q, unit.r, city.q, city.r));
    }
  }
  return best;
}

export function strongestKnownEnemyPower(state: GameState, civIndex: number): number {
  let best = 0;
  for (let i = 0; i < state.civilizations.length; i++) {
    if (i === civIndex || !state.civilizations[i]?.isAlive) continue;
    best = Math.max(best, computeMilitaryPower(state, i));
  }
  return best;
}

export type AIEmpireMetrics = {
  cities: number;
  units: number;
  combatUnits: number;
  researchedTechs: number;
  researchedCivics: number;
  totalPopulation: number;
  totalYield: number;
  militaryPower: number;
};

export type AIRivalAssessment = {
  civIndex: number;
  power: number;
  score: number;
  cityDistance: number;
  trust: number;
  grievances: number;
  isAtWar: boolean;
  attackOpportunity: number;
  threat: number;
};

export function computeEmpireMetrics(state: GameState, civIndex: number): AIEmpireMetrics {
  const civ = state.civilizations[civIndex]!;
  const cities = state.cities.filter(city => city.owner === civIndex);
  const units = state.units.filter(unit => unit.owner === civIndex);
  const totalYield = cities.reduce(
    (sum, city) =>
      sum +
      Object.values(city.yields).reduce((yieldSum, value) => yieldSum + (Number.isFinite(value) ? value : 0), 0),
    0
  );
  return {
    cities: cities.length,
    units: units.length,
    combatUnits: units.filter(isCombatUnit).length,
    researchedTechs: civ.researchedTechs.length,
    researchedCivics: civ.researchedCivics.length,
    totalPopulation: cities.reduce((sum, city) => sum + city.population, 0),
    totalYield,
    militaryPower: computeMilitaryPower(state, civIndex),
  };
}

export function assessRivals(state: GameState, civIndex: number): AIRivalAssessment[] {
  const ownPower = Math.max(1, computeMilitaryPower(state, civIndex));
  return state.civilizations
    .map((civ, index): AIRivalAssessment | null => {
      if (index === civIndex || !civ.isAlive) return null;
      const relation = relationForPair(state, civIndex, index);
      const power = computeMilitaryPower(state, index);
      const cityDistance = minCityDistance(state, civIndex, index);
      const trust = relation?.trust ?? 0;
      const grievances = relation?.grievances ?? 0;
      const isAtWar = relation?.status === 'war';
      const proximity = Math.max(0, 12 - Math.min(12, cityDistance));
      const powerEdge = ownPower / Math.max(1, power);
      const attackOpportunity =
        proximity * 1.8 +
        Math.max(0, powerEdge - 0.95) * 28 +
        grievances * 0.14 -
        Math.max(0, trust) * 0.08 +
        (isAtWar ? 18 : 0);
      const threat =
        proximity * 1.4 +
        Math.max(0, power / ownPower - 0.85) * 32 +
        Math.max(0, -trust) * 0.08 +
        (isAtWar ? 22 : 0);
      return {
        civIndex: index,
        power,
        score: civ.score,
        cityDistance,
        trust,
        grievances,
        isAtWar,
        attackOpportunity,
        threat,
      };
    })
    .filter((rival): rival is AIRivalAssessment => rival != null)
    .sort((a, b) => b.threat + b.attackOpportunity - (a.threat + a.attackOpportunity));
}

export function mostThreatenedOwnCity(state: GameState, civIndex: number): City | null {
  const cities = state.cities.filter(city => city.owner === civIndex);
  if (cities.length === 0) return null;
  let best: City | null = null;
  let bestScore = -Infinity;
  for (const city of cities) {
    let nearest = 999;
    let enemyPower = 0;
    for (const unit of state.units) {
      if (unit.owner === civIndex || !isCombatUnit(unit)) continue;
      const d = hexDistance(city.q, city.r, unit.q, unit.r);
      if (d <= 6) enemyPower += unit.strength + unit.rangedStrength;
      nearest = Math.min(nearest, d);
    }
    const cityHealthPenalty = Math.max(0, 1 - city.hp / Math.max(1, city.maxHp)) * 18;
    const score = Math.max(0, 8 - nearest) * 5 + enemyPower * 0.7 + cityHealthPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = city;
    }
  }
  return bestScore > 0 ? best : null;
}
