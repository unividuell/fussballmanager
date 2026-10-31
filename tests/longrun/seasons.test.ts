import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { COMP, isAvailable, type GameState } from "../../src/engine/model";
import {
  aiHalftimeAll,
  currentFixtures,
  finishMatchday,
  finishSeason,
  isSeasonOver,
  kickOff,
  playHalf,
  prepareMatchday,
  startNewGame,
} from "../../src/engine/season";

describe("Langzeittest: 10 Saisons", () => {
  it("bleibt stabil", { timeout: 300_000 }, () => {
    const world = generateWorld(4711);
    const r = startNewGame(world, [{ name: "Test", clubId: Object.keys(world.clubs)[10] }]);
    if (!r.ok) throw new Error(r.error);
    let s: GameState = r.state;

    for (let season = 1; season <= 10; season++) {
      let goals = 0;
      let matches = 0;
      while (!isSeasonOver(s)) {
        s = prepareMatchday(s).state;
        for (const m of currentFixtures(s)) {
          for (const clubId of [m.home, m.away]) {
            expect(validateLineup(s, clubId, s.clubs[clubId].lineup)).toBeNull();
            const available = s.clubs[clubId].squad.map((id) => s.players[id]).filter(isAvailable);
            expect(available.length).toBeGreaterThanOrEqual(11);
          }
        }
        let lives = kickOff(s);
        ({ state: s, lives } = playHalf(s, lives, 1));
        lives = aiHalftimeAll(s, lives);
        ({ state: s, lives } = playHalf(s, lives, 2));
        s = finishMatchday(s, lives);
      }
      for (const id of [COMP.first, COMP.second]) {
        for (const m of s.competitions[id].matches) {
          expect(m.result).not.toBeNull();
          goals += m.result!.home + m.result!.away;
          matches++;
        }
        expect(computeStandings(s.competitions[id]).every((row) => row.played === 34)).toBe(true);
      }
      const avgGoals = goals / matches;
      expect(avgGoals).toBeGreaterThan(2.3);
      expect(avgGoals).toBeLessThan(3.3);

      const { state: next, record } = finishSeason(s);
      expect(record.season).toBe(season);
      expect(record.promoted.length).toBe(record.relegated.length);
      expect([2, 3]).toContain(record.promoted.length);
      const l1 = next.competitions[COMP.first].clubs;
      const l2 = next.competitions[COMP.second].clubs;
      expect(l1).toHaveLength(18);
      expect(l2).toHaveLength(18);
      expect(new Set([...l1, ...l2]).size).toBe(36);
      s = next;
    }

    expect(s.season).toBe(11);
    expect(s.history).toHaveLength(10);
    const squadSizes = Object.values(s.clubs).map((c) => c.squad.length);
    expect(Math.max(...squadSizes)).toBeLessThan(40);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
