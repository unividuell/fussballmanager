import { describe, expect, it } from "vitest";
import { autoLineup } from "../../src/engine/lineup";
import { finalScore, simulateHalf, startMatch } from "../../src/engine/match/simulate";
import type { Match } from "../../src/engine/model";
import { Rng } from "../../src/engine/rng";
import { makeState } from "./fixtures";

// Hält die Ergebnisse vieler Spiele fest. Ändert sich der Snapshot, zieht die Engine andere
// Zufallswerte als vorher – das darf durch reine Zusatzinfos (Chancen, Angriffsseite) nicht passieren.
function fingerprint(n: number, seed: number): string[] {
  const s = makeState([{ id: "h", strength: 70 }, { id: "a", strength: 65 }]);
  for (const id of ["h", "a"]) s.clubs[id].lineup = autoLineup(s, id, "4-4-2");
  const match: Match = { id: "m", competitionId: "L1", round: 1, home: "h", away: "a", result: null, events: [], penalties: null };
  const rng = Rng.fromSeed(seed);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const live = startMatch(s, match);
    simulateHalf(s, live, 1, rng);
    simulateHalf(s, live, 2, rng);
    const r = finalScore(live);
    const events = live.events
      .filter((e) => (e.type as string) !== "chance")
      .map((e) => `${e.minute}${e.type[0]}${"player" in e ? e.player : `${e.out}>${e.in}`}`)
      .join(",");
    out.push(`${r.home}:${r.away} ${events}`);
  }
  return out;
}

describe("Zufallsfolge der Engine", () => {
  it("gleiche Ergebnisse wie vor der Chancen-Erweiterung", () => {
    expect(fingerprint(300, 11)).toMatchSnapshot();
  });
});
