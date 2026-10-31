// @vitest-environment jsdom
import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import Screen from "../../src/ui/theme/Screen.svelte";

const content = createRawSnippet(() => ({ render: () => "<p>Inhalt</p>" }));

describe("Screen", () => {
  it("zeigt den Inhalt auf einer 640×400-Fläche mit Skalierung", () => {
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const { container, getByText } = render(Screen, { children: content });
    expect(getByText("Inhalt")).toBeTruthy();
    const screen = container.querySelector(".screen") as HTMLElement;
    expect(screen.style.width).toBe("640px");
    expect(screen.style.height).toBe("400px");
    expect(screen.style.transform).toBe("scale(2)");
  });

  it("schaltet Scanlines ein, wenn gewünscht", () => {
    const { container } = render(Screen, { children: content, scanlines: true });
    expect(container.querySelector(".screen.scanlines")).not.toBeNull();
  });
});
