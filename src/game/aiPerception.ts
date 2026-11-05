import type { GameState, Tile } from './types';
import type { AIEngineAPI } from './ai';

function canSeeTile(tile: Tile | undefined, civIndex: number): boolean {
  return Boolean(tile?.visible?.[civIndex]);
}

function hasRevealedTile(tile: Tile | undefined, civIndex: number): boolean {
  return Boolean(tile?.revealed?.[civIndex] || tile?.visible?.[civIndex]);
}

function maskTile(tile: Tile, civIndex: number, visibleUnitIds: Set<number>, revealedCityIds: Set<number>): Tile {
  if (!hasRevealedTile(tile, civIndex)) {
    return {
      q: tile.q,
      r: tile.r,
      terrain: 'plains',
      improvement: 'none',
      resource: null,
      owner: null,
      city: null,
      territoryCityId: null,
      unit: null,
      revealed: [...tile.revealed],
      visible: [...tile.visible],
    };
  }

  const visible = canSeeTile(tile, civIndex);
  return {
    ...tile,
    resource: visible || tile.owner === civIndex ? tile.resource : null,
    city: tile.city != null && revealedCityIds.has(tile.city) ? tile.city : null,
    unit: tile.unit != null && visibleUnitIds.has(tile.unit) ? tile.unit : null,
    revealed: [...tile.revealed],
    visible: [...tile.visible],
  };
}

export function createAiPerceptionState(state: GameState, civIndex: number): GameState {
  const visibleUnitIds = new Set<number>();
  for (const unit of state.units) {
    const tile = state.tiles[unit.r]?.[unit.q];
    if (unit.owner === civIndex || canSeeTile(tile, civIndex)) visibleUnitIds.add(unit.id);
  }

  const revealedCityIds = new Set<number>();
  for (const city of state.cities) {
    const tile = state.tiles[city.r]?.[city.q];
    if (city.owner === civIndex || hasRevealedTile(tile, civIndex)) revealedCityIds.add(city.id);
  }

  const tiles = state.tiles.map(row => row.map(tile => maskTile(tile, civIndex, visibleUnitIds, revealedCityIds)));
  const units = state.units.filter(unit => visibleUnitIds.has(unit.id));
  const cities = state.cities.filter(city => revealedCityIds.has(city.id));
  const cityIdsByOwner = new Map<number, number[]>();
  const unitIdsByOwner = new Map<number, number[]>();
  for (const city of cities) {
    cityIdsByOwner.set(city.owner, [...(cityIdsByOwner.get(city.owner) ?? []), city.id]);
  }
  for (const unit of units) {
    unitIdsByOwner.set(unit.owner, [...(unitIdsByOwner.get(unit.owner) ?? []), unit.id]);
  }

  const civilizations = state.civilizations.map((civ, index) => {
    if (index === civIndex) return { ...civ };
    return {
      ...civ,
      cities: cityIdsByOwner.get(index) ?? [],
      units: unitIdsByOwner.get(index) ?? [],
      resources: { food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0 },
      lastTurnIncome: {},
    };
  });

  return {
    ...state,
    tiles,
    units,
    cities,
    civilizations,
    selectedCityId: null,
    selectedTile: null,
    selectedUnitId: null,
  };
}

type FogRuntime = {
  getActual: () => GameState;
  setActual: (state: GameState) => void;
  perceive: () => GameState;
};

export function createFogLimitedAIAPI(api: AIEngineAPI, runtime: FogRuntime): AIEngineAPI {
  const mutate = (fn: (state: GameState) => GameState): GameState => {
    const next = fn(runtime.getActual());
    runtime.setActual(next);
    return runtime.perceive();
  };

  return {
    startResearch: (_state, civ, tech) => mutate(actual => api.startResearch(actual, civ, tech)),
    startCivicResearch: (_state, civ, civicId) => mutate(actual => api.startCivicResearch(actual, civ, civicId)),
    addToProductionQueue: (_state, cityId, item, actingCivIndex) =>
      mutate(actual => api.addToProductionQueue(actual, cityId, item, actingCivIndex)),
    moveUnit: (_state, unitId, toQ, toR) => mutate(actual => api.moveUnit(actual, unitId, toQ, toR)),
    foundCity: (_state, civIndex, q, r, settlerId) =>
      mutate(actual => api.foundCity(actual, civIndex, q, r, settlerId)),
    combatUnit: (_state, attackerId, defenderId) => mutate(actual => api.combatUnit(actual, attackerId, defenderId)),
    attackCity: (_state, attackerId, cityId) => mutate(actual => api.attackCity(actual, attackerId, cityId)),
    declareWar: (_state, civA, civB) => mutate(actual => api.declareWar(actual, civA, civB)),
    makePeace: (_state, civA, civB, payments) => mutate(actual => api.makePeace(actual, civA, civB, payments)),
    signArmistice: (_state, civA, civB, opts) => mutate(actual => api.signArmistice(actual, civA, civB, opts)),
    proposeDiplomaticSettlement: (_state, fromCiv, toCiv, kind, terms) =>
      mutate(actual => api.proposeDiplomaticSettlement(actual, fromCiv, toCiv, kind, terms)),
    formAlliance: (_state, civA, civB) => mutate(actual => api.formAlliance(actual, civA, civB)),
    leaveAlliance: (_state, civA, civB) => mutate(actual => api.leaveAlliance(actual, civA, civB)),
    addTradeRoute: (_state, civA, civB, options) => mutate(actual => api.addTradeRoute(actual, civA, civB, options)),
    signTradeAgreement: (_state, civA, civB, options) =>
      mutate(actual => api.signTradeAgreement(actual, civA, civB, options)),
    canDeclareWar: (_state, civA, civB) => api.canDeclareWar(runtime.getActual(), civA, civB),
    areAtWar: (_state, civA, civB) => api.areAtWar(runtime.getActual(), civA, civB),
    isMilitarilyEngaged: (_state, civA, civB) => api.isMilitarilyEngaged(runtime.getActual(), civA, civB),
    bestNeighborToward: (_state, unit, targetQ, targetR) =>
      api.bestNeighborToward(runtime.getActual(), unit, targetQ, targetR),
    calcTileYield: tile => api.calcTileYield(tile),
    canFriendlyStackOnTile: (_state, owner, unitType, q, r, excludeUnitId) =>
      api.canFriendlyStackOnTile(runtime.getActual(), owner, unitType, q, r, excludeUnitId),
    activateGreatPerson: (_state, unitId, cityId) => mutate(actual => api.activateGreatPerson(actual, unitId, cityId)),
    listValidWorkerImprovements: (_state, unitId) => api.listValidWorkerImprovements(runtime.getActual(), unitId),
    buildImprovement: (_state, unitId, improvement) =>
      mutate(actual => api.buildImprovement(actual, unitId, improvement)),
  };
}
