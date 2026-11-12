import { TARGET_RANK } from "../../engine/economy/board";
import type { Expectation } from "../../engine/model";

export type Trend = "steigend" | "gleich" | "fallend" | "–";

/** Richtung des Vertrauens über den gespeicherten Verlauf. */
export function confidenceTrend(trend: number[]): Trend {
  if (trend.length < 2) return "–";
  const diff = trend[trend.length - 1] - trend[0];
  if (diff > 1) return "steigend";
  if (diff < -1) return "fallend";
  return "gleich";
}

/** Plätze, mit denen das Saisonziel erreicht ist. */
export function targetRange(e: Expectation): [number, number] {
  return [1, TARGET_RANK[e]];
}

/** Ein Satz vom Vorstand zur aktuellen Lage. */
export function boardRemark(rank: number, e: Expectation): string {
  const missing = rank - TARGET_RANK[e];
  if (missing <= 0) return "Wir liegen im Soll. Weiter so!";
  if (missing <= 2) return missing === 1 ? "Ein Platz fehlt noch. Da geht mehr." : "Zwei Plätze fehlen noch. Da geht mehr.";
  return `${missing} Plätze fehlen. Wir erwarten deutlich mehr.`;
}
