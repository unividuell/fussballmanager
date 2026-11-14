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
import { CLUBS } from "./clubs";
import { FIRST_NAMES, LAST_NAMES } from "./names";
import { Rng } from "./rng";

export const CLUB_COUNT = CLUBS.length;
const SQUAD_PLAN: [Position, number][] = [["GK", 3], ["DF", 8], ["MF", 8], ["FW", 6]];

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

export function generateWorld(seed: number): GameState {
  const rng = Rng.fromSeed(seed);
  const state: GameState = {
    version: 4,
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
  for (const seed of CLUBS) {
    const reputation = seed.reputation;
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
        ticketPrice: startPrice(reputation, LEAGUES.indexOf(seed.league)),
        stadiumStage: initialStage(reputation, LEAGUES.indexOf(seed.league)),
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
    const wage = WAGE_FACTOR[LEAGUES.indexOf(seed.league)];
    for (const [pos, n] of SQUAD_PLAN) {
      for (let k = 0; k < n; k++) club.squad.push(generatePlayer(state, rng, club.id, pos, base, rng.int(17, 34), wage).id);
    }
    club.lineup = autoLineup(state, club.id, club.tactics.formation);
  }
  for (let i = 0; i < FREE_AGENTS_START; i++) {
    generatePlayer(state, rng, null, rng.pick(FREE_AGENT_POSITIONS), rng.int(45, 65), rng.int(22, 32));
  }
  state.rngState = rng.state();
  return state;
}
