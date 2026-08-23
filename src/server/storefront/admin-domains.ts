import "server-only";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { storeProfiles } from "@/server/db/schema";
import type { TenantTransaction } from "@/server/db/tenant-context";
import {
  setAdminContext,
  setOrganizationContext,
} from "@/server/organizations/admin";

export class DomainRequestNotFoundError extends Error {
  constructor() {
    super("Der Domain-Wunsch wurde nicht gefunden.");
    this.name = "DomainRequestNotFoundError";
  }
}

export class DomainNotRequestedError extends Error {
  constructor() {
    super("Diese Domain ist aktuell nicht zur Prüfung vorgemerkt.");
    this.name = "DomainNotRequestedError";
  }
}

const reasonSchema = z.string().trim().min(10).max(600);

type AdminActor = { userId: string };

async function loadRequestedProfile(
  transaction: TenantTransaction,
  organizationId: string,
) {
  const [profile] = await transaction
    .select({
      id: storeProfiles.id,
      publicSlug: storeProfiles.publicSlug,
      requestedDomain: storeProfiles.requestedDomain,
      status: storeProfiles.domainRequestStatus,
    })
    .from(storeProfiles)
    .where(eq(storeProfiles.organizationId, organizationId))
    .limit(1);
  if (!profile) {
    throw new DomainRequestNotFoundError();
  }
  if (
    profile.status !== "REVIEW_REQUESTED" ||
    !profile.requestedDomain
  ) {
    throw new DomainNotRequestedError();
  }
  return profile;
}

export async function listDomainRequests(input: {
  actor: AdminActor;
  database?: KebappDatabase;
}) {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const rows = await transaction
      .select({
        organizationId: storeProfiles.organizationId,
        publicSlug: storeProfiles.publicSlug,
        name: storeProfiles.name,
        connectedDomain: storeProfiles.customDomain,
        requestedDomain: storeProfiles.requestedDomain,
        requestedAt: storeProfiles.domainRequestedAt,
        status: storeProfiles.domainRequestStatus,
      })
      .from(storeProfiles)
      .orderBy(asc(storeProfiles.name));
    return rows.filter(
      (row) => row.status === "REVIEW_REQUESTED" || row.connectedDomain,
    );
  });
}

export async function connectDomain(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  organizationId: string;
}): Promise<{ connectedDomain: string }> {
  const organizationId = z.uuid().parse(input.organizationId);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    await setOrganizationContext(transaction, organizationId);
    const profile = await loadRequestedProfile(transaction, organizationId);

    const [updated] = await transaction
      .update(storeProfiles)
      .set({
        customDomain: profile.requestedDomain!,
        domainRequestStatus: "CONNECTED",
      })
      .where(eq(storeProfiles.id, profile.id))
      .returning({ customDomain: storeProfiles.customDomain });

    await writeAuditEvent(transaction, {
      action: "STOREFRONT_DOMAIN_CONNECTED",
      actorUserId: input.actor.userId,
      metadata: { publicSlug: profile.publicSlug },
      objectId: profile.id,
      objectType: "store_profile",
      organizationId,
    });

    return { connectedDomain: updated!.customDomain! };
  });
}

export async function rejectDomain(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  organizationId: string;
  reason: string;
}): Promise<void> {
  const organizationId = z.uuid().parse(input.organizationId);
  const reason = reasonSchema.parse(input.reason);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    await setOrganizationContext(transaction, organizationId);
    const profile = await loadRequestedProfile(transaction, organizationId);

    await transaction
      .update(storeProfiles)
      .set({ domainRequestStatus: "NONE" })
      .where(eq(storeProfiles.id, profile.id));

    await writeAuditEvent(transaction, {
      action: "STOREFRONT_DOMAIN_REJECTED",
      actorUserId: input.actor.userId,
      metadata: { publicSlug: profile.publicSlug },
      objectId: profile.id,
      objectType: "store_profile",
      organizationId,
      reason,
    });
  });
}
