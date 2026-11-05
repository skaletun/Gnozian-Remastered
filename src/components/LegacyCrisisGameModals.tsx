import { useMemo } from 'react';
import type { GameState, LegacyPathType, CrisisPolicyType } from '../game/types';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';
import { GnzModalFrame } from './ui/GnzModalFrame';
import { normalizeLegacyCrisis } from '../game/systems/legacyCrisisCore';
import { CRISIS_POLICY_PROMPT_SNOOZE_TURNS, LEGACY_PROMPT_SNOOZE_TURNS } from '../game/constants';
import { t } from '../i18n';

type Props = {
  gameState: GameState;
  onChooseLegacyOption: (path: LegacyPathType, choice: 'golden_age' | 'dark_age') => void;
  onSetCrisisPolicy: (policy: CrisisPolicyType) => void;
  onDeferLegacyPrompt: () => void;
  onDeferCrisisPolicyPrompt: () => void;
};

/** Full-screen modal prompts for legacy age path and crisis policy (moved out of HUD). */
export function LegacyCrisisGameModals({
  gameState,
  onChooseLegacyOption,
  onSetCrisisPolicy,
  onDeferLegacyPrompt,
  onDeferCrisisPolicyPrompt,
}: Props) {
  const me = useLocalPlayerCivIndex();
  const lc = useMemo(() => normalizeLegacyCrisis(gameState), [gameState]);

  const legacyPending = useMemo(
    () => lc.pendingLegacyChoices.find(x => x.civIndex === me) ?? null,
    [lc.pendingLegacyChoices, me]
  );

  const legacySnoozeUntil = lc.legacyPromptSnoozeUntilTurnByCiv?.[me];
  const showLegacyPrompt =
    !!legacyPending && (legacySnoozeUntil == null || gameState.turn >= legacySnoozeUntil);

  const crisisSnoozeUntil = lc.crisisPolicySnoozeUntilTurnByCiv?.[me];
  // Crisis stays active for several turns for simulation, but the policy picker is one-shot per civ.
  const crisisPolicyPending = lc.selectedPolicyByCiv?.[me] == null;
  const showCrisisPolicyPrompt =
    !!lc.crisisActive &&
    crisisPolicyPending &&
    (crisisSnoozeUntil == null || gameState.turn >= crisisSnoozeUntil);

  const open = showLegacyPrompt || showCrisisPolicyPrompt;
  if (!open) return null;

  return (
    <GnzModalFrame ornament maxWidthClass="max-w-lg">
      <div className="space-y-4 p-4 sm:p-5">
        {showLegacyPrompt ? (
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/35 p-3 sm:p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/95">
              {t('legacyCrisis.legacyTitle')}
            </div>
            <div className="mb-3 text-xs text-emerald-100/90">
              {t('legacyCrisis.legacySubtitle', { age: legacyPending?.age ?? '' })}
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['military', 'science', 'culture', 'economy'] as LegacyPathType[]).map(path => (
                <div key={path} className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChooseLegacyOption(path, 'golden_age')}
                    className="flex-1 rounded-md border border-emerald-800/55 bg-emerald-900/45 px-2 py-2 text-[11px] font-bold text-emerald-50 transition hover:bg-emerald-800/50"
                  >
                    {path} · golden
                  </button>
                  <button
                    type="button"
                    onClick={() => onChooseLegacyOption(path, 'dark_age')}
                    className="flex-1 rounded-md border border-amber-800/55 bg-amber-950/40 px-2 py-2 text-[11px] font-bold text-amber-100/95 transition hover:bg-amber-900/45"
                  >
                    {path} · dark
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onDeferLegacyPrompt}
              className="w-full rounded-md border border-stone-600/60 bg-stone-900/50 py-2 text-[11px] font-semibold text-stone-200 transition hover:bg-stone-800/60"
            >
              {t('legacyCrisis.laterLegacy', { turns: String(LEGACY_PROMPT_SNOOZE_TURNS) })}
            </button>
          </div>
        ) : null}
        {showCrisisPolicyPrompt ? (
          <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 sm:p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-300/95">
              {t('legacyCrisis.crisisTitle')}
            </div>
            <div className="mb-3 text-xs text-rose-100/90">
              {t('legacyCrisis.crisisSubtitle', {
                age: lc.crisisAge ?? '—',
                turns: String(lc.crisisTurnsLeft),
                severity: String(lc.crisisSeverity),
              })}
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                ['rationing', 'war_mobilization', 'knowledge_preservation', 'cultural_unity'] as CrisisPolicyType[]
              ).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSetCrisisPolicy(p)}
                  className={`rounded-md border px-2 py-2 text-left text-[11px] font-bold transition ${
                    lc.selectedPolicyByCiv?.[me] === p
                      ? 'border-rose-400/70 bg-rose-700/45 text-rose-50'
                      : 'border-rose-800/55 bg-rose-950/35 text-rose-100/95 hover:bg-rose-900/40'
                  }`}
                >
                  {p.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onDeferCrisisPolicyPrompt}
              className="w-full rounded-md border border-stone-600/60 bg-stone-900/50 py-2 text-[11px] font-semibold text-stone-200 transition hover:bg-stone-800/60"
            >
              {t('legacyCrisis.laterCrisis', { turns: String(CRISIS_POLICY_PROMPT_SNOOZE_TURNS) })}
            </button>
          </div>
        ) : null}
      </div>
    </GnzModalFrame>
  );
}
