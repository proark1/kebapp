import "server-only";

// Buchhaltung Stufe A: Eingangsrechnungen erfassen, als bezahlt markieren,
// vereinfachten DATEV-artigen Buchungsstapel und USt-Auswertung exportieren.

import { and, desc, eq, gte, lte } from "drizzle-orm";
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
    category: z.enum(["FLEISCH","GEMUESE","TROCKEN","GETRAENKE","VERPACKUNG","SONSTIGES"]).default("SONSTIGES"),
    // Das abfotografierte Original als data-URL. Es geht nur mit, wenn
    // die Buchung aus dem Belegscan stammt.
    receiptImage: z
      .string()
      .max(2_600_000)
      .regex(/^data:image\/(jpeg|png|webp|bmp);base64,[A-Za-z0-9+/=]+$/)
      .optional(),
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
          category: parsed.category,
          createdByUserId: input.actor.userId,
          documentDate: parsed.documentDate,
          dueDate: parsed.dueDate ?? null,
          invoiceNumber: parsed.invoiceNumber,
          netCents7: parsed.netCents7,
          netCents19: parsed.netCents19,
          organizationId,
          receiptImage: parsed.receiptImage ?? null,
          supplierName: parsed.supplierName,
        })
        .onConflictDoUpdate({
          set: {
            documentDate: parsed.documentDate,
            category: parsed.category,
            dueDate: parsed.dueDate ?? null,
            netCents7: parsed.netCents7,
            netCents19: parsed.netCents19,
            // Ein nachgereichtes Foto ergaenzt den Beleg; ein fehlendes
            // loescht das vorhandene nicht.
            ...(parsed.receiptImage ? { receiptImage: parsed.receiptImage } : {}),
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
          scanned: parsed.receiptImage !== undefined,
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
  /** Belegdatum ab (ISO). Hat Vorrang vor `months`. */
  from?: string;
  months?: number;
  organizationId: string;
  /** Belegdatum bis (ISO, einschliesslich). */
  to?: string;
}) {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const months = Math.min(Math.max(input.months ?? 3, 1), 24);
  const since =
    input.from ??
    new Intl.DateTimeFormat("sv-SE").format(
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
            input.to ? lte(incomingInvoices.documentDate, input.to) : undefined,
          ),
        )
        .orderBy(desc(incomingInvoices.documentDate));
      return rows;
    },
  );
}
