// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { fireManager } from "../../src/engine/economy/board";
import { Rng } from "../../src/engine/rng";

function started(names = ["Anna", "Ben"]) {
  const c = new GameController();
  const world = generateWorld(7);
  const ids = Object.keys(world.clubs);
  const error = c.startGame(world, names.map((name, i) => ({ name, clubId: ids[i * 20] })));
  if (error) throw new Error(error);
  return c;
}

describe("GameController", () => {
  it("zeigt ohne Spiel den Bildschirm „Neues Spiel“", () => {
    expect(new GameController().view).toEqual({ kind: "newGame" });
  });

  it("meldet Fehler beim Start und bleibt bei „Neues Spiel“", () => {
    const c = new GameController();
    const world = generateWorld(7);
    const id = Object.keys(world.clubs)[0];
    expect(c.startGame(world, [{ name: "A", clubId: id }, { name: "B", clubId: id }])).toMatch(/denselben Verein/);
    expect(c.view.kind).toBe("newGame");
  });

  it("beginnt mit „ist dran“ für den ersten Manager und wechselt in Untermenüs", () => {
    const c = started();
    const [anna] = c.snapshot!.state.managers;
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
    expect(c.managerName(anna.id)).toBe("Anna");
    c.open("squad");
    expect(c.view).toEqual({ kind: "squad", managerId: anna.id });
  });

  it("Hot-Seat-Übergabe: der nächste Manager beginnt wieder bei „ist dran“", async () => {
    const c = started();
    const [anna, ben] = c.snapshot!.state.managers;
    c.open("tables");
    expect(await c.endTurn(anna.id)).toBe(true);
    expect(c.view).toEqual({ kind: "turnStart", managerId: ben.id });
  });

  it("speichert Fehlermeldungen von Befehlen und löscht sie beim Menüwechsel", async () => {
    const c = started();
    const [, ben] = c.snapshot!.state.managers;
    expect(await c.send({ type: "autoLineup", managerId: ben.id })).toBe(false);
    expect(c.message).toBe("Du bist gerade nicht dran.");
    c.open("menu");
    expect(c.message).toBeNull();
  });

  it("führt durch Konferenz, Halbzeit, Auswertung und zurück zu den Manager-Runden", async () => {
    const c = started();
    const [anna, ben] = c.snapshot!.state.managers;
    await c.endTurn(anna.id);
    await c.endTurn(ben.id);
    expect(c.view).toEqual({ kind: "conference", half: 1 });
    c.advance();
    expect(c.view).toEqual({ kind: "halftime", managerId: anna.id });
    await c.endTurn(anna.id);
    expect(c.view).toEqual({ kind: "halftime", managerId: ben.id });
    await c.endTurn(ben.id);
    expect(c.view).toEqual({ kind: "conference", half: 2 });
    c.advance();
    expect(c.view).toEqual({ kind: "results" });
    c.setResultsTables(true);
    expect(c.view).toEqual({ kind: "resultsTables" });
    c.setResultsTables(false);
    c.advance();
    expect(c.view).toEqual({ kind: "turnStart", managerId: anna.id });
    expect(c.snapshot!.state.calendarIndex).toBe(1);
  });

  it("ohne gestartetes Spiel tun send und advance nichts", async () => {
    const c = new GameController();
    expect(await c.send({ type: "endTurn", managerId: "x" })).toBe(false);
    c.advance();
    expect(c.view.kind).toBe("newGame");
  });
});


describe("GameController ohne Verein", () => {
  it("leitet auf die Jobangebote um, sobald der Manager keinen Verein hat", async () => {
    const c = started();
    const anna = c.snapshot!.state.managers[0];
    fireManager(c.snapshot!.state, anna.id, Rng.fromSeed(3)); // Testaufbau: Entlassung direkt im Spielstand
    c.open("menu");
    expect(c.view).toEqual({ kind: "jobs", managerId: anna.id });
    c.open("tables");
    expect(c.view).toEqual({ kind: "tables", managerId: anna.id });
    const offer = c.snapshot!.state.managers[0].jobOffers[0];
    expect(await c.send({ type: "acceptJobOffer", managerId: anna.id, clubId: offer })).toBe(true);
    c.open("menu");
    expect(c.view).toEqual({ kind: "menu", managerId: anna.id });
  });

  it("openTransfers merkt sich den Reiter", () => {
    const c = started();
    c.openTransfers("offers");
    expect(c.view.kind).toBe("transfers");
    expect(c.transferTab).toBe("offers");
  });
});
