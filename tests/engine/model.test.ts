import { describe, expect, it } from "vitest";
import { FORMATION_LIST, FORMATIONS, isAvailable, newId, slotPositions } from "../../src/engine/model";
import { makePlayer, makeSquad, makeState } from "./fixtures";

describe("model", () => {
  it("jede Formation hat 10 Feldspieler und 11 Plätze, Torwart zuerst", () => {
    for (const f of FORMATION_LIST) {
      const c = FORMATIONS[f];
      expect(c.DF + c.MF + c.FW).toBe(10);
      const slots = slotPositions(f);
      expect(slots).toHaveLength(11);
      expect(slots[0]).toBe("GK");
      expect(slots.filter((s) => s === "GK")).toHaveLength(1);
    }
  });

  it("slotPositions ordnet Abwehr, Mittelfeld, Sturm", () => {
    expect(slotPositions("3-5-2")).toEqual(["GK", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW", "FW"]);
  });

  it("newId zählt hoch", () => {
    const s = makeState([]);
    expect(newId(s, "p")).toBe("p1");
    expect(newId(s, "p")).toBe("p2");
  });

  it("isAvailable erkennt Verletzung und Sperre", () => {
    expect(isAvailable(makePlayer("a", "MF", 50))).toBe(true);
    expect(isAvailable(makePlayer("a", "MF", 50, { injury: { matchesLeft: 2 } }))).toBe(false);
    expect(isAvailable(makePlayer("a", "MF", 50, { suspension: { matchesLeft: 1 } }))).toBe(false);
  });

  it("makeSquad erzeugt 3 TW, 8 ABW, 8 MF, 6 ST", () => {
    const sq = makeSquad("c1", 60);
    expect(sq.filter((p) => p.position === "GK")).toHaveLength(3);
    expect(sq.filter((p) => p.position === "DF")).toHaveLength(8);
    expect(sq.filter((p) => p.position === "MF")).toHaveLength(8);
    expect(sq.filter((p) => p.position === "FW")).toHaveLength(6);
  });
});
