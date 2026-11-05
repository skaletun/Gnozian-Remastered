import type { VictoryType } from './types';

export type MetaPolicy = 'enabled' | 'disabled';

export interface MementoDefinition {
  id: string;
  name: string;
  description: string;
  unlockLegendLevel: number;
}

export interface MetaProfile {
  version: number;
  legendXp: number;
  legendLevel: number;
  gamesPlayed: number;
  wins: number;
  equippedMementos: string[];
  unlockedMementos: string[];
  mpPolicy: MetaPolicy;
  lastVictoryType: VictoryType | null;
}

export const META_PROFILE_STORAGE_KEY = 'gnozian_meta_profile_v1';
export const META_PROFILE_VERSION = 1;
export const META_MAX_EQUIPPED_MEMENTOS = 3;

const LEGEND_XP_PER_LEVEL = 100;

export const MEMENTO_DEFINITIONS: MementoDefinition[] = [
  {
    id: 'scholar_tablet',
    name: 'Scholar Tablet',
    description: '+2 science from leader legacy aura.',
    unlockLegendLevel: 1,
  },
  {
    id: 'merchant_seal',
    name: 'Merchant Seal',
    description: '+2 gold from leader legacy aura.',
    unlockLegendLevel: 1,
  },
  {
    id: 'war_banner',
    name: 'War Banner',
    description: '+2 production from leader legacy aura.',
    unlockLegendLevel: 2,
  },
  {
    id: 'oracle_reliquary',
    name: 'Oracle Reliquary',
    description: '+2 culture from leader legacy aura.',
    unlockLegendLevel: 2,
  },
  {
    id: 'diplomat_codex',
    name: 'Diplomat Codex',
    description: '+2 happiness from leader legacy aura.',
    unlockLegendLevel: 3,
  },
  {
    id: 'sacred_idol',
    name: 'Sacred Idol',
    description: '+2 faith from leader legacy aura.',
    unlockLegendLevel: 3,
  },
];

function xpToLegendLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / LEGEND_XP_PER_LEVEL) + 1);
}

export function unlockedMementoIdsByLegendLevel(level: number): string[] {
  return MEMENTO_DEFINITIONS
    .filter(m => m.unlockLegendLevel <= Math.max(1, Math.floor(level)))
    .map(m => m.id);
}

export function sanitizeMementoLoadout(loadout: string[], unlocked: string[]): string[] {
  const unlockedSet = new Set(unlocked);
  const unique: string[] = [];
  for (const m of loadout) {
    const id = String(m);
    if (!unlockedSet.has(id)) continue;
    if (unique.includes(id)) continue;
    unique.push(id);
    if (unique.length >= META_MAX_EQUIPPED_MEMENTOS) break;
  }
  return unique;
}

export function createDefaultMetaProfile(): MetaProfile {
  const legendXp = 0;
  const legendLevel = xpToLegendLevel(legendXp);
  const unlocked = unlockedMementoIdsByLegendLevel(legendLevel);
  return {
    version: META_PROFILE_VERSION,
    legendXp,
    legendLevel,
    gamesPlayed: 0,
    wins: 0,
    equippedMementos: [],
    unlockedMementos: unlocked,
    mpPolicy: 'enabled',
    lastVictoryType: null,
  };
}

export function normalizeMetaProfile(raw: unknown): MetaProfile {
  const base = createDefaultMetaProfile();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<MetaProfile>;
  const xp = Math.max(0, Math.floor(Number(obj.legendXp ?? 0)));
  const legendLevel = xpToLegendLevel(xp);
  const unlocked = unlockedMementoIdsByLegendLevel(legendLevel);
  const equipped = sanitizeMementoLoadout(
    Array.isArray(obj.equippedMementos) ? obj.equippedMementos.map(String) : [],
    unlocked
  );
  const mpPolicy: MetaPolicy = obj.mpPolicy === 'disabled' ? 'disabled' : 'enabled';
  return {
    version: META_PROFILE_VERSION,
    legendXp: xp,
    legendLevel,
    gamesPlayed: Math.max(0, Math.floor(Number(obj.gamesPlayed ?? 0))),
    wins: Math.max(0, Math.floor(Number(obj.wins ?? 0))),
    equippedMementos: equipped,
    unlockedMementos: unlocked,
    mpPolicy,
    lastVictoryType:
      obj.lastVictoryType === 'domination' ||
      obj.lastVictoryType === 'science' ||
      obj.lastVictoryType === 'culture' ||
      obj.lastVictoryType === 'religion' ||
      obj.lastVictoryType === 'time' ||
      obj.lastVictoryType === 'diplomacy'
        ? obj.lastVictoryType
        : null,
  };
}

export function loadMetaProfile(): MetaProfile {
  try {
    const raw = localStorage.getItem(META_PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultMetaProfile();
    return normalizeMetaProfile(JSON.parse(raw));
  } catch {
    return createDefaultMetaProfile();
  }
}

export function saveMetaProfile(profile: MetaProfile): void {
  try {
    localStorage.setItem(META_PROFILE_STORAGE_KEY, JSON.stringify(normalizeMetaProfile(profile)));
  } catch {
    // noop
  }
}

export function setMetaLoadout(profile: MetaProfile, loadout: string[]): MetaProfile {
  return {
    ...profile,
    equippedMementos: sanitizeMementoLoadout(loadout, profile.unlockedMementos),
  };
}

export function setMetaPolicy(profile: MetaProfile, policy: MetaPolicy): MetaProfile {
  return {
    ...profile,
    mpPolicy: policy,
  };
}

export function grantMetaProgressForMatch(
  profile: MetaProfile,
  outcome: { won: boolean; victoryType: VictoryType | null; multiplayer: boolean; policy: MetaPolicy }
): MetaProfile {
  if (outcome.multiplayer && outcome.policy === 'disabled') {
    return {
      ...profile,
      gamesPlayed: profile.gamesPlayed + 1,
      wins: outcome.won ? profile.wins + 1 : profile.wins,
      lastVictoryType: outcome.victoryType,
    };
  }
  const winBonus = outcome.won ? 45 : 15;
  const victoryBonus = outcome.victoryType ? 20 : 0;
  const xpGain = winBonus + victoryBonus;
  const nextXp = profile.legendXp + xpGain;
  const nextLevel = xpToLegendLevel(nextXp);
  const unlocked = unlockedMementoIdsByLegendLevel(nextLevel);
  return {
    ...profile,
    legendXp: nextXp,
    legendLevel: nextLevel,
    gamesPlayed: profile.gamesPlayed + 1,
    wins: outcome.won ? profile.wins + 1 : profile.wins,
    unlockedMementos: unlocked,
    equippedMementos: sanitizeMementoLoadout(profile.equippedMementos, unlocked),
    lastVictoryType: outcome.victoryType,
  };
}
