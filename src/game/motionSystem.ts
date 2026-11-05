export interface MotionChannelState {
  value: number;
  velocity: number;
  lastTimeMs: number;
}

const channels = new Map<string, MotionChannelState>();

export function resetMotionChannels(): void {
  channels.clear();
}

/**
 * Critically damped spring approximation for stable UI/world animation values.
 */
export function springChannel(
  key: string,
  target: number,
  timeMs: number,
  opts?: { stiffness?: number; damping?: number; snapEpsilon?: number }
): number {
  const stiffness = opts?.stiffness ?? 18;
  const damping = opts?.damping ?? 0.82;
  const snapEpsilon = opts?.snapEpsilon ?? 0.0008;
  const prev = channels.get(key) ?? { value: target, velocity: 0, lastTimeMs: timeMs };
  const dt = Math.max(0.001, Math.min(0.05, (timeMs - prev.lastTimeMs) / 1000));
  const force = (target - prev.value) * stiffness;
  const vel = (prev.velocity + force * dt) * damping;
  const value = prev.value + vel * dt * 60;
  const close = Math.abs(target - value) <= snapEpsilon && Math.abs(vel) <= snapEpsilon;
  const next: MotionChannelState = close
    ? { value: target, velocity: 0, lastTimeMs: timeMs }
    : { value, velocity: vel, lastTimeMs: timeMs };
  channels.set(key, next);
  return next.value;
}

