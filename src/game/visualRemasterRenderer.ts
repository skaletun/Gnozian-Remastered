import type { GameState, ProductionItem, Tile } from './types';
import type { GraphicsSettings } from './settingsConstants';
import type { VectorAssetCatalog } from './vectorAssetCatalog';
import { civPrimaryColor } from './vectorAssetCatalog';
import { gridToScreen, TILE_HALF_H, TILE_HALF_W, TILE_H, TILE_W, visibleTileBounds } from './hexMetrics';
import { drawGlyph, RESOURCE_GLYPH } from './canvasGlyphDraw';
import { getNeighbors } from './mapgen';
import { VISUAL_BUDGETS, effectiveFrameQualityScale, pushFrameTimeSample } from './visualPerformance';
import { TERRAIN_COLORS, BUILDINGS, UNITS, WONDERS } from './constants';
import { drawCityBuildingModels } from './vectorBuildingModels';
import { drawImprovementByType } from './vectorImprovementModels';
import { wonderIdsForCity } from './wonderUtils';
import { getUnitVisualPose } from './unitVisualState';
import { runVisualFxPipeline } from './visualFxPipeline';
import { drawUnitMarker, drawUnitModel } from './vectorUnitModels';
import type { MapLodSnapshot } from './mapLod';
import { computeMapLodSnapshot } from './mapLod';

interface OverlayInput {
  state: GameState;
  time: number;
  camera: { x: number; y: number; zoom: number; rotation?: number };
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  graphics: GraphicsSettings;
  localViewerCivIndex: number;
  catalog: VectorAssetCatalog;
  hoveredTile: { q: number; r: number } | null;
}

const REF_MAP_CENTER = { x: 0.5, y: 0.49 };
const territoryOwnerSeen = new Map<string, number>();
const territoryGrowthStart = new Map<string, number>();

type FogRevealTracker = {
  mapW: number;
  mapH: number;
  prev: Uint8Array;
  cur: Uint8Array;
  initialized: boolean;
  lastViewer: number;
  revealStarts: Map<string, number>;
};
const fogRevealByCanvas = new WeakMap<HTMLCanvasElement, FogRevealTracker>();

function getFogRevealTracker(canvas: HTMLCanvasElement, mapW: number, mapH: number, viewer: number): FogRevealTracker {
  let t = fogRevealByCanvas.get(canvas);
  const n = mapW * mapH;
  if (!t || t.mapW !== mapW || t.mapH !== mapH) {
    t = {
      mapW,
      mapH,
      prev: new Uint8Array(n),
      cur: new Uint8Array(n),
      initialized: false,
      lastViewer: viewer,
      revealStarts: new Map(),
    };
    fogRevealByCanvas.set(canvas, t);
  }
  if (t.lastViewer !== viewer) {
    t.prev.fill(0);
    t.cur.fill(0);
    t.initialized = false;
    t.revealStarts.clear();
    t.lastViewer = viewer;
  }
  return t;
}

let currentMapLod: MapLodSnapshot | null = null;
let screenGradeGradCache: { h: number; alphaKey: string; gradient: CanvasGradient } | null = null;

function isTileVisible(tile: Tile | undefined, civIndex: number): boolean {
  if (!tile) return false;
  const i = Math.max(0, Math.floor(civIndex));
  return !!tile.visible?.[i] || !!tile.revealed?.[i];
}

function isTileRevealed(tile: Tile | undefined, civIndex: number): boolean {
  if (!tile) return false;
  const i = Math.max(0, Math.floor(civIndex));
  return !!tile.revealed?.[i];
}

/** Current line-of-sight only (fog-of-war); foreign units use this so explored-but-unseen tiles stay empty. */
function isTileInCurrentSight(tile: Tile | undefined, civIndex: number): boolean {
  if (!tile) return false;
  const i = Math.max(0, Math.floor(civIndex));
  return !!tile.visible?.[i];
}

function productionQueueHeadLabel(item: ProductionItem | undefined): string {
  if (!item) return '';
  if (item.type === 'building') return BUILDINGS[item.id]?.name ?? String(item.id);
  if (item.type === 'wonder') return WONDERS[item.id]?.name ?? String(item.id);
  return UNITS[item.id]?.name ?? String(item.id);
}

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

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
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

function drawPseudoReliefPass(input: OverlayInput, startQ: number, startR: number, endQ: number, endR: number): void {
  const { ctx, state, camera, catalog, localViewerCivIndex } = input;
  const zoom = camera.zoom;
  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      const t = state.tiles[r]?.[q];
      if (!isTileVisible(t, localViewerCivIndex)) continue;
      const p = gridToScreen(q, r, zoom);
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      const hw = TILE_W * zoom;
      const hh = TILE_H * zoom;
      // Top highlight
      ctx.save();
      hexPath(ctx, sx, sy, hw * 0.96, hh * 0.96);
      const g = ctx.createLinearGradient(sx, sy - hh * 0.6, sx, sy + hh * 0.6);
      g.addColorStop(0, catalog.tokens.terrainEdgeLight);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fill();
      // Bottom AO
      const g2 = ctx.createLinearGradient(sx, sy - hh * 0.2, sx, sy + hh * 0.7);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(1, catalog.tokens.terrainEdgeDark);
      ctx.fillStyle = g2;
      ctx.fill();
      ctx.restore();
    }
  }
}

function terrainColor(terrain: string): string {
  return TERRAIN_COLORS[terrain as keyof typeof TERRAIN_COLORS] ?? '#6b7280';
}

function mix(color: string, delta: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : '888888';
  if (hex.length !== 6) return color;
  const n = parseInt(hex, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (n & 0xff) + delta));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function rgbaFromHex(hex: string, alpha: number): string {
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  if (c.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawReferenceBackdrop(input: OverlayInput, W: number, H: number): void {
  const { ctx, time, camera } = input;
  const cx = W * REF_MAP_CENTER.x;
  const cy = H * REF_MAP_CENTER.y;
  ctx.save();

  const base = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.12, cx, cy, Math.max(W, H) * 0.78);
  base.addColorStop(0, '#18212b');
  base.addColorStop(0.38, '#101923');
  base.addColorStop(0.72, '#0a1018');
  base.addColorStop(1, '#05080d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Animated atmospheric wash: large drifting lights with slight camera parallax.
  const t = time * 0.00028;
  const parallaxX = -camera.x * 0.02;
  const parallaxY = -camera.y * 0.02;
  const glowA = ctx.createRadialGradient(
    cx + Math.sin(t * 1.3) * W * 0.24 + parallaxX,
    cy + Math.cos(t * 1.1) * H * 0.18 + parallaxY,
    0,
    cx + Math.sin(t * 1.3) * W * 0.24 + parallaxX,
    cy + Math.cos(t * 1.1) * H * 0.18 + parallaxY,
    Math.max(W, H) * 0.72
  );
  glowA.addColorStop(0, 'rgba(66, 112, 168, 0.12)');
  glowA.addColorStop(0.55, 'rgba(44, 77, 122, 0.08)');
  glowA.addColorStop(1, 'rgba(10, 16, 28, 0)');
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);

  const glowB = ctx.createRadialGradient(
    cx + Math.cos(t * 0.95 + 1.2) * W * 0.28 - parallaxX * 0.7,
    cy + Math.sin(t * 1.45 + 0.4) * H * 0.22 - parallaxY * 0.7,
    0,
    cx + Math.cos(t * 0.95 + 1.2) * W * 0.28 - parallaxX * 0.7,
    cy + Math.sin(t * 1.45 + 0.4) * H * 0.22 - parallaxY * 0.7,
    Math.max(W, H) * 0.66
  );
  glowB.addColorStop(0, 'rgba(173, 136, 84, 0.09)');
  glowB.addColorStop(0.55, 'rgba(93, 73, 48, 0.06)');
  glowB.addColorStop(1, 'rgba(20, 14, 10, 0)');
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);

  // Moving diagonal texture to avoid a static-looking backdrop.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = 'rgba(190, 220, 255, 0.24)';
  ctx.lineWidth = 1;
  const diagStep = 34;
  const diagShift = ((time * 0.04 + camera.x * 0.15) % diagStep + diagStep) % diagStep;
  for (let d = -H; d < W + H; d += diagStep) {
    const x0 = d + diagShift;
    ctx.beginPath();
    ctx.moveTo(x0, -8);
    ctx.lineTo(x0 - H - 16, H + 8);
    ctx.stroke();
  }
  ctx.restore();

  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = 'rgba(75, 96, 112, 0.28)';
  ctx.lineWidth = 1;
  const gridW = 66;
  const gridH = 50;
  for (let y = -gridH; y < H + gridH; y += gridH * 0.75) {
    for (let x = -gridW; x < W + gridW; x += gridW) {
      const ox = ((Math.floor(y / (gridH * 0.75)) & 1) ? gridW * 0.5 : 0);
      hexPath(ctx, x + ox, y, gridW, gridH);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = 'rgba(122, 105, 74, 0.34)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 9; i++) {
    const y = H * (0.22 + i * 0.065);
    const amp = 12 + (i % 3) * 7;
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 32) {
      const yy = y + Math.sin((x + time * 0.004 + i * 47) / 62) * amp;
      if (x === -20) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  const vignette = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.28, cx, cy, Math.max(W, H) * 0.68);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.6, 'rgba(0,0,0,0.30)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}

function drawReferenceCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 11; i++) {
    const ox = (Math.sin(seed * 12.7 + i * 1.93) * 0.42) * w;
    const oy = (Math.cos(seed * 7.1 + i * 2.31) * 0.28) * h;
    const rw = w * (0.18 + ((i * 13 + seed) % 7) * 0.035);
    const rh = h * (0.16 + ((i * 19 + seed) % 5) * 0.04);
    const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, Math.max(rw, rh));
    g.addColorStop(0, 'rgba(230,232,224,0.28)');
    g.addColorStop(0.55, 'rgba(160,168,164,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x + ox, y + oy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawReferenceCloudBanks(input: OverlayInput, W: number, H: number): void {
  const { ctx, time } = input;
  const drift = Math.sin(time / 7000) * 10;
  drawReferenceCloud(ctx, W * 0.08 + drift, H * 0.13, W * 0.22, H * 0.16, 1);
  drawReferenceCloud(ctx, W * 0.03 - drift * 0.7, H * 0.82, W * 0.23, H * 0.16, 2);
  drawReferenceCloud(ctx, W * 0.90 + drift * 0.45, H * 0.10, W * 0.20, H * 0.14, 3);
  drawReferenceCloud(ctx, W * 0.88 - drift * 0.35, H * 0.36, W * 0.16, H * 0.12, 4);
}

function drawReferenceIslandShadow(input: OverlayInput, startQ: number, startR: number, endQ: number, endR: number): void {
  const { ctx, state, camera, localViewerCivIndex, canvas } = input;
  const mode = currentMapLod?.islandShadow ?? 'solid';
  if (mode === 'off') return;

  const W = canvas.clientWidth || canvas.width;
  const H = canvas.clientHeight || canvas.height;
  const zoom = camera.zoom;
  ctx.save();
  if (mode === 'blur') {
    ctx.filter = `blur(${Math.max(5, 12 * zoom)}px)`;
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
  } else {
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(0,0,0,0.44)';
  }
  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      const t = state.tiles[r]?.[q];
      if (!isTileRevealed(t, localViewerCivIndex)) continue;
      const p = gridToScreen(q, r, zoom);
      const sx = p.x - camera.x;
      const sy = p.y - camera.y + Math.max(8, 18 * zoom);
      if (sx < -TILE_W * zoom || sx > W + TILE_W * zoom || sy < -TILE_H * zoom || sy > H + TILE_H * zoom) continue;
      hexPath(ctx, sx, sy, TILE_W * zoom * 1.02, TILE_H * zoom * 1.04);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawReferenceHexWalls(input: OverlayInput, startQ: number, startR: number, endQ: number, endR: number): void {
  const { ctx, state, camera, localViewerCivIndex } = input;
  const wallMode = currentMapLod?.hexWalls ?? 'full';
  if (wallMode === 'off') return;

  const zoom = camera.zoom;
  const depth = wallMode === 'edgesOnly' ? Math.max(4, 9 * zoom) : Math.max(6, 15 * zoom);
  const neighborDirs = [
    { dq: 1, dr: 0, edge: 1 },
    { dq: 0, dr: 1, edge: 2 },
    { dq: -1, dr: 1, edge: 3 },
    { dq: -1, dr: 0, edge: 4 },
    { dq: 0, dr: -1, edge: 5 },
    { dq: 1, dr: -1, edge: 0 },
  ] as const;
  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      const tile = state.tiles[r]?.[q];
      if (!isTileRevealed(tile, localViewerCivIndex)) continue;
      const p = gridToScreen(q, r, zoom);
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      const hw = TILE_W * zoom * 0.5;
      const hh = TILE_H * zoom * 0.5;
      const qh = TILE_H * zoom * 0.25;
      const edges = [
        { a: [sx, sy - hh], b: [sx + hw, sy - qh], tone: 0 },
        { a: [sx + hw, sy - qh], b: [sx + hw, sy + qh], tone: 1 },
        { a: [sx + hw, sy + qh], b: [sx, sy + hh], tone: 2 },
        { a: [sx, sy + hh], b: [sx - hw, sy + qh], tone: 3 },
        { a: [sx - hw, sy + qh], b: [sx - hw, sy - qh], tone: 1 },
        { a: [sx - hw, sy - qh], b: [sx, sy - hh], tone: 0 },
      ] as const;

      for (const d of neighborDirs) {
        if (wallMode === 'edgesOnly' && d.edge !== 2 && d.edge !== 3) continue;
        const nt = state.tiles[r + d.dr]?.[q + d.dq];
        const exposed = !isTileRevealed(nt, localViewerCivIndex);
        if (!exposed && d.edge !== 2 && d.edge !== 3) continue;
        const edge = edges[d.edge]!;
        const shade =
          edge.tone === 2 || edge.tone === 3
            ? 'rgba(82, 62, 33, 0.92)'
            : edge.tone === 1
              ? 'rgba(119, 91, 45, 0.82)'
              : 'rgba(171, 132, 60, 0.58)';
        ctx.beginPath();
        ctx.moveTo(edge.a[0], edge.a[1]);
        ctx.lineTo(edge.b[0], edge.b[1]);
        ctx.lineTo(edge.b[0], edge.b[1] + depth);
        ctx.lineTo(edge.a[0], edge.a[1] + depth);
        ctx.closePath();
        ctx.fillStyle = shade;
        ctx.fill();
        if (wallMode === 'full') {
          ctx.strokeStyle = 'rgba(20,14,8,0.55)';
          ctx.lineWidth = Math.max(0.8, zoom);
          ctx.stroke();
        }
      }
    }
  }
}

function drawTerritoryPass(input: OverlayInput, startQ: number, startR: number, endQ: number, endR: number): void {
  const { ctx, state, camera, localViewerCivIndex, time, graphics } = input;
  const zoom = camera.zoom;
  const territoryEnabled = graphics.territoryBorders !== false;
  if (!territoryEnabled) {
    territoryOwnerSeen.clear();
    territoryGrowthStart.clear();
    return;
  }

  const territoryPass = currentMapLod?.territoryPass ?? 'full';
  if (territoryPass === 'off') {
    territoryOwnerSeen.clear();
    territoryGrowthStart.clear();
    return;
  }

  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      const tile = state.tiles[r]?.[q];
      if (!tile || tile.owner == null) continue;
      const owner = state.civilizations[tile.owner];
      if (!owner) continue;

      const revealed = !!tile.revealed?.[localViewerCivIndex];
      const visible = !!tile.visible?.[localViewerCivIndex];
      if (!revealed) continue;

      const p = gridToScreen(q, r, zoom);
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;

      const key = `${q},${r}`;
      const prevOwner = territoryOwnerSeen.get(key);
      if (prevOwner == null) {
        territoryOwnerSeen.set(key, tile.owner);
      } else if (prevOwner !== tile.owner) {
        territoryOwnerSeen.set(key, tile.owner);
        territoryGrowthStart.set(key, time);
      }

      const growthStart = territoryGrowthStart.get(key);
      let growT = 1;
      let growBoost = 0;
      if (growthStart != null) {
        const u = Math.max(0, Math.min(1, (time - growthStart) / 900));
        const eased = 1 - Math.pow(1 - u, 3);
        growT = 0.84 + 0.16 * eased;
        growBoost = 1 - u;
        if (u >= 1) territoryGrowthStart.delete(key);
      }

      const zoomRead = Math.min(1.2, 0.72 + zoom * 0.95);

      if (territoryPass === 'fill') {
        hexPath(ctx, sx, sy, TILE_W * zoom * growT, TILE_H * zoom * growT);
        const fillAlpha =
          ((visible ? 0.1 : 0.065) + growBoost * 0.06) * zoomRead;
        ctx.fillStyle = rgbaFromHex(owner.color, Math.min(0.42, fillAlpha));
        ctx.fill();
        continue;
      }

      // Slow “breathing” + light per-tile phase so borders don’t pulse in perfect lockstep.
      const breathPhase = q * 0.71 + r * 0.53;
      const breath = Math.sin(time / 1020 + breathPhase) * 0.5 + 0.5;
      const breatheScale = 0.968 + breath * 0.064;
      const breatheAlpha = 0.84 + breath * 0.32;

      const pulse = Math.sin(time / 640 + q * 0.41 + r * 0.33) * 0.5 + 0.5;
      const fillAlpha =
        ((visible ? 0.09 : 0.055) + pulse * (visible ? 0.026 : 0.014) + growBoost * 0.07) *
        zoomRead *
        breatheAlpha;
      const fillScale = growT * breatheScale;
      hexPath(ctx, sx, sy, TILE_W * zoom * fillScale, TILE_H * zoom * fillScale);
      ctx.fillStyle = rgbaFromHex(owner.color, Math.min(0.48, fillAlpha));
      ctx.fill();

      const glowAlpha =
        ((visible ? 0.14 : 0.075) + pulse * (visible ? 0.08 : 0.045) + growBoost * 0.12) *
        zoomRead *
        breatheAlpha;
      const glowOuter = 1.02 + growBoost * 0.04 + breath * 0.035;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(
        sx,
        sy,
        TILE_W * zoom * 0.08,
        sx,
        sy,
        TILE_W * zoom * (0.66 + growBoost * 0.1 + breath * 0.08)
      );
      glow.addColorStop(0, rgbaFromHex(owner.color, Math.min(0.58, glowAlpha)));
      glow.addColorStop(0.55, rgbaFromHex(owner.color, Math.min(0.42, glowAlpha * 0.42)));
      glow.addColorStop(1, rgbaFromHex(owner.color, 0));
      hexPath(ctx, sx, sy, TILE_W * zoom * glowOuter * breatheScale, TILE_H * zoom * glowOuter * breatheScale);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawTerrainBasePass(input: OverlayInput, startQ: number, startR: number, endQ: number, endR: number): void {
  const { ctx, state, camera, localViewerCivIndex } = input;
  const zoom = camera.zoom;
  const terrainPass = currentMapLod?.terrainPass ?? 'full';

  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      const t = state.tiles[r]?.[q];
      if (!t) continue;
      const p = gridToScreen(q, r, zoom);
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      const w = TILE_W * zoom;
      const h = TILE_H * zoom;
      const base = terrainColor(t.terrain);
      const revealed = !!t.revealed?.[localViewerCivIndex];
      const visible = !!t.visible?.[localViewerCivIndex];
      if (!revealed) {
        continue;
      }

      if (terrainPass === 'flat') {
        hexPath(ctx, sx, sy, w * 0.98, h * 0.98);
        ctx.fillStyle = mix(base, visible ? 8 : -12);
        ctx.fill();
        ctx.strokeStyle = visible ? 'rgba(255,236,170,0.14)' : 'rgba(255,236,170,0.08)';
        ctx.lineWidth = Math.max(0.6, zoom * 0.9);
        ctx.stroke();
        continue;
      }

      if (terrainPass === 'lite') {
        hexPath(ctx, sx, sy, w * 0.98, h * 0.98);
        const grad = ctx.createLinearGradient(sx - w * 0.28, sy - h * 0.45, sx + w * 0.28, sy + h * 0.45);
        grad.addColorStop(0, mix(base, visible ? 36 : 12));
        grad.addColorStop(0.55, base);
        grad.addColorStop(1, mix(base, visible ? -32 : -48));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = visible ? 'rgba(255,236,170,0.22)' : 'rgba(255,236,170,0.1)';
        ctx.lineWidth = Math.max(0.8, zoom * 1.1);
        ctx.stroke();
        continue;
      }

      ctx.save();
      hexPath(ctx, sx, sy, w * 0.98, h * 0.98);

      ctx.clip();

      const grad = ctx.createLinearGradient(sx - w * 0.35, sy - h * 0.55, sx + w * 0.35, sy + h * 0.55);
      grad.addColorStop(0, mix(base, visible ? 48 : 16));
      grad.addColorStop(0.36, mix(base, visible ? 24 : 4));
      grad.addColorStop(0.72, base);
      grad.addColorStop(1, mix(base, visible ? -46 : -58));
      ctx.fillStyle = grad;
      ctx.fill();

      if (visible && zoom > 0.3) {
        ctx.globalCompositeOperation = 'overlay';
        const noiseCount = ((r * 31 + q * 17) % 8) + 8;
        for (let i = 0; i < noiseCount; i++) {
          const nx = sx + (((i * 53 + q * 19) % Math.max(1, w)) - w / 2);
          const ny = sy + (((i * 71 + r * 23) % Math.max(1, h * 0.72)) - h * 0.36);
          const nr = 2.5 * zoom + ((i * 13) % Math.max(2, 7 * zoom));
          ctx.beginPath();
          ctx.arc(nx, ny, nr, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,245,190,0.08)' : 'rgba(42,30,12,0.06)';
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.strokeStyle = visible ? 'rgba(255,236,170,0.28)' : 'rgba(255,236,170,0.12)';
      ctx.lineWidth = Math.max(1, zoom * 1.4);
      ctx.stroke();

      // Tile accent to make hex types read better at distance.
      if (visible && zoom > 0.55) {
        ctx.beginPath();
        ctx.ellipse(sx - w * 0.12, sy - h * 0.12, w * 0.18, h * 0.1, -0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,248,190,0.12)';
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawRoadAndRiverPass(input: OverlayInput): void {
  const { ctx, state, camera, catalog, localViewerCivIndex } = input;
  const zoom = camera.zoom;
  const routes = state.tradeRoutes ?? [];
  ctx.save();
  for (const route of routes) {
    const a = state.cities.find(c => c.id === route.fromCityId);
    const b = state.cities.find(c => c.id === route.toCityId);
    if (!a || !b) continue;
    const ta = state.tiles[a.r]?.[a.q];
    const tb = state.tiles[b.r]?.[b.q];
    if (!isTileVisible(ta, localViewerCivIndex) || !isTileVisible(tb, localViewerCivIndex)) continue;
    const p1 = gridToScreen(a.q, a.r, zoom);
    const p2 = gridToScreen(b.q, b.r, zoom);
    const x1 = p1.x - camera.x;
    const y1 = p1.y - camera.y;
    const x2 = p2.x - camera.x;
    const y2 = p2.y - camera.y;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const bend = Math.min(36, len * 0.22) * zoom;
    const cpx = mx + nx * bend;
    const cpy = my + ny * bend;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.strokeStyle = catalog.tokens.roadGlow;
    ctx.lineWidth = Math.max(3, 7 * zoom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.strokeStyle = catalog.tokens.roadColor;
    ctx.lineWidth = Math.max(1.5, 3.2 * zoom);
    ctx.stroke();
  }
  // Lightweight vector "river" impression near water-adjacent land
  for (const city of state.cities) {
    const tile = state.tiles[city.r]?.[city.q];
    if (!isTileVisible(tile, localViewerCivIndex)) continue;
    const neigh = getNeighbors(city.q, city.r, state.tiles[0]?.length ?? 0, state.tiles.length);
    const coastNeighbor = neigh.find(n => {
      const nt = state.tiles[n.r]?.[n.q];
      return nt?.terrain === 'coast' || nt?.terrain === 'ocean';
    });
    if (!coastNeighbor) continue;
    const p = gridToScreen(city.q, city.r, zoom);
    const p2 = gridToScreen(coastNeighbor.q, coastNeighbor.r, zoom);
    const x1 = p.x - camera.x;
    const y1 = p.y - camera.y;
    const x2 = p2.x - camera.x;
    const y2 = p2.y - camera.y;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo((x1 + x2) / 2, (y1 + y2) / 2);
    ctx.strokeStyle = catalog.tokens.riverColor;
    ctx.lineWidth = Math.max(1.1, 2.1 * zoom);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCityOverlayPass(input: OverlayInput): void {
  const { ctx, state, camera, localViewerCivIndex, graphics } = input;
  const zoom = camera.zoom;
  for (const city of state.cities) {
    const t = state.tiles[city.r]?.[city.q];
    if (!isTileVisible(t, localViewerCivIndex)) continue;
    const p = gridToScreen(city.q, city.r, zoom);
    const sx = p.x - camera.x;
    const sy = p.y - camera.y;
    const owner = state.civilizations[city.owner];
    ctx.save();
    ctx.fillStyle = civPrimaryColor(owner?.color);
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 16 * zoom, Math.max(24, 42 * zoom), Math.max(10, 17 * zoom), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Vector "building model" silhouettes stay visible at strategic zoom levels.
    ctx.save();
    const colorA = mix(civPrimaryColor(owner?.secondaryColor ?? owner?.color), -10);
    const colorB = mix(civPrimaryColor(owner?.color), 12);
    const lod = currentMapLod;
    const wonderIds = wonderIdsForCity(state.systems.wonderOwners, city.id);
    drawCityBuildingModels(ctx, city, sx, sy, zoom, colorA, colorB, {
      visualDetail: graphics.visualDetail ?? 'balanced',
      strategicView: lod?.strategicView ?? false,
      tacticalFarView: lod?.tacticalFarView ?? false,
      wonderIds,
    });
    ctx.restore();

    const viewerIdx = Math.max(0, Math.floor(localViewerCivIndex));
    if (city.owner === viewerIdx && zoom >= 0.26 && zoom >= 0.175) {
      const head = city.productionQueue[0];
      if (head && head.cost > 0) {
        const prog = Math.min(1, head.progress / head.cost);
        const fontPx = Math.max(8, Math.min(12, 10 * Math.sqrt(zoom)));
        const nameY = sy - Math.max(38, 48 * zoom);
        const cityLine = city.name.length > 12 ? `${city.name.slice(0, 11)}…` : city.name;
        let prodLine = productionQueueHeadLabel(head);
        if (prodLine.length > 20) prodLine = `${prodLine.slice(0, 19)}…`;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = `600 ${fontPx}px system-ui,Segoe UI,sans-serif`;
        ctx.lineWidth = Math.max(2, 2.8 * zoom);
        ctx.strokeStyle = 'rgba(0,0,0,0.78)';
        ctx.fillStyle = 'rgba(255,248,235,0.97)';
        ctx.strokeText(cityLine, sx, nameY);
        ctx.fillText(cityLine, sx, nameY);
        ctx.font = `500 ${fontPx - 0.5}px system-ui,Segoe UI,sans-serif`;
        const subY = nameY + fontPx + 2;
        ctx.textBaseline = 'top';
        ctx.strokeText(prodLine, sx, subY);
        ctx.fillText(prodLine, sx, subY);
        const bw = Math.max(44, 62 * zoom);
        const bh = Math.max(2.4, 3.4 * zoom);
        const bx = sx - bw / 2;
        const by = subY + fontPx + 3;
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = 'rgba(218,175,72,0.96)';
        ctx.fillRect(bx, by, bw * prog, bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.lineWidth = Math.max(0.5, 0.7 * zoom);
        ctx.strokeRect(bx + 0.25, by + 0.25, bw - 0.5, bh - 0.5);
        ctx.restore();
      }
    }
  }
}

function drawUnitOverlayPass(input: OverlayInput): void {
  const { ctx, state, camera, localViewerCivIndex, time } = input;
  const zoom = camera.zoom;
  const viewer = Math.max(0, Math.floor(localViewerCivIndex));
  for (const unit of state.units) {
    const t = state.tiles[unit.r]?.[unit.q];
    if (unit.owner !== viewer) {
      if (!isTileInCurrentSight(t, viewer)) continue;
    } else if (!isTileVisible(t, viewer)) {
      continue;
    }
    const pose = getUnitVisualPose(unit, time, zoom);
    const targetP = gridToScreen(pose.visualQ, pose.visualR, zoom);
    const sx = targetP.x - camera.x;
    const baseY = targetP.y - camera.y - 8 * zoom;
    const animatedY = baseY + pose.yOffset;
    const radius = Math.max(18, Math.min(TILE_HALF_W * zoom * 0.72, 26 * Math.max(zoom, 0.72)));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,221,140,0.34)';
    ctx.lineWidth = Math.max(0.8, 1.1 * zoom);
    ctx.beginPath();
    ctx.ellipse(sx, animatedY + radius * 0.48, radius * 0.9, radius * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (unit.owner === viewer && (unit.movement > 0 || !unit.hasAttacked)) {
      ctx.strokeStyle = 'rgba(255,230,140,0.62)';
      ctx.beginPath();
      ctx.arc(sx, animatedY - radius * 1.18, Math.max(6, radius * 0.35), 0, Math.PI * 2);
      ctx.stroke();
    }
    const owner = state.civilizations[unit.owner];
    const primary = civPrimaryColor(owner?.color);
    const secondary = civPrimaryColor(owner?.secondaryColor ?? owner?.color);
    const isAirModel =
      unit.type === 'fighter' ||
      unit.type === 'bomber' ||
      unit.type === 'nuclear_missile';
    // Ground/civilian silhouettes read better as fixed isometric pieces:
    // avoid full 360 turns that look like sprite flips.
    // drawUnitModel internally applies +PI/2 to map "up-facing" silhouettes to movement bearing.
    // For non-air units we keep an upright baseline (-PI/2 cancels that internal offset).
    const modelFacing = isAirModel
      ? pose.headingRadians + pose.wobble
      : -Math.PI / 2 + pose.wobble * 0.7;
    drawUnitModel(ctx, unit, sx, animatedY, radius * pose.scale, {
      primary,
      secondary: mix(secondary, 18),
      detail: 'rgba(255,255,255,0.88)',
    }, modelFacing);
    drawUnitMarker(ctx, unit, sx, animatedY - radius * 0.92, radius, {
      primary,
      secondary: mix(secondary, 18),
      detail: 'rgba(255,255,255,0.88)',
    });
    if (pose.state === 'attack' || pose.state === 'celebrate') {
      ctx.strokeStyle = pose.state === 'attack' ? 'rgba(255,180,110,0.9)' : 'rgba(140,255,190,0.9)';
      ctx.lineWidth = Math.max(1.2, 1.7 * zoom);
      ctx.beginPath();
      ctx.arc(sx, animatedY, radius * 1.55, 0, Math.PI * 2);
      ctx.stroke();
      if (pose.state === 'attack') {
        const reach = radius * (1.65 + pose.stateProgress * 0.6);
        ctx.strokeStyle = 'rgba(255,230,170,0.9)';
        ctx.lineWidth = Math.max(1.4, 2 * zoom);
        ctx.beginPath();
        ctx.moveTo(sx, animatedY);
        ctx.lineTo(sx + Math.cos(pose.headingRadians) * reach, animatedY + Math.sin(pose.headingRadians) * reach);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawFogAndVisibilityPass(input: OverlayInput, startQ: number, startR: number, endQ: number, endR: number): void {
  const { ctx, state, camera, localViewerCivIndex, canvas, time } = input;
  const zoom = camera.zoom;
  const mapW = state.tiles[0]?.length ?? 0;
  const mapH = state.tiles.length;
  const vi = Math.max(0, Math.floor(localViewerCivIndex));
  const fogTr = mapW > 0 && mapH > 0 ? getFogRevealTracker(canvas, mapW, mapH, vi) : null;
  if (fogTr) fogTr.cur.fill(0);

  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      const t = state.tiles[r]?.[q];
      if (!t) continue;
      const visible = !!t.visible?.[vi];
      const revealed = !!t.revealed?.[vi];
      if (fogTr && q >= 0 && r >= 0 && q < fogTr.mapW && r < fogTr.mapH) {
        const fi = r * fogTr.mapW + q;
        if (revealed) fogTr.cur[fi] = visible ? 1 : 0;
      }
      if (!revealed) continue;
      if (!visible) {
        const p = gridToScreen(q, r, zoom);
        const sx = p.x - camera.x;
        const sy = p.y - camera.y;
        const w = TILE_W * zoom;
        const h = TILE_H * zoom;
        ctx.save();
        hexPath(ctx, sx, sy, w, h);
        const g = ctx.createLinearGradient(sx, sy - h * 0.5, sx, sy + h * 0.5);
        g.addColorStop(0, 'rgba(10,14,22,0.45)');
        g.addColorStop(1, 'rgba(2,4,7,0.64)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  if (fogTr && fogTr.initialized) {
    const REVEAL_MS = 720;
    for (let r = startR; r <= endR; r++) {
      for (let q = startQ; q <= endQ; q++) {
        const fi = r * fogTr.mapW + q;
        if (!fogTr.cur[fi] || fogTr.prev[fi]) continue;
        fogTr.revealStarts.set(`${q},${r}`, time);
      }
    }
    for (const [key, start] of [...fogTr.revealStarts.entries()]) {
      const age = time - start;
      if (age > REVEAL_MS + 120) {
        fogTr.revealStarts.delete(key);
        continue;
      }
      const [qs, rs] = key.split(',').map(Number);
      if (qs < startQ || qs > endQ || rs < startR || rs > endR) continue;
      const t = state.tiles[rs]?.[qs];
      if (!t?.visible?.[vi]) {
        fogTr.revealStarts.delete(key);
        continue;
      }
      const p = gridToScreen(qs, rs, zoom);
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      const pulse = Math.max(0, 1 - age / REVEAL_MS);
      const w = TILE_W * zoom;
      const h = TILE_H * zoom;
      ctx.save();
      hexPath(ctx, sx, sy, w * 1.02, h * 1.02);
      ctx.strokeStyle = `rgba(180, 230, 255, ${0.22 * pulse})`;
      ctx.lineWidth = Math.max(1.2, 2.4 * zoom);
      ctx.stroke();
      ctx.globalCompositeOperation = 'screen';
      hexPath(ctx, sx, sy, w * 0.88, h * 0.88);
      ctx.fillStyle = `rgba(120, 200, 255, ${0.08 * pulse})`;
      ctx.fill();
      ctx.restore();
    }
  }

  if (fogTr) {
    fogTr.prev.set(fogTr.cur);
    fogTr.initialized = true;
  }
}

function drawDisasterFx(input: OverlayInput): void {
  const { ctx, state, camera, localViewerCivIndex, time } = input;
  if (!state.systems?.disasters?.length) return;
  const zoom = camera.zoom;
  const pulse = Math.sin(time / 170) * 0.5 + 0.5;
  for (const d of state.systems.disasters) {
    const tile = state.tiles[d.r]?.[d.q];
    if (!isTileVisible(tile, localViewerCivIndex)) continue;
    const p = gridToScreen(d.q, d.r, zoom);
    const sx = p.x - camera.x;
    const sy = p.y - camera.y;
    const radius = Math.max(14, d.radius * TILE_HALF_W * zoom * 0.82);
    const color =
      d.kind === 'flood' || d.kind === 'tsunami'
        ? 'rgba(90,205,255,0.68)'
        : d.kind === 'earthquake'
          ? 'rgba(255,168,92,0.65)'
          : d.kind === 'volcanic_eruption'
            ? 'rgba(255,95,95,0.72)'
            : 'rgba(255,215,120,0.62)';
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, radius * (0.9 + pulse * 0.14), 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.6, 2.8 * zoom);
    ctx.stroke();
    ctx.restore();
  }
}

function drawInfoOverlays(input: OverlayInput): void {
  const { ctx, state, camera, localViewerCivIndex, hoveredTile, catalog } = input;
  if (!hoveredTile) return;
  const t = state.tiles[hoveredTile.r]?.[hoveredTile.q];
  if (!isTileVisible(t, localViewerCivIndex)) return;
  const p = gridToScreen(hoveredTile.q, hoveredTile.r, camera.zoom);
  const sx = p.x - camera.x;
  const sy = p.y - camera.y + TILE_HALF_H * camera.zoom * 0.8;
  const label = `${t?.terrain ?? ''}${t?.resource ? ` • ${t.resource}` : ''}${t?.improvement && t.improvement !== 'none' ? ` • ${t.improvement}` : ''}`;
  ctx.save();
  const text = label.toUpperCase();
  const font = `${Math.max(10, 11 * camera.zoom)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.font = font;
  const w = ctx.measureText(text).width;
  const h = Math.max(14, 16 * camera.zoom);
  const x = sx - w / 2 - 8;
  const y = sy;
  ctx.fillStyle = 'rgba(10,14,22,0.8)';
  roundedRectPath(ctx, x, y, w + 16, h + 6, 6);
  ctx.fill();
  ctx.fillStyle = catalog.tokens.overlayText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, sx, y + (h + 6) / 2);
  ctx.restore();
}

function drawSelectionPass(input: OverlayInput): void {
  const { ctx, state, camera, time } = input;
  const zoom = camera.zoom;
  const tile = state.selectedTile;
  if (!tile) return;
  
  const p = gridToScreen(tile.q, tile.r, zoom);
  const sx = p.x - camera.x;
  const sy = p.y - camera.y;
  
  const pulse = Math.sin(time / 200) * 0.5 + 0.5;
  const hw = TILE_W * zoom;
  const hh = TILE_H * zoom;
  
  ctx.save();
  ctx.strokeStyle = `rgba(255, 235, 120, ${0.4 + pulse * 0.4})`;
  ctx.lineWidth = Math.max(2, 4 * zoom);
  hexPath(ctx, sx, sy, hw * 0.98, hh * 0.98);
  ctx.stroke();
  
  ctx.fillStyle = `rgba(255, 220, 100, ${0.05 + pulse * 0.1})`;
  ctx.fill();
  
  // Outer glow
  ctx.strokeStyle = `rgba(255, 210, 80, ${0.1 + pulse * 0.2})`;
  ctx.lineWidth = Math.max(6, 12 * zoom);
  hexPath(ctx, sx, sy, hw * 1.02, hh * 1.02);
  ctx.stroke();
  ctx.restore();
}

function drawReferenceForestCluster(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  zoom: number,
  q: number,
  r: number,
  jungle: boolean
): void {
  const canopyA = jungle ? '#2f7a32' : '#356a35';
  const canopyB = jungle ? '#184b20' : '#1f4528';
  const canopyC = jungle ? '#6b9842' : '#5f8640';
  const count = ((q * 17 + r * 29) % 5) + 9;
  ctx.save();
  ctx.translate(sx, sy + 3 * zoom);
  ctx.fillStyle = 'rgba(15,20,10,0.38)';
  ctx.beginPath();
  ctx.ellipse(2 * zoom, 10 * zoom, 36 * zoom, 14 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < count; i++) {
    const ox = (((i * 31 + q * 11) % 56) - 28) * zoom;
    const oy = (((i * 23 + r * 7) % 34) - 18) * zoom;
    const size = (8 + ((i * 13 + q + r) % 6)) * zoom;
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(ox - 1.2 * zoom, oy + size * 0.2, 2.4 * zoom, size * 0.8);
    const g = ctx.createRadialGradient(ox - size * 0.24, oy - size * 0.2, size * 0.1, ox, oy, size);
    g.addColorStop(0, canopyC);
    g.addColorStop(0.48, canopyA);
    g.addColorStop(1, canopyB);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ox, oy, size * 0.72, size * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,38,18,0.45)';
    ctx.lineWidth = Math.max(0.6, 0.8 * zoom);
    ctx.stroke();
  }
  ctx.restore();
}

function drawReferenceMountain(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, q: number, r: number): void {
  ctx.save();
  ctx.translate(sx, sy + 12 * zoom);
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(4 * zoom, 4 * zoom, 34 * zoom, 12 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  const peaks = [
    { x: -16, y: 6, w: 18, h: 42, light: '#c8bf9b', mid: '#8f815b', dark: '#554b3a' },
    { x: 3, y: 8, w: 25, h: 55, light: '#d7c878', mid: '#a79250', dark: '#655538' },
    { x: 21, y: 8, w: 17, h: 38, light: '#c6bc94', mid: '#887a5e', dark: '#4d463c' },
  ];
  for (const p of peaks) {
    const jitter = ((q * 7 + r * 13) % 5) * zoom;
    const x = p.x * zoom;
    const y = p.y * zoom;
    const w = p.w * zoom;
    const h = (p.h + jitter) * zoom;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x - w, y);
    ctx.closePath();
    ctx.fillStyle = p.mid;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - w, y);
    ctx.lineTo(x - w * 0.08, y - h * 0.1);
    ctx.closePath();
    ctx.fillStyle = p.dark;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w * 0.16, y - h * 0.18);
    ctx.closePath();
    ctx.fillStyle = p.light;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w * 0.34, y - h * 0.58);
    ctx.lineTo(x + w * 0.08, y - h * 0.48);
    ctx.lineTo(x - w * 0.2, y - h * 0.56);
    ctx.closePath();
    ctx.fillStyle = 'rgba(245,244,228,0.9)';
    ctx.fill();
  }
  ctx.restore();
}

function drawReferenceHills(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number): void {
  ctx.save();
  ctx.translate(sx, sy + 10 * zoom);
  for (let i = 0; i < 4; i++) {
    const ox = (-21 + i * 14) * zoom;
    const oy = ((i % 2) * 5 - 6) * zoom;
    const g = ctx.createLinearGradient(ox - 10 * zoom, oy - 15 * zoom, ox + 12 * zoom, oy + 8 * zoom);
    g.addColorStop(0, '#d2bd65');
    g.addColorStop(0.55, '#a8914e');
    g.addColorStop(1, '#695538');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ox, oy, 18 * zoom, 10 * zoom, -0.18, Math.PI, Math.PI * 2);
    ctx.lineTo(ox + 18 * zoom, oy + 7 * zoom);
    ctx.lineTo(ox - 18 * zoom, oy + 7 * zoom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawReferenceResourceMarker(
  ctx: CanvasRenderingContext2D,
  resource: string,
  sx: number,
  sy: number,
  zoom: number
): void {
  ctx.save();
  ctx.translate(sx + 22 * zoom, sy + 18 * zoom);
  const isStrategic = ['iron', 'horse', 'coal', 'oil', 'uranium'].includes(resource);
  const markerZoom = Math.max(zoom, 0.92);
  const radius = Math.max(12, 14 * markerZoom);
  const g = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.1, 0, 0, radius);
  g.addColorStop(0, isStrategic ? '#d9f2ff' : '#fff2b8');
  g.addColorStop(0.42, isStrategic ? '#477a92' : '#8d6428');
  g.addColorStop(1, '#17100a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isStrategic ? 'rgba(145,225,255,0.9)' : 'rgba(251,204,86,0.95)';
  ctx.lineWidth = Math.max(1.6, 1.8 * markerZoom);
  ctx.stroke();
  drawGlyph(ctx, RESOURCE_GLYPH[resource] ?? 'gem', 0, 0, Math.max(12, 13 * markerZoom), '#f8f0d8', 1.8);
  ctx.restore();
}

function drawEnvironmentAndResourcesPass(input: OverlayInput, startQ: number, startR: number, endQ: number, endR: number): void {
  const { ctx, state, camera, localViewerCivIndex, graphics } = input;
  const zoom = camera.zoom;
  const lod = currentMapLod;
  const farmUltra =
    (graphics.visualDetail ?? 'balanced') === 'ultra' && zoom >= 0.28 && !(lod?.strategicView ?? false);

  for (let r = startR; r <= endR; r++) {
    for (let q = startQ; q <= endQ; q++) {
      const t = state.tiles[r]?.[q];
      if (!isTileVisible(t, localViewerCivIndex)) continue;

      const p = gridToScreen(q, r, zoom);
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;

      if (currentMapLod!.showEnvironmentClusters) {
        if (t.terrain === 'forest' || t.terrain === 'jungle') {
          drawReferenceForestCluster(ctx, sx, sy, zoom, q, r, t.terrain === 'jungle');
        } else if (t.terrain === 'mountains') {
          drawReferenceMountain(ctx, sx, sy, zoom, q, r);
        } else if (t.terrain === 'hills') {
          drawReferenceHills(ctx, sx, sy, zoom);
        }
        if (t.improvement !== 'none') {
          drawImprovementByType(ctx, sx, sy, zoom, t.improvement, t.terrain, q, r, farmUltra);
        }
      }

      if (t.resource) {
        drawReferenceResourceMarker(ctx, t.resource, sx, sy, zoom);
      }
    }
  }
}

export function renderVisualRemasterOverlay(input: OverlayInput): void {
  const prof =
    typeof window !== 'undefined' &&
    (window as unknown as { __GNZ_PROFILE_RENDER__?: boolean }).__GNZ_PROFILE_RENDER__;
  if (prof) {
    try {
      performance.mark('gnz-remaster-start');
    } catch {
      /* ignore */
    }
  }
  const startMs = performance.now();
  const tier = input.graphics.quality;
  const budget = VISUAL_BUDGETS[tier];
  const qualityScale = effectiveFrameQualityScale(input.graphics);
  const W = input.canvas.clientWidth || input.canvas.width;
  const H = input.canvas.clientHeight || input.canvas.height;
  const mapH = input.state.tiles.length;
  const mapW = input.state.tiles[0]?.length ?? 0;
  if (!mapW || !mapH) return;
  const pad = Math.max(2, Math.round(budget.renderDistancePadding * qualityScale));
  const bounds = visibleTileBounds(
    input.camera.x,
    input.camera.y,
    input.camera.zoom,
    W,
    H,
    mapW,
    mapH,
    pad
  );

  const z = input.camera.zoom;
  const approxVisibleTiles = (bounds.endQ - bounds.startQ + 1) * (bounds.endR - bounds.startR + 1);
  currentMapLod = computeMapLodSnapshot(z, input.graphics.mapDetail, approxVisibleTiles, qualityScale);
  const lod = currentMapLod;

  input.ctx.save();
  drawReferenceBackdrop(input, W, H);
  if (lod.showCloudsShadows) {
    drawReferenceCloudBanks(input, W, H);
    drawReferenceIslandShadow(input, bounds.startQ, bounds.startR, bounds.endQ, bounds.endR);
  }
  drawReferenceHexWalls(input, bounds.startQ, bounds.startR, bounds.endQ, bounds.endR);
  drawTerrainBasePass(input, bounds.startQ, bounds.startR, bounds.endQ, bounds.endR);
  drawEnvironmentAndResourcesPass(input, bounds.startQ, bounds.startR, bounds.endQ, bounds.endR);
  drawSelectionPass(input);
  if (lod.showReliefShading) {
    drawPseudoReliefPass(input, bounds.startQ, bounds.startR, bounds.endQ, bounds.endR);
  }
  drawRoadAndRiverPass(input);
  drawFogAndVisibilityPass(input, bounds.startQ, bounds.startR, bounds.endQ, bounds.endR);
  drawTerritoryPass(input, bounds.startQ, bounds.startR, bounds.endQ, bounds.endR);
  drawCityOverlayPass(input);
  drawUnitOverlayPass(input);
  if (lod.showDisasterScreenFx) {
    drawDisasterFx(input);
  }
  drawInfoOverlays(input);
  const fxCap = Math.max(6, Math.floor(budget.maxParticles * lod.particleDensity));
  runVisualFxPipeline(input.ctx, input.state, input.time, input.camera, {
    maxParticles: fxCap,
    qualityScale,
  }, input.localViewerCivIndex);

  // Budget-aware screen grade (reuse gradient object when H and alpha unchanged)
  const alpha = budget.maxScreenFxAlpha * qualityScale;
  const alphaKey = alpha.toFixed(5);
  let g: CanvasGradient;
  if (screenGradeGradCache && screenGradeGradCache.h === H && screenGradeGradCache.alphaKey === alphaKey) {
    g = screenGradeGradCache.gradient;
  } else {
    g = input.ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(255, 220, 160, ${alpha * 0.5})`);
    g.addColorStop(1, `rgba(90, 130, 190, ${alpha * 0.55})`);
    screenGradeGradCache = { h: H, alphaKey, gradient: g };
  }
  input.ctx.save();
  input.ctx.fillStyle = g;
  input.ctx.fillRect(0, 0, W, H);
  input.ctx.restore();
  input.ctx.restore();

  pushFrameTimeSample(performance.now() - startMs);
  if (prof) {
    try {
      performance.mark('gnz-remaster-end');
      performance.measure('gnz-remaster', 'gnz-remaster-start', 'gnz-remaster-end');
      performance.clearMarks('gnz-remaster-start');
      performance.clearMarks('gnz-remaster-end');
      performance.clearMeasures('gnz-remaster');
    } catch {
      /* ignore */
    }
  }
  currentMapLod = null;
}

