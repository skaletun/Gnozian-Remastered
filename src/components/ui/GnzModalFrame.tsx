import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { GnzPanel } from './GnzPanel';

interface Props {
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
  onBackdropClick?: () => void;
  /** Parchment-style compass corners (gnozian-ico). */
  ornament?: boolean;
  /** Merged into backdrop (e.g. z-index above in-game HUD). */
  backdropClassName?: string;
}

/** Backdrop + framed panel for menus and modals (not HUD). */
export function GnzModalFrame({
  children,
  className,
  maxWidthClass = 'max-w-3xl',
  onBackdropClick,
  ornament = false,
  backdropClassName,
}: Props) {
  return (
    <div
      className={twMerge(
        'gnz-modal-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-3 py-4 sm:px-4',
        backdropClassName
      )}
      onClick={onBackdropClick}
      role="presentation"
    >
      <GnzPanel
        ornament={ornament}
        className={twMerge(
          'relative w-full overflow-hidden border border-cyan-200/[0.14] ring-1 ring-amber-400/[0.14]',
          maxWidthClass,
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </GnzPanel>
    </div>
  );
}
