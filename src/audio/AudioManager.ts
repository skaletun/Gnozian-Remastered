/**
 * Menu BGM (wav asset) + in-game ambient + Web Audio SFX.
 * Volumes follow game settings; call resumeAudioContext() after first user gesture if needed.
 */
import type { Era, GameMessage } from '../game/types';
import { assetUrl } from '../utils/assetUrl';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

export type AudioVolumeSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
};

let volumes: AudioVolumeSettings = {
  masterVolume: 1,
  musicVolume: 0.7,
  sfxVolume: 0.8,
};

/** Base music master when current track mode was started. */
let menuMusicLevel = 0.32;
let gameMusicLevel = 0.24;
let menuTrackEl: HTMLAudioElement | null = null;
let menuTrackRetryBound = false;
let currentMusicMode: 'menu' | 'game' | null = null;

let menuMusicGain: GainNode | null = null;
let menuMusicCleanup: (() => void) | null = null;

let gameMusicGain: GainNode | null = null;
let gameMusicCleanup: (() => void) | null = null;

export function setAudioVolumes(v: Partial<AudioVolumeSettings>): void {
  volumes = { ...volumes, ...v };
  const m = volumes.masterVolume * volumes.musicVolume;
  const activeLevel = currentMusicMode === 'game' ? gameMusicLevel : menuMusicLevel;
  if (menuTrackEl) {
    menuTrackEl.volume = Math.max(0, Math.min(1, activeLevel * m));
  }
  if (menuMusicGain) menuMusicGain.gain.value = menuMusicLevel * m;
  if (gameMusicGain) gameMusicGain.gain.value = gameMusicLevel * m;
}

function musicMasterGain(): number {
  return volumes.masterVolume * volumes.musicVolume;
}

function ensureBackgroundTrack(mode: 'menu' | 'game'): void {
  if (typeof window === 'undefined') return;
  const sameMode = currentMusicMode === mode;
  currentMusicMode = mode;
  const baseLevel = mode === 'menu' ? menuMusicLevel : gameMusicLevel;
  if (!menuTrackEl) {
    const music = new Audio(assetUrl('background-music.wav'));
    music.loop = true;
    music.preload = 'auto';
    menuTrackEl = music;
  }
  menuTrackEl.volume = Math.max(0, Math.min(1, baseLevel * musicMasterGain()));

  const tryPlay = () => {
    if (!menuTrackEl) return;
    void menuTrackEl.play().catch(() => {
      /* autoplay may be blocked until first user interaction */
    });
  };

  if (!sameMode && menuTrackEl.paused) tryPlay();
  if (!sameMode && menuTrackEl && !menuTrackEl.paused) {
    // Mode switched while same file continues; keep playback seamless.
    menuTrackEl.volume = Math.max(0, Math.min(1, baseLevel * musicMasterGain()));
  }
  if (!menuTrackRetryBound) {
    const retry = () => {
      if (!menuTrackEl) return;
      if (!menuTrackEl.paused) return;
      void menuTrackEl.play().catch(() => {});
    };
    window.addEventListener('pointerdown', retry, { passive: true });
    window.addEventListener('keydown', retry);
    menuTrackRetryBound = true;
  }
}

export function startMenuMusic(): void {
  ensureBackgroundTrack('menu');
}

export function startGameMusic(): void {
  ensureBackgroundTrack('game');
}

export function stopMenuMusic(): void {
  if (currentMusicMode === 'game') return;
  currentMusicMode = null;
  if (menuTrackEl) {
    try {
      menuTrackEl.pause();
      menuTrackEl.currentTime = 0;
      menuTrackEl.src = '';
    } catch {
      /* */
    }
    menuTrackEl = null;
  }
  menuMusicCleanup?.();
  menuMusicCleanup = null;
  menuMusicGain = null;
}

// ---- In-game BGM ----

function createNoiseBuffer(c: AudioContext, lenSec: number): AudioBuffer {
  const rate = c.sampleRate;
  const len = Math.floor(rate * lenSec);
  const buf = c.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function setAmbientFromEraAndHour(era: Era, hour: number): void {
  void era;
  void hour;
  startGameMusic();
}

function stopAmbientInternal(): void {
  gameMusicCleanup?.();
  gameMusicCleanup = null;
  gameMusicGain = null;
}

export function stopAmbient(): void {
  if (currentMusicMode !== 'game') return;
  currentMusicMode = null;
  if (menuTrackEl) {
    try {
      menuTrackEl.pause();
      menuTrackEl.currentTime = 0;
      menuTrackEl.src = '';
    } catch {
      /* */
    }
    menuTrackEl = null;
  }
  stopAmbientInternal();
}

export function resumeAudioContext(): void {
  void getCtx()?.resume?.();
}

// ---- SFX helpers ----
/** ADSR on gain param: attack → peak, decay → sustain, then release to ~0. */
function envelopeADSR(
  gain: GainNode,
  t0: number,
  peak: number,
  attack: number,
  decay: number,
  sustainLevel: number,
  release: number
): void {
  const g = gain.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.exponentialRampToValueAtTime(Math.max(0.0002, sustainLevel), t0 + attack + decay);
  const hold = Math.max(0.01, release * 0.25);
  g.setValueAtTime(Math.max(0.0002, sustainLevel), t0 + attack + decay + hold);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay + hold + release);
}

const genericSfxLastAt = new Map<string, number>();

function sfxGate(key: string, minDeltaMs: number): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const prev = genericSfxLastAt.get(key) ?? 0;
  if (now - prev < minDeltaMs) return false;
  genericSfxLastAt.set(key, now);
  return true;
}

function createSfxMaster(c: AudioContext): GainNode {
  const master = c.createGain();
  master.gain.value = volumes.masterVolume * volumes.sfxVolume;
  master.connect(c.destination);
  return master;
}

export function playUiClick(): void {
  if (!sfxGate('ui-click', 18)) return;
  const c = getCtx();
  if (!c || c.state === 'suspended') void c?.resume?.();
  if (!c) return;
  const t0 = c.currentTime;
  const master = createSfxMaster(c);

  const body = c.createGain();
  envelopeADSR(body, t0, 0.09, 0.004, 0.025, 0.028, 0.055);
  body.connect(master);
  const o1 = c.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(620, t0);
  o1.frequency.exponentialRampToValueAtTime(880, t0 + 0.05);
  o1.connect(body);
  o1.start(t0);
  o1.stop(t0 + 0.09);

  const tick = c.createGain();
  envelopeADSR(tick, t0 + 0.008, 0.05, 0.002, 0.012, 0.015, 0.028);
  tick.connect(master);
  const o2 = c.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = 2100;
  o2.connect(tick);
  o2.start(t0 + 0.008);
  o2.stop(t0 + 0.04);
}

export function playEndTurnChime(): void {
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);

  const notes = [392, 493.88, 587.33, 783.99];
  const durs = [0.1, 0.1, 0.1, 0.22];
  let t = t0;
  notes.forEach((freq, i) => {
    const g = c.createGain();
    envelopeADSR(g, t, 0.15, 0.018, 0.05, 0.09, 0.12);
    g.connect(master);
    const o = c.createOscillator();
    o.type = i < 3 ? 'triangle' : 'sine';
    o.frequency.value = freq;
    o.connect(g);
    o.start(t);
    o.stop(t + durs[i] + 0.15);
    t += durs[i];
  });
}

export function playAchievementUnlock(): void {
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);

  const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 880];
  let t = t0;
  seq.forEach((f) => {
    const g = c.createGain();
    envelopeADSR(g, t, 0.11, 0.015, 0.04, 0.06, 0.1);
    g.connect(master);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 0.2);
    t += 0.055;
  });
  const sh = c.createGain();
  envelopeADSR(sh, t0 + 0.15, 0.07, 0.04, 0.12, 0.03, 0.22);
  sh.connect(master);
  const buf = createNoiseBuffer(c, 0.15);
  const ns = c.createBufferSource();
  ns.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 0.9;
  ns.connect(bp);
  bp.connect(sh);
  ns.start(t0 + 0.15);
  ns.stop(t0 + 0.45);
}

const sfxLastAt = new Map<GameMessage['type'], number>();
const SFX_DEBOUNCE_MS = 120;

/** Layered stingers per notification type. */
export function playGameMessageSfx(kind: GameMessage['type']): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const prev = sfxLastAt.get(kind) ?? 0;
  if (now - prev < SFX_DEBOUNCE_MS) return;
  sfxLastAt.set(kind, now);

  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);

  const tone = (freq: number, dur: number, delay: number, type: OscillatorType, peak: number) => {
    const g = c.createGain();
    const start = t0 + delay;
    envelopeADSR(g, start, peak, 0.008, dur * 0.32, peak * 0.5, dur * 0.55);
    g.connect(master);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0 + delay);
    o.connect(g);
    o.start(t0 + delay);
    o.stop(t0 + delay + dur + 0.08);
  };

  const noiseHit = (peak: number, delay: number, dur: number, freq: number) => {
    const g = c.createGain();
    const start = t0 + delay;
    envelopeADSR(g, start, peak, 0.003, dur * 0.35, peak * 0.28, dur * 0.5);
    g.connect(master);
    const buf = createNoiseBuffer(c, dur + 0.02);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    src.connect(f);
    f.connect(g);
    src.start(t0 + delay);
    src.stop(t0 + delay + dur + 0.02);
  };

  switch (kind) {
    case 'combat':
      noiseHit(0.22, 0, 0.14, 420);
      tone(180, 0.07, 0.02, 'square', 0.1);
      tone(95, 0.12, 0.06, 'sawtooth', 0.08);
      tone(55, 0.16, 0.11, 'triangle', 0.07);
      break;
    case 'city':
      tone(349.23, 0.1, 0, 'triangle', 0.09);
      tone(440, 0.14, 0.09, 'triangle', 0.1);
      tone(523.25, 0.1, 0.2, 'sine', 0.07);
      break;
    case 'tech':
      tone(392, 0.08, 0, 'sine', 0.09);
      tone(523.25, 0.09, 0.07, 'sine', 0.1);
      tone(659.25, 0.11, 0.14, 'triangle', 0.11);
      tone(783.99, 0.12, 0.22, 'sine', 0.08);
      break;
    case 'warning':
      tone(330, 0.12, 0, 'triangle', 0.11);
      tone(277.18, 0.16, 0.1, 'triangle', 0.12);
      tone(220, 0.2, 0.2, 'sawtooth', 0.08);
      break;
    case 'diplomacy':
      tone(493.88, 0.08, 0, 'sine', 0.08);
      tone(415.3, 0.1, 0.07, 'sine', 0.08);
      tone(523.25, 0.12, 0.14, 'triangle', 0.07);
      break;
    case 'info':
      tone(523.25, 0.07, 0, 'sine', 0.08);
      tone(659.25, 0.06, 0.06, 'sine', 0.06);
      break;
    case 'wonder':
      tone(392, 0.18, 0, 'triangle', 0.1);
      tone(523.25, 0.22, 0.12, 'triangle', 0.11);
      tone(659.25, 0.2, 0.28, 'sine', 0.09);
      noiseHit(0.05, 0.35, 0.2, 1800);
      break;
    case 'religion':
      tone(523.25, 0.15, 0, 'sine', 0.08);
      tone(659.25, 0.2, 0.12, 'sine', 0.09);
      tone(783.99, 0.25, 0.24, 'triangle', 0.08);
      break;
    case 'disaster':
      noiseHit(0.28, 0, 0.35, 200);
      tone(73.42, 0.4, 0.05, 'sawtooth', 0.12);
      tone(55, 0.35, 0.15, 'square', 0.09);
      break;
    case 'tourism':
      tone(880, 0.1, 0, 'sine', 0.08);
      tone(987.77, 0.12, 0.08, 'sine', 0.09);
      tone(1174.66, 0.1, 0.18, 'triangle', 0.07);
      break;
    case 'espionage':
      tone(233.08, 0.06, 0, 'square', 0.07);
      tone(196, 0.07, 0.06, 'square', 0.06);
      noiseHit(0.08, 0.1, 0.08, 900);
      break;
    default:
      tone(392, 0.06, 0, 'sine', 0.07);
      tone(523.25, 0.05, 0.06, 'sine', 0.06);
  }
}

export function playUiOpen(): void {
  if (!sfxGate('ui-open', 80)) return;
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);
  const notes = [392, 493.88, 587.33];
  notes.forEach((freq, i) => {
    const g = c.createGain();
    const at = t0 + i * 0.028;
    envelopeADSR(g, at, 0.08, 0.01, 0.03, 0.036, 0.08);
    g.connect(master);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.connect(g);
    o.start(at);
    o.stop(at + 0.14);
  });
}

export function playUiClose(): void {
  if (!sfxGate('ui-close', 80)) return;
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);
  const notes = [587.33, 493.88, 392];
  notes.forEach((freq, i) => {
    const g = c.createGain();
    const at = t0 + i * 0.024;
    envelopeADSR(g, at, 0.065, 0.008, 0.03, 0.028, 0.075);
    g.connect(master);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    o.start(at);
    o.stop(at + 0.12);
  });
}

export function playUiConfirm(): void {
  if (!sfxGate('ui-confirm', 55)) return;
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);
  const g = c.createGain();
  envelopeADSR(g, t0, 0.1, 0.01, 0.03, 0.045, 0.09);
  g.connect(master);
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(620, t0);
  o.frequency.exponentialRampToValueAtTime(930, t0 + 0.09);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + 0.12);
}

export function playUiError(): void {
  if (!sfxGate('ui-error', 70)) return;
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);
  const g = c.createGain();
  envelopeADSR(g, t0, 0.09, 0.006, 0.04, 0.03, 0.11);
  g.connect(master);
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, t0);
  o.frequency.exponentialRampToValueAtTime(160, t0 + 0.11);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + 0.14);
}

export function playUnitSelectSfx(): void {
  if (!sfxGate('unit-select', 45)) return;
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);
  const g = c.createGain();
  envelopeADSR(g, t0, 0.085, 0.005, 0.03, 0.03, 0.07);
  g.connect(master);
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(420, t0);
  o.frequency.exponentialRampToValueAtTime(560, t0 + 0.06);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + 0.1);
}

export function playUnitMoveSfx(): void {
  if (!sfxGate('unit-move', 70)) return;
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);
  const hit = (delay: number, freq: number, peak: number) => {
    const at = t0 + delay;
    const g = c.createGain();
    envelopeADSR(g, at, peak, 0.004, 0.02, peak * 0.4, 0.06);
    g.connect(master);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(freq * 0.74, at + 0.055);
    o.connect(g);
    o.start(at);
    o.stop(at + 0.08);
  };
  hit(0, 160, 0.08);
  hit(0.065, 140, 0.07);
}

export function playCombatImpactSfx(): void {
  if (!sfxGate('combat-impact', 90)) return;
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);
  const g = c.createGain();
  envelopeADSR(g, t0, 0.16, 0.003, 0.05, 0.05, 0.11);
  g.connect(master);
  const buf = createNoiseBuffer(c, 0.2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 460;
  bp.Q.value = 1.1;
  src.connect(bp);
  bp.connect(g);
  src.start(t0);
  src.stop(t0 + 0.17);
}

export function playCityFoundedSfx(): void {
  if (!sfxGate('city-founded', 120)) return;
  const c = getCtx();
  if (!c) return;
  void c.resume?.();
  const t0 = c.currentTime;
  const master = createSfxMaster(c);
  const notes = [261.63, 329.63, 392];
  notes.forEach((freq, i) => {
    const at = t0 + i * 0.05;
    const g = c.createGain();
    envelopeADSR(g, at, 0.1, 0.012, 0.045, 0.04, 0.1);
    g.connect(master);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.connect(g);
    o.start(at);
    o.stop(at + 0.18);
  });
}

export function playTechCompleteSfx(): void {
  if (!sfxGate('tech-complete', 120)) return;
  playGameMessageSfx('tech');
}
