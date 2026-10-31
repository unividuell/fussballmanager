import { generateWorld } from "../../src/engine/generator";
import type { GameState } from "../../src/engine/model";
import { startNewGame } from "../../src/engine/season";

/** Neues Spiel; Manager i übernimmt den (i·20)-ten Verein, damit Erst- und Zweitligisten dabei sind. */
export function newTestGame(names: string[] = ["Anna"], seed = 42): GameState {
  const world = generateWorld(seed);
  const ids = Object.keys(world.clubs);
  const r = startNewGame(world, names.map((name, i) => ({ name, clubId: ids[(i * 20) % ids.length] })));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
