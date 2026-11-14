import { computeStandings, type StandingRow } from "../competition/standings";
import { leagueLevel, type ClubId, type GameState } from "../model";
import { book, canAfford } from "./money";
import { clubLeague } from "./util";

export interface StadiumStage {
  capacity: number;
  upkeep: number;
  cost: number;
  buildMatchdays: number;
}

export const STADIUM: readonly StadiumStage[] = [
  { capacity: 8_000, upkeep: 4_000, cost: 0, buildMatchdays: 0 },
  { capacity: 16_000, upkeep: 15_000, cost: 2_000_000, buildMatchdays: 6 },
  { capacity: 22_000, upkeep: 55_000, cost: 5_000_000, buildMatchdays: 8 },
  { capacity: 42_000, upkeep: 90_000, cost: 10_000_000, buildMatchdays: 10 },
  { capacity: 50_000, upkeep: 100_000, cost: 25_000_000, buildMatchdays: 12 },
];

/** Stadionunterhalt nach Ligastufe: In unteren Ligen sind Sicherheit und Betrieb günstiger. */
const UPKEEP_FACTOR = [1, 0.85, 0.7];

export function upkeepFor(stage: number, level: number): number {
  return Math.round(STADIUM[stage].upkeep * UPKEEP_FACTOR[Math.max(0, level)]);
}

/** Polster, das ein KI-Verein nach einem Ausbau mindestens behält. */
/** Grundnachfrage und Zahlungsbereitschaft nach Ligastufe (1., 2., 3. Liga) */
const DEMAND_FACTOR = [1, 0.5, 0.45];
const WILLINGNESS_FACTOR = [1, 0.65, 0.45];

export const AI_BUILD_RESERVE = 2_000_000;
const SOLD_OUT = 0.98;

/** Startstufe nach Ruf: nur die großen Vereine beginnen mit Stufe 4, die höchste Stufe muss man ausbauen. */
const STAGE_FROM_REPUTATION = [0, 30, 55, 85];

/** level: Ligastufe 0–2. Drittligisten starten eine Stufe kleiner, passend zur geringeren Nachfrage. */
export function initialStage(reputation: number, level = 0): number {
  const stage = STAGE_FROM_REPUTATION.filter((from) => reputation >= from).length - 1;
  return Math.max(0, level >= 2 ? stage - 1 : stage);
}

export function referencePrice(reputation: number): number {
  return 5 + reputation * 0.22;
}

/** Erlösbester Preis bei durchschnittlichem Erfolg, solange das Stadion nicht voll ist; Startpreis aller Vereine. level: Ligastufe 0–2. */
export function startPrice(reputation: number, level = 0): number {
  return Math.round(1.5 * referencePrice(reputation) * WILLINGNESS_FACTOR[level]);
}

/**
 * Anteil der Grundnachfrage, der bei diesem Preis kommt (0 bis 1,5).
 * willingness: Zahlungsbereitschaft der Fans (Erfolg, Liga); 1 = Durchschnitt.
 */
export function priceFactor(price: number, reputation: number, willingness = 1): number {
  return Math.max(0, Math.min(1.5, 1.5 - price / (2 * referencePrice(reputation) * willingness)));
}

/** table: bereits berechnete Tabelle der Heim-Liga, um sie nicht mehrfach zu berechnen. */
export function attendance(state: GameState, homeId: ClubId, awayId: ClubId, table?: readonly StandingRow[]): number {
  const home = state.clubs[homeId];
  const away = state.clubs[awayId];
  const league = clubLeague(state, homeId);
  const level = Math.max(0, leagueLevel(league));
  const base = (home.reputation * 700 - 5000) * DEMAND_FACTOR[level];
  let success = 1;
  if (league) {
    const rows = table ?? computeStandings(state.competitions[league]);
    const index = rows.findIndex((r) => r.club === homeId);
    if (index >= 0 && rows[index].played > 0) success = 1.25 - (0.5 * index) / (rows.length - 1);
  }
  const opponent = 0.9 + (0.2 * away.reputation) / 100;
  const willingness = success * WILLINGNESS_FACTOR[level];
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

function revenueAt(state: GameState, clubId: ClubId, awayId: ClubId, price: number, table: readonly StandingRow[]): number {
  const f = state.clubs[clubId].finance;
  const old = f.ticketPrice;
  f.ticketPrice = price;
  const r = attendance(state, clubId, awayId, table) * price;
  f.ticketPrice = old;
  return r;
}

/** KI-Vereine: Preis schrittweise Richtung Erlösmaximum, Ausbau bei vollem Haus und genug Geld. */
export function aiStadiumDecisions(state: GameState): void {
  const tables = new Map<string, StandingRow[]>();
  for (const club of Object.values(state.clubs)) {
    const league = clubLeague(state, club.id);
    if (club.managerId !== null || !league) continue;
    const f = club.finance;
    const others = state.competitions[league].clubs.filter((id) => id !== club.id);
    const typical = [...others].sort((a, b) => state.clubs[a].reputation - state.clubs[b].reputation)[Math.floor(others.length / 2)];
    const price = f.ticketPrice;
    const options = [price - 1, price, price + 1].filter((p) => p >= 5 && p <= 100);
    if (!tables.has(league)) tables.set(league, computeStandings(state.competitions[league]));
    const table = tables.get(league)!;
    const revenue = options.map((p) => revenueAt(state, club.id, typical, p, table));
    // bei Gleichstand (etwa niemand kommt) gewinnt der niedrigere Preis
    f.ticketPrice = options[revenue.indexOf(Math.max(...revenue))];
    const next = STADIUM[f.stadiumStage + 1];
    const soldOut = f.lastAttendance >= SOLD_OUT * STADIUM[f.stadiumStage].capacity;
    if (soldOut && next && !f.building && f.balance - next.cost >= AI_BUILD_RESERVE) startBuilding(state, club.id);
  }
}
