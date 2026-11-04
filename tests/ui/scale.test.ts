import { describe, expect, it } from "vitest";
import { BASE_H, BASE_W, fitScale } from "../../src/ui/logic/scale";

describe("fitScale", () => {
  it("füllt das Fenster stufenlos unter Wahrung des Seitenverhältnisses", () => {
    expect(BASE_W).toBe(1280);
    expect(BASE_H).toBe(800);
    expect(fitScale(1280, 800)).toBe(1);
    expect(fitScale(2560, 1600)).toBe(2);
    expect(fitScale(2560, 1440)).toBeCloseTo(1.8);
    expect(fitScale(1920, 1080)).toBeCloseTo(1.35);
    expect(fitScale(3840, 2160)).toBeCloseTo(2.7);
  });

  it("verkleinert in kleinen Fenstern bis höchstens 0,25", () => {
    expect(fitScale(1366, 650)).toBeCloseTo(0.8125);
    expect(fitScale(640, 400)).toBeCloseTo(0.5);
    expect(fitScale(100, 50)).toBe(0.25);
  });
});
