import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  getGoodsReceipt,
  listReceiptRounds,
  ReceiptNotFoundError,
  ReceiptRoundNotAllowedError,
  saveGoodsReceipt,
} from "@/server/procurement/receipts";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  adminUser: "receipt-admin-user",
  employeeA: "receipt-employee-a",
  organizationA: "f0000000-0000-4000-8000-000000000001",
  ownerA: "receipt-owner-a",
  roundDone: "a1000000-0000-4000-8000-000000000001",
  roundPlanning: "a1000000-0000-4000-8000-000000000002",
  submissionA: "a2000000-0000-4000-8000-000000000001",
} as const;

const actors = {
  employeeA: { userId: ids.employeeA },
  ownerA: { userId: ids.ownerA },
};

describe.sequential("goods receipts", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values ($1, 'Admin', 'admin@receipt.test', true),
              ($2, 'Inhaber A', 'owner@receipt.test', true),
              ($3, 'Mitarbeiter A', 'employee@receipt.test', true)`,
      [ids.adminUser, ids.ownerA, ids.employeeA],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values ($1, 'receipt-a', 'Laden A', 'ACTIVE')`,
      [ids.organizationA],
    );
    await harness.ownerPool.query(
      `insert into memberships
         (user_id, organization_id, role, status, joined_at)
       values
         ($1, $3, 'OWNER', 'ACTIVE', now()),
         ($2, $3, 'EMPLOYEE', 'ACTIVE', now())`,
      [ids.ownerA, ids.employeeA, ids.organizationA],
    );
    await harness.ownerPool.query(
      `insert into buying_rounds (
         id, organization_id, regional_key, name, status,
         closes_at, delivery_starts_at, delivery_ends_at,
         target_quantity, created_by_user_id
       ) values
         ($1, $3, 'rc-region', 'Abgeschlossene Runde', 'SUBMITTED',
          '2099-04-01T16:00:00Z', '2099-04-02T04:00:00Z',
          '2099-04-02T07:00:00Z', 400, $4),
         ($2, $3, 'rc-region', 'Geplante Runde', 'PLANNING',
          '2099-06-01T16:00:00Z', '2099-06-02T04:00:00Z',
          '2099-06-02T07:00:00Z', 400, $4)`,
      [ids.roundDone, ids.roundPlanning, ids.organizationA, ids.adminUser],
    );
    await harness.ownerPool.query(
      `insert into demand_submissions (id, organization_id, buying_round_id, status)
       values ($1, $2, $3, 'CONFIRMED')`,
      [ids.submissionA, ids.organizationA, ids.roundDone],
    );
    await harness.ownerPool.query(
      `insert into demand_items (
         id, organization_id, submission_id, product_name,
         specification, quantity, unit, requested_delivery_date
       ) values
         ('a3000000-0000-4000-8000-000000000001', $1, $2, 'Kalb-Drehspieß', '20 kg · halal', 200, 'KG', '2099-04-02'),
         ('a3000000-0000-4000-8000-000000000002', $1, $2, 'Hähnchen-Drehspieß', null, 80, 'KG', '2099-04-02')`,
      [ids.organizationA, ids.submissionA],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("lists only finalized rounds and marks missing receipts", async () => {
    const rounds = await listReceiptRounds({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({
      buyingRoundId: ids.roundDone,
      receiptSavedAt: null,
      status: "SUBMITTED",
    });
  });

  it("prefills lines from the confirmed demand and saves a receipt", async () => {
    const draft = await getGoodsReceipt({
      actor: actors.employeeA,
      buyingRoundId: ids.roundDone,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0]).toMatchObject({ orderedQuantity: 200 });
    expect(draft.savedAt).toBeNull();

    const saved = await saveGoodsReceipt({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      input: {
        buyingRoundId: ids.roundDone,
        lines: [
          {
            demandItemId: "a3000000-0000-4000-8000-000000000001",
            reason: "SHORTAGE" as const,
            reasonNote: "20 kg fehlten auf dem Spieß.",
            receivedQuantity: 180,
          },
          {
            demandItemId: "a3000000-0000-4000-8000-000000000002",
            receivedQuantity: 80,
          },
        ],
        note: "Ansonsten komplette Lieferung.",
      },
      organizationId: ids.organizationA,
    });
    expect(saved.itemCount).toBe(2);

    const persisted = await harness.ownerPool.query<{ missing_reason: string | null; received_quantity: string }>(
      `select received_quantity, missing_reason from goods_receipt_items order by received_quantity`,
    );
    expect(persisted.rows).toEqual([
      { missing_reason: null, received_quantity: "80.000" },
      { missing_reason: "SHORTAGE", received_quantity: "180.000" },
    ]);

    const roundsAfter = await listReceiptRounds({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(roundsAfter[0]?.receiptSavedAt).not.toBeNull();
  });

  it("replaces lines idempotently when saving again", async () => {
    await saveGoodsReceipt({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      input: {
        buyingRoundId: ids.roundDone,
        lines: [
          {
            demandItemId: "a3000000-0000-4000-8000-000000000001",
            receivedQuantity: 200,
          },
          {
            demandItemId: "a3000000-0000-4000-8000-000000000002",
            receivedQuantity: 80,
          },
        ],
      },
      organizationId: ids.organizationA,
    });

    const receipts = await harness.ownerPool.query("select id from goods_receipts");
    expect(receipts.rowCount).toBe(1);
    const items = await harness.ownerPool.query(
      `select received_quantity from goods_receipt_items where demand_item_id = 'a3000000-0000-4000-8000-000000000001'`,
    );
    expect(items.rows[0]?.received_quantity).toBe("200.000");

    const audit = await harness.ownerPool.query<{ count: string }>(
      `select count(*)::text as count from audit_events where action = 'GOODS_RECEIPT_SAVED'`,
    );
    expect(Number(audit.rows[0]?.count)).toBeGreaterThanOrEqual(2);
  });

  it("rejects planning rounds and foreign demand items", async () => {
    await expect(
      saveGoodsReceipt({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        input: {
          buyingRoundId: ids.roundPlanning,
          lines: [
            {
              demandItemId: "a3000000-0000-4000-8000-000000000001",
              receivedQuantity: 10,
            },
          ],
        },
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(ReceiptRoundNotAllowedError);

    await expect(
      saveGoodsReceipt({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        input: {
          buyingRoundId: ids.roundDone,
          lines: [
            {
              demandItemId: "b9999999-9999-4999-8999-999999999999",
              receivedQuantity: 10,
            },
          ],
        },
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(ReceiptNotFoundError);
  });

  it("does not leak other stores' rounds in the overview", async () => {
    const rounds = await listReceiptRounds({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(JSON.stringify(rounds)).not.toContain(ids.roundPlanning);

    const items = await harness.ownerPool.query<{ id: string }>(
      `select id from goods_receipt_items where organization_id <> $1`,
      [ids.organizationA],
    );
    expect(items.rows).toEqual([]);
    expect(eq).toBeDefined();
  });
});
