// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { findLiveFor } from "../../src/engine/commands";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function atHalftime(names = ["Anna"]) {
  const controller = new GameController();
  const world = generateWorld(9);
  const ids = Object.keys(world.clubs);
  controller.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  for (const m of controller.snapshot!.state.managers) await controller.endTurn(m.id);
  controller.advance();
  render(App, { controller });
  await tick();
  const managerId = controller.snapshot!.state.managers[0].id;
  const side = () => {
    const s = controller.snapshot!;
    const loc = findLiveFor(s.state, s.lives, managerId)!;
    return s.lives[loc.index][loc.side];
  };
  const btn = (id: string) => screen.getByRole("button", { name: `${playerName(controller.snapshot!.state.players[id])} ${id}` });
  return { controller, managerId, side, btn };
}

describe("Halbzeit", () => {
  it("zeigt Manager und Spielstand", async () => {
    const { side } = await atHalftime();
    expect(screen.getByText("HALBZEIT · Anna")).toBeTruthy();
    expect(screen.getByText(new RegExp(`${side().goals}:`))).toBeTruthy();
  });

  it("plant einen Wechsel, führt ihn bei „Fertig“ aus und geht zur 2. Halbzeit", async () => {
    const { controller, side, btn } = await atHalftime();
    const out = side().pitch[6].id;
    const inId = side().bench[2];
    await fireEvent.click(btn(out));
    await fireEvent.click(btn(inId));
    expect(screen.getByText(`Wechsel übrig: ${5 - side().subsUsed - 1}`)).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Fertig (Enter)" }));
    await tick();
    expect(controller.view).toEqual({ kind: "conference", half: 2 });
    expect(side().played).toContain(inId);
  });

  it("geplante Wechsel lassen sich wieder entfernen", async () => {
    const { side, btn } = await atHalftime();
    await fireEvent.click(btn(side().pitch[3].id));
    await fireEvent.click(btn(side().bench[1]));
    await fireEvent.click(screen.getByRole("button", { name: "Wechsel entfernen" }));
    expect(screen.getByText(`Wechsel übrig: ${5 - side().subsUsed}`)).toBeTruthy();
  });

  it("ändert die Spielweise", async () => {
    const { side } = await atHalftime();
    await fireEvent.click(screen.getByRole("button", { name: "offensiv" }));
    await fireEvent.keyDown(window, { key: "Enter" });
    await tick();
    expect(side().tactics.style).toBe("offensive");
  });

  it("ohne freie Wechsel: Meldung, „Fertig“ geht trotzdem", async () => {
    const { controller, side, btn } = await atHalftime();
    side().subsUsed = 5; // Testaufbau: alle Wechsel schon durch Verletzungen verbraucht
    await fireEvent.click(btn(side().pitch[4].id));
    await fireEvent.click(btn(side().bench[0]));
    expect(screen.getByText("Keine Wechsel mehr übrig.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Fertig (Enter)" }));
    await tick();
    expect(controller.view.kind).toBe("conference");
  });

  it("im Hot-Seat kommt danach der zweite Manager mit leerem Entwurf", async () => {
    const { controller, side, btn } = await atHalftime(["Anna", "Ben"]);
    await fireEvent.click(btn(side().pitch[2].id));
    await fireEvent.click(btn(side().bench[1]));
    await fireEvent.click(screen.getByRole("button", { name: "Fertig (Enter)" }));
    await tick();
    expect(controller.view).toEqual({ kind: "halftime", managerId: controller.snapshot!.state.managers[1].id });
    expect(screen.getByText("HALBZEIT · Ben")).toBeTruthy();
    expect(screen.getByText("Wechsel übrig: 5")).toBeTruthy();
  });
});
