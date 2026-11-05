import type { GraphicsSettings } from './settingsConstants';

/**
 * Babylon hardware scaling is INVERSE to the desired pixel ratio:
 * 1 means 1 render pixel per CSS pixel, 0.5 means 2 pixels per CSS pixel.
 *
 * Do not divide devicePixelRatio by the target ratio: that downsamples Retina
 * devices and makes even cinematic mode blurry.
 */
export type RenderResolution = {
  pixelRatio: number;
  hardwareScalingLevel: number;
  renderWidth: number;
  renderHeight: number;
};

export function resolveRenderResolution(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  settings?: Pick<GraphicsSettings, 'graphicsProfile' | 'renderScale'>,
  maxTextureSize = 8192
): RenderResolution {
  const width = Number.isFinite(cssWidth) ? Math.max(1, cssWidth) : 1;
  const height = Number.isFinite(cssHeight) ? Math.max(1, cssHeight) : 1;
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? Math.min(5, devicePixelRatio)
    : 1;
  const profile = settings?.graphicsProfile ?? 'quality';
  const scale = settings?.renderScale ?? 1;

  // "Quality" means native Retina pixels. "Cinematic" can supersample them.
  // Reduced profiles are deliberate performance settings, not forced on Ultra.
  const baseRatio =
    profile === 'performance' ? 1 :
      profile === 'balanced' ? Math.min(dpr, 1.5) : dpr;
  const desiredRatio = baseRatio * (Number.isFinite(scale) ? scale : 1);
  const maxPixels =
    profile === 'cinematic' ? 16_000_000 :
      profile === 'quality' ? 12_000_000 :
        profile === 'balanced' ? 5_000_000 : 3_000_000;
  const textureLimit = Number.isFinite(maxTextureSize)
    ? Math.max(1, maxTextureSize)
    : 8192;
  const safeRatio = Math.max(0.5, Math.min(
    desiredRatio,
    Math.sqrt(maxPixels / (width * height)),
    textureLimit / width,
    textureLimit / height,
    5
  ));

  return {
    pixelRatio: safeRatio,
    hardwareScalingLevel: 1 / safeRatio,
    renderWidth: Math.max(1, Math.round(width * safeRatio)),
    renderHeight: Math.max(1, Math.round(height * safeRatio)),
  };
}
