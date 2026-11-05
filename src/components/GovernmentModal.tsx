import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Era, GovernmentType } from '../game/types';
import { GOVERNMENTS, POLICY_CARDS } from '../game/constants';
import { setCivilizationGovernment } from '../game/engine';
import { t } from '../i18n';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';
const ERA_ORDER: Era[] = [
  'ancient',
  'classical',
  'medieval',
  'renaissance',
  'industrial',
  'modern',
  'atomic',
  'information',
];

function eraAtLeast(civEra: Era, required: Era): boolean {
  const a = ERA_ORDER.indexOf(civEra);
  const b = ERA_ORDER.indexOf(required);
  return (a >= 0 ? a : 0) >= (b >= 0 ? b : 0);
}

function policySlotsLostOnSwitch(
  slottedPolicyIds: string[],
  newGovId: GovernmentType
): number {
  const slots = GOVERNMENTS[newGovId].policySlots;
  return Math.max(0, slottedPolicyIds.length - slots);
}

interface Props {
  gameState: GameState;
  civIndex?: number;
  onClose: () => void;
  onUpdateState: (s: GameState) => void;
}

export default function GovernmentModal({
  gameState,
  civIndex: civIndexProp,
  onClose,
  onUpdateState,
}: Props) {
  const me = useLocalPlayerCivIndex();
  const civIndex = civIndexProp ?? me;
  const human = gameState.civilizations[civIndex];
  const [pendingGov, setPendingGov] = useState<GovernmentType | null>(null);
  const tl = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const govName = (id: GovernmentType) => tl(`government.name.${id}`, GOVERNMENTS[id].name);
  const govDesc = (id: GovernmentType) => tl(`government.desc.${id}`, GOVERNMENTS[id].description);
  const policyName = (id: string) => tl(`policy.name.${id}`, POLICY_CARDS[id]?.name ?? id);
  const policyDesc = (id: string) => tl(`policy.desc.${id}`, POLICY_CARDS[id]?.description ?? '');

  const currentGov = GOVERNMENTS[human.governmentId];
  const unlockedGovernments = (Object.keys(GOVERNMENTS) as GovernmentType[]).filter(gid =>
    eraAtLeast(human.era, GOVERNMENTS[gid].era)
  );
  const policiesAvailable = Object.values(POLICY_CARDS).filter(p => eraAtLeast(human.era, p.era));

  const applyGovernment = (govId: GovernmentType) => {
    const g = GOVERNMENTS[govId];
    const trimmed = human.slottedPolicyIds.slice(0, g.policySlots);
    onUpdateState(setCivilizationGovernment(gameState, civIndex, govId, trimmed));
    setPendingGov(null);
  };

  const requestGovernmentChange = (govId: GovernmentType) => {
    if (govId === human.governmentId) return;
    const lost = policySlotsLostOnSwitch(human.slottedPolicyIds, govId);
    if (lost > 0) setPendingGov(govId);
    else applyGovernment(govId);
  };

  const confirmPending = () => {
    if (pendingGov) applyGovernment(pendingGov);
  };

  const togglePolicy = (pid: string) => {
    const slots = currentGov?.policySlots ?? 0;
    if (!POLICY_CARDS[pid] || slots === 0) return;
    let next = [...human.slottedPolicyIds];
    if (next.includes(pid)) next = next.filter(x => x !== pid);
    else if (next.length < slots) next = [...next, pid];
    else next = [...next.slice(1), pid];
    onUpdateState(setCivilizationGovernment(gameState, civIndex, human.governmentId, next));
  };

  const pendingDef = pendingGov ? GOVERNMENTS[pendingGov] : null;
  const pendingLost =
    pendingGov != null ? policySlotsLostOnSwitch(human.slottedPolicyIds, pendingGov) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 10 }}
        onClick={e => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-900/50 bg-stone-950/98 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-200">{t('govModal.title')}</h2>
          <button
            type="button"
            className="text-stone-500 transition-colors hover:text-white"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-stone-400">{t('empire.governmentHelp')}</p>

        <div className="mb-3 text-sm text-stone-300">
          {t('empire.currentGovernment')}:{' '}
          <span className="font-semibold text-amber-100">
            {currentGov ? govName(human.governmentId) : human.governmentId}
          </span>
          {currentGov && currentGov.policySlots > 0 && (
            <span className="text-stone-500">
              {' '}
              · {human.slottedPolicyIds.length}/{currentGov.policySlots} {t('empire.policySlots')}
            </span>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {unlockedGovernments.map(gid => {
            const g = GOVERNMENTS[gid];
            const active = human.governmentId === gid;
            return (
              <button
                key={gid}
                type="button"
                onClick={() => requestGovernmentChange(gid)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  active
                    ? 'border-amber-500/70 bg-amber-950/50 text-amber-100'
                    : 'border-stone-700 bg-stone-900/50 text-stone-300 hover:border-amber-800/50 hover:bg-stone-800/80'
                }`}
              >
                <div className="font-bold">{govName(gid)}</div>
                <div className="mt-0.5 text-[10px] text-stone-500">{govDesc(gid)}</div>
                <div className="mt-1 text-[9px] tabular-nums text-stone-600">
                  {g.policySlots} {t('empire.policySlots')}
                </div>
              </button>
            );
          })}
        </div>

        {currentGov && currentGov.policySlots > 0 && (
          <>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
              {t('empire.policySection')}
            </h4>
            <p className="mb-2 text-[11px] text-stone-500">{t('empire.policyHelp')}</p>
            <div className="flex flex-wrap gap-1.5">
              {policiesAvailable.map((p, idx) => {
                const on = human.slottedPolicyIds.includes(p.id);
                return (
                  <button
                    key={`${p.id}-${idx}`}
                    type="button"
                    onClick={() => togglePolicy(p.id)}
                    className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase transition-colors ${
                      on
                        ? 'border-amber-500/60 bg-amber-950/40 text-amber-100'
                        : 'border-stone-700 bg-black/30 text-stone-400 hover:border-stone-600'
                    }`}
                    title={policyDesc(p.id)}
                  >
                    {policyName(p.id)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <AnimatePresence>
          {pendingGov && pendingDef && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/75 p-4"
              onClick={() => setPendingGov(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-xl border border-amber-800/60 bg-stone-950 p-5 shadow-xl"
              >
                <h3 className="mb-2 text-base font-bold text-amber-100">{t('govModal.confirmTitle')}</h3>
                <p className="mb-4 text-sm leading-relaxed text-stone-300">
                  {t('govModal.confirmBody', {
                    govName: govName(pendingGov),
                    newSlots: pendingDef.policySlots,
                    assigned: human.slottedPolicyIds.length,
                    lost: pendingLost,
                  })}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-stone-600 px-3 py-2 text-sm text-stone-300 hover:bg-stone-800"
                    onClick={() => setPendingGov(null)}
                  >
                    {t('govModal.confirmCancel')}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-amber-600/70 bg-amber-950/60 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-900/50"
                    onClick={confirmPending}
                  >
                    {t('govModal.confirmSwitch')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
