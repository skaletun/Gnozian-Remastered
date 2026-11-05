// ============================================================
// GNOZIAN — Core Type Definitions
// ============================================================

export type TerrainType =
  | 'ocean'
  | 'coast'
  | 'plains'
  | 'grassland'
  | 'desert'
  | 'tundra'
  | 'snow'
  | 'forest'
  | 'jungle'
  | 'hills'
  | 'mountains';

export type ResourceType =
  | 'food'
  | 'production'
  | 'gold'
  | 'science'
  | 'culture'
  | 'faith'
  | 'happiness';

export type YieldMap = Record<ResourceType, number>;

export type ImprovementType =
  | 'none'
  | 'farm'
  | 'mine'
  | 'lumber_mill'
  | 'pasture'
  | 'fishing_boats'
  | 'trading_post';

export type BuildingType =
  | 'palace'
  | 'granary'
  | 'monument'
  | 'library'
  | 'barracks'
  | 'market'
  | 'temple'
  | 'workshop'
  | 'aqueduct'
  | 'university'
  | 'bank'
  | 'cathedral'
  | 'factory'
  | 'power_plant'
  | 'research_lab'
  | 'stock_exchange'
  | 'broadcast_tower'
  | 'space_port'
  | 'colosseum'
  | 'entertainment_complex';

export type WonderId =
  | 'great_pyramid'
  | 'hanging_gardens'
  | 'oracle'
  | 'great_library'
  | 'petra'
  | 'angkor_wat'
  | 'big_ben'
  | 'statue_of_liberty'
  | 'eiffel_tower'
  | 'cristo_redentor'
  | 'louvre'
  | 'mahabodhi_temple'
  | 'potala_palace'
  | 'great_mosque_of_djenne';

export type DisasterKind =
  | 'flood'
  | 'earthquake'
  | 'drought'
  | 'storm'
  | 'volcanic_eruption'
  | 'tsunami'
  | 'blizzard'
  | 'wildfire';

export type SpyMission =
  | 'steal_tech'
  | 'sabotage'
  | 'intel'
  | 'steal_great_work'
  | 'disrupt_production'
  | 'promote_loyalty_issues'
  | 'counter_espionage';

export type GreatPersonMeterKind =
  | 'scientist'
  | 'artist'
  | 'general'
  | 'merchant'
  | 'prophet'
  | 'admiral'
  | 'engineer'
  | 'writer'
  | 'musician';

export type GreatPersonType = GreatPersonMeterKind;

export type GreatWorkKind = 'art' | 'music' | 'writing' | 'artifact';

export interface GreatWork {
  id: number;
  name: string;
  type: GreatWorkKind;
  creatorCiv: number;
  creatorGreatPersonId: string;
  theme: string;
  tourism: number;
  /** city holding this work, or null if in transit */
  cityId: number | null;
}

export type GovernmentType =
  | 'chiefdom'
  | 'monarchy'
  | 'theocracy'
  | 'merchant_republic'
  | 'democracy'
  | 'communism'
  | 'fascism';

export type PolicyCardType = 'military' | 'economic' | 'cultural' | 'religious' | 'diplomatic';

export type SpaceRaceStage = 'none' | 'satellite' | 'moon' | 'mars' | 'complete';

export interface CivSpaceRace {
  stage: SpaceRaceStage;
  /** Production accumulated toward the active stage goal. */
  progressProduction: number;
  /** Cost for current stage (production points). */
  stageCost: number;
}

/** key `${from}_${to}` — cumulative visiting-tourist pressure used for cultural dominance. */
export type TouristFlowKey = string;

export type InfluenceActionKind =
  | 'support'
  | 'accept'
  | 'reject'
  | 'sanction'
  | 'endeavor'
  | 'treaty'
  | 'independent';

export interface InfluenceActionLogEntry {
  id: string;
  turn: number;
  fromCiv: number;
  toCiv: number;
  kind: InfluenceActionKind;
  cost: number;
  note?: string;
}

export interface InfluenceTreaty {
  id: string;
  civA: number;
  civB: number;
  kind: 'research' | 'commerce' | 'culture';
  turnsLeft: number;
  signedTurn: number;
}

export interface InfluenceSanction {
  id: string;
  fromCiv: number;
  toCiv: number;
  turnsLeft: number;
  imposedTurn: number;
  severity: number;
}

export interface InfluenceDiplomacyState {
  balances: Record<number, number>;
  actionLog: InfluenceActionLogEntry[];
  treaties: InfluenceTreaty[];
  sanctions: InfluenceSanction[];
  endeavors: Array<{ id: string; fromCiv: number; toCiv: number; turn: number; kind: 'science' | 'industry' | 'culture' }>;
}

export type IndependentPowerTier = 'camp' | 'tribe' | 'city_state';
export type IndependentPowerStance = 'hostile' | 'neutral' | 'friendly';

export interface IndependentPower {
  id: number;
  name: string;
  q: number;
  r: number;
  age: GameAge;
  tier: IndependentPowerTier;
  strength: number;
  influenceProgress: number;
  relations: Record<number, IndependentPowerStance>;
  raidTargetCiv?: number | null;
  raidTurnsLeft?: number;
  leviedByCiv?: number | null;
  leviedTurnsLeft?: number;
}

export type CommanderDomain = 'army' | 'fleet' | 'squadron';

export interface Commander {
  id: string;
  ownerCiv: number;
  unitId: number;
  domain: CommanderDomain;
  level: number;
  xp: number;
  assignedUnitIds: number[];
  activeTurnsLeft: number;
  cooldownTurnsLeft: number;
}

export type GeographyHemisphere = 'west' | 'east';

export interface GeographyProgressState {
  homeHemisphereByCiv: Record<number, GeographyHemisphere>;
  distantLandsDiscoveredByCiv: Record<number, number>;
  distantLandsTotalByCiv: Record<number, number>;
  oceanUnlockedByCiv: Record<number, boolean>;
  riverNavigationUnlockedByCiv: Record<number, boolean>;
}

export type LegacyPathType = 'military' | 'science' | 'culture' | 'economy';
export type LegacyChoiceType = 'golden_age' | 'dark_age';
export type CrisisPolicyType =
  | 'rationing'
  | 'war_mobilization'
  | 'knowledge_preservation'
  | 'cultural_unity';

export interface LegacyChoicePending {
  civIndex: number;
  age: GameAge;
  options: LegacyChoiceType[];
}

export interface LegacyChoiceRecord {
  civIndex: number;
  age: GameAge;
  path: LegacyPathType;
  choice: LegacyChoiceType;
  turn: number;
}

export interface LegacyCrisisState {
  pointsByCiv: Record<number, Record<LegacyPathType, number>>;
  pendingLegacyChoices: LegacyChoicePending[];
  history: LegacyChoiceRecord[];
  activeYieldModifiersByCiv: Record<number, Partial<YieldMap>>;
  crisisActive: boolean;
  crisisAge: GameAge | null;
  crisisTurnsLeft: number;
  crisisSeverity: number;
  selectedPolicyByCiv: Record<number, CrisisPolicyType | null>;
  /** Hide legacy prompt until `state.turn` reaches this value (set by “Later”). */
  legacyPromptSnoozeUntilTurnByCiv?: Record<number, number>;
  /** Hide crisis policy prompt until this turn (policy still unset). */
  crisisPolicySnoozeUntilTurnByCiv?: Record<number, number>;
}

/** Global mechanics: wonders, religion pressure, tourism/influence, spies, disasters, GP meters. */
export interface GameSystems {
  wonderOwners: Partial<Record<WonderId, { civIndex: number; cityId: number; turnBuilt: number }>>;
  religions: Array<{
    id: string;
    name: string;
    founderCiv: number;
    holyCityId: number;
    beliefs: string[];
  }>;
  /** cityId -> religionIndex -> accumulated pressure (0–100+). */
  cityFaithPressure: Record<number, Record<number, number>>;
  tourismTotal: Record<number, number>;
  /** key `${owner}_${target}` -> tourism-driven influence */
  influence: Record<string, number>;
  /** Influence-driven diplomacy actions, balances, sanctions and treaties. */
  influenceDiplomacy: InfluenceDiplomacyState;
  /** Independent powers lifecycle (camp/tribe/city-state) and bilateral stances. */
  independentPowers: IndependentPower[];
  nextIndependentPowerId: number;
  /** Commander entities (army/fleet/squadron) and assignment lifecycles. */
  commanders: Commander[];
  nextCommanderId: number;
  /** Geography progression: age-locked ocean/river navigation and distant lands discovery. */
  geographyProgress?: GeographyProgressState;
  /** Legacy paths, age crisis state and crisis policies. */
  legacyCrisis?: LegacyCrisisState;
  /** Culture victory: cumulative visiting tourists from civ i toward each civ j (key `i_j`). */
  touristVisiting: Record<TouristFlowKey, number>;
  /** Per-civ domestic tourist pool (derived from lifetime culture / 100, refreshed each turn). */
  touristDomestic: Record<number, number>;
  spies: Array<{
    id: number;
    ownerCiv: number;
    targetCiv: number;
    targetCityId?: number;
    mission: SpyMission;
    turnsActive: number;
    discovered: boolean;
  }>;
  disasters: Array<{
    id: number;
    kind: DisasterKind;
    q: number;
    r: number;
    turnsLeft: number;
    radius: number;
    /** Owner of the focal city when the disaster spawned (toast gating for subsiding, etc.). */
    spawnNearCityOwner?: number;
    /** Whether we've already announced this disaster to the player */
    notified?: boolean;
    /** Whether we've already announced the disaster ending */
    endNotified?: boolean;
  }>;
  /** Turn index of last spawned disaster (for spawn cooldowns) */
  lastDisasterTurn?: number;
  /** Keys `${viewerCiv}_${otherCiv}` — viewer has dismissed the first-contact intro for that rival. */
  civFirstContactSeen?: Record<string, boolean>;
  greatPeopleMeter: Record<number, Partial<Record<GreatPersonMeterKind, number>>>;
  /** Per civ: points accumulated toward the next great person of each meter type (competition). */
  greatPersonProgress: Record<number, Partial<Record<GreatPersonMeterKind, number>>>;
  /** Great person definition ids already claimed globally. */
  greatPersonClaimed: string[];
  greatWorks: GreatWork[];
  nextGreatWorkId: number;
  /** World congress-style votes (simplified). */
  worldVotes: Array<{
    turn: number;
    votes: Record<number, number>;
    winner?: number;
  }>;
  /** Per civ space race state. */
  spaceRace: Record<number, CivSpaceRace>;
  nextSpyId: number;
  nextDisasterId: number;
}

export type UnitType =
  | 'settler'
  | 'warrior'
  | 'archer'
  | 'spearman'
  | 'horseman'
  | 'scout'
  | 'catapult'
  | 'swordsman'
  | 'knight'
  | 'musketman'
  | 'cannon'
  | 'rifleman'
  | 'cavalry'
  | 'artillery'
  | 'infantry'
  | 'tank'
  | 'bomber'
  | 'fighter'
  | 'nuclear_missile'
  | 'worker'
  | 'great_general'
  | 'great_scientist'
  | 'great_artist'
  | 'great_merchant'
  | 'great_engineer'
  | 'great_writer'
  | 'great_musician'
  | 'great_prophet'
  | 'great_admiral'
  | 'missionary';

export type Era =
  | 'ancient'
  | 'classical'
  | 'medieval'
  | 'renaissance'
  | 'industrial'
  | 'modern'
  | 'atomic'
  | 'information';

export interface GreatPersonDef {
  id: string;
  name: string;
  type: GreatPersonType;
  era: Era;
  uniqueAbility: string;
  bonusDescription: string;
  /** Multiplier on space-project production when this engineer is owned (0 if N/A). */
  spaceProjectProductionBonus?: number;
}

export interface PolicyCardDef {
  id: string;
  name: string;
  type: PolicyCardType;
  era: Era;
  yields?: Partial<YieldMap>;
  militaryBonus?: number;
  description: string;
}

export interface GovernmentDef {
  id: GovernmentType;
  name: string;
  era: Era;
  yields: Partial<YieldMap>;
  policySlots: number;
  description: string;
}

export type TechId = string;

export interface Technology {
  id: TechId;
  name: string;
  era: Era;
  cost: number;
  prerequisites: TechId[];
  unlocks: string[];
  description: string;
}

export type CivicId = string;

export interface CivicDef {
  id: CivicId;
  name: string;
  era: Era;
  cost: number;
  prerequisites: CivicId[];
  unlocks: string[];
  description: string;
}

export interface BuildingDef {
  id: BuildingType;
  name: string;
  cost: number; // production cost
  maintenanceCost: number; // gold per turn
  yields: Partial<YieldMap>;
  prerequisiteTech?: TechId;
  description: string;
  /** Optional museum-style slots for great works. */
  greatWorkSlots?: Partial<Record<GreatWorkKind, number>>;
  housing?: number;
  amenities?: number;
}

export interface UnitDef {
  id: UnitType;
  name: string;
  cost: number;
  maintenanceCost: number;
  movement: number;
  strength: number;
  rangedStrength: number;
  range: number;
  prerequisiteTech?: TechId;
  era: Era;
  description: string;
  /** Counts of improved strategic tiles (NATURAL_RESOURCES keys, e.g. iron, horse) required to train. */
  requiredStrategicResources?: Record<string, number>;
}

export interface NaturalResource {
  type: 'bonus' | 'luxury' | 'strategic';
  name: string;
  yields: Partial<YieldMap>;
  improvement?: ImprovementType;
}

export interface CivLeaderBonus {
  /** Percentage modifiers applied each turn to total civilization yields. */
  foodPct?: number;
  productionPct?: number;
  goldPct?: number;
  sciencePct?: number;
  culturePct?: number;
  faithPct?: number;
  happinessPct?: number;
  /** Flat diplomatic favor gained each turn. */
  diplomaticFavorFlat?: number;
  /** Combat strength bonus for units from this civilization. */
  combatStrengthPct?: number;
}

export interface CivTemplate {
  /** Stable slug for i18n keys (`civ.{id}.*`). */
  id: string;
  name: string;
  adjective: string;
  leader: string;
  color: string;
  secondaryColor: string;
  bonuses: CivLeaderBonus;
}

export interface Tile {
  q: number; // hex col
  r: number; // hex row
  terrain: TerrainType;
  improvement: ImprovementType;
  resource: string | null; // key of NATURAL_RESOURCES
  owner: number | null; // civilization index
  city: number | null; // city id
  /**
   * Which city's cultural zone claims this land tile (matches `recomputeTileTerritory` winner).
   * City-center tiles match `city`; unclaimed/null when no border applies.
   */
  territoryCityId: number | null;
  unit: number | null; // unit id
  /** River channel marker for navigation/pathing rules. */
  river?: boolean;
  /** Trade-road network marker (auto-generated by active trade routes). */
  road?: boolean;
  revealed: boolean[]; // per player visibility
  visible: boolean[]; // per player current sight
}

export type SettlementKind = 'capital' | 'city' | 'town';

export type TownSpecialization =
  | 'balanced'
  | 'agrarian'
  | 'industrial'
  | 'mercantile'
  | 'scholarly'
  | 'cultural';

export type DistrictKind = 'urban' | 'rural';

export type DistrictType =
  | 'urban_center'
  | 'campus'
  | 'market'
  | 'theater'
  | 'industrial'
  | 'temple'
  | 'rural_farms'
  | 'rural_mines';

export interface DistrictInstance {
  id: string;
  kind: DistrictKind;
  type: DistrictType;
  q: number;
  r: number;
  level: number;
  specialists: number;
  establishedTurn: number;
}

export type GrowthEventOptionId = 'rural_development' | 'urban_investment' | 'cultural_rite';

export interface GrowthEventTarget {
  q: number;
  r: number;
  kind: 'urban' | 'rural';
}

export interface GrowthEventState {
  id: string;
  triggerTurn: number;
  populationAfterGrowth: number;
  options: GrowthEventOptionId[];
  targetCandidates?: GrowthEventTarget[];
}

export interface City {
  id: number;
  name: string;
  owner: number; // civ index
  q: number;
  r: number;
  population: number;
  food: number;
  foodNeeded: number;
  buildings: BuildingType[];
  productionQueue: ProductionItem[];
  workedTiles: Array<{ q: number; r: number }>;
  yields: YieldMap;
  isCapital: boolean;
  defense: number;
  hp: number;
  maxHp: number;
  turnFounded: number;
  /** Index into `game.systems.religions` or null if no majority. */
  majorityReligionIndex: number | null;
  /** Housing capacity; growth slows when population >= housing. */
  housing: number;
  /** Entertainment / luxury satisfaction (0–30+). */
  amenities: number;
  /** 0–100 loyalty to owner; low values reduce yields and risk flip. */
  loyalty: number;
  /** Great work ids held in this city. */
  greatWorkIds: number[];
  /** Settlement abstraction layer used by economy/UI and town->city progression. */
  settlementKind?: SettlementKind;
  /** Town economy focus; ignored for city/capital. */
  townSpecialization?: TownSpecialization | null;
  /** Progression tier: 1 town, 2 city, 3 capital. */
  settlementTier?: number;
  /** Turn-local soft-cap penalty snapshot for this settlement (0..0.5). */
  settlementSoftCapPenalty?: number;
  /** Urban/rural district instances linked to this settlement. */
  districts?: DistrictInstance[];
  /** Permanent local bonuses obtained from growth-event choices. */
  growthYieldBonuses?: Partial<YieldMap>;
  /** Pending growth choice after population increase. */
  pendingGrowthEvent?: GrowthEventState | null;
  /** Counter of resolved growth events for this settlement. */
  growthEventsResolved?: number;
}

export type ProductionItem =
  | { type: 'building'; id: BuildingType; progress: number; cost: number }
  | { type: 'unit'; id: UnitType; progress: number; cost: number }
  | { type: 'wonder'; id: WonderId; progress: number; cost: number };

export interface Unit {
  id: number;
  type: UnitType;
  owner: number;
  q: number;
  r: number;
  hp: number;
  maxHp: number;
  movement: number;
  maxMovement: number;
  strength: number;
  rangedStrength: number;
  range: number;
  hasAttacked: boolean;
  /** Last game turn when this unit lost HP in combat (unit vs unit or melee vs city). Used for territory heal cooldown. */
  lastDamagedInCombatTurn?: number | null;
  promotions: string[];
  era: Era;
  name: string;
  /** When spawned from GREAT_PEOPLE pool, links to definition id. */
  greatPersonDefId?: string | null;
  /** Scout only: automated fog-reveal moves each turn (and optionally once when toggled on). */
  scoutAutoExplore?: boolean;
  /** Worker only: remaining tile improvements before the unit is consumed. */
  workerBuildsRemaining?: number;
}

export type DiplomaticStatus = 'peace' | 'war' | 'alliance' | 'neutral' | 'armistice';

export interface DiplomaticRelation {
  civA: number;
  civB: number;
  status: DiplomaticStatus;
  turnsAtWar: number;
  /** Denormalized: count of entries in `GameState.tradeRoutes` for this pair (civA < civB). */
  tradeRoutes: number;
  /** After makePeace: cannot declareWar until this turn number (inclusive of first allowed = this value). */
  peaceLockedUntilTurn: number;
  /** While status is `armistice`, no combat or border crossing; hostilities resume when `turn >= this`. */
  armisticeUntilTurn: number;
  /** Long-term bilateral trust score (-100..100). */
  trust: number;
  /** War grievance pressure (0..100+). */
  grievances: number;
}

/** Gold tribute directions use canonical civA < civB ordering (same as relations). */
export interface DiplomaticSettlementPayments {
  goldLoPaysHi: number;
  goldHiPaysLo: number;
}

export type DiplomaticOfferKind = 'peace' | 'armistice';

/** Pending peace / armistice negotiation (`to` must accept, reject, or counter). */
export interface DiplomaticOffer extends DiplomaticSettlementPayments {
  id: number;
  kind: DiplomaticOfferKind;
  fromCiv: number;
  toCiv: number;
  /** Canonical pair ordering (always civA < civB style). Payments refer to these civ indices. */
  pairLo: number;
  pairHi: number;
  /** Armistice length when kind === armistice (defaults in engine if omitted). */
  armisticeTurns?: number;
}

/** Active trade link between two capitals; gold accrues to both civs each peaceful turn. */
export interface TradeRoute {
  id: number;
  /** Always civA < civB (same ordering as `DiplomaticRelation`). */
  civA: number;
  civB: number;
  fromCityId: number;
  toCityId: number;
  goldPerTurn: number;
  turnsEstablished: number;
  /** 0..1 route disruption risk (war proximity / instability abstraction). */
  risk: number;
  /** Optional one-time lot exchange bundle settled when creating the route. */
  lotsAtoB?: TradeLot[];
  lotsBtoA?: TradeLot[];
}

export type TradeLotPriceMode = 'one_time' | 'per_unit';

export interface TradeLot {
  resource: ResourceType;
  amount: number;
  unitPrice: number;
  /** one_time = flat lot price; per_unit = amount * unitPrice. */
  priceMode: TradeLotPriceMode;
}

export interface TradeAgreement {
  id: number;
  civA: number;
  civB: number;
  goldPerTurnAtoB: number;
  goldPerTurnBtoA: number;
  turnsLeft: number;
  /** Optional per-turn resource flow from civA to civB (besides gold). */
  transferAtoB?: Partial<Record<'food' | 'science' | 'culture' | 'faith' | 'happiness', number>>;
  /** Optional per-turn resource flow from civB to civA (besides gold). */
  transferBtoA?: Partial<Record<'food' | 'science' | 'culture' | 'faith' | 'happiness', number>>;
  /** Optional one-time lot exchange bundle settled at signing. */
  lotsAtoB?: TradeLot[];
  lotsBtoA?: TradeLot[];
}

export interface Civilization {
  id: number;
  name: string;
  adjective: string;
  leader: string;
  color: string;
  secondaryColor: string;
  isHuman: boolean;
  isAlive: boolean;
  capital: number | null; // city id
  cities: number[]; // city ids
  units: number[]; // unit ids
  resources: YieldMap;
  /** Per-turn net income (UI); updated each processTurn */
  lastTurnIncome: Partial<YieldMap>;
  researchedTechs: TechId[];
  currentResearch: TechId | null;
  researchProgress: number;
  researchedCivics: CivicId[];
  currentCivic: CivicId | null;
  civicProgress: number;
  policies: string[];
  era: Era;
  score: number;
  greatPeoplePoints: Partial<Record<string, number>>;
  // Victory tracking
  /** 0–100 UI progress for staged space race. */
  scienceVictoryProgress: number;
  culturalInfluence: Record<number, number>;
  /** Accumulated faith toward founding a religion (per civ). */
  faithPool: number;
  /** Lifetime tourism (culture victory pressure). */
  tourism: number;
  /** Index in `systems.religions` this civ follows, or null. */
  religionIndex: number | null;
  /** Lifetime culture generated (domestic tourists). */
  lifetimeCulture: number;
  diplomaticVictoryPoints: number;
  diplomaticFavor: number;
  /** Turns of universal peace (at peace with all alive civs); ticks diplomacy yields. */
  consecutivePeaceTurns: number;
  greatPeopleEarned: number;
  /** Unspent great person meter overflow toward patronage purchase. */
  patronagePoints: number;
  governmentId: GovernmentType;
  slottedPolicyIds: string[];
  /** AI personality key for rival behavior. */
  aiPersonality: string;
}

export type VictoryType =
  | 'science'
  | 'culture'
  | 'domination'
  | 'diplomacy'
  | 'time'
  | 'religion';

export type GameAge = 'antiquity' | 'exploration' | 'modern';
export type GameAgePhase = 'ongoing' | 'transition';

export interface AgeTransitionRecord {
  fromAge: GameAge;
  toAge: GameAge;
  turn: number;
  triggerCivIndex: number;
}

export interface AgeState {
  currentAge: GameAge;
  phase: GameAgePhase;
  turnsInAge: number;
  threshold: number;
  pointsByCiv: number[];
  pendingTransitionTurn: number | null;
  triggerCivIndex: number | null;
  modernLegacyUnlocked: boolean;
  history: AgeTransitionRecord[];
}

export type LeaderAttributeKey = 'military' | 'science' | 'culture' | 'economy' | 'diplomacy';

export interface LeaderAttributes {
  military: number;
  science: number;
  culture: number;
  economy: number;
  diplomacy: number;
}

export interface LeaderProfile {
  id: string;
  civIndex: number;
  displayName: string;
  persistentXp: number;
  unspentAttributePoints: number;
  attributes: LeaderAttributes;
  activeMementos: string[];
}

export interface AgeCivilizationIdentity {
  civIndex: number;
  templateId: string;
  currentName: string;
  currentAdjective: string;
  age: GameAge;
  traitTags: string[];
}

export type WeatherType = 'clear' | 'rain' | 'storm' | 'snow';

/** World ambiance; hour 0–23 advances deterministically with turn. */
export interface WorldState {
  hour: number;
  weather: WeatherType;
}

export interface GameSettings {
  mapWidth: number;
  mapHeight: number;
  numCivs: number;
  difficulty: 'settler' | 'chieftain' | 'warlord' | 'prince' | 'emperor' | 'deity';
  seed: number;
  maxTurns: number;
  mapType:
    | 'pangaea'
    | 'continents'
    | 'archipelago'
    | 'highlands'
    | 'great_lakes'
    | 'inland_sea'
    | 'wetlands'
    | 'drylands'
    | 'shattered'
    | 'ring_sea'
    | 'earth'
    | 'random';
  civNames: string[];
  /** Index into CIV_TEMPLATES for the human (owner 0); AI civs use following templates in rotation. */
  humanCivIndex: number;
  /** Optional leader display name for the human; empty uses the template leader name. */
  humanNickname: string;
  /** Optional hash/id of imported custom map. */
  customMapHash?: string;
  /** Optional display name for imported custom map. */
  customMapName?: string;
  /** Optional pre-game legend loadout selected in main menu. */
  metaMementoLoadout?: string[];
  /** Meta progression rewards policy for new games. */
  metaProgressionPolicy?: 'enabled' | 'disabled';
}

/** Per-civilization counters for achievement tracking. */
export type AchievementPlayStats = {
  combatWins: number;
  enemyCitiesCaptured: number;
};

export interface GameState {
  systems: GameSystems;
  settings: GameSettings;
  turn: number;
  currentCivIndex: number;
  tiles: Tile[][];
  cities: City[];
  units: Unit[];
  civilizations: Civilization[];
  relations: DiplomaticRelation[];
  tradeRoutes: TradeRoute[];
  tradeAgreements?: TradeAgreement[];
  nextTradeAgreementId?: number;
  nextTradeRouteId: number;
  nextCityId: number;
  nextUnitId: number;
  phase: 'setup' | 'playing' | 'victory';
  winner: number | null;
  victoryType: VictoryType | null;
  messages: GameMessage[];
  /** When moving, move up to this many human units of the same type from the same tile (sorted: selected first). */
  stackUnitsToMove: number;
  selectedUnitId: number | null;
  selectedCityId: number | null;
  selectedTile: { q: number; r: number } | null;
  camera: { x: number; y: number; zoom: number; rotation?: number };
  world: WorldState;
  /** Campaign age progression state. */
  age?: AgeState;
  /** Persistent leader progression profile per civilization slot. */
  leaders?: LeaderProfile[];
  /** Age-specific civilization identity layer (separate from leader profile). */
  civilizationIdentity?: AgeCivilizationIdentity[];
  /** Indexed by civilization slot; used for combat / capture achievements. */
  achievementStats?: AchievementPlayStats[];
  /** Open settlement offers (peace / armistice with tribute terms). */
  diplomaticOffers?: DiplomaticOffer[];
  nextDiplomaticOfferId?: number;
}

export interface GameMessage {
  id: number;
  turn: number;
  text: string;
  type:
    | 'info'
    | 'warning'
    | 'combat'
    | 'tech'
    | 'city'
    | 'diplomacy'
    | 'religion'
    | 'disaster'
    | 'wonder'
    | 'tourism'
    | 'espionage';
  /** If set: log line is shown only once the viewer has map-discovered every listed civ slot. */
  relatedCivIndices?: number[];
}

export type Screen =
  | 'splash'
  | 'player_setup'
  | 'main_menu'
  | 'new_game'
  | 'game'
  | 'tech_tree'
  | 'diplomacy'
  | 'city_detail'
  | 'victory'
  | 'load_game'
  | 'map_editor'
  | 'world_intro';
