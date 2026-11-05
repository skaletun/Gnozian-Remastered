import type { Unit, UnitType } from './types';

type UnitArchetype = 'melee' | 'ranged' | 'siege' | 'mounted' | 'naval' | 'air' | 'civilian' | 'great';

function archetypeOf(type: UnitType): UnitArchetype {
  if (type === 'bomber' || type === 'fighter' || type === 'nuclear_missile') return 'air';
  if (type === 'catapult' || type === 'cannon' || type === 'artillery') return 'siege';
  if (type === 'archer') return 'ranged';
  if (type === 'horseman' || type === 'knight' || type === 'cavalry' || type === 'tank') return 'mounted';
  if (type === 'settler' || type === 'worker' || type === 'missionary' || type === 'scout') return 'civilian';
  if (type.startsWith('great_')) return 'great';
  return 'melee';
}

function glyphForUnit(type: UnitType): string {
  if (type === 'settler') return 'H';
  if (type === 'worker') return 'T';
  if (type === 'scout') return 'R';
  if (type === 'missionary') return '+';
  if (type.startsWith('great_')) return '*';
  if (type === 'archer') return 'A';
  if (type === 'catapult') return 'C';
  if (type === 'cannon' || type === 'artillery') return 'B';
  if (type === 'horseman' || type === 'knight' || type === 'cavalry') return 'M';
  if (type === 'tank') return 'K';
  if (type === 'fighter' || type === 'bomber') return '^';
  if (type === 'nuclear_missile') return '!';
  if (type === 'spearman') return 'P';
  if (type === 'swordsman' || type === 'musketman' || type === 'rifleman' || type === 'infantry') return 'S';
  return 'W';
}

function drawTrooper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  colors: { primary: string; secondary: string; detail: string },
  archetype: UnitArchetype,
  variant: number
): void {
  ctx.save();
  ctx.translate(x, y);
  // After translating into local space, all geometry must be around (0, 0).
  // Using incoming absolute `y` here makes model placement depend on camera pan/zoom.
  let localY = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.58, s * 0.42, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  if (archetype === 'mounted') {
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.18, s * 0.62, s * 0.28, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.35, s * 0.1);
    ctx.lineTo(s * 0.68, -s * 0.28);
    ctx.lineTo(s * 0.88, -s * 0.1);
    ctx.lineTo(s * 0.48, s * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(-s * 0.28, s * 0.34);
    ctx.lineTo(-s * 0.38, s * 0.72);
    ctx.moveTo(s * 0.28, s * 0.34);
    ctx.lineTo(s * 0.36, s * 0.72);
    ctx.stroke();
    localY = -s * 0.18;
  }

  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.ellipse(0, localY - s * 0.18, s * 0.27, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,16,12,0.75)';
  ctx.lineWidth = s * 0.07;
  ctx.stroke();

  ctx.fillStyle = '#d8b284';
  ctx.beginPath();
  ctx.arc(0, localY - s * 0.62, s * 0.19, 0, Math.PI * 2);
  ctx.fill();

  if (archetype === 'ranged') {
    ctx.strokeStyle = colors.detail;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.arc(s * 0.35, localY - s * 0.35, s * 0.46, -Math.PI * 0.55, Math.PI * 0.55, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, localY - s * 0.25);
    ctx.lineTo(s * 0.62, localY - s * 0.25);
    ctx.stroke();
  } else if (archetype === 'siege') {
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(-s * 0.55, localY - s * 0.02, s * 1.1, s * 0.24);
    ctx.fillStyle = '#27231c';
    ctx.beginPath();
    ctx.arc(-s * 0.36, localY + s * 0.25, s * 0.18, 0, Math.PI * 2);
    ctx.arc(s * 0.36, localY + s * 0.25, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (archetype === 'air') {
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, localY - s * 0.24);
    ctx.lineTo(s * 0.75, localY - s * 0.12);
    ctx.lineTo(-s * 0.15, localY + s * 0.08);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = colors.detail;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(s * (variant % 2 ? -0.28 : 0.18), localY - s * 0.25);
    ctx.lineTo(s * (variant % 2 ? 0.5 : 0.64), localY - s * 0.86);
    ctx.stroke();
  }

  ctx.restore();
}

function drawUnitTypeSignature(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  centerX: number,
  centerY: number,
  radius: number,
  colors: { primary: string; secondary: string; detail: string }
): void {
  const w = Math.max(1, radius * 0.08);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (unit.type) {
    case 'settler':
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(centerX - radius * 0.64, centerY + radius * 0.16, radius * 0.34, radius * 0.24);
      ctx.fillRect(centerX + radius * 0.3, centerY + radius * 0.14, radius * 0.32, radius * 0.22);
      break;
    case 'worker':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.24, centerY - radius * 0.3);
      ctx.lineTo(centerX + radius * 0.46, centerY + radius * 0.36);
      ctx.stroke();
      break;
    case 'missionary':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius * 0.72);
      ctx.lineTo(centerX, centerY - radius * 0.24);
      ctx.moveTo(centerX - radius * 0.17, centerY - radius * 0.48);
      ctx.lineTo(centerX + radius * 0.17, centerY - radius * 0.48);
      ctx.stroke();
      break;
    case 'scout':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(centerX - radius * 0.06, centerY - radius * 0.62, radius * 0.26, Math.PI * 0.92, Math.PI * 2.45);
      ctx.moveTo(centerX + radius * 0.52, centerY - radius * 0.92);
      ctx.lineTo(centerX + radius * 0.92, centerY - radius * 1.06);
      ctx.stroke();
      break;
    case 'warrior':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius * 0.82);
      ctx.lineTo(centerX + radius * 0.56, centerY - radius * 0.15);
      ctx.stroke();
      break;
    case 'spearman':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.08, centerY - radius * 0.92);
      ctx.lineTo(centerX + radius * 0.1, centerY + radius * 0.24);
      ctx.stroke();
      ctx.fillStyle = colors.detail;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.18, centerY - radius * 0.9);
      ctx.lineTo(centerX + radius * 0.08, centerY - radius * 1.1);
      ctx.lineTo(centerX + radius * 0.24, centerY - radius * 0.84);
      ctx.closePath();
      ctx.fill();
      break;
    case 'swordsman':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX + radius * 0.12, centerY - radius * 0.86);
      ctx.lineTo(centerX + radius * 0.12, centerY - radius * 0.14);
      ctx.moveTo(centerX - radius * 0.05, centerY - radius * 0.56);
      ctx.lineTo(centerX + radius * 0.28, centerY - radius * 0.56);
      ctx.stroke();
      break;
    case 'musketman':
    case 'rifleman':
    case 'infantry':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.52, centerY - radius * 0.22);
      ctx.lineTo(centerX + radius * 0.58, centerY - radius * 0.4);
      ctx.stroke();
      break;
    case 'archer':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(centerX + radius * 0.34, centerY - radius * 0.34, radius * 0.44, -Math.PI * 0.54, Math.PI * 0.52, true);
      ctx.stroke();
      break;
    case 'catapult':
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(centerX - radius * 0.68, centerY + radius * 0.08, radius * 1.34, radius * 0.2);
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius * 0.58);
      ctx.lineTo(centerX + radius * 0.46, centerY + radius * 0.08);
      ctx.stroke();
      break;
    case 'cannon':
    case 'artillery':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = Math.max(1, radius * 0.1);
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.12, centerY - radius * 0.2);
      ctx.lineTo(centerX + radius * 0.82, centerY - radius * 0.5);
      ctx.stroke();
      break;
    case 'horseman':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.18, centerY - radius * 0.2);
      ctx.lineTo(centerX + radius * 0.5, centerY - radius * 0.86);
      ctx.stroke();
      break;
    case 'knight':
    case 'cavalry':
      ctx.fillStyle = colors.detail;
      ctx.beginPath();
      ctx.arc(centerX + radius * 0.2, centerY - radius * 0.62, radius * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX + radius * 0.2, centerY - radius * 0.52);
      ctx.lineTo(centerX + radius * 0.68, centerY - radius * 0.18);
      ctx.stroke();
      break;
    case 'tank':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = Math.max(1.4, radius * 0.1);
      ctx.beginPath();
      ctx.moveTo(centerX + radius * 0.16, centerY - radius * 0.34);
      ctx.lineTo(centerX + radius * 0.96, centerY - radius * 0.54);
      ctx.stroke();
      break;
    case 'fighter':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.72, centerY - radius * 0.14);
      ctx.lineTo(centerX + radius * 0.72, centerY - radius * 0.14);
      ctx.stroke();
      break;
    case 'bomber':
      ctx.fillStyle = colors.secondary;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - radius * 0.05, radius * 0.7, radius * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'nuclear_missile':
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius * 0.9);
      ctx.lineTo(centerX, centerY - radius * 0.16);
      ctx.stroke();
      ctx.fillStyle = colors.detail;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.14, centerY - radius * 0.88);
      ctx.lineTo(centerX, centerY - radius * 1.12);
      ctx.lineTo(centerX + radius * 0.14, centerY - radius * 0.88);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
}

export function drawUnitModel(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  centerX: number,
  centerY: number,
  radius: number,
  colors: { primary: string; secondary: string; detail: string },
  facingRadians: number
): void {
  const archetype = archetypeOf(unit.type);
  ctx.save();
  ctx.translate(centerX, centerY);
  // Sprite silhouettes face “up” (−Y); movement bearing is atan2(dy, dx) along +X/+Y.
  ctx.rotate(facingRadians + Math.PI / 2);
  ctx.translate(-centerX, -centerY);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + radius * 0.44, radius * 1.05, radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const scale = radius * 0.72;
  if (archetype === 'civilian') {
    if (unit.type === 'settler') {
      drawTrooper(ctx, centerX - radius * 0.34, centerY + radius * 0.16, scale * 0.9, colors, 'civilian', 0);
      drawTrooper(ctx, centerX + radius * 0.32, centerY + radius * 0.14, scale * 0.86, colors, 'civilian', 1);
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(centerX - radius * 0.16, centerY + radius * 0.25, radius * 0.42, radius * 0.28);
    } else if (unit.type === 'worker') {
      drawTrooper(ctx, centerX - radius * 0.18, centerY + radius * 0.12, scale, colors, 'civilian', 0);
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = Math.max(1, radius * 0.08);
      ctx.beginPath();
      ctx.moveTo(centerX + radius * 0.12, centerY - radius * 0.3);
      ctx.lineTo(centerX + radius * 0.68, centerY + radius * 0.28);
      ctx.stroke();
    } else {
      drawTrooper(ctx, centerX, centerY + radius * 0.08, scale * 1.04, colors, 'civilian', 0);
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = Math.max(1, radius * 0.08);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius * 0.78);
      ctx.lineTo(centerX, centerY + radius * 0.18);
      ctx.moveTo(centerX - radius * 0.18, centerY - radius * 0.56);
      ctx.lineTo(centerX + radius * 0.18, centerY - radius * 0.56);
      ctx.stroke();
    }
  } else if (archetype === 'mounted') {
    if (unit.type === 'tank') {
      ctx.fillStyle = colors.secondary;
      ctx.beginPath();
      ctx.roundRect(centerX - radius * 0.82, centerY - radius * 0.18, radius * 1.52, radius * 0.58, radius * 0.14);
      ctx.fill();
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.roundRect(centerX - radius * 0.32, centerY - radius * 0.46, radius * 0.72, radius * 0.36, radius * 0.1);
      ctx.fill();
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = Math.max(1, radius * 0.1);
      ctx.beginPath();
      ctx.moveTo(centerX + radius * 0.24, centerY - radius * 0.31);
      ctx.lineTo(centerX + radius * 0.92, centerY - radius * 0.52);
      ctx.stroke();
    } else {
      drawTrooper(ctx, centerX - radius * 0.32, centerY + radius * 0.16, scale, colors, archetype, 0);
      drawTrooper(ctx, centerX + radius * 0.32, centerY + radius * 0.1, scale * 0.95, colors, archetype, 1);
    }
  } else if (archetype === 'great') {
    drawTrooper(ctx, centerX - radius * 0.28, centerY + radius * 0.16, scale * 0.92, colors, 'civilian', 0);
    drawTrooper(ctx, centerX + radius * 0.25, centerY + radius * 0.08, scale * 0.92, colors, 'civilian', 1);
    ctx.fillStyle = colors.detail;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? radius * 0.58 : radius * 0.26;
      const a = i * Math.PI / 5 - Math.PI / 2;
      const x = centerX + Math.cos(a) * rr;
      const y = centerY - radius * 0.52 + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (archetype === 'air') {
    drawTrooper(ctx, centerX, centerY, scale * 1.18, colors, archetype, 0);
  } else if (archetype === 'siege') {
    drawTrooper(ctx, centerX, centerY + radius * 0.1, scale * 1.15, colors, archetype, 0);
    drawTrooper(ctx, centerX - radius * 0.58, centerY + radius * 0.18, scale * 0.62, colors, 'melee', 1);
  } else {
    drawTrooper(ctx, centerX - radius * 0.42, centerY + radius * 0.18, scale, colors, archetype, 0);
    drawTrooper(ctx, centerX + radius * 0.36, centerY + radius * 0.12, scale, colors, archetype, 1);
    drawTrooper(ctx, centerX, centerY - radius * 0.12, scale * 0.96, colors, archetype, 2);
  }
  drawUnitTypeSignature(ctx, unit, centerX, centerY, radius, colors);

  ctx.restore();
}

export function drawUnitMarker(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  centerX: number,
  centerY: number,
  radius: number,
  colors: { primary: string; secondary: string; detail: string }
): void {
  ctx.save();
  ctx.translate(centerX, centerY);
  const medR = Math.max(6, radius * 0.28);
  const g = ctx.createRadialGradient(-medR * 0.35, -medR * 0.35, medR * 0.1, 0, 0, medR);
  g.addColorStop(0, '#fff0be');
  g.addColorStop(0.42, colors.primary);
  g.addColorStop(1, '#2b140c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, medR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,225,130,0.92)';
  ctx.lineWidth = Math.max(1, radius * 0.08);
  ctx.stroke();
  ctx.fillStyle = colors.detail;
  ctx.font = `bold ${Math.max(7, medR * 0.95)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyphForUnit(unit.type), 0, medR * 0.04);
  ctx.fillStyle = colors.detail;
  ctx.beginPath();
  ctx.arc(medR * 0.48, -medR * 0.48, Math.max(1.6, medR * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
