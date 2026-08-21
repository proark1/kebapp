import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listActiveOrganizationCandidates,
  resolveActiveOrganization,
  validateActiveOrganizationSelection,
} from "@/server/organizations/active-organization";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  activeA: "70000000-0000-4000-8000-000000000001",
  activeB: "70000000-0000-4000-8000-000000000002",
  removed: "70000000-0000-4000-8000-000000000003",
  singleUser: "active-organization-single",
  suspended: "70000000-0000-4000-8000-000000000004",
  user: "active-organization-multi",
} as const;

describe.sequential("active organization data access", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values
         ($1, 'Mehrladen Nutzer', 'multi@active-organization.local', true),
         ($2, 'Einzelladen Nutzer', 'single@active-organization.local', true)`,
      [ids.user, ids.singleUser],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values
         ($1, 'active-a', 'Aachener Grill', 'ACTIVE'),
         ($2, 'active-b', 'Rheydter Grill', 'ACTIVE'),
         ($3, 'removed-membership', 'Entfernter Grill', 'ACTIVE'),
         ($4, 'suspended-organization', 'Pausierter Grill', 'SUSPENDED')`,
      [ids.activeA, ids.activeB, ids.removed, ids.suspended],
    );
    await harness.ownerPool.query(
      `insert into memberships (user_id, organization_id, role, status, joined_at)
       values
         ($1, $2, 'OWNER', 'ACTIVE', now()),
         ($1, $3, 'EMPLOYEE', 'ACTIVE', now()),
         ($1, $4, 'OWNER', 'REMOVED', now()),
         ($1, $5, 'OWNER', 'ACTIVE', now()),
         ($6, $2, 'EMPLOYEE', 'ACTIVE', now())`,
      [
        ids.user,
        ids.activeA,
        ids.activeB,
        ids.removed,
        ids.suspended,
        ids.singleUser,
      ],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("automatically resolves the only organization", async () => {
    const resolution = await resolveActiveOrganization({
      actor: { userId: ids.singleUser },
      database: harness.runtimeDatabase,
    });

    expect(resolution).toMatchObject({
      kind: "READY",
      organization: {
        organizationCount: 1,
        organizationId: ids.activeA,
        role: "EMPLOYEE",
      },
    });
  });

  it("lists only organizations that remain active and assigned", async () => {
    const candidates = await listActiveOrganizationCandidates({
      actor: { userId: ids.user },
      database: harness.runtimeDatabase,
    });

    expect(candidates.map((candidate) => candidate.organizationId)).toEqual([
      ids.activeA,
      ids.activeB,
    ]);
  });

  it("requires and validates a choice for several organizations", async () => {
    const unresolved = await resolveActiveOrganization({
      actor: { userId: ids.user },
      database: harness.runtimeDatabase,
    });
    const selected = await validateActiveOrganizationSelection({
      actor: { userId: ids.user },
      database: harness.runtimeDatabase,
      organizationId: ids.activeB,
    });

    expect(unresolved.kind).toBe("SELECTION_REQUIRED");
    expect(selected).toMatchObject({
      organizationId: ids.activeB,
      role: "EMPLOYEE",
    });
  });

  it("rejects an organization outside the active membership set", async () => {
    await expect(
      validateActiveOrganizationSelection({
        actor: { userId: ids.user },
        database: harness.runtimeDatabase,
        organizationId: ids.suspended,
      }),
    ).resolves.toBeNull();
  });
});
