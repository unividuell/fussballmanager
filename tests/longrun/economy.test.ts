import { describe, expect, it } from "vitest";
import { isOverLimit } from "../../src/engine/economy/money";
import { generateWorld } from "../../src/engine/generator";
import { COMP, type GameState } from "../../src/engine/model";
import { finishSeason, isSeasonOver, playMatchdayAuto, startNewGame } from "../../src/engine/season";

function starterAvg(s: GameState, league: string): number {
  const clubs = s.competitions[league].clubs.map((id) => s.clubs[id]);
  const values = clubs.flatMap((c) => c.lineup.starters.map((id) => s.players[id]?.strength ?? 0));
  return values.reduce((x, y) => x + y, 0) / values.length;
}

describe("Langzeittest: Wirtschaft über 10 Saisons", () => {
  it("bleibt stabil", { timeout: 600_000 }, () => {
    const world = generateWorld(2027);
    const r = startNewGame(world, [{ name: "Test", clubId: Object.keys(world.clubs)[12] }]);
    if (!r.ok) throw new Error(r.error);
    let s: GameState = r.state;
    const startL1 = starterAvg(s, COMP.first);
    const report: string[] = [];

    for (let season = 1; season <= 10; season++) {
      while (!isSeasonOver(s)) s = playMatchdayAuto(s);
      s = finishSeason(s).state;

      const clubs = Object.values(s.clubs);
      const balances = clubs.map((c) => c.finance.balance).sort((a, b) => a - b);
      const median = balances[Math.floor(balances.length / 2)];
      const over = clubs.filter(isOverLimit).length;
      const free = Object.values(s.players).filter((p) => p.clubId === null && !p.retired).length;
      const active = Object.values(s.players).filter((p) => !p.retired).length;
      const l1 = starterAvg(s, COMP.first);
      const l2 = starterAvg(s, COMP.second);
      report.push(`Saison ${season}: Median ${median}, über Limit ${over}, frei ${free}, aktiv ${active}, L1 ${l1.toFixed(1)}, L2 ${l2.toFixed(1)}`);

      for (const c of clubs) {
        expect(Number.isFinite(c.finance.balance)).toBe(true);
        expect(c.squad.length).toBeLessThanOrEqual(34);
        if (c.managerId === null) expect(c.squad.length).toBeGreaterThanOrEqual(18);
        for (const id of c.squad) expect(s.players[id].clubId).toBe(c.id);
      }
      expect(over).toBeLessThanOrEqual(8);
      expect(median).toBeGreaterThan(-3_000_000);
      expect(median).toBeLessThan(60_000_000);
      expect(free).toBeGreaterThanOrEqual(5);
      expect(free).toBeLessThanOrEqual(150);
      expect(l1).toBeGreaterThan(l2 + 3);
      expect(Math.abs(l1 - startL1)).toBeLessThan(8);
      expect(active).toBeLessThan(2_000);
      for (const m of s.managers) expect(s.messages.filter((x) => x.managerId === m.id).length).toBeLessThanOrEqual(60);
    }

    console.log(report.join("\n"));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe("Langzeittest: Vorstand entlässt untätige Manager nicht zu schnell", () => {
  it("höchstens 2 von 8 Managern fliegen in Saison 1", { timeout: 600_000 }, () => {
    const sacked: number[] = [];
    for (let i = 0; i < 8; i++) {
      const world = generateWorld(13);
      const r = startNewGame(world, [{ name: "Test", clubId: Object.keys(world.clubs)[i] }]);
      if (!r.ok) throw new Error(r.error);
      let s: GameState = r.state;
      let fired = false;
      while (!isSeasonOver(s)) {
        s = playMatchdayAuto(s);
        if (s.managers[0].clubId === null) fired = true;
      }
      if (fired) sacked.push(i);
    }
    console.log(`Entlassen in Saison 1: ${sacked.length} von 8 (Clubs ${sacked.join(", ") || "-"})`);
    expect(sacked.length).toBeLessThanOrEqual(2);
  });
});
