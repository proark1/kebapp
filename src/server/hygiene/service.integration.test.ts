import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getHygieneDay,
  HygieneDateLockedError,
  HygieneNoteRequiredError,
  listRecentHygieneDays,
  saveHygieneEntry,
} from "@/server/hygiene/service";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  employeeA: "hyg-employee-a",
  organizationA: "c0000000-0000-4000-8000-000000000001",
  organizationB: "c0000000-0000-4000-8000-000000000002",
  ownerA: "hyg-owner-a",
} as const;

const actors = { employeeA: { userId: ids.employeeA }, ownerA: { userId: ids.ownerA } };

function today(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(now);
}

function baseItems(overrides: Record<string, unknown> = {}) {
  const defaults = [
    { key: "haende", status: "OK" as const },
    { key: "oberflaechen", status: "OK" as const },
    { key: "geraete", status: "OK" as const },
    { key: "muell", status: "OK" as const },
    { key: "kuehlschrank", celsius: 3.5 },
    { key: "tiefkuehler", celsius: -19.2 },
  ];
  return defaults.map((item) => ({ ...item, ...overrides }));
}

describe.sequential("hygiene daily checks", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values ($1, 'Inhaber A', 'o@hyg.test', true), ($2, 'Mitarbeiter A', 'e@hyg.test', true)`,
      [ids.ownerA, ids.employeeA],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values ($1, 'hyg-a', 'Laden A', 'ACTIVE'), ($2, 'hyg-b', 'Laden B', 'ACTIVE')`,
      [ids.organizationA, ids.organizationB],
    );
    await harness.ownerPool.query(
      `insert into memberships
         (user_id, organization_id, role, status, joined_at)
       values ($1, $3, 'OWNER', 'ACTIVE', now()), ($2, $3, 'EMPLOYEE', 'ACTIVE', now())`,
      [ids.ownerA, ids.employeeA, ids.organizationA],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("saves today's checklist and reports defects with mandatory notes enforced", async () => {
    await expect(
      saveHygieneEntry({
        actor: actors.employeeA,
        database: harness.runtimeDatabase,
        input: {
          date: today(),
          items: baseItems({ key: "muell", status: "MANGEL" }).map((item) =>
            item.key === "muell" ? { ...item, note: undefined } : item,
          ) as never,
        },
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(HygieneNoteRequiredError);

    await saveHygieneEntry({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      input: {
        date: today(),
        items: [
          { key: "haende", status: "OK" },
          { key: "oberflaechen", status: "OK" },
          { key: "geraete", status: "MANGEL", note: "Schneidbrett rissig" },
          { key: "muell", status: "OK" },
          { key: "kuehlschrank", celsius: 7.1, note: "Türdichtung prüfen" },
          { key: "tiefkuehler", celsius: -20 },
        ],
        note: "Gerät wird bestellt.",
      } as never,
      organizationId: ids.organizationA,
    });

    const day = await getHygieneDay({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      date: today(),
      organizationId: ids.organizationA,
    });
    expect(day.savedAt).not.toBeNull();
    expect(day.items.find((item) => item.key === "geraete")?.status).toBe("MANGEL");
    expect(day.items.find((item) => item.key === "kuehlschrank")?.valueCelsius).toBe(7.1);

    // Idempotentes Zweitspeichern: weiterhin ein Beleg.
    await saveHygieneEntry({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      input: { date: today(), items: baseItems() } as never,
      organizationId: ids.organizationA,
    });
    const rows = await harness.ownerPool.query<{ count: string }>(
      `select count(*)::text as count from hygiene_entries where entry_date = $1`,
      [today()],
    );
    expect(Number(rows.rows[0]?.count)).toBe(1);
  });

  it("rejects dates older than yesterday and keeps other tenants empty", async () => {
    const oldDate = today(new Date(Date.now() - 5 * 86_400_000));
    await expect(
      saveHygieneEntry({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        input: { date: oldDate, items: baseItems() } as never,
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(HygieneDateLockedError);

    // Fremder Laden ohne Mitgliedschaft: Zugriff verweigert.
    await expect(
      listRecentHygieneDays({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        organizationId: ids.organizationB,
      }),
    ).rejects.toThrow();

    const audit = await harness.ownerPool.query<{ count: string }>(
      `select count(*)::text as count from audit_events where action = 'HYGIENE_ENTRY_SAVED'`,
    );
    expect(Number(audit.rows[0]?.count)).toBeGreaterThanOrEqual(2);
  });
});
