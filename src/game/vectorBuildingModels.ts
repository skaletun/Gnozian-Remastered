import type { City, WonderId } from './types';

function mixHex(color: string, delta: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : '8a5a2c';
  if (hex.length !== 6) return color;
  const n = parseInt(hex, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (n & 0xff) + delta));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export interface CityBuildingVisualOpts {
  visualDetail: 'balanced' | 'ultra';
  strategicView: boolean;
  tacticalFarView: boolean;
  wonderIds: WonderId[];
}

function settlementTier(city: City): number {
  if (city.settlementTier != null) return city.settlementTier;
  if (city.isCapital) return 3;
  const k = city.settlementKind;
  if (k === 'town') return 1;
  if (k === 'city') return 2;
  return 2;
}

function drawIsoBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  d: number,
  baseColor: string,
  isAccent: boolean
): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w, -h - d * 0.5);
  ctx.lineTo(0, -h - d);
  ctx.lineTo(-w, -h - d * 0.5);
  ctx.closePath();
  ctx.fillStyle = baseColor;
  ctx.fill();
  ctx.fillStyle = isAccent ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-w, -h - d * 0.5);
  ctx.lineTo(0, -h);
  ctx.lineTo(0, 0);
  ctx.lineTo(-w, -d * 0.5);
  ctx.closePath();
  ctx.fillStyle = baseColor;
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w, -h - d * 0.5);
  ctx.lineTo(w, -d * 0.5);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fillStyle = baseColor;
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-w, -h - d * 0.5);
  ctx.lineTo(0, -h);
  ctx.lineTo(w, -h - d * 0.5);
  ctx.lineTo(0, -h - d);
  ctx.closePath();
  ctx.moveTo(0, -h);
  ctx.lineTo(0, 0);
  ctx.moveTo(-w, -h - d * 0.5);
  ctx.lineTo(-w, -d * 0.5);
  ctx.lineTo(0, 0);
  ctx.lineTo(w, -d * 0.5);
  ctx.lineTo(w, -h - d * 0.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.restore();
}

/** Window bands on iso block left/right faces (ultra + near zoom only). */
function strokeIsoFacadeDetail(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  w: number,
  h: number,
  d: number,
  lineWidth: number
): void {
  ctx.save();
  ctx.translate(bx, by);
  ctx.strokeStyle = 'rgba(22, 18, 14, 0.42)';
  ctx.lineWidth = lineWidth;
  for (const s of [0.26, 0.52, 0.74]) {
    const yL = -d / 2 - s * h;
    const yR = -s * h;
    ctx.beginPath();
    ctx.moveTo(-w, yL);
    ctx.lineTo(0, yR);
    ctx.stroke();
  }
  for (const s of [0.28, 0.55, 0.76]) {
    const yL = -h + s * h;
    const yR = -h - d / 2 + s * h;
    ctx.beginPath();
    ctx.moveTo(0, yL);
    ctx.lineTo(w, yR);
    ctx.stroke();
  }
  ctx.restore();
}

function drawKeepBattlements(ctx: CanvasRenderingContext2D, cx: number, roofY: number, z: number, span: number): void {
  const teeth = 4;
  const startX = cx - span / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(18, 14, 10, 0.55)';
  ctx.lineWidth = Math.max(0.6, 0.9 * z);
  for (let i = 0; i < teeth; i++) {
    const x0 = startX + (span / teeth) * i;
    const x1 = startX + (span / teeth) * (i + 0.5);
    const y0 = roofY;
    const y1 = roofY - 2.5 * z;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawReferenceWall(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  zoom: number,
  compact: boolean
): void {
  const sc = compact ? 0.74 : 1;
  const Z = zoom * sc;
  const wall = '#6c5239';
  const wallDark = '#392819';
  const wallLight = '#a98355';
  const points = [
    [-42, -5],
    [-18, -20],
    [18, -20],
    [44, -5],
    [34, 14],
    [0, 25],
    [-34, 14],
  ].map(([x, y]) => [sx + x * Z, sy + y * Z] as const);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.strokeStyle = wallDark;
  ctx.lineWidth = Math.max(5, 7 * Z);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = wall;
  ctx.lineWidth = Math.max(3, 5 * Z);
  ctx.stroke();
  ctx.strokeStyle = wallLight;
  ctx.lineWidth = Math.max(1, 1.5 * Z);
  ctx.stroke();

  const merlonIdx = compact ? [0, 2, 6] : [0, 2, 4, 6];
  for (const i of merlonIdx) {
    const [x, y] = points[i]!;
    drawIsoBlock(ctx, x, y + 2 * Z, 3.4 * Z, 9 * Z, 3.4 * Z, '#8c6541', true);
  }

  if (!compact) {
    ctx.strokeStyle = 'rgba(40, 28, 16, 0.5)';
    ctx.lineWidth = Math.max(1, 1.8 * Z);
    ctx.beginPath();
    const [bx, by] = points[5]!;
    ctx.moveTo(bx - 10 * Z, by - 2 * Z);
    ctx.quadraticCurveTo(bx, by - 10 * Z, bx + 10 * Z, by - 2 * Z);
    ctx.stroke();
  }

  ctx.restore();
}

function civStyle(city: City): {
  roof: string;
  roofLight: string;
  wall: string;
  tower: 'spire' | 'dome' | 'banner' | 'industrial';
} {
  const styles = [
    { roof: '#7d2c2c', roofLight: '#b74734', wall: '#d6b37b', tower: 'spire' as const },
    { roof: '#315f9b', roofLight: '#74a2da', wall: '#b7c8d9', tower: 'dome' as const },
    { roof: '#356f3b', roofLight: '#7fae58', wall: '#c5b16d', tower: 'banner' as const },
    { roof: '#6c3f86', roofLight: '#a072c0', wall: '#b7a2c7', tower: 'spire' as const },
    { roof: '#8b5d2e', roofLight: '#cf9b54', wall: '#c2a078', tower: 'industrial' as const },
  ];
  return styles[Math.abs(city.owner) % styles.length]!;
}

function hashWonderShape(id: WonderId, salt: number): 0 | 1 | 2 {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return (h % 3) as 0 | 1 | 2;
}

function drawAbstractWonder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  z: number,
  shape: 0 | 1 | 2
): void {
  ctx.save();
  if (shape === 0) {
    ctx.fillStyle = '#c4a052';
    ctx.strokeStyle = 'rgba(40, 30, 12, 0.45)';
    ctx.lineWidth = Math.max(0.5, z * 0.6);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18 * z);
    ctx.lineTo(cx - 16 * z, cy + 8 * z);
    ctx.lineTo(cx + 16 * z, cy + 8 * z);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#dfc56e';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 28 * z);
    ctx.lineTo(cx - 10 * z, cy - 6 * z);
    ctx.lineTo(cx + 10 * z, cy - 6 * z);
    ctx.closePath();
    ctx.fill();
  } else if (shape === 1) {
    ctx.fillStyle = '#9aa4ad';
    ctx.fillRect(cx - 5 * z, cy - 32 * z, 10 * z, 34 * z);
    ctx.fillStyle = '#c8d4df';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 36 * z);
    ctx.lineTo(cx + 8 * z, cy - 24 * z);
    ctx.lineTo(cx, cy - 20 * z);
    ctx.lineTo(cx - 8 * z, cy - 24 * z);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 18, 16, 0.5)';
    ctx.lineWidth = Math.max(0.5, z * 0.5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.beginPath();
    ctx.arc(cx, cy, 14 * z, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(55, 42, 28, 0.65)';
    ctx.lineWidth = Math.max(1.2, 2 * z);
    ctx.beginPath();
    ctx.moveTo(cx - 14 * z, cy);
    ctx.lineTo(cx + 14 * z, cy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWonderAnchors(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  z: number,
  wonderIds: WonderId[],
  cityId: number,
  enabled: boolean
): void {
  if (!enabled || wonderIds.length === 0) return;
  const maxW = Math.min(3, wonderIds.length);
  const slots = [
    { ox: -52, oy: -6 },
    { ox: 50, oy: 6 },
    { ox: -6, oy: -44 },
  ];
  for (let i = 0; i < maxW; i++) {
    const wid = wonderIds[i]!;
    const shape = hashWonderShape(wid, cityId + i * 13);
    const slot = slots[i]!;
    drawAbstractWonder(ctx, sx + slot.ox * z, sy + slot.oy * z, z, shape);
  }
}

function drawBuildingTypeAccents(
  ctx: CanvasRenderingContext2D,
  city: City,
  sx: number,
  sy: number,
  z: number,
  colorA: string,
  roofLight: string,
  stone: string
): void {
  const b = new Set(city.buildings);

  if (b.has('market') || b.has('bank') || b.has('stock_exchange')) {
    ctx.fillStyle = mixHex(roofLight, 15);
    ctx.fillRect(sx - 40 * z, sy + 8 * z, 14 * z, 5 * z);
    ctx.fillRect(sx - 36 * z, sy + 2 * z, 10 * z, 4 * z);
    ctx.strokeStyle = 'rgba(40, 30, 18, 0.45)';
    ctx.lineWidth = Math.max(0.5, z);
    ctx.strokeRect(sx - 40 * z, sy + 8 * z, 14 * z, 5 * z);
  }

  if (b.has('granary')) {
    ctx.fillStyle = '#c9a66a';
    ctx.beginPath();
    ctx.ellipse(sx - 38 * z, sy + 16 * z, 6 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(sx - 38 * z, sy + 10 * z, 12 * z, 8 * z);
  }

  if (b.has('aqueduct')) {
    ctx.strokeStyle = 'rgba(120, 110, 98, 0.85)';
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const ax = sx + (8 + k * 14) * z;
      ctx.moveTo(ax - 6 * z, sy + 22 * z);
      ctx.quadraticCurveTo(ax, sy + 12 * z, ax + 6 * z, sy + 22 * z);
    }
    ctx.stroke();
  }

  if (b.has('monument')) {
    ctx.fillStyle = stone;
    ctx.fillRect(sx + 36 * z, sy - 4 * z, 5 * z, 22 * z);
    ctx.fillStyle = mixHex(roofLight, 5);
    ctx.beginPath();
    ctx.moveTo(sx + 38.5 * z, sy - 10 * z);
    ctx.lineTo(sx + 42 * z, sy - 4 * z);
    ctx.lineTo(sx + 35 * z, sy - 4 * z);
    ctx.closePath();
    ctx.fill();
  }

  if (b.has('colosseum') || b.has('entertainment_complex')) {
    ctx.strokeStyle = 'rgba(90, 70, 50, 0.55)';
    ctx.lineWidth = Math.max(1.5, 2.2 * z);
    ctx.save();
    ctx.translate(sx + 8 * z, sy + 28 * z);
    ctx.scale(1, 0.48);
    ctx.beginPath();
    ctx.arc(0, 0, 26 * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (b.has('broadcast_tower')) {
    ctx.strokeStyle = '#7a7f88';
    ctx.lineWidth = Math.max(1.2, 1.8 * z);
    ctx.beginPath();
    ctx.moveTo(sx + 32 * z, sy + 12 * z);
    ctx.lineTo(sx + 32 * z, sy - 26 * z);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx + 32 * z, sy - 28 * z, 3 * z, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (b.has('space_port')) {
    ctx.fillStyle = 'rgba(110, 118, 128, 0.9)';
    ctx.fillRect(sx - 8 * z, sy + 18 * z, 28 * z, 6 * z);
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.5)';
    ctx.lineWidth = Math.max(1, 1.4 * z);
    ctx.strokeRect(sx - 2 * z, sy + 12 * z, 16 * z, 14 * z);
    ctx.fillStyle = 'rgba(255, 120, 80, 0.75)';
    ctx.beginPath();
    ctx.moveTo(sx + 6 * z, sy + 26 * z);
    ctx.lineTo(sx + 4 * z, sy + 34 * z);
    ctx.lineTo(sx + 10 * z, sy + 34 * z);
    ctx.closePath();
    ctx.fill();
  }

  const hasReligious = b.has('temple') || b.has('cathedral');
  const hasScience = b.has('library') || b.has('university') || b.has('research_lab');
  const hasIndustry = b.has('factory') || b.has('power_plant') || b.has('workshop');

  if (hasReligious) {
    drawIsoBlock(ctx, sx - 31 * z, sy - 7 * z, 3 * z, 25 * z, 3 * z, '#d6b37b', true);
    ctx.fillStyle = mixHex(colorA, 30);
    ctx.beginPath();
    ctx.moveTo(sx - 28 * z, sy - 32 * z);
    ctx.lineTo(sx - 25 * z, sy - 38 * z);
    ctx.lineTo(sx - 22 * z, sy - 32 * z);
    ctx.closePath();
    ctx.fill();
  }
  if (hasScience) {
    drawIsoBlock(ctx, sx + 26 * z, sy - 12 * z, 6 * z, 13 * z, 6 * z, '#8ec9ff', false);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(sx + 29 * z, sy - 18 * z, 3 * z, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hasIndustry) {
    drawIsoBlock(ctx, sx - 20 * z, sy + 18 * z, 4 * z, 10 * z, 4 * z, '#b7b8c0', false);
    drawIsoBlock(ctx, sx - 16 * z, sy + 20 * z, 1.6 * z, 16 * z, 1.6 * z, '#8b8c91', false);
    ctx.fillStyle = 'rgba(55, 55, 58, 0.55)';
    ctx.beginPath();
    ctx.arc(sx - 10 * z, sy + 6 * z, 4 * z, Math.PI, 0);
    ctx.fill();
  }
}

export function drawCityBuildingModels(
  ctx: CanvasRenderingContext2D,
  city: City,
  sx: number,
  sy: number,
  zoom: number,
  colorA: string,
  colorB: string,
  opts?: CityBuildingVisualOpts
): void {
  const o: CityBuildingVisualOpts = opts ?? {
    visualDetail: 'balanced',
    strategicView: false,
    tacticalFarView: false,
    wonderIds: [],
  };

  const tier = settlementTier(city);
  const isTown = tier <= 1;
  const buildings = city.buildings;
  const pop = city.population;
  const cityZoom = Math.max(zoom, 0.72);
  const stone = mixHex(colorA, 28);
  const style = civStyle(city);
  const roof = style.roof;
  const roofLight = style.roofLight;
  const block = mixHex(colorB, 18);
  const lw = Math.max(0.35, 0.55 * cityZoom);

  const showFacade =
    o.visualDetail === 'ultra' && !o.strategicView && !o.tacticalFarView;
  const showWonderAccents = o.visualDetail === 'ultra' && !o.strategicView;

  const quartersFull = [
    { x: -24, y: -2, w: 7, h: 15, d: 8, c: block },
    { x: -8, y: -10, w: 8, h: 18, d: 9, c: stone },
    { x: 14, y: -5, w: 7, h: 14, d: 8, c: block },
    { x: 30, y: 6, w: 6, h: 11, d: 7, c: mixHex(block, -10) },
    { x: -34, y: 10, w: 6, h: 10, d: 7, c: mixHex(block, -4) },
    { x: 2, y: 13, w: 9, h: 12, d: 9, c: mixHex(stone, -12) },
  ];
  const quarters = isTown ? quartersFull.slice(0, 4) : quartersFull;

  const keepBoost =
    (24 + Math.min(16, pop * 2) + Math.min(12, buildings.length * 1.4)) * (isTown ? 0.82 : 1);
  const keepRoofDy = (34 + Math.min(14, pop)) * (isTown ? 0.88 : 1);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(
    sx + 4 * cityZoom,
    sy + 18 * cityZoom,
    (isTown ? 48 : 58) * cityZoom,
    (isTown ? 20 : 25) * cityZoom,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.strokeStyle = 'rgba(105,72,38,0.72)';
  ctx.lineWidth = Math.max(2, 4 * cityZoom);
  ctx.beginPath();
  ctx.moveTo(sx - 48 * cityZoom, sy + 10 * cityZoom);
  ctx.bezierCurveTo(
    sx - 18 * cityZoom,
    sy - 5 * cityZoom,
    sx + 22 * cityZoom,
    sy - 8 * cityZoom,
    sx + 50 * cityZoom,
    sy + 9 * cityZoom
  );
  ctx.moveTo(sx - 25 * cityZoom, sy + 24 * cityZoom);
  ctx.lineTo(sx + 30 * cityZoom, sy - 12 * cityZoom);
  ctx.stroke();

  drawReferenceWall(ctx, sx, sy, cityZoom, isTown);

  for (const q of quarters) {
    drawIsoBlock(ctx, sx + q.x * cityZoom, sy + q.y * cityZoom, q.w * cityZoom, q.h * cityZoom, q.d * cityZoom, q.c, false);
    drawIsoBlock(
      ctx,
      sx + q.x * cityZoom,
      sy + (q.y - q.h * 0.55) * cityZoom,
      q.w * 0.82 * cityZoom,
      3.5 * cityZoom,
      q.d * 0.82 * cityZoom,
      roof,
      true
    );
    if (showFacade) {
      strokeIsoFacadeDetail(
        ctx,
        sx + q.x * cityZoom,
        sy + q.y * cityZoom,
        q.w * cityZoom,
        q.h * cityZoom,
        q.d * cityZoom,
        lw
      );
    }
  }

  const kx = sx - 2 * cityZoom;
  const ky = sy - 11 * cityZoom;
  const kw = 11 * cityZoom;
  const kh = keepBoost * cityZoom;
  const kd = 12 * cityZoom;
  drawIsoBlock(ctx, kx, ky, kw, kh, kd, stone, true);

  drawIsoBlock(
    ctx,
    kx,
    sy - keepRoofDy * cityZoom,
    9 * cityZoom,
    7 * cityZoom,
    9 * cityZoom,
    roofLight,
    true
  );

  if (showFacade) {
    strokeIsoFacadeDetail(ctx, kx, ky, kw, kh, kd, lw + 0.15);
    drawKeepBattlements(ctx, sx, ky - kh, cityZoom, kw * 1.95);
  }

  if (style.tower === 'dome') {
    ctx.fillStyle = style.wall;
    ctx.beginPath();
    ctx.ellipse(sx + 21 * cityZoom, sy - 30 * cityZoom, 13 * cityZoom, 8 * cityZoom, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (style.tower === 'banner') {
    drawIsoBlock(ctx, sx + 24 * cityZoom, sy - 8 * cityZoom, 4 * cityZoom, 24 * cityZoom, 4 * cityZoom, style.wall, true);
    ctx.fillStyle = roofLight;
    ctx.fillRect(sx + 24 * cityZoom, sy - 39 * cityZoom, 18 * cityZoom, 9 * cityZoom);
  } else if (style.tower === 'industrial') {
    drawIsoBlock(ctx, sx + 27 * cityZoom, sy + 7 * cityZoom, 4 * cityZoom, 25 * cityZoom, 4 * cityZoom, '#8b8c91', false);
    ctx.fillStyle = 'rgba(40,36,32,0.45)';
    ctx.beginPath();
    ctx.ellipse(sx + 29 * cityZoom, sy - 23 * cityZoom, 5 * cityZoom, 12 * cityZoom, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawIsoBlock(ctx, sx + 24 * cityZoom, sy - 10 * cityZoom, 4 * cityZoom, 28 * cityZoom, 4 * cityZoom, style.wall, true);
  }

  drawBuildingTypeAccents(ctx, city, sx, sy, cityZoom, colorA, roofLight, stone);

  drawWonderAnchors(ctx, sx, sy, cityZoom, o.wonderIds, city.id, showWonderAccents);

  if (city.isCapital) {
    ctx.strokeStyle = '#3b2410';
    ctx.lineWidth = Math.max(1, cityZoom);
    ctx.beginPath();
    ctx.moveTo(sx + 10 * cityZoom, sy - 58 * cityZoom);
    ctx.lineTo(sx + 10 * cityZoom, sy - 34 * cityZoom);
    ctx.stroke();
    ctx.fillStyle = colorA;
    ctx.beginPath();
    ctx.moveTo(sx + 10 * cityZoom, sy - 58 * cityZoom);
    ctx.lineTo(sx + 28 * cityZoom, sy - 53 * cityZoom);
    ctx.lineTo(sx + 10 * cityZoom, sy - 47 * cityZoom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,170,0.85)';
    ctx.stroke();
  }

  ctx.restore();
}
