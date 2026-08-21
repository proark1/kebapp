import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDemandPlanning } from "@/server/procurement/queries";
import {
  addDemandItem,
  confirmDemandSubmission,
  DemandConfirmationDeniedError,
  DemandLockedError,
  DemandNotFoundError,
  removeDemandItem,
  updateDemandItemQuantity,
} from "@/server/procurement/mutations";
import { demandItems } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  closedRoundA: "20000000-0000-4000-8000-000000000003",
  employeeA: "procurement-employee-a",
  itemA: "40000000-0000-4000-8000-000000000001",
  itemB: "40000000-0000-4000-8000-000000000002",
  organizationA: "10000000-0000-4000-8000-000000000001",
  organizationB: "10000000-0000-4000-8000-000000000002",
  ownerA: "procurement-owner-a",
  ownerB: "procurement-owner-b",
  roundA: "20000000-0000-4000-8000-000000000001",
  roundB: "20000000-0000-4000-8000-000000000002",
  submissionA: "30000000-0000-4000-8000-000000000001",
  submissionB: "30000000-0000-4000-8000-000000000002",
} as const;

const actors = {
  employeeA: { userId: ids.employeeA },
  ownerA: { userId: ids.ownerA },
  ownerB: { userId: ids.ownerB },
};

const openNow = new Date("2099-08-22T08:00:00.000Z");

describe.sequential("tenant demand planning", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values
         ($1, 'Inhaber A', 'owner-a@procurement.test', true),
         ($2, 'Mitarbeiter A', 'employee-a@procurement.test', true),
         ($3, 'Inhaber B', 'owner-b@procurement.test', true)`,
      [ids.ownerA, ids.employeeA, ids.ownerB],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values
         ($1, 'procurement-a', 'Laden A', 'ACTIVE'),
         ($2, 'procurement-b', 'Laden B', 'ACTIVE')`,
      [ids.organizationA, ids.organizationB],
    );
    await harness.ownerPool.query(
      `insert into memberships
         (user_id, organization_id, role, status, joined_at)
       values
         ($1, $3, 'OWNER', 'ACTIVE', now()),
         ($2, $3, 'EMPLOYEE', 'ACTIVE', now()),
         ($4, $5, 'OWNER', 'ACTIVE', now())`,
      [
        ids.ownerA,
        ids.employeeA,
        ids.organizationA,
        ids.ownerB,
        ids.organizationB,
      ],
    );
    await harness.ownerPool.query(
      `insert into buying_rounds (
         id,
         organization_id,
         regional_key,
         name,
         status,
         closes_at,
         delivery_starts_at,
         delivery_ends_at,
         target_quantity,
         reference_unit_price,
         pricing_tiers,
         created_by_user_id
       ) values
         (
           $1, $2, 'mg-fleisch-2099-08-24', 'Fleisch · 24. August', 'OPEN',
           '2099-08-22T16:00:00Z', '2099-08-24T04:00:00Z',
           '2099-08-24T07:00:00Z', 750, 9.18,
           '[{"label":"Einzelkondition","minimumQuantity":"0","unitPrice":"9.40"},{"label":"Zielpreis","minimumQuantity":"750","unitPrice":"8.42"}]'::jsonb,
           $3
         ),
         (
           $4, $5, 'mg-fleisch-2099-08-24', 'Fleisch · 24. August', 'OPEN',
           '2099-08-22T16:00:00Z', '2099-08-24T04:00:00Z',
           '2099-08-24T07:00:00Z', 750, 9.18,
           '[{"label":"Einzelkondition","minimumQuantity":"0","unitPrice":"9.40"},{"label":"Zielpreis","minimumQuantity":"750","unitPrice":"8.42"}]'::jsonb,
           $6
         ),
         (
           $7, $2, 'mg-fleisch-closed', 'Geschlossene Runde', 'CLOSED',
           '2026-08-20T16:00:00Z', '2026-08-21T04:00:00Z',
           '2026-08-21T07:00:00Z', 500, 9.20, '[]'::jsonb, $3
         )`,
      [
        ids.roundA,
        ids.organizationA,
        ids.ownerA,
        ids.roundB,
        ids.organizationB,
        ids.ownerB,
        ids.closedRoundA,
      ],
    );
    await harness.ownerPool.query(
      `insert into demand_submissions
         (id, organization_id, buying_round_id, status, confirmed_by_user_id, confirmed_at)
       values
         ($1, $2, $3, 'DRAFT', null, null),
         ($4, $5, $6, 'CONFIRMED', $7, '2026-08-21T12:00:00Z')`,
      [
        ids.submissionA,
        ids.organizationA,
        ids.roundA,
        ids.submissionB,
        ids.organizationB,
        ids.roundB,
        ids.ownerB,
      ],
    );
    await harness.ownerPool.query(
      `insert into demand_items (
         id,
         organization_id,
         submission_id,
         product_name,
         specification,
         quantity,
         unit,
         requested_delivery_date,
         estimated_unit_price
       ) values
         ($1, $2, $3, 'Kalb-Drehspieß', '20 kg · halal', 60, 'KG', '2099-08-24', 9.18),
         ($4, $5, $6, 'Hähnchen-Drehspieß', '15 kg · halal', 70, 'KG', '2099-08-24', 9.18)`,
      [
        ids.itemA,
        ids.organizationA,
        ids.submissionA,
        ids.itemB,
        ids.organizationB,
        ids.submissionB,
      ],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("returns only the selected store data plus an anonymous confirmed total", async () => {
    const planning = await getDemandPlanning({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      now: openNow,
      organizationId: ids.organizationA,
    });

    expect(planning?.items).toEqual([
      expect.objectContaining({ id: ids.itemA, amount: 60 }),
    ]);
    expect(planning?.round.committedKgWithoutStore).toBe(70);
    expect(planning?.round.regionalKey).toBe("mg-fleisch-2099-08-24");
    expect(JSON.stringify(planning)).not.toContain(ids.organizationB);
    expect(JSON.stringify(planning)).not.toContain("Hähnchen-Drehspieß");
  });

  it("keeps individual positions of another store hidden through the runtime role", async () => {
    await withTenantContext(
      {
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        organizationId: ids.organizationA,
      },
      async (transaction) => {
        const visible = await transaction
          .select({ id: demandItems.id })
          .from(demandItems);
        const foreign = await transaction
          .select({ id: demandItems.id })
          .from(demandItems)
          .where(eq(demandItems.organizationId, ids.organizationB));

        expect(visible).toEqual([{ id: ids.itemA }]);
        expect(foreign).toEqual([]);
      },
    );
  });

  it("allows an employee to add, update, and remove draft positions", async () => {
    const created = await addDemandItem({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      input: {
        buyingRoundId: ids.roundA,
        productName: "Rind-Drehspieß",
        quantity: 20,
        requestedDeliveryDate: "2099-08-24",
        specification: "20 kg · halal",
        unit: "KG",
      },
      now: openNow,
      organizationId: ids.organizationA,
    });

    await updateDemandItemQuantity({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      demandItemId: created.demandItemId,
      now: openNow,
      organizationId: ids.organizationA,
      quantity: 25,
    });
    let persisted = await harness.ownerPool.query<{ quantity: string }>(
      "select quantity from demand_items where id = $1",
      [created.demandItemId],
    );
    expect(persisted.rows[0]?.quantity).toBe("25.000");

    await removeDemandItem({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      demandItemId: created.demandItemId,
      now: openNow,
      organizationId: ids.organizationA,
    });
    persisted = await harness.ownerPool.query<{ quantity: string }>(
      "select quantity from demand_items where id = $1",
      [created.demandItemId],
    );
    expect(persisted.rows).toEqual([]);
  });

  it("rejects confirmation by an employee", async () => {
    await expect(
      confirmDemandSubmission({
        actor: actors.employeeA,
        buyingRoundId: ids.roundA,
        database: harness.runtimeDatabase,
        now: openNow,
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(DemandConfirmationDeniedError);
  });

  it("lets the owner confirm once and freezes every position", async () => {
    const first = await confirmDemandSubmission({
      actor: actors.ownerA,
      buyingRoundId: ids.roundA,
      database: harness.runtimeDatabase,
      now: openNow,
      organizationId: ids.organizationA,
    });
    const repeated = await confirmDemandSubmission({
      actor: actors.ownerA,
      buyingRoundId: ids.roundA,
      database: harness.runtimeDatabase,
      now: openNow,
      organizationId: ids.organizationA,
    });

    expect(first).toEqual({ changed: true });
    expect(repeated).toEqual({ changed: false });
    await expect(
      updateDemandItemQuantity({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        demandItemId: ids.itemA,
        now: openNow,
        organizationId: ids.organizationA,
        quantity: 61,
      }),
    ).rejects.toBeInstanceOf(DemandLockedError);
  });

  it("blocks every mutation after the buying round closes", async () => {
    await expect(
      addDemandItem({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        input: {
          buyingRoundId: ids.closedRoundA,
          productName: "Kalb-Drehspieß",
          quantity: 10,
          requestedDeliveryDate: "2026-08-21",
          specification: "halal",
          unit: "KG",
        },
        now: openNow,
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(DemandLockedError);
  });

  it("does not mutate a well-formed item id owned by another store", async () => {
    await expect(
      updateDemandItemQuantity({
        actor: actors.ownerB,
        database: harness.runtimeDatabase,
        demandItemId: ids.itemA,
        now: openNow,
        organizationId: ids.organizationB,
        quantity: 499,
      }),
    ).rejects.toBeInstanceOf(DemandNotFoundError);

    const item = await harness.ownerPool.query<{ quantity: string }>(
      "select quantity from demand_items where id = $1",
      [ids.itemA],
    );
    expect(item.rows[0]?.quantity).toBe("60.000");
  });
});
