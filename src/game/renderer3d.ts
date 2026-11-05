import type { GameState } from './types';
import type { GraphicsSettings } from './settingsConstants';
import { renderGame } from './renderer';
import { gridToScreen, screenToGrid } from './hexMetrics';

export type Camera3DState = {
  x: number; y: number; zoom: number;
  rotation?: number; yaw?: number; pitch?: number; distance?: number;
};

/**
 * Lightweight 2D shim that provides the former Renderer3D API but uses the
 * canvas 2D renderer (`renderGame`) under the hood. This keeps the rest of
 * the codebase unchanged while removing the `three` dependency.
 */
export class Renderer3D {
  private canvas: HTMLCanvasElement;
  private state: GameState | null = null;
  private currentGfx: GraphicsSettings | undefined;
  private localViewer = 0;
  private lastCamera: Camera3DState | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  dispose(): void {
    // No heavy resources to free for 2D renderer.
  }

  resize(w: number, h: number): void {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    this.canvas.width = w;
    this.canvas.height = h;
  }

  sync(state: GameState, gfx?: GraphicsSettings, civIdx = 0): void {
    this.state = state;
    this.currentGfx = gfx;
    this.localViewer = civIdx;
  }

  render(camera?: Camera3DState | null): void {
    if (!this.state) return;
    const cam = camera ?? (this.state.camera as Camera3DState);
    this.lastCamera = cam;
    try {
      renderGame(this.canvas, this.state, null, performance.now(), this.currentGfx, cam, undefined, this.localViewer);
    } catch (e) {
      // Swallow render errors to avoid breaking UI; caller may log if needed.
      // eslint-disable-next-line no-console
      console.error('2D render failed', e);
    }
  }

  pickTile(cx: number, cy: number): { q: number; r: number } | null {
    if (!this.state) return null;
    const rect = this.canvas.getBoundingClientRect();
    const sx = cx - rect.left;
    const sy = cy - rect.top;
    const cam = this.lastCamera ?? (this.state.camera as Camera3DState);
    const { q, r } = screenToGrid(sx, sy, cam.x, cam.y, cam.zoom);
    const H = this.state.tiles.length;
    const W = this.state.tiles[0]?.length ?? 0;
    if (r < 0 || r >= H || q < 0 || q >= W) return null;
    return { q, r };
  }

  panByScreenDelta(dx: number, dy: number, cam: Camera3DState): Camera3DState {
    // Simple 2D pan: move camera by screen delta.
    return { ...cam, x: cam.x - dx, y: cam.y - dy };
  }

  clampCamera(cam: Camera3DState): Camera3DState {
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
    const outX = Math.max(minX, Math.min(maxX, cam.x));
    const outY = Math.max(minY, Math.min(maxY, cam.y));
    return { ...cam, x: outX, y: outY };
  }
}

export default Renderer3D;
