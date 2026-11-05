import { BUILDINGS, GOVERNMENTS, GREAT_PEOPLE, NATURAL_RESOURCES, POLICY_CARDS, SPACE_RACE_STAGE_COSTS, TECHNOLOGIES } from '../constants';
import { createRng } from '../mapgen';
import { addMessage } from '../messages';
import { isMilitarilyEngaged, relationPair } from './diplomacyCore';
import { pruneInvalidTradeRoutes } from './tradeRoutesCore';
import type { City, Civilization, Era, GameState, WeatherType, WorldState, YieldMap } from '../types';

export function nextWorldState(prev: WorldState, turn: number, seed: number): WorldState {
  const r = createRng(seed + turn * 10007);
  const pool: WeatherType[] = ['clear', 'clear', 'rain', 'storm', 'snow', 'clear', 'rain'];
  return {
    hour: (prev.hour + 1 + Math.floor(r() * 2)) % 24,
    weather: pool[Math.floor(r() * pool.length)] ?? 'clear',
  };
}

export function handleArmisticeExpiry(state: GameState): GameState {
  const due = state.relations.some(
    r => r.status === 'armistice' && state.turn >= r.armisticeUntilTurn
  );
  if (!due) return state;
  const rels = state.relations.map(r => {
    if (r.status === 'armistice' && state.turn >= r.armisticeUntilTurn) {
      return { ...r, status: 'war' as const, armisticeUntilTurn: 0 };
    }
    return r;
  });
  const next = pruneInvalidTradeRoutes({ ...state, relations: rels });
  return addMessage(next, 'An armistice has expired — war resumes between former ceasefire partners.', 'diplomacy');
}

export function calcEra(researchedTechs: string[]): Era {
  const eras: Era[] = ['ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern', 'atomic', 'information'];
  let highestEra: Era = 'ancient';
  for (const techId of researchedTechs) {
    const tech = TECHNOLOGIES[techId];
    if (!tech) continue;
    const ei = eras.indexOf(tech.era);
    if (ei > eras.indexOf(highestEra)) highestEra = tech.era;
  }
  return highestEra;
}

export function calcCityHappiness(state: GameState, city: City): number {
  let h = 2;
  if (city.buildings.includes('colosseum')) h += 5;
  if (city.buildings.includes('entertainment_complex')) h += 6;
  if (state.systems.wonderOwners.hanging_gardens?.civIndex === city.owner) h += 4;
  const lux = new Set<string>();
  for (const wt of city.workedTiles) {
    const t = state.tiles[wt.r]?.[wt.q];
    if (t?.resource) {
      const nr = NATURAL_RESOURCES[t.resource];
      if (nr?.type === 'luxury') lux.add(t.resource);
    }
  }
  h += lux.size * 4;
  let maxWarTurns = 0;
  let engaged = false;
  for (const rel of state.relations) {
    if (rel.civA !== city.owner && rel.civB !== city.owner) continue;
    if (rel.status === 'war' || rel.status === 'armistice') {
      engaged = true;
      if (rel.status === 'war') maxWarTurns = Math.max(maxWarTurns, rel.turnsAtWar);
    }
  }
  if (engaged) h -= 10;
  if (maxWarTurns > 10) h -= Math.min(8, Math.floor((maxWarTurns - 10) / 5));
  let am = 0;
  for (const b of city.buildings) am += BUILDINGS[b]?.amenities ?? 0;
  if (am >= 8) h += 3;
  return Math.max(-50, Math.min(50, h));
}

export function calcCityHousing(city: City): number {
  let h = 2 + city.population;
  if (city.buildings.includes('granary')) h += 2;
  if (city.buildings.includes('aqueduct')) h += 3;
  if (city.buildings.includes('palace') && city.isCapital) h += 2;
  if (city.buildings.includes('colosseum')) h += 1;
  if (city.buildings.includes('entertainment_complex')) h += 1;
  return h;
}

export function governmentAndPolicyYields(civ: Civilization): Partial<YieldMap> {
  const gov = GOVERNMENTS[civ.governmentId] ?? GOVERNMENTS.chiefdom;
  const out: Partial<YieldMap> = { ...gov.yields };
  for (const pid of civ.slottedPolicyIds ?? []) {
    const p = POLICY_CARDS[pid];
    if (!p?.yields) continue;
    for (const k of Object.keys(p.yields) as Array<keyof YieldMap>) {
      out[k] = (out[k] ?? 0) + (p.yields[k] ?? 0);
    }
  }
  return out;
}

export function atPeaceWithAllAlive(state: GameState, civIndex: number): boolean {
  for (let j = 0; j < state.civilizations.length; j++) {
    if (j === civIndex) continue;
    if (!state.civilizations[j]!.isAlive) continue;
    if (isMilitarilyEngaged(state, civIndex, j)) return false;
  }
  return true;
}

export function processSpaceRaceForCiv(
  state: GameState,
  civIndex: number,
  cities: City[],
  civ: Civilization,
  spaceRaceIn?: GameState['systems']['spaceRace']
): { spaceRace: GameState['systems']['spaceRace']; scienceVictoryProgress: number } {
  const sysSr = { ...(spaceRaceIn ?? state.systems.spaceRace) };
  const spacePorts = cities.filter(c => c.owner === civIndex && c.buildings.includes('space_port'));
  let sr = sysSr[civIndex] ?? {
    stage: 'none' as const,
    progressProduction: 0,
    stageCost: SPACE_RACE_STAGE_COSTS.satellite,
  };
  const techs = civ.researchedTechs;

  if (sr.stage === 'complete') {
    sysSr[civIndex] = sr;
    return { spaceRace: sysSr, scienceVictoryProgress: 100 };
  }
  if (spacePorts.length === 0 || !techs.includes('rocketry')) {
    sysSr[civIndex] = sr;
    const progPct =
      sr.stage === 'satellite'
        ? Math.min(33, (sr.progressProduction / Math.max(1, sr.stageCost)) * 33)
        : sr.stage === 'moon'
          ? 33 + Math.min(33, (sr.progressProduction / Math.max(1, sr.stageCost)) * 33)
          : sr.stage === 'mars'
            ? 66 + Math.min(34, (sr.progressProduction / Math.max(1, sr.stageCost)) * 34)
            : 0;
    return { spaceRace: sysSr, scienceVictoryProgress: progPct };
  }

  if (sr.stage === 'none') {
    sr = { stage: 'satellite', progressProduction: 0, stageCost: SPACE_RACE_STAGE_COSTS.satellite };
  }

  let engBonus = 0;
  for (const city of cities) {
    if (city.owner !== civIndex) continue;
    for (const gid of city.greatWorkIds) {
      const gw = state.systems.greatWorks.find(x => x.id === gid);
      const gp = gw?.creatorGreatPersonId;
      if (gp && GREAT_PEOPLE[gp]?.spaceProjectProductionBonus) {
        engBonus += GREAT_PEOPLE[gp].spaceProjectProductionBonus ?? 0;
      }
    }
  }

  const prod = spacePorts.reduce((a, c) => a + (c.yields.production ?? 0), 0);
  const effective = Math.floor(prod * (1 + engBonus));
  sr = { ...sr, progressProduction: sr.progressProduction + effective };

  while (true) {
    if (sr.stage === 'satellite') {
      if (sr.progressProduction < sr.stageCost) break;
      sr.progressProduction -= sr.stageCost;
      sr = { stage: 'moon', progressProduction: sr.progressProduction, stageCost: SPACE_RACE_STAGE_COSTS.moon };
      continue;
    }
    if (sr.stage === 'moon') {
      if (!techs.includes('satellites')) break;
      if (sr.progressProduction < sr.stageCost) break;
      sr.progressProduction -= sr.stageCost;
      sr = { stage: 'mars', progressProduction: sr.progressProduction, stageCost: SPACE_RACE_STAGE_COSTS.mars };
      continue;
    }
    if (sr.stage === 'mars') {
      if (!techs.includes('nanotechnology')) break;
      if (sr.progressProduction < sr.stageCost) break;
      sr = { stage: 'complete', progressProduction: sr.stageCost, stageCost: SPACE_RACE_STAGE_COSTS.mars };
      break;
    }
    break;
  }

  let progPct = 0;
  if (sr.stage === 'satellite') progPct = Math.min(33, (sr.progressProduction / Math.max(1, sr.stageCost)) * 33);
  else if (sr.stage === 'moon') progPct = 33 + Math.min(33, (sr.progressProduction / Math.max(1, sr.stageCost)) * 33);
  else if (sr.stage === 'mars') progPct = 66 + Math.min(34, (sr.progressProduction / Math.max(1, sr.stageCost)) * 34);
  else if (sr.stage === 'complete') progPct = 100;

  sysSr[civIndex] = sr;
  return { spaceRace: sysSr, scienceVictoryProgress: progPct };
}

export function effectiveTradeGoldForCiv(state: GameState, civIndex: number): number {
  let totalGold = 0;
  for (const tr of state.tradeRoutes ?? []) {
    if (tr.civA !== civIndex && tr.civB !== civIndex) continue;
    const rel = relationPair(state.relations, tr.civA, tr.civB);
    if (rel && (rel.status === 'peace' || rel.status === 'alliance')) {
      const trustMult = 1 + Math.max(-0.2, Math.min(0.25, (rel.trust ?? 0) / 220));
      const riskMult = 1 - Math.max(0, Math.min(0.75, tr.risk ?? 0));
      totalGold += Math.round(tr.goldPerTurn * trustMult * riskMult);
    }
  }
  return totalGold;
}

export function relationFavorDeltaForCiv(state: GameState, civIndex: number): number {
  let dipFav = 0;
  for (const rel of state.relations) {
    if (rel.civA !== civIndex && rel.civB !== civIndex) continue;
    if (rel.status === 'alliance') dipFav += 2;
  }
  for (const tr of state.tradeRoutes ?? []) {
    if (tr.civA !== civIndex && tr.civB !== civIndex) continue;
    const rel = relationPair(state.relations, tr.civA, tr.civB);
    if (rel && (rel.status === 'peace' || rel.status === 'alliance')) dipFav += 2;
  }
  return dipFav;
}

export function normalizeRouteRiskByRelations(state: GameState): GameState {
  return {
    ...state,
    tradeRoutes: (state.tradeRoutes ?? []).map(tr => ({
      ...tr,
      turnsEstablished: tr.turnsEstablished + 1,
      risk: Math.max(
        0.02,
        Math.min(
          0.9,
          (tr.risk ?? 0.1) +
            (((relationPair(state.relations, tr.civA, tr.civB)?.grievances ?? 0) / 1000) -
              ((relationPair(state.relations, tr.civA, tr.civB)?.trust ?? 0) / 1400))
        )
      ),
    })),
  };
}

export function decayTradeAgreements(state: GameState): GameState {
  return {
    ...state,
    tradeAgreements: (state.tradeAgreements ?? [])
      .map(ag => ({ ...ag, turnsLeft: ag.turnsLeft - 1 }))
      .filter(ag => ag.turnsLeft > 0),
  };
}

export function updateRelationDriftPerTurn(state: GameState): GameState {
  return {
    ...state,
    relations: state.relations.map(r => {
      if (r.status === 'war') {
        return {
          ...r,
          turnsAtWar: r.turnsAtWar + 1,
          trust: Math.max(-100, (r.trust ?? 0) - 1),
          grievances: Math.min(120, (r.grievances ?? 0) + 1),
        };
      }
      return {
        ...r,
        trust: Math.min(100, (r.trust ?? 0) + (r.status === 'alliance' ? 1.1 : 0.35)),
        grievances: Math.max(0, (r.grievances ?? 0) - 0.6),
      };
    }),
  };
}

export function isSpaceVictoryDoneFor(civ: Civilization): boolean {
  return civ.scienceVictoryProgress >= 100;
}

export function religiousVictoryCandidate(state: GameState): number | null {
  for (let i = 0; i < state.civilizations.length; i++) {
    const civ = state.civilizations[i]!;
    if (!civ.isAlive || civ.religionIndex == null) continue;
    const ri = civ.religionIndex;
    let total = 0;
    let match = 0;
    for (let j = 0; j < state.civilizations.length; j++) {
      if (i === j || !state.civilizations[j]!.isAlive) continue;
      const cities = state.cities.filter(ct => ct.owner === j);
      total += cities.length;
      match += cities.filter(ct => ct.majorityReligionIndex === ri).length;
    }
    if (total > 0 && match / total > 0.5) return i;
  }
  return null;
}

export function wonderCountFor(state: GameState, civIndex: number): number {
  return Object.values(state.systems.wonderOwners).filter((o): o is { civIndex: number; cityId: number; turnBuilt: number } => !!o).filter(o => o.civIndex === civIndex).length;
}

export function districtishBuildingCount(cities: City[], civIndex: number): number {
  return cities.filter(c => c.owner === civIndex).reduce((a, c) => a + c.buildings.length, 0);
}

export function foreignReligionCityCount(state: GameState, civIndex: number): number {
  const civ = state.civilizations[civIndex]!;
  return state.cities.filter(
    c =>
      c.owner !== civIndex &&
      civ.religionIndex != null &&
      c.majorityReligionIndex === civ.religionIndex
  ).length;
}

export function cityIndustryBuildingCount(cities: City[], civIndex: number): number {
  return cities
    .filter(c => c.owner === civIndex)
    .reduce(
      (sum, c) =>
        sum +
        (c.buildings.includes('workshop') ? 1 : 0) +
        (c.buildings.includes('factory') ? 1 : 0) +
        (c.buildings.includes('power_plant') ? 1 : 0),
      0
    );
}

