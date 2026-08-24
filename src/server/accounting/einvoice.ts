import "server-only";

// E-Rechnungs-Inbox (Stufe B MVP): XRechnung (UBL-XML) einlesen und als
// Eingangsrechnung speichern. ZUGFeRD (in PDF eingebettet) wird bewusst
// abgelehnt — nur echte XML-Dateien nach EN 16931/UBL.

import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { incomingInvoices } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

export class EInvoiceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EInvoiceParseError";
  }
}

export type ParsedEInvoice = {
  documentDate: string;
  invoiceNumber: string;
  netCents7: number;
  netCents19: number;
  supplierName: string;
};

const MAX_XML_LENGTH = 1_000_000;

function firstTag(xml: string, localName: string): string | null {
  const match = new RegExp(
    `<(?:[A-Za-z0-9_-]+:)?${localName}(?:\\s[^>]*)?>([^<]+)<`,
  ).exec(xml);
  return match ? match[1]!.trim() : null;
}

function toCents(raw: string): number | null {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function parseXRechnung(xmlText: string): ParsedEInvoice {
  if (xmlText.length > MAX_XML_LENGTH) {
    throw new EInvoiceParseError("Die XML-Datei ist größer als 1 MB.");
  }
  if (!/<(?:\w+:)?Invoice[\s>]/.test(xmlText)) {
    throw new EInvoiceParseError(
      "Keine XRechnung erkannt. Erwartet wird UBL-XML mit einem <Invoice>-Wurzelelement. ZUGFeRD-PDFs werden nicht unterstützt.",
    );
  }

  const invoiceNumber = firstTag(xmlText, "ID");
  if (!invoiceNumber) {
    throw new EInvoiceParseError("Rechnungsnummer (cbc:ID) nicht gefunden.");
  }
  const documentDate = firstTag(xmlText, "IssueDate");
  if (!documentDate || !/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
    throw new EInvoiceParseError("Rechnungsdatum (cbc:IssueDate) nicht gefunden.");
  }
  const supplierName = firstTag(xmlText, "Name");
  if (!supplierName) {
    throw new EInvoiceParseError(
      "Lieferantenname (cac:AccountingSupplierParty/cbc:Name) nicht gefunden.",
    );
  }

  let netCents7 = 0;
  let netCents19 = 0;
  const subtotals = xmlText.match(/<(?:\w+:)?TaxSubtotal[\s\S]*?<\/(?:\w+:)?TaxSubtotal>/g) ?? [];
  for (const block of subtotals) {
    const amount = firstTag(block, "TaxableAmount");
    const percentRaw = firstTag(block, "Percent");
    if (amount === null || percentRaw === null) continue;
    const cents = toCents(amount);
    const percent = Number.parseFloat(percentRaw.replace(",", "."));
    if (cents === null || !Number.isFinite(percent)) continue;
    if (percent >= 15) {
      netCents19 += cents;
    } else if (percent >= 5) {
      netCents7 += cents;
    }
  }
  if (netCents7 === 0 && netCents19 === 0) {
    throw new EInvoiceParseError(
      "Keine Steuersubtotals (7 %/19 %) in der XRechnung gefunden.",
    );
  }

  return { documentDate, invoiceNumber, netCents7, netCents19, supplierName };
}

export async function importEInvoice(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  fileName?: string;
  organizationId: string;
  supportReason?: string;
  xmlText: string;
}): Promise<{ invoiceNumber: string; supplierName: string }> {
  const parsedXml = parseXRechnung(input.xmlText);
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
          documentDate: parsedXml.documentDate,
          eInvoiceXml: input.xmlText.slice(0, MAX_XML_LENGTH),
          invoiceNumber: parsedXml.invoiceNumber,
          netCents7: parsedXml.netCents7,
          netCents19: parsedXml.netCents19,
          organizationId,
          sourceFileName: input.fileName?.slice(0, 255) ?? null,
          supplierName: parsedXml.supplierName,
        })
        .onConflictDoUpdate({
          set: {
            documentDate: parsedXml.documentDate,
            eInvoiceXml: input.xmlText.slice(0, MAX_XML_LENGTH),
            netCents7: parsedXml.netCents7,
            netCents19: parsedXml.netCents19,
            sourceFileName: input.fileName?.slice(0, 255) ?? null,
            supplierName: parsedXml.supplierName,
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
          action: "SUPPORT_E_INVOICE_IMPORTED",
          actorUserId: input.actor.userId,
          metadata: { invoiceNumber: parsedXml.invoiceNumber },
          objectId: saved!.id,
          objectType: "incoming_invoice",
          organizationId,
          reason: authorization.reason,
        });
      }

      await writeAuditEvent(transaction, {
        action: "E_INVOICE_IMPORTED",
        actorUserId: input.actor.userId,
        metadata: {
          fileName: input.fileName ?? null,
          invoiceNumber: parsedXml.invoiceNumber,
          supplier: parsedXml.supplierName,
        },
        objectId: saved!.id,
        objectType: "incoming_invoice",
        organizationId,
      });
    },
  );

  return { invoiceNumber: parsedXml.invoiceNumber, supplierName: parsedXml.supplierName };
}

export const eInvoiceFileSchema = z.object({
  fileName: z.string().trim().max(255).regex(/\.xml$/i, "Nur .xml-Dateien."),
});
