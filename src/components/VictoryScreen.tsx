import { motion } from 'framer-motion';
import type { GameState, VictoryType } from '../game/types';
import { ERA_LABELS } from '../game/constants';
import { MenuStarfield, GnozianVictoryMedallion, GnozianGlyph, CivEmblem } from './ui';
import { playUiClick } from '../audio/AudioManager';
import { modalBackdropMotion } from './ui/motionPresets';
import { t } from '../i18n';

interface Props {
  gameState: GameState;
  onNewGame: () => void;
  onContinue: () => void;
}

const VICTORY_CONFIG: Record<VictoryType, { titleKey: string; descKey: string; color: string; grad: string }> = {
  science:   { titleKey: 'victory.science', descKey: 'victory.desc.science', color: 'text-blue-300', grad: 'from-blue-900 to-blue-700' },
  culture:   { titleKey: 'victory.culture', descKey: 'victory.desc.culture', color: 'text-purple-300', grad: 'from-purple-900 to-purple-700' },
  domination:{ titleKey: 'victory.domination', descKey: 'victory.desc.domination', color: 'text-red-300', grad: 'from-red-900 to-red-700' },
  diplomacy: { titleKey: 'victory.diplomacy', descKey: 'victory.desc.diplomacy', color: 'text-green-300', grad: 'from-green-900 to-green-700' },
  time:      { titleKey: 'victory.time', descKey: 'victory.desc.time', color: 'text-amber-300', grad: 'from-amber-900 to-amber-700' },
  religion:  { titleKey: 'victory.religion', descKey: 'victory.desc.religion', color: 'text-teal-300', grad: 'from-teal-900 to-teal-700' },
};

export default function VictoryScreen({ gameState, onNewGame, onContinue }: Props) {
  const { winner, victoryType } = gameState;
  if (winner === null || !victoryType) return null;

  const winnerCiv = gameState.civilizations[winner];
  const config = VICTORY_CONFIG[victoryType];
  const isHuman = winner === 0;

  const finalScores = [...gameState.civilizations]
    .filter(c => c.isAlive || gameState.cities.some(city => city.owner === c.id))
    .sort((a, b) => b.score - a.score);

  return (
    <motion.div
      {...modalBackdropMotion}
      className="fixed inset-0 z-[100] gnz-modal-backdrop flex flex-col items-center justify-center overflow-y-auto p-4"
    >
      <MenuStarfield count={96} seed={0x56494354} className="opacity-80" twinkle />

      <div className="relative z-10 text-center max-w-2xl w-full">
        {/* Victory icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 150 }}
          className="mb-4 flex justify-center"
        >
          <GnozianVictoryMedallion type={victoryType} size={112} className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`text-5xl font-black mb-2 bg-gradient-to-r ${
            isHuman ? 'from-yellow-300 via-amber-300 to-yellow-500' : 'from-red-300 to-red-400'
          } bg-clip-text text-transparent`}
        >
          {isHuman ? t(config.titleKey) : t('victory.defeat')}
        </motion.div>

        {/* Winner */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-xl text-gray-300 mb-1"
        >
          {isHuman ? (
            <span className="inline-flex items-center gap-1.5">
              <GnozianGlyph name="star" size={22} className="text-amber-300/90" />
              {t('victory.achieved')}{' '}
            </span>
          ) : (
            `${winnerCiv.name} ${t('victory.hasAchieved')} `
          )}
          <span className="font-bold text-white">{t(config.titleKey)}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-gray-400 mb-8"
        >
          {t(config.descKey)}
        </motion.div>

        {/* Stats card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring', damping: 18 }}
          className="mb-6 rounded-2xl border border-amber-600/45 bg-gradient-to-b from-[#221b14]/95 via-[#130f0b]/95 to-black/95 p-6 shadow-2xl"
        >
          <div className="flex items-center justify-center gap-4 mb-5">
            <div
              className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 text-3xl shadow-xl"
              style={{ borderColor: winnerCiv.color }}
            >
              <CivEmblem
                primary={winnerCiv.color}
                secondary={winnerCiv.secondaryColor}
                variant={winner}
                size={64}
                className="absolute inset-0 scale-105"
              />
              <GnozianGlyph name={isHuman ? 'crown' : 'trophy'} size={28} className="relative z-10 text-white drop-shadow-lg" />
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-xl">{winnerCiv.name}</div>
              <div className="text-gray-400">{t('victory.ledBy', { leader: winnerCiv.leader })}</div>
              <div className="text-gray-500 text-sm">{ERA_LABELS[winnerCiv.era]}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: t('victory.finalScore'), value: winnerCiv.score, color: 'text-yellow-400' },
              { label: t('victory.turnsPlayed'), value: gameState.turn, color: 'text-blue-400' },
              { label: t('victory.cities'), value: winnerCiv.cities.length, color: 'text-green-400' },
              { label: t('victory.technologies'), value: winnerCiv.researchedTechs.length, color: 'text-purple-400' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                className="rounded-xl border border-stone-700/50 bg-black/40 p-3 text-center"
              >
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-gray-500 text-[10px] uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Leaderboard */}
          <div className="border-t border-stone-800 pt-3">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">{t('victory.finalStandings')}</div>
            {finalScores.map((civ, i) => (
              <motion.div
                key={`${civ.id}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.06 }}
                className={`flex items-center gap-3 py-1.5 ${civ.id === winner ? 'text-yellow-300' : 'text-gray-400'}`}
              >
                <span className="text-sm w-6 text-right font-bold">{i + 1}.</span>
                <CivEmblem
                  primary={civ.color}
                  secondary={civ.secondaryColor}
                  variant={gameState.civilizations.indexOf(civ)}
                  size={16}
                  className="ring-1 ring-white/20"
                />
                <span className="flex-1 text-sm">{civ.name}</span>
                <span className="text-sm text-gray-500">{ERA_LABELS[civ.era]}</span>
                <span className="text-sm font-bold tabular-nums">{civ.score}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex gap-4 justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playUiClick();
              onNewGame();
            }}
            className="px-8 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold rounded-xl shadow-xl transition-all"
          >
            <span className="inline-flex items-center gap-2">
              <GnozianGlyph name="map" size={18} className="text-amber-50/90" />
              {t('victory.newGame')}
            </span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playUiClick();
              onContinue();
            }}
            className="rounded-xl bg-stone-700 px-8 py-3 font-bold text-white transition-all hover:bg-stone-600"
          >
            <span className="inline-flex items-center gap-2">
              <GnozianGlyph name="play" size={18} className="text-white/95" />
              {t('victory.continue')}
            </span>
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
