import { describe, expect, it } from "vitest";
import { CLUBS } from "../../src/engine/clubs";
import { CLUB_COUNT, generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";

describe("generateWorld", () => {
  const w = generateWorld(1234);
  const clubs = Object.values(w.clubs);

  it("ist deterministisch", () => {
    expect(JSON.stringify(generateWorld(1234))).toBe(JSON.stringify(w));
    expect(JSON.stringify(generateWorld(999))).not.toBe(JSON.stringify(w));
  });

  it("erzeugt die 64 Vereine aus dem Datensatz mit Name, Kurzname, Farben und Ruf", () => {
    expect(CLUB_COUNT).toBe(64);
    expect(clubs).toHaveLength(CLUB_COUNT);
    for (const seed of CLUBS) {
      const club = clubs.find((c) => c.name === seed.name)!;
      expect(club, seed.name).toBeTruthy();
      expect(club.shortName).toBe(seed.shortName);
      expect(club.colors).toEqual(seed.colors);
      expect(club.reputation).toBe(seed.reputation);
    }
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

  it("Kaderstärke folgt der Kaderstärke aus dem Datensatz, nicht dem Ruf", () => {
    const starters = (name: string) => {
      const c = clubs.find((x) => x.name === name)!;
      return c.lineup.starters.reduce((s, id) => s + w.players[id].strength, 0) / c.lineup.starters.length;
    };
    const byLeague = (l: string) => CLUBS.filter((c) => c.league === l).map((c) => starters(c.name));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const l2 = mean(byLeague("L2"));
    for (const v of byLeague("L1")) expect(v).toBeGreaterThan(l2);
    for (const v of byLeague("L3")) expect(v).toBeLessThan(l2);
    expect(starters("Fortuna Düsseldorf")).toBeLessThan(Math.min(...byLeague("L1")));
  });

  it("jeder Verein hat eine gültige Aufstellung", () => {
    for (const c of clubs) expect(validateLineup(w, c.id, c.lineup)).toBeNull();
  });

  it("ist reines JSON", () => {
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });

  it("Vereinsspieler haben Verträge, 30 Spieler sind vereinslos", () => {
    for (const c of clubs) {
      for (const id of c.squad) {
        const p = w.players[id];
        expect(p.contract).not.toBeNull();
        expect(p.contract!.salary).toBeGreaterThan(0);
        expect(p.contract!.endsSeason).toBeGreaterThanOrEqual(1);
        expect(p.contract!.endsSeason).toBeLessThanOrEqual(4);
        expect(p.retired).toBe(false);
      }
    }
    const free = Object.values(w.players).filter((p) => p.clubId === null);
    expect(free).toHaveLength(30);
    expect(free.every((p) => p.contract === null)).toBe(true);
  });

  it("Vereine starten mit Kapital, Stadion, Vorstand und Training", () => {
    for (const c of clubs) {
      expect(c.finance.balance).toBeGreaterThan(0);
      expect(c.finance.stadiumStage).toBeGreaterThanOrEqual(0);
      expect(c.finance.stadiumStage).toBeLessThanOrEqual(4);
      expect(c.board.confidence).toBe(60);
      expect(c.training).toEqual({ intensity: "normal", focus: "technique", individual: [] });
      expect(c.tacticsBonus).toBe(1);
    }
    expect(w.negotiations).toEqual([]);
    expect(w.transferOffers).toEqual([]);
    expect(w.messages).toEqual([]);
  });
});
