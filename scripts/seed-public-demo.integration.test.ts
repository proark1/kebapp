import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  account,
  demandItems,
  memberships,
  organizations,
  platformRoles,
  storeProfiles,
  supportAssignments,
  user,
} from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import { getPublicStorefrontBySlug } from "@/server/storefront/queries";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";
import { loadDbEnv } from "./db-env";
import { parseProductionEnv, type ProductionEnv } from "./production-env";
import { publicDemoIds, seedPublicDemo } from "./seed-public-demo";

function createTestProductionEnv(): ProductionEnv {
  const dbEnv = loadDbEnv();
  const databaseName = decodeURIComponent(
    new URL(dbEnv.TEST_DATABASE_OWNER_URL).pathname.slice(1),
  );

  return parseProductionEnv({
    ALLOW_PUBLIC_DEMO: "true",
    BETTER_AUTH_SECRET: "integration-test-auth-secret-with-32-characters",
    BETTER_AUTH_URL: "https://203-0-113-10.sslip.io",
    DATABASE_OWNER_URL: dbEnv.TEST_DATABASE_OWNER_URL,
    DATABASE_URL: dbEnv.TEST_DATABASE_URL,
    DEMO_ADMIN_EMAIL: "admin@public-demo.test",
    DEMO_ADMIN_PASSWORD: "admin-integration-password",
    DEMO_EMPLOYEE_EMAIL: "employee@public-demo.test",
    DEMO_EMPLOYEE_PASSWORD: "employee-integration-password",
    DEMO_MODE: "true",
    DEMO_OWNER_EMAIL: "owner-a@public-demo.test",
    DEMO_OWNER_PASSWORD: "owner-a-integration-password",
    DEMO_SECOND_OWNER_EMAIL: "owner-b@public-demo.test",
    DEMO_SECOND_OWNER_PASSWORD: "owner-b-integration-password",
    DEMO_SUPPORT_EMAIL: "support@public-demo.test",
    DEMO_SUPPORT_PASSWORD: "support-integration-password",
    POSTGRES_APP_PASSWORD: dbEnv.POSTGRES_APP_PASSWORD,
    POSTGRES_APP_USER: dbEnv.POSTGRES_APP_USER,
    POSTGRES_DB: databaseName,
    POSTGRES_OWNER_PASSWORD: dbEnv.POSTGRES_OWNER_PASSWORD,
    POSTGRES_OWNER_USER: dbEnv.POSTGRES_OWNER_USER,
  });
}

describe("seedPublicDemo", () => {
  let harness: TestDatabaseHarness;
  let env: ProductionEnv;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    env = createTestProductionEnv();
    await harness.resetAndMigrate();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("creates a complete public demo and remains idempotent", async () => {
    await seedPublicDemo(env);
    await harness.ownerDatabase
      .update(account)
      .set({ password: "password-changed-after-initial-seed" })
      .where(eq(account.id, publicDemoIds.ownerAAccount));

    await seedPublicDemo(env);

    const [userCount] = await harness.ownerDatabase
      .select({ value: count() })
      .from(user);
    const [organizationCount] = await harness.ownerDatabase
      .select({ value: count() })
      .from(organizations);
    const [accountCount] = await harness.ownerDatabase
      .select({ value: count() })
      .from(account);
    const [demandItemCount] = await harness.ownerDatabase
      .select({ value: count() })
      .from(demandItems);
    const [publishedStoreCount] = await harness.ownerDatabase
      .select({ value: count() })
      .from(storeProfiles)
      .where(eq(storeProfiles.isPublished, true));
    const [ownerAAccount] = await harness.ownerDatabase
      .select({ password: account.password })
      .from(account)
      .where(eq(account.id, publicDemoIds.ownerAAccount));

    expect(userCount?.value).toBe(5);
    expect(accountCount?.value).toBe(5);
    expect(organizationCount?.value).toBe(2);
    expect(demandItemCount?.value).toBe(3);
    expect(publishedStoreCount?.value).toBe(1);
    expect(ownerAAccount?.password).toBe("password-changed-after-initial-seed");

    const seededMemberships = await harness.ownerDatabase
      .select({
        organizationId: memberships.organizationId,
        role: memberships.role,
        status: memberships.status,
        userId: memberships.userId,
      })
      .from(memberships);
    expect(seededMemberships).toEqual(
      expect.arrayContaining([
        {
          organizationId: publicDemoIds.organizationA,
          role: "OWNER",
          status: "ACTIVE",
          userId: publicDemoIds.ownerA,
        },
        {
          organizationId: publicDemoIds.organizationA,
          role: "EMPLOYEE",
          status: "ACTIVE",
          userId: publicDemoIds.employee,
        },
        {
          organizationId: publicDemoIds.organizationB,
          role: "OWNER",
          status: "ACTIVE",
          userId: publicDemoIds.ownerB,
        },
      ]),
    );

    const seededRoles = await harness.ownerDatabase
      .select({ role: platformRoles.role, userId: platformRoles.userId })
      .from(platformRoles);
    expect(seededRoles).toEqual(
      expect.arrayContaining([
        { role: "ADMIN", userId: publicDemoIds.admin },
        { role: "SUPPORT", userId: publicDemoIds.support },
      ]),
    );

    const assignments = await harness.ownerDatabase
      .select()
      .from(supportAssignments);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      organizationId: publicDemoIds.organizationA,
      status: "ACTIVE",
      supportUserId: publicDemoIds.support,
    });
  });

  it("keeps each owner inside their organization and exposes only the published site", async () => {
    const ownerAItems = await withTenantContext(
      {
        actor: { userId: publicDemoIds.ownerA },
        database: harness.runtimeDatabase,
        organizationId: publicDemoIds.organizationA,
      },
      (transaction) =>
        transaction
          .select({ organizationId: demandItems.organizationId })
          .from(demandItems),
    );
    const ownerBItems = await withTenantContext(
      {
        actor: { userId: publicDemoIds.ownerB },
        database: harness.runtimeDatabase,
        organizationId: publicDemoIds.organizationB,
      },
      (transaction) =>
        transaction
          .select({ organizationId: demandItems.organizationId })
          .from(demandItems),
    );

    expect(ownerAItems).toHaveLength(2);
    expect(ownerAItems.every((item) => item.organizationId === publicDemoIds.organizationA)).toBe(true);
    expect(ownerBItems).toHaveLength(1);
    expect(ownerBItems[0]?.organizationId).toBe(publicDemoIds.organizationB);

    await expect(
      getPublicStorefrontBySlug({
        database: harness.runtimeDatabase,
        slug: "ocakbasi-rheydt",
      }),
    ).resolves.toMatchObject({
      profile: {
        deliveryEnabled: true,
        pickupEnabled: true,
        schemaVersion: 3,
        whatsappPhone: "+49 2166 123456",
      },
      publicSlug: "ocakbasi-rheydt",
    });
    await expect(
      getPublicStorefrontBySlug({
        database: harness.runtimeDatabase,
        slug: "mangal-am-markt",
      }),
    ).resolves.toBeNull();
  });
});
