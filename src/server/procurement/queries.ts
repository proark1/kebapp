import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DemandItem, DemandPlanningData, PriceTier } from "@/lib/types";
import type { KebappDatabase } from "@/server/db/client";
import {
  buyingRounds,
  demandItems,
  demandSubmissions,
  memberships,
} from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import { procurementIdSchema } from "@/server/procurement/validation";

const deliveryFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "long",
  timeZone: "Europe/Berlin",
});
const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

function toPriceTiers(
  tiers: Array<{
    label: string;
    minimumQuantity: string;
    unitPrice: string;
  }>,
  referencePrice: number,
): PriceTier[] {
  const parsed = tiers.flatMap((tier) => {
    const minKg = Number(tier.minimumQuantity);
    const pricePerKg = Number(tier.unitPrice);
    return Number.isFinite(minKg) && Number.isFinite(pricePerKg)
      ? [{ label: tier.label, minKg, pricePerKg }]
      : [];
  });

  return parsed.length > 0
    ? parsed
    : [{ label: "Richtpreis", minKg: 0, pricePerKg: referencePrice }];
}

function toDemandItem(row: {
  id: string;
  productName: string;
  specification: string | null;
  quantity: string;
  requestedDeliveryDate: string;
  unit: "KG" | "PIECE";
}): DemandItem {
  return {
    amount: Number(row.quantity),
    deliveryDate: row.requestedDeliveryDate,
    id: row.id,
    product: row.productName,
    specification: row.specification ?? "Standardspezifikation",
    unit: row.unit === "KG" ? "kg" : "Stück",
  };
}

export async function getDemandPlanning(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  now?: Date;
  organizationId: string;
}): Promise<DemandPlanningData | null> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const now = input.now ?? new Date();

  return withTenantContext(
    {
      actor: input.actor,
      database: input.database,
      organizationId,
    },
    async (transaction) => {
      const [round] = await transaction
        .select({
          closesAt: buyingRounds.closesAt,
          deliveryEndsAt: buyingRounds.deliveryEndsAt,
          deliveryStartsAt: buyingRounds.deliveryStartsAt,
          id: buyingRounds.id,
          name: buyingRounds.name,
          pricingTiers: buyingRounds.pricingTiers,
          referenceUnitPrice: buyingRounds.referenceUnitPrice,
          regionalKey: buyingRounds.regionalKey,
          status: buyingRounds.status,
          targetQuantity: buyingRounds.targetQuantity,
        })
        .from(buyingRounds)
        .where(
          and(
            eq(buyingRounds.organizationId, organizationId),
            inArray(buyingRounds.status, ["OPEN", "CLOSED", "SUBMITTED"]),
          ),
        )
        .orderBy(
          desc(sql`case when ${buyingRounds.status} = 'OPEN' then 1 else 0 end`),
          desc(buyingRounds.closesAt),
        )
        .limit(1);

      if (!round) {
        return null;
      }

      const [submission] = await transaction
        .select({ id: demandSubmissions.id, status: demandSubmissions.status })
        .from(demandSubmissions)
        .where(
          and(
            eq(demandSubmissions.organizationId, organizationId),
            eq(demandSubmissions.buyingRoundId, round.id),
          ),
        )
        .limit(1);
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
      const regionalTotal = await transaction.execute<{ quantity: string }>(sql`
        select kebapp_private.regional_confirmed_demand_kg(
          ${organizationId}::uuid,
          ${round.id}::uuid
        )::text as quantity
      `);

      const itemRows = submission
        ? await transaction
            .select({
              id: demandItems.id,
              productName: demandItems.productName,
              quantity: demandItems.quantity,
              requestedDeliveryDate: demandItems.requestedDeliveryDate,
              specification: demandItems.specification,
              unit: demandItems.unit,
            })
            .from(demandItems)
            .where(
              and(
                eq(demandItems.organizationId, organizationId),
                eq(demandItems.submissionId, submission.id),
              ),
            )
            .orderBy(demandItems.createdAt)
        : [];
      const submissionStatus = submission?.status ?? "DRAFT";
      const editable =
        round.status === "OPEN" &&
        round.closesAt.getTime() > now.getTime() &&
        submissionStatus === "DRAFT";
      const referencePrice = Number(round.referenceUnitPrice ?? 0);

      return {
        canConfirm:
          editable && membership?.role === "OWNER" && itemRows.length > 0,
        editable,
        items: itemRows.map(toDemandItem),
        round: {
          closesAt: round.closesAt.toISOString(),
          committedKgWithoutStore: Number(regionalTotal.rows[0]?.quantity ?? 0),
          deliveryDate: round.deliveryStartsAt.toISOString().slice(0, 10),
          deliveryWindow: `${deliveryFormatter.format(round.deliveryStartsAt)} · ${timeFormatter.format(round.deliveryStartsAt)}–${timeFormatter.format(round.deliveryEndsAt)} Uhr`,
          id: round.id,
          name: round.name,
          referencePricePerKg: referencePrice,
          regionalKey: round.regionalKey,
          status: round.status,
          targetKg: Number(round.targetQuantity),
          tiers: toPriceTiers(round.pricingTiers, referencePrice),
        },
        submissionStatus,
      };
    },
  );
}
