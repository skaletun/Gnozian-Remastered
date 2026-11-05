import type { GameState } from '../types';

export function firstContactKey(viewerCivIndex: number, otherCivIndex: number): string {
  return `${viewerCivIndex}_${otherCivIndex}`;
}

export function markCivFirstContactSeen(
  state: GameState,
  viewerCivIndex: number,
  otherCivIndex: number
): GameState {
  const n = state.civilizations.length;
  if (n <= 0) return state;
  const viewer = Math.max(0, Math.min(n - 1, Math.floor(viewerCivIndex)));
  const other = Math.max(0, Math.min(n - 1, Math.floor(otherCivIndex)));
  if (viewer === other) return state;
  const key = firstContactKey(viewer, other);
  const prev = state.systems.civFirstContactSeen ?? {};
  if (prev[key]) return state;
  return {
    ...state,
    systems: {
      ...state.systems,
      civFirstContactSeen: { ...prev, [key]: true },
    },
  };
}
