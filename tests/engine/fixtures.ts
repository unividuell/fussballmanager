import { Rng } from "../../src/engine/rng";
import type { Club, GameState, Player, Position } from "../../src/engine/model";

export function makePlayer(id: string, position: Position, strength: number, extra: Partial<Player> = {}): Player {
  return {
    id,
    firstName: "Test",
    lastName: id,
    age: 25,
    position,
    strength,
    potential: strength,
    form: 0,
    fitness: 100,
    injury: null,
    suspension: null,
    yellowCards: 0,
    clubId: null,
    stats: { apps: 0, goals: 0 },
    ...extra,
  };
}

/** 25 Spieler: 3 TW, 8 ABW, 8 MF, 6 ST, alle mit gleicher Stärke. */
export function makeSquad(clubId: string, strength: number): Player[] {
  const plan: [Position, number][] = [["GK", 3], ["DF", 8], ["MF", 8], ["FW", 6]];
  const out: Player[] = [];
  for (const [pos, n] of plan) {
    for (let i = 1; i <= n; i++) out.push(makePlayer(`${clubId}-${pos}${i}`, pos, strength, { clubId }));
  }
  return out;
}

export function makeClub(id: string, squad: Player[], extra: Partial<Club> = {}): Club {
  return {
    id,
    name: `Verein ${id}`,
    shortName: id,
    colors: ["#ffffff", "#000000"],
    crest: "plain",
    reputation: 50,
    managerId: null,
    squad: squad.map((p) => p.id),
    lineup: { starters: [], bench: [] },
    tactics: { formation: "4-4-2", style: "normal", hardness: "normal" },
    ...extra,
  };
}

/** Minimaler Spielstand mit den übergebenen Vereinen (je mit eigenem Kader). */
export function makeState(clubs: { id: string; strength: number }[], seed = 1): GameState {
  const state: GameState = {
    version: 1,
    rngState: Rng.fromSeed(seed).state(),
    season: 1,
    calendar: [],
    calendarIndex: 0,
    managers: [],
    clubs: {},
    players: {},
    competitions: {},
    history: [],
    nextId: 1,
  };
  for (const c of clubs) {
    const squad = makeSquad(c.id, c.strength);
    for (const p of squad) state.players[p.id] = p;
    state.clubs[c.id] = makeClub(c.id, squad);
  }
  return state;
}
