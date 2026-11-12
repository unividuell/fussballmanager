import { describe, expect, it } from "vitest";
import { isOverLimit } from "../../src/engine/economy/money";
import { generateWorld } from "../../src/engine/generator";
import { COMP, type GameState } from "../../src/engine/model";
import { finishSeason, isSeasonOver, playMatchdayAuto, startNewGame } from "../../src/engine/season";
import { salaryDemand, signContract } from "../../src/engine/economy/contracts";
import { attendance } from "../../src/engine/economy/stadium";
import { autoLineup } from "../../src/engine/lineup";
import { runSeasons } from "./measure";

function starterAvg(s: GameState, league: string): number {
  const clubs = s.competitions[league].clubs.map((id) => s.clubs[id]);
  const values = clubs.flatMap((c) => c.lineup.starters.map((id) => s.players[id]?.strength ?? 0));
  return values.reduce((x, y) => x + y, 0) / values.length;
}

describe("Langzeittest: Wirtschaft über 10 Saisons", () => {
  it("bleibt stabil", { timeout: 600_000 }, () => {
    const world = generateWorld(2027);
    const r = startNewGame(world, [{ name: "Test", clubId: Object.keys(world.clubs)[12] }]);
    if (!r.ok) throw new Error(r.error);
    let s: GameState = r.state;
    const startL1 = starterAvg(s, COMP.first);
    const startL2 = starterAvg(s, COMP.second);
    const report: string[] = [`Start: L1 ${startL1.toFixed(1)}, L2 ${startL2.toFixed(1)}`];

    try {
    for (let season = 1; season <= 10; season++) {
      while (!isSeasonOver(s)) s = playMatchdayAuto(s);
      s = finishSeason(s).state;

      const clubs = Object.values(s.clubs);
      const balances = clubs.map((c) => c.finance.balance).sort((a, b) => a - b);
      const median = balances[Math.floor(balances.length / 2)];
      const over = clubs.filter(isOverLimit).length;
      const free = Object.values(s.players).filter((p) => p.clubId === null && !p.retired).length;
      const active = Object.values(s.players).filter((p) => !p.retired).length;
      const l1 = starterAvg(s, COMP.first);
      const l2 = starterAvg(s, COMP.second);
      const withPlayers = clubs.filter((c) => c.managerId === null && c.squad.length >= 1);
      const meanSquad = withPlayers.reduce((a, c) => a + c.squad.length, 0) / withPlayers.length;
      report.push(`Saison ${season}: Median ${median}, über Limit ${over}, frei ${free}, aktiv ${active}, L1 ${l1.toFixed(1)}, L2 ${l2.toFixed(1)}, Kader ${meanSquad.toFixed(1)}, Spieler ${Object.keys(s.players).length}, dL2 ${(l2 - startL2).toFixed(1)}`);

      for (const c of clubs) {
        expect(Number.isFinite(c.finance.balance)).toBe(true);
        expect(c.squad.length).toBeLessThanOrEqual(32);
        if (c.managerId === null) expect(c.squad.length).toBeGreaterThanOrEqual(18);
        for (const id of c.squad) expect(s.players[id].clubId).toBe(c.id);
      }
      expect(over).toBeLessThanOrEqual(6);
      expect(meanSquad).toBeGreaterThanOrEqual(20);
      expect(median).toBeGreaterThan(-3_000_000);
      expect(median).toBeLessThan(60_000_000);
      expect(free).toBeGreaterThanOrEqual(5);
      expect(free).toBeLessThanOrEqual(150);
      expect(l1).toBeGreaterThan(l2 + 3);
      expect(Math.abs(l1 - startL1)).toBeLessThan(5);
      expect(active).toBeLessThan(2_000);
      expect(Object.keys(s.players).length).toBeLessThan(1500);
      expect(Math.abs(l2 - startL2)).toBeLessThanOrEqual(10);
      for (const m of s.managers) expect(s.messages.filter((x) => x.managerId === m.id).length).toBeLessThanOrEqual(60);
    }
    } finally {
      console.log(report.join("\n"));
    }
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe("Langzeittest: Manager bleiben bei ihrem Verein", () => {
  it("Manager bleiben bei ihrem Verein – in Saison 1 bei 8 verschiedenen Startvereinen", { timeout: 300_000 }, () => {
    for (let i = 0; i < 8; i++) {
      const world = generateWorld(13);
      const start = Object.keys(world.clubs)[i];
      const r = startNewGame(world, [{ name: "Test", clubId: start }]);
      if (!r.ok) throw new Error(r.error);
      let s: GameState = r.state;
      while (!isSeasonOver(s)) {
        s = playMatchdayAuto(s);
        expect(s.managers[0].clubId).toBe(start);
        expect(s.clubs[start].managerId).toBe(s.managers[0].id);
      }
      s = finishSeason(s).state;
      expect(s.managers[0].clubId).toBe(start);
      expect(s.clubs[start].managerId).toBe(s.managers[0].id);
    }
  });
});

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const M = (x: number) => `${(x / 1e6).toFixed(1)} Mio`;

/** Ein vernünftiger Manager: beste Elf, erlösbester Eintrittspreis gegen einen typischen Gegner, Stammspieler werden verlängert, keine Transfers. */
function sensibleManagers(s: GameState): void {
  for (const m of s.managers) {
    const id = m.clubId;
    const club = s.clubs[id];
    club.lineup = autoLineup(s, id, club.tactics.formation);
    const league = s.competitions[COMP.first].clubs.includes(id) ? COMP.first : COMP.second;
    const typical = s.competitions[league].clubs.filter((x) => x !== id)[8];
    let bestPrice = club.finance.ticketPrice;
    let bestRevenue = -1;
    for (let price = 5; price <= 100; price++) {
      club.finance.ticketPrice = price;
      const revenue = attendance(s, id, typical) * price;
      if (revenue > bestRevenue) [bestPrice, bestRevenue] = [price, revenue];
    }
    club.finance.ticketPrice = bestPrice;
    if (s.calendarIndex !== 33) continue;
    for (const pid of club.lineup.starters) {
      const p = s.players[pid];
      if (p.contract && p.contract.endsSeason <= s.season) signContract(s, pid, id, salaryDemand(s, p, id), 2);
    }
  }
}

function referenceClubs(seed: number) {
  const world = generateWorld(seed);
  const ids = Object.values(world.clubs).sort((a, b) => b.reputation - a.reputation).map((c) => c.id);
  return [
    { name: "groß", clubId: ids[0] },
    { name: "mittel", clubId: ids[8] },
    { name: "Zweitliga-Mitte", clubId: ids[26] },
    { name: "Zweitliga-klein", clubId: ids[35] },
  ];
}

describe("Langzeittest: Zielkorridore der Wirtschaft (Spec 2026-11-12, 4.1 und 5.1)", () => {
  it("KI: Geldmenge, Dispo, Auslastung und Marktwerte bleiben in den Korridoren", { timeout: 900_000 }, () => {
    const { metrics, start, state } = runSeasons(2027, 10);
    const rep = (id: string) => state.clubs[id].reputation;
    const report: string[] = [`Start-Median ${M(start.aiMedianBalance)}`];
    const utilTop: number[] = [];
    const utilBottom: number[] = [];
    for (const m of metrics) {
      const l1 = m.tables[COMP.first];
      const byRep = [...l1].sort((a, b) => rep(b) - rep(a));
      utilTop.push(mean(byRep.slice(0, 3).map((id) => m.utilization[id])));
      utilBottom.push(mean(l1.slice(-3).map((id) => m.utilization[id])));
      report.push(`Saison ${m.season}: Median ${M(m.aiMedianBalance)}, Max ${M(m.aiMaxBalance)}, über Limit ${m.aiOverLimit}, Spitze MW ${M(m.topMarketValues[0])}`);
    }
    report.push(`Auslastung: Top 3 ${mean(utilTop).toFixed(2)}, letzte 3 ${mean(utilBottom).toFixed(2)}`);
    console.log(report.join("\n"));

    for (const m of metrics) {
      expect(m.aiMedianBalance).toBeGreaterThanOrEqual(0.7 * start.aiMedianBalance);
      expect(m.aiMedianBalance).toBeLessThanOrEqual(2.5 * start.aiMedianBalance);
      expect(m.aiMaxBalance).toBeLessThanOrEqual(40_000_000);
      expect(m.aiOverLimit).toBeLessThanOrEqual(1);
      expect(m.topMarketValues[0]).toBeGreaterThanOrEqual(15_000_000);
      expect(m.topMarketValues[0]).toBeLessThanOrEqual(30_000_000);
    }
    expect(metrics[9].aiMedianBalance).toBeLessThanOrEqual(1.5 * metrics[4].aiMedianBalance);
    expect(mean(utilTop)).toBeGreaterThanOrEqual(0.9);
    expect(mean(utilBottom)).toBeLessThan(0.85);
  });

  // Spec 4.1 misst das Ergebnis „mit einem gewöhnlichen, gepflegten Kader“. KI-Vereine stecken Überschüsse in Spieler,
  // deshalb wird an Referenzvereinen gemessen, die ein vernünftiger Manager führt. „Etwa“: ±10 % Toleranz.
  it("Referenzvereine: Ergebnis vor Transfers je Vereinsgröße", { timeout: 900_000 }, () => {
    const results: Record<string, number[]> = {};
    for (const seed of [2027, 11, 4242]) {
      const picks = referenceClubs(seed);
      const { metrics } = runSeasons(seed, 4, picks, sensibleManagers);
      for (const p of picks) for (const m of metrics) (results[p.name] ??= []).push(m.resultBeforeTransfers[p.clubId]);
    }
    console.log(Object.entries(results).map(([k, v]) => `${k}: Ø ${M(mean(v))}, min ${M(Math.min(...v))}`).join("\n"));
    expect(mean(results["groß"])).toBeGreaterThanOrEqual(0.9 * 8_000_000);
    expect(mean(results["groß"])).toBeLessThanOrEqual(1.1 * 12_000_000);
    expect(mean(results["mittel"])).toBeGreaterThanOrEqual(0.9 * 2_000_000);
    expect(mean(results["mittel"])).toBeLessThanOrEqual(1.1 * 5_000_000);
    for (const name of ["Zweitliga-Mitte", "Zweitliga-klein"]) {
      expect(mean(results[name])).toBeGreaterThanOrEqual(0);
      expect(mean(results[name])).toBeLessThanOrEqual(1.1 * 2_000_000);
    }
  });

  it("großer Erstligist kann nach höchstens 2 Saisons 20 Mio zahlen", { timeout: 300_000 }, () => {
    for (const seed of [2027, 11, 4242]) {
      const [big] = referenceClubs(seed);
      const { state } = runSeasons(seed, 2, [big], sensibleManagers);
      console.log(`Seed ${seed}: Kontostand nach 2 Saisons ${M(state.clubs[big.clubId].finance.balance)}`);
      expect(state.clubs[big.clubId].finance.balance).toBeGreaterThanOrEqual(20_000_000);
    }
  });
});
