import "server-only";

import { and, eq } from "drizzle-orm";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import {
  buyingRounds,
  demandItems,
  demandSubmissions,
  memberships,
} from "@/server/db/schema";
import {
  type TenantTransaction,
  withTenantContext,
} from "@/server/db/tenant-context";
import {
  demandItemInputSchema,
  type DemandItemInput,
  demandQuantitySchema,
  procurementIdSchema,
} from "@/server/procurement/validation";

type ProcurementActor = { userId: string };

export class DemandLockedError extends Error {
  constructor() {
    super("Diese Sammelrunde kann nicht mehr geändert werden.");
    this.name = "DemandLockedError";
  }
}

export class DemandNotFoundError extends Error {
  constructor() {
    super("Die Bedarfsposition wurde nicht gefunden.");
    this.name = "DemandNotFoundError";
  }
}

export class DemandConfirmationDeniedError extends Error {
  constructor() {
    super("Nur Inhaber:innen dürfen den Bedarf verbindlich bestätigen.");
    this.name = "DemandConfirmationDeniedError";
  }
}

export class EmptyDemandSubmissionError extends Error {
  constructor() {
    super("Mindestens eine Bedarfsposition ist zur Bestätigung erforderlich.");
    this.name = "EmptyDemandSubmissionError";
  }
}

async function requireEditableRound(
  transaction: TenantTransaction,
  input: { buyingRoundId: string; now: Date; organizationId: string },
) {
  const [round] = await transaction
    .select({
      closesAt: buyingRounds.closesAt,
      deliveryEndsAt: buyingRounds.deliveryEndsAt,
      deliveryStartsAt: buyingRounds.deliveryStartsAt,
      id: buyingRounds.id,
      referenceUnitPrice: buyingRounds.referenceUnitPrice,
      status: buyingRounds.status,
    })
    .from(buyingRounds)
    .where(
      and(
        eq(buyingRounds.id, input.buyingRoundId),
        eq(buyingRounds.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (
    !round ||
    round.status !== "OPEN" ||
    round.closesAt.getTime() <= input.now.getTime()
  ) {
    throw new DemandLockedError();
  }

  return round;
}

async function getOrCreateDraftSubmission(
  transaction: TenantTransaction,
  input: { buyingRoundId: string; organizationId: string },
) {
  const [existing] = await transaction
    .select({ id: demandSubmissions.id, status: demandSubmissions.status })
    .from(demandSubmissions)
    .where(
      and(
        eq(demandSubmissions.organizationId, input.organizationId),
        eq(demandSubmissions.buyingRoundId, input.buyingRoundId),
      ),
    )
    .limit(1);

  if (existing?.status === "CONFIRMED") {
    throw new DemandLockedError();
  }
  if (existing) {
    return existing;
  }

  const [created] = await transaction
    .insert(demandSubmissions)
    .values({
      buyingRoundId: input.buyingRoundId,
      organizationId: input.organizationId,
      status: "DRAFT",
    })
    .onConflictDoNothing({
      target: [
        demandSubmissions.organizationId,
        demandSubmissions.buyingRoundId,
      ],
    })
    .returning({ id: demandSubmissions.id, status: demandSubmissions.status });

  if (created) {
    return created;
  }

  const [concurrent] = await transaction
    .select({ id: demandSubmissions.id, status: demandSubmissions.status })
    .from(demandSubmissions)
    .where(
      and(
        eq(demandSubmissions.organizationId, input.organizationId),
        eq(demandSubmissions.buyingRoundId, input.buyingRoundId),
      ),
    )
    .limit(1);
  if (!concurrent || concurrent.status !== "DRAFT") {
    throw new DemandLockedError();
  }
  return concurrent;
}

function assertDeliveryDateInRound(
  requestedDeliveryDate: string,
  round: { deliveryEndsAt: Date; deliveryStartsAt: Date },
) {
  const firstDate = round.deliveryStartsAt.toISOString().slice(0, 10);
  const lastDate = round.deliveryEndsAt.toISOString().slice(0, 10);
  if (
    requestedDeliveryDate < firstDate ||
    requestedDeliveryDate > lastDate
  ) {
    throw new DemandLockedError();
  }
}

async function getOwnedDraftItem(
  transaction: TenantTransaction,
  input: { demandItemId: string; organizationId: string },
) {
  const [item] = await transaction
    .select({
      buyingRoundId: demandSubmissions.buyingRoundId,
      id: demandItems.id,
      submissionId: demandItems.submissionId,
      submissionStatus: demandSubmissions.status,
    })
    .from(demandItems)
    .innerJoin(
      demandSubmissions,
      and(
        eq(demandSubmissions.id, demandItems.submissionId),
        eq(demandSubmissions.organizationId, demandItems.organizationId),
      ),
    )
    .where(
      and(
        eq(demandItems.id, input.demandItemId),
        eq(demandItems.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!item) {
    throw new DemandNotFoundError();
  }
  if (item.submissionStatus !== "DRAFT") {
    throw new DemandLockedError();
  }
  return item;
}

export async function addDemandItem(input: {
  actor: ProcurementActor;
  database?: KebappDatabase;
  input: DemandItemInput;
  now?: Date;
  organizationId: string;
}): Promise<{ demandItemId: string }> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const values = demandItemInputSchema.parse(input.input);
  const now = input.now ?? new Date();

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const round = await requireEditableRound(transaction, {
        buyingRoundId: values.buyingRoundId,
        now,
        organizationId,
      });
      assertDeliveryDateInRound(values.requestedDeliveryDate, round);
      const submission = await getOrCreateDraftSubmission(transaction, {
        buyingRoundId: values.buyingRoundId,
        organizationId,
      });

      const [created] = await transaction
        .insert(demandItems)
        .values({
          currency: "EUR",
          estimatedUnitPrice: round.referenceUnitPrice,
          organizationId,
          productName: values.productName,
          quantity: values.quantity.toFixed(3),
          requestedDeliveryDate: values.requestedDeliveryDate,
          specification: values.specification,
          submissionId: submission.id,
          unit: values.unit,
        })
        .returning({ id: demandItems.id });

      return { demandItemId: created!.id };
    },
  );
}

export async function updateDemandItemQuantity(input: {
  actor: ProcurementActor;
  database?: KebappDatabase;
  demandItemId: string;
  now?: Date;
  organizationId: string;
  quantity: number;
}): Promise<void> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const demandItemId = procurementIdSchema.parse(input.demandItemId);
  const quantity = demandQuantitySchema.parse(input.quantity);
  const now = input.now ?? new Date();

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const item = await getOwnedDraftItem(transaction, {
        demandItemId,
        organizationId,
      });
      await requireEditableRound(transaction, {
        buyingRoundId: item.buyingRoundId,
        now,
        organizationId,
      });

      const [updated] = await transaction
        .update(demandItems)
        .set({ quantity: quantity.toFixed(3) })
        .where(
          and(
            eq(demandItems.id, demandItemId),
            eq(demandItems.organizationId, organizationId),
            eq(demandItems.submissionId, item.submissionId),
          ),
        )
        .returning({ id: demandItems.id });
      if (!updated) {
        throw new DemandNotFoundError();
      }
    },
  );
}

export async function removeDemandItem(input: {
  actor: ProcurementActor;
  database?: KebappDatabase;
  demandItemId: string;
  now?: Date;
  organizationId: string;
}): Promise<void> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const demandItemId = procurementIdSchema.parse(input.demandItemId);
  const now = input.now ?? new Date();

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const item = await getOwnedDraftItem(transaction, {
        demandItemId,
        organizationId,
      });
      await requireEditableRound(transaction, {
        buyingRoundId: item.buyingRoundId,
        now,
        organizationId,
      });

      const [deleted] = await transaction
        .delete(demandItems)
        .where(
          and(
            eq(demandItems.id, demandItemId),
            eq(demandItems.organizationId, organizationId),
            eq(demandItems.submissionId, item.submissionId),
          ),
        )
        .returning({ id: demandItems.id });
      if (!deleted) {
        throw new DemandNotFoundError();
      }
    },
  );
}

export async function confirmDemandSubmission(input: {
  actor: ProcurementActor;
  buyingRoundId: string;
  database?: KebappDatabase;
  now?: Date;
  organizationId: string;
}): Promise<{ changed: boolean }> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const buyingRoundId = procurementIdSchema.parse(input.buyingRoundId);
  const now = input.now ?? new Date();

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await requireEditableRound(transaction, {
        buyingRoundId,
        now,
        organizationId,
      });
      const [membership] = await transaction
        .select({ role: memberships.role })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, organizationId),
            eq(memberships.userId, input.actor.userId),
            eq(memberships.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (membership?.role !== "OWNER") {
        throw new DemandConfirmationDeniedError();
      }

      const [submission] = await transaction
        .select({ id: demandSubmissions.id, status: demandSubmissions.status })
        .from(demandSubmissions)
        .where(
          and(
            eq(demandSubmissions.organizationId, organizationId),
            eq(demandSubmissions.buyingRoundId, buyingRoundId),
          ),
        )
        .limit(1);
      if (submission?.status === "CONFIRMED") {
        return { changed: false };
      }
      if (!submission) {
        throw new EmptyDemandSubmissionError();
      }

      const [itemCount] = await transaction
        .select({ count: demandItems.id })
        .from(demandItems)
        .where(
          and(
            eq(demandItems.organizationId, organizationId),
            eq(demandItems.submissionId, submission.id),
          ),
        )
        .limit(1);
      if (!itemCount) {
        throw new EmptyDemandSubmissionError();
      }

      const [confirmed] = await transaction
        .update(demandSubmissions)
        .set({
          confirmedAt: now,
          confirmedByUserId: input.actor.userId,
          status: "CONFIRMED",
        })
        .where(
          and(
            eq(demandSubmissions.id, submission.id),
            eq(demandSubmissions.organizationId, organizationId),
            eq(demandSubmissions.status, "DRAFT"),
          ),
        )
        .returning({ id: demandSubmissions.id });
      if (!confirmed) {
        return { changed: false };
      }

      await writeAuditEvent(transaction, {
        action: "DEMAND_SUBMISSION_CONFIRMED",
        actorUserId: input.actor.userId,
        objectId: submission.id,
        objectType: "demand_submission",
        organizationId,
      });
      return { changed: true };
    },
  );
}
