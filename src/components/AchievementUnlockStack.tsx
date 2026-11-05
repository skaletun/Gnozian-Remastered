import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { AchievementId } from '../game/achievements';
import { ACHIEVEMENTS } from '../game/achievements';
import { t } from '../i18n';
import { GnozianGlyph, GnozianPanelCorners, type GnozianGlyphName } from './ui';

export type AchievementToastItem = { id: string; achievementId: AchievementId };

const ICON_TO_GLYPH: Record<string, GnozianGlyphName> = {
  sword: 'sword',
  crown: 'crown',
  shield: 'shield',
  city: 'city',
  globe: 'globe',
  book: 'book',
  science: 'science',
  rocket: 'rocket',
  space: 'rocket',
  palette: 'palette',
  star: 'star',
  temple: 'temple',
  peace: 'handshake',
  map: 'map',
  compass: 'compass',
  gold: 'trophy',
  gem: 'star',
  hammer: 'hammer',
  time: 'bolt',
  movement: 'foot',
};

function glyphForAchievement(id: AchievementId): GnozianGlyphName {
  const icon = ACHIEVEMENTS[id]?.icon ?? '';
  return ICON_TO_GLYPH[icon] ?? (ACHIEVEMENTS[id]?.category === 'military' ? 'swords' : 'star');
}

function achievementTitle(id: AchievementId): string {
  const def = ACHIEVEMENTS[id];
  const key = `achievement.${id}.name`;
  const tr = t(key);
  return tr !== key ? tr : def?.name ?? id;
}

type Props = {
  items: AchievementToastItem[];
  onDismiss: (toastId: string) => void;
};

const DISPLAY_MS = 4000;

function AchievementToastRow({
  item,
  onDismiss,
  reduceMotion,
}: {
  item: AchievementToastItem;
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
            initial={{ y: reduceMotion ? 0 : -56, opacity: 0, scale: reduceMotion ? 1 : 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: reduceMotion ? 0 : -40, opacity: 0, scale: 0.96 }}
            transition={
              reduceMotion
                ? { duration: 0.2 }
                : { type: 'spring', damping: 18, stiffness: 320, mass: 0.65 }
            }
            className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-xl border border-amber-500/45 bg-gradient-to-br from-amber-950/98 via-stone-950/98 to-black/95 py-3 pl-4 pr-5 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
          >
            <GnozianPanelCorners inset={4} size={28} />
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-600/40 bg-amber-900/35 shadow-inner">
                <GnozianGlyph
                  name={glyphForAchievement(item.achievementId)}
                  size={26}
                  className="text-amber-200/95"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90">
                  {t('achieve.unlockBanner')}
                </div>
                <div className="truncate font-serif text-base font-bold text-amber-50">
                  {achievementTitle(item.achievementId)}
                </div>
              </div>
            </div>
            {!reduceMotion && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
                initial={{ scaleX: 1, opacity: 0.9 }}
                animate={{ scaleX: 0, opacity: 0.35 }}
                transition={{ duration: DISPLAY_MS / 1000, ease: 'linear' }}
                style={{ transformOrigin: 'left center' }}
              />
            )}
          </motion.div>
  );
}

export default function AchievementUnlockStack({ items, onDismiss }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[220] flex flex-col items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
      <AnimatePresence mode="popLayout">
        {items.map(item => (
          <AchievementToastRow
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
