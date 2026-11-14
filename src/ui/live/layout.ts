import type { LiveMatch } from "../../engine/match/simulate";
import { COMP, LEAGUES, type CompetitionId, type GameState, type MatchId } from "../../engine/model";
import { leagueOf } from "../../engine/season";

export type LiveSlot = { kind: "match"; matchId: MatchId } | { kind: "table"; competitionId: CompetitionId };

/** full: genau ein Slot, bildschirmfüllend; sonst genau vier Viertel. */
export interface LiveLayout {
  full: boolean;
  slots: LiveSlot[];
}

/** Spiele mit Manager in Manager-Reihenfolge, jedes Spiel nur einmal (Duelle teilen sich ein Viertel). */
export function managedMatchIds(state: GameState, lives: LiveMatch[]): MatchId[] {
  const out: MatchId[] = [];
  for (const m of state.managers) {
    const live = lives.find((l) => l.home.club === m.clubId || l.away.club === m.clubId);
    if (live && !out.includes(live.matchId)) out.push(live.matchId);
  }
  return out;
}

export function liveLayout(state: GameState, lives: LiveMatch[]): LiveLayout {
  const matches = managedMatchIds(state, lives);
  const first = (state.managers[0] && leagueOf(state, state.managers[0].clubId)) ?? COMP.first;
  // freie Viertel: zuerst die Ligen der Manager in ihrer Reihenfolge, dann die übrigen Ligen von oben
  const managed = state.managers.map((m) => leagueOf(state, m.clubId)).filter((l): l is CompetitionId => l !== null);
  const order = [...new Set([first, ...managed, ...LEAGUES])];
  if (matches.length === 0) return { full: true, slots: [{ kind: "table", competitionId: first }] };
  if (matches.length === 1) return { full: true, slots: [{ kind: "match", matchId: matches[0] }] };
  const slots: LiveSlot[] = matches.map((matchId) => ({ kind: "match", matchId }));
  for (let free = 0; slots.length < 4; free++) slots.push({ kind: "table", competitionId: order[free % order.length] });
  return { full: false, slots };
}
