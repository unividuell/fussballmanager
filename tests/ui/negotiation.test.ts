// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { desiredYears, salaryDemand, yearsAdjusted } from "../../src/engine/economy/contracts";
import { formatEuro } from "../../src/engine/economy/util";
import { generateWorld } from "../../src/engine/generator";
import { GameController } from "../../src/ui/controller.svelte";
import NegotiationDialog from "../../src/ui/screens/NegotiationDialog.svelte";

function setup() {
  const c = new GameController();
  const world = generateWorld(37);
  const clubId = Object.keys(world.clubs)[1];
  c.startGame(world, [{ name: "Anna", clubId }]);
  const s = c.snapshot!.state;
  return { c, s, managerId: s.managers[0].id, clubId };
}

describe("Verhandlungsdialog", () => {
  it("Vertrag: Gegenforderung anzeigen, dann annehmen", async () => {
    const { c, s, managerId, clubId } = setup();
    const pid = s.clubs[clubId].squad[5];
    render(NegotiationDialog, { controller: c, managerId, playerId: pid, mode: "contract", onClose: vi.fn() });
    const salary = screen.getByLabelText("Gehalt") as HTMLInputElement;
    await fireEvent.input(salary, { target: { value: String(Math.round(salaryDemand(s, s.players[pid], clubId) * 0.85)) } });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(screen.getByText(/fordert/)).toBeTruthy();
    expect(screen.getByText(/Runde 2 von 3/)).toBeTruthy();
    expect(Number(salary.value)).toBeGreaterThan(0);
    await fireEvent.click(screen.getByRole("button", { name: "Forderung annehmen" }));
    expect(screen.getByText("Abgeschlossen.")).toBeTruthy();
    expect(screen.getByText(/unterschreibt/)).toBeTruthy();
  });

  it("Gehaltsstufe: Forderung und Vorbelegung berücksichtigen die Laufzeit; Bieten ohne Änderung bricht nicht ab", async () => {
    const { c, s, managerId, clubId } = setup();
    const pid = s.clubs[clubId].squad[5];
    const desired = desiredYears(s.players[pid]);
    const years = desired === 5 ? 4 : desired + 1;
    render(NegotiationDialog, { controller: c, managerId, playerId: pid, mode: "contract", onClose: vi.fn() });
    const base = salaryDemand(s, s.players[pid], clubId);
    await fireEvent.input(screen.getByLabelText("Gehalt"), { target: { value: String(Math.round(yearsAdjusted(base, years, desired) * 0.85)) } });
    await fireEvent.input(screen.getByLabelText("Laufzeit"), { target: { value: String(years) } });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    const n = c.snapshot!.state.negotiations.at(-1)!;
    expect(n.status).toBe("open");
    const shown = yearsAdjusted(n.ask, years, desired);
    expect(shown).not.toBe(n.ask);
    expect(screen.getByText(new RegExp(`Forderung: ${formatEuro(shown).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} pro Spieltag bei ${years} Jahren`))).toBeTruthy();
    expect((screen.getByLabelText("Gehalt") as HTMLInputElement).value).toBe(String(shown));
    await fireEvent.click(screen.getByRole("button", { name: "Bieten" }));
    expect(c.snapshot!.state.negotiations.at(-1)!.status).not.toBe("aborted");
  });

  it("Geldfelder lesen deutsch formatierte Beträge; ungültige Eingaben werden nicht gesendet", async () => {
    const { c, s, managerId } = setup();
    const seller = Object.values(s.clubs).find((x) => x.managerId === null)!;
    const send = vi.spyOn(c, "send");
    render(NegotiationDialog, { controller: c, managerId, playerId: seller.squad[14], mode: "transfer", onClose: vi.fn() });
    await fireEvent.input(screen.getByLabelText("Ablöse"), { target: { value: "abc" } });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText("Bitte einen gültigen Betrag eingeben.")).toBeTruthy();
    await fireEvent.input(screen.getByLabelText("Ablöse"), { target: { value: "800.000" } });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "startTransferTalk", fee: 800_000 }));
  });

  it("alte Fehlermeldungen erscheinen nicht in einem neu geöffneten Dialog", () => {
    const { c, s, managerId, clubId } = setup();
    c.message = "Alter Fehler";
    render(NegotiationDialog, { controller: c, managerId, playerId: s.clubs[clubId].squad[5], mode: "contract", onClose: vi.fn() });
    expect(screen.queryByText("Alter Fehler")).toBeNull();
  });

  it("Transfer: Ablöse wird akzeptiert, danach Gehalt, dann Wechsel", async () => {
    const { c, s, managerId, clubId } = setup();
    s.clubs[clubId].finance.balance = 100_000_000; // Testaufbau
    const seller = Object.values(s.clubs).find((x) => x.managerId === null)!;
    const pid = seller.squad[14];
    render(NegotiationDialog, { controller: c, managerId, playerId: pid, mode: "transfer", onClose: vi.fn() });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(screen.getByText(/akzeptiert/)).toBeTruthy();
    expect(screen.getByLabelText("Gehalt")).toBeTruthy();
    expect(screen.getByLabelText("Laufzeit")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Forderung annehmen" }));
    expect(screen.getByText("Abgeschlossen.")).toBeTruthy();
    expect(c.snapshot!.state.clubs[clubId].squad).toContain(pid);
  });

  it("geschlossenes Fenster: Hinweis und Fehlermeldung im Dialog", async () => {
    const { c, s, managerId, clubId } = setup();
    s.calendarIndex = 5; // Testaufbau
    s.clubs[clubId].finance.balance = 100_000_000; // damit nicht schon das Geld scheitert
    const seller = Object.values(s.clubs).find((x) => x.managerId === null)!;
    render(NegotiationDialog, { controller: c, managerId, playerId: seller.squad[14], mode: "transfer", onClose: vi.fn() });
    expect(screen.getAllByText("Das Transferfenster ist geschlossen.").length).toBeGreaterThan(0);
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    expect(screen.getAllByText("Das Transferfenster ist geschlossen.").length).toBeGreaterThan(1);
  });

  it("Abbrechen beendet die Verhandlung; „Schließen“ ruft onClose", async () => {
    const { c, s, managerId, clubId } = setup();
    const pid = s.clubs[clubId].squad[6];
    const onClose = vi.fn();
    render(NegotiationDialog, { controller: c, managerId, playerId: pid, mode: "contract", onClose });
    await fireEvent.input(screen.getByLabelText("Gehalt"), { target: { value: String(Math.round(salaryDemand(s, s.players[pid], clubId) * 0.85)) } });
    await fireEvent.click(screen.getByRole("button", { name: "Verhandlung beginnen" }));
    await fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.getByText("Beendet.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Schließen/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
