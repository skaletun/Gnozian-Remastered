import type { GameState } from '../game/types';
import { normalizeStateContract } from '../game/kernel/stateContract';
import { mergeNetworkGameState } from './mergeNetworkGameState';

/** Merge server-authoritative state while preserving this client's camera and validating contract shape. */
export function mergeAuthoritativeMpSnapshot(
  local: GameState,
  remote: GameState,
  viewCamera?: { x: number; y: number; zoom: number; rotation?: number },
): GameState {
  const normalized = normalizeStateContract(remote);
  return mergeNetworkGameState(local, normalized, viewCamera);
}
