export const BASE_W = 1280;
export const BASE_H = 800;
const MIN_SCALE = 0.25;

/** Stufenloser Faktor, der die logische Fläche ins Fenster einpasst (Seitenverhältnis bleibt); mindestens 0,25. */
export function fitScale(viewW: number, viewH: number): number {
  const exact = Math.min(viewW / BASE_W, viewH / BASE_H);
  return Math.max(MIN_SCALE, exact);
}
