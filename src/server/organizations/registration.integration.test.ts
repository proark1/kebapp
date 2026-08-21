import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DuplicatePendingRegistrationError,
  EmailVerificationRequiredError,
  submitStoreRegistration,
} from "@/server/organizations/registration";
import {
  approveRegistrationRequest,
  PlatformAdminRequiredError,
  rejectRegistrationRequest,
  suspendOrganization,
} from "@/server/organizations/admin";
import {
  TenantAccessDeniedError,
  withTenantContext,
} from "@/server/db/tenant-context";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const users = {
  admin: {
    email: "admin@registration-test.local",
    emailVerified: true,
    name: "Kebapp Admin",
    userId: "registration-admin",
  },
  applicant: {
    email: "applicant@registration-test.local",
    emailVerified: true,
    name: "Ada Betreiberin",
    userId: "registration-applicant",
  },
  rejectedApplicant: {
    email: "rejected@registration-test.local",
    emailVerified: true,
    name: "Rami Betreiber",
    userId: "registration-rejected",
  },
  unverifiedApplicant: {
    email: "unverified@registration-test.local",
    emailVerified: false,
    name: "Nicht bestätigt",
    userId: "registration-unverified",
  },
} as const;

function registrationInput(suffix: string) {
  return {
    city: "Mönchengladbach",
    contactEmail: `kontakt-${suffix}@example.com`,
    contactName: `Kontakt ${suffix}`,
    contactPhone: "02161 000000",
    legalName: `Mustergrill ${suffix} GmbH`,
    postalCode: "41061",
    storeName: `Mustergrill ${suffix}`,
    street: "Musterstraße 1",
  };
}

describe.sequential("store registration and admin approval", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values
         ($1, $2, $3, true),
         ($4, $5, $6, true),
         ($7, $8, $9, true),
         ($10, $11, $12, false)`,
      [
        users.admin.userId,
        users.admin.name,
        users.admin.email,
        users.applicant.userId,
        users.applicant.name,
        users.applicant.email,
        users.rejectedApplicant.userId,
        users.rejectedApplicant.name,
        users.rejectedApplicant.email,
        users.unverifiedApplicant.userId,
        users.unverifiedApplicant.name,
        users.unverifiedApplicant.email,
      ],
    );
    await harness.ownerPool.query(
      `insert into platform_roles (user_id, role, granted_by_user_id)
       values ($1, 'ADMIN', $1)`,
      [users.admin.userId],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("rejects an applicant whose email is not verified", async () => {
    await expect(
      submitStoreRegistration({
        actor: users.unverifiedApplicant,
        database: harness.runtimeDatabase,
        input: registrationInput("Unverified"),
      }),
    ).rejects.toBeInstanceOf(EmailVerificationRequiredError);

    const organizations = await harness.ownerPool.query<{ count: number }>(
      "select count(*)::int as count from organizations",
    );
    expect(organizations.rows[0]?.count).toBe(0);
  });

  it("creates a pending organization, request, and inactive owner atomically", async () => {
    const registration = await submitStoreRegistration({
      actor: users.applicant,
      database: harness.runtimeDatabase,
      input: registrationInput("Rheydt"),
    });

    const persisted = await harness.ownerPool.query<{
      membership_status: string;
      organization_status: string;
      request_status: string;
      role: string;
    }>(
      `select
         organization_record.status as organization_status,
         request_record.status as request_status,
         membership_record.status as membership_status,
         membership_record.role
       from organizations organization_record
       join registration_requests request_record
         on request_record.organization_id = organization_record.id
       join memberships membership_record
         on membership_record.organization_id = organization_record.id
       where organization_record.id = $1`,
      [registration.organizationId],
    );

    expect(persisted.rows).toEqual([
      {
        membership_status: "INVITED",
        organization_status: "PENDING",
        request_status: "PENDING",
        role: "OWNER",
      },
    ]);

    await expect(
      withTenantContext(
        {
          actor: { userId: users.applicant.userId },
          database: harness.runtimeDatabase,
          organizationId: registration.organizationId,
        },
        async () => undefined,
      ),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);
  });

  it("does not create a second open request for the same user", async () => {
    const before = await harness.ownerPool.query<{ count: number }>(
      "select count(*)::int as count from organizations",
    );

    await expect(
      submitStoreRegistration({
        actor: users.applicant,
        database: harness.runtimeDatabase,
        input: registrationInput("Doppelt"),
      }),
    ).rejects.toBeInstanceOf(DuplicatePendingRegistrationError);

    const after = await harness.ownerPool.query<{ count: number }>(
      "select count(*)::int as count from organizations",
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });

  it("approves organization and owner membership once and writes one audit event", async () => {
    const request = await harness.ownerPool.query<{ id: string }>(
      "select id from registration_requests where user_id = $1",
      [users.applicant.userId],
    );
    const requestId = request.rows[0]!.id;

    await expect(
      approveRegistrationRequest({
        actor: { userId: users.applicant.userId },
        database: harness.runtimeDatabase,
        requestId,
      }),
    ).rejects.toBeInstanceOf(PlatformAdminRequiredError);

    const first = await approveRegistrationRequest({
      actor: { userId: users.admin.userId },
      database: harness.runtimeDatabase,
      requestId,
    });
    const repeated = await approveRegistrationRequest({
      actor: { userId: users.admin.userId },
      database: harness.runtimeDatabase,
      requestId,
    });

    expect(first).toEqual({ changed: true });
    expect(repeated).toEqual({ changed: false });

    const state = await harness.ownerPool.query<{
      membership_status: string;
      organization_status: string;
      request_status: string;
    }>(
      `select
         organization_record.status as organization_status,
         request_record.status as request_status,
         membership_record.status as membership_status
       from registration_requests request_record
       join organizations organization_record
         on organization_record.id = request_record.organization_id
       join memberships membership_record
         on membership_record.organization_id = organization_record.id
        and membership_record.user_id = request_record.user_id
       where request_record.id = $1`,
      [requestId],
    );
    const audit = await harness.ownerPool.query<{ count: number }>(
      `select count(*)::int as count
       from audit_events
       where action = 'ORGANIZATION_REGISTRATION_APPROVED'
         and object_id = $1`,
      [requestId],
    );

    expect(state.rows[0]).toEqual({
      membership_status: "ACTIVE",
      organization_status: "ACTIVE",
      request_status: "APPROVED",
    });
    expect(audit.rows[0]?.count).toBe(1);
  });

  it("rejects a pending request with a documented reason", async () => {
    const registration = await submitStoreRegistration({
      actor: users.rejectedApplicant,
      database: harness.runtimeDatabase,
      input: registrationInput("Eicken"),
    });

    await rejectRegistrationRequest({
      actor: { userId: users.admin.userId },
      database: harness.runtimeDatabase,
      reason: "Kontaktdaten im Pilotgespräch nicht bestätigt.",
      requestId: registration.requestId,
    });

    const state = await harness.ownerPool.query<{
      membership_status: string;
      organization_status: string;
      request_status: string;
      review_note: string | null;
    }>(
      `select
         organization_record.status as organization_status,
         request_record.status as request_status,
         request_record.review_note,
         membership_record.status as membership_status
       from registration_requests request_record
       join organizations organization_record
         on organization_record.id = request_record.organization_id
       join memberships membership_record
         on membership_record.organization_id = organization_record.id
        and membership_record.user_id = request_record.user_id
       where request_record.id = $1`,
      [registration.requestId],
    );
    const audit = await harness.ownerPool.query<{ reason: string | null }>(
      `select reason from audit_events
       where action = 'ORGANIZATION_REGISTRATION_REJECTED'
         and object_id = $1`,
      [registration.requestId],
    );

    expect(state.rows[0]).toMatchObject({
      membership_status: "REMOVED",
      organization_status: "REJECTED",
      request_status: "REJECTED",
      review_note: "Kontaktdaten im Pilotgespräch nicht bestätigt.",
    });
    expect(audit.rows).toEqual([
      { reason: "Kontaktdaten im Pilotgespräch nicht bestätigt." },
    ]);
  });

  it("suspends an approved organization and every active membership atomically", async () => {
    const request = await harness.ownerPool.query<{
      id: string;
      organization_id: string;
    }>(
      `select id, organization_id
       from registration_requests
       where user_id = $1`,
      [users.applicant.userId],
    );
    const registration = request.rows[0]!;

    const first = await suspendOrganization({
      actor: { userId: users.admin.userId },
      database: harness.runtimeDatabase,
      organizationId: registration.organization_id,
      reason: "Pilotzugang bis zur Klärung pausiert.",
    });
    const repeated = await suspendOrganization({
      actor: { userId: users.admin.userId },
      database: harness.runtimeDatabase,
      organizationId: registration.organization_id,
      reason: "Pilotzugang bis zur Klärung pausiert.",
    });

    expect(first).toEqual({ changed: true });
    expect(repeated).toEqual({ changed: false });

    const organization = await harness.ownerPool.query<{ status: string }>(
      "select status from organizations where id = $1",
      [registration.organization_id],
    );
    const memberships = await harness.ownerPool.query<{ status: string }>(
      "select status from memberships where organization_id = $1",
      [registration.organization_id],
    );
    const audit = await harness.ownerPool.query<{ count: number }>(
      `select count(*)::int as count from audit_events
       where action = 'ORGANIZATION_SUSPENDED'
         and object_id = $1`,
      [registration.organization_id],
    );

    expect(organization.rows).toEqual([{ status: "SUSPENDED" }]);
    expect(memberships.rows).toEqual([{ status: "SUSPENDED" }]);
    expect(audit.rows[0]?.count).toBe(1);
  });
});
