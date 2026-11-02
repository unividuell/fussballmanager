// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function trainingScreen() {
  const c = new GameController();
  const world = generateWorld(23);
  const clubId = Object.keys(world.clubs)[2];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.open("training");
  await tick();
  const club = () => c.snapshot!.state.clubs[clubId];
  const btn = (id: string) => screen.getByRole("button", { name: `${playerName(c.snapshot!.state.players[id])} ${id}` });
  return { c, club, btn };
}

describe("Training", () => {
  it("setzt Intensität und Schwerpunkt", async () => {
    const { club } = await trainingScreen();
    await fireEvent.click(screen.getByRole("button", { name: /^hart/ }));
    await fireEvent.click(screen.getByRole("button", { name: /^Taktik/ }));
    expect(club().training.intensity).toBe("hard");
    expect(club().training.focus).toBe("tactics");
  });

  it("Extratraining für bis zu 3 Spieler; der vierte wird mit Meldung abgelehnt; abwählen geht", async () => {
    const { club, btn } = await trainingScreen();
    const ids = club().squad.slice(0, 4);
    for (const id of ids.slice(0, 3)) await fireEvent.click(btn(id));
    expect(club().training.individual).toEqual(ids.slice(0, 3));
    expect(screen.getByText("EXTRATRAINING (3/3)")).toBeTruthy();
    await fireEvent.click(btn(ids[3]));
    expect(await screen.findByText("Höchstens 3 Spieler im Extratraining.")).toBeTruthy();
    await fireEvent.click(btn(ids[0]));
    expect(club().training.individual).toEqual(ids.slice(1, 3));
  });

  it("Esc führt zurück ins Menü", async () => {
    const { c } = await trainingScreen();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });
});
