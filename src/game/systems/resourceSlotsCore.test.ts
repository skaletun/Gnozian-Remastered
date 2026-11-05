import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { applyResourceSlotModifiers, computeResourceSlotSnapshot } from './resourceSlotsCore';

function mkState(age: 'antiquity' | 'exploration' | 'modern'): GameState {
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
        pointsByCiv: {},
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
      mapWidth: 4,
      mapHeight: 1,
      numCivs: 1,
      difficulty: 'prince',
      seed: 1,
      maxTurns: 100,
      mapType: 'continents',
      civNames: ['A'],
      humanCivIndex: 0,
      humanNickname: '',
    },
    turn: 1,
    currentCivIndex: 0,
    tiles: [[
      { q: 0, r: 0, terrain: 'plains', improvement: 'farm', resource: 'wheat', owner: 0, city: null, territoryCityId: null, unit: null, revealed: [true], visible: [true] },
      { q: 1, r: 0, terrain: 'hills', improvement: 'mine', resource: 'iron', owner: 0, city: null, territoryCityId: null, unit: null, revealed: [true], visible: [true] },
      { q: 2, r: 0, terrain: 'hills', improvement: 'mine', resource: 'gold_ore', owner: 0, city: null, territoryCityId: null, unit: null, revealed: [true], visible: [true] },
      { q: 3, r: 0, terrain: 'grassland', improvement: 'pasture', resource: 'cattle', owner: 0, city: null, territoryCityId: null, unit: null, revealed: [true], visible: [true] },
    ]] as any,
    cities: [],
    units: [],
    civilizations: [{
      id: 0, name: 'A', adjective: 'A', leader: 'L', color: '#fff', secondaryColor: '#000', isHuman: true, isAlive: true,
      capital: null, cities: [], units: [], resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
      lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [], currentCivic: null, civicProgress: 0,
      policies: [], era: 'ancient', score: 0, greatPeoplePoints: {}, scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0,
      religionIndex: null, lifetimeCulture: 0, diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0,
      patronagePoints: 0, governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER',
    }],
    relations: [],
    tradeRoutes: [],
    nextTradeRouteId: 1,
    nextCityId: 1,
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
    age: { currentAge: age, phase: 'ongoing', turnsInAge: 1, threshold: 220, pointsByCiv: [0], pendingTransitionTurn: null, triggerCivIndex: null, modernLegacyUnlocked: false, history: [] },
  } as unknown as GameState;
}

describe('resourceSlotsCore', () => {
  it('computes slot snapshot by age caps', () => {
    const a = computeResourceSlotSnapshot(mkState('antiquity'), 0);
    const m = computeResourceSlotSnapshot(mkState('modern'), 0);
    expect(a.caps.luxury).toBeLessThan(m.caps.luxury);
    expect(a.slotted.bonus).toBeGreaterThan(0);
  });

  it('applies modifiers from slotted resources', () => {
    const s = mkState('exploration');
    const out = applyResourceSlotModifiers(
      s,
      0,
      { food: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
      0
    );
    expect(out.inc.gold).toBeGreaterThan(0);
    expect(out.production).toBeGreaterThanOrEqual(0);
  });
});

