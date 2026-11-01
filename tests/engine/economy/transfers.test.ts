import { describe, expect, it } from "vitest";
import { marketValue } from "../../../src/engine/economy/money";
import { WINDOW_INDICES, askingFee, executeTransfer, isTransferWindow, setTransferListing } from "../../../src/engine/economy/transfers";
import { autoLineup } from "../../../src/engine/lineup";
import { makePlayer, makeState } from "../fixtures";

function setup() {
  const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
  s.managers.push({ id: "m1", name: "Anna", clubId: "c1", jobOffers: [], unemployedFor: 0 });
  s.clubs.c1.managerId = "m1";
  for (const c of ["c1", "c2"]) s.clubs[c].lineup = autoLineup(s, c, "4-4-2");
  return s;
}

describe("Transferfenster", () => {
  it("ist vor dem 1., 18. und 19. Spieltag offen", () => {
    const s = setup();
    expect(WINDOW_INDICES).toEqual([0, 17, 18]);
    for (const i of [0, 17, 18]) {
      s.calendarIndex = i;
      expect(isTransferWindow(s)).toBe(true);
    }
    for (const i of [1, 16, 19, 33, 34]) {
      s.calendarIndex = i;
      expect(isTransferWindow(s)).toBe(false);
    }
  });
});

describe("askingFee", () => {
  it("Startspieler teurer als Ersatz, Transferliste nach Wunschpreis, Vereinslose kostenlos", () => {
    const s = setup();
    const starter = s.players[s.clubs.c2.lineup.starters[3]];
    const reserve = s.players[s.clubs.c2.squad.find((id) => !s.clubs.c2.lineup.starters.includes(id))!];
    const mv = (id: string) => marketValue(s.players[id], s.season);
    expect(askingFee(s, starter)).toBe(Math.round((mv(starter.id) * 1.5) / 10_000) * 10_000);
    expect(askingFee(s, reserve)).toBe(Math.round((mv(reserve.id) * 1.2) / 10_000) * 10_000);
    reserve.transferListed = { askingPrice: null };
    expect(askingFee(s, reserve)).toBe(mv(reserve.id));
    reserve.transferListed = { askingPrice: 123_000 };
    expect(askingFee(s, reserve)).toBe(123_000);
    expect(askingFee(s, makePlayer("f", "MF", 70, { clubId: null, contract: null }))).toBe(0);
  });
});

describe("executeTransfer", () => {
  it("bucht die Ablöse, wechselt den Kader und benachrichtigt den abgebenden Manager", () => {
    const s = setup();
    const pid = s.clubs.c1.squad[10];
    const before = { c1: s.clubs.c1.finance.balance, c2: s.clubs.c2.finance.balance };
    executeTransfer(s, "c2", pid, 750_000);
    expect(s.clubs.c1.finance.balance).toBe(before.c1 + 750_000);
    expect(s.clubs.c2.finance.balance).toBe(before.c2 - 750_000);
    expect(s.clubs.c1.squad).not.toContain(pid);
    expect(s.clubs.c2.squad).toContain(pid);
    expect(s.players[pid].clubId).toBe("c2");
    expect(s.players[pid].contract).toBeNull();
    expect(s.messages[0].text).toContain("750.000 €");
  });

  it("ein Vereinsloser kommt ohne Buchung beim Verkäufer", () => {
    const s = setup();
    s.players.f = makePlayer("f", "FW", 60, { clubId: null, contract: null });
    executeTransfer(s, "c2", "f", 0);
    expect(s.clubs.c2.squad).toContain("f");
    expect(s.clubs.c2.finance.ledger).toEqual([]);
  });
});

describe("setTransferListing", () => {
  it("setzt und entfernt Spieler auf der Transferliste", () => {
    const s = setup();
    const pid = s.clubs.c1.squad[5];
    expect(setTransferListing(s, "c1", pid, true, 400_000)).toBeNull();
    expect(s.players[pid].transferListed).toEqual({ askingPrice: 400_000 });
    expect(setTransferListing(s, "c1", pid, true, null)).toBeNull();
    expect(s.players[pid].transferListed).toEqual({ askingPrice: null });
    expect(setTransferListing(s, "c1", pid, false, null)).toBeNull();
    expect(s.players[pid].transferListed).toBeNull();
    expect(setTransferListing(s, "c1", s.clubs.c2.squad[0], true, null)).toBe("Der Spieler gehört nicht zum Kader.");
    expect(setTransferListing(s, "c1", pid, true, -5)).toBe("Der Wunschpreis muss eine positive ganze Zahl sein.");
  });
});
