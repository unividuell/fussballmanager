// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { postMessage } from "../../src/engine/economy/messages";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

async function game() {
  const c = new GameController();
  const world = generateWorld(53);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[3] }]);
  render(App, { controller: c });
  await tick();
  return { c, gs: () => c.snapshot!.state, anna: () => c.snapshot!.state.managers[0] };
}

describe("Nachrichten", () => {
  it("neueste zuerst; Verweise springen zum Angebot und zu den Finanzen", async () => {
    const { c, gs, anna } = await game();
    postMessage(gs(), anna().id, "Erste Testnachricht");
    postMessage(gs(), anna().id, "Zweite Testnachricht", { type: "transferOffer", id: "x" }); // Testaufbau
    c.open("messages");
    await tick();
    const items = Array.from(document.querySelectorAll("li.message")).map((li) => li.textContent ?? "");
    expect(items[0]).toContain("Zweite Testnachricht");
    expect(items[1]).toContain("Erste Testnachricht");
    await fireEvent.click(screen.getAllByRole("button", { name: "Zum Angebot" })[0]);
    expect(c.view.kind).toBe("transfers");
    expect(c.transferTab).toBe("offers");
    c.open("messages");
    await tick();
    await fireEvent.click(screen.getAllByRole("button", { name: "Zu den Finanzen" })[0]);
    expect(c.view.kind).toBe("finance");
  });
});
