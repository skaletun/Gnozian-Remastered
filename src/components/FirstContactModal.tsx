import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState } from '../game/types';
import { AI_PERSONALITIES, getCivTemplateByName } from '../game/constants';
import { CivEmblem, GnzButton, GnzModalFrame } from './ui';
import { t } from '../i18n';
import { useLayoutProfile } from '../hooks/useLayoutProfile';

const STEPS = 3;

function personalityI18nKey(raw: string | undefined): string {
  const k = (raw ?? 'BUILDER').toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (k && k in AI_PERSONALITIES) return `firstContact.personality.${k}`;
  return 'firstContact.personality.DEFAULT';
}

/** Resolve CIV_TEMPLATES id for first-contact copy (identity layer, then template lookup by civ name). */
function resolveFirstContactTemplateId(state: GameState, otherIndex: number): string {
  const raw = state.civilizationIdentity?.[otherIndex]?.templateId?.trim();
  if (raw && /^[a-z][a-z0-9_]*$/i.test(raw) && !raw.toLowerCase().startsWith('civ-')) {
    return raw.toLowerCase();
  }
  const civ = state.civilizations[otherIndex];
  const fromName = civ ? getCivTemplateByName(civ.name)?.id : null;
  if (fromName) return fromName.toLowerCase();
  if (raw) return raw.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'unknown';
  return 'unknown';
}

function tResolved(key: string, params?: Record<string, string | number>): string {
  const v = t(key, params);
  return v !== key ? v : '';
}

export interface FirstContactModalProps {
  gameState: GameState;
  viewerCivIndex: number;
  otherCivIndex: number;
  onFinished: () => void;
}

export function FirstContactModal({
  gameState,
  viewerCivIndex,
  otherCivIndex,
  onFinished,
}: FirstContactModalProps) {
  const layout = useLayoutProfile();
  const mobile = layout === 'mobile';
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [otherCivIndex]);

  const other = gameState.civilizations[otherCivIndex];
  const self = gameState.civilizations[viewerCivIndex];

  const personalityLineKey = useMemo(() => personalityI18nKey(other?.aiPersonality), [other?.aiPersonality]);

  const templateId = useMemo(
    () => resolveFirstContactTemplateId(gameState, otherCivIndex),
    [gameState, otherCivIndex]
  );

  const civLineBase = useMemo(() => `firstContact.civ.${templateId}.`, [templateId]);

  if (!other || !self) return null;

  const leader = other.leader ?? other.name;
  const params = {
    civName: other.name,
    adjective: other.adjective,
    leader,
  };

  const line0 =
    tResolved(`${civLineBase}intro`, params) || t('firstContact.intro', params);
  const line1 =
    tResolved(`${civLineBase}voice`, { leader }) || t(personalityLineKey, { leader });
  const line2 =
    tResolved(`${civLineBase}outro`, { civName: other.name, adjective: other.adjective }) ||
    t('firstContact.outro', { civName: other.name });

  const copy = step === 0 ? line0 : step === 1 ? line1 : line2;

  const isLast = step >= STEPS - 1;

  return (
    <GnzModalFrame ornament maxWidthClass="max-w-lg" backdropClassName="z-[165]" onBackdropClick={isLast ? onFinished : undefined}>
      <div className={`space-y-4 ${mobile ? 'p-4' : 'p-5 sm:p-6'}`}>
        <div className="flex items-start gap-3">
          <CivEmblem
            primary={other.color}
            secondary={other.secondaryColor}
            variant={otherCivIndex}
            size={mobile ? 48 : 56}
            title={other.name}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/85">
              {t('firstContact.title')}
            </div>
            <div className="mt-1 text-lg font-bold text-stone-50 sm:text-xl">{other.name}</div>
            <div className="text-xs text-cyan-100/75">
              {t('firstContact.subtitle', { adjective: other.adjective, leader })}
            </div>
          </div>
        </div>

        <div className="relative min-h-[4.5rem] rounded-lg border border-cyan-900/40 bg-slate-950/60 px-3 py-3 sm:px-4 sm:py-3.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${otherCivIndex}-${step}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-sm leading-relaxed text-stone-100/95 sm:text-[15px]"
            >
              {copy}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cyan-900/25 pt-3">
          <div className="mr-auto text-[10px] tabular-nums text-stone-500">
            {t('tutorial.stepOf', { current: step + 1, total: STEPS })}
          </div>
          {isLast ? (
            <GnzButton variant="primary" type="button" onClick={onFinished}>
              {t('firstContact.acknowledge')}
            </GnzButton>
          ) : (
            <GnzButton variant="primary" type="button" onClick={() => setStep(s => Math.min(STEPS - 1, s + 1))}>
              {t('tutorial.next')}
            </GnzButton>
          )}
        </div>
      </div>
    </GnzModalFrame>
  );
}
