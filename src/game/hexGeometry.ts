/** Standard pointy-top axial hex centers, matching getNeighbors and hexDistance. */
export const HEX_WORLD_STEP = 1.75;
export const HEX_WORLD_ROW = HEX_WORLD_STEP * Math.sqrt(3) / 2;

/** No Babylon.js dependency so the coordinate system can be regression-tested. */
export function hexWorldPosition(q: number, r: number): { x: number; z: number } {
  return { x: (q + r * 0.5) * HEX_WORLD_STEP, z: r * HEX_WORLD_ROW };
}


/** Read-only position of the real Babylon OrbitCamera, not legacy 2D pixels. */
export interface WorldCameraView {
  q: number;
  r: number;
  radius: number;
}

/** Inverse of hexWorldPosition, retaining fractional coordinates for a smooth
 * minimap center marker during camera panning. */
export function worldPointToAxial(x: number, z: number): { q: number; r: number } {
  const r = z / HEX_WORLD_ROW;
  return { q: x / HEX_WORLD_STEP - 0.5 * r, r };
}

export function axialToMiniPoint(
  q: number,
  r: number,
  mapColumns: number,
  mapRows: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const cellW = canvasWidth / Math.max(1, mapColumns);
  const cellH = canvasHeight / Math.max(1, mapRows);
  return {
    x: (q + 0.5) * cellW,
    y: (r + 0.5) * cellH,
  };
}

export function miniPointToAxial(
  x: number,
  y: number,
  mapColumns: number,
  mapRows: number,
  canvasWidth: number,
  canvasHeight: number
): { q: number; r: number } {
  const width = Math.max(1, canvasWidth);
  const height = Math.max(1, canvasHeight);
  const columns = Math.max(1, Math.floor(mapColumns));
  const rows = Math.max(1, Math.floor(mapRows));
  const q = Math.min(columns - 1, Math.max(0, Math.floor((x / width) * columns)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor((y / height) * rows)));
  return { q, r };
}
