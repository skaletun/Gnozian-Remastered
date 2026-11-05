import type { GameState } from './types';
import { t } from '../i18n';

export type ProgressionFeature =
  | 'trade_routes'
  | 'diplomatic_deals'
  | 'advanced_diplomacy'
  | 'alliances'
  | 'espionage';

export function civHasTech(state: GameState, civIndex: number, techId: string): boolean {
  return !!state.civilizations[civIndex]?.researchedTechs?.includes(techId);
}

export function civHasCivic(state: GameState, civIndex: number, civicId: string): boolean {
  return !!state.civilizations[civIndex]?.researchedCivics?.includes(civicId);
}

export function isProgressionFeatureUnlocked(
  state: GameState,
  civIndex: number,
  feature: ProgressionFeature
): boolean {
  switch (feature) {
    case 'trade_routes':
      return civHasTech(state, civIndex, 'currency');
    case 'diplomatic_deals':
      return civHasTech(state, civIndex, 'currency') && civHasCivic(state, civIndex, 'political_philosophy');
    case 'advanced_diplomacy':
      return civHasCivic(state, civIndex, 'political_philosophy');
    case 'alliances':
      return civHasCivic(state, civIndex, 'civil_service');
    case 'espionage':
      return civHasTech(state, civIndex, 'printing_press') || civHasTech(state, civIndex, 'banking');
  }
}

export function bothCivsUnlocked(
  state: GameState,
  civA: number,
  civB: number,
  feature: ProgressionFeature
): boolean {
  return isProgressionFeatureUnlocked(state, civA, feature) && isProgressionFeatureUnlocked(state, civB, feature);
}

export function progressionLockReason(feature: ProgressionFeature): string {
  switch (feature) {
    case 'trade_routes':
      return t('progression.lock.trade_routes');
    case 'diplomatic_deals':
      return t('progression.lock.diplomatic_deals');
    case 'advanced_diplomacy':
      return t('progression.lock.advanced_diplomacy');
    case 'alliances':
      return t('progression.lock.alliances');
    case 'espionage':
      return t('progression.lock.espionage');
  }
}
