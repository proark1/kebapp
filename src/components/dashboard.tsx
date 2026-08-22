import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  Globe2,
  PackageCheck,
  ReceiptText,
  Sparkles,
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
const deadlineLabel = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});

type DashboardProps = {
  operatorName: string;
  organization: ActiveOrganizationDTO;
  planning: DemandPlanningData | null;
  storefront: StorefrontEditorData | null;
};

export function Dashboard({
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

  return (
    <div className="page-stack">
      <header className="page-header page-header--dashboard">
        <div>
          <span className="eyebrow">{todayLabel}</span>
          <h1>Guten Morgen, {firstName}.</h1>
          <p>
            {canManageWebsite
              ? "Zwei Dinge kannst du heute direkt erledigen."
              : "Dein Ladenbereich ist bereit für den nächsten Bedarf."}
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

        <article className="decision-card">
          <div className="decision-card__icon">
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <div>
            <span className="eyebrow">Pilotvorschau · Kebapp-Vorschlag</span>
            <h2>14 kg Kalb ergänzen?</h2>
            <p>
              Freitage lagen zuletzt 11 % über deinem Plan. Mit 14 kg Reserve
              sinkt das Risiko einer Nachbestellung.
            </p>
          </div>
          <div className="decision-card__actions">
            <Link className="button button--primary" href="/app/einkauf">
              Vorschlag prüfen
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <span className="confidence-note">Beispielprognose · noch ohne Kassendaten</span>
        </article>
      </section>

      <section className="metric-grid" aria-label="Kennzahlen">
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--green">
            <TrendingDown size={20} aria-hidden="true" />
          </div>
          <span className="metric-card__label">Diese Sammelrunde · Beispieldaten</span>
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
          <span className="metric-card__label">Offene Belege · Pilotvorschau</span>
          <strong>4</strong>
          <small>Davon einer mit Preisabweichung</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel task-panel">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Heute</span>
              <h2>Deine Aufgaben</h2>
            </div>
            <span className="count-badge">
              {canManageWebsite ? "2 offen" : "1 offen"}
            </span>
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
            {canManageWebsite ? (
              <li>
                <span className="task-list__status">
                  <CalendarClock size={18} aria-hidden="true" />
                </span>
                <div>
                  <strong>Öffnungszeiten prüfen</strong>
                  <span>Feiertag in 9 Tagen</span>
                </div>
                <Link href="/app/website" aria-label="Öffnungszeiten öffnen">
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
