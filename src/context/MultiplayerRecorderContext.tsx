import { createContext, useContext } from 'react';
import type { EngineStep } from '../mp/mpEngineProtocol';

export const MultiplayerRecorderContext = createContext<((step: EngineStep) => void) | null>(null);

/** When not in an online match, this is a no-op. */
export function useMultiplayerRecorder(): (step: EngineStep) => void {
  const fn = useContext(MultiplayerRecorderContext);
  return fn ?? (() => {});
}
