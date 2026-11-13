import { describe, expect, it } from "vitest";
import { CLUBS, type ClubSeed } from "../../src/engine/clubs";

const inLeague = (l: ClubSeed["league"]) => CLUBS.filter((c) => c.league === l);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2;
};
const club = (name: string) => CLUBS.find((c) => c.name === name)!;

describe("Vereinsdatensatz", () => {
  it("54 Vereine, je 18 pro Liga", () => {
    expect(CLUBS).toHaveLength(54);
    for (const l of ["L1", "L2", "L3"] as const) expect(inLeague(l)).toHaveLength(18);
  });

  it("Namen und Kurznamen sind eindeutig, Kurznamen höchstens 13 Zeichen", () => {
    expect(new Set(CLUBS.map((c) => c.name)).size).toBe(54);
    expect(new Set(CLUBS.map((c) => c.shortName)).size).toBe(54);
    for (const c of CLUBS) expect(c.shortName.length, c.shortName).toBeLessThanOrEqual(13);
  });

  it("Ruf und Kaderstärke zwischen 1 und 100, zwei verschiedene Farben im Format #rrggbb", () => {
    for (const c of CLUBS) {
      for (const v of [c.reputation, c.strength]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
      for (const col of c.colors) expect(col).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.colors[0]).not.toBe(c.colors[1]);
    }
  });

  it("die Bundesliga enthält FC Bayern München, die 3. Liga TSV Havelse und keine Zweitvertretung", () => {
    expect(club("FC Bayern München").league).toBe("L1");
    expect(club("TSV Havelse").league).toBe("L3");
    for (const c of CLUBS) expect(c.name.endsWith(" II")).toBe(false);
  });

  it("Kaderstärke liegt im Band der Liga", () => {
    const l2 = mean(inLeague("L2").map((c) => c.strength));
    expect(Math.min(...inLeague("L1").map((c) => c.strength))).toBeGreaterThan(l2);
    expect(Math.max(...inLeague("L3").map((c) => c.strength))).toBeLessThan(l2);
  });

  it("Traditionsvereine haben in unteren Ligen einen hohen Ruf", () => {
    expect(club("Fortuna Düsseldorf").reputation).toBeGreaterThan(median(inLeague("L2").map((c) => c.reputation)));
    expect(club("Hertha BSC").reputation).toBeGreaterThan(median(inLeague("L1").map((c) => c.reputation)));
  });

  it("Bayern hat den höchsten Ruf und die höchste Kaderstärke", () => {
    const bayern = club("FC Bayern München");
    for (const c of CLUBS) {
      if (c === bayern) continue;
      expect(bayern.reputation).toBeGreaterThan(c.reputation);
      expect(bayern.strength).toBeGreaterThan(c.strength);
    }
  });
});
