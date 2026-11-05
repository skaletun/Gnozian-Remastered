import type { ImprovementType, TerrainType } from './types';

export function drawImprovementFarm(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  zoom: number,
  q: number,
  r: number,
  ultraDetail: boolean
): void {
  ctx.save();
  ctx.translate(sx + 8 * zoom, sy + 8 * zoom);
  ctx.rotate(-0.18);
  const rows = ultraDetail ? 5 : 4;
  for (let i = 0; i < rows; i++) {
    const y = (-12 + i * (ultraDetail ? 5 : 6)) * zoom;
    ctx.fillStyle = i % 2 ? '#7e8f38' : '#b9a34b';
    ctx.beginPath();
    ctx.moveTo(-24 * zoom, y);
    ctx.lineTo(22 * zoom, y - 5 * zoom);
    ctx.lineTo(26 * zoom, y + 1 * zoom);
    ctx.lineTo(-20 * zoom, y + 7 * zoom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(65,52,22,0.55)';
    ctx.lineWidth = Math.max(0.7, zoom);
    ctx.stroke();
  }
  if ((q + r) % 2 === 0) {
    ctx.fillStyle = '#6e3f23';
    ctx.fillRect(-29 * zoom, -13 * zoom, 5 * zoom, 24 * zoom);
  }
  if (ultraDetail) {
    ctx.fillStyle = '#8a939e';
    ctx.beginPath();
    ctx.ellipse(28 * zoom, 4 * zoom, 7 * zoom, 10 * zoom, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 40, 48, 0.4)';
    ctx.lineWidth = Math.max(0.5, zoom * 0.6);
    ctx.stroke();
    ctx.fillStyle = '#6e3f23';
    ctx.fillRect(22 * zoom, -8 * zoom, 4 * zoom, 22 * zoom);
  }
  ctx.restore();
}

export function drawImprovementMine(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number): void {
  const z = Math.max(zoom, 0.55);
  ctx.save();
  ctx.translate(sx - 4 * z, sy + 4 * z);
  ctx.fillStyle = '#4a4035';
  ctx.fillRect(-16 * z, 8 * z, 36 * z, 8 * z);
  ctx.strokeStyle = 'rgba(25, 20, 14, 0.65)';
  ctx.lineWidth = Math.max(1, 1.4 * z);
  ctx.beginPath();
  ctx.moveTo(0, -18 * z);
  ctx.lineTo(-20 * z, 10 * z);
  ctx.lineTo(20 * z, 10 * z);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = '#6d5c48';
  ctx.lineWidth = Math.max(1.2, 2 * z);
  ctx.beginPath();
  ctx.moveTo(0, -18 * z);
  ctx.lineTo(0, 12 * z);
  ctx.stroke();
  ctx.fillStyle = 'rgba(15, 12, 10, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 12 * z, 18 * z, 5 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawImprovementLumberMill(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number): void {
  const z = Math.max(zoom, 0.55);
  ctx.save();
  ctx.translate(sx + 6 * z, sy + 10 * z);
  ctx.fillStyle = '#5c4a32';
  ctx.fillRect(-8 * z, -4 * z, 6 * z, 28 * z);
  ctx.fillStyle = '#7d9350';
  ctx.beginPath();
  ctx.ellipse(-18 * z, 0, 10 * z, 22 * z, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a8b88e';
  ctx.beginPath();
  ctx.moveTo(8 * z, -16 * z);
  ctx.lineTo(22 * z, 4 * z);
  ctx.lineTo(4 * z, 8 * z);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(35, 30, 20, 0.55)';
  ctx.lineWidth = Math.max(0.8, z);
  ctx.stroke();
  ctx.restore();
}

export function drawImprovementPasture(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, q: number, r: number): void {
  const z = Math.max(zoom, 0.55);
  ctx.save();
  ctx.translate(sx, sy + 6 * z);
  ctx.strokeStyle = 'rgba(110, 82, 48, 0.75)';
  ctx.lineWidth = Math.max(1, 1.5 * z);
  ctx.setLineDash([4 * z, 3 * z]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 32 * z, 16 * z, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(180, 160, 110, 0.45)';
  ctx.fillRect(-6 * z, -4 * z, 12 * z, 8 * z);
  if ((q + r) % 3 === 0) {
    ctx.fillStyle = '#8a7a62';
    ctx.beginPath();
    ctx.ellipse(-10 * z, 4 * z, 5 * z, 3 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawImprovementTradingPost(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number): void {
  const z = Math.max(zoom, 0.55);
  ctx.save();
  ctx.translate(sx + 2 * z, sy + 6 * z);
  ctx.fillStyle = '#a67c52';
  ctx.beginPath();
  ctx.moveTo(0, -20 * z);
  ctx.lineTo(26 * z, 6 * z);
  ctx.lineTo(-26 * z, 6 * z);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(50, 36, 20, 0.6)';
  ctx.lineWidth = Math.max(0.9, z);
  ctx.stroke();
  ctx.fillStyle = '#6d4d2c';
  ctx.fillRect(-8 * z, 6 * z, 16 * z, 14 * z);
  ctx.restore();
}

export function drawImprovementFishingBoats(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  zoom: number,
  terrain: TerrainType
): void {
  const z = Math.max(zoom, 0.55);
  const waterBiasX = terrain === 'ocean' ? 0 : 10;
  const waterBiasY = terrain === 'coast' ? 8 : 12;
  ctx.save();
  ctx.translate(sx + waterBiasX * z, sy + waterBiasY * z);
  ctx.strokeStyle = '#5c4a38';
  ctx.lineWidth = Math.max(2, 3 * z);
  ctx.beginPath();
  ctx.moveTo(-28 * z, 4 * z);
  ctx.lineTo(16 * z, 4 * z);
  ctx.stroke();
  ctx.fillStyle = 'rgba(80, 120, 150, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-6 * z, 8 * z, 42 * z, 8 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8b7355';
  ctx.beginPath();
  ctx.moveTo(-12 * z, -2 * z);
  ctx.lineTo(18 * z, 2 * z);
  ctx.lineTo(16 * z, 10 * z);
  ctx.lineTo(-20 * z, 8 * z);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(35, 28, 18, 0.55)';
  ctx.lineWidth = Math.max(0.8, z);
  ctx.stroke();
  ctx.restore();
}

/** Dispatch drawing for a tile improvement (caller checks visibility / LOD). */
export function drawImprovementByType(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  zoom: number,
  improvement: ImprovementType,
  terrain: TerrainType,
  q: number,
  r: number,
  farmUltraDetail: boolean
): void {
  switch (improvement) {
    case 'farm':
      drawImprovementFarm(ctx, sx, sy, zoom, q, r, farmUltraDetail);
      break;
    case 'mine':
      drawImprovementMine(ctx, sx, sy, zoom);
      break;
    case 'lumber_mill':
      drawImprovementLumberMill(ctx, sx, sy, zoom);
      break;
    case 'pasture':
      drawImprovementPasture(ctx, sx, sy, zoom, q, r);
      break;
    case 'trading_post':
      drawImprovementTradingPost(ctx, sx, sy, zoom);
      break;
    case 'fishing_boats':
      drawImprovementFishingBoats(ctx, sx, sy, zoom, terrain);
      break;
    default:
      break;
  }
}
