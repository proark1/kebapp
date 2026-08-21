import "server-only";

import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import {
  memberships,
  organizations,
  platformRoles,
  supportAssignments,
  user,
} from "@/server/db/schema";
import type { TenantTransaction } from "@/server/db/tenant-context";
import { withTenantContext } from "@/server/db/tenant-context";

const idSchema = z.uuid();
const purposeSchema = z.string().trim().min(10).max(600);
const reasonSchema = z.string().trim().min(10).max(600);

type SupportActor = { userId: string };

export class PlatformSupportRequiredError extends Error {
  constructor() {
    super("Für diesen Bereich ist eine Support-Berechtigung erforderlich.");
    this.name = "PlatformSupportRequiredError";
  }
}

export class SupportAssignmentNotFoundError extends Error {
  constructor() {
    super("Der Supporteinsatz wurde nicht gefunden oder ist bereits beendet.");
    this.name = "SupportAssignmentNotFoundError";
  }
}

export class SupportAssignmentConflictError extends Error {
  constructor() {
    super("Für diese Person und diesen Laden besteht bereits ein Supporteinsatz.");
    this.name = "SupportAssignmentConflictError";
  }
}

export class SupportReasonRequiredError extends Error {
  constructor() {
    super("Support-Änderungen benötigen eine Begründung mit mindestens 10 Zeichen.");
    this.name = "SupportReasonRequiredError";
  }
}

export class SupportOperationDeniedError extends Error {
  constructor() {
    super("Dieser Vorgang ist für den Support nicht freigegeben.");
    this.name = "SupportOperationDeniedError";
  }
}

async function setActorContext(
  transaction: TenantTransaction,
  actor: SupportActor,
  organizationId = "",
) {
  await transaction.execute(sql`
    select
      set_config('kebapp.user_id', ${actor.userId}, true),
      set_config('kebapp.organization_id', ${organizationId}, true)
  `);
}

async function requirePlatformRole(
  transaction: TenantTransaction,
  actor: SupportActor,
  role: "ADMIN" | "SUPPORT",
) {
  const [roleRecord] = await transaction
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(
      and(
        eq(platformRoles.userId, actor.userId),
        eq(platformRoles.role, role),
      ),
    )
    .limit(1);

  if (!roleRecord) {
    if (role === "SUPPORT") {
      throw new PlatformSupportRequiredError();
    }
    const { PlatformAdminRequiredError } = await import(
      "@/server/organizations/admin"
    );
    throw new PlatformAdminRequiredError();
  }
}

function getDatabase(database?: KebappDatabase) {
  return (
    database ?? import("@/server/db/client").then((module) => module.database)
  );
}

export async function assertPlatformSupport(input: {
  actor: SupportActor;
  database?: KebappDatabase;
}): Promise<void> {
  const database = await getDatabase(input.database);
  await database.transaction(async (transaction) => {
    await setActorContext(transaction, input.actor);
    await requirePlatformRole(transaction, input.actor, "SUPPORT");
  });
}

export type AssignedSupportOrganization = {
  assignmentId: string;
  expiresAt: string | null;
  organizationId: string;
  publicSlug: string;
  purpose: string | null;
  storeName: string;
};

export async function listAssignedSupportOrganizations(input: {
  actor: SupportActor;
  database?: KebappDatabase;
}): Promise<AssignedSupportOrganization[]> {
  const database = await getDatabase(input.database);

  return database.transaction(async (transaction) => {
    await setActorContext(transaction, input.actor);
    await requirePlatformRole(transaction, input.actor, "SUPPORT");

    const rows = await transaction
      .select({
        assignmentId: supportAssignments.id,
        expiresAt: supportAssignments.expiresAt,
        organizationId: organizations.id,
        publicSlug: organizations.slug,
        purpose: supportAssignments.purpose,
        storeName: organizations.storeName,
      })
      .from(supportAssignments)
      .innerJoin(
        organizations,
        eq(organizations.id, supportAssignments.organizationId),
      )
      .where(
        and(
          eq(supportAssignments.supportUserId, input.actor.userId),
          eq(supportAssignments.status, "ACTIVE"),
          eq(organizations.status, "ACTIVE"),
          or(
            isNull(supportAssignments.expiresAt),
            gt(supportAssignments.expiresAt, new Date()),
          ),
        ),
      )
      .orderBy(asc(organizations.storeName));

    return rows.map((row) => ({
      ...row,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    }));
  });
}

export type SupportAdministration = {
  assignments: Array<{
    assignmentId: string;
    expiresAt: string | null;
    isLive: boolean;
    organizationId: string;
    purpose: string | null;
    status: "ACTIVE" | "ENDED";
    storeName: string;
    supportName: string;
    supportUserId: string;
  }>;
  organizations: Array<{
    organizationId: string;
    status: "ACTIVE" | "PENDING" | "REJECTED" | "SUSPENDED";
    storeName: string;
  }>;
  supportUsers: Array<{ email: string; name: string; userId: string }>;
};

export async function listSupportAdministration(input: {
  actor: SupportActor;
  database?: KebappDatabase;
}): Promise<SupportAdministration> {
  const database = await getDatabase(input.database);

  return database.transaction(async (transaction) => {
    await setActorContext(transaction, input.actor);
    await requirePlatformRole(transaction, input.actor, "ADMIN");

    const organizationRows = await transaction
      .select({
        organizationId: organizations.id,
        status: organizations.status,
        storeName: organizations.storeName,
      })
      .from(organizations)
      .orderBy(asc(organizations.storeName));
    const supportUsers = await transaction
      .select({ email: user.email, name: user.name, userId: user.id })
      .from(platformRoles)
      .innerJoin(user, eq(user.id, platformRoles.userId))
      .where(eq(platformRoles.role, "SUPPORT"))
      .orderBy(asc(user.name));

    const assignments: SupportAdministration["assignments"] = [];
    for (const organization of organizationRows) {
      await setActorContext(transaction, input.actor, organization.organizationId);
      const rows = await transaction
        .select({
          assignmentId: supportAssignments.id,
          expiresAt: supportAssignments.expiresAt,
          isLive: sql<boolean>`${supportAssignments.status} = 'ACTIVE' and (${supportAssignments.expiresAt} is null or ${supportAssignments.expiresAt} > now())`,
          organizationId: supportAssignments.organizationId,
          purpose: supportAssignments.purpose,
          status: supportAssignments.status,
          supportName: user.name,
          supportUserId: supportAssignments.supportUserId,
        })
        .from(supportAssignments)
        .innerJoin(user, eq(user.id, supportAssignments.supportUserId))
        .where(eq(supportAssignments.organizationId, organization.organizationId))
        .orderBy(desc(supportAssignments.createdAt));
      assignments.push(
        ...rows.map((row) => ({
          ...row,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          storeName: organization.storeName,
        })),
      );
    }

    return { assignments, organizations: organizationRows, supportUsers };
  });
}

export async function assignSupport(input: {
  actor: SupportActor;
  database?: KebappDatabase;
  expiresAt?: Date | null;
  organizationId: string;
  purpose: string;
  supportUserId: string;
}): Promise<{ assignmentId: string }> {
  const organizationId = idSchema.parse(input.organizationId);
  const supportUserId = z.string().min(1).max(255).parse(input.supportUserId);
  const purpose = purposeSchema.parse(input.purpose);
  const expiresAt = input.expiresAt ?? null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new SupportAssignmentConflictError();
  }
  const database = await getDatabase(input.database);

  return database.transaction(async (transaction) => {
    await setActorContext(transaction, input.actor);
    await requirePlatformRole(transaction, input.actor, "ADMIN");
    await setActorContext(transaction, input.actor, organizationId);

    const [organization] = await transaction
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(eq(organizations.id, organizationId), eq(organizations.status, "ACTIVE")),
      )
      .limit(1);
    const [supportRole] = await transaction
      .select({ id: platformRoles.id })
      .from(platformRoles)
      .where(
        and(
          eq(platformRoles.userId, supportUserId),
          eq(platformRoles.role, "SUPPORT"),
        ),
      )
      .limit(1);
    if (!organization || !supportRole) {
      throw new SupportAssignmentNotFoundError();
    }

    const now = new Date();
    await transaction
      .update(supportAssignments)
      .set({ endedAt: now, status: "ENDED" })
      .where(
        and(
          eq(supportAssignments.organizationId, organizationId),
          eq(supportAssignments.supportUserId, supportUserId),
          eq(supportAssignments.status, "ACTIVE"),
          sql`${supportAssignments.expiresAt} is not null and ${supportAssignments.expiresAt} <= ${now}`,
        ),
      );

    const [active] = await transaction
      .select({ id: supportAssignments.id })
      .from(supportAssignments)
      .where(
        and(
          eq(supportAssignments.organizationId, organizationId),
          eq(supportAssignments.supportUserId, supportUserId),
          eq(supportAssignments.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (active) {
      throw new SupportAssignmentConflictError();
    }

    const [created] = await transaction
      .insert(supportAssignments)
      .values({
        assignedByUserId: input.actor.userId,
        expiresAt,
        organizationId,
        purpose,
        supportUserId,
      })
      .returning({ id: supportAssignments.id });
    await writeAuditEvent(transaction, {
      action: "SUPPORT_ASSIGNED",
      actorUserId: input.actor.userId,
      metadata: {
        expiresAt: expiresAt?.toISOString() ?? null,
        supportUserId,
      },
      objectId: created!.id,
      objectType: "support_assignment",
      organizationId,
      reason: purpose,
    });

    return { assignmentId: created!.id };
  });
}

export async function endSupportAssignment(input: {
  actor: SupportActor;
  assignmentId: string;
  database?: KebappDatabase;
  organizationId: string;
  reason: string;
}): Promise<{ changed: boolean }> {
  const assignmentId = idSchema.parse(input.assignmentId);
  const organizationId = idSchema.parse(input.organizationId);
  const reason = reasonSchema.parse(input.reason);
  const database = await getDatabase(input.database);

  return database.transaction(async (transaction) => {
    await setActorContext(transaction, input.actor);
    await requirePlatformRole(transaction, input.actor, "ADMIN");
    await setActorContext(transaction, input.actor, organizationId);

    const [assignment] = await transaction
      .select({
        status: supportAssignments.status,
        supportUserId: supportAssignments.supportUserId,
      })
      .from(supportAssignments)
      .where(
        and(
          eq(supportAssignments.id, assignmentId),
          eq(supportAssignments.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!assignment) {
      throw new SupportAssignmentNotFoundError();
    }
    if (assignment.status === "ENDED") {
      return { changed: false };
    }

    await transaction
      .update(supportAssignments)
      .set({ endedAt: new Date(), status: "ENDED" })
      .where(
        and(
          eq(supportAssignments.id, assignmentId),
          eq(supportAssignments.status, "ACTIVE"),
        ),
      );
    await writeAuditEvent(transaction, {
      action: "SUPPORT_ASSIGNMENT_ENDED",
      actorUserId: input.actor.userId,
      metadata: { supportUserId: assignment.supportUserId },
      objectId: assignmentId,
      objectType: "support_assignment",
      organizationId,
      reason,
    });

    return { changed: true };
  });
}

export async function authorizeOperationalMutation(
  transaction: TenantTransaction,
  input: {
    actorUserId: string;
    allowedMembershipRoles: ReadonlyArray<"EMPLOYEE" | "OWNER">;
    organizationId: string;
    supportReason?: string;
  },
): Promise<{ kind: "ADMIN" | "MEMBER" | "SUPPORT"; reason?: string }> {
  const [membership] = await transaction
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        eq(memberships.userId, input.actorUserId),
        eq(memberships.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (membership && input.allowedMembershipRoles.includes(membership.role)) {
    return { kind: "MEMBER" };
  }

  const roles = await transaction
    .select({ role: platformRoles.role })
    .from(platformRoles)
    .where(eq(platformRoles.userId, input.actorUserId));
  if (roles.some((role) => role.role === "ADMIN")) {
    return { kind: "ADMIN" };
  }
  if (roles.some((role) => role.role === "SUPPORT")) {
    const access = await transaction.execute<{ allowed: boolean }>(sql`
      select kebapp_private.has_active_support_assignment(
        ${input.organizationId}::uuid
      ) as allowed
    `);
    if (access.rows[0]?.allowed !== true) {
      throw new SupportOperationDeniedError();
    }
    const parsedReason = reasonSchema.safeParse(input.supportReason);
    if (!parsedReason.success) {
      throw new SupportReasonRequiredError();
    }
    return { kind: "SUPPORT", reason: parsedReason.data };
  }

  throw new SupportOperationDeniedError();
}

export async function getAssignedSupportOrganization(input: {
  actor: SupportActor;
  database?: KebappDatabase;
  organizationId: string;
}): Promise<AssignedSupportOrganization> {
  const organizationId = idSchema.parse(input.organizationId);
  const assignments = await listAssignedSupportOrganizations(input);
  const assignment = assignments.find(
    (candidate) => candidate.organizationId === organizationId,
  );
  if (!assignment) {
    throw new SupportAssignmentNotFoundError();
  }

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async () => undefined,
  );
  return assignment;
}
