import { describe, expect, it } from "vitest";
import {
  START_CONFIDENCE,
  assignExpectations,
  boardChecks,
  expectationLabel,
  expectationMet,
  seasonReview,
  updateConfidence,
} from "../../../src/engine/economy/board";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { kickOff, startNewGame } from "../../../src/engine/season";

function game(index = 3): GameState {
  const world = generateWorld(51);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[index] }]);
  if (!r.ok) throw new Error(r.error);
  assignExpectations(r.state);
  return r.state;
}
const anna = (s: GameState) => s.managers[0];
const own = (s: GameState) => s.clubs[anna(s).clubId];

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

describe("boardChecks – keine Entlassung", () => {
  it("warnt einmal unter 30, erst nach Erholung über 40 erneut; der Manager bleibt", () => {
    const s = game();
    const club = own(s);
    const count = () => s.messages.filter((m) => m.managerId === anna(s).id && m.text === "Der Vorstand ist unzufrieden.").length;
    s.calendarIndex = 20;
    club.board.confidence = 0;
    for (let i = 0; i < 10; i++) boardChecks(s);
    expect(count()).toBe(1);
    expect(anna(s).clubId).toBe(club.id);
    expect(club.managerId).toBe(anna(s).id);
    club.board.confidence = 35;
    boardChecks(s);
    club.board.confidence = 10;
    boardChecks(s);
    expect(count()).toBe(1);
    club.board.confidence = 41;
    boardChecks(s);
    club.board.confidence = 10;
    boardChecks(s);
    expect(count()).toBe(2);
  });
});

describe("seasonReview – nur Rückmeldung", () => {
  function tables(s: GameState, ownRank: number) {
    const l1 = s.competitions[COMP.first].clubs.filter((id) => id !== own(s).id);
    const l2 = [...s.competitions[COMP.second].clubs];
    const ownLeague = s.competitions[COMP.first].clubs.includes(own(s).id) ? l1 : l2.filter((id) => id !== own(s).id);
    ownLeague.splice(ownRank - 1, 0, own(s).id);
    return { [COMP.first]: s.competitions[COMP.first].clubs.includes(own(s).id) ? ownLeague : l1, [COMP.second]: s.competitions[COMP.first].clubs.includes(own(s).id) ? l2 : ownLeague };
  }

  function review(rank: number, confidence: number, text: string) {
    const s = game();
    own(s).board.expectation = "mid";
    own(s).board.confidence = 50;
    const before = anna(s).clubId;
    seasonReview(s, tables(s, rank));
    expect(own(s).board.confidence).toBe(confidence);
    expect(s.messages.some((m) => m.managerId === anna(s).id && m.text === text)).toBe(true);
    expect(anna(s).clubId).toBe(before);
    expect(own(s).managerId).toBe(anna(s).id);
    expect("jobOffers" in s.managers[0]).toBe(false);
    expect("unemployedFor" in s.managers[0]).toBe(false);
    expect(s.messages.some((m) => m.text.startsWith("Jobangebote"))).toBe(false);
  }

  it("Ziel erreicht: +15 und Lob", () => review(12, 65, "Der Vorstand ist zufrieden: Saisonziel erreicht."));
  it("Ziel verfehlt: −10 und Enttäuschung", () => review(15, 40, "Der Vorstand ist enttäuscht: Saisonziel verfehlt."));
  it("Ziel deutlich verfehlt: −15, Nachricht, Manager bleibt beim Verein", () =>
    review(18, 35, "Der Vorstand ist sehr enttäuscht: Saisonziel deutlich verfehlt."));
});
