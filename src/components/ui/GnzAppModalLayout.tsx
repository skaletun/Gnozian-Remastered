import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

/** Split header / optional left nav rail / scrollable main — typical grand-strategy settings layout. */
export function GnzAppModalLayout({
  header,
  navRail,
  children,
  footer,
  mainClassName,
}: {
  header: ReactNode;
  navRail?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[inherit]">
      {header}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {navRail != null ? (
          <div className="flex shrink-0 flex-row gap-1 overflow-x-auto overscroll-x-contain border-b border-cyan-200/[0.12] bg-black/28 px-2 py-2 [scrollbar-width:thin] lg:w-[14rem] lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-2 lg:py-3">
            {navRail}
          </div>
        ) : null}
        <div
          className={twMerge(
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]',
            mainClassName
          )}
        >
          {children}
        </div>
      </div>
      {footer}
    </div>
  );
}

export function GnzNavRailBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={twMerge(
        'gnz-2d-tab flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:text-sm',
        'lg:w-full lg:justify-start',
        active
          ? 'bg-cyan-950/60 text-cyan-50 ring-1 ring-amber-400/30'
          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
      )}
    >
      {icon != null ? <span className="shrink-0 opacity-90">{icon}</span> : null}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
