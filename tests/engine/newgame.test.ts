import { describe, expect, it } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { COMP, LEAGUE_SIZE } from "../../src/engine/model";
import { currentFixtures, leagueOf, startNewGame } from "../../src/engine/season";

describe("startNewGame", () => {
  const world = generateWorld(77);
  const ids = Object.keys(world.clubs);

  it("verteilt die 18 Vereine mit der höchsten Reputation auf die 1. Liga", () => {
    const r = startNewGame(world, [{ name: "Markus", clubId: ids[0] }]);
    if (!r.ok) throw new Error(r.error);
    const s = r.state;
    const l1 = s.competitions[COMP.first];
    const l2 = s.competitions[COMP.second];
    expect(l1.clubs).toHaveLength(LEAGUE_SIZE);
    expect(l2.clubs).toHaveLength(LEAGUE_SIZE);
    const minL1 = Math.min(...l1.clubs.map((c) => s.clubs[c].reputation));
    const maxL2 = Math.max(...l2.clubs.map((c) => s.clubs[c].reputation));
    expect(minL1).toBeGreaterThanOrEqual(maxL2);
    expect(s.calendar).toHaveLength(34);
    expect(s.calendarIndex).toBe(0);
    expect(currentFixtures(s)).toHaveLength(18);
    expect(leagueOf(s, l2.clubs[0])).toBe(COMP.second);
  });

  it("lehnt Prototyp-Namen als Verein ab", () => {
    const r = startNewGame(world, [{ name: "X", clubId: "constructor" }]);
    expect(r).toEqual({ ok: false, error: "Diesen Verein gibt es nicht." });
  });

  it("legt die Manager an und verknüpft sie mit ihren Vereinen", () => {
    const r = startNewGame(world, [{ name: "Anna", clubId: ids[3] }, { name: "Ben", clubId: ids[30] }]);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.managers.map((m) => m.name)).toEqual(["Anna", "Ben"]);
    const anna = r.state.managers[0];
    expect(r.state.clubs[ids[3]].managerId).toBe(anna.id);
    expect(anna.clubId).toBe(ids[3]);
  });

  it("verändert die übergebene Welt nicht", () => {
    const before = JSON.stringify(world);
    startNewGame(world, [{ name: "X", clubId: ids[0] }]);
    expect(JSON.stringify(world)).toBe(before);
  });

  it("lehnt ungültige Eingaben ab", () => {
    expect(startNewGame(world, [])).toMatchObject({ ok: false, error: expect.stringMatching(/1 bis 4/) });
    const five = Array.from({ length: 5 }, (_, i) => ({ name: `M${i}`, clubId: ids[i] }));
    expect(startNewGame(world, five)).toMatchObject({ ok: false });
    expect(startNewGame(world, [{ name: "  ", clubId: ids[0] }])).toMatchObject({ ok: false, error: expect.stringMatching(/Namen/) });
    expect(startNewGame(world, [{ name: "A", clubId: ids[0] }, { name: "B", clubId: ids[0] }])).toMatchObject({ ok: false, error: expect.stringMatching(/denselben Verein/) });
    expect(startNewGame(world, [{ name: "A", clubId: "gibts-nicht" }])).toMatchObject({ ok: false });
  });
});
