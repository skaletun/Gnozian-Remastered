import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { GameState, WonderId, SpyMission } from '../game/types';
import {
  WONDERS,
  GOVERNMENTS,
  CIVICS,
  BELIEFS,
  DIPLOMACY_VICTORY_POINTS_REQUIRED,
  SPACE_RACE_STAGE_COSTS,
  NATURAL_RESOURCES,
} from '../game/constants';
import { recruitSpy } from '../game/featureSystems';
import {
  purchasePatronageGreatPeopleBoost,
  getEmpireStrategicResourceAccess,
  startCivicResearch,
} from '../game/engine';
import { t } from '../i18n';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';
import { isProgressionFeatureUnlocked, progressionLockReason } from '../game/progressionLocks';
import { computeMapDiscoveredCivIndices } from '../game/mapDiscovery';

const ALL_SPY_MISSIONS: SpyMission[] = [
  'steal_tech',
  'sabotage',
  'intel',
  'steal_great_work',
  'disrupt_production',
  'promote_loyalty_issues',
  'counter_espionage',
];

interface Props {
  gameState: GameState;
  onClose: () => void;
  onUpdateState: (s: GameState) => void;
  onOpenGovernment: () => void;
}

export default function EmpirePanel({ gameState, onClose, onUpdateState, onOpenGovernment }: Props) {
  const me = useLocalPlayerCivIndex();
  const human = gameState.civilizations[me] ?? gameState.civilizations[0]!;
  const sys = gameState.systems;

  const built = (Object.keys(sys.wonderOwners) as WonderId[]).map(wid => ({
    wid,
    meta: sys.wonderOwners[wid],
    def: WONDERS[wid],
  }));

  const discovered = useMemo(() => computeMapDiscoveredCivIndices(gameState, me), [gameState, me]);

  const otherAlive = gameState.civilizations
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => i !== me && c.isAlive && discovered.has(i));

  const humanCityIds = new Set(gameState.cities.filter(c => c.owner === me).map(c => c.id));
  const greatWorksMine = sys.greatWorks.filter(
    gw => (gw.cityId != null && humanCityIds.has(gw.cityId)) || gw.creatorCiv === me
  );

  const currentGov = GOVERNMENTS[human.governmentId];
  const currentCivic = human.currentCivic ? CIVICS[human.currentCivic] : null;
  const tl = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const civicName = (id: string) => tl(`civic.name.${id}`, CIVICS[id]?.name ?? id);
  const govName = (id: string) => tl(`government.name.${id}`, GOVERNMENTS[id as keyof typeof GOVERNMENTS]?.name ?? id);
  const availableCivics = Object.values(CIVICS)
    .filter(c => c.id === 'future_society' || !(human.researchedCivics ?? []).includes(c.id))
    .filter(c => c.prerequisites.every(p => (human.researchedCivics ?? []).includes(p)))
    .sort((a, b) => a.cost - b.cost);
  const researchedCivics = human.researchedCivics ?? [];
  const researchedSet = new Set(researchedCivics);
  const lockedCivics = Object.values(CIVICS)
    .filter(c => c.id !== 'future_society')
    .filter(c => !researchedCivics.includes(c.id))
    .filter(c => !availableCivics.some(a => a.id === c.id));
  const civicPct = currentCivic ? Math.min(100, ((human.civicProgress ?? 0) / Math.max(1, currentCivic.cost)) * 100) : 0;
  const treeCivics = Object.values(CIVICS).filter(c => c.id !== 'future_society');
  const depthCache = new Map<string, number>();
  const civicDepth = (id: string): number => {
    if (depthCache.has(id)) return depthCache.get(id)!;
    const node = CIVICS[id];
    if (!node || node.prerequisites.length === 0) {
      depthCache.set(id, 0);
      return 0;
    }
    const d = 1 + Math.max(...node.prerequisites.map(p => civicDepth(p)));
    depthCache.set(id, d);
    return d;
  };
  const byDepth = new Map<number, typeof treeCivics>();
  for (const c of treeCivics) {
    const d = civicDepth(c.id);
    byDepth.set(d, [...(byDepth.get(d) ?? []), c]);
  }
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  const colW = 164;
  const rowH = 52;
  const padX = 20;
  const padY = 20;
  const maxRows = Math.max(1, ...depths.map(d => (byDepth.get(d) ?? []).length));
  const treeW = padX * 2 + depths.length * colW;
  const treeH = padY * 2 + maxRows * rowH;
  const pos = new Map<string, { x: number; y: number }>();
  depths.forEach((d, di) => {
    const list = byDepth.get(d) ?? [];
    list.forEach((c, ri) => {
      const x = padX + di * colW + colW / 2;
      const y = padY + ri * rowH + rowH / 2;
      pos.set(c.id, { x, y });
    });
  });

  const sr = sys.spaceRace[me];
  const spaceStage = sr?.stage ?? 'none';
  const spaceProg = sr?.progressProduction ?? 0;
  const spaceCost =
    sr?.stageCost ??
    (spaceStage === 'none'
      ? SPACE_RACE_STAGE_COSTS.satellite
      : spaceStage === 'satellite'
        ? SPACE_RACE_STAGE_COSTS.satellite
        : spaceStage === 'moon'
          ? SPACE_RACE_STAGE_COSTS.moon
          : spaceStage === 'mars'
            ? SPACE_RACE_STAGE_COSTS.mars
            : 1);
  const spacePct =
    spaceStage === 'complete'
      ? 100
      : spaceCost > 0
        ? Math.min(100, (spaceProg / spaceCost) * 100)
        : 0;

  const mySpies = sys.spies.filter(s => s.ownerCiv === me);
  const espionageUnlocked = isProgressionFeatureUnlocked(gameState, me, 'espionage');
  const strategicAccess = getEmpireStrategicResourceAccess(gameState, me);
  const strategicKeys = Object.keys(NATURAL_RESOURCES).filter(
    k => NATURAL_RESOURCES[k as keyof typeof NATURAL_RESOURCES]?.type === 'strategic'
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        onClick={e => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-amber-900/40 bg-stone-950/95 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-amber-200">{t('empire.title')}</h2>
          <button type="button" className="text-stone-500 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        <section className="mb-6 rounded-xl border border-amber-900/35 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-amber-500/90">
            {t('empire.strategicStockpile')}
          </h3>
          <p className="mb-3 text-xs text-stone-500">{t('empire.strategicStockpileHint')}</p>
          <div className="flex flex-wrap gap-2">
            {strategicKeys.map(key => {
              const def = NATURAL_RESOURCES[key as keyof typeof NATURAL_RESOURCES];
              const n = strategicAccess[key] ?? 0;
              const resourceLabel = tl(`resource.name.${key}`, def?.name ?? key);
              return (
                <div
                  key={key}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    n > 0 ? 'border-emerald-800/50 bg-emerald-950/30 text-emerald-100' : 'border-stone-800 bg-stone-900/50 text-stone-500'
                  }`}
                >
                  <span className="font-semibold">{resourceLabel}</span>
                  <span className="ml-2 tabular-nums font-bold text-amber-200/90">×{n}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-sky-600/90">
            {t('empire.diplomacySnapshot')}
          </h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
              <div className="text-[10px] uppercase text-stone-500">{t('empire.dvp')}</div>
              <div className="text-lg font-bold tabular-nums text-amber-200">
                {human.diplomaticVictoryPoints} / {DIPLOMACY_VICTORY_POINTS_REQUIRED}
              </div>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
              <div className="text-[10px] uppercase text-stone-500">{t('empire.diplomaticFavor')}</div>
              <div className="text-lg font-bold tabular-nums text-cyan-200">
                {Math.round(human.diplomaticFavor ?? 0)}
              </div>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
              <div className="text-[10px] uppercase text-stone-500">{t('empire.scienceVictoryProgress')}</div>
              <div className="text-lg font-bold tabular-nums text-sky-300">
                {Math.round(human.scienceVictoryProgress)}%
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-violet-400/90">{t('empire.civicsSection')}</h3>
          <div className="space-y-3 rounded-lg border border-stone-800 bg-stone-900/60 p-3">
            <div className="rounded-md border border-violet-900/40 bg-violet-950/20 p-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-violet-200">
                  {currentCivic ? civicName(currentCivic.id) : t('empire.noActiveCivic')}
                </span>
                {currentCivic && (
                  <span className="tabular-nums text-stone-400">
                    {Math.round(human.civicProgress ?? 0)} / {currentCivic.cost}
                  </span>
                )}
              </div>
              {currentCivic ? (
                <>
                  <div className="mt-1.5 text-xs text-stone-400">{tl(`civic.desc.${currentCivic.id}`, currentCivic.description)}</div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-400 transition-[width]"
                      style={{ width: `${civicPct}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="mt-1 text-xs text-stone-500">{t('empire.pickCivicHint')}</div>
              )}
            </div>

            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                {t('empire.civicTree')}
              </div>
              <div className="overflow-x-auto rounded-md border border-stone-800 bg-black/20 p-2">
                <svg
                  width={treeW}
                  height={treeH}
                  className="h-[190px] min-w-[560px]"
                  viewBox={`0 0 ${treeW} ${treeH}`}
                  aria-label={t('empire.civicTree')}
                >
                  <defs>
                    <marker
                      id="civicArrowDone"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(74,222,128,0.92)" />
                    </marker>
                    <marker
                      id="civicArrowLocked"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(113,113,122,0.7)" />
                    </marker>
                  </defs>
                  {treeCivics.flatMap(c =>
                    c.prerequisites.map(pre => {
                      const a = pos.get(pre);
                      const b = pos.get(c.id);
                      if (!a || !b) return null;
                      const prereqDone = researchedSet.has(pre);
                      const strokeColor = prereqDone ? 'rgba(74,222,128,0.9)' : 'rgba(113,113,122,0.45)';
                      return (
                        <line
                          key={`${pre}->${c.id}`}
                          x1={a.x + 52}
                          y1={a.y}
                          x2={b.x - 52}
                          y2={b.y}
                          stroke={strokeColor}
                          strokeWidth={prereqDone ? 1.9 : 1.5}
                          markerEnd={prereqDone ? 'url(#civicArrowDone)' : 'url(#civicArrowLocked)'}
                        />
                      );
                    })
                  )}
                  {treeCivics.map(c => {
                    const p = pos.get(c.id);
                    if (!p) return null;
                    const researched = researchedSet.has(c.id);
                    const active = currentCivic?.id === c.id;
                    const available = availableCivics.some(a => a.id === c.id);
                    const fill = active
                      ? 'rgba(109,40,217,0.85)'
                      : researched
                        ? 'rgba(20,83,45,0.85)'
                        : available
                          ? 'rgba(88,28,135,0.6)'
                          : 'rgba(23,23,23,0.7)';
                    const stroke = active
                      ? 'rgba(216,180,254,0.95)'
                      : researched
                        ? 'rgba(74,222,128,0.95)'
                        : available
                          ? 'rgba(196,181,253,0.9)'
                          : 'rgba(82,82,91,0.9)';
                    return (
                      <g key={c.id} transform={`translate(${p.x - 54}, ${p.y - 16})`}>
                        <rect x="0" y="0" width="108" height="32" rx="7" fill={fill} stroke={stroke} strokeWidth="1.4" />
                        <text
                          x="54"
                          y="13"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="rgba(241,245,249,0.95)"
                          style={{ fontSize: '9px', fontWeight: 700 }}
                        >
                          {civicName(c.id)}
                        </text>
                        <text
                          x="54"
                          y="23"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="rgba(226,232,240,0.82)"
                          style={{ fontSize: '8px' }}
                        >
                          {c.cost}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-stone-400">
                  <span className="rounded border border-emerald-700/50 bg-emerald-950/30 px-1.5 py-0.5">{t('empire.civicStateResearched')}</span>
                  <span className="rounded border border-violet-600/60 bg-violet-900/35 px-1.5 py-0.5">{t('empire.civicStateActive')}</span>
                  <span className="rounded border border-violet-900/40 bg-violet-950/30 px-1.5 py-0.5">{t('empire.civicStateAvailable')}</span>
                  <span className="rounded border border-stone-700/60 bg-black/20 px-1.5 py-0.5">{t('empire.civicStateLocked')}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                {t('empire.availableCivics')}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableCivics.map(c => {
                  const active = currentCivic?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                        active
                          ? 'border-violet-600/60 bg-violet-900/35'
                          : 'border-violet-900/40 bg-violet-950/20 hover:bg-violet-900/25'
                      }`}
                      onClick={() => {
                        onUpdateState(startCivicResearch(gameState, me, c.id));
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-violet-100">{civicName(c.id)}</span>
                        <span className="text-[11px] tabular-nums text-violet-300">{c.cost}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-stone-400">{tl(`civic.desc.${c.id}`, c.description)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {lockedCivics.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  {t('empire.lockedCivics')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lockedCivics.map(c => (
                    <div
                      key={c.id}
                      className="rounded border border-stone-800 bg-black/20 px-2 py-1 text-[10px] text-stone-500"
                      title={t('empire.requiresCivics', {
                        list: c.prerequisites.map(p => civicName(p)).join(', '),
                      })}
                    >
                      {civicName(c.id)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-indigo-400/90">
            {t('empire.spaceRaceSection')}
          </h3>
          <p className="mb-2 text-xs text-stone-400">{t('empire.spaceRaceHelp')}</p>
          <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
            <div className="flex justify-between text-sm text-stone-200">
              <span className="font-medium">{t(`empire.spaceStage.${spaceStage}`)}</span>
              {spaceStage !== 'complete' && spaceStage !== 'none' && (
                <span className="tabular-nums text-stone-400">
                  {Math.round(spaceProg)} / {spaceCost}
                </span>
              )}
            </div>
            {spaceStage !== 'complete' && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-700 to-violet-400 transition-[width]"
                  style={{ width: `${spacePct}%` }}
                />
              </div>
            )}
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-amber-600/90">
            {t('empire.governmentSection')}
          </h3>
          <p className="mb-3 text-xs text-stone-400">{t('empire.governmentTeaser')}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-stone-300">
              <span className="font-semibold text-amber-100">{currentGov ? govName(human.governmentId) : human.governmentId}</span>
              {currentGov && currentGov.policySlots > 0 && (
                <span className="text-stone-500">
                  {' '}
                  · {human.slottedPolicyIds.length}/{currentGov.policySlots} {t('empire.policySlots')}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenGovernment}
              className="shrink-0 rounded-lg border border-amber-700/50 bg-amber-950/35 px-4 py-2.5 text-sm font-bold text-amber-100 transition-colors hover:bg-amber-900/45"
            >
              {t('empire.openGovernmentButton')}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-yellow-700/90">
            {t('empire.patronageSection')}
          </h3>
          <p className="mb-2 text-xs text-stone-400">{t('empire.patronageHelp')}</p>
          <button
            type="button"
            onClick={() => {
              onUpdateState(purchasePatronageGreatPeopleBoost(gameState, me));
            }}
            className="rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-2 text-sm font-bold text-yellow-100 transition-colors hover:bg-yellow-950/50"
          >
            {t('empire.patronageButton')}
          </button>
          <div className="mt-1 text-[10px] text-stone-500">
            {t('empire.patronageCount')}: {human.patronagePoints}
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-amber-600/90">
            {t('empire.tourismSection')}
          </h3>
          <p className="mb-2 text-xs text-stone-400">{t('empire.tourismHelp')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
              <div className="text-[10px] uppercase text-stone-500">{t('empire.yourTourism')}</div>
              <div className="text-lg font-bold tabular-nums text-purple-300">{Math.round(human.tourism)}</div>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
              <div className="text-[10px] uppercase text-stone-500">{t('empire.faithPool')}</div>
              <div className="text-lg font-bold tabular-nums text-teal-300">{Math.round(human.faithPool)}</div>
            </div>
          </div>
          {otherAlive.length > 0 && (
            <div className="mt-3 max-h-32 overflow-y-auto text-xs text-stone-400">
              {otherAlive.map(({ c, i }) => {
                const key = `0_${i}`;
                const inf = sys.influence[key] ?? 0;
                return (
                  <div key={i} className="flex justify-between border-b border-stone-800/80 py-1">
                    <span>{c.name}</span>
                    <span className="tabular-nums text-stone-300">
                      {t('empire.influenceTo')} {Math.round(inf)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-fuchsia-600/90">
            {t('empire.greatWorksSection')}
          </h3>
          {greatWorksMine.length === 0 ? (
            <p className="text-sm text-stone-500">{t('empire.noGreatWorks')}</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {greatWorksMine.map(gw => {
                const cityName =
                  gw.cityId == null
                    ? t('empire.greatWorkInTransit')
                    : gameState.cities.find(c => c.id === gw.cityId)?.name ?? `#${gw.cityId}`;
                return (
                  <li
                    key={gw.id}
                    className="flex flex-col gap-0.5 rounded border border-stone-800/80 bg-stone-900/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-stone-200">{gw.name}</span>
                    <span className="text-stone-500">
                      {gw.type} · {cityName} · +{Math.round(gw.tourism)} {t('empire.tourismAbbr')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-teal-600/90">
            {t('empire.religionsSection')}
          </h3>
          {sys.religions.length === 0 ? (
            <p className="text-sm text-stone-500">{t('empire.noReligions')}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {sys.religions.map((r, idx) => (
                <li
                  key={`${r.id}-${idx}`}
                  className="rounded border border-stone-800/80 bg-stone-900/50 px-3 py-2"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-stone-200">{r.name}</span>
                    <span className="text-xs text-stone-500">
                      {t('empire.founder')}{' '}
                      {discovered.has(r.founderCiv)
                        ? gameState.civilizations[r.founderCiv]?.name
                        : t('map.unknownCiv')}{' '}
                      · {t('empire.index')}{' '}
                      {idx}
                    </span>
                  </div>
                  {r.beliefs?.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-stone-800/60 pt-2 text-[11px] text-stone-400">
                      {r.beliefs.map(bid => (
                        <li key={bid}>
                          <span className="font-semibold text-teal-700/90">{bid}</span>
                          {BELIEFS[bid] ? ` — ${BELIEFS[bid].description}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6 rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-amber-600/90">
            {t('empire.wondersSection')}
          </h3>
          {built.length === 0 ? (
            <p className="text-sm text-stone-500">{t('empire.noWonders')}</p>
          ) : (
            <ul className="space-y-2">
              {built.map(({ wid, meta, def }) => (
                <li key={wid} className="flex justify-between text-sm text-stone-300">
                  <span>{def?.name ?? wid}</span>
                  <span className="text-xs text-stone-500">
                    {meta ? (
                      discovered.has(meta.civIndex) ? (
                        gameState.civilizations[meta.civIndex]?.name
                      ) : (
                        <span>{t('map.unknownCiv')}</span>
                      )
                    ) : (
                      ''
                    )}{' '}
                    · {t('empire.turn')}{' '}
                    {meta?.turnBuilt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-stone-800 bg-black/40 p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-red-700/90">
            {t('empire.espionageSection')}
          </h3>
          <p className="mb-3 text-xs text-stone-500">
            {espionageUnlocked ? t('empire.espionageHelp') : progressionLockReason('espionage')}
          </p>
          <div className="space-y-3">
            {otherAlive.map(({ c, i }) => (
              <div key={i}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  {c.name}
                </div>
                <div className="flex flex-wrap gap-1">
                  {ALL_SPY_MISSIONS.map(mission => (
                    <button
                      key={mission}
                      type="button"
                      disabled={!espionageUnlocked}
                      title={!espionageUnlocked ? progressionLockReason('espionage') : undefined}
                      className={`rounded border px-2 py-1 text-[9px] font-bold uppercase sm:text-[10px] ${
                        espionageUnlocked
                          ? 'border-red-900/50 bg-red-950/40 text-red-200 hover:bg-red-900/50'
                          : 'cursor-not-allowed border-red-950/35 bg-red-950/15 text-red-800 opacity-50'
                      }`}
                      onClick={() => {
                        if (!espionageUnlocked) return;
                        onUpdateState(recruitSpy(gameState, me, i, mission));
                      }}
                    >
                      {t(`empire.spyMission.${mission}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {mySpies.length > 0 && (
            <div className="mt-4 border-t border-stone-800/80 pt-3">
              <div className="mb-2 text-[10px] font-bold uppercase text-stone-500">
                {t('empire.activeSpiesDetail')} ({mySpies.length})
              </div>
              <ul className="space-y-1.5 text-xs text-stone-400">
                {mySpies.map(sp => (
                  <li key={sp.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {t(`empire.spyMission.${sp.mission}`)} →{' '}
                      <span className="text-stone-300">
                        {discovered.has(sp.targetCiv)
                          ? gameState.civilizations[sp.targetCiv]?.name
                          : t('map.unknownCiv')}
                      </span>
                      {sp.discovered && (
                        <span className="ml-2 text-red-400">{t('empire.spyDiscovered')}</span>
                      )}
                    </span>
                    <span className="tabular-nums text-stone-600">{sp.turnsActive}t</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </motion.div>
    </motion.div>
  );
}
