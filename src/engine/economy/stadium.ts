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
  { capacity: 22_000, upkeep: 55_000, cost: 5_000_000, buildMatchdays: 8 },
  { capacity: 42_000, upkeep: 80_000, cost: 10_000_000, buildMatchdays: 10 },
  { capacity: 50_000, upkeep: 100_000, cost: 25_000_000, buildMatchdays: 12 },
];

/** Polster, das ein KI-Verein nach einem Ausbau mindestens behält. */
export const AI_BUILD_RESERVE = 2_000_000;
const SOLD_OUT = 0.98;

/** Startstufe nach Ruf: nur die großen Vereine beginnen mit Stufe 4, die höchste Stufe muss man ausbauen. */
const STAGE_FROM_REPUTATION = [0, 30, 55, 85];

export function initialStage(reputation: number): number {
  return STAGE_FROM_REPUTATION.filter((from) => reputation >= from).length - 1;
}

export function referencePrice(reputation: number): number {
  return 5 + reputation * 0.22;
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
  const base = (home.reputation * 700 - 5000) * (league === COMP.second ? 0.7 : 1);
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

function revenueAt(state: GameState, clubId: ClubId, awayId: ClubId, price: number): number {
  const f = state.clubs[clubId].finance;
  const old = f.ticketPrice;
  f.ticketPrice = price;
  const r = attendance(state, clubId, awayId) * price;
  f.ticketPrice = old;
  return r;
}

/** KI-Vereine: Preis schrittweise Richtung Erlösmaximum, Ausbau bei vollem Haus und genug Geld. */
export function aiStadiumDecisions(state: GameState): void {
  for (const club of Object.values(state.clubs)) {
    const league = clubLeague(state, club.id);
    if (club.managerId !== null || !league) continue;
    const f = club.finance;
    const others = state.competitions[league].clubs.filter((id) => id !== club.id);
    const typical = [...others].sort((a, b) => state.clubs[a].reputation - state.clubs[b].reputation)[Math.floor(others.length / 2)];
    const price = f.ticketPrice;
    const options = [price - 1, price, price + 1].filter((p) => p >= 5 && p <= 100);
    // bei Gleichstand (etwa niemand kommt) gewinnt der niedrigere Preis
    f.ticketPrice = options.reduce((best, p) => (revenueAt(state, club.id, typical, p) > revenueAt(state, club.id, typical, best) ? p : best));
    const next = STADIUM[f.stadiumStage + 1];
    const soldOut = f.lastAttendance >= SOLD_OUT * STADIUM[f.stadiumStage].capacity;
    if (soldOut && next && !f.building && f.balance - next.cost >= AI_BUILD_RESERVE) startBuilding(state, club.id);
  }
}
