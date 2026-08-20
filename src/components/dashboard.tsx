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

const todayLabel = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "long",
}).format(new Date());

export function Dashboard() {
  return (
    <div className="page-stack">
      <header className="page-header page-header--dashboard">
        <div>
          <span className="eyebrow">{todayLabel}</span>
          <h1>Guten Morgen, Cem.</h1>
          <p>Drei Dinge brauchen heute deine Entscheidung.</p>
        </div>
        <div className="header-actions">
          <span className="live-status">
            <i aria-hidden="true" />
            Betrieb läuft
          </span>
          <button className="avatar-button" type="button" aria-label="Profil öffnen">
            CK
          </button>
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
            <span className="count-badge">3 offen</span>
          </div>
          <ul className="task-list">
            <li>
              <span className="task-list__status task-list__status--urgent">
                <CircleAlert size={18} aria-hidden="true" />
              </span>
              <div>
                <strong>Fleischbedarf bestätigen</strong>
                <span>Bestellschluss morgen um 18:00 Uhr</span>
              </div>
              <Link href="/app/einkauf" aria-label="Fleischbedarf öffnen">
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </li>
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

        <article className="panel website-status-card">
          <div className="panel__header">
            <div>
              <span className="eyebrow">Deine Internetseite</span>
              <h2>Online und aktuell</h2>
            </div>
            <span className="status-dot status-dot--online">
              <Check size={13} aria-hidden="true" />
              Live
            </span>
          </div>

          <div className="mini-browser" aria-hidden="true">
            <div className="mini-browser__bar">
              <i />
              <i />
              <i />
              <span>ocakbasi-rheydt.de</span>
            </div>
            <div className="mini-browser__page">
              <span>OR</span>
              <div>
                <small>SEIT 1998 IN RHEYDT</small>
                <strong>Schicht für Schicht.</strong>
                <i />
              </div>
            </div>
          </div>

          <div className="website-status-card__meta">
            <span>
              <Globe2 size={16} aria-hidden="true" />
              SSL aktiv
            </span>
            <span>
              <Clock3 size={16} aria-hidden="true" />
              vor 2 Tagen aktualisiert
            </span>
          </div>
          <div className="website-status-card__actions">
            <Link className="button button--secondary" href="/app/website">
              Website bearbeiten
            </Link>
            <Link
              className="icon-button icon-button--bordered"
              href="/laden/ocakbasi-rheydt"
              aria-label="Öffentliche Website öffnen"
              target="_blank"
            >
              <ExternalLink size={18} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
