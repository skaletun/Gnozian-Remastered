import { addMessage } from '../messages';
import { onAgeTransitionLeaderProgress, syncCivilizationIdentityAge } from '../systems/leaderCore';
import type { AgeState, Civilization, GameAge, GameState } from '../types';

const AGE_THRESHOLDS: Record<GameAge, number> = {
  antiquity: 220,
  exploration: 340,
  modern: 520,
};

function nextAge(age: GameAge): GameAge | null {
  if (age === 'antiquity') return 'exploration';
  if (age === 'exploration') return 'modern';
  return null;
}

function representativeEraForAge(age: GameAge): Civilization['era'] {
  if (age === 'antiquity') return 'classical';
  if (age === 'exploration') return 'industrial';
  return 'modern';
}

export function createInitialAgeState(numCivs: number): AgeState {
  return {
    currentAge: 'antiquity',
    phase: 'ongoing',
    turnsInAge: 0,
    threshold: AGE_THRESHOLDS.antiquity,
    pointsByCiv: Array.from({ length: Math.max(1, numCivs) }, () => 0),
    pendingTransitionTurn: null,
    triggerCivIndex: null,
    modernLegacyUnlocked: false,
    history: [],
  };
}

function ensureAgeState(state: GameState): AgeState {
  const current = state.age;
  if (!current) return createInitialAgeState(state.civilizations.length);
  if (!Array.isArray(current.pointsByCiv) || current.pointsByCiv.length !== state.civilizations.length) {
    return {
      ...current,
      pointsByCiv: Array.from({ length: state.civilizations.length }, (_, i) =>
        Math.max(0, Math.floor(Number(current.pointsByCiv?.[i] ?? 0)))
      ),
    };
  }
  return current;
}

function ageGainForCiv(state: GameState, civIndex: number): number {
  const civ = state.civilizations[civIndex];
  if (!civ?.isAlive) return 0;
  const cityCount = civ.cities.length;
  const wonderCount = Object.values(state.systems.wonderOwners).filter(o => o?.civIndex === civIndex).length;
  const science = Math.max(0, civ.resources.science ?? 0);
  const culture = Math.max(0, civ.resources.culture ?? 0);
  const diplomacy = Math.max(0, civ.diplomaticVictoryPoints ?? 0);
  const gp = Math.max(0, civ.greatPeopleEarned ?? 0);
  const score =
    science / 55 +
    culture / 45 +
    cityCount * 0.75 +
    wonderCount * 1.3 +
    diplomacy * 0.15 +
    gp * 0.2;
  return Math.max(1, Math.min(18, Math.round(score)));
}

function applyAgeTransition(state: GameState, age: AgeState): GameState {
  const toAge = nextAge(age.currentAge);
  if (!toAge) {
    return { ...state, age: { ...age, phase: 'ongoing', pendingTransitionTurn: null, triggerCivIndex: null } };
  }
  const trigger = age.triggerCivIndex ?? 0;
  const civs = state.civilizations.map(c =>
    !c.isAlive
      ? c
      : {
          ...c,
          era: representativeEraForAge(toAge),
          diplomaticFavor: c.diplomaticFavor + 5,
          resources: {
            ...c.resources,
            production: Math.max(0, (c.resources.production ?? 0) + 40),
            gold: Math.max(-100, (c.resources.gold ?? 0) + 30),
          },
        }
  );
  const cities = state.cities.map(c => ({
    ...c,
    loyalty: Math.min(100, c.loyalty + 6),
    hp: Math.min(c.maxHp, c.hp + 15),
  }));
  const relations = state.relations.map(r => ({
    ...r,
    trust: Math.min(100, (r.trust ?? 0) + 5),
    grievances: Math.max(0, Math.floor((r.grievances ?? 0) * 0.7)),
  }));
  const next: AgeState = {
    currentAge: toAge,
    phase: 'ongoing',
    turnsInAge: 0,
    threshold: AGE_THRESHOLDS[toAge],
    pointsByCiv: Array.from({ length: state.civilizations.length }, () => 0),
    pendingTransitionTurn: null,
    triggerCivIndex: null,
    modernLegacyUnlocked: age.modernLegacyUnlocked,
    history: [...age.history, { fromAge: age.currentAge, toAge, turn: state.turn, triggerCivIndex: trigger }],
  };
  const transitioned = { ...state, civilizations: civs, cities, relations, age: next };
  const withLeaderProgress = onAgeTransitionLeaderProgress(transitioned);
  const withIdentityAge = syncCivilizationIdentityAge(withLeaderProgress, toAge);
  return addMessage(
    withIdentityAge,
    `A new era begins: ${toAge.toUpperCase()}.`,
    'info'
  );
}

export function runAgeFrameworkTurn(state: GameState): GameState {
  const age = ensureAgeState(state);
  if (age.phase === 'transition') return applyAgeTransition(state, age);

  const points = [...age.pointsByCiv];
  for (let i = 0; i < state.civilizations.length; i++) {
    points[i] = (points[i] ?? 0) + ageGainForCiv(state, i);
  }
  const next: AgeState = {
    ...age,
    turnsInAge: age.turnsInAge + 1,
    pointsByCiv: points,
  };
  const reached = points.findIndex((p, i) => state.civilizations[i]?.isAlive && p >= age.threshold);
  if (reached < 0) return { ...state, age: next };

  if (age.currentAge === 'modern') {
    if (age.modernLegacyUnlocked) return { ...state, age: next };
    return addMessage(
      {
        ...state,
        age: { ...next, modernLegacyUnlocked: true },
      },
      'Modern age legacy threshold reached.',
      'info',
      [reached]
    );
  }

  return addMessage(
    {
      ...state,
      age: {
        ...next,
        phase: 'transition',
        pendingTransitionTurn: state.turn,
        triggerCivIndex: reached,
      },
    },
    `Age transition prepared (${age.currentAge} -> ${nextAge(age.currentAge)}).`,
    'info',
    [reached]
  );
}

