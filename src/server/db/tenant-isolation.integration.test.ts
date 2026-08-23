import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  demandItems,
  organizations,
  storeProfiles,
} from "@/server/db/schema";
import {
  TenantAccessDeniedError,
  withTenantContext,
} from "@/server/db/tenant-context";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  admin: "admin-user",
  assignedSupport: "assigned-support-user",
  employeeA: "employee-a-user",
  itemA: "40000000-0000-4000-8000-000000000001",
  itemB: "40000000-0000-4000-8000-000000000002",
  organizationA: "10000000-0000-4000-8000-000000000001",
  organizationB: "10000000-0000-4000-8000-000000000002",
  ownerA: "owner-a-user",
  ownerB: "owner-b-user",
  roundA: "20000000-0000-4000-8000-000000000001",
  roundB: "20000000-0000-4000-8000-000000000002",
  submissionA: "30000000-0000-4000-8000-000000000001",
  submissionB: "30000000-0000-4000-8000-000000000002",
  unassignedSupport: "unassigned-support-user",
} as const;

async function seedTwoOrganizations(harness: TestDatabaseHarness): Promise<void> {
  const { ownerPool } = harness;

  await ownerPool.query(
    `insert into "user" (id, name, email)
     values
       ($1, 'Admin', 'admin@tenant-test.local'),
       ($2, 'Support A', 'support-a@tenant-test.local'),
       ($3, 'Support ohne Zuweisung', 'support-none@tenant-test.local'),
       ($4, 'Inhaber A', 'owner-a@tenant-test.local'),
       ($5, 'Mitarbeiter A', 'employee-a@tenant-test.local'),
       ($6, 'Inhaber B', 'owner-b@tenant-test.local')`,
    [
      ids.admin,
      ids.assignedSupport,
      ids.unassignedSupport,
      ids.ownerA,
      ids.employeeA,
      ids.ownerB,
    ],
  );

  await ownerPool.query(
    `insert into organizations (id, slug, store_name, status)
     values
       ($1, 'laden-a', 'Laden A', 'ACTIVE'),
       ($2, 'laden-b', 'Laden B', 'ACTIVE')`,
    [ids.organizationA, ids.organizationB],
  );

  await ownerPool.query(
    `insert into platform_roles (user_id, role, granted_by_user_id)
     values
       ($1, 'ADMIN', $1),
       ($2, 'SUPPORT', $1),
       ($3, 'SUPPORT', $1)`,
    [ids.admin, ids.assignedSupport, ids.unassignedSupport],
  );

  await ownerPool.query(
    `insert into memberships (user_id, organization_id, role, status, joined_at)
     values
       ($1, $2, 'OWNER', 'ACTIVE', now()),
       ($3, $2, 'EMPLOYEE', 'ACTIVE', now()),
       ($4, $5, 'OWNER', 'ACTIVE', now())`,
    [
      ids.ownerA,
      ids.organizationA,
      ids.employeeA,
      ids.ownerB,
      ids.organizationB,
    ],
  );

  await ownerPool.query(
    `insert into support_assignments (
       support_user_id,
       organization_id,
       assigned_by_user_id,
       purpose,
       status,
       expires_at
     ) values ($1, $2, $3, 'Pilotbetreuung', 'ACTIVE', now() + interval '1 day')`,
    [ids.assignedSupport, ids.organizationA, ids.admin],
  );

  await ownerPool.query(
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
       created_by_user_id
     ) values
       ($1, $2, 'tenant-a-round', 'Runde A', 'OPEN', now() + interval '1 day', date_trunc('day', now()) + interval '2 days 4 hours', date_trunc('day', now()) + interval '2 days 8 hours', 500, 9.20, $3),
       ($4, $5, 'tenant-b-round', 'Runde B', 'OPEN', now() + interval '1 day', date_trunc('day', now()) + interval '2 days 4 hours', date_trunc('day', now()) + interval '2 days 8 hours', 500, 9.20, $6)`,
    [
      ids.roundA,
      ids.organizationA,
      ids.ownerA,
      ids.roundB,
      ids.organizationB,
      ids.ownerB,
    ],
  );

  await ownerPool.query(
    `insert into demand_submissions (id, organization_id, buying_round_id, status)
     values
       ($1, $2, $3, 'DRAFT'),
       ($4, $5, $6, 'DRAFT')`,
    [
      ids.submissionA,
      ids.organizationA,
      ids.roundA,
      ids.submissionB,
      ids.organizationB,
      ids.roundB,
    ],
  );

  await ownerPool.query(
    `insert into demand_items (
       id,
       organization_id,
       submission_id,
       product_name,
       quantity,
       unit,
       requested_delivery_date
     ) values
       ($1, $2, $3, 'Kalb A', 60, 'KG', current_date + 2),
       ($4, $5, $6, 'Kalb B', 70, 'KG', current_date + 2)`,
    [
      ids.itemA,
      ids.organizationA,
      ids.submissionA,
      ids.itemB,
      ids.organizationB,
      ids.submissionB,
    ],
  );

  await ownerPool.query(
    `insert into store_profiles (
       organization_id,
       public_slug,
       name,
       short_name
     ) values
       ($1, 'laden-a', 'Laden A', 'LA'),
       ($2, 'laden-b', 'Laden B', 'LB')`,
    [ids.organizationA, ids.organizationB],
  );
}

describe.sequential("tenant isolation through PostgreSQL RLS", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();
    await seedTwoOrganizations(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  it("uses default deny when no user or organization context exists", async () => {
    const demands = await harness.runtimePool.query(
      "select id from demand_items",
    );
    const profiles = await harness.runtimePool.query(
      "select id from store_profiles",
    );

    expect(demands.rows).toEqual([]);
    expect(profiles.rows).toEqual([]);
  });

  it("lets an owner read only the selected own organization", async () => {
    await withTenantContext(
      {
        actor: { userId: ids.ownerA },
        organizationId: ids.organizationA,
        database: harness.runtimeDatabase,
      },
      async (transaction) => {
        const demands = await transaction
          .select({ id: demandItems.id, organizationId: demandItems.organizationId })
          .from(demandItems);
        const profiles = await transaction
          .select({
            name: storeProfiles.name,
            organizationId: storeProfiles.organizationId,
          })
          .from(storeProfiles);

        expect(demands).toEqual([
          { id: ids.itemA, organizationId: ids.organizationA },
        ]);
        expect(profiles).toEqual([
          { name: "Laden A", organizationId: ids.organizationA },
        ]);
      },
    );
  });

  it("silently filters direct reads and updates aimed at another store", async () => {
    await withTenantContext(
      {
        actor: { userId: ids.ownerA },
        organizationId: ids.organizationA,
        database: harness.runtimeDatabase,
      },
      async (transaction) => {
        const foreignDemands = await transaction
          .select({ id: demandItems.id })
          .from(demandItems)
          .where(eq(demandItems.organizationId, ids.organizationB));
        const updated = await transaction
          .update(demandItems)
          .set({ quantity: "999.000" })
          .where(eq(demandItems.id, ids.itemB))
          .returning({ id: demandItems.id });

        expect(foreignDemands).toEqual([]);
        expect(updated).toEqual([]);
      },
    );

    const persisted = await harness.ownerPool.query<{ quantity: string }>(
      "select quantity from demand_items where id = $1",
      [ids.itemB],
    );
    expect(persisted.rows[0]?.quantity).toBe("70.000");
  });

  it("rejects changing the tenant identifier of a visible row", async () => {
    await expect(
      withTenantContext(
        {
          actor: { userId: ids.ownerA },
          organizationId: ids.organizationA,
          database: harness.runtimeDatabase,
        },
        async (transaction) =>
          transaction
            .update(storeProfiles)
            .set({ organizationId: ids.organizationB })
            .where(eq(storeProfiles.organizationId, ids.organizationA)),
      ),
    ).rejects.toThrow();
  });

  it("requires a live support assignment for the selected store", async () => {
    await expect(
      withTenantContext(
        {
          actor: { userId: ids.unassignedSupport },
          organizationId: ids.organizationA,
          database: harness.runtimeDatabase,
        },
        async () => undefined,
      ),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);

    await withTenantContext(
      {
        actor: { userId: ids.assignedSupport },
        organizationId: ids.organizationA,
        database: harness.runtimeDatabase,
      },
      async (transaction) => {
        const profiles = await transaction
          .select({ name: storeProfiles.name })
          .from(storeProfiles);
        expect(profiles).toEqual([{ name: "Laden A" }]);
      },
    );
  });

  it("enforces employee write limits and freezes confirmed submissions", async () => {
    await withTenantContext(
      {
        actor: { userId: ids.employeeA },
        organizationId: ids.organizationA,
        database: harness.runtimeDatabase,
      },
      async (transaction) => {
        const editedDemands = await transaction
          .update(demandItems)
          .set({ quantity: "61.000" })
          .where(eq(demandItems.id, ids.itemA))
          .returning({ id: demandItems.id });
        const editedProfiles = await transaction
          .update(storeProfiles)
          .set({ tagline: "Nicht erlaubt" })
          .where(eq(storeProfiles.organizationId, ids.organizationA))
          .returning({ id: storeProfiles.id });

        expect(editedDemands).toEqual([{ id: ids.itemA }]);
        expect(editedProfiles).toEqual([]);
      },
    );

    await expect(
      withTenantContext(
        {
          actor: { userId: ids.employeeA },
          organizationId: ids.organizationA,
          database: harness.runtimeDatabase,
        },
        async (transaction) =>
          transaction.execute(sql`
              update demand_submissions
              set status = 'CONFIRMED',
                  confirmed_by_user_id = ${ids.employeeA},
                  confirmed_at = now()
              where id = ${ids.submissionA}::uuid
            `),
      ),
    ).rejects.toThrow();

    await withTenantContext(
      {
        actor: { userId: ids.ownerA },
        organizationId: ids.organizationA,
        database: harness.runtimeDatabase,
      },
      async (transaction) => {
        const confirmed = await transaction.execute<{ status: string }>(sql`
          update demand_submissions
          set status = 'CONFIRMED',
              confirmed_by_user_id = ${ids.ownerA},
              confirmed_at = now()
          where id = ${ids.submissionA}::uuid
          returning status
        `);
        const editedAfterConfirmation = await transaction
          .update(demandItems)
          .set({ quantity: "62.000" })
          .where(eq(demandItems.id, ids.itemA))
          .returning({ id: demandItems.id });

        expect(confirmed.rows).toEqual([{ status: "CONFIRMED" }]);
        expect(editedAfterConfirmation).toEqual([]);
      },
    );
  });

  it("keeps even administrator queries scoped to one organization", async () => {
    await withTenantContext(
      {
        actor: { userId: ids.admin },
        organizationId: ids.organizationB,
        database: harness.runtimeDatabase,
      },
      async (transaction) => {
        const demands = await transaction
          .select({ id: demandItems.id })
          .from(demandItems);
        expect(demands).toEqual([{ id: ids.itemB }]);
      },
    );
  });

  it("lets an administrator inspect and reactivate a suspended organization", async () => {
    await harness.ownerPool.query(
      "update organizations set status = 'SUSPENDED' where id = $1",
      [ids.organizationB],
    );

    await withTenantContext(
      {
        actor: { userId: ids.admin },
        organizationId: ids.organizationB,
        database: harness.runtimeDatabase,
      },
      async (transaction) => {
        const suspended = await transaction
          .select({ status: organizations.status })
          .from(organizations)
          .where(eq(organizations.id, ids.organizationB));
        const reactivated = await transaction
          .update(organizations)
          .set({ status: "ACTIVE" })
          .where(eq(organizations.id, ids.organizationB))
          .returning({ status: organizations.status });

        expect(suspended).toEqual([{ status: "SUSPENDED" }]);
        expect(reactivated).toEqual([{ status: "ACTIVE" }]);
      },
    );
  });

  it("does not leak transaction-local context through a reused pool connection", async () => {
    await withTenantContext(
      {
        actor: { userId: ids.ownerA },
        organizationId: ids.organizationA,
        database: harness.runtimeDatabase,
      },
      async (transaction) => {
        const demands = await transaction
          .select({ id: demandItems.id })
          .from(demandItems);
        expect(demands).toHaveLength(1);
      },
    );

    const context = await harness.runtimePool.query<{
      organization_id: string | null;
      user_id: string | null;
      visible_demands: number;
    }>(`
      select
        nullif(current_setting('kebapp.user_id', true), '') as user_id,
        nullif(current_setting('kebapp.organization_id', true), '') as organization_id,
        (select count(*)::int from demand_items) as visible_demands
    `);

    expect(context.rows[0]).toEqual({
      organization_id: null,
      user_id: null,
      visible_demands: 0,
    });
  });

  it("enables and forces RLS on every Kebapp table but not Better Auth tables", async () => {
    const result = await harness.ownerPool.query<{
      relforcerowsecurity: boolean;
      relname: string;
      relrowsecurity: boolean;
    }>(`
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      where relnamespace = 'public'::regnamespace
        and relkind = 'r'
      order by relname
    `);
    const security = new Map(
      result.rows.map((row) => [row.relname, row] as const),
    );

    for (const tableName of [
      "audit_events",
      "buying_rounds",
      "demand_items",
      "demand_submissions",
      "invitations",
      "memberships",
      "organizations",
      "platform_roles",
      "registration_requests",
      "store_profiles",
      "support_assignments",
      "user_profiles",
    ]) {
      expect(security.get(tableName)).toMatchObject({
        relforcerowsecurity: true,
        relrowsecurity: true,
      });
    }

    for (const tableName of [
      "account",
      "rate_limit",
      "session",
      "user",
      "verification",
    ]) {
      expect(security.get(tableName)).toMatchObject({
        relforcerowsecurity: false,
        relrowsecurity: false,
      });
    }
  });

  it("keeps the policy executor non-login and private functions locked down", async () => {
    const roles = await harness.ownerPool.query<{
      can_assume_policy_role: boolean;
      rolbypassrls: boolean;
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolname: string;
      rolsuper: boolean;
    }>(`
      select
        rolname,
        rolcanlogin,
        rolsuper,
        rolinherit,
        rolbypassrls,
        case
          when rolname = 'kebapp_app'
            then pg_has_role('kebapp_app', 'kebapp_policy_executor', 'MEMBER')
          else false
        end as can_assume_policy_role
      from pg_roles
      where rolname in ('kebapp_app', 'kebapp_policy_executor')
      order by rolname
    `);

    expect(roles.rows).toEqual([
      {
        rolname: "kebapp_app",
        rolcanlogin: true,
        rolsuper: false,
        rolinherit: false,
        rolbypassrls: false,
        can_assume_policy_role: false,
      },
      {
        rolname: "kebapp_policy_executor",
        rolcanlogin: false,
        rolsuper: false,
        rolinherit: false,
        rolbypassrls: true,
        can_assume_policy_role: false,
      },
    ]);

    const functions = await harness.ownerPool.query<{
      app_can_execute: boolean;
      function_name: string;
      owner_name: string;
      proconfig: string[];
      prosecdef: boolean;
      public_can_execute: boolean;
    }>(`
      select
        procedure_record.proname as function_name,
        pg_get_userbyid(procedure_record.proowner) as owner_name,
        procedure_record.prosecdef,
        procedure_record.proconfig,
        has_function_privilege(
          'kebapp_app',
          procedure_record.oid,
          'EXECUTE'
        ) as app_can_execute,
        exists (
          select 1
          from aclexplode(
            coalesce(
              procedure_record.proacl,
              acldefault('f', procedure_record.proowner)
            )
          ) as privilege_record
          where privilege_record.grantee = 0
            and privilege_record.privilege_type = 'EXECUTE'
        ) as public_can_execute
      from pg_proc as procedure_record
      where procedure_record.pronamespace = 'kebapp_private'::regnamespace
      order by procedure_record.proname
    `);

    expect(functions.rows.map((row) => row.function_name)).toEqual([
      "admin_active_organizations",
      "admin_organization_name",
      "admin_store_directory",
      "can_accept_employee_invitation",
      "can_access_organization",
      "can_administer_organization",
      "can_confirm_demand",
      "can_edit_buying_round",
      "can_edit_demand",
      "can_edit_submission",
      "can_manage_members",
      "can_manage_storefront",
      "can_register_owner_membership",
      "can_start_registration",
      "can_submit_registration",
      "close_due_buying_rounds",
      "current_organization_id",
      "current_user_id",
      "current_verified_email",
      "due_round_reminders",
      "has_active_membership",
      "has_active_owner_membership",
      "has_active_support_assignment",
      "is_platform_admin",
      "mark_due_round_reminders",
      "mark_round_reminder_sent",
      "public_storefront",
      "regional_confirmed_demand_kg",
      "regional_savings_report",
      "round_bundle",
      "round_recipients",
    ]);
    expect(
      functions.rows.every(
        (functionRecord) =>
          functionRecord.owner_name === "kebapp_policy_executor" &&
          functionRecord.app_can_execute &&
          !functionRecord.public_can_execute &&
          functionRecord.proconfig.includes(
            "search_path=pg_catalog, pg_temp",
          ),
      ),
    ).toBe(true);
    expect(
      functions.rows.find(
        (functionRecord) =>
          functionRecord.function_name === "is_platform_admin",
      )?.prosecdef,
    ).toBe(true);
  });
});
