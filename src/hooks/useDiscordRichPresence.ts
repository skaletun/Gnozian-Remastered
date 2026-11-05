import { useEffect, useMemo, useRef } from 'react';
import type { GameState, Screen } from '../game/types';
import { buildDiscordRichPresence } from '../discord/buildDiscordPresence';
import { clearDiscordRichPresence, hasElectronBridge, setDiscordRichPresence } from '../utils/electronAPI';

type Params = {
  enabled: boolean;
  screen: Screen;
  gameState: GameState | null;
  showPauseMenu: boolean;
  showTechTree: boolean;
  showDiplomacy: boolean;
  openCityId: number | null;
  showAchievements: boolean;
  showHelp: boolean;
  showTutorial: boolean;
  showStats: boolean;
  showVictoryTracker: boolean;
  showGreatPeople: boolean;
  showEmpire: boolean;
  showGovernmentModal: boolean;
  showVictory: boolean;
  isProcessingTurn: boolean;
  playerCivIndex: number;
  playerNickname: string;
};

export function useDiscordRichPresence(p: Params): void {
  const gameStartRef = useRef<number | null>(null);

  const gameFingerprint = useMemo(() => {
    const g = p.gameState;
    if (!g) return `nogame|${p.screen}`;
    const c0 = g.civilizations[0];
    const alive = g.civilizations.filter(c => c.isAlive).length;
    return [
      p.screen,
      g.turn,
      g.phase,
      g.winner,
      g.victoryType,
      c0?.name,
      c0?.era,
      alive,
      g.settings.numCivs,
      g.settings.maxTurns,
      g.settings.seed,
    ].join('|');
  }, [p.gameState, p.screen]);

  useEffect(() => {
    if (p.screen === 'game' && p.gameState?.phase === 'playing') {
      if (gameStartRef.current == null) gameStartRef.current = Date.now();
    } else if (p.screen !== 'game') {
      gameStartRef.current = null;
    }
  }, [p.screen, p.gameState?.phase]);

  useEffect(() => {
    if (!hasElectronBridge()) return;
    if (!p.enabled) {
      void clearDiscordRichPresence();
      return;
    }
    const payload = buildDiscordRichPresence({
      screen: p.screen,
      gameState: p.gameState,
      showPauseMenu: p.showPauseMenu,
      showTechTree: p.showTechTree,
      showDiplomacy: p.showDiplomacy,
      openCityId: p.openCityId,
      showAchievements: p.showAchievements,
      showHelp: p.showHelp,
      showTutorial: p.showTutorial,
      showStats: p.showStats,
      showVictoryTracker: p.showVictoryTracker,
      showGreatPeople: p.showGreatPeople,
      showEmpire: p.showEmpire,
      showGovernmentModal: p.showGovernmentModal,
      showVictory: p.showVictory,
      isProcessingTurn: p.isProcessingTurn,
      playerCivIndex: p.playerCivIndex,
      playerNickname: p.playerNickname,
      gamePresenceStartMs: gameStartRef.current,
    });
    void setDiscordRichPresence(payload);
  }, [
    p.enabled,
    gameFingerprint,
    p.showPauseMenu,
    p.showTechTree,
    p.showDiplomacy,
    p.openCityId,
    p.showAchievements,
    p.showHelp,
    p.showTutorial,
    p.showStats,
    p.showVictoryTracker,
    p.showGreatPeople,
    p.showEmpire,
    p.showGovernmentModal,
    p.showVictory,
    p.isProcessingTurn,
    p.playerCivIndex,
    p.playerNickname,
    p.screen,
  ]);
}
