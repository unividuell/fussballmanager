import { expect, test, type Page } from "@playwright/test";
import { startGame } from "./helpers";

/** Prüft im Browser, dass nichts über die logische Fläche (.screen) hinausragt. */
async function expectNoOverflow(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const screen = document.querySelector(".screen");
    if (!screen) return ["kein .screen gefunden"];
    const s = screen.getBoundingClientRect();
    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).join(".")
        : "";
      const text = (el.textContent ?? "").trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${id}${cls} "${text}"`;
    };
    const out: string[] = [];
    for (const el of Array.from(screen.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right > s.right + 1) out.push(`${describe(el)} rechts: ${r.right.toFixed(1)} > ${s.right.toFixed(1)}`);
      if (r.left < s.left - 1) out.push(`${describe(el)} links: ${r.left.toFixed(1)} < ${s.left.toFixed(1)}`);
      if (el.matches("section.panel") && r.bottom > s.bottom + 1) {
        out.push(`${describe(el)} unten: ${r.bottom.toFixed(1)} > ${s.bottom.toFixed(1)}`);
      }
      // Seitliches Scrollen ist nie erlaubt, auch nicht in Scroll-Listen (overflow-x nicht "visible").
      // Ausnahme: gewollte Kürzung mit Auslassungspunkten (text-overflow: ellipsis, z. B. Spielernamen).
      const cs = getComputedStyle(el);
      if (cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 1) {
        out.push(`${describe(el)} seitlich: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
      }
    }
    return out;
  });
  expect(problems, `Überlauf in "${label}"`).toEqual([]);
}

test("kein Bildschirm ragt über den Rand", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NEUES SPIEL")).toBeVisible();
  await expectNoOverflow(page, "Neues Spiel");

  await startGame(page, ["Anna"]);
  await expectNoOverflow(page, "Ist dran");

  await page.keyboard.press("Enter");
  await expect(page.getByText("Mannschaft", { exact: true })).toBeVisible();
  await expectNoOverflow(page, "Hauptmenü");

  // Kachel-Taste, Kennzeichen des Zielbildschirms (sichtbarer Text dort)
  const kacheln: [string, string][] = [
    ["1", "KADER"],
    ["2", "INTENSITÄT"],
    ["3", "VERTRÄGE"],
    ["4", "Meine Spieler"],
    ["5", "BILANZ"],
    ["6", "TABELLE"],
    ["7", "NACHRICHTEN"],
  ];
  for (const [key, marker] of kacheln) {
    await page.keyboard.press(key);
    await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
    await expectNoOverflow(page, `Kachel ${key}`);
    await page.keyboard.press("Escape");
    await expect(page.getByText("Mannschaft", { exact: true })).toBeVisible();
  }

  await page.keyboard.press("8");
  await expect(page.getByText(/1\. Halbzeit · /)).toBeVisible();
  await expectNoOverflow(page, "Live");

  await page.keyboard.press(" ");
  await expect(page.getByText("HALBZEIT", { exact: true })).toBeVisible();
  await expectNoOverflow(page, "Live Halbzeitstand");

  await page.getByRole("button", { name: "Weiter (Enter)" }).click();
  await expect(page.getByText("AUF DEM PLATZ")).toBeVisible();
  await expectNoOverflow(page, "Halbzeit");
});

test("Verhandlungsdialog passt auf die Fläche", async ({ page }) => {
  await startGame(page, ["Anna"]);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Mannschaft", { exact: true })).toBeVisible();
  await page.keyboard.press("4");
  await expect(page.getByText("Meine Spieler", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /verhandeln$/ }).first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expectNoOverflow(page, "Verhandlung");
});

test("großes Fenster wird stufenlos gefüllt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NEUES SPIEL")).toBeVisible();
  await page.setViewportSize({ width: 2560, height: 1440 });
  await expect
    .poll(() => page.locator(".screen").evaluate((el) => (el as HTMLElement).style.transform))
    .toContain("scale(1.8)");
});
