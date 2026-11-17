import { CLUBS } from "./clubs";
import { clubLeague } from "./economy/util";
import { SQUAD_PLAN, baseStrengthFor, generatePlayer } from "./generator";
import { autoLineup } from "./lineup";
import { LEAGUES, type ClubId, type GameState } from "./model";
import type { Rng } from "./rng";

/** Gehaltsniveau der Regionalliga relativ zur 1. Liga */
export const RL_WAGE_FACTOR = 0.5;

/** Ein Verein der Regionalliga steht in keiner der drei Ligen (Spec 2026-11-17, Abschnitt 4). Ohne Ligen (Testaufbauten, Welt vor dem Start) gibt es keine Regionalliga. */
export function isRegionalliga(state: GameState, clubId: ClubId): boolean {
  return LEAGUES.some((l) => state.competitions[l] !== undefined) && clubLeague(state, clubId) === null;
}

const RL_SQUAD = 25;

/** Kaderstärke beim Auffüllen: Median der Traditionsvereine im Datensatz */
function rlStrength(): number {
  const xs = CLUBS.filter((c) => c.league === "RL").map((c) => c.strength).sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
}

/** Füllt jeden Regionalliga-Kader auf 25 Spieler auf, nach Positionsbedarf, und stellt neu auf. Ohne Bedarf kein Zufallszug. */
export function refillRegionalliga(state: GameState, rng: Rng): void {
  const base = baseStrengthFor(rlStrength());
  for (const club of Object.values(state.clubs)) {
    if (!isRegionalliga(state, club.id) || club.squad.length >= RL_SQUAD) continue;
    while (club.squad.length < RL_SQUAD) {
      const count = (pos: string) => club.squad.filter((id) => state.players[id].position === pos).length;
      const [pos] = SQUAD_PLAN.map(([p, n]) => [p, n - count(p)] as const).sort((a, b) => b[1] - a[1])[0];
      club.squad.push(generatePlayer(state, rng, club.id, pos, base, rng.int(18, 30), RL_WAGE_FACTOR).id);
    }
    club.lineup = autoLineup(state, club.id, club.tactics.formation);
  }
}
