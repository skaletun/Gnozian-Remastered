export interface MapSizeChoice {
  w: number;
  h: number;
}

/** Present four common world sizes on a landscape phone, but never remove
 * access to any original map-size option. Selected exotic sizes are promoted
 * into the quick row so the active choice is always visible. */
export function splitMobileMapSizes<T extends MapSizeChoice>(
  presets: ReadonlyArray<T>,
  selectedWidth: number,
  selectedHeight: number,
): { featured: T[]; additional: T[] } {
  const featuredIndexes = new Set([0, 1, 3, 5]);
  const featured: T[] = [];
  const additional: T[] = [];
  presets.forEach((p, index) => {
    if (featuredIndexes.has(index) || (p.w === selectedWidth && p.h === selectedHeight)) {
      featured.push(p);
    } else {
      additional.push(p);
    }
  });
  return { featured, additional };
}
