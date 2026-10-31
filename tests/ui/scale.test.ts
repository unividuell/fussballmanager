import { describe, expect, it } from "vitest";
import { BASE_H, BASE_W, fitScale } from "../../src/ui/logic/scale";

describe("fitScale", () => {
  it("nimmt den größten ganzzahligen Faktor, der passt", () => {
    expect(fitScale(BASE_W, BASE_H)).toBe(1);
    expect(fitScale(1280, 800)).toBe(2);
    expect(fitScale(1920, 1080)).toBe(2);
    expect(fitScale(3840, 2160)).toBe(5);
    expect(fitScale(1366, 768)).toBe(1);
  });

  it("verkleinert stufenlos, wenn das Fenster kleiner als 640×400 ist", () => {
    expect(fitScale(320, 200)).toBeCloseTo(0.5);
    expect(fitScale(640, 200)).toBeCloseTo(0.5);
    expect(fitScale(100, 50)).toBe(0.25);
  });
});
