import type { CivicDef, GameState } from './types';
import { AI_PERSONALITIES, DIFFICULTY_MODIFIERS } from './constants';
import {
  assessRivals,
  atWarWithAnyone,
  computeEmpireMetrics,
  computeMilitaryPower,
  minDistanceEnemyUnitToOurCities,
  mostThreatenedOwnCity,
  strongestKnownEnemyPower,
  type AIEmpireMetrics,
  type AIRivalAssessment,
} from './aiMetrics';

export type AIPersonality = (typeof AI_PERSONALITIES)[keyof typeof AI_PERSONALITIES];

export type AIStrategicPosture = {
  skill: number;
  phase: 'opening' | 'midgame' | 'endgame';
  atWar: boolean;
  militaryRatio: number;
  victoryFocus: 'science' | 'culture' | 'religion' | 'diplomacy' | 'military' | 'economy';
  expansionPressure: number;
  threatLevel: number;
  developmentPressure: number;
  targetCiv: number | null;
  defensiveCityId: number | null;
  empire: AIEmpireMetrics;
  rivals: AIRivalAssessment[];
};

/** 0 = weakest AI mistakes, 1 = strongest (deity). */
export function aiSkillFromDifficulty(difficulty: GameState['settings']['difficulty']): number {
  const modifier = DIFFICULTY_MODIFIERS[difficulty] ?? 1;
  return Math.min(1, Math.max(0.28, 0.22 + modifier * 0.38));
}

export function researchNoiseMax(skill: number): number {
  return Math.max(0.5, 9 * (1 - skill));
}

export function personalityFor(civ: GameState['civilizations'][0]): AIPersonality {
  const key = civ.aiPersonality;
  return AI_PERSONALITIES[key] ?? AI_PERSONALITIES.BUILDER;
}

export function buildAIStrategicPosture(
  state: GameState,
  civIndex: number,
  personality: AIPersonality,
  skill: number
): AIStrategicPosture {
  const turnRatio = state.turn / Math.max(1, state.settings.maxTurns);
  const phase = turnRatio < 0.32 ? 'opening' : turnRatio > 0.72 ? 'endgame' : 'midgame';
  const ownPower = computeMilitaryPower(state, civIndex);
  const enemyPower = strongestKnownEnemyPower(state, civIndex);
  const militaryRatio = ownPower / Math.max(1, enemyPower);
  const atWar = atWarWithAnyone(state, civIndex);
  const empire = computeEmpireMetrics(state, civIndex);
  const rivals = assessRivals(state, civIndex);
  const nearestThreat = minDistanceEnemyUnitToOurCities(state, civIndex);
  const defensiveCity = mostThreatenedOwnCity(state, civIndex);
  const target = rivals
    .filter(rival => rival.cityDistance <= 14 || rival.isAtWar)
    .sort((a, b) => b.attackOpportunity - a.attackOpportunity)[0];
  const averageYieldPerCity = empire.totalYield / Math.max(1, empire.cities);
  const developmentPressure =
    Math.max(0, 9 - averageYieldPerCity) * 0.08 +
    Math.max(0, empire.cities * 1.6 - empire.units) * 0.05 +
    Math.max(0, 4 - empire.researchedTechs) * 0.04;
  const threatLevel =
    Math.max(0, 1 - militaryRatio) * 0.55 +
    Math.max(0, 7 - nearestThreat) * 0.08 +
    (defensiveCity ? 0.24 : 0) +
    (atWar ? 0.18 : 0);

  const focusScores = {
    science:
      personality.scientificFocus +
      state.civilizations[civIndex]!.scienceVictoryProgress * 0.9 +
      Math.max(0, 4 - empire.researchedTechs) * 5,
    culture: personality.culturalFocus + state.civilizations[civIndex]!.tourism * 0.015,
    religion: personality.religiousFocus + state.civilizations[civIndex]!.faithPool * 0.02,
    diplomacy: personality.diplomaticFocus + state.civilizations[civIndex]!.diplomaticFavor * 0.08,
    military: personality.aggressiveness + (atWar ? 28 : 0) + threatLevel * 35 + (target ? target.attackOpportunity * 0.25 : 0),
    economy: personality.economyFocus + state.civilizations[civIndex]!.cities.length * 1.5 + developmentPressure * 28,
  };

  let victoryFocus = 'economy' as AIStrategicPosture['victoryFocus'];
  let bestScore = -Infinity;
  for (const [focus, score] of Object.entries(focusScores)) {
    if (score > bestScore) {
      bestScore = score;
      victoryFocus = focus as AIStrategicPosture['victoryFocus'];
    }
  }

  const expansionPressure =
    (personality.expansionist ? 0.6 : 0.25) +
    (phase === 'opening' ? 0.25 : phase === 'midgame' ? 0.12 : -0.08) +
    skill * 0.12 -
    Math.min(0.35, threatLevel * 0.3);

  return {
    skill,
    phase,
    atWar,
    militaryRatio,
    victoryFocus,
    expansionPressure,
    threatLevel: Math.max(0, Math.min(1.25, threatLevel)),
    developmentPressure: Math.max(0, Math.min(1.25, developmentPressure)),
    targetCiv: target?.civIndex ?? null,
    defensiveCityId: defensiveCity?.id ?? null,
    empire,
    rivals,
  };
}

export function scoreCivicForAI(
  civic: CivicDef,
  civ: GameState['civilizations'][0],
  posture: AIStrategicPosture,
  personality: AIPersonality,
  rng: () => number
): number {
  let score = Math.max(0, 24 - civic.cost / 8) * (0.5 + (1 - posture.skill) * 0.35);
  const unlockText = civic.unlocks.join(' ').toLowerCase();
  const nameText = `${civic.id} ${civic.name} ${civic.description}`.toLowerCase();

  if (unlockText.includes('agoge') || unlockText.includes('conscription')) score += personality.aggressiveness / 8;
  if (unlockText.includes('urban') || nameText.includes('workforce')) score += personality.economyFocus / 12;
  if (unlockText.includes('charismatic') || nameText.includes('diplomatic')) score += personality.diplomaticFocus / 10;
  if (nameText.includes('civil') || nameText.includes('governance')) score += personality.culturalFocus / 18;
  if (posture.atWar && (unlockText.includes('agoge') || unlockText.includes('conscription'))) score += 16;
  if (posture.victoryFocus === 'diplomacy' && nameText.includes('political')) score += 14;
  if (posture.victoryFocus === 'culture' && nameText.includes('civil')) score += 8;
  if (posture.phase === 'opening' && civic.id === 'craftsmanship') score += 10;
  if (posture.phase !== 'opening' && civic.id === 'civil_service') score += 12;
  if (civ.researchedCivics.length < 2) score += Math.max(0, 10 - civic.cost / 7);

  score += rng() * Math.max(0.4, 5 * (1 - posture.skill));
  return score;
}
