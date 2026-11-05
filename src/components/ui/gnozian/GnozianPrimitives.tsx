/**
 * SVG UI primitives matching gnozian-ico.svg: parchment, bronze double frames,
 * metallic gold gradients, compass flourishes, hex map tiles, victory medallions.
 */
import { memo, useId } from 'react';
import type { VictoryType } from '../../../game/types';

export const GNOZIAN = {
  goldHi: '#fff6d4',
  gold: '#e8c060',
  goldMid: '#c9a227',
  goldDeep: '#8b6914',
  bronze: '#5c3d1a',
  bronzeDark: '#3d2914',
  parchment: '#f0e4c8',
  parchmentDeep: '#d4c4a4',
  ink: '#2a1f12',
} as const;

function useSvgIds() {
  const raw = useId().replace(/:/g, '');
  return {
    goldLin: `gz_${raw}_goldLin`,
    goldLin2: `gz_${raw}_goldLin2`,
    parchmentRad: `gz_${raw}_parch`,
    shadow: `gz_${raw}_sh`,
    innerGlow: `gz_${raw}_glow`,
  };
}

/** Shared defs: gold metal, parchment well, soft shadow. */
export const GnozianSharedDefs = memo(function GnozianSharedDefs() {
  const id = useSvgIds();
  return (
    <defs>
      <linearGradient id={id.goldLin} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={GNOZIAN.goldHi} />
        <stop offset="35%" stopColor={GNOZIAN.gold} />
        <stop offset="70%" stopColor={GNOZIAN.goldMid} />
        <stop offset="100%" stopColor={GNOZIAN.goldDeep} />
      </linearGradient>
      <linearGradient id={id.goldLin2} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={GNOZIAN.goldHi} />
        <stop offset="50%" stopColor={GNOZIAN.goldMid} />
        <stop offset="100%" stopColor={GNOZIAN.bronze} />
      </linearGradient>
      <radialGradient id={id.parchmentRad} cx="40%" cy="35%" r="75%">
        <stop offset="0%" stopColor={GNOZIAN.parchment} />
        <stop offset="55%" stopColor={GNOZIAN.parchmentDeep} />
        <stop offset="100%" stopColor="#b8a684" />
      </radialGradient>
      <filter id={id.shadow} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.45" />
      </filter>
      <filter id={id.innerGlow} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
});

/** Corner flourish (compass / baroque point). Place in corner; rotation via className. */
export const GnozianCompassCorner = memo(function GnozianCompassCorner({
  className,
  size = 56,
}: {
  className?: string;
  size?: number;
}) {
  const id = useSvgIds();
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden
    >
      <defs>
        <linearGradient id={id.goldLin} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={GNOZIAN.goldHi} />
          <stop offset="45%" stopColor={GNOZIAN.gold} />
          <stop offset="100%" stopColor={GNOZIAN.bronze} />
        </linearGradient>
        <filter id={id.shadow} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <path
        fill={`url(#${id.goldLin})`}
        stroke={GNOZIAN.bronzeDark}
        strokeWidth={0.6}
        filter={`url(#${id.shadow})`}
        d="M0 0 L8 10 L6 22 L18 20 L22 32 L32 22 L44 26 L40 14 L52 8 L40 4 L44 0 L28 6 L18 0 L14 8 Z"
        transform="translate(0,0)"
      />
      <path
        fill={GNOZIAN.goldDeep}
        opacity={0.85}
        d="M14 12 L20 18 L18 24 L12 20 Z"
      />
    </svg>
  );
});

/** Flat-top hex with parchment fill and bronze/gold rim (map tile accent). */
export const GnozianHexTile = memo(function GnozianHexTile({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  const id = useSvgIds();
  const pts = '0,-22 19,-11 19,11 0,22 -19,11 -19,-11';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="-24 -26 48 52"
      aria-hidden
    >
      <defs>
        <linearGradient id={id.goldLin} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={GNOZIAN.goldHi} />
          <stop offset="100%" stopColor={GNOZIAN.goldDeep} />
        </linearGradient>
        <radialGradient id={id.parchmentRad} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f8f0dc" />
          <stop offset="100%" stopColor="#c9b896" />
        </radialGradient>
        <filter id={id.shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.35" />
        </filter>
      </defs>
      <polygon
        points={pts}
        fill={`url(#${id.parchmentRad})`}
        stroke={`url(#${id.goldLin})`}
        strokeWidth={2.5}
        filter={`url(#${id.shadow})`}
      />
      <polygon points={pts} fill="none" stroke={GNOZIAN.bronzeDark} strokeWidth={0.8} opacity={0.6} />
    </svg>
  );
});

const INNER: Record<VictoryType, { fill: string; stroke: string }> = {
  science: { fill: '#1a4a7a', stroke: '#7ec8ff' },
  culture: { fill: '#4a2a6e', stroke: '#d4a5ff' },
  domination: { fill: '#6e1a1a', stroke: '#ff9a7a' },
  diplomacy: { fill: '#1a5c3a', stroke: '#8ef0b0' },
  time: { fill: '#5c4510', stroke: '#ffd78a' },
  religion: { fill: '#0d4a4a', stroke: '#7ef0e8' },
};

function SymbolScience() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-2 -10 L-2 6 L4 10 L4 -6 Z" fill="currentColor" stroke="none" opacity={0.35} />
      <path d="M-2 -10 L-2 6 L4 10 L4 -6 Z" />
      <circle cx="-2" cy="-12" r="3" />
      <path d="M-6 12 Q0 16 6 12" opacity={0.9} />
    </g>
  );
}

function SymbolCulture() {
  return (
    <g fill="currentColor" stroke={GNOZIAN.ink} strokeWidth="0.5">
      <ellipse cx="-6" cy="-2" rx="7" ry="9" opacity={0.9} />
      <ellipse cx="7" cy="1" rx="6" ry="8" opacity={0.65} />
      <path d="M-10 6 Q0 12 12 5" fill="none" strokeWidth="1.5" />
    </g>
  );
}

function SymbolDomination() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M0 -14 L0 12" />
      <path d="M-10 2 L10 2" />
      <path d="M-6 -8 L6 -8" />
    </g>
  );
}

function SymbolDiplomacy() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="0" cy="0" r="11" />
      <ellipse cx="0" cy="0" rx="4" ry="11" />
      <path d="M-11 0 H11" />
    </g>
  );
}

function SymbolTime() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="0" cy="0" r="12" />
      <path d="M0 -2 L0 -9" />
      <path d="M0 2 L8 6" />
    </g>
  );
}

function SymbolReligion() {
  return (
    <g fill="currentColor" stroke={GNOZIAN.ink} strokeWidth="0.4">
      <path d="M-10 8 L-10 -4 L0 -14 L10 -4 L10 8 L0 4 Z" opacity={0.95} />
      <rect x="-2" y="-16" width="4" height="6" rx="1" />
    </g>
  );
}

/** Circular victory / feature medallion like the promo art. */
export const GnozianVictoryMedallion = memo(function GnozianVictoryMedallion({
  type,
  size = 72,
  className,
}: {
  type: VictoryType;
  size?: number;
  className?: string;
}) {
  const id = useSvgIds();
  const inner = INNER[type];
  const Symbol =
    type === 'science'
      ? SymbolScience
      : type === 'culture'
        ? SymbolCulture
        : type === 'domination'
          ? SymbolDomination
          : type === 'diplomacy'
            ? SymbolDiplomacy
            : type === 'time'
              ? SymbolTime
              : SymbolReligion;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="-36 -36 72 72"
      aria-hidden
    >
      <defs>
        <linearGradient id={id.goldLin} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={GNOZIAN.goldHi} />
          <stop offset="40%" stopColor={GNOZIAN.gold} />
          <stop offset="100%" stopColor={GNOZIAN.bronze} />
        </linearGradient>
        <linearGradient id={id.goldLin2} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={GNOZIAN.goldHi} />
          <stop offset="100%" stopColor={GNOZIAN.goldDeep} />
        </linearGradient>
        <radialGradient id={id.parchmentRad} cx="30%" cy="25%" r="85%">
          <stop offset="0%" stopColor={inner.stroke} stopOpacity={0.35} />
          <stop offset="45%" stopColor={inner.fill} />
          <stop offset="100%" stopColor="#0a0a12" />
        </radialGradient>
        <filter id={id.shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.5" />
        </filter>
      </defs>
      <circle r="33" fill={`url(#${id.goldLin2})`} filter={`url(#${id.shadow})`} />
      <circle r="30.5" fill="none" stroke={GNOZIAN.bronzeDark} strokeWidth={1} />
      <circle r="27" fill={`url(#${id.goldLin})`} />
      <circle r="23" fill={`url(#${id.parchmentRad})`} stroke={inner.stroke} strokeWidth={0.75} opacity={0.98} />
      <g color={inner.stroke} transform="scale(0.95)">
        <Symbol />
      </g>
    </svg>
  );
});

/** Small emblem: hex + inner glyph for menu flanks. */
export const GnozianMenuFlank = memo(function GnozianMenuFlank({
  variant,
  size = 52,
  className,
}: {
  variant: 'globe' | 'blade';
  size?: number;
  className?: string;
}) {
  const id = useSvgIds();
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="-28 -30 56 60"
      aria-hidden
    >
      <defs>
        <linearGradient id={id.goldLin} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={GNOZIAN.goldHi} />
          <stop offset="100%" stopColor={GNOZIAN.goldDeep} />
        </linearGradient>
        <radialGradient id={id.parchmentRad} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#e8f4dc" />
          <stop offset="100%" stopColor="#6a8c50" />
        </radialGradient>
        <filter id={id.shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.4" />
        </filter>
      </defs>
      <polygon
        points="0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12"
        fill={`url(#${id.parchmentRad})`}
        stroke={`url(#${id.goldLin})`}
        strokeWidth={2.2}
        filter={`url(#${id.shadow})`}
      />
      <polygon
        points="0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12"
        fill="none"
        stroke={GNOZIAN.bronzeDark}
        strokeWidth={0.7}
        opacity={0.55}
      />
      {variant === 'globe' ? (
        <g fill="none" stroke="#1a3a5c" strokeWidth="1.6">
          <circle cx="0" cy="0" r="10" />
          <ellipse cx="0" cy="0" rx="3.5" ry="10" />
          <path d="M-10 0 H10" />
        </g>
      ) : (
        <g fill="none" stroke="#5c1010" strokeWidth="2" strokeLinecap="round">
          <path d="M0 -12 L0 12" />
          <path d="M-8 4 L8 4" />
        </g>
      )}
    </svg>
  );
});

/** Four compass corners around a panel (pointer-events none). */
export const GnozianPanelCorners = memo(function GnozianPanelCorners({
  className,
  inset = 6,
  size = 44,
}: {
  className?: string;
  inset?: number;
  size?: number;
}) {
  const pos = { top: inset, left: inset, right: inset, bottom: inset } as const;
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-visible ${className ?? ''}`}
      aria-hidden
    >
      <div className="absolute" style={{ top: pos.top, left: pos.left }}>
        <GnozianCompassCorner size={size} />
      </div>
      <div className="absolute" style={{ top: pos.top, right: pos.right }}>
        <GnozianCompassCorner size={size} className="scale-x-[-1]" />
      </div>
      <div className="absolute" style={{ bottom: pos.bottom, left: pos.left }}>
        <GnozianCompassCorner size={size} className="scale-y-[-1]" />
      </div>
      <div className="absolute" style={{ bottom: pos.bottom, right: pos.right }}>
        <GnozianCompassCorner size={size} className="scale-[-1]" />
      </div>
    </div>
  );
});

/** Double-rule horizontal divider with gold accent (parchment map frame). */
export const GnozianDivider = memo(function GnozianDivider({ className }: { className?: string }) {
  const id = useSvgIds();
  return (
    <svg className={className} width="100%" height={10} viewBox="0 0 400 10" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id.goldLin} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={GNOZIAN.bronze} />
          <stop offset="20%" stopColor={GNOZIAN.gold} />
          <stop offset="50%" stopColor={GNOZIAN.goldHi} />
          <stop offset="80%" stopColor={GNOZIAN.gold} />
          <stop offset="100%" stopColor={GNOZIAN.bronze} />
        </linearGradient>
      </defs>
      <rect x="0" y="1" width="400" height="1.5" fill={GNOZIAN.bronzeDark} opacity={0.85} />
      <rect x="0" y="4" width="400" height="2" fill={`url(#${id.goldLin})`} opacity={0.95} />
      <rect x="0" y="7.5" width="400" height="1.2" fill={GNOZIAN.bronzeDark} opacity={0.75} />
    </svg>
  );
});
