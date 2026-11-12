import type { Club, ClubId, GameState, LedgerCategory, Player } from "../model";
import { roundTo } from "./util";

/** Ab dieser Stärke werden Gehalt und Marktwert zusätzlich steiler: Stars sind teuer. */
const STAR_FROM = 74;
const STAR_SALARY = 1.015;
const STAR_VALUE = 1.04;
/** Bis zu dieser Stärke wirkt der Star-Aufschlag; darüber wächst nur noch die Grundkurve. */
const STAR_UNTIL = 90;
/** Marktwerte über dieser Grenze nähern sich nur noch langsam VALUE_SOFT_CAP + VALUE_RANGE (25 Mio). */
const VALUE_SOFT_CAP = 20_000_000;
const VALUE_RANGE = 5_000_000;

const starBoost = (strength: number, factor: number) => Math.pow(factor, Math.max(0, Math.min(strength, STAR_UNTIL) - STAR_FROM));

/** Ab dieser Stärke steigt das Gehalt nur noch gedämpft (höchstens um SALARY_TOP_RANGE), damit Talent-Wachstum die Gehälter nicht explodieren lässt. */
const SALARY_SOFT_FROM = 88;
const SALARY_TOP_RANGE = 0.25;

const rawSalary = (strength: number) => 1700 * Math.pow(1.075, strength - 40) * starBoost(strength, STAR_SALARY);

export function salaryFor(strength: number): number {
  const raw =
    strength <= SALARY_SOFT_FROM
      ? rawSalary(strength)
      : rawSalary(SALARY_SOFT_FROM) * (1 + SALARY_TOP_RANGE * (1 - Math.exp(-(strength - SALARY_SOFT_FROM) / 4)));
  return roundTo(raw, 100);
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
  const value = raw > VALUE_SOFT_CAP ? VALUE_SOFT_CAP + VALUE_RANGE * (1 - Math.exp(-(raw - VALUE_SOFT_CAP) / VALUE_RANGE)) : raw;
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
