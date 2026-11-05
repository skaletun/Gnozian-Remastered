import type { CivLeaderBonus, CivTemplate } from '../game/types';

export type CivTranslateFn = (key: string, params?: Record<string, string | number>) => string;

/** Localized civ template strings for UI (English remains in `CivTemplate.name` for saves/engine). */
export function civTemplateName(tpl: CivTemplate, tr: CivTranslateFn): string {
  return tr(`civ.${tpl.id}.name`);
}

export function civTemplateLeader(tpl: CivTemplate, tr: CivTranslateFn): string {
  return tr(`civ.${tpl.id}.leader`);
}

export function civTemplateAbility(tpl: CivTemplate, tr: CivTranslateFn): string {
  return tr(`civ.${tpl.id}.ability`);
}

export function civTemplateAbilityDesc(tpl: CivTemplate, tr: CivTranslateFn): string {
  return tr(`civ.${tpl.id}.abilityDesc`);
}

/** Stat fragments matching `CivLeaderBonus` (same order idea as prior UI). */
export function civBonusSummaryLines(b: CivLeaderBonus, tr: CivTranslateFn): string[] {
  const pct = (n: number, yieldKey: string) =>
    tr('civ.bonus.pctLine', { n, yield: tr(yieldKey) });

  const lines: string[] = [];
  if (b.sciencePct) lines.push(pct(b.sciencePct, 'city.yield.science'));
  if (b.culturePct) lines.push(pct(b.culturePct, 'city.yield.culture'));
  if (b.productionPct) lines.push(pct(b.productionPct, 'city.yield.production'));
  if (b.goldPct) lines.push(pct(b.goldPct, 'city.yield.gold'));
  if (b.faithPct) lines.push(pct(b.faithPct, 'city.yield.faith'));
  if (b.foodPct) lines.push(pct(b.foodPct, 'city.yield.food'));
  if (b.happinessPct) lines.push(pct(b.happinessPct, 'civ.yield.happiness'));
  if (b.combatStrengthPct) lines.push(tr('civ.bonus.combatPct', { n: b.combatStrengthPct }));
  if (b.diplomaticFavorFlat) lines.push(tr('civ.bonus.diploPerTurn', { n: b.diplomaticFavorFlat }));
  return lines;
}

export function civJoinOptionLabel(tpl: CivTemplate, tr: CivTranslateFn): string {
  return `${civTemplateName(tpl, tr)} — ${civTemplateLeader(tpl, tr)}`;
}
