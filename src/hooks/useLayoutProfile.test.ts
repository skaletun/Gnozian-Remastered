import { describe, expect, it } from 'vitest';
import { resolveLayoutProfile } from './useLayoutProfile';

describe('Remastered landscape-only layouts', () => {
  it('uses mobile UI on common landscape phone dimensions', () => {
    expect(resolveLayoutProfile({ width: 844, height: 390, touch: false })).toBe('mobile');
    expect(resolveLayoutProfile({ width: 932, height: 430, touch: true })).toBe('mobile');
    expect(resolveLayoutProfile({ width: 740, height: 360, touch: false })).toBe('mobile');
    expect(resolveLayoutProfile({ width: 1024, height: 600, touch: true })).toBe('mobile');
  });
  it('retains desktop layout for desktop monitors', () => {
    expect(resolveLayoutProfile({ width: 1920, height: 1080, touch: false })).toBe('desktop');
  });
  it('retains tablet UI on non-phone medium desktops', () => {
    expect(resolveLayoutProfile({ width: 1200, height: 800, touch: false })).toBe('tablet');
  });
});
