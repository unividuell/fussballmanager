import { describe, expect, it } from "vitest";
import { addYouth } from "../../src/engine/economy/training";
import { aiTransferRound } from "../../src/engine/economy/market";
import { startTransferTalk } from "../../src/engine/economy/negotiations";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import type { ClubId, GameState } from "../../src/engine/model";
import { isRegionalliga } from "../../src/engine/regionalliga";
import { Rng } from "../../src/engine/rng";
import { finishSeason, isSeasonOver, playMatchdayAuto, startNewGame } from "../../src/engine/season";
import { DEFAULT_FILTER, marketRows } from "../../src/ui/logic/economy";

function game(): GameState {
  const world = generateWorld(2027);
  const own = Object.values(world.clubs).find((c) => c.name === "Hertha BSC")!.id;
  const r = startNewGame(world, [{ name: "Anna", clubId: own }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const rlClubs = (s: GameState): ClubId[] => Object.keys(s.clubs).filter((id) => isRegionalliga(s, id));

function playSeason(s: GameState): GameState {
  while (!isSeasonOver(s)) s = playMatchdayAuto(s);
  return s;
}

describe("Regionalliga", () => {
  it("RL-Vereine buchen nichts", () => {
    const s = playMatchdayAuto(game());
    for (const id of rlClubs(s)) expect(s.clubs[id].finance.ledger, s.clubs[id].name).toEqual([]);
  });

  it("RL-Spieler sind nicht im Markt, und ein Manager kann nicht um sie verhandeln", () => {
    const s = game();
    const own = s.managers[0].clubId;
    const rlPlayers = new Set(rlClubs(s).flatMap((id) => s.clubs[id].squad));
    expect(marketRows(s, own, DEFAULT_FILTER).some((r) => rlPlayers.has(r.player.id))).toBe(false);
    const target = [...rlPlayers][0];
    expect(startTransferTalk(s, s.managers[0].id, target, 1_000_000)).toBe("Dieser Verein spielt in der Regionalliga und gibt keine Spieler ab.");
  });

  it("RL-Vereine kaufen nicht und bekommen keine Jugend", () => {
    const s = game();
    const before = Object.fromEntries(rlClubs(s).map((id) => [id, [...s.clubs[id].squad]]));
    aiTransferRound(s, Rng.fromSeed(3));
    addYouth(s, Rng.fromSeed(4));
    for (const id of rlClubs(s)) expect(s.clubs[id].squad).toEqual(before[id]);
  });

  it("RL-Verträge laufen nicht aus", { timeout: 120_000 }, () => {
    const s = playSeason(game());
    const before = Object.fromEntries(rlClubs(s).map((id) => [id, new Set(s.clubs[id].squad)]));
    const next = finishSeason(s).state;
    for (const [id, squad] of Object.entries(before)) {
      for (const pid of squad) {
        const p = next.players[pid];
        if (!p || p.retired) continue;
        expect(p.clubId, `${s.clubs[id].name}: ${p.lastName}`).toBe(id);
      }
    }
  });

  it("RL-Kader hat nach dem Saisonwechsel wieder 25 Spieler und eine gültige Aufstellung", { timeout: 120_000 }, () => {
    const s = playSeason(game());
    const id = rlClubs(s)[0];
    for (const pid of s.clubs[id].squad.slice(0, 8)) s.players[pid].age = 40; // Testaufbau: Karriereende
    const next = finishSeason(s).state;
    expect(next.clubs[id].squad).toHaveLength(25);
    expect(validateLineup(next, id, next.clubs[id].lineup)).toBeNull();
    for (const rl of rlClubs(next)) expect(next.clubs[rl].squad.length).toBeGreaterThanOrEqual(22);
  });
});
