import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { LEAGUES, isAvailable, type GameState } from "../../src/engine/model";
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
import { validateState } from "../../src/storage/validate";

describe("Langzeittest: 10 Saisons", () => {
  it("bleibt stabil", { timeout: 300_000 }, () => {
    const world = generateWorld(4711);
    const r = startNewGame(world, [{ name: "Test", clubId: Object.keys(world.clubs)[10] }]);
    if (!r.ok) throw new Error(r.error);
    let s: GameState = r.state;
    const start = s.managers[0].clubId;

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
      for (const id of LEAGUES) {
        for (const m of s.competitions[id].matches) {
          expect(m.result).not.toBeNull();
          // Der passive Testmanager lässt alle Verträge auslaufen und spielt bald mit Amateuren (bis zu 10 Gegentore
          // pro Spiel). Seine Spiele verzerren den Schnitt, die Kalibrierung prüfen wir an den übrigen Spielen.
          if (m.home === start || m.away === start) continue;
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
      expect(record.movements).toHaveLength(2);
      for (const m of record.movements) {
        expect(m.promoted.length).toBe(m.relegated.length);
        expect([2, 3]).toContain(m.promoted.length);
      }
      for (const l of LEAGUES) expect(next.competitions[l].clubs).toHaveLength(18);
      expect(new Set(LEAGUES.flatMap((l) => next.competitions[l].clubs)).size).toBe(54);
      expect(validateState(next)).toBeNull();
      expect(next.managers[0].clubId).toBe(start);
      s = next;
    }

    expect(s.season).toBe(11);
    expect(s.history).toHaveLength(10);
    expect(validateState(s)).toBeNull();
    const squadSizes = Object.values(s.clubs).map((c) => c.squad.length);
    expect(Math.max(...squadSizes)).toBeLessThan(40);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
