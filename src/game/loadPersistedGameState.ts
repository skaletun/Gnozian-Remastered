import { CIV_TEMPLATES } from './constants';
import {
  DEFAULT_WORLD,
  migrateLoadedTradeRoutes,
  recomputeTileTerritory,
} from './facade/gameFacade';
import { createDefaultSystems } from './featureSystems';
import { INITIAL_VIEWPORT } from './hexMetrics';
import { normalizeStateContract } from './kernel/stateContract';
import type { DiplomaticRelation, GameSettings, GameState, GameSystems, TradeRoute } from './types';
import { createSaveData, saveManager, type SaveData } from './saveManager';

/** Legacy flat JSON key (pre–slot manager); read-only migration source. */
export const LEGACY_FLAT_SAVE_KEY = 'gnozian_save_v1';

export function mergeLoadedSystems(partial: unknown): GameSystems {
  const d = createDefaultSystems();
  if (!partial || typeof partial !== 'object') return d;
  const p = partial as Partial<GameSystems>;
  const spies = (p.spies ?? d.spies).map(sp => ({
    ...sp,
    discovered: sp.discovered ?? false,
  }));
  return {
    ...d,
    ...p,
    wonderOwners: { ...d.wonderOwners, ...(p.wonderOwners ?? {}) },
    religions: (p.religions ?? d.religions).map(r => ({
      ...r,
      beliefs: r.beliefs ?? ['faith_from_holy_site'],
    })),
    cityFaithPressure: p.cityFaithPressure ?? d.cityFaithPressure,
    tourismTotal: p.tourismTotal ?? d.tourismTotal,
    influence: p.influence ?? d.influence,
    influenceDiplomacy:
      p.influenceDiplomacy && typeof p.influenceDiplomacy === 'object'
        ? {
            balances:
              p.influenceDiplomacy.balances && typeof p.influenceDiplomacy.balances === 'object'
                ? p.influenceDiplomacy.balances
                : d.influenceDiplomacy.balances,
            actionLog: Array.isArray(p.influenceDiplomacy.actionLog)
              ? p.influenceDiplomacy.actionLog
              : d.influenceDiplomacy.actionLog,
            treaties: Array.isArray(p.influenceDiplomacy.treaties)
              ? p.influenceDiplomacy.treaties
              : d.influenceDiplomacy.treaties,
            sanctions: Array.isArray(p.influenceDiplomacy.sanctions)
              ? p.influenceDiplomacy.sanctions
              : d.influenceDiplomacy.sanctions,
            endeavors: Array.isArray(p.influenceDiplomacy.endeavors)
              ? p.influenceDiplomacy.endeavors
              : d.influenceDiplomacy.endeavors,
          }
        : d.influenceDiplomacy,
    independentPowers: Array.isArray(p.independentPowers) ? p.independentPowers : d.independentPowers,
    nextIndependentPowerId:
      typeof p.nextIndependentPowerId === 'number' ? p.nextIndependentPowerId : d.nextIndependentPowerId,
    commanders: Array.isArray(p.commanders) ? p.commanders : d.commanders,
    nextCommanderId: typeof p.nextCommanderId === 'number' ? p.nextCommanderId : d.nextCommanderId,
    geographyProgress:
      p.geographyProgress && typeof p.geographyProgress === 'object'
        ? {
            homeHemisphereByCiv:
              p.geographyProgress.homeHemisphereByCiv && typeof p.geographyProgress.homeHemisphereByCiv === 'object'
                ? p.geographyProgress.homeHemisphereByCiv
                : d.geographyProgress?.homeHemisphereByCiv ?? {},
            distantLandsDiscoveredByCiv:
              p.geographyProgress.distantLandsDiscoveredByCiv &&
              typeof p.geographyProgress.distantLandsDiscoveredByCiv === 'object'
                ? p.geographyProgress.distantLandsDiscoveredByCiv
                : d.geographyProgress?.distantLandsDiscoveredByCiv ?? {},
            distantLandsTotalByCiv:
              p.geographyProgress.distantLandsTotalByCiv &&
              typeof p.geographyProgress.distantLandsTotalByCiv === 'object'
                ? p.geographyProgress.distantLandsTotalByCiv
                : d.geographyProgress?.distantLandsTotalByCiv ?? {},
            oceanUnlockedByCiv:
              p.geographyProgress.oceanUnlockedByCiv && typeof p.geographyProgress.oceanUnlockedByCiv === 'object'
                ? p.geographyProgress.oceanUnlockedByCiv
                : d.geographyProgress?.oceanUnlockedByCiv ?? {},
            riverNavigationUnlockedByCiv:
              p.geographyProgress.riverNavigationUnlockedByCiv &&
              typeof p.geographyProgress.riverNavigationUnlockedByCiv === 'object'
                ? p.geographyProgress.riverNavigationUnlockedByCiv
                : d.geographyProgress?.riverNavigationUnlockedByCiv ?? {},
          }
        : d.geographyProgress,
    legacyCrisis:
      p.legacyCrisis && typeof p.legacyCrisis === 'object'
        ? {
            pointsByCiv:
              p.legacyCrisis.pointsByCiv && typeof p.legacyCrisis.pointsByCiv === 'object'
                ? p.legacyCrisis.pointsByCiv
                : d.legacyCrisis?.pointsByCiv ?? {},
            pendingLegacyChoices: Array.isArray(p.legacyCrisis.pendingLegacyChoices)
              ? p.legacyCrisis.pendingLegacyChoices
              : d.legacyCrisis?.pendingLegacyChoices ?? [],
            history: Array.isArray(p.legacyCrisis.history) ? p.legacyCrisis.history : d.legacyCrisis?.history ?? [],
            activeYieldModifiersByCiv:
              p.legacyCrisis.activeYieldModifiersByCiv &&
              typeof p.legacyCrisis.activeYieldModifiersByCiv === 'object'
                ? p.legacyCrisis.activeYieldModifiersByCiv
                : d.legacyCrisis?.activeYieldModifiersByCiv ?? {},
            crisisActive: !!p.legacyCrisis.crisisActive,
            crisisAge:
              p.legacyCrisis.crisisAge === 'antiquity' ||
              p.legacyCrisis.crisisAge === 'exploration' ||
              p.legacyCrisis.crisisAge === 'modern'
                ? p.legacyCrisis.crisisAge
                : null,
            crisisTurnsLeft: Math.max(0, Number(p.legacyCrisis.crisisTurnsLeft ?? 0)),
            crisisSeverity: Math.max(0, Number(p.legacyCrisis.crisisSeverity ?? 0)),
            selectedPolicyByCiv:
              p.legacyCrisis.selectedPolicyByCiv && typeof p.legacyCrisis.selectedPolicyByCiv === 'object'
                ? p.legacyCrisis.selectedPolicyByCiv
                : d.legacyCrisis?.selectedPolicyByCiv ?? {},
          }
        : d.legacyCrisis,
    touristVisiting: p.touristVisiting ?? d.touristVisiting,
    touristDomestic: p.touristDomestic ?? d.touristDomestic,
    spies,
    disasters: p.disasters ?? d.disasters,
    greatPeopleMeter: p.greatPeopleMeter ?? d.greatPeopleMeter,
    greatPersonProgress: p.greatPersonProgress ?? d.greatPersonProgress,
    greatPersonClaimed: p.greatPersonClaimed ?? d.greatPersonClaimed,
    greatWorks: p.greatWorks ?? d.greatWorks,
    nextGreatWorkId: p.nextGreatWorkId ?? d.nextGreatWorkId,
    worldVotes: p.worldVotes ?? d.worldVotes,
    spaceRace: p.spaceRace ?? d.spaceRace,
    nextSpyId: p.nextSpyId ?? d.nextSpyId,
    nextDisasterId: p.nextDisasterId ?? d.nextDisasterId,
  };
}

/**
 * Hydrate raw parsed game state (from SaveData.gameState or legacy flat JSON) into a playable GameState.
 */
export function hydratePersistedGameState(parsed: GameState): GameState | null {
  try {
    const validMapTypes = new Set([
      'pangaea', 'continents', 'archipelago', 'highlands', 'great_lakes', 'inland_sea',
      'wetlands', 'drylands', 'shattered', 'ring_sea', 'earth', 'random',
    ]);
    const s = parsed.settings;
    const mapType =
      s && validMapTypes.has(s.mapType as string) ? s.mapType : 'continents';
    const maxCivIdx = Math.max(0, CIV_TEMPLATES.length - 1);
    const humanCivIndex =
      s && typeof s.humanCivIndex === 'number'
        ? Math.max(0, Math.min(maxCivIdx, Math.floor(s.humanCivIndex)))
        : 0;
    const humanNickname =
      s && typeof s.humanNickname === 'string' ? s.humanNickname.slice(0, 48) : '';

    const nCivs = parsed.civilizations?.length ?? 0;
    const migratedStats = (() => {
      const raw = parsed.achievementStats;
      if (!Array.isArray(raw) || nCivs <= 0) {
        return Array.from({ length: Math.max(1, nCivs) }, () => ({ combatWins: 0, enemyCitiesCaptured: 0 }));
      }
      return Array.from({ length: nCivs }, (_, i) => ({
        combatWins: raw[i]?.combatWins ?? 0,
        enemyCitiesCaptured: raw[i]?.enemyCitiesCaptured ?? 0,
      }));
    })();

    const hasSavedTradeRoutes = Array.isArray(
      (parsed as { tradeRoutes?: TradeRoute[] | undefined }).tradeRoutes
    );

    const rawCam = (parsed.camera as {
      x?: number; y?: number; zoom?: number; rotation?: number;
      yaw?: number; pitch?: number; distance?: number;
    } | undefined) ?? {};
    const legacyTopLeftCamera = rawCam.distance == null && rawCam.yaw == null && rawCam.pitch == null;
    const migratedCamera = {
      x: (Number(rawCam.x ?? 0) || 0) + (legacyTopLeftCamera ? INITIAL_VIEWPORT.w / 2 : 0),
      y: (Number(rawCam.y ?? 0) || 0) + (legacyTopLeftCamera ? INITIAL_VIEWPORT.h / 2 : 0),
      zoom: Number(rawCam.zoom ?? 1) || 1,
      rotation: Number(rawCam.rotation ?? rawCam.yaw ?? 0) || 0,
    };
    const out = {
      ...parsed,
      ...(s
        ? { settings: { ...s, mapType, humanCivIndex, humanNickname } }
        : {}),
      achievementStats: migratedStats,
      systems: mergeLoadedSystems(parsed.systems),
      camera: migratedCamera,
      world: parsed.world ?? DEFAULT_WORLD,
      stackUnitsToMove: typeof parsed.stackUnitsToMove === 'number' ? parsed.stackUnitsToMove : 9999,
      relations: ((parsed.relations ?? []) as DiplomaticRelation[]).map(r => ({
        ...r,
        peaceLockedUntilTurn: r.peaceLockedUntilTurn ?? 0,
        armisticeUntilTurn: r.armisticeUntilTurn ?? 0,
        trust: r.trust ?? 0,
        grievances: r.grievances ?? 0,
      })),
      cities: parsed.cities.map(c => ({
        ...c,
        majorityReligionIndex: c.majorityReligionIndex ?? null,
        housing: c.housing ?? 5,
        amenities: c.amenities ?? 2,
        loyalty: c.loyalty ?? 100,
        greatWorkIds: c.greatWorkIds ?? [],
      })),
      civilizations: parsed.civilizations.map(c => ({
        ...c,
        lastTurnIncome: c.lastTurnIncome ?? {
          food: 0, production: 0, gold: 0, science: 0, culture: 0, faith: 0, happiness: 0,
        },
        faithPool: c.faithPool ?? 0,
        tourism: c.tourism ?? 0,
        religionIndex: c.religionIndex ?? null,
        lifetimeCulture: c.lifetimeCulture ?? 0,
        diplomaticVictoryPoints: c.diplomaticVictoryPoints ?? 0,
        diplomaticFavor: c.diplomaticFavor ?? 0,
        consecutivePeaceTurns: c.consecutivePeaceTurns ?? 0,
        greatPeopleEarned: c.greatPeopleEarned ?? 0,
        patronagePoints: c.patronagePoints ?? 0,
        governmentId: c.governmentId ?? 'chiefdom',
        slottedPolicyIds: c.slottedPolicyIds ?? [],
        aiPersonality: c.aiPersonality ?? 'BUILDER',
        researchedCivics: c.researchedCivics ?? ['code_of_laws'],
        currentCivic: c.currentCivic ?? null,
        civicProgress: c.civicProgress ?? 0,
      })),
      ...(hasSavedTradeRoutes
        ? {
            tradeRoutes: (parsed as { tradeRoutes: TradeRoute[] }).tradeRoutes,
            nextTradeRouteId:
              typeof (parsed as { nextTradeRouteId?: number }).nextTradeRouteId === 'number'
                ? (parsed as { nextTradeRouteId: number }).nextTradeRouteId
                : 1,
            tradeAgreements: Array.isArray((parsed as { tradeAgreements?: unknown }).tradeAgreements)
              ? ((parsed as { tradeAgreements: GameState['tradeAgreements'] }).tradeAgreements ?? [])
              : [],
            nextTradeAgreementId:
              typeof (parsed as { nextTradeAgreementId?: number }).nextTradeAgreementId === 'number'
                ? (parsed as { nextTradeAgreementId: number }).nextTradeAgreementId
                : 1,
          }
        : {}),
    } as GameState;
    let migrated = normalizeStateContract(migrateLoadedTradeRoutes(out));
    recomputeTileTerritory(migrated);
    const settingsRest = { ...migrated.settings } as GameSettings & { mpHumanSlots?: unknown };
    delete settingsRest.mpHumanSlots;
    const { mpSubturnPass: _stripSubturn, ...migratedBase } = migrated as GameState & { mpSubturnPass?: boolean[] };
    migrated = {
      ...migratedBase,
      settings: settingsRest,
      civilizations: migrated.civilizations.map((c, i) => ({
        ...c,
        isHuman: i === 0,
      })),
    };
    return migrated;
  } catch {
    return null;
  }
}

export function hydrateGameStateFromJson(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as GameState;
    return hydratePersistedGameState(parsed);
  } catch {
    return null;
  }
}

export function hydrateFromSaveData(save: SaveData): GameState | null {
  return hydratePersistedGameState(save.gameState);
}

export type LatestPersistedGame = {
  state: GameState;
  playTimeAtSave: number;
  /** Slot used for subsequent autosaves (0 when only legacy flat was read). */
  persistSlot: number;
};

/** Latest slot save by timestamp, else slot 0, else legacy flat JSON. */
export function loadLatestPersistedGameState(): LatestPersistedGame | null {
  const resolved = saveManager.resolveLatestSave();
  if (resolved) {
    const st = hydrateFromSaveData(resolved.save);
    if (st) {
      return {
        state: st,
        playTimeAtSave: resolved.save.metadata.playTime,
        persistSlot: resolved.slot,
      };
    }
  }
  const s0 = saveManager.loadGame(0);
  if (s0) {
    const st = hydrateFromSaveData(s0);
    if (st) return { state: st, playTimeAtSave: s0.metadata.playTime, persistSlot: 0 };
  }
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_FLAT_SAVE_KEY) : null;
  if (raw) {
    const st = hydrateGameStateFromJson(raw);
    if (st) return { state: st, playTimeAtSave: 0, persistSlot: 0 };
  }
  return null;
}

/** If slot 0 is empty but legacy flat save exists, import into slot 0. Legacy key kept for one-release fallback reads. */
export function migrateLegacyFlatSaveToSlotZero(): void {
  if (typeof localStorage === 'undefined') return;
  if (saveManager.loadGame(0)) return;
  const raw = localStorage.getItem(LEGACY_FLAT_SAVE_KEY);
  if (!raw) return;
  const state = hydrateGameStateFromJson(raw);
  if (!state) return;
  saveManager.saveGame(0, createSaveData(state, 0, {}));
}
