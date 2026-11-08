import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../src/engine/model";
import { GOAL, keeperColor, planShot, renderScene, type SceneSheets } from "../../../src/ui/live/sceneRender";
import type { SceneEvent, SceneOutcome, SceneVariant } from "../../../src/ui/live/scenes";

const event: MatchEvent = { minute: 30, type: "goal", club: "h", player: "p1" };
function scene(outcome: SceneOutcome, variant: SceneVariant = null, minute = 30): SceneEvent {
  return { matchId: "m1", minute, club: "h", player: "p1", home: true, outcome, variant, event };
}

let drawImageCalls = 0;
function fakeCtx(): CanvasRenderingContext2D {
  return new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (typeof k === "string" && k in t ? t[k] : k === "drawImage" ? () => drawImageCalls++ : () => {}),
    set: (t, k, v) => ((t[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D;
}
const fakeSheets = { shooter: {}, keeper: {} } as unknown as SceneSheets;

describe("planShot", () => {
  it("Tor: Ziel liegt im Tor", () => {
    for (let m = 1; m <= 90; m++) {
      const p = planShot(scene("goal", null, m));
      expect(p.target.x).toBeGreaterThan(GOAL.l);
      expect(p.target.x).toBeLessThan(GOAL.r);
      expect(p.target.y).toBeGreaterThan(GOAL.bar);
      expect(p.target.y).toBeLessThan(GOAL.line);
    }
  });

  it("vorbei: seitlich außerhalb, drüber: oberhalb der Latte", () => {
    for (let m = 1; m <= 90; m++) {
      const side = planShot(scene("wide", "side", m));
      expect(side.target.x < GOAL.l || side.target.x > GOAL.r).toBe(true);
      expect(planShot(scene("wide", "over", m)).target.y).toBeLessThan(GOAL.bar);
    }
  });

  it("Pfosten: Ziel auf dem Pfosten, Latte: knapp unter der Lattenoberkante", () => {
    const post = planShot(scene("post", "post"));
    expect(Math.abs(post.target.x - GOAL.cx)).toBe(69);
    expect(planShot(scene("post", "bar")).target.y).toBe(GOAL.bar - 1);
  });

  it("gehalten: Torwart springt zur Schussseite", () => {
    for (let m = 1; m <= 30; m++) {
      const p = planShot(scene("save", "parry", m));
      expect(p.diveSide).toBe(p.side);
    }
  });

  it("gleiche Szene, gleicher Plan", () => {
    const s = scene("save", "catch", 44);
    expect(planShot(s)).toEqual(planShot(structuredClone(s)));
  });
});

describe("keeperColor", () => {
  it("hebt sich von beiden Vereinsfarben ab", () => {
    expect(keeperColor(["#3cb043", "#ffffff"])).not.toBe("#3cb043");
    expect(keeperColor(["#c8102e", "#ffffff"])).toBe("#3cb043");
  });
});

describe("renderScene", () => {
  it("zeichnet zu allen Zeitpunkten ohne Fehler", () => {
    drawImageCalls = 0;
    const plans = [scene("goal"), scene("save", "catch"), scene("save", "parry"), scene("wide", "over"), scene("post", "bar"), scene("post", "post")].map(planShot);
    for (const plan of plans) for (const t of [0, 300, 760, 1100, 1280, 1700, 2600, 3399]) renderScene(fakeCtx(), plan, t, fakeSheets);
    expect(drawImageCalls).toBeGreaterThan(0);
  });
});
