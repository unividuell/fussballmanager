import { computeStandings } from "../competition/standings";
import { COMP, LEAGUE_MATCHDAYS, type ClubId, type CompetitionId, type GameState } from "../model";

export function roundTo(x: number, step: number): number {
  return Math.round(x / step) * step;
}

export function clubLeague(state: GameState, clubId: ClubId): CompetitionId | null {
  for (const id of [COMP.first, COMP.second]) {
    if (state.competitions[id]?.clubs.includes(clubId)) return id;
  }
  return null;
}

export function leagueRank(state: GameState, clubId: ClubId): number | null {
  const league = clubLeague(state, clubId);
  if (!league) return null;
  return computeStandings(state.competitions[league]).findIndex((r) => r.club === clubId) + 1;
}

export function formatEuro(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${digits} €`;
}

export function isLeagueMatchday(index: number): boolean {
  return index < LEAGUE_MATCHDAYS;
}
