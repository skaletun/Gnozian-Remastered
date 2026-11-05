import type { GameState, Unit, Tile } from '../types';
import { getCivTemplateByName } from '../constants';
import { hexDistance } from '../mapgen';
import { rngForEvent } from '../rng';
import { commanderStrengthBonusPct } from '../systems/commandersCore';

export type UnitCombatResult = {
  attackerId: number;
  defenderId: number;
  atkDmg: number;
  defDmg: number;
  newAtkHp: number;
  newDefHp: number;
  attackerRanged: boolean;
  ratio: number;
  msg: string;
};

function nearbyGreatGeneralBonus(state: GameState, unit: Unit): number {
  const gens = state.units.filter(
    u => u.owner === unit.owner && u.type === 'great_general' && hexDistance(u.q, u.r, unit.q, unit.r) <= 2
  );
  return gens.length > 0 ? 25 : 0;
}

export function computeUnitCombat(
  state: GameState,
  attacker: Unit,
  defender: Unit,
  tiles: Tile[][]
): UnitCombatResult {
  let atkStr = attacker.rangedStrength > 0 ? attacker.rangedStrength : attacker.strength;
  let defStr = defender.strength;

  atkStr *= 1 + nearbyGreatGeneralBonus(state, attacker) / 100;
  defStr *= 1 + nearbyGreatGeneralBonus(state, defender) / 100;
  atkStr *= 1 + commanderStrengthBonusPct(state, attacker) / 100;
  defStr *= 1 + commanderStrengthBonusPct(state, defender) / 100;
  const atkTpl = getCivTemplateByName(state.civilizations[attacker.owner]?.name ?? '');
  const defTpl = getCivTemplateByName(state.civilizations[defender.owner]?.name ?? '');
  atkStr *= 1 + (atkTpl?.bonuses.combatStrengthPct ?? 0) / 100;
  defStr *= 1 + (defTpl?.bonuses.combatStrengthPct ?? 0) / 100;

  const defTile = tiles[defender.r]?.[defender.q];
  if (defTile) {
    const terrainBonus: Record<string, number> = {
      forest: 25,
      jungle: 25,
      hills: 25,
      mountains: 50,
    };
    const bonus = terrainBonus[defTile.terrain] ?? 0;
    defStr *= 1 + bonus / 100;
  }

  atkStr *= attacker.hp / 100;
  defStr *= defender.hp / 100;

  const ratio = atkStr / Math.max(defStr, 1);
  const BASE_DAMAGE = 30;
  const rng = rngForEvent(state, 'combat:unit', attacker.id, defender.id);
  const atkDmg = Math.round(BASE_DAMAGE * ratio * (0.8 + rng() * 0.4));
  const defDmg = attacker.rangedStrength > 0 ? 0 : Math.round(BASE_DAMAGE / Math.max(ratio, 0.1) * (0.8 + rng() * 0.4));

  const newDefHp = Math.max(0, defender.hp - atkDmg);
  const newAtkHp = Math.max(0, attacker.hp - defDmg);

  const atkCiv = state.civilizations[attacker.owner];
  const defCiv = state.civilizations[defender.owner];
  const atkWho = atkCiv ? `${atkCiv.adjective} ${attacker.name}` : attacker.name;
  const defWho = defCiv ? `${defCiv.adjective} ${defender.name}` : defender.name;
  const msg = `${atkWho} → ${defWho}: ${atkDmg} dmg`;

  return {
    attackerId: attacker.id,
    defenderId: defender.id,
    atkDmg,
    defDmg,
    newAtkHp,
    newDefHp,
    attackerRanged: attacker.rangedStrength > 0,
    ratio,
    msg,
  };
}

export type CityCombatResult = {
  attackerId: number;
  cityId: number;
  atkDmg: number;
  defDmg: number;
  newCityHp: number;
  newAtkHp: number;
  msg: string;
};

export function computeCityCombat(
  state: GameState,
  attacker: Unit,
  city: import('../types').City
): CityCombatResult {
  const commanderBonus = commanderStrengthBonusPct(state, attacker);
  const atkStr =
    (attacker.rangedStrength > 0 ? attacker.rangedStrength : attacker.strength) *
    (1 + commanderBonus / 100) *
    (attacker.hp / 100);
  const cityStr = city.defense + city.hp / 10;

  const ratio = atkStr / Math.max(cityStr, 1);
  const rng = rngForEvent(state, 'combat:city', attacker.id, city.id);
  const atkDmg = Math.round(25 * ratio * (0.8 + rng() * 0.4));
  const defDmg = attacker.rangedStrength > 0 ? 0 : Math.round(15 / Math.max(ratio, 0.1));

  const newCityHp = Math.max(0, city.hp - atkDmg);
  const newAtkHp = Math.max(0, attacker.hp - defDmg);

  const atkCiv = state.civilizations[attacker.owner];
  const atkWho = atkCiv ? `${atkCiv.adjective} ${attacker.name}` : attacker.name;
  const cityOwner = state.civilizations[city.owner]?.adjective ?? 'Enemy';
  const msg = `${atkWho} → ${city.name} (${cityOwner}): ${atkDmg} dmg · city ${newCityHp}/${city.maxHp} HP`;

  return {
    attackerId: attacker.id,
    cityId: city.id,
    atkDmg,
    defDmg,
    newCityHp,
    newAtkHp,
    msg,
  };
}
