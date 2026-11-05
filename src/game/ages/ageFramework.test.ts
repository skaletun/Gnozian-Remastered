import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createInitialAgeState, runAgeFrameworkTurn } from './ageFramework';

function stubState(): GameState {
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
      seed: 7,
      maxTurns: 200,
      mapType: 'continents',
      civNames: ['A'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 1,
    currentCivIndex: 0,
    tiles: [[{ q: 0, r: 0 } as any]],
    cities: [],
    units: [],
    civilizations: [
      {
        id: 0,
        name: 'A',
        adjective: 'A',
        leader: 'L',
        color: '#fff',
        secondaryColor: '#000',
        isHuman: true,
        isAlive: true,
        capital: null,
        cities: [],
        units: [],
        resources: { food: 0, production: 0, gold: 0, science: 600, culture: 400, faith: 0, happiness: 0 },
        lastTurnIncome: {},
        researchedTechs: [],
        currentResearch: null,
        researchProgress: 0,
        researchedCivics: ['code_of_laws'],
        currentCivic: null,
        civicProgress: 0,
        policies: [],
        era: 'ancient',
        score: 0,
        greatPeoplePoints: {},
        scienceVictoryProgress: 0,
        culturalInfluence: {},
        faithPool: 0,
        tourism: 0,
        religionIndex: null,
        lifetimeCulture: 0,
        diplomaticVictoryPoints: 0,
        diplomaticFavor: 0,
        consecutivePeaceTurns: 0,
        greatPeopleEarned: 0,
        patronagePoints: 0,
        governmentId: 'chiefdom',
        slottedPolicyIds: [],
        aiPersonality: 'BUILDER',
      },
    ],
    relations: [],
    tradeRoutes: [],
    tradeAgreements: [],
    nextTradeAgreementId: 1,
    nextTradeRouteId: 1,
    nextCityId: 1,
    nextUnitId: 1,
    phase: 'playing',
    winner: null,
    victoryType: null,
    age: createInitialAgeState(1),
    messages: [],
    stackUnitsToMove: 9999,
    selectedUnitId: null,
    selectedCityId: null,
    selectedTile: null,
    camera: { x: 0, y: 0, zoom: 1 },
    world: { hour: 6, weather: 'clear' },
  };
}

describe('ageFramework', () => {
  it('initializes antiquity defaults', () => {
    const age = createInitialAgeState(3);
    expect(age.currentAge).toBe('antiquity');
    expect(age.pointsByCiv).toEqual([0, 0, 0]);
    expect(age.phase).toBe('ongoing');
  });

  it('moves to transition when threshold reached', () => {
    let s = stubState();
    for (let i = 0; i < 40; i++) {
      s = runAgeFrameworkTurn(s);
      s = { ...s, turn: s.turn + 1 };
      if (s.age?.phase === 'transition') break;
    }
    expect(s.age?.phase).toBe('transition');
  });
});

