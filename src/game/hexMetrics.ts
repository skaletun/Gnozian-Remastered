/**
 * Shared flat-top hex layout (same math as the map canvas). No DOM/canvas imports.
 */

export const TILE_W = 216;
export const TILE_H = 174;
export const TILE_HALF_W = TILE_W / 2;
export const TILE_HALF_H = TILE_H / 2;

/** Nominal viewport used when initializing camera before the real canvas size is known. */
export const INITIAL_VIEWPORT = { w: 1280, h: 720 };

/**
 * Canonical 2D camera state (no 3D yaw/pitch/distance).
 * `rotation` is reserved for in-plane map rotation and may be omitted (defaults to 0).
 */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation?: number;
}

export function gridToScreen(q: number, r: number, zoom = 1): { x: number; y: number } {
  const x = (q + r * 0.5) * TILE_W * zoom;
  const y = r * TILE_H * 0.75 * zoom;
  return { x, y };
}

export function screenToGrid(sx: number, sy: number, camX: number, camY: number, zoom: number): { q: number; r: number } {
  const wx = (sx + camX) / zoom;
  const wy = (sy + camY) / zoom;
  const rr = Math.round(wy / (TILE_H * 0.75));
  const qq = Math.round(wx / TILE_W - rr * 0.5);
  return { q: qq, r: rr };
}

/** Visible axial tile bounds from viewport corners (handles isometric skew). */
export function visibleTileBounds(
  camX: number,
  camY: number,
  zoom: number,
  viewportW: number,
  viewportH: number,
  mapW: number,
  mapH: number,
  margin = 3
): { startQ: number; startR: number; endQ: number; endR: number } {
  const samples: { q: number; r: number }[] = [];
  const stepX = Math.max(1, viewportW / 8);
  const stepY = Math.max(1, viewportH / 8);
  for (let sx = 0; sx <= viewportW; sx += stepX) {
    for (let sy = 0; sy <= viewportH; sy += stepY) {
      samples.push(screenToGrid(sx, sy, camX, camY, zoom));
    }
  }
  let minQ = Infinity;
  let maxQ = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const { q, r } of samples) {
    minQ = Math.min(minQ, q);
    maxQ = Math.max(maxQ, q);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
  }
  if (!Number.isFinite(minQ)) {
    return { startQ: 0, startR: 0, endQ: Math.max(0, mapW - 1), endR: Math.max(0, mapH - 1) };
  }
  return {
    startQ: Math.max(0, minQ - margin),
    startR: Math.max(0, minR - margin),
    endQ: Math.min(mapW - 1, maxQ + margin),
    endR: Math.min(mapH - 1, maxR + margin),
  };
}
