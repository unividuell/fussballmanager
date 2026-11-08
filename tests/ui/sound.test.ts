// @vitest-environment jsdom
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { whistleDue } from "../../src/ui/logic/ticker";
import type { Sound } from "../../src/ui/sound";

async function atLive(sound: Sound) {
  const c = new GameController({ sound });
  const world = generateWorld(3);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  await c.endTurn(c.snapshot!.state.managers[0].id);
  return c;
}

describe("whistleDue", () => {
  it("pfeift, wenn die Uhr das Halbzeitende erreicht, auch beim Überspringen", () => {
    expect(whistleDue(44, 45, 45)).toBe(true);
    expect(whistleDue(5, 45, 45)).toBe(true);
    expect(whistleDue(45, 45, 45)).toBe(false);
    expect(whistleDue(9, 10, 45)).toBe(false);
  });
});

describe("Ton im Live-Bildschirm", () => {
  it("pfeift nach dem Überspringen ab, wenn der Ton an ist", async () => {
    const play = vi.fn();
    const c = await atLive({ play });
    render(App, { controller: c });
    await tick();
    await userEvent.click(screen.getByRole("button", { name: /Überspringen/ }));
    expect(play).toHaveBeenCalledWith("whistle");
  });

  it("bleibt stumm, wenn der Ton aus ist", async () => {
    const play = vi.fn();
    const c = await atLive({ play });
    c.setOptions({ sound: false });
    render(App, { controller: c });
    await tick();
    await userEvent.click(screen.getByRole("button", { name: /Überspringen/ }));
    expect(play).not.toHaveBeenCalled();
  });
});
