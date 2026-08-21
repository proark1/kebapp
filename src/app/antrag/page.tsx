import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { StoreRegistrationForm } from "@/components/organizations/store-registration-form";
import { getOptionalSession } from "@/server/auth/session";
import { getRegistrationState } from "@/server/organizations/registration";
import { submitStoreRegistrationAction } from "./actions";

export const metadata: Metadata = {
  title: "Ladenantrag",
  robots: { follow: false, index: false },
};

export default async function StoreRegistrationPage() {
  const actor = await getOptionalSession();

  if (!actor) {
    redirect("/anmelden?weiter=/antrag");
  }

  const state = await getRegistrationState({ actor });
  if (state.status !== "NONE") {
    redirect(state.status === "ACTIVE" ? "/app" : "/status");
  }

  return (
    <div className="registration-shell">
      <a className="skip-link" href="#registration-form">
        Zum Antrag springen
      </a>
      <header className="registration-topbar">
        <Link href="/" aria-label="Kebapp Startseite">
          <BrandMark />
        </Link>
        <div>
          <span>NRW-PILOT</span>
          <strong>Mönchengladbach + Umgebung</strong>
        </div>
      </header>

      <main className="registration-main">
        <section className="registration-intro">
          <p className="registration-kicker">Ladenakte · Schritt 1 von 1</p>
          <h1>Dein Laden kommt ins Netzwerk.</h1>
          <p>
            Wir brauchen nur die Betriebs- und Kontaktdaten für das erste
            Kennenlernen. Fleischmengen, Website und weitere Abläufe folgen
            nach der persönlichen Freigabe.
          </p>

          <ol className="registration-steps">
            <li className="registration-steps__active">
              <span>1</span>
              <div>
                <strong>Laden melden</strong>
                <small>Heute · etwa 3 Minuten</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Persönliche Prüfung</strong>
                <small>Wir melden uns direkt</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Pilotzugang</strong>
                <small>Einkauf und Website starten</small>
              </div>
            </li>
          </ol>

          <aside className="registration-note">
            <span>Keine Zahlung</span>
            <p>
              Der aktuelle Pilot enthält keine Bezahlfunktion. Auch die erste
              Ladenwebsite stellen wir ohne Bezahlabwicklung bereit.
            </p>
          </aside>
        </section>

        <section
          aria-labelledby="registration-title"
          className="registration-sheet"
          id="registration-form"
        >
          <header className="registration-sheet__header">
            <div>
              <span>Antrag</span>
              <strong>KEB–NRW / NEU</strong>
            </div>
            <p>Nur für die Pilotprüfung</p>
          </header>
          <div className="registration-sheet__title">
            <p>Betreiberdaten</p>
            <h2 id="registration-title">Kurzer Ladenantrag</h2>
          </div>
          <StoreRegistrationForm
            action={submitStoreRegistrationAction}
            contactEmail={actor.email}
            contactName={actor.name}
          />
        </section>
      </main>
    </div>
  );
}
