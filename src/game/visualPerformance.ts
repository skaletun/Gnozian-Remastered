export type VisualQualityTier = 'low' | 'medium' | 'high' | 'ultra' | 'cinematic';

export interface VisualBudget {
  maxParticles: number;
  maxScreenFxAlpha: number;
  renderDistancePadding: number;
}

export const VISUAL_BUDGETS: Record<VisualQualityTier, VisualBudget> = {
  low: { maxParticles: 80, maxScreenFxAlpha: 0.08, renderDistancePadding: 2 },
  medium: { maxParticles: 160, maxScreenFxAlpha: 0.12, renderDistancePadding: 3 },
  high: { maxParticles: 260, maxScreenFxAlpha: 0.16, renderDistancePadding: 3 },
  ultra: { maxParticles: 380, maxScreenFxAlpha: 0.22, renderDistancePadding: 4 },
  cinematic: { maxParticles: 520, maxScreenFxAlpha: 0.28, renderDistancePadding: 5 },
};

let emaFrameMs = 16;
const EMA_ALPHA = 0.09;

export function pushFrameTimeSample(frameMs: number): number {
  const ms = Math.max(1, Math.min(80, frameMs));
  emaFrameMs = emaFrameMs + (ms - emaFrameMs) * EMA_ALPHA;
  return emaFrameMs;
}

export function getFrameQualityScale(): number {
  // > 23ms average frame time starts gradually reducing expensive FX.
  const over = Math.max(0, emaFrameMs - 23);
  return Math.max(0.35, 1 - over / 35);
}

/** When adaptive scaling is disabled in graphics settings, always return 1 (full FX density). */
export function effectiveFrameQualityScale(graphics: { adaptiveFrameQualityScaling?: boolean } | undefined): number {
  if (graphics?.adaptiveFrameQualityScaling === false) return 1;
  return getFrameQualityScale();
}

