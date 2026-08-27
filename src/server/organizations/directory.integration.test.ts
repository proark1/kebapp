import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getRegionalSavings,
  listStoreDirectory,
} from "@/server/organizations/directory";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  adminUser: "directory-admin-user",
  organizationA: "b0000000-0000-4000-8000-000000000001",
  organizationB: "b0000000-0000-4000-8000-000000000002",
  ownerA: "directory-owner-a",
  roundA: "c0000000-0000-4000-8000-000000000001",
  roundB: "c0000000-0000-4000-8000-000000000002",
  submissionA: "d0000000-0000-4000-8000-000000000001",
  submissionB: "d0000000-0000-4000-8000-000000000002",
} as const;

const actors = { admin: { userId: ids.adminUser }, ownerA: { userId: ids.ownerA } };

describe.sequential("admin store directory and regional savings", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values ($1, 'Admin', 'admin@directory.test', true),
              ($2, 'Inhaber A', 'owner@directory.test', true)`,
      [ids.adminUser, ids.ownerA],
    );
    await harness.ownerPool.query(
      `insert into platform_roles (user_id, role) values ($1, 'ADMIN')`,
      [ids.adminUser],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status, reviewed_at)
       values
         ($1, 'directory-a', 'Laden A', 'ACTIVE', now()),
         ($2, 'directory-b', 'Laden B', 'ACTIVE', now())`,
      [ids.organizationA, ids.organizationB],
    );
    await harness.ownerPool.query(
      `insert into memberships (user_id, organization_id, role, status, joined_at)
       values ($1, $2, 'OWNER', 'ACTIVE', now())`,
      [ids.ownerA, ids.organizationA],
    );
    await harness.ownerPool.query(
      `insert into store_profiles
         (organization_id, public_slug, is_published, schema_version, name,
          short_name, tagline, description)
       values
         ($1, 'laden-a', true, 3, 'Laden A', 'LA', 'y', 'z'),
         ($2, 'laden-b', false, 3, 'Laden B', 'LB', 'y', 'z')`,
      [ids.organizationA, ids.organizationB],
    );
    // Zwei abgeschlossene Runden derselben Region; Preisstufe 300 kg.
    await harness.ownerPool.query(
      `insert into buying_rounds (
         id, organization_id, regional_key, name, status,
         closes_at, delivery_starts_at, delivery_ends_at,
         target_quantity, reference_unit_price, pricing_tiers,
         created_by_user_id
       ) values
         ($1, $3, 'dir-region', 'Runde A', 'SUBMITTED',
          '2099-05-01T16:00:00Z', '2099-05-02T04:00:00Z',
          '2099-05-02T07:00:00Z', 500, 9.40,
          '[{"label":"Einzel","minimumQuantity":"0","unitPrice":"9.40"},{"label":"Gruppe","minimumQuantity":"300","unitPrice":"8.90"}]'::jsonb,
          $5),
         ($2, $4, 'dir-region', 'Runde B', 'CLOSED',
          '2099-05-01T16:00:00Z', '2099-05-02T04:00:00Z',
          '2099-05-02T07:00:00Z', 500, 9.40,
          '[{"label":"Einzel","minimumQuantity":"0","unitPrice":"9.40"},{"label":"Gruppe","minimumQuantity":"300","unitPrice":"8.90"}]'::jsonb,
          $5)`,
      [ids.roundA, ids.roundB, ids.organizationA, ids.organizationB, ids.adminUser],
    );
    await harness.ownerPool.query(
      `insert into demand_submissions
         (id, organization_id, buying_round_id, status, confirmed_by_user_id, confirmed_at)
       values
         ($1, $3, $5, 'CONFIRMED', $7, now()),
         ($2, $4, $6, 'CONFIRMED', $7, now())`,
      [
        ids.submissionA,
        ids.submissionB,
        ids.organizationA,
        ids.organizationB,
        ids.roundA,
        ids.roundB,
        ids.ownerA,
      ],
    );
    await harness.ownerPool.query(
      `insert into demand_items (
         id, organization_id, submission_id, product_name,
         specification, quantity, unit, requested_delivery_date
       ) values
         ('e0000000-0000-4000-8000-000000000001', $1, $3, 'Kalb-Drehspieß', null, 200, 'KG', '2099-05-02'),
         ('e0000000-0000-4000-8000-000000000002', $1, $3, 'Falafel', null, 10, 'PIECE', '2099-05-02'),
         ('e0000000-0000-4000-8000-000000000003', $2, $4, 'Hähnchen-Drehspieß', null, 150, 'KG', '2099-05-02')`,
      [
        ids.organizationA,
        ids.organizationB,
        ids.submissionA,
        ids.submissionB,
      ],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("lists every store with aggregates for platform admins", async () => {
    const directory = await listStoreDirectory({
      actor: actors.admin,
      database: harness.runtimeDatabase,
    });

    expect(directory).toHaveLength(2);
    const storeA = directory.find(
      (entry) => entry.organizationId === ids.organizationA,
    )!;
    expect(storeA).toMatchObject({
      memberCount: 1,
      status: "ACTIVE",
      websitePublished: true,
      websiteSlug: "laden-a",
      latestRoundStatus: "SUBMITTED",
    });
    // Die Adminliste gibt diesen Wert direkt an Intl.DateTimeFormat weiter.
    // Kommt dort etwas anderes als ein Date an, stuerzt die Seite mit
    // "Invalid time value" ab.
    expect(storeA.latestRoundClosesAt).toBeInstanceOf(Date);
    expect(
      Number.isNaN(new Date(storeA.latestRoundClosesAt!).getTime()),
    ).toBe(false);
    expect(storeA.createdAt).toBeInstanceOf(Date);

    const storeB = directory.find(
      (entry) => entry.organizationId === ids.organizationB,
    )!;
    expect(storeB.websitePublished).toBe(false);
  });

  it("computes per-store savings with the group tier across the region", async () => {
    const savings = await getRegionalSavings({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      roundId: ids.roundA,
    });

    // Gruppe: 200 + 150 = 350 kg -> Stufe "Gruppe" (8.90 statt 9.40).
    expect(savings).toHaveLength(2);
    const storeA = savings.find(
      (entry) => entry.organizationId === ids.organizationA,
    )!;
    expect(storeA.confirmedKg).toBe(200);
    expect(storeA.effectivePrice).toBe(8.9);
    expect(storeA.savingsEur).toBe(100); // 0.50 * 200
    const storeB = savings.find(
      (entry) => entry.organizationId === ids.organizationB,
    )!;
    expect(storeB.confirmedKg).toBe(150);
    expect(storeB.savingsEur).toBe(75); // 0.50 * 150
  });

  it("returns no directory rows without the platform role", async () => {
    await expect(
      listStoreDirectory({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
      }),
    ).rejects.toThrow();
  });
});
