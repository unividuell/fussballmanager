import { describe, expect, it } from "vitest";
import type { LiveSide } from "../../src/engine/match/simulate";
import { addSub, currentBench, currentPitch, emptyDraft, remainingSubs, removeSub, toCommand } from "../../src/ui/logic/halftimeDraft";

function side(subsUsed = 0): LiveSide {
  return {
    club: "c1",
    tactics: { formation: "4-4-2", style: "normal", hardness: "normal" },
    pitch: [
      { id: "gk", slot: "GK" },
      { id: "d1", slot: "DF" },
      { id: "m1", slot: "MF" },
    ],
    bench: ["b1", "b2"],
    subsUsed,
    fitness: {},
    booked: [],
    sentOff: [],
    injured: [],
    played: ["gk", "d1", "m1"],
    goals: 0,
    bonus: 1,
  };
}

describe("halftimeDraft", () => {
  it("plant einen Wechsel und zeigt Platz und Bank danach", () => {
    const d = addSub(side(), emptyDraft(), "d1", "b2");
    if (typeof d === "string") throw new Error(d);
    expect(currentPitch(side(), d)).toEqual([{ id: "gk", slot: "GK" }, { id: "b2", slot: "DF" }, { id: "m1", slot: "MF" }]);
    expect(currentBench(side(), d)).toEqual(["b1"]);
    expect(remainingSubs(side(), d)).toBe(4);
  });

  it("lehnt Spieler ab, die nicht auf dem Platz bzw. nicht auf der Bank sind", () => {
    expect(addSub(side(), emptyDraft(), "b1", "b2")).toBe("Der Spieler steht nicht auf dem Platz.");
    expect(addSub(side(), emptyDraft(), "d1", "m1")).toBe("Der Spieler sitzt nicht auf der Bank.");
    const d = addSub(side(), emptyDraft(), "d1", "b2") as ReturnType<typeof emptyDraft>;
    expect(addSub(side(), d, "d1", "b1")).toBe("Der Spieler steht nicht auf dem Platz.");
    expect(addSub(side(), d, "m1", "b2")).toBe("Der Spieler sitzt nicht auf der Bank.");
  });

  it("ohne freie Wechsel gibt es eine Meldung", () => {
    expect(remainingSubs(side(5), emptyDraft())).toBe(0);
    expect(addSub(side(5), emptyDraft(), "d1", "b1")).toBe("Keine Wechsel mehr übrig.");
  });

  it("entfernt einen geplanten Wechsel", () => {
    const d = addSub(side(), emptyDraft(), "d1", "b2") as ReturnType<typeof emptyDraft>;
    expect(removeSub(d, 0).subs).toEqual([]);
    expect(d.subs).toHaveLength(1);
  });

  it("baut den Befehl – oder null, wenn nichts geändert wurde", () => {
    expect(toCommand("mgr1", emptyDraft())).toBeNull();
    const d = addSub(side(), emptyDraft(), "d1", "b2") as ReturnType<typeof emptyDraft>;
    expect(toCommand("mgr1", { ...d, tactics: { style: "offensive" } })).toEqual({
      type: "halftimeChanges",
      managerId: "mgr1",
      substitutions: [{ out: "d1", in: "b2" }],
      tactics: { style: "offensive" },
    });
    expect(toCommand("mgr1", { subs: [], tactics: { formation: "4-3-3" } })).toEqual({
      type: "halftimeChanges",
      managerId: "mgr1",
      substitutions: [],
      tactics: { formation: "4-3-3" },
    });
    expect(toCommand("mgr1", d)?.tactics).toBeNull();
  });
});
