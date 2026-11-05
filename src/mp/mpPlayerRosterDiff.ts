/** Rows from `GET /v1/matches/:id` — same shape as `GetMatchResult['players']`. */
export type MpMatchPlayerRow = {
  id: number;
  display_name: string;
  civ_slot: number;
  is_host?: number;
  joined_at?: number;
  left_at?: number | null;
};

/** Players currently connected (not soft-disconnected). */
export function activePlayerMap(players: MpMatchPlayerRow[]): Map<number, MpMatchPlayerRow> {
  const m = new Map<number, MpMatchPlayerRow>();
  for (const p of players) {
    if (p.left_at == null || p.left_at === undefined) {
      m.set(p.id, p);
    }
  }
  return m;
}

/**
 * Compare previous active roster to current API payload.
 * First call: pass `prev === null` — returns no joins/leaves (baseline without spam).
 */
export function diffMpPlayerRoster(
  prev: Map<number, MpMatchPlayerRow> | null,
  players: MpMatchPlayerRow[]
): { joined: MpMatchPlayerRow[]; left: MpMatchPlayerRow[] } {
  const nextActive = activePlayerMap(players);
  if (prev === null) {
    return { joined: [], left: [] };
  }
  const joined: MpMatchPlayerRow[] = [];
  const left: MpMatchPlayerRow[] = [];
  for (const [id, p] of nextActive) {
    if (!prev.has(id)) joined.push(p);
  }
  for (const [id, p] of prev) {
    if (!nextActive.has(id)) left.push(p);
  }
  return { joined, left };
}
