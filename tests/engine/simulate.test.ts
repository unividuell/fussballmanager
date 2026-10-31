import { describe, expect, it } from "vitest";
import { autoLineup } from "../../src/engine/lineup";
import {
  changeTactics,
  finalScore,
  penaltyShootout,
  sendOff,
  simulateHalf,
  startMatch,
  substitute,
  type LiveMatch,
} from "../../src/engine/match/simulate";
import type { GameState, Match } from "../../src/engine/model";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

function setup(hs = 70, as = 70): { s: GameState; match: Match } {
  const s = makeState([{ id: "h", strength: hs }, { id: "a", strength: as }]);
  for (const id of ["h", "a"]) s.clubs[id].lineup = autoLineup(s, id, "4-4-2");
  const match: Match = { id: "m1", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
  return { s, match };
}

function playFull(s: GameState, match: Match, seed: number): LiveMatch {
  const rng = Rng.fromSeed(seed);
  const live = startMatch(s, match);
  simulateHalf(s, live, 1, rng);
  simulateHalf(s, live, 2, rng);
  return live;
}

describe("startMatch", () => {
  it("übernimmt Startelf, Bank, Taktik und Kondition", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    expect(live.home.pitch).toHaveLength(11);
    expect(live.home.pitch[0].slot).toBe("GK");
    expect(live.home.bench).toEqual(s.clubs.h.lineup.bench);
    expect(live.home.fitness[live.home.pitch[3].id]).toBe(100);
    expect(live.home.played).toHaveLength(11);
  });
});

describe("simulateHalf", () => {
  it("ist deterministisch", () => {
    const { s, match } = setup();
    expect(JSON.stringify(playFull(s, match, 5))).toBe(JSON.stringify(playFull(s, match, 5)));
  });

  it("die 1. Halbzeit endet in Minute 45, die 2. in Minute 90", () => {
    const { s, match } = setup();
    const rng = Rng.fromSeed(1);
    const live = startMatch(s, match);
    simulateHalf(s, live, 1, rng);
    expect(live.minute).toBe(45);
    expect(live.events.every((e) => e.minute <= 45)).toBe(true);
    simulateHalf(s, live, 2, rng);
    expect(live.minute).toBe(90);
  });

  it("Torereignisse passen zum Ergebnis, Torschützen standen auf dem Platz", () => {
    const { s, match } = setup();
    for (let seed = 1; seed <= 30; seed++) {
      const live = playFull(s, match, seed);
      const score = finalScore(live);
      const goals = live.events.filter((e) => e.type === "goal");
      expect(goals.filter((g) => g.club === "h")).toHaveLength(score.home);
      expect(goals.filter((g) => g.club === "a")).toHaveLength(score.away);
      for (const g of goals) {
        if (g.type !== "goal") continue;
        const side = g.club === "h" ? live.home : live.away;
        expect(side.played).toContain(g.player);
      }
    }
  });

  it("verändert den Spielstand nicht", () => {
    const { s, match } = setup();
    const before = JSON.stringify(s);
    playFull(s, match, 3);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("die Kondition sinkt im Lauf des Spiels", () => {
    const { s, match } = setup();
    const live = playFull(s, match, 2);
    const someone = live.home.pitch.find((pp) => s.clubs.h.lineup.starters.includes(pp.id))!;
    expect(live.home.fitness[someone.id]).toBeLessThan(80);
    expect(live.home.fitness[someone.id]).toBeGreaterThan(60);
  });

  it("nie mehr als 11 Spieler auf dem Platz, nie mehr als 5 Wechsel", () => {
    const { s, match } = setup();
    for (let seed = 1; seed <= 200; seed++) {
      const live = playFull(s, match, seed);
      for (const side of [live.home, live.away]) {
        expect(side.pitch.length).toBeLessThanOrEqual(11);
        expect(side.subsUsed).toBeLessThanOrEqual(5);
        expect(side.pitch.filter((pp) => pp.slot === "GK").length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("substitute", () => {
  it("tauscht einen Spieler auf demselben Platz aus", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    const out = live.home.pitch[5];
    const inId = live.home.bench[1];
    expect(substitute(s, live, "home", out.id, inId)).toBeNull();
    expect(live.home.pitch[5]).toEqual({ id: inId, slot: out.slot });
    expect(live.home.bench).not.toContain(inId);
    expect(live.home.subsUsed).toBe(1);
    expect(live.home.played).toContain(inId);
    expect(live.events.at(-1)).toMatchObject({ type: "sub", out: out.id, in: inId });
  });

  it("lehnt ungültige Wechsel ab und ändert dann nichts", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    const before = JSON.stringify(live);
    expect(substitute(s, live, "home", "gibts-nicht", live.home.bench[0])).toMatch(/nicht auf dem Platz/);
    expect(substitute(s, live, "home", live.home.pitch[1].id, "a-MF1")).toMatch(/nicht auf der Bank/);
    expect(JSON.stringify(live)).toBe(before);
  });

  it("ein ausgewechselter Spieler kann nicht zurückkommen, der 6. Wechsel wird abgelehnt", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    const firstOut = live.home.pitch[10].id;
    for (let i = 0; i < 5; i++) {
      expect(substitute(s, live, "home", live.home.pitch[10 - i].id, live.home.bench[0])).toBeNull();
    }
    expect(live.home.bench).not.toContain(firstOut);
    expect(substitute(s, live, "home", live.home.pitch[1].id, live.home.bench[0])).toMatch(/5 Wechsel/);
  });
});

describe("sendOff", () => {
  it("Torwart vom Platz mit freiem Wechsel: Ersatztorwart kommt für einen Feldspieler", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    sendOff(s, live, "home", live.home.pitch[0].id, 30, false);
    expect(live.home.pitch).toHaveLength(10);
    const gk = live.home.pitch.find((pp) => pp.slot === "GK")!;
    expect(s.players[gk.id].position).toBe("GK");
    expect(live.home.subsUsed).toBe(1);
  });

  it("Torwart vom Platz ohne Wechsel: ein Feldspieler geht ins Tor", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    live.home.subsUsed = 5;
    sendOff(s, live, "home", live.home.pitch[0].id, 80, false);
    expect(live.home.pitch).toHaveLength(10);
    const gk = live.home.pitch.find((pp) => pp.slot === "GK")!;
    expect(s.players[gk.id].position).not.toBe("GK");
  });
});

describe("changeTactics", () => {
  it("verteilt die Spieler bei neuer Formation passend um", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    changeTactics(s, live, "home", { formation: "4-3-3", style: "offensive" });
    expect(live.home.tactics.formation).toBe("4-3-3");
    expect(live.home.tactics.style).toBe("offensive");
    expect(live.home.pitch.filter((pp) => pp.slot === "FW")).toHaveLength(3);
    expect(live.home.pitch.filter((pp) => pp.slot === "GK")).toHaveLength(1);
    expect(new Set(live.home.pitch.map((pp) => pp.id)).size).toBe(11);
  });

  it("mit 10 Spielern fällt ein Sturmplatz weg", () => {
    const { s, match } = setup();
    const live = startMatch(s, match);
    live.home.pitch.splice(5, 1);
    changeTactics(s, live, "home", { formation: "4-3-3" });
    expect(live.home.pitch).toHaveLength(10);
    expect(live.home.pitch.filter((pp) => pp.slot === "FW")).toHaveLength(2);
  });
});

describe("penaltyShootout", () => {
  it("endet nie unentschieden", () => {
    const rng = Rng.fromSeed(1);
    for (let i = 0; i < 500; i++) {
      const p = penaltyShootout(rng);
      expect(p.home).not.toBe(p.away);
    }
  });
});
