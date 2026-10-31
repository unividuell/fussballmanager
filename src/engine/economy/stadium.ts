export interface StadiumStage {
  capacity: number;
  upkeep: number;
  cost: number;
  buildMatchdays: number;
}

export const STADIUM: readonly StadiumStage[] = [
  { capacity: 8_000, upkeep: 8_000, cost: 0, buildMatchdays: 0 },
  { capacity: 16_000, upkeep: 15_000, cost: 2_000_000, buildMatchdays: 6 },
  { capacity: 28_000, upkeep: 28_000, cost: 5_000_000, buildMatchdays: 8 },
  { capacity: 45_000, upkeep: 45_000, cost: 10_000_000, buildMatchdays: 10 },
  { capacity: 65_000, upkeep: 70_000, cost: 20_000_000, buildMatchdays: 12 },
];

export function initialStage(reputation: number): number {
  return Math.max(0, Math.min(STADIUM.length - 1, Math.floor(reputation / 20)));
}

export function referencePrice(reputation: number): number {
  return 10 + reputation * 0.15;
}

export function optimalPrice(reputation: number): number {
  return Math.round(1.5 * referencePrice(reputation));
}

/** Anteil der Grundnachfrage, der bei diesem Preis kommt (0 bis 1,5). */
export function priceFactor(price: number, reputation: number): number {
  return Math.max(0, Math.min(1.5, 1.5 - price / (2 * referencePrice(reputation))));
}
