// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { playToSeasonEnd } from "../../src/debug";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

describe("playToSeasonEnd", () => {
  it("spielt ohne Eingaben bis zum Saisonende", async () => {
    const c = new GameController();
    const world = generateWorld(5);
    const ids = Object.keys(world.clubs);
    c.startGame(world, [{ name: "Anna", clubId: ids[0] }, { name: "Ben", clubId: ids[20] }]);
    expect(await playToSeasonEnd(c)).toBe(true);
    expect(c.view.kind).toBe("seasonEnd");
    expect(c.snapshot!.state.season).toBe(2);
  });

  it("ohne Spiel meldet es false", async () => {
    expect(await playToSeasonEnd(new GameController())).toBe(false);
  });
});
