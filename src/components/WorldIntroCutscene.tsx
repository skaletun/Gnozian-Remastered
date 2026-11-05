import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GNOZIAN_WORLD_LORE } from '../lore/gnozianWorldLore';
import type { Language } from '../i18n';
import { t } from '../i18n';
import { GnzButton, GnzPanel, GnozianGlyph } from './ui';

const SKIP_HOLD_MS = 5000;

interface Props {
  language: Language;
  onComplete: () => void;
}

export default function WorldIntroCutscene({ language, onComplete }: Props) {
  const [idx, setIdx] = useState(0);
  const [spaceDown, setSpaceDown] = useState(false);
  const holdStartRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const [holdProgress, setHoldProgress] = useState(0);

  const chapter = GNOZIAN_WORLD_LORE[idx] ?? GNOZIAN_WORLD_LORE[0]!;
  const title = language === 'ru' ? chapter.titleRu : chapter.titleEn;
  const body = language === 'ru' ? chapter.bodyRu : chapter.bodyEn;

  const isLast = idx >= GNOZIAN_WORLD_LORE.length - 1;

  const finish = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const tick = (now: number) => {
      if (spaceDown && holdStartRef.current != null) {
        const p = Math.min(1, (now - holdStartRef.current) / SKIP_HOLD_MS);
        setHoldProgress(p);
        if (p >= 1) {
          finish();
          return;
        }
      } else {
        setHoldProgress(0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spaceDown, finish]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!spaceDown) {
          setSpaceDown(true);
          holdStartRef.current = performance.now();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(false);
        holdStartRef.current = null;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [spaceDown]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setIdx(i => i + 1);
  }, [isLast, finish]);

  const skipHint = useMemo(
    () => (language === 'ru' ? 'Удерживайте ПРОБЕЛ ~5 с, чтобы пропустить вступление' : 'Hold SPACE ~5s to skip intro'),
    [language]
  );

  return (
    <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center gnz-page-bg px-4 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.12),transparent_55%)]" />
      </div>

      <GnzPanel className="relative z-10 w-full max-w-2xl p-8 shadow-2xl">
        <div className="mb-4 flex items-center gap-2 text-amber-600/90">
          <GnozianGlyph name="book" size={22} className="text-amber-400/90" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">{t('intro.badge')}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={chapter.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <h1 className="mb-4 font-serif text-2xl font-bold text-amber-50 md:text-3xl">{title}</h1>
            <p className="text-base leading-relaxed text-stone-300 md:text-lg">{body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-stone-800/80 pt-6">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-stone-500">{skipHint}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-900">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-800 to-amber-500"
                style={{ width: `${Math.round(holdProgress * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <GnzButton audioOnClick variant="secondary" type="button" onClick={finish}>
              {t('intro.skipNow')}
            </GnzButton>
            <GnzButton audioOnClick variant="primary" type="button" onClick={next}>
              {isLast ? t('intro.begin') : t('intro.next')}
            </GnzButton>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-stone-600">
          {idx + 1} / {GNOZIAN_WORLD_LORE.length}
        </p>
      </GnzPanel>
    </div>
  );
}
