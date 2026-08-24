import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { memberships } from "@/server/db/schema";
import type { AuthEmail } from "@/server/email/templates";
import {
  acceptEmployeeInvitation,
  createEmployeeInvitation,
  ExistingMembershipError,
  InvitationAlreadyUsedError,
  InvitationExpiredError,
  InvitationPermissionDeniedError,
  InvitationUnavailableError,
  listOrganizationTeam,
  revokeEmployeeInvitation,
} from "@/server/invitations/service";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const users = {
  employee: {
    email: "employee@invitations.test",
    emailVerified: true as const,
    name: "Emre Mitarbeiter",
    userId: "invitation-employee",
  },
  existingMember: {
    email: "existing@invitations.test",
    emailVerified: true as const,
    name: "Eda Mitglied",
    userId: "invitation-existing",
  },
  expiredRecipient: {
    email: "expired@invitations.test",
    emailVerified: true as const,
    name: "Erkan Abgelaufen",
    userId: "invitation-expired",
  },
  invitee: {
    email: "invitee@invitations.test",
    emailVerified: true as const,
    name: "Ipek Eingeladen",
    userId: "invitation-invitee",
  },
  owner: {
    email: "owner@invitations.test",
    emailVerified: true as const,
    name: "Okan Inhaber",
    userId: "invitation-owner",
  },
  revokedRecipient: {
    email: "revoked@invitations.test",
    emailVerified: true as const,
    name: "Rana Widerrufen",
    userId: "invitation-revoked",
  },
  wrongRecipient: {
    email: "wrong@invitations.test",
    emailVerified: true as const,
    name: "Wera Falsch",
    userId: "invitation-wrong",
  },
};

function tokenFromEmail(message: AuthEmail): string {
  const match = message.text.match(/\/einladung\/([A-Za-z0-9_-]+)/);
  if (!match?.[1]) {
    throw new Error("Einladungstoken fehlt in der Test-E-Mail.");
  }
  return match[1];
}

describe.sequential("employee invitations", () => {
  let harness: TestDatabaseHarness;
  let inviteeToken: string;
  let organizationId: string;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    const allUsers = Object.values(users);
    for (const actor of allUsers) {
      await harness.ownerPool.query(
        `insert into "user" (id, name, email, email_verified)
         values ($1, $2, $3, $4)`,
        [actor.userId, actor.name, actor.email, actor.emailVerified],
      );
    }

    const organization = await harness.ownerPool.query<{ id: string }>(
      `insert into organizations (slug, store_name, status)
       values ('invitation-test', 'Einladungsgrill', 'ACTIVE')
       returning id`,
    );
    organizationId = organization.rows[0]!.id;

    await harness.ownerPool.query(
      `insert into memberships
         (user_id, organization_id, role, status, joined_at)
       values
         ($1, $3, 'OWNER', 'ACTIVE', now()),
         ($2, $3, 'EMPLOYEE', 'ACTIVE', now())`,
      [users.owner.userId, users.employee.userId, organizationId],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("lets an owner invite only an employee and stores no raw token", async () => {
    let sentEmail: AuthEmail | undefined;
    const now = new Date("2026-08-21T10:00:00.000Z");

    const result = await createEmployeeInvitation({
      actor: users.owner,
      appBaseUrl: "https://kebapp.test",
      database: harness.runtimeDatabase,
      email: users.invitee.email.toUpperCase(),
      now,
      organizationId,
      sendEmail: async (message) => {
        sentEmail = message;
      },
    });

    expect(sentEmail).toBeDefined();
    const token = tokenFromEmail(sentEmail!);
    inviteeToken = token;
    const persisted = await harness.ownerPool.query<{
      email: string;
      expires_at: Date;
      role: string;
      token_hash: string;
    }>(
      `select email, expires_at, role, token_hash
       from invitations where id = $1`,
      [result.invitationId],
    );
    const audit = await harness.ownerPool.query<{
      metadata: Record<string, unknown>;
    }>(
      `select metadata from audit_events
       where action = 'EMPLOYEE_INVITATION_CREATED' and object_id = $1`,
      [result.invitationId],
    );

    expect(persisted.rows[0]).toMatchObject({
      email: users.invitee.email,
      role: "EMPLOYEE",
    });
    expect(persisted.rows[0]!.expires_at.toISOString()).toBe(
      "2026-08-24T10:00:00.000Z",
    );
    expect(persisted.rows[0]!.token_hash).not.toContain(token);
    expect(persisted.rows[0]!.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(audit.rows)).not.toContain(token);
  });

  it("rejects invitation creation by an employee", async () => {
    await expect(
      createEmployeeInvitation({
        actor: users.employee,
        appBaseUrl: "https://kebapp.test",
        database: harness.runtimeDatabase,
        email: "blocked@invitations.test",
        organizationId,
        sendEmail: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(InvitationPermissionDeniedError);
  });

  it("binds acceptance to the same verified email", async () => {
    await expect(
      acceptEmployeeInvitation({
        actor: users.wrongRecipient,
        database: harness.runtimeDatabase,
        token: inviteeToken,
      }),
    ).rejects.toBeInstanceOf(InvitationUnavailableError);

    const membership = await harness.ownerPool.query<{ count: number }>(
      `select count(*)::int as count from memberships
       where user_id = $1 and organization_id = $2`,
      [users.wrongRecipient.userId, organizationId],
    );
    expect(membership.rows[0]?.count).toBe(0);
  });

  it("does not let a recipient bypass the one-time token at RLS level", async () => {
    await expect(
      harness.runtimeDatabase.transaction(async (transaction) => {
        await transaction.execute(sql`
          select
            set_config('kebapp.user_id', ${users.invitee.userId}, true),
            set_config('kebapp.organization_id', ${organizationId}, true),
            set_config('kebapp.invitation_token_hash', '', true)
        `);
        await transaction.insert(memberships).values({
          invitedByUserId: users.owner.userId,
          joinedAt: new Date(),
          organizationId,
          role: "EMPLOYEE",
          status: "ACTIVE",
          userId: users.invitee.userId,
        });
      }),
    ).rejects.toMatchObject({ cause: { code: "42501" } });
  });

  it("expires invitations after the configured period", async () => {
    let sentEmail: AuthEmail | undefined;
    const createdAt = new Date("2026-08-21T12:00:00.000Z");
    await createEmployeeInvitation({
      actor: users.owner,
      appBaseUrl: "https://kebapp.test",
      database: harness.runtimeDatabase,
      email: users.expiredRecipient.email,
      expiresInHours: 1,
      now: createdAt,
      organizationId,
      sendEmail: async (message) => {
        sentEmail = message;
      },
    });

    await expect(
      acceptEmployeeInvitation({
        actor: users.expiredRecipient,
        database: harness.runtimeDatabase,
        now: new Date("2026-08-21T13:00:00.001Z"),
        token: tokenFromEmail(sentEmail!),
      }),
    ).rejects.toBeInstanceOf(InvitationExpiredError);

    const invitation = await harness.ownerPool.query<{ status: string }>(
      "select status from invitations where email = $1",
      [users.expiredRecipient.email],
    );
    expect(invitation.rows[0]?.status).toBe("EXPIRED");
  });

  it("prevents acceptance after an owner revokes the invitation", async () => {
    let sentEmail: AuthEmail | undefined;
    const invitation = await createEmployeeInvitation({
      actor: users.owner,
      appBaseUrl: "https://kebapp.test",
      database: harness.runtimeDatabase,
      email: users.revokedRecipient.email,
      organizationId,
      sendEmail: async (message) => {
        sentEmail = message;
      },
    });

    await revokeEmployeeInvitation({
      actor: users.owner,
      database: harness.runtimeDatabase,
      invitationId: invitation.invitationId,
      organizationId,
    });

    await expect(
      acceptEmployeeInvitation({
        actor: users.revokedRecipient,
        database: harness.runtimeDatabase,
        token: tokenFromEmail(sentEmail!),
      }),
    ).rejects.toBeInstanceOf(InvitationUnavailableError);
  });

  it("accepts once atomically and never creates a second membership", async () => {
    let sentEmail: AuthEmail | undefined;
    const invitation = await createEmployeeInvitation({
      actor: users.owner,
      appBaseUrl: "https://kebapp.test",
      database: harness.runtimeDatabase,
      email: "  " + users.existingMember.email + "  ",
      organizationId,
      sendEmail: async (message) => {
        sentEmail = message;
      },
    });
    const token = tokenFromEmail(sentEmail!);

    const accepted = await acceptEmployeeInvitation({
      actor: users.existingMember,
      database: harness.runtimeDatabase,
      token,
    });
    expect(accepted).toEqual({ organizationId });

    await expect(
      acceptEmployeeInvitation({
        actor: users.existingMember,
        database: harness.runtimeDatabase,
        token,
      }),
    ).rejects.toBeInstanceOf(InvitationAlreadyUsedError);

    const membership = await harness.ownerPool.query<{ count: number }>(
      `select count(*)::int as count from memberships
       where user_id = $1 and organization_id = $2`,
      [users.existingMember.userId, organizationId],
    );
    const invitationState = await harness.ownerPool.query<{
      accepted_by_user_id: string;
      status: string;
    }>(
      "select accepted_by_user_id, status from invitations where id = $1",
      [invitation.invitationId],
    );
    expect(membership.rows[0]?.count).toBe(1);
    expect(invitationState.rows[0]).toEqual({
      accepted_by_user_id: users.existingMember.userId,
      status: "ACCEPTED",
    });
  });

  it("does not invite an email that already belongs to the organization", async () => {
    await expect(
      createEmployeeInvitation({
        actor: users.owner,
        appBaseUrl: "https://kebapp.test",
        database: harness.runtimeDatabase,
        email: users.employee.email,
        organizationId,
        sendEmail: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(ExistingMembershipError);
  });

  it("lists only active members and pending invitations of the selected store", async () => {
    const team = await listOrganizationTeam({
      actor: users.owner,
      database: harness.runtimeDatabase,
      // Fixierte Testzeit: Der Listen-Aufruf laesst sonst die in Test 1
      // erzeugte 72h-Einladung am 24.08.2026 real ablaufen.
      now: new Date("2026-08-22T10:00:00.000Z"),
      organizationId,
    });

    expect(team.members.map((member) => member.email).sort()).toEqual(
      [
        users.employee.email,
        users.existingMember.email,
        users.owner.email,
      ].sort(),
    );
    expect(team.members.map((member) => member.email)).not.toContain(
      users.wrongRecipient.email,
    );
    expect(team.invitations.map((invitation) => invitation.email)).toEqual([
      users.invitee.email,
    ]);
  });
});
