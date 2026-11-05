import type { GameState, Screen, VictoryType } from '../game/types';
import { CIV_TEMPLATES } from '../game/constants';

export type DiscordRichPresencePayload = {
  details?: string;
  state?: string;
  startTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  partyId?: string;
  partySize?: number;
  partyMax?: number;
  buttons?: Array<{ label: string; url: string }>;
};

export type DiscordPresenceInput = {
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
  gamePresenceStartMs: number | null;
};

const VICTORY_LABEL: Record<VictoryType, string> = {
  science: 'Science',
  culture: 'Culture',
  domination: 'Domination',
  diplomacy: 'Diplomacy',
  time: 'Time',
  religion: 'Religion',
};

function eraLabel(era: string | undefined): string {
  if (!era) return 'Ancient';
  return era.charAt(0).toUpperCase() + era.slice(1);
}

function victoryHeadline(vt: VictoryType | null | undefined, gs: GameState): { details: string; state: string } {
  const label = vt && VICTORY_LABEL[vt] ? `${VICTORY_LABEL[vt]} victory` : 'Victory';
  const winnerIdx = gs.winner ?? 0;
  const civ = gs.civilizations[winnerIdx];
  const name = civ?.name ?? 'Winner';
  return { details: label, state: name };
}

function overlayState(input: DiscordPresenceInput): string | null {
  if (input.showPauseMenu) return 'Paused';
  if (input.showTechTree) return 'Technology tree';
  if (input.showDiplomacy) return 'Diplomacy';
  if (input.openCityId != null) return 'City management';
  if (input.showEmpire) return 'Empire';
  if (input.showGovernmentModal) return 'Government';
  if (input.showGreatPeople) return 'Great people';
  if (input.showVictoryTracker) return 'Victory progress';
  if (input.showStats) return 'Statistics';
  if (input.showHelp) return 'Help';
  if (input.showTutorial) return 'Tutorial';
  if (input.showAchievements) return 'Achievements';
  if (input.showVictory) return 'Victory screen';
  return null;
}

function menuCivilizationLine(playerCivIndex: number, nickname: string): string {
  const tpl = CIV_TEMPLATES[Math.min(Math.max(0, playerCivIndex), CIV_TEMPLATES.length - 1)];
  const nick = (nickname || 'Player').trim().slice(0, 32);
  return tpl ? `${tpl.name} · ${nick}` : nick;
}

export function buildDiscordRichPresence(input: DiscordPresenceInput): DiscordRichPresencePayload {
  const {
    screen,
    gameState,
    isProcessingTurn,
    playerCivIndex,
    playerNickname,
    gamePresenceStartMs,
  } = input;

  if (screen === 'splash') {
    return {
      details: 'Gnozian',
      state: 'Loading…',
    };
  }

  if (screen === 'player_setup') {
    return {
      details: 'Gnozian',
      state: 'Player profile',
    };
  }

  if (screen === 'load_game') {
    return {
      details: 'Gnozian',
      state: 'Load game',
    };
  }

  if (screen === 'world_intro') {
    return {
      details: 'Opening the world',
      state: 'Gnozian',
    };
  }

  if (screen === 'map_editor') {
    return {
      details: 'Map editor',
      state: 'Designing a map',
    };
  }

  if (screen === 'main_menu') {
    return {
      details: 'Main menu',
      state: menuCivilizationLine(playerCivIndex, playerNickname),
    };
  }

  if (!gameState) {
    return { details: 'Gnozian', state: 'In menu' };
  }

  if (gameState.phase === 'victory' || input.showVictory) {
    const v = victoryHeadline(gameState.victoryType, gameState);
    return { details: v.details, state: v.state };
  }

  if (screen === 'game') {
    const me = gameState.civilizations[0];
    const civName = me?.name ?? 'Civilization';
    const era = eraLabel(me?.era);
    const maxT = gameState.settings.maxTurns;
    const turn = gameState.turn;
    const mp = 'Single-player';

    if (isProcessingTurn) {
      return {
        details: 'Processing turn…',
        state: `${civName} · Turn ${turn}`,
      };
    }

    const ov = overlayState(input);
    const baseState = `${civName} · ${era} · ${mp}`;

    const out: DiscordRichPresencePayload = {
      details: `Turn ${turn} / ${maxT}`,
      state: ov ? `${ov} · ${civName}` : baseState,
      startTimestamp: gamePresenceStartMs ?? undefined,
    };

    return out;
  }

  return {
    details: 'Gnozian',
    state: 'Playing',
    startTimestamp: gamePresenceStartMs ?? undefined,
  };
}
