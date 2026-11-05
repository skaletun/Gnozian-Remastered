import type { GameState, InfluenceActionKind, InfluenceDiplomacyState } from '../types';

const ACTION_COST: Record<InfluenceActionKind, number> = {
  support: 8,
  accept: 4,
  reject: 3,
  sanction: 14,
  endeavor: 10,
  treaty: 18,
  independent: 0,
};

function clampInfluence(v: number): number {
  return Math.max(0, Math.min(9999, Math.floor(Number(v) || 0)));
}

function ensureInfluenceState(state: GameState): InfluenceDiplomacyState {
  const s = state.systems.influenceDiplomacy;
  return {
    balances: s?.balances && typeof s.balances === 'object' ? { ...s.balances } : {},
    actionLog: Array.isArray(s?.actionLog) ? [...s.actionLog] : [],
    treaties: Array.isArray(s?.treaties) ? [...s.treaties] : [],
    sanctions: Array.isArray(s?.sanctions) ? [...s.sanctions] : [],
    endeavors: Array.isArray(s?.endeavors) ? [...s.endeavors] : [],
  };
}

export function getInfluenceBalance(state: GameState, civIndex: number): number {
  const sys = ensureInfluenceState(state);
  const raw = sys.balances[civIndex];
  if (raw != null) return clampInfluence(raw);
  return clampInfluence(Math.floor((state.civilizations[civIndex]?.diplomaticFavor ?? 0) * 1.2));
}

export function influenceActionCost(kind: InfluenceActionKind): number {
  return ACTION_COST[kind];
}

export function canSpendInfluence(state: GameState, civIndex: number, amount: number): boolean {
  return getInfluenceBalance(state, civIndex) >= Math.max(0, amount);
}

export function spendInfluence(state: GameState, civIndex: number, amount: number): GameState {
  const sys = ensureInfluenceState(state);
  const cur = getInfluenceBalance(state, civIndex);
  sys.balances[civIndex] = clampInfluence(cur - Math.max(0, amount));
  return {
    ...state,
    systems: { ...state.systems, influenceDiplomacy: sys },
  };
}

export function grantInfluence(state: GameState, civIndex: number, amount: number): GameState {
  const sys = ensureInfluenceState(state);
  const cur = getInfluenceBalance(state, civIndex);
  sys.balances[civIndex] = clampInfluence(cur + Math.max(0, amount));
  return {
    ...state,
    systems: { ...state.systems, influenceDiplomacy: sys },
  };
}

export function appendInfluenceActionLog(
  state: GameState,
  payload: {
    fromCiv: number;
    toCiv: number;
    kind: InfluenceActionKind;
    cost: number;
    note?: string;
  }
): GameState {
  const sys = ensureInfluenceState(state);
  sys.actionLog = [
    {
      id: `influence-${state.turn}-${payload.fromCiv}-${payload.toCiv}-${payload.kind}-${sys.actionLog.length + 1}`,
      turn: state.turn,
      fromCiv: payload.fromCiv,
      toCiv: payload.toCiv,
      kind: payload.kind,
      cost: payload.cost,
      note: payload.note,
    },
    ...sys.actionLog,
  ].slice(0, 80);
  return {
    ...state,
    systems: { ...state.systems, influenceDiplomacy: sys },
  };
}

export function tickInfluenceEconomy(state: GameState): GameState {
  const sys = ensureInfluenceState(state);
  for (let i = 0; i < state.civilizations.length; i++) {
    const civ = state.civilizations[i];
    if (!civ?.isAlive) continue;
    const base = 2;
    const favorScaled = Math.floor((civ.diplomaticFavor ?? 0) * 0.08);
    const cultureScaled = Math.floor((civ.resources.culture ?? 0) * 0.05);
    const treatyBonus = sys.treaties.filter(t => (t.civA === i || t.civB === i) && t.turnsLeft > 0).length;
    const gain = Math.max(1, base + favorScaled + cultureScaled + treatyBonus);
    const cur = getInfluenceBalance({ ...state, systems: { ...state.systems, influenceDiplomacy: sys } }, i);
    sys.balances[i] = clampInfluence(cur + gain);
  }
  sys.treaties = sys.treaties
    .map(t => ({ ...t, turnsLeft: t.turnsLeft - 1 }))
    .filter(t => t.turnsLeft > 0);
  sys.sanctions = sys.sanctions
    .map(s => ({ ...s, turnsLeft: s.turnsLeft - 1 }))
    .filter(s => s.turnsLeft > 0);
  return {
    ...state,
    systems: { ...state.systems, influenceDiplomacy: sys },
  };
}

export function normalizeInfluenceDiplomacy(state: GameState): InfluenceDiplomacyState {
  const sys = ensureInfluenceState(state);
  for (let i = 0; i < state.civilizations.length; i++) {
    if (sys.balances[i] == null) {
      sys.balances[i] = getInfluenceBalance(state, i);
    } else {
      sys.balances[i] = clampInfluence(sys.balances[i]!);
    }
  }
  return sys;
}

