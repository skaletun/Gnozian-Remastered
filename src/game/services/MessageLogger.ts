import type { GameState } from '../types';
import { addMessage } from '../messages';

/** Thin wrapper around `addMessage` to centralize message creation. */
export function logMessage(
  state: GameState,
  text: string,
  tag: string | undefined = undefined,
  relatedCivIndices?: number[]
): GameState {
  return addMessage(state, text, tag as any, relatedCivIndices);
}

export function createLogText(...parts: Array<string | number | null | undefined>): string {
  return parts.filter(p => p !== null && p !== undefined).join(' ');
}
