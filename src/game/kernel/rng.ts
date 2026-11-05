export type Rng = () => number;

interface SeedSource {
  settings: { seed: number };
  turn: number;
}

function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash over argument sequence. */
function hashStrings(...parts: Array<string | number>): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = typeof p === 'number' ? p.toString(36) : p;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x5f;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic event-scoped RNG based on (seed, turn, scope, nonce...). */
export function rngForEvent(
  state: SeedSource,
  scope: string,
  ...extra: Array<string | number>
): Rng {
  const seed = hashStrings('gnz', state.settings.seed | 0, state.turn | 0, scope, ...extra);
  return mulberry32(seed);
}

