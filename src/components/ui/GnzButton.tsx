import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { playUiClick } from '../../audio/AudioManager';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-amber-400 via-amber-700 to-slate-950 text-stone-950 font-bold border border-cyan-100/35 shadow-[0_10px_32px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-[1.06] active:brightness-[0.96] active:translate-y-px',
  secondary:
    'bg-gradient-to-b from-slate-600 via-slate-800 to-slate-950 text-slate-100 font-semibold border border-cyan-200/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:from-slate-500 hover:to-slate-900 hover:border-cyan-100/30 active:translate-y-px',
  ghost:
    'bg-slate-950/55 text-slate-300 border border-slate-600/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-slate-800/70 hover:text-slate-50 hover:border-cyan-500/25 active:translate-y-px',
  danger:
    'bg-gradient-to-b from-red-700 to-red-950 text-red-50 font-semibold border border-red-400/40 shadow-[0_8px_24px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.08)] hover:brightness-110 active:translate-y-px',
};

export interface GnzButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  /** Short UI click SFX on press (default on). Pass `false` to silence intentional quiet controls. */
  audioOnClick?: boolean;
}

export function GnzButton({
  variant = 'secondary',
  className,
  children,
  type = 'button',
  audioOnClick = true,
  onClick,
  ...rest
}: GnzButtonProps) {
  return (
    <button
      type={type}
      className={twMerge(
        'inline-flex min-h-[2.6rem] items-center justify-center gap-2 rounded-xl px-4 py-2.5 transition-all duration-150 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        className
      )}
      onClick={e => {
        if (audioOnClick) playUiClick();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
