// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

function game(names = ["Anna"]) {
  const controller = new GameController();
  const world = generateWorld(11);
  const ids = Object.keys(world.clubs);
  controller.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  render(App, { controller });
  return controller;
}

describe("„ist dran“", () => {
  it("zeigt Manager, Verein und Spieltag; Enter öffnet das Hauptmenü", async () => {
    const c = game();
    const club = c.snapshot!.state.clubs[c.snapshot!.state.managers[0].clubId!];
    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
    expect(screen.getAllByText(club.name).length).toBeGreaterThan(0);
    expect(screen.getByText(/Saison 1 · 1\. Spieltag/)).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Enter" });
    expect(c.view.kind).toBe("menu");
  });

  it("ignoriert Tastenwiederholung", async () => {
    const c = game();
    await fireEvent.keyDown(window, { key: "Enter", repeat: true });
    expect(c.view.kind).toBe("turnStart");
  });
});

describe("Hauptmenü", () => {
  it("hat 8 Kacheln, fünf davon gesperrt", async () => {
    const c = game();
    c.open("menu");
    await tick();
    const tiles = screen.getAllByRole("button").filter((b) => b.classList.contains("tile"));
    expect(tiles).toHaveLength(8);
    expect(tiles.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(5);
  });

  it("Taste 1 öffnet die Mannschaft, Taste 6 die Tabelle", async () => {
    const c = game();
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "1" });
    expect(c.view.kind).toBe("squad");
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "6" });
    expect(c.view.kind).toBe("tables");
  });

  it("ignoriert Tasten mit Modifier", async () => {
    const c = game();
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    expect(c.view.kind).toBe("menu");
  });

  it("gesperrte Kacheln reagieren nicht auf ihre Taste", async () => {
    const c = game();
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "2" });
    expect(c.view.kind).toBe("menu");
  });

  it("„Weiter“ übergibt an den nächsten Manager", async () => {
    const c = game(["Anna", "Ben"]);
    c.open("menu");
    await tick();
    await fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(c.view).toEqual({ kind: "turnStart", managerId: c.snapshot!.state.managers[1].id });
    expect(await screen.findByText("BEN IST DRAN")).toBeTruthy();
  });
});
