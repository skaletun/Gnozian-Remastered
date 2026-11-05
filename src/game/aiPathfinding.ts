/**
 * Strategic A* for AI-controlled units.
 *
 * Human tactical movement uses the one-turn budget in pathfinding.ts. AI plans
 * across multiple future turns, while every actual step must be affordable NOW.
 * Never read hidden enemy units/terrain when called with AI perception state.
 */
import type { GameState, Unit } from './types';
import { getNeighbors, hexDistance } from './mapgen';
import { tileMovementEnterCost } from './movementRules';
import { relationPair } from './systems/diplomacyCore';

type Node = { q: number; r: number; g: number; f: number; firstQ: number; firstR: number };
type Coord = { q: number; r: number };

class PriorityQueue {
  private heap: Node[] = [];
  get length(): number { return this.heap.length; }
  push(value: Node): void {
    const heap = this.heap;
    let idx = heap.length;
    heap.push(value);
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heap[parent]!.f <= value.f) break;
      heap[idx] = heap[parent]!;
      idx = parent;
    }
    heap[idx] = value;
  }
  pop(): Node | null {
    const heap = this.heap;
    if (!heap.length) return null;
    const out = heap[0]!;
    const end = heap.pop()!;
    if (heap.length) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let child = index * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1]!.f < heap[child]!.f) child++;
        if (heap[child]!.f >= end.f) break;
        heap[index] = heap[child]!;
        index = child;
      }
      heap[index] = end;
    }
    return out;
  }
}

const key = (q: number, r: number) => q + ',' + r;

export function findStrategicNextStep(
  state: GameState,
  unit: Unit,
  targetQ: number,
  targetR: number,
): Coord | null {
  const width = state.tiles[0]?.length ?? 0;
  const height = state.tiles.length;
  if (!width || !height || unit.movement <= 0) return null;
  if (!Number.isInteger(targetQ) || !Number.isInteger(targetR)) return null;
  if (!state.tiles[targetR]?.[targetQ]) return null;
  if (unit.q === targetQ && unit.r === targetR) return null;

  const occupied = new Map<string, Unit[]>();
  for (const other of state.units) {
    if (other.id === unit.id) continue;
    const pos = key(other.q, other.r);
    const list = occupied.get(pos);
    if (list) list.push(other);
    else occupied.set(pos, [other]);
  }

  // Cannot walk into an enemy garrison/city. Plan to an adjacent attack tile.
  const passable = (q: number, r: number): boolean => {
    const tile = state.tiles[r]?.[q];
    if (!tile) return false;
    if (tile.city != null && tile.owner !== unit.owner) return false;
    const occupants = occupied.get(key(q, r));
    if (occupants?.some(other => other.owner !== unit.owner ||
      (other.type !== unit.type && other.owner === unit.owner))) return false;
    if (tile.owner != null && tile.owner !== unit.owner) {
      const relation = state.relations?.length
        ? relationPair(state.relations, unit.owner, tile.owner)
        : null;
      if (relation?.status === 'armistice') return false;
    }
    return true;
  };

  const targets: Coord[] =
    passable(targetQ, targetR)
      ? [{ q: targetQ, r: targetR }]
      : getNeighbors(targetQ, targetR, width, height).filter(p => passable(p.q, p.r));
  if (!targets.length) return null;
  const goals = new Set(targets.map(p => key(p.q, p.r)));
  const heuristic = (q: number, r: number) =>
    Math.min(...targets.map(p => hexDistance(q, r, p.q, p.r)));

  // Civilians avoid visible threats: the move remains possible if all routes
  // are dangerous, but seeks safer approaches when alternatives exist.
  const civilian = unit.type === 'settler' || unit.type === 'worker'
    || unit.type === 'missionary' || unit.type.startsWith('great_');
  const enemies = civilian ? state.units.filter(other =>
    other.owner !== unit.owner && (other.strength > 0 || other.rangedStrength > 0)
  ) : [];
  const risk = (q: number, r: number): number => {
    if (!civilian) return 0;
    let score = 0;
    for (const enemy of enemies) {
      const dist = hexDistance(q, r, enemy.q, enemy.r);
      if (dist === 1) score += 14;
      else if (dist === 2) score += 5;
    }
    return score;
  };

  const best = new Map<string, number>();
  const start = key(unit.q, unit.r);
  best.set(start, 0);
  const open = new PriorityQueue();
  open.push({
    q: unit.q, r: unit.r, g: 0, f: heuristic(unit.q, unit.r),
    firstQ: unit.q, firstR: unit.r,
  });
  let expansions = 0;
  const cap = Math.min(10000, Math.max(500, width * height * 2));
  let bestPartial: Node | null = null;
  while (open.length && expansions < cap) {
    const node = open.pop()!;
    const at = key(node.q, node.r);
    if (node.g > (best.get(at) ?? Infinity) + 1e-7) continue;
    expansions++;

    if (goals.has(at)) {
      if (node.firstQ === unit.q && node.firstR === unit.r) return null;
      return { q: node.firstQ, r: node.firstR };
    }
    if (node.firstQ !== unit.q || node.firstR !== unit.r) {
      if (!bestPartial || heuristic(node.q, node.r) < heuristic(bestPartial.q, bestPartial.r) ||
        (heuristic(node.q, node.r) === heuristic(bestPartial.q, bestPartial.r) && node.g < bestPartial.g)) {
        bestPartial = node;
      }
    }
    for (const neighbor of getNeighbors(node.q, node.r, width, height)) {
      if (!passable(neighbor.q, neighbor.r)) continue;
      const tile = state.tiles[neighbor.r]?.[neighbor.q];
      if (!tile) continue;
      const movement = tileMovementEnterCost(tile.terrain, unit.type, {
        state, civIndex: unit.owner, fromQ: node.q, fromR: node.r,
        toQ: neighbor.q, toR: neighbor.r,
      });
      if (movement == null) continue;
      const first = node.q === unit.q && node.r === unit.r;
      // A future-turn route must not suggest a first step that the unit cannot
      // legally pay this turn. Later steps use the next turn's restored MP.
      if (first && movement > unit.movement) continue;
      const extra = movement + risk(neighbor.q, neighbor.r);
      const newCost = node.g + extra;
      const nextKey = key(neighbor.q, neighbor.r);
      if (newCost + 1e-7 >= (best.get(nextKey) ?? Infinity)) continue;
      best.set(nextKey, newCost);
      open.push({
        q: neighbor.q, r: neighbor.r, g: newCost,
        f: newCost + heuristic(neighbor.q, neighbor.r),
        firstQ: first ? neighbor.q : node.firstQ,
        firstR: first ? neighbor.r : node.firstR,
      });
    }
  }
  // On huge maps return a viable step toward the best explored frontier rather
  // than freezing all AI movement due to the bounded search budget.
  if (expansions >= cap && bestPartial) {
    return { q: bestPartial.firstQ, r: bestPartial.firstR };
  }
  return null;
}
