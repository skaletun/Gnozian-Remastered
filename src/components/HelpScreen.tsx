import { useState } from 'react';
import { motion } from 'framer-motion';
import { t } from '../i18n';
import {
  GnozianPanelCorners,
  GnzAppModalLayout,
  GnzNavRailBtn,
  SvgDiplomacyGlyph,
  SvgEndTurnGlyph,
  SvgEscapeGlyph,
  SvgMousePanGlyph,
  SvgMouseScrollGlyph,
  SvgTechTreeGlyph,
} from './ui';
import { playUiClick } from '../audio/AudioManager';
import { modalBackdropMotion, modalCardMotion } from './ui/motionPresets';

interface Props {
  onClose: () => void;
}

type HelpTab = 'getting-started' | 'victories' | 'units' | 'buildings' | 'shortcuts';

const TABS: HelpTab[] = ['getting-started', 'victories', 'units', 'buildings', 'shortcuts'];

const TAB_KEY: Record<HelpTab, string> = {
  'getting-started': 'help.tab.gettingStarted',
  victories: 'help.tab.victories',
  units: 'help.tab.units',
  buildings: 'help.tab.buildings',
  shortcuts: 'help.tab.shortcuts',
};

export default function HelpScreen({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<HelpTab>('getting-started');

  return (
    <motion.div
      {...modalBackdropMotion}
      className="fixed inset-0 z-50 gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3"
      onClick={onClose}
    >
      <motion.div
        {...modalCardMotion}
        className="relative gnz-panel mx-4 flex max-h-[min(92vh,720px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-200/[0.14] shadow-2xl ring-1 ring-amber-400/[0.14]"
        onClick={e => e.stopPropagation()}
      >
        <GnozianPanelCorners inset={5} size={36} />
        <GnzAppModalLayout
          header={
            <div className="relative z-10 flex items-center justify-between border-b border-cyan-200/[0.12] bg-black/30 px-4 py-4 sm:px-6 sm:py-5">
              <h1 className="gnz-heading flex items-center gap-3 text-2xl font-black sm:text-3xl">{t('help.title')}</h1>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  onClose();
                }}
                className="text-2xl text-slate-500 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>
          }
          navRail={(
            <>
              {TABS.map(tab => (
                <GnzNavRailBtn
                  key={tab}
                  active={activeTab === tab}
                  onClick={() => {
                    playUiClick();
                    setActiveTab(tab);
                  }}
                >
                  {t(TAB_KEY[tab])}
                </GnzNavRailBtn>
              ))}
            </>
          )}
          mainClassName="space-y-6 p-4 sm:p-6"
          footer={
            <div className="relative z-10 border-t border-cyan-200/[0.12] bg-black/35 p-4">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  onClose();
                }}
                className="w-full rounded-lg bg-gradient-to-r from-amber-600 to-amber-800 px-6 py-2 font-bold text-white transition-all hover:from-amber-500 hover:to-amber-700"
              >
                {t('modal.close')}
              </button>
            </div>
          }
        >
          {activeTab === 'getting-started' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-amber-400 mb-2">{t('help.gettingStarted.welcomeTitle')}</h3>
                <p className="text-gray-300 text-sm">{t('help.gettingStarted.intro')}</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.gettingStarted.step1Title')}</h4>
                  <p className="text-gray-400 text-sm">{t('help.gettingStarted.step1Body')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.gettingStarted.step2Title')}</h4>
                  <p className="text-gray-400 text-sm">{t('help.gettingStarted.step2Body')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.gettingStarted.step3Title')}</h4>
                  <p className="text-gray-400 text-sm">{t('help.gettingStarted.step3Body')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.gettingStarted.step4Title')}</h4>
                  <p className="text-gray-400 text-sm">{t('help.gettingStarted.step4Body')}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'victories' && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/20 rounded-lg p-4 border border-cyan-600/50">
                <h4 className="font-bold text-cyan-300 mb-2">{t('help.victory.scienceTitle')}</h4>
                <p className="text-gray-300 text-sm">{t('help.victory.scienceBody')}</p>
              </div>
              <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/20 rounded-lg p-4 border border-purple-600/50">
                <h4 className="font-bold text-purple-300 mb-2">{t('help.victory.cultureTitle')}</h4>
                <p className="text-gray-300 text-sm">{t('help.victory.cultureBody')}</p>
              </div>
              <div className="bg-gradient-to-r from-red-900/30 to-orange-900/20 rounded-lg p-4 border border-red-600/50">
                <h4 className="font-bold text-red-300 mb-2">{t('help.victory.dominationTitle')}</h4>
                <p className="text-gray-300 text-sm">{t('help.victory.dominationBody')}</p>
              </div>
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/20 rounded-lg p-4 border border-green-600/50">
                <h4 className="font-bold text-green-300 mb-2">{t('help.victory.diplomacyTitle')}</h4>
                <p className="text-gray-300 text-sm">{t('help.victory.diplomacyBody')}</p>
              </div>
              <div className="bg-gradient-to-r from-teal-900/30 to-cyan-900/20 rounded-lg p-4 border border-teal-600/50">
                <h4 className="font-bold text-teal-300 mb-2">{t('help.victory.religionTitle')}</h4>
                <p className="text-gray-300 text-sm">{t('help.victory.religionBody')}</p>
              </div>
              <div className="bg-gradient-to-r from-yellow-900/30 to-amber-900/20 rounded-lg p-4 border border-yellow-600/50">
                <h4 className="font-bold text-yellow-300 mb-2">{t('help.victory.timeTitle')}</h4>
                <p className="text-gray-300 text-sm">{t('help.victory.timeBody')}</p>
              </div>
            </div>
          )}

          {activeTab === 'units' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-amber-400 mb-3">{t('help.units.sectionTitle')}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.units.settlerTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.units.settlerBody')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.units.warriorTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.units.warriorBody')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.units.archerTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.units.archerBody')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.units.horsemanTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.units.horsemanBody')}</p>
                </div>
              </div>

              <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-600/50">
                <h4 className="font-bold text-blue-300 mb-2">{t('help.units.combatTitle')}</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>{t('help.units.combatLi1')}</li>
                  <li>{t('help.units.combatLi2')}</li>
                  <li>{t('help.units.combatLi3')}</li>
                  <li>{t('help.units.combatLi4')}</li>
                  <li>{t('help.units.combatLi5')}</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'buildings' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-amber-400 mb-3">{t('help.buildings.sectionTitle')}</h3>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.buildings.palaceTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.buildings.palaceBody')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.buildings.granaryTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.buildings.granaryBody')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.buildings.libraryTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.buildings.libraryBody')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.buildings.workshopTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.buildings.workshopBody')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <h4 className="font-bold text-white mb-1">{t('help.buildings.wallsTitle')}</h4>
                  <p className="text-gray-400 text-xs">{t('help.buildings.wallsBody')}</p>
                </div>
              </div>

              <div className="bg-green-900/30 rounded-lg p-4 border border-green-600/50">
                <h4 className="font-bold text-green-300 mb-2">{t('help.buildings.tipsTitle')}</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>{t('help.buildings.tipsLi1')}</li>
                  <li>{t('help.buildings.tipsLi2')}</li>
                  <li>{t('help.buildings.tipsLi3')}</li>
                  <li>{t('help.buildings.tipsLi4')}</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-amber-400/90">
                    <SvgEndTurnGlyph className="h-7 w-7" />
                    <kbd className="rounded bg-stone-700 px-2 py-1 text-xs font-bold">Space</kbd>
                    <kbd className="rounded bg-stone-700 px-2 py-1 text-xs font-bold">↵ Enter</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">{t('help.shortcuts.spaceEnter')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sky-400/90">
                    <SvgTechTreeGlyph className="h-7 w-7" />
                    <kbd className="rounded bg-stone-700 px-2 py-1 text-xs font-bold">T</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">{t('help.shortcuts.tech')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-violet-400/90">
                    <SvgDiplomacyGlyph className="h-7 w-7" />
                    <kbd className="rounded bg-stone-700 px-2 py-1 text-xs font-bold">D</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">{t('help.shortcuts.diplomacy')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-stone-300">
                    <SvgEscapeGlyph className="h-7 w-7" />
                    <kbd className="rounded bg-stone-700 px-2 py-1 text-xs font-bold">Esc</kbd>
                  </div>
                  <p className="text-gray-400 text-xs">{t('help.shortcuts.esc')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-emerald-400/85">
                    <SvgMouseScrollGlyph className="h-7 w-7" />
                    <span className="text-sm text-stone-400">{t('help.shortcuts.mouseScroll')}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{t('help.shortcuts.zoom')}</p>
                </div>
                <div className="rounded-lg border border-stone-700/30 bg-black/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-cyan-400/85">
                    <SvgMousePanGlyph className="h-7 w-7" />
                    <span className="text-sm text-stone-400">{t('help.shortcuts.mouseMiddleDrag')}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{t('help.shortcuts.pan')}</p>
                </div>
              </div>
            </div>
          )}
        </GnzAppModalLayout>
      </motion.div>
    </motion.div>
  );
}
