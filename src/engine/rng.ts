export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    z ^= z >>> 16;
    return z >>> 0;
  };
}

/** sfc32 – kleiner, schneller, seed-basierter Zufallsgenerator mit serialisierbarem Zustand. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  private constructor(s: RngState) {
    this.a = s.a | 0;
    this.b = s.b | 0;
    this.c = s.c | 0;
    this.d = s.d | 0;
  }

  static fromSeed(seed: number): Rng {
    const sm = splitmix32(seed);
    const rng = new Rng({ a: sm(), b: sm(), c: sm(), d: sm() });
    for (let i = 0; i < 15; i++) rng.next();
    return rng;
  }

  static fromState(s: RngState): Rng {
    return new Rng(s);
  }

  state(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick() auf leerer Liste");
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const weights = items.map(weight);
    const total = weights.reduce((x, y) => x + y, 0);
    if (total <= 0) throw new Error("weighted() ohne positives Gewicht");
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      if (weights[i] <= 0) continue;
      r -= weights[i];
      if (r < 0) return items[i];
    }
    for (let i = items.length - 1; i >= 0; i--) if (weights[i] > 0) return items[i];
    throw new Error("unreachable");
  }

  normal(mean: number, sd: number): number {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
