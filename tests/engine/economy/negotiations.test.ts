import { describe, expect, it } from "vitest";
import { desiredYears, salaryDemand } from "../../../src/engine/economy/contracts";
import {
  cleanupNegotiations,
  openNegotiationFor,
  respondNegotiation,
  startContractTalk,
  startTransferTalk,
} from "../../../src/engine/economy/negotiations";
import { askingFee } from "../../../src/engine/economy/transfers";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type GameState } from "../../../src/engine/model";
import { startNewGame } from "../../../src/engine/season";

function game(names = ["Anna"]): GameState {
  const world = generateWorld(31);
  const ids = Object.keys(world.clubs);
  const r = startNewGame(world, names.map((name, i) => ({ name, clubId: ids[i] })));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const mgr = (s: GameState, i = 0) => s.managers[i];
const own = (s: GameState) => s.clubs[mgr(s).clubId!];
const last = (s: GameState) => s.negotiations.at(-1)!;

describe("Vertragsverhandlung mit eigenem Spieler", () => {
  it("ein Angebot über der Forderung wird sofort angenommen", () => {
    const s = game();
    const p = s.players[own(s).squad[3]];
    const ask = salaryDemand(s, p, own(s).id);
    expect(startContractTalk(s, mgr(s).id, p.id, ask, desiredYears(p))).toBeNull();
    expect(last(s).status).toBe("accepted");
    expect(p.contract).toMatchObject({ salary: ask });
    expect(last(s).note).toContain("unterschreibt");
  });

  it("Gegenforderung, dann Annahme der Forderung", () => {
    const s = game();
    const p = s.players[own(s).squad[4]];
    const years = 3;
    const ask = salaryDemand(s, p, own(s).id);
    startContractTalk(s, mgr(s).id, p.id, Math.round(ask * 0.85), years);
    const n = last(s);
    expect(n.status).toBe("open");
    expect(n.round).toBe(2);
    expect(n.note).toContain("fordert");
    expect(respondNegotiation(s, mgr(s).id, n.id, "accept")).toBeNull();
    expect(n.status).toBe("accepted");
  });

  it("zu niedriges Angebot: Abbruch, Moral −10, 3 Spieltage Sperre", () => {
    const s = game();
    const p = s.players[own(s).squad[5]];
    const morale = p.morale;
    startContractTalk(s, mgr(s).id, p.id, 1_000, 2);
    expect(last(s).status).toBe("aborted");
    expect(p.morale).toBe(morale - 10);
    expect(p.talkCooldown).toBe(3);
    expect(startContractTalk(s, mgr(s).id, p.id, 1_000_000, 2)).toBe(`${p.lastName} will erst in 3 Spieltagen wieder verhandeln.`);
  });

  it("in Runde 3 ist das letzte Wort endgültig", () => {
    const s = game();
    const p = s.players[own(s).squad[6]];
    const ask = salaryDemand(s, p, own(s).id);
    startContractTalk(s, mgr(s).id, p.id, Math.round(ask * 0.8), 3);
    const n = last(s);
    respondNegotiation(s, mgr(s).id, n.id, { amount: Math.round(n.ask * 0.9), years: 3 });
    expect(n.round).toBe(3);
    expect(n.note).toContain("Letztes Wort");
    respondNegotiation(s, mgr(s).id, n.id, { amount: n.ask - 100, years: 3 });
    expect(n.status).toBe("aborted");
  });

  it("nur eine Verhandlung pro Spieler, falsche Eingaben werden abgelehnt", () => {
    const s = game();
    const p = s.players[own(s).squad[7]];
    const ask = salaryDemand(s, p, own(s).id);
    startContractTalk(s, mgr(s).id, p.id, Math.round(ask * 0.85), 3);
    expect(openNegotiationFor(s, p.id)).toBeDefined();
    expect(startContractTalk(s, mgr(s).id, p.id, ask, 3)).toBe("Mit diesem Spieler wird schon verhandelt.");
    expect(startContractTalk(s, mgr(s).id, own(s).squad[8], ask, 9)).toBe("Die Laufzeit muss 1 bis 5 Jahre betragen.");
    expect(startContractTalk(s, mgr(s).id, own(s).squad[8], -1, 2)).toBe("Der Betrag muss eine positive ganze Zahl sein.");
    const other = Object.values(s.clubs).find((c) => c.managerId === null)!.squad[0];
    expect(startContractTalk(s, mgr(s).id, other, ask, 2)).toBe("Der Spieler steht bei einem anderen Verein unter Vertrag.");
  });
});

describe("Vereinslose Spieler", () => {
  it("unterschreiben direkt beim Verein, solange der Kader nicht voll ist", () => {
    const s = game();
    const free = Object.values(s.players).find((p) => p.clubId === null && !p.retired)!;
    const club = own(s);
    expect(startContractTalk(s, mgr(s).id, free.id, salaryDemand(s, free, club.id), desiredYears(free))).toBeNull();
    expect(club.squad).toContain(free.id);
    const free2 = Object.values(s.players).find((p) => p.clubId === null && !p.retired)!;
    while (club.squad.length < 32) club.squad.push(club.squad[0]);
    expect(startContractTalk(s, mgr(s).id, free2.id, 50_000, 2)).toBe("Der Kader ist voll (höchstens 32 Spieler).");
  });
});

describe("Kadergrenzen beim Abschluss", () => {
  it("voller Kader beim Abschluss bricht die Verhandlung ab", () => {
    const s = game();
    const free = Object.values(s.players).find((p) => p.clubId === null && !p.retired)!;
    const club = own(s);
    const ask = salaryDemand(s, free, club.id);
    startContractTalk(s, mgr(s).id, free.id, Math.round(ask * 0.85), desiredYears(free));
    const n = last(s);
    expect(n.status).toBe("open");
    while (club.squad.length < 32) club.squad.push(club.squad[0]);
    expect(respondNegotiation(s, mgr(s).id, n.id, "accept")).toBeNull();
    expect(n.status).toBe("aborted");
    expect(n.note).toBe("Der Kader ist voll (höchstens 32 Spieler).");
    expect(club.squad).toHaveLength(32);
  });

  it("eine zweite offene Verhandlung um denselben Spieler wird nach dem Wechsel abgebrochen", () => {
    const s = game(["Anna", "Ben"]);
    const seller = Object.values(s.clubs).find((c) => c.managerId === null && s.competitions[COMP.first].clubs.includes(c.id))!;
    const p = s.players[seller.squad[12]];
    own(s).finance.balance = 50_000_000;
    startTransferTalk(s, mgr(s).id, p.id, askingFee(s, p));
    const annas = last(s);
    s.negotiations.push({ ...annas, id: "dup", managerId: mgr(s, 1).id, status: "open" });
    expect(respondNegotiation(s, mgr(s).id, annas.id, "accept")).toBeNull();
    expect(annas.status).toBe("accepted");
    expect(s.negotiations.find((x) => x.id === "dup")!.status).toBe("aborted");
  });
});

describe("Transferverhandlung", () => {
  function aiTarget(s: GameState) {
    const seller = Object.values(s.clubs).find((c) => c.managerId === null && s.competitions[COMP.first].clubs.includes(c.id))!;
    return { seller, p: s.players[seller.squad[12]] };
  }

  it("erst Ablöse, dann Gehalt; danach wechselt der Spieler mit Vertrag", () => {
    const s = game();
    const { seller, p } = aiTarget(s);
    const fee = askingFee(s, p);
    const buyer = own(s);
    buyer.finance.balance = 50_000_000;
    const before = { buyer: buyer.finance.balance, seller: seller.finance.balance };
    expect(startTransferTalk(s, mgr(s).id, p.id, fee)).toBeNull();
    const n = last(s);
    expect(n.stage).toBe("salary");
    expect(n.fee).toBe(fee);
    expect(n.note).toContain("akzeptiert");
    expect(respondNegotiation(s, mgr(s).id, n.id, "accept")).toBeNull();
    expect(n.status).toBe("accepted");
    expect(buyer.squad).toContain(p.id);
    expect(seller.squad).not.toContain(p.id);
    expect(p.contract).not.toBeNull();
    expect(buyer.finance.balance).toBe(before.buyer - fee);
    expect(seller.finance.balance).toBe(before.seller + fee);
  });

  it("außerhalb des Fensters, bei fehlendem Geld und bei anderen Managern geht nichts", () => {
    const s = game(["Anna", "Ben"]);
    const { p } = aiTarget(s);
    own(s).finance.balance = -100_000_000;
    expect(startTransferTalk(s, mgr(s).id, p.id, 1_000_000)).toBe("Dafür reicht das Geld nicht.");
    own(s).finance.balance = 50_000_000;
    const benPlayer = s.clubs[mgr(s, 1).clubId!].squad[0];
    expect(startTransferTalk(s, mgr(s).id, benPlayer, 1_000_000)).toBe("Mit Vereinen anderer Manager wird nicht verhandelt.");
    expect(startTransferTalk(s, mgr(s).id, own(s).squad[0], 1_000_000)).toBe("Der Spieler gehört schon zu deinem Verein.");
    const free = Object.values(s.players).find((x) => x.clubId === null && !x.retired)!;
    expect(startTransferTalk(s, mgr(s).id, free.id, 1_000)).toBe("Der Spieler ist vereinslos – biete ihm direkt einen Vertrag an.");
    s.calendarIndex = 5;
    expect(startTransferTalk(s, mgr(s).id, p.id, 1_000_000)).toBe("Das Transferfenster ist geschlossen.");
  });

  it("nur eine offene Verhandlung pro Spieler, auch zwischen zwei Managern", () => {
    const s = game(["Anna", "Ben"]);
    const { p } = aiTarget(s);
    const fee = askingFee(s, p);
    for (const m of s.managers) s.clubs[m.clubId!].finance.balance = 100_000_000;
    startTransferTalk(s, mgr(s, 1).id, p.id, Math.round(fee * 0.8));
    const bens = last(s);
    expect(bens.status).toBe("open");
    // Anna verhandelt parallel nicht (nur eine offene Verhandlung pro Spieler) …
    expect(startTransferTalk(s, mgr(s).id, p.id, fee)).toBe("Mit diesem Spieler wird schon verhandelt.");
    // … Ben schließt ab, danach ist der Spieler weg
    respondNegotiation(s, mgr(s, 1).id, bens.id, "accept");
    respondNegotiation(s, mgr(s, 1).id, bens.id, "accept");
    expect(bens.status).toBe("accepted");
    expect(p.clubId).toBe(mgr(s, 1).clubId);
  });

  it("Antworten auf fremde, unbekannte oder beendete Verhandlungen werden abgelehnt", () => {
    const s = game(["Anna", "Ben"]);
    const p = s.players[own(s).squad[9]];
    startContractTalk(s, mgr(s).id, p.id, Math.round(salaryDemand(s, p, own(s).id) * 0.85), 3);
    const n = last(s);
    expect(respondNegotiation(s, mgr(s, 1).id, n.id, "accept")).toBe("Diese Verhandlung gibt es nicht.");
    expect(respondNegotiation(s, mgr(s).id, "x", "accept")).toBe("Diese Verhandlung gibt es nicht.");
    expect(respondNegotiation(s, mgr(s).id, n.id, "abort")).toBeNull();
    expect(n.status).toBe("aborted");
    expect(respondNegotiation(s, mgr(s).id, n.id, "accept")).toBe("Diese Verhandlung ist schon beendet.");
  });
});

describe("cleanupNegotiations", () => {
  it("entfernt beendete und abgelaufene Verhandlungen", () => {
    const s = game();
    const club = own(s);
    const [a, b] = [s.players[club.squad[10]], s.players[club.squad[11]]];
    startContractTalk(s, mgr(s).id, a.id, salaryDemand(s, a, club.id), desiredYears(a));
    startContractTalk(s, mgr(s).id, b.id, Math.round(salaryDemand(s, b, club.id) * 0.85), 3);
    expect(s.negotiations).toHaveLength(2);
    cleanupNegotiations(s);
    expect(s.negotiations).toHaveLength(1);
    s.calendarIndex = 2;
    cleanupNegotiations(s);
    expect(s.negotiations).toHaveLength(0);
  });
});
