// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { fireManager } from "../../src/engine/economy/board";
import { postMessage } from "../../src/engine/economy/messages";
import { generateWorld } from "../../src/engine/generator";
import { Rng } from "../../src/engine/rng";
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

describe("Jobangebote", () => {
  it("ohne Verein: Angebote annehmen führt ins Hauptmenü des neuen Vereins", async () => {
    const { c, gs, anna } = await game();
    fireManager(gs(), anna().id, Rng.fromSeed(2)); // Testaufbau
    c.open("menu");
    await tick();
    expect(screen.getByText("OHNE VEREIN")).toBeTruthy();
    const target = gs().clubs[anna().jobOffers[0]];
    await fireEvent.click(screen.getByRole("button", { name: `${target.name} annehmen` }));
    expect(anna().clubId).toBe(target.id);
    expect(c.view.kind).toBe("menu");
  });

  it("ohne Verein: „Weiter“ beendet die Runde", async () => {
    const { c, gs, anna } = await game();
    fireManager(gs(), anna().id, Rng.fromSeed(3));
    c.open("jobs");
    await tick();
    await fireEvent.keyDown(window, { key: "Enter" });
    await tick();
    expect(c.view.kind).toBe("conference");
  });

  it("mit Verein und Angebot: Überschrift „JOBANGEBOTE“ und „Zurück“", async () => {
    const { c, gs, anna } = await game();
    const other = Object.values(gs().clubs).find((x) => x.managerId === null)!;
    anna().jobOffers = [other.id]; // Testaufbau
    c.open("jobs");
    await tick();
    expect(screen.getByText("JOBANGEBOTE")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(c.view.kind).toBe("menu");
  });
});
