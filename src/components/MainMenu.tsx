import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameSettings, TerrainType } from '../game/types';
import type { GnozianGlyphName } from './ui';
import { CIV_TEMPLATES } from '../game/constants';
import { t } from '../i18n';
import {
  civBonusSummaryLines,
  civTemplateAbility,
  civTemplateAbilityDesc,
  civTemplateLeader,
  civTemplateName,
} from '../i18n/civTemplateI18n';
import { playUiClick } from '../audio/AudioManager';
import { closeWindow, hasElectronBridge } from '../utils/electronAPI';
import {
  GnzButton,
  GnzPanel,
  MenuStarfield,
  GnozianMenuFlank,
  GnozianDivider,
  GnozianGlyph,
  GnozianPanelCorners,
  CivEmblem,
  MapSizeGlyph,
} from './ui';
import MapTypePreview from './MapTypePreview';
import { validateTerrainImport, formatTerrainImportError } from '../map/mapEditorUtils';
import { useLayoutProfile } from '../hooks/useLayoutProfile';
import MobileMainMenu from './MobileMainMenu';
import { assetUrl } from '../utils/assetUrl';
import {
  MEMENTO_DEFINITIONS,
  META_MAX_EQUIPPED_MEMENTOS,
  sanitizeMementoLoadout,
  type MetaPolicy,
  type MetaProfile,
} from '../game/metaProgression';
import { loadPlayerProfile } from '../game/playerProfile';

type NewGameFormSettings = Omit<GameSettings, 'humanCivIndex' | 'humanNickname'>;

const NEW_GAME_MAP_TYPES: GameSettings['mapType'][] = [
  'pangaea',
  'continents',
  'earth',
  'archipelago',
  'highlands',
  'great_lakes',
  'inland_sea',
  'wetlands',
  'drylands',
  'shattered',
  'ring_sea',
  'random',
];

const MAP_TYPE_GLYPH: Record<GameSettings['mapType'], GnozianGlyphName> = {
  pangaea: 'globe',
  continents: 'map',
  earth: 'compass',
  archipelago: 'islands',
  highlands: 'mountain',
  great_lakes: 'lake',
  inland_sea: 'wave',
  wetlands: 'lake',
  drylands: 'mountain',
  shattered: 'map',
  ring_sea: 'compass',
  random: 'dice',
};

const DIFFICULTY_GLYPH: Record<GameSettings['difficulty'], GnozianGlyphName> = {
  settler: 'moon',
  chieftain: 'sun',
  warlord: 'walk',
  prince: 'shield',
  emperor: 'crown',
  deity: 'sparkles',
};

const MENU_SOCIAL_LINKS = {
  github: 'https://github.com/skaletun/Gnozian',
  twitch: 'https://twitch.tv/skaletun',
} as const;

interface Props {
  onStartGame: (settings: GameSettings, customTerrain?: TerrainType[][] | null) => void;
  onContinueGame: () => void;
  onOpenLoadGame: () => void;
  hasSave: boolean;
  onOpenSettings?: () => void;
  onOpenAchievements?: () => void;
  onOpenMapEditor?: () => void;
  onOpenTutorial?: () => void;
  playerNickname: string;
  setPlayerNickname: (v: string) => void;
  playerCivIndex: number;
  setPlayerCivIndex: (v: number) => void;
  metaProfile: MetaProfile;
  onMetaLoadoutChange: (loadout: string[]) => void;
  onMetaPolicyChange: (policy: MetaPolicy) => void;
}

export default function MainMenu({
  onStartGame,
  onContinueGame,
  onOpenLoadGame,
  hasSave,
  onOpenSettings,
  onOpenAchievements,
  onOpenMapEditor,
  onOpenTutorial,
  playerNickname,
  setPlayerNickname,
  playerCivIndex,
  setPlayerCivIndex,
  metaProfile,
  onMetaLoadoutChange,
  onMetaPolicyChange,
}: Props) {
  const layoutProfile = useLayoutProfile();
  const compact = layoutProfile === 'mobile';
  const isWebRuntime = typeof navigator !== 'undefined' && !/electron/i.test(navigator.userAgent);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);
  const [spCustomTerrain, setSpCustomTerrain] = useState<TerrainType[][] | null>(null);
  const [spCustomMapLabel, setSpCustomMapLabel] = useState('');
  const [spCustomMapErr, setSpCustomMapErr] = useState<string | null>(null);
  const [settings, setSettings] = useState<NewGameFormSettings>({
    mapWidth: 40,
    mapHeight: 30,
    numCivs: 4,
    difficulty: 'prince',
    seed: Math.floor(Math.random() * 99999),
    maxTurns: 500,
    mapType: 'continents',
    civNames: CIV_TEMPLATES.map(c => c.name),
    metaMementoLoadout: metaProfile.equippedMementos,
    metaProgressionPolicy: metaProfile.mpPolicy,
  });

  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      metaMementoLoadout: sanitizeMementoLoadout(
        prev.metaMementoLoadout ?? metaProfile.equippedMementos,
        metaProfile.unlockedMementos
      ),
      metaProgressionPolicy: metaProfile.mpPolicy,
    }));
  }, [metaProfile.equippedMementos, metaProfile.mpPolicy, metaProfile.unlockedMementos]);

  useEffect(() => {
    if (settings.mapType !== 'earth') return;
    setSettings(s => {
      const numCivs = CIV_TEMPLATES.length;
      const mapWidth = 520;
      const mapHeight = 240;
      if (s.numCivs === numCivs && s.mapWidth === mapWidth && s.mapHeight === mapHeight) return s;
      return { ...s, numCivs, mapWidth, mapHeight };
    });
  }, [settings.mapType]);

  useEffect(() => {
    if (!showNewGame) return;
    const p = loadPlayerProfile();
    const d = p?.displayName?.trim();
    if (!d) return;
    const t = playerNickname.trim();
    if (t === '' || t === 'Player') {
      setPlayerNickname(d.slice(0, 32));
    }
  }, [showNewGame, playerNickname, setPlayerNickname]);

  const handleStart = () => {
    if (spCustomTerrain && (spCustomTerrain.length < 6 || (spCustomTerrain[0]?.length ?? 0) < 6)) {
      setSpCustomMapErr(t('newGame.customMapTooSmall'));
      return;
    }
    setSpCustomMapErr(null);
    const maxIdx = CIV_TEMPLATES.length - 1;
    const full: GameSettings = {
      ...settings,
      humanCivIndex: Math.max(0, Math.min(maxIdx, playerCivIndex)),
      humanNickname: playerNickname.trim().slice(0, 48),
    };
    if (spCustomTerrain) {
      full.mapWidth = spCustomTerrain[0]?.length ?? full.mapWidth;
      full.mapHeight = spCustomTerrain.length;
      full.customMapName = spCustomMapLabel.trim() || t('newGame.importedMapDefault');
      full.customMapHash = btoa(unescape(encodeURIComponent(JSON.stringify(spCustomTerrain)))).slice(0, 24);
    } else {
      full.customMapHash = undefined;
      full.customMapName = undefined;
    }
    onStartGame(full, spCustomTerrain);
  };

  const unlockedMementos = useMemo(
    () => MEMENTO_DEFINITIONS.filter(m => metaProfile.unlockedMementos.includes(m.id)),
    [metaProfile.unlockedMementos]
  );

  const selectedMementos = settings.metaMementoLoadout ?? [];

  const toggleMemento = (id: string) => {
    const has = selectedMementos.includes(id);
    const next = has
      ? selectedMementos.filter(x => x !== id)
      : [...selectedMementos, id];
    const sanitized = sanitizeMementoLoadout(next, metaProfile.unlockedMementos);
    setSettings(s => ({ ...s, metaMementoLoadout: sanitized }));
    onMetaLoadoutChange(sanitized);
  };

  const changeMetaPolicy = (policy: MetaPolicy) => {
    setSettings(s => ({ ...s, metaProgressionPolicy: policy }));
    onMetaPolicyChange(policy);
  };

  const mapSizePresets = useMemo(
    () => [
      { label: `${t('newGame.mapSize.micro')} (20×16)`, w: 20, h: 16 },
      { label: `${t('newGame.mapSize.duel')} (26×20)`, w: 26, h: 20 },
      { label: `${t('newGame.mapSize.small')} (34×22)`, w: 34, h: 22 },
      { label: `${t('newGame.mapSize.standard')} (40×30)`, w: 40, h: 30 },
      { label: `${t('newGame.mapSize.large')} (52×36)`, w: 52, h: 36 },
      { label: `${t('newGame.mapSize.huge')} (66×42)`, w: 66, h: 42 },
      { label: `${t('newGame.mapSize.colossal')} (72×48)`, w: 72, h: 48 },
      { label: `${t('newGame.mapSize.immense')} (80×52)`, w: 80, h: 52 },
      { label: `${t('newGame.mapSize.titan')} (92×60)`, w: 92, h: 60 },
      { label: `${t('newGame.mapSize.vast')} (104×68)`, w: 104, h: 68 },
      { label: `${t('newGame.mapSize.mammoth')} (116×76)`, w: 116, h: 76 },
      { label: `${t('newGame.mapSize.celestial')} (128×84)`, w: 128, h: 84 },
      { label: `${t('newGame.mapSize.planetary')} (180×96)`, w: 180, h: 96 },
      { label: `${t('newGame.mapSize.mega')} (240×120)`, w: 240, h: 120 },
      { label: `${t('newGame.mapSize.galactic')} (360×180)`, w: 360, h: 180 },
      { label: `${t('newGame.mapSize.ultimate')} (520×240)`, w: 520, h: 240 },
    ],
    [t]
  );

  const nTpl = CIV_TEMPLATES.length;
  const humanTpl = ((playerCivIndex % nTpl) + nTpl) % nTpl;

  const [previewParams, setPreviewParams] = useState({
    mapType: settings.mapType,
    seed: settings.seed,
    mapWidth: settings.mapWidth,
    mapHeight: settings.mapHeight,
  });
  useEffect(() => {
    const tmr = setTimeout(() => {
      setPreviewParams({
        mapType: settings.mapType,
        seed: settings.seed,
        mapWidth: settings.mapWidth,
        mapHeight: settings.mapHeight,
      });
    }, 220);
    return () => clearTimeout(tmr);
  }, [settings.mapType, settings.seed, settings.mapWidth, settings.mapHeight]);

  const handleConfirmExit = () => {
    playUiClick();
    if (hasElectronBridge()) {
      void closeWindow();
      return;
    }
    window.close();
  };

  const menuButtonClass =
    'gnz-menu-btn gnz-menu-btn--secondary flex w-full items-center justify-center gap-2 py-3.5 font-semibold';
  const menuButtonPrimaryClass =
    'gnz-menu-btn gnz-menu-btn--primary flex w-full items-center justify-center gap-2 py-4 text-lg font-bold';
  const menuButtonAuxClass =
    'gnz-menu-btn gnz-menu-btn--aux flex flex-1 items-center justify-center gap-2 py-3';

  if (compact && !showNewGame) {
    return <MobileMainMenu
      hasSave={hasSave}
      playerNickname={playerNickname}
      onNewGame={() => setShowNewGame(true)}
      onContinueGame={onContinueGame}
      onLoadGame={onOpenLoadGame}
      onSettings={onOpenSettings}
      onAchievements={onOpenAchievements}
      onMapEditor={onOpenMapEditor}
      onTutorial={onOpenTutorial}
    />;
  }

  return (
    <div className={`relative flex min-h-screen flex-col items-center overflow-y-auto overflow-x-hidden gnz-page-bg gnz-menu-shell ${
      compact ? 'justify-start px-2 py-2' : 'justify-center px-2 py-3 sm:px-3 sm:py-4'
    }`}>
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-35"
        style={{ backgroundImage: `url('${assetUrl('bg-img.png')}')` }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/45 via-black/35 to-black/70" />
      <div className={`z-[120] ${compact ? 'sticky top-2 self-end' : 'fixed right-2 top-2 sm:right-5 sm:top-5'}`}>
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setShowExitConfirm(true);
          }}
          className="gnz-menu-btn gnz-menu-btn--secondary flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <svg
            className="h-5 w-5 shrink-0 text-amber-200/95"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('menu.exit')}
        </button>
      </div>

      <div
        className={`z-[120] flex items-center gap-1.5 ${compact ? 'fixed left-2 bottom-2' : 'fixed bottom-2 left-2 sm:bottom-5 sm:left-5'}`}
      >
        <a
          href={MENU_SOCIAL_LINKS.github}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => playUiClick()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-700/45 bg-stone-950/92 text-stone-100/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-colors hover:border-amber-500/60 hover:bg-stone-900/92 hover:text-white"
          aria-label="GitHub"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
        <a
          href={MENU_SOCIAL_LINKS.twitch}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => playUiClick()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/35 bg-stone-950/92 text-violet-200/95 shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-colors hover:border-violet-400/55 hover:bg-stone-900/92 hover:text-violet-100"
          aria-label="Twitch"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M11.571 4.714h1.714v5.143H11.571V4.714zm4.715 0H18v5.143h-1.714V4.714zM6 0L1.714 4.286V19.714h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" />
          </svg>
        </a>
      </div>

      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            key="exit-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[130] gnz-modal-backdrop flex items-center justify-center p-4`}
            onClick={() => {
              playUiClick();
              setShowExitConfirm(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              className="gnz-panel relative w-full max-w-sm rounded-2xl border border-amber-700/50 p-6 ring-1 ring-white/[0.06]"
              onClick={e => e.stopPropagation()}
            >
              <GnozianPanelCorners inset={4} size={32} />
              <div className="relative z-10">
                <p className="text-center text-base font-semibold text-stone-100">{t('menu.exitConfirm')}</p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playUiClick();
                      setShowExitConfirm(false);
                    }}
                    className="flex-1 rounded-xl border border-stone-600/50 bg-stone-800/80 py-3 text-sm font-semibold text-stone-200 transition-colors hover:bg-stone-700/80"
                  >
                    {t('menu.exitStay')}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmExit}
                    className="flex-1 rounded-xl border border-red-800/50 bg-gradient-to-b from-red-900/90 to-red-950 py-3 text-sm font-semibold text-red-50 transition-colors hover:brightness-110"
                  >
                    {t('menu.exitQuit')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <MenuStarfield
        count={compact ? (isWebRuntime ? 20 : 32) : (isWebRuntime ? 36 : 52)}
        seed={0x4d41494e}
        className="opacity-90"
        twinkle={!isWebRuntime}
      />

      {/* Decorative terrain shapes */}
      {!compact && <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48">
        <svg viewBox="0 0 1200 200" className="h-full w-full" preserveAspectRatio="none">
          <polygon points="0,200 0,120 80,80 160,110 240,60 320,90 400,50 480,85 560,40 640,70 720,30 800,65 880,25 960,55 1040,20 1120,50 1200,30 1200,200" fill="#1a3a5c" opacity="0.4" />
          <polygon points="0,200 0,150 100,120 200,140 300,100 400,125 500,90 600,115 700,80 800,105 900,70 1000,95 1100,65 1200,90 1200,200" fill="#0d2040" opacity="0.6" />
          <polygon points="0,200 0,170 150,155 300,165 450,145 600,160 750,140 900,155 1050,135 1200,150 1200,200" fill="#061428" opacity="0.8" />
        </svg>
      </div>}

      <div className="relative z-10 mx-auto flex w-full max-w-[1480px] flex-col items-center px-2">
        <div className="flex min-w-0 w-full flex-col items-center">
      {/* Logo — SVG flanks match gnozian-ico parchment + gold hex motif */}
      <div className={`relative z-10 text-center ${compact ? 'mb-3 mt-1' : 'mb-5 sm:mb-10'}`}>
        <div className="mb-2 flex items-center justify-center gap-1 sm:mb-3 sm:gap-3">
          {!compact && <GnozianMenuFlank variant="globe" size={48} className="shrink-0 drop-shadow-lg sm:h-14 sm:w-14" />}
          <div className="min-w-0 px-1">
            <h1 className={`bg-gradient-to-b from-[#fff6d4] via-[#e8c060] to-[#8b6914] bg-clip-text font-black tracking-tight text-transparent drop-shadow-[0_3px_6px_rgba(0,0,0,0.55)] font-[family-name:var(--font-gnz-display)] ${
              compact ? 'text-3xl' : 'text-4xl sm:text-6xl lg:text-7xl'
            }`}>
              GNOZIAN
            </h1>
            <div className="gnz-subtle mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[#3d2914]/90 sm:text-lg sm:tracking-[0.4em]">
              {t('menu.subtitle')}
            </div>
          </div>
          {!compact && <GnozianMenuFlank variant="blade" size={48} className="shrink-0 drop-shadow-lg sm:h-14 sm:w-14" />}
        </div>
        <GnozianDivider className={`mx-auto opacity-90 ${compact ? 'mb-2 max-w-[92vw]' : 'mb-3 max-w-md sm:mb-4 sm:max-w-xl'}`} />
        <div className={`gnz-subtle mx-auto max-w-lg ${compact ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
          {t('menu.description')}
        </div>
      </div>

      {/* Hub: primary column + tools column */}
      {!showNewGame ? (
        <div className={`relative z-10 grid w-full max-w-5xl gap-4 px-2 ${compact ? 'grid-cols-1' : 'lg:grid-cols-5 lg:gap-6'}`}>
          <GnzPanel
            ornament
            className={`relative ${compact ? 'px-3 py-3' : 'lg:col-span-3 lg:px-6 lg:py-6'} px-4 py-4`}
          >
          {hasSave && (
            <GnzButton
              audioOnClick
              variant="secondary"
              className={menuButtonClass}
              onClick={onContinueGame}
            >
              <GnozianGlyph name="save" size={18} className="text-amber-200/95" />
              {t('menu.continueGame')}
            </GnzButton>
          )}
          <GnzButton
            audioOnClick
            variant="secondary"
            className={menuButtonClass}
            onClick={() => {
              playUiClick();
              onOpenLoadGame();
            }}
          >
            <GnozianGlyph name="save" size={18} className="text-amber-200/95" />
            {t('menu.loadGame')}
          </GnzButton>
          <GnzButton audioOnClick variant="primary" className={menuButtonPrimaryClass} onClick={() => setShowNewGame(true)}>
            <GnozianGlyph name="map" size={22} className="text-amber-100/90" />
            {t('menu.newGame')}
          </GnzButton>
          {onOpenTutorial && (
            <GnzButton
              audioOnClick
              variant="secondary"
              className={menuButtonClass}
              onClick={onOpenTutorial}
            >
              <GnozianGlyph name="book" size={20} className="text-amber-200/95" />
              {t('menu.tutorial')}
            </GnzButton>
          )}
          </GnzPanel>

          <GnzPanel
            ornament
            className={`relative ${compact ? 'px-3 py-3' : 'lg:col-span-2 lg:px-5 lg:py-5'} px-4 py-4`}
          >
            {onOpenMapEditor && (
              <GnzButton
                audioOnClick
                variant="secondary"
                className={menuButtonClass}
                type="button"
                onClick={onOpenMapEditor}
              >
                <GnozianGlyph name="compass" size={18} className="text-amber-200/95" />
                {t('menu.mapEditor')}
              </GnzButton>
            )}
            <div className="flex w-full gap-4">
              <GnzButton
                audioOnClick
                variant="secondary"
                className={menuButtonAuxClass}
                onClick={onOpenSettings}
              >
                <GnozianGlyph name="gear" size={18} className="text-amber-200/95" />
                {t('menu.settings')}
              </GnzButton>
              <GnzButton
                audioOnClick
                variant="secondary"
                className={menuButtonAuxClass}
                onClick={onOpenAchievements}
              >
                <GnozianGlyph name="trophy" size={18} className="text-amber-200/95" />
                {t('menu.achievements')}
              </GnzButton>
            </div>
            <div className="gnz-subtle mt-auto border-t border-cyan-200/[0.12] pt-4 text-center text-[11px] leading-snug">
              {t('menu.version')}
            </div>
          </GnzPanel>
        </div>
      ) : (
        /* New Game Settings */
        <div className={`relative z-10 flex w-full max-w-5xl flex-col gap-3 px-1 sm:px-3 lg:max-h-[85vh] lg:flex-row lg:items-stretch lg:gap-6 ${
          compact ? 'pb-2' : ''
        }`}>
        <GnzPanel ornament className={`max-h-[min(84vh,720px)] flex-1 overflow-y-auto lg:min-w-0 ${
          compact ? 'p-3' : 'p-3 sm:p-6'
        }`}>
          <div className="mb-5 flex items-center justify-between border-b border-amber-800/25 pb-4">
            <h2 className="gnz-heading flex items-center gap-2 text-xl font-bold">
              <GnozianGlyph name="map" size={22} className="text-amber-400/90" />
              {t('newGame.title')}
            </h2>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                setShowNewGame(false);
              }}
              className="rounded-lg px-2 py-1 text-stone-400 transition-colors hover:bg-stone-800/80 hover:text-amber-100"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Map Size */}
            <div className={spCustomTerrain || settings.mapType === 'earth' ? 'pointer-events-none opacity-45' : ''}>
              <label className="mb-2 block text-sm font-medium text-gray-400">{t('newGame.mapSize')}</label>
              <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
                {mapSizePresets.map(p => {
                  const sel = settings.mapWidth === p.w && settings.mapHeight === p.h;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, mapWidth: p.w, mapHeight: p.h }))}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs transition-colors ${
                        sel
                          ? 'border-blue-500 bg-blue-700 text-white'
                          : 'border-stone-600 bg-stone-800 text-stone-300 hover:border-stone-400'
                      }`}
                    >
                      <MapSizeGlyph
                        mapWidth={p.w}
                        mapHeight={p.h}
                        className={sel ? 'h-9 w-full text-sky-200' : 'h-9 w-full text-amber-500/70'}
                      />
                      <span className="text-center leading-tight">{p.label}</span>
                    </button>
                  );
                })}
              </div>
              {settings.mapType === 'earth' ? (
                <p className="mt-2 text-[11px] leading-snug text-amber-600/90">{t('newGame.earthMapSizeFixed')}</p>
              ) : spCustomTerrain ? (
                <p className="mt-2 text-[11px] leading-snug text-amber-600/90">{t('newGame.customMapLockedSizes')}</p>
              ) : null}
            </div>

            {/* Map Type */}
            <div className={spCustomTerrain ? 'pointer-events-none opacity-45' : ''}>
              <label className="mb-2 block text-sm font-medium text-gray-400">{t('newGame.mapType')}</label>
              <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                {NEW_GAME_MAP_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, mapType: type }))}
                    className={`rounded-lg border py-2 text-xs transition-colors ${
                      settings.mapType === type
                        ? 'border-green-500 bg-green-700 text-white'
                        : 'border-stone-600 bg-stone-800 text-stone-300 hover:border-stone-400'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <GnozianGlyph name={MAP_TYPE_GLYPH[type]} size={16} className="text-amber-300/90" />
                      {t(`newGame.mapType.${type}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom map import */}
            <div className="rounded-xl border border-amber-900/25 bg-stone-900/40 p-3">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-amber-700/90">
                {t('newGame.customMap')}
              </label>
              <p className="gnz-subtle mb-2 text-[11px] leading-snug text-stone-400">{t('newGame.customMapHint')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".json,application/json"
                  className="max-w-full flex-1 text-[11px] text-stone-300 file:mr-2 file:rounded-md file:border-0 file:bg-stone-700 file:px-2 file:py-1 file:text-[11px] file:text-stone-200"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    setSpCustomMapErr(null);
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const parsed = JSON.parse(text) as unknown;
                      const validated = validateTerrainImport(parsed);
                      if (!validated.ok) {
                        setSpCustomTerrain(null);
                        setSpCustomMapLabel('');
                        setSpCustomMapErr(formatTerrainImportError(validated, t));
                        return;
                      }
                      setSpCustomTerrain(validated.terrain);
                      setSpCustomMapLabel(file.name.replace(/\.json$/i, ''));
                      setSettings(s => ({ ...s, mapWidth: validated.w, mapHeight: validated.h }));
                    } catch {
                      setSpCustomTerrain(null);
                      setSpCustomMapLabel('');
                      setSpCustomMapErr(t('mapEditor.invalidJson'));
                    }
                    e.target.value = '';
                  }}
                />
                {spCustomTerrain ? (
                  <GnzButton
                    audioOnClick
                    variant="ghost"
                    className="shrink-0 px-3 py-1.5 text-xs"
                    onClick={() => {
                      setSpCustomTerrain(null);
                      setSpCustomMapLabel('');
                      setSpCustomMapErr(null);
                    }}
                  >
                    {t('newGame.clearImportedMap')}
                  </GnzButton>
                ) : null}
              </div>
              {spCustomTerrain ? (
                <p className="mt-2 text-[11px] text-emerald-300/95">
                  {spCustomMapLabel || t('newGame.importedMapDefault')} · {spCustomTerrain[0]?.length ?? 0}×{spCustomTerrain.length}
                </p>
              ) : null}
              {spCustomMapErr ? <p className="mt-2 text-[11px] text-red-400">{spCustomMapErr}</p> : null}
            </div>

            {/* Compact preview (procedural or imported) */}
            <div className="flex flex-col items-center gap-2 lg:hidden">
              <p className="gnz-subtle text-center text-[10px] font-bold uppercase tracking-wider text-amber-700/85">
                {t('newGame.mapPreview')}
              </p>
              <MapTypePreview
                mapType={previewParams.mapType}
                seed={previewParams.seed}
                mapWidth={previewParams.mapWidth}
                mapHeight={previewParams.mapHeight}
                terrain={spCustomTerrain}
                boxMaxWidth={compact ? 220 : 260}
                boxMaxHeight={compact ? 140 : 160}
                className="w-full max-w-[min(92vw,20rem)]"
              />
              <p className="max-w-[14rem] text-center text-[10px] text-stone-500">{t('newGame.mapPreviewHint')}</p>
            </div>

            {/* Player identity (single-player) */}
            <div className="gnz-divider border-t border-amber-900/20 pt-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-amber-700/90">
                {t('newGame.playerLeader')}
              </label>
              <input
                value={playerNickname}
                onChange={e => setPlayerNickname(e.target.value)}
                maxLength={32}
                className="w-full rounded-xl border border-stone-600/60 bg-black/50 px-4 py-2.5 text-stone-100 outline-none ring-amber-700/25 focus:ring-2"
                placeholder={t('newGame.playerPlaceholder')}
              />
              <p className="gnz-subtle mt-1 text-xs">{t('newGame.playerLeaderHint')}</p>

              <label className="mb-2 mt-4 block text-xs font-bold uppercase tracking-wider text-amber-700/90">
                {t('newGame.playAs')}
              </label>
              <div className={`grid max-h-72 gap-2 overflow-y-auto ${compact ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {CIV_TEMPLATES.map((civ, idx) => {
                  const active = playerCivIndex === idx;
                  const bonusLines = civBonusSummaryLines(civ.bonuses, t);
                  return (
                    <button
                      key={civ.id}
                      type="button"
                      onClick={() => setPlayerCivIndex(idx)}
                      className={`flex flex-col items-start gap-1.5 rounded-lg border px-2 py-2 text-left text-xs transition-colors ${
                        active
                          ? 'border-amber-500 bg-amber-950/50 text-amber-100'
                          : 'border-stone-700 bg-stone-900/60 text-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                        <CivEmblem
                          primary={civ.color}
                          secondary={civ.secondaryColor}
                          variant={idx}
                          size={22}
                          className="shrink-0 drop-shadow-sm"
                        />
                          <span className="truncate font-semibold">{civTemplateName(civ, t)}</span>
                        </div>
                        <div className="ml-1 max-w-[48%] shrink-0 rounded-md border border-sky-900/45 bg-sky-950/35 px-1.5 py-1">
                          <div className="line-clamp-2 text-right text-[9px] leading-tight text-sky-300/95">
                            {bonusLines.join(' · ')}
                          </div>
                        </div>
                      </div>
                      <div className="line-clamp-1 text-[10px] text-stone-400">{civTemplateLeader(civ, t)}</div>
                      <div className="line-clamp-1 text-[10px] font-semibold text-amber-300/90">{civTemplateAbility(civ, t)}</div>
                      <div className="line-clamp-2 text-[10px] text-stone-400">{civTemplateAbilityDesc(civ, t)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="gnz-divider border-t border-amber-900/20 pt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-amber-700/90">
                  {t('meta.mementosTitle')}
                </label>
                <span className="text-[11px] text-amber-300/90">
                  {t('meta.legendLine', { level: metaProfile.legendLevel, xp: metaProfile.legendXp })}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-stone-400">
                {t('meta.mementosHint', { max: META_MAX_EQUIPPED_MEMENTOS })}
              </p>
              <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {unlockedMementos.map(m => {
                  const active = selectedMementos.includes(m.id);
                  const atCap =
                    !active && selectedMementos.length >= META_MAX_EQUIPPED_MEMENTOS;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if (!atCap || active) toggleMemento(m.id);
                      }}
                      className={`rounded-lg border px-2 py-2 text-left text-xs transition-colors ${
                        active
                          ? 'border-amber-500 bg-amber-950/55 text-amber-100'
                          : atCap
                            ? 'cursor-not-allowed border-stone-700/60 bg-stone-900/45 text-stone-500'
                            : 'border-stone-700 bg-stone-900/60 text-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <div className="font-semibold">{t(`meta.memento.${m.id}.name`)}</div>
                      <div className="mt-0.5 text-[10px] text-stone-400">{t(`meta.memento.${m.id}.desc`)}</div>
                    </button>
                  );
                })}
              </div>
              <label className="mb-2 mt-3 block text-xs font-bold uppercase tracking-wider text-amber-700/90">
                {t('meta.progressionPolicyTitle')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['enabled', 'disabled'] as const).map(policy => (
                  <button
                    key={policy}
                    type="button"
                    onClick={() => changeMetaPolicy(policy)}
                    className={`rounded-lg border py-2 text-xs transition-colors ${
                      (settings.metaProgressionPolicy ?? 'enabled') === policy
                        ? 'border-sky-500 bg-sky-800/70 text-sky-50'
                        : 'border-stone-700 bg-stone-900/60 text-stone-300 hover:border-stone-500'
                    }`}
                  >
                    {policy === 'enabled' ? t('meta.progressionPolicy.enabled') : t('meta.progressionPolicy.disabled')}
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Civs */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-400">
                {t('newGame.civilizations')}: {settings.numCivs}
              </label>
              {settings.mapType === 'earth' ? (
                <p className="mb-1 text-[11px] leading-snug text-amber-600/90">{t('newGame.earthCivsLocked')}</p>
              ) : null}
              <input
                type="range"
                min="2"
                max={CIV_TEMPLATES.length}
                value={settings.numCivs}
                disabled={settings.mapType === 'earth'}
                onChange={e => setSettings(s => ({ ...s, numCivs: parseInt(e.target.value, 10) }))}
                className={`w-full accent-yellow-500 ${settings.mapType === 'earth' ? 'cursor-not-allowed opacity-50' : ''}`}
              />
              <div className="mt-1 flex justify-between gap-1 text-xs text-gray-500">
                <span>2 — {t('newGame.civsHintMin')}</span>
                <span className="text-center">4 — {t('newGame.civsHintMid')}</span>
                <span className="text-right">
                  {CIV_TEMPLATES.length} — {t('newGame.civsHintMax', { max: CIV_TEMPLATES.length })}
                </span>
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-400">{t('newGame.difficulty')}</label>
              <div className="grid grid-cols-3 gap-2">
                {(['settler', 'chieftain', 'warlord', 'prince', 'emperor', 'deity'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, difficulty: d }))}
                    className={`rounded-lg border py-2 text-xs capitalize transition-colors ${
                      settings.difficulty === d
                        ? 'border-red-500 bg-red-700 text-white'
                        : 'border-stone-600 bg-stone-800 text-stone-300 hover:border-stone-400'
                    }`}
                  >
                    <span className="flex flex-col items-center gap-0.5">
                      <GnozianGlyph name={DIFFICULTY_GLYPH[d]} size={16} className="text-amber-200/90" />
                      <span>{t(`newGame.difficulty.${d}`)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Max Turns */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-400">
                {t('newGame.maxTurns')}: {settings.maxTurns}
              </label>
              <input
                type="range"
                min="100"
                max="1000"
                step="50"
                value={settings.maxTurns}
                onChange={e => setSettings(s => ({ ...s, maxTurns: parseInt(e.target.value, 10) }))}
                className="w-full accent-yellow-500"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>{t('newGame.turnPreset.quick')} (100)</span>
                <span>{t('newGame.turnPreset.normal')} (500)</span>
                <span>{t('newGame.turnPreset.marathon')} (1000)</span>
              </div>
            </div>

            {/* Seed */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-400">{t('newGame.seed')}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={settings.seed}
                  onChange={e => setSettings(s => ({ ...s, seed: parseInt(e.target.value, 10) || 0 }))}
                  className="flex-1 rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, seed: Math.floor(Math.random() * 99999) }))}
                  className="rounded-lg bg-stone-700 px-3 py-2 text-sm text-stone-300 transition-colors hover:bg-stone-600"
                >
                  <span className="inline-flex items-center gap-1">
                    <GnozianGlyph name="dice" size={16} className="text-amber-200/80" />
                    {t('newGame.random')}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <GnzButton audioOnClick variant="ghost" className="flex-1 py-3" onClick={() => setShowNewGame(false)}>
              {t('newGame.back')}
            </GnzButton>
            <GnzButton audioOnClick variant="primary" className="flex flex-1 items-center justify-center gap-2 py-3 font-bold" onClick={handleStart}>
              <GnozianGlyph name="rocket" size={18} className="text-amber-50/90" />
              {t('newGame.start')}
            </GnzButton>
          </div>

          {/* Civ Preview */}
          <div className="gnz-divider mt-4 border-t pt-4">
            <div className="gnz-subtle mb-2 text-xs">{t('newGame.civsInGame')}</div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: settings.numCivs }, (_, i) => {
                const civ = CIV_TEMPLATES[(humanTpl + i) % nTpl];
                return (
                  <div
                    key={`${humanTpl}-${i}`}
                    className="flex items-center gap-1.5 rounded border border-stone-700/50 bg-stone-900/60 px-2 py-1 text-xs"
                  >
                    <CivEmblem
                      primary={civ.color}
                      secondary={civ.secondaryColor}
                      variant={(humanTpl + i) % nTpl}
                      size={18}
                      className="shrink-0"
                    />
                    <span className="flex items-center gap-1 text-stone-300">
                      {i === 0 ? <GnozianGlyph name="user" size={14} className="text-amber-300/90" /> : null}
                      {civTemplateName(civ, t)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </GnzPanel>
        <div className="hidden flex-col items-center justify-start gap-2 lg:flex lg:w-[min(18rem,32vw)] lg:shrink-0 lg:pt-8">
          <p className="gnz-subtle text-center text-[10px] font-bold uppercase tracking-wider text-amber-700/85">
            {t('newGame.mapPreview')}
          </p>
          <MapTypePreview
            mapType={previewParams.mapType}
            seed={previewParams.seed}
            mapWidth={previewParams.mapWidth}
            mapHeight={previewParams.mapHeight}
            terrain={spCustomTerrain}
            boxMaxWidth={300}
            boxMaxHeight={200}
            className="w-full"
          />
          <p className="max-w-[min(12rem,90%)] text-center text-[10px] leading-snug text-stone-500">
            {t('newGame.mapPreviewHint')}
          </p>
        </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
