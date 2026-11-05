/**
 * Fixed-size Earth map (520×240): fully deterministic terrain and resource layout
 * (no RNG / value-noise). Equirectangular lon/lat; coast = land adjacent to ocean.
 */
import type { Tile, TerrainType, ImprovementType } from './types';

export const EARTH_MAP_WIDTH = 520;
export const EARTH_MAP_HEIGHT = 240;

function wrapLonDeg(lon: number): number {
  let x = lon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

export function lonLatFromEarthTile(q: number, r: number): { lon: number; lat: number } {
  const lon = (q / (EARTH_MAP_WIDTH - 1)) * 360 - 180;
  const lat = 90 - (r / Math.max(1, EARTH_MAP_HEIGHT - 1)) * 180;
  return { lon: wrapLonDeg(lon), lat };
}

function gaussBlob(lon: number, lat: number, lon0: number, lat0: number, sx: number, sy: number, amp: number): number {
  const dl = wrapLonDeg(lon - lon0);
  const dlat = lat - lat0;
  return amp * Math.exp(-0.5 * ((dl / sx) ** 2 + (dlat / sy) ** 2));
}

/** Analytic land score — sum of continental / island kernels (no RNG). */
function continentLandScore(lon: number, lat: number): number {
  let s = 0;
  s += gaussBlob(lon, lat, -100, 45, 34, 20, 1.05);
  s += gaussBlob(lon, lat, -82, 62, 22, 16, 0.62);
  s += gaussBlob(lon, lat, -85, 12, 12, 8, 0.55);
  s += gaussBlob(lon, lat, -58, -12, 16, 28, 1.02);
  s += gaussBlob(lon, lat, 8, 52, 12, 10, 0.95);
  s += gaussBlob(lon, lat, 22, 48, 10, 9, 0.72);
  s += gaussBlob(lon, lat, 12, 64, 8, 12, 0.55);
  s += gaussBlob(lon, lat, 20, 5, 24, 32, 1.02);
  s += gaussBlob(lon, lat, 42, 26, 14, 12, 0.52);
  s += gaussBlob(lon, lat, 78, 22, 10, 16, 0.62);
  s += gaussBlob(lon, lat, 108, 32, 22, 16, 0.85);
  s += gaussBlob(lon, lat, 100, 5, 14, 10, 0.5);
  s += gaussBlob(lon, lat, 138, 38, 6, 5, 0.38);
  s += gaussBlob(lon, lat, 134, -24, 18, 12, 0.72);
  s += gaussBlob(lon, lat, -2, 54, 6, 5, 0.42);
  s += gaussBlob(lon, lat, 170, -42, 5, 6, 0.35);
  s += gaussBlob(lon, lat, 47, -20, 5, 10, 0.35);
  s += gaussBlob(lon, lat, 118, -2, 20, 8, 0.45);
  s += gaussBlob(lon, lat, -42, 72, 12, 18, 0.52);
  s += gaussBlob(lon, lat, -4, 40, 6, 7, 0.48);
  s += gaussBlob(lon, lat, 128, 50, 28, 12, 0.55);
  return s;
}

function syntheticElevation(lon: number, lat: number): number {
  let e = 0.4;
  e += gaussBlob(lon, lat, -72, -12, 3.5, 28, 0.44);
  e += gaussBlob(lon, lat, -108, 42, 8, 22, 0.34);
  e += gaussBlob(lon, lat, 10, 46, 4, 4, 0.24);
  e += gaussBlob(lon, lat, 85, 32, 10, 8, 0.38);
  e += gaussBlob(lon, lat, 88, 28, 6, 6, 0.24);
  e += gaussBlob(lon, lat, -5, 32, 5, 5, 0.14);
  e += gaussBlob(lon, lat, 60, 55, 4, 25, 0.16);
  e += gaussBlob(lon, lat, 29, -30, 4, 10, 0.11);
  return Math.min(1, e);
}

function syntheticMoisture(lon: number, lat: number): number {
  const eq = 1 - Math.abs(lat) / 90;
  let m = 0.34 + 0.46 * eq + 0.11 * Math.sin((lon * Math.PI) / 45);
  m += 0.11 * gaussBlob(lon, lat, -60, 0, 20, 25, 1);
  m += 0.09 * gaussBlob(lon, lat, 110, 10, 25, 15, 1);
  return Math.max(0, Math.min(1, m));
}

function latitude01(r: number): number {
  return Math.abs((r / EARTH_MAP_HEIGHT) - 0.5) * 2;
}

function classifyInland(lat01: number, elev: number, moist: number): TerrainType {
  if (elev > 0.9) return 'mountains';
  if (elev > 0.76) return 'hills';
  if (lat01 > 0.82) return 'snow';
  if (lat01 > 0.66) return 'tundra';
  if (lat01 < 0.28) {
    if (moist > 0.55) return 'jungle';
    if (moist > 0.35) return 'grassland';
    return 'desert';
  }
  if (moist > 0.6) return 'forest';
  if (moist > 0.4) return 'grassland';
  if (moist > 0.22) return 'plains';
  return 'desert';
}

function inRect(lon: number, lat: number, w: number, n: number, e: number, s: number): boolean {
  return lon >= w && lon <= e && lat >= n && lat <= s;
}

/** Deterministic resource from geographic zones (first match wins). */
function pickEarthResource(q: number, r: number, terrain: TerrainType, lon: number, lat: number): string | null {
  if (terrain === 'ocean' || terrain === 'mountains' || terrain === 'snow') return null;
  if (terrain === 'coast') return (q + r) % 5 === 0 ? 'fish' : null;

  const step = (a: number, m: number) => (q * 31 + r * 17 + a) % m === 0;

  // --- Strategic (historically major belts / basins) ---
  if (inRect(lon, lat, 46, 23, 54, 32) && (terrain === 'desert' || terrain === 'plains') && step(2, 7)) return 'oil';
  if (inRect(lon, lat, -102, 26, -92, 34) && (terrain === 'desert' || terrain === 'plains') && step(3, 8)) return 'oil';
  if (inRect(lon, lat, -100, 48, -82, 62) && (terrain === 'forest' || terrain === 'hills' || terrain === 'plains') && step(1, 9)) return 'coal';
  if (inRect(lon, lat, 5, 48, 16, 55) && (terrain === 'hills' || terrain === 'forest') && step(4, 8)) return 'coal';
  if (inRect(lon, lat, 108, 38, 122, 48) && (terrain === 'hills' || terrain === 'forest' || terrain === 'plains') && step(0, 9)) return 'coal';
  if (inRect(lon, lat, 48, 48, 62, 58) && (terrain === 'hills' || terrain === 'plains') && step(5, 8)) return 'iron';
  if (inRect(lon, lat, -118, 42, -102, 52) && (terrain === 'hills' || terrain === 'plains') && step(6, 9)) return 'iron';
  if (inRect(lon, lat, 115, -28, 128, -18) && (terrain === 'hills' || terrain === 'desert' || terrain === 'plains') && step(7, 10)) return 'iron';
  if (inRect(lon, lat, 44, 48, 58, 58) && (terrain === 'tundra' || terrain === 'hills' || terrain === 'plains') && step(2, 11)) return 'uranium';
  if (inRect(lon, lat, 110, -32, 128, -18) && (terrain === 'desert' || terrain === 'hills') && step(8, 12)) return 'uranium';
  if (inRect(lon, lat, 95, 42, 118, 52) && (terrain === 'plains' || terrain === 'grassland') && step(3, 8)) return 'horse';
  if (inRect(lon, lat, -108, 35, -92, 48) && (terrain === 'plains' || terrain === 'grassland') && step(9, 8)) return 'horse';
  if (inRect(lon, lat, 44, 50, 58, 62) && terrain === 'plains' && step(1, 10)) return 'horse';

  // --- Luxury / bonus (broad cultural-geography regions) ---
  if (inRect(lon, lat, -6, 48, 10, 56) && (terrain === 'grassland' || terrain === 'plains') && step(0, 11)) return 'wine';
  if (inRect(lon, lat, -6, 48, 10, 56) && step(4, 13)) return 'gems';
  if (inRect(lon, lat, 72, 8, 88, 22) && (terrain === 'grassland' || terrain === 'plains') && step(5, 10)) return 'spices';
  if (inRect(lon, lat, 72, 8, 88, 22) && terrain === 'jungle' && step(2, 9)) return 'spices';
  if (inRect(lon, lat, -78, -18, -58, 2) && (terrain === 'jungle' || terrain === 'hills') && step(6, 10)) return 'gems';
  if (inRect(lon, lat, 12, 48, 24, 56) && (terrain === 'forest' || terrain === 'hills') && step(7, 11)) return 'silver';
  if (inRect(lon, lat, 12, 48, 24, 56) && terrain === 'hills' && step(3, 12)) return 'gold_ore';
  if (inRect(lon, lat, -86, 38, -72, 48) && (terrain === 'forest' || terrain === 'hills') && step(8, 10)) return 'deer';
  if (inRect(lon, lat, 98, 22, 112, 36) && (terrain === 'forest' || terrain === 'hills') && step(1, 11)) return 'deer';
  if (inRect(lon, lat, -8, 34, 4, 42) && (terrain === 'plains' || terrain === 'grassland') && step(9, 12)) return 'wheat';
  if (inRect(lon, lat, 32, 44, 48, 54) && (terrain === 'plains' || terrain === 'grassland') && step(4, 11)) return 'wheat';
  if (inRect(lon, lat, 108, 32, 122, 42) && (terrain === 'plains' || terrain === 'grassland') && step(2, 12)) return 'rice';
  if (inRect(lon, lat, -104, 32, -88, 44) && (terrain === 'plains' || terrain === 'grassland') && step(5, 10)) return 'cattle';
  if (inRect(lon, lat, 8, 52, 22, 60) && (terrain === 'grassland' || terrain === 'plains') && step(6, 11)) return 'sheep';
  if (inRect(lon, lat, 138, 32, 146, 40) && (terrain === 'hills' || terrain === 'forest') && step(0, 12)) return 'horse';

  return null;
}

export function generateEarthMapFixed(): Tile[][] {
  const w = EARTH_MAP_WIDTH;
  const h = EARTH_MAP_HEIGHT;
  const water: boolean[][] = [];
  for (let r = 0; r < h; r++) {
    water[r] = [];
    for (let q = 0; q < w; q++) {
      const { lon, lat } = lonLatFromEarthTile(q, r);
      const polar = Math.abs(lat) > 79;
      const sc = continentLandScore(lon, lat);
      water[r][q] = polar || sc < 0.38;
    }
  }

  const touchesOcean = (q: number, r: number): boolean => {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;
    for (const [dq, dr] of dirs) {
      const nq = q + dq;
      const nr = r + dr;
      if (nq < 0 || nq >= w || nr < 0 || nr >= h) return true;
      if (water[nr][nq]) return true;
    }
    return false;
  };

  const tiles: Tile[][] = [];
  for (let r = 0; r < h; r++) {
    tiles[r] = [];
    const lat01 = latitude01(r);
    for (let q = 0; q < w; q++) {
      const { lon, lat } = lonLatFromEarthTile(q, r);
      let terrain: TerrainType;
      if (water[r][q]) {
        terrain = 'ocean';
      } else if (touchesOcean(q, r)) {
        terrain = 'coast';
      } else {
        const elev = syntheticElevation(lon, lat);
        const moist = syntheticMoisture(lon, lat);
        terrain = classifyInland(lat01, elev, moist);
      }
      const resource = pickEarthResource(q, r, terrain, lon, lat);
      tiles[r][q] = {
        q,
        r,
        terrain,
        improvement: 'none' as ImprovementType,
        resource,
        owner: null,
        city: null,
        territoryCityId: null,
        unit: null,
        river: false,
        road: false,
        revealed: [],
        visible: [],
      };
    }
  }
  return tiles;
}
