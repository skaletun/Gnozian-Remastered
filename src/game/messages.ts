import type { GameMessage, GameState } from './types';

let _msgId = 0;

export function addMessage(
  state: GameState,
  text: string,
  type: GameMessage['type'],
  relatedCivIndices?: number[]
): GameState {
  const msg: GameMessage = {
    id: _msgId++,
    turn: state.turn,
    text,
    type,
    ...(relatedCivIndices?.length ? { relatedCivIndices } : {}),
  };
  return { ...state, messages: [msg, ...state.messages].slice(0, 50) };
}
