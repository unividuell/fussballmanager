import { describe, expect, it } from "vitest";
import { canAfford, book, isOverLimit, marketValue, overdraftLimit, salaryFor, startBalance, wageBill } from "../../../src/engine/economy/money";
import { STADIUM, initialStage, optimalPrice, priceFactor, referencePrice } from "../../../src/engine/economy/stadium";
import { clubLeague, formatEuro, isLeagueMatchday, leagueRank, roundTo } from "../../../src/engine/economy/util";
import { generateWorld } from "../../../src/engine/generator";
import { COMP } from "../../../src/engine/model";
import { startNewGame } from "../../../src/engine/season";
import { makePlayer, makeState } from "../fixtures";

describe("util", () => {
  it("rundet und formatiert Euro", () => {
    expect(roundTo(12_345, 100)).toBe(12_300);
    expect(formatEuro(1_250_000)).toBe("1.250.000 €");
    expect(formatEuro(-5_000)).toBe("-5.000 €");
    expect(formatEuro(0)).toBe("0 €");
    expect(formatEuro(999)).toBe("999 €");
  });

  it("erkennt Liga-Spieltage", () => {
    expect(isLeagueMatchday(0)).toBe(true);
    expect(isLeagueMatchday(33)).toBe(true);
    expect(isLeagueMatchday(34)).toBe(false);
  });

  it("findet Liga und Tabellenplatz", () => {
    const world = generateWorld(3);
    const r = startNewGame(world, [{ name: "A", clubId: Object.keys(world.clubs)[0] }]);
    if (!r.ok) throw new Error(r.error);
    const l2Club = r.state.competitions[COMP.second].clubs[0];
    expect(clubLeague(r.state, l2Club)).toBe(COMP.second);
    const rank = leagueRank(r.state, l2Club)!;
    expect(rank).toBeGreaterThanOrEqual(1);
    expect(rank).toBeLessThanOrEqual(18);
    expect(clubLeague(r.state, "gibts-nicht")).toBeNull();
  });
});

describe("money", () => {
  it("Gehalt wächst exponentiell mit der Stärke", () => {
    expect(salaryFor(40)).toBe(2_000);
    expect(salaryFor(50)).toBe(4_100);
    expect(salaryFor(70)).toBe(17_500);
    expect(salaryFor(80)).toBeGreaterThan(salaryFor(70));
  });

  it("Startkapital und Dispo hängen an der Reputation", () => {
    expect(startBalance(50)).toBe(2_500_000);
    expect(overdraftLimit(50)).toBe(1_500_000);
  });

  it("Marktwert: stärker = teurer, alt = billiger, Vertragsende senkt den Wert", () => {
    const base = makePlayer("a", "MF", 70, { age: 25, potential: 70, contract: { salary: 1, endsSeason: 4 } });
    const mv = marketValue(base, 1);
    expect(mv % 10_000).toBe(0);
    expect(marketValue({ ...base, strength: 80, potential: 80 }, 1)).toBeGreaterThan(mv);
    expect(marketValue({ ...base, age: 33 }, 1)).toBeLessThan(mv);
    expect(marketValue({ ...base, contract: { salary: 1, endsSeason: 1 } }, 1)).toBeLessThan(mv);
    expect(marketValue({ ...base, contract: null }, 1)).toBeLessThan(mv);
    expect(marketValue({ ...base, potential: 90 }, 1)).toBeGreaterThan(mv);
    expect(marketValue(makePlayer("w", "DF", 1), 1)).toBe(10_000);
  });

  it("bucht ins Kassenbuch, prüft Dispo und Gehaltssumme", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const club = s.clubs.c1;
    club.finance.balance = 100_000;
    s.calendarIndex = 5;
    book(s, "c1", "tickets", 50_000);
    expect(club.finance.balance).toBe(150_000);
    expect(club.finance.ledger.at(-1)).toEqual({ calendarIndex: 5, category: "tickets", amount: 50_000 });
    const limit = overdraftLimit(club.reputation);
    expect(canAfford(club, 150_000 + limit)).toBe(true);
    expect(canAfford(club, 150_000 + limit + 1)).toBe(false);
    club.finance.balance = -limit - 1;
    expect(isOverLimit(club)).toBe(true);
    expect(wageBill(s, "c1")).toBe(25 * 5_000);
  });
});

describe("stadium", () => {
  it("hat 5 Stufen mit wachsender Kapazität", () => {
    expect(STADIUM).toHaveLength(5);
    for (let i = 1; i < STADIUM.length; i++) expect(STADIUM[i].capacity).toBeGreaterThan(STADIUM[i - 1].capacity);
  });

  it("Startstufe und optimaler Preis nach Reputation", () => {
    expect(initialStage(90)).toBe(4);
    expect(initialStage(50)).toBe(2);
    expect(initialStage(10)).toBe(0);
    expect(referencePrice(30)).toBeCloseTo(14.5);
    expect(optimalPrice(30)).toBe(22);
    expect(optimalPrice(90)).toBe(35);
  });

  it("Preisfaktor sinkt mit dem Preis und bleibt zwischen 0 und 1,5", () => {
    expect(priceFactor(0, 50)).toBe(1.5);
    expect(priceFactor(20, 50)).toBeGreaterThan(priceFactor(40, 50));
    expect(priceFactor(1_000, 50)).toBe(0);
  });
});
