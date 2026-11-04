// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { SaveStore } from "../../src/storage/store";
import { GameController } from "../../src/ui/controller.svelte";
import { formatSavedAt, slotName } from "../../src/ui/logic/saves";

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await tick();
  }
};

function startIn(store: SaveStore): GameController {
  const c = new GameController({ store });
  const world = generateWorld(3);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  return c;
}

afterEach(() => vi.restoreAllMocks());

describe("Hilfen", () => {
  it("benennt Slots und formatiert das Datum", () => {
    expect(slotName("auto")).toBe("Autosave");
    expect(slotName("slot2")).toBe("Slot 2");
    expect(formatSavedAt(new Date(2026, 10, 4, 14, 5).toISOString())).toBe("04.11.2026 14:05");
    expect(formatSavedAt("Unsinn")).toBe("");
  });
});

describe("Speichern & Laden", () => {
  it("vor dem Spiel: „Spiel laden“ zeigt leere Slots, Esc führt zurück", async () => {
    const c = new GameController({ store: new SaveStore(new IDBFactory()) });
    render(App, { controller: c });
    await settle();
    expect(screen.queryByRole("button", { name: "Weiterspielen" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Spiel laden" }));
    await settle();
    expect(screen.getByText("SPIEL LADEN")).toBeTruthy();
    expect(screen.getAllByText("– leer –")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /speichern$/ })).toBeNull();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByText("NEUES SPIEL")).toBeTruthy();
  });

  it("„Weiterspielen“ lädt den Autosave", async () => {
    const store = new SaveStore(new IDBFactory());
    await startIn(store).lastAutosave;
    const c = new GameController({ store });
    render(App, { controller: c });
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Weiterspielen" }));
    await settle();
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
  });

  it("im Spiel: Taste S, in Slot 1 speichern, beim Überschreiben nachfragen", async () => {
    const c = startIn(new SaveStore(new IDBFactory()));
    c.open("menu");
    render(App, { controller: c });
    await settle();
    await fireEvent.keyDown(window, { key: "s" });
    await settle();
    expect(screen.getByText("SPEICHERN & LADEN")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "In Slot 1 speichern" }));
    await settle();
    expect(screen.getByText("Gespeichert.")).toBeTruthy();
    expect(screen.getAllByText(/Anna · Saison 1 · 1\. Spieltag/).length).toBeGreaterThanOrEqual(2);
    await userEvent.click(screen.getByRole("button", { name: "In Slot 1 speichern" }));
    expect(screen.getByText("Slot 1 überschreiben?")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Slot 1 überschreiben?")).toBeNull();
    expect(screen.getByText("SPEICHERN & LADEN")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });

  it("im Spiel: Laden fragt nach und wechselt dann zum geladenen Stand", async () => {
    const c = startIn(new SaveStore(new IDBFactory()));
    await c.lastAutosave;
    c.open("save");
    render(App, { controller: c });
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Autosave laden" }));
    expect(screen.getByText(/Nicht gespeicherter Fortschritt geht verloren/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ja" }));
    await settle();
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
  });

  it("Import einer Datei startet das Spiel; eine kaputte Datei bietet den Autosave an", async () => {
    const store = new SaveStore(new IDBFactory());
    const source = startIn(store);
    await source.lastAutosave;
    const good = source.exportFile()!.text;
    const c = new GameController({ store });
    c.openStart("loadGame");
    render(App, { controller: c });
    await settle();
    const input = screen.getByLabelText("Datei importieren") as HTMLInputElement;
    await userEvent.upload(input, new File(["kaputt"], "x.json", { type: "application/json" }));
    await settle();
    expect(screen.getByText("Der Spielstand ist beschädigt.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Autosave laden" }).length).toBe(2);
    await userEvent.upload(input, new File([good], "gut.json", { type: "application/json" }));
    await settle();
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
  });

  it("im Spiel: Import fragt vor dem Ersetzen nach; „Nein“ behält das laufende Spiel", async () => {
    const store = new SaveStore(new IDBFactory());
    const source = startIn(store);
    await source.lastAutosave;
    const good = source.exportFile()!.text;
    const c = startIn(store);
    const before = c.snapshot;
    c.open("save");
    render(App, { controller: c });
    await settle();
    const input = screen.getByLabelText("Datei importieren") as HTMLInputElement;
    await userEvent.upload(input, new File([good], "gut.json", { type: "application/json" }));
    await settle();
    expect(screen.getByText("Datei laden? Nicht gespeicherter Fortschritt geht verloren.")).toBeTruthy();
    expect(c.snapshot).toBe(before);
    await userEvent.click(screen.getByRole("button", { name: "Nein" }));
    expect(c.snapshot).toBe(before);
    await userEvent.upload(input, new File([good], "gut.json", { type: "application/json" }));
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Ja" }));
    await settle();
    expect(c.snapshot).not.toBe(before);
    expect(c.view.kind).toBe("turnStart");
  });

  it("Export lädt eine JSON-Datei herunter", async () => {
    const created: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((b: Blob) => (created.push(b), "blob:x")),
      revokeObjectURL: vi.fn(),
    });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const c = startIn(new SaveStore(new IDBFactory()));
    c.open("save");
    render(App, { controller: c });
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Exportieren" }));
    expect(created).toHaveLength(1);
    expect(clicked).toHaveBeenCalled();
    expect(JSON.parse(await created[0].text()).format).toBe("fussballmanager-spielstand");
  });
});

describe("Autosave-Warnung", () => {
  it("bleibt auf „ist dran“ sichtbar, bis ein Autosave wieder klappt", async () => {
    const store = new SaveStore(new IDBFactory());
    const spy = vi.spyOn(store, "save").mockRejectedValue(new Error("voll"));
    const c = startIn(store);
    render(App, { controller: c });
    await settle();
    expect(screen.getByText(/Autosave fehlgeschlagen – der Spielstand wird nicht automatisch gespeichert/)).toBeTruthy();
    c.open("menu");
    await settle();
    expect(screen.getByText("Autosave aus")).toBeTruthy();
    spy.mockRestore();
    for (let guard = 0; c.snapshot!.state.calendarIndex < 1 || c.snapshot!.phase.kind !== "managerTurns"; guard++) {
      expect(guard).toBeLessThan(50);
      const p = c.snapshot!.phase;
      if (p.kind === "managerTurns" || p.kind === "halftime") await c.endTurn(p.pending[0]);
      else c.advance();
    }
    await c.lastAutosave;
    await settle();
    expect(screen.queryByText(/Autosave fehlgeschlagen/)).toBeNull();
    expect(screen.queryByText("Autosave aus")).toBeNull();
  });
});

describe("Neues Spiel mit vorhandenem Autosave", () => {
  async function pick(): Promise<void> {
    const select = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: select.querySelectorAll("option")[1].value } });
  }

  it("fragt vor „Anpfiff!“ nach; Esc und „Nein“ brechen ab, „Ja“ startet", async () => {
    const store = new SaveStore(new IDBFactory());
    await startIn(store).lastAutosave;
    const c = new GameController({ store });
    render(App, { controller: c });
    await settle();
    await pick();
    await userEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    expect(screen.getByText(/Der Autosave des bisherigen Spiels wird überschrieben/)).toBeTruthy();
    expect(c.view.kind).toBe("newGame");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(/wird überschrieben/)).toBeNull();
    expect(c.view.kind).toBe("newGame");
    await userEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    await userEvent.click(screen.getByRole("button", { name: "Nein" }));
    expect(c.view.kind).toBe("newGame");
    await userEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    await userEvent.click(screen.getByRole("button", { name: "Ja" }));
    expect(c.view.kind).toBe("turnStart");
  });
});
