import { useEffect, useMemo, memo, useRef, useState } from 'react';
import './mobile-hud.css';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  GameState,
  Unit,
  City,
  Tile,
  ProductionItem,
  ImprovementType,
  CivLeaderBonus,
} from '../game/types';
import { GnozianGlyph, CivEmblem, type GnozianGlyphName } from './ui';
import {
  RESOURCE_COLORS,
  TERRAIN_NAMES,
  TERRAIN_COLORS,
  TECHNOLOGIES,
  NATURAL_RESOURCES,
  BUILDINGS,
  UNITS,
  WONDERS,
  GREAT_PEOPLE,
  CIV_TEMPLATES,
} from '../game/constants';
import { calcTileYield, areAtWar, listValidWorkerImprovements, getEmpireStrategicResourceAccess } from '../game/engine';
import { visibleTileBounds } from '../game/hexMetrics';
import { hexDistance } from '../game/mapgen';
import { computeMapDiscoveredCivIndices } from '../game/mapDiscovery';
import { canAttackAtHexDistance, effectiveRangedAttackRange } from '../game/movementRules';
import { commanderForUnit } from '../game/systems/commandersCore';
import { t } from '../i18n';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';
import { playUiClick } from '../audio/AudioManager';
import { useLayoutProfile } from '../hooks/useLayoutProfile';
import { isOpenOceanUnlocked } from '../game/systems/geographyCore';
import { computeResourceSlotSnapshot } from '../game/systems/resourceSlotsCore';
import { calendarYearLabelForTurn } from '../game/calendar';
import { previewCivilizationHudIncome } from '../game/civTurnIncomePreview';

const YIELD_ORDER = ['food', 'production', 'gold', 'science', 'culture', 'faith', 'happiness'] as const;
const STRATEGIC_RESOURCE_ORDER = ['iron', 'coal', 'oil', 'uranium', 'horse'] as const;

const YIELD_GLYPH: Record<(typeof YIELD_ORDER)[number], GnozianGlyphName> = {
  food: 'food',
  production: 'cog',
  gold: 'trophy',
  science: 'flask',
  culture: 'culture',
  faith: 'religion',
  happiness: 'sparkles',
};

const RESOURCE_GLYPH: Record<string, GnozianGlyphName> = {
  wheat: 'food',
  cattle: 'shield',
  sheep: 'food',
  fish: 'lake',
  deer: 'bow',
  gold_ore: 'trophy',
  silver: 'star',
  gems: 'sparkles',
  spices: 'culture',
  silk: 'palette',
  iron: 'pickaxe',
  coal: 'pickaxe',
  oil: 'cog',
  uranium: 'warn',
  horse: 'foot',
};

function formatHudCompactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const withComma = (n: number) => n.toFixed(1).replace('.', ',');
  if (abs >= 1_000_000_000) return `${sign}${withComma(abs / 1_000_000_000)}b`;
  if (abs >= 1_000_000) return `${sign}${withComma(abs / 1_000_000)}m`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1_000)}k`;
  if (abs >= 1_000) return `${sign}${withComma(abs / 1_000)}k`;
  return `${value}`;
}

type HudYield = (typeof YIELD_ORDER)[number];

function hudResourceStockValue(civ: GameState['civilizations'][number], res: HudYield): number {
  switch (res) {
    case 'science':
      return civ.researchProgress ?? 0;
    case 'culture':
      return civ.civicProgress ?? 0;
    case 'faith':
      return civ.faithPool ?? 0;
    default:
      return civ.resources[res] ?? 0;
  }
}

function unitGlyph(t: Unit['type']): GnozianGlyphName {
  if (t === 'settler') return 'home';
  if (t === 'worker') return 'hammer';
  if (t === 'scout') return 'compass';
  if (
    t.includes('archer') ||
    t === 'catapult' ||
    t === 'bomber' ||
    t === 'fighter' ||
    t === 'artillery'
  )
    return 'bow';
  return 'sword';
}

function productionItemName(item: ProductionItem | undefined): string {
  if (!item) return '';
  if (item.type === 'building') return BUILDINGS[item.id]?.name ?? String(item.id);
  if (item.type === 'wonder') return WONDERS[item.id]?.name ?? String(item.id);
  return UNITS[item.id]?.name ?? String(item.id);
}

interface Props {
  gameState: GameState;
  /** Live map camera for minimap viewport (may differ from gameState.camera while panning). */
  viewportCamera: { x: number; y: number; zoom: number };
  /** Main map canvas size in CSS pixels (from GameCanvas ResizeObserver). */
  mapViewportWidth: number;
  mapViewportHeight: number;
  onEndTurn: () => void;
  onOpenTechTree: () => void;
  onOpenDiplomacy: () => void;
  onOpenEmpire: () => void;
  onOpenPause: () => void;
  onOpenSettings: () => void;
  onOpenAchievements: () => void;
  onOpenVictoryTracker: () => void;
  onOpenGreatPeople: () => void;
  onOpenStats: () => void;
  onOpenHelp: () => void;
  showHelpPanel?: boolean;
  showStatsPanel?: boolean;
  showVictoryTrackerPanel?: boolean;
  showGreatPeoplePanel?: boolean;
  onOpenCity: (cityId: number) => void;
  onFoundCity: () => void;
  onAttackCity: (cityId: number) => void;
  onStackUnitsToMove: (n: number) => void;
  onActivateGreatPerson: (unitId: number, cityId: number) => void;
  onBuildImprovement: (unitId: number, improvement: ImprovementType) => void;
  onAppointCommander: (unitId: number) => void;
  onAssignCommander: (unitId: number, commanderId: string) => void;
  onUnassignCommander: (unitId: number) => void;
  onActivateCommander: (commanderId: string) => void;
  onSetScoutAutoExplore: (unitId: number, enabled: boolean) => void;
}

export default function HUD({
  gameState,
  viewportCamera,
  mapViewportWidth,
  mapViewportHeight,
  onEndTurn,
  onOpenTechTree,
  onOpenDiplomacy,
  onOpenEmpire,
  onOpenPause,
  onOpenSettings,
  onOpenAchievements,
  onOpenVictoryTracker,
  onOpenGreatPeople,
  onOpenStats,
  onOpenHelp,
  showHelpPanel = false,
  showStatsPanel = false,
  showVictoryTrackerPanel = false,
  showGreatPeoplePanel = false,
  onOpenCity,
  onFoundCity,
  onAttackCity,
  onStackUnitsToMove,
  onActivateGreatPerson,
  onBuildImprovement,
  onAppointCommander,
  onAssignCommander,
  onUnassignCommander,
  onActivateCommander,
  onSetScoutAutoExplore,
}: Props) {
  const me = useLocalPlayerCivIndex();
  const layoutProfile = useLayoutProfile();
  const compactHud = layoutProfile === 'mobile';
  const [mobileMore,setMobileMore]=useState(false);
  const [mobileCities,setMobileCities]=useState(false);
  const [mobileMap,setMobileMap]=useState(false);
  const mobileHudScale = compactHud ? Math.max(0.74, Math.min(0.96, mapViewportWidth / 980)) : 1;
  const mobileSideScale = compactHud ? Math.max(0.72, Math.min(0.9, mapViewportWidth / 1060)) : 1;
  const humanCiv = gameState.civilizations[me] ?? gameState.civilizations[0]!;
  const unitCommandsLocked = gameState.currentCivIndex !== me;

  const selectedUnit = useMemo((): Unit | null => {
    if (!gameState.selectedUnitId) return null;
    return gameState.units.find(u => u.id === gameState.selectedUnitId) ?? null;
  }, [gameState.selectedUnitId, gameState.units]);

  const selectedTile = useMemo((): Tile | null => {
    if (!gameState.selectedTile) return null;
    return gameState.tiles[gameState.selectedTile.r]?.[gameState.selectedTile.q] ?? null;
  }, [gameState.selectedTile, gameState.tiles]);

  const cityOnTile = useMemo((): City | null => {
    if (!selectedTile || selectedTile.city == null) return null;
    return gameState.cities.find(c => c.id === selectedTile.city) ?? null;
  }, [selectedTile, gameState.cities]);

  const incomeForHud = useMemo(() => previewCivilizationHudIncome(gameState, me), [gameState, me]);
  const leaderBonusBadges = useMemo(() => {
    const byName = CIV_TEMPLATES.find(c => c.name === humanCiv.name);
    const fallback = CIV_TEMPLATES[me % CIV_TEMPLATES.length];
    const tpl = byName ?? fallback;
    if (!tpl) return [];
    const b: CivLeaderBonus = tpl.bonuses ?? {};
    const out: Array<{ id: string; glyph: GnozianGlyphName; value: string; tone: string; title: string }> = [];
    const addPct = (id: string, n: number | undefined, glyph: GnozianGlyphName, tone: string, yieldKey: string) => {
      if (!n) return;
      out.push({
        id,
        glyph,
        value: `+${n}%`,
        tone,
        title: t('civ.bonus.pctLine', { n, yield: t(yieldKey) }),
      });
    };
    addPct('science', b.sciencePct, 'flask', 'text-sky-200', 'city.yield.science');
    addPct('culture', b.culturePct, 'culture', 'text-violet-200', 'city.yield.culture');
    addPct('production', b.productionPct, 'cog', 'text-amber-200', 'city.yield.production');
    addPct('gold', b.goldPct, 'trophy', 'text-yellow-200', 'city.yield.gold');
    addPct('faith', b.faithPct, 'religion', 'text-teal-200', 'city.yield.faith');
    addPct('food', b.foodPct, 'food', 'text-emerald-200', 'city.yield.food');
    addPct('happiness', b.happinessPct, 'sparkles', 'text-pink-200', 'civ.yield.happiness');
    if (b.combatStrengthPct) {
      out.push({
        id: 'combat',
        glyph: 'sword',
        value: `+${b.combatStrengthPct}%`,
        tone: 'text-rose-200',
        title: t('civ.bonus.combatPct', { n: b.combatStrengthPct }),
      });
    }
    if (b.diplomaticFavorFlat) {
      out.push({
        id: 'diplo',
        glyph: 'globe',
        value: `+${b.diplomaticFavorFlat}/t`,
        tone: 'text-cyan-200',
        title: t('civ.bonus.diploPerTurn', { n: b.diplomaticFavorFlat }),
      });
    }
    return out.slice(0, 4);
  }, [humanCiv.name, me, t]);
  const strategicAccess = useMemo(
    () => getEmpireStrategicResourceAccess(gameState, me),
    [gameState.tiles, gameState.civilizations, me]
  );

  const currentTech = humanCiv.currentResearch ? TECHNOLOGIES[humanCiv.currentResearch] : null;
  const techPct = currentTech
    ? Math.min(100, (humanCiv.researchProgress / currentTech.cost) * 100)
    : 0;

  const unitsWithMoves = useMemo(
    () => gameState.units.filter(u => u.owner === me && u.movement > 0 && !u.hasAttacked),
    [gameState.units, me]
  );
  const cityProductionAlerts = useMemo(() => {
    const myCities = gameState.cities.filter(c => c.owner === me);
    let idle = 0;
    let readySoon = 0;
    for (const city of myCities) {
      const top = city.productionQueue[0];
      if (!top) {
        idle++;
        continue;
      }
      const remaining = top.cost - top.progress;
      const turns = Math.ceil(remaining / Math.max(1, city.yields.production));
      if (turns <= 1) readySoon++;
    }
    return { idle, readySoon };
  }, [gameState.cities, me]);

  const mapDiscoveredCivs = useMemo(() => computeMapDiscoveredCivIndices(gameState, me), [gameState, me]);

  const warCivs = useMemo(
    () =>
      gameState.civilizations.filter(
        (_, i) => i !== me && mapDiscoveredCivs.has(i) && areAtWar(gameState, me, i)
      ),
    [gameState, gameState.relations, me, mapDiscoveredCivs]
  );

  const movableStackIds = useMemo(() => {
    if (!selectedUnit || selectedUnit.owner !== me) return [];
    return gameState.units
      .filter(
        u =>
          u.owner === me &&
          u.q === selectedUnit.q &&
          u.r === selectedUnit.r &&
          u.type === selectedUnit.type &&
          u.movement > 0 &&
          !u.hasAttacked
      )
      .sort((a, b) => a.id - b.id)
      .map(u => u.id);
  }, [gameState.units, selectedUnit, me]);

  const otherCivs = useMemo(
    () =>
      gameState.civilizations.filter((c, i) => i !== me && c.isAlive && mapDiscoveredCivs.has(i)),
    [gameState.civilizations, me, mapDiscoveredCivs]
  );
  const geographyStats = useMemo(() => {
    const g = gameState.systems.geographyProgress;
    const discovered = Math.max(0, Number(g?.distantLandsDiscoveredByCiv?.[me] ?? 0));
    const total = Math.max(0, Number(g?.distantLandsTotalByCiv?.[me] ?? 0));
    return {
      oceanUnlocked: isOpenOceanUnlocked(gameState, me),
      discovered,
      total,
    };
  }, [gameState, me]);
  const resourceSlots = useMemo(() => computeResourceSlotSnapshot(gameState, me), [gameState, me]);
  const calendarYearLabel = useMemo(() => calendarYearLabelForTurn(gameState.turn), [gameState.turn]);

  return (
    <>
      {compactHud && <>
        <nav className="rhm-toolbar pointer-events-auto" aria-label={t('game.controls.title')}>
          <button type="button" onClick={() => {setMobileCities(v=>!v);setMobileMore(false);}} aria-expanded={mobileCities}
            className={mobileCities?'rhm-tile rhm-selected':'rhm-tile'} aria-label={t('game.empire')}>
            <GnozianGlyph name="empire" size={21}/><small>{t('game.empire')}</small>
          </button>
          <button type="button" onClick={onOpenTechTree} className="rhm-tile" aria-label={t('tech.title')}>
            <GnozianGlyph name="flask" size={21}/><small>{t('tech.title')}</small>
          </button>
          <div className="rhm-turn"><strong>{gameState.turn}</strong><span>{t('game.turn')}</span></div>
          <button type="button" onClick={onOpenDiplomacy} className="rhm-tile" aria-label={t('game.diplomacy')}>
            <GnozianGlyph name="globe" size={21}/><small>{t('game.diplomacy')}</small>
          </button>
          <button type="button" className={mobileMore?'rhm-tile rhm-selected':'rhm-tile'}
            onClick={()=>{setMobileMore(v=>!v);setMobileCities(false);}} aria-expanded={mobileMore}
            aria-label={t('settings.title')}> <GnozianGlyph name="menu" size={21}/><small>{t('game.controls.title')}</small>
          </button>
        </nav>
        {mobileMore && <aside className="rhm-drawer pointer-events-auto" aria-label={t('game.controls.title')}>
          <button type="button" onClick={()=>{setMobileMore(false);onOpenPause();}}>
            <GnozianGlyph name="home" size={21}/>{t('game.pause')}</button>
          <button type="button" onClick={()=>{setMobileMore(false);onOpenSettings();}}>
            <GnozianGlyph name="gear" size={21}/>{t('settings.title')}</button>
          <button type="button" onClick={()=>{setMobileMore(false);onOpenGreatPeople();}}>
            <GnozianGlyph name="star" size={21}/>{t('game.greatPeople')}</button>
          <button type="button" onClick={()=>{setMobileMore(false);onOpenVictoryTracker();}}>
            <GnozianGlyph name="target" size={21}/>{t('game.victoryTracker')}</button>
          <button type="button" onClick={()=>{setMobileMore(false);onOpenAchievements();}}>
            <GnozianGlyph name="trophy" size={21}/>{t('menu.achievements')}</button>
          <button type="button" onClick={()=>{setMobileMore(false);onOpenStats();}}>
            <GnozianGlyph name="chart" size={21}/>{t('game.statistics')}</button>
          <button type="button" onClick={()=>{setMobileMore(false);onOpenHelp();}}>
            <GnozianGlyph name="book" size={21}/>{t('game.controls.title')}</button>
          <button type="button" onClick={()=>{setMobileMore(false);setMobileMap(v=>!v);}}>
            <GnozianGlyph name="map" size={21}/>{mobileMap?'−':''} Mini map</button>
          <div className="rhm-drawer-resources">
            {STRATEGIC_RESOURCE_ORDER.map(id=><span key={id}>
              <GnozianGlyph name={RESOURCE_GLYPH[id]??'pickaxe'} size={16}/>
              {id}: {strategicAccess[id]??0}</span>)}
          </div>
        </aside>}
      </>}
      {/* ——— Top center: command strip (1:1 style) ——— */}
      <header
        className={`pointer-events-none absolute top-0 left-0 right-0 z-40 flex items-start justify-center pt-[max(0.25rem,env(safe-area-inset-top,0px))] ${compactHud?'hidden':''}`}
        style={compactHud ? { transform: `scale(${mobileHudScale})`, transformOrigin: 'top center' } : undefined}
      >
        <div className={`pointer-events-auto hud-ref-frame hud-ref-topbar flex items-center justify-center gap-2 px-3 py-2 ${
          compactHud
            ? 'w-[min(98vw,44rem)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : ''
        }`}>
          <TopCmdButton
            icon="flask"
            onClick={onOpenTechTree}
            title={t('tech.title')}
            progress={currentTech ? techPct : 0}
            glow={!!currentTech}
          />
          <TopCmdButton icon="globe" onClick={onOpenDiplomacy} title={t('game.diplomacy')} />
          <TopCmdButton icon="empire" onClick={onOpenEmpire} title={t('game.empire')} />
          <TopCmdButton
            icon="target"
            onClick={onOpenVictoryTracker}
            title={t('game.victoryTracker')}
            active={showVictoryTrackerPanel}
          />
          <div className="mx-1.5 h-8 w-px bg-amber-900/45" />
          <div className="min-w-[7rem] rounded-md border border-stone-700/40 bg-black/40 px-3 py-1.5 text-center">
            <div className="font-serif text-2xl font-bold leading-none tabular-nums text-stone-300">
              {String(gameState.turn).padStart(2, '0')}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400">{t('game.turn')}</div>
            <div className="mt-0.5 text-[10px] font-semibold tracking-wide text-cyan-300/90">
              {calendarYearLabel}
            </div>
          </div>
          <div className="mx-1.5 h-8 w-px bg-amber-900/45" />
          <TopCmdButton
            icon="star"
            onClick={onOpenGreatPeople}
            title={t('game.greatPeople')}
            active={showGreatPeoplePanel}
          />
          <TopCmdButton icon="trophy" onClick={onOpenAchievements} title={t('menu.achievements')} />
          <TopCmdButton icon="chart" onClick={onOpenStats} title={t('game.statistics')} active={showStatsPanel} />
          <TopCmdButton icon="book" onClick={onOpenHelp} title={t('game.controls.title')} active={showHelpPanel} />
        </div>
      </header>

      {/* top-right system commands */}
      <div
        className={`pointer-events-none absolute right-[clamp(0.35rem,0.8vw,0.65rem)] top-[clamp(0.25rem,0.6vw,0.5rem)] z-40 ${compactHud?'hidden':''}`}
        style={compactHud ? { transform: `scale(${mobileHudScale})`, transformOrigin: 'top right' } : undefined}
      >
        <div className="pointer-events-auto hud-ref-frame hud-ref-system flex items-center gap-1 px-1.5 py-1">
          <TopCmdButton icon="home" onClick={onOpenPause} title={t('game.pause')} />
          <TopCmdButton icon="gear" onClick={onOpenSettings} title={t('settings.title')} />
        </div>
      </div>

      {/* War banner */}
      <AnimatePresence>
        {warCivs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 ${
              compactHud ? 'top-20' : 'top-16'
            }`}
          >
            <div className="rounded-xl border border-red-600/45 bg-gradient-to-r from-red-950/98 to-red-900/92 px-6 py-1.5 text-center shadow-[0_8px_28px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wide text-red-200/95">
                <GnozianGlyph name="swords" size={14} className="text-red-300" />
                <span>
                  {t('game.warWith')} {warCivs.map(c => c.name).join(', ')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-right cluster: minimap */}
      <div className={`pointer-events-none absolute z-50 ${compactHud ? (mobileMap?'rhm-mobile-map':'hidden') : 'hud-ref-minimap-pos'}`}>
        <MiniMap
          gameState={gameState}
          viewportCamera={viewportCamera}
          mapViewportWidth={mapViewportWidth}
          mapViewportHeight={mapViewportHeight}
          localViewerCivIndex={me}
          compact={compactHud}
        />
      </div>

      {/* Left info stack */}
      <aside
        className={`pointer-events-none absolute z-30 max-h-[min(76vh,620px)] w-[clamp(14.5rem,21vw,20rem)] hud-ref-civcard-pos ${compactHud?(mobileCities?'rhm-city-open':'hidden'):''}`}
        style={compactHud ? undefined : { transform: `scale(${mobileSideScale})`, transformOrigin: 'top left' }}
      >
        <div className="pointer-events-auto hud-ref-frame hud-ref-civcard flex max-h-full flex-col overflow-hidden">
          <div className="border-b border-stone-700/60 bg-black/40 px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <CivEmblem
                  primary={humanCiv.color}
                  secondary={humanCiv.secondaryColor}
                  variant={me}
                  size={24}
                  className="ring-1 ring-white/20"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-stone-100">{humanCiv.name}</div>
                  <div className="mt-0.5 text-[11px] text-amber-500/90">{t(`era.${humanCiv.era}`)}</div>
                </div>
              </div>
              {leaderBonusBadges.length > 0 && (
                <div className="max-w-[54%] shrink-0">
                  <div className="grid auto-cols-max grid-flow-col gap-1.5 justify-end">
                    {leaderBonusBadges.map(badge => (
                      <div
                        key={badge.id}
                        title={badge.title}
                        className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-800/60 bg-sky-950/55 shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
                      >
                        <GnozianGlyph name={badge.glyph} size={11} className={badge.tone} />
                        <span
                          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-sky-700/70 bg-sky-950/95 px-1 py-[1px] text-[8px] font-bold leading-none tabular-nums shadow ${badge.tone}`}
                        >
                          {badge.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {otherCivs.map((civ, idx) => {
                const civIndex = gameState.civilizations.indexOf(civ);
                return (
                  <CivEmblem
                    key={`${civ.id}-${idx}`}
                    primary={civ.color}
                    secondary={civ.secondaryColor}
                    variant={civIndex}
                    size={16}
                    className="shrink-0 ring-1 ring-white/15"
                    title={`${civ.name} · ${civ.score}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="border-b border-stone-700/60 bg-black/30 px-3.5 py-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            <div className="mb-2 grid grid-cols-1 gap-1.5 text-[10px] font-semibold normal-case tracking-normal text-cyan-300/85 sm:grid-cols-2">
              <span className={`rounded px-2 py-1 ${geographyStats.oceanUnlocked ? 'bg-cyan-900/50 text-cyan-200' : 'bg-stone-800/80 text-stone-400'}`}>
                {t('hud.ocean')}: {geographyStats.oceanUnlocked ? t('hud.unlocked') : t('hud.locked')}
              </span>
              <span className="rounded bg-cyan-950/50 px-2 py-1 text-cyan-200">
                {t('hud.distantLands')}: {geographyStats.discovered}/{geographyStats.total}
              </span>
              <span className="rounded bg-amber-950/50 px-2 py-1 text-amber-200 sm:col-span-2">
                {t('hud.slotsBLS')}: {resourceSlots.slotted.bonus}/{resourceSlots.slotted.luxury}/{resourceSlots.slotted.strategic}
              </span>
            </div>
            <span className="inline-flex items-center gap-1">
              <GnozianGlyph name="city" size={14} className="text-amber-400/90" />
              {t('game.cities')} ({humanCiv.cities.length})
            </span>
          </div>
          <div className="overflow-y-auto p-2 [scrollbar-width:thin]">
            {humanCiv.cities.map(cityId => {
              const city = gameState.cities.find(c => c.id === cityId);
              if (!city) return null;
              const turnsToComplete = city.productionQueue[0]
                ? Math.ceil(
                    (city.productionQueue[0].cost - city.productionQueue[0].progress) /
                      Math.max(1, city.yields.production)
                  )
                : null;
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => onOpenCity(city.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/5"
                >
                  <span className="flex w-5 shrink-0 justify-center text-amber-200/90">
                    <GnozianGlyph name={city.isCapital ? 'crown' : 'city'} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-stone-100">{city.name}</div>
                    <div className="text-[10px] text-stone-500">
                      {t('hud.population')} {city.population}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[10px] text-stone-500">
                    {city.productionQueue[0] ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="max-w-[92px] truncate text-[9px] font-medium text-stone-400" title={productionItemName(city.productionQueue[0])}>
                          {productionItemName(city.productionQueue[0])}
                        </span>
                        <span className="text-orange-400 tabular-nums">
                          <GnozianGlyph name="cog" size={11} className="inline text-orange-400" />
                          {turnsToComplete}
                          {t('hud.turnsToComplete')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-stone-600">{t('hud.idle')}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Unit / tile panel — must stack above bottom resources strip (z-40) */}
      <AnimatePresence>
        {(selectedUnit || selectedTile) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-none absolute z-[45] ${
              compactHud
                ? 'rhm-unit-panel left-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] w-[min(92vw,23rem)] -translate-x-1/2'
                : 'right-[clamp(12.6rem,19vw,17.8rem)] bottom-[max(0.45rem,env(safe-area-inset-bottom,0px))] w-[min(40vw,18.75rem)]'
            }`}
          >
            <div className={`pointer-events-auto gnz-panel overflow-y-auto rounded-xl p-1.5 [scrollbar-width:thin] ${compactHud?'rhm-action-panel max-h-[min(49vh,24rem)]':'max-h-[min(42vh,17.25rem)]'}`}>
              {selectedUnit && (
                <UnitBlock
                  selectedUnit={selectedUnit}
                  gameState={gameState}
                  cityOnTile={cityOnTile}
                  localCiv={me}
                  onFoundCity={onFoundCity}
                  onAttackCity={onAttackCity}
                  onActivateGreatPerson={onActivateGreatPerson}
                  onBuildImprovement={onBuildImprovement}
                  onAppointCommander={onAppointCommander}
                  onAssignCommander={onAssignCommander}
                  onUnassignCommander={onUnassignCommander}
                  onActivateCommander={onActivateCommander}
                  onSetScoutAutoExplore={onSetScoutAutoExplore}
                  unitCommandsLocked={unitCommandsLocked}
                  stackCount={movableStackIds.length}
                  stackUnitsToMove={gameState.stackUnitsToMove ?? 9999}
                  onStackUnitsToMove={onStackUnitsToMove}
                />
              )}
              {selectedTile && (
                <TileBlock
                  tile={selectedTile}
                  showTopBorder={!!selectedUnit}
                  gameState={gameState}
                  cityOnTile={cityOnTile}
                  viewerCivIndex={me}
                  onOpenCity={onOpenCity}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`pointer-events-none absolute bottom-0 left-0 right-0 z-40 flex justify-center px-1 sm:px-2 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] ${compactHud?'rhm-bottom-wrap':''}`}
      >
        <div className={`pointer-events-auto hud-ref-frame hud-ref-bottom gap-2 px-3 py-2.5 sm:px-4 ${compactHud?'rhm-bottom flex flex-row-reverse items-center':'flex flex-col'}`}>
          <div className={compactHud?'rhm-endturn-slot':'flex items-center justify-center'}>
            <button
              type="button"
              data-sfx="confirm"
              onClick={() => {
                onEndTurn();
              }}
              className={`hud-ref-endturn rounded-md px-7 py-2 text-center font-serif text-sm font-bold uppercase tracking-wide shadow-lg transition-transform active:scale-[0.98] sm:px-10 ${
                unitsWithMoves.length > 0 ? 'gnz-menu-btn--aux animate-pulse-glow' : ''
              }`}
            >
              {t('game.endTurn')}
            </button>
          </div>
          <div
            className={`grid w-full ${
              compactHud
                ? 'rhm-yields'
                : 'grid-cols-[repeat(7,minmax(3.7rem,1fr))] gap-1.5'
            }`}
          >
            {YIELD_ORDER.map(res => {
              const perTurn = Math.round(incomeForHud[res] ?? 0);
              const stock = Math.round(hudResourceStockValue(humanCiv, res));
              const color = RESOURCE_COLORS[res];
              const stockLabel =
                res === 'science'
                  ? t('hud.researchProgress')
                  : res === 'culture'
                    ? t('hud.civicProgress')
                    : res === 'faith'
                      ? t('hud.faithPool')
                      : res === 'production'
                        ? t('hud.productionReserve')
                        : res;
              return (
                <div
                  key={res}
                  className={`flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-md border border-amber-900/20 bg-black/20 px-1.5 py-1 ${compactHud?'rhm-yield-item':''}`}
                  title={`${stockLabel} · ${perTurn >= 0 ? '+' : ''}${perTurn}/t`}
                >
                  <GnozianGlyph name={YIELD_GLYPH[res]} size={compactHud ? 15 : 16} className="shrink-0 text-stone-300/95" />
                  <div className="flex min-w-0 flex-col leading-none">
                    <motion.span
                      key={`${res}-stock-${stock}`}
                      initial={{ opacity: 0.45, y: -2, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18 }}
                      className={`${compactHud ? 'text-sm' : 'text-base'} font-bold tabular-nums`}
                      style={{ color }}
                    >
                      {formatHudCompactNumber(stock)}
                    </motion.span>
                    <motion.span
                      key={`${res}-income-${perTurn}`}
                      initial={{ opacity: 0.35, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="text-[9px] font-semibold tabular-nums"
                      style={{ color: perTurn < 0 ? '#e74c3c' : color }}
                    >
                      {perTurn > 0 ? '+' : perTurn < 0 ? '-' : ''}
                      {formatHudCompactNumber(Math.abs(perTurn))}/t
                    </motion.span>
                  </div>
                </div>
              );
            })}
            <div className={`${compactHud ? 'hidden' : 'col-span-7'} grid grid-cols-[auto_repeat(5,minmax(2.4rem,1fr))] items-center gap-1 rounded border border-sky-900/35 bg-sky-950/15 px-1.5 py-1`}>
              <span className="shrink-0 rounded border border-sky-900/45 bg-sky-950/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-stone-500">
                STR
              </span>
              {STRATEGIC_RESOURCE_ORDER.map(resId => {
                const stock = Math.round(strategicAccess[resId] ?? 0);
                const resourceDef = NATURAL_RESOURCES[resId];
                const labelKey = `resource.name.${resId}`;
                const label = t(labelKey);
                return (
                  <div
                    key={`strategic-${resId}`}
                    className="flex min-h-[1.65rem] items-center justify-center gap-1 rounded bg-black/20 px-1"
                    title={label !== labelKey ? label : resourceDef?.name ?? resId}
                  >
                    <GnozianGlyph name={RESOURCE_GLYPH[resId] ?? 'pickaxe'} size={compactHud ? 13 : 14} className="text-stone-300/95" />
                    <span className={`${compactHud ? 'text-xs' : 'text-sm'} font-bold tabular-nums text-sky-300`}>
                      {formatHudCompactNumber(stock)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {(cityProductionAlerts.idle > 0 || cityProductionAlerts.readySoon > 0) && (
          <div className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2">
            <div className="pointer-events-auto gnz-panel flex items-center gap-2 rounded-lg px-3 py-1 text-[10px]">
              {cityProductionAlerts.readySoon > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <GnozianGlyph name="cog" size={11} />
                  {cityProductionAlerts.readySoon} {t('hud.readySoon')}
                </span>
              )}
              {cityProductionAlerts.idle > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <GnozianGlyph name="warn" size={11} />
                  {cityProductionAlerts.idle} {t('hud.idleCities')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* marker legend removed by request */}
    </>
  );
}

function TopCmdButton({
  icon,
  title,
  onClick,
  active = false,
  progress = 0,
  glow = false,
}: {
  icon: GnozianGlyphName;
  title: string;
  onClick: () => void;
  active?: boolean;
  progress?: number;
  glow?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <button
      type="button"
      onClick={() => {
        playUiClick();
        onClick();
      }}
      title={title}
      className={`relative hud-icon-btn flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border transition-colors ${
        active
          ? 'border-stone-500/60 bg-stone-700/80 text-stone-100'
          : 'border-stone-700/70 bg-black/40 text-stone-300 hover:border-stone-500/60 hover:text-stone-100'
      } ${glow && clamped > 0 ? 'shadow-[0_0_12px_rgba(56,189,248,0.5)]' : ''}`}
    >
      {clamped > 0 && (
        <span
          className="absolute bottom-0 left-0 h-full bg-gradient-to-t from-sky-500/65 to-cyan-400/15"
          style={{ width: `${clamped}%` }}
        />
      )}
      <span className="relative z-10">
        <GnozianGlyph name={icon} size={19} />
      </span>
    </button>
  );
}

const GREAT_PERSON_UNIT_TYPES: Unit['type'][] = [
  'great_general',
  'great_scientist',
  'great_artist',
  'great_merchant',
  'great_engineer',
  'great_writer',
  'great_musician',
  'great_prophet',
  'great_admiral',
];

function UnitBlock({
  selectedUnit,
  gameState,
  cityOnTile,
  localCiv,
  onFoundCity,
  onAttackCity,
  onActivateGreatPerson,
  onBuildImprovement,
  onAppointCommander,
  onAssignCommander,
  onUnassignCommander,
  onActivateCommander,
  onSetScoutAutoExplore,
  unitCommandsLocked,
  stackCount,
  stackUnitsToMove,
  onStackUnitsToMove,
}: {
  selectedUnit: Unit;
  gameState: GameState;
  cityOnTile: City | null;
  localCiv: number;
  onFoundCity: () => void;
  onAttackCity: (id: number) => void;
  onActivateGreatPerson: (unitId: number, cityId: number) => void;
  onBuildImprovement: (unitId: number, improvement: ImprovementType) => void;
  onAppointCommander: (unitId: number) => void;
  onAssignCommander: (unitId: number, commanderId: string) => void;
  onUnassignCommander: (unitId: number) => void;
  onActivateCommander: (commanderId: string) => void;
  onSetScoutAutoExplore: (unitId: number, enabled: boolean) => void;
  unitCommandsLocked: boolean;
  stackCount: number;
  stackUnitsToMove: number;
  onStackUnitsToMove: (n: number) => void;
}) {
  const showStack = selectedUnit.owner === localCiv && stackCount > 1;
  const workerBuildOptions =
    selectedUnit.type === 'worker' && selectedUnit.owner === localCiv
      ? listValidWorkerImprovements(gameState, selectedUnit.id)
      : [];
  const oneActive = stackUnitsToMove <= 1;
  const allActive = stackUnitsToMove >= 9999 || stackUnitsToMove >= stackCount;
  const stackPresets = [2, 3, 5, 10].filter(n => n > 1 && n < stackCount);
  const distToCityOnTile =
    cityOnTile && cityOnTile.owner !== localCiv
      ? hexDistance(selectedUnit.q, selectedUnit.r, cityOnTile.q, cityOnTile.r)
      : null;
  const canAttackEnemyCityHere =
    cityOnTile != null &&
    cityOnTile.owner !== localCiv &&
    selectedUnit.owner === localCiv &&
    (selectedUnit.strength > 0 || selectedUnit.rangedStrength > 0) &&
    selectedUnit.movement > 0 &&
    !selectedUnit.hasAttacked &&
    distToCityOnTile != null &&
    canAttackAtHexDistance(selectedUnit, distToCityOnTile, 'city');
  const gpDef =
    selectedUnit.greatPersonDefId && GREAT_PEOPLE[selectedUnit.greatPersonDefId]
      ? GREAT_PEOPLE[selectedUnit.greatPersonDefId]
      : null;
  const ownCombat = selectedUnit.owner === localCiv && (selectedUnit.strength > 0 || selectedUnit.rangedStrength > 0);
  const commander = commanderForUnit(gameState, selectedUnit.id);
  const isCommanderUnit = commander?.unitId === selectedUnit.id;
  const candidateCommander = ownCombat
    ? gameState.systems.commanders
        .filter(c => c.ownerCiv === localCiv && c.unitId !== selectedUnit.id)
        .map(c => {
          const leaderUnit = gameState.units.find(u => u.id === c.unitId);
          const d = leaderUnit ? hexDistance(selectedUnit.q, selectedUnit.r, leaderUnit.q, leaderUnit.r) : 999;
          return { c, d };
        })
        .sort((a, b) => a.d - b.d)[0]
    : null;
  return (
    <div className="mb-1.5 border-b border-stone-800/80 pb-1.5 last:mb-0 last:border-0 last:pb-0">
      <div className="mb-1.5 flex items-center gap-2.5">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg ring-2 ring-white/15">
          <CivEmblem
            primary={gameState.civilizations[selectedUnit.owner]?.color || '#888'}
            secondary={gameState.civilizations[selectedUnit.owner]?.secondaryColor || '#444'}
            variant={selectedUnit.owner}
            size={40}
            className="absolute inset-0 scale-105"
          />
          <GnozianGlyph name={unitGlyph(selectedUnit.type)} size={20} className="relative z-10 text-white drop-shadow-md" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight text-stone-100">{selectedUnit.name}</div>
          <div className="text-[10px] text-stone-500">
            {gameState.civilizations[selectedUnit.owner]?.name}
          </div>
        </div>
        {selectedUnit.owner === localCiv && selectedUnit.movement > 0 && !selectedUnit.hasAttacked && (
          <span className="shrink-0 rounded-full border border-emerald-600/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] text-emerald-300">
            {t('hud.ready')}
          </span>
        )}
      </div>
      <div className="mb-1.5">
        <div className="mb-0.5 flex justify-between text-[10px]">
          <span className="text-stone-500">{t('hud.hp')}</span>
          <span className="font-semibold tabular-nums text-stone-200">
            {selectedUnit.hp}/{selectedUnit.maxHp || 100}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-800">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${Math.max(0, Math.min(100, (selectedUnit.hp / (selectedUnit.maxHp || 100)) * 100))}%`,
              backgroundColor: (() => {
                const ratio = selectedUnit.hp / (selectedUnit.maxHp || 100);
                return ratio > 0.6 ? '#2ecc71' : ratio > 0.3 ? '#f39c12' : '#e74c3c';
              })(),
            }}
          />
        </div>
      </div>
      <div className="mb-1.5 grid grid-cols-2 gap-1 text-[10px]">
        {selectedUnit.strength > 0 && (
          <div className="rounded-md border border-stone-800 bg-black/30 p-1 text-center">
            <div className="flex items-center justify-center gap-0.5 font-bold text-red-400">
              <GnozianGlyph name="swords" size={12} className="text-red-400" /> {selectedUnit.strength}
            </div>
            <div className="text-[9px] text-stone-600">{t('hud.strength')}</div>
          </div>
        )}
        {selectedUnit.rangedStrength > 0 && (
          <div className="rounded-md border border-stone-800 bg-black/30 p-1 text-center">
            <div className="flex items-center justify-center gap-0.5 font-bold text-amber-400">
              <GnozianGlyph name="bow" size={12} className="text-amber-400" /> {selectedUnit.rangedStrength}
            </div>
            <div className="text-[9px] text-stone-600">
              {t('hud.range')} {effectiveRangedAttackRange(selectedUnit)}/{selectedUnit.range}
            </div>
          </div>
        )}
        <div className="rounded-md border border-stone-800 bg-black/30 p-1 text-center">
          <div className="font-bold text-emerald-400">
            <span className="inline-flex items-center justify-center gap-0.5">
              <GnozianGlyph name="foot" size={12} className="text-stone-400" /> {selectedUnit.movement}/
              {selectedUnit.maxMovement}
            </span>
          </div>
          <div className="text-[9px] text-stone-600">{t('hud.movement')}</div>
        </div>
        {selectedUnit.type === 'worker' && (
          <div className="rounded-md border border-stone-800 bg-black/30 p-1 text-center">
            <div className="font-bold tabular-nums text-amber-300">
              {selectedUnit.workerBuildsRemaining ?? 3}/3
            </div>
            <div className="text-[9px] text-stone-600">{t('hud.workerBuilds')}</div>
          </div>
        )}
      </div>
      {showStack && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 rounded-md border border-stone-700/50 bg-black/50 px-2 py-1.5">
          <span className="text-[10px] text-stone-400">{t('hud.stackMove')}</span>
          <button
            type="button"
            onClick={() => onStackUnitsToMove(1)}
            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
              oneActive ? 'bg-amber-700 text-white' : 'bg-stone-800 text-stone-300'
            }`}
          >
            {t('hud.stackOne')}
          </button>
          {stackPresets.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onStackUnitsToMove(n)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                stackUnitsToMove === n && !allActive
                  ? 'bg-amber-700 text-white'
                  : 'bg-stone-800 text-stone-300'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onStackUnitsToMove(9999)}
            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
              allActive ? 'bg-amber-700 text-white' : 'bg-stone-800 text-stone-300'
            }`}
          >
            {t('hud.stackAll')} ({stackCount})
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ownCombat && (
          <div className="mb-1 w-full rounded-lg border border-cyan-900/35 bg-cyan-950/20 p-1.5">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-cyan-300/90">
              {t('hud.commander.section')}
            </div>
            {commander ? (
              <div className="mb-1 text-[9px] text-cyan-100">
                {commander.id} · {commander.domain} · {t('hud.commander.lvlShort', { level: commander.level })}
                {isCommanderUnit ? ` · ${t('hud.commander.leadUnit')}` : ` · ${t('hud.commander.assignedUnit')}`}
              </div>
            ) : (
              <div className="mb-1 text-[9px] text-cyan-200/80">{t('hud.commander.none')}</div>
            )}
            <div className="flex flex-wrap gap-1">
              {!commander && (
                <button
                  type="button"
                  onClick={() => onAppointCommander(selectedUnit.id)}
                  className="rounded-md border border-cyan-700/50 bg-cyan-900/45 px-2 py-0.5 text-[9px] font-bold text-cyan-100"
                >
                  {t('hud.commander.appoint')}
                </button>
              )}
              {!commander && candidateCommander && candidateCommander.d <= 5 && (
                <button
                  type="button"
                  onClick={() => onAssignCommander(selectedUnit.id, candidateCommander.c.id)}
                  className="rounded-md border border-blue-700/50 bg-blue-900/45 px-2 py-0.5 text-[9px] font-bold text-blue-100"
                >
                  {t('hud.commander.assignTo', { id: candidateCommander.c.id })}
                </button>
              )}
              {commander && !isCommanderUnit && (
                <button
                  type="button"
                  onClick={() => onUnassignCommander(selectedUnit.id)}
                  className="rounded-md border border-amber-700/50 bg-amber-900/40 px-2 py-0.5 text-[9px] font-bold text-stone-300"
                >
                  {t('hud.commander.leaveCommand')}
                </button>
              )}
              {isCommanderUnit && (
                <button
                  type="button"
                  onClick={() => onActivateCommander(commander.id)}
                  disabled={commander.cooldownTurnsLeft > 0 || commander.activeTurnsLeft > 0}
                  className="rounded-md border border-violet-700/50 bg-violet-900/45 px-2 py-0.5 text-[9px] font-bold text-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {commander.activeTurnsLeft > 0
                    ? t('hud.commander.commandActive', { n: commander.activeTurnsLeft })
                    : commander.cooldownTurnsLeft > 0
                      ? t('hud.commander.cooldown', { n: commander.cooldownTurnsLeft })
                      : t('hud.commander.activate')}
                </button>
              )}
            </div>
          </div>
        )}
        {gpDef && (
          <div className="mb-1 w-full rounded-lg border border-violet-900/35 bg-violet-950/20 p-1.5">
            <div className="text-[10px] font-semibold text-violet-100">{gpDef.name}</div>
            <div className="mt-0.5 text-[9px] text-violet-200/80">{gpDef.uniqueAbility}</div>
          </div>
        )}
        {workerBuildOptions.length > 0 && (
          <div className="mb-1 w-full rounded-lg border border-amber-900/35 bg-black/35 p-1.5">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-stone-400">
              {t('hud.workerBuild')}
            </div>
            <div className="flex flex-wrap gap-1">
              {workerBuildOptions.map(imp => (
                <button
                  key={imp}
                  type="button"
                  onClick={() => {
                    playUiClick();
                    onBuildImprovement(selectedUnit.id, imp);
                  }}
                  disabled={selectedUnit.movement === 0 || unitCommandsLocked}
                  className="rounded-md border border-stone-600 bg-stone-800/90 px-2 py-0.5 text-[9px] font-bold capitalize text-stone-200 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {imp.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedUnit.type === 'scout' && selectedUnit.owner === localCiv && (
          <button
            type="button"
            data-sfx="confirm"
            onClick={() => {
              onSetScoutAutoExplore(selectedUnit.id, !selectedUnit.scoutAutoExplore);
            }}
            disabled={unitCommandsLocked}
            className={`w-full rounded-lg border py-1.5 text-[11px] font-bold shadow ${
              selectedUnit.scoutAutoExplore
                ? 'border-sky-500/60 bg-gradient-to-r from-sky-800 to-cyan-900 text-white'
                : 'border-stone-600 bg-stone-800/95 text-stone-100 hover:bg-stone-700/90'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <GnozianGlyph name="compass" size={14} />
              {selectedUnit.scoutAutoExplore ? t('hud.scoutAutoStop') : t('hud.scoutAutoStart')}
            </span>
          </button>
        )}
        {selectedUnit.type === 'settler' && selectedUnit.owner === localCiv && (
          <button
            type="button"
            data-sfx="city"
            onClick={onFoundCity}
            disabled={selectedUnit.movement === 0 || unitCommandsLocked}
            className="flex-1 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-900 py-1.5 text-[11px] font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="inline-flex items-center justify-center gap-1">
              <GnozianGlyph name="city" size={14} /> {t('hud.foundCity')}
            </span>
          </button>
        )}
        {cityOnTile &&
          cityOnTile.owner === localCiv &&
          selectedUnit.owner === localCiv &&
          GREAT_PERSON_UNIT_TYPES.includes(selectedUnit.type) && (
            <button
              type="button"
              data-sfx="confirm"
              onClick={() => onActivateGreatPerson(selectedUnit.id, cityOnTile.id)}
              className="flex-1 rounded-lg bg-gradient-to-r from-purple-800 to-violet-900 py-1.5 text-[11px] font-bold text-white shadow"
            >
              {t('hud.activateGreatPerson')}
            </button>
          )}
        {cityOnTile &&
          cityOnTile.owner !== localCiv &&
          selectedUnit.owner === localCiv &&
          (selectedUnit.strength > 0 || selectedUnit.rangedStrength > 0) && (
            <button
              type="button"
              data-sfx="combat"
              onClick={() => onAttackCity(cityOnTile.id)}
              disabled={!canAttackEnemyCityHere}
              className="flex-1 rounded-lg bg-gradient-to-r from-red-800 to-rose-900 py-1.5 text-[11px] font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="inline-flex items-center justify-center gap-1">
                <GnozianGlyph name="swords" size={14} /> {t('hud.attackCity')}
              </span>
            </button>
          )}
      </div>
    </div>
  );
}

function TileBlock({
  tile,
  showTopBorder,
  gameState,
  cityOnTile,
  viewerCivIndex,
  onOpenCity,
}: {
  tile: Tile;
  showTopBorder: boolean;
  gameState: GameState;
  cityOnTile: City | null;
  viewerCivIndex: number;
  onOpenCity: (id: number) => void;
}) {
  const st = tile;
  return (
    <div className={showTopBorder ? 'mt-1 border-t border-stone-800 pt-1' : ''}>
      <div className="mb-1 flex items-center gap-1.5">
        <div
          className="h-3.5 w-3.5 shrink-0 rounded shadow-sm"
          style={{ backgroundColor: TERRAIN_COLORS[st.terrain] }}
        />
        <span className="text-[13px] font-semibold leading-tight text-stone-100">{TERRAIN_NAMES[st.terrain]}</span>
        {st.resource && (
          <span className="ml-auto rounded-full border border-amber-800/40 bg-amber-950/40 px-1.5 py-0.5 text-[9px] text-amber-200">
            <span className="inline-flex items-center gap-0.5">
              <GnozianGlyph name={RESOURCE_GLYPH[st.resource] ?? 'target'} size={11} className="text-amber-200/90" />
              {NATURAL_RESOURCES[st.resource]?.name}
            </span>
          </span>
        )}
      </div>
      <div className="mb-0.5 flex flex-wrap gap-1">
        {Object.entries(calcTileYield(st))
          .filter(([, v]) => v > 0)
          .map(([k, v]) => (
            <div key={k} className="flex items-center gap-0.5 rounded bg-black/35 px-1.5 py-0.5">
              <GnozianGlyph
                name={YIELD_GLYPH[k as keyof typeof YIELD_GLYPH] ?? 'target'}
                size={11}
                className="text-stone-300/90"
              />
              <span
                className="text-[11px] font-bold leading-none"
                style={{ color: RESOURCE_COLORS[k as keyof typeof RESOURCE_COLORS] }}
              >
                {v}
              </span>
            </div>
          ))}
      </div>
      {cityOnTile && cityOnTile.owner === viewerCivIndex && (
        <button
          type="button"
          onClick={() => onOpenCity(cityOnTile.id)}
          className="mt-0.5 w-full rounded-md bg-gradient-to-r from-sky-900 to-indigo-950 py-1 text-[10px] font-bold text-white shadow"
        >
          <span className="inline-flex items-center justify-center gap-1">
            <GnozianGlyph name="city" size={14} /> {t('hud.openCity')} {cityOnTile.name}
          </span>
        </button>
      )}
      {cityOnTile && cityOnTile.owner !== viewerCivIndex && (
        <div className="mt-0.5 flex items-center justify-center gap-1 rounded-md border border-stone-700/60 bg-stone-900/60 py-1 text-[10px] text-stone-400">
          <GnozianGlyph name="city" size={12} className="text-stone-500" />
          <span className="font-semibold text-stone-300">{cityOnTile.name}</span>
          <span className="text-[9px] text-stone-500">· {t('hud.foreignCityNoManage')}</span>
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] leading-snug text-stone-500">
        {st.river && (
          <span className="rounded bg-cyan-950/55 px-1 py-0.5 text-cyan-200">
            <span className="inline-flex items-center gap-0.5">
              <GnozianGlyph name="lake" size={11} className="text-cyan-300" /> {t('hud.river')}
            </span>
          </span>
        )}
        <span className="rounded bg-black/30 px-1 py-0.5 font-mono tabular-nums">
          ({st.q}, {st.r})
        </span>
        <span className="min-w-0">
          {st.owner !== null ? gameState.civilizations[st.owner]?.name : t('hud.unclaimed')}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// MINI MAP (memoized; viewport uses live camera)
// ============================================================
const MiniMap = memo(function MiniMap({
  gameState,
  viewportCamera,
  mapViewportWidth,
  mapViewportHeight,
  localViewerCivIndex = 0,
  compact = false,
}: {
  gameState: GameState;
  viewportCamera: { x: number; y: number; zoom: number };
  mapViewportWidth: number;
  mapViewportHeight: number;
  localViewerCivIndex?: number;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const humanCivIndex = localViewerCivIndex;

  const mapW = gameState.tiles[0]?.length ?? 0;
  const mapH = gameState.tiles.length;

  const { miniW, miniH } = useMemo(() => {
    if (!mapW || !mapH) return { miniW: 176, miniH: 100 };
    /* Wider bounding box → typical maps read as horizontal rectangles, not squares */
    const maxW = compact ? 228 : Math.round(Math.max(150, Math.min(210, mapViewportWidth * 0.16)));
    const maxH = compact ? 132 : Math.round(Math.max(84, Math.min(118, mapViewportHeight * 0.18)));
    const aspect = mapW / mapH;
    let w = maxW;
    let h = Math.round(maxW / aspect);
    if (h > maxH) {
      h = maxH;
      w = Math.round(maxH * aspect);
    }
    w = Math.max(w, compact ? 112 : 156);
    h = Math.max(h, compact ? 76 : 104);
    return { miniW: w, miniH: h };
  }, [mapW, mapH, compact]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!mapW || !mapH) return;

    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const cellW = miniW / mapW;
    const cellH = miniH / mapH;
    canvas.width = Math.round(miniW * dpr);
    canvas.height = Math.round(miniH * dpr);
    canvas.style.width = `${miniW}px`;
    canvas.style.height = `${miniH}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0c0a08';
    ctx.fillRect(0, 0, miniW, miniH);

    for (let r = 0; r < mapH; r++) {
      for (let c = 0; c < mapW; c++) {
        const tile = gameState.tiles[r][c];
        const revealed = tile.revealed[humanCivIndex];
        if (!revealed) continue;

        const x = c * cellW;
        const y = r * cellH;
        ctx.fillStyle = TERRAIN_COLORS[tile.terrain];
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);

        if (tile.owner !== null) {
          const civ = gameState.civilizations[tile.owner];
          if (civ) {
            ctx.fillStyle = civ.color + '99';
            ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
          }
        }
      }
    }

    for (const city of gameState.cities) {
      const tile = gameState.tiles[city.r]?.[city.q];
      if (!tile || !tile.revealed[humanCivIndex]) continue;
      const civ = gameState.civilizations[city.owner];
      ctx.fillStyle = civ?.color || '#fff';
      const cx = city.q * cellW + cellW / 2;
      const cy = city.r * cellH + cellH / 2;
      const cr = Math.max(1.5, Math.min(cellW, cellH) * 0.55);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
      if (city.isCapital) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    const cam = viewportCamera;
    const zoom = cam.zoom;
    const vpW = Math.max(1, mapViewportWidth);
    const vpH = Math.max(1, mapViewportHeight);
    const { startQ, startR, endQ, endR } = visibleTileBounds(cam.x, cam.y, zoom, vpW, vpH, mapW, mapH, 0);
    const miniVpX = startQ * cellW;
    const miniVpY = startR * cellH;
    const miniVpW = Math.max(cellW, (endQ - startQ + 1) * cellW);
    const miniVpH = Math.max(cellH, (endR - startR + 1) * cellH);

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(miniVpX, miniVpY, miniVpW, miniVpH);

    ctx.strokeStyle = 'rgba(201, 162, 39, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, miniW, miniH);
  }, [gameState, viewportCamera, mapViewportWidth, mapViewportHeight, humanCivIndex, miniW, miniH, mapW, mapH]);

  return (
    <div
      className={`pointer-events-none ${compact ? 'max-w-[min(92vw,13.5rem)]' : 'max-w-[min(100vw,19rem)]'}`}
    >
      <div className="pointer-events-auto hud-ref-frame hud-ref-minimap rounded-sm p-1">
        <canvas
          ref={canvasRef}
          className="rounded-md"
          style={{
            width: miniW,
            height: miniH,
            display: 'block',
            imageRendering: 'auto',
          }}
        />
        <div
          className={`pt-0.5 text-center font-bold uppercase tracking-widest text-amber-800/80 ${compact ? 'text-[7px]' : 'text-[8px]'}`}
        >
          {t('game.minimap')}
        </div>
      </div>
    </div>
  );
});
