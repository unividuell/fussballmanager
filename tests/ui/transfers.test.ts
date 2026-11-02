// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import { playerName } from "../../src/ui/logic/format";

async function transfersScreen() {
  const c = new GameController();
  const world = generateWorld(47);
  const clubId = Object.keys(world.clubs)[6];
  c.startGame(world, [{ name: "Anna", clubId }]);
  render(App, { controller: c });
  c.openTransfers("market");
  await tick();
  const gs = () => c.snapshot!.state;
  return { c, gs, clubId, name: (id: string) => playerName(gs().players[id]) };
}

const ages = () => Array.from(document.querySelectorAll("td.age")).map((td) => Number(td.textContent));

describe("Transfermarkt", () => {
  it("zeigt keine eigenen Spieler und meldet das offene Fenster", async () => {
    const { gs, clubId, name } = await transfersScreen();
    expect(screen.getByText("Transferfenster offen")).toBeTruthy();
    const others = new Set(Object.values(gs().players).filter((p) => p.clubId !== clubId).map((p) => name(p.id)));
    for (const id of gs().clubs[clubId].squad.filter((i) => !others.has(name(i)))) expect(screen.queryByRole("button", { name: `${name(id)} verhandeln` })).toBeNull();
  });

  it("sortiert per Klick auf den Spaltenkopf", async () => {
    await transfersScreen();
    await fireEvent.click(screen.getByRole("button", { name: "Sortieren nach Alter" }));
    const desc = ages();
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    await fireEvent.click(screen.getByRole("button", { name: "Sortieren nach Alter" }));
    const asc = ages();
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });

  it("filtert nach Torhütern und nach Vereinslosen", async () => {
    await transfersScreen();
    await fireEvent.click(screen.getByRole("button", { name: "TW" }));
    expect(Array.from(document.querySelectorAll("td.pos")).every((td) => td.textContent === "TW")).toBe(true);
    await fireEvent.click(screen.getByRole("button", { name: "Alle" }));
    await fireEvent.click(screen.getByLabelText("nur Vereinslose"));
    expect(Array.from(document.querySelectorAll("td.club")).every((td) => td.textContent === "vereinslos")).toBe(true);
  });

  it("Vereinslose öffnen einen Vertragsdialog, KI-Spieler einen Transferdialog; Esc schließt nur den Dialog", async () => {
    const { c, gs } = await transfersScreen();
    const free = Object.values(gs().players).filter((p) => p.clubId === null && !p.retired).sort((a, b) => b.strength - a.strength)[0];
    await fireEvent.click(screen.getByLabelText("nur Vereinslose")); // sonst kann er außerhalb der 150 stärksten liegen
    await fireEvent.click(screen.getByRole("button", { name: `${playerName(free)} verhandeln` }));
    expect(screen.getByLabelText("Gehalt")).toBeTruthy();
    await fireEvent.keyDown(window, { key: "Escape" });
    await tick();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(c.view.kind).toBe("transfers");
    await fireEvent.click(screen.getByLabelText("nur Vereinslose"));
    const firstAi = Array.from(document.querySelectorAll("td.club")).findIndex((td) => td.textContent !== "vereinslos");
    (screen.getAllByRole("button", { name: /verhandeln$/ })[firstAi] as HTMLButtonElement).click();
    await tick();
    expect(screen.getByLabelText("Ablöse")).toBeTruthy();
  });
});

describe("Meine Spieler und Angebote", () => {
  it("setzt einen Spieler mit Wunschpreis auf die Transferliste und wieder herunter", async () => {
    const { c, gs, clubId, name } = await transfersScreen();
    c.openTransfers("mine");
    await tick();
    const pid = gs().clubs[clubId].squad[8];
    await fireEvent.input(screen.getByLabelText(`Wunschpreis ${name(pid)}`), { target: { value: "300000" } });
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} auf die Liste` }));
    expect(gs().players[pid].transferListed).toEqual({ askingPrice: 300_000 });
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} von der Liste` }));
    expect(gs().players[pid].transferListed).toBeNull();
  });

  it("nimmt ein KI-Angebot an", async () => {
    const { c, gs, clubId, name } = await transfersScreen();
    const pid = gs().clubs[clubId].squad[9];
    const buyer = Object.values(gs().clubs).find((x) => x.managerId === null)!;
    gs().transferOffers.push({ id: "o1", managerId: gs().managers[0].id, fromClub: buyer.id, playerId: pid, fee: 400_000, maxFee: 500_000, round: 1, status: "open", season: 1, expiresAfter: 0 }); // Testaufbau
    c.snapshot = { ...c.snapshot! }; // snapshot ist $state.raw: In-place-Änderung muss neu zugewiesen werden
    c.openTransfers("offers");
    await tick();
    expect(screen.getByText(new RegExp(`${buyer.name} bietet`))).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: `Angebot für ${gs().players[pid].firstName} ${gs().players[pid].lastName} annehmen` }));
    expect(gs().clubs[clubId].squad).not.toContain(pid);
    expect(screen.getByText("Keine offenen Angebote.")).toBeTruthy();
    expect(name(pid)).toBeTruthy();
  });
});
