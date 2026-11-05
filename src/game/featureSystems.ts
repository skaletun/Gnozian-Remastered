/**
 * Wonders, religion & missionaries, tourism/influence, espionage, disasters, great people.
 * (No imports from engine.ts — avoids circular deps.)
 */
import type {
  GameState, GameSystems, WonderId, UnitType, GreatPersonMeterKind, SpyMission, DisasterKind,
  Era,
} from './types';
import {
  WONDERS, UNITS, GREAT_PEOPLE, getGreatPersonCost,
} from './constants';
import { createRng, hexDistance } from './mapgen';
import { addMessage } from './messages';

const WORKER_MAX_BUILDS = 3;
import { rngForEvent } from './kernel/rng';
import { isProgressionFeatureUnlocked, progressionLockReason } from './progressionLocks';

const FAITH_FOUND_RELIGION = 220;
const PRESSURE_CONVERT = 90;
const INFLUENCE_PER_TOURISM = 0.35;

function reconcileTileUnitPointers(state: GameState): GameState {
  // Clone only rows that have units or previously had unit pointers
  const rowsToClone = new Set<number>();
  for (const u of state.units) rowsToClone.add(u.r);
  for (let r = 0; r < state.tiles.length; r++) {
    if (state.tiles[r].some(t => t.unit != null)) rowsToClone.add(r);
  }
  const tiles = state.tiles.map((row, r) =>
    rowsToClone.has(r) ? row.map(t => ({ ...t, unit: null as number | null })) : row
  );
  const best = new Map<string, number>();
  for (const u of state.units) {
    const k = `${u.q},${u.r}`;
    const prev = best.get(k);
    if (prev === undefined || u.id < prev) best.set(k, u.id);
  }
  for (const [k, minId] of best) {
    const [qx, rx] = k.split(',').map(Number);
    if (rx >= 0 && rx < tiles.length && qx >= 0 && qx < tiles[0].length) {
      tiles[rx][qx].unit = minId;
    }
  }
  return { ...state, tiles };
}

function spawnUnitLocal(
  state: GameState,
  civIndex: number,
  type: UnitType,
  q: number,
  r: number,
  opts?: { greatPersonDefId?: string; displayName?: string }
): GameState {
  const def = UNITS[type];
  if (!def) return state;
  const newUnit = {
    id: state.nextUnitId,
    type,
    owner: civIndex,
    q,
    r,
    hp: 100,
    maxHp: 100,
    movement: def.movement,
    maxMovement: def.movement,
    strength: def.strength,
    rangedStrength: def.rangedStrength,
    range: def.range,
    hasAttacked: false,
    promotions: [] as string[],
    era: def.era,
    name: opts?.displayName ?? def.name,
    greatPersonDefId: opts?.greatPersonDefId ?? null,
    ...(type === 'scout' ? { scoutAutoExplore: !state.civilizations[civIndex]?.isHuman } : {}),
    ...(type === 'worker' ? { workerBuildsRemaining: WORKER_MAX_BUILDS } : {}),
  };
  const newCivs = state.civilizations.map((c, i) =>
    i !== civIndex ? c : { ...c, units: [...c.units, newUnit.id] }
  );
  return reconcileTileUnitPointers({
    ...state,
    units: [...state.units, newUnit],
    civilizations: newCivs,
    nextUnitId: state.nextUnitId + 1,
  });
}

export function createDefaultSystems(): GameSystems {
  return {
    wonderOwners: {},
    religions: [],
    cityFaithPressure: {},
    tourismTotal: {},
    influence: {},
    influenceDiplomacy: {
      balances: {},
      actionLog: [],
      treaties: [],
      sanctions: [],
      endeavors: [],
    },
    independentPowers: [],
    nextIndependentPowerId: 1,
    commanders: [],
    nextCommanderId: 1,
    geographyProgress: {
      homeHemisphereByCiv: {},
      distantLandsDiscoveredByCiv: {},
      distantLandsTotalByCiv: {},
      oceanUnlockedByCiv: {},
      riverNavigationUnlockedByCiv: {},
    },
    legacyCrisis: {
      pointsByCiv: {},
      pendingLegacyChoices: [],
      history: [],
      activeYieldModifiersByCiv: {},
      crisisActive: false,
      crisisAge: null,
      crisisTurnsLeft: 0,
      crisisSeverity: 0,
      selectedPolicyByCiv: {},
    },
    touristVisiting: {},
    touristDomestic: {},
    spies: [],
    disasters: [],
    greatPeopleMeter: {},
    greatPersonProgress: {},
    greatPersonClaimed: [],
    greatWorks: [],
    nextGreatWorkId: 1,
    worldVotes: [],
    spaceRace: {},
    nextSpyId: 1,
    nextDisasterId: 1,
    lastDisasterTurn: -999,
    civFirstContactSeen: {},
  };
}

function wonderYieldBonus(state: GameState, civIndex: number): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  const owners = state.systems.wonderOwners;
  for (const wid of Object.keys(owners) as WonderId[]) {
    const o = owners[wid];
    if (!o || o.civIndex !== civIndex) continue;
    const def = WONDERS[wid];
    if (!def?.yields) continue;
    for (const [k, v] of Object.entries(def.yields)) {
      out[k] = (out[k] ?? 0) + (v || 0);
    }
  }
  return out;
}

export function applyWonderIncomeModifiers(
  state: GameState,
  civIndex: number,
  income: { food: number; gold: number; science: number; culture: number; faith: number; happiness: number }
): void {
  const bonus = wonderYieldBonus(state, civIndex);
  income.food += bonus.food ?? 0;
  income.gold += bonus.gold ?? 0;
  income.science += bonus.science ?? 0;
  income.culture += bonus.culture ?? 0;
  income.faith += bonus.faith ?? 0;
  income.happiness += bonus.happiness ?? 0;
}

function processReligionAndFaith(state: GameState): GameState {
  const religionsNormalized = state.systems.religions.map(r => ({
    ...r,
    beliefs: r.beliefs ?? ['faith_from_holy_site'],
  }));
  const decay = 0.88;
  const cityFaithPressure: Record<number, Record<number, number>> = {};
  for (const city of state.cities) {
    const prev = state.systems.cityFaithPressure[city.id] ?? {};
    const next: Record<number, number> = {};
    for (const [k, v] of Object.entries(prev)) {
      next[Number(k)] = v * decay;
    }
    const f = city.yields.faith ?? 0;
    const civ = state.civilizations[city.owner];
    if (civ.religionIndex != null) {
      const ri = civ.religionIndex;
      next[ri] = (next[ri] ?? 0) + f * 1.25;
    }
    const fr = state.systems.religions.findIndex(r => r.founderCiv === city.owner);
    if (fr >= 0) next[fr] = (next[fr] ?? 0) + f * 0.55;
    cityFaithPressure[city.id] = next;
  }

  let religions = [...religionsNormalized];
  let s = state;
  const newCities = state.cities.map(c => {
    const press = cityFaithPressure[c.id] ?? {};
    let best: number | null = null;
    let bestV = 0;
    for (const [k, v] of Object.entries(press)) {
      if (v > bestV) {
        bestV = v;
        best = Number(k);
      }
    }
    const majority = best != null && bestV >= PRESSURE_CONVERT ? best : null;
    return { ...c, majorityReligionIndex: majority };
  });

  const newCivs = state.civilizations.map((c, i) => {
    let faithPool = c.faithPool + Math.max(0, c.lastTurnIncome?.faith ?? 0);
    let religionIndex = c.religionIndex;
    if (religionIndex == null && faithPool >= FAITH_FOUND_RELIGION && religions.length < 7) {
      const holy = newCities.find(ct => ct.owner === i && ct.isCapital);
      if (holy) {
        const name = `${c.adjective} Faith`;
        religions = [
          ...religions,
          {
            id: `rel_${religions.length}`,
            name,
            founderCiv: i,
            holyCityId: holy.id,
            beliefs: ['faith_from_holy_site', 'gold_from_temples'],
          },
        ];
        religionIndex = religions.length - 1;
        faithPool -= FAITH_FOUND_RELIGION;
        s = addMessage(s, `${c.name} founds "${name}"!`, 'religion', [i]);
      }
    }
    return { ...c, faithPool, religionIndex };
  });

  return {
    ...s,
    cities: newCities,
    civilizations: newCivs,
    systems: { ...state.systems, religions, cityFaithPressure },
  };
}

const ERA_ORDER: Era[] = [
  'ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern', 'atomic', 'information',
];

function eraIndex(e: Era): number {
  return Math.max(0, ERA_ORDER.indexOf(e));
}

function buildCulturalInfluenceMap(
  sys: GameSystems,
  nCivs: number,
  viewer: number,
  alive: boolean
): Record<number, number> {
  const out: Record<number, number> = {};
  if (!alive) return out;
  for (let j = 0; j < nCivs; j++) {
    if (j === viewer) continue;
    const vis = sys.touristVisiting[`${viewer}_${j}`] ?? 0;
    const dom = Math.max(1, sys.touristDomestic[j] ?? 1);
    out[j] = Math.min(100, Math.round((vis / dom) * 45));
  }
  return out;
}

function processTourismInfluence(state: GameState): GameState {
  const numCivs = Math.max(1, state.civilizations.length);
  const sys: GameSystems = {
    ...state.systems,
    tourismTotal: { ...state.systems.tourismTotal },
    influence: { ...state.systems.influence },
    touristVisiting: { ...state.systems.touristVisiting },
    touristDomestic: { ...state.systems.touristDomestic },
  };
  const rng = createRng(state.settings.seed + state.turn * 31);

  const aliveIdx = state.civilizations.map((c, i) => (c.isAlive ? i : -1)).filter(i => i >= 0);

  const touristDomestic: Record<number, number> = { ...sys.touristDomestic };
  for (const i of aliveIdx) {
    const civ = state.civilizations[i]!;
    touristDomestic[i] = Math.max(1, Math.floor((civ.lifetimeCulture ?? 0) / 100));
  }
  sys.touristDomestic = touristDomestic;

  for (const i of aliveIdx) {
    const civ = state.civilizations[i]!;
    let tour = 0;
    for (const cid of civ.cities) {
      const c = state.cities.find(x => x.id === cid);
      if (!c) continue;
      let local =
        Math.floor((c.yields.culture ?? 0) * 0.32 + (c.yields.gold ?? 0) * 0.04) +
        (c.buildings.includes('monument') ? 1 : 0) +
        (c.buildings.includes('broadcast_tower') ? 2 : 0);
      if (c.buildings.includes('temple') || c.buildings.includes('cathedral')) {
        local = Math.floor(local * 1.25);
      }
      for (const gwId of c.greatWorkIds ?? []) {
        const gw = state.systems.greatWorks.find(g => g.id === gwId);
        if (gw) local += gw.tourism;
      }
      tour += local;
    }
    for (const wid of Object.keys(state.systems.wonderOwners) as WonderId[]) {
      const o = state.systems.wonderOwners[wid];
      if (o?.civIndex !== i) continue;
      const def = WONDERS[wid];
      tour += def?.tourismPerTurn ?? 0;
    }
    let mult = 1;
    if (state.systems.wonderOwners.cristo_redentor?.civIndex === i) {
      mult *= WONDERS.cristo_redentor.tourismMultiplierOwner ?? 1;
    }
    tour = Math.floor(tour * mult);
    sys.tourismTotal[i] = (sys.tourismTotal[i] ?? 0) + tour;

    const others = aliveIdx.filter(j => j !== i);
    for (const j of others) {
      const flowPerJ = tour / Math.max(1, others.length);
      const vKey = `${i}_${j}`;
      const inc = flowPerJ / (200 * numCivs);
      sys.touristVisiting[vKey] = (sys.touristVisiting[vKey] ?? 0) + inc * (0.85 + rng() * 0.3);
      const inflKey = `${i}_${j}`;
      sys.influence[inflKey] =
        (sys.influence[inflKey] ?? 0) + tour * INFLUENCE_PER_TOURISM * (0.85 + rng() * 0.3);
    }
  }

  const civilizations = state.civilizations.map((c, i) => ({
    ...c,
    tourism: sys.tourismTotal[i] ?? c.tourism,
    culturalInfluence: buildCulturalInfluenceMap(sys, state.civilizations.length, i, c.isAlive),
  }));

  return { ...state, systems: sys, civilizations };
}

export function getVisitingTourists(state: GameState, civIndex: number): number {
  let total = 0;
  for (let j = 0; j < state.civilizations.length; j++) {
    if (j === civIndex) continue;
    total += state.systems.touristVisiting[`${civIndex}_${j}`] ?? 0;
  }
  return total;
}

export function isCulturallyDominant(state: GameState, civA: number, civB: number): boolean {
  const a = state.civilizations[civA];
  const b = state.civilizations[civB];
  if (!a?.isAlive || !b?.isAlive) return false;
  // Cultural domination of A over B is decided per pair: A's outbound tourism stream
  // toward B must outweigh B's domestic tourists. Comparing the total A→* stream
  // against any single B used to declare victory too eagerly.
  const flow = state.systems.touristVisiting[`${civA}_${civB}`] ?? 0;
  const domestic = state.systems.touristDomestic[civB] ?? 0;
  return flow > domestic;
}

export function getCultureVictoryDominantCount(state: GameState, civIndex: number): number {
  let n = 0;
  for (let j = 0; j < state.civilizations.length; j++) {
    if (j === civIndex) continue;
    if (!state.civilizations[j]!.isAlive) continue;
    if (isCulturallyDominant(state, civIndex, j)) n++;
  }
  return n;
}

function processSpies(state: GameState): GameState {
  let s = state;
  const spies = state.systems.spies.map(sp => {
    const next = { ...sp, turnsActive: sp.turnsActive + 1, discovered: sp.discovered ?? false };
    if (next.turnsActive < 4) return next;
    const target = s.civilizations[next.targetCiv];
    const owner = s.civilizations[next.ownerCiv];
    if (!target?.isAlive || !owner?.isAlive) return { ...next, turnsActive: 0 };

    if (next.mission === 'counter_espionage') {
      s = addMessage(s, `${owner.name} maintains counter-intelligence.`, 'espionage', [next.ownerCiv]);
      return { ...next, turnsActive: 0 };
    }

    if (next.mission === 'steal_tech') {
      const rng = rngForEvent(s, 'spy:steal_tech', next.ownerCiv, next.targetCiv);
      if (rng() < 0.22) {
        s = addMessage(
          s,
          `${target.name} catches and expels ${owner.name}'s spy — tech theft failed.`,
          'espionage',
          [next.ownerCiv, next.targetCiv]
        );
        return { ...next, turnsActive: 0, discovered: true };
      }
      const stolen = 25 + Math.floor(rng() * 20);
      s = {
        ...s,
        civilizations: s.civilizations.map((c, idx) => {
          if (idx === next.targetCiv) return { ...c, researchProgress: Math.max(0, c.researchProgress - stolen) };
          if (idx === next.ownerCiv)
            return { ...c, resources: { ...c.resources, science: c.resources.science + stolen * 0.5 } };
          return c;
        }),
      };
      s = addMessage(s, `${owner.name}'s spies stole ${stolen} science from ${target.name}!`, 'espionage', [
        next.ownerCiv,
        next.targetCiv,
      ]);
    } else if (next.mission === 'sabotage' || next.mission === 'disrupt_production') {
      const city = s.cities.find(c => c.owner === next.targetCiv && (next.targetCityId == null || c.id === next.targetCityId));
      if (city) {
        const progCut = next.mission === 'disrupt_production' ? 55 : 40;
        s = {
          ...s,
          cities: s.cities.map(c =>
            c.id === city.id
              ? {
                  ...c,
                  hp: Math.max(1, c.hp - (next.mission === 'sabotage' ? 22 : 8)),
                  productionQueue: c.productionQueue.map((q, qi) =>
                    qi === 0 ? { ...q, progress: Math.max(0, q.progress - progCut) } : q
                  ),
                }
              : c
          ),
        };
        s = addMessage(s, `Espionage disrupts production in ${city.name}!`, 'espionage', [
          next.ownerCiv,
          city.owner,
        ]);
      }
    } else if (next.mission === 'steal_great_work') {
      const rng = rngForEvent(s, 'spy:steal_great_work', next.ownerCiv, next.targetCiv);
      const targetCities = s.cities.filter(c => c.owner === next.targetCiv && (c.greatWorkIds?.length ?? 0) > 0);
      const city = targetCities[Math.floor(rng() * Math.max(1, targetCities.length))];
      if (city && city.greatWorkIds?.length) {
        const pickId = city.greatWorkIds[Math.floor(rng() * city.greatWorkIds.length)]!;
        const newGws = s.systems.greatWorks.map(gw =>
          gw.id === pickId ? { ...gw, cityId: null, creatorCiv: next.ownerCiv } : gw
        );
        s = {
          ...s,
          systems: { ...s.systems, greatWorks: newGws },
          cities: s.cities.map(c =>
            c.id === city.id ? { ...c, greatWorkIds: c.greatWorkIds.filter(id => id !== pickId) } : c
          ),
        };
        s = addMessage(s, `${owner.name} steals a great work from ${target.name}!`, 'espionage', [
          next.ownerCiv,
          next.targetCiv,
        ]);
      }
    } else if (next.mission === 'promote_loyalty_issues') {
      const city = s.cities.find(c => c.owner === next.targetCiv);
      if (city) {
        s = {
          ...s,
          cities: s.cities.map(c => (c.id === city.id ? { ...c, loyalty: Math.max(0, c.loyalty - 14) } : c)),
        };
        s = addMessage(s, `Dissent spreads in ${city.name}.`, 'espionage', [city.owner]);
      }
    } else {
      s = addMessage(s, `${owner.name} gathers intelligence on ${target.name}.`, 'espionage', [
        next.ownerCiv,
        next.targetCiv,
      ]);
    }
    return { ...next, turnsActive: 0 };
  });

  return { ...s, systems: { ...s.systems, spies } };
}

function processDisasters(state: GameState): GameState {
  const rng = createRng(state.settings.seed + state.turn * 17 + 3);
  let s = { ...state };
  const sys = { ...s.systems, disasters: [...s.systems.disasters] };
  const kindCfg: Record<DisasterKind, { radius: number; turns: number; tileChance: number; cityDamage: number }> = {
    flood: { radius: 3, turns: 2, tileChance: 0.26, cityDamage: 10 },
    earthquake: { radius: 2, turns: 2, tileChance: 0.18, cityDamage: 20 },
    drought: { radius: 3, turns: 3, tileChance: 0.22, cityDamage: 8 },
    storm: { radius: 3, turns: 2, tileChance: 0.16, cityDamage: 9 },
    volcanic_eruption: { radius: 2, turns: 2, tileChance: 0.3, cityDamage: 26 },
    tsunami: { radius: 4, turns: 2, tileChance: 0.34, cityDamage: 16 },
    blizzard: { radius: 3, turns: 2, tileChance: 0.18, cityDamage: 14 },
    wildfire: { radius: 4, turns: 3, tileChance: 0.24, cityDamage: 12 },
  };

  // Slightly scales with world size and avoids dead periods.
  const mapArea = (s.tiles[0]?.length ?? 1) * s.tiles.length;
  const spawnChance = Math.min(0.055, 0.012 + mapArea / 18000);
  // Small cooldown to avoid spawning disasters too frequently.
  const lastSpawn = s.systems.lastDisasterTurn ?? -999;
  const spawnCooldown = 3; // turns
  if (s.turn - lastSpawn >= spawnCooldown && rng() < spawnChance && s.cities.length > 0) {
    const city = s.cities[Math.floor(rng() * s.cities.length)];
    const kinds = [
      'flood',
      'earthquake',
      'drought',
      'storm',
      'volcanic_eruption',
      'tsunami',
      'blizzard',
      'wildfire',
    ] as const;
    const kind = kinds[Math.floor(rng() * kinds.length)]!;
    const cfg = kindCfg[kind];
    const newDis: typeof sys.disasters[number] = {
      id: sys.nextDisasterId++,
      kind,
      q: city.q,
      r: city.r,
      turnsLeft: cfg.turns,
      radius: cfg.radius,
      notified: false,
      spawnNearCityOwner: city.owner,
    };
    sys.disasters.push(newDis);
    // Announce once and mark notified so we don't duplicate later.
    s = addMessage(s, `${kind.toUpperCase()} near ${city.name}! Seek shelter!`, 'disaster', [city.owner]);
    // mark the pushed disaster as announced so re-runs don't re-announce
    sys.disasters[sys.disasters.length - 1] = { ...newDis, notified: true };
    sys.lastDisasterTurn = s.turn;
  }

  const remaining: typeof sys.disasters = [];
  let tiles = s.tiles.map(row => row.map(t => ({ ...t })));
  let cities = [...s.cities];
  let units = [...s.units];

  for (const d of sys.disasters) {
    const cfg = kindCfg[d.kind];
    const left = d.turnsLeft - 1;
    const w = tiles[0].length;
    const h = tiles.length;
    for (let dr = -d.radius; dr <= d.radius; dr++) {
      for (let dc = -d.radius; dc <= d.radius; dc++) {
        const q = d.q + dc;
        const r = d.r + dr;
        if (q < 0 || r < 0 || q >= w || r >= h) continue;
        const dist = hexDistance(q, r, d.q, d.r);
        if (dist > d.radius) continue;
        const falloff = 1 - dist / (d.radius + 1);
        const intensity = 0.55 + 0.45 * (d.turnsLeft / Math.max(1, cfg.turns));
        const t = tiles[r][q];
        const cityForTile = t.city != null ? cities.find(cc => cc.id === t.city) : null;
        const hasAqueduct = cityForTile?.buildings.includes('aqueduct');
        const droughtResist = hasAqueduct && d.kind === 'drought' ? 0.55 : 1;
        const tileHitChance = cfg.tileChance * falloff * intensity;

        if ((d.kind === 'flood' || d.kind === 'tsunami' || d.kind === 'storm') && t.improvement !== 'none' && rng() < tileHitChance) {
          tiles[r][q] = { ...t, improvement: 'none' };
        }

        if ((d.kind === 'drought' || d.kind === 'wildfire') && t.resource && rng() < 0.2 * falloff * intensity * droughtResist) {
          tiles[r][q] = { ...t, resource: null };
        }

        if (t.city != null && (d.kind === 'earthquake' || d.kind === 'volcanic_eruption' || d.kind === 'blizzard' || d.kind === 'wildfire' || d.kind === 'tsunami')) {
          const cid = t.city;
          const dmg = Math.max(1, Math.round(cfg.cityDamage * falloff * intensity));
          cities = cities.map(c => (c.id === cid ? { ...c, hp: Math.max(1, c.hp - dmg) } : c));
        }

        if (rng() < 0.16 * falloff * intensity) {
          const unitOnTile = units.find(u => u.q === q && u.r === r);
          if (unitOnTile) {
            const unitDmg = Math.max(3, Math.round((cfg.cityDamage * 0.55) * falloff));
            units = units.map(u => (u.id === unitOnTile.id ? { ...u, hp: Math.max(1, u.hp - unitDmg) } : u));
          }
        }
      }
    }
    if (left > 0) {
      remaining.push({ ...d, turnsLeft: left });
    } else {
      // Notify subsiding once per disaster
      if (!d.endNotified) {
        let subsRel: number[] | undefined =
          d.spawnNearCityOwner != null ? [d.spawnNearCityOwner] : undefined;
        if (subsRel == null) {
          const owners = new Set<number>();
          for (const c of cities) {
            if (hexDistance(c.q, c.r, d.q, d.r) <= d.radius + 2) owners.add(c.owner);
          }
          subsRel = owners.size ? [...owners] : undefined;
        }
        s = addMessage(s, `${d.kind.toUpperCase()} subsides near (${d.q}, ${d.r}).`, 'disaster', subsRel);
        // mark as end-notified to avoid re-announcing on re-runs
        d.endNotified = true;
      }
    }
  }
  sys.disasters = remaining;
  return reconcileTileUnitPointers({ ...s, systems: sys, tiles, cities, units });
}

function pickGreatPersonForMeter(
  kind: GreatPersonMeterKind,
  claimed: string[],
  civEra: Era
): (typeof GREAT_PEOPLE)[string] | null {
  const candidates = Object.values(GREAT_PEOPLE).filter(
    g => g.type === kind && !claimed.includes(g.id) && eraIndex(g.era) <= eraIndex(civEra)
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => eraIndex(b.era) - eraIndex(a.era));
  return candidates[0]!;
}

const METER_TO_UNIT: Record<GreatPersonMeterKind, UnitType> = {
  scientist: 'great_scientist',
  artist: 'great_artist',
  general: 'great_general',
  merchant: 'great_merchant',
  prophet: 'great_prophet',
  admiral: 'great_admiral',
  engineer: 'great_engineer',
  writer: 'great_writer',
  musician: 'great_musician',
};

function processGreatPeopleMeters(state: GameState): GameState {
  let s = state;
  const meters = { ...s.systems.greatPeopleMeter };
  const claimed = [...s.systems.greatPersonClaimed];

  for (let i = 0; i < s.civilizations.length; i++) {
    const civ = s.civilizations[i];
    if (!civ.isAlive) continue;
    let sci = 0,
      art = 0,
      gen = 0,
      mer = 0,
      pro = 0,
      adm = 0,
      eng = 0,
      wri = 0,
      mus = 0;
    for (const cid of civ.cities) {
      const c = s.cities.find(x => x.id === cid);
      if (!c) continue;
      const t = s.tiles[c.r]?.[c.q];
      const coastal = t && (t.terrain === 'coast' || t.terrain === 'ocean');
      sci += (c.yields.science ?? 0) * 0.08;
      art += (c.yields.culture ?? 0) * 0.08;
      gen += (c.yields.production ?? 0) * 0.06;
      mer += (c.yields.gold ?? 0) * 0.05;
      pro += (c.yields.faith ?? 0) * 0.09;
      adm += (c.yields.gold ?? 0) * 0.03 + (coastal ? 1.2 : 0);
      eng += (c.yields.production ?? 0) * 0.07;
      wri += (c.yields.culture ?? 0) * 0.05;
      mus += (c.yields.culture ?? 0) * 0.04;
    }
    const m: Partial<Record<GreatPersonMeterKind, number>> = { ...(meters[i] ?? {}) };
    const kinds: GreatPersonMeterKind[] = [
      'scientist', 'artist', 'general', 'merchant', 'prophet', 'admiral', 'engineer', 'writer', 'musician',
    ];
    const gains = [sci, art, gen, mer, pro, adm, eng, wri, mus];
    for (let k = 0; k < kinds.length; k++) {
      const key = kinds[k]!;
      m[key] = (m[key] ?? 0) + gains[k]!;
    }
    meters[i] = m;

    const threshold = getGreatPersonCost(civ.era, civ.greatPeopleEarned);
    for (const key of kinds) {
      if ((m[key] ?? 0) < threshold) continue;
      m[key] = 0;
      const cap = s.cities.find(c => c.owner === i && c.isCapital) ?? s.cities.find(c => c.owner === i);
      if (!cap) continue;
      const gp = pickGreatPersonForMeter(key, claimed, civ.era);
      const unitType = METER_TO_UNIT[key];
      if (gp) {
        claimed.push(gp.id);
        s = spawnUnitLocal(s, i, unitType, cap.q, cap.r, {
          greatPersonDefId: gp.id,
          displayName: gp.name,
        });
        s = addMessage(s, `${gp.name} (${gp.type}) appears near ${cap.name}!`, 'city', [i]);
      } else {
        s = spawnUnitLocal(s, i, unitType, cap.q, cap.r, {
          displayName: UNITS[unitType]?.name ?? unitType,
        });
        s = addMessage(s, `${UNITS[unitType]?.name ?? unitType} appears near ${cap.name}!`, 'city', [i]);
      }
      s = {
        ...s,
        civilizations: s.civilizations.map((c, idx) =>
          idx !== i ? c : { ...c, greatPeopleEarned: c.greatPeopleEarned + 1 }
        ),
      };
    }
  }

  return {
    ...s,
    systems: { ...s.systems, greatPeopleMeter: meters, greatPersonClaimed: claimed },
  };
}

export function applyFeatureSystemsEnd(state: GameState): GameState {
  let s = processReligionAndFaith(state);
  s = processTourismInfluence(s);
  s = processSpies(s);
  s = processDisasters(s);
  s = processGreatPeopleMeters(s);
  return reconcileTileUnitPointers(s);
}

export function isWonderAvailable(state: GameState, wid: WonderId): boolean {
  return !state.systems.wonderOwners[wid];
}

export function recruitSpy(
  state: GameState,
  ownerCiv: number,
  targetCiv: number,
  mission: SpyMission
): GameState {
  const cost = 160;
  const civ = state.civilizations[ownerCiv];
  if (!isProgressionFeatureUnlocked(state, ownerCiv, 'espionage')) {
    return addMessage(state, progressionLockReason('espionage'), 'warning', [ownerCiv]);
  }
  if (!civ || civ.resources.gold < cost) return addMessage(state, 'Not enough gold to recruit a spy.', 'warning', [ownerCiv]);
  if (ownerCiv === targetCiv) return state;
  const sys = {
    ...state.systems,
    spies: [
      ...state.systems.spies,
      {
        id: state.systems.nextSpyId,
        ownerCiv,
        targetCiv,
        mission,
        turnsActive: 0,
        discovered: false,
      },
    ],
    nextSpyId: state.systems.nextSpyId + 1,
  };
  const civilizations = state.civilizations.map((c, i) =>
    i === ownerCiv ? { ...c, resources: { ...c.resources, gold: c.resources.gold - cost } } : c
  );
  return addMessage(
    { ...state, systems: sys, civilizations },
    `${civ.name} recruits a spy (${mission}).`,
    'espionage',
    [ownerCiv]
  );
}

export function missionarySpread(state: GameState, unitId: number, cityId: number): GameState {
  const unit = state.units.find(u => u.id === unitId);
  const city = state.cities.find(c => c.id === cityId);
  if (!unit || unit.type !== 'missionary' || !city || unit.owner === city.owner) return state;

  const founderRel = state.systems.religions.findIndex(r => r.founderCiv === unit.owner);
  if (founderRel < 0) return addMessage(state, 'Found a religion before sending missionaries.', 'warning', [unit.owner]);

  const prevMajority = city.majorityReligionIndex;
  const sys = { ...state.systems, cityFaithPressure: { ...state.systems.cityFaithPressure } };
  const press = { ...(sys.cityFaithPressure[cityId] ?? {}) };
  press[founderRel] = (press[founderRel] ?? 0) + 42;
  sys.cityFaithPressure[cityId] = press;

  const newUnits = state.units.filter(u => u.id !== unitId);
  const civilizations = state.civilizations.map((c, i) =>
    i !== unit.owner ? c : { ...c, units: c.units.filter(id => id !== unitId) }
  );

  let s = reconcileTileUnitPointers({ ...state, systems: sys, units: newUnits, civilizations });
  const maj = press[founderRel] >= PRESSURE_CONVERT ? founderRel : null;
  s = {
    ...s,
    cities: s.cities.map(c => (c.id === cityId ? { ...c, majorityReligionIndex: maj } : c)),
  };
  s = addMessage(s, `Missionary spreads faith in ${city.name}.`, 'religion', [unit.owner, city.owner]);
  if (maj != null && maj !== prevMajority) {
    const rname = s.systems.religions[maj]?.name ?? 'a new majority faith';
    s = addMessage(s, `${city.name}: majority religion is now ${rname}.`, 'religion', [city.owner]);
  }
  return s;
}

export function completeWonderProduction(
  state: GameState,
  cityId: number,
  wid: WonderId,
  civIndex: number
): GameState {
  const dvp = WONDERS[wid]?.diplomaticVictoryPoints ?? 0;
  const sys = {
    ...state.systems,
    wonderOwners: {
      ...state.systems.wonderOwners,
      [wid]: { civIndex, cityId, turnBuilt: state.turn },
    },
  };
  let civilizations = state.civilizations;
  if (dvp > 0) {
    civilizations = civilizations.map((c, i) =>
      i !== civIndex ? c : { ...c, diplomaticVictoryPoints: c.diplomaticVictoryPoints + dvp }
    );
  }
  const name = WONDERS[wid]?.name ?? wid;
  return addMessage(
    { ...state, systems: sys, civilizations },
    `${state.civilizations[civIndex]?.name} completes the wonder ${name}!`,
    'wonder',
    [civIndex]
  );
}
