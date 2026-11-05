import type {
  TerrainType,
  YieldMap,
  BuildingDef,
  UnitDef,
  Technology,
  CivicDef,
  NaturalResource,
  ImprovementType,
  WeatherType,
  WonderId,
  TechId,
  Era,
  GreatPersonDef,
  GovernmentDef,
  PolicyCardDef,
  GovernmentType,
  CivTemplate,
} from './types';

// ============================================================
// TERRAIN YIELDS
// ============================================================
export const TERRAIN_YIELDS: Record<TerrainType, Partial<YieldMap>> = {
  ocean:     { food: 1 },
  coast:     { food: 1, gold: 1 },
  plains:    { food: 1, production: 1 },
  grassland: { food: 2 },
  desert:    { production: 0 },
  tundra:    { food: 1 },
  snow:      {},
  forest:    { food: 1, production: 1 },
  jungle:    { food: 2, science: 1 },
  hills:     { food: 0, production: 2 },
  mountains: {},
};

export const TERRAIN_MOVEMENT: Record<TerrainType, number> = {
  ocean: 1, coast: 1, plains: 1, grassland: 1,
  desert: 1, tundra: 2, snow: 2, forest: 2,
  jungle: 2, hills: 2, mountains: 99,
};

export const TERRAIN_DEFENSE: Record<TerrainType, number> = {
  ocean: 0, coast: 0, plains: 0, grassland: 0,
  desert: 0, tundra: 0, snow: 0, forest: 25,
  jungle: 25, hills: 25, mountains: 50,
};

/** Multiplier applied to per-turn gold income from cities (trade / upkeep feel). */
/** Turns after peace during which neither civ may declare war (treaty cooldown). */
export const DIPLO_PEACE_LOCK_TURNS = 10;

/** Max hex distance between capitals to establish a trade route. */
export const TRADE_ROUTE_MAX_HEX_DISTANCE = 22;
export const TRADE_ROUTE_GOLD_BASE = 3;
export const MAX_TRADE_ROUTES_PER_PAIR = 4;

export const ARMISTICE_DURATION_TURNS = 8;
/** Max gold tribute per direction in a single peace / armistice settlement. */
export const MAX_SETTLEMENT_GOLD_PER_DIRECTION = 250;
/** Armistice length bounds when negotiated (engine clamps). */
export const ARMISTICE_DURATION_MIN_TURNS = 4;
export const ARMISTICE_DURATION_MAX_TURNS = 24;
/** Minimum stored diplomatic favor to form an alliance (both sides must meet). */
export const ALLIANCE_MIN_DIPLOMATIC_FAVOR = 22;

export const WEATHER_GOLD_MULT: Record<WeatherType, number> = {
  clear: 1,
  rain: 0.94,
  storm: 0.88,
  snow: 0.91,
};

// ============================================================
// TERRAIN COLORS (low-poly palette)
// ============================================================
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  ocean:     '#2e6b8a',
  coast:     '#3d8fb5',
  plains:    '#c8b97a',
  grassland: '#6aaa5e',
  desert:    '#e8d5a3',
  tundra:    '#a0bfa0',
  snow:      '#e8eeee',
  forest:    '#3a7a3a',
  jungle:    '#2d6b2d',
  hills:     '#9e8e6e',
  mountains: '#7a7a8e',
};

export const TERRAIN_NAMES: Record<TerrainType, string> = {
  ocean: 'Ocean', coast: 'Coast', plains: 'Plains',
  grassland: 'Grassland', desert: 'Desert', tundra: 'Tundra',
  snow: 'Snow', forest: 'Forest', jungle: 'Jungle',
  hills: 'Hills', mountains: 'Mountains',
};

// ============================================================
// NATURAL RESOURCES
// ============================================================
export const NATURAL_RESOURCES: Record<string, NaturalResource> = {
  wheat:     { type: 'bonus',     name: 'Wheat',     yields: { food: 1 },                improvement: 'farm' },
  cattle:    { type: 'bonus',     name: 'Cattle',    yields: { food: 1, production: 1 }, improvement: 'pasture' },
  sheep:     { type: 'bonus',     name: 'Sheep',     yields: { food: 1 },                improvement: 'pasture' },
  fish:      { type: 'bonus',     name: 'Fish',      yields: { food: 2 },                improvement: 'fishing_boats' },
  deer:      { type: 'bonus',     name: 'Deer',      yields: { food: 1, production: 1 }, improvement: 'lumber_mill' },
  gold_ore:  { type: 'luxury',    name: 'Gold',      yields: { gold: 3 },                improvement: 'mine' },
  silver:    { type: 'luxury',    name: 'Silver',    yields: { gold: 2 },                improvement: 'mine' },
  gems:      { type: 'luxury',    name: 'Gems',      yields: { gold: 3, culture: 1 },    improvement: 'mine' },
  spices:    { type: 'luxury',    name: 'Spices',    yields: { food: 1, gold: 1 },       improvement: 'trading_post' },
  silk:      { type: 'luxury',    name: 'Silk',      yields: { gold: 2, culture: 1 },    improvement: 'trading_post' },
  iron:      { type: 'strategic', name: 'Iron',      yields: { production: 1 },          improvement: 'mine' },
  coal:      { type: 'strategic', name: 'Coal',      yields: { production: 2 },          improvement: 'mine' },
  oil:       { type: 'strategic', name: 'Oil',       yields: { production: 3 },          improvement: 'trading_post' },
  uranium:   { type: 'strategic', name: 'Uranium',   yields: { production: 2 },          improvement: 'mine' },
  horse:     { type: 'strategic', name: 'Horses',    yields: { food: 1, production: 1 }, improvement: 'pasture' },
};

// ============================================================
// IMPROVEMENTS
// ============================================================
export const IMPROVEMENT_YIELDS: Record<ImprovementType, Partial<YieldMap>> = {
  none:          {},
  farm:          { food: 1 },
  mine:          { production: 1 },
  lumber_mill:   { production: 2 },
  pasture:       { food: 1 },
  fishing_boats: { food: 2, gold: 1 },
  trading_post:  { gold: 2 },
};

// ============================================================
// BUILDINGS
// ============================================================
export const BUILDINGS: Record<string, BuildingDef> = {
  palace: {
    id: 'palace', name: 'Palace', cost: 0, maintenanceCost: 0,
    yields: { gold: 5, science: 3, culture: 2, production: 2 },
    description: 'The seat of your civilization\'s power.',
  },
  granary: {
    id: 'granary', name: 'Granary', cost: 65, maintenanceCost: 1,
    yields: { food: 2 },
    description: '+2 Food. Speeds population growth.',
  },
  monument: {
    id: 'monument', name: 'Monument', cost: 60, maintenanceCost: 0,
    yields: { culture: 2 },
    prerequisiteTech: 'pottery',
    description: '+2 Culture per turn.',
  },
  library: {
    id: 'library', name: 'Library', cost: 90, maintenanceCost: 1,
    yields: { science: 2 },
    prerequisiteTech: 'writing',
    description: '+2 Science per turn.',
  },
  barracks: {
    id: 'barracks', name: 'Barracks', cost: 75, maintenanceCost: 1,
    yields: { production: 1 },
    prerequisiteTech: 'bronze_working',
    description: '+1 Production. Units start with a promotion.',
  },
  market: {
    id: 'market', name: 'Market', cost: 120, maintenanceCost: 0,
    yields: { gold: 2 },
    prerequisiteTech: 'currency',
    description: '+2 Gold per turn.',
  },
  temple: {
    id: 'temple', name: 'Temple', cost: 120, maintenanceCost: 2,
    yields: { faith: 3, culture: 1 },
    prerequisiteTech: 'philosophy',
    description: '+3 Faith, +1 Culture per turn.',
  },
  workshop: {
    id: 'workshop', name: 'Workshop', cost: 100, maintenanceCost: 2,
    yields: { production: 2 },
    prerequisiteTech: 'metal_casting',
    description: '+2 Production per turn.',
  },
  aqueduct: {
    id: 'aqueduct', name: 'Aqueduct', cost: 100, maintenanceCost: 2,
    yields: { food: 3, production: 1 },
    prerequisiteTech: 'construction',
    description: '+3 Food. Allows larger population.',
  },
  university: {
    id: 'university', name: 'University', cost: 200, maintenanceCost: 3,
    yields: { science: 4 },
    prerequisiteTech: 'education',
    description: '+4 Science per turn.',
  },
  bank: {
    id: 'bank', name: 'Bank', cost: 220, maintenanceCost: 0,
    yields: { gold: 4 },
    prerequisiteTech: 'banking',
    description: '+4 Gold per turn.',
  },
  cathedral: {
    id: 'cathedral', name: 'Cathedral', cost: 200, maintenanceCost: 3,
    yields: { faith: 4, culture: 2 },
    prerequisiteTech: 'theology',
    description: '+4 Faith, +2 Culture per turn.',
  },
  factory: {
    id: 'factory', name: 'Factory', cost: 300, maintenanceCost: 4,
    yields: { production: 5 },
    prerequisiteTech: 'industrialization',
    description: '+5 Production per turn.',
  },
  power_plant: {
    id: 'power_plant', name: 'Power Plant', cost: 350, maintenanceCost: 5,
    yields: { production: 4, gold: 2 },
    prerequisiteTech: 'electricity',
    description: '+4 Production, +2 Gold per turn.',
  },
  research_lab: {
    id: 'research_lab', name: 'Research Lab', cost: 400, maintenanceCost: 5,
    yields: { science: 6 },
    prerequisiteTech: 'scientific_theory',
    description: '+6 Science per turn.',
  },
  stock_exchange: {
    id: 'stock_exchange', name: 'Stock Exchange', cost: 350, maintenanceCost: 3,
    yields: { gold: 6 },
    prerequisiteTech: 'capitalism',
    description: '+6 Gold per turn.',
  },
  broadcast_tower: {
    id: 'broadcast_tower', name: 'Broadcast Tower', cost: 400, maintenanceCost: 4,
    yields: { culture: 6, gold: 2 },
    prerequisiteTech: 'mass_media',
    description: '+6 Culture, +2 Gold per turn.',
  },
  space_port: {
    id: 'space_port', name: 'Space Port', cost: 1800, maintenanceCost: 10,
    yields: { science: 3, production: 3 },
    prerequisiteTech: 'rocketry',
    description: 'Required for the Science Victory.',
  },
  colosseum: {
    id: 'colosseum', name: 'Colosseum', cost: 150, maintenanceCost: 2,
    yields: { culture: 2, happiness: 2 },
    prerequisiteTech: 'iron_working',
    description: 'Entertainment and happiness for your empire.',
    amenities: 4,
    housing: 1,
  },
  entertainment_complex: {
    id: 'entertainment_complex', name: 'Entertainment Complex', cost: 220, maintenanceCost: 2,
    yields: { culture: 1, happiness: 1 },
    prerequisiteTech: 'industrialization',
    description: 'Boosts amenities in this city.',
    amenities: 6,
    housing: 1,
  },
};

// ============================================================
// UNITS
// ============================================================
export const UNITS: Record<string, UnitDef> = {
  settler: {
    id: 'settler', name: 'Settler', cost: 100, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'ancient', description: 'Found a new city.',
  },
  worker: {
    id: 'worker', name: 'Worker', cost: 75, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'ancient', description: 'Build improvements on tiles.',
  },
  warrior: {
    id: 'warrior', name: 'Warrior', cost: 40, maintenanceCost: 1,
    movement: 2, strength: 8, rangedStrength: 0, range: 0,
    era: 'ancient', description: 'Basic melee unit.',
  },
  archer: {
    id: 'archer', name: 'Archer', cost: 50, maintenanceCost: 1,
    movement: 2, strength: 5, rangedStrength: 8, range: 2,
    era: 'ancient', description: 'Ranged unit.',
    prerequisiteTech: 'archery',
  },
  spearman: {
    id: 'spearman', name: 'Spearman', cost: 55, maintenanceCost: 1,
    movement: 2, strength: 11, rangedStrength: 0, range: 0,
    era: 'ancient', prerequisiteTech: 'bronze_working',
    description: 'Strong against cavalry.',
  },
  horseman: {
    id: 'horseman', name: 'Horseman', cost: 80, maintenanceCost: 2,
    movement: 4, strength: 18, rangedStrength: 0, range: 0,
    era: 'classical', prerequisiteTech: 'horseback_riding',
    description: 'Fast cavalry unit.',
    requiredStrategicResources: { horse: 1 },
  },
  scout: {
    id: 'scout', name: 'Scout', cost: 50, maintenanceCost: 1,
    movement: 3, strength: 5, rangedStrength: 0, range: 0,
    era: 'ancient', prerequisiteTech: 'animal_husbandry',
    description: 'Fast explorer with extended sight and automatic map scouting.',
  },
  catapult: {
    id: 'catapult', name: 'Catapult', cost: 120, maintenanceCost: 2,
    movement: 2, strength: 8, rangedStrength: 14, range: 2,
    era: 'classical', prerequisiteTech: 'mathematics',
    description: 'Siege ranged unit.',
  },
  swordsman: {
    id: 'swordsman', name: 'Swordsman', cost: 90, maintenanceCost: 2,
    movement: 2, strength: 20, rangedStrength: 0, range: 0,
    era: 'classical', prerequisiteTech: 'iron_working',
    description: 'Strong melee unit.',
    requiredStrategicResources: { iron: 1 },
  },
  knight: {
    id: 'knight', name: 'Knight', cost: 150, maintenanceCost: 3,
    movement: 4, strength: 32, rangedStrength: 0, range: 0,
    era: 'medieval', prerequisiteTech: 'chivalry',
    description: 'Heavy cavalry unit.',
    requiredStrategicResources: { horse: 1 },
  },
  musketman: {
    id: 'musketman', name: 'Musketman', cost: 150, maintenanceCost: 3,
    movement: 2, strength: 38, rangedStrength: 0, range: 0,
    era: 'renaissance', prerequisiteTech: 'gunpowder',
    description: 'Early gunpowder infantry.',
  },
  cannon: {
    id: 'cannon', name: 'Cannon', cost: 200, maintenanceCost: 3,
    movement: 2, strength: 12, rangedStrength: 28, range: 2,
    era: 'renaissance', prerequisiteTech: 'chemistry',
    description: 'Powerful siege weapon.',
    requiredStrategicResources: { coal: 1 },
  },
  rifleman: {
    id: 'rifleman', name: 'Rifleman', cost: 200, maintenanceCost: 4,
    movement: 2, strength: 55, rangedStrength: 0, range: 0,
    era: 'industrial', prerequisiteTech: 'rifling',
    description: 'Industrial era infantry.',
  },
  cavalry: {
    id: 'cavalry', name: 'Cavalry', cost: 225, maintenanceCost: 4,
    movement: 5, strength: 62, rangedStrength: 0, range: 0,
    era: 'industrial', prerequisiteTech: 'military_science',
    description: 'Fast industrial era cavalry.',
    requiredStrategicResources: { horse: 1 },
  },
  artillery: {
    id: 'artillery', name: 'Artillery', cost: 300, maintenanceCost: 5,
    movement: 2, strength: 15, rangedStrength: 70, range: 3,
    era: 'industrial', prerequisiteTech: 'ballistics',
    description: 'Long-range siege unit.',
    requiredStrategicResources: { oil: 1 },
  },
  infantry: {
    id: 'infantry', name: 'Infantry', cost: 300, maintenanceCost: 5,
    movement: 2, strength: 80, rangedStrength: 0, range: 0,
    era: 'modern', prerequisiteTech: 'replaceable_parts',
    description: 'Modern infantry unit.',
  },
  tank: {
    id: 'tank', name: 'Tank', cost: 400, maintenanceCost: 6,
    movement: 4, strength: 90, rangedStrength: 0, range: 0,
    era: 'modern', prerequisiteTech: 'combustion',
    description: 'Powerful armored vehicle.',
    requiredStrategicResources: { oil: 1 },
  },
  fighter: {
    id: 'fighter', name: 'Fighter', cost: 350, maintenanceCost: 5,
    movement: 6, strength: 0, rangedStrength: 60, range: 3,
    era: 'modern', prerequisiteTech: 'flight',
    description: 'Air superiority unit.',
    requiredStrategicResources: { oil: 1 },
  },
  bomber: {
    id: 'bomber', name: 'Bomber', cost: 400, maintenanceCost: 6,
    movement: 6, strength: 0, rangedStrength: 80, range: 4,
    era: 'atomic', prerequisiteTech: 'advanced_flight',
    description: 'Strategic bombing aircraft.',
    requiredStrategicResources: { oil: 1 },
  },
  nuclear_missile: {
    id: 'nuclear_missile', name: 'Nuclear Missile', cost: 500, maintenanceCost: 0,
    movement: 10, strength: 0, rangedStrength: 200, range: 10,
    era: 'atomic', prerequisiteTech: 'nuclear_fission',
    description: 'City-destroying nuclear weapon.',
    requiredStrategicResources: { uranium: 1 },
  },
  great_general: {
    id: 'great_general', name: 'Great General', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'ancient', description: '+25% combat bonus to nearby units.',
  },
  great_scientist: {
    id: 'great_scientist', name: 'Great Scientist', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'ancient', description: 'Can instantly research a technology.',
  },
  great_artist: {
    id: 'great_artist', name: 'Great Artist', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'ancient', description: 'Can create a cultural landmark.',
  },
  missionary: {
    id: 'missionary', name: 'Missionary', cost: 90, maintenanceCost: 2,
    movement: 3, strength: 0, rangedStrength: 0, range: 0,
    era: 'classical', prerequisiteTech: 'philosophy',
    description: 'Spreads your religion into foreign cities (enter city tile).',
  },
  great_merchant: {
    id: 'great_merchant', name: 'Great Merchant', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'classical', description: 'Trade and diplomatic favor.',
  },
  great_engineer: {
    id: 'great_engineer', name: 'Great Engineer', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'classical', description: 'Accelerates wonder and space projects.',
  },
  great_writer: {
    id: 'great_writer', name: 'Great Writer', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'classical', description: 'Creates a Great Work of Writing.',
  },
  great_musician: {
    id: 'great_musician', name: 'Great Musician', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'industrial', description: 'Creates a Great Work of Music.',
  },
  great_prophet: {
    id: 'great_prophet', name: 'Great Prophet', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'ancient', description: 'Found a religion when faith allows.',
  },
  great_admiral: {
    id: 'great_admiral', name: 'Great Admiral', cost: 0, maintenanceCost: 0,
    movement: 2, strength: 0, rangedStrength: 0, range: 0,
    era: 'renaissance', description: 'Naval logistics and coastal defense.',
  },
};

// ============================================================
// WORLD WONDERS (global unique; built via city production)
// ============================================================
export type WonderDef = {
  name: string;
  cost: number;
  prerequisiteTech?: TechId;
  description: string;
  yields?: Partial<YieldMap>;
  diplomaticVictoryPoints?: number;
  /** Flat tourism added in tourism processing for owner. */
  tourismPerTurn?: number;
  /** Multiplier applied to owner's base tourism generation (e.g. 2 = +100%). */
  tourismMultiplierOwner?: number;
  greatWorkSlots?: Partial<Record<'art' | 'music' | 'writing' | 'artifact', number>>;
};

export const WONDERS: Record<WonderId, WonderDef> = {
  great_pyramid: {
    name: 'Great Pyramid',
    cost: 220,
    prerequisiteTech: 'pottery',
    description: '+2 Food in all your cities.',
    yields: { food: 2 },
  },
  hanging_gardens: {
    name: 'Hanging Gardens',
    cost: 200,
    prerequisiteTech: 'mathematics',
    description: '+1 Happiness empire-wide.',
    yields: { happiness: 1 },
  },
  oracle: {
    name: 'Oracle',
    cost: 180,
    prerequisiteTech: 'philosophy',
    description: '+2 Faith and +1 Culture in founding city.',
    yields: { faith: 2, culture: 1 },
  },
  great_library: {
    name: 'Great Library',
    cost: 280,
    prerequisiteTech: 'writing',
    description: '+3 Science in founding city.',
    yields: { science: 3 },
  },
  petra: {
    name: 'Petra',
    cost: 260,
    prerequisiteTech: 'currency',
    description: '+3 Gold and +1 Culture in desert cities.',
    yields: { gold: 3, culture: 1 },
  },
  angkor_wat: {
    name: 'Angkor Wat',
    cost: 420,
    prerequisiteTech: 'theology',
    description: '+2 Faith empire-wide.',
    yields: { faith: 2 },
  },
  big_ben: {
    name: 'Big Ben',
    cost: 680,
    prerequisiteTech: 'industrialization',
    description: '+5 Gold empire-wide.',
    yields: { gold: 5 },
  },
  statue_of_liberty: {
    name: 'Statue of Liberty',
    cost: 980,
    prerequisiteTech: 'replaceable_parts',
    description: 'Culture and diplomatic victory points.',
    yields: { culture: 2 },
    tourismPerTurn: 5,
    diplomaticVictoryPoints: 4,
  },
  eiffel_tower: {
    name: 'Eiffel Tower',
    cost: 800,
    prerequisiteTech: 'industrialization',
    description: 'Landmark tourism for the industrial age.',
    yields: { gold: 5, culture: 2 },
    tourismPerTurn: 15,
  },
  cristo_redentor: {
    name: 'Cristo Redentor',
    cost: 880,
    prerequisiteTech: 'mass_media',
    description: 'Doubles tourism from improvements and wonders.',
    yields: { faith: 4, culture: 3 },
    tourismMultiplierOwner: 2,
  },
  louvre: {
    name: 'The Louvre',
    cost: 920,
    prerequisiteTech: 'banking',
    description: 'Houses many great works of art.',
    yields: { culture: 4, gold: 2 },
    greatWorkSlots: { art: 5 },
  },
  mahabodhi_temple: {
    name: 'Mahabodhi Temple',
    cost: 600,
    prerequisiteTech: 'theology',
    description: 'Faith and diplomatic influence.',
    yields: { faith: 8, culture: 1 },
    diplomaticVictoryPoints: 2,
  },
  potala_palace: {
    name: 'Potala Palace',
    cost: 720,
    prerequisiteTech: 'astronomy',
    description: 'High mountain faith and diplomacy.',
    yields: { faith: 5, culture: 2 },
    diplomaticVictoryPoints: 1,
  },
  great_mosque_of_djenne: {
    name: 'Great Mosque of Djenné',
    cost: 640,
    prerequisiteTech: 'theology',
    description: 'Desert faith and diplomatic standing.',
    yields: { faith: 6 },
    diplomaticVictoryPoints: 2,
  },
};

// ============================================================
// TECHNOLOGY TREE
// ============================================================
export const TECHNOLOGIES: Record<string, Technology> = {
  // ANCIENT
  agriculture:      { id: 'agriculture',      name: 'Agriculture',       era: 'ancient',      cost: 20,   prerequisites: [],                           unlocks: ['farm', 'granary'],          description: 'Enables farming and the Granary.' },
  animal_husbandry: { id: 'animal_husbandry', name: 'Animal Husbandry',  era: 'ancient',      cost: 35,   prerequisites: ['agriculture'],              unlocks: ['pasture', 'horseman', 'scout'], description: 'Domestication of animals.' },
  archery:          { id: 'archery',           name: 'Archery',           era: 'ancient',      cost: 35,   prerequisites: ['agriculture'],              unlocks: ['archer'],                   description: 'Enables the Archer unit.' },
  mining:           { id: 'mining',            name: 'Mining',            era: 'ancient',      cost: 35,   prerequisites: ['agriculture'],              unlocks: ['mine'],                     description: 'Enables mines and quarries.' },
  pottery:          { id: 'pottery',           name: 'Pottery',           era: 'ancient',      cost: 35,   prerequisites: ['agriculture'],              unlocks: ['monument'],                 description: 'Enables pottery and the Monument.' },
  sailing:          { id: 'sailing',           name: 'Sailing',           era: 'ancient',      cost: 55,   prerequisites: ['pottery'],                  unlocks: ['fishing_boats'],            description: 'Embarkation: move onto coast and ocean (open ocean still needs age/navigation unlocks). Enables fishing.' },
  writing:          { id: 'writing',           name: 'Writing',           era: 'ancient',      cost: 55,   prerequisites: ['pottery'],                  unlocks: ['library'],                  description: 'Enables the Library.' },
  bronze_working:   { id: 'bronze_working',    name: 'Bronze Working',    era: 'ancient',      cost: 55,   prerequisites: ['mining'],                   unlocks: ['spearman', 'barracks'],     description: 'Enables the Spearman and Barracks.' },
  trapping:         { id: 'trapping',          name: 'Trapping',          era: 'ancient',      cost: 55,   prerequisites: ['animal_husbandry'],         unlocks: ['lumber_mill'],              description: 'Enables lumber mills.' },

  // CLASSICAL
  horseback_riding: { id: 'horseback_riding',  name: 'Horseback Riding',  era: 'classical',    cost: 100,  prerequisites: ['animal_husbandry'],         unlocks: ['horseman'],                 description: 'Enables the Horseman unit.' },
  mathematics:      { id: 'mathematics',       name: 'Mathematics',       era: 'classical',    cost: 100,  prerequisites: ['writing'],                  unlocks: ['catapult'],                 description: 'Enables the Catapult.' },
  iron_working:     { id: 'iron_working',      name: 'Iron Working',      era: 'classical',    cost: 150,  prerequisites: ['bronze_working'],           unlocks: ['swordsman'],                description: 'Enables iron mining and Swordsman.' },
  currency:         { id: 'currency',          name: 'Currency',          era: 'classical',    cost: 120,  prerequisites: ['writing', 'mining'],        unlocks: ['market', 'trading_post'],   description: 'Enables markets and trade.' },
  construction:     { id: 'construction',      name: 'Construction',      era: 'classical',    cost: 130,  prerequisites: ['mathematics'],              unlocks: ['aqueduct'],                 description: 'Enables the Aqueduct.' },
  philosophy:       { id: 'philosophy',        name: 'Philosophy',        era: 'classical',    cost: 120,  prerequisites: ['writing'],                  unlocks: ['temple'],                   description: 'Enables the Temple and religious thinking.' },
  drama_poetry:     { id: 'drama_poetry',      name: 'Drama & Poetry',    era: 'classical',    cost: 120,  prerequisites: ['philosophy'],               unlocks: [],                           description: 'Cultural development.' },

  // MEDIEVAL
  metal_casting:    { id: 'metal_casting',     name: 'Metal Casting',     era: 'medieval',     cost: 240,  prerequisites: ['iron_working'],             unlocks: ['workshop'],                 description: 'Enables the Workshop.' },
  theology:         { id: 'theology',          name: 'Theology',          era: 'medieval',     cost: 250,  prerequisites: ['philosophy'],               unlocks: ['cathedral'],                description: 'Enables the Cathedral.' },
  chivalry:         { id: 'chivalry',          name: 'Chivalry',          era: 'medieval',     cost: 290,  prerequisites: ['horseback_riding'],         unlocks: ['knight'],                   description: 'Enables the Knight.' },
  education:        { id: 'education',         name: 'Education',         era: 'medieval',     cost: 360,  prerequisites: ['theology', 'mathematics'],  unlocks: ['university'],               description: 'Enables the University.' },
  compass:          { id: 'compass',           name: 'Compass',           era: 'medieval',     cost: 260,  prerequisites: ['sailing'],                  unlocks: [],                           description: 'Improved navigation.' },

  // RENAISSANCE
  gunpowder:        { id: 'gunpowder',         name: 'Gunpowder',         era: 'renaissance',  cost: 440,  prerequisites: ['chemistry', 'chivalry'],    unlocks: ['musketman'],                description: 'Enables Musketman.' },
  chemistry:        { id: 'chemistry',         name: 'Chemistry',         era: 'renaissance',  cost: 420,  prerequisites: ['education'],               unlocks: ['cannon'],                   description: 'Enables the Cannon.' },
  banking:          { id: 'banking',           name: 'Banking',           era: 'renaissance',  cost: 420,  prerequisites: ['currency', 'education'],    unlocks: ['bank'],                     description: 'Enables the Bank.' },
  astronomy:        { id: 'astronomy',         name: 'Astronomy',         era: 'renaissance',  cost: 460,  prerequisites: ['compass', 'education'],     unlocks: [],                           description: 'Exploration and science.' },
  printing_press:   { id: 'printing_press',    name: 'Printing Press',    era: 'renaissance',  cost: 460,  prerequisites: ['education', 'drama_poetry'],unlocks: [],                           description: 'Mass communication.' },
  engineering:      { id: 'engineering',       name: 'Engineering',       era: 'renaissance',  cost: 400,  prerequisites: ['education', 'metal_casting'],   unlocks: [],                           description: 'Advanced construction and logistics.' },

  // INDUSTRIAL
  industrialization:{ id: 'industrialization', name: 'Industrialization', era: 'industrial',   cost: 680,  prerequisites: ['chemistry'],                unlocks: ['factory'],                  description: 'Enables the Factory.' },
  rifling:          { id: 'rifling',           name: 'Rifling',           era: 'industrial',   cost: 680,  prerequisites: ['gunpowder', 'chemistry'],   unlocks: ['rifleman'],                 description: 'Enables the Rifleman.' },
  military_science: { id: 'military_science',  name: 'Military Science',  era: 'industrial',   cost: 680,  prerequisites: ['chivalry', 'gunpowder'],    unlocks: ['cavalry'],                  description: 'Enables Cavalry.' },
  ballistics:       { id: 'ballistics',        name: 'Ballistics',        era: 'industrial',   cost: 740,  prerequisites: ['rifling'],                  unlocks: ['artillery'],                description: 'Enables Artillery.' },
  scientific_theory:{ id: 'scientific_theory', name: 'Scientific Theory', era: 'industrial',   cost: 740,  prerequisites: ['astronomy', 'banking'],     unlocks: ['research_lab'],             description: 'Enables the Research Lab.' },
  electricity:      { id: 'electricity',       name: 'Electricity',       era: 'industrial',   cost: 780,  prerequisites: ['industrialization'],        unlocks: ['power_plant'],              description: 'Enables the Power Plant.' },
  capitalism:       { id: 'capitalism',        name: 'Capitalism',        era: 'industrial',   cost: 760,  prerequisites: ['banking', 'industrialization'],unlocks: ['stock_exchange'],         description: 'Enables the Stock Exchange.' },

  // MODERN
  replaceable_parts:{ id: 'replaceable_parts', name: 'Replaceable Parts', era: 'modern',       cost: 1100, prerequisites: ['ballistics'],              unlocks: ['infantry'],                 description: 'Enables Infantry.' },
  combustion:       { id: 'combustion',        name: 'Combustion',        era: 'modern',       cost: 1100, prerequisites: ['electricity'],             unlocks: ['tank'],                     description: 'Enables the Tank.' },
  flight:           { id: 'flight',            name: 'Flight',            era: 'modern',       cost: 1100, prerequisites: ['combustion'],              unlocks: ['fighter'],                  description: 'Enables the Fighter aircraft.' },
  mass_media:       { id: 'mass_media',        name: 'Mass Media',        era: 'modern',       cost: 1100, prerequisites: ['electricity', 'printing_press'],unlocks: ['broadcast_tower'],      description: 'Enables the Broadcast Tower.' },
  plastics:         { id: 'plastics',          name: 'Plastics',          era: 'modern',       cost: 1200, prerequisites: ['combustion', 'scientific_theory'],unlocks: [],                    description: 'Advanced materials.' },

  // ATOMIC
  advanced_flight:  { id: 'advanced_flight',   name: 'Advanced Flight',   era: 'atomic',       cost: 1400, prerequisites: ['flight'],                  unlocks: ['bomber'],                   description: 'Enables the Bomber.' },
  nuclear_fission:  { id: 'nuclear_fission',   name: 'Nuclear Fission',   era: 'atomic',       cost: 1500, prerequisites: ['plastics'],               unlocks: ['nuclear_missile'],          description: 'Enables Nuclear Missiles.' },
  rocketry:         { id: 'rocketry',          name: 'Rocketry',          era: 'atomic',       cost: 1600, prerequisites: ['advanced_flight', 'plastics'],unlocks: ['space_port'],            description: 'Enables the Space Port.' },
  radar:            { id: 'radar',             name: 'Radar',             era: 'atomic',       cost: 1400, prerequisites: ['advanced_flight'],         unlocks: [],                           description: 'Improved detection.' },

  // INFORMATION
  computers:        { id: 'computers',         name: 'Computers',         era: 'information',  cost: 1800, prerequisites: ['nuclear_fission', 'radar'], unlocks: [],                          description: 'Digital age technology.' },
  satellites:       { id: 'satellites',        name: 'Satellites',        era: 'information',  cost: 2000, prerequisites: ['rocketry', 'computers'],   unlocks: [],                           description: 'Space exploration technology.' },
  lasers:           { id: 'lasers',            name: 'Lasers',            era: 'information',  cost: 2000, prerequisites: ['computers'],               unlocks: [],                           description: 'Advanced energy weapons.' },
  nanotechnology:   { id: 'nanotechnology',    name: 'Nanotechnology',    era: 'information',  cost: 2200, prerequisites: ['lasers', 'satellites'],    unlocks: [],                           description: 'Enables the Space Ship for Science Victory.' },
  seasteads:         { id: 'seasteads',         name: 'Seasteads',         era: 'information',  cost: 2400, prerequisites: ['plastics', 'satellites'],   unlocks: [],                           description: '+1 Diplomatic Victory Point when first researched.' },
};

// ============================================================
// GREAT PEOPLE & GOVERNMENT
// ============================================================
export const GREAT_PEOPLE: Record<string, GreatPersonDef> = {
  newton: {
    id: 'newton', name: 'Isaac Newton', type: 'scientist', era: 'classical',
    uniqueAbility: '+20% science in cities with a Library.',
    bonusDescription: 'Scientific revolution',
  },
  einstein: {
    id: 'einstein', name: 'Albert Einstein', type: 'scientist', era: 'modern',
    uniqueAbility: 'Grants a burst of science when activated.',
    bonusDescription: 'Relativity breakthrough',
  },
  curie: {
    id: 'curie', name: 'Marie Curie', type: 'scientist', era: 'industrial',
    uniqueAbility: '+10% science empire-wide.',
    bonusDescription: 'Radioactivity research',
  },
  goddard: {
    id: 'goddard', name: 'Robert H. Goddard', type: 'engineer', era: 'modern',
    uniqueAbility: '+25% production toward space projects from Space Ports.',
    bonusDescription: 'Liquid-fueled rocketry',
    spaceProjectProductionBonus: 0.25,
  },
  von_braun: {
    id: 'von_braun', name: 'Wernher von Braun', type: 'engineer', era: 'atomic',
    uniqueAbility: '+30% production toward space projects from Space Ports.',
    bonusDescription: 'Moon program architect',
    spaceProjectProductionBonus: 0.3,
  },
  shakespeare: {
    id: 'shakespeare', name: 'William Shakespeare', type: 'writer', era: 'renaissance',
    uniqueAbility: 'Creates a Great Work of Writing.',
    bonusDescription: 'Globe Theatre',
  },
  beethoven: {
    id: 'beethoven', name: 'Ludwig van Beethoven', type: 'musician', era: 'industrial',
    uniqueAbility: 'Creates a Great Work of Music.',
    bonusDescription: 'Symphonic mastery',
  },
  michelangelo: {
    id: 'michelangelo', name: 'Michelangelo', type: 'artist', era: 'renaissance',
    uniqueAbility: 'Creates a Great Work of Art.',
    bonusDescription: 'High Renaissance',
  },
  sun_tzu: {
    id: 'sun_tzu', name: 'Sun Tzu', type: 'general', era: 'classical',
    uniqueAbility: '+25% combat strength for units near this general.',
    bonusDescription: 'The Art of War',
  },
  napoleon_gp: {
    id: 'napoleon_gp', name: 'Napoleon Bonaparte', type: 'general', era: 'industrial',
    uniqueAbility: 'Grants a combat bonus to adjacent corps.',
    bonusDescription: 'Grande Armée',
  },
  rockefeller: {
    id: 'rockefeller', name: 'John D. Rockefeller', type: 'merchant', era: 'industrial',
    uniqueAbility: '+8 gold per turn in the activation city.',
    bonusDescription: 'Standard Oil',
  },
  zheng_he: {
    id: 'zheng_he', name: 'Zheng He', type: 'admiral', era: 'renaissance',
    uniqueAbility: '+15% gold from trade routes while alive.',
    bonusDescription: 'Treasure fleet',
  },
  laozi: {
    id: 'laozi', name: 'Laozi', type: 'prophet', era: 'classical',
    uniqueAbility: 'Bonus faith toward founding.',
    bonusDescription: 'Dao',
  },
};

export const GOVERNMENTS: Record<GovernmentType, GovernmentDef> = {
  chiefdom: {
    id: 'chiefdom', name: 'Chiefdom', era: 'ancient', yields: {}, policySlots: 0,
    description: 'Basic tribal organization.',
  },
  monarchy: {
    id: 'monarchy', name: 'Monarchy', era: 'medieval', yields: { gold: 2, production: 1 }, policySlots: 2,
    description: 'Centralized royal authority.',
  },
  theocracy: {
    id: 'theocracy', name: 'Theocracy', era: 'medieval', yields: { faith: 4, culture: 1 }, policySlots: 2,
    description: 'Rule by divine mandate.',
  },
  merchant_republic: {
    id: 'merchant_republic', name: 'Merchant Republic', era: 'renaissance',
    yields: { gold: 4, culture: 1 }, policySlots: 3,
    description: 'Trade-focused oligarchy.',
  },
  democracy: {
    id: 'democracy', name: 'Democracy', era: 'modern', yields: { culture: 3, happiness: 2 }, policySlots: 4,
    description: 'Citizen rule and cultural output.',
  },
  communism: {
    id: 'communism', name: 'Communism', era: 'modern', yields: { production: 4, science: 2 }, policySlots: 3,
    description: 'Planned industrial economy.',
  },
  fascism: {
    id: 'fascism', name: 'Fascism', era: 'modern', yields: { production: 3, happiness: -1 }, policySlots: 4,
    description: 'Militarized mass state.',
  },
};

export const POLICY_CARDS: Record<string, PolicyCardDef> = {
  discipline: {
    id: 'discipline', name: 'Discipline', type: 'military', era: 'ancient',
    militaryBonus: 5, description: '+5 strength for melee units.',
  },
  urban_planning: {
    id: 'urban_planning', name: 'Urban Planning', type: 'economic', era: 'ancient',
    yields: { culture: 1 }, description: '+1 culture per turn.',
  },
  god_king: {
    id: 'god_king', name: 'God King', type: 'religious', era: 'ancient',
    yields: { faith: 1, gold: 1 }, description: 'Faith and gold from government.',
  },
  conscription: {
    id: 'conscription', name: 'Conscription', type: 'military', era: 'classical',
    yields: { production: 2 }, description: '+2 production in all cities.',
  },
  trade_confederation: {
    id: 'trade_confederation', name: 'Trade Confederation', type: 'economic', era: 'classical',
    yields: { gold: 3 }, description: 'Stronger trade income.',
  },
  literary_tradition: {
    id: 'literary_tradition', name: 'Literary Tradition', type: 'cultural', era: 'classical',
    yields: { culture: 2 }, description: '+2 culture per turn.',
  },
  pilgrimage: {
    id: 'pilgrimage', name: 'Pilgrimage', type: 'religious', era: 'classical',
    yields: { faith: 2 }, description: '+2 faith per turn.',
  },
  professional_army: {
    id: 'professional_army', name: 'Professional Army', type: 'military', era: 'medieval',
    militaryBonus: 10, description: '+10 combat strength.',
  },
  gothic_architecture: {
    id: 'gothic_architecture', name: 'Gothic Architecture', type: 'cultural', era: 'medieval',
    yields: { culture: 3, faith: 1 }, description: 'Faith and culture.',
  },
  public_transport: {
    id: 'public_transport', name: 'Public Transport', type: 'economic', era: 'industrial',
    yields: { production: 2, gold: 2 }, description: 'Industrial mobility.',
  },
  diplomatic_corps: {
    id: 'diplomatic_corps', name: 'Diplomatic Corps', type: 'diplomatic', era: 'modern',
    yields: { culture: 1 }, description: '+2 diplomatic favor per peaceful turn (engine).',
  },
};

export const BELIEFS: Record<string, { yields?: Partial<YieldMap>; description: string }> = {
  faith_from_holy_site: { yields: { faith: 2 }, description: 'Holy sites yield more faith.' },
  gold_from_temples: { yields: { gold: 1 }, description: 'Temples yield gold.' },
  culture_from_monasteries: { yields: { culture: 1 }, description: 'Temples yield culture.' },
  zen_meditation: { yields: { happiness: 1 }, description: 'Extra amenities from faith.' },
};

export const GP_BASE_COST_BY_ERA: Record<Era, number> = {
  ancient: 60,
  classical: 80,
  medieval: 120,
  renaissance: 240,
  industrial: 420,
  modern: 660,
  atomic: 960,
  information: 1320,
};

export function getGreatPersonCost(era: Era, personIndex: number): number {
  const base = GP_BASE_COST_BY_ERA[era] ?? 100;
  return Math.floor(base * (1 + personIndex * 0.08));
}

export const DIPLOMACY_VICTORY_POINTS_REQUIRED = 15;

/** Turns before the legacy path prompt reappears after the player taps “Later”. */
export const LEGACY_PROMPT_SNOOZE_TURNS = 3;
/** Turns before the crisis policy prompt reappears after “Later” (crisis stays active). */
export const CRISIS_POLICY_PROMPT_SNOOZE_TURNS = 2;

export const SPACE_RACE_STAGE_COSTS = {
  satellite: 520,
  moon: 880,
  mars: 1280,
} as const;

export interface AIWeights {
  aggressiveness: number;
  expansionist: boolean;
  culturalFocus: number;
  scientificFocus: number;
  religiousFocus: number;
  diplomaticFocus: number;
  economyFocus: number;
}

export const AI_PERSONALITIES: Record<string, AIWeights> = {
  AGGRESSIVE: {
    aggressiveness: 80,
    expansionist: true,
    culturalFocus: 25,
    scientificFocus: 45,
    religiousFocus: 15,
    diplomaticFocus: 20,
    economyFocus: 35,
  },
  BUILDER: {
    aggressiveness: 22,
    expansionist: true,
    culturalFocus: 35,
    scientificFocus: 50,
    religiousFocus: 30,
    diplomaticFocus: 40,
    economyFocus: 88,
  },
  CULTURED: {
    aggressiveness: 30,
    expansionist: false,
    culturalFocus: 85,
    scientificFocus: 60,
    religiousFocus: 40,
    diplomaticFocus: 55,
    economyFocus: 45,
  },
  SCIENTIST: {
    aggressiveness: 25,
    expansionist: false,
    culturalFocus: 40,
    scientificFocus: 92,
    religiousFocus: 25,
    diplomaticFocus: 35,
    economyFocus: 50,
  },
  RELIGIOUS: {
    aggressiveness: 28,
    expansionist: false,
    culturalFocus: 40,
    scientificFocus: 35,
    religiousFocus: 92,
    diplomaticFocus: 45,
    economyFocus: 35,
  },
  /** Jack-of-all-trades rival — unpredictable but solid fundamentals. */
  BALANCED: {
    aggressiveness: 48,
    expansionist: true,
    culturalFocus: 48,
    scientificFocus: 55,
    religiousFocus: 38,
    diplomaticFocus: 48,
    economyFocus: 62,
  },
  /** Prioritizes cities and workers; less random expansion. */
  EXPANSIONIST: {
    aggressiveness: 42,
    expansionist: true,
    culturalFocus: 32,
    scientificFocus: 52,
    religiousFocus: 22,
    diplomaticFocus: 35,
    economyFocus: 78,
  },
  /** Turtles, trades, and techs up; strikes when clearly ahead. */
  DEFENSIVE: {
    aggressiveness: 35,
    expansionist: false,
    culturalFocus: 42,
    scientificFocus: 72,
    religiousFocus: 28,
    diplomaticFocus: 62,
    economyFocus: 70,
  },
  /** Warmonger with enough economy to sustain campaigns. */
  CONQUEROR: {
    aggressiveness: 88,
    expansionist: true,
    culturalFocus: 28,
    scientificFocus: 48,
    religiousFocus: 18,
    diplomaticFocus: 25,
    economyFocus: 55,
  },
};

// ============================================================
// CIVILIZATIONS
// ============================================================
export const CIV_TEMPLATES: CivTemplate[] = [
  {
    id: 'roman_empire',
    name: 'Roman Empire',
    adjective: 'Roman',
    leader: 'Augustus Caesar',
    color: '#c0392b',
    secondaryColor: '#f4d03f',
    bonuses: { productionPct: 8, goldPct: 5 },
  },
  {
    id: 'chinese_dynasty',
    name: 'Chinese Dynasty',
    adjective: 'Chinese',
    leader: 'Wu Zetian',
    color: '#e74c3c',
    secondaryColor: '#f39c12',
    bonuses: { sciencePct: 10, culturePct: 5 },
  },
  {
    id: 'greek_city_states',
    name: 'Greek City-States',
    adjective: 'Greek',
    leader: 'Pericles',
    color: '#2980b9',
    secondaryColor: '#f1c40f',
    bonuses: { culturePct: 12, diplomaticFavorFlat: 1 },
  },
  {
    id: 'egyptian_kingdom',
    name: 'Egyptian Kingdom',
    adjective: 'Egyptian',
    leader: 'Cleopatra',
    color: '#f39c12',
    secondaryColor: '#2ecc71',
    bonuses: { foodPct: 10, goldPct: 6 },
  },
  {
    id: 'arabian_caliphate',
    name: 'Arabian Caliphate',
    adjective: 'Arabian',
    leader: 'Harun al-Rashid',
    color: '#27ae60',
    secondaryColor: '#f39c12',
    bonuses: { faithPct: 10, sciencePct: 6 },
  },
  {
    id: 'viking_norsemen',
    name: 'Viking Norsemen',
    adjective: 'Norse',
    leader: 'Harald Bluetooth',
    color: '#8e44ad',
    secondaryColor: '#e74c3c',
    bonuses: { combatStrengthPct: 9, productionPct: 4 },
  },
  {
    id: 'aztec_empire',
    name: 'Aztec Empire',
    adjective: 'Aztec',
    leader: 'Montezuma',
    color: '#16a085',
    secondaryColor: '#e74c3c',
    bonuses: { combatStrengthPct: 8, happinessPct: 6 },
  },
  {
    id: 'mongol_horde',
    name: 'Mongol Horde',
    adjective: 'Mongol',
    leader: 'Genghis Khan',
    color: '#795548',
    secondaryColor: '#f39c12',
    bonuses: { combatStrengthPct: 12 },
  },
  {
    id: 'inca_empire',
    name: 'Inca Empire',
    adjective: 'Incan',
    leader: 'Pachacuti',
    color: '#d35400',
    secondaryColor: '#f4d03f',
    bonuses: { foodPct: 8, productionPct: 8 },
  },
  {
    id: 'persian_empire',
    name: 'Persian Empire',
    adjective: 'Persian',
    leader: 'Cyrus the Great',
    color: '#8e44ad',
    secondaryColor: '#3498db',
    bonuses: { goldPct: 7, diplomaticFavorFlat: 1 },
  },
  {
    id: 'babylonian_empire',
    name: 'Babylonian Empire',
    adjective: 'Babylonian',
    leader: 'Hammurabi',
    color: '#c87f0a',
    secondaryColor: '#2c3e50',
    bonuses: { sciencePct: 12 },
  },
  {
    id: 'japanese_empire',
    name: 'Japanese Empire',
    adjective: 'Japanese',
    leader: 'Oda Nobunaga',
    color: '#bc002d',
    secondaryColor: '#1a1a2e',
    bonuses: { combatStrengthPct: 10, culturePct: 4 },
  },
  {
    id: 'french_empire',
    name: 'French Empire',
    adjective: 'French',
    leader: 'Napoleon Bonaparte',
    color: '#0055a4',
    secondaryColor: '#ef4135',
    bonuses: { combatStrengthPct: 9, culturePct: 5 },
  },
  {
    id: 'british_empire',
    name: 'British Empire',
    adjective: 'British',
    leader: 'Queen Victoria',
    color: '#012169',
    secondaryColor: '#c8102e',
    bonuses: { productionPct: 8, goldPct: 8 },
  },
  {
    id: 'spanish_empire',
    name: 'Spanish Empire',
    adjective: 'Spanish',
    leader: 'Isabella I',
    color: '#aa151b',
    secondaryColor: '#f1bf00',
    bonuses: { faithPct: 9, goldPct: 6 },
  },
  {
    id: 'ethiopian_kingdom',
    name: 'Ethiopian Kingdom',
    adjective: 'Ethiopian',
    leader: 'Haile Selassie',
    color: '#078930',
    secondaryColor: '#fcd116',
    bonuses: { faithPct: 8, culturePct: 7 },
  },
];

/**
 * Approximate homelands (longitude °E, latitude °N) for the "Earth" map type.
 * Order must match `CIV_TEMPLATES` exactly (one entry per template).
 */
export const EARTH_CIV_START_LAT_LON: ReadonlyArray<{ lon: number; lat: number }> = [
  { lon: 12.49, lat: 41.89 }, // Roman Empire — Rome
  { lon: 116.39, lat: 39.92 }, // Chinese Dynasty — Beijing
  { lon: 23.73, lat: 37.98 }, // Greek City-States — Athens
  { lon: 31.24, lat: 30.04 }, // Egyptian Kingdom — lower Nile / Memphis–Cairo
  { lon: 39.83, lat: 21.42 }, // Arabian Caliphate — Hejaz / Mecca
  { lon: 10.75, lat: 59.91 }, // Viking Norsemen — Oslo fjord
  { lon: -99.13, lat: 19.43 }, // Aztec Empire — Valley of Mexico
  { lon: 106.91, lat: 47.92 }, // Mongol Horde — Mongolian steppe / Ulaanbaatar
  { lon: -71.98, lat: -13.52 }, // Inca Empire — Cusco
  { lon: 52.89, lat: 29.62 }, // Persian Empire — Shiraz / Persepolis region
  { lon: 44.42, lat: 33.32 }, // Babylonian Empire — Mesopotamia / Baghdad
  { lon: 135.77, lat: 35.01 }, // Japanese Empire — Kyoto
  { lon: 2.35, lat: 48.86 }, // French Empire — Paris
  { lon: -0.13, lat: 51.51 }, // British Empire — London
  { lon: -3.7, lat: 40.42 }, // Spanish Empire — Madrid
  { lon: 38.75, lat: 9.03 }, // Ethiopian Kingdom — Ethiopian highlands
];

export function getCivTemplateByName(name: string): CivTemplate | null {
  return CIV_TEMPLATES.find(c => c.name === name) ?? null;
}

// ============================================================
// CITY NAMES BY CIVILIZATION
// ============================================================
export const CIV_CITY_NAMES: Record<string, string[]> = {
  'Roman Empire':      ['Rome','Antium','Cumae','Neapolis','Ravenna','Arretium','Mediolanum','Aquileia','Caesarea','Lugdunum','Carthage'],
  'Chinese Dynasty':   ['Beijing','Xian','Chengdu','Shanghai','Nanjing','Hangzhou','Guangzhou','Wuhan','Tianjin','Shenyang','Qingdao'],
  'Greek City-States': ['Athens','Sparta','Corinth','Argos','Delphi','Thessaloniki','Heraklion','Mycenae','Thebes','Rhodes','Olympia'],
  'Egyptian Kingdom':  ['Memphis','Thebes','Heliopolis','Alexandria','Giza','Luxor','Aswan','Abydos','Edfu','Karnak','Amarna'],
  'Arabian Caliphate': ['Mecca','Medina','Baghdad','Damascus','Cairo','Basra','Kufa','Mosul','Aleppo','Aden','Muscat'],
  'Viking Norsemen':   ['Oslo','Uppsala','Trondheim','Bergen','Stavanger','Aarhus','Ribe','Hedeby','Birka','Sigtuna','Jomsborg'],
  'Aztec Empire':      ['Tenochtitlan','Texcoco','Tlacopan','Tlatelolco','Xochimilco','Chalco','Huexotla','Acolman','Tepexpan','Zumpango','Tezontepec'],
  'Mongol Horde':      ['Karakorum','Samarkand','Bukhara','Shangdu','Tabriz','Urgench','Astrakhan','Beshbaliq','Almaliq','Zhongdu','Khanbaliq'],
  'Inca Empire':       ['Cusco','Machu','Ollantaytambo','Sacsayhuaman','Pisac','Arequipa','Nazca','Chan Chan','Tumbes','Quito','Vilcabamba'],
  'Persian Empire':    ['Persepolis','Pasargadae','Susa','Ecbatana','Bactra','Gaugamela','Rhages','Hyrcania','Sardis','Babylon','Tyre'],
  'Babylonian Empire': ['Babylon','Ur','Uruk','Nippur','Lagash','Eridu','Isin','Mari','Nineveh','Assur','Sippar'],
  'Japanese Empire':   ['Kyoto','Osaka','Edo','Nagoya','Hiroshima','Fukuoka','Sapporo','Kobe','Yokohama','Sendai','Nara'],
  'French Empire':     ['Paris','Lyon','Marseille','Toulouse','Bordeaux','Nantes','Strasbourg','Rouen','Reims','Versailles','Nice'],
  'British Empire':    ['London','York','Manchester','Birmingham','Liverpool','Edinburgh','Glasgow','Cardiff','Bristol','Oxford','Cambridge'],
  'Spanish Empire':    ['Madrid','Toledo','Seville','Barcelona','Valencia','Granada','Cordoba','Bilbao','Salamanca','Zaragoza','Cadiz'],
  'Ethiopian Kingdom': ['Axum','Lalibela','Gondar','Harar','Dire Dawa','Bahir Dar','Jimma','Mekelle','Adwa','Debre Berhan','Awasa'],
};

// ============================================================
// ERA LABELS
// ============================================================
export const ERA_LABELS: Record<string, string> = {
  ancient: 'Ancient Era', classical: 'Classical Era', medieval: 'Medieval Era',
  renaissance: 'Renaissance', industrial: 'Industrial Era', modern: 'Modern Era',
  atomic: 'Atomic Era', information: 'Information Age',
};

// ============================================================
// RESOURCE ICONS
// ============================================================
export const RESOURCE_ICONS: Record<string, string> = {
  food: 'FD', production: 'PR', gold: 'GD', science: 'SC',
  culture: 'CL', faith: 'FA', happiness: 'HP',
};

// ============================================================
// YIELD COLORS
// ============================================================
export const RESOURCE_COLORS: Record<string, string> = {
  food: '#27ae60', production: '#e67e22', gold: '#f1c40f',
  science: '#3498db', culture: '#9b59b6', faith: '#1abc9c', happiness: '#e91e63',
};

export const TECH_ERA_COLORS: Record<string, string> = {
  ancient: '#8B4513', classical: '#DAA520', medieval: '#4682B4',
  renaissance: '#2E8B57', industrial: '#708090', modern: '#4169E1',
  atomic: '#DC143C', information: '#00CED1',
};

export const DIFFICULTY_MODIFIERS: Record<string, number> = {
  settler: 0.5, chieftain: 0.75, warlord: 1.0, prince: 1.25, emperor: 1.5, deity: 2.0,
};

export const CIVICS: Record<string, CivicDef> = {
  code_of_laws: {
    id: 'code_of_laws',
    name: 'Code of Laws',
    era: 'ancient',
    cost: 18,
    prerequisites: [],
    unlocks: ['urban_planning'],
    description: 'Foundational governance that enables early policy shaping.',
  },
  craftsmanship: {
    id: 'craftsmanship',
    name: 'Craftsmanship',
    era: 'ancient',
    cost: 28,
    prerequisites: ['code_of_laws'],
    unlocks: ['agoge', 'ilkum'],
    description: 'Improves labor organization and unit support.',
  },
  state_workforce: {
    id: 'state_workforce',
    name: 'State Workforce',
    era: 'classical',
    cost: 42,
    prerequisites: ['craftsmanship'],
    unlocks: ['conscription'],
    description: 'Expands administration and civic bureaucracy.',
  },
  political_philosophy: {
    id: 'political_philosophy',
    name: 'Political Philosophy',
    era: 'classical',
    cost: 58,
    prerequisites: ['state_workforce'],
    unlocks: ['charismatic_leader'],
    description: 'Unlocks stronger statecraft and diplomatic doctrines.',
  },
  civil_service: {
    id: 'civil_service',
    name: 'Civil Service',
    era: 'medieval',
    cost: 78,
    prerequisites: ['political_philosophy'],
    unlocks: ['meritocracy'],
    description: 'Improves governance capacity and civic throughput.',
  },
  future_society: {
    id: 'future_society',
    name: 'Future Society',
    era: 'information',
    cost: 140,
    prerequisites: ['civil_service'],
    unlocks: [],
    description: 'Repeatable late-game civic that keeps institutional progress active.',
  },
};
