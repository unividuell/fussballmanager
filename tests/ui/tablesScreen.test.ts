// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import Tables from "../../src/ui/screens/Tables.svelte";

function setup(clubIndex = 25) {
  const controller = new GameController();
  const world = generateWorld(5);
  const clubId = Object.keys(world.clubs)[clubIndex];
  controller.startGame(world, [{ name: "Anna", clubId }]);
  const managerId = controller.snapshot!.state.managers[0].id;
  const onBack = vi.fn();
  render(Tables, { controller, managerId, onBack });
  return { controller, clubId, onBack };
}

describe("Tabelle und Spielplan", () => {
  it("beginnt mit der Liga des Managers und hebt seinen Verein hervor", () => {
    const { controller, clubId } = setup(25);
    const state = controller.snapshot!.state;
    const leagueName = state.competitions["L2"].clubs.includes(clubId) ? "2. Liga" : "1. Liga";
    expect(screen.getByRole("button", { name: leagueName }).classList.contains("selected")).toBe(true);
    const table = screen.getByRole("table", { name: "Tabelle" });
    expect(within(table).getAllByRole("row")).toHaveLength(19);
    const mine = table.querySelector("tr.mine")!;
    expect(mine.textContent).toContain(state.clubs[clubId].name);
  });

  it("wechselt die Liga", async () => {
    setup(0);
    await fireEvent.click(screen.getByRole("button", { name: "2. Liga" }));
    expect(screen.getByRole("button", { name: "2. Liga" }).classList.contains("selected")).toBe(true);
    expect(within(screen.getByRole("table", { name: "Tabelle" })).getAllByRole("row")).toHaveLength(19);
  });

  it("blättert im Spielplan und bleibt zwischen 1 und 34", async () => {
    setup(0);
    expect(screen.getByText("1. Spieltag")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Vorheriger Spieltag" }));
    expect(screen.getByText("1. Spieltag")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Nächster Spieltag" }));
    expect(screen.getByText("2. Spieltag")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Spielplan" })).getAllByRole("listitem")).toHaveLength(9);
  });

  it("Esc und „Zurück“ rufen onBack", async () => {
    const { onBack } = setup(0);
    await fireEvent.keyDown(window, { key: "Escape" });
    await fireEvent.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
