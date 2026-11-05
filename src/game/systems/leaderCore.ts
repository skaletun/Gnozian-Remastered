import type {
  AgeCivilizationIdentity,
  GameAge,
  GameState,
  LeaderAttributeKey,
  LeaderAttributes,
  LeaderProfile,
  YieldMap,
} from '../types';
import { MEMENTO_DEFINITIONS } from '../metaProgression';

const LEADER_ATTRIBUTE_KEYS: LeaderAttributeKey[] = [
  'military',
  'science',
  'culture',
  'economy',
  'diplomacy',
];

function emptyAttributes(): LeaderAttributes {
  return {
    military: 0,
    science: 0,
    culture: 0,
    economy: 0,
    diplomacy: 0,
  };
}

export function createLeaderProfiles(
  civs: GameState['civilizations'],
  civIdentities: AgeCivilizationIdentity[]
): LeaderProfile[] {
  return civs.map((civ, civIndex) => ({
    id: `leader-${civIndex}-${civIdentities[civIndex]?.templateId ?? civ.id}`,
    civIndex,
    displayName: civ.leader,
    persistentXp: 0,
    unspentAttributePoints: 0,
    attributes: emptyAttributes(),
    activeMementos: [],
  }));
}

function traitTagsFromCiv(civ: GameState['civilizations'][number]): string[] {
  const tags: string[] = [];
  if ((civ.resources.science ?? 0) >= (civ.resources.culture ?? 0)) tags.push('scholar');
  if ((civ.resources.gold ?? 0) >= 20) tags.push('merchant');
  if ((civ.resources.faith ?? 0) >= 15) tags.push('spiritual');
  if ((civ.resources.production ?? 0) >= 20) tags.push('industrial');
  if ((civ.diplomaticFavor ?? 0) >= 15) tags.push('diplomatic');
  return tags;
}

export function createCivilizationIdentityLayer(
  civs: GameState['civilizations'],
  templates: Array<{ id: string; name: string; adjective: string }>,
  age: GameAge
): AgeCivilizationIdentity[] {
  return civs.map((civ, i) => {
    const tpl = templates[i];
    return {
      civIndex: i,
      templateId: tpl?.id ?? `civ-${i}`,
      currentName: civ.name,
      currentAdjective: civ.adjective,
      age,
      traitTags: traitTagsFromCiv(civ),
    };
  });
}

function bestAttributeForCiv(state: GameState, civIndex: number): LeaderAttributeKey {
  const civ = state.civilizations[civIndex];
  if (!civ) return 'economy';
  const military = civ.units.length * 2 + (civ.score * 0.03);
  const science = civ.resources.science + civ.researchedTechs.length * 3;
  const culture = civ.resources.culture + (civ.researchedCivics?.length ?? 0) * 2;
  const economy = civ.resources.gold + civ.resources.production * 0.8;
  const diplomacy = civ.diplomaticFavor + civ.diplomaticVictoryPoints * 8;
  const ranked: Array<{ key: LeaderAttributeKey; value: number }> = [
    { key: 'military', value: military },
    { key: 'science', value: science },
    { key: 'culture', value: culture },
    { key: 'economy', value: economy },
    { key: 'diplomacy', value: diplomacy },
  ];
  ranked.sort((a, b) => b.value - a.value);
  return ranked[0]?.key ?? 'economy';
}

function spendOneAttributePoint(
  leader: LeaderProfile,
  key: LeaderAttributeKey
): LeaderProfile {
  if (leader.unspentAttributePoints <= 0) return leader;
  return {
    ...leader,
    unspentAttributePoints: leader.unspentAttributePoints - 1,
    attributes: {
      ...leader.attributes,
      [key]: Math.min(20, (leader.attributes[key] ?? 0) + 1),
    },
  };
}

export function onAgeTransitionLeaderProgress(state: GameState): GameState {
  const leaders = state.leaders ?? [];
  if (!leaders.length) return state;
  const updated = leaders.map(leader => {
    const alive = state.civilizations[leader.civIndex]?.isAlive;
    if (!alive) return leader;
    return {
      ...leader,
      persistentXp: leader.persistentXp + 35,
      unspentAttributePoints: leader.unspentAttributePoints + 1,
    };
  });
  return { ...state, leaders: updated };
}

function perkTier(level: number): number {
  if (level >= 10) return 3;
  if (level >= 6) return 2;
  if (level >= 3) return 1;
  return 0;
}

export function allocateLeaderAttributePoint(
  state: GameState,
  civIndex: number,
  key: LeaderAttributeKey
): GameState {
  const leaders = state.leaders ?? [];
  const idx = leaders.findIndex(l => l.civIndex === civIndex);
  if (idx < 0) return state;
  const current = leaders[idx]!;
  const updated = spendOneAttributePoint(current, key);
  if (updated === current) return state;
  const next = [...leaders];
  next[idx] = updated;
  return { ...state, leaders: next };
}

export function autoAllocateLeaderAttributesForAi(state: GameState): GameState {
  let next = state;
  const leaders = next.leaders ?? [];
  for (const leader of leaders) {
    const civ = next.civilizations[leader.civIndex];
    if (!civ?.isAlive || civ.isHuman) continue;
    let points = next.leaders?.find(l => l.civIndex === leader.civIndex)?.unspentAttributePoints ?? 0;
    while (points > 0) {
      const key = bestAttributeForCiv(next, leader.civIndex);
      const after = allocateLeaderAttributePoint(next, leader.civIndex, key);
      if (after === next) break;
      next = after;
      points = next.leaders?.find(l => l.civIndex === leader.civIndex)?.unspentAttributePoints ?? 0;
    }
  }
  return next;
}

export function leaderYieldBonuses(state: GameState, civIndex: number): Partial<YieldMap> {
  const leader = state.leaders?.find(l => l.civIndex === civIndex);
  if (!leader) return {};
  const a = leader.attributes;
  const mTier = perkTier(a.military);
  const sTier = perkTier(a.science);
  const cTier = perkTier(a.culture);
  const eTier = perkTier(a.economy);
  const dTier = perkTier(a.diplomacy);
  const mementoBonus: Partial<YieldMap> = {};
  const hasMemento = new Set(leader.activeMementos ?? []);
  for (const m of MEMENTO_DEFINITIONS) {
    if (!hasMemento.has(m.id)) continue;
    if (m.id === 'scholar_tablet') mementoBonus.science = (mementoBonus.science ?? 0) + 2;
    if (m.id === 'merchant_seal') mementoBonus.gold = (mementoBonus.gold ?? 0) + 2;
    if (m.id === 'war_banner') mementoBonus.production = (mementoBonus.production ?? 0) + 2;
    if (m.id === 'oracle_reliquary') mementoBonus.culture = (mementoBonus.culture ?? 0) + 2;
    if (m.id === 'diplomat_codex') mementoBonus.happiness = (mementoBonus.happiness ?? 0) + 2;
    if (m.id === 'sacred_idol') mementoBonus.faith = (mementoBonus.faith ?? 0) + 2;
  }
  const base = {
    production: Math.floor(a.military * 0.35) + mTier,
    science: Math.floor(a.science * 0.6) + (sTier >= 2 ? 1 : 0),
    culture: Math.floor(a.culture * 0.55) + cTier,
    gold: Math.floor(a.economy * 0.75) + (eTier >= 1 ? 1 : 0),
    faith: Math.floor((a.culture + a.diplomacy) * 0.18) + (dTier >= 2 ? 1 : 0),
    happiness: Math.floor(a.diplomacy * 0.25) + dTier,
  } satisfies Partial<YieldMap>;
  return {
    production: (base.production ?? 0) + (mementoBonus.production ?? 0),
    science: (base.science ?? 0) + (mementoBonus.science ?? 0),
    culture: (base.culture ?? 0) + (mementoBonus.culture ?? 0),
    gold: (base.gold ?? 0) + (mementoBonus.gold ?? 0),
    faith: (base.faith ?? 0) + (mementoBonus.faith ?? 0),
    happiness: (base.happiness ?? 0) + (mementoBonus.happiness ?? 0),
  };
}

export function syncCivilizationIdentityAge(state: GameState, age: GameAge): GameState {
  if (!state.civilizationIdentity?.length) return state;
  return {
    ...state,
    civilizationIdentity: state.civilizationIdentity.map(ci => ({ ...ci, age })),
  };
}

export function normalizeLeaderProfiles(state: GameState): LeaderProfile[] {
  const n = state.civilizations.length;
  const existing = Array.isArray(state.leaders) ? state.leaders : [];
  return Array.from({ length: n }, (_, i) => {
    const cur = existing.find(l => l.civIndex === i);
    if (!cur) {
      return {
        id: `leader-${i}`,
        civIndex: i,
        displayName: state.civilizations[i]?.leader ?? `Leader ${i + 1}`,
        persistentXp: 0,
        unspentAttributePoints: 0,
        attributes: emptyAttributes(),
        activeMementos: [],
      };
    }
    const attrs = cur.attributes ?? emptyAttributes();
    return {
      ...cur,
      civIndex: i,
      displayName: cur.displayName || state.civilizations[i]?.leader || `Leader ${i + 1}`,
      persistentXp: Math.max(0, Math.floor(Number(cur.persistentXp ?? 0))),
      unspentAttributePoints: Math.max(0, Math.floor(Number(cur.unspentAttributePoints ?? 0))),
      attributes: {
        military: Math.max(0, Math.floor(Number(attrs.military ?? 0))),
        science: Math.max(0, Math.floor(Number(attrs.science ?? 0))),
        culture: Math.max(0, Math.floor(Number(attrs.culture ?? 0))),
        economy: Math.max(0, Math.floor(Number(attrs.economy ?? 0))),
        diplomacy: Math.max(0, Math.floor(Number(attrs.diplomacy ?? 0))),
      },
      activeMementos: Array.isArray(cur.activeMementos) ? cur.activeMementos.map(String) : [],
    };
  });
}

export function normalizeCivilizationIdentity(state: GameState): AgeCivilizationIdentity[] {
  const n = state.civilizations.length;
  const existing = Array.isArray(state.civilizationIdentity) ? state.civilizationIdentity : [];
  const age = state.age?.currentAge ?? 'antiquity';
  return Array.from({ length: n }, (_, i) => {
    const cur = existing.find(c => c.civIndex === i);
    if (!cur) {
      const civ = state.civilizations[i]!;
      return {
        civIndex: i,
        templateId: `civ-${i}`,
        currentName: civ.name,
        currentAdjective: civ.adjective,
        age,
        traitTags: traitTagsFromCiv(civ),
      };
    }
    return {
      civIndex: i,
      templateId: cur.templateId || `civ-${i}`,
      currentName: cur.currentName || state.civilizations[i]?.name || `Civ ${i + 1}`,
      currentAdjective: cur.currentAdjective || state.civilizations[i]?.adjective || `Civ ${i + 1}`,
      age: cur.age === 'exploration' || cur.age === 'modern' ? cur.age : 'antiquity',
      traitTags: Array.isArray(cur.traitTags) ? cur.traitTags.map(String) : [],
    };
  });
}

export { LEADER_ATTRIBUTE_KEYS };

