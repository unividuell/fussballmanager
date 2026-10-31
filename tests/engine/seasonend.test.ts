import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import { generateWorld } from "../../src/engine/generator";
import { COMP, type Competition, type GameState } from "../../src/engine/model";
import { finishSeason, playMatchdayAuto, relegationWinner, startNewGame, topScorer } from "../../src/engine/season";

function playedSeason(seed: number): GameState {
  const world = generateWorld(seed);
  const r = startNewGame(world, [{ name: "M", clubId: Object.keys(world.clubs)[5] }]);
  if (!r.ok) throw new Error(r.error);
  let s = r.state;
  for (let i = 0; i < 36; i++) s = playMatchdayAuto(s);
  return s;
}

describe("finishSeason", () => {
  const s = playedSeason(31);
  const t1 = computeStandings(s.competitions[COMP.first]).map((r) => r.club);
  const t2 = computeStandings(s.competitions[COMP.second]).map((r) => r.club);
  const winner = relegationWinner(s)!;
  const { state: next, record } = finishSeason(s);

  it("trägt Meister, Auf- und Absteiger in die Chronik ein", () => {
    expect(record.season).toBe(1);
    expect(record.champions[COMP.first]).toBe(t1[0]);
    expect(record.champions[COMP.second]).toBe(t2[0]);
    expect(record.relegated).toEqual(expect.arrayContaining([t1[16], t1[17]]));
    expect(record.promoted).toEqual(expect.arrayContaining([t2[0], t2[1]]));
    if (winner === t2[2]) {
      expect(record.promoted).toContain(t2[2]);
      expect(record.relegated).toContain(t1[15]);
      expect(record.promoted).toHaveLength(3);
    } else {
      expect(record.promoted).toHaveLength(2);
      expect(record.relegated).toHaveLength(2);
    }
    expect(next.history).toEqual([record]);
  });

  it("stellt die neuen Ligen zusammen und beginnt Saison 2", () => {
    expect(next.season).toBe(2);
    const l1 = next.competitions[COMP.first].clubs;
    const l2 = next.competitions[COMP.second].clubs;
    expect(l1).toHaveLength(18);
    expect(l2).toHaveLength(18);
    expect(new Set([...l1, ...l2]).size).toBe(36);
    for (const c of record.promoted) expect(l1).toContain(c);
    for (const c of record.relegated) expect(l2).toContain(c);
    expect(next.competitions[COMP.relegation]).toBeUndefined();
    expect(next.calendar).toHaveLength(34);
    expect(next.calendarIndex).toBe(0);
    expect(Object.values(next.players).every((p) => p.stats.apps === 0 && p.yellowCards === 0)).toBe(true);
  });

  it("verändert den alten Spielstand nicht", () => {
    expect(s.season).toBe(1);
    expect(s.history).toHaveLength(0);
  });

  it("wirft, wenn die Saison noch läuft", () => {
    expect(() => finishSeason(next)).toThrow(/noch nicht vorbei/);
  });
});

describe("topScorer", () => {
  it("zählt Tore aus Ereignissen; bei Gleichstand gewinnt die kleinere ID", () => {
    const c: Competition = {
      id: "L",
      name: "L",
      format: "league",
      clubs: [],
      rounds: 1,
      matches: [
        {
          id: "m",
          competitionId: "L",
          round: 1,
          home: "a",
          away: "b",
          result: { home: 2, away: 2 },
          penalties: null,
          events: [
            { minute: 1, type: "goal", club: "a", player: "p9" },
            { minute: 2, type: "goal", club: "a", player: "p9" },
            { minute: 3, type: "goal", club: "b", player: "p2" },
            { minute: 4, type: "goal", club: "b", player: "p2" },
          ],
        },
      ],
    };
    expect(topScorer(c)).toEqual({ player: "p2", goals: 2 });
    expect(topScorer({ ...c, matches: [] })).toBeNull();
  });
});
