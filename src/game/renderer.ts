import type { GameState, Tile, Unit } from './types';
import { TERRAIN_COLORS, NATURAL_RESOURCES } from './constants';
import { GRAPHICS_ATMOSPHERE, DEFAULT_GRAPHICS, type AtmosphereWeatherLevel, type GraphicsSettings } from './settingsConstants';
import {
  TILE_W,
  TILE_H,
  TILE_HALF_W,
  TILE_HALF_H,
  gridToScreen,
  visibleTileBounds,
} from './hexMetrics';
import { getNeighbors, hexDistance } from './mapgen';
import { reachableHexMovementCosts } from './pathfinding';
import { isHexInStrikeZone } from './movementPreview';
import { effectiveRangedAttackRange } from './movementRules';

export { TILE_W, TILE_H, TILE_HALF_W, TILE_HALF_H, gridToScreen, screenToGrid } from './hexMetrics';

// ============================================================
// DRAW HELPERS
// ============================================================
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const hw = w / 2;
  const hh = h / 2;
  const qh = h * 0.25;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy - qh);
  ctx.lineTo(cx + hw, cy + qh);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy + qh);
  ctx.lineTo(cx - hw, cy - qh);
  ctx.closePath();
}

/** Bold centered label with dark outline (readable on terrain at any zoom). */
function drawOutlinedHexFooter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  fillColor: string,
  zoom: number
): void {
  const px = Math.max(11, Math.min(17, 12 * Math.sqrt(Math.max(0.25, zoom))));
  ctx.save();
  ctx.font = `800 ${px}px ui-sans-serif,system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.lineWidth = Math.max(3, px * 0.32);
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

const lightenCache = new Map<string, string>();
const terrainShadeCache = new Map<string, { base: string; light: string; dark: string; border: string }>();

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

function rgbaFromHex(hex: string, alpha: number): string {
  const safe = normalizeHexColor(hex);
  const n = parseInt(safe.slice(1), 16);
  if (!Number.isFinite(n)) return `rgba(136,136,136,${alpha})`;
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenColor(color: string, amount: number): string {
  const safe = normalizeHexColor(color);
  const key = `${safe}|${amount}`;
  const hit = lightenCache.get(key);
  if (hit) return hit;
  const num = parseInt(safe.slice(1), 16);
  if (!Number.isFinite(num)) return '#888888';
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  const out = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  if (lightenCache.size > 400) lightenCache.clear();
  lightenCache.set(key, out);
  return out;
}

function darkenColor(color: string, amount: number): string {
  return lightenColor(color, -amount);
}

function terrainShades(terrain: string): { base: string; light: string; dark: string; border: string } {
  const hit = terrainShadeCache.get(terrain);
  if (hit) return hit;
  const base = normalizeHexColor((TERRAIN_COLORS as Record<string, string>)[terrain] ?? '#666666');
  const out = {
    base,
    light: lightenColor(base, 22),
    dark: darkenColor(base, 28),
    border: darkenColor(base, 45),
  };
  terrainShadeCache.set(terrain, out);
  return out;
}

function terrainReliefHeight(terrain: string): number {
  switch (terrain) {
    case 'ocean': return -2.2;
    case 'coast': return -1.2;
    case 'plains': return 0.1;
    case 'grassland': return 0.25;
    case 'desert': return 0.05;
    case 'tundra': return 0.15;
    case 'snow': return 0.2;
    case 'forest': return 0.45;
    case 'jungle': return 0.55;
    case 'hills': return 1.25;
    case 'mountains': return 2.2;
    default: return 0;
  }
}

// Draw a rounded rectangle path
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

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

const IMPROVEMENT_GLYPH: Record<string, GlyphId> = {
  farm: 'farm',
  mine: 'mine',
  lumber_mill: 'mill',
  pasture: 'pasture',
  fishing_boats: 'boats',
  trading_post: 'trade',
};

const UNIT_GLYPH: Record<string, GlyphId> = {
  settler: 'settler',
  worker: 'civilian',
  warrior: 'melee',
  archer: 'ranged',
  spearman: 'melee',
  horseman: 'cavalry',
  catapult: 'siege',
  swordsman: 'melee',
  knight: 'cavalry',
  musketman: 'gun',
  cannon: 'siege',
  rifleman: 'gun',
  cavalry: 'cavalry',
  artillery: 'siege',
  infantry: 'gun',
  tank: 'armor',
  fighter: 'air',
  bomber: 'air',
  nuclear_missile: 'nuclear',
  great_general: 'great',
  great_scientist: 'great',
  great_artist: 'great',
  great_merchant: 'great',
  great_engineer: 'great',
  great_writer: 'great',
  great_musician: 'great',
  great_prophet: 'great',
  great_admiral: 'great',
  missionary: 'religious',
};

const pathCache = new Map<string, Path2D>();

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

// ============================================================
// PARTICLE SYSTEM (soft blobs, sparks, mist)
// ============================================================
type ParticleKind = 'soft' | 'spark' | 'mist';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: ParticleKind;
  drag: number;
  gravity: number;
}

const particles: Particle[] = [];
let lastParticleTime = 0;
const MAX_PARTICLES = 520;

function trimParticles(): void {
  while (particles.length > MAX_PARTICLES) particles.shift();
}

function pushParticle(p: Particle): void {
  trimParticles();
  particles.push(p);
}

interface TerrainLayerCache {
  canvas: HTMLCanvasElement;
  offsetX: number;
  offsetY: number;
  key: string;
  tileMarks: string[][];
}

let terrainLayerCache: TerrainLayerCache | null = null;

interface EntityLayerCache {
  canvas: HTMLCanvasElement;
  offsetX: number;
  offsetY: number;
  key: string;
  marks: Map<string, string>;
}

let entityLayerCache: EntityLayerCache | null = null;
let renderSessionKey = '';

/** Tracks fog-of-war reveals for a short “wave” overlay when tiles become revealed. */
let revealPrevRevealed: Uint8Array | null = null;
const revealWaveStart = new Map<string, number>();
const territoryOwnerSeen = new Map<string, number>();
const territoryGrowthStart = new Map<string, number>();
let lastWeatherParticleBurst = 0;

/** Full reset (new game / map session): terrain, entities, particles, fog-reveal wave tracking. */
export function invalidateRenderCaches(): void {
  invalidateMapLayerCaches();
  revealPrevRevealed = null;
  revealWaveStart.clear();
  territoryOwnerSeen.clear();
  territoryGrowthStart.clear();
}

/**
 * Drop cached terrain/entity canvases and particles — safe on every redraw trigger.
 * Does **not** clear fog-reveal wave tracking (that must survive interaction ticks so new reveals animate).
 */
export function invalidateMapLayerCaches(): void {
  terrainLayerCache = null;
  entityLayerCache = null;
  particles.length = 0;
}

function spawnParticle(
  x: number,
  y: number,
  color: string,
  speed = 1,
  extra?: Partial<Pick<Particle, 'vx' | 'vy' | 'size' | 'maxLife' | 'kind' | 'drag' | 'gravity'>>
): void {
  const kind = extra?.kind ?? 'soft';
  const life = extra?.maxLife ?? 0.75 + Math.random() * 0.65;
  pushParticle({
    x,
    y,
    vx: extra?.vx ?? (Math.random() - 0.5) * 0.9 * speed,
    vy: extra?.vy ?? (-Math.random() * 1.35 * speed - (kind === 'mist' ? 0.08 : 0.32)),
    life,
    maxLife: life,
    color,
    size: extra?.size ?? (kind === 'mist' ? 4 + Math.random() * 6 : kind === 'spark' ? 1 + Math.random() * 1.4 : 2 + Math.random() * 2.8),
    kind,
    drag: extra?.drag ?? (kind === 'mist' ? 0.988 : 0.991),
    gravity: extra?.gravity ?? (kind === 'spark' ? 0.055 : kind === 'mist' ? 0.006 : 0.022),
  });
}

function spawnSparkBurst(x: number, y: number, color: string, count: number): void {
  for (let k = 0; k < count; k++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (0.9 + Math.random() * 1.6) * 0.85;
    spawnParticle(x, y, color, 1, {
      kind: 'spark',
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.55 - 0.9,
      maxLife: 0.28 + Math.random() * 0.22,
      size: 0.8 + Math.random() * 0.9,
      gravity: 0.07,
      drag: 0.968,
    });
  }
}

function updateAndDrawParticles(ctx: CanvasRenderingContext2D, dt: number, enabled: boolean): void {
  if (!enabled) {
    particles.length = 0;
    return;
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= p.drag;
    p.vy *= p.drag;
    const t = Math.max(0, p.life / p.maxLife);
    const alpha = t * (p.kind === 'mist' ? 0.38 : 0.88);

    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);

    if (p.kind === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.1 + t;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2.8, p.y - p.vy * 2.8);
      ctx.stroke();
    } else {
      const rad = p.size * (0.55 + 0.45 * t) * (p.kind === 'mist' ? 2.2 : 1.35);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 2.1);
      g.addColorStop(0, p.color);
      const midAlpha = p.kind === 'mist' ? 0.1 + 0.2 * t : 0.22 + 0.45 * t;
      const mid = rgbaFromHex(normalizeHexColor(p.color), Math.min(0.95, midAlpha));
      g.addColorStop(0.48, mid);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(width));
  c.height = Math.max(1, Math.floor(height));
  return c;
}

/** Fog arrays are per-civ; clamp index so edge cases never read undefined (was hiding entities). */
function getCivFog(tile: Tile, civIndex: number): { revealed: boolean; visible: boolean } {
  const len = tile.revealed?.length ?? 0;
  if (len === 0) {
    if (tile.owner != null && Math.floor(civIndex) === tile.owner) return { revealed: true, visible: true };
    return { revealed: false, visible: false };
  }
  const i = Math.max(0, Math.min(len - 1, Math.floor(civIndex)));
  const revealed = !!tile.revealed[i] || (tile.owner != null && tile.owner === i);
  const visible = !!tile.visible[i] || (tile.owner != null && tile.owner === i);
  return { revealed, visible };
}

function tileMark(state: GameState, q: number, r: number, humanCivIndex: number): string {
  const tile = state.tiles[r]?.[q];
  if (!tile) return '';
  const { revealed, visible } = getCivFog(tile, humanCivIndex);
  const r1 = revealed ? 1 : 0;
  const v1 = visible ? 1 : 0;
  const owner = tile.owner ?? -1;
  return `${tile.terrain}|${tile.resource ?? '-'}|${tile.improvement}|${owner}|${r1}|${v1}`;
}

function drawStaticTile(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  q: number,
  r: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  humanCivIndex: number,
  showLighting: boolean,
  showTerrainDetails: boolean,
  _showTerritory: boolean,
  showGrid: boolean,
  isLowQuality: boolean,
  showShadows: boolean,
  isUltra: boolean,
  clearBeforeDraw: boolean
): void {
  const tile = state.tiles[r]?.[q];
  if (!tile) return;

  const { revealed, visible } = getCivFog(tile, humanCivIndex);
  const { x, y } = gridToScreen(q, r, zoom);
  const sx = x + offsetX;
  const sy = y + offsetY;
  const hexW = TILE_W * zoom;
  const hexH = TILE_H * zoom;

  if (clearBeforeDraw) {
    // Patch-up used to clear an axis-aligned rect; AA hex strokes and neighbor colors left
    // wedge-shaped remnants at edges when fog/reveal changed. Clip to an inflated hex and
    // solid-fill with the terrain cache backdrop so the cell fully resets before redraw.
    const bleed = Math.max(4, zoom * 6);
    ctx.save();
    hexPath(ctx, sx, sy, hexW + bleed * 2, hexH + bleed * 2);
    ctx.clip();
    ctx.fillStyle = '#0d1520';
    const span = hexW + hexH + bleed * 8;
    ctx.fillRect(sx - span, sy - span, span * 2, span * 2);
    ctx.restore();
  }

  ctx.save();

  if (!revealed) {
    hexPath(ctx, sx, sy, hexW, hexH);
    ctx.fillStyle = '#080e18';
    ctx.fill();
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const shades = terrainShades(tile.terrain);
  const qualityBoost = isUltra ? 1.18 : 1;
  // Relief-aware shade: compare current tile height with nearby heights.
  let localRelief = 0;
  {
    const centerH = terrainReliefHeight(tile.terrain);
    let sum = 0;
    let n = 0;
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
    ] as const;
    for (const [dq, dr] of dirs) {
      const nt = state.tiles[r + dr]?.[q + dq];
      if (!nt) continue;
      sum += terrainReliefHeight(nt.terrain);
      n++;
    }
    if (n > 0) {
      const avg = sum / n;
      localRelief = Math.max(-1.2, Math.min(1.2, centerH - avg));
    }
  }

  if (showShadows && visible && tile.terrain !== 'ocean' && tile.terrain !== 'coast') {
    ctx.save();
    hexPath(ctx, sx + 1, sy + 2, hexW, hexH);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.restore();
  }

  hexPath(ctx, sx, sy, hexW, hexH);
  if (showLighting) {
    const sunBias = visible ? 0.08 : 0.03;
    const grad = ctx.createLinearGradient(
      sx - TILE_HALF_W * zoom * 1.05,
      sy - TILE_HALF_H * zoom * 1.02,
      sx + TILE_HALF_W * zoom * 0.72,
      sy + TILE_HALF_H * zoom * 1.08
    );
    grad.addColorStop(
      0,
      lightenColor(
        shades.light,
        Math.round((8 + sunBias * 40 + Math.max(0, localRelief) * (isUltra ? 22 : 14)) * qualityBoost)
      )
    );
    grad.addColorStop(0.28, shades.light);
    grad.addColorStop(0.52, shades.base);
    grad.addColorStop(0.82, darkenColor(shades.dark, Math.round(Math.max(0, -localRelief) * (isUltra ? 9 : 5))));
    grad.addColorStop(1, darkenColor(shades.dark, (isUltra ? 14 : 6) + Math.round(Math.max(0, -localRelief) * (isUltra ? 14 : 8))));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = shades.base;
  }
  ctx.fill();

  // Subtle AO + rim-light pass adds volume without extra geometry.
  if (showLighting && visible && !isLowQuality) {
    ctx.save();
    hexPath(ctx, sx, sy, hexW * 0.98, hexH * 0.98);
    const ao = ctx.createRadialGradient(sx, sy + hexH * 0.12, hexW * 0.12, sx, sy + hexH * 0.18, hexW * 0.58);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, isUltra ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.12)');
    ctx.fillStyle = ao;
    ctx.fill();
    hexPath(ctx, sx, sy - 1, hexW * 0.94, hexH * 0.94);
    ctx.strokeStyle = isUltra ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)';
    ctx.lineWidth = isUltra ? 0.95 : 0.7;
    ctx.stroke();
    ctx.restore();
  }

  if (showTerrainDetails) {
    ctx.save();
    hexPath(ctx, sx, sy - 1, hexW * 0.92, hexH * 0.92);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = shades.border;
  ctx.lineWidth = isLowQuality ? 0.5 : isUltra ? 0.95 : 0.8;
  ctx.stroke();

  if (showGrid && visible) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  if (!visible) {
    hexPath(ctx, sx, sy, hexW, hexH);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,100,120,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  if (tile.resource && visible && zoom > 0.55) {
    const glyph = RESOURCE_GLYPH[tile.resource] ?? 'gem';
    const rx = sx;
    const ry = sy + TILE_HALF_H * zoom * 0.32;
    const resourceDef = NATURAL_RESOURCES[tile.resource];
    const strategic = resourceDef?.type === 'strategic';
    if (strategic) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const ringRadius = 12 * zoom;
      ctx.beginPath();
      ctx.arc(rx, ry, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(120, 210, 255, 0.85)';
      ctx.lineWidth = 1.35;
      ctx.stroke();
      const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, ringRadius * 1.8);
      glow.addColorStop(0, 'rgba(80, 180, 255, 0.24)');
      glow.addColorStop(1, 'rgba(80, 180, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(rx, ry, ringRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    roundRectPath(ctx, rx - 10 * zoom, ry - 6 * zoom, 20 * zoom, 12 * zoom, 3.5 * zoom);
    ctx.fillStyle = strategic ? 'rgba(12, 20, 34, 0.82)' : 'rgba(10, 12, 16, 0.65)';
    ctx.fill();
    ctx.strokeStyle = strategic ? 'rgba(120,210,255,0.85)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = strategic ? 1.2 : 0.85;
    ctx.stroke();
    drawGlyph(ctx, glyph, rx, ry, Math.max(10, 12 * zoom), '#e8f0ff', 1.75);
    if (isUltra) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = strategic ? 'rgba(125,220,255,0.18)' : 'rgba(255,230,170,0.13)';
      ctx.beginPath();
      ctx.arc(rx + 3 * zoom, ry - 3 * zoom, 2.2 * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (tile.improvement !== 'none' && visible && zoom > 0.55) {
    const glyph = IMPROVEMENT_GLYPH[tile.improvement];
    if (glyph) {
      const ix = sx + TILE_HALF_W * zoom * 0.5;
      const iy = sy - TILE_HALF_H * zoom * 0.5;
      roundRectPath(ctx, ix - 7 * zoom, iy - 4.5 * zoom, 14 * zoom, 9 * zoom, 2.5 * zoom);
      ctx.fillStyle = 'rgba(20, 24, 28, 0.65)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      drawGlyph(ctx, glyph, ix, iy, Math.max(7.5, 8.8 * zoom), '#f3f4f6', 1.55);
    }
  }

  if (showTerrainDetails && visible) {
    ctx.save();
    if (tile.terrain === 'forest' || tile.terrain === 'jungle') {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath();
      ctx.arc(sx - 8 * zoom, sy + 5 * zoom, 2 * zoom, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile.terrain === 'hills') {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.arc(sx + 6 * zoom, sy - 3 * zoom, 1.5 * zoom, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile.terrain === 'ocean' || tile.terrain === 'coast') {
      ctx.strokeStyle = 'rgba(200,235,255,0.08)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx - hexW * 0.22, sy + hexH * 0.08);
      ctx.lineTo(sx + hexW * 0.2, sy + hexH * 0.03);
      ctx.stroke();
    } else if (tile.terrain === 'desert') {
      ctx.fillStyle = 'rgba(255,230,160,0.08)';
      ctx.beginPath();
      ctx.ellipse(sx + 3 * zoom, sy + 2 * zoom, 2.2 * zoom, 1.15 * zoom, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (isUltra && visible && showTerrainDetails) {
    ctx.save();
    if (tile.terrain === 'mountains' || tile.terrain === 'hills') {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx - 4 * zoom, sy - 2 * zoom);
      ctx.lineTo(sx + 5 * zoom, sy - 5 * zoom);
      ctx.stroke();
    }
    if (tile.terrain === 'snow' || tile.terrain === 'tundra') {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(sx + 4 * zoom, sy - 4 * zoom, 0.9 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    if (tile.terrain === 'desert' || tile.terrain === 'plains') {
      ctx.fillStyle = 'rgba(255,240,200,0.07)';
      ctx.beginPath();
      ctx.arc(sx - 5 * zoom, sy + 3 * zoom, 1.1 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    if (tile.terrain === 'forest' || tile.terrain === 'jungle') {
      for (let fi = 0; fi < 3; fi++) {
        const ox = (fi - 1) * 5 * zoom;
        ctx.fillStyle = fi === 1 ? 'rgba(120,200,120,0.12)' : 'rgba(40,90,40,0.1)';
        ctx.beginPath();
        ctx.ellipse(sx + ox, sy + 6 * zoom, 1.8 * zoom, 1 * zoom, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  ctx.restore();
}

function entityMarkForTile(state: GameState, q: number, r: number, humanCivIndex: number): string | null {
  const tile = state.tiles[r]?.[q];
  if (!tile) return null;
  const fog = getCivFog(tile, humanCivIndex);
  if (!fog.visible && !fog.revealed) return null;

  const city = state.cities.find(c => c.q === q && c.r === r);
  const units = state.units
    .filter(u => u.q === q && u.r === r)
    .sort((a, b) => a.id - b.id);
  if (!city && units.length === 0) return null;

  const cityPart = city
    ? `c:${city.id}:${city.owner}:${city.population}:${city.hp}:${city.isCapital ? 1 : 0}`
    : 'c:-';
  const unitsPart = units.length
    ? `u:${units.map(u => `${u.id}:${u.owner}:${u.type}:${u.hp}`).join(',')}`
    : 'u:-';
  // Include fog so entity layer invalidates when LOS/reveal changes without units moving.
  const fogKey = `${fog.revealed ? 1 : 0}${fog.visible ? 1 : 0}`;
  return `${fogKey}|${cityPart}|${unitsPart}`;
}

function drawEntityTile(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  q: number,
  r: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  humanCivIndex: number,
  isLowQuality: boolean,
  showShadows: boolean,
  isUltra: boolean
): void {
  const tile = state.tiles[r]?.[q];
  if (!tile) return;
  const fog = getCivFog(tile, humanCivIndex);
  if (!fog.revealed && !fog.visible) return;

  const { x, y } = gridToScreen(q, r, zoom);
  const sx = x + offsetX;
  const sy = y + offsetY;

  const city = state.cities.find(c => c.q === q && c.r === r);
  if (city) {
    const ownerCiv = state.civilizations[city.owner];
    const civColor = normalizeHexColor(ownerCiv?.color || '#888888');
    const citySize = Math.max(8, (12 + city.population * 2) * zoom);
    const floatOffset = 0;

    if (showShadows) {
      ctx.save();
      ctx.shadowColor = isUltra ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = (isUltra ? 16 : 12) * zoom;
      ctx.shadowOffsetY = (isUltra ? 5 : 4) * zoom;
      const hi0 = isUltra ? 52 : 40;
      const cityGrad = ctx.createRadialGradient(sx, sy + floatOffset - citySize * 0.3, 0, sx, sy + floatOffset, citySize * (isUltra ? 1.05 : 1));
      cityGrad.addColorStop(0, lightenColor(civColor, hi0));
      cityGrad.addColorStop(0.45, civColor);
      cityGrad.addColorStop(0.82, darkenColor(civColor, isUltra ? 22 : 30));
      cityGrad.addColorStop(1, darkenColor(civColor, isUltra ? 38 : 30));
      ctx.beginPath();
      ctx.arc(sx, sy + floatOffset, citySize, 0, Math.PI * 2);
      ctx.fillStyle = cityGrad;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy + floatOffset, citySize, 0, Math.PI * 2);
      ctx.fillStyle = civColor;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(sx, sy + floatOffset, citySize, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (city.isCapital) {
      if (isUltra) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy + floatOffset, Math.max(10, 14 * zoom) * 1.35, 0, Math.PI * 2);
        const sg = ctx.createRadialGradient(sx, sy + floatOffset, 0, sx, sy + floatOffset, Math.max(10, 14 * zoom) * 1.5);
        sg.addColorStop(0, 'rgba(255, 220, 120, 0.45)');
        sg.addColorStop(1, 'rgba(255, 200, 60, 0)');
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.restore();
      }
      drawGlyph(ctx, 'star', sx, sy + floatOffset, Math.max(10, 14 * zoom), '#FFD700', isUltra ? 2.25 : 2.05);
    }

    if (zoom > 0.45) {
      const fontSize = Math.max(9, 13 * zoom);
      ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const textWidth = ctx.measureText(city.name).width;
      const labelY = sy + floatOffset + citySize + 4;
      const padX = 6;
      const padY = 3;
      roundRectPath(ctx, sx - textWidth / 2 - padX, labelY - padY, textWidth + padX * 2, fontSize + padY * 2, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(city.name, sx, labelY + 1);

      if (zoom > 0.65) {
        const popStr = `Pop:${city.population} HP:${city.hp}`;
        const popFontSize = Math.max(7, 10 * zoom);
        ctx.font = `${popFontSize}px "Segoe UI", sans-serif`;
        const pw = ctx.measureText(popStr).width;
        const popY = labelY + fontSize + 6;
        roundRectPath(ctx, sx - pw / 2 - 3, popY - 1, pw + 6, popFontSize + 4, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.fillStyle = '#aef';
        ctx.fillText(popStr, sx, popY + 1);
      }

      const currentProd = city.productionQueue[0];
      if (currentProd && zoom > 0.58) {
        const prodPct = Math.max(0, Math.min(1, currentProd.cost > 0 ? currentProd.progress / currentProd.cost : 1));
        const prodY = sy + floatOffset - citySize - 20;
        const prodW = Math.max(26, 42 * zoom);
        const prodH = 4;
        roundRectPath(ctx, sx - prodW / 2, prodY, prodW, prodH, 2);
        ctx.fillStyle = 'rgba(20,20,20,0.75)';
        ctx.fill();
        roundRectPath(ctx, sx - prodW / 2, prodY, prodW * prodPct, prodH, 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.font = `${Math.max(7, 9 * zoom)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffd79a';
        ctx.fillText('Producing', sx, prodY - 1);
        if (prodPct >= 0.9) {
          ctx.font = `${Math.max(7, 8.5 * zoom)}px "Segoe UI", sans-serif`;
          ctx.fillStyle = '#9df3b2';
          ctx.fillText('Ready soon', sx, prodY - 11);
        }
      } else if (zoom > 0.62) {
        const tagY = sy + floatOffset - citySize - 18;
        const label = 'Idle';
        ctx.font = `${Math.max(7, 9 * zoom)}px "Segoe UI", sans-serif`;
        const tw = ctx.measureText(label).width;
        roundRectPath(ctx, sx - tw / 2 - 4, tagY - 9, tw + 8, 11, 3);
        ctx.fillStyle = 'rgba(35,35,35,0.72)';
        ctx.fill();
        ctx.fillStyle = '#c5c5c5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, sx, tagY - 3.5);
      }
    }

    if (zoom > 0.56) {
      const recentCityEvent = state.messages
        .slice(0, 8)
        .find(
          m =>
            m.turn >= Math.max(1, state.turn - 1) &&
            (m.type === 'city' || m.type === 'wonder' || m.type === 'disaster') &&
            m.text.toLowerCase().includes(city.name.toLowerCase())
        );
      if (recentCityEvent) {
        const bx = sx + citySize * 0.72;
        const by = sy - citySize * 0.68;
        const color =
          recentCityEvent.type === 'disaster'
            ? '#ef4444'
            : recentCityEvent.type === 'wonder'
              ? '#a78bfa'
              : '#f59e0b';
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(4.5, 6.3 * zoom), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(7, 9 * zoom)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', bx, by + 0.5);
        ctx.restore();
      }
    }

    if (city.hp < city.maxHp) {
      const barW = 44 * zoom;
      const barH = 5;
      const bx = sx - barW / 2;
      const by = sy + floatOffset - citySize - 10;
      roundRectPath(ctx, bx, by, barW, barH, 2);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();
      const hpPct = city.hp / city.maxHp;
      roundRectPath(ctx, bx, by, barW * hpPct, barH, 2);
      ctx.fillStyle = hpPct > 0.5 ? '#2ecc71' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
      ctx.fill();
    }
  }

  const tileUnits = state.units
    .filter(u => u.q === q && u.r === r)
    .sort((a, b) => a.id - b.id);
  if (tileUnits.length === 0) return;

  const unit = tileUnits[0];
  const ownerCiv = state.civilizations[unit.owner];
  const civColor = normalizeHexColor(ownerCiv?.color || '#888888');
  const inSight = fog.visible;
  const ux = sx + (city ? 20 * zoom : 0);
  const uy = sy - 10 * zoom;
  const unitSize = Math.max(6, 11 * zoom);
  if (inSight && !isLowQuality) {
    ctx.save();
    ctx.fillStyle = isUltra ? 'rgba(0,0,0,0.26)' : 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(ux, uy + unitSize * 0.82, unitSize * 0.9, unitSize * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const canAct =
    unit.owner === humanCivIndex &&
    fog.visible &&
    unit.movement > 0 &&
    !unit.hasAttacked;

  if (showShadows && inSight) {
    const unitGrad = ctx.createRadialGradient(ux, uy - unitSize * 0.3, 0, ux, uy, unitSize * (isUltra ? 1.08 : 1));
    unitGrad.addColorStop(0, lightenColor(civColor, isUltra ? 48 : 35));
    unitGrad.addColorStop(0.55, civColor);
    unitGrad.addColorStop(1, darkenColor(civColor, isUltra ? 18 : 25));
    ctx.beginPath();
    ctx.arc(ux, uy, unitSize, 0, Math.PI * 2);
    ctx.fillStyle = unitGrad;
    ctx.fill();
    if (isUltra) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(ux - unitSize * 0.25, uy - unitSize * 0.35, unitSize * 0.35, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    ctx.beginPath();
    ctx.arc(ux, uy, unitSize, 0, Math.PI * 2);
    ctx.fillStyle = inSight ? civColor : darkenColor(civColor, 15);
    ctx.fill();
  }
  ctx.strokeStyle = inSight ? '#fff' : 'rgba(255,255,255,0.75)';
  ctx.lineWidth = isUltra ? 1.8 : 1.5;
  ctx.stroke();

  if (zoom > 0.45 && (inSight || fog.revealed)) {
    drawGlyph(
      ctx,
      UNIT_GLYPH[unit.type] ?? 'civilian',
      ux,
      uy,
      Math.max(8, 11 * zoom),
      inSight ? '#fff' : 'rgba(255,255,255,0.72)',
      1.7
    );
  }

  if (canAct && zoom > 0.55) {
    ctx.save();
    ctx.strokeStyle = 'rgba(80,220,120,0.85)';
    ctx.lineWidth = Math.max(1.1, 1.8 * zoom);
    ctx.setLineDash([3 * zoom, 2 * zoom]);
    ctx.beginPath();
    ctx.arc(ux, uy, unitSize + 4 * zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (inSight && isUltra && zoom > 0.62) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(ux, uy, unitSize + 1.8 * zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (unit.hp < unit.maxHp && inSight) {
    const barW = 26 * zoom;
    const barH = 4;
    const bx = ux - barW / 2;
    const by = uy + unitSize + 3;
    roundRectPath(ctx, bx, by, barW, barH, 2);
    ctx.fillStyle = '#2a2a2a';
    ctx.fill();
    const hpPct = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
    roundRectPath(ctx, bx, by, barW * hpPct, barH, 2);
    const hpColor = unit.hp > 60 ? '#2ecc71' : unit.hp > 30 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = hpColor;
    ctx.fill();
  }

  if (zoom > 0.58 && inSight) {
    const canActNow = unit.owner === humanCivIndex && unit.movement > 0 && !unit.hasAttacked;
    const lowHp = unit.hp <= Math.max(30, unit.maxHp * 0.35);
    const turnDone = unit.owner === humanCivIndex && (unit.movement <= 0 || unit.hasAttacked);

    if (canActNow || lowHp || turnDone) {
      const badgeX = ux + unitSize * 0.85;
      const badgeY = uy - unitSize * 0.85;
      let color = '#22c55e';
      let symbol = '!';
      if (lowHp) {
        color = '#ef4444';
        symbol = '!';
      } else if (turnDone) {
        color = '#6b7280';
        symbol = '-';
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, Math.max(4.2, 5.8 * zoom), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(7, 8.5 * zoom)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, badgeX, badgeY + 0.3);
      ctx.restore();
    }
  }

  if (tileUnits.length > 1 && inSight && zoom > 0.5) {
    ctx.font = `bold ${Math.max(7, 10 * zoom)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const badgeX = ux + unitSize + 1;
    const badgeY = uy - unitSize - 1;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 7 * zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(`×${tileUnits.length}`, badgeX, badgeY + 0.5);
  }
}

function ensureEntityLayer(
  state: GameState,
  zoom: number,
  graphics: GraphicsSettings,
  humanCivIndex: number,
  isLowQuality: boolean,
  showShadows: boolean
): EntityLayerCache {
  const mapH = state.tiles.length;
  const mapW = state.tiles[0]?.length ?? 0;
  const isUltraEntity = graphics.quality === 'ultra' || graphics.quality === 'cinematic';
  const key = `${mapW}x${mapH}|z:${zoom.toFixed(3)}|q:${graphics.quality}|S:${showShadows ? 1 : 0}|U:${isUltraEntity ? 1 : 0}`;

  const { minX, maxX, minY, maxY } = getMapPixelBounds(mapW, mapH, zoom);
  const marginX = TILE_W * zoom * 1.35;
  const marginY = TILE_H * zoom * 1.7;
  const width = Math.ceil(maxX - minX + marginX * 2);
  const height = Math.ceil(maxY - minY + marginY * 2);
  const offsetX = -minX + marginX;
  const offsetY = -minY + marginY;

  const nextMarks = new Map<string, string>();
  for (const city of state.cities) {
    const mark = entityMarkForTile(state, city.q, city.r, humanCivIndex);
    if (mark) nextMarks.set(`${city.q},${city.r}`, mark);
  }
  for (const unit of state.units) {
    const mark = entityMarkForTile(state, unit.q, unit.r, humanCivIndex);
    if (mark) nextMarks.set(`${unit.q},${unit.r}`, mark);
  }

  if (entityLayerCache && entityLayerCache.key === key) {
    const ctx = entityLayerCache.canvas.getContext('2d');
    if (ctx) {
      const changed = new Set<string>();
      for (const [k, mark] of nextMarks) {
        if (entityLayerCache.marks.get(k) !== mark) changed.add(k);
      }
      for (const k of entityLayerCache.marks.keys()) {
        if (!nextMarks.has(k)) changed.add(k);
      }
      if (changed.size > 0) {
        const rebuildThreshold = Math.max(90, Math.floor(mapW * mapH * 0.05));
        if (changed.size >= rebuildThreshold) {
          entityLayerCache = null;
          return ensureEntityLayer(
            state,
            zoom,
            graphics,
            humanCivIndex,
            isLowQuality,
            showShadows
          );
        }
        const redraw = new Set<string>();
        const addRing = (q: number, r: number) => {
          redraw.add(`${q},${r}`);
          for (const n of getNeighbors(q, r, mapW, mapH)) {
            redraw.add(`${n.q},${n.r}`);
            for (const n2 of getNeighbors(n.q, n.r, mapW, mapH)) {
              redraw.add(`${n2.q},${n2.r}`);
            }
          }
        };
        for (const k of changed) {
          const [q, r] = k.split(',').map(Number);
          addRing(q, r);
        }
        const clearW = 280 * zoom;
        const clearH = 220 * zoom;
        // Two passes: overlapping clearRects would erase sprites drawn in the same pass.
        for (const k of redraw) {
          const [q, r] = k.split(',').map(Number);
          const { x, y } = gridToScreen(q, r, zoom);
          const sx = x + entityLayerCache.offsetX;
          const sy = y + entityLayerCache.offsetY;
          ctx.clearRect(sx - clearW / 2, sy - clearH / 2, clearW, clearH);
        }
        for (const k of redraw) {
          const [q, r] = k.split(',').map(Number);
          drawEntityTile(
            ctx,
            state,
            q,
            r,
            zoom,
            entityLayerCache.offsetX,
            entityLayerCache.offsetY,
            humanCivIndex,
            isLowQuality,
            showShadows,
            isUltraEntity
          );
        }
      }
    }
    entityLayerCache.marks = nextMarks;
    return entityLayerCache;
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = createCanvas(1, 1);
    entityLayerCache = { canvas: fallback, offsetX: 0, offsetY: 0, key, marks: nextMarks };
    return entityLayerCache;
  }

  for (const k of nextMarks.keys()) {
    const [q, r] = k.split(',').map(Number);
    drawEntityTile(
      ctx,
      state,
      q,
      r,
      zoom,
      offsetX,
      offsetY,
      humanCivIndex,
      isLowQuality,
      showShadows,
      isUltraEntity
    );
  }

  entityLayerCache = { canvas, offsetX, offsetY, key, marks: nextMarks };
  return entityLayerCache;
}

function getMapPixelBounds(mapW: number, mapH: number, zoom: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const corners = [
    gridToScreen(0, 0, zoom),
    gridToScreen(Math.max(0, mapW - 1), 0, zoom),
    gridToScreen(0, Math.max(0, mapH - 1), zoom),
    gridToScreen(Math.max(0, mapW - 1), Math.max(0, mapH - 1), zoom),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

function ensureTerrainLayer(
  state: GameState,
  zoom: number,
  graphics: GraphicsSettings,
  humanCivIndex: number,
  showLighting: boolean,
  showTerrainDetails: boolean,
  showTerritory: boolean,
  showGrid: boolean,
  isLowQuality: boolean,
  showShadows: boolean
): TerrainLayerCache {
  const mapH = state.tiles.length;
  const mapW = state.tiles[0]?.length ?? 0;
  const isUltraTerrain = graphics.quality === 'ultra' || graphics.quality === 'cinematic';
  const hourKey = Math.floor(state.world?.hour ?? 12);
  const key =
    `${mapW}x${mapH}|z:${zoom.toFixed(3)}|q:${graphics.quality}|` +
    `L:${showLighting ? 1 : 0}|TD:${showTerrainDetails ? 1 : 0}|` +
    `T:${showTerritory ? 1 : 0}|G:${showGrid ? 1 : 0}|S:${showShadows ? 1 : 0}|U:${isUltraTerrain ? 1 : 0}|H:${hourKey}|V:${humanCivIndex}`;

  if (terrainLayerCache && terrainLayerCache.key === key) {
    const pending: Array<{ q: number; r: number; next: string }> = [];
    for (let r = 0; r < mapH; r++) {
      for (let q = 0; q < mapW; q++) {
        const next = tileMark(state, q, r, humanCivIndex);
        if (terrainLayerCache.tileMarks[r]?.[q] !== next) {
          pending.push({ q, r, next });
        }
      }
    }
    if (pending.length > 0) {
      // updateVision can reveal large regions at once; incremental patch is slow and can
      // still interact badly with neighbor AA—rebuild the whole terrain cache layer.
      const rebuildThreshold = Math.max(150, Math.floor(mapW * mapH * 0.06));
      if (pending.length >= rebuildThreshold) {
        terrainLayerCache = null;
        return ensureTerrainLayer(
          state,
          zoom,
          graphics,
          humanCivIndex,
          showLighting,
          showTerrainDetails,
          showTerritory,
          showGrid,
          isLowQuality,
          showShadows
        );
      }
      for (const p of pending) {
        terrainLayerCache.tileMarks[p.r][p.q] = p.next;
      }
      const ctx = terrainLayerCache.canvas.getContext('2d');
      if (ctx) {
        const redraw = new Set<string>();
        const addRing = (q: number, r: number) => {
          redraw.add(`${q},${r}`);
          for (const n of getNeighbors(q, r, mapW, mapH)) {
            redraw.add(`${n.q},${n.r}`);
            for (const n2 of getNeighbors(n.q, n.r, mapW, mapH)) {
              redraw.add(`${n2.q},${n2.r}`);
            }
          }
        };
        for (const { q, r } of pending) addRing(q, r);
        for (const keyPos of redraw) {
          const [qStr, rStr] = keyPos.split(',');
          const q = Number(qStr);
          const r = Number(rStr);
          drawStaticTile(
            ctx,
            state,
            q,
            r,
            zoom,
            terrainLayerCache.offsetX,
            terrainLayerCache.offsetY,
            humanCivIndex,
            showLighting,
            showTerrainDetails,
            showTerritory,
            showGrid,
            isLowQuality,
            showShadows,
            isUltraTerrain,
            true
          );
        }
      }
    }
    return terrainLayerCache;
  }

  const { minX, maxX, minY, maxY } = getMapPixelBounds(mapW, mapH, zoom);
  const marginX = TILE_W * zoom * 1.25;
  const marginY = TILE_H * zoom * 1.25;
  const width = Math.ceil(maxX - minX + marginX * 2);
  const height = Math.ceil(maxY - minY + marginY * 2);
  const offsetX = -minX + marginX;
  const offsetY = -minY + marginY;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = createCanvas(1, 1);
    const emptyMarks: string[][] = Array.from({ length: mapH }, () => Array(mapW).fill(''));
    terrainLayerCache = { canvas: fallback, offsetX: 0, offsetY: 0, key, tileMarks: emptyMarks };
    return terrainLayerCache;
  }

  ctx.fillStyle = '#0d1520';
  ctx.fillRect(0, 0, width, height);

  const tileMarks: string[][] = Array.from({ length: mapH }, () => Array<string>(mapW));
  for (let r = 0; r < mapH; r++) {
    for (let q = 0; q < mapW; q++) {
      tileMarks[r][q] = tileMark(state, q, r, humanCivIndex);
      drawStaticTile(
        ctx,
        state,
        q,
        r,
        zoom,
        offsetX,
        offsetY,
        humanCivIndex,
        showLighting,
        showTerrainDetails,
        showTerritory,
        showGrid,
        isLowQuality,
        showShadows,
        isUltraTerrain,
        false
      );
    }
  }

  terrainLayerCache = { canvas, offsetX, offsetY, key, tileMarks };
  return terrainLayerCache;
}

function drawScreenRain(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, storm: boolean): void {
  ctx.save();
  const drops = storm ? 140 : 72;
  ctx.strokeStyle = storm ? 'rgba(210, 225, 255, 0.26)' : 'rgba(198, 212, 240, 0.16)';
  ctx.lineWidth = storm ? 1.35 : 1;
  const speed = storm ? 1.65 : 1.08;
  const skew = storm ? 15 : 9;
  for (let i = 0; i < drops; i++) {
    const seed = (i * 2654435761 + Math.floor(time / 22)) >>> 0;
    const x0 = (seed % Math.max(1, W)) + ((seed >> 8) % 60) * 0.015 * W;
    const y0 = (((seed >> 4) % Math.max(1, H)) + time * speed * 0.11 + i * 13) % (H + 48) - 24;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + skew, y0 + 20 + (storm ? 10 : 0));
    ctx.stroke();
  }
  // Secondary sheet: finer, faster streaks (depth)
  const fine = storm ? 95 : 48;
  ctx.strokeStyle = storm ? 'rgba(180, 210, 255, 0.14)' : 'rgba(170, 200, 240, 0.09)';
  ctx.lineWidth = storm ? 0.65 : 0.5;
  const fspeed = speed * 1.45;
  const fskew = skew * 0.85;
  for (let i = 0; i < fine; i++) {
    const seed = (i * 374761393 + Math.floor(time / 16)) >>> 0;
    const x0 = (seed % Math.max(1, W)) + ((seed >> 7) % 40) * 0.012 * W;
    const y0 = (((seed >> 5) % Math.max(1, H)) + time * fspeed * 0.14 + i * 9) % (H + 36) - 18;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + fskew, y0 + 14 + (storm ? 6 : 0));
    ctx.stroke();
  }
  // Near-ground mist / splash specks
  const mistN = storm ? 42 : 22;
  ctx.fillStyle = storm ? 'rgba(200, 220, 255, 0.06)' : 'rgba(190, 210, 240, 0.045)';
  for (let i = 0; i < mistN; i++) {
    const seed = (i * 2246822519 + Math.floor(time / 55)) >>> 0;
    const mx = (seed % Math.max(1, W)) * 0.98 + W * 0.01;
    const my = H * 0.55 + ((seed >> 8) % Math.max(1, Math.floor(H * 0.45)));
    const w = 12 + (seed % 40);
    const h = 3 + (seed % 5);
    ctx.beginPath();
    ctx.ellipse(mx, my, w * 0.5, h * 0.5, ((seed % 100) / 100) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawScreenSnow(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, storm: boolean): void {
  ctx.save();
  const flakes = storm ? 110 : 62;
  const drift = Math.sin(time / 3800) * 0.35;
  for (let i = 0; i < flakes; i++) {
    const seed = (i * 1597334677 + Math.floor(time / 38)) >>> 0;
    const xBase = (seed % Math.max(1, W)) + drift * 40;
    const spd = 0.06 + (seed % 50) * 0.0014;
    const y = (((seed >> 6) % Math.max(1, H)) + time * spd * (storm ? 1.15 : 0.72) + i * 7) % (H + 24) - 12;
    const x = (xBase + Math.sin(time * 0.001 + i * 0.7) * 14) % (W + 20) - 10;
    const rad = storm ? 1.1 + (seed % 5) * 0.22 : 0.85 + (seed % 4) * 0.18;
    const a = storm ? 0.38 : 0.28;
    ctx.fillStyle = `rgba(248, 252, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function syncRevealWaveTracking(
  state: GameState,
  humanCivIndex: number,
  time: number,
  mapW: number,
  mapH: number,
  revealEnabled: boolean
): void {
  if (mapW <= 0 || mapH <= 0) return;
  const need = mapW * mapH;
  if (!revealPrevRevealed || revealPrevRevealed.length !== need) {
    revealPrevRevealed = new Uint8Array(need);
    let i = 0;
    for (let r = 0; r < mapH; r++) {
      for (let q = 0; q < mapW; q++) {
        revealPrevRevealed[i++] = getCivFog(state.tiles[r]![q]!, humanCivIndex).revealed ? 1 : 0;
      }
    }
    if (!revealEnabled) revealWaveStart.clear();
    return;
  }
  if (!revealEnabled) {
    revealWaveStart.clear();
  }
  let i = 0;
  for (let r = 0; r < mapH; r++) {
    for (let q = 0; q < mapW; q++) {
      const cur = getCivFog(state.tiles[r]![q]!, humanCivIndex).revealed ? 1 : 0;
      const prev = revealPrevRevealed[i]!;
      if (revealEnabled && prev === 0 && cur === 1) {
        revealWaveStart.set(`${q},${r}`, time);
      }
      revealPrevRevealed[i] = cur;
      i++;
    }
  }
}

function drawRevealWaveOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
  zoom: number,
  camX: number,
  camY: number,
  startQ: number,
  startR: number,
  endQ: number,
  endR: number,
  mapW: number,
  mapH: number,
  humanCivIndex: number,
  revealDurationMs: number,
  isUltra: boolean
): void {
  const pad = 4;
  const sq0 = Math.max(0, startQ - pad);
  const sr0 = Math.max(0, startR - pad);
  const eq0 = Math.min(mapW - 1, endQ + pad);
  const er0 = Math.min(mapH - 1, endR + pad);
  for (let r = sr0; r <= er0; r++) {
    for (let q = sq0; q <= eq0; q++) {
      const k = `${q},${r}`;
      const t0 = revealWaveStart.get(k);
      if (t0 == null) continue;
      const u = (time - t0) / revealDurationMs;
      if (u >= 1) {
        revealWaveStart.delete(k);
        continue;
      }
      const tile = state.tiles[r]?.[q];
      if (!tile || !getCivFog(tile, humanCivIndex).revealed) {
        revealWaveStart.delete(k);
        continue;
      }
      const ease = 1 - (1 - u) * (1 - u);
      const { x, y } = gridToScreen(q, r, zoom);
      const sx = x - camX;
      const sy = y - camY;
      const hexW = TILE_W * zoom;
      const hexH = TILE_H * zoom;
      const scale = 0.88 + 0.12 * ease;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);
      ctx.translate(-sx, -sy);
      const veil = (1 - ease) * (isUltra ? 0.82 : 0.7);
      hexPath(ctx, sx, sy, hexW, hexH);
      ctx.fillStyle = `rgba(4, 8, 16, ${veil})`;
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(160, 210, 255, ${(1 - ease) * (isUltra ? 0.42 : 0.28)})`;
      ctx.lineWidth = isUltra ? 2.2 : 1.6;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
  }
}

/** Soft screen tint from time-of-day (complements per-tile lighting in the terrain cache). */
function drawHourAtmosphere(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  hour: number,
  isUltra: boolean,
  showLighting: boolean
): void {
  if (!showLighting) return;
  ctx.save();
  const h = hour % 24;
  // Dawn / dusk warm rim
  if ((h >= 5 && h < 8) || (h >= 17 && h < 20)) {
    const g = ctx.createLinearGradient(0, 0, W, H * 0.65);
    const a = isUltra ? 0.09 : 0.055;
    g.addColorStop(0, `rgba(255, 190, 130, ${a * 1.2})`);
    g.addColorStop(0.45, `rgba(255, 200, 160, ${a * 0.45})`);
    g.addColorStop(1, 'rgba(255, 200, 160, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Midday: very soft cool zenith (reads as cleaner lighting on terrain)
  if (h >= 10 && h < 16) {
    const z = ctx.createRadialGradient(W * 0.5, -H * 0.05, 0, W * 0.5, H * 0.35, Math.max(W, H) * 0.72);
    z.addColorStop(0, isUltra ? 'rgba(200, 230, 255, 0.045)' : 'rgba(200, 230, 255, 0.028)');
    z.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = z;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// ============================================================
// MAIN RENDER FUNCTION
// ============================================================
export function renderGame(
  canvas: HTMLCanvasElement,
  state: GameState,
  hoveredTile: { q: number; r: number } | null,
  time = performance.now(),
  graphics: GraphicsSettings = DEFAULT_GRAPHICS,
  /** Live camera (pan/zoom) without cloning full game state each frame. */
  cameraOverride?: { x: number; y: number; zoom: number; rotation?: number },
  ctxOverride?: CanvasRenderingContext2D,
  /** Fog, visibility, and local selection highlights for this player slot. */
  localViewerCivIndex = 0
): void {
  const ctx = ctxOverride ?? canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const camera = cameraOverride ?? state.camera;
  const zoom = camera.zoom;
  const camX = camera.x;
  const camY = camera.y;
  const cameraRotation = camera.rotation ?? 0;
  // Render in CSS-pixel space. In MapRenderer we pre-apply DPR via ctx.setTransform(dpr,...),
  // so using backing-store width/height here would clip screen-space effects to a fraction.
  const W = canvas.clientWidth || canvas.width;
  const H = canvas.clientHeight || canvas.height;
  const humanCivIndex = localViewerCivIndex;
  const sessionKey = [
    state.settings?.seed ?? 'na',
    state.settings?.mapType ?? 'na',
    state.settings?.mapWidth ?? state.tiles[0]?.length ?? 0,
    state.settings?.mapHeight ?? state.tiles.length,
    state.settings?.numCivs ?? state.civilizations.length,
    `v:${humanCivIndex}`,
  ].join('|');
  if (renderSessionKey !== sessionKey) {
    invalidateRenderCaches();
    renderSessionKey = sessionKey;
  }

  // Quality multipliers
  const isLowQuality = graphics.quality === 'low';
  const isCinematic = graphics.quality === 'cinematic';
  const isHighQuality =
    graphics.quality === 'high' || graphics.quality === 'ultra' || isCinematic;
  const isUltra = graphics.quality === 'ultra' || isCinematic;
  const showShadows = graphics.shadows && isHighQuality;
  const showLighting = graphics.lighting && isHighQuality;
  const showTerrainDetails = graphics.terrainDetails;
  const showParticles = graphics.particles && !isLowQuality;
  const showWaterAnim = graphics.waterAnimation;
  const showUnitAnim = graphics.unitAnimations;
  const showTerritory = graphics.showTerritory ?? graphics.territoryBorders;
  const showGrid = graphics.showGridLines;
  const revealWaveOn = (graphics.showRevealEffects ?? graphics.atmosphereRevealWave) !== false;
  const atmosphereWeather: AtmosphereWeatherLevel = graphics.atmosphereWeather ?? 'normal';
  const isWebRuntime = typeof navigator !== 'undefined' && !/electron/i.test(navigator.userAgent);
  const cinematicDisasterFx = !isWebRuntime;
  const wxBurstIntervalMul = atmosphereWeather === 'rich' ? 0.72 : 1;
  const wxBurstCountMul = atmosphereWeather === 'rich' ? 1.5 : 1;
  /** Skip expensive per-tile passes when zoomed far out. */
  const lodFar = zoom < 0.38;

  // Time-based animations
  const dt = Math.min((time - lastParticleTime) / 1000, 0.05);
  lastParticleTime = time;
  const pulse = Math.sin(time / 400) * 0.5 + 0.5;
  if (!showTerritory) {
    territoryOwnerSeen.clear();
    territoryGrowthStart.clear();
  }

  // Clear
  ctx.fillStyle = '#0d1520';
  ctx.fillRect(0, 0, W, H);

  // Subtle background vignette (high / ultra)
  if (showLighting) {
    const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.82);
    vignette.addColorStop(0, 'rgba(13,21,32,0)');
    vignette.addColorStop(
      1,
      isCinematic ? 'rgba(0,0,0,0.5)' : isUltra ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.35)'
    );
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    if (isUltra) {
      const v2 = ctx.createRadialGradient(W * 0.15, H * 0.12, 0, W * 0.15, H * 0.12, Math.max(W, H) * 0.55);
      v2.addColorStop(0, isCinematic ? 'rgba(255, 220, 160, 0.07)' : 'rgba(255, 210, 140, 0.04)');
      v2.addColorStop(1, 'rgba(255, 210, 140, 0)');
      ctx.fillStyle = v2;
      ctx.fillRect(0, 0, W, H);
    }
  }

  const mapH = state.tiles.length;
  const mapW = state.tiles[0]?.length ?? 0;

  syncRevealWaveTracking(state, humanCivIndex, time, mapW, mapH, revealWaveOn);

  ctx.save();
  if (Math.abs(cameraRotation) > 0.0001) {
    const cx = W / 2;
    const cy = H / 2;
    ctx.translate(cx, cy);
    ctx.rotate(cameraRotation);
    ctx.translate(-cx, -cy);
  }

  const { startQ, startR, endQ, endR } =
    mapW > 0 && mapH > 0
      ? visibleTileBounds(camX, camY, zoom, W, H, mapW, mapH, 3)
      : { startQ: 0, startR: 0, endQ: 0, endR: 0 };
  const mapPx = getMapPixelBounds(mapW, mapH, zoom);
  const cacheW = Math.ceil(mapPx.maxX - mapPx.minX + TILE_W * zoom * 2.5);
  const cacheH = Math.ceil(mapPx.maxY - mapPx.minY + TILE_H * zoom * 2.5);
  const canUseLayerCache = cacheW <= 16384 && cacheH <= 16384 && cacheW * cacheH <= 120_000_000;

  if (canUseLayerCache) {
    const layer = ensureTerrainLayer(
      state,
      zoom,
      graphics,
      humanCivIndex,
      showLighting,
      showTerrainDetails,
      showTerritory,
      showGrid,
      isLowQuality,
      showShadows
    );
    ctx.drawImage(layer.canvas, -camX - layer.offsetX, -camY - layer.offsetY);
  } else {
    for (let r = startR; r <= endR; r++) {
      for (let q = startQ; q <= endQ; q++) {
        if (r < 0 || r >= mapH || q < 0 || q >= mapW) continue;
        drawStaticTile(
          ctx,
          state,
          q,
          r,
          zoom,
          -camX,
          -camY,
          humanCivIndex,
          showLighting,
          showTerrainDetails,
          showTerritory,
          showGrid,
          isLowQuality,
          showShadows,
          isUltra,
          false
        );
      }
    }
  }

  drawHourAtmosphere(ctx, W, H, state.world?.hour ?? 12, isUltra, showLighting);

  if (revealWaveOn && !lodFar && isHighQuality && mapW > 0 && mapH > 0) {
    drawRevealWaveOverlay(
      ctx,
      state,
      time,
      zoom,
      camX,
      camY,
      startQ,
      startR,
      endQ,
      endR,
      mapW,
      mapH,
      humanCivIndex,
      GRAPHICS_ATMOSPHERE.revealWaveDurationMs,
      isUltra
    );
  }

  const neighborMoveCost = new Map<string, number>();
  let movePreviewUnit: Unit | null = null;
  if (!lodFar && isHighQuality && state.selectedUnitId != null && mapW > 0) {
    const su = state.units.find(u => u.id === state.selectedUnitId);
    if (su && su.owner === humanCivIndex && !su.hasAttacked) {
      movePreviewUnit = su;
      const reach = reachableHexMovementCosts(state, su);
      for (const [k, v] of reach) {
        if (k !== `${su.q},${su.r}`) neighborMoveCost.set(k, v);
      }
    }
  }

  // Dynamic per-frame tile overlays only (water, hover, selection)
  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      if (r < 0 || r >= mapH || q < 0 || q >= mapW) continue;
      const tile = state.tiles[r][q];
      const { visible, revealed } = getCivFog(tile, humanCivIndex);
      const { x, y } = gridToScreen(q, r, zoom);
      const sx = x - camX;
      const sy = y - camY;
      const hexW = TILE_W * zoom;
      const hexH = TILE_H * zoom;

      if (showTerritory && tile.owner != null && revealed) {
        const ownerCiv = state.civilizations[tile.owner];
        if (ownerCiv) {
          const key = `${q},${r}`;
          const prevOwner = territoryOwnerSeen.get(key);
          if (prevOwner == null) {
            territoryOwnerSeen.set(key, tile.owner);
          } else if (prevOwner !== tile.owner) {
            territoryOwnerSeen.set(key, tile.owner);
            territoryGrowthStart.set(key, time);
          }

          const growStart = territoryGrowthStart.get(key);
          let growT = 1;
          let growBoost = 0;
          if (growStart != null) {
            const u = Math.max(0, Math.min(1, (time - growStart) / 900));
            const eased = 1 - Math.pow(1 - u, 3);
            growT = 0.84 + 0.16 * eased;
            growBoost = 1 - u;
            if (u >= 1) territoryGrowthStart.delete(key);
          }

          const tintPulse = Math.sin(time / 640 + q * 0.41 + r * 0.33) * 0.5 + 0.5;
          const baseHex = normalizeHexColor(ownerCiv.color);
          const fillAlpha =
            (visible ? 0.055 : 0.03) +
            tintPulse * (visible ? 0.015 : 0.008) +
            growBoost * 0.05;
          hexPath(ctx, sx, sy, hexW * growT, hexH * growT);
          ctx.fillStyle = rgbaFromHex(baseHex, fillAlpha);
          ctx.fill();

          const glowAlpha =
            (visible ? 0.09 : 0.045) +
            tintPulse * (visible ? 0.06 : 0.03) +
            growBoost * 0.1;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const glow = ctx.createRadialGradient(
            sx,
            sy,
            hexW * 0.08,
            sx,
            sy,
            hexW * (0.66 + growBoost * 0.1)
          );
          glow.addColorStop(0, rgbaFromHex(baseHex, glowAlpha));
          glow.addColorStop(0.55, rgbaFromHex(baseHex, glowAlpha * 0.42));
          glow.addColorStop(1, rgbaFromHex(baseHex, 0));
          hexPath(ctx, sx, sy, hexW * (1.02 + growBoost * 0.04), hexH * (1.02 + growBoost * 0.04));
          ctx.fillStyle = glow;
          ctx.fill();
          ctx.restore();
        }
      } else if (tile.owner == null && revealed) {
        const key = `${q},${r}`;
        territoryOwnerSeen.delete(key);
        territoryGrowthStart.delete(key);
      }

      if (showWaterAnim && !lodFar && (tile.terrain === 'ocean' || tile.terrain === 'coast') && visible) {
        const tSec = time / 1000;
        const wavePhase = (tSec + q * 0.3 + r * 0.2) % (Math.PI * 2);
        const waveY = Math.sin(wavePhase) * (isCinematic ? 3.2 : isUltra ? 2.6 : 2) * zoom;
        const wavePhase2 = (tSec * 1.3 + q * 0.17 - r * 0.11) % (Math.PI * 2);
        const waveY2 = Math.sin(wavePhase2) * (isCinematic ? 1.9 : isUltra ? 1.4 : 1) * zoom;
        ctx.save();
        ctx.strokeStyle = isCinematic
          ? 'rgba(255,255,255,0.16)'
          : isUltra
            ? 'rgba(255,255,255,0.11)'
            : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = isCinematic ? 1.35 : isUltra ? 1.15 : 1;
        ctx.beginPath();
        ctx.moveTo(sx - TILE_HALF_W * zoom * 0.52, sy + waveY);
        ctx.lineTo(sx + TILE_HALF_W * zoom * 0.52, sy + waveY);
        ctx.stroke();
        if (isHighQuality) {
          ctx.strokeStyle = isCinematic
            ? 'rgba(190, 238, 255, 0.14)'
            : isUltra
              ? 'rgba(180, 230, 255, 0.09)'
              : 'rgba(200, 230, 255, 0.05)';
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.moveTo(sx - TILE_HALF_W * zoom * 0.35, sy + waveY2 + 3 * zoom);
          ctx.lineTo(sx + TILE_HALF_W * zoom * 0.35, sy + waveY2 + 3 * zoom);
          ctx.stroke();
        }
        ctx.restore();
        if (showParticles && isHighQuality && ((q * 31 + r * 17 + Math.floor(time / 140)) % 11 === 0)) {
          const wx = sx + (Math.sin(q + tSec) * 0.25) * TILE_HALF_W * zoom;
          const wy = sy + waveY * 0.5;
          spawnParticle(wx, wy, tile.terrain === 'coast' ? 'rgba(200,240,255,0.95)' : 'rgba(160,210,255,0.85)', 0.55, {
            kind: 'mist',
            maxLife: 0.55 + (q + r) * 0.01,
            size: 2 + (r % 3),
          });
        }
      }

      if (hoveredTile && hoveredTile.q === q && hoveredTile.r === r) {
        if (isUltra) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          hexPath(ctx, sx, sy, hexW + 10, hexH + 10);
          ctx.strokeStyle = 'rgba(120, 200, 255, 0.18)';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        }
        hexPath(ctx, sx, sy, hexW, hexH);
        ctx.fillStyle = isUltra ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (!isLowQuality) {
          hexPath(ctx, sx, sy, hexW + 6, hexH + 6);
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      if (state.selectedTile && state.selectedTile.q === q && state.selectedTile.r === r) {
        hexPath(ctx, sx, sy, hexW, hexH);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        if (!isLowQuality) {
          ctx.save();
          hexPath(ctx, sx, sy, hexW + 4 + pulse * 4, hexH + 4 + pulse * 4);
          ctx.strokeStyle = `rgba(255,215,0,${0.15 + pulse * 0.15})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      if (visible && !lodFar && isHighQuality && movePreviewUnit) {
        if (q !== movePreviewUnit.q || r !== movePreviewUnit.r) {
          const nk = `${q},${r}`;
          const step = neighborMoveCost.get(nk);
          const canStrike =
            movePreviewUnit.movement > 0 &&
            isHexInStrikeZone(movePreviewUnit, movePreviewUnit.q, movePreviewUnit.r, q, r);
          if (step != null || canStrike) {
            ctx.save();
            hexPath(ctx, sx, sy, hexW, hexH);
            if (step != null) {
              ctx.fillStyle = canStrike ? 'rgba(74, 222, 128, 0.22)' : 'rgba(52, 211, 153, 0.26)';
              ctx.fill();
            } else {
              ctx.fillStyle =
                movePreviewUnit.rangedStrength > 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 146, 60, 0.22)';
              ctx.fill();
            }
            if (canStrike) {
              ctx.strokeStyle = step != null ? 'rgba(250, 204, 21, 0.95)' : 'rgba(251, 146, 60, 0.96)';
              ctx.lineWidth = 2.65 + pulse * 0.55;
            } else {
              ctx.strokeStyle = 'rgba(34, 197, 94, 0.92)';
              ctx.lineWidth = 2.15 + pulse * 0.48;
            }
            ctx.stroke();
            ctx.restore();
            const fy = sy + TILE_HALF_H * zoom * 0.58;
            if (step != null) {
              drawOutlinedHexFooter(ctx, sx, fy, String(step), 'rgba(236, 253, 245, 0.98)', zoom);
            } else if (canStrike) {
              const d = hexDistance(movePreviewUnit.q, movePreviewUnit.r, q, r);
              drawOutlinedHexFooter(ctx, sx, fy, String(d), 'rgba(255, 247, 237, 0.98)', zoom);
            }
          }
        }
      }
    }
  }

  // Trade route arcs (fog: both capitals visible to local viewer)
  if (!lodFar && (state.tradeRoutes?.length ?? 0) > 0) {
    ctx.save();
    for (const tr of state.tradeRoutes!) {
      const fromCity = state.cities.find(c => c.id === tr.fromCityId);
      const toCity = state.cities.find(c => c.id === tr.toCityId);
      if (!fromCity || !toCity) continue;
      const ta = state.tiles[fromCity.r]?.[fromCity.q];
      const tb = state.tiles[toCity.r]?.[toCity.q];
      if (!ta || !tb) continue;
      if (!getCivFog(ta, humanCivIndex).visible || !getCivFog(tb, humanCivIndex).visible) continue;
      const rel = state.relations.find(
        r =>
          (r.civA === tr.civA && r.civB === tr.civB) ||
          (r.civA === tr.civB && r.civB === tr.civA)
      );
      if (!rel || rel.status === 'war') continue;
      const { x: x1, y: y1 } = gridToScreen(fromCity.q, fromCity.r, zoom);
      const { x: x2, y: y2 } = gridToScreen(toCity.q, toCity.r, zoom);
      const sx1 = x1 - camX;
      const sy1 = y1 - camY;
      const sx2 = x2 - camX;
      const sy2 = y2 - camY;
      const mx = (sx1 + sx2) / 2;
      const my = (sy1 + sy2) / 2;
      const dx = sx2 - sx1;
      const dy = sy2 - sy1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const bend = Math.min(52, len * 0.24) * zoom;
      const cpx = mx + nx * bend;
      const cpy = my + ny * bend;
      const ca = normalizeHexColor(state.civilizations[tr.civA]?.color);
      const cb = normalizeHexColor(state.civilizations[tr.civB]?.color);
      const lw = Math.min(4.5, 1.05 + tr.goldPerTurn * 0.32) * (isUltra ? 1.06 : 1);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.quadraticCurveTo(cpx, cpy, sx2, sy2);
      ctx.strokeStyle = rgbaFromHex(ca, isUltra ? 0.52 : 0.4);
      ctx.lineWidth = lw;
      if (isHighQuality && cinematicDisasterFx) {
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -(time / 50) % 22;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.quadraticCurveTo(cpx, cpy, sx2, sy2);
      ctx.strokeStyle = rgbaFromHex(cb, isUltra ? 0.32 : 0.24);
      ctx.lineWidth = Math.max(0.75, lw * 0.45);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (canUseLayerCache) {
    const entityLayer = ensureEntityLayer(
      state,
      zoom,
      graphics,
      humanCivIndex,
      isLowQuality,
      showShadows
    );
    ctx.drawImage(entityLayer.canvas, -camX - entityLayer.offsetX, -camY - entityLayer.offsetY);
  } else {
    for (let r = startR; r <= endR; r++) {
      for (let q = startQ; q <= endQ; q++) {
        if (r < 0 || r >= mapH || q < 0 || q >= mapW) continue;
        drawEntityTile(
          ctx,
          state,
          q,
          r,
          zoom,
          -camX,
          -camY,
          humanCivIndex,
          isLowQuality,
          showShadows,
          isUltra
        );
      }
    }
  }

  if (!lodFar && state.systems.disasters.length > 0) {
    const pulseFast = Math.sin(time / 170) * 0.5 + 0.5;
    const tSec = time / 1000;
    for (const d of state.systems.disasters) {
      if (d.q < startQ || d.q > endQ || d.r < startR || d.r > endR) continue;
      const tile = state.tiles[d.r]?.[d.q];
      if (!tile || !getCivFog(tile, humanCivIndex).visible) continue;
      const { x, y } = gridToScreen(d.q, d.r, zoom);
      const sx = x - camX;
      const sy = y - camY;
      const rad = Math.max(18, d.radius * TILE_HALF_W * zoom * 0.86);
      const kindColor =
        d.kind === 'flood' || d.kind === 'tsunami'
          ? '#38bdf8'
          : d.kind === 'earthquake'
            ? '#f97316'
            : d.kind === 'drought'
              ? '#facc15'
              : d.kind === 'storm'
                ? '#60a5fa'
                : d.kind === 'volcanic_eruption'
                  ? '#ef4444'
                  : d.kind === 'blizzard'
                    ? '#cbd5e1'
                    : '#fb7185';

      ctx.save();
      const alpha = isUltra ? 0.2 + pulseFast * 0.1 : 0.14 + pulseFast * 0.08;
      const g = ctx.createRadialGradient(sx, sy, rad * 0.2, sx, sy, rad * 1.25);
      g.addColorStop(0, rgbaFromHex(kindColor, alpha + 0.12));
      g.addColorStop(0.55, rgbaFromHex(kindColor, alpha));
      g.addColorStop(1, rgbaFromHex(kindColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, rad * 1.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = rgbaFromHex(kindColor, 0.56 + pulseFast * 0.2);
      ctx.lineWidth = isUltra ? 2.2 : 1.7;
      if (isHighQuality) {
        ctx.setLineDash([9, 6]);
        ctx.lineDashOffset = -(time / 70 + d.id * 3) % 45;
      }
      ctx.beginPath();
      ctx.arc(sx, sy, rad * (0.92 + pulseFast * 0.08), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (isHighQuality) {
        if (d.kind === 'storm') {
          // Forked lightning arcs with short flash spikes.
          const forks = isCinematic ? 3 : isUltra ? 2 : 1;
          for (let f = 0; f < forks; f++) {
            const trigger = Math.sin(tSec * (6.8 + f * 0.9) + d.id * 1.7 + f * 1.3);
            if (trigger < 0.86) continue;
            const startX = sx + (Math.random() - 0.5) * rad * 0.7;
            const startY = sy - rad * (0.92 + Math.random() * 0.18);
            const endX = sx + (Math.random() - 0.5) * rad * 1.2;
            const endY = sy + rad * (0.2 + Math.random() * 0.5);
            const mx = (startX + endX) * 0.5 + (Math.random() - 0.5) * rad * 0.45;
            const my = (startY + endY) * 0.5 + (Math.random() - 0.5) * rad * 0.35;
            ctx.save();
            ctx.strokeStyle = 'rgba(220,245,255,0.95)';
            ctx.shadowColor = 'rgba(150,220,255,0.75)';
            ctx.shadowBlur = 14;
            ctx.lineWidth = isCinematic ? 2.6 : isUltra ? 2.2 : 1.8;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(mx, my);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.restore();
            if (showParticles) {
              spawnSparkBurst(endX, endY, 'rgba(190,240,255,0.95)', isCinematic ? 6 : isUltra ? 4 : 2);
            }
          }
        } else if (d.kind === 'tsunami') {
          // Expanding wave front that sweeps from epicenter.
          const ring = ((tSec * (isCinematic ? 1.5 : isUltra ? 1.25 : 1.05) + d.id * 0.37) % 1) * rad * 1.35;
          ctx.save();
          ctx.strokeStyle = 'rgba(125,220,255,0.78)';
          ctx.lineWidth = isCinematic ? 3.6 : isUltra ? 3 : 2.2;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(rad * 0.35, ring), 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(200,245,255,0.45)';
          ctx.lineWidth = isCinematic ? 2.2 : isUltra ? 1.8 : 1.2;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(rad * 0.3, ring - 7 * zoom), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          if (showParticles && Math.random() < (isCinematic ? 0.34 : isUltra ? 0.25 : 0.14)) {
            const a = Math.random() * Math.PI * 2;
            const rr = Math.max(rad * 0.3, ring);
            const px = sx + Math.cos(a) * rr;
            const py = sy + Math.sin(a) * rr;
            spawnParticle(px, py, 'rgba(200,245,255,0.9)', 0.75, {
              kind: 'mist',
              vx: Math.cos(a) * 0.6,
              vy: Math.sin(a) * 0.3 - 0.4,
              maxLife: 0.48 + Math.random() * 0.24,
              size: 2 + Math.random() * 1.5,
            });
          }
        } else if (d.kind === 'volcanic_eruption') {
          // Eruption cone glow + ash plume + ejected sparks.
          ctx.save();
          const plumeH = rad * (0.9 + pulseFast * 0.22);
          const plumeW = rad * 0.62;
          const ash = ctx.createLinearGradient(sx, sy - plumeH, sx, sy + rad * 0.15);
          ash.addColorStop(0, 'rgba(90,90,95,0.46)');
          ash.addColorStop(1, 'rgba(38,38,42,0)');
          ctx.fillStyle = ash;
          ctx.beginPath();
          ctx.moveTo(sx - plumeW, sy + rad * 0.18);
          ctx.quadraticCurveTo(sx, sy - plumeH, sx + plumeW, sy + rad * 0.18);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          if (showParticles) {
            if (Math.random() < (isCinematic ? 0.52 : isUltra ? 0.42 : 0.28)) {
              spawnSparkBurst(
                sx + (Math.random() - 0.5) * rad * 0.7,
                sy - rad * (0.2 + Math.random() * 0.45),
                'rgba(255,170,90,0.95)',
                isCinematic ? 7 : isUltra ? 5 : 3
              );
            }
            if (Math.random() < (isCinematic ? 0.45 : isUltra ? 0.35 : 0.22)) {
              spawnParticle(
                sx + (Math.random() - 0.5) * rad * 0.9,
                sy - rad * 0.35,
                'rgba(110,110,120,0.82)',
                0.55,
                {
                  kind: 'mist',
                  vx: (Math.random() - 0.5) * 0.55,
                  vy: -0.5 - Math.random() * 0.45,
                  maxLife: 0.82 + Math.random() * 0.36,
                  size: 3.5 + Math.random() * 2.2,
                }
              );
            }
          }
        } else if (d.kind === 'earthquake') {
          // Short ground shock lines: readable impact without long-lived particles.
          const shock = Math.sin(tSec * 9.2 + d.id * 0.77);
          if (shock > 0.78) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,180,120,0.8)';
            ctx.lineWidth = isUltra ? 2.2 : 1.6;
            for (let i = 0; i < (isUltra ? 3 : 2); i++) {
              const a = (Math.PI * 2 * i) / (isUltra ? 3 : 2) + tSec * 0.8;
              const r0 = rad * 0.25;
              const r1 = rad * (0.65 + i * 0.1);
              ctx.beginPath();
              ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0);
              ctx.lineTo(sx + Math.cos(a + 0.3) * r1, sy + Math.sin(a + 0.3) * r1);
              ctx.stroke();
            }
            ctx.restore();
          }
        } else if (d.kind === 'flood') {
          // One sweeping water arc to make flood directionality more obvious.
          const sweep = ((tSec * 0.9 + d.id * 0.31) % 1) * Math.PI * 2;
          ctx.save();
          ctx.strokeStyle = 'rgba(140,220,255,0.55)';
          ctx.lineWidth = isUltra ? 2 : 1.4;
          ctx.beginPath();
          ctx.arc(sx, sy, rad * 0.78, sweep, sweep + Math.PI * 0.85);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // City pulse rings (screen space; cheap animated accent)
  if (graphics.cityAnimations && !lodFar && isHighQuality) {
    const tRing = time / 1000;
    for (const city of state.cities) {
      if (city.q < startQ || city.q > endQ || city.r < startR || city.r > endR) continue;
      const ct = state.tiles[city.r]?.[city.q];
      if (!ct) continue;
      const fog = getCivFog(ct, humanCivIndex);
      if (!fog.visible) continue;
      const ownerCiv = state.civilizations[city.owner];
      const baseHex = normalizeHexColor(ownerCiv?.color || '#888888');
      const { x, y } = gridToScreen(city.q, city.r, zoom);
      const sx = x - camX;
      const sy = y - camY;
      const citySize = Math.max(8, (12 + city.population * 2) * zoom);
      const pulseR =
        citySize +
        6 * zoom +
        Math.sin(tRing * 1.8 + city.id * 0.7) * (isCinematic ? 6.4 : isUltra ? 5 : 3) * zoom;
      ctx.save();
      ctx.strokeStyle = rgbaFromHex(
        baseHex,
        isCinematic ? 0.2 + pulse * 0.09 : isUltra ? 0.14 + pulse * 0.06 : 0.08 + pulse * 0.04
      );
      ctx.lineWidth = isCinematic ? 2.4 : isUltra ? 2 : 1.4;
      ctx.beginPath();
      ctx.arc(sx, sy, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      if (isUltra) {
        ctx.strokeStyle = rgbaFromHex(baseHex, isCinematic ? 0.1 + pulse * 0.06 : 0.05 + pulse * 0.04);
        ctx.beginPath();
        ctx.arc(sx, sy, pulseR + 5 * zoom, 0, Math.PI * 2);
        ctx.stroke();
        if (isCinematic) {
          ctx.strokeStyle = rgbaFromHex(baseHex, 0.06 + pulse * 0.04);
          ctx.beginPath();
          ctx.arc(sx, sy, pulseR + 10 * zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Dynamic selection overlays for currently selected unit remain in the main frame.
  if (state.selectedUnitId != null) {
    const selected = state.units.find(u => u.id === state.selectedUnitId);
    const tile = selected ? state.tiles[selected.r]?.[selected.q] : null;
    if (selected && tile) {
      const sf = getCivFog(tile, humanCivIndex);
      if (sf.visible || sf.revealed) {
        const { x, y } = gridToScreen(selected.q, selected.r, zoom);
        const sx = x - camX;
        const sy = y - camY;
        const ux = sx + (tile.city ? 20 * zoom : 0);
        const uy = sy - 10 * zoom + (showUnitAnim ? Math.sin(time / 300) * 2 : 0);
        const unitSize = Math.max(6, 11 * zoom);
        if (!isLowQuality) {
          ctx.beginPath();
          ctx.arc(ux, uy, unitSize + 6 + pulse * 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,215,0,${0.15 + pulse * 0.2})`;
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(ux, uy, unitSize + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        if (showParticles) {
          if (Math.random() < (isUltra ? 0.09 : 0.06)) {
            spawnParticle(ux + (Math.random() - 0.5) * unitSize * 1.6, uy - unitSize * 0.9, '#ffe8a0', 0.45, {
              kind: 'soft',
              maxLife: 0.5 + Math.random() * 0.25,
            });
          }
          if (isUltra && Math.random() < 0.035) {
            spawnSparkBurst(ux, uy - unitSize * 0.5, '#fff5cc', 2);
          }
        }
        if (!lodFar && isHighQuality) {
          const { x: gx, y: gy } = gridToScreen(selected.q, selected.r, zoom);
          const gsx = gx - camX;
          const gsy = gy - camY;
          const labelCx = gsx + (tile.city ? 20 * zoom : 0);
          const labelCy = gsy + TILE_HALF_H * zoom * 0.62;
          const pxLine = Math.max(10, Math.min(14, 11 * Math.sqrt(Math.max(0.25, zoom))));
          const mpLine = `MP ${selected.movement}`;
          const atkLine =
            selected.rangedStrength > 0
              ? `→ ${effectiveRangedAttackRange(selected)}/${selected.range}`
              : '⚔ 1';
          drawOutlinedHexFooter(ctx, labelCx, labelCy - pxLine * 0.55, mpLine, '#fef9c3', zoom);
          drawOutlinedHexFooter(ctx, labelCx, labelCy + pxLine * 0.55, atkLine, '#fde68a', zoom);
        }
      }
    }
  }

  // ---- Selected unit ground glow (high / ultra quality) ----
  if (isHighQuality && state.selectedUnitId) {
    const su = state.units.find(u => u.id === state.selectedUnitId);
    const st = su ? state.tiles[su.r]?.[su.q] : null;
    if (su && su.owner === humanCivIndex && st && getCivFog(st, humanCivIndex).visible) {
      const { x, y } = gridToScreen(su.q, su.r, zoom);
      const ux = x - camX;
      const uy = y - camY;
      const glowR =
        TILE_W * zoom * (graphics.quality === 'cinematic' ? 1.32 : graphics.quality === 'ultra' ? 1.15 : 0.85);
      const g = ctx.createRadialGradient(ux, uy, 0, ux, uy, glowR);
      const a =
        graphics.quality === 'cinematic'
          ? 0.2 + pulse * 0.11
          : graphics.quality === 'ultra'
            ? 0.14 + pulse * 0.08
            : 0.08 + pulse * 0.05;
      g.addColorStop(0, `rgba(255, 215, 100, ${a})`);
      g.addColorStop(0.45, `rgba(255, 180, 40, ${a * 0.45})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ux - glowR, uy - glowR, glowR * 2, glowR * 2);
    }
  }
  ctx.restore();

  // ---- DAY / WEATHER OVERLAY (2D) ----
  const hour = state.world?.hour ?? 12;
  if (hour < 6 || hour >= 20) {
    const nightA = isCinematic ? 0.3 : isUltra ? 0.26 : 0.2;
    ctx.fillStyle = `rgba(8, 12, 32, ${nightA})`;
    ctx.fillRect(0, 0, W, H);
    if (showLighting) {
      const moon = ctx.createRadialGradient(W * 0.78, H * 0.12, 0, W * 0.78, H * 0.12, Math.max(W, H) * 0.5);
      moon.addColorStop(
        0,
        isCinematic ? 'rgba(225, 240, 255, 0.095)' : isUltra ? 'rgba(220, 235, 255, 0.07)' : 'rgba(210, 230, 255, 0.045)'
      );
      moon.addColorStop(0.4, 'rgba(100, 130, 180, 0.02)');
      moon.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moon;
      ctx.fillRect(0, 0, W, H);
    }
    if (showLighting && (hour < 5 || hour >= 21)) {
      const ng = ctx.createLinearGradient(0, 0, W, H);
      ng.addColorStop(0, 'rgba(30, 50, 90, 0.11)');
      ng.addColorStop(0.5, 'rgba(0,0,0,0)');
      ng.addColorStop(1, 'rgba(20, 35, 70, 0.09)');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (hour < 8 || hour >= 18) {
    ctx.fillStyle = isCinematic ? 'rgba(255, 190, 120, 0.06)' : isUltra ? 'rgba(255, 190, 120, 0.04)' : 'rgba(255, 200, 140, 0.03)';
    ctx.fillRect(0, 0, W, H);
  }
  const wx = state.world?.weather ?? 'clear';
  if (wx === 'rain' || wx === 'storm') {
    ctx.fillStyle = wx === 'storm' ? 'rgba(32, 38, 52, 0.18)' : 'rgba(44, 54, 78, 0.1)';
    ctx.fillRect(0, 0, W, H);
    if (!lodFar && isHighQuality) {
      drawScreenRain(ctx, W, H, time, wx === 'storm');
    }
    if (wx === 'storm' && isUltra && Math.random() < 0.012) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.06})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (
      showParticles &&
      isHighQuality &&
      atmosphereWeather !== 'off' &&
      time - lastWeatherParticleBurst >
        (wx === 'storm'
          ? GRAPHICS_ATMOSPHERE.weatherBurstIntervalStormMs
          : GRAPHICS_ATMOSPHERE.weatherBurstIntervalRainMs) *
          wxBurstIntervalMul
    ) {
      lastWeatherParticleBurst = time;
      const baseN = wx === 'storm' ? GRAPHICS_ATMOSPHERE.mistSpawnCountStorm : GRAPHICS_ATMOSPHERE.mistSpawnCountRain;
      const n = Math.max(1, Math.round(baseN * wxBurstCountMul));
      for (let k = 0; k < n; k++) {
        spawnParticle(Math.random() * W, -8 + Math.random() * 40, 'rgba(200, 220, 255, 0.5)', 0.9, {
          kind: 'mist',
          vx: (Math.random() - 0.5) * (wx === 'storm' ? 1.8 : 0.9),
          vy: 0.55 + Math.random() * 0.85,
          maxLife: 0.85 + Math.random() * 0.5,
          size: 3 + Math.random() * 5,
        });
      }
    }
  } else if (wx === 'snow') {
    ctx.fillStyle = isUltra ? 'rgba(52, 62, 78, 0.12)' : 'rgba(58, 68, 86, 0.08)';
    ctx.fillRect(0, 0, W, H);
    if (!lodFar && isHighQuality) {
      drawScreenSnow(ctx, W, H, time, isUltra);
    }
    if (
      showParticles &&
      isHighQuality &&
      atmosphereWeather !== 'off' &&
      time - lastWeatherParticleBurst > GRAPHICS_ATMOSPHERE.weatherBurstIntervalSnowMs * wxBurstIntervalMul
    ) {
      lastWeatherParticleBurst = time;
      const nSnow = Math.max(1, Math.round(GRAPHICS_ATMOSPHERE.mistSpawnCountSnow * wxBurstCountMul));
      for (let k = 0; k < nSnow; k++) {
        spawnParticle(Math.random() * W, Math.random() * H * 0.35, 'rgba(255, 252, 255, 0.45)', 0.6, {
          kind: 'mist',
          vx: (Math.random() - 0.5) * 0.35,
          vy: 0.15 + Math.random() * 0.35,
          maxLife: 1.1 + Math.random() * 0.6,
          size: 2 + Math.random() * 3,
        });
      }
    }
  }

  // Cinematic final grade: gentle warm-to-cool split + letterbox accents.
  if (isCinematic && showLighting) {
    ctx.save();
    const grade = ctx.createLinearGradient(0, 0, 0, H);
    grade.addColorStop(0, 'rgba(255, 220, 150, 0.06)');
    grade.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    grade.addColorStop(1, 'rgba(90, 120, 180, 0.07)');
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);
    const bar = Math.max(20, Math.round(H * 0.045));
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    ctx.restore();
  }

  // ---- PARTICLES ----
  updateAndDrawParticles(ctx, dt, showParticles);
}
