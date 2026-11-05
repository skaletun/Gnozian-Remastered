import { cityFoundingValidationError } from './game/cityFoundingRules';
import {
  useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense, type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  GameState,
  GameSettings as GameSetupSettings,
  Screen,
  TechId,
  Unit,
  DiplomaticRelation,
  GameSystems,
  ImprovementType,
  LegacyPathType,
  CrisisPolicyType,
  TradeRoute,
  TerrainType,
} from './game/types';
import type { AchievementsMap, AchievementId } from './game/achievements';
import {
  createGame,
  addMessage,
  DEFAULT_WORLD,
  recomputeTileTerritory,
  migrateLoadedTradeRoutes,
} from './game/facade/gameFacade';
import { CIV_TEMPLATES, TECHNOLOGIES } from './game/constants';
import { INITIAL_VIEWPORT, gridToScreen, type CameraState } from './game/hexMetrics';
import type { WorldCameraView } from './game/hexGeometry';
import { hexDistance } from './game/mapgen';
import { visibleMessagesForViewer, computeMapDiscoveredCivIndices } from './game/mapDiscovery';
import { findLeastCostMovementPath } from './game/pathfinding';
import { canAttackAtHexDistance, tileMovementEnterCost } from './game/movementRules';
import { createEmptyAchievements } from './game/achievements';
import { achievementMapsEqual, evaluateAchievementsFromState } from './game/achievementProgress';
import HUD from './components/HUD';
import { LegacyCrisisGameModals } from './components/LegacyCrisisGameModals';
import { FirstContactModal } from './components/FirstContactModal';
import { GnozianGlyph } from './components/ui';
const TechTree = lazy(() => import('./components/TechTree'));
const CityPanel = lazy(() => import('./components/CityPanel'));
const DiplomacyPanel = lazy(() => import('./components/DiplomacyPanel'));
const DiplomaticSettlementModal = lazy(() => import('./components/DiplomaticSettlementModal'));
const EmpirePanel = lazy(() => import('./components/EmpirePanel'));
const GovernmentModal = lazy(() => import('./components/GovernmentModal'));
import MapEditorScreen from './components/MapEditorScreen';
import MainMenu from './components/MainMenu';
import PlayerSetupScreen from './components/PlayerSetupScreen';
import SaveLoadScreen from './components/SaveLoadScreen';
import VictoryScreen from './components/VictoryScreen';
import SettingsScreen from './components/SettingsScreen';
import MobileSettingsScreen from './components/MobileSettingsScreen';
import type { GameSettings } from './game/settingsConstants';
import { loadSettings, saveSettingsToStorage } from './game/settingsStorage';
import AchievementsScreen from './components/AchievementsScreen';
import AchievementUnlockStack, { type AchievementToastItem } from './components/AchievementUnlockStack';
import TechUnlockToastStack, { type TechUnlockToastItem } from './components/TechUnlockToastStack';
import HelpScreen from './components/HelpScreen';
import TutorialScreen from './components/TutorialScreen';
import StatsScreen from './components/StatsScreen';
import VictoryTracker from './components/VictoryTracker';
import GreatPeopleScreen from './components/GreatPeopleScreen';
import NotificationSystem from './components/NotificationSystem';
import DevConsole from './components/DevConsole';
import GameMapView from './components/GameMapView';
import { t, setLanguage } from './i18n';
import {
  setAudioVolumes,
  resumeAudioContext,
  playEndTurnChime,
  playAchievementUnlock,
  playUiOpen,
  playUiClose,
  playUiConfirm,
  playUiError,
  playUnitSelectSfx,
  playUnitMoveSfx,
  playCombatImpactSfx,
  playCityFoundedSfx,
  playTechCompleteSfx,
  startGameMusic,
  stopAmbient,
  startMenuMusic,
  stopMenuMusic,
} from './audio/AudioManager';
import PauseMenu from './components/PauseMenu';
import { LocalPlayerCivIndexContext } from './context/LocalPlayerCivContext';
import WorldIntroCutscene from './components/WorldIntroCutscene';
import GameLoadingOverlay from './components/GameLoadingOverlay';
import GlobalTooltipLayer from './components/GlobalTooltipLayer';
import SplashScreen from './components/SplashScreen';
import { applyCommand } from './game/gameCommands';
import type { GameCommand } from './game/gameCommands';
import { useDiscordRichPresence } from './hooks/useDiscordRichPresence';
import { hasElectronBridge, setDisplayMode } from './utils/electronAPI';
import { createSaveData, saveManager } from './game/saveManager';
import { resetVisualFxPipeline } from './game/visualFxPipeline';
import { resetMapLodSmoothing } from './game/mapLod';
import {
  migrateLegacyFlatSaveToSlotZero,
  loadLatestPersistedGameState,
  hydrateFromSaveData,
  hydrateGameStateFromJson,
  LEGACY_FLAT_SAVE_KEY,
} from './game/loadPersistedGameState';
import { isPlayerProfileComplete, loadPlayerProfile } from './game/playerProfile';
import { useLayoutProfile } from './hooks/useLayoutProfile';
import { assetUrl } from './utils/assetUrl';
import { yieldForPaint } from './utils/mainThreadYield';
import { runGameBootPreload } from './game/bootPreload';
import {
  grantMetaProgressForMatch,
  loadMetaProfile,
  saveMetaProfile,
  setMetaLoadout,
  setMetaPolicy,
  type MetaPolicy,
} from './game/metaProgression';

const PRIMARY_SAVE_SLOT = 0;
const MAX_SAVE_SLOTS = 10;

/**
 * Find the first empty save slot, or return the oldest occupied slot (by timestamp)
 * if all are full. This prevents a new game from overwriting slot 0 unconditionally.
 */
function findNewSaveSlot(): number {
  try {
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      if (!saveManager.hasSlotRawEntry(i)) return i;
    }
    let oldest: { slot: number; time: number } | null = null;
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const save = saveManager.loadGame(i);
      if (!save) continue;
      const t = new Date(save.timestamp).getTime();
      if (!oldest || t < oldest.time) oldest = { slot: i, time: t };
    }
    return oldest?.slot ?? 0;
  } catch {
    return 0;
  }
}

/** Facade + civ templates stay wired here alongside `loadPersistedGameState` (hydration / normalization). */
const _APP_SAVE_PIPELINE_FOOTPRINT = [
  DEFAULT_WORLD,
  migrateLoadedTradeRoutes,
  recomputeTileTerritory,
  CIV_TEMPLATES.length,
] as const;
void _APP_SAVE_PIPELINE_FOOTPRINT;

type __PersistedRowTypes = DiplomaticRelation | GameSystems | TradeRoute;
void 0 as unknown as __PersistedRowTypes;

function MenuShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden gnz-page-bg gnz-menu-shell">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-35"
        style={{ backgroundImage: `url('${assetUrl('bg-img.png')}')` }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/45 via-black/35 to-black/70" />
      <div className="relative z-10 min-h-screen w-full">{children}</div>
    </div>
  );
}

/** Human units on same tile/type with moves; selected id first (plan: send 1 / N / all). */
function orderedHumanMoveStackIds(gs: GameState, selected: Unit, me: number): number[] {
  const same = gs.units.filter(
    u =>
      u.owner === me &&
      u.q === selected.q &&
      u.r === selected.r &&
      u.type === selected.type &&
      u.movement > 0 &&
      !u.hasAttacked
  );
  if (same.length === 0) return [];
  const first = same.find(u => u.id === selected.id);
  const rest = same.filter(u => u.id !== selected.id).sort((a, b) => a.id - b.id);
  const ordered = first ? [first, ...rest] : rest;
  const seen = new Set<number>();
  return ordered.filter(u => (seen.has(u.id) ? false : (seen.add(u.id), true))).map(u => u.id);
}

function saveAchievements(achs: AchievementsMap): void {
  try {
    localStorage.setItem('gnozian_achievements_v1', JSON.stringify(achs));
  } catch (e) {
    console.warn('Could not save achievements:', e);
  }
}

export default function App() {
  const layoutProfile = useLayoutProfile();
  const mobileLayout = layoutProfile === 'mobile';
  const [screen, setScreen] = useState<Screen>('splash');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>({
    x: 0, y: 0, zoom: 1, rotation: 0,
  });
  const [worldCamera, setWorldCamera] = useState<WorldCameraView | null>(null);
  const [minimapFocus, setMinimapFocus] = useState<{q:number;r:number;requestId:number}|null>(null);
  const [mapViewportPx, setMapViewportPx] = useState({
    w: INITIAL_VIEWPORT.w,
    h: INITIAL_VIEWPORT.h,
  });
  const [showTechTree, setShowTechTree] = useState(false);
  const [showDiplomacy, setShowDiplomacy] = useState(false);
  const [openCityId, setOpenCityId] = useState<number | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const isProcessingTurnRef = useRef(false);
  const [turnFlash, setTurnFlash] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showVictoryTracker, setShowVictoryTracker] = useState(false);
  const [showGreatPeople, setShowGreatPeople] = useState(false);
  const [showEmpire, setShowEmpire] = useState(false);
  const [showGovernmentModal, setShowGovernmentModal] = useState(false);
  const [displayedMessageIds, setDisplayedMessageIds] = useState<Set<number>>(new Set());
  const [achievements, setAchievements] = useState<AchievementsMap>(() => {
    try {
      const saved = localStorage.getItem('gnozian_achievements_v1');
      return saved ? JSON.parse(saved) : createEmptyAchievements();
    } catch {
      return createEmptyAchievements();
    }
  });
  const [hasSave, setHasSave] = useState(() => {
    try {
      return saveManager.countSaves() > 0 || !!localStorage.getItem(LEGACY_FLAT_SAVE_KEY);
    } catch {
      return !!localStorage.getItem(LEGACY_FLAT_SAVE_KEY);
    }
  });
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [showPerfOverlay, setShowPerfOverlay] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState<{
    active: boolean;
    title: string;
    subtitle: string;
    progress?: number;
    phaseKey?: string;
  }>({
    active: false,
    title: '',
    subtitle: '',
  });
  const [interactionTick, setInteractionTick] = useState(0);
  const [perfFps, setPerfFps] = useState(0);
  const cameraStateRef = useRef(cameraState);
  const [playerNickname, setPlayerNickname] = useState(() => {
    const p = loadPlayerProfile();
    if (p?.displayName) return p.displayName.slice(0, 32);
    try {
      return localStorage.getItem('gnozian_player_nickname')?.slice(0, 32) || 'Player';
    } catch {
      return 'Player';
    }
  });
  const [playerCivIndex, setPlayerCivIndex] = useState(0);
  const [metaProfile, setMetaProfile] = useState(loadMetaProfile);
  const metaAwardAppliedRef = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  const activeSaveSlotRef = useRef(PRIMARY_SAVE_SLOT);
  const playedSecondsRef = useRef(0);
  const lastPlayTimeTickMsRef = useRef(Date.now());
  const playerNicknameRef = useRef(playerNickname);
  const pendingInitialCameraCenterRef = useRef<number | null>(null);
  const pendingIntroSettingsRef = useRef<GameSetupSettings | null>(null);
  const pendingIntroCustomTerrainRef = useRef<TerrainType[][] | null>(null);
  const selectionCycleRef = useRef({ key: '', idx: 0 });
  const lastCityTapRef = useRef({ t: 0, q: -1, r: -1 });
  const achievementToastSeenRef = useRef<Set<AchievementId>>(new Set());
  const techToastSeenRef = useRef<Set<string>>(new Set());
  const firstContactDiscoverPrevRef = useRef<Set<number> | null>(null);
  const [firstContactQueue, setFirstContactQueue] = useState<number[]>([]);
  const panelAudioPrevRef = useRef<Record<string, boolean> | null>(null);
  const gameplayAudioPrevRef = useRef<{
    selectedUnitId: number | null;
    unitPosById: Map<number, string>;
    unitHpById: Map<number, number>;
    cityCount: number;
    researchedTechCount: number;
  } | null>(null);

  const [achievementToasts, setAchievementToasts] = useState<AchievementToastItem[]>([]);
  const [techUnlockToasts, setTechUnlockToasts] = useState<TechUnlockToastItem[]>([]);

  const dismissAchievementToast = useCallback((toastId: string) => {
    setAchievementToasts(prev => prev.filter(x => x.id !== toastId));
  }, []);
  const dismissTechUnlockToast = useCallback((toastId: string) => {
    setTechUnlockToasts(prev => prev.filter(x => x.id !== toastId));
  }, []);

  useEffect(() => {
    playerNicknameRef.current = playerNickname;
  }, [playerNickname]);

  const refreshHasSave = useCallback(() => {
    try {
      setHasSave(
        saveManager.countSaves() > 0 || !!localStorage.getItem(LEGACY_FLAT_SAVE_KEY),
      );
    } catch {
      setHasSave(!!localStorage.getItem(LEGACY_FLAT_SAVE_KEY));
    }
  }, []);

  useEffect(() => {
    migrateLegacyFlatSaveToSlotZero();
    refreshHasSave();
  }, [refreshHasSave]);

  const persistGameState = useCallback((state: GameState): boolean => {
    try {
      const now = Date.now();
      playedSecondsRef.current += Math.floor((now - lastPlayTimeTickMsRef.current) / 1000);
      lastPlayTimeTickMsRef.current = now;
      const nick = playerNicknameRef.current.trim().slice(0, 48);
      return saveManager.saveGame(
        activeSaveSlotRef.current,
        createSaveData(state, playedSecondsRef.current, { playerDisplayName: nick }),
      );
    } catch (e) {
      console.warn('Could not save game:', e);
      return false;
    }
  }, []);

  const applyLoadedPersistedState = useCallback((saved: GameState, playTimeAtSave: number, persistSlot: number) => {
    metaAwardAppliedRef.current = false;
    firstContactDiscoverPrevRef.current = null;
    setFirstContactQueue([]);
    activeSaveSlotRef.current = persistSlot;
    playedSecondsRef.current = playTimeAtSave;
    lastPlayTimeTickMsRef.current = Date.now();
    setGameState(saved);
    gameStateRef.current = saved;
    setCameraState(saved.camera);
    cameraStateRef.current = saved.camera;
    setScreen('game');
    setHasSave(true);
    setShowTechTree(false);
    setShowDiplomacy(false);
    setOpenCityId(null);
    setShowVictory(false);
    setShowEmpire(false);
    setShowPauseMenu(false);
    resetVisualFxPipeline();
    resetMapLodSmoothing(saved.camera.zoom);
  }, []);

  useEffect(() => {
    const blockBrowserContextMenu = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (
        el.closest(
          'input, textarea, select, [contenteditable="true"], .allow-text-select, .allow-context-menu'
        )
      ) {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('contextmenu', blockBrowserContextMenu, { capture: true });
    return () => document.removeEventListener('contextmenu', blockBrowserContextMenu, { capture: true });
  }, []);

  useEffect(() => {
    const interactiveSelector =
      'button, a[href], [role="button"], input, select, summary, [data-sfx], canvas';
    const nearestInteractive = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest(interactiveSelector) as HTMLElement | null;
    };
    const isDisabled = (el: HTMLElement): boolean => {
      if (el.matches('button, input, select, textarea')) {
        return (el as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled;
      }
      return el.getAttribute('aria-disabled') === 'true';
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = nearestInteractive(e.target);
      if (!el) return;
      void resumeAudioContext();
      const sfx = (el.dataset.sfx ?? '').toLowerCase();
      if (isDisabled(el) || sfx === 'error') {
        playUiError();
        return;
      }
      if (sfx === 'confirm') {
        playUiConfirm();
        return;
      }
      if (sfx === 'combat') {
        playCombatImpactSfx();
        return;
      }
      if (sfx === 'city') {
        playCityFoundedSfx();
        return;
      }
      // Normal clicks: GnzButton (`audioOnClick` default) or explicit `playUiClick` in handlers only —
      // a default click here doubled with those (pointerdown vs click timing).
    };

    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  }, []);

  const localViewerCivIndex = useMemo(() => {
    if (!gameState) return 0;
    const i = gameState.civilizations.findIndex(c => c.isHuman);
    return i >= 0 ? i : 0;
  }, [gameState]);

  const visibleHudMessages = useMemo(() => {
    if (!gameState) return [];
    return visibleMessagesForViewer(gameState, localViewerCivIndex, displayedMessageIds);
  }, [gameState, localViewerCivIndex, displayedMessageIds]);

  const centerCameraOnState = useCallback((
    state: GameState,
    civIndex = 0,
    viewport = mapViewportPx
  ): CameraState => {
    const civ = state.civilizations[civIndex] ?? state.civilizations[0];
    const capital = civ?.capital != null ? state.cities.find(c => c.id === civ.capital) : null;
    const city = capital ?? state.cities.find(c => c.owner === civIndex) ?? state.cities[0];
    const unit = state.units.find(u => u.owner === civIndex) ?? state.units[0];
    const q = city?.q ?? unit?.q ?? 0;
    const r = city?.r ?? unit?.r ?? 0;
    const viewportW = Math.max(1, viewport.w || INITIAL_VIEWPORT.w);
    const viewportH = Math.max(1, viewport.h || INITIAL_VIEWPORT.h);
    const zoom = 0.52;
    const p = gridToScreen(q, r, zoom);
    return {
      x: p.x - viewportW * 0.5,
      y: p.y - viewportH * 0.5,
      zoom,
      rotation: 0,
    };
  }, [mapViewportPx.h, mapViewportPx.w]);

  const incomingSettlementOffer = useMemo(() => {
    if (screen !== 'game' || !gameState?.diplomaticOffers?.length) return null;
    return gameState.diplomaticOffers.find(o => o.toCiv === localViewerCivIndex) ?? null;
  }, [screen, gameState, localViewerCivIndex]);
  /** Avoid effect churn from offer object identity swings when the modal should stay closed/open. */
  const hasSettlementOfferModal = incomingSettlementOffer != null;

  useEffect(() => {
    const current: Record<string, boolean> = {
      techTree: showTechTree,
      diplomacy: showDiplomacy,
      city: openCityId != null,
      victory: showVictory,
      settings: showSettings,
      achievements: showAchievements,
      help: showHelp,
      tutorial: showTutorial,
      stats: showStats,
      victoryTracker: showVictoryTracker,
      greatPeople: showGreatPeople,
      empire: showEmpire,
      government: showGovernmentModal,
      pause: showPauseMenu,
      devConsole: showDevConsole,
      settlementOffer: hasSettlementOfferModal,
      firstContact: firstContactQueue.length > 0,
    };
    const prev = panelAudioPrevRef.current;
    if (prev) {
      let opened = false;
      let closed = false;
      for (const key of Object.keys(current)) {
        if (!prev[key] && current[key]) opened = true;
        if (prev[key] && !current[key]) closed = true;
      }
      if (opened) playUiOpen();
      else if (closed) playUiClose();
    }
    panelAudioPrevRef.current = current;
  }, [
    showTechTree,
    showDiplomacy,
    openCityId,
    showVictory,
    showSettings,
    showAchievements,
    showHelp,
    showTutorial,
    showStats,
    showVictoryTracker,
    showGreatPeople,
    showEmpire,
    showGovernmentModal,
    showPauseMenu,
    showDevConsole,
    hasSettlementOfferModal,
    firstContactQueue.length,
  ]);

  const runWithLoading = useCallback(
    async (title: string, subtitle: string, task: () => Promise<void> | void): Promise<void> => {
      setLoadingOverlay({ active: true, title, subtitle, progress: 0, phaseKey: 'boot.phase.start' });
      const bootWeight = 0.82;
      try {
        await runGameBootPreload(p => {
          setLoadingOverlay(prev => ({
            ...prev,
            progress: p.ratio * bootWeight,
            phaseKey: p.phaseKey,
          }));
        });
        setLoadingOverlay(prev => ({
          ...prev,
          progress: Math.max(prev.progress ?? 0, bootWeight + 0.04),
          phaseKey: 'loading.phase.state',
        }));
        await yieldForPaint();
        await task();
        setLoadingOverlay(prev => ({
          ...prev,
          progress: 1,
          phaseKey: 'boot.phase.done',
        }));
      } finally {
        setLoadingOverlay({
          active: false,
          title: '',
          subtitle: '',
          progress: undefined,
          phaseKey: undefined,
        });
      }
    },
    []
  );

  const handleContinueGame = useCallback(() => {
    setShowTutorial(false);
    void runWithLoading(t('loading.loadGame.title'), t('loading.loadGame.body'), async () => {
      const result = loadLatestPersistedGameState();
      if (!result) return;
      applyLoadedPersistedState(result.state, result.playTimeAtSave, result.persistSlot);
    });
  }, [applyLoadedPersistedState, runWithLoading]);

  const handleLoadSlot = useCallback(
    (slot: number) => {
      setShowTutorial(false);
      const slotHasSave = saveManager.hasSlotRawEntry(slot);
      const legacyOk =
        slot === 0 &&
        typeof localStorage !== 'undefined' &&
        !!localStorage.getItem(LEGACY_FLAT_SAVE_KEY);
      if (!slotHasSave && !legacyOk) return;

      void runWithLoading(t('loading.loadGame.title'), t('loading.loadGame.body'), async () => {
        const save = saveManager.loadGame(slot);
        let st: GameState | null = null;
        let playTime = 0;
        if (save) {
          st = hydrateFromSaveData(save);
          playTime = save.metadata.playTime;
        } else if (slot === 0) {
          const raw =
            typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_FLAT_SAVE_KEY) : null;
          if (raw) {
            st = hydrateGameStateFromJson(raw);
            playTime = 0;
          }
        }
        if (!st) return;
        applyLoadedPersistedState(st, playTime, slot);
      });
    },
    [applyLoadedPersistedState, runWithLoading],
  );

  const handleSplashDone = useCallback(() => {
    setScreen(isPlayerProfileComplete() ? 'main_menu' : 'player_setup');
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    cameraStateRef.current = cameraState;
  }, [cameraState]);

  useEffect(() => {
    isProcessingTurnRef.current = isProcessingTurn;
  }, [isProcessingTurn]);

  useEffect(() => {
    if (!gameState || openCityId === null) return;
    const c = gameState.cities.find(x => x.id === openCityId);
    if (c && c.owner !== localViewerCivIndex) setOpenCityId(null);
  }, [gameState, openCityId, localViewerCivIndex]);

  const commitLocalState = useCallback((next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);
  }, []);

  const submitCommand = useCallback((state: GameState, command: GameCommand): GameState => {
    setInteractionTick(t => t + 1);
    return applyCommand(state, command);
  }, []);

  const dismissFirstContactHead = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs) return;
    setFirstContactQueue(prev => {
      if (prev.length === 0) return prev;
      const head = prev[0]!;
      commitLocalState(
        submitCommand(gs, {
          kind: 'firstContact.markSeen',
          viewerCivIndex: localViewerCivIndex,
          otherCivIndex: head,
        })
      );
      return prev.slice(1);
    });
  }, [localViewerCivIndex, submitCommand, commitLocalState]);

  const mapGraphics = useMemo(
    () => ({
      ...settings.graphics,
      showGridLines: false,
    }),
    [settings.graphics]
  );

  const applyAppSettings = useCallback((s: GameSettings) => {
    // Apply settings exactly as the player chose; do not auto-optimize for web.
    setSettings(s);
    saveSettingsToStorage(s);
    setLanguage(s.language);
    setAudioVolumes({
      masterVolume: s.masterVolume,
      musicVolume: s.musicVolume,
      sfxVolume: s.sfxVolume,
    });
  }, []);

  useEffect(() => {
    if (!hasElectronBridge()) return;
    const mode = settings.graphics.displayMode ?? 'windowed';
    void setDisplayMode(mode);
  }, [settings.graphics.displayMode]);

  useEffect(() => {
    const s = loadSettings();
    setLanguage(s.language);
    setAudioVolumes({
      masterVolume: s.masterVolume,
      musicVolume: s.musicVolume,
      sfxVolume: s.sfxVolume,
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gnozian_player_nickname', playerNickname.trim().slice(0, 32) || 'Player');
    } catch {
      /* */
    }
  }, [playerNickname]);

  useEffect(() => {
    saveMetaProfile(metaProfile);
  }, [metaProfile]);

  const handleMetaLoadoutChange = useCallback((loadout: string[]) => {
    setMetaProfile(prev => setMetaLoadout(prev, loadout));
  }, []);

  const handleMetaPolicyChange = useCallback((policy: MetaPolicy) => {
    setMetaProfile(prev => setMetaPolicy(prev, policy));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'game' || !gameState) return;
      if (showTechTree || showDiplomacy || openCityId !== null || showEmpire || showGovernmentModal || incomingSettlementOffer)
        return;
      if (e.code === 'Backquote') {
        e.preventDefault();
        setShowDevConsole(v => !v);
        return;
      }
      if (showDevConsole) return;
      if (e.code === 'F3') {
        e.preventDefault();
        setShowPerfOverlay(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    screen,
    gameState,
    showTechTree,
    showDiplomacy,
    openCityId,
    showEmpire,
    showGovernmentModal,
    showDevConsole,
    incomingSettlementOffer,
  ]);

  useEffect(() => {
    if (!showPerfOverlay) return;
    let frames = 0;
    let last = performance.now();
    let id = 0;
    const loop = (t: number) => {
      frames++;
      if (t - last >= 600) {
        setPerfFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [showPerfOverlay]);

  useDiscordRichPresence({
    enabled: settings.discordRichPresence !== false,
    screen,
    gameState,
    showPauseMenu,
    showTechTree,
    showDiplomacy,
    openCityId,
    showAchievements,
    showHelp,
    showTutorial,
    showStats,
    showVictoryTracker,
    showGreatPeople,
    showEmpire,
    showGovernmentModal,
    showVictory,
    isProcessingTurn,
    playerCivIndex,
    playerNickname,
  });

  useEffect(() => {
    const onMenu =
      screen === 'splash' ||
      screen === 'player_setup' ||
      screen === 'load_game' ||
      screen === 'main_menu' ||
      screen === 'map_editor' ||
      screen === 'world_intro';
    if (onMenu) {
      startMenuMusic();
      return;
    }
    if (screen === 'game' && gameState) {
      startGameMusic();
      return;
    }
    stopMenuMusic();
    stopAmbient();
  }, [screen]);

  useEffect(() => {
    const muted = settings.masterVolume <= 0.01 || settings.musicVolume <= 0.01;
    const onMenu =
      screen === 'splash' ||
      screen === 'player_setup' ||
      screen === 'load_game' ||
      screen === 'main_menu' ||
      screen === 'map_editor' ||
      screen === 'world_intro';
    if (muted) {
      stopMenuMusic();
      stopAmbient();
      return;
    }
    if (onMenu) {
      startMenuMusic();
    } else if (screen === 'game' && gameState) {
      startGameMusic();
    }
  }, [settings.masterVolume, settings.musicVolume, screen]);

  // Auto-save every 5 turns
  useEffect(() => {
    const gs = gameStateRef.current;
    if (gs && gs.phase === 'playing' && gs.turn % 5 === 0) {
      persistGameState(gs);
      setHasSave(true);
    }
  }, [gameState?.turn, persistGameState]);

  // Auto-save achievements when they change
  useEffect(() => {
    saveAchievements(achievements);
  }, [achievements]);

  // Track achievement progress from live game state + show unlock toasts
  useEffect(() => {
    if (screen !== 'game' || !gameState || gameState.phase !== 'playing') return;
    setAchievements(prev => {
      const { next, newlyUnlocked } = evaluateAchievementsFromState(
        gameState,
        localViewerCivIndex,
        prev
      );
      const fresh = newlyUnlocked.filter(id => !achievementToastSeenRef.current.has(id));
      if (fresh.length > 0) {
        for (const id of fresh) achievementToastSeenRef.current.add(id);
        queueMicrotask(() => {
          setAchievementToasts(t => [
            ...t,
            ...fresh.map((aid, i) => ({
              id: `ach-${aid}-${Date.now()}-${i}`,
              achievementId: aid,
            })),
          ]);
          void playAchievementUnlock();
        });
      }
      return achievementMapsEqual(prev, next) ? prev : next;
    });
  }, [gameState, screen, localViewerCivIndex]);

  useEffect(() => {
    if (screen !== 'game' || !gameState || gameState.phase !== 'playing') {
      gameplayAudioPrevRef.current = null;
      return;
    }
    const myUnits = gameState.units.filter(u => u.owner === localViewerCivIndex);
    const unitPosById = new Map<number, string>();
    for (const u of myUnits) unitPosById.set(u.id, `${u.q},${u.r}`);
    const unitHpById = new Map<number, number>();
    for (const u of gameState.units) unitHpById.set(u.id, u.hp);
    const myCityCount = gameState.cities.filter(c => c.owner === localViewerCivIndex).length;
    const myResearchCount = gameState.civilizations[localViewerCivIndex]?.researchedTechs?.length ?? 0;
    const snapshot = {
      selectedUnitId: gameState.selectedUnitId ?? null,
      unitPosById,
      unitHpById,
      cityCount: myCityCount,
      researchedTechCount: myResearchCount,
    };
    const prev = gameplayAudioPrevRef.current;
    if (prev) {
      if (snapshot.selectedUnitId != null && snapshot.selectedUnitId !== prev.selectedUnitId) {
        playUnitSelectSfx();
      }

      let moved = false;
      for (const [id, pos] of snapshot.unitPosById) {
        const prevPos = prev.unitPosById.get(id);
        if (prevPos != null && prevPos !== pos) {
          moved = true;
          break;
        }
      }
      if (moved) playUnitMoveSfx();

      let tookDamage = false;
      for (const [id, hp] of snapshot.unitHpById) {
        const prevHp = prev.unitHpById.get(id);
        if (prevHp != null && hp < prevHp - 0.001) {
          tookDamage = true;
          break;
        }
      }
      if (tookDamage) playCombatImpactSfx();

      if (snapshot.cityCount > prev.cityCount) playCityFoundedSfx();
      if (snapshot.researchedTechCount > prev.researchedTechCount) playTechCompleteSfx();
    }
    gameplayAudioPrevRef.current = snapshot;
  }, [screen, gameState, localViewerCivIndex]);

  // Track local tech completions and show short "achievement-like" toasts.
  useEffect(() => {
    if (screen !== 'game' || !gameState || gameState.phase !== 'playing') return;
    const civ = gameState.civilizations[localViewerCivIndex];
    if (!civ) return;
    const researched = civ.researchedTechs ?? [];
    if (techToastSeenRef.current.size === 0) {
      for (const tid of researched) techToastSeenRef.current.add(tid);
      return;
    }
    const fresh = researched.filter(tid => !techToastSeenRef.current.has(tid) && !!TECHNOLOGIES[tid]);
    if (fresh.length === 0) return;
    for (const tid of fresh) techToastSeenRef.current.add(tid);
    setTechUnlockToasts(prev => [
      ...prev,
      ...fresh.map((techId, i) => ({
        id: `tech-unlock-${techId}-${Date.now()}-${i}`,
        techId,
      })),
    ]);
  }, [gameState, screen, localViewerCivIndex]);

  useEffect(() => {
    if (screen !== 'game') {
      firstContactDiscoverPrevRef.current = null;
      setFirstContactQueue([]);
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'game' || !gameState || gameState.phase !== 'playing') return;
    const me = localViewerCivIndex;
    const selfCiv = gameState.civilizations[me];
    if (!selfCiv?.isHuman) return;

    const discovered = computeMapDiscoveredCivIndices(gameState, me);
    const seen = gameState.systems.civFirstContactSeen ?? {};

    if (firstContactDiscoverPrevRef.current === null) {
      firstContactDiscoverPrevRef.current = new Set(discovered);
      return;
    }

    const newcomers: number[] = [];
    for (const i of discovered) {
      if (i === me) continue;
      const c = gameState.civilizations[i];
      if (!c?.isAlive) continue;
      if (firstContactDiscoverPrevRef.current.has(i)) continue;
      const key = `${me}_${i}`;
      if (seen[key]) continue;
      newcomers.push(i);
    }

    firstContactDiscoverPrevRef.current = new Set(discovered);
    if (newcomers.length === 0) return;

    setFirstContactQueue(prev => {
      const next = [...prev];
      for (const i of newcomers) {
        if (!next.includes(i)) next.push(i);
      }
      return next;
    });
  }, [screen, gameState, localViewerCivIndex]);

  // Show victory screen when game ends
  useEffect(() => {
    if (gameState?.phase === 'victory' && !showVictory) {
      setShowVictory(true);
    }
  }, [gameState?.phase]);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'victory') return;
    if (metaAwardAppliedRef.current) return;
    metaAwardAppliedRef.current = true;
    const policy: MetaPolicy =
      gameState.settings.metaProgressionPolicy === 'disabled'
        ? 'disabled'
        : (metaProfile.mpPolicy ?? 'enabled');
    const multiplayer = false;
    const won = gameState.winner === localViewerCivIndex;
    setMetaProfile(prev =>
      grantMetaProgressForMatch(prev, {
        won,
        victoryType: gameState.victoryType,
        multiplayer,
        policy,
      })
    );
  }, [gameState, localViewerCivIndex, metaProfile.mpPolicy]);

  const applyStartedGame = useCallback((settings: GameSetupSettings, customTerrain?: TerrainType[][] | null) => {
    setShowTutorial(false);
    achievementToastSeenRef.current.clear();
    techToastSeenRef.current.clear();
    firstContactDiscoverPrevRef.current = null;
    setFirstContactQueue([]);
    setTechUnlockToasts([]);
    metaAwardAppliedRef.current = false;
    const newState = createGame(settings, customTerrain);
    const civIndex = 0;
    pendingInitialCameraCenterRef.current = civIndex;
    const centeredCamera = centerCameraOnState(newState, civIndex);
    const centeredState = { ...newState, camera: centeredCamera };
    activeSaveSlotRef.current = findNewSaveSlot();
    playedSecondsRef.current = 0;
    lastPlayTimeTickMsRef.current = Date.now();
    resetVisualFxPipeline();
    resetMapLodSmoothing(centeredCamera.zoom);
    setGameState(centeredState);
    gameStateRef.current = centeredState;
    setCameraState(centeredCamera);
    cameraStateRef.current = centeredCamera;
    setScreen('game');
    setHasSave(true);
    persistGameState(centeredState);
    refreshHasSave();
    setShowTechTree(false);
    setShowDiplomacy(false);
    setOpenCityId(null);
    setShowVictory(false);
    setShowEmpire(false);
    setShowPauseMenu(false);
  }, [centerCameraOnState, persistGameState, refreshHasSave]);

  const completeWorldIntro = useCallback(() => {
    const s = pendingIntroSettingsRef.current;
    const ct = pendingIntroCustomTerrainRef.current;
    pendingIntroSettingsRef.current = null;
    pendingIntroCustomTerrainRef.current = null;
    try {
      localStorage.setItem('gnozian_world_intro_v1', '1');
    } catch {
      /* */
    }
    if (s) {
      void runWithLoading(t('loading.createGame.title'), t('loading.createGame.body'), async () => {
        applyStartedGame(s, ct);
      });
    }
    else setScreen('main_menu');
  }, [applyStartedGame, runWithLoading]);

  const handleStartGame = useCallback(
    (settings: GameSetupSettings, customTerrain?: TerrainType[][] | null) => {
      setShowTutorial(false);
      try {
        if (!localStorage.getItem('gnozian_world_intro_v1')) {
          pendingIntroSettingsRef.current = settings;
          pendingIntroCustomTerrainRef.current = customTerrain ?? null;
          setScreen('world_intro');
          return;
        }
      } catch {
        /* */
      }
      void runWithLoading(t('loading.createGame.title'), t('loading.createGame.body'), async () => {
        applyStartedGame(settings, customTerrain);
      });
    },
    [applyStartedGame, runWithLoading]
  );

  const handleWorldCameraChange = useCallback((camera: WorldCameraView) => {
    setWorldCamera(previous => {
      if(previous &&
        Math.abs(previous.q-camera.q)<0.025 &&
        Math.abs(previous.r-camera.r)<0.025 &&
        Math.abs(previous.radius-camera.radius)<0.06)return previous;
      return camera;
    });
  }, []);

  const handleMinimapNavigate = useCallback((q:number,r:number) => {
    setMinimapFocus(previous => ({q,r,requestId:(previous?.requestId ?? 0)+1}));
  }, []);

  const handleMapViewportSize = useCallback((w: number, h: number) => {
    const viewport = { w: Math.max(1, w), h: Math.max(1, h) };
    setMapViewportPx(viewport);
    const civIndex = pendingInitialCameraCenterRef.current;
    const state = gameStateRef.current;
    if (civIndex == null || !state) return;
    pendingInitialCameraCenterRef.current = null;
    const centeredCamera = centerCameraOnState(state, civIndex, viewport);
    cameraStateRef.current = centeredCamera;
    setCameraState(centeredCamera);
    gameStateRef.current = { ...state, camera: centeredCamera };
    setGameState(gameStateRef.current);
  }, [centerCameraOnState]);

  const handleTeleportCamera = useCallback((cam: CameraState) => {
    setCameraState(cam);
    setGameState(prev => (prev ? { ...prev, camera: cam } : null));
  }, []);

  const handleStackUnitsToMove = useCallback((n: number) => {
    setGameState(prev => {
      if (!prev) return null;
      return { ...prev, stackUnitsToMove: n };
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setGameState(prev => prev ? {
      ...prev,
      selectedUnitId: null,
      selectedCityId: null,
      selectedTile: null,
    } : null);
    selectionCycleRef.current = { key: '', idx: 0 };
    lastCityTapRef.current = { t: 0, q: -1, r: -1 };
  }, []);

  const handleTileClick = useCallback((
    q: number,
    r: number,
    mods?: { altKey?: boolean; shiftKey?: boolean }
  ) => {
    const gs = gameStateRef.current ?? gameState;
    if (!gs) return;
    setInteractionTick(t => t + 1);

    const me = localViewerCivIndex;

    const tile = gs.tiles[r]?.[q];
    if (!tile) return;
    if (!tile.revealed?.[me]) return;

    const cityOnTile = tile.city != null ? gs.cities.find(c => c.id === tile.city) : null;
    const unitsOnTile = gs.units.filter(u => u.q === q && u.r === r);
    const humanUnits = unitsOnTile.filter(u => u.owner === me);
    const enemyUnits = unitsOnTile.filter(u => u.owner !== me);

    const selectedUnit = gs.selectedUnitId
      ? gs.units.find(u => u.id === gs.selectedUnitId)
      : null;

    if ((mods?.altKey || mods?.shiftKey) && cityOnTile && cityOnTile.owner === me) {
      setOpenCityId(cityOnTile.id);
      setShowTechTree(false);
      setShowDiplomacy(false);
      return;
    }

    const now = Date.now();
    if (
      cityOnTile &&
      cityOnTile.owner === me &&
      lastCityTapRef.current.q === q &&
      lastCityTapRef.current.r === r &&
      now - lastCityTapRef.current.t < 420
    ) {
      setOpenCityId(cityOnTile.id);
      setShowTechTree(false);
      setShowDiplomacy(false);
      lastCityTapRef.current = { t: 0, q: -1, r: -1 };
      selectionCycleRef.current = { key: '', idx: 0 };
      return;
    }

    if (selectedUnit && selectedUnit.owner === me) {
      if (enemyUnits.length > 0 && selectedUnit.movement > 0) {
        const target = enemyUnits[0];
        const dist = hexDistance(selectedUnit.q, selectedUnit.r, target.q, target.r);
        if (canAttackAtHexDistance(selectedUnit, dist, 'unit')) {
          const newState = submitCommand(gs, {
            kind: 'unit.attackUnit',
            attackerId: selectedUnit.id,
            defenderId: target.id,
          });
          commitLocalState(newState);
          return;
        }
      }

      if (cityOnTile && cityOnTile.owner !== me && selectedUnit.movement > 0) {
        const dist = hexDistance(selectedUnit.q, selectedUnit.r, cityOnTile.q, cityOnTile.r);
        if (canAttackAtHexDistance(selectedUnit, dist, 'city')) {
          const newState = submitCommand(gs, {
            kind: 'unit.attackCity',
            attackerId: selectedUnit.id,
            cityId: cityOnTile.id,
          });
          commitLocalState(newState);
          return;
        }
      }

      const stepCost = tileMovementEnterCost(tile.terrain, selectedUnit.type, {
        state: gs,
        civIndex: me,
        fromQ: selectedUnit.q,
        fromR: selectedUnit.r,
        toQ: q,
        toR: r,
      });
      const stepDist = hexDistance(selectedUnit.q, selectedUnit.r, q, r);

      const ids = orderedHumanMoveStackIds(gs, selectedUnit, me);
      const cap = Math.max(1, gs.stackUnitsToMove ?? 9999);
      const take = ids.slice(0, Math.min(cap, ids.length));

      if (stepDist === 1 && stepCost != null && stepCost <= selectedUnit.movement) {
        const newState = submitCommand(
          gs,
          take.length <= 1
            ? { kind: 'unit.move', unitId: selectedUnit.id, toQ: q, toR: r }
            : { kind: 'unit.moveGroup', unitIds: take, toQ: q, toR: r }
        );
        commitLocalState({
          ...newState,
          selectedTile: { q, r },
        });
        return;
      }

      if (
        stepDist > 1 &&
        take.length <= 1 &&
        findLeastCostMovementPath(gs, selectedUnit, q, r, { restrictToOwnedTerrain: true })
      ) {
        const newState = submitCommand(gs, {
          kind: 'unit.moveTo',
          unitId: selectedUnit.id,
          toQ: q,
          toR: r,
        });
        commitLocalState({
          ...newState,
          selectedTile: { q, r },
        });
        return;
      }
    }

    if (humanUnits.length > 0) {
      const key = `${q},${r}`;
      if (selectionCycleRef.current.key !== key) {
        selectionCycleRef.current = { key, idx: 0 };
      } else {
        selectionCycleRef.current.idx =
          (selectionCycleRef.current.idx + 1) % humanUnits.length;
      }
      const pick = humanUnits[selectionCycleRef.current.idx] ?? humanUnits[0];
      lastCityTapRef.current = { t: now, q, r };
      setGameState(prev => {
        if (!prev) return null;
        const n = {
          ...prev,
          selectedUnitId: pick.id,
          selectedTile: { q, r },
          selectedCityId: null,
        };
        gameStateRef.current = n;
        return n;
      });
      return;
    }

    lastCityTapRef.current = { t: now, q, r };
    setGameState(prev => {
      if (!prev) return null;
      const n = {
        ...prev,
        selectedUnitId: null,
        selectedTile: { q, r },
        selectedCityId: cityOnTile?.id ?? null,
      };
      gameStateRef.current = n;
      return n;
    });
  }, [gameState, localViewerCivIndex, commitLocalState, submitCommand]);

  const handleEndTurn = useCallback(() => {
    if (!gameState || isProcessingTurn) return;

    void resumeAudioContext();
    playEndTurnChime();

    setIsProcessingTurn(true);
    setTurnFlash(true);
    setTimeout(() => setTurnFlash(false), 300);

    setTimeout(() => {
      const gsBefore = gameStateRef.current;
      if (!gsBefore) {
        setIsProcessingTurn(false);
        return;
      }
      try {
        const newState = submitCommand(gsBefore, {
          kind: 'turn.end',
          visionCivIndex: localViewerCivIndex,
        });
        setGameState(newState);
        persistGameState(newState);
        setHasSave(true);
      } catch (e) {
        setGameState(gsBefore);
        gameStateRef.current = gsBefore;
        console.error('Error processing turn:', e);
      } finally {
        setIsProcessingTurn(false);
      }
    }, 50);
  }, [gameState, isProcessingTurn, localViewerCivIndex, submitCommand, persistGameState]);

  // Keyboard shortcuts (after handleEndTurn; avoids TDZ and stale closures)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (screen !== 'game' || !gameState) return;

      if (showDevConsole) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowDevConsole(false);
        }
        return;
      }

      if (showSettings) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowSettings(false);
        }
        return;
      }
      if (showTutorial) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowTutorial(false);
        }
        return;
      }
      if (showHelp) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowHelp(false);
        }
        return;
      }
      if (showVictoryTracker) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowVictoryTracker(false);
        }
        return;
      }
      if (showGreatPeople) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowGreatPeople(false);
        }
        return;
      }
      if (showStats) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowStats(false);
        }
        return;
      }
      if (showAchievements) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowAchievements(false);
        }
        return;
      }

      if (showPauseMenu) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowPauseMenu(false);
        }
        return;
      }

      if (showVictory && gameState.phase === 'victory') {
        return;
      }

      if (showGovernmentModal) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowGovernmentModal(false);
        }
        return;
      }

      if (incomingSettlementOffer) {
        return;
      }

      if (showTechTree || showDiplomacy || openCityId !== null || showEmpire) {
        if (e.code === 'Escape') {
          setShowTechTree(false);
          setShowDiplomacy(false);
          setOpenCityId(null);
          setShowEmpire(false);
          setShowGovernmentModal(false);
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        setShowPauseMenu(true);
        return;
      }
      if (e.code === 'AltLeft') {
        e.preventDefault();
        return;
      }

      // Use KeyboardEvent.code so shortcuts match physical keys on any layout (RU, DE, etc.).
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        handleEndTurn();
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        setShowTechTree(v => !v);
        setShowDiplomacy(false);
        setOpenCityId(null);
      } else if (e.code === 'KeyD') {
        e.preventDefault();
        setShowDiplomacy(v => !v);
        setShowTechTree(false);
        setOpenCityId(null);
        setShowEmpire(false);
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        if (showEmpire) {
          setShowGovernmentModal(false);
          setShowEmpire(false);
        } else {
          setShowEmpire(true);
        }
        setShowTechTree(false);
        setShowDiplomacy(false);
        setOpenCityId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    screen,
    gameState,
    showTechTree,
    showDiplomacy,
    showEmpire,
    showGovernmentModal,
    openCityId,
    isProcessingTurn,
    handleEndTurn,
    showDevConsole,
    showSettings,
    showTutorial,
    showHelp,
    showStats,
    showVictoryTracker,
    showGreatPeople,
    showAchievements,
    showPauseMenu,
    showVictory,
    incomingSettlementOffer,
  ]);

  const handleFoundCity = useCallback(() => {
    if (!gameState) return;
    const me = localViewerCivIndex;
    const selectedUnit = gameState.selectedUnitId != null
      ? gameState.units.find(u => u.id === gameState.selectedUnitId)
      : null;
    if (!selectedUnit || selectedUnit.type !== 'settler' || selectedUnit.owner !== me) return;

    const error = cityFoundingValidationError(
      gameState, me, selectedUnit.q, selectedUnit.r, selectedUnit.id
    );
    if (error) {
      commitLocalState(addMessage(gameState, `Cannot found city: ${error}.`, 'warning', [me]));
      return;
    }

    const newState = submitCommand(gameState, {
      kind: 'city.found',
      civIndex: me,
      q: selectedUnit.q,
      r: selectedUnit.r,
      settlerUnitId: selectedUnit.id,
    });
    commitLocalState({ ...newState, selectedUnitId: null });
  }, [gameState, localViewerCivIndex, commitLocalState]);

  const handleAttackCity = useCallback((cityId: number) => {
    if (!gameState || !gameState.selectedUnitId) return;
    const newState = submitCommand(gameState, {
      kind: 'unit.attackCity',
      attackerId: gameState.selectedUnitId,
      cityId,
    });
    commitLocalState(newState);
  }, [gameState, commitLocalState]);

  const handleActivateGreatPerson = useCallback((unitId: number, cityId: number) => {
    if (!gameState) return;
    commitLocalState(submitCommand(gameState, { kind: 'greatPerson.activate', unitId, cityId }));
  }, [gameState, commitLocalState, submitCommand]);

  const handleBuildImprovement = useCallback(
    (unitId: number, improvement: ImprovementType) => {
      if (!gameState) return;
      commitLocalState(
        submitCommand(gameState, { kind: 'unit.buildImprovement', unitId, improvement })
      );
    },
    [gameState, commitLocalState, submitCommand]
  );

  const handleChooseLegacyOption = useCallback(
    (path: LegacyPathType, choice: 'golden_age' | 'dark_age') => {
      if (!gameState) return;
      commitLocalState(
        submitCommand(gameState, { kind: 'legacy.chooseOption', civIndex: localViewerCivIndex, path, choice })
      );
    },
    [gameState, localViewerCivIndex, commitLocalState, submitCommand]
  );

  const handleSetCrisisPolicy = useCallback(
    (policy: CrisisPolicyType) => {
      if (!gameState) return;
      commitLocalState(
        submitCommand(gameState, { kind: 'crisis.setPolicy', civIndex: localViewerCivIndex, policy })
      );
    },
    [gameState, localViewerCivIndex, commitLocalState, submitCommand]
  );

  const handleDeferLegacyPrompt = useCallback(() => {
    if (!gameState) return;
    commitLocalState(
      submitCommand(gameState, { kind: 'legacy.snoozePrompt', civIndex: localViewerCivIndex })
    );
  }, [gameState, localViewerCivIndex, commitLocalState, submitCommand]);

  const handleDeferCrisisPolicyPrompt = useCallback(() => {
    if (!gameState) return;
    commitLocalState(
      submitCommand(gameState, { kind: 'crisis.snoozePolicyPrompt', civIndex: localViewerCivIndex })
    );
  }, [gameState, localViewerCivIndex, commitLocalState, submitCommand]);

  const handleAppointCommander = useCallback((unitId: number) => {
    if (!gameState) return;
    commitLocalState(submitCommand(gameState, { kind: 'commander.appoint', civIndex: localViewerCivIndex, unitId }));
  }, [gameState, localViewerCivIndex, commitLocalState, submitCommand]);

  const handleAssignCommander = useCallback((unitId: number, commanderId: string) => {
    if (!gameState) return;
    commitLocalState(
      submitCommand(gameState, { kind: 'commander.assignUnit', civIndex: localViewerCivIndex, unitId, commanderId })
    );
  }, [gameState, localViewerCivIndex, commitLocalState, submitCommand]);

  const handleUnassignCommander = useCallback((unitId: number) => {
    if (!gameState) return;
    commitLocalState(
      submitCommand(gameState, { kind: 'commander.unassignUnit', civIndex: localViewerCivIndex, unitId })
    );
  }, [gameState, localViewerCivIndex, commitLocalState, submitCommand]);

  const handleActivateCommander = useCallback((commanderId: string) => {
    if (!gameState) return;
    commitLocalState(
      submitCommand(gameState, { kind: 'commander.activate', civIndex: localViewerCivIndex, commanderId })
    );
  }, [gameState, localViewerCivIndex, commitLocalState, submitCommand]);

  const handleSetScoutAutoExplore = useCallback(
    (unitId: number, enabled: boolean) => {
      if (!gameState) return;
      commitLocalState(
        submitCommand(gameState, {
          kind: 'unit.scout.setAutoExplore',
          civIndex: localViewerCivIndex,
          unitId,
          enabled,
        })
      );
    },
    [gameState, localViewerCivIndex, commitLocalState, submitCommand]
  );

  const handleResearch = useCallback((techId: TechId) => {
    if (!gameState) return;
    const newState = submitCommand(gameState, {
      kind: 'research.start',
      civIndex: localViewerCivIndex,
      techId,
    });
    commitLocalState(newState);
    setShowTechTree(false);
  }, [gameState, localViewerCivIndex, commitLocalState, submitCommand]);

  const handleOpenCity = useCallback(
    (cityId: number) => {
      const c = gameState?.cities.find(x => x.id === cityId);
      if (!c || c.owner !== localViewerCivIndex) return;
      setOpenCityId(cityId);
      setShowTechTree(false);
      setShowDiplomacy(false);
      setShowEmpire(false);
    },
    [gameState, localViewerCivIndex]
  );

  const openCity = gameState && openCityId !== null
    ? gameState.cities.find(c => c.id === openCityId)
    : null;

  if (screen === 'splash') {
    return (
      <>
        <SplashScreen onDone={handleSplashDone} />
        <GlobalTooltipLayer />
      </>
    );
  }

  if (screen === 'player_setup') {
    return (
      <MenuShell>
        <PlayerSetupScreen
          onComplete={name => {
            setPlayerNickname(name.slice(0, 32));
            setScreen('main_menu');
          }}
        />
        <GameLoadingOverlay
          active={loadingOverlay.active}
          title={loadingOverlay.title}
          subtitle={loadingOverlay.subtitle}
          progress={loadingOverlay.progress}
          phaseKey={loadingOverlay.phaseKey}
        />
        <GlobalTooltipLayer />
      </MenuShell>
    );
  }

  if (screen === 'load_game') {
    return (
      <MenuShell>
        <SaveLoadScreen
          onLoadSlot={handleLoadSlot}
          onBack={() => setScreen('main_menu')}
          onSavesChanged={refreshHasSave}
        />
        <GameLoadingOverlay
          active={loadingOverlay.active}
          title={loadingOverlay.title}
          subtitle={loadingOverlay.subtitle}
          progress={loadingOverlay.progress}
          phaseKey={loadingOverlay.phaseKey}
        />
        <GlobalTooltipLayer />
      </MenuShell>
    );
  }

  if (screen === 'world_intro') {
    return (
      <>
        <WorldIntroCutscene language={settings.language} onComplete={completeWorldIntro} />
        <GlobalTooltipLayer />
      </>
    );
  }

  if (screen === 'map_editor') {
    return (
      <MenuShell>
        <MapEditorScreen
          onBack={() => setScreen('main_menu')}
        />
        <GlobalTooltipLayer />
      </MenuShell>
    );
  }

  if (screen === 'main_menu') {
    return (
      <>
        <MainMenu
          onStartGame={handleStartGame}
          onContinueGame={handleContinueGame}
          onOpenLoadGame={() => setScreen('load_game')}
          hasSave={hasSave}
          onOpenSettings={() => setShowSettings(true)}
          onOpenAchievements={() => setShowAchievements(true)}
          onOpenMapEditor={() => setScreen('map_editor')}
          onOpenTutorial={() => setShowTutorial(true)}
          playerNickname={playerNickname}
          setPlayerNickname={setPlayerNickname}
          playerCivIndex={playerCivIndex}
          setPlayerCivIndex={setPlayerCivIndex}
          metaProfile={metaProfile}
          onMetaLoadoutChange={handleMetaLoadoutChange}
          onMetaPolicyChange={handleMetaPolicyChange}
        />
        <AnimatePresence>
          {showSettings && (mobileLayout
            ? <MobileSettingsScreen onClose={() => setShowSettings(false)} onSave={applyAppSettings} />
            : <SettingsScreen onClose={() => setShowSettings(false)} onSave={applyAppSettings} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showAchievements && (
            <AchievementsScreen
              achievements={achievements}
              onClose={() => setShowAchievements(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showTutorial && <TutorialScreen onClose={() => setShowTutorial(false)} />}
        </AnimatePresence>
        <GameLoadingOverlay
          active={loadingOverlay.active}
          title={loadingOverlay.title}
          subtitle={loadingOverlay.subtitle}
          progress={loadingOverlay.progress}
          phaseKey={loadingOverlay.phaseKey}
        />
        <GlobalTooltipLayer />
      </>
    );
  }

  if (!gameState) return null;

  return (
    <LocalPlayerCivIndexContext.Provider value={localViewerCivIndex}>
    <div className="fixed inset-0 bg-stone-950 overflow-hidden flex flex-col">
      <GameLoadingOverlay
        active={loadingOverlay.active}
        title={loadingOverlay.title}
        subtitle={loadingOverlay.subtitle}
        progress={loadingOverlay.progress}
        phaseKey={loadingOverlay.phaseKey}
        zIndexClass="z-[260]"
      />
      {/* Turn flash overlay */}
      <AnimatePresence>
        {turnFlash && (
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-[150] bg-white/5 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessingTurn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-black/60 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            className={`bg-stone-900 border border-stone-700 text-center shadow-2xl ${
              mobileLayout ? 'rounded-xl px-5 py-5' : 'rounded-2xl px-10 py-8'
            }`}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="mb-4 flex justify-center"
              >
                <GnozianGlyph name="gear" size={34} className="text-amber-400/90" />
              </motion.div>
              <div className={`text-white font-bold ${mobileLayout ? 'text-base' : 'text-lg'}`}>{t('game.processing')} {gameState.turn}...</div>
              <div className="text-gray-400 text-sm mt-1">{t('game.aiThinking')}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 relative">
        <GameMapView
          gameState={gameState}
          onTileClick={handleTileClick}
          onClearSelection={handleClearSelection}
          graphics={mapGraphics}
          cameraControls={settings.cameraControls}
          onViewportSize={handleMapViewportSize}
          localViewerCivIndex={localViewerCivIndex}
          interactionTick={interactionTick}
          onWorldCameraChange={handleWorldCameraChange}
          focusHex={minimapFocus}
        />


        {/* Notification System */}
        <NotificationSystem
          messages={visibleHudMessages}
          onRemove={(id) => setDisplayedMessageIds(prev => new Set([...prev, id]))}
        />

        {achievementToasts.length > 0 && (
          <AchievementUnlockStack items={achievementToasts} onDismiss={dismissAchievementToast} />
        )}
        {techUnlockToasts.length > 0 && (
          <TechUnlockToastStack items={techUnlockToasts} onDismiss={dismissTechUnlockToast} />
        )}

        {/* HUD overlay */}
        <HUD
          gameState={gameState}
          worldCamera={worldCamera}
          onMinimapNavigate={handleMinimapNavigate}
          mapViewportWidth={mapViewportPx.w}
          mapViewportHeight={mapViewportPx.h}
          onEndTurn={handleEndTurn}
          onOpenTechTree={() => { setShowTechTree(true); setShowDiplomacy(false); setOpenCityId(null); setShowEmpire(false); }}
          onOpenDiplomacy={() => { setShowDiplomacy(true); setShowTechTree(false); setOpenCityId(null); setShowEmpire(false); }}
          onOpenEmpire={() => { setShowEmpire(true); setShowTechTree(false); setShowDiplomacy(false); setOpenCityId(null); }}
          onOpenPause={() => setShowPauseMenu(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenAchievements={() => setShowAchievements(true)}
          onOpenVictoryTracker={() => setShowVictoryTracker(true)}
          onOpenGreatPeople={() => setShowGreatPeople(true)}
          onOpenStats={() => setShowStats(true)}
          onOpenHelp={() => setShowHelp(true)}
          showHelpPanel={showHelp}
          showStatsPanel={showStats}
          showVictoryTrackerPanel={showVictoryTracker}
          showGreatPeoplePanel={showGreatPeople}
          onOpenCity={handleOpenCity}
          onFoundCity={handleFoundCity}
          onAttackCity={handleAttackCity}
          onStackUnitsToMove={handleStackUnitsToMove}
          onActivateGreatPerson={handleActivateGreatPerson}
          onBuildImprovement={handleBuildImprovement}
          onAppointCommander={handleAppointCommander}
          onAssignCommander={handleAssignCommander}
          onUnassignCommander={handleUnassignCommander}
          onActivateCommander={handleActivateCommander}
          onSetScoutAutoExplore={handleSetScoutAutoExplore}
        />

        <LegacyCrisisGameModals
          gameState={gameState}
          onChooseLegacyOption={handleChooseLegacyOption}
          onSetCrisisPolicy={handleSetCrisisPolicy}
          onDeferLegacyPrompt={handleDeferLegacyPrompt}
          onDeferCrisisPolicyPrompt={handleDeferCrisisPolicyPrompt}
        />

        {firstContactQueue.length > 0 ? (
          <FirstContactModal
            gameState={gameState}
            viewerCivIndex={localViewerCivIndex}
            otherCivIndex={firstContactQueue[0]!}
            onFinished={dismissFirstContactHead}
          />
        ) : null}

        <AnimatePresence>
          {showPauseMenu && (
            <PauseMenu
              onResume={() => setShowPauseMenu(false)}
              onSave={() => {
                const ok = persistGameState(gameState);
                if (ok) {
                  setHasSave(true);
                  refreshHasSave();
                } else {
                  setGameState(prev =>
                    prev ? addMessage(prev, t('saveLoad.quotaExceeded'), 'warning') : null,
                  );
                }
              }}
              onOpenSettings={() => {
                setShowPauseMenu(false);
                setShowSettings(true);
              }}
              onOpenAchievements={() => {
                setShowPauseMenu(false);
                setShowAchievements(true);
              }}
              onOpenHelp={() => {
                setShowPauseMenu(false);
                setShowHelp(true);
              }}
              onOpenTutorial={() => {
                setShowPauseMenu(false);
                setShowTutorial(true);
              }}
              onMainMenu={() => {
                const saved = persistGameState(gameState);
                if (!saved) {
                  setGameState(prev =>
                    prev ? addMessage(prev, t('saveLoad.quotaExceeded'), 'warning') : null,
                  );
                  setShowPauseMenu(false);
                  return;
                }
                setHasSave(true);
                refreshHasSave();
                setShowPauseMenu(false);
                setScreen('main_menu');
              }}
            />
          )}
        </AnimatePresence>

        {showPerfOverlay && !mobileLayout && (
          <div className="pointer-events-none absolute right-3 top-14 z-[280] rounded border border-emerald-900/50 bg-black/92 px-2 py-1 font-mono text-[11px] text-emerald-300">
            FPS ~ {perfFps} · {t('game.perfHint')}
          </div>
        )}

        {showDevConsole && (
          <DevConsole
            gameState={gameState}
            onApplyState={commitLocalState}
            onClose={() => setShowDevConsole(false)}
            liveCamera={cameraState}
            onTeleportCamera={handleTeleportCamera}
            showPerf={showPerfOverlay}
            onTogglePerf={() => setShowPerfOverlay(v => !v)}
            readOnly={false}
          />
        )}
      </div>

      {/* Panels */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showTechTree && (
            <TechTree
              gameState={gameState}
              onClose={() => setShowTechTree(false)}
              onResearch={handleResearch}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDiplomacy && (
            <DiplomacyPanel
              gameState={gameState}
              onClose={() => setShowDiplomacy(false)}
              onUpdateState={commitLocalState}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {screen === 'game' && incomingSettlementOffer && gameState && (
            <DiplomaticSettlementModal
              key={incomingSettlementOffer.id}
              gameState={gameState}
              me={localViewerCivIndex}
              mode="respond"
              kind={incomingSettlementOffer.kind}
              otherCivIndex={incomingSettlementOffer.fromCiv}
              offer={incomingSettlementOffer}
              onClose={() => {}}
              onUpdateState={commitLocalState}
              allowBackdropClose={false}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {openCity && (
            <CityPanel
              city={openCity}
              gameState={gameState}
              viewerCivIndex={localViewerCivIndex}
              onClose={() => setOpenCityId(null)}
              onUpdateState={commitLocalState}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEmpire && (
            <EmpirePanel
              gameState={gameState}
              onClose={() => {
                setShowEmpire(false);
                setShowGovernmentModal(false);
              }}
              onUpdateState={commitLocalState}
              onOpenGovernment={() => setShowGovernmentModal(true)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEmpire && showGovernmentModal && (
            <GovernmentModal
              gameState={gameState}
              onClose={() => setShowGovernmentModal(false)}
              onUpdateState={commitLocalState}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Victory screen */}
      <AnimatePresence>
        {showVictory && gameState.phase === 'victory' && (
          <VictoryScreen
            gameState={gameState}
            onNewGame={() => {
              setShowVictory(false);
              setScreen('main_menu');
            }}
            onContinue={() => setShowVictory(false)}
          />
        )}
      </AnimatePresence>

      {/* Settings screen */}
      <AnimatePresence>
          {showSettings && (mobileLayout
            ? <MobileSettingsScreen onClose={() => setShowSettings(false)} onSave={applyAppSettings} />
            : <SettingsScreen onClose={() => setShowSettings(false)} onSave={applyAppSettings} />
          )}
      </AnimatePresence>

      {/* Achievements screen */}
      <AnimatePresence>
        {showAchievements && (
          <AchievementsScreen
            achievements={achievements}
            onClose={() => setShowAchievements(false)}
          />
        )}
      </AnimatePresence>

      {/* Help screen */}
      <AnimatePresence>
        {showHelp && (
          <HelpScreen
            onClose={() => setShowHelp(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTutorial && <TutorialScreen onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>

      {/* Stats screen */}
      <AnimatePresence>
        {showStats && gameState && (
          <StatsScreen
            gameState={gameState}
            onClose={() => setShowStats(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVictoryTracker && gameState && (
          <VictoryTracker gameState={gameState} onClose={() => setShowVictoryTracker(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGreatPeople && gameState && (
          <GreatPeopleScreen gameState={gameState} onClose={() => setShowGreatPeople(false)} />
        )}
      </AnimatePresence>

      <GlobalTooltipLayer />
    </div>
    </LocalPlayerCivIndexContext.Provider>
  );
}
