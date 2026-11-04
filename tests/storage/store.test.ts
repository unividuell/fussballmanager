import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { DAMAGED } from "../../src/storage/savefile";
import { EMPTY_SLOT, SaveStore } from "../../src/storage/store";
import { newTestGame } from "../ui/game";

const NOW = new Date("2026-11-04T12:00:00.000Z");

describe("SaveStore", () => {
  it("listet ohne Spielstände vier leere Slots", async () => {
    const store = new SaveStore(new IDBFactory());
    expect(await store.list()).toEqual([
      { slot: "auto", meta: null, damaged: false },
      { slot: "slot1", meta: null, damaged: false },
      { slot: "slot2", meta: null, damaged: false },
      { slot: "slot3", meta: null, damaged: false },
    ]);
  });

  it("speichert und lädt einen Slot mit Metadaten", async () => {
    const store = new SaveStore(new IDBFactory());
    const s = newTestGame(["Anna", "Ben"]);
    await store.save("slot2", s, "1. Spieltag", NOW);
    const slots = await store.list();
    expect(slots[2]).toEqual({
      slot: "slot2",
      meta: { managers: ["Anna", "Ben"], season: 1, label: "1. Spieltag", savedAt: NOW.toISOString() },
      damaged: false,
    });
    const r = await store.load("slot2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.state).toEqual(s);
  });

  it("überschreibt einen Slot", async () => {
    const store = new SaveStore(new IDBFactory());
    const s = newTestGame();
    await store.save("auto", s, "1. Spieltag", NOW);
    await store.save("auto", { ...s, calendarIndex: 3 }, "4. Spieltag", NOW);
    const r = await store.load("auto");
    expect(r.ok && r.file.state.calendarIndex).toBe(3);
    expect((await store.list())[0].meta?.label).toBe("4. Spieltag");
  });

  it("meldet einen leeren Slot", async () => {
    expect(await new SaveStore(new IDBFactory()).load("slot1")).toEqual({ ok: false, error: EMPTY_SLOT });
  });

  it("meldet beschädigte Daten beim Laden und beschädigte Metadaten in der Liste", async () => {
    const store = new SaveStore(new IDBFactory());
    await store.put("slot1", { managers: ["Anna"], season: 1, label: "x", savedAt: NOW.toISOString() }, "{kaputt");
    await store.put("slot3", "unsinn", "{}");
    expect(await store.load("slot1")).toEqual({ ok: false, error: DAMAGED });
    const slots = await store.list();
    expect(slots[1].damaged).toBe(false);
    expect(slots[3]).toEqual({ slot: "slot3", meta: null, damaged: true });
  });

  it("die Daten überdauern eine neue Verbindung zur selben Datenbank", async () => {
    const factory = new IDBFactory();
    await new SaveStore(factory).save("slot1", newTestGame(), "1. Spieltag", NOW);
    expect((await new SaveStore(factory).load("slot1")).ok).toBe(true);
  });
});
