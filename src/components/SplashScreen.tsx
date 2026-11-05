import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { runMenuBootPreload } from '../game/bootPreload';
import { GnozianGlyph } from './ui';
import { t } from '../i18n';
import { assetUrl } from '../utils/assetUrl';

type Props = {
  onDone: () => void;
};

export default function SplashScreen({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [phaseKey, setPhaseKey] = useState('boot.phase.start');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await runMenuBootPreload(p => {
          if (!cancelled) {
            setProgress(p.ratio);
            setPhaseKey(p.phaseKey);
          }
        });
      } finally {
        if (!cancelled) onDone();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  const phaseLabel = t(phaseKey);

  return (
    <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center overflow-hidden bg-[#050a12]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: `url('${assetUrl('bg-img.png')}')` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-950/25 via-transparent to-black/80" />
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(251,191,36,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(34,211,238,0.2), transparent 40%)',
          backgroundSize: '140% 140%',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex max-w-md flex-col items-center px-6 text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-amber-500/35 bg-gradient-to-br from-amber-950/80 to-slate-950/90 shadow-[0_0_48px_rgba(251,191,36,0.18)]"
        >
          <GnozianGlyph name="globe" size={52} className="text-amber-200/95 drop-shadow-lg" />
        </motion.div>

        <h1 className="font-[family-name:var(--font-gnz-display)] text-3xl font-black tracking-tight text-transparent sm:text-4xl bg-gradient-to-b from-[#fff6d4] via-[#e8c060] to-[#8b6914] bg-clip-text drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
          {t('splash.title')}
        </h1>
        <p className="mt-2 text-sm text-stone-400 sm:text-base">{t('splash.subtitle')}</p>

        <div className="mt-10 w-full max-w-xs">
          <div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-cyan-200/75">
            <span>{phaseLabel}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-cyan-900/40 bg-black/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-cyan-400"
              initial={{ width: '0%' }}
              animate={{ width: `${Math.max(2, progress * 100)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            />
          </div>
        </div>
      </motion.div>

      <p className="absolute bottom-6 z-10 text-[10px] text-stone-600">{t('splash.hint')}</p>
    </div>
  );
}
