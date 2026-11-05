import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameSettings, TerrainType } from '../game/types';
import { TERRAIN_COLORS, TERRAIN_NAMES } from '../game/constants';
import { t } from '../i18n';
import { playUiClick } from '../audio/AudioManager';
import {
  cloneTerrainGrid,
  floodFillTerrain,
  validateTerrainImport,
  formatTerrainImportError,
} from '../map/mapEditorUtils';
import { useLayoutProfile } from '../hooks/useLayoutProfile';
import { generateMap } from '../game/mapgen';

const ALL_TERRAIN = Object.keys(TERRAIN_COLORS) as TerrainType[];

function makeGrid(w: number, h: number, fill: TerrainType): TerrainType[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

interface Props {
  onBack: () => void;
}

const EDITOR_MAP_TYPES: Exclude<GameSettings['mapType'], 'random'>[] = [
  'pangaea',
  'continents',
  'earth',
  'archipelago',
  'highlands',
  'great_lakes',
  'inland_sea',
  'wetlands',
  'drylands',
  'shattered',
  'ring_sea',
];

const EDITOR_SIZE_PRESETS = [
  { label: 'Small', w: 34, h: 22 },
  { label: 'Standard', w: 40, h: 30 },
  { label: 'Large', w: 52, h: 36 },
  { label: 'Huge', w: 66, h: 42 },
  { label: 'Colossal', w: 72, h: 48 },
  { label: 'Immense', w: 80, h: 52 },
  { label: 'Titan', w: 92, h: 60 },
  { label: 'Vast', w: 104, h: 68 },
  { label: 'Mammoth', w: 116, h: 76 },
  { label: 'Celestial', w: 128, h: 84 },
  { label: 'Planetary', w: 180, h: 96 },
  { label: 'Mega', w: 240, h: 120 },
  { label: 'Galactic', w: 360, h: 180 },
  { label: 'Ultimate', w: 520, h: 240 },
];

export default function MapEditorScreen({ onBack }: Props) {
  const layout = useLayoutProfile();
  const compact = layout === 'mobile';
  const [width, setWidth] = useState(36);
  const [height, setHeight] = useState(24);
  const [terrain, setTerrain] = useState<TerrainType[][]>(() => makeGrid(36, 24, 'plains'));
  const [brush, setBrush] = useState<TerrainType>('plains');
  const [isPainting, setIsPainting] = useState(false);
  const [mapType, setMapType] = useState<Exclude<GameSettings['mapType'], 'random'>>('continents');
  const [seed, setSeed] = useState(Math.floor(Math.random() * 99999));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [history, setHistory] = useState<TerrainType[][][]>([]);
  const [future, setFuture] = useState<TerrainType[][][]>([]);
  const [tool, setTool] = useState<'brush' | 'fill'>('brush');
  const terrainRef = useRef(terrain);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokeOpenRef = useRef(false);
  useEffect(() => {
    terrainRef.current = terrain;
  }, [terrain]);

  const pushHistory = useCallback(() => {
    const snap = cloneTerrainGrid(terrainRef.current);
    setHistory(h => [...h.slice(-79), snap]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h;
      const prevGrid = h[h.length - 1];
      setFuture(f => [cloneTerrainGrid(terrainRef.current), ...f]);
      setTerrain(cloneTerrainGrid(prevGrid));
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(f => {
      if (!f.length) return f;
      const [next, ...rest] = f;
      setHistory(h => [...h, cloneTerrainGrid(terrainRef.current)]);
      setTerrain(cloneTerrainGrid(next));
      return rest;
    });
  }, []);

  useEffect(() => {
    const up = () => {
      setIsPainting(false);
      strokeOpenRef.current = false;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const paint = useCallback(
    (r: number, c: number) => {
      setTerrain(prev => {
        if (r < 0 || c < 0 || r >= prev.length || c >= prev[0].length) return prev;
        const next = cloneTerrainGrid(prev);
        next[r][c] = brush;
        return next;
      });
    },
    [brush]
  );

  const applySize = useCallback(() => {
    const w = Math.max(12, Math.min(520, width));
    const h = Math.max(10, Math.min(240, height));
    setWidth(w);
    setHeight(h);
    pushHistory();
    setTerrain(prev => {
      const next = makeGrid(w, h, 'plains');
      for (let r = 0; r < Math.min(h, prev.length); r++) {
        for (let c = 0; c < Math.min(w, prev[0]?.length ?? 0); c++) {
          next[r][c] = prev[r][c];
        }
      }
      return next;
    });
  }, [width, height, pushHistory]);

  const applyExactSize = useCallback((wRaw: number, hRaw: number) => {
    const w = Math.max(12, Math.min(520, wRaw));
    const h = Math.max(10, Math.min(240, hRaw));
    setWidth(w);
    setHeight(h);
    pushHistory();
    setTerrain(prev => {
      const next = makeGrid(w, h, 'plains');
      for (let r = 0; r < Math.min(h, prev.length); r++) {
        for (let c = 0; c < Math.min(w, prev[0]?.length ?? 0); c++) {
          next[r][c] = prev[r][c];
        }
      }
      return next;
    });
  }, [pushHistory]);

  const fillAll = useCallback(
    (t: TerrainType) => {
      pushHistory();
      setTerrain(makeGrid(terrainRef.current[0].length, terrainRef.current.length, t));
    },
    [pushHistory]
  );

  const exportJson = useCallback(() => {
    const payload = {
      gnozianMap: 1 as const,
      mapWidth: terrain[0].length,
      mapHeight: terrain.length,
      terrain,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gnozian-map-${terrain[0].length}x${terrain.length}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [terrain]);

  const importJson = useCallback(
    (text: string) => {
      setJsonError(null);
      try {
        const data = JSON.parse(text) as unknown;
        const res = validateTerrainImport(data);
        if (!res.ok) {
          setJsonError(formatTerrainImportError(res, t));
          return;
        }
        pushHistory();
        setTerrain(res.terrain);
        setWidth(res.w);
        setHeight(res.h);
      } catch {
        setJsonError(t('mapEditor.invalidJson'));
      }
    },
    [pushHistory]
  );

  const landCount = useMemo(() => {
    let n = 0;
    for (const row of terrain) {
      for (const cell of row) {
        if (cell !== 'ocean' && cell !== 'coast' && cell !== 'mountains' && cell !== 'snow') n++;
      }
    }
    return n;
  }, [terrain]);

  const generateFromType = useCallback(() => {
    pushHistory();
    const w = terrainRef.current[0]?.length ?? width;
    const h = terrainRef.current.length ?? height;
    const tiles = generateMap(w, h, seed, mapType);
    setTerrain(tiles.map(row => row.map(cell => cell.terrain)));
    setJsonError(null);
  }, [pushHistory, seed, mapType, width, height]);

  const mirrorHorizontal = useCallback(() => {
    pushHistory();
    setTerrain(prev => prev.map(row => [...row].reverse()));
  }, [pushHistory]);

  const rotateClockwise = useCallback(() => {
    pushHistory();
    setTerrain(prev => {
      const h = prev.length;
      const w = prev[0]?.length ?? 0;
      const out = makeGrid(h, w, 'plains');
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          out[c][h - 1 - r] = prev[r][c];
        }
      }
      setWidth(h);
      setHeight(w);
      return out;
    });
  }, [pushHistory]);

  const cellSize = useMemo(() => {
    const maxPx = compact ? 420 : 560;
    const cw = maxPx / Math.max(1, terrain[0].length);
    const ch = maxPx / Math.max(1, terrain.length);
    return Math.max(3, Math.min(compact ? 14 : 18, Math.floor(Math.min(cw, ch))));
  }, [terrain, compact]);
  const useCanvasEditor = terrain.length * (terrain[0]?.length ?? 0) >= 6000;

  const paintAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);
    if (r < 0 || c < 0 || r >= terrainRef.current.length || c >= (terrainRef.current[0]?.length ?? 0)) return;
    if (tool === 'fill') {
      pushHistory();
      setTerrain(prev => floodFillTerrain(prev, r, c, brush));
      return;
    }
    if (!strokeOpenRef.current) {
      pushHistory();
      strokeOpenRef.current = true;
    }
    setIsPainting(true);
    paint(r, c);
  }, [brush, cellSize, paint, pushHistory, tool]);

  useEffect(() => {
    if (!useCanvasEditor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = (terrain[0]?.length ?? 0) * cellSize;
    const h = terrain.length * cellSize;
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (let r = 0; r < terrain.length; r++) {
      for (let c = 0; c < (terrain[r]?.length ?? 0); c++) {
        const tId = terrain[r]![c]!;
        ctx.fillStyle = TERRAIN_COLORS[tId];
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
    if (cellSize >= 5) {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
    }
  }, [cellSize, terrain, useCanvasEditor]);

  return (
    <div className="allow-text-select flex min-h-screen min-w-0 flex-col overflow-x-auto gnz-page-bg text-stone-200">
      <header className={`flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/30 bg-black/40 ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      }`}>
        <div>
          <h1 className={`${compact ? 'text-lg' : 'text-xl'} font-bold text-amber-200`}>{t('mapEditor.title')}</h1>
          <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-stone-500`}>{t('mapEditor.hint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onBack();
            }}
            className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-sm font-semibold hover:bg-stone-800"
          >
            {t('mapEditor.back')}
          </button>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              exportJson();
            }}
            className="rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 px-4 py-2 text-sm font-bold text-white shadow-lg hover:from-amber-600 hover:to-yellow-600"
          >
            {t('mapEditor.export')}
          </button>
        </div>
      </header>

      <div className={`flex flex-1 flex-col gap-3 overflow-auto ${compact ? 'p-2.5' : 'p-4'} lg:flex-row`}>
        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3">
            <div className="mb-2 text-xs font-bold uppercase text-amber-700/90">{t('mapEditor.size')}</div>
            <div className="flex gap-2">
              <label className="flex-1 text-xs">
                W
                <input
                  type="number"
                  min={12}
                  max={520}
                  value={width}
                  onChange={e => setWidth(Number(e.target.value))}
                  className="mt-0.5 w-full rounded border border-stone-700 bg-black px-2 py-1"
                />
              </label>
              <label className="flex-1 text-xs">
                H
                <input
                  type="number"
                  min={10}
                  max={240}
                  value={height}
                  onChange={e => setHeight(Number(e.target.value))}
                  className="mt-0.5 w-full rounded border border-stone-700 bg-black px-2 py-1"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                applySize();
              }}
              className="mt-2 w-full rounded bg-stone-700 py-1.5 text-xs font-bold hover:bg-stone-600"
            >
              {t('mapEditor.applySize')}
            </button>
          </div>

          <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3">
            <div className="mb-2 text-xs font-bold uppercase text-amber-700/90">{t('mapEditor.tool')}</div>
            <div className="mb-2 flex gap-1">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  setTool('brush');
                }}
                className={`flex-1 rounded py-1 text-[10px] font-bold ${tool === 'brush' ? 'bg-amber-800 text-white' : 'bg-stone-800'}`}
              >
                {t('mapEditor.toolBrush')}
              </button>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  setTool('fill');
                }}
                className={`flex-1 rounded py-1 text-[10px] font-bold ${tool === 'fill' ? 'bg-amber-800 text-white' : 'bg-stone-800'}`}
              >
                {t('mapEditor.toolFill')}
              </button>
            </div>
            <div className="mb-2 flex gap-1">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  undo();
                }}
                disabled={!history.length}
                className="flex-1 rounded bg-stone-800 py-1 text-[10px] font-bold disabled:opacity-40"
              >
                {t('mapEditor.undo')}
              </button>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  redo();
                }}
                disabled={!future.length}
                className="flex-1 rounded bg-stone-800 py-1 text-[10px] font-bold disabled:opacity-40"
              >
                {t('mapEditor.redo')}
              </button>
            </div>
            <div className="mb-2 text-xs font-bold uppercase text-amber-700/90">{t('mapEditor.brush')}</div>
            <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto">
              {ALL_TERRAIN.map(tid => (
                <button
                  key={tid}
                  type="button"
                  onClick={() => {
                    playUiClick();
                    setBrush(tid);
                  }}
                  className={`flex items-center gap-1 rounded border px-1.5 py-1 text-left text-[10px] ${
                    brush === tid ? 'border-amber-500 bg-amber-950/50' : 'border-stone-700 hover:bg-stone-800'
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: TERRAIN_COLORS[tid] }} />
                  <span className="truncate">{TERRAIN_NAMES[tid]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs">
            <div className="mb-2 font-bold uppercase text-amber-700/90">{t('mapEditor.generate')}</div>
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              {EDITOR_SIZE_PRESETS.map(p => (
                <button
                  key={`${p.w}x${p.h}`}
                  type="button"
                  onClick={() => {
                    playUiClick();
                    applyExactSize(p.w, p.h);
                  }}
                  className="rounded border border-stone-700 bg-black/30 px-2 py-1 text-[10px] font-semibold hover:bg-stone-800"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="mb-2 block">
              {t('newGame.mapType')}
              <select
                value={mapType}
                onChange={e => setMapType(e.target.value as Exclude<GameSettings['mapType'], 'random'>)}
                className="mt-0.5 w-full rounded border border-stone-700 bg-black px-2 py-1"
              >
                {EDITOR_MAP_TYPES.map(mt => (
                  <option key={mt} value={mt}>
                    {t(`newGame.mapType.${mt}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-2 block">
              {t('newGame.seed')}
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(Number(e.target.value) || 0)}
                className="mt-0.5 w-full rounded border border-stone-700 bg-black px-2 py-1"
              />
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  setSeed(Math.floor(Math.random() * 99999));
                }}
                className="flex-1 rounded border border-stone-700 bg-stone-800 py-1 text-[10px] font-bold hover:bg-stone-700"
              >
                {t('mapEditor.randomSeed')}
              </button>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  generateFromType();
                }}
                className="flex-1 rounded border border-emerald-800/60 bg-emerald-950/30 py-1 text-[10px] font-bold text-emerald-200 hover:bg-emerald-900/35"
              >
                {t('mapEditor.generateApply')}
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  mirrorHorizontal();
                }}
                className="flex-1 rounded border border-stone-700 bg-stone-800 py-1 text-[10px] font-bold hover:bg-stone-700"
              >
                {t('mapEditor.mirrorHorizontal')}
              </button>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  rotateClockwise();
                }}
                className="flex-1 rounded border border-stone-700 bg-stone-800 py-1 text-[10px] font-bold hover:bg-stone-700"
              >
                {t('mapEditor.rotateClockwise')}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-stone-500">
              {t('mapEditor.landTiles')}: {landCount}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                playUiClick();
                fillAll('plains');
              }}
              className="rounded border border-stone-600 px-2 py-1 text-[11px] hover:bg-stone-800"
            >
              {t('mapEditor.fillPlains')}
            </button>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                fillAll('ocean');
              }}
              className="rounded border border-stone-600 px-2 py-1 text-[11px] hover:bg-stone-800"
            >
              {t('mapEditor.fillOcean')}
            </button>
          </div>

          <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3">
            <div className="mb-2 text-xs font-bold uppercase text-amber-700/90">{t('mapEditor.io')}</div>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                exportJson();
              }}
              className="mb-2 w-full rounded bg-stone-700 py-1.5 text-xs font-bold hover:bg-stone-600"
            >
              {t('mapEditor.export')}
            </button>
            <label className="block text-[10px] text-stone-500">
              {t('mapEditor.import')}
              <input
                type="file"
                accept="application/json"
                className="mt-1 w-full text-[10px] file:mr-2 file:rounded file:border-0 file:bg-amber-900 file:px-2 file:py-1"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => importJson(String(reader.result ?? ''));
                  reader.readAsText(f);
                  e.target.value = '';
                }}
              />
            </label>
            {jsonError && <p className="mt-2 text-[11px] text-red-400">{jsonError}</p>}
          </div>
        </aside>

        <motion.div
          layout
          className="flex min-w-0 flex-1 flex-col items-center justify-start overflow-auto rounded-xl border border-stone-800 bg-black/50 p-3"
        >
          {useCanvasEditor ? (
            <canvas
              ref={canvasRef}
              className="block select-none"
              onMouseDown={e => {
                e.preventDefault();
                paintAt(e.clientX, e.clientY);
              }}
              onMouseMove={e => {
                if (tool === 'fill' || !isPainting) return;
                paintAt(e.clientX, e.clientY);
              }}
              onMouseUp={() => setIsPainting(false)}
              onMouseLeave={() => setIsPainting(false)}
            />
          ) : (
            <div
              className="inline-grid gap-0 select-none"
              style={{
                gridTemplateColumns: `repeat(${terrain[0].length}, ${cellSize}px)`,
              }}
              onMouseLeave={() => setIsPainting(false)}
            >
              {terrain.map((row, r) =>
                row.map((cell, c) => (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className="box-border border border-black/20 p-0"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: TERRAIN_COLORS[cell],
                    }}
                    onMouseDown={e => {
                      e.preventDefault();
                      if (tool === 'fill') {
                        pushHistory();
                        setTerrain(prev => floodFillTerrain(prev, r, c, brush));
                        return;
                      }
                      if (!strokeOpenRef.current) {
                        pushHistory();
                        strokeOpenRef.current = true;
                      }
                      setIsPainting(true);
                      paint(r, c);
                    }}
                    onMouseEnter={() => {
                      if (tool === 'fill') return;
                      if (isPainting) paint(r, c);
                    }}
                    onMouseUp={() => setIsPainting(false)}
                  />
                ))
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
