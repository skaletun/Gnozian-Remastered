import { useEffect } from 'react';
import type { GnozianGlyphName } from './ui';
import { GnozianGlyph } from './ui';
import { getLanguage, t } from '../i18n';
import { GnzResourceIcon } from './ui/GnzResourceIcon';

export type MobileHudPane = 'menu' | 'cities' | 'resources' | null;

export type CompactYield = {
  id: string;
  label: string;
  icon: GnozianGlyphName;
  stock: number;
  perTurn: number;
  color: string;
};
export type CompactStrategicResource = {
  id: string;
  label: string;
  icon: GnozianGlyphName;
  amount: number;
};
export type CompactCity = {
  id: number;
  name: string;
  population: number;
  isCapital: boolean;
};

interface Props {
  turn: number;
  calendar: string;
  civName: string;
  pane: MobileHudPane;
  onTogglePane: (name: Exclude<MobileHudPane, null>) => void;
  onClosePane: () => void;
  onOpenTechTree: () => void;
  onOpenDiplomacy: () => void;
  onOpenEmpire: () => void;
  onOpenCity: (id: number) => void;
  onOpenPause: () => void;
  onOpenSettings: () => void;
  onOpenAchievements: () => void;
  onOpenVictoryTracker: () => void;
  onOpenGreatPeople: () => void;
  onOpenStats: () => void;
  onOpenHelp: () => void;
  onToggleMap: () => void;
  mapOpen: boolean;
  cities: ReadonlyArray<CompactCity>;
  yields: ReadonlyArray<CompactYield>;
  strategic: ReadonlyArray<CompactStrategicResource>;
}

/** The map stays the main screen: only the four main actions and turn counter
 * are permanently shown. Cities, secondary systems and resources are popovers
 * dismissed by tapping the map. Game callbacks are the existing real actions. */
export function MobileHudChrome({
  turn, calendar, civName, pane, onTogglePane, onClosePane,
  onOpenTechTree, onOpenDiplomacy, onOpenEmpire, onOpenCity,
  onOpenPause, onOpenSettings, onOpenAchievements, onOpenVictoryTracker,
  onOpenGreatPeople, onOpenStats, onOpenHelp, onToggleMap, mapOpen,
  cities, yields, strategic,
}: Props) {
  const ru = getLanguage() === 'ru';
  useEffect(() => {
    if (pane === null) return;
    const dismissOnOutsideTap = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest('[data-rhm-interactive]')) return;
      onClosePane();
    };
    const dismissOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClosePane();
      }
    };
    document.addEventListener('pointerdown', dismissOnOutsideTap, true);
    document.addEventListener('keydown', dismissOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsideTap, true);
      document.removeEventListener('keydown', dismissOnEscape, true);
    };
  }, [pane, onClosePane]);

  const open = (action: () => void) => {
    onClosePane();
    action();
  };

  return (
    <>
      <nav className="rhm-toolbar pointer-events-auto" data-rhm-interactive
        aria-label={ru ? 'Управление игрой' : 'Game navigation'}>
        <button type="button" className={pane === 'cities' ? 'rhm-tile rhm-selected' : 'rhm-tile'}
          onClick={() => onTogglePane('cities')} aria-expanded={pane === 'cities'}
          aria-label={ru ? 'Города и империя' : 'Cities and empire'} title={t('game.empire')}>
          <GnozianGlyph name="empire" size={21} />
        </button>
        <button type="button" className="rhm-tile" onClick={() => open(onOpenTechTree)}
          aria-label={t('tech.title')} title={t('tech.title')}>
          <GnozianGlyph name="flask" size={21} />
        </button>
        <div className="rhm-turn" aria-label={t('game.turn') + ' ' + turn + ', ' + calendar}
          title={calendar}>
          <strong>{turn}</strong>
          <span>{t('game.turn')}</span>
        </div>
        <button type="button" className="rhm-tile" onClick={() => open(onOpenDiplomacy)}
          aria-label={t('game.diplomacy')} title={t('game.diplomacy')}>
          <GnozianGlyph name="globe" size={21} />
        </button>
        <button type="button" className={pane === 'menu' ? 'rhm-tile rhm-selected' : 'rhm-tile'}
          onClick={() => onTogglePane('menu')} aria-expanded={pane === 'menu'}
          aria-label={ru ? 'Открыть меню' : 'Open menu'} title={t('game.controls.title')}>
          <GnozianGlyph name="grid" size={21} />
        </button>
      </nav>

      {pane === 'menu' && (
        <aside className="rhm-drawer pointer-events-auto" data-rhm-interactive
          aria-label={ru ? 'Дополнительные действия' : 'More actions'}>
          <button type="button" onClick={() => open(onOpenPause)}>
            <GnozianGlyph name="home" size={18} />{t('game.pause')}
          </button>
          <button type="button" onClick={() => open(onOpenSettings)}>
            <GnozianGlyph name="gear" size={18} />{t('settings.title')}
          </button>
          <button type="button" onClick={() => open(onOpenEmpire)}>
            <GnozianGlyph name="empire" size={18} />{t('game.empire')}
          </button>
          <button type="button" onClick={() => open(onOpenGreatPeople)}>
            <GnozianGlyph name="star" size={18} />{t('game.greatPeople')}
          </button>
          <button type="button" onClick={() => open(onOpenVictoryTracker)}>
            <GnozianGlyph name="target" size={18} />{t('game.victoryTracker')}
          </button>
          <button type="button" onClick={() => open(onOpenAchievements)}>
            <GnozianGlyph name="trophy" size={18} />{t('menu.achievements')}
          </button>
          <button type="button" onClick={() => open(onOpenStats)}>
            <GnozianGlyph name="chart" size={18} />{t('game.statistics')}
          </button>
          <button type="button" onClick={() => open(onOpenHelp)}>
            <GnozianGlyph name="book" size={18} />{ru ? 'Справка' : 'Help'}
          </button>
          <button type="button" onClick={() => { onClosePane(); onToggleMap(); }}>
            <GnozianGlyph name="map" size={18} />
            {mapOpen ? (ru ? 'Скрыть мини-карту' : 'Hide minimap') :
              (ru ? 'Мини-карта' : 'Minimap')}
          </button>
        </aside>
      )}

      {pane === 'cities' && (
        <aside className="rhm-city-menu pointer-events-auto" data-rhm-interactive
          aria-label={ru ? 'Мои города' : 'My cities'}>
          <div className="rhm-popover-heading">
            <div className="min-w-0">
              <strong>{ru ? 'ГОРОДА' : 'CITIES'}</strong>
              <span title={civName}>{civName}</span>
            </div>
            <button type="button" onClick={() => open(onOpenEmpire)}>
              {ru ? 'Империя' : 'Empire'}
            </button>
          </div>
          <div className="rhm-city-items">
            {cities.length === 0 && (
              <p className="rhm-empty">{ru ? 'Нет основанных городов' : 'No cities founded'}</p>
            )}
            {cities.map(city => (
              <button type="button" key={city.id} className="rhm-city-item"
                onClick={() => { onClosePane(); onOpenCity(city.id); }}>
                <GnozianGlyph name={city.isCapital ? 'crown' : 'city'} size={20} />
                <span className="rhm-city-name" title={city.name}>{city.name}</span>
                <span className="rhm-city-pop" title={t('hud.population')}>
                  <GnozianGlyph name="user" size={13} />{city.population}
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}

      {pane === 'resources' && (
        <aside className="rhm-resource-menu pointer-events-auto" data-rhm-interactive
          aria-label={ru ? 'Ресурсы и доходы' : 'Resources and income'}>
          <div className="rhm-popover-heading">
            <strong>{ru ? 'РЕСУРСЫ' : 'RESOURCES'}</strong>
            <button type="button" onClick={onClosePane} aria-label={ru ? 'Закрыть' : 'Close'}>
              <GnozianGlyph name="check" size={17} />
            </button>
          </div>
          <div className="rhm-resource-grid">
            {yields.map(yieldItem => (
              <div className="rhm-resource-cell" key={yieldItem.id}
                title={yieldItem.label}>
                <GnzResourceIcon resource={yieldItem.id} size={21} />
                <span className="rhm-resource-name">{yieldItem.label}</span>
                <strong style={{ color: yieldItem.color }}>{yieldItem.stock}</strong>
                <small style={{ color: yieldItem.perTurn < 0 ? '#ff8888' : yieldItem.color }}>
                  {yieldItem.perTurn > 0 ? '+' : ''}{yieldItem.perTurn}/t
                </small>
              </div>
            ))}
          </div>
          <div className="rhm-resource-strategic">
            {strategic.map(item => (
              <div key={item.id} className="rhm-strategic-item" title={item.label}>
                <GnozianGlyph name={item.icon} size={15} />
                <span>{item.label}</span>
                <strong>{item.amount}</strong>
              </div>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
