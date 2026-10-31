import { autoLineup } from "./lineup";
import {
  newId,
  type Club,
  type ClubId,
  type CrestPattern,
  type GameState,
  type Player,
  type Position,
} from "./model";
import { CLUB_COLORS, CLUB_PREFIXES, FIRST_NAMES, LAST_NAMES, TOWNS } from "./names";
import { Rng } from "./rng";

export const CLUB_COUNT = 36;
const SQUAD_PLAN: [Position, number][] = [["GK", 3], ["DF", 8], ["MF", 8], ["FW", 6]];
const CRESTS: CrestPattern[] = ["plain", "stripes", "sash", "split", "hoops"];

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
  };
  state.players[p.id] = p;
  return p;
}

function clubName(rng: Rng, town: string): string {
  const prefix = rng.pick(CLUB_PREFIXES);
  const suffix = rng.chance(0.3) ? ` ${String(rng.int(0, 99)).padStart(2, "0")}` : "";
  return `${prefix} ${town}${suffix}`;
}

export function generateWorld(seed: number): GameState {
  const rng = Rng.fromSeed(seed);
  const state: GameState = {
    version: 1,
    rngState: rng.state(),
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
  const towns = rng.shuffle(TOWNS).slice(0, CLUB_COUNT);
  for (let i = 0; i < CLUB_COUNT; i++) {
    const reputation = clamp(Math.round(92 - i * 1.8 + rng.int(-3, 3)), 1, 100);
    const [c1, c2] = rng.shuffle(CLUB_COLORS);
    const club: Club = {
      id: newId(state, "c"),
      name: clubName(rng, towns[i]),
      shortName: towns[i],
      colors: [c1, c2],
      crest: rng.pick(CRESTS),
      reputation,
      managerId: null,
      squad: [],
      lineup: { starters: [], bench: [] },
      tactics: { formation: "4-4-2", style: "normal", hardness: "normal" },
    };
    state.clubs[club.id] = club;
    const base = baseStrengthFor(reputation);
    for (const [pos, n] of SQUAD_PLAN) {
      for (let k = 0; k < n; k++) club.squad.push(generatePlayer(state, rng, club.id, pos, base).id);
    }
    club.lineup = autoLineup(state, club.id, club.tactics.formation);
  }
  state.rngState = rng.state();
  return state;
}
