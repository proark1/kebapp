import "server-only";

// Buchhaltung Stufe A: Eingangsrechnungen erfassen, als bezahlt markieren,
// vereinfachten DATEV-artigen Buchungsstapel und USt-Auswertung exportieren.

import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { incomingInvoices } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

type PersonnelActor = { userId: string };

const centsSchema = z.coerce.number().int().min(0).max(10_000_000_000);

export const invoiceInputSchema = z
  .object({
    documentDate: z.iso.date(),
    dueDate: z.iso.date().optional(),
    invoiceNumber: z.string().trim().min(1).max(80),
    netCents7: centsSchema,
    netCents19: centsSchema,
    supplierName: z.string().trim().min(2).max(180),
  })
  .refine((value) => value.netCents7 > 0 || value.netCents19 > 0, {
    message: "Mindestens ein Nettobetrag ist erforderlich.",
    path: ["netCents19"],
  });

export type InvoiceInput = z.input<typeof invoiceInputSchema>;

export async function upsertInvoice(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  input: InvoiceInput;
  supportReason?: string;
  organizationId: string;
}): Promise<void> {
  const parsed = invoiceInputSchema.parse(input.input);
  const organizationId = procurementIdSchema.parse(input.organizationId);

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const authorization = await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });
      const now = new Date();

      const [saved] = await transaction
        .insert(incomingInvoices)
        .values({
          createdByUserId: input.actor.userId,
          documentDate: parsed.documentDate,
          dueDate: parsed.dueDate ?? null,
          invoiceNumber: parsed.invoiceNumber,
          netCents7: parsed.netCents7,
          netCents19: parsed.netCents19,
          organizationId,
          supplierName: parsed.supplierName,
        })
        .onConflictDoUpdate({
          set: {
            documentDate: parsed.documentDate,
            dueDate: parsed.dueDate ?? null,
            netCents7: parsed.netCents7,
            netCents19: parsed.netCents19,
            updatedAt: now,
          },
          target: [
            incomingInvoices.organizationId,
            incomingInvoices.supplierName,
            incomingInvoices.invoiceNumber,
          ],
        })
        .returning({ id: incomingInvoices.id });

      if (authorization.kind === "SUPPORT") {
        await writeAuditEvent(transaction, {
          action: "SUPPORT_INVOICE_SAVED",
          actorUserId: input.actor.userId,
          metadata: { invoiceNumber: parsed.invoiceNumber },
          objectId: saved!.id,
          objectType: "incoming_invoice",
          organizationId,
          reason: authorization.reason,
        });
      }

      await writeAuditEvent(transaction, {
        action: "INVOICE_SAVED",
        actorUserId: input.actor.userId,
        metadata: {
          invoiceNumber: parsed.invoiceNumber,
          supplier: parsed.supplierName,
        },
        objectId: saved!.id,
        objectType: "incoming_invoice",
        organizationId,
      });
    },
  );
}

export async function markInvoicePaid(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  invoiceId: string;
  supportReason?: string;
  organizationId: string;
}): Promise<void> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const invoiceId = procurementIdSchema.parse(input.invoiceId);

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const authorization = await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });
      const [updated] = await transaction
        .update(incomingInvoices)
        .set({ paidAt: new Date(), status: "BEZAHLT" })
        .where(
          and(
            eq(incomingInvoices.id, invoiceId),
            eq(incomingInvoices.organizationId, organizationId),
          ),
        )
        .returning({ id: incomingInvoices.id });

      if (updated && authorization.kind === "SUPPORT") {
        await writeAuditEvent(transaction, {
          action: "SUPPORT_INVOICE_MARKED_PAID",
          actorUserId: input.actor.userId,
          objectId: updated.id,
          objectType: "incoming_invoice",
          organizationId,
          reason: authorization.reason,
        });
      }
      if (updated) {
        await writeAuditEvent(transaction, {
          action: "INVOICE_MARKED_PAID",
          actorUserId: input.actor.userId,
          objectId: updated.id,
          objectType: "incoming_invoice",
          organizationId,
        });
      }
    },
  );
}

export async function listInvoices(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  months?: number;
  organizationId: string;
}) {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const months = Math.min(Math.max(input.months ?? 3, 1), 24);
  const since = new Intl.DateTimeFormat("sv-SE").format(
    new Date(Date.now() - months * 30 * 86_400_000),
  );

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
        .from(incomingInvoices)
        .where(
          and(
            eq(incomingInvoices.organizationId, organizationId),
            gte(incomingInvoices.documentDate, since),
          ),
        )
        .orderBy(desc(incomingInvoices.documentDate));
      return rows;
    },
  );
}
