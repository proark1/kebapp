import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import {
  buyingRounds,
  demandItems,
  demandSubmissions,
  goodsReceiptItems,
  goodsReceipts,
} from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import type { TenantTransaction } from "@/server/db/tenant-context";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

export class ReceiptRoundNotAllowedError extends Error {
  constructor() {
    super(
      "Wareneingang kann erst nach dem Abschluss der Sammelrunde erfasst werden.",
    );
    this.name = "ReceiptRoundNotAllowedError";
  }
}

export class ReceiptNotFoundError extends Error {
  constructor() {
    super("Der Wareneingang oder die Runde wurde nicht gefunden.");
    this.name = "ReceiptNotFoundError";
  }
}

type ProcurementActor = { userId: string };

const receiptQuantitySchema = z.coerce
  .number()
  .finite()
  .min(0)
  .max(100_000);

const reasonSchema = z.enum(["SHORTAGE", "QUALITY", "WRONG_ITEM", "OTHER"]);

export const receiptLineInputSchema = z.object({
  demandItemId: procurementIdSchema,
  receivedQuantity: receiptQuantitySchema,
  reasonNote: z.string().trim().max(300).optional(),
  reason: reasonSchema.optional(),
});

export const saveReceiptInputSchema = z.object({
  buyingRoundId: procurementIdSchema,
  lines: z.array(receiptLineInputSchema).min(1).max(200),
  note: z.string().trim().max(2_000).optional(),
});

export type SaveReceiptInput = z.input<typeof saveReceiptInputSchema>;

async function requireFinalizedRound(
  transaction: TenantTransaction,
  input: { buyingRoundId: string; organizationId: string },
) {
  const [round] = await transaction
    .select({
      closesAt: buyingRounds.closesAt,
      deliveryEndsAt: buyingRounds.deliveryEndsAt,
      id: buyingRounds.id,
      name: buyingRounds.name,
      status: buyingRounds.status,
    })
    .from(buyingRounds)
    .where(
      and(
        eq(buyingRounds.id, input.buyingRoundId),
        eq(buyingRounds.organizationId, input.organizationId),
        inArray(buyingRounds.status, ["CLOSED", "SUBMITTED"]),
      ),
    )
    .limit(1);
  if (!round) {
    throw new ReceiptRoundNotAllowedError();
  }
  return round;
}

export async function listReceiptRounds(input: {
  actor: ProcurementActor;
  database?: KebappDatabase;
  organizationId: string;
}): Promise<
  Array<{
    buyingRoundId: string;
    closesAt: Date;
    deliveryWindowEnd: Date;
    name: string;
    receiptSavedAt: Date | null;
    status: "CLOSED" | "SUBMITTED";
  }>
> {
  const organizationId = procurementIdSchema.parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
      });

      const rounds = await transaction
        .select({
          buyingRoundId: buyingRounds.id,
          closesAt: buyingRounds.closesAt,
          deliveryWindowEnd: buyingRounds.deliveryEndsAt,
          name: buyingRounds.name,
          status: buyingRounds.status,
          receiptSavedAt: goodsReceipts.updatedAt,
        })
        .from(buyingRounds)
        .leftJoin(
          goodsReceipts,
          and(
            eq(goodsReceipts.buyingRoundId, buyingRounds.id),
            eq(goodsReceipts.organizationId, buyingRounds.organizationId),
          ),
        )
        .where(
          and(
            eq(buyingRounds.organizationId, organizationId),
            inArray(buyingRounds.status, ["CLOSED", "SUBMITTED"]),
          ),
        )
        .orderBy(desc(buyingRounds.closesAt))
        .limit(24);

      return rounds.map((round) => ({
        ...round,
        status: round.status as "CLOSED" | "SUBMITTED",
      }));
    },
  );
}

export async function getGoodsReceipt(input: {
  actor: ProcurementActor;
  buyingRoundId: string;
  database?: KebappDatabase;
  organizationId: string;
}) {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const buyingRoundId = procurementIdSchema.parse(input.buyingRoundId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
      });
      const round = await requireFinalizedRound(transaction, {
        buyingRoundId,
        organizationId,
      });

      const [submission] = await transaction
        .select({ id: demandSubmissions.id })
        .from(demandSubmissions)
        .where(
          and(
            eq(demandSubmissions.buyingRoundId, buyingRoundId),
            eq(demandSubmissions.organizationId, organizationId),
            eq(demandSubmissions.status, "CONFIRMED"),
          ),
        )
        .limit(1);
      if (!submission) {
        throw new ReceiptNotFoundError();
      }

      const orderedLines = await transaction
        .select({
          demandItemId: demandItems.id,
          orderedQuantity: demandItems.quantity,
          productName: demandItems.productName,
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
        .orderBy(demandItems.createdAt);

      const [receipt] = await transaction
        .select({
          id: goodsReceipts.id,
          note: goodsReceipts.note,
          savedByUserId: goodsReceipts.savedByUserId,
          updatedAt: goodsReceipts.updatedAt,
        })
        .from(goodsReceipts)
        .where(
          and(
            eq(goodsReceipts.buyingRoundId, buyingRoundId),
            eq(goodsReceipts.organizationId, organizationId),
          ),
        )
        .limit(1);

      const savedLines = receipt
        ? await transaction
            .select({
              demandItemId: goodsReceiptItems.demandItemId,
              missingReason: goodsReceiptItems.missingReason,
              reasonNote: goodsReceiptItems.reasonNote,
              receivedQuantity: goodsReceiptItems.receivedQuantity,
            })
            .from(goodsReceiptItems)
            .where(eq(goodsReceiptItems.receiptId, receipt.id))
        : [];

      const lineMap = new Map(
        savedLines
          .filter((line) => line.demandItemId !== null)
          .map((line) => [line.demandItemId!, line]),
      );

      return {
        note: receipt?.note ?? "",
        round: {
          closesAt: round.closesAt.toISOString(),
          deliveryWindowEnd: round.deliveryEndsAt.toISOString(),
          id: round.id,
          name: round.name,
          status: round.status as "CLOSED" | "SUBMITTED",
        },
        savedAt: receipt?.updatedAt?.toISOString() ?? null,
        lines: orderedLines.map((line) => {
          const saved = lineMap.get(line.demandItemId);
          return {
            demandItemId: line.demandItemId,
            missingReason: saved?.missingReason ?? null,
            orderedQuantity: Number(line.orderedQuantity),
            productName: line.productName,
            reasonNote: saved?.reasonNote ?? "",
            receivedQuantity:
              saved === undefined ? null : Number(saved.receivedQuantity),
            specification: line.specification ?? "Standardspezifikation",
            unit: line.unit === "KG" ? ("kg" as const) : ("Stück" as const),
          };
        }),
      };
    },
  );
}

export async function saveGoodsReceipt(input: {
  actor: ProcurementActor;
  database?: KebappDatabase;
  input: SaveReceiptInput;
  now?: Date;
  organizationId: string;
  supportReason?: string;
}): Promise<{ itemCount: number }> {
  const parsed = saveReceiptInputSchema.parse(input.input);
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const now = input.now ?? new Date();

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const authorization = await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });
      const round = await requireFinalizedRound(transaction, {
        buyingRoundId: parsed.buyingRoundId,
        organizationId,
      });

      const [submission] = await transaction
        .select({ id: demandSubmissions.id })
        .from(demandSubmissions)
        .where(
          and(
            eq(demandSubmissions.buyingRoundId, round.id),
            eq(demandSubmissions.organizationId, organizationId),
            eq(demandSubmissions.status, "CONFIRMED"),
          ),
        )
        .limit(1);
      if (!submission) {
        throw new ReceiptNotFoundError();
      }

      const confirmedItems = await transaction
        .select({
          id: demandItems.id,
          productName: demandItems.productName,
          quantity: demandItems.quantity,
          specification: demandItems.specification,
          unit: demandItems.unit,
        })
        .from(demandItems)
        .where(
          and(
            eq(demandItems.organizationId, organizationId),
            eq(demandItems.submissionId, submission.id),
          ),
        );

      const itemById = new Map(confirmedItems.map((item) => [item.id, item]));
      for (const line of parsed.lines) {
        if (!itemById.has(line.demandItemId)) {
          throw new ReceiptNotFoundError();
        }
      }

      await transaction
        .insert(goodsReceipts)
        .values({
          buyingRoundId: round.id,
          note: parsed.note ?? null,
          organizationId,
          savedByUserId: input.actor.userId,
        })
        .onConflictDoUpdate({
          set: {
            note: parsed.note ?? null,
            savedByUserId: input.actor.userId,
            updatedAt: now,
          },
          target: [
            goodsReceipts.organizationId,
            goodsReceipts.buyingRoundId,
          ],
        })
        .returning({ id: goodsReceipts.id });

      const [receipt] = await transaction
        .select({ id: goodsReceipts.id })
        .from(goodsReceipts)
        .where(
          and(
            eq(goodsReceipts.buyingRoundId, round.id),
            eq(goodsReceipts.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!receipt) {
        throw new ReceiptNotFoundError();
      }

      await transaction
        .delete(goodsReceiptItems)
        .where(eq(goodsReceiptItems.receiptId, receipt.id));

      await transaction.insert(goodsReceiptItems).values(
        parsed.lines.map((line) => {
          const source = itemById.get(line.demandItemId)!;
          return {
            demandItemId: line.demandItemId,
            missingReason: line.reason ?? null,
            organizationId,
            orderedQuantity: source.quantity,
            productName: source.productName,
            reasonNote: line.reasonNote || null,
            receiptId: receipt.id,
            receivedQuantity: line.receivedQuantity.toFixed(3),
            specification: source.specification,
            unit: source.unit,
          };
        }),
      );

      if (authorization.kind === "SUPPORT") {
        await writeAuditEvent(transaction, {
          action: "SUPPORT_GOODS_RECEIPT_SAVED",
          actorUserId: input.actor.userId,
          metadata: { lineCount: parsed.lines.length },
          objectId: receipt.id,
          objectType: "goods_receipt",
          organizationId,
          reason: authorization.reason,
        });
      }

      await writeAuditEvent(transaction, {
        action: "GOODS_RECEIPT_SAVED",
        actorUserId: input.actor.userId,
        metadata: {
          lineCount: parsed.lines.length,
          roundName: round.name,
        },
        objectId: receipt.id,
        objectType: "goods_receipt",
        organizationId,
      });

      return { itemCount: parsed.lines.length };
    },
  );
}
