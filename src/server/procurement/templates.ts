import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { KebappDatabase } from "@/server/db/client";
import {
  buyingRounds,
  demandItems,
  demandSubmissions,
  demandTemplateItems,
  demandTemplates,
} from "@/server/db/schema";
import {
  type TenantTransaction,
  withTenantContext,
} from "@/server/db/tenant-context";
import {
  DemandLockedError,
  EmptyDemandSubmissionError,
} from "@/server/procurement/mutations";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

export class TemplateNotFoundError extends Error {
  constructor() {
    super("Es wurde noch kein Stammbedarf gespeichert.");
    this.name = "TemplateNotFoundError";
  }
}

type ProcurementActor = { userId: string };

async function getOrCreateTemplate(
  transaction: TenantTransaction,
  organizationId: string,
) {
  const [existing] = await transaction
    .select({ id: demandTemplates.id })
    .from(demandTemplates)
    .where(eq(demandTemplates.organizationId, organizationId))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await transaction
    .insert(demandTemplates)
    .values({ name: "Stammbedarf", organizationId })
    .onConflictDoNothing({
      target: demandTemplates.organizationId,
    })
    .returning({ id: demandTemplates.id });
  if (created) {
    return created;
  }

  const [concurrent] = await transaction
    .select({ id: demandTemplates.id })
    .from(demandTemplates)
    .where(eq(demandTemplates.organizationId, organizationId))
    .limit(1);
  if (!concurrent) {
    throw new TemplateNotFoundError();
  }
  return concurrent;
}

export async function saveDemandTemplate(input: {
  actor: ProcurementActor;
  database?: KebappDatabase;
  now?: Date;
  organizationId: string;
  supportReason?: string;
}): Promise<{ itemCount: number }> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const now = input.now ?? new Date();

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });

      // Vorlage entsteht aus dem zuletzt geänderten Entwurf (aktuelle oder
      // letzte Runde), damit bestätigte Historie nicht versehentlich kopiert
      // wird.
      const [sourceSubmission] = await transaction
        .select({ id: demandSubmissions.id })
        .from(demandSubmissions)
        .innerJoin(
          buyingRounds,
          eq(buyingRounds.id, demandSubmissions.buyingRoundId),
        )
        .where(eq(demandSubmissions.organizationId, organizationId))
        .orderBy(
          sql`case when ${demandSubmissions.status} = 'DRAFT' then 1 else 0 end`,
          descByUpdatedAt(),
        )
        .limit(1);

      if (!sourceSubmission) {
        throw new EmptyDemandSubmissionError();
      }

      const sourceItems = await transaction
        .select({
          productName: demandItems.productName,
          quantity: demandItems.quantity,
          specification: demandItems.specification,
          unit: demandItems.unit,
        })
        .from(demandItems)
        .where(
          and(
            eq(demandItems.organizationId, organizationId),
            eq(demandItems.submissionId, sourceSubmission.id),
          ),
        )
        .orderBy(demandItems.createdAt);

      if (sourceItems.length === 0) {
        throw new EmptyDemandSubmissionError();
      }

      const template = await getOrCreateTemplate(transaction, organizationId);

      await transaction
        .delete(demandTemplateItems)
        .where(
          eq(demandTemplateItems.templateId, template.id),
        );

      await transaction.insert(demandTemplateItems).values(
        sourceItems.map((item) => ({
          organizationId,
          productName: item.productName,
          quantity: item.quantity,
          specification: item.specification,
          templateId: template.id,
          unit: item.unit,
        })),
      );
      await touchTemplate(transaction, template.id, now);

      return { itemCount: sourceItems.length };
    },
  );
}

function descByUpdatedAt() {
  return sql`greatest(${demandSubmissions.updatedAt}, coalesce(${demandSubmissions.confirmedAt}, ${demandSubmissions.updatedAt})) desc`;
}

async function touchTemplate(
  transaction: TenantTransaction,
  templateId: string,
  now: Date,
) {
  await transaction
    .update(demandTemplates)
    .set({ updatedAt: now })
    .where(eq(demandTemplates.id, templateId));
}

export async function applyDemandTemplate(input: {
  actor: ProcurementActor;
  buyingRoundId: string;
  database?: KebappDatabase;
  defaultDeliveryDate: string;
  estimatedUnitPrice?: string | null;
  now?: Date;
  organizationId: string;
  requestedDeliveryDate?: string;
  supportReason?: string;
}): Promise<{ addedItemCount: number; skippedItemCount: number }> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const buyingRoundId = procurementIdSchema.parse(input.buyingRoundId);
  const deliveryDate = z.iso.date().parse(
    input.requestedDeliveryDate ?? input.defaultDeliveryDate,
  );
  const now = input.now ?? new Date();

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });

      const [round] = await transaction
        .select({
          closesAt: buyingRounds.closesAt,
          referenceUnitPrice: buyingRounds.referenceUnitPrice,
          status: buyingRounds.status,
        })
        .from(buyingRounds)
        .where(
          and(
            eq(buyingRounds.id, buyingRoundId),
            eq(buyingRounds.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (
        !round ||
        round.status !== "OPEN" ||
        round.closesAt.getTime() <= now.getTime()
      ) {
        throw new DemandLockedError();
      }

      const [template] = await transaction
        .select({ id: demandTemplates.id })
        .from(demandTemplates)
        .where(eq(demandTemplates.organizationId, organizationId))
        .limit(1);
      if (!template) {
        throw new TemplateNotFoundError();
      }

      const templateItems = await transaction
        .select({
          productName: demandTemplateItems.productName,
          quantity: demandTemplateItems.quantity,
          specification: demandTemplateItems.specification,
          unit: demandTemplateItems.unit,
        })
        .from(demandTemplateItems)
        .where(eq(demandTemplateItems.templateId, template.id))
        .orderBy(demandTemplateItems.createdAt);

      if (templateItems.length === 0) {
        throw new TemplateNotFoundError();
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
        throw new DemandLockedError();
      }

      let submissionId = submission?.id;
      if (!submissionId) {
        const [created] = await transaction
          .insert(demandSubmissions)
          .values({
            buyingRoundId,
            organizationId,
            status: "DRAFT",
          })
          .onConflictDoNothing({
            target: [
              demandSubmissions.organizationId,
              demandSubmissions.buyingRoundId,
            ],
          })
          .returning({ id: demandSubmissions.id });
        if (created) {
          submissionId = created.id;
        } else {
          const [raced] = await transaction
            .select({ id: demandSubmissions.id })
            .from(demandSubmissions)
            .where(
              and(
                eq(demandSubmissions.organizationId, organizationId),
                eq(demandSubmissions.buyingRoundId, buyingRoundId),
              ),
            )
            .limit(1);
          if (!raced) {
            throw new DemandLockedError();
          }
          submissionId = raced.id;
        }
      }

      const existingItems = await transaction
        .select({
          productName: demandItems.productName,
          specification: demandItems.specification,
        })
        .from(demandItems)
        .where(
          and(
            eq(demandItems.organizationId, organizationId),
            eq(demandItems.submissionId, submissionId!),
          ),
        );

      const existingKeys = new Set(
        existingItems.map((item) =>
          `${item.productName}::${item.specification ?? ""}`,
        ),
      );

      const toAdd = templateItems.filter((item) => {
        const key = `${item.productName}::${item.specification ?? ""}`;
        return !existingKeys.has(key);
      });

      if (toAdd.length > 0) {
        await transaction.insert(demandItems).values(
          toAdd.map((item) => ({
            currency: "EUR",
            estimatedUnitPrice:
              input.estimatedUnitPrice ?? round.referenceUnitPrice,
            organizationId,
            productName: item.productName,
            quantity: item.quantity,
            requestedDeliveryDate: deliveryDate,
            specification: item.specification,
            submissionId: submissionId!,
            unit: item.unit,
          })),
        );
      }

      return {
        addedItemCount: toAdd.length,
        skippedItemCount: templateItems.length - toAdd.length,
      };
    },
  );
}

export async function getDemandTemplateSummary(input: {
  actor: ProcurementActor;
  database?: KebappDatabase;
  organizationId: string;
}): Promise<{ exists: boolean; itemCount: number } | null> {
  const organizationId = procurementIdSchema.parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const [template] = await transaction
        .select({ id: demandTemplates.id })
        .from(demandTemplates)
        .where(eq(demandTemplates.organizationId, organizationId))
        .limit(1);
      if (!template) {
        return { exists: false, itemCount: 0 };
      }

      const [count] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(demandTemplateItems)
        .where(eq(demandTemplateItems.templateId, template.id));

      return { exists: true, itemCount: count?.count ?? 0 };
    },
  );
}
