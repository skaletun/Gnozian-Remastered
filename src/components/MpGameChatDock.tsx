import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GnozianGlyph } from './ui';
import { t } from '../i18n';
import { GnozianMpApiError, mpGetChatMessages, mpPostChatMessage, type MpChatMessage } from '../mp/gnozianMpApi';

export type MpGameChatDockProps = {
  mp: {
    baseUrl: string;
    matchId: string;
    playerToken: string;
    civSlot: number;
  };
};

export default function MpGameChatDock({ mp }: MpGameChatDockProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MpChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const maxIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const mergeIncoming = useCallback((incoming: MpChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages(prev => {
      const map = new Map<number, MpChatMessage>();
      for (const m of prev) map.set(m.id, m);
      for (const m of incoming) map.set(m.id, m);
      const next = Array.from(map.values()).sort((a, b) => a.id - b.id);
      return next.length > 400 ? next.slice(-400) : next;
    });
    const maxIncoming = Math.max(...incoming.map(m => m.id));
    if (maxIncoming > maxIdRef.current) {
      maxIdRef.current = maxIncoming;
    }
    const mine = mp.civSlot;
    const others = incoming.filter(m => m.civ_slot !== mine);
    if (others.length > 0 && !openRef.current) {
      setUnread(u => u + others.length);
    }
  }, [mp.civSlot]);

  const poll = useCallback(async () => {
    try {
      const r = await mpGetChatMessages(mp.baseUrl, mp.matchId, mp.playerToken, maxIdRef.current);
      mergeIncoming(r.messages);
    } catch {
      /* offline / CORS */
    }
  }, [mp.baseUrl, mp.matchId, mp.playerToken, mergeIncoming]);

  useEffect(() => {
    maxIdRef.current = 0;
    setMessages([]);
    setUnread(0);
    setDraft('');
    void poll();
  }, [mp.matchId, mp.playerToken, poll]);

  useEffect(() => {
    const id = window.setInterval(() => void poll(), 3500);
    return () => window.clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  const toggle = useCallback(() => {
    setOpen(o => {
      const next = !o;
      if (next) setUnread(0);
      return next;
    });
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (text === '' || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await mpPostChatMessage(mp.baseUrl, mp.matchId, mp.playerToken, text);
      setDraft('');
      await poll();
    } catch (e) {
      setSendError(e instanceof GnozianMpApiError ? e.message : t('mp.chat.sendFailed'));
    } finally {
      setSending(false);
    }
  }, [draft, mp.baseUrl, mp.matchId, mp.playerToken, poll, sending]);

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  return (
    <div
      data-mp-chat="1"
      className="pointer-events-none fixed right-0 top-[max(5rem,18vh)] z-[55] flex max-h-[min(72vh,32rem)] flex-row-reverse items-stretch pr-[max(0px,env(safe-area-inset-right,0px))]"
      aria-label={t('mp.chat.title')}
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="pointer-events-auto flex w-[min(19rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-l-xl rounded-br-none rounded-tr-none border border-amber-900/45 bg-gradient-to-b from-stone-950/98 to-black/95 shadow-2xl backdrop-blur-md"
            onKeyDown={e => {
              if (e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-amber-900/30 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                {t('mp.chat.title')}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-[11px] text-stone-400 hover:bg-stone-800/80 hover:text-stone-200"
              >
                {t('mp.chat.collapse')}
              </button>
            </div>
            <div
              ref={listRef}
              className="gnz-mp-chat-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2 text-sm"
            >
              {messages.length === 0 && (
                <p className="px-1 py-4 text-center text-[11px] text-stone-500">{t('mp.chat.empty')}</p>
              )}
              {messages.map(m => {
                const mine = m.civ_slot === mp.civSlot;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col gap-0.5 rounded-lg px-2 py-1.5 ${mine ? 'ml-4 bg-amber-950/50' : 'mr-4 bg-stone-900/80'}`}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-[10px] text-stone-500">
                      <span className={mine ? 'font-medium text-amber-200/90' : 'text-sky-200/85'}>
                        {m.display_name}
                        <span className="text-stone-600"> · {t('mp.slot')} {m.civ_slot}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{timeFmt.format(m.created_at * 1000)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-stone-100">{m.body}</p>
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 border-t border-amber-900/25 p-2">
              {sendError && <p className="mb-1.5 text-[11px] text-red-400">{sendError}</p>}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={e => {
                    setDraft(e.target.value);
                    if (sendError) setSendError(null);
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.code === 'Escape') {
                      e.preventDefault();
                      setOpen(false);
                      return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  maxLength={280}
                  placeholder={t('mp.chat.placeholder')}
                  className="gnz-mp-control min-w-0 flex-1 rounded-lg border border-stone-600/90 px-2 py-1.5 text-xs shadow-inner placeholder:text-stone-500 focus:border-amber-600/70 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
                <button
                  type="button"
                  disabled={sending || draft.trim() === ''}
                  onClick={() => void send()}
                  className="shrink-0 rounded-lg border border-amber-700/60 bg-amber-900/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-800/50 disabled:opacity-40"
                >
                  {sending ? '…' : t('mp.chat.send')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        layout
        onKeyDown={e => e.stopPropagation()}
        onClick={toggle}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="pointer-events-auto flex h-14 w-11 flex-col items-center justify-center gap-0.5 rounded-l-xl border border-amber-900/50 bg-gradient-to-b from-stone-900/95 to-black/90 text-amber-200/95 shadow-lg backdrop-blur-md hover:border-amber-600/60 hover:text-amber-50"
        title={open ? t('mp.chat.collapse') : t('mp.chat.expand')}
        aria-expanded={open}
      >
        <GnozianGlyph name="chat" size={22} className="text-current" />
        {!open && unread > 0 && (
          <span className="min-w-[1.15rem] rounded-full bg-amber-600 px-1 text-center text-[10px] font-bold leading-tight text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </motion.button>
    </div>
  );
}
