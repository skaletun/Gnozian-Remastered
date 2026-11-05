import type { AgeState, City, Civilization, GameState } from '../types';
import { normalizeCivilizationIdentity, normalizeLeaderProfiles } from '../systems/leaderCore';
import { normalizeCityGrowthState } from '../systems/growthEventsCore';
import { normalizeInfluenceDiplomacy } from '../systems/influenceDiplomacyCore';
import { normalizeIndependentPowersState } from '../systems/independentPowersCore';
import { normalizeCommanderState } from '../systems/commandersCore';
import { normalizeGeographyProgress } from '../systems/geographyCore';
import { normalizeLegacyCrisis } from '../systems/legacyCrisisCore';

export const STATE_CONTRACT_VERSION = 7;

function normalizeCivilization(civ: Civilization): Civilization {
  return {
    ...civ,
    researchedCivics: Array.isArray(civ.researchedCivics) ? civ.researchedCivics : ['code_of_laws'],
    currentCivic: typeof civ.currentCivic === 'string' ? civ.currentCivic : null,
    civicProgress: typeof civ.civicProgress === 'number' ? civ.civicProgress : 0,
  };
}

function defaultAgeState(numCivs: number): AgeState {
  return {
    currentAge: 'antiquity',
    phase: 'ongoing',
    turnsInAge: 0,
    threshold: 220,
    pointsByCiv: Array.from({ length: Math.max(1, numCivs) }, () => 0),
    pendingTransitionTurn: null,
    triggerCivIndex: null,
    modernLegacyUnlocked: false,
    history: [],
  };
}

function normalizeAgeState(state: GameState): AgeState {
  const fallback = defaultAgeState(state.civilizations.length);
  const age = state.age;
  if (!age) return fallback;
  const points = Array.isArray(age.pointsByCiv)
    ? Array.from({ length: Math.max(1, state.civilizations.length) }, (_, i) =>
        Math.max(0, Number(age.pointsByCiv[i] ?? 0))
      )
    : fallback.pointsByCiv;
  return {
    currentAge:
      age.currentAge === 'antiquity' || age.currentAge === 'exploration' || age.currentAge === 'modern'
        ? age.currentAge
        : fallback.currentAge,
    phase: age.phase === 'transition' ? 'transition' : 'ongoing',
    turnsInAge: Math.max(0, Math.floor(Number(age.turnsInAge ?? 0))),
    threshold: Math.max(120, Math.floor(Number(age.threshold ?? fallback.threshold))),
    pointsByCiv: points,
    pendingTransitionTurn:
      age.pendingTransitionTurn == null ? null : Math.max(0, Math.floor(Number(age.pendingTransitionTurn))),
    triggerCivIndex:
      age.triggerCivIndex == null
        ? null
        : Math.max(0, Math.min(state.civilizations.length - 1, Math.floor(Number(age.triggerCivIndex)))),
    modernLegacyUnlocked: !!age.modernLegacyUnlocked,
    history: Array.isArray(age.history)
      ? age.history
          .filter(
            h =>
              h &&
              (h.fromAge === 'antiquity' || h.fromAge === 'exploration' || h.fromAge === 'modern') &&
              (h.toAge === 'antiquity' || h.toAge === 'exploration' || h.toAge === 'modern')
          )
          .map(h => ({
            fromAge: h.fromAge,
            toAge: h.toAge,
            turn: Math.max(0, Math.floor(Number(h.turn ?? 0))),
            triggerCivIndex: Math.max(0, Math.floor(Number(h.triggerCivIndex ?? 0))),
          }))
      : [],
  };
}

function normalizeCity(city: City): City {
  return normalizeCityGrowthState(city);
}

export function normalizeStateContract(state: GameState): GameState {
  const independent = normalizeIndependentPowersState(state);
  const commanders = normalizeCommanderState(state);
  const geography = normalizeGeographyProgress(state);
  const legacyCrisis = normalizeLegacyCrisis(state);
  return {
    ...state,
    age: normalizeAgeState(state),
    leaders: normalizeLeaderProfiles(state),
    civilizationIdentity: normalizeCivilizationIdentity(state),
    cities: state.cities.map(normalizeCity),
    civilizations: state.civilizations.map(normalizeCivilization),
    tradeRoutes: Array.isArray(state.tradeRoutes) ? state.tradeRoutes : [],
    tradeAgreements: Array.isArray(state.tradeAgreements) ? state.tradeAgreements : [],
    nextTradeAgreementId: typeof state.nextTradeAgreementId === 'number' ? state.nextTradeAgreementId : 1,
    nextTradeRouteId: typeof state.nextTradeRouteId === 'number' ? state.nextTradeRouteId : 1,
    diplomaticOffers: Array.isArray(state.diplomaticOffers) ? state.diplomaticOffers : [],
    nextDiplomaticOfferId: typeof state.nextDiplomaticOfferId === 'number' ? state.nextDiplomaticOfferId : 1,
    systems: {
      ...state.systems,
      influenceDiplomacy: normalizeInfluenceDiplomacy(state),
      independentPowers: independent.independentPowers,
      nextIndependentPowerId: independent.nextIndependentPowerId,
      commanders: commanders.commanders,
      nextCommanderId: commanders.nextCommanderId,
      geographyProgress: geography,
      legacyCrisis,
      civFirstContactSeen:
        state.systems.civFirstContactSeen && typeof state.systems.civFirstContactSeen === 'object'
          ? { ...state.systems.civFirstContactSeen }
          : {},
    },
  };
}

export function validateStateContractShape(state: unknown): state is GameState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Partial<GameState>;
  return (
    Array.isArray(s.civilizations) &&
    Array.isArray(s.tiles) &&
    Array.isArray(s.cities) &&
    Array.isArray(s.units) &&
    typeof s.turn === 'number' &&
    typeof s.currentCivIndex === 'number'
  );
}

