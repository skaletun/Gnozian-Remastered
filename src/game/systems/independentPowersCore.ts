import { hexDistance } from '../mapgen';
import type {
  GameAge,
  GameState,
  IndependentPower,
  IndependentPowerStance,
  IndependentPowerTier,
} from '../types';

const ACTION_COST = {
  incite_raid: 12,
  levy: 16,
  upgrade_city_state: 24,
} as const;

function targetIndependentPowerCount(state: GameState): number {
  const civs = state.civilizations.filter(c => c.isAlive).length;
  const age = state.age?.currentAge ?? 'antiquity';
  const ageBonus = age === 'modern' ? 2 : age === 'exploration' ? 1 : 0;
  return Math.max(2, civs + ageBonus);
}

function normalizedStance(v: unknown): IndependentPowerStance {
  if (v === 'hostile' || v === 'friendly') return v;
  return 'neutral';
}

function normalizedTier(v: unknown): IndependentPowerTier {
  if (v === 'camp' || v === 'tribe' || v === 'city_state') return v;
  return 'camp';
}

function stanceByTier(tier: IndependentPowerTier): IndependentPowerStance {
  if (tier === 'city_state') return 'friendly';
  if (tier === 'camp') return 'hostile';
  return 'neutral';
}

function normalizePower(state: GameState, p: IndependentPower, index: number): IndependentPower {
  const mapH = state.tiles.length;
  const mapW = state.tiles[0]?.length ?? 0;
  const q = Math.max(0, Math.min(Math.max(0, mapW - 1), Math.floor(Number(p.q ?? 0))));
  const r = Math.max(0, Math.min(Math.max(0, mapH - 1), Math.floor(Number(p.r ?? 0))));
  const tier = normalizedTier(p.tier);
  const relations: Record<number, IndependentPowerStance> = {};
  for (let i = 0; i < state.civilizations.length; i++) {
    relations[i] = normalizedStance(p.relations?.[i] ?? stanceByTier(tier));
  }
  const age = p.age === 'exploration' || p.age === 'modern' ? p.age : 'antiquity';
  return {
    id: Math.max(1, Math.floor(Number(p.id ?? index + 1))),
    name: String(p.name || `Independent Power ${index + 1}`),
    q,
    r,
    age: age as GameAge,
    tier,
    strength: Math.max(20, Math.floor(Number(p.strength ?? 40))),
    influenceProgress: Math.max(0, Math.floor(Number(p.influenceProgress ?? 0))),
    relations,
    raidTargetCiv: p.raidTargetCiv == null ? null : Math.max(0, Math.floor(Number(p.raidTargetCiv))),
    raidTurnsLeft: Math.max(0, Math.floor(Number(p.raidTurnsLeft ?? 0))),
    leviedByCiv: p.leviedByCiv == null ? null : Math.max(0, Math.floor(Number(p.leviedByCiv))),
    leviedTurnsLeft: Math.max(0, Math.floor(Number(p.leviedTurnsLeft ?? 0))),
  };
}

function spawnLocationForId(state: GameState, id: number): { q: number; r: number } | null {
  const mapH = state.tiles.length;
  const mapW = state.tiles[0]?.length ?? 0;
  if (!mapW || !mapH) return null;
  const start = (id * 37 + state.turn * 11) % (mapW * mapH);
  for (let i = 0; i < mapW * mapH; i++) {
    const idx = (start + i) % (mapW * mapH);
    const r = Math.floor(idx / mapW);
    const q = idx % mapW;
    const tile = state.tiles[r]?.[q];
    if (!tile) continue;
    if (tile.terrain === 'ocean' || tile.terrain === 'mountains') continue;
    if (tile.city != null || tile.owner != null) continue;
    const closeToCity = state.cities.some(c => hexDistance(c.q, c.r, q, r) <= 2);
    if (closeToCity) continue;
    return { q, r };
  }
  return null;
}

function spawnOneIndependentPower(state: GameState): GameState {
  const id = state.systems.nextIndependentPowerId ?? 1;
  const pos = spawnLocationForId(state, id);
  if (!pos) return state;
  const tier: IndependentPowerTier = state.age?.currentAge === 'modern' ? 'tribe' : 'camp';
  const relations: Record<number, IndependentPowerStance> = {};
  for (let i = 0; i < state.civilizations.length; i++) {
    relations[i] = stanceByTier(tier);
  }
  const power: IndependentPower = {
    id,
    name: `Independent ${id}`,
    q: pos.q,
    r: pos.r,
    age: state.age?.currentAge ?? 'antiquity',
    tier,
    strength: tier === 'camp' ? 42 : 58,
    influenceProgress: 0,
    relations,
    raidTargetCiv: null,
    raidTurnsLeft: 0,
    leviedByCiv: null,
    leviedTurnsLeft: 0,
  };
  return {
    ...state,
    systems: {
      ...state.systems,
      independentPowers: [...state.systems.independentPowers, power],
      nextIndependentPowerId: id + 1,
    },
  };
}

export function normalizeIndependentPowersState(state: GameState): {
  independentPowers: IndependentPower[];
  nextIndependentPowerId: number;
} {
  const raw = Array.isArray(state.systems.independentPowers) ? state.systems.independentPowers : [];
  const independentPowers = raw.map((p, i) => normalizePower(state, p, i));
  const usedMax = independentPowers.reduce((m, p) => Math.max(m, p.id), 0);
  const nextIndependentPowerId = Math.max(
    1,
    typeof state.systems.nextIndependentPowerId === 'number'
      ? Math.floor(state.systems.nextIndependentPowerId)
      : usedMax + 1
  );
  return { independentPowers, nextIndependentPowerId };
}

export function getIndependentActionCost(action: keyof typeof ACTION_COST): number {
  return ACTION_COST[action];
}

export function tickIndependentPowers(state: GameState): GameState {
  const target = targetIndependentPowerCount(state);
  let next: GameState = {
    ...state,
    systems: {
      ...state.systems,
      independentPowers: (state.systems.independentPowers ?? []).map(p => {
        const raidTurnsLeft = Math.max(0, (p.raidTurnsLeft ?? 0) - 1);
        const leviedTurnsLeft = Math.max(0, (p.leviedTurnsLeft ?? 0) - 1);
        const tier =
          p.tier === 'camp' && p.influenceProgress >= 20
            ? 'tribe'
            : p.tier === 'tribe' && p.influenceProgress >= 55
              ? 'city_state'
              : p.tier;
        const relations = { ...p.relations };
        if (tier === 'city_state') {
          for (const k of Object.keys(relations)) {
            if (relations[Number(k)] === 'hostile') relations[Number(k)] = 'neutral';
          }
        }
        return {
          ...p,
          tier,
          relations,
          influenceProgress: Math.max(0, p.influenceProgress + (p.tier === 'city_state' ? 0 : 1)),
          raidTurnsLeft,
          raidTargetCiv: raidTurnsLeft > 0 ? p.raidTargetCiv ?? null : null,
          leviedTurnsLeft,
          leviedByCiv: leviedTurnsLeft > 0 ? p.leviedByCiv ?? null : null,
        };
      }),
    },
  };

  for (const p of next.systems.independentPowers) {
    if ((p.raidTurnsLeft ?? 0) <= 0 || p.raidTargetCiv == null) continue;
    const targetCiv = next.civilizations[p.raidTargetCiv];
    if (!targetCiv?.isAlive) continue;
    next = {
      ...next,
      civilizations: next.civilizations.map((c, i) =>
        i !== p.raidTargetCiv
          ? c
          : {
              ...c,
              resources: {
                ...c.resources,
                gold: Math.max(-100, c.resources.gold - 6),
                happiness: Math.max(-50, c.resources.happiness - 1),
              },
            }
      ),
    };
  }

  while (next.systems.independentPowers.length < target) {
    const spawned = spawnOneIndependentPower(next);
    if (spawned === next) break;
    next = spawned;
  }
  return next;
}

