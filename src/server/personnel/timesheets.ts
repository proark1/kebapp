import "server-only";

import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { memberships, timeEntries, user } from "@/server/db/schema";
import {
  type TenantTransaction,
  withTenantContext,
} from "@/server/db/tenant-context";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

export class TimeEntryAlreadyOpenError extends Error {
  constructor() {
    super("Es läuft bereits eine Schicht.");
    this.name = "TimeEntryAlreadyOpenError";
  }
}

export class NoOpenTimeEntryError extends Error {
  constructor() {
    super("Es läuft gerade keine Schicht.");
    this.name = "NoOpenTimeEntryError";
  }
}

export class TimeEntryNotFoundError extends Error {
  constructor() {
    super("Der Zeiteintrag wurde nicht gefunden.");
    this.name = "TimeEntryNotFoundError";
  }
}

type PersonnelActor = { userId: string };

const timestampSchema = z.coerce.date();
const correctionSchema = z
  .object({
    endedAt: timestampSchema,
    entryId: procurementIdSchema,
    note: z.string().trim().max(300).optional(),
    startedAt: timestampSchema,
  })
  .refine((value) => value.endedAt.getTime() > value.startedAt.getTime(), {
    message: "Das Ende muss nach dem Start liegen.",
    path: ["endedAt"],
  });

async function assertTeamMember(
  transaction: TenantTransaction,
  input: { actorUserId: string; organizationId: string },
): Promise<{ isManager: boolean }> {
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
  if (membership?.role === "OWNER") {
    return { isManager: true };
  }
  if (membership?.role === "EMPLOYEE") {
    return { isManager: false };
  }

  // Plattform-Rollen kommen über authorizeOperationalMutation herein.
  await authorizeOperationalMutation(transaction, {
    actorUserId: input.actorUserId,
    allowedMembershipRoles: [],
    organizationId: input.organizationId,
    supportReason: undefined,
  });
  return { isManager: true };
}

export async function clockIn(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  now?: Date;
  organizationId: string;
}): Promise<{ entryId: string }> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const now = input.now ?? new Date();

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
      });
      const [open] = await transaction
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.organizationId, organizationId),
            eq(timeEntries.userId, input.actor.userId),
            isNull(timeEntries.endedAt),
          ),
        )
        .limit(1);
      if (open) {
        throw new TimeEntryAlreadyOpenError();
      }

      const [created] = await transaction
        .insert(timeEntries)
        .values({
          organizationId,
          startedAt: now,
          userId: input.actor.userId,
        })
        .returning({ id: timeEntries.id });
      return { entryId: created!.id };
    },
  );
}

export async function clockOut(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  note?: string;
  now?: Date;
  organizationId: string;
}): Promise<void> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const now = input.now ?? new Date();

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
      });
      const [closed] = await transaction
        .update(timeEntries)
        .set({
          endedAt: now,
          ...(input.note ? { note: input.note.slice(0, 300) } : {}),
        })
        .where(
          and(
            eq(timeEntries.organizationId, organizationId),
            eq(timeEntries.userId, input.actor.userId),
            isNull(timeEntries.endedAt),
          ),
        )
        .returning({ id: timeEntries.id });
      if (!closed) {
        throw new NoOpenTimeEntryError();
      }
    },
  );
}

export async function listRecentTimeEntries(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  days?: number;
  organizationId: string;
  targetUserId?: string;
}): Promise<
  Array<{
    durationMinutes: number | null;
    endedAt: Date | null;
    entryId: string;
    note: string | null;
    startedAt: Date;
    userName: string;
    userId: string;
    corrected: boolean;
  }>
> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const days = Math.min(Math.max(input.days ?? 14, 1), 62);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const { isManager } = await assertTeamMember(transaction, {
        actorUserId: input.actor.userId,
        organizationId,
      });

      const targetUserId = isManager
        ? (input.targetUserId ?? undefined)
        : input.actor.userId;

      const rows = await transaction
        .select({
          durationMinutes: sql<number | null>`case when ${timeEntries.endedAt} is null then null else (extract(epoch from (${timeEntries.endedAt} - ${timeEntries.startedAt})) / 60)::int end`,
          endedAt: timeEntries.endedAt,
          entryId: timeEntries.id,
          note: timeEntries.note,
          startedAt: timeEntries.startedAt,
          userName: user.name,
          userId: timeEntries.userId,
          correctedBy: timeEntries.correctedByUserId,
        })
        .from(timeEntries)
        .innerJoin(user, eq(user.id, timeEntries.userId))
        .where(
          and(
            eq(timeEntries.organizationId, organizationId),
            gte(timeEntries.startedAt, since),
            targetUserId ? eq(timeEntries.userId, targetUserId) : undefined,
          ),
        )
        .orderBy(desc(timeEntries.startedAt))
        .limit(400);

      return rows.map((row) => ({
        corrected: row.correctedBy !== null,
        durationMinutes: row.durationMinutes,
        endedAt: row.endedAt,
        entryId: row.entryId,
        note: row.note,
        startedAt: row.startedAt,
        userName: row.userName,
        userId: row.userId,
      }));
    },
  );
}

export async function correctTimeEntry(input: {
  actor: PersonnelActor;
  correction: z.input<typeof correctionSchema>;
  database?: KebappDatabase;
  organizationId: string;
  supportReason?: string;
}): Promise<void> {
  const parsed = correctionSchema.parse(input.correction);
  const organizationId = procurementIdSchema.parse(input.organizationId);

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER"],
        organizationId,
        supportReason: input.supportReason,
      });

      const [updated] = await transaction
        .update(timeEntries)
        .set({
          correctedByUserId: input.actor.userId,
          endedAt: parsed.endedAt,
          note: parsed.note ?? null,
          startedAt: parsed.startedAt,
        })
        .where(
          and(
            eq(timeEntries.id, parsed.entryId),
            eq(timeEntries.organizationId, organizationId),
          ),
        )
        .returning({ id: timeEntries.id, userId: timeEntries.userId });
      if (!updated) {
        throw new TimeEntryNotFoundError();
      }

      await writeAuditEvent(transaction, {
        action: "TIME_ENTRY_CORRECTED",
        actorUserId: input.actor.userId,
        metadata: {
          endedAt: parsed.endedAt.toISOString(),
          entryUserId: updated.userId,
          startedAt: parsed.startedAt.toISOString(),
        },
        objectId: updated.id,
        objectType: "time_entry",
        organizationId,
      });
    },
  );
}

export async function listTeamMembers(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  organizationId: string;
}): Promise<Array<{ label: string; userId: string }>> {
  const organizationId = procurementIdSchema.parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await assertTeamMember(transaction, {
        actorUserId: input.actor.userId,
        organizationId,
      });
      const members = await transaction
        .selectDistinctOn([user.id], {
          label: user.name,
          userId: user.id,
        })
        .from(user)
        .innerJoin(
          memberships,
          and(
            eq(memberships.userId, user.id),
            eq(memberships.organizationId, organizationId),
            eq(memberships.status, "ACTIVE"),
          ),
        )
        .orderBy(user.id);
      return members.map((member) => ({
        label: member.label || member.userId,
        userId: member.userId,
      }));
    },
  );
}

export async function exportableEntries(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  from: Date;
  organizationId: string;
  targetUserId?: string;
  to: Date;
}): Promise<
  Array<{
    durationMinutes: number;
    endedAt: Date;
    startedAt: Date;
    userName: string;
  }>
> {
  const organizationId = procurementIdSchema.parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const { isManager } = await assertTeamMember(transaction, {
        actorUserId: input.actor.userId,
        organizationId,
      });
      const targetUserId = isManager
        ? (input.targetUserId ?? undefined)
        : input.actor.userId;

      const rows = await transaction
        .select({
          endedAt: timeEntries.endedAt,
          startedAt: timeEntries.startedAt,
          userName: user.name,
        })
        .from(timeEntries)
        .innerJoin(user, eq(user.id, timeEntries.userId))
        .where(
          and(
            eq(timeEntries.organizationId, organizationId),
            gte(timeEntries.startedAt, input.from),
            lte(timeEntries.startedAt, input.to),
            isNotNull(timeEntries.endedAt),
            targetUserId ? eq(timeEntries.userId, targetUserId) : undefined,
          ),
        )
        .orderBy(timeEntries.startedAt);

      return rows.map((row) => ({
        durationMinutes: Math.round(
          (row.endedAt!.getTime() - row.startedAt.getTime()) / 60_000,
        ),
        endedAt: row.endedAt!,
        startedAt: row.startedAt,
        userName: row.userName,
      }));
    },
  );
}
