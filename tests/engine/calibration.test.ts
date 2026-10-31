import { describe, expect, it } from "vitest";
import { autoLineup } from "../../src/engine/lineup";
import { finalScore, simulateHalf, startMatch } from "../../src/engine/match/simulate";
import type { Match } from "../../src/engine/model";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

function series(homeStrength: number, awayStrength: number, n: number, seed: number) {
  const s = makeState([{ id: "h", strength: homeStrength }, { id: "a", strength: awayStrength }]);
  for (const id of ["h", "a"]) s.clubs[id].lineup = autoLineup(s, id, "4-4-2");
  const match: Match = { id: "m", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
  const rng = Rng.fromSeed(seed);
  let goals = 0, home = 0, draw = 0, away = 0;
  for (let i = 0; i < n; i++) {
    const live = startMatch(s, match);
    simulateHalf(s, live, 1, rng);
    simulateHalf(s, live, 2, rng);
    const r = finalScore(live);
    goals += r.home + r.away;
    if (r.home > r.away) home++;
    else if (r.home === r.away) draw++;
    else away++;
  }
  return { goals: goals / n, home: home / n, draw: draw / n, away: away / n };
}

describe("Kalibrierung (Spec 7.3)", () => {
  it("gleich starke Teams: 2,6–3,0 Tore, H/U/A ≈ 45/27/28 ±5", () => {
    const r = series(70, 70, 5000, 1);
    expect(r.goals).toBeGreaterThanOrEqual(2.6);
    expect(r.goals).toBeLessThanOrEqual(3.0);
    expect(r.home).toBeGreaterThanOrEqual(0.4);
    expect(r.home).toBeLessThanOrEqual(0.5);
    expect(r.draw).toBeGreaterThanOrEqual(0.22);
    expect(r.draw).toBeLessThanOrEqual(0.32);
    expect(r.away).toBeGreaterThanOrEqual(0.23);
    expect(r.away).toBeLessThanOrEqual(0.33);
  });

  it("ein 10 Punkte schwächeres Team gewinnt 15–25 % (Mittel aus Heim und Auswärts)", () => {
    const weakHome = series(60, 70, 2500, 2);
    const weakAway = series(70, 60, 2500, 3);
    const winRate = (weakHome.home + weakAway.away) / 2;
    expect(winRate).toBeGreaterThanOrEqual(0.15);
    expect(winRate).toBeLessThanOrEqual(0.25);
  });
});
