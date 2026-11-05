import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { GameState, UnitType, WeatherType } from '../game/types';
import { updateVision } from '../game/mapgen';
import { NATURAL_RESOURCES, UNITS } from '../game/constants';
import { t } from '../i18n';
import { GnozianGlyph, GnozianPanelCorners } from './ui';
import { useLocalPlayerCivIndex } from '../context/LocalPlayerCivContext';

const WEATHER_OPTS: WeatherType[] = ['clear', 'rain', 'storm', 'snow'];

interface Props {
  gameState: GameState;
  onApplyState: (s: GameState) => void;
  onClose: () => void;
  liveCamera?: { x: number; y: number; zoom: number };
  onTeleportCamera?: (cam: { x: number; y: number; zoom: number }) => void;
  showPerf?: boolean;
  onTogglePerf?: () => void;
  /** When true, only non-mutating commands run (safe if console is ever shown to non-host). */
  readOnly?: boolean;
}

export default function DevConsole({
  gameState,
  onApplyState,
  onClose,
  liveCamera,
  onTeleportCamera,
  showPerf,
  onTogglePerf,
  readOnly = false,
}: Props) {
  const me = useLocalPlayerCivIndex();
  const [line, setLine] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [localPerf, setLocalPerf] = useState(false);
  const fpsRef = useRef({ frames: 0, last: performance.now(), fps: 0 });

  const perfOn = showPerf !== undefined ? showPerf : localPerf;

  useEffect(() => {
    if (!perfOn) return;
    let id = 0;
    const loop = (t: number) => {
      const f = fpsRef.current;
      f.frames++;
      if (t - f.last >= 1000) {
        f.fps = Math.round((f.frames * 1000) / (t - f.last));
        f.frames = 0;
        f.last = t;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [perfOn]);

  const push = useCallback((s: string) => {
    setLog(l => [s, ...l].slice(0, 12));
  }, []);

  const knownUnits = useMemo(() => Object.keys(UNITS).sort(), []);
  const humanCiv = gameState.civilizations[me] ?? gameState.civilizations[0]!;
  const selectedUnit = gameState.selectedUnitId != null
    ? gameState.units.find(u => u.id === gameState.selectedUnitId) ?? null
    : null;

  const run = useCallback(() => {
    const raw = line.trim();
    const [cmd, ...rest] = raw.split(/\s+/);
    const a = rest[0];
    const b = rest[1];
    const c = rest[2];
    if (!cmd) return;

    if (readOnly) {
      const safe = new Set(['help', '?', 'clear', 'close', 'exit', 'status', 'civ', 'perf', 'cam']);
      if (!safe.has(cmd)) {
        push(t('devConsole.readOnlyHint'));
        setLine('');
        return;
      }
    }

    if (cmd === 'help' || cmd === '?') {
      push('Core: help | clear | close | status | civ [id] | perf');
      push('World: reveal | hour 0-23 | weather clear|rain|storm|snow | turn N');
      push('Camera: cam x y zoom');
      push('Economy: food N | production N | gold N | science N | culture N | faith N | happiness N');
      push('Strategic: strategic RES N (RES: horse|iron|coal|oil|uranium)');
      push('Units: select UNIT_ID | heal [all|selected] | kill UNIT_ID');
      push('Units+: spawn TYPE [q r] | tp UNIT_ID q r');
      push('Comms: msg info|warning|city|combat|tech|diplomacy TEXT');
      setLine('');
      return;
    }
    if (cmd === 'clear') {
      setLog([]);
      setLine('');
      return;
    }
    if (cmd === 'close' || cmd === 'exit') {
      onClose();
      return;
    }
    if (cmd === 'perf') {
      if (onTogglePerf) onTogglePerf();
      else setLocalPerf(v => !v);
      push('Toggled perf overlay (F3)');
      setLine('');
      return;
    }
    if (cmd === 'cam' && a && b && c) {
      const x = Number(a);
      const y = Number(b);
      const zoom = Number(c);
      if (![x, y, zoom].every(Number.isFinite)) {
        push('cam: invalid numbers');
        return;
      }
      onTeleportCamera?.({ x, y, zoom });
      push(`Camera → x ${x} y ${y} zoom ${zoom}`);
      setLine('');
      return;
    }
    if (cmd === 'status') {
      const research = humanCiv.currentResearch ?? 'none';
      const cityCount = gameState.cities.filter(c => c.owner === me).length;
      const unitCount = gameState.units.filter(u => u.owner === me).length;
      push(
        `Turn ${gameState.turn} | ${gameState.world.hour}:00 ${gameState.world.weather} | research: ${research}`
      );
      push(
        `Civ: ${humanCiv.name} | score ${humanCiv.score} | cities ${cityCount} | units ${unitCount}`
      );
      push(
        `Res: g${Math.round(humanCiv.resources.gold)} s${Math.round(humanCiv.resources.science)} c${Math.round(humanCiv.resources.culture)} f${Math.round(humanCiv.resources.faith)} h${Math.round(humanCiv.resources.happiness)}`
      );
      setLine('');
      return;
    }
    if (cmd === 'civ') {
      const idx = a ? Number(a) : 0;
      if (!Number.isFinite(idx) || idx < 0 || idx >= gameState.civilizations.length) {
        push(`civ: pick 0..${gameState.civilizations.length - 1}`);
        return;
      }
      const civ = gameState.civilizations[Math.floor(idx)];
      push(`${idx}: ${civ.name} (${civ.leader}) era=${civ.era} score=${Math.round(civ.score)}`);
      push(`Cities=${civ.cities.length} Units=${civ.units.length} Techs=${civ.researchedTechs.length}`);
      setLine('');
      return;
    }
    if (cmd === 'hour' && a) {
      const h = Number(a);
      if (!Number.isFinite(h) || h < 0 || h > 23) {
        push('hour: need 0–23');
        return;
      }
      onApplyState({
        ...gameState,
        world: { ...gameState.world, hour: Math.floor(h) },
      });
      push(`World hour = ${Math.floor(h)}`);
      setLine('');
      return;
    }
    if (cmd === 'turn' && a) {
      const n = Number(a);
      if (!Number.isFinite(n) || n < 1) {
        push('turn: need integer >= 1');
        return;
      }
      onApplyState({ ...gameState, turn: Math.floor(n) });
      push(`Turn = ${Math.floor(n)}`);
      setLine('');
      return;
    }
    if (cmd === 'weather' && a) {
      const w = a.toLowerCase() as WeatherType;
      if (!WEATHER_OPTS.includes(w)) {
        push(`weather: one of ${WEATHER_OPTS.join(', ')}`);
        return;
      }
      onApplyState({
        ...gameState,
        world: { ...gameState.world, weather: w },
      });
      push(`Weather = ${w}`);
      setLine('');
      return;
    }
    const resAlias: Record<string, keyof GameState['civilizations'][number]['resources']> = {
      food: 'food',
      f: 'food',
      production: 'production',
      prod: 'production',
      p: 'production',
      gold: 'gold',
      g: 'gold',
      science: 'science',
      sci: 'science',
      s: 'science',
      culture: 'culture',
      cul: 'culture',
      c: 'culture',
      faith: 'faith',
      happiness: 'happiness',
      happy: 'happiness',
    };
    const resourceKey = resAlias[cmd];
    if (resourceKey && a) {
      const n = Number(a);
      if (!Number.isFinite(n)) {
        push('Invalid number');
        return;
      }
      const civs = gameState.civilizations.map((c, i) =>
        i === me
          ? {
              ...c,
              resources: {
                ...c.resources,
                [resourceKey]: (c.resources[resourceKey] ?? 0) + n,
              },
              lastTurnIncome:
                resourceKey === 'gold'
                  ? c.lastTurnIncome
                  : {
                      ...c.lastTurnIncome,
                      [resourceKey]: (c.lastTurnIncome?.[resourceKey] ?? 0) + n,
                    },
            }
          : c
      );
      onApplyState({ ...gameState, civilizations: civs });
      push(`Added ${n} to ${resourceKey}`);
      setLine('');
      return;
    }
    if ((cmd === 'strategic' || cmd === 'str' || cmd === 'sr') && a && b) {
      const strategicAlias: Record<string, string> = {
        horse: 'horse',
        horses: 'horse',
        iron: 'iron',
        coal: 'coal',
        oil: 'oil',
        uranium: 'uranium',
      };
      const strategicId = strategicAlias[a.toLowerCase()];
      const targetAmount = Number(b);
      if (!strategicId) {
        push('strategic: unknown resource (horse|iron|coal|oil|uranium)');
        return;
      }
      if (!Number.isFinite(targetAmount)) {
        push('strategic: invalid number');
        return;
      }
      const desired = Math.max(0, Math.floor(targetAmount));
      const resDef = NATURAL_RESOURCES[strategicId];
      const requiredImprovement = resDef?.improvement;
      if (!resDef || resDef.type !== 'strategic' || !requiredImprovement) {
        push(`strategic: ${strategicId} is not a valid strategic resource`);
        return;
      }

      const height = gameState.tiles.length;
      const width = gameState.tiles[0]?.length ?? 0;
      const currentTiles: Array<{ q: number; r: number }> = [];
      const eligibleTiles: Array<{ q: number; r: number }> = [];
      for (let r = 0; r < height; r++) {
        for (let q = 0; q < width; q++) {
          const tile = gameState.tiles[r]?.[q];
          if (!tile || tile.owner !== me) continue;
          if (tile.resource === strategicId && tile.improvement === requiredImprovement) currentTiles.push({ q, r });
          if (tile.improvement !== 'none' || tile.city != null) eligibleTiles.push({ q, r });
        }
      }

      const toAdd = Math.max(0, desired - currentTiles.length);
      const toRemove = Math.max(0, currentTiles.length - desired);
      const addCandidates = eligibleTiles.filter(
        pos => !currentTiles.some(cur => cur.q === pos.q && cur.r === pos.r)
      );
      if (toAdd > 0 && addCandidates.length < toAdd) {
        push(`strategic: not enough owned improved tiles (${addCandidates.length} available, need ${toAdd})`);
        return;
      }

      const removeSet = new Set(currentTiles.slice(0, toRemove).map(p => `${p.q}:${p.r}`));
      const addSet = new Set(addCandidates.slice(0, toAdd).map(p => `${p.q}:${p.r}`));
      const tiles = gameState.tiles.map((row, r) =>
        row.map((tile, q) => {
          if (tile.owner !== me) return tile;
          const key = `${q}:${r}`;
          if (removeSet.has(key)) {
            return { ...tile, resource: null };
          }
          if (addSet.has(key)) {
            return {
              ...tile,
              resource: strategicId,
              improvement: requiredImprovement,
            };
          }
          return tile;
        })
      );
      onApplyState({ ...gameState, tiles });
      push(`Strategic ${strategicId} set to ${desired} (was ${currentTiles.length})`);
      setLine('');
      return;
    }
    if (cmd === 'reveal') {
      const tiles = gameState.tiles.map(row =>
        row.map(t => ({
          ...t,
          revealed: t.revealed.map(() => true),
          visible: t.visible.map(() => true),
        }))
      );
      const next = { ...gameState, tiles };
      updateVision(next.tiles, me, next.units, next.cities);
      onApplyState(next);
      push('Full map revealed for human');
      setLine('');
      return;
    }
    if (cmd === 'select' && a) {
      const unitId = Number(a);
      const unit = gameState.units.find(u => u.id === unitId && u.owner === me);
      if (!unit) {
        push('select: unit not found or not owned');
        return;
      }
      onApplyState({
        ...gameState,
        selectedUnitId: unit.id,
        selectedCityId: null,
        selectedTile: { q: unit.q, r: unit.r },
      });
      push(`Selected unit #${unit.id} (${unit.type})`);
      setLine('');
      return;
    }
    if (cmd === 'heal') {
      const target = a ?? 'selected';
      if (target !== 'all' && target !== 'selected') {
        push('heal: use "heal all" or "heal selected"');
        return;
      }
      const units = gameState.units.map(u => {
        if (u.owner !== me) return u;
        if (target === 'selected' && u.id !== gameState.selectedUnitId) return u;
        return { ...u, hp: u.maxHp, movement: u.maxMovement, hasAttacked: false };
      });
      onApplyState({ ...gameState, units });
      push(target === 'all' ? 'Healed all your units' : 'Healed selected unit');
      setLine('');
      return;
    }
    if (cmd === 'kill' && a) {
      const unitId = Number(a);
      if (!Number.isFinite(unitId)) {
        push('kill: invalid unit id');
        return;
      }
      const before = gameState.units.length;
      const units = gameState.units.filter(u => u.id !== unitId);
      if (units.length === before) {
        push('kill: unit not found');
        return;
      }
      const tiles = gameState.tiles.map(row => row.map(tile => (tile.unit === unitId ? { ...tile, unit: null } : tile)));
      const civilizations = gameState.civilizations.map(c => ({ ...c, units: c.units.filter(id => id !== unitId) }));
      onApplyState({
        ...gameState,
        units,
        tiles,
        civilizations,
        selectedUnitId: gameState.selectedUnitId === unitId ? null : gameState.selectedUnitId,
      });
      push(`Removed unit #${unitId}`);
      setLine('');
      return;
    }
    if (cmd === 'tp' && a && b && c) {
      const unitId = Number(a);
      const q = Number(b);
      const r = Number(c);
      if (![unitId, q, r].every(Number.isFinite)) {
        push('tp: usage tp UNIT_ID q r');
        return;
      }
      const unit = gameState.units.find(u => u.id === unitId);
      const tile = gameState.tiles[Math.floor(r)]?.[Math.floor(q)];
      if (!unit || !tile) {
        push('tp: unit or tile not found');
        return;
      }
      const units = gameState.units.map(u => (u.id === unitId ? { ...u, q: Math.floor(q), r: Math.floor(r) } : u));
      onApplyState({ ...gameState, units, selectedTile: { q: Math.floor(q), r: Math.floor(r) } });
      push(`Teleported unit #${unitId} to ${Math.floor(q)},${Math.floor(r)}`);
      setLine('');
      return;
    }
    if (cmd === 'spawn' && a) {
      const type = a as UnitType;
      if (!knownUnits.includes(type)) {
        push(`spawn: unknown type "${a}"`);
        return;
      }
      const q = b ? Number(b) : selectedUnit?.q ?? gameState.cities.find(c => c.owner === me)?.q ?? 0;
      const r = c ? Number(c) : selectedUnit?.r ?? gameState.cities.find(c => c.owner === me)?.r ?? 0;
      if (!Number.isFinite(q) || !Number.isFinite(r) || !gameState.tiles[Math.floor(r)]?.[Math.floor(q)]) {
        push('spawn: invalid coordinates');
        return;
      }
      const def = UNITS[type];
      const id = gameState.nextUnitId;
      const unit = {
        id,
        type: def.id,
        owner: me,
        q: Math.floor(q),
        r: Math.floor(r),
        hp: 100,
        maxHp: 100,
        movement: def.movement,
        maxMovement: def.movement,
        strength: def.strength,
        rangedStrength: def.rangedStrength,
        range: def.range,
        hasAttacked: false,
        promotions: [],
        era: def.era,
        name: def.name,
        greatPersonDefId: null,
      };
      const units = [...gameState.units, unit];
      const civilizations = gameState.civilizations.map((civ, idx) =>
        idx === me ? { ...civ, units: [...civ.units, id] } : civ
      );
      onApplyState({
        ...gameState,
        units,
        civilizations,
        nextUnitId: id + 1,
        selectedUnitId: id,
        selectedTile: { q: Math.floor(q), r: Math.floor(r) },
      });
      push(`Spawned ${type} #${id} at ${Math.floor(q)},${Math.floor(r)}`);
      setLine('');
      return;
    }
    if (cmd === 'msg' && a) {
      const kind = a as GameState['messages'][number]['type'];
      const validKinds = new Set(['info', 'warning', 'city', 'combat', 'tech', 'diplomacy', 'religion', 'disaster', 'wonder', 'tourism', 'espionage']);
      if (!validKinds.has(kind)) {
        push('msg: invalid type');
        return;
      }
      const text = rest.slice(1).join(' ').trim();
      if (!text) {
        push('msg: add text');
        return;
      }
      const nextId = gameState.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      onApplyState({
        ...gameState,
        messages: [{ id: nextId, turn: gameState.turn, type: kind, text }, ...gameState.messages],
      });
      push(`Message posted: ${kind}`);
      setLine('');
      return;
    }
    push(`Unknown: ${cmd}`);
    setLine('');
  }, [gameState, knownUnits, line, me, onApplyState, onClose, onTeleportCamera, onTogglePerf, push, readOnly, selectedUnit]);

  return (
    <div className="fixed bottom-24 left-4 z-[300] w-[min(96vw,520px)] rounded-xl border border-amber-700/45 bg-black/95 p-3 text-xs text-stone-200 shadow-2xl max-md:bottom-[max(6rem,env(safe-area-inset-bottom,0px))] max-md:left-2">
      <GnozianPanelCorners inset={4} size={28} />
      <div className="relative z-10 mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-bold text-amber-500">
          <GnozianGlyph name="keyboard" size={14} className="text-amber-400/90" />
          {t('devConsole.title')}
        </span>
        <button type="button" className="text-stone-500 hover:text-white" onClick={onClose}>×</button>
      </div>
      <div className="relative z-10 mb-2 grid grid-cols-2 gap-2 rounded border border-stone-800/70 bg-stone-950/70 px-2 py-1.5 text-[10px]">
        <div>
          <div className="text-stone-500">{t('devConsole.quickStats')}</div>
          <div className="font-mono text-amber-200">T{gameState.turn} · {gameState.world.hour}:00 · {gameState.world.weather}</div>
          <div className="font-mono text-stone-300">g {Math.round(humanCiv.resources.gold)} · s {Math.round(humanCiv.resources.science)} · c {Math.round(humanCiv.resources.culture)}</div>
        </div>
        <div className="text-right">
          <div className="text-stone-500">{t('devConsole.commands')}</div>
          <div className="font-mono text-stone-300">{t('devConsole.hintLine1')}</div>
          <div className="font-mono text-stone-300">{t('devConsole.hintLine2')}</div>
        </div>
      </div>
      <div className="relative z-10 mb-2 max-h-28 overflow-y-auto rounded border border-stone-800/70 bg-stone-950/70 p-2 font-mono text-[10px] text-stone-400">
        {log.map((x, i) => (
          <div key={i}>{x}</div>
        ))}
      </div>
      <form
        className="relative z-10 flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          run();
        }}
      >
        <input
          value={line}
          onChange={e => setLine(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          className="flex-1 rounded border border-stone-700 bg-stone-900 px-2 py-1 text-stone-100"
          placeholder={t('devConsole.placeholder')}
          spellCheck={false}
          disabled={readOnly}
        />
        <button
          type="submit"
          className="rounded bg-amber-800 px-2 py-1 font-bold text-white disabled:opacity-40"
          disabled={readOnly}
        >
          {t('devConsole.run')}
        </button>
      </form>
      {perfOn && (
        <div className="relative z-10 mt-2 rounded border border-stone-700 bg-stone-950/80 px-2 py-1 font-mono text-amber-200">
          FPS ~ {fpsRef.current.fps}
          {liveCamera && (
            <span className="ml-2 text-stone-500">
              cam {Math.round(liveCamera.x)} {Math.round(liveCamera.y)} z{liveCamera.zoom.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
