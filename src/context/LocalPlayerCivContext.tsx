import { createContext, useContext } from 'react';

/** Civilization index (owner slot) controlled by this client — 0 in single-player. */
export const LocalPlayerCivIndexContext = createContext<number>(0);

export function useLocalPlayerCivIndex(): number {
  return useContext(LocalPlayerCivIndexContext);
}
