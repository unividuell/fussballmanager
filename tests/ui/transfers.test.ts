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

  it("Sortieren nach Alter aufsteigend zeigt die jüngsten Spieler des ganzen Marktes; Kopfzeile nennt die Anzahl", async () => {
    const { gs, clubId } = await transfersScreen();
    const humanClubs = new Set<string | null>(gs().managers.map((m) => m.clubId));
    const eligible = Object.values(gs().players).filter((p) => !p.retired && p.clubId !== clubId && !humanClubs.has(p.clubId));
    expect(eligible.length).toBeGreaterThan(150);
    expect(screen.getByText(`150 von ${eligible.length}`)).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Sortieren nach Alter" }));
    await fireEvent.click(screen.getByRole("button", { name: "Sortieren nach Alter" }));
    expect(ages()[0]).toBe(Math.min(...eligible.map((p) => p.age)));
    expect(ages()).toHaveLength(150);
  });

  it("Höchstablöse und Wunschpreis lesen deutsche Beträge; Unsinn wird nicht gesendet", async () => {
    const { c, gs, clubId, name } = await transfersScreen();
    await fireEvent.input(screen.getByLabelText("Höchstablöse"), { target: { value: "1.000.000" } });
    const fees = Array.from(document.querySelectorAll("tbody tr")).length;
    expect(fees).toBeGreaterThan(0);
    c.openTransfers("mine");
    await tick();
    const pid = gs().clubs[clubId].squad[8];
    await fireEvent.input(screen.getByLabelText(`Wunschpreis ${name(pid)}`), { target: { value: "1.500.000 €" } });
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} auf die Liste` }));
    expect(gs().players[pid].transferListed).toEqual({ askingPrice: 1_500_000 });
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} von der Liste` }));
    await fireEvent.input(screen.getByLabelText(`Wunschpreis ${name(pid)}`), { target: { value: "abc" } });
    await fireEvent.click(screen.getByRole("button", { name: `${name(pid)} auf die Liste` }));
    expect(screen.getByText("Bitte einen gültigen Betrag eingeben.")).toBeTruthy();
    expect(gs().players[pid].transferListed).toBeNull();
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

  it("Gegenangebot „500.000“ sendet 500000 und verkauft nie darunter", async () => {
    const { c, gs, clubId } = await transfersScreen();
    const pid = gs().clubs[clubId].squad[9];
    const buyer = Object.values(gs().clubs).find((x) => x.managerId === null)!;
    buyer.finance.balance = 100_000_000; // Testaufbau
    gs().transferOffers.push({ id: "o1", managerId: gs().managers[0].id, fromClub: buyer.id, playerId: pid, fee: 400_000, maxFee: 700_000, round: 1, status: "open", season: 1, expiresAfter: 0 }); // Testaufbau
    c.snapshot = { ...c.snapshot! };
    c.openTransfers("offers");
    await tick();
    const p = gs().players[pid];
    await fireEvent.input(screen.getByLabelText(`Gegenangebot ${p.firstName} ${p.lastName}`), { target: { value: "500.000" } });
    await fireEvent.click(screen.getByRole("button", { name: `Gegenangebot für ${p.firstName} ${p.lastName} senden` }));
    const o = gs().transferOffers.find((x) => x.id === "o1")!;
    expect(o.status).toBe("accepted");
    expect(o.fee).toBe(500_000);
  });

  it("Gegenangebot mit Unsinn: Hinweis, nichts gesendet", async () => {
    const { c, gs, clubId } = await transfersScreen();
    const pid = gs().clubs[clubId].squad[9];
    const buyer = Object.values(gs().clubs).find((x) => x.managerId === null)!;
    gs().transferOffers.push({ id: "o1", managerId: gs().managers[0].id, fromClub: buyer.id, playerId: pid, fee: 400_000, maxFee: 700_000, round: 1, status: "open", season: 1, expiresAfter: 0 }); // Testaufbau
    c.snapshot = { ...c.snapshot! };
    c.openTransfers("offers");
    await tick();
    const p = gs().players[pid];
    await fireEvent.input(screen.getByLabelText(`Gegenangebot ${p.firstName} ${p.lastName}`), { target: { value: "abc" } });
    await fireEvent.click(screen.getByRole("button", { name: `Gegenangebot für ${p.firstName} ${p.lastName} senden` }));
    expect(screen.getByText("Bitte einen gültigen Betrag eingeben.")).toBeTruthy();
    expect(gs().transferOffers.find((x) => x.id === "o1")!.round).toBe(1);
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
