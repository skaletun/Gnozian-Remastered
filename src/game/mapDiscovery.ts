import type { GameMessage, GameState } from './types';

/** Messages not yet dismissed and visible to the viewer (single fog pass over the map). */
export function visibleMessagesForViewer(
  state: GameState,
  viewerCivIndex: number,
  displayedIds: ReadonlySet<number>
): GameMessage[] {
  const discovered = computeMapDiscoveredCivIndices(state, viewerCivIndex);
  return state.messages.filter(msg => {
    if (displayedIds.has(msg.id)) return false;
    const rel = msg.relatedCivIndices;
    if (!rel?.length) return true;
    return rel.every(i => discovered.has(i));
  });
}

/** Add every civ visually identifiable from tiles the viewer has revealed (explored fog). */
export function computeMapDiscoveredCivIndices(state: GameState, viewerCivIndex: number): Set<number> {
  const n = state.civilizations.length;
  const out = new Set<number>();
  if (n <= 0) return out;
  const viewer = Math.max(0, Math.min(n - 1, Math.floor(viewerCivIndex)));
  out.add(viewer);

  const h = state.tiles.length;
  const w = state.tiles[0]?.length ?? 0;

  const addSlot = (slot: number | null | undefined) => {
    if (slot == null || typeof slot !== 'number' || !Number.isFinite(slot)) return;
    const i = Math.floor(slot);
    if (i >= 0 && i < n) out.add(i);
  };

  const revealedHere = (q: number, r: number): boolean => {
    const tile = state.tiles[r]?.[q];
    if (!tile) return false;
    const arr = tile.revealed;
    return Array.isArray(arr) && arr.length > viewer && !!arr[viewer];
  };

  for (let r = 0; r < h; r++) {
    for (let q = 0; q < w; q++) {
      if (!revealedHere(q, r)) continue;
      const tile = state.tiles[r]![q]!;
      addSlot(tile.owner);
      if (tile.city != null) {
        const city = state.cities.find(c => c.id === tile.city);
        addSlot(city?.owner);
      }
    }
  }

  for (const u of state.units) {
    if (!revealedHere(u.q, u.r)) continue;
    addSlot(u.owner);
  }

  return out;
}

export function civKnownFromExplorerFog(state: GameState, viewerCivIndex: number, civIndex: number): boolean {
  return computeMapDiscoveredCivIndices(state, viewerCivIndex).has(civIndex);
}

export function messageVisibleToViewer(state: GameState, viewerCivIndex: number, msg: Pick<GameMessage, 'relatedCivIndices'>): boolean {
  const rel = msg.relatedCivIndices;
  if (!rel?.length) return true;
  const discovered = computeMapDiscoveredCivIndices(state, viewerCivIndex);
  return rel.every(i => discovered.has(i));
}
