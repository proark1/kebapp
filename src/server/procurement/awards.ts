import "server-only";

// Lieferantenportal Stufe 1: Das Einkaufsteam (Plattform-Admin) vergibt den
// Auftrag einer Sammelrunde an einen Lieferanten (bestaetigter Preis je kg).
// Der Eintrag wird auf alle Runden-Klone derselben Region gespiegelt, damit
// jeder beteiligte Laden die Bestätigung in seinem Kontext sieht.

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { buyingRounds, roundAwards } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import {
  setAdminContext,
  setOrganizationContext,
} from "@/server/organizations/admin";
import { procurementIdSchema } from "@/server/procurement/validation";

export class AwardRoundNotFoundError extends Error {
  constructor() {
    super("Die Sammelrunde wurde nicht gefunden.");
    this.name = "AwardRoundNotFoundError";
  }
}

export const awardInputSchema = z.object({
  note: z.string().trim().max(500).optional(),
  roundId: procurementIdSchema,
  supplierName: z.string().trim().min(2).max(180),
  unitPriceCents: z.coerce.number().int().min(1).max(1_000_000),
});

export type AwardInput = z.input<typeof awardInputSchema>;

type AdminActor = { userId: string };

export async function awardRound(input: {
  actor: AdminActor;
  database?: KebappDatabase;
  input: AwardInput;
}): Promise<{ mirroredRounds: number }> {
  const parsed = awardInputSchema.parse(input.input);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);

    const [source] = await transaction
      .select({
        id: buyingRounds.id,
        organizationId: buyingRounds.organizationId,
        regionalKey: buyingRounds.regionalKey,
      })
      .from(buyingRounds)
      .where(eq(buyingRounds.id, parsed.roundId))
      .limit(1);
    if (!source) {
      throw new AwardRoundNotFoundError();
    }

    const clones = await transaction
      .select({
        id: buyingRounds.id,
        organizationId: buyingRounds.organizationId,
      })
      .from(buyingRounds)
      .where(eq(buyingRounds.regionalKey, source.regionalKey));

    const now = new Date();
    let lastOrganizationId = source.organizationId;

    for (const clone of clones) {
      lastOrganizationId = clone.organizationId;
      // Kontext je Klon setzen, damit die Schreib-Policy greift.
      await setOrganizationContext(transaction, clone.organizationId);
      await transaction
        .insert(roundAwards)
        .values({
          buyingRoundId: clone.id,
          createdByUserId: input.actor.userId,
          note: parsed.note ?? null,
          organizationId: clone.organizationId,
          regionalKey: source.regionalKey,
          supplierName: parsed.supplierName,
          unitPriceCents: parsed.unitPriceCents,
        })
        .onConflictDoUpdate({
          set: {
            note: parsed.note ?? null,
            regionalKey: source.regionalKey,
            supplierName: parsed.supplierName,
            unitPriceCents: parsed.unitPriceCents,
            updatedAt: now,
          },
          target: [
            roundAwards.organizationId,
            roundAwards.buyingRoundId,
          ],
        });
    }

    await setOrganizationContext(transaction, lastOrganizationId);
    await writeAuditEvent(transaction, {
      action: "ROUND_AWARDED",
      actorUserId: input.actor.userId,
      metadata: {
        mirroredRounds: clones.length,
        regionalKey: source.regionalKey,
        supplierName: parsed.supplierName,
        unitPriceCents: parsed.unitPriceCents,
      },
      objectId: source.id,
      objectType: "buying_round",
      organizationId: lastOrganizationId,
    });

    return { mirroredRounds: clones.length };
  });
}

export async function getRoundAward(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  organizationId: string;
  roundId: string;
}): Promise<{
  note: string | null;
  supplierName: string;
  unitPriceCents: number;
} | null> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const roundId = procurementIdSchema.parse(input.roundId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const [award] = await transaction
        .select({
          note: roundAwards.note,
          supplierName: roundAwards.supplierName,
          unitPriceCents: roundAwards.unitPriceCents,
        })
        .from(roundAwards)
        .where(
          and(
            eq(roundAwards.organizationId, organizationId),
            eq(roundAwards.buyingRoundId, roundId),
          ),
        )
        .limit(1);
      return award ?? null;
    },
  );
}
