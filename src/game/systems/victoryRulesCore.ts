import type { GameAge, VictoryType } from '../types';

export function isVictoryTypeUnlockedForAge(age: GameAge | null | undefined, victory: VictoryType): boolean {
  const a = age ?? 'antiquity';
  if (victory === 'domination') return true;
  if (victory === 'culture' || victory === 'religion') return a === 'exploration' || a === 'modern';
  if (victory === 'science' || victory === 'diplomacy' || victory === 'time') return a === 'modern';
  return true;
}

