// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { STADIUM, upkeepFor } from "../../src/engine/economy/stadium";
import { formatEuro } from "../../src/engine/economy/util";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { priceHint } from "../../src/ui/logic/stadium";

describe("Hinweis zum Eintrittspreis", () => {
  it("ausverkauft, viele freie Plätze oder nichts", () => {
    expect(priceHint(28_000, 28_000)).toBe("Ausverkauft – ein höherer Preis bringt vermutlich mehr.");
    expect(priceHint(27_500, 28_000)).toBe("Ausverkauft – ein höherer Preis bringt vermutlich mehr.");
    expect(priceHint(10_000, 28_000)).toBe("Viele freie Plätze – ein niedrigerer Preis lockt mehr Zuschauer.");
    expect(priceHint(0, 28_000)).toBeNull();
    expect(priceHint(0, 28_000, true)).toBe("Viele freie Plätze – ein niedrigerer Preis lockt mehr Zuschauer.");
    expect(priceHint(25_000, 28_000)).toBeNull();
  });
});

async function stadiumScreen(index = 20) {
  const c = new GameController();
  const world = generateWorld(29);
  const clubId = Object.keys(world.clubs)[index];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.open("stadium");
  await tick();
  return { c, club: () => c.snapshot!.state.clubs[clubId] };
}

async function reopen(c: GameController): Promise<void> {
  c.open("menu");
  await tick();
  c.open("stadium");
  await tick();
}

describe("Stadion", () => {
  it("zeigt Kapazität, Stufe und Auslastung des letzten Heimspiels mit Hinweis", async () => {
    const { c, club } = await stadiumScreen();
    const f = club().finance;
    const capacity = STADIUM[f.stadiumStage].capacity;
    f.lastAttendance = capacity; // Testaufbau: ein ausverkauftes Heimspiel
    const gs = c.snapshot!.state;
    const league = gs.competitions.L1.clubs.includes(club().id) ? "L1" : "L2";
    gs.competitions[league].matches.find((m) => m.home === club().id)!.result = { home: 1, away: 0 };
    await reopen(c);
    expect(screen.getByText("STADION")).toBeTruthy();
    expect(screen.getByText(new RegExp(`Stufe ${f.stadiumStage + 1} von ${STADIUM.length}`))).toBeTruthy();
    expect(screen.getByText(/100 %/)).toBeTruthy();
    expect(screen.getByText("Ausverkauft – ein höherer Preis bringt vermutlich mehr.")).toBeTruthy();
  });

  it("0 Zuschauer nach einem Heimspiel heißt nicht „noch kein Heimspiel“", async () => {
    const { c, club } = await stadiumScreen();
    const gs = c.snapshot!.state;
    const id = club().id;
    const league = gs.competitions.L1.clubs.includes(id) ? "L1" : "L2";
    const home = gs.competitions[league].matches.find((m) => m.home === id)!;
    home.result = { home: 0, away: 1 }; // Testaufbau: ein Heimspiel ohne Zuschauer
    club().finance.lastAttendance = 0;
    await reopen(c);
    expect(screen.queryByText("Noch kein Heimspiel in dieser Saison.")).toBeNull();
    expect(screen.getByText(/0 %/)).toBeTruthy();
    expect(screen.getByText("Viele freie Plätze – ein niedrigerer Preis lockt mehr Zuschauer.")).toBeTruthy();
  });

  it("setzt den Eintrittspreis und meldet ungültige Preise", async () => {
    const { club } = await stadiumScreen();
    const input = screen.getByLabelText("Eintrittspreis") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "31" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preis setzen" }));
    expect(club().finance.ticketPrice).toBe(31);
    await fireEvent.input(input, { target: { value: "2" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preis setzen" }));
    expect(await screen.findByText("Der Eintrittspreis muss zwischen 5 und 100 € liegen.")).toBeTruthy();
  });

  it("baut das Stadion aus, wenn das Geld reicht", async () => {
    const { c, club } = await stadiumScreen();
    club().finance.balance = 100_000_000; // Testaufbau
    await reopen(c);
    const stage = club().finance.stadiumStage;
    await fireEvent.click(screen.getByRole("button", { name: /^Ausbauen/ }));
    expect(club().finance.building).toEqual({ stage: stage + 1, matchdaysLeft: STADIUM[stage + 1].buildMatchdays });
    expect(screen.getByText(/Ausbau läuft: noch/)).toBeTruthy();
  });

  it("zeigt den Unterhalt, der in dieser Liga wirklich gebucht wird", async () => {
    const c = new GameController();
    const world = generateWorld(29);
    const clubId = Object.values(world.clubs).find((x) => x.name === "SV Meppen")!.id;
    c.startGame(world, [{ name: "Anna", clubId }]);
    render(App, { controller: c });
    c.open("stadium");
    await tick();
    const stage = c.snapshot!.state.clubs[clubId].finance.stadiumStage;
    const text = screen.getByText(/Unterhalt danach/).textContent!;
    expect(text).toContain(formatEuro(upkeepFor(stage + 1, 2)));
    expect(text).toContain(formatEuro(upkeepFor(stage, 2)));
  });

  it("Esc führt zurück ins Hauptmenü", async () => {
    const { c } = await stadiumScreen();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });
});
