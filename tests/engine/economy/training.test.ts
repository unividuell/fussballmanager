import { describe, expect, it } from "vitest";
import {
  addFreeAgents,
  addYouth,
  aiTrainingPlan,
  applyTraining,
  baseDevelopment,
  retireChance,
  seasonAging,
  trimFreeAgents,
  validateTraining,
} from "../../../src/engine/economy/training";
import { Rng } from "../../../src/engine/rng";
import { makePlayer, makeState } from "../fixtures";

const none = new Set<string>();

describe("baseDevelopment", () => {
  it("Junge wachsen umso schneller, je größer der Abstand zum Potenzial", () => {
    expect(baseDevelopment(20, 50, 70)).toBeCloseTo(0.24);
    expect(baseDevelopment(20, 50, 51)).toBeCloseTo(0.05);
    expect(baseDevelopment(20, 40, 99)).toBe(0.35);
    expect(baseDevelopment(27, 60, 65)).toBe(0.03);
    expect(baseDevelopment(27, 65, 65)).toBe(0);
    expect(baseDevelopment(31, 70, 70)).toBe(-0.06);
    expect(baseDevelopment(34, 70, 70)).toBe(-0.15);
  });
});

describe("applyTraining", () => {
  function youngster(intensity: "light" | "normal" | "hard", individual = false) {
    const s = makeState([{ id: "c1", strength: 60 }]);
    const pid = "c1-MF1";
    Object.assign(s.players[pid], { age: 19, strength: 50, potential: 80 });
    s.clubs.c1.training = { intensity, focus: "technique", individual: individual ? [pid] : [] };
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    return s.players[pid].strength - 50;
  }

  it("hartes Training bringt mehr als lockeres, Förderung verdoppelt", () => {
    expect(youngster("normal")).toBeCloseTo(0.34);
    expect(youngster("hard")).toBeGreaterThan(youngster("normal"));
    expect(youngster("light")).toBeLessThan(youngster("normal"));
    expect(youngster("normal", true)).toBeCloseTo(0.68);
  });

  it("wächst nie über das Potenzial; Ältere bauen ab, nie unter 1", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    Object.assign(s.players["c1-FW1"], { age: 20, strength: 69.99, potential: 70 });
    Object.assign(s.players["c1-FW2"], { age: 35, strength: 1.05, potential: 1.05 });
    Object.assign(s.players["c1-FW3"], { age: 33, strength: 70, potential: 70 });
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.players["c1-FW1"].strength).toBe(70);
    expect(s.players["c1-FW2"].strength).toBe(1);
    expect(s.players["c1-FW3"].strength).toBeCloseTo(69.85);
  });

  it("Konditionsschwerpunkt erholt, hartes Training kostet Kondition", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.players["c1-DF1"].fitness = 60;
    s.clubs.c1.training = { intensity: "normal", focus: "fitness", individual: [] };
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.players["c1-DF1"].fitness).toBeCloseTo(77);
    s.clubs.c1.training = { intensity: "hard", focus: "technique", individual: [] };
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.players["c1-DF1"].fitness).toBeCloseTo(70);
  });

  it("Taktikschwerpunkt setzt den Bonus, sonst 1", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.clubs.c1.training = { intensity: "normal", focus: "tactics", individual: [] };
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.clubs.c1.tacticsBonus).toBe(1.03);
    s.clubs.c1.training.focus = "technique";
    applyTraining(s, "c1", none, Rng.fromSeed(1));
    expect(s.clubs.c1.tacticsBonus).toBe(1);
  });

  it("hartes Training verletzt manchmal, lockeres nie", () => {
    const rng = Rng.fromSeed(7);
    let hard = 0;
    let light = 0;
    for (let i = 0; i < 200; i++) {
      const s = makeState([{ id: "c1", strength: 60 }]);
      s.clubs.c1.training.intensity = "hard";
      hard += applyTraining(s, "c1", none, rng).length;
      s.clubs.c1.training.intensity = "light";
      for (const id of s.clubs.c1.squad) s.players[id].injury = null;
      light += applyTraining(s, "c1", none, rng).length;
    }
    expect(hard).toBeGreaterThan(10);
    expect(light).toBe(0);
  });
});

describe("validateTraining und aiTrainingPlan", () => {
  it("prüft Intensität, Schwerpunkt und Förderliste", () => {
    const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
    const ok = { intensity: "hard", focus: "tactics", individual: ["c1-MF1"] } as const;
    expect(validateTraining(s, "c1", { ...ok, individual: [...ok.individual] })).toBeNull();
    expect(validateTraining(s, "c1", { ...ok, individual: [], intensity: "x" as never })).toBe("Unbekannte Trainingsintensität.");
    expect(validateTraining(s, "c1", { ...ok, individual: [], focus: "x" as never })).toBe("Unbekannter Trainingsschwerpunkt.");
    expect(validateTraining(s, "c1", { ...ok, individual: ["c1-MF1", "c1-MF2", "c1-MF3", "c1-MF4"] })).toBe("Höchstens 3 Spieler im Extratraining.");
    expect(validateTraining(s, "c1", { ...ok, individual: ["c2-MF1"] })).toBe("Ein Spieler gehört nicht zum Kader.");
    expect(validateTraining(s, "c1", { ...ok, individual: ["c1-MF1", "c1-MF1"] })).toBe("Ein Spieler ist doppelt eingetragen.");
  });

  it("die KI fördert bis zu 3 junge Spieler mit großem Potenzial", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    Object.assign(s.players["c1-DF1"], { age: 19, potential: 85 });
    Object.assign(s.players["c1-MF1"], { age: 21, potential: 75 });
    Object.assign(s.players["c1-FW1"], { age: 30, potential: 90 });
    const plan = aiTrainingPlan(s, "c1");
    expect(plan.intensity).toBe("normal");
    expect(plan.focus).toBe("technique");
    expect(plan.individual).toEqual(["c1-DF1", "c1-MF1"]);
  });
});

describe("Saisonwechsel", () => {
  it("Karriereende-Wahrscheinlichkeit", () => {
    expect(retireChance(33)).toBe(0);
    expect(retireChance(34)).toBeCloseTo(0.3);
    expect(retireChance(38)).toBeCloseTo(0.9);
    expect(retireChance(40)).toBe(1);
  });

  it("alle altern um ein Jahr; 40-Jährige beenden die Karriere und verlassen den Verein", () => {
    const s = makeState([{ id: "c1", strength: 60 }]);
    s.players["c1-GK3"].age = 39;
    const before = s.players["c1-MF1"].age;
    const retired = seasonAging(s, Rng.fromSeed(1));
    expect(s.players["c1-MF1"].age).toBe(before + 1);
    expect(retired).toEqual(["c1-GK3"]);
    expect(s.players["c1-GK3"]).toMatchObject({ retired: true, clubId: null, contract: null });
    expect(s.clubs.c1.squad).not.toContain("c1-GK3");
    seasonAging(s, Rng.fromSeed(2));
    expect(s.players["c1-GK3"].age).toBe(40);
  });

  it("Nachwuchs: 2–3 Spieler pro Verein mit Vertrag und Potenzial", () => {
    const s = makeState([{ id: "c1", strength: 60 }, { id: "c2", strength: 60 }]);
    const ids = addYouth(s, Rng.fromSeed(4));
    for (const c of ["c1", "c2"]) {
      const youth = s.clubs[c].squad.filter((id) => ids.includes(id));
      expect(youth.length).toBeGreaterThanOrEqual(2);
      expect(youth.length).toBeLessThanOrEqual(3);
      for (const id of youth) {
        const p = s.players[id];
        expect(p.age).toBeGreaterThanOrEqual(16);
        expect(p.age).toBeLessThanOrEqual(18);
        expect(p.potential).toBeGreaterThanOrEqual(p.strength + 10);
        expect(p.contract).toEqual({ salary: expect.any(Number), endsSeason: s.season + 2 });
      }
    }
  });

  it("neue Vereinslose und Begrenzung des Pools", () => {
    const s = makeState([]);
    addFreeAgents(s, Rng.fromSeed(3), 25);
    const free = () => Object.values(s.players).filter((p) => p.clubId === null && !p.retired);
    expect(free()).toHaveLength(25);
    expect(free().every((p) => p.contract === null && p.age >= 22 && p.age <= 32)).toBe(true);
    s.players[free()[0].id].age = 40;
    trimFreeAgents(s, 20);
    expect(free()).toHaveLength(20);
    expect(free().some((p) => p.age === 40)).toBe(false);
  });

  it("makePlayer bleibt mit dem neuen Modell kompatibel", () => {
    expect(makePlayer("x", "GK", 50).retired).toBe(false);
  });
});
