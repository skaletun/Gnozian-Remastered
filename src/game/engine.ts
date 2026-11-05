import type {
  GameState, GameSettings, Tile, City, Unit, Civilization,
  DiplomaticRelation, YieldMap, ProductionItem, UnitType, BuildingType,
  VictoryType, TechId, WorldState, WonderId, TerrainType,
  GreatPersonMeterKind,
  DistrictType,
  LeaderAttributeKey,
  AchievementPlayStats,
  ImprovementType,
  TradeRoute,
  TradeAgreement,
  TradeLot,
  DiplomaticOffer,
  DiplomaticSettlementPayments,
  GrowthEventOptionId,
  InfluenceActionKind,
  LegacyPathType,
  CrisisPolicyType,
} from './types';
import {
  BUILDINGS, UNITS, TECHNOLOGIES, CIV_TEMPLATES, CIV_CITY_NAMES,
  NATURAL_RESOURCES, WEATHER_GOLD_MULT,
  DIPLO_PEACE_LOCK_TURNS,
  GOVERNMENTS, POLICY_CARDS, GREAT_PEOPLE,
  DIPLOMACY_VICTORY_POINTS_REQUIRED,
  AI_PERSONALITIES,
  TRADE_ROUTE_GOLD_BASE,
  ARMISTICE_DURATION_TURNS,
  ARMISTICE_DURATION_MIN_TURNS,
  ARMISTICE_DURATION_MAX_TURNS,
  ALLIANCE_MIN_DIPLOMATIC_FAVOR,
  CIVICS,
  getCivTemplateByName,
} from './constants';
import {
  generateMap,
  findStartingPositions,
  findEarthHistoricalStartingPositions,
  createRng,
  updateVision,
  getNeighbors,
  hexDistance,
  createTerrainGrid,
  unitSightRevealHexRadius,
} from './mapgen';
import { EARTH_MAP_WIDTH, EARTH_MAP_HEIGHT } from './earthMapFixed';
import { canAttackAtHexDistance, tileMovementEnterCost } from './movementRules';
import { gridToScreen } from './hexMetrics';
import { addMessage } from './messages';
import {
  createDefaultSystems,
  applyFeatureSystemsEnd,
  applyWonderIncomeModifiers,
  missionarySpread,
  completeWonderProduction,
  isWonderAvailable,
  getCultureVictoryDominantCount,
} from './featureSystems';
import { runAITurn, type AIEngineAPI } from './ai';
import { createInitialAgeState, runAgeFrameworkTurn } from './ages/ageFramework';
import { decideAiSettlementResponse } from './diplomacySettlementAi';
import { findLeastCostMovementPath } from './pathfinding';
import { cityFoundingValidationError } from './cityFoundingRules';
import { workerImprovementValidationError, listLegalWorkerImprovementsAt } from './workerImprovementRules';
import { findStrategicNextStep } from './aiPathfinding';
import {
  productionReserveCap,
  productionReserveCost,
  productionReserveGainPerTurn,
} from './productionReserve';
import { applyUnitCombat, applyCityAttackUnitMutations } from './services/StateMutationService';
import { rngForEvent } from './kernel/rng';
import { normalizeStateContract } from './kernel/stateContract';
import { MEMENTO_DEFINITIONS, sanitizeMementoLoadout } from './metaProgression';

const WORKER_MAX_BUILDS = 3;

export function createAIEngineAPI(): AIEngineAPI {
  return {
    startResearch,
    startCivicResearch,
    addToProductionQueue,
    moveUnit,
    foundCity,
    combatUnit,
    attackCity,
    declareWar,
    makePeace,
    signArmistice,
    proposeDiplomaticSettlement,
    formAlliance,
    leaveAlliance,
    addTradeRoute,
    signTradeAgreement,
    canDeclareWar,
    areAtWar,
    isMilitarilyEngaged,
    bestNeighborToward,
    calcTileYield,
    canFriendlyStackOnTile,
    activateGreatPerson,
    listValidWorkerImprovements,
    buildImprovement,
  };
}
import { empireMeetsUnitStrategicRequirements } from './strategicResources';
import { cloneTileRows } from './services/TileUtils';
import { computeUnitCombat, computeCityCombat } from './services/CombatService';
import {
  areAtWar as areAtWarCore,
  applyPairGoldTransfer,
  canDeclareWar as canDeclareWarCore,
  clampSettlementGold,
  getCapitalCity,
  getAllies as getAlliesCore,
  isMilitarilyEngaged as isMilitarilyEngagedCore,
  relationIndex,
  relationPair,
  sanitizeTradeLots,
  settleTradeLotsByCivOrder,
} from './systems/diplomacyCore';
import { assignWorkedTiles, calcCityYields, calcTileYield } from './systems/economyCore';
import {
  getTradeRouteBlockReason,
  applyAutoRoadGeneration,
  pruneInvalidTradeRoutes,
  syncRelationTradeRouteCounts,
  findTradeNetworkPath,
} from './systems/tradeRoutesCore';
import { resolveTurnEndOrchestrated } from './orchestration/turnEndOrchestrator';
import {
  atPeaceWithAllAlive,
  calcCityHappiness,
  calcCityHousing,
  calcEra,
  cityIndustryBuildingCount,
  decayTradeAgreements,
  districtishBuildingCount,
  effectiveTradeGoldForCiv,
  foreignReligionCityCount,
  governmentAndPolicyYields,
  handleArmisticeExpiry,
  isSpaceVictoryDoneFor,
  nextWorldState,
  normalizeRouteRiskByRelations,
  processSpaceRaceForCiv,
  relationFavorDeltaForCiv,
  religiousVictoryCandidate,
  updateRelationDriftPerTurn,
  wonderCountFor,
} from './systems/turnStateCore';
import {
  allocateLeaderAttributePoint as allocateLeaderAttributePointCore,
  autoAllocateLeaderAttributesForAi,
  createCivilizationIdentityLayer,
  createLeaderProfiles,
  leaderYieldBonuses,
} from './systems/leaderCore';
import {
  canAssignDistrictSpecialists,
  canBuildDistrict,
  canUpgradeTownToCity,
  districtKindForType,
  normalizeSettlement,
  settlementSoftCapPenalty,
} from './systems/settlementCore';
import {
  applyGrowthChoice,
  createGrowthEvent,
  selectAiGrowthChoice,
  selectAiGrowthTarget,
} from './systems/growthEventsCore';
import {
  appendInfluenceActionLog,
  canSpendInfluence,
  influenceActionCost,
  spendInfluence,
  tickInfluenceEconomy,
} from './systems/influenceDiplomacyCore';
import { getIndependentActionCost, tickIndependentPowers } from './systems/independentPowersCore';
import { tickGeographyProgress } from './systems/geographyCore';
import {
  applyLegacyAndCrisisIncomeModifiers,
  chooseCrisisPolicy,
  legacyVictoryScore,
  chooseLegacyOption,
  snoozeCrisisPolicyPrompt,
  snoozeLegacyPrompt,
  tickLegacyCrisis,
} from './systems/legacyCrisisCore';
import { applyResourceSlotModifiers } from './systems/resourceSlotsCore';
import { isVictoryTypeUnlockedForAge } from './systems/victoryRulesCore';
import { bothCivsUnlocked, progressionLockReason } from './progressionLocks';
import {
  activateCommanderAbility,
  appointCommander,
  assignUnitToCommander,
  commanderForUnit,
  pruneCommanders,
  tickCommanders,
  unassignUnitFromCommander,
} from './systems/commandersCore';
import type { ProcessTurnOptions } from './orchestration/turnEndOrchestrator';
export type { ProcessTurnOptions } from './orchestration/turnEndOrchestrator';
export {
  countTradeRoutesBetween,
  getTradeRouteBlockReason,
  migrateLoadedTradeRoutes,
  syncRelationTradeRouteCounts,
} from './systems/tradeRoutesCore';

export { addMessage } from './messages';

/** Per-tile owning civ from city cultural borders (hex distance + pop/culture pressure). Mutates `state.tiles`. */
export function recomputeTileTerritory(state: GameState): void {
  const tiles = state.tiles;
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  if (!w || !h) return;

  const cities = state.cities.filter(c => state.civilizations[c.owner]?.isAlive);
  const best = new Map<string, { score: number; owner: number; cityId: number }>();

  for (const city of cities) {
    const culture = city.yields?.culture ?? 0;
    const pop = city.population;
    const maxR = Math.max(3, Math.min(9, 3 + Math.floor(pop * 0.55) + Math.min(5, Math.floor(culture / 16))));

    for (let r = 0; r < h; r++) {
      for (let q = 0; q < w; q++) {
        const t = tiles[r][q];
        if (t.terrain === 'ocean') continue;
        const d = hexDistance(q, r, city.q, city.r);
        if (d > maxR) continue;
        const score =
          (maxR - d) * 480 +
          pop * 58 +
          Math.floor(culture * 15) +
          (d === 0 ? 20000 : 0);
        const key = `${q},${r}`;
        const prev = best.get(key);
        if (!prev || score > prev.score || (score === prev.score && city.id < prev.cityId)) {
          best.set(key, { score, owner: city.owner, cityId: city.id });
        }
      }
    }
  }

  for (let r = 0; r < h; r++) {
    for (let q = 0; q < w; q++) {
      const t = tiles[r][q];
      if (t.terrain === 'ocean') {
        t.owner = null;
        t.territoryCityId = null;
        continue;
      }
      if (t.city != null) {
        const oc = cities.find(c => c.id === t.city);
        t.owner = oc?.owner ?? null;
        t.territoryCityId = t.city;
        continue;
      }
      const win = best.get(`${q},${r}`);
      t.owner = win ? win.owner : null;
      t.territoryCityId = win ? win.cityId : null;
    }
  }
}

// ============================================================
// HELPERS
// ============================================================
/** Turns without combat damage before healing on owned territory; heal applies at turn advance in processTurn. */
const TERRITORY_HEAL_PEACE_TURNS = 5;
const TERRITORY_HEAL_HP = 25;

function unitEligibleForTerritoryHeal(u: Unit): boolean {
  return u.strength > 0 || u.rangedStrength > 0;
}

const EMPTY_YIELDS = (): YieldMap => ({
  food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0,
});

function civNameSafe(state: GameState, civIndex: number): string {
  return state.civilizations[civIndex]?.name ?? `Civ#${civIndex}`;
}

export const DEFAULT_WORLD: WorldState = { hour: 6, weather: 'clear' };

export function unitsAtPosition(state: GameState, q: number, r: number): Unit[] {
  return state.units.filter(u => u.q === q && u.r === r);
}

export function isEnemyCombatUnit(u: Unit, myOwner: number): boolean {
  return u.owner !== myOwner && (u.strength > 0 || u.rangedStrength > 0);
}

/** Same-owner units on a tile must share one unit type (stacking rule). */
export function canFriendlyStackOnTile(
  state: GameState,
  owner: number,
  unitType: UnitType,
  q: number,
  r: number,
  excludeUnitId?: number
): boolean {
  const occ = unitsAtPosition(state, q, r).filter(u => u.id !== excludeUnitId);
  if (occ.some(u => isEnemyCombatUnit(u, owner))) return false;
  const mine = occ.filter(u => u.owner === owner);
  if (mine.length === 0) return true;
  return mine.every(u => u.type === unitType);
}

export function reconcileTileUnitPointers(state: GameState): GameState {
  // Only clone rows that currently contain units or that previously had unit pointers,
  // to avoid cloning the entire grid unnecessarily.
  const rowsToClone = new Set<number>();
  for (const u of state.units) rowsToClone.add(u.r);
  for (let r = 0; r < state.tiles.length; r++) {
    if (state.tiles[r].some(t => t.unit != null)) rowsToClone.add(r);
  }
  const tiles = state.tiles.map((row, r) =>
    rowsToClone.has(r) ? row.map(t => ({ ...t, unit: null as number | null })) : row
  );
  const best = new Map<string, number>();
  for (const u of state.units) {
    const k = `${u.q},${u.r}`;
    const prev = best.get(k);
    if (prev === undefined || u.id < prev) best.set(k, u.id);
  }
  for (const [k, minId] of best) {
    const [qx, rx] = k.split(',').map(Number);
    if (rx >= 0 && rx < tiles.length && qx >= 0 && qx < tiles[0].length) {
      tiles[rx][qx].unit = minId;
    }
  }
  return { ...state, tiles };
}

function findSpawnCellForUnit(state: GameState, city: City, unitType: UnitType): { q: number; r: number } | null {
  const w = state.tiles[0]?.length ?? 0;
  const h = state.tiles.length;
  if (!w || !h) return null;
  const candidates = [{ q: city.q, r: city.r }, ...getNeighbors(city.q, city.r, w, h)];
  for (const c of candidates) {
    const t = state.tiles[c.r]?.[c.q];
    if (!t || t.terrain === 'ocean' || t.terrain === 'mountains') continue;
    if (canFriendlyStackOnTile(state, city.owner, unitType, c.q, c.r)) return c;
  }
  return null;
}

/** AI world-scale path selection. Actual moves still pass through moveUnit validation. */
export function bestNeighborToward(
  s: GameState,
  unit: Unit,
  targetQ: number,
  targetR: number
): { q: number; r: number } | null {
  return findStrategicNextStep(s, unit, targetQ, targetR);
}

export function moveUnitGroup(state: GameState, unitIds: number[], toQ: number, toR: number): GameState {
  let s = state;
  for (const id of unitIds) {
    const u = s.units.find(x => x.id === id);
    if (!u) continue;
    // Each unit must be hex-adjacent to the destination (stack may desync if state was stale).
    if (hexDistance(u.q, u.r, toQ, toR) !== 1) continue;
    s = moveUnit(s, id, toQ, toR);
  }
  return s;
}

export { getEmpireStrategicResourceAccess, empireMeetsUnitStrategicRequirements } from './strategicResources';
export { assignWorkedTiles, calcCityYields, calcTileYield } from './systems/economyCore';

// ============================================================
// FOUND CITY
// ============================================================
export function foundCity(
  state: GameState,
  civIndex: number,
  q: number,
  r: number,
  unitId: number
): GameState {
  const blocked = cityFoundingValidationError(state, civIndex, q, r, unitId);
  if (blocked) return addMessage(state, `Cannot found city: ${blocked}.`, 'warning', [civIndex]);
  const civ = state.civilizations[civIndex]!;
  const civTemplate = getCivTemplateByName(civ.name);
  const cityNames = CIV_CITY_NAMES[civ.name] || ['City'];
  const usedNames = state.cities.filter(c => c.owner === civIndex).map(c => c.name);
  const availableNames = cityNames.filter(n => !usedNames.includes(n));
  const cityName = availableNames.length > 0
    ? availableNames[0]
    : `${civTemplate?.adjective ?? civ.adjective} City ${civ.cities.length + 1}`;

  const newCity: City = {
    id: state.nextCityId,
    name: cityName,
    owner: civIndex,
    q,
    r,
    population: 1,
    food: 0,
    foodNeeded: 15,
    buildings: civ.cities.length === 0 ? ['palace'] : [],
    productionQueue: [],
    workedTiles: [],
    yields: EMPTY_YIELDS(),
    isCapital: civ.cities.length === 0,
    defense: 20,
    hp: 200,
    maxHp: 200,
    turnFounded: state.turn,
    majorityReligionIndex: null,
    housing: 5,
    amenities: 2,
    loyalty: 100,
    greatWorkIds: [],
    settlementKind: civ.cities.length === 0 ? 'capital' : 'town',
    townSpecialization: civ.cities.length === 0 ? null : 'balanced',
    settlementTier: civ.cities.length === 0 ? 3 : 1,
    settlementSoftCapPenalty: 0,
    districts: [
      {
        id: `district-${state.nextCityId}-center`,
        kind: 'urban',
        type: 'urban_center',
        q,
        r,
        level: 1,
        specialists: 0,
        establishedTurn: state.turn,
      },
    ],
  };

  // Clone only the rows that will be modified/read by city spawn (radius 3)
  const rows: number[] = [];
  for (let rr = Math.max(0, r - 3); rr <= Math.min(state.tiles.length - 1, r + 3); rr++) rows.push(rr);
  const newTiles = cloneTileRows(state.tiles, rows);
  if (!newTiles[r]) throw new Error('Invalid map row when founding city');
  newTiles[r][q] = { ...newTiles[r][q], city: newCity.id, owner: civIndex, territoryCityId: newCity.id };

  assignWorkedTiles(newCity, newTiles, [...state.cities, newCity]);
  newCity.yields = calcCityYields(newCity, newTiles);

  const newCivs = state.civilizations.map((c, i) => {
    if (i !== civIndex) return c;
    return {
      ...c,
      cities: [...c.cities, newCity.id],
      capital: c.capital ?? newCity.id,
    };
  });

  // Remove settler unit
  const newUnits = state.units.filter(u => u.id !== unitId);
  newCivs[civIndex] = {
    ...newCivs[civIndex],
    units: newCivs[civIndex].units.filter(id => id !== unitId),
  };

  const newState = {
    ...state,
    tiles: newTiles,
    cities: [...state.cities, newCity],
    units: newUnits,
    civilizations: newCivs,
    nextCityId: state.nextCityId + 1,
    selectedUnitId: null,
  };

  updateVision(newState.tiles, civIndex, newState.units, newState.cities);
  recomputeTileTerritory(newState);

  return addMessage(reconcileTileUnitPointers(newState), `${cityName} has been founded!`, 'city', [civIndex]);
}

// ============================================================
// SPAWN UNIT
// ============================================================
export function spawnUnit(
  state: GameState,
  civIndex: number,
  type: UnitType,
  q: number,
  r: number
): GameState {
  const def = UNITS[type];
  if (!def) return state;

  if (!canFriendlyStackOnTile(state, civIndex, type, q, r)) {
    return addMessage(state, 'Cannot place unit: tile is full or mixed unit types.', 'warning', [civIndex]);
  }

  const newUnit: Unit = {
    id: state.nextUnitId,
    type,
    owner: civIndex,
    q,
    r,
    hp: 100,
    maxHp: 100,
    movement: def.movement,
    maxMovement: def.movement,
    strength: def.strength,
    rangedStrength: def.rangedStrength,
    range: def.range,
    hasAttacked: false,
    promotions: [],
    era: def.era,
    name: def.name,
    ...(type === 'scout' ? { scoutAutoExplore: !state.civilizations[civIndex]?.isHuman } : {}),
    ...(type === 'worker' ? { workerBuildsRemaining: WORKER_MAX_BUILDS } : {}),
  };

  const newCivs = state.civilizations.map((c, i) => {
    if (i !== civIndex) return c;
    return { ...c, units: [...c.units, newUnit.id] };
  });

  return reconcileTileUnitPointers({
    ...state,
    units: [...state.units, newUnit],
    civilizations: newCivs,
    nextUnitId: state.nextUnitId + 1,
  });
}

// ============================================================
// MOVE UNIT
// ============================================================
export function moveUnit(
  state: GameState,
  unitId: number,
  toQ: number,
  toR: number
): GameState {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) return state;

  if (hexDistance(unit.q, unit.r, toQ, toR) !== 1) {
    // Ignore stray non-adjacent taps/commands silently to avoid message spam.
    return state;
  }

  const tile = state.tiles[toR]?.[toQ];
  if (!tile) return state;
  const enterCost = tileMovementEnterCost(tile.terrain, unit.type, {
    state,
    civIndex: unit.owner,
    fromQ: unit.q,
    fromR: unit.r,
    toQ,
    toR,
  });
  if (enterCost == null) {
    return addMessage(state, 'Terrain is impassable for this unit.', 'warning', [unit.owner]);
  }
  if (enterCost > unit.movement) {
    return addMessage(state, 'Not enough movement points for this terrain.', 'warning', [unit.owner]);
  }

  if (unit.type === 'missionary' && tile.city != null) {
    const city = state.cities.find(c => c.id === tile.city);
    if (city && city.owner !== unit.owner) {
      return missionarySpread(state, unitId, city.id);
    }
  }

  const destOwner = tile.owner;
  if (destOwner != null && destOwner !== unit.owner) {
    const rp = relationPair(state.relations, unit.owner, destOwner);
    if (rp?.status === 'armistice') {
      return addMessage(state, 'Armistice: cannot enter foreign territory.', 'warning', [unit.owner]);
    }
  }

  const atDest = unitsAtPosition(state, toQ, toR).filter(u => u.id !== unitId);
  const enemyCombat = atDest.find(u => isEnemyCombatUnit(u, unit.owner));
  if (enemyCombat) {
    return combatUnit(state, unitId, enemyCombat.id);
  }

  if (!canFriendlyStackOnTile(state, unit.owner, unit.type, toQ, toR, unitId)) {
    return addMessage(
      state,
      'Cannot enter: only identical unit types may stack (military vs military of same class, etc.).',
      'warning',
      [unit.owner]
    );
  }

  const newUnits = state.units.map(u => {
    if (u.id !== unitId) return u;
    return { ...u, q: toQ, r: toR, movement: Math.max(0, u.movement - enterCost) };
  });

  let newState = reconcileTileUnitPointers({ ...state, units: newUnits });
  updateVision(newState.tiles, unit.owner, newState.units, newState.cities);
  return newState;
}

/** Move along a shortest MP-budget path to a distant tile (respects `findLeastCostMovementPath`). */
export function moveUnitAlongPath(state: GameState, unitId: number, goalQ: number, goalR: number): GameState {
  let s = state;
  const u0 = s.units.find(x => x.id === unitId);
  if (!u0) return state;
  const path = findLeastCostMovementPath(s, u0, goalQ, goalR, { restrictToOwnedTerrain: true });
  if (!path || path.length < 2) return state;
  const maxSteps = Math.min(path.length - 1, 2048);
  for (let i = 1; i <= maxSteps; i++) {
    const prev = path[i - 1]!;
    const cur = path[i]!;
    const u = s.units.find(x => x.id === unitId);
    if (!u || u.q !== prev.q || u.r !== prev.r) break;
    if (hexDistance(prev.q, prev.r, cur.q, cur.r) !== 1) break;
    s = moveUnit(s, unitId, cur.q, cur.r);
    if (!s.units.some(x => x.id === unitId)) break;
  }
  return s;
}

function isEnemyOwnedCityCenter(state: GameState, viewerCiv: number, q: number, r: number): boolean {
  const tile = state.tiles[r]?.[q];
  if (!tile || tile.city == null) return false;
  const city = state.cities.find(c => c.id === tile.city);
  return city != null && city.owner !== viewerCiv;
}

function sightDiskScoreForScout(
  tiles: Tile[][],
  civSlot: number,
  centerQ: number,
  centerR: number,
  sightR: number
): { unrevealed: number; frontier: number } {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  let unrevealed = 0;
  let frontier = 0;
  for (let r = Math.max(0, centerR - sightR); r <= Math.min(h - 1, centerR + sightR); r++) {
    for (let c = Math.max(0, centerQ - sightR); c <= Math.min(w - 1, centerQ + sightR); c++) {
      if (hexDistance(c, r, centerQ, centerR) > sightR) continue;
      const t = tiles[r][c];
      if (!t) continue;
      const revealed = !!(Array.isArray(t.revealed) && t.revealed.length > civSlot && t.revealed[civSlot]);
      if (revealed) continue;
      unrevealed++;
      const neighbors = getNeighbors(c, r, w, h);
      if (
        neighbors.some(n => {
          const nt = tiles[n.r]?.[n.q];
          return !!(Array.isArray(nt?.revealed) && nt.revealed.length > civSlot && nt.revealed[civSlot]);
        })
      )
        frontier++;
    }
  }
  return { unrevealed, frontier };
}

function nearestUnrevealedDistanceForScout(
  tiles: Tile[][],
  civSlot: number,
  fromQ: number,
  fromR: number
): number | null {
  let best: number | null = null;
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r];
    if (!row) continue;
    for (let q = 0; q < row.length; q++) {
      const t = row[q];
      if (!t) continue;
      const revealed = !!(Array.isArray(t.revealed) && t.revealed.length > civSlot && t.revealed[civSlot]);
      if (revealed) continue;
      const d = hexDistance(fromQ, fromR, q, r);
      if (best == null || d < best) best = d;
    }
  }
  return best;
}

export function pickScoutAutoExploreStep(
  state: GameState,
  unit: Unit,
  banFrom: { q: number; r: number } | null
): { toQ: number; toR: number } | null {
  if (unit.type !== 'scout' || !unit.scoutAutoExplore || unit.movement <= 0) return null;

  const civ = unit.owner;
  const sightR = unitSightRevealHexRadius(unit.type);
  const w = state.tiles[0]?.length ?? 0;
  const h = state.tiles.length;
  if (!w || !h) return null;

  type Cand = { toQ: number; toR: number; score: number; enterCost: number; sortKey: string; tieJitter: number };
  const cands: Cand[] = [];
  const tieRng = rngForEvent(state, 'scout:autoExplore', unit.id, unit.q, unit.r);

  for (const n of getNeighbors(unit.q, unit.r, w, h)) {
    if (hexDistance(unit.q, unit.r, n.q, n.r) !== 1) continue;
    if (banFrom && n.q === banFrom.q && n.r === banFrom.r) continue;
    if (isEnemyOwnedCityCenter(state, civ, n.q, n.r)) continue;

    const tile = state.tiles[n.r]?.[n.q];
    if (!tile) continue;

    const enterCost = tileMovementEnterCost(tile.terrain, unit.type, {
      state,
      civIndex: civ,
      fromQ: unit.q,
      fromR: unit.r,
      toQ: n.q,
      toR: n.r,
    });
    if (enterCost == null || enterCost > unit.movement) continue;

    const destOwner = tile.owner;
    if (destOwner != null && destOwner !== civ) {
      const rp = relationPair(state.relations, civ, destOwner);
      if (rp?.status === 'armistice') continue;
    }

    const atDest = unitsAtPosition(state, n.q, n.r).filter(u => u.id !== unit.id);
    if (atDest.some(u => isEnemyCombatUnit(u, civ))) continue;
    if (!canFriendlyStackOnTile(state, civ, unit.type, n.q, n.r, unit.id)) continue;

    const metrics = sightDiskScoreForScout(state.tiles, civ, n.q, n.r, sightR);
    const nearestUnrevealed = nearestUnrevealedDistanceForScout(state.tiles, civ, n.q, n.r);
    if (nearestUnrevealed == null) continue;
    const frontierPathScore = Math.max(0, 500 - nearestUnrevealed * 35);
    const score = metrics.unrevealed * 100 + metrics.frontier * 28 + frontierPathScore;
    cands.push({
      toQ: n.q,
      toR: n.r,
      score,
      enterCost,
      sortKey: `${n.q.toString().padStart(5, '0')},${n.r.toString().padStart(5, '0')}`,
      tieJitter: tieRng(),
    });
  }

  if (!cands.length) return null;
  cands.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.enterCost !== b.enterCost) return a.enterCost - b.enterCost;
    if (b.tieJitter !== a.tieJitter) return b.tieJitter - a.tieJitter;
    return a.sortKey.localeCompare(b.sortKey);
  });
  const best = cands[0]!;
  return { toQ: best.toQ, toR: best.toR };
}

/** Resolve any number of auto-explore steps for scouts with movement (one parallel round-robin sweep per pass). */
export function runAllScoutsAutoExplore(state: GameState, opts?: { onlyUnitId?: number }): GameState {
  if (state.phase !== 'playing') return state;
  const onlyId = opts?.onlyUnitId;
  const seedIds = state.units
    .filter(u => u.type === 'scout' && u.scoutAutoExplore && (onlyId == null || u.id === onlyId))
    .map(u => u.id);
  if (!seedIds.length) return state;

  let s = state;
  const bans = new Map<number, { q: number; r: number }>();
  let guard = 0;
  let progress = true;
  while (progress && guard < 16_000) {
    guard++;
    progress = false;
    for (const id of seedIds) {
      const u = s.units.find(x => x.id === id);
      if (!u || u.type !== 'scout' || !u.scoutAutoExplore || u.movement <= 0) continue;
      const step = pickScoutAutoExploreStep(s, u, bans.get(u.id) ?? null);
      if (!step) continue;
      const beforeQ = u.q;
      const beforeR = u.r;
      const beforeMp = u.movement;
      s = moveUnit(s, u.id, step.toQ, step.toR);
      const after = s.units.find(x => x.id === id);
      if (!after || (after.q === beforeQ && after.r === beforeR && after.movement === beforeMp)) continue;
      progress = true;
      bans.set(id, { q: beforeQ, r: beforeR });
    }
  }
  return s;
}

export function setScoutAutoExplore(
  state: GameState,
  actingCivIndex: number,
  unitId: number,
  enabled: boolean
): GameState {
  const u = state.units.find(x => x.id === unitId);
  if (!u || u.type !== 'scout' || u.owner !== actingCivIndex) return state;
  let next: GameState = {
    ...state,
    units: state.units.map(x => (x.id === unitId ? { ...x, scoutAutoExplore: enabled } : x)),
  };
  if (enabled) {
    const live = next.units.find(x => x.id === unitId);
    if (live && live.movement > 0) next = runAllScoutsAutoExplore(next, { onlyUnitId: unitId });
  }
  return next;
}

// ============================================================
// COMBAT
// ============================================================
// Combat strength / damage calculation moved to services/CombatService.ts

function padAchievementStats(state: GameState): AchievementPlayStats[] {
  const n = state.civilizations.length;
  const cur = state.achievementStats ?? [];
  const out: AchievementPlayStats[] = [];
  for (let i = 0; i < n; i++) {
    out[i] = { combatWins: cur[i]?.combatWins ?? 0, enemyCitiesCaptured: cur[i]?.enemyCitiesCaptured ?? 0 };
  }
  return out;
}

function incCombatWin(state: GameState, attackerOwner: number): GameState {
  const stats = padAchievementStats(state);
  if (attackerOwner < 0 || attackerOwner >= stats.length) return state;
  const next = stats.map((row, i) =>
    i === attackerOwner ? { ...row, combatWins: row.combatWins + 1 } : row
  );
  return { ...state, achievementStats: next };
}

function incEnemyCityCapture(state: GameState, attackerOwner: number): GameState {
  const stats = padAchievementStats(state);
  if (attackerOwner < 0 || attackerOwner >= stats.length) return state;
  const next = stats.map((row, i) =>
    i === attackerOwner ? { ...row, enemyCitiesCaptured: row.enemyCitiesCaptured + 1 } : row
  );
  return { ...state, achievementStats: next };
}

export function combatUnit(
  state: GameState,
  attackerId: number,
  defenderId: number
): GameState {
  let stateAfterWar = state;
  const attacker = stateAfterWar.units.find(u => u.id === attackerId);
  const defender = stateAfterWar.units.find(u => u.id === defenderId);
  if (!attacker || !defender) return stateAfterWar;
  if (attacker.hasAttacked) return stateAfterWar;
  const rp = relationPair(stateAfterWar.relations, attacker.owner, defender.owner);
  if (attacker.owner !== defender.owner && rp?.status !== 'war') {
    return addMessage(stateAfterWar, 'Cannot attack without war declaration.', 'warning', [attacker.owner]);
  }
  if (rp?.status === 'armistice') {
    return addMessage(stateAfterWar, 'Armistice forbids combat.', 'warning', [attacker.owner]);
  }

  if (attacker.movement <= 0) {
    return addMessage(stateAfterWar, 'No movement left to attack this turn.', 'warning', [attacker.owner]);
  }

  const dist = hexDistance(attacker.q, attacker.r, defender.q, defender.r);
  if (!canAttackAtHexDistance(attacker, dist, 'unit')) {
    return addMessage(stateAfterWar, 'Target is out of attack range.', 'warning', [attacker.owner]);
  }

  const combatRes = computeUnitCombat(stateAfterWar, attacker, defender, stateAfterWar.tiles);
  const { atkDmg, defDmg, newDefHp, newAtkHp } = combatRes;

  const atkCiv = stateAfterWar.civilizations[attacker.owner];
  const defCiv = stateAfterWar.civilizations[defender.owner];
  const atkWho = atkCiv ? `${atkCiv.adjective} ${attacker.name}` : attacker.name;
  const defWho = defCiv ? `${defCiv.adjective} ${defender.name}` : defender.name;

  const applied = applyUnitCombat(stateAfterWar, attacker, defender, atkDmg, defDmg, newAtkHp, newDefHp);

  let newUnits = applied.units;
  let newCivs = applied.civilizations;
  const newTiles = applied.tiles;
  let msg = combatRes.msg;
  if (applied.defenderKilled) msg += ` · ${defWho} destroyed`;
  if (applied.attackerKilled) msg += ` · ${atkWho} destroyed`;

  let newState: GameState = { ...stateAfterWar, units: newUnits, civilizations: newCivs, tiles: newTiles };
  newState = reconcileTileUnitPointers(newState);
  if (newDefHp <= 0) {
    newState = incCombatWin(newState, attacker.owner);
  }
  return addMessage(pruneCommanders(newState), msg, 'combat', [attacker.owner, defender.owner]);
}

// ============================================================
// CITY COMBAT
// ============================================================
export function attackCity(
  state: GameState,
  attackerId: number,
  cityId: number
): GameState {
  const s = state;
  const attacker = s.units.find(u => u.id === attackerId);
  const city = s.cities.find(c => c.id === cityId);
  if (!attacker || !city || attacker.hasAttacked) return s;
  const defenderOwnerSlot = city.owner;
  if (attacker.owner === city.owner) return s;
  const rel = relationPair(s.relations, attacker.owner, city.owner);
  if (rel?.status === 'armistice') {
    return addMessage(s, 'Armistice forbids attacking cities.', 'warning', [attacker.owner]);
  }
  if (rel?.status !== 'war') {
    return addMessage(s, 'Cannot attack cities without war declaration.', 'warning', [attacker.owner]);
  }

  if (attacker.movement <= 0) {
    return addMessage(s, 'No movement left to attack this turn.', 'warning', [attacker.owner]);
  }

  const dist = hexDistance(attacker.q, attacker.r, city.q, city.r);
  if (!canAttackAtHexDistance(attacker, dist, 'city')) {
    return addMessage(s, 'City is out of attack range.', 'warning', [attacker.owner]);
  }

  const combat = computeCityCombat(s, attacker, city);
  const { newCityHp, newAtkHp } = combat;

  const atkCiv = s.civilizations[attacker.owner];
  const defCiv = s.civilizations[city.owner];
  const atkName = atkCiv?.name ?? 'attacker';
  const atkWho = atkCiv ? `${atkCiv.adjective} ${attacker.name}` : attacker.name;
  const defWho = defCiv ? `${defCiv.adjective} ${city.name}` : city.name;

  const applied = applyCityAttackUnitMutations(s, attacker, newAtkHp);
  let newUnits = applied.units;
  let newCivs = applied.civilizations;
  let newCities = s.cities.map(c => {
    if (c.id !== cityId) return c;
    return { ...c, hp: newCityHp };
  });
  // Clone only rows around city and attacker to limit allocations
  const rowsToClone = new Set<number>();
  for (let rr = Math.max(0, city.r - 3); rr <= Math.min(s.tiles.length - 1, city.r + 3); rr++) rowsToClone.add(rr);
  rowsToClone.add(attacker.r);
  const newTiles = cloneTileRows(s.tiles, rowsToClone);
  let msg = combat.msg;
  let cityWasCaptured = false;
  // City captured
  if (newCityHp <= 0) {
    cityWasCaptured = true;
    msg = `${defWho} captured by ${atkName} (${atkWho})`;
    const oldOwner = city.owner;
    const wasCapital = !!city.isCapital;
    const isMelee = (attacker.rangedStrength ?? 0) === 0 && newAtkHp > 0;
    newCities = newCities.map(c => {
      if (c.id !== cityId) return c;
      return {
        ...c,
        owner: attacker.owner,
        hp: 100,
        defense: 20,
        isCapital: false,
        settlementKind: c.population >= 7 ? 'city' : 'town',
        settlementTier: c.population >= 7 ? 2 : 1,
        buildings: c.buildings.filter(b => b !== 'palace'),
      };
    });

    newCivs = newCivs.map((civ, i) => {
      if (i === oldOwner) {
        const remaining = civ.cities.filter(id => id !== cityId);
        const newCapital =
          wasCapital && remaining.length > 0
            ? (remaining.find(id => id !== civ.capital) ?? remaining[0])
            : civ.capital;
        return {
          ...civ,
          cities: remaining,
          capital: remaining.length > 0 ? newCapital : null,
          isAlive: remaining.length > 0,
        };
      }
      if (i === attacker.owner) {
        return { ...civ, cities: [...civ.cities, cityId] };
      }
      return civ;
    });

    // Move melee attacker into the captured city
    if (isMelee) {
      if (newTiles[attacker.r] && newTiles[attacker.r][attacker.q]) {
        if (newTiles[attacker.r][attacker.q].unit === attacker.id) {
          newTiles[attacker.r][attacker.q].unit = null;
        }
      }
      if (newTiles[city.r] && newTiles[city.r][city.q]) {
        newTiles[city.r][city.q].unit = attacker.id;
      }
      newUnits = newUnits.map(u =>
        u.id !== attackerId ? u : { ...u, q: city.q, r: city.r }
      );
    }
  }

  let newState: GameState = { ...s, units: newUnits, cities: newCities, civilizations: newCivs, tiles: newTiles };
  newState = reconcileTileUnitPointers(newState);
  recomputeTileTerritory(newState);
  if (cityWasCaptured) {
    newState = incEnemyCityCapture(newState, attacker.owner);
  }
  return addMessage(pruneCommanders(newState), msg, 'combat', [attacker.owner, defenderOwnerSlot]);
}

// ============================================================
// RESEARCH
// ============================================================
export function startResearch(state: GameState, civIndex: number, techId: TechId): GameState {
  const civ = state.civilizations[civIndex];
  const tech = TECHNOLOGIES[techId];
  if (!civ || !tech) return state;
  if (civ.currentResearch) return state;
  if (civ.researchedTechs.includes(techId)) return state;
  if (!tech.prerequisites.every(p => civ.researchedTechs.includes(p))) return state;
  return {
    ...state,
    civilizations: state.civilizations.map((c, i) => {
      if (i !== civIndex) return c;
      return { ...c, currentResearch: techId, researchProgress: 0 };
    }),
  };
}

export function startCivicResearch(state: GameState, civIndex: number, civicId: string): GameState {
  const civ = state.civilizations[civIndex];
  const civic = CIVICS[civicId];
  if (!civ || !civic) return state;
  if (!civic.prerequisites.every(p => (civ.researchedCivics ?? []).includes(p))) return state;
  const isRepeatable = civicId === 'future_society';
  return {
    ...state,
    civilizations: state.civilizations.map((c, i) => {
      if (i !== civIndex) return c;
      if ((c.researchedCivics ?? []).includes(civicId) && !isRepeatable) return c;
      return { ...c, currentCivic: civicId, civicProgress: 0 };
    }),
  };
}

// ============================================================
// BUILD PRODUCTION
// ============================================================
export function addToProductionQueue(
  state: GameState,
  cityId: number,
  item: ProductionItem,
  /** When set (e.g. human slot or AI civ), must match `city.owner` or the queue is rejected. */
  actingCivIndex?: number
): GameState {
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return state;
  if (actingCivIndex !== undefined && city.owner !== actingCivIndex) return state;
  const allowFreePalace = item.type === 'building' && item.id === 'palace' && item.cost === 0;
  if (!Number.isFinite(item.cost) || (item.cost <= 0 && !allowFreePalace)) {
    return addMessage(state, 'Invalid production item cost.', 'warning', [city.owner]);
  }
  if (!Number.isFinite(item.progress) || item.progress < 0) {
    return addMessage(state, 'Invalid production item progress.', 'warning', [city.owner]);
  }
  if (city.productionQueue.length >= 32) {
    return addMessage(state, 'Production queue is full (32 items).', 'warning', [city.owner]);
  }
  if (item.type === 'unit' && !empireMeetsUnitStrategicRequirements(state, city.owner, item.id)) {
    const def = UNITS[item.id];
    const req = def?.requiredStrategicResources;
    const parts =
      req &&
      Object.entries(req)
        .map(([k, n]) => `${NATURAL_RESOURCES[k]?.name ?? k} ×${n}`)
        .join(', ');
    return addMessage(
      state,
      parts
        ? `Need improved strategic access: ${parts} to train ${def?.name ?? item.id}.`
        : `Cannot train ${def?.name ?? item.id} (strategic resources).`,
      'warning',
      [city.owner]
    );
  }
  const owner = state.civilizations[city.owner];
  if (!owner) return state;
  const reserveNeed = allowFreePalace ? 0 : productionReserveCost(item);
  const reserveHave = owner.resources.production ?? 0;
  if (reserveHave < reserveNeed) {
    return addMessage(
      state,
      `Not enough production reserve: need ${reserveNeed}, have ${reserveHave}.`,
      'warning',
      [city.owner]
    );
  }
  return {
    ...state,
    civilizations: state.civilizations.map((c, i) =>
      i === city.owner
        ? {
            ...c,
            resources: {
              ...c.resources,
              production: Math.max(0, (c.resources.production ?? 0) - reserveNeed),
            },
          }
        : c
    ),
    cities: state.cities.map(c => {
      if (c.id !== cityId) return c;
      return { ...c, productionQueue: [...c.productionQueue, item] };
    }),
  };
}

export function upgradeTownToCity(
  state: GameState,
  cityId: number,
  actingCivIndex?: number
): GameState {
  const cityForWarnings = state.cities.find(c => c.id === cityId);
  const warnRel = cityForWarnings ? [cityForWarnings.owner] : undefined;
  const check = canUpgradeTownToCity(state, cityId, actingCivIndex);
  if (!check.ok) {
    const reason = check.reason ?? 'upgrade_failed';
    if (reason === 'not_enough_gold') {
      return addMessage(
        state,
        `Need ${check.cost ?? 0} gold to upgrade this town to a city.`,
        'warning',
        warnRel
      );
    }
    if (reason === 'population_too_low') {
      return addMessage(state, 'Town needs population 5+ before city upgrade.', 'warning', warnRel);
    }
    return state;
  }
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return state;
  const cost = check.cost ?? 0;
  const nextState: GameState = {
    ...state,
    civilizations: state.civilizations.map((c, i) =>
      i !== city.owner
        ? c
        : {
            ...c,
            resources: { ...c.resources, gold: Math.max(0, (c.resources.gold ?? 0) - cost) },
          }
    ),
    cities: state.cities.map(c => {
      if (c.id !== cityId) return c;
      const nextBuildings: BuildingType[] =
        c.buildings.includes('monument') || c.buildings.includes('library')
          ? c.buildings
          : [...c.buildings, 'monument'];
      return normalizeSettlement({
        ...c,
        settlementKind: 'city',
        townSpecialization: null,
        settlementTier: Math.max(2, c.settlementTier ?? 1),
        buildings: nextBuildings,
      });
    }),
  };
  const upgraded = nextState.cities.find(c => c.id === cityId);
  return addMessage(
    nextState,
    `${upgraded?.name ?? city.name} upgraded from town to city (${cost} gold).`,
    'city',
    [city.owner]
  );
}

export function buildSettlementDistrict(
  state: GameState,
  cityId: number,
  type: DistrictType,
  q: number,
  r: number,
  actingCivIndex?: number
): GameState {
  const cityRef = state.cities.find(c => c.id === cityId);
  const warnRel = cityRef ? [cityRef.owner] : undefined;
  const check = canBuildDistrict(state, cityId, type, q, r, actingCivIndex);
  if (!check.ok) {
    const reason = check.reason ?? 'district_build_failed';
    if (reason === 'town_needs_upgrade') {
      return addMessage(state, 'Upgrade this town to a city before building urban districts.', 'warning', warnRel);
    }
    if (reason === 'not_enough_gold') {
      return addMessage(
        state,
        `Need ${check.cost ?? 0} gold to build district ${type}.`,
        'warning',
        warnRel
      );
    }
    if (reason === 'district_cap_reached') {
      return addMessage(state, 'District cap reached for this settlement population.', 'warning', warnRel);
    }
    return state;
  }
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return state;
  const cost = check.cost ?? 0;
  const baseCity = normalizeSettlement(city);
  let districtId = `district-${cityId}-${state.turn}-${q}-${r}-${type}`;
  const existingIds = new Set((baseCity.districts ?? []).map(d => d.id));
  let suffix = 2;
  while (existingIds.has(districtId)) {
    districtId = `district-${cityId}-${state.turn}-${q}-${r}-${type}-${suffix++}`;
  }
  const district = {
    id: districtId,
    kind: districtKindForType(type),
    type,
    q,
    r,
    level: 1,
    specialists: 0,
    establishedTurn: state.turn,
  } as const;
  const nextTiles = state.tiles.map((row, rr) =>
    rr !== r ? row : row.map((t, qq) => (qq !== q ? t : { ...t, owner: t.owner ?? city.owner }))
  );
  let nextState: GameState = {
    ...state,
    tiles: nextTiles,
    civilizations: state.civilizations.map((c, i) =>
      i !== city.owner
        ? c
        : {
            ...c,
            resources: {
              ...c.resources,
              gold: Math.max(0, (c.resources.gold ?? 0) - cost),
            },
          }
    ),
    cities: state.cities.map(c => {
      if (c.id !== cityId) return c;
      const nextCity = normalizeSettlement({
        ...c,
        districts: [...(baseCity.districts ?? []), district],
      });
      return {
        ...nextCity,
        yields: calcCityYields(nextCity, nextTiles),
      };
    }),
  };
  nextState = normalizeStateContract(nextState);
  return addMessage(nextState, `${city.name}: district ${type} established.`, 'city', [city.owner]);
}

export function setDistrictSpecialists(
  state: GameState,
  cityId: number,
  districtId: string,
  specialists: number,
  actingCivIndex?: number
): GameState {
  const cityRef = state.cities.find(c => c.id === cityId);
  const warnRel = cityRef ? [cityRef.owner] : undefined;
  const check = canAssignDistrictSpecialists(state, cityId, districtId, specialists, actingCivIndex);
  if (!check.ok) {
    if (check.reason === 'specialist_cap_reached') {
      return addMessage(state, 'Not enough population capacity for assigned specialists.', 'warning', warnRel);
    }
    return state;
  }
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return state;
  const normalized = normalizeSettlement(city);
  const nextSpecialists = Math.max(0, Math.floor(specialists));
  const nextCities = state.cities.map(c => {
    if (c.id !== cityId) return c;
    const districts = (normalized.districts ?? []).map(d =>
      d.id === districtId ? { ...d, specialists: nextSpecialists } : d
    );
    const nextCity = normalizeSettlement({ ...c, districts });
    return { ...nextCity, yields: calcCityYields(nextCity, state.tiles) };
  });
  const next = normalizeStateContract({ ...state, cities: nextCities });
  return addMessage(next, `${city.name}: specialists updated for district ${districtId}.`, 'city', [city.owner]);
}

export function resolveCityGrowthEvent(
  state: GameState,
  cityId: number,
  choice: GrowthEventOptionId,
  target?: { q: number; r: number; kind?: 'urban' | 'rural' },
  actingCivIndex?: number
): GameState {
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return state;
  if (actingCivIndex != null && city.owner !== actingCivIndex) return state;
  const normalized = normalizeSettlement(city);
  if (!normalized.pendingGrowthEvent) return state;
  if (!normalized.pendingGrowthEvent.options.includes(choice)) return state;
  const t = target
    ? {
        q: Math.floor(Number(target.q)),
        r: Math.floor(Number(target.r)),
        kind: (target.kind === 'urban' ? 'urban' : 'rural') as 'urban' | 'rural',
      }
    : null;
  const nextCities = state.cities.map(c => (c.id === cityId ? applyGrowthChoice(c, choice, t) : c));
  const next = normalizeStateContract({ ...state, cities: nextCities });
  return addMessage(next, `${city.name}: growth path selected (${choice}).`, 'city', [city.owner]);
}

/** Activate a Great Person unit in a friendly city (consumes the unit). */
export function activateGreatPerson(state: GameState, unitId: number, cityId: number): GameState {
  const unit = state.units.find(u => u.id === unitId);
  const city = state.cities.find(c => c.id === cityId);
  if (!unit || !city || unit.owner !== city.owner) return state;
  const gid = unit.greatPersonDefId;
  const gp = gid ? GREAT_PEOPLE[gid] : null;

  let s = state;
  if (unit.type === 'great_scientist') {
    const rng = rngForEvent(state, 'great_person:activate', unit.id, city.id);
    const boost = 120 + Math.floor(rng() * 80);
    s = {
      ...s,
      civilizations: s.civilizations.map((c, i) =>
        i !== unit.owner ? c : { ...c, researchProgress: c.researchProgress + boost }
      ),
    };
    s = addMessage(s, `${gp?.name ?? 'Scientist'} boosts research (+${boost}).`, 'tech', [unit.owner]);
  } else if (unit.type === 'great_engineer') {
    const boost = 160;
    s = {
      ...s,
      civilizations: s.civilizations.map((c, i) =>
        i !== unit.owner ? c : { ...c, researchProgress: c.researchProgress + boost }
      ),
    };
    s = addMessage(s, `${gp?.name ?? 'Engineer'} accelerates engineering (+${boost} science progress).`, 'tech', [unit.owner]);
  } else if (unit.type === 'great_merchant') {
    s = {
      ...s,
      civilizations: s.civilizations.map((c, i) =>
        i !== unit.owner
          ? c
          : { ...c, resources: { ...c.resources, gold: c.resources.gold + 240 }, diplomaticFavor: c.diplomaticFavor + 8 }
      ),
    };
    s = addMessage(s, `${gp?.name ?? 'Merchant'} opens new markets.`, 'diplomacy', [unit.owner]);
  } else if (unit.type === 'great_artist' || unit.type === 'great_writer' || unit.type === 'great_musician') {
    const type =
      unit.type === 'great_writer' ? 'writing' : unit.type === 'great_musician' ? 'music' : 'art';
    const gwId = s.systems.nextGreatWorkId;
    const title = gp?.name
      ? `${gp.name} — ${type === 'art' ? 'Masterpiece' : type === 'writing' ? 'Tome' : 'Symphony'}`
      : `Great Work (${type})`;
    const tourism = type === 'art' ? 6 : type === 'writing' ? 4 : 8;
    const gw = {
      id: gwId,
      name: title,
      type: type === 'music' ? ('music' as const) : type === 'writing' ? ('writing' as const) : ('art' as const),
      creatorCiv: unit.owner,
      creatorGreatPersonId: gid ?? 'unknown',
      theme: 'heritage',
      tourism,
      cityId,
    };
    s = {
      ...s,
      systems: {
        ...s.systems,
        greatWorks: [...s.systems.greatWorks, gw],
        nextGreatWorkId: gwId + 1,
      },
      cities: s.cities.map(c =>
        c.id === cityId ? { ...c, greatWorkIds: [...(c.greatWorkIds ?? []), gwId] } : c
      ),
    };
    s = addMessage(s, `Great Work created in ${city.name}.`, 'tourism', [unit.owner, city.owner]);
  } else {
    s = addMessage(s, 'Great Person ability used.', 'info', [unit.owner]);
  }

  const newUnits = s.units.filter(u => u.id !== unitId);
  const civilizations = s.civilizations.map((c, i) =>
    i !== unit.owner ? c : { ...c, units: c.units.filter(id => id !== unitId) }
  );
  return reconcileTileUnitPointers({ ...s, units: newUnits, civilizations });
}

export function setCivilizationGovernment(
  state: GameState,
  civIndex: number,
  governmentId: Civilization['governmentId'],
  slottedPolicyIds: string[]
): GameState {
  const g = GOVERNMENTS[governmentId];
  if (!g) return state;
  const slots = slottedPolicyIds.filter(pid => POLICY_CARDS[pid]).slice(0, g.policySlots);
  return {
    ...state,
    civilizations: state.civilizations.map((c, i) =>
      i !== civIndex ? c : { ...c, governmentId, slottedPolicyIds: slots }
    ),
  };
}

const PATRONAGE_GP_BOOST_COST = 420;
const PATRONAGE_GP_BOOST_PER_METER = 18;
const ALL_GP_METER_KINDS: GreatPersonMeterKind[] = [
  'scientist',
  'artist',
  'general',
  'merchant',
  'prophet',
  'admiral',
  'engineer',
  'writer',
  'musician',
];

/** Spend gold to raise all Great Person attraction meters (patronage). */
export function purchasePatronageGreatPeopleBoost(state: GameState, civIndex: number): GameState {
  const civ = state.civilizations[civIndex];
  if (!civ?.isAlive) return state;
  if (civ.resources.gold < PATRONAGE_GP_BOOST_COST) {
    return addMessage(
      state,
      `Need ${PATRONAGE_GP_BOOST_COST} gold for patronage.`,
      'warning',
      [civIndex]
    );
  }
  const meters = { ...state.systems.greatPeopleMeter };
  const m = { ...(meters[civIndex] ?? {}) };
  for (const k of ALL_GP_METER_KINDS) {
    m[k] = (m[k] ?? 0) + PATRONAGE_GP_BOOST_PER_METER;
  }
  const civilizations = state.civilizations.map((c, i) =>
    i !== civIndex
      ? c
      : {
          ...c,
          resources: { ...c.resources, gold: c.resources.gold - PATRONAGE_GP_BOOST_COST },
          patronagePoints: c.patronagePoints + 1,
        }
  );
  return addMessage(
    {
      ...state,
      civilizations,
      systems: { ...state.systems, greatPeopleMeter: { ...meters, [civIndex]: m } },
    },
    'Patronage accelerates Great Person attraction across all tracks.',
    'city',
    [civIndex]
  );
}

export function allocateLeaderAttributePoint(
  state: GameState,
  civIndex: number,
  key: LeaderAttributeKey
): GameState {
  const civ = state.civilizations[civIndex];
  if (!civ || !civ.isAlive) return state;
  const leader = state.leaders?.find(l => l.civIndex === civIndex);
  if (!leader) return state;
  if (leader.unspentAttributePoints <= 0) {
    return addMessage(state, 'No unspent leader attribute points.', 'warning', [civIndex]);
  }
  const next = allocateLeaderAttributePointCore(state, civIndex, key);
  if (next === state) return state;
  return addMessage(next, `${leader.displayName} improves ${key}.`, 'info', [civIndex]);
}

// ============================================================
// DECLARE WAR
// ============================================================

export function canDeclareWar(state: GameState, civA: number, civB: number): boolean {
  return canDeclareWarCore(state, civA, civB);
}

/** War or armistice — borders closed, no combat during armistice. */
export function isMilitarilyEngaged(state: GameState, civA: number, civB: number): boolean {
  return isMilitarilyEngagedCore(state, civA, civB);
}

export function getAllies(state: GameState, civIndex: number): number[] {
  return getAlliesCore(state, civIndex);
}

/** Apply war between two civs (normalized pair): relation row + trade route purge for that pair only. */
function applyWarForPair(state: GameState, attacker: number, defender: number): GameState {
  const lo = Math.min(attacker, defender);
  const hi = Math.max(attacker, defender);
  const idx = relationIndex(state.relations, lo, hi);
  let rels = [...state.relations];
  if (idx < 0) {
    rels.push({
      civA: lo,
      civB: hi,
      status: 'war',
      turnsAtWar: 0,
      tradeRoutes: 0,
      peaceLockedUntilTurn: 0,
      armisticeUntilTurn: 0,
        trust: -25,
        grievances: 20,
    });
  } else {
    const cur = rels[idx]!;
    rels[idx] = {
      ...cur,
      civA: Math.min(cur.civA, cur.civB),
      civB: Math.max(cur.civA, cur.civB),
      status: 'war',
      peaceLockedUntilTurn: 0,
      armisticeUntilTurn: 0,
      trust: Math.max(-100, (cur.trust ?? 0) - 22),
      grievances: Math.max(0, (cur.grievances ?? 0) + 16),
    };
  }
  const tradeRoutes = (state.tradeRoutes ?? []).filter(tr => !(tr.civA === lo && tr.civB === hi));
  return syncRelationTradeRouteCounts({
    ...state,
    relations: rels,
    tradeRoutes,
  });
}

export function declareWar(
  state: GameState,
  civA: number,
  civB: number
): GameState {
  const existing = relationPair(state.relations, civA, civB);
  if (existing && state.turn < existing.peaceLockedUntilTurn) {
    return addMessage(
      state,
      `Treaties forbid war until turn ${existing.peaceLockedUntilTurn}.`,
      'warning',
      [civA, civB]
    );
  }
  if (existing?.status === 'armistice' && state.turn < existing.armisticeUntilTurn) {
    return addMessage(state, `Armistice holds until turn ${existing.armisticeUntilTurn}.`, 'warning', [civA, civB]);
  }

  let s = applyWarForPair(state, civA, civB);
  const defender = civB;
  const allies = getAllies(s, defender).filter(i => i !== civA && s.civilizations[i]?.isAlive);
  for (const ally of allies) {
    if (!areAtWar(s, civA, ally)) {
      s = applyWarForPair(s, civA, ally);
    }
  }

  const civAName = civNameSafe(state, civA);
  const civBName = civNameSafe(state, civB);
  return addMessage(s, `⚔️ ${civAName} has declared WAR on ${civBName}!`, 'diplomacy', [civA, civB]);
}

export function makePeace(
  state: GameState,
  civA: number,
  civB: number,
  payments?: DiplomaticSettlementPayments
): GameState {
  if (!bothCivsUnlocked(state, civA, civB, 'advanced_diplomacy')) {
    return addMessage(state, progressionLockReason('advanced_diplomacy'), 'warning', [civA]);
  }
  const lo = Math.min(civA, civB);
  const hi = Math.max(civA, civB);
  const gl = clampSettlementGold(payments?.goldLoPaysHi);
  const gh = clampSettlementGold(payments?.goldHiPaysLo);
  let s = state;
  if (gl > 0 || gh > 0) {
    const tr = applyPairGoldTransfer(s, lo, hi, gl, gh);
    if ('error' in tr) return addMessage(state, tr.error, 'warning', [civA, civB]);
    s = tr.state;
  }
  const rels = s.relations.map(r => {
    if ((r.civA === civA && r.civB === civB) || (r.civA === civB && r.civB === civA)) {
      return {
        ...r,
        status: 'peace' as const,
        turnsAtWar: 0,
        peaceLockedUntilTurn: s.turn + DIPLO_PEACE_LOCK_TURNS,
        armisticeUntilTurn: 0,
        trust: Math.min(100, (r.trust ?? 0) + 12),
        grievances: Math.max(0, (r.grievances ?? 0) - 10),
      };
    }
    return r;
  });
  const newState = { ...s, relations: rels };
  return addMessage(newState, `${civNameSafe(s, civA)} and ${civNameSafe(s, civB)} made PEACE.`, 'diplomacy', [civA, civB]);
}

/** Ceasefire: no combat or border crossing until it expires, then war resumes automatically. */
export function signArmistice(
  state: GameState,
  civA: number,
  civB: number,
  opts?: { durationTurns?: number } & Partial<DiplomaticSettlementPayments>
): GameState {
  if (!bothCivsUnlocked(state, civA, civB, 'advanced_diplomacy')) {
    return addMessage(state, progressionLockReason('advanced_diplomacy'), 'warning', [civA]);
  }
  const r = relationPair(state.relations, civA, civB);
  if (!r || r.status !== 'war') {
    return addMessage(state, 'Armistice requires an active war.', 'warning', [civA, civB]);
  }
  const lo = Math.min(civA, civB);
  const hi = Math.max(civA, civB);
  let s = state;
  const gl = clampSettlementGold(opts?.goldLoPaysHi);
  const gh = clampSettlementGold(opts?.goldHiPaysLo);
  if (gl > 0 || gh > 0) {
    const tr = applyPairGoldTransfer(s, lo, hi, gl, gh);
    if ('error' in tr) return addMessage(state, tr.error, 'warning', [civA, civB]);
    s = tr.state;
  }
  const duration =
    opts?.durationTurns != null
      ? Math.max(ARMISTICE_DURATION_MIN_TURNS, Math.min(ARMISTICE_DURATION_MAX_TURNS, Math.round(opts.durationTurns)))
      : ARMISTICE_DURATION_TURNS;
  const until = s.turn + duration;
  const rels = s.relations.map(rel => {
    if ((rel.civA === civA && rel.civB === civB) || (rel.civA === civB && rel.civB === civA)) {
      return { ...rel, status: 'armistice' as const, armisticeUntilTurn: until };
    }
    return rel;
  });
  const newState = { ...s, relations: rels };
  return addMessage(
    newState,
    `${civNameSafe(s, civA)} and ${civNameSafe(s, civB)} signed an ARMISTICE until turn ${until}.`,
    'diplomacy',
    [civA, civB]
  );
}

function stripOfferById(state: GameState, offerId: number): GameState {
  return {
    ...state,
    diplomaticOffers: (state.diplomaticOffers ?? []).filter(o => o.id !== offerId),
  };
}

function executeAcceptedOffer(state: GameState, offer: DiplomaticOffer): GameState {
  const { pairLo, pairHi, goldLoPaysHi, goldHiPaysLo, kind } = offer;
  const tr = applyPairGoldTransfer(state, pairLo, pairHi, goldLoPaysHi, goldHiPaysLo);
  if ('error' in tr) return addMessage(state, tr.error, 'warning', [pairLo, pairHi]);
  let s = stripOfferById(tr.state, offer.id);
  if (kind === 'peace') {
    return makePeace(s, pairLo, pairHi);
  }
  const dur =
    offer.armisticeTurns != null
      ? Math.max(ARMISTICE_DURATION_MIN_TURNS, Math.min(ARMISTICE_DURATION_MAX_TURNS, Math.round(offer.armisticeTurns)))
      : ARMISTICE_DURATION_TURNS;
  return signArmistice(s, pairLo, pairHi, { durationTurns: dur });
}

function processAiRecipientResponse(state: GameState, offerId: number, depth = 0): GameState {
  const offer = (state.diplomaticOffers ?? []).find(o => o.id === offerId);
  if (depth > 8) {
    return addMessage(
      state,
      'Diplomatic negotiation stalled.',
      'warning',
      offer ? [offer.fromCiv, offer.toCiv] : undefined
    );
  }
  if (!offer) return state;
  if (state.civilizations[offer.toCiv].isHuman) return state;

  const decision = decideAiSettlementResponse(state, offer, offer.toCiv);
  if (decision.action === 'accept') {
    return executeAcceptedOffer(state, offer);
  }
  if (decision.action === 'reject') {
    return rejectDiplomaticOffer(state, offerId, offer.toCiv);
  }
  let s = stripOfferById(state, offerId);
  const nextOfferBase = {
    goldLoPaysHi: clampSettlementGold(decision.goldLoPaysHi),
    goldHiPaysLo: clampSettlementGold(decision.goldHiPaysLo),
    armisticeTurns:
      offer.kind === 'armistice'
        ? Math.max(
            ARMISTICE_DURATION_MIN_TURNS,
            Math.min(ARMISTICE_DURATION_MAX_TURNS, Math.round(decision.armisticeTurns ?? ARMISTICE_DURATION_TURNS))
          )
        : undefined,
  };
  s = proposeDiplomaticSettlementInternal(s, offer.toCiv, offer.fromCiv, offer.kind, nextOfferBase);
  const created = (s.diplomaticOffers ?? []).slice(-1)[0];
  if (created && !s.civilizations[created.toCiv].isHuman) {
    return processAiRecipientResponse(s, created.id, depth + 1);
  }
  return s;
}

function proposeDiplomaticSettlementInternal(
  state: GameState,
  fromCiv: number,
  toCiv: number,
  kind: DiplomaticOffer['kind'],
  terms: DiplomaticSettlementPayments & { armisticeTurns?: number }
): GameState {
  if (fromCiv === toCiv) return state;
  const lo = Math.min(fromCiv, toCiv);
  const hi = Math.max(fromCiv, toCiv);
  if (!bothCivsUnlocked(state, lo, hi, 'advanced_diplomacy')) {
    return addMessage(state, progressionLockReason('advanced_diplomacy'), 'warning', [fromCiv]);
  }
  const rel = relationPair(state.relations, lo, hi);
  const canPeaceOffer = rel?.status === 'war' || rel?.status === 'armistice';
  if (kind === 'peace' && !canPeaceOffer) {
    return addMessage(state, 'Peace talks require war or an active armistice with this civilization.', 'warning', [
      fromCiv,
    ]);
  }
  if (kind === 'armistice' && (!rel || rel.status !== 'war')) {
    return addMessage(state, 'Armistice requires an active war.', 'warning', [fromCiv]);
  }
  const gl = clampSettlementGold(terms.goldLoPaysHi);
  const gh = clampSettlementGold(terms.goldHiPaysLo);
  let armisticeTurns = terms.armisticeTurns;
  if (kind === 'armistice') {
    armisticeTurns = Math.max(
      ARMISTICE_DURATION_MIN_TURNS,
      Math.min(ARMISTICE_DURATION_MAX_TURNS, Math.round(armisticeTurns ?? ARMISTICE_DURATION_TURNS))
    );
  }
  const id = state.nextDiplomaticOfferId ?? 1;
  const offer: DiplomaticOffer = {
    id,
    kind,
    fromCiv,
    toCiv,
    pairLo: lo,
    pairHi: hi,
    goldLoPaysHi: gl,
    goldHiPaysLo: gh,
    ...(kind === 'armistice' ? { armisticeTurns } : {}),
  };
  const filtered = (state.diplomaticOffers ?? []).filter(o => !(o.pairLo === lo && o.pairHi === hi && o.kind === kind));
  let next: GameState = {
    ...state,
    diplomaticOffers: [...filtered, offer],
    nextDiplomaticOfferId: id + 1,
  };
  next = addMessage(
    next,
    `${civNameSafe(state, fromCiv)} proposes ${kind} to ${civNameSafe(state, toCiv)}.`,
    'diplomacy',
    [fromCiv, toCiv]
  );
  if (!next.civilizations[toCiv].isHuman) {
    return processAiRecipientResponse(next, offer.id, 0);
  }
  return next;
}

export function proposeDiplomaticSettlement(
  state: GameState,
  fromCiv: number,
  toCiv: number,
  kind: DiplomaticOffer['kind'],
  terms: DiplomaticSettlementPayments & { armisticeTurns?: number }
): GameState {
  return proposeDiplomaticSettlementInternal(state, fromCiv, toCiv, kind, terms);
}

export function acceptDiplomaticOffer(state: GameState, offerId: number, accepterCiv: number): GameState {
  const offer = (state.diplomaticOffers ?? []).find(o => o.id === offerId);
  if (!offer || offer.toCiv !== accepterCiv) return state;
  return executeAcceptedOffer(state, offer);
}

export function rejectDiplomaticOffer(state: GameState, offerId: number, rejecterCiv: number): GameState {
  const offer = (state.diplomaticOffers ?? []).find(o => o.id === offerId);
  if (!offer || offer.toCiv !== rejecterCiv) return state;
  let s = stripOfferById(state, offerId);
  s = addMessage(
    s,
    `${civNameSafe(state, rejecterCiv)} rejected the ${offer.kind} proposal.`,
    'diplomacy',
    [offer.fromCiv, rejecterCiv]
  );
  return s;
}

export function counterDiplomaticOffer(
  state: GameState,
  offerId: number,
  counterFromCiv: number,
  terms: DiplomaticSettlementPayments & { armisticeTurns?: number }
): GameState {
  const offer = (state.diplomaticOffers ?? []).find(o => o.id === offerId);
  if (!offer || offer.toCiv !== counterFromCiv) return state;
  let s = stripOfferById(state, offerId);
  return proposeDiplomaticSettlementInternal(s, counterFromCiv, offer.fromCiv, offer.kind, terms);
}

export function applyInfluenceDiplomacyAction(
  state: GameState,
  fromCiv: number,
  toCiv: number,
  action: InfluenceActionKind,
  opts?: {
    offerId?: number;
    treatyKind?: 'research' | 'commerce' | 'culture';
    endeavorKind?: 'science' | 'industry' | 'culture';
  }
): GameState {
  if (fromCiv === toCiv) return state;
  const from = state.civilizations[fromCiv];
  const to = state.civilizations[toCiv];
  if (!from?.isAlive || !to?.isAlive) return state;
  const cost = influenceActionCost(action);
  if (!canSpendInfluence(state, fromCiv, cost)) {
    return addMessage(state, 'Not enough influence for this diplomatic action.', 'warning', [fromCiv]);
  }
  let s = spendInfluence(state, fromCiv, cost);
  if (action === 'accept') {
    if (opts?.offerId == null) return state;
    s = acceptDiplomaticOffer(s, Number(opts.offerId), fromCiv);
  } else if (action === 'reject') {
    if (opts?.offerId == null) return state;
    s = rejectDiplomaticOffer(s, Number(opts.offerId), fromCiv);
  } else if (action === 'support') {
    s = {
      ...s,
      relations: s.relations.map(r => {
        if (!((r.civA === fromCiv && r.civB === toCiv) || (r.civA === toCiv && r.civB === fromCiv))) return r;
        return { ...r, trust: Math.min(100, r.trust + 7), grievances: Math.max(0, r.grievances - 3) };
      }),
    };
  } else if (action === 'sanction') {
    s = {
      ...s,
      civilizations: s.civilizations.map((c, i) =>
        i !== toCiv ? c : { ...c, resources: { ...c.resources, gold: Math.max(-100, c.resources.gold - 20) } }
      ),
      relations: s.relations.map(r => {
        if (!((r.civA === fromCiv && r.civB === toCiv) || (r.civA === toCiv && r.civB === fromCiv))) return r;
        return { ...r, trust: Math.max(-100, r.trust - 8), grievances: Math.min(100, r.grievances + 8) };
      }),
      systems: {
        ...s.systems,
        influenceDiplomacy: {
          ...s.systems.influenceDiplomacy,
          sanctions: [
            ...(s.systems.influenceDiplomacy?.sanctions ?? []),
            {
              id: `sanction-${s.turn}-${fromCiv}-${toCiv}`,
              fromCiv,
              toCiv,
              turnsLeft: 12,
              imposedTurn: s.turn,
              severity: 1,
            },
          ],
        },
      },
    };
  } else if (action === 'endeavor') {
    const kind = opts?.endeavorKind ?? 'science';
    s = {
      ...s,
      civilizations: s.civilizations.map((c, i) => {
        if (i !== fromCiv && i !== toCiv) return c;
        if (kind === 'science') {
          return { ...c, resources: { ...c.resources, science: c.resources.science + 6 } };
        }
        if (kind === 'industry') {
          return { ...c, resources: { ...c.resources, production: c.resources.production + 8 } };
        }
        return { ...c, resources: { ...c.resources, culture: c.resources.culture + 6 } };
      }),
      systems: {
        ...s.systems,
        influenceDiplomacy: {
          ...s.systems.influenceDiplomacy,
          endeavors: [
            ...(s.systems.influenceDiplomacy?.endeavors ?? []),
            { id: `endeavor-${s.turn}-${fromCiv}-${toCiv}`, fromCiv, toCiv, turn: s.turn, kind },
          ],
        },
      },
    };
  } else if (action === 'treaty') {
    const tk = opts?.treatyKind ?? 'research';
    s = {
      ...s,
      systems: {
        ...s.systems,
        influenceDiplomacy: {
          ...s.systems.influenceDiplomacy,
          treaties: [
            ...(s.systems.influenceDiplomacy?.treaties ?? []),
            {
              id: `treaty-${s.turn}-${fromCiv}-${toCiv}-${tk}`,
              civA: Math.min(fromCiv, toCiv),
              civB: Math.max(fromCiv, toCiv),
              kind: tk,
              turnsLeft: 20,
              signedTurn: s.turn,
            },
          ],
        },
      },
      relations: s.relations.map(r => {
        if (!((r.civA === fromCiv && r.civB === toCiv) || (r.civA === toCiv && r.civB === fromCiv))) return r;
        return { ...r, trust: Math.min(100, r.trust + 10), grievances: Math.max(0, r.grievances - 4) };
      }),
    };
  }
  s = appendInfluenceActionLog(s, {
    fromCiv,
    toCiv,
    kind: action,
    cost,
    note:
      action === 'accept' || action === 'reject'
        ? `offer:${String(opts?.offerId ?? '')}`
        : action === 'treaty'
          ? `treaty:${String(opts?.treatyKind ?? 'research')}`
          : action === 'endeavor'
            ? `endeavor:${String(opts?.endeavorKind ?? 'science')}`
            : undefined,
  });
  return addMessage(
    s,
    `${civNameSafe(state, fromCiv)} uses influence action ${action} toward ${civNameSafe(state, toCiv)}.`,
    'diplomacy',
    [fromCiv, toCiv]
  );
}

export function applyIndependentPowerAction(
  state: GameState,
  actorCiv: number,
  powerId: number,
  action: 'incite_raid' | 'levy' | 'upgrade_city_state',
  opts?: { targetCiv?: number }
): GameState {
  const actor = state.civilizations[actorCiv];
  if (!actor?.isAlive) return state;
  const power = state.systems.independentPowers.find(p => p.id === powerId);
  if (!power) return state;
  const cost = getIndependentActionCost(action);
  if (!canSpendInfluence(state, actorCiv, cost)) {
    return addMessage(state, 'Not enough influence for independent power action.', 'warning', [actorCiv]);
  }
  let s = spendInfluence(state, actorCiv, cost);
  if (action === 'incite_raid') {
    const targetCiv = opts?.targetCiv;
    if (targetCiv == null || targetCiv === actorCiv || !s.civilizations[targetCiv]?.isAlive) return state;
    s = {
      ...s,
      systems: {
        ...s.systems,
        independentPowers: s.systems.independentPowers.map(p =>
          p.id !== powerId
            ? p
            : {
                ...p,
                raidTargetCiv: targetCiv,
                raidTurnsLeft: 8,
                strength: Math.min(140, p.strength + 8),
                relations: { ...p.relations, [targetCiv]: 'hostile' },
              }
        ),
      },
    };
  } else if (action === 'levy') {
    s = {
      ...s,
      systems: {
        ...s.systems,
        independentPowers: s.systems.independentPowers.map(p =>
          p.id !== powerId
            ? p
            : {
                ...p,
                leviedByCiv: actorCiv,
                leviedTurnsLeft: 12,
                relations: { ...p.relations, [actorCiv]: 'friendly' },
              }
        ),
      },
      civilizations: s.civilizations.map((c, i) =>
        i !== actorCiv
          ? c
          : {
              ...c,
              resources: {
                ...c.resources,
                production: c.resources.production + 18,
                gold: Math.max(-100, c.resources.gold - 10),
              },
            }
      ),
    };
  } else {
    s = {
      ...s,
      systems: {
        ...s.systems,
        independentPowers: s.systems.independentPowers.map(p =>
          p.id !== powerId
            ? p
            : {
                ...p,
                tier: 'city_state',
                influenceProgress: Math.max(p.influenceProgress, 70),
                relations: { ...p.relations, [actorCiv]: 'friendly' },
                raidTargetCiv: null,
                raidTurnsLeft: 0,
              }
        ),
      },
      civilizations: s.civilizations.map((c, i) =>
        i !== actorCiv ? c : { ...c, diplomaticVictoryPoints: c.diplomaticVictoryPoints + 1 }
      ),
    };
  }
  s = appendInfluenceActionLog(s, {
    fromCiv: actorCiv,
    toCiv: opts?.targetCiv ?? actorCiv,
    kind: 'independent',
    cost,
    note: `${action}:power-${powerId}`,
  });
  const relatedIndPow =
    action === 'incite_raid' && opts?.targetCiv != null ? [actorCiv, opts.targetCiv] : [actorCiv];
  return addMessage(
    s,
    `${civNameSafe(state, actorCiv)} performs ${action} with ${power.name}.`,
    'diplomacy',
    relatedIndPow
  );
}

export function appointUnitCommander(state: GameState, civIndex: number, unitId: number): GameState {
  const before = state.systems.commanders.length;
  const s = appointCommander(state, civIndex, unitId);
  if (s.systems.commanders.length === before) return state;
  const u = s.units.find(x => x.id === unitId);
  return addMessage(s, `${civNameSafe(s, civIndex)} appoints ${u?.name ?? 'unit'} as commander.`, 'diplomacy', [
    civIndex,
  ]);
}

export function assignUnitCommander(state: GameState, civIndex: number, commanderId: string, unitId: number): GameState {
  const s = assignUnitToCommander(state, civIndex, commanderId, unitId);
  if (s === state) return state;
  const cmd = s.systems.commanders.find(c => c.id === commanderId);
  const u = s.units.find(x => x.id === unitId);
  if (!cmd || !u) return state;
  return addMessage(s, `${u.name} assigned to commander ${cmd.id}.`, 'diplomacy', [civIndex]);
}

export function unassignUnitCommander(state: GameState, civIndex: number, unitId: number): GameState {
  const current = commanderForUnit(state, unitId);
  if (!current || current.ownerCiv !== civIndex || current.unitId === unitId) return state;
  const s = unassignUnitFromCommander(state, civIndex, unitId);
  const u = s.units.find(x => x.id === unitId);
  return addMessage(s, `${u?.name ?? 'Unit'} removed from command group.`, 'diplomacy', [civIndex]);
}

export function activateCommander(state: GameState, civIndex: number, commanderId: string): GameState {
  const commander = state.systems.commanders.find(c => c.id === commanderId && c.ownerCiv === civIndex);
  if (!commander || commander.cooldownTurnsLeft > 0 || commander.activeTurnsLeft > 0) return state;
  const s = activateCommanderAbility(state, civIndex, commanderId);
  return addMessage(s, `${civNameSafe(s, civIndex)} activates commander ability ${commanderId}.`, 'diplomacy', [
    civIndex,
  ]);
}

export function chooseLegacyPathOption(
  state: GameState,
  civIndex: number,
  path: LegacyPathType,
  choice: 'golden_age' | 'dark_age'
): GameState {
  return chooseLegacyOption(state, civIndex, path, choice);
}

export function setCrisisPolicy(
  state: GameState,
  civIndex: number,
  policy: CrisisPolicyType
): GameState {
  return chooseCrisisPolicy(state, civIndex, policy);
}

export function deferLegacyPrompt(state: GameState, civIndex: number): GameState {
  return snoozeLegacyPrompt(state, civIndex);
}

export function deferCrisisPolicyPrompt(state: GameState, civIndex: number): GameState {
  return snoozeCrisisPolicyPrompt(state, civIndex);
}

export function formAlliance(state: GameState, civA: number, civB: number): GameState {
  if (civA === civB) return state;
  if (!bothCivsUnlocked(state, civA, civB, 'alliances')) {
    return addMessage(state, progressionLockReason('alliances'), 'warning', [civA]);
  }
  if (areAtWar(state, civA, civB) || isMilitarilyEngaged(state, civA, civB)) {
    return addMessage(state, 'Cannot ally while at war or under armistice.', 'warning', [civA, civB]);
  }
  const ca = state.civilizations[civA];
  const cb = state.civilizations[civB];
  if (!ca?.isAlive || !cb?.isAlive) return state;
  if (
    ca.diplomaticFavor < ALLIANCE_MIN_DIPLOMATIC_FAVOR ||
    cb.diplomaticFavor < ALLIANCE_MIN_DIPLOMATIC_FAVOR
  ) {
    return addMessage(
      state,
      `Alliance needs at least ${ALLIANCE_MIN_DIPLOMATIC_FAVOR} diplomatic favor on both sides.`,
      'warning',
      [civA, civB]
    );
  }
  const lo = Math.min(civA, civB);
  const hi = Math.max(civA, civB);
  const idx = relationIndex(state.relations, lo, hi);
  let rels: DiplomaticRelation[];
  if (idx < 0) {
    rels = [
      ...state.relations,
      {
        civA: lo,
        civB: hi,
        status: 'alliance',
        turnsAtWar: 0,
        tradeRoutes: 0,
        peaceLockedUntilTurn: 0,
        armisticeUntilTurn: 0,
        trust: 30,
        grievances: 0,
      },
    ];
  } else {
    rels = state.relations.map(rel => {
      if ((rel.civA === lo && rel.civB === hi) || (rel.civA === hi && rel.civB === lo)) {
        return {
          ...rel,
          civA: lo,
          civB: hi,
          status: 'alliance' as const,
          turnsAtWar: 0,
          armisticeUntilTurn: 0,
          trust: Math.min(100, (rel.trust ?? 0) + 25),
          grievances: Math.max(0, (rel.grievances ?? 0) - 20),
        };
      }
      return rel;
    });
  }
  const newState = { ...state, relations: rels };
  return addMessage(
    newState,
    `${ca.name} and ${cb.name} formed a military ALLIANCE.`,
    'diplomacy',
    [civA, civB]
  );
}

export function leaveAlliance(state: GameState, civA: number, civB: number): GameState {
  const r = relationPair(state.relations, civA, civB);
  if (!r || r.status !== 'alliance') {
    return addMessage(state, 'No alliance to leave.', 'warning', [civA, civB]);
  }
  const rels = state.relations.map(rel => {
    if ((rel.civA === civA && rel.civB === civB) || (rel.civA === civB && rel.civB === civA)) {
      return { ...rel, status: 'peace' as const, armisticeUntilTurn: 0 };
    }
    return rel;
  });
  return addMessage(
    { ...state, relations: rels },
    `${civNameSafe(state, civA)} and ${civNameSafe(state, civB)} ended their alliance.`,
    'diplomacy',
    [civA, civB]
  );
}

/** Peaceful trade route (+gold/turn via `processTurn`); capitals must be within range. */
export function addTradeRoute(
  state: GameState,
  civA: number,
  civB: number,
  options?: {
    goldPerTurn?: number;
    risk?: number;
    lotsAtoB?: TradeLot[];
    lotsBtoA?: TradeLot[];
    merchantUnitId?: number;
  }
): GameState {
  if (!bothCivsUnlocked(state, civA, civB, 'trade_routes')) {
    return addMessage(state, progressionLockReason('trade_routes'), 'warning', [civA]);
  }
  const reason = getTradeRouteBlockReason(state, civA, civB);
  if (reason) {
    return addMessage(state, reason, 'warning', [civA, civB]);
  }
  const lo = Math.min(civA, civB);
  const hi = Math.max(civA, civB);
  const merchant = options?.merchantUnitId == null
    ? null
    : state.units.find(u => u.id === options.merchantUnitId && u.owner === lo);
  if (!merchant || merchant.type !== 'great_merchant') {
    return addMessage(state, 'Trade route creation requires a Great Merchant.', 'warning', [civA, civB]);
  }
  if (merchant.movement <= 0) return addMessage(state, 'Great Merchant has no movement left.', 'warning', [lo]);
  const fromCity = getCapitalCity(state, lo)!;
  const toCity = getCapitalCity(state, hi)!;
  if (hexDistance(merchant.q, merchant.r, fromCity.q, fromCity.r) > 3) {
    return addMessage(state, 'Great Merchant must be near your capital to found a route.', 'warning', [lo]);
  }
  const netPath = findTradeNetworkPath(state, lo, hi);
  if (!netPath || netPath.length < 2) {
    return addMessage(state, 'No viable trade network path between capitals.', 'warning', [lo, hi]);
  }
  const popBonus = Math.min(4, Math.floor((fromCity.population + toCity.population) / 15));
  const baseGoldPerTurn = TRADE_ROUTE_GOLD_BASE + popBonus;
  const goldPerTurn = Math.max(1, Math.min(16, Math.round(options?.goldPerTurn ?? baseGoldPerTurn)));
  const routeRisk =
    options?.risk != null
      ? Math.max(0.02, Math.min(0.9, Number(options.risk)))
      : 0.08 + Math.min(0.35, hexDistance(fromCity.q, fromCity.r, toCity.q, toCity.r) / 60);
  const id = state.nextTradeRouteId ?? 1;
  const route: TradeRoute = {
    id,
    civA: lo,
    civB: hi,
    fromCityId: fromCity.id,
    toCityId: toCity.id,
    goldPerTurn,
    turnsEstablished: 0,
    risk: routeRisk,
    lotsAtoB: sanitizeTradeLots(options?.lotsAtoB),
    lotsBtoA: sanitizeTradeLots(options?.lotsBtoA),
  };
  let next: GameState = {
    ...state,
    tradeRoutes: [...(state.tradeRoutes ?? []), route],
    nextTradeRouteId: id + 1,
    units: state.units.map(u => (u.id === merchant.id ? { ...u, movement: 0 } : u)),
  };
  next = applyAutoRoadGeneration(next, route);
  const lotsSettlement = settleTradeLotsByCivOrder(next, lo, hi, route.lotsAtoB ?? [], route.lotsBtoA ?? []);
  if (!lotsSettlement.ok) return addMessage(state, lotsSettlement.error, 'warning', [lo, hi]);
  next = lotsSettlement.state;
  return addMessage(
    syncRelationTradeRouteCounts(next),
    `Trade route (+${goldPerTurn} gold/turn each) between ${civNameSafe(state, lo)} and ${civNameSafe(state, hi)}.`,
    'diplomacy',
    [lo, hi]
  );
}

export function signTradeAgreement(
  state: GameState,
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
): GameState {
  if (civA === civB) return state;
  if (!bothCivsUnlocked(state, civA, civB, 'diplomatic_deals')) {
    return addMessage(state, progressionLockReason('diplomatic_deals'), 'warning', [civA]);
  }
  if (areAtWar(state, civA, civB) || isMilitarilyEngaged(state, civA, civB)) {
    return addMessage(state, 'Trade agreement requires peace.', 'warning', [civA, civB]);
  }
  const lo = Math.min(civA, civB);
  const hi = Math.max(civA, civB);
  const rel = relationPair(state.relations, lo, hi);
  const trust = rel?.trust ?? 0;
  const grievances = rel?.grievances ?? 0;
  const base = 3;
  const bonus = Math.max(0, Math.floor(trust / 25));
  const malus = Math.max(0, Math.floor(grievances / 30));
  const yieldPerTurn = Math.max(1, base + bonus - malus);
  const gA = Math.max(0, Math.min(20, Math.round(options?.goldPerTurnAtoB ?? yieldPerTurn)));
  const gB = Math.max(0, Math.min(20, Math.round(options?.goldPerTurnBtoA ?? yieldPerTurn)));
  const turnsLeft = Math.max(5, Math.min(60, Math.round(options?.turnsLeft ?? 25)));
  const id = state.nextTradeAgreementId ?? 1;
  const ag: TradeAgreement = {
    id,
    civA: lo,
    civB: hi,
    goldPerTurnAtoB: gA,
    goldPerTurnBtoA: gB,
    turnsLeft,
    transferAtoB: options?.transferAtoB,
    transferBtoA: options?.transferBtoA,
    lotsAtoB: sanitizeTradeLots(options?.lotsAtoB),
    lotsBtoA: sanitizeTradeLots(options?.lotsBtoA),
  };
  const relations = state.relations.map(r => {
    if ((r.civA === lo && r.civB === hi) || (r.civA === hi && r.civB === lo)) {
      return {
        ...r,
        trust: Math.min(100, (r.trust ?? 0) + 8),
        grievances: Math.max(0, (r.grievances ?? 0) - 6),
      };
    }
    return r;
  });
  let nextState: GameState = {
    ...state,
    relations,
    tradeAgreements: [...(state.tradeAgreements ?? []), ag],
    nextTradeAgreementId: id + 1,
  };
  const lotsSettlement = settleTradeLotsByCivOrder(nextState, lo, hi, ag.lotsAtoB ?? [], ag.lotsBtoA ?? []);
  if (!lotsSettlement.ok) return addMessage(state, lotsSettlement.error, 'warning', [lo, hi]);
  nextState = lotsSettlement.state;
  return addMessage(
    nextState,
    `Trade agreement signed between ${civNameSafe(state, lo)} and ${civNameSafe(state, hi)}.`,
    'diplomacy',
    [lo, hi]
  );
}

export function cancelTradeRoute(state: GameState, routeId: number, requesterCiv?: number): GameState {
  const routes = state.tradeRoutes ?? [];
  const route = routes.find(r => r.id === routeId);
  if (!route) return state;
  if (requesterCiv != null && requesterCiv !== route.civA && requesterCiv !== route.civB) return state;
  const next = syncRelationTradeRouteCounts({
    ...state,
    tradeRoutes: routes.filter(r => r.id !== routeId),
  });
  return addMessage(next, `Trade route #${routeId} has been cancelled.`, 'diplomacy', [
    route.civA,
    route.civB,
  ]);
}

export function cancelTradeAgreement(state: GameState, agreementId: number, requesterCiv?: number): GameState {
  const agreements = state.tradeAgreements ?? [];
  const ag = agreements.find(a => a.id === agreementId);
  if (!ag) return state;
  if (requesterCiv != null && requesterCiv !== ag.civA && requesterCiv !== ag.civB) return state;
  return addMessage(
    {
      ...state,
      tradeAgreements: agreements.filter(a => a.id !== agreementId),
    },
    `Trade agreement #${agreementId} has been cancelled.`,
    'diplomacy',
    [ag.civA, ag.civB]
  );
}

/** Recompute territory and per-city worked tiles + yields after a tile change (e.g. worker improvement). */
export function rebuildEconomyAfterTileChange(state: GameState): GameState {
  // This function affects global territory and worked tiles; clone all rows intentionally.
  const tiles = state.tiles.map(row => row.map(t => ({ ...t })));
  const cities = state.cities.map(c => normalizeSettlement({ ...c, workedTiles: [...c.workedTiles] }));
  const next: GameState = { ...state, tiles, cities };
  recomputeTileTerritory(next);
  for (const c of next.cities) {
    const basePenalty = settlementSoftCapPenalty(next, c.owner);
    const penalty = c.settlementKind === 'capital' ? basePenalty * 0.5 : basePenalty;
    c.settlementSoftCapPenalty = penalty;
    assignWorkedTiles(c, next.tiles, next.cities);
    c.yields = calcCityYields(c, next.tiles);
  }
  return {
    ...next,
    cities: next.cities.map(c => ({ ...c, workedTiles: [...c.workedTiles], yields: { ...c.yields } })),
  };
}

export function listValidWorkerImprovements(state: GameState, unitId: number): ImprovementType[] {
  const u = state.units.find(x => x.id === unitId);
  if (!u || u.type !== 'worker' || u.movement <= 0) return [];
  return listLegalWorkerImprovementsAt(state, u.owner, u.q, u.r);
}

export function buildImprovement(state: GameState, unitId: number, imp: ImprovementType): GameState {
  const u = state.units.find(x => x.id === unitId);
  if (!u || u.type !== 'worker') {
    return addMessage(state, 'Only workers can build tile improvements.', 'warning', u ? [u.owner] : undefined);
  }
  if (u.movement <= 0) {
    return addMessage(state, 'This worker has no moves left this turn.', 'warning', [u.owner]);
  }
  const err = workerImprovementValidationError(state, u.owner, imp, u.q, u.r);
  if (err) {
    return addMessage(state, `Cannot build: ${err}`, 'warning', [u.owner]);
  }
  const tiles = state.tiles.map(row => row.map(tile => ({ ...tile })));
  tiles[u.r][u.q] = { ...tiles[u.r][u.q], improvement: imp };
  const buildsLeft = Math.max(0, (u.workerBuildsRemaining ?? WORKER_MAX_BUILDS) - 1);
  let units = state.units.map(unit =>
    unit.id === unitId ? { ...unit, movement: 0, workerBuildsRemaining: buildsLeft } : unit
  );
  let civilizations = state.civilizations;
  if (buildsLeft <= 0) {
    units = units.filter(unit => unit.id !== unitId);
    civilizations = civilizations.map((c, i) =>
      i !== u.owner ? c : { ...c, units: c.units.filter(id => id !== unitId) }
    );
  }
  const civName = state.civilizations[u.owner]?.name ?? 'Civ';
  let next: GameState = addMessage(
    { ...state, tiles, units, civilizations },
    `${civName} built a ${imp.replace(/_/g, ' ')}.`,
    'city',
    [u.owner]
  );
  next = rebuildEconomyAfterTileChange(next);
  if (buildsLeft <= 0) {
    next = addMessage(next, `${civName} Worker has completed its final build and disbanded.`, 'city', [u.owner]);
  }
  return next;
}

export function areAtWar(state: GameState, civA: number, civB: number): boolean {
  return areAtWarCore(state, civA, civB);
}

// ============================================================
// ERA CALCULATION
// ============================================================

 

// ============================================================
// MULTIPLAYER HOTSEAT (2+ mpHumanSlots)
// ============================================================

export function isMpHotseatSettings(_settings: GameSettings): boolean {
  return false;
}

export function initializeMpHotseatIfNeeded(state: GameState): GameState {
  return state;
}

export function resolveTurnEnd(state: GameState, opts?: ProcessTurnOptions): GameState {
  return resolveTurnEndOrchestrated(state, opts, {
    processTurn,
    createAIEngineAPI,
    runAITurn: (s, i, api) => runAITurn(s, i, api as AIEngineAPI),
    updateVision,
    assignWorkedTiles,
    calcCityYields,
    recomputeTileTerritory,
  });
}

// ============================================================
// END TURN PROCESSING
// ============================================================
export function processTurn(state: GameState, opts?: ProcessTurnOptions): GameState {
  let s = pruneInvalidTradeRoutes(handleArmisticeExpiry({ ...state }));
  s = autoAllocateLeaderAttributesForAi(s);
  s = tickIndependentPowers(s);
  s = tickCommanders(s);
  s = tickGeographyProgress(s);
  s = tickLegacyCrisis(s);
  const visionCivIndex = opts?.visionCivIndex ?? 0;
  const weatherGoldMult = WEATHER_GOLD_MULT[(state.world ?? DEFAULT_WORLD).weather] ?? 1;

  const cityById = new Map(s.cities.map(c => [c.id, c] as const));
  const unitById = new Map(s.units.map(u => [u.id, u] as const));

  // Process each civilization
  s = {
    ...s,
    civilizations: s.civilizations.map((civ, civIndex) => {
      if (!civ.isAlive) return civ;

      let totalFood = 0, totalProduction = 0, totalGold = 0;
      let totalScience = 0, totalCulture = 0, totalFaith = 0;
      let totalHappiness = 0;

      // Sum yields from cities
      for (const cityId of civ.cities) {
        const city = cityById.get(cityId);
        if (!city) continue;
        const y = city.yields;
        totalFood += y.food;
        totalProduction += y.production;
        totalGold += y.gold;
        totalScience += y.science;
        totalCulture += y.culture;
        totalFaith += y.faith;
        totalHappiness += calcCityHappiness(s, city);
      }

      // Subtract unit maintenance
      for (const unitId of civ.units) {
        const unit = unitById.get(unitId);
        if (!unit) continue;
        const def = UNITS[unit.type];
        if (def) totalGold -= def.maintenanceCost;
      }

      // Subtract building maintenance
      for (const cityId of civ.cities) {
        const city = cityById.get(cityId);
        if (!city) continue;
        for (const bId of city.buildings) {
          const b = BUILDINGS[bId];
          if (b) totalGold -= b.maintenanceCost;
        }
      }

      totalGold += effectiveTradeGoldForCiv(s, civIndex);
      for (const ag of s.tradeAgreements ?? []) {
        if (ag.turnsLeft <= 0) continue;
        if (ag.civA === civIndex) {
          totalGold += ag.goldPerTurnBtoA - ag.goldPerTurnAtoB;
          totalFood += (ag.transferBtoA?.food ?? 0) - (ag.transferAtoB?.food ?? 0);
          totalScience += (ag.transferBtoA?.science ?? 0) - (ag.transferAtoB?.science ?? 0);
          totalCulture += (ag.transferBtoA?.culture ?? 0) - (ag.transferAtoB?.culture ?? 0);
          totalFaith += (ag.transferBtoA?.faith ?? 0) - (ag.transferAtoB?.faith ?? 0);
          totalHappiness += (ag.transferBtoA?.happiness ?? 0) - (ag.transferAtoB?.happiness ?? 0);
        } else if (ag.civB === civIndex) {
          totalGold += ag.goldPerTurnAtoB - ag.goldPerTurnBtoA;
          totalFood += (ag.transferAtoB?.food ?? 0) - (ag.transferBtoA?.food ?? 0);
          totalScience += (ag.transferAtoB?.science ?? 0) - (ag.transferBtoA?.science ?? 0);
          totalCulture += (ag.transferAtoB?.culture ?? 0) - (ag.transferBtoA?.culture ?? 0);
          totalFaith += (ag.transferAtoB?.faith ?? 0) - (ag.transferBtoA?.faith ?? 0);
          totalHappiness += (ag.transferAtoB?.happiness ?? 0) - (ag.transferBtoA?.happiness ?? 0);
        }
      }

      const inc = {
        food: totalFood,
        gold: totalGold,
        science: totalScience,
        culture: totalCulture,
        faith: totalFaith,
        happiness: totalHappiness,
      };
      applyWonderIncomeModifiers(s, civIndex, inc);
      const gpY = governmentAndPolicyYields(civ);
      const leaderY = leaderYieldBonuses(s, civIndex);
      inc.science += gpY.science ?? 0;
      inc.culture += gpY.culture ?? 0;
      inc.gold += gpY.gold ?? 0;
      inc.faith += gpY.faith ?? 0;
      inc.happiness += gpY.happiness ?? 0;
      totalProduction += gpY.production ?? 0;
      inc.science += leaderY.science ?? 0;
      inc.culture += leaderY.culture ?? 0;
      inc.gold += leaderY.gold ?? 0;
      inc.faith += leaderY.faith ?? 0;
      inc.happiness += leaderY.happiness ?? 0;
      totalProduction += leaderY.production ?? 0;
      const activeSanctions = (s.systems.influenceDiplomacy?.sanctions ?? []).filter(
        x => x.toCiv === civIndex && x.turnsLeft > 0
      );
      if (activeSanctions.length > 0) {
        const mult = Math.max(0.65, 1 - activeSanctions.length * 0.1);
        inc.gold = Math.floor(inc.gold * mult);
        inc.science = Math.floor(inc.science * (mult + 0.05));
      }
      const activeTreaties = (s.systems.influenceDiplomacy?.treaties ?? []).filter(
        x => (x.civA === civIndex || x.civB === civIndex) && x.turnsLeft > 0
      );
      for (const tr of activeTreaties) {
        if (tr.kind === 'research') inc.science += 2;
        else if (tr.kind === 'commerce') inc.gold += 2;
        else inc.culture += 2;
      }
      const legacyCrisis = applyLegacyAndCrisisIncomeModifiers(s, civIndex, inc, totalProduction);
      totalProduction = legacyCrisis.production;
      inc.food = legacyCrisis.inc.food;
      inc.gold = legacyCrisis.inc.gold;
      inc.science = legacyCrisis.inc.science;
      inc.culture = legacyCrisis.inc.culture;
      inc.faith = legacyCrisis.inc.faith;
      inc.happiness = legacyCrisis.inc.happiness;
      const resourceSlots = applyResourceSlotModifiers(s, civIndex, inc, totalProduction);
      totalProduction = resourceSlots.production;
      inc.food = resourceSlots.inc.food;
      inc.gold = resourceSlots.inc.gold;
      inc.science = resourceSlots.inc.science;
      inc.culture = resourceSlots.inc.culture;
      inc.faith = resourceSlots.inc.faith;
      inc.happiness = resourceSlots.inc.happiness;
      totalFood = inc.food;
      totalGold = inc.gold;
      totalScience = inc.science;
      totalCulture = inc.culture;
      totalFaith = inc.faith;
      totalHappiness = inc.happiness;
      const tpl = getCivTemplateByName(civ.name);
      const lb = tpl?.bonuses;
      if (lb) {
        totalFood = Math.round(totalFood * (1 + (lb.foodPct ?? 0) / 100));
        totalProduction = Math.round(totalProduction * (1 + (lb.productionPct ?? 0) / 100));
        totalGold = Math.round(totalGold * (1 + (lb.goldPct ?? 0) / 100));
        totalScience = Math.round(totalScience * (1 + (lb.sciencePct ?? 0) / 100));
        totalCulture = Math.round(totalCulture * (1 + (lb.culturePct ?? 0) / 100));
        totalFaith = Math.round(totalFaith * (1 + (lb.faithPct ?? 0) / 100));
        totalHappiness = Math.round(totalHappiness * (1 + (lb.happinessPct ?? 0) / 100));
      }

      if (totalHappiness < -12) {
        totalFood = Math.floor(totalFood * 0.88);
        totalScience = Math.floor(totalScience * 0.9);
      }

      totalGold = Math.round(totalGold * weatherGoldMult);

      let dipFav = civ.diplomaticFavor + relationFavorDeltaForCiv(s, civIndex);
      dipFav += lb?.diplomaticFavorFlat ?? 0;

      const atPeaceAll = atPeaceWithAllAlive(s, civIndex);
      const nextPeaceTurns = atPeaceAll ? civ.consecutivePeaceTurns + 1 : 0;
      let dvp = civ.diplomaticVictoryPoints;
      if (atPeaceAll && nextPeaceTurns > 0 && nextPeaceTurns % 10 === 0) dvp += 1;

      const oldTechs = civ.researchedTechs;
      // Research progress
      let newResearchProgress = civ.researchProgress + totalScience;
      let newResearchedTechs = [...civ.researchedTechs];
      let currentResearch = civ.currentResearch;
      let civicProgress = (civ.civicProgress ?? 0) + totalCulture;
      let researchedCivics = [...(civ.researchedCivics ?? ['code_of_laws'])];
      let currentCivic = civ.currentCivic;

      if (currentResearch) {
        const tech = TECHNOLOGIES[currentResearch];
        if (tech && newResearchProgress >= tech.cost) {
          newResearchedTechs.push(currentResearch);
          newResearchProgress = 0;
          currentResearch = null;
        }
      }
      if (currentCivic) {
        const civic = CIVICS[currentCivic];
        if (civic && civicProgress >= civic.cost) {
          if (currentCivic === 'future_society') {
            civicProgress = 0;
            // Keep it active as a repeatable late-game sink.
            currentCivic = 'future_society';
            dipFav += 1;
          } else {
            if (!researchedCivics.includes(currentCivic)) researchedCivics.push(currentCivic);
            civicProgress = 0;
            currentCivic = null;
          }
        }
      }
      if (!currentCivic) {
        const availableCivic = Object.values(CIVICS)
          .filter(c => c.id === 'future_society' || !researchedCivics.includes(c.id))
          .find(c => c.prerequisites.every(p => researchedCivics.includes(p)));
        if (availableCivic) currentCivic = availableCivic.id;
      }

      const newlyResearched = newResearchedTechs.filter(t => !oldTechs.includes(t));
      if (newlyResearched.includes('seasteads')) dvp += 1;

      // Era update
      const newEra = calcEra(newResearchedTechs);

      const wonderCount = wonderCountFor(s, civIndex);
      const districtish = districtishBuildingCount(s.cities, civIndex);
      const foreignReligionCities = foreignReligionCityCount(s, civIndex);

      const score =
        civ.cities.length * 10 +
        Math.floor(civ.units.length * 0.5) +
        newResearchedTechs.length * 3 +
        wonderCount * 15 +
        civ.greatPeopleEarned * 5 +
        Math.floor(districtish * 0.4) +
        foreignReligionCities * 2;

      const lifetimeCulture = (civ.lifetimeCulture ?? 0) + Math.max(0, totalCulture);

      const cityCount = civ.cities.length;
      const industryBuildings = cityIndustryBuildingCount(s.cities, civIndex);
      const reserveCap = productionReserveCap(cityCount, industryBuildings);
      const reserveGain = productionReserveGainPerTurn(totalProduction, cityCount, industryBuildings);
      const nextReserve = Math.min(
        reserveCap,
        Math.max(0, (civ.resources.production ?? 0) + reserveGain)
      );

      return {
        ...civ,
        resources: {
          food: Math.max(0, (civ.resources.food || 0) + totalFood),
          production: nextReserve,
          gold: Math.max(-100, (civ.resources.gold || 0) + totalGold),
          science: totalScience,
          culture: totalCulture,
          faith: totalFaith,
          happiness: totalHappiness,
        },
        lastTurnIncome: {
          food: totalFood,
          production: reserveGain,
          gold: totalGold,
          science: totalScience,
          culture: totalCulture,
          faith: totalFaith,
          happiness: totalHappiness,
        },
        researchProgress: newResearchProgress,
        researchedTechs: newResearchedTechs,
        currentResearch,
        researchedCivics,
        currentCivic,
        civicProgress,
        era: newEra,
        score,
        lifetimeCulture,
        diplomaticFavor: dipFav,
        diplomaticVictoryPoints: dvp,
        consecutivePeaceTurns: nextPeaceTurns,
      };
    }),
  };
  s = tickInfluenceEconomy(s);

  // Process cities
  const unitCompletions: Array<{
    owner: number; q: number; r: number; unitType: UnitType; cityId: number;
  }> = [];
  const wonderCompletions: Array<{ owner: number; cityId: number; wonderId: WonderId }> = [];

  const newCities = s.cities.map(rawCity => {
    const city = normalizeSettlement(rawCity);
    const civ = s.civilizations[city.owner];
    if (!civ || !civ.isAlive) return city;

    const baseSoftCapPenalty = settlementSoftCapPenalty(s, city.owner);
    const softCapPenalty = city.settlementKind === 'capital' ? baseSoftCapPenalty * 0.5 : baseSoftCapPenalty;
    const cityForYields = { ...city, settlementSoftCapPenalty: softCapPenalty };
    let y = calcCityYields(cityForYields, s.tiles);
    let newFood = city.food + y.food - city.population;
    let newPop = city.population;
    let newFoodNeeded = city.foodNeeded;
    let pendingGrowthEvent = city.pendingGrowthEvent ?? null;
    let grewThisTurn = false;

    const housingPre = calcCityHousing(city);
    // Population growth (housing-limited)
    if (newFood >= city.foodNeeded && newPop < housingPre) {
      newPop++;
      newFood = 0;
      newFoodNeeded = Math.floor(15 + newPop * 8);
      grewThisTurn = true;
    } else if (newFood >= city.foodNeeded && newPop >= housingPre) {
      newFood = Math.min(newFood, city.foodNeeded - 1);
    } else if (newFood < 0) {
      newFood = 0;
    }
    if (grewThisTurn && !pendingGrowthEvent) {
      pendingGrowthEvent = createGrowthEvent({ ...cityForYields, population: newPop }, s.turn, s.tiles);
    }

    // City defense recovery
    const newHp = Math.min(city.maxHp, city.hp + 20);

    // Production queue
    let newQueue = [...city.productionQueue];
    if (newQueue.length > 0) {
      const item = { ...newQueue[0], progress: newQueue[0].progress + y.production };
      if (item.progress >= item.cost) {
        newQueue = newQueue.slice(1);
        if (item.type === 'building') {
          const already = city.buildings.includes(item.id as BuildingType);
          if (!already) {
            const nb = [...city.buildings, item.id as BuildingType];
            const c2 = { ...cityForYields, buildings: nb };
            const housing = calcCityHousing(c2);
            let amenities = 0;
            for (const b of nb) amenities += BUILDINGS[b]?.amenities ?? 0;
            const capId = s.civilizations[city.owner]?.capital;
            const cap = capId != null ? s.cities.find(ct => ct.id === capId) : null;
            let loyalty = city.loyalty;
            if (cap) loyalty += Math.max(-6, 10 - hexDistance(city.q, city.r, cap.q, cap.r));
            loyalty += (amenities - 4) * 1.1;
            loyalty = Math.max(0, Math.min(100, loyalty));
            let y2 = calcCityYields(c2, s.tiles);
            if (loyalty < 28) {
              y2 = {
                ...y2,
                production: Math.floor(y2.production * 0.82),
                science: Math.floor(y2.science * 0.88),
              };
            }
            return {
              ...cityForYields,
              food: newFood,
              population: newPop,
              foodNeeded: newFoodNeeded,
              hp: newHp,
              yields: y2,
              productionQueue: newQueue,
              buildings: nb,
              housing,
              amenities,
              loyalty,
              pendingGrowthEvent,
            };
          }
        } else if (item.type === 'unit') {
          unitCompletions.push({
            cityId: city.id,
            owner: city.owner,
            q: city.q,
            r: city.r,
            unitType: item.id as UnitType,
          });
        } else if (item.type === 'wonder' && isWonderAvailable(s, item.id as WonderId)) {
          wonderCompletions.push({
            cityId: city.id,
            owner: city.owner,
            wonderId: item.id as WonderId,
          });
          return {
            ...cityForYields,
            food: newFood,
            population: newPop,
            foodNeeded: newFoodNeeded,
            hp: newHp,
            yields: y,
            productionQueue: newQueue,
            pendingGrowthEvent,
          };
        }
      } else {
        newQueue = [item, ...newQueue.slice(1)];
      }
    }

    const housing = calcCityHousing(city);
    let amenities = 0;
    for (const b of city.buildings) amenities += BUILDINGS[b]?.amenities ?? 0;
    const capId = s.civilizations[city.owner]?.capital;
    const cap = capId != null ? s.cities.find(ct => ct.id === capId) : null;
    let loyalty = city.loyalty;
    if (cap) loyalty += Math.max(-6, 10 - hexDistance(city.q, city.r, cap.q, cap.r));
    loyalty += (amenities - 4) * 1.1;
    loyalty = Math.max(0, Math.min(100, loyalty));
    if (loyalty < 28) {
      y = {
        ...y,
        production: Math.floor(y.production * 0.82),
        science: Math.floor(y.science * 0.88),
      };
    }

    return {
      ...cityForYields,
      food: newFood,
      population: newPop,
      foodNeeded: newFoodNeeded,
      hp: newHp,
      yields: y,
      productionQueue: newQueue,
      housing,
      amenities,
      loyalty,
      pendingGrowthEvent,
    };
  });

  let citiesAfterGrowthChoices = newCities;
  let growthStateView: GameState = { ...s, cities: citiesAfterGrowthChoices };
  for (const c of citiesAfterGrowthChoices) {
    const owner = growthStateView.civilizations[c.owner];
    if (!owner || owner.isHuman) continue;
    if (!c.pendingGrowthEvent) continue;
    const choice = selectAiGrowthChoice(growthStateView, c);
    const target = selectAiGrowthTarget(c, choice);
    const resolved = applyGrowthChoice(c, choice, target);
    citiesAfterGrowthChoices = citiesAfterGrowthChoices.map(x =>
      x.id === c.id ? { ...resolved, yields: calcCityYields(resolved, growthStateView.tiles) } : x
    );
    growthStateView = { ...growthStateView, cities: citiesAfterGrowthChoices };
  }

  let sAfterWonders = { ...s, cities: citiesAfterGrowthChoices };
  for (const w of wonderCompletions) {
    sAfterWonders = completeWonderProduction(sAfterWonders, w.cityId, w.wonderId, w.owner);
  }

  // Units completed this turn
  let newUnits = [...sAfterWonders.units];
  let newCivs = [...sAfterWonders.civilizations];
  let nextUnitId = sAfterWonders.nextUnitId;
  let spaceRaceAcc = { ...sAfterWonders.systems.spaceRace };

  for (const u of unitCompletions) {
    const def = UNITS[u.unitType];
    if (!def) continue;
    const cityForSpawn = citiesAfterGrowthChoices.find(c => c.id === u.cityId);
    const tmpState: GameState = { ...sAfterWonders, cities: citiesAfterGrowthChoices, units: newUnits };
    const cell = cityForSpawn
      ? findSpawnCellForUnit(tmpState, cityForSpawn, u.unitType)
      : { q: u.q, r: u.r };
    if (!cell) continue;
    const newUnit: Unit = {
      id: nextUnitId++,
      type: u.unitType,
      owner: u.owner,
      q: cell.q,
      r: cell.r,
      hp: 100,
      maxHp: 100,
      movement: def.movement,
      maxMovement: def.movement,
      strength: def.strength,
      rangedStrength: def.rangedStrength,
      range: def.range,
      hasAttacked: false,
      promotions: [],
      era: def.era,
      name: def.name,
      ...(u.unitType === 'scout' ? { scoutAutoExplore: !newCivs[u.owner]?.isHuman } : {}),
      ...(u.unitType === 'worker' ? { workerBuildsRemaining: WORKER_MAX_BUILDS } : {}),
    };
    newUnits.push(newUnit);
    newCivs[u.owner] = {
      ...newCivs[u.owner],
      units: [...newCivs[u.owner].units, newUnit.id],
    };
  }

  const tmpForSpace: GameState = {
    ...sAfterWonders,
    cities: citiesAfterGrowthChoices,
    units: newUnits,
    civilizations: newCivs,
    systems: { ...sAfterWonders.systems, spaceRace: spaceRaceAcc },
  };
  newCivs = newCivs.map((civ, i) => {
    const r = processSpaceRaceForCiv(tmpForSpace, i, citiesAfterGrowthChoices, civ, spaceRaceAcc);
    spaceRaceAcc = r.spaceRace;
    tmpForSpace.systems = { ...tmpForSpace.systems, spaceRace: spaceRaceAcc };
    return { ...civ, scienceVictoryProgress: r.scienceVictoryProgress };
  });
  sAfterWonders = {
    ...sAfterWonders,
    civilizations: newCivs,
    systems: { ...sAfterWonders.systems, spaceRace: spaceRaceAcc },
  };

  // Reset unit movement and attacks
  newUnits = newUnits.map(u => ({
    ...u,
    movement: u.maxMovement,
    hasAttacked: false,
  }));

  // Combat units heal on friendly territory if undamaged in combat for TERRITORY_HEAL_PEACE_TURNS turns
  const healProbe: GameState = {
    ...sAfterWonders,
    cities: citiesAfterGrowthChoices,
    units: newUnits,
    civilizations: newCivs,
  };
  recomputeTileTerritory(healProbe);
  const incomingTurn = s.turn + 1;
  newUnits = newUnits.map(u => {
    if (!unitEligibleForTerritoryHeal(u) || u.hp >= u.maxHp) return u;
    const tile = healProbe.tiles[u.r]?.[u.q];
    if (!tile || tile.owner !== u.owner) return u;
    const last = u.lastDamagedInCombatTurn ?? null;
    if (last != null && incomingTurn - last < TERRITORY_HEAL_PEACE_TURNS) return u;
    const healed = Math.min(u.maxHp, u.hp + TERRITORY_HEAL_HP);
    return { ...u, hp: healed };
  });

  const withRelationDrift = updateRelationDriftPerTurn(s);
  const newRelations = withRelationDrift.relations;

  // Check victory conditions
  let winner: number | null = null;
  let victoryType: VictoryType | null = null;
  const currentAge = s.age?.currentAge ?? 'antiquity';

  // const aliveHumans = newCivs.filter((c, i) => i !== humanCivIndex && c.isAlive);

  // Domination override: if only one civilization is alive, it wins regardless of other tracks.
  {
    const aliveCount = newCivs.filter(c => c.isAlive).length;
    if (aliveCount === 1) {
      winner = newCivs.findIndex(c => c.isAlive);
      victoryType = 'domination';
    }
  }

  // Science victory (modern-age unlock)
  if (winner == null && isVictoryTypeUnlockedForAge(currentAge, 'science')) {
    for (let i = 0; i < newCivs.length; i++) {
      const civ = newCivs[i];
      if (isSpaceVictoryDoneFor(civ)) {
        winner = i;
        victoryType = 'science';
        break;
      }
    }
  }

  // Time victory at max turns (modern-age unlock); winner resolved by legacy fallback score.
  if (winner == null && s.turn >= s.settings.maxTurns && isVictoryTypeUnlockedForAge(currentAge, 'time')) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < newCivs.length; i++) {
      if (!newCivs[i]?.isAlive) continue;
      const score = legacyVictoryScore(s, i);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) {
      winner = best;
      victoryType = 'time';
    }
  }

  // AI turns
  let stateForAI: GameState = reconcileTileUnitPointers({
    ...sAfterWonders,
    cities: citiesAfterGrowthChoices,
    units: newUnits,
    civilizations: newCivs,
    relations: newRelations,
    tradeRoutes: s.tradeRoutes ?? [],
    nextTradeRouteId: s.nextTradeRouteId ?? 1,
    nextUnitId,
    turn: s.turn + 1,
    phase: winner != null ? 'victory' : 'playing',
    winner,
    victoryType,
    world: nextWorldState(state.world ?? DEFAULT_WORLD, s.turn + 1, state.settings.seed),
  });

  stateForAI = applyFeatureSystemsEnd(stateForAI);
  if (stateForAI.winner != null && stateForAI.victoryType === 'time') {
    stateForAI = addMessage(
      stateForAI,
      `${civNameSafe(stateForAI, stateForAI.winner)} wins by legacy fallback at end of timeline.`,
      'info',
      [stateForAI.winner]
    );
  }

  if (stateForAI.winner == null && isVictoryTypeUnlockedForAge(currentAge, 'culture')) {
    const aliveOthers = stateForAI.civilizations.filter(c => c.isAlive).length - 1;
    if (aliveOthers > 0) {
      for (let i = 0; i < stateForAI.civilizations.length; i++) {
        if (!stateForAI.civilizations[i]!.isAlive) continue;
        if (getCultureVictoryDominantCount(stateForAI, i) >= aliveOthers) {
          stateForAI = {
            ...stateForAI,
            winner: i,
            victoryType: 'culture',
            phase: 'victory',
          };
          break;
        }
      }
    }
  }

  if (stateForAI.winner == null && isVictoryTypeUnlockedForAge(currentAge, 'diplomacy')) {
    for (let i = 0; i < stateForAI.civilizations.length; i++) {
      const c = stateForAI.civilizations[i]!;
      if (!c.isAlive) continue;
      if (c.diplomaticVictoryPoints >= DIPLOMACY_VICTORY_POINTS_REQUIRED) {
        stateForAI = { ...stateForAI, winner: i, victoryType: 'diplomacy', phase: 'victory' };
        break;
      }
    }
  }

  if (stateForAI.winner == null && stateForAI.turn > 85 && isVictoryTypeUnlockedForAge(currentAge, 'religion')) {
    const religionWinner = religiousVictoryCandidate(stateForAI);
    if (religionWinner != null) {
      stateForAI = {
        ...stateForAI,
        winner: religionWinner,
        victoryType: 'religion',
        phase: 'victory',
      };
    }
  }

  for (const u of unitCompletions) {
    const cname = citiesAfterGrowthChoices.find(c => c.id === u.cityId)?.name ?? 'City';
    const un = UNITS[u.unitType]?.name ?? u.unitType;
    stateForAI = addMessage(stateForAI, `${un} produced in ${cname}.`, 'city', [u.owner]);
  }

  const aiApi = createAIEngineAPI();

  if (!opts?.skipEndAiBlock) {
    for (let i = 0; i < stateForAI.civilizations.length; i++) {
      const c = stateForAI.civilizations[i]!;
      if (!c.isAlive || c.isHuman) continue;
      updateVision(stateForAI.tiles, i, stateForAI.units, stateForAI.cities);
      stateForAI = runAITurn(stateForAI, i, aiApi);
    }
  }

  if (stateForAI.winner == null) {
    stateForAI = runAllScoutsAutoExplore(stateForAI);
  }

  // Update fog / visibility for the local viewer (player slot 0 in single-player).
  updateVision(stateForAI.tiles, visionCivIndex, stateForAI.units, stateForAI.cities);

  // Reassign worked tiles for all cities
  for (const city of stateForAI.cities) {
    assignWorkedTiles(city, stateForAI.tiles, stateForAI.cities);
    const yields = calcCityYields(city, stateForAI.tiles);
    const cityIndex = stateForAI.cities.findIndex(c => c.id === city.id);
    if (cityIndex >= 0) {
      stateForAI.cities[cityIndex] = { ...stateForAI.cities[cityIndex], yields };
    }
  }

  recomputeTileTerritory(stateForAI);

  stateForAI = decayTradeAgreements(normalizeRouteRiskByRelations(stateForAI));
  stateForAI = runAgeFrameworkTurn(stateForAI);
  return stateForAI;
}

// ============================================================
// INITIALIZE GAME
// ============================================================
export function initGame(settings: GameSettings): GameState {
  const rng = createRng(settings.seed);
  const mergedSettings: GameSettings =
    settings.mapType === 'earth'
      ? {
          ...settings,
          numCivs: CIV_TEMPLATES.length,
          mapWidth: EARTH_MAP_WIDTH,
          mapHeight: EARTH_MAP_HEIGHT,
        }
      : settings;
  const tiles = generateMap(mergedSettings.mapWidth, mergedSettings.mapHeight, mergedSettings.seed, mergedSettings.mapType);
  return finishInitGame(mergedSettings, tiles, rng);
}

export function initGameFromCustomMap(settings: GameSettings, terrain: TerrainType[][]): GameState {
  const merged: GameSettings = {
    ...settings,
    mapWidth: terrain[0]?.length ?? settings.mapWidth,
    mapHeight: terrain.length || settings.mapHeight,
    ...(settings.mapType === 'earth' ? { numCivs: CIV_TEMPLATES.length } : {}),
  };
  const rng = createRng(merged.seed);
  const tiles = createTerrainGrid(terrain, merged.numCivs);
  return finishInitGame(merged, tiles, rng);
}

function finishInitGame(settings: GameSettings, tiles: Tile[][], rng: () => number): GameState {
  const mapH = tiles.length;
  const mapW = tiles[0]?.length ?? settings.mapWidth;

  // Initialize visibility arrays
  for (let r = 0; r < mapH; r++) {
    for (let c = 0; c < mapW; c++) {
      tiles[r][c].revealed = new Array(settings.numCivs).fill(false);
      tiles[r][c].visible = new Array(settings.numCivs).fill(false);
    }
  }

  const nTpl = CIV_TEMPLATES.length;
  const humanTpl = Math.max(0, Math.min(nTpl - 1, settings.humanCivIndex ?? 0));
  const startPositions =
    settings.mapType === 'earth'
      ? findEarthHistoricalStartingPositions(tiles, settings.numCivs, humanTpl, rng)
      : findStartingPositions(tiles, settings.numCivs, rng);

  const civilizations: Civilization[] = [];
  const cities: City[] = [];
  const units: Unit[] = [];
  let nextCityId = 1;
  let nextUnitId = 1;
  const nick = (settings.humanNickname ?? '').trim().slice(0, 48);
  const humanSet = new Set<number>([0]);
  const firstHumanForNick = 0;

  for (let i = 0; i < settings.numCivs; i++) {
    const template = CIV_TEMPLATES[(humanTpl + i) % nTpl];
    const pos = startPositions[i] || { q: 5 + i * 5, r: 5 };
    const isHumanCiv = humanSet.has(i);
    const leader = isHumanCiv && i === firstHumanForNick && nick ? nick : template.leader;

    const aiKeys = Object.keys(AI_PERSONALITIES);
    const aiPersonality = isHumanCiv ? 'BUILDER' : aiKeys[Math.floor(rng() * aiKeys.length)]!;

    const civ: Civilization = {
      id: i,
      name: template.name,
      adjective: template.adjective,
      leader,
      color: template.color,
      secondaryColor: template.secondaryColor,
      isHuman: isHumanCiv,
      isAlive: true,
      capital: null,
      cities: [],
      units: [],
      resources: EMPTY_YIELDS(),
      lastTurnIncome: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
      researchedTechs: ['agriculture'],
      currentResearch: null,
      researchProgress: 0,
      researchedCivics: ['code_of_laws'],
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
      slottedPolicyIds: isHumanCiv ? ['urban_planning'] : [],
      aiPersonality,
    };

    civilizations.push(civ);

    // Create starting city
    const cityNames = CIV_CITY_NAMES[template.name] || ['Capital'];
    const city: City = {
      id: nextCityId++,
      name: cityNames[0],
      owner: i,
      q: pos.q,
      r: pos.r,
      population: 1,
      food: 0,
      foodNeeded: 15,
      buildings: ['palace'],
      productionQueue: [],
      workedTiles: [],
      yields: EMPTY_YIELDS(),
      isCapital: true,
      defense: 20,
      hp: 200,
      maxHp: 200,
      turnFounded: 0,
      majorityReligionIndex: null,
      housing: 5,
      amenities: 2,
      loyalty: 100,
      greatWorkIds: [],
      settlementKind: 'capital',
      townSpecialization: null,
      settlementTier: 3,
      settlementSoftCapPenalty: 0,
      districts: [
        {
          id: `district-${nextCityId - 1}-center`,
          kind: 'urban',
          type: 'urban_center',
          q: pos.q,
          r: pos.r,
          level: 1,
          specialists: 0,
          establishedTurn: 0,
        },
      ],
    };

    tiles[pos.r][pos.q].city = city.id;
    tiles[pos.r][pos.q].owner = i;
    const capTer = tiles[pos.r][pos.q].terrain;
    tiles[pos.r][pos.q].terrain =
      capTer === 'ocean' || capTer === 'coast' ? 'grassland' : capTer;

    civ.capital = city.id;
    civ.cities.push(city.id);
    cities.push(city);

    const neigh = getNeighbors(pos.q, pos.r, mapW, mapH);
    let warriorPos = { q: pos.q, r: pos.r };
    for (const n of neigh) {
      const tt = tiles[n.r][n.q];
      if (tt.terrain !== 'ocean' && tt.terrain !== 'mountains' && tt.city == null) {
        warriorPos = n;
        break;
      }
    }
    let settlerPos = { q: Math.min(mapW - 1, pos.q + 1), r: pos.r };
    for (const n of neigh) {
      if (n.q === warriorPos.q && n.r === warriorPos.r) continue;
      const tt = tiles[n.r][n.q];
      if (tt.terrain !== 'ocean' && tt.terrain !== 'mountains') {
        settlerPos = n;
        break;
      }
    }

    // Starting units: warrior + settler (never stacked on city tile)
    const warrior: Unit = {
      id: nextUnitId++,
      type: 'warrior',
      owner: i,
      q: warriorPos.q,
      r: warriorPos.r,
      hp: 100, maxHp: 100,
      movement: 2, maxMovement: 2,
      strength: UNITS.warrior.strength,
      rangedStrength: 0, range: 0,
      hasAttacked: false, promotions: [], era: 'ancient',
      name: 'Warrior',
    };

    const settler: Unit = {
      id: nextUnitId++,
      type: 'settler',
      owner: i,
      q: settlerPos.q,
      r: settlerPos.r,
      hp: 100, maxHp: 100,
      movement: 2, maxMovement: 2,
      strength: 0, rangedStrength: 0, range: 0,
      hasAttacked: false, promotions: [], era: 'ancient',
      name: 'Settler',
    };

    civ.units.push(warrior.id, settler.id);
    units.push(warrior, settler);
  }

  // Assign worked tiles and calculate yields
  for (const city of cities) {
    city.settlementSoftCapPenalty = 0;
    assignWorkedTiles(city, tiles, cities);
    city.yields = calcCityYields(city, tiles);
  }
  for (let i = 0; i < civilizations.length; i++) {
    const cityCount = civilizations[i]!.cities.length;
    const reserveCap = productionReserveCap(cityCount, 0);
    const baseProd = cities.filter(c => c.owner === i).reduce((sum, c) => sum + (c.yields.production ?? 0), 0);
    const startReserve = Math.min(reserveCap, 60 + baseProd * 6);
    civilizations[i]!.resources = {
      ...civilizations[i]!.resources,
      production: startReserve,
    };
  }

  // Build diplomatic relations
  const relations: DiplomaticRelation[] = [];
  for (let a = 0; a < settings.numCivs; a++) {
    for (let b = a + 1; b < settings.numCivs; b++) {
      relations.push({
        civA: a,
        civB: b,
        status: 'neutral',
        turnsAtWar: 0,
        tradeRoutes: 0,
        peaceLockedUntilTurn: 0,
        armisticeUntilTurn: 0,
        trust: 0,
        grievances: 0,
      });
    }
  }

  const civilizationIdentity = createCivilizationIdentityLayer(
    civilizations,
    civilizations.map(c => {
      const tpl = getCivTemplateByName(c.name);
      return {
        id: tpl?.id ?? `civ-${c.id}`,
        name: c.name,
        adjective: c.adjective,
      };
    }),
    'antiquity'
  );
  const requestedLoadout = Array.isArray(settings.metaMementoLoadout)
    ? settings.metaMementoLoadout.map(String)
    : [];
  const sanitizedLoadout = sanitizeMementoLoadout(
    requestedLoadout,
    MEMENTO_DEFINITIONS.map(m => m.id)
  );
  const metaEnabled = !(humanSet.size > 1 && settings.metaProgressionPolicy === 'disabled');
  const leaders = createLeaderProfiles(civilizations, civilizationIdentity).map(leader =>
    humanSet.has(leader.civIndex) && metaEnabled
      ? {
          ...leader,
          activeMementos: sanitizedLoadout,
        }
      : leader
  );

  const state: GameState = reconcileTileUnitPointers({
    systems: createDefaultSystems(),
    settings,
    achievementStats: Array.from({ length: settings.numCivs }, () => ({
      combatWins: 0,
      enemyCitiesCaptured: 0,
    })),
    turn: 1,
    currentCivIndex: 0,
    tiles,
    cities,
    units,
    civilizations,
    relations,
    tradeRoutes: [],
    tradeAgreements: [],
    nextTradeAgreementId: 1,
    nextTradeRouteId: 1,
    diplomaticOffers: [],
    nextDiplomaticOfferId: 1,
    nextCityId,
    nextUnitId,
    phase: 'playing',
    winner: null,
    victoryType: null,
    age: createInitialAgeState(settings.numCivs),
    leaders,
    civilizationIdentity,
    messages: [],
    stackUnitsToMove: 9999,
    selectedUnitId: null,
    selectedCityId: null,
    selectedTile: null,
    camera: (() => {
      const sp = startPositions[0] ?? { q: 0, r: 0 };
      const z = 1;
      const { x: tx, y: ty } = gridToScreen(sp.q, sp.r, z);
      return { x: tx, y: ty, zoom: z, rotation: 0 };
    })(),
    world: { ...DEFAULT_WORLD },
  });

  for (const hi of humanSet) {
    updateVision(state.tiles, hi, state.units, state.cities);
  }
  recomputeTileTerritory(state);

  const leadCiv = civilizations[firstHumanForNick] ?? civilizations[0]!;
  const welcome = `Welcome to Gnozian! Lead the ${leadCiv.name} to glory!`;
  return addMessage(state, welcome, 'info');
}
