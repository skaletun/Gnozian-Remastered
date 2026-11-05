import type { TerrainType } from '../game/types';
import { TERRAIN_COLORS } from '../game/constants';

export type MapEditorFileV1 = {
  gnozianMap?: 1;
  mapWidth?: number;
  mapHeight?: number;
  terrain?: unknown;
  /** Optional spawn hints (reserved for future engine use). */
  startingSpots?: Array<{ q: number; r: number }>;
};

export type TerrainImportErrorCode =
  | 'rootNotObject'
  | 'missingTerrain'
  | 'terrainRowNotArray'
  | 'mapTooLarge'
  | 'notRectangular'
  | 'unknownTerrain';

export type TerrainImportResult =
  | { ok: true; terrain: TerrainType[][]; w: number; h: number }
  | { ok: false; code: TerrainImportErrorCode; terrainId?: string };

export function cloneTerrainGrid(g: TerrainType[][]): TerrainType[][] {
  return g.map(row => [...row]);
}

/** Map editor / lobby UI: localized label for `validateTerrainImport` failures. */
export function formatTerrainImportError(
  failure: Extract<TerrainImportResult, { ok: false }>,
  tr: (key: string, params?: Record<string, string | number>) => string
): string {
  if (failure.code === 'unknownTerrain') {
    return tr('mapEditor.err.unknownTerrain', { id: failure.terrainId ?? '?' });
  }
  return tr(`mapEditor.err.${failure.code}`);
}

/** Strict validation for JSON map import. */
export function validateTerrainImport(data: unknown): TerrainImportResult {
  if (!data || typeof data !== 'object') return { ok: false, code: 'rootNotObject' };
  const o = data as MapEditorFileV1;
  if (!Array.isArray(o.terrain) || o.terrain.length === 0) {
    return { ok: false, code: 'missingTerrain' };
  }
  const rows = o.terrain as unknown[];
  const h = rows.length;
  const w = Array.isArray(rows[0]) ? (rows[0] as unknown[]).length : 0;
  if (!w) return { ok: false, code: 'terrainRowNotArray' };
  if (h > 240 || w > 520) return { ok: false, code: 'mapTooLarge' };
  const next: TerrainType[][] = [];
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length !== w) {
      return { ok: false, code: 'notRectangular' };
    }
    next[r] = [];
    for (let c = 0; c < w; c++) {
      const cell = String(row[c]) as TerrainType;
      if (!(cell in TERRAIN_COLORS)) {
        return { ok: false, code: 'unknownTerrain', terrainId: String(row[c]) };
      }
      next[r][c] = cell;
    }
  }
  return { ok: true, terrain: next, w, h };
}

/** Replace contiguous region of same terrain as (sr,sc) with `repl`. */
export function floodFillTerrain(
  grid: TerrainType[][],
  sr: number,
  sc: number,
  repl: TerrainType
): TerrainType[][] {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (sr < 0 || sc < 0 || sr >= h || sc >= w) return grid;
  const orig = grid[sr][sc];
  if (orig === repl) return grid;
  const next = cloneTerrainGrid(grid);
  const stack: Array<[number, number]> = [[sr, sc]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    if (r < 0 || c < 0 || r >= h || c >= w) continue;
    if (next[r][c] !== orig) continue;
    next[r][c] = repl;
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  return next;
}
