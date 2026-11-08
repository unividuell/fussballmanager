import { describe, expect, it } from "vitest";
import { generateWorld } from "../../../src/engine/generator";
import type { LiveMatch } from "../../../src/engine/match/simulate";
import { COMP, type ClubId, type GameState } from "../../../src/engine/model";
import { kickOff, leagueOf, startNewGame } from "../../../src/engine/season";
import { liveLayout, managedMatchIds } from "../../../src/ui/live/layout";

const world = generateWorld(42);

function game(pick: (fixtures: LiveMatch[]) => ClubId[]): { state: GameState; lives: LiveMatch[] } {
  const probe = startNewGame(world, [{ name: "X", clubId: Object.keys(world.clubs)[0] }]);
  if (!probe.ok) throw new Error(probe.error);
  const clubs = pick(kickOff(probe.state));
  const r = startNewGame(world, clubs.map((clubId, i) => ({ name: `M${i}`, clubId })));
  if (!r.ok) throw new Error(r.error);
  return { state: r.state, lives: kickOff(r.state) };
}

const l1 = (lives: LiveMatch[]) => lives.filter((l) => l.competitionId === COMP.first);
const l2 = (lives: LiveMatch[]) => lives.filter((l) => l.competitionId === COMP.second);

describe("liveLayout", () => {
  it("1 Spiel mit Manager: bildschirmfüllend", () => {
    const { state, lives } = game((f) => [l1(f)[0].home.club]);
    expect(liveLayout(state, lives)).toEqual({ full: true, slots: [{ kind: "match", matchId: l1(lives)[0].matchId }] });
  });

  it("zwei Manager im direkten Duell und sonst keiner: ein Spiel, bildschirmfüllend", () => {
    const { state, lives } = game((f) => [l1(f)[0].home.club, l1(f)[0].away.club]);
    expect(managedMatchIds(state, lives)).toEqual([l1(lives)[0].matchId]);
    expect(liveLayout(state, lives).full).toBe(true);
  });

  it("3 Spiele: drei Viertel in Manager-Reihenfolge, das vierte zeigt die Liga des ersten Managers", () => {
    const { state, lives } = game((f) => [l1(f)[2].home.club, l1(f)[0].home.club, l2(f)[1].away.club]);
    const layout = liveLayout(state, lives);
    expect(layout.full).toBe(false);
    expect(layout.slots).toEqual([
      { kind: "match", matchId: l1(lives)[2].matchId },
      { kind: "match", matchId: l1(lives)[0].matchId },
      { kind: "match", matchId: l2(lives)[1].matchId },
      { kind: "table", competitionId: COMP.first },
    ]);
  });

  it("2 Spiele: freie Viertel zeigen erst die Liga des ersten Managers, dann die andere Liga", () => {
    const { state, lives } = game((f) => [l2(f)[0].home.club, l2(f)[1].home.club]);
    expect(liveLayout(state, lives).slots.slice(2)).toEqual([
      { kind: "table", competitionId: COMP.second },
      { kind: "table", competitionId: COMP.first },
    ]);
  });

  it("kein Spiel mit Manager (Relegation ohne Manager-Verein): Tabelle bildschirmfüllend", () => {
    const { state, lives } = game((f) => [l1(f)[0].home.club]);
    const rel = lives.filter((l) => l.matchId !== l1(lives)[0].matchId).slice(0, 1).map((l) => ({ ...l, competitionId: COMP.relegation }));
    expect(liveLayout(state, rel)).toEqual({
      full: true,
      slots: [{ kind: "table", competitionId: leagueOf(state, state.managers[0].clubId)! }],
    });
  });
});
