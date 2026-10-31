import { slotPositions, type ClubId, type GameState, type Lineup, type Player, type PlayerId, type Position } from "../../engine/model";

export type LineupArea = "starter" | "bench" | "reserve";

export interface SquadRow {
  player: Player;
  area: LineupArea;
  slot: Position | null;
}

const POSITION_ORDER: Position[] = ["GK", "DF", "MF", "FW"];

export function squadRows(state: GameState, clubId: ClubId): SquadRow[] {
  const club = state.clubs[clubId];
  const slots = slotPositions(club.tactics.formation);
  const starters = club.lineup.starters.map((id, i) => ({ player: state.players[id], area: "starter" as const, slot: slots[i] ?? null }));
  const bench = club.lineup.bench.map((id) => ({ player: state.players[id], area: "bench" as const, slot: null }));
  const used = new Set([...club.lineup.starters, ...club.lineup.bench]);
  const reserve = club.squad
    .filter((id) => !used.has(id))
    .map((id) => state.players[id])
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.strength - a.strength)
    .map((player) => ({ player, area: "reserve" as const, slot: null }));
  return [...starters, ...bench, ...reserve];
}

/** Tauscht a und b zwischen Startelf, Bank und Reserve (Reserve = nicht in der Aufstellung). */
export function swapPlayers(lineup: Lineup, a: PlayerId, b: PlayerId): Lineup {
  const starters = [...lineup.starters];
  const bench = [...lineup.bench];
  if (a === b) return { starters, bench };
  const locate = (id: PlayerId): { list: PlayerId[]; index: number } | null => {
    const s = starters.indexOf(id);
    if (s >= 0) return { list: starters, index: s };
    const p = bench.indexOf(id);
    if (p >= 0) return { list: bench, index: p };
    return null;
  };
  const la = locate(a);
  const lb = locate(b);
  if (la) la.list[la.index] = b;
  if (lb) lb.list[lb.index] = a;
  return { starters, bench };
}
