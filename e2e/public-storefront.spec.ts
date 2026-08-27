import { expect, test } from "@playwright/test";
import { e2eStorefronts } from "./fixtures/database";

test("bereitet auf der aktiven Ladenwebsite eine direkte WhatsApp-Bestellung vor", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.open = (url) => {
      (window as Window & { __kebappOpenedUrl?: string }).__kebappOpenedUrl = String(url);
      return null;
    };
  });
  const response = await page.goto(`/laden/${e2eStorefronts.active}`);
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("link", { name: "E2E Kebaphaus Aktiv Startseite" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Aus der Nachbarschaft. Jeden Tag frisch.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Döner im Fladenbrot", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Per WhatsApp bestellen" }).first().click();
  await expect(page.getByRole("dialog", { name: "Bestellung vorbereiten" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Gericht" })).toHaveValue("e2e-doener");
  await page.getByRole("radio", { name: "Lieferung" }).click();
  await page.getByLabel("Lieferadresse").fill("Marktstraße 44, 41061 Mönchengladbach");
  await page.getByRole("button", { name: "Menge erhöhen" }).click();
  await page.getByRole("button", { name: "In WhatsApp öffnen" }).click();

  const openedUrl = await page.evaluate(
    () => (window as Window & { __kebappOpenedUrl?: string }).__kebappOpenedUrl,
  );
  expect(openedUrl).toContain("https://wa.me/492161123456?text=");
  expect(new URL(openedUrl!).searchParams.get("text")).toContain(
    "2 × Döner im Fladenbrot",
  );
  await expect(page.getByText(/Bezahlen|Warenkorb/i)).toHaveCount(0);
});

// Die Testdatenbank wird nur einmal je Lauf aufgesetzt, alle Browser-Projekte
// teilen sie sich. Jede Variante braucht deshalb eine eigene Nummer, sonst
// waechst der Stempelstand von Projekt zu Projekt.
const consentPhoneByProject: Record<string, string> = {
  "android-narrow": "0176 4004002",
  "desktop-chromium": "0176 4004001",
  "mobile-webkit": "0176 4004003",
};

test("speichert die Bestellung nur mit ausdrücklicher Einwilligung", async ({
  page,
}, testInfo) => {
  const guestPhone =
    consentPhoneByProject[testInfo.project.name] ?? "0176 4004009";
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await page.goto(`/laden/${e2eStorefronts.active}`);
  await page.getByRole("button", { name: "Per WhatsApp bestellen" }).first().click();

  const dialog = page.getByRole("dialog", { name: "Bestellung vorbereiten" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Ohne Haken speichert Kebapp nichts.", { exact: false }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Telefonnummer")).toHaveCount(0);

  const consent = dialog.getByRole("checkbox");
  await consent.check();
  await expect(dialog.getByLabel("Telefonnummer")).toBeVisible();

  // Ohne brauchbare Nummer bleibt die Bestellung stehen.
  await dialog.getByLabel("Telefonnummer").fill("0176");
  await dialog.getByRole("button", { name: "In WhatsApp öffnen" }).click();
  await expect(
    dialog.getByText("Für die Stempelkarte brauchen wir eine gültige Telefonnummer."),
  ).toBeVisible();

  await dialog.getByLabel("Telefonnummer").fill(guestPhone);
  await dialog.getByRole("button", { name: "In WhatsApp öffnen" }).click();
  await expect(dialog.getByText(/du hast jetzt 1 Stempel/)).toBeVisible();
});

for (const storefront of [e2eStorefronts.pending, e2eStorefronts.suspended]) {
  test(`verbirgt nicht aktive Ladenwebsite ${storefront}`, async ({ page }) => {
    const response = await page.goto(`/laden/${storefront}`);
    expect(response?.status()).toBe(404);
  });
}
