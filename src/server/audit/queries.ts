import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { KebappDatabase } from "@/server/db/client";
import { auditEvents, organizations, user } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import { assertPlatformAdmin } from "@/server/organizations/admin";

const filtersSchema = z.object({
  action: z.string().trim().max(120).optional(),
  actor: z.string().trim().max(320).optional(),
  organizationId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.uuid().optional(),
  ),
});

export type AuditEventDTO = {
  action: string;
  actorLabel: string;
  actorUserId: string | null;
  createdAt: string;
  id: string;
  objectId: string | null;
  objectType: string;
  organizationId: string | null;
  reason: string | null;
  result: "DENIED" | "FAILED" | "SUCCESS";
  storeName: string | null;
};

export async function listAuditEvents(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  filters?: { action?: string; actor?: string; organizationId?: string };
}): Promise<AuditEventDTO[]> {
  const filters = filtersSchema.parse(input.filters ?? {});
  const database =
    input.database ?? (await import("@/server/db/client")).database;
  await assertPlatformAdmin({ actor: input.actor, database });

  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      select
        set_config('kebapp.user_id', ${input.actor.userId}, true),
        set_config('kebapp.organization_id', '', true)
    `);

    const conditions = [];
    if (filters.organizationId) {
      conditions.push(eq(auditEvents.organizationId, filters.organizationId));
    }
    if (filters.action) {
      conditions.push(ilike(auditEvents.action, `%${filters.action}%`));
    }
    if (filters.actor) {
      conditions.push(
        or(
          ilike(auditEvents.actorUserId, `%${filters.actor}%`),
          ilike(user.name, `%${filters.actor}%`),
          ilike(user.email, `%${filters.actor}%`),
        )!,
      );
    }

    const rows = await transaction
      .select({
        action: auditEvents.action,
        actorName: user.name,
        actorUserId: auditEvents.actorUserId,
        createdAt: auditEvents.createdAt,
        id: auditEvents.id,
        objectId: auditEvents.objectId,
        objectType: auditEvents.objectType,
        organizationId: auditEvents.organizationId,
        reason: auditEvents.reason,
        result: auditEvents.result,
        storeName: organizations.storeName,
      })
      .from(auditEvents)
      .leftJoin(user, eq(user.id, auditEvents.actorUserId))
      .leftJoin(organizations, eq(organizations.id, auditEvents.organizationId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditEvents.createdAt))
      .limit(100);

    return rows.map((row) => ({
      ...row,
      actorLabel: row.actorName ?? row.actorUserId ?? "System",
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

export async function listSupportOrganizationAudit(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  organizationId: string;
}): Promise<AuditEventDTO[]> {
  const organizationId = z.uuid().parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const rows = await transaction
        .select({
          action: auditEvents.action,
          actorName: user.name,
          actorUserId: auditEvents.actorUserId,
          createdAt: auditEvents.createdAt,
          id: auditEvents.id,
          objectId: auditEvents.objectId,
          objectType: auditEvents.objectType,
          organizationId: auditEvents.organizationId,
          reason: auditEvents.reason,
          result: auditEvents.result,
          storeName: organizations.storeName,
        })
        .from(auditEvents)
        .leftJoin(user, eq(user.id, auditEvents.actorUserId))
        .leftJoin(
          organizations,
          eq(organizations.id, auditEvents.organizationId),
        )
        .where(eq(auditEvents.organizationId, organizationId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(12);

      return rows.map((row) => ({
        ...row,
        actorLabel: row.actorName ?? row.actorUserId ?? "System",
        createdAt: row.createdAt.toISOString(),
      }));
    },
  );
}
