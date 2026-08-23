import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  setAdminContext,
  setOrganizationContext,
  PlatformAdminRequiredError,
} from "@/server/organizations/admin";
import {
  createBuyingRound,
  DuplicateTierThresholdError,
  getBuyingRoundDetail,
  getConfirmedRoundBundle,
  getRoundCloneTemplate,
  listActiveOrganizations,
  listBuyingRounds,
  RoundTransitionError,
  transitionBuyingRound,
} from "@/server/procurement/rounds";
import { addDemandItem } from "@/server/procurement/mutations";
import {
  applyDemandTemplate,
  saveDemandTemplate,
} from "@/server/procurement/templates";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  adminUser: "rounds-admin-user",
  employeeA: "rounds-employee-a",
  organizationA: "60000000-0000-4000-8000-000000000001",
  organizationB: "60000000-0000-4000-8000-000000000002",
  ownerA: "rounds-owner-a",
  submissionB: "80000000-0000-4000-8000-000000000002",
} as const;

const actors = {
  admin: { userId: ids.adminUser },
  employeeA: { userId: ids.employeeA },
  ownerA: { userId: ids.ownerA },
};

const now = new Date("2099-01-10T08:00:00.000Z");

function roundInput(overrides: {
  closesAt?: string;
  deliveryEndsAt?: string;
  deliveryStartsAt?: string;
  name?: string;
  regionalKey?: string;
}) {
  return {
    closesAt: overrides.closesAt ?? "2099-01-20T16:00:00.000Z",
    deliveryEndsAt: overrides.deliveryEndsAt ?? "2099-01-22T09:00:00.000Z",
    deliveryStartsAt: overrides.deliveryStartsAt ?? "2099-01-22T04:00:00.000Z",
    name: overrides.name ?? "Test-Sammelrunde",
    organizationId: ids.organizationA,
    referenceUnitPrice: 9.18,
    regionalKey: overrides.regionalKey ?? "mg-test-region",
    targetQuantity: 400,
  };
}

describe.sequential("admin buying rounds and demand templates", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values
         ($1, 'Plattform Admin', 'admin@rounds.test', true),
         ($2, 'Inhaber A', 'owner-a@rounds.test', true),
         ($3, 'Mitarbeiter A', 'employee-a@rounds.test', true)`,
      [ids.adminUser, ids.ownerA, ids.employeeA],
    );
    await harness.ownerPool.query(
      `insert into platform_roles (user_id, role) values ($1, 'ADMIN')`,
      [ids.adminUser],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values
         ($1, 'rounds-a', 'Laden A', 'ACTIVE'),
         ($2, 'rounds-b', 'Laden B', 'ACTIVE')`,
      [ids.organizationA, ids.organizationB],
    );
    await harness.ownerPool.query(
      `insert into memberships
         (user_id, organization_id, role, status, joined_at)
       values
         ($1, $3, 'OWNER', 'ACTIVE', now()),
         ($2, $3, 'EMPLOYEE', 'ACTIVE', now())`,
      [ids.ownerA, ids.employeeA, ids.organizationA],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("rejects round creation by a non-admin", async () => {
    await expect(
      createBuyingRound({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        input: roundInput({}),
      }),
    ).rejects.toBeInstanceOf(PlatformAdminRequiredError);
  });

  it("creates a planning round as an admin and lists it with the store name", async () => {
    const created = await createBuyingRound({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      input: roundInput({}),
    });
    expect(created.roundId).toBeDefined();

    const rounds = await listBuyingRounds({
      actor: actors.admin,
      database: harness.runtimeDatabase,
    });
    const round = rounds.find((entry) => entry.id === created.roundId);
    expect(round).toMatchObject({
      organizationName: "Laden A",
      regionalKey: "mg-test-region",
      status: "PLANNING",
    });
  });

  it("lists only active organizations for the create form", async () => {
    const organizations = await listActiveOrganizations({
      actor: actors.admin,
      database: harness.runtimeDatabase,
    });
    expect(organizations).toEqual([
      { organizationId: ids.organizationA, organizationName: "Laden A" },
      { organizationId: ids.organizationB, organizationName: "Laden B" },
    ]);
  });

  it("walks the planned lifecycle and rejects invalid transitions", async () => {
    const rounds = await listBuyingRounds({
      actor: actors.admin,
      database: harness.runtimeDatabase,
    });
    const roundId = rounds.find(
      (entry) => entry.status === "PLANNING",
    )!.id;

    const opened = await transitionBuyingRound({
      action: "OPEN",
      actor: actors.admin,
      database: harness.runtimeDatabase,
      roundId,
    });
    expect(opened).toEqual({ changed: true, to: "OPEN" });

    await expect(
      transitionBuyingRound({
        action: "SUBMIT",
        actor: actors.admin,
        database: harness.runtimeDatabase,
        roundId,
      }),
    ).rejects.toBeInstanceOf(RoundTransitionError);

    const closed = await transitionBuyingRound({
      action: "CLOSE",
      actor: actors.admin,
      database: harness.runtimeDatabase,
      reason: "Bestellschluss vorgezogen.",
      roundId,
    });
    expect(closed.to).toBe("CLOSED");

    const submitted = await transitionBuyingRound({
      action: "SUBMIT",
      actor: actors.admin,
      database: harness.runtimeDatabase,
      reason: "Angebot beim Einkaufsteam eingereicht.",
      roundId,
    });
    expect(submitted.changed).toBe(true);
  });

  it("audits created, changed, denied, and successful transitions", async () => {
    const events = await harness.ownerPool.query<{
      action: string;
      result: string;
    }>(
      `select action, result from audit_events where object_type = 'buying_round' order by created_at, action`,
    );

    expect(events.rows.map((row) => row.action)).toContain(
      "BUYING_ROUND_CREATED",
    );
    expect(events.rows.map((row) => row.action)).toContain(
      "BUYING_ROUND_TRANSITION_DENIED",
    );
    const denied = events.rows.find(
      (row) => row.action === "BUYING_ROUND_TRANSITION_DENIED",
    );
    expect(denied?.result).toBe("DENIED");
    const statusChanges = events.rows.filter(
      (row) => row.action === "BUYING_ROUND_STATUS_CHANGED",
    );
    expect(statusChanges.length).toBeGreaterThanOrEqual(3);
    expect(
      statusChanges.every((row) => row.result === "SUCCESS"),
    ).toBe(true);
  });

  it("saves a store template from a draft and reapplies it to a new round", async () => {
    const sourceRound = await createBuyingRound({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      input: roundInput({ name: "Vorlagen-Quelle", closesAt: "2099-02-20T16:00:00.000Z", deliveryStartsAt: "2099-02-22T04:00:00.000Z", deliveryEndsAt: "2099-02-22T09:00:00.000Z" }),
    });
    await transitionBuyingRound({
      action: "OPEN",
      actor: actors.admin,
      database: harness.runtimeDatabase,
      roundId: sourceRound.roundId,
    });

    await addDemandItem({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      input: {
        buyingRoundId: sourceRound.roundId,
        productName: "Kalb-Drehspieß",
        quantity: 60,
        requestedDeliveryDate: "2099-02-22",
        specification: "20 kg · halal",
        unit: "KG",
      },
      now,
      organizationId: ids.organizationA,
    });

    const saved = await saveDemandTemplate({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(saved).toEqual({ itemCount: 1 });

    const targetRound = await createBuyingRound({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      input: roundInput({ name: "Vorlagen-Ziel", closesAt: "2099-03-20T16:00:00.000Z", deliveryStartsAt: "2099-03-22T04:00:00.000Z", deliveryEndsAt: "2099-03-22T09:00:00.000Z" }),
    });
    await transitionBuyingRound({
      action: "OPEN",
      actor: actors.admin,
      database: harness.runtimeDatabase,
      roundId: targetRound.roundId,
    });

    const firstApply = await applyDemandTemplate({
      actor: actors.ownerA,
      buyingRoundId: targetRound.roundId,
      database: harness.runtimeDatabase,
      defaultDeliveryDate: "2099-03-22",
      organizationId: ids.organizationA,
    });
    expect(firstApply).toEqual({ addedItemCount: 1, skippedItemCount: 0 });

    const secondApply = await applyDemandTemplate({
      actor: actors.ownerA,
      buyingRoundId: targetRound.roundId,
      database: harness.runtimeDatabase,
      defaultDeliveryDate: "2099-03-22",
      organizationId: ids.organizationA,
    });
    expect(secondApply).toEqual({ addedItemCount: 0, skippedItemCount: 1 });
  });

  it("bundles confirmed demand per region across finalized store rounds", async () => {
    await harness.ownerPool.query(
      `insert into buying_rounds (
         id, organization_id, regional_key, name, status,
         closes_at, delivery_starts_at, delivery_ends_at,
         target_quantity, pricing_tiers, created_by_user_id
       ) values
         ('70000000-0000-4000-8000-000000000001', $1,
          'mg-bundle-region', 'Bündelquelle A', 'CLOSED',
          '2099-01-05T16:00:00Z', '2099-01-06T04:00:00Z',
          '2099-01-06T07:00:00Z', 500, '[]'::jsonb, $3),
         ('70000000-0000-4000-8000-000000000002', $2,
          'mg-bundle-region', 'Bündelquelle B', 'SUBMITTED',
          '2099-01-05T16:00:00Z', '2099-01-06T04:00:00Z',
          '2099-01-06T07:00:00Z', 500, '[]'::jsonb, $3)`,
      [ids.organizationA, ids.organizationB, ids.adminUser],
    );
    await harness.ownerPool.query(
      `insert into demand_submissions
         (id, organization_id, buying_round_id, status, confirmed_by_user_id, confirmed_at)
       values
         ('90000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000001',
          '70000000-0000-4000-8000-000000000001', 'CONFIRMED',
          'rounds-owner-a', '2099-01-05T12:00:00Z'),
         ($1, '60000000-0000-4000-8000-000000000002',
          '70000000-0000-4000-8000-000000000002', 'CONFIRMED',
          'rounds-owner-a', '2099-01-05T12:00:00Z')`,
      [ids.submissionB],
    );
    await harness.ownerPool.query(
      `insert into demand_items (
         id, organization_id, submission_id, product_name,
         specification, quantity, unit, requested_delivery_date
       ) values
         ('a0000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000001',
          '90000000-0000-4000-8000-000000000001',
          'Kalb-Drehspieß', '20 kg · halal', 60, 'KG', '2099-01-06'),
         ('a0000000-0000-4000-8000-000000000002',
          '60000000-0000-4000-8000-000000000002',
          $1,
          'Hähnchen-Drehspieß', '15 kg · halal', 70, 'KG', '2099-01-06')`,
      [ids.submissionB],
    );

    // Eine der beiden Runden als Referenz für die Region nutzen.
    const bundle = await harness.runtimeDatabase.transaction(
      async (transaction) => {
        await setAdminContext(transaction, actors.admin);
        await setOrganizationContext(transaction, ids.organizationA);
        return getConfirmedRoundBundle(
          transaction,
          "70000000-0000-4000-8000-000000000001",
        );
      },
    );

    expect(bundle).toHaveLength(2);
    const veal = bundle.find((entry) =>
      entry.productName.includes("Kalb"),
    );
    const chicken = bundle.find((entry) =>
      entry.productName.includes("Hähnchen"),
    );
    expect(veal).toMatchObject({ shopCount: 1 });
    expect(Number(veal?.totalQuantity)).toBe(60);
    expect(chicken).toMatchObject({ shopCount: 1 });
    expect(Number(chicken?.totalQuantity)).toBe(70);
  });

  it("hides the bundle from callers without platform-admin context", async () => {
    const bundle = await harness.runtimeDatabase.transaction(
      async (transaction) =>
        getConfirmedRoundBundle(
          transaction,
          "70000000-0000-4000-8000-000000000001",
        ),
    );
    expect(bundle).toEqual([]);
  });

  it("stores pricing tiers sorted and rejects duplicate thresholds", async () => {
    const withTiers = await createBuyingRound({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      input: {
        ...roundInput({ name: "Stufenrunde" }),
        pricingTiers: [
          { label: "Gruppe", minimumQuantity: 300, unitPrice: 8.9 },
          { label: "Einzelkondition", minimumQuantity: 0, unitPrice: 9.4 },
        ],
      },
    });

    const detail = await getBuyingRoundDetail({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      roundId: withTiers.roundId,
    });
    expect(detail.detail.pricingTiers).toEqual([
      { label: "Einzelkondition", minimumQuantity: "0.000", unitPrice: "9.40" },
      { label: "Gruppe", minimumQuantity: "300.000", unitPrice: "8.90" },
    ]);

    await expect(
      createBuyingRound({
        actor: actors.admin,
        database: harness.runtimeDatabase,
        input: {
          ...roundInput({ name: "Kaputte Stufen" }),
          pricingTiers: [
            { label: "A", minimumQuantity: 0, unitPrice: 9.4 },
            { label: "B", minimumQuantity: 0, unitPrice: 8.9 },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(DuplicateTierThresholdError);
  });

  it("provides a clone template without dates for a follow-up round", async () => {
    const source = await createBuyingRound({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      input: {
        ...roundInput({ name: "Klonquelle" }),
        pricingTiers: [
          { label: "Einzelkondition", minimumQuantity: 0, unitPrice: 9.4 },
        ],
      },
    });
    const template = await getRoundCloneTemplate({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      roundId: source.roundId,
    });

    expect(template.name).toBe("Klonquelle · Folgerunde");
    expect(template.organizationId).toBe(ids.organizationA);
    expect(template.regionalKey).toBe("mg-test-region");
    expect(template.targetQuantity).toBe(400);
    expect(template.referenceUnitPrice).toBeCloseTo(9.18, 2);
    expect(template.pricingTiers).toEqual([
      { label: "Einzelkondition", minimumQuantity: "0", unitPrice: "9.4" },
    ]);
  });
});
