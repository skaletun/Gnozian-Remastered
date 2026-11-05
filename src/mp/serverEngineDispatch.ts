/**
 * Bundled Node entry for authoritative multiplayer simulation (same TS engine as the client).
 * Build: `npm run mp:build-engine` → outputs `gnozian-mp/engine/engine.cjs`
 */
import { readFileSync } from 'node:fs';
import { initGame } from '../game/engine';
import type { GameState, GameSettings, LeaderAttributeKey, ProductionItem, SpyMission, TradeLot } from '../game/types';
import { applyCommand, type GameCommand } from '../game/gameCommands';
import type { EngineBatchResult, EngineInvokeFn, EngineStep } from './mpEngineProtocol';
import {
  addToProductionQueue,
  declareWar,
  makePeace,
  signArmistice,
  proposeDiplomaticSettlement,
  acceptDiplomaticOffer,
  rejectDiplomaticOffer,
  counterDiplomaticOffer,
  formAlliance,
  leaveAlliance,
  addTradeRoute,
  signTradeAgreement,
  cancelTradeRoute,
  cancelTradeAgreement,
  purchasePatronageGreatPeopleBoost,
  allocateLeaderAttributePoint,
  upgradeTownToCity,
  buildSettlementDistrict,
  applyIndependentPowerAction,
  applyInfluenceDiplomacyAction,
  appointUnitCommander,
  assignUnitCommander,
  unassignUnitCommander,
  activateCommander,
  resolveCityGrowthEvent,
  setDistrictSpecialists,
  startCivicResearch,
  setCivilizationGovernment,
} from '../game/engine';
import { recruitSpy } from '../game/featureSystems';
import { GNOZIAN_GAME_VERSION } from '../game/gameVersion';
import { normalizeStateContract, validateStateContractShape } from '../game/kernel/stateContract';
import { computeStateHash } from '../game/kernel/stateHash';

export type { EngineInvokeFn, EngineStep } from './mpEngineProtocol';

const INVOKE: Record<
  EngineInvokeFn,
  (state: GameState, args: Record<string, unknown>) => GameState
> = {
  // Normalize lot arrays from wire payload.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addToProductionQueue: (state, a) => {
    const cityId = Number(a.cityId);
    const item = a.item as ProductionItem;
    const acting =
      a.actingCivIndex !== undefined && a.actingCivIndex !== null ? Number(a.actingCivIndex) : undefined;
    return addToProductionQueue(state, cityId, item, acting);
  },
  declareWar: (state, a) => declareWar(state, Number(a.civA), Number(a.civB)),
  makePeace: (state, a) =>
    makePeace(state, Number(a.civA), Number(a.civB), parseSettlementPayments(a.payments)),
  signArmistice: (state, a) =>
    signArmistice(state, Number(a.civA), Number(a.civB), {
      durationTurns: a.durationTurns == null ? undefined : Number(a.durationTurns),
      goldLoPaysHi: a.goldLoPaysHi == null ? undefined : Number(a.goldLoPaysHi),
      goldHiPaysLo: a.goldHiPaysLo == null ? undefined : Number(a.goldHiPaysLo),
    }),
  proposeDiplomaticSettlement: (state, a) =>
    proposeDiplomaticSettlement(state, Number(a.fromCiv), Number(a.toCiv), a.kind as 'peace' | 'armistice', parseSettlementTerms(a.terms)),
  acceptDiplomaticOffer: (state, a) =>
    acceptDiplomaticOffer(state, Number(a.offerId), Number(a.accepterCiv)),
  rejectDiplomaticOffer: (state, a) =>
    rejectDiplomaticOffer(state, Number(a.offerId), Number(a.rejecterCiv)),
  counterDiplomaticOffer: (state, a) =>
    counterDiplomaticOffer(state, Number(a.offerId), Number(a.counterFromCiv), parseSettlementTerms(a.terms)),
  formAlliance: (state, a) => formAlliance(state, Number(a.civA), Number(a.civB)),
  leaveAlliance: (state, a) => leaveAlliance(state, Number(a.civA), Number(a.civB)),
  addTradeRoute: (state, a) =>
    addTradeRoute(state, Number(a.civA), Number(a.civB), {
      goldPerTurn: a.goldPerTurn == null ? undefined : Number(a.goldPerTurn),
      risk: a.risk == null ? undefined : Number(a.risk),
      lotsAtoB: parseLots(a.lotsAtoB),
      lotsBtoA: parseLots(a.lotsBtoA),
      merchantUnitId: a.merchantUnitId == null ? undefined : Number(a.merchantUnitId),
    }),
  signTradeAgreement: (state, a) =>
    signTradeAgreement(state, Number(a.civA), Number(a.civB), {
      goldPerTurnAtoB: a.goldPerTurnAtoB == null ? undefined : Number(a.goldPerTurnAtoB),
      goldPerTurnBtoA: a.goldPerTurnBtoA == null ? undefined : Number(a.goldPerTurnBtoA),
      turnsLeft: a.turnsLeft == null ? undefined : Number(a.turnsLeft),
      transferAtoB:
        a.transferAtoB && typeof a.transferAtoB === 'object'
          ? {
              food: Number((a.transferAtoB as Record<string, unknown>).food ?? 0),
              science: Number((a.transferAtoB as Record<string, unknown>).science ?? 0),
              culture: Number((a.transferAtoB as Record<string, unknown>).culture ?? 0),
              faith: Number((a.transferAtoB as Record<string, unknown>).faith ?? 0),
              happiness: Number((a.transferAtoB as Record<string, unknown>).happiness ?? 0),
            }
          : undefined,
      transferBtoA:
        a.transferBtoA && typeof a.transferBtoA === 'object'
          ? {
              food: Number((a.transferBtoA as Record<string, unknown>).food ?? 0),
              science: Number((a.transferBtoA as Record<string, unknown>).science ?? 0),
              culture: Number((a.transferBtoA as Record<string, unknown>).culture ?? 0),
              faith: Number((a.transferBtoA as Record<string, unknown>).faith ?? 0),
              happiness: Number((a.transferBtoA as Record<string, unknown>).happiness ?? 0),
            }
          : undefined,
      lotsAtoB: parseLots(a.lotsAtoB),
      lotsBtoA: parseLots(a.lotsBtoA),
    }),
  cancelTradeRoute: (state, a) =>
    cancelTradeRoute(state, Number(a.routeId), a.requesterCiv == null ? undefined : Number(a.requesterCiv)),
  cancelTradeAgreement: (state, a) =>
    cancelTradeAgreement(
      state,
      Number(a.agreementId),
      a.requesterCiv == null ? undefined : Number(a.requesterCiv)
    ),
  purchasePatronageGreatPeopleBoost: (state, a) =>
    purchasePatronageGreatPeopleBoost(state, Number(a.civIndex)),
  allocateLeaderAttributePoint: (state, a) =>
    allocateLeaderAttributePoint(
      state,
      Number(a.civIndex),
      String(a.key) as LeaderAttributeKey
    ),
  upgradeTownToCity: (state, a) =>
    upgradeTownToCity(
      state,
      Number(a.cityId),
      a.actingCivIndex == null ? undefined : Number(a.actingCivIndex)
    ),
  buildSettlementDistrict: (state, a) =>
    buildSettlementDistrict(
      state,
      Number(a.cityId),
      String(a.districtType) as import('../game/types').DistrictType,
      Number(a.q),
      Number(a.r),
      a.actingCivIndex == null ? undefined : Number(a.actingCivIndex)
    ),
  setDistrictSpecialists: (state, a) =>
    setDistrictSpecialists(
      state,
      Number(a.cityId),
      String(a.districtId),
      Number(a.specialists),
      a.actingCivIndex == null ? undefined : Number(a.actingCivIndex)
    ),
  resolveCityGrowthEvent: (state, a) =>
    resolveCityGrowthEvent(
      state,
      Number(a.cityId),
      String(a.choice) as import('../game/types').GrowthEventOptionId,
      a.target && typeof a.target === 'object'
        ? {
            q: Number((a.target as Record<string, unknown>).q),
            r: Number((a.target as Record<string, unknown>).r),
            kind: (a.target as Record<string, unknown>).kind === 'urban' ? 'urban' : 'rural',
          }
        : undefined,
      a.actingCivIndex == null ? undefined : Number(a.actingCivIndex)
    ),
  applyInfluenceDiplomacyAction: (state, a) =>
    applyInfluenceDiplomacyAction(
      state,
      Number(a.fromCiv),
      Number(a.toCiv),
      String(a.action) as import('../game/types').InfluenceActionKind,
      {
        offerId: a.offerId == null ? undefined : Number(a.offerId),
        treatyKind:
          a.treatyKind === 'commerce' || a.treatyKind === 'culture' ? a.treatyKind : 'research',
        endeavorKind:
          a.endeavorKind === 'industry' || a.endeavorKind === 'culture' ? a.endeavorKind : 'science',
      }
    ),
  applyIndependentPowerAction: (state, a) =>
    applyIndependentPowerAction(
      state,
      Number(a.actorCiv),
      Number(a.powerId),
      (String(a.action) as 'incite_raid' | 'levy' | 'upgrade_city_state'),
      { targetCiv: a.targetCiv == null ? undefined : Number(a.targetCiv) }
    ),
  appointUnitCommander: (state, a) =>
    appointUnitCommander(state, Number(a.civIndex), Number(a.unitId)),
  assignUnitCommander: (state, a) =>
    assignUnitCommander(state, Number(a.civIndex), String(a.commanderId), Number(a.unitId)),
  unassignUnitCommander: (state, a) =>
    unassignUnitCommander(state, Number(a.civIndex), Number(a.unitId)),
  activateCommander: (state, a) =>
    activateCommander(state, Number(a.civIndex), String(a.commanderId)),
  startCivicResearch: (state, a) =>
    startCivicResearch(state, Number(a.civIndex), String(a.civicId)),
  setCivilizationGovernment: (state, a) =>
    setCivilizationGovernment(
      state,
      Number(a.civIndex),
      a.governmentId as GameState['civilizations'][number]['governmentId'],
      Array.isArray(a.slottedPolicyIds) ? (a.slottedPolicyIds as string[]) : [],
    ),
  recruitSpy: (state, a) =>
    recruitSpy(state, Number(a.ownerCiv), Number(a.targetCiv), a.mission as SpyMission),
};

function parseSettlementPayments(raw: unknown): import('../game/types').DiplomaticSettlementPayments | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return {
    goldLoPaysHi: Number(o.goldLoPaysHi ?? 0),
    goldHiPaysLo: Number(o.goldHiPaysLo ?? 0),
  };
}

function parseSettlementTerms(raw: unknown): import('../game/types').DiplomaticSettlementPayments & { armisticeTurns?: number } {
  const base = parseSettlementPayments(raw) ?? { goldLoPaysHi: 0, goldHiPaysLo: 0 };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const at = o.armisticeTurns;
  return at != null ? { ...base, armisticeTurns: Number(at) } : base;
}

function parseLots(raw: unknown): TradeLot[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((x): TradeLot | null => {
      if (!x || typeof x !== 'object') return null;
      const o = x as Record<string, unknown>;
      return {
        resource: String(o.resource ?? 'food') as TradeLot['resource'],
        amount: Number(o.amount ?? 0),
        unitPrice: Number(o.unitPrice ?? 0),
        priceMode: o.priceMode === 'per_unit' ? 'per_unit' : 'one_time',
      };
    })
    .filter((x): x is TradeLot => x != null);
}

export function assertGameVersion(v: unknown): void {
  if (v !== GNOZIAN_GAME_VERSION) {
    throw new Error(`game_version_mismatch: need ${GNOZIAN_GAME_VERSION}, got ${String(v)}`);
  }
}

export function engineInit(settings: GameSettings): GameState {
  return normalizeStateContract(initGame(settings));
}

function withStateHash(state: GameState): EngineBatchResult {
  return { state, stateHash: computeStateHash(state) };
}

export function engineApplyBatch(state: GameState, steps: EngineStep[]): GameState {
  let s = normalizeStateContract(state);
  for (const step of steps) {
    if (step.t === 'cmd') {
      s = applyCommand(s, step.cmd as GameCommand);
    } else if (step.t === 'invoke') {
      const fn = INVOKE[step.fn];
      if (!fn) {
        throw new Error(`unknown_invoke:${step.fn}`);
      }
      s = fn(s, step.args);
    } else {
      throw new Error('bad_step');
    }
  }
  return normalizeStateContract(s);
}

function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

export function dispatchRequest(raw: string): Record<string, unknown> {
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'invalid_json', code: 'bad_json' };
  }
  try {
    assertGameVersion(input.gameVersion);
    const op = String(input.op ?? '');
    if (op === 'init') {
      const settings = input.settings as GameSettings;
      if (!settings || typeof settings !== 'object') {
        return { ok: false, error: 'settings required', code: 'bad_body' };
      }
      const state = engineInit(settings);
      return { ok: true, ...withStateHash(state) };
    }
    if (op === 'applyBatch') {
      const state = input.state as GameState;
      const steps = input.steps as EngineStep[];
      if (!validateStateContractShape(state)) {
        return { ok: false, error: 'state required', code: 'bad_body' };
      }
      if (!Array.isArray(steps)) {
        return { ok: false, error: 'steps array required', code: 'bad_body' };
      }
      if (steps.length > 800) {
        return { ok: false, error: 'too many steps', code: 'too_many_steps' };
      }
      const next = engineApplyBatch(state, steps);
      return { ok: true, ...withStateHash(next) };
    }
    return { ok: false, error: 'unknown op', code: 'bad_op' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, code: 'engine_error' };
  }
}

function main(): void {
  const out = dispatchRequest(readStdin());
  process.stdout.write(JSON.stringify(out));
}

// Only read stdin when executed as the Node entrypoint (not when imported for tests).
const rq = typeof require !== 'undefined' ? require : undefined;
if (rq && rq.main === module) {
  main();
}
