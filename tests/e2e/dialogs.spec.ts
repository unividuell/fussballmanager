import { expect, test, type Locator } from "@playwright/test";
import { startGame } from "./helpers";

/** Ein Gebot knapp unter der Forderung: nicht angenommen, aber auch kein Abbruch. */
async function lowball(dialog: Locator): Promise<void> {
  const field = dialog.getByLabel("Gehalt");
  const ask = Number(await field.inputValue());
  await field.fill(String(Math.floor((ask * 0.9) / 100) * 100));
}

test("Vertragsdialog und Transferdialog", async ({ page }) => {
  await startGame(page, ["Anna"]);
  await page.keyboard.press("Enter");

  await page.keyboard.press("3");
  await page.getByRole("button", { name: /verlängern$/ }).first().click();
  const contract = page.getByRole("dialog");
  await expect(contract).toBeVisible();
  // Ein Angebot in Höhe der Forderung würde sofort angenommen; ein niedriges Gebot hält die Verhandlung offen.
  await lowball(contract);
  await contract.getByRole("button", { name: "Verhandlung beginnen" }).click();
  await expect(contract.getByRole("button", { name: "Bieten" })).toBeVisible();
  await contract.getByRole("button", { name: "Abbrechen" }).click();
  await expect(contract.getByText("Beendet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.keyboard.press("4");
  // Am 1. Spieltag ist der Markt dicht oder zu teuer: ein Vereinsloser (Vertragsverhandlung) lässt sich sicher verpflichten.
  await page.getByLabel("nur Vereinslose").check();
  await page.getByRole("button", { name: /verhandeln$/ }).first().click();
  const transfer = page.getByRole("dialog");
  await expect(transfer).toBeVisible();
  await lowball(transfer);
  await transfer.getByRole("button", { name: "Verhandlung beginnen" }).click();
  await expect(transfer.getByRole("button", { name: "Bieten" })).toBeVisible();
  await transfer.getByRole("button", { name: "Abbrechen" }).click();
  await expect(transfer.getByText("Beendet.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
