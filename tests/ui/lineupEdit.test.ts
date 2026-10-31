import { describe, expect, it } from "vitest";
import { slotPositions } from "../../src/engine/model";
import { squadRows, swapPlayers } from "../../src/ui/logic/lineupEdit";
import { newTestGame } from "./game";

describe("squadRows", () => {
  it("listet Startelf mit Plätzen, dann Bank, dann Reserve – jeder Spieler genau einmal", () => {
    const s = newTestGame();
    const club = s.clubs[s.managers[0].clubId!];
    const rows = squadRows(s, club.id);
    expect(rows).toHaveLength(club.squad.length);
    expect(new Set(rows.map((r) => r.player.id)).size).toBe(club.squad.length);
    const slots = slotPositions(club.tactics.formation);
    rows.slice(0, 11).forEach((r, i) => {
      expect(r.area).toBe("starter");
      expect(r.player.id).toBe(club.lineup.starters[i]);
      expect(r.slot).toBe(slots[i]);
    });
    const bench = rows.filter((r) => r.area === "bench");
    expect(bench.map((r) => r.player.id)).toEqual(club.lineup.bench);
    expect(bench.every((r) => r.slot === null)).toBe(true);
    const reserve = rows.filter((r) => r.area === "reserve");
    const order = ["GK", "DF", "MF", "FW"];
    for (let i = 1; i < reserve.length; i++) {
      const a = reserve[i - 1].player;
      const b = reserve[i].player;
      const byPos = order.indexOf(a.position) - order.indexOf(b.position);
      expect(byPos < 0 || (byPos === 0 && a.strength >= b.strength)).toBe(true);
    }
  });
});

describe("swapPlayers", () => {
  const lineup = { starters: ["a", "b", "c"], bench: ["d", "e"] };

  it("tauscht zwei Startspieler", () => {
    expect(swapPlayers(lineup, "a", "c")).toEqual({ starters: ["c", "b", "a"], bench: ["d", "e"] });
  });

  it("tauscht Startelf und Bank in beide Richtungen", () => {
    expect(swapPlayers(lineup, "b", "e")).toEqual({ starters: ["a", "e", "c"], bench: ["d", "b"] });
    expect(swapPlayers(lineup, "e", "b")).toEqual({ starters: ["a", "e", "c"], bench: ["d", "b"] });
  });

  it("holt einen Reservespieler auf den Platz eines Start- oder Bankspielers", () => {
    expect(swapPlayers(lineup, "a", "x")).toEqual({ starters: ["x", "b", "c"], bench: ["d", "e"] });
    expect(swapPlayers(lineup, "x", "d")).toEqual({ starters: ["a", "b", "c"], bench: ["x", "e"] });
  });

  it("zwei Reservespieler oder derselbe Spieler: keine Änderung, Original unverändert", () => {
    expect(swapPlayers(lineup, "x", "y")).toEqual(lineup);
    expect(swapPlayers(lineup, "a", "a")).toEqual(lineup);
    expect(lineup).toEqual({ starters: ["a", "b", "c"], bench: ["d", "e"] });
  });
});
