import type { Club, ClubId, GameState, LedgerCategory, Player } from "../model";
import { roundTo } from "./util";

export function salaryFor(strength: number): number {
  return roundTo(1700 * Math.pow(1.075, strength - 40), 100);
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
  return Math.max(10_000, roundTo(50_000 * Math.pow(1.12, p.strength - 40) * age * potential * contract, 10_000));
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
