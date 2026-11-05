import { useState } from 'react';
import { motion } from 'framer-motion';
import { GnzButton, GnzModalFrame, GnzPanel, GnozianGlyph } from './ui';
import { t } from '../i18n';
import { loadPlayerProfile, savePlayerProfile } from '../game/playerProfile';
import { useLayoutProfile } from '../hooks/useLayoutProfile';

type Props = {
  onComplete: (displayName: string) => void;
};

export default function PlayerSetupScreen({ onComplete }: Props) {
  const layout = useLayoutProfile();
  const compact = layout === 'mobile';
  const [name, setName] = useState(() => loadPlayerProfile()?.displayName?.slice(0, 32) ?? '');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim().slice(0, 32);
    if (trimmed.length < 2) {
      setErr(t('playerSetup.errorTooShort'));
      return;
    }
    setErr(null);
    savePlayerProfile(trimmed);
    onComplete(trimmed);
  };

  return (
    <GnzModalFrame ornament maxWidthClass="max-w-md" backdropClassName="z-[140]">
      <GnzPanel ornament className="border border-cyan-200/[0.14] p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex justify-center">
            <GnozianGlyph name="crown" size={compact ? 36 : 44} className="text-amber-300/90" />
          </div>
          <div className="text-center">
            <h1 className="font-[family-name:var(--font-gnz-display)] text-xl font-bold text-amber-100 sm:text-2xl">
              {t('playerSetup.title')}
            </h1>
            <p className="mt-2 text-sm text-stone-300 sm:text-[15px]">{t('playerSetup.subtitle')}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80">
              {t('playerSetup.label')}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value.slice(0, 32));
                setErr(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') submit();
              }}
              className="w-full rounded-xl border border-cyan-800/50 bg-slate-950/80 px-3 py-2.5 text-stone-100 outline-none ring-amber-400/20 focus:border-amber-500/40 focus:ring-2"
              placeholder={t('playerSetup.placeholder')}
              maxLength={32}
              autoFocus
            />
            {err ? <p className="mt-2 text-xs text-red-300/95">{err}</p> : null}
          </div>
          <GnzButton variant="primary" type="button" className="w-full" onClick={submit}>
            {t('playerSetup.continue')}
          </GnzButton>
        </motion.div>
      </GnzPanel>
    </GnzModalFrame>
  );
}
