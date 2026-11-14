import { describe, expect, it } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { playMatchdayAuto, startNewGame } from "../../src/engine/season";

// Richtwert am 2026-11-13 mit 36 Vereinen: 126–136 ms pro Spieltag. Mit 54 Vereinen höchstens etwa das 1,6-Fache.
describe("Zeitmessung", () => {
  it("ein automatischer Spieltag bleibt schnell", { timeout: 120_000 }, () => {
    const world = generateWorld(2027);
    const r = startNewGame(world, [{ name: "T", clubId: Object.keys(world.clubs)[0] }]);
    if (!r.ok) throw new Error(r.error);
    let s = r.state;
    for (let i = 0; i < 3; i++) s = playMatchdayAuto(s);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) s = playMatchdayAuto(s);
    const ms = (performance.now() - t0) / 20;
    console.log(`${ms.toFixed(1)} ms pro Spieltag`);
    expect(ms).toBeLessThanOrEqual(220);
  });
});
