import { describe, expect, it } from "vitest";
import { createLeague, matchesOfRound, roundRobin } from "../../src/engine/competition/schedule";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

const clubs = Array.from({ length: 18 }, (_, i) => `c${i + 1}`);

describe("roundRobin", () => {
  const rounds = roundRobin(clubs);

  it("hat 34 Runden mit je 9 Spielen", () => {
    expect(rounds).toHaveLength(34);
    for (const r of rounds) expect(r).toHaveLength(9);
  });

  it("jeder Verein spielt genau einmal pro Runde", () => {
    for (const r of rounds) {
      const ids = r.flat();
      expect(new Set(ids).size).toBe(18);
    }
  });

  it("jede Paarung kommt genau einmal zu Hause und einmal auswärts vor", () => {
    const seen = new Map<string, number>();
    for (const r of rounds) for (const [h, a] of r) seen.set(`${h}|${a}`, (seen.get(`${h}|${a}`) ?? 0) + 1);
    for (const h of clubs)
      for (const a of clubs) {
        if (h === a) continue;
        expect(seen.get(`${h}|${a}`)).toBe(1);
      }
  });

  it("jeder Verein hat 17 Heimspiele", () => {
    for (const c of clubs) {
      const home = rounds.map((r) => r.some(([h]) => h === c));
      expect(home.filter(Boolean)).toHaveLength(17);
    }
  });

  it("lehnt eine ungerade Anzahl ab", () => {
    expect(() => roundRobin(["a", "b", "c"])).toThrow();
  });
});

describe("createLeague", () => {
  it("legt 306 Spiele mit eindeutigen IDs an", () => {
    const s = makeState([]);
    const league = createLeague(s, "L1", "1. Liga", clubs, Rng.fromSeed(1));
    expect(league.matches).toHaveLength(306);
    expect(new Set(league.matches.map((m) => m.id)).size).toBe(306);
    expect(league.rounds).toBe(34);
    expect(matchesOfRound(league, 1)).toHaveLength(9);
    expect(league.matches.every((m) => m.result === null && m.competitionId === "L1")).toBe(true);
  });
});
