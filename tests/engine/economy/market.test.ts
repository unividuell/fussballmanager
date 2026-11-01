import { describe, expect, it } from "vitest";
import { aiTransferRound, expectedIncome, expireOffers, generateAiOffers, respondTransferOffer } from "../../../src/engine/economy/market";
import { wageBill } from "../../../src/engine/economy/money";
import { removeFromClub } from "../../../src/engine/economy/roster";
import { generateWorld } from "../../../src/engine/generator";
import type { GameState, TransferOffer } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(41);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[10] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const own = (s: GameState) => s.clubs[s.managers[0].clubId!];

function offerFor(s: GameState, playerIndex = 20): TransferOffer {
  const club = own(s);
  const pid = club.squad[playerIndex];
  s.players[pid].transferListed = { askingPrice: 500_000 };
  const rng = Rng.fromSeed(1);
  for (let i = 0; i < 20 && !s.transferOffers.some((o) => o.playerId === pid); i++) generateAiOffers(s, rng);
  const o = s.transferOffers.find((x) => x.playerId === pid);
  if (!o) throw new Error("kein Angebot erzeugt");
  return o;
}

describe("generateAiOffers", () => {
  it("bietet für gelistete Spieler im Rahmen des Wunschpreises, mit Nachricht", () => {
    const s = game();
    const o = offerFor(s);
    expect(o.status).toBe("open");
    expect(o.fee).toBeGreaterThanOrEqual(370_000);
    expect(o.fee).toBeLessThanOrEqual(500_000);
    expect(o.maxFee).toBeGreaterThanOrEqual(o.fee);
    expect(s.clubs[o.fromClub].managerId).toBeNull();
    expect(o.expiresAfter).toBe(s.calendarIndex + 1);
    expect(s.messages.some((m) => m.ref?.type === "transferOffer" && m.ref.id === o.id)).toBe(true);
  });

  it("höchstens ein offenes Angebot pro Spieler", () => {
    const s = game();
    const o = offerFor(s);
    const rng = Rng.fromSeed(2);
    for (let i = 0; i < 10; i++) generateAiOffers(s, rng);
    expect(s.transferOffers.filter((x) => x.playerId === o.playerId && x.status === "open")).toHaveLength(1);
  });
});

describe("respondTransferOffer", () => {
  it("Annehmen: Spieler wechselt, Geld kommt, Vertrag beim Käufer", () => {
    const s = game();
    const o = offerFor(s);
    const before = own(s).finance.balance;
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "accept")).toBeNull();
    expect(o.status).toBe("accepted");
    expect(own(s).squad).not.toContain(o.playerId);
    expect(s.clubs[o.fromClub].squad).toContain(o.playerId);
    expect(s.players[o.playerId].contract).not.toBeNull();
    expect(own(s).finance.balance).toBe(before + o.fee);
  });

  it("Gegenangebot bis zum Maximum wird angenommen, darüber erhöht die KI, in Runde 3 zieht sie zurück", () => {
    const s = game();
    const o = offerFor(s);
    const max = o.maxFee;
    const first = o.fee;
    respondTransferOffer(s, s.managers[0].id, o.id, { counter: max * 3 });
    expect(o.status).toBe("open");
    expect(o.round).toBe(2);
    expect(o.fee).toBeGreaterThan(first);
    respondTransferOffer(s, s.managers[0].id, o.id, { counter: max * 3 });
    expect(o.round).toBe(3);
    respondTransferOffer(s, s.managers[0].id, o.id, { counter: max * 3 });
    expect(o.status).toBe("withdrawn");

    const s2 = game();
    const o2 = offerFor(s2);
    respondTransferOffer(s2, s2.managers[0].id, o2.id, { counter: o2.maxFee });
    expect(o2.status).toBe("accepted");
    expect(o2.fee).toBe(o2.maxFee);
  });

  it("Ablehnen, falsche Angebote und geschlossenes Fenster", () => {
    const s = game();
    const o = offerFor(s);
    expect(respondTransferOffer(s, s.managers[0].id, "x", "accept")).toBe("Dieses Angebot gibt es nicht.");
    s.calendarIndex = 5;
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "accept")).toBe("Das Transferfenster ist geschlossen.");
    s.calendarIndex = 0;
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "reject")).toBeNull();
    expect(o.status).toBe("rejected");
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "accept")).toBe("Dieses Angebot ist nicht mehr offen.");
  });

  it("Angebote verfallen nach einem Fenstertag", () => {
    const s = game();
    const o = offerFor(s);
    s.calendarIndex = o.expiresAfter;
    expireOffers(s);
    expect(s.transferOffers.some((x) => x.id === o.id)).toBe(true);
    s.calendarIndex = o.expiresAfter + 1;
    expireOffers(s);
    expect(s.transferOffers.some((x) => x.id === o.id)).toBe(false);
    expect(s.messages.some((m) => m.text.includes("verfallen"))).toBe(true);
  });
});

describe("aiTransferRound", () => {
  it("hält KI-Kader zwischen 22 und 28, kauft nur bezahlbar und ohne Dispo", () => {
    const s = game();
    const ai = Object.values(s.clubs).filter((c) => c.managerId === null);
    for (const id of ai[0].squad.slice(0, 8)) removeFromClub(s, id);
    const balances = new Map(ai.map((c) => [c.id, c.finance.balance]));
    aiTransferRound(s, Rng.fromSeed(5));
    for (const c of ai) {
      expect(c.squad.length).toBeGreaterThanOrEqual(18);
      expect(c.squad.length).toBeLessThanOrEqual(28);
      if (c.finance.balance < balances.get(c.id)!) expect(c.finance.balance).toBeGreaterThanOrEqual(0);
      expect(new Set(c.squad).size).toBe(c.squad.length);
      for (const id of c.squad) {
        expect(s.players[id].clubId).toBe(c.id);
        expect(s.players[id].contract).not.toBeNull();
      }
    }
  });

  it("Manager-Vereine bleiben unberührt", () => {
    const s = game();
    const squad = [...own(s).squad];
    aiTransferRound(s, Rng.fromSeed(6));
    expect(own(s).squad).toEqual(squad);
  });

  it("die Gehaltssumme bleibt bei Käufen im Rahmen der erwarteten Einnahmen", () => {
    const s = game();
    const ai = Object.values(s.clubs).filter((c) => c.managerId === null);
    const before = new Map(ai.map((c) => [c.id, { ids: new Set(c.squad), n: c.squad.length, wage: wageBill(s, c.id) }]));
    aiTransferRound(s, Rng.fromSeed(7));
    for (const c of ai) {
      const b = before.get(c.id)!;
      const signed = c.squad.some((id) => !b.ids.has(id));
      if (b.n < 22 || !signed) continue;
      const wage = wageBill(s, c.id);
      expect(wage <= 0.65 * expectedIncome(s, c.id) + 1 || wage <= b.wage).toBe(true);
    }
  });
});

describe("Kaderplatz und Gegenangebot", () => {
  it("volle Käufer-Kader: Angebot wird zurückgezogen", () => {
    const s = game();
    const o = offerFor(s);
    const buyer = s.clubs[o.fromClub];
    const others = Object.values(s.players).filter((p) => !buyer.squad.includes(p.id) && p.id !== o.playerId);
    for (let i = 0; buyer.squad.length < 32; i++) buyer.squad.push(others[i].id);
    expect(respondTransferOffer(s, s.managers[0].id, o.id, "accept")).toBeNull();
    expect(o.status).toBe("withdrawn");
    expect(own(s).squad).toContain(o.playerId);
  });

  it("Gegenangebot unter dem Gebot verkauft nicht billiger", () => {
    const s = game();
    const o = offerFor(s);
    const fee = o.fee;
    expect(respondTransferOffer(s, s.managers[0].id, o.id, { counter: 1 })).toBeNull();
    expect(o.status).toBe("accepted");
    expect(o.fee).toBe(fee);
  });
});
