// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

async function atConference() {
  const controller = new GameController();
  const world = generateWorld(3);
  controller.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
  await controller.endTurn(controller.snapshot!.state.managers[0].id);
  render(App, { controller });
  await tick();
  return controller;
}

function advanceMinutes(n: number, ms = 500): void {
  for (let i = 0; i < n; i++) {
    vi.advanceTimersByTime(ms);
    flushSync();
  }
}

describe("Konferenz", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("läuft im Normaltempo bis zur Halbzeit und bietet dann „Weiter“ an", async () => {
    const c = await atConference();
    expect(screen.getByText("0'")).toBeTruthy();
    expect(screen.getByText(/KONFERENZ · 1\. Liga/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Weiter/ })).toBeNull();
    advanceMinutes(10);
    expect(screen.getByText("10'")).toBeTruthy();
    advanceMinutes(35);
    expect(screen.getByText("45'")).toBeTruthy();
    expect(screen.getByText("HALBZEIT")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(c.view.kind).toBe("halftime");
  });

  it("zeigt am Ende genau die Halbzeitstände der Engine", async () => {
    const c = await atConference();
    await fireEvent.keyDown(window, { key: " " });
    const lives = c.snapshot!.lives.filter((l) => l.competitionId === "L1");
    const shown = Array.from(document.querySelectorAll(".score")).map((e) => e.textContent);
    expect(shown).toEqual(lives.map((l) => `${l.home.goals}:${l.away.goals}`));
  });

  it("Enter vor dem Ende tut nichts; doppeltes Enter am Ende schaltet genau einmal weiter", async () => {
    const c = await atConference();
    await fireEvent.keyDown(window, { key: "Enter" });
    expect(c.view.kind).toBe("conference");
    await fireEvent.keyDown(window, { key: " " });
    // zwei Enter direkt hintereinander, bevor Svelte neu rendert
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(c.view.kind).toBe("halftime");
    expect(c.message).toBeNull();
    await tick();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("TAB wechselt zur 2. Liga, + beschleunigt", async () => {
    await atConference();
    await fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByText(/KONFERENZ · 2\. Liga/)).toBeTruthy();
    await fireEvent.keyDown(window, { key: "+" });
    advanceMinutes(3, 200);
    expect(screen.getByText("3'")).toBeTruthy();
  });

  it("die 2. Halbzeit beginnt bei 45' mit dem Halbzeitstand", async () => {
    const c = await atConference();
    await fireEvent.keyDown(window, { key: " " });
    await fireEvent.keyDown(window, { key: "Enter" });
    await c.endTurn(c.snapshot!.state.managers[0].id);
    await tick();
    expect(c.view).toEqual({ kind: "conference", half: 2 });
    expect(screen.getByText("45'")).toBeTruthy();
    await fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("90'")).toBeTruthy();
    expect(screen.getByText("ABPFIFF")).toBeTruthy();
  });
});
