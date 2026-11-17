import { describe, expect, it } from "vitest";
import { CLUBS } from "../../src/engine/clubs";
import { generateWorld } from "../../src/engine/generator";
import { isRegionalliga } from "../../src/engine/regionalliga";
import { COMP, LEAGUE_SIZE } from "../../src/engine/model";
import { currentFixtures, leagueOf, startNewGame } from "../../src/engine/season";

describe("startNewGame", () => {
  const world = generateWorld(77);
  const ids = Object.keys(world.clubs);

  it("jeder Verein startet in der Liga aus dem Datensatz, drei Ligen mit je 18", () => {
    const r = startNewGame(world, [{ name: "Markus", clubId: ids[0] }]);
    if (!r.ok) throw new Error(r.error);
    const s = r.state;
    for (const l of [COMP.first, COMP.second, COMP.third]) expect(s.competitions[l].clubs).toHaveLength(LEAGUE_SIZE);
    for (const c of Object.values(s.clubs)) {
      const seed = CLUBS.find((x) => x.name === c.name)!;
      if ((seed.league as string) === "RL") expect(isRegionalliga(s, c.id), c.name).toBe(true);
      else expect(leagueOf(s, c.id), c.name).toBe(seed.league);
    }
    expect(Object.values(s.clubs).filter((c) => isRegionalliga(s, c.id))).toHaveLength(10);
    const fortuna = Object.values(s.clubs).find((c) => c.name === "Fortuna Düsseldorf")!;
    expect(leagueOf(s, fortuna.id)).toBe(COMP.third);
    const minL2 = Math.min(...s.competitions[COMP.second].clubs.map((id) => s.clubs[id].reputation));
    expect(fortuna.reputation).toBeGreaterThan(minL2);
    expect(s.calendar).toHaveLength(34);
    expect(s.calendarIndex).toBe(0);
    expect(currentFixtures(s)).toHaveLength(27);
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
