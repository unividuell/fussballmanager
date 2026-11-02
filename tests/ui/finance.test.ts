// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { STADIUM } from "../../src/engine/economy/stadium";
import { formatEuro } from "../../src/engine/economy/util";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";

async function financeScreen(index = 20) {
  const c = new GameController();
  const world = generateWorld(29);
  const clubId = Object.keys(world.clubs)[index];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.open("finance");
  await tick();
  return { c, club: () => c.snapshot!.state.clubs[clubId] };
}

describe("Finanzen", () => {
  it("zeigt Kontostand und gebuchte Kategorien", async () => {
    const { c, club } = await financeScreen();
    club().finance.ledger.push({ calendarIndex: 0, category: "tv", amount: 30_000 }); // Testaufbau
    c.open("menu");
    await tick();
    c.open("finance");
    await tick();
    expect(screen.getByText("TV-Geld")).toBeTruthy();
    expect(screen.getAllByText(formatEuro(30_000)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatEuro(club().finance.balance)).length).toBeGreaterThan(0);
  });

  it("setzt den Eintrittspreis und meldet ungültige Preise", async () => {
    const { club } = await financeScreen();
    const input = screen.getByLabelText("Eintrittspreis") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "31" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preis setzen" }));
    expect(club().finance.ticketPrice).toBe(31);
    await fireEvent.input(input, { target: { value: "2" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preis setzen" }));
    expect(await screen.findByText("Der Eintrittspreis muss zwischen 5 und 100 € liegen.")).toBeTruthy();
  });

  it("baut das Stadion aus, wenn das Geld reicht", async () => {
    const { c, club } = await financeScreen();
    club().finance.balance = 100_000_000; // Testaufbau
    c.open("menu");
    await tick();
    c.open("finance");
    await tick();
    const stage = club().finance.stadiumStage;
    await fireEvent.click(screen.getByRole("button", { name: /^Ausbauen/ }));
    expect(club().finance.building).toEqual({ stage: stage + 1, matchdaysLeft: STADIUM[stage + 1].buildMatchdays });
    expect(screen.getByText(/Ausbau läuft: noch/)).toBeTruthy();
  });

  it("wählt einen Sponsor", async () => {
    const { club } = await financeScreen();
    const offer = club().finance.sponsorOffers[1];
    await fireEvent.click(screen.getByRole("button", { name: `${offer.name} wählen` }));
    expect(club().finance.sponsor).toEqual(offer);
    expect(screen.queryByRole("button", { name: /wählen$/ })).toBeNull();
  });
});
