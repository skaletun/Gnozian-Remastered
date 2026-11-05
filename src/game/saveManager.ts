// Game Save/Load system with validation and versioning

import LZString from 'lz-string';
import type { GameState } from './types';
import { STATE_CONTRACT_VERSION, validateStateContractShape } from './kernel/stateContract';

export interface SaveData {
  version: number;
  /**
   * Snapshot of the runtime state contract version used to write the file.
   * Aligns with `STATE_CONTRACT_VERSION` so loaders can run the right migrations.
   */
  stateContractVersion: number;
  timestamp: string;
  gameState: GameState;
  metadata: {
    turnCount: number;
    civilizationName: string;
    mapSize: string;
    difficulty: string;
    playTime: number; // in seconds
    /** Player display name at save time (menu profile / nickname). */
    playerDisplayName?: string;
  };
}

export const SAVE_VERSION = 2;
const MAX_SAVES = 10;

/** Player civilization for UI/metadata — never use `settings.humanCivIndex` as an array index (that is the menu template index). */
export function civilizationNameFromGameState(gameState: GameState): string {
  const human = gameState.civilizations.find(c => c.isHuman) ?? gameState.civilizations[0];
  return human?.name ?? 'Unknown';
}

/** Prefer embedded `gameState` (source of truth) over `metadata.civilizationName` (older saves may have wrong metadata). */
export function displayCivilizationNameForSave(save: SaveData): string {
  const list = save.gameState?.civilizations;
  if (Array.isArray(list) && list.length > 0) {
    return civilizationNameFromGameState(save.gameState);
  }
  return save.metadata.civilizationName;
}

/** Prefix for LZ-compressed JSON (base64-safe). Legacy saves are raw JSON starting with `{`. */
const SAVE_LZ_PREFIX = 'G1:';

function isQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.code === 22 ||
    error.code === 1014
  );
}

export function createSaveData(
  gameState: GameState,
  playTime: number,
  opts?: { playerDisplayName?: string }
): SaveData {
  const nick =
    (opts?.playerDisplayName ?? gameState.settings.humanNickname ?? '').trim().slice(0, 48) || undefined;
  return {
    version: SAVE_VERSION,
    stateContractVersion: STATE_CONTRACT_VERSION,
    timestamp: new Date().toISOString(),
    gameState,
    metadata: {
      turnCount: gameState.turn,
      civilizationName: civilizationNameFromGameState(gameState),
      mapSize: `${gameState.settings.mapWidth}×${gameState.settings.mapHeight}`,
      difficulty: gameState.settings.difficulty,
      playTime,
      ...(nick ? { playerDisplayName: nick } : {}),
    },
  };
}

export function validateSaveData(data: unknown): data is SaveData {
  if (!data || typeof data !== 'object') return false;

  const save = data as Partial<SaveData> & { gameState?: unknown; metadata?: unknown };
  if (typeof save.version !== 'number') return false;
  if (typeof save.timestamp !== 'string') return false;
  if (!save.gameState || typeof save.gameState !== 'object') return false;
  if (!save.metadata || typeof save.metadata !== 'object') return false;
  // Older saves may lack the contract version; treat as version 1.
  if (!validateStateContractShape(save.gameState)) return false;
  return true;
}

export class SaveManager {
  private prefix = 'gnozian_save_';
  private maxSaves = MAX_SAVES;

  private storageKey(slot: number): string {
    return `${this.prefix}${slot}`;
  }

  private compressPayload(json: string): string {
    return SAVE_LZ_PREFIX + LZString.compressToBase64(json);
  }

  /** Parse save from storage string (plain JSON or compressed). */
  private parseStored(raw: string): SaveData | null {
    try {
      let parsed: unknown;
      if (raw.startsWith(SAVE_LZ_PREFIX)) {
        const decoded = LZString.decompressFromBase64(raw.slice(SAVE_LZ_PREFIX.length));
        if (!decoded) return null;
        parsed = JSON.parse(decoded) as unknown;
      } else {
        parsed = JSON.parse(raw) as unknown;
      }
      if (!validateSaveData(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Delete the oldest save slot other than `exceptSlot` (by `timestamp`).
   * Corrupt entries in other slots are removed and skipped.
   * @returns false if there was nothing removable.
   */
  private deleteOldestOtherThan(exceptSlot: number): boolean {
    let oldest: { slot: number; time: number } | null = null;
    for (let i = 0; i < this.maxSaves; i++) {
      if (i === exceptSlot) continue;
      const raw = localStorage.getItem(this.storageKey(i));
      if (!raw) continue;
      const save = this.parseStored(raw);
      if (!save) {
        try {
          localStorage.removeItem(this.storageKey(i));
        } catch {
          /* */
        }
        continue;
      }
      const t = new Date(save.timestamp).getTime();
      if (!oldest || t < oldest.time) oldest = { slot: i, time: t };
    }
    if (!oldest) return false;
    try {
      localStorage.removeItem(this.storageKey(oldest.slot));
    } catch {
      return false;
    }
    return true;
  }

  /**
   * Whether a slot has any stored string (cheap; does not parse).
   */
  hasSlotRawEntry(slot: number): boolean {
    try {
      if (slot < 0 || slot >= this.maxSaves) return false;
      return !!localStorage.getItem(this.storageKey(slot));
    } catch {
      return false;
    }
  }

  /**
   * Latest save by `metadata` timestamp — at most one full parse per occupied slot.
   * Prefer this over getLatestSave + getLatestSaveSlot (which used to parse many times).
   */
  resolveLatestSave(): { slot: number; save: SaveData } | null {
    let best: { slot: number; time: number; save: SaveData } | null = null;
    for (let i = 0; i < this.maxSaves; i++) {
      let raw: string | null;
      try {
        raw = localStorage.getItem(this.storageKey(i));
      } catch {
        continue;
      }
      if (!raw) continue;
      const save = this.parseStored(raw);
      if (!save) continue;
      const t = new Date(save.timestamp).getTime();
      if (!best || t > best.time) best = { slot: i, time: t, save };
    }
    return best ? { slot: best.slot, save: best.save } : null;
  }

  /**
   * Save game state to localStorage.
   * Fast path: plain JSON only (LZ is expensive on multi‑MB saves and blocked the UI).
   * If quota is exceeded, compresses and retries, then may delete older saves in other slots.
   */
  saveGame(slot: number, save: SaveData): boolean {
    try {
      if (slot < 0 || slot >= this.maxSaves) {
        throw new Error(`Invalid save slot: ${slot}`);
      }

      const key = this.storageKey(slot);
      const json = JSON.stringify(save);

      const tryWrite = (payload: string): 'ok' | 'quota' | 'fatal' => {
        try {
          localStorage.setItem(key, payload);
          return 'ok';
        } catch (error) {
          if (isQuotaExceeded(error)) return 'quota';
          console.error('Failed to save game:', error);
          return 'fatal';
        }
      };

      let r = tryWrite(json);
      if (r === 'ok') return true;
      if (r === 'fatal') return false;

      let compressed: string;
      try {
        compressed = this.compressPayload(json);
      } catch (e) {
        console.error('Failed to compress save:', e);
        return false;
      }

      r = tryWrite(compressed);
      if (r === 'ok') return true;
      if (r === 'fatal') return false;

      for (let round = 0; round < this.maxSaves; round++) {
        if (!this.deleteOldestOtherThan(slot)) break;
        r = tryWrite(json);
        if (r === 'ok') return true;
        if (r === 'fatal') return false;
        r = tryWrite(compressed);
        if (r === 'ok') return true;
        if (r === 'fatal') return false;
      }

      console.error('Failed to save game: storage quota exceeded after eviction attempts');
      return false;
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  }

  /**
   * Load game from localStorage
   */
  loadGame(slot: number): SaveData | null {
    try {
      if (slot < 0 || slot >= this.maxSaves) {
        throw new Error(`Invalid save slot: ${slot}`);
      }

      const key = this.storageKey(slot);
      const data = localStorage.getItem(key);
      if (!data) return null;

      const parsed = this.parseStored(data);
      if (!parsed) {
        throw new Error('Invalid save data format');
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load game:', error);
      return null;
    }
  }

  /**
   * Delete a save
   */
  deleteSave(slot: number): boolean {
    try {
      if (slot < 0 || slot >= this.maxSaves) {
        throw new Error(`Invalid save slot: ${slot}`);
      }

      const key = this.storageKey(slot);
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to delete save:', error);
      return false;
    }
  }

  /**
   * Get all saves
   */
  getAllSaves(): (SaveData | null)[] {
    return Array.from({ length: this.maxSaves }, (_, i) => this.loadGame(i));
  }

  /**
   * Get save info without full data
   */
  getSaveInfo(slot: number): SaveData['metadata'] | null {
    const save = this.loadGame(slot);
    return save ? save.metadata : null;
  }

  /**
   * Get most recent save
   */
  getLatestSave(): SaveData | null {
    return this.resolveLatestSave()?.save ?? null;
  }

  /** Slot index of the most recently timestamped save, or null if none. */
  getLatestSaveSlot(): number | null {
    return this.resolveLatestSave()?.slot ?? null;
  }

  /**
   * Check if save exists
   */
  hasSave(slot: number): boolean {
    return this.loadGame(slot) !== null;
  }

  /**
   * Count saves
   */
  countSaves(): number {
    let c = 0;
    for (let i = 0; i < this.maxSaves; i++) {
      try {
        if (localStorage.getItem(this.storageKey(i))) c++;
      } catch {
        /* */
      }
    }
    return c;
  }

  /**
   * Clear all saves
   */
  clearAllSaves(): boolean {
    try {
      for (let i = 0; i < this.maxSaves; i++) {
        this.deleteSave(i);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear saves:', error);
      return false;
    }
  }
}

// Export singleton instance
export const saveManager = new SaveManager();

/**
 * Format save date for display
 */
export function formatSaveDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return 'Unknown date';
  }
}

/**
 * Format play time
 */
export function formatPlayTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
