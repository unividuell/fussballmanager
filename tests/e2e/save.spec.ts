import { expect, test } from "@playwright/test";
import { startGame } from "./helpers";

test("speichern, neu laden, Slot laden", async ({ page }) => {
  await startGame(page, ["Anna"]);
  await page.keyboard.press("Enter");
  await page.keyboard.press("s");
  await page.getByRole("button", { name: "In Slot 1 speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Weiterspielen" })).toBeVisible();
  await page.getByRole("button", { name: "Spiel laden" }).click();
  await page.getByRole("button", { name: "Slot 1 laden" }).click();
  await expect(page.getByText("ANNA IST DRAN")).toBeVisible();
});

test("Scanlines bleiben nach dem Neuladen eingeschaltet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Optionen" }).click();
  await page.getByRole("button", { name: "Scanlines an" }).click();
  await page.reload();
  await expect(page.locator(".screen.scanlines")).toHaveCount(1);
});
