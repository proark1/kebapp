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

for (const storefront of [e2eStorefronts.pending, e2eStorefronts.suspended]) {
  test(`verbirgt nicht aktive Ladenwebsite ${storefront}`, async ({ page }) => {
    const response = await page.goto(`/laden/${storefront}`);
    expect(response?.status()).toBe(404);
  });
}
