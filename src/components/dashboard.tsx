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
import { buyingRound, initialDemands } from "@/lib/demo-data";
import type { ActiveOrganizationDTO } from "@/server/organizations/organization-dto";

const todayLabel = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "long",
}).format(new Date());

type DashboardProps = {
  operatorName: string;
  organization: ActiveOrganizationDTO;
};

export function Dashboard({ operatorName, organization }: DashboardProps) {
  const firstName = operatorName.trim().split(/\s+/)[0] || operatorName;
  const canManageWebsite = organization.role === "OWNER";

  return (
    <div className="page-stack">
      <header className="page-header page-header--dashboard">
        <div>
          <span className="eyebrow">{todayLabel}</span>
          <h1>Guten Morgen, {firstName}.</h1>
          <p>
            {canManageWebsite
              ? "Drei Dinge brauchen heute deine Entscheidung."
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
        <BuyingRoundMeter round={buyingRound} demands={initialDemands} />

        <article className="decision-card">
          <div className="decision-card__icon">
            <Sparkles size={20} aria-hidden="true" />
          </div>
          <div>
            <span className="eyebrow">Kebapp-Vorschlag</span>
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
            <button className="button button--quiet" type="button">
              Später
            </button>
          </div>
          <span className="confidence-note">Prognosesicherheit 82 %</span>
        </article>
      </section>

      <section className="metric-grid" aria-label="Kennzahlen">
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--green">
            <TrendingDown size={20} aria-hidden="true" />
          </div>
          <span className="metric-card__label">Ersparnis im August</span>
          <strong>612,40 €</strong>
          <small>8,3 % unter deinem Referenzpreis</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--yellow">
            <PackageCheck size={20} aria-hidden="true" />
          </div>
          <span className="metric-card__label">Nächste Lieferung</span>
          <strong>86 kg</strong>
          <small>Montag · 06:00–09:00 Uhr</small>
        </article>
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--red">
            <ReceiptText size={20} aria-hidden="true" />
          </div>
          <span className="metric-card__label">Offene Belege</span>
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
              {canManageWebsite ? "3 offen" : "2 offen"}
            </span>
          </div>
          <ul className="task-list">
            <li>
              <span className="task-list__status task-list__status--urgent">
                <CircleAlert size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>
                  {organization.role === "OWNER"
                    ? "Fleischbedarf bestätigen"
                    : "Fleischbedarf prüfen"}
                </strong>
                <span>Bestellschluss morgen um 18:00 Uhr</span>
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
            <li>
              <span className="task-list__status">
                <ReceiptText size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>Rechnung kontrollieren</strong>
                <span>12,80 € über der Bestellung</span>
              </div>
              <button type="button" aria-label="Rechnung öffnen">
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </li>
          </ul>
        </article>

        {canManageWebsite ? (
          <article className="panel website-status-card">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Deine Internetseite</span>
                <h2>Für deinen Auftritt bereit</h2>
              </div>
              <span className="status-dot status-dot--online">
                <Check size={13} aria-hidden="true" />
                Pilot
              </span>
            </div>

            <div className="mini-browser" aria-hidden="true">
              <div className="mini-browser__bar">
                <i />
                <i />
                <i />
                <span>Webadresse in Vorbereitung</span>
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
                SSL automatisch
              </span>
              <span>
                <Clock3 size={16} aria-hidden="true" />
                Domain folgt später
              </span>
            </div>
            <div className="website-status-card__actions">
              <Link className="button button--secondary" href="/app/website">
                Website bearbeiten
              </Link>
              <span className="icon-button icon-button--bordered" aria-hidden="true">
                <ExternalLink size={18} />
              </span>
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}
