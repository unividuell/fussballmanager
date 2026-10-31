// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

/** Taste drücken und warten, bis asynchrone Befehle (endTurn) und das Neuzeichnen durch sind. */
const key = async (k: string) => {
  await fireEvent.keyDown(window, { key: k });
  await new Promise((r) => setTimeout(r, 0));
  await tick();
};

describe("kompletter Ablauf über die Oberfläche", () => {
  it("zwei Manager spielen einen Spieltag von „Neues Spiel“ bis zum nächsten „ist dran“", async () => {
    const controller = new GameController();
    render(App, { controller });
    await fireEvent.click(screen.getByRole("button", { name: "2" }));
    await fireEvent.input(screen.getByLabelText("Name Manager 1"), { target: { value: "Anna" } });
    await fireEvent.input(screen.getByLabelText("Name Manager 2"), { target: { value: "Ben" } });
    const s1 = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    const s2 = screen.getByLabelText("Verein Manager 2") as HTMLSelectElement;
    await fireEvent.change(s1, { target: { value: s1.querySelectorAll("option")[1].value } });
    await fireEvent.change(s2, { target: { value: s2.querySelectorAll("option")[25].value } });
    await fireEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    await tick();

    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
    await key("Enter"); // → Hauptmenü
    await key("Enter"); // Weiter
    expect(screen.getByText("BEN IST DRAN")).toBeTruthy();
    await key("Enter");
    await key("Enter");

    expect(controller.view).toEqual({ kind: "conference", half: 1 });
    await key(" ");
    await key("Enter");
    expect(screen.getByText("HALBZEIT · Anna")).toBeTruthy();
    await key("Enter");
    expect(screen.getByText("HALBZEIT · Ben")).toBeTruthy();
    await key("Enter");

    expect(controller.view).toEqual({ kind: "conference", half: 2 });
    await key(" ");
    await key("Enter");

    expect(screen.getByText("ERGEBNISSE · 1. Spieltag")).toBeTruthy();
    expect(document.querySelectorAll(".result")).toHaveLength(18);
    await fireEvent.click(screen.getByRole("button", { name: "Tabelle" }));
    await tick();
    expect(screen.getByRole("table", { name: "Tabelle" })).toBeTruthy();
    await key("Escape");
    expect(screen.getByText("ERGEBNISSE · 1. Spieltag")).toBeTruthy();
    await key("Enter");

    expect(screen.getByText("ANNA IST DRAN")).toBeTruthy();
    expect(screen.getByText(/Saison 1 · 2\. Spieltag/)).toBeTruthy();
  });

  it("nach 36 Spieltagen erscheint das Saisonende, danach beginnt Saison 2", { timeout: 120_000 }, async () => {
    const controller = new GameController();
    const world = generateWorld(13);
    controller.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
    const anna = controller.snapshot!.state.managers[0].id;
    for (let i = 0; i < 36; i++) {
      await controller.endTurn(anna);
      controller.advance();
      if (controller.view.kind === "halftime") await controller.endTurn(anna);
      controller.advance();
      controller.advance();
    }
    expect(controller.view.kind).toBe("seasonEnd");
    render(App, { controller });
    await tick();
    expect(screen.getByText("SAISON 1 BEENDET")).toBeTruthy();
    expect(screen.getByText(/Meister 1\. Liga/)).toBeTruthy();
    expect(screen.getByText(/Aufsteiger/)).toBeTruthy();
    expect(screen.getByText(/Absteiger/)).toBeTruthy();
    await key("Enter");
    expect(controller.view.kind).toBe("turnStart");
    expect(screen.getByText(/Saison 2 · 1\. Spieltag/)).toBeTruthy();
  });

  it("Hinweise aus der Spieltagsvorbereitung erscheinen in der Auswertung", async () => {
    const controller = new GameController();
    const world = generateWorld(17);
    const clubId = Object.keys(world.clubs)[0];
    const victim = world.clubs[clubId].lineup.starters[3];
    world.players[victim].injury = { matchesLeft: 2 };
    controller.startGame(world, [{ name: "Anna", clubId }]);
    await controller.endTurn(controller.snapshot!.state.managers[0].id);
    controller.advance();
    await controller.endTurn(controller.snapshot!.state.managers[0].id);
    controller.advance();
    render(App, { controller });
    await tick();
    expect(screen.getByText(new RegExp(`Anna: Aufstellung ergänzt: ${world.players[victim].lastName}`))).toBeTruthy();
  });
});
