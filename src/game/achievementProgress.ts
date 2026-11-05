/**
 * Derives achievement progress from live game state (layout-independent play stats + civ snapshot).
 */
import type { GameState, TerrainType, Era, UnitType } from "./types";
import type { AchievementsMap, AchievementId } from "./achievements";
import { ACHIEVEMENTS, createEmptyAchievements } from "./achievements";

const ERA_ORDER: Era[] = [
  "ancient",
  "classical",
  "medieval",
  "renaissance",
  "industrial",
  "modern",
  "atomic",
  "information",
];

function eraIndex(e: Era): number {
  const i = ERA_ORDER.indexOf(e);
  return i >= 0 ? i : 0;
}

function isMilitaryUnitType(t: UnitType): boolean {
  if (t === "settler" || t === "worker" || t === "missionary") return false;
  if (t.startsWith("great_")) return false;
  return true;
}

function countMilitaryUnits(state: GameState, owner: number): number {
  return state.units.filter(u => u.owner === owner && isMilitaryUnitType(u.type)).length;
}

function countExploredTiles(state: GameState, civIndex: number): number {
  let n = 0;
  for (const row of state.tiles) {
    for (const t of row) {
      if (t.revealed[civIndex]) n++;
    }
  }
  return n;
}

function distinctTerrainsExplored(state: GameState, civIndex: number): number {
  const set = new Set<TerrainType>();
  for (const row of state.tiles) {
    for (const t of row) {
      if (t.revealed[civIndex]) set.add(t.terrain);
    }
  }
  return set.size;
}

/** Peace (not merely neutral) with other living civilizations. */
function countPeaceWithAliveOthers(state: GameState, me: number): number {
  return state.relations.filter(r => {
    if (r.status !== "peace") return false;
    const other = r.civA === me ? r.civB : r.civB === me ? r.civA : -1;
    if (other < 0) return false;
    return state.civilizations[other]?.isAlive === true;
  }).length;
}

function countCulturalForeignReach(state: GameState, me: number): number {
  const h = state.civilizations[me];
  if (!h) return 0;
  let c = 0;
  for (let j = 0; j < state.civilizations.length; j++) {
    if (j === me || !state.civilizations[j]?.isAlive) continue;
    if ((h.culturalInfluence[j] ?? 0) > 0) c++;
  }
  return c;
}

function buildingCount(state: GameState, owner: number): number {
  return state.cities.filter(c => c.owner === owner).reduce((sum, c) => sum + c.buildings.length, 0);
}

function playerCityCount(state: GameState, owner: number): number {
  return state.cities.filter(c => c.owner === owner).length;
}

function foundedNonStartCities(state: GameState, owner: number): number {
  return state.cities.filter(c => c.owner === owner && c.turnFounded > 0).length;
}

function computeMetrics(state: GameState, me: number) {
  const human = state.civilizations[me];
  const st = state.achievementStats?.[me];
  const combatWins = st?.combatWins ?? 0;
  const captures = st?.enemyCitiesCaptured ?? 0;
  const techExtra = Math.max(0, (human?.researchedTechs.length ?? 0) - 1);
  const gold = Math.floor(human?.resources.gold ?? 0);
  const cultureLife = Math.floor(human?.lifetimeCulture ?? 0);
  const rivals = state.civilizations.filter((c, i) => i !== me && c.isAlive);
  const minRivalEra = rivals.length ? Math.min(...rivals.map(c => eraIndex(c.era))) : eraIndex(human?.era ?? "ancient");
  const eraLead = eraIndex(human?.era ?? "ancient") - minRivalEra;

  return {
    combatWins,
    captures,
    techExtra,
    gold,
    cultureLife,
    eraLead,
    militaryUnits: countMilitaryUnits(state, me),
    explored: countExploredTiles(state, me),
    terrains: distinctTerrainsExplored(state, me),
    peaceCount: countPeaceWithAliveOthers(state, me),
    cultReach: countCulturalForeignReach(state, me),
    buildings: buildingCount(state, me),
    cities: playerCityCount(state, me),
    founded: foundedNonStartCities(state, me),
    turn: state.turn,
  };
}

export function achievementMapsEqual(a: AchievementsMap, b: AchievementsMap): boolean {
  for (const id of Object.keys(ACHIEVEMENTS) as AchievementId[]) {
    if (a[id]?.progress !== b[id]?.progress) return false;
    if (a[id]?.unlocked !== b[id]?.unlocked) return false;
  }
  return true;
}

/**
 * Merges computed progress into `prev` (monotonic). Returns newly unlocked ids for this transition only.
 */
export function evaluateAchievementsFromState(
  state: GameState,
  humanCivIndex: number,
  prev: AchievementsMap
): { next: AchievementsMap; newlyUnlocked: AchievementId[] } {
  if (!state.civilizations[humanCivIndex]) {
    return { next: prev, newlyUnlocked: [] };
  }

  const prevFull: AchievementsMap = { ...createEmptyAchievements(), ...prev };

  const m = computeMetrics(state, humanCivIndex);
  const won = state.phase === "victory" && state.winner === humanCivIndex;
  const vt = state.victoryType;

  const computed = (id: AchievementId): { prog: number; extraUnlock?: boolean } => {
    switch (id) {
      case "FIRST_BLOOD":
        return { prog: Math.min(1, m.combatWins), extraUnlock: m.combatWins >= 1 };
      case "WARRIOR_KING":
        return { prog: Math.min(10, m.combatWins) };
      case "MILITARY_MIGHT":
        return { prog: Math.min(30, m.militaryUnits) };
      case "CONQUEROR":
        return { prog: Math.min(5, m.captures) };
      case "WORLD_CONQUEROR":
        return { prog: won && vt === "domination" ? 1 : 0, extraUnlock: won && vt === "domination" };
      case "SCHOLAR":
        return { prog: Math.min(1, m.techExtra), extraUnlock: m.techExtra >= 1 };
      case "RENAISSANCE_MAN":
        return { prog: Math.min(20, m.techExtra) };
      case "TECHNOLOGICAL_SUPREMACY":
        return { prog: m.eraLead >= 4 ? 1 : 0, extraUnlock: m.eraLead >= 4 };
      case "SPACE_PROGRAM":
        return { prog: won && vt === "science" ? 1 : 0, extraUnlock: won && vt === "science" };
      case "ARTIST":
        return { prog: Math.min(100, m.cultureLife) };
      case "CULTURAL_ICON":
        return { prog: Math.min(3, m.cultReach) };
      case "CULTURAL_VICTORY":
        return { prog: won && vt === "culture" ? 1 : 0, extraUnlock: won && vt === "culture" };
      case "PEACEMAKER":
        return { prog: Math.min(5, m.peaceCount) };
      case "WORLD_LEADER":
        return { prog: won && vt === "diplomacy" ? 1 : 0, extraUnlock: won && vt === "diplomacy" };
      case "EXPLORER":
        return { prog: Math.min(50, m.explored) };
      case "CARTOGRAPHER":
        return { prog: Math.min(11, m.terrains) };
      case "MERCHANT":
        return { prog: Math.min(1000, m.gold) };
      case "ECONOMIC_POWERHOUSE":
        return { prog: Math.min(5000, m.gold) };
      case "BUILDER":
        return { prog: Math.min(20, m.buildings) };
      case "FIRST_CITY":
        return { prog: Math.min(1, m.founded), extraUnlock: m.founded >= 1 };
      case "FIVE_CITIES":
        return { prog: Math.min(5, m.cities) };
      case "TEN_CITIES":
        return { prog: Math.min(10, m.cities) };
      case "CENTURY":
        return { prog: Math.min(100, m.turn) };
      case "MARATHON":
        return { prog: Math.min(500, m.turn) };
      default:
        return { prog: prevFull[id]?.progress ?? 0 };
    }
  };

  const next: AchievementsMap = { ...prevFull };
  const newlyUnlocked: AchievementId[] = [];

  for (const id of Object.keys(ACHIEVEMENTS) as AchievementId[]) {
    const cur = prevFull[id];
    if (cur.unlocked) {
      next[id] = cur;
      continue;
    }
    const { prog: rawProg, extraUnlock } = computed(id);
    const maxP = cur.maxProgress;
    const prog = Math.min(maxP, Math.max(cur.progress, rawProg));
    const unlocked = Boolean(extraUnlock) || prog >= maxP;
    if (unlocked && !cur.unlocked) {
      newlyUnlocked.push(id);
    }
    next[id] = {
      ...cur,
      progress: unlocked ? maxP : prog,
      unlocked,
      unlockedAtTurn: unlocked && !cur.unlocked ? state.turn : cur.unlockedAtTurn,
      unlockedDate: unlocked && !cur.unlocked ? new Date().toISOString() : cur.unlockedDate,
    };
  }

  return { next, newlyUnlocked };
}
