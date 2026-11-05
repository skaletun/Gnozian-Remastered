import { addMessage } from '../messages';
import type { GameState, GeographyHemisphere, GeographyProgressState } from '../types';

function hemisphereForQ(q: number, width: number): GeographyHemisphere {
  return q < width / 2 ? 'west' : 'east';
}

function isLandTerrain(terrain: string): boolean {
  return terrain !== 'ocean' && terrain !== 'coast';
}

function defaultGeographyState(): GeographyProgressState {
  return {
    homeHemisphereByCiv: {},
    distantLandsDiscoveredByCiv: {},
    distantLandsTotalByCiv: {},
    oceanUnlockedByCiv: {},
    riverNavigationUnlockedByCiv: {},
  };
}

function inferHomeHemisphere(state: GameState, civIndex: number): GeographyHemisphere {
  const width = state.tiles[0]?.length ?? 1;
  const civ = state.civilizations[civIndex];
  if (!civ) return 'west';
  const cap = civ.capital == null ? null : state.cities.find(c => c.id === civ.capital && c.owner === civIndex);
  if (cap) return hemisphereForQ(cap.q, width);
  const city = state.cities.find(c => c.owner === civIndex);
  if (city) return hemisphereForQ(city.q, width);
  const unit = state.units.find(u => u.owner === civIndex);
  if (unit) return hemisphereForQ(unit.q, width);
  return 'west';
}

export function normalizeGeographyProgress(state: GameState): GeographyProgressState {
  const raw = state.systems.geographyProgress;
  const g = raw && typeof raw === 'object' ? raw : defaultGeographyState();
  const out: GeographyProgressState = {
    homeHemisphereByCiv: {},
    distantLandsDiscoveredByCiv: {},
    distantLandsTotalByCiv: {},
    oceanUnlockedByCiv: {},
    riverNavigationUnlockedByCiv: {},
  };
  for (let i = 0; i < state.civilizations.length; i++) {
    out.homeHemisphereByCiv[i] =
      g.homeHemisphereByCiv?.[i] === 'east' || g.homeHemisphereByCiv?.[i] === 'west'
        ? g.homeHemisphereByCiv[i]!
        : inferHomeHemisphere(state, i);
    out.distantLandsDiscoveredByCiv[i] = Math.max(0, Math.floor(Number(g.distantLandsDiscoveredByCiv?.[i] ?? 0)));
    out.distantLandsTotalByCiv[i] = Math.max(0, Math.floor(Number(g.distantLandsTotalByCiv?.[i] ?? 0)));
    out.oceanUnlockedByCiv[i] = !!g.oceanUnlockedByCiv?.[i];
    out.riverNavigationUnlockedByCiv[i] = !!g.riverNavigationUnlockedByCiv?.[i];
  }
  return out;
}

export function isOpenOceanUnlocked(state: Pick<GameState, 'age' | 'systems' | 'civilizations'>, civIndex: number): boolean {
  const civCount = Array.isArray(state?.civilizations) ? state.civilizations.length : 0;
  if (civIndex < 0 || (civCount > 0 && civIndex >= civCount)) return false;
  const byAge = (state?.age?.currentAge ?? 'antiquity') !== 'antiquity';
  const geo = state?.systems?.geographyProgress;
  return byAge || !!geo?.oceanUnlockedByCiv?.[civIndex];
}

export function isRiverNavigationUnlocked(
  state: Pick<GameState, 'age' | 'systems' | 'civilizations'>,
  civIndex: number
): boolean {
  const civCount = Array.isArray(state?.civilizations) ? state.civilizations.length : 0;
  if (civIndex < 0 || (civCount > 0 && civIndex >= civCount)) return false;
  const byAge = (state?.age?.currentAge ?? 'antiquity') !== 'antiquity';
  const geo = state?.systems?.geographyProgress;
  return byAge || !!geo?.riverNavigationUnlockedByCiv?.[civIndex];
}

function computeDistantLandCounts(state: GameState, civIndex: number, home: GeographyHemisphere): {
  discovered: number;
  total: number;
} {
  const width = state.tiles[0]?.length ?? 0;
  if (!width) return { discovered: 0, total: 0 };
  let discovered = 0;
  let total = 0;
  for (let r = 0; r < state.tiles.length; r++) {
    for (let q = 0; q < width; q++) {
      const tile = state.tiles[r]?.[q];
      if (!tile || !isLandTerrain(tile.terrain)) continue;
      const distant = hemisphereForQ(q, width) !== home;
      if (!distant) continue;
      total++;
      if (tile.revealed?.[civIndex]) discovered++;
    }
  }
  return { discovered, total };
}

export function tickGeographyProgress(state: GameState): GameState {
  const geo = normalizeGeographyProgress(state);
  let next = state;
  let geography = { ...geo };

  for (let i = 0; i < state.civilizations.length; i++) {
    const civ = state.civilizations[i];
    if (!civ?.isAlive) continue;
    const home = geography.homeHemisphereByCiv[i] ?? inferHomeHemisphere(state, i);
    geography.homeHemisphereByCiv[i] = home;

    const oceanNow = isOpenOceanUnlocked(state, i);
    const riverNow = isRiverNavigationUnlocked(state, i);
    const hadOcean = !!geography.oceanUnlockedByCiv[i];
    const hadRiver = !!geography.riverNavigationUnlockedByCiv[i];
    geography.oceanUnlockedByCiv[i] = oceanNow;
    geography.riverNavigationUnlockedByCiv[i] = riverNow;

    if (!hadOcean && oceanNow) {
      next = addMessage(next, `${civ.name} unlocks open-ocean navigation.`, 'info', [i]);
    }
    if (!hadRiver && riverNow) {
      next = addMessage(next, `${civ.name} unlocks river navigation.`, 'info', [i]);
    }

    const counts = computeDistantLandCounts(next, i, home);
    const prevDiscovered = geography.distantLandsDiscoveredByCiv[i] ?? 0;
    geography.distantLandsDiscoveredByCiv[i] = counts.discovered;
    geography.distantLandsTotalByCiv[i] = counts.total;
    if (counts.discovered > prevDiscovered) {
      const delta = counts.discovered - prevDiscovered;
      next = {
        ...next,
        civilizations: next.civilizations.map((c, idx) =>
          idx !== i
            ? c
            : {
                ...c,
                resources: {
                  ...c.resources,
                  gold: Math.max(-100, c.resources.gold + delta * 5),
                  science: c.resources.science + delta * 2,
                  culture: c.resources.culture + delta * 2,
                },
              }
        ),
      };
      next = addMessage(next, `${civ.name} discovers distant lands (+${delta * 5} gold).`, 'info', [i]);
    }
  }

  return {
    ...next,
    systems: {
      ...next.systems,
      geographyProgress: geography,
    },
  };
}

