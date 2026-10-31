import { describe, expect, it } from "vitest";
import { autoLineup, lineupsEqual, positionFactor, repairLineup, validateLineup } from "../../src/engine/lineup";
import { slotPositions } from "../../src/engine/model";
import { makePlayer, makeState } from "./fixtures";

describe("positionFactor", () => {
  it("entspricht der Tabelle aus der Spec", () => {
    expect(positionFactor("DF", "DF")).toBe(1);
    expect(positionFactor("DF", "MF")).toBe(0.85);
    expect(positionFactor("FW", "MF")).toBe(0.85);
    expect(positionFactor("DF", "FW")).toBe(0.65);
    expect(positionFactor("GK", "DF")).toBe(0.3);
    expect(positionFactor("MF", "GK")).toBe(0.3);
  });
});

describe("autoLineup", () => {
  it("stellt 11 verschiedene Spieler auf natürlichen Positionen auf", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const l = autoLineup(s, "c1", "4-3-3");
    expect(l.starters).toHaveLength(11);
    expect(new Set(l.starters).size).toBe(11);
    const slots = slotPositions("4-3-3");
    l.starters.forEach((id, i) => expect(s.players[id].position).toBe(slots[i]));
    expect(l.bench.length).toBeLessThanOrEqual(9);
    expect(l.bench.some((id) => s.players[id].position === "GK")).toBe(true);
    expect(validateLineup(s, "c1", l)).toBeNull();
  });

  it("nimmt die stärksten Spieler und lässt verletzte weg", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.players["c1-FW1"].strength = 90;
    s.players["c1-FW2"].strength = 85;
    s.players["c1-FW2"].injury = { matchesLeft: 3 };
    const l = autoLineup(s, "c1", "4-4-2");
    expect(l.starters).toContain("c1-FW1");
    expect(l.starters).not.toContain("c1-FW2");
    expect(l.bench).not.toContain("c1-FW2");
  });

  it("setzt einen Feldspieler ins Tor, wenn kein Torwart verfügbar ist", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    for (const id of ["c1-GK1", "c1-GK2", "c1-GK3"]) s.players[id].injury = { matchesLeft: 2 };
    const l = autoLineup(s, "c1", "4-4-2");
    expect(l.starters).toHaveLength(11);
    expect(s.players[l.starters[0]].position).not.toBe("GK");
  });
});

describe("validateLineup", () => {
  it("meldet zu wenige Spieler, Doppelte, Fremde, Verletzte und Gesperrte", () => {
    const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
    const ok = autoLineup(s, "c1", "4-4-2");
    expect(validateLineup(s, "c1", { ...ok, starters: ok.starters.slice(0, 10) })).toMatch(/genau 11/);
    expect(validateLineup(s, "c1", { ...ok, bench: [ok.starters[0]] })).toMatch(/doppelt/);
    expect(validateLineup(s, "c1", { ...ok, bench: ["c2-MF1"] })).toMatch(/nicht zum Kader/);
    s.players[ok.starters[5]].injury = { matchesLeft: 1 };
    expect(validateLineup(s, "c1", ok)).toMatch(/verletzt/);
    s.players[ok.starters[5]].injury = null;
    s.players[ok.starters[6]].suspension = { matchesLeft: 1 };
    expect(validateLineup(s, "c1", ok)).toMatch(/gesperrt/);
  });

  it("meldet zu viele Ersatzspieler", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const ok = autoLineup(s, "c1", "4-4-2");
    const rest = s.clubs.c1.squad.filter((id) => !ok.starters.includes(id));
    expect(validateLineup(s, "c1", { starters: ok.starters, bench: rest.slice(0, 10) })).toMatch(/Höchstens 9/);
  });
});

describe("repairLineup", () => {
  it("ersetzt nur den verletzten Spieler und lässt den Rest an seinem Platz", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const l = autoLineup(s, "c1", "4-4-2");
    const injured = l.starters[3];
    s.players[injured].injury = { matchesLeft: 2 };
    const r = repairLineup(s, "c1", l, "4-4-2");
    expect(r.starters).toHaveLength(11);
    expect(r.starters).not.toContain(injured);
    r.starters.forEach((id, i) => {
      if (i !== 3) expect(id).toBe(l.starters[i]);
    });
    expect(validateLineup(s, "c1", r)).toBeNull();
  });

  it("lässt eine gültige Aufstellung unverändert", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const l = autoLineup(s, "c1", "4-4-2");
    expect(lineupsEqual(repairLineup(s, "c1", l, "4-4-2"), l)).toBe(true);
  });

  it("entfernt Spieler, die nicht mehr im Kader sind", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const l = autoLineup(s, "c1", "4-4-2");
    const gone = l.starters[8];
    s.clubs.c1.squad = s.clubs.c1.squad.filter((id) => id !== gone);
    s.players.x = makePlayer("x", "FW", 99, { clubId: "c1" });
    const r = repairLineup(s, "c1", l, "4-4-2");
    expect(r.starters).not.toContain(gone);
    expect(r.starters).not.toContain("x");
  });
});
