import type { GameState } from '../types';

type JsonLike = null | boolean | number | string | JsonLike[] | { [k: string]: JsonLike };

function normalizeJsonValue(value: unknown): JsonLike {
  if (value == null) return null;
  const t = typeof value;
  if (t === 'boolean') return value as boolean;
  if (t === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) return null;
    if (Object.is(n, -0)) return 0;
    return n;
  }
  if (t === 'string') return value as string;
  if (Array.isArray(value)) return value.map(v => normalizeJsonValue(v));
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, JsonLike> = {};
    const keys = Object.keys(obj).sort();
    for (const k of keys) out[k] = normalizeJsonValue(obj[k]);
    return out;
  }
  return null;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeJsonValue(value));
}

function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function computeStateHash(state: GameState): string {
  return fnv1a32(stableStringify(state));
}

