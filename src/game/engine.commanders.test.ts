import { describe, expect, it } from 'vitest';
import { appointUnitCommander, assignUnitCommander, combatUnit, declareWar } from './engine';
import type { Civilization, GameState, Tile, Unit } from './types';

function makeTile(q: number, r: number): Tile {
  return {
    q, r, terrain: 'plains', improvement: 'none', resource: null, owner: null, city: null, territoryCityId: null, unit: null, revealed: [true, true], visible: [true, true],
  };
}

function makeCiv(id: number): Civilization {
  return {
    id, name: `Civ${id}`, adjective: `Civ${id}`, leader: 'Leader', color: '#fff', secondaryColor: '#000',
    isHuman: id === 0, isAlive: true, capital: null, cities: [], units: [],
    resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
    lastTurnIncome: {}, researchedTechs: [], currentResearch: null, researchProgress: 0, researchedCivics: [],
    currentCivic: null, civicProgress: 0, policies: [], era: 'ancient', score: 0, greatPeoplePoints: {},
    scienceVictoryProgress: 0, culturalInfluence: {}, faithPool: 0, tourism: 0, religionIndex: null, lifetimeCulture: 0,
    diplomaticVictoryPoints: 0, diplomaticFavor: 0, consecutivePeaceTurns: 0, greatPeopleEarned: 0, patronagePoints: 0,
    governmentId: 'chiefdom', slottedPolicyIds: [], aiPersonality: 'BUILDER',
  };
}

function makeWarrior(id: number, owner: number, q: number, r: number): Unit {
  return {
    id, owner, q, r, type: 'warrior', hp: 100, maxHp: 100, movement: 2, maxMovement: 2, strength: 20,
    rangedStrength: 0, range: 0, hasAttacked: false, promotions: [], era: 'ancient', name: 'Warrior',
  };
}

function stateWithUnits(units: Unit[]): GameState {
  const tiles: Tile[][] = Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, q) => makeTile(q, r)));
  for (const u of units) tiles[u.r][u.q].unit = u.id;
  const civs = [makeCiv(0), makeCiv(1)];
  civs[0].units = units.filter(u => u.owner === 0).map(u => u.id);
  civs[1].units = units.filter(u => u.owner === 1).map(u => u.id);
  return {
    systems: {
      wonderOwners: {}, religions: [], cityFaithPressure: {}, tourismTotal: {}, influence: {},
      influenceDiplomacy: { balances: {}, actionLog: [], treaties: [], sanctions: [], endeavors: [] },
      independentPowers: [], nextIndependentPowerId: 1, commanders: [], nextCommanderId: 1,
      touristVisiting: {}, touristDomestic: {}, spies: [], disasters: [], greatPeopleMeter: {},
      greatPersonProgress: {}, greatPersonClaimed: [], greatWorks: [], nextGreatWorkId: 1, worldVotes: [],
      spaceRace: {}, nextSpyId: 1, nextDisasterId: 1,
    },
    settings: { mapWidth: 6, mapHeight: 6, numCivs: 2, difficulty: 'prince', seed: 7, maxTurns: 100, mapType: 'continents', civNames: ['Civ0', 'Civ1'], humanCivIndex: 0, humanNickname: '' },
    turn: 6, currentCivIndex: 0, tiles, cities: [], units, civilizations: civs, relations: [], tradeRoutes: [],
    nextTradeRouteId: 1, nextCityId: 1, nextUnitId: 4, phase: 'playing', winner: null, victoryType: null, messages: [],
    stackUnitsToMove: 9999, selectedUnitId: null, selectedCityId: null, selectedTile: null, camera: { x: 0, y: 0, zoom: 1 }, world: { hour: 6, weather: 'clear' },
  } as GameState;
}

describe('engine commanders integration', () => {
  it('commander assignment improves combat outcome', () => {
    const attacker = makeWarrior(1, 0, 1, 1);
    const assigned = makeWarrior(2, 0, 1, 2);
    const defender = makeWarrior(3, 1, 2, 2);

    const base = declareWar(stateWithUnits([attacker, assigned, defender]), 0, 1);
    const withoutBonus = combatUnit(base, 2, 3);
    const hpWithout = withoutBonus.units.find(u => u.id === 3)?.hp ?? 100;

    let withCommander = appointUnitCommander(base, 0, 1);
    const commanderId = withCommander.systems.commanders[0]?.id ?? '';
    withCommander = assignUnitCommander(withCommander, 0, commanderId, 2);
    const withBonus = combatUnit(withCommander, 2, 3);
    const hpWith = withBonus.units.find(u => u.id === 3)?.hp ?? 100;

    expect(hpWith).toBeLessThan(hpWithout);
  });
});

