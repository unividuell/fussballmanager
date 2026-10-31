import { describe, expect, it } from "vitest";
import { MESSAGE_LIMIT, messagesFor, postMessage, postToClub } from "../../../src/engine/economy/messages";
import { removeFromClub } from "../../../src/engine/economy/roster";
import { autoLineup, validateLineup } from "../../../src/engine/lineup";
import { makeState } from "../fixtures";

describe("messages", () => {
  it("legt Nachrichten an, neueste zuerst, höchstens 60 pro Manager", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.managers.push({ id: "m1", name: "A", clubId: "c1", jobOffers: [], unemployedFor: 0 });
    s.clubs.c1.managerId = "m1";
    for (let i = 0; i < MESSAGE_LIMIT + 5; i++) postMessage(s, "m1", `Nachricht ${i}`);
    const mine = messagesFor(s, "m1");
    expect(mine).toHaveLength(MESSAGE_LIMIT);
    expect(mine[0].text).toBe(`Nachricht ${MESSAGE_LIMIT + 4}`);
    expect(mine.at(-1)!.text).toBe("Nachricht 5");
  });

  it("postToClub schreibt nur an menschliche Manager", () => {
    const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
    s.managers.push({ id: "m1", name: "A", clubId: "c1", jobOffers: [], unemployedFor: 0 });
    s.clubs.c1.managerId = "m1";
    expect(postToClub(s, "c1", "Hallo")?.managerId).toBe("m1");
    expect(postToClub(s, "c2", "Hallo")).toBeNull();
    expect(s.messages).toHaveLength(1);
  });
});

describe("removeFromClub", () => {
  it("entfernt den Spieler überall und hält die Aufstellung gültig", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const club = s.clubs.c1;
    club.lineup = autoLineup(s, "c1", "4-4-2");
    const starter = club.lineup.starters[4];
    const benched = club.lineup.bench[2];
    club.training.individual = [starter];
    s.negotiations.push({ id: "n1", managerId: "m1", playerId: starter, stage: "salary", fee: null, ask: 1, round: 1, desiredYears: 2, status: "open", note: "", season: 1, createdAt: 0 });
    s.transferOffers.push({ id: "o1", managerId: "m1", fromClub: "x", playerId: starter, fee: 1, maxFee: 2, round: 1, status: "open", season: 1, expiresAfter: 0 });
    removeFromClub(s, starter);
    removeFromClub(s, benched);
    expect(club.squad).not.toContain(starter);
    expect(club.lineup.starters).not.toContain(starter);
    expect(club.lineup.bench).not.toContain(benched);
    expect(validateLineup(s, "c1", club.lineup)).toBeNull();
    expect(club.training.individual).toEqual([]);
    expect(s.players[starter]).toMatchObject({ clubId: null, contract: null, transferListed: null });
    expect(s.negotiations[0].status).toBe("aborted");
    expect(s.transferOffers[0].status).toBe("withdrawn");
  });
});
