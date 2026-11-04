// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { SaveStore } from "../../src/storage/store";
import { GameController, NO_STORE, SAVE_ONLY_BEFORE } from "../../src/ui/controller.svelte";

function setup(names = ["Anna", "Ben"], store: SaveStore | null = new SaveStore(new IDBFactory())) {
  const c = new GameController({ store });
  const world = generateWorld(7);
  const ids = Object.keys(world.clubs);
  const error = c.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  if (error) throw new Error(error);
  return { c, store: store! };
}

async function playMatchday(c: GameController): Promise<void> {
  const start = c.snapshot!.state.calendarIndex;
  while (!(c.snapshot!.phase.kind === "managerTurns" && c.snapshot!.state.calendarIndex > start)) {
    const p = c.snapshot!.phase;
    if (p.kind === "managerTurns" || p.kind === "halftime") await c.endTurn(p.pending[0]);
    else c.advance();
  }
}

describe("Controller: Speichern und Laden", () => {
  it("legt beim Spielstart einen Autosave an und kennt danach die Slots", async () => {
    const { c, store } = setup();
    await c.lastAutosave;
    const auto = (await store.list())[0];
    expect(auto.meta?.managers).toEqual(["Anna", "Ben"]);
    expect(auto.meta?.label).toBe("1. Spieltag");
    expect(c.slots[0].meta?.label).toBe("1. Spieltag");
  });

  it("überschreibt den Autosave nach jedem Spieltag", async () => {
    const { c, store } = setup();
    await playMatchday(c);
    await c.lastAutosave;
    const r = await store.load("auto");
    expect(r.ok && r.file.state.calendarIndex).toBe(1);
  });

  it("speichert in einen Slot und lädt ihn wieder", async () => {
    const { c } = setup();
    expect(await c.saveTo("slot2")).toBe(true);
    expect(c.message).toBe("Gespeichert.");
    expect(c.slots[2].meta?.season).toBe(1);
    await playMatchday(c);
    expect(await c.loadFrom("slot2")).toBe(true);
    const anna = c.snapshot!.state.managers[0];
    expect(c.snapshot!.state.calendarIndex).toBe(0);
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
  });

  it("mitten in der Hot-Seat-Runde gespeichert: nach dem Laden ist wieder Manager 1 dran, seine Änderungen bleiben", async () => {
    const { c } = setup();
    const [anna, ben] = c.snapshot!.state.managers;
    const clubId = anna.clubId!;
    const current = c.snapshot!.state.clubs[clubId].finance.ticketPrice;
    const price = current < 100 ? current + 1 : current - 1;
    expect(await c.send({ type: "setTicketPrice", managerId: anna.id, price })).toBe(true);
    await c.endTurn(anna.id);
    expect(c.view).toEqual({ kind: "turnStart", managerId: ben.id });
    expect(await c.saveTo("slot1")).toBe(true);
    expect(await c.loadFrom("slot1")).toBe(true);
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
    expect(c.snapshot!.state.clubs[clubId].finance.ticketPrice).toBe(price);
  });

  it("speichert nicht während der Konferenz", async () => {
    const { c } = setup(["Anna"]);
    await c.endTurn(c.snapshot!.state.managers[0].id);
    expect(c.view.kind).toBe("conference");
    expect(await c.saveTo("slot1")).toBe(false);
    expect(c.message).toBe(SAVE_ONLY_BEFORE);
  });

  it("ein leerer Slot lässt das laufende Spiel unverändert", async () => {
    const { c } = setup();
    const before = c.snapshot;
    expect(await c.loadFrom("slot3")).toBe(false);
    expect(c.message).toBe("Dieser Slot ist leer.");
    expect(c.snapshot).toBe(before);
  });

  it("Export und Import ergeben denselben Spielstand", () => {
    const { c } = setup();
    const file = c.exportFile()!;
    expect(file.name).toBe("fussballmanager-s1-t1.json");
    const other = new GameController();
    expect(other.importText(file.text)).toBe(true);
    expect(other.snapshot!.state).toEqual(c.snapshot!.state);
    expect(other.view.kind).toBe("turnStart");
  });

  it("ein kaputter Import lässt das laufende Spiel unverändert", () => {
    const { c } = setup();
    const before = c.snapshot;
    expect(c.importText("kaputt")).toBe(false);
    expect(c.message).toBe("Der Spielstand ist beschädigt.");
    expect(c.snapshot).toBe(before);
    expect(c.importText(JSON.stringify({ hallo: 1 }))).toBe(false);
    expect(c.message).toBe("Das ist kein Spielstand dieses Spiels.");
  });

  it("scheitert der Autosave, gibt es eine Meldung und das Spiel geht weiter", async () => {
    const store = new SaveStore(new IDBFactory());
    vi.spyOn(store, "save").mockRejectedValue(new Error("voll"));
    const { c } = setup(["Anna"], store);
    await c.lastAutosave;
    expect(c.autosaveFailed).toBe(true);
    await playMatchday(c);
    await c.lastAutosave;
    expect(c.autosaveFailed).toBe(true);
    expect(c.snapshot!.state.calendarIndex).toBe(1);
  });

  it("ein späterer erfolgreicher Autosave nimmt die Warnung zurück", async () => {
    const store = new SaveStore(new IDBFactory());
    const spy = vi.spyOn(store, "save").mockRejectedValueOnce(new Error("voll"));
    const { c } = setup(["Anna"], store);
    await c.lastAutosave;
    expect(c.autosaveFailed).toBe(true);
    spy.mockRestore();
    await playMatchday(c);
    await c.lastAutosave;
    expect(c.autosaveFailed).toBe(false);
  });

  it("solange ein Berechnungsfehler offen ist, wechselt open() den Bildschirm nicht", () => {
    const { c } = setup(["Anna"]);
    c.failure = { retry: () => {} };
    c.open("squad");
    c.openTransfers("mine");
    c.openStart("loadGame");
    expect(c.view.kind).toBe("turnStart");
    expect(c.transferTab).toBe("market");
    expect(c.startScreen).toBe("newGame");
  });

  it("ohne Speicher melden Speichern und Laden das", async () => {
    const { c } = setup(["Anna"], null);
    expect(c.hasStore).toBe(false);
    expect(await c.saveTo("slot1")).toBe(false);
    expect(c.message).toBe(NO_STORE);
    expect(await c.loadFrom("auto")).toBe(false);
    expect(c.message).toBe(NO_STORE);
    expect(c.slots).toEqual([]);
  });

  it("openStart wechselt den Bildschirm vor dem Spiel", () => {
    const c = new GameController();
    expect(c.view).toEqual({ kind: "newGame" });
    c.openStart("loadGame");
    expect(c.view).toEqual({ kind: "loadGame" });
  });
});
