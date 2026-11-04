import type { LiveMatch } from "../match/simulate";
import { COMP, type ClubId, type CompetitionId, type Expectation, type GameState } from "../model";
import { postMessage, postToClub } from "./messages";
import { isLeagueMatchday, leagueRank } from "./util";

export const TARGET_RANK: Record<Expectation, number> = { title: 2, upper: 6, mid: 12, survival: 15 };
export const START_CONFIDENCE = 60;
export const WARN_BELOW = 30;
export const WARN_RESET = 40;
export const CLEARLY_MISSED_BY = 5;
const RANK_FROM = 3;
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
  for (const league of [COMP.first, COMP.second]) {
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

export function updateConfidence(state: GameState, lives: LiveMatch[]): void {
  if (!isLeagueMatchday(state.calendarIndex)) return;
  const results = new Map<ClubId, number>();
  for (const l of lives) {
    results.set(l.home.club, Math.sign(l.home.goals - l.away.goals));
    results.set(l.away.club, Math.sign(l.away.goals - l.home.goals));
  }
  for (const league of [COMP.first, COMP.second]) {
    for (const id of state.competitions[league]?.clubs ?? []) {
      const club = state.clubs[id];
      let delta = 0;
      if (state.calendarIndex >= RANK_FROM) {
        const rank = leagueRank(state, id) ?? 18;
        delta += clamp((TARGET_RANK[club.board.expectation] - rank) * 0.3, -2.5, 1.5);
      }
      const r = results.get(id);
      if (r === 1) delta += 0.8;
      else if (r === -1) delta -= 0.8;
      if (club.finance.overdraftStreak >= 3) delta -= 5;
      club.board.confidence = clamp(club.board.confidence + delta, 0, 100);
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
  for (const league of [COMP.first, COMP.second]) {
    (tables[league] ?? []).forEach((clubId, i) => {
      const club = state.clubs[clubId];
      if (!club.managerId) return;
      const rank = i + 1;
      const target = TARGET_RANK[club.board.expectation];
      const b = club.board;
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
