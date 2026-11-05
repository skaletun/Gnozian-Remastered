import { memo, useId } from 'react';
import clsx from 'clsx';

export type CivEmblemProps = {
  primary: string;
  secondary: string;
  /** Picks charge geometry (template index or civ slot). */
  variant?: number;
  /** Pixel size (width & height). */
  size?: number;
  className?: string;
  title?: string;
};

function Charge({ secondary, v }: { secondary: string; v: number }) {
  const k = ((v % 8) + 8) % 8;
  switch (k) {
    case 0:
      return <circle cx="16" cy="15" r="4.5" fill={secondary} opacity={0.92} />;
    case 1:
      return <path d="M16 9 L21 20 H11 Z" fill={secondary} opacity={0.88} />;
    case 2:
      return <rect x="10" y="11" width="12" height="7" rx="1.2" fill={secondary} opacity={0.88} />;
    case 3:
      return (
        <path
          d="M16 9v12M10 15h12"
          stroke={secondary}
          strokeWidth={2.4}
          opacity={0.92}
          strokeLinecap="round"
        />
      );
    case 4:
      return <circle cx="16" cy="15" r="5.2" fill="none" stroke={secondary} strokeWidth={2.2} opacity={0.95} />;
    case 5:
      return (
        <path
          d="M11 15h10M16 10v10"
          stroke={secondary}
          strokeWidth={2.2}
          opacity={0.9}
          strokeLinecap="round"
        />
      );
    case 6:
      return <path d="M16 10c3.2 2 4.2 5 4 8H12c0-3 1-6 4-8z" fill={secondary} opacity={0.88} />;
    default:
      return (
        <path
          d="M10 12h12M10 18h8"
          stroke={secondary}
          strokeWidth={2}
          opacity={0.88}
          strokeLinecap="round"
        />
      );
  }
}

/** Circular heraldic emblem (gradient + charge) — replaces flat color dots in menus and HUD. */
export const CivEmblem = memo(function CivEmblem({
  primary,
  secondary,
  variant = 0,
  size = 16,
  className,
  title,
}: CivEmblemProps) {
  const uid = useId().replace(/:/g, '');
  const gid = `ce-g-${uid}`;
  const v = ((variant % 32) + 32) % 32;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={clsx('shrink-0', className)}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gid} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="45%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#${gid})`} stroke="rgba(0,0,0,0.42)" strokeWidth="1" />
      <Charge secondary={secondary} v={v} />
    </svg>
  );
});
