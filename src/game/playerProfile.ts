export const PLAYER_PROFILE_STORAGE_KEY = 'gnozian_player_profile_v1';
export const LEGACY_NICKNAME_KEY = 'gnozian_player_nickname';

export type PlayerProfile = {
  displayName: string;
  setupComplete: boolean;
  createdAt: string;
};

function safeParse(raw: string | null): PlayerProfile | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<PlayerProfile>;
    if (typeof o.displayName !== 'string' || typeof o.setupComplete !== 'boolean') return null;
    return {
      displayName: o.displayName.trim().slice(0, 32) || 'Player',
      setupComplete: o.setupComplete,
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function loadPlayerProfile(): PlayerProfile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const fromProfile = safeParse(localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY));
    if (fromProfile?.setupComplete) return fromProfile;

    const legacy = localStorage.getItem(LEGACY_NICKNAME_KEY)?.trim().slice(0, 32);

    // Explicit saved profile (incomplete) wins; do not overwrite with legacy migration.
    if (fromProfile) return fromProfile;

    if (legacy) {
      const upgraded: PlayerProfile = {
        displayName: legacy.slice(0, 32) || 'Player',
        setupComplete: false,
        createdAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(upgraded));
      } catch {
        /* */
      }
      return upgraded;
    }

    return null;
  } catch {
    return null;
  }
}

export function isPlayerProfileComplete(): boolean {
  return loadPlayerProfile()?.setupComplete === true;
}

export function savePlayerProfile(displayName: string): void {
  const trimmed = displayName.trim().slice(0, 32) || 'Player';
  const profile: PlayerProfile = {
    displayName: trimmed,
    setupComplete: true,
    createdAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem(LEGACY_NICKNAME_KEY, trimmed);
  } catch {
    /* quota */
  }
}
