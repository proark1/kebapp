import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { e2eUsers } from "./fixtures/database";
import { waitForMailLink } from "./fixtures/mailpit";

test("lädt Mitarbeitende ein und begrenzt sie auf operative Aufgaben", async ({
  browser,
  page,
}) => {
  await login(page, e2eUsers.ownerA.email);
  await page.goto("/app/einstellungen/team");

  const mailAfter = new Date(Date.now() - 1_000);
  await page.getByLabel("E-Mail-Adresse").fill(e2eUsers.employee.email);
  await page.getByRole("button", { name: "Einladung senden" }).click();
  await expect(page.getByRole("status")).toContainText(
    `Einladung an ${e2eUsers.employee.email} wurde versendet.`,
  );

  const invitationLink = await waitForMailLink({
    after: mailAfter,
    path: /\/einladung\//,
    subject: /Einladung zu Döner E2E A/,
    to: e2eUsers.employee.email,
  });

  const employeeContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();
  await login(employeePage, e2eUsers.employee.email);
  await employeePage.goto(invitationLink);
  await expect(
    employeePage.getByRole("heading", { name: "Dein Platz im Team ist reserviert." }),
  ).toBeVisible();
  await employeePage.getByRole("button", { name: "Einladung annehmen" }).click();
  await expect(employeePage).toHaveURL(/\/app$/);

  await expect(employeePage.getByRole("link", { name: "Website" })).toHaveCount(0);
  await expect(employeePage.getByRole("link", { name: "Team" })).toHaveCount(0);
  await employeePage.goto("/app/einstellungen/team");
  await expect(employeePage).toHaveURL(/\/app$/);

  await employeePage.goto("/app/einkauf");
  const quantity = employeePage.getByLabel("Menge für Kalb-Drehspieß E2E A");
  await quantity.fill("61");
  await quantity.locator("xpath=ancestor::form").getByRole("button").click();
  await expect(employeePage.getByRole("status")).toContainText("Menge gespeichert");
  await expect(
    employeePage.getByRole("button", { name: "Bedarf bestätigen" }),
  ).toHaveCount(0);

  await employeeContext.close();
});
