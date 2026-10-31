// @vitest-environment jsdom
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { eventText } from "../../src/ui/logic/format";

describe("Ergebnisse: Ereignisse", () => {
  it("listet die Tore des eigenen Vereins im Panel EREIGNISSE", async () => {
    const controller = new GameController();
    const world = generateWorld(3);
    const mgrClub = Object.keys(world.clubs)[0];
    controller.startGame(world, [{ name: "Anna", clubId: mgrClub }]);
    const id = controller.snapshot!.state.managers[0].id;
    await controller.endTurn(id);
    controller.advance();
    await controller.endTurn(id);
    controller.advance();
    expect(controller.view.kind).toBe("results");
    render(App, { controller });
    await tick();

    const snap = controller.snapshot!;
    const live = snap.lives.find((l) => l.home.club === mgrClub || l.away.club === mgrClub)!;
    const goals = live.events.filter((e) => e.type === "goal" && e.club === mgrClub);
    const panel = Array.from(document.querySelectorAll(".panel, section, div")).find((el) =>
      el.textContent?.includes("EREIGNISSE") && el.querySelectorAll(".event").length > 0,
    );
    const lines = Array.from(document.querySelectorAll(".event")).map((e) => e.textContent ?? "");
    const short = snap.state.clubs[mgrClub].shortName;
    for (const g of goals) expect(lines).toContain(`${short}: ${eventText(snap.state, g)}`);
    if (goals.length > 0) expect(panel).toBeTruthy();
    else expect(document.body.textContent).not.toContain("EREIGNISSE");
  });
});
