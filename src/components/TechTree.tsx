import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, TechId } from '../game/types';
import { TECHNOLOGIES, TECH_ERA_COLORS } from '../game/constants';
import { GnozianGlyph } from './ui';
import { t } from '../i18n';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';
import { useLayoutProfile } from '../hooks/useLayoutProfile';

interface Props {
  gameState: GameState;
  onClose: () => void;
  onResearch: (techId: TechId) => void;
}

const ERAS = ['ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern', 'atomic', 'information'];
const ERA_X: Record<string, number> = {};
ERAS.forEach((era, i) => { ERA_X[era] = i * 300 + 60; });

const TECH_NODE_W = 180;
const TECH_NODE_H = 60;

export default function TechTree({ gameState, onClose, onResearch }: Props) {
  const layout = useLayoutProfile();
  const mobile = layout === 'mobile';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredTech, setHoveredTech] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; techId: string } | null>(null);
  const me = useLocalPlayerCivIndex();

  const civ = gameState.civilizations[me] ?? gameState.civilizations[0]!;
  const researchedTechs = civ.researchedTechs;
  const currentResearch = civ.currentResearch;
  const researchLocked = Boolean(currentResearch);
  const researchProgress = civ.researchProgress;
  const tl = useCallback((key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  }, []);
  const techName = useCallback((id: string) => tl(`tech.name.${id}`, TECHNOLOGIES[id]?.name ?? id), [tl]);
  const techDesc = useCallback((id: string) => tl(`tech.desc.${id}`, TECHNOLOGIES[id]?.description ?? ''), [tl]);
  const eraLabel = useCallback((era: string) => tl(`era.${era}`, era), [tl]);
  const unlockLabel = useCallback((id: string) => tl(`tech.unlock.${id}`, id), [tl]);

  // Layout: group by era, arrange vertically within era
  const techsByEra: Record<string, string[]> = {};
  for (const era of ERAS) {
    techsByEra[era] = Object.values(TECHNOLOGIES)
      .filter(t => t.era === era)
      .map(t => t.id);
  }

  const techPositions: Record<string, { x: number; y: number }> = {};
  for (const era of ERAS) {
    const techs = techsByEra[era];
    techs.forEach((techId, i) => {
      techPositions[techId] = {
        x: ERA_X[era],
        y: 80 + i * 90,
      };
    });
  }

  const canvasW = ERAS.length * 300 + 200;
  const maxTechsInEra = Math.max(...ERAS.map(e => techsByEra[e].length));
  const canvasH = 80 + maxTechsInEra * 90 + 40;

  const isResearchable = useCallback((techId: string): boolean => {
    if (researchedTechs.includes(techId)) return false;
    const tech = TECHNOLOGIES[techId];
    if (!tech) return false;
    return tech.prerequisites.every(p => researchedTechs.includes(p));
  }, [researchedTechs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasW;
    canvas.height = canvasH;

    ctx.fillStyle = '#0d1520';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Subtle grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let x = 0; x < canvasW; x += 40) {
      for (let y = 0; y < canvasH; y += 40) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Draw era backgrounds
    for (const era of ERAS) {
      const x = ERA_X[era] - 40;
      const color = TECH_ERA_COLORS[era];
      ctx.fillStyle = color + '10';
      ctx.fillRect(x, 0, 280, canvasH);
      // Era label
      ctx.fillStyle = color + 'cc';
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(eraLabel(era), x + 140, 32);
      // Era decorative line
      ctx.strokeStyle = color + '40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 20, 42);
      ctx.lineTo(x + 260, 42);
      ctx.stroke();
    }

    // Draw connections
    ctx.lineWidth = 2;
    for (const tech of Object.values(TECHNOLOGIES)) {
      const pos = techPositions[tech.id];
      if (!pos) continue;
      for (const prereq of tech.prerequisites) {
        const prereqPos = techPositions[prereq];
        if (!prereqPos) continue;
        const researched = researchedTechs.includes(tech.id) && researchedTechs.includes(prereq);
        const canResearch = isResearchable(tech.id);
        const prereqResearched = researchedTechs.includes(prereq);

        ctx.strokeStyle = researched
          ? '#2ecc7199'
          : canResearch && prereqResearched
            ? '#f39c1266'
            : '#ffffff15';
        ctx.beginPath();
        ctx.moveTo(prereqPos.x + TECH_NODE_W, prereqPos.y + TECH_NODE_H / 2);
        ctx.bezierCurveTo(
          prereqPos.x + TECH_NODE_W + 40, prereqPos.y + TECH_NODE_H / 2,
          pos.x - 40, pos.y + TECH_NODE_H / 2,
          pos.x, pos.y + TECH_NODE_H / 2
        );
        ctx.stroke();
      }
    }

    // Draw tech nodes
    for (const tech of Object.values(TECHNOLOGIES)) {
      const pos = techPositions[tech.id];
      if (!pos) continue;

      const researched = researchedTechs.includes(tech.id);
      const isCurrentResearch = currentResearch === tech.id;
      const canResearch = isResearchable(tech.id);
      const isHovered = hoveredTech === tech.id;

      const eraColor = TECH_ERA_COLORS[tech.era];

      // Node background
      const bgGrad = ctx.createLinearGradient(pos.x, pos.y, pos.x + TECH_NODE_W, pos.y + TECH_NODE_H);

      if (researched) {
        bgGrad.addColorStop(0, '#1e4a2e');
        bgGrad.addColorStop(1, '#2d6a3e');
      } else if (isCurrentResearch) {
        bgGrad.addColorStop(0, '#1a3a5c');
        bgGrad.addColorStop(1, '#2255aa');
      } else if (canResearch) {
        bgGrad.addColorStop(0, '#2a2a3a');
        bgGrad.addColorStop(1, '#3a3a4a');
      } else {
        bgGrad.addColorStop(0, '#111118');
        bgGrad.addColorStop(1, '#1a1a22');
      }

      // Shadow
      if (isHovered || isCurrentResearch || canResearch) {
        ctx.save();
        ctx.shadowColor = isHovered ? eraColor + '60' : 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = isHovered ? 12 : 6;
        ctx.shadowOffsetY = 3;
      }

      // Rounded rect
      const rx = 10;
      ctx.beginPath();
      ctx.moveTo(pos.x + rx, pos.y);
      ctx.lineTo(pos.x + TECH_NODE_W - rx, pos.y);
      ctx.quadraticCurveTo(pos.x + TECH_NODE_W, pos.y, pos.x + TECH_NODE_W, pos.y + rx);
      ctx.lineTo(pos.x + TECH_NODE_W, pos.y + TECH_NODE_H - rx);
      ctx.quadraticCurveTo(pos.x + TECH_NODE_W, pos.y + TECH_NODE_H, pos.x + TECH_NODE_W - rx, pos.y + TECH_NODE_H);
      ctx.lineTo(pos.x + rx, pos.y + TECH_NODE_H);
      ctx.quadraticCurveTo(pos.x, pos.y + TECH_NODE_H, pos.x, pos.y + TECH_NODE_H - rx);
      ctx.lineTo(pos.x, pos.y + rx);
      ctx.quadraticCurveTo(pos.x, pos.y, pos.x + rx, pos.y);
      ctx.closePath();
      ctx.fillStyle = bgGrad;
      ctx.fill();

      if (isHovered || isCurrentResearch || canResearch) {
        ctx.restore();
      }

      // Border
      ctx.strokeStyle = isHovered ? eraColor :
        researched ? '#2ecc71' :
        isCurrentResearch ? '#3498db' :
        canResearch ? eraColor + '88' : '#333';
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();

      // Era color stripe (left)
      ctx.fillStyle = eraColor + 'cc';
      ctx.fillRect(pos.x, pos.y, 4, TECH_NODE_H);
      // Small glow on stripe
      ctx.fillStyle = eraColor + '44';
      ctx.fillRect(pos.x + 4, pos.y, 2, TECH_NODE_H);

      // Tech name
      ctx.fillStyle = researched ? '#aeffbe' : canResearch || isCurrentResearch ? '#e0e8ff' : '#666680';
      ctx.font = `${isHovered ? 'bold ' : ''}12px "Segoe UI", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(techName(tech.id), pos.x + 14, pos.y + 10);

      // Cost
      ctx.fillStyle = researched ? '#2ecc7188' : '#3498db88';
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillText(`${tech.cost} ${t('tech.sciShort')}`, pos.x + 14, pos.y + 28);

      // Unlocks preview
      if (tech.unlocks.length > 0) {
        ctx.fillStyle = '#f39c1288';
        ctx.font = '9px "Segoe UI", sans-serif';
        const unlockText = `+${tech.unlocks.map(unlockLabel).join(', ')}`.substring(0, 24);
        ctx.fillText(unlockText, pos.x + 14, pos.y + 42);
      }

      // Research progress bar
      if (isCurrentResearch) {
        const pct = Math.min(1, researchProgress / tech.cost);
        // Background
        ctx.fillStyle = '#1a3a5c';
        roundRect(ctx, pos.x + 6, pos.y + TECH_NODE_H - 10, TECH_NODE_W - 12, 6, 3);
        ctx.fill();
        // Fill
        ctx.fillStyle = '#3498db';
        roundRect(ctx, pos.x + 6, pos.y + TECH_NODE_H - 10, (TECH_NODE_W - 12) * pct, 6, 3);
        ctx.fill();
        // Glow
        ctx.shadowColor = '#3498db66';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Checkmark for researched
      if (researched) {
        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 15px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('✓', pos.x + TECH_NODE_W - 8, pos.y + 8);
      }

      // Research icon for available
      if (canResearch && !isHovered) {
        ctx.fillStyle = eraColor + '55';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('●', pos.x + TECH_NODE_W - 8, pos.y + 8);
      }
    }
  }, [hoveredTech, researchedTechs, currentResearch, researchProgress, isResearchable, canvasW, canvasH, eraLabel, techName, unlockLabel]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      const last = panLastRef.current;
      if (!el || !last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      el.scrollLeft -= dx;
      el.scrollTop -= dy;
    };
    const endPan = () => {
      panLastRef.current = null;
      isPanningRef.current = false;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", endPan);
    window.addEventListener("blur", endPan);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", endPan);
      window.removeEventListener("blur", endPan);
    };
  }, [isPanning]);

  const handleScrollMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 1 && e.button !== 2) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    panLastRef.current = { x: e.clientX, y: e.clientY };
    isPanningRef.current = true;
    setIsPanning(true);
    setHoveredTech(null);
    setTooltip(null);
  }, []);

  const handleScrollPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    const el = scrollRef.current;
    if (!el) return;
    panLastRef.current = { x: e.clientX, y: e.clientY };
    isPanningRef.current = true;
    setIsPanning(true);
    setHoveredTech(null);
    setTooltip(null);
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handleScrollPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || e.pointerType !== 'touch') return;
    const el = scrollRef.current;
    const last = panLastRef.current;
    if (!el || !last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    panLastRef.current = { x: e.clientX, y: e.clientY };
    el.scrollLeft -= dx;
    el.scrollTop -= dy;
  }, []);

  const handleScrollPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    panLastRef.current = null;
    isPanningRef.current = false;
    setIsPanning(false);
    (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
  }, []);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvasW / rect.width);
    const my = (e.clientY - rect.top) * (canvasH / rect.height);

    let found: string | null = null;
    for (const tech of Object.values(TECHNOLOGIES)) {
      const pos = techPositions[tech.id];
      if (!pos) continue;
      if (mx >= pos.x && mx <= pos.x + TECH_NODE_W && my >= pos.y && my <= pos.y + TECH_NODE_H) {
        found = tech.id;
        break;
      }
    }
    setHoveredTech(found);
    if (found) {
      setTooltip({ x: e.clientX, y: e.clientY, techId: found });
    } else {
      setTooltip(null);
    }
  }, [canvasW, canvasH]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    if (researchLocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvasW / rect.width);
    const my = (e.clientY - rect.top) * (canvasH / rect.height);

    for (const tech of Object.values(TECHNOLOGIES)) {
      const pos = techPositions[tech.id];
      if (!pos) continue;
      if (mx >= pos.x && mx <= pos.x + TECH_NODE_W && my >= pos.y && my <= pos.y + TECH_NODE_H) {
        if (tech.id !== currentResearch && isResearchable(tech.id)) {
          onResearch(tech.id);
        }
        break;
      }
    }
  }, [canvasW, canvasH, currentResearch, isResearchable, onResearch, researchLocked]);

  const tooltipTech = tooltip ? TECHNOLOGIES[tooltip.techId] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 gnz-modal-backdrop flex items-center justify-center overflow-y-auto p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`flex w-full flex-col overflow-hidden rounded-2xl border border-blue-800/50 bg-[#090f17] shadow-2xl ${
          mobile ? 'max-h-[90vh] max-w-[98vw]' : 'max-h-[90vh] max-w-[min(96vw,1200px)]'
        }`}
        onClick={e => e.stopPropagation()}
      >
      {/* Header */}
      <div
        className={`flex items-center justify-between bg-gradient-to-r from-blue-950 to-indigo-950 border-b border-blue-800/50 ${mobile ? 'px-3 py-2' : 'px-6 py-3'}`}
      >
        <div className="flex items-center gap-3">
          <GnozianGlyph name="flask" size={28} className="text-sky-300/90" />
          <div>
            <h2 className={`text-white font-bold ${mobile ? 'text-base' : 'text-xl'}`}>{t('tech.title')}</h2>
            <p className={`text-blue-300 ${mobile ? 'text-xs' : 'text-sm'}`}>
              {civ.currentResearch
                ? `${t('tech.researching')}: ${techName(civ.currentResearch)} (${Math.round(researchProgress)}/${TECHNOLOGIES[civ.currentResearch]?.cost})`
                : t('tech.noResearch')}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="text-white hover:text-red-400 transition-colors text-2xl font-bold px-4 py-2"
        >✕</motion.button>
      </div>

      {/* Era legend */}
      <div className={`flex flex-wrap items-center gap-2 border-b border-stone-800/50 bg-black/80 ${mobile ? 'px-3 py-2' : 'px-6 py-2.5'}`}>
        {ERAS.map(era => (
          <div key={era} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TECH_ERA_COLORS[era] }} />
            <span className="text-xs text-gray-400">{eraLabel(era)}</span>
          </div>
        ))}
        <div className="ml-auto flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="text-green-400">✓</span> {t('tech.researched')}</span>
          <span className="flex items-center gap-1"><span className="text-blue-400">▶</span> {t('tech.inProgress')}</span>
          <span className="flex items-center gap-1"><span className="text-yellow-400">◆</span> {t('tech.available')}</span>
          <span className="hidden sm:inline text-stone-500">· {t('tech.panHint')}</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-auto select-none ${isPanning ? "cursor-grabbing" : ""}`}
        onMouseDown={handleScrollMouseDown}
        onPointerDown={handleScrollPointerDown}
        onPointerMove={handleScrollPointerMove}
        onPointerUp={handleScrollPointerUp}
        onPointerCancel={handleScrollPointerUp}
        onContextMenu={e => e.preventDefault()}
        onAuxClick={e => e.preventDefault()}
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: canvasW,
            height: canvasH,
            display: "block",
            cursor: isPanning
              ? "grabbing"
              : hoveredTech && !researchLocked && hoveredTech !== currentResearch && isResearchable(hoveredTech)
                ? "pointer"
                : "default",
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => {
            if (!isPanningRef.current) {
              setHoveredTech(null);
              setTooltip(null);
            }
          }}
          onClick={handleCanvasClick}
        />
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && tooltipTech && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="pointer-events-none fixed z-[60] max-w-xs rounded-xl border border-stone-600 bg-stone-900 p-4 shadow-2xl"
            style={{ left: Math.min(tooltip.x + 14, window.innerWidth - 300), top: Math.min(tooltip.y + 14, window.innerHeight - 220) }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TECH_ERA_COLORS[tooltipTech.era] }} />
              <div className="font-bold text-white">{techName(tooltipTech.id)}</div>
            </div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-blue-300">
              <GnozianGlyph name="flask" size={14} className="text-sky-300/90" />
              {t('tech.cost')}: {tooltipTech.cost} {t('tech.scienceWord')}
            </div>
            <div className="text-gray-300 text-xs mb-2.5 leading-relaxed">{techDesc(tooltipTech.id)}</div>
            {tooltipTech.unlocks.length > 0 && (
              <div className="text-yellow-300 text-xs bg-yellow-900/20 rounded-lg px-2.5 py-1.5 border border-yellow-800/30">
                <span className="text-gray-400">{t('tech.unlocksLabel')}</span>{tooltipTech.unlocks.map(unlockLabel).join(', ')}
              </div>
            )}
            {!researchLocked && tooltipTech.id !== currentResearch && isResearchable(tooltipTech.id) && (
              <div className="mt-2.5 text-green-400 text-xs font-bold flex items-center gap-1">
                <span className="animate-pulse">●</span> {t('tech.clickToResearch')}
              </div>
            )}
            {!isResearchable(tooltipTech.id) && !researchedTechs.includes(tooltipTech.id) && (
              <div className="mt-2 text-red-400 text-xs">
                {t('tech.requiresLabel')} {tooltipTech.prerequisites.filter(p => !researchedTechs.includes(p)).map(techName).join(', ')}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
