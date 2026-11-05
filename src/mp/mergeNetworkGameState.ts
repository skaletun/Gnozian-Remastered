import type { GameState } from '../game/types';

/**
 * Apply an authoritative server snapshot without overwriting this client's map pan/zoom.
 * Each multiplayer peer keeps their own camera; the serialized `gameState.camera` on the
 * server reflects whoever last wrote state (often the host), which caused guests' views to jump.
 *
 * `viewCamera` should be the live HUD/map camera — it may differ from `local.camera` because
 * pan/zoom updates `cameraState` in App without always rewriting `gameState.camera`.
 */
export function mergeNetworkGameState(
  local: GameState,
  remote: GameState,
  viewCamera?: { x: number; y: number; zoom: number }
): GameState {
  const cam = viewCamera ?? local.camera;
  return {
    ...remote,
    camera: cam,
  };
}
