import type { GameState } from './types';
import type { GraphicsSettings } from './settingsConstants';
import { DEFAULT_GRAPHICS } from './settingsConstants';
import { gridToScreen, screenToGrid, type CameraState } from './hexMetrics';
import { RenderFacade } from './renderFacade';

/**
 * Canvas-2D map view: owns the backing store, HiDPI scaling, and pan / pick / clamp helpers
 * for `GameCanvas`. Renders through `RenderFacade` (visual remaster overlay).
 */
export class MapRenderer {
  private canvas: HTMLCanvasElement;
  private state: GameState | null = null;
  private currentGfx: GraphicsSettings | undefined;
  private localViewer = 0;
  private lastCamera: CameraState | null = null;
  private hovered: { q: number; r: number } | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private renderScale = 1;
  private renderFacade = new RenderFacade();
  private ctx2d: CanvasRenderingContext2D | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  dispose(): void {
    this.ctx2d = null;
  }

  /** w/h are CSS pixels; backing store is scaled by `devicePixelRatio` for crisp HiDPI. */
  resize(w: number, h: number): void {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.cssWidth = w;
    this.cssHeight = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr * this.renderScale));
    this.canvas.height = Math.max(1, Math.round(h * dpr * this.renderScale));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx2d = this.canvas.getContext('2d');
  }

  /** CSS-pixel size of the drawing surface. */
  getViewportSize(): { width: number; height: number } {
    return { width: this.cssWidth, height: this.cssHeight };
  }

  sync(state: GameState, gfx?: GraphicsSettings, civIdx = 0): void {
    this.state = state;
    this.currentGfx = gfx;
    this.localViewer = civIdx;
    const nextScale = Math.max(0.5, Math.min(1.5, gfx?.renderScale ?? 1));
    if (Math.abs(nextScale - this.renderScale) > 0.001) {
      this.renderScale = nextScale;
      if (this.cssWidth > 0 && this.cssHeight > 0) this.resize(this.cssWidth, this.cssHeight);
    }
  }

  setHoveredTile(t: { q: number; r: number } | null): void {
    this.hovered = t;
  }

  render(camera?: CameraState | null): void {
    if (!this.state) return;
    const cam = camera ?? (this.state.camera as CameraState);
    this.lastCamera = cam;
    try {
      const ctx = this.ctx2d ?? this.canvas.getContext('2d');
      if (!ctx) return;
      if (!this.ctx2d) this.ctx2d = ctx;
      // Reset transform and apply HiDPI scale so drawing uses CSS px coordinates.
      ctx.setTransform(this.dpr * this.renderScale, 0, 0, this.dpr * this.renderScale, 0, 0);
      this.renderFacade.render({
        canvas: this.canvas,
        state: this.state,
        hoveredTile: this.hovered,
        time: performance.now(),
        graphics: this.currentGfx ?? DEFAULT_GRAPHICS,
        cameraOverride: cam,
        ctx,
        localViewerCivIndex: this.localViewer,
      });
    } catch (e) {
      // Swallow render errors so a single bad frame doesn't take down the UI.
      console.error('Map render failed', e);
    }
  }

  /**
   * Convert client (window) pixel coordinates to a tile coordinate.
   * Accounts for canvas position via `getBoundingClientRect()` and uses
   * CSS-pixel coordinates (DPR is handled by the render transform).
   */
  pickTile(cx: number, cy: number): { q: number; r: number } | null {
    if (!this.state) return null;
    const rect = this.canvas.getBoundingClientRect();
    const sx = cx - rect.left;
    const sy = cy - rect.top;
    const cam = this.lastCamera ?? (this.state.camera as CameraState);
    const { q, r } = screenToGrid(sx, sy, cam.x, cam.y, cam.zoom);
    const H = this.state.tiles.length;
    const W = this.state.tiles[0]?.length ?? 0;
    if (r < 0 || r >= H || q < 0 || q >= W) return null;
    return { q, r };
  }

  panByScreenDelta(dx: number, dy: number, cam: CameraState): CameraState {
    return { ...cam, x: cam.x - dx, y: cam.y - dy };
  }

  clampCamera(cam: CameraState): CameraState {
    if (!this.state) return cam;
    const H = this.state.tiles.length;
    const W = this.state.tiles[0]?.length ?? 0;
    const corners = [
      gridToScreen(0, 0, cam.zoom),
      gridToScreen(Math.max(0, W - 1), 0, cam.zoom),
      gridToScreen(0, Math.max(0, H - 1), cam.zoom),
      gridToScreen(Math.max(0, W - 1), Math.max(0, H - 1), cam.zoom),
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of corners) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    }
    if (!Number.isFinite(minX)) return cam;
    const viewportW = Math.max(1, this.cssWidth || 1);
    const viewportH = Math.max(1, this.cssHeight || 1);
    const minCamX = minX - viewportW * 0.5;
    const maxCamX = maxX - viewportW * 0.5;
    const minCamY = minY - viewportH * 0.5;
    const maxCamY = maxY - viewportH * 0.5;
    const outX = Math.max(Math.min(minCamX, maxCamX), Math.min(Math.max(minCamX, maxCamX), cam.x));
    const outY = Math.max(Math.min(minCamY, maxCamY), Math.min(Math.max(minCamY, maxCamY), cam.y));
    return { ...cam, x: outX, y: outY };
  }
}

export default MapRenderer;
