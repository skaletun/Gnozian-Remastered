import type { GameMessage, GameState } from './types';
import { gridToScreen, TILE_HALF_W } from './hexMetrics';

type FxKind = 'spark' | 'mist' | 'pulse';
type ProjectileKind = 'arrow' | 'shell' | 'rocket';
type DecalKind = 'scorch' | 'splash' | 'crack';

interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: FxKind;
  /** Ambient buckets: cleared before the next cycle so effects do not accumulate. */
  ambientTag?: 'weather' | 'disasterAmbient';
}

interface FxProjectile {
  wx: number;
  wy: number;
  wtx: number;
  wty: number;
  progress: number;
  speed: number;
  arc: number;
  color: string;
  life: number;
  kind: ProjectileKind;
  trailColor: string;
  width: number;
}

interface FxShockwave {
  wx: number;
  wy: number;
  radius: number;
  radiusSpeed: number;
  life: number;
  maxLife: number;
  color: string;
}

interface UnitFxMemory {
  q: number;
  r: number;
  hp: number;
  hasAttacked: boolean;
}

interface FxDecal {
  wx: number;
  wy: number;
  kind: DecalKind;
  size: number;
  life: number;
  maxLife: number;
  rotation: number;
}

const particles: FxParticle[] = [];
const projectiles: FxProjectile[] = [];
const shockwaves: FxShockwave[] = [];
const decals: FxDecal[] = [];
const processedCombat = new Set<number>();
const MAX_PROCESSED_COMBAT_IDS = 400;
const unitMemory = new Map<number, UnitFxMemory>();
let lastTime = 0;
let lastWeatherBucket = -1;
let lastDisasterAmbientBucket = -1;

function stripAmbientParticles(tag: NonNullable<FxParticle['ambientTag']>): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i]!.ambientTag === tag) particles.splice(i, 1);
  }
}

export function resetVisualFxPipeline(): void {
  particles.length = 0;
  projectiles.length = 0;
  shockwaves.length = 0;
  decals.length = 0;
  processedCombat.clear();
  unitMemory.clear();
  lastTime = 0;
  lastWeatherBucket = -1;
  lastDisasterAmbientBucket = -1;
}

function rememberCombatMessage(id: number): void {
  processedCombat.add(id);
  while (processedCombat.size > MAX_PROCESSED_COMBAT_IDS) {
    const first = processedCombat.values().next().value as number | undefined;
    if (first === undefined) break;
    processedCombat.delete(first);
  }
}

function pushParticle(p: FxParticle, max: number): void {
  if (particles.length >= max) particles.shift();
  particles.push(p);
}

function pushProjectile(p: FxProjectile, max: number): void {
  if (projectiles.length >= max) projectiles.shift();
  projectiles.push(p);
}

function pushShockwave(w: FxShockwave, max: number): void {
  if (shockwaves.length >= max) shockwaves.shift();
  shockwaves.push(w);
}

function pushDecal(d: FxDecal, max: number): void {
  if (decals.length >= max) decals.shift();
  decals.push(d);
}

function hash(seed: number): number {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return Math.abs(x);
}

function randomFrom(seed: number, n: number): number {
  return (hash(seed + n * 137) % 1000) / 1000;
}

function isVisibleFor(tile: GameState['tiles'][number][number] | undefined, civIndex: number): boolean {
  if (!tile) return false;
  const i = Math.max(0, civIndex | 0);
  return !!tile.visible?.[i] || !!tile.revealed?.[i];
}

function spawnCombatBurst(
  state: GameState,
  msg: GameMessage,
  camera: { x: number; y: number; zoom: number },
  maxParticles: number,
  localViewerCivIndex: number
): void {
  const visUnits = state.units.filter(u => {
    const t = state.tiles[u.r]?.[u.q];
    return isVisibleFor(t, localViewerCivIndex);
  });
  if (!visUnits.length) return;
  const idx = hash(msg.id) % visUnits.length;
  const u = visUnits[idx]!;
  const p = gridToScreen(u.q, u.r, camera.zoom);
  const sx = p.x - camera.x;
  const sy = p.y - camera.y;
  for (let i = 0; i < 7; i++) {
    const a = randomFrom(msg.id, i) * Math.PI * 2;
    const sp = 0.6 + randomFrom(msg.id + 11, i) * 1.5;
    pushParticle(
      {
        x: sx,
        y: sy - 10 * camera.zoom,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.5 - 0.8,
        size: 1.5 + randomFrom(msg.id + 7, i) * 1.8,
        life: 0.55,
        maxLife: 0.55,
        color: 'rgba(255, 220, 150, 0.92)',
        kind: 'spark',
      },
      maxParticles
    );
  }
}

function spawnWeather(state: GameState, timeMs: number, canvasW: number, maxParticles: number): void {
  const wx = state.world?.weather ?? 'clear';
  if (wx === 'clear') {
    stripAmbientParticles('weather');
    lastWeatherBucket = -1;
    return;
  }
  const interval = wx === 'storm' ? 65 : wx === 'rain' ? 95 : 120;
  const bucket = Math.floor(timeMs / interval);
  if (bucket === lastWeatherBucket) return;
  stripAmbientParticles('weather');
  lastWeatherBucket = bucket;
  const amount = wx === 'storm' ? 7 : wx === 'rain' ? 5 : 4;
  for (let i = 0; i < amount; i++) {
    const x = randomFrom(bucket * 31 + i * 97, i + 3) * canvasW;
    const jitter = randomFrom(bucket * 11 + i * 17, i + 8);
    pushParticle(
      {
        x,
        y: -8 + jitter * 30,
        vx: (randomFrom(bucket * 53 + i * 19, i + 4) - 0.5) * (wx === 'storm' ? 1.9 : 0.72),
        vy: 0.65 + randomFrom(bucket * 47 + i * 13, i + 6) * 0.95,
        size: wx === 'snow' ? 2.2 + randomFrom(bucket * 23 + i * 7, i + 10) * 3 : 1.3 + randomFrom(bucket * 29 + i * 9, i + 12) * 1.6,
        life: wx === 'snow' ? 1.15 : 0.82,
        maxLife: wx === 'snow' ? 1.15 : 0.82,
        color: wx === 'snow' ? 'rgba(245,250,255,0.9)' : 'rgba(170,220,255,0.7)',
        kind: wx === 'snow' ? 'mist' : 'spark',
        ambientTag: 'weather',
      },
      maxParticles
    );
  }
}

function spawnShockwaveAt(worldX: number, worldY: number, color: string, maxShockwaves: number): void {
  pushShockwave(
    {
      wx: worldX,
      wy: worldY,
      radius: 5,
      radiusSpeed: 58,
      life: 0.5,
      maxLife: 0.5,
      color,
    },
    maxShockwaves
  );
}

function spawnImpactDecal(worldX: number, worldY: number, kind: DecalKind, size: number, maxDecals: number): void {
  pushDecal(
    {
      wx: worldX,
      wy: worldY,
      kind,
      size,
      life: 3.8,
      maxLife: 3.8,
      rotation: randomFrom((worldX | 0) ^ (worldY | 0), kind.length) * Math.PI * 2,
    },
    maxDecals
  );
}

function pickEnemyTarget(state: GameState, attacker: GameState['units'][number], localViewerCivIndex: number): GameState['units'][number] | undefined {
  let best: GameState['units'][number] | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const enemy of state.units) {
    if (enemy.owner === attacker.owner || enemy.hp <= 0) continue;
    const t = state.tiles[enemy.r]?.[enemy.q];
    if (!isVisibleFor(t, localViewerCivIndex)) continue;
    const d = Math.abs(enemy.q - attacker.q) + Math.abs(enemy.r - attacker.r);
    const maxRange = Math.max(2, attacker.range + 2);
    if (d > maxRange) continue;
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

function spawnAttackProjectile(
  state: GameState,
  attacker: GameState['units'][number],
  camera: { x: number; y: number; zoom: number },
  maxProjectiles: number,
  localViewerCivIndex: number
): void {
  const target = pickEnemyTarget(state, attacker, localViewerCivIndex);
  if (!target) return;
  const a = gridToScreen(attacker.q, attacker.r, camera.zoom);
  const b = gridToScreen(target.q, target.r, camera.zoom);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const isSiege = attacker.type === 'catapult' || attacker.type === 'cannon' || attacker.type === 'artillery';
  const isAir = attacker.type === 'fighter' || attacker.type === 'bomber';
  const kind: ProjectileKind = isAir ? 'rocket' : isSiege ? 'shell' : 'arrow';
  pushProjectile(
    {
      wx: a.x,
      wy: a.y - 12 * camera.zoom,
      wtx: b.x,
      wty: b.y - 10 * camera.zoom,
      progress: 0,
      speed: isAir ? 2.4 : isSiege ? 1.15 : Math.max(1.2, Math.min(2.1, 460 / len)),
      arc: isSiege ? 24 * camera.zoom : isAir ? 8 * camera.zoom : 13 * camera.zoom,
      color: isSiege ? 'rgba(255,180,120,0.95)' : isAir ? 'rgba(170,230,255,0.95)' : 'rgba(255,225,165,0.95)',
      life: 0.9,
      kind,
      trailColor:
        kind === 'rocket'
          ? 'rgba(160,230,255,0.7)'
          : kind === 'shell'
            ? 'rgba(255,180,120,0.6)'
            : 'rgba(245,220,160,0.45)',
      width: kind === 'rocket' ? 2.3 : kind === 'shell' ? 2 : 1.35,
    },
    maxProjectiles
  );
}

function spawnDisasterAmbient(
  state: GameState,
  timeMs: number,
  camera: { x: number; y: number; zoom: number },
  localViewerCivIndex: number,
  maxParticles: number
): void {
  const bucket = Math.floor(timeMs / 110);
  if (bucket === lastDisasterAmbientBucket) return;
  stripAmbientParticles('disasterAmbient');
  lastDisasterAmbientBucket = bucket;
  for (const d of state.systems?.disasters ?? []) {
    const tile = state.tiles[d.r]?.[d.q];
    if (!isVisibleFor(tile, localViewerCivIndex)) continue;
    if ((hash(bucket * 37 + d.id * 11) % 5) !== 0) continue;
    const p = gridToScreen(d.q, d.r, camera.zoom);
    const spread = 8 + randomFrom(bucket + d.id, d.id) * 24;
    const ang = randomFrom(bucket + d.id * 19, d.id + 3) * Math.PI * 2;
    pushParticle(
      {
        x: p.x - camera.x + Math.cos(ang) * spread,
        y: p.y - camera.y + Math.sin(ang) * spread,
        vx: Math.cos(ang) * 0.15,
        vy: -0.18,
        size: 3.3,
        life: 0.44,
        maxLife: 0.44,
        color:
          d.kind === 'volcanic_eruption'
            ? 'rgba(255,130,95,0.8)'
            : d.kind === 'flood' || d.kind === 'tsunami'
              ? 'rgba(130,215,255,0.74)'
              : 'rgba(255,210,155,0.7)',
        kind: 'mist',
        ambientTag: 'disasterAmbient',
      },
      maxParticles
    );
  }
}

export function runVisualFxPipeline(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeMs: number,
  camera: { x: number; y: number; zoom: number },
  limits: { maxParticles: number; qualityScale: number },
  localViewerCivIndex: number
): void {
  const dt = Math.max(0.001, Math.min(0.05, (timeMs - lastTime) / 1000 || 0.016));
  lastTime = timeMs;
  const maxProjectiles = Math.max(10, Math.round(limits.maxParticles * 0.2));
  const maxShockwaves = Math.max(10, Math.round(limits.maxParticles * 0.16));
  const maxDecals = Math.max(16, Math.round(limits.maxParticles * 0.14));

  const aliveIds = new Set(state.units.map(u => u.id));
  for (const id of [...unitMemory.keys()]) {
    if (!aliveIds.has(id)) unitMemory.delete(id);
  }

  for (const unit of state.units) {
    const prev = unitMemory.get(unit.id);
    const tile = state.tiles[unit.r]?.[unit.q];
    const visible = isVisibleFor(tile, localViewerCivIndex);
    if (prev && visible) {
      if (!prev.hasAttacked && unit.hasAttacked && unit.hp > 0) {
        spawnAttackProjectile(state, unit, camera, maxProjectiles, localViewerCivIndex);
      }
      if (unit.hp < prev.hp) {
        const hit = gridToScreen(unit.q, unit.r, camera.zoom);
        spawnShockwaveAt(hit.x, hit.y - 8 * camera.zoom, 'rgba(255,210,170,0.9)', maxShockwaves);
        spawnImpactDecal(hit.x, hit.y - 4 * camera.zoom, 'crack', 6 + 8 * camera.zoom, maxDecals);
      }
    }
    unitMemory.set(unit.id, { q: unit.q, r: unit.r, hp: unit.hp, hasAttacked: unit.hasAttacked });
  }

  for (const m of state.messages) {
    if (m.type !== 'combat') continue;
    if (processedCombat.has(m.id)) continue;
    rememberCombatMessage(m.id);
    spawnCombatBurst(state, m, camera, limits.maxParticles, localViewerCivIndex);
  }
  spawnWeather(state, timeMs, ctx.canvas.clientWidth || ctx.canvas.width, limits.maxParticles);
  spawnDisasterAmbient(state, timeMs, camera, localViewerCivIndex, limits.maxParticles);

  const H = ctx.canvas.clientHeight || ctx.canvas.height;
  const W = ctx.canvas.clientWidth || ctx.canvas.width;
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i]!;
    d.life -= dt;
    if (d.life <= 0) {
      decals.splice(i, 1);
      continue;
    }
    const sx = d.wx - camera.x;
    const sy = d.wy - camera.y;
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
    const alpha = (d.life / d.maxLife) * 0.42 * limits.qualityScale;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(d.rotation);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (d.kind === 'scorch') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, d.size);
      g.addColorStop(0, 'rgba(38,28,20,0.65)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, d.size, d.size * 0.64, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.kind === 'splash') {
      ctx.strokeStyle = 'rgba(140,220,255,0.55)';
      ctx.lineWidth = Math.max(1, d.size * 0.09);
      for (let k = 0; k < 4; k++) {
        const a = (Math.PI * 2 * k) / 4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d.size * 0.24, Math.sin(a) * d.size * 0.2, d.size * 0.42, a - 0.5, a + 0.5);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(210,190,170,0.45)';
      ctx.lineWidth = Math.max(1, d.size * 0.06);
      ctx.beginPath();
      ctx.moveTo(-d.size * 0.6, 0);
      ctx.lineTo(d.size * 0.6, 0);
      ctx.moveTo(0, -d.size * 0.55);
      ctx.lineTo(0, d.size * 0.55);
      ctx.moveTo(-d.size * 0.4, -d.size * 0.34);
      ctx.lineTo(d.size * 0.4, d.size * 0.34);
      ctx.moveTo(-d.size * 0.4, d.size * 0.34);
      ctx.lineTo(d.size * 0.4, -d.size * 0.34);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]!;
    p.life -= dt;
    p.progress += dt * p.speed;
    const t = Math.max(0, Math.min(1, p.progress));
    const wx = p.wx + (p.wtx - p.wx) * t;
    const wy = p.wy + (p.wty - p.wy) * t - Math.sin(t * Math.PI) * p.arc;
    const sx = wx - camera.x;
    const sy = wy - camera.y;
    const alpha = Math.max(0, Math.min(1, p.life * limits.qualityScale));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = p.trailColor;
    ctx.lineWidth = Math.max(1, p.width * camera.zoom);
    ctx.beginPath();
    ctx.moveTo(p.wx - camera.x, p.wy - camera.y);
    ctx.quadraticCurveTo((p.wx + p.wtx) / 2 - camera.x, (p.wy + p.wty) / 2 - camera.y - p.arc, sx, sy);
    ctx.stroke();
    if (p.kind === 'rocket') {
      ctx.strokeStyle = 'rgba(230,248,255,0.85)';
      ctx.lineWidth = Math.max(1, (p.width - 0.6) * camera.zoom);
      ctx.beginPath();
      ctx.moveTo(p.wx - camera.x, p.wy - camera.y);
      ctx.quadraticCurveTo((p.wx + p.wtx) / 2 - camera.x, (p.wy + p.wty) / 2 - camera.y - p.arc * 0.72, sx, sy);
      ctx.stroke();
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(1.8, 2.6 * camera.zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (t >= 1 || p.life <= 0) {
      spawnShockwaveAt(p.wtx, p.wty, p.color, maxShockwaves);
      spawnImpactDecal(
        p.wtx,
        p.wty,
        p.kind === 'rocket' ? 'splash' : p.kind === 'shell' ? 'scorch' : 'crack',
        p.kind === 'shell' ? 12 + 10 * camera.zoom : p.kind === 'rocket' ? 10 + 9 * camera.zoom : 8 + 7 * camera.zoom,
        maxDecals
      );
      for (let s = 0; s < 4; s++) {
        const a = (Math.PI * 2 * s) / 4 + randomFrom(i * 17 + s, s);
        pushParticle(
          {
            x: p.wtx - camera.x,
            y: p.wty - camera.y,
            vx: Math.cos(a) * (0.5 + randomFrom(i * 5 + s, s + 2) * 1.3),
            vy: Math.sin(a) * (0.4 + randomFrom(i * 9 + s, s + 6) * 1.2) - 0.4,
            size: 1.8,
            life: 0.35,
            maxLife: 0.35,
            color: p.color,
            kind: 'spark',
          },
          limits.maxParticles
        );
      }
      projectiles.splice(i, 1);
    }
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const w = shockwaves[i]!;
    w.life -= dt;
    w.radius += w.radiusSpeed * dt;
    const alpha = (w.life / w.maxLife) * limits.qualityScale;
    if (w.life <= 0) {
      shockwaves.splice(i, 1);
      continue;
    }
    const sx = w.wx - camera.x;
    const sy = w.wy - camera.y;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.strokeStyle = w.color;
    ctx.lineWidth = Math.max(1.1, 2.2 * camera.zoom);
    ctx.beginPath();
    ctx.arc(sx, sy, w.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.kind === 'mist' ? 0.006 : 0.035;
    p.vx *= p.kind === 'mist' ? 0.985 : 0.965;
    p.vy *= p.kind === 'mist' ? 0.99 : 0.972;
    const alpha = (p.life / p.maxLife) * limits.qualityScale;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    if (p.kind === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1 + p.size * 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
      ctx.stroke();
    } else {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.1);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (p.x < -40 || p.x > W + 40 || p.y > H + 80) {
      particles.splice(i, 1);
    }
  }

  // subtle tactical pulse around selected tile/unit
  if (state.selectedTile) {
    const pp = gridToScreen(state.selectedTile.q, state.selectedTile.r, camera.zoom);
    const sx = pp.x - camera.x;
    const sy = pp.y - camera.y;
    const pulse = (Math.sin(timeMs / 300) * 0.5 + 0.5) * limits.qualityScale;
    ctx.save();
    ctx.strokeStyle = `rgba(255,220,120,${0.16 + pulse * 0.2})`;
    ctx.lineWidth = Math.max(1.4, 2.2 * camera.zoom);
    ctx.beginPath();
    ctx.arc(sx, sy, TILE_HALF_W * camera.zoom * (0.65 + pulse * 0.15), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

