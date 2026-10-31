// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import App from "../../src/App.svelte";
import { GameController } from "../../src/ui/controller.svelte";

describe("Neues Spiel", () => {
  it("startet ein Spiel mit einem Manager und zeigt danach „ist dran“", async () => {
    const controller = new GameController();
    render(App, { controller });
    expect(screen.getByRole("heading", { name: "NEUES SPIEL" })).toBeTruthy();
    const name = screen.getByLabelText("Name Manager 1") as HTMLInputElement;
    await fireEvent.input(name, { target: { value: "Markus" } });
    const select = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    const firstClub = select.querySelectorAll("option")[1].value;
    await fireEvent.change(select, { target: { value: firstClub } });
    await fireEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    expect(controller.view.kind).toBe("turnStart");
    expect(controller.snapshot!.state.managers[0].name).toBe("Markus");
    expect(controller.snapshot!.state.managers[0].clubId).toBe(firstClub);
  });

  it("bietet 36 Vereine in zwei Ligagruppen an", () => {
    render(App, { controller: new GameController() });
    const select = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    const groups = select.querySelectorAll("optgroup");
    expect(Array.from(groups).map((g) => g.label)).toEqual(["1. Liga", "2. Liga"]);
    expect(groups[0].querySelectorAll("option")).toHaveLength(18);
    expect(groups[1].querySelectorAll("option")).toHaveLength(18);
  });

  it("zeigt Felder für die gewählte Manager-Anzahl", async () => {
    render(App, { controller: new GameController() });
    await fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByLabelText("Name Manager 3")).toBeTruthy();
    expect(screen.queryByLabelText("Name Manager 4")).toBeNull();
  });

  it("meldet einen fehlenden Verein und zwei Manager mit demselben Verein", async () => {
    const controller = new GameController();
    render(App, { controller });
    await fireEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    expect(screen.getByText("Bitte wähle für jeden Manager einen Verein.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "2" }));
    const s1 = screen.getByLabelText("Verein Manager 1") as HTMLSelectElement;
    const s2 = screen.getByLabelText("Verein Manager 2") as HTMLSelectElement;
    const club = s1.querySelectorAll("option")[1].value;
    await fireEvent.change(s1, { target: { value: club } });
    await fireEvent.change(s2, { target: { value: club } });
    await fireEvent.click(screen.getByRole("button", { name: "Anpfiff!" }));
    expect(screen.getByText("Zwei Manager können nicht denselben Verein übernehmen.")).toBeTruthy();
    expect(controller.view.kind).toBe("newGame");
  });

  it("„Neue Welt“ erzeugt eine andere Welt aus dem eingegebenen Seed", async () => {
    render(App, { controller: new GameController() });
    const seed = screen.getByLabelText("Seed") as HTMLInputElement;
    await fireEvent.input(seed, { target: { value: "1" } });
    await fireEvent.click(screen.getByRole("button", { name: "Neue Welt" }));
    const a = (screen.getByLabelText("Verein Manager 1") as HTMLSelectElement).querySelectorAll("option")[1].textContent;
    await fireEvent.input(seed, { target: { value: "2" } });
    await fireEvent.click(screen.getByRole("button", { name: "Neue Welt" }));
    const b = (screen.getByLabelText("Verein Manager 1") as HTMLSelectElement).querySelectorAll("option")[1].textContent;
    expect(a).not.toBe(b);
  });
});
