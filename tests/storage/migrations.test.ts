import { describe, expect, it } from "vitest";
import { migrate } from "../../src/storage/migrate";
import { v1ToV2 } from "../../src/storage/migrations";
import { decodeSave } from "../../src/storage/savefile";
import { validateState } from "../../src/storage/validate";
import savedV1 from "./fixtures/save-v1.json?raw";

function v1State(): Record<string, any> {
  return JSON.parse(savedV1).state;
}

describe("Migration v1 → v2", () => {
  it("die eingefrorene v1-Datei lädt als v2 ohne Jobfelder", () => {
    const r = decodeSave(savedV1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.state.version).toBe(2);
    for (const m of r.file.state.managers) expect(Object.keys(m).sort()).toEqual(["clubId", "id", "name"]);
  });

  it("ein entlassener Manager bekommt den schwächsten freien Zweitligisten", () => {
    const s = v1State();
    const anna = s.managers[0];
    const old = anna.clubId;
    s.clubs[old].managerId = null;
    anna.clubId = null;
    anna.jobOffers = [s.competitions.L1.clubs[0]];
    anna.unemployedFor = 2;
    s.messages.push({ id: "msgX", managerId: anna.id, season: 1, calendarIndex: 1, text: "Jobangebote: …", ref: { type: "jobOffer", id: anna.jobOffers[0] } });

    const free = (s.competitions.L2.clubs as string[])
      .map((id) => s.clubs[id])
      .filter((c) => c.managerId === null)
      .sort((a, b) => a.reputation - b.reputation || (a.id < b.id ? -1 : 1))[0];

    const r = migrate(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.state.managers[0];
    expect(m.clubId).toBe(free.id);
    expect(r.state.clubs[free.id].managerId).toBe(m.id);
    expect(r.state.clubs[free.id].board.confidence).toBe(60);
    expect(r.state.messages.find((x) => x.id === "msgX")!.ref).toBeNull();
    expect(validateState(r.state)).toBeNull();
  });

  it("v1ToV2 setzt die Version auf 2 und verändert nichts anderes an Vereinen mit Manager", () => {
    const s = v1State();
    const before = JSON.parse(JSON.stringify(s.clubs));
    const out = v1ToV2(s);
    expect(out.version).toBe(2);
    expect(out.clubs).toEqual(before);
  });
});
