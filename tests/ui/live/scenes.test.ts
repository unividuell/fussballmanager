import { describe, expect, it } from "vitest";
import { autoLineup } from "../../../src/engine/lineup";
import { startMatch, type LiveMatch } from "../../../src/engine/match/simulate";
import type { GameState, Match, MatchEvent } from "../../../src/engine/model";
import { isSceneEvent, liveEventText, sceneLabel, sceneOf, type SceneEvent } from "../../../src/ui/live/scenes";
import { makeState } from "../../engine/fixtures";

function setup(): { state: GameState; live: LiveMatch; p: string } {
  const state = makeState([{ id: "h", strength: 70 }, { id: "a", strength: 70 }]);
  for (const id of ["h", "a"]) state.clubs[id].lineup = autoLineup(state, id, "4-4-2");
  const match: Match = { id: "m1", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
  const p = state.clubs.h.squad[5];
  state.players[p].lastName = "Müller";
  return { state, live: startMatch(state, match), p };
}

const { state, live, p } = setup();
const goal: MatchEvent = { minute: 34, type: "goal", club: "h", player: p };
const chance = (minute: number, big: boolean): MatchEvent => ({ minute, type: "chance", club: "h", player: p, big });
const yellow: MatchEvent = { minute: 34, type: "yellow", club: "h", player: p };

describe("isSceneEvent", () => {
  it("Tore und Großchancen sind Szenen, kleine Chancen und Karten nicht", () => {
    expect(isSceneEvent(goal)).toBe(true);
    expect(isSceneEvent(chance(10, true))).toBe(true);
    expect(isSceneEvent(chance(10, false))).toBe(false);
    expect(isSceneEvent(yellow)).toBe(false);
  });
});

describe("sceneOf", () => {
  it("ein Tor hat immer den Ausgang goal, Heim-Kennung und das Ereignis", () => {
    const s = sceneOf(live, goal);
    expect(s.outcome).toBe("goal");
    expect(s.variant).toBeNull();
    expect(s.home).toBe(true);
    expect(s.event).toBe(goal);
    expect(s).toMatchObject({ matchId: "m1", minute: 34, club: "h", player: p });
  });

  it("Ausgänge der Großchancen folgen den Gewichten 55/30/15", () => {
    const n = 10000;
    const count = { goal: 0, save: 0, wide: 0, post: 0 };
    for (let i = 0; i < n; i++) count[sceneOf({ ...live, matchId: `m${i % 97}` }, chance(i, true)).outcome]++;
    expect(count.goal).toBe(0);
    expect(count.save / n).toBeCloseTo(0.55, 1);
    expect(count.wide / n).toBeCloseTo(0.3, 1);
    expect(count.post / n).toBeCloseTo(0.15, 1);
  });

  it("Varianten passen zum Ausgang", () => {
    for (let i = 0; i < 300; i++) {
      const s = sceneOf(live, chance(i, true));
      const allowed = { goal: [null], save: ["catch", "parry"], wide: ["side", "over"], post: ["post", "bar"] }[s.outcome];
      expect(allowed).toContain(s.variant);
    }
  });

  it("Ausgang ist für dieselbe Chance immer gleich", () => {
    const e = chance(22, true);
    expect(sceneOf(live, e)).toEqual(sceneOf(structuredClone(live), e));
  });
});

describe("sceneLabel", () => {
  const base: SceneEvent = sceneOf(live, goal);
  it("Einblendung passt zu Ausgang und Variante", () => {
    expect(sceneLabel(base)).toBe("TOR!");
    expect(sceneLabel({ ...base, outcome: "save", variant: "parry" })).toBe("GEHALTEN!");
    expect(sceneLabel({ ...base, outcome: "wide", variant: "side" })).toBe("VORBEI!");
    expect(sceneLabel({ ...base, outcome: "wide", variant: "over" })).toBe("DRÜBER!");
    expect(sceneLabel({ ...base, outcome: "post", variant: "post" })).toBe("PFOSTEN!");
    expect(sceneLabel({ ...base, outcome: "post", variant: "bar" })).toBe("LATTE!");
  });
});

describe("liveEventText", () => {
  it("Tor, Großchance, kleine Chance und Karte", () => {
    expect(liveEventText(state, live, goal)).toBe("34' TOR! Müller");
    const big = chance(34, true);
    const label = sceneLabel(sceneOf(live, big)).replace("!", "").toLowerCase();
    expect(liveEventText(state, live, big)).toBe(`34' Müller: ${label}`);
    expect(liveEventText(state, live, chance(34, false))).toMatch(/^34' .*Müller/);
    expect(liveEventText(state, live, yellow)).toBe("34' Gelb: Müller");
  });
});
