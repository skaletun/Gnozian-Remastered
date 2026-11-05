import { hexDistance } from '../mapgen';
import type { Commander, CommanderDomain, GameState, Unit, UnitType } from '../types';

function unitDomain(type: UnitType): CommanderDomain {
  if (type === 'bomber' || type === 'fighter' || type === 'nuclear_missile') return 'squadron';
  if (type.includes('ship') || type.includes('submarine') || type.includes('destroyer')) return 'fleet';
  return 'army';
}

function isCombatUnit(unit: Unit): boolean {
  return unit.strength > 0 || unit.rangedStrength > 0;
}

function normalizeCommander(state: GameState, c: Commander, i: number): Commander {
  const ownerCiv = Math.max(0, Math.min(state.civilizations.length - 1, Number(c.ownerCiv ?? 0)));
  return {
    id: String(c.id || `cmd-${i + 1}`),
    ownerCiv,
    unitId: Math.max(1, Math.floor(Number(c.unitId ?? 1))),
    domain: c.domain === 'fleet' || c.domain === 'squadron' ? c.domain : 'army',
    level: Math.max(1, Math.min(10, Math.floor(Number(c.level ?? 1)))),
    xp: Math.max(0, Math.floor(Number(c.xp ?? 0))),
    assignedUnitIds: Array.isArray(c.assignedUnitIds)
      ? c.assignedUnitIds.map(id => Math.max(1, Math.floor(Number(id)))).filter((id, idx, arr) => arr.indexOf(id) === idx)
      : [],
    activeTurnsLeft: Math.max(0, Math.floor(Number(c.activeTurnsLeft ?? 0))),
    cooldownTurnsLeft: Math.max(0, Math.floor(Number(c.cooldownTurnsLeft ?? 0))),
  };
}

export function normalizeCommanderState(state: GameState): { commanders: Commander[]; nextCommanderId: number } {
  const raw = Array.isArray(state.systems.commanders) ? state.systems.commanders : [];
  const commanders = raw
    .map((c, i) => normalizeCommander(state, c, i))
    .filter(c => state.units.some(u => u.id === c.unitId && u.owner === c.ownerCiv));
  const maxId = commanders.reduce((m, c) => {
    const n = Number(String(c.id).replace(/\D+/g, ''));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  const nextCommanderId = Math.max(1, typeof state.systems.nextCommanderId === 'number' ? state.systems.nextCommanderId : maxId + 1);
  return { commanders, nextCommanderId };
}

export function commanderForUnit(state: GameState, unitId: number): Commander | null {
  return (state.systems.commanders ?? []).find(c => c.unitId === unitId || c.assignedUnitIds.includes(unitId)) ?? null;
}

export function appointCommander(state: GameState, ownerCiv: number, unitId: number): GameState {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.owner !== ownerCiv || !isCombatUnit(unit)) return state;
  if ((state.systems.commanders ?? []).some(c => c.unitId === unitId)) return state;
  const id = `cmd-${state.systems.nextCommanderId ?? 1}`;
  const commander: Commander = {
    id,
    ownerCiv,
    unitId,
    domain: unitDomain(unit.type),
    level: 1,
    xp: 0,
    assignedUnitIds: [],
    activeTurnsLeft: 0,
    cooldownTurnsLeft: 0,
  };
  return {
    ...state,
    systems: {
      ...state.systems,
      commanders: [...(state.systems.commanders ?? []), commander],
      nextCommanderId: (state.systems.nextCommanderId ?? 1) + 1,
    },
  };
}

export function assignUnitToCommander(state: GameState, ownerCiv: number, commanderId: string, unitId: number): GameState {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.owner !== ownerCiv || !isCombatUnit(unit)) return state;
  const commander = (state.systems.commanders ?? []).find(c => c.id === commanderId && c.ownerCiv === ownerCiv);
  if (!commander) return state;
  if (commander.unitId === unitId) return state;
  const cmdUnit = state.units.find(u => u.id === commander.unitId);
  if (!cmdUnit) return state;
  if (hexDistance(cmdUnit.q, cmdUnit.r, unit.q, unit.r) > 5) return state;
  return {
    ...state,
    systems: {
      ...state.systems,
      commanders: (state.systems.commanders ?? []).map(c =>
        c.id !== commanderId
          ? { ...c, assignedUnitIds: c.assignedUnitIds.filter(id => id !== unitId) }
          : { ...c, assignedUnitIds: [...c.assignedUnitIds.filter(id => id !== unitId), unitId] }
      ),
    },
  };
}

export function unassignUnitFromCommander(state: GameState, ownerCiv: number, unitId: number): GameState {
  return {
    ...state,
    systems: {
      ...state.systems,
      commanders: (state.systems.commanders ?? []).map(c =>
        c.ownerCiv !== ownerCiv ? c : { ...c, assignedUnitIds: c.assignedUnitIds.filter(id => id !== unitId) }
      ),
    },
  };
}

export function activateCommanderAbility(state: GameState, ownerCiv: number, commanderId: string): GameState {
  return {
    ...state,
    systems: {
      ...state.systems,
      commanders: (state.systems.commanders ?? []).map(c => {
        if (c.id !== commanderId || c.ownerCiv !== ownerCiv) return c;
        if (c.cooldownTurnsLeft > 0 || c.activeTurnsLeft > 0) return c;
        return { ...c, activeTurnsLeft: 2, cooldownTurnsLeft: 8 };
      }),
    },
  };
}

export function tickCommanders(state: GameState): GameState {
  return {
    ...state,
    systems: {
      ...state.systems,
      commanders: (state.systems.commanders ?? []).map(c => ({
        ...c,
        activeTurnsLeft: Math.max(0, c.activeTurnsLeft - 1),
        cooldownTurnsLeft: Math.max(0, c.cooldownTurnsLeft - 1),
      })),
    },
  };
}

export function pruneCommanders(state: GameState): GameState {
  const unitIds = new Set(state.units.map(u => u.id));
  return {
    ...state,
    systems: {
      ...state.systems,
      commanders: (state.systems.commanders ?? [])
        .filter(c => unitIds.has(c.unitId))
        .map(c => ({ ...c, assignedUnitIds: c.assignedUnitIds.filter(id => unitIds.has(id) && id !== c.unitId) })),
    },
  };
}

export function commanderStrengthBonusPct(state: GameState, unit: Unit): number {
  const commander = commanderForUnit(state, unit.id);
  if (!commander) return 0;
  let bonus = 8 + commander.level * 2;
  if (commander.activeTurnsLeft > 0) bonus += 6;
  return bonus;
}

