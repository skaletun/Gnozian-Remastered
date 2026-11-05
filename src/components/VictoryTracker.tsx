import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { GameState } from '../game/types';
import {
  getVisitingTourists,
  isCulturallyDominant,
} from '../game/featureSystems';
import { computeMapDiscoveredCivIndices } from '../game/mapDiscovery';
import { DIPLOMACY_VICTORY_POINTS_REQUIRED } from '../game/constants';
import { isVictoryTypeUnlockedForAge } from '../game/systems/victoryRulesCore';
import { t } from '../i18n';
import { CivEmblem } from './ui';
import { modalBackdropMotion, modalCardMotion } from './ui/motionPresets';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';

interface Props {
  gameState: GameState;
  onClose: () => void;
}

export default function VictoryTracker({ gameState, onClose }: Props) {
  const me = useLocalPlayerCivIndex();
  const discovered = useMemo(() => computeMapDiscoveredCivIndices(gameState, me), [gameState, me]);

  const rows = useMemo(() => {
    return gameState.civilizations
      .map((civ, i) => {
        if (!civ.isAlive)
          return { i, civ, science: 0, culture: 0, diplo: 0, religion: 0, visiting: 0, domestic: 0 };

        const sr = gameState.systems.spaceRace[i];
        const age = gameState.age?.currentAge ?? 'antiquity';
        const sciencePct =
          isVictoryTypeUnlockedForAge(age, 'science')
            ? sr?.stage === 'complete'
              ? 100
              : Math.round(civ.scienceVictoryProgress)
            : 0;

        let dom = 0;
        let aliveKnownRivals = 0;
        for (let j = 0; j < gameState.civilizations.length; j++) {
          if (i === j || !gameState.civilizations[j]!.isAlive || !discovered.has(j)) continue;
          aliveKnownRivals++;
          if (isCulturallyDominant(gameState, i, j)) dom++;
        }

        const culturePct =
          !isVictoryTypeUnlockedForAge(age, 'culture')
            ? 0
            : aliveKnownRivals <= 0
              ? 0
              : Math.min(100, Math.round((dom / aliveKnownRivals) * 100));

        const visiting = Math.round(getVisitingTourists(gameState, i) * 10) / 10;
        const domestic = Math.round(gameState.systems.touristDomestic[i] ?? 0);

        const diploPct = isVictoryTypeUnlockedForAge(age, 'diplomacy')
          ? Math.min(100, Math.round((civ.diplomaticVictoryPoints / DIPLOMACY_VICTORY_POINTS_REQUIRED) * 100))
          : 0;

        let relPct = 0;
        if (isVictoryTypeUnlockedForAge(age, 'religion') && civ.religionIndex != null && gameState.turn > 40) {
          let tot = 0;
          let m = 0;
          for (let j = 0; j < gameState.civilizations.length; j++) {
            if (i === j || !gameState.civilizations[j]!.isAlive || !discovered.has(j)) continue;
            const cs = gameState.cities.filter(ct => ct.owner === j);
            tot += cs.length;
            m += cs.filter(ct => ct.majorityReligionIndex === civ.religionIndex).length;
          }
          relPct = tot > 0 ? Math.min(100, Math.round((m / tot) * 100)) : 0;
        }

        return {
          i,
          civ,
          science: sciencePct,
          culture: culturePct,
          diplo: diploPct,
          religion: relPct,
          visiting,
          domestic,
        };
      })
      .filter(row => discovered.has(row.i));
  }, [gameState, discovered]);

  return (
    <motion.div
      {...modalBackdropMotion}
      className="fixed inset-0 z-[60] gnz-modal-backdrop flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        {...modalCardMotion}
        className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-xl border border-amber-700/45 bg-gradient-to-b from-[#221b14] via-[#130f0b] to-black p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-amber-200">{t('game.victoryTracker')}</h2>
          <button
            type="button"
            className="rounded-lg bg-stone-800 px-3 py-1 text-sm text-stone-200 hover:bg-stone-700"
            onClick={onClose}
          >
            {t('modal.close')}
          </button>
        </div>
        <p className="mb-4 text-sm text-stone-400">
          {t('victoryTracker.help')}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-700 text-stone-400">
                <th className="py-2 pr-3">{t('victoryTracker.civ')}</th>
                <th className="py-2 pr-3">{t('diplomacy.science')}</th>
                <th className="py-2 pr-3">{t('diplomacy.culture')}</th>
                <th className="py-2 pr-3">{t('victoryTracker.tourism')}</th>
                <th className="py-2 pr-3">{t('diplomacy.title')}</th>
                <th className="py-2 pr-3">{t('victoryTracker.religion')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.i}-${row.civ.id}-${idx}`} className="border-b border-stone-800/80">
                  <td className="py-2 pr-3 font-medium text-stone-100">
                    <CivEmblem
                      primary={row.civ.color}
                      secondary={row.civ.secondaryColor}
                      variant={row.i}
                      size={14}
                      className="mr-2 inline-block align-middle"
                    />
                    {row.civ.name}
                    {!row.civ.isAlive && <span className="ml-2 text-red-400">{t('stats.defeated')}</span>}
                  </td>
                  <td className="py-2 pr-3 text-cyan-300">{row.science}%</td>
                  <td className="py-2 pr-3 text-violet-300">{row.culture}%</td>
                  <td className="py-2 pr-3 text-stone-400">
                    {row.visiting} / {row.domestic}
                  </td>
                  <td className="py-2 pr-3 text-emerald-300">{row.diplo}%</td>
                  <td className="py-2 pr-3 text-teal-300">{row.religion}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
