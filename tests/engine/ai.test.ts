import { describe, expect, it } from "vitest";
import { aiChooseFormation, aiHalftime, aiPrepare } from "../../src/engine/ai";
import { autoLineup, validateLineup } from "../../src/engine/lineup";
import { startMatch } from "../../src/engine/match/simulate";
import type { Match } from "../../src/engine/model";
import { makeState } from "./fixtures";

describe("aiChooseFormation", () => {
  it("wählt bei vielen starken Stürmern eine Formation mit mehr Stürmern", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    for (let i = 1; i <= 6; i++) s.players[`c1-FW${i}`].strength = 85;
    expect(["4-3-3", "4-2-4"]).toContain(aiChooseFormation(s, "c1"));
  });

  it("wählt bei starken Abwehrspielern eine Formation mit mehr Verteidigern", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    for (let i = 1; i <= 8; i++) s.players[`c1-DF${i}`].strength = 85;
    expect(aiChooseFormation(s, "c1")).toBe("5-3-2");
  });
});

describe("aiPrepare", () => {
  it("setzt eine gültige Aufstellung und wählt die Spielweise nach Stärkeverhältnis", () => {
    const s = makeState([{ id: "strong", strength: 80 }, { id: "weak", strength: 55 }]);
    aiPrepare(s, "strong", "weak", true);
    aiPrepare(s, "weak", "strong", false);
    expect(validateLineup(s, "strong", s.clubs.strong.lineup)).toBeNull();
    expect(s.clubs.strong.tactics.style).toBe("offensive");
    expect(s.clubs.weak.tactics.style).toBe("defensive");
  });

  it("gleich starke Gegner: normal", () => {
    const s = makeState([{ id: "a", strength: 70 }, { id: "b", strength: 70 }]);
    aiPrepare(s, "a", "b", false);
    expect(s.clubs.a.tactics.style).toBe("normal");
  });
});

describe("aiHalftime", () => {
  function live() {
    const s = makeState([{ id: "h", strength: 70 }, { id: "a", strength: 70 }]);
    for (const id of ["h", "a"]) s.clubs[id].lineup = autoLineup(s, id, "4-4-2");
    const m: Match = { id: "m", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
    return { s, l: startMatch(s, m) };
  }

  it("im Rückstand wird offensiv gespielt", () => {
    const { s, l } = live();
    l.away.goals = 1;
    aiHalftime(s, l, "home");
    expect(l.home.tactics.style).toBe("offensive");
  });

  it("bei 2 Toren Führung wird defensiv gespielt", () => {
    const { s, l } = live();
    l.home.goals = 2;
    aiHalftime(s, l, "home");
    expect(l.home.tactics.style).toBe("defensive");
  });

  it("wechselt höchstens 3 müde Spieler aus", () => {
    const { s, l } = live();
    for (const pp of l.home.pitch) l.home.fitness[pp.id] = 50;
    aiHalftime(s, l, "home");
    expect(l.home.subsUsed).toBe(3);
    expect(l.home.pitch).toHaveLength(11);
  });

  it("wechselt niemanden aus, wenn alle fit sind", () => {
    const { s, l } = live();
    aiHalftime(s, l, "home");
    expect(l.home.subsUsed).toBe(0);
  });
});
