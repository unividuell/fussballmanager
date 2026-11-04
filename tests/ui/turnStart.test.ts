// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

function started(): GameController {
  const c = new GameController();
  const world = generateWorld(4);
  const ids = Object.keys(world.clubs);
  c.startGame(world, [{ name: "Anna", clubId: ids[0] }, { name: "Ben", clubId: ids[20] }]);
  return c;
}

describe("„ist dran“ und Nachrichten ohne Sonderfall", () => {
  it("„ist dran“ zeigt den Verein, Enter öffnet das Hauptmenü", async () => {
    const c = started();
    render(App, { controller: c });
    await tick();
    const club = c.snapshot!.state.clubs[c.snapshot!.state.managers[0].clubId!];
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
    expect(screen.getAllByText(club.name).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Ohne Verein")).toBeNull();
    await fireEvent.keyDown(window, { key: "Enter" });
    expect(c.view.kind).toBe("menu");
  });

  it("jeder Bildschirm ist erreichbar; Nachrichten: Esc führt ins Hauptmenü", async () => {
    const c = started();
    const anna = c.snapshot!.state.managers[0].id;
    for (const s of ["squad", "training", "contracts", "transfers", "finance", "tables", "messages", "save", "options"] as const) {
      c.open(s);
      expect(c.view).toEqual({ kind: s, managerId: anna });
    }
    c.open("messages");
    render(App, { controller: c });
    await tick();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });
});
