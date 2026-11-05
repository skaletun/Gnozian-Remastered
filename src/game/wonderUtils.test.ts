import { describe, expect, it } from 'vitest';
import { wonderIdsForCity } from './wonderUtils';

describe('wonderIdsForCity', () => {
  it('collects wonders whose cityId matches', () => {
    const owners = {
      great_pyramid: { civIndex: 0, cityId: 7, turnBuilt: 10 },
      oracle: { civIndex: 1, cityId: 3, turnBuilt: 20 },
    };
    expect(wonderIdsForCity(owners, 7).sort()).toEqual(['great_pyramid']);
    expect(wonderIdsForCity(owners, 3).sort()).toEqual(['oracle']);
    expect(wonderIdsForCity(owners, 99)).toEqual([]);
  });
});
