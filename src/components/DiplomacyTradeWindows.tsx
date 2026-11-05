import { useState } from 'react';
import { motion } from 'framer-motion';
import { GnozianGlyph, GnzAppModalLayout } from './ui';
import { t } from '../i18n';
import type { GameState, YieldMap, TradeLot, TradeLotPriceMode, ResourceType } from '../game/types';
import { MAX_TRADE_ROUTES_PER_PAIR, TRADE_ROUTE_MAX_HEX_DISTANCE } from '../game/constants';

type DealResourceKey = keyof Pick<YieldMap, 'food' | 'science' | 'culture' | 'faith' | 'happiness'>;
const DEAL_RESOURCE_KEYS: DealResourceKey[] = ['food', 'science', 'culture', 'faith', 'happiness'];
const LOT_RESOURCES: ResourceType[] = ['food', 'production', 'gold', 'science', 'culture', 'faith', 'happiness'];

function resourceLabel(key: string): string {
  const tr = t(`city.yield.${key}`);
  return tr === `city.yield.${key}` ? key : tr;
}

function sumDealTransfer(transfer?: Partial<Record<DealResourceKey, number>>): number {
  if (!transfer) return 0;
  return DEAL_RESOURCE_KEYS.reduce((acc, key) => acc + Math.max(0, Number(transfer[key] ?? 0)), 0);
}

function lotPriceText(lot: TradeLot): string {
  return lot.priceMode === 'per_unit'
    ? `${lot.unitPrice} × ${lot.amount} = ${lot.unitPrice * lot.amount} g`
    : `${lot.unitPrice} g`;
}

type TradeRouteWindowProps = {
  gameState: GameState;
  me: number;
  civIndex: number;
  tradeRouteGold: number;
  tradeRouteRiskPct: number;
  canAddTrade: boolean;
  tradeBlockReason: string | null;
  onChangeGold: (v: number) => void;
  onChangeRisk: (v: number) => void;
  onCreateRoute: () => void;
  onCancelRoute: (routeId: number) => void;
  onClose: () => void;
  lotsAtoB: TradeLot[];
  lotsBtoA: TradeLot[];
  onChangeLotsAtoB: (lots: TradeLot[]) => void;
  onChangeLotsBtoA: (lots: TradeLot[]) => void;
};

export function TradeRouteWindow({
  gameState,
  me,
  civIndex,
  tradeRouteGold,
  tradeRouteRiskPct,
  canAddTrade,
  tradeBlockReason,
  onChangeGold,
  onChangeRisk,
  onCreateRoute,
  onCancelRoute,
  onClose,
  lotsAtoB,
  lotsBtoA,
  onChangeLotsAtoB,
  onChangeLotsBtoA,
}: TradeRouteWindowProps) {
  const lo = Math.min(me, civIndex);
  const hi = Math.max(me, civIndex);
  const routesBetween = gameState.tradeRoutes?.filter(tr => tr.civA === lo && tr.civB === hi) ?? [];
  const civ = gameState.civilizations[civIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="mx-auto w-full max-w-[min(96vw,920px)] overflow-hidden rounded-[inherit] border border-cyan-200/[0.14] bg-[#070c12] shadow-2xl ring-1 ring-amber-400/[0.12]"
        onClick={e => e.stopPropagation()}
      >
        <GnzAppModalLayout
          header={
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-200/[0.12] bg-gradient-to-r from-slate-950/90 to-slate-900/80 px-4 py-3">
              <div className="flex items-center gap-2 text-cyan-50">
                <GnozianGlyph name="trophy" size={18} className="text-amber-300/90" />
                <span className="font-bold">
                  {t('diplomacy.tradeAdd')} — {civ?.name ?? `#${civIndex + 1}`}
                </span>
              </div>
              <button type="button" onClick={onClose} className="rounded px-2 py-1 text-stone-300 hover:bg-white/10">
                ✕
              </button>
            </div>
          }
          footer={
            <div className="shrink-0 border-t border-cyan-200/[0.1] bg-black/35 px-4 py-3">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={onCreateRoute}
                  disabled={!canAddTrade}
                  title={tradeBlockReason ?? t('diplomacy.tradeAddTitle')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    canAddTrade
                      ? 'bg-amber-900/55 text-amber-50 hover:bg-amber-800/65'
                      : 'cursor-not-allowed bg-amber-950/25 text-amber-700'
                  }`}
                >
                  {t('diplomacy.tradeAdd')}
                </button>
              </div>
            </div>
          }
          mainClassName="bg-black/25 p-4"
        >
          <div className="space-y-3">
          <div className="rounded-lg border border-yellow-900/35 bg-yellow-950/15 p-3 text-xs text-yellow-200/85">
            {t('diplomacy.tradeRoutesHint', { max: String(TRADE_ROUTE_MAX_HEX_DISTANCE), cap: String(MAX_TRADE_ROUTES_PER_PAIR) })}
          </div>
          <div className="space-y-3 rounded-xl border border-yellow-900/35 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2 border-b border-yellow-900/30 pb-2">
              <div className="text-xs font-bold uppercase tracking-wide text-yellow-300">{t('diplomacy.newRouteTitle')}</div>
              <div className="text-[11px] text-yellow-200/80">
                {t('diplomacy.routePreview', { gold: tradeRouteGold, risk: tradeRouteRiskPct })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-yellow-200/80">
                {t('diplomacy.routeGold')}
                <input type="number" min={1} max={16} value={tradeRouteGold} onChange={e => onChangeGold(Math.max(1, Math.min(16, Number(e.target.value) || 1)))} className="mt-1 w-full rounded border border-yellow-800/35 bg-black/35 px-2 py-1 text-yellow-100" />
              </label>
              <label className="text-xs text-yellow-200/80">
                {t('diplomacy.routeRisk')}
                <input type="number" min={2} max={90} value={tradeRouteRiskPct} onChange={e => onChangeRisk(Math.max(2, Math.min(90, Number(e.target.value) || 2)))} className="mt-1 w-full rounded border border-yellow-800/35 bg-black/35 px-2 py-1 text-yellow-100" />
              </label>
            </div>
          </div>
          {tradeBlockReason && (
            <div className="rounded-lg border border-red-900/40 bg-red-950/25 px-3 py-2 text-xs text-red-300">
              {tradeBlockReason}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <LotBuilder
              title={t('diplomacy.youGive')}
              accentClass="text-amber-200"
              lots={lotsAtoB}
              onChange={onChangeLotsAtoB}
            />
            <LotBuilder
              title={t('diplomacy.youReceive')}
              accentClass="text-sky-200"
              lots={lotsBtoA}
              onChange={onChangeLotsBtoA}
            />
          </div>
          <div className="space-y-2 rounded-lg border border-stone-800 bg-stone-950/40 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-stone-400">{t('diplomacy.tradeRoutesSection')}</div>
            {routesBetween.length === 0 ? (
              <div className="text-sm text-stone-500">{t('diplomacy.noTradeRoutes')}</div>
            ) : (
              routesBetween.map(tr => {
                const a = gameState.cities.find(c => c.id === tr.fromCityId)?.name ?? '?';
                const b = gameState.cities.find(c => c.id === tr.toCityId)?.name ?? '?';
                return (
                  <div key={tr.id} className="flex items-center justify-between gap-3 rounded border border-stone-700/40 bg-black/25 px-3 py-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="text-stone-100">{a} ↔ {b}</div>
                      <div className="text-stone-400">
                        {t('diplomacy.routePreview', { gold: tr.goldPerTurn, risk: Math.round((tr.risk ?? 0) * 100) })}
                      </div>
                    </div>
                    <button type="button" onClick={() => onCancelRoute(tr.id)} className="rounded border border-red-900/50 bg-red-950/30 px-2 py-1 text-red-200 hover:bg-red-900/50">
                      {t('common.cancel')}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          </div>
        </GnzAppModalLayout>
      </motion.div>
    </motion.div>
  );
}

type DealWindowProps = {
  gameState: GameState;
  me: number;
  civIndex: number;
  dealGoldAtoB: number;
  dealGoldBtoA: number;
  dealTurns: number;
  dealResAtoB: DealResourceKey;
  dealResBtoA: DealResourceKey;
  dealResAmtAtoB: number;
  dealResAmtBtoA: number;
  canSignDeal: boolean;
  onChangeGoldAtoB: (v: number) => void;
  onChangeGoldBtoA: (v: number) => void;
  onChangeTurns: (v: number) => void;
  onChangeResAtoB: (v: DealResourceKey) => void;
  onChangeResBtoA: (v: DealResourceKey) => void;
  onChangeResAmtAtoB: (v: number) => void;
  onChangeResAmtBtoA: (v: number) => void;
  onSignDeal: () => void;
  onCancelAgreement: (agreementId: number) => void;
  onClose: () => void;
  lotsAtoB: TradeLot[];
  lotsBtoA: TradeLot[];
  onChangeLotsAtoB: (lots: TradeLot[]) => void;
  onChangeLotsBtoA: (lots: TradeLot[]) => void;
};

export function DealWindow(props: DealWindowProps) {
  const {
    gameState, me, civIndex, dealGoldAtoB, dealGoldBtoA, dealTurns, dealResAtoB, dealResBtoA, dealResAmtAtoB, dealResAmtBtoA,
    canSignDeal, onChangeGoldAtoB, onChangeGoldBtoA, onChangeTurns, onChangeResAtoB, onChangeResBtoA, onChangeResAmtAtoB, onChangeResAmtBtoA,
    onSignDeal, onCancelAgreement, onClose, lotsAtoB, lotsBtoA, onChangeLotsAtoB, onChangeLotsBtoA,
  } = props;
  const lo = Math.min(me, civIndex);
  const hi = Math.max(me, civIndex);
  const civ = gameState.civilizations[civIndex];
  const agreements = gameState.tradeAgreements?.filter(ag => ag.civA === lo && ag.civB === hi) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="mx-auto w-full max-w-[min(96vw,920px)] overflow-hidden rounded-[inherit] border border-cyan-200/[0.14] bg-[#070c12] shadow-2xl ring-1 ring-amber-400/[0.12]"
        onClick={e => e.stopPropagation()}
      >
        <GnzAppModalLayout
          header={
            <div className="flex shrink-0 items-center justify-between border-b border-cyan-200/[0.12] bg-gradient-to-r from-emerald-950/85 to-slate-900/80 px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-50">
                <GnozianGlyph name="handshake" size={18} className="text-emerald-300/90" />
                <span className="font-bold">
                  {t('diplomacy.deal')} — {civ?.name ?? `#${civIndex + 1}`}
                </span>
              </div>
              <button type="button" onClick={onClose} className="rounded px-2 py-1 text-stone-300 hover:bg-white/10">
                ✕
              </button>
            </div>
          }
          footer={
            <div className="shrink-0 border-t border-cyan-200/[0.1] bg-black/35 px-4 py-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onSignDeal}
                  disabled={!canSignDeal}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    canSignDeal
                      ? 'bg-emerald-900/60 text-emerald-50 hover:bg-emerald-800/70'
                      : 'cursor-not-allowed bg-emerald-950/25 text-emerald-700'
                  }`}
                >
                  {t('diplomacy.signDeal')}
                </button>
              </div>
            </div>
          }
          mainClassName="bg-black/25 p-4"
        >
          <div className="space-y-3">
          <div className="space-y-3 rounded-xl border border-emerald-900/35 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-900/30 pb-2">
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-300">{t('diplomacy.dealSetup')}</div>
              <div className="text-[11px] text-emerald-200/80">{t('diplomacy.dealTurnsLabel', { turns: dealTurns })}</div>
            </div>
            <label className="text-xs text-emerald-200/80">
              {t('diplomacy.dealTurns')}
              <input type="number" min={5} max={60} value={dealTurns} onChange={e => onChangeTurns(Math.max(5, Math.min(60, Number(e.target.value) || 5)))} className="mt-1 w-full rounded border border-emerald-800/35 bg-black/35 px-2 py-1 text-emerald-100" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-emerald-900/35 bg-emerald-950/10 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">{t('diplomacy.youGive')}</div>
                <label className="text-xs text-emerald-200/80">
                  {t('diplomacy.goldPerTurnAbbr')}
                  <input type="number" min={0} max={20} value={dealGoldAtoB} onChange={e => onChangeGoldAtoB(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} className="mt-1 w-full rounded border border-emerald-800/35 bg-black/35 px-2 py-1 text-emerald-100" />
                </label>
                <label className="text-xs text-emerald-200/80">
                  {t('diplomacy.resource')}
                  <select value={dealResAtoB} onChange={e => onChangeResAtoB(e.target.value as DealResourceKey)} className="mt-1 w-full rounded border border-emerald-800/35 bg-black/35 px-2 py-1 text-xs text-emerald-100">
                    {DEAL_RESOURCE_KEYS.map(k => <option key={k} value={k}>{resourceLabel(k)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-emerald-200/80">
                  {t('diplomacy.amountPerTurn')}
                  <input type="number" min={0} max={25} value={dealResAmtAtoB} onChange={e => onChangeResAmtAtoB(Math.max(0, Math.min(25, Number(e.target.value) || 0)))} className="mt-1 w-full rounded border border-emerald-800/35 bg-black/35 px-2 py-1 text-emerald-100" />
                </label>
              </div>
              <div className="space-y-2 rounded-lg border border-cyan-900/35 bg-cyan-950/10 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">{t('diplomacy.youReceive')}</div>
                <label className="text-xs text-cyan-200/80">
                  {t('diplomacy.goldPerTurnAbbr')}
                  <input type="number" min={0} max={20} value={dealGoldBtoA} onChange={e => onChangeGoldBtoA(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} className="mt-1 w-full rounded border border-cyan-800/35 bg-black/35 px-2 py-1 text-cyan-100" />
                </label>
                <label className="text-xs text-cyan-200/80">
                  {t('diplomacy.resource')}
                  <select value={dealResBtoA} onChange={e => onChangeResBtoA(e.target.value as DealResourceKey)} className="mt-1 w-full rounded border border-cyan-800/35 bg-black/35 px-2 py-1 text-xs text-cyan-100">
                    {DEAL_RESOURCE_KEYS.map(k => <option key={k} value={k}>{resourceLabel(k)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-cyan-200/80">
                  {t('diplomacy.amountPerTurn')}
                  <input type="number" min={0} max={25} value={dealResAmtBtoA} onChange={e => onChangeResAmtBtoA(Math.max(0, Math.min(25, Number(e.target.value) || 0)))} className="mt-1 w-full rounded border border-cyan-800/35 bg-black/35 px-2 py-1 text-cyan-100" />
                </label>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <LotBuilder
              title={t('diplomacy.youGive')}
              accentClass="text-emerald-200"
              lots={lotsAtoB}
              onChange={onChangeLotsAtoB}
            />
            <LotBuilder
              title={t('diplomacy.youReceive')}
              accentClass="text-cyan-200"
              lots={lotsBtoA}
              onChange={onChangeLotsBtoA}
            />
          </div>
          <div className="space-y-2 rounded-lg border border-stone-800 bg-stone-950/40 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-stone-400">{t('diplomacy.activeDeals')}</div>
            {agreements.length === 0 ? (
              <div className="text-sm text-stone-500">{t('diplomacy.noActiveDeals')}</div>
            ) : (
              agreements.map(ag => (
                <div key={ag.id} className="flex items-center justify-between gap-3 rounded border border-stone-700/40 bg-black/25 px-3 py-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="text-stone-100">
                      {t('diplomacy.dealLine', { id: ag.id, a: ag.goldPerTurnAtoB, b: ag.goldPerTurnBtoA, turns: ag.turnsLeft })}
                    </div>
                    <div className="text-stone-400">
                      {t('diplomacy.resourceFlow', {
                        giveAmt: sumDealTransfer(ag.transferAtoB as Partial<Record<DealResourceKey, number>>),
                        recvAmt: sumDealTransfer(ag.transferBtoA as Partial<Record<DealResourceKey, number>>),
                      })}
                    </div>
                  </div>
                  <button type="button" onClick={() => onCancelAgreement(ag.id)} className="rounded border border-red-900/50 bg-red-950/30 px-2 py-1 text-red-200 hover:bg-red-900/50">
                    {t('common.cancel')}
                  </button>
                </div>
              ))
            )}
          </div>
          </div>
        </GnzAppModalLayout>
      </motion.div>
    </motion.div>
  );
}

function LotBuilder({
  title,
  accentClass,
  lots,
  onChange,
}: {
  title: string;
  accentClass: string;
  lots: TradeLot[];
  onChange: (lots: TradeLot[]) => void;
}) {
  const [resource, setResource] = useState<ResourceType>('food');
  const [amount, setAmount] = useState(10);
  const [unitPrice, setUnitPrice] = useState(5);
  const [priceMode, setPriceMode] = useState<TradeLotPriceMode>('per_unit');

  const addLot = () => {
    const next: TradeLot = {
      resource,
      amount: Math.max(1, Math.round(amount)),
      unitPrice: Math.max(0, Math.round(unitPrice)),
      priceMode,
    };
    onChange([...lots, next]);
  };

  return (
    <div className="space-y-2 rounded-lg border border-stone-700/50 bg-black/25 p-3">
      <div className={`text-xs font-bold uppercase tracking-wide ${accentClass}`}>{title} · {t('diplomacy.lotBuilder')}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-stone-400">
          {t('diplomacy.resource')}
          <select
            value={resource}
            onChange={e => setResource(e.target.value as ResourceType)}
            className="mt-1 w-full rounded border border-stone-700 bg-stone-950/80 px-2 py-1 text-xs text-stone-100"
          >
            {LOT_RESOURCES.map(r => (
              <option key={r} value={r}>{resourceLabel(r)}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-stone-400">
          {t('diplomacy.amount')}
          <input
            type="number"
            min={1}
            max={9999}
            value={amount}
            onChange={e => setAmount(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full rounded border border-stone-700 bg-stone-950/80 px-2 py-1 text-xs text-stone-100"
          />
        </label>
        <label className="text-[11px] text-stone-400">
          {t('diplomacy.priceGold')}
          <input
            type="number"
            min={0}
            max={9999}
            value={unitPrice}
            onChange={e => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded border border-stone-700 bg-stone-950/80 px-2 py-1 text-xs text-stone-100"
          />
        </label>
        <label className="text-[11px] text-stone-400">
          {t('diplomacy.priceMode')}
          <select
            value={priceMode}
            onChange={e => setPriceMode(e.target.value as TradeLotPriceMode)}
            className="mt-1 w-full rounded border border-stone-700 bg-stone-950/80 px-2 py-1 text-xs text-stone-100"
          >
            <option value="one_time">{t('diplomacy.priceMode.one_time')}</option>
            <option value="per_unit">{t('diplomacy.priceMode.per_unit')}</option>
          </select>
        </label>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={addLot} className="rounded bg-stone-800 px-2.5 py-1 text-xs text-stone-100 hover:bg-stone-700">
          + {t('diplomacy.addLot')}
        </button>
      </div>
      {lots.length === 0 ? (
        <div className="text-[11px] text-stone-500">{t('diplomacy.noLots')}</div>
      ) : (
        <div className="space-y-1.5">
          {lots.map((lot, i) => (
            <div key={`${lot.resource}-${i}`} className="flex items-center justify-between rounded border border-stone-700/40 bg-stone-900/55 px-2 py-1 text-[11px]">
              <span className="text-stone-200">
                {resourceLabel(lot.resource)} · {lot.amount} · {lotPriceText(lot)}
              </span>
              <button
                type="button"
                onClick={() => onChange(lots.filter((_, idx) => idx !== i))}
                className="rounded bg-red-950/40 px-1.5 py-0.5 text-red-200 hover:bg-red-900/50"
              >
                {t('common.cancel')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

