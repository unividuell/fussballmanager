// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

const key = async (k: string) => {
  await fireEvent.keyDown(window, { key: k });
  await new Promise((r) => setTimeout(r, 0));
  await tick();
};

describe("Wirtschaft über die Oberfläche", () => {
  it("Vereinslosen verpflichten, Eintritt setzen, hart trainieren, Spieltag starten", async () => {
    const c = new GameController();
    const world = generateWorld(59);
    const clubId = Object.keys(world.clubs)[5];
    c.startGame(world, [{ name: "Anna", clubId }]);
    render(App, { controller: c });
    await tick();
    const club = () => c.snapshot!.state.clubs[clubId];
    const squadBefore = club().squad.length;

    await key("Enter"); // → Hauptmenü
    await key("4"); // → Transfers
    await fireEvent.click(screen.getByLabelText("nur Vereinslose"));
    await fireEvent.click(screen.getAllByRole("button", { name: /verhandeln$/ })[0]);
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(screen.getByText("Abgeschlossen.")).toBeTruthy();
    await key("Escape"); // Dialog zu
    expect(c.view.kind).toBe("transfers");
    await key("Escape"); // → Menü
    expect(club().squad.length).toBe(squadBefore + 1);

    await key("5"); // → Finanzen
    await fireEvent.input(screen.getByLabelText("Eintrittspreis"), { target: { value: "25" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preis setzen" }));
    expect(club().finance.ticketPrice).toBe(25);
    await key("Escape");

    await key("2"); // → Training
    await fireEvent.click(screen.getByRole("button", { name: /^hart/ }));
    expect(club().training.intensity).toBe("hard");
    await key("Escape");

    await key("Enter"); // Weiter
    expect(c.view).toEqual({ kind: "conference", half: 1 });
  });
});
