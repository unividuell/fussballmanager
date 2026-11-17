// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import { leagueClubIds } from "./game";
import App from "../../src/App.svelte";
import { expectationLabel } from "../../src/engine/economy/board";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

function game(names = ["Anna"]) {
  const controller = new GameController();
  const world = generateWorld(11);
  const ids = leagueClubIds(world);
  controller.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  render(App, { controller });
  return controller;
}

describe("„ist dran“", () => {
  it("zeigt Manager, Verein und Spieltag; Enter öffnet das Hauptmenü", async () => {
    const c = game();
    const club = c.snapshot!.state.clubs[c.snapshot!.state.managers[0].clubId];
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
  it("hat 10 Kacheln, keine gesperrt", async () => {
    const c = game();
    c.open("menu");
    await tick();
    const tiles = screen.getAllByRole("button").filter((b) => b.classList.contains("tile"));
    expect(tiles).toHaveLength(10);
    expect(tiles.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(0);
  });

  it("Taste 1 öffnet die Mannschaft, Taste 8 die Tabelle", async () => {
    const c = game();
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "1" });
    expect(c.view.kind).toBe("squad");
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "8" });
    expect(c.view.kind).toBe("tables");
  });

  it("Taste 0 startet den Spieltag wie Enter", async () => {
    for (const key of ["0", "Enter"]) {
      const c = game(["Anna", "Ben"]);
      c.open("menu");
      await tick();
      await fireEvent.keyDown(window, { key });
      expect(c.view).toEqual({ kind: "turnStart", managerId: c.snapshot!.state.managers[1].id });
    }
  });

  it("die Kopfzeile zeigt das Saisonziel", async () => {
    const c = game();
    c.open("menu");
    await tick();
    const club = c.snapshot!.state.clubs[c.snapshot!.state.managers[0].clubId];
    const league = c.snapshot!.state.competitions.L1.clubs.includes(club.id) ? "L1" : "L2";
    expect(screen.getByText(`Ziel: ${expectationLabel(club.board.expectation, league)}`)).toBeTruthy();
  });

  it("ignoriert Tasten mit Modifier", async () => {
    const c = game();
    c.open("menu");
    await tick();
    await fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    expect(c.view.kind).toBe("menu");
  });

  it("Tasten 2 bis 7 und 9 öffnen die Vereins-Bildschirme", async () => {
    const c = game();
    const expected: [string, string][] = [
      ["2", "training"], ["3", "contracts"], ["4", "transfers"], ["5", "finance"], ["6", "stadium"], ["7", "board"], ["9", "messages"],
    ];
    for (const [key, kind] of expected) {
      c.open("menu");
      await tick();
      await fireEvent.keyDown(window, { key });
      expect(c.view.kind).toBe(kind);
    }
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
