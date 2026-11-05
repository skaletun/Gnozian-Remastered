import type { Unit } from './types';
import { gridToScreen } from './hexMetrics';
import { hexDistance } from './mapgen';

type UnitAnimState = 'idle' | 'move' | 'attack' | 'hit' | 'death' | 'build' | 'celebrate';

interface UnitAnimMemory {
  q: number;
  r: number;
  fromQ: number;
  fromR: number;
  hp: number;
  promotionsCount: number;
  hasAttacked: boolean;
  state: UnitAnimState;
  stateStartedMs: number;
  stateUntilMs: number;
  headingRadians: number;
}

export interface UnitVisualPose {
  state: UnitAnimState;
  visualQ: number;
  visualR: number;
  yOffset: number;
  scale: number;
  wobble: number;
  headingRadians: number;
  stateProgress: number;
}

const memory = new Map<number, UnitAnimMemory>();

interface GaitProfile {
  idleFreq: number;
  idleAmp: number;
  moveFreq: number;
  moveAmp: number;
  moveScaleAmp: number;
  wobbleFreq: number;
  wobbleAmp: number;
}

function gaitProfile(unit: Unit): GaitProfile {
  const t = unit.type;
  if (t === 'fighter' || t === 'bomber' || t === 'nuclear_missile') {
    return { idleFreq: 5.2, idleAmp: 0.8, moveFreq: 15.5, moveAmp: 1.25, moveScaleAmp: 0.08, wobbleFreq: 12, wobbleAmp: 0.06 };
  }
  if (t === 'catapult' || t === 'cannon' || t === 'artillery') {
    return { idleFreq: 2.6, idleAmp: 0.8, moveFreq: 9, moveAmp: 1.1, moveScaleAmp: 0.03, wobbleFreq: 7.5, wobbleAmp: 0.045 };
  }
  if (t === 'horseman' || t === 'knight' || t === 'cavalry' || t === 'tank') {
    return { idleFreq: 3.9, idleAmp: 1.45, moveFreq: 16, moveAmp: 2.3, moveScaleAmp: 0.06, wobbleFreq: 11, wobbleAmp: 0.09 };
  }
  if (t === 'worker' || t === 'settler' || t === 'missionary' || t === 'scout') {
    return { idleFreq: 3, idleAmp: 0.95, moveFreq: 10, moveAmp: 1.25, moveScaleAmp: 0.03, wobbleFreq: 8.4, wobbleAmp: 0.055 };
  }
  return { idleFreq: 3.6, idleAmp: 1.15, moveFreq: 14, moveAmp: 1.8, moveScaleAmp: 0.05, wobbleFreq: 10, wobbleAmp: 0.08 };
}

function classifyState(unit: Unit, prev: UnitAnimMemory | undefined, nowMs: number): UnitAnimState {
  if (unit.hp <= 0) return 'death';
  if (!prev) return 'idle';
  const stillTweeningSameDestination =
    prev.state === 'move' && nowMs < prev.stateUntilMs && prev.q === unit.q && prev.r === unit.r;
  if (stillTweeningSameDestination) return 'move';
  if (unit.q !== prev.q || unit.r !== prev.r) return 'move';
  if (!prev.hasAttacked && unit.hasAttacked) return 'attack';
  if (unit.hp < prev.hp) return 'hit';
  if (unit.type === 'worker' && unit.movement <= 0) return 'build';
  if (unit.promotions.length > prev.promotionsCount && unit.hp > 0) return 'celebrate';
  if (prev.stateUntilMs > nowMs) return prev.state;
  return 'idle';
}

function stateDurationMs(state: UnitAnimState): number {
  switch (state) {
    case 'move':
      return 360;
    case 'attack':
      return 220;
    case 'hit':
      return 260;
    case 'death':
      return 360;
    case 'build':
      return 260;
    case 'celebrate':
      return 320;
    default:
      return 180;
  }
}

function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

export function getUnitVisualPose(unit: Unit, nowMs: number, zoom: number): UnitVisualPose {
  const prev = memory.get(unit.id);
  const nextState = classifyState(unit, prev, nowMs);
  const state = prev && prev.stateUntilMs > nowMs && prev.state === nextState ? prev.state : nextState;
  const continuing = !!prev && prev.state === state && prev.stateUntilMs > nowMs;
  const moved = prev ? unit.q !== prev.q || unit.r !== prev.r : false;

  let moveDurationMs = stateDurationMs(state);
  if (state === 'move' && moved && prev && !continuing) {
    const dist = Math.max(1, hexDistance(prev.q, prev.r, unit.q, unit.r));
    moveDurationMs = 260 + Math.min(640, (dist - 1) * 95);
  }

  const stateStartedMs = continuing ? prev.stateStartedMs : nowMs;
  const until = continuing ? prev.stateUntilMs : state === 'move' && moved && prev ? nowMs + moveDurationMs : nowMs + stateDurationMs(state);
  /** Screen-space travel bearing (matches gridToScreen / camera pan), zoom-invariant. */
  let headingRadians = prev?.headingRadians ?? 0;
  if (moved && prev) {
    const p0 = gridToScreen(prev.q, prev.r, zoom);
    const p1 = gridToScreen(unit.q, unit.r, zoom);
    headingRadians = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  }
  const fromQ = moved && prev ? prev.q : (continuing ? prev.fromQ : unit.q);
  const fromR = moved && prev ? prev.r : (continuing ? prev.fromR : unit.r);
  memory.set(unit.id, {
    q: unit.q,
    r: unit.r,
    fromQ,
    fromR,
    hp: unit.hp,
    promotionsCount: unit.promotions.length,
    hasAttacked: unit.hasAttacked,
    state,
    stateStartedMs,
    stateUntilMs: until,
    headingRadians,
  });
  const stateProgress = Math.max(0, Math.min(1, (nowMs - stateStartedMs) / Math.max(1, until - stateStartedMs)));
  const moveEase = easeOutCubic(stateProgress);
  const visualQ = state === 'move' ? fromQ + (unit.q - fromQ) * moveEase : unit.q;
  const visualR = state === 'move' ? fromR + (unit.r - fromR) * moveEase : unit.r;
  const t = nowMs / 1000;
  const gait = gaitProfile(unit);
  const idleBob = state === 'idle' ? Math.sin(t * gait.idleFreq + unit.id * 0.37) * gait.idleAmp * zoom : 0;
  switch (state) {
    case 'move':
      return {
        state,
        visualQ,
        visualR,
        yOffset: -Math.sin(stateProgress * Math.PI) * gait.moveAmp * zoom,
        scale: 1 + Math.sin(t * gait.moveFreq + unit.id) * gait.moveScaleAmp,
        wobble: Math.sin(t * gait.wobbleFreq + unit.id * 0.9) * gait.wobbleAmp,
        headingRadians,
        stateProgress,
      };
    case 'attack':
      return {
        state,
        visualQ,
        visualR,
        yOffset: idleBob - Math.abs(Math.sin(t * 16)) * 2.2 * zoom,
        scale: 1 + Math.abs(Math.sin(t * 16)) * 0.09,
        wobble: Math.sin(t * 12) * 0.12,
        headingRadians,
        stateProgress,
      };
    case 'hit':
      return {
        state,
        visualQ,
        visualR,
        yOffset: idleBob + Math.sin(t * 24) * 1.1 * zoom,
        scale: 1 - Math.abs(Math.sin(t * 24)) * 0.08,
        wobble: Math.sin(t * 24) * 0.14,
        headingRadians,
        stateProgress,
      };
    case 'death':
      return {
        state,
        visualQ,
        visualR,
        yOffset: idleBob + 2.8 * zoom,
        scale: 0.84,
        wobble: 0,
        headingRadians,
        stateProgress,
      };
    case 'build':
      return {
        state,
        visualQ,
        visualR,
        yOffset: idleBob + Math.sin(t * 9) * 0.9 * zoom,
        scale: 1 + Math.sin(t * 9) * 0.03,
        wobble: Math.sin(t * 7) * 0.07,
        headingRadians,
        stateProgress,
      };
    case 'celebrate':
      return {
        state,
        visualQ,
        visualR,
        yOffset: idleBob - Math.abs(Math.sin(t * 8)) * 1.5 * zoom,
        scale: 1 + Math.abs(Math.sin(t * 8)) * 0.07,
        wobble: Math.sin(t * 7) * 0.09,
        headingRadians,
        stateProgress,
      };
    default:
      return {
        state: 'idle',
        visualQ,
        visualR,
        yOffset: idleBob,
        scale: 1,
        wobble: Math.sin(t * 4 + unit.id * 0.41) * 0.04,
        headingRadians,
        stateProgress,
      };
  }
}

