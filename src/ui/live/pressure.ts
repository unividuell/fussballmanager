import type { LiveMatch } from "../../engine/match/simulate";
import { hash01 } from "./hash";

const SMOOTH = 0.25;
const LOOKAHEAD = 3;
const WEIGHT_BIG = 0.6;
const WEIGHT_SMALL = 0.35;
const NOISE = 0.2;

/**
 * Druck pro Minute in [-1, 1] (+1 = Heim), Index m - 1 für Minute m. Zeigt nur, was die Engine
 * ohnehin gewürfelt hat: geglättete Angriffsseite, Anstieg in den Minuten vor einer Chance und
 * etwas Rauschen aus Spiel-ID und Minute.
 */
export function pressureCurve(live: LiveMatch): number[] {
  const shots = live.events.flatMap((e) =>
    e.type === "goal" || e.type === "chance"
      ? [{ minute: e.minute, side: e.club === live.home.club ? 1 : -1, weight: e.type === "goal" || e.big ? WEIGHT_BIG : WEIGHT_SMALL }]
      : [],
  );
  const out: number[] = [];
  let base = 0;
  for (let m = 1; m <= live.attacks.length; m++) {
    base = (1 - SMOOTH) * base + SMOOTH * (live.attacks[m - 1] === "home" ? 1 : -1);
    let build = 0;
    for (const s of shots) if (s.minute >= m && s.minute <= m + LOOKAHEAD) build += s.side * s.weight * (1 - (s.minute - m) / (LOOKAHEAD + 1));
    const noise = (hash01(live.matchId, m, "druck") - 0.5) * NOISE;
    out.push(Math.max(-1, Math.min(1, base + build + noise)));
  }
  return out;
}
