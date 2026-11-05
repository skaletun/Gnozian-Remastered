import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { t } from '../../i18n';
import { GnozianGlyph } from '../ui';

// Keep preview animations subtle: too many always-on `repeat: Infinity` motions can cause FPS drops.
const loop = { duration: 3.6, repeat: Infinity, ease: 'easeInOut' as const };
const pulse = { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const };

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full min-h-[10rem] w-full items-center justify-center overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-b from-stone-950 via-slate-950 to-black">
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_25%_25%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_80%_60%,rgba(245,158,11,0.12),transparent_30%)]" />
      {children}
    </div>
  );
}

function Chip({ icon, label, tone = 'text-amber-200' }: { icon: string; label: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-stone-700/65 bg-stone-950/75 px-2.5 py-1.5 text-center shadow-lg">
      <GnozianGlyph name={icon as any} size={16} className={`mx-auto ${tone}`} />
      <div className="mt-1 max-w-[5.5rem] truncate text-[9px] font-semibold uppercase tracking-wide text-stone-400">
        {label}
      </div>
    </div>
  );
}

function MiniBar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded bg-stone-800">
      <motion.div
        className={`h-full ${tone}`}
        initial={{ width: '18%' }}
        animate={{ width: `${value}%` }}
        transition={loop}
      />
    </div>
  );
}

export function TutorialPreviewFirstTurn() {
  return (
    <Frame>
      <motion.div
        className="absolute inset-4 rounded-xl border border-sky-800/45 bg-sky-950/20"
        animate={{ x: [0, 5, -4, 0], y: [0, -4, 3, 0] }}
        transition={loop}
      />
      <div className="relative z-10 grid grid-cols-3 gap-2">
        <Chip icon="compass" label={t('game.minimap')} tone="text-sky-300" />
        <Chip icon="flask" label={t('game.research')} tone="text-sky-200" />
        <motion.div animate={{ y: [0, -3, 0], opacity: [0.75, 1, 0.75] }} transition={pulse}>
          <Chip icon="check" label={t('game.endTurn')} tone="text-emerald-300" />
        </motion.div>
      </div>
    </Frame>
  );
}

export function TutorialPreviewCityGrowthProduction() {
  return (
    <Frame>
      <div className="relative z-10 w-[min(100%,18rem)] space-y-2 rounded-xl border border-emerald-800/45 bg-stone-950/80 p-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
          <GnozianGlyph name="city" size={16} />
          {t('game.cities')}
        </div>
        <MiniBar value={64} tone="bg-emerald-500/85" />
        <MiniBar value={82} tone="bg-amber-500/85" />
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {['food', 'hammer', 'cog'].map((icon, i) => (
            <motion.div
              key={icon}
              className="rounded border border-stone-700/60 bg-black/35 py-1 text-center"
              animate={i === 1 ? { opacity: [0.55, 1, 0.55] } : undefined}
              transition={pulse}
            >
              <GnozianGlyph name={icon as any} size={14} className="mx-auto text-amber-200/90" />
            </motion.div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function TutorialPreviewExplorationWorkers() {
  return (
    <Frame>
      <svg viewBox="0 0 240 100" className="absolute h-[6.3rem] w-full max-w-[18rem]" aria-hidden>
        <motion.path
          d="M 42 70 C 82 20 132 82 194 28"
          fill="none"
          stroke="rgba(56,189,248,0.85)"
          strokeDasharray="5 5"
          strokeWidth="2"
          animate={{ pathLength: [0.15, 1, 0.15], opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </svg>
      <div className="relative z-10 flex items-center gap-3">
        <Chip icon="compass" label={t('hud.scoutAutoStart')} tone="text-sky-300" />
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={pulse}>
          <Chip icon="hammer" label={`${t('hud.workerBuilds')} 3/3`} tone="text-amber-300" />
        </motion.div>
      </div>
    </Frame>
  );
}

export function TutorialPreviewEconomyResources() {
  return (
    <Frame>
      <div className="relative z-10 flex gap-1.5">
        {[
          { g: 'food', v: '+9/t', c: 'text-emerald-300' },
          { g: 'cog', v: '+5/t', c: 'text-amber-300' },
          { g: 'trophy', v: '+7/t', c: 'text-yellow-300' },
          { g: 'flask', v: '+6/t', c: 'text-sky-300' },
          { g: 'sparkles', v: '+2/t', c: 'text-pink-300' },
        ].map((x, i) => (
          <motion.div
            key={x.g}
            className="rounded-md border border-stone-700/60 bg-stone-950/75 px-2 py-2 text-center"
            animate={i === 2 ? { y: [0, -3, 0], opacity: [0.7, 1, 0.7] } : undefined}
            transition={pulse}
          >
            <GnozianGlyph name={x.g as any} size={16} className={x.c} />
            <div className={`mt-1 text-[9px] font-bold tabular-nums ${x.c}`}>{x.v}</div>
          </motion.div>
        ))}
      </div>
    </Frame>
  );
}

export function TutorialPreviewResourceSlotsStrategics() {
  return (
    <Frame>
      <div className="relative z-10 w-[min(100%,18rem)] rounded-xl border border-cyan-800/45 bg-cyan-950/20 p-3">
        <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-cyan-200">
          {t('hud.slotsBLS')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'B', icon: 'food', value: '4/4', tone: 'text-emerald-300' },
            { label: 'L', icon: 'sparkles', value: '2/3', tone: 'text-pink-300' },
            { label: 'S', icon: 'pickaxe', value: '1/3', tone: 'text-sky-300' },
          ].map((x, i) => (
            <motion.div
              key={x.label}
              className="rounded-lg border border-stone-700/60 bg-black/35 p-2 text-center"
              animate={i === 2 ? { scale: [1, 1.05, 1] } : undefined}
              transition={pulse}
            >
              <GnozianGlyph name={x.icon as any} size={16} className={`mx-auto ${x.tone}`} />
              <div className="mt-1 text-[9px] font-bold text-stone-400">{x.label}</div>
              <div className={`text-[10px] font-bold tabular-nums ${x.tone}`}>{x.value}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function TutorialPreviewCombatCommanders() {
  return (
    <Frame>
      <svg viewBox="0 0 240 96" className="absolute h-[6rem] w-full max-w-[18rem]" aria-hidden>
        <motion.path
          d="M 48 64 Q 120 8 192 64"
          fill="none"
          stroke="rgba(251,191,36,0.85)"
          strokeWidth="2"
          animate={{ pathLength: [0, 1, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
        <circle cx="48" cy="64" r="11" fill="rgba(30,41,59,0.92)" stroke="rgba(251,191,36,0.55)" />
        <circle cx="192" cy="64" r="11" fill="rgba(127,29,29,0.4)" stroke="rgba(248,113,113,0.75)" />
      </svg>
      <div className="relative z-10 flex items-center gap-3">
        <Chip icon="swords" label={t('hud.attackCity')} tone="text-rose-300" />
        <motion.div animate={{ y: [0, -3, 0] }} transition={pulse}>
          <Chip icon="crown" label={t('hud.commander.section')} tone="text-amber-300" />
        </motion.div>
      </div>
    </Frame>
  );
}

export function TutorialPreviewResearchCivicsGovernment() {
  return (
    <Frame>
      <div className="relative z-10 grid grid-cols-3 gap-2">
        <Chip icon="flask" label={t('game.research')} tone="text-sky-300" />
        <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={pulse}>
          <Chip icon="book" label={t('empire.civicsSection')} tone="text-violet-300" />
        </motion.div>
        <Chip icon="crown" label={t('game.empire')} tone="text-amber-300" />
      </div>
    </Frame>
  );
}

export function TutorialPreviewAgesLegacyCrisis() {
  return (
    <Frame>
      <div className="relative z-10 flex items-center gap-2">
        {['I', 'II', 'III'].map((label, i) => (
          <motion.div
            key={label}
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-black ${
              i === 1
                ? 'border-amber-400/75 bg-amber-900/35 text-amber-100'
                : 'border-stone-700/75 bg-stone-950/80 text-stone-500'
            }`}
            animate={i === 1 ? { y: [0, -4, 0], opacity: [0.75, 1, 0.75] } : undefined}
            transition={pulse}
          >
            {label}
          </motion.div>
        ))}
      </div>
      <div className="absolute bottom-2 flex gap-2">
        <span className="rounded border border-emerald-700/45 bg-emerald-950/35 px-2 py-0.5 text-[9px] text-emerald-200">
          {t('tutorial.preview.golden')}
        </span>
        <span className="rounded border border-rose-700/45 bg-rose-950/35 px-2 py-0.5 text-[9px] text-rose-200">
          {t('tutorial.preview.crisis')}
        </span>
      </div>
    </Frame>
  );
}

export function TutorialPreviewDiplomacyTradeSettlements() {
  return (
    <Frame>
      <div className="relative z-10 flex items-center gap-3">
        <GnozianGlyph name="handshake" size={24} className="text-sky-300/90" />
        <motion.div
          className="h-[2px] w-16 bg-amber-400/75"
          animate={{ opacity: [0.3, 1, 0.3], scaleX: [0.75, 1, 0.75] }}
          transition={{ duration: 1.3, repeat: Infinity }}
        />
        <GnozianGlyph name="trophy" size={22} className="text-yellow-300/90" />
      </div>
      <div className="absolute bottom-2 rounded border border-cyan-700/45 bg-cyan-950/40 px-2 py-0.5 text-[9px] font-semibold text-cyan-100">
        {t('game.diplomacy')}
      </div>
    </Frame>
  );
}

export function TutorialPreviewGreatPeopleVictory() {
  return (
    <Frame>
      <div className="relative z-10 grid grid-cols-2 gap-2">
        {[
          ['star', t('game.greatPeople'), 'text-amber-300'],
          ['rocket', t('game.victories'), 'text-sky-300'],
          ['culture', t('victoryTracker.tourism'), 'text-violet-300'],
          ['religion', t('victoryTracker.religion'), 'text-teal-300'],
        ].map(([icon, label, tone], i) => (
          <motion.div key={icon} animate={i === 0 ? { y: [0, -3, 0] } : undefined} transition={pulse}>
            <Chip icon={icon} label={label} tone={tone} />
          </motion.div>
        ))}
      </div>
    </Frame>
  );
}

