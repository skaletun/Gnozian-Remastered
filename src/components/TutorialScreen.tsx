import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { t } from '../i18n';
import { playUiClick } from '../audio/AudioManager';
import { GnozianPanelCorners, GnozianGlyph, GnzButton, GnzNavRailBtn } from './ui';
import { modalBackdropMotion, modalCardMotion } from './ui/motionPresets';
import {
  TutorialPreviewAgesLegacyCrisis,
  TutorialPreviewCityGrowthProduction,
  TutorialPreviewCombatCommanders,
  TutorialPreviewDiplomacyTradeSettlements,
  TutorialPreviewEconomyResources,
  TutorialPreviewExplorationWorkers,
  TutorialPreviewFirstTurn,
  TutorialPreviewGreatPeopleVictory,
  TutorialPreviewResearchCivicsGovernment,
  TutorialPreviewResourceSlotsStrategics,
} from './tutorial/TutorialPreviews';

const STEP_KEYS = [
  'first_turn',
  'city_growth_production',
  'exploration_workers',
  'economy_resources',
  'resource_slots_strategics',
  'combat_commanders',
  'research_civics_government',
  'ages_legacy_crisis',
  'diplomacy_trade_settlements',
  'great_people_victory',
] as const;

type StepKey = (typeof STEP_KEYS)[number];

const STEP_TOPIC_META: Record<
  StepKey,
  { topic: string; badgeClass: string }
> = {
  first_turn: {
    topic: 'fundamentals',
    badgeClass: 'border-amber-700/45 bg-amber-950/30 text-amber-200',
  },
  city_growth_production: {
    topic: 'cities',
    badgeClass: 'border-emerald-700/45 bg-emerald-950/30 text-emerald-200',
  },
  exploration_workers: {
    topic: 'fundamentals',
    badgeClass: 'border-sky-700/45 bg-sky-950/30 text-sky-200',
  },
  economy_resources: {
    topic: 'economy',
    badgeClass: 'border-yellow-700/45 bg-yellow-950/20 text-yellow-200',
  },
  resource_slots_strategics: {
    topic: 'economy',
    badgeClass: 'border-cyan-700/45 bg-cyan-950/30 text-cyan-200',
  },
  combat_commanders: {
    topic: 'warfare',
    badgeClass: 'border-rose-700/45 bg-rose-950/25 text-rose-200',
  },
  research_civics_government: {
    topic: 'progress',
    badgeClass: 'border-indigo-700/45 bg-indigo-950/30 text-indigo-200',
  },
  ages_legacy_crisis: {
    topic: 'progress',
    badgeClass: 'border-orange-700/45 bg-orange-950/25 text-orange-200',
  },
  diplomacy_trade_settlements: {
    topic: 'progress',
    badgeClass: 'border-teal-700/45 bg-teal-950/30 text-teal-200',
  },
  great_people_victory: {
    topic: 'victory',
    badgeClass: 'border-violet-700/45 bg-violet-950/30 text-violet-200',
  },
};

const PREVIEW_BY_STEP: Record<StepKey, ComponentType> = {
  first_turn: TutorialPreviewFirstTurn,
  city_growth_production: TutorialPreviewCityGrowthProduction,
  exploration_workers: TutorialPreviewExplorationWorkers,
  economy_resources: TutorialPreviewEconomyResources,
  resource_slots_strategics: TutorialPreviewResourceSlotsStrategics,
  combat_commanders: TutorialPreviewCombatCommanders,
  research_civics_government: TutorialPreviewResearchCivicsGovernment,
  ages_legacy_crisis: TutorialPreviewAgesLegacyCrisis,
  diplomacy_trade_settlements: TutorialPreviewDiplomacyTradeSettlements,
  great_people_victory: TutorialPreviewGreatPeopleVictory,
};

interface Props {
  onClose: () => void;
}

export default function TutorialScreen({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const isWebRuntime = typeof navigator !== 'undefined' && !/electron/i.test(navigator.userAgent);
  const key = STEP_KEYS[step]!;
  const Preview = PREVIEW_BY_STEP[key];
  const topicMeta = STEP_TOPIC_META[key];
  const last = step >= STEP_KEYS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        playUiClick();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goNext = useCallback(() => {
    if (last) onClose();
    else setStep(s => Math.min(s + 1, STEP_KEYS.length - 1));
  }, [last, onClose]);

  const goPrev = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
  }, []);

  return (
    <motion.div
      {...(isWebRuntime
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.14 } }
        : modalBackdropMotion)}
      className="fixed inset-0 z-[120] gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3"
      onClick={() => {
        playUiClick();
        onClose();
      }}
    >
      <motion.div
        {...(isWebRuntime
          ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 }, transition: { duration: 0.16 } }
          : modalCardMotion)}
        className="relative gnz-panel mx-auto flex max-h-[min(94vh,44rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-200/[0.14] shadow-2xl ring-1 ring-amber-400/[0.14]"
        onClick={e => e.stopPropagation()}
      >
        <GnozianPanelCorners inset={5} size={38} />
        <div className="relative z-10 flex items-start justify-between gap-3 border-b border-amber-900/30 bg-black/25 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
              <GnozianGlyph name="book" size={24} className="shrink-0 text-amber-400/90" />
              <span className="truncate">{t('tutorial.title')}</span>
            </h2>
            <p className="mt-1 text-xs text-stone-500">{t('tutorial.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="shrink-0 rounded-lg px-3 py-2 text-2xl leading-none text-stone-500 transition-colors hover:bg-stone-800/80 hover:text-white"
            aria-label={t('tutorial.close')}
          >
            ×
          </button>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto overscroll-x-contain border-b border-cyan-200/[0.12] bg-black/28 px-2 py-2 lg:w-[15rem] lg:flex-col lg:gap-0.5 lg:border-b-0 lg:border-r lg:overflow-y-auto lg:px-2 lg:py-4">
            {STEP_KEYS.map((jumpKey, i) => (
              <GnzNavRailBtn
                key={jumpKey}
                active={step === i}
                onClick={() => {
                  playUiClick();
                  setStep(i);
                }}
              >
                {`${i + 1}. ${t(`tutorial.step.${jumpKey}.title`)}`}
              </GnzNavRailBtn>
            ))}
          </aside>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:min-w-0">
          <div className="relative aspect-[16/10] max-h-[14rem] w-full shrink-0 border-b border-stone-800/80 bg-black/40 sm:max-h-[16rem]">
            <AnimatePresence mode={isWebRuntime ? 'sync' : 'wait'}>
              <motion.div
                key={key}
                initial={isWebRuntime ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={isWebRuntime ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={isWebRuntime ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: isWebRuntime ? 0.12 : 0.28 }}
                className="absolute inset-0 p-3 sm:p-4"
              >
                <Preview />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-1 flex-col gap-3 px-5 py-4 sm:px-6 sm:py-5">
            <AnimatePresence mode={isWebRuntime ? 'sync' : 'wait'}>
              <motion.div
                key={key}
                initial={isWebRuntime ? { opacity: 0 } : { opacity: 0, x: 8 }}
                animate={isWebRuntime ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={isWebRuntime ? { opacity: 0 } : { opacity: 0, x: -6 }}
                transition={{ duration: isWebRuntime ? 0.12 : 0.22 }}
                className="grid min-h-[18.5rem] grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]"
              >
                <div className="space-y-2.5 rounded-xl border border-amber-900/25 bg-black/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${topicMeta.badgeClass}`}
                    >
                      {t(`tutorial.topic.${topicMeta.topic}`)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                      {t('tutorial.stepOf', { current: step + 1, total: STEP_KEYS.length })}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-amber-400/95 sm:text-xl">
                    {t(`tutorial.step.${key}.title`)}
                  </h3>
                  <div className="rounded-md border border-sky-900/35 bg-sky-950/25 px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/85">
                      {t('tutorial.learnLabel')}
                    </div>
                    <p className="mt-1 text-xs text-sky-100/90">{t(`tutorial.step.${key}.learn`)}</p>
                  </div>
                  <div className="rounded-md border border-amber-900/35 bg-amber-950/20 px-2.5 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/85">
                      {t('tutorial.whyLabel')}
                    </div>
                    <p className="mt-1 text-xs text-stone-200">{t(`tutorial.step.${key}.why`)}</p>
                  </div>
                  <div className="rounded-md border border-emerald-900/35 bg-emerald-950/20 px-2.5 py-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/85">
                      {t('tutorial.rulesLabel')}
                    </div>
                    <ul className="space-y-1">
                      {[1, 2, 3, 4].map(i => (
                        <li key={i} className="text-xs leading-relaxed text-stone-300">
                          {t(`tutorial.step.${key}.rule${i}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-violet-900/35 bg-violet-950/20 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
                      {t('tutorial.tipLabel')}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-violet-100/90">{t(`tutorial.step.${key}.tip`)}</p>
                  </div>
                  <div className="rounded-xl border border-stone-800/80 bg-black/30 p-3 lg:hidden">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                      {t('tutorial.quickJump')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STEP_KEYS.map((jumpKey, i) => (
                        <button
                          key={jumpKey}
                          type="button"
                          onClick={() => {
                            playUiClick();
                            setStep(i);
                          }}
                          className={`rounded px-2 py-1 text-[10px] transition-colors ${
                            i === step
                              ? 'border border-amber-500/55 bg-amber-900/35 text-amber-200'
                              : 'border border-stone-700/70 bg-stone-900/70 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {i + 1}. {t(`tutorial.step.${jumpKey}.title`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-stone-800/60 pt-4">
              <div className="flex gap-2">
                {STEP_KEYS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={t('tutorial.stepDot', { n: i + 1 })}
                    onClick={() => {
                      playUiClick();
                      setStep(i);
                    }}
                    className={`h-3 rounded-full transition-all ${
                      i === step ? 'w-7 bg-amber-500' : 'w-3 bg-stone-700 hover:bg-stone-600'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-stone-600">{t('tutorial.stepOf', { current: step + 1, total: STEP_KEYS.length })}</p>
            </div>

            <div className="flex gap-2">
              <GnzButton variant="ghost" className="flex-1 py-2.5" disabled={step === 0} onClick={goPrev}>
                {t('tutorial.prev')}
              </GnzButton>
              <GnzButton variant="primary" className="flex-[1.35] py-2.5 font-bold" onClick={goNext}>
                {last ? t('tutorial.done') : t('tutorial.next')}
              </GnzButton>
            </div>
          </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
