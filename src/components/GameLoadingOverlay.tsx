import { motion, AnimatePresence } from 'framer-motion';
import { GnozianGlyph } from './ui';
import { t } from '../i18n';

type Props = {
  active: boolean;
  title: string;
  subtitle?: string;
  /** 0..1 when boot / long tasks report progress */
  progress?: number;
  phaseKey?: string;
  zIndexClass?: string;
};

export default function GameLoadingOverlay({
  active,
  title,
  subtitle,
  progress,
  phaseKey,
  zIndexClass = 'z-[280]',
}: Props) {
  const showBar = typeof progress === 'number' && progress >= 0 && progress <= 1;
  const phase = phaseKey ? t(phaseKey) : '';

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`absolute inset-0 ${zIndexClass} gnz-modal-backdrop flex items-center justify-center`}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="gnz-panel relative w-[min(92vw,26rem)] rounded-2xl border border-amber-600/45 px-6 py-6 text-center ring-1 ring-amber-900/30 sm:px-8 sm:py-7"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.35, repeat: Infinity, ease: 'linear' }}
              className="mb-3 flex justify-center"
            >
              <GnozianGlyph name="gear" size={34} className="text-amber-400/90" />
            </motion.div>
            <div className="font-[family-name:var(--font-gnz-display)] text-lg font-bold text-amber-100">{title}</div>
            {subtitle && <div className="mt-1 text-sm text-stone-400">{subtitle}</div>}
            {phase ? <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80">{phase}</div> : null}
            {showBar ? (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full border border-cyan-900/35 bg-black/45">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-600 to-cyan-400"
                  initial={false}
                  animate={{ width: `${Math.round(progress * 100)}%` }}
                  transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
                />
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
