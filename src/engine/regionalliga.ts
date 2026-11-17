import type { ClubId, GameState } from "./model";
import { clubLeague } from "./economy/util";

/** Gehaltsniveau der Regionalliga relativ zur 1. Liga */
export const RL_WAGE_FACTOR = 0.5;

/** Ein Verein der Regionalliga steht in keiner der drei Ligen (Spec 2026-11-17, Abschnitt 4). */
export function isRegionalliga(state: GameState, clubId: ClubId): boolean {
  return clubLeague(state, clubId) === null;
}
