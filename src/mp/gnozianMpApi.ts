/**
 * Client for Gnozian multiplayer API (PHP + SQLite).
 * Default deploy uses client-authority (no Node): browser runs the same engine as single-player;
 * server stores gameState / nextGameState. Optional: Node bundle for server-side simulation —
 * see `gnozian-mp/config.php` MpConfig::CLIENT_AUTHORITY.
 *
 * ## Session flow (typical)
 * 1. `POST /v1/matches` — host receives `hostToken` + `playerToken`, civ slot 0.
 * 2. `POST /v1/matches/:id/join` — guests receive `playerToken` + civ slot.
 * 3. Host `POST .../start` with initial `gameState` / settings when everyone is ready.
 * 4. Each active player applies steps via `POST .../apply` with `clientVersion`, `submittingCivIndex`,
 *    `steps`, and `nextGameState`. Server returns `409` + current `gameState` when versions diverge
 *    — refresh from payload and retry if appropriate.
 * 5. `GET /v1/matches/:id` polls state when `currentCivIndex` is not your slot (hotseat / async turns).
 */
import type { GameState, GameSettings } from '../game/types';
import { GNOZIAN_GAME_VERSION } from '../game/gameVersion';
import type { EngineInvokeFn, EngineStep } from './mpEngineProtocol';

export { GNOZIAN_GAME_VERSION };
export type { EngineStep, EngineInvokeFn };

export const GNOZIAN_MP_API_BASE_DEFAULT =
  'https://beforemine.tech/api/gnozian-mp';

export type GnozianMpApiErrorBody = {
  ok: false;
  error: string;
  code: string;
  serverVersion?: number;
  gameState?: GameState | null;
  serverGameVersion?: string;
  clientGameVersion?: string | null;
  /** Present when code is `not_lobby` — e.g. `playing` if the host already started. */
  matchStatus?: string;
};

export class GnozianMpApiError extends Error {
  readonly httpStatus: number;
  readonly body: GnozianMpApiErrorBody | null;

  constructor(message: string, httpStatus: number, body: GnozianMpApiErrorBody | null) {
    super(message);
    this.name = 'GnozianMpApiError';
    this.httpStatus = httpStatus;
    this.body = body;
  }
}

function versionHeaders(): Record<string, string> {
  return { 'X-Gnozian-Game-Version': GNOZIAN_GAME_VERSION };
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function mpFetch<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { parseJson?: boolean } = {},
): Promise<T> {
  const url = joinUrl(baseUrl, path);
  const { parseJson = true, ...rest } = init;
  const hdr = {
    Accept: 'application/json',
    ...versionHeaders(),
    ...(rest.headers as Record<string, string>),
  };
  const res = await fetch(url, { ...rest, headers: hdr });
  const text = await res.text();
  let data: unknown = null;
  if (text.length > 0) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const body =
      data && typeof data === 'object' && data !== null && 'error' in data
        ? (data as GnozianMpApiErrorBody)
        : null;
    const msg =
      body && typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    throw new GnozianMpApiError(msg, res.status, body);
  }
  if (!parseJson) {
    return undefined as T;
  }
  return data as T;
}

export type CreateMatchResult = {
  ok: true;
  matchId: string;
  hostToken: string;
  playerToken: string;
  civSlot: number;
  maxPlayers: number;
  gameVersion: string;
};

export async function mpCreateMatch(
  baseUrl: string,
  opts: {
    maxPlayers?: number;
    label?: string;
    lobbyPassword?: string | null;
    hostDisplayName?: string;
  } = {},
): Promise<CreateMatchResult> {
  return mpFetch(baseUrl, '/v1/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameVersion: GNOZIAN_GAME_VERSION,
      maxPlayers: opts.maxPlayers ?? 4,
      label: opts.label ?? '',
      lobbyPassword: opts.lobbyPassword ?? null,
      hostDisplayName: opts.hostDisplayName ?? 'Host',
    }),
  });
}

export type LobbyPublicResult = {
  ok: true;
  matchId: string;
  label: string;
  status: string;
  maxPlayers: number;
  playerCount: number;
  occupiedCivSlots: number[];
  hasLobbyPassword: boolean;
  stateVersion: number;
  gameVersion: string;
  /** When status is `playing`: AI-only civ indices a new player may take. */
  joinableAiSlots?: number[];
  numCivs?: number | null;
  lobbyOptions?: Record<string, unknown> | null;
  readyStates?: Array<{ civ_slot: number; ready_state: number; ready_updated_at: number | null }>;
  allReady?: boolean;
  startBlockers?: string[];
};

export async function mpGetLobbyPublic(baseUrl: string, matchId: string): Promise<LobbyPublicResult> {
  const q = new URLSearchParams({ gameVersion: GNOZIAN_GAME_VERSION });
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/lobby?${q}`, { method: 'GET' });
}

export type JoinMatchResult = {
  ok: true;
  matchId: string;
  playerToken: string;
  civSlot: number;
  gameVersion: string;
};

export async function mpJoinMatch(
  baseUrl: string,
  matchId: string,
  opts: { displayName: string; lobbyPassword?: string | null; civSlot?: number },
): Promise<JoinMatchResult> {
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameVersion: GNOZIAN_GAME_VERSION,
      displayName: opts.displayName,
      lobbyPassword: opts.lobbyPassword ?? null,
      ...(opts.civSlot !== undefined ? { civSlot: opts.civSlot } : {}),
    }),
  });
}

export async function mpSetLobbyOptions(
  baseUrl: string,
  matchId: string,
  hostToken: string,
  options: Record<string, unknown>
): Promise<{ ok: true; lobbyOptions: Record<string, unknown> | null; gameVersion: string }> {
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/options`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hostToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameVersion: GNOZIAN_GAME_VERSION,
      options,
    }),
  });
}

export async function mpSetReadyState(
  baseUrl: string,
  matchId: string,
  playerToken: string,
  ready: boolean
): Promise<{ ok: true; ready: boolean; civSlot: number; gameVersion: string }> {
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/ready`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${playerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameVersion: GNOZIAN_GAME_VERSION,
      ready,
    }),
  });
}

/** Non-host: leave lobby (removes row) or mid-game soft-disconnect (AI takes seat; same token for rejoin). */
export async function mpLeaveMatch(
  baseUrl: string,
  matchId: string,
  playerToken: string,
): Promise<{ ok: true; gameVersion: string }> {
  const q = new URLSearchParams({ gameVersion: GNOZIAN_GAME_VERSION });
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/leave?${q}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${playerToken}` },
  });
}

/** Restore a soft-disconnected seat (same player token as before). */
export async function mpRejoinMatch(
  baseUrl: string,
  matchId: string,
  playerToken: string,
): Promise<{ ok: true; matchId: string; civSlot: number; stateVersion: number; gameVersion: string }> {
  const q = new URLSearchParams({ gameVersion: GNOZIAN_GAME_VERSION });
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/rejoin?${q}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${playerToken}` },
  });
}

/** Written when a guest leaves an in-progress MP game from the pause menu (for quick reconnect). */
export const MP_LAST_DISCONNECT_STORAGE_KEY = 'gnozian_mp_last_disconnect_v1';

export type GetMatchResult = {
  ok: true;
  matchId: string;
  status: string;
  label: string;
  maxPlayers: number;
  stateVersion: number;
  updatedAt: number;
  youAreHost: boolean;
  yourCivSlot: number | null;
  players: Array<{
    id: number;
    display_name: string;
    civ_slot: number;
    is_host: number;
    joined_at: number;
    left_at?: number | null;
  }>;
  /** True when your player row has `left_at` set — call `mpRejoinMatch` to play again. */
  youDisconnected?: boolean;
  gameState: GameState | null;
  gameVersion: string;
};

export async function mpGetMatch(baseUrl: string, matchId: string, bearerToken: string): Promise<GetMatchResult> {
  const q = new URLSearchParams({ gameVersion: GNOZIAN_GAME_VERSION });
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}?${q}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
}

/** Host starts the game. Sends full `gameState` after local initGame (client-authority); server may ignore when using Node. */
export async function mpStartMatch(
  baseUrl: string,
  matchId: string,
  hostToken: string,
  payload: { settings: GameSettings; gameState?: GameState },
): Promise<{ ok: true; stateVersion: number; gameVersion: string }> {
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hostToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameVersion: GNOZIAN_GAME_VERSION,
      settings: payload.settings,
      ...(payload.gameState !== undefined ? { gameState: payload.gameState } : {}),
    }),
  });
}

/** Submit turn steps; include `nextGameState` after local simulation (client-authority). Server ignores it when using Node. */
export async function mpApplySteps(
  baseUrl: string,
  matchId: string,
  playerToken: string,
  payload: {
    clientVersion: number;
    submittingCivIndex: number;
    steps: EngineStep[];
    nextGameState?: GameState;
  },
): Promise<{ ok: true; stateVersion: number; gameVersion: string }> {
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/apply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${playerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameVersion: GNOZIAN_GAME_VERSION,
      clientVersion: payload.clientVersion,
      submittingCivIndex: payload.submittingCivIndex,
      steps: payload.steps,
      ...(payload.nextGameState !== undefined ? { nextGameState: payload.nextGameState } : {}),
    }),
  });
}

export type MpChatMessage = {
  id: number;
  civ_slot: number;
  display_name: string;
  body: string;
  created_at: number;
};

export async function mpGetChatMessages(
  baseUrl: string,
  matchId: string,
  playerToken: string,
  sinceId: number = 0,
): Promise<{ ok: true; messages: MpChatMessage[]; gameVersion: string }> {
  const q = new URLSearchParams({
    gameVersion: GNOZIAN_GAME_VERSION,
    since: String(Math.max(0, Math.floor(sinceId))),
  });
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/chat?${q}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${playerToken}` },
  });
}

export async function mpPostChatMessage(
  baseUrl: string,
  matchId: string,
  playerToken: string,
  text: string,
): Promise<{ ok: true; id: number; created_at: number; gameVersion: string }> {
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${playerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gameVersion: GNOZIAN_GAME_VERSION, text }),
  });
}

export async function mpDeleteMatch(baseUrl: string, matchId: string, hostToken: string): Promise<{ ok: true; gameVersion: string }> {
  const qs = new URLSearchParams({ gameVersion: GNOZIAN_GAME_VERSION });
  return mpFetch(baseUrl, `/v1/matches/${encodeURIComponent(matchId)}?${qs}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hostToken}` },
  });
}

export async function mpHealth(baseUrl: string): Promise<{
  ok: true;
  service: string;
  gameVersion: string;
  php: string;
  sqlite: boolean;
  clientAuthority: boolean;
  engineBundlePresent: boolean;
}> {
  return mpFetch(baseUrl, '/v1/health', { method: 'GET' });
}
