import type { Club, ClubId, GameState, LedgerCategory, Player } from "../model";
import { roundTo } from "./util";

/** Ab dieser Stärke werden Gehalt und Marktwert zusätzlich steiler: Stars sind teuer. */
const STAR_FROM = 74;
const STAR_SALARY = 1.03;
const STAR_VALUE = 1.04;
/** Marktwerte über dieser Grenze wachsen nur noch gedämpft, damit die Spitze bei 20–25 Mio bleibt. */
const VALUE_SOFT_CAP = 20_000_000;
const VALUE_ABOVE_CAP = 0.3;

const starBoost = (strength: number, factor: number) => Math.pow(factor, Math.max(0, strength - STAR_FROM));

export function salaryFor(strength: number): number {
  return roundTo(1700 * Math.pow(1.075, strength - 40) * starBoost(strength, STAR_SALARY), 100);
}

export function startBalance(reputation: number): number {
  return roundTo(reputation * 50_000, 10_000);
}

export function overdraftLimit(reputation: number): number {
  return roundTo(reputation * 30_000, 10_000);
}

export function marketValue(p: Player, season: number): number {
  const age = p.age <= 21 ? 1.3 : p.age <= 27 ? 1.1 : p.age <= 30 ? 1 : p.age <= 32 ? 0.7 : 0.4;
  const potential = 1 + Math.max(0, p.potential - p.strength) / 40;
  const left = p.contract ? p.contract.endsSeason - season : -1;
  const contract = !p.contract ? 0.5 : left <= 0 ? 0.6 : left === 1 ? 0.85 : 1;
  const raw = 50_000 * Math.pow(1.12, p.strength - 40) * starBoost(p.strength, STAR_VALUE) * age * potential * contract;
  const value = raw > VALUE_SOFT_CAP ? VALUE_SOFT_CAP + (raw - VALUE_SOFT_CAP) * VALUE_ABOVE_CAP : raw;
  return Math.max(10_000, roundTo(value, 10_000));
}

export function book(state: GameState, clubId: ClubId, category: LedgerCategory, amount: number): void {
  const f = state.clubs[clubId].finance;
  f.balance += amount;
  f.ledger.push({ calendarIndex: state.calendarIndex, category, amount });
}

export function canAfford(club: Club, amount: number): boolean {
  return club.finance.balance - amount >= -overdraftLimit(club.reputation);
}

export function isOverLimit(club: Club): boolean {
  return club.finance.balance < -overdraftLimit(club.reputation);
}

export function wageBill(state: GameState, clubId: ClubId): number {
  return state.clubs[clubId].squad.reduce((s, id) => s + (state.players[id].contract?.salary ?? 0), 0);
}
