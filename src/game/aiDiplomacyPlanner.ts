import type { GameState, ResourceType, TradeLot } from './types';
import { MAX_TRADE_ROUTES_PER_PAIR } from './constants';
import { computeMilitaryPower, minCityDistance, relationForPair } from './aiMetrics';
import type { AIPersonality, AIStrategicPosture } from './aiStrategy';

const LOT_AI_RESOURCES: ResourceType[] = ['food', 'production', 'science', 'culture', 'faith', 'happiness'];
const LOT_BASE_PRICE: Record<ResourceType, number> = {
  food: 2,
  production: 3,
  gold: 1,
  science: 4,
  culture: 4,
  faith: 3,
  happiness: 5,
};

export function resourceNeedScore(civ: GameState['civilizations'][0], resource: ResourceType): number {
  const value = civ.resources[resource] ?? 0;
  switch (resource) {
    case 'food':
      return value < 25 ? 1 : value < 55 ? 0.6 : 0.25;
    case 'production':
      return value < 18 ? 1 : value < 42 ? 0.65 : 0.3;
    case 'science':
      return value < 22 ? 1 : value < 48 ? 0.7 : 0.3;
    case 'culture':
      return value < 18 ? 1 : value < 44 ? 0.65 : 0.3;
    case 'faith':
      return value < 14 ? 0.8 : value < 40 ? 0.55 : 0.25;
    case 'happiness':
      return value < 10 ? 1 : value < 24 ? 0.7 : 0.35;
    default:
      return 0.4;
  }
}

function resourceSurplus(civ: GameState['civilizations'][0], resource: ResourceType): number {
  const need = resourceNeedScore(civ, resource);
  const stock = civ.resources[resource] ?? 0;
  const reserve = Math.round(18 + need * 20);
  return Math.max(0, stock - reserve);
}

function pickLotsForDirection(
  seller: GameState['civilizations'][0],
  buyer: GameState['civilizations'][0],
  maxLots: number,
  rng: () => number
): TradeLot[] {
  const scored = LOT_AI_RESOURCES
    .map(resource => {
      const surplus = resourceSurplus(seller, resource);
      const buyerNeed = resourceNeedScore(buyer, resource);
      if (surplus <= 0 || buyerNeed < 0.45) return null;
      return { resource, score: surplus * buyerNeed * LOT_BASE_PRICE[resource] + rng() * 2 };
    })
    .filter((x): x is { resource: ResourceType; score: number } => x != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLots);

  const lots: TradeLot[] = [];
  for (const candidate of scored) {
    const surplus = resourceSurplus(seller, candidate.resource);
    const buyerNeed = resourceNeedScore(buyer, candidate.resource);
    const amount = Math.max(2, Math.min(22, Math.round(4 + surplus * (0.12 + buyerNeed * 0.12))));
    const priceMode: TradeLot['priceMode'] = rng() < 0.6 ? 'per_unit' : 'one_time';
    const base = LOT_BASE_PRICE[candidate.resource];
    const unitPrice = Math.max(1, Math.round(base * (0.8 + buyerNeed * 0.65)));
    lots.push({ resource: candidate.resource, amount, unitPrice, priceMode });
  }
  return lots;
}

export function estimateLotsScore(
  lotsAtoB: TradeLot[],
  lotsBtoA: TradeLot[],
  civA: GameState['civilizations'][0],
  civB: GameState['civilizations'][0]
): number {
  const valueForA = (lots: TradeLot[]) =>
    lots.reduce(
      (sum, lot) => sum + lot.amount * LOT_BASE_PRICE[lot.resource] * (0.5 + resourceNeedScore(civA, lot.resource) * 0.5),
      0
    );
  const aGets = valueForA(lotsBtoA);
  const aGives = valueForA(lotsAtoB);
  const priceGain =
    lotsAtoB.reduce((sum, lot) => sum + (lot.priceMode === 'per_unit' ? lot.amount * lot.unitPrice : lot.unitPrice), 0) -
    lotsBtoA.reduce((sum, lot) => sum + (lot.priceMode === 'per_unit' ? lot.amount * lot.unitPrice : lot.unitPrice), 0);
  const balanceBias = civA.diplomaticFavor > civB.diplomaticFavor ? 1 : 0.6;
  return aGets - aGives + priceGain * 0.22 * balanceBias;
}

export function buildTradePlan(
  state: GameState,
  civA: number,
  civB: number,
  personality: AIPersonality,
  posture: AIStrategicPosture,
  rng: () => number
): {
  routeOptions: { goldPerTurn: number; risk: number; lotsAtoB: TradeLot[]; lotsBtoA: TradeLot[] };
  dealOptions: {
    goldPerTurnAtoB: number;
    goldPerTurnBtoA: number;
    turnsLeft: number;
    transferAtoB: Partial<Record<'food' | 'science' | 'culture' | 'faith' | 'happiness', number>>;
    transferBtoA: Partial<Record<'food' | 'science' | 'culture' | 'faith' | 'happiness', number>>;
    lotsAtoB: TradeLot[];
    lotsBtoA: TradeLot[];
  };
  routeScore: number;
  dealScore: number;
} {
  const me = state.civilizations[civA]!;
  const them = state.civilizations[civB]!;
  const relation = relationForPair(state, civA, civB);
  const trust = Math.max(-40, Math.min(100, relation?.trust ?? 0));
  const grievances = Math.max(0, relation?.grievances ?? 0);
  const winWinBias = Math.max(0.15, Math.min(0.92, (personality.diplomaticFocus / 100) * 0.65 + posture.skill * 0.35));
  const lotCount = rng() < winWinBias ? 2 : 1;

  const lotsAtoB = pickLotsForDirection(me, them, lotCount, rng);
  const lotsBtoA = rng() < winWinBias ? pickLotsForDirection(them, me, lotCount, rng) : [];

  const lotScore = estimateLotsScore(lotsAtoB, lotsBtoA, me, them);
  const baseline = 3 + Math.max(0, Math.floor(trust / 20)) - Math.floor(grievances / 40);
  const routeGold = Math.max(1, Math.min(16, baseline + (lotScore > 0 ? 1 : 0)));
  const risk = Math.max(0.04, Math.min(0.55, 0.11 + grievances / 240 - trust / 500));

  const aNeedScience = resourceNeedScore(me, 'science');
  const bNeedScience = resourceNeedScore(them, 'science');
  const transferAtoB = { science: Math.max(0, Math.min(8, Math.round(bNeedScience > 0.75 ? 2 : 0))) };
  const transferBtoA = { science: Math.max(0, Math.min(8, Math.round(aNeedScience > 0.75 ? 2 : 0))) };

  const goldPerTurnAtoB = Math.max(0, Math.min(20, Math.round(Math.max(0, -lotScore) / 22)));
  const goldPerTurnBtoA = Math.max(0, Math.min(20, Math.round(Math.max(0, lotScore) / 22)));
  const turnsLeft = Math.max(8, Math.min(50, Math.round(18 + personality.diplomaticFocus * 0.15 + posture.skill * 14)));

  const routeScore = lotScore + trust * 0.07 - grievances * 0.05 + (winWinBias > 0.6 ? 2 : 0);
  const dealScore = routeScore + (goldPerTurnBtoA - goldPerTurnAtoB) * 0.8 + (turnsLeft > 20 ? 1 : 0);

  return {
    routeOptions: { goldPerTurn: routeGold, risk, lotsAtoB, lotsBtoA },
    dealOptions: {
      goldPerTurnAtoB,
      goldPerTurnBtoA,
      turnsLeft,
      transferAtoB,
      transferBtoA,
      lotsAtoB,
      lotsBtoA,
    },
    routeScore,
    dealScore,
  };
}

export function canAddMoreTradeRoutes(state: GameState, civA: number, civB: number): boolean {
  const lo = Math.min(civA, civB);
  const hi = Math.max(civA, civB);
  const routeCount = (state.tradeRoutes ?? []).filter(route => route.civA === lo && route.civB === hi).length;
  return routeCount < MAX_TRADE_ROUTES_PER_PAIR;
}

export function shouldDeclareWar(
  state: GameState,
  civIndex: number,
  targetCiv: number,
  personality: AIPersonality,
  posture: AIStrategicPosture,
  rng: () => number
): boolean {
  const us = computeMilitaryPower(state, civIndex);
  const them = computeMilitaryPower(state, targetCiv);
  const distance = minCityDistance(state, civIndex, targetCiv);
  if (distance > 8 + (1 - posture.skill) * 28) return false;
  const boldness = (personality.aggressiveness / 100) * (0.35 + posture.skill * 0.55);
  const targetBias = posture.targetCiv === targetCiv ? 0.1 : 0;
  const overThreatenedPenalty = posture.threatLevel > 0.65 ? 0.28 : 0;
  const needEdge = 1.03 + (1 - posture.skill) * 0.35 - personality.diplomaticFocus / 400 - targetBias + overThreatenedPenalty;
  if (us < them * needEdge) return false;
  if (posture.victoryFocus !== 'military' && personality.aggressiveness < 55) return false;
  const chance =
    0.002 +
    boldness * 0.014 +
    Math.max(0, posture.skill - 0.35) * 0.02 +
    (posture.targetCiv === targetCiv ? 0.018 : 0) -
    Math.min(0.018, posture.threatLevel * 0.012);
  return rng() < chance;
}
