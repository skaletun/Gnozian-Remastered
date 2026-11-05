import { useState } from 'react';
import { assetUrl } from '../../utils/assetUrl';
import { GnozianGlyph, type GnozianGlyphName } from './gnozian';

export const RASTER_RESOURCE_IDS = ['food', 'production', 'gold', 'science'] as const;
export type RasterResourceId = (typeof RASTER_RESOURCE_IDS)[number];
const GENERATED_ART: ReadonlySet<string> = new Set(RASTER_RESOURCE_IDS);

const FALLBACK_GLYPH: Readonly<Record<string, GnozianGlyphName>> = {
  food: 'food',
  production: 'cog',
  gold: 'trophy',
  science: 'flask',
  culture: 'culture',
  faith: 'religion',
  happiness: 'sparkles',
};

export function resourceArtUrl(resource: RasterResourceId): string {
  return assetUrl('ui-art/resource-' + resource + '.webp');
}

/** Curated assets from the user's original ImageGen art sheets, not placeholder
 * SVGs. The WebP files are part of the static build and work offline in PWA.
 * Other yields retain their existing accessible vector glyphs. */
export function GnzResourceIcon({
  resource, size = 22, className = '', title,
}: {
  resource: string; size?: number; className?: string; title?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (GENERATED_ART.has(resource) && !broken) {
    return (
      <img
        data-remaster-raster={resource}
        alt={title ?? ''}
        aria-hidden={title ? undefined : true}
        src={resourceArtUrl(resource as RasterResourceId)}
        className={`gnz-raster-resource inline-block shrink-0 ${className}`}
        width={size}
        height={size}
        draggable={false}
        decoding="async"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <GnozianGlyph
      name={FALLBACK_GLYPH[resource] ?? 'target'}
      size={size}
      className={className}
      title={title}
    />
  );
}
