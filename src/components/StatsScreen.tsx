import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { GameState } from '../game/types';
import { ERA_LABELS, DIPLOMACY_VICTORY_POINTS_REQUIRED } from '../game/constants';
import { getVisitingTourists, isCulturallyDominant } from '../game/featureSystems';
import { computeMapDiscoveredCivIndices } from '../game/mapDiscovery';
import { t } from '../i18n';
import { GnozianGlyph, GnozianPanelCorners, CivEmblem } from './ui';
import { modalBackdropMotion, modalCardMotion } from './ui/motionPresets';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';

interface Props {
  gameState: GameState;
  onClose: () => void;
}

export default function StatsScreen({ gameState, onClose }: Props) {
  const me = useLocalPlayerCivIndex();
  const civilizations = gameState.civilizations;
  const humanCiv = civilizations[me] ?? civilizations[0]!;
  const discovered = useMemo(() => computeMapDiscoveredCivIndices(gameState, me), [gameState, me]);

  const totalCities = gameState.cities.filter(c => c.owner === me).length;
  const totalUnits = gameState.units.filter(u => u.owner === me).length;
  const totalBuildings = gameState.cities
    .filter(c => c.owner === me)
    .reduce((sum, city) => sum + city.buildings.length, 0);

  const rankedCivs = useMemo(
    () =>
      [...civilizations]
        .filter((_, i) => i === me || discovered.has(i))
        .sort((a, b) => b.score - a.score),
    [civilizations, discovered, me]
  );

  const culturalCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < civilizations.length; i++) {
      if (i === me || !discovered.has(i)) continue;
      if ((humanCiv.culturalInfluence[i] ?? 0) > 0) n++;
    }
    return n;
  }, [civilizations.length, humanCiv.culturalInfluence, discovered, me]);

  const cultureDom = useMemo(() => {
    let n = 0;
    for (let j = 0; j < gameState.civilizations.length; j++) {
      if (j === me || !discovered.has(j) || !gameState.civilizations[j]!.isAlive) continue;
      if (isCulturallyDominant(gameState, me, j)) n++;
    }
    return n;
  }, [gameState, me, discovered]);

  const aliveRivalsDiscovered = useMemo(
    () => gameState.civilizations.filter((c, i) => i !== me && c.isAlive && discovered.has(i)).length,
    [gameState.civilizations, me, discovered]
  );
  const culturePct =
    aliveRivalsDiscovered <= 0 ? 0 : Math.min(100, Math.round((cultureDom / aliveRivalsDiscovered) * 100));
  const visiting = Math.round(getVisitingTourists(gameState, me) * 10) / 10;
  const domestic = Math.round(gameState.systems.touristDomestic[me] ?? 0);
  const diploPct = Math.min(
    100,
    Math.round((humanCiv.diplomaticVictoryPoints / DIPLOMACY_VICTORY_POINTS_REQUIRED) * 100)
  );

  return (
    <motion.div
      {...modalBackdropMotion}
      className="fixed inset-0 z-50 gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3"
      onClick={onClose}
    >
      <motion.div
        {...modalCardMotion}
        className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-600/45 bg-gradient-to-b from-[#221b14] via-[#130f0b] to-black shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <GnozianPanelCorners inset={5} size={36} />
        <div className="relative z-10 flex items-center justify-between border-b border-amber-900/30 bg-black/35 p-6">
          <h1 className="flex items-center gap-3 text-3xl font-black text-white">
            <GnozianGlyph name="chart" size={30} className="text-amber-400/90" />
            {t('stats.title')}
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="relative z-10 flex-1 space-y-6 overflow-y-auto p-6">
          <div className="rounded-lg border border-blue-600/50 bg-gradient-to-r from-blue-900/30 to-cyan-900/20 p-4">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-blue-300">
              <GnozianGlyph name="user" size={22} className="text-sky-300/90" />
              {t('stats.yourCiv')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-2xl font-bold text-white">{totalCities}</div>
                <div className="text-xs text-gray-400">{t('stats.metric.cities')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{totalUnits}</div>
                <div className="text-xs text-gray-400">{t('stats.metric.units')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{totalBuildings}</div>
                <div className="text-xs text-gray-400">{t('stats.metric.buildings')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{ERA_LABELS[humanCiv.era]}</div>
                <div className="text-xs text-gray-400">{t('stats.metric.era')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{gameState.turn}</div>
                <div className="text-xs text-gray-400">{t('stats.metric.turn')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-400">
                  {Math.round(humanCiv.resources.gold)}
                </div>
                <div className="text-xs text-gray-400">{t('stats.metric.gold')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {Math.round(humanCiv.resources.science)}
                </div>
                <div className="text-xs text-gray-400">{t('stats.metric.sciencePerTurn')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">
                  {humanCiv.researchedTechs.length}
                </div>
                <div className="text-xs text-gray-400">{t('stats.metric.techs')}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-900/30 to-amber-900/20 rounded-lg p-4 border border-yellow-600/50">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-yellow-300">
              <GnozianGlyph name="trophy" size={20} className="text-amber-300/90" />
              {t('stats.victoryProgress')}
            </h2>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">{t('stats.victory.science')}</span>
                  <span className="text-xs text-gray-400">{Math.round(humanCiv.scienceVictoryProgress)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, humanCiv.scienceVictoryProgress)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">{t('stats.victory.culture')}</span>
                  <span className="text-xs text-gray-400">
                    {t('stats.culturalInfluenced', { count: culturalCount })} · {t('stats.dominancePct', { pct: culturePct })}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-1">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${culturePct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {t('stats.tourismPressureLine', { visiting, domestic })}
                </div>
                <div className="flex gap-1 mt-2">
                  {civilizations.map((civ, i) =>
                    discovered.has(i) ? (
                      <div
                        key={i}
                        className="flex-1 h-2 rounded-full"
                        style={{
                          backgroundColor: humanCiv.culturalInfluence[i]! > 50 ? '#6366f1' : '#4b5563',
                        }}
                        title={`${civ.name}: ${Math.round(humanCiv.culturalInfluence[i] || 0)}%`}
                      />
                    ) : null
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">{t('stats.victory.diplomacy')}</span>
                  <span className="text-xs text-gray-400">
                    {humanCiv.diplomaticVictoryPoints}/{DIPLOMACY_VICTORY_POINTS_REQUIRED} {t('stats.dvpShort')}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${diploPct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <GnozianGlyph name="globe" size={20} className="text-amber-400/90" />
              {t('stats.globalRankings')}
            </h2>
            <div className="space-y-2">
              {rankedCivs.map((civ, idx) => (
                <motion.div
                  key={`${civ.id}-${idx}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    civilizations.indexOf(civ) === me
                      ? 'bg-amber-900/30 border-amber-600/50'
                      : 'bg-gray-700/30 border-gray-600/30'
                  }`}
                >
                  <div className="text-xl font-bold w-6">{idx + 1}.</div>
                  <CivEmblem
                    primary={civ.color}
                    secondary={civ.secondaryColor}
                    variant={civilizations.indexOf(civ)}
                    size={20}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-white text-sm">
                      {civ.name}
                      {!civ.isAlive && <span className="text-red-400 text-xs ml-2">{t('stats.defeated')}</span>}
                    </div>
                    <div className="text-xs text-gray-400">
                      {ERA_LABELS[civ.era]} • {t('stats.citiesCount', { n: civ.cities.length })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-400">{civ.score}</div>
                    <div className="text-xs text-gray-400">{t('stats.points')}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
            <h2 className="text-lg font-bold text-white mb-3">{t('stats.gameInfo')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400">{t('stats.mapSize')}</div>
                <div className="font-semibold text-white">
                  {gameState.settings.mapWidth}×{gameState.settings.mapHeight}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{t('stats.mapType')}</div>
                <div className="font-semibold text-white capitalize">{gameState.settings.mapType}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{t('stats.difficulty')}</div>
                <div className="font-semibold text-white capitalize">{gameState.settings.difficulty}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{t('stats.seed')}</div>
                <div className="font-semibold text-white">{gameState.settings.seed}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{t('stats.progress')}</div>
                <div className="font-semibold text-white">
                  {gameState.turn}/{gameState.settings.maxTurns}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{t('stats.elapsed')}</div>
                <div className="font-semibold text-white">
                  {t('stats.ages', { n: Math.floor(gameState.turn / 50) })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-amber-900/30 bg-black/35 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-6 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-lg font-bold transition-all"
          >
            {t('modal.close')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
