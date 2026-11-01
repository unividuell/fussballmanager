import { describe, expect, it } from "vitest";
import {
  START_CONFIDENCE,
  acceptJobOffer,
  assignExpectations,
  boardChecks,
  clearStaleJobOffers,
  expectationLabel,
  expectationMet,
  fireManager,
  jobOffersFor,
  seasonReview,
  unemployedTick,
  updateConfidence,
} from "../../../src/engine/economy/board";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { kickOff, startNewGame } from "../../../src/engine/season";

function game(index = 3): GameState {
  const world = generateWorld(51);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[index] }]);
  if (!r.ok) throw new Error(r.error);
  assignExpectations(r.state);
  return r.state;
}
const anna = (s: GameState) => s.managers[0];
const own = (s: GameState) => s.clubs[anna(s).clubId!];

describe("Erwartungen", () => {
  it("verteilt 2/4/6/6 je Liga nach Reputation", () => {
    const s = game();
    for (const league of [COMP.first, COMP.second]) {
      const counts = { title: 0, upper: 0, mid: 0, survival: 0 };
      for (const id of s.competitions[league].clubs) counts[s.clubs[id].board.expectation]++;
      expect(counts).toEqual({ title: 2, upper: 4, mid: 6, survival: 6 });
    }
    const best = [...s.competitions[COMP.first].clubs].sort((a, b) => s.clubs[b].reputation - s.clubs[a].reputation)[0];
    expect(s.clubs[best].board.expectation).toBe("title");
  });

  it("Beschriftungen und Zielerreichung", () => {
    expect(expectationLabel("title", COMP.first)).toBe("Meisterschaft");
    expect(expectationLabel("title", COMP.second)).toBe("Aufstieg");
    expect(expectationLabel("survival", COMP.first)).toBe("Klassenerhalt");
    const s = game();
    own(s).board.expectation = "upper";
    expect(expectationMet(s, own(s).id, 6)).toBe(true);
    expect(expectationMet(s, own(s).id, 7)).toBe(false);
  });
});

describe("Vertrauen", () => {
  it("Sieg hebt, Niederlage senkt; Dispo kostet zusätzlich", () => {
    const s = game();
    const lives = kickOff(s);
    const l = lives[0];
    l.home.goals = 2;
    l.away.goals = 0;
    const [home, away] = [s.clubs[l.home.club], s.clubs[l.away.club]];
    updateConfidence(s, [l]);
    expect(home.board.confidence).toBeCloseTo(START_CONFIDENCE + 0.8);
    expect(away.board.confidence).toBeCloseTo(START_CONFIDENCE - 0.8);
    away.finance.overdraftStreak = 3;
    updateConfidence(s, []);
    expect(away.board.confidence).toBeCloseTo(START_CONFIDENCE - 5.8);
  });

  it("ab Kalenderindex 3 zählt der Tabellenplatz; Werte bleiben zwischen 0 und 100", () => {
    const s = game();
    s.calendarIndex = 3;
    const c = own(s);
    c.board.confidence = 0.5;
    c.board.expectation = "title";
    updateConfidence(s, []);
    expect(c.board.confidence).toBeGreaterThanOrEqual(0);
    c.board.confidence = 99.9;
    c.board.expectation = "survival";
    updateConfidence(s, []);
    expect(c.board.confidence).toBeLessThanOrEqual(100);
  });
});

describe("Warnung und Entlassung", () => {
  it("warnt einmal unter 30 und entlässt unter 15 erst ab Spieltag 8", () => {
    const s = game();
    const c = own(s);
    c.board.confidence = 25;
    boardChecks(s, Rng.fromSeed(1));
    boardChecks(s, Rng.fromSeed(1));
    expect(s.messages.filter((m) => m.text.includes("unzufrieden"))).toHaveLength(1);
    c.board.confidence = 10;
    s.calendarIndex = 7;
    boardChecks(s, Rng.fromSeed(1));
    expect(anna(s).clubId).toBe(c.id);
    s.calendarIndex = 8;
    boardChecks(s, Rng.fromSeed(1));
    expect(anna(s).clubId).toBeNull();
    expect(c.managerId).toBeNull();
  });

  it("KI-Vereine holen einen neuen Trainer", () => {
    const s = game();
    const ai = Object.values(s.clubs).find((c) => c.managerId === null)!;
    ai.board.confidence = 5;
    boardChecks(s, Rng.fromSeed(1));
    expect(ai.board.confidence).toBe(55);
  });

  it("Entlassung: Angebote kleinerer Vereine, Verhandlungen weg, Nachricht", () => {
    const s = game(0);
    const old = own(s);
    s.negotiations.push({ id: "n1", managerId: anna(s).id, playerId: old.squad[0], stage: "salary", fee: null, ask: 1, round: 1, desiredYears: 2, status: "open", note: "", season: 1, createdAt: 0 });
    fireManager(s, anna(s).id, Rng.fromSeed(3));
    const offers = anna(s).jobOffers;
    expect(offers.length).toBeGreaterThanOrEqual(1);
    expect(offers.length).toBeLessThanOrEqual(3);
    for (const id of offers) {
      expect(s.clubs[id].managerId).toBeNull();
      expect(s.clubs[id].reputation).toBeLessThanOrEqual(old.reputation + 5);
      expect(id).not.toBe(old.id);
    }
    expect(s.negotiations[0].status).toBe("aborted");
    expect(old.training).toEqual({ intensity: "normal", focus: "technique", individual: [] });
    expect(s.messages.some((m) => m.text.includes("trennt sich"))).toBe(true);
  });
});

describe("Jobangebote", () => {
  it("annehmen wechselt den Verein; ungültige Angebote werden abgelehnt", () => {
    const s = game();
    fireManager(s, anna(s).id, Rng.fromSeed(4));
    const target = anna(s).jobOffers[0];
    expect(acceptJobOffer(s, anna(s).id, "gibts-nicht")).toBe("Dieses Angebot gibt es nicht.");
    expect(acceptJobOffer(s, anna(s).id, target)).toBeNull();
    expect(anna(s).clubId).toBe(target);
    expect(s.clubs[target].managerId).toBe(anna(s).id);
    expect(s.clubs[target].board.confidence).toBe(START_CONFIDENCE);
    expect(anna(s).jobOffers).toEqual([]);
  });

  it("übernommener Verein: offene KI-Geschäfte des Vereins werden aufgelöst", () => {
    const s = game();
    fireManager(s, anna(s).id, Rng.fromSeed(4));
    const target = anna(s).jobOffers[0];
    const club = s.clubs[target];
    const pid = club.squad[0];
    s.negotiations.push({ id: "n1", managerId: anna(s).id, playerId: pid, stage: "fee", fee: null, ask: 1, round: 1, desiredYears: 2, status: "open", note: "", season: s.season, createdAt: 0 });
    s.transferOffers.push({ id: "o1", managerId: anna(s).id, fromClub: target, playerId: club.squad[1], fee: 1, maxFee: 2, round: 1, status: "open", season: s.season, expiresAfter: 0 });
    acceptJobOffer(s, anna(s).id, target);
    expect(s.negotiations.find((n) => n.id === "n1")!.status).toBe("aborted");
    expect(s.negotiations.find((n) => n.id === "n1")!.note).toBe("Der Verein hat einen neuen Trainer.");
    expect(s.transferOffers.find((o) => o.id === "o1")!.status).toBe("withdrawn");
  });

  it("ohne Verein: spätestens nach 3 Spieltagen ein Angebot eines Zweitligisten", () => {
    const s = game();
    fireManager(s, anna(s).id, Rng.fromSeed(5));
    anna(s).jobOffers = [];
    const rng = Rng.fromSeed(6);
    for (let i = 0; i < 3 && anna(s).jobOffers.length === 0; i++) unemployedTick(s, rng);
    expect(anna(s).jobOffers.length).toBeGreaterThan(0);
    anna(s).jobOffers = [];
    anna(s).unemployedFor = 3;
    unemployedTick(s, Rng.fromSeed(7));
    expect(anna(s).jobOffers).toHaveLength(1);
    expect(s.competitions[COMP.second].clubs).toContain(anna(s).jobOffers[0]);
  });

  it("jobOffersFor 'higher' liefert nur größere Vereine; alte Angebote verfallen nach dem 1. Spieltag", () => {
    const s = game(30);
    const rep = own(s).reputation;
    const offers = jobOffersFor(s, rep, Rng.fromSeed(8), "higher", 2);
    for (const id of offers) {
      expect(s.clubs[id].reputation).toBeGreaterThan(rep + 5);
      expect(s.clubs[id].reputation).toBeLessThanOrEqual(rep + 25);
    }
    anna(s).jobOffers = offers;
    clearStaleJobOffers(s);
    expect(anna(s).jobOffers).toEqual([]);
  });
});

describe("seasonReview", () => {
  function tables(s: GameState, ownRank: number) {
    const l1 = s.competitions[COMP.first].clubs.filter((id) => id !== own(s).id);
    const l2 = [...s.competitions[COMP.second].clubs];
    const ownLeague = s.competitions[COMP.first].clubs.includes(own(s).id) ? l1 : l2.filter((id) => id !== own(s).id);
    ownLeague.splice(ownRank - 1, 0, own(s).id);
    return { [COMP.first]: s.competitions[COMP.first].clubs.includes(own(s).id) ? ownLeague : l1, [COMP.second]: s.competitions[COMP.first].clubs.includes(own(s).id) ? l2 : ownLeague };
  }

  it("Ziel erreicht: +15 Vertrauen", () => {
    const s = game();
    own(s).board.expectation = "mid";
    own(s).board.confidence = 50;
    seasonReview(s, tables(s, 5), Rng.fromSeed(9));
    expect(own(s).board.confidence).toBe(65);
  });

  it("knapp verfehlt: −10; deutlich verfehlt: Entlassung", () => {
    const s = game();
    own(s).board.expectation = "upper";
    own(s).board.confidence = 50;
    seasonReview(s, tables(s, 9), Rng.fromSeed(9));
    expect(own(s).board.confidence).toBe(40);
    seasonReview(s, tables(s, 12), Rng.fromSeed(9));
    expect(anna(s).clubId).toBeNull();
  });
});
