import { describe, expect, it } from "vitest";
import savedV1 from "./fixtures/save-v1.json?raw";
import type { GameState } from "../../src/engine/model";
import { Session } from "../../src/session/session";
import { migrate, type Migration } from "../../src/storage/migrate";
import { DAMAGED, decodeSave, encodeSave, makeMeta, NOT_A_SAVE, parseMeta, TOO_NEW } from "../../src/storage/savefile";
import { validateState } from "../../src/storage/validate";
import { newTestGame } from "../ui/game";

const META = { managers: ["Anna"], season: 1, label: "1. Spieltag", savedAt: "2026-11-04T12:00:00.000Z" };

function playMatchday(session: Session): void {
  const start = session.snapshot.state.calendarIndex;
  do {
    const p = session.snapshot.phase;
    if (p.kind === "managerTurns" || p.kind === "halftime") expect(session.dispatch({ type: "endTurn", managerId: p.pending[0] })).toBeNull();
    else expect(session.advance()).toBeNull();
  } while (!(session.snapshot.phase.kind === "managerTurns" && session.snapshot.state.calendarIndex > start));
}

describe("Spielstand-Datei", () => {
  it("übersteht Speichern und Laden unverändert", () => {
    const s = newTestGame(["Anna", "Ben"]);
    const r = decodeSave(encodeSave(s, META));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.state).toEqual(s);
    expect(r.file.meta).toEqual(META);
  });

  it("makeMeta nimmt Manager, Saison, Spieltag und Zeitpunkt auf", () => {
    const s = newTestGame(["Anna", "Ben"]);
    expect(makeMeta(s, "1. Spieltag", new Date("2026-11-04T12:00:00.000Z"))).toEqual({
      managers: ["Anna", "Ben"],
      season: 1,
      label: "1. Spieltag",
      savedAt: "2026-11-04T12:00:00.000Z",
    });
  });

  it("parseMeta lehnt unvollständige Metadaten ab", () => {
    expect(parseMeta(META)).toEqual(META);
    expect(parseMeta({ ...META, managers: [1] })).toBeNull();
    expect(parseMeta({ ...META, season: "1" })).toBeNull();
    expect(parseMeta(null)).toBeNull();
  });

  it("meldet kaputtes JSON als beschädigt", () => {
    expect(decodeSave("{kaputt")).toEqual({ ok: false, error: DAMAGED });
  });

  it("erkennt fremde Dateien", () => {
    expect(decodeSave(JSON.stringify({ hallo: 1 }))).toEqual({ ok: false, error: NOT_A_SAVE });
  });

  it("lehnt Spielstände aus einer neueren Version ab", () => {
    const s = { ...newTestGame(), version: 2 } as unknown as GameState;
    expect(decodeSave(encodeSave(s, META))).toEqual({ ok: false, error: TOO_NEW });
  });

  it("meldet einen fehlenden Spieler im Kader", () => {
    const s = newTestGame();
    const club = Object.values(s.clubs)[0];
    delete s.players[club.squad[0]];
    const r = decodeSave(encodeSave(s, META));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^Der Spielstand ist beschädigt\. \(Spieler .+ fehlt\)$/);
  });

  it("meldet einen Verein ohne Kader", () => {
    const s = newTestGame();
    const club = Object.values(s.clubs)[0];
    club.squad = [];
    expect(validateState(s)).toBe(`Verein ${club.id} hat keinen Kader`);
  });

  it("meldet einen Manager, dessen Verein fehlt", () => {
    const s = newTestGame();
    s.managers[0].clubId = "gibtsnicht";
    expect(validateState(s)).toBe("Verein gibtsnicht fehlt");
  });

  it("ein frisch gestartetes Spiel ist gültig", () => {
    expect(validateState(newTestGame(["Anna", "Ben", "Cem", "Dana"]))).toBeNull();
  });
});

describe("Migration", () => {
  const raw = () => JSON.parse(JSON.stringify(newTestGame())) as Record<string, unknown>;

  it("lässt den aktuellen Stand unverändert", () => {
    const s = raw();
    const r = migrate(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(s);
  });

  it("führt die Schritte der Reihe nach bis zur aktuellen Version aus", () => {
    const order: number[] = [];
    const steps: Record<number, Migration> = {
      1: (s) => (order.push(1), { ...s, version: 2, eins: true }),
      2: (s) => (order.push(2), { ...s, version: 3, zwei: s.eins === true }),
    };
    const r = migrate(raw(), steps, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(order).toEqual([1, 2]);
    expect(r.state.version).toBe(3);
    expect((r.state as unknown as Record<string, unknown>).zwei).toBe(true);
  });

  it("meldet einen fehlenden Migrationsschritt", () => {
    expect(migrate(raw(), {}, 2)).toEqual({ ok: false, error: "Für Version 1 gibt es keine Migration." });
  });

  it("meldet einen Schritt, der die Version nicht erhöht", () => {
    expect(migrate(raw(), { 1: (s) => s }, 2)).toEqual({ ok: false, error: "Die Migration von Version 1 ist fehlerhaft." });
  });

  it("meldet einen Stand ohne gültige Version als beschädigt", () => {
    expect(migrate({ clubs: {} })).toEqual({ ok: false, error: DAMAGED });
    expect(migrate("text")).toEqual({ ok: false, error: DAMAGED });
  });
});

describe("v1-Testdatei", () => {
  it("lässt sich laden und weiterspielen", () => {
    const r = decodeSave(savedV1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.state.version).toBe(1);
    expect(r.file.meta).toEqual({ managers: ["Anna", "Ben"], season: 1, label: "2. Spieltag", savedAt: "2026-11-04T12:00:00.000Z" });
    expect(r.file.state.calendarIndex).toBe(1);
    const session = new Session(r.file.state);
    playMatchday(session);
    expect(session.snapshot.state.calendarIndex).toBe(2);
    expect(validateState(session.snapshot.state)).toBeNull();
  });
});
