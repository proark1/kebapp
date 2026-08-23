import { z } from "zod";
import { getOptionalSession } from "@/server/auth/session";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  resolveActiveOrganization,
} from "@/server/organizations/active-organization";
import { cookies } from "next/headers";
import { listInvoices } from "@/server/accounting/invoices";

function csvEscape(value: string): string {
  if (/[",;\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

// Vereinfachter Buchungsstapel (DATEV-EXTF-ähnlich, Semikolon):
// Umsatz brutto je Beleg, Gegenkonto 1600/1406 (Vorsteuer 19 %/7 %).
export async function GET(): Promise<Response> {
  const actor = await getOptionalSession();
  if (!actor) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }
  const preferredOrganizationId = (await cookies()).get(
    ACTIVE_ORGANIZATION_COOKIE,
  )?.value;
  const resolution = await resolveActiveOrganization({
    actor,
    preferredOrganizationId,
  });
  if (resolution.kind !== "READY") {
    return new Response("Kein aktiver Laden.", { status: 403 });
  }

  try {
    const invoices = await listInvoices({
      actor,
      months: 24,
      organizationId: resolution.organization.organizationId,
    });

    const lines = [
      ["Datum", "Buchungstext", "Empfaenger", "Betrag_EUR_brutto", "USt_Schluessel"].join(";"),
      ...invoices.map((invoice) => {
        const gross =
          invoice.netCents7 * 1.07 + invoice.netCents19 * 1.19;
        const vatKey =
          invoice.netCents19 > 0 ? "3" : "2"; // DATEV: 3=19%, 2=7%
        return [
          invoice.documentDate.replaceAll("-", ""),
          csvEscape(`RE ${invoice.invoiceNumber}`),
          csvEscape(invoice.supplierName),
          (gross / 100).toFixed(2).replace(".", ","),
          vatKey,
        ].join(";");
      }),
    ];

    return new Response(`\uFEFF${lines.join("\r\n")}`, {
      headers: {
        "Content-Disposition": 'attachment; filename="buchen.csv"',
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    console.error("Der Buchungsstapel-Export ist fehlgeschlagen.");
    return new Response("Export fehlgeschlagen.", { status: 500 });
  }
}
