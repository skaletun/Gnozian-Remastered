import {
  DEFAULT_WORLD,
  addMessage,
  applyIndependentPowerAction,
  applyInfluenceDiplomacyAction,
  appointUnitCommander,
  assignUnitCommander,
  unassignUnitCommander,
  activateCommander,
  chooseLegacyPathOption,
  setCrisisPolicy,
  buildSettlementDistrict,
  initGame,
  initGameFromCustomMap,
  migrateLoadedTradeRoutes,
  recomputeTileTerritory,
  resolveCityGrowthEvent,
  resolveTurnEnd,
  setDistrictSpecialists,
  upgradeTownToCity,
} from '../engine';
import { applyCommand, type GameCommand } from '../gameCommands';
import type { GameSettings, GameState, TerrainType } from '../types';

export {
  DEFAULT_WORLD,
  addMessage,
  applyIndependentPowerAction,
  applyInfluenceDiplomacyAction,
  appointUnitCommander,
  assignUnitCommander,
  unassignUnitCommander,
  activateCommander,
  chooseLegacyPathOption,
  setCrisisPolicy,
  buildSettlementDistrict,
  migrateLoadedTradeRoutes,
  recomputeTileTerritory,
  resolveCityGrowthEvent,
  setDistrictSpecialists,
  upgradeTownToCity,
};

export function createGame(settings: GameSettings, customTerrain?: TerrainType[][] | null): GameState {
  if (customTerrain?.length && (customTerrain[0]?.length ?? 0) > 0) {
    return initGameFromCustomMap(settings, customTerrain);
  }
  return initGame(settings);
}

export function issueCommand(state: GameState, command: GameCommand): GameState {
  return applyCommand(state, command);
}

export function issueCommands(state: GameState, commands: GameCommand[]): GameState {
  let next = state;
  for (const cmd of commands) next = applyCommand(next, cmd);
  return next;
}

export function advanceTurn(state: GameState, opts?: Parameters<typeof resolveTurnEnd>[1]): GameState {
  return resolveTurnEnd(state, opts);
}

