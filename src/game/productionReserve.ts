import type { ProductionItem } from './types';

const BUILDING_COST_RATIO = 0.5;
const UNIT_COST_RATIO = 0.6;
const WONDER_COST_RATIO = 0.4;

export function productionReserveCost(item: ProductionItem): number {
  const ratio =
    item.type === 'unit'
      ? UNIT_COST_RATIO
      : item.type === 'wonder'
        ? WONDER_COST_RATIO
        : BUILDING_COST_RATIO;
  return Math.max(10, Math.ceil(item.cost * ratio));
}

export function productionReserveCap(cityCount: number, industryBuildings: number): number {
  return 120 + cityCount * 90 + industryBuildings * 35;
}

export function productionReserveGainPerTurn(
  totalProductionPerTurn: number,
  cityCount: number,
  industryBuildings: number
): number {
  const fromProduction = Math.round(totalProductionPerTurn * 0.55);
  return Math.max(3, fromProduction + cityCount * 2 + industryBuildings * 3);
}
