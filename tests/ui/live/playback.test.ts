import { describe, expect, it } from "vitest";
import { autoLineup } from "../../../src/engine/lineup";
import { startMatch, type LiveMatch } from "../../../src/engine/match/simulate";
import type { Match, MatchEvent } from "../../../src/engine/model";
import { Playback } from "../../../src/ui/live/playback";
import { SCENE_MS } from "../../../src/ui/live/scenes";
import { makeState } from "../../engine/fixtures";

const state = makeState([{ id: "h", strength: 70 }, { id: "a", strength: 70 }]);
for (const id of ["h", "a"]) state.clubs[id].lineup = autoLineup(state, id, "4-4-2");
const P = state.clubs.h.squad[5];

function liveWith(events: MatchEvent[]): LiveMatch {
  const match: Match = { id: "m1", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
  const live = startMatch(state, match);
  live.events = events;
  live.attacks = Array(90).fill("home");
  return live;
}
const goalAt = (minute: number): MatchEvent => ({ minute, type: "goal", club: "h", player: P });
const chanceAt = (minute: number, big: boolean): MatchEvent => ({ minute, type: "chance", club: "h", player: P, big });

function managedPlayback(events: MatchEvent[]): Playback {
  return new Playback({ lives: [liveWith(events)], managed: ["m1"], from: 0, to: 45, scenes: true });
}

describe("Playback", () => {
  it("Ereignisse ohne Szene sind in ihrer Minute aufgelöst", () => {
    const p = new Playback({ lives: [liveWith([goalAt(3)])], managed: [], from: 0, to: 45, scenes: true });
    p.step(0);
    p.step(0);
    expect(p.score("m1")).toEqual({ home: 0, away: 0 });
    expect(p.step(0)).toHaveLength(1);
    expect(p.score("m1")).toEqual({ home: 1, away: 0 });
    expect(p.minute).toBe(3);
  });

  it("kleine Chancen in Manager-Spielen sind sofort aufgelöst", () => {
    const p = managedPlayback([chanceAt(1, false)]);
    expect(p.step(0)).toHaveLength(1);
    expect(p.sceneRunning).toBe(false);
  });

  it("ein Tor in einem Manager-Spiel zählt erst bei der Auflösung", () => {
    const p = managedPlayback([goalAt(1)]);
    expect(p.step(0)).toHaveLength(0);
    expect(p.score("m1").home).toBe(0);
    expect(p.active("m1", 500)).toMatchObject({ elapsed: 500, revealed: false });
    p.update(SCENE_MS.reveal - 1);
    expect(p.score("m1").home).toBe(0);
    expect(p.update(SCENE_MS.reveal)).toHaveLength(1);
    expect(p.score("m1").home).toBe(1);
    expect(p.active("m1", SCENE_MS.reveal)?.revealed).toBe(true);
    expect(p.revealed("m1")).toHaveLength(1);
  });

  it("während einer Szene läuft die Uhr langsam", () => {
    const p = managedPlayback([goalAt(1)]);
    p.step(0);
    expect(p.msPerMinute(2)).toBe(1000);
    p.update(SCENE_MS.end);
    expect(p.msPerMinute(2)).toBe(200);
    expect(p.active("m1", SCENE_MS.end)).toBeNull();
  });

  it("zwei Szenen im selben Spiel laufen nacheinander", () => {
    const p = managedPlayback([goalAt(1), goalAt(2)]);
    p.step(0);
    p.step(500);
    expect(p.active("m1", 500)?.scene.minute).toBe(1);
    p.update(SCENE_MS.end);
    expect(p.score("m1").home).toBe(1);
    expect(p.active("m1", SCENE_MS.end)?.scene.minute).toBe(2);
    p.update(SCENE_MS.end + SCENE_MS.reveal);
    expect(p.score("m1").home).toBe(2);
  });

  it("Leertaste löst alles bis zum Halbzeitende auf und beendet Szenen", () => {
    const p = managedPlayback([goalAt(44), chanceAt(45, true)]);
    for (let i = 0; i < 44; i++) p.step(0);
    expect(p.sceneRunning).toBe(true);
    const resolved = p.skipToEnd();
    expect(resolved).toHaveLength(2);
    expect(p.minute).toBe(45);
    expect(p.score("m1").home).toBe(1);
    expect(p.sceneRunning).toBe(false);
    expect(p.finished).toBe(true);
  });

  it("am Halbzeitende ist erst fertig, wenn keine Szene mehr offen ist", () => {
    const p = managedPlayback([goalAt(45)]);
    for (let i = 0; i < 45; i++) p.step(0);
    expect(p.minute).toBe(45);
    expect(p.finished).toBe(false);
    p.update(SCENE_MS.end);
    expect(p.finished).toBe(true);
  });

  it("die Uhr bleibt am Halbzeitende stehen", () => {
    const p = managedPlayback([]);
    for (let i = 0; i < 50; i++) p.step(0);
    expect(p.minute).toBe(45);
  });

  it("2. Halbzeit: Ereignisse bis `from` gelten als aufgelöst", () => {
    const p = new Playback({ lives: [liveWith([goalAt(20), goalAt(50)])], managed: ["m1"], from: 45, to: 90, scenes: true });
    expect(p.minute).toBe(45);
    expect(p.score("m1").home).toBe(1);
    p.step(0);
    expect(p.active("m1", 0)).toBeNull();
  });

  it("ohne Torszenen-Option gibt es keine Szenen", () => {
    const p = new Playback({ lives: [liveWith([goalAt(1)])], managed: ["m1"], from: 0, to: 45, scenes: false });
    expect(p.step(0)).toHaveLength(1);
    expect(p.score("m1").home).toBe(1);
    expect(p.sceneRunning).toBe(false);
  });
});
