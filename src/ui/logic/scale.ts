export const BASE_W = 640;
export const BASE_H = 400;
const MIN_SCALE = 0.25;

/** Größter ganzzahliger Faktor, der ins Fenster passt; bei kleinen Fenstern stufenlos verkleinert. */
export function fitScale(viewW: number, viewH: number): number {
  const exact = Math.min(viewW / BASE_W, viewH / BASE_H);
  if (exact >= 1) return Math.floor(exact);
  return Math.max(MIN_SCALE, exact);
}
