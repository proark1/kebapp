import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { loadDbEnv } from "../scripts/db-env";
import { requireTestDatabaseUrl } from "../src/server/testing/database";
import { login } from "./fixtures/auth";
import { e2eIds, e2eUsers } from "./fixtures/database";

test("trennt zwei Ladenkonten in UI und PostgreSQL-RLS", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await Promise.all([
    login(pageA, e2eUsers.ownerA.email),
    login(pageB, e2eUsers.ownerB.email),
  ]);
  await Promise.all([pageA.goto("/app/einkauf"), pageB.goto("/app/einkauf")]);

  await expect(pageA.getByText("Kalb-Drehspieß E2E A", { exact: true })).toBeVisible();
  await expect(pageA.getByText("Hähnchen-Drehspieß E2E B", { exact: true })).toHaveCount(0);
  await expect(pageB.getByText("Hähnchen-Drehspieß E2E B", { exact: true })).toBeVisible();
  await expect(pageB.getByText("Kalb-Drehspieß E2E A", { exact: true })).toHaveCount(0);

  const dbEnv = loadDbEnv();
  requireTestDatabaseUrl(dbEnv.TEST_DATABASE_URL);
  const pool = new Pool({ connectionString: dbEnv.TEST_DATABASE_URL, max: 1 });
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      "select set_config('kebapp.user_id', $1, true), set_config('kebapp.organization_id', $2, true)",
      [e2eUsers.ownerA.id, e2eIds.organizationA],
    );
    const result = await client.query<{ product_name: string }>(
      "select product_name from demand_items order by product_name",
    );
    expect(result.rows).toEqual([{ product_name: "Kalb-Drehspieß E2E A" }]);
    await client.query("rollback");
  } finally {
    client.release();
    await pool.end();
  }

  await Promise.all([contextA.close(), contextB.close()]);
});
