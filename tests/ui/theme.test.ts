// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Crest from "../../src/ui/theme/Crest.svelte";
import Panel from "../../src/ui/theme/Panel.svelte";
import Tile from "../../src/ui/theme/Tile.svelte";

const body = createRawSnippet(() => ({ render: () => "<p>Tafelinhalt</p>" }));

describe("Panel", () => {
  it("zeigt Titel und Inhalt", () => {
    const { getByText, container } = render(Panel, { title: "Kader", children: body });
    expect(getByText("Kader").tagName).toBe("H2");
    expect(getByText("Tafelinhalt")).toBeTruthy();
    expect(container.querySelector("section.panel")).not.toBeNull();
  });

  it("kommt ohne Titel aus", () => {
    const { container } = render(Panel, { children: body });
    expect(container.querySelector("h2")).toBeNull();
  });
});

describe("Tile", () => {
  it("ruft onclick auf und zeigt Taste und Beschriftung", async () => {
    const onclick = vi.fn();
    const { getByRole } = render(Tile, { shortcut: "1", icon: "11", label: "Mannschaft", onclick });
    const button = getByRole("button");
    expect(button.textContent).toContain("Mannschaft");
    expect(button.textContent).toContain("1");
    await fireEvent.click(button);
    expect(onclick).toHaveBeenCalledOnce();
  });

  it("ist gesperrt und zeigt „folgt“", async () => {
    const onclick = vi.fn();
    const { getByRole } = render(Tile, { shortcut: "2", icon: "++", label: "Training", disabled: true, onclick });
    const button = getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("folgt");
    await userEvent.setup().click(button);
    expect(onclick).not.toHaveBeenCalled();
  });
});

describe("Crest", () => {
  it("zeichnet ein Schild in den Vereinsfarben", () => {
    const { container } = render(Crest, { colors: ["#c0392b", "#f2f2f2"], pattern: "stripes", size: 32 });
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(container.innerHTML).toContain("#c0392b");
    expect(container.innerHTML).toContain("#f2f2f2");
  });

  it("„plain“ nutzt nur die Hauptfarbe für die Fläche", () => {
    const { container } = render(Crest, { colors: ["#1f4e9c", "#f1c40f"], pattern: "plain" });
    expect(container.querySelectorAll("[data-pattern]")).toHaveLength(0);
  });

  it("zwei Wappen auf einer Seite haben verschiedene Clip-IDs", () => {
    const a = render(Crest, { colors: ["#111111", "#ffffff"], pattern: "sash" });
    const b = render(Crest, { colors: ["#111111", "#ffffff"], pattern: "hoops" });
    const idA = a.container.querySelector("clipPath")!.id;
    const idB = b.container.querySelector("clipPath")!.id;
    expect(idA).not.toBe(idB);
  });
});
