import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import type { Competition, Match } from "../../src/engine/model";

function m(home: string, away: string, h: number | null, a: number | null): Match {
  return { id: `${home}${away}`, competitionId: "L", round: 1, home, away, result: h === null ? null : { home: h, away: a! }, events: [], penalties: null };
}
function league(matches: Match[]): Competition {
  return { id: "L", name: "Test", format: "league", clubs: ["a", "b", "c", "d"], rounds: 6, matches };
}

describe("computeStandings", () => {
  it("zählt Punkte, Tore und Spiele; ungespielte Spiele zählen nicht", () => {
    const t = computeStandings(league([m("a", "b", 2, 0), m("c", "d", 1, 1), m("a", "c", null, null)]));
    const a = t.find((r) => r.club === "a")!;
    expect(a).toMatchObject({ played: 1, won: 1, points: 3, goalsFor: 2, goalsAgainst: 0, goalDiff: 2 });
    const c = t.find((r) => r.club === "c")!;
    expect(c).toMatchObject({ played: 1, drawn: 1, points: 1 });
    expect(t[0].club).toBe("a");
    expect(t[3].club).toBe("b");
  });

  it("sortiert bei Punktgleichheit nach Tordifferenz, dann erzielten Toren", () => {
    const t = computeStandings(league([m("a", "d", 3, 2), m("b", "c", 1, 0), m("c", "a", 0, 0), m("d", "b", 0, 0)]));
    // a: 4 Pkt, +1, 3 Tore; b: 4 Pkt, +1, 1 Tor
    expect(t[0].club).toBe("a");
    expect(t[1].club).toBe("b");
  });

  it("nutzt den direkten Vergleich bei Gleichheit von Punkten, Differenz und Toren", () => {
    // a und b: je 3 Punkte, +0, 2 Tore; a hat b direkt geschlagen
    const t = computeStandings(league([m("a", "b", 2, 1), m("b", "c", 1, 0), m("c", "a", 1, 0)]));
    const ia = t.findIndex((r) => r.club === "a");
    const ib = t.findIndex((r) => r.club === "b");
    expect(ia).toBeLessThan(ib);
  });

  it("ohne Spiele: alle mit 0 Punkten, nach ID sortiert", () => {
    expect(computeStandings(league([])).map((r) => r.club)).toEqual(["a", "b", "c", "d"]);
  });
});
