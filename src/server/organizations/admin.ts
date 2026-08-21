import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import {
  memberships,
  organizations,
  platformRoles,
  registrationRequests,
} from "@/server/db/schema";
import type { TenantTransaction } from "@/server/db/tenant-context";

const idSchema = z.uuid();
const reasonSchema = z.string().trim().min(10).max(600);

export class PlatformAdminRequiredError extends Error {
  constructor() {
    super("Für diesen Bereich ist eine Admin-Berechtigung erforderlich.");
    this.name = "PlatformAdminRequiredError";
  }
}

export class RegistrationRequestNotFoundError extends Error {
  constructor() {
    super("Der Antrag wurde nicht gefunden.");
    this.name = "RegistrationRequestNotFoundError";
  }
}

export class RegistrationTransitionError extends Error {
  constructor() {
    super("Dieser Antrag kann nicht mehr geändert werden.");
    this.name = "RegistrationTransitionError";
  }
}

type AdminActor = { userId: string };

async function setAdminContext(
  transaction: TenantTransaction,
  actor: AdminActor,
) {
  await transaction.execute(sql`
    select
      set_config('kebapp.user_id', ${actor.userId}, true),
      set_config('kebapp.organization_id', '', true)
  `);

  const [adminRole] = await transaction
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(
      and(
        eq(platformRoles.userId, actor.userId),
        eq(platformRoles.role, "ADMIN"),
      ),
    )
    .limit(1);

  if (!adminRole) {
    throw new PlatformAdminRequiredError();
  }
}

async function setOrganizationContext(
  transaction: TenantTransaction,
  organizationId: string,
) {
  await transaction.execute(sql`
    select set_config(
      'kebapp.organization_id',
      ${organizationId},
      true
    )
  `);
}

async function getRequestForReview(
  transaction: TenantTransaction,
  requestId: string,
) {
  const [request] = await transaction
    .select({
      organizationId: registrationRequests.organizationId,
      status: registrationRequests.status,
      userId: registrationRequests.userId,
    })
    .from(registrationRequests)
    .where(eq(registrationRequests.id, requestId))
    .limit(1);

  if (!request) {
    throw new RegistrationRequestNotFoundError();
  }

  return request;
}

export async function assertPlatformAdmin(input: {
  actor: AdminActor;
  database?: KebappDatabase;
}): Promise<void> {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  await database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
  });
}

export async function listRegistrationRequests(input: {
  actor: AdminActor;
  database?: KebappDatabase;
}) {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);

    return transaction
      .select({
        city: registrationRequests.city,
        contactName: registrationRequests.contactName,
        createdAt: registrationRequests.createdAt,
        id: registrationRequests.id,
        postalCode: registrationRequests.postalCode,
        status: registrationRequests.status,
        storeName: registrationRequests.storeName,
      })
      .from(registrationRequests)
      .orderBy(asc(registrationRequests.createdAt));
  });
}

export async function getRegistrationRequest(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  requestId: string;
}) {
  const requestId = idSchema.parse(input.requestId);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const request = await getRequestForReview(transaction, requestId);
    await setOrganizationContext(transaction, request.organizationId);

    const [detail] = await transaction
      .select({
        city: registrationRequests.city,
        contactEmail: registrationRequests.contactEmail,
        contactName: registrationRequests.contactName,
        contactPhone: registrationRequests.contactPhone,
        createdAt: registrationRequests.createdAt,
        id: registrationRequests.id,
        legalName: registrationRequests.legalName,
        organizationId: registrationRequests.organizationId,
        postalCode: registrationRequests.postalCode,
        reviewNote: registrationRequests.reviewNote,
        reviewedAt: registrationRequests.reviewedAt,
        status: registrationRequests.status,
        storeName: registrationRequests.storeName,
        street: registrationRequests.street,
      })
      .from(registrationRequests)
      .where(eq(registrationRequests.id, requestId))
      .limit(1);

    return detail ?? null;
  });
}

export async function approveRegistrationRequest(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  requestId: string;
}): Promise<{ changed: boolean }> {
  const requestId = idSchema.parse(input.requestId);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const request = await getRequestForReview(transaction, requestId);

    if (request.status === "APPROVED") {
      return { changed: false };
    }
    if (request.status !== "PENDING") {
      throw new RegistrationTransitionError();
    }

    await setOrganizationContext(transaction, request.organizationId);
    const reviewedAt = new Date();

    await transaction
      .update(registrationRequests)
      .set({
        reviewedAt,
        reviewedByUserId: input.actor.userId,
        status: "APPROVED",
      })
      .where(
        and(
          eq(registrationRequests.id, requestId),
          eq(registrationRequests.status, "PENDING"),
        ),
      );
    await transaction
      .update(organizations)
      .set({
        reviewedAt,
        reviewedByUserId: input.actor.userId,
        status: "ACTIVE",
      })
      .where(eq(organizations.id, request.organizationId));
    await transaction
      .update(memberships)
      .set({ joinedAt: reviewedAt, status: "ACTIVE" })
      .where(
        and(
          eq(memberships.organizationId, request.organizationId),
          eq(memberships.userId, request.userId),
          eq(memberships.role, "OWNER"),
        ),
      );
    await writeAuditEvent(transaction, {
      action: "ORGANIZATION_REGISTRATION_APPROVED",
      actorUserId: input.actor.userId,
      objectId: requestId,
      objectType: "registration_request",
      organizationId: request.organizationId,
    });

    return { changed: true };
  });
}

export async function rejectRegistrationRequest(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  reason: string;
  requestId: string;
}): Promise<{ changed: boolean }> {
  const requestId = idSchema.parse(input.requestId);
  const reason = reasonSchema.parse(input.reason);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const request = await getRequestForReview(transaction, requestId);

    if (request.status === "REJECTED") {
      return { changed: false };
    }
    if (request.status !== "PENDING") {
      throw new RegistrationTransitionError();
    }

    await setOrganizationContext(transaction, request.organizationId);
    const reviewedAt = new Date();

    await transaction
      .update(registrationRequests)
      .set({
        reviewNote: reason,
        reviewedAt,
        reviewedByUserId: input.actor.userId,
        status: "REJECTED",
      })
      .where(eq(registrationRequests.id, requestId));
    await transaction
      .update(organizations)
      .set({
        reviewedAt,
        reviewedByUserId: input.actor.userId,
        status: "REJECTED",
      })
      .where(eq(organizations.id, request.organizationId));
    await transaction
      .update(memberships)
      .set({ status: "REMOVED" })
      .where(eq(memberships.organizationId, request.organizationId));
    await writeAuditEvent(transaction, {
      action: "ORGANIZATION_REGISTRATION_REJECTED",
      actorUserId: input.actor.userId,
      objectId: requestId,
      objectType: "registration_request",
      organizationId: request.organizationId,
      reason,
    });

    return { changed: true };
  });
}

export async function suspendOrganization(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  organizationId: string;
  reason: string;
}): Promise<{ changed: boolean }> {
  const organizationId = idSchema.parse(input.organizationId);
  const reason = reasonSchema.parse(input.reason);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    await setOrganizationContext(transaction, organizationId);

    const [organization] = await transaction
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      throw new RegistrationRequestNotFoundError();
    }
    if (organization.status === "SUSPENDED") {
      return { changed: false };
    }
    if (organization.status !== "ACTIVE") {
      throw new RegistrationTransitionError();
    }

    const reviewedAt = new Date();
    await transaction
      .update(organizations)
      .set({
        reviewedAt,
        reviewedByUserId: input.actor.userId,
        status: "SUSPENDED",
      })
      .where(eq(organizations.id, organizationId));
    await transaction
      .update(memberships)
      .set({ status: "SUSPENDED" })
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.status, "ACTIVE"),
        ),
      );
    await writeAuditEvent(transaction, {
      action: "ORGANIZATION_SUSPENDED",
      actorUserId: input.actor.userId,
      objectId: organizationId,
      objectType: "organization",
      organizationId,
      reason,
    });

    return { changed: true };
  });
}
