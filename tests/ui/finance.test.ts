// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
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

  it("Eintritt und Stadion stehen nicht mehr in den Finanzen", async () => {
    await financeScreen();
    expect(screen.queryByLabelText("Eintrittspreis")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Ausbauen/ })).toBeNull();
  });

  it("wählt einen Sponsor", async () => {
    const { club } = await financeScreen();
    const offer = club().finance.sponsorOffers[1];
    await fireEvent.click(screen.getByRole("button", { name: `${offer.name} wählen` }));
    expect(club().finance.sponsor).toEqual(offer);
    expect(screen.queryByRole("button", { name: /wählen$/ })).toBeNull();
  });
});
