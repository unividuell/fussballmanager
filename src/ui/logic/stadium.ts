const SOLD_OUT = 0.98;
const EMPTY = 0.75;

/** Hinweis zum Eintrittspreis nach dem letzten Heimspiel; null, wenn nichts auffällt oder noch kein Heimspiel war. */
export function priceHint(lastAttendance: number, capacity: number): string | null {
  if (lastAttendance <= 0) return null;
  if (lastAttendance >= SOLD_OUT * capacity) return "Ausverkauft – ein höherer Preis bringt vermutlich mehr.";
  if (lastAttendance < EMPTY * capacity) return "Viele freie Plätze – ein niedrigerer Preis lockt mehr Zuschauer.";
  return null;
}
