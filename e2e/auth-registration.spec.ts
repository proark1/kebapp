import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { E2E_PASSWORD, e2eUsers } from "./fixtures/database";
import { waitForMailLink } from "./fixtures/mailpit";

test("registriert, bestätigt, beantragt und aktiviert einen neuen Laden", async ({
  browser,
  page,
}) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const email = `neuer-inhaber-${suffix}@e2e.kebapp.local`;
  const storeName = `E2E Neuer Laden ${suffix}`;
  const mailAfter = new Date(Date.now() - 1_000);

  await page.goto("/registrieren");
  await page.getByLabel("Dein Name").fill("E2E Neuer Inhaber");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(E2E_PASSWORD);
  await page.getByLabel("Passwort wiederholen").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Zugang anlegen" }).click();

  await expect(page).toHaveURL(/\/email-bestaetigen\?status=gesendet/);
  await expect(page.getByRole("heading", { name: "Postfach prüfen." })).toBeVisible();

  const verificationLink = await waitForMailLink({
    after: mailAfter,
    path: /\/api\/auth\/verify-email\?token=/,
    subject: /E-Mail-Adresse bestätigen/,
    to: email,
  });
  await page.goto(verificationLink);
  await expect(page.getByRole("heading", { name: "E-Mail bestätigt." })).toBeVisible();

  await login(page, email);
  await expect(page).toHaveURL(/\/antrag$/);
  await page.getByLabel("Name am Laden").fill(storeName);
  await page.getByLabel("Firmenname").fill(`${storeName} GmbH`);
  await page.getByLabel("Kontaktperson").fill("E2E Neuer Inhaber");
  await page.getByLabel("Kontakt-E-Mail").fill(email);
  await page.getByLabel("Telefon").fill("02161 123456");
  await page.getByLabel("Straße und Hausnummer").fill("Teststraße 12");
  await page.getByLabel("PLZ").fill("41061");
  await page.getByLabel("Ort").fill("Mönchengladbach");
  await page.getByRole("button", { name: "Laden zur Prüfung einreichen" }).click();

  await expect(page).toHaveURL(/\/status\?neu=1/);
  await expect(
    page.getByRole("heading", { name: "Dein Antrag liegt auf unserem Prüftisch." }),
  ).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, e2eUsers.admin.email);
  await adminPage.goto("/admin/antraege");
  await adminPage.getByRole("link", { name: new RegExp(storeName) }).click();
  await adminPage.getByRole("button", { name: "Pilotzugang freigeben" }).click();
  await expect(adminPage.getByRole("status")).toContainText(
    "Organisation und Inhaberzugang wurden freigegeben.",
  );
  await adminContext.close();

  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(storeName, { exact: true }).first()).toBeVisible();
});
