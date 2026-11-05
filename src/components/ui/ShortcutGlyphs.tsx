import clsx from 'clsx';

type SvgProps = { className?: string };

/** End turn — circular arrow */
export function SvgEndTurnGlyph({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('shrink-0', className)} fill="none" aria-hidden>
      <path
        d="M12 4v4M12 4a8 8 0 1 1-8 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity={0.9}
      />
      <path d="M8 8 L12 4 16 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M12 20v-4M12 20a8 8 0 1 0 8-8"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity={0.45}
      />
    </svg>
  );
}

export function SvgTechTreeGlyph({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('shrink-0', className)} fill="none" aria-hidden>
      <circle cx="12" cy="5" r="2.2" fill="currentColor" opacity={0.85} />
      <circle cx="6" cy="18" r="2.2" fill="currentColor" opacity={0.65} />
      <circle cx="18" cy="18" r="2.2" fill="currentColor" opacity={0.65} />
      <path d="M12 7.5v3M10 12H8M14 12h2M12 15v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 17l-1.5 1M15 17l1.5 1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

export function SvgDiplomacyGlyph({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('shrink-0', className)} fill="none" aria-hidden>
      <path
        d="M5 10c0-2 2.2-3.5 5-3.5S15 8 15 10v6c0 1-1 2-2.5 2H9.5C8 18 7 17 7 16v-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <path
        d="M9 10c0-2 2.2-3.5 5-3.5 2.8 0 5 1.5 5 3.5v5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity={0.55}
      />
    </svg>
  );
}

export function SvgEscapeGlyph({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('shrink-0', className)} fill="none" aria-hidden>
      <path
        d="M8 7h11M8 12h8M8 17h11"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        opacity={0.85}
      />
      <path d="M5 9 L3 12 5 15" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SvgMouseScrollGlyph({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('shrink-0', className)} fill="none" aria-hidden>
      <path
        d="M12 3c3.5 0 6 1.8 6 4.5v9C18 19.2 15.5 21 12 21s-6-1.8-6-4.5v-9C6 4.8 8.5 3 12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.9}
      />
      <path d="M12 7v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 8.5l2-1.5 2 1.5M10 15.5l2 1.5 2-1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity={0.75} />
    </svg>
  );
}

export function SvgMousePanGlyph({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('shrink-0', className)} fill="none" aria-hidden>
      <path
        d="M12 4c2.8 0 5 1.5 5 3.4v4.1c0 .8.6 1.5 1.3 1.5h.2c.8 0 1.5-.7 1.5-1.5V9.5"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <path d="M12 4v2M9 6l3-2 3 2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5 14h3v3H5zM10.5 14h3v3h-3zM16 14h3v3h-3z"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={0.65}
      />
      <path d="M6.5 17.5H4M18 17.5h2.5M12 19v2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity={0.55} />
    </svg>
  );
}
