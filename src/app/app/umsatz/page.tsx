import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import {
  listRecentSales,
  SalesCsvError,
  upsertDailySales,
} from "@/server/sales/service";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";

export const metadata: Metadata = { title: "Umsätze" };

const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
});

function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
}

async function importSalesAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const redirectTarget = (meldung: string): never =>
    redirect(`/app/umsatz?meldung=${meldung}`);

  const guard = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage("/app/umsatz");
  const actor = guard.actor;
  const organization = guard.organization;
  const mode = formData.get("mode") === "manual" ? "manual" : "csv";
  const { parseSalesCsv, upsertDailySales } = await import(
    "@/server/sales/service"
  );

  try {
    if (mode === "manual") {
      const dateValue = String(formData.get("businessDate") ?? "");
      const euroRaw = String(formData.get("netSales") ?? "")
        .replace(/[€\s]/g, "")
        .replace(",", ".");
      const euro = Number(euroRaw);
      const guestsRaw = String(formData.get("guestCount") ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !Number.isFinite(euro) || euro < 0) {
        return redirectTarget("ungueltig");
      }
      await upsertDailySales({
        actor,
        organizationId: organization.organizationId,
        rows: [
          {
            businessDate: dateValue,
            guestCount: guestsRaw ? Number(guestsRaw) : undefined,
            netSalesCents: Math.round(euro * 100),
          },
        ],
        source: "MANUAL",
      });
    } else {
      const file = formData.get("csvFile");
      let csvText = "";
      if (file instanceof File && file.size > 0) {
        if (file.size > 512 * 1024) {
          return redirectTarget("zu-gross");
        }
        csvText = await file.text();
      } else {
        csvText = String(formData.get("csvText") ?? "");
      }
      const rows = parseSalesCsv(csvText);
      if (rows.length === 0) {
        return redirectTarget("leer");
      }
      await upsertDailySales({
        actor,
        organizationId: organization.organizationId,
        rows,
        source: "CSV",
      });
    }
  } catch (error) {
    if (error instanceof SalesCsvError) {
      return redirect(
        `/app/umsatz?meldung=${encodeURIComponent(error.message)}`,
      );
    }
    throw error;
  }

  revalidatePath("/app/umsatz");
  revalidatePath("/app");
  redirectTarget("importiert");
}

const meldungMessages: Record<string, string> = {
  importiert: "Umsätze gespeichert",
  leer: "Keine Zeilen erkannt. Erwartet: Datum;Umsatz;Gaeste",
  ungueltig: "Bitte Datum und Umsatz prüfen.",
  "zu-gross": "Die Datei ist größer als 512 KiB.",
};

export default async function UmsatzPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/umsatz",
  );
  const [sales, query] = await Promise.all([
    listRecentSales({
      actor,
      organizationId: organization.organizationId,
    }),
    searchParams,
  ]);
  const message = query.meldung
    ? (meldungMessages[query.meldung] ?? query.meldung)
    : undefined;
  const total30 = sales.reduce((sum, row) => sum + row.netSalesEuros, 0);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Kennzahlen</span>
          <h1>Umsätze</h1>
          <p>
            Tägliche Nettoumsätze aus der Kasse — Grundlage für echte
            Kennzahlen im Dashboard.
          </p>
        </div>
        <div className="admin-date-block">
          <strong>{total30.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong>
          <span>letzte {sales.length} Tage</span>
        </div>
      </header>

      {message ? (
        <p className={`save-message save-message--${query.meldung === "importiert" ? "success" : "error"}`} role="alert">
          {message}
        </p>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Import</span>
            <h2>Kassen-CSV oder Einzeltag</h2>
            <p>CSV mit Kopf- oder Datenzeilen: Datum;Umsatz;Gaeste</p>
          </div>
        </div>
        <form action={importSalesAction} className="form-stack sales-import">
          <input name="mode" type="hidden" value="csv" />
          <label className="button button--secondary sales-upload">
            <Upload size={17} aria-hidden="true" /> CSV-Datei auswählen
            <input accept=".csv,.txt,.tsv" className="sr-only" name="csvFile" type="file" />
          </label>
          <label className="field">
            <span>… oder direkt einfügen</span>
            <textarea
              name="csvText"
              placeholder={`${todayIso()};842.50;96`}
              rows={3}
            />
          </label>
          <div className="receipt-form__footer">
            <button className="button button--primary" type="submit">
              CSV importieren
            </button>
          </div>
        </form>

        <form action={importSalesAction} className="form-grid form-grid--three sales-manual">
          <input name="mode" type="hidden" value="manual" />
          <label className="field">
            <span>Datum</span>
            <input defaultValue={todayIso()} max={todayIso()} name="businessDate" required type="date" />
          </label>
          <label className="field">
            <span>Nettoumsatz in €</span>
            <input min="0" name="netSales" placeholder="842.50" required step="0.01" type="number" />
          </label>
          <label className="field">
            <span>Gäste (optional)</span>
            <input min="0" name="guestCount" type="number" />
          </label>
          <button className="button button--secondary" type="submit">
            Einzeltag speichern
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Letzte 30 Tage</span>
            <h2>Erfasste Tage</h2>
          </div>
        </div>
        {sales.length === 0 ? (
          <p className="request-file__empty">Noch keine Umsätze erfasst.</p>
        ) : (
          <div className="demand-table-wrap">
            <table className="demand-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Nettoumsatz</th>
                  <th>Gäste</th>
                  <th>Quelle</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((row) => (
                  <tr key={row.businessDate}>
                    <td data-label="Datum">{dayFormatter.format(new Date(`${row.businessDate}T12:00:00Z`))}</td>
                    <td data-label="Nettoumsatz">
                      {row.netSalesEuros.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </td>
                    <td data-label="Gäste">{row.guestCount ?? "—"}</td>
                    <td data-label="Quelle">{row.source === "CSV" ? "Kasse (CSV)" : "Manuell"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>



    </div>
  );
}
