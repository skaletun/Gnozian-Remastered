import { describe, expect, it } from 'vitest';
import { pickScoutAutoExploreStep, runAllScoutsAutoExplore } from './engine';
import type { GameState, Tile, Unit } from './types';

function makeTile(q: number, r: number, revealed: boolean): Tile {
  return {
    q,
    r,
    terrain: 'plains',
    improvement: 'none',
    resource: null,
    owner: null,
    city: null,
    territoryCityId: null,
    unit: null,
    revealed: [revealed],
    visible: [revealed],
  };
}

function makeState(opts: { allRevealed?: boolean } = {}): GameState {
  const tiles = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 8 }, (_, q) => makeTile(q, r, opts.allRevealed ? true : q <= 4))
  );
  const scout: Unit = {
    id: 1,
    type: 'scout',
    owner: 0,
    q: 1,
    r: 1,
    hp: 100,
    maxHp: 100,
    movement: 3,
    maxMovement: 3,
    strength: 5,
    rangedStrength: 0,
    range: 0,
    hasAttacked: false,
    promotions: [],
    era: 'ancient',
    name: 'Scout',
    scoutAutoExplore: true,
  };
  tiles[1]![1]!.unit = scout.id;
  return {
    systems: {} as GameState['systems'],
    settings: {
      mapWidth: 8,
      mapHeight: 3,
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
    tiles,
    cities: [],
    units: [scout],
    civilizations: [
      {
        id: 0,
        name: 'A',
        adjective: 'A',
        leader: 'A',
        color: '#fff',
        secondaryColor: '#000',
        isHuman: true,
        isAlive: true,
        capital: null,
        cities: [],
        units: [scout.id],
        resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
        lastTurnIncome: {},
        researchedTechs: [],
        currentResearch: null,
        researchProgress: 0,
        researchedCivics: [],
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
  } as GameState;
}

describe('scout auto explore', () => {
  it('moves toward distant unrevealed frontier from an already revealed area', () => {
    const out = runAllScoutsAutoExplore(makeState());
    expect(out.tiles.flat().some(tile => tile.q > 4 && tile.revealed[0])).toBe(true);
  });

  it('does not wander when the whole map is already revealed', () => {
    const out = runAllScoutsAutoExplore(makeState({ allRevealed: true }));
    const scout = out.units.find(u => u.id === 1)!;
    expect([scout.q, scout.r, scout.movement]).toEqual([1, 1, 3]);
  });

  it('picks a reproducible auto-explore step for the same state snapshot', () => {
    const s = makeState();
    const scout = s.units.find(u => u.id === 1)!;
    const a = pickScoutAutoExploreStep(s, scout, null);
    const b = pickScoutAutoExploreStep(s, scout, null);
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
  });
});
