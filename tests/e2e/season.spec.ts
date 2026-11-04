import { expect, test } from "@playwright/test";
import { startGame } from "./helpers";

test("zwei Manager: ein Spieltag mit Halbzeit, dann Saisonende im Schnellvorlauf", async ({ page }) => {
  await startGame(page, ["Anna", "Ben"]);
  for (const name of ["ANNA", "BEN"]) {
    await expect(page.getByText(`${name} IST DRAN`)).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.press("8");
  }
  await expect(page.getByText(/KONFERENZ/)).toBeVisible();
  await page.keyboard.press(" ");
  await expect(page.getByText("HALBZEIT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Weiter (Enter)" }).click();

  for (let i = 0; i < 2; i++) {
    await expect(page.getByText("AUF DEM PLATZ")).toBeVisible();
    await page.getByRole("button", { name: "Fertig (Enter)" }).click();
  }

  await expect(page.getByText(/2\. Halbzeit/)).toBeVisible();
  await page.keyboard.press(" ");
  await expect(page.getByText("ABPFIFF")).toBeVisible();
  await page.getByRole("button", { name: "Weiter (Enter)" }).click();
  await page.getByRole("button", { name: "Weiter (Enter)" }).click();
  await expect(page.getByText("ANNA IST DRAN")).toBeVisible();
  await expect(page.getByText(/2\. Spieltag/)).toBeVisible();

  expect(await page.evaluate(() => window.__fm!.playToSeasonEnd())).toBe(true);
  await expect(page.getByText("SAISON 1 BEENDET")).toBeVisible();
  await page.getByRole("button", { name: "Neue Saison (Enter)" }).click();
  await expect(page.getByText("ANNA IST DRAN")).toBeVisible();
  await expect(page.getByText(/Saison 2/)).toBeVisible();
});
