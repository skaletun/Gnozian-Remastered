import type { HTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { GnozianPanelCorners } from './gnozian';

export function GnzPanel({
  className,
  children,
  ornament = false,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; ornament?: boolean }) {
  return (
    <div
      className={twMerge(
        'gnz-panel relative rounded-2xl border border-cyan-200/[0.14] ring-1 ring-amber-400/[0.16]',
        className
      )}
      {...rest}
    >
      {ornament && <GnozianPanelCorners />}
      {ornament ? (
        <div className="relative z-10 flex w-full min-w-0 flex-col gap-4 sm:gap-5">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
