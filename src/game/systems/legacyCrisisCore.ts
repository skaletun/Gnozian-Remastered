import { addMessage } from '../messages';
import { CRISIS_POLICY_PROMPT_SNOOZE_TURNS, LEGACY_PROMPT_SNOOZE_TURNS } from '../constants';
import type {
  CrisisPolicyType,
  GameAge,
  GameState,
  LegacyChoiceType,
  LegacyCrisisState,
  LegacyPathType,
  YieldMap,
} from '../types';

function baseState(): LegacyCrisisState {
  return {
    pointsByCiv: {},
    pendingLegacyChoices: [],
    history: [],
    activeYieldModifiersByCiv: {},
    crisisActive: false,
    crisisAge: null,
    crisisTurnsLeft: 0,
    crisisSeverity: 0,
    selectedPolicyByCiv: {},
  };
}

function emptyPathPoints(): Record<LegacyPathType, number> {
  return { military: 0, science: 0, culture: 0, economy: 0 };
}

function parseTurnSnoozeByCiv(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== 'object') return {};
  const o: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(k);
    if (!Number.isFinite(idx) || idx < 0) continue;
    const t = Math.floor(Number(v));
    if (Number.isFinite(t)) o[idx] = t;
  }
  return o;
}

export function normalizeLegacyCrisis(state: GameState): LegacyCrisisState {
  const raw = state.systems.legacyCrisis && typeof state.systems.legacyCrisis === 'object'
    ? state.systems.legacyCrisis
    : baseState();
  const pointsByCiv: LegacyCrisisState['pointsByCiv'] = {};
  const activeYieldModifiersByCiv: LegacyCrisisState['activeYieldModifiersByCiv'] = {};
  const selectedPolicyByCiv: LegacyCrisisState['selectedPolicyByCiv'] = {};
  for (let i = 0; i < state.civilizations.length; i++) {
    const pts = raw.pointsByCiv?.[i] ?? emptyPathPoints();
    pointsByCiv[i] = {
      military: Math.max(0, Math.floor(Number(pts.military ?? 0))),
      science: Math.max(0, Math.floor(Number(pts.science ?? 0))),
      culture: Math.max(0, Math.floor(Number(pts.culture ?? 0))),
      economy: Math.max(0, Math.floor(Number(pts.economy ?? 0))),
    };
    activeYieldModifiersByCiv[i] = (raw.activeYieldModifiersByCiv?.[i] ?? {}) as Partial<YieldMap>;
    const p = raw.selectedPolicyByCiv?.[i];
    selectedPolicyByCiv[i] =
      p === 'rationing' || p === 'war_mobilization' || p === 'knowledge_preservation' || p === 'cultural_unity'
        ? p
        : null;
  }
  return {
    pointsByCiv,
    pendingLegacyChoices: Array.isArray(raw.pendingLegacyChoices) ? raw.pendingLegacyChoices : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    activeYieldModifiersByCiv,
    crisisActive: !!raw.crisisActive,
    crisisAge:
      raw.crisisAge === 'antiquity' || raw.crisisAge === 'exploration' || raw.crisisAge === 'modern'
        ? raw.crisisAge
        : null,
    crisisTurnsLeft: Math.max(0, Math.floor(Number(raw.crisisTurnsLeft ?? 0))),
    crisisSeverity: Math.max(0, Math.floor(Number(raw.crisisSeverity ?? 0))),
    selectedPolicyByCiv,
    legacyPromptSnoozeUntilTurnByCiv: parseTurnSnoozeByCiv(raw.legacyPromptSnoozeUntilTurnByCiv),
    crisisPolicySnoozeUntilTurnByCiv: parseTurnSnoozeByCiv(raw.crisisPolicySnoozeUntilTurnByCiv),
  };
}

function ensurePendingChoices(
  current: LegacyCrisisState,
  age: GameAge,
  aliveCivs: number[]
): LegacyCrisisState {
  const existing = new Set(current.pendingLegacyChoices.map(x => x.civIndex));
  const pending = [...current.pendingLegacyChoices];
  for (const civIndex of aliveCivs) {
    if (existing.has(civIndex)) continue;
    pending.push({ civIndex, age, options: ['golden_age', 'dark_age'] });
  }
  return { ...current, pendingLegacyChoices: pending };
}

export function chooseLegacyOption(
  state: GameState,
  civIndex: number,
  path: LegacyPathType,
  choice: LegacyChoiceType
): GameState {
  const lc = normalizeLegacyCrisis(state);
  const pending = lc.pendingLegacyChoices.find(p => p.civIndex === civIndex);
  if (!pending) return state;
  const base = lc.activeYieldModifiersByCiv[civIndex] ?? {};
  const bump = (key: keyof YieldMap, amount: number): Partial<YieldMap> => ({ ...base, [key]: (base[key] ?? 0) + amount });
  const mods =
    choice === 'golden_age'
      ? path === 'science'
        ? bump('science', 6)
        : path === 'culture'
          ? bump('culture', 6)
          : path === 'economy'
            ? bump('gold', 8)
            : bump('production', 5)
      : path === 'science'
        ? { ...bump('science', 10), happiness: (base.happiness ?? 0) - 2 }
        : path === 'culture'
          ? { ...bump('culture', 10), production: (base.production ?? 0) - 2 }
          : path === 'economy'
            ? { ...bump('gold', 12), culture: (base.culture ?? 0) - 2 }
            : { ...bump('production', 8), science: (base.science ?? 0) - 2 };

  const legacySnooze = { ...(lc.legacyPromptSnoozeUntilTurnByCiv ?? {}) };
  delete legacySnooze[civIndex];

  const next: LegacyCrisisState = {
    ...lc,
    pendingLegacyChoices: lc.pendingLegacyChoices.filter(p => p.civIndex !== civIndex),
    history: [...lc.history, { civIndex, age: pending.age, path, choice, turn: state.turn }],
    activeYieldModifiersByCiv: { ...lc.activeYieldModifiersByCiv, [civIndex]: mods },
    legacyPromptSnoozeUntilTurnByCiv: legacySnooze,
  };
  return addMessage(
    { ...state, systems: { ...state.systems, legacyCrisis: next } },
    `${state.civilizations[civIndex]?.name ?? `Civ ${civIndex + 1}`} chooses ${choice} on ${path} legacy path.`,
    'info',
    [civIndex]
  );
}

export function chooseCrisisPolicy(state: GameState, civIndex: number, policy: CrisisPolicyType): GameState {
  const lc = normalizeLegacyCrisis(state);
  if (!lc.crisisActive || !state.civilizations[civIndex]?.isAlive) return state;
  const crisisSnooze = { ...(lc.crisisPolicySnoozeUntilTurnByCiv ?? {}) };
  delete crisisSnooze[civIndex];
  const next: LegacyCrisisState = {
    ...lc,
    selectedPolicyByCiv: { ...lc.selectedPolicyByCiv, [civIndex]: policy },
    crisisPolicySnoozeUntilTurnByCiv: crisisSnooze,
  };
  return addMessage(
    { ...state, systems: { ...state.systems, legacyCrisis: next } },
    `${state.civilizations[civIndex]?.name ?? `Civ ${civIndex + 1}`} adopts crisis policy ${policy}.`,
    'info',
    [civIndex]
  );
}

function policyModifier(policy: CrisisPolicyType | null): Partial<YieldMap> {
  if (policy === 'rationing') return { food: -3, happiness: 3, gold: -1 };
  if (policy === 'war_mobilization') return { production: 5, culture: -2, happiness: -1 };
  if (policy === 'knowledge_preservation') return { science: 5, gold: -2 };
  if (policy === 'cultural_unity') return { culture: 4, production: -2, happiness: 1 };
  return {};
}

export function applyLegacyAndCrisisIncomeModifiers(
  state: GameState,
  civIndex: number,
  inc: { food: number; gold: number; science: number; culture: number; faith: number; happiness: number },
  production: number
): { inc: typeof inc; production: number } {
  const lc = normalizeLegacyCrisis(state);
  const mod = lc.activeYieldModifiersByCiv[civIndex] ?? {};
  const crisisMod = lc.crisisActive ? policyModifier(lc.selectedPolicyByCiv[civIndex] ?? null) : {};
  const out = { ...inc };
  out.food += (mod.food ?? 0) + (crisisMod.food ?? 0);
  out.gold += (mod.gold ?? 0) + (crisisMod.gold ?? 0);
  out.science += (mod.science ?? 0) + (crisisMod.science ?? 0);
  out.culture += (mod.culture ?? 0) + (crisisMod.culture ?? 0);
  out.faith += (mod.faith ?? 0) + (crisisMod.faith ?? 0);
  out.happiness += (mod.happiness ?? 0) + (crisisMod.happiness ?? 0);
  return { inc: out, production: production + (mod.production ?? 0) + (crisisMod.production ?? 0) };
}

export function legacyVictoryScore(state: GameState, civIndex: number): number {
  const lc = normalizeLegacyCrisis(state);
  const points = lc.pointsByCiv[civIndex] ?? { military: 0, science: 0, culture: 0, economy: 0 };
  const sumPoints = (points.military ?? 0) + (points.science ?? 0) + (points.culture ?? 0) + (points.economy ?? 0);
  const history = lc.history.filter(h => h.civIndex === civIndex);
  const golden = history.filter(h => h.choice === 'golden_age').length;
  const dark = history.filter(h => h.choice === 'dark_age').length;
  const civ = state.civilizations[civIndex];
  const baseScore = civ?.score ?? 0;
  return baseScore + sumPoints * 2 + golden * 25 + dark * 12;
}

export function tickLegacyCrisis(state: GameState): GameState {
  const lc = normalizeLegacyCrisis(state);
  const alive = state.civilizations.map((c, i) => (c.isAlive ? i : -1)).filter(i => i >= 0);
  let next: LegacyCrisisState = { ...lc };

  for (const i of alive) {
    const civ = state.civilizations[i]!;
    const p = next.pointsByCiv[i] ?? emptyPathPoints();
    next.pointsByCiv[i] = {
      military: p.military + Math.max(1, Math.floor(civ.units.length / 4)),
      science: p.science + Math.max(1, Math.floor((civ.resources.science ?? 0) / 45)),
      culture: p.culture + Math.max(1, Math.floor((civ.resources.culture ?? 0) / 40)),
      economy: p.economy + Math.max(1, Math.floor(Math.max(0, civ.resources.gold ?? 0) / 60) + Math.floor(civ.cities.length / 2)),
    };
  }

  if (state.age?.phase === 'transition') {
    next = ensurePendingChoices(next, state.age.currentAge, alive);
    if (!next.crisisActive) {
      const avgGriev = state.relations.length > 0
        ? Math.floor(state.relations.reduce((s, r) => s + Math.max(0, r.grievances ?? 0), 0) / state.relations.length)
        : 0;
      const severity = Math.max(1, Math.min(5, 1 + Math.floor(avgGriev / 20)));
      next = {
        ...next,
        crisisActive: true,
        crisisAge: state.age.currentAge,
        crisisTurnsLeft: 10 + severity,
        crisisSeverity: severity,
      };
      return addMessage(
        { ...state, systems: { ...state.systems, legacyCrisis: next } },
        `Global crisis begins (severity ${severity}).`,
        'warning'
      );
    }
  }

  if (next.crisisActive) {
    next = { ...next, crisisTurnsLeft: Math.max(0, next.crisisTurnsLeft - 1) };
    if (next.crisisTurnsLeft <= 0) {
      next = {
        ...next,
        crisisActive: false,
        crisisAge: null,
        crisisSeverity: 0,
        selectedPolicyByCiv: {},
        crisisPolicySnoozeUntilTurnByCiv: {},
      };
      return addMessage(
        { ...state, systems: { ...state.systems, legacyCrisis: next } },
        'Global crisis has ended.',
        'info'
      );
    }
  }

  return { ...state, systems: { ...state.systems, legacyCrisis: next } };
}

export function snoozeLegacyPrompt(state: GameState, civIndex: number): GameState {
  const lc = normalizeLegacyCrisis(state);
  if (!state.civilizations[civIndex]?.isAlive) return state;
  if (!lc.pendingLegacyChoices.some(p => p.civIndex === civIndex)) return state;
  const until = state.turn + LEGACY_PROMPT_SNOOZE_TURNS;
  const legacyPromptSnoozeUntilTurnByCiv = { ...(lc.legacyPromptSnoozeUntilTurnByCiv ?? {}), [civIndex]: until };
  return {
    ...state,
    systems: { ...state.systems, legacyCrisis: { ...lc, legacyPromptSnoozeUntilTurnByCiv } },
  };
}

export function snoozeCrisisPolicyPrompt(state: GameState, civIndex: number): GameState {
  const lc = normalizeLegacyCrisis(state);
  if (!lc.crisisActive || !state.civilizations[civIndex]?.isAlive) return state;
  const until = state.turn + CRISIS_POLICY_PROMPT_SNOOZE_TURNS;
  const crisisPolicySnoozeUntilTurnByCiv = { ...(lc.crisisPolicySnoozeUntilTurnByCiv ?? {}), [civIndex]: until };
  return {
    ...state,
    systems: { ...state.systems, legacyCrisis: { ...lc, crisisPolicySnoozeUntilTurnByCiv } },
  };
}

