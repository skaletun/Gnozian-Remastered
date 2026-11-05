import type { MapDetailLevel } from './settingsConstants';

/**
 * Smoothed camera zoom used only for LOD decisions — reduces pass toggling when
 * the user sits near a threshold or zoom animates smoothly.
 */
let lodZoomEma = 1;

/**
 * EMA of visible tile count (from bounds) so panning near thresholds does not pop layers.
 */
let lodTileCountEma = 1;

/** Hysteresis: once blur shadow is disabled for heavy scenes, re-enable only below this tile load. */
let islandShadowBlurAllowed = true;

export type TerrainPassLevel = 'full' | 'lite' | 'flat';
export type TerritoryPassLevel = 'full' | 'fill' | 'off';
export type IslandShadowLevel = 'blur' | 'solid' | 'off';
export type HexWallsLevel = 'full' | 'edgesOnly' | 'off';

export type MapLodSnapshot = {
  /** Raw bounds tile count this frame (before EMA), for profiling. */
  approxVisibleTiles: number;
  /** Most zoomed-out band: minimal decoration & FX. */
  strategicView: boolean;
  /** Mid–far band: skip relief / heavy plastic shading. */
  tacticalFarView: boolean;
  /** Cloud banks + island shadow underlay. */
  showCloudsShadows: boolean;
  /** Pseudo-relief / terrain shading pass. */
  showReliefShading: boolean;
  /** Full-screen disaster tint layer. */
  showDisasterScreenFx: boolean;
  /** Forest / mountain / hills / farm art (resources stay separate). */
  showEnvironmentClusters: boolean;
  /** 0..1 multiplier for particle budgets (matches previous lodExtreme / lodFar caps). */
  particleDensity: number;
  /** Base terrain fill complexity. */
  terrainPass: TerrainPassLevel;
  /** Territory tint: double fill + glow vs single fill vs skip. */
  territoryPass: TerritoryPassLevel;
  /** Island under-hex shadow: blur is expensive at large tile counts. */
  islandShadow: IslandShadowLevel;
  /** Extruded hex rim / walls pass. */
  hexWalls: HexWallsLevel;
};

function detailBias(mapDetail: MapDetailLevel | undefined): number {
  if (mapDetail === 'simple') return 0.055;
  if (mapDetail === 'rich') return -0.045;
  return 0;
}

/** Tile-load thresholds (against EMA-smoothed visible count). Tuned for 520×240 stress. */
const TILE_TERRAIN_FLAT = 8500;
const TILE_TERRAIN_LITE = 2600;
const TILE_TERRITORY_OFF = 7200;
const TILE_TERRITORY_FILL = 1300;
const TILE_HEX_WALLS_OFF = 11000;
const TILE_HEX_WALLS_EDGES = 2200;
const TILE_ISLAND_BLUR_OFF_ENTER = 480;
const TILE_ISLAND_BLUR_OFF_EXIT = 340;
const ADAPTIVE_QUALITY_LO = 0.92;

function inflateTileLoadForAdaptive(tilesEff: number, qualityScale: number): number {
  if (qualityScale >= ADAPTIVE_QUALITY_LO) return tilesEff;
  const stress = (ADAPTIVE_QUALITY_LO - qualityScale) / ADAPTIVE_QUALITY_LO;
  return Math.min(tilesEff * (1 + stress * 2.4), 200000);
}

/**
 * One call per map frame. Uses EMA-smoothed zoom and visible tile count plus `mapDetail` bias.
 * `qualityScale` should be `effectiveFrameQualityScale(graphics)` so adaptive FPS biases toward cheaper passes.
 */
export function computeMapLodSnapshot(
  zoom: number,
  mapDetail: MapDetailLevel | undefined,
  approxVisibleTiles: number,
  qualityScale: number
): MapLodSnapshot {
  const z = Math.max(0.08, Math.min(4.5, zoom)) + detailBias(mapDetail);
  lodZoomEma = lodZoomEma * 0.78 + z * 0.22;
  const zl = lodZoomEma;

  const rawTiles = Math.max(1, Math.floor(approxVisibleTiles));
  lodTileCountEma = lodTileCountEma * 0.72 + rawTiles * 0.28;
  const tilesEff = inflateTileLoadForAdaptive(lodTileCountEma, qualityScale);

  const strategicView = zl < 0.175;
  const tacticalFarView = zl < 0.325;

  const envDetailThreshold = zl < 0.318 ? 0.48 : 0.35;
  const showEnvironmentClusters = zl > envDetailThreshold;

  const particleDensity = strategicView ? 0.22 : tacticalFarView ? 0.55 : 1;

  let terrainPass: TerrainPassLevel = 'full';
  if (strategicView || tilesEff >= TILE_TERRAIN_FLAT) terrainPass = 'flat';
  else if (tacticalFarView || tilesEff >= TILE_TERRAIN_LITE) terrainPass = 'lite';

  let territoryPass: TerritoryPassLevel = 'full';
  if (strategicView || tilesEff >= TILE_TERRITORY_OFF) territoryPass = 'off';
  else if (tacticalFarView || tilesEff >= TILE_TERRITORY_FILL) territoryPass = 'fill';

  if (tilesEff >= TILE_ISLAND_BLUR_OFF_ENTER) islandShadowBlurAllowed = false;
  else if (tilesEff <= TILE_ISLAND_BLUR_OFF_EXIT) islandShadowBlurAllowed = true;

  let islandShadow: IslandShadowLevel = 'solid';
  if (strategicView) islandShadow = 'off';
  else if (islandShadowBlurAllowed && tilesEff < TILE_ISLAND_BLUR_OFF_ENTER) islandShadow = 'blur';

  let hexWalls: HexWallsLevel = 'full';
  if (tilesEff >= TILE_HEX_WALLS_OFF) hexWalls = 'off';
  else if (tacticalFarView || tilesEff >= TILE_HEX_WALLS_EDGES) hexWalls = 'edgesOnly';

  return {
    approxVisibleTiles: rawTiles,
    strategicView,
    tacticalFarView,
    showCloudsShadows: !strategicView,
    showReliefShading: !tacticalFarView,
    showDisasterScreenFx: !strategicView,
    showEnvironmentClusters,
    particleDensity,
    terrainPass,
    territoryPass,
    islandShadow,
    hexWalls,
  };
}

/** Reset EMA when switching games / viewers so LOD does not inherit stale zoom or tile load. */
export function resetMapLodSmoothing(zoom: number): void {
  lodZoomEma = Math.max(0.08, Math.min(4.5, zoom));
  lodTileCountEma = 1;
  islandShadowBlurAllowed = true;
}
