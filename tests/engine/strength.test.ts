import { describe, expect, it } from "vitest";
import { autoLineup } from "../../src/engine/lineup";
import { HOME_FACTOR, effectiveStrength, teamStrength, type PitchPlayer } from "../../src/engine/match/strength";
import { slotPositions, type Tactics } from "../../src/engine/model";
import { makePlayer, makeState } from "./fixtures";

const normal: Tactics = { formation: "4-4-2", style: "normal", hardness: "normal" };

function pitchOf(formation: Tactics["formation"]) {
  const s = makeState([{ id: "c1", strength: 70 }]);
  const l = autoLineup(s, "c1", formation);
  const slots = slotPositions(formation);
  const pitch: PitchPlayer[] = l.starters.map((id, i) => ({ id, slot: slots[i] }));
  return { s, pitch };
}

describe("effectiveStrength", () => {
  it("verrechnet Positionsfaktor, Form und Kondition", () => {
    const p = makePlayer("a", "DF", 80);
    expect(effectiveStrength(p, "DF", 100)).toBeCloseTo(80);
    expect(effectiveStrength(p, "MF", 100)).toBeCloseTo(68);
    expect(effectiveStrength({ ...p, form: 3 }, "DF", 100)).toBeCloseTo(80 * 1.09);
    expect(effectiveStrength(p, "DF", 0)).toBeCloseTo(56);
  });
});

describe("teamStrength", () => {
  it("4-4-2 mit gleich starken Spielern: alle Teile gleich der Spielerstärke", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const t = teamStrength(s.players, pitch, {}, normal, false);
    expect(t.attack).toBeCloseTo(70);
    expect(t.midfield).toBeCloseTo(70);
    expect(t.defense).toBeCloseTo(70);
    expect(t.keeper).toBeCloseTo(70);
  });

  it("Heimvorteil multipliziert alle Teile", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const t = teamStrength(s.players, pitch, {}, normal, true);
    expect(t.attack).toBeCloseTo(70 * HOME_FACTOR);
    expect(t.defense).toBeCloseTo(70 * HOME_FACTOR);
  });

  it("offensiv stärkt den Angriff und schwächt die Abwehr, hart stärkt das Mittelfeld", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const off = teamStrength(s.players, pitch, {}, { ...normal, style: "offensive", hardness: "hard" }, false);
    expect(off.attack).toBeCloseTo(77);
    expect(off.defense).toBeCloseTo(63);
    expect(off.midfield).toBeCloseTo(73.5);
    const def = teamStrength(s.players, pitch, {}, { ...normal, style: "defensive" }, false);
    expect(def.attack).toBeCloseTo(63);
    expect(def.defense).toBeCloseTo(77);
  });

  it("die Formation verschiebt die Gewichte", () => {
    const { s, pitch } = pitchOf("5-3-2");
    const t = teamStrength(s.players, pitch, {}, { ...normal, formation: "5-3-2" }, false);
    expect(t.defense).toBeGreaterThan(70);
    expect(t.midfield).toBeLessThan(70);
  });

  it("ein fehlender Spieler schwächt das Team", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const full = teamStrength(s.players, pitch, {}, normal, false);
    const ten = teamStrength(s.players, pitch.slice(0, 10), {}, normal, false);
    expect(ten.midfield).toBeLessThan(full.midfield);
    expect(ten.attack).toBeLessThan(full.attack);
  });

  it("nutzt die Live-Kondition aus fitness, sonst die Spielerkondition", () => {
    const { s, pitch } = pitchOf("4-4-2");
    const tired = Object.fromEntries(pitch.map((pp) => [pp.id, 0]));
    expect(teamStrength(s.players, pitch, tired, normal, false).attack).toBeCloseTo(49);
  });
});
