import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { t, setLanguage, getLanguage, type Language } from '../i18n';
import type {
  DisplayMode,
  EffectsLevel,
  GameSettings,
  GraphicsProfile,
  GraphicsSettings,
  MapDetailLevel,
  MotionLevel,
  RenderScale,
} from '../game/settingsConstants';
import { DEFAULT_SETTINGS, GRAPHICS_PROFILE_PRESETS } from '../game/settingsConstants';
import { GNOZIAN_GAME_VERSION } from '../game/gameVersion';
import { loadSettings, saveSettingsToStorage } from '../game/settingsStorage';
import {
  GnozianGlyph,
  GnozianPanelCorners,
  type GnozianGlyphName,
  GnzAppModalLayout,
  GnzNavRailBtn,
} from './ui';
import {
  getDiscordRichPresenceStatus,
  hasElectronBridge,
  isElectronShell,
  setDisplayMode,
} from '../utils/electronAPI';
import { playUiClick } from '../audio/AudioManager';
import { modalBackdropMotion, modalCardMotion } from './ui/motionPresets';
import { useLayoutProfile } from '../hooks/useLayoutProfile';

type SettingsTabId = 'audio' | 'gameplay' | 'display' | 'graphics' | 'about';

const SETTINGS_NAV_ITEMS: { id: SettingsTabId; glyph: GnozianGlyphName }[] = [
  { id: 'audio', glyph: 'volume' },
  { id: 'gameplay', glyph: 'gamepad' },
  { id: 'display', glyph: 'palette' },
  { id: 'graphics', glyph: 'monitor' },
  { id: 'about', glyph: 'info' },
];

interface Props {
  onClose: () => void;
  onSave?: (settings: GameSettings) => void;
  onLanguageChange?: (lang: Language) => void;
}

export default function SettingsScreen({ onClose, onSave, onLanguageChange }: Props) {
  const layout = useLayoutProfile();
  const mobile = layout === 'mobile';
  const isWebRuntime = typeof navigator !== 'undefined' && !/electron/i.test(navigator.userAgent);
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [tab, setTab] = useState<SettingsTabId>('audio');
  const [discordRpcMeta, setDiscordRpcMeta] = useState<{
    clientIdConfigured: boolean;
    connected: boolean;
    lastError: string | null;
  } | null>(null);

  const onSaveRef = useRef(onSave);
  const onLanguageChangeRef = useRef(onLanguageChange);
  onSaveRef.current = onSave;
  onLanguageChangeRef.current = onLanguageChange;

  useEffect(() => {
    saveSettingsToStorage(settings);
    if (settings.language !== getLanguage()) {
      setLanguage(settings.language);
      onLanguageChangeRef.current?.(settings.language);
    }
    onSaveRef.current?.(settings);
  }, [settings]);

  useEffect(() => {
    if (!isElectronShell() || tab !== 'display' || !hasElectronBridge()) {
      setDiscordRpcMeta(null);
      return;
    }
    let cancelled = false;
    const pull = () => {
      void getDiscordRichPresenceStatus().then(meta => {
        if (!cancelled) setDiscordRpcMeta(meta);
      });
    };
    pull();
    const delayed =
      settings.discordRichPresence !== false
        ? window.setTimeout(pull, 1200)
        : undefined;
    return () => {
      cancelled = true;
      if (delayed != null) window.clearTimeout(delayed);
    };
  }, [tab, settings.discordRichPresence]);

  useEffect(() => {
    if (isElectronShell()) return;
    const onFullscreenChange = () => {
      const inFs = !!document.fullscreenElement;
      setSettings(prev => {
        const cur = prev.graphics.displayMode ?? 'windowed';
        const nextMode: DisplayMode = inFs
          ? (cur === 'fullscreen' || cur === 'borderless' ? cur : 'fullscreen')
          : 'windowed';
        if (cur === nextMode) return prev;
        return { ...prev, graphics: { ...prev.graphics, displayMode: nextMode } };
      });
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateGraphics = <K extends keyof GraphicsSettings>(key: K, value: GraphicsSettings[K]) => {
    setSettings(prev => ({ ...prev, graphics: { ...prev.graphics, [key]: value } }));
  };

  const applyBrowserDisplayMode = useCallback(async (mode: DisplayMode) => {
    const keyboardApi = (navigator as Navigator & {
      keyboard?: { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void };
    }).keyboard;
    if (typeof document === 'undefined') return;
    if (mode === 'windowed') {
      try {
        keyboardApi?.unlock?.();
      } catch {
        /* */
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      return;
    }
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.().catch(() => {});
    }
    try {
      await keyboardApi?.lock?.(['Escape']);
    } catch {
      /* Browser does not support keyboard lock or blocked it. */
    }
  }, []);

  const resetToDefaults = () => {
    if (confirm(t('settings.resetConfirm'))) {
      setSettings(DEFAULT_SETTINGS);
      setLanguage(DEFAULT_SETTINGS.language);
      onLanguageChange?.(DEFAULT_SETTINGS.language);
    }
  };

  const graphicsProfileOptions: Array<{ value: GraphicsProfile; label: string; icon: GnozianGlyphName }> = [
    { value: 'performance', label: t('settings.graphicsProfile.performance'), icon: 'turtle' },
    { value: 'balanced', label: t('settings.graphicsProfile.balanced'), icon: 'walk' },
    { value: 'quality', label: t('settings.graphicsProfile.quality'), icon: 'sparkles' },
    { value: 'cinematic', label: t('settings.graphicsProfile.cinematic'), icon: 'star' },
  ];

  const applyGraphicsProfile = (profile: GraphicsProfile) => {
    updateSetting('graphics', {
      ...settings.graphics,
      ...GRAPHICS_PROFILE_PRESETS[profile],
      graphicsProfile: profile,
      showTerritory: settings.graphics.showTerritory,
      showRevealEffects: settings.graphics.showRevealEffects,
      territoryBorders: settings.graphics.showTerritory,
      atmosphereRevealWave: settings.graphics.showRevealEffects,
    });
  };

  const updateMapDetail = (value: MapDetailLevel) => {
    updateSetting('graphics', {
      ...settings.graphics,
      mapDetail: value,
      terrainDetails: value !== 'simple',
      lighting: value === 'rich',
      shadows: value === 'rich',
      visualDetail: value === 'rich' ? 'ultra' : 'balanced',
    });
  };

  const updateEffects = (value: EffectsLevel) => {
    updateSetting('graphics', {
      ...settings.graphics,
      effects: value,
      particles: value !== 'off',
      waterAnimation: value !== 'off',
      atmosphereWeather: value === 'full' ? 'rich' : value === 'subtle' ? 'normal' : 'off',
    });
  };

  const updateMotion = (value: MotionLevel) => {
    updateSetting('graphics', {
      ...settings.graphics,
      motion: value,
      unitAnimations: value !== 'reduced',
      cityAnimations: value === 'full',
      smoothCamera: value !== 'reduced',
    });
  };

  const renderToggle = (
    label: ReactNode,
    hint: string,
    value: boolean,
    onChange: (v: boolean) => void
  ) => (
    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700/30">
      <label className="text-white font-semibold flex items-center gap-2">
        {label}
        <span className="text-xs text-gray-400">{hint}</span>
      </label>
      <button
        onClick={() => {
          playUiClick();
          onChange(!value);
        }}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? 'bg-amber-600' : 'bg-gray-600'
        }`}
      >
        <motion.div
          animate={{ x: value ? 24 : 2 }}
          transition={isWebRuntime ? { duration: 0.1 } : { type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        />
      </button>
    </div>
  );

  const renderSegmented = <T extends string | number>(
    label: ReactNode,
    hint: string,
    value: T,
    options: Array<{ value: T; label: string; icon?: GnozianGlyphName }>,
    onChange: (v: T) => void
  ) => (
    <div className="space-y-3 rounded-xl border border-gray-700/30 bg-gray-800/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{label}</div>
          {hint && <p className="mt-1 text-xs leading-relaxed text-gray-400">{hint}</p>}
        </div>
      </div>
      <div className={`grid gap-2 ${options.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              playUiClick();
              onChange(opt.value);
            }}
            className={`rounded-lg px-2 py-2 text-sm font-semibold transition-all ${
              value === opt.value
                ? 'bg-amber-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {opt.icon && <GnozianGlyph name={opt.icon} size={15} className="text-amber-100/90" />}
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      {...modalBackdropMotion}
      className={`fixed inset-0 z-50 gnz-modal-backdrop flex overflow-y-auto items-center justify-center p-3`}
      onClick={() => {
        playUiClick();
        onClose();
      }}
    >
      <motion.div
        {...modalCardMotion}
        className={`relative gnz-panel flex min-h-0 w-full flex-col overflow-hidden border border-cyan-200/[0.14] mx-4 max-h-[min(92vh,880px)] max-w-6xl rounded-2xl ring-1 ring-amber-400/[0.14]`}
        onClick={e => e.stopPropagation()}
      >
        <GnozianPanelCorners inset={4} size={40} />
        <GnzAppModalLayout
          header={
            <div className={`relative z-10 flex items-center justify-between border-b border-cyan-200/[0.12] bg-black/30 ${mobile ? 'p-3' : 'p-6'}`}>
              <h1 className={`gnz-heading flex items-center gap-3 font-black ${mobile ? 'text-xl' : 'text-3xl'}`}>
                <GnozianGlyph name="gear" size={28} className="text-cyan-200/90" />
                {t('settings.title')}
              </h1>
              <button
                onClick={() => {
                  playUiClick();
                  onClose();
                }}
                className="text-2xl text-slate-500 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>
          }
          navRail={(
            <>
              {SETTINGS_NAV_ITEMS.map(({ id: tName, glyph }) => (
                <GnzNavRailBtn
                  key={tName}
                  active={tab === tName}
                  onClick={() => {
                    playUiClick();
                    setTab(tName);
                  }}
                  icon={<GnozianGlyph name={glyph} size={16} className={tab === tName ? 'text-amber-200/95' : 'text-slate-500'} />}
                >
                  {t(`settings.tab.${tName}`)}
                </GnzNavRailBtn>
              ))}
            </>
          )}
          mainClassName={mobile ? 'p-3' : 'p-6'}
          footer={
            <div className={`relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-cyan-200/[0.12] bg-black/35 ${mobile ? 'p-3' : 'p-4'}`}>
              <button
                onClick={() => {
                  playUiClick();
                  resetToDefaults();
                }}
                className="flex items-center gap-2 rounded-lg bg-slate-800/90 px-4 py-2 font-semibold text-slate-300 transition-all hover:bg-slate-700"
              >
                <GnozianGlyph name="refresh" size={16} className="text-cyan-200/80" />
                {t('settings.resetDefaults')}
              </button>
              <button
                onClick={() => {
                  playUiClick();
                  onClose();
                }}
                className="rounded-lg bg-gradient-to-r from-amber-600 to-amber-800 px-6 py-2 font-bold text-white transition-all hover:from-amber-500 hover:to-amber-700"
              >
                ✓ {t('settings.close')}
              </button>
            </div>
          }
        >
          {tab === 'audio' && (
            <div className="space-y-6">
              {(
                [
                  { key: 'masterVolume' as const, icon: 'volume' as const, label: t('settings.masterVolume') },
                  { key: 'musicVolume' as const, icon: 'music' as const, label: t('settings.musicVolume') },
                  { key: 'sfxVolume' as const, icon: 'bell' as const, label: t('settings.sfxVolume') },
                ] as const
              ).map(({ key, icon, label }) => (
                <div key={key}>
                  <label className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 font-semibold text-white">
                      <GnozianGlyph name={icon} size={16} className="text-amber-400/80" />
                      {label}
                    </span>
                    <span className="text-amber-400 font-bold">{Math.round(settings[key] * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings[key] * 100}
                    onChange={e => updateSetting(key, e.target.valueAsNumber / 100)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'gameplay' && (
            <div className="space-y-4">
              {renderToggle(
                <span className="inline-flex items-center gap-2">
                  <GnozianGlyph name="bolt" size={16} className="text-amber-400/80" />
                  {t('settings.autoEndTurn')}
                </span>,
                t('settings.autoEndTurnHint'),
                settings.autoEndTurn,
                v => updateSetting('autoEndTurn', v)
              )}
              {renderToggle(
                <span className="inline-flex items-center gap-2">
                  <GnozianGlyph name="chat" size={16} className="text-amber-400/80" />
                  {t('settings.showTooltips')}
                </span>,
                t('settings.showTooltipsHint'),
                settings.showTooltips,
                v => updateSetting('showTooltips', v)
              )}
              <div>
                <label className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-white">
                    <GnozianGlyph name="bolt" size={16} className="text-amber-400/80" />
                    {t('settings.animationSpeed')}
                  </span>
                  <span className="text-amber-400 font-bold">{t(`settings.speed.${settings.animationSpeed}`)}</span>
                </label>
                <div className="flex gap-2">
                  {(['slow', 'normal', 'fast'] as const).map(speed => (
                    <button
                      key={speed}
                      onClick={() => {
                        playUiClick();
                        updateSetting('animationSpeed', speed);
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
                        settings.animationSpeed === speed
                          ? 'bg-amber-600 text-white shadow-lg'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        <GnozianGlyph
                          name={speed === 'slow' ? 'turtle' : speed === 'normal' ? 'walk' : 'rocket'}
                          size={15}
                          className="text-amber-200/90"
                        />
                        {t(`settings.speed.${speed}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-700/50 pt-4 space-y-3">
                <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">
                  {t('settings.cameraControls')}
                </div>
                <div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-2 font-semibold text-white">
                      <GnozianGlyph name="compass" size={16} className="text-amber-400/80" />
                      {t('settings.cameraSensitivity')}
                    </span>
                    <span className="text-amber-400 font-bold">{settings.cameraControls.sensitivity.toFixed(2)}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.4"
                    max="2"
                    step="0.05"
                    value={settings.cameraControls.sensitivity}
                    onChange={e => updateSetting('cameraControls', { ...settings.cameraControls, sensitivity: e.target.valueAsNumber })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-white">{t('settings.cameraSensitivityX')}</span>
                      <span className="text-amber-400 font-bold text-sm">{settings.cameraControls.sensitivityX.toFixed(2)}x</span>
                    </label>
                    <input
                      type="range"
                      min="0.4"
                      max="2"
                      step="0.05"
                      value={settings.cameraControls.sensitivityX}
                      onChange={e => updateSetting('cameraControls', { ...settings.cameraControls, sensitivityX: e.target.valueAsNumber })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-white">{t('settings.cameraSensitivityY')}</span>
                      <span className="text-amber-400 font-bold text-sm">{settings.cameraControls.sensitivityY.toFixed(2)}x</span>
                    </label>
                    <input
                      type="range"
                      min="0.4"
                      max="2"
                      step="0.05"
                      value={settings.cameraControls.sensitivityY}
                      onChange={e => updateSetting('cameraControls', { ...settings.cameraControls, sensitivityY: e.target.valueAsNumber })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-2 font-semibold text-white">
                      <GnozianGlyph name="target" size={16} className="text-amber-400/80" />
                      {t('settings.cameraZoomSensitivity')}
                    </span>
                    <span className="text-amber-400 font-bold">{settings.cameraControls.zoomSensitivity.toFixed(2)}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.4"
                    max="2"
                    step="0.05"
                    value={settings.cameraControls.zoomSensitivity}
                    onChange={e => updateSetting('cameraControls', { ...settings.cameraControls, zoomSensitivity: e.target.valueAsNumber })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
                {renderToggle(
                  t('settings.cameraInvertX'),
                  '',
                  settings.cameraControls.invertX,
                  v => updateSetting('cameraControls', { ...settings.cameraControls, invertX: v })
                )}
                {renderToggle(
                  t('settings.cameraInvertY'),
                  '',
                  settings.cameraControls.invertY,
                  v => updateSetting('cameraControls', { ...settings.cameraControls, invertY: v })
                )}
              </div>
            </div>
          )}

          {tab === 'display' && (
            <div className="space-y-4">
              {isElectronShell() && (
                <div className="space-y-2 rounded-xl border border-indigo-900/35 bg-indigo-950/20 p-4">
                  {renderToggle(
                    <span className="inline-flex items-center gap-2">
                      <GnozianGlyph name="chat" size={16} className="text-indigo-300/90" />
                      {t('settings.discordRichPresence')}
                    </span>,
                    '',
                    settings.discordRichPresence,
                    v => updateSetting('discordRichPresence', v)
                  )}
                  <p className="text-xs text-gray-500 leading-relaxed px-1">{t('settings.discordRichPresenceHint')}</p>
                  {discordRpcMeta && (
                    <div className="rounded-lg border border-gray-700/40 bg-black/30 px-3 py-2 text-xs text-gray-400 space-y-1">
                      {!discordRpcMeta.clientIdConfigured && (
                        <p className="text-amber-200/90">{t('settings.discordRichPresenceClientId')}</p>
                      )}
                      {discordRpcMeta.clientIdConfigured && (
                        <p className={discordRpcMeta.connected ? 'text-emerald-400/90' : 'text-stone-500'}>
                          {discordRpcMeta.connected
                            ? t('settings.discordRichPresenceLinked')
                            : t('settings.discordRichPresenceWaiting')}
                        </p>
                      )}
                      {discordRpcMeta.lastError && (
                        <p className="text-red-300/90 break-words">{discordRpcMeta.lastError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-white">
                    <GnozianGlyph name="globe" size={16} className="text-amber-400/80" />
                    {t('settings.language')}
                  </span>
                  <span className="text-amber-400 font-bold">{t(`settings.language.${settings.language}`)}</span>
                </label>
                <div className="flex gap-2">
                  {(['en', 'ru'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => {
                        playUiClick();
                        updateSetting('language', lang);
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
                        settings.language === lang
                          ? 'bg-amber-600 text-white shadow-lg'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {lang === 'en' ? '🇬🇧' : '🇷🇺'} {t(`settings.language.${lang}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'graphics' && (
            <div className="space-y-5">
              <div className="space-y-2 rounded-xl border border-gray-700/30 bg-gray-800/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-white">
                    <GnozianGlyph name="monitor" size={16} className="text-amber-400/80" />
                    {t('settings.displayMode')}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-gray-400">
                  {isElectronShell() ? t('settings.displayModeHint') : t('settings.displayModeHintBrowser')}
                </p>
                {!isElectronShell() && (
                  <p className="text-[11px] leading-relaxed text-emerald-300/85">{t('settings.webPerfNotice')}</p>
                )}
                <div className="flex gap-2">
                  {(['windowed', 'borderless', 'fullscreen'] as const).map((m: DisplayMode) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        playUiClick();
                        updateGraphics('displayMode', m);
                        if (hasElectronBridge()) {
                          void setDisplayMode(m);
                        } else {
                          void applyBrowserDisplayMode(m);
                        }
                      }}
                      className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-all ${
                        (settings.graphics.displayMode ?? 'windowed') === m
                          ? 'bg-amber-600 text-white shadow-lg'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {t(`settings.displayMode.${m}`)}
                    </button>
                  ))}
                </div>
              </div>

              {renderSegmented(
                <span className="inline-flex items-center gap-2">
                  <GnozianGlyph name="gamepad" size={16} className="text-amber-400/80" />
                  {t('settings.graphicsProfile')}
                </span>,
                t('settings.graphicsProfileHint'),
                settings.graphics.graphicsProfile,
                graphicsProfileOptions,
                applyGraphicsProfile
              )}

              {renderSegmented<RenderScale>(
                <span className="inline-flex items-center gap-2">
                  <GnozianGlyph name="monitor" size={16} className="text-amber-400/80" />
                  {t('settings.renderScale')}
                </span>,
                t('settings.renderScaleHint'),
                settings.graphics.renderScale,
                [
                  { value: 0.75, label: t('settings.renderScale.performance'), icon: 'turtle' },
                  { value: 1, label: t('settings.renderScale.native'), icon: 'monitor' },
                  { value: 1.25, label: t('settings.renderScale.sharp'), icon: 'sparkles' },
                ],
                v => updateGraphics('renderScale', v)
              )}

              {renderSegmented<MapDetailLevel>(
                <span className="inline-flex items-center gap-2">
                  <GnozianGlyph name="mountain" size={16} className="text-amber-400/80" />
                  {t('settings.mapDetail')}
                </span>,
                t('settings.mapDetailHint'),
                settings.graphics.mapDetail,
                [
                  { value: 'simple', label: t('settings.mapDetail.simple'), icon: 'map' },
                  { value: 'detailed', label: t('settings.mapDetail.detailed'), icon: 'mountain' },
                  { value: 'rich', label: t('settings.mapDetail.rich'), icon: 'sparkles' },
                ],
                updateMapDetail
              )}

              {renderSegmented<EffectsLevel>(
                <span className="inline-flex items-center gap-2">
                  <GnozianGlyph name="wave" size={16} className="text-amber-400/80" />
                  {t('settings.effectsLevel')}
                </span>,
                t('settings.effectsLevelHint'),
                settings.graphics.effects,
                [
                  { value: 'off', label: t('settings.effectsLevel.off'), icon: 'turtle' },
                  { value: 'subtle', label: t('settings.effectsLevel.subtle'), icon: 'wave' },
                  { value: 'full', label: t('settings.effectsLevel.full'), icon: 'sparkles' },
                ],
                updateEffects
              )}

              {renderSegmented<MotionLevel>(
                <span className="inline-flex items-center gap-2">
                  <GnozianGlyph name="bolt" size={16} className="text-amber-400/80" />
                  {t('settings.motionLevel')}
                </span>,
                t('settings.motionLevelHint'),
                settings.graphics.motion,
                [
                  { value: 'reduced', label: t('settings.motionLevel.reduced'), icon: 'turtle' },
                  { value: 'standard', label: t('settings.motionLevel.standard'), icon: 'walk' },
                  { value: 'full', label: t('settings.motionLevel.full'), icon: 'rocket' },
                ],
                updateMotion
              )}

              <div className="border-t border-gray-700/50 pt-4 space-y-3">
                <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">
                  {t('settings.mapOverlays')}
                </div>
                {renderToggle(
                  <span className="inline-flex items-center gap-2">
                    <GnozianGlyph name="map" size={16} className="text-amber-400/80" />
                    {t('settings.showTerritory')}
                  </span>,
                  t('settings.showTerritoryHint'),
                  settings.graphics.showTerritory,
                  v => {
                    updateSetting('graphics', { ...settings.graphics, showTerritory: v, territoryBorders: v });
                  }
                )}
                {renderToggle(
                  <span className="inline-flex items-center gap-2">
                    <GnozianGlyph name="compass" size={16} className="text-amber-400/80" />
                    {t('settings.showRevealEffects')}
                  </span>,
                  t('settings.showRevealEffectsHint'),
                  settings.graphics.showRevealEffects,
                  v => {
                    updateSetting('graphics', { ...settings.graphics, showRevealEffects: v, atmosphereRevealWave: v });
                  }
                )}
                {renderToggle(
                  <span className="inline-flex items-center gap-2">
                    <GnozianGlyph name="sparkles" size={16} className="text-amber-400/80" />
                    {t('settings.adaptiveFrameQualityScaling')}
                  </span>,
                  t('settings.adaptiveFrameQualityScalingHint'),
                  settings.graphics.adaptiveFrameQualityScaling,
                  v => updateGraphics('adaptiveFrameQualityScaling', v)
                )}
                {renderToggle(
                  <span className="inline-flex items-center gap-2">
                    <GnozianGlyph name="compass" size={16} className="text-amber-400/80" />
                    {t('settings.smoothCamera')}
                  </span>,
                  t('settings.smoothCameraHint'),
                  settings.graphics.smoothCamera,
                  v => updateGraphics('smoothCamera', v)
                )}
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="space-y-4">
              <div className="py-6 text-center">
                <div className="mb-4 flex justify-center">
                  <GnozianGlyph name="globe" size={56} className="text-amber-400/90" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-white">GNOZIAN</h2>
                <p className="text-gray-400 mb-4">{t('menu.subtitle')} v{GNOZIAN_GAME_VERSION}</p>
                <p className="text-gray-500 text-sm">{t('menu.description')}</p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30 space-y-3">
                <div className="text-sm">
                  <p className="mb-1 flex items-center gap-2 font-semibold text-amber-400">
                    <GnozianGlyph name="gamepad" size={16} className="text-amber-400/90" />
                    {t('settings.tab.gameplay')}
                  </p>
                  <ul className="text-gray-300 space-y-1 text-xs">
                    <li>• {t('victory.science')} - Research technologies to reach space</li>
                    <li>• {t('victory.culture')} - Spread your civilization's influence</li>
                    <li>• {t('victory.domination')} - Conquer all civilizations</li>
                    <li>• {t('victory.diplomacy')} - Earn diplomatic victory points (wonders, peace, trade)</li>
                    <li>• {t('victory.religion')} - Convert rival empires to your religion</li>
                  </ul>
                </div>

                <div className="text-sm">
                  <p className="mb-1 flex items-center gap-2 font-semibold text-amber-400">
                    <GnozianGlyph name="keyboard" size={16} className="text-amber-400/90" />
                    {t('game.controls.title')}
                  </p>
                  <ul className="text-gray-300 space-y-1 text-xs">
                    <li>• <kbd className="bg-gray-700 px-2 py-1 rounded">Space</kbd> / <kbd className="bg-gray-700 px-2 py-1 rounded">Enter</kbd> - {t('game.endTurn')}</li>
                    <li>• <kbd className="bg-gray-700 px-2 py-1 rounded">T</kbd> - {t('tech.title')}</li>
                    <li>• <kbd className="bg-gray-700 px-2 py-1 rounded">D</kbd> - {t('diplomacy.title')}</li>
                    <li>• <kbd className="bg-gray-700 px-2 py-1 rounded">Esc</kbd> - {t('game.controls.escape')}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </GnzAppModalLayout>
      </motion.div>
    </motion.div>
  );
}
