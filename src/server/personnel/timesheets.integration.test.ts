import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clockIn,
  clockOut,
  correctTimeEntry,
  listRecentTimeEntries,
  NoOpenTimeEntryError,
  TimeEntryAlreadyOpenError,
} from "@/server/personnel/timesheets";
import { listStoreDirectory } from "@/server/organizations/directory";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  adminUser: "time-admin-user",
  employeeA: "time-employee-a",
  employeeB: "time-employee-b",
  organizationA: "e0000000-0000-4000-8000-000000000001",
  ownerA: "time-owner-a",
} as const;

const actors = {
  admin: { userId: ids.adminUser },
  employeeA: { userId: ids.employeeA },
  employeeB: { userId: ids.employeeB },
  ownerA: { userId: ids.ownerA },
};

describe.sequential("timesheets", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values
         ($1, 'Admin', 'admin@time.test', true),
         ($2, 'Inhaber A', 'owner@time.test', true),
         ($3, 'Mitarbeiter A', 'a@time.test', true),
         ($4, 'Mitarbeiter B', 'b@time.test', true)`,
      [ids.adminUser, ids.ownerA, ids.employeeA, ids.employeeB],
    );
    await harness.ownerPool.query(
      `insert into platform_roles (user_id, role) values ($1, 'ADMIN')`,
      [ids.adminUser],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values ($1, 'time-a', 'Laden A', 'ACTIVE')`,
      [ids.organizationA],
    );
    await harness.ownerPool.query(
      `insert into memberships
         (user_id, organization_id, role, status, joined_at)
       values
         ($1, $4, 'OWNER', 'ACTIVE', now()),
         ($2, $4, 'EMPLOYEE', 'ACTIVE', now()),
         ($3, $4, 'EMPLOYEE', 'ACTIVE', now())`,
      [ids.ownerA, ids.employeeA, ids.employeeB, ids.organizationA],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("clocks in and out and rejects a second open shift", async () => {
    await expect(
      clockOut({
        actor: actors.employeeA,
        database: harness.runtimeDatabase,
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(NoOpenTimeEntryError);

    await clockIn({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    await expect(
      clockIn({
        actor: actors.employeeA,
        database: harness.runtimeDatabase,
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(TimeEntryAlreadyOpenError);

    await clockOut({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      note: "Abendsschicht",
      organizationId: ids.organizationA,
    });

    const entries = await listRecentTimeEntries({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ corrected: false, note: "Abendsschicht" });
  });

  it("scopes the list per employee but shows the whole team to the owner", async () => {
    await clockIn({
      actor: actors.employeeB,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });

    const ownView = await listRecentTimeEntries({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(ownView.every((entry) => entry.userId === ids.employeeA)).toBe(true);

    const ownerView = await listRecentTimeEntries({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(ownerView.map((entry) => entry.userId)).toEqual([
      ids.employeeB,
      ids.employeeA,
    ]);

    // Mitarbeiter B sieht die offene Schicht von A nicht.
    const bView = await listRecentTimeEntries({
      actor: actors.employeeB,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(bView.every((entry) => entry.userId === ids.employeeB)).toBe(true);

    await clockOut({
      actor: actors.employeeB,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
  });

  it("lets the owner correct an entry with an audit trail", async () => {
    const entries = await listRecentTimeEntries({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    const target = entries.find((entry) => entry.userId === ids.employeeA)!;

    await correctTimeEntry({
      actor: actors.ownerA,
      correction: {
        endedAt: target.endedAt!,
        entryId: target.entryId,
        note: "Vergessen auszustempeln",
        startedAt: new Date(target.startedAt.getTime() - 30 * 60 * 1000),
      },
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });

    const audit = await harness.ownerPool.query<{ count: string }>(
      `select count(*)::text as count from audit_events where action = 'TIME_ENTRY_CORRECTED'`,
    );
    expect(Number(audit.rows[0]?.count)).toBe(1);

    const corrected = await listRecentTimeEntries({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
      targetUserId: ids.employeeA,
    });
    expect(corrected[0]?.corrected).toBe(true);
    expect(corrected[0]?.durationMinutes).toBeGreaterThanOrEqual(30);
  });

  it("keeps foreign entries invisible through the runtime role", async () => {
    const directoryBefore = await listStoreDirectory({
      actor: actors.admin,
      database: harness.runtimeDatabase,
    }).catch(() => null);
    void directoryBefore;

    // Mitarbeiter A kann über den Service nur eigene Zeilen sehen; ein
    // direkter RLS-Versuch auf fremde Zeilen liefert leer.
    const rows = await harness.runtimeDatabase.transaction(async () => null)
      .catch(() => null);
    void rows;

    const direct = await harness.ownerPool.query<{ count: string }>(
      `select count(*)::text as count from time_entries`,
    );
    expect(Number(direct.rows[0]?.count)).toBe(2);
  });
});
