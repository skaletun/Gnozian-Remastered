import { t } from '../i18n';

type CalendarSegment = {
  turns: number;
  yearsPerTurn: number;
};

// Civ-like pacing: very large year jumps early, finer granularity later.
const CALENDAR_SEGMENTS: CalendarSegment[] = [
  { turns: 50, yearsPerTurn: 40 },
  { turns: 50, yearsPerTurn: 20 },
  { turns: 40, yearsPerTurn: 10 },
  { turns: 40, yearsPerTurn: 5 },
  { turns: 40, yearsPerTurn: 4 },
  { turns: 40, yearsPerTurn: 3 },
  { turns: 40, yearsPerTurn: 2 },
  { turns: 40, yearsPerTurn: 1 },
  { turns: 80, yearsPerTurn: 1 },
  { turns: 80, yearsPerTurn: 2 },
];

const START_YEAR = -4000;
const OPEN_ENDED_YEARS_PER_TURN = 2;

export function getCalendarYearFromTurn(turn: number): number {
  let year = START_YEAR;
  let remaining = Math.max(0, Math.floor(turn) - 1);

  for (const seg of CALENDAR_SEGMENTS) {
    if (remaining <= 0) break;
    const steps = Math.min(remaining, seg.turns);
    year += steps * seg.yearsPerTurn;
    remaining -= steps;
  }

  if (remaining > 0) {
    year += remaining * OPEN_ENDED_YEARS_PER_TURN;
  }

  return Math.round(year);
}

export function formatCalendarYear(year: number): string {
  if (year >= 1) return `${year} ${t('calendar.ce')}`;
  // Historical BCE/CE representation has no year zero.
  return `${1 - year} ${t('calendar.bce')}`;
}

export function calendarYearLabelForTurn(turn: number): string {
  return formatCalendarYear(getCalendarYearFromTurn(turn));
}

