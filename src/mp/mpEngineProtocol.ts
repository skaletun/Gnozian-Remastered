import type { GameState } from '../game/types';

/**
 * Shared types for multiplayer engine steps (client → PHP → Node engine bundle).
 * Uses `unknown` for commands so this module does not import the game engine graph.
 */
export type EngineInvokeFn =
  | 'addToProductionQueue'
  | 'declareWar'
  | 'makePeace'
  | 'signArmistice'
  | 'proposeDiplomaticSettlement'
  | 'acceptDiplomaticOffer'
  | 'rejectDiplomaticOffer'
  | 'counterDiplomaticOffer'
  | 'formAlliance'
  | 'leaveAlliance'
  | 'addTradeRoute'
  | 'signTradeAgreement'
  | 'cancelTradeRoute'
  | 'cancelTradeAgreement'
  | 'purchasePatronageGreatPeopleBoost'
  | 'allocateLeaderAttributePoint'
  | 'upgradeTownToCity'
  | 'buildSettlementDistrict'
  | 'setDistrictSpecialists'
  | 'resolveCityGrowthEvent'
  | 'applyInfluenceDiplomacyAction'
  | 'applyIndependentPowerAction'
  | 'appointUnitCommander'
  | 'assignUnitCommander'
  | 'unassignUnitCommander'
  | 'activateCommander'
  | 'startCivicResearch'
  | 'setCivilizationGovernment'
  | 'recruitSpy';

export type EngineStep =
  | { t: 'cmd'; cmd: unknown }
  | { t: 'invoke'; fn: EngineInvokeFn; args: Record<string, unknown> };

export interface EngineBatchResult {
  state: GameState;
  stateHash: string;
}
