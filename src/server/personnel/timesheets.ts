import "server-only";

import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { evaluateGeofence, type GeofenceVerdict } from "@/lib/geofence";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { memberships, timeEntries, user } from "@/server/db/schema";
import {
  type TenantTransaction,
  withTenantContext,
} from "@/server/db/tenant-context";
import {
  type PositionFixInput,
  readGeofence,
} from "@/server/personnel/geofence";
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

/**
 * Nur im scharfgestellten Geofence: der Laden verlangt, dass vor Ort
 * gestempelt wird, und das Telefon meldet einen Standort ausserhalb des
 * Radius - oder gar keinen.
 */
export class OutsideGeofenceError extends Error {
  readonly verdict: GeofenceVerdict;

  constructor(verdict: GeofenceVerdict) {
    super("Das Stempeln ist nur am Laden erlaubt.");
    this.name = "OutsideGeofenceError";
    this.verdict = verdict;
  }
}

/**
 * Vergleicht den gemeldeten Standort mit dem Ladenradius und liefert
 * zurueck, was am Zeiteintrag gespeichert wird: Abstand und
 * Messgenauigkeit, nie die Koordinate selbst.
 */
async function resolvePosition(
  transaction: TenantTransaction,
  input: { organizationId: string; position?: PositionFixInput | null },
): Promise<{ accuracyMeters: number | null; distanceMeters: number | null }> {
  const fence = await readGeofence(transaction, input.organizationId);
  const verdict = evaluateGeofence(fence, input.position ?? null);

  if (fence?.enforced && verdict.kind !== "INSIDE") {
    throw new OutsideGeofenceError(verdict);
  }

  if (verdict.kind === "INSIDE" || verdict.kind === "OUTSIDE") {
    return {
      accuracyMeters: verdict.accuracyMeters,
      distanceMeters: verdict.distanceMeters,
    };
  }

  // Ohne hinterlegten Ladenstandort gibt es keinen Abstand, wohl aber
  // eine Messgenauigkeit - die alleine sagt nichts und wird verworfen.
  return { accuracyMeters: null, distanceMeters: null };
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
  position?: PositionFixInput | null;
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

      const position = await resolvePosition(transaction, {
        organizationId,
        position: input.position,
      });

      const [created] = await transaction
        .insert(timeEntries)
        .values({
          organizationId,
          startedAccuracyMeters: position.accuracyMeters,
          startedAt: now,
          startedDistanceMeters: position.distanceMeters,
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
  position?: PositionFixInput | null;
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
      const position = await resolvePosition(transaction, {
        organizationId,
        position: input.position,
      });

      const [closed] = await transaction
        .update(timeEntries)
        .set({
          endedAccuracyMeters: position.accuracyMeters,
          endedAt: now,
          endedDistanceMeters: position.distanceMeters,
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
    endedAccuracyMeters: number | null;
    endedAt: Date | null;
    endedDistanceMeters: number | null;
    entryId: string;
    note: string | null;
    startedAccuracyMeters: number | null;
    startedAt: Date;
    startedDistanceMeters: number | null;
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
          endedAccuracyMeters: timeEntries.endedAccuracyMeters,
          endedAt: timeEntries.endedAt,
          endedDistanceMeters: timeEntries.endedDistanceMeters,
          entryId: timeEntries.id,
          note: timeEntries.note,
          startedAccuracyMeters: timeEntries.startedAccuracyMeters,
          startedAt: timeEntries.startedAt,
          startedDistanceMeters: timeEntries.startedDistanceMeters,
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
        endedAccuracyMeters: row.endedAccuracyMeters,
        endedAt: row.endedAt,
        endedDistanceMeters: row.endedDistanceMeters,
        entryId: row.entryId,
        note: row.note,
        startedAccuracyMeters: row.startedAccuracyMeters,
        startedAt: row.startedAt,
        startedDistanceMeters: row.startedDistanceMeters,
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
    endedDistanceMeters: number | null;
    startedAt: Date;
    startedDistanceMeters: number | null;
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
          endedDistanceMeters: timeEntries.endedDistanceMeters,
          startedAt: timeEntries.startedAt,
          startedDistanceMeters: timeEntries.startedDistanceMeters,
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
        endedDistanceMeters: row.endedDistanceMeters,
        startedAt: row.startedAt,
        startedDistanceMeters: row.startedDistanceMeters,
        userName: row.userName,
      }));
    },
  );
}
