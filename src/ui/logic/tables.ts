import { matchesOfRound } from "../../engine/competition/schedule";
import { computeStandings, type StandingRow } from "../../engine/competition/standings";
import { COMP, type ClubId, type CompetitionId, type GameState } from "../../engine/model";
import { leagueOf } from "../../engine/season";

export type Zone = "champion" | "promotion" | "playoff" | "relegation" | null;

export interface TableRowView extends StandingRow {
  rank: number;
  name: string;
  manager: string | null;
  zone: Zone;
}

export interface FixtureView {
  id: string;
  home: string;
  away: string;
  homeClub: ClubId;
  awayClub: ClubId;
  result: string | null;
}

export function zoneFor(competitionId: CompetitionId, rank: number): Zone {
  if (competitionId === COMP.first) {
    if (rank === 1) return "champion";
    if (rank === 16) return "playoff";
    if (rank >= 17) return "relegation";
    return null;
  }
  if (competitionId === COMP.second) {
    if (rank <= 2) return "promotion";
    if (rank === 3) return "playoff";
  }
  return null;
}

export function managerName(state: GameState, clubId: ClubId): string | null {
  const id = state.clubs[clubId]?.managerId;
  if (!id) return null;
  return state.managers.find((m) => m.id === id)?.name ?? null;
}

export function tableView(state: GameState, competitionId: CompetitionId): TableRowView[] {
  const comp = state.competitions[competitionId];
  if (!comp) return [];
  return computeStandings(comp).map((row, i) => ({
    ...row,
    rank: i + 1,
    name: state.clubs[row.club].name,
    manager: managerName(state, row.club),
    zone: zoneFor(competitionId, i + 1),
  }));
}

export function fixturesView(state: GameState, competitionId: CompetitionId, round: number): FixtureView[] {
  const comp = state.competitions[competitionId];
  if (!comp) return [];
  return matchesOfRound(comp, round).map((m) => ({
    id: m.id,
    home: state.clubs[m.home].name,
    away: state.clubs[m.away].name,
    homeClub: m.home,
    awayClub: m.away,
    result: m.result
      ? `${m.result.home}:${m.result.away}${m.penalties ? ` (i.E. ${m.penalties.home}:${m.penalties.away})` : ""}`
      : null,
  }));
}

/** Höchste Runde mit mindestens einem Ergebnis, sonst 1. */
export function lastPlayedRound(state: GameState, competitionId: CompetitionId): number {
  const comp = state.competitions[competitionId];
  if (!comp) return 1;
  return comp.matches.reduce((max, m) => (m.result && m.round > max ? m.round : max), 1);
}

/** Durchschnittliche Stärke der Startelf (gerundet). */
export function clubRating(state: GameState, clubId: ClubId): number {
  const club = state.clubs[clubId];
  const ids = club.lineup.starters.length > 0 ? club.lineup.starters : club.squad.slice(0, 11);
  const sum = ids.reduce((s, id) => s + state.players[id].strength, 0);
  return Math.round(sum / Math.max(1, ids.length));
}

export function clubPlace(state: GameState, clubId: ClubId): { competitionId: CompetitionId; rank: number } | null {
  const competitionId = leagueOf(state, clubId);
  if (!competitionId) return null;
  const rank = tableView(state, competitionId).findIndex((r) => r.club === clubId) + 1;
  return { competitionId, rank };
}
