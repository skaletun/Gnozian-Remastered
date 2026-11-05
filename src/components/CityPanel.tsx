import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  GameState,
  City,
  BuildingType,
  DistrictType,
  UnitType,
  WonderId,
  ProductionItem,
} from '../game/types';
import { BUILDINGS, UNITS, WONDERS, RESOURCE_COLORS, NATURAL_RESOURCES } from '../game/constants';
import {
  addToProductionQueue,
  buildSettlementDistrict,
  resolveCityGrowthEvent,
  setDistrictSpecialists,
  upgradeTownToCity,
} from '../game/engine';
import { empireMeetsUnitStrategicRequirements } from '../game/strategicResources';
import { isWonderAvailable } from '../game/featureSystems';
import { productionReserveCost } from '../game/productionReserve';
import {
  canAssignDistrictSpecialists,
  canBuildDistrict,
  canUpgradeTownToCity,
  normalizeSettlement,
  specialistCapForCity,
} from '../game/systems/settlementCore';
import { t } from '../i18n';
import { GnozianGlyph, GnozianPanelCorners, type GnozianGlyphName } from './ui';
import { useLayoutProfile } from '../hooks/useLayoutProfile';

interface Props {
  city: City;
  gameState: GameState;
  /** Local player slot; production only when this matches `city.owner`. */
  viewerCivIndex: number;
  onClose: () => void;
  onUpdateState: (state: GameState) => void;
}

type Tab = 'overview' | 'production' | 'buildings';

function tabTitle(tb: Tab): string {
  if (tb === 'overview') return t('city.overview');
  if (tb === 'production') return t('city.production');
  return t('city.buildings');
}

function tl(key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

const YIELD_GLYPH: Record<'food' | 'production' | 'gold' | 'science' | 'culture' | 'faith' | 'happiness', GnozianGlyphName> = {
  food: 'food',
  production: 'cog',
  gold: 'trophy',
  science: 'flask',
  culture: 'culture',
  faith: 'religion',
  happiness: 'sparkles',
};

const DISTRICT_BUILD_ORDER: DistrictType[] = [
  'rural_farms',
  'rural_mines',
  'campus',
  'market',
  'theater',
  'industrial',
  'temple',
];

export default function CityPanel({ city, gameState, viewerCivIndex, onClose, onUpdateState }: Props) {
  const layout = useLayoutProfile();
  const mobile = layout === 'mobile';
  const [tab, setTab] = useState<Tab>('overview');
  const [queueAnim, setQueueAnim] = useState<string | null>(null);
  const [districtType, setDistrictType] = useState<DistrictType>('rural_farms');
  const [districtTarget, setDistrictTarget] = useState<string>(() => `${city.q},${city.r}`);
  const [growthTarget, setGrowthTarget] = useState<string>('');
  const canManage = city.owner === viewerCivIndex;
  const civ = gameState.civilizations[city.owner];
  const researchedTechs = civ.researchedTechs;
  const settlement = normalizeSettlement(city);

  useEffect(() => {
    if (!canManage) setTab('overview');
  }, [canManage, city.id]);

  useEffect(() => {
    setDistrictTarget(`${city.q},${city.r}`);
  }, [city.id, city.q, city.r]);
  useEffect(() => {
    const pending = normalizeSettlement(city).pendingGrowthEvent;
    const first = pending?.targetCandidates?.[0];
    setGrowthTarget(first ? `${first.q},${first.r},${first.kind}` : '');
  }, [city.id, city.pendingGrowthEvent?.id]);

  const getAvailableBuildings = (): string[] => {
    return Object.keys(BUILDINGS).filter(id => {
      const b = BUILDINGS[id];
      if (city.buildings.includes(id as BuildingType)) return false;
      if (b.prerequisiteTech && !researchedTechs.includes(b.prerequisiteTech)) return false;
      return true;
    });
  };

  const getAvailableUnits = (): string[] => {
    return Object.keys(UNITS).filter(id => {
      const u = UNITS[id];
      if (u.prerequisiteTech && !researchedTechs.includes(u.prerequisiteTech)) return false;
      if (id.startsWith('great_')) return false;
      return true;
    });
  };

  const getAvailableWonders = (): WonderId[] => {
    return (Object.keys(WONDERS) as WonderId[]).filter(wid => {
      const w = WONDERS[wid];
      if (w.prerequisiteTech && !researchedTechs.includes(w.prerequisiteTech)) return false;
      return isWonderAvailable(gameState, wid);
    });
  };

  const handleQueueBuilding = (id: string) => {
    if (!canManage) return;
    const b = BUILDINGS[id];
    if (!b) return;
    const already = city.productionQueue.some(q => q.id === id);
    if (already) return;
    setQueueAnim(id);
    setTimeout(() => setQueueAnim(null), 600);
    const item = { type: 'building' as const, id: id as BuildingType, progress: 0, cost: b.cost };
    const newState = addToProductionQueue(gameState, city.id, item, viewerCivIndex);
    onUpdateState(newState);
  };

  const handleQueueUnit = (id: string) => {
    if (!canManage) return;
    const u = UNITS[id];
    if (!u) return;
    setQueueAnim(id);
    setTimeout(() => setQueueAnim(null), 600);
    const item = { type: 'unit' as const, id: id as UnitType, progress: 0, cost: u.cost };
    const newState = addToProductionQueue(gameState, city.id, item, viewerCivIndex);
    onUpdateState(newState);
  };

  const handleQueueWonder = (wid: WonderId) => {
    if (!canManage) return;
    const w = WONDERS[wid];
    if (!w) return;
    const already = city.productionQueue.some(q => q.id === wid);
    if (already) return;
    setQueueAnim(wid);
    setTimeout(() => setQueueAnim(null), 600);
    const item = { type: 'wonder' as const, id: wid, progress: 0, cost: w.cost };
    const newState = addToProductionQueue(gameState, city.id, item, viewerCivIndex);
    onUpdateState(newState);
  };

  const districtTargets = (() => {
    const seen = new Set<string>();
    const out: Array<{ key: string; q: number; r: number; label: string }> = [];
    const push = (q: number, r: number, label: string) => {
      const key = `${q},${r}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ key, q, r, label });
    };
    push(settlement.q, settlement.r, t('city.districtTarget.center', { q: settlement.q, r: settlement.r }));
    for (const wt of settlement.workedTiles) {
      push(wt.q, wt.r, t('city.districtTarget.worked', { q: wt.q, r: wt.r }));
    }
    for (const d of settlement.districts ?? []) {
      push(d.q, d.r, t('city.districtTarget.districtTile', { q: d.q, r: d.r }));
    }
    return out;
  })();

  const [targetQ, targetR] = districtTarget.split(',').map(v => Number(v));
  const districtBuildCheck = canBuildDistrict(
    gameState,
    city.id,
    districtType,
    targetQ,
    targetR,
    viewerCivIndex
  );
  const canUpgradeTownCheck = canUpgradeTownToCity(gameState, city.id, viewerCivIndex);

  const handleUpgradeTown = () => {
    if (!canManage) return;
    onUpdateState(upgradeTownToCity(gameState, city.id, viewerCivIndex));
  };

  const handleBuildDistrict = () => {
    if (!canManage) return;
    if (!districtBuildCheck.ok) return;
    onUpdateState(
      buildSettlementDistrict(gameState, city.id, districtType, targetQ, targetR, viewerCivIndex)
    );
  };

  const handleSetDistrictSpecialists = (districtId: string, nextSpecialists: number) => {
    if (!canManage) return;
    const check = canAssignDistrictSpecialists(
      gameState,
      city.id,
      districtId,
      nextSpecialists,
      viewerCivIndex
    );
    if (!check.ok) return;
    onUpdateState(
      setDistrictSpecialists(gameState, city.id, districtId, nextSpecialists, viewerCivIndex)
    );
  };

  const growthEvent = settlement.pendingGrowthEvent;
  const handleResolveGrowthEvent = (choice: 'rural_development' | 'urban_investment' | 'cultural_rite') => {
    if (!canManage || !growthEvent) return;
    if (!growthEvent.options.includes(choice)) return;
    const parts = growthTarget.split(',');
    const parsedTarget: { q: number; r: number; kind: 'urban' | 'rural' } | null =
      parts.length >= 3
        ? {
            q: Number(parts[0]),
            r: Number(parts[1]),
            kind: (parts[2] === 'urban' ? 'urban' : 'rural') as 'urban' | 'rural',
          }
        : null;
    const kindNeed = choice === 'urban_investment' ? 'urban' : choice === 'rural_development' ? 'rural' : null;
    const target: { q: number; r: number; kind: 'urban' | 'rural' } | undefined =
      kindNeed == null
        ? undefined
        : parsedTarget && parsedTarget.kind === kindNeed
          ? parsedTarget
          : growthEvent.targetCandidates?.find(c => c.kind === kindNeed);
    onUpdateState(resolveCityGrowthEvent(gameState, city.id, choice, target, viewerCivIndex));
  };

  const currentItem = city.productionQueue[0];
  const turnsToComplete = currentItem
    ? Math.ceil((currentItem.cost - currentItem.progress) / Math.max(1, city.yields.production))
    : null;

  const foodToGrow = city.foodNeeded - city.food;
  const foodSurplus = city.yields.food - city.population;
  const turnsToGrow = foodSurplus > 0 ? Math.ceil(foodToGrow / foodSurplus) : 999;

  const YIELD_ORDER = ['food', 'production', 'gold', 'science', 'culture', 'faith'] as const;

  const housingCap = city.housing ?? 0;
  const housingPct =
    housingCap > 0 ? Math.min(100, (city.population / Math.max(1, housingCap)) * 100) : 0;
  const amenities = city.amenities ?? 0;
  const loyalty = city.loyalty ?? 100;
  const worksHere = gameState.systems.greatWorks.filter(gw => gw.cityId === city.id);
  const buildingName = (id: string) => tl(`building.name.${id}`, BUILDINGS[id]?.name ?? id);
  const buildingDesc = (id: string) => tl(`building.desc.${id}`, BUILDINGS[id]?.description ?? '');
  const unitName = (id: string) => tl(`unit.name.${id}`, UNITS[id]?.name ?? id);
  const unitDesc = (id: string) => tl(`unit.desc.${id}`, UNITS[id]?.description ?? '');
  const wonderName = (id: string) => tl(`wonder.name.${id}`, WONDERS[id as WonderId]?.name ?? id);
  const wonderDesc = (id: string) => tl(`wonder.desc.${id}`, WONDERS[id as WonderId]?.description ?? '');
  const resourceName = (id: string) => tl(`resource.name.${id}`, NATURAL_RESOURCES[id]?.name ?? id);
  const prodReserve = Math.round(civ.resources.production ?? 0);
  const prodReserveIncome = Math.round(civ.lastTurnIncome?.production ?? 0);
  const canAffordReserve = (item: ProductionItem): boolean => prodReserve >= productionReserveCost(item);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 250 }}
        className={`relative flex h-full w-full flex-col overflow-hidden border border-amber-900/40 bg-gradient-to-b from-stone-950 via-[#0c1014] to-black shadow-2xl ${
          'max-h-[90vh] max-w-2xl rounded-2xl'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <GnozianPanelCorners inset={5} size={32} />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-amber-900/35 bg-gradient-to-r from-stone-900/90 to-stone-950/95 ${mobile ? 'p-3' : 'p-5'}`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center text-amber-200/90">
              <GnozianGlyph name={city.isCapital ? 'crown' : 'city'} size={32} />
            </span>
            <div>
              <h2 className={`${mobile ? 'text-lg' : 'text-xl'} font-bold text-stone-50`}>{city.name}</h2>
              <p className="text-sm text-stone-400/95">
                {t('city.headerSubtitle', { pop: city.population, turn: city.turnFounded })}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="px-3 py-1 text-xl text-stone-400 transition-colors hover:text-amber-100"
          >✕</motion.button>
        </div>

        {/* Yields bar */}
        <div className={`flex flex-wrap gap-2 border-b border-amber-900/25 bg-stone-950/60 ${mobile ? 'px-3 py-2' : 'px-5 py-3'}`}>
          {YIELD_ORDER.map(res => {
            const val = city.yields[res];
            if (!val) return null;
            return (
              <motion.div
                key={res}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 rounded-lg border border-amber-900/30 bg-stone-900/50 px-3 py-1.5"
              >
                <GnozianGlyph name={YIELD_GLYPH[res]} size={14} className="text-stone-300/90" />
                <span className="text-xs font-bold" style={{ color: RESOURCE_COLORS[res] }}>
                  +{val}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400/90">
                  {t(`city.yield.${res}`)}
                </span>
              </motion.div>
            );
          })}
        </div>

        {!canManage && (
          <div className="border-b border-amber-900/40 bg-amber-950/40 px-5 py-2 text-center text-xs text-amber-200/95">
            {t('cityPanel.foreignCityReadOnly')}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-amber-900/30 bg-stone-950/40">
          {(canManage ? (['overview', 'production', 'buildings'] as Tab[]) : (['overview'] as Tab[])).map(tb => (
            <button
              key={tb}
              type="button"
              onClick={() => setTab(tb)}
              className={`relative flex-1 py-3 text-sm font-medium transition-all ${
                tab === tb
                  ? 'bg-amber-950/55 text-amber-100/95'
                  : 'text-stone-500 hover:bg-stone-900/60 hover:text-stone-200'
              }`}
            >
              {tabTitle(tb)}
              {tab === tb && (
                <motion.div
                  layoutId="city-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400/85"
                />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={`min-h-0 flex-1 overflow-y-auto ${mobile ? 'p-3' : 'p-5'}`}>
          <AnimatePresence mode="wait">
            {tab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {growthEvent && (
                  <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
                      {t('city.growth.title')}
                    </div>
                    <div className="mb-3 text-sm text-stone-200">
                      {t('city.growth.prompt', { pop: growthEvent.populationAfterGrowth })}
                    </div>
                    {(growthEvent.targetCandidates?.length ?? 0) > 0 && (
                      <div className="mb-3">
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-300/90">
                          {t('city.growth.targetTile')}
                        </label>
                        <select
                          value={growthTarget}
                          onChange={e => setGrowthTarget(e.target.value)}
                          className="w-full rounded border border-emerald-900/45 bg-black/35 px-2 py-1.5 text-xs text-stone-100"
                        >
                          {(growthEvent.targetCandidates ?? []).map(tc => (
                            <option key={`${tc.q},${tc.r},${tc.kind}`} value={`${tc.q},${tc.r},${tc.kind}`}>
                              {t('city.growth.tileOption', {
                                kind: t(`city.growth.kind.${tc.kind}`),
                                q: tc.q,
                                r: tc.r,
                              })}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-3">
                      {growthEvent.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleResolveGrowthEvent(opt)}
                          disabled={!canManage}
                          className="rounded-lg border border-emerald-800/45 bg-emerald-900/25 px-3 py-2 text-left text-xs text-emerald-100 transition hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <div className="font-semibold">{t(`city.growth.option.${opt}.title`)}</div>
                          <div className="mt-1 text-[11px] text-emerald-200/80">{t(`city.growth.option.${opt}.desc`)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status cards */}
                <div className={`grid gap-3 ${mobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                      <span className="inline-flex items-center gap-1">
                        <GnozianGlyph name="home" size={14} className="text-amber-300/80" />
                        {t('cityPanel.housing')}
                      </span>
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-amber-300 font-bold tabular-nums">
                        {city.population} / {Math.max(1, housingCap)}
                      </span>
                      <span className="text-xs text-stone-400/90">
                        {housingCap < 1
                          ? t('cityPanel.housingNoData')
                          : housingPct >= 100
                            ? t('cityPanel.housingAtCap')
                            : t('cityPanel.housingGrowing')}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-950/80">
                      <motion.div
                        className="bg-amber-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${housingPct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                      <span className="inline-flex items-center gap-1">
                        <GnozianGlyph name="star" size={14} className="text-fuchsia-300/80" />
                        {t('cityPanel.amenities')}
                      </span>
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-fuchsia-300 font-bold tabular-nums">{amenities}</span>
                      <span className="text-xs text-stone-400/90">{t('cityPanel.amenitiesHint')}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-950/80">
                      <motion.div
                        className="bg-fuchsia-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, amenities * 12)}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                      <span className="inline-flex items-center gap-1">
                        <GnozianGlyph name="compass" size={14} className="text-cyan-300/80" />
                        {t('cityPanel.loyalty')}
                      </span>
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-cyan-300 font-bold tabular-nums">{Math.round(loyalty)}</span>
                      <span className="text-xs text-stone-400/90">{t('cityPanel.loyaltyHint')}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-950/80">
                      <motion.div
                        className="bg-cyan-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, loyalty)}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                    <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                      <GnozianGlyph name="food" size={14} className="text-green-400/80" />
                      {t('city.foodProgress')}
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="font-bold text-green-400">{city.food}/{city.foodNeeded}</span>
                      <span className="text-xs text-stone-400/90">
                        {turnsToGrow < 100
                          ? t('city.turnsApprox', { n: turnsToGrow, unit: t('city.turnsToGrow') })
                          : t('city.shrinking')}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-950/80">
                      <motion.div
                        className="bg-green-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (city.food / city.foodNeeded) * 100)}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                    <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                      <GnozianGlyph name="shield" size={14} className="text-sky-400/80" />
                      {t('city.defense')}
                    </div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="font-bold text-sky-400">
                        {t('city.hpLine', { cur: city.hp, max: city.maxHp })}
                      </span>
                      <span className="text-xs text-stone-400/90">
                        {t('city.defenseValue', { def: city.defense })}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-950/80">
                      <motion.div
                        className="bg-blue-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(city.hp / city.maxHp) * 100}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                      <span className="inline-flex items-center gap-1">
                        <GnozianGlyph name="city" size={14} className="text-amber-300/85" />
                        {t('city.settlementAndDistricts')}
                      </span>
                    </div>
                    <span className="rounded-md border border-amber-900/35 bg-stone-900/70 px-2 py-1 text-[11px] font-semibold text-amber-200">
                      {t(`city.${settlement.settlementKind ?? 'town'}`)} · {t('city.tier')} {settlement.settlementTier ?? 1}
                    </span>
                  </div>

                  {(settlement.settlementKind ?? 'town') === 'town' && canManage && (
                    <div className="mb-3 rounded-lg border border-sky-900/35 bg-sky-950/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-stone-300/90">
                          {t('city.upgradeTownHint')}
                        </div>
                        <button
                          type="button"
                          disabled={!canUpgradeTownCheck.ok}
                          onClick={handleUpgradeTown}
                          className="rounded-md border border-sky-800/50 bg-sky-900/40 px-3 py-1.5 text-xs font-semibold text-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {t('city.upgradeTownBtn', { cost: canUpgradeTownCheck.cost ?? 0 })}
                        </button>
                      </div>
                    </div>
                  )}

                  {canManage && (
                    <div className="mb-4 rounded-lg border border-amber-900/35 bg-black/20 p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400/90">
                        {t('city.buildDistrictTitle')}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <select
                          value={districtType}
                          onChange={e => setDistrictType(e.target.value as DistrictType)}
                          className="rounded border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-100"
                        >
                          {DISTRICT_BUILD_ORDER.map(dt => (
                            <option key={dt} value={dt}>
                              {t(`city.districtType.${dt}`)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={districtTarget}
                          onChange={e => setDistrictTarget(e.target.value)}
                          className="rounded border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-100"
                        >
                          {districtTargets.map(opt => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!districtBuildCheck.ok || !Number.isFinite(targetQ) || !Number.isFinite(targetR)}
                          onClick={handleBuildDistrict}
                          className="rounded border border-amber-800/45 bg-amber-900/35 px-2 py-1 text-xs font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {t('city.buildDistrictSubmit', { cost: districtBuildCheck.cost ?? 0 })}
                        </button>
                      </div>
                      {!districtBuildCheck.ok && (
                        <div className="mt-2 text-[11px] text-amber-300/90">
                          {t('city.buildRequirement', { reason: t(`district.reason.${districtBuildCheck.reason ?? 'unavailable'}`) })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    {(settlement.districts ?? []).map(d => {
                      const cap = specialistCapForCity(settlement);
                      const current = Math.max(0, d.specialists);
                      const canMinus = current > 0;
                      const plusCheck = canAssignDistrictSpecialists(
                        gameState,
                        city.id,
                        d.id,
                        current + 1,
                        viewerCivIndex
                      );
                      const canPlus = canManage && plusCheck.ok;
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-stone-800/80 bg-stone-900/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-stone-200">
                              {t(`city.districtType.${d.type}`)} ({t(`districtKind.${d.kind}`)})
                            </div>
                            <div className="text-[10px] text-stone-500">
                              L{d.level} · ({d.q}, {d.r})
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!canManage || !canMinus}
                              onClick={() => handleSetDistrictSpecialists(d.id, current - 1)}
                              className="h-6 w-6 rounded border border-stone-700 bg-stone-900 text-xs text-stone-200 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              -
                            </button>
                            <span className="min-w-[3.8rem] text-center text-[11px] font-semibold text-stone-200">
                              {current} / {cap}
                            </span>
                            <button
                              type="button"
                              disabled={!canPlus}
                              onClick={() => handleSetDistrictSpecialists(d.id, current + 1)}
                              className="h-6 w-6 rounded border border-emerald-800/45 bg-emerald-900/30 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Current production */}
                <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                    <span className="inline-flex items-center gap-1.5">
                      <GnozianGlyph name="cog" size={14} className="text-amber-300/85" />
                      {t('city.productionQueue')}
                    </span>
                  </div>
                  {city.productionQueue.length === 0 ? (
                    <div className="text-sm italic text-stone-500">{t('city.noProduction')}</div>
                  ) : (
                    <div className="space-y-3">
                      {city.productionQueue.map((item, i) => (
                        <motion.div
                          key={`${item.type}-${item.id}-${i}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-center gap-3"
                        >
                          <span className="min-w-[100px] text-sm font-medium text-stone-100">
                            {item.type === 'building'
                              ? buildingName(item.id)
                              : item.type === 'wonder'
                                ? wonderName(item.id)
                                : unitName(item.id)}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-950/80">
                            <motion.div
                              className="h-full rounded-full bg-orange-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (item.progress / item.cost) * 100)}%` }}
                              transition={{ duration: 0.8, delay: i * 0.1 }}
                            />
                          </div>
                          <span className="min-w-[40px] text-right text-xs text-stone-400/90">
                            {i === 0 && turnsToComplete
                              ? t('city.queueTurnsShort', { n: turnsToComplete })
                              : `${Math.round(item.progress)}/${item.cost}`}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Great works */}
                {worksHere.length > 0 && (
                  <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                      <span className="inline-flex items-center gap-1">
                        <GnozianGlyph name="masks" size={14} className="text-purple-300/80" />
                        {t('cityPanel.greatWorks')} ({worksHere.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {worksHere.map(gw => (
                        <span
                          key={gw.id}
                          className="rounded-lg border border-purple-900/40 bg-purple-950/30 px-3 py-1.5 text-xs text-purple-100"
                        >
                          {gw.name}{' '}
                          <span className="text-purple-400/80">(+{Math.round(gw.tourism)})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buildings */}
                <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                  <div className="mb-3 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                    <GnozianGlyph name="empire" size={14} className="text-amber-400/80" />
                    {t('city.buildingsCount', { n: city.buildings.length })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {city.buildings.map(bId => {
                      const b = BUILDINGS[bId];
                      return b ? (
                        <motion.span
                          key={bId}
                          whileHover={{ scale: 1.05 }}
                          className="rounded-lg border border-amber-900/30 bg-stone-800/70 px-3 py-1.5 text-xs text-stone-200"
                        >
                          {buildingName(bId)}
                        </motion.span>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Worked tiles */}
                <div className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4">
                  <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-stone-400/90">
                    <GnozianGlyph name="map" size={14} className="text-amber-400/80" />
                    {t('city.workedTiles')}
                  </div>
                  <div className="text-xs text-stone-500/95">
                    {t('city.populationWorks', { count: city.population + 1 })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {city.workedTiles.map((wt, i) => (
                      <span key={i} className="rounded bg-stone-800/60 px-2 py-1 text-[10px] text-stone-400">
                        ({wt.q}, {wt.r})
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'production' && (
              <motion.div
                key="production"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="rounded-xl border border-amber-800/35 bg-black/25 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-200/90">
                      <GnozianGlyph name="cog" size={13} className="text-amber-300/90" />
                      {t('city.productionReserve')}
                    </span>
                    <span className="font-bold tabular-nums text-amber-300">
                      {prodReserve}
                      <span className="ml-1 text-[11px] font-medium text-stone-400">
                        ({prodReserveIncome >= 0 ? '+' : ''}{prodReserveIncome}/t)
                      </span>
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-amber-300/95">
                    <GnozianGlyph name="hammer" size={15} className="text-amber-200/90" />
                    {t('city.buildingsAvailable')}
                  </h3>
                  <div className="space-y-2.5">
                    {getAvailableBuildings().map(id => {
                      const b = BUILDINGS[id];
                      const turns = Math.ceil(b.cost / Math.max(1, city.yields.production));
                      const inQueue = city.productionQueue.some(q => q.id === id);
                      const isAnimating = queueAnim === id;
                      const item = { type: 'building' as const, id: id as BuildingType, progress: 0, cost: b.cost };
                      const reserveNeed = productionReserveCost(item);
                      const hasReserve = canAffordReserve(item);
                      return (
                        <motion.div
                          key={id}
                          whileHover={{ scale: 1.01, x: 4 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => {
                            if (hasReserve) handleQueueBuilding(id);
                          }}
                          className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all ${
                            !hasReserve
                              ? 'cursor-not-allowed border-red-900/45 bg-red-950/20 opacity-60'
                              : inQueue || isAnimating
                                ? 'border-orange-600/45 bg-orange-950/35'
                                : 'border-amber-900/35 bg-stone-900/50 hover:border-amber-800/50 hover:bg-stone-900/70'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-stone-100">{buildingName(id)}</div>
                            <div className="mt-1 text-xs leading-relaxed text-stone-400/95">{buildingDesc(id)}</div>
                            {!hasReserve && (
                              <div className="mt-1 text-[10px] text-red-300/95">
                                {t('city.notEnoughProductionReserve', { need: reserveNeed, have: prodReserve })}
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(b.yields).filter(([, v]) => v).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="rounded-md bg-stone-800/70 px-2 py-0.5 text-[11px] font-medium"
                                  style={{ color: RESOURCE_COLORS[k as keyof typeof RESOURCE_COLORS] }}
                                >
                                  +{v} {t(`city.yield.${k as 'food' | 'production' | 'gold' | 'science' | 'culture' | 'faith'}`)}
                                </span>
                              ))}
                              {b.maintenanceCost > 0 && (
                                <span className="rounded-md bg-red-950/35 px-2 py-0.5 text-[11px] text-red-300/95">
                                  {t('city.goldPerTurnShort', { n: b.maintenanceCost })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="min-w-[60px] text-right">
                            <div className="text-sm font-bold text-orange-400">⚙️{b.cost}</div>
                            <div className={`text-xs font-semibold ${hasReserve ? 'text-emerald-300/90' : 'text-red-300/95'}`}>
                              {t('city.reserveCostShort', { n: reserveNeed })}
                            </div>
                            <div className="text-xs text-stone-500">{t('city.turnsWithCount', { n: turns, unit: t('city.turns') })}</div>
                          </div>
                          {(inQueue || isAnimating) && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="rounded-lg bg-orange-950/50 px-2 py-1 text-xs font-bold text-orange-200"
                            >
                              {isAnimating ? t('city.added') : t('city.inQueue')}
                            </motion.span>
                          )}
                        </motion.div>
                      );
                    })}
                    {getAvailableBuildings().length === 0 && (
                      <div className="rounded-xl border border-amber-900/30 bg-stone-900/45 p-6 text-center text-sm italic text-stone-500">
                        {t('cityPanel.allBuildingsDone')}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-sky-300/95">
                    <GnozianGlyph name="sword" size={15} className="text-sky-300/85" />
                    {t('city.unitsSection')}
                  </h3>
                  <div className="space-y-2.5">
                    {getAvailableUnits().map(id => {
                      const u = UNITS[id];
                      const turns = Math.ceil(u.cost / Math.max(1, city.yields.production));
                      const isAnimating = queueAnim === id;
                      const item = { type: 'unit' as const, id: id as UnitType, progress: 0, cost: u.cost };
                      const reserveNeed = productionReserveCost(item);
                      const hasReserve = canAffordReserve(item);
                      const hasStrategic = empireMeetsUnitStrategicRequirements(
                        gameState,
                        city.owner,
                        id as UnitType
                      );
                      const canQueue = hasStrategic && hasReserve;
                      return (
                        <motion.div
                          key={id}
                          whileHover={{ scale: canQueue ? 1.01 : 1, x: canQueue ? 4 : 0 }}
                          whileTap={{ scale: canQueue ? 0.99 : 1 }}
                          onClick={() => {
                            if (canQueue) handleQueueUnit(id);
                          }}
                          className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
                            canQueue ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                          } ${
                            isAnimating
                              ? 'border-sky-600/45 bg-sky-950/35'
                              : !hasReserve
                                ? 'border-red-900/45 bg-red-950/20'
                                : 'border-amber-900/35 bg-stone-900/50 hover:border-amber-800/50 hover:bg-stone-900/70'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-stone-100">{unitName(id)}</div>
                            <div className="mt-1 text-xs text-stone-400/95">{unitDesc(id)}</div>
                            {!hasStrategic && u.requiredStrategicResources && (
                              <div className="mt-1 text-[10px] text-amber-400/95">
                                {t('city.needsStrategic', {
                                  list: Object.entries(u.requiredStrategicResources)
                                    .map(([k, n]) => `${resourceName(k)}×${n}`)
                                    .join(', '),
                                })}
                              </div>
                            )}
                            {!hasReserve && (
                              <div className="mt-1 text-[10px] text-red-300/95">
                                {t('city.notEnoughProductionReserve', { need: reserveNeed, have: prodReserve })}
                              </div>
                            )}
                            <div className="mt-2 flex gap-3 text-[11px] text-stone-400/90">
                              {u.strength > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-stone-800/70 px-2 py-0.5">
                                  <GnozianGlyph name="sword" size={12} className="text-sky-300/85" />
                                  {u.strength}
                                </span>
                              )}
                              {u.rangedStrength > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-stone-800/70 px-2 py-0.5">
                                  <GnozianGlyph name="bow" size={12} className="text-amber-400/90" />
                                  {u.rangedStrength}(r{u.range})
                                </span>
                              )}
                              <span className="inline-flex items-center gap-0.5 rounded bg-stone-800/70 px-2 py-0.5">
                                <GnozianGlyph name="foot" size={12} className="text-stone-400" />×{u.movement}
                              </span>
                            </div>
                          </div>
                          <div className="min-w-[60px] text-right">
                            <div className="text-sm font-bold text-sky-400">⚙️{u.cost}</div>
                            <div className={`text-xs font-semibold ${hasReserve ? 'text-emerald-300/90' : 'text-red-300/95'}`}>
                              {t('city.reserveCostShort', { n: reserveNeed })}
                            </div>
                            <div className="text-xs text-stone-500">{t('city.turnsWithCount', { n: turns, unit: t('city.turns') })}</div>
                            <div className="text-xs text-stone-500">{t('city.goldPerTurnShort', { n: u.maintenanceCost })}</div>
                          </div>
                          {isAnimating && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="rounded-lg bg-sky-950/50 px-2 py-1 text-xs font-bold text-sky-200"
                            >
                              {t('city.added')}
                            </motion.span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-amber-300/95">
                    <GnozianGlyph name="monolith" size={15} className="text-amber-300/90" />
                    {t('city.wondersSection')}
                  </h3>
                  <div className="space-y-2.5">
                    {getAvailableWonders().map(wid => {
                      const w = WONDERS[wid];
                      const turns = Math.ceil(w.cost / Math.max(1, city.yields.production));
                      const isAnimating = queueAnim === wid;
                      const item = { type: 'wonder' as const, id: wid, progress: 0, cost: w.cost };
                      const reserveNeed = productionReserveCost(item);
                      const hasReserve = canAffordReserve(item);
                      return (
                        <motion.div
                          key={wid}
                          whileHover={{ scale: hasReserve ? 1.01 : 1, x: hasReserve ? 4 : 0 }}
                          whileTap={{ scale: hasReserve ? 0.99 : 1 }}
                          onClick={() => {
                            if (hasReserve) handleQueueWonder(wid);
                          }}
                          className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
                            hasReserve ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                          } ${
                            isAnimating
                              ? 'border-amber-600/45 bg-amber-950/35'
                              : !hasReserve
                                ? 'border-red-900/45 bg-red-950/20'
                                : 'border-amber-900/35 bg-stone-900/50 hover:border-amber-700/50 hover:bg-stone-900/70'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-stone-100">{wonderName(wid)}</div>
                            <div className="mt-1 text-xs leading-relaxed text-stone-400/95">{wonderDesc(wid)}</div>
                            {!hasReserve && (
                              <div className="mt-1 text-[10px] text-red-300/95">
                                {t('city.notEnoughProductionReserve', { need: reserveNeed, have: prodReserve })}
                              </div>
                            )}
                          </div>
                          <div className="min-w-[60px] text-right">
                            <div className="text-sm font-bold text-amber-400">⚙️{w.cost}</div>
                            <div className={`text-xs font-semibold ${hasReserve ? 'text-emerald-300/90' : 'text-red-300/95'}`}>
                              {t('city.reserveCostShort', { n: reserveNeed })}
                            </div>
                            <div className="text-xs text-stone-500">{t('city.turnsWithCount', { n: turns, unit: t('city.turns') })}</div>
                          </div>
                          {isAnimating && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="rounded-lg bg-amber-950/50 px-2 py-1 text-xs font-bold text-amber-200"
                            >
                              {t('city.added')}
                            </motion.span>
                          )}
                        </motion.div>
                      );
                    })}
                    {getAvailableWonders().length === 0 && (
                      <div className="rounded-xl border border-amber-900/30 bg-stone-900/45 p-4 text-center text-sm italic text-stone-500">
                        {t('cityPanel.noWondersAvailable')}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'buildings' && (
              <motion.div
                key="buildings"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-2.5"
              >
                <h3 className="mb-3 text-sm font-semibold text-stone-400/95">
                  {t('city.buildingsInCity', { city: city.name })}
                </h3>
                {city.buildings.map(bId => {
                  const b = BUILDINGS[bId];
                  if (!b) return null;
                  return (
                    <motion.div
                      key={bId}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-amber-900/35 bg-stone-900/45 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-sm font-semibold text-stone-100">{buildingName(bId)}</div>
                        {b.maintenanceCost > 0 && (
                          <span className="rounded bg-red-950/35 px-2 py-0.5 text-xs text-red-300/95">
                            {t('city.goldPerTurnLong', { n: b.maintenanceCost })}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-stone-400/95">{buildingDesc(bId)}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(b.yields).filter(([, v]) => v).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-md bg-stone-800/70 px-2 py-0.5 text-[11px] font-medium"
                            style={{ color: RESOURCE_COLORS[k as keyof typeof RESOURCE_COLORS] }}
                          >
                            <span className="inline-flex items-center gap-1">
                              +{v}
                              <GnozianGlyph
                                name={YIELD_GLYPH[k as keyof typeof YIELD_GLYPH] ?? 'target'}
                                size={12}
                                className="text-stone-300/90"
                              />
                              {t(`city.yield.${k as 'food' | 'production' | 'gold' | 'science' | 'culture' | 'faith'}`)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
                {city.buildings.length === 0 && (
                  <div className="text-gray-500 italic text-sm text-center py-8">{t('city.noBuildings')}</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
