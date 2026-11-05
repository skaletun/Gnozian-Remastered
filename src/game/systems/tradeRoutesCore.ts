import { MAX_TRADE_ROUTES_PER_PAIR, TRADE_ROUTE_GOLD_BASE, TRADE_ROUTE_MAX_HEX_DISTANCE } from '../constants';
import { getNeighbors, hexDistance } from '../mapgen';
import type { GameState, TradeRoute } from '../types';
import { getCapitalCity, relationPair } from './diplomacyCore';
import { tileMovementEnterCost } from '../movementRules';
import { bothCivsUnlocked, progressionLockReason } from '../progressionLocks';

function areAtWarByRelations(state: GameState, civA: number, civB: number): boolean {
  const r = relationPair(state.relations, civA, civB);
  return r?.status === 'war';
}

/** Keep `DiplomaticRelation.tradeRoutes` counts aligned with `state.tradeRoutes`. */
export function syncRelationTradeRouteCounts(state: GameState): GameState {
  const counts = new Map<string, number>();
  for (const tr of state.tradeRoutes ?? []) {
    const k = `${tr.civA}_${tr.civB}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return {
    ...state,
    relations: state.relations.map(r => ({
      ...r,
      tradeRoutes: counts.get(`${r.civA}_${r.civB}`) ?? 0,
    })),
  };
}

export function countTradeRoutesBetween(state: GameState, civX: number, civY: number): number {
  const lo = Math.min(civX, civY);
  const hi = Math.max(civX, civY);
  return (state.tradeRoutes ?? []).filter(tr => tr.civA === lo && tr.civB === hi).length;
}

/** Null if a new route can be added; otherwise a short English reason for UI/messages. */
export function getTradeRouteBlockReason(state: GameState, civX: number, civY: number): string | null {
  if (civX === civY) return 'Same civilization.';
  const lo = Math.min(civX, civY);
  const hi = Math.max(civX, civY);
  if (!state.civilizations[lo]?.isAlive || !state.civilizations[hi]?.isAlive) return 'Civilization eliminated.';
  if (!bothCivsUnlocked(state, lo, hi, 'trade_routes')) return progressionLockReason('trade_routes');
  if (areAtWarByRelations(state, lo, hi)) return 'Cannot trade while at war.';
  const rel = relationPair(state.relations, lo, hi);
  if (!rel || rel.status === 'war') return 'Diplomatic status blocks trade.';
  const fromCity = getCapitalCity(state, lo);
  const toCity = getCapitalCity(state, hi);
  if (!fromCity || !toCity) return 'Both capitals must exist.';
  const d = hexDistance(fromCity.q, fromCity.r, toCity.q, toCity.r);
  if (d > TRADE_ROUTE_MAX_HEX_DISTANCE) {
    return `Capitals too far apart (${d} hexes; max ${TRADE_ROUTE_MAX_HEX_DISTANCE}).`;
  }
  const path = findTradeNetworkPath(state, lo, hi);
  if (!path || path.length < 2) return 'No viable trade network path between capitals.';
  if (countTradeRoutesBetween(state, lo, hi) >= MAX_TRADE_ROUTES_PER_PAIR) {
    return `Maximum ${MAX_TRADE_ROUTES_PER_PAIR} trade routes between two empires.`;
  }
  return null;
}

type Hex = { q: number; r: number };
function hk(q: number, r: number): string { return `${q},${r}`; }

export function findTradeNetworkPath(state: GameState, civA: number, civB: number): Hex[] | null {
  const lo = Math.min(civA, civB);
  const hi = Math.max(civA, civB);
  const fromCity = getCapitalCity(state, lo);
  const toCity = getCapitalCity(state, hi);
  if (!fromCity || !toCity) return null;
  const w = state.tiles[0]?.length ?? 0;
  const h = state.tiles.length;
  if (!w || !h) return null;
  const start = hk(fromCity.q, fromCity.r);
  const goal = hk(toCity.q, toCity.r);
  const open = new Map<string, { q: number; r: number; g: number; f: number }>();
  const parent = new Map<string, string | null>();
  const closed = new Set<string>();
  open.set(start, { q: fromCity.q, r: fromCity.r, g: 0, f: hexDistance(fromCity.q, fromCity.r, toCity.q, toCity.r) });
  parent.set(start, null);
  let hops = 0;
  while (open.size > 0 && hops < 4000) {
    hops++;
    let bestKey: string | null = null;
    let bestF = Infinity;
    for (const [k, n] of open) {
      if (n.f < bestF) { bestF = n.f; bestKey = k; }
    }
    if (!bestKey) break;
    const cur = open.get(bestKey)!;
    open.delete(bestKey);
    if (bestKey === goal) {
      const out: Hex[] = [];
      let ck: string | null = bestKey;
      while (ck) {
        const [q, r] = ck.split(',').map(Number);
        out.push({ q, r });
        ck = parent.get(ck) ?? null;
      }
      out.reverse();
      return out;
    }
    closed.add(bestKey);
    for (const n of getNeighbors(cur.q, cur.r, w, h)) {
      const nk = hk(n.q, n.r);
      if (closed.has(nk)) continue;
      const tile = state.tiles[n.r]?.[n.q];
      if (!tile) continue;
      const cost = tileMovementEnterCost(tile.terrain, 'great_merchant', {
        state,
        civIndex: lo,
        fromQ: cur.q,
        fromR: cur.r,
        toQ: n.q,
        toR: n.r,
      });
      if (cost == null) continue;
      const g = cur.g + cost;
      const curOpen = open.get(nk);
      if (!curOpen || g < curOpen.g) {
        parent.set(nk, bestKey);
        open.set(nk, { q: n.q, r: n.r, g, f: g + hexDistance(n.q, n.r, toCity.q, toCity.r) });
      }
    }
  }
  return null;
}

export function applyAutoRoadGeneration(state: GameState, route: TradeRoute): GameState {
  const path = findTradeNetworkPath(state, route.civA, route.civB);
  if (!path || path.length < 2) return state;
  const tiles = state.tiles.map(row => row.map(t => ({ ...t })));
  for (const p of path) {
    const tile = tiles[p.r]?.[p.q];
    if (!tile) continue;
    if (tile.terrain === 'mountains' || tile.terrain === 'ocean') continue;
    tile.road = true;
  }
  return { ...state, tiles };
}

/** Normalize saves from before `tradeRoutes[]` existed (uses legacy per-relation counts). */
export function migrateLoadedTradeRoutes(state: GameState): GameState {
  if (Array.isArray(state.tradeRoutes)) {
    return syncRelationTradeRouteCounts({
      ...state,
      tradeRoutes: state.tradeRoutes.map(tr => ({
        ...tr,
        risk: tr.risk ?? 0.12,
      })),
      nextTradeRouteId: state.nextTradeRouteId ?? 1,
    });
  }
  const outRoutes: TradeRoute[] = [];
  let nextId = 1;
  for (const rel of state.relations) {
    const n = rel.tradeRoutes ?? 0;
    if (n <= 0) continue;
    const fromCity = getCapitalCity(state, rel.civA);
    const toCity = getCapitalCity(state, rel.civB);
    if (!fromCity || !toCity) continue;
    const d = hexDistance(fromCity.q, fromCity.r, toCity.q, toCity.r);
    if (d > TRADE_ROUTE_MAX_HEX_DISTANCE) continue;
    const popBonus = Math.min(4, Math.floor((fromCity.population + toCity.population) / 15));
    const goldPerTurn = TRADE_ROUTE_GOLD_BASE + popBonus;
    const cap = Math.min(n, MAX_TRADE_ROUTES_PER_PAIR);
    for (let i = 0; i < cap; i++) {
      outRoutes.push({
        id: nextId++,
        civA: rel.civA,
        civB: rel.civB,
        fromCityId: fromCity.id,
        toCityId: toCity.id,
        goldPerTurn,
        turnsEstablished: 0,
        risk: 0.12,
      });
    }
  }
  return syncRelationTradeRouteCounts({
    ...state,
    tradeRoutes: outRoutes,
    nextTradeRouteId: nextId,
  });
}

export function pruneInvalidTradeRoutes(state: GameState): GameState {
  const routes = state.tradeRoutes ?? [];
  const next = routes.filter(tr => {
    if (!state.civilizations[tr.civA]?.isAlive || !state.civilizations[tr.civB]?.isAlive) return false;
    const rel = relationPair(state.relations, tr.civA, tr.civB);
    if (!rel || rel.status === 'war') return false;
    const aCity = state.cities.find(c => c.id === tr.fromCityId);
    const bCity = state.cities.find(c => c.id === tr.toCityId);
    if (!aCity || !bCity) return false;
    if (aCity.owner !== tr.civA || bCity.owner !== tr.civB) return false;
    const capA = state.civilizations[tr.civA]?.capital;
    const capB = state.civilizations[tr.civB]?.capital;
    if (tr.fromCityId !== capA || tr.toCityId !== capB) return false;
    const d = hexDistance(aCity.q, aCity.r, bCity.q, bCity.r);
    if (d > TRADE_ROUTE_MAX_HEX_DISTANCE) return false;
    const path = findTradeNetworkPath(state, tr.civA, tr.civB);
    return !!path && path.length >= 2;
  });
  if (next.length === routes.length) return syncRelationTradeRouteCounts(state);
  return syncRelationTradeRouteCounts({ ...state, tradeRoutes: next });
}

