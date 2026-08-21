import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-main">
        Zum Formular springen
      </a>

      <aside className="auth-stage" aria-label="Kebapp Pilot">
        <Link className="auth-stage__brand" href="/anmelden" aria-label="Kebapp Anmeldung">
          <BrandMark inverse />
        </Link>

        <div className="auth-stage__copy">
          <p className="auth-stage__region">Pilotregion · Mönchengladbach + NRW</p>
          <h2>Viele Läden. Eine stärkere Bestellung.</h2>
          <p>
            Bedarf melden, Mengen bündeln und den Betrieb Schritt für Schritt
            digital organisieren.
          </p>
        </div>

        <section className="auth-docket" aria-label="Leistungen im Kebapp Pilot">
          <header>
            <span>Sammelzettel</span>
            <span>KEB–NRW</span>
          </header>
          <dl>
            <div>
              <dt>Fleischbedarf</dt>
              <dd>gebündelt</dd>
            </div>
            <div>
              <dt>Ladenbetrieb</dt>
              <dd>an einem Ort</dd>
            </div>
            <div>
              <dt>Eigene Website</dt>
              <dd>inklusive</dd>
            </div>
          </dl>
          <footer>
            <span>Betreut statt allein</span>
            <strong>1 Netzwerk</strong>
          </footer>
        </section>
      </aside>

      <div className="auth-workspace">{children}</div>
    </div>
  );
}
