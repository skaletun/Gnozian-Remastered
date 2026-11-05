import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { GameMessage } from '../game/types';
import { playGameMessageSfx } from '../audio/AudioManager';
import { GnozianGlyph, MESSAGE_GLYPH } from './ui';
import { localizeGameMessage } from '../game/messageLocalization';

interface Props {
  messages: GameMessage[];
  onRemove?: (messageId: number) => void;
}

interface DisplayMessage extends GameMessage {
  displayId: string;
}

const MESSAGE_DURATION = 4500;
const DISASTER_DURATION = 5000;
const MAX_VISIBLE = 4;
const getMessageDuration = (type: GameMessage['type']) => (type === 'disaster' ? DISASTER_DURATION : MESSAGE_DURATION);

export default function NotificationSystem({ messages, onRemove }: Props) {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const processedIds = useRef<Set<number>>(new Set());
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const newMessages = messages.filter(msg => !processedIds.current.has(msg.id));
    if (newMessages.length === 0) return;

    const toAdd = newMessages.map((msg, idx) => ({
      ...msg,
      displayId: `${msg.id}-${Date.now()}-${idx}`,
    }));

    toAdd.forEach(msg => processedIds.current.add(msg.id));

    setDisplayMessages(prev => {
      const next = [...prev, ...toAdd];
      return next.slice(-MAX_VISIBLE);
    });

    toAdd.forEach(msg => {
      playGameMessageSfx(msg.type);
      setTimeout(() => {
        setDisplayMessages(prev => prev.filter(m => m.displayId !== msg.displayId));
        onRemove?.(msg.id);
      }, getMessageDuration(msg.type));
    });
  }, [messages, onRemove]);

  const getColorClasses = (type: GameMessage['type']) => {
    switch (type) {
      case 'tech':
        return 'from-blue-700/95 to-cyan-800/95 text-white';
      case 'combat':
        return 'from-red-800/95 to-orange-900/95 text-white';
      case 'city':
        return 'from-purple-800/95 to-pink-900/95 text-white';
      case 'diplomacy':
        return 'from-green-800/95 to-emerald-900/95 text-white';
      case 'warning':
        return 'from-yellow-800/95 to-amber-900/95 text-stone-950';
      case 'info':
        return 'from-slate-800/95 to-slate-900/95 text-stone-100';
      case 'religion':
        return 'from-teal-800/95 to-cyan-900/95 text-white';
      case 'disaster':
        return 'from-orange-950/95 to-red-950/95 text-white';
      case 'wonder':
        return 'from-amber-800/95 to-yellow-900/95 text-stone-950';
      case 'tourism':
        return 'from-purple-900/95 to-fuchsia-950/95 text-white';
      case 'espionage':
        return 'from-slate-900/95 to-zinc-950/95 text-stone-100';
      default:
        return 'from-gray-800/95 to-gray-900/95 text-white';
    }
  };

  const transition = reduceMotion
    ? { duration: 0.2 }
    : { type: 'spring' as const, damping: 22, stiffness: 320 };

  // For disaster cinematic pulse: repeat only for the visible duration
  const DISASTER_ANIM_DURATION = 1.1; // seconds per cycle
  const disasterRepeat = Math.max(0, Math.floor(DISASTER_DURATION / (DISASTER_ANIM_DURATION * 1000)) - 1);
  const disasterTransition = reduceMotion
    ? { duration: 0.2 }
    : ({ duration: DISASTER_ANIM_DURATION, repeat: disasterRepeat, ease: 'easeInOut' } as any);

  return (
    <>
      <div className="pointer-events-none fixed right-2 top-20 z-[100] flex max-w-[min(92vw,18rem)] flex-col gap-1.5 sm:right-3 sm:top-24">
        <AnimatePresence initial={false}>
          {displayMessages
            .filter(msg => msg.type !== 'disaster')
            .map((msg, i) => (
              <motion.div
                key={`${msg.displayId}-${msg.id}-${i}`}
                initial={{ opacity: 0, x: reduceMotion ? 0 : 24, y: reduceMotion ? 4 : 0 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: reduceMotion ? 0 : 12 }}
                transition={transition}
                className={`pointer-events-auto flex max-w-full items-start gap-2 rounded-md border border-white/10 bg-gradient-to-r px-2.5 py-1.5 shadow-lg ${getColorClasses(msg.type)}`}
              >
                <span className="shrink-0 leading-none opacity-95 text-white">
                  <GnozianGlyph name={MESSAGE_GLYPH[msg.type]} size={18} className="text-white/95" />
                </span>
                <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug">{localizeGameMessage(msg.text)}</p>
                {!reduceMotion && (
                  <motion.div
                    className="mt-0.5 h-0.5 shrink-0 self-end rounded-full bg-white/35"
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: MESSAGE_DURATION / 1000, ease: 'linear' }}
                    style={{ width: 36, transformOrigin: 'right center' }}
                  />
                )}
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
      <div className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center px-4">
        <AnimatePresence initial={false}>
          {displayMessages
            .filter(msg => msg.type === 'disaster')
            .slice(-1)
            .map(msg => (
              <motion.div
                key={msg.displayId}
                initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.9 }}
                animate={
                  reduceMotion
                    ? { opacity: 1, scale: 1 }
                    : { opacity: [0.8, 1, 0.86, 1], scale: [0.98, 1.03, 1, 1.02] }
                }
                exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.9 }}
                transition={disasterTransition}
                className={`max-w-[min(92vw,34rem)] rounded-xl border border-red-300/30 bg-gradient-to-r px-4 py-3 text-center shadow-2xl sm:px-6 sm:py-4 ${getColorClasses(msg.type)}`}
              >
                <div className="mb-1 flex items-center justify-center gap-2 text-red-100">
                  <GnozianGlyph name={MESSAGE_GLYPH[msg.type]} size={22} className="text-red-100" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-100/90">Natural Disaster</span>
                </div>
                <p className="text-sm font-semibold leading-tight text-white sm:text-base">{localizeGameMessage(msg.text)}</p>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </>
  );
}
