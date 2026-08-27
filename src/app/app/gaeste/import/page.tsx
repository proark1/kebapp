import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { PLATFORM_IMPORT_COLUMNS } from "@/lib/platform-import";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { listPlatformImports } from "@/server/guests/service";

export const metadata: Metadata = { title: "Plattformdaten importieren" };

const MAX_UPLOAD_BYTES = 512 * 1024;

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

async function importPlatformAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const redirectTarget = (meldung: string): never =>
    redirect(`/app/gaeste/import?meldung=${encodeURIComponent(meldung)}`);

  const { actor, organization } = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage("/app/gaeste/import");
  const { importPlatformOrders } = await import("@/server/guests/service");

  const file = formData.get("csvFile");
  let content = "";
  let fileName = "eingefuegt.csv";

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return redirectTarget("zu-gross");
    }
    content = await file.text();
    fileName = file.name;
  } else {
    content = String(formData.get("csvText") ?? "");
  }

  if (content.trim() === "") {
    return redirectTarget("leer");
  }

  const outcome = await importPlatformOrders({
    actor,
    content,
    fileName,
    organizationId: organization.organizationId,
    platform: String(formData.get("platform") ?? "").trim() || "Plattform",
  });

  revalidatePath("/app/gaeste/import");
  revalidatePath("/app/gaeste");
  redirectTarget(
    `${outcome.createdCount} übernommen, ${outcome.skippedCount} übersprungen`,
  );
}

const meldungMessages: Record<string, string> = {
  leer: "Es wurde keine Datei ausgewählt und kein Text eingefügt.",
  "zu-gross": "Die Datei ist größer als 512 KiB.",
};

export default async function PlatformImportPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/gaeste/import",
  );
  const [imports, query] = await Promise.all([
    listPlatformImports({
      actor,
      organizationId: organization.organizationId,
    }),
    searchParams,
  ]);

  const message = query.meldung
    ? (meldungMessages[query.meldung] ?? query.meldung)
    : undefined;
  const isError = Boolean(query.meldung && meldungMessages[query.meldung]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            <Link href="/app/gaeste">
              <ArrowLeft aria-hidden="true" size={13} /> Alle Gäste
            </Link>
          </span>
          <h1>Plattformdaten importieren</h1>
          <p>
            Bestellungen von Lieferdiensten den eigenen Gästen zuordnen. Die
            Zuordnung läuft über die Telefonnummer; bereits importierte
            Bestellnummern werden übersprungen.
          </p>
        </div>
      </header>

      {message ? (
        <p
          className={`save-message save-message--${isError ? "error" : "success"}`}
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">CSV</span>
            <h2>Datei einlesen</h2>
            <p>Erwartete Spalten: {PLATFORM_IMPORT_COLUMNS}</p>
          </div>
        </div>
        <form action={importPlatformAction} className="form-stack">
          <label className="field">
            <span>Plattform</span>
            <input
              defaultValue="Lieferando"
              maxLength={60}
              name="platform"
              type="text"
            />
          </label>
          <label className="button button--secondary sales-upload">
            <Upload aria-hidden="true" size={17} /> CSV-Datei auswählen
            <input
              accept=".csv,.txt,.tsv"
              className="sr-only"
              name="csvFile"
              type="file"
            />
          </label>
          <label className="field">
            <span>… oder direkt einfügen</span>
            <textarea
              name="csvText"
              placeholder={
                "Bestellnummer;Datum;Telefon;Name;Art;Betrag;Artikel\nLF-1001;20.08.2026 18:30;0176 1234567;Ayse K.;Lieferung;18,00;2x Döner"
              }
              rows={4}
            />
          </label>
          <div className="receipt-form__footer">
            <button className="button button--primary" type="submit">
              Importieren
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Verlauf</span>
            <h2>Bisherige Importe</h2>
          </div>
        </div>
        {imports.length === 0 ? (
          <p className="request-file__empty">Noch nichts importiert.</p>
        ) : (
          <div className="demand-table-wrap">
            <table className="demand-table">
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Plattform</th>
                  <th>Datei</th>
                  <th>Übernommen</th>
                  <th>Übersprungen</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Zeitpunkt">
                      {dateTimeFormatter.format(new Date(entry.importedAt))}
                    </td>
                    <td data-label="Plattform">{entry.platform}</td>
                    <td data-label="Datei">{entry.fileName}</td>
                    <td data-label="Übernommen">{entry.createdCount}</td>
                    <td data-label="Übersprungen">{entry.skippedCount}</td>
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
