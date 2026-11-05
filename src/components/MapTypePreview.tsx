import { useEffect, useMemo, useRef } from 'react';
import type { GameSettings, TerrainType } from '../game/types';
import { TERRAIN_COLORS } from '../game/constants';
import { generateMap } from '../game/mapgen';

type Props = {
  mapType: GameSettings['mapType'];
  seed: number;
  /** When set, preview paints this terrain instead of procedural generation. */
  terrain?: TerrainType[][] | null;
  /** Match preview aspect ratio to the configured map size (procedural only). */
  mapWidth?: number;
  mapHeight?: number;
  className?: string;
  /** CSS px — bounding box for the preview canvas (aspect preserved). */
  boxMaxWidth?: number;
  boxMaxHeight?: number;
};

const DEFAULT_BOX_W = 280;
const DEFAULT_BOX_H = 190;

/** Terrain thumbnail for new-game / lobby: aspect-aware, sharp on HiDPI. */
export default function MapTypePreview({
  mapType,
  seed,
  terrain,
  mapWidth = 40,
  mapHeight = 30,
  className,
  boxMaxWidth = DEFAULT_BOX_W,
  boxMaxHeight = DEFAULT_BOX_H,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const layout = useMemo(() => {
    const maxEdge = 54;
    const clampAspect = (w: number, h: number) => {
      const raw = w / Math.max(1, h);
      return Math.max(0.2, Math.min(5, raw));
    };

    if (terrain?.length && terrain[0]?.length) {
      const W = terrain[0].length;
      const H = terrain.length;
      const aspect = clampAspect(W, H);
      let cssW = boxMaxWidth;
      let cssH = Math.round(cssW / aspect);
      if (cssH > boxMaxHeight) {
        cssH = boxMaxHeight;
        cssW = Math.round(cssH * aspect);
      }
      let outW = maxEdge;
      let outH = Math.round(maxEdge / aspect);
      if (outH > maxEdge) {
        outH = maxEdge;
        outW = Math.round(maxEdge * aspect);
      }
      outW = Math.max(12, Math.min(maxEdge, outW));
      outH = Math.max(12, Math.min(maxEdge, outH));
      return { mode: 'terrain' as const, cssW, cssH, outW, outH, W, H };
    }

    const aspect = clampAspect(mapWidth, mapHeight);
    let cssW = boxMaxWidth;
    let cssH = Math.round(cssW / aspect);
    if (cssH > boxMaxHeight) {
      cssH = boxMaxHeight;
      cssW = Math.round(cssH * aspect);
    }

    let outW = maxEdge;
    let outH = Math.round(maxEdge / aspect);
    if (outH > maxEdge) {
      outH = maxEdge;
      outW = Math.round(maxEdge * aspect);
    }
    outW = Math.max(14, Math.min(maxEdge, outW));
    outH = Math.max(14, Math.min(maxEdge, outH));

    return { mode: 'procedural' as const, cssW, cssH, outW, outH };
  }, [terrain, mapWidth, mapHeight, boxMaxWidth, boxMaxHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    const run = () => {
      try {
        const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
        const { cssW, cssH } = layout;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        const cw = cssW / layout.outW;
        const ch = cssH / layout.outH;

        if (layout.mode === 'terrain') {
          const { W, H, outW, outH } = layout;
          for (let rr = 0; rr < outH; rr++) {
            const tr = Math.min(H - 1, Math.floor(((rr + 0.5) * H) / outH));
            const row = terrain![tr];
            if (!row) continue;
            for (let cc = 0; cc < outW; cc++) {
              const tc = Math.min(W - 1, Math.floor(((cc + 0.5) * W) / outW));
              const cell = row[tc];
              ctx.fillStyle = cell ? TERRAIN_COLORS[cell] : '#1a1a24';
              ctx.fillRect(cc * cw, rr * ch, cw + 0.5, ch + 0.5);
            }
          }
          return;
        }

        const tiles = generateMap(layout.outW, layout.outH, seed, mapType);
        if (cancelled) return;
        for (let r = 0; r < tiles.length; r++) {
          const row = tiles[r];
          if (!row) continue;
          for (let q = 0; q < row.length; q++) {
            const t = row[q];
            ctx.fillStyle = TERRAIN_COLORS[t.terrain];
            ctx.fillRect(q * cw, r * ch, cw + 0.5, ch + 0.5);
          }
        }
      } catch {
        if (!cancelled && canvasRef.current) {
          const c2 = canvasRef.current.getContext('2d');
          if (c2) {
            c2.setTransform(1, 0, 0, 1, 0, 0);
            c2.fillStyle = '#1a1a24';
            c2.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      }
    };

    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (typeof requestIdleCallback !== 'undefined') {
      idleHandle = requestIdleCallback(() => run(), { timeout: 400 });
    } else {
      timeoutHandle = setTimeout(run, 0);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, [layout, mapType, seed, terrain]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="rounded-lg border border-amber-800/45 bg-black/65 shadow-inner"
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          maxWidth: '100%',
          height: 'auto',
        }}
      />
    </div>
  );
}
