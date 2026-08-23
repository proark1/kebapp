import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import {
  hygieneEntries,
  hygieneItems,
  user as usersTable,
} from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import { HYGIENE_ITEMS, hygieneItemByKey } from "@/lib/hygiene-items";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

export class HygieneDateLockedError extends Error {
  constructor() {
    super("Ältere Tage können nicht mehr geändert werden.");
    this.name = "HygieneDateLockedError";
  }
}

type PersonnelActor = { userId: string };

const isoDate = z.iso.date();
const celsiusSchema = z.coerce.number().finite().min(-40).max(60);

export const saveHygieneInputSchema = z.object({
  date: isoDate,
  items: z
    .array(
      z.object({
        celsius: celsiusSchema.optional(),
        key: z.string().max(40),
        note: z.string().trim().max(300).optional(),
        status: z.enum(["OK", "MANGEL"]).optional(),
      }),
    )
    .length(HYGIENE_ITEMS.length),
  note: z.string().trim().max(1_000).optional(),
});

export type SaveHygieneInput = z.input<typeof saveHygieneInputSchema>;

function todayIso(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(now);
}

function assertEditableDate(date: string, now: Date): void {
  const today = todayIso(now);
  const yesterday = todayIso(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (date !== today && date !== yesterday) {
    throw new HygieneDateLockedError();
  }
}

export async function getHygieneDay(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  date: string;
  organizationId: string;
}) {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const date = isoDate.parse(input.date);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
      });

      const [entry] = await transaction
        .select({
          completedByUserId: hygieneEntries.completedByUserId,
          id: hygieneEntries.id,
          note: hygieneEntries.note,
          savedAt: hygieneEntries.updatedAt,
        })
        .from(hygieneEntries)
        .where(
          and(
            eq(hygieneEntries.organizationId, organizationId),
            eq(hygieneEntries.entryDate, date),
          ),
        )
        .limit(1);

      const savedItems = entry
        ? await transaction
            .select()
            .from(hygieneItems)
            .where(eq(hygieneItems.entryId, entry.id))
        : [];
      const byKey = new Map(savedItems.map((item) => [item.itemKey, item]));

      return {
        date,
        editable: true,
        note: entry?.note ?? "",
        savedAt: entry?.savedAt?.toISOString() ?? null,
        completedByName:
          entry === undefined
            ? null
            : (
                await transaction
                  .select({ name: usersTable.name })
                  .from(usersTable)
                  .where(eq(usersTable.id, entry.completedByUserId))
                  .limit(1)
              )[0]?.name ?? null,
        items: HYGIENE_ITEMS.map((definition) => {
          const saved = byKey.get(definition.key);
          return {
            ...definition,
            note: saved?.note ?? "",
            status: saved?.status ?? null,
            valueCelsius:
              saved?.celsius === null || saved?.celsius === undefined
                ? null
                : Number(saved.celsius),
          };
        }),
      };
    },
  );
}

export async function listRecentHygieneDays(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  days?: number;
  organizationId: string;
}): Promise<
  Array<{ date: string; defectCount: number; hasEntry: boolean; userName: string | null }>
> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const days = Math.min(Math.max(input.days ?? 14, 7), 31);
  const now = new Date();
  const since = todayIso(new Date(now.getTime() - (days - 1) * 86_400_000));

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
      });

      const rows = await transaction
        .select({
          completedByUserId: hygieneEntries.completedByUserId,
          date: hygieneEntries.entryDate,
          defectCount:
            sql<number>`(select count(*)::int from public.hygiene_items hi where hi.entry_id = ${hygieneEntries.id} and hi.status = 'MANGEL')`,
          userName: usersTable.name,
        })
        .from(hygieneEntries)
        .leftJoin(usersTable, eq(usersTable.id, hygieneEntries.completedByUserId))
        .where(
          and(
            eq(hygieneEntries.organizationId, organizationId),
            gte(hygieneEntries.entryDate, since),
          ),
        )
        .orderBy(desc(hygieneEntries.entryDate));

      return rows.map((row) => ({
        date: row.date,
        defectCount: row.defectCount,
        hasEntry: true,
        userName: row.userName ?? null,
      }));
    },
  );
}

export async function saveHygieneEntry(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  input: SaveHygieneInput;
  now?: Date;
  organizationId: string;
  supportReason?: string;
}): Promise<void> {
  const parsed = saveHygieneInputSchema.parse(input.input);
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const now = input.now ?? new Date();
  assertEditableDate(parsed.date, now);

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const authorization = await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });

      // Begriffspflicht bei Mängeln durchsetzen.
      for (const item of parsed.items) {
        if (item.status === "MANGEL" && !item.note) {
          throw new HygieneNoteRequiredError(item.key);
        }
      }

      const knownKeys = new Set(HYGIENE_ITEMS.map((item) => item.key));
      for (const item of parsed.items) {
        if (!knownKeys.has(item.key)) {
          throw new HygieneUnknownItemError();
        }
        const definition = hygieneItemByKey(item.key)!;
        if (
          definition.kind === "TEMPERATURE" &&
          (item.celsius === undefined || item.status !== undefined)
        ) {
          throw new HygieneValidationError(definition.label);
        }
        if (
          definition.kind === "CHECK" &&
          (item.status === undefined || item.celsius !== undefined)
        ) {
          throw new HygieneValidationError(definition.label);
        }
      }

      await transaction
        .insert(hygieneEntries)
        .values({
          completedByUserId: input.actor.userId,
          entryDate: parsed.date,
          note: parsed.note ?? null,
          organizationId,
        })
        .onConflictDoUpdate({
          set: {
            completedByUserId: input.actor.userId,
            note: parsed.note ?? null,
            updatedAt: now,
          },
          target: [hygieneEntries.organizationId, hygieneEntries.entryDate],
        });

      const [entry] = await transaction
        .select({ id: hygieneEntries.id })
        .from(hygieneEntries)
        .where(
          and(
            eq(hygieneEntries.organizationId, organizationId),
            eq(hygieneEntries.entryDate, parsed.date),
          ),
        )
        .limit(1);
      if (!entry) {
        throw new HygieneDateLockedError();
      }

      await transaction.delete(hygieneItems).where(eq(hygieneItems.entryId, entry.id));
      await transaction.insert(hygieneItems).values(
        parsed.items.map((item) => {
          const definition = hygieneItemByKey(item.key)!;
          return {
            celsius:
              definition.kind === "TEMPERATURE" && item.celsius !== undefined
                ? item.celsius.toFixed(1)
                : null,
            entryId: entry.id,
            itemKey: item.key,
            kind: definition.kind,
            note: item.note || null,
            organizationId,
            status:
              definition.kind === "CHECK" ? (item.status ?? null) : null,
          };
        }),
      );

      const defectCount = parsed.items.filter(
        (item) => item.status === "MANGEL",
      ).length;

      if (authorization.kind === "SUPPORT") {
        await writeAuditEvent(transaction, {
          action: "SUPPORT_HYGIENE_ENTRY_SAVED",
          actorUserId: input.actor.userId,
          metadata: { defectCount, date: parsed.date },
          objectId: entry.id,
          objectType: "hygiene_entry",
          organizationId,
          reason: authorization.reason,
        });
      }

      await writeAuditEvent(transaction, {
        action: "HYGIENE_ENTRY_SAVED",
        actorUserId: input.actor.userId,
        metadata: { defectCount, date: parsed.date },
        objectId: entry.id,
        objectType: "hygiene_entry",
        organizationId,
      });
    },
  );
}

export class HygieneNoteRequiredError extends Error {
  constructor(itemKey: string) {
    super(`Bei Mangel ist eine Begründung erforderlich (${itemKey}).`);
    this.name = "HygieneNoteRequiredError";
  }
}

export class HygieneUnknownItemError extends Error {
  constructor() {
    super("Unbekannter Prüfpunkt.");
    this.name = "HygieneUnknownItemError";
  }
}

export class HygieneValidationError extends Error {
  constructor(label: string) {
    super(`Angabe für „${label}" ist unvollständig.`);
    this.name = "HygieneValidationError";
  }
}
