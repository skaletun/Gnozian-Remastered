import type { Language } from '../i18n';

/** Timings / counts for fog reveal and screen-space effects (visual remaster / FX budgets). */
export const GRAPHICS_ATMOSPHERE = {
  revealWaveDurationMs: 580,
  weatherBurstIntervalRainMs: 95,
  weatherBurstIntervalStormMs: 55,
  weatherBurstIntervalSnowMs: 120,
  mistSpawnCountRain: 3,
  mistSpawnCountStorm: 5,
  mistSpawnCountSnow: 4,
} as const;

export type AtmosphereWeatherLevel = 'off' | 'normal' | 'rich';

/** Electron window mode (ignored in browser build). */
export type DisplayMode = 'windowed' | 'borderless' | 'fullscreen';
export type GraphicsProfile = 'performance' | 'balanced' | 'quality' | 'cinematic';
export type RenderScale = 0.75 | 1 | 1.25;
export type MapDetailLevel = 'simple' | 'detailed' | 'rich';
export type EffectsLevel = 'off' | 'subtle' | 'full';
export type MotionLevel = 'reduced' | 'standard' | 'full';

export interface GraphicsSettings {
  /** Desktop shell only; stored for next launch. */
  displayMode: DisplayMode;
  graphicsProfile: GraphicsProfile;
  renderScale: RenderScale;
  mapDetail: MapDetailLevel;
  effects: EffectsLevel;
  motion: MotionLevel;
  showTerritory: boolean;
  showRevealEffects: boolean;
  smoothCamera: boolean;
  /** Runtime quality tier used by visual remaster budgets and effects. */
  quality: 'low' | 'medium' | 'high' | 'ultra' | 'cinematic';
  /** Runtime feature flags derived from the grouped graphics settings. */
  particles: boolean;
  waterAnimation: boolean;
  shadows: boolean;
  territoryBorders: boolean;
  cityAnimations: boolean;
  unitAnimations: boolean;
  showGridLines: boolean;
  terrainDetails: boolean;
  lighting: boolean;
  /** Smooth “lift fog” when newly explored tiles appear. */
  atmosphereRevealWave: boolean;
  /** Density of extra rain/snow mist particles on screen (`off` keeps only drawn streaks/flakes). */
  atmosphereWeather: AtmosphereWeatherLevel;
  /** Detail tier for vector/pseudo-3D overlays/effects. */
  visualDetail: 'balanced' | 'ultra';
  /**
   * When true (default), map rendering may reduce particle density and screen FX under sustained frame-time pressure.
   * When false, full effect density from graphics presets is preserved at any FPS.
   */
  adaptiveFrameQualityScaling: boolean;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
  animationSpeed: 'slow' | 'normal' | 'fast';
  showTooltips: boolean;
  autoEndTurn: boolean;
  showGridLines: boolean;
  language: Language;
  graphics: GraphicsSettings;
  /** Electron only: update Discord Rich Presence when Discord desktop is running. */
  discordRichPresence: boolean;
  cameraControls: {
    sensitivity: number;
    sensitivityX: number;
    sensitivityY: number;
    zoomSensitivity: number;
    invertX: boolean;
    invertY: boolean;
  };
}

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  displayMode: 'windowed',
  graphicsProfile: 'quality',
  renderScale: 1,
  mapDetail: 'rich',
  effects: 'full',
  motion: 'full',
  showTerritory: true,
  showRevealEffects: true,
  smoothCamera: true,
  quality: 'cinematic',
  particles: true,
  waterAnimation: true,
  shadows: true,
  territoryBorders: true,
  cityAnimations: true,
  unitAnimations: true,
  showGridLines: false,
  terrainDetails: true,
  lighting: true,
  atmosphereRevealWave: true,
  /** Extra rain/snow mist bursts; presets map this to off / normal / rich. */
  atmosphereWeather: 'normal',
  visualDetail: 'balanced',
  adaptiveFrameQualityScaling: true,
};

export const GRAPHICS_PROFILE_PRESETS: Record<GraphicsProfile, Partial<GraphicsSettings>> = {
  performance: {
    quality: 'medium',
    renderScale: 0.75,
    mapDetail: 'simple',
    effects: 'subtle',
    motion: 'reduced',
    smoothCamera: false,
    particles: false,
    waterAnimation: false,
    shadows: false,
    lighting: false,
    terrainDetails: false,
    cityAnimations: false,
    unitAnimations: false,
    atmosphereRevealWave: false,
    atmosphereWeather: 'off',
    visualDetail: 'balanced',
  },
  balanced: {
    quality: 'high',
    renderScale: 1,
    mapDetail: 'detailed',
    effects: 'subtle',
    motion: 'standard',
    smoothCamera: true,
    particles: true,
    waterAnimation: true,
    shadows: false,
    lighting: false,
    terrainDetails: true,
    cityAnimations: true,
    unitAnimations: true,
    atmosphereRevealWave: true,
    atmosphereWeather: 'normal',
    visualDetail: 'balanced',
  },
  quality: {
    quality: 'cinematic',
    renderScale: 1,
    mapDetail: 'rich',
    effects: 'full',
    motion: 'full',
    smoothCamera: true,
    particles: true,
    waterAnimation: true,
    shadows: true,
    lighting: true,
    terrainDetails: true,
    cityAnimations: true,
    unitAnimations: true,
    atmosphereRevealWave: true,
    atmosphereWeather: 'normal',
    visualDetail: 'balanced',
  },
  cinematic: {
    quality: 'cinematic',
    renderScale: 1.25,
    mapDetail: 'rich',
    effects: 'full',
    motion: 'full',
    smoothCamera: true,
    particles: true,
    waterAnimation: true,
    shadows: true,
    lighting: true,
    terrainDetails: true,
    cityAnimations: true,
    unitAnimations: true,
    atmosphereRevealWave: true,
    atmosphereWeather: 'rich',
    visualDetail: 'ultra',
  },
};

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  masterVolume: 1.0,
  animationSpeed: 'normal',
  showTooltips: true,
  autoEndTurn: false,
  showGridLines: false,
  language: 'ru',
  graphics: DEFAULT_GRAPHICS,
  discordRichPresence: true,
  cameraControls: {
    sensitivity: 1,
    sensitivityX: 1,
    sensitivityY: 1,
    zoomSensitivity: 1,
    invertX: false,
    invertY: false,
  },
};
