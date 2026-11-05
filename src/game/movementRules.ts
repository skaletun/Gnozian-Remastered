import type { GameState, TerrainType, Unit, UnitType } from './types';
import { isOpenOceanUnlocked, isRiverNavigationUnlocked } from './systems/geographyCore';

const SAILING_TECH_ID = 'sailing' as const;

function civHasSailingTechnology(
  state: Pick<GameState, 'civilizations'>,
  civIndex: number
): boolean {
  return !!state.civilizations[civIndex]?.researchedTechs?.includes(SAILING_TECH_ID);
}

function applyRiverMovementDiscount(
  state: Pick<GameState, 'systems' | 'civilizations' | 'age' | 'tiles'>,
  civIndex: number,
  base: number,
  ctx?: { fromQ?: number; fromR?: number; toQ?: number; toR?: number }
): number {
  if (
    !isRiverNavigationUnlocked(state, civIndex) ||
    ctx?.fromQ == null ||
    ctx.fromR == null ||
    ctx.toQ == null ||
    ctx.toR == null
  ) {
    return base;
  }
  const fromTile = state.tiles[ctx.fromR]?.[ctx.fromQ];
  const toTile = state.tiles[ctx.toR]?.[ctx.toQ];
  if (fromTile?.river && toTile?.river && toTile.terrain !== 'coast' && toTile.terrain !== 'ocean') {
    return Math.max(1, base - 1);
  }
  return base;
}

function fliesOverDeepWater(unitType: UnitType): boolean {
  return unitType === 'fighter' || unitType === 'bomber' || unitType === 'nuclear_missile';
}

/** Movement points to enter a tile (destination terrain). `null` = impassable. */
export function tileMovementEnterCost(
  terrain: TerrainType,
  unitType: UnitType,
  ctx?: {
    state?: Pick<GameState, 'age' | 'systems' | 'civilizations' | 'tiles'>;
    civIndex?: number;
    fromQ?: number;
    fromR?: number;
    toQ?: number;
    toR?: number;
  }
): number | null {
  if (terrain === 'mountains') return null;

  const civIndex = ctx?.civIndex ?? -1;
  const state = ctx?.state;

  if (terrain === 'ocean') {
    if (fliesOverDeepWater(unitType)) return 1;
    if (!state || civIndex < 0 || !civHasSailingTechnology(state, civIndex)) return null;
    if (!isOpenOceanUnlocked(state, civIndex)) return null;
    return 2;
  }

  if (terrain === 'coast') {
    if (fliesOverDeepWater(unitType)) return 1;
    if (!state || civIndex < 0 || !civHasSailingTechnology(state, civIndex)) return null;
    let base = 1;
    base = applyRiverMovementDiscount(state, civIndex, base, ctx);
    return base;
  }

  let base: number;
  switch (terrain) {
    case 'forest':
    case 'jungle':
    case 'hills':
      base = 2;
      break;
    default:
      base = 1;
      break;
  }

  if (state && civIndex >= 0) {
    base = applyRiverMovementDiscount(state, civIndex, base, ctx);
  }

  return base;
}

/**
 * Max hex distance for a ranged attack this turn.
 * Scales linearly from full `range` at full movement down to 1 at 0 MP (nukes ignore fatigue).
 */
export function effectiveRangedAttackRange(unit: Pick<Unit, 'range' | 'movement' | 'maxMovement' | 'type'>): number {
  if (unit.type === 'nuclear_missile') return Math.max(0, unit.range);
  const R = unit.range;
  if (R <= 0) return 0;
  const maxM = Math.max(1, unit.maxMovement);
  const m = Math.max(0, Math.min(maxM, unit.movement));
  return Math.max(1, Math.min(R, Math.round(1 + ((R - 1) * m) / maxM)));
}

/** Whether `hexDist` (grid distance) is a legal attack this turn. */
export function canAttackAtHexDistance(
  unit: Pick<Unit, 'range' | 'movement' | 'maxMovement' | 'type' | 'rangedStrength'>,
  hexDist: number,
  target: 'unit' | 'city'
): boolean {
  if (hexDist < 0) return false;
  if (unit.rangedStrength > 0) {
    const maxR = effectiveRangedAttackRange(unit);
    if (target === 'city' && hexDist === 0) return true;
    return hexDist >= 1 && hexDist <= maxR;
  }
  if (target === 'city') return hexDist <= 1;
  return hexDist === 1;
}
