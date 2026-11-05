import { describe, expect, it } from 'vitest';
import { version as packageVersion } from '../../package.json';
import { GNOZIAN_RELEASE_VERSION } from './releaseVersion';
import { GNOZIAN_GAME_VERSION } from './gameVersion';

describe('remaster release vs multiplayer protocol version', () => {
  it('shows the actual application release version', () => {
    expect(GNOZIAN_RELEASE_VERSION).toBe(packageVersion);
    expect(GNOZIAN_RELEASE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
  it('keeps the multiplayer protocol a distinct string contract', () => {
    expect(GNOZIAN_GAME_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
