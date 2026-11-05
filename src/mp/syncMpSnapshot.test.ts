import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/types';
import { mergeAuthoritativeMpSnapshot } from './syncMpSnapshot';

describe('mergeAuthoritativeMpSnapshot', () => {
  it('keeps local view camera when applying remote snapshot', () => {
    const cam = { x: 12, y: 34, zoom: 1.25, rotation: 0 };
    const local = { camera: { x: 0, y: 0, zoom: 1, rotation: 0 } } as unknown as GameState;
    const remote = {
      camera: { x: 999, y: 888, zoom: 0.5, rotation: 0 },
      civilizations: [],
      tiles: [[]],
      cities: [],
      units: [],
      systems: {},
      settings: {
        mapWidth: 2,
        mapHeight: 2,
        numCivs: 2,
        difficulty: 'prince',
        seed: 1,
        maxTurns: 100,
        mapType: 'continents',
        civNames: ['a', 'b'],
        humanCivIndex: 0,
        humanNickname: '',
      },
      turn: 1,
      currentCivIndex: 0,
      relations: [],
      tradeRoutes: [],
      nextTradeRouteId: 1,
      nextCityId: 1,
      nextUnitId: 1,
      phase: 'playing',
      winner: null,
      victoryType: null,
      messages: [],
      stackUnitsToMove: 1,
      selectedUnitId: null,
      selectedCityId: null,
      selectedTile: null,
      world: { disastersActiveThisTurn: 0 },
    } as unknown as GameState;

    const out = mergeAuthoritativeMpSnapshot(local, remote, cam);
    expect(out.camera.x).toBe(cam.x);
    expect(out.camera.y).toBe(cam.y);
    expect(out.camera.zoom).toBe(cam.zoom);
  });
});
