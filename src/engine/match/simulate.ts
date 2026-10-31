import { fillSlots, playerValue, positionFactor } from "../lineup";
import {
  MAX_SUBS,
  slotPositions,
  type ClubId,
  type CompetitionId,
  type GameState,
  type Hardness,
  type Match,
  type MatchEvent,
  type MatchId,
  type PlayerId,
  type Position,
  type Score,
  type Tactics,
} from "../model";
import type { Rng } from "../rng";
import { HOME_FACTOR, effectiveStrength, teamStrength, type PitchPlayer, type TeamStrength } from "./strength";

export const SIM = {
  baseChance: 0.105,
  chanceExp: 1,
  baseGoal: 0.3,
  goalExp: 0.5,
  minGoal: 0.05,
  maxGoal: 0.8,
  yellowPerMin: 0.0194,
  redPerMin: 0.0009,
  injuryPerMin: 0.00167,
  fitnessDrain: 0.28,
};
const HARDNESS_FACTOR: Record<Hardness, number> = { fair: 0.7, normal: 1, hard: 1.5 };
const SHOOT_WEIGHT: Record<Position, number> = { GK: 0, DF: 0.5, MF: 2, FW: 5 };

export type Side = "home" | "away";

export interface LiveSide {
  club: ClubId;
  tactics: Tactics;
  pitch: PitchPlayer[];
  bench: PlayerId[];
  subsUsed: number;
  fitness: Record<PlayerId, number>;
  booked: PlayerId[];
  sentOff: PlayerId[];
  injured: PlayerId[];
  /** alle, die eingesetzt wurden (Startelf + Eingewechselte) */
  played: PlayerId[];
  goals: number;
  /** Multiplikator auf alle Mannschaftsteile (Plan 3: Taktiktraining) */
  bonus: number;
}

export interface LiveMatch {
  matchId: MatchId;
  competitionId: CompetitionId;
  home: LiveSide;
  away: LiveSide;
  events: MatchEvent[];
  minute: number;
}

function liveSide(state: GameState, clubId: ClubId): LiveSide {
  const club = state.clubs[clubId];
  const slots = slotPositions(club.tactics.formation);
  const pitch = club.lineup.starters.map((id, i) => ({ id, slot: slots[i] }));
  const fitness: Record<PlayerId, number> = {};
  for (const id of [...club.lineup.starters, ...club.lineup.bench]) fitness[id] = state.players[id].fitness;
  return {
    club: clubId,
    tactics: { ...club.tactics },
    pitch,
    bench: [...club.lineup.bench],
    subsUsed: 0,
    fitness,
    booked: [],
    sentOff: [],
    injured: [],
    played: [...club.lineup.starters],
    goals: 0,
    bonus: 1,
  };
}

export function startMatch(state: GameState, match: Match): LiveMatch {
  return {
    matchId: match.id,
    competitionId: match.competitionId,
    home: liveSide(state, match.home),
    away: liveSide(state, match.away),
    events: [],
    minute: 0,
  };
}

export function sideOf(live: LiveMatch, side: Side): LiveSide {
  return side === "home" ? live.home : live.away;
}

function strengthOf(state: GameState, s: LiveSide, home: boolean): TeamStrength {
  return teamStrength(state.players, s.pitch, s.fitness, s.tactics, home, s.bonus);
}

export function bestBenchFor(state: GameState, s: LiveSide, slot: Position): PlayerId | null {
  let best: PlayerId | null = null;
  let bestScore = -Infinity;
  for (const id of s.bench) {
    const p = state.players[id];
    const score = playerValue(p) * positionFactor(p.position, slot);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function bringOn(live: LiveMatch, s: LiveSide, slot: Position, inId: PlayerId, outId: PlayerId, minute: number): void {
  s.bench = s.bench.filter((id) => id !== inId);
  s.pitch.push({ id: inId, slot });
  s.subsUsed++;
  s.played.push(inId);
  live.events.push({ minute, type: "sub", club: s.club, out: outId, in: inId });
}

/** Sorgt dafür, dass jemand im Tor steht. */
function ensureKeeper(state: GameState, live: LiveMatch, s: LiveSide, minute: number): void {
  if (s.pitch.length === 0 || s.pitch.some((pp) => pp.slot === "GK")) return;
  const benchGk = s.bench.find((id) => state.players[id].position === "GK");
  const weakestOutfield = () => {
    let idx = 0;
    for (let i = 1; i < s.pitch.length; i++) {
      const a = s.pitch[i];
      const b = s.pitch[idx];
      if (effectiveStrength(state.players[a.id], a.slot, s.fitness[a.id]) < effectiveStrength(state.players[b.id], b.slot, s.fitness[b.id])) idx = i;
    }
    return idx;
  };
  if (s.subsUsed < MAX_SUBS && benchGk && s.pitch.length > 1) {
    const out = s.pitch.splice(weakestOutfield(), 1)[0];
    bringOn(live, s, "GK", benchGk, out.id, minute);
    return;
  }
  s.pitch[weakestOutfield()].slot = "GK";
}

export function sendOff(state: GameState, live: LiveMatch, side: Side, playerId: PlayerId, minute: number, secondYellow: boolean): void {
  const s = sideOf(live, side);
  s.pitch = s.pitch.filter((pp) => pp.id !== playerId);
  s.sentOff.push(playerId);
  live.events.push({ minute, type: "red", club: s.club, player: playerId, secondYellow });
  ensureKeeper(state, live, s, minute);
}

function injure(state: GameState, live: LiveMatch, s: LiveSide, playerId: PlayerId, minute: number): void {
  const idx = s.pitch.findIndex((pp) => pp.id === playerId);
  const slot = s.pitch[idx].slot;
  s.pitch.splice(idx, 1);
  s.injured.push(playerId);
  live.events.push({ minute, type: "injury", club: s.club, player: playerId });
  if (s.subsUsed < MAX_SUBS) {
    const inId = bestBenchFor(state, s, slot);
    if (inId) {
      bringOn(live, s, slot, inId, playerId, minute);
      return;
    }
  }
  ensureKeeper(state, live, s, minute);
}

function drainFitness(s: LiveSide): void {
  const f = (s.tactics.hardness === "hard" ? 1.2 : 1) * (s.tactics.style === "offensive" ? 1.1 : 1);
  for (const pp of s.pitch) s.fitness[pp.id] = Math.max(0, s.fitness[pp.id] - SIM.fitnessDrain * f);
}

function attack(state: GameState, live: LiveMatch, att: LiveSide, attS: TeamStrength, defS: TeamStrength, home: boolean, minute: number, rng: Rng): void {
  if (!rng.chance(SIM.baseChance * Math.pow(attS.attack / defS.defense, SIM.chanceExp))) return;
  const shooters = att.pitch.filter((pp) => SHOOT_WEIGHT[pp.slot] > 0);
  if (shooters.length === 0) return;
  const shooter = rng.weighted(shooters, (pp) => SHOOT_WEIGHT[pp.slot] * state.players[pp.id].strength);
  const shot = effectiveStrength(state.players[shooter.id], shooter.slot, att.fitness[shooter.id]) * (home ? HOME_FACTOR : 1) * att.bonus;
  const pGoal = Math.min(SIM.maxGoal, Math.max(SIM.minGoal, SIM.baseGoal * Math.pow(shot / Math.max(defS.keeper, 10), SIM.goalExp)));
  if (rng.chance(pGoal)) {
    att.goals++;
    live.events.push({ minute, type: "goal", club: att.club, player: shooter.id });
  }
}

function discipline(state: GameState, live: LiveMatch, side: Side, minute: number, rng: Rng): void {
  const s = sideOf(live, side);
  const other = sideOf(live, side === "home" ? "away" : "home");
  const hf = HARDNESS_FACTOR[s.tactics.hardness];
  if (s.pitch.length > 0 && rng.chance(SIM.yellowPerMin * hf)) {
    const p = rng.pick(s.pitch).id;
    if (s.booked.includes(p)) sendOff(state, live, side, p, minute, true);
    else {
      s.booked.push(p);
      live.events.push({ minute, type: "yellow", club: s.club, player: p });
    }
  }
  if (s.pitch.length > 0 && rng.chance(SIM.redPerMin * hf)) sendOff(state, live, side, rng.pick(s.pitch).id, minute, false);
  if (s.pitch.length > 0 && rng.chance(SIM.injuryPerMin * HARDNESS_FACTOR[other.tactics.hardness])) {
    injure(state, live, s, rng.pick(s.pitch).id, minute);
  }
}

function minuteStep(state: GameState, live: LiveMatch, minute: number, rng: Rng): void {
  drainFitness(live.home);
  drainFitness(live.away);
  const hs = strengthOf(state, live.home, true);
  const as = strengthOf(state, live.away, false);
  if (rng.chance(hs.midfield / (hs.midfield + as.midfield))) attack(state, live, live.home, hs, as, true, minute, rng);
  else attack(state, live, live.away, as, hs, false, minute, rng);
  discipline(state, live, "home", minute, rng);
  discipline(state, live, "away", minute, rng);
}

export function simulateHalf(state: GameState, live: LiveMatch, half: 1 | 2, rng: Rng): void {
  const from = half === 1 ? 1 : 46;
  const to = half === 1 ? 45 : 90;
  for (let m = from; m <= to; m++) {
    live.minute = m;
    minuteStep(state, live, m, rng);
  }
}

export function substitute(state: GameState, live: LiveMatch, side: Side, outId: PlayerId, inId: PlayerId): string | null {
  const s = sideOf(live, side);
  if (s.subsUsed >= MAX_SUBS) return `Alle ${MAX_SUBS} Wechsel sind aufgebraucht.`;
  const idx = s.pitch.findIndex((pp) => pp.id === outId);
  if (idx < 0) return "Der Spieler steht nicht auf dem Platz.";
  if (!s.bench.includes(inId)) return "Der Spieler sitzt nicht auf der Bank.";
  const slot = s.pitch[idx].slot;
  s.bench = s.bench.filter((id) => id !== inId);
  s.pitch[idx] = { id: inId, slot };
  s.subsUsed++;
  s.played.push(inId);
  live.events.push({ minute: live.minute, type: "sub", club: s.club, out: outId, in: inId });
  return null;
}

const DROP_ORDER: Position[] = ["FW", "MF", "DF"];

export function changeTactics(state: GameState, live: LiveMatch, side: Side, tactics: Partial<Tactics>): void {
  const s = sideOf(live, side);
  const formationChanged = tactics.formation !== undefined && tactics.formation !== s.tactics.formation;
  s.tactics = { ...s.tactics, ...tactics };
  if (!formationChanged) return;
  const slotPos = slotPositions(s.tactics.formation);
  while (slotPos.length > s.pitch.length) {
    const drop = DROP_ORDER.find((pos) => slotPos.lastIndexOf(pos) > 0)!;
    slotPos.splice(slotPos.lastIndexOf(drop), 1);
  }
  const keeper = s.pitch.find((pp) => pp.slot === "GK");
  const slots: (PlayerId | null)[] = slotPos.map((pos) => (pos === "GK" && keeper ? keeper.id : null));
  fillSlots(slots, slotPos, s.pitch.map((pp) => state.players[pp.id]));
  s.pitch = slots.map((id, i) => ({ id: id!, slot: slotPos[i] }));
}

export function finalScore(live: LiveMatch): Score {
  return { home: live.home.goals, away: live.away.goals };
}

export function penaltyShootout(rng: Rng): Score {
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.chance(0.75)) home++;
    if (rng.chance(0.75)) away++;
  }
  while (home === away) {
    if (rng.chance(0.75)) home++;
    if (rng.chance(0.75)) away++;
  }
  return { home, away };
}
