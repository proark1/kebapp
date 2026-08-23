import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { transitionBuyingRoundAction } from "@/app/admin/runden/actions";
import {
  getBuyingRoundDetail,
  RoundNotFoundError,
} from "@/server/procurement/rounds";
import { getRegionalSavings } from "@/server/organizations/directory";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";

export const metadata: Metadata = { title: "Sammelrunde" };

const statusLabels: Record<string, string> = {
  CANCELLED: "Storniert",
  CLOSED: "Geschlossen",
  OPEN: "Offen",
  PLANNING: "Geplant",
  SUBMITTED: "Eingereicht",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function formatPrice(price: number | null): string {
  return price === null
    ? "—"
    : price.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export default async function AdminRoundDetailPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const actor = await requirePlatformAdminPage("/admin/runden");
  const { roundId } = await params;

  let detail;
  try {
    detail = await getBuyingRoundDetail({ actor, roundId });
  } catch (error) {
    if (error instanceof RoundNotFoundError) {
      notFound();
    }
    throw error;
  }

  const { bundle, detail: round, submissionCounts } = detail;
  const savings =
    round.status === "CLOSED" || round.status === "SUBMITTED"
      ? await getRegionalSavings({ actor, roundId: round.id })
      : [];
  const totalSavings = savings.reduce(
    (sum, entry) => sum + (entry.savingsEur ?? 0),
    0,
  );
  const confirmedCount =
    submissionCounts.find((entry) => entry.status === "CONFIRMED")?.count ?? 0;
  const draftCount =
    submissionCounts.find((entry) => entry.status === "DRAFT")?.count ?? 0;
  const totalKg = bundle.reduce(
    (sum, entry) => sum + Number(entry.totalQuantity),
    0,
  );
  const targetKg = Number(round.targetQuantity);

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--compact">
        <div>
          <p>
            <Link href="/admin/runden">← Sammelrunden</Link>
          </p>
          <h1>{round.name}</h1>
          <span>
            {round.organizationName} · Region {round.regionalKey}
          </span>
        </div>
        <div
          className={`request-status request-status--${round.status.toLowerCase()}`}
        >
          {statusLabels[round.status]}
        </div>
      </header>

      <section className="panel rounds-facts" aria-label="Rundendaten">
        <div>
          <span className="eyebrow">Bestellschluss</span>
          <strong>{dateFormatter.format(round.closesAt)}</strong>
          {round.reminderSentAt ? (
            <small>Erinnerung versendet am {dateFormatter.format(round.reminderSentAt)}</small>
          ) : (
            <small>Noch keine Erinnerung versendet</small>
          )}
        </div>
        <div>
          <span className="eyebrow">Lieferfenster</span>
          <strong>{dateFormatter.format(round.deliveryStartsAt)}</strong>
          <small>bis {dateFormatter.format(round.deliveryEndsAt)}</small>
        </div>
        <div>
          <span className="eyebrow">Ziel · Bündelmenge</span>
          <strong>
            {totalKg.toLocaleString("de-DE")} / {targetKg.toLocaleString("de-DE")} kg
          </strong>
          <small>
            {confirmedCount} bestätigte Läden · {draftCount} Entwürfe
          </small>
        </div>
      </section>

      <section className="rounds-actions-bar" aria-label="Statuswechsel">
        {round.status === "PLANNING" ? (
          <form action={transitionBuyingRoundAction}>
            <input name="action" type="hidden" value="OPEN" />
            <input name="roundId" type="hidden" value={round.id} />
            <button className="button button--primary" type="submit">
              Runde öffnen
            </button>
          </form>
        ) : null}
        {round.status === "OPEN" ? (
          <form action={transitionBuyingRoundAction}>
            <input name="action" type="hidden" value="CLOSE" />
            <input name="roundId" type="hidden" value={round.id} />
            <button className="button button--primary" type="submit">
              Vorzeitig schließen
            </button>
          </form>
        ) : null}
        {round.status === "CLOSED" ? (
          <form action={transitionBuyingRoundAction}>
            <input name="action" type="hidden" value="SUBMIT" />
            <input name="roundId" type="hidden" value={round.id} />
            <button className="button button--primary" type="submit">
              Als eingereicht markieren
            </button>
          </form>
        ) : null}
        {bundle.length > 0 ? (
          <a
            className="button button--secondary"
            download={`bündel-${round.regionalKey}.csv`}
            href={`/api/admin/runden/export?round=${round.id}`}
          >
            <Download size={17} aria-hidden="true" />
            Bündel als CSV
          </a>
        ) : null}
        {savings.length > 0 ? (
          <a
            className="button button--secondary"
            download={`ersparnis-${round.regionalKey}.csv`}
            href={`/api/admin/runden/export?round=${round.id}&report=savings`}
          >
            <Download size={17} aria-hidden="true" />
            Ersparnis als CSV
          </a>
        ) : null}
      </section>

      {savings.length > 0 ? (
        <section className="request-file request-file--savings" aria-labelledby="savings-title">
          <header className="request-file__columns request-file__columns--savings" aria-hidden="true">
            <span>Laden</span>
            <span>Bestätigte kg</span>
            <span>Referenz / effektiv</span>
            <span>Ersparnis</span>
          </header>
          <ol>
            {savings.map((entry) => (
              <li key={entry.organizationId}>
                <span className="request-file__store">{entry.storeName}</span>
                <span className="rounds-cell-strong">
                  {entry.confirmedKg.toLocaleString("de-DE")} kg
                </span>
                <span className="rounds-cell-muted">
                  {formatPrice(entry.referencePrice)} /{" "}
                  {formatPrice(entry.effectivePrice)}
                </span>
                <span className="rounds-cell-strong value-positive">
                  {entry.savingsEur === null
                    ? "—"
                    : entry.savingsEur.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      })}
                </span>
              </li>
            ))}
            <li className="rounds-total-row">
              <span>Summe Region</span>
              <span>
                {savings
                  .reduce((sum, entry) => sum + entry.confirmedKg, 0)
                  .toLocaleString("de-DE")}{" "}
                kg
              </span>
              <span />
              <span className="rounds-cell-strong value-positive">
                {totalSavings.toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
            </li>
          </ol>
        </section>
      ) : null}

      <section className="request-file request-file--bundle" aria-labelledby="bundle-title">
        <header className="request-file__columns request-file__columns--bundle" aria-hidden="true">
          <span>Produkt / Spezifikation</span>
          <span>Menge gesamt</span>
          <span>Läden</span>
        </header>
        {bundle.length === 0 ? (
          <p className="request-file__empty">
            Noch kein bestätigter Bedarf. Die Bündelung zeigt Positionen nach
            dem Bestellschluss oder bei vorzeitiger Schließung.
          </p>
        ) : (
          <ol>
            {bundle.map((entry) => (
              <li key={`${entry.productName}-${entry.specification}`}>
                <span className="request-file__store">
                  {entry.productName}
                  <small>{entry.specification}</small>
                </span>
                <span className="rounds-cell-strong">
                  {Number(entry.totalQuantity).toLocaleString("de-DE")}{" "}
                  {entry.unit === "PIECE" ? "Stück" : "kg"}
                  <small>{entry.positionCount} Position(en)</small>
                </span>
                <span className="rounds-cell-muted">{entry.shopCount}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
