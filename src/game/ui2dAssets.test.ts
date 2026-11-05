import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const base = path.resolve('public/ui-2d');
const manifest = JSON.parse(readFileSync(path.join(base, 'manifest.json'), 'utf8')) as {
  count: number;
  assets: Array<{ id: string; file: string; category: string; width: number; height: number }>;
};

describe('Gnozian atomic 2D assets', () => {
  it('exports hundreds of independent graphics', () => {
    expect(manifest.count).toBeGreaterThan(230);
    expect(manifest.assets).toHaveLength(manifest.count);
    expect(new Set(manifest.assets.map(a => a.id)).size).toBe(manifest.count);
  });
  it('has real SVG files on disk for every registered asset', () => {
    for (const a of manifest.assets) {
      const source = readFileSync(path.resolve('public', a.file), 'utf8');
      expect(source).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(source).toMatch(/<\/svg>$/);
      expect(source).not.toContain('[вставить]');
      expect(a.width).toBeGreaterThan(0);
      expect(a.height).toBeGreaterThan(0);
    }
  });
  it('provides all four button families in five states', () => {
    for (const family of ['primary','secondary','ghost','danger']) {
      for (const state of ['normal','hover','pressed','selected','disabled']) {
        expect(manifest.assets.map(a => a.id)).toContain('button-'+family+'-'+state);
      }
    }
  });
  it('includes map tiles, controls, resources and game-screen icons', () => {
    const names = manifest.assets.map(a => a.id);
    for (const name of [
      'icon-play-md','icon-trophy-md','icon-food-md','icon-production-md',
      'icon-diplomacy-md','icon-science-md','icon-war-md','icon-save-md',
      'terrain-ocean','terrain-forest','terrain-mountains','overlay-selected',
      'chrome-panel','chrome-corner','progress-food','chrome-slider-thumb',
    ]) expect(names).toContain(name);
    expect(readdirSync(base).filter(n=>n.endsWith('.svg'))).toHaveLength(manifest.count);
  });
});
