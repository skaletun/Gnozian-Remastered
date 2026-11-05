import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { saveManager, formatSaveDate, formatPlayTime, displayCivilizationNameForSave, type SaveData } from '../game/saveManager';
import { LEGACY_FLAT_SAVE_KEY } from '../game/loadPersistedGameState';
import { GnzButton, GnzModalFrame, GnozianGlyph } from './ui';
import { t } from '../i18n';
import { useLayoutProfile } from '../hooks/useLayoutProfile';

const MAX = 10;

type Props = {
  onLoadSlot: (slot: number) => void;
  onBack: () => void;
  onSavesChanged?: () => void;
};

export default function SaveLoadScreen({ onLoadSlot, onBack, onSavesChanged }: Props) {
  const layout = useLayoutProfile();
  const compact = layout === 'mobile';
  const [tick, setTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const rows = useMemo(() => {
    const list: Array<{ slot: number; save: SaveData | null }> = [];
    for (let slot = 0; slot < MAX; slot++) {
      list.push({ slot, save: saveManager.loadGame(slot) });
    }
    return list;
  }, [tick]);

  const refresh = useCallback(() => {
    setTick(t => t + 1);
    onSavesChanged?.();
  }, [onSavesChanged]);

  const handleLoad = (slot: number) => {
    onLoadSlot(slot);
  };

  const confirmDelete = (slot: number) => {
    if (pendingDelete === slot) {
      saveManager.deleteSave(slot);
      setPendingDelete(null);
      refresh();
      return;
    }
    setPendingDelete(slot);
  };

  const legacySlot0 =
    typeof localStorage !== 'undefined' && !!localStorage.getItem(LEGACY_FLAT_SAVE_KEY);

  return (
    <GnzModalFrame ornament maxWidthClass="max-w-3xl" backdropClassName="z-[140]">
      <div className={`space-y-4 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
        <div className="flex flex-wrap items-center gap-3 border-b border-cyan-900/30 pb-3">
          <GnzButton variant="ghost" type="button" onClick={onBack} className="!min-h-0 px-3 py-2">
            <GnozianGlyph name="door" size={18} className="text-amber-200/90" />
            {t('saveLoad.back')}
          </GnzButton>
          <h1 className="min-w-0 flex-1 text-center text-lg font-bold text-amber-100 sm:text-xl">
            {t('saveLoad.title')}
          </h1>
          <span className="w-20 shrink-0" />
        </div>

        <p className="text-center text-xs text-stone-400 sm:text-sm">{t('saveLoad.hint')}</p>

        <div className="max-h-[min(70vh,520px)] space-y-2 overflow-y-auto pr-1">
          {rows.map(({ slot, save }) => (
            <motion.div
              key={`${slot}-${tick}`}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2 rounded-xl border border-cyan-900/35 bg-slate-950/55 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/85">
                  {t('saveLoad.slotLabel', { n: slot + 1 })}
                </div>
                {save ? (
                  <div className="mt-1 space-y-0.5 text-sm text-stone-200">
                    <div className="font-semibold text-stone-50">
                      {displayCivilizationNameForSave(save)}
                      {save.metadata.playerDisplayName
                        ? ` · ${save.metadata.playerDisplayName}`
                        : ''}
                    </div>
                    <div className="text-xs text-stone-400">
                      {t('saveLoad.metaLine', {
                        turn: save.metadata.turnCount,
                        map: save.metadata.mapSize,
                        diff: save.metadata.difficulty,
                        time: formatPlayTime(save.metadata.playTime),
                        date: formatSaveDate(save.timestamp),
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-stone-500">{t('saveLoad.empty')}</div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <GnzButton
                  variant="primary"
                  type="button"
                  disabled={!save && !(slot === 0 && legacySlot0)}
                  onClick={() => handleLoad(slot)}
                >
                  {t('saveLoad.load')}
                </GnzButton>
                <GnzButton
                  variant={pendingDelete === slot ? 'danger' : 'secondary'}
                  type="button"
                  disabled={!save}
                  onClick={() => confirmDelete(slot)}
                >
                  {pendingDelete === slot ? t('saveLoad.confirmDelete') : t('saveLoad.delete')}
                </GnzButton>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </GnzModalFrame>
  );
}
