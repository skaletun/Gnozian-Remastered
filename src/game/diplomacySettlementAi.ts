import type { GameState, DiplomaticOffer } from './types';
import { AI_PERSONALITIES, ARMISTICE_DURATION_TURNS, MAX_SETTLEMENT_GOLD_PER_DIRECTION } from './constants';
import { computeMilitaryPower } from './aiMetrics';

export type AiSettlementDecision =
  | { action: 'accept' }
  | { action: 'reject' }
  | { action: 'counter'; goldLoPaysHi: number; goldHiPaysLo: number; armisticeTurns?: number };

/** Net gold gained by `civ` from the payment matrix (lo/hi canonical). */
function netGoldForCiv(offer: DiplomaticOffer, civ: number): number {
  const { pairLo, pairHi, goldLoPaysHi, goldHiPaysLo } = offer;
  if (civ !== pairLo && civ !== pairHi) return 0;
  if (civ === pairLo) return goldHiPaysLo - goldLoPaysHi;
  return goldLoPaysHi - goldHiPaysLo;
}

/**
 * AI civilization `aiCiv` is the recipient (`offer.toCiv`) deciding on an incoming proposal.
 */
export function decideAiSettlementResponse(state: GameState, offer: DiplomaticOffer, aiCiv: number): AiSettlementDecision {
  if (offer.toCiv !== aiCiv) return { action: 'reject' };

  const fromCiv = offer.fromCiv;
  const p = AI_PERSONALITIES[state.civilizations[aiCiv]?.aiPersonality ?? 'BUILDER'] ?? AI_PERSONALITIES.BUILDER;
  const us = computeMilitaryPower(state, aiCiv);
  const them = computeMilitaryPower(state, fromCiv);
  const winning = us >= them * 0.92;
  const losing = us < them * 0.78;

  const net = netGoldForCiv(offer, aiCiv);
  const kindMult = offer.kind === 'peace' ? 1.15 : 1.0;
  const peaceDesire = (losing ? 38 : winning ? -12 : 8) + p.diplomaticFocus * 0.22;
  const greed = p.economyFocus * 0.18 + p.aggressiveness * 0.12;

  let score = net * 0.42 * kindMult + peaceDesire + (offer.kind === 'peace' && losing ? 22 : 0);
  if (winning && net < -15) score -= 25;
  if (!winning && net > 5) score += 15;

  const acceptThreshold = 12 + greed * 0.08;
  const rejectThreshold = -35 - greed * 0.15;

  if (score >= acceptThreshold) return { action: 'accept' };
  if (score <= rejectThreshold) return { action: 'reject' };

  const bump =
    winning ? Math.round(12 + greed * 0.15) : losing ? Math.round(5 + p.diplomaticFocus * 0.06) : Math.round(8 + greed * 0.1);

  let goldLoPaysHi = offer.goldLoPaysHi;
  let goldHiPaysLo = offer.goldHiPaysLo;

  if (aiCiv === offer.pairHi) {
    goldHiPaysLo = Math.min(MAX_SETTLEMENT_GOLD_PER_DIRECTION, goldHiPaysLo + bump);
  } else {
    goldLoPaysHi = Math.min(MAX_SETTLEMENT_GOLD_PER_DIRECTION, goldLoPaysHi + bump);
  }

  let armisticeTurns = offer.armisticeTurns ?? ARMISTICE_DURATION_TURNS;
  if (offer.kind === 'armistice') {
    armisticeTurns = losing
      ? Math.min(ARMISTICE_DURATION_TURNS + 6, armisticeTurns + 4)
      : Math.max(ARMISTICE_DURATION_TURNS - 2, armisticeTurns - 2);
  }

  return { action: 'counter', goldLoPaysHi, goldHiPaysLo, armisticeTurns };
}
