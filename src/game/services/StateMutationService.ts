import type { GameState, Unit } from '../types';

export type UnitCombatApplyResult = {
  units: GameState['units'];
  civilizations: GameState['civilizations'];
  tiles: GameState['tiles'];
  defenderKilled: boolean;
  attackerKilled: boolean;
};

export function applyUnitCombat(
  state: GameState,
  attacker: Unit,
  defender: Unit,
  atkDmg: number,
  defDmg: number,
  newAtkHp: number,
  newDefHp: number
): UnitCombatApplyResult {
  const turnTag = state.turn;
  // Start with updated HP/flags
  let newUnits = state.units.map(u => {
    if (u.id === attacker.id) {
      return {
        ...u,
        hp: newAtkHp,
        hasAttacked: true,
        movement: 0,
        lastDamagedInCombatTurn: defDmg > 0 ? turnTag : (u.lastDamagedInCombatTurn ?? null),
      };
    }
    if (u.id === defender.id) {
      return {
        ...u,
        hp: newDefHp,
        lastDamagedInCombatTurn: atkDmg > 0 ? turnTag : (u.lastDamagedInCombatTurn ?? null),
      };
    }
    return u;
  });

  // Clone only rows that are affected (minimizes allocations)
  const rowsToClone = new Set<number>([attacker.r, defender.r].filter(n => n >= 0));
  const newTiles = state.tiles.map((row, r) => (rowsToClone.has(r) ? row.map(t => ({ ...t })) : row));
  let newCivs = state.civilizations.map(c => ({ ...c }));

  let defenderKilled = false;
  let attackerKilled = false;

  // Defender dies
  if (newDefHp <= 0) {
    defenderKilled = true;
    newUnits = newUnits.filter(u => u.id !== defender.id);
    newCivs = newCivs.map((c, i) => {
      if (i !== defender.owner) return c;
      return { ...c, units: c.units.filter(id => id !== defender.id) };
    });

    // Move attacker into defender's tile if melee and attacker survives
    if ((attacker.rangedStrength ?? 0) === 0 && newAtkHp > 0) {
      if (newTiles[defender.r] && newTiles[defender.r][defender.q]) {
        if (newTiles[defender.r][defender.q].unit === defender.id) {
          newTiles[defender.r][defender.q].unit = attacker.id;
        }
      }
      if (newTiles[attacker.r] && newTiles[attacker.r][attacker.q]) {
        if (newTiles[attacker.r][attacker.q].unit === attacker.id) {
          newTiles[attacker.r][attacker.q].unit = null;
        }
      }
      newUnits = newUnits.map(u => (u.id !== attacker.id ? u : { ...u, q: defender.q, r: defender.r }));
    }
  }

  // Attacker dies
  if (newAtkHp <= 0) {
    attackerKilled = true;
    newUnits = newUnits.filter(u => u.id !== attacker.id);
    newCivs = newCivs.map((c, i) => {
      if (i !== attacker.owner) return c;
      return { ...c, units: c.units.filter(id => id !== attacker.id) };
    });
  }

  return {
    units: newUnits,
    civilizations: newCivs,
    tiles: newTiles,
    defenderKilled,
    attackerKilled,
  };
}

export function applyCityAttackUnitMutations(
  state: GameState,
  attacker: Unit,
  newAtkHp: number
): { units: GameState['units']; civilizations: GameState['civilizations'] } {
  const turnTag = state.turn;
  const newUnits = state.units.map(u => {
    if (u.id !== attacker.id) return u;
    return {
      ...u,
      hp: newAtkHp,
      hasAttacked: true,
      movement: 0,
      lastDamagedInCombatTurn: newAtkHp < attacker.hp ? turnTag : (u.lastDamagedInCombatTurn ?? null),
    };
  }).filter(u => u.id !== attacker.id || newAtkHp > 0);

  const newCivs = state.civilizations.map((c, i) =>
    i !== attacker.owner ? c : { ...c, units: (c.units || []).filter(id => id !== attacker.id).concat(newUnits.some(u => u.id === attacker.id) ? [attacker.id] : []) }
  );

  return { units: newUnits, civilizations: newCivs };
}
