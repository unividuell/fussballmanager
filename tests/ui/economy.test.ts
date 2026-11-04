import { describe, expect, it } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import type { GameState } from "../../src/engine/model";
import { playMatchdayAuto, startNewGame } from "../../src/engine/season";
import {
  DEFAULT_FILTER,
  contractRows,
  latestNegotiation,
  ledgerSummary,
  marketRows,
  messageLabel,
  openOffers,
  parseEuro,
  potentialStars,
} from "../../src/ui/logic/economy";
import { makePlayer } from "../engine/fixtures";

function game(names = ["Anna", "Ben"]): GameState {
  const world = generateWorld(81);
  const ids = Object.keys(world.clubs);
  const r = startNewGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const own = (s: GameState) => s.clubs[s.managers[0].clubId];

describe("ledgerSummary", () => {
  it("summiert die Saison und den letzten Spieltag je Kategorie", () => {
    const s = playMatchdayAuto(playMatchdayAuto(game()));
    const club = own(s);
    const sum = ledgerSummary(club, s.calendarIndex);
    expect(sum.lastIndex).toBe(1);
    const tv = sum.lines.find((l) => l.category === "tv")!;
    expect(tv.label).toBe("TV-Geld");
    expect(tv.season).toBe(2 * tv.lastMatchday);
    expect(sum.seasonTotal).toBe(club.finance.ledger.reduce((x, e) => x + e.amount, 0));
    expect(sum.lines.every((l) => l.season !== 0 || l.lastMatchday !== 0)).toBe(true);
  });

  it("eine Buchung im laufenden Spieltag verdeckt den letzten Spieltag nicht", () => {
    const s = playMatchdayAuto(playMatchdayAuto(game()));
    const club = own(s);
    const before = ledgerSummary(club, s.calendarIndex).lines.find((l) => l.category === "tv")!;
    club.finance.ledger.push({ calendarIndex: s.calendarIndex, category: "tv", amount: 7_000 }); // Testaufbau
    const after = ledgerSummary(club, s.calendarIndex);
    const tv = after.lines.find((l) => l.category === "tv")!;
    expect(after.lastIndex).toBe(s.calendarIndex - 1);
    expect(tv.lastMatchday).toBe(before.lastMatchday);
    expect(tv.season).toBe(before.season + 7_000);
  });

  it("ohne Buchungen: leer", () => {
    const g = game();
    expect(ledgerSummary(own(g), g.calendarIndex).lines).toEqual([]);
  });
});

describe("parseEuro", () => {
  it("liest deutsch formatierte Beträge", () => {
    expect(parseEuro("500.000")).toBe(500_000);
    expect(parseEuro("1.500.000 €")).toBe(1_500_000);
    expect(parseEuro("12000")).toBe(12_000);
    expect(parseEuro("12.000,50")).toBe(12_000);
    expect(parseEuro("12.000,00")).toBe(12_000);
    expect(parseEuro("")).toBeNull();
    expect(parseEuro("  ")).toBeNull();
    expect(parseEuro("abc")).toBeNull();
    expect(parseEuro("-5")).toBeNull();
  });
});

describe("contractRows", () => {
  it("listet den Kader nach Vertragsende, markiert auslaufende Verträge", () => {
    const s = game();
    const rows = contractRows(s, own(s).id);
    expect(rows).toHaveLength(own(s).squad.length);
    for (let i = 1; i < rows.length; i++) expect((rows[i - 1].endsSeason ?? 0) <= (rows[i].endsSeason ?? 0)).toBe(true);
    expect(rows.filter((r) => r.expiring).every((r) => r.endsSeason === s.season)).toBe(true);
    expect(rows.every((r) => r.demand > 0 && r.value > 0)).toBe(true);
  });
});

describe("marketRows", () => {
  it("zeigt nur Vereinslose und KI-Spieler, nie eigene oder die anderer Manager", () => {
    const s = game();
    const rows = marketRows(s, own(s).id, DEFAULT_FILTER);
    const humanClubs = new Set<string | null>(s.managers.map((m) => m.clubId));
    expect(rows.length).toBeGreaterThan(150);
    expect(rows.every((r) => !humanClubs.has(r.player.clubId))).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].player.strength).toBeGreaterThanOrEqual(rows[i].player.strength);
  });

  it("filtert nach Position, Vereinslosen, Transferliste und Höchstablöse", () => {
    const s = game();
    const id = own(s).id;
    expect(marketRows(s, id, { ...DEFAULT_FILTER, position: "GK" }).every((r) => r.player.position === "GK")).toBe(true);
    const free = marketRows(s, id, { ...DEFAULT_FILTER, freeOnly: true });
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((r) => r.free && r.fee === 0 && r.clubName === "vereinslos")).toBe(true);
    expect(marketRows(s, id, { ...DEFAULT_FILTER, listedOnly: true })).toEqual([]);
    expect(marketRows(s, id, { ...DEFAULT_FILTER, maxFee: 100_000 }).every((r) => r.fee <= 100_000)).toBe(true);
  });
});

describe("Angebote, Verhandlungen, Beschriftungen", () => {
  it("openOffers und latestNegotiation finden die passenden Einträge", () => {
    const s = game();
    const p = s.players[own(s).squad[3]];
    const buyer = Object.values(s.clubs).find((c) => c.managerId === null)!;
    s.transferOffers.push({ id: "o1", managerId: s.managers[0].id, fromClub: buyer.id, playerId: p.id, fee: 1, maxFee: 2, round: 1, status: "open", season: 1, expiresAfter: 0 });
    s.transferOffers.push({ id: "o2", managerId: s.managers[1].id, fromClub: buyer.id, playerId: p.id, fee: 1, maxFee: 2, round: 1, status: "open", season: 1, expiresAfter: 0 });
    const rows = openOffers(s, s.managers[0].id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ playerName: `${p.firstName} ${p.lastName}`, buyerName: buyer.name });
    const base = { managerId: s.managers[0].id, playerId: p.id, stage: "salary" as const, fee: null, ask: 1, round: 1, desiredYears: 2, note: "", season: 1, createdAt: 0 };
    s.negotiations.push({ ...base, id: "n1", status: "aborted" }, { ...base, id: "n2", status: "open" });
    expect(latestNegotiation(s, s.managers[0].id, p.id)?.id).toBe("n2");
    expect(latestNegotiation(s, s.managers[1].id, p.id)).toBeNull();
  });

  it("messageLabel und potentialStars", () => {
    expect(messageLabel(1, 4)).toBe("S1 · 5. Sp.");
    expect(messageLabel(2, 34)).toBe("S2 · Relegation");
    expect(potentialStars(makePlayer("a", "MF", 50, { potential: 50 }))).toBe("★");
    expect(potentialStars(makePlayer("a", "MF", 50, { potential: 70 }))).toBe("★★★");
    expect(potentialStars(makePlayer("a", "MF", 50, { potential: 90 }))).toBe("★★★★★");
  });
});
