import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import {
  appointCommander,
  assignUnitToCommander,
  commanderStrengthBonusPct,
  tickCommanders,
} from './commandersCore';

function makeState(): GameState {
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
      mapWidth: 8,
      mapHeight: 8,
      numCivs: 2,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A', 'B'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 3,
    currentCivIndex: 0,
    tiles: [[{ q: 0, r: 0 } as any]],
    cities: [],
    units: [
      { id: 1, owner: 0, type: 'warrior', q: 2, r: 2, hp: 100, maxHp: 100, movement: 2, maxMovement: 2, strength: 20, rangedStrength: 0, range: 0, hasAttacked: false, promotions: [], era: 'ancient', name: 'W1' },
      { id: 2, owner: 0, type: 'warrior', q: 3, r: 2, hp: 100, maxHp: 100, movement: 2, maxMovement: 2, strength: 20, rangedStrength: 0, range: 0, hasAttacked: false, promotions: [], era: 'ancient', name: 'W2' },
    ] as any,
    civilizations: [
      { id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000', isHuman: true, isAlive: true, capital: null, cities: [], units: [1, 2], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 }, lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER' },
      { id: 1, name: 'B', adjective: 'B', leader: 'L2', color: '#fff', secondaryColor: '#000', isHuman: false, isAlive: true, capital: null, cities: [], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 }, lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER' },
    ],
    relations: [],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 1,
    nextUnitId: 3,
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
  } as unknown as GameState;
}

describe('commandersCore', () => {
  it('appoints and assigns units', () => {
    const s0 = makeState();
    const s1 = appointCommander(s0, 0, 1);
    const id = s1.systems.commanders[0]?.id;
    expect(id).toBeTruthy();
    const s2 = assignUnitToCommander(s1, 0, id!, 2);
    expect(s2.systems.commanders[0]?.assignedUnitIds).toContain(2);
    expect(commanderStrengthBonusPct(s2, s2.units.find(u => u.id === 2)!)).toBeGreaterThan(0);
  });

  it('ticks commander timers', () => {
    const s0 = makeState();
    const s1 = {
      ...s0,
      systems: {
        ...s0.systems,
        commanders: [{
          id: 'cmd-1',
          ownerCiv: 0,
          unitId: 1,
          domain: 'army' as const,
          level: 1,
          xp: 0,
          assignedUnitIds: [2],
          activeTurnsLeft: 2,
          cooldownTurnsLeft: 4,
        }],
      },
    };
    const out = tickCommanders(s1);
    expect(out.systems.commanders[0]?.activeTurnsLeft).toBe(1);
    expect(out.systems.commanders[0]?.cooldownTurnsLeft).toBe(3);
  });
});

