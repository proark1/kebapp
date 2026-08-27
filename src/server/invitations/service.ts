import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getRuntimeEnv } from "@/lib/env";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import {
  invitations,
  memberships,
  organizations,
  user,
} from "@/server/db/schema";
import {
  type TenantTransaction,
  withTenantContext,
} from "@/server/db/tenant-context";
import { createMailer } from "@/server/email/mailer";
import {
  employeeInvitationEmail,
  type AuthEmail,
} from "@/server/email/templates";
import {
  createInvitationToken,
  hashInvitationToken,
  isInvitationToken,
} from "@/server/invitations/tokens";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Bitte eine gültige E-Mail-Adresse angeben.")
  .max(320);
const idSchema = z.uuid();
const expiresInHoursSchema = z.number().positive().max(24 * 30);

export type InvitationActor = {
  email: string;
  emailVerified: boolean;
  name: string;
  userId: string;
};

export class InvitationPermissionDeniedError extends Error {
  constructor() {
    super("Nur Inhaber:innen dürfen das Team verwalten.");
    this.name = "InvitationPermissionDeniedError";
  }
}

export class InvitationAlreadyPendingError extends Error {
  constructor() {
    super("Für diese E-Mail-Adresse besteht bereits eine offene Einladung.");
    this.name = "InvitationAlreadyPendingError";
  }
}

export class ExistingMembershipError extends Error {
  constructor() {
    super("Diese Person gehört bereits zum Laden.");
    this.name = "ExistingMembershipError";
  }
}

export class InvitationUnavailableError extends Error {
  constructor() {
    super("Diese Einladung ist nicht verfügbar.");
    this.name = "InvitationUnavailableError";
  }
}

export class InvitationExpiredError extends Error {
  constructor() {
    super("Diese Einladung ist abgelaufen.");
    this.name = "InvitationExpiredError";
  }
}

export class InvitationAlreadyUsedError extends Error {
  constructor() {
    super("Diese Einladung wurde bereits verwendet.");
    this.name = "InvitationAlreadyUsedError";
  }
}

async function assertOwner(
  transaction: TenantTransaction,
  actorUserId: string,
  organizationId: string,
) {
  const [owner] = await transaction
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, actorUserId),
        eq(memberships.organizationId, organizationId),
        eq(memberships.role, "OWNER"),
        eq(memberships.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!owner) {
    throw new InvitationPermissionDeniedError();
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function sendInvitationEmail(message: AuthEmail): Promise<void> {
  const env = getRuntimeEnv();
  if (!env.SMTP_FROM || !env.SMTP_HOST || !env.SMTP_PORT) {
    throw new Error("SMTP ist in dieser Umgebung nicht konfiguriert.");
  }
  const mailer = createMailer({
    from: env.SMTP_FROM,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    requireTls: env.SMTP_REQUIRE_TLS,
  });

  try {
    await mailer.send(message);
  } finally {
    mailer.close();
  }
}

export async function createEmployeeInvitation(input: {
  actor: InvitationActor;
  appBaseUrl?: string;
  database?: KebappDatabase;
  email: string;
  expiresInHours?: number;
  now?: Date;
  organizationId: string;
  sendEmail?: (message: AuthEmail) => Promise<void>;
}): Promise<{ invitationId: string }> {
  const organizationId = idSchema.parse(input.organizationId);
  const email = emailSchema.parse(input.email);
  const expiresInHours = expiresInHoursSchema.parse(
    input.expiresInHours ?? 72,
  );
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1_000);
  const rawToken = createInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);
  const invitationId = randomUUID();

  try {
    const invitation = await withTenantContext(
      {
        actor: input.actor,
        database: input.database,
        organizationId,
      },
      async (transaction) => {
        await assertOwner(
          transaction,
          input.actor.userId,
          organizationId,
        );

        await transaction
          .update(invitations)
          .set({ status: "EXPIRED" })
          .where(
            and(
              eq(invitations.organizationId, organizationId),
              eq(invitations.email, email),
              eq(invitations.status, "PENDING"),
              lte(invitations.expiresAt, now),
            ),
          );

        const [existingUser] = await transaction
          .select({ id: user.id })
          .from(user)
          .where(sql`lower(${user.email}) = ${email}`)
          .limit(1);

        if (existingUser) {
          const [membership] = await transaction
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                eq(memberships.organizationId, organizationId),
                eq(memberships.userId, existingUser.id),
              ),
            )
            .limit(1);
          if (membership) {
            throw new ExistingMembershipError();
          }
        }

        const [organization] = await transaction
          .select({ storeName: organizations.storeName })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);
        if (!organization) {
          throw new InvitationPermissionDeniedError();
        }

        await transaction.insert(invitations).values({
          email,
          expiresAt,
          id: invitationId,
          invitedByUserId: input.actor.userId,
          organizationId,
          role: "EMPLOYEE",
          status: "PENDING",
          tokenHash,
        });
        await writeAuditEvent(transaction, {
          action: "EMPLOYEE_INVITATION_CREATED",
          actorUserId: input.actor.userId,
          metadata: { email, status: "PENDING" },
          objectId: invitationId,
          objectType: "invitation",
          organizationId,
        });

        return { storeName: organization.storeName };
      },
    );

    const baseUrl = new URL(
      input.appBaseUrl ?? getRuntimeEnv().BETTER_AUTH_URL,
    );
    const url = new URL(`/einladung/${rawToken}`, baseUrl).toString();
    const message = employeeInvitationEmail({
      expiresAt,
      inviterName: input.actor.name,
      storeName: invitation.storeName,
      to: email,
      url,
    });
    await (input.sendEmail ?? sendInvitationEmail)(message);

    return { invitationId };
  } catch (error) {
    if (error instanceof ExistingMembershipError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new InvitationAlreadyPendingError();
    }
    throw error;
  }
}

export async function revokeEmployeeInvitation(input: {
  actor: InvitationActor;
  database?: KebappDatabase;
  invitationId: string;
  now?: Date;
  organizationId: string;
}): Promise<{ changed: boolean }> {
  const invitationId = idSchema.parse(input.invitationId);
  const organizationId = idSchema.parse(input.organizationId);
  const now = input.now ?? new Date();

  return withTenantContext(
    {
      actor: input.actor,
      database: input.database,
      organizationId,
    },
    async (transaction) => {
      await assertOwner(transaction, input.actor.userId, organizationId);

      const [revoked] = await transaction
        .update(invitations)
        .set({
          revokedAt: now,
          revokedByUserId: input.actor.userId,
          status: "REVOKED",
        })
        .where(
          and(
            eq(invitations.id, invitationId),
            eq(invitations.organizationId, organizationId),
            eq(invitations.status, "PENDING"),
          ),
        )
        .returning({ email: invitations.email });

      if (!revoked) {
        return { changed: false };
      }

      await writeAuditEvent(transaction, {
        action: "EMPLOYEE_INVITATION_REVOKED",
        actorUserId: input.actor.userId,
        metadata: { email: revoked.email, status: "REVOKED" },
        objectId: invitationId,
        objectType: "invitation",
        organizationId,
      });
      return { changed: true };
    },
  );
}

type AcceptanceResult =
  | { kind: "ACCEPTED"; organizationId: string }
  | { kind: "ALREADY_USED" }
  | { kind: "EXPIRED" }
  | { kind: "EXISTING_MEMBERSHIP" }
  | { kind: "UNAVAILABLE" };

export async function acceptEmployeeInvitation(input: {
  actor: InvitationActor;
  database?: KebappDatabase;
  now?: Date;
  token: string;
}): Promise<{ organizationId: string }> {
  if (!input.actor.emailVerified || !isInvitationToken(input.token)) {
    throw new InvitationUnavailableError();
  }

  const database =
    input.database ?? (await import("@/server/db/client")).database;
  const now = input.now ?? new Date();
  const tokenHash = hashInvitationToken(input.token);

  let result: AcceptanceResult;
  try {
    result = await database.transaction(async (transaction) => {
      await transaction.execute(sql`
        select
          set_config('kebapp.user_id', ${input.actor.userId}, true),
          set_config('kebapp.organization_id', '', true),
          set_config('kebapp.invitation_token_hash', ${tokenHash}, true)
      `);

      const [invitation] = await transaction
        .select({
          acceptedByUserId: invitations.acceptedByUserId,
          email: invitations.email,
          expiresAt: invitations.expiresAt,
          id: invitations.id,
          invitedByUserId: invitations.invitedByUserId,
          organizationId: invitations.organizationId,
          role: invitations.role,
          status: invitations.status,
        })
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1);

      if (!invitation) {
        return { kind: "UNAVAILABLE" };
      }
      if (
        emailSchema.parse(input.actor.email) !== invitation.email ||
        invitation.role !== "EMPLOYEE"
      ) {
        return { kind: "UNAVAILABLE" };
      }
      if (invitation.status === "ACCEPTED") {
        return { kind: "ALREADY_USED" };
      }
      if (invitation.status !== "PENDING") {
        return { kind: "UNAVAILABLE" };
      }
      if (invitation.expiresAt.getTime() <= now.getTime()) {
        await transaction
          .update(invitations)
          .set({ status: "EXPIRED" })
          .where(
            and(
              eq(invitations.id, invitation.id),
              eq(invitations.status, "PENDING"),
            ),
          );
        return { kind: "EXPIRED" };
      }

      await transaction.execute(sql`
        select set_config(
          'kebapp.organization_id',
          ${invitation.organizationId},
          true
        )
      `);

      const [existingMembership] = await transaction
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, invitation.organizationId),
            eq(memberships.userId, input.actor.userId),
          ),
        )
        .limit(1);
      if (existingMembership) {
        return { kind: "EXISTING_MEMBERSHIP" };
      }

      await transaction.insert(memberships).values({
        invitedByUserId: invitation.invitedByUserId,
        joinedAt: now,
        organizationId: invitation.organizationId,
        role: "EMPLOYEE",
        status: "ACTIVE",
        userId: input.actor.userId,
      });
      const [accepted] = await transaction
        .update(invitations)
        .set({
          acceptedAt: now,
          acceptedByUserId: input.actor.userId,
          status: "ACCEPTED",
        })
        .where(
          and(
            eq(invitations.id, invitation.id),
            eq(invitations.status, "PENDING"),
          ),
        )
        .returning({ id: invitations.id });

      if (!accepted) {
        return { kind: "ALREADY_USED" };
      }

      await writeAuditEvent(transaction, {
        action: "EMPLOYEE_INVITATION_ACCEPTED",
        actorUserId: input.actor.userId,
        metadata: { email: invitation.email, status: "ACCEPTED" },
        objectId: invitation.id,
        objectType: "invitation",
        organizationId: invitation.organizationId,
      });

      return {
        kind: "ACCEPTED",
        organizationId: invitation.organizationId,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new InvitationAlreadyUsedError();
    }
    throw error;
  }

  if (result.kind === "ACCEPTED") {
    return { organizationId: result.organizationId };
  }
  if (result.kind === "ALREADY_USED") {
    throw new InvitationAlreadyUsedError();
  }
  if (result.kind === "EXPIRED") {
    throw new InvitationExpiredError();
  }
  if (result.kind === "EXISTING_MEMBERSHIP") {
    throw new ExistingMembershipError();
  }
  throw new InvitationUnavailableError();
}

export async function getInvitationForRecipient(input: {
  actor: InvitationActor;
  database?: KebappDatabase;
  token: string;
}): Promise<{
  email: string;
  expired: boolean;
  expiresAt: Date;
  status: "ACCEPTED" | "EXPIRED" | "PENDING" | "REVOKED";
} | null> {
  if (!input.actor.emailVerified || !isInvitationToken(input.token)) {
    return null;
  }
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      select
        set_config('kebapp.user_id', ${input.actor.userId}, true),
        set_config('kebapp.organization_id', '', true)
    `);
    const [invitation] = await transaction
      .select({
        email: invitations.email,
        expiresAt: invitations.expiresAt,
        status: invitations.status,
      })
      .from(invitations)
      .where(eq(invitations.tokenHash, hashInvitationToken(input.token)))
      .limit(1);

    return invitation
      ? { ...invitation, expired: invitation.expiresAt.getTime() <= Date.now() }
      : null;
  });
}

export async function listOrganizationTeam(input: {
  actor: InvitationActor;
  database?: KebappDatabase;
  now?: Date;
  organizationId: string;
}) {
  const organizationId = idSchema.parse(input.organizationId);
  const now = input.now ?? new Date();

  return withTenantContext(
    {
      actor: input.actor,
      database: input.database,
      organizationId,
    },
    async (transaction) => {
      await assertOwner(transaction, input.actor.userId, organizationId);
      await transaction
        .update(invitations)
        .set({ status: "EXPIRED" })
        .where(
          and(
            eq(invitations.organizationId, organizationId),
            eq(invitations.status, "PENDING"),
            lte(invitations.expiresAt, now),
          ),
        );

      const memberRows = await transaction
        .select({
          email: user.email,
          joinedAt: memberships.joinedAt,
          name: user.name,
          role: memberships.role,
          status: memberships.status,
          userId: memberships.userId,
        })
        .from(memberships)
        .innerJoin(user, eq(user.id, memberships.userId))
        .where(
          and(
            eq(memberships.organizationId, organizationId),
            eq(memberships.status, "ACTIVE"),
          ),
        )
        .orderBy(asc(user.name));
      const invitationRows = await transaction
        .select({
          email: invitations.email,
          expiresAt: invitations.expiresAt,
          id: invitations.id,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, organizationId),
            eq(invitations.status, "PENDING"),
          ),
        )
        .orderBy(asc(invitations.createdAt));

      return { invitations: invitationRows, members: memberRows };
    },
  );
}
