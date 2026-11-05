import { describe, expect, it } from 'vitest';
import { resolveLayoutProfile } from './useLayoutProfile';

describe('touch-friendly landscape layout', () => {
  it.each([
    [{width: 900,height: 415,touch: true},'mobile'],
    [{width: 1180,height: 820,touch: true},'mobile'],
    [{width: 1366,height: 1024,touch: true},'mobile'],
    [{width: 1520,height: 900,touch: true},'mobile'],
    [{width: 430,height: 930,touch: true},'mobile'],
  ] as const)('uses the compact HUD for %j', (dimensions, profile) => {
    expect(resolveLayoutProfile(dimensions)).toBe(profile);
  });

  it.each([
    [{width: 1440,height: 900,touch: false},'desktop'],
    [{width: 1024,height: 768,touch: false},'tablet'],
    [{width: 1800,height: 1100,touch: true},'tablet'],
    [{width: 640,height: 360,touch: false},'mobile'],
  ] as const)('retains expected layout for %j', (dimensions, profile) => {
    expect(resolveLayoutProfile(dimensions)).toBe(profile);
  });
});
