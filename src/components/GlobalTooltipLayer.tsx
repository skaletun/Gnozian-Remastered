import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const TOOLTIP_ATTR = 'data-gnz-tooltip';

function migrateTitleAttr(root: ParentNode): void {
  const els = root.querySelectorAll?.('[title]');
  if (!els) return;
  for (const node of els) {
    if (!(node instanceof HTMLElement)) continue;
    const title = node.getAttribute('title');
    if (!title) continue;
    node.setAttribute(TOOLTIP_ATTR, title);
    node.removeAttribute('title');
  }
}

export default function GlobalTooltipLayer() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tooltipRef = useRef<typeof tooltip>(null);
  tooltipRef.current = tooltip;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    migrateTitleAttr(document);

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.target instanceof HTMLElement && m.attributeName === 'title') {
          const title = m.target.getAttribute('title');
          if (!title) continue;
          m.target.setAttribute(TOOLTIP_ATTR, title);
          m.target.removeAttribute('title');
          continue;
        }
        for (const n of m.addedNodes) {
          if (n instanceof HTMLElement) {
            if (n.hasAttribute('title')) {
              const title = n.getAttribute('title');
              if (title) {
                n.setAttribute(TOOLTIP_ATTR, title);
                n.removeAttribute('title');
              }
            }
            migrateTitleAttr(n);
          }
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title'],
    });

    const resolveTooltipEl = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest(`[${TOOLTIP_ATTR}]`) as HTMLElement | null;
    };

    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let lastEl: HTMLElement | null = null;
    let lastPos = { x: 0, y: 0 };
    let posRaf: number | null = null;

    const clearHoverTimer = () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    };

    const cancelPosRaf = () => {
      if (posRaf != null) {
        cancelAnimationFrame(posRaf);
        posRaf = null;
      }
    };

    const scheduleTooltipPosition = () => {
      if (posRaf != null) return;
      posRaf = requestAnimationFrame(() => {
        posRaf = null;
        const p = lastPos;
        setTooltip(prev => (prev ? { ...prev, x: p.x, y: p.y } : prev));
      });
    };

    const onMove = (e: MouseEvent) => {
      const el = resolveTooltipEl(e.target);
      if (!el) {
        clearHoverTimer();
        cancelPosRaf();
        lastEl = null;
        if (tooltipRef.current) setTooltip(null);
        return;
      }
      const text = el.getAttribute(TOOLTIP_ATTR)?.trim();
      if (!text) {
        clearHoverTimer();
        cancelPosRaf();
        lastEl = null;
        if (tooltipRef.current) setTooltip(null);
        return;
      }
      lastPos = { x: e.clientX + 14, y: e.clientY + 16 };

      const shown = tooltipRef.current;
      if (shown && lastEl === el && shown.text === text) {
        scheduleTooltipPosition();
        return;
      }
      clearHoverTimer();
      cancelPosRaf();
      lastEl = el;
      hoverTimer = setTimeout(() => {
        setTooltip({ text, x: lastPos.x, y: lastPos.y });
      }, 180);
    };

    const onLeave = () => {
      clearHoverTimer();
      cancelPosRaf();
      lastEl = null;
      setTooltip(null);
    };
    const onMouseOut = (e: MouseEvent) => {
      const from = resolveTooltipEl(e.target);
      if (!from) return;
      const to = resolveTooltipEl(e.relatedTarget);
      if (to === from) return;
      onLeave();
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseout', onMouseOut, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('pointerdown', onLeave, { passive: true });
    window.addEventListener('scroll', onLeave, { passive: true });
    window.addEventListener('blur', onLeave);

    return () => {
      observer.disconnect();
      clearHoverTimer();
      cancelPosRaf();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('pointerdown', onLeave);
      window.removeEventListener('scroll', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, []);

  return (
    <AnimatePresence>
      {tooltip && (
        <motion.div
          key="gnz-global-tooltip"
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 2, scale: 0.98 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none fixed z-[500] max-w-[20rem] rounded-md border border-amber-700/45 bg-stone-950/96 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100 shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y, willChange: 'transform, opacity' }}
        >
          {tooltip.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
