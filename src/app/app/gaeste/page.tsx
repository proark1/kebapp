import type { Metadata } from "next";
import Link from "next/link";
import { Repeat2, Stamp, Users } from "lucide-react";
import { LOYALTY_TARGET } from "@/lib/guest-identity";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { getGuestOverview, listGuests } from "@/server/guests/service";

export const metadata: Metadata = { title: "Gäste" };

const euroFormatter = new Intl.NumberFormat("de-DE", {
  currency: "EUR",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

function formatCents(value: number): string {
  return euroFormatter.format(value / 100);
}

async function recordManualOrderAction(formData: FormData): Promise<void> {
  "use server";
  const { redirect } = await import("next/navigation");
  const { revalidatePath } = await import("next/cache");
  const redirectTarget = (meldung: string): never =>
    redirect(`/app/gaeste?meldung=${meldung}`);

  const { actor, organization } = await (
    await import("@/server/auth/page-guards")
  ).requireActiveOrganizationPage("/app/gaeste");
  const { recordManualOrder } = await import("@/server/guests/service");

  const euroRaw = String(formData.get("amount") ?? "")
    .replace(/[€\s]/g, "")
    .replace(",", ".");
  const amount = Number(euroRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    return redirectTarget("betrag-ungueltig");
  }

  try {
    await recordManualOrder({
      actor,
      order: {
        amountCents: Math.round(amount * 100),
        itemLabel: String(formData.get("itemLabel") ?? "").trim() || undefined,
        mode: formData.get("mode") === "DELIVERY" ? "DELIVERY" : "PICKUP",
        name: String(formData.get("name") ?? ""),
        note: String(formData.get("note") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      },
      organizationId: organization.organizationId,
    });
  } catch {
    return redirectTarget("nummer-ungueltig");
  }

  revalidatePath("/app/gaeste");
  redirectTarget("gespeichert");
}

const meldungMessages: Record<string, string> = {
  "betrag-ungueltig": "Bitte einen gültigen Betrag angeben.",
  eingeloest: "Stempelkarte eingelöst.",
  geloescht: "Gast und Bestellhistorie wurden gelöscht.",
  gespeichert: "Bestellung erfasst.",
  "nummer-ungueltig":
    "Bitte eine gültige Telefonnummer angeben, zum Beispiel 0176 1234567.",
};

const successMeldungen = new Set(["gespeichert", "eingeloest", "geloescht"]);

export default async function GaestePage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string; suche?: string }>;
}) {
  const { actor, organization } =
    await requireActiveOrganizationPage("/app/gaeste");
  const query = await searchParams;
  const search = (query.suche ?? "").trim();

  const [overview, guests] = await Promise.all([
    getGuestOverview({ actor, organizationId: organization.organizationId }),
    listGuests({
      actor,
      organizationId: organization.organizationId,
      search,
    }),
  ]);

  const message = query.meldung
    ? (meldungMessages[query.meldung] ?? query.meldung)
    : undefined;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Stammgäste</span>
          <h1>Gäste</h1>
          <p>
            Wiederkehrende Besteller, erkannt an der Telefonnummer. Ein
            Datensatz entsteht nur, wenn der Gast bei der Bestellung
            ausdrücklich zustimmt.
          </p>
        </div>
        <div className="admin-date-block">
          <strong>{overview.guestCount}</strong>
          <span>Gäste mit Einwilligung</span>
        </div>
      </header>

      {message ? (
        <p
          className={`save-message save-message--${
            successMeldungen.has(query.meldung ?? "") ? "success" : "error"
          }`}
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-card__label">Wiederkehrend</span>
          <span className="metric-card__icon metric-card__icon--green">
            <Repeat2 aria-hidden="true" size={18} />
          </span>
          <strong>{overview.returningCount}</strong>
          <small>Gäste mit mindestens zwei Bestellungen</small>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Letzte 30 Tage</span>
          <span className="metric-card__icon metric-card__icon--yellow">
            <Users aria-hidden="true" size={18} />
          </span>
          <strong>{overview.orders30d}</strong>
          <small>
            Bestellungen · {formatCents(overview.revenue30dCents)} Umsatz
          </small>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Stempelkarte voll</span>
          <span className="metric-card__icon metric-card__icon--red">
            <Stamp aria-hidden="true" size={18} />
          </span>
          <strong>{overview.redeemableCount}</strong>
          <small>Gäste können eine Prämie einlösen</small>
        </article>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Übersicht</span>
            <h2>Alle Gäste</h2>
            <p>
              Sortiert nach der letzten Bestellung. {LOYALTY_TARGET} Bestellungen
              ergeben eine volle Stempelkarte.
            </p>
          </div>
          <Link className="button button--secondary" href="/app/gaeste/import">
            Plattformdaten importieren
          </Link>
        </div>

        <form action="/app/gaeste" className="form-stack" method="get">
          <label className="field">
            <span>Suche nach Name oder Nummer</span>
            <input
              defaultValue={search}
              name="suche"
              placeholder="Ayse oder 0176"
              type="search"
            />
          </label>
          <button className="button button--secondary" type="submit">
            Suchen
          </button>
        </form>

        {guests.length === 0 ? (
          <p className="request-file__empty">
            {search
              ? "Kein Gast passt zu dieser Suche."
              : "Noch kein Gast erfasst. Sobald jemand über die Ladenseite bestellt und der Speicherung zustimmt, erscheint er hier."}
          </p>
        ) : (
          <div className="demand-table-wrap">
            <table className="demand-table">
              <thead>
                <tr>
                  <th>Gast</th>
                  <th>Bestellungen</th>
                  <th>Umsatz</th>
                  <th>Stempel</th>
                  <th>Zuletzt</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td data-label="Gast">
                      <Link href={`/app/gaeste/${guest.id}`}>
                        <strong>{guest.name ?? "Ohne Namen"}</strong>
                      </Link>
                      <br />
                      <small>{guest.phoneLabel}</small>
                    </td>
                    <td data-label="Bestellungen">{guest.orderCount}</td>
                    <td data-label="Umsatz">{formatCents(guest.totalCents)}</td>
                    <td data-label="Stempel">
                      {guest.redeemable ? (
                        <span className="chip chip--ok">
                          {guest.stampCount} · einlösbar
                        </span>
                      ) : (
                        <span className="chip">
                          {guest.stampCount} / {LOYALTY_TARGET}
                        </span>
                      )}
                    </td>
                    <td data-label="Zuletzt">
                      {guest.lastOrderAt
                        ? dateFormatter.format(new Date(guest.lastOrderAt))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Im Laden</span>
            <h2>Bestellung von Hand erfassen</h2>
            <p>
              Für Stammgäste, die am Tresen oder telefonisch bestellen. Die
              Nummer darf nur mit Einverständnis des Gastes erfasst werden.
            </p>
          </div>
        </div>
        <form action={recordManualOrderAction} className="form-grid form-grid--three">
          <label className="field">
            <span>Telefonnummer</span>
            <input
              autoComplete="off"
              name="phone"
              placeholder="0176 1234567"
              required
              type="tel"
            />
          </label>
          <label className="field">
            <span>Name (optional)</span>
            <input maxLength={120} name="name" type="text" />
          </label>
          <label className="field">
            <span>Betrag in €</span>
            <input
              min="0"
              name="amount"
              placeholder="12,50"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="field">
            <span>Bestellart</span>
            <select name="mode">
              <option value="PICKUP">Abholung</option>
              <option value="DELIVERY">Lieferung</option>
            </select>
          </label>
          <label className="field">
            <span>Bezeichnung</span>
            <input
              defaultValue="Bestellung im Laden"
              maxLength={160}
              name="itemLabel"
              type="text"
            />
          </label>
          <label className="field">
            <span>Anmerkung (optional)</span>
            <input maxLength={300} name="note" type="text" />
          </label>
          <button className="button button--primary" type="submit">
            Bestellung erfassen
          </button>
        </form>
      </section>
    </div>
  );
}
