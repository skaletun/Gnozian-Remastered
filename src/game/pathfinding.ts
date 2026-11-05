import type { GameState, Unit } from './types';
import { getNeighbors, hexDistance } from './mapgen';
import { tileMovementEnterCost } from './movementRules';
import { relationPair } from './systems/diplomacyCore';

type Node = { q: number; r: number; g: number; f: number; parent: string | null };

function key(q: number, r: number): string {
  return `${q},${r}`;
}

function canStack(state: GameState, unit: Unit, q: number, r: number): boolean {
  const occ = state.units.filter(x => x.q === q && x.r === r && x.id !== unit.id);
  if (occ.some(x => x.owner !== unit.owner && (x.strength > 0 || x.rangedStrength > 0))) return false;
  const mine = occ.filter(x => x.owner === unit.owner);
  if (mine.length === 0) return true;
  return mine.every(x => x.type === unit.type);
}

function armisticeBlocks(unitOwner: number, destOwner: number | null | undefined, state: GameState): boolean {
  if (destOwner == null || destOwner === unitOwner) return false;
  const rp = relationPair(state.relations, unitOwner, destOwner);
  return rp?.status === 'armistice';
}

export function findNextStepToward(
  state: GameState,
  unit: Unit,
  targetQ: number,
  targetR: number,
  maxVisited?: number
): { q: number; r: number } | null {
  if (unit.q === targetQ && unit.r === targetR) return null;
  const w = state.tiles[0]?.length ?? 0;
  const h = state.tiles.length;
  if (!w || !h) return null;
  const visitedCap =
    typeof maxVisited === 'number'
      ? maxVisited
      : Math.min(6000, Math.max(w * h * 3, w * h + 420));
  const startK = key(unit.q, unit.r);
  const goalK = key(targetQ, targetR);
  const open = new Map<string, Node>();
  const closed = new Set<string>();
  const cameFrom = new Map<string, string | null>();
  open.set(startK, {
    q: unit.q,
    r: unit.r,
    g: 0,
    f: hexDistance(unit.q, unit.r, targetQ, targetR),
    parent: null,
  });
  cameFrom.set(startK, null);

  let visited = 0;
  const budget = Math.max(0, unit.movement);

  while (open.size > 0 && visited < visitedCap) {
    visited++;
    let best: Node | null = null;
    for (const n of open.values()) {
      if (!best || n.f < best.f) best = n;
    }
    if (!best) break;
    const bestK = key(best.q, best.r);
    open.delete(bestK);
    closed.add(bestK);

    if (best.g > budget) continue;

    if (bestK === goalK) {
      let curK = bestK;
      let prev = cameFrom.get(curK) ?? null;
      while (prev && prev !== startK) {
        curK = prev;
        prev = cameFrom.get(curK) ?? null;
      }
      if (!prev) return null;
      const [q, r] = curK.split(',').map(Number);
      return { q, r };
    }

    const neighbors = getNeighbors(best.q, best.r, w, h);
    for (const n of neighbors) {
      const nk = key(n.q, n.r);
      if (closed.has(nk)) continue;
      const tile = state.tiles[n.r]?.[n.q];
      if (!tile) continue;
      if (armisticeBlocks(unit.owner, tile.owner, state)) continue;
      const moveCost = tileMovementEnterCost(tile.terrain, unit.type, {
        state,
        civIndex: unit.owner,
        fromQ: best.q,
        fromR: best.r,
        toQ: n.q,
        toR: n.r,
      });
      if (moveCost == null) continue;
      if (!canStack(state, unit, n.q, n.r)) continue;
      const tentativeG = best.g + moveCost;
      if (tentativeG > budget) continue;
      const cur = open.get(nk);
      if (!cur || tentativeG < cur.g) {
        cameFrom.set(nk, bestK);
        open.set(nk, {
          q: n.q,
          r: n.r,
          g: tentativeG,
          f: tentativeG + hexDistance(n.q, n.r, targetQ, targetR),
          parent: bestK,
        });
      }
    }
  }
  return null;
}

const MAX_MOVEMENT_SEARCH = 8000;

type SearchResult = {
  distances: Map<string, number>;
  parents: Map<string, string | null>;
};

function runMovementCostSearch(
  state: GameState,
  unit: Unit,
  opts: {
    budget: number;
    goalQ?: number;
    goalR?: number;
    stopAtGoal?: boolean;
    /** When true, only enter tiles culturally owned by the unit (start tile may still be off-territory). */
    restrictToOwnedTerrain?: boolean;
  }
): SearchResult {
  const w = state.tiles[0]?.length ?? 0;
  const h = state.tiles.length;
  const distances = new Map<string, number>();
  const parents = new Map<string, string | null>();

  if (!w || !h) return { distances, parents };

  const startK = key(unit.q, unit.r);
  const goalK =
    opts.goalQ != null && opts.goalR != null ? key(opts.goalQ, opts.goalR) : null;

  const tentative = new Map<string, { q: number; r: number; g: number }>();
  tentative.set(startK, { q: unit.q, r: unit.r, g: 0 });
  parents.set(startK, null);

  const hopLimit = Math.min(MAX_MOVEMENT_SEARCH, Math.max(500, w * h * 3));
  let hops = 0;

  while (tentative.size > 0 && hops < hopLimit) {
    hops++;
    let bestKey: string | null = null;
    let bestG = Infinity;
    for (const [k, n] of tentative) {
      if (n.g < bestG) {
        bestG = n.g;
        bestKey = k;
      }
    }
    if (!bestKey) break;

    const cur = tentative.get(bestKey)!;
    tentative.delete(bestKey);

    if (distances.has(bestKey)) continue;

    bestG = cur.g;

    if (bestG > opts.budget) continue;

    distances.set(bestKey, bestG);

    if (opts.stopAtGoal && goalK != null && bestKey === goalK) break;

    for (const n of getNeighbors(cur.q, cur.r, w, h)) {
      const nk = key(n.q, n.r);
      if (distances.has(nk)) continue;

      const tile = state.tiles[n.r]?.[n.q];
      if (!tile) continue;
      if (opts.restrictToOwnedTerrain && tile.owner !== unit.owner) continue;
      if (armisticeBlocks(unit.owner, tile.owner, state)) continue;

      const moveCost = tileMovementEnterCost(tile.terrain, unit.type, {
        state,
        civIndex: unit.owner,
        fromQ: cur.q,
        fromR: cur.r,
        toQ: n.q,
        toR: n.r,
      });
      if (moveCost == null) continue;
      if (!canStack(state, unit, n.q, n.r)) continue;

      const newG = cur.g + moveCost;
      if (newG > opts.budget) continue;

      const prev = tentative.get(nk)?.g ?? Infinity;
      if (newG < prev) {
        parents.set(nk, bestKey);
        tentative.set(nk, { q: n.q, r: n.r, g: newG });
      }
    }
  }

  return { distances, parents };
}

/** Minimal movement-point cost from the unit tile to each reachable hex this turn (Dijkstra with MP budget). */
export function reachableHexMovementCosts(state: GameState, unit: Unit): Map<string, number> {
  const budget = Math.max(0, unit.movement);
  const { distances } = runMovementCostSearch(state, unit, {
    budget,
    stopAtGoal: false,
  });
  return distances;
}

/**
 * Adjacent shortest path respecting current MP budget and movement rules (for multi-step clicks).
 */
export function findLeastCostMovementPath(
  state: GameState,
  unit: Unit,
  goalQ: number,
  goalR: number,
  opts?: { restrictToOwnedTerrain?: boolean }
): Array<{ q: number; r: number }> | null {
  if (unit.q === goalQ && unit.r === goalR) return null;
  const budget = Math.max(0, unit.movement);

  const { distances, parents } = runMovementCostSearch(state, unit, {
    budget,
    goalQ,
    goalR,
    stopAtGoal: true,
    restrictToOwnedTerrain: opts?.restrictToOwnedTerrain ?? false,
  });

  const gk = key(goalQ, goalR);
  const gd = distances.get(gk);
  if (gd === undefined || gd > budget) return null;

  const outRev: Array<{ q: number; r: number }> = [];
  let ck: string | null = gk;
  const guard = state.tiles[0]?.length ?? 1;
  let hop = 0;
  while (ck && hop < guard * state.tiles.length + 40) {
    hop++;
    const [q, r] = ck.split(',').map(Number);
    outRev.push({ q, r });
    const p: string | null = parents.get(ck) ?? null;
    ck = p;
  }
  outRev.reverse();

  const uq = unit.q;
  const ur = unit.r;
  if (
    outRev.length < 2 ||
    outRev[0]!.q !== uq ||
    outRev[0]!.r !== ur
  ) {
    return null;
  }

  for (let i = 1; i < outRev.length; i++) {
    const a = outRev[i - 1]!;
    const b = outRev[i]!;
    if (hexDistance(a.q, a.r, b.q, b.r) !== 1) return null;
  }

  return outRev;
}
