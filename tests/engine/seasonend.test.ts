import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import { generateWorld } from "../../src/engine/generator";
import { BOUNDARIES, COMP, LEAGUES, type Competition, type GameState } from "../../src/engine/model";
import { finishSeason, isSeasonOver, playMatchdayAuto, relegationWinner, startNewGame, topScorer } from "../../src/engine/season";

function playedSeason(seed: number): GameState {
  const world = generateWorld(seed);
  const r = startNewGame(world, [{ name: "M", clubId: Object.keys(world.clubs)[5] }]);
  if (!r.ok) throw new Error(r.error);
  let s = r.state;
  for (let i = 0; i < 36; i++) s = playMatchdayAuto(s);
  return s;
}

const table = (s: GameState, id: string) => computeStandings(s.competitions[id]).map((r) => r.club);

describe("finishSeason", () => {
  const s = playedSeason(31);
  const tables = Object.fromEntries(LEAGUES.map((l) => [l, table(s, l)]));
  const winners = Object.fromEntries(BOUNDARIES.map((b) => [b.relegation, relegationWinner(s, b.relegation)!]));
  const { state: next, record } = finishSeason(s);

  it("trägt Meister und Torschützen aller drei Ligen ein und an beiden Grenzen Auf- und Absteiger", () => {
    expect(record.season).toBe(1);
    for (const l of LEAGUES) {
      expect(record.champions[l]).toBe(tables[l][0]);
      expect(l in record.topScorers).toBe(true);
    }
    expect(record.movements).toHaveLength(2);
    for (const b of BOUNDARIES) {
      const m = record.movements.find((x) => x.upper === b.upper && x.lower === b.lower)!;
      const up = tables[b.upper];
      const low = tables[b.lower];
      expect(m.relegated).toEqual(expect.arrayContaining([up[16], up[17]]));
      expect(m.promoted).toEqual(expect.arrayContaining([low[0], low[1]]));
      if (winners[b.relegation] === low[2]) {
        expect(m.promoted).toEqual(expect.arrayContaining([low[2]]));
        expect(m.relegated).toEqual(expect.arrayContaining([up[15]]));
        expect(m.promoted).toHaveLength(3);
      } else {
        expect(m.promoted).toHaveLength(2);
        expect(m.relegated).toHaveLength(2);
      }
    }
    expect(next.history).toEqual([record]);
  });

  it("stellt die neuen Ligen zusammen und beginnt Saison 2", () => {
    expect(next.season).toBe(2);
    const all = LEAGUES.flatMap((l) => next.competitions[l].clubs);
    for (const l of LEAGUES) expect(next.competitions[l].clubs).toHaveLength(18);
    expect(new Set(all).size).toBe(54);
    for (const m of record.movements) {
      for (const c of m.promoted) expect(next.competitions[m.upper].clubs).toContain(c);
      for (const c of m.relegated) expect(next.competitions[m.lower].clubs).toContain(c);
    }
    for (const b of BOUNDARIES) expect(next.competitions[b.relegation]).toBeUndefined();
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

describe("Relegationen", () => {
  it("beide Relegationen liegen an denselben zwei Kalendertagen", () => {
    const world = generateWorld(31);
    const r = startNewGame(world, [{ name: "M", clubId: Object.keys(world.clubs)[5] }]);
    if (!r.ok) throw new Error(r.error);
    let s = r.state;
    for (let i = 0; i < 34; i++) s = playMatchdayAuto(s);
    expect(s.calendar).toHaveLength(36);
    for (const [index, round] of [[34, 1], [35, 2]]) {
      const ids = s.calendar[index].fixtures.map((f) => `${f.competitionId}/${f.round}`).sort();
      expect(ids).toEqual([`${COMP.relegation}/${round}`, `${COMP.relegation2}/${round}`]);
    }
    expect(isSeasonOver(s)).toBe(false);
    s = playMatchdayAuto(s);
    expect(isSeasonOver(s)).toBe(false);
    s = playMatchdayAuto(s);
    expect(isSeasonOver(s)).toBe(true);
  });

  it("beide Unterklassigen gewinnen die Relegation: je 3 Wechsel, alle Ligen 18 Vereine", () => {
    const s = playedSeason(31);
    for (const b of BOUNDARIES) {
      const rel = s.competitions[b.relegation];
      const lowerClub = rel.matches.find((m) => m.round === 1)!.home;
      for (const m of rel.matches) {
        m.penalties = null;
        m.result = m.home === lowerClub ? { home: 3, away: 0 } : { home: 0, away: 3 }; // Testaufbau
      }
      expect(relegationWinner(s, b.relegation)).toBe(lowerClub);
    }
    const { state: next, record } = finishSeason(s);
    for (const m of record.movements) {
      expect(m.promoted).toHaveLength(3);
      expect(m.relegated).toHaveLength(3);
    }
    for (const l of LEAGUES) expect(next.competitions[l].clubs).toHaveLength(18);
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
