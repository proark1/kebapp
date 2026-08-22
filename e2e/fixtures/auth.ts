import { expect, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./database";

export async function login(
  page: Page,
  email: string,
  password = E2E_PASSWORD,
) {
  await page.goto("/anmelden");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Sicher anmelden" }).click();
  await expect(page).not.toHaveURL(/\/anmelden/);
}
