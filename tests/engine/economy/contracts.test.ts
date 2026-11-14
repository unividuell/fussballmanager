import { describe, expect, it } from "vitest";
import {
  aiRenewals,
  applyRelegationClauses,
  contractEnd,
  desiredYears,
  evaluateOffer,
  expireContracts,
  expiringNotices,
  releasePlayer,
  remainingMatchdays,
  salaryDemand,
  severance,
  signContract,
  tickCooldowns,
  validateYears,
  yearsAdjusted,
} from "../../../src/engine/economy/contracts";
import { WAGE_FACTOR, salaryFor, startBalance } from "../../../src/engine/economy/money";
import { generateWorld } from "../../../src/engine/generator";
import { COMP } from "../../../src/engine/model";
import { startNewGame } from "../../../src/engine/season";
import { autoLineup } from "../../../src/engine/lineup";
import { makePlayer, makeState } from "../fixtures";

function withManager() {
  const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
  s.managers.push({ id: "m1", name: "Anna", clubId: "c1" });
  s.clubs.c1.managerId = "m1";
  for (const c of ["c1", "c2"]) s.clubs[c].lineup = autoLineup(s, c, "4-4-2");
  return s;
}

describe("Forderung", () => {
  it("Wunschlaufzeit nach Alter", () => {
    expect(desiredYears(makePlayer("a", "MF", 60, { age: 20 }))).toBe(4);
    expect(desiredYears(makePlayer("a", "MF", 60, { age: 27 }))).toBe(3);
    expect(desiredYears(makePlayer("a", "MF", 60, { age: 31 }))).toBe(2);
    expect(desiredYears(makePlayer("a", "MF", 60, { age: 34 }))).toBe(1);
  });

  it("stärker, größerer Verein und schlechte Laune = höhere Forderung; Alter ab 31 senkt", () => {
    const s = withManager();
    const p = s.players["c1-MF1"];
    const base = salaryDemand(s, p, "c1");
    expect(base).toBe(Math.round((salaryFor(60) * (0.8 + 0.4 * 0.5) * (1.15 - 0.3 * 0.6)) / 100) * 100);
    expect(salaryDemand(s, { ...p, strength: 70 }, "c1")).toBeGreaterThan(base);
    s.clubs.c2.reputation = 90;
    expect(salaryDemand(s, p, "c2")).toBeGreaterThan(base);
    expect(salaryDemand(s, { ...p, morale: 10 }, "c1")).toBeGreaterThan(base);
    expect(salaryDemand(s, { ...p, age: 31 }, "c1")).toBeLessThan(base);
  });

  it("wer kaum spielt, fordert weniger", () => {
    const s = withManager();
    s.calendarIndex = 12;
    const p = s.players["c1-MF8"];
    expect(salaryDemand(s, { ...p, stats: { apps: 1, goals: 0 } }, "c1")).toBeLessThan(salaryDemand(s, { ...p, stats: { apps: 10, goals: 0 } }, "c1"));
  });

  it("Laufzeit-Abweichung kostet 5 % pro Jahr; Laufzeit 1–5", () => {
    expect(yearsAdjusted(10_000, 3, 3)).toBe(10_000);
    expect(yearsAdjusted(10_000, 1, 3)).toBe(11_000);
    expect(validateYears(3)).toBeNull();
    expect(validateYears(0)).toBe("Die Laufzeit muss 1 bis 5 Jahre betragen.");
    expect(validateYears(6)).not.toBeNull();
    expect(validateYears(2.5)).not.toBeNull();
  });
});

describe("evaluateOffer", () => {
  it("nimmt an, kontert, bricht ab", () => {
    expect(evaluateOffer(10_000, 10_000, 1)).toEqual({ kind: "accepted", amount: 10_000 });
    expect(evaluateOffer(12_000, 10_000, 2)).toEqual({ kind: "accepted", amount: 12_000 });
    expect(evaluateOffer(8_000, 10_000, 1)).toEqual({ kind: "counter", amount: 9_300, round: 2 });
    expect(evaluateOffer(6_900, 10_000, 1)).toEqual({ kind: "aborted" });
    expect(evaluateOffer(9_999, 10_000, 3)).toEqual({ kind: "aborted" });
  });
});

describe("Verträge", () => {
  it("Vertragsende hängt davon ab, ob die Saison schon läuft", () => {
    const s = withManager();
    expect(contractEnd(s, 2)).toBe(2);
    s.calendarIndex = 5;
    expect(contractEnd(s, 2)).toBe(3);
  });

  it("signContract: Vereinsloser kommt in den Kader, Moral steigt, Transferliste weg", () => {
    const s = withManager();
    s.players.free = makePlayer("free", "FW", 65, { clubId: null, contract: null, morale: 95, transferListed: { askingPrice: null }, talkCooldown: 2 });
    signContract(s, "free", "c1", 12_000, 3);
    expect(s.clubs.c1.squad).toContain("free");
    expect(s.players.free).toMatchObject({ clubId: "c1", contract: { salary: 12_000, endsSeason: 3 }, morale: 100, transferListed: null, talkCooldown: 0 });
  });

  it("signContract mit Spieler eines anderen Vereins nimmt ihn dort heraus", () => {
    const s = withManager();
    signContract(s, "c2-FW1", "c1", 9_000, 2);
    expect(s.clubs.c2.squad).not.toContain("c2-FW1");
    expect(s.clubs.c1.squad).toContain("c2-FW1");
  });

  it("Entlassung kostet die halbe Restsumme und macht den Spieler vereinslos", () => {
    const s = withManager();
    s.calendarIndex = 10;
    const p = s.players["c1-MF7"];
    p.contract = { salary: 4_000, endsSeason: 2 };
    expect(remainingMatchdays(s, p)).toBe(34 + 24);
    expect(severance(s, p)).toBe(Math.round((4_000 * 58 * 0.5) / 100) * 100);
    const before = s.clubs.c1.finance.balance;
    expect(releasePlayer(s, "c1", "c1-MF7")).toBeNull();
    expect(s.clubs.c1.finance.balance).toBe(before - 116_000);
    expect(s.players["c1-MF7"].clubId).toBeNull();
    expect(releasePlayer(s, "c1", "c2-MF1")).toBe("Der Spieler gehört nicht zum Kader.");
  });

  it("auslaufende Verträge enden am Saisonende mit Nachricht an den Manager", () => {
    const s = withManager();
    s.players["c1-DF1"].contract = { salary: 1, endsSeason: 1 };
    s.players["c2-DF1"].contract = { salary: 1, endsSeason: 1 };
    s.players["c1-DF2"].contract = { salary: 1, endsSeason: 2 };
    expect(expireContracts(s).sort()).toEqual(["c1-DF1", "c2-DF1"]);
    expect(s.clubs.c1.squad).not.toContain("c1-DF1");
    expect(s.clubs.c1.squad).toContain("c1-DF2");
    expect(s.messages.filter((m) => m.text.includes("ausgelaufen"))).toHaveLength(1);
  });

  it("Hinweis auf auslaufende Verträge bei Kalenderindex 24, nur an Manager", () => {
    const s = withManager();
    s.players["c1-GK1"].contract = { salary: 1, endsSeason: 1 };
    s.players["c2-GK1"].contract = { salary: 1, endsSeason: 1 };
    s.calendarIndex = 23;
    expiringNotices(s);
    expect(s.messages).toHaveLength(0);
    s.calendarIndex = 24;
    expiringNotices(s);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].text).toContain(s.players["c1-GK1"].lastName);
  });

  it("die KI verlängert Leistungsträger, nicht alte oder schwache Spieler", () => {
    const s = withManager();
    s.calendarIndex = 25;
    Object.assign(s.players["c2-MF1"], { contract: { salary: 1, endsSeason: 1 }, strength: 65 });
    Object.assign(s.players["c2-MF2"], { contract: { salary: 1, endsSeason: 1 }, age: 33 });
    Object.assign(s.players["c2-MF3"], { contract: { salary: 1, endsSeason: 1 }, strength: 40 });
    Object.assign(s.players["c1-MF1"], { contract: { salary: 1, endsSeason: 1 } });
    aiRenewals(s);
    expect(s.players["c2-MF1"].contract!.endsSeason).toBeGreaterThan(1);
    expect(s.players["c2-MF2"].contract!.endsSeason).toBe(1);
    expect(s.players["c2-MF3"].contract!.endsSeason).toBe(1);
    expect(s.players["c1-MF1"].contract!.endsSeason).toBe(1);
  });

  it("eine KI im Minus verlängert nur, solange die Gehälter ins Budget passen", () => {
    const s = withManager();
    s.calendarIndex = 25;
    s.clubs.c2.finance.balance = -1;
    Object.assign(s.players["c2-MF1"], { contract: { salary: 1, endsSeason: 1 }, strength: 65 });
    for (const id of s.clubs.c2.squad) if (id !== "c2-MF1") s.players[id].contract = { salary: 10_000_000, endsSeason: 9 };
    aiRenewals(s);
    expect(s.players["c2-MF1"].contract!.endsSeason).toBe(1);
  });

  it("eine KI ohne Polster (unter einem Startkapital) verlängert nur im Gehaltsbudget, mit Polster frei", () => {
    const s = withManager();
    s.calendarIndex = 25;
    Object.assign(s.players["c2-MF1"], { contract: { salary: 1, endsSeason: 1 }, strength: 65 });
    for (const id of s.clubs.c2.squad) if (id !== "c2-MF1") s.players[id].contract = { salary: 10_000_000, endsSeason: 9 };
    s.clubs.c2.finance.balance = startBalance(s.clubs.c2.reputation) - 1;
    aiRenewals(s);
    expect(s.players["c2-MF1"].contract!.endsSeason).toBe(1);
    s.clubs.c2.finance.balance = startBalance(s.clubs.c2.reputation);
    aiRenewals(s);
    expect(s.players["c2-MF1"].contract!.endsSeason).toBeGreaterThan(1);
  });

  it("Sperrzeiten für Verhandlungen laufen ab", () => {
    const s = withManager();
    s.players["c1-MF1"].talkCooldown = 2;
    tickCooldowns(s);
    expect(s.players["c1-MF1"].talkCooldown).toBe(1);
    tickCooldowns(s);
    tickCooldowns(s);
    expect(s.players["c1-MF1"].talkCooldown).toBe(0);
  });
});

describe("signContract räumt Konkurrenz um einen Vereinslosen ab", () => {
  it("bricht andere offene Verhandlungen ab und zieht Angebote zurück", () => {
    const s = withManager();
    s.players["c2-MF1"].clubId = null;
    s.clubs.c2.squad = s.clubs.c2.squad.filter((id) => id !== "c2-MF1");
    const talk = (id: string, status: "open" | "accepted") => ({ id, managerId: "m1", playerId: "c2-MF1", stage: "salary" as const, fee: null, ask: 1, round: 1, desiredYears: 2, status, note: "", season: 1, createdAt: 0 });
    s.negotiations.push(talk("n1", "open"), talk("n2", "accepted"));
    s.transferOffers.push({ id: "o1", managerId: "m1", fromClub: "c2", playerId: "c2-MF1", fee: 1, maxFee: 2, round: 1, status: "open", season: 1, expiresAfter: 0 });
    signContract(s, "c2-MF1", "c2", 1000, 2);
    expect(s.negotiations[0].status).toBe("aborted");
    expect(s.negotiations[0].note).toBe(`${s.players["c2-MF1"].firstName} ${s.players["c2-MF1"].lastName} ist nicht mehr verfügbar.`);
    expect(s.negotiations[1].status).toBe("accepted");
    expect(s.transferOffers[0].status).toBe("withdrawn");
  });
});

describe("Gehälter nach Liga", () => {
  it("ein Spieler fordert bei einem Drittligisten weniger als bei einem gleich großen Zweitligisten", () => {
    const world = generateWorld(9);
    const r = startNewGame(world, [{ name: "A", clubId: Object.keys(world.clubs)[0] }]);
    if (!r.ok) throw new Error(r.error);
    const s = r.state;
    const l2 = s.competitions[COMP.second].clubs[5];
    const l3 = s.competitions[COMP.third].clubs[5];
    s.clubs[l3].reputation = s.clubs[l2].reputation;
    const p = s.players[s.clubs[l3].squad[0]];
    expect(salaryDemand(s, p, l3)).toBeLessThan(salaryDemand(s, p, l2));
    expect(WAGE_FACTOR[2]).toBeLessThan(WAGE_FACTOR[1]);
  });

  it("Drittligisten starten mit niedrigeren Gehältern als dem Grundgehalt", () => {
    const world = generateWorld(9);
    const club = Object.values(world.clubs).find((c) => c.name === "TSV Havelse")!;
    for (const id of club.squad) {
      const p = world.players[id];
      expect(p.contract!.salary).toBeLessThan(salaryFor(p.strength));
    }
  });
});

describe("Abstiegsklausel", () => {
  it("beim Abstieg sinken alle Gehälter auf das Niveau der neuen Liga, beim Aufstieg ändert sich nichts", () => {
    const world = generateWorld(9);
    const r = startNewGame(world, [{ name: "A", clubId: Object.keys(world.clubs)[0] }]);
    if (!r.ok) throw new Error(r.error);
    const s = r.state;
    const down = s.competitions[COMP.first].clubs[5];
    const up = s.competitions[COMP.second].clubs[5];
    const before = (id: string) => s.clubs[id].squad.map((p) => s.players[p].contract!.salary);
    const [downBefore, upBefore] = [before(down), before(up)];
    applyRelegationClauses(s, [{ upper: COMP.first, lower: COMP.second, promoted: [up], relegated: [down] }]);
    const factor = WAGE_FACTOR[1] / WAGE_FACTOR[0];
    s.clubs[down].squad.forEach((p, i) => expect(s.players[p].contract!.salary).toBe(Math.round((downBefore[i] * factor) / 100) * 100));
    expect(before(up)).toEqual(upBefore);
  });

  it("der Manager eines Absteigers bekommt eine Nachricht", () => {
    const world = generateWorld(9);
    const own = Object.values(world.clubs).find((c) => c.name === "FC Augsburg")!.id;
    const r = startNewGame(world, [{ name: "A", clubId: own }]);
    if (!r.ok) throw new Error(r.error);
    const s = r.state;
    applyRelegationClauses(s, [{ upper: COMP.first, lower: COMP.second, promoted: [], relegated: [own] }]);
    expect(s.messages.some((m) => m.managerId === s.managers[0].id && m.text.startsWith("Abstiegsklausel"))).toBe(true);
  });
});
