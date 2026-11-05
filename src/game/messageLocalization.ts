import { t } from '../i18n';

type Rule = {
  pattern: RegExp;
  to: (m: RegExpExecArray) => string;
};

const RULES: Rule[] = [
  { pattern: /^(.+) has been founded!$/, to: m => t('msg.cityFounded', { city: m[1] }) },
  { pattern: /^Cannot place unit: tile is full or mixed unit types\.$/, to: () => t('msg.cannotPlaceUnit') },
  { pattern: /^Terrain is impassable for this unit\.$/, to: () => t('msg.terrainImpassable') },
  { pattern: /^Not enough movement points for this terrain\.$/, to: () => t('msg.notEnoughMovementTerrain') },
  { pattern: /^Armistice: cannot enter foreign territory\.$/, to: () => t('msg.armisticeNoEnter') },
  { pattern: /^Armistice forbids combat\.$/, to: () => t('msg.armisticeNoCombat') },
  { pattern: /^No movement left to attack this turn\.$/, to: () => t('msg.noMovementToAttack') },
  { pattern: /^Target is out of attack range\.$/, to: () => t('msg.targetOutOfRange') },
  { pattern: /^City is out of attack range\.$/, to: () => t('msg.cityOutOfRange') },
  { pattern: /^Armistice forbids attacking cities\.$/, to: () => t('msg.armisticeNoCityAttack') },
  { pattern: /^Great Work created in (.+)\.$/, to: m => t('msg.greatWorkCreated', { city: m[1] }) },
  { pattern: /^Great Person ability used\.$/, to: () => t('msg.greatPersonUsed') },
  { pattern: /^Armistice holds until turn (\d+)\.$/, to: m => t('msg.armisticeHoldsUntil', { turn: m[1] }) },
  {
    pattern: /^⚔️ (.+) has declared WAR on (.+)!$/,
    to: m => t('msg.warDeclared', { civA: m[1], civB: m[2] }),
  },
  { pattern: /^(.+) and (.+) made PEACE\.$/, to: m => t('msg.peaceMade', { civA: m[1], civB: m[2] }) },
  { pattern: /^Armistice requires an active war\.$/, to: () => t('msg.armisticeNeedsWar') },
  { pattern: /^Cannot ally while at war or under armistice\.$/, to: () => t('msg.cannotAllyAtWar') },
  { pattern: /^No alliance to leave\.$/, to: () => t('msg.noAllianceToLeave') },
  { pattern: /^Trade agreement requires peace\.$/, to: () => t('msg.tradeNeedsPeace') },
  { pattern: /^Trade route #(\d+) has been cancelled\.$/, to: m => t('msg.tradeRouteCancelled', { id: m[1] }) },
  {
    pattern: /^An armistice has expired — war resumes between former ceasefire partners\.$/,
    to: () => t('msg.armisticeExpired'),
  },
  { pattern: /^(.+) produced in (.+)\.$/, to: m => t('msg.unitProduced', { unit: m[1], city: m[2] }) },
  { pattern: /^Started researching (.+)!$/, to: m => t('msg.startedResearch', { tech: m[1] }) },
  { pattern: /^Cannot found city here!$/, to: () => t('msg.cannotFoundCity') },
  { pattern: /^(.+) founds "(.+)"!$/, to: m => t('msg.religionFounded', { civ: m[1], religion: m[2] }) },
  { pattern: /^(.+) maintains counter-intelligence\.$/, to: m => t('msg.counterIntel', { civ: m[1] }) },
  {
    pattern: /^(.+)'s spies stole (\d+) science from (.+)!$/,
    to: m => t('msg.spyStoleScience', { civ: m[1], amount: m[2], target: m[3] }),
  },
  { pattern: /^Espionage disrupts production in (.+)!$/, to: m => t('msg.spyDisruptsProduction', { city: m[1] }) },
  { pattern: /^(.+) steals a great work from (.+)!$/, to: m => t('msg.spyStealsGreatWork', { civ: m[1], target: m[2] }) },
  { pattern: /^Dissent spreads in (.+)\.$/, to: m => t('msg.dissentSpreads', { city: m[1] }) },
  { pattern: /^(.+) gathers intelligence on (.+)\.$/, to: m => t('msg.gathersIntel', { civ: m[1], target: m[2] }) },
  { pattern: /^([A-Z_]+) near (.+)! Seek shelter!$/, to: m => t('msg.disasterNearSeekShelter', { kind: m[1], city: m[2] }) },
  { pattern: /^([A-Z_]+) subsides near \((\d+),\s*(\d+)\)\.$/, to: m => t('msg.disasterSubsides', { kind: m[1], q: m[2], r: m[3] }) },
  { pattern: /^([A-Z_]+) near (.+)!$/, to: m => t('msg.disasterNear', { kind: m[1], city: m[2] }) },
  { pattern: /^(.+) \((.+)\) appears near (.+)!$/, to: m => t('msg.greatPersonAppears', { name: m[1], type: m[2], city: m[3] }) },
  { pattern: /^(.+) appears near (.+)!$/, to: m => t('msg.unitAppears', { unit: m[1], city: m[2] }) },
  { pattern: /^Not enough gold to recruit a spy\.$/, to: () => t('msg.notEnoughGoldSpy') },
  { pattern: /^Found a religion before sending missionaries\.$/, to: () => t('msg.needReligionFirst') },
  { pattern: /^Missionary spreads faith in (.+)\.$/, to: m => t('msg.missionarySpreadsFaith', { city: m[1] }) },
  { pattern: /^(.+): majority religion is now (.+)\.$/, to: m => t('msg.majorityReligionNow', { city: m[1], religion: m[2] }) },
  { pattern: /^Cannot build: (.+)$/, to: m => t('msg.cannotBuild', { reason: localizeBuildReason(m[1]) }) },
  { pattern: /^Only workers can build tile improvements\.$/, to: () => t('msg.onlyWorkersBuild') },
  { pattern: /^This worker has no moves left this turn\.$/, to: () => t('msg.workerNoMoves') },
];

export function localizeGameMessage(text: string): string {
  for (const rule of RULES) {
    const m = rule.pattern.exec(text);
    if (m) return rule.to(m);
  }
  return text;
}

function localizeBuildReason(reason: string): string {
  const keyByReason: Record<string, string> = {
    'invalid improvement': 'msg.buildReason.invalidImprovement',
    'missing technology': 'msg.buildReason.missingTechnology',
    'invalid tile': 'msg.buildReason.invalidTile',
    'cannot build on a city': 'msg.buildReason.cannotBuildOnCity',
    'tile not in your territory': 'msg.buildReason.tileNotInTerritory',
    'already built here': 'msg.buildReason.alreadyBuiltHere',
    'needs coast or ocean': 'msg.buildReason.needsCoastOrOcean',
    'needs fish resource': 'msg.buildReason.needsFishResource',
    'bad terrain': 'msg.buildReason.badTerrain',
    'wrong resource for farm': 'msg.buildReason.wrongResourceFarm',
    'wrong resource for mine': 'msg.buildReason.wrongResourceMine',
    'mine needs hills or a mineral resource': 'msg.buildReason.mineNeedsHillsOrMineral',
    'needs pasture livestock or horses': 'msg.buildReason.needsPastureLivestockOrHorses',
    'needs forest or jungle': 'msg.buildReason.needsForestOrJungle',
    'wrong resource for trading post': 'msg.buildReason.wrongResourceTradingPost',
    'trading post needs desert, tundra, snow, or a trade resource': 'msg.buildReason.tradingPostNeedsTerrainOrResource',
    'unknown improvement': 'msg.buildReason.unknownImprovement',
  };
  const key = keyByReason[reason];
  return key ? t(key) : reason;
}
