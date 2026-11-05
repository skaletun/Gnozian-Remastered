import type { City, GameState, Unit } from './types';
import { hexDistance } from './mapgen';
import type { AIStrategicPosture } from './aiStrategy';

export type GreatPersonObjective =
  | { action: 'activate'; cityId: number; score: number }
  | { action: 'move'; cityId: number; q: number; r: number; score: number }
  | { action: 'wait' };

function scoreCityForGreatPerson(city: City, unit: Unit, posture: AIStrategicPosture): number {
  const yields = city.yields;
  let score = city.population * 0.75 + (city.isCapital ? 4 : 0);
  switch (unit.type) {
    case 'great_scientist':
    case 'great_engineer':
      score += (yields.science ?? 0) * 2.3 + (yields.production ?? 0) * 1.4;
      if (posture.victoryFocus === 'science') score += 7;
      break;
    case 'great_artist':
    case 'great_writer':
    case 'great_musician':
      score += (yields.culture ?? 0) * 2.2 + city.greatWorkIds.length * 0.8;
      if (posture.victoryFocus === 'culture') score += 7;
      break;
    case 'great_merchant':
      score += (yields.gold ?? 0) * 2 + (posture.victoryFocus === 'economy' ? 7 : 0);
      break;
    case 'great_prophet':
      score += (yields.faith ?? 0) * 2 + (posture.victoryFocus === 'religion' ? 7 : 0);
      break;
    case 'great_general':
    case 'great_admiral':
      score += (posture.defensiveCityId === city.id ? 7 : 0) + (posture.threatLevel > 0.35 ? 5 : 0);
      break;
    default:
      score += (yields.production ?? 0) + (yields.culture ?? 0) + (yields.science ?? 0);
      break;
  }
  return score;
}

export function chooseGreatPersonObjective(state: GameState, civIndex: number, unit: Unit, posture: AIStrategicPosture): GreatPersonObjective {
  const cities = state.cities.filter(city => city.owner === civIndex);
  if (cities.length === 0) return { action: 'wait' };
  const target = cities
    .map(city => ({
      city,
      score: scoreCityForGreatPerson(city, unit, posture) - hexDistance(unit.q, unit.r, city.q, city.r) * 0.45,
    }))
    .sort((a, b) => b.score - a.score)[0]!;
  if (unit.q === target.city.q && unit.r === target.city.r) {
    return { action: 'activate', cityId: target.city.id, score: target.score };
  }
  return { action: 'move', cityId: target.city.id, q: target.city.q, r: target.city.r, score: target.score };
}
