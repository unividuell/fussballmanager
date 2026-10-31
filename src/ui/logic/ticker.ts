import type { LiveMatch } from "../../engine/match/simulate";
import type { ClubId, CompetitionId, GameState, MatchId } from "../../engine/model";
import { eventText } from "./format";

/** Millisekunden pro Spielminute: langsam, normal, schnell. */
export const TEMPOS = [1000, 500, 200] as const;
export const DEFAULT_TEMPO = 1;

export function halfBounds(half: 1 | 2): { from: number; to: number } {
  return half === 1 ? { from: 0, to: 45 } : { from: 45, to: 90 };
}

export interface TickerRow {
  matchId: MatchId;
  competitionId: CompetitionId;
  homeClub: ClubId;
  awayClub: ClubId;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  last: string | null;
  goalNow: boolean;
  managed: boolean;
}

export function tickerRows(state: GameState, lives: LiveMatch[], minute: number): TickerRow[] {
  return lives.map((l) => {
    const events = l.events.filter((e) => e.minute <= minute);
    const goals = events.filter((e) => e.type === "goal");
    const notable = events.filter((e) => e.type === "goal" || e.type === "red" || e.type === "injury");
    const last = notable.length > 0 ? notable[notable.length - 1] : null;
    return {
      matchId: l.matchId,
      competitionId: l.competitionId,
      homeClub: l.home.club,
      awayClub: l.away.club,
      home: state.clubs[l.home.club].name,
      away: state.clubs[l.away.club].name,
      homeGoals: goals.filter((e) => e.club === l.home.club).length,
      awayGoals: goals.filter((e) => e.club === l.away.club).length,
      last: last ? eventText(state, last) : null,
      goalNow: goals.some((e) => e.minute === minute),
      managed: state.clubs[l.home.club].managerId !== null || state.clubs[l.away.club].managerId !== null,
    };
  });
}

export function competitionsOf(lives: LiveMatch[]): CompetitionId[] {
  const out: CompetitionId[] = [];
  for (const l of lives) if (!out.includes(l.competitionId)) out.push(l.competitionId);
  return out;
}

export function competitionName(state: GameState, id: CompetitionId): string {
  return state.competitions[id]?.name ?? id;
}
