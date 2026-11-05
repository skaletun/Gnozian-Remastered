import {
  allocateLeaderAttributePoint,
  activateGreatPerson,
  addMessage,
  attackCity,
  buildSettlementDistrict,
  buildImprovement,
  combatUnit,
  foundCity,
  moveUnit,
  moveUnitGroup,
  moveUnitAlongPath,
  applyIndependentPowerAction,
  applyInfluenceDiplomacyAction,
  appointUnitCommander,
  assignUnitCommander,
  activateCommander,
  chooseLegacyPathOption,
  deferCrisisPolicyPrompt,
  deferLegacyPrompt,
  resolveCityGrowthEvent,
  resolveTurnEnd,
  setDistrictSpecialists,
  startResearch,
  upgradeTownToCity,
  unassignUnitCommander,
  setCrisisPolicy,
  setScoutAutoExplore,
} from './engine';
import { markCivFirstContactSeen } from './systems/firstContactCore';
import type {
  DistrictType,
  GameState,
  GrowthEventOptionId,
  InfluenceActionKind,
  LegacyPathType,
  CrisisPolicyType,
  TechId,
  ImprovementType,
  LeaderAttributeKey,
} from './types';

export type GameCommand =
  | { kind: 'unit.move'; unitId: number; toQ: number; toR: number }
  | { kind: 'unit.moveTo'; unitId: number; toQ: number; toR: number }
  | { kind: 'unit.moveGroup'; unitIds: number[]; toQ: number; toR: number }
  | { kind: 'unit.attackUnit'; attackerId: number; defenderId: number }
  | { kind: 'unit.attackCity'; attackerId: number; cityId: number }
  | { kind: 'city.found'; civIndex: number; q: number; r: number; settlerUnitId: number }
  | { kind: 'greatPerson.activate'; unitId: number; cityId: number }
  | { kind: 'research.start'; civIndex: number; techId: TechId }
  | { kind: 'leader.allocateAttribute'; civIndex: number; key: LeaderAttributeKey }
  | { kind: 'settlement.upgradeTownToCity'; cityId: number; actingCivIndex?: number }
  | {
      kind: 'settlement.buildDistrict';
      cityId: number;
      districtType: DistrictType;
      q: number;
      r: number;
      actingCivIndex?: number;
    }
  | {
      kind: 'settlement.setDistrictSpecialists';
      cityId: number;
      districtId: string;
      specialists: number;
      actingCivIndex?: number;
    }
  | {
      kind: 'city.resolveGrowthEvent';
      cityId: number;
      choice: GrowthEventOptionId;
      target?: { q: number; r: number; kind?: 'urban' | 'rural' };
      actingCivIndex?: number;
    }
  | {
      kind: 'diplomacy.influenceAction';
      fromCiv: number;
      toCiv: number;
      action: InfluenceActionKind;
      offerId?: number;
      treatyKind?: 'research' | 'commerce' | 'culture';
      endeavorKind?: 'science' | 'industry' | 'culture';
    }
  | {
      kind: 'independentPower.action';
      actorCiv: number;
      powerId: number;
      action: 'incite_raid' | 'levy' | 'upgrade_city_state';
      targetCiv?: number;
    }
  | { kind: 'commander.appoint'; civIndex: number; unitId: number }
  | { kind: 'commander.assignUnit'; civIndex: number; commanderId: string; unitId: number }
  | { kind: 'commander.unassignUnit'; civIndex: number; unitId: number }
  | { kind: 'commander.activate'; civIndex: number; commanderId: string }
  | {
      kind: 'legacy.chooseOption';
      civIndex: number;
      path: LegacyPathType;
      choice: 'golden_age' | 'dark_age';
    }
  | {
      kind: 'crisis.setPolicy';
      civIndex: number;
      policy: CrisisPolicyType;
    }
  | { kind: 'legacy.snoozePrompt'; civIndex: number }
  | { kind: 'crisis.snoozePolicyPrompt'; civIndex: number }
  | { kind: 'unit.buildImprovement'; unitId: number; improvement: ImprovementType }
  | { kind: 'unit.scout.setAutoExplore'; civIndex: number; unitId: number; enabled: boolean }
  | { kind: 'firstContact.markSeen'; viewerCivIndex: number; otherCivIndex: number }
  | { kind: 'turn.end'; visionCivIndex?: number };

export function applyCommand(state: GameState, command: GameCommand): GameState {
  switch (command.kind) {
    case 'unit.move':
      return moveUnit(state, command.unitId, command.toQ, command.toR);
    case 'unit.moveTo':
      return moveUnitAlongPath(state, command.unitId, command.toQ, command.toR);
    case 'unit.moveGroup':
      return moveUnitGroup(state, command.unitIds, command.toQ, command.toR);
    case 'unit.attackUnit':
      return combatUnit(state, command.attackerId, command.defenderId);
    case 'unit.attackCity':
      return attackCity(state, command.attackerId, command.cityId);
    case 'city.found':
      return foundCity(state, command.civIndex, command.q, command.r, command.settlerUnitId);
    case 'greatPerson.activate':
      return activateGreatPerson(state, command.unitId, command.cityId);
    case 'research.start': {
      const next = startResearch(state, command.civIndex, command.techId);
      return addMessage(next, `Started researching ${command.techId}!`, 'tech', [command.civIndex]);
    }
    case 'leader.allocateAttribute':
      return allocateLeaderAttributePoint(state, command.civIndex, command.key);
    case 'settlement.upgradeTownToCity':
      return upgradeTownToCity(state, command.cityId, command.actingCivIndex);
    case 'settlement.buildDistrict':
      return buildSettlementDistrict(
        state,
        command.cityId,
        command.districtType,
        command.q,
        command.r,
        command.actingCivIndex
      );
    case 'settlement.setDistrictSpecialists':
      return setDistrictSpecialists(
        state,
        command.cityId,
        command.districtId,
        command.specialists,
        command.actingCivIndex
      );
    case 'city.resolveGrowthEvent':
      return resolveCityGrowthEvent(
        state,
        command.cityId,
        command.choice,
        command.target,
        command.actingCivIndex
      );
    case 'diplomacy.influenceAction':
      return applyInfluenceDiplomacyAction(state, command.fromCiv, command.toCiv, command.action, {
        offerId: command.offerId,
        treatyKind: command.treatyKind,
        endeavorKind: command.endeavorKind,
      });
    case 'independentPower.action':
      return applyIndependentPowerAction(state, command.actorCiv, command.powerId, command.action, {
        targetCiv: command.targetCiv,
      });
    case 'commander.appoint':
      return appointUnitCommander(state, command.civIndex, command.unitId);
    case 'commander.assignUnit':
      return assignUnitCommander(state, command.civIndex, command.commanderId, command.unitId);
    case 'commander.unassignUnit':
      return unassignUnitCommander(state, command.civIndex, command.unitId);
    case 'commander.activate':
      return activateCommander(state, command.civIndex, command.commanderId);
    case 'legacy.chooseOption':
      return chooseLegacyPathOption(state, command.civIndex, command.path, command.choice);
    case 'crisis.setPolicy':
      return setCrisisPolicy(state, command.civIndex, command.policy);
    case 'legacy.snoozePrompt':
      return deferLegacyPrompt(state, command.civIndex);
    case 'crisis.snoozePolicyPrompt':
      return deferCrisisPolicyPrompt(state, command.civIndex);
    case 'unit.buildImprovement':
      return buildImprovement(state, command.unitId, command.improvement);
    case 'unit.scout.setAutoExplore':
      return setScoutAutoExplore(state, command.civIndex, command.unitId, command.enabled);
    case 'firstContact.markSeen':
      return markCivFirstContactSeen(state, command.viewerCivIndex, command.otherCivIndex);
    case 'turn.end':
      return resolveTurnEnd(state, { visionCivIndex: command.visionCivIndex ?? 0 });
    default:
      return state;
  }
}
