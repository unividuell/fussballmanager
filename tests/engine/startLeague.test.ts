import { describe, expect, it } from "vitest";
import { CLUBS } from "../../src/engine/clubs";
import { startBalance } from "../../src/engine/economy/money";
import { initialStage } from "../../src/engine/economy/stadium";
import { generateWorld } from "../../src/engine/generator";
import { LEAGUES, type ClubId, type GameState } from "../../src/engine/model";
import { leagueOf, startNewGame } from "../../src/engine/season";
import { isRegionalliga } from "../../src/engine/regionalliga";
import { leagueProfile } from "../../src/engine/startLeague";
import { validateState } from "../../src/storage/validate";

const world = generateWorld(2027);
const idOf = (name: string) => Object.values(world.clubs).find((c) => c.name === name)!.id;
const byStrength = (league: string) =>
  CLUBS.filter((c) => c.league === league).sort((a, b) => b.strength - a.strength || b.reputation - a.reputation);
const strongest = (league: string) => idOf(byStrength(league)[0].name);
const weakest = (league: string) => idOf(byStrength(league).at(-1)!.name);
const starterAvg = (s: GameState, id: ClubId) =>
  s.clubs[id].lineup.starters.reduce((a, p) => a + s.players[p].strength, 0) / s.clubs[id].lineup.starters.length;

function start(managers: { name: string; clubId: ClubId; league?: string }[]): GameState {
  const r = startNewGame(world, managers);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function eighteenEach(s: GameState): void {
  for (const l of LEAGUES) expect(s.competitions[l].clubs).toHaveLength(18);
  expect(new Set(LEAGUES.flatMap((l) => s.competitions[l].clubs)).size).toBe(54);
}

describe("Startliga", () => {
  it("ohne abweichende Startliga dieselbe Welt", () => {
    const bayern = idOf("FC Bayern München");
    const plain = start([{ name: "A", clubId: bayern }]);
    const explicit = start([{ name: "A", clubId: bayern, league: "L1" }]);
    expect(JSON.stringify(explicit)).toBe(JSON.stringify(plain));
  });

  it("Bayern in die 3. Liga: Kette nach oben, Bayern wie ein mittlerer Drittligist", () => {
    const bayern = idOf("FC Bayern München");
    const up2 = strongest("L2");
    const up3 = strongest("L3");
    const s = start([{ name: "A", clubId: bayern, league: "L3" }]);
    eighteenEach(s);
    expect(leagueOf(s, bayern)).toBe("L3");
    expect(leagueOf(s, up2)).toBe("L1");
    expect(leagueOf(s, up3)).toBe("L2");
    const rep = leagueProfile("L3", "median").reputation;
    expect(s.clubs[bayern].reputation).toBe(rep);
    expect(s.clubs[bayern].finance.balance).toBe(startBalance(rep));
    expect(s.clubs[bayern].finance.stadiumStage).toBe(initialStage(rep, 2));
    const l3 = s.competitions.L3.clubs.filter((id) => id !== bayern).map((id) => starterAvg(s, id));
    expect(starterAvg(s, bayern)).toBeGreaterThan(Math.min(...l3));
    expect(starterAvg(s, bayern)).toBeLessThan(Math.max(...l3));
    expect(s.clubs[up2].reputation).toBe(leagueProfile("L1", "lowest").reputation);
    expect(s.clubs[up3].reputation).toBe(leagueProfile("L2", "lowest").reputation);
    expect(s.clubs[bayern].name).toBe("FC Bayern München");
  });

  it("Havelse in die 1. Liga: Kette nach unten", () => {
    const havelse = idOf("TSV Havelse");
    const down1 = weakest("L1");
    const down2 = weakest("L2");
    const s = start([{ name: "A", clubId: havelse, league: "L1" }]);
    eighteenEach(s);
    expect(leagueOf(s, havelse)).toBe("L1");
    expect(leagueOf(s, down1)).toBe("L2");
    expect(leagueOf(s, down2)).toBe("L3");
    expect(s.clubs[havelse].reputation).toBe(leagueProfile("L1", "median").reputation);
    expect(s.clubs[down1].reputation).toBe(leagueProfile("L2", "highest").reputation);
    expect(s.clubs[down2].reputation).toBe(leagueProfile("L3", "highest").reputation);
  });

  it("zwei Manager in derselben Kette: kein Verein wechselt zweimal", () => {
    const bayern = idOf("FC Bayern München");
    const havelse = idOf("TSV Havelse");
    const before = start([{ name: "X", clubId: bayern }]);
    const s = start([
      { name: "A", clubId: bayern, league: "L3" },
      { name: "B", clubId: havelse, league: "L1" },
    ]);
    eighteenEach(s);
    expect(leagueOf(s, bayern)).toBe("L3");
    expect(leagueOf(s, havelse)).toBe("L1");
    // jeder Verein ist höchstens eine Liga von seiner echten entfernt, außer den beiden Manager-Vereinen
    for (const id of Object.keys(s.clubs)) {
      if (id === bayern || id === havelse) continue;
      const diff = Math.abs(LEAGUES.indexOf(leagueOf(s, id)!) - LEAGUES.indexOf(leagueOf(before, id)!));
      expect(diff, s.clubs[id].name).toBeLessThanOrEqual(1);
    }
  });

  it("ein Manager-Verein rückt nie nach", () => {
    const bayern = idOf("FC Bayern München");
    const top2 = strongest("L2");
    const next2 = idOf(byStrength("L2")[1].name);
    const s = start([
      { name: "A", clubId: bayern, league: "L3" },
      { name: "B", clubId: top2 },
    ]);
    expect(leagueOf(s, top2)).toBe("L2");
    expect(leagueOf(s, next2)).toBe("L1");
    eighteenEach(s);
  });

  it("alte Spieler verschwinden vollständig", () => {
    const bayern = idOf("FC Bayern München");
    const old = world.clubs[bayern].squad;
    const s = start([{ name: "A", clubId: bayern, league: "L3" }]);
    for (const id of old) expect(s.players[id]).toBeUndefined();
    expect(s.clubs[bayern].squad).toHaveLength(25);
    expect(validateState(s)).toBeNull();
  });

  it("lehnt eine unbekannte Liga ab", () => {
    const r = startNewGame(world, [{ name: "A", clubId: idOf("FC Bayern München"), league: "L9" }]);
    expect(r).toEqual({ ok: false, error: "Diese Liga gibt es nicht." });
  });

  it("1860 in die 3. Liga: der schwächste Drittligist rutscht in die Regionalliga", () => {
    const l60 = idOf("TSV 1860 München");
    const out = weakest("L3");
    const s = start([{ name: "A", clubId: l60, league: "L3" }]);
    eighteenEach(s);
    expect(leagueOf(s, l60)).toBe("L3");
    expect(isRegionalliga(s, out)).toBe(true);
    expect(s.clubs[out].reputation).toBe(leagueProfile("RL", "highest").reputation);
    expect(s.clubs[l60].reputation).toBe(leagueProfile("L3", "median").reputation);
    expect(Object.keys(s.clubs)).toHaveLength(64);
    expect(Object.values(s.clubs).filter((c) => isRegionalliga(s, c.id))).toHaveLength(10);
  });

  it("1860 in die 1. Liga: Kette über alle Stufen bis in die Regionalliga", () => {
    const l60 = idOf("TSV 1860 München");
    const [d1, d2, d3] = [weakest("L1"), weakest("L2"), weakest("L3")];
    const s = start([{ name: "A", clubId: l60, league: "L1" }]);
    eighteenEach(s);
    expect(leagueOf(s, l60)).toBe("L1");
    expect(leagueOf(s, d1)).toBe("L2");
    expect(leagueOf(s, d2)).toBe("L3");
    expect(isRegionalliga(s, d3)).toBe(true);
  });

  it("1860 in die 1. Liga und Bayern in die 3. Liga: kein Verein wechselt zweimal", () => {
    const l60 = idOf("TSV 1860 München");
    const bayern = idOf("FC Bayern München");
    const before = start([{ name: "X", clubId: bayern }]);
    const s = start([
      { name: "A", clubId: l60, league: "L1" },
      { name: "B", clubId: bayern, league: "L3" },
    ]);
    eighteenEach(s);
    expect(Object.values(s.clubs).filter((c) => isRegionalliga(s, c.id))).toHaveLength(10);
    const tier = (st: GameState, id: ClubId) => (isRegionalliga(st, id) ? 3 : LEAGUES.indexOf(leagueOf(st, id)!));
    for (const id of Object.keys(s.clubs)) {
      if (id === l60 || id === bayern) continue;
      expect(Math.abs(tier(s, id) - tier(before, id)), s.clubs[id].name).toBeLessThanOrEqual(1);
    }
  });

  it("ein Traditionsverein ohne Startliga wird abgelehnt", () => {
    const r = startNewGame(world, [{ name: "A", clubId: idOf("TSV 1860 München") }]);
    expect(r).toEqual({ ok: false, error: "Bitte wähle für den Traditionsverein eine Startliga." });
    const rl = startNewGame(world, [{ name: "A", clubId: idOf("TSV 1860 München"), league: "RL" }]);
    expect(rl).toEqual({ ok: false, error: "Diese Liga gibt es nicht." });
  });

  it("ein Manager-Verein rutscht nie in die Regionalliga", () => {
    const l60 = idOf("TSV 1860 München");
    const w3 = weakest("L3");
    const next3 = idOf(byStrength("L3").at(-2)!.name);
    const s = start([
      { name: "A", clubId: l60, league: "L3" },
      { name: "B", clubId: w3 },
    ]);
    expect(leagueOf(s, w3)).toBe("L3");
    expect(isRegionalliga(s, next3)).toBe(true);
  });
});
