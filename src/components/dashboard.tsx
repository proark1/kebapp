import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  Globe2,
  PackageCheck,
  ReceiptText,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { BuyingRoundMeter } from "@/components/buying-round-meter";
import { formatCurrency, getBuyingRoundSnapshot } from "@/lib/calculations";
import type { DemandPlanningData, StorefrontEditorData } from "@/lib/types";
import type { ActiveOrganizationDTO } from "@/server/organizations/organization-dto";

const todayLabel = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "long",
}).format(new Date());

function daytimeGreeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Berlin",
    }).format(now),
  );
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

const deadlineLabel = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});

/** Aus den erfassten Eingangsrechnungen gerechnet, nicht geschaetzt. */
export type DashboardInvoiceSummary = {
  openCount: number;
  openGrossEuros: number;
  overdueCount: number;
};

type DashboardProps = {
  invoices: DashboardInvoiceSummary;
  operatorName: string;
  organization: ActiveOrganizationDTO;
  planning: DemandPlanningData | null;
  storefront: StorefrontEditorData | null;
};

export function Dashboard({
  invoices,
  operatorName,
  organization,
  planning,
  storefront,
}: DashboardProps) {
  const firstName = operatorName.trim().split(/\s+/)[0] || operatorName;
  const canManageWebsite = organization.role === "OWNER";
  const roundSnapshot = planning
    ? getBuyingRoundSnapshot(planning.round, planning.items)
    : null;
  // Die Aufgabenliste zaehlt sich selbst. Vorher stand dort fest "2 offen",
  // unabhaengig davon, was tatsaechlich zu tun war.
  const openTaskCount = 1 + (invoices.overdueCount > 0 ? 1 : 0);

  return (
    <div className="page-stack">
      <header className="page-header page-header--dashboard">
        <div>
          <span className="eyebrow">{todayLabel}</span>
          <h1>{daytimeGreeting(new Date())}, {firstName}.</h1>
          <p>
            {openTaskCount === 1
              ? "Eine Sache wartet heute auf dich."
              : `${openTaskCount} Dinge kannst du heute direkt erledigen.`}
          </p>
        </div>
        <div className="header-actions">
          <span className="live-status">
            <i aria-hidden="true" />
            Betrieb läuft
          </span>
        </div>
      </header>

      <section className="dashboard-lead" aria-label="Aktuelle Sammelrunde">
        {planning ? (
          <BuyingRoundMeter round={planning.round} demands={planning.items} />
        ) : (
          <article className="dashboard-round-empty">
            <PackageCheck size={28} aria-hidden="true" />
            <span className="eyebrow eyebrow--light">Sammelrunde</span>
            <h2>Nächste Runde in Vorbereitung</h2>
            <p>Dein Laden wird automatisch informiert, sobald sie geöffnet ist.</p>
          </article>
        )}
      </section>

      <section className="metric-grid" aria-label="Kennzahlen">
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--green">
            <TrendingDown size={20} aria-hidden="true" />
          </div>
          <span className="metric-card__label">Diese Sammelrunde</span>
          <strong>
            {roundSnapshot ? formatCurrency(roundSnapshot.estimatedSavings) : "—"}
          </strong>
          <small>Voraussichtliche Ersparnis aus bestätigter Gruppenmenge</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--yellow">
            <PackageCheck size={20} aria-hidden="true" />
          </div>
          <span className="metric-card__label">Nächste Lieferung</span>
          <strong>{roundSnapshot ? `${roundSnapshot.storeKg} kg` : "—"}</strong>
          <small>{planning?.round.deliveryWindow ?? "Noch kein Lieferfenster"}</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--red">
            <ReceiptText size={20} aria-hidden="true" />
          </div>
          <span className="metric-card__label">Offene Belege</span>
          <strong>{invoices.openCount}</strong>
          <small>
            {invoices.openCount === 0
              ? "Alle erfassten Rechnungen sind bezahlt"
              : invoices.overdueCount > 0
                ? `${formatCurrency(invoices.openGrossEuros)} offen · ${invoices.overdueCount} überfällig`
                : `${formatCurrency(invoices.openGrossEuros)} offen`}
          </small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel task-panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Heute</span>
              <h2>Deine Aufgaben</h2>
            </div>
            <span className="count-badge">{openTaskCount} offen</span>
          </div>
          <ul className="task-list">
            <li>
              <span className="task-list__status task-list__status--urgent">
                <CircleAlert size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>
                  {planning?.submissionStatus === "CONFIRMED"
                    ? "Fleischbedarf bestätigt"
                    : organization.role === "OWNER"
                      ? "Fleischbedarf bestätigen"
                      : "Fleischbedarf eintragen"}
                </strong>
                <span>
                  {planning
                    ? `Bestellschluss ${deadlineLabel.format(new Date(planning.round.closesAt))} Uhr`
                    : "Nächste Sammelrunde wird vorbereitet"}
                </span>
              </div>
              <Link href="/app/einkauf" aria-label="Fleischbedarf öffnen">
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </li>
            {invoices.overdueCount > 0 ? (
              <li>
                <span className="task-list__status task-list__status--urgent">
                  <ReceiptText size={18} aria-hidden="true" />
                </span>
                <div>
                  <strong>
                    {invoices.overdueCount === 1
                      ? "Eine Rechnung ist überfällig"
                      : `${invoices.overdueCount} Rechnungen sind überfällig`}
                  </strong>
                  <span>Fälligkeitsdatum überschritten</span>
                </div>
                <Link href="/app/buchhaltung" aria-label="Buchhaltung öffnen">
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </li>
            ) : null}
          </ul>
        </article>

        {canManageWebsite ? (
          <article className="panel website-status-card">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Deine Internetseite</span>
                <h2>
                  {storefront?.isPublished
                    ? "Online und erreichbar"
                    : "Als Entwurf vorbereitet"}
                </h2>
              </div>
              <span
                className={`status-dot ${storefront?.isPublished ? "status-dot--online" : ""}`}
              >
                {storefront?.isPublished ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Clock3 size={13} aria-hidden="true" />
                )}
                {storefront?.isPublished ? "Online" : "Entwurf"}
              </span>
            </div>

            <div className="mini-browser" aria-hidden="true">
              <div className="mini-browser__bar">
                <i />
                <i />
                <i />
                <span>
                  {storefront?.customDomain ??
                    storefront?.publicPath ??
                    "Lokale Adresse wird vorbereitet"}
                </span>
              </div>
              <div className="mini-browser__page">
                <span>{organization.initials}</span>
                <div>
                  <small>KOSTENLOSE LADENWEBSITE</small>
                  <strong>{organization.storeName} im Web.</strong>
                  <i />
                </div>
              </div>
            </div>

            <div className="website-status-card__meta">
              <span>
                <Globe2 size={16} aria-hidden="true" />
                {storefront?.isPublished
                  ? "Öffentlich erreichbar"
                  : "Nicht öffentlich"}
              </span>
              <span>
                <Clock3 size={16} aria-hidden="true" />
                Domain &amp; SSL folgen im Produktionsschritt
              </span>
            </div>
            <div className="website-status-card__actions">
              <Link className="button button--secondary" href="/app/website">
                Website bearbeiten
              </Link>
              {storefront?.isPublished ? (
                <Link
                  aria-label="Öffentliche Website öffnen"
                  className="icon-button icon-button--bordered"
                  href={storefront.publicPath}
                  target="_blank"
                >
                  <ExternalLink size={18} aria-hidden="true" />
                </Link>
              ) : (
                <span
                  className="icon-button icon-button--bordered"
                  aria-hidden="true"
                >
                  <ExternalLink size={18} />
                </span>
              )}
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}
