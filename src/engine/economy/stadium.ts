import { computeStandings } from "../competition/standings";
import { COMP, type ClubId, type GameState } from "../model";
import { book, canAfford } from "./money";
import { clubLeague } from "./util";

export interface StadiumStage {
  capacity: number;
  upkeep: number;
  cost: number;
  buildMatchdays: number;
}

export const STADIUM: readonly StadiumStage[] = [
  { capacity: 8_000, upkeep: 8_000, cost: 0, buildMatchdays: 0 },
  { capacity: 16_000, upkeep: 15_000, cost: 2_000_000, buildMatchdays: 6 },
  { capacity: 26_000, upkeep: 26_000, cost: 5_000_000, buildMatchdays: 8 },
  { capacity: 38_000, upkeep: 40_000, cost: 10_000_000, buildMatchdays: 10 },
  { capacity: 55_000, upkeep: 60_000, cost: 20_000_000, buildMatchdays: 12 },
];

/** Polster, das ein KI-Verein nach einem Ausbau mindestens behält. */
export const AI_BUILD_RESERVE = 2_000_000;
const SOLD_OUT = 0.98;
const EMPTY = 0.75;

export function initialStage(reputation: number): number {
  return Math.max(0, Math.min(STADIUM.length - 1, Math.floor(reputation / 25)));
}

export function referencePrice(reputation: number): number {
  return 10 + reputation * 0.15;
}

/** Erlösbester Preis, solange das Stadion nicht voll ist; Startpreis aller Vereine. */
export function startPrice(reputation: number): number {
  return Math.round(1.5 * referencePrice(reputation));
}

/**
 * Anteil der Grundnachfrage, der bei diesem Preis kommt (0 bis 1,5).
 * willingness: Zahlungsbereitschaft der Fans (Erfolg, Liga); 1 = Durchschnitt.
 */
export function priceFactor(price: number, reputation: number, willingness = 1): number {
  return Math.max(0, Math.min(1.5, 1.5 - price / (2 * referencePrice(reputation) * willingness)));
}

export function attendance(state: GameState, homeId: ClubId, awayId: ClubId): number {
  const home = state.clubs[homeId];
  const away = state.clubs[awayId];
  const league = clubLeague(state, homeId);
  const base = (2000 + home.reputation * 560) * (league === COMP.second ? 0.7 : 1);
  let success = 1;
  if (league) {
    const table = computeStandings(state.competitions[league]);
    const index = table.findIndex((r) => r.club === homeId);
    if (index >= 0 && table[index].played > 0) success = 1.25 - (0.5 * index) / (table.length - 1);
  }
  const opponent = 0.9 + (0.2 * away.reputation) / 100;
  const willingness = success * (league === COMP.second ? 0.85 : 1);
  const demand = base * success * opponent * priceFactor(home.finance.ticketPrice, home.reputation, willingness);
  return Math.round(Math.min(STADIUM[home.finance.stadiumStage].capacity, Math.max(0, demand)));
}

export function validateTicketPrice(price: number): string | null {
  if (!Number.isInteger(price) || price < 5 || price > 100) return "Der Eintrittspreis muss zwischen 5 und 100 € liegen.";
  return null;
}

export function startBuilding(state: GameState, clubId: ClubId): string | null {
  const club = state.clubs[clubId];
  const f = club.finance;
  if (f.building) return "Es wird schon gebaut.";
  const next = f.stadiumStage + 1;
  if (next >= STADIUM.length) return "Das Stadion hat schon die höchste Ausbaustufe.";
  const { cost, buildMatchdays } = STADIUM[next];
  if (!canAfford(club, cost)) return "Dafür reicht das Geld nicht.";
  book(state, clubId, "stadium", -cost);
  f.building = { stage: next, matchdaysLeft: buildMatchdays };
  return null;
}

/** KI-Vereine: Preis nach der Auslastung des letzten Heimspiels, Ausbau bei vollem Haus und genug Geld. */
export function aiStadiumDecisions(state: GameState): void {
  for (const club of Object.values(state.clubs)) {
    if (club.managerId !== null || !clubLeague(state, club.id)) continue;
    const f = club.finance;
    if (f.lastAttendance <= 0) continue;
    const capacity = STADIUM[f.stadiumStage].capacity;
    const load = f.lastAttendance / capacity;
    if (load >= SOLD_OUT) {
      f.ticketPrice = Math.min(100, f.ticketPrice + 1);
      const next = STADIUM[f.stadiumStage + 1];
      if (next && !f.building && f.balance - next.cost >= AI_BUILD_RESERVE) startBuilding(state, club.id);
    } else if (load < EMPTY) f.ticketPrice = Math.max(5, f.ticketPrice - 1);
  }
}
