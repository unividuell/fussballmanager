import { describe, expect, it } from "vitest";
import { CLUB_COUNT, generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";

describe("generateWorld", () => {
  const w = generateWorld(1234);
  const clubs = Object.values(w.clubs);

  it("ist deterministisch", () => {
    expect(JSON.stringify(generateWorld(1234))).toBe(JSON.stringify(w));
    expect(JSON.stringify(generateWorld(999))).not.toBe(JSON.stringify(w));
  });

  it("erzeugt 36 Vereine mit eindeutigen Namen", () => {
    expect(clubs).toHaveLength(CLUB_COUNT);
    expect(new Set(clubs.map((c) => c.name)).size).toBe(CLUB_COUNT);
  });

  it("jeder Verein hat 25 Spieler: 3 TW, 8 ABW, 8 MF, 6 ST", () => {
    for (const c of clubs) {
      const ps = c.squad.map((id) => w.players[id]);
      expect(ps).toHaveLength(25);
      expect(ps.filter((p) => p.position === "GK")).toHaveLength(3);
      expect(ps.filter((p) => p.position === "DF")).toHaveLength(8);
      expect(ps.filter((p) => p.position === "MF")).toHaveLength(8);
      expect(ps.filter((p) => p.position === "FW")).toHaveLength(6);
      expect(ps.every((p) => p.clubId === c.id)).toBe(true);
    }
  });

  it("Werte liegen in gültigen Bereichen", () => {
    for (const p of Object.values(w.players)) {
      expect(p.strength).toBeGreaterThanOrEqual(1);
      expect(p.strength).toBeLessThanOrEqual(99);
      expect(p.potential).toBeGreaterThanOrEqual(p.strength);
      expect(p.potential).toBeLessThanOrEqual(99);
      expect(p.age).toBeGreaterThanOrEqual(17);
      expect(p.age).toBeLessThanOrEqual(34);
      expect(p.fitness).toBe(100);
    }
    for (const c of clubs) {
      expect(c.reputation).toBeGreaterThanOrEqual(1);
      expect(c.reputation).toBeLessThanOrEqual(100);
      expect(c.colors[0]).not.toBe(c.colors[1]);
    }
  });

  it("stärkere Reputation bedeutet im Schnitt stärkere Spieler", () => {
    const sorted = [...clubs].sort((a, b) => b.reputation - a.reputation);
    const avg = (c: (typeof clubs)[number]) => c.squad.reduce((s, id) => s + w.players[id].strength, 0) / c.squad.length;
    const top = sorted.slice(0, 6).reduce((s, c) => s + avg(c), 0) / 6;
    const bottom = sorted.slice(-6).reduce((s, c) => s + avg(c), 0) / 6;
    expect(top - bottom).toBeGreaterThan(8);
  });

  it("jeder Verein hat eine gültige Aufstellung", () => {
    for (const c of clubs) expect(validateLineup(w, c.id, c.lineup)).toBeNull();
  });

  it("ist reines JSON", () => {
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });
});
