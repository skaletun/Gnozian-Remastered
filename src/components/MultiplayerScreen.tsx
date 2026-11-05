import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameSettings, GameState } from '../game/types';
import { CIV_TEMPLATES } from '../game/constants';
import { initGame } from '../game/engine';
import { initGameFromCustomMap } from '../game/engine';
import { getLanguage, t } from '../i18n';
import { civJoinOptionLabel } from '../i18n/civTemplateI18n';
import { playUiClick } from '../audio/AudioManager';
import { GnzButton, GnzPanel, GnozianDivider, GnozianGlyph, GnzNavRailBtn } from './ui';
import MapTypePreview from './MapTypePreview';
import {
  GNOZIAN_MP_API_BASE_DEFAULT,
  GNOZIAN_GAME_VERSION,
  mpCreateMatch,
  mpGetLobbyPublic,
  mpGetMatch,
  mpJoinMatch,
  mpSetLobbyOptions,
  mpSetReadyState,
  mpRejoinMatch,
  mpStartMatch,
  GnozianMpApiError,
  MP_LAST_DISCONNECT_STORAGE_KEY,
  type LobbyPublicResult,
} from '../mp/gnozianMpApi';
import { validateTerrainImport, formatTerrainImportError } from '../map/mapEditorUtils';
import type { TerrainType } from '../game/types';
import { useLayoutProfile } from '../hooks/useLayoutProfile';
import { diffMpPlayerRoster, activePlayerMap } from '../mp/mpPlayerRosterDiff';
import GameLoadingOverlay from './GameLoadingOverlay';

const API_STORAGE_KEY = 'gnozian_mp_api_base_v1';
const FAVORITES_STORAGE_KEY = 'gnozian_mp_favorites_v1';
const MY_LOBBIES_STORAGE_KEY = 'gnozian_mp_my_lobbies_v1';

type MpFavorite = { matchId: string; label?: string };
type MpMyLobby = {
  matchId: string;
  hostToken: string;
  playerToken: string;
  apiBase: string;
  label?: string;
  updatedAt: number;
};

export type MultiplayerGameStartPayload = {
  baseUrl: string;
  matchId: string;
  playerToken: string;
  hostToken: string | null;
  civSlot: number;
  role: 'host' | 'player';
  gameState: GameState;
  stateVersion: number;
};

interface Props {
  onBack: () => void;
  playerNickname: string;
  onGameStarted: (payload: MultiplayerGameStartPayload) => void;
}

/** Readable text/background on dark panels + focus ring (compact for viewport fit) */
const MP_FIELD =
  'gnz-mp-control w-full rounded-md border border-stone-600/90 px-2 py-1.5 text-xs shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] placeholder:text-stone-500 focus:border-amber-600/70 focus:outline-none focus:ring-2 focus:ring-amber-500/25';
const MP_SELECT = `${MP_FIELD} cursor-pointer`;

const MAP_TYPES: GameSettings['mapType'][] = [
  'pangaea',
  'continents',
  'archipelago',
  'highlands',
  'great_lakes',
  'inland_sea',
  'wetlands',
  'drylands',
  'shattered',
  'ring_sea',
  'random',
];

const DIFFICULTIES: GameSettings['difficulty'][] = [
  'settler',
  'chieftain',
  'warlord',
  'prince',
  'emperor',
  'deity',
];

const MAP_SIZE_PRESETS = [
  { label: 'Micro', w: 20, h: 16 },
  { label: 'Duel', w: 26, h: 20 },
  { label: 'Small', w: 34, h: 22 },
  { label: 'Standard', w: 40, h: 30 },
  { label: 'Large', w: 52, h: 36 },
  { label: 'Huge', w: 66, h: 42 },
  { label: 'Colossal', w: 72, h: 48 },
  { label: 'Immense', w: 80, h: 52 },
  { label: 'Titan', w: 92, h: 60 },
  { label: 'Vast', w: 104, h: 68 },
  { label: 'Mammoth', w: 116, h: 76 },
  { label: 'Celestial', w: 128, h: 84 },
  { label: 'Planetary', w: 180, h: 96 },
  { label: 'Mega', w: 240, h: 120 },
  { label: 'Galactic', w: 360, h: 180 },
  { label: 'Ultimate', w: 520, h: 240 },
];

export default function MultiplayerScreen({ onBack, playerNickname, onGameStarted }: Props) {
  const layout = useLayoutProfile();
  const compact = layout === 'mobile';
  const [apiBase, setApiBase] = useState(() => {
    try {
      return localStorage.getItem(API_STORAGE_KEY) || GNOZIAN_MP_API_BASE_DEFAULT;
    } catch {
      return GNOZIAN_MP_API_BASE_DEFAULT;
    }
  });
  const [tab, setTab] = useState<'create' | 'join' | 'saved'>('create');

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [lobbyLabel, setLobbyLabel] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [hostMatchId, setHostMatchId] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [hostPlayerToken, setHostPlayerToken] = useState<string | null>(null);
  const [hostCivSlot] = useState(0);
  const [copied, setCopied] = useState(false);

  const [showSetup, setShowSetup] = useState(false);
  const [mpSettings, setMpSettings] = useState<Omit<GameSettings, 'humanCivIndex' | 'humanNickname' | 'mpHumanSlots'>>({
    mapWidth: 40,
    mapHeight: 30,
    numCivs: 4,
    difficulty: 'prince',
    seed: Math.floor(Math.random() * 99999),
    maxTurns: 500,
    mapType: 'continents',
    civNames: CIV_TEMPLATES.map(c => c.name),
  });
  const [hostCivTemplate, setHostCivTemplate] = useState(0);
  const [hostNick, setHostNick] = useState(playerNickname);
  const [customTerrain, setCustomTerrain] = useState<TerrainType[][] | null>(null);
  const [customMapName, setCustomMapName] = useState<string>('');

  const [joinMatchId, setJoinMatchId] = useState('');
  const [joinName, setJoinName] = useState(playerNickname);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinPreview, setJoinPreview] = useState<LobbyPublicResult | null>(null);
  const [joinSlotPick, setJoinSlotPick] = useState<number | 'random'>('random');
  const [joinPreferredCivPick, setJoinPreferredCivPick] = useState<number | 'any'>('any');
  const [favorites, setFavorites] = useState<MpFavorite[]>([]);
  const [myLobbies, setMyLobbies] = useState<MpMyLobby[]>([]);
  const [savedBusy, setSavedBusy] = useState(false);
  const [joinedToken, setJoinedToken] = useState<string | null>(null);
  const [joinedMatchId, setJoinedMatchId] = useState<string | null>(null);
  const [joinedCivSlot, setJoinedCivSlot] = useState<number | null>(null);
  const netBusy = createBusy || joinBusy || savedBusy;

  useEffect(() => {
    try {
      localStorage.setItem(API_STORAGE_KEY, apiBase.trim());
    } catch {
      /* */
    }
  }, [apiBase]);

  useEffect(() => {
    setMpSettings(s => (s.numCivs > maxPlayers ? { ...s, numCivs: maxPlayers } : s));
  }, [maxPlayers]);

  useEffect(() => {
    try {
      const f = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = f ? (JSON.parse(f) as unknown) : [];
      setFavorites(Array.isArray(parsed) ? (parsed as MpFavorite[]) : []);
    } catch {
      setFavorites([]);
    }
    try {
      const m = localStorage.getItem(MY_LOBBIES_STORAGE_KEY);
      const parsed = m ? (JSON.parse(m) as unknown) : [];
      setMyLobbies(Array.isArray(parsed) ? (parsed as MpMyLobby[]) : []);
    } catch {
      setMyLobbies([]);
    }
  }, []);

  useEffect(() => {
    const mid = joinMatchId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(mid)) {
      setJoinPreview(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const pub = await mpGetLobbyPublic(apiBase.trim(), mid);
          if (!cancelled) setJoinPreview(pub);
        } catch {
          if (!cancelled) setJoinPreview(null);
        }
      })();
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [joinMatchId, apiBase]);

  useEffect(() => {
    if (!joinPreview) return;
    const slots =
      joinPreview.status === 'playing'
        ? (joinPreview.joinableAiSlots ?? [])
        : (() => {
            const occupied = new Set(joinPreview.occupiedCivSlots ?? []);
            const n = Number((joinPreview.lobbyOptions?.numCivs as number | undefined) ?? joinPreview.maxPlayers ?? 0);
            const out: number[] = [];
            for (let i = 0; i < n; i++) if (!occupied.has(i)) out.push(i);
            return out;
          })();
    if (joinSlotPick !== 'random' && !slots.includes(joinSlotPick)) {
      setJoinSlotPick('random');
    }
  }, [joinPreview]);

  const lobbyPollMatchId = hostMatchId ?? joinedMatchId;
  const lobbyPollToken = hostPlayerToken ?? joinedToken;

  const [lobbyPlayers, setLobbyPlayers] = useState<Array<{ display_name: string; civ_slot: number; is_host: number }>>(
    []
  );
  const [lobbyStatus, setLobbyStatus] = useState<string>('lobby');
  const [lobbyReadyStates, setLobbyReadyStates] = useState<Array<{ civ_slot: number; ready_state: number }>>([]);
  const [serverStartBlockers, setServerStartBlockers] = useState<string[]>([]);
  const [lastLobbyPollAt, setLastLobbyPollAt] = useState<number>(0);
  const [lobbyPollError, setLobbyPollError] = useState(false);
  const [lobbyNowTs, setLobbyNowTs] = useState<number>(() => Date.now());
  const lobbyPlayerSnapRef = useRef<ReturnType<typeof activePlayerMap> | null>(null);
  const [presenceToasts, setPresenceToasts] = useState<Array<{ id: string; text: string; kind: 'join' | 'leave' }>>([]);
  const blockerLabel = (code: string) => {
    const known = new Set(['need_minimum_two_players', 'players_not_ready', 'num_civs_too_small']);
    return known.has(code) ? t(`mp.blocker.${code}`) : code.split('_').join(' ');
  };
  useEffect(() => {
    const id = window.setInterval(() => setLobbyNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    lobbyPlayerSnapRef.current = null;
    setPresenceToasts([]);
  }, [lobbyPollMatchId]);

  useEffect(() => {
    if (!lobbyPollMatchId || !lobbyPollToken) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const pub = await mpGetLobbyPublic(apiBase.trim(), lobbyPollMatchId);
        if (cancelled) return;
        setLobbyStatus(pub.status);
        setLobbyReadyStates((pub.readyStates ?? []).map(x => ({ civ_slot: x.civ_slot, ready_state: x.ready_state })));
        setServerStartBlockers(pub.startBlockers ?? []);
        setLastLobbyPollAt(Date.now());
        setLobbyPollError(false);
        if (pub.status === 'playing') {
          const full = await mpGetMatch(apiBase.trim(), lobbyPollMatchId, lobbyPollToken);
          if (cancelled || !full.gameState) return;
          onGameStarted({
            baseUrl: apiBase.trim(),
            matchId: lobbyPollMatchId,
            playerToken: lobbyPollToken,
            hostToken: hostMatchId ? hostToken : null,
            civSlot: hostMatchId ? hostCivSlot : (joinedCivSlot ?? 0),
            role: hostMatchId ? 'host' : 'player',
            gameState: full.gameState,
            stateVersion: full.stateVersion,
          });
        } else {
          const full = await mpGetMatch(apiBase.trim(), lobbyPollMatchId, lobbyPollToken);
          if (cancelled) return;
          const { joined, left } = diffMpPlayerRoster(lobbyPlayerSnapRef.current, full.players);
          lobbyPlayerSnapRef.current = activePlayerMap(full.players);
          if (joined.length > 0 || left.length > 0) {
            const nextToasts: Array<{ id: string; text: string; kind: 'join' | 'leave' }> = [];
            for (const p of joined) {
              nextToasts.push({
                id: `j-${p.id}-${Math.random().toString(36).slice(2)}`,
                text: t('mp.notifyJoined', { name: p.display_name }),
                kind: 'join',
              });
            }
            for (const p of left) {
              nextToasts.push({
                id: `l-${p.id}-${Math.random().toString(36).slice(2)}`,
                text: t('mp.notifyLeft', { name: p.display_name }),
                kind: 'leave',
              });
            }
            setPresenceToasts(prev => [...prev, ...nextToasts].slice(-8));
            for (const x of nextToasts) {
              const tid = x.id;
              window.setTimeout(() => {
                setPresenceToasts(cur => cur.filter(y => y.id !== tid));
              }, 4500);
            }
          }
          setLobbyPlayers(
            full.players.map(p => ({ display_name: p.display_name, civ_slot: p.civ_slot, is_host: p.is_host }))
          );
        }
      } catch {
        setLobbyPollError(true);
      }
    };
    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [apiBase, lobbyPollMatchId, lobbyPollToken, hostToken, hostMatchId, hostCivSlot, joinedCivSlot, onGameStarted, t]);

  useEffect(() => {
    if (!hostMatchId || !hostToken || lobbyStatus !== 'lobby') return;
    const options: Record<string, unknown> = {
      numCivs: mpSettings.numCivs,
      mapType: mpSettings.mapType,
      mapSeed: mpSettings.seed,
      mapWidth: mpSettings.mapWidth,
      mapHeight: mpSettings.mapHeight,
      difficulty: mpSettings.difficulty,
      maxTurns: mpSettings.maxTurns,
      customMapHash: customTerrain
        ? btoa(unescape(encodeURIComponent(JSON.stringify(customTerrain)))).slice(0, 24)
        : null,
      customMapName: customTerrain ? (customMapName || t('mp.importedMap')) : null,
    };
    const id = window.setTimeout(() => {
      void mpSetLobbyOptions(apiBase.trim(), hostMatchId, hostToken, options).catch(() => {
        /* sync silently */
      });
    }, 260);
    return () => window.clearTimeout(id);
  }, [
    apiBase,
    customMapName,
    customTerrain,
    hostMatchId,
    hostToken,
    lobbyStatus,
    mpSettings.mapHeight,
    mpSettings.mapType,
    mpSettings.mapWidth,
    mpSettings.maxTurns,
    mpSettings.numCivs,
    mpSettings.seed,
    mpSettings.difficulty,
  ]);

  const maxOccupiedSlot = useMemo(() => {
    if (lobbyPlayers.length === 0) return 0;
    return Math.max(...lobbyPlayers.map(p => p.civ_slot));
  }, [lobbyPlayers]);
  const hostStartBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (mpSettings.numCivs < maxOccupiedSlot + 1) blockers.push(t('mp.needMoreCivs'));
    if (lobbyPlayers.length < 2) blockers.push(t('mp.blocker.needTwoConnectedPlayers'));
    if (lobbyPlayers.length > mpSettings.numCivs) blockers.push(t('mp.blocker.playersExceedCivs'));
    if (customTerrain && (customTerrain.length < 6 || (customTerrain[0]?.length ?? 0) < 6)) {
      blockers.push(t('mp.blocker.customMapTooSmall'));
    }
    return blockers;
  }, [customTerrain, lobbyPlayers.length, maxOccupiedSlot, mpSettings.numCivs]);
  const mySlot = hostMatchId ? hostCivSlot : (joinedCivSlot ?? 0);
  const myReady = lobbyReadyStates.find(x => x.civ_slot === mySlot)?.ready_state === 1;
  const readyCount = lobbyReadyStates.filter(x => x.ready_state === 1).length;
  const preflightOk = hostStartBlockers.length === 0 && serverStartBlockers.length === 0;
  const syncState: 'synced' | 'syncing' | 'outdated' = (() => {
    if (lobbyPollError) return 'outdated';
    const delta = lobbyNowTs - lastLobbyPollAt;
    if (!lastLobbyPollAt || delta > 7000) return 'syncing';
    return 'synced';
  })();
  const syncText =
    syncState === 'synced' ? t('mp.syncSynced') : syncState === 'syncing' ? t('mp.syncSyncing') : t('mp.syncOutdated');
  const notReadyPlayers = lobbyPlayers
    .filter(p => lobbyReadyStates.find(x => x.civ_slot === p.civ_slot)?.ready_state !== 1)
    .map(p => ({ name: p.display_name, slot: p.civ_slot }));

  const persistMyLobby = (base: string, matchId: string, hTok: string, pTok: string, label: string) => {
    try {
      const next: MpMyLobby = {
        matchId,
        hostToken: hTok,
        playerToken: pTok,
        apiBase: base,
        label: label.trim() || undefined,
        updatedAt: Date.now(),
      };
      const raw = localStorage.getItem(MY_LOBBIES_STORAGE_KEY);
      const existing: MpMyLobby[] = (() => {
        try {
          const p = raw ? (JSON.parse(raw) as unknown) : [];
          return Array.isArray(p) ? (p as MpMyLobby[]) : [];
        } catch {
          return [];
        }
      })();
      const merged = [next, ...existing.filter(x => x.matchId !== matchId)].slice(0, 15);
      localStorage.setItem(MY_LOBBIES_STORAGE_KEY, JSON.stringify(merged));
      setMyLobbies(merged);
    } catch {
      /* */
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    setCreateBusy(true);
    try {
      const r = await mpCreateMatch(apiBase.trim(), {
        maxPlayers,
        label: lobbyLabel.trim(),
        lobbyPassword: createPassword.trim() || null,
        hostDisplayName: hostNick.trim() || t('mp.defaultHostName'),
      });
      setHostMatchId(r.matchId);
      setHostToken(r.hostToken);
      setHostPlayerToken(r.playerToken);
      persistMyLobby(apiBase.trim(), r.matchId, r.hostToken, r.playerToken, lobbyLabel);
    } catch (e) {
      setCreateError(e instanceof GnozianMpApiError ? e.message : String(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleJoin = async () => {
    setJoinError(null);
    const mid = joinMatchId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(mid)) {
      setJoinError(t('mp.invalidMatchIdFormat'));
      return;
    }
    setJoinBusy(true);
    try {
      let pub: LobbyPublicResult;
      try {
        pub = await mpGetLobbyPublic(apiBase.trim(), mid);
      } catch (e) {
        setJoinError(e instanceof GnozianMpApiError ? e.message : t('mp.joinLookupFailed'));
        return;
      }

      const displayName = joinName.trim() || t('mp.defaultPlayerName');
      const lobbyPassword = joinPassword.trim() || null;
      let preferredAutoSlot: number | undefined;
      if (joinPreferredCivPick !== 'any') {
        const preferred = Number(joinPreferredCivPick);
        if (joinSelectableSlots.includes(preferred)) preferredAutoSlot = preferred;
      }

      if (pub.status === 'lobby') {
        const requestedSlot =
          joinSlotPick !== 'random'
            ? joinSlotPick
            : preferredAutoSlot !== undefined
              ? preferredAutoSlot
              : undefined;
        const r = await mpJoinMatch(apiBase.trim(), mid, {
          displayName,
          lobbyPassword,
          ...(requestedSlot !== undefined ? { civSlot: requestedSlot } : {}),
        });
        setJoinedMatchId(r.matchId);
        setJoinedToken(r.playerToken);
        setJoinedCivSlot(r.civSlot);
        return;
      }

      if (pub.status === 'playing') {
        const slots = pub.joinableAiSlots ?? [];
        if (slots.length === 0) {
          setJoinError(t('mp.noAiSlots'));
          return;
        }
        let civSlot: number | undefined;
        if (joinSlotPick !== 'random') {
          if (!slots.includes(joinSlotPick)) {
            setJoinError(t('mp.joinSlotInvalid'));
            return;
          }
          civSlot = joinSlotPick;
        } else if (preferredAutoSlot !== undefined) {
          civSlot = preferredAutoSlot;
        }
        const r = await mpJoinMatch(apiBase.trim(), mid, {
          displayName,
          lobbyPassword,
          ...(civSlot !== undefined ? { civSlot } : {}),
        });
        const full = await mpGetMatch(apiBase.trim(), mid, r.playerToken);
        if (!full.gameState) {
          setJoinError(t('mp.startError'));
          return;
        }
        onGameStarted({
          baseUrl: apiBase.trim(),
          matchId: mid,
          playerToken: r.playerToken,
          hostToken: null,
          civSlot: r.civSlot,
          role: 'player',
          gameState: full.gameState,
          stateVersion: full.stateVersion,
        });
        return;
      }

      setJoinError(t('mp.joinWrongStatus', { status: pub.status }));
    } catch (e) {
      if (e instanceof GnozianMpApiError && e.body?.code === 'not_lobby') {
        const st = e.body.matchStatus;
        setJoinError(
          st === 'playing'
            ? t('mp.joinAlreadyPlaying')
            : t('mp.joinWrongStatus', { status: st ?? '?' }),
        );
      } else {
        setJoinError(e instanceof GnozianMpApiError ? e.message : String(e));
      }
    } finally {
      setJoinBusy(false);
    }
  };

  const saveFavoriteFromJoinField = () => {
    const mid = joinMatchId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(mid)) return;
    try {
      const label = joinPreview?.label?.trim() || undefined;
      const next: MpFavorite[] = [{ matchId: mid, label }, ...favorites.filter(f => f.matchId !== mid)].slice(0, 24);
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      setFavorites(next);
    } catch {
      /* */
    }
  };

  const removeFavorite = (matchId: string) => {
    try {
      const next = favorites.filter(f => f.matchId !== matchId);
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      setFavorites(next);
    } catch {
      /* */
    }
  };

  const forgetMyLobby = (matchId: string) => {
    try {
      const next = myLobbies.filter(x => x.matchId !== matchId);
      localStorage.setItem(MY_LOBBIES_STORAGE_KEY, JSON.stringify(next));
      setMyLobbies(next);
    } catch {
      /* */
    }
  };

  const resumeMyLobby = async (row: MpMyLobby) => {
    setSavedBusy(true);
    setCreateError(null);
    setJoinError(null);
    try {
      setApiBase(row.apiBase);
      const full = await mpGetMatch(row.apiBase, row.matchId, row.playerToken);
      if (full.status === 'playing' && full.gameState) {
        onGameStarted({
          baseUrl: row.apiBase,
          matchId: row.matchId,
          playerToken: row.playerToken,
          hostToken: row.hostToken,
          civSlot: full.yourCivSlot ?? 0,
          role: 'host',
          gameState: full.gameState,
          stateVersion: full.stateVersion,
        });
        return;
      }
      setHostMatchId(row.matchId);
      setHostToken(row.hostToken);
      setHostPlayerToken(row.playerToken);
    } catch (e) {
      setJoinError(e instanceof GnozianMpApiError ? e.message : String(e));
    } finally {
      setSavedBusy(false);
    }
  };

  const reconnectLastDisconnect = async () => {
    setJoinError(null);
    let snap: { matchId: string; playerToken: string; baseUrl: string };
    try {
      const raw = localStorage.getItem(MP_LAST_DISCONNECT_STORAGE_KEY);
      if (!raw) {
        setJoinError(t('mp.reconnectNone'));
        return;
      }
      snap = JSON.parse(raw) as { matchId: string; playerToken: string; baseUrl: string };
    } catch {
      setJoinError(t('mp.reconnectNone'));
      return;
    }
    setSavedBusy(true);
    try {
      setApiBase(snap.baseUrl);
      await mpRejoinMatch(snap.baseUrl, snap.matchId, snap.playerToken);
      const full = await mpGetMatch(snap.baseUrl, snap.matchId, snap.playerToken);
      if (!full.gameState) {
        setJoinError(t('mp.startError'));
        return;
      }
      onGameStarted({
        baseUrl: snap.baseUrl,
        matchId: snap.matchId,
        playerToken: snap.playerToken,
        hostToken: null,
        civSlot: full.yourCivSlot ?? 0,
        role: 'player',
        gameState: full.gameState,
        stateVersion: full.stateVersion,
      });
      try {
        localStorage.removeItem(MP_LAST_DISCONNECT_STORAGE_KEY);
      } catch {
        /* */
      }
    } catch (e) {
      setJoinError(e instanceof GnozianMpApiError ? e.message : String(e));
    } finally {
      setSavedBusy(false);
    }
  };

  const handleHostStart = async () => {
    if (!hostMatchId || !hostToken || !hostPlayerToken) return;
    setCreateError(null);
    if (hostStartBlockers.length > 0) {
      setCreateError(hostStartBlockers[0] ?? t('mp.needMoreCivs'));
      return;
    }
    setCreateBusy(true);
    try {
      const lobbySnap = await mpGetMatch(apiBase.trim(), hostMatchId, hostPlayerToken);
      const slots = [...new Set(lobbySnap.players.map(p => p.civ_slot))].sort((a, b) => a - b);
      if (slots.length === 0) {
        setCreateError(t('mp.noPlayersInLobby'));
        return;
      }
      const fullSettings: GameSettings = {
        ...mpSettings,
        humanCivIndex: Math.max(0, Math.min(CIV_TEMPLATES.length - 1, hostCivTemplate)),
        humanNickname: hostNick.trim().slice(0, 48),
        mpHumanSlots: slots,
        ...(customTerrain
          ? {
              customMapName: customMapName || t('mp.importedMap'),
              customMapHash: btoa(unescape(encodeURIComponent(JSON.stringify(customTerrain)))).slice(0, 24),
            }
          : {}),
      };
      const gameState = customTerrain ? initGameFromCustomMap(fullSettings, customTerrain) : initGame(fullSettings);
      await mpStartMatch(apiBase.trim(), hostMatchId, hostToken, {
        settings: fullSettings,
        gameState,
      });
      const full = await mpGetMatch(apiBase.trim(), hostMatchId, hostPlayerToken);
      if (!full.gameState) {
        setCreateError(t('mp.startError'));
        return;
      }
      onGameStarted({
        baseUrl: apiBase.trim(),
        matchId: hostMatchId,
        playerToken: hostPlayerToken,
        hostToken,
        civSlot: hostCivSlot,
        role: 'host',
        gameState: full.gameState,
        stateVersion: full.stateVersion,
      });
    } catch (e) {
      setCreateError(e instanceof GnozianMpApiError ? e.message : t('mp.startError'));
    } finally {
      setCreateBusy(false);
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* */
    }
  };

  const inHostLobby = hostMatchId && hostToken && hostPlayerToken;
  const inJoinWait = joinedMatchId && joinedToken && joinedCivSlot !== null;
  const joinSelectableSlots = useMemo(() => {
    if (!joinPreview) return [];
    if (joinPreview.status === 'playing') {
      return [...(joinPreview.joinableAiSlots ?? [])].sort((a, b) => a - b);
    }
    if (joinPreview.status === 'lobby') {
      const occupied = new Set(joinPreview.occupiedCivSlots ?? []);
      const n = Number((joinPreview.lobbyOptions?.numCivs as number | undefined) ?? joinPreview.maxPlayers ?? 0);
      const out: number[] = [];
      for (let i = 0; i < n; i++) if (!occupied.has(i)) out.push(i);
      return out;
    }
    return [];
  }, [joinPreview]);
  const joinPreferredCivOptions = useMemo(() => {
    if (!joinPreview || joinSelectableSlots.length === 0) return [];
    return joinSelectableSlots
      .filter(slot => slot >= 0 && slot < CIV_TEMPLATES.length)
      .map(slot => ({
        slot,
        label:
          CIV_TEMPLATES[slot] != null
            ? civJoinOptionLabel(CIV_TEMPLATES[slot]!, t)
            : `${t('mp.civUnknown')} — ${t('mp.leaderUnknown')}`,
      }));
  }, [joinPreview, joinSelectableSlots, t]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden gnz-page-bg">
      {presenceToasts.length > 0 && (
        <div className="pointer-events-none fixed right-3 top-[4.5rem] z-[200] flex max-w-[min(90vw,20rem)] flex-col gap-2">
          {presenceToasts.map(x => (
            <div
              key={x.id}
              className={`rounded-lg border px-3 py-2 text-sm shadow-xl backdrop-blur-sm ${
                x.kind === 'join'
                  ? 'border-emerald-700/60 bg-emerald-950/90 text-emerald-100'
                  : 'border-rose-800/60 bg-rose-950/90 text-rose-100'
              }`}
            >
              {x.text}
            </div>
          ))}
        </div>
      )}
      <div
        className={`relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col ${
          compact ? 'px-1.5 py-1' : 'px-2 py-1.5 sm:px-3 sm:py-3'
        }`}
      >
        <GnzPanel className="flex min-h-0 flex-1 flex-col overflow-hidden border border-cyan-200/20 bg-gradient-to-b from-slate-950/98 via-slate-950/95 to-black p-0 shadow-2xl lg:flex-row">
          {!inHostLobby && !inJoinWait ? (
            <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto overscroll-x-contain border-b border-cyan-200/[0.12] bg-black/35 px-2 py-2 lg:w-[13.75rem] lg:flex-col lg:gap-1 lg:border-b-0 lg:border-r lg:border-cyan-200/[0.1] lg:px-3 lg:py-5">
              <GnzNavRailBtn
                active={tab === 'create'}
                onClick={() => {
                  playUiClick();
                  setTab('create');
                }}
              >
                {t('mp.createTab')}
              </GnzNavRailBtn>
              <GnzNavRailBtn
                active={tab === 'join'}
                onClick={() => {
                  playUiClick();
                  setTab('join');
                }}
              >
                {t('mp.joinTab')}
              </GnzNavRailBtn>
              <GnzNavRailBtn
                active={tab === 'saved'}
                onClick={() => {
                  playUiClick();
                  setJoinError(null);
                  setTab('saved');
                }}
              >
                {t('mp.savedTab')}
              </GnzNavRailBtn>
            </aside>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col lg:min-w-0">
          <div className={`shrink-0 border-b border-cyan-200/[0.1] bg-black/25 ${
            compact ? 'px-2 pb-2 pt-2' : 'px-2.5 pb-2 pt-2.5 sm:px-3 sm:pb-2.5 sm:pt-3'
          }`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-base font-bold text-amber-100/95 sm:text-lg">
                <GnozianGlyph name="globe" size={20} className="shrink-0 text-sky-300/90" />
                <span className="min-w-0 leading-tight">{t('mp.title')}</span>
              </h2>
              <GnzButton
                audioOnClick
                variant="ghost"
                className={`shrink-0 ${compact ? 'px-2 py-1 text-[11px]' : 'px-2 py-1.5 text-xs sm:px-3 sm:text-sm'}`}
                onClick={onBack}
              >
                {t('mp.back')}
              </GnzButton>
            </div>
            <p className={`gnz-subtle leading-snug ${compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'}`}>
              {t('menu.version')} · {getLanguage() === 'ru' ? 'Протокол' : 'Protocol'} v{GNOZIAN_GAME_VERSION}
            </p>
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] [color-scheme:dark] ${
            compact ? 'px-2 py-2' : 'px-2.5 py-2 sm:px-3 sm:py-2.5'
          }`}>
            <GnozianDivider className="mb-2 opacity-70" />

          {!inHostLobby && !inJoinWait && (
            <>
              {tab === 'create' && (
                <div className="space-y-2.5 sm:space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-stone-400">{t('mp.maxPlayers')}</label>
                    <input
                      type="range"
                      min={2}
                      max={8}
                      value={maxPlayers}
                      onChange={e => setMaxPlayers(+e.target.value)}
                      className="h-2 w-full cursor-pointer accent-amber-500"
                    />
                    <div className="text-center text-sm text-amber-200/90">{maxPlayers}</div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-stone-400">{t('mp.lobbyLabel')}</label>
                    <input value={lobbyLabel} onChange={e => setLobbyLabel(e.target.value)} className={MP_FIELD} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-stone-400">{t('mp.lobbyPassword')}</label>
                    <input
                      type="password"
                      value={createPassword}
                      onChange={e => setCreatePassword(e.target.value)}
                      className={MP_FIELD}
                    />
                  </div>
                  {createError && <p className="text-sm text-red-400">{createError}</p>}
                  <GnzButton audioOnClick variant="primary" className="w-full py-3" disabled={createBusy} onClick={() => void handleCreate()}>
                    {createBusy ? '…' : t('mp.create')}
                  </GnzButton>
                </div>
              )}

              {tab === 'join' && (
                <div className="space-y-2.5 sm:space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-stone-400">{t('mp.matchId')}</label>
                    <input
                      value={joinMatchId}
                      onChange={e => setJoinMatchId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className={`${MP_FIELD} font-mono text-[11px] sm:text-xs`}
                    />
                    <p className="gnz-subtle mt-1 text-[10px]">{t('mp.matchIdHint')}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-stone-400">{t('mp.displayName')}</label>
                    <input value={joinName} onChange={e => setJoinName(e.target.value)} className={MP_FIELD} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-stone-400">{t('mp.lobbyPassword')}</label>
                    <input
                      type="password"
                      value={joinPassword}
                      onChange={e => setJoinPassword(e.target.value)}
                      className={MP_FIELD}
                    />
                  </div>
                  {joinPreview && joinSelectableSlots.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs text-stone-400">
                        {joinPreview.status === 'playing' ? t('mp.joinPickAiSlot') : t('mp.slot')}
                      </label>
                      <select
                        className={MP_SELECT}
                        value={joinSlotPick === 'random' ? '' : String(joinSlotPick)}
                        onChange={e => {
                          const v = e.target.value;
                          setJoinSlotPick(v === '' ? 'random' : Number(v));
                        }}
                      >
                        <option value="">{joinPreview.status === 'playing' ? t('mp.joinRandomAi') : t('mp.joinAnyFreeSlot')}</option>
                        {joinSelectableSlots.map(s => (
                          <option key={s} value={String(s)}>
                            {t('mp.joinAiSlotOption', { slot: s })}
                          </option>
                        ))}
                      </select>
                      {joinPreview.status === 'playing' && (
                        <p className="gnz-subtle mt-1 text-[10px]">{t('mp.joinMidGameHint')}</p>
                      )}
                    </div>
                  )}
                  {joinPreview && joinPreferredCivOptions.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs text-stone-400">{t('mp.preferredCiv')}</label>
                      <select
                        className={MP_SELECT}
                        value={joinPreferredCivPick === 'any' ? '' : String(joinPreferredCivPick)}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === '') {
                            setJoinPreferredCivPick('any');
                            return;
                          }
                          const slot = Number(v);
                          setJoinPreferredCivPick(slot);
                          if (joinSelectableSlots.includes(slot)) {
                            setJoinSlotPick(slot);
                          }
                        }}
                      >
                        <option value="">{t('mp.preferredCivAny')}</option>
                        {joinPreferredCivOptions.map(opt => (
                          <option key={opt.slot} value={String(opt.slot)}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="gnz-subtle mt-1 text-[10px]">{t('mp.preferredCivHint')}</p>
                    </div>
                  )}
                  {joinPreview && (
                    <div className="space-y-1.5 rounded border border-stone-700/60 bg-stone-900/40 px-2 py-2 text-[11px] text-stone-400">
                      <p>
                        {t('mp.lobbyStatusLine', {
                          status:
                            joinPreview.status === 'playing'
                              ? t('mp.lobbyPlaying')
                              : joinPreview.status === 'lobby'
                                ? t('mp.lobbyWaiting')
                                : joinPreview.status,
                          players: String(joinPreview.playerCount),
                          max: String(joinPreview.maxPlayers),
                        })}
                      </p>
                      {joinPreview.lobbyOptions && (
                        <p className="text-stone-300/85">
                          {t('mp.lobbyParams')}: {t('newGame.mapType')}: {String(joinPreview.lobbyOptions.mapType ?? '—')} · {t('mp.numCivs')}: {String(joinPreview.lobbyOptions.numCivs ?? '—')} · {t('newGame.seed')}: {String(joinPreview.lobbyOptions.mapSeed ?? '—')}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <GnzButton
                      audioOnClick
                      variant="secondary"
                      className="py-1.5 text-xs"
                      type="button"
                      onClick={saveFavoriteFromJoinField}
                    >
                      {t('mp.favoriteAdd')}
                    </GnzButton>
                  </div>
                  {joinError && <p className="text-sm text-red-400">{joinError}</p>}
                  <GnzButton audioOnClick variant="primary" className="w-full py-3" disabled={joinBusy} onClick={() => void handleJoin()}>
                    {joinBusy ? '…' : t('mp.join')}
                  </GnzButton>
                </div>
              )}

              {tab === 'saved' && (
                <div className="space-y-3 sm:space-y-4">
                  {joinError && <p className="text-sm text-red-400">{joinError}</p>}
                  <p className="text-[11px] text-stone-400">{t('mp.savedHint')}</p>
                  <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-3">
                    <div className="mb-1 text-xs font-medium text-emerald-200/90">{t('mp.reconnectTitle')}</div>
                    <GnzButton
                      audioOnClick
                      variant="primary"
                      className="w-full py-2 text-sm"
                      disabled={savedBusy}
                      onClick={() => void reconnectLastDisconnect()}
                    >
                      {savedBusy ? '…' : t('mp.reconnectAction')}
                    </GnzButton>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium text-stone-300">{t('mp.myLobbies')}</div>
                    {myLobbies.length === 0 ? (
                      <p className="text-xs text-stone-500">{t('mp.myLobbiesEmpty')}</p>
                    ) : (
                      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                        {myLobbies.map(row => (
                          <li
                            key={row.matchId}
                            className="flex flex-col gap-1 rounded border border-stone-700/80 bg-stone-900/70 p-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 font-mono text-[11px] text-stone-200">
                              <div className="truncate">{row.label || row.matchId}</div>
                              <div className="truncate text-stone-500">{row.matchId}</div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <GnzButton
                                audioOnClick
                                variant="primary"
                                className="px-2 py-1 text-xs"
                                disabled={savedBusy}
                                onClick={() => void resumeMyLobby(row)}
                              >
                                {t('mp.resume')}
                              </GnzButton>
                              <GnzButton
                                audioOnClick
                                variant="ghost"
                                className="px-2 py-1 text-xs"
                                onClick={() => forgetMyLobby(row.matchId)}
                              >
                                {t('mp.forget')}
                              </GnzButton>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium text-stone-300">{t('mp.favorites')}</div>
                    {favorites.length === 0 ? (
                      <p className="text-xs text-stone-500">{t('mp.favoritesEmpty')}</p>
                    ) : (
                      <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
                        {favorites.map(f => (
                          <li
                            key={f.matchId}
                            className="flex items-center justify-between gap-2 rounded bg-stone-900/80 px-2 py-1"
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-sky-200 hover:underline"
                              onClick={() => {
                                playUiClick();
                                setJoinMatchId(f.matchId);
                                setTab('join');
                              }}
                            >
                              {f.label || f.matchId}
                            </button>
                            <GnzButton
                              audioOnClick
                              variant="ghost"
                              className="shrink-0 px-2 py-0.5 text-[10px]"
                              onClick={() => removeFavorite(f.matchId)}
                            >
                              {t('mp.favoriteRemove')}
                            </GnzButton>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {(inHostLobby || inJoinWait) && lobbyStatus !== 'playing' && (
            <div className="grid gap-2 sm:gap-3 lg:grid-cols-[1.15fr_1fr] lg:items-start">
              <div className="space-y-2 sm:space-y-2.5">
              <div className="rounded-lg border border-sky-800/50 bg-sky-950/40 p-2 sm:p-2.5">
                <div className="mb-1 text-xs text-sky-300/80">{t('mp.matchId')}</div>
                <div className="allow-text-select flex items-center gap-2 break-all font-mono text-[11px] text-sky-100">
                  {(hostMatchId ?? joinedMatchId) || ''}
                </div>
                <GnzButton
                  audioOnClick
                  variant="secondary"
                  className="mt-2 w-full py-1.5 text-xs"
                  onClick={() => void copyId((hostMatchId ?? joinedMatchId)!)}
                >
                  {copied ? t('mp.copied') : t('mp.copyId')}
                </GnzButton>
              </div>

              {inHostLobby && (
                <p className="text-[11px] leading-relaxed text-amber-200/70">{t('mp.hostTokensHint')}</p>
              )}
              <p className="text-[11px] text-stone-400">{t('mp.playerTokenHint')}</p>

              <div>
                <div className="mb-2 text-sm font-medium text-stone-300">{t('mp.players')}</div>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-stone-200">
                  {lobbyPlayers.map(p => (
                    <li key={p.civ_slot} className="flex justify-between rounded bg-stone-900/80 px-2 py-1">
                      <span>{p.display_name}</span>
                      <span className="text-stone-500 inline-flex items-center gap-1">
                        {t('mp.slot')} {p.civ_slot}
                        {lobbyReadyStates.find(x => x.civ_slot === p.civ_slot)?.ready_state === 1 ? (
                          <span className="rounded border border-emerald-700/60 bg-emerald-900/30 px-1 text-[10px] text-emerald-300">{t('mp.ready')}</span>
                        ) : (
                          <span className="rounded border border-stone-700 px-1 text-[10px] text-stone-400">{t('mp.notReady')}</span>
                        )}
                        {p.is_host ? ` · ${t('mp.host')}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-center text-sm text-stone-400">{t('mp.waitHost')}</p>
              {hostStartBlockers.length > 0 && (
                <div className="rounded-lg border border-amber-900/35 bg-amber-950/30 px-2 py-2 text-xs text-amber-100/90">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">{t('mp.startBlockersTitle')}</div>
                  <ul className="space-y-0.5 text-[11px]">
                    {hostStartBlockers.map((b, i) => (
                      <li key={`${b}-${i}`}>- {b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {serverStartBlockers.length > 0 && (
                <div className="rounded-lg border border-red-900/35 bg-red-950/20 px-2 py-2 text-xs text-red-200/90">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-300/90">{t('mp.serverBlockersTitle')}</div>
                  <ul className="space-y-0.5 text-[11px]">
                    {serverStartBlockers.map((b, i) => (
                      <li key={`${b}-${i}`}>- {blockerLabel(b)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {notReadyPlayers.length > 0 && (
                <div className="rounded-lg border border-stone-700 bg-stone-900/55 px-2 py-2 text-xs text-stone-200">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                    {t('mp.blocker.playersListTitle')}
                  </div>
                  <ul className="space-y-0.5 text-[11px]">
                    {notReadyPlayers.map(p => (
                      <li key={`${p.slot}-${p.name}`} className="flex items-center justify-between">
                        <span className="truncate pr-2">{p.name}</span>
                        <span className="shrink-0 text-stone-500">{t('mp.slot')} {p.slot}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={`rounded-lg border px-2 py-2 text-xs ${preflightOk ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-200' : 'border-stone-700 bg-stone-900/50 text-stone-200'}`}>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide">{t('mp.preflightTitle')}</div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>{t('mp.preflightReady')}</span>
                  <span className="tabular-nums">{readyCount}/{Math.max(1, lobbyPlayers.length)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span>{preflightOk ? t('mp.preflightStartAllowed') : t('mp.preflightStartBlocked')}</span>
                  <span className={`font-semibold ${preflightOk ? 'text-emerald-300' : 'text-amber-300'}`}>{preflightOk ? t('mp.ok') : t('mp.blocked')}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span>{t('mp.syncState')}</span>
                  <span
                    className={`font-semibold ${
                      syncState === 'synced' ? 'text-emerald-300' : syncState === 'syncing' ? 'text-sky-300' : 'text-red-300'
                    }`}
                  >
                    {syncText}
                  </span>
                </div>
              </div>
              <GnzButton
                audioOnClick
                variant="secondary"
                className="w-full py-1.5 text-xs"
                onClick={() => {
                  const token = (hostPlayerToken ?? joinedToken);
                  const mid = (hostMatchId ?? joinedMatchId);
                  if (!token || !mid) return;
                  const nextReady = !myReady;
                  setLobbyReadyStates(prev => {
                    const copy = [...prev];
                    const ix = copy.findIndex(x => x.civ_slot === mySlot);
                    if (ix >= 0) copy[ix] = { ...copy[ix], ready_state: nextReady ? 1 : 0 };
                    else copy.push({ civ_slot: mySlot, ready_state: nextReady ? 1 : 0 });
                    return copy;
                  });
                  void mpSetReadyState(apiBase.trim(), mid, token, nextReady).catch((e: unknown) => {
                    setLobbyReadyStates(prev => {
                      const copy = [...prev];
                      const ix = copy.findIndex(x => x.civ_slot === mySlot);
                      if (ix >= 0) copy[ix] = { ...copy[ix], ready_state: myReady ? 1 : 0 };
                      return copy;
                    });
                    setJoinError(e instanceof GnozianMpApiError ? e.message : String(e));
                  });
                }}
              >
                {myReady ? t('mp.setNotReady') : t('mp.setReady')}
              </GnzButton>
              </div>

              {inHostLobby && (
                <div className="space-y-2 sm:space-y-2.5">
                  <GnzButton
                    audioOnClick
                    variant="secondary"
                    className="w-full py-1.5 text-xs"
                    onClick={() => setShowSetup(s => !s)}
                  >
                    {showSetup ? '▼' : '▶'} {t('mp.configure')}
                  </GnzButton>

                  {showSetup && (
                    <div className="flex max-h-[min(48vh,360px)] flex-col overflow-hidden rounded-lg border border-stone-700 bg-stone-950/60">
                      <div className="shrink-0 border-b border-stone-800/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
                        {t('mp.configure')}
                      </div>
                      <div className="min-h-0 space-y-1.5 overflow-y-auto overscroll-y-contain px-2 py-2 sm:space-y-2">
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('mp.numCivs')}</label>
                        <input
                          type="range"
                          min={Math.max(2, maxOccupiedSlot + 1)}
                          max={CIV_TEMPLATES.length}
                          value={mpSettings.numCivs}
                          onChange={e =>
                            setMpSettings(s => ({
                              ...s,
                              numCivs: +e.target.value,
                              civNames: CIV_TEMPLATES.slice(0, +e.target.value).map(c => c.name),
                            }))
                          }
                          className="h-1.5 w-full cursor-pointer accent-amber-500"
                        />
                        <div className="text-center text-[11px] text-amber-200/90">{mpSettings.numCivs}</div>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('newGame.mapType')}</label>
                        <select
                          value={mpSettings.mapType}
                          onChange={e => setMpSettings(s => ({ ...s, mapType: e.target.value as GameSettings['mapType'] }))}
                          className={MP_SELECT}
                        >
                          {MAP_TYPES.map(mt => (
                            <option key={mt} value={mt}>
                              {t(`newGame.mapType.${mt}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('newGame.mapSize')}</label>
                        <div className="grid grid-cols-3 gap-1">
                          {MAP_SIZE_PRESETS.map(p => {
                            const active = mpSettings.mapWidth === p.w && mpSettings.mapHeight === p.h;
                            return (
                              <button
                                key={`${p.w}x${p.h}`}
                                type="button"
                                onClick={() => setMpSettings(s => ({ ...s, mapWidth: p.w, mapHeight: p.h }))}
                                className={`rounded border px-1 py-1 text-[9px] leading-tight sm:text-[10px] ${active ? 'border-amber-500 bg-amber-900/35 text-amber-100' : 'border-stone-700 bg-stone-900/60 text-stone-300 hover:border-stone-500'}`}
                              >
                                {p.label}
                                <span className="block text-[8px] opacity-80">{p.w}×{p.h}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="mb-0.5 block text-[11px] text-stone-400">W</label>
                          <input
                            type="number"
                            min={16}
                            max={520}
                            value={mpSettings.mapWidth}
                            onChange={e => setMpSettings(s => ({ ...s, mapWidth: Math.max(16, Math.min(520, Number(e.target.value) || 16)) }))}
                            className={MP_FIELD}
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[11px] text-stone-400">H</label>
                          <input
                            type="number"
                            min={12}
                            max={240}
                            value={mpSettings.mapHeight}
                            onChange={e => setMpSettings(s => ({ ...s, mapHeight: Math.max(12, Math.min(240, Number(e.target.value) || 12)) }))}
                            className={MP_FIELD}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('newGame.difficulty')}</label>
                        <select
                          value={mpSettings.difficulty}
                          onChange={e => setMpSettings(s => ({ ...s, difficulty: e.target.value as GameSettings['difficulty'] }))}
                          className={MP_SELECT}
                        >
                          {DIFFICULTIES.map(d => (
                            <option key={d} value={d}>
                              {t(`newGame.difficulty.${d}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('newGame.maxTurns')}</label>
                        <input
                          type="number"
                          min={50}
                          max={2000}
                          step={50}
                          value={mpSettings.maxTurns}
                          onChange={e => setMpSettings(s => ({ ...s, maxTurns: Math.max(50, Math.min(2000, Number(e.target.value) || 50)) }))}
                          className={MP_FIELD}
                        />
                      </div>
                      <div className="flex justify-center py-0.5">
                        <MapTypePreview
                          mapType={mpSettings.mapType}
                          seed={mpSettings.seed}
                          mapWidth={mpSettings.mapWidth}
                          mapHeight={mpSettings.mapHeight}
                          terrain={customTerrain}
                          boxMaxWidth={76}
                          boxMaxHeight={56}
                          className="flex justify-center"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('newGame.seed')}</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={mpSettings.seed}
                            onChange={e => setMpSettings(s => ({ ...s, seed: +e.target.value || 0 }))}
                            className={`${MP_FIELD} min-w-0 flex-1 font-mono`}
                          />
                          <GnzButton
                            audioOnClick
                            variant="ghost"
                            className="shrink-0 px-2 py-1 text-[11px]"
                            onClick={() => setMpSettings(s => ({ ...s, seed: Math.floor(Math.random() * 99999) }))}
                          >
                            {t('newGame.random')}
                          </GnzButton>
                        </div>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('mp.customMapJson')}</label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="file"
                            accept=".json,application/json"
                            className={`${MP_FIELD} py-1 file:mr-1.5 file:rounded file:border-0 file:bg-stone-700 file:px-1.5 file:py-0.5 file:text-[10px]`}
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const text = await file.text();
                              try {
                                const parsed = JSON.parse(text) as unknown;
                                const validated = validateTerrainImport(parsed);
                                if (!validated.ok) {
                                  setCreateError(formatTerrainImportError(validated, t));
                                  setCustomTerrain(null);
                                  return;
                                }
                                setCreateError(null);
                                setCustomTerrain(validated.terrain);
                                setCustomMapName(file.name.replace(/\.json$/i, ''));
                                setMpSettings(s => ({
                                  ...s,
                                  mapWidth: validated.w,
                                  mapHeight: validated.h,
                                }));
                              } catch {
                                setCreateError(t('mp.invalidMapJson'));
                                setCustomTerrain(null);
                              }
                            }}
                          />
                          {customTerrain && (
                            <GnzButton
                              audioOnClick
                              variant="ghost"
                              className="shrink-0 px-2 py-1 text-[11px]"
                              onClick={() => {
                                setCustomTerrain(null);
                                setCustomMapName('');
                              }}
                            >
                              {t('mp.clear')}
                            </GnzButton>
                          )}
                        </div>
                        {customTerrain && (
                          <p className="mt-1 text-[10px] text-emerald-300/90">
                            {customMapName || t('mp.importedMap')} · {customTerrain[0]?.length ?? 0}x{customTerrain.length}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('newGame.playAs')}</label>
                        <select
                          value={hostCivTemplate}
                          onChange={e => setHostCivTemplate(+e.target.value)}
                          className={MP_SELECT}
                        >
                          {CIV_TEMPLATES.map((c, i) => (
                            <option key={c.id} value={i}>
                              {civJoinOptionLabel(c, t)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-stone-400">{t('newGame.playerLeader')}</label>
                        <input value={hostNick} onChange={e => setHostNick(e.target.value)} className={MP_FIELD} />
                      </div>
                      </div>
                    </div>
                  )}

                  {createError && <p className="text-sm text-red-400">{createError}</p>}
                  <GnzButton
                    audioOnClick
                    variant="primary"
                    className="w-full py-2 text-sm"
                    disabled={createBusy || hostStartBlockers.length > 0 || serverStartBlockers.length > 0}
                    onClick={() => void handleHostStart()}
                  >
                    {createBusy ? '…' : t('mp.start')}
                  </GnzButton>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
        </GnzPanel>
      </div>
      <GameLoadingOverlay
        active={netBusy}
        title={t('loading.mpConnect.title')}
        subtitle={t('loading.mpConnect.body')}
        zIndexClass="z-[230]"
      />
    </div>
  );
}
