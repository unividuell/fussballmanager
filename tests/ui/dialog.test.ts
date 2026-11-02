// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet, tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/App.svelte";
import { generateWorld } from "../../src/engine/generator";
import { formatEuro } from "../../src/engine/economy/util";
import { GameController } from "../../src/ui/controller.svelte";
import Dialog from "../../src/ui/theme/Dialog.svelte";

describe("Dialog", () => {
  it("zeigt Titel und Inhalt; „Schließen“ ruft onClose", async () => {
    const onClose = vi.fn();
    render(Dialog, { title: "Verhandlung", onClose, children: createRawSnippet(() => ({ render: () => "<p>Inhalt</p>" })) });
    expect(screen.getByRole("dialog", { name: "Verhandlung" })).toBeTruthy();
    expect(screen.getByText("Inhalt")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /Schließen/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Kopfzeile", () => {
  it("zeigt den Kontostand", async () => {
    const c = new GameController();
    const world = generateWorld(11);
    const clubId = Object.keys(world.clubs)[0];
    c.startGame(world, [{ name: "Anna", clubId }]);
    render(App, { controller: c });
    await tick();
    expect(screen.getByText(formatEuro(c.snapshot!.state.clubs[clubId].finance.balance))).toBeTruthy();
  });
});
