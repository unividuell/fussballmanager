import type { GameController } from "./ui/controller.svelte";

/** Nur für Browser-Tests (Vite-Modus „e2e“): spielt ohne Eingaben weiter, bis die Saison zu Ende ist. */
export async function playToSeasonEnd(c: GameController, maxSteps = 10_000): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    const p = c.snapshot?.phase;
    if (!p) return false;
    if (p.kind === "seasonEnd") return true;
    if (p.kind === "managerTurns" || p.kind === "halftime") {
      if (!(await c.endTurn(p.pending[0]))) return false;
    } else c.advance();
  }
  return false;
}
