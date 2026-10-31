import { describe, expect, it } from "vitest";
import { Rng } from "../../src/engine/rng";

describe("Rng", () => {
  it("liefert bei gleichem Seed dieselbe Folge", () => {
    const a = Rng.fromSeed(42);
    const b = Rng.fromSeed(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("liefert bei verschiedenem Seed verschiedene Folgen", () => {
    expect(Rng.fromSeed(1).next()).not.toBe(Rng.fromSeed(2).next());
  });

  it("setzt nach state()/fromState() exakt fort", () => {
    const a = Rng.fromSeed(7);
    a.next();
    a.next();
    const b = Rng.fromState(JSON.parse(JSON.stringify(a.state())));
    for (let i = 0; i < 50; i++) expect(b.next()).toBe(a.next());
  });

  it("next() liegt in [0, 1)", () => {
    const r = Rng.fromSeed(3);
    for (let i = 0; i < 10_000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("int() trifft beide Grenzen und nichts außerhalb", () => {
    const r = Rng.fromSeed(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(r.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("weighted() wählt nie Gewicht 0", () => {
    const r = Rng.fromSeed(9);
    for (let i = 0; i < 1000; i++) {
      expect(r.weighted(["a", "b", "c"], (x) => (x === "b" ? 0 : 1))).not.toBe("b");
    }
  });

  it("normal() hat ungefähr den gewünschten Mittelwert", () => {
    const r = Rng.fromSeed(11);
    let sum = 0;
    for (let i = 0; i < 20_000; i++) sum += r.normal(50, 10);
    expect(sum / 20_000).toBeGreaterThan(49.5);
    expect(sum / 20_000).toBeLessThan(50.5);
  });

  it("shuffle() verändert das Original nicht und behält alle Elemente", () => {
    const r = Rng.fromSeed(13);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const s = r.shuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...s].sort()).toEqual(arr);
  });
});
