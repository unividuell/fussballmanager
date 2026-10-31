import { describe, expect, it } from "vitest";
import { isAvailable } from "../../src/engine/model";
import { MIN_AVAILABLE, ensureMinimumSquad } from "../../src/engine/squad";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

describe("ensureMinimumSquad", () => {
  it("ändert nichts bei genug einsatzfähigen Spielern", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    expect(ensureMinimumSquad(s, "c1", Rng.fromSeed(1))).toHaveLength(0);
    expect(s.clubs.c1.squad).toHaveLength(25);
  });

  it("ergänzt Amateure, wenn zu viele ausfallen, inklusive Torwart", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const squad = s.clubs.c1.squad;
    for (const id of squad.slice(0, 15)) s.players[id].injury = { matchesLeft: 3 };
    const added = ensureMinimumSquad(s, "c1", Rng.fromSeed(1));
    const available = s.clubs.c1.squad.map((id) => s.players[id]).filter(isAvailable);
    expect(available.length).toBeGreaterThanOrEqual(MIN_AVAILABLE);
    expect(available.some((p) => p.position === "GK")).toBe(true);
    expect(added.length).toBeGreaterThan(0);
    for (const p of added) {
      expect(p.clubId).toBe("c1");
      expect(s.players[p.id]).toBe(p);
      expect(p.strength).toBeLessThan(60);
    }
  });
});
