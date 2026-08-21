import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { getOptionalSession } from "@/server/auth/session";
import { getRegistrationState } from "@/server/organizations/registration";

export const metadata: Metadata = {
  title: "Antragsstatus",
  robots: { follow: false, index: false },
};

const copy = {
  PENDING: {
    eyebrow: "Eingegangen",
    title: "Dein Antrag liegt auf unserem Prüftisch.",
    text: "Wir gleichen die Angaben persönlich ab und melden uns über die hinterlegten Kontaktdaten. Bis zur Freigabe bleiben Einkaufs- und Betriebsdaten geschlossen.",
  },
  REJECTED: {
    eyebrow: "Rückfrage nötig",
    title: "Der Pilotzugang wurde noch nicht freigegeben.",
    text: "Der Antrag ist abgeschlossen, aber noch nicht für den Piloten freigegeben. Melde dich bei uns, wenn sich Angaben geändert haben oder du die Entscheidung besprechen möchtest.",
  },
  SUSPENDED: {
    eyebrow: "Zugang pausiert",
    title: "Der Ladenbereich ist vorübergehend geschlossen.",
    text: "Deine Betriebsdaten bleiben geschützt. Wir klären den Grund gemeinsam, bevor der Zugang wieder genutzt werden kann.",
  },
} as const;

export default async function RegistrationStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ neu?: string }>;
}) {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect("/anmelden?weiter=/status");
  }

  const state = await getRegistrationState({ actor });
  if (state.status === "NONE") {
    redirect("/antrag");
  }
  if (state.status === "ACTIVE") {
    redirect("/app");
  }

  const params = await searchParams;
  const content = copy[state.status];
  const submittedAt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(state.submittedAt);

  return (
    <div className="status-shell">
      <header className="status-topbar">
        <Link href="/" aria-label="Kebapp Startseite">
          <BrandMark inverse />
        </Link>
        <span>NRW-PILOT · GESCHÜTZTER STATUS</span>
      </header>

      <main className="status-main">
        <section className="status-copy">
          <p className="status-eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.text}</p>
          {params.neu === "1" ? (
            <p className="status-success" role="status">
              Antrag erfolgreich eingereicht.
            </p>
          ) : null}
          {state.status === "REJECTED" && state.reviewNote ? (
            <div className="status-review-note">
              <span>Hinweis aus der Prüfung</span>
              <p>{state.reviewNote}</p>
            </div>
          ) : null}
        </section>

        <aside className={`status-receipt status-receipt--${state.status.toLowerCase()}`}>
          <header>
            <span>STATUSBELEG</span>
            <strong>KEB–NRW</strong>
          </header>
          <div className="status-stamp">{content.eyebrow}</div>
          <dl>
            <div>
              <dt>Laden</dt>
              <dd>{state.storeName}</dd>
            </div>
            <div>
              <dt>Eingang</dt>
              <dd>{submittedAt}</dd>
            </div>
            <div>
              <dt>Referenz</dt>
              <dd>{state.requestId.slice(0, 8).toUpperCase()}</dd>
            </div>
          </dl>
          <footer>
            <span>Keine Betriebsdaten freigegeben</span>
            <Link href="mailto:pilot@kebapp.de">Kontakt</Link>
          </footer>
        </aside>
      </main>
    </div>
  );
}
