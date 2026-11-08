import { describe, expect, it } from "vitest";
import { autoLineup } from "../../../src/engine/lineup";
import { simulateHalf, startMatch, type LiveMatch, type Side } from "../../../src/engine/match/simulate";
import type { Match, MatchEvent } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { hash01 } from "../../../src/ui/live/hash";
import { pressureCurve } from "../../../src/ui/live/pressure";
import { makeState } from "../../engine/fixtures";

function played(minutes: 45 | 90): LiveMatch {
  const s = makeState([{ id: "h", strength: 70 }, { id: "a", strength: 70 }]);
  for (const id of ["h", "a"]) s.clubs[id].lineup = autoLineup(s, id, "4-4-2");
  const match: Match = { id: "m1", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
  const rng = Rng.fromSeed(9);
  const live = startMatch(s, match);
  simulateHalf(s, live, 1, rng);
  if (minutes === 90) simulateHalf(s, live, 2, rng);
  return live;
}

function synthetic(attacks: Side[], events: MatchEvent[]): LiveMatch {
  const live = played(45);
  return { ...live, attacks, events };
}

describe("hash01", () => {
  it("ist deterministisch und liegt in [0,1)", () => {
    expect(hash01("m1", 12)).toBe(hash01("m1", 12));
    expect(hash01("m1", 12)).not.toBe(hash01("m1", 13));
    for (let i = 0; i < 1000; i++) {
      const v = hash01("x", i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("pressureCurve", () => {
  it("hat eine Länge pro simulierter Minute und bleibt in [-1,1]", () => {
    const c = pressureCurve(played(45));
    expect(c).toHaveLength(45);
    expect(c.every((v) => v >= -1 && v <= 1)).toBe(true);
    expect(pressureCurve(played(90))).toHaveLength(90);
  });

  it("vor einer Chance steigt der Druck zur angreifenden Seite", () => {
    const away: Side[] = Array(45).fill("away");
    const without = pressureCurve(synthetic(away, []));
    const withChance = pressureCurve(synthetic(away, [{ minute: 30, type: "chance", club: "h", player: "p", big: true }]));
    expect(withChance[28]).toBeGreaterThan(without[28]);
    expect(withChance[10]).toBe(without[10]);
  });

  it("folgt der Angriffsseite", () => {
    const home = pressureCurve(synthetic(Array(45).fill("home"), []));
    const away = pressureCurve(synthetic(Array(45).fill("away"), []));
    expect(home[40]).toBeGreaterThan(0.5);
    expect(away[40]).toBeLessThan(-0.5);
  });

  it("gleiche Eingabe, gleiche Kurve", () => {
    const live = played(90);
    expect(pressureCurve(live)).toEqual(pressureCurve(structuredClone(live)));
  });
});
