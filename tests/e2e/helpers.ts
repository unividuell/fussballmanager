import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __fm?: { playToSeasonEnd: () => Promise<boolean> };
  }
}

/** Neues Spiel; Manager 1 nimmt den ersten Verein der Liste, Manager 2 den 25. (2. Liga). */
export async function startGame(page: Page, names: string[]): Promise<void> {
  await page.goto("/");
  await expect(page.getByText("NEUES SPIEL")).toBeVisible();
  await page.getByRole("button", { name: String(names.length), exact: true }).click();
  for (const [i, name] of names.entries()) {
    await page.getByLabel(`Name Manager ${i + 1}`).fill(name);
    await page.getByLabel(`Verein Manager ${i + 1}`).selectOption({ index: i === 0 ? 1 : 25 });
  }
  await page.getByRole("button", { name: "Anpfiff!" }).click();
  await expect(page.getByText(`${names[0].toUpperCase()} IST DRAN`)).toBeVisible();
}
