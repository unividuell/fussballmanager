import { describe, expect, it } from "vitest";
import { computeStandings } from "../../src/engine/competition/standings";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { COMP, type GameState } from "../../src/engine/model";
import {
  aiHalftimeAll,
  currentFixtures,
  finishMatchday,
  isSeasonOver,
  kickOff,
  playHalf,
  playMatchdayAuto,
  prepareMatchday,
  relegationWinner,
  startNewGame,
} from "../../src/engine/season";

function newGame(): GameState {
  const world = generateWorld(2024);
  const clubId = Object.keys(world.clubs)[0];
  const r = startNewGame(world, [{ name: "Markus", clubId }]);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("prepareMatchday", () => {
  it("repariert eine Manager-Aufstellung mit verletztem Spieler und meldet es", () => {
    const s = newGame();
    const club = s.clubs[s.managers[0].clubId!];
    const victim = club.lineup.starters[4];
    s.players[victim].injury = { matchesLeft: 2 };
    const before = JSON.stringify(s);
    const { state, notices } = prepareMatchday(s);
    expect(JSON.stringify(s)).toBe(before);
    const lineup = state.clubs[club.id].lineup;
    expect(lineup.starters).not.toContain(victim);
    expect(validateLineup(state, club.id, lineup)).toBeNull();
    expect(notices).toHaveLength(1);
    expect(notices[0].managerId).toBe(s.managers[0].id);
    expect(notices[0].text).toContain(s.players[victim].lastName);
  });

  it("alle spielenden Vereine haben danach eine gültige Aufstellung", () => {
    const { state } = prepareMatchday(newGame());
    for (const m of currentFixtures(state)) {
      expect(validateLineup(state, m.home, state.clubs[m.home].lineup)).toBeNull();
      expect(validateLineup(state, m.away, state.clubs[m.away].lineup)).toBeNull();
    }
  });
});

describe("kompletter Spieltag", () => {
  it("setzt alle 18 Ergebnisse, zählt Einsätze und schaltet den Kalender weiter", () => {
    let s = prepareMatchday(newGame()).state;
    let lives = kickOff(s);
    expect(lives).toHaveLength(18);
    ({ state: s, lives } = playHalf(s, lives, 1));
    expect(lives.every((l) => l.minute === 45)).toBe(true);
    lives = aiHalftimeAll(s, lives);
    ({ state: s, lives } = playHalf(s, lives, 2));
    const before = JSON.stringify(s);
    const after = finishMatchday(s, lives);
    expect(JSON.stringify(s)).toBe(before);
    expect(after.calendarIndex).toBe(1);
    const l1 = after.competitions[COMP.first];
    expect(l1.matches.filter((m) => m.result !== null)).toHaveLength(9);
    expect(computeStandings(l1).every((r) => r.played === 1)).toBe(true);
    const apps = Object.values(after.players).filter((p) => p.stats.apps === 1).length;
    expect(apps).toBeGreaterThanOrEqual(36 * 11);
    const goals = Object.values(after.players).reduce((x, p) => x + p.stats.goals, 0);
    const scored = l1.matches.concat(after.competitions[COMP.second].matches).reduce((x, m) => x + (m.result ? m.result.home + m.result.away : 0), 0);
    expect(goals).toBe(scored);
  });

  it("ist bei gleichem Spielstand deterministisch", () => {
    const s = newGame();
    expect(JSON.stringify(playMatchdayAuto(s))).toBe(JSON.stringify(playMatchdayAuto(s)));
  });
});

describe("Karten, Sperren, Verletzungen, Kondition", () => {
  function preparedLives() {
    const s = prepareMatchday(newGame()).state;
    return { s, lives: kickOff(s) };
  }

  it("glatt Rot = 3 Spiele, Gelb-Rot = 1 Spiel, 5. Gelbe = 1 Spiel, Verletzung ≥ 1 Spiel", () => {
    const { s, lives } = preparedLives();
    const side = lives[0].home;
    const [red, yellowRed, fifth, hurt] = side.pitch.slice(1, 5).map((pp) => pp.id);
    side.sentOff.push(red, yellowRed);
    side.booked.push(yellowRed, fifth);
    lives[0].events.push(
      { minute: 10, type: "red", club: side.club, player: red, secondYellow: false },
      { minute: 20, type: "red", club: side.club, player: yellowRed, secondYellow: true },
    );
    s.players[fifth].yellowCards = 4;
    side.injured.push(hurt);
    const after = finishMatchday(s, lives);
    expect(after.players[red].suspension).toEqual({ matchesLeft: 3 });
    expect(after.players[yellowRed].suspension).toEqual({ matchesLeft: 1 });
    expect(after.players[yellowRed].yellowCards).toBe(0);
    expect(after.players[fifth].suspension).toEqual({ matchesLeft: 1 });
    expect(after.players[fifth].yellowCards).toBe(0);
    expect(after.players[hurt].injury!.matchesLeft).toBeGreaterThanOrEqual(1);
  });

  it("Sperren laufen nach den Spielen des eigenen Vereins ab", () => {
    const s = newGame();
    const clubId = s.managers[0].clubId!;
    const pid = s.clubs[clubId].squad[20];
    s.players[pid].suspension = { matchesLeft: 1 };
    const after = playMatchdayAuto(s);
    expect(after.players[pid].suspension).toBeNull();
  });

  it("Kondition: Eingesetzte erholen sich teilweise, Nichteingesetzte ganz", () => {
    const { s, lives } = preparedLives();
    const side = lives[0].home;
    const played = side.pitch[3].id;
    side.fitness[played] = 70;
    const rested = s.clubs[side.club].squad.find((id) => !side.played.includes(id))!;
    s.players[rested].fitness = 60;
    const after = finishMatchday(s, lives);
    expect(after.players[played].fitness).toBeCloseTo(88);
    expect(after.players[rested].fitness).toBe(100);
  });
});

describe("Relegation", () => {
  it("wird nach Spieltag 34 mit dem 16. und dem 3. angesetzt und danach ist die Saison vorbei", () => {
    let s = newGame();
    for (let i = 0; i < 34; i++) s = playMatchdayAuto(s);
    const rel = s.competitions[COMP.relegation];
    expect(rel).toBeDefined();
    const sixteenth = computeStandings(s.competitions[COMP.first])[15].club;
    const third = computeStandings(s.competitions[COMP.second])[2].club;
    expect(rel.matches[0]).toMatchObject({ round: 1, home: third, away: sixteenth });
    expect(rel.matches[1]).toMatchObject({ round: 2, home: sixteenth, away: third });
    expect(s.calendar).toHaveLength(36);
    expect(isSeasonOver(s)).toBe(false);
    expect(relegationWinner(s)).toBeNull();
    s = playMatchdayAuto(s);
    s = playMatchdayAuto(s);
    expect(isSeasonOver(s)).toBe(true);
    expect([sixteenth, third]).toContain(relegationWinner(s));
  });

  it("bei gleichem Gesamtergebnis entscheidet das Elfmeterschießen", () => {
    let s = newGame();
    for (let i = 0; i < 35; i++) s = playMatchdayAuto(s);
    const rel = s.competitions[COMP.relegation];
    rel.matches[0].result = { home: 1, away: 1 };
    // Rückspiel ohne Simulation direkt auf 2:2 setzen
    const prepared = prepareMatchday(s).state;
    const lives = kickOff(prepared).map((l) => ({ ...l, home: { ...l.home, goals: 2 }, away: { ...l.away, goals: 2 } }));
    const after = finishMatchday(prepared, lives);
    const second = after.competitions[COMP.relegation].matches[1];
    expect(second.result).toEqual({ home: 2, away: 2 });
    expect(second.penalties).not.toBeNull();
    expect(second.penalties!.home).not.toBe(second.penalties!.away);
    const winner = second.penalties!.home > second.penalties!.away ? second.home : second.away;
    expect(relegationWinner(after)).toBe(winner);
  });
});
