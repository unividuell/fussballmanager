// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { Session } from "../../src/session/session";
import { SaveStore } from "../../src/storage/store";
import { GameController } from "../../src/ui/controller.svelte";

function started(store: SaveStore | null = null): GameController {
  const c = new GameController({ store });
  const world = generateWorld(3);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  return c;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Fehler am Spieltag", () => {
  it("advance: Zustand bleibt, „erneut versuchen“ wiederholt den Schritt", async () => {
    const c = started();
    await c.endTurn(c.snapshot!.state.managers[0].id);
    const before = c.snapshot;
    vi.spyOn(Session.prototype, "advance").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    c.advance();
    expect(c.failure).not.toBeNull();
    expect(c.snapshot).toBe(before);
    expect(c.view).toEqual({ kind: "live", half: 1 });
    c.retryFailure();
    expect(c.failure).toBeNull();
    expect(c.view.kind).toBe("halftime");
  });

  it("send: ein Fehler beim Anpfiff lässt den Manager dran, „erneut versuchen“ startet den Spieltag", async () => {
    const c = started();
    const anna = c.snapshot!.state.managers[0];
    vi.spyOn(Session.prototype, "dispatch").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    expect(await c.endTurn(anna.id)).toBe(false);
    expect(c.failure).not.toBeNull();
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
    c.retryFailure();
    await new Promise((r) => setTimeout(r, 0));
    expect(c.view).toEqual({ kind: "live", half: 1 });
  });

  it("zeigt den Fehlerdialog und wiederholt per Klick", async () => {
    const c = started();
    await c.endTurn(c.snapshot!.state.managers[0].id);
    vi.spyOn(Session.prototype, "advance").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    render(App, { controller: c });
    c.advance();
    await tick();
    expect(screen.getByRole("dialog", { name: "FEHLER" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Autosave laden" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Spieltag erneut versuchen" }));
    expect(screen.queryByRole("dialog", { name: "FEHLER" })).toBeNull();
    expect(c.view.kind).toBe("halftime");
  });

  it("blockiert advance hinter dem Dialog, „erneut versuchen“ geht genau einen Schritt weiter", async () => {
    const c = started();
    await c.endTurn(c.snapshot!.state.managers[0].id);
    const advanceSpy = vi.spyOn(Session.prototype, "advance").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    c.advance();
    const before = c.snapshot;
    c.advance();
    expect(advanceSpy).toHaveBeenCalledTimes(1);
    expect(c.failure).not.toBeNull();
    expect(c.snapshot).toBe(before);
    expect(c.view).toEqual({ kind: "live", half: 1 });
    c.retryFailure();
    expect(advanceSpy).toHaveBeenCalledTimes(2);
    expect(c.view.kind).toBe("halftime");
  });

  it("blockiert send hinter dem Dialog", async () => {
    const c = started();
    const anna = c.snapshot!.state.managers[0];
    await c.endTurn(anna.id);
    vi.spyOn(Session.prototype, "advance").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    c.advance();
    const before = c.snapshot;
    const dispatchSpy = vi.spyOn(Session.prototype, "dispatch");
    expect(await c.endTurn(anna.id)).toBe(false);
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(c.snapshot).toBe(before);
    expect(c.failure).not.toBeNull();
  });

  it("„Autosave laden“ stellt den letzten Autosave her und schließt den Dialog", async () => {
    const store = new SaveStore(new IDBFactory());
    const c = started(store);
    await c.lastAutosave;
    await c.refreshSlots();
    const anna = c.snapshot!.state.managers[0];
    await c.endTurn(anna.id);
    vi.spyOn(Session.prototype, "advance").mockImplementationOnce(() => {
      throw new Error("kaputt");
    });
    render(App, { controller: c });
    c.advance();
    await tick();
    await userEvent.click(screen.getByRole("button", { name: "Autosave laden" }));
    await vi.waitFor(() => expect(c.failure).toBeNull());
    expect(screen.queryByRole("dialog", { name: "FEHLER" })).toBeNull();
    expect(c.view.kind).toBe("turnStart");
  });
});
