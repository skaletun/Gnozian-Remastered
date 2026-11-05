import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { isOpenOceanUnlocked, tickGeographyProgress } from './geographyCore';

function makeState(age: 'antiquity' | 'exploration' | 'modern' = 'antiquity'): GameState {
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
      mapWidth: 6,
      mapHeight: 4,
      numCivs: 1,
      difficulty: 'prince',
      seed: 3,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 4,
    currentCivIndex: 0,
    tiles: [
      [
        { q: 0, r: 0, terrain: 'plains', river: false, revealed: [true], visible: [true] },
        { q: 1, r: 0, terrain: 'plains', river: false, revealed: [true], visible: [true] },
        { q: 2, r: 0, terrain: 'plains', river: false, revealed: [true], visible: [true] },
        { q: 3, r: 0, terrain: 'plains', river: false, revealed: [false], visible: [false] },
        { q: 4, r: 0, terrain: 'plains', river: false, revealed: [true], visible: [true] },
        { q: 5, r: 0, terrain: 'plains', river: false, revealed: [true], visible: [true] },
      ],
    ] as any,
    cities: [{ id: 1, owner: 0, q: 1, r: 0 }] as any,
    units: [],
    civilizations: [
      {
        id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000',
        isHuman: true, isAlive: true, capital: 1, cities: [1], units: [],
        resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
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
    nextCityId: 2,
    nextUnitId: 1,
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
      currentAge: age,
      phase: 'ongoing',
      turnsInAge: 4,
      threshold: 220,
      pointsByCiv: [0],
      pendingTransitionTurn: null,
      triggerCivIndex: null,
      modernLegacyUnlocked: false,
      history: [],
    },
  } as unknown as GameState;
}

describe('geographyCore', () => {
  it('locks ocean in antiquity and unlocks in exploration', () => {
    const a = makeState('antiquity');
    const e = makeState('exploration');
    expect(isOpenOceanUnlocked(a, 0)).toBe(false);
    expect(isOpenOceanUnlocked(e, 0)).toBe(true);
  });

  it('tracks distant lands and grants discovery rewards', () => {
    const s = makeState('exploration');
    const out = tickGeographyProgress(s);
    const g = out.systems.geographyProgress!;
    expect((g.distantLandsDiscoveredByCiv[0] ?? 0) > 0).toBe(true);
    expect((out.civilizations[0]?.resources.gold ?? 0) > 0).toBe(true);
  });
});

