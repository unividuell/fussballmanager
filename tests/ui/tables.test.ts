import { describe, expect, it } from "vitest";
import { COMP } from "../../src/engine/model";
import { playMatchdayAuto } from "../../src/engine/season";
import {
  clubPlace,
  clubRating,
  fixturesView,
  lastPlayedRound,
  managerName,
  tableView,
  zoneFor,
} from "../../src/ui/logic/tables";
import { newTestGame } from "./game";

describe("zoneFor", () => {
  it("markiert Meister, Relegation und Abstieg in der 1. Liga", () => {
    expect(zoneFor(COMP.first, 1)).toBe("champion");
    expect(zoneFor(COMP.first, 2)).toBeNull();
    expect(zoneFor(COMP.first, 16)).toBe("playoff");
    expect(zoneFor(COMP.first, 17)).toBe("relegation");
    expect(zoneFor(COMP.first, 18)).toBe("relegation");
  });
  it("markiert Aufstieg und Relegation in der 2. Liga", () => {
    expect(zoneFor(COMP.second, 1)).toBe("promotion");
    expect(zoneFor(COMP.second, 2)).toBe("promotion");
    expect(zoneFor(COMP.second, 3)).toBe("playoff");
    expect(zoneFor(COMP.second, 18)).toBeNull();
  });
});

describe("tableView und fixturesView", () => {
  const start = newTestGame(["Anna", "Ben"]);
  const s = playMatchdayAuto(start);

  it("liefert 18 Zeilen mit Rang, Name und Manager", () => {
    const rows = tableView(s, COMP.first);
    expect(rows).toHaveLength(18);
    expect(rows.map((r) => r.rank)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(rows.every((r) => r.played === 1 && r.name.length > 0)).toBe(true);
    const annaClub = s.managers[0].clubId!;
    expect(rows.find((r) => r.club === annaClub)?.manager).toBe("Anna");
    expect(rows[0].zone).toBe("champion");
  });

  it("zeigt Paarungen mit Ergebnis, ungespielte ohne", () => {
    const played = fixturesView(s, COMP.first, 1);
    expect(played).toHaveLength(9);
    expect(played.every((f) => /^\d+:\d+$/.test(f.result ?? ""))).toBe(true);
    expect(fixturesView(s, COMP.first, 2).every((f) => f.result === null)).toBe(true);
    expect(fixturesView(s, "gibts-nicht", 1)).toEqual([]);
  });

  it("zeigt ein Elfmeterschießen im Ergebnis", () => {
    const t = structuredClone(s);
    const m = t.competitions[COMP.first].matches[0];
    m.result = { home: 1, away: 1 };
    m.penalties = { home: 5, away: 4 };
    expect(fixturesView(t, COMP.first, m.round).find((f) => f.id === m.id)?.result).toBe("1:1 (i.E. 5:4)");
  });

  it("kennt den zuletzt gespielten Spieltag", () => {
    expect(lastPlayedRound(start, COMP.first)).toBe(1);
    expect(lastPlayedRound(s, COMP.first)).toBe(1);
    expect(lastPlayedRound(playMatchdayAuto(s), COMP.first)).toBe(2);
  });

  it("bewertet Vereine, findet Platz und Manager", () => {
    const clubId = s.managers[1].clubId!;
    const rating = clubRating(s, clubId);
    expect(rating).toBeGreaterThan(20);
    expect(rating).toBeLessThan(99);
    expect(Number.isInteger(rating)).toBe(true);
    const place = clubPlace(s, clubId)!;
    expect([COMP.first, COMP.second]).toContain(place.competitionId);
    expect(place.rank).toBeGreaterThanOrEqual(1);
    expect(managerName(s, clubId)).toBe("Ben");
    const aiClub = Object.values(s.clubs).find((c) => c.managerId === null)!;
    expect(managerName(s, aiClub.id)).toBeNull();
  });
});
