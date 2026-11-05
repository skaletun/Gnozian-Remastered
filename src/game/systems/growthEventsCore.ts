import { hexDistance } from '../mapgen';
import type { City, GameState, GrowthEventOptionId, GrowthEventTarget, YieldMap } from '../types';
import { normalizeSettlement } from './settlementCore';

const GROWTH_EVENT_OPTIONS_BY_KIND: Record<'capital' | 'city' | 'town', GrowthEventOptionId[]> = {
  capital: ['urban_investment', 'cultural_rite', 'rural_development'],
  city: ['urban_investment', 'cultural_rite', 'rural_development'],
  town: ['rural_development', 'cultural_rite'],
};

function normalizedGrowthBonuses(city: City): YieldMap {
  const y = city.growthYieldBonuses ?? {};
  return {
    food: Math.max(0, Math.floor(Number(y.food ?? 0))),
    production: Math.max(0, Math.floor(Number(y.production ?? 0))),
    gold: Math.max(0, Math.floor(Number(y.gold ?? 0))),
    science: Math.max(0, Math.floor(Number(y.science ?? 0))),
    culture: Math.max(0, Math.floor(Number(y.culture ?? 0))),
    faith: Math.max(0, Math.floor(Number(y.faith ?? 0))),
    happiness: Math.max(0, Math.floor(Number(y.happiness ?? 0))),
  };
}

function withGrowthBonus(city: City, patch: Partial<YieldMap>): City {
  const b = normalizedGrowthBonuses(city);
  return {
    ...city,
    growthYieldBonuses: {
      food: b.food + (patch.food ?? 0),
      production: b.production + (patch.production ?? 0),
      gold: b.gold + (patch.gold ?? 0),
      science: b.science + (patch.science ?? 0),
      culture: b.culture + (patch.culture ?? 0),
      faith: b.faith + (patch.faith ?? 0),
      happiness: b.happiness + (patch.happiness ?? 0),
    },
  };
}

function buildGrowthEventCandidates(city: City, tiles: GameState['tiles']): GrowthEventTarget[] {
  const settlement = normalizeSettlement(city);
  const out: GrowthEventTarget[] = [];
  const seen = new Set<string>();
  const districts = settlement.districts ?? [];
  const mapH = tiles.length;
  const mapW = tiles[0]?.length ?? 0;
  if (!mapW || !mapH) return out;
  const hasDistrictAt = (q: number, r: number): boolean => districts.some(d => d.q === q && d.r === r);
  const push = (q: number, r: number, kind: 'urban' | 'rural') => {
    const key = `${q},${r},${kind}`;
    if (seen.has(key)) return;
    if (q < 0 || r < 0 || q >= mapW || r >= mapH) return;
    const tile = tiles[r]?.[q];
    if (!tile) return;
    if (tile.terrain === 'ocean' || tile.terrain === 'mountains') return;
    if (tile.owner != null && tile.owner !== settlement.owner) return;
    if (hexDistance(settlement.q, settlement.r, q, r) > 3) return;
    if (hasDistrictAt(q, r)) return;
    seen.add(key);
    out.push({ q, r, kind });
  };

  for (const wt of settlement.workedTiles) {
    push(wt.q, wt.r, 'rural');
    push(wt.q, wt.r, 'urban');
  }
  for (let dr = -3; dr <= 3; dr++) {
    for (let dq = -3; dq <= 3; dq++) {
      push(settlement.q + dq, settlement.r + dr, 'rural');
      if (settlement.settlementKind !== 'town') {
        push(settlement.q + dq, settlement.r + dr, 'urban');
      }
    }
  }
  return out;
}

export function createGrowthEvent(
  city: City,
  turn: number,
  tiles: GameState['tiles']
): NonNullable<City['pendingGrowthEvent']> {
  const settlement = normalizeSettlement(city);
  const kind = settlement.settlementKind ?? 'town';
  return {
    id: `growth-${city.id}-${turn}-${city.population}`,
    triggerTurn: turn,
    populationAfterGrowth: city.population,
    options: [...GROWTH_EVENT_OPTIONS_BY_KIND[kind]],
    targetCandidates: buildGrowthEventCandidates(settlement, tiles),
  };
}

function pickGrowthTarget(
  pending: NonNullable<City['pendingGrowthEvent']>,
  preferredKind: 'urban' | 'rural',
  target?: GrowthEventTarget | null
): GrowthEventTarget | null {
  const candidates = pending.targetCandidates ?? [];
  if (target) {
    const exact = candidates.find(c => c.q === target.q && c.r === target.r && c.kind === preferredKind);
    if (exact) return exact;
  }
  return candidates.find(c => c.kind === preferredKind) ?? null;
}

export function applyGrowthChoice(
  city: City,
  choice: GrowthEventOptionId,
  target?: GrowthEventTarget | null
): City {
  let next = normalizeSettlement(city);
  if (!next.pendingGrowthEvent) return next;
  if (!next.pendingGrowthEvent.options.includes(choice)) return next;
  const pending = next.pendingGrowthEvent;
  if (choice === 'rural_development') {
    next = withGrowthBonus(next, { food: 1, gold: 1 });
    const selected = pickGrowthTarget(pending, 'rural', target);
    if (selected && next.districts) {
      const existingIdx = next.districts.findIndex(d => d.q === selected.q && d.r === selected.r);
      const districts = [...next.districts];
      if (existingIdx >= 0) {
        const ex = districts[existingIdx]!;
        districts[existingIdx] = { ...ex, level: ex.level + 1 };
      } else {
        districts.push({
          id: `district-${next.id}-${pending.id}-rural`,
          kind: 'rural',
          type: 'rural_farms',
          q: selected.q,
          r: selected.r,
          level: 1,
          specialists: 0,
          establishedTurn: pending.triggerTurn,
        });
      }
      next = { ...next, districts };
    }
  } else if (choice === 'urban_investment') {
    next = withGrowthBonus(next, { production: 1, science: 1 });
    const selected = pickGrowthTarget(pending, 'urban', target);
    if (selected && next.districts) {
      const districts = [...next.districts];
      const idx = districts.findIndex(d => d.q === selected.q && d.r === selected.r);
      if (idx >= 0) {
        districts[idx] = { ...districts[idx]!, specialists: districts[idx]!.specialists + 1 };
      } else {
        districts.push({
          id: `district-${next.id}-${pending.id}-urban`,
          kind: 'urban',
          type: 'market',
          q: selected.q,
          r: selected.r,
          level: 1,
          specialists: 1,
          establishedTurn: pending.triggerTurn,
        });
      }
      next = { ...next, districts };
    }
  } else if (choice === 'cultural_rite') {
    next = withGrowthBonus(next, { culture: 1, faith: 1, happiness: 1 });
  }
  return {
    ...next,
    pendingGrowthEvent: null,
    growthEventsResolved: Math.max(0, Number(next.growthEventsResolved ?? 0)) + 1,
  };
}

export function selectAiGrowthChoice(state: GameState, city: City): GrowthEventOptionId {
  const pending = city.pendingGrowthEvent;
  if (!pending || pending.options.length === 0) return 'rural_development';
  const civ = state.civilizations[city.owner];
  if (!civ) return pending.options[0]!;
  const food = civ.resources.food ?? 0;
  const prod = civ.resources.production ?? 0;
  const sci = civ.resources.science ?? 0;
  const culture = civ.resources.culture ?? 0;
  if (food < 20 && pending.options.includes('rural_development')) return 'rural_development';
  if ((prod < 25 || sci < 25) && pending.options.includes('urban_investment')) return 'urban_investment';
  if (pending.options.includes('cultural_rite') && culture < 20) return 'cultural_rite';
  return pending.options[0]!;
}

export function selectAiGrowthTarget(
  city: City,
  choice: GrowthEventOptionId
): GrowthEventTarget | null {
  const pending = city.pendingGrowthEvent;
  if (!pending) return null;
  const candidates = pending.targetCandidates ?? [];
  if (choice === 'urban_investment') {
    return candidates.find(c => c.kind === 'urban') ?? null;
  }
  if (choice === 'rural_development') {
    return candidates.find(c => c.kind === 'rural') ?? null;
  }
  return null;
}

export function normalizeCityGrowthState(city: City): City {
  const normalized = normalizeSettlement(city);
  const pending = normalized.pendingGrowthEvent;
  return {
    ...normalized,
    growthYieldBonuses: normalizedGrowthBonuses(normalized),
    pendingGrowthEvent:
      pending && Array.isArray(pending.options) && pending.options.length > 0
        ? {
            id: String(pending.id ?? `growth-${normalized.id}-${normalized.turnFounded}`),
            triggerTurn: Math.max(0, Math.floor(Number(pending.triggerTurn ?? normalized.turnFounded ?? 0))),
            populationAfterGrowth: Math.max(1, Math.floor(Number(pending.populationAfterGrowth ?? normalized.population))),
            options: pending.options.filter(
              o => o === 'rural_development' || o === 'urban_investment' || o === 'cultural_rite'
            ),
            targetCandidates: Array.isArray(pending.targetCandidates)
              ? pending.targetCandidates
                  .map(tc => ({
                    q: Math.floor(Number(tc?.q ?? 0)),
                    r: Math.floor(Number(tc?.r ?? 0)),
                    kind: (tc?.kind === 'urban' ? 'urban' : 'rural') as 'urban' | 'rural',
                  }))
                  .filter(tc => Number.isFinite(tc.q) && Number.isFinite(tc.r))
              : [],
          }
        : null,
    growthEventsResolved: Math.max(0, Math.floor(Number(normalized.growthEventsResolved ?? 0))),
  };
}

