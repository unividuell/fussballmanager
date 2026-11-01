import { describe, expect, it } from "vitest";
import { startMatch } from "../../../src/engine/match/simulate";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { currentFixtures, finishSeason, playMatchdayAuto, startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(61);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[8] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("Saisonstart", () => {
  it("setzt Erwartungen und legt Sponsorangebote vor", () => {
    const s = game();
    const exps = new Set(Object.values(s.clubs).map((c) => c.board.expectation));
    expect(exps.size).toBe(4);
    expect(Object.values(s.clubs).every((c) => c.finance.sponsorOffers.length === 3)).toBe(true);
    expect(s.messages.some((m) => m.ref?.type === "sponsor")).toBe(true);
  });
});

describe("ein Spieltag mit Wirtschaft", () => {
  it("bucht Geld, trainiert, bewegt das Vertrauen und ändert den Eingabezustand nicht", () => {
    const s = game();
    const young = Object.values(s.players).find((p) => p.clubId && p.age <= 21 && p.potential - p.strength > 5)!;
    const before = JSON.stringify(s);
    const after = playMatchdayAuto(s);
    expect(JSON.stringify(s)).toBe(before);
    for (const c of Object.values(after.clubs)) {
      const cats = new Set(c.finance.ledger.map((e) => e.category));
      expect(cats.has("tv")).toBe(true);
      expect(cats.has("salaries")).toBe(true);
      expect(c.finance.sponsor).not.toBeNull();
    }
    expect(after.players[young.id].strength).toBeGreaterThan(young.strength);
    const moved = Object.values(after.clubs).filter((c) => c.board.confidence !== 60);
    expect(moved.length).toBeGreaterThan(10);
  });

  it("Taktiktraining wirkt im nächsten Spiel", () => {
    const s = game();
    const club = s.clubs[s.managers[0].clubId!];
    club.training = { intensity: "normal", focus: "tactics", individual: [] };
    const after = playMatchdayAuto(s);
    const m = currentFixtures(after).find((x) => x.home === club.id || x.away === club.id)!;
    const live = startMatch(after, m);
    const side = live.home.club === club.id ? live.home : live.away;
    expect(side.bonus).toBe(1.03);
  });

  it("zu Beginn des Winterfensters bietet die KI für gelistete Spieler", () => {
    let s = game();
    for (let i = 0; i < 16; i++) s = playMatchdayAuto(s);
    const club = s.clubs[s.managers[0].clubId!];
    for (const id of club.squad.slice(15)) s.players[id].transferListed = { askingPrice: null };
    s = playMatchdayAuto(s);
    expect(s.calendarIndex).toBe(17);
    expect(s.transferOffers.length).toBeGreaterThan(0);
  });
});

describe("Saisonwechsel mit Wirtschaft", () => {
  it("altert, holt Nachwuchs, beendet Verträge, startet neu mit Sponsoren und leeren Verhandlungen", { timeout: 120_000 }, () => {
    let s = game();
    for (let i = 0; i < 36; i++) s = playMatchdayAuto(s);
    const someone = Object.values(s.players).find((p) => p.clubId && p.age < 30)!;
    const expiring = Object.values(s.players).filter((p) => p.clubId && p.contract && p.contract.endsSeason <= s.season).length;
    const playersBefore = Object.keys(s.players).length;
    const { state: next } = finishSeason(s);
    expect(next.players[someone.id].age).toBe(someone.age + 1);
    expect(Object.keys(next.players).length).toBeGreaterThan(playersBefore);
    expect(expiring).toBeGreaterThan(0);
    expect(Object.values(next.players).every((p) => !p.clubId || !p.contract || p.contract.endsSeason >= next.season)).toBe(true);
    for (const c of Object.values(next.clubs)) {
      expect(c.finance.sponsorOffers).toHaveLength(3);
      expect(c.finance.sponsor).toBeNull();
      expect(c.squad.length).toBeGreaterThanOrEqual(c.managerId ? 1 : 18);
    }
    expect(next.negotiations.filter((n) => n.status === "open")).toEqual([]);
    expect(next.competitions[COMP.first].clubs).toHaveLength(18);
  });
});
