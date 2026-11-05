import type { GameState, ImprovementType } from './types';
import { NATURAL_RESOURCES, TECHNOLOGIES } from './constants';

/** Shared construction eligibility for human commands and AI planning. */
export function civHasImprovementUnlock(state: GameState, civIndex: number, imp: Exclude<ImprovementType, 'none'>): boolean {
  const civ = state.civilizations[civIndex];
  if (!civ) return false;
  for (const tid of civ.researchedTechs) {
    const u = TECHNOLOGIES[tid]?.unlocks;
    if (u?.includes(imp)) return true;
  }
  return false;
}

export function workerImprovementValidationError(
  state: GameState,
  civIndex: number,
  imp: ImprovementType,
  q: number,
  r: number
): string | null {
  if (imp === 'none') return 'invalid improvement';
  const t = state.tiles[r]?.[q];
  if (!t) return 'invalid tile';
  const res = t.resource ? NATURAL_RESOURCES[t.resource] : null;
  const strategicAutoUnlock =
    !!res && res.type === 'strategic' && !!res.improvement && res.improvement === imp;
  if (!civHasImprovementUnlock(state, civIndex, imp) && !strategicAutoUnlock) return 'missing technology';
  if (t.city != null) return 'cannot build on a city';
  if (t.owner !== civIndex) return 'tile not in your territory';
  if (t.improvement === imp) return 'already built here';

  switch (imp) {
    case 'fishing_boats':
      if (t.terrain !== 'ocean' && t.terrain !== 'coast') return 'needs coast or ocean';
      if (t.resource !== 'fish') return 'needs fish resource';
      break;
    case 'farm':
      if (t.terrain === 'ocean' || t.terrain === 'mountains') return 'bad terrain';
      if (res && res.improvement !== 'farm') return 'wrong resource for farm';
      break;
    case 'mine':
      if (t.terrain === 'ocean') return 'bad terrain';
      if (res) {
        if (res.improvement !== 'mine') return 'wrong resource for mine';
      } else if (t.terrain !== 'hills' && t.terrain !== 'mountains') {
        return 'mine needs hills or a mineral resource';
      }
      break;
    case 'pasture':
      if (t.terrain === 'ocean' || t.terrain === 'mountains') return 'bad terrain';
      if (!res || res.improvement !== 'pasture') return 'needs pasture livestock or horses';
      break;
    case 'lumber_mill':
      if (res && res.improvement === 'lumber_mill') break;
      if (t.terrain !== 'forest' && t.terrain !== 'jungle') return 'needs forest or jungle';
      break;
    case 'trading_post':
      if (t.terrain === 'ocean' || t.terrain === 'mountains') return 'bad terrain';
      if (res) {
        if (res.improvement !== 'trading_post') return 'wrong resource for trading post';
      } else if (t.terrain !== 'desert' && t.terrain !== 'tundra' && t.terrain !== 'snow') {
        return 'trading post needs desert, tundra, snow, or a trade resource';
      }
      break;
    default:
      return 'unknown improvement';
  }
  return null;
}

export const WORKER_IMPROVEMENTS: Exclude<ImprovementType, 'none'>[] = [
  'farm',
  'mine',
  'pasture',
  'lumber_mill',
  'fishing_boats',
  'trading_post',
];

/** Legal choices at any map tile, independently of worker movement points. */
export function listLegalWorkerImprovementsAt(
  state: GameState,
  civIndex: number,
  q: number,
  r: number
): ImprovementType[] {
  return WORKER_IMPROVEMENTS.filter(
    improvement => workerImprovementValidationError(state, civIndex, improvement, q, r) === null
  );
}
