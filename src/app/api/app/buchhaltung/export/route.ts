import { z } from "zod";
import { centsToGermanAmount, toBookingLines } from "@/lib/booking-batch";
import { getOptionalSession } from "@/server/auth/session";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  resolveActiveOrganization,
} from "@/server/organizations/active-organization";
import { cookies } from "next/headers";
import { listInvoices } from "@/server/accounting/invoices";

const rangeSchema = z.object({
  bis: z.iso.date().optional(),
  von: z.iso.date().optional(),
});

function csvEscape(value: string): string {
  if (/[",;\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

// Vereinfachter Buchungsstapel (Semikolon, eine Zeile je Steuersatz).
//
// Bewusst noch kein echtes DATEV-EXTF-Format: dafuer fehlen Kopfsatz,
// Konto/Gegenkonto, Soll-/Haben-Kennzeichen und Belegfeld 1, und die
// Vorsteuerkonten unterscheiden sich zwischen SKR03 und SKR04. Erfundene
// Kontonummern waeren schlimmer als gar keine - die Kanzlei bekommt die
// Zeilen bis dahin mit Steuerschluessel und ordnet die Konten selbst zu.
export async function GET(request: Request): Promise<Response> {
  const actor = await getOptionalSession();
  if (!actor) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = rangeSchema.safeParse({
    bis: url.searchParams.get("bis") ?? undefined,
    von: url.searchParams.get("von") ?? undefined,
  });
  if (!parsed.success) {
    return new Response("Ungültiger Zeitraum.", { status: 400 });
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
      from: parsed.data.von,
      // Ohne Zeitraum derselbe Ausschnitt, den die Seite zeigt. Vorher
      // waren es fest 24 Monate: wer monatlich uebergab, lud jedes Mal
      // zwei Jahre Belege und buchte doppelt.
      months: 3,
      organizationId: resolution.organization.organizationId,
      to: parsed.data.bis,
    });

    const lines = [
      [
        "Datum",
        "Buchungstext",
        "Empfaenger",
        "Netto_EUR",
        "Brutto_EUR",
        "Steuersatz_Prozent",
        "USt_Schluessel",
        "Kategorie",
      ].join(";"),
      ...invoices.flatMap((invoice) =>
        toBookingLines(invoice).map((line) =>
          [
            line.bookingDate,
            csvEscape(`RE ${line.invoiceNumber}`),
            csvEscape(line.supplierName),
            centsToGermanAmount(line.netCents),
            centsToGermanAmount(line.grossCents),
            String(line.taxRatePercent),
            line.vatKey,
            csvEscape(line.category),
          ].join(";"),
        ),
      ),
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
