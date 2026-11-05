import type { City, GameSettings, GameState } from '../types';

export type ProcessTurnOptions = {
  /** Fog-of-war refresh for this local viewer slot. */
  visionCivIndex?: number;
  /** When true, skip the final AI sweep (reserved for tooling). */
  skipEndAiBlock?: boolean;
};

interface TurnEndDeps {
  processTurn: (state: GameState, opts?: ProcessTurnOptions) => GameState;
  createAIEngineAPI: () => unknown;
  runAITurn: (state: GameState, civIndex: number, api: unknown) => GameState;
  updateVision: (tiles: GameState['tiles'], civIndex: number, units: GameState['units'], cities: City[]) => void;
  assignWorkedTiles: (city: City, tiles: GameState['tiles'], allCities: City[]) => void;
  calcCityYields: (city: City, tiles: GameState['tiles']) => City['yields'];
  recomputeTileTerritory: (state: GameState) => void;
}

/** Legacy name — hotseat / online sync removed; always false. */
export function isMpHotseatSettings(_settings: GameSettings): boolean {
  return false;
}

/** Legacy hook — returns state unchanged. */
export function initializeMpHotseatIfNeeded(
  state: GameState,
  _visionCivIndex: number,
  _deps: Pick<TurnEndDeps, 'updateVision'>
): GameState {
  return state;
}

export function resolveTurnEndOrchestrated(
  state: GameState,
  opts: ProcessTurnOptions | undefined,
  deps: TurnEndDeps
): GameState {
  return deps.processTurn(state, opts);
}
