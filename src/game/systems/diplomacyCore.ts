import type {
  City,
  Civilization,
  DiplomaticRelation,
  DiplomaticSettlementPayments,
  GameState,
  TradeLot,
} from '../types';

const MAX_SETTLEMENT_GOLD_PER_DIRECTION = 500;
const YIELD_RESOURCES: ReadonlySet<TradeLot['resource']> = new Set([
  'food',
  'production',
  'gold',
  'science',
  'culture',
  'faith',
  'happiness',
]);

export function relationPair(
  relations: DiplomaticRelation[],
  civA: number,
  civB: number
): DiplomaticRelation | undefined {
  return relations.find(
    r => (r.civA === civA && r.civB === civB) || (r.civA === civB && r.civB === civA)
  );
}

export function canDeclareWar(state: GameState, civA: number, civB: number): boolean {
  const r = relationPair(state.relations, civA, civB);
  if (!r) return true;
  if (state.turn < r.peaceLockedUntilTurn) return false;
  if (r.status === 'armistice' && state.turn < r.armisticeUntilTurn) return false;
  return true;
}

export function areAtWar(state: GameState, civA: number, civB: number): boolean {
  const r = relationPair(state.relations, civA, civB);
  return r?.status === 'war';
}

/** War or armistice — borders closed, no combat during armistice. */
export function isMilitarilyEngaged(state: GameState, civA: number, civB: number): boolean {
  const r = relationPair(state.relations, civA, civB);
  return r?.status === 'war' || r?.status === 'armistice';
}

export function getAllies(state: GameState, civIndex: number): number[] {
  const out: number[] = [];
  for (const r of state.relations) {
    if (r.status !== 'alliance') continue;
    if (r.civA === civIndex) out.push(r.civB);
    else if (r.civB === civIndex) out.push(r.civA);
  }
  return out;
}

export function relationIndex(relations: DiplomaticRelation[], lo: number, hi: number): number {
  return relations.findIndex(
    r => (r.civA === lo && r.civB === hi) || (r.civA === hi && r.civB === lo)
  );
}

export function getCapitalCity(state: GameState, civIndex: number): City | null {
  const capId = state.civilizations[civIndex]?.capital;
  if (capId == null) return null;
  return state.cities.find(c => c.id === capId) ?? null;
}

export function clampSettlementGold(n: number | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(MAX_SETTLEMENT_GOLD_PER_DIRECTION, Math.round(n)));
}

function transferGoldOneWay(state: GameState, from: number, to: number, amount: number): GameState | null {
  if (amount <= 0) return state;
  const payer = state.civilizations[from];
  if (!payer) return null;
  if ((payer.resources.gold ?? 0) < amount) return null;
  return {
    ...state,
    civilizations: state.civilizations.map((c, i) => {
      if (i === from) return { ...c, resources: { ...c.resources, gold: (c.resources.gold ?? 0) - amount } };
      if (i === to) return { ...c, resources: { ...c.resources, gold: (c.resources.gold ?? 0) + amount } };
      return c;
    }),
  };
}

export function applyPairGoldTransfer(
  state: GameState,
  lo: number,
  hi: number,
  goldLoPaysHi: number,
  goldHiPaysLo: number
): { state: GameState } | { error: string } {
  let s = state;
  const t1 = transferGoldOneWay(s, lo, hi, goldLoPaysHi);
  if (t1 === null) return { error: 'Cannot pay gold tribute (lower index civ).' };
  s = t1;
  const t2 = transferGoldOneWay(s, hi, lo, goldHiPaysLo);
  if (t2 === null) return { error: 'Cannot pay gold tribute (higher index civ).' };
  return { state: t2 };
}

export function sanitizeTradeLots(lots?: TradeLot[]): TradeLot[] {
  if (!Array.isArray(lots)) return [];
  const out: TradeLot[] = [];
  for (const lot of lots) {
    if (!lot || typeof lot !== 'object') continue;
    const resource = String(lot.resource ?? '') as TradeLot['resource'];
    const amount = Math.max(0, Math.min(9999, Math.round(Number(lot.amount ?? 0))));
    const unitPrice = Math.max(0, Math.min(9999, Math.round(Number(lot.unitPrice ?? 0))));
    const priceMode: TradeLot['priceMode'] = lot.priceMode === 'per_unit' ? 'per_unit' : 'one_time';
    if (!YIELD_RESOURCES.has(resource)) continue;
    if (amount <= 0) continue;
    out.push({ resource, amount, unitPrice, priceMode });
  }
  return out;
}

function lotTotalCost(lot: TradeLot): number {
  return lot.priceMode === 'per_unit' ? lot.amount * lot.unitPrice : lot.unitPrice;
}

function settleOneDirectionLots(
  state: GameState,
  sellerCiv: number,
  buyerCiv: number,
  lots: TradeLot[]
): { ok: true; state: GameState } | { ok: false; error: string } {
  if (!lots.length) return { ok: true, state };
  const seller = state.civilizations[sellerCiv] as Civilization | undefined;
  const buyer = state.civilizations[buyerCiv] as Civilization | undefined;
  if (!seller || !buyer) return { ok: false, error: 'Invalid civilizations in trade lots.' };

  let totalCost = 0;
  for (const lot of lots) {
    if ((seller.resources[lot.resource] ?? 0) < lot.amount) {
      return {
        ok: false,
        error: `${seller.name} lacks ${lot.resource} for lot transfer.`,
      };
    }
    totalCost += lotTotalCost(lot);
  }
  if ((buyer.resources.gold ?? 0) < totalCost) {
    return {
      ok: false,
      error: `${buyer.name} lacks gold to pay lot prices.`,
    };
  }

  const civs = state.civilizations.map(c => ({ ...c, resources: { ...c.resources } }));
  for (const lot of lots) {
    civs[sellerCiv]!.resources[lot.resource] = Math.max(0, (civs[sellerCiv]!.resources[lot.resource] ?? 0) - lot.amount);
    civs[buyerCiv]!.resources[lot.resource] = (civs[buyerCiv]!.resources[lot.resource] ?? 0) + lot.amount;
  }
  civs[buyerCiv]!.resources.gold = Math.max(0, (civs[buyerCiv]!.resources.gold ?? 0) - totalCost);
  civs[sellerCiv]!.resources.gold = (civs[sellerCiv]!.resources.gold ?? 0) + totalCost;
  return { ok: true, state: { ...state, civilizations: civs } };
}

export function settleTradeLotsByCivOrder(
  state: GameState,
  civA: number,
  civB: number,
  lotsAtoB: TradeLot[],
  lotsBtoA: TradeLot[]
): { ok: true; state: GameState } | { ok: false; error: string } {
  const first = settleOneDirectionLots(state, civA, civB, lotsAtoB);
  if (!first.ok) return first;
  return settleOneDirectionLots(first.state, civB, civA, lotsBtoA);
}

export function normalizeSettlementTerms(
  terms: DiplomaticSettlementPayments & { armisticeTurns?: number } | undefined
): DiplomaticSettlementPayments & { armisticeTurns?: number } {
  return {
    goldLoPaysHi: clampSettlementGold(terms?.goldLoPaysHi),
    goldHiPaysLo: clampSettlementGold(terms?.goldHiPaysLo),
    ...(terms?.armisticeTurns != null ? { armisticeTurns: Math.round(terms.armisticeTurns) } : {}),
  };
}

