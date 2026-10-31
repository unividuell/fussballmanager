// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function squadScreen(prepare?: (world: ReturnType<typeof generateWorld>, clubId: string) => void) {
  const controller = new GameController();
  const world = generateWorld(21);
  const clubId = Object.keys(world.clubs)[3];
  prepare?.(world, clubId);
  controller.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller });
  controller.open("squad");
  await tick();
  const club = () => controller.snapshot!.state.clubs[clubId];
  const player = (id: string) => controller.snapshot!.state.players[id];
  const nameButton = (id: string) => screen.getByRole("button", { name: playerName(player(id)) + " " + id });
  return { controller, club, player, nameButton };
}

describe("Mannschaft", () => {
  it("zeigt den ganzen Kader", async () => {
    const { club } = await squadScreen();
    expect(screen.getAllByRole("row").length).toBe(club().squad.length + 1);
  });

  it("tauscht zwei Startspieler per Klick", async () => {
    const { club, nameButton } = await squadScreen();
    const [a, b] = [club().lineup.starters[1], club().lineup.starters[2]];
    await fireEvent.click(nameButton(a));
    await fireEvent.click(nameButton(b));
    expect(club().lineup.starters[1]).toBe(b);
    expect(club().lineup.starters[2]).toBe(a);
  });

  it("verletzten Spieler einwechseln: Meldung, Aufstellung bleibt", async () => {
    let injured = "";
    const { club, player, nameButton } = await squadScreen((world, clubId) => {
      const c = world.clubs[clubId];
      injured = c.squad.find((id) => !c.lineup.starters.includes(id) && !c.lineup.bench.includes(id))!;
      world.players[injured].injury = { matchesLeft: 3 };
    });
    const before = [...club().lineup.starters];
    await fireEvent.click(nameButton(before[5]));
    await fireEvent.click(nameButton(injured));
    expect(await screen.findByText(`${player(injured).lastName} ist verletzt.`)).toBeTruthy();
    expect(club().lineup.starters).toEqual(before);
  });

  it("ändert Formation, Spielweise und Härte", async () => {
    const { club } = await squadScreen();
    await fireEvent.click(screen.getByRole("button", { name: "4-3-3" }));
    await fireEvent.click(screen.getByRole("button", { name: "offensiv" }));
    await fireEvent.click(screen.getByRole("button", { name: "hart" }));
    expect(club().tactics).toEqual({ formation: "4-3-3", style: "offensive", hardness: "hard" });
  });

  it("„Automatisch“ stellt eine gültige Elf auf, Esc führt zurück ins Menü", async () => {
    const { controller, club } = await squadScreen();
    await fireEvent.click(screen.getByRole("button", { name: "Automatisch" }));
    expect(club().lineup.starters).toHaveLength(11);
    expect(controller.message).toBeNull();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(controller.view.kind).toBe("menu");
  });
});
