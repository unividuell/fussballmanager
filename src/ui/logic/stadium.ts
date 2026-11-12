import type { ClubId, GameState } from "../../engine/model";

const SOLD_OUT = 0.98;
const EMPTY = 0.75;

/**
 * Hinweis zum Eintrittspreis nach dem letzten Heimspiel; null, wenn nichts auffällt oder noch kein Heimspiel war.
 * playedHome: Es gab schon ein Heimspiel; dann heißt 0 Zuschauer „viel zu teuer“, nicht „noch nichts gespielt“.
 */
export function priceHint(lastAttendance: number, capacity: number, playedHome = lastAttendance > 0): string | null {
  if (!playedHome) return null;
  if (lastAttendance >= SOLD_OUT * capacity) return "Ausverkauft – ein höherer Preis bringt vermutlich mehr.";
  if (lastAttendance < EMPTY * capacity) return "Viele freie Plätze – ein niedrigerer Preis lockt mehr Zuschauer.";
  return null;
}

/** Hat der Verein in der laufenden Saison schon ein Heimspiel bestritten? */
export function hasPlayedHome(state: GameState, clubId: ClubId): boolean {
  return Object.values(state.competitions).some((c) => c.matches.some((m) => m.home === clubId && m.result !== null));
}
