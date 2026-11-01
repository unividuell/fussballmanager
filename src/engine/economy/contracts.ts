import { LEAGUE_MATCHDAYS, type ClubId, type GameState, type Player, type PlayerId } from "../model";
import { postToClub } from "./messages";
import { book, salaryFor } from "./money";
import { removeFromClub } from "./roster";
import { roundTo } from "./util";

export const MIN_YEARS = 1;
export const MAX_YEARS = 5;
export const ABORT_RATIO = 0.7;
export const TALK_COOLDOWN = 3;
const COUNTER_STEP = 0.35;
const SEVERANCE_SHARE = 0.5;
const RENEWAL_FROM = 23;
const EXPIRY_NOTICE_AT = 24;

export function desiredYears(p: Player): number {
  if (p.age <= 24) return 4;
  if (p.age <= 29) return 3;
  if (p.age <= 32) return 2;
  return 1;
}

export function salaryDemand(state: GameState, p: Player, clubId: ClubId): number {
  const club = state.clubs[clubId];
  let d = salaryFor(p.strength);
  if (p.age >= 31) d *= 0.9;
  d *= 0.8 + (0.4 * club.reputation) / 100;
  d *= 1.15 - (0.3 * p.morale) / 100;
  if (p.clubId === clubId && state.calendarIndex >= 10 && p.stats.apps < state.calendarIndex * 0.3) d *= 0.85;
  return roundTo(d, 100);
}

export function yearsAdjusted(ask: number, years: number, desired: number): number {
  return roundTo(ask * (1 + 0.05 * Math.abs(years - desired)), 100);
}

export function validateYears(years: number): string | null {
  if (!Number.isInteger(years) || years < MIN_YEARS || years > MAX_YEARS) return "Die Laufzeit muss 1 bis 5 Jahre betragen.";
  return null;
}

export type TalkOutcome =
  | { kind: "accepted"; amount: number }
  | { kind: "counter"; amount: number; round: number }
  | { kind: "aborted" };

export function evaluateOffer(offer: number, ask: number, round: number): TalkOutcome {
  if (offer >= ask) return { kind: "accepted", amount: offer };
  if (offer < ABORT_RATIO * ask || round >= 3) return { kind: "aborted" };
  return { kind: "counter", amount: roundTo(ask - (ask - offer) * COUNTER_STEP, 100), round: round + 1 };
}

export function contractEnd(state: GameState, years: number): number {
  return state.season + years - (state.calendarIndex === 0 ? 1 : 0);
}

export function signContract(state: GameState, playerId: PlayerId, clubId: ClubId, salary: number, years: number): void {
  const p = state.players[playerId];
  const club = state.clubs[clubId];
  if (p.clubId !== clubId) {
    if (p.clubId) removeFromClub(state, playerId);
    p.clubId = clubId;
  }
  if (!club.squad.includes(playerId)) club.squad.push(playerId);
  p.contract = { salary, endsSeason: contractEnd(state, years) };
  p.transferListed = null;
  p.morale = Math.min(100, p.morale + 10);
  p.talkCooldown = 0;
}

export function remainingMatchdays(state: GameState, p: Player): number {
  if (!p.contract) return 0;
  const seasons = p.contract.endsSeason - state.season;
  return Math.max(0, seasons * LEAGUE_MATCHDAYS + (LEAGUE_MATCHDAYS - Math.min(LEAGUE_MATCHDAYS, state.calendarIndex)));
}

export function severance(state: GameState, p: Player): number {
  return roundTo((p.contract?.salary ?? 0) * remainingMatchdays(state, p) * SEVERANCE_SHARE, 100);
}

export function releasePlayer(state: GameState, clubId: ClubId, playerId: PlayerId): string | null {
  const p = state.players[playerId];
  if (!p || p.clubId !== clubId) return "Der Spieler gehört nicht zum Kader.";
  const amount = severance(state, p);
  if (amount > 0) book(state, clubId, "severance", -amount);
  removeFromClub(state, playerId);
  return null;
}

export function expireContracts(state: GameState): PlayerId[] {
  const gone: PlayerId[] = [];
  for (const p of Object.values(state.players)) {
    if (!p.clubId || !p.contract || p.contract.endsSeason > state.season) continue;
    postToClub(state, p.clubId, `${p.firstName} ${p.lastName} verlässt den Verein, sein Vertrag ist ausgelaufen.`);
    removeFromClub(state, p.id);
    gone.push(p.id);
  }
  return gone;
}

export function expiringNotices(state: GameState): void {
  if (state.calendarIndex !== EXPIRY_NOTICE_AT) return;
  for (const club of Object.values(state.clubs)) {
    if (!club.managerId) continue;
    const names = club.squad
      .map((id) => state.players[id])
      .filter((p) => p.contract && p.contract.endsSeason <= state.season)
      .map((p) => p.lastName);
    if (names.length > 0) postToClub(state, club.id, `Verträge laufen zum Saisonende aus: ${names.join(", ")}.`);
  }
}

export function aiRenewals(state: GameState): void {
  if (state.calendarIndex < RENEWAL_FROM || state.calendarIndex >= LEAGUE_MATCHDAYS) return;
  for (const club of Object.values(state.clubs)) {
    if (club.managerId) continue;
    const starters = club.lineup.starters.map((id) => state.players[id]).filter(Boolean);
    const avg = starters.reduce((s, p) => s + p.strength, 0) / Math.max(1, starters.length);
    for (const pid of [...club.squad]) {
      const p = state.players[pid];
      if (!p.contract || p.contract.endsSeason > state.season) continue;
      if (p.age > 31 || p.strength < avg - 5) continue;
      signContract(state, pid, club.id, salaryDemand(state, p, club.id), desiredYears(p));
    }
  }
}

export function tickCooldowns(state: GameState): void {
  for (const p of Object.values(state.players)) if (p.talkCooldown > 0) p.talkCooldown--;
}
