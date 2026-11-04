// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { DEFAULT_OPTIONS, loadOptions, OPTIONS_KEY, saveOptions, type PrefsStorage } from "../../src/ui/logic/options";

function memory(initial: Record<string, string> = {}): PrefsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const broken: PrefsStorage = {
  getItem: () => {
    throw new Error("gesperrt");
  },
  setItem: () => {
    throw new Error("gesperrt");
  },
};

describe("Optionen laden und speichern", () => {
  it("Standard: Scanlines aus, normales Tempo, Ton an", () => {
    expect(DEFAULT_OPTIONS).toEqual({ scanlines: false, tempo: 1, sound: true });
    expect(loadOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(loadOptions(memory())).toEqual(DEFAULT_OPTIONS);
  });

  it("liest gespeicherte Werte und ersetzt ungültige durch den Standard", () => {
    const prefs = memory({ [OPTIONS_KEY]: JSON.stringify({ scanlines: true, tempo: 7, sound: "ja" }) });
    expect(loadOptions(prefs)).toEqual({ scanlines: true, tempo: 1, sound: true });
    expect(loadOptions(memory({ [OPTIONS_KEY]: "{kaputt" }))).toEqual(DEFAULT_OPTIONS);
  });

  it("speichert als JSON und übersteht einen gesperrten Speicher", () => {
    const prefs = memory();
    saveOptions(prefs, { scanlines: true, tempo: 2, sound: false });
    expect(loadOptions(prefs)).toEqual({ scanlines: true, tempo: 2, sound: false });
    expect(() => saveOptions(broken, DEFAULT_OPTIONS)).not.toThrow();
    expect(loadOptions(broken)).toEqual(DEFAULT_OPTIONS);
  });

  it("der Controller merkt sich Änderungen", () => {
    const prefs = memory();
    const c = new GameController({ prefs });
    c.setOptions({ scanlines: true });
    expect(c.options.scanlines).toBe(true);
    expect(new GameController({ prefs }).options.scanlines).toBe(true);
  });
});

describe("Optionen-Bildschirm", () => {
  it("vor dem Spiel: Scanlines einschalten und zurück zu „Neues Spiel“", async () => {
    const c = new GameController({ prefs: memory() });
    render(App, { controller: c });
    await userEvent.click(screen.getByRole("button", { name: "Optionen" }));
    expect(screen.getByText("OPTIONEN")).toBeTruthy();
    expect(document.querySelector(".screen.scanlines")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Scanlines an" }));
    expect(document.querySelector(".screen.scanlines")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Scanlines an" }).getAttribute("aria-pressed")).toBe("true");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByText("NEUES SPIEL")).toBeTruthy();
  });

  it("im Spiel: Taste O öffnet die Optionen, Esc führt ins Hauptmenü zurück", async () => {
    const c = new GameController({ prefs: memory() });
    const world = generateWorld(3);
    c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
    c.open("menu");
    render(App, { controller: c });
    await tick();
    await fireEvent.keyDown(window, { key: "o" });
    expect(c.view.kind).toBe("options");
    await userEvent.click(screen.getByRole("button", { name: "Tempo schnell" }));
    expect(c.options.tempo).toBe(2);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });

  it("die Konferenz startet im eingestellten Tempo und merkt sich + und −", async () => {
    const c = new GameController({ prefs: memory() });
    c.setOptions({ tempo: 0 });
    const world = generateWorld(3);
    c.startGame(world, [{ name: "Anna", clubId: Object.keys(world.clubs)[0] }]);
    await c.endTurn(c.snapshot!.state.managers[0].id);
    render(App, { controller: c });
    await tick();
    expect(screen.getByText("Tempo 1/3")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "+" });
    expect(c.options.tempo).toBe(1);
    expect(screen.getByText("Tempo 2/3")).toBeTruthy();
  });
});
