import type { Metadata } from "next";
import { Download, Upload } from "lucide-react";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { listInvoices } from "@/server/accounting/invoices";

export const metadata: Metadata = { title: "Buchhaltung" };

const dayFormatter = new Intl.DateTimeFormat("de-DE");

function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE").format(new Date());
}

async function createInvoiceAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const guard = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage("/app/buchhaltung");
  const fail = (meldung: string): never =>
    redirect(`/app/buchhaltung?meldung=${meldung}`);

  const value = (name: string) => String(formData.get(name) ?? "").trim();
  const net7 = Number(value("net7").replace(",", "."));
  const net19 = Number(value("net19").replace(",", "."));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value("documentDate")) ||
    !value("supplierName") ||
    !value("invoiceNumber") ||
    (!Number.isFinite(net7) && !Number.isFinite(net19))
  ) {
    return fail("ungueltig");
  }

  const { upsertInvoice } = await import("@/server/accounting/invoices");
  try {
    await upsertInvoice({
      actor: guard.actor,
      input: {
        documentDate: value("documentDate"),
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(value("dueDate"))
          ? value("dueDate")
          : undefined,
        invoiceNumber: value("invoiceNumber"),
        netCents7: Math.round((net7 || 0) * 100),
        category: (invoiceCategories as readonly string[]).includes(value("category"))
          ? (value("category") as InvoiceCategory)
          : "SONSTIGES",
        netCents19: Math.round((net19 || 0) * 100),
        supplierName: value("supplierName"),
      },
      organizationId: guard.organization.organizationId,
    });
  } catch (error) {
    console.error("Rechnung konnte nicht gespeichert werden.", error);
    return fail("fehler");
  }
  revalidatePath("/app/buchhaltung");
  return fail("gespeichert");
}

async function payInvoiceAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const guard = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage("/app/buchhaltung");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const { markInvoicePaid } = await import("@/server/accounting/invoices");
  await markInvoicePaid({
    actor: guard.actor,
    invoiceId,
    organizationId: guard.organization.organizationId,
  });
  revalidatePath("/app/buchhaltung");
  redirect("/app/buchhaltung?meldung=bezahlt");
}

async function importEInvoiceAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const guard = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage("/app/buchhaltung");
  const fail = (code: string): never =>
    redirect(`/app/buchhaltung?meldung=${encodeURIComponent(code)}`);

  const file = formData.get("xmlFile");
  if (!(file instanceof File) || file.size === 0) {
    return fail("keine-datei");
  }
  if (!/\.xml$/i.test(file.name)) {
    return fail("Nur .xml-Dateien werden unterstützt.");
  }
  if (file.size > 1_000_000) {
    return fail("Die XML-Datei ist größer als 1 MB.");
  }
  const xmlText = await file.text();
  const { EInvoiceParseError, importEInvoice } = await import(
    "@/server/accounting/einvoice"
  );
  try {
    await importEInvoice({
      actor: guard.actor,
      fileName: file.name,
      organizationId: guard.organization.organizationId,
      xmlText,
    });
  } catch (error) {
    if (error instanceof EInvoiceParseError) {
      return fail(error.message);
    }
    throw error;
  }
  revalidatePath("/app/buchhaltung");
  return fail("importiert");
}

const invoiceCategories = ["FLEISCH","GEMUESE","TROCKEN","GETRAENKE","VERPACKUNG","SONSTIGES"] as const;
type InvoiceCategory = (typeof invoiceCategories)[number];

const meldungMessages: Record<string, string> = {
  importiert: "XRechnung importiert",
  "keine-datei": "Bitte eine XML-Datei auswählen.",
  bezahlt: "Als bezahlt markiert",
  fehler: "Speichern fehlgeschlagen — bitte Angaben prüfen.",
  gespeichert: "Eingangsrechnung gespeichert",
  ungueltig: "Bitte Lieferant, Nummer, Datum und Beträge prüfen.",
};

export default async function BuchhaltungPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/buchhaltung",
  );
  const [invoices, query] = await Promise.all([
    listInvoices({
      actor,
      organizationId: organization.organizationId,
    }),
    searchParams,
  ]);
  const message = query.meldung
    ? (meldungMessages[query.meldung] ?? query.meldung)
    : undefined;

  const openSum = invoices
    .filter((invoice) => invoice.status === "OFFEN")
    .reduce(
      (sum, invoice) =>
        sum + invoice.netCents7 * 1.07 + invoice.netCents19 * 1.19,
      0,
    );
  const vatByRate = invoices.reduce(
    (acc, invoice) => ({
      rate7: acc.rate7 + invoice.netCents7 * 0.07,
      rate19: acc.rate19 + invoice.netCents19 * 0.19,
    }),
    { rate7: 0, rate19: 0 },
  );

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Buchhaltung</span>
          <h1>Eingangsrechnungen</h1>
          <p>Lieferantenrechnungen erfassen, offene Posten im Blick, Export für den Steuerberater.</p>
        </div>
        <div className="admin-date-block">
          <strong>
            {(openSum / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
          </strong>
          <span>offen (brutto)</span>
        </div>
      </header>

      {message ? (
        <p className={`save-message save-message--${query.meldung === "gespeichert" || query.meldung === "bezahlt" ? "success" : "error"}`} role="status">
          {message}
        </p>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Neu</span>
            <h2>Eingangsrechnung erfassen</h2>
          </div>
        </div>
        <form action={createInvoiceAction} className="form-grid form-grid--three sales-manual">
          <label className="field">
            <span>Lieferant</span>
            <input maxLength={180} name="supplierName" placeholder="Fleischwerk Rheinland" required />
          </label>
          <label className="field">
            <span>Rechnungsnummer</span>
            <input maxLength={80} name="invoiceNumber" placeholder="2026-08-114" required />
          </label>
          <label className="field">
            <span>Kategorie</span>
            <select defaultValue="FLEISCH" name="category">
              {invoiceCategories.map((key) => (
                <option key={key}>{key}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Datum</span>
            <input defaultValue={todayIso()} name="documentDate" required type="date" />
          </label>
          <label className="field">
            <span>Netto 7 % in €</span>
            <input min="0" name="net7" step="0.01" type="number" />
          </label>
          <label className="field">
            <span>Netto 19 % in €</span>
            <input min="0" name="net19" step="0.01" type="number" />
          </label>
          <label className="field">
            <span>Fällig am (optional)</span>
            <input name="dueDate" type="date" />
          </label>
          <button className="button button--primary" type="submit">
            Rechnung speichern
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">E-Rechnung</span>
            <h2>XRechnung (.xml) hochladen</h2>
            <p>
              Nummer, Datum, Lieferant und USt-Beträge werden automatisch
              eingelesen. ZUGFeRD-PDFs werden nicht unterstützt.
            </p>
          </div>
        </div>
        <form action={importEInvoiceAction} className="form-grid form-grid--three sales-manual">
          <label className="button button--secondary sales-upload">
            <Upload size={17} aria-hidden="true" /> XML auswählen
            <input
              accept=".xml,text/xml,application/xml"
              className="sr-only"
              name="xmlFile"
              required
              type="file"
            />
          </label>
          <button className="button button--primary" type="submit">
            E-Rechnung importieren
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Letzte 3 Monate</span>
            <h2>Belege & Umsatzsteuer</h2>
            <small>
              Vorsteuer: 7 % = {(vatByRate.rate7 / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} · 19 % = {(vatByRate.rate19 / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              {" · Netto je Kategorie: "}
              {Object.entries(
                invoices.reduce<Record<string, number>>((acc, invoice) => {
                  acc[invoice.category] =
                    (acc[invoice.category] ?? 0) +
                    invoice.netCents7 +
                    invoice.netCents19;
                  return acc;
                }, {}),
              )
                .map(([catKey, cents]) =>
                  `${catKey} ${(cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`,
                )
                .join(", ")}
            </small>
          </div>
          <a
            className="button button--secondary"
            download="buchen.csv"
            href={`/api/api/app/buchhaltung/export`}
          >
            <Download size={17} aria-hidden="true" />
            Buchungsstapel CSV
          </a>
        </div>
        {invoices.length === 0 ? (
          <p className="request-file__empty">Noch keine Belege erfasst.</p>
        ) : (
          <div className="demand-table-wrap">
            <table className="demand-table">
              <thead>
                <tr>
                  <th>Lieferant</th>
                  <th>Nr.</th>
                  <th>Datum</th>
                  <th>Kategorie</th>
                  <th>Brutto</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Lieferant">{invoice.supplierName}</td>
                    <td data-label="Nr.">{invoice.invoiceNumber}</td>
                    <td data-label="Datum">{dayFormatter.format(new Date(`${invoice.documentDate}T12:00:00Z`))}</td>
                    <td data-label="Kategorie">{invoice.category}</td>
                    <td data-label="Brutto">
                      {((invoice.netCents7 * 1.07 + invoice.netCents19 * 1.19) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </td>
                    <td data-label="Status">
                      {invoice.status === "BEZAHLT" ? (
                        "Bezahlt"
                      ) : (
                        <form action={payInvoiceAction}>
                          <input name="invoiceId" type="hidden" value={invoice.id} />
                          <button className="button button--secondary button--small" type="submit">
                            Bezahlt?
                          </button>
                        </form>
                      )}
                    </td>
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
