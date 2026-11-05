import { describe, expect, it } from 'vitest';
import {
  createDefaultMetaProfile,
  grantMetaProgressForMatch,
  sanitizeMementoLoadout,
  unlockedMementoIdsByLegendLevel,
} from './metaProgression';

describe('meta progression', () => {
  it('unlocks first mementos at level one', () => {
    const unlocked = unlockedMementoIdsByLegendLevel(1);
    expect(unlocked).toContain('scholar_tablet');
    expect(unlocked).toContain('merchant_seal');
  });

  it('sanitizes loadout by unlocked ids and limit', () => {
    const unlocked = ['scholar_tablet', 'merchant_seal'];
    const loadout = sanitizeMementoLoadout(
      ['scholar_tablet', 'war_banner', 'merchant_seal', 'merchant_seal'],
      unlocked
    );
    expect(loadout).toEqual(['scholar_tablet', 'merchant_seal']);
  });

  it('awards xp after match and keeps progression deterministic', () => {
    const base = createDefaultMetaProfile();
    const next = grantMetaProgressForMatch(base, {
      won: true,
      victoryType: 'science',
      multiplayer: false,
      policy: 'enabled',
    });
    expect(next.legendXp).toBeGreaterThan(base.legendXp);
    expect(next.gamesPlayed).toBe(base.gamesPlayed + 1);
    expect(next.wins).toBe(base.wins + 1);
  });
});
