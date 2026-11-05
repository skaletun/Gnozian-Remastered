import { hexDistance } from '../mapgen';
import type {
  City,
  DistrictInstance,
  DistrictType,
  GameState,
  SettlementKind,
  TownSpecialization,
  YieldMap,
} from '../types';

const YIELD_KEYS: Array<keyof YieldMap> = [
  'food',
  'production',
  'gold',
  'science',
  'culture',
  'faith',
  'happiness',
];

function emptyYields(): YieldMap {
  return {
    food: 0,
    production: 0,
    gold: 0,
    science: 0,
    culture: 0,
    faith: 0,
    happiness: 0,
  };
}

export function inferSettlementKind(city: City): SettlementKind {
  if (city.isCapital) return 'capital';
  if (city.settlementKind === 'capital' || city.settlementKind === 'city' || city.settlementKind === 'town') {
    return city.settlementKind;
  }
  return city.population >= 7 || city.buildings.length >= 4 ? 'city' : 'town';
}

function normalizeDistrict(city: City, d: DistrictInstance, idx: number): DistrictInstance {
  return {
    id: d.id || `district-${city.id}-${idx}`,
    kind: d.kind === 'rural' ? 'rural' : 'urban',
    type: normalizeDistrictType(d.type, d.kind),
    q: Number.isFinite(d.q) ? Math.floor(d.q) : city.q,
    r: Number.isFinite(d.r) ? Math.floor(d.r) : city.r,
    level: Math.max(1, Math.floor(Number(d.level ?? 1))),
    specialists: Math.max(0, Math.floor(Number(d.specialists ?? 0))),
    establishedTurn: Math.max(0, Math.floor(Number(d.establishedTurn ?? city.turnFounded ?? 0))),
  };
}

function normalizeDistrictType(raw: DistrictType, kind: DistrictInstance['kind']): DistrictType {
  if (raw === 'urban_center') return 'urban_center';
  if (raw === 'campus') return 'campus';
  if (raw === 'market') return 'market';
  if (raw === 'theater') return 'theater';
  if (raw === 'industrial') return 'industrial';
  if (raw === 'temple') return 'temple';
  if (raw === 'rural_farms') return 'rural_farms';
  if (raw === 'rural_mines') return 'rural_mines';
  return kind === 'rural' ? 'rural_farms' : 'urban_center';
}

function defaultTownSpecialization(city: City): TownSpecialization {
  const hasFaith = city.buildings.includes('temple') || city.buildings.includes('cathedral');
  if (hasFaith) return 'cultural';
  if (city.buildings.includes('market') || city.buildings.includes('bank')) return 'mercantile';
  if (city.buildings.includes('workshop') || city.buildings.includes('factory')) return 'industrial';
  if (city.buildings.includes('library') || city.buildings.includes('university')) return 'scholarly';
  return 'balanced';
}

function hasUrbanCenter(districts: DistrictInstance[]): boolean {
  return districts.some(d => d.type === 'urban_center');
}

export function normalizeSettlement(city: City): City {
  const kind = inferSettlementKind(city);
  const rawDistricts = Array.isArray(city.districts) ? city.districts : [];
  const normalizedDistricts = rawDistricts.map((d, i) => normalizeDistrict(city, d, i));
  if (!hasUrbanCenter(normalizedDistricts)) {
    normalizedDistricts.unshift({
      id: `district-${city.id}-center`,
      kind: 'urban',
      type: 'urban_center',
      q: city.q,
      r: city.r,
      level: 1,
      specialists: 0,
      establishedTurn: Math.max(0, city.turnFounded ?? 0),
    });
  }
  return {
    ...city,
    settlementKind: kind,
    townSpecialization: kind === 'town' ? city.townSpecialization ?? defaultTownSpecialization(city) : null,
    settlementTier: city.settlementTier ?? (kind === 'capital' ? 3 : kind === 'city' ? 2 : 1),
    settlementSoftCapPenalty: Math.max(0, Math.min(0.5, Number(city.settlementSoftCapPenalty ?? 0))),
    districts: normalizedDistricts,
  };
}

export function settlementLimitForCiv(state: GameState, civIndex: number): number {
  const civ = state.civilizations[civIndex];
  if (!civ) return 1;
  const ageBonus = state.age?.currentAge === 'modern' ? 2 : state.age?.currentAge === 'exploration' ? 1 : 0;
  const civicBonus = Math.floor((civ.researchedCivics?.length ?? 0) / 4);
  const techBonus = Math.floor((civ.researchedTechs?.length ?? 0) / 6);
  return Math.max(1, 2 + ageBonus + civicBonus + techBonus);
}

export function settlementSoftCapPenalty(state: GameState, civIndex: number): number {
  const civ = state.civilizations[civIndex];
  if (!civ) return 0;
  const limit = settlementLimitForCiv(state, civIndex);
  const over = Math.max(0, civ.cities.length - limit);
  return Math.min(0.5, over * 0.08);
}

function districtBaseYield(type: DistrictType): Partial<YieldMap> {
  switch (type) {
    case 'campus':
      return { science: 2 };
    case 'market':
      return { gold: 2 };
    case 'theater':
      return { culture: 2 };
    case 'industrial':
      return { production: 2 };
    case 'temple':
      return { faith: 2 };
    case 'rural_farms':
      return { food: 2 };
    case 'rural_mines':
      return { production: 2 };
    case 'urban_center':
    default:
      return { production: 1, gold: 1 };
  }
}

function districtSpecialistYield(type: DistrictType, specialists: number): Partial<YieldMap> {
  if (specialists <= 0) return {};
  switch (type) {
    case 'campus':
      return { science: specialists };
    case 'market':
      return { gold: specialists };
    case 'theater':
      return { culture: specialists };
    case 'industrial':
    case 'rural_mines':
      return { production: specialists };
    case 'temple':
      return { faith: specialists };
    case 'rural_farms':
      return { food: specialists };
    case 'urban_center':
    default:
      return { gold: Math.floor(specialists / 2), production: Math.floor(specialists / 2) };
  }
}

export function districtYieldBonus(city: City): Partial<YieldMap> {
  const districts = city.districts ?? [];
  if (!districts.length) return {};
  const out = emptyYields();
  for (let i = 0; i < districts.length; i++) {
    const d = districts[i]!;
    const base = districtBaseYield(d.type);
    const spec = districtSpecialistYield(d.type, d.specialists);
    for (const k of YIELD_KEYS) {
      out[k] += (base[k] ?? 0) * d.level;
      out[k] += spec[k] ?? 0;
    }
    let sameTypeAdj = 0;
    for (let j = 0; j < districts.length; j++) {
      if (i === j) continue;
      const other = districts[j]!;
      if (hexDistance(d.q, d.r, other.q, other.r) <= 1 && other.type === d.type) sameTypeAdj++;
    }
    if (sameTypeAdj > 0) {
      const adjYield = districtBaseYield(d.type);
      for (const k of YIELD_KEYS) {
        out[k] += Math.floor((adjYield[k] ?? 0) * 0.5 * sameTypeAdj);
      }
    }
  }
  return out;
}

function quarterPairSynergy(a: DistrictType, b: DistrictType): Partial<YieldMap> {
  const x = [a, b].sort().join('|');
  if (x === 'campus|theater') return { science: 1, culture: 1 };
  if (x === 'industrial|market') return { production: 1, gold: 1 };
  if (x === 'rural_farms|urban_center') return { food: 1, happiness: 1 };
  if (x === 'rural_mines|urban_center') return { production: 1, gold: 1 };
  if (x === 'temple|theater') return { culture: 1, faith: 1 };
  return {};
}

function quarterYieldBonus(city: City): Partial<YieldMap> {
  const districts = city.districts ?? [];
  if (districts.length < 2) return {};
  const out = emptyYields();
  for (let i = 0; i < districts.length; i++) {
    const a = districts[i]!;
    for (let j = i + 1; j < districts.length; j++) {
      const b = districts[j]!;
      if (hexDistance(a.q, a.r, b.q, b.r) > 1) continue;
      const bonus = quarterPairSynergy(a.type, b.type);
      for (const k of YIELD_KEYS) {
        out[k] += bonus[k] ?? 0;
      }
    }
  }
  return out;
}

export function applySettlementYieldModel(city: City, rawYields: YieldMap): YieldMap {
  const c = normalizeSettlement(city);
  const y: YieldMap = { ...rawYields };
  const k = c.settlementKind ?? inferSettlementKind(c);
  if (k === 'capital') {
    y.culture += 1;
    y.happiness += 1;
  } else if (k === 'town') {
    y.food = Math.floor(y.food * 1.1);
    y.gold = Math.floor(y.gold * 1.1);
    y.production = Math.floor(y.production * 0.75);
    y.science = Math.floor(y.science * 0.8);
    y.culture = Math.floor(y.culture * 0.85);
    switch (c.townSpecialization ?? 'balanced') {
      case 'agrarian':
        y.food += 2;
        break;
      case 'industrial':
        y.production += 2;
        break;
      case 'mercantile':
        y.gold += 2;
        break;
      case 'scholarly':
        y.science += 1;
        y.culture += 1;
        break;
      case 'cultural':
        y.culture += 2;
        y.faith += 1;
        break;
      case 'balanced':
      default:
        y.happiness += 1;
        break;
    }
  }
  const d = districtYieldBonus(c);
  for (const key of YIELD_KEYS) {
    y[key] += d[key] ?? 0;
  }
  const q = quarterYieldBonus(c);
  for (const key of YIELD_KEYS) {
    y[key] += q[key] ?? 0;
  }
  const penalty = Math.max(0, Math.min(0.5, Number(c.settlementSoftCapPenalty ?? 0)));
  if (penalty > 0) {
    const mult = 1 - penalty;
    y.food = Math.floor(y.food * mult);
    y.production = Math.floor(y.production * mult);
    y.gold = Math.floor(y.gold * mult);
    y.science = Math.floor(y.science * mult);
    y.culture = Math.floor(y.culture * mult);
    y.faith = Math.floor(y.faith * mult);
    y.happiness = Math.floor(y.happiness * mult);
  }
  const growth = c.growthYieldBonuses ?? {};
  y.food += Math.floor(Number(growth.food ?? 0));
  y.production += Math.floor(Number(growth.production ?? 0));
  y.gold += Math.floor(Number(growth.gold ?? 0));
  y.science += Math.floor(Number(growth.science ?? 0));
  y.culture += Math.floor(Number(growth.culture ?? 0));
  y.faith += Math.floor(Number(growth.faith ?? 0));
  y.happiness += Math.floor(Number(growth.happiness ?? 0));
  return y;
}

export function canUpgradeTownToCity(
  state: GameState,
  cityId: number,
  actingCivIndex?: number
): { ok: boolean; reason?: string; cost?: number } {
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return { ok: false, reason: 'city_not_found' };
  if (actingCivIndex != null && city.owner !== actingCivIndex) return { ok: false, reason: 'not_owner' };
  const normalized = normalizeSettlement(city);
  if (normalized.settlementKind !== 'town') return { ok: false, reason: 'not_town' };
  const civ = state.civilizations[city.owner];
  if (!civ?.isAlive) return { ok: false, reason: 'civ_not_alive' };
  if (city.population < 5) return { ok: false, reason: 'population_too_low' };
  const cost = 120 + city.population * 20;
  if ((civ.resources.gold ?? 0) < cost) return { ok: false, reason: 'not_enough_gold', cost };
  return { ok: true, cost };
}

export function districtKindForType(type: DistrictType): DistrictInstance['kind'] {
  if (type === 'rural_farms' || type === 'rural_mines') return 'rural';
  return 'urban';
}

function districtCostBase(type: DistrictType): number {
  switch (type) {
    case 'urban_center':
      return 0;
    case 'campus':
    case 'market':
    case 'theater':
      return 120;
    case 'industrial':
    case 'temple':
      return 140;
    case 'rural_farms':
    case 'rural_mines':
      return 90;
    default:
      return 120;
  }
}

export function districtBuildCost(city: City, type: DistrictType): number {
  const normalized = normalizeSettlement(city);
  const existing = normalized.districts?.length ?? 0;
  return districtCostBase(type) + existing * 35 + Math.max(0, normalized.population - 1) * 8;
}

export function canBuildDistrict(
  state: GameState,
  cityId: number,
  type: DistrictType,
  q: number,
  r: number,
  actingCivIndex?: number
): { ok: boolean; reason?: string; cost?: number } {
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return { ok: false, reason: 'city_not_found' };
  if (actingCivIndex != null && city.owner !== actingCivIndex) return { ok: false, reason: 'not_owner' };
  const civ = state.civilizations[city.owner];
  if (!civ?.isAlive) return { ok: false, reason: 'civ_not_alive' };
  const normalized = normalizeSettlement(city);
  if (normalized.settlementKind === 'town' && districtKindForType(type) === 'urban' && type !== 'urban_center') {
    return { ok: false, reason: 'town_needs_upgrade' };
  }
  const tile = state.tiles[r]?.[q];
  if (!tile) return { ok: false, reason: 'tile_invalid' };
  if (tile.terrain === 'ocean' || tile.terrain === 'mountains') return { ok: false, reason: 'bad_terrain' };
  if (tile.city != null && tile.city !== city.id) return { ok: false, reason: 'occupied_city_tile' };
  if (tile.owner != null && tile.owner !== city.owner) return { ok: false, reason: 'foreign_territory' };
  if (hexDistance(city.q, city.r, q, r) > 3) return { ok: false, reason: 'too_far' };
  const districts = normalized.districts ?? [];
  if (districts.some(d => d.q === q && d.r === r)) return { ok: false, reason: 'district_already_present' };
  if (districts.some(d => d.type === type)) return { ok: false, reason: 'district_type_already_present' };
  const cost = districtBuildCost(normalized, type);
  if ((civ.resources.gold ?? 0) < cost) return { ok: false, reason: 'not_enough_gold', cost };
  const maxDistricts = Math.max(1, normalized.population + (normalized.settlementKind === 'capital' ? 2 : 1));
  if (districts.length >= maxDistricts) return { ok: false, reason: 'district_cap_reached' };
  return { ok: true, cost };
}

export function specialistCapForCity(city: City): number {
  const normalized = normalizeSettlement(city);
  const districts = normalized.districts ?? [];
  const nonCenter = districts.filter(d => d.type !== 'urban_center').length;
  return Math.max(1, Math.floor(normalized.population * 0.6) + nonCenter);
}

export function canAssignDistrictSpecialists(
  state: GameState,
  cityId: number,
  districtId: string,
  specialists: number,
  actingCivIndex?: number
): { ok: boolean; reason?: string } {
  const city = state.cities.find(c => c.id === cityId);
  if (!city) return { ok: false, reason: 'city_not_found' };
  if (actingCivIndex != null && city.owner !== actingCivIndex) return { ok: false, reason: 'not_owner' };
  const normalized = normalizeSettlement(city);
  const district = (normalized.districts ?? []).find(d => d.id === districtId);
  if (!district) return { ok: false, reason: 'district_not_found' };
  const nextSpecialists = Math.max(0, Math.floor(specialists));
  const totalOther = (normalized.districts ?? [])
    .filter(d => d.id !== districtId)
    .reduce((sum, d) => sum + Math.max(0, d.specialists), 0);
  const cap = specialistCapForCity(normalized);
  if (totalOther + nextSpecialists > cap) return { ok: false, reason: 'specialist_cap_reached' };
  return { ok: true };
}

