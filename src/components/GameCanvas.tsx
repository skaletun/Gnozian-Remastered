import type { MouseEvent, WheelEvent } from 'react';
import { useRef, useEffect, useCallback } from 'react';
import type { GameState } from '../game/types';
import type { GraphicsSettings } from '../game/settingsConstants';
import type { CameraState } from '../game/hexMetrics';
import { MapRenderer } from '../game/mapRenderer';

interface Props {
  gameState: GameState;
  /** Smooth pan/zoom; merged into render without copying whole state each frame. */
  liveCamera?: CameraState;
  onTileClick: (q: number, r: number, mods?: { altKey?: boolean; shiftKey?: boolean }) => void;
  /** Right-click on map without panning: clear selection. */
  onClearSelection?: () => void;
  onCameraChange: (cam: CameraState) => void;
  graphics?: GraphicsSettings;
  cameraControls?: {
    sensitivity: number;
    sensitivityX: number;
    sensitivityY: number;
    zoomSensitivity: number;
    invertX: boolean;
    invertY: boolean;
  };
  /** Report canvas pixel size for minimap / UI (ResizeObserver). */
  onViewportSize?: (width: number, height: number) => void;
  /** Fog of war and selection for this civilization slot. */
  localViewerCivIndex?: number;
  /** Increased by caller on each unit interaction to force redraw/cache refresh. */
  interactionTick?: number;
}

export default function GameCanvas({
  gameState,
  liveCamera,
  onTileClick,
  onClearSelection,
  onCameraChange,
  graphics,
  cameraControls,
  onViewportSize,
  localViewerCivIndex = 0,
  interactionTick = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const hoveredTileRef = useRef<{ q: number; r: number } | null>(null);
  const isDragging = useRef(false);
  const dragModeRef = useRef<'pan' | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragAccum = useRef(0);
  const cameraRef = useRef(gameState.camera);
  const renderCameraRef = useRef<CameraState>({ ...gameState.camera });
  const hasInitializedCameraRef = useRef(false);
  const lastFrameTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef(gameState);
  const liveCameraRef = useRef(liveCamera ?? gameState.camera);
  const localViewerRef = useRef(localViewerCivIndex);
  const controlsRef = useRef(cameraControls);
  const pendingHoverPickRef = useRef<{ x: number; y: number } | null>(null);
  const hoverPickRafRef = useRef(0);
  gameStateRef.current = gameState;
  liveCameraRef.current = liveCamera ?? gameState.camera;
  localViewerRef.current = localViewerCivIndex;
  controlsRef.current = cameraControls;

  useEffect(() => {
    const cam = liveCamera ?? gameState.camera;
    const renderer = rendererRef.current;
    const clamped = renderer ? renderer.clampCamera(cam) : cam;
    const prevRender = renderCameraRef.current;
    cameraRef.current = clamped;
    liveCameraRef.current = clamped;
    // Keep interpolation continuity on frequent external camera sync updates.
    // Hard-snap only on first mount or on large teleports (e.g. recenter/load).
    const jump =
      Math.abs(prevRender.x - clamped.x) > 220 ||
      Math.abs(prevRender.y - clamped.y) > 220 ||
      Math.abs(prevRender.zoom - clamped.zoom) > 0.45;
    if (!hasInitializedCameraRef.current || jump) {
      renderCameraRef.current = { ...clamped };
      hasInitializedCameraRef.current = true;
    }
  }, [gameState.camera, liveCamera]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (hoverPickRafRef.current) cancelAnimationFrame(hoverPickRafRef.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Render loop: use ref for state so we do not reset RAF on every game tick
  const graphicsRef = useRef(graphics);
  graphicsRef.current = graphics;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
      const cssH = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
      if (!rendererRef.current) rendererRef.current = new MapRenderer(canvas);
      rendererRef.current.resize(cssW, cssH);
      onViewportSize?.(cssW, cssH);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const loop = (t: number) => {
      if (document.hidden) {
        lastFrameTimeRef.current = null;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.sync(gameStateRef.current, graphicsRef.current, localViewerRef.current);
        renderer.setHoveredTile(hoveredTileRef.current);
        // Smoothly interpolate render camera toward target camera when enabled
        const target = cameraRef.current;
        const smooth = graphicsRef.current?.smoothCamera ?? false;
        const rc = renderCameraRef.current;
        if (!smooth) {
          rc.x = target.x;
          rc.y = target.y;
          rc.zoom = target.zoom;
          if (target.rotation !== undefined) rc.rotation = target.rotation;
        } else {
          const prevT = lastFrameTimeRef.current;
          const dtMs = prevT == null ? 16.67 : Math.max(1, Math.min(50, t - prevT));
          // Frame-rate independent smoothing so camera feel stays stable at 30/60/120 fps.
          const alpha = 1 - Math.exp(-dtMs / 42);
          const nextX = rc.x + (target.x - rc.x) * alpha;
          const nextY = rc.y + (target.y - rc.y) * alpha;
          const nextZoom = rc.zoom + (target.zoom - rc.zoom) * alpha;
          const closeEnough =
            Math.abs(target.x - nextX) < 0.02 &&
            Math.abs(target.y - nextY) < 0.02 &&
            Math.abs(target.zoom - nextZoom) < 0.0005;
          rc.x = closeEnough ? target.x : nextX;
          rc.y = closeEnough ? target.y : nextY;
          rc.zoom = closeEnough ? target.zoom : nextZoom;
          if (target.rotation !== undefined) {
            rc.rotation = closeEnough ? target.rotation : rc.rotation;
          }
        }
        renderer.render(renderCameraRef.current);
      }
      lastFrameTimeRef.current = t;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [onViewportSize]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.sync(gameStateRef.current, graphicsRef.current, localViewerRef.current);
      // Keep immediate refresh on the same smoothed camera path to avoid visible snaps.
      renderer.render(renderCameraRef.current);
    }
  }, [interactionTick]);

  // Ensure map updates immediately when `gameState` changes (e.g., after an action).
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.sync(gameState, graphicsRef.current, localViewerRef.current);
    // Render once immediately, but preserve smoothing continuity.
    renderer.render(renderCameraRef.current);
  }, [gameState]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      dragAccum.current += Math.abs(dx) + Math.abs(dy);
      dragStart.current = { x: e.clientX, y: e.clientY };
      const controls = controlsRef.current;
      const sens = controls?.sensitivity ?? 1;
      const sx = controls?.sensitivityX ?? 1;
      const sy = controls?.sensitivityY ?? 1;
      const invX = controls?.invertX ? -1 : 1;
      const invY = controls?.invertY ? -1 : 1;
      const next = renderer.clampCamera(
        renderer.panByScreenDelta(dx * sens * sx * invX, dy * sens * sy * invY, cameraRef.current)
      );
      cameraRef.current = next;
      liveCameraRef.current = next;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => onCameraChange(liveCameraRef.current), 24);
    } else {
      pendingHoverPickRef.current = { x: e.clientX, y: e.clientY };
      if (!hoverPickRafRef.current) {
        hoverPickRafRef.current = requestAnimationFrame(() => {
          hoverPickRafRef.current = 0;
          const p = pendingHoverPickRef.current;
          pendingHoverPickRef.current = null;
          if (!p || isDragging.current) return;
          const r = rendererRef.current;
          if (!r) return;
          const coords = r.pickTile(p.x, p.y);
          if (coords) {
            const { q, r: rr } = coords;
            const tiles = gameStateRef.current.tiles;
            if (q >= 0 && rr >= 0 && rr < tiles.length && q < (tiles[0]?.length ?? 0)) {
              hoveredTileRef.current = { q, r: rr };
            } else {
              hoveredTileRef.current = null;
            }
          } else {
            hoveredTileRef.current = null;
          }
        });
      }
    }
  }, [onCameraChange]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 2) {
      isDragging.current = true;
      dragModeRef.current = 'pan';
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragAccum.current = 0;
      return;
    }
    if (e.button === 1) {
      // Middle-click also starts pan (no orbit/look-around in 2.5D)
      e.preventDefault();
      isDragging.current = true;
      dragModeRef.current = 'pan';
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragAccum.current = 0;
    }
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 2) {
      const wasDrag = isDragging.current;
      isDragging.current = false;
      dragModeRef.current = null;
      if (wasDrag && dragAccum.current < 10) {
        onClearSelection?.();
      } else if (!wasDrag) {
        onClearSelection?.();
      }
      dragAccum.current = 0;
      return;
    }
    if (isDragging.current) {
      isDragging.current = false;
      dragModeRef.current = null;
      dragAccum.current = 0;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      onCameraChange(cameraRef.current);
      return;
    }
    if (e.button === 0) {
      const coords = rendererRef.current?.pickTile(e.clientX, e.clientY) ?? null;
      if (coords) {
        const { q, r } = coords;
        const tiles = gameStateRef.current.tiles;
        if (q >= 0 && r >= 0 && r < tiles.length && q < (tiles[0]?.length ?? 0)) {
          onTileClick(q, r, { altKey: e.altKey, shiftKey: e.shiftKey });
        }
      }
    }
  }, [onTileClick, onClearSelection]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const zoomSensitivity = controlsRef.current?.zoomSensitivity ?? 1;
    const zoomStepOut = 1 + 0.08 * zoomSensitivity;
    const zoomStepIn = 1 - 0.08 * zoomSensitivity;
    // Fix direction: scrolling up (deltaY < 0) should zoom in (increase), down should zoom out.
    const nextZoom = Math.max(0.2, Math.min(4, cam.zoom * (e.deltaY < 0 ? zoomStepOut : zoomStepIn)));
    const renderer = rendererRef.current;
    // Anchor zoom to cursor position: keep world point under cursor fixed.
    const canvas = canvasRef.current;
    let nextCam = { ...cam, zoom: nextZoom } as typeof cam;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const scale = nextZoom / Math.max(0.0001, cam.zoom);
      nextCam = {
        ...nextCam,
        x: (cam.x + sx) * scale - sx,
        y: (cam.y + sy) * scale - sy,
      } as typeof cam;
    }
    const next = renderer ? renderer.clampCamera(nextCam) : nextCam;
    cameraRef.current = next;
    liveCameraRef.current = next;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => onCameraChange(next), 24);
  }, [onCameraChange]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;
    dragModeRef.current = null;
    hoveredTileRef.current = null;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    onCameraChange(cameraRef.current);
  }, [onCameraChange]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair block"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onMouseLeave={handleMouseLeave}
    />
  );
}
