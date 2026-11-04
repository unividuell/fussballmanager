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

  describe("Übernahme eines freien Zweitligisten", () => {
    function weakestFree(s: Record<string, any>, n: number): string[] {
      return (s.competitions.L2.clubs as string[])
        .map((id) => s.clubs[id])
        .filter((c) => c.managerId === null)
        .sort((a, b) => a.reputation - b.reputation || (a.id < b.id ? -1 : 1))
        .slice(0, n)
        .map((c) => c.id);
    }

    function fireAll(s: Record<string, any>): void {
      for (const m of s.managers) {
        s.clubs[m.clubId].managerId = null;
        m.clubId = null;
      }
    }

    it("zwei entlassene Manager bekommen die zwei schwächsten freien Zweitligisten", () => {
      const s = v1State();
      fireAll(s);
      const [first, second] = weakestFree(s, 2);
      const r = migrate(s);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.managers.map((m) => m.clubId)).toEqual([first, second]);
      expect(first).not.toBe(second);
      expect(r.state.clubs[first].managerId).toBe(r.state.managers[0].id);
      expect(r.state.clubs[second].managerId).toBe(r.state.managers[1].id);
      expect(validateState(r.state)).toBeNull();
    });

    it("schließt offene Angebote und Verhandlungen des übernommenen Vereins", () => {
      const s = v1State();
      const anna = s.managers[0];
      s.clubs[anna.clubId].managerId = null;
      anna.clubId = null;
      const [free] = weakestFree(s, 1);
      const other = s.managers[1];
      const ownPlayer = s.clubs[free].squad[0];
      const foreignPlayer = s.clubs[other.clubId].squad[0];
      const offer = (id: string, fromClub: string, status = "open") => ({ id, managerId: other.id, fromClub, playerId: foreignPlayer, fee: 1, maxFee: 2, round: 1, status, season: 1, expiresAfter: 5 });
      const neg = (id: string, playerId: string, status = "open") => ({ id, managerId: other.id, playerId, stage: "fee", fee: null, ask: 1, round: 1, desiredYears: 2, status, note: "", season: 1, createdAt: 0 });
      s.transferOffers = [offer("o1", free), offer("o2", other.clubId), offer("o3", free, "rejected")];
      s.negotiations = [neg("n1", ownPlayer), neg("n2", foreignPlayer), neg("n3", ownPlayer, "accepted")];

      const r = migrate(s);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.transferOffers.map((o) => o.status)).toEqual(["withdrawn", "open", "rejected"]);
      expect(r.state.negotiations.map((n) => n.status)).toEqual(["aborted", "open", "accepted"]);
      expect(r.state.negotiations[0].note).toBe("Der Verein hat einen neuen Trainer.");
      expect(validateState(r.state)).toBeNull();
    });

    it("der übernehmende Manager bekommt eine Willkommensnachricht", () => {
      const s = v1State();
      const anna = s.managers[0];
      s.clubs[anna.clubId].managerId = null;
      anna.clubId = null;
      const [free] = weakestFree(s, 1);
      const nextId = s.nextId;
      const count = s.messages.length;
      const r = migrate(s);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.nextId).toBe(nextId + 1);
      expect(r.state.messages).toHaveLength(count + 1);
      expect(r.state.messages[count]).toEqual({
        id: `msg${nextId}`,
        managerId: anna.id,
        season: s.season,
        calendarIndex: s.calendarIndex,
        text: `Willkommen beim ${s.clubs[free].name}!`,
        ref: null,
      });
      expect(validateState(r.state)).toBeNull();
    });
  });
});
