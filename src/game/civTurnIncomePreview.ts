/**
 * Live per-turn income preview for the HUD — mirrors the net income slice of `processTurn`
 * so +/t updates when city yields, treaties, etc. change mid-turn.
 */
import type { GameState, YieldMap } from './types';
import { BUILDINGS, UNITS, WEATHER_GOLD_MULT, getCivTemplateByName } from './constants';
import { applyWonderIncomeModifiers } from './featureSystems';
import { productionReserveGainPerTurn } from './productionReserve';
import {
  calcCityHappiness,
  cityIndustryBuildingCount,
  effectiveTradeGoldForCiv,
  governmentAndPolicyYields,
} from './systems/turnStateCore';
import { leaderYieldBonuses } from './systems/leaderCore';
import { applyLegacyAndCrisisIncomeModifiers } from './systems/legacyCrisisCore';
import { applyResourceSlotModifiers } from './systems/resourceSlotsCore';

const DEFAULT_WEATHER_WORLD = { hour: 6, weather: 'clear' as const };

export function previewCivilizationHudIncome(state: GameState, civIndex: number): Partial<YieldMap> {
  const civ = state.civilizations[civIndex];
  if (!civ?.isAlive) return {};

  const s = state;
  const weatherGoldMult = WEATHER_GOLD_MULT[(state.world ?? DEFAULT_WEATHER_WORLD).weather] ?? 1;

  let totalFood = 0;
  let totalProduction = 0;
  let totalGold = 0;
  let totalScience = 0;
  let totalCulture = 0;
  let totalFaith = 0;
  let totalHappiness = 0;

  for (const cityId of civ.cities) {
    const city = s.cities.find(c => c.id === cityId);
    if (!city) continue;
    const y = city.yields;
    totalFood += y.food;
    totalProduction += y.production;
    totalGold += y.gold;
    totalScience += y.science;
    totalCulture += y.culture;
    totalFaith += y.faith;
    totalHappiness += calcCityHappiness(s, city);
  }

  for (const unitId of civ.units) {
    const unit = s.units.find(u => u.id === unitId);
    if (!unit) continue;
    const def = UNITS[unit.type];
    if (def) totalGold -= def.maintenanceCost;
  }

  for (const cityId of civ.cities) {
    const city = s.cities.find(c => c.id === cityId);
    if (!city) continue;
    for (const bId of city.buildings) {
      const b = BUILDINGS[bId];
      if (b) totalGold -= b.maintenanceCost;
    }
  }

  totalGold += effectiveTradeGoldForCiv(s, civIndex);
  for (const ag of s.tradeAgreements ?? []) {
    if (ag.turnsLeft <= 0) continue;
    if (ag.civA === civIndex) {
      totalGold += ag.goldPerTurnBtoA - ag.goldPerTurnAtoB;
      totalFood += (ag.transferBtoA?.food ?? 0) - (ag.transferAtoB?.food ?? 0);
      totalScience += (ag.transferBtoA?.science ?? 0) - (ag.transferAtoB?.science ?? 0);
      totalCulture += (ag.transferBtoA?.culture ?? 0) - (ag.transferAtoB?.culture ?? 0);
      totalFaith += (ag.transferBtoA?.faith ?? 0) - (ag.transferAtoB?.faith ?? 0);
      totalHappiness += (ag.transferBtoA?.happiness ?? 0) - (ag.transferAtoB?.happiness ?? 0);
    } else if (ag.civB === civIndex) {
      totalGold += ag.goldPerTurnAtoB - ag.goldPerTurnBtoA;
      totalFood += (ag.transferAtoB?.food ?? 0) - (ag.transferBtoA?.food ?? 0);
      totalScience += (ag.transferAtoB?.science ?? 0) - (ag.transferBtoA?.science ?? 0);
      totalCulture += (ag.transferAtoB?.culture ?? 0) - (ag.transferBtoA?.culture ?? 0);
      totalFaith += (ag.transferAtoB?.faith ?? 0) - (ag.transferBtoA?.faith ?? 0);
      totalHappiness += (ag.transferAtoB?.happiness ?? 0) - (ag.transferBtoA?.happiness ?? 0);
    }
  }

  const inc = {
    food: totalFood,
    gold: totalGold,
    science: totalScience,
    culture: totalCulture,
    faith: totalFaith,
    happiness: totalHappiness,
  };
  applyWonderIncomeModifiers(s, civIndex, inc);
  const gpY = governmentAndPolicyYields(civ);
  const leaderY = leaderYieldBonuses(s, civIndex);
  inc.science += gpY.science ?? 0;
  inc.culture += gpY.culture ?? 0;
  inc.gold += gpY.gold ?? 0;
  inc.faith += gpY.faith ?? 0;
  inc.happiness += gpY.happiness ?? 0;
  totalProduction += gpY.production ?? 0;
  inc.science += leaderY.science ?? 0;
  inc.culture += leaderY.culture ?? 0;
  inc.gold += leaderY.gold ?? 0;
  inc.faith += leaderY.faith ?? 0;
  inc.happiness += leaderY.happiness ?? 0;
  totalProduction += leaderY.production ?? 0;

  const activeSanctions = (s.systems.influenceDiplomacy?.sanctions ?? []).filter(
    x => x.toCiv === civIndex && x.turnsLeft > 0
  );
  if (activeSanctions.length > 0) {
    const mult = Math.max(0.65, 1 - activeSanctions.length * 0.1);
    inc.gold = Math.floor(inc.gold * mult);
    inc.science = Math.floor(inc.science * (mult + 0.05));
  }
  const activeTreaties = (s.systems.influenceDiplomacy?.treaties ?? []).filter(
    x => (x.civA === civIndex || x.civB === civIndex) && x.turnsLeft > 0
  );
  for (const tr of activeTreaties) {
    if (tr.kind === 'research') inc.science += 2;
    else if (tr.kind === 'commerce') inc.gold += 2;
    else inc.culture += 2;
  }

  const legacyCrisis = applyLegacyAndCrisisIncomeModifiers(s, civIndex, inc, totalProduction);
  totalProduction = legacyCrisis.production;
  inc.food = legacyCrisis.inc.food;
  inc.gold = legacyCrisis.inc.gold;
  inc.science = legacyCrisis.inc.science;
  inc.culture = legacyCrisis.inc.culture;
  inc.faith = legacyCrisis.inc.faith;
  inc.happiness = legacyCrisis.inc.happiness;

  const resourceSlots = applyResourceSlotModifiers(s, civIndex, inc, totalProduction);
  totalProduction = resourceSlots.production;
  inc.food = resourceSlots.inc.food;
  inc.gold = resourceSlots.inc.gold;
  inc.science = resourceSlots.inc.science;
  inc.culture = resourceSlots.inc.culture;
  inc.faith = resourceSlots.inc.faith;
  inc.happiness = resourceSlots.inc.happiness;

  let tFood = inc.food;
  let tProduction = totalProduction;
  let tGold = inc.gold;
  let tScience = inc.science;
  let tCulture = inc.culture;
  let tFaith = inc.faith;
  let tHappiness = inc.happiness;

  const tpl = getCivTemplateByName(civ.name);
  const lb = tpl?.bonuses;
  if (lb) {
    tFood = Math.round(tFood * (1 + (lb.foodPct ?? 0) / 100));
    tProduction = Math.round(tProduction * (1 + (lb.productionPct ?? 0) / 100));
    tGold = Math.round(tGold * (1 + (lb.goldPct ?? 0) / 100));
    tScience = Math.round(tScience * (1 + (lb.sciencePct ?? 0) / 100));
    tCulture = Math.round(tCulture * (1 + (lb.culturePct ?? 0) / 100));
    tFaith = Math.round(tFaith * (1 + (lb.faithPct ?? 0) / 100));
    tHappiness = Math.round(tHappiness * (1 + (lb.happinessPct ?? 0) / 100));
  }

  if (tHappiness < -12) {
    tFood = Math.floor(tFood * 0.88);
    tScience = Math.floor(tScience * 0.9);
  }

  tGold = Math.round(tGold * weatherGoldMult);

  const cityCount = civ.cities.length;
  const industryBuildings = cityIndustryBuildingCount(s.cities, civIndex);
  const reserveGain = productionReserveGainPerTurn(tProduction, cityCount, industryBuildings);

  return {
    food: tFood,
    production: reserveGain,
    gold: tGold,
    science: tScience,
    culture: tCulture,
    faith: tFaith,
    happiness: tHappiness,
  };
}
