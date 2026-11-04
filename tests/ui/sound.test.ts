// @vitest-environment jsdom
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import type { LiveMatch } from "../../src/engine/match/simulate";
import { GameController } from "../../src/ui/controller.svelte";
import { soundsFor } from "../../src/ui/logic/ticker";
import type { Sound } from "../../src/ui/sound";

async function atConference(sound: Sound) {
  const c = new GameController({ sound });
  const world = generateWorld(3);
  c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  await c.endTurn(c.snapshot!.state.managers[0].id);
  return c;
}

describe("soundsFor", () => {
  it("Tor eines Manager-Vereins beim Weiterzählen, keins beim Überspringen, Pfiff am Ende", async () => {
    const c = await atConference({ play: () => {} });
    const gs = c.snapshot!.state;
    const lives: LiveMatch[] = structuredClone(c.snapshot!.lives);
    const managed = lives.find((l) => gs.clubs[l.home.club].managerId !== null || gs.clubs[l.away.club].managerId !== null)!;
    const other = lives.find((l) => l !== managed)!;
    for (const l of lives) l.events = [];
    managed.events.push({ minute: 10, type: "goal", club: managed.home.club, player: managed.home.played[9] });
    other.events.push({ minute: 20, type: "goal", club: other.home.club, player: other.home.played[9] });

    expect(soundsFor(gs, lives, 9, 10, 45)).toEqual(["goal"]);
    expect(soundsFor(gs, lives, 19, 20, 45)).toEqual([]);
    expect(soundsFor(gs, lives, 5, 45, 45)).toEqual(["whistle"]);
    expect(soundsFor(gs, lives, 44, 45, 45)).toEqual(["whistle"]);
    expect(soundsFor(gs, lives, 45, 45, 45)).toEqual([]);
  });
});

describe("Ton in der Konferenz", () => {
  it("pfeift nach dem Überspringen ab, wenn der Ton an ist", async () => {
    const play = vi.fn();
    const c = await atConference({ play });
    render(App, { controller: c });
    await tick();
    await userEvent.click(screen.getByRole("button", { name: /Überspringen/ }));
    expect(play).toHaveBeenCalledWith("whistle");
  });

  it("bleibt stumm, wenn der Ton aus ist", async () => {
    const play = vi.fn();
    const c = await atConference({ play });
    c.setOptions({ sound: false });
    render(App, { controller: c });
    await tick();
    await userEvent.click(screen.getByRole("button", { name: /Überspringen/ }));
    expect(play).not.toHaveBeenCalled();
  });
});
