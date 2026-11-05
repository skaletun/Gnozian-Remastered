/** Standard pointy-top axial hex centers, matching getNeighbors and hexDistance. */
export const HEX_WORLD_STEP = 1.75;
export const HEX_WORLD_ROW = HEX_WORLD_STEP * Math.sqrt(3) / 2;

/** No Babylon.js dependency so the coordinate system can be regression-tested. */
export function hexWorldPosition(q: number, r: number): { x: number; z: number } {
  return { x: (q + r * 0.5) * HEX_WORLD_STEP, z: r * HEX_WORLD_ROW };
}
