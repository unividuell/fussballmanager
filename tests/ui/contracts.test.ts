// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { severance } from "../../src/engine/economy/contracts";
import { formatEuro } from "../../src/engine/economy/util";
import { generateWorld } from "../../src/engine/generator";
import { validateLineup } from "../../src/engine/lineup";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function contractsScreen() {
  const c = new GameController();
  const world = generateWorld(43);
  const clubId = Object.keys(world.clubs)[4];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.open("contracts");
  await tick();
  const gs = () => c.snapshot!.state;
  const name = (id: string) => playerName(gs().players[id]);
  return { c, gs, clubId, name };
}

describe("Verträge", () => {
  it("listet den Kader mit Gehalt und Vertragsende", async () => {
    const { gs, clubId } = await contractsScreen();
    expect(screen.getAllByRole("button", { name: /verlängern$/ })).toHaveLength(gs().clubs[clubId].squad.length);
  });

  it("„Verlängern“ öffnet den Dialog; Esc schließt nur den Dialog", async () => {
    const { c, gs, clubId, name } = await contractsScreen();
    const pid = gs().clubs[clubId].squad[3];
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} verlängern` }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    await tick();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(c.view.kind).toBe("contracts");
  });

  it("Entlassen nur nach Bestätigung, mit Abfindung; die Aufstellung bleibt gültig", async () => {
    const { gs, clubId, name } = await contractsScreen();
    const pid = gs().clubs[clubId].lineup.starters[4];
    const cost = severance(gs(), gs().players[pid]);
    const before = gs().clubs[clubId].finance.balance;
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} entlassen` }));
    expect(screen.getByText(new RegExp(`Abfindung: ${formatEuro(cost).replace(/\./g, "\\.")}`))).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Nein" }));
    expect(gs().clubs[clubId].squad).toContain(pid);
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} entlassen` }));
    await fireEvent.click(screen.getByRole("button", { name: "Ja, entlassen" }));
    expect(gs().clubs[clubId].squad).not.toContain(pid);
    expect(gs().clubs[clubId].finance.balance).toBe(before - cost);
    expect(validateLineup(gs(), clubId, gs().clubs[clubId].lineup)).toBeNull();
  });

  it("Esc ohne Dialog führt ins Menü", async () => {
    const { c } = await contractsScreen();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });
});
