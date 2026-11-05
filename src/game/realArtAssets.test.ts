import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { GnzResourceIcon, RASTER_RESOURCE_IDS, resourceArtUrl } from '../components/ui/GnzResourceIcon';

const REAL_ART: Record<string,string> = {
  food: 'd4587dd002e059de6c6d4b7918914f0b2fe161b3',
  production: 'f62f9aa9abb1473bf4f626f2c2a1aa767e282470',
  gold: '1a57bfde9a9ba15f00ab4691bf67ecbeb5483ce0',
  science: '68ec2a10b58b7f6fbb17857a10aca22272d05629',
};

describe('actual generated raster assets are part of the running game', () => {
  it('keeps each reviewed image as a real, independently addressable WebP', () => {
    for (const id of RASTER_RESOURCE_IDS) {
      const filename=path.resolve('public/ui-art/resource-'+id+'.webp');
      expect(existsSync(filename)).toBe(true);
      const bytes=readFileSync(filename);
      expect(bytes.subarray(0,4).toString('ascii')).toBe('RIFF');
      expect(bytes.subarray(8,12).toString('ascii')).toBe('WEBP');
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(REAL_ART[id]).toMatch(/^[a-f0-9]{40}$/);
    }
  });
  it('renders actual WebP URLs rather than synthetically generated SVG icons', () => {
    for (const id of RASTER_RESOURCE_IDS) {
      const html=renderToStaticMarkup(createElement(GnzResourceIcon,{resource:id,size:22}));
      expect(html).toContain('data-remaster-raster="'+id+'"');
      expect(html).toContain('ui-art/resource-'+id+'.webp');
      expect(html).not.toContain('ui-2d/icon-');
    }
  });
  it('preserves a fallback for yet-unreviewed yields', () => {
    const html=renderToStaticMarkup(createElement(GnzResourceIcon,{resource:'culture',size:18}));
    expect(html).toContain('<svg');
    expect(html).not.toContain('undefined');
    expect(resourceArtUrl('food')).toMatch(/ui-art\/resource-food.webp$/);
  });
});
