/**
 * AI turn logic (injected engine actions avoid circular imports with engine.ts).
 * Tuned for interesting play across difficulties: production, research, diplomacy,
 * multi-step combat movement, city sieges, expansion, and great-person handling.
 */
import type {
  GameState,
  UnitType,
  TechId,
  BuildingType,
  ProductionItem,
  ImprovementType,
  TradeLot,
  DiplomaticSettlementPayments,
  DiplomaticOfferKind,
} from './types';
import {
  TECHNOLOGIES,
  CIVICS,
  UNITS,
  BUILDINGS,
  ALLIANCE_MIN_DIPLOMATIC_FAVOR,
  ARMISTICE_DURATION_TURNS,
  ARMISTICE_DURATION_MIN_TURNS,
  ARMISTICE_DURATION_MAX_TURNS,
  MAX_SETTLEMENT_GOLD_PER_DIRECTION,
} from './constants';
import { createRng, getNeighbors, hexDistance } from './mapgen';
import { createFogLimitedAIAPI, createAiPerceptionState } from './aiPerception';
import {
  aiSkillFromDifficulty,
  buildAIStrategicPosture,
  personalityFor,
  researchNoiseMax,
  scoreCivicForAI,
  type AIPersonality,
  type AIStrategicPosture,
} from './aiStrategy';
import {
  atWarWithAnyone,
  computeMilitaryPower,
} from './aiMetrics';
import { canAddMoreTradeRoutes, buildTradePlan, shouldDeclareWar } from './aiDiplomacyPlanner';
import { chooseProductionItem } from './aiEconomyPlanner';
import { chooseCombatObjective } from './aiMilitaryPlanner';
import { chooseSettlerObjective } from './aiExpansionPlanner';
import { chooseWorkerObjective } from './aiWorkerPlanner';
import { chooseGreatPersonObjective } from './aiGreatPersonPlanner';

export type AIEngineAPI = {
  startResearch: (s: GameState, civ: number, tech: TechId) => GameState;
  startCivicResearch: (s: GameState, civ: number, civicId: string) => GameState;
  addToProductionQueue: (
    s: GameState,
    cityId: number,
    item: ProductionItem,
    actingCivIndex?: number
  ) => GameState;
  moveUnit: (s: GameState, unitId: number, toQ: number, toR: number) => GameState;
  foundCity: (s: GameState, civIndex: number, q: number, r: number, settlerId: number) => GameState;
  combatUnit: (s: GameState, attackerId: number, defenderId: number) => GameState;
  attackCity: (s: GameState, attackerId: number, cityId: number) => GameState;
  declareWar: (s: GameState, civA: number, civB: number) => GameState;
  makePeace: (s: GameState, civA: number, civB: number, payments?: DiplomaticSettlementPayments) => GameState;
  signArmistice: (
    s: GameState,
    civA: number,
    civB: number,
    opts?: { durationTurns?: number } & Partial<DiplomaticSettlementPayments>
  ) => GameState;
  proposeDiplomaticSettlement: (
    s: GameState,
    fromCiv: number,
    toCiv: number,
    kind: DiplomaticOfferKind,
    terms: DiplomaticSettlementPayments & { armisticeTurns?: number }
  ) => GameState;
  formAlliance: (s: GameState, civA: number, civB: number) => GameState;
  leaveAlliance: (s: GameState, civA: number, civB: number) => GameState;
  addTradeRoute: (
    s: GameState,
    civA: number,
    civB: number,
    options?: { goldPerTurn?: number; risk?: number; lotsAtoB?: TradeLot[]; lotsBtoA?: TradeLot[] }
  ) => GameState;
  signTradeAgreement: (
    s: GameState,
    civA: number,
    civB: number,
    options?: {
      goldPerTurnAtoB?: number;
      goldPerTurnBtoA?: number;
      turnsLeft?: number;
      transferAtoB?: Partial<Record<'food' | 'science' | 'culture' | 'faith' | 'happiness', number>>;
      transferBtoA?: Partial<Record<'food' | 'science' | 'culture' | 'faith' | 'happiness', number>>;
      lotsAtoB?: TradeLot[];
      lotsBtoA?: TradeLot[];
    }
  ) => GameState;
  canDeclareWar: (s: GameState, civA: number, civB: number) => boolean;
  areAtWar: (s: GameState, civA: number, civB: number) => boolean;
  isMilitarilyEngaged: (s: GameState, civA: number, civB: number) => boolean;
  bestNeighborToward: (
    s: GameState,
    unit: import('./types').Unit,
    targetQ: number,
    targetR: number
  ) => { q: number; r: number } | null;
  calcTileYield: (tile: import('./types').Tile) => Partial<import('./types').YieldMap>;
  canFriendlyStackOnTile: (
    s: GameState,
    owner: number,
    unitType: UnitType,
    q: number,
    r: number,
    excludeUnitId?: number
  ) => boolean;
  activateGreatPerson: (s: GameState, unitId: number, cityId: number) => GameState;
  listValidWorkerImprovements: (s: GameState, unitId: number) => ImprovementType[];
  buildImprovement: (s: GameState, unitId: number, imp: ImprovementType) => GameState;
};

const SCIENCE_PUSH_TECHS = new Set<TechId>([
  'scientific_theory',
  'electricity',
  'radio',
  'computers',
  'rocketry',
  'satellites',
  'nanotechnology',
  'lasers',
  'plastics',
  'advanced_flight',
]);

const MILITARY_TECH_IDS = new Set<TechId>([
  'archery',
  'bronze_working',
  'iron_working',
  'mathematics',
  'horseback_riding',
  'chivalry',
  'chemistry',
  'gunpowder',
  'rifling',
  'military_science',
  'ballistics',
  'replaceable_parts',
  'combustion',
  'flight',
  'advanced_flight',
  'nuclear_fission',
]);

/** Terms AI proposes when seeking armistice or peace (self-serving tribute/duration). */
function aiBuildSettlementTerms(
  state: GameState,
  proposer: number,
  target: number,
  kind: DiplomaticOfferKind,
  rng: () => number
): DiplomaticSettlementPayments & { armisticeTurns?: number } {
  const lo = Math.min(proposer, target);
  const us = computeMilitaryPower(state, proposer);
  const them = computeMilitaryPower(state, target);
  const losing = us < them * 0.88;
  const pGold = Math.max(0, state.civilizations[proposer]?.resources.gold ?? 0);
  const payAmt = Math.min(
    MAX_SETTLEMENT_GOLD_PER_DIRECTION,
    Math.floor(pGold * (losing ? 0.11 : 0.055) + rng() * 28 + (losing ? 18 : 8))
  );
  const demandAmt = Math.min(
    MAX_SETTLEMENT_GOLD_PER_DIRECTION,
    Math.floor(22 + rng() * 36 + (!losing ? (us / Math.max(1, them)) * 10 : 0))
  );
  let goldLoPaysHi = 0;
  let goldHiPaysLo = 0;
  if (losing) {
    if (proposer === lo) goldLoPaysHi = payAmt;
    else goldHiPaysLo = payAmt;
  } else {
    if (proposer === lo) goldHiPaysLo = demandAmt;
    else goldLoPaysHi = demandAmt;
  }
  if (kind !== 'armistice') {
    return { goldLoPaysHi, goldHiPaysLo };
  }
  const rawDur = ARMISTICE_DURATION_TURNS + (losing ? 3 : -1) + Math.round((rng() - 0.5) * 6);
  const armisticeTurns = Math.max(
    ARMISTICE_DURATION_MIN_TURNS,
    Math.min(ARMISTICE_DURATION_MAX_TURNS, rawDur)
  );
  return { goldLoPaysHi, goldHiPaysLo, armisticeTurns };
}

function scoreTechForAI(
  t: (typeof TECHNOLOGIES)[string],
  civ: GameState['civilizations'][0],
  s: GameState,
  civIndex: number,
  p: ReturnType<typeof personalityFor>,
  skill: number,
  rng: () => number
): number {
  let sc = 0;
  const atWar = atWarWithAnyone(s, civIndex);
  const techs = civ.researchedTechs;

  sc += Math.max(0, 22 - t.cost / 55) * (0.55 + (1 - skill) * 0.45);

  for (const u of t.unlocks) {
    if (UNITS[u]) {
      const def = UNITS[u];
      const pow = (def.strength ?? 0) + (def.rangedStrength ?? 0);
      sc += pow * (0.04 + p.aggressiveness / 800);
      if (atWar) sc += pow * 0.06;
    }
    if (BUILDINGS[u as BuildingType]) {
      const b = BUILDINGS[u as BuildingType];
      sc += (b.yields.science ?? 0) * (p.scientificFocus / 25);
      sc += (b.yields.culture ?? 0) * (p.culturalFocus / 25);
      sc += (b.yields.gold ?? 0) * (p.economyFocus / 35);
      sc += (b.yields.faith ?? 0) * (p.religiousFocus / 30);
      sc += (b.yields.production ?? 0) * 0.35;
    }
  }

  if (SCIENCE_PUSH_TECHS.has(t.id)) sc += 8 + p.scientificFocus / 12 + civ.scienceVictoryProgress / 8;
  if (MILITARY_TECH_IDS.has(t.id)) sc += (atWar ? 14 : 4) + p.aggressiveness / 15;

  if (p.culturalFocus > 55 && (t.id.includes('drama') || t.id === 'printing_press')) sc += 18;
  if (p.religiousFocus > 55 && (t.id === 'theology' || t.id === 'philosophy')) sc += 16;
  if (p.economyFocus > 65 && (t.id === 'currency' || t.id === 'banking' || t.id === 'capitalism')) sc += 14;

  if (t.id === 'pottery' && techs.length < 6) sc += 10;
  if (t.id === 'mining' && techs.length < 7) sc += 9;
  if (t.id === 'writing' && p.scientificFocus > 40) sc += 8;

  sc += rng() * researchNoiseMax(skill);
  return sc;
}

function pushProduction(
  s: GameState,
  api: AIEngineAPI,
  cityId: number,
  item: ProductionItem
): GameState {
  const city = s.cities.find(c => c.id === cityId);
  if (!city) return s;
  return api.addToProductionQueue(s, cityId, item, city.owner);
}

function aiFillProduction(
  s: GameState,
  civIndex: number,
  api: AIEngineAPI,
  rng: () => number,
  p: AIPersonality,
  posture: AIStrategicPosture
): GameState {
  let state = s;
  const civ = state.civilizations[civIndex];
  for (const cityId of civ.cities) {
    const city = state.cities.find(c => c.id === cityId);
    if (!city || city.productionQueue.length > 0) continue;
    const item = chooseProductionItem(state, city, civIndex, p, posture, rng);
    state = pushProduction(state, api, cityId, item);
  }
  return state;
}

function aiDiplomacy(
  s: GameState,
  civIndex: number,
  api: AIEngineAPI,
  rng: () => number,
  p: AIPersonality,
  posture: AIStrategicPosture
): GameState {
  let state = s;
  const us = computeMilitaryPower(state, civIndex);

  for (let j = 0; j < state.civilizations.length; j++) {
    if (j === civIndex || !state.civilizations[j]!.isAlive) continue;

    if (api.areAtWar(state, civIndex, j)) {
      const them = computeMilitaryPower(state, j);
      const losing = us < them * (0.72 + posture.skill * 0.12);
      let local = state;
      const armChance =
        (p.diplomaticFocus / 400) * (losing ? 2.4 : 0.35) + (losing ? 0.08 : 0.01) + posture.skill * 0.06;
      if (rng() < armChance * (0.8 + posture.skill * 0.45)) {
        const terms = aiBuildSettlementTerms(state, civIndex, j, 'armistice', rng);
        local = api.proposeDiplomaticSettlement(local, civIndex, j, 'armistice', terms);
      }
      const peaceChance = (p.diplomaticFocus / 550) * (losing ? 2.2 : 0.45) + (losing ? 0.05 : 0.008);
      if (api.areAtWar(local, civIndex, j) && rng() < peaceChance * (0.75 + posture.skill * 0.5)) {
        const terms = aiBuildSettlementTerms(local, civIndex, j, 'peace', rng);
        local = api.proposeDiplomaticSettlement(local, civIndex, j, 'peace', terms);
      }
      state = local;
      continue;
    }

    const rel = state.relations.find(
      r => (r.civA === civIndex && r.civB === j) || (r.civA === j && r.civB === civIndex)
    );
    if (
      rel?.status === 'alliance' &&
      rng() < 0.012 + (1 - posture.skill) * 0.04 &&
      p.aggressiveness > 55
    ) {
      state = api.leaveAlliance(state, civIndex, j);
      continue;
    }
    if (
      rel &&
      (rel.status === 'peace' || rel.status === 'neutral') &&
      !api.isMilitarilyEngaged(state, civIndex, j) &&
      state.civilizations[civIndex]!.diplomaticFavor >= ALLIANCE_MIN_DIPLOMATIC_FAVOR &&
      state.civilizations[j]!.diplomaticFavor >= ALLIANCE_MIN_DIPLOMATIC_FAVOR &&
      rng() < 0.02 + p.diplomaticFocus / 1200 + posture.skill * 0.03
    ) {
      state = api.formAlliance(state, civIndex, j);
    }
    const gold = state.civilizations[civIndex].resources.gold;
    if (
      rel &&
      rel.status !== 'war' &&
      gold > 40 + posture.skill * 90 &&
      rng() < 0.04 + p.diplomaticFocus / 900 + posture.skill * 0.05
    ) {
      const tradePlan = buildTradePlan(state, civIndex, j, p, posture, rng);
      if (canAddMoreTradeRoutes(state, civIndex, j) && tradePlan.routeScore > 0) {
        state = api.addTradeRoute(state, civIndex, j, tradePlan.routeOptions);
      }
      if (tradePlan.dealScore > 0 && rng() < 0.58) {
        state = api.signTradeAgreement(state, civIndex, j, tradePlan.dealOptions);
      }
    }

    if (!api.canDeclareWar(state, civIndex, j)) continue;
    if (shouldDeclareWar(state, civIndex, j, p, posture, rng)) {
      state = api.declareWar(state, civIndex, j);
    }
  }

  return state;
}

const GP_TYPES: UnitType[] = [
  'great_general',
  'great_scientist',
  'great_artist',
  'great_engineer',
  'great_merchant',
  'great_writer',
  'great_musician',
  'great_prophet',
];

function isGreatPersonUnit(t: UnitType): boolean {
  return GP_TYPES.includes(t);
}

/** Lower runs first so expansion and economy units act before combat stacks burn movement. */
function aiUnitProcessingOrderRank(t: UnitType): number {
  if (t === 'settler') return 0;
  if (t === 'worker') return 1;
  if (t === 'scout') return 2;
  if (t === 'missionary') return 3;
  if (isGreatPersonUnit(t)) return 4;
  return 10;
}

function runCombatMovesUntilIdle(
  s: GameState,
  civIndex: number,
  unitId: number,
  api: AIEngineAPI,
  p: AIPersonality,
  posture: AIStrategicPosture,
  rng: () => number
): GameState {
  let state = s;
  let guard = 0;
  while (guard++ < 56) {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.owner !== civIndex || unit.movement <= 0 || unit.hasAttacked) break;

    const objective = chooseCombatObjective(state, civIndex, unit, p, posture, rng);
    if (objective?.kind === 'attack-city') {
      state = api.attackCity(state, unitId, objective.cityId);
      break;
    }
    if (objective?.kind === 'attack-unit') {
      state = api.combatUnit(state, unitId, objective.unitId);
      break;
    }
    if (objective?.kind === 'move') {
      const step = api.bestNeighborToward(state, unit, objective.targetQ, objective.targetR);
      if (step) {
        state = api.moveUnit(state, unitId, step.q, step.r);
        continue;
      }
    }

    if (rng() < 0.25 + posture.skill * 0.15) {
      const dirs = getNeighbors(unit.q, unit.r, state.tiles[0].length, state.tiles.length);
      if (dirs.length > 0) {
        const d = dirs[Math.floor(rng() * dirs.length)]!;
        if (api.canFriendlyStackOnTile(state, civIndex, unit.type, d.q, d.r, unitId)) {
          state = api.moveUnit(state, unitId, d.q, d.r);
          continue;
        }
      }
    }
    break;
  }
  return state;
}

function runSettler(
  state: GameState,
  civIndex: number,
  unit: import('./types').Unit,
  api: AIEngineAPI,
  p: AIPersonality,
  posture: AIStrategicPosture,
  rng: () => number
): GameState {
  let s = state;
  const objective = chooseSettlerObjective(s, civIndex, unit, api, p, posture, rng);
  if (objective.action === 'settle') {
    s = api.foundCity(s, civIndex, unit.q, unit.r, unit.id);
  } else if (objective.action === 'move') {
    const step = api.bestNeighborToward(s, unit, objective.q, objective.r);
    if (step && api.canFriendlyStackOnTile(s, civIndex, unit.type, step.q, step.r, unit.id)) {
      s = api.moveUnit(s, unit.id, step.q, step.r);
    }
  }
  return s;
}

function runMissionary(state: GameState, civIndex: number, unit: import('./types').Unit, api: AIEngineAPI, rng: () => number): GameState {
  const foreign = state.cities.filter(c => c.owner !== civIndex);
  if (foreign.length === 0) return state;
  const target = foreign.reduce((a, b) =>
    hexDistance(unit.q, unit.r, a.q, a.r) <= hexDistance(unit.q, unit.r, b.q, b.r) ? a : b
  );
  const step = api.bestNeighborToward(state, unit, target.q, target.r);
  if (step) return api.moveUnit(state, unit.id, step.q, step.r);
  if (rng() < 0.4) {
    const dirs = getNeighbors(unit.q, unit.r, state.tiles[0].length, state.tiles.length);
    const d = dirs[Math.floor(rng() * dirs.length)];
    if (d && api.canFriendlyStackOnTile(state, civIndex, unit.type, d.q, d.r, unit.id)) {
      return api.moveUnit(state, unit.id, d.q, d.r);
    }
  }
  return state;
}

function runGreatPerson(
  state: GameState,
  civIndex: number,
  unit: import('./types').Unit,
  api: AIEngineAPI,
  posture: AIStrategicPosture
): GameState {
  const objective = chooseGreatPersonObjective(state, civIndex, unit, posture);
  if (objective.action === 'activate') {
    return api.activateGreatPerson(state, unit.id, objective.cityId);
  }
  if (objective.action !== 'move') return state;
  const step = api.bestNeighborToward(state, unit, objective.q, objective.r);
  if (step) return api.moveUnit(state, unit.id, step.q, step.r);
  return state;
}

export type RunAITurnOptions = {
  /** Default true: rival decisions are made from that civ's revealed/visible worldview. */
  useFogOfWar?: boolean;
};

export function runAITurn(state: GameState, civIndex: number, api: AIEngineAPI, opts: RunAITurnOptions = {}): GameState {
  const useFogOfWar = opts.useFogOfWar ?? true;
  let actualState = state;
  const perceive = () => (useFogOfWar ? createAiPerceptionState(actualState, civIndex) : actualState);
  const aiApi = useFogOfWar
    ? createFogLimitedAIAPI(api, {
        getActual: () => actualState,
        setActual: next => {
          actualState = next;
        },
        perceive,
      })
    : api;
  let s = perceive();
  const civ = s.civilizations[civIndex];
  if (!civ.isAlive) return state;

  const rng = createRng(state.turn * 7919 + civIndex * 104729);
  const p = personalityFor(civ);
  const skill = aiSkillFromDifficulty(s.settings.difficulty);
  const posture = buildAIStrategicPosture(s, civIndex, p, skill);
  const turnPhase = state.turn / Math.max(1, state.settings.maxTurns);

  if (!civ.currentResearch) {
    const available = Object.values(TECHNOLOGIES).filter(t => {
      if (civ.researchedTechs.includes(t.id)) return false;
      return t.prerequisites.every(pr => civ.researchedTechs.includes(pr));
    });
    if (available.length > 0) {
      const scored = available.map(t => ({
        t,
        sc:
          scoreTechForAI(t, civ, s, civIndex, p, skill, rng) +
          (turnPhase > 0.7 && SCIENCE_PUSH_TECHS.has(t.id) ? 12 : 0) +
          (turnPhase < 0.3 && (t.id === 'pottery' || t.id === 'mining') ? 6 : 0) +
          (posture.victoryFocus === 'science' && SCIENCE_PUSH_TECHS.has(t.id) ? 10 : 0) +
          (posture.threatLevel > 0.45 && MILITARY_TECH_IDS.has(t.id) ? 10 + posture.threatLevel * 8 : 0),
      }));
      scored.sort((a, b) => b.sc - a.sc);
      const topN = Math.max(1, Math.floor(1 + (1 - skill) * 4));
      const pool = scored.slice(0, Math.min(topN, scored.length));
      const pick = pool[Math.floor(rng() * pool.length)]!.t;
      s = aiApi.startResearch(s, civIndex, pick.id);
    }
  }
  if (!civ.currentCivic) {
    const availableCivics = Object.values(CIVICS).filter(c => {
      if ((civ.researchedCivics ?? []).includes(c.id)) return false;
      return c.prerequisites.every(pr => (civ.researchedCivics ?? []).includes(pr));
    });
    if (availableCivics.length > 0) {
      const scored = availableCivics
        .map(civic => ({ civic, score: scoreCivicForAI(civic, civ, posture, p, rng) }))
        .sort((a, b) => b.score - a.score);
      const topN = Math.max(1, Math.floor(1 + (1 - skill) * 3));
      const pool = scored.slice(0, Math.min(topN, scored.length));
      const pick = pool[Math.floor(rng() * pool.length)]!.civic;
      s = aiApi.startCivicResearch(s, civIndex, pick.id);
    }
  }

  s = aiFillProduction(s, civIndex, aiApi, rng, p, posture);
  s = aiDiplomacy(s, civIndex, aiApi, rng, p, posture);

  const civUnits = s.units.filter(u => u.owner === civIndex);
  const ordered = [...civUnits].sort((a, b) => {
    const ra = aiUnitProcessingOrderRank(a.type);
    const rb = aiUnitProcessingOrderRank(b.type);
    if (ra !== rb) return ra - rb;
    return a.id - b.id;
  });

  for (const unit of ordered) {
    const u = s.units.find(x => x.id === unit.id);
    if (!u || u.movement <= 0) continue;

    if (u.type === 'settler') {
      s = runSettler(s, civIndex, u, aiApi, p, posture, rng);
      continue;
    }

    if (u.type === 'missionary') {
      s = runMissionary(s, civIndex, u, aiApi, rng);
      continue;
    }

    if (isGreatPersonUnit(u.type)) {
      s = runGreatPerson(s, civIndex, u, aiApi, posture);
      continue;
    }

    if (u.type === 'worker') {
      if (u.movement > 0) {
        const valid = aiApi.listValidWorkerImprovements(s, u.id);
        const objective = chooseWorkerObjective(s, civIndex, u, valid, aiApi, posture, rng);
        if (objective.action === 'build') {
          s = aiApi.buildImprovement(s, u.id, objective.improvement);
          continue;
        }
        if (objective.action === 'move') {
          const step = aiApi.bestNeighborToward(s, u, objective.q, objective.r);
          if (step && aiApi.canFriendlyStackOnTile(s, civIndex, u.type, step.q, step.r, u.id)) {
            s = aiApi.moveUnit(s, u.id, step.q, step.r);
          }
        }
      }
      continue;
    }

    if (u.strength > 0 || u.rangedStrength > 0) {
      s = runCombatMovesUntilIdle(s, civIndex, u.id, aiApi, p, posture, rng);
    }
  }

  return useFogOfWar ? actualState : s;
}
