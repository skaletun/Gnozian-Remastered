import type { GameSettings, GraphicsProfile, GraphicsSettings } from './settingsConstants';
import { DEFAULT_GRAPHICS, DEFAULT_SETTINGS, GRAPHICS_PROFILE_PRESETS } from './settingsConstants';

const SETTINGS_KEY = 'gnozian_settings';

function isElectronRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /electron/i.test(navigator.userAgent);
}

export function optimizeSettingsForWeb(input: GameSettings): GameSettings {
  if (isElectronRuntime()) return input;
  const g = input.graphics;
  return {
    ...input,
    graphics: {
      ...g,
      graphicsProfile: g.graphicsProfile === 'cinematic' ? 'quality' : g.graphicsProfile,
      quality: g.quality === 'ultra' || g.quality === 'cinematic' ? 'high' : g.quality,
      renderScale: g.renderScale === 1.25 ? 1 : g.renderScale,
      shadows: false,
      lighting: false,
      atmosphereRevealWave: false,
      atmosphereWeather: g.atmosphereWeather === 'rich' ? 'normal' : g.atmosphereWeather,
      visualDetail: 'balanced',
      adaptiveFrameQualityScaling: true,
    },
  };
}

function profileFromLegacyQuality(value: unknown): GraphicsProfile {
  if (value === 'low' || value === 'medium') return 'performance';
  if (value === 'ultra' || value === 'cinematic') return 'quality';
  return 'balanced';
}

function normalizeGraphicsSettings(raw: Partial<GraphicsSettings> | undefined): GraphicsSettings {
  const rawProfile = raw?.graphicsProfile ?? profileFromLegacyQuality(raw?.quality);
  const graphicsProfile: GraphicsProfile =
    rawProfile === 'performance' || rawProfile === 'balanced' || rawProfile === 'quality' || rawProfile === 'cinematic'
      ? rawProfile
      : DEFAULT_GRAPHICS.graphicsProfile;
  const preset = GRAPHICS_PROFILE_PRESETS[graphicsProfile];
  return {
    ...DEFAULT_GRAPHICS,
    ...preset,
    ...raw,
    graphicsProfile,
    showGridLines: false,
    visualDetail: raw?.visualDetail ?? (raw as Partial<GraphicsSettings> & { visualRemasterDetail?: GraphicsSettings['visualDetail'] })?.visualRemasterDetail ?? DEFAULT_GRAPHICS.visualDetail,
    showTerritory: raw?.showTerritory ?? raw?.territoryBorders ?? DEFAULT_GRAPHICS.showTerritory,
    showRevealEffects: raw?.showRevealEffects ?? raw?.atmosphereRevealWave ?? DEFAULT_GRAPHICS.showRevealEffects,
    adaptiveFrameQualityScaling:
      typeof raw?.adaptiveFrameQualityScaling === 'boolean'
        ? raw.adaptiveFrameQualityScaling
        : DEFAULT_GRAPHICS.adaptiveFrameQualityScaling,
  };
}

export function loadSettings(): GameSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        graphics: normalizeGraphicsSettings(parsed.graphics),
        cameraControls: { ...DEFAULT_SETTINGS.cameraControls, ...parsed.cameraControls },
      };
      merged.showGridLines = false;
      merged.graphics.showGridLines = false;
      // Do not auto-optimize for web here; return merged settings so the player
      // can choose their preferred graphics profile explicitly.
      return merged;
    }
  } catch {
    console.warn('Could not load settings');
  }
  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    console.warn('Could not save settings');
  }
}
