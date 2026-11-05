import { NATURAL_RESOURCES } from '../constants';
import type { GameState } from '../types';

type SlotCategory = 'bonus' | 'luxury' | 'strategic';

export type ResourceSlotSnapshot = {
  caps: Record<SlotCategory, number>;
  totals: Record<SlotCategory, number>;
  slotted: Record<SlotCategory, number>;
  overflow: Record<SlotCategory, number>;
};

function slotCapsForAge(age: GameState['age']): Record<SlotCategory, number> {
  const a = age?.currentAge ?? 'antiquity';
  if (a === 'modern') return { bonus: 8, luxury: 7, strategic: 7 };
  if (a === 'exploration') return { bonus: 6, luxury: 5, strategic: 5 };
  return { bonus: 4, luxury: 3, strategic: 3 };
}

export function computeResourceSlotSnapshot(state: GameState, civIndex: number): ResourceSlotSnapshot {
  const totals: Record<SlotCategory, number> = { bonus: 0, luxury: 0, strategic: 0 };
  const caps = slotCapsForAge(state.age);
  const h = state.tiles.length;
  const w = state.tiles[0]?.length ?? 0;
  for (let r = 0; r < h; r++) {
    for (let q = 0; q < w; q++) {
      const t = state.tiles[r]?.[q];
      if (!t || t.owner !== civIndex || !t.resource || t.improvement === 'none') continue;
      const res = NATURAL_RESOURCES[t.resource];
      if (!res) continue;
      const key = (res.type === 'bonus' || res.type === 'luxury' || res.type === 'strategic') ? res.type : 'bonus';
      totals[key] += 1;
    }
  }
  const slotted: Record<SlotCategory, number> = {
    bonus: Math.min(caps.bonus, totals.bonus),
    luxury: Math.min(caps.luxury, totals.luxury),
    strategic: Math.min(caps.strategic, totals.strategic),
  };
  const overflow: Record<SlotCategory, number> = {
    bonus: Math.max(0, totals.bonus - slotted.bonus),
    luxury: Math.max(0, totals.luxury - slotted.luxury),
    strategic: Math.max(0, totals.strategic - slotted.strategic),
  };
  return { caps, totals, slotted, overflow };
}

export function applyResourceSlotModifiers(
  state: GameState,
  civIndex: number,
  inc: { food: number; gold: number; science: number; culture: number; faith: number; happiness: number },
  production: number
): { inc: typeof inc; production: number; snapshot: ResourceSlotSnapshot } {
  const snap = computeResourceSlotSnapshot(state, civIndex);
  const out = { ...inc };
  const outProd = production + snap.slotted.strategic;
  out.food += snap.slotted.bonus;
  out.gold += snap.slotted.luxury * 2;
  out.happiness += Math.floor(snap.slotted.luxury / 2);
  out.science += state.age?.currentAge === 'modern' ? Math.floor(snap.slotted.strategic / 2) : 0;
  // Mild penalty for relying on overflow stockpiles.
  out.happiness -= Math.min(3, Math.floor((snap.overflow.luxury + snap.overflow.strategic) / 3));
  return { inc: out, production: outProd, snapshot: snap };
}

