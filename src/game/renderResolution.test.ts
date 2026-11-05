import { describe, expect, it } from 'vitest';
import { resolveRenderResolution } from './renderResolution';

const opts = (graphicsProfile: 'performance' | 'balanced' | 'quality' | 'cinematic', renderScale: 0.75 | 1 | 1.25 = 1) =>
  ({ graphicsProfile, renderScale });

describe('Retina game canvas render resolution', () => {
  it('uses physical device pixels at the quality setting on a high-density phone', () => {
    const r = resolveRenderResolution(900, 400, 3, opts('quality'));
    expect(r.pixelRatio).toBe(3);
    expect(r.hardwareScalingLevel).toBeCloseTo(1 / 3);
    expect(r.renderWidth).toBe(2700);
    expect(r.renderHeight).toBe(1200);
  });

  it('allows cinematic supersampling above native pixels without reversing the ratio', () => {
    const r = resolveRenderResolution(900, 400, 3, opts('cinematic', 1.25));
    expect(r.pixelRatio).toBe(3.75);
    expect(r.hardwareScalingLevel).toBeCloseTo(1 / 3.75);
    expect(r.renderWidth).toBe(3375);
    expect(r.renderHeight).toBe(1500);
  });

  it('lets performance modes actually save GPU work without changing interface dimensions', () => {
    const low = resolveRenderResolution(900, 400, 3, opts('performance', .75));
    const balanced = resolveRenderResolution(900, 400, 3, opts('balanced'));
    expect(low.pixelRatio).toBe(.75);
    expect(balanced.pixelRatio).toBe(1.5);
    expect(balanced.renderWidth).toBeGreaterThan(low.renderWidth);
  });

  it('enforces GPU texture and pixel limits on large displays', () => {
    const r = resolveRenderResolution(3840, 2160, 4, opts('cinematic', 1.25), 4096);
    expect(r.renderWidth).toBeLessThanOrEqual(4096);
    expect(r.renderHeight).toBeLessThanOrEqual(4096);
    expect(r.renderWidth * r.renderHeight).toBeLessThanOrEqual(16_000_001);
  });

  it('handles invalid DPR and viewport sizes without a zero-sized canvas', () => {
    const r = resolveRenderResolution(0, Number.NaN, Number.NaN);
    expect(Number.isFinite(r.hardwareScalingLevel)).toBe(true);
    expect(r.renderWidth).toBeGreaterThan(0);
    expect(r.renderHeight).toBeGreaterThan(0);
  });
});
