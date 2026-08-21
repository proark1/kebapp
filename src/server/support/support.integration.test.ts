import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listAuditEvents } from "@/server/audit/queries";
import {
  createEmployeeInvitation,
  InvitationPermissionDeniedError,
} from "@/server/invitations/service";
import { approveRegistrationRequest, PlatformAdminRequiredError } from "@/server/organizations/admin";
import {
  confirmDemandSubmission,
  DemandConfirmationDeniedError,
  updateDemandItemQuantity,
} from "@/server/procurement/mutations";
import { getStorefrontEditor } from "@/server/storefront/queries";
import { updateStorefrontProfile } from "@/server/storefront/mutations";
import {
  assignSupport,
  endSupportAssignment,
  listAssignedSupportOrganizations,
  listSupportAdministration,
  SupportReasonRequiredError,
} from "@/server/support/service";
import { TenantAccessDeniedError } from "@/server/db/tenant-context";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  admin: "support-admin",
  assignmentA: "62000000-0000-4000-8000-000000000001",
  assignmentExpired: "62000000-0000-4000-8000-000000000002",
  itemA: "64000000-0000-4000-8000-000000000001",
  itemB: "64000000-0000-4000-8000-000000000002",
  organizationA: "61000000-0000-4000-8000-000000000001",
  organizationB: "61000000-0000-4000-8000-000000000002",
  ownerA: "support-owner-a",
  ownerB: "support-owner-b",
  registrationRequestA: "65000000-0000-4000-8000-000000000001",
  roundA: "63000000-0000-4000-8000-000000000001",
  roundB: "63000000-0000-4000-8000-000000000002",
  submissionA: "66000000-0000-4000-8000-000000000001",
  submissionB: "66000000-0000-4000-8000-000000000002",
  support: "support-assigned",
  supportOther: "support-other",
} as const;

const actors = {
  admin: { userId: ids.admin },
  support: { userId: ids.support },
  supportOther: { userId: ids.supportOther },
};

const openNow = new Date("2099-08-22T08:00:00.000Z");

describe.sequential("assigned support operations", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values
         ($1, 'Prüftisch Admin', 'admin@support.test', true),
         ($2, 'Support West', 'west@support.test', true),
         ($3, 'Support Ost', 'ost@support.test', true),
         ($4, 'Inhaber A', 'owner-a@support.test', true),
         ($5, 'Inhaber B', 'owner-b@support.test', true)`,
      [ids.admin, ids.support, ids.supportOther, ids.ownerA, ids.ownerB],
    );
    await harness.ownerPool.query(
      `insert into platform_roles (user_id, role, granted_by_user_id)
       values ($1, 'ADMIN', $1), ($2, 'SUPPORT', $1), ($3, 'SUPPORT', $1)`,
      [ids.admin, ids.support, ids.supportOther],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values
         ($1, 'support-laden-a', 'Ocakbasi Rheydt', 'ACTIVE'),
         ($2, 'support-laden-b', 'Kebap Haus Viersen', 'ACTIVE')`,
      [ids.organizationA, ids.organizationB],
    );
    await harness.ownerPool.query(
      `insert into memberships (user_id, organization_id, role, status, joined_at)
       values
         ($1, $2, 'OWNER', 'ACTIVE', now()),
         ($3, $4, 'OWNER', 'ACTIVE', now())`,
      [ids.ownerA, ids.organizationA, ids.ownerB, ids.organizationB],
    );
    await harness.ownerPool.query(
      `insert into support_assignments (
         id, support_user_id, organization_id, assigned_by_user_id,
         purpose, status, expires_at
       ) values
         ($1, $2, $3, $4, 'Bedarf und Website im Pilot begleiten', 'ACTIVE', '2099-09-01T00:00:00Z'),
         ($5, $2, $6, $4, 'Abgelaufene Einführung', 'ACTIVE', '2020-01-01T00:00:00Z')`,
      [
        ids.assignmentA,
        ids.support,
        ids.organizationA,
        ids.admin,
        ids.assignmentExpired,
        ids.organizationB,
      ],
    );
    await harness.ownerPool.query(
      `insert into buying_rounds (
         id, organization_id, regional_key, name, status, closes_at,
         delivery_starts_at, delivery_ends_at, target_quantity,
         reference_unit_price, pricing_tiers, created_by_user_id
       ) values
         ($1, $2, 'support-round-a', 'Fleisch · Pilot A', 'OPEN',
          '2099-08-22T16:00:00Z', '2099-08-24T04:00:00Z',
          '2099-08-24T07:00:00Z', 500, 9.20, '[]'::jsonb, $3),
         ($4, $5, 'support-round-b', 'Fleisch · Pilot B', 'OPEN',
          '2099-08-22T16:00:00Z', '2099-08-24T04:00:00Z',
          '2099-08-24T07:00:00Z', 500, 9.20, '[]'::jsonb, $6)`,
      [
        ids.roundA,
        ids.organizationA,
        ids.ownerA,
        ids.roundB,
        ids.organizationB,
        ids.ownerB,
      ],
    );
    await harness.ownerPool.query(
      `insert into demand_submissions (id, organization_id, buying_round_id, status)
       values ($1, $2, $3, 'DRAFT'), ($4, $5, $6, 'DRAFT')`,
      [
        ids.submissionA,
        ids.organizationA,
        ids.roundA,
        ids.submissionB,
        ids.organizationB,
        ids.roundB,
      ],
    );
    await harness.ownerPool.query(
      `insert into demand_items (
         id, organization_id, submission_id, product_name, specification,
         quantity, unit, requested_delivery_date
       ) values
         ($1, $2, $3, 'Kalb-Drehspieß', '20 kg · halal', 60, 'KG', '2099-08-24'),
         ($4, $5, $6, 'Hähnchen-Drehspieß', '15 kg · halal', 70, 'KG', '2099-08-24')`,
      [
        ids.itemA,
        ids.organizationA,
        ids.submissionA,
        ids.itemB,
        ids.organizationB,
        ids.submissionB,
      ],
    );
    await harness.ownerPool.query(
      `insert into store_profiles (
         organization_id, public_slug, name, short_name, eyebrow, tagline,
         description, phone, street, postal_code, city, opening_hours, menu,
         is_published
       ) values
         ($1, 'support-laden-a', 'Ocakbasi Rheydt', 'OR', 'Seit 1998',
          'Frisch in Rheydt.', 'Drehspieß und frische Zutaten.', '02161 111111',
          'Markt 1', '41236', 'Mönchengladbach',
          '[{"days":"Montag–Samstag","hours":"11:00–23:00"}]'::jsonb,
          '[{"id":"menu-a","name":"Döner","description":"Salat und Sauce","price":"7.50","category":"Döner"}]'::jsonb,
          true)`,
      [ids.organizationA],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("lists only live assignments for the signed-in support user", async () => {
    const assignments = await listAssignedSupportOrganizations({
      actor: actors.support,
      database: harness.runtimeDatabase,
    });

    expect(assignments).toEqual([
      expect.objectContaining({
        assignmentId: ids.assignmentA,
        organizationId: ids.organizationA,
        storeName: "Ocakbasi Rheydt",
      }),
    ]);
    expect(JSON.stringify(assignments)).not.toContain(ids.organizationB);
  });

  it("keeps unassigned and expired stores inaccessible", async () => {
    await expect(
      getStorefrontEditor({
        actor: actors.supportOther,
        database: harness.runtimeDatabase,
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);

    await expect(
      updateDemandItemQuantity({
        actor: actors.support,
        database: harness.runtimeDatabase,
        demandItemId: ids.itemB,
        now: openNow,
        organizationId: ids.organizationB,
        quantity: 499,
        supportReason: "Versuch einer Änderung ohne aktive Zuweisung.",
      }),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);

    await expect(
      getStorefrontEditor({
        actor: actors.support,
        database: harness.runtimeDatabase,
        organizationId: ids.organizationB,
      }),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);
  });

  it("requires a documented reason for every support mutation", async () => {
    await expect(
      updateDemandItemQuantity({
        actor: actors.support,
        database: harness.runtimeDatabase,
        demandItemId: ids.itemA,
        now: openNow,
        organizationId: ids.organizationA,
        quantity: 61,
      }),
    ).rejects.toBeInstanceOf(SupportReasonRequiredError);
  });

  it("writes target, change and reason to the audit trail", async () => {
    const reason = "Telefonische Korrektur nach Rücksprache mit dem Inhaber.";
    await updateDemandItemQuantity({
      actor: actors.support,
      database: harness.runtimeDatabase,
      demandItemId: ids.itemA,
      now: openNow,
      organizationId: ids.organizationA,
      quantity: 62,
      supportReason: reason,
    });

    const persisted = await harness.ownerPool.query<{
      action: string;
      metadata: { after: number; before: number };
      object_id: string;
      reason: string;
    }>(
      `select action, object_id, reason, metadata
       from audit_events
       where actor_user_id = $1 and action = 'SUPPORT_DEMAND_QUANTITY_UPDATED'`,
      [ids.support],
    );
    expect(persisted.rows).toEqual([
      {
        action: "SUPPORT_DEMAND_QUANTITY_UPDATED",
        metadata: { after: 62, before: 60 },
        object_id: ids.itemA,
        reason,
      },
    ]);
  });

  it("allows an assigned support user to update the storefront with a reason", async () => {
    const editor = await getStorefrontEditor({
      actor: actors.support,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    await updateStorefrontProfile({
      actor: actors.support,
      database: harness.runtimeDatabase,
      isPublished: editor.isPublished,
      organizationId: ids.organizationA,
      profile: { ...editor.profile, phone: "02161 999999" },
      supportReason: "Neue Telefonnummer wurde vom Inhaber vor Ort bestätigt.",
    });

    const audit = await harness.ownerPool.query<{ action: string; reason: string }>(
      `select action, reason from audit_events
       where actor_user_id = $1 and action = 'SUPPORT_STOREFRONT_UPDATED'`,
      [ids.support],
    );
    expect(audit.rows).toEqual([
      {
        action: "SUPPORT_STOREFRONT_UPDATED",
        reason: "Neue Telefonnummer wurde vom Inhaber vor Ort bestätigt.",
      },
    ]);
  });

  it("does not let support confirm demand or perform admin reviews", async () => {
    await expect(
      confirmDemandSubmission({
        actor: actors.support,
        buyingRoundId: ids.roundA,
        database: harness.runtimeDatabase,
        now: openNow,
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(DemandConfirmationDeniedError);

    await expect(
      approveRegistrationRequest({
        actor: actors.support,
        database: harness.runtimeDatabase,
        requestId: ids.registrationRequestA,
      }),
    ).rejects.toBeInstanceOf(PlatformAdminRequiredError);

    await expect(
      createEmployeeInvitation({
        actor: {
          email: "west@support.test",
          emailVerified: true,
          name: "Support West",
          userId: ids.support,
        },
        appBaseUrl: "http://localhost:3000",
        database: harness.runtimeDatabase,
        email: "neue-person@support.test",
        organizationId: ids.organizationA,
        sendEmail: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(InvitationPermissionDeniedError);
  });

  it("lets admins assign and revoke support with purpose and expiry", async () => {
    const overview = await listSupportAdministration({
      actor: actors.admin,
      database: harness.runtimeDatabase,
    });
    expect(overview.supportUsers.map((user) => user.userId)).toEqual(
      expect.arrayContaining([ids.support, ids.supportOther]),
    );

    const created = await assignSupport({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      expiresAt: new Date("2099-10-01T00:00:00.000Z"),
      organizationId: ids.organizationB,
      purpose: "Website-Erstaufnahme und wöchentliche Bedarfshilfe",
      supportUserId: ids.supportOther,
    });
    const assigned = await listAssignedSupportOrganizations({
      actor: actors.supportOther,
      database: harness.runtimeDatabase,
    });
    expect(assigned).toEqual([
      expect.objectContaining({
        assignmentId: created.assignmentId,
        organizationId: ids.organizationB,
      }),
    ]);

    await endSupportAssignment({
      actor: actors.admin,
      assignmentId: created.assignmentId,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationB,
      reason: "Erstaufnahme abgeschlossen und an das Ladenteam übergeben.",
    });
    const audit = await listAuditEvents({
      actor: actors.admin,
      database: harness.runtimeDatabase,
      filters: {
        action: "SUPPORT_ASSIGN",
        actor: "Prüftisch Admin",
        organizationId: ids.organizationB,
      },
    });
    expect(audit.map((event) => event.action)).toEqual(
      expect.arrayContaining(["SUPPORT_ASSIGNMENT_ENDED", "SUPPORT_ASSIGNED"]),
    );
    expect(audit).toHaveLength(2);
    await expect(
      listAssignedSupportOrganizations({
        actor: actors.supportOther,
        database: harness.runtimeDatabase,
      }),
    ).resolves.toEqual([]);
  });
});
