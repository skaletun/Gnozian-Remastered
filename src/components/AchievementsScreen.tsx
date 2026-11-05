import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AchievementsMap } from '../game/achievements';
import { ACHIEVEMENTS, getProgressPercentage } from '../game/achievements';
import { t } from '../i18n';
import { GnozianGlyph, GnozianPanelCorners, Gnz2DAsset, type GnozianGlyphName, GnzNavRailBtn } from './ui';
import { playUiClick } from '../audio/AudioManager';
import { modalBackdropMotion, modalCardMotion } from './ui/motionPresets';

interface Props {
  achievements: AchievementsMap;
  onClose: () => void;
}

type CategoryFilter = 'all' | 'military' | 'science' | 'culture' | 'diplomacy' | 'exploration' | 'economic' | 'milestone';

const CAT_GLYPH: Record<CategoryFilter, GnozianGlyphName> = {
  all: 'target',
  military: 'swords',
  science: 'book',
  culture: 'palette',
  diplomacy: 'handshake',
  exploration: 'map',
  economic: 'trophy',
  milestone: 'bolt',
};

const ACHIEVEMENT_GLYPH: Partial<Record<string, GnozianGlyphName>> = {
  // Military
  first_blood: 'sword',
  city_conqueror: 'war',
  iron_wall: 'shield',
  world_dominator: 'crown',
  // Science
  first_tech: 'flask',
  tech_master: 'book',
  science_victory: 'rocket',
  // Culture / Diplomacy
  culture_victory: 'culture',
  diplomatic_victory: 'handshake',
  // Economy / Exploration
  wealthy: 'trophy',
  // Milestones
  first_city: 'city',
  empire_builder: 'empire',
  undefeated: 'star',
};

function achievementGlyph(id: string, category: CategoryFilter): GnozianGlyphName {
  return ACHIEVEMENT_GLYPH[id] ?? CAT_GLYPH[category] ?? 'target';
}

function achievementName(id: string, fallback: string): string {
  const key = `achievement.${id}.name`;
  const s = t(key);
  return s !== key ? s : fallback;
}

function achievementDesc(id: string, fallback: string): string {
  const key = `achievement.${id}.desc`;
  const s = t(key);
  return s !== key ? s : fallback;
}

export default function AchievementsScreen({ achievements, onClose }: Props) {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  const filteredAchievements = Object.entries(achievements)
    .filter(([id]) => {
      if (filter !== 'all' && ACHIEVEMENTS[id]?.category !== filter) return false;
      if (showUnlockedOnly && !achievements[id].unlocked) return false;
      return true;
    })
    .sort((a, b) => {
      const aUnlocked = achievements[a[0]].unlocked ? 0 : 1;
      const bUnlocked = achievements[b[0]].unlocked ? 0 : 1;
      if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked;
      return achievements[b[0]].progress - achievements[a[0]].progress;
    });

  const totalAchievements = Object.keys(ACHIEVEMENTS).length;
  const unlockedCount = Object.values(achievements).filter(a => a.unlocked).length;
  const completionPercentage = Math.round((unlockedCount / totalAchievements) * 100);

  const categories: CategoryFilter[] = ['all', 'military', 'science', 'culture', 'diplomacy', 'exploration', 'economic', 'milestone'];

  const diffLabel = (d: string) => {
    const k = `achieve.diff.${d}`;
    const s = t(k);
    return s !== k ? s : d.toUpperCase();
  };

  return (
    <motion.div
      {...modalBackdropMotion}
      className="fixed inset-0 z-50 gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3"
      onClick={onClose}
    >
      <motion.div
        {...modalCardMotion}
        className="gnz-achievements-window gnz-2d-panel relative gnz-panel mx-4 flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-200/[0.14] shadow-2xl ring-1 ring-amber-400/[0.14]"
        onClick={e => e.stopPropagation()}
      >
        <GnozianPanelCorners inset={5} size={36} />
        <div className="gnz-achievements-header relative z-10 flex items-center justify-between border-b border-cyan-200/[0.12] bg-black/30 px-4 py-5 sm:px-6">
          <div>
            <h1 className="gnz-heading flex items-center gap-3 text-2xl font-black sm:text-3xl">
              <GnozianGlyph name="trophy" size={30} className="text-amber-400/90" />
              {t('achieve.title')}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {t('achieve.unlockedSummary', {
                unlocked: unlockedCount,
                total: totalAchievements,
                pct: completionPercentage,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="gnz-achievements-close flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-amber-600/50 bg-slate-900/80 transition-colors hover:bg-slate-700/90" aria-label={t('modal.close')}
          >
            <Gnz2DAsset name="close" className="h-6 w-6" />
          </button>
        </div>

        <div className="gnz-achievements-progress border-b border-cyan-200/[0.1] bg-black/28 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-3 overflow-hidden rounded-full bg-stone-700">
                <motion.div
                  className="h-full bg-gradient-to-r from-yellow-500 to-amber-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPercentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
            <span className="text-sm font-bold text-amber-400">{completionPercentage}%</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav className="gnz-achievements-tabs flex shrink-0 flex-row gap-1 overflow-x-auto overscroll-x-contain border-b border-cyan-200/[0.12] bg-black/28 px-2 py-2 lg:w-[13.75rem] lg:flex-col lg:gap-0.5 lg:border-b-0 lg:border-r lg:px-2 lg:py-4">
            {categories.map(cat => (
              <GnzNavRailBtn
                key={cat}
                active={filter === cat}
                onClick={() => {
                  playUiClick();
                  setFilter(cat);
                }}
                icon={
                  <GnozianGlyph
                    name={CAT_GLYPH[cat]}
                    size={15}
                    className={filter === cat ? 'text-amber-200/95' : 'text-slate-500'}
                  />
                }
              >
                {t(`achieve.cat.${cat}`)}
              </GnzNavRailBtn>
            ))}
          </nav>

          <div className="flex min-h-0 flex-1 flex-col lg:min-w-0">
            <div className="shrink-0 border-b border-cyan-200/[0.08] bg-black/22 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="unlocked-only"
                  checked={showUnlockedOnly}
                  onChange={e => setShowUnlockedOnly(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                <label htmlFor="unlocked-only" className="cursor-pointer text-sm text-slate-300">
                  {t('achieve.showUnlockedOnly')}
                </label>
              </div>
            </div>

        <div className="gnz-achievements-list relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredAchievements.map(([id, ach]) => {
                const achievement = ACHIEVEMENTS[id];
                if (!achievement) return null;

                const percentage = getProgressPercentage(ach);
                const isUnlocked = ach.unlocked;
                const name = achievementName(id, achievement.name);
                const desc = achievementDesc(id, achievement.description);

                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 rounded-lg border transition-all ${
                      isUnlocked
                        ? 'bg-gradient-to-r from-amber-900/30 to-yellow-900/20 border-amber-600/50 shadow-amber-500/20 shadow-lg'
                        : 'border-stone-700/30 bg-black/35'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`flex-shrink-0 ${isUnlocked ? '' : 'opacity-40 grayscale'}`}>
                        <GnozianGlyph
                          name={achievementGlyph(id, achievement.category as CategoryFilter)}
                          size={26}
                          className={isUnlocked ? 'text-amber-300/90' : 'text-stone-500'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className={`font-bold ${isUnlocked ? 'text-amber-400' : 'text-gray-400'}`}>
                              {name}
                            </h3>
                            <p className={`text-xs mt-1 ${isUnlocked ? 'text-gray-300' : 'text-gray-500'}`}>
                              {desc}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
                            achievement.difficulty === 'easy' ? 'bg-green-900/50 text-green-300' :
                            achievement.difficulty === 'medium' ? 'bg-blue-900/50 text-blue-300' :
                            achievement.difficulty === 'hard' ? 'bg-purple-900/50 text-purple-300' :
                            'bg-red-900/50 text-red-300'
                          }`}>
                            {diffLabel(achievement.difficulty)}
                          </span>
                        </div>

                        {!isUnlocked && ach.maxProgress > 1 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-400">{t('achieve.progress')}</span>
                              <span className="text-xs text-amber-400 font-semibold">{percentage}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-700">
                              <motion.div
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {ach.progress} / {ach.maxProgress}
                            </div>
                          </div>
                        )}

                        {isUnlocked && (
                          <div className="mt-2 text-xs text-green-400 font-semibold">
                            ✓ {t('achieve.unlocked')}
                            {ach.unlockedAtTurn != null
                              ? ` — ${t('achieve.unlockedAtTurn', { turn: ach.unlockedAtTurn })}`
                              : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredAchievements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="mb-4 flex justify-center">
                <GnozianGlyph name="target" size={44} className="text-stone-500" />
              </div>
              <p className="text-lg font-semibold">{t('achieve.empty')}</p>
              <p className="text-sm">{t('achieve.emptyHint')}</p>
            </div>
          )}
        </div>
          </div>
        </div>

        <div className="gnz-achievements-footer border-t border-cyan-200/[0.12] bg-black/35 p-4">
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="gnz-2d-button gnz-2d-button--primary w-full rounded-lg px-6 py-2 font-bold text-white transition-all"
          >
            {t('modal.close')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
