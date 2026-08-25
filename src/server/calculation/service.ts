import "server-only";

// Kalkulation (Lager/Kalkulation Stufe 1): Wareneinsatz je Gericht.
// Zutaten werden als Zeilen erfasst (Name;Menge;Einkaufspreis je Einheit),
// der Server rechnet den Waren-Einsatz und die Marge zum Verkaufspreis.

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { menuCalculations } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

type PersonnelActor = { userId: string };

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().finite().min(0.001).max(10_000),
  unitPriceCents: z.coerce.number().int().min(0).max(100_000_000),
});

export const calculationInputSchema = z.object({
  ingredients: z.array(ingredientSchema).min(1).max(30),
  menuItemKey: z.string().trim().min(1).max(80),
  menuName: z.string().trim().min(2).max(180),
  salePriceCents: z.coerce.number().int().min(0).max(100_000).optional(),
});

export type CalculationInput = z.input<typeof calculationInputSchema>;

export function computeTotalCents(
  ingredients: Array<{ quantity: number; unitPriceCents: number }>,
): number {
  return ingredients.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0,
  );
}

export async function upsertCalculation(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  input: CalculationInput;
  supportReason?: string;
  organizationId: string;
}): Promise<{ totalCostCents: number }> {
  const parsed = calculationInputSchema.parse(input.input);
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const totalCostCents = computeTotalCents(parsed.ingredients);
  const now = new Date();

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const authorization = await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });

      const [saved] = await transaction
        .insert(menuCalculations)
        .values({
          createdByUserId: input.actor.userId,
          ingredients: parsed.ingredients,
          menuItemKey: parsed.menuItemKey,
          menuName: parsed.menuName,
          organizationId,
          salePriceCents: parsed.salePriceCents ?? null,
          totalCostCents,
        })
        .onConflictDoUpdate({
          set: {
            ingredients: parsed.ingredients,
            menuName: parsed.menuName,
            salePriceCents: parsed.salePriceCents ?? null,
            totalCostCents,
            updatedAt: now,
          },
          target: [
            menuCalculations.organizationId,
            menuCalculations.menuItemKey,
          ],
        })
        .returning({ id: menuCalculations.id });

      if (authorization.kind === "SUPPORT") {
        await writeAuditEvent(transaction, {
          action: "SUPPORT_CALCULATION_SAVED",
          actorUserId: input.actor.userId,
          metadata: { menuName: parsed.menuName, totalCostCents },
          objectId: saved!.id,
          objectType: "menu_calculation",
          organizationId,
          reason: authorization.reason,
        });
      }

      await writeAuditEvent(transaction, {
        action: "CALCULATION_SAVED",
        actorUserId: input.actor.userId,
        metadata: { menuName: parsed.menuName, totalCostCents },
        objectId: saved!.id,
        objectType: "menu_calculation",
        organizationId,
      });
    },
  );

  return { totalCostCents };
}

export type CalculationRow = {
  ingredients: Array<{ name: string; quantity: number; unitPriceCents: number }>;
  marginCents: number | null;
  marginPercent: number | null;
  menuKey: string;
  menuName: string;
  salePriceCents: number | null;
  totalCostCents: number;
};

export async function listCalculations(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  organizationId: string;
}): Promise<CalculationRow[]> {
  const organizationId = procurementIdSchema.parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
      });
      const rows = await transaction
        .select()
        .from(menuCalculations)
        .where(eq(menuCalculations.organizationId, organizationId))
        .orderBy(desc(menuCalculations.updatedAt));

      return rows.map((row) => {
        const marginCents =
          row.salePriceCents === null ? null : row.salePriceCents - row.totalCostCents;
        const marginPercent =
          row.salePriceCents && row.salePriceCents > 0
            ? Math.round((marginCents! / row.salePriceCents) * 100)
            : null;
        return {
          ingredients: row.ingredients,
          marginCents,
          marginPercent,
          menuKey: row.menuItemKey,
          menuName: row.menuName,
          salePriceCents: row.salePriceCents,
          totalCostCents: row.totalCostCents,
        };
      });
    },
  );
}
