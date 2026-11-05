import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TECHNOLOGIES } from '../game/constants';
import { t } from '../i18n';
import { GnozianGlyph, GnozianPanelCorners } from './ui';

export type TechUnlockToastItem = { id: string; techId: string };

type Props = {
  items: TechUnlockToastItem[];
  onDismiss: (toastId: string) => void;
};

const DISPLAY_MS = 3000;

function techName(id: string): string {
  const key = `tech.name.${id}`;
  const localized = t(key);
  return localized !== key ? localized : (TECHNOLOGIES[id]?.name ?? id);
}

function TechToastRow({
  item,
  onDismiss,
  reduceMotion,
}: {
  item: TechUnlockToastItem;
  onDismiss: () => void;
  reduceMotion: boolean | null;
}) {
  useEffect(() => {
    const tmr = window.setTimeout(onDismiss, DISPLAY_MS);
    return () => window.clearTimeout(tmr);
  }, [onDismiss]);

  return (
    <motion.div
      layout
      initial={{ y: reduceMotion ? 0 : -52, opacity: 0, scale: reduceMotion ? 1 : 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: reduceMotion ? 0 : -36, opacity: 0, scale: 0.97 }}
      transition={
        reduceMotion
          ? { duration: 0.2 }
          : { type: 'spring', damping: 18, stiffness: 300, mass: 0.65 }
      }
      className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-xl border border-sky-500/45 bg-gradient-to-br from-sky-950/98 via-stone-950/98 to-black/95 py-3 pl-4 pr-5 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
    >
      <GnozianPanelCorners inset={4} size={28} />
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-sky-600/40 bg-sky-900/30 shadow-inner">
          <GnozianGlyph name="flask" size={26} className="text-sky-200/95" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400/95">
            {t('notif.techCompletedTitle')}
          </div>
          <div className="truncate font-serif text-base font-bold text-sky-50">
            {techName(item.techId)}
          </div>
        </div>
      </div>
      {!reduceMotion && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400/70 to-transparent"
          initial={{ scaleX: 1, opacity: 0.9 }}
          animate={{ scaleX: 0, opacity: 0.35 }}
          transition={{ duration: DISPLAY_MS / 1000, ease: 'linear' }}
          style={{ transformOrigin: 'left center' }}
        />
      )}
    </motion.div>
  );
}

export default function TechUnlockToastStack({ items, onDismiss }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[218] flex flex-col items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
      <AnimatePresence mode="popLayout">
        {items.map(item => (
          <TechToastRow
            key={item.id}
            item={item}
            reduceMotion={reduceMotion}
            onDismiss={() => onDismiss(item.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
