import { useState } from 'react';
import { motion } from 'framer-motion';
import { t } from '../i18n';
import { GnzButton, GnzPanel, GnozianGlyph } from './ui';
import { modalBackdropMotion, modalCardMotion } from './ui/motionPresets';
import { useLayoutProfile } from '../hooks/useLayoutProfile';

interface Props {
  onResume: () => void;
  onSave: () => void;
  onOpenSettings: () => void;
  onOpenAchievements: () => void;
  onOpenHelp: () => void;
  onOpenTutorial: () => void;
  onMainMenu: () => void;
}

export default function PauseMenu({
  onResume,
  onSave,
  onOpenSettings,
  onOpenAchievements,
  onOpenHelp,
  onOpenTutorial,
  onMainMenu,
}: Props) {
  const layout = useLayoutProfile();
  const mobile = layout === 'mobile';
  const [showMainMenuConfirm, setShowMainMenuConfirm] = useState(false);
  const tryMainMenu = () => {
    setShowMainMenuConfirm(true);
  };

  return (
    <motion.div
      {...modalBackdropMotion}
      className={`fixed inset-0 z-[260] gnz-modal-backdrop flex items-center justify-center overflow-y-auto ${
        mobile ? 'p-2' : 'p-3'
      }`}
      onClick={onResume}
    >
      <motion.div
        {...modalCardMotion}
        className={`mx-auto w-full ${mobile ? 'max-h-[90vh] max-w-[min(98vw,26rem)] overflow-y-auto' : 'max-w-[min(96vw,40rem)]'}`}
        onClick={e => e.stopPropagation()}
      >
        <GnzPanel ornament className={mobile ? 'p-4' : 'p-6'}>
          <h2 className={`gnz-heading text-center font-black ${mobile ? 'text-xl' : 'text-2xl'}`}>{t('pause.title')}</h2>
          <p className="gnz-subtle text-center text-xs">{t('pause.hint')}</p>
          <div className={`grid gap-4 ${mobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="flex flex-col gap-3">
              <GnzButton audioOnClick variant="secondary" className={`flex w-full items-center justify-start gap-2 text-left ${mobile ? 'py-3.5' : 'py-3'}`} onClick={onResume}>
                <GnozianGlyph name="play" size={16} className="text-emerald-200/90" />
                {t('pause.resume')}
              </GnzButton>
              <GnzButton audioOnClick variant="secondary" className={`flex w-full items-center justify-start gap-2 text-left ${mobile ? 'py-3.5' : 'py-3'}`} onClick={onSave}>
                <GnozianGlyph name="save" size={16} className="text-sky-200/90" />
                {t('pause.save')}
              </GnzButton>
              <GnzButton audioOnClick variant="danger" className={`flex w-full items-center justify-start gap-2 text-left ${mobile ? 'py-3.5' : 'py-3'}`} onClick={tryMainMenu}>
                <GnozianGlyph name="door" size={16} className="text-red-200/90" />
                {t('pause.mainMenu')}
              </GnzButton>
            </div>
            <div className="flex flex-col gap-3">
              <GnzButton audioOnClick variant="ghost" className={`flex w-full items-center justify-start gap-2 text-left ${mobile ? 'py-3.5' : 'py-3'}`} onClick={onOpenSettings}>
                <GnozianGlyph name="gear" size={16} className="text-stone-300" />
                {t('pause.settings')}
              </GnzButton>
              <GnzButton audioOnClick variant="ghost" className={`flex w-full items-center justify-start gap-2 text-left ${mobile ? 'py-3.5' : 'py-3'}`} onClick={onOpenAchievements}>
                <GnozianGlyph name="trophy" size={16} className="text-amber-300/90" />
                {t('pause.achievements')}
              </GnzButton>
              <GnzButton audioOnClick variant="ghost" className={`flex w-full items-center justify-start gap-2 text-left ${mobile ? 'py-3.5' : 'py-3'}`} onClick={onOpenHelp}>
                <GnozianGlyph name="book" size={16} className="text-stone-300" />
                {t('pause.help')}
              </GnzButton>
              <GnzButton audioOnClick variant="ghost" className={`flex w-full items-center justify-start gap-2 text-left ${mobile ? 'py-3.5' : 'py-3'}`} onClick={onOpenTutorial}>
                <GnozianGlyph name="sparkles" size={16} className="text-amber-300/90" />
                {t('pause.tutorial')}
              </GnzButton>
            </div>
          </div>
          {showMainMenuConfirm && (
            <div className="fixed inset-0 z-[270] gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3" onClick={() => setShowMainMenuConfirm(false)}>
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                className={`gnz-panel relative w-full rounded-xl shadow-2xl ${
                  mobile ? 'max-w-[min(96vw,22rem)] p-4' : 'max-w-[min(92vw,24rem)] p-5'
                }`}
                onClick={e => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center gap-2 text-amber-200">
                  <GnozianGlyph name="warn" size={16} className="text-amber-300" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">{t('pause.mainMenu')}</h3>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-stone-200">{t('pause.mainMenuConfirm')}</p>
                <div className="flex justify-end gap-2">
                  <GnzButton
                    audioOnClick
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setShowMainMenuConfirm(false)}
                  >
                    {t('common.cancel')}
                  </GnzButton>
                  <GnzButton
                    audioOnClick
                    variant="danger"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => {
                      setShowMainMenuConfirm(false);
                      onMainMenu();
                    }}
                  >
                    {t('common.ok')}
                  </GnzButton>
                </div>
              </motion.div>
            </div>
          )}
        </GnzPanel>
      </motion.div>
    </motion.div>
  );
}
