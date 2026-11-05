import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameState, YieldMap, TradeLot, DiplomaticOfferKind } from '../game/types';
import {
  applyIndependentPowerAction,
  declareWar,
  areAtWar,
  addTradeRoute,
  signTradeAgreement,
  cancelTradeRoute,
  cancelTradeAgreement,
  canDeclareWar,
  getTradeRouteBlockReason,
  formAlliance,
  leaveAlliance,
  isMilitarilyEngaged,
  applyInfluenceDiplomacyAction,
} from '../game/engine';
import { getInfluenceBalance, influenceActionCost } from '../game/systems/influenceDiplomacyCore';
import { getIndependentActionCost } from '../game/systems/independentPowersCore';
import { isVictoryTypeUnlockedForAge } from '../game/systems/victoryRulesCore';
import {
  ERA_LABELS,
  DIPLOMACY_VICTORY_POINTS_REQUIRED,
  TRADE_ROUTE_MAX_HEX_DISTANCE,
  MAX_TRADE_ROUTES_PER_PAIR,
  ALLIANCE_MIN_DIPLOMATIC_FAVOR,
} from '../game/constants';
import { getCultureVictoryDominantCount } from '../game/featureSystems';
import {
  GnozianGlyph,
  GnozianPanelCorners,
  CivEmblem,
  type GnozianGlyphName,
  GnzModalFrame,
  GnzAppModalLayout,
  GnzNavRailBtn,
} from './ui';
import { DealWindow, TradeRouteWindow } from './DiplomacyTradeWindows';
import { t } from '../i18n';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';
import DiplomaticSettlementModal from './DiplomaticSettlementModal';
import { bothCivsUnlocked, progressionLockReason } from '../game/progressionLocks';
import { computeMapDiscoveredCivIndices } from '../game/mapDiscovery';

interface Props {
  gameState: GameState;
  onClose: () => void;
  onUpdateState: (state: GameState) => void;
}

export default function DiplomacyPanel({ gameState, onClose, onUpdateState }: Props) {
  const me = useLocalPlayerCivIndex();
  const humanCiv = gameState.civilizations[me] ?? gameState.civilizations[0]!;
  const discoveredCivs = useMemo(() => computeMapDiscoveredCivIndices(gameState, me), [gameState, me]);
  const otherAliveRivalSlots = gameState.civilizations.some((c, i) => i !== me && c.isAlive);
  const [confirmWar, setConfirmWar] = useState<number | null>(null);
  const [tradeRouteGold, setTradeRouteGold] = useState(4);
  const [tradeRouteRiskPct, setTradeRouteRiskPct] = useState(12);
  const [dealGoldAtoB, setDealGoldAtoB] = useState(3);
  const [dealGoldBtoA, setDealGoldBtoA] = useState(3);
  const [dealTurns, setDealTurns] = useState(25);
  const [tradeRouteModalCiv, setTradeRouteModalCiv] = useState<number | null>(null);
  const [dealModalCiv, setDealModalCiv] = useState<number | null>(null);
  const [dealResAtoB, setDealResAtoB] = useState<keyof Pick<YieldMap, 'food' | 'science' | 'culture' | 'faith' | 'happiness'>>('science');
  const [dealResBtoA, setDealResBtoA] = useState<keyof Pick<YieldMap, 'food' | 'science' | 'culture' | 'faith' | 'happiness'>>('culture');
  const [dealResAmtAtoB, setDealResAmtAtoB] = useState(0);
  const [dealResAmtBtoA, setDealResAmtBtoA] = useState(0);
  const [tradeLotsAtoB, setTradeLotsAtoB] = useState<TradeLot[]>([]);
  const [tradeLotsBtoA, setTradeLotsBtoA] = useState<TradeLot[]>([]);
  const [dealLotsAtoB, setDealLotsAtoB] = useState<TradeLot[]>([]);
  const [dealLotsBtoA, setDealLotsBtoA] = useState<TradeLot[]>([]);
  const [settlementDraft, setSettlementDraft] = useState<{ civIndex: number; kind: DiplomaticOfferKind } | null>(null);
  const partnerCivIndices = useMemo(
    () =>
      gameState.civilizations
        .map((c, i) => (i !== me && c.isAlive && discoveredCivs.has(i) ? i : -1))
        .filter((i): i is number => i >= 0),
    [gameState.civilizations, me, discoveredCivs]
  );
  const [selectedDiploCivIndex, setSelectedDiploCivIndex] = useState<number | null>(null);

  useEffect(() => {
    if (partnerCivIndices.length === 0) {
      if (selectedDiploCivIndex !== null) setSelectedDiploCivIndex(null);
    } else if (partnerCivIndices.length === 1) {
      const only = partnerCivIndices[0]!;
      if (selectedDiploCivIndex !== only) setSelectedDiploCivIndex(only);
    } else if (selectedDiploCivIndex != null && !partnerCivIndices.includes(selectedDiploCivIndex)) {
      setSelectedDiploCivIndex(null);
    }
  }, [partnerCivIndices, selectedDiploCivIndex]);

  const getRelation = (civIndex: number) => {
    const rel = gameState.relations.find(r =>
      (r.civA === me && r.civB === civIndex) || (r.civA === civIndex && r.civB === me)
    );
    return (rel?.status ?? 'neutral') as string;
  };

  const myInfluence = getInfluenceBalance(gameState, me);
  const canUseAdvancedDiplomacyWith = (civIndex: number) =>
    bothCivsUnlocked(gameState, me, civIndex, 'advanced_diplomacy');
  const canUseTradeRoutesWith = (civIndex: number) =>
    bothCivsUnlocked(gameState, me, civIndex, 'trade_routes');
  const canUseDealsWith = (civIndex: number) =>
    bothCivsUnlocked(gameState, me, civIndex, 'diplomatic_deals');

  const handleInfluenceAction = (
    toCiv: number,
    action: 'support' | 'sanction' | 'endeavor' | 'treaty'
  ) => {
    if (!canUseAdvancedDiplomacyWith(toCiv)) return;
    onUpdateState(applyInfluenceDiplomacyAction(gameState, me, toCiv, action));
  };

  const handleIndependentPowerAction = (
    powerId: number,
    action: 'incite_raid' | 'levy' | 'upgrade_city_state',
    targetCiv?: number
  ) => {
    onUpdateState(applyIndependentPowerAction(gameState, me, powerId, action, { targetCiv }));
  };

  const handleDeclareWar = (civIndex: number) => {
    if (!canDeclareWar(gameState, me, civIndex)) return;
    if (confirmWar === civIndex) {
      onUpdateState(declareWar(gameState, me, civIndex));
      setConfirmWar(null);
    } else {
      setConfirmWar(civIndex);
      setTimeout(() => setConfirmWar(null), 3000);
    }
  };

  const handleCreateTradeRoute = (civIndex: number, lotsAtoB: TradeLot[], lotsBtoA: TradeLot[]) => {
    const capId = gameState.civilizations[me]?.capital ?? null;
    const cap = capId == null ? null : gameState.cities.find(c => c.id === capId);
    const merchant = gameState.units
      .filter(u => u.owner === me && u.type === 'great_merchant' && u.movement > 0)
      .sort((a, b) => {
        const da = cap ? Math.abs(a.q - cap.q) + Math.abs(a.r - cap.r) : 0;
        const db = cap ? Math.abs(b.q - cap.q) + Math.abs(b.r - cap.r) : 0;
        return da - db;
      })[0];
    onUpdateState(
      addTradeRoute(gameState, me, civIndex, {
        goldPerTurn: tradeRouteGold,
        risk: tradeRouteRiskPct / 100,
        lotsAtoB,
        lotsBtoA,
        merchantUnitId: merchant?.id,
      })
    );
  };

  const handleSignDeal = (civIndex: number, lotsAtoB: TradeLot[], lotsBtoA: TradeLot[]) => {
    const transferAtoB = { [dealResAtoB]: dealResAmtAtoB };
    const transferBtoA = { [dealResBtoA]: dealResAmtBtoA };
    onUpdateState(
      signTradeAgreement(gameState, me, civIndex, {
        goldPerTurnAtoB: dealGoldAtoB,
        goldPerTurnBtoA: dealGoldBtoA,
        turnsLeft: dealTurns,
        transferAtoB,
        transferBtoA,
        lotsAtoB,
        lotsBtoA,
      })
    );
  };

  const STATUS_COLORS: Record<string, string> = {
    peace: 'text-green-400',
    war: 'text-red-400',
    alliance: 'text-blue-400',
    neutral: 'text-gray-400',
    armistice: 'text-amber-300',
  };
  const STATUS_BG: Record<string, string> = {
    peace: 'bg-green-900/30 border-green-800/40',
    war: 'bg-red-900/30 border-red-800/40',
    alliance: 'bg-blue-900/30 border-blue-800/40',
    neutral: 'bg-stone-800/50 border-stone-700/40',
    armistice: 'bg-amber-950/40 border-amber-800/45',
  };
  const STATUS_GLYPH: Record<string, GnozianGlyphName> = {
    peace: 'sun',
    war: 'swords',
    alliance: 'handshake',
    neutral: 'info',
    armistice: 'sun',
  };

  const multiDiploPartners = partnerCivIndices.length > 1;
  const showDiploPartnerList = multiDiploPartners && selectedDiploCivIndex === null;

  const renderPartnerDetail = (civIndex: number, animIdx: number) => {
    const civ = gameState.civilizations[civIndex];
    if (!civ?.isAlive) return null;
    const status = getRelation(civIndex);
    const atWar = areAtWar(gameState, me, civIndex);
    const armistice = !atWar && isMilitarilyEngaged(gameState, me, civIndex);
    const warRel = gameState.relations.find(
      r => (r.civA === me && r.civB === civIndex) || (r.civA === civIndex && r.civB === me)
    );
    const isConfirming = confirmWar === civIndex;
    const allowWar = canDeclareWar(gameState, me, civIndex);
    const lo = Math.min(me, civIndex);
    const hi = Math.max(me, civIndex);
    const routesBetween = gameState.tradeRoutes?.filter(tr => tr.civA === lo && tr.civB === hi) ?? [];
    const agreementsBetween = gameState.tradeAgreements?.filter(ag => ag.civA === lo && ag.civB === hi) ?? [];
    const allied = warRel?.status === 'alliance';
    const trust = Math.round(warRel?.trust ?? 0);
    const grievances = Math.round(warRel?.grievances ?? 0);
    const advancedDiplomacyUnlocked = canUseAdvancedDiplomacyWith(civIndex);
    const tradeRoutesUnlocked = canUseTradeRoutesWith(civIndex);
    const dealsUnlocked = canUseDealsWith(civIndex);
    const canFormAlliance =
      !atWar &&
      !armistice &&
      !allied &&
      advancedDiplomacyUnlocked &&
      bothCivsUnlocked(gameState, me, civIndex, 'alliances') &&
      humanCiv.diplomaticFavor >= ALLIANCE_MIN_DIPLOMATIC_FAVOR &&
      civ.diplomaticFavor >= ALLIANCE_MIN_DIPLOMATIC_FAVOR;

    return (
      <motion.div
        key={`${civ.id}-${civIndex}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animIdx * 0.05 }}
        className={`rounded-xl border p-4 ${STATUS_BG[status]}`}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 shadow-lg"
            style={{ borderColor: civ.color }}
          >
            <CivEmblem
              primary={civ.color}
              secondary={civ.secondaryColor}
              variant={civIndex}
              size={48}
              className="absolute inset-0 scale-105 opacity-90"
            />
            <GnozianGlyph
              name={atWar ? 'swords' : armistice ? 'sun' : 'user'}
              size={22}
              className="relative z-10 text-white drop-shadow-md"
            />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-white">{civ.name}</div>
            <div className="text-sm text-gray-400">
              {civ.leader} • {ERA_LABELS[civ.era]} • {t('diplomacy.score')}: {civ.score}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <GnozianGlyph name={STATUS_GLYPH[status] ?? 'info'} size={14} className="text-stone-300" />
              <span className={`text-sm font-bold ${STATUS_COLORS[status]}`}>{t(`status.${status}`)}</span>
              {atWar && warRel && (
                <span className="ml-1 text-xs text-red-400">
                  ({t('diplomacy.turnsAtWar', { turns: warRel.turnsAtWar })})
                </span>
              )}
              {armistice && warRel && (
                <span className="ml-1 text-xs text-amber-300/95">
                  ({t('diplomacy.armisticeUntil', { turn: warRel.armisticeUntilTurn })})
                </span>
              )}
            </div>
          </div>
          <div className="space-y-0.5 text-right text-xs">
            <div className="text-gray-400">
              {t('diplomacy.cities')}: {civ.cities.length}
            </div>
            <div className="text-gray-400">
              {t('diplomacy.units')}: {civ.units.length}
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-stone-700/30 bg-stone-900/60 p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-bold text-blue-400">
              <GnozianGlyph name="flask" size={13} className="text-sky-300/90" />
              {Math.round(civ.resources.science)}/t
            </div>
            <div className="text-[10px] text-gray-500">{t('diplomacy.science')}</div>
          </div>
          <div className="rounded-lg border border-stone-700/30 bg-stone-900/60 p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-bold text-yellow-400">
              <GnozianGlyph name="trophy" size={13} className="text-yellow-300/90" />
              {Math.round(civ.resources.gold)}
            </div>
            <div className="text-[10px] text-gray-500">{t('diplomacy.gold')}</div>
          </div>
          <div className="rounded-lg border border-stone-700/30 bg-stone-900/60 p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-sm font-bold text-purple-400">
              <GnozianGlyph name="culture" size={13} className="text-purple-300/90" />
              {Math.round(civ.resources.culture)}/t
            </div>
            <div className="text-[10px] text-gray-500">{t('diplomacy.culture')}</div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-stone-700/40 bg-stone-900/50 p-2 text-center">
            <div className="text-[10px] uppercase text-stone-500">{t('diplomacy.trust')}</div>
            <div className={`text-sm font-bold tabular-nums ${trust >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {trust}
            </div>
          </div>
          <div className="rounded-lg border border-stone-700/40 bg-stone-900/50 p-2 text-center">
            <div className="text-[10px] uppercase text-stone-500">{t('diplomacy.grievances')}</div>
            <div className="text-sm font-bold tabular-nums text-amber-300">{grievances}</div>
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-cyan-900/35 bg-cyan-950/15 px-2.5 py-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-cyan-400/90">
            {t('diplomacy.influenceProtocol')}
          </div>
          <div className="mb-2 text-[11px] text-cyan-100/80">
            {t('diplomacy.infAbbr')}: {myInfluence} · {t('diplomacy.trust')}: {trust}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'support' as const, label: t('diplomacy.action.support'), color: 'bg-cyan-900/45 border-cyan-800/40 text-cyan-200' },
                { key: 'sanction' as const, label: t('diplomacy.action.sanction'), color: 'bg-red-900/35 border-red-800/40 text-red-200' },
                { key: 'endeavor' as const, label: t('diplomacy.action.endeavor'), color: 'bg-emerald-900/35 border-emerald-800/40 text-emerald-200' },
                { key: 'treaty' as const, label: t('diplomacy.action.treaty'), color: 'bg-blue-900/35 border-blue-800/45 text-blue-200' },
              ] as const
            ).map(a => {
              const cost = influenceActionCost(a.key);
              const enabled = advancedDiplomacyUnlocked && myInfluence >= cost;
              return (
                <button
                  key={`${civIndex}-${a.key}`}
                  type="button"
                  disabled={!enabled}
                  title={!advancedDiplomacyUnlocked ? progressionLockReason('advanced_diplomacy') : undefined}
                  onClick={() => handleInfluenceAction(civIndex, a.key)}
                  className={`rounded border px-2 py-1 text-[10px] font-semibold transition ${
                    enabled
                      ? `${a.color} hover:brightness-110`
                      : 'cursor-not-allowed border-stone-700/40 bg-stone-900/45 text-stone-500 opacity-60'
                  }`}
                >
                  {a.label} ({cost})
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3 text-xs text-gray-400">
          {t('diplomacy.technologies')}: {civ.researchedTechs.length} •
          {civ.currentResearch
            ? ` ${t('diplomacy.researching')}: ${civ.currentResearch}`
            : ` ${t('diplomacy.noResearch')}`}
        </div>

        <div className="mb-3 rounded-lg border border-yellow-900/25 bg-yellow-950/15 px-2.5 py-2 text-[11px] text-yellow-100/90">
          <div className="mb-1 font-bold uppercase tracking-wide text-yellow-500/90">{t('diplomacy.tradeRoutesSection')}</div>
          <p className="mb-1.5 leading-snug text-yellow-200/50">
            {t('diplomacy.tradeRoutesHint', { max: String(TRADE_ROUTE_MAX_HEX_DISTANCE), cap: String(MAX_TRADE_ROUTES_PER_PAIR) })}
          </p>
          {routesBetween.length === 0 ? (
            <div className="text-stone-500">{t('diplomacy.noTradeRoutes')}</div>
          ) : (
            <ul className="space-y-0.5">
              {routesBetween.map(tr => {
                const a = gameState.cities.find(c => c.id === tr.fromCityId)?.name ?? '?';
                const b = gameState.cities.find(c => c.id === tr.toCityId)?.name ?? '?';
                return (
                  <li key={tr.id} className="tabular-nums">
                    {a} ↔ {b}: +{tr.goldPerTurn} {t('diplomacy.goldPerTurnAbbr')} · {tr.turnsEstablished}{' '}
                    {t('diplomacy.turnsEstablishedAbbr')} · {t('diplomacy.riskPct', { pct: Math.round((tr.risk ?? 0) * 100) })}
                  </li>
                );
              })}
            </ul>
          )}
          {agreementsBetween.length > 0 && (
            <div className="mt-2 border-t border-yellow-900/30 pt-1.5 text-[11px] text-emerald-200/90">
              {agreementsBetween.map(ag => (
                <div key={ag.id}>
                  {t('diplomacy.dealLine', { id: ag.id, a: ag.goldPerTurnAtoB, b: ag.goldPerTurnBtoA, turns: ag.turnsLeft })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {!atWar && !allowWar && warRel && (
            <div className="text-[10px] text-amber-400/90">
              {t('diplomacy.treatyNoWarUntil', { turn: warRel.peaceLockedUntilTurn })}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {atWar ? (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-900/25 bg-yellow-950/10 px-2 py-1 text-[10px] text-yellow-200/80">
                  <label className="inline-flex items-center gap-1">
                    <span>{t('diplomacy.routeGold')}</span>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={tradeRouteGold}
                      onChange={e => setTradeRouteGold(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
                      className="w-12 rounded border border-yellow-800/35 bg-black/35 px-1 py-0.5 text-[10px] text-yellow-100"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <span>{t('diplomacy.routeRisk')}</span>
                    <input
                      type="number"
                      min={2}
                      max={90}
                      value={tradeRouteRiskPct}
                      onChange={e => setTradeRouteRiskPct(Math.max(2, Math.min(90, Number(e.target.value) || 2)))}
                      className="w-12 rounded border border-yellow-800/35 bg-black/35 px-1 py-0.5 text-[10px] text-yellow-100"
                    />
                  </label>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => advancedDiplomacyUnlocked && setSettlementDraft({ civIndex, kind: 'peace' })}
                  disabled={!advancedDiplomacyUnlocked}
                  title={!advancedDiplomacyUnlocked ? progressionLockReason('advanced_diplomacy') : undefined}
                  className={`min-w-0 flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                    advancedDiplomacyUnlocked
                      ? 'border-green-800/50 bg-green-900/40 text-green-300 hover:bg-green-800/60'
                      : 'cursor-not-allowed border-green-900/30 bg-green-950/25 text-green-700 opacity-50'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <GnozianGlyph name="sun" size={13} /> {t('diplomacy.negotiatePeace')}
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => advancedDiplomacyUnlocked && setSettlementDraft({ civIndex, kind: 'armistice' })}
                  disabled={!advancedDiplomacyUnlocked}
                  title={!advancedDiplomacyUnlocked ? progressionLockReason('advanced_diplomacy') : undefined}
                  className={`min-w-0 flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                    advancedDiplomacyUnlocked
                      ? 'border-amber-700/45 bg-amber-900/35 text-amber-100 hover:bg-amber-800/50'
                      : 'cursor-not-allowed border-amber-900/30 bg-amber-950/25 text-amber-700 opacity-50'
                  }`}
                  type="button"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <GnozianGlyph name="sun" size={13} /> {t('diplomacy.negotiateArmistice')}
                  </span>
                </motion.button>
              </>
            ) : armistice ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => advancedDiplomacyUnlocked && setSettlementDraft({ civIndex, kind: 'peace' })}
                disabled={!advancedDiplomacyUnlocked}
                title={!advancedDiplomacyUnlocked ? progressionLockReason('advanced_diplomacy') : undefined}
                className={`w-full rounded-lg border py-2 text-xs font-bold transition-all ${
                  advancedDiplomacyUnlocked
                    ? 'border-green-800/50 bg-green-900/40 text-green-300 hover:bg-green-800/60'
                    : 'cursor-not-allowed border-green-900/30 bg-green-950/25 text-green-700 opacity-50'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-1">
                  <GnozianGlyph name="sun" size={13} /> {t('diplomacy.negotiatePeace')}
                </span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={allowWar && !allied ? { scale: 1.02 } : {}}
                whileTap={allowWar && !allied ? { scale: 0.98 } : {}}
                onClick={() => handleDeclareWar(civIndex)}
                disabled={!allowWar || allied}
                title={allied ? t('diplomacy.leaveAllianceFirst') : undefined}
                className={`min-w-0 flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                  !allowWar || allied
                    ? 'cursor-not-allowed border-red-900/30 bg-red-950/30 text-red-500 opacity-40'
                    : isConfirming
                      ? 'animate-pulse border-red-500 bg-red-700 text-white'
                      : 'border-red-800/50 bg-red-900/40 text-red-300 hover:bg-red-800/60'
                }`}
              >
                {isConfirming ? (
                  <span className="inline-flex items-center justify-center gap-1">
                    <GnozianGlyph name="warn" size={13} /> {t('diplomacy.warConfirm')}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1">
                    <GnozianGlyph name="swords" size={13} /> {t('diplomacy.declareWar')}
                  </span>
                )}
              </motion.button>
            )}
            {allied ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onUpdateState(leaveAlliance(gameState, me, civIndex));
                }}
                className="rounded-lg border border-slate-600/50 bg-slate-800/80 px-4 py-2 text-xs text-slate-200 hover:bg-slate-700/90"
                type="button"
              >
                <span className="inline-flex items-center justify-center gap-1">
                  <GnozianGlyph name="handshake" size={13} /> {t('diplomacy.leaveAlliance')}
                </span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={canFormAlliance ? { scale: 1.02 } : {}}
                whileTap={canFormAlliance ? { scale: 0.98 } : {}}
                onClick={() => {
                  if (canFormAlliance) {
                    onUpdateState(formAlliance(gameState, me, civIndex));
                  }
                }}
                disabled={!canFormAlliance}
                title={
                  canFormAlliance
                    ? t('diplomacy.formAllianceTitle')
                    : !bothCivsUnlocked(gameState, me, civIndex, 'alliances')
                      ? progressionLockReason('alliances')
                      : t('diplomacy.formAllianceBlocked', { n: String(ALLIANCE_MIN_DIPLOMATIC_FAVOR) })
                }
                className={`rounded-lg border border-blue-800/40 px-4 py-2 text-xs ${
                  canFormAlliance
                    ? 'cursor-pointer bg-blue-900/40 text-blue-100 hover:bg-blue-800/55'
                    : 'cursor-not-allowed bg-blue-950/20 text-blue-700 opacity-55'
                }`}
                type="button"
              >
                <span className="inline-flex items-center justify-center gap-1">
                  <GnozianGlyph name="handshake" size={13} /> {t('diplomacy.formAlliance')}
                </span>
              </motion.button>
            )}
            {!atWar ? (
              <>
                <motion.button
                  whileHover={tradeRoutesUnlocked ? { scale: 1.02 } : {}}
                  whileTap={tradeRoutesUnlocked ? { scale: 0.98 } : {}}
                  onClick={() => tradeRoutesUnlocked && setTradeRouteModalCiv(civIndex)}
                  disabled={!tradeRoutesUnlocked}
                  title={!tradeRoutesUnlocked ? progressionLockReason('trade_routes') : undefined}
                  className={`rounded-lg border px-4 py-2 text-xs ${
                    tradeRoutesUnlocked
                      ? 'cursor-pointer border-yellow-700/50 bg-yellow-900/40 text-yellow-200 hover:bg-yellow-800/50'
                      : 'cursor-not-allowed border-yellow-900/30 bg-yellow-950/20 text-yellow-700 opacity-50'
                  }`}
                  type="button"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <GnozianGlyph name="trophy" size={13} /> {t('diplomacy.trade')}
                  </span>
                </motion.button>
                <motion.button
                  whileHover={dealsUnlocked ? { scale: 1.02 } : {}}
                  whileTap={dealsUnlocked ? { scale: 0.98 } : {}}
                  onClick={() => dealsUnlocked && setDealModalCiv(civIndex)}
                  disabled={!dealsUnlocked}
                  title={!dealsUnlocked ? progressionLockReason('diplomatic_deals') : undefined}
                  className={`rounded-lg border px-4 py-2 text-xs ${
                    dealsUnlocked
                      ? 'border-emerald-700/50 bg-emerald-900/35 text-emerald-200 hover:bg-emerald-800/45'
                      : 'cursor-not-allowed border-emerald-900/30 bg-emerald-950/20 text-emerald-700 opacity-50'
                  }`}
                  type="button"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <GnozianGlyph name="handshake" size={13} /> {t('diplomacy.deal')}
                  </span>
                </motion.button>
              </>
            ) : (
              <button
                type="button"
                className="cursor-not-allowed rounded-lg border border-yellow-800/30 bg-yellow-900/20 px-4 py-2 text-xs text-yellow-600 opacity-50"
                disabled
              >
                <span className="inline-flex items-center justify-center gap-1 opacity-80">
                  <GnozianGlyph name="trophy" size={13} /> {t('diplomacy.trade')}
                </span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <>
    <GnzModalFrame maxWidthClass="max-w-4xl" ornament onBackdropClick={onClose} className="max-h-[92vh]">
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 250 }}
        className="flex max-h-[inherit] min-h-0 w-full flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <GnozianPanelCorners inset={5} size={36} />
        <div className="relative z-10 flex items-center justify-between border-b border-stone-700 bg-gradient-to-r from-gray-800 to-gray-900 p-5">
          <div className="flex items-center gap-3">
            <GnozianGlyph name="globe" size={28} className="text-amber-300/90" />
            <div>
              <h2 className="text-white font-bold text-xl">{t('diplomacy.title')}</h2>
              <p className="text-gray-400 text-sm">{t('diplomacy.subtitle')}</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl px-3 py-1 transition-colors"
          >✕</motion.button>
        </div>

        {/* Human civ info */}
        <div className="relative z-10 border-b border-stone-700 bg-stone-800/50 p-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg ring-2 ring-white/20">
              <CivEmblem
                primary={humanCiv.color}
                secondary={humanCiv.secondaryColor}
                variant={me}
                size={48}
                className="absolute inset-0 scale-105"
              />
              <GnozianGlyph name="crown" size={24} className="relative z-10 text-white drop-shadow-md" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-lg">{humanCiv.name}</div>
              <div className="text-sm text-gray-400">
                {t('diplomacy.leader')}: {humanCiv.leader} • {t('diplomacy.era')}: {ERA_LABELS[humanCiv.era]} • {t('diplomacy.score')}: {humanCiv.score}
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold text-yellow-400">
                <GnozianGlyph name="trophy" size={14} className="text-yellow-300/90" />
                {Math.round(humanCiv.resources.gold)}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-blue-400">
                <GnozianGlyph name="flask" size={14} className="text-sky-300/90" />
                {Math.round(humanCiv.resources.science)}/t
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-purple-400">
                <GnozianGlyph name="culture" size={14} className="text-purple-300/90" />
                {Math.round(humanCiv.resources.culture)}/t
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-cyan-300">
                <GnozianGlyph name="globe" size={14} className="text-cyan-300/90" />
                {myInfluence} INF
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <GnzAppModalLayout
            header={
              <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-stone-700 bg-stone-900/40 px-4 py-2.5">
                {multiDiploPartners && selectedDiploCivIndex !== null && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => {
                      setConfirmWar(null);
                      setSelectedDiploCivIndex(null);
                    }}
                    className="rounded-lg border border-stone-600/50 bg-stone-800/80 px-2.5 py-1 text-[11px] font-semibold text-stone-200 hover:bg-stone-700/90 lg:hidden"
                  >
                    ← {t('diplomacy.backToPartners')}
                  </motion.button>
                )}
                <div className="min-w-0 text-xs font-bold uppercase tracking-wide text-stone-400">
                  {showDiploPartnerList
                    ? t('diplomacy.partnerListTitle')
                    : selectedDiploCivIndex != null
                      ? t('diplomacy.relationsActionsTitle')
                      : ''}
                </div>
              </div>
            }
            navRail={
              multiDiploPartners && selectedDiploCivIndex !== null ? (
                <>
                  <GnzNavRailBtn
                    active={false}
                    onClick={() => {
                      setConfirmWar(null);
                      setSelectedDiploCivIndex(null);
                    }}
                    icon={<GnozianGlyph name="compass" size={16} className="text-cyan-300/85" />}
                  >
                    {t('diplomacy.backToPartners')}
                  </GnzNavRailBtn>
                  {partnerCivIndices.map(civIndex => {
                    const civ = gameState.civilizations[civIndex];
                    if (!civ) return null;
                    const st = getRelation(civIndex);
                    return (
                      <GnzNavRailBtn
                        key={civIndex}
                        active={selectedDiploCivIndex === civIndex}
                        onClick={() => {
                          setConfirmWar(null);
                          setSelectedDiploCivIndex(civIndex);
                        }}
                        icon={
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15">
                            <CivEmblem
                              primary={civ.color}
                              secondary={civ.secondaryColor}
                              variant={civIndex}
                              size={28}
                              className="scale-110"
                            />
                          </span>
                        }
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate">{civ.name}</span>
                          <span className={`truncate text-[10px] font-semibold ${STATUS_COLORS[st] ?? 'text-stone-500'}`}>
                            {t(`status.${st}`)}
                          </span>
                        </span>
                      </GnzNavRailBtn>
                    );
                  })}
                </>
              ) : undefined
            }
            mainClassName="space-y-3 bg-stone-950/20 p-4"
            footer={
              <div className="relative z-10 max-h-[38vh] shrink-0 overflow-y-auto border-t border-stone-700">
                <div className="bg-stone-800/40 p-5">
                  <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                    {t('diplomacy.victoryProgress')}
                  </div>
                  <div className="mb-2 text-xs text-gray-500">
                    {t('diplomacy.diplomaticFavor')}:{' '}
                    <span className="font-semibold text-emerald-300">{Math.round(humanCiv.diplomaticFavor)}</span>
                    {' · '}
                    {t('diplomacy.dvp')}:{' '}
                    <span className="font-semibold text-emerald-300">
                      {humanCiv.diplomaticVictoryPoints}/{DIPLOMACY_VICTORY_POINTS_REQUIRED}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(() => {
                      const aliveRivals = gameState.civilizations.filter((c, i) => i !== me && c.isAlive).length;
                      const dom = getCultureVictoryDominantCount(gameState, me);
                      const age = gameState.age?.currentAge ?? 'antiquity';
                      const culturePct = isVictoryTypeUnlockedForAge(age, 'culture')
                        ? aliveRivals <= 0
                          ? 0
                          : Math.min(100, Math.round((dom / aliveRivals) * 100))
                        : 0;
                      const diploPct = isVictoryTypeUnlockedForAge(age, 'diplomacy')
                        ? Math.min(
                            100,
                            Math.round((humanCiv.diplomaticVictoryPoints / DIPLOMACY_VICTORY_POINTS_REQUIRED) * 100)
                          )
                        : 0;
                      return [
                        {
                          key: 'sci',
                          glyph: 'rocket' as const,
                          text: t('diplomacy.victoryScience'),
                          value: isVictoryTypeUnlockedForAge(age, 'science') ? Math.min(100, humanCiv.scienceVictoryProgress) : 0,
                          color: 'bg-blue-500',
                        },
                        {
                          key: 'cul',
                          glyph: 'culture' as const,
                          text: t('diplomacy.victoryCulture'),
                          value: culturePct,
                          color: 'bg-purple-500',
                        },
                        {
                          key: 'dom',
                          glyph: 'swords' as const,
                          text: t('diplomacy.victoryDomination'),
                          value: Math.min(100, (humanCiv.cities.length / Math.max(1, gameState.cities.length)) * 100),
                          color: 'bg-red-500',
                        },
                        {
                          key: 'dip',
                          glyph: 'globe' as const,
                          text: t('diplomacy.victoryDiplomacy'),
                          value: diploPct,
                          color: 'bg-green-500',
                        },
                      ];
                    })().map(item => (
                      <div key={item.key} className="rounded-lg border border-stone-700/30 bg-stone-700/40 p-2.5">
                        <div className="mb-1.5 flex justify-between text-xs">
                          <span className="flex items-center gap-1 font-medium text-gray-300">
                            <GnozianGlyph name={item.glyph} size={12} className="text-amber-200/80" />
                            {item.text}
                          </span>
                          <span className="tabular-nums text-gray-400">{Math.round(item.value)}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-600/50">
                          <motion.div
                            className={`${item.color} h-full rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.value}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-stone-700 bg-stone-900/35 p-5">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300/85">
                    {t('diplomacy.independentPowersTitle')}
                  </div>
                  {(gameState.systems.independentPowers ?? []).length === 0 ? (
                    <div className="text-xs text-stone-500">{t('diplomacy.independentPowersEmpty')}</div>
                  ) : (
                    <div className="space-y-2">
                      {(gameState.systems.independentPowers ?? []).map(p => {
                        const myStance = p.relations?.[me] ?? 'neutral';
                        const raidCost = getIndependentActionCost('incite_raid');
                        const levyCost = getIndependentActionCost('levy');
                        const upgradeCost = getIndependentActionCost('upgrade_city_state');
                        const raidTargetIndex = gameState.civilizations.findIndex((c, idx) => idx !== me && c.isAlive);
                        return (
                          <div key={`ip-${p.id}`} className="rounded-lg border border-cyan-900/30 bg-cyan-950/10 p-2.5">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-cyan-100">
                                {p.name.replace(/Independent (\d+)/, (_, id) => t('diplomacy.independent', { id }))} ·{' '}
                                {t(`diplomacy.${p.tier}`)}
                              </div>
                              <div className="text-[11px] text-stone-400">
                                ({p.q}, {p.r}) · STR {p.strength} · {t(`diplomacy.${myStance}`)}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={myInfluence < levyCost}
                                onClick={() => handleIndependentPowerAction(p.id, 'levy')}
                                className="rounded border border-emerald-800/45 bg-emerald-900/30 px-2 py-1 text-[10px] font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {t('diplomacy.ipLevy', { cost: levyCost })}
                              </button>
                              <button
                                type="button"
                                disabled={myInfluence < upgradeCost || p.tier === 'city_state'}
                                onClick={() => handleIndependentPowerAction(p.id, 'upgrade_city_state')}
                                className="rounded border border-blue-800/45 bg-blue-900/30 px-2 py-1 text-[10px] font-semibold text-blue-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {t('diplomacy.ipUpgrade', { cost: upgradeCost })}
                              </button>
                              <button
                                type="button"
                                disabled={myInfluence < raidCost || raidTargetIndex < 0}
                                onClick={() => handleIndependentPowerAction(p.id, 'incite_raid', raidTargetIndex)}
                                className="rounded border border-rose-800/45 bg-rose-900/30 px-2 py-1 text-[10px] font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {t('diplomacy.ipInciteRaid', { cost: raidCost })}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            }
          >
            {partnerCivIndices.length === 0 && (
              <div className="py-10 text-center text-gray-500">
                <div className="mb-2 flex justify-center">
                  <GnozianGlyph name="compass" size={40} className="text-stone-500" />
                </div>
                <div>{otherAliveRivalSlots ? t('diplomacy.noCivs') : t('diplomacy.noRivalsOnMap')}</div>
              </div>
            )}
            {showDiploPartnerList &&
              partnerCivIndices.map((civIndex, idx) => {
                const civ = gameState.civilizations[civIndex];
                if (!civ) return null;
                const status = getRelation(civIndex);
                const atWar = areAtWar(gameState, me, civIndex);
                const armistice = !atWar && isMilitarilyEngaged(gameState, me, civIndex);
                const warRel = gameState.relations.find(
                  r => (r.civA === me && r.civB === civIndex) || (r.civA === civIndex && r.civB === me)
                );
                return (
                  <motion.button
                    key={civIndex}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => {
                      setConfirmWar(null);
                      setSelectedDiploCivIndex(civIndex);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:brightness-110 ${STATUS_BG[status]}`}
                  >
                    <div
                      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 shadow-md"
                      style={{ borderColor: civ.color }}
                    >
                      <CivEmblem
                        primary={civ.color}
                        secondary={civ.secondaryColor}
                        variant={civIndex}
                        size={44}
                        className="absolute inset-0 scale-105 opacity-90"
                      />
                      <GnozianGlyph
                        name={atWar ? 'swords' : armistice ? 'sun' : 'user'}
                        size={18}
                        className="relative z-10 text-white drop-shadow-md"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-white">{civ.name}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                        <GnozianGlyph name={STATUS_GLYPH[status] ?? 'info'} size={12} />
                        <span className={`font-semibold ${STATUS_COLORS[status]}`}>{t(`status.${status}`)}</span>
                        <span className="text-stone-500">·</span>
                        <span>
                          {t('diplomacy.score')}: {civ.score}
                        </span>
                        {atWar && warRel && (
                          <span className="text-red-400/90">({t('diplomacy.turnsAtWar', { turns: warRel.turnsAtWar })})</span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg border border-amber-500/35 bg-amber-950/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100/95">
                      {t('diplomacy.openRelations')}
                    </span>
                  </motion.button>
                );
              })}
            {selectedDiploCivIndex != null &&
              renderPartnerDetail(selectedDiploCivIndex, partnerCivIndices.indexOf(selectedDiploCivIndex))}
          </GnzAppModalLayout>
        </div>
      </motion.div>
    </GnzModalFrame>

      <AnimatePresence>
        {tradeRouteModalCiv !== null && (() => {
          const atWar = areAtWar(gameState, me, tradeRouteModalCiv);
          const hasMerchant = gameState.units.some(
            u =>
              u.owner === me &&
              u.type === 'great_merchant' &&
              u.movement > 0 &&
              gameState.civilizations[me]?.capital != null &&
              (() => {
                const cap = gameState.cities.find(c => c.id === gameState.civilizations[me]!.capital);
                if (!cap) return false;
                return Math.abs(u.q - cap.q) + Math.abs(u.r - cap.r) <= 3;
              })()
          );
          const baseBlockReason = atWar ? t('diplomacy.tradeBlockedWar') : getTradeRouteBlockReason(gameState, me, tradeRouteModalCiv);
          let tradeBlockReason = baseBlockReason ?? (hasMerchant ? null : t('diplomacy.tradeNeedsGreatMerchant'));
          
          if (tradeBlockReason) {
            if (tradeBlockReason.startsWith('Capitals too far apart')) {
              const m = tradeBlockReason.match(/\((\d+) hexes; max (\d+)\)/);
              if (m) tradeBlockReason = t('diplomacy.capitalsTooFar', { d: m[1], max: m[2] });
            } else if (tradeBlockReason === 'Same civilization.') {
              tradeBlockReason = t('diplomacy.sameCiv');
            } else if (tradeBlockReason === 'Civilization eliminated.') {
              tradeBlockReason = t('diplomacy.civEliminated');
            } else if (tradeBlockReason === 'Cannot trade while at war.') {
              tradeBlockReason = t('diplomacy.noTradeAtWar');
            } else if (tradeBlockReason === 'Diplomatic status blocks trade.') {
              tradeBlockReason = t('diplomacy.diploBlocksTrade');
            } else if (tradeBlockReason === 'Both capitals must exist.') {
              tradeBlockReason = t('diplomacy.capitalsMustExist');
            } else if (tradeBlockReason === 'No viable trade network path between capitals.') {
              tradeBlockReason = t('diplomacy.noTradePath');
            } else if (tradeBlockReason.startsWith('Maximum')) {
              const m = tradeBlockReason.match(/Maximum (\d+)/);
              if (m) tradeBlockReason = t('diplomacy.maxTradeRoutes', { max: m[1] });
            }
          }
          const canAddTrade = tradeBlockReason === null;
          return (
            <TradeRouteWindow
              gameState={gameState}
              me={me}
              civIndex={tradeRouteModalCiv}
              tradeRouteGold={tradeRouteGold}
              tradeRouteRiskPct={tradeRouteRiskPct}
              canAddTrade={canAddTrade}
              tradeBlockReason={tradeBlockReason}
              onChangeGold={setTradeRouteGold}
              onChangeRisk={setTradeRouteRiskPct}
              onCreateRoute={() => {
                if (canAddTrade) handleCreateTradeRoute(tradeRouteModalCiv, tradeLotsAtoB, tradeLotsBtoA);
              }}
              lotsAtoB={tradeLotsAtoB}
              lotsBtoA={tradeLotsBtoA}
              onChangeLotsAtoB={setTradeLotsAtoB}
              onChangeLotsBtoA={setTradeLotsBtoA}
              onCancelRoute={(routeId) => {
                onUpdateState(cancelTradeRoute(gameState, routeId, me));
              }}
              onClose={() => setTradeRouteModalCiv(null)}
            />
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {dealModalCiv !== null && (() => {
          const atWar = areAtWar(gameState, me, dealModalCiv);
          const armistice = !atWar && isMilitarilyEngaged(gameState, me, dealModalCiv);
          const canSignDeal = !atWar && !armistice;
          return (
            <DealWindow
              gameState={gameState}
              me={me}
              civIndex={dealModalCiv}
              dealGoldAtoB={dealGoldAtoB}
              dealGoldBtoA={dealGoldBtoA}
              dealTurns={dealTurns}
              dealResAtoB={dealResAtoB}
              dealResBtoA={dealResBtoA}
              dealResAmtAtoB={dealResAmtAtoB}
              dealResAmtBtoA={dealResAmtBtoA}
              canSignDeal={canSignDeal}
              onChangeGoldAtoB={setDealGoldAtoB}
              onChangeGoldBtoA={setDealGoldBtoA}
              onChangeTurns={setDealTurns}
              onChangeResAtoB={setDealResAtoB}
              onChangeResBtoA={setDealResBtoA}
              onChangeResAmtAtoB={setDealResAmtAtoB}
              onChangeResAmtBtoA={setDealResAmtBtoA}
              onSignDeal={() => {
                if (canSignDeal) handleSignDeal(dealModalCiv, dealLotsAtoB, dealLotsBtoA);
              }}
              lotsAtoB={dealLotsAtoB}
              lotsBtoA={dealLotsBtoA}
              onChangeLotsAtoB={setDealLotsAtoB}
              onChangeLotsBtoA={setDealLotsBtoA}
              onCancelAgreement={(agreementId) => {
                onUpdateState(cancelTradeAgreement(gameState, agreementId, me));
              }}
              onClose={() => setDealModalCiv(null)}
            />
          );
        })()}
      </AnimatePresence>

    {settlementDraft && (
      <DiplomaticSettlementModal
        key={`${settlementDraft.civIndex}-${settlementDraft.kind}`}
        gameState={gameState}
        me={me}
        mode="propose"
        kind={settlementDraft.kind}
        otherCivIndex={settlementDraft.civIndex}
        onClose={() => setSettlementDraft(null)}
        onUpdateState={onUpdateState}
      />
    )}
    </>
  );
}
