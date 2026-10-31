import { describe, expect, it } from "vitest";
import { COMP } from "../../src/engine/model";
import { kickOff, playHalf, prepareMatchday } from "../../src/engine/season";
import { competitionName, competitionsOf, halfBounds, tickerRows, TEMPOS, DEFAULT_TEMPO } from "../../src/ui/logic/ticker";
import { newTestGame } from "./game";

function firstHalf() {
  const s = prepareMatchday(newTestGame()).state;
  return playHalf(s, kickOff(s), 1);
}

describe("ticker", () => {
  it("Tempo und Halbzeitgrenzen", () => {
    expect(TEMPOS[DEFAULT_TEMPO]).toBe(500);
    expect(halfBounds(1)).toEqual({ from: 0, to: 45 });
    expect(halfBounds(2)).toEqual({ from: 45, to: 90 });
  });

  it("zu Minute 0 steht es überall 0:0 ohne Ereignis", () => {
    const { state, lives } = firstHalf();
    const rows = tickerRows(state, lives, 0);
    expect(rows).toHaveLength(18);
    expect(rows.every((r) => r.homeGoals === 0 && r.awayGoals === 0 && r.last === null && !r.goalNow)).toBe(true);
  });

  it("zu Minute 45 entspricht der Stand den Toren der 1. Halbzeit", () => {
    const { state, lives } = firstHalf();
    const rows = tickerRows(state, lives, 45);
    rows.forEach((r, i) => {
      expect(r.homeGoals).toBe(lives[i].home.goals);
      expect(r.awayGoals).toBe(lives[i].away.goals);
      expect(r.home).toBe(state.clubs[lives[i].home.club].name);
    });
  });

  it("zählt Tore erst ab ihrer Minute und markiert die Torminute", () => {
    const { state, lives } = firstHalf();
    const live = lives.find((l) => l.events.some((e) => e.type === "goal"));
    if (!live) return; // extrem unwahrscheinlich: keine Tore in 18 Halbzeiten
    const goal = live.events.find((e) => e.type === "goal")!;
    const idx = lives.indexOf(live);
    const before = tickerRows(state, lives, goal.minute - 1)[idx];
    const at = tickerRows(state, lives, goal.minute)[idx];
    expect(at.homeGoals + at.awayGoals).toBe(before.homeGoals + before.awayGoals + live.events.filter((e) => e.type === "goal" && e.minute === goal.minute).length);
    expect(at.goalNow).toBe(true);
    expect(at.last).toContain("TOR!");
  });

  it("flashMinutes verlängert das Tor-Aufleuchten über mehrere Minuten", () => {
    const { state, lives } = firstHalf();
    const l = structuredClone(lives[0]);
    l.events = [{ minute: 10, type: "goal", club: l.home.club, player: l.home.pitch[2].id }];
    expect(tickerRows(state, [l], 11)[0].goalNow).toBe(false);
    expect(tickerRows(state, [l], 11, 2)[0].goalNow).toBe(true);
    expect(tickerRows(state, [l], 12, 2)[0].goalNow).toBe(false);
    expect(tickerRows(state, [l], 9, 2)[0].goalNow).toBe(false);
  });

  it("gelbe Karten und Wechsel erscheinen nicht als letztes Ereignis", () => {
    const { state, lives } = firstHalf();
    const l = structuredClone(lives[0]);
    l.events = [{ minute: 10, type: "yellow", club: l.home.club, player: l.home.pitch[2].id }];
    expect(tickerRows(state, [l], 45)[0].last).toBeNull();
  });

  it("markiert Spiele mit menschlichem Manager", () => {
    const { state, lives } = firstHalf();
    const rows = tickerRows(state, lives, 0);
    expect(rows.filter((r) => r.managed)).toHaveLength(1);
  });

  it("listet Wettbewerbe in Reihenfolge und benennt sie", () => {
    const { state, lives } = firstHalf();
    expect(competitionsOf(lives)).toEqual([COMP.first, COMP.second]);
    expect(competitionName(state, COMP.first)).toBe("1. Liga");
    expect(competitionName(state, "XYZ")).toBe("XYZ");
  });
});
