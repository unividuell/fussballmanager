// @vitest-environment jsdom
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { Session } from "../../src/session/session";
import { GameController } from "../../src/ui/controller.svelte";

function started(): GameController {
  const c = new GameController();
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
    expect(c.view).toEqual({ kind: "conference", half: 1 });
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
    expect(c.view).toEqual({ kind: "conference", half: 1 });
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
});
