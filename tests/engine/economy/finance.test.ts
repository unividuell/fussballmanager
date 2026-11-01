import { describe, expect, it } from "vitest";
import {
  PRIZE_POOL,
  TV_PER_MATCHDAY,
  chooseSponsor,
  processFinances,
  seasonEndFinances,
  sponsorOffers,
  startSeasonFinances,
} from "../../../src/engine/economy/finance";
import { wageBill } from "../../../src/engine/economy/money";
import { STADIUM, attendance, startBuilding, validateTicketPrice } from "../../../src/engine/economy/stadium";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { kickOff, startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(12);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  if (!r.ok) throw new Error(r.error);
  // Sponsorangebote erzeugt startSeason erst ab Task 8; ein zweiter Aufruf danach schadet nicht.
  startSeasonFinances(r.state, Rng.fromSeed(99));
  return r.state;
}

describe("Zuschauer", () => {
  it("nie mehr als die Kapazität; teurer = weniger Zuschauer; 2. Liga weniger als 1. Liga", () => {
    const s = game();
    const [l1a, l1b] = s.competitions[COMP.first].clubs;
    const club = s.clubs[l1a];
    club.finance.stadiumStage = 4;
    club.finance.ticketPrice = 20;
    const cheap = attendance(s, l1a, l1b);
    club.finance.ticketPrice = 60;
    const expensive = attendance(s, l1a, l1b);
    expect(expensive).toBeLessThan(cheap);
    club.finance.stadiumStage = 0;
    club.finance.ticketPrice = 5;
    expect(attendance(s, l1a, l1b)).toBe(STADIUM[0].capacity);
    const l2 = s.competitions[COMP.second].clubs[0];
    s.clubs[l2].reputation = club.reputation;
    Object.assign(s.clubs[l2].finance, { stadiumStage: 4, ticketPrice: 20 });
    club.finance.stadiumStage = 4;
    club.finance.ticketPrice = 20;
    expect(attendance(s, l2, l1b)).toBeLessThan(attendance(s, l1a, l1b));
  });
});

describe("Eintrittspreis und Ausbau", () => {
  it("prüft den Eintrittspreis", () => {
    expect(validateTicketPrice(25)).toBeNull();
    expect(validateTicketPrice(4)).toBe("Der Eintrittspreis muss zwischen 5 und 100 € liegen.");
    expect(validateTicketPrice(101)).not.toBeNull();
    expect(validateTicketPrice(20.5)).not.toBeNull();
  });

  it("startet einen Ausbau, bucht die Kosten und lehnt Doppelbau, Höchststufe und fehlendes Geld ab", () => {
    const s = game();
    const id = s.competitions[COMP.first].clubs[5];
    const f = s.clubs[id].finance;
    f.stadiumStage = 1;
    f.balance = 10_000_000;
    expect(startBuilding(s, id)).toBeNull();
    expect(f.balance).toBe(10_000_000 - STADIUM[2].cost);
    expect(f.building).toEqual({ stage: 2, matchdaysLeft: STADIUM[2].buildMatchdays });
    expect(startBuilding(s, id)).toBe("Es wird schon gebaut.");
    f.building = null;
    f.stadiumStage = 4;
    expect(startBuilding(s, id)).toBe("Das Stadion hat schon die höchste Ausbaustufe.");
    f.stadiumStage = 3;
    f.balance = -1_000_000;
    expect(startBuilding(s, id)).toBe("Dafür reicht das Geld nicht.");
  });
});

describe("Sponsor", () => {
  it("drei Angebote, in der 2. Liga im Schnitt niedriger", () => {
    const s = game();
    const rng = Rng.fromSeed(1);
    const l1 = s.competitions[COMP.first].clubs[0];
    const l2 = s.competitions[COMP.second].clubs[0];
    s.clubs[l2].reputation = s.clubs[l1].reputation;
    const a = sponsorOffers(s, l1, rng);
    const b = sponsorOffers(s, l2, rng);
    expect(a).toHaveLength(3);
    const avg = (xs: typeof a) => xs.reduce((x, o) => x + o.perMatchday, 0) / xs.length;
    expect(avg(b)).toBeLessThan(avg(a));
    expect(a.every((o) => o.bonus > 0 && o.perMatchday % 1_000 === 0)).toBe(true);
  });

  it("chooseSponsor wählt ein Angebot genau einmal", () => {
    const s = game();
    const id = Object.keys(s.clubs)[0];
    const offer = s.clubs[id].finance.sponsorOffers[1];
    expect(chooseSponsor(s, id, "gibts-nicht")).toBe("Dieses Angebot gibt es nicht.");
    expect(chooseSponsor(s, id, offer.id)).toBeNull();
    expect(s.clubs[id].finance.sponsor).toEqual(offer);
    expect(chooseSponsor(s, id, offer.id)).toBe("Der Sponsorvertrag für diese Saison steht schon.");
  });
});

describe("processFinances", () => {
  it("bucht Zuschauer, TV, Sponsor, Gehälter und Unterhalt an einem Liga-Spieltag", () => {
    const s = game();
    const lives = kickOff(s);
    const live = lives[0];
    const home = s.clubs[live.home.club];
    const away = s.clubs[live.away.club];
    const before = { home: home.finance.balance, away: away.finance.balance };
    const wagesAway = wageBill(s, away.id);
    processFinances(s, lives);
    const sum = (club: typeof home, cat: string) => club.finance.ledger.filter((e) => e.category === cat).reduce((x, e) => x + e.amount, 0);
    expect(sum(home, "tickets")).toBe(home.finance.lastAttendance * home.finance.ticketPrice);
    expect(sum(away, "tickets")).toBe(0);
    expect(sum(away, "tv")).toBe(TV_PER_MATCHDAY[COMP.first]);
    expect(sum(away, "salaries")).toBe(-wagesAway);
    expect(sum(away, "upkeep")).toBe(-STADIUM[away.finance.stadiumStage].upkeep);
    expect(away.finance.sponsor).not.toBeNull();
    expect(sum(away, "sponsor")).toBe(away.finance.sponsor!.perMatchday);
    const total = (club: typeof home) => club.finance.ledger.reduce((x, e) => x + e.amount, 0);
    expect(home.finance.balance - before.home).toBe(total(home));
    expect(away.finance.balance - before.away).toBe(total(away));
  });

  it("die KI nimmt den besten Sponsor, der Manager bekommt das erste Angebot mit Nachricht", () => {
    const s = game();
    const human = s.clubs[s.managers[0].clubId!];
    const ai = Object.values(s.clubs).find((c) => c.managerId === null)!;
    const best = Math.max(...ai.finance.sponsorOffers.map((o) => o.perMatchday));
    processFinances(s, []);
    expect(ai.finance.sponsor!.perMatchday).toBe(best);
    expect(human.finance.sponsor).toEqual(human.finance.sponsorOffers[0]);
    expect(s.messages.some((m) => m.text.includes("automatisch"))).toBe(true);
  });

  it("Zinsen bei negativem Konto, Dispo-Zähler und Nachricht", () => {
    const s = game();
    const human = s.clubs[s.managers[0].clubId!];
    human.finance.balance = -100_000_000;
    processFinances(s, []);
    expect(human.finance.ledger.some((e) => e.category === "interest" && e.amount < 0)).toBe(true);
    expect(human.finance.overdraftStreak).toBe(1);
    expect(s.messages.some((m) => m.text.includes("Dispo-Limit"))).toBe(true);
    processFinances(s, []);
    expect(human.finance.overdraftStreak).toBe(2);
  });

  it("Stadionausbau wird fertig und meldet sich", () => {
    const s = game();
    const human = s.clubs[s.managers[0].clubId!];
    human.finance.stadiumStage = 1;
    human.finance.building = { stage: 2, matchdaysLeft: 1 };
    processFinances(s, []);
    expect(human.finance.stadiumStage).toBe(2);
    expect(human.finance.building).toBeNull();
    expect(s.messages.some((m) => m.text.includes("Stadionausbau"))).toBe(true);
  });

  it("an Relegationstagen nur Zuschauereinnahmen", () => {
    const s = game();
    const lives = kickOff(s).slice(0, 1);
    s.calendarIndex = 34;
    processFinances(s, lives);
    const cats = new Set(Object.values(s.clubs).flatMap((c) => c.finance.ledger.map((e) => e.category)));
    expect([...cats]).toEqual(["tickets"]);
  });
});

describe("Saisonwechsel", () => {
  it("Prämien nach Platz und Sponsorprämie bei erreichtem Ziel", () => {
    const s = game();
    const l1 = [...s.competitions[COMP.first].clubs];
    const l2 = [...s.competitions[COMP.second].clubs];
    for (const id of [...l1, ...l2]) s.clubs[id].finance.sponsor = { id: "x", name: "X", perMatchday: 1, bonus: 500_000 };
    const before = s.clubs[l1[0]].finance.balance;
    seasonEndFinances(s, { [COMP.first]: l1, [COMP.second]: l2 }, (id) => id === l1[0]);
    expect(s.clubs[l1[0]].finance.balance - before).toBe(PRIZE_POOL[COMP.first] + 500_000);
    const last = s.clubs[l1[17]].finance.ledger.find((e) => e.category === "prizes")!.amount;
    expect(last).toBe(Math.round(PRIZE_POOL[COMP.first] / 18 / 10_000) * 10_000);
    expect(s.clubs[l1[1]].finance.ledger.some((e) => e.category === "bonus")).toBe(false);
  });

  it("Saisonstart: Kassenbuch leer, neue Angebote, KI mit optimalem Preis", () => {
    const s = game();
    const any = Object.values(s.clubs);
    for (const c of any) {
      c.finance.ledger.push({ calendarIndex: 3, category: "tv", amount: 1 });
      c.finance.sponsor = c.finance.sponsorOffers[0];
      c.finance.ticketPrice = 99;
    }
    startSeasonFinances(s, Rng.fromSeed(2));
    for (const c of any) {
      expect(c.finance.ledger).toEqual([]);
      expect(c.finance.sponsor).toBeNull();
      expect(c.finance.sponsorOffers).toHaveLength(3);
      if (c.managerId === null) expect(c.finance.ticketPrice).not.toBe(99);
      else expect(c.finance.ticketPrice).toBe(99);
    }
  });
});
