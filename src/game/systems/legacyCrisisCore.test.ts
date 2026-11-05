import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import {
  applyLegacyAndCrisisIncomeModifiers,
  chooseCrisisPolicy,
  chooseLegacyOption,
  normalizeLegacyCrisis,
  snoozeCrisisPolicyPrompt,
  snoozeLegacyPrompt,
  tickLegacyCrisis,
} from './legacyCrisisCore';
import { LEGACY_PROMPT_SNOOZE_TURNS, CRISIS_POLICY_PROMPT_SNOOZE_TURNS } from '../constants';

function makeState(transition = true): GameState {
  return {
    systems: {
      wonderOwners: {},
      religions: [],
      cityFaithPressure: {},
      tourismTotal: {},
      influence: {},
      influenceDiplomacy: { balances: {}, actionLog: [], treaties: [], sanctions: [], endeavors: [] },
      independentPowers: [],
      nextIndependentPowerId: 1,
      commanders: [],
      nextCommanderId: 1,
      geographyProgress: {
        homeHemisphereByCiv: {},
        distantLandsDiscoveredByCiv: {},
        distantLandsTotalByCiv: {},
        oceanUnlockedByCiv: {},
        riverNavigationUnlockedByCiv: {},
      },
      legacyCrisis: {
        pointsByCiv: { 0: { military: 0, science: 0, culture: 0, economy: 0 } },
        pendingLegacyChoices: [],
        history: [],
        activeYieldModifiersByCiv: {},
        crisisActive: false,
        crisisAge: null,
        crisisTurnsLeft: 0,
        crisisSeverity: 0,
        selectedPolicyByCiv: {},
      },
      touristVisiting: {},
      touristDomestic: {},
      spies: [],
      disasters: [],
      greatPeopleMeter: {},
      greatPersonProgress: {},
      greatPersonClaimed: [],
      greatWorks: [],
      nextGreatWorkId: 1,
      worldVotes: [],
      spaceRace: {},
      nextSpyId: 1,
      nextDisasterId: 1,
    },
    settings: {
      mapWidth: 2,
      mapHeight: 2,
      numCivs: 1,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 10,
    currentCivIndex: 0,
    tiles: [[{ q: 0, r: 0 } as any]],
    cities: [],
    units: [{ id: 1, owner: 0 }] as any,
    civilizations: [
      {
        id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000',
        isHuman: true, isAlive: true, capital: null, cities: [], units: [1],
        resources: { food: 0, production: 0, gold: 20, science: 30, culture: 25, faith: 0, happiness: 0 },
        lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [],
        currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0, greatPeoplePoints: {},
        scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null,
        lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0,
        greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER',
      },
    ],
    relations: [],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 1,
    nextUnitId: 2,
    phase: 'playing',
    winner: null,
    victoryType: null,
    messages: [],
    stackUnitsToMove: 9999,
    selectedUnitId: null,
    selectedCityId: null,
    selectedTile: null,
    camera: { x: 0, y: 0, zoom: 1 },
    world: { hour: 6, weather: 'clear' },
    age: {
      currentAge: 'exploration',
      phase: transition ? 'transition' : 'ongoing',
      turnsInAge: 12,
      threshold: 220,
      pointsByCiv: [230],
      pendingTransitionTurn: transition ? 10 : null,
      triggerCivIndex: transition ? 0 : null,
      modernLegacyUnlocked: false,
      history: [],
    },
  } as unknown as GameState;
}

describe('legacyCrisisCore', () => {
  it('creates pending legacy choices and crisis on transition', () => {
    const out = tickLegacyCrisis(makeState(true));
    expect((out.systems.legacyCrisis?.pendingLegacyChoices.length ?? 0) > 0).toBe(true);
    expect(out.systems.legacyCrisis?.crisisActive).toBe(true);
  });

  it('applies chosen legacy and crisis policy modifiers', () => {
    let s = tickLegacyCrisis(makeState(true));
    s = chooseLegacyOption(s, 0, 'science', 'golden_age');
    s = chooseCrisisPolicy(s, 0, 'knowledge_preservation');
    const res = applyLegacyAndCrisisIncomeModifiers(
      s,
      0,
      { food: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
      0
    );
    expect(res.inc.science).toBeGreaterThan(0);
  });

  it('defers legacy prompt without resolving choice', () => {
    let s = tickLegacyCrisis(makeState(true));
    expect(normalizeLegacyCrisis(s).pendingLegacyChoices.some(p => p.civIndex === 0)).toBe(true);
    s = snoozeLegacyPrompt(s, 0);
    const lc = normalizeLegacyCrisis(s);
    expect(lc.pendingLegacyChoices.some(p => p.civIndex === 0)).toBe(true);
    expect(lc.legacyPromptSnoozeUntilTurnByCiv?.[0]).toBe(s.turn + LEGACY_PROMPT_SNOOZE_TURNS);
  });

  it('defers crisis policy prompt without ending crisis', () => {
    let s = tickLegacyCrisis(makeState(true));
    s = chooseLegacyOption(s, 0, 'science', 'golden_age');
    const lcBefore = normalizeLegacyCrisis(s);
    expect(lcBefore.crisisActive).toBe(true);
    s = snoozeCrisisPolicyPrompt(s, 0);
    const lc = normalizeLegacyCrisis(s);
    expect(lc.crisisActive).toBe(true);
    expect(lc.selectedPolicyByCiv[0]).toBeNull();
    expect(lc.crisisPolicySnoozeUntilTurnByCiv?.[0]).toBe(s.turn + CRISIS_POLICY_PROMPT_SNOOZE_TURNS);
  });

  it('clears legacy snooze when a path is chosen', () => {
    let s = tickLegacyCrisis(makeState(true));
    s = snoozeLegacyPrompt(s, 0);
    s = chooseLegacyOption(s, 0, 'military', 'golden_age');
    expect(normalizeLegacyCrisis(s).legacyPromptSnoozeUntilTurnByCiv?.[0]).toBeUndefined();
  });
});

