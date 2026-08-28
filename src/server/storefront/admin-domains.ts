import "server-only";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { toDate } from "@/server/db/definer-values";
import {
  type StoreDomainRequestStatus,
  storeProfiles,
} from "@/server/db/schema";
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

export type DomainRequestRow = {
  connectedDomain: string | null;
  name: string;
  organizationId: string;
  publicSlug: string;
  requestedAt: Date | null;
  requestedDomain: string | null;
  status: StoreDomainRequestStatus;
};

// Der Adminkontext setzt bewusst keine Organisation. Die Auswahlrichtlinie
// von store_profiles verlangt aber genau die - eine direkte Abfrage liefert
// dem Prueftisch deshalb immer null Zeilen. Wie beim Ladenverzeichnis
// uebernimmt eine eng geschnittene Definer-Funktion die Leseseite.
export async function listDomainRequests(input: {
  actor: AdminActor;
  database?: KebappDatabase;
}): Promise<DomainRequestRow[]> {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const result = await transaction.execute<{
      connected_domain: string | null;
      domain_request_status: StoreDomainRequestStatus;
      domain_requested_at: Date | string | null;
      organization_id: string;
      public_slug: string;
      requested_domain: string | null;
      store_name: string;
    }>(sql`select * from kebapp_private.admin_domain_requests()`);

    return result.rows.map((row) => ({
      connectedDomain: row.connected_domain,
      name: row.store_name,
      organizationId: row.organization_id,
      publicSlug: row.public_slug,
      requestedAt: toDate(row.domain_requested_at),
      requestedDomain: row.requested_domain,
      status: row.domain_request_status,
    }));
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
