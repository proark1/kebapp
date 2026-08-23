import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  writeAuditEvent,
  writeDeniedAuditEvent,
} from "@/server/audit/write-audit-event";import type { KebappDatabase } from "@/server/db/client";
import { buyingRounds, demandSubmissions } from "@/server/db/schema";
import type { TenantTransaction } from "@/server/db/tenant-context";
import {
  setAdminContext,
  setOrganizationContext,
} from "@/server/organizations/admin";

export class RoundNotFoundError extends Error {
  constructor() {
    super("Die Sammelrunde wurde nicht gefunden.");
    this.name = "RoundNotFoundError";
  }
}

export class RoundTransitionError extends Error {
  constructor() {
    super("Dieser Rundenstatuswechsel ist nicht erlaubt.");
    this.name = "RoundTransitionError";
  }
}

export const pricingTierInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  minimumQuantity: z.coerce.number().finite().min(0).max(1_000_000),
  unitPrice: z.coerce.number().finite().min(0.01).max(100_000),
});

const tiersSchema = z
  .array(pricingTierInputSchema)
  .max(8, "Höchstens acht Preisstufen sind möglich.");

export const buyingRoundInputSchema = z
  .object({
    organizationId: z.uuid(),
    regionalKey: z.string().trim().min(2).max(120),
    name: z.string().trim().min(2).max(180),
    closesAt: z.coerce.date(),
    deliveryStartsAt: z.coerce.date(),
    deliveryEndsAt: z.coerce.date(),
    targetQuantity: z.coerce.number().finite().min(0.001).max(1_000_000),
    referenceUnitPrice: z.coerce.number().finite().min(0).max(100_000).optional(),
  })
  .refine((value) => value.closesAt.getTime() <= value.deliveryStartsAt.getTime(), {
    message: "Der Bestellschluss muss vor dem Lieferfenster liegen.",
    path: ["closesAt"],
  })
  .refine(
    (value) => value.deliveryStartsAt.getTime() < value.deliveryEndsAt.getTime(),
    {
      message: "Das Lieferfenster muss nach dem Bestellschluss enden.",
      path: ["deliveryEndsAt"],
    },
  );

export type BuyingRoundInput = z.input<typeof buyingRoundInputSchema> & {
  pricingTiers?: Array<{ label: string; minimumQuantity: number; unitPrice: number }>;
};

export class DuplicateTierThresholdError extends Error {
  constructor() {
    super(
      "Jede Preisstufe braucht eine eigene Mindestmenge.",
    );
    this.name = "DuplicateTierThresholdError";
  }
}

function normalizePricingTiers(
  input: BuyingRoundInput["pricingTiers"],
): Array<{ label: string; minimumQuantity: string; unitPrice: string }> {
  if (!input || input.length === 0) {
    return [];
  }
  const parsed = tiersSchema.parse(input);
  const seenThresholds = new Set<number>();
  for (const tier of parsed) {
    if (seenThresholds.has(tier.minimumQuantity)) {
      throw new DuplicateTierThresholdError();
    }
    seenThresholds.add(tier.minimumQuantity);
  }
  return [...parsed]
    .sort((first, second) => first.minimumQuantity - second.minimumQuantity)
    .map((tier) => ({
      label: tier.label,
      minimumQuantity: tier.minimumQuantity.toFixed(3),
      unitPrice: tier.unitPrice.toFixed(2),
    }));
}

const roundActionSchema = z.object({
  roundId: z.uuid(),
  action: z.enum(["OPEN", "CLOSE", "SUBMIT", "CANCEL"]),
  reason: z.string().trim().max(600).optional(),
});

export type RoundAdminRow = {
  closesAt: Date;
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  regionalKey: string;
  reminderSentAt: Date | null;
  status: "PLANNING" | "OPEN" | "CLOSED" | "SUBMITTED" | "CANCELLED";
  targetQuantity: string;
};

type AdminActor = { userId: string };

async function requireRound(
  transaction: TenantTransaction,
  roundId: string,
): Promise<{ closesAt: Date; id: string; organizationId: string; status: RoundAdminRow["status"] }> {
  const [round] = await transaction
    .select({
      closesAt: buyingRounds.closesAt,
      id: buyingRounds.id,
      organizationId: buyingRounds.organizationId,
      status: buyingRounds.status,
    })
    .from(buyingRounds)
    .where(eq(buyingRounds.id, roundId))
    .limit(1);
  if (!round) {
    throw new RoundNotFoundError();
  }
  return round;
}

const allowedTransitions: Record<
  "OPEN" | "CLOSE" | "SUBMIT" | "CANCEL",
  {
    from: RoundAdminRow["status"][];
    to: RoundAdminRow["status"];
  }
> = {
  OPEN: { from: ["PLANNING"], to: "OPEN" },
  CLOSE: { from: ["PLANNING", "OPEN"], to: "CLOSED" },
  SUBMIT: { from: ["CLOSED"], to: "SUBMITTED" },
  CANCEL: { from: ["PLANNING", "OPEN", "CLOSED"], to: "CANCELLED" },
};

export async function listBuyingRounds(input: {
  actor: AdminActor;
  database?: KebappDatabase;
}): Promise<RoundAdminRow[]> {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);

    const rows = await transaction
      .select({
        closesAt: buyingRounds.closesAt,
        id: buyingRounds.id,
        name: buyingRounds.name,
        organizationId: buyingRounds.organizationId,
        regionalKey: buyingRounds.regionalKey,
        reminderSentAt: buyingRounds.reminderSentAt,
        status: buyingRounds.status,
        targetQuantity: buyingRounds.targetQuantity,
        organizationName: sql<string>`coalesce(kebapp_private.admin_organization_name(${buyingRounds.organizationId}), 'Unbekannter Laden')`,
      })
      .from(buyingRounds)
      .orderBy(desc(buyingRounds.closesAt))
      .limit(200);

    return rows;
  });
}

export async function createBuyingRound(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  input: BuyingRoundInput;
}): Promise<{ roundId: string }> {
  const parsed = buyingRoundInputSchema.parse(input.input);
  const pricingTiers = normalizePricingTiers(input.input.pricingTiers);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    await setOrganizationContext(transaction, parsed.organizationId);

    const [created] = await transaction
      .insert(buyingRounds)
      .values({
        closesAt: parsed.closesAt,
        createdByUserId: input.actor.userId,
        deliveryEndsAt: parsed.deliveryEndsAt,
        deliveryStartsAt: parsed.deliveryStartsAt,
        name: parsed.name,
        organizationId: parsed.organizationId,
        pricingTiers,
        referenceUnitPrice:
          parsed.referenceUnitPrice !== undefined
            ? parsed.referenceUnitPrice.toFixed(2)
            : null,
        regionalKey: parsed.regionalKey,
        status: "PLANNING",
        targetQuantity: parsed.targetQuantity.toFixed(3),
      })
      .returning({ id: buyingRounds.id });

    await writeAuditEvent(transaction, {
      action: "BUYING_ROUND_CREATED",
      actorUserId: input.actor.userId,
      metadata: {
        closesAt: parsed.closesAt.toISOString(),
        name: parsed.name,
        pricingTierCount: pricingTiers.length,
        regionalKey: parsed.regionalKey,
      },
      objectId: created!.id,
      objectType: "buying_round",
      organizationId: parsed.organizationId,
    });

    return { roundId: created!.id };
  });
}

export type RoundCloneTemplate = {
  name: string;
  organizationId: string;
  pricingTiers: Array<{
    label: string;
    minimumQuantity: string;
    unitPrice: string;
  }>;
  referenceUnitPrice: number | null;
  regionalKey: string;
  targetQuantity: number;
};

export async function getRoundCloneTemplate(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  roundId: string;
}): Promise<RoundCloneTemplate> {
  const detail = await getBuyingRoundDetail({
    actor: input.actor,
    database: input.database,
    roundId: input.roundId,
  });
  const { detail: round } = detail;

  return {
    name: `${round.name} · Folgerunde`,
    organizationId: round.organizationId,
    pricingTiers: round.pricingTiers.map((tier) => ({
      label: tier.label,
      minimumQuantity: String(Number(tier.minimumQuantity)),
      unitPrice: String(Number(tier.unitPrice)),
    })),
    referenceUnitPrice:
      round.referenceUnitPrice === null
        ? null
        : Number(round.referenceUnitPrice),
    regionalKey: round.regionalKey,
    targetQuantity: Number(round.targetQuantity),
  };
}

export async function transitionBuyingRound(input: {
  action: "OPEN" | "CLOSE" | "SUBMIT" | "CANCEL";
  actor: AdminActor;
  database?: KebappDatabase;
  reason?: string;
  roundId: string;
}): Promise<{ changed: boolean; to: RoundAdminRow["status"] }> {
  const parsed = roundActionSchema.parse({
    action: input.action,
    reason: input.reason,
    roundId: input.roundId,
  });
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  const outcome = await database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const round = await requireRound(transaction, parsed.roundId);

    const transition = allowedTransitions[parsed.action];
    if (!transition.from.includes(round.status)) {
      // Kennzeichen statt Throw: der Denial muss die Transaktion überleben.
      return {
        changed: false as const,
        denied: true as const,
        organizationId: round.organizationId,
        from: round.status,
        to: transition.to,
      };
    }

    await setOrganizationContext(transaction, round.organizationId);

    if (round.status === transition.to) {
      return { changed: false as const, denied: false as const, to: transition.to };
    }

    const [updated] = await transaction
      .update(buyingRounds)
      .set({ status: transition.to })
      .where(
        and(
          eq(buyingRounds.id, round.id),
          eq(buyingRounds.status, round.status),
        ),
      )
      .returning({ id: buyingRounds.id });

    if (!updated) {
      return {
        changed: false as const,
        denied: true as const,
        organizationId: round.organizationId,
        from: round.status,
        to: transition.to,
      };
    }

    await writeAuditEvent(transaction, {
      action: "BUYING_ROUND_STATUS_CHANGED",
      actorUserId: input.actor.userId,
      metadata: { from: round.status, to: transition.to },
      objectId: round.id,
      objectType: "buying_round",
      organizationId: round.organizationId,
      reason: parsed.reason,
    });

    return { changed: true as const, denied: false as const, to: transition.to };
  });

  if (outcome.denied) {
    // Denials in eigener Transaktion sichern, damit der Rollback des
    // Hauptvorgangs sie nicht wieder löscht.
    try {
      await database.transaction(async (transaction) => {
        await setAdminContext(transaction, input.actor);
        await setOrganizationContext(
          transaction,
          outcome.organizationId!,
        );
        await writeDeniedAuditEvent(transaction, {
          action: "BUYING_ROUND_TRANSITION_DENIED",
          actorUserId: input.actor.userId,
          metadata: { attempted: parsed.action, from: outcome.from },
          objectType: "buying_round",
          organizationId: outcome.organizationId!,
          reason: parsed.reason,
        });
      });
    } catch {
      console.error("Kebapp konnte ein Runden-Denial nicht auditieren.");
    }
    throw new RoundTransitionError();
  }

  return { changed: outcome.changed, to: outcome.to };
}

export async function listActiveOrganizations(input: {
  actor: AdminActor;
  database?: KebappDatabase;
}): Promise<Array<{ organizationId: string; organizationName: string }>> {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const result = await transaction.execute<{
      organization_id: string;
      organization_name: string;
    }>(sql`
      select * from kebapp_private.admin_active_organizations()
    `);
    return result.rows.map((row) => ({
      organizationId: row.organization_id,
      organizationName: row.organization_name,
    }));
  });
}

export async function getBuyingRoundDetail(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  roundId: string;
}) {
  const roundId = z.uuid().parse(input.roundId);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const round = await requireRound(transaction, roundId);
    await setOrganizationContext(transaction, round.organizationId);

    const [detail] = await transaction
      .select({
        closesAt: buyingRounds.closesAt,
        deliveryEndsAt: buyingRounds.deliveryEndsAt,
        deliveryStartsAt: buyingRounds.deliveryStartsAt,
        id: buyingRounds.id,
        name: buyingRounds.name,
        organizationId: buyingRounds.organizationId,
        pricingTiers: buyingRounds.pricingTiers,
        referenceUnitPrice: buyingRounds.referenceUnitPrice,
        regionalKey: buyingRounds.regionalKey,
        reminderSentAt: buyingRounds.reminderSentAt,
        status: buyingRounds.status,
        targetQuantity: buyingRounds.targetQuantity,
        organizationName: sql<string>`coalesce(kebapp_private.admin_organization_name(${buyingRounds.organizationId}), 'Unbekannter Laden')`,
      })
      .from(buyingRounds)
      .where(eq(buyingRounds.id, round.id))
      .limit(1);

    const submissionCounts = await transaction
      .select({
        status: demandSubmissions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(demandSubmissions)
      .where(eq(demandSubmissions.buyingRoundId, round.id))
      .groupBy(demandSubmissions.status);

    const bundle = await getConfirmedRoundBundle(transaction, round.id);

    return { bundle, detail, submissionCounts };
  });
}

export async function getConfirmedRoundBundle(
  transaction: TenantTransaction,
  roundId: string,
): Promise<
  Array<{
    productName: string;
    specification: string;
    unit: string;
    totalQuantity: string;
    positionCount: number;
    shopCount: number;
  }>
> {
  const result = await transaction.execute<{
    product_name: string;
    specification: string;
    unit: string;
    total_quantity: string;
    position_count: string;
    shop_count: string;
  }>(sql`
    select * from kebapp_private.round_bundle(${roundId}::uuid)
  `);

  return result.rows.map((row) => ({
    positionCount: Number(row.position_count),
    productName: row.product_name,
    shopCount: Number(row.shop_count),
    specification: row.specification,
    totalQuantity: row.total_quantity,
    unit: row.unit,
  }));
}
