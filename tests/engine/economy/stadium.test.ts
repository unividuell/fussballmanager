import { describe, expect, it } from "vitest";
import { computeStandings } from "../../../src/engine/competition/standings";
import { processMatchday } from "../../../src/engine/economy/processing";
import { AI_BUILD_RESERVE, STADIUM, aiStadiumDecisions, attendance, startPrice, upkeepFor } from "../../../src/engine/economy/stadium";
import { generateWorld } from "../../../src/engine/generator";
import { COMP, type ClubId, type GameState } from "../../../src/engine/model";
import { Rng } from "../../../src/engine/rng";
import { playMatchdayAuto, startNewGame } from "../../../src/engine/season";

function game(): GameState {
  const world = generateWorld(2027);
  const r = startNewGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[30] }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const byReputation = (s: GameState, league: string) =>
  [...s.competitions[league].clubs].sort((a, b) => s.clubs[b].reputation - s.clubs[a].reputation);
const capacity = (s: GameState, id: ClubId) => STADIUM[s.clubs[id].finance.stadiumStage].capacity;
/** ein Gegner aus dem Mittelfeld nach Ruf */
const midOpponent = (s: GameState, league: string) => byReputation(s, league)[9];
const revenue = (s: GameState, id: ClubId, away: ClubId, price: number) => {
  const f = s.clubs[id].finance;
  const old = f.ticketPrice;
  f.ticketPrice = price;
  const r = attendance(s, id, away) * price;
  f.ticketPrice = old;
  return r;
};

describe("Nachfrage und Kapazität", () => {
  it("große Vereine sind zum Start ausverkauft", () => {
    const s = game();
    const opp = midOpponent(s, COMP.first);
    for (const id of byReputation(s, COMP.first).slice(0, 3)) {
      s.clubs[id].finance.ticketPrice = startPrice(s.clubs[id].reputation);
      expect(attendance(s, id, opp)).toBeGreaterThanOrEqual(0.98 * capacity(s, id));
    }
  });

  it("kleine Vereine haben im Startstadion Lücken", () => {
    const s = game();
    // mit echten Vereinen sind die kleinsten Vereine die kleinsten Drittligisten
    const opp = midOpponent(s, COMP.third);
    for (const id of byReputation(s, COMP.third).slice(-3)) {
      s.clubs[id].finance.ticketPrice = startPrice(s.clubs[id].reputation, 2);
      expect(attendance(s, id, opp)).toBeLessThan(0.9 * capacity(s, id));
    }
  });

  it("Abstiegskandidat hat Lücken", { timeout: 60_000 }, () => {
    let s = game();
    for (let i = 0; i < 10; i++) s = playMatchdayAuto(s);
    const table = computeStandings(s.competitions[COMP.first]).map((r) => r.club);
    const id = table[16];
    s.clubs[id].finance.ticketPrice = startPrice(s.clubs[id].reputation);
    expect(attendance(s, id, table[8])).toBeLessThan(0.85 * capacity(s, id));
  });

  it("voll: höherer Preis bringt mehr Erlös", () => {
    const s = game();
    const id = byReputation(s, COMP.first)[0];
    const opp = midOpponent(s, COMP.first);
    const p = startPrice(s.clubs[id].reputation);
    expect(revenue(s, id, opp, p + 5)).toBeGreaterThan(revenue(s, id, opp, p));
  });

  it("leer: niedrigerer Preis bringt mehr Erlös", () => {
    const s = game();
    const opp = midOpponent(s, COMP.second);
    // der Verein mit der geringsten Auslastung zum Startpreis
    const load = (x: ClubId) => {
      s.clubs[x].finance.ticketPrice = startPrice(s.clubs[x].reputation);
      return attendance(s, x, opp) / capacity(s, x);
    };
    const id = [...s.competitions[COMP.first].clubs, ...s.competitions[COMP.second].clubs].sort((a, b) => load(a) - load(b))[0];
    const p = startPrice(s.clubs[id].reputation);
    s.clubs[id].finance.ticketPrice = p;
    expect(attendance(s, id, opp)).toBeLessThan(0.7 * capacity(s, id));
    expect(revenue(s, id, opp, p - 2)).toBeGreaterThan(revenue(s, id, opp, p));
  });

  it("Ausbau bringt einem vollen Verein mehr Zuschauer", () => {
    const s = game();
    const id = byReputation(s, COMP.first)[0];
    const opp = midOpponent(s, COMP.first);
    const f = s.clubs[id].finance;
    f.ticketPrice = startPrice(s.clubs[id].reputation);
    const before = attendance(s, id, opp);
    f.stadiumStage++;
    expect(attendance(s, id, opp)).toBeGreaterThan(before);
  });

  it("extreme Preise bleiben im Rahmen", () => {
    const s = game();
    const opp = midOpponent(s, COMP.first);
    for (const id of [byReputation(s, COMP.first)[0], byReputation(s, COMP.second).at(-1)!]) {
      for (const price of [5, 100]) {
        s.clubs[id].finance.ticketPrice = price;
        const a = attendance(s, id, opp);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(capacity(s, id));
      }
    }
  });
});

describe("KI-Stadion", () => {
  it("KI sucht den erlösbesten Preis: voll → teurer, zu teuer → billiger; Manager bleiben unberührt", () => {
    const s = game();
    s.calendarIndex = 5;
    const full = byReputation(s, COMP.first).find((id) => s.clubs[id].managerId === null)!;
    const weak = byReputation(s, COMP.second).filter((id) => s.clubs[id].managerId === null).at(-1)!;
    const own = s.clubs[s.managers[0].clubId];
    s.clubs[full].finance.ticketPrice = startPrice(s.clubs[full].reputation);
    s.clubs[weak].finance.ticketPrice = 60;
    own.finance.ticketPrice = 30;
    for (const c of [s.clubs[full], s.clubs[weak]]) c.finance.balance = 0;
    aiStadiumDecisions(s);
    expect(s.clubs[full].finance.ticketPrice).toBeGreaterThan(startPrice(s.clubs[full].reputation));
    expect(s.clubs[weak].finance.ticketPrice).toBeLessThan(60);
    expect(own.finance.ticketPrice).toBe(30);
  });

  it("KI-Preise bleiben zwischen 5 und 100 € und landen beim Erlösmaximum", () => {
    const s = game();
    s.calendarIndex = 5;
    const ai = Object.values(s.clubs).filter((c) => c.managerId === null);
    for (const c of ai) c.finance.balance = 0;
    for (let i = 0; i < 120; i++) aiStadiumDecisions(s);
    for (const c of ai) {
      expect(c.finance.ticketPrice).toBeGreaterThanOrEqual(5);
      expect(c.finance.ticketPrice).toBeLessThanOrEqual(100);
    }
    const id = byReputation(s, COMP.first).find((x) => s.clubs[x].managerId === null)!;
    const opp = midOpponent(s, COMP.first);
    const p = s.clubs[id].finance.ticketPrice;
    expect(revenue(s, id, opp, p)).toBeGreaterThanOrEqual(revenue(s, id, opp, p + 2));
    expect(revenue(s, id, opp, p)).toBeGreaterThanOrEqual(revenue(s, id, opp, p - 2));
  });

  it("KI passt an Relegationstagen nichts an", () => {
    const s = game();
    s.calendarIndex = 34;
    const id = byReputation(s, COMP.first).find((x) => s.clubs[x].managerId === null)!;
    s.clubs[id].finance.ticketPrice = 30;
    s.clubs[id].finance.lastAttendance = capacity(s, id);
    processMatchday(s, [], Rng.fromSeed(1));
    expect(s.clubs[id].finance.ticketPrice).toBe(30);
  });

  it("KI baut nur mit Geld", () => {
    const s = game();
    s.calendarIndex = 5;
    const id = byReputation(s, COMP.first).find((x) => s.clubs[x].managerId === null)!;
    const f = s.clubs[id].finance;
    const cost = STADIUM[f.stadiumStage + 1].cost;
    f.lastAttendance = capacity(s, id);
    f.balance = cost - 1;
    aiStadiumDecisions(s);
    expect(f.building).toBeNull();
    expect(f.balance).toBe(cost - 1);
    f.balance = cost + AI_BUILD_RESERVE;
    f.lastAttendance = capacity(s, id);
    aiStadiumDecisions(s);
    expect(f.building).not.toBeNull();
    expect(f.balance).toBe(AI_BUILD_RESERVE);
  });
});

describe("3. Liga", () => {
  it("bei gleichem Ruf weniger Zuschauer als in der 2. Liga", () => {
    const s = game();
    const l2 = s.competitions[COMP.second].clubs[0];
    const l3 = s.competitions[COMP.third].clubs[0];
    for (const id of [l2, l3]) Object.assign(s.clubs[id], { reputation: 60 });
    for (const id of [l2, l3]) Object.assign(s.clubs[id].finance, { stadiumStage: 4, ticketPrice: 20 });
    const opp = midOpponent(s, COMP.second);
    expect(attendance(s, l3, opp)).toBeLessThan(attendance(s, l2, opp));
  });

  it("Traditionsverein der 3. Liga ist zum Start fast voll", () => {
    const s = game();
    const id = Object.values(s.clubs).find((c) => c.name === "Fortuna Düsseldorf")!.id;
    s.clubs[id].finance.ticketPrice = startPrice(s.clubs[id].reputation, 2);
    expect(attendance(s, id, midOpponent(s, COMP.third)) / capacity(s, id)).toBeGreaterThanOrEqual(0.9);
  });
});

describe("Stadionunterhalt", () => {
  it("ist in unteren Ligen günstiger", () => {
    expect(upkeepFor(3, 1)).toBeLessThan(upkeepFor(3, 0));
    expect(upkeepFor(3, 2)).toBeLessThan(upkeepFor(3, 1));
    expect(upkeepFor(3, 0)).toBe(STADIUM[3].upkeep);
  });
});
