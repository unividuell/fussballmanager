// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync, tick } from "svelte";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../src/App.svelte";
import { generateWorld } from "../../../src/engine/generator";
import type { LiveMatch } from "../../../src/engine/match/simulate";
import { COMP, type ClubId } from "../../../src/engine/model";
import { GameController } from "../../../src/ui/controller.svelte";
import { SCENE_MS } from "../../../src/ui/live/scenes";
import type { Sound } from "../../../src/ui/sound";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({} as Record<string, unknown>, {
      get: (t, k) => (typeof k === "string" && k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })),
      set: (t, k, v) => ((t[k as string] = v), true),
    });
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const world = generateWorld(3);

async function atLive(clubs: ClubId[] = [Object.keys(world.clubs)[0]], sound?: Sound, scenes = true, prepare?: (c: GameController) => void) {
  const controller = new GameController(sound ? { sound } : {});
  controller.setOptions({ scenes });
  controller.startGame(world, clubs.map((clubId, i) => ({ name: `M${i}`, clubId })));
  for (const m of controller.snapshot!.state.managers) await controller.endTurn(m.id);
  prepare?.(controller);
  render(App, { controller });
  await tick();
  return controller;
}

function advance(ms: number, step = 100): void {
  for (let t = 0; t < ms; t += step) {
    vi.advanceTimersByTime(step);
    flushSync();
  }
}

/** Ersetzt die Ereignisse des Manager-Spiels: nur ein Heimtor in Minute 2, damit die Zeiten feststehen. */
function onlyGoalAt2(c: GameController): void {
  const l = managedLives(c)[0];
  l.events = [{ minute: 2, type: "goal", club: l.home.club, player: l.home.played[9] }];
}

function managedLives(c: GameController): LiveMatch[] {
  const s = c.snapshot!.state;
  return c.snapshot!.lives.filter((l) => s.clubs[l.home.club].managerId !== null || s.clubs[l.away.club].managerId !== null);
}

describe("Live-Bildschirm", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("läuft ohne Szenen im Normaltempo bis zur Halbzeit und bietet dann „Weiter“ an", async () => {
    const c = await atLive(undefined, undefined, false);
    expect(c.view).toEqual({ kind: "live", half: 1 });
    expect(screen.getByText("0'")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Weiter/ })).toBeNull();
    advance(5000);
    expect(screen.getByText("10'")).toBeTruthy();
    advance(17500);
    expect(screen.getByText("45'")).toBeTruthy();
    expect(screen.getByText("HALBZEIT")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(c.view.kind).toBe("halftime");
  });

  it("mit Szenen wartet das Halbzeitende, bis alle Szenen fertig sind", async () => {
    const c = await atLive();
    advance(45 * 1000 + 20 * SCENE_MS.end);
    expect(screen.getByText("HALBZEIT")).toBeTruthy();
    const l = managedLives(c)[0];
    expect(screen.getByText(`${l.home.goals}:${l.away.goals}`)).toBeTruthy();
    expect(document.querySelector(".scene")).toBeNull();
  });

  it("Leertaste: Spielstand = Halbzeitstand der Engine, keine Szene offen, „Weiter“ da", async () => {
    const c = await atLive();
    advance(3000);
    await fireEvent.keyDown(window, { key: " " });
    const l = managedLives(c)[0];
    expect(screen.getByText(`${l.home.goals}:${l.away.goals}`)).toBeTruthy();
    expect(document.querySelector(".scene")).toBeNull();
    expect(screen.getByRole("button", { name: "Weiter (Enter)" })).toBeTruthy();
  });

  it("Enter vor dem Ende tut nichts; doppeltes Enter am Ende schaltet genau einmal weiter", async () => {
    const c = await atLive();
    await fireEvent.keyDown(window, { key: "Enter" });
    expect(c.view.kind).toBe("live");
    await fireEvent.keyDown(window, { key: " " });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(c.view.kind).toBe("halftime");
    expect(c.message).toBeNull();
    await tick();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("+ beschleunigt", async () => {
    await atLive(undefined, undefined, false);
    await fireEvent.keyDown(window, { key: "+" });
    advance(600, 200);
    expect(screen.getByText("3'")).toBeTruthy();
  });

  it("die 2. Halbzeit beginnt bei 45' mit dem Halbzeitstand", async () => {
    const c = await atLive();
    await fireEvent.keyDown(window, { key: " " });
    await fireEvent.keyDown(window, { key: "Enter" });
    await c.endTurn(c.snapshot!.state.managers[0].id);
    await tick();
    expect(c.view).toEqual({ kind: "live", half: 2 });
    expect(screen.getByText("45'")).toBeTruthy();
    await fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("90'")).toBeTruthy();
    expect(screen.getByText("ABPFIFF")).toBeTruthy();
  });

  it("bei einem Manager füllt das Spiel den Bildschirm, bei drei gibt es drei Viertel und eine Tabelle", async () => {
    await atLive();
    expect(document.querySelectorAll(".match")).toHaveLength(1);
    expect(document.querySelector(".slots.full")).toBeTruthy();
  });

  it("drei Manager in drei Spielen: vier Viertel, eines mit Tabelle", async () => {
    const probe = new GameController();
    probe.startGame(world, [{ name: "X", clubId: Object.keys(world.clubs)[0] }]);
    await probe.endTurn(probe.snapshot!.state.managers[0].id);
    const l1 = probe.snapshot!.lives.filter((l) => l.competitionId === COMP.first);
    await atLive([l1[0].home.club, l1[1].home.club, l1[2].home.club]);
    expect(document.querySelectorAll(".match")).toHaveLength(3);
    expect(document.querySelectorAll(".live-table")).toHaveLength(1);
  });

  it("Torton und Spielstand erst bei der Auflösung der Szene", async () => {
    const play = vi.fn();
    await atLive(undefined, { play }, true, onlyGoalAt2);
    advance(1000 + 100);                       // Minute 2 erreicht, Szene läuft
    expect(document.querySelector(".scene")).toBeTruthy();
    advance(SCENE_MS.reveal - 300);
    expect(play).not.toHaveBeenCalledWith("goal");
    advance(400);
    expect(play).toHaveBeenCalledWith("goal");
    advance(SCENE_MS.end);
    expect(screen.getByText("1:0")).toBeTruthy();
  });

  it("nach einer Tor-Szene blinkt der Spielstand", async () => {
    await atLive(undefined, undefined, true, onlyGoalAt2);
    advance(1000 + SCENE_MS.end + 100);
    expect(document.querySelector(".scene")).toBeNull();
    expect(document.querySelector(".score.flash")).toBeTruthy();
  });

  it("Leertaste mitten in der Tor-Szene: Torton und Spielstand sofort", async () => {
    const play = vi.fn();
    await atLive(undefined, { play }, true, onlyGoalAt2);
    advance(1000 + 300);
    await fireEvent.keyDown(window, { key: " " });
    expect(play).toHaveBeenCalledWith("goal");
    expect(screen.getByText("1:0")).toBeTruthy();
  });

  it("Option „Torszenen“ aus: keine Szene, Uhr läuft durch", async () => {
    await atLive(undefined, undefined, false);
    advance(22500);
    expect(document.querySelector(".scene")).toBeNull();
    expect(screen.getByText("HALBZEIT")).toBeTruthy();
  });

  it("kein Spiel mit Manager: Tabelle bildschirmfüllend, Uhr und „Weiter“ funktionieren", async () => {
    const c = await atLive();
    const s = c.snapshot!;
    const managed = managedLives(c)[0];
    // Spieltag nachstellen, an dem der Manager-Verein nicht spielt (z. B. Relegation ohne ihn)
    (s as { lives: LiveMatch[] }).lives = s.lives.filter((l) => l !== managed);
    document.body.innerHTML = "";
    render(App, { controller: c });
    await tick();
    expect(document.querySelector(".slots.full .live-table")).toBeTruthy();
    await fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("HALBZEIT")).toBeTruthy();
  });
});
