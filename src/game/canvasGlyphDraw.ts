/**
 * Lightweight canvas glyph helpers used by the visual remaster path.
 * Small vector glyph paths for the visual remaster map overlay (kept separate for bundle clarity).
 */

export type GlyphId =
  | 'wheat' | 'cattle' | 'sheep' | 'fish' | 'deer' | 'gem' | 'spice' | 'silk' | 'iron' | 'coal' | 'oil' | 'uranium' | 'horse'
  | 'farm' | 'mine' | 'mill' | 'pasture' | 'boats' | 'trade'
  | 'settler' | 'civilian' | 'melee' | 'ranged' | 'cavalry' | 'siege' | 'gun' | 'armor' | 'air' | 'nuclear' | 'great' | 'religious'
  | 'star';

const GLYPH_PATHS: Record<GlyphId, string> = {
  wheat: 'M7 18c5-2 8-7 10-13M10 16l-2-3M13 13l-2-3M16 10l-2-3M7 19h10',
  cattle: 'M5 14c0-4 3-6 7-6s7 2 7 6v2H5zM8 8l-2-2M16 8l2-2M9 15v2M15 15v2',
  sheep: 'M6 14c0-3 2-5 6-5s6 2 6 5-2 5-6 5-6-2-6-5zM9 9V7M12 9V6M15 9V7',
  fish: 'M4 12c3-3 7-4 11-2l3-2v8l-3-2c-4 2-8 1-11-2zM17 12h3',
  deer: 'M7 18c1-5 3-8 5-8s4 3 5 8M10 8l-3-3M11 7V4M14 7l3-3M13 7V4',
  gem: 'M6 11l4-5h4l4 5-6 8zM8 11h8',
  spice: 'M8 18c0-4 1-8 4-11 3 3 4 7 4 11M8 18h8',
  silk: 'M6 17c2-4 4-7 6-10 2 3 4 6 6 10M7 17h10',
  iron: 'M5 12h14M12 5v14M7 7l10 10M17 7L7 17',
  coal: 'M6 16l4-8h4l4 8-6 3z',
  oil: 'M12 5c-2 4-5 7-5 10a5 5 0 0 0 10 0c0-3-3-6-5-10z',
  uranium: 'M12 4v6M7 8l5 9M17 8l-5 9M7 18h10',
  horse: 'M7 18c0-4 2-7 5-8l2-3 3 2-2 2c2 2 2 4 2 7M10 9l3 2',
  farm: 'M6 8h12M6 12h12M6 16h12M9 6v12M15 6v12',
  mine: 'M5 18l6-10 3 4 2-6 3 12M4 18h16',
  mill: 'M12 5v14M5 12h14M7 7l10 10M17 7L7 17',
  pasture: 'M5 16h14M7 16V9h10v7M10 9l2-3 2 3',
  boats: 'M5 15h14M7 15l2 3h6l2-3M12 7v8M12 7l3 2M12 7l-3 2',
  trade: 'M4 9h16M6 9v8h12V9M8 13h8',
  settler: 'M12 6a2 2 0 1 0 0.001 0M7 18c0-4 2-6 5-6s5 2 5 6M8 12l-2 2M16 12l2 2',
  civilian: 'M12 7a2.2 2.2 0 1 0 0.001 0M8 18c0-3 2-5 4-5s4 2 4 5',
  melee: 'M7 18L17 6M8 6l9 12M6 17l2 2M16 5l2 2',
  ranged: 'M6 18c4-6 4-10 0-16M6 10h9M15 10l2-1',
  cavalry: 'M6 18c0-4 2-7 5-8l2-3 3 2-2 2c2 2 2 4 2 7',
  siege: 'M5 16h14M8 16l-2-4h12l-2 4M8 12l2-5h4l2 5',
  gun: 'M5 13h11l2 2h2M8 13V9',
  armor: 'M5 16h14M8 16v-4h8v4M9 12l1-3h4l1 3',
  air: 'M4 12h16M12 5l3 7-3 7-3-7z',
  nuclear: 'M12 4v6M7 8l5 9M17 8l-5 9M7 18h10',
  great: 'M12 4l2.5 6H21l-5 4 2 6-6-4-6 4 2-6-5-4h6.5z',
  religious: 'M12 4v12M8 8h8M7 18h10',
  star: 'M12 4l2.5 6H21l-5 4 2 6-6-4-6 4 2-6-5-4h6.5z',
};

export const RESOURCE_GLYPH: Record<string, GlyphId> = {
  wheat: 'wheat', cattle: 'cattle', sheep: 'sheep', fish: 'fish', deer: 'deer',
  gold_ore: 'gem', silver: 'gem', gems: 'gem', spices: 'spice', silk: 'silk',
  iron: 'iron', coal: 'coal', oil: 'oil', uranium: 'uranium', horse: 'horse',
};

const pathCache = new Map<string, Path2D>();

/** Ensures #rrggbb for Canvas gradients (invalid civ colors from saves etc.). */
export function normalizeHexColor(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '#888888';
  let s = input.trim();
  if (!s.startsWith('#')) {
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
      const r = Math.min(255, parseInt(m[1], 10) || 0);
      const g = Math.min(255, parseInt(m[2], 10) || 0);
      const b = Math.min(255, parseInt(m[3], 10) || 0);
      s = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } else {
      return '#888888';
    }
  }
  const hex = s.slice(1).replace(/[^0-9a-fA-F]/g, '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
  if (hex.length === 6) {
    const n = parseInt(hex, 16);
    if (!Number.isFinite(n)) return '#888888';
    return `#${hex.toLowerCase()}`;
  }
  return '#888888';
}

export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: GlyphId,
  x: number,
  y: number,
  size: number,
  color = '#f5f5f5',
  lineWidth = 1.6
): void {
  const d = GLYPH_PATHS[glyph];
  if (!d) return;
  let p = pathCache.get(glyph);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(glyph, p);
  }
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(p);
  ctx.restore();
}
