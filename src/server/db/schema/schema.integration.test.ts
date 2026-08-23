import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabaseHarness } from "@/server/testing/database";

const expectedTables = [
  "account",
  "audit_events",
  "buying_rounds",
  "demand_items",
  "demand_submissions",
  "demand_template_items",
  "demand_templates",
  "goods_receipt_items",
  "goods_receipts",
  "invitations",
  "memberships",
  "organizations",
  "platform_roles",
  "rate_limit",
  "registration_requests",
  "session",
  "store_profiles",
  "support_assignments",
  "time_entries",
  "user",
  "user_profiles",
  "verification",
] as const;

const expectedForeignKeys = [
  "account.user_id->user.id",
  "demand_items.organization_id->organizations.id",
  "demand_items.submission_id->demand_submissions.id",
  "demand_submissions.buying_round_id->buying_rounds.id",
  "demand_submissions.organization_id->organizations.id",
  "demand_template_items.organization_id->organizations.id",
  "demand_template_items.template_id->demand_templates.id",
  "demand_templates.organization_id->organizations.id",
  "goods_receipt_items.organization_id->organizations.id",
  "goods_receipt_items.receipt_id->goods_receipts.id",
  "goods_receipts.buying_round_id->buying_rounds.id",
  "goods_receipts.organization_id->organizations.id",
  "memberships.organization_id->organizations.id",
  "memberships.user_id->user.id",
  "session.user_id->user.id",
  "store_profiles.organization_id->organizations.id",
  "user_profiles.user_id->user.id",
] as const;

const expectedUniqueIndexes = [
  "demand_submissions_organization_round_unique",
  "demand_templates_organization_unique",
  "goods_receipts_organization_round_unique",
  "invitations_active_unique",
  "memberships_user_organization_unique",
  "organizations_slug_unique",
] as const;

const expectedEnums = {
  demand_submission_status: ["DRAFT", "CONFIRMED"],
  invitation_status: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"],
  membership_role: ["OWNER", "EMPLOYEE"],
  membership_status: ["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"],
  organization_status: ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"],
  platform_role: ["ADMIN", "SUPPORT"],
  registration_request_status: ["PENDING", "APPROVED", "REJECTED"],
} as const;

const harness = createTestDatabaseHarness();
const { ownerPool } = harness;

async function resetAndMigrate(): Promise<void> {
  await harness.resetAndMigrate();
}

describe.sequential("PostgreSQL schema migration", () => {
  beforeAll(async () => {
    await resetAndMigrate();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("creates all authentication, platform, procurement, and storefront tables", async () => {
    const result = await ownerPool.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name
    `);

    expect(result.rows.map((row) => row.table_name)).toEqual(expectedTables);
  });

  it("creates the required foreign keys", async () => {
    const result = await ownerPool.query<{
      column_name: string;
      foreign_column_name: string;
      foreign_table_name: string;
      table_name: string;
    }>(`
      select
        source_table.relname as table_name,
        source_attribute.attname as column_name,
        target_table.relname as foreign_table_name,
        target_attribute.attname as foreign_column_name
      from pg_constraint constraint_record
      join pg_class source_table
        on source_table.oid = constraint_record.conrelid
      join pg_class target_table
        on target_table.oid = constraint_record.confrelid
      join lateral unnest(constraint_record.conkey, constraint_record.confkey)
        as key_columns(source_number, target_number) on true
      join pg_attribute source_attribute
        on source_attribute.attrelid = source_table.oid
       and source_attribute.attnum = key_columns.source_number
      join pg_attribute target_attribute
        on target_attribute.attrelid = target_table.oid
       and target_attribute.attnum = key_columns.target_number
      where constraint_record.contype = 'f'
        and source_table.relnamespace = 'public'::regnamespace
    `);

    const foreignKeys = result.rows.map(
      (row) =>
        `${row.table_name}.${row.column_name}->${row.foreign_table_name}.${row.foreign_column_name}`,
    );

    expect(foreignKeys).toEqual(
      expect.arrayContaining([...expectedForeignKeys]),
    );
  });

  it("enforces the required unique keys, including pending invitations", async () => {
    const result = await ownerPool.query<{ indexname: string; indexdef: string }>(`
      select indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
    `);
    const indexes = new Map(
      result.rows.map((row) => [row.indexname, row.indexdef] as const),
    );

    for (const indexName of expectedUniqueIndexes) {
      expect(indexes.has(indexName), indexName).toBe(true);
    }

    expect(indexes.get("invitations_active_unique")).toContain(
      "WHERE (status = 'PENDING'",
    );
  });

  it("restricts business statuses and roles to their documented values", async () => {
    const result = await ownerPool.query<{ enum_name: string; enum_values: string[] }>(`
      select type_record.typname as enum_name,
             json_agg(enum_record.enumlabel order by enum_record.enumsortorder) as enum_values
      from pg_type type_record
      join pg_enum enum_record on enum_record.enumtypid = type_record.oid
      join pg_namespace namespace_record on namespace_record.oid = type_record.typnamespace
      where namespace_record.nspname = 'public'
      group by type_record.typname
    `);
    const enums = Object.fromEntries(
      result.rows.map((row) => [row.enum_name, row.enum_values]),
    );

    expect(enums).toMatchObject(expectedEnums);
  });

  it("uses UUIDs, timestamptz, exact numerics, and JSONB for business data", async () => {
    const kebappTables = expectedTables.filter(
      (tableName) =>
        !["account", "rate_limit", "session", "user", "verification"].includes(
          tableName,
        ),
    );
    const idColumns = await ownerPool.query<{
      data_type: string;
      table_name: string;
    }>(`
      select table_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and column_name = 'id'
        and table_name = any($1::text[])
    `, [kebappTables]);

    expect(idColumns.rows).toHaveLength(kebappTables.length);
    expect(idColumns.rows.every((column) => column.data_type === "uuid")).toBe(
      true,
    );

    const businessTimestamps = await ownerPool.query<{ data_type: string }>(`
      select data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
        and column_name like '%\\_at' escape '\\'
    `, [kebappTables]);

    expect(businessTimestamps.rows.length).toBeGreaterThan(0);
    expect(
      businessTimestamps.rows.every(
        (column) => column.data_type === "timestamp with time zone",
      ),
    ).toBe(true);

    const exactNumbers = await ownerPool.query<{
      column_name: string;
      numeric_precision: number;
      numeric_scale: number;
      table_name: string;
    }>(`
      select table_name, column_name, numeric_precision, numeric_scale
      from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in (
          ('buying_rounds', 'target_quantity'),
          ('buying_rounds', 'reference_unit_price'),
          ('demand_items', 'quantity'),
          ('demand_items', 'estimated_unit_price')
        )
      order by table_name, column_name
    `);

    expect(exactNumbers.rows).toEqual([
      {
        table_name: "buying_rounds",
        column_name: "reference_unit_price",
        numeric_precision: 12,
        numeric_scale: 2,
      },
      {
        table_name: "buying_rounds",
        column_name: "target_quantity",
        numeric_precision: 12,
        numeric_scale: 3,
      },
      {
        table_name: "demand_items",
        column_name: "estimated_unit_price",
        numeric_precision: 12,
        numeric_scale: 2,
      },
      {
        table_name: "demand_items",
        column_name: "quantity",
        numeric_precision: 12,
        numeric_scale: 3,
      },
    ]);

    const jsonColumns = await ownerPool.query<{ qualified_name: string }>(`
      select table_name || '.' || column_name as qualified_name
      from information_schema.columns
      where table_schema = 'public'
        and data_type = 'jsonb'
      order by qualified_name
    `);

    expect(jsonColumns.rows.map((row) => row.qualified_name)).toEqual(
      expect.arrayContaining([
        "audit_events.metadata",
        "buying_rounds.pricing_tiers",
        "store_profiles.menu",
        "store_profiles.opening_hours",
      ]),
    );
  });

  it("rejects non-positive demand quantities at database level", async () => {
    const result = await ownerPool.query<{ conname: string }>(`
      select conname
      from pg_constraint
      where contype = 'c'
        and connamespace = 'public'::regnamespace
    `);

    expect(result.rows.map((row) => row.conname)).toContain(
      "demand_items_quantity_positive",
    );
  });

  it("can rebuild the complete schema from an empty test database", async () => {
    await resetAndMigrate();

    const result = await ownerPool.query<{ table_count: number }>(`
      select count(*)::int as table_count
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
    `);

    expect(result.rows[0]?.table_count).toBe(expectedTables.length);
  });
});
