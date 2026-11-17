import { START_CONFIDENCE } from "./economy/board";
import { WAGE_FACTOR, salaryFor, startBalance } from "./economy/money";
import { roundTo } from "./economy/util";
import { initialStage, startPrice } from "./economy/stadium";
import { autoLineup } from "./lineup";
import {
  LEAGUES,
  newId,
  type Club,
  type ClubId,
  type GameState,
  type Player,
  type Position,
} from "./model";
import { CLUBS, type ClubSeed } from "./clubs";
import { RL_WAGE_FACTOR } from "./regionalliga";
import { FIRST_NAMES, LAST_NAMES } from "./names";
import { Rng } from "./rng";

export const CLUB_COUNT = CLUBS.length;
export const SQUAD_PLAN: [Position, number][] = [["GK", 3], ["DF", 8], ["MF", 8], ["FW", 6]];

const FREE_AGENTS_START = 30;
const FREE_AGENT_POSITIONS: Position[] = ["GK", "DF", "DF", "MF", "MF", "FW"];

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Reputation 92 → ca. 79, Reputation 30 → ca. 51. */
export function baseStrengthFor(reputation: number): number {
  return 38 + reputation * 0.45;
}

export function generatePlayer(
  state: GameState,
  rng: Rng,
  clubId: ClubId | null,
  position: Position,
  baseStrength: number,
  age = rng.int(17, 34),
  wageFactor = 1,
): Player {
  let strength = rng.normal(baseStrength, 5);
  if (age <= 20) strength -= 6;
  else if (age >= 32) strength -= 3;
  strength = clamp(strength, 20, 95);
  let potential = strength;
  if (age <= 23) potential = strength + rng.int(2, 18);
  else if (age <= 28) potential = strength + rng.int(0, 5);
  const p: Player = {
    id: newId(state, "p"),
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    age,
    position,
    strength,
    potential: clamp(potential, strength, 99),
    form: 0,
    fitness: 100,
    injury: null,
    suspension: null,
    yellowCards: 0,
    clubId,
    stats: { apps: 0, goals: 0 },
    contract: clubId ? { salary: roundTo(salaryFor(strength) * wageFactor, 100), endsSeason: state.season + rng.int(0, 3) } : null,
    morale: 60,
    transferListed: null,
    talkCooldown: 0,
    retired: false,
  };
  state.players[p.id] = p;
  return p;
}

/** Erzeugt den Kader eines Vereins nach SQUAD_PLAN und stellt die beste Elf auf. */
export function generateSquad(state: GameState, rng: Rng, clubId: ClubId, baseStrength: number, wageFactor: number): void {
  const club = state.clubs[clubId];
  for (const [pos, n] of SQUAD_PLAN) {
    for (let k = 0; k < n; k++) club.squad.push(generatePlayer(state, rng, clubId, pos, baseStrength, rng.int(17, 34), wageFactor).id);
  }
  club.lineup = autoLineup(state, clubId, club.tactics.formation);
}

export function generateWorld(seed: number): GameState {
  const rng = Rng.fromSeed(seed);
  const state: GameState = {
    version: 5,
    rngState: rng.state(),
    season: 1,
    calendar: [],
    calendarIndex: 0,
    managers: [],
    clubs: {},
    players: {},
    competitions: {},
    history: [],
    negotiations: [],
    transferOffers: [],
    messages: [],
    nextId: 1,
  };
  // Ligavereine zuerst, dann Vereinslose, dann die Traditionsvereine: so bleibt die Startwelt der Ligen gleich (Spec 2026-11-17)
  const createClub = (seed: ClubSeed) => {
    const reputation = seed.reputation;
    // die Regionalliga rechnet mit den Werten der 3. Liga; Finanzen werden dort nicht gebucht
    const level = seed.league === "RL" ? 2 : LEAGUES.indexOf(seed.league);
    const club: Club = {
      id: newId(state, "c"),
      name: seed.name,
      shortName: seed.shortName,
      colors: [...seed.colors],
      crest: seed.crest,
      reputation,
      managerId: null,
      squad: [],
      lineup: { starters: [], bench: [] },
      tactics: { formation: "4-4-2", style: "normal", hardness: "normal" },
      finance: {
        balance: startBalance(reputation),
        ticketPrice: startPrice(reputation, level),
        stadiumStage: initialStage(reputation, level),
        building: null,
        sponsor: null,
        sponsorOffers: [],
        ledger: [],
        overdraftStreak: 0,
        lastAttendance: 0,
      },
      board: { expectation: "mid", confidence: START_CONFIDENCE, warned: false, trend: [], seasons: [] },
      training: { intensity: "normal", focus: "technique", individual: [] },
      tacticsBonus: 1,
    };
    state.clubs[club.id] = club;
    // Kaderstärke kommt aus dem Datensatz, unabhängig vom Ruf (Spec 2026-11-13, Abschnitt 3)
    const base = baseStrengthFor(seed.strength);
    const wage = seed.league === "RL" ? RL_WAGE_FACTOR : WAGE_FACTOR[level];
    generateSquad(state, rng, club.id, base, wage);
  };
  for (const seed of CLUBS) if (seed.league !== "RL") createClub(seed);
  for (let i = 0; i < FREE_AGENTS_START; i++) {
    generatePlayer(state, rng, null, rng.pick(FREE_AGENT_POSITIONS), rng.int(45, 65), rng.int(22, 32));
  }
  for (const seed of CLUBS) if (seed.league === "RL") createClub(seed);
  state.rngState = rng.state();
  return state;
}
