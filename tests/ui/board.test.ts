// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { COMP } from "../../src/engine/model";
import { GameController } from "../../src/ui/controller.svelte";
import { boardRemark, confidenceTrend, targetRange } from "../../src/ui/logic/board";

describe("Vorstand – Logik", () => {
  it("Trend aus dem Verlauf", () => {
    expect(confidenceTrend([])).toBe("–");
    expect(confidenceTrend([50])).toBe("–");
    expect(confidenceTrend([40, 45])).toBe("steigend");
    expect(confidenceTrend([50, 49.5])).toBe("gleich");
    expect(confidenceTrend([60, 50])).toBe("fallend");
  });

  it("Zielkorridor je Erwartung", () => {
    expect(targetRange("title")).toEqual([1, 2]);
    expect(targetRange("upper")).toEqual([1, 6]);
    expect(targetRange("mid")).toEqual([1, 12]);
    expect(targetRange("survival")).toEqual([1, 15]);
  });

  it("ein Satz je Lage", () => {
    const inside = boardRemark(3, "upper");
    const close = boardRemark(8, "upper");
    const far = boardRemark(15, "upper");
    for (const t of [inside, close, far]) expect(t.length).toBeGreaterThan(0);
    expect(new Set([inside, close, far]).size).toBe(3);
  });
});

async function boardScreen() {
  const c = new GameController();
  const world = generateWorld(29);
  const clubId = Object.keys(world.clubs)[20];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.open("board");
  await tick();
  return { c, club: () => c.snapshot!.state.clubs[clubId] };
}

describe("Vorstand – Bildschirm", () => {
  it("rendert vor dem ersten Spiel mit Trend „–“ und nur der laufenden Saison", async () => {
    const { c, club } = await boardScreen();
    expect(c.snapshot!.state.calendarIndex).toBe(0);
    expect(screen.getByText("VORSTAND")).toBeTruthy();
    expect(screen.getByText(/Trend: –/)).toBeTruthy();
    const history = screen.getByRole("table", { name: "Bisherige Saisons" });
    const rows = within(history).getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getByText("läuft")).toBeTruthy();
    expect(club().board.seasons).toEqual([]);
  });

  it("markiert den Zielkorridor und den eigenen Platz auf der Leiter", async () => {
    const { c, club } = await boardScreen();
    club().board.expectation = "upper"; // Testaufbau
    c.open("menu");
    await tick();
    c.open("board");
    await tick();
    const ladder = screen.getByRole("list", { name: "Tabellenplätze" });
    const cells = within(ladder).getAllByRole("listitem");
    expect(cells).toHaveLength(18);
    expect(cells.filter((x) => x.classList.contains("target"))).toHaveLength(6);
    expect(cells.filter((x) => x.classList.contains("me"))).toHaveLength(1);
  });

  it("zeigt die Historie mit Liga, Ziel, Platz und Ergebnis", async () => {
    const { c, club } = await boardScreen();
    club().board.seasons.push({ season: 1, competitionId: COMP.second, expectation: "title", rank: 2, met: true }); // Testaufbau
    c.open("menu");
    await tick();
    c.open("board");
    await tick();
    const history = screen.getByRole("table", { name: "Bisherige Saisons" });
    const row = within(history).getAllByRole("row")[1];
    expect(within(row).getByText("2. Liga")).toBeTruthy();
    expect(within(row).getByText("Aufstieg")).toBeTruthy();
    expect(within(row).getByText("2.")).toBeTruthy();
    expect(within(row).getByText("erreicht")).toBeTruthy();
  });

  it("zeigt den Sponsorbonus nur mit gewähltem Sponsor", async () => {
    const { c, club } = await boardScreen();
    expect(screen.queryByText(/Sponsorbonus/)).toBeNull();
    club().finance.sponsor = club().finance.sponsorOffers[0]; // Testaufbau
    c.open("menu");
    await tick();
    c.open("board");
    await tick();
    expect(screen.getByText(/Sponsorbonus/)).toBeTruthy();
  });

  it("Esc führt zurück ins Hauptmenü", async () => {
    const { c } = await boardScreen();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(c.view.kind).toBe("menu");
  });
});
