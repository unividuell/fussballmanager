import { describe, expect, it } from "vitest";
import { generateWorld } from "../../src/engine/generator";

const LEAGUE_NAMES = new Set([
  // die 54 Ligavereine aus dem Datensatz; Traditionsvereine der Regionalliga gehören nicht dazu
]);

/** Startwelt der Ligavereine und der Vereinslosen: muss bei gleichem Seed gleich bleiben. */
function leagueWorld(seed: number) {
  const w = generateWorld(seed);
  const clubs = Object.values(w.clubs)
    .filter((c) => LEAGUE_NAMES.size === 0 || LEAGUE_NAMES.has(c.name))
    .map((c) => ({ name: c.name, reputation: c.reputation, squad: c.squad }));
  const inClubs = new Set(clubs.flatMap((c) => c.squad));
  const players = Object.values(w.players)
    .filter((p) => inClubs.has(p.id) || p.clubId === null)
    .map((p) => [p.id, p.strength, p.age, p.potential, p.contract?.salary ?? null]);
  return { clubs, players };
}

describe("Startwelt", () => {
  for (const seed of [11, 2027]) {
    it(`Ligavereine und Vereinslose bleiben gleich (Seed ${seed})`, () => {
      expect(leagueWorld(seed)).toMatchSnapshot();
    });
  }
});
