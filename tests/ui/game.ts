import { generateWorld } from "../../src/engine/generator";
import { CLUBS } from "../../src/engine/clubs";
import type { ClubId, GameState } from "../../src/engine/model";
import { startNewGame } from "../../src/engine/season";

/** IDs der Ligavereine (ohne Traditionsvereine der Regionalliga) in Datensatz-Reihenfolge */
export function leagueClubIds(world: GameState): ClubId[] {
  const rl = new Set(CLUBS.filter((c) => c.league === "RL").map((c) => c.name));
  return Object.values(world.clubs).filter((c) => !rl.has(c.name)).map((c) => c.id);
}

/** Neues Spiel; Manager i übernimmt den (i·20)-ten Verein, damit Erst- und Zweitligisten dabei sind. */
export function newTestGame(names: string[] = ["Anna"], seed = 42): GameState {
  const world = generateWorld(seed);
  const ids = leagueClubIds(world);
  const r = startNewGame(world, names.map((name, i) => ({ name, clubId: ids[(i * 20) % ids.length] })));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
