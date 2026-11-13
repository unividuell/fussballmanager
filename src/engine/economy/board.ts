import type { LiveMatch } from "../match/simulate";
import { COMP, LEAGUES, type ClubId, type CompetitionId, type Expectation, type GameState } from "../model";
import { postMessage, postToClub } from "./messages";
import { isLeagueMatchday, leagueRank } from "./util";

export const TARGET_RANK: Record<Expectation, number> = { title: 2, upper: 6, mid: 12, survival: 15 };
export const START_CONFIDENCE = 60;
export const WARN_BELOW = 30;
export const WARN_RESET = 40;
export const CLEARLY_MISSED_BY = 5;
export const TREND_LENGTH = 5;
const RANK_FROM = 3;
/** Pro Platz Abstand zum Ziel, der erste Platz daneben ist frei. */
const PER_PLACE = 0.35;
const RANK_CAP = 2;
const RESULT = 0.8;
const OVERDRAFT_PENALTY = 5;
const BY_RANK: Expectation[] = ["title", "title", "upper", "upper", "upper", "upper", "mid", "mid", "mid", "mid", "mid", "mid"];

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function expectationLabel(e: Expectation, competitionId: CompetitionId): string {
  switch (e) {
    case "title":
      return competitionId === COMP.second ? "Aufstieg" : "Meisterschaft";
    case "upper":
      return "oberes Drittel";
    case "mid":
      return "gesichertes Mittelfeld";
    case "survival":
      return "Klassenerhalt";
  }
}

export function assignExpectations(state: GameState): void {
  for (const league of LEAGUES) {
    const comp = state.competitions[league];
    if (!comp) continue;
    [...comp.clubs]
      .sort((a, b) => state.clubs[b].reputation - state.clubs[a].reputation || (a < b ? -1 : 1))
      .forEach((id, i) => {
        state.clubs[id].board.expectation = BY_RANK[i] ?? "survival";
      });
  }
}

export function expectationMet(state: GameState, clubId: ClubId, rank: number): boolean {
  return rank <= TARGET_RANK[state.clubs[clubId].board.expectation];
}

/** Änderung des Vertrauens an einem Liga-Spieltag. Gewinn und Verlust sind gleich groß. rank = null: Tabellenplatz zählt noch nicht. */
export function confidenceDelta(target: number, rank: number | null, result: -1 | 0 | 1, overdraftStreak: number): number {
  let delta = result * RESULT;
  if (rank !== null) {
    const diff = target - rank;
    delta += Math.sign(diff) * Math.min(RANK_CAP, Math.max(0, Math.abs(diff) - 1) * PER_PLACE);
  }
  if (overdraftStreak >= 3) delta -= OVERDRAFT_PENALTY;
  return delta;
}

export function updateConfidence(state: GameState, lives: LiveMatch[]): void {
  if (!isLeagueMatchday(state.calendarIndex)) return;
  const results = new Map<ClubId, -1 | 0 | 1>();
  for (const l of lives) {
    results.set(l.home.club, Math.sign(l.home.goals - l.away.goals) as -1 | 0 | 1);
    results.set(l.away.club, Math.sign(l.away.goals - l.home.goals) as -1 | 0 | 1);
  }
  for (const league of LEAGUES) {
    for (const id of state.competitions[league]?.clubs ?? []) {
      const club = state.clubs[id];
      const rank = state.calendarIndex >= RANK_FROM ? (leagueRank(state, id) ?? 18) : null;
      const delta = confidenceDelta(TARGET_RANK[club.board.expectation], rank, results.get(id) ?? 0, club.finance.overdraftStreak);
      club.board.confidence = clamp(club.board.confidence + delta, 0, 100);
      if (club.managerId) club.board.trend = [...club.board.trend, club.board.confidence].slice(-TREND_LENGTH);
    }
  }
}

/** Vertrauen hat außer einer Nachricht keine Folgen – Manager werden nie entlassen. */
export function boardChecks(state: GameState): void {
  for (const club of Object.values(state.clubs)) {
    if (!club.managerId) continue;
    const b = club.board;
    if (b.confidence < WARN_BELOW && !b.warned) {
      b.warned = true;
      postToClub(state, club.id, "Der Vorstand ist unzufrieden.");
    }
    if (b.confidence > WARN_RESET) b.warned = false;
  }
}

/** Saisonbilanz für die Vereine der Manager: Vertrauen und eine Nachricht, sonst nichts. */
export function seasonReview(state: GameState, tables: Record<CompetitionId, ClubId[]>): void {
  for (const league of LEAGUES) {
    (tables[league] ?? []).forEach((clubId, i) => {
      const club = state.clubs[clubId];
      if (!club.managerId) return;
      const rank = i + 1;
      const target = TARGET_RANK[club.board.expectation];
      const b = club.board;
      b.seasons = [...b.seasons, { season: state.season, competitionId: league, expectation: b.expectation, rank, met: rank <= target }];
      if (rank <= target) {
        b.confidence = Math.min(100, b.confidence + 15);
        postMessage(state, club.managerId, "Der Vorstand ist zufrieden: Saisonziel erreicht.");
      } else if (rank > target + CLEARLY_MISSED_BY) {
        b.confidence = Math.max(0, b.confidence - 15);
        postMessage(state, club.managerId, "Der Vorstand ist sehr enttäuscht: Saisonziel deutlich verfehlt.");
      } else {
        b.confidence = Math.max(0, b.confidence - 10);
        postMessage(state, club.managerId, "Der Vorstand ist enttäuscht: Saisonziel verfehlt.");
      }
    });
  }
}
