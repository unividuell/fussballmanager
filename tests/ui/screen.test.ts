// @vitest-environment jsdom
import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import Screen from "../../src/ui/theme/Screen.svelte";

const content = createRawSnippet(() => ({ render: () => "<p>Inhalt</p>" }));

describe("Screen", () => {
  it("zeigt den Inhalt auf einer 1280×800-Fläche mit Skalierung", () => {
    Object.defineProperty(window, "innerWidth", { value: 1920, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 1080, configurable: true });
    const { container, getByText } = render(Screen, { children: content });
    expect(getByText("Inhalt")).toBeTruthy();
    const screen = container.querySelector(".screen") as HTMLElement;
    expect(screen.style.width).toBe("1280px");
    expect(screen.style.height).toBe("800px");
    expect(screen.style.transform).toBe("translate(-50%, -50%) scale(1.35)");
  });

  it("verkleinert in kleinen Fenstern um die Mitte (375×667 → 375/1280)", () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 667, configurable: true });
    const { container } = render(Screen, { children: content });
    const screen = container.querySelector(".screen") as HTMLElement;
    expect(screen.style.transform).toBe("translate(-50%, -50%) scale(0.29296875)");
  });

  it("schaltet Scanlines ein, wenn gewünscht", () => {
    const { container } = render(Screen, { children: content, scanlines: true });
    expect(container.querySelector(".screen.scanlines")).not.toBeNull();
  });
});
