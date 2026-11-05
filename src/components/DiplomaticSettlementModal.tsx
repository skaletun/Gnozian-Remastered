import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameState, DiplomaticOffer, DiplomaticOfferKind, DiplomaticSettlementPayments } from '../game/types';
import {
  proposeDiplomaticSettlement,
  applyInfluenceDiplomacyAction,
  counterDiplomaticOffer,
} from '../game/engine';
import { influenceActionCost } from '../game/systems/influenceDiplomacyCore';
import {
  ARMISTICE_DURATION_MIN_TURNS,
  ARMISTICE_DURATION_MAX_TURNS,
  ARMISTICE_DURATION_TURNS,
  MAX_SETTLEMENT_GOLD_PER_DIRECTION,
} from '../game/constants';
import { GnozianGlyph, CivEmblem } from './ui';
import { t } from '../i18n';
import { useLayoutProfile } from '../hooks/useLayoutProfile';

function toPerspective(
  me: number,
  pairLo: number,
  goldLoPaysHi: number,
  goldHiPaysLo: number
): { iPay: number; theyPayMe: number } {
  if (me === pairLo) return { iPay: goldLoPaysHi, theyPayMe: goldHiPaysLo };
  return { iPay: goldHiPaysLo, theyPayMe: goldLoPaysHi };
}

function fromPerspective(
  me: number,
  pairLo: number,
  iPay: number,
  theyPayMe: number
): DiplomaticSettlementPayments {
  if (me === pairLo) return { goldLoPaysHi: iPay, goldHiPaysLo: theyPayMe };
  return { goldLoPaysHi: theyPayMe, goldHiPaysLo: iPay };
}

function clampGold(n: number): number {
  return Math.max(0, Math.min(MAX_SETTLEMENT_GOLD_PER_DIRECTION, Math.round(n)));
}

export interface DiplomaticSettlementModalProps {
  gameState: GameState;
  me: number;
  mode: 'propose' | 'respond';
  kind: DiplomaticOfferKind;
  otherCivIndex: number;
  offer?: DiplomaticOffer;
  onClose: () => void;
  onUpdateState: (s: GameState) => void;
  /** When false, backdrop click does not close (incoming AI offer). */
  allowBackdropClose?: boolean;
}

export default function DiplomaticSettlementModal({
  gameState,
  me,
  mode,
  kind,
  otherCivIndex,
  offer,
  onClose,
  onUpdateState,
  allowBackdropClose = true,
}: DiplomaticSettlementModalProps) {
  const layout = useLayoutProfile();
  const mobile = layout === 'mobile';

  const pairLo = Math.min(me, otherCivIndex);

  const initialPerspective = useMemo(() => {
    if (mode === 'respond' && offer) {
      return toPerspective(me, offer.pairLo, offer.goldLoPaysHi, offer.goldHiPaysLo);
    }
    return { iPay: 0, theyPayMe: 0 };
  }, [mode, offer, me]);

  const [iPay, setIPay] = useState(initialPerspective.iPay);
  const [theyPayMe, setTheyPayMe] = useState(initialPerspective.theyPayMe);
  const [armisticeTurns, setArmisticeTurns] = useState(() =>
    kind === 'armistice'
      ? Math.max(
          ARMISTICE_DURATION_MIN_TURNS,
          Math.min(ARMISTICE_DURATION_MAX_TURNS, offer?.armisticeTurns ?? ARMISTICE_DURATION_TURNS)
        )
      : ARMISTICE_DURATION_TURNS
  );

  const myCiv = gameState.civilizations[me]!;
  const otherCiv = gameState.civilizations[otherCivIndex]!;

  const titleKey =
    mode === 'propose'
      ? kind === 'peace'
        ? 'diplomacy.settlementProposePeace'
        : 'diplomacy.settlementProposeArmistice'
      : 'diplomacy.settlementRespondTitle';

  const submitTerms = useCallback((): DiplomaticSettlementPayments & { armisticeTurns?: number } => {
    const base = fromPerspective(me, pairLo, clampGold(iPay), clampGold(theyPayMe));
    if (kind !== 'armistice') return base;
    const dur = Math.max(ARMISTICE_DURATION_MIN_TURNS, Math.min(ARMISTICE_DURATION_MAX_TURNS, Math.round(armisticeTurns)));
    return { ...base, armisticeTurns: dur };
  }, [me, pairLo, iPay, theyPayMe, kind, armisticeTurns]);

  const handlePropose = () => {
    const terms = submitTerms();
    onUpdateState(proposeDiplomaticSettlement(gameState, me, otherCivIndex, kind, terms));
    onClose();
  };

  const handleAccept = () => {
    if (!offer) return;
    onUpdateState(
      applyInfluenceDiplomacyAction(gameState, me, offer.fromCiv, 'accept', { offerId: offer.id })
    );
    onClose();
  };

  const handleReject = () => {
    if (!offer) return;
    onUpdateState(
      applyInfluenceDiplomacyAction(gameState, me, offer.fromCiv, 'reject', { offerId: offer.id })
    );
    onClose();
  };

  const handleCounter = () => {
    if (!offer) return;
    const terms = submitTerms();
    onUpdateState(counterDiplomaticOffer(gameState, offer.id, me, terms));
    onClose();
  };

  const tl = useCallback((key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3"
      onClick={allowBackdropClose ? onClose : undefined}
    >
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`flex w-full flex-col overflow-hidden rounded-2xl border border-blue-800/50 bg-[#090f17] shadow-2xl ${
          mobile ? 'max-h-[90vh] max-w-[98vw]' : 'max-h-[90vh] max-w-[min(96vw,520px)]'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between bg-gradient-to-r from-blue-950 to-indigo-950 border-b border-blue-800/50 ${mobile ? 'px-3 py-2' : 'px-5 py-3'}`}
        >
          <div className="flex items-center gap-3">
            <GnozianGlyph name="globe" size={26} className="text-sky-300/90" />
            <div>
              <h2 className={`text-white font-bold ${mobile ? 'text-base' : 'text-lg'}`}>{tl(titleKey, 'Settlement')}</h2>
              <p className={`text-blue-300 ${mobile ? 'text-xs' : 'text-sm'}`}>
                {otherCiv.name} · {kind === 'peace' ? tl('diplomacy.settlementPeaceKind', 'Peace') : tl('diplomacy.settlementArmisticeKind', 'Armistice')}
              </p>
            </div>
          </div>
          {(allowBackdropClose || mode === 'propose') && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={onClose}
              className="text-white hover:text-red-400 transition-colors text-2xl font-bold px-3 py-2"
            >
              ✕
            </motion.button>
          )}
        </div>

        <div className={`flex items-center gap-3 border-b border-stone-800/60 bg-stone-950/80 ${mobile ? 'px-3 py-2' : 'px-5 py-3'}`}>
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/15">
            <CivEmblem
              primary={myCiv.color}
              secondary={myCiv.secondaryColor}
              variant={me}
              size={44}
              className="absolute inset-0 scale-105"
            />
          </div>
          <div className="text-xs text-gray-400 flex-1">
            <div className="text-white font-semibold">{myCiv.name}</div>
            {tl('diplomacy.settlementGoldHint', 'One-time gold tribute when the deal is accepted.')}
          </div>
        </div>

        <div className={`flex flex-col gap-4 overflow-y-auto ${mobile ? 'px-3 py-3' : 'px-5 py-4'}`}>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-sky-200/80">{tl('diplomacy.settlementYouPay', 'You pay (once)')}</span>
              <input
                type="number"
                min={0}
                max={MAX_SETTLEMENT_GOLD_PER_DIRECTION}
                value={iPay}
                onChange={e => setIPay(clampGold(Number(e.target.value) || 0))}
                className="rounded-lg border border-blue-900/50 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-emerald-200/80">{tl('diplomacy.settlementTheyPay', 'They pay you (once)')}</span>
              <input
                type="number"
                min={0}
                max={MAX_SETTLEMENT_GOLD_PER_DIRECTION}
                value={theyPayMe}
                onChange={e => setTheyPayMe(clampGold(Number(e.target.value) || 0))}
                className="rounded-lg border border-emerald-900/45 bg-black/40 px-2 py-1.5 text-sm text-white"
              />
            </label>
          </div>

          {kind === 'armistice' && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-amber-200/85">{tl('diplomacy.settlementArmisticeTurns', 'Armistice duration (turns)')}</span>
              <input
                type="number"
                min={ARMISTICE_DURATION_MIN_TURNS}
                max={ARMISTICE_DURATION_MAX_TURNS}
                value={armisticeTurns}
                onChange={e =>
                  setArmisticeTurns(
                    Math.max(ARMISTICE_DURATION_MIN_TURNS, Math.min(ARMISTICE_DURATION_MAX_TURNS, Math.round(Number(e.target.value) || ARMISTICE_DURATION_TURNS)))
                  )
                }
                className="rounded-lg border border-amber-900/45 bg-black/40 px-2 py-1.5 text-sm text-white max-w-[140px]"
              />
            </label>
          )}

          {mode === 'respond' && offer && (
            <p className="text-xs text-stone-500 border-t border-stone-800/60 pt-3">
              {t('diplomacy.settlementFromLine', {
                name: gameState.civilizations[offer.fromCiv]?.name ?? '',
              })}
            </p>
          )}
        </div>

        <div className={`flex flex-wrap gap-2 border-t border-stone-800/60 bg-stone-950/90 ${mobile ? 'px-3 py-3' : 'px-5 py-4'}`}>
          {mode === 'propose' ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePropose}
              className="flex-1 min-w-[120px] rounded-xl bg-blue-900/50 hover:bg-blue-800/60 border border-blue-700/50 py-2.5 text-sm font-bold text-white"
            >
              {tl('diplomacy.settlementSend', 'Send proposal')}
            </motion.button>
          ) : (
            <>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAccept}
                className="flex-1 min-w-[100px] rounded-xl bg-green-900/45 hover:bg-green-800/55 border border-green-700/45 py-2.5 text-sm font-bold text-green-200"
              >
                {tl('diplomacy.settlementAccept', 'Accept')} ({influenceActionCost('accept')} INF)
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReject}
                className="flex-1 min-w-[100px] rounded-xl bg-red-950/50 hover:bg-red-900/55 border border-red-800/45 py-2.5 text-sm font-bold text-red-200"
              >
                {tl('diplomacy.settlementReject', 'Reject')} ({influenceActionCost('reject')} INF)
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCounter}
                className="flex-1 min-w-[100px] rounded-xl bg-amber-950/45 hover:bg-amber-900/50 border border-amber-800/45 py-2.5 text-sm font-bold text-amber-100"
              >
                {tl('diplomacy.settlementCounter', 'Counter-offer')}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
