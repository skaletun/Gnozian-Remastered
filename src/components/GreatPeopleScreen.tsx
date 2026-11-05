import { GREAT_PEOPLE } from '../game/constants';
import type { GameState } from '../game/types';
import { t } from '../i18n';
import { GnozianGlyph, GnozianPanelCorners } from './ui';

interface Props {
  gameState: GameState;
  onClose: () => void;
}

function locGp(id: string, field: 'name' | 'ability' | 'flavor', fallback: string): string {
  const k = `greatPerson.${id}.${field}`;
  const v = t(k);
  return v === k ? fallback : v;
}

function locRole(type: string): string {
  const k = `greatPerson.role.${type}`;
  const v = t(k);
  return v === k ? type : v;
}

function locEra(era: string): string {
  const k = `era.${era}`;
  const v = t(k);
  return v === k ? era : v;
}

export default function GreatPeopleScreen({ gameState, onClose }: Props) {
  const claimed = new Set(gameState.systems.greatPersonClaimed);
  const list = Object.values(GREAT_PEOPLE).sort((a, b) => a.era.localeCompare(b.era));

  return (
    <div
      className="fixed inset-0 z-[60] gnz-modal-backdrop flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-amber-900/40 bg-gradient-to-b from-stone-950 via-[#0c1014] to-black p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <GnozianPanelCorners inset={5} size={34} />
        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-between border-b border-amber-900/30 pb-3">
            <div className="flex items-center gap-2">
              <GnozianGlyph name="masks" size={26} className="text-amber-300/90" />
              <h2 className="text-xl font-bold text-amber-100/95">{t('game.greatPeople')}</h2>
            </div>
            <button
              type="button"
              className="rounded-lg border border-amber-800/50 bg-amber-950/50 px-3 py-1.5 text-sm text-amber-100/90 hover:bg-amber-900/40"
              onClick={onClose}
            >
              {t('modal.close')}
            </button>
          </div>
          <p className="mb-4 text-sm text-stone-400/95">{t('greatPeople.help')}</p>
          <ul className="space-y-3">
            {list.map(gp => (
              <li
                key={gp.id}
                className={`rounded-xl border p-3 ${
                  claimed.has(gp.id)
                    ? 'border-stone-700/80 bg-stone-900/35 opacity-75'
                    : 'border-amber-900/45 bg-stone-900/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-100">{locGp(gp.id, 'name', gp.name)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">
                    {claimed.has(gp.id) ? t('greatPeople.recruited') : t('greatPeople.available')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-amber-200/75">
                  {locRole(gp.type)} · {locEra(gp.era)}
                </div>
                <p className="mt-2 text-sm text-stone-300/95">{locGp(gp.id, 'ability', gp.uniqueAbility)}</p>
                <p className="mt-1 text-xs text-stone-500">{locGp(gp.id, 'flavor', gp.bonusDescription)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
