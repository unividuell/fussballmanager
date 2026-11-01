import type { LiveMatch } from "../match/simulate";
import { COMP, type ClubId, type CompetitionId, type Expectation, type GameState, type ManagerId } from "../model";
import type { Rng } from "../rng";
import { postMessage, postToClub } from "./messages";
import { isLeagueMatchday, leagueRank } from "./util";

export const TARGET_RANK: Record<Expectation, number> = { title: 2, upper: 6, mid: 12, survival: 15 };
export const START_CONFIDENCE = 60;
export const WARN_BELOW = 30;
export const FIRE_BELOW = 15;
export const FIRE_FROM = 8;
export const NEW_COACH_CONFIDENCE = 55;
export const GUARANTEED_OFFER_AFTER = 3;
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

export function jobOffersFor(
  state: GameState,
  reputation: number,
  rng: Rng,
  direction: "lower" | "higher",
  count: number,
  exclude: ClubId[] = [],
): ClubId[] {
  const ai = Object.values(state.clubs).filter((c) => c.managerId === null && !exclude.includes(c.id));
  const pool =
    direction === "lower"
      ? ai
          .filter((c) => c.reputation <= reputation + 5)
          .sort((a, b) => a.board.confidence - b.board.confidence || (a.id < b.id ? -1 : 1))
          .slice(0, 6)
      : ai.filter((c) => c.reputation > reputation + 5 && c.reputation <= reputation + 25);
  return rng.shuffle(pool).slice(0, count).map((c) => c.id);
}

function offerText(state: GameState, offers: ClubId[]): string {
  return `Jobangebote: ${offers.map((id) => state.clubs[id].name).join(", ")}.`;
}

function closeManagerBusiness(state: GameState, managerId: ManagerId): void {
  for (const n of state.negotiations) {
    if (n.managerId === managerId && n.status === "open") {
      n.status = "aborted";
      n.note = "Die Verhandlung endet mit deinem Abschied.";
    }
  }
  for (const o of state.transferOffers) if (o.managerId === managerId && o.status === "open") o.status = "withdrawn";
}

export function fireManager(state: GameState, managerId: ManagerId, rng: Rng, reason = "Der Vorstand hat dich entlassen."): void {
  const m = state.managers.find((x) => x.id === managerId);
  if (!m || !m.clubId) return;
  const club = state.clubs[m.clubId];
  closeManagerBusiness(state, managerId);
  club.managerId = null;
  club.board.confidence = NEW_COACH_CONFIDENCE;
  club.board.warned = false;
  club.training = { intensity: "normal", focus: "technique", individual: [] };
  m.clubId = null;
  m.unemployedFor = 0;
  m.jobOffers = jobOffersFor(state, club.reputation, rng, "lower", rng.int(1, 3), [club.id]);
  postMessage(state, m.id, `${reason} ${club.name} trennt sich von dir.`);
  if (m.jobOffers.length > 0) postMessage(state, m.id, offerText(state, m.jobOffers), { type: "jobOffer", id: m.jobOffers[0] });
}

export function boardChecks(state: GameState, rng: Rng): void {
  for (const club of Object.values(state.clubs)) {
    const b = club.board;
    if (club.managerId) {
      if (b.confidence < WARN_BELOW && !b.warned) {
        b.warned = true;
        postToClub(state, club.id, "Der Vorstand ist unzufrieden. Ohne bessere Ergebnisse droht die Entlassung.");
      }
      if (b.confidence > 40) b.warned = false;
      if (b.confidence < FIRE_BELOW && state.calendarIndex >= FIRE_FROM) fireManager(state, club.managerId, rng);
    } else if (b.confidence < FIRE_BELOW) {
      b.confidence = NEW_COACH_CONFIDENCE;
    }
  }
}

export function unemployedTick(state: GameState, rng: Rng): void {
  for (const m of state.managers) {
    if (m.clubId) continue;
    m.unemployedFor++;
    m.jobOffers = m.jobOffers.filter((id) => state.clubs[id].managerId === null);
    if (m.jobOffers.length > 0) continue;
    if (m.unemployedFor >= GUARANTEED_OFFER_AFTER) {
      const l2 = (state.competitions[COMP.second]?.clubs ?? [])
        .map((id) => state.clubs[id])
        .filter((c) => c.managerId === null)
        .sort((a, b) => a.board.confidence - b.board.confidence || (a.id < b.id ? -1 : 1))[0];
      if (l2) m.jobOffers = [l2.id];
    } else if (rng.chance(0.5)) {
      m.jobOffers = jobOffersFor(state, 50, rng, "lower", 1);
    }
    if (m.jobOffers.length > 0) postMessage(state, m.id, offerText(state, m.jobOffers), { type: "jobOffer", id: m.jobOffers[0] });
  }
}

export function acceptJobOffer(state: GameState, managerId: ManagerId, clubId: ClubId): string | null {
  const m = state.managers.find((x) => x.id === managerId);
  if (!m) return "Unbekannter Manager.";
  if (!m.jobOffers.includes(clubId)) return "Dieses Angebot gibt es nicht.";
  const club = state.clubs[clubId];
  if (club.managerId !== null) {
    m.jobOffers = m.jobOffers.filter((id) => id !== clubId);
    return "Der Verein hat inzwischen einen anderen Trainer.";
  }
  if (m.clubId) {
    closeManagerBusiness(state, managerId);
    state.clubs[m.clubId].managerId = null;
  }
  for (const o of state.transferOffers) if (o.status === "open" && o.fromClub === clubId) o.status = "withdrawn";
  for (const n of state.negotiations) {
    if (n.status !== "open" || state.players[n.playerId]?.clubId !== clubId) continue;
    n.status = "aborted";
    n.note = "Der Verein hat einen neuen Trainer.";
  }
  club.managerId = m.id;
  club.board.confidence = START_CONFIDENCE;
  club.board.warned = false;
  m.clubId = clubId;
  m.jobOffers = [];
  m.unemployedFor = 0;
  const league = state.competitions[COMP.first]?.clubs.includes(clubId) ? COMP.first : COMP.second;
  postMessage(state, m.id, `Willkommen beim ${club.name}! Saisonziel: ${expectationLabel(club.board.expectation, league)}.`);
  return null;
}

export function clearStaleJobOffers(state: GameState): void {
  for (const m of state.managers) if (m.clubId) m.jobOffers = [];
}

export function seasonReview(state: GameState, tables: Record<CompetitionId, ClubId[]>, rng: Rng): void {
  for (const league of [COMP.first, COMP.second]) {
    (tables[league] ?? []).forEach((clubId, i) => {
      const club = state.clubs[clubId];
      const rank = i + 1;
      const target = TARGET_RANK[club.board.expectation];
      if (!club.managerId) {
        if (rank > target + 5) club.board.confidence = NEW_COACH_CONFIDENCE;
        return;
      }
      const managerId = club.managerId;
      if (rank <= target) {
        club.board.confidence = Math.min(100, club.board.confidence + 15);
        postMessage(state, managerId, "Der Vorstand ist zufrieden: Saisonziel erreicht.");
        if (rank <= target - 2 || rng.chance(0.5)) {
          const offers = jobOffersFor(state, club.reputation, rng, "higher", rng.int(1, 2));
          const m = state.managers.find((x) => x.id === managerId)!;
          m.jobOffers = offers;
          if (offers.length > 0) postMessage(state, managerId, offerText(state, offers), { type: "jobOffer", id: offers[0] });
        }
      } else if (rank > target + 5) {
        fireManager(state, managerId, rng, "Saisonziel deutlich verfehlt.");
      } else {
        club.board.confidence = Math.max(0, club.board.confidence - 10);
        postMessage(state, managerId, "Der Vorstand ist enttäuscht: Saisonziel verfehlt.");
      }
    });
  }
}
