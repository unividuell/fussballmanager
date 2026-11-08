/** Deterministischer Pseudozufall für die Live-Anzeige (FNV-1a, 32 bit) in [0, 1). Zieht nichts aus dem Engine-Rng. */
export function hash01(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const text = parts.join("|");
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}
