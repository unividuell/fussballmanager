import { describe, expect, it } from "vitest";
import { applyCommand, type StateCommand } from "../../../src/engine/commands";
import { salaryDemand } from "../../../src/engine/economy/contracts";
import { generateWorld } from "../../../src/engine/generator";
import type { GameState } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { fireManager } from "../../../src/engine/economy/board";
import { startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(71);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[6] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const m = (s: GameState) => s.managers[0].id;
const club = (s: GameState) => s.clubs[s.managers[0].clubId!];

function ok(s: GameState, cmd: StateCommand): GameState {
  const r = applyCommand(s, cmd);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
function fails(s: GameState, cmd: StateCommand): string {
  const before = JSON.stringify(s);
  const r = applyCommand(s, cmd);
  expect(JSON.stringify(s)).toBe(before);
  if (r.ok) throw new Error("Befehl hätte scheitern müssen");
  return r.error;
}

describe("Wirtschaftsbefehle", () => {
  it("Training setzen und prüfen", () => {
    const s = game();
    const t = { intensity: "hard" as const, focus: "tactics" as const, individual: [club(s).squad[0]] };
    expect(ok(s, { type: "setTraining", managerId: m(s), training: t }).clubs[club(s).id].training).toEqual(t);
    expect(fails(s, { type: "setTraining", managerId: m(s), training: { ...t, intensity: "x" as never } })).toBe("Unbekannte Trainingsintensität.");
  });

  it("Eintrittspreis, Stadionausbau und Sponsor", () => {
    const s = game();
    expect(ok(s, { type: "setTicketPrice", managerId: m(s), price: 30 }).clubs[club(s).id].finance.ticketPrice).toBe(30);
    expect(fails(s, { type: "setTicketPrice", managerId: m(s), price: 1 })).toContain("zwischen 5 und 100");
    club(s).finance.balance = 100_000_000;
    club(s).finance.stadiumStage = 1;
    expect(ok(s, { type: "buildStadium", managerId: m(s) }).clubs[club(s).id].finance.building).not.toBeNull();
    const offer = club(s).finance.sponsorOffers[2];
    expect(ok(s, { type: "chooseSponsor", managerId: m(s), offerId: offer.id }).clubs[club(s).id].finance.sponsor).toEqual(offer);
    expect(fails(s, { type: "chooseSponsor", managerId: m(s), offerId: "x" })).toBe("Dieses Angebot gibt es nicht.");
  });

  it("Vertragsgespräch, Antwort und Entlassung", () => {
    const s = game();
    const p = s.players[club(s).squad[2]];
    const ask = salaryDemand(s, p, club(s).id);
    const s1 = ok(s, { type: "startContractTalk", managerId: m(s), playerId: p.id, salary: Math.round(ask * 0.85), years: 3 });
    const n = s1.negotiations.at(-1)!;
    const s2 = ok(s1, { type: "respondNegotiation", managerId: m(s), negotiationId: n.id, response: "accept" });
    expect(s2.negotiations.at(-1)!.status).toBe("accepted");
    expect(fails(s2, { type: "respondNegotiation", managerId: m(s), negotiationId: n.id, response: "accept" })).toBe("Diese Verhandlung ist schon beendet.");
    const s3 = ok(s2, { type: "releasePlayer", managerId: m(s), playerId: p.id });
    expect(s3.players[p.id].clubId).toBeNull();
  });

  it("Transferliste und Kaufversuch", () => {
    const s = game();
    const own = club(s).squad[4];
    expect(ok(s, { type: "setTransferListing", managerId: m(s), playerId: own, listed: true, askingPrice: 300_000 }).players[own].transferListed).toEqual({ askingPrice: 300_000 });
    const target = Object.values(s.clubs).find((c) => c.managerId === null)!.squad[14];
    const r = ok(s, { type: "startTransferTalk", managerId: m(s), playerId: target, fee: 1 });
    expect(r.negotiations.at(-1)!.status).toBe("aborted");
    s.calendarIndex = 5;
    expect(fails(s, { type: "startTransferTalk", managerId: m(s), playerId: target, fee: 1_000_000 })).toBe("Das Transferfenster ist geschlossen.");
  });

  it("Angebote beantworten scheitert bei unbekannter ID", () => {
    const s = game();
    expect(fails(s, { type: "respondTransferOffer", managerId: m(s), offerId: "x", response: "accept" })).toBe("Dieses Angebot gibt es nicht.");
  });

  it("Jobangebot annehmen geht auch ohne Verein; andere Befehle nicht", () => {
    const s = game();
    fireManager(s, m(s), Rng.fromSeed(1));
    expect(fails(s, { type: "setTicketPrice", managerId: m(s), price: 30 })).toBe("Du hast zurzeit keinen Verein.");
    const target = s.managers[0].jobOffers[0];
    const after = ok(s, { type: "acceptJobOffer", managerId: m(s), clubId: target });
    expect(after.managers[0].clubId).toBe(target);
  });

  it("unbekannte Befehle scheitern", () => {
    const s = game();
    expect(fails(s, { type: "gibtEsNicht", managerId: m(s) } as never)).toBe("Unbekannter Befehl.");
  });
});
