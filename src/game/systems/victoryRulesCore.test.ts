import { describe, expect, it } from 'vitest';
import { isVictoryTypeUnlockedForAge } from './victoryRulesCore';

describe('victoryRulesCore', () => {
  it('keeps domination unlocked in all ages', () => {
    expect(isVictoryTypeUnlockedForAge('antiquity', 'domination')).toBe(true);
    expect(isVictoryTypeUnlockedForAge('exploration', 'domination')).toBe(true);
    expect(isVictoryTypeUnlockedForAge('modern', 'domination')).toBe(true);
  });

  it('locks and unlocks age-gated victories correctly', () => {
    expect(isVictoryTypeUnlockedForAge('antiquity', 'science')).toBe(false);
    expect(isVictoryTypeUnlockedForAge('exploration', 'science')).toBe(false);
    expect(isVictoryTypeUnlockedForAge('modern', 'science')).toBe(true);

    expect(isVictoryTypeUnlockedForAge('antiquity', 'culture')).toBe(false);
    expect(isVictoryTypeUnlockedForAge('exploration', 'culture')).toBe(true);
    expect(isVictoryTypeUnlockedForAge('modern', 'diplomacy')).toBe(true);
  });
});

