import { expect, test } from "@playwright/test";
import { e2eStorefronts } from "./fixtures/database";

test("zeigt nur die aktive veröffentlichte Ladenwebsite ohne Bezahlfunktion", async ({
  page,
}) => {
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
  await expect(
    page.getByRole("button", { name: /bestellen|bezahlen|warenkorb/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /online bestellen|bezahlen|warenkorb/i }),
  ).toHaveCount(0);
});

for (const storefront of [e2eStorefronts.pending, e2eStorefronts.suspended]) {
  test(`verbirgt nicht aktive Ladenwebsite ${storefront}`, async ({ page }) => {
    const response = await page.goto(`/laden/${storefront}`);
    expect(response?.status()).toBe(404);
  });
}
