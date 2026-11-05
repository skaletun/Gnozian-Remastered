import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import {
  allocateLeaderAttributePoint,
  autoAllocateLeaderAttributesForAi,
  leaderYieldBonuses,
  onAgeTransitionLeaderProgress,
} from './leaderCore';

function stubState(): GameState {
  return {
    civilizations: [
      {
        id: 0,
        leader: 'Human Leader',
        isAlive: true,
        isHuman: true,
        units: [],
        score: 0,
        resources: { gold: 0, science: 0, culture: 0, production: 0, food: 0, faith: 0, happiness: 0 },
        researchedTechs: [],
        researchedCivics: [],
        diplomaticFavor: 0,
        diplomaticVictoryPoints: 0,
      },
      {
        id: 1,
        leader: 'AI Leader',
        isAlive: true,
        isHuman: false,
        units: [{ id: 1001 }],
        score: 120,
        resources: { gold: 22, science: 4, culture: 2, production: 10, food: 0, faith: 0, happiness: 0 },
        researchedTechs: ['pottery'],
        researchedCivics: ['code_of_laws'],
        diplomaticFavor: 1,
        diplomaticVictoryPoints: 0,
      },
    ],
    leaders: [
      {
        id: 'l0',
        civIndex: 0,
        displayName: 'Human Leader',
        persistentXp: 0,
        unspentAttributePoints: 0,
        attributes: { military: 0, science: 0, culture: 0, economy: 0, diplomacy: 0 },
        activeMementos: [],
      },
      {
        id: 'l1',
        civIndex: 1,
        displayName: 'AI Leader',
        persistentXp: 0,
        unspentAttributePoints: 0,
        attributes: { military: 0, science: 0, culture: 0, economy: 0, diplomacy: 0 },
        activeMementos: [],
      },
    ],
  } as unknown as GameState;
}

describe('leaderCore allocation pipeline', () => {
  it('adds unspent points on age transition without auto-spending', () => {
    const s = onAgeTransitionLeaderProgress(stubState());
    expect(s.leaders?.[0]?.unspentAttributePoints).toBe(1);
    expect(s.leaders?.[1]?.unspentAttributePoints).toBe(1);
    expect(s.leaders?.[0]?.attributes.economy).toBe(0);
    expect(s.leaders?.[1]?.attributes.military).toBe(0);
  });

  it('spends one selected point through explicit allocation', () => {
    const progressed = onAgeTransitionLeaderProgress(stubState());
    const spent = allocateLeaderAttributePoint(progressed, 0, 'science');
    expect(spent.leaders?.[0]?.unspentAttributePoints).toBe(0);
    expect(spent.leaders?.[0]?.attributes.science).toBe(1);
  });

  it('auto-allocates remaining points only for AI leaders', () => {
    const progressed = onAgeTransitionLeaderProgress(stubState());
    const auto = autoAllocateLeaderAttributesForAi(progressed);
    expect(auto.leaders?.[0]?.unspentAttributePoints).toBe(1);
    expect(auto.leaders?.[1]?.unspentAttributePoints).toBe(0);
  });

  it('applies active memento bonuses on top of attribute bonuses', () => {
    const state = stubState();
    if (state.leaders?.[0]) {
      state.leaders[0].activeMementos = ['scholar_tablet', 'merchant_seal'];
    }
    const bonus = leaderYieldBonuses(state, 0);
    expect(bonus.science).toBe(2);
    expect(bonus.gold).toBe(2);
  });
});

