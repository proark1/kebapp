import { ArrowLeft, FileWarning, ShieldCheck } from "lucide-react";
import type { StoreProfile } from "@/lib/types";

type StorefrontLegalPageProps = {
  kind: "datenschutz" | "impressum";
  profile: StoreProfile;
  publicSlug: string;
};

export function StorefrontLegalPage({
  kind,
  profile,
  publicSlug,
}: StorefrontLegalPageProps) {
  const isImprint = kind === "impressum";

  return (
    <main className="storefront-legal-page">
      <header>
        <a href={`/laden/${publicSlug}`}>
          <ArrowLeft aria-hidden="true" size={17} /> Zurück zu {profile.name}
        </a>
        <span>{profile.shortName}</span>
      </header>

      <article>
        <div className="storefront-legal-page__warning" role="note">
          <FileWarning aria-hidden="true" size={22} />
          <div>
            <strong>Demo-Muster – keine rechtliche Produktivfassung</strong>
            <p>
              Diese Seite zeigt nur Aufbau und Platzhalter. Vor einer echten
              Veröffentlichung muss sie mit den tatsächlichen Betriebsdaten
              vervollständigt und fachlich geprüft werden.
            </p>
          </div>
        </div>

        <p className="storefront-eyebrow">Rechtliche Musterseite</p>
        <h1>{isImprint ? "Impressum" : "Datenschutz"}</h1>

        {isImprint ? (
          <>
            <section>
              <h2>Noch einzutragende Pflichtangaben</h2>
              <p>
                Für diese Demo werden bewusst keine Betreiberperson, Rechtsform,
                Registerdaten, Aufsichtsbehörde oder Steuerkennzeichnung erfunden.
              </p>
              <ul>
                <li>vollständiger Name und Rechtsform des verantwortlichen Betriebs</li>
                <li>ladungsfähige Anschrift und direkte Kontaktmöglichkeiten</li>
                <li>Vertretungsberechtigte, Register und Registernummer, sofern zutreffend</li>
                <li>Umsatzsteuer- oder Wirtschafts-ID, sofern vorhanden und erforderlich</li>
                <li>weitere branchenspezifische Hinweise nach fachlicher Prüfung</li>
              </ul>
            </section>
            <section>
              <h2>In der Demo verwendete Ladenangaben</h2>
              <p>
                {profile.name} · {profile.street} · {profile.postalCode} {profile.city}
                {profile.phone ? ` · ${profile.phone}` : ""}
              </p>
              <small>Diese Angaben sind Beispieldaten und kein vollständiges Impressum.</small>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2>Technischer Umfang dieser Demo</h2>
              <p>
                Die öffentliche Ladenwebsite setzt kein Besuchertracking ein,
                bindet keine Karte ein und nimmt keine Bestellung oder Zahlung an.
                Ein Kartendienst wird erst geöffnet, wenn Besucher aktiv auf den
                externen Routenlink klicken.
              </p>
            </section>
            <section>
              <h2>Vor dem Produktivbetrieb zu ergänzen</h2>
              <ul>
                <li>verantwortliche Stelle mit den tatsächlichen Kontaktdaten</li>
                <li>Hosting, Protokollierung, Speicherdauer und Rechtsgrundlagen</li>
                <li>eingesetzte Dienstleister und vereinbarte Auftragsverarbeitung</li>
                <li>Betroffenenrechte, Beschwerdemöglichkeit und Kontaktweg</li>
                <li>spätere Formulare, Analyse-, Karten-, Bestell- oder Zahlungsdienste</li>
              </ul>
            </section>
          </>
        )}

        <footer>
          <ShieldCheck aria-hidden="true" size={18} />
          Vor Produktivsetzung durch eine geeignete Fachperson prüfen und freigeben lassen.
        </footer>
      </article>
    </main>
  );
}
