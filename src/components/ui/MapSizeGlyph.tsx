import { memo, useMemo, type ReactNode } from 'react';
import clsx from 'clsx';

export type MapSizeGlyphProps = {
  mapWidth: number;
  mapHeight: number;
  className?: string;
};

/** Relative map footprint as a stylized grid inside a frame (SVG). */
export const MapSizeGlyph = memo(function MapSizeGlyph({ mapWidth, mapHeight, className }: MapSizeGlyphProps) {
  const { cols, rows } = useMemo(() => {
    const aspect = mapWidth / mapHeight;
    let cols = Math.round(11 * Math.sqrt(aspect * 1.05));
    let rows = Math.round(11 / Math.sqrt(aspect * 1.05));
    cols = Math.max(3, Math.min(17, cols));
    rows = Math.max(3, Math.min(17, rows));
    return { cols, rows };
  }, [mapWidth, mapHeight]);

  const cells = useMemo(() => {
    const out: ReactNode[] = [];
    const cw = 92 / cols;
    const ch = 92 / rows;
    const ox = 4;
    const oy = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const phase = (r * 13 + c * 7) % 5;
        const op = 0.1 + phase * 0.035;
        out.push(
          <rect
            key={`c-${r}-${c}`}
            x={ox + c * cw + cw * 0.08}
            y={oy + r * ch + ch * 0.08}
            width={cw * 0.84}
            height={ch * 0.84}
            rx={1.1}
            fill="currentColor"
            opacity={op}
          />
        );
      }
    }
    return out;
  }, [cols, rows]);

  return (
    <svg
      viewBox="0 0 100 100"
      className={clsx('shrink-0 text-amber-400/75', className)}
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        opacity={0.45}
      />
      {cells}
    </svg>
  );
});
