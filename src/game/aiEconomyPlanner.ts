import type { BuildingType, City, GameState, ProductionItem, UnitType, WonderId } from './types';
import { BUILDINGS, UNITS, WONDERS } from './constants';
import { isWonderAvailable } from './featureSystems';
import { empireMeetsUnitStrategicRequirements } from './strategicResources';
import {
  atWarWithAnyone,
  computeMilitaryPower,
  minDistanceEnemyUnitToOurCities,
  strongestKnownEnemyPower,
} from './aiMetrics';
import type { AIPersonality, AIStrategicPosture } from './aiStrategy';

function canBuildBuilding(techs: string[], buildingId: BuildingType): boolean {
  const building = BUILDINGS[buildingId];
  if (!building) return false;
  if (building.prerequisiteTech && !techs.includes(building.prerequisiteTech)) return false;
  return true;
}

export function pickCombatUnitType(techs: string[]): UnitType {
  const tiers: [string, UnitType][] = [
    ['nuclear_fission', 'nuclear_missile'],
    ['advanced_flight', 'bomber'],
    ['flight', 'fighter'],
    ['combustion', 'tank'],
    ['replaceable_parts', 'infantry'],
    ['ballistics', 'artillery'],
    ['military_science', 'cavalry'],
    ['rifling', 'rifleman'],
    ['gunpowder', 'musketman'],
    ['chemistry', 'cannon'],
    ['chivalry', 'knight'],
    ['iron_working', 'swordsman'],
    ['mathematics', 'catapult'],
    ['horseback_riding', 'horseman'],
    ['bronze_working', 'spearman'],
    ['archery', 'archer'],
  ];
  for (const [tech, unit] of tiers) {
    if (techs.includes(tech) && UNITS[unit]) return unit;
  }
  return 'warrior';
}

export function pickSiegeUnitType(techs: string[]): UnitType | null {
  if (techs.includes('ballistics')) return 'artillery';
  if (techs.includes('chemistry')) return 'cannon';
  if (techs.includes('mathematics')) return 'catapult';
  return null;
}

export function chooseProductionItem(
  state: GameState,
  city: City,
  civIndex: number,
  personality: AIPersonality,
  posture: AIStrategicPosture,
  rng: () => number
): ProductionItem {
  const civ = state.civilizations[civIndex]!;
  const techs = civ.researchedTechs;
  const yields = city.yields;
  const atWar = atWarWithAnyone(state, civIndex);
  const threatened = minDistanceEnemyUnitToOurCities(state, civIndex) <= 6;
  const enemyPower = strongestKnownEnemyPower(state, civIndex);
  const militaryRatio = computeMilitaryPower(state, civIndex) / Math.max(1, enemyPower);

  type Candidate = { item: ProductionItem; weight: number };
  const candidates: Candidate[] = [];

  const addUnit = (id: UnitType, weight: number) => {
    if (!UNITS[id]) return;
    if (!empireMeetsUnitStrategicRequirements(state, civIndex, id)) return;
    candidates.push({ item: { type: 'unit', id, progress: 0, cost: UNITS[id].cost }, weight: weight + rng() * 3 });
  };

  const addBuilding = (id: BuildingType, weight: number) => {
    if (!BUILDINGS[id] || city.buildings.includes(id)) return;
    if (!canBuildBuilding(techs, id)) return;
    candidates.push({
      item: { type: 'building', id, progress: 0, cost: BUILDINGS[id].cost },
      weight: weight + rng() * 2,
    });
  };

  const addWonder = (id: WonderId, weight: number) => {
    if (!isWonderAvailable(state, id)) return;
    const wonder = WONDERS[id];
    if (wonder.prerequisiteTech && !techs.includes(wonder.prerequisiteTech)) return;
    candidates.push({ item: { type: 'wonder', id, progress: 0, cost: wonder.cost }, weight: weight + rng() * 4 });
  };

  const settlersIdle = state.units.filter(unit => unit.owner === civIndex && unit.type === 'settler').length;
  const workersIdle = state.units.filter(unit => unit.owner === civIndex && unit.type === 'worker').length;
  const cityCount = civ.cities.length;
  const maxCitiesSoft = Math.min(18, 4 + state.settings.numCivs * 2);

  if (
    posture.expansionPressure > 0.45 &&
    settlersIdle < 2 &&
    cityCount < maxCitiesSoft &&
    posture.skill > 0.35
  ) {
    const urgency = 12 + (maxCitiesSoft - cityCount) * 1.2 + posture.skill * 8;
    addUnit('settler', urgency + personality.economyFocus / 20);
  }

  if ((personality.economyFocus > 45 || cityCount >= 3) && workersIdle < Math.ceil(cityCount / 2)) {
    addUnit('worker', 9 + personality.economyFocus / 25);
  }

  if (techs.includes('animal_husbandry')) {
    const scoutsOwned = state.units.filter(unit => unit.owner === civIndex && unit.type === 'scout').length;
    if (scoutsOwned < Math.min(4, 2 + Math.floor(cityCount / 2))) {
      addUnit('scout', 6 + posture.expansionPressure * 10 + (posture.skill > 0.5 ? 4 : 0));
    }
  }

  if (atWar || threatened || militaryRatio < 0.9 || posture.threatLevel > 0.42) {
    const siege = pickSiegeUnitType(techs);
    if (siege && (atWar || threatened)) addUnit(siege, 26 + personality.aggressiveness / 5);
    addUnit(
      pickCombatUnitType(techs),
      20 +
        (atWar ? 18 : 0) +
        (threatened ? 22 : 0) +
        posture.threatLevel * 26 +
        personality.aggressiveness / 6
    );
  }

  addBuilding('granary', (city.population < 5 ? 22 : 6) + (yields.food < 6 ? 10 : 0) + posture.developmentPressure * 5);
  addBuilding('monument', 8 + personality.culturalFocus / 8);
  addBuilding('library', 10 + personality.scientificFocus / 7 + (posture.victoryFocus === 'science' ? 8 : 0));
  addBuilding('barracks', atWar || personality.aggressiveness > 55 ? 14 + personality.aggressiveness / 10 : 0);
  addBuilding('market', 8 + personality.economyFocus / 12 + (posture.victoryFocus === 'economy' ? 6 : 0));
  addBuilding('temple', 6 + personality.religiousFocus / 8 + (posture.victoryFocus === 'religion' ? 7 : 0));
  addBuilding('workshop', 11 + personality.economyFocus / 25 + personality.scientificFocus / 40 + posture.developmentPressure * 8);
  addBuilding('aqueduct', city.population >= 4 ? 16 : 4);
  addBuilding('university', 14 + personality.scientificFocus / 10);
  addBuilding('bank', 12 + personality.economyFocus / 10);
  addBuilding('factory', 16 + personality.aggressiveness / 25 + personality.economyFocus / 30);
  addBuilding('colosseum', city.amenities < 5 ? 15 : 5);
  addBuilding('entertainment_complex', city.amenities < 6 ? 12 : 4);
  addBuilding('research_lab', 18 + personality.scientificFocus / 12);
  addBuilding('stock_exchange', 14 + personality.economyFocus / 12);
  addBuilding('broadcast_tower', 12 + personality.culturalFocus / 12);
  addBuilding('space_port', civ.scienceVictoryProgress > 15 || personality.scientificFocus > 75 ? 40 : 4);

  if (posture.skill > 0.55 && rng() < 0.35 + posture.skill * 0.25) {
    for (const wonderId of Object.keys(WONDERS) as WonderId[]) {
      let weight = 4 + personality.culturalFocus / 40 + personality.scientificFocus / 45;
      if (wonderId === 'great_library' && personality.scientificFocus > 50) weight += 20;
      if (wonderId === 'great_pyramid' && personality.expansionist) weight += 16;
      if (wonderId === 'oracle' && personality.religiousFocus > 55) weight += 18;
      if (wonderId === 'petra' && personality.economyFocus > 60) weight += 14;
      addWonder(wonderId, weight);
    }
  }

  addUnit(pickCombatUnitType(techs), 10 + personality.aggressiveness / 12 + posture.threatLevel * 9);

  const viable = candidates.filter(candidate => candidate.weight > 0 && candidate.item.cost > 0);
  if (viable.length === 0) {
    return { type: 'unit', id: 'warrior', progress: 0, cost: UNITS.warrior.cost };
  }
  viable.sort((a, b) => b.weight - a.weight);
  const diversity = Math.min(3, viable.length);
  const pick = viable[Math.floor(rng() * diversity)]!.item;
  return posture.skill < 0.5 && rng() < 0.22 ? viable[0]!.item : pick;
}
