import { baseStrengthFor, generatePlayer } from "../generator";
import type { ClubId, GameState, Intensity, PlayerId, Position, TrainingFocus, TrainingPlan } from "../model";
import type { Rng } from "../rng";
import { postToClub } from "./messages";
import { salaryFor } from "./money";
import { removeFromClub } from "./roster";
import { roundTo } from "./util";

export const INTENSITY: Record<Intensity, { growth: number; fitnessCost: number; injuryRisk: number }> = {
  light: { growth: 0.6, fitnessCost: 0, injuryRisk: 0 },
  normal: { growth: 1, fitnessCost: 3, injuryRisk: 0.002 },
  hard: { growth: 1.4, fitnessCost: 7, injuryRisk: 0.006 },
};
export const FOCUS_GROWTH: Record<TrainingFocus, number> = { technique: 1, fitness: 0.5, tactics: 0.5 };
export const TACTICS_BONUS = 1.03;
export const MAX_INDIVIDUAL = 3;
const INDIVIDUAL_BONUS = 2;
const PLAYED_BONUS = 1.1;
const RETIRE_AGE = 34;
const YOUTH_POSITIONS: Position[] = ["GK", "DF", "DF", "MF", "MF", "FW"];
export const FREE_AGENT_POOL_MAX = 150;

export function baseDevelopment(age: number, strength: number, potential: number): number {
  const gap = Math.max(0, potential - strength);
  if (age <= 24) return Math.min(0.35, 0.04 + 0.01 * gap);
  if (age <= 30) return gap > 0 ? 0.03 : 0;
  if (age <= 32) return -0.06;
  return -0.15;
}

export function applyTraining(state: GameState, clubId: ClubId, played: ReadonlySet<PlayerId>, rng: Rng): PlayerId[] {
  const club = state.clubs[clubId];
  const plan = club.training;
  const cfg = INTENSITY[plan.intensity];
  const injured: PlayerId[] = [];
  for (const pid of club.squad) {
    const p = state.players[pid];
    const base = baseDevelopment(p.age, p.strength, p.potential);
    if (base > 0) {
      const mult =
        cfg.growth *
        FOCUS_GROWTH[plan.focus] *
        (plan.individual.includes(pid) ? INDIVIDUAL_BONUS : 1) *
        (played.has(pid) ? PLAYED_BONUS : 1);
      p.strength = Math.min(Math.max(p.strength, p.potential), p.strength + base * mult);
    } else if (base < 0) {
      p.strength = Math.max(1, p.strength + base);
    }
    if (plan.focus === "fitness") p.fitness += (100 - p.fitness) * 0.5;
    p.fitness = Math.max(0, p.fitness - cfg.fitnessCost);
    if (p.injury === null && cfg.injuryRisk > 0 && rng.chance(cfg.injuryRisk)) {
      p.injury = { matchesLeft: rng.int(1, 3) };
      injured.push(pid);
    }
  }
  club.tacticsBonus = plan.focus === "tactics" ? TACTICS_BONUS : 1;
  return injured;
}

export function validateTraining(state: GameState, clubId: ClubId, plan: TrainingPlan): string | null {
  if (!Object.hasOwn(INTENSITY, plan.intensity)) return "Unbekannte Trainingsintensität.";
  if (!Object.hasOwn(FOCUS_GROWTH, plan.focus)) return "Unbekannter Trainingsschwerpunkt.";
  if (!Array.isArray(plan.individual) || plan.individual.length > MAX_INDIVIDUAL) return "Höchstens 3 Spieler im Extratraining.";
  if (new Set(plan.individual).size !== plan.individual.length) return "Ein Spieler ist doppelt eingetragen.";
  const squad = state.clubs[clubId].squad;
  if (plan.individual.some((id) => !squad.includes(id))) return "Ein Spieler gehört nicht zum Kader.";
  return null;
}

export function aiTrainingPlan(state: GameState, clubId: ClubId): TrainingPlan {
  const individual = state.clubs[clubId].squad
    .map((id) => state.players[id])
    .filter((p) => p.age <= 23 && p.potential - p.strength > 3)
    .sort((a, b) => b.potential - b.strength - (a.potential - a.strength) || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_INDIVIDUAL)
    .map((p) => p.id);
  return { intensity: "normal", focus: "technique", individual };
}

export function retireChance(age: number): number {
  if (age < RETIRE_AGE) return 0;
  return Math.min(1, 0.3 + 0.15 * (age - RETIRE_AGE));
}

function retire(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  if (p.clubId) postToClub(state, p.clubId, `${p.firstName} ${p.lastName} beendet seine Karriere.`);
  removeFromClub(state, playerId);
  p.retired = true;
  p.clubId = null;
  p.contract = null;
}

/** Saisonwechsel: alle Aktiven altern, manche beenden ihre Karriere. */
export function seasonAging(state: GameState, rng: Rng): PlayerId[] {
  const retired: PlayerId[] = [];
  for (const p of Object.values(state.players)) {
    if (p.retired) continue;
    p.age++;
    if (rng.chance(retireChance(p.age))) {
      retire(state, p.id);
      retired.push(p.id);
    }
  }
  return retired;
}

export function addYouth(state: GameState, rng: Rng): PlayerId[] {
  const ids: PlayerId[] = [];
  for (const club of Object.values(state.clubs)) {
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const p = generatePlayer(state, rng, club.id, rng.pick(YOUTH_POSITIONS), baseStrengthFor(club.reputation) - 14, rng.int(16, 18));
      p.potential = Math.min(99, Math.max(p.strength, p.strength + rng.int(10, 35)));
      p.contract = { salary: roundTo(salaryFor(p.strength) * 0.5, 100), endsSeason: state.season + 2 };
      club.squad.push(p.id);
      ids.push(p.id);
    }
    postToClub(state, club.id, `Aus der Jugend rücken ${n} Spieler in den Kader auf.`);
  }
  return ids;
}

export function addFreeAgents(state: GameState, rng: Rng, count = 25): PlayerId[] {
  const ids: PlayerId[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generatePlayer(state, rng, null, rng.pick(YOUTH_POSITIONS), rng.int(45, 65), rng.int(22, 32)).id);
  }
  return ids;
}

/** Hält den Pool der Vereinslosen klein: die ältesten (bei Gleichstand schwächsten) hören auf. */
export function trimFreeAgents(state: GameState, max = FREE_AGENT_POOL_MAX): void {
  const free = Object.values(state.players)
    .filter((p) => p.clubId === null && !p.retired)
    .sort((a, b) => b.age - a.age || a.strength - b.strength || (a.id < b.id ? -1 : 1));
  for (const p of free.slice(0, Math.max(0, free.length - max))) retire(state, p.id);
}
